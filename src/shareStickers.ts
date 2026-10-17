export const shareAccents=[
 {value:'#FFB317',name:'Oranžová'},{value:'#46C6E8',name:'Modrá'},{value:'#77E47D',name:'Zelená'},{value:'#A88AF8',name:'Fialová'},
 {value:'#FFD166',name:'Zlatá'},{value:'#F97316',name:'Mandarinková'},{value:'#EF4444',name:'Červená'},{value:'#FB7185',name:'Korálová'},
 {value:'#F472B6',name:'Růžová'},{value:'#D946EF',name:'Purpurová'},{value:'#6366F1',name:'Indigová'},{value:'#2563EB',name:'Královská modrá'},
 {value:'#14B8A6',name:'Tyrkysová'},{value:'#34D399',name:'Smaragdová'},{value:'#A3E635',name:'Limetková'},{value:'#F5F6F7',name:'Stříbrná'}
] as const;
export type StickerKind='badge'|'tape'|'attendance'|'distance'|'stamp'|'bolt'|'streak'|'effort'|'ticket'|'outline'|'team'|'record';
export const stickerKinds:{id:StickerKind;name:string;hint:string}[]=[
 {id:'badge',name:'Odznak',hint:'Vlastní úspěch'},{id:'tape',name:'Páska',hint:'Bez výmluv'},{id:'attendance',name:'Kruh docházky',hint:'Účast z tréninku'},{id:'distance',name:'Počítadlo km',hint:'Vzdálenost z deníku'},
 {id:'stamp',name:'Razítko',hint:'Odmakáno'},{id:'bolt',name:'Blesk',hint:'Tempo týmu'},{id:'streak',name:'Série',hint:'Vlastní text'},{id:'effort',name:'Ukazatel zátěže',hint:'RPE z deníku'},
 {id:'ticket',name:'Lístek',hint:'Název tréninku'},{id:'outline',name:'Obrysový nápis',hint:'Dnes jsme to dali'},{id:'team',name:'Tým na startu',hint:'Počet přítomných'},{id:'record',name:'Rekord',hint:'Doplňte vlastní výkon'}
];
export type ShareSticker={id:string;kind:StickerKind|'club';x:number;y:number;scale:number;rotation:number;text:string;value:string;clubBorderWidth?:number;clubCornerRadius?:number;clubPadding?:number;clubBorder?:boolean;clubBorderColor?:string;clubBackground?:boolean;clubBackgroundColor?:string;clubBackgroundOpacity?:number};
export type StickerData={title:string;date?:string;metrics:{label:string;value:string}[];attendance?:{present:number;total:number}};
export function newShareSticker(kind:StickerKind,data:StickerData,id?:string):ShareSticker{
 const metric=(label:string)=>data.metrics.find(m=>m.label===label)?.value||'—';
 const values:Record<StickerKind,[string,string]>={badge:['MŮJ VÝKON','TRÉNINK'],tape:['','BEZ VÝMLUV'],attendance:['DOCHÁZKA',data.attendance&&data.attendance.total?Math.round(data.attendance.present/data.attendance.total*100)+' %':'—'],distance:['VZDÁLENOST',metric('vzdálenost')],stamp:[data.date||'','ODMAKÁNO'],bolt:['','SPOLU RYCHLEJI'],streak:['MOJE SÉRIE','DOPLŇTE'],effort:['ZÁTĚŽ Z 10',metric('zátěž')],ticket:['TRÉNINKOVÝ DENÍK',data.title],outline:['D N E S  J S M E','TO DALI'],team:['NA STARTU',data.attendance?`${data.attendance.present} / ${data.attendance.total}`:metric('přítomných')],record:['VLASTNÍ REKORD','DOPLŇTE']};
 const [text,value]=values[kind];return {id:id??crypto.randomUUID(),kind,x:.64,y:.56,scale:1,rotation:kind==='tape'?-8:kind==='stamp'?-9:0,text,value};
}
export const stickerName=(kind:ShareSticker['kind'])=>kind==='club'?'Logo a název klubu':stickerKinds.find(k=>k.id===kind)!.name;
export function stickerSize(kind:ShareSticker['kind']){return ['tape','distance','bolt','stamp','ticket','team','outline','club'].includes(kind)?{width:440,height:160}:{width:290,height:260}}
export function stickerBounds(sticker:ShareSticker){const size=stickerSize(sticker.kind);if(sticker.kind!=='club')return size;const s=safeSticker(sticker),extra=2*s.clubPadding!+(s.clubBorder?s.clubBorderWidth!:0);return {width:size.width+extra,height:size.height+extra}}
export function safeSticker(s:ShareSticker):ShareSticker{const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback,padding=Math.max(0,Math.min(100,finite(s.clubPadding??0,0)));return {...s,x:Math.max(0,Math.min(1,finite(s.x,.5))),y:Math.max(0,Math.min(1,finite(s.y,.5))),scale:Math.max(.35,Math.min(2.4,finite(s.scale,1))),rotation:((finite(s.rotation,0)+180)%360+360)%360-180,text:s.text.slice(0,60),value:s.value.slice(0,80),clubBorderWidth:Math.max(1,Math.min(24,finite(s.clubBorderWidth??3,3))),clubCornerRadius:Math.max(0,Math.min(80+padding,finite(s.clubCornerRadius??14,14))),clubPadding:padding,clubBackgroundOpacity:Math.max(0,Math.min(1,finite(s.clubBackgroundOpacity??.85,.85))),clubBackgroundColor:/^#[0-9a-f]{6}$/i.test(s.clubBackgroundColor||'')?s.clubBackgroundColor:'#101216',clubBorderColor:/^#[0-9a-f]{6}$/i.test(s.clubBorderColor||'')?s.clubBorderColor:'#FFFFFF'}}
function label(ctx:CanvasRenderingContext2D,value:string,y:number,size:number,color:string,max:number,outline=false){ctx.font=`800 ${size}px "Trenomi Display", sans-serif`;while(ctx.measureText(value).width>max&&size>12){ctx.font=`800 ${--size}px "Trenomi Display", sans-serif`}ctx.textAlign='center';ctx.textBaseline='middle';if(outline){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeText(value,0,y,max)}else{ctx.fillStyle=color;ctx.fillText(value,0,y,max)}}
export function drawShareSticker(ctx:CanvasRenderingContext2D,raw:ShareSticker,width:number,height:number,accent:string,clubLogo?:HTMLImageElement|null){
 const s=safeSticker(raw),b=stickerSize(s.kind),w=b.width,h=b.height,white='#F5F6F7',dark='#101216';ctx.save();ctx.translate(s.x*width,s.y*height);ctx.rotate(s.rotation*Math.PI/180);ctx.scale(s.scale,s.scale);
 const rect=(fill:string,r=8)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,r);ctx.fill()};
 const ring=(radius:number)=>{ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle=dark;ctx.fill();ctx.lineWidth=12;ctx.strokeStyle=accent;ctx.stroke()};
 switch(s.kind){
 case 'club':{
  const padding=s.clubPadding!,fw=w+padding*2,fh=h+padding*2,radius=Math.min(s.clubCornerRadius!,fw/2,fh/2);
  const frame=()=>{ctx.beginPath();ctx.roundRect(-fw/2,-fh/2,fw,fh,radius)};
  if(s.clubBackground){ctx.save();ctx.globalAlpha*=s.clubBackgroundOpacity!;ctx.fillStyle=s.clubBackgroundColor!;frame();ctx.fill();ctx.restore()}
  if(s.clubBorder){ctx.strokeStyle=s.clubBorderColor!;ctx.lineWidth=s.clubBorderWidth!;frame();ctx.stroke()}
  const logoWidth=clubLogo?105:0;
  if(clubLogo){const factor=Math.min(90/clubLogo.naturalWidth,110/clubLogo.naturalHeight);ctx.drawImage(clubLogo,-w/2+18,-clubLogo.naturalHeight*factor/2,clubLogo.naturalWidth*factor,clubLogo.naturalHeight*factor)}
  ctx.fillStyle=white;ctx.textAlign='left';ctx.textBaseline='middle';let size=34;ctx.font=`700 ${size}px "Trenomi Text",sans-serif`;while(ctx.measureText(s.value).width>w-logoWidth-42&&size>12)ctx.font=`700 ${--size}px "Trenomi Text",sans-serif`;ctx.fillText(s.value,-w/2+20+logoWidth,0,w-logoWidth-40);break;}

 case 'badge':case 'record':{
  const n=s.kind==='badge'?6:24;ctx.beginPath();for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2,r=s.kind==='record'&&i%2?98:128;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fillStyle=s.kind==='record'?accent:dark;ctx.fill();ctx.lineWidth=9;ctx.strokeStyle=s.kind==='record'?dark:accent;ctx.stroke();label(ctx,s.value,5,64,s.kind==='record'?dark:accent,218);label(ctx,s.text,63,21,s.kind==='record'?dark:white,210);break;}
 case 'attendance':ring(115);label(ctx,s.value,-7,79,white,210);label(ctx,s.text,54,19,accent,205);break;
 case 'effort':{
  ctx.lineWidth=21;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,22,112,Math.PI,Math.PI*2);ctx.strokeStyle='#303945';ctx.stroke();const n=Number(s.value.replace(/[^\d.,]/g,'').replace(',','.'));if(Number.isFinite(n)&&n>0){ctx.beginPath();ctx.arc(0,22,112,Math.PI,Math.PI+Math.PI*Math.min(1,n/10));ctx.strokeStyle=accent;ctx.stroke()}label(ctx,s.value,38,76,white,245);label(ctx,s.text,96,20,white,245);break;}
 case 'streak':label(ctx,'↟',-80,78,accent,100);label(ctx,s.value,10,92,white,265);label(ctx,s.text,98,21,white,260);break;
 case 'outline':label(ctx,s.text,-32,52,white,w-16,true);label(ctx,s.value,35,76,accent,w-16);break;
 case 'stamp':ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.strokeRect(-w/2,-h/2,w,h);ctx.strokeRect(-w/2+7,-h/2+7,w-14,h-14);label(ctx,s.value,-14,74,accent,w-30);label(ctx,s.text,49,25,accent,w-30);break;
 case 'team':for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-110+i*55,-44,28,0,Math.PI*2);ctx.fillStyle=i===4?accent:['#303945','#2B3450','#28413A','#40364E'][i];ctx.fill();ctx.save();ctx.translate(-110+i*55,0);label(ctx,'•',-44,25,i===4?dark:white,40);ctx.restore();}
  label(ctx,s.value+' '+s.text,48,49,white,w-12);break;
 default:rect(accent,s.kind==='distance'?70:3);if(s.kind==='ticket'){ctx.fillStyle=dark;for(const x of [-w/2,w/2]){ctx.beginPath();ctx.arc(x,0,18,0,Math.PI*2);ctx.fill()}}
  label(ctx,(s.kind==='bolt'?'ϟ ':s.kind==='distance'?'→ ':'')+s.value,s.text?18:0,s.text?63:77,dark,w-30);if(s.text)label(ctx,s.text,-48,20,dark,w-30);
 }
 ctx.restore();
}
export function drawShareStickers(ctx:CanvasRenderingContext2D,stickers:ShareSticker[]|undefined,width:number,height:number,accent:string,clubLogo?:HTMLImageElement|null){for(const sticker of (stickers||[]).slice(0,16))drawShareSticker(ctx,sticker,width,height,accent,clubLogo)}
