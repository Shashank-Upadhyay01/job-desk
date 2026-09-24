const CACHE="job-desk-v6";
const CORE=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png"];
const CFG_KEY="./__jobdesk_cfg";
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=="job-desk-cfg").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r}).catch(()=>caches.match(req).then(r=>r||caches.match("index.html"))));
  } else if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));return res})));
  }
});

/* ---------- background alerts (installed app) ---------- */
async function readCfg(){try{const r=await (await caches.open("job-desk-cfg")).match(CFG_KEY);return r?await r.json():{}}catch(e){return {}}}
async function writeCfg(cfg){const c=await caches.open("job-desk-cfg");await c.put(CFG_KEY,new Response(JSON.stringify(cfg),{headers:{"Content-Type":"application/json"}}))}
self.addEventListener("message",e=>{if(e.data&&e.data.type==="config")e.waitUntil(readCfg().then(c=>writeCfg({...c,topic:e.data.topic,since:c.since||Math.floor(Date.now()/1000)})))});
async function checkTopic(){
  const cfg=await readCfg(); if(!cfg.topic)return;
  const open=await self.clients.matchAll({type:"window"}); if(open.some(c=>c.visibilityState==="visible"))return; // the open app shows them itself
  const since=cfg.since||Math.floor(Date.now()/1000)-3600;
  let lines=[];
  try{lines=(await (await fetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}/json?poll=1&since=${since}`)).text()).split("\n").filter(Boolean)}catch(e){return}
  let latest=since;
  for(const l of lines){let m;try{m=JSON.parse(l)}catch(e){continue}
    if(!m||m.event!=="message")continue; latest=Math.max(latest,(m.time||0)+1);
    await self.registration.showNotification(m.title||"Job hunt",{body:m.message||"",tag:"ntfy-"+m.id,icon:"icon-192.png",badge:"icon-192.png",requireInteraction:(m.priority||3)>=5,data:{tab:"today"}});}
  await writeCfg({...cfg,since:latest});
}
self.addEventListener("periodicsync",e=>{if(e.tag==="jobdesk-check")e.waitUntil(checkTopic())});
self.addEventListener("notificationclick",e=>{e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>"focus" in x);return c?c.focus():self.clients.openWindow("./")}))});
