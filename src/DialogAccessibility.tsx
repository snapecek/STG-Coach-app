import {useEffect} from 'react';

const selector='[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]';
const controls='button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
function visible(element:HTMLElement){return !!element.getClientRects().length&&!element.closest('[inert],[hidden]')}
function topDialog(){
 // Native share dialogs manage their own top layer and focus.
 if(document.querySelector('dialog[open]'))return null;
 return [...document.querySelectorAll<HTMLElement>(selector)].filter(visible).map((element,index)=>{
  let z=0;for(let node:HTMLElement|null=element;node;node=node.parentElement)z=Math.max(z,Number.parseInt(getComputedStyle(node).zIndex)||0);
  return {element,index,z};
 }).sort((a,b)=>a.z-b.z||a.index-b.index).at(-1)?.element||null;
}
export function DialogAccessibility(){
 useEffect(()=>{
  const previous=new Map<HTMLElement,HTMLElement|null>();let active:HTMLElement|null=null;
  const focus=(dialog:HTMLElement)=>{dialog.tabIndex=-1;(dialog.querySelector<HTMLElement>('[autofocus]')||[...dialog.querySelectorAll<HTMLElement>(controls)].find(visible)||dialog).focus()};
  const sync=()=>{
   for(const [dialog,trigger] of previous)if(!dialog.isConnected){previous.delete(dialog);if(trigger?.isConnected)trigger.focus()}
   const next=topDialog();if(next===active)return;
   active=next;if(!next)return;
   if(!previous.has(next))previous.set(next,document.activeElement instanceof HTMLElement?document.activeElement:null);
   if(!next.contains(document.activeElement))focus(next);
  };
  const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});sync();
  const key=(event:KeyboardEvent)=>{
   const dialog=topDialog();if(!dialog||event.defaultPrevented)return;
   // This older dialog already handles both keys and will be migrated separately.
   if(dialog.classList.contains('fees-dialog'))return;
   if(event.key==='Escape'){
    const close=dialog.querySelector<HTMLButtonElement>('[data-dialog-close],button.close,button[aria-label^="Zavřít"]')||[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button=>/^(Zpět|Zrušit)$/.test(button.textContent?.trim()||''));
    if(close){event.preventDefault();event.stopImmediatePropagation();if(!close.disabled)close.click()}
   }else if(event.key==='Tab'){
    const nodes=[...dialog.querySelectorAll<HTMLElement>(controls)].filter(visible),first=nodes[0],last=nodes.at(-1);
    if(!first){event.preventDefault();dialog.focus()}
    else if(event.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement as HTMLElement))){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement as HTMLElement))){event.preventDefault();first.focus()}
   }
  };
  const contain=()=>{const dialog=topDialog();if(dialog&&!dialog.contains(document.activeElement))focus(dialog)};
  document.addEventListener('keydown',key,true);document.addEventListener('focusin',contain);
  return()=>{observer.disconnect();document.removeEventListener('keydown',key,true);document.removeEventListener('focusin',contain)};
 },[]);
 return null;
}
