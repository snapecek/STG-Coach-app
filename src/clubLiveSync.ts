import {useEffect} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export const CLUB_DATA_CHANGED='trenomi-data-changed';
export const LIVE_BACKUP_MS=10*60_000;
export const FALLBACK_REFRESH_MS=30_000;
let connected=false;
export const dataRefreshInterval=()=>connected?LIVE_BACKUP_MS:FALLBACK_REFRESH_MS;
// One scoped channel per workspace; only an invalidation counter crosses Realtime.
export function startClubLiveSync(client:SupabaseClient,clubId:string){
 let active=true,channel:ReturnType<SupabaseClient['channel']>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const notify=()=>{if(!active)return;clearTimeout(timer);timer=setTimeout(()=>{if(active)window.dispatchEvent(new Event(CLUB_DATA_CHANGED))},500)};
 connected=false;
 void (async()=>{
  try{
   const {data,error}=await client.rpc('club_live_sync_ready');
   if(!active||error||data!==true)return;
   channel=client.channel('club-live:'+clubId).on('postgres_changes',{event:'*',schema:'public',table:'club_live_changes',filter:'club_id=eq.'+clubId},notify).subscribe(status=>{
    if(!active)return;
    connected=status==='SUBSCRIBED';
    // Catch writes between the first snapshot and subscription, and missed writes
    // on disconnect. The REST loaders continue to enforce their existing RLS.
    notify();
   });
  }catch{/* Missing migration / unavailable Realtime keeps the 30-second fallback. */}
 })();
 const resume=()=>{if(document.visibilityState!=='hidden')notify()};
 document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
 return()=>{active=false;connected=false;clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);if(channel)void client.removeChannel(channel)};
}
export function useClubLiveSync(client:SupabaseClient,clubId:string){useEffect(()=>clubId?startClubLiveSync(client,clubId):undefined,[client,clubId])}
