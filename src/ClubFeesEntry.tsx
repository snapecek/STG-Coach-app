import {LoadBoundary} from './LoadBoundary';
import {lazy,useEffect,useRef,useState} from 'react';
import {WalletCards} from 'lucide-react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {feeRpc,feesChanged,useFeesEnabled} from './clubFees';
const ClubFeesDialog=lazy(()=>import('./ClubFeesDialog').then(m=>({default:m.ClubFeesDialog})));
export function ClubFeesButton({client,club}:{client:SupabaseClient;club:ClubAccess}){
 const state=useFeesEnabled(client,club.id),[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),[chargeId,setChargeId]=useState('');
 useEffect(()=>{const openCharge=(e:Event)=>{const detail=(e as CustomEvent<{clubId:string;chargeId:string}>).detail;if(detail?.clubId===club.id&&detail.chargeId){setChargeId(detail.chargeId);setOpen(true)}};window.addEventListener('trenomi-open-fee',openCharge);return()=>window.removeEventListener('trenomi-open-fee',openCharge)},[club.id]);
 if(!state.enabled)return null;
 return <><button ref={trigger} className="header-chat header-fees" aria-label="Klubové příspěvky" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setChargeId('');setOpen(v=>!v)}}><WalletCards size={20}/><span>Příspěvky</span></button>{open&&<LoadBoundary fallback={<span role="status" className="sr-only">Načítám příspěvky…</span>}><ClubFeesDialog initialChargeId={chargeId} key={club.id+chargeId} client={client} club={club} onClose={()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus())}}/></LoadBoundary>}</>;
}
export function ClubFeesSetting({client,club}:{client:SupabaseClient;club:ClubAccess}){
 const state=useFeesEnabled(client,club.id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),lock=useRef(false);
 async function toggle(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await feeRpc(client,'set_club_fees_enabled',{target_club:club.id,new_enabled:!state.enabled});feesChanged(club.id,!state.enabled);setNotice(state.enabled?'Evidence je vypnutá. Uložené předpisy a platby zůstávají zachované.':'Evidence příspěvků je zapnutá. Otevřete ji ikonou peněženky vedle dresu.')}catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}}
 return <section className="settings-panel" aria-label="Nastavení klubových příspěvků"><h2>Klubové příspěvky</h2><p className="muted">Členské příspěvky měsíčně či ročně a platby za tréninky. Trenéři ručně evidují úhrady, členové vidí jen vlastní přehled.</p>{state.error&&<p role="alert" className="auth-error">{state.error}</p>}{error&&<p role="alert" className="auth-error">{error}</p>}{club.role==='owner'?<button aria-pressed={state.enabled} className={state.enabled?'':'primary'} disabled={busy||state.loading||!!state.error} onClick={()=>void toggle()}>{state.loading?'Načítám…':state.enabled?'Vypnout klubové příspěvky':'Zapnout klubové příspěvky'}</button>:<p>{state.enabled?'Evidence je zapnutá.':'Evidence je vypnutá.'} Zapnutí spravuje hlavní správce klubu.</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
