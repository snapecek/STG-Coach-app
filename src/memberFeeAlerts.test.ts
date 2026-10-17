import {expect,it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadMemberFeeAlerts,overdueFeeAlerts} from './memberFeeAlerts';
import {emptyFeeLedger,type FeeCharge,type FeePayment} from './clubFees';
const charge=(id:string,patch:Partial<FeeCharge>={}):FeeCharge=>({id,member_id:'m',member_name:'Člen',kind:'membership',title:'Členské',amount_cents:50000,due_date:'2026-10-17',plan_id:null,period_start:null,event_id:null,event_name:null,event_starts_at:null,created_at:'2026-10-01',cancelled_at:null,cancel_reason:'',...patch});
const payment=(id:string,amount:number,patch:Partial<FeePayment>={}):FeePayment=>({id:'p-'+id,charge_id:id,amount_cents:amount,paid_on:'2026-10-18',method:'bank',note:'',created_at:'2026-10-18',voided_at:null,void_reason:'',...patch});
it('upozorní pouze na nesplacené členské a tréninkové předpisy po splatnosti, včetně dílčího dluhu',()=>{
 const data={plans:[],charges:[charge('membership'),charge('training',{kind:'training',amount_cents:8000}),charge('today',{due_date:'2026-10-18'}),charge('future',{due_date:'2026-11-01'}),charge('cancelled',{cancelled_at:'2026-10-17'}),charge('deleted',{deleted_at:'2026-10-17'}),charge('paid')],payments:[payment('membership',20000),payment('paid',50000)]};
 expect(overdueFeeAlerts(data,'2026-10-18').map(c=>[c.id,c.due])).toEqual([['membership',30000],['training',8000]]);
 data.payments.push(payment('membership',30000));expect(overdueFeeAlerts(data,'2026-10-18').map(c=>c.id)).toEqual(['training']);
 data.payments.push(payment('training',8000));expect(overdueFeeAlerts(data,'2026-10-18')).toEqual([]);
 data.payments[3].voided_at='2026-10-18';expect(overdueFeeAlerts(data,'2026-10-18').map(c=>c.id)).toEqual(['training']);
});
it('při vypnuté evidenci nebo chybějící migraci nevolá finanční přehled',async()=>{
 for(const result of [{data:false,error:null},{data:null,error:{code:'PGRST202'}}]){const calls:string[]=[];const client={rpc:async(name:string)=>{calls.push(name);return result}} as unknown as SupabaseClient;expect(await loadMemberFeeAlerts(client,'club')).toEqual(emptyFeeLedger);expect(calls).toEqual(['get_club_fees_enabled'])}
});
it('načte přehled se serverovým omezením na aktuální účet a chybu přístupu nepovažuje za dluh',async()=>{
 const calls:unknown[]=[];const client={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:name==='get_club_fees_enabled'?true:{plans:[],charges:[charge('own')],payments:[]},error:null}}} as unknown as SupabaseClient;
 expect((await loadMemberFeeAlerts(client,'club')).charges.map(c=>c.id)).toEqual(['own']);expect(calls).toEqual([['get_club_fees_enabled',{target_club:'club'}],['club_fee_ledger',{target_club:'club'}]]);
 await expect(loadMemberFeeAlerts({rpc:async()=>({data:null,error:{code:'42501'}})} as unknown as SupabaseClient,'foreign')).rejects.toThrow();
});
