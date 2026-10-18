import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {loadClubData,type ClubData} from './clubData';
export type WorkspaceChange={kind:string;key:string;row:Record<string,unknown>|null};
export type WorkspaceDelta={cursor:string;reset:boolean;changes:WorkspaceChange[]};
export const missingWorkspaceMigration=(error:{code?:string}|null)=>['PGRST202','42883'].includes(error?.code||'');
export async function readWorkspaceChanges(client:SupabaseClient,clubId:string,cursor:string|null,signal?:AbortSignal):Promise<WorkspaceDelta|null>{
 const query=client.rpc('club_workspace_changes',{target_club:clubId,after_cursor:cursor});
 const {data,error}=await (signal?query.abortSignal(signal):query);
 if(missingWorkspaceMigration(error))return null;
 if(error)throw new Error('Změny klubu nelze načíst. Zkontrolujte připojení a oprávnění.');
 if(!data||typeof data.cursor!=='string'||!/^\d+$/.test(data.cursor)||typeof data.reset!=='boolean'||!Array.isArray(data.changes))throw new Error('Neplatná odpověď synchronizace.');
 return data as WorkspaceDelta;
}
export async function loadWorkspaceData(client:SupabaseClient,club:ClubAccess,signal?:AbortSignal):Promise<ClubData>{
 // The checkpoint MUST precede every full read; writes during the read will be
 // replayed, rather than falling between a snapshot and a later checkpoint.
 const checkpoint=await readWorkspaceChanges(client,club.id,null,signal);
 return {...await loadClubData(client,club,signal),workspaceCursor:checkpoint?.cursor??null};
}
export function applyWorkspaceChanges(current:ClubData,delta:WorkspaceDelta,clubId:string):ClubData{
 if(delta.reset)throw new Error('Synchronizace vyžaduje úplné načtení.');
 const next={...current,workspaceCursor:delta.cursor};
 const collections={members:'members',events:'events',templates:'templates',participation:'participation',event_type_colors:'eventTypeColors'} as const;
 for(const [kind,property] of Object.entries(collections)){
  const changes=delta.changes.filter(c=>c.kind===kind);if(!changes.length)continue;
  const key=(row:Record<string,unknown>)=>kind==='participation'?row.event_id+':'+row.member_id:String(row.id);
  const rows=new Map((current[property]||[]).map(row=>[key(row),row as Record<string,unknown>]));
  for(const change of changes){
   if(change.row&&(change.row.club_id!==clubId||key(change.row)!==change.key))throw new Error('Neplatný záznam synchronizace.');
   if(change.row)rows.set(change.key,change.row);else rows.delete(change.key);
  }
  Object.assign(next,{[property]:[...rows.values()]});
 }
 next.events=next.events.slice().sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 return next;
}
