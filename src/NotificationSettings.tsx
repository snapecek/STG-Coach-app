import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import type {Experience} from './Experience';
import {missingWorkspaceMigration} from './workspaceSync';
type Status={email_cron:boolean|null;push_cron:boolean|null;email_pending:number;email_sent:number;email_failed:number;push_pending:number;push_processed:number};
export function NotificationSettings({client,club,experience}:{client:SupabaseClient;club:ClubAccess;experience:Experience}){
 const [pending,setPending]=useState<boolean|null>(null);
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(true),[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const staff=club.role==='owner'||club.role==='coach';
 useEffect(()=>{
  let alive=true;setReady(false);setStatus(null);setLoading(true);setError('');
  Promise.all([client.rpc('notification_preferences_ready'),staff?client.rpc('club_notification_status',{target_club:club.id}):Promise.resolve(null)]).then(([capability,result])=>{
   if(!alive)return;
   if(capability.error&&!missingWorkspaceMigration(capability.error))throw new Error('Stav oznámení nelze ověřit.');
   setReady(capability.data===true);
   if(result?.error&&!missingWorkspaceMigration(result.error))throw new Error('Stav odesílání nelze načíst.');
   if(result&&!result.error)setStatus(result.data as Status);
  }).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[client,club.id,staff]);
 async function refresh(){setLoading(true);setError('');try{const result=await client.rpc('club_notification_status',{target_club:club.id});if(result.error)throw new Error();setStatus(result.data as Status)}catch{setError('Stav odesílání nelze načíst. Zkuste to znovu.')}finally{setLoading(false)}}
 const enabled=experience.metadata.rsvp_email_enabled!==false;
 const cronLabel=(value:boolean|null)=>value===true?'Zapnuté':value===false?'Vypnuté':'Nelze ověřit';
 return <section className="settings-panel notification-state" aria-label="Oznámení a e-maily"><h2>Oznámení a e-maily</h2><p className="muted">Zprávy, zmínky a nevyřízené položky najdete pod zvonečkem v aplikaci.</p><label className="checkbox-label"><input type="checkbox" checked={pending??enabled} disabled={!ready||loading||experience.busy||pending!==null} onChange={e=>{const value=e.target.checked;setPending(value);setNotice('');void experience.save({rsvp_email_enabled:value}).then(ok=>{if(ok)setNotice(value?'E-mailové připomínky jsou zapnuté.':'E-mailové připomínky jsou vypnuté.')}).finally(()=>setPending(null))}}/>E-mail 24 hodin před událostí, pokud jsem nevyplnil/a účast</label><p className="muted">Platí pro vaše členství ve všech klubech. Potvrzená odpověď připomínku zastaví. Pozvánky a obnovu hesla toto nastavení neovlivňuje.</p>{!loading&&!ready&&!error&&<p className="muted">Osobní nastavení e-mailových připomínek ještě není dostupné.</p>}{staff&&status&&<details><summary>Stav odesílání klubu</summary><dl><dt>E-mailový plánovač</dt><dd>{cronLabel(status.email_cron)}</dd><dt>Plánovač mobilních oznámení</dt><dd>{cronLabel(status.push_cron)}</dd><dt>E-maily čekající na zpracování</dt><dd>{status.email_pending}</dd><dt>Předáno e-mailové službě za 7 dní</dt><dd>{status.email_sent}</dd><dt>Neúspěšné e-maily za 7 dní</dt><dd>{status.email_failed}</dd><dt>Mobilní oznámení ve frontě</dt><dd>{status.push_pending}</dd><dt>Zpracovaná mobilní oznámení za 7 dní</dt><dd>{status.push_processed}</dd></dl><p className="muted">Zpracování fronty ani předání e-mailové službě nepotvrzuje doručení příjemci. Nastavení a dostupnost odesílací služby se zde neověřují.</p></details>}{loading&&<p role="status">Ověřuji nastavení oznámení…</p>}{error&&<p role="alert" className="auth-error">{error}</p>}{staff&&<button className="text-button" disabled={loading} onClick={()=>void refresh()}>Obnovit stav oznámení</button>}{notice&&<p role="status">{notice}</p>}</section>;
}
