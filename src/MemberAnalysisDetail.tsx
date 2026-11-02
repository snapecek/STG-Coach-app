import {useState} from 'react';
import {EventDialog} from './EventDialog';
import {canManage,type ClubData,type MemberRow} from './clubData';
import type {ClubAccess} from './supabase';
import {analysisAttendance,analysisSummary,filterAnalysis,noFilters,type AttendanceCounts} from './analysis';
import {pragueDate,reviewMembers} from './management';

const km=(value:number,count:number)=>count?`${value.toLocaleString('cs-CZ',{maximumFractionDigits:3})} km`:'—';
function AttendanceNumbers({counts}:{counts:AttendanceCounts}){
 return <div className="member-attendance-numbers"><strong>{counts.present} / {counts.verified}</strong><span>{counts.percent==null?'Bez ověřené docházky':`${counts.percent} % z ověřené docházky`}</span><small>Nepřítomen: {counts.absent} · Omluveno: {counts.excused} · Neověřeno: {counts.unverified}</small></div>;
}
export function MemberAnalysisDetail({data,club,member,initialFrom,initialTo,onClose}:{data:ClubData;club:ClubAccess;member:MemberRow;initialFrom:string;initialTo:string;onClose:()=>void}){
 const [from,setFrom]=useState(initialFrom),[to,setTo]=useState(initialTo);
 const invalid=!!from&&!!to&&from>to;
 const completed=filterAnalysis(data,{...noFilters,from,to});
 const rosterEvents=completed.filter(e=>reviewMembers(data,e).some(m=>m.id===member.id));
 const attendance=analysisAttendance(data,rosterEvents,member.id);
 const attended=filterAnalysis(data,{...noFilters,from,to,memberId:member.id});
 const summary=analysisSummary(data,attended,member.id);
 if(!canManage(club))return null;
 return <EventDialog label={`Detail člena – ${member.name}`} fullHeight onClose={onClose}><section className="member-analysis-detail" aria-label="Analýza člena pro trenéra">
  <header><p className="eyebrow">DETAIL ČLENA · ANALÝZA PRO TRENÉRA</p><h2>{member.name}</h2><p className="muted">{member.kind==='guest'?'Host':'Člen'}{member.removed_at?' · archivovaný záznam':''}</p></header>
  <div className="member-analysis-dates"><label>Od<input aria-label="Analýza člena od" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Do<input aria-label="Analýza člena do" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" onClick={()=>{setFrom('');setTo('')}}>Celá historie</button></div>
  {invalid&&<p role="alert" className="auth-error">Datum Od musí být před datem Do.</p>}
  <p className="muted">Pouze dokončené, nezrušené události. Tréninky a závody se počítají samostatně. Omluvené a neověřené záznamy se do procent nezapočítávají.</p>
  <div className="member-analysis-sections">{(['training','race'] as const).map(kind=>{
   const counts=kind==='training'?attendance.training:attendance.races;
   const history=rosterEvents.filter(e=>e.event_kind===kind&&(kind!=='race'||data.participation.find(p=>p.event_id===e.id&&p.member_id===member.id)?.response!=='companion')).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));
   return <section className="panel" key={kind} aria-label={kind==='training'?'Tréninková analýza člena':'Závodní analýza člena'}><h3>{kind==='training'?'Tréninky':'Závody'}</h3><AttendanceNumbers counts={counts}/><dl className="member-analysis-values"><div><dt>Vzdálenost</dt><dd>{kind==='training'?km(summary.distance,summary.recordedDistances):km(summary.raceDistance,summary.recordedRaceDistances)}</dd></div>{kind==='training'&&<div><dt>Skutečný čas</dt><dd>{summary.recordedDurations?`${summary.minutes} min`:'—'}</dd></div>}</dl>
    {kind==='race'&&<p className="muted">Doprovod se do závodní účasti nepočítá. Kilometry vycházejí ze skutečné vzdálenosti, jinak z délky trasy.</p>}
    {history.length?<details className="member-event-history"><summary>Záznamy účasti ({history.length})</summary><ul>{history.map(e=>{const p=data.participation.find(p=>p.event_id===e.id&&p.member_id===member.id);return <li key={e.id}><time dateTime={e.starts_at}>{pragueDate(e.starts_at)}</time><span>{e.name}</span><b>{p?.attendance_excused?'Omluveno':p?.attended===true?'Přítomen':p?.attended===false?'Nepřítomen':'Neověřeno'}</b></li>})}</ul></details>:<p className="muted">Ve zvoleném období nejsou záznamy.</p>}
   </section>;
  })}</div>
 </section></EventDialog>;
}
