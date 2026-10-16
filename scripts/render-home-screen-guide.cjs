const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});
  await page.goto((process.env.STG_UI_URL||'http://127.0.0.1:5173')+'/navod-na-plochu.html');
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  assert.equal(await page.locator('.platform').count(),2);
  assert.equal(await page.locator('.platform li').count(),8);
  await page.locator('.downloads').evaluate(element=>element.style.display='none');
  await page.screenshot({path:path.resolve('public/navod-na-plochu.png'),fullPage:true});
  await page.pdf({path:path.resolve('public/navod-na-plochu.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  for(const width of [320,390,760,1440]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}px`);
  }
  console.log('PASS home screen guide: iPhone/Android, images, PDF/PNG, responsive 320/390/760/1440');
 }finally{await browser.close()}
})().catch(error=>{console.error(error.message);process.exitCode=1});
