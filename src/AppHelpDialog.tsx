import {isNativeApp} from './nativePlatform';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BookOpen,X} from 'lucide-react';
import {findHelpTopics,helpSteps,type HelpRole} from './appHelp';
import {DisplayDiagnostics} from './DisplayDiagnostics';

export function AppHelp({initialRole,onClose,returnFocus}:{initialRole:HelpRole;onClose:()=>void;returnFocus?:HTMLElement|null}){
 const [role,setRole]=useState(initialRole),[search,setSearch]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),content=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  const trigger=returnFocus||document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  element.showModal();document.body.style.overflow='hidden';
  return()=>{element.close();document.body.style.overflow=overflow;trigger?.focus({preventScroll:true})};
 },[returnFocus]);
 const topics=findHelpTopics(role,search),searching=!!search.trim();
 function switchRole(next:HelpRole){setRole(next);setSearch('');content.current?.scrollTo(0,0)}
 return createPortal(<dialog className="app-help-dialog" ref={dialog} aria-labelledby="app-help-title" aria-describedby="app-help-intro" onCancel={e=>{e.preventDefault();onClose()}}>
  <header className="app-help-heading"><div><BookOpen size={22} aria-hidden="true"/><h2 id="app-help-title">Návod k používání Trenomi</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Zavřít návod"><X size={20}/></button></header>
  <div className="app-help-controls"><p id="app-help-intro">Vyberte si svůj pohled. Klepnutím na téma otevřete stručný postup a tipy.</p><div className="app-help-roles" role="tablist" aria-label="Návod podle role" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'member':e.key==='End'?'coach':role==='member'?'coach':'member';switchRole(next);document.getElementById('help-tab-'+next)?.focus()}}>{(['member','coach'] as const).map(r=><button type="button" key={r} role="tab" id={'help-tab-'+r} aria-selected={role===r} tabIndex={role===r?0:-1} aria-controls="app-help-topics" onClick={()=>switchRole(r)}>{r==='member'?'Pro člena':'Pro trenéra'}</button>)}</div><label>Najít v návodu<input type="search" value={search} placeholder="Např. host, docházka, příspěvky…" onChange={e=>{setSearch(e.target.value);content.current?.scrollTo(0,0)}}/></label></div>
  <div className="app-help-content" ref={content}><div role="tabpanel" id="app-help-topics" aria-labelledby={'help-tab-'+role}>
   {!searching&&<section className="app-help-start"><h3>{role==='member'?'Jak začít jako člen':'Běžný postup trenéra'}</h3><ol>{helpSteps[role].map(step=><li key={step}>{step}</li>)}</ol></section>}
   {searching&&<p role="status" className="app-help-results">{topics.length?`Nalezená témata: ${topics.length}`:'Žádné téma neodpovídá hledání. Zkuste kratší výraz nebo přepněte pohled.'} <button type="button" className="text-button" onClick={()=>setSearch('')}>Vymazat hledání</button></p>}
   {topics.map(topic=><details className="app-help-topic" key={role+':'+topic.id} open={searching||undefined}><summary>{topic.title}</summary><div><p>{topic.summary}</p><ul>{topic.items.map(item=><li key={item}>{item}</li>)}</ul>{topic.note&&<p className="app-help-note"><strong>Na co si dát pozor: </strong>{topic.note}</p>}</div></details>)}
  </div><footer className="app-help-links"><h3>Další návody</h3>{!isNativeApp()&&<a href="/navod-na-plochu.html" target="_blank" rel="noopener noreferrer">Přidat Trenomi na plochu — iPhone a Android ↗</a>}<a href="/navod-clenove.html" target="_blank" rel="noopener noreferrer">Obrázkový návod k registraci a vstupu do klubu ↗</a><p>Nenašli jste odpověď? Členství a docházku řešte s trenérem. Chybu nebo nápad pošlete přes Můj účet → Nápověda → Podněty k aplikaci.</p><DisplayDiagnostics/></footer></div>
 </dialog>,document.body);
}
