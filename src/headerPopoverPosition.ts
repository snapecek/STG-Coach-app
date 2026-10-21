export function headerPopoverPosition({trigger,host,viewport,preferredWidth,bottom,gutter=12}:{trigger:{left:number;right:number;bottom:number};host:{left:number;top:number};viewport:{left:number;width:number};preferredWidth:number;bottom:number;gutter?:number}){
 const width=Math.min(preferredWidth,Math.max(0,viewport.width-2*gutter));
 const side=(trigger.left+trigger.right)/2<viewport.left+viewport.width/2?'left':'right';
 const desired=side==='left'?trigger.left:trigger.right-width;
 const left=Math.max(viewport.left+gutter,Math.min(desired,viewport.left+viewport.width-gutter-width));
 return {side,width,left:left-host.left,top:trigger.bottom-host.top+8,maxHeight:Math.max(0,bottom-trigger.bottom-8)};
}
