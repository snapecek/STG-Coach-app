const CACHE='stg-shell-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/icon.svg','/brand/trenomi-logo-dark.svg','/brand/trenomi-symbol-dark.svg','/brand/brand-tokens.css','/brand/favicon.ico','/brand/trenomi-icon-180.png','/brand/trenomi-icon-192.png','/brand/trenomi-icon-512.png'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/')));});

self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  const title=typeof data.title==='string'?data.title.slice(0,200):'Trenomi';
  const body=typeof data.body==='string'?data.body.slice(0,700):'Nová odpověď na účast u události.';
  const url=notificationUrl(data.url);
  await self.registration.showNotification(title,{body,icon:'/brand/trenomi-icon-192.png',badge:'/brand/trenomi-symbol-dark.svg',tag:typeof data.tag==='string'?data.tag.slice(0,120):'trenomi-rsvp',renotify:false,data:{url}});
 })());
});
function notificationUrl(value){
 try{const u=new URL(typeof value==='string'?value:'/',self.location.origin),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(u.origin!==self.location.origin||u.pathname!=='/'||!uuid.test(u.searchParams.get('push-club')||'')||!uuid.test(u.searchParams.get('push-event')||''))return '/';return '/?push-club='+u.searchParams.get('push-club')+'&push-event='+u.searchParams.get('push-event')}catch{return '/'}
}
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=notificationUrl(event.notification.data?.url);
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.focus();client.postMessage({type:'trenomi-open-event',url})}else await self.clients.openWindow(url)})());
});
