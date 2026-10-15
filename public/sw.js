const CACHE='stg-shell-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/icon.svg','/brand/trenomi-logo-dark.svg','/brand/trenomi-symbol-dark.svg','/brand/brand-tokens.css','/brand/favicon.ico','/brand/trenomi-icon-180.png','/brand/trenomi-icon-192.png','/brand/trenomi-icon-512.png']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/')));});
