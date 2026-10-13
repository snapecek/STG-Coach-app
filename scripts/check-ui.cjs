const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
(async()=>{
 let stage='start',page,browser,context,fixture={members:[],templates:[],events:[]},failed=false;
 let relay;
 const mark=Date.now();const member='Fiktivní UI host '+mark;const template='Fiktivní UI šablona '+mark;
 try{
  relay=spawn('python3',[path.join(__dirname,'cloud-relay.py')],{stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8770/__health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
  assert(ready,'relay did not start');
  browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route(process.env.VITE_SUPABASE_URL+'/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='POST'&&url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').pop();if(fixture[table]){let payload=req.postDataJSON();for(const row of Array.isArray(payload)?payload:[payload])if(row?.id)fixture[table].push(row.id);}
   }
   const response=await context.request.fetch('http://127.0.0.1:8770'+url.pathname+url.search,{method:req.method(),headers:req.headers(),data:req.postData()||undefined});
   await route.fulfill({response});
  });
  page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
  stage='login';await page.goto('http://127.0.0.1:5173/?workspace=cloud');await page.getByLabel('E-mail',{exact:true}).fill(process.env.STG_TEST_EMAIL);await page.getByLabel('Heslo',{exact:true}).fill(process.env.STG_TEST_PASSWORD);await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();await page.getByRole('heading',{name:'Nadcházející tréninky',exact:true}).waitFor();console.log('PASS: přihlášení a prázdný cloudový přehled na mobilu');
  stage='member';await page.getByRole('button',{name:'Členové',exact:true}).click();await page.getByRole('button',{name:'Přidat člena',exact:true}).click();await page.getByLabel('Jméno',{exact:true}).fill(member);await page.locator('select[name=kind]').selectOption('guest');await page.getByRole('button',{name:'Uložit do klubu'}).click();await page.getByText(member,{exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Nadcházející tréninky'}).waitFor();await page.getByRole('button',{name:'Členové',exact:true}).click();await page.getByText(member,{exact:true}).waitFor();console.log('PASS: host zůstává uložený po obnovení stránky');
  stage='template';await page.getByRole('button',{name:'Přehled',exact:true}).click();await page.getByRole('button',{name:'Přidat šablonu',exact:true}).click();await page.getByLabel('Název',{exact:true}).fill(template);await page.getByLabel('Místo',{exact:true}).fill('Fiktivní UI park');await page.getByLabel('Plán',{exact:true}).fill('Fiktivní rozcvičení a běh');await page.getByRole('button',{name:'Uložit do klubu'}).click();await page.getByText(template,{exact:true}).waitFor();console.log('PASS: vytvoření šablony');
  stage='events';await page.getByText(template,{exact:true}).click();await page.getByLabel('Datum',{exact:true}).fill('2026-11-18');await page.locator('select[name=repeat]').selectOption('4');await page.getByRole('button',{name:'Uložit do klubu'}).click();await page.getByRole('status').filter({hasText:'Tréninky byly uloženy.'}).waitFor();assert.equal(fixture.events.length,4);console.log('PASS: rychlý start ze šablony a čtyři opakované tréninky');
  stage='attendance';await page.getByRole('button',{name:'Kalendář',exact:true}).click();await page.locator('.event-card').filter({hasText:template}).first().click();await page.getByLabel('Přihlášení '+member,{exact:true}).selectOption('yes');await page.getByRole('status').filter({hasText:'Účast uložena'}).waitFor();await page.getByLabel('Přítomen '+member,{exact:true}).click();await page.getByRole('status').filter({hasText:'Účast uložena'}).waitFor();await page.getByLabel('Přihlášení '+member,{exact:true}).selectOption('maybe');await page.getByRole('status').filter({hasText:'Účast uložena'}).waitFor();assert(await page.getByLabel('Přítomen '+member,{exact:true}).isChecked());await page.getByRole('button',{name:'Zavřít',exact:true}).click();
  await page.reload();await page.getByRole('heading',{name:'Nadcházející tréninky'}).waitFor();await page.getByRole('button',{name:'Kalendář',exact:true}).click();await page.locator('.event-card').filter({hasText:template}).first().click();assert.equal(await page.getByLabel('Přihlášení '+member,{exact:true}).inputValue(),'maybe');assert(await page.getByLabel('Přítomen '+member,{exact:true}).isChecked());await page.getByRole('button',{name:'Zavřít',exact:true}).click();console.log('PASS: docházka a RSVP jsou oddělené a přežijí reload');
  stage='layout';assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);console.log('PASS: šířka 390px bez přetečení a bez JS chyb');
  stage='logout';await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();await page.getByRole('heading',{name:'Vítej zpátky.'}).waitFor();assert.equal(await page.locator('.cloud-dashboard').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('stg-fictional-demo-v1')),null);console.log('PASS: odhlášení odstraní klubový prostor, cloud nepoužívá demo localStorage');
 }catch(error){failed=true;console.log('FAIL: browser stage '+stage+' ('+error.name+')');if(stage!=='login'&&stage!=='start')console.log('Prohlížečová kontrola se nedokončila; přihlašovací údaje nebyly vypsány.');}
 finally{
  if(context){
   try{
    const r=await context.request.post('http://127.0.0.1:8770/auth/v1/token?grant_type=password',{headers:{apikey:process.env.VITE_SUPABASE_ANON_KEY},data:{email:process.env.STG_TEST_EMAIL,password:process.env.STG_TEST_PASSWORD}});const login=await r.json();const headers={apikey:process.env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+login.access_token};
    for(const table of ['events','templates','members'])if(fixture[table].length){const ids=[...new Set(fixture[table])].join(',');const r=await context.request.delete('http://127.0.0.1:8770/rest/v1/'+table+'?id=in.('+ids+')',{headers});assert(r.ok());const check=await context.request.get('http://127.0.0.1:8770/rest/v1/'+table+'?select=id&id=in.('+ids+')',{headers});assert.deepEqual(await check.json(),[]);console.log('PASS: cleanup UI fixtures '+table);}
    await context.request.post('http://127.0.0.1:8770/auth/v1/logout?scope=local',{headers});
   }catch(e){failed=true;console.log('FAIL: UI fixture cleanup ('+e.name+')');}
  }
  if(browser)await browser.close();
  if(relay)relay.kill();
 }
 process.exitCode=failed?1:0;
})();
