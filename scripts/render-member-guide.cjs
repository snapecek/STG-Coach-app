// Run STG_APPLICATIONS_ONLY first: all screenshots contain fictional data.
const {chromium}=require('playwright');
const {copyFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const target=path.resolve('public/navod-clenove');mkdirSync(target,{recursive:true});
 for(const name of ['01-registrace.png','02-email.png','03-prihlaska.png','04-ceka.png','05-schvaleno.png','06-pozvanka-heslo.png'])copyFileSync(path.join(process.env.STG_GUIDE_SCREENSHOTS||'/tmp/trenomi-join-guide',name),path.join(target,name));
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 try{
  const p=await browser.newPage({viewport:{width:1200,height:1000}});await p.goto((process.env.STG_UI_URL||'http://127.0.0.1:5173')+'/navod-clenove.html');
  await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));assert.equal(await p.locator('.step').count(),4);await p.locator('.downloads').evaluate(e=>e.style.display='none');
  await p.screenshot({path:path.resolve('public/navod-clenove.png'),fullPage:true});await p.pdf({path:path.resolve('public/navod-clenove.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  for(const width of [320,390,760,1440]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  console.log('PASS member guide: fictional screenshots, four steps, PDF/PNG, responsive 320/390/760/1440');
 }finally{await browser.close()}
})().catch(error=>{console.error(error.message);process.exitCode=1});
