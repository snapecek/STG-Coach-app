import {useEffect,useRef} from 'react';
import {nativeAppActive} from './nativePlatform';
import {CLUB_DATA_CHANGED,dataRefreshInterval} from './clubLiveSync';
// Chat has a separate lightweight cadence; full workspace loads use live events.
export const AUTO_REFRESH_MS=10_000;
type RefreshOptions<T>={load:(signal:AbortSignal)=>Promise<T>;apply:(value:T)=>void;canRefresh?:()=>boolean;revision?:()=>number;onError?:(error:unknown)=>void};
export function startAutoRefresh<T>(getOptions:()=>RefreshOptions<T>){
 let active=true,pending=false,dirty=false,controller:AbortController|undefined,last=Date.now(),debounceUntil=0;
 const available=()=>nativeAppActive()&&document.visibilityState!=='hidden'&&navigator.onLine!==false;
 async function tick(){
  const options=getOptions();if(!active||pending||!available()||options.canRefresh?.()===false||Date.now()<debounceUntil||(!dirty&&Date.now()-last<dataRefreshInterval()))return;
  pending=true;dirty=false;last=Date.now();controller=new AbortController();const signal=controller.signal,revision=options.revision?.();
  try{const value=await options.load(signal);const latest=getOptions();if(active&&!signal.aborted&&available()&&latest.canRefresh?.()!==false&&latest.revision?.()===revision)latest.apply(value);else if(active)dirty=true}
  catch(error){if(active&&!signal.aborted&&available()){getOptions().onError?.(error);dirty=true;debounceUntil=Date.now()+30_000}}finally{pending=false}
 }
 const changed=()=>{dirty=true;debounceUntil=Date.now()+500};
 const visibility=()=>{if(!available()){controller?.abort();dirty=true}else{dirty=true;debounceUntil=0;void tick()}};
 // The one-second timer only checks local state; it performs no network polling.
 // Dirty notifications survive editing, offline periods and an in-flight read.
 const timer=setInterval(()=>void tick(),1000);window.addEventListener(CLUB_DATA_CHANGED,changed);document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);window.addEventListener('focus',visibility);
 return()=>{active=false;controller?.abort();clearInterval(timer);window.removeEventListener(CLUB_DATA_CHANGED,changed);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility);window.removeEventListener('focus',visibility)};
}
export function useAutoRefresh<T>(client:object,scope:string,options:RefreshOptions<T>){
 const current=useRef(options);current.current=options;
 useEffect(()=>startAutoRefresh(()=>current.current),[client,scope]);
}
