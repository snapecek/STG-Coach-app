import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

// Keep viewport positioning outside the scrolling app shell. Only the body scrolls.
export function EventDialog({label,member=false,busy=false,fullHeight=false,onClose,children}:{label:string;member?:boolean;busy?:boolean;fullHeight?:boolean;onClose:()=>void;children:ReactNode}){
 const close=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  if(!trigger.current)trigger.current=document.activeElement as HTMLElement|null;
  const target=trigger.current;
  close.current?.focus({preventScroll:true});
  return()=>{queueMicrotask(()=>{if(target?.isConnected&&!document.querySelector('.event-dialog'))target.focus({preventScroll:true})})};
 },[]);
 return createPortal(<div className={'overlay event-dialog-overlay'+(member?' member-dashboard':'')} onClick={()=>{if(!busy)onClose()}}><div className={'dialog event-dialog'+(member?' member-detail-dialog':'')+(fullHeight?' event-dialog-full':'')} role="dialog" aria-modal="true" aria-label={label} onClick={e=>e.stopPropagation()}>
  <div className="event-dialog-toolbar"><button ref={close} type="button" className="close" disabled={busy} aria-label="Zavřít" onClick={onClose}><X size={19}/><span>Zavřít</span></button></div>
  <div className="event-dialog-body">{children}</div>
 </div></div>,document.body);
}
