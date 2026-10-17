export const shareFormats={'1:1':{width:1080,height:1080,label:'Příspěvek 1:1'},'4:5':{width:1080,height:1350,label:'Příspěvek 4:5'},'9:16':{width:1080,height:1920,label:'Story 9:16'}};
export type ShareFormat=keyof typeof shareFormats;
export type ShareTemplate='stats'|'photo'|'best';
export const shareTemplates=[{id:'photo',name:'Fotografický plakát'},{id:'stats',name:'Přehled výkonu'},{id:'best',name:'Nejlepší výkony'}] as const;
export type ShareGraphic={team:string;title:string;photo:string|null;clubLogo?:string;date?:string;place?:string;crop?:{x:number;y:number;zoom:number};format:ShareFormat;template:ShareTemplate;metrics:{value:string;label:string}[];best:{name:string;value:string}[]};
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
function cover(ctx:CanvasRenderingContext2D,photo:HTMLImageElement,height:number,crop:ShareGraphic['crop']){const scale=Math.max(1080/photo.naturalWidth,height/photo.naturalHeight)*Math.max(1,Math.min(3,crop?.zoom??1)),w=photo.naturalWidth*scale,h=photo.naturalHeight*scale;ctx.drawImage(photo,(1080-w)*Math.max(0,Math.min(1,crop?.x??.5)),(height-h)*Math.max(0,Math.min(1,crop?.y??.5)),w,h)}
export async function renderShareGraphic(input:ShareGraphic){
 await loadFonts();const [{width,height},brand,photo,clubLogo]=await Promise.all([Promise.resolve(shareFormats[input.format]),image('/brand/trenomi-logo-dark.svg'),input.template==='photo'&&input.photo?image(input.photo):null,input.clubLogo?image(input.clubLogo).catch(()=>null):null]);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Grafiku nelze připravit.');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
 const story=input.format==='9:16',top=story?160:64,bottom=height-(story?170:64),left=72,right=1008,contentWidth=936;
 if(input.template==='photo'){
  if(photo){cover(ctx,photo,height,input.crop);const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#101216B8');shade.addColorStop(.28,'#10121610');shade.addColorStop(.52,'#10121666');shade.addColorStop(1,'#101216');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height)}else{
   const glow=ctx.createRadialGradient(820,280,10,650,400,height);glow.addColorStop(0,'#343B45');glow.addColorStop(1,background);ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);ctx.strokeStyle='#FFB31725';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(360+i*115,0);ctx.lineTo(-400+i*115,height);ctx.stroke()}
  }
 }
 // Club identity and application brand stay inside Story safe areas.
 const clubX=clubLogo?left+74:left;
 if(clubLogo){ctx.save();ctx.beginPath();ctx.roundRect(left,top-8,54,54,12);ctx.clip();ctx.fillStyle='#FFFFFF';ctx.fillRect(left,top-8,54,54);const scale=Math.min(46/clubLogo.naturalWidth,46/clubLogo.naturalHeight);ctx.drawImage(clubLogo,left+(54-clubLogo.naturalWidth*scale)/2,top-8+(54-clubLogo.naturalHeight*scale)/2,clubLogo.naturalWidth*scale,clubLogo.naturalHeight*scale);ctx.restore()}
 text(ctx,input.team.toLocaleUpperCase('cs-CZ'),clubX,top+26,contentWidth-(clubX-left),28);
 const details=[input.date,input.place].filter(Boolean).join(' · ');if(details)text(ctx,details,left,top+91,contentWidth,24,muted);
 const metrics=input.metrics.filter(m=>m.value.trim()&&m.label.trim()).slice(0,4);
 const footer=()=>{rule(ctx,left,bottom-55,contentWidth,'#FFFFFF30');ctx.drawImage(brand,right-196,bottom-25,196,196*420/1530);text(ctx,'TRÉNINKOVÝ DENÍK',left,bottom+12,640,20,muted)};
 if(input.template==='photo'){
  const metricY=bottom-118,titleY=metricY-(story?350:height>1080?310:270);rule(ctx,left,titleY-120,90);title(ctx,input.title,left,titleY,contentWidth,story?112:100);
  const col=contentWidth/Math.max(metrics.length,1);metrics.forEach((m,i)=>{text(ctx,m.value,left+i*col,metricY,col-28,48,orange,true);text(ctx,m.label.toLocaleUpperCase('cs-CZ'),left+i*col,metricY+35,col-28,19,muted)});
 }else if(input.template==='stats'){
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
