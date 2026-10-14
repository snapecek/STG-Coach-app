import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
function ActiveEventReminder({client,club,eventId}:{client:SupabaseClient;club:ClubAccess;eventId:string}){
 const [preview,setPreview]=useState<{eligible:number;skipped:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 async function run(action:'preview'|'send'){setBusy(true);setError('');setResult('');try{const {data,error}=await client.functions.invoke('remind-event',{body:{clubId:club.id,eventId,action}});if(error){let message='E-mailová připomenutí zatím nejsou dostupná. Správce musí nasadit funkci remind-event a nastavit odesílání.';try{const response=await error.context?.json();if(response?.error)message=response.error}catch{}throw new Error(message)}if(action==='preview')setPreview(data);else{setResult(`Přijato k odeslání: ${data.accepted}. Neúspěšné: ${data.failed}. Bez ověřeného e-mailu: ${data.skipped}. Přijetí službou ještě nepotvrzuje doručení do schránky.`);setPreview(null)}}catch(e){setError(e instanceof Error?e.message:'Připomenutí nelze odeslat.')}finally{setBusy(false)}}
 return <div className="email-reminder"><button disabled={busy} onClick={()=>void run('preview')}>{busy?'Připravuji…':'Připomenout e-mailem'}</button>{preview&&<div className="reminder-preview"><p>E-mail dostane {preview.eligible} členů bez odpovědi. Bez propojeného ověřeného e-mailu: {preview.skipped}.</p><p className="muted">Při potvrzení se seznam znovu ověří. Stejné připomenutí se při opakování tentýž den neposílá znovu.</p><button disabled={busy||!preview.eligible} className="primary" onClick={()=>void run('send')}>Odeslat připomenutí</button><button disabled={busy} onClick={()=>setPreview(null)}>Zpět</button></div>}{error&&<p role="alert">{error}</p>}{result&&<p role="status">{result}</p>}</div>;
}

export function EventReminder(props:{client:SupabaseClient;club:ClubAccess;eventId:string}){
 if(import.meta.env.VITE_EVENT_REMINDERS_ENABLED!=='true')return <div className="email-reminder"><button disabled title="Aktivujeme při dalším upgradu po nastavení odesílání.">Připomenout e-mailem</button><small className="muted">Připravujeme pro další upgrade</small></div>;
 return <ActiveEventReminder {...props}/>;
}
