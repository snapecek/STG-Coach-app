import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {canManage} from './clubData';
export type RaceResult={club_id:string;event_id:string;member_id:string;status:'finished'|'dnf'|'dns';elapsed_ms:number|null;notes:string};
export function parseRaceTime(value:string){
 const match=/^(\d{1,2}):([0-5]\d):([0-5]\d)(?:[.,](\d{1,3}))?$/.exec(value.trim());
 if(!match)throw new Error('Čas zadejte jako HH:MM:SS nebo HH:MM:SS.mmm.');
 const ms=(Number(match[1])*3600+Number(match[2])*60+Number(match[3]))*1000+Number((match[4]||'').padEnd(3,'0'));
 if(ms<1||ms>172800000)throw new Error('Čas musí být kladný a nejvýše 48 hodin.');return ms;
}
export function formatRaceTime(ms:number){return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
export function rankResults(rows:RaceResult[]){let previous:number|null=null,rank=0;return [...rows].sort((a,b)=>(a.elapsed_ms??Infinity)-(b.elapsed_ms??Infinity)||a.status.localeCompare(b.status)||a.member_id.localeCompare(b.member_id)).map((row,i)=>{if(row.status==='finished'&&row.elapsed_ms!==previous){rank=i+1;previous=row.elapsed_ms;}return {...row,rank:row.status==='finished'?rank:null};});}
async function authorize(client:SupabaseClient,club:ClubAccess){if(!canManage(club))throw new Error('Výsledky spravuje trenér nebo správce.');const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Přihlaste se znovu.');}
export async function loadRaceResults(client:SupabaseClient,club:ClubAccess,eventId:string){await authorize(client,club);const rows:RaceResult[]=[];for(let offset=0;;offset+=500){const {data,error}=await client.from('race_results').select('*').eq('club_id',club.id).eq('event_id',eventId).order('member_id').range(offset,offset+499);if(error)throw new Error('Výsledky nelze načíst. Zkontrolujte migraci a připojení.');rows.push(...data as RaceResult[]);if(data.length<500)return rows;}}
export async function saveRaceResult(client:SupabaseClient,club:ClubAccess,row:Omit<RaceResult,'club_id'>){await authorize(client,club);if(!['finished','dnf','dns'].includes(row.status)||row.notes.length>1000||(row.status==='finished'?(typeof row.elapsed_ms!=='number'||!Number.isInteger(row.elapsed_ms)||row.elapsed_ms<1||row.elapsed_ms>172800000):row.elapsed_ms!==null))throw new Error('Zkontrolujte výsledek a čas.');const {error}=await client.from('race_results').upsert({...row,club_id:club.id},{onConflict:'event_id,member_id'});if(error)throw new Error('Výsledek se nepodařilo uložit.');}
export async function deleteRaceResult(client:SupabaseClient,club:ClubAccess,eventId:string,memberId:string){await authorize(client,club);const {data,error}=await client.from('race_results').delete().eq('club_id',club.id).eq('event_id',eventId).eq('member_id',memberId).select('member_id').single();if(error||!data)throw new Error('Výsledek se nepodařilo odebrat.');}
