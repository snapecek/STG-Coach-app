import type {GraphicBox} from './journalShareLayouts';
export type PhotoCrop={x:number;y:number;zoom:number};
export type PhotoSize={width:number;height:number};
export type Point={x:number;y:number};
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
export function photoPlacement(box:GraphicBox,photo:PhotoSize,fit:'contain'|'cover',crop:PhotoCrop){
 const scale=(fit==='contain'?Math.min:Math.max)(box.width/photo.width,box.height/photo.height)*clamp(crop.zoom,1,3),width=photo.width*scale,height=photo.height*scale;
 return {x:box.x+(box.width-width)*clamp(crop.x),y:box.y+(box.height-height)*clamp(crop.y),width,height};
}
/** Keep the touched source point under the fingers while zooming and panning. */
export function gestureCrop(box:GraphicBox,photo:PhotoSize,fit:'contain'|'cover',start:PhotoCrop,from:Point,to:Point,zoomRatio=1):PhotoCrop{
 const old=photoPlacement(box,photo,fit,start),zoom=clamp(start.zoom*zoomRatio,1,3),next=photoPlacement(box,photo,fit,{...start,zoom});
 const left=to.x-(from.x-old.x)/old.width*next.width,top=to.y-(from.y-old.y)/old.height*next.height;
 return {zoom,x:Math.abs(box.width-next.width)<.001?.5:clamp((left-box.x)/(box.width-next.width)),y:Math.abs(box.height-next.height)<.001?.5:clamp((top-box.y)/(box.height-next.height))};
}
