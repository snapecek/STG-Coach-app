import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {validateEventLocation,type EventLocation} from './eventLocation';

export type SavedLocation={id:string;club_id:string;name:string;event_location:EventLocation};
async function staff(client:SupabaseClient,club:ClubAccess){
 if(!['owner','coach'].includes(club.role))throw new Error('Uložená místa spravuje trenér nebo správce.');
 const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Přihlaste se znovu.');
}
function failure(error:{code?:string}|null){
 if(!error)return;
 if(['42P01','42703','PGRST204','PGRST205'].includes(error.code||''))throw new Error('Uložená místa vyžadují migraci 039 v Supabase.');
 if(error.code==='23505')throw new Error('Místo s tímto názvem už je uložené. Zvolte jiný název.');
 throw new Error('Uložená místa nelze změnit nebo načíst. Zkuste to znovu.');
}
export async function loadSavedLocations(client:SupabaseClient,club:ClubAccess){
 await staff(client,club);const rows:SavedLocation[]=[];
 for(let offset=0;;offset+=500){const {data,error}=await client.from('club_locations').select('id,club_id,name,event_location').eq('club_id',club.id).order('name').order('id').range(offset,offset+499);failure(error);rows.push(...data as SavedLocation[]);if(data!.length<500)return rows}
}
export async function saveLocation(client:SupabaseClient,club:ClubAccess,name:string,location:EventLocation){
 const normalized=name.trim();if(!normalized||normalized.length>200)throw new Error('Vyplňte název místa do 200 znaků.');
 const value=validateEventLocation(location);if(!value)throw new Error('Nejprve označte místo na mapě.');await staff(client,club);
 const {data,error}=await client.from('club_locations').insert({id:crypto.randomUUID(),club_id:club.id,name:normalized,event_location:value}).select('id,club_id,name,event_location').single();failure(error);if(!data)throw new Error('Místo se nepodařilo uložit.');return data as SavedLocation;
}
export async function deleteSavedLocation(client:SupabaseClient,club:ClubAccess,id:string){
 await staff(client,club);const {data,error}=await client.from('club_locations').delete().eq('club_id',club.id).eq('id',id).select('id');failure(error);if(data?.length!==1)throw new Error('Místo již neexistuje nebo jej nelze odstranit.');
}
