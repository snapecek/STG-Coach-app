import {useEffect,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';

let pending:(()=>void)|null=null;
const listeners=new Set<()=>void>();
function emit(){listeners.forEach(listener=>listener())}
export function requestLeave(action:()=>void){
 if(!document.querySelector('[data-unsaved-changes="true"]')){action();return}
 pending=action;emit();
}
export function UnsavedChangesPrompt(){
 const action=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>pending);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(document.querySelector('[data-unsaved-changes="true"]')){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
 if(!action)return null;
 return createPortal(<div className="overlay discard-overlay"><div className="dialog" role="alertdialog" aria-modal="true" aria-label="Zahodit neuložené změny?">
  <h2>Zahodit neuložené změny?</h2><p>Máte rozepsané změny. Při odchodu se neuloží.</p><div className="confirmation-actions">
   <button data-dialog-close onClick={()=>{pending=null;emit()}}>Pokračovat v úpravě</button>
   <button className="primary danger" onClick={()=>{pending=null;emit();action()}}>Zahodit změny</button>
  </div>
 </div></div>,document.body);
}
