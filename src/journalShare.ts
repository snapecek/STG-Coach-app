import {photoShareLayout,usesSharePhoto,type GraphicBox} from './journalShareLayouts';
export {usesSharePhoto} from './journalShareLayouts';
export const shareFormats={'1:1':{width:1080,height:1080,label:'Příspěvek 1:1'},'4:5':{width:1080,height:1350,label:'Příspěvek 4:5'},'9:16':{width:1080,height:1920,label:'Story 9:16'}};
export type ShareFormat=keyof typeof shareFormats;
export type ShareTemplate='stats'|'photo'|'best'|'editorial'|'sport'|'frame'|'cinema'|'split'|'clean';
export const shareTemplates=[{id:'photo',name:'Fotografický plakát'},{id:'stats',name:'Přehled výkonu'},{id:'editorial',name:'Klubový deník'},{id:'sport',name:'Sportovní poster'},{id:'frame',name:'Galerijní rám'},{id:'cinema',name:'Filmový pás'},{id:'split',name:'Boční panel'},{id:'clean',name:'Čistá fotografie'},{id:'best',name:'Nejlepší výkony'}] as const;
export type ShareGraphic={team:string;title:string;photo:string|null;photoFit?:'contain'|'cover';clubLogo?:string;date?:string;place?:string;crop?:{x:number;y:number;zoom:number};format:ShareFormat;template:ShareTemplate;metrics:{value:string;label:string}[];best:{name:string;value:string}[]};
const orange='#FFB317',background='#101216',white='#F5F6F7',muted='#A9AFB8';
let fonts:Promise<void>|undefined;
function loadFonts(){return fonts??=Promise.all([
 new FontFace('Trenomi Display','url(/fonts/BarlowCondensed-ExtraBold.ttf)',{weight:'800'}),
 new FontFace('Trenomi Text','url(/fonts/Manrope.ttf)',{weight:'200 800'})
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
function photoBox(ctx:CanvasRenderingContext2D,photo:HTMLImageElement|null,box:GraphicBox,input:ShareGraphic){
 clipped(ctx,box,()=>{
  ctx.fillStyle='#22272E';ctx.fillRect(box.x,box.y,box.width,box.height);
  if(photo){const fit=input.photoFit??'cover',scale=(fit==='contain'?Math.min:Math.max)(box.width/photo.naturalWidth,box.height/photo.naturalHeight)*Math.max(1,Math.min(3,input.crop?.zoom??1)),w=photo.naturalWidth*scale,h=photo.naturalHeight*scale;ctx.drawImage(photo,box.x+(box.width-w)*Math.max(0,Math.min(1,input.crop?.x??.5)),box.y+(box.height-h)*Math.max(0,Math.min(1,input.crop?.y??.5)),w,h)}
  else{ctx.strokeStyle='#FFB31725';ctx.lineWidth=2;for(let i=-8;i<15;i++){ctx.beginPath();ctx.moveTo(box.x+i*110,box.y);ctx.lineTo(box.x+i*110-box.height,box.y+box.height);ctx.stroke()}text(ctx,'FOTOGRAFIE Z TRÉNINKU',box.x+32,box.y+box.height/2,box.width-64,26,muted)}
 });
}
function regionTitle(ctx:CanvasRenderingContext2D,input:ShareGraphic,box:GraphicBox,size:number,color:string,editorial=false){
 clipped(ctx,box,()=>{const value=editorial?input.title:input.title.toLocaleUpperCase('cs-CZ');let lines:string[]=[];const maxLines=box.width<400?4:2;
  for(;size>=26;size--){ctx.font=`800 ${size}px "Trenomi ${editorial?'Text':'Display'}", sans-serif`;lines=shareTitleLines(ctx,value,box.width,maxLines);if(lines.length*size*1.08<=box.height)break}
  lines.forEach((line,i)=>text(ctx,line,box.x,box.y+size*.85+i*size*1.08,box.width,size,color,!editorial));
 });
}
function photoGraphic(ctx:CanvasRenderingContext2D,input:ShareGraphic,brand:HTMLImageElement,photo:HTMLImageElement|null,clubLogo:HTMLImageElement|null){
 if(!usesSharePhoto(input.template))return;
 const l=photoShareLayout(input.template,input.format),height=shareFormats[input.format].height;
 ctx.fillStyle=l.background;ctx.fillRect(0,0,1080,height);
 if(input.template==='sport'){ctx.fillStyle=orange;ctx.fillRect(0,0,1080,l.photo.y-18);ctx.fillRect(l.photo.width,l.photo.y,1080-l.photo.width,l.photo.height);clipped(ctx,{x:1008,y:l.photo.y,width:72,height:l.photo.height},()=>{ctx.strokeStyle=background;ctx.lineWidth=12;for(let y=l.photo.y+l.photo.height-160;y<l.photo.y+l.photo.height;y+=38){ctx.beginPath();ctx.moveTo(1018,y);ctx.lineTo(1090,y-50);ctx.stroke()}})}
 if(input.template==='frame'){ctx.strokeStyle='#BCB7AD';ctx.lineWidth=1;ctx.strokeRect(l.photo.x-13,l.photo.y-13,l.photo.width+26,l.photo.height+26)}
 photoBox(ctx,photo,l.photo,input);
 // Header, title, metrics and footer are clipped independently, outside the photo.
 const headInk=input.template==='sport'?background:l.ink,headMuted=input.template==='sport'?'#493A17':l.muted;
 clipped(ctx,l.header,()=>{const x=l.header.x,y=l.header.y,logoSize=40;
  if(clubLogo){const scale=Math.min(logoSize/clubLogo.naturalWidth,logoSize/clubLogo.naturalHeight);ctx.drawImage(clubLogo,x+(logoSize-clubLogo.naturalWidth*scale)/2,y+(logoSize-clubLogo.naturalHeight*scale)/2,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale)}
  text(ctx,input.team.toLocaleUpperCase('cs-CZ'),x+(clubLogo?54:0),y+25,l.header.width-(clubLogo?54:0),25,headInk);
  const details=[input.date,input.place].filter(Boolean).join(' · ');if(details)text(ctx,details,x,y+60,l.header.width,21,headMuted);
 });
 regionTitle(ctx,input,l.title,l.titleSize,input.template==='sport'?background:l.ink,input.template==='editorial');
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()).slice(0,4),cols=Math.min(l.metricColumns,Math.max(1,metrics.length)),rows=Math.ceil(metrics.length/cols),cellW=l.metrics.width/cols,cellH=l.metrics.height/Math.max(rows,1);
 clipped(ctx,l.metrics,()=>metrics.forEach((m,i)=>{const x=l.metrics.x+(i%cols)*cellW,y=l.metrics.y+Math.floor(i/cols)*cellH;const small=cellH<55;text(ctx,m.value,x,y+(small?24:34),cellW-14,small?31:42,l.light?l.ink:orange,true);text(ctx,m.label.toLocaleUpperCase('cs-CZ'),x,y+(small?44:57),cellW-14,small?14:17,l.muted)}));
 if(input.template==='cinema'){rule(ctx,64,l.photo.y-12,952,'#FFFFFF40');rule(ctx,64,l.photo.y+l.photo.height+12,952,'#FFFFFF40')}
 if(input.template==='photo'){ctx.fillStyle=orange;ctx.fillRect(l.title.x-18,l.title.y,4,l.title.height)}
 clipped(ctx,l.footer,()=>{const logoWidth=input.template==='clean'?96:160,logoHeight=logoWidth*420/1530;ctx.drawImage(brand,l.footer.x+l.footer.width-logoWidth,l.footer.y+(l.footer.height-logoHeight)/2,logoWidth,logoHeight);text(ctx,input.template==='editorial'?'KLUBOVÝ DENÍK':'TRÉNINKOVÝ DENÍK',l.footer.x,l.footer.y+l.footer.height*.72,l.footer.width-logoWidth-28,input.template==='clean'?14:17,l.muted)});
}
export async function renderShareGraphic(input:ShareGraphic){
 await loadFonts();const [{width,height},brand,photo,clubLogo]=await Promise.all([Promise.resolve(shareFormats[input.format]),image(usesSharePhoto(input.template)&&photoShareLayout(input.template,input.format).light?'/brand/trenomi-logo.svg':'/brand/trenomi-logo-dark.svg'),usesSharePhoto(input.template)&&input.photo?image(input.photo):null,input.clubLogo?image(input.clubLogo).catch(()=>null):null]);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Grafiku nelze připravit.');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
 if(usesSharePhoto(input.template)){photoGraphic(ctx,input,brand,photo,clubLogo);return canvas}
 const story=input.format==='9:16',top=story?160:64,bottom=height-(story?170:64),left=72,right=1008,contentWidth=936;
 // Club identity and application brand stay inside Story safe areas.
 const clubX=clubLogo?left+74:left;
 if(clubLogo){ctx.save();ctx.beginPath();ctx.roundRect(left,top-8,54,54,12);ctx.clip();ctx.fillStyle='#FFFFFF';ctx.fillRect(left,top-8,54,54);const scale=Math.min(46/clubLogo.naturalWidth,46/clubLogo.naturalHeight);ctx.drawImage(clubLogo,left+(54-clubLogo.naturalWidth*scale)/2,top-8+(54-clubLogo.naturalHeight*scale)/2,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale);ctx.restore()}
 text(ctx,input.team.toLocaleUpperCase('cs-CZ'),clubX,top+26,contentWidth-(clubX-left),28);
 const details=[input.date,input.place].filter(Boolean).join(' · ');if(details)text(ctx,details,left,top+91,contentWidth,24,muted);
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()).slice(0,4);
 const footer=()=>{rule(ctx,left,bottom-55,contentWidth,'#FFFFFF30');ctx.drawImage(brand,right-196,bottom-25,196,196*420/1530);text(ctx,'TRÉNINKOVÝ DENÍK',left,bottom+12,640,20,muted)};
 if(input.template==='stats'){
  const titleEnd=title(ctx,input.title,left,top+205,contentWidth,80);const primary=metrics.find(m=>m.label==='délka')??metrics.find(m=>m.label==='vzdálenost')??metrics[0];
  const rowY=bottom-154,mainY=Math.min(rowY-135,Math.max(titleEnd+210,story?top+750:height>1080?top+610:top+500));
  if(primary){text(ctx,primary.value,left,mainY,contentWidth,story?270:230,orange,true);text(ctx,primary.label.toLocaleUpperCase('cs-CZ'),left,mainY+48,contentWidth,28,muted)}
  const others=metrics.filter(m=>m!==primary);rule(ctx,left,rowY-70,contentWidth,'#FFFFFF30');const col=contentWidth/Math.max(others.length,1);others.forEach((m,i)=>{text(ctx,m.value,left+i*col,rowY,col-32,64,white,true);text(ctx,m.label.toLocaleUpperCase('cs-CZ'),left+i*col,rowY+36,col-32,21,muted)});
  // A purely decorative arc; it does not imply a measured progress percentage.
  ctx.save();ctx.strokeStyle='#FFB31718';ctx.lineWidth=2;ctx.beginPath();ctx.arc(1080,mainY-90,280,-Math.PI,Math.PI);ctx.stroke();ctx.restore();
 }else{
  title(ctx,input.title,left,top+205,contentWidth,80);rule(ctx,left,top+445,90);const rows=input.best.slice(0,3);rows.forEach((row,i)=>{const y=top+530+i*105;text(ctx,String(i+1).padStart(2,'0'),left,y,72,34,orange,true);text(ctx,row.name,left+90,y,450,28);text(ctx,row.value,right-350,y,350,28,orange)});if(!rows.length)text(ctx,'Měřené výkony zatím nejsou zadané.',left,top+530,contentWidth,26,muted);
 }
 footer();return canvas;
}
export function canvasPng(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Grafiku nelze exportovat.')),'image/png'));}
