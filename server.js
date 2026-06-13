const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const https = require('https');

const PORT      = process.env.PORT || 3000;
const DB_PATH   = path.join(__dirname, 'data', 'db.json');
const PUB_DIR   = path.join(__dirname, 'public');
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// ── Google Sheets config ──────────────────────────────────
const SHEET_ID     = process.env.SHEET_ID || '13yO-txTsYh7cweDJH8vk7b2NjquWOdZhpB-Yx-FEBQg';
const GS_EMAIL     = process.env.GS_EMAIL || 'orosanto@gen-lang-client-0007030219.iam.gserviceaccount.com';
const GS_KEY_RAW   = process.env.GS_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHzGFI9sfBNa6O\n4HHgT07s6+L6FoHO6GX0nb7JAulUGNUb02wwgwQkXCIAAo6yoVGp7RdNdRkxel0t\nbMZp0kxMEAf+XwNvyA+gJYsa9/stwtF3aNpJ9DlhbHXSNBc08T/1cTFrEADiK/yA\n+kA0Efd08tU1L+t1phRfq8uufNy7wexNhsxaGtIwWdZLa8LesAHVqjJ0zPn67fxA\nXTLik3Zp+pwxyQWZZIdk8QGAY07rnjDPEKA0xhp0EnegU/UWFrgkf4IyWJnCYFDJ\n/qTNjd4nQFEKJ7Vq44CUlGYEzwfFPlzT1y/dx09zarbbcwASZ16kttgE2GaOlZsX\nCT/kHSTDAgMBAAECggEARjMKuXqvu7RzVRMKH9BtwDOvJ8SRrlOcQwLLvk+uEJS7\nB9BUkoTuByJx9cPwRFYG3egGSHpMtEQ0idnOqu6vTQhS7q6OhA9sYg3e3sZjc/Qf\n6c8m51YOdSsJCKaxwrHDEadIQEA6tzzSNrT2qvTnF6mcfNgN6GPGg8jWQ0PuwG7m\n/KNO4LKnwfiBO3F39PDf54lN71J/tydyd6waQHQ9PIh+4L/V+e+0hDkItfMp+6qO\nAzacZbUuxs4tFuVfzbkXFMogvlvhX9fX/1A4vji5UUSx0HBT/xbYMu7o0nSPDYAe\neQmrPbhhk8QNNrCf5pZWqoMqttgB/9KcLArcrd0E6QKBgQDjk5uUzxFjnstjx1zq\nB8dWgtHxxdk0GAIzJCsSAU4FM7nhwzWT1/OJe7f9J7ouhkd5g9+9D6Je4cCIJJ0c\nsbWySQROyWdY1irDxM3We6WgmdoCJFHIriDitzk9TtY3gkV4foIj/DShp3DuWmAi\ntwR6n7B2nU0yZTa5moz2YIrZCwKBgQDgwJu8pKx47cYzMMBbkpk2mcRuJcRciLo9\nEM4WW0PbGUWtNG2rcpC7sfv3HGj6hR44RCyjnYxSamcax7FHWE0GQkiaqNKpLmmH\nDGGeA7Y0g4hZdUM2NBqo1EFOxgWD6/mTcf9X1RpqjkV+lgKN2jxZQEc13LcrjvZX\ngmChLfJmKQKBgQDZ4ocAsEf70xr0CvogbxYg89tB2aUdRSdGA4jhEjK6tE1xo052\noDlhFfyP+is9Q/7GjsX14zQYF5gYQMXTpSlK6rGfJSE3YsVK7fANPBDVdLfPeSp8\nMor1xWqeEg7y0lzlAmpjPaK+auuqqQiF9Cfrp1xyFCTG7TS5+wifEsudBQKBgArw\nlSQLh/Gi8UDQoKxUaGzF80/BOtueNCKAzOc9rgHeKwwRPz1XKEBam38dvOZk0GHA\nv8N/CbOBRl+BVNm6LJWfaFVO3mIpxi0ypxW/7ICF3n8sPAdJZfrNyhgBf4c6Vz2c\nEOe/kbeaETvmJV2uP73AaTbv9WKDZO5BhF6UE/ZxAoGABFJ07S7daemyyAoCVoM2\n1JMHpEezkv3dGm0u6yvhx3f+0ahMnHuqwyqS8NbsFzs4ogvDpOMnmYhelAYWQsZx\nJfkVR/3xJtXBgA+vTaQIt44ZKNkucER1NCmqbDlI0Tj0U/nUptnCo4E6p9AyecAg\nRu6CtbxBH4+pB2Vw7MD1bTo=\n-----END PRIVATE KEY-----\n';

// ── JWT para Google ───────────────────────────────────────
const crypto = require('crypto');
function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
async function getGoogleToken(){
  const now = Math.floor(Date.now()/1000);
  const header = b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim  = b64url(JSON.stringify({iss:GS_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now}));
  const sign   = crypto.createSign('RSA-SHA256');
  sign.update(header+'.'+claim);
  const sig    = b64url(sign.sign(GS_KEY_RAW.replace(/\\n/g,'\n')));
  const jwt    = header+'.'+claim+'.'+sig;
  return new Promise((res,rej)=>{
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req  = https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},(r)=>{
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d).access_token);}catch{rej(d);} });
    });
    req.on('error',rej); req.write(body); req.end();
  });
}

function sheetsRequest(method, subpath, token, body=null){
  return new Promise((res,rej)=>{
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname:'sheets.googleapis.com',
      path:`/v4/spreadsheets/${SHEET_ID}${subpath}`,
      method, headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}
    };
    if(bodyStr) opts.headers['Content-Length']=Buffer.byteLength(bodyStr);
    const req=https.request(opts,(r)=>{ let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({});} }); });
    req.on('error',rej); if(bodyStr) req.write(bodyStr); req.end();
  });
}

// ── Sincronizar todo al Sheet ─────────────────────────────
async function syncToSheets(db){
  try {
    const token = await getGoogleToken();
    const fmt = n => n ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';
    const now = new Date().toLocaleString('es-CO');

    // Hoja 1: Inventario
    const invRows = [
      ['CÓDIGO','NOMBRE','CATEGORÍA','VARIANTE','COSTO','PRECIO','STOCK','RESERVADO','DISPONIBLE','ESTADO','GANANCIA x UND'],
      ...db.products.map(p=>{
        const av = p.stock - p.reserved;
        const estado = av<=0?'AGOTADO':av<=3?'ÚLTIMAS UNIDADES':'DISPONIBLE';
        return [p.code||'',p.name,p.cat,p.variant||'',fmt(p.cost),fmt(p.price),p.stock,p.reserved,av,estado,fmt((p.price||0)-(p.cost||0))];
      })
    ];

    // Hoja 2: Pedidos
    const ordRows = [
      ['ID PEDIDO','FECHA','ESTADO','CLIENTE','CIUDAD','ENTREGA','PRODUCTOS','TOTAL','COSTO','GANANCIA'],
      ...db.orders.map(o=>{
        const prods = (o.items||[]).map(i=>`${i.name} ${i.variant||''} x${i.qty}`).join(' | ');
        const costo = (o.items||[]).reduce((s,i)=>{ const p=db.products.find(x=>x.id===i.id); return s+(p?p.cost*i.qty:0); },0);
        return [o.id, new Date(o.createdAt).toLocaleString('es-CO'), o.status.toUpperCase(), o.customer?.name||'', o.customer?.city||'', o.customer?.ship||'', prods, fmt(o.total), fmt(costo), fmt(o.total-costo)];
      })
    ];

    // Hoja 3: Dashboard resumen
    const paid = db.orders.filter(o=>o.status==='pagado');
    const totalRev = paid.reduce((s,o)=>s+o.total,0);
    const totalCost = paid.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>{ const p=db.products.find(x=>x.id===i.id); return ss+(p?p.cost*i.qty:0); },0),0);
    const dashRows = [
      ['RESUMEN ORO SANTO',''],
      ['Última actualización', now],
      ['',''],
      ['VENTAS',''],
      ['Total pedidos', db.orders.length],
      ['Pedidos pagados', paid.length],
      ['Pedidos pendientes', db.orders.filter(o=>o.status==='pendiente').length],
      ['Pedidos cancelados', db.orders.filter(o=>o.status==='cancelado').length],
      ['',''],
      ['DINERO',''],
      ['Ingresos totales', fmt(totalRev)],
      ['Costos totales', fmt(totalCost)],
      ['GANANCIA NETA', fmt(totalRev-totalCost)],
      ['',''],
      ['INVENTARIO',''],
      ['Total productos', db.products.length],
      ['Disponibles', db.products.filter(p=>p.stock-p.reserved>0).length],
      ['Agotados', db.products.filter(p=>p.stock-p.reserved<=0).length],
      ['Últimas unidades', db.products.filter(p=>{ const a=p.stock-p.reserved; return a>0&&a<=3; }).length],
    ];

    // Escribir las 3 hojas
    await sheetsRequest('PUT','/values/Inventario!A1?valueInputOption=RAW',token,{values:invRows});
    await sheetsRequest('PUT','/values/Pedidos!A1?valueInputOption=RAW',token,{values:ordRows});
    await sheetsRequest('PUT','/values/Dashboard!A1?valueInputOption=RAW',token,{values:dashRows});
    console.log('✓ Google Sheets sincronizado');
  } catch(e){ console.error('Sheets error:', e?.message||e); }
}

// Crear las hojas si no existen
async function initSheets(){
  try {
    const token = await getGoogleToken();
    const info  = await sheetsRequest('GET','',token);
    const exist = (info.sheets||[]).map(s=>s.properties.title);
    const needed = ['Inventario','Pedidos','Dashboard'];
    const toAdd  = needed.filter(n=>!exist.includes(n));
    if(toAdd.length){
      await sheetsRequest('POST',':batchUpdate',token,{requests:toAdd.map(title=>({addSheet:{properties:{title}}}))});
    }
    const db = readDB();
    await syncToSheets(db);
  } catch(e){ console.error('initSheets error:', e?.message||e); }
}

// ── DB ────────────────────────────────────────────────────
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
function readDB(){ try{return JSON.parse(fs.readFileSync(DB_PATH,'utf8'));}catch{return{config:{name:'ORO SANTO',wa:'',banner:''},categories:[],combos:[],comboPairs:{},products:[],orders:[]};} }
function writeDB(d){ fs.writeFileSync(DB_PATH,JSON.stringify(d,null,2),'utf8'); }
function jsonR(res,data,status=200){ res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'}); res.end(JSON.stringify(data)); }
function readBody(req){ return new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{r(JSON.parse(b));}catch{r({});}});}); }
function serveStatic(res,fp){ fs.readFile(fp,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(data); }); }
function avail(p){ const av=p.stock-p.reserved; if(av<=0)return{label:'Agotado',color:'red',available:0}; if(av<=3)return{label:`Últimas ${av} unidades`,color:'yellow',available:av}; return{label:'Disponible',color:'green',available:av}; }

const server = http.createServer(async (req,res)=>{
  const parsed=url.parse(req.url,true), pathname=parsed.pathname;
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});res.end();return;}

  if(pathname.startsWith('/api/')){
    // PUBLIC
    if(pathname==='/api/catalog'&&req.method==='GET'){const db=readDB();jsonR(res,{config:db.config,categories:db.categories,combos:db.combos,comboPairs:db.comboPairs,products:db.products.map(p=>({...p,avail:avail(p)}))});return;}

    // LOGIN — debe ir ANTES del auth check
    if(pathname==='/api/login'&&req.method==='POST'){
      const body=await readBody(req);
      if(body.pass===ADMIN_PASS) jsonR(res,{ok:true,token:Buffer.from(ADMIN_PASS).toString('base64')});
      else jsonR(res,{ok:false,msg:'Contraseña incorrecta'},401);
      return;
    }

    // ORDER (público)
    if(pathname==='/api/order'&&req.method==='POST'){
      const body=await readBody(req),db=readDB(),items=body.items||[];
      for(const item of items){const p=db.products.find(x=>x.id===item.id);if(!p){jsonR(res,{ok:false,msg:'No encontrado'},400);return;}const av=p.stock-p.reserved;if(av<item.qty){jsonR(res,{ok:false,msg:`Sin stock: ${p.name}`},400);return;}}
      const orderId='ORO-'+Date.now().toString().slice(-4);
      items.forEach(item=>{const p=db.products.find(x=>x.id===item.id);p.reserved+=item.qty;});
      const order={id:orderId,items:items.map(i=>{const p=db.products.find(x=>x.id===i.id);return{...i,name:p.name,variant:p.variant,price:p.price};}),customer:body.customer||{},total:body.total||0,status:'pendiente',createdAt:new Date().toISOString()};
      db.orders.unshift(order);writeDB(db);
      syncToSheets(db); // async, no espera
      jsonR(res,{ok:true,orderId,order});return;
    }

    // AUTH
    const token=(req.headers['authorization']||'').replace('Bearer ','');
    const isAuth=token===Buffer.from(ADMIN_PASS).toString('base64');
    if(!isAuth){jsonR(res,{ok:false,msg:'No autorizado'},401);return;}

    // PRODUCTS
    if(pathname==='/api/products'&&req.method==='GET'){const db=readDB();jsonR(res,db.products.map(p=>({...p,avail:avail(p)})));return;}
    if(pathname==='/api/products'&&req.method==='POST'){
      const body=await readBody(req),db=readDB();
      if(!body.name||!body.price||!body.cat||!body.code){jsonR(res,{ok:false,msg:'Faltan campos'},400);return;}
      const p={id:Date.now().toString(),code:body.code.trim().toUpperCase(),family:body.family||body.code.split('-').slice(0,2).join('-'),name:body.name.trim(),cat:body.cat,variant:body.variant||'Única',cost:parseFloat(body.cost)||0,price:parseFloat(body.price),stock:parseInt(body.stock)||0,reserved:0,img:body.img||null,badge:body.badge||null,createdAt:new Date().toISOString()};
      db.products.unshift(p);writeDB(db);syncToSheets(db);jsonR(res,{ok:true,product:p});return;
    }
    const pm=pathname.match(/^\/api\/products\/(.+)$/);
    if(pm&&req.method==='PUT'){
      const db=readDB(),body=await readBody(req),idx=db.products.findIndex(p=>p.id===pm[1]);
      if(idx<0){jsonR(res,{ok:false,msg:'No encontrado'},404);return;}
      const p=db.products[idx];
      db.products[idx]={...p,code:(body.code||p.code).trim().toUpperCase(),family:body.family||p.family,name:body.name||p.name,cat:body.cat||p.cat,variant:body.variant||p.variant,cost:body.cost!==undefined?parseFloat(body.cost):p.cost,price:body.price!==undefined?parseFloat(body.price):p.price,stock:body.stock!==undefined?parseInt(body.stock):p.stock,reserved:body.reserved!==undefined?parseInt(body.reserved):p.reserved,img:body.img!==undefined?body.img:p.img,badge:body.badge!==undefined?body.badge:p.badge};
      writeDB(db);syncToSheets(db);jsonR(res,{ok:true,product:db.products[idx]});return;
    }
    if(pm&&req.method==='DELETE'){const db=readDB();db.products=db.products.filter(p=>p.id!==pm[1]);writeDB(db);syncToSheets(db);jsonR(res,{ok:true});return;}

    // ORDERS
    if(pathname==='/api/orders'&&req.method==='GET'){const db=readDB();jsonR(res,db.orders);return;}
    const om=pathname.match(/^\/api\/orders\/(.+)\/status$/);
    if(om&&req.method==='PUT'){
      const body=await readBody(req),db=readDB(),o=db.orders.find(x=>x.id===om[1]);
      if(!o){jsonR(res,{ok:false,msg:'No encontrado'},404);return;}
      const prev=o.status;o.status=body.status;
      if(body.status==='pagado'&&prev!=='pagado'){o.items.forEach(item=>{const p=db.products.find(x=>x.id===item.id);if(p){p.stock-=item.qty;p.reserved-=item.qty;if(p.reserved<0)p.reserved=0;if(p.stock<0)p.stock=0;}});}
      if(body.status==='cancelado'&&prev==='pendiente'){o.items.forEach(item=>{const p=db.products.find(x=>x.id===item.id);if(p){p.reserved-=item.qty;if(p.reserved<0)p.reserved=0;}});}
      writeDB(db);syncToSheets(db);jsonR(res,{ok:true,order:o});return;
    }

    // CATEGORIES
    if(pathname==='/api/categories'&&req.method==='GET'){const db=readDB();jsonR(res,db.categories);return;}
    if(pathname==='/api/categories'&&req.method==='POST'){const body=await readBody(req),db=readDB();if(!body.name){jsonR(res,{ok:false,msg:'Nombre requerido'},400);return;}if(db.categories.includes(body.name)){jsonR(res,{ok:false,msg:'Ya existe'},409);return;}db.categories.push(body.name.trim());writeDB(db);jsonR(res,{ok:true,categories:db.categories});return;}
    const cm=pathname.match(/^\/api\/categories\/(.+)$/);
    if(cm&&req.method==='DELETE'){const db=readDB();db.categories=db.categories.filter(c=>c!==decodeURIComponent(cm[1]));writeDB(db);jsonR(res,{ok:true,categories:db.categories});return;}

    // COMBOS
    if(pathname==='/api/combos'&&req.method==='PUT'){const body=await readBody(req),db=readDB();if(body.comboPairs)db.comboPairs=body.comboPairs;if(body.combos)db.combos=body.combos;writeDB(db);jsonR(res,{ok:true});return;}

    // CONFIG
    if(pathname==='/api/config'&&req.method==='PUT'){const body=await readBody(req),db=readDB();db.config={...db.config,...body};writeDB(db);jsonR(res,{ok:true,config:db.config});return;}

    // DASHBOARD
    if(pathname==='/api/dashboard'&&req.method==='GET'){
      const db=readDB(),products=db.products,orders=db.orders;
      const today=new Date().toDateString();
      const paid=orders.filter(o=>o.status==='pagado');
      const totalRevenue=paid.reduce((s,o)=>s+o.total,0);
      const totalCost=paid.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>{const p=products.find(x=>x.id===i.id);return ss+(p?p.cost*i.qty:0);},0),0);
      const agotados=products.filter(p=>p.stock-p.reserved<=0);
      jsonR(res,{totalProducts:products.length,available:products.filter(p=>p.stock-p.reserved>0).length,agotados:agotados.length,ultimas:products.filter(p=>{const av=p.stock-p.reserved;return av>0&&av<=3;}).length,pendientes:orders.filter(o=>o.status==='pendiente').length,todayOrders:orders.filter(o=>new Date(o.createdAt).toDateString()===today).length,todayRevenue:orders.filter(o=>new Date(o.createdAt).toDateString()===today&&o.status==='pagado').reduce((s,o)=>s+o.total,0),totalRevenue,totalCost,ganancia:totalRevenue-totalCost,restock:agotados.map(p=>p.code+' '+p.name)});return;
    }

    // SYNC manual
    if(pathname==='/api/sync'&&req.method==='POST'){const db=readDB();await syncToSheets(db);jsonR(res,{ok:true});return;}

    jsonR(res,{ok:false,msg:'Ruta no encontrada'},404);return;
  }

  let fp=path.join(PUB_DIR,pathname==='/'?'index.html':pathname);
  if(!fp.startsWith(PUB_DIR)){res.writeHead(403);res.end();return;}
  if(!path.extname(fp)) fp+='.html';
  serveStatic(res,fp);
});

server.listen(PORT,()=>{
  console.log(`ORO SANTO corriendo en puerto ${PORT}`);
  initSheets();
});
