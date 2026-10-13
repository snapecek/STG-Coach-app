import {removeAllEventPhotos} from './photos';
import type {SupabaseClient} from '@supabase/supabase-js';
import {dates} from './domain';
import type {ClubAccess} from './supabase';
export type MemberRow={id:string;club_id:string;name:string;kind:'member'|'guest';removed_at:string|null;purge_after:string|null;user_id?:string|null};
export type TemplateRow={id:string;club_id:string;name:string;type:string;place:string;minutes:number;plan:string};
export type EventRow={id:string;club_id:string;template_id:string|null;name:string;starts_at:string;place:string;type:string;plan:string;duration_minutes:number;event_kind:'training'|'race';status:'scheduled'|'cancelled';actual_notes:string;completed_at:string|null;completed_by:string|null;actual_duration_minutes:number|null;perceived_effort:number|null;equipment:string[];race_distance_km?:number|null;race_registration_url?:string;capacity?:number|null;source_group_id?:string|null;group_name?:string;roster_only?:boolean};
export type ParticipationRow={club_id:string;event_id:string;member_id:string;response:'yes'|'no'|'maybe'|null;attended:boolean|null;confirmed_by:string|null;seat_status?:'confirmed'|'waiting'|null;reservation_order?:number|null};
export type ClubData={members:MemberRow[];templates:TemplateRow[];events:EventRow[];participation:ParticipationRow[]};
export const emptyClubData=():ClubData=>({members:[],templates:[],events:[],participation:[]});
export const canManage=(club:ClubAccess)=>club.role==='owner'||club.role==='coach';
export const clubTimeZone='Europe/Prague';
function timeParts(date:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:clubTimeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);return Object.fromEntries(parts.map(p=>[p.type,p.value]));}
export function pragueTimestamp(date:string,time:string){
 dates(date,1);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Neplatný čas.');
 const desired=Date.parse(date+'T'+time+':00Z');let candidate=desired;
 for(let i=0;i<3;i++){const p=timeParts(new Date(candidate));const local=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);candidate+=desired-local;}
 const p=timeParts(new Date(candidate));if(`${p.year}-${p.month}-${p.day}`!==date||`${p.hour}:${p.minute}`!==time)throw new Error('Tento čas při změně letního času neexistuje. Vyberte jiný.');
 return new Date(candidate).toISOString();
}
export function buildEventRows(clubId:string,template:TemplateRow,date:string,time:string,count:number){
 if(template.club_id!==clubId)throw new Error('Šablona nepatří do tohoto klubu.');
 return dates(date,count).map(date=>({id:crypto.randomUUID(),club_id:clubId,template_id:template.id,name:template.name,starts_at:pragueTimestamp(date,time),place:template.place,type:template.type,plan:template.plan,duration_minutes:template.minutes,event_kind:'training' as const}));
}
async function verify(client:SupabaseClient){const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Přihlášení vypršelo. Přihlaste se znovu.');return data.user.id;}
function staff(club:ClubAccess){if(!canManage(club))throw new Error('Změny může ukládat pouze trenér nebo správce.');}
function text(value:string,label:string,max=200){const normalized=value.trim();if(!normalized||normalized.length>max)throw new Error(`${label}: vyplňte 1 až ${max} znaků.`);return normalized;}
function checked<T>(result:{data:unknown;error:unknown},message:string):T{if(result.error||result.data===null)throw new Error(message);return result.data as T;}
export async function loadClubData(client:SupabaseClient,club:ClubAccess,signal?:AbortSignal):Promise<ClubData>{
 await verify(client);
 async function readAll<T>(table:string,columns:string):Promise<T[]>{
  const result:T[]=[];const size=500;
  for(let offset=0;;offset+=size){
   let q=client.from(table).select(columns).eq('club_id',club.id);
   q=table==='participation'?q.order('event_id').order('member_id'):q.order('id');
   q=q.range(offset,offset+size-1);
   let responseResult=await (signal?q.abortSignal(signal):q);
   // Keep the previous club workflow usable while migration 007 is being applied.
   if(responseResult.error?.code==='42703'&&(table==='events'||table==='participation')){
    const previous=columns.split(',').filter(c=>!['capacity','seat_status','reservation_order','source_group_id','group_name','roster_only'].includes(c)).join(',');
    let fallback=client.from(table).select(previous).eq('club_id',club.id);
    fallback=table==='participation'?fallback.order('event_id').order('member_id'):fallback.order('id');
    fallback=fallback.range(offset,offset+size-1);responseResult=await (signal?fallback.abortSignal(signal):fallback);
   }
   const rows=checked<T[]>(responseResult,'Data klubu nelze načíst. Zkontrolujte připojení a oprávnění.');
   result.push(...rows);if(rows.length<size)return result;
  }
 }
 const [members,templates,events,participation]=await Promise.all([
  canManage(club)?readAll<MemberRow>('members','id,club_id,name,kind,removed_at,purge_after,user_id'):Promise.resolve([]),
  readAll<TemplateRow>('templates','id,club_id,name,type,place,minutes,plan'),
  readAll<EventRow>('events','id,club_id,template_id,name,starts_at,place,type,plan,duration_minutes,event_kind,status,actual_notes,completed_at,completed_by,actual_duration_minutes,perceived_effort,equipment,race_distance_km,race_registration_url,capacity,source_group_id,group_name,roster_only'),
  canManage(club)?readAll<ParticipationRow>('participation','club_id,event_id,member_id,response,attended,confirmed_by,seat_status,reservation_order'):Promise.resolve([])
 ]);
 return {members,templates,events:events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),participation};
}
export async function addMember(client:SupabaseClient,club:ClubAccess,name:string,kind:MemberRow['kind']){
 staff(club);if(!['member','guest'].includes(kind))throw new Error('Neplatný typ člena.');await verify(client);
 return checked<MemberRow>(await client.from('members').insert({id:crypto.randomUUID(),club_id:club.id,name:text(name,'Jméno',80),kind}).select('id,club_id,name,kind,removed_at,purge_after,user_id').single(),'Člena se nepodařilo uložit.');
}
export async function addTemplate(client:SupabaseClient,club:ClubAccess,input:Pick<TemplateRow,'name'|'type'|'place'|'minutes'|'plan'>){
 staff(club);if(!Number.isInteger(input.minutes)||input.minutes<5||input.minutes>480)throw new Error('Délka musí být 5 až 480 minut.');if(input.plan.length>5000)throw new Error('Plán je příliš dlouhý.');await verify(client);
 return checked<TemplateRow>(await client.from('templates').insert({id:crypto.randomUUID(),club_id:club.id,name:text(input.name,'Název',80),type:text(input.type,'Typ',40),place:text(input.place,'Místo'),minutes:input.minutes,plan:input.plan.trim()}).select('id,club_id,name,type,place,minutes,plan').single(),'Šablonu se nepodařilo uložit.');
}
export async function addEvents(client:SupabaseClient,club:ClubAccess,template:TemplateRow,date:string,time:string,count:number,options:{kind?:'training'|'race';name?:string}={}){
 staff(club);const rows=buildEventRows(club.id,template,date,time,count).map(row=>({...row,event_kind:options.kind||'training',name:options.name?.trim()?text(options.name,'Název',80):row.name}));await verify(client);
 // One insert statement: the whole repeated series succeeds or fails together.
 return checked<EventRow[]>(await client.from('events').insert(rows).select(eventColumns),'Tréninky se nepodařilo uložit.');
}
export async function saveParticipation(client:SupabaseClient,club:ClubAccess,eventId:string,memberId:string,patch:{response:ParticipationRow['response']}|{attended:boolean}){
 staff(club);const userId=await verify(client);
 if('response' in patch&&patch.response!==null&&!['yes','no','maybe'].includes(patch.response))throw new Error('Neplatná odpověď.');
 const row:Partial<ParticipationRow>={club_id:club.id,event_id:eventId,member_id:memberId,...patch,...('attended' in patch?{confirmed_by:userId}:{})};
 // Send only the changed fields: RSVP must not overwrite actual attendance (or vice versa).
 checked<ParticipationRow>(await client.from('participation').upsert(row,{onConflict:'event_id,member_id'}).select('*').single(),'Účast se nepodařilo uložit.');
 return checked<ParticipationRow>(await client.from('participation').select('*').eq('club_id',club.id).eq('event_id',eventId).eq('member_id',memberId).single(),'Aktuální přihlášení nelze načíst.');
}
const eventColumns='*';
const templateColumns='id,club_id,name,type,place,minutes,plan';
export async function archiveMember(client:SupabaseClient,club:ClubAccess,memberId:string,restore=false){
 staff(club);await verify(client);return checked<MemberRow>(await client.rpc('archive_club_member',{target_club:club.id,target_member:memberId,restore}),'Člena se nepodařilo archivovat nebo obnovit.');
}
export async function editTemplate(client:SupabaseClient,club:ClubAccess,id:string,input:Pick<TemplateRow,'name'|'type'|'place'|'minutes'|'plan'>){
 staff(club);if(!Number.isInteger(input.minutes)||input.minutes<5||input.minutes>480||input.plan.length>5000)throw new Error('Zkontrolujte délku a plán.');await verify(client);
 return checked<TemplateRow>(await client.from('templates').update({name:text(input.name,'Název',80),type:text(input.type,'Typ',40),place:text(input.place,'Místo'),minutes:input.minutes,plan:input.plan.trim()}).eq('club_id',club.id).eq('id',id).select(templateColumns).single(),'Šablonu se nepodařilo změnit.');
}
export async function deleteTemplate(client:SupabaseClient,club:ClubAccess,id:string){
 staff(club);await verify(client);return checked<{id:string}>(await client.from('templates').delete().eq('club_id',club.id).eq('id',id).select('id').single(),'Šablonu se nepodařilo smazat.');
}
export async function updateEvent(client:SupabaseClient,club:ClubAccess,id:string,patch:Partial<Pick<EventRow,'name'|'starts_at'|'place'|'type'|'plan'|'duration_minutes'|'event_kind'|'status'|'actual_notes'|'actual_duration_minutes'|'perceived_effort'|'equipment'|'template_id'|'race_distance_km'|'race_registration_url'|'capacity'>>){
 staff(club);validateCapacity(patch.capacity);validateRaceDetails(patch);if(patch.duration_minutes!==undefined&&(!Number.isInteger(patch.duration_minutes)||patch.duration_minutes<5||patch.duration_minutes>480))throw new Error('Délka musí být 5 až 480 minut.');
 if(patch.actual_duration_minutes!==undefined&&patch.actual_duration_minutes!==null&&(!Number.isInteger(patch.actual_duration_minutes)||patch.actual_duration_minutes<1||patch.actual_duration_minutes>1440))throw new Error('Skutečná délka musí být 1 až 1440 minut.');
 if(patch.perceived_effort!==undefined&&patch.perceived_effort!==null&&(!Number.isInteger(patch.perceived_effort)||patch.perceived_effort<1||patch.perceived_effort>10))throw new Error('Náročnost musí být 1 až 10.');
 if(patch.equipment!==undefined&&(patch.equipment.length>30||patch.equipment.some(tag=>!tag.trim()||tag.length>40)))throw new Error('Zadejte nejvýše 30 pomůcek, každou do 40 znaků.');
 if(patch.name!==undefined)patch={...patch,name:text(patch.name,'Název',80)};
 if(patch.actual_notes!==undefined&&patch.actual_notes.length>5000)throw new Error('Skutečný průběh je příliš dlouhý.');
 await verify(client);const result=await client.from('events').update(patch).eq('club_id',club.id).eq('id',id).select(eventColumns).single();if(result.error?.message.includes('Capacity below confirmed'))throw new Error('Kapacitu nelze snížit pod počet potvrzených míst. Nejprve upravte přihlášení účastníků.');if(result.error?.message.includes('Capacity is closed'))throw new Error('Po zahájení tréninku nelze kapacitu měnit.');if(result.error?.message.includes('Remove race results'))throw new Error('Před změnou závodu na trénink odeberte jeho výsledky.');return checked<EventRow>(result,'Událost se nepodařilo změnit.');
}
export async function completeEvent(client:SupabaseClient,club:ClubAccess,id:string){
 staff(club);await verify(client);const row=checked<EventRow>(await client.from('events').update({completed_at:new Date().toISOString()}).eq('club_id',club.id).eq('id',id).select(eventColumns).single(),'Událost nelze dokončit. Doplňte průběh a docházku po skončení.');
 if(!row.completed_at)throw new Error('Událost nebyla dokončena. Obnovte data a zkontrolujte její stav.');return row;
}
export async function deleteEvent(client:SupabaseClient,club:ClubAccess,id:string){
 staff(club);await verify(client);await removeAllEventPhotos(client,club.id,id);return checked<{id:string}>(await client.from('events').delete().eq('club_id',club.id).eq('id',id).select('id').single(),'Událost se nepodařilo smazat.');
}
export async function createClubEvents(client:SupabaseClient,club:ClubAccess,input:{template_id:string|null;name:string;place:string;type:string;plan:string;duration_minutes:number;event_kind:'training'|'race';date:string;time:string;count:number;capacity?:number|null}){
 staff(club);validateCapacity(input.capacity);if(!Number.isInteger(input.duration_minutes)||input.duration_minutes<5||input.duration_minutes>480||input.plan.length>5000)throw new Error('Zkontrolujte délku a plán.');
 const rows=dates(input.date,input.count).map(date=>({id:crypto.randomUUID(),club_id:club.id,template_id:input.template_id,name:text(input.name,'Název',80),place:text(input.place,'Místo'),type:text(input.type,'Typ',40),plan:input.plan.trim(),duration_minutes:input.duration_minutes,event_kind:input.event_kind,...(input.capacity!=null?{capacity:input.capacity}:{}),starts_at:pragueTimestamp(date,input.time)}));await verify(client);
 return checked<EventRow[]>(await client.from('events').insert(rows).select(eventColumns),'Události se nepodařilo uložit.');
}

export function validateRaceDetails(input:{race_distance_km?:number|null;race_registration_url?:string}){
 if(input.race_distance_km!==undefined&&input.race_distance_km!==null&&(!Number.isFinite(input.race_distance_km)||input.race_distance_km<=0||input.race_distance_km>1000))throw new Error('Délka trasy musí být větší než 0 a nejvýše 1000 km.');
 if(input.race_registration_url){try{const url=new URL(input.race_registration_url);if(url.protocol!=='https:'||url.username||url.password||input.race_registration_url.length>1000||/\s/.test(input.race_registration_url))throw new Error();}catch{throw new Error('Odkaz na registraci musí být platná HTTPS adresa bez přihlašovacích údajů.');}}
}
export async function createClubRace(client:SupabaseClient,club:ClubAccess,input:{id:string;name:string;place:string;type:string;plan:string;starts_at:string;duration_minutes:number;race_distance_km:number|null;race_registration_url:string},entrants:string[]){
 staff(club);validateRaceDetails(input);if(entrants.length<1||entrants.length>500||new Set(entrants).size!==entrants.length)throw new Error('Vyberte alespoň jednoho závodníka, nejvýše 500.');await verify(client);
 return checked<EventRow>(await client.rpc('create_club_race',{target_club:club.id,race:{...input,name:text(input.name,'Název',80),place:text(input.place,'Místo'),type:text(input.type,'Disciplína',40)},entrants}),'Závod se nepodařilo vytvořit. Zkontrolujte soupisku a migraci databáze.');
}
export async function removeRaceEntrant(client:SupabaseClient,club:ClubAccess,eventId:string,memberId:string){
 staff(club);await verify(client);return checked<{member_id:string}>(await client.from('participation').delete().eq('club_id',club.id).eq('event_id',eventId).eq('member_id',memberId).select('member_id').single(),'Účastníka nelze odebrat. Nejprve odeberte jeho výsledek.');
}

export function validateCapacity(capacity?:number|null){if(capacity!=null&&(!Number.isInteger(capacity)||capacity<1||capacity>500))throw new Error("Kapacita musí být celé číslo od 1 do 500, nebo bez omezení.");}
