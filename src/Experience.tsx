import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
export type ViewMode='basic'|'advanced';
export function useExperience(client:SupabaseClient,user:User|null|undefined){
 const [metadata,setMetadata]=useState<Record<string,unknown>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const identity=useRef(user?.id),lock=useRef(false);identity.current=user?.id;
 useEffect(()=>{setMetadata(user?.user_metadata||{});setError('')},[user?.id,user?.user_metadata]);
 async function save(patch:Record<string,unknown>){
  if(lock.current||!user)return false;lock.current=true;setBusy(true);setError('');const id=user.id;
  try{
   const current=await client.auth.getUser();if(current.error||current.data.user?.id!==id||identity.current!==id)throw new Error();
   const result=await client.auth.updateUser({data:patch});if(result.error||result.data.user?.id!==id)throw new Error();
   if(identity.current===id)setMetadata(result.data.user.user_metadata);return identity.current===id;
  }catch{if(identity.current===id)setError('Nastavení se nepodařilo uložit. Zkuste to znovu.');return false}
  finally{lock.current=false;setBusy(false)}
 }
 return {mode:metadata.coach_view==='advanced'?'advanced' as const:'basic' as const,metadata,busy,error,save};
}
export type Experience=ReturnType<typeof useExperience>;
export function ViewModeSwitch({mode,busy,onChange}:{mode:ViewMode;busy:boolean;onChange:(mode:ViewMode)=>void}){
 return <div className="view-mode-toolbar"><div className="view-mode-switch" role="group" aria-label="Rozsah zobrazení">{([{id:'basic',name:'Základní'},{id:'advanced',name:'Pokročilý'}] as const).map(item=><button key={item.id} disabled={busy} aria-pressed={mode===item.id} onClick={()=>onChange(item.id)}>{item.name}</button>)}</div></div>;
}
export function FirstSteps({role,experience,steps}:{role:'coach'|'member';experience:Experience;steps:{label:string;description:string;done?:boolean;action:()=>void}[]}){
 const [expanded,setExpanded]=useState(false);
 if(experience.metadata['onboarding_'+role+'_done']===true)return null;
 return <section className="first-steps" aria-label="První kroky"><div className="panel-title"><h2>Začněte v Trenomi</h2><button className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Sbalit':'Ukázat postup'}</button></div>{expanded?<><ol>{steps.map(step=><li key={step.label}><button onClick={step.action}><b>{step.done?'✓ ':''}{step.label}</b><small>{step.description}</small></button></li>)}</ol><button className="text-button" disabled={experience.busy} onClick={()=>void experience.save({['onboarding_'+role+'_done']:true})}>Průvodce mám hotový</button></>:<p className="muted">{role==='coach'?'Členové → událost → docházka a deník.':'Otevřete událost a potvrďte, zda přijdete.'}</p>}</section>;
}
