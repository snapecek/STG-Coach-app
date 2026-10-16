import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {settingsRpc} from './clubSettings';
type ArchivedClub={archive_id:string;club_id:string;name:string;archived_at:string;expires_at:string};
export function ClubArchiveRecovery({client,version,onRestored}:{client:SupabaseClient;version:number;onRestored:(club:ClubAccess)=>void}){const [rows,setRows]=useState<ArchivedClub[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);const lock=useRef(false);
 useEffect(()=>{let alive=true;void Promise.resolve(client.rpc('list_archived_clubs')).then(({data,error})=>{if(alive)setRows(error?[]:data||[])}).catch(()=>{if(alive)setRows([])});return()=>{alive=false}},[client,version,refresh]);
 async function restore(id:string){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const restored=await settingsRpc<{id:string;name:string}[]>(client,'restore_archived_club',{target_archive:id});if(!restored[0])throw new Error('Klub nelze obnovit.');setRows(r=>r.filter(row=>row.archive_id!==id));onRestored({...restored[0],role:'owner'});setRefresh(v=>v+1)}catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}}
 if(!rows.length&&!error)return null;return <section className="archived-clubs settings-panel" aria-label="Archivované kluby"><h2>Archivované kluby</h2>{error&&<p className="auth-error" role="alert">{error}</p>}{rows.map(row=><div className="archived-club-row" key={row.archive_id}><div><b>{row.name}</b><small>Obnova je možná do {new Date(row.expires_at).toLocaleDateString('cs-CZ',{timeZone:'Europe/Prague'})}.</small></div><button disabled={busy} onClick={()=>void restore(row.archive_id)}>Obnovit klub</button></div>)}</section>;
}
