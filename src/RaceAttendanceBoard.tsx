import {AttendancePeoplePagination} from './AttendancePeoplePagination';
import {sortAttendancePeople,attendancePages} from './attendancePeople';
import {useState} from 'react';
import type {ClubData,ParticipationRow} from './clubData';
import {attendanceEvents,attendanceState} from './attendance';
import {pragueDate} from './management';

const responses={yes:'Zúčastním se',no:'Nezúčastním se',maybe:'Možná',companion:'Doprovod'};
const actual={present:'Zúčastnil/a se',absent:'Nezúčastnil/a se',excused:'Omluven/a',unverified:'Neověřeno'};
const symbols:Record<string,string>={present:'✓',absent:'×',excused:'O',unverified:'?',yes:'Ano',no:'Ne',maybe:'Mož.',companion:'Dop.',unknown:'?'};
function cell(p:ParticipationRow,future:boolean){
 const state=attendanceState(p,future);
 const response=p.response?responses[p.response]:'Bez odpovědi';
 return {state,label:future?response:actual[state as keyof typeof actual],note:future?'':p.response==='companion'?'Doprovod':p.attended==null?response:''};
}
export function RaceAttendanceBoard({data,now,onOpen}:{data:ClubData;now:number;onOpen:(id:string)=>void}){
 const [month,setMonth]=useState(''),[search,setSearch]=useState(''),[pages,setPages]=useState({member:0,guest:0}),[columns,setColumns]=useState(0);
 const events=attendanceEvents(data,month,now,'race'),ids=new Set(events.map(e=>e.id)),visible=events.slice(columns*10,columns*10+10);
 const members=sortAttendancePeople(data.members.filter(m=>(!m.removed_at||data.participation.some(p=>p.member_id===m.id&&ids.has(p.event_id)))&&m.name.toLocaleLowerCase('cs').includes(search.toLocaleLowerCase('cs'))));
 const memberIds=new Set(members.map(m=>m.id));
 const rows=data.participation.filter(p=>ids.has(p.event_id)&&memberIds.has(p.member_id));
 const pastIds=new Set(events.filter(e=>Date.parse(e.starts_at)<=now).map(e=>e.id));
 const confirmed=rows.filter(p=>pastIds.has(p.event_id)&&p.attended===true);
 const next=events.find(e=>Date.parse(e.starts_at)>now);
 const months=[...new Set([pragueDate(new Date(now).toISOString()).slice(0,7),...data.events.filter(e=>e.event_kind==='race').map(e=>pragueDate(e.starts_at).slice(0,7))])].sort().reverse();
 const date=(value:string)=>new Date(value).toLocaleDateString('cs-CZ',{timeZone:'Europe/Prague',day:'numeric',month:'numeric'});
 return <div className="attendance-board race-attendance-board">
  <div className="attendance-toolbar"><p className="muted">{pastIds.size} minulých a {events.length-pastIds.size} nadcházejících závodů · {members.filter(m=>m.kind==='member').length} členů · {members.filter(m=>m.kind==='guest').length} hostů</p><div className="attendance-filters"><select aria-label="Období závodní docházky" value={month} onChange={e=>{setMonth(e.target.value);setPages({member:0,guest:0});setColumns(0)}}><option value="">6 posledních + 4 nadcházející</option>{months.map(m=><option key={m} value={m}>{new Date(m+'-15T12:00:00Z').toLocaleDateString('cs-CZ',{month:'long',year:'numeric'})}</option>)}</select><input aria-label="Hledat člena v závodní docházce" placeholder="Hledat člena nebo hosta…" value={search} onChange={e=>{setSearch(e.target.value);setPages({member:0,guest:0})}}/></div></div>
  <div className="attendance-stats">{[['Potvrzené účasti',String(confirmed.length),`${confirmed.filter(p=>p.response==='companion').length} z toho jako doprovod`],['Neověřené účasti',String(rows.filter(p=>pastIds.has(p.event_id)&&p.attended==null).length),'Přihlášení na proběhlé závody bez potvrzené docházky'],['Nejbližší závod',next?date(next.starts_at):'—',next?.name||'Žádný nadcházející termín']].map(([title,value,note])=><article key={title}><small>{title}</small><strong>{value}</strong><span className="muted">{note}</span></article>)}</div>
  <section className="attendance-panel"><p className="muted">Minulé závody zobrazují skutečnou účast potvrzenou trenérem, budoucí závody odpověď člena. Doprovod je označen zvlášť. Kliknutím otevřete závod a jeho docházku.</p>
   <div className="attendance-legend">{[['present','✓','Zúčastnil/a se'],['absent','×','Nezúčastnil/a se'],['unverified','?','Neověřeno'],['companion','Dop.','Doprovod']].map(([state,symbol,label])=><span key={state}><b className={'attendance-cell '+state}>{symbol}</b>{label}</span>)}<span>— Bez přihlášení</span></div>
   <div className="attendance-scroll" tabIndex={0} aria-label="Tabulka účasti na závodech, vodorovně posuvná"><table className="attendance-matrix"><thead><tr><th scope="col">Jméno</th>{visible.map(e=><th scope="col" key={e.id}><button onClick={()=>onOpen(e.id)} title={e.name}>{date(e.starts_at)}<br/>{e.type}<small>{e.name}</small></button></th>)}<th scope="col">Potvrzené účasti</th></tr></thead>{attendancePages(members,pages).map(section=><tbody key={section.kind} aria-label={section.label}><tr className="attendance-section"><th colSpan={visible.length+2} scope="rowgroup">{section.label}</th></tr>{section.people.map(m=><tr key={m.id}><th scope="row">{m.name}{m.removed_at&&<small>{m.kind==='guest'?'Archivovaný host':'Archivovaný člen'}</small>}</th>{visible.map(e=>{const p=rows.find(p=>p.event_id===e.id&&p.member_id===m.id),future=Date.parse(e.starts_at)>now;if(!p)return <td key={e.id}><span title="Bez přihlášení">—</span></td>;const {state,label,note}=cell(p,future);return <td key={e.id}><button className={'attendance-cell race-attendance-cell '+state+(future?' future':'')} aria-label={`${m.name} · ${e.name} · ${label}${note?' · '+note:''}`} title={label+(note?' · '+note:'')} onClick={()=>onOpen(e.id)}>{symbols[state]}<small>{note||label}</small></button></td>})}<td className="attendance-percent">{confirmed.filter(p=>p.member_id===m.id).length}</td></tr>)}{section.total>10&&<tr><td colSpan={visible.length+2}><AttendancePeoplePagination section={section} onPage={page=>setPages(p=>({...p,[section.kind]:page}))}/></td></tr>}</tbody>)}<tfoot><tr><th scope="row">Celkem</th>{visible.map(e=><td key={e.id}>{Date.parse(e.starts_at)>now?`${rows.filter(p=>p.event_id===e.id&&p.response==='yes').length} závodníků · ${rows.filter(p=>p.event_id===e.id&&p.response==='companion').length} doprovod`:`${confirmed.filter(p=>p.event_id===e.id).length} potvrzených`}</td>)}<td>{confirmed.length}</td></tr></tfoot></table></div>
   {!members.length&&<p className="muted">Žádní členové ani hosté pro vybraný filtr.</p>}{!events.length&&<p className="muted">V tomto období nejsou žádné závody.</p>}
   <div className="attendance-pagination"><button disabled={!columns} onClick={()=>setColumns(v=>v-1)}>Předchozí závody</button><span>{events.length?columns*10+1:0}–{Math.min((columns+1)*10,events.length)} z {events.length}</span><button disabled={(columns+1)*10>=events.length} onClick={()=>setColumns(v=>v+1)}>Další závody</button></div>
  </section>
 </div>;
}
