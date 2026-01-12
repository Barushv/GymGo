const CACHE='gymgo-shell-v0.2.6';
const SHELL=[
  '',
  'index.html',
  'css/tokens.css',
  'css/styles.css',
  'js/app.js',
  'js/core/dom.js',
  'js/core/store.js',
  'js/core/utils.js',
  'js/core/db.js',
  'js/ui/toast.js',
  'js/ui/modal.js',
  'js/ui/screens/today.js',
  'js/ui/screens/week.js',
  'js/ui/screens/progress.js',
  'js/ui/screens/techniques.js',
  'js/sw/register-sw.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-1024.png',
  'splash/splash-1080x1920.png',
  'splash/splash-1290x2796.png',
  'splash/ios/splash-640x1136.png',
  'splash/ios/splash-750x1334.png',
  'splash/ios/splash-828x1792.png',
  'splash/ios/splash-1125x2436.png',
  'splash/ios/splash-1170x2532.png',
  'splash/ios/splash-1179x2556.png',
  'splash/ios/splash-1242x2208.png',
  'splash/ios/splash-1242x2688.png',
  'splash/ios/splash-1284x2778.png',
  'splash/ios/splash-1290x2796.png',
  'splash/ios/splash-1536x2048.png',
  'splash/ios/splash-1668x2224.png',
  'splash/ios/splash-1668x2388.png',
  'splash/ios/splash-2048x2732.png',
  'splash/ios/splash-1136x640.png',
  'splash/ios/splash-1334x750.png',
  'splash/ios/splash-1792x828.png',
  'splash/ios/splash-2436x1125.png',
  'splash/ios/splash-2532x1170.png',
  'splash/ios/splash-2556x1179.png',
  'splash/ios/splash-2208x1242.png',
  'splash/ios/splash-2688x1242.png',
  'splash/ios/splash-2778x1284.png',
  'splash/ios/splash-2796x1290.png',
  'splash/ios/splash-2048x1536.png',
  'splash/ios/splash-2224x1668.png',
  'splash/ios/splash-2388x1668.png',
  'splash/ios/splash-2732x2048.png'
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
