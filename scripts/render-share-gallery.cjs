// Actual Canvas exports arranged for visual review. Supply a local illustrative photo.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const photo=process.argv[2];if(!photo)throw new Error('Usage: node scripts/render-share-gallery.cjs /path/to/photo.jpg [output.png]');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
 try{const page=await browser.newPage({viewport:{width:1960,height:1000},deviceScaleFactor:1});await page.route('**/share-gallery.html',r=>r.fulfill({contentType:'text/html',body:'<html><head></head><body></body></html>'}));await page.goto('http://127.0.0.1:5173/share-gallery.html');
 await page.evaluate(async ({photo:data,only})=>{
  const {renderShareGraphic,shareTemplates}=await import('/src/journalShare.ts');
  document.head.innerHTML='<style>*{box-sizing:border-box}body{margin:0;padding:48px;background:#20252c;color:#fafafa;font-family:"Trenomi Text",sans-serif}h1{font-size:40px;margin:0 0 8px}p{margin:0 0 32px;color:#b0b9c4;font-size:18px}.gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}.card{min-width:0}.card>canvas{width:100%;height:auto;display:block;box-shadow:0 14px 30px #0005}.label{font-size:17px;font-weight:700;padding:14px 0 0;color:#ffb317}.note{margin-top:30px;font-size:14px;color:#a9afb8}</style>';
  if(only){document.head.querySelector('style').textContent+= '.gallery{grid-template-columns:repeat(3,1fr)}'}
  document.body.innerHTML='<h1>TRENOMI / 12 AUTORSKÝCH KOMPOZIC</h1><p>Skutečné exporty aplikace · stejná ilustrační fotografie a ukázková data · formát 4:5</p><div class="gallery"></div>';
  if(only)document.querySelector('h1').textContent='TRENOMI / NOVÉ ŠABLONY 07 · 10 · 11';
  for(const [i,t] of shareTemplates.entries()){if(only&&![6,9,10].includes(i))continue;
   const canvas=await renderShareGraphic({template:t.id,format:'4:5',showClubIdentity:false,title:t.id==='split'?'Intervaly 6 × 800 m':t.id==='neon'?'Noční intervaly':'Sobotní trénink',team:'Tvůj klub',date:'17. 10. 2026',place:'Karviná',photo:data,photoFit:'cover',crop:{x:.57,y:.5,zoom:1},metrics:[{value:'75 min',label:'délka'},{value:'14 / 20',label:'přítomných'},{value:'11,2 km',label:'vzdálenost'},{value:'RPE 8',label:'zátěž'},{value:'3:12',label:'nejrychlejší 800 m'}],best:[{name:'Výkon 1',value:'3:12 / 800 m'},{name:'Výkon 2',value:'3:19 / 800 m'},{name:'Výkon 3',value:'3:24 / 800 m'}]});
   const card=document.createElement('article');card.className='card';card.append(canvas);const label=document.createElement('div');label.className='label';label.textContent=String(i+1).padStart(2,'0')+' / '+t.name;card.append(label);document.querySelector('.gallery').append(card);
  }
  const note=document.createElement('div');note.className='note';note.textContent='Ilustrační fotografie: Unsplash, photo-1518611012118-696072aa579a. Nejde o členy klubu. Do exportů se používají fotografie a údaje vašeho tréninku.';document.body.append(note);
 },{photo:'data:image/jpeg;base64,'+fs.readFileSync(photo).toString('base64'),only:process.argv.includes('--signatures')});
 await page.screenshot({path:process.argv[3]||'/tmp/trenomi-signature-12.png',fullPage:true});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
