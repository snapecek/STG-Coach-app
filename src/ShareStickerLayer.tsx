import {useRef,type PointerEvent} from 'react';
import {safeSticker,stickerKinds,stickerSize,type ShareSticker} from './shareStickers';
export function ShareStickerLayer({stickers,width,height,selected,onSelect,onChange}:{stickers:ShareSticker[];width:number;height:number;selected:string;onSelect:(id:string)=>void;onChange:(s:ShareSticker)=>void}){
 const pointers=useRef(new Map<number,{x:number;y:number}>()),base=useRef<{s:ShareSticker;points:{x:number;y:number}[];mode:'move'|'transform'}|null>(null);
 function point(e:PointerEvent<HTMLElement>){const b=e.currentTarget.closest('.share-preview-stage')!.getBoundingClientRect();return {x:(e.clientX-b.left)/b.width*width,y:(e.clientY-b.top)/b.height*height}}
 const midpoint=(p:{x:number;y:number}[])=>({x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length});
 function down(e:PointerEvent<HTMLElement>,s:ShareSticker,mode:'move'|'transform'){e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);onSelect(s.id);pointers.current.set(e.pointerId,point(e));base.current={s,points:[...pointers.current.values()],mode}}
 function move(e:PointerEvent<HTMLElement>){const start=base.current;if(!start||!pointers.current.has(e.pointerId))return;e.preventDefault();e.stopPropagation();pointers.current.set(e.pointerId,point(e));const after=[...pointers.current.values()],before=start.points;if(after.length!==before.length)return;const a=midpoint(before),b=midpoint(after),s=start.s;
  if(after.length>1||start.mode==='transform'){
   const from=before.length>1?{x:before[1].x-before[0].x,y:before[1].y-before[0].y}:{x:a.x-s.x*width,y:a.y-s.y*height};const to=after.length>1?{x:after[1].x-after[0].x,y:after[1].y-after[0].y}:{x:b.x-s.x*width,y:b.y-s.y*height};
   onChange(safeSticker({...s,x:s.x+(after.length>1?(b.x-a.x)/width:0),y:s.y+(after.length>1?(b.y-a.y)/height:0),scale:s.scale*Math.hypot(to.x,to.y)/Math.max(1,Math.hypot(from.x,from.y)),rotation:s.rotation+(Math.atan2(to.y,to.x)-Math.atan2(from.y,from.x))*180/Math.PI}));
  }else onChange(safeSticker({...s,x:s.x+(b.x-a.x)/width,y:s.y+(b.y-a.y)/height}));
 }
 function end(e:PointerEvent<HTMLElement>){pointers.current.delete(e.pointerId);base.current=null;pointers.current.clear()}
 return <>{stickers.map(s=>{const size=stickerSize(s.kind);return <div key={s.id} role="button" aria-label={'Posunout samolepku: '+stickerKinds.find(k=>k.id===s.kind)!.name} aria-pressed={selected===s.id} tabIndex={0} className={'share-sticker-hit '+(selected===s.id?'selected':'')} style={{left:s.x*100+'%',top:s.y*100+'%',width:size.width*s.scale/width*100+'%',height:size.height*s.scale/height*100+'%',transform:`translate(-50%,-50%) rotate(${s.rotation}deg)`}} onFocus={()=>onSelect(s.id)} onPointerDown={e=>down(e,s,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{const d:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};if(d[e.key]){e.preventDefault();onChange(safeSticker({...s,x:s.x+d[e.key][0]/width,y:s.y+d[e.key][1]/height}))}}}>
 {selected===s.id&&<button className="share-sticker-handle" aria-label="Zvětšit a otočit samolepku" onPointerDown={e=>down(e,s,'transform')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>↗</button>}
 </div>})}</>;
}
