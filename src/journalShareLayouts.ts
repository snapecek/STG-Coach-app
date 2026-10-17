import type {ShareFormat,ShareTemplate} from './journalShare';
export type GraphicBox={x:number;y:number;width:number;height:number};
export type PhotoShareTemplate=Exclude<ShareTemplate,'stats'|'best'>;
export const usesSharePhoto=(template:ShareTemplate):template is PhotoShareTemplate=>template!=='stats'&&template!=='best';
export type PhotoShareLayout={photo:GraphicBox;header:GraphicBox;title:GraphicBox;metrics:GraphicBox;footer:GraphicBox;metricColumns:number;background:string;ink:string;muted:string;light:boolean;titleSize:number;titleFace?:'serif'|'text';titleLines?:number};
export const isSignatureTemplate=(template:ShareTemplate):template is 'split'|'neon'|'track'=>['split','neon','track'].includes(template);
/** Art direction is per composition; shared rectangles keep typography out of the photograph. */
export function photoShareLayout(template:PhotoShareTemplate,format:ShareFormat):PhotoShareLayout{
 const height={'1:1':1080,'4:5':1350,'9:16':1920}[format],story=format==='9:16',top=story?150:40,bottom=height-(story?170:40),h=bottom-top;
 const box=(x:number,y:number,width:number,height:number):GraphicBox=>({x,y,width,height});
 const layout:PhotoShareLayout={photo:box(0,top+92,1080,h-378),header:box(56,top,968,70),title:box(56,bottom-264,968,142),metrics:box(56,bottom-110,968,60),footer:box(56,bottom-42,968,42),metricColumns:4,background:'#101216',ink:'#F5F6F7',muted:'#A9AFB8',light:false,titleSize:132};
 switch(template){
  case 'distance':case 'column':case 'headline':return {...layout,photo:box(0,0,1080,height)};
  case 'editorial':return {...layout,background:'#F4F0E6',ink:'#191B1E',muted:'#65615C',light:true,header:box(64,top,952,70),title:box(64,top+90,952,152),photo:box(64,top+268,952,h-432),metrics:box(64,bottom-142,952,82),footer:box(64,bottom-44,952,44),titleSize:122,titleFace:'serif'};
  case 'sport':return {...layout,background:'#FFB317',ink:'#101216',muted:'#423613',light:true,title:box(44,top+82,980,140),header:box(44,top,980,70),photo:box(0,top+248,980,h-404),metrics:box(44,bottom-140,992,90),footer:box(44,bottom-44,992,44),titleSize:148};
  case 'frame':return {...layout,background:'#D9D3C7',ink:'#191B1E',muted:'#65615C',light:true,photo:box(90,top+112,900,h-386),header:box(64,top,836,70),title:box(90,bottom-246,900,122),metrics:box(90,bottom-110,900,60),footer:box(64,bottom-44,952,44),titleSize:100,titleFace:'serif'};
  case 'cinema':return {...layout,background:'#090B0D',photo:box(58,top+224,964,h-400),header:box(58,top+8,964,70),title:box(58,top+100,964,106),metrics:box(58,bottom-142,964,90),footer:box(58,bottom-44,964,44),titleSize:112};
  case 'split':return {...layout,background:'#FFB317',ink:'#101216',light:true,photo:box(0,story?top:0,1080,h*.72+(story?0:top)),title:box(40,top+h*.5,1000,h*.2),metrics:box(56,top+h*.76,968,h*.14),footer:box(56,bottom-55,968,50)};
  case 'clean':return {...layout,background:'#F4F4EF',ink:'#101216',muted:'#62666C',light:true,photo:box(0,top+76,1080,h-256),header:box(44,top,992,66),title:box(44,bottom-164,992,62),metrics:box(44,bottom-94,992,46),footer:box(44,bottom-44,992,44),titleSize:48,titleFace:'text'};
  case 'neon':return {...layout,background:'#080E19',photo:box(36,top+100,1008,h-340),title:box(82,bottom-490,900,230),metrics:box(40,bottom-200,1000,142),footer:box(40,bottom-42,1000,42),titleSize:140};
  case 'track':return {...layout,background:'#101216',photo:box(0,top,1080,h),title:box(45,top+130,850,h-340),metrics:box(56,bottom-195,968,110),footer:box(56,bottom-48,968,48),titleSize:220};
  case 'ticket':return {...layout,background:'#202631',ink:'#191B1E',muted:'#65615C',light:true,header:box(56,top+8,968,70),photo:box(56,top+118,968,h-408),title:box(56,bottom-264,636,188),metrics:box(756,bottom-250,260,160),metricColumns:2,footer:box(56,bottom-44,968,44),titleSize:118};
  default:return layout;
 }
}
/** Matching export and touch hit areas; whole-photo mode keeps the complete rectangular source. */
export function sharePhotoPath(ctx:CanvasRenderingContext2D,b:GraphicBox,template:ShareTemplate,fit:'contain'|'cover'='cover'){
 ctx.beginPath();
 if(fit==='cover'&&template==='sport'){ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+b.width,b.y+b.height*.12);ctx.lineTo(b.x+b.width*.88,b.y+b.height);ctx.lineTo(b.x,b.y+b.height*.94);ctx.closePath()}
 else if(fit==='cover'&&template==='neon')ctx.roundRect(b.x,b.y,b.width,b.height,{x:b.width*.08,y:b.height*.08});
 else if(fit==='cover'&&template==='split'){ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+b.width,b.y);ctx.lineTo(b.x+b.width,b.y+b.height*.75);ctx.lineTo(b.x,b.y+b.height);ctx.closePath()}
 else ctx.rect(b.x,b.y,b.width,b.height);
}
export function sharePhotoClipStyle(template:ShareTemplate,fit:'contain'|'cover'){
 if(fit==='contain')return {};
 if(template==='sport')return {clipPath:'polygon(0 0, 100% 12%, 88% 100%, 0 94%)'};
 if(template==='neon')return {borderRadius:'8%',overflow:'hidden' as const};
 if(template==='split')return {clipPath:'polygon(0 0,100% 0,100% 75%,0 100%)'};
 return {};
}
