import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {headerPopoverPosition} from './headerPopoverPosition';

export function WorkspaceHeader({children}:{children:ReactNode}){
 const root=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return;
  let alive=true;
  const measure=()=>{
   if(!alive)return;
   document.documentElement.style.setProperty('--workspace-header-height',Math.ceil(element.getBoundingClientRect().height)+'px');
   const vv=window.visualViewport,mobile=matchMedia('(max-width:900px)').matches;
   const footer=mobile?document.querySelector('.workspace-nav:not(:empty)')?.getBoundingClientRect():undefined;
   const bottom=Math.min((vv?.offsetTop||0)+(vv?.height||innerHeight)-12,footer&&footer.height>0?footer.top-8:Infinity);
   for(const host of element.querySelectorAll<HTMLElement>('.notification-bell,.club-switcher,.user-menu')){
    if(host.matches('details:not([open])'))continue;
    const trigger=host.querySelector<HTMLElement>(':scope > button,:scope > summary'),panel=host.querySelector<HTMLElement>(':scope > .notification-panel,:scope > .club-switcher-panel,:scope > .user-menu-panel');
    if(!trigger||!panel)continue;
    const p=headerPopoverPosition({trigger:trigger.getBoundingClientRect(),host:host.getBoundingClientRect(),viewport:{left:vv?.offsetLeft||0,width:vv?.width||document.documentElement.clientWidth},preferredWidth:parseFloat(getComputedStyle(panel).getPropertyValue('--popup-preferred-width'))||320,bottom,gutter:mobile?17:12});
    for(const [key,value] of Object.entries({left:p.left,top:p.top,width:p.width,'max-height':p.maxHeight}))panel.style.setProperty('--popup-'+key,value+'px');
    panel.dataset.anchorSide=p.side;
   }
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  const mutations=new MutationObserver(measure);mutations.observe(element,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);void document.fonts.ready.then(measure);
  return()=>{alive=false;observer.disconnect();mutations.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);document.documentElement.style.removeProperty('--workspace-header-height')};
 },[]);
 return <header className="workspace-header" aria-label="Klub a účet" ref={root}>{children}</header>;
}
