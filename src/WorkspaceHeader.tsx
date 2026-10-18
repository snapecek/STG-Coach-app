import {useLayoutEffect,useRef,type ReactNode} from 'react';

export function WorkspaceHeader({children}:{children:ReactNode}){
 const root=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return;
  const measure=()=>document.documentElement.style.setProperty('--workspace-header-height',Math.ceil(element.getBoundingClientRect().height)+'px');
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>{observer.disconnect();document.documentElement.style.removeProperty('--workspace-header-height')};
 },[]);
 return <header className="workspace-header" aria-label="Klub a účet" ref={root}>{children}</header>;
}
