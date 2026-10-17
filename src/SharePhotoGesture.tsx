import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {sharePhotoClipStyle,type GraphicBox} from './journalShareLayouts';
import type {ShareTemplate} from './journalShare';
import {gestureCrop,type PhotoCrop,type PhotoSize,type Point} from './sharePhotoTransform';
type Touch={id:number;point:Point};
export function SharePhotoGesture({box,width,height,photo,fit,crop,onChange,template}:{box:GraphicBox;width:number;height:number;photo:string;fit:'contain'|'cover';crop:PhotoCrop;onChange:(crop:PhotoCrop)=>void;template:ShareTemplate}){
 const [size,setSize]=useState<PhotoSize|null>(null),[active,setActive]=useState(false);
 const touches=useRef(new Map<number,Point>()),current=useRef(crop),baseline=useRef<{crop:PhotoCrop;touches:Touch[]}|null>(null);current.current=crop;
 useEffect(()=>{let alive=true;setSize(null);const image=new Image();image.src=photo;void image.decode().then(()=>{if(alive)setSize({width:image.naturalWidth,height:image.naturalHeight})}).catch(()=>{});return()=>{alive=false}},[photo]);
 useEffect(()=>{touches.current.clear();baseline.current=null;setActive(false)},[photo,box.x,box.y,box.width,box.height,fit,template]);
 function reset(){baseline.current={crop:current.current,touches:[...touches.current].map(([id,point])=>({id,point}))}}
 function point(e:PointerEvent<HTMLDivElement>){const rect=e.currentTarget.getBoundingClientRect();return {x:box.x+(e.clientX-rect.left)/rect.width*box.width,y:box.y+(e.clientY-rect.top)/rect.height*box.height}}
 const center=(p:Point[])=>({x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length});
 function move(e:PointerEvent<HTMLDivElement>){if(!size||!touches.current.has(e.pointerId))return;e.preventDefault();touches.current.set(e.pointerId,point(e));const start=baseline.current;if(!start?.touches.length)return;const before=start.touches.slice(0,2).map(t=>t.point),after=start.touches.slice(0,2).map(t=>touches.current.get(t.id)!);if(after.some(p=>!p))return;
  const distance=(p:Point[])=>Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),ratio=before.length===2?distance(after)/Math.max(1,distance(before)):1;
  const next=gestureCrop(box,size,fit,start.crop,center(before),center(after),ratio);current.current=next;onChange(next);
 }
 function end(e:PointerEvent<HTMLDivElement>){touches.current.delete(e.pointerId);reset();setActive(touches.current.size>0)}
 return <div className={'share-photo-gesture'+(active?' is-dragging':'')} role="group" aria-label="Upravit výřez fotografie dotykem" aria-describedby="share-touch-help" tabIndex={0} style={{left:box.x/width*100+'%',top:box.y/height*100+'%',width:box.width/width*100+'%',height:box.height/height*100+'%',...sharePhotoClipStyle(template,fit)}}
  onPointerDown={e=>{if(!size)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touches.current.set(e.pointerId,point(e));reset();setActive(true)}} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
  onKeyDown={e=>{if(!size)return;const directions:Record<string,Point>={ArrowLeft:{x:-30,y:0},ArrowRight:{x:30,y:0},ArrowUp:{x:0,y:-30},ArrowDown:{x:0,y:30}};const delta=directions[e.key];if(delta||e.key==='+'||e.key==='-'){e.preventDefault();const middle={x:box.x+box.width/2,y:box.y+box.height/2};const next=gestureCrop(box,size,fit,current.current,middle,{x:middle.x+(delta?.x??0),y:middle.y+(delta?.y??0)},e.key==='+'?1.1:e.key==='-'?1/1.1:1);current.current=next;onChange(next)}}}/>
}
