import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import type {EventRow} from './clubData';
export type EventTypeColor={id:string;club_id:string;event_kind:EventRow['event_kind'];type_key:string;color:string};
export const typeColorPalette=[['Tyrkysová','#78c3ba'],['Oranžová','#ff925c'],['Modrá','#70b5ff'],['Zelená','#92d68b'],['Fialová','#bba7ed'],['Růžová','#f3a0cb'],['Žlutá','#f6d17c'],['Červená','#f2979b']] as const;
export const typeColorKey=(type:string)=>type.trim().toLocaleLowerCase('cs');
export function eventTypeColor(event:Pick<EventRow,'event_kind'|'type'>,colors:EventTypeColor[]=[]){return colors.find(c=>c.event_kind===event.event_kind&&c.type_key===typeColorKey(event.type))?.color||(event.event_kind==='race'?'#ff925c':'#78c3ba');}
export async function saveEventTypeColor(client:SupabaseClient,club:ClubAccess,kind:EventRow['event_kind'],type:string,color:string|null){
 if(!['owner','coach'].includes(club.role))throw new Error('Barvy může měnit pouze trenér nebo správce.');
 const type_key=typeColorKey(type);
 if(!['training','race'].includes(kind)||!type_key||type_key.length>40||color!==null&&!typeColorPalette.some(c=>c[1]===color))throw new Error('Vyberte platný typ a barvu z palety.');
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw new Error('Přihlášení vypršelo.');
 if(color===null){const {error}=await client.from('event_type_colors').delete().eq('club_id',club.id).eq('event_kind',kind).eq('type_key',type_key);if(error)throw new Error('Barvu nelze obnovit. Zkontrolujte připojení a migraci 022.');return null;}
 const {data,error}=await client.from('event_type_colors').upsert({club_id:club.id,event_kind:kind,type_key,color},{onConflict:'club_id,event_kind,type_key'}).select('id,club_id,event_kind,type_key,color').single();
 if(error||!data)throw new Error('Barvu nelze uložit. Zkontrolujte připojení a migraci 022.');return data as EventTypeColor;
}
