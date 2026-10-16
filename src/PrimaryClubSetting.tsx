import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
export function PrimaryClubSetting({client,clubs,value}:{client:SupabaseClient;clubs:ClubAccess[];value:string}){
 const [selected,setSelected]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>setSelected(value),[value]);
 async function save(){setBusy(true);setError('');setSaved(false);try{if(selected&&!clubs.some(c=>c.id===selected))throw new Error();const {error}=await client.auth.updateUser({data:{primary_club_id:selected||null}});if(error)throw error;setSaved(true)}catch{setError('Primární klub nelze uložit. Zkuste to znovu.')}finally{setBusy(false)}}
 return <section className="settings-panel" aria-label="Primární klub"><h2>Primární klub</h2><p className="muted">Tento klub se otevře při každém vstupu do aplikace. Ostatní kluby můžete vybrat v horním přepínači.</p><label>Primární klub<select aria-label="Primární klub" disabled={busy} value={clubs.some(c=>c.id===selected)?selected:''} onChange={e=>{setSelected(e.target.value);setSaved(false)}}><option value="">Bez primárního klubu</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="primary" disabled={busy||selected===value} onClick={()=>void save()}>{busy?'Ukládám…':'Uložit primární klub'}</button>{error&&<p className="auth-error" role="alert">{error}</p>}{saved&&<p className="notice" role="status">Primární klub byl uložený.</p>}</section>;
}
