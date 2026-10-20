import {useRef,useState,type ReactNode} from 'react';
import type {EventRow,MemberRow,ParticipationRow} from './clubData';
import {eventEnd} from './management';
import {reviewChoice,reviewUpdates,type AttendanceChoice,type SaveAttendance} from './attendanceReview';

const choices=[['present','A','Ano, přítomen'],['excused','O','Omluvil se'],['absent','N','Ne, nepřítomen']] as const;
export function AttendanceChoices({value,onChange,disabled,label}:{value?:AttendanceChoice;onChange:(choice:AttendanceChoice)=>void;disabled:boolean;label:string}){
 return <div className="attendance-toggles" role="group" aria-label={label}>{choices.map(([choice,letter,title])=><button type="button" key={choice} className={choice} title={title} aria-label={title} aria-pressed={value===choice} disabled={disabled} onClick={()=>onChange(choice)}>{letter}</button>)}</div>;
}
export function AttendanceReview({event,members,rows,now,busy,onSave,children}:{event:EventRow;members:MemberRow[];rows:ParticipationRow[];now:number;busy:boolean;onSave:SaveAttendance;children:(choice:(id:string)=>AttendanceChoice|undefined,setChoice:(id:string,value:AttendanceChoice)=>void)=>ReactNode}){
 const [drafts,setDrafts]=useState<Record<string,AttendanceChoice>>({}),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),ready=event.status==='scheduled'&&eventEnd(event)<=now;
 const updates=reviewUpdates(event.id,members.map(m=>m.id),rows,drafts),dirty=Object.keys(drafts).length>0;
 const choice=(id:string)=>ready?drafts[id]||reviewChoice(rows.find(p=>p.event_id===event.id&&p.member_id===id)):undefined;
 async function save(){
  if(lock.current||busy||!ready||!updates.length)return;
  lock.current=true;setSaving(true);setError('');setNotice('');
  try{if(!await onSave(updates))throw new Error('Docházku se nepodařilo uložit. Výběr zůstává zachovaný, zkuste to znovu.');setDrafts({});setNotice('Docházka byla ověřena a uložena.');}
  catch(e){setError(e instanceof Error?e.message:'Docházku se nepodařilo uložit.');}
  finally{lock.current=false;setSaving(false);}
 }
 return <div className="attendance-review" data-unsaved-changes={dirty?'true':undefined} data-auto-refresh-blocked={dirty||saving?'true':undefined}>
  {ready?<><div className="attendance-review-toolbar"><p><b>A</b> ano · <b>O</b> omluvil se · <b>N</b> ne. Opravte jen rozdíly a potvrďte celý seznam.</p><p className="muted">Přijdu → A. Nepřijdu, Možná, bez odpovědi a čekací listina → N. Omluvení označte O. Již ověřená docházka zůstává zachovaná.</p></div><div className="attendance-review-actions"><button className="primary" disabled={busy||saving||!updates.length} onClick={()=>void save()}>{saving?'Ukládám…':dirty?'Uložit docházku':updates.length?'Schválit docházku bez úprav':'Docházka je ověřená'}</button>{dirty&&<button disabled={busy||saving} onClick={()=>{setDrafts({});setError('')}}>Zrušit úpravy</button>}</div></>:<p className="muted">Skutečnou docházku ověříte po skončení události.</p>}
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
  {children(choice,(id,value)=>{if(!ready||saving||busy)return;setNotice('');setDrafts(old=>({...old,[id]:value}))})}
 </div>;
}
