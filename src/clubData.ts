import type {SupabaseClient} from '@supabase/supabase-js';
import {dates} from './domain';
import type {ClubAccess} from './supabase';
export type MemberRow={id:string;club_id:string;name:string;kind:'member'|'guest'};
export type TemplateRow={id:string;club_id:string;name:string;type:string;place:string;minutes:number;plan:string};
export type EventRow={id:string;club_id:string;template_id:string|null;name:string;starts_at:string;place:string;type:string;plan:string};
export type ParticipationRow={club_id:string;event_id:string;member_id:string;response:'yes'|'no'|'maybe'|null;attended:boolean|null;confirmed_by:string|null};
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
 return dates(date,count).map(date=>({id:crypto.randomUUID(),club_id:clubId,template_id:template.id,name:template.name,starts_at:pragueTimestamp(date,time),place:template.place,type:template.type,plan:template.plan}));
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
   const rows=checked<T[]>(await (signal?q.abortSignal(signal):q),'Data klubu nelze načíst. Zkontrolujte připojení a oprávnění.');
   result.push(...rows);if(rows.length<size)return result;
  }
 }
 const [members,templates,events,participation]=await Promise.all([
  canManage(club)?readAll<MemberRow>('members','id,club_id,name,kind'):Promise.resolve([]),
  readAll<TemplateRow>('templates','id,club_id,name,type,place,minutes,plan'),
  readAll<EventRow>('events','id,club_id,template_id,name,starts_at,place,type,plan'),
  canManage(club)?readAll<ParticipationRow>('participation','club_id,event_id,member_id,response,attended,confirmed_by'):Promise.resolve([])
 ]);
 return {members,templates,events:events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),participation};
}
export async function addMember(client:SupabaseClient,club:ClubAccess,name:string,kind:MemberRow['kind']){
 staff(club);if(!['member','guest'].includes(kind))throw new Error('Neplatný typ člena.');await verify(client);
 return checked<MemberRow>(await client.from('members').insert({id:crypto.randomUUID(),club_id:club.id,name:text(name,'Jméno',80),kind}).select('id,club_id,name,kind').single(),'Člena se nepodařilo uložit.');
}
export async function addTemplate(client:SupabaseClient,club:ClubAccess,input:Pick<TemplateRow,'name'|'type'|'place'|'minutes'|'plan'>){
 staff(club);if(!Number.isInteger(input.minutes)||input.minutes<5||input.minutes>480)throw new Error('Délka musí být 5 až 480 minut.');if(input.plan.length>5000)throw new Error('Plán je příliš dlouhý.');await verify(client);
 return checked<TemplateRow>(await client.from('templates').insert({id:crypto.randomUUID(),club_id:club.id,name:text(input.name,'Název',80),type:text(input.type,'Typ',40),place:text(input.place,'Místo'),minutes:input.minutes,plan:input.plan.trim()}).select('id,club_id,name,type,place,minutes,plan').single(),'Šablonu se nepodařilo uložit.');
}
export async function addEvents(client:SupabaseClient,club:ClubAccess,template:TemplateRow,date:string,time:string,count:number){
 staff(club);const rows=buildEventRows(club.id,template,date,time,count);await verify(client);
 // One insert statement: the whole repeated series succeeds or fails together.
 return checked<EventRow[]>(await client.from('events').insert(rows).select('id,club_id,template_id,name,starts_at,place,type,plan'),'Tréninky se nepodařilo uložit.');
}
export async function saveParticipation(client:SupabaseClient,club:ClubAccess,eventId:string,memberId:string,patch:{response:ParticipationRow['response']}|{attended:boolean}){
 staff(club);const userId=await verify(client);
 if('response' in patch&&patch.response!==null&&!['yes','no','maybe'].includes(patch.response))throw new Error('Neplatná odpověď.');
 const row:Partial<ParticipationRow>={club_id:club.id,event_id:eventId,member_id:memberId,...patch,...('attended' in patch?{confirmed_by:userId}:{})};
 // Send only the changed fields: RSVP must not overwrite actual attendance (or vice versa).
 return checked<ParticipationRow>(await client.from('participation').upsert(row,{onConflict:'event_id,member_id'}).select('club_id,event_id,member_id,response,attended,confirmed_by').single(),'Účast se nepodařilo uložit.');
}
