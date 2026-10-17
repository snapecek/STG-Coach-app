import type {GraphicBox} from './journalShareLayouts';
export type PhotoCrop={x:number;y:number;zoom:number;rotation?:number};
export type PhotoSize={width:number;height:number};
export type Point={x:number;y:number};
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
export function rotatedPhotoSize(photo:PhotoSize,rotation=0){const angle=rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));return {width:photo.width*c+photo.height*s,height:photo.width*s+photo.height*c}}
export function photoPlacement(box:GraphicBox,photo:PhotoSize,fit:'contain'|'cover',crop:PhotoCrop){
 const angle=(crop.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),bounds=rotatedPhotoSize(photo,crop.rotation);
 const scale=(fit==='contain'?Math.min(box.width/bounds.width,box.height/bounds.height):Math.max((box.width*Math.abs(c)+box.height*Math.abs(s))/photo.width,(box.width*Math.abs(s)+box.height*Math.abs(c))/photo.height))*clamp(crop.zoom,1,3),width=bounds.width*scale,height=bounds.height*scale;
 let dx=(box.width-width)*(clamp(crop.x)-.5),dy=(box.height-height)*(clamp(crop.y)-.5);
 if(fit==='cover'){
  // Constrain translation in the source's rotated axes so no empty corners enter the crop.
  const limitX=Math.max(0,(photo.width*scale-box.width*Math.abs(c)-box.height*Math.abs(s))/2),limitY=Math.max(0,(photo.height*scale-box.width*Math.abs(s)-box.height*Math.abs(c))/2),localX=clamp(dx*c+dy*s,-limitX,limitX),localY=clamp(-dx*s+dy*c,-limitY,limitY);
  dx=localX*c-localY*s;dy=localX*s+localY*c;
 }
 return {x:box.x+(box.width-width)/2+dx,y:box.y+(box.height-height)/2+dy,width,height};
}
/** Keep the touched source point under the fingers while zooming and panning. */
export function gestureCrop(box:GraphicBox,photo:PhotoSize,fit:'contain'|'cover',start:PhotoCrop,from:Point,to:Point,zoomRatio=1):PhotoCrop{
 const old=photoPlacement(box,photo,fit,start),zoom=clamp(start.zoom*zoomRatio,1,3),next=photoPlacement(box,photo,fit,{...start,zoom});
 const left=to.x-(from.x-old.x)/old.width*next.width,top=to.y-(from.y-old.y)/old.height*next.height;
 return {...start,zoom,x:Math.abs(box.width-next.width)<.001?.5:clamp((left-box.x)/(box.width-next.width)),y:Math.abs(box.height-next.height)<.001?.5:clamp((top-box.y)/(box.height-next.height))};
}
