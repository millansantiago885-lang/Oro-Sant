const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT      = process.env.PORT || 3000;
const DB_PATH   = path.join(__dirname, 'data', 'db.json');
const PUB_DIR   = path.join(__dirname, 'public');
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin1234';

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript',
  '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { config:{name:'ORO SANTO',wa:'',banner:''}, categories:[], combos:[], comboPairs:{}, products:[], orders:[] }; }
}
function writeDB(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2), 'utf8'); }

function json(res, data, status=200) {
  res.writeHead(status, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,Authorization'
  });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise(r => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{r(JSON.parse(b));}catch{r({});} }); });
}
function serveStatic(res, fp) {
  fs.readFile(fp, (err, data) => {
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream'});
    res.end(data);
  });
}

// Availability label
function avail(p) {
  const av = p.stock - p.reserved;
  if(av <= 0) return { label:'Agotado', color:'red', available:0 };
  if(av <= 3) return { label:`Últimas ${av} unidades`, color:'yellow', available:av };
  return { label:'Disponible', color:'green', available:av };
}

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if(req.method==='OPTIONS'){ res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'}); res.end(); return; }

  if(pathname.startsWith('/api/')) {
    // ── PUBLIC ──
    if(pathname==='/api/catalog' && req.method==='GET') {
      const db = readDB();
      const products = db.products.map(p => ({ ...p, avail: avail(p) }));
      json(res, { config:db.config, categories:db.categories, combos:db.combos, comboPairs:db.comboPairs, products });
      return;
    }

    // POST /api/order — cliente genera pedido (reserva temporal)
    if(pathname==='/api/order' && req.method==='POST') {
      const body = await readBody(req);
      const db   = readDB();
      const items = body.items || [];
      // Validar stock
      for(const item of items) {
        const p = db.products.find(x=>x.id===item.id);
        if(!p){ json(res,{ok:false,msg:`Producto no encontrado: ${item.id}`},400); return; }
        const av = p.stock - p.reserved;
        if(av < item.qty){ json(res,{ok:false,msg:`Sin stock: ${p.name} ${p.variant}`},400); return; }
      }
      // Reservar
      const orderId = 'ORO-'+Date.now().toString().slice(-4);
      items.forEach(item => {
        const p = db.products.find(x=>x.id===item.id);
        p.reserved += item.qty;
      });
      const order = {
        id: orderId,
        items: items.map(i => { const p=db.products.find(x=>x.id===i.id); return {...i, name:p.name, variant:p.variant, price:p.price}; }),
        customer: body.customer || {},
        total: body.total || 0,
        status: 'pendiente',
        createdAt: new Date().toISOString()
      };
      db.orders.unshift(order);
      writeDB(db);
      json(res, { ok:true, orderId, order });
      return;
    }

    // AUTH check
    const token  = (req.headers['authorization']||'').replace('Bearer ','');
    const isAuth = token === Buffer.from(ADMIN_PASS).toString('base64');
    if(!isAuth){ json(res,{ok:false,msg:'No autorizado'},401); return; }

    // ── LOGIN ──
    if(pathname==='/api/login' && req.method==='POST') {
      const body = await readBody(req);
      if(body.pass===ADMIN_PASS) json(res,{ok:true,token:Buffer.from(ADMIN_PASS).toString('base64')});
      else json(res,{ok:false,msg:'Contraseña incorrecta'},401);
      return;
    }

    // ── PRODUCTS CRUD ──
    if(pathname==='/api/products' && req.method==='GET') {
      const db=readDB(); json(res, db.products.map(p=>({...p,avail:avail(p)}))); return;
    }
    if(pathname==='/api/products' && req.method==='POST') {
      const body=await readBody(req); const db=readDB();
      if(!body.name||!body.price||!body.cat||!body.code){ json(res,{ok:false,msg:'Faltan campos'},400); return; }
      const p={
        id:Date.now().toString(), code:body.code.trim().toUpperCase(),
        family:body.family||body.code.split('-').slice(0,2).join('-'),
        name:body.name.trim(), cat:body.cat, variant:body.variant||'Única',
        cost:parseFloat(body.cost)||0, price:parseFloat(body.price),
        stock:parseInt(body.stock)||0, reserved:0,
        img:body.img||null, badge:body.badge||null,
        createdAt:new Date().toISOString()
      };
      db.products.unshift(p); writeDB(db); json(res,{ok:true,product:p}); return;
    }
    const pmatch = pathname.match(/^\/api\/products\/(.+)$/);
    if(pmatch && req.method==='PUT') {
      const db=readDB(); const body=await readBody(req);
      const idx=db.products.findIndex(p=>p.id===pmatch[1]);
      if(idx<0){ json(res,{ok:false,msg:'No encontrado'},404); return; }
      const p=db.products[idx];
      db.products[idx]={...p,
        code:(body.code||p.code).trim().toUpperCase(),
        family:body.family||p.family,
        name:body.name||p.name, cat:body.cat||p.cat, variant:body.variant||p.variant,
        cost:body.cost!==undefined?parseFloat(body.cost):p.cost,
        price:body.price!==undefined?parseFloat(body.price):p.price,
        stock:body.stock!==undefined?parseInt(body.stock):p.stock,
        reserved:body.reserved!==undefined?parseInt(body.reserved):p.reserved,
        img:body.img!==undefined?body.img:p.img,
        badge:body.badge!==undefined?body.badge:p.badge
      };
      writeDB(db); json(res,{ok:true,product:db.products[idx]}); return;
    }
    if(pmatch && req.method==='DELETE') {
      const db=readDB(); db.products=db.products.filter(p=>p.id!==pmatch[1]); writeDB(db); json(res,{ok:true}); return;
    }

    // ── ORDERS ──
    if(pathname==='/api/orders' && req.method==='GET') {
      const db=readDB(); json(res,db.orders); return;
    }
    const omatch = pathname.match(/^\/api\/orders\/(.+)\/status$/);
    if(omatch && req.method==='PUT') {
      const body=await readBody(req); const db=readDB();
      const o=db.orders.find(x=>x.id===omatch[1]);
      if(!o){ json(res,{ok:false,msg:'No encontrado'},404); return; }
      const prev=o.status; o.status=body.status;
      // Si se confirma pago: descontar stock definitivamente
      if(body.status==='pagado' && prev!=='pagado') {
        o.items.forEach(item=>{ const p=db.products.find(x=>x.id===item.id); if(p){ p.stock-=item.qty; p.reserved-=item.qty; if(p.reserved<0)p.reserved=0; if(p.stock<0)p.stock=0; } });
      }
      // Si se cancela: liberar reserva
      if(body.status==='cancelado' && prev==='pendiente') {
        o.items.forEach(item=>{ const p=db.products.find(x=>x.id===item.id); if(p){ p.reserved-=item.qty; if(p.reserved<0)p.reserved=0; } });
      }
      writeDB(db); json(res,{ok:true,order:o}); return;
    }

    // ── CATEGORIES ──
    if(pathname==='/api/categories' && req.method==='GET') { const db=readDB(); json(res,db.categories); return; }
    if(pathname==='/api/categories' && req.method==='POST') {
      const body=await readBody(req); const db=readDB();
      if(!body.name){ json(res,{ok:false,msg:'Nombre requerido'},400); return; }
      if(db.categories.includes(body.name)){ json(res,{ok:false,msg:'Ya existe'},409); return; }
      db.categories.push(body.name.trim()); writeDB(db); json(res,{ok:true,categories:db.categories}); return;
    }
    const cmatch=pathname.match(/^\/api\/categories\/(.+)$/);
    if(cmatch && req.method==='DELETE') {
      const db=readDB(); db.categories=db.categories.filter(c=>c!==decodeURIComponent(cmatch[1])); writeDB(db); json(res,{ok:true,categories:db.categories}); return;
    }

    // ── COMBOS ──
    if(pathname==='/api/combos' && req.method==='PUT') {
      const body=await readBody(req); const db=readDB();
      if(body.comboPairs) db.comboPairs=body.comboPairs;
      if(body.combos) db.combos=body.combos;
      writeDB(db); json(res,{ok:true}); return;
    }

    // ── CONFIG ──
    if(pathname==='/api/config' && req.method==='PUT') {
      const body=await readBody(req); const db=readDB();
      db.config={...db.config,...body}; writeDB(db); json(res,{ok:true,config:db.config}); return;
    }

    // ── DASHBOARD ──
    if(pathname==='/api/dashboard' && req.method==='GET') {
      const db=readDB();
      const products=db.products;
      const orders=db.orders;
      const today=new Date().toDateString();
      const todayOrders=orders.filter(o=>new Date(o.createdAt).toDateString()===today);
      const paid=orders.filter(o=>o.status==='pagado');
      const totalRevenue=paid.reduce((s,o)=>s+o.total,0);
      const totalCost=paid.reduce((s,o)=>s+o.items.reduce((ss,i)=>{ const p=products.find(x=>x.id===i.id); return ss+(p?p.cost*i.qty:0); },0),0);
      const agotados=products.filter(p=>p.stock-p.reserved<=0);
      const ultimas=products.filter(p=>{ const av=p.stock-p.reserved; return av>0&&av<=3; });
      // Combo más vendido
      const comboCounts={};
      paid.forEach(o=>{ if(o.items.length>1){ const key=o.items.map(i=>i.name).sort().join(' + '); comboCounts[key]=(comboCounts[key]||0)+1; } });
      const topCombo=Object.entries(comboCounts).sort((a,b)=>b[1]-a[1])[0];
      json(res,{
        totalProducts:products.length,
        available:products.filter(p=>p.stock-p.reserved>0).length,
        agotados:agotados.length,
        ultimas:ultimas.length,
        pendientes:orders.filter(o=>o.status==='pendiente').length,
        todayOrders:todayOrders.length,
        todayRevenue:todayOrders.filter(o=>o.status==='pagado').reduce((s,o)=>s+o.total,0),
        totalRevenue, totalCost,
        ganancia:totalRevenue-totalCost,
        topCombo:topCombo?topCombo[0]:null,
        restock:agotados.map(p=>p.code+' '+p.name)
      });
      return;
    }

    json(res,{ok:false,msg:'Ruta no encontrada'},404); return;
  }

  // Static files
  let fp = path.join(PUB_DIR, pathname==='/'?'index.html':pathname);
  if(!fp.startsWith(PUB_DIR)){ res.writeHead(403); res.end(); return; }
  if(!path.extname(fp)) fp+='.html';
  serveStatic(res, fp);
});

server.listen(PORT, () => console.log(`ORO SANTO corriendo en puerto ${PORT}`));
