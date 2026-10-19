import {useState} from 'react';
import {release} from './clientDiagnostics';

// Read only a fixed list of display properties: no URLs, storage, form values,
// club/member text, session information or automatic network reporting.
function displaySnapshot(){
 const probe=document.createElement('div');
 probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)';
 document.body.append(probe);const insets=getComputedStyle(probe),safeArea={top:insets.paddingTop,bottom:insets.paddingBottom};probe.remove();
 const box=(selector:string)=>{const r=document.querySelector(selector)?.getBoundingClientRect();return r?{top:r.top,left:r.left,width:r.width,height:r.height}:null};
 const layers=[];
 for(let el=document.querySelector('.workspace-header');el;el=el.parentElement){
  const s=getComputedStyle(el);layers.push({tag:el.tagName,position:s.position,paddingTop:s.paddingTop,filter:s.filter,backdropFilter:s.backdropFilter||s.getPropertyValue('-webkit-backdrop-filter'),transform:s.transform,opacity:s.opacity,overflowY:s.overflowY});
 }
 const view=window.visualViewport;
 return JSON.stringify({release,userAgent:navigator.userAgent,theme:document.documentElement.dataset.theme,
  standalone:matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true,
  declaredStatusBar:document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')||null,
  viewportMeta:document.querySelector('meta[name="viewport"]')?.getAttribute('content')||null,
  viewport:{width:innerWidth,height:innerHeight,scale:view?.scale,visualHeight:view?.height,offsetTop:view?.offsetTop,devicePixelRatio},
  safeArea,header:box('.workspace-header'),logo:box('.workspace-brand'),layers,
  scroll:{document:scrollY,workspace:document.querySelector('.workspace-scroll')?.scrollTop},
 },null,2);
}

export function DisplayDiagnostics(){
 const [snapshot,setSnapshot]=useState(''),[message,setMessage]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(snapshot);setMessage('Údaje jsou zkopírované.')}catch{setMessage('Kopírování prohlížeč nepovolil. Označte a zkopírujte text z pole.')}}
 return <section className="display-diagnostics"><button type="button" onClick={()=>{setSnapshot(displaySnapshot());setMessage('')}}>Zobrazit údaje o zobrazení</button>
  {snapshot&&<><p>Údaje pro řešení potíží s rozmazáním a rozložením. Neobsahují jméno, zprávy ani přihlašovací údaje. Odesílají se pouze tehdy, když je sami někomu předáte.</p><textarea readOnly aria-label="Údaje o zobrazení" value={snapshot} rows={8}/><button type="button" onClick={()=>void copy()}>Zkopírovat údaje o zobrazení</button>{message&&<p role="status">{message}</p>}</>}
 </section>;
}
