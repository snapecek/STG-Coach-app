import {AUTO_REFRESH_MS} from './useAutoRefresh';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Bell} from 'lucide-react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {notifyChat,communicationRpc} from './communication';
import type {MentionNotice} from './chatMentions';
type EventNotice={id:number;event_id:string;title:string;body:string;created_at:string};
export function ChatNotifications({client,clubId,onOpen,onOpenEvent,extraCount=0,children,showEmpty=true,open:controlledOpen,onOpenChange}:{client:SupabaseClient;clubId:string;onOpen:(selection:string)=>void;onOpenEvent?:(eventId:string)=>boolean|Promise<boolean>;extraCount?:number;children?:ReactNode;showEmpty?:boolean;open?:boolean;onOpenChange?:(v:boolean)=>void}){
 const [rows,setRows]=useState<MentionNotice[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[localOpen,setLocalOpen]=useState(false);const root=useRef<HTMLDivElement>(null),lock=useRef(false);const open=controlledOpen??localOpen;const setOpen=(v:boolean)=>{setLocalOpen(v);onOpenChange?.(v)};
 const [eventRows,setEventRows]=useState<EventNotice[]>([]),[eventError,setEventError]=useState('');
 useEffect(()=>{
  let alive=true,pending=false;
  const load=async()=>{
   if(pending||document.visibilityState==='hidden')return;pending=true;
   try{
    const {data,error}=await client.rpc('list_event_change_notices',{target_club:clubId});
    if(!alive)return;
    if(error)throw new Error(error.code==='PGRST202'?'Upozornění na změny událostí zatím nejsou dostupná.':'Změny událostí se nepodařilo načíst. Zkusíme to znovu.');
    setEventRows(data||[]);setEventError('');
   }catch(e){if(alive)setEventError(e instanceof Error?e.message:'Změny událostí se nepodařilo načíst. Zkusíme to znovu.')}finally{pending=false}
  };
  setEventRows([]);setEventError('');void load();
  const timer=setInterval(load,AUTO_REFRESH_MS);
  window.addEventListener('trenomi-data-changed',load);document.addEventListener('visibilitychange',load);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('trenomi-data-changed',load);document.removeEventListener('visibilitychange',load)};
 },[client,clubId]);
 useEffect(()=>{let alive=true,pending=false;const load=async()=>{if(pending||document.visibilityState==='hidden')return;pending=true;try{const {data,error}=await client.rpc('list_chat_mentions',{target_club:clubId});if(alive)setRows(error?[]:data||[])}catch{/* Keep other dashboard alerts available while offline. */}finally{pending=false}};setRows([]);void load();const timer=setInterval(load,AUTO_REFRESH_MS);window.addEventListener('trenomi-chat-changed',load);window.addEventListener('trenomi-data-changed',load);document.addEventListener('visibilitychange',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('trenomi-chat-changed',load);window.removeEventListener('trenomi-data-changed',load);document.removeEventListener('visibilitychange',load)}},[client,clubId]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 async function go(n:MentionNotice){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await communicationRpc(client,'read_chat_mention',{target_club:clubId,target_message:n.message_id});setRows(r=>r.filter(row=>row.message_id!==n.message_id));notifyChat();onOpen(n.event_id?'event:'+n.event_id:'contact:'+n.conversation_id);setOpen(false)}catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}}
 async function goEvent(n:EventNotice){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   if(!await onOpenEvent?.(n.event_id))return;
   const {error}=await client.rpc('read_event_change_notice',{target_club:clubId,target_notice:n.id});
   if(error)throw new Error('Upozornění nelze označit jako přečtené. Zkuste to znovu.');
   setEventRows(r=>r.filter(row=>row.id!==n.id));setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:'Událost nelze otevřít.')}finally{lock.current=false;setBusy(false)}
 }
 const count=extraCount+rows.length+eventRows.length;
 return <div className="notification-bell" ref={root} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('.member-bell')?.focus()}}}><button className="member-bell" aria-label="Moje upozornění" aria-expanded={open} onClick={()=>setOpen(!open)}><Bell size={23}/>{count>0&&<span>{count}{rows.length===100||eventRows.length===100?'+':''}</span>}</button>{open&&<section className="member-alerts notification-panel" aria-label="Moje upozornění"><h2>Moje upozornění</h2>{error&&<p className="auth-error" role="alert">{error}</p>}{children}{eventError&&<p role="status" className="muted">{eventError}</p>}{eventRows.length>0&&<h3>Nové a změněné události</h3>}{eventRows.map(n=><button className="event-change-notice" key={n.id} disabled={busy} onClick={()=>void goEvent(n)}><b>{n.title}</b><p className="preserve-lines">{n.body}</p><small>Otevřít událost · {new Date(n.created_at).toLocaleString('cs-CZ',{timeZone:'Europe/Prague',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}</small></button>)}{rows.length>0&&<h3>Označení v chatu</h3>}{rows.map(n=><button key={n.message_id} disabled={busy} onClick={()=>void go(n)}><b>{n.author_name} vás označil/a</b><small>{n.event_name||'Soukromý chat s trenéry'}</small><p className="preserve-lines">{n.body}</p><small>Otevřít konverzaci · {new Date(n.created_at).toLocaleString('cs-CZ',{timeZone:'Europe/Prague',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}</small></button>)}{!count&&showEmpty&&!eventError&&<p>Vše je vyřízené.</p>}</section>}</div>;
}
