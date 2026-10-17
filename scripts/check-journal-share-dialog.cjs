// Fictional local fixtures only; no backend or storage writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const page=await browser.newPage();
 await page.route('**/journal-dialog-test.html',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><div id="test"></div>'}));
 await page.goto('http://127.0.0.1:5173/journal-dialog-test.html');
 await page.evaluate(async()=>{const {default:r}=await import('/@react-refresh');r.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;
 const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js'),{TrainingJournalDetail}=await import('/src/TrainingJournalDetail.tsx');
 const h=React.createElement,club={id:'11111111-1111-4111-8111-111111111111',name:'Testovací klub',role:'owner'},events=[1,2].map(i=>({id:`22222222-2222-4222-8222-22222222222${i}`,club_id:club.id,name:'Trénink '+i,starts_at:'2026-10-16T08:00:00Z',duration_minutes:60,event_kind:'training',status:'scheduled',plan:'',actual_notes:'Hotovo',completed_at:null,place:'Park',equipment:[],type:'Síla'}));
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;canvas.getContext('2d').fillRect(0,0,400,300);const blob=await new Promise(r=>canvas.toBlob(r));
 window.files=[1,2,3].map(i=>({id:String(i),name:`33333333-3333-4333-8333-33333333333${i}.jpg`,metadata:{size:100}}));
 const query=new Proxy(()=>{}, {get:(_,p)=>p==='then'?(resolve=>Promise.resolve({data:[],error:null}).then(resolve)):()=>query});
 const client={from:()=>query,rpc:async()=>({data:[],error:null}),auth:{getUser:async()=>({data:{user:{id:'test'}},error:null})},storage:{from:()=>({list:async()=>({data:window.files,error:null}),download:async()=>({data:blob,error:null})})}};
 const root=createRoot(document.querySelector('#test'));
 window.mountJournal=(index=0)=>root.render(h(TrainingJournalDetail,{key:index,client,club,event:events[index],data:{events,members:[],participation:[],templates:[]},now:Date.now(),busy:false,onBack(){},onEdit(){},onAttendance(){},onGames(){},onNew(){},onDelete(){},onComplete(){},onChanged:async()=>{},onBusyChange(){}}));
 window.leaveJournal=()=>root.render(h('p',null,'Jiná záložka'));window.mountJournal();
 });
 const selected=n=>page.getByRole('button',{name:'Vybrat fotografii '+n,exact:true});
 await selected(3).click();assert.equal(await selected(3).getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>window.leaveJournal());await page.getByText('Jiná záložka',{exact:true}).waitFor();await page.evaluate(()=>window.mountJournal());await selected(3).waitFor();assert.equal(await selected(3).getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>window.mountJournal(1));await page.getByRole('heading',{name:'Trénink 2',exact:true}).waitFor();await selected(1).waitFor();assert.equal(await selected(1).getAttribute('aria-pressed'),'true');await selected(2).click();
 await page.evaluate(()=>window.mountJournal());await page.getByRole('heading',{name:'Trénink 1',exact:true}).waitFor();await selected(3).waitFor();assert.equal(await selected(3).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.journal-share-panel').count(),0);
 for(const width of [320,390,1440]){
 await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Sdílet trénink',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Sdílet trénink',exact:true});await dialog.waitFor();await dialog.locator('.journal-share-preview[aria-busy="false"]').waitFor();
 assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(0,12)}))));
 await page.screenshot({path:'/tmp/trenomi-share-dialog-'+width+'.png'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Sdílet trénink',exact:true}).evaluate(e=>e===document.activeElement),true);
 }
 await page.getByRole('button',{name:'Sdílet trénink',exact:true}).click();await page.getByRole('button',{name:'Zavřít sdílení tréninku',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Sdílet trénink',exact:true}).count(),0);
 // Deleted remembered photo falls back to a valid remaining image.
 await page.evaluate(()=>{window.files=window.files.slice(0,2);window.leaveJournal()});await page.getByText('Jiná záložka',{exact:true}).waitFor();await page.evaluate(()=>window.mountJournal());await selected(1).waitFor();assert.equal(await selected(1).getAttribute('aria-pressed'),'true');
 console.log('PASS journal sharing: independent photo memory per event after navigation; deleted-photo fallback; separate dialog at 320/390/1440; Escape, close, focus return, no overflow');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
