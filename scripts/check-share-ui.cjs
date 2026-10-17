// Canvas exports and share controls with fictional data only. No Auth/API writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 await page.route('**/share-test.html',route=>route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/src/style.css"/></head><body style="margin:0"><div id="test" style="max-width:480px;margin:auto;padding:12px"></div></body></html>'}));
 await page.goto('http://127.0.0.1:5173/share-test.html');
 await page.evaluate(async()=>{const {default:runtime}=await import('/@react-refresh');runtime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true});
 const result=await page.evaluate(async()=>{
  const {renderShareGraphic,canvasPng,shareTitleLines}=await import('/src/journalShare.ts');
  const fixture=document.createElement('canvas');fixture.width=1600;fixture.height=900;const f=fixture.getContext('2d');for(let x=0;x<1600;x+=100){f.fillStyle=`hsl(${x/5},70%,45%)`;f.fillRect(x,0,100,900)}for(let y=0;y<900;y+=150){f.fillStyle='#ffffff60';f.fillRect(0,y,1600,60)}
  const input={team:'Fiktivní klub',title:'Sobotní trénink',date:'17. 10. 2026',place:'Fiktivní park',photo:fixture.toDataURL(),clubLogo:'/brand/trenomi-symbol-dark.svg',metrics:[{value:'60 min',label:'délka'},{value:'12',label:'přítomných'},{value:'RPE 7',label:'zátěž'}],best:[{name:'Výkon 1',value:'3:12 / 800 m'}]};
  window.shareFixture=input;
  const exports=[];for(const template of ['photo','stats','best'])for(const format of ['1:1','4:5','9:16']){const canvas=await renderShareGraphic({...input,template,format});const blob=await canvasPng(canvas);exports.push({template,format,width:canvas.width,height:canvas.height,size:blob.size,data:canvas.toDataURL()})}
  const base=await renderShareGraphic({...input,template:'photo',format:'4:5'}),moved=await renderShareGraphic({...input,template:'photo',format:'4:5',crop:{x:0,y:1,zoom:2}});
  const fallback=await renderShareGraphic({...input,photo:null,metrics:[],clubLogo:'/missing-logo.png',template:'photo',format:'1:1'});
  const long=await renderShareGraphic({...input,title:'Velmi dlouhý název tréninku s českými znaky žluťoučký kůň a dalším dlouhým textem pro ověření ořezu',team:'Dlouhý název klubu '.repeat(5),template:'stats',format:'1:1'});
  let failed=false;try{await renderShareGraphic({...input,photo:'data:image/png;base64,bad',template:'photo',format:'1:1'})}catch{failed=true}
  const lines=shareTitleLines({measureText:s=>({width:s.length*10})},'jedna dva tři čtyři pět šest sedm osm devět deset',100);
  return {exports,cropDiff:base.toDataURL()!==moved.toDataURL(),fallback:fallback.width,long:long.width,failed,lines};
 });
 for(const file of result.exports){assert.equal(file.width,1080);assert.equal(file.height,{'1:1':1080,'4:5':1350,'9:16':1920}[file.format]);assert(file.size>20000);fs.writeFileSync('/tmp/trenomi-share-'+file.template+'-'+file.format.replace(':','x')+'.png',Buffer.from(file.data.split(',')[1],'base64'))}
 assert(result.cropDiff);assert.equal(result.fallback,1080);assert.equal(result.long,1080);assert(result.failed);assert(result.lines.length<=3&&result.lines.at(-1).endsWith('…'));
 await page.evaluate(async()=>{const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {JournalSharePanel}=await import('/src/JournalSharePanel.tsx');createRoot(document.getElementById('test')).render(React.createElement(JournalSharePanel,{...window.shareFixture,eventName:window.shareFixture.title,defaultCaption:'Fiktivní trénink'}))});
 const download=page.getByRole('button',{name:'Stáhnout grafiku',exact:true});await download.waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Stáhnout grafiku').disabled);
 for(const template of ['Fotografický plakát','Přehled výkonu']){
  await page.getByRole('button',{name:template,exact:true}).click();
  if(template==='Fotografický plakát'){
   await page.waitForFunction(()=>document.querySelector('.journal-share-preview').getAttribute('aria-busy')==='false');
   const before=await page.locator('.journal-share-preview').evaluate(c=>c.toDataURL());
   for(const [label,value] of [['Přiblížení fotografie','2'],['Vodorovný posun fotografie','0'],['Svislý posun fotografie','1']])await page.getByLabel(label,{exact:true}).fill(value);
   await page.waitForFunction(()=>document.querySelector('.journal-share-preview').getAttribute('aria-busy')==='false');
   assert.notEqual(await page.locator('.journal-share-preview').evaluate(c=>c.toDataURL()),before);
   await page.getByRole('button',{name:'Obnovit výřez',exact:true}).click();assert.equal(await page.getByLabel('Přiblížení fotografie',{exact:true}).inputValue(),'1');
   await page.waitForFunction(()=>document.querySelector('.journal-share-preview').getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('.journal-share-preview').evaluate(c=>c.toDataURL()),before,'Reset must restore the original centered crop');
  }
  for(const [label,height] of [['Příspěvek 1:1',1080],['Příspěvek 4:5',1350],['Story 9:16',1920]]){
   await page.getByRole('button',{name:label,exact:true}).click();const waiting=page.waitForEvent('download');await download.click();const file=await waiting;const stream=await file.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const png=Buffer.concat(chunks);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),height);
   const visible=await page.locator('.journal-share-preview').evaluate(c=>c.toDataURL().split(',')[1]);assert.equal(png.toString('base64'),visible,'Downloaded PNG must match the current preview exactly');
  }
 }
 await page.getByRole('button',{name:'Nejlepší výkony',exact:true}).click();assert.equal(await page.getByLabel('Zahrnout jména členů do grafiky',{exact:true}).isChecked(),false);
 await page.getByRole('button',{name:'Fotografický plakát',exact:true}).click();await page.getByRole('button',{name:'Příspěvek 4:5',exact:true}).click();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/trenomi-share-panel-'+width+'.png',fullPage:true})}
 console.log('PASS share UI: both designs in all formats, nine exports, exact preview/download match, crop/zoom/reset, missing photo/logo, long Czech titles, private names and 320/390/1440 layouts');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
