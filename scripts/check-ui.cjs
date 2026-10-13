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
  const nav=name=>page.getByRole('navigation',{name:'Mobilní navigace',exact:true}).getByRole('button',{name,exact:true}).click();
  const templates=async()=>{await page.getByRole('button',{name:'Otevřít navigaci'}).click();await page.getByRole('navigation',{name:'Hlavní navigace',exact:true}).getByRole('button',{name:'Šablony',exact:true}).click();};
  const dialog=()=>page.getByRole('dialog');
  const confirm=()=>page.getByRole('alertdialog');
  const saved=text=>page.getByRole('status').filter({hasText:text}).waitFor();
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const past=new Date(Date.now()-86400000*2).toISOString().slice(0,10);
  stage='login';await page.goto('http://127.0.0.1:5173/');await page.getByLabel('E-mail',{exact:true}).fill(process.env.STG_TEST_EMAIL);await page.getByLabel('Heslo',{exact:true}).fill(process.env.STG_TEST_PASSWORD);await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();await page.getByRole('heading',{name:'Nadcházející tréninky a závody',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Přihlásit se',exact:true}).count(),0);assert.equal(await page.getByText('Rychlý start',{exact:true}).count(),0);assert.equal(await page.getByText('Potvrzená docházka',{exact:true}).count(),0);await page.goto('http://127.0.0.1:5173/');await page.getByRole('heading',{name:'K dokončení'}).waitFor();console.log('PASS: kořenová stránka obnoví přihlášený klub bez duplicitních akcí a statistik');
  stage='member';await nav('Členové');await page.getByRole('button',{name:'Přidat člena',exact:true}).click();await page.getByLabel('Jméno',{exact:true}).fill(member);await page.locator('select[name=kind]').selectOption('guest');await page.getByRole('button',{name:'Uložit do klubu'}).click();await page.getByText(member,{exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'K dokončení'}).waitFor();await nav('Členové');await page.getByText(member,{exact:true}).waitFor();
  const memberRow=()=>page.locator('.member-row').filter({hasText:member});
  stage='archive';await memberRow().getByRole('button',{name:'Odebrat',exact:true}).click();await confirm().getByRole('button',{name:'Zpět',exact:true}).click();assert.equal(await memberRow().count(),1);await memberRow().getByRole('button',{name:'Odebrat',exact:true}).click();await confirm().getByRole('button',{name:'Odebrat člena',exact:true}).click();await saved('Člen přesunut do archivu.');assert.equal(await memberRow().count(),0);await page.getByRole('button',{name:'Archiv',exact:true}).click();await memberRow().getByRole('button',{name:'Obnovit',exact:true}).click();await saved('Člen byl obnoven');await page.getByRole('button',{name:'Aktivní',exact:true}).click();await memberRow().waitFor();console.log('PASS: odebrání vyžaduje potvrzení, archivace a návrat zachovají člena');
  stage='template';await templates();await page.getByRole('button',{name:'Přidat šablonu',exact:true}).click();await page.getByLabel('Název',{exact:true}).fill(template);await page.getByLabel('Místo',{exact:true}).fill('Fiktivní UI park');await page.getByLabel('Plán',{exact:true}).fill('Fiktivní rozcvičení a běh');await page.getByRole('button',{name:'Uložit do klubu'}).click();await page.getByText(template,{exact:true}).waitFor();await page.getByRole('button',{name:'Upravit šablonu '+template,exact:true}).click();await page.getByLabel('Plán',{exact:true}).fill('Fiktivní upravený plán');await page.getByRole('button',{name:'Uložit do klubu'}).click();await saved('Šablona byla uložena.');console.log('PASS: šablony v samostatné záložce, vytvoření a editace');
  stage='events';await nav('Přehled');await page.getByRole('button',{name:'Nový trénink',exact:true}).click();await page.locator('select[name=template]').selectOption(fixture.templates[0]);await page.getByLabel('Datum',{exact:true}).fill(tomorrow);await page.locator('select[name=repeat]').selectOption('4');await page.getByRole('button',{name:'Uložit do klubu'}).click();await saved('Události byly uloženy.');assert.equal(fixture.events.length,4);
  await nav('Kalendář');assert.equal(await page.locator('.calendar-day').count(),42);const calendarEntry=()=>page.locator('.calendar-event').filter({hasText:template}).first();await calendarEntry().click();await dialog().getByRole('button',{name:'Upravit',exact:true}).click();await page.getByLabel('Čas (Praha)',{exact:true}).fill('19:30');await page.getByRole('button',{name:'Uložit do klubu'}).click();await saved('Událost byla změněna.');await dialog().getByRole('button',{name:'Zavřít',exact:true}).click();assert((await calendarEntry().textContent()).includes('19:30'));console.log('PASS: skutečný měsíční kalendář a přesun času jednoho termínu');
  stage='cancel';await calendarEntry().click();await dialog().getByRole('button',{name:'Zrušit událost',exact:true}).click();await confirm().getByRole('button',{name:'Zrušit událost',exact:true}).click();await saved('Stav události změněn.');assert.equal(await dialog().getByText('Zrušeno',{exact:true}).count(),1);await dialog().getByRole('button',{name:'Obnovit událost',exact:true}).click();await confirm().getByRole('button',{name:'Obnovit událost',exact:true}).click();await saved('Stav události změněn.');
  stage='review';await dialog().getByRole('button',{name:'Upravit',exact:true}).click();await page.getByLabel('Datum',{exact:true}).fill(past);await page.getByRole('button',{name:'Uložit do klubu'}).click();await saved('Událost byla změněna.');await dialog().getByRole('button',{name:'Zavřít',exact:true}).click();await nav('Přehled');await page.locator('.review-list').getByText(template,{exact:true}).click();await page.getByLabel('Přihlášení '+member,{exact:true}).selectOption('yes');await saved('Účast uložena.');await page.getByLabel('Docházka '+member,{exact:true}).selectOption('yes');await saved('Účast uložena.');
  const attendance=page.locator('select[aria-label^="Docházka "]');for(let i=0;i<await attendance.count();i++)if(await attendance.nth(i).inputValue()===''){await attendance.nth(i).selectOption('no');await saved('Účast uložena.');}
  await page.getByLabel('Skutečný průběh a poznámky',{exact:true}).fill('Fiktivní skutečný průběh UI testu');await page.getByRole('button',{name:'Uložit průběh',exact:true}).click();await saved('Skutečný průběh uložen.');await page.getByRole('button',{name:'Dokončit událost',exact:true}).click();await saved('Událost je dokončená');await dialog().getByRole('button',{name:'Zavřít',exact:true}).click();assert.equal(await page.locator('.review-list').getByText(template,{exact:true}).count(),0);await page.reload();await page.getByRole('heading',{name:'K dokončení'}).waitFor();assert.equal(await page.locator('.review-list').getByText(template,{exact:true}).count(),0);console.log('PASS: zrušení a obnovení události, dokončení po docházce a průběhu přetrvá po reloadu');
  stage='delete-template';await templates();await page.getByRole('button',{name:'Smazat šablonu '+template,exact:true}).click();await confirm().getByRole('button',{name:'Smazat šablonu',exact:true}).click();await saved('Šablona smazána.');assert.equal(await page.getByText(template,{exact:true}).count(),0);
  await nav('Kalendář');await calendarEntry().click();assert.equal(await dialog().getByText('Fiktivní upravený plán',{exact:true}).count(),1);await dialog().getByRole('button',{name:'Smazat událost',exact:true}).click();await confirm().getByRole('button',{name:'Smazat událost',exact:true}).click();await saved('Událost smazána.');console.log('PASS: smazání používané šablony zachová plány a události, smazání jednoho termínu');
  stage='race';await page.getByRole('button',{name:'Nový trénink',exact:true}).click();await page.locator('select[name=template]').selectOption('');await page.locator('select[name=event_kind]').selectOption('race');await page.getByLabel('Název',{exact:true}).fill('Fiktivní UI závod '+mark);await page.getByLabel('Místo',{exact:true}).fill('Fiktivní stadion');await page.getByLabel('Datum',{exact:true}).fill(tomorrow);await page.getByRole('button',{name:'Uložit do klubu'}).click();await saved('Události byly uloženy.');assert.equal(await page.locator('.calendar-event.race').filter({hasText:'Fiktivní UI závod '+mark}).count(),1);console.log('PASS: závod bez šablony je umístěný v kalendáři');
  stage='layout';assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);console.log('PASS: šířka 390px bez přetečení a bez JS chyb');
  stage='logout';await page.getByLabel('Uživatelské menu',{exact:true}).click();await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();await page.getByRole('heading',{name:'Vítej zpátky.'}).waitFor();assert.equal(await page.locator('.cloud-dashboard').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('stg-fictional-demo-v1')),null);console.log('PASS: odhlášení je pod uživatelským menu a odstraní klubová data');
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
