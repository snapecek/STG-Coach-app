import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AUTO_REFRESH_MS,useAutoRefresh} from './useAutoRefresh';
export type FeePlan={id:string;name:string;frequency:'monthly'|'yearly';amount_cents:number;archived_at:string|null;auto_monthly?:boolean;auto_next_month?:string|null;auto_due_day?:number;auto_member_ids?:string[]};
export type FeeCharge={id:string;member_id:string|null;member_name:string;kind:'membership'|'training';title:string;amount_cents:number;due_date:string;plan_id:string|null;period_start:string|null;event_id:string|null;event_name:string|null;event_starts_at:string|null;created_at:string;cancelled_at:string|null;cancel_reason:string;is_automatic?:boolean};
export type FeePayment={id:string;charge_id:string;amount_cents:number;paid_on:string;method:'cash'|'bank'|'other';note:string;created_at:string;voided_at:string|null;void_reason:string};
export type FeeLedger={recurring_ready?:boolean|null;plans:FeePlan[];charges:FeeCharge[];payments:FeePayment[]};
export const feeMethods={cash:'Hotově',bank:'Převodem',other:'Jinak'};
export const emptyFeeLedger:FeeLedger={plans:[],charges:[],payments:[]};
export const feesChanged=(clubId:string,enabled:boolean)=>window.dispatchEvent(new CustomEvent('trenomi-fees-changed',{detail:{clubId,enabled}}));
export function feeMoney(cents:number){return new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:2}).format(cents/100)}
export function feeCents(value:string){
 const clean=value.trim().replace(',','.');if(!/^\d{1,7}(\.\d{1,2})?$/.test(clean))throw new Error('Zadejte kladnou částku v Kč, nejvýše dvě desetinná místa.');
 const [whole,fraction='']=clean.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<1||cents>100000000)throw new Error('Částka musí být od 0,01 do 1 000 000 Kč.');return cents;
}
export function feeBalance(charge:FeeCharge,payments:FeePayment[]){const paid=payments.filter(p=>p.charge_id===charge.id&&!p.voided_at).reduce((n,p)=>n+p.amount_cents,0);return {paid,due:charge.cancelled_at?0:Math.max(0,charge.amount_cents-paid)}}
export function feeStatus(charge:FeeCharge,payments:FeePayment[],today:string){const {paid,due}=feeBalance(charge,payments);return charge.cancelled_at?'cancelled':due===0?'paid':charge.due_date<today?'overdue':paid>0?'partial':'unpaid'}
export const feeStatusLabels={cancelled:'Stornováno',paid:'Zaplaceno',overdue:'Po splatnosti',partial:'Částečně uhrazeno',unpaid:'Neuhrazeno'};
export function feeTotals(charges:FeeCharge[],payments:FeePayment[],today:string){return charges.filter(c=>!c.cancelled_at).reduce((total,c)=>{const b=feeBalance(c,payments);return {charged:total.charged+c.amount_cents,paid:total.paid+b.paid,due:total.due+b.due,overdue:total.overdue+(c.due_date<today?b.due:0)}},{charged:0,paid:0,due:0,overdue:0})}
export async function feeRpc<T>(client:SupabaseClient,name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await client.rpc(name,args);if(error){
  if(['PGRST202','42883','42P01'].includes(error.code))throw new Error(['delete_club_fee_plan','delete_club_fee_charge','set_club_fee_recurrence'].includes(name)?'Tato změna příspěvků vyžaduje migraci 042. Po jejím nahrání obnovte stránku.':'Klubové příspěvky vyžadují migraci 041. Po jejím nahrání obnovte stránku.');
  if(error.code==='42501')throw new Error('K této evidenci nemáte oprávnění.');
  const messages:Record<string,string>={'Fees disabled':'Klubové příspěvky jsou vypnuté. Zapnout je může hlavní správce v Nastavení.','Invalid fee input':'Zkontrolujte částku, datum a povinná pole.','Fee record unavailable':'Záznam již není dostupný. Obnovte přehled.','Fee member unavailable':'Některá vybraná osoba již není dostupná nebo není na soupisce tohoto tréninku.','Fee payment exceeds balance':'Částka převyšuje zbývající dluh. Obnovte přehled úhrad.','Fee payment already exists':'Tato úhrada už byla použitá. Obnovte přehled před dalším zápisem.','Fee charge has payments':'Předpis má zapsané úhrady. Smazat nebo stornovat lze pouze předpis bez platných úhrad.'};
  throw new Error(messages[error.message]||'Evidenci příspěvků nelze načíst nebo uložit. Zkontrolujte připojení a zkuste to znovu.');
 }return data as T;
}
export function useFeesEnabled(client:SupabaseClient,clubId:string){
 const [state,setState]=useState({clubId:'',enabled:false,error:'',loading:true});
 useEffect(()=>{let active=true,pending=false,revision=0;setState({clubId,enabled:false,error:'',loading:!!clubId});const load=async()=>{if(!clubId||pending||document.visibilityState==='hidden')return;pending=true;const snapshot=revision;try{const value=await feeRpc<boolean>(client,'get_club_fees_enabled',{target_club:clubId});if(active&&snapshot===revision)setState({clubId,enabled:value===true,error:'',loading:false})}catch(e){if(active&&snapshot===revision)setState(old=>({...old,clubId,error:(e as Error).message,loading:false}))}finally{pending=false}};void load();const interval=setInterval(load,AUTO_REFRESH_MS);const change=(e:Event)=>{const detail=(e as CustomEvent<{clubId:string;enabled:boolean}>).detail;if(detail?.clubId===clubId){revision++;setState({clubId,enabled:detail.enabled,error:'',loading:false})}else void load()};window.addEventListener('trenomi-fees-changed',change);document.addEventListener('visibilitychange',load);return()=>{active=false;clearInterval(interval);window.removeEventListener('trenomi-fees-changed',change);document.removeEventListener('visibilitychange',load)}},[client,clubId]);
 return state.clubId===clubId?state:{clubId,enabled:false,error:'',loading:!!clubId};
}
export function useFeeLedger(client:SupabaseClient,clubId:string,busy:boolean){
 const [data,setData]=useState<FeeLedger>(emptyFeeLedger),[error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);feeRpc<FeeLedger>(client,'club_fee_ledger',{target_club:clubId}).then(value=>{if(active){setData(value);setError('')}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[client,clubId,version]);
 useAutoRefresh(client,clubId,{canRefresh:()=>!busy&&!loading,revision:()=>version,load:()=>feeRpc<FeeLedger>(client,'club_fee_ledger',{target_club:clubId}),apply:value=>{setData(value);setError('')},onError:e=>setError((e as Error).message)});
 return {data,error,loading,reload:()=>setVersion(v=>v+1)};
}
