import {drawShareStickers,type ShareSticker} from './shareStickers';
import {photoPlacement} from './sharePhotoTransform';
import {photoShareLayout,usesSharePhoto,sharePhotoPath,type GraphicBox} from './journalShareLayouts';
export {usesSharePhoto} from './journalShareLayouts';
export const shareFormats={'1:1':{width:1080,height:1080,label:'Příspěvek 1:1'},'4:5':{width:1080,height:1350,label:'Příspěvek 4:5'},'9:16':{width:1080,height:1920,label:'Story 9:16'}};
export type ShareFormat=keyof typeof shareFormats;
export type ShareTemplate='stats'|'photo'|'best'|'editorial'|'sport'|'frame'|'cinema'|'split'|'clean'|'neon'|'track'|'ticket'|'distance'|'column'|'headline';
export const shareTemplates=[{id:'photo',name:'Fotografický plakát'},{id:'stats',name:'Přehled výkonu'},{id:'editorial',name:'Klubový deník'},{id:'sport',name:'Sportovní poster'},{id:'frame',name:'Galerijní rám'},{id:'cinema',name:'Filmový pás'},{id:'split',name:'Boční panel'},{id:'clean',name:'Černobílý dokument'},{id:'best',name:'Nejlepší výkony'},{id:'neon',name:'Noční trénink'},{id:'track',name:'Atletická dráha'},{id:'ticket',name:'Klubová vstupenka'}] as const;
export const editorTemplates=[{id:'distance',name:'Kilometry'},{id:'column',name:'Sloupec dat'},{id:'headline',name:'Jen titulek'}] as const;
export type ShareGraphic={showClubIdentity?:boolean;accent?:string;stickers?:ShareSticker[];team:string;title:string;photo:string|null;photoFit?:'contain'|'cover';clubLogo?:string;date?:string;place?:string;crop?:{x:number;y:number;zoom:number};format:ShareFormat;template:ShareTemplate;metrics:{value:string;label:string}[];best:{name:string;value:string}[]};
const orange='#FFB317',background='#101216',white='#F5F6F7',muted='#A9AFB8';
let fonts:Promise<void>|undefined;
function loadFonts(){return fonts??=Promise.all([
 new FontFace('Trenomi Display','url(/fonts/BarlowCondensed-ExtraBold.ttf)',{weight:'800'}),
 new FontFace('Trenomi Text','url(/fonts/Manrope.ttf)',{weight:'200 800'}),
 new FontFace('Trenomi Serif','url(/fonts/CormorantGaramond-Italic.ttf)',{weight:'300 700',style:'italic'})
].map(async face=>{document.fonts.add(await face.load())})).then(()=>{}).catch(error=>{fonts=undefined;throw error})}
const images=new Map<string,Promise<HTMLImageElement>>();
function image(url:string){let pending=images.get(url);if(!pending){pending=(async()=>{const value=new Image();value.crossOrigin='anonymous';value.src=url;await value.decode();return value})();images.set(url,pending);pending.catch(()=>images.delete(url));if(images.size>24)images.delete(images.keys().next().value!)}return pending}
/** All fitting happens at export resolution, never by shrinking the preview canvas. */
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,max:number,size:number,color=white,display=false){ctx.fillStyle=color;ctx.font=`${display?800:700} ${size}px "Trenomi ${display?'Display':'Text'}", sans-serif`;while(ctx.measureText(value).width>max&&size>14){size-=1;ctx.font=`${display?800:700} ${size}px "Trenomi ${display?'Display':'Text'}", sans-serif`}ctx.fillText(value,x,y,max)}
export function shareTitleLines(ctx:Pick<CanvasRenderingContext2D,'measureText'>,value:string,max:number,limit=3){
 const words=value.trim().split(/\s+/),lines:string[]=[];let row='';
 for(const word of words){const next=row?row+' '+word:word;if(row&&ctx.measureText(next).width>max){lines.push(row);row=word}else row=next}if(row)lines.push(row);
 if(lines.length>limit){const last=lines.slice(limit-1).join(' ');lines.splice(limit-1,lines.length,last);let final=lines[limit-1];while(ctx.measureText(final+'…').width>max&&final.length)final=final.slice(0,-1);lines[limit-1]=final.trimEnd()+'…'}
 return lines;
}
function title(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,max:number,size:number){ctx.font=`800 ${size}px "Trenomi Display", sans-serif`;const lines=shareTitleLines(ctx,value.toLocaleUpperCase('cs-CZ'),max);lines.forEach((line,i)=>text(ctx,line,x,y+i*size*.98,max,size,white,true));return y+lines.length*size*.98}
function rule(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,color=orange){ctx.fillStyle=color;ctx.fillRect(x,y,w,3)}
function clipped(ctx:CanvasRenderingContext2D,box:GraphicBox,draw:()=>void){ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.width,box.height);ctx.clip();draw();ctx.restore()}
const monochromePhotos=new WeakMap<HTMLImageElement,HTMLCanvasElement>();
function monochrome(photo:HTMLImageElement){
 let canvas=monochromePhotos.get(photo);if(canvas)return canvas;
 canvas=document.createElement('canvas');const scale=Math.min(1,2000/Math.max(photo.naturalWidth,photo.naturalHeight));canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Fotografii nelze připravit.');ctx.drawImage(photo,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray}ctx.putImageData(pixels,0,0);monochromePhotos.set(photo,canvas);return canvas;
}
function photoBox(ctx:CanvasRenderingContext2D,photo:HTMLImageElement|null,box:GraphicBox,input:ShareGraphic){
 ctx.save();sharePhotoPath(ctx,box,input.template,input.photoFit??'cover');ctx.clip();
  ctx.fillStyle='#22272E';ctx.fillRect(box.x,box.y,box.width,box.height);
  if(photo){const pos=photoPlacement(box,{width:photo.naturalWidth,height:photo.naturalHeight},input.photoFit??'cover',input.crop??{x:.5,y:.5,zoom:1});ctx.drawImage(input.template==='clean'?monochrome(photo):photo,pos.x,pos.y,pos.width,pos.height)}
  else{ctx.strokeStyle='#FFB31725';ctx.lineWidth=2;for(let i=-8;i<15;i++){ctx.beginPath();ctx.moveTo(box.x+i*110,box.y);ctx.lineTo(box.x+i*110-box.height,box.y+box.height);ctx.stroke()}text(ctx,'FOTOGRAFIE Z TRÉNINKU',box.x+32,box.y+box.height/2,box.width-64,26,muted)}
 ctx.restore();
}
function regionTitle(ctx:CanvasRenderingContext2D,input:ShareGraphic,l:ReturnType<typeof photoShareLayout>){
 const box=l.title,face=l.titleFace??'display';
 clipped(ctx,box,()=>{const value=face==='serif'?input.title:input.title.toLocaleUpperCase('cs-CZ');let size=l.titleSize,lines:string[]=[];const maxLines=l.titleLines??2;
  const font=()=>`${face==='serif'?'italic 700':'800'} ${size}px "Trenomi ${face==='serif'?'Serif':face==='text'?'Text':'Display'}", sans-serif`;
  for(;size>=26;size--){ctx.font=font();lines=shareTitleLines(ctx,value,box.width,maxLines);if(lines.length*size*1.02<=box.height)break}
  ctx.font=font();ctx.fillStyle=l.ink;lines.forEach((line,i)=>ctx.fillText(line,box.x,box.y+size*.82+i*size*1.02,box.width));
 });
}
function rounded(ctx:CanvasRenderingContext2D,b:GraphicBox,color:string,r=16){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(b.x,b.y,b.width,b.height,r);ctx.fill()}
function polygon(ctx:CanvasRenderingContext2D,points:number[][],color:string){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function line(ctx:CanvasRenderingContext2D,x:number,y:number,x2:number,y2:number,color:string,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke()}
function photoGraphic(ctx:CanvasRenderingContext2D,input:ShareGraphic,brand:HTMLImageElement,photo:HTMLImageElement|null,clubLogo:HTMLImageElement|null){
 if(!usesSharePhoto(input.template))return;
 const orange=input.accent||'#FFB317';
 const l=photoShareLayout(input.template,input.format);if(l.background==='#FFB317')l.background=orange;if(input.template==='neon'&&input.accent)l.ink=input.accent;const height=shareFormats[input.format].height,p=l.photo,t=l.title,m=l.metrics,top=l.header.y;
 ctx.fillStyle=l.background;ctx.fillRect(0,0,1080,height);
 // Artwork is drawn before the unfiltered photograph; ornaments never cover people.
 switch(input.template){
  case 'photo':
   polygon(ctx,[[0,t.y-16],[1080,t.y-38],[1080,t.y+t.height+12],[0,t.y+t.height+4]],orange);l.ink=background;
   for(let i=0;i<4;i++)line(ctx,800+i*58,top+4,825+i*58,top+29,orange,9);
   break;
  case 'editorial':
   line(ctx,64,p.y-17,1016,p.y-17,'#191B1E',2);line(ctx,64,l.footer.y-9,1016,l.footer.y-9,'#191B1E',1);
   ctx.save();ctx.translate(32,p.y+p.height);ctx.rotate(-Math.PI/2);text(ctx,'TRENOMI / SPOLU V POHYBU',0,0,p.height,16,'#65615C');ctx.restore();
   rounded(ctx,{x:868,y:p.y-16,width:148,height:7},orange,0);break;
  case 'sport':
   ctx.save();ctx.font='800 330px "Trenomi Display"';ctx.strokeStyle='#10121620';ctx.lineWidth=2;ctx.strokeText('TRENOMI',-8,p.y+10);ctx.restore();
   for(let i=0;i<8;i++)polygon(ctx,[[1000,p.y+p.height-20-i*42],[1080,p.y+p.height-72-i*42],[1080,p.y+p.height-54-i*42],[1000,p.y+p.height-2-i*42]],background);
   polygon(ctx,[[0,p.y-18],[730,p.y-18],[700,p.y],[0,p.y]],background);break;
  case 'frame':
   ctx.save();ctx.translate(540,(p.y+p.height/2));ctx.rotate(-.035);ctx.shadowColor='#17191D40';ctx.shadowBlur=35;ctx.shadowOffsetY=18;rounded(ctx,{x:-490,y:-p.height/2-34,width:980,height:p.height+180},'#FFFEFA',2);ctx.restore();
   ctx.fillStyle=orange;ctx.beginPath();ctx.arc(979,top+26,35,0,Math.PI*2);ctx.fill();text(ctx,'STUDIO',943,top+31,72,14,background);
   line(ctx,t.x,t.y+t.height+2,t.x+110,t.y+t.height+2,background,2);break;
  case 'cinema':
   for(let y=p.y+8;y<p.y+p.height-10;y+=52){rounded(ctx,{x:16,y,width:24,height:34},'#D5D0C5',4);rounded(ctx,{x:1040,y,width:24,height:34},'#D5D0C5',4)}
   text(ctx,'AFTER HOURS / TRÉNINKOVÝ DENÍK',58,p.y-8,964,15,orange);
   line(ctx,58,m.y-15,1022,m.y-15,'#D5D0C5',1);break;
  case 'split':
   rounded(ctx,{x:t.x-12,y:t.y-16,width:t.width+24,height:t.height+20},orange,0);l.ink=background;
   if(input.format!=='9:16'){ctx.save();ctx.font='800 300px "Trenomi Display"';ctx.strokeStyle='#FFB31735';ctx.lineWidth=2;ctx.strokeText('T',-5,p.y+p.height-8);ctx.restore()}
   break;
  case 'clean':
   ctx.fillStyle=orange;ctx.fillRect(0,t.y,12,t.height);break;
  case 'neon':{
   const glow=ctx.createRadialGradient(1030,100,10,1030,100,height);glow.addColorStop(0,'#2F5B4D');glow.addColorStop(.8,'#101A1B');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,height);
   sharePhotoPath(ctx,{x:p.x-8,y:p.y-8,width:p.width+16,height:p.height+16},'neon',input.photoFit??'cover');ctx.strokeStyle=(input.accent||'#BEFFD9');ctx.lineWidth=2;ctx.stroke();
   for(let x=0;x<1080;x+=36)for(let y=top;y<height;y+=36){ctx.fillStyle='#C9FFE516';ctx.fillRect(x,y,2,2)}
   for(const [x,y,sx,sy] of [[p.x-12,p.y-12,1,1],[p.x+p.width+12,p.y-12,-1,1],[p.x-12,p.y+p.height+12,1,-1],[p.x+p.width+12,p.y+p.height+12,-1,-1]]){line(ctx,x,y,x+sx*52,y,(input.accent||'#BEFFD9'),3);line(ctx,x,y,x,y+sy*52,(input.accent||'#BEFFD9'),3)}
   break;}
  case 'track':
   ctx.save();ctx.beginPath();ctx.rect(0,0,1080,height);for(const b of [l.header,l.title,l.metrics,l.footer])ctx.rect(b.x-6,b.y-4,b.width+12,b.height+8);ctx.clip('evenodd');ctx.strokeStyle='#101216';ctx.lineWidth=4;
   for(const inset of [14,30,46]){sharePhotoPath(ctx,{x:p.x-inset,y:p.y-inset,width:p.width+2*inset,height:p.height+2*inset},'track',input.photoFit??'cover');ctx.stroke()}ctx.restore();break;
  case 'ticket':
   rounded(ctx,{x:24,y:top-12,width:1032,height:height-top-(input.format==='9:16'?150:22)},'#F6F1E7',24);
   ctx.save();ctx.setLineDash([7,9]);line(ctx,24,t.y-12,1056,t.y-12,'#827D72',2);ctx.restore();
   rounded(ctx,{x:730,y:m.y-12,width:302,height:m.height+24},orange,0);
   ctx.save();ctx.setLineDash([5,7]);line(ctx,716,t.y,716,t.y+t.height,'#827D72',1);ctx.restore();
   for(const x of [24,1056]){ctx.fillStyle=l.background;ctx.beginPath();ctx.arc(x,t.y-12,17,0,Math.PI*2);ctx.fill()}
   text(ctx,'KLUBOVÝ PASS / TRENOMI',56,p.y-15,968,16,'#65615C');break;
 }
 photoBox(ctx,photo,p,input);
 const headInk=l.light?background:white,headMuted=l.light?'#554D3F':l.muted;
 clipped(ctx,l.header,()=>{const x=l.header.x,y=l.header.y,logoSize=38;
  if(clubLogo&&input.showClubIdentity!==false){const scale=Math.min(logoSize/clubLogo.naturalWidth,logoSize/clubLogo.naturalHeight);ctx.drawImage(clubLogo,x+(logoSize-clubLogo.naturalWidth*scale)/2,y+(logoSize-clubLogo.naturalHeight*scale)/2,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale)}
  text(ctx,(input.showClubIdentity===false?'':input.team).toLocaleUpperCase('cs-CZ'),x+(clubLogo?52:0),y+25,l.header.width-(clubLogo?52:0),25,headInk);
  const details=[input.date,input.place].filter(Boolean).join(' · ');if(details)text(ctx,details,x,y+61,l.header.width,20,headMuted);
 });
 regionTitle(ctx,input,l);
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()).slice(0,4),cols=Math.min(l.metricColumns,Math.max(1,metrics.length)),rows=Math.ceil(metrics.length/cols),cw=m.width/cols,ch=m.height/Math.max(rows,1);
 clipped(ctx,m,()=>metrics.forEach((v,i)=>{const x=m.x+(i%cols)*cw,y=m.y+Math.floor(i/cols)*ch,large=ch>=78,compact=ch<55;
  let number=l.light?background:orange,label=l.muted;
  if(input.template==='sport'||input.template==='neon'||input.template==='split'){
   const fill=input.template==='neon'?(input.accent||'#C4FBE5'):input.template==='split'?'#242B34':background;
   rounded(ctx,{x,y,width:cw-10,height:ch-3},fill,input.template==='neon'?0:10);number=input.template==='neon'?background:input.template==='split'?white:orange;label=input.template==='neon'?'#365247':input.template==='split'?muted:'#D6C8A5';
  }
  const padding=['sport','neon','split'].includes(input.template)?12:0;
  if(input.template==='ticket'&&i%cols>0)line(ctx,x-12,y+6,x-12,y+ch-8,'#BBB4A5',1);
  text(ctx,v.value,x+padding,y+(large?49:compact?26:33),cw-padding-18,large?64:compact?33:44,number,true);text(ctx,v.label.toLocaleUpperCase('cs-CZ'),x+padding,y+(large?73:compact?43:55),cw-padding-18,compact?13:16,label);
 }));
 clipped(ctx,l.footer,()=>{const w=160,h=w*420/1530;ctx.drawImage(brand,l.footer.x+l.footer.width-w,l.footer.y+(l.footer.height-h)/2,w,h);text(ctx,input.template==='editorial'?'SPOLU V POHYBU':'TRÉNINKOVÝ DENÍK',l.footer.x,l.footer.y+l.footer.height*.72,l.footer.width-w-28,16,l.light?'#65615C':l.muted)});
}
function editorPhotoGraphic(ctx:CanvasRenderingContext2D,input:ShareGraphic,brand:HTMLImageElement,photo:HTMLImageElement|null,clubLogo:HTMLImageElement|null){
 const {height}=shareFormats[input.format],accent=input.accent||'#FFB317',story=input.format==='9:16',top=story?155:52,bottom=height-(story?175:56),left=56;
 photoBox(ctx,photo,{x:0,y:0,width:1080,height},input);
 const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#080B10A6');shade.addColorStop(.3,'#080B1008');shade.addColorStop(.55,'#080B1070');shade.addColorStop(1,'#080B10FA');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,height);
 text(ctx,input.date||'',left,top+28,420,26,white);text(ctx,(input.showClubIdentity===false?'':input.team).toLocaleUpperCase('cs-CZ'),580,top+28,clubLogo?355:444,25,accent);
 if(clubLogo&&input.showClubIdentity!==false){const scale=Math.min(54/clubLogo.naturalWidth,54/clubLogo.naturalHeight);ctx.drawImage(clubLogo,970,top-8,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale)}
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()),distance=metrics.find(m=>m.label==='vzdálenost'),other=metrics.filter(m=>m!==distance);
 let titleY=bottom-240;
 if(input.template==='distance'){
  const main=distance;if(main){const km=/\s*km$/i.test(main.value);text(ctx,main.label.toLocaleUpperCase('cs-CZ'),left,bottom-580,968,28,accent);text(ctx,km?main.value.replace(/\s*km$/i,''):main.value,left,bottom-290,km?740:968,height===1080?260:350,accent,true);if(km)text(ctx,'KM',830,bottom-290,194,128,white,true)}
 }else if(input.template==='column'){
  const items=metrics.slice(0,3);ctx.fillStyle=accent;ctx.fillRect(left,top+90,9,items.length*152);items.forEach((m,i)=>{text(ctx,m.label.toLocaleUpperCase('cs-CZ'),left+30,top+124+i*152,600,22,muted);text(ctx,m.value,left+30,top+222+i*152,600,104,white,true)});
  titleY=bottom-190;
 }else titleY=bottom-270;
 clipped(ctx,{x:left,y:titleY,width:968,height:150},()=>title(ctx,input.title,left,titleY+72,968,input.template==='headline'?120:88));
 rule(ctx,left,bottom-76,968,accent);
 if(input.template!=='column'){const items=(input.template==='distance'?other:metrics).slice(0,3),cw=720/Math.max(1,items.length);items.forEach((m,i)=>{text(ctx,m.value,left+i*cw,bottom-27,cw-18,49,white,true);text(ctx,m.label.toLocaleUpperCase('cs-CZ'),left+i*cw,bottom+1,cw-18,16,muted)})}
 else text(ctx,input.place||'TRÉNINKOVÝ DENÍK',left,bottom-20,700,23,muted);
 ctx.drawImage(brand,846,bottom-35,178,178*420/1530);
}
export async function renderShareGraphic(input:ShareGraphic){
 await loadFonts();const [{width,height},brand,photo,clubLogo]=await Promise.all([Promise.resolve(shareFormats[input.format]),image(usesSharePhoto(input.template)&&photoShareLayout(input.template,input.format).light?'/brand/trenomi-logo.svg':'/brand/trenomi-logo-dark.svg'),usesSharePhoto(input.template)&&input.photo?image(input.photo):null,input.clubLogo?image(input.clubLogo).catch(()=>null):null]);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Grafiku nelze připravit.');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
 const orange=input.accent||'#FFB317';
 if(['distance','column','headline'].includes(input.template)){editorPhotoGraphic(ctx,input,brand,photo,clubLogo);drawShareStickers(ctx,input.stickers,width,height,orange,clubLogo);return canvas}
 if(usesSharePhoto(input.template)){photoGraphic(ctx,input,brand,photo,clubLogo);drawShareStickers(ctx,input.stickers,width,height,orange,clubLogo);return canvas}
 const story=input.format==='9:16',top=story?160:64,bottom=height-(story?170:64),left=72,right=1008,contentWidth=936;
 // Club identity and application brand stay inside Story safe areas.
 const clubX=clubLogo?left+74:left;
 if(clubLogo&&input.showClubIdentity!==false){ctx.save();ctx.beginPath();ctx.roundRect(left,top-8,54,54,12);ctx.clip();ctx.fillStyle='#FFFFFF';ctx.fillRect(left,top-8,54,54);const scale=Math.min(46/clubLogo.naturalWidth,46/clubLogo.naturalHeight);ctx.drawImage(clubLogo,left+(54-clubLogo.naturalWidth*scale)/2,top-8+(54-clubLogo.naturalHeight*scale)/2,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale);ctx.restore()}
 text(ctx,(input.showClubIdentity===false?'':input.team).toLocaleUpperCase('cs-CZ'),clubX,top+26,contentWidth-(clubX-left),28);
 const details=[input.date,input.place].filter(Boolean).join(' · ');if(details)text(ctx,details,left,top+91,contentWidth,24,muted);
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()).slice(0,4);
 const footer=()=>{rule(ctx,left,bottom-55,contentWidth,'#FFFFFF30');ctx.drawImage(brand,right-196,bottom-25,196,196*420/1530);text(ctx,'TRÉNINKOVÝ DENÍK',left,bottom+12,640,20,muted)};
 if(input.template==='stats'){
  ctx.save();ctx.font='800 380px "Trenomi Display"';ctx.lineWidth=2;ctx.strokeStyle='#FFFFFF0C';ctx.strokeText('MOVE',460,top+560);ctx.restore();
  const head={photo:{x:0,y:0,width:0,height:0},header:{x:0,y:0,width:0,height:0},title:{x:72,y:top+155,width:936,height:155},metrics:{x:0,y:0,width:0,height:0},footer:{x:0,y:0,width:0,height:0},metricColumns:4,background,ink:white,muted,light:false,titleSize:110};regionTitle(ctx,input,head);
  const primary=metrics.find(m=>m.label==='délka')??metrics.find(m=>m.label==='vzdálenost')??metrics[0],mainY=Math.min(bottom-350,top+(story?800:height>1080?650:530));
  if(primary){text(ctx,primary.value,72,mainY,936,story?360:300,orange,true);text(ctx,primary.label.toLocaleUpperCase('cs-CZ'),76,mainY+52,900,26,muted)}
  const rest=metrics.filter(m=>m!==primary),cw=936/Math.max(1,rest.length),y=bottom-204;
  rest.forEach((v,i)=>{rounded(ctx,{x:72+i*cw,y,width:cw-12,height:116},orange,0);text(ctx,v.value,90+i*cw,y+64,cw-46,76,background,true);text(ctx,v.label.toLocaleUpperCase('cs-CZ'),90+i*cw,y+99,cw-46,18,'#493A17')});
  for(let i=0;i<8;i++)line(ctx,1030,top+350+i*26,1080,top+320+i*26,orange,8);
 }else{
  rounded(ctx,{x:0,y:top+128,width:1080,height:172},orange,0);
  const l={photo:{x:0,y:0,width:0,height:0},header:{x:0,y:0,width:0,height:0},title:{x:72,y:top+145,width:936,height:138},metrics:{x:0,y:0,width:0,height:0},footer:{x:0,y:0,width:0,height:0},metricColumns:4,background,ink:background,muted,light:false,titleSize:110};regionTitle(ctx,input,l);
  const rows=input.best.slice(0,3),rowH=Math.min(240,(bottom-top-410)/3),start=top+350;
  rows.forEach((row,i)=>{const y=start+i*rowH;rounded(ctx,{x:72,y,width:936,height:rowH-14},i===0?'#293022':'#1B2027',12);text(ctx,String(i+1).padStart(2,'0'),96,y+rowH*.73,152,rowH*.9,i===0?orange:'#87919F',true);text(ctx,row.name,274,y+rowH*.38,700,28);text(ctx,row.value,274,y+rowH*.73,700,46,i===0?orange:white,true)});
  if(!rows.length){text(ctx,'VÝKONY',72,top+540,936,180,orange,true);text(ctx,'Měřené výkony zatím nejsou zadané.',72,top+605,936,26,muted)}
 }
 footer();drawShareStickers(ctx,input.stickers,width,height,orange,clubLogo);return canvas;
}
export function canvasPng(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Grafiku nelze exportovat.')),'image/png'));}
