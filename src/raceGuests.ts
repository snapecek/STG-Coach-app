import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';

export type RaceGuestDraft={name:string;role:'yes'|'companion'};
export function normalizeRaceGuests(guests:RaceGuestDraft[]):RaceGuestDraft[]{
 if(!Array.isArray(guests)||guests.length>500)throw new Error('Vyberte nejvýše 500 hostů.');
 const seen=new Set<string>();
 return guests.map(g=>{
  const name=typeof g?.name==='string'?g.name.trim().replace(/\s+/g,' '):'';
  if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw new Error('Zadejte platné jméno hosta, nejvýše 80 znaků.');
  if(g.role!=='yes'&&g.role!=='companion')throw new Error('Vyberte roli závodník nebo doprovod.');
  const key=name.toLocaleLowerCase('cs');if(seen.has(key))throw new Error('Stejný host je ve výběru dvakrát.');seen.add(key);
  return {name,role:g.role};
 });
}
export async function requireRaceGuestsMigration(client:SupabaseClient){
 const {data,error}=await client.rpc('race_tools_ready');
 if(error&&!['PGRST202','42883'].includes(error.code))throw new Error('Přidání hostů nelze ověřit. Zkontrolujte připojení.');
 if(error||data!==true)throw new Error('Pro přidávání hostů do závodů nejdříve nahrajte opravnou migraci 053 v Supabase.');
}
export async function addRaceGuest(client:SupabaseClient,club:ClubAccess,eventId:string,guest:RaceGuestDraft){
 if(!['owner','coach'].includes(club.role))throw new Error('Hosty do závodu přidává trenér nebo správce.');
 const [normalized]=normalizeRaceGuests([guest]);
 const {error}=await client.rpc('add_race_guest',{target_club:club.id,target_event:eventId,guest_name:normalized.name,guest_response:normalized.role});
 if(error){
  if(['PGRST202','42883'].includes(error.code))throw new Error('Pro přidávání hostů do závodů nejdříve nahrajte opravnou migraci 053 v Supabase.');
  if(error.message==='Guest already exists')throw new Error('Host tohoto jména už je v evidenci. Vyberte ho z uložených osob; archivovaného hosta nejprve obnovte.');
  if(error.message==='Race unavailable')throw new Error('Hosta lze přidat jen do nezrušeného závodu.');
  throw new Error('Hosta se nepodařilo přidat do závodu. Zkontrolujte připojení a zkuste to znovu.');
 }
}
