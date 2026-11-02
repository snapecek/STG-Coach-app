import {useState} from 'react';
import {normalizeRaceGuests,type RaceGuestDraft} from './raceGuests';

export function NewRaceGuest({busy,existingNames,onAdd,onPendingChange}:{busy:boolean;existingNames:string[];onAdd:(guest:RaceGuestDraft)=>Promise<boolean>;onPendingChange?:(pending:boolean)=>void}){
 const [name,setName]=useState(''),[role,setRole]=useState<RaceGuestDraft['role']>('yes'),[error,setError]=useState('');
 async function add(){
  setError('');
  try{
   const [guest]=normalizeRaceGuests([{name,role}]);
   if(existingNames.some(n=>n.trim().replace(/\s+/g,' ').toLocaleLowerCase('cs')===guest.name.toLocaleLowerCase('cs')))throw new Error('Toto jméno už je v evidenci nebo ve výběru. Vyberte uloženého hosta, případně jméno rozlište.');
   if(await onAdd(guest)){setName('');onPendingChange?.(false)}
  }catch(e){setError(e instanceof Error?e.message:'Hosta nelze přidat.')}
 }
 return <section className="new-race-guest" aria-label="Nový host závodu" data-unsaved-changes={!!name.trim()||undefined} data-auto-refresh-blocked={!!name.trim()||undefined}><h4>Přidat hosta do závodu</h4><p className="muted">Host nepotřebuje účet a zůstane v evidenci pro příště. Jeho skutečnou docházku potvrdíte zvlášť.</p><fieldset disabled={busy}><div className="form-grid"><label>Jméno hosta<input aria-label="Jméno hosta závodu" maxLength={80} value={name} onChange={e=>{setName(e.target.value);onPendingChange?.(!!e.target.value.trim())}}/></label><label>Role hosta<select aria-label="Role hosta závodu" value={role} onChange={e=>setRole(e.target.value as RaceGuestDraft['role'])}><option value="yes">Závodník</option><option value="companion">Doprovod</option></select></label></div><button type="button" className="primary" disabled={busy||!name.trim()} onClick={()=>void add()}>Přidat hosta do závodu</button></fieldset>{error&&<p role="alert" className="auth-error">{error}</p>}</section>;
}
