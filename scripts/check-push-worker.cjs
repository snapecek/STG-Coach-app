// Real Chromium service worker + Notifications API. Fictional local payload only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext();await context.grantPermissions(['notifications'],{origin:'http://127.0.0.1:5173'});
 const inspector=await context.newPage(),cdp=await context.newCDPSession(inspector);const registrations=[];cdp.on('ServiceWorker.workerRegistrationUpdated',event=>registrations.push(...event.registrations));await cdp.send('ServiceWorker.enable');
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});
 let registration;for(let i=0;i<100;i++){registration=registrations.find(r=>r.scopeURL==='http://127.0.0.1:5173/'&&!r.isDeleted);if(registration)break;await new Promise(r=>setTimeout(r,50))}assert(registration,'Service worker must actually install');
 await page.close();const payload={title:'Fiktivní klub · Trénink',body:'Fiktivní Jana · přijde. Přihlášeno: 5',tag:'fictional-push-1',url:'/?push-club=20000000-0000-4000-8000-000000000001&push-event=50000000-0000-4000-8000-000000000001'};
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:'http://127.0.0.1:5173',registrationId:registration.registrationId,data:JSON.stringify(payload)});
 const check=await context.newPage();await check.goto('http://127.0.0.1:5173');await check.waitForFunction(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).length>0});
 const notifications=await check.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).map(n=>({title:n.title,body:n.body,tag:n.tag,url:n.data.url,icon:n.icon}))});assert.equal(notifications.length,1);assert.equal(notifications[0].body,payload.body);assert.equal(notifications[0].url,payload.url);assert(notifications[0].icon.endsWith('/brand/trenomi-icon-192.png'));
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:'http://127.0.0.1:5173',registrationId:registration.registrationId,data:JSON.stringify(payload)});await check.waitForTimeout(100);assert.equal(await check.evaluate(async()=> (await(await navigator.serviceWorker.ready).getNotifications()).length),1,'Retry must replace the same notification tag');
 console.log('PASS real Chromium: app page closed before push, service worker displays member/answer/count and target, stable tag avoids duplicate notification');
}finally{await browser.close()}})().catch(e=>{console.error('FAIL real push worker:',e.message);process.exitCode=1});
