import {validateEventLocation,type EventLocation} from './eventLocation';
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {canManage} from './clubData';
import type {GameScoring} from './trainingGames';
export type PresetKind='race'|'equipment'|'game';
export type PresetSettings={event_location?:EventLocation|null;discipline?:string;distance_km?:number|null;minutes?:number;place?:string;notes?:string;scoring?:GameScoring;mode?:'individual'|'teams'};
export type ClubPreset={id:string;club_id:string;kind:PresetKind;name:string;settings:PresetSettings};
export function validatePreset(kind:PresetKind,name:string,s:PresetSettings){
 if(!name.trim()||name.trim().length>(kind==='equipment'?40:80))throw new Error('Vyplňte platný název šablony.');
 if(s.event_location!==undefined){if(kind!=='race')throw new Error('Mapa patří k závodní šabloně.');validateEventLocation(s.event_location)}
 if(kind==='equipment'&&/[,\n]/.test(name))throw new Error('Jedna šablona pomůcky má jeden název bez čárky nebo nového řádku.');
 if(kind==='race'&&(!s.discipline?.trim()||s.discipline.length>40||!Number.isInteger(s.minutes)||s.minutes!<5||s.minutes!>480||(s.distance_km!=null&&(!Number.isFinite(s.distance_km)||s.distance_km<=0||s.distance_km>1000))))throw new Error('Zkontrolujte disciplínu, délku a časové okno závodu.');
 if((s.place||'').length>200||(s.notes||'').length>(kind==='game'?2000:5000))throw new Error('Text šablony je příliš dlouhý.');
 if(kind==='game'&&(!['time','repetitions','distance','points'].includes(s.scoring||'')||!['individual','teams'].includes(s.mode||'')))throw new Error('Vyberte hodnocení a jednotlivce nebo týmy.');
}
async function staff(client:SupabaseClient,club:ClubAccess){if(!canManage(club))throw new Error('Šablony spravuje trenér nebo správce.');const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Přihlaste se znovu.');}
export async function loadClubPresets(client:SupabaseClient,club:ClubAccess){await staff(client,club);const rows:ClubPreset[]=[];for(let offset=0;;offset+=500){const {data,error}=await client.from('club_presets').select('id,club_id,kind,name,settings').eq('club_id',club.id).order('id').range(offset,offset+499);if(error)throw new Error(['42P01','PGRST205'].includes(error.code)?'Nové šablony vyžadují migraci 020.':'Šablony nelze načíst.');rows.push(...data as ClubPreset[]);if(data.length<500)return rows;}}
export async function saveClubPreset(client:SupabaseClient,club:ClubAccess,preset:Pick<ClubPreset,'id'|'kind'|'name'|'settings'>){validatePreset(preset.kind,preset.name,preset.settings);await staff(client,club);const {error}=await client.from('club_presets').upsert({...preset,name:preset.name.trim(),club_id:club.id});if(error?.code==='23514'&&preset.settings.event_location)throw new Error('Zkontrolujte mapu a údaje závodní šablony.');if(error)throw new Error('Šablonu nelze uložit. Zkontrolujte migraci 020 a název.');}
export async function deleteClubPreset(client:SupabaseClient,club:ClubAccess,id:string){await staff(client,club);const {data,error}=await client.from('club_presets').delete().eq('club_id',club.id).eq('id',id).select('id');if(error||data?.length!==1)throw new Error('Šablonu nelze smazat.');}
export function useClubPresets(client:SupabaseClient,club:ClubAccess){const [rows,setRows]=useState<ClubPreset[]>([]),[error,setError]=useState(''),[version,setVersion]=useState(0);useEffect(()=>{let alive=true;loadClubPresets(client,club).then(rows=>{if(alive){setRows(rows);setError('')}}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[client,club.id,version]);return {rows,error,refresh:()=>setVersion(v=>v+1)};}
