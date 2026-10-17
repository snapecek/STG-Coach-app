import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

export function JournalShareDialog({open,onClose,children}:{open:boolean;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const element=dialog.current;
  if(!open||!element)return;
  const trigger=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  element.showModal();document.body.style.overflow='hidden';
  return()=>{element.close();document.body.style.overflow=overflow;trigger?.focus()};
 },[open]);
 return createPortal(<dialog ref={dialog} className="journal-share-dialog" aria-label="Sdílet trénink" onCancel={e=>{e.preventDefault();onClose()}}>
  <div className="journal-share-dialog-toolbar"><button type="button" aria-label="Zavřít sdílení tréninku" onClick={onClose}><X size={18}/> Zavřít</button></div>
  {open&&children}
 </dialog>,document.body);
}
