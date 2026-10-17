import {useEffect,useRef} from 'react';
export const AUTO_REFRESH_MS=10_000;
type RefreshOptions<T>={load:(signal:AbortSignal)=>Promise<T>;apply:(value:T)=>void;canRefresh?:()=>boolean;revision?:()=>number;onError?:(error:unknown)=>void};
// One request at a time. A local write invalidates reads started before it.
export function startAutoRefresh<T>(getOptions:()=>RefreshOptions<T>){
 let active=true,pending=false,controller:AbortController|undefined;
 const available=()=>document.visibilityState!=='hidden'&&navigator.onLine!==false;
 async function tick(){
  const options=getOptions();if(!active||pending||!available()||options.canRefresh?.()===false)return;
  pending=true;controller=new AbortController();const signal=controller.signal,revision=options.revision?.();
  try{const value=await options.load(signal);const latest=getOptions();if(active&&!signal.aborted&&available()&&latest.canRefresh?.()!==false&&latest.revision?.()===revision)latest.apply(value)}
  catch(error){if(active&&!signal.aborted&&available())getOptions().onError?.(error)}finally{pending=false}
 }
 const visibility=()=>{if(!available())controller?.abort();else void tick()};
 const timer=setInterval(()=>void tick(),AUTO_REFRESH_MS);document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);
 return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility)};
}
export function useAutoRefresh<T>(client:object,scope:string,options:RefreshOptions<T>){
 const current=useRef(options);current.current=options;
 useEffect(()=>startAutoRefresh(()=>current.current),[client,scope]);
}
