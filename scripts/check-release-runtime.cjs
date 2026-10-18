// Production build only: update discovery, themes and explicit reload. No login
// or external API requests. The development UI runner must build dist first.
const {spawn}=require('node:child_process'),{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:['ignore','ignore','inherit']});let browser;
 try{
  let ready=false;for(let n=0;n<100;n++){if(preview.exitCode!=null)throw new Error('Preview failed');try{if((await fetch('http://127.0.0.1:5174')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}assert(ready);
  const release=JSON.parse(fs.readFileSync('dist/release.json','utf8')).release;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for(const width of [320,1440]){
   const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});let latest=release,navigations=0;
   await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:5174')return route.abort();if(url.pathname==='/release.json')return route.fulfill({contentType:'application/json',body:JSON.stringify({release:latest})});if(route.request().isNavigationRequest())navigations++;return route.continue()});
   const p=await c.newPage();p.setDefaultTimeout(10000);await p.clock.install();await p.goto('http://127.0.0.1:5174');await p.waitForFunction(()=>document.getElementById('root')?.childElementCount>0);await Promise.all([p.waitForResponse(r=>r.url().endsWith('/release.json')).then(r=>r.finished()),p.clock.fastForward(60000)]);assert.equal(await p.locator('.release-notice').count(),0);
   latest='new-release';await p.clock.fastForward(60000);const notice=p.locator('.release-notice');await notice.waitFor();
   for(const theme of ['dark','light']){await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const colors=await notice.evaluate(el=>({surface:getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,button:getComputedStyle(el.querySelector('button')).color}));assert.equal(colors.color,colors.button);assert.equal(colors.background,theme==='light'?'rgb(255, 255, 255)':'rgb(24, 28, 34)');}
   const before=navigations;await notice.getByRole('button',{name:'Načíst novou verzi',exact:true}).click();await p.waitForLoadState();for(let n=0;n<50&&navigations===before;n++)await new Promise(resolve=>setTimeout(resolve,20));assert(navigations>before,'Update must wait for an explicit click');await c.close();
  }
  console.log('PASS production release notice: unchanged/new version, no automatic reload, dark/light contrast and 320/1440 layout');
 }finally{await browser?.close();preview.kill('SIGTERM')}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
