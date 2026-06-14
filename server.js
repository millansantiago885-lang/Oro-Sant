const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const https  = require('https');
const crypto = require('crypto');
const pg     = require('pg');

const PORT       = process.env.PORT || 3000;
const PUB_DIR    = path.join(__dirname, 'public');
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SHEET_ID   = '13yO-txTsYh7cweDJH8vk7b2NjquWOdZhpB-Yx-FEBQg';
const GS_EMAIL   = 'orosanto@gen-lang-client-0007030219.iam.gserviceaccount.com';
const GS_KEY     = (process.env.GS_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHzGFI9sfBNa6O\n4HHgT07s6+L6FoHO6GX0nb7JAulUGNUb02wwgwQkXCIAAo6yoVGp7RdNdRkxel0t\nbMZp0kxMEAf+XwNvyA+gJYsa9/stwtF3aNpJ9DlhbHXSNBc08T/1cTFrEADiK/yA\n+kA0Efd08tU1L+t1phRfq8uufNy7wexNhsxaGtIwWdZLa8LesAHVqjJ0zPn67fxA\nXTLik3Zp+pwxyQWZZIdk8QGAY07rnjDPEKA0xhp0EnegU/UWFrgkf4IyWJnCYFDJ\n/qTNjd4nQFEKJ7Vq44CUlGYEzwfFPlzT1y/dx09zarbbcwASZ16kttgE2GaOlZsX\nCT/kHSTDAgMBAAECggEARjMKuXqvu7RzVRMKH9BtwDOvJ8SRrlOcQwLLvk+uEJS7\nB9BUkoTuByJx9cPwRFYG3egGSHpMtEQ0idnOqu6vTQhS7q6OhA9sYg3e3sZjc/Qf\n6c8m51YOdSsJCKaxwrHDEadIQEA6tzzSNrT2qvTnF6mcfNgN6GPGg8jWQ0PuwG7m\n/KNO4LKnwfiBO3F39PDf54lN71J/tydyd6waQHQ9PIh+4L/V+e+0hDkItfMp+6qO\nAzacZbUuxs4tFuVfzbkXFMogvlvhX9fX/1A4vji5UUSx0HBT/xbYMu7o0nSPDYAe\neQmrPbhhk8QNNrCf5pZWqoMqttgB/9KcLArcrd0E6QKBgQDjk5uUzxFjnstjx1zq\nB8dWgtHxxdk0GAIzJCsSAU4FM7nhwzWT1/OJe7f9J7ouhkd5g9+9D6Je4cCIJJ0c\nsbWySQROyWdY1irDxM3We6WgmdoCJFHIriDitzk9TtY3gkV4foIj/DShp3DuWmAi\ntwR6n7B2nU0yZTa5moz2YIrZCwKBgQDgwJu8pKx47cYzMMBbkpk2mcRuJcRciLo9\nEM4WW0PbGUWtNG2rcpC7sfv3HGj6hR44RCyjnYxSamcax7FHWE0GQkiaqNKpLmmH\nDGGeA7Y0g4hZdUM2NBqo1EFOxgWD6/mTcf9X1RpqjkV+lgKN2jxZQEc13LcrjvZX\ngmChLfJmKQKBgQDZ4ocAsEf70xr0CvogbxYg89tB2aUdRSdGA4jhEjK6tE1xo052\noDlhFfyP+is9Q/7GjsX14zQYF5gYQMXTpSlK6rGfJSE3YsVK7fANPBDVdLfPeSp8\nMor1xWqeEg7y0lzlAmpjPaK+auuqqQiF9Cfrp1xyFCTG7TS5+wifEsudBQKBgArw\nlSQLh/Gi8UDQoKxUaGzF80/BOtueNCKAzOc9rgHeKwwRPz1XKEBam38dvOZk0GHA\nv8N/CbOBRl+BVNm6LJWfaFVO3mIpxi0ypxW/7ICF3n8sPAdJZfrNyhgBf4c6Vz2c\nEOe/kbeaETvmJV2uP73AaTbv9WKDZO5BhF6UE/ZxAoGABFJ07S7daemyyAoCVoM2\n1JMHpEezkv3dGm0u6yvhx3f+0ahMnHuqwyqS8NbsFzs4ogvDpOMnmYhelAYWQsZx\nJfkVR/3xJtXBgA+vTaQIt44ZKNkucER1NCmqbDlI0Tj0U/nUptnCo4E6p9AyecAg\nRu6CtbxBH4+pB2Vw7MD1bTo=\n-----END PRIVATE KEY-----\n').replace(/\\n/g,'\n');

// ── Pool PostgreSQL ───────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function q(sql, params=[]) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function initDB() {
  await q(`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const defaults = {
    config: { name:'ORO SANTO', wa:'573001234567', banner:'Envíos Colombia · Garantía de calidad · Pago contra entrega' },
    categories: ['Cadenas','Topos','Anillos','Pulseras'],
    products: [],
    orders: [],
    combos: [],
    comboPairs: {}
  };
  for (const [key, val] of Object.entries(defaults)) {
    await q(`INSERT INTO store(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`, [key, JSON.stringify(val)]);
  }
  console.log('✓ DB lista');
}

async function getKey(key) {
  const r = await q('SELECT value FROM store WHERE key=$1', [key]);
  if (!r.rows.length) return null;
  try { return JSON.parse(r.rows[0].value); } catch { return r.rows[0].value; }
}

async function setKey(key, value) {
  await q(`INSERT INTO store(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2`, [key, JSON.stringify(value)]);
}

async function readDB() {
  const r = await q('SELECT key,value FROM store');
  const d = {};
  r.rows.forEach(row => { try { d[row.key]=JSON.parse(row.value); } catch { d[row.key]=row.value; } });
  return d;
}

// ── Helpers ───────────────────────────────────────────────
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};

function jsonR(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(r => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{r(JSON.parse(b));}catch{r({});} }); });
}

function serveStatic(res, fp) {
  fs.readFile(fp, (err,data) => {
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)]||'application/octet-stream'});
    res.end(data);
  });
}

function avail(p) {
  const av = p.stock - p.reserved;
  if(av<=0) return {label:'Agotado',color:'red',available:0};
  if(av<=3) return {label:`Últimas ${av} unidades`,color:'yellow',available:av};
  return {label:'Disponible',color:'green',available:av};
}

const fmt = n => n ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';

// ── Google Sheets ─────────────────────────────────────────
function b64u(buf){return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function getGToken(){
  const now=Math.floor(Date.now()/1000);
  const h=b64u(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const c=b64u(JSON.stringify({iss:GS_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now}));
  const s=crypto.createSign('RSA-SHA256'); s.update(h+'.'+c);
  const jwt=h+'.'+c+'.'+b64u(s.sign(GS_KEY));
  return new Promise((res,rej)=>{
    const body=`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const r=https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},(rr)=>{let d='';rr.on('data',c=>d+=c);rr.on('end',()=>{try{res(JSON.parse(d).access_token);}catch{rej(d);}});});
    r.on('error',rej); r.write(body); r.end();
  });
}
function sheetsReq(method,sub,token,body=null){
  return new Promise((res,rej)=>{
    const bs=body?JSON.stringify(body):null;
    const opts={hostname:'sheets.googleapis.com',path:`/v4/spreadsheets/${SHEET_ID}${sub}`,method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}};
    if(bs) opts.headers['Content-Length']=Buffer.byteLength(bs);
    const r=https.request(opts,(rr)=>{let d='';rr.on('data',c=>d+=c);rr.on('end',()=>{try{res(JSON.parse(d));}catch{res({});}});});
    r.on('error',rej); if(bs) r.write(bs); r.end();
  });
}
async function syncSheets(d) {
  try {
    const token=await getGToken();
    const info=await sheetsReq('GET','',token);
    const exist=(info.sheets||[]).map(s=>s.properties.title);
    const toAdd=['Inventario','Pedidos','Dashboard'].filter(n=>!exist.includes(n));
    if(toAdd.length) await sheetsReq('POST',':batchUpdate',token,{requests:toAdd.map(t=>({addSheet:{properties:{title:t}}}))});
    const prods=d.products||[], orders=d.orders||[];
    const paid=orders.filter(o=>o.status==='pagado');
    const rev=paid.reduce((s,o)=>s+o.total,0);
    const cost=paid.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>{const p=prods.find(x=>x.id===i.id);return ss+(p?p.cost*i.qty:0);},0),0);
    await sheetsReq('PUT','/values/Inventario!A1?valueInputOption=RAW',token,{values:[
      ['CÓDIGO','NOMBRE','CATEGORÍA','VARIANTE','COSTO','PRECIO','STOCK','RESERVADO','DISPONIBLE','ESTADO','GANANCIA x UND'],
      ...prods.map(p=>{const av=p.stock-p.reserved;return[p.code||'',p.name,p.cat,p.variant||'',fmt(p.cost),fmt(p.price),p.stock,p.reserved,av,av<=0?'AGOTADO':av<=3?'ÚLTIMAS':'DISPONIBLE',fmt((p.price||0)-(p.cost||0))];})
    ]});
    await sheetsReq('PUT','/values/Pedidos!A1?valueInputOption=RAW',token,{values:[
      ['ID','FECHA','ESTADO','CLIENTE','CIUDAD','ENTREGA','PRODUCTOS','TOTAL','COSTO','GANANCIA'],
      ...orders.map(o=>{const c=(o.items||[]).reduce((s,i)=>{const p=prods.find(x=>x.id===i.id);return s+(p?p.cost*i.qty:0);},0);return[o.id,new Date(o.createdAt).toLocaleString('es-CO'),o.status.toUpperCase(),o.customer?.name||'',o.customer?.city||'',o.customer?.ship||'',(o.items||[]).map(i=>`${i.name} x${i.qty}`).join(' | '),fmt(o.total),fmt(c),fmt(o.total-c)];})
    ]});
    await sheetsReq('PUT','/values/Dashboard!A1?valueInputOption=RAW',token,{values:[
      ['RESUMEN ORO SANTO',''],['Actualizado',new Date().toLocaleString('es-CO')],['',''],
      ['Total pedidos',orders.length],['Pagados',paid.length],['Pendientes',orders.filter(o=>o.status==='pendiente').length],['',''],
      ['Ingresos',fmt(rev)],['Costos',fmt(cost)],['GANANCIA NETA',fmt(rev-cost)],['',''],
      ['Productos',prods.length],['Disponibles',prods.filter(p=>p.stock-p.reserved>0).length],['Agotados',prods.filter(p=>p.stock-p.reserved<=0).length]
    ]});
    console.log('✓ Sheets sync');
  } catch(e) { console.error('Sheets err:',e?.message||e); }
}

// ── Servidor ──────────────────────────────────────────────
const server = http.createServer(async (req,res) => {
  const parsed=url.parse(req.url,true), pn=parsed.pathname;
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});res.end();return;}

  if(pn.startsWith('/api/')) {
    try {
      // LOGIN
      if(pn==='/api/login' && req.method==='POST'){
        const b=await readBody(req);
        if(b.pass===ADMIN_PASS) jsonR(res,{ok:true,token:Buffer.from(ADMIN_PASS).toString('base64')});
        else jsonR(res,{ok:false,msg:'Contraseña incorrecta'},401);
        return;
      }

      // CATALOG público
      if(pn==='/api/catalog' && req.method==='GET'){
        const d=await readDB();
        jsonR(res,{config:d.config||{},categories:d.categories||[],combos:d.combos||[],comboPairs:d.comboPairs||{},products:(d.products||[]).map(p=>({...p,avail:avail(p)}))});
        return;
      }

      // ORDER público
      if(pn==='/api/order' && req.method==='POST'){
        const b=await readBody(req), d=await readDB();
        const products=d.products||[], orders=d.orders||[], items=b.items||[];
        for(const item of items){
          const p=products.find(x=>x.id===item.id);
          if(!p){jsonR(res,{ok:false,msg:'Producto no encontrado'},400);return;}
          if(p.stock-p.reserved<item.qty){jsonR(res,{ok:false,msg:`Sin stock: ${p.name}`},400);return;}
        }
        const orderId='ORO-'+Date.now().toString().slice(-4);
        items.forEach(item=>{const p=products.find(x=>x.id===item.id);p.reserved+=item.qty;});
        const order={id:orderId,items:items.map(i=>{const p=products.find(x=>x.id===i.id);return{...i,name:p.name,variant:p.variant,price:p.price};}),customer:b.customer||{},total:b.total||0,status:'pendiente',createdAt:new Date().toISOString()};
        orders.unshift(order);
        await setKey('products',products); await setKey('orders',orders);
        syncSheets({...d,products,orders});
        jsonR(res,{ok:true,orderId,order}); return;
      }

      // AUTH
      const token=(req.headers['authorization']||'').replace('Bearer ','');
      if(token!==Buffer.from(ADMIN_PASS).toString('base64')){jsonR(res,{ok:false,msg:'No autorizado'},401);return;}

      // PRODUCTS GET
      if(pn==='/api/products' && req.method==='GET'){
        const products=await getKey('products')||[];
        jsonR(res,products.map(p=>({...p,avail:avail(p)}))); return;
      }
      // PRODUCTS POST
      if(pn==='/api/products' && req.method==='POST'){
        const b=await readBody(req);
        if(!b.name||!b.price||!b.cat||!b.code){jsonR(res,{ok:false,msg:'Nombre, código, precio y categoría son obligatorios'},400);return;}
        const products=await getKey('products')||[];
        const p={id:Date.now().toString(),code:b.code.trim().toUpperCase(),family:b.family||b.code.split('-').slice(0,2).join('-'),name:b.name.trim(),cat:b.cat,variant:b.variant||'Única',cost:parseFloat(b.cost)||0,price:parseFloat(b.price),stock:parseInt(b.stock)||0,reserved:0,img:b.img||null,badge:b.badge||null,createdAt:new Date().toISOString()};
        products.unshift(p); await setKey('products',products);
        const d=await readDB(); syncSheets({...d,products});
        jsonR(res,{ok:true,product:p}); return;
      }
      // PRODUCTS PUT/DELETE
      const pm=pn.match(/^\/api\/products\/(.+)$/);
      if(pm && req.method==='PUT'){
        const b=await readBody(req), products=await getKey('products')||[];
        const idx=products.findIndex(p=>p.id===pm[1]);
        if(idx<0){jsonR(res,{ok:false,msg:'No encontrado'},404);return;}
        const p=products[idx];
        products[idx]={...p,code:(b.code||p.code).trim().toUpperCase(),family:b.family||p.family,name:b.name||p.name,cat:b.cat||p.cat,variant:b.variant||p.variant,cost:b.cost!==undefined?parseFloat(b.cost):p.cost,price:b.price!==undefined?parseFloat(b.price):p.price,stock:b.stock!==undefined?parseInt(b.stock):p.stock,reserved:b.reserved!==undefined?parseInt(b.reserved):p.reserved,img:b.img!==undefined?b.img:p.img,badge:b.badge!==undefined?b.badge:p.badge};
        await setKey('products',products);
        const d=await readDB(); syncSheets({...d,products});
        jsonR(res,{ok:true,product:products[idx]}); return;
      }
      if(pm && req.method==='DELETE'){
        const products=(await getKey('products')||[]).filter(p=>p.id!==pm[1]);
        await setKey('products',products);
        const d=await readDB(); syncSheets({...d,products});
        jsonR(res,{ok:true}); return;
      }

      // ORDERS GET
      if(pn==='/api/orders' && req.method==='GET'){
        jsonR(res, await getKey('orders')||[]); return;
      }
      // ORDERS status
      const om=pn.match(/^\/api\/orders\/(.+)\/status$/);
      if(om && req.method==='PUT'){
        const b=await readBody(req), orders=await getKey('orders')||[], products=await getKey('products')||[];
        const o=orders.find(x=>x.id===om[1]);
        if(!o){jsonR(res,{ok:false,msg:'No encontrado'},404);return;}
        const prev=o.status; o.status=b.status;
        if(b.status==='pagado'&&prev!=='pagado'){o.items.forEach(item=>{const p=products.find(x=>x.id===item.id);if(p){p.stock-=item.qty;p.reserved-=item.qty;if(p.reserved<0)p.reserved=0;if(p.stock<0)p.stock=0;}});}
        if(b.status==='cancelado'&&prev==='pendiente'){o.items.forEach(item=>{const p=products.find(x=>x.id===item.id);if(p){p.reserved-=item.qty;if(p.reserved<0)p.reserved=0;}});}
        await setKey('orders',orders); await setKey('products',products);
        const d=await readDB(); syncSheets({...d,orders,products});
        jsonR(res,{ok:true,order:o}); return;
      }

      // CATEGORIES
      if(pn==='/api/categories' && req.method==='GET'){
        jsonR(res, await getKey('categories')||[]); return;
      }
      if(pn==='/api/categories' && req.method==='POST'){
        const b=await readBody(req), cats=await getKey('categories')||[];
        if(!b.name){jsonR(res,{ok:false,msg:'Nombre requerido'},400);return;}
        if(cats.includes(b.name)){jsonR(res,{ok:false,msg:'Ya existe'},409);return;}
        cats.push(b.name.trim()); await setKey('categories',cats);
        jsonR(res,{ok:true,categories:cats}); return;
      }
      const cm=pn.match(/^\/api\/categories\/(.+)$/);
      if(cm && req.method==='DELETE'){
        const cats=(await getKey('categories')||[]).filter(c=>c!==decodeURIComponent(cm[1]));
        await setKey('categories',cats);
        jsonR(res,{ok:true,categories:cats}); return;
      }

      // COMBOS
      if(pn==='/api/combos' && req.method==='PUT'){
        const b=await readBody(req);
        if(b.comboPairs) await setKey('comboPairs',b.comboPairs);
        if(b.combos) await setKey('combos',b.combos);
        jsonR(res,{ok:true}); return;
      }

      // CONFIG
      if(pn==='/api/config' && req.method==='PUT'){
        const b=await readBody(req), config=await getKey('config')||{};
        const newCfg={...config,...b}; await setKey('config',newCfg);
        jsonR(res,{ok:true,config:newCfg}); return;
      }

      // DASHBOARD
      if(pn==='/api/dashboard' && req.method==='GET'){
        const products=await getKey('products')||[], orders=await getKey('orders')||[];
        const today=new Date().toDateString(), paid=orders.filter(o=>o.status==='pagado');
        const rev=paid.reduce((s,o)=>s+o.total,0);
        const cost=paid.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>{const p=products.find(x=>x.id===i.id);return ss+(p?p.cost*i.qty:0);},0),0);
        const agotados=products.filter(p=>p.stock-p.reserved<=0);
        jsonR(res,{totalProducts:products.length,available:products.filter(p=>p.stock-p.reserved>0).length,agotados:agotados.length,ultimas:products.filter(p=>{const a=p.stock-p.reserved;return a>0&&a<=3;}).length,pendientes:orders.filter(o=>o.status==='pendiente').length,todayOrders:orders.filter(o=>new Date(o.createdAt).toDateString()===today).length,todayRevenue:orders.filter(o=>new Date(o.createdAt).toDateString()===today&&o.status==='pagado').reduce((s,o)=>s+o.total,0),totalRevenue:rev,totalCost:cost,ganancia:rev-cost,restock:agotados.map(p=>p.code+' '+p.name)});
        return;
      }

      // SYNC manual
      if(pn==='/api/sync' && req.method==='POST'){
        const d=await readDB(); await syncSheets(d);
        jsonR(res,{ok:true}); return;
      }

      jsonR(res,{ok:false,msg:'Ruta no encontrada'},404);
    } catch(e) {
      console.error('API error:', e?.message||e);
      jsonR(res,{ok:false,msg:'Error interno: '+e?.message},500);
    }
    return;
  }

  let fp=path.join(PUB_DIR, pn==='/'?'index.html':pn);
  if(!fp.startsWith(PUB_DIR)){res.writeHead(403);res.end();return;}
  if(!path.extname(fp)) fp+='.html';
  serveStatic(res,fp);
});

server.listen(PORT, async () => {
  console.log(`ORO SANTO en puerto ${PORT}`);
  try { await initDB(); } catch(e) { console.error('initDB error:', e?.message); }
});
