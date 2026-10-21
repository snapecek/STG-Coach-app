import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AUTO_REFRESH_MS} from './useAutoRefresh';
import {pragueDate} from './management';
import {emptyFeeLedger,feeBalance,feeRpc,type FeeLedger} from './clubFees';
export function overdueFeeAlerts(data:FeeLedger,today:string){
 return data.charges.filter(c=>!c.cancelled_at&&!c.deleted_at&&c.due_date<today).map(c=>({...c,due:feeBalance(c,data.payments).due})).filter(c=>c.due>0).sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.id.localeCompare(b.id));
}
export const notifyFeeLedger=(clubId:string)=>window.dispatchEvent(new CustomEvent('trenomi-fee-ledger-changed',{detail:{clubId}}));
export const openFeeCharge=(clubId:string,chargeId:string)=>window.dispatchEvent(new CustomEvent('trenomi-open-fee',{detail:{clubId,chargeId}}));
export async function loadMemberFeeAlerts(client:SupabaseClient,clubId:string):Promise<FeeLedger>{
 const result=await client.rpc('get_club_fees_enabled',{target_club:clubId});
 // Optional module: old installations and disabled clubs have no fee alerts.
 if(result.error&&['PGRST202','42883','42P01'].includes(result.error.code))return emptyFeeLedger;
 if(result.error)throw new Error('Fee alerts unavailable');
 if(result.data!==true)return emptyFeeLedger;
 return feeRpc<FeeLedger>(client,'club_fee_ledger',{target_club:clubId});
}
export function useMemberFeeAlerts(client:SupabaseClient,clubId:string){
 const [data,setData]=useState<FeeLedger>(emptyFeeLedger),[error,setError]=useState('');
 const generation=useRef(0),alive=useRef(false),pending=useRef<{generation:number;promise:Promise<FeeLedger|null>}|null>(null);
 const refresh=useCallback(async(fresh=false):Promise<FeeLedger|null>=>{
  const version=generation.current;
  if(!alive.current)return null;
  if(pending.current?.generation===version){const value=await pending.current.promise;if(!fresh||!alive.current||version!==generation.current)return value;if(pending.current?.generation===version)return pending.current.promise;}
  if(document.visibilityState==='hidden'||navigator.onLine===false){setError('Upozornění na příspěvky se nepodařilo ověřit. Zkuste to po připojení znovu.');setData(emptyFeeLedger);return null;}
  const promise=loadMemberFeeAlerts(client,clubId).then(value=>{if(alive.current&&version===generation.current){setData(value);setError('');return value}return null}).catch(()=>{if(alive.current&&version===generation.current){setData(emptyFeeLedger);setError('Upozornění na příspěvky se nepodařilo ověřit. Zkuste to znovu.')}return null});
  pending.current={generation:version,promise};try{return await promise}finally{if(pending.current?.promise===promise)pending.current=null}
 },[client,clubId]);
 useEffect(()=>{alive.current=true;generation.current++;setData(emptyFeeLedger);setError('');const load=()=>{if(document.visibilityState!=='hidden'&&navigator.onLine!==false)void refresh()};const changed=(event:Event)=>{if((event as CustomEvent<{clubId:string}>).detail?.clubId===clubId)void refresh(true)};load();const timer=setInterval(load,AUTO_REFRESH_MS);window.addEventListener('trenomi-fee-ledger-changed',changed);window.addEventListener('trenomi-fees-changed',changed);window.addEventListener('online',load);window.addEventListener('trenomi-data-changed',load);document.addEventListener('visibilitychange',load);return()=>{alive.current=false;generation.current++;clearInterval(timer);window.removeEventListener('trenomi-fee-ledger-changed',changed);window.removeEventListener('trenomi-fees-changed',changed);window.removeEventListener('online',load);window.removeEventListener('trenomi-data-changed',load);document.removeEventListener('visibilitychange',load)}},[refresh,clubId]);
 return {rows:overdueFeeAlerts(data,pragueDate(new Date().toISOString())),error,refresh};
}
