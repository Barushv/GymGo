const CACHE='gymgo-shell-v0.2.4';
const SHELL=[
'', 'index.html',
'css/tokens.css','css/styles.css',
'js/app.js',
'js/core/dom.js','js/core/store.js','js/core/utils.js','js/core/db.js',
'js/ui/toast.js','js/ui/modal.js',
'js/ui/screens/today.js','js/ui/screens/week.js','js/ui/screens/progress.js','js/ui/screens/techniques.js',
'js/sw/register-sw.js',
'manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'
];

self.addEventListener('install',e=>{
e.waitUntil((async()=>{const c=await caches.open(CACHE); await c.addAll(SHELL); self.skipWaiting();})());
});
self.addEventListener('activate',e=>{
e.waitUntil((async()=>{
const keys=await caches.keys();
await Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):Promise.resolve()));
self.clients.claim();
})());
});

self.addEventListener('fetch',e=>{
const req=e.request;
const url=new URL(req.url);
if(req.method!=='GET') return;

// Network First para /data/*.json (para actualizar rutina/técnicas aunque exista cache)
if(url.pathname.startsWith('data/') && url.pathname.endsWith('.json')){
e.respondWith((async()=>{
const c=await caches.open(CACHE);
try{
const fresh=await fetch(req);
c.put(req,fresh.clone());
return fresh;
}catch{
const cached=await c.match(req);
return cached || new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});
}
})());
return;
}

// Cache First para el resto (app shell)
e.respondWith((async()=>{
const c=await caches.open(CACHE);
const cached=await c.match(req);
if(cached) return cached;
try{
const fresh=await fetch(req);
c.put(req,fresh.clone());
return fresh;
}catch{
if(req.headers.get('accept')?.includes('text/html')) return (await c.match('index.html')) || new Response('Offline',{status:503});
return new Response('Offline',{status:503});
}
})());
});
