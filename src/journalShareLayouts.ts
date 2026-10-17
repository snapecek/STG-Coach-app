import type {ShareFormat,ShareTemplate} from './journalShare';
export type GraphicBox={x:number;y:number;width:number;height:number};
export type PhotoShareTemplate=Exclude<ShareTemplate,'stats'|'best'>;
export const usesSharePhoto=(template:ShareTemplate):template is PhotoShareTemplate=>template!=='stats'&&template!=='best';
export type PhotoShareLayout={photo:GraphicBox;header:GraphicBox;title:GraphicBox;metrics:GraphicBox;footer:GraphicBox;metricColumns:number;background:string;ink:string;muted:string;light:boolean;titleSize:number};
/** Separate clipped regions guarantee that titles and metrics never paint over a photograph. */
export function photoShareLayout(template:PhotoShareTemplate,format:ShareFormat):PhotoShareLayout{
 const height={'1:1':1080,'4:5':1350,'9:16':1920}[format],story=format==='9:16',top=story?150:40,bottom=height-(story?170:40),h=bottom-top;
 const box=(x:number,y:number,width:number,height:number):GraphicBox=>({x,y,width,height});
 const layout:PhotoShareLayout={photo:box(0,top+90,1080,h-326),header:box(56,top,968,70),title:box(56,bottom-218,968,88),metrics:box(56,bottom-114,968,60),footer:box(56,bottom-44,968,44),metricColumns:4,background:'#101216',ink:'#F5F6F7',muted:'#A9AFB8',light:false,titleSize:70};
 switch(template){
  case 'editorial':return {...layout,background:'#F3F0E8',ink:'#17191D',muted:'#62666C',light:true,header:box(72,top,936,70),title:box(72,top+84,936,116),photo:box(72,top+220,936,h-370),metrics:box(72,bottom-114,936,60),footer:box(72,bottom-44,936,44),titleSize:76};
  case 'sport':return {...layout,header:box(56,top,968,70),title:box(56,top+84,940,108),photo:box(0,top+216,1008,h-366),titleSize:86};
  case 'frame':return {...layout,background:'#E8E5DE',ink:'#17191D',muted:'#62666C',light:true,photo:box(76,top+96,928,h-336),header:box(76,top,928,70),title:box(76,bottom-220,928,90),metrics:box(76,bottom-114,928,60),footer:box(76,bottom-44,928,44),titleSize:62};
  case 'cinema':return {...layout,background:'#080A0D',photo:box(0,top+114,1080,h-350),header:box(64,top+10,952,70),title:box(64,bottom-212,952,82),titleSize:64};
  case 'split':return story?{...layout,photo:box(0,top+90,1080,h-390),title:box(56,bottom-276,488,170),metrics:box(608,bottom-266,416,158),metricColumns:2,titleSize:70}:{...layout,header:box(40,top,1000,70),photo:box(374,top+92,706,h-152),title:box(40,top+116,296,230),metrics:box(40,top+390,296,Math.min(400,h-470)),metricColumns:1,footer:box(40,bottom-44,1000,44),titleSize:66};
  case 'clean':return {...layout,header:box(44,top,992,66),photo:box(0,top+76,1080,h-250),title:box(44,bottom-158,992,60),metrics:box(44,bottom-82,780,48),footer:box(44,bottom-28,992,28),titleSize:44};
  default:return layout;
 }
}
