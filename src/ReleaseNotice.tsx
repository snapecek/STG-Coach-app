import {useEffect,useState} from 'react';
import {release} from './clientDiagnostics';
import {requestLeave} from './UnsavedChanges';
export function ReleaseNotice(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{
  if(!import.meta.env.PROD)return;
  let active=true,pending=false;const controller=new AbortController();
  const check=async()=>{if(pending||document.visibilityState==='hidden')return;pending=true;try{const response=await fetch('/release.json',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(response.ok){const data=await response.json();if(active&&typeof data.release==='string'&&data.release!==release)setAvailable(true)}}catch{/* Offline is normal; the existing app remains usable. */}finally{pending=false}};
  const timer=setInterval(()=>void check(),60000);document.addEventListener('visibilitychange',check);
  return()=>{active=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',check)};
 },[]);
 return available?<aside className="release-notice" role="status">Je dostupná nová verze Trenomi. <button onClick={()=>requestLeave(()=>window.location.reload())}>Načíst novou verzi</button></aside>:null;
}
