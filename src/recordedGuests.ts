import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
export async function addRecordedGuest(client:SupabaseClient,club:ClubAccess,eventId:string,memberId:string|null,name:string|null){
 if(!['owner','coach'].includes(club.role))throw new Error('Hosty po tréninku přidává trenér nebo správce.');
 const normalized=name?.trim().replace(/\s+/g,' ')||null;
 if(!memberId&&(!normalized||normalized.length>80||/[\u0000-\u001f\u007f]/.test(normalized)))throw new Error('Zadejte jméno hosta, nejvýše 80 znaků.');
 const {error}=await client.rpc('add_recorded_training_guest',{target_club:club.id,target_event:eventId,target_member:memberId,guest_name:memberId?null:normalized});
 if(error){if(['PGRST202','42883'].includes(error.code))throw new Error('Přidání hostů po tréninku vyžaduje migraci 034.');if(error.message==='Guest already exists')throw new Error('Host tohoto jména už je v evidenci. Vyberte jej z uložených hostů; pokud je v archivu, nejdříve jej obnovte.');if(error.message==='Guest already participating')throw new Error('Host už v soupisce je. Jeho přítomnost upravte v docházce.');if(error.message==='Guest unavailable')throw new Error('Host není dostupný. Obnovte evidenci a vyberte aktivního hosta bez účtu.');if(error.message==='Training not finished')throw new Error('Hosty lze takto zapsat až po skončení nezrušeného tréninku.');throw new Error('Hosta se nepodařilo zapsat. Obnovte data a zkuste to znovu.');}
}
