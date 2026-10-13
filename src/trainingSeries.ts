import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {canManage,pragueTimestamp,type EventRow} from './clubData';
import {pragueDate} from './management';
import {dates} from './domain';
export type SeriesAction='reschedule'|'cancel'|'restore';
export type SeriesChange={id:string;expected_starts_at:string;expected_status:string;starts_at?:string};
export function futureSeriesEvents(events:EventRow[],seriesId:string,action:SeriesAction,now=Date.now()){return events.filter(e=>e.series_id===seriesId&&e.event_kind==='training'&&!e.completed_at&&Date.parse(e.starts_at)>now&&e.status===(action==='restore'?'cancelled':'scheduled')).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));}
export function seriesPreview(events:EventRow[],action:SeriesAction,newFirstDate:string,time:string,now=Date.now()):SeriesChange[]{
 if(!events.length)return [];let shift=0;
 if(action==='reschedule'){dates(newFirstDate,1);shift=Math.round((Date.parse(newFirstDate+'T12:00:00Z')-Date.parse(pragueDate(events[0].starts_at)+'T12:00:00Z'))/86400000);}
 return events.map(e=>{const result:SeriesChange={id:e.id,expected_starts_at:e.starts_at,expected_status:e.status};if(action==='reschedule'){const moved=new Date(Date.parse(pragueDate(e.starts_at)+'T12:00:00Z')+shift*86400000).toISOString().slice(0,10);result.starts_at=pragueTimestamp(moved,time);if(Date.parse(result.starts_at)<=now)throw new Error('Všechny nové termíny musí být v budoucnosti.');}return result;});
}
export async function changeTrainingSeries(client:SupabaseClient,club:ClubAccess,seriesId:string,action:SeriesAction,changes:SeriesChange[]){
 if(!canManage(club))throw new Error('Sérii může upravit trenér nebo správce.');if(!['reschedule','cancel','restore'].includes(action)||changes.length<1||changes.length>12||new Set(changes.map(c=>c.id)).size!==changes.length)throw new Error('Zkontrolujte vybrané termíny série.');
 const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw new Error('Přihlaste se znovu.');
 const {data,error}=await client.rpc('change_training_series',{target_club:club.id,target_series:seriesId,action,changes});if(error||!data)throw new Error('Série se změnila nebo některý termín již začal. Obnovte data a zkontrolujte nový náhled; žádná částečná změna se neuložila.');return data as EventRow[];
}
