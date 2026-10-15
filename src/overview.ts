import type {ClubData} from './clubData';
import {eventEnd,pragueDate,reviewMembers,participationSummary} from './management';
export function weekDates(now:number){const today=pragueDate(new Date(now).toISOString()),date=new Date(today+'T12:00:00Z'),offset=(date.getUTCDay()+6)%7;return Array.from({length:7},(_,i)=>new Date(date.getTime()+(i-offset)*86400000).toISOString().slice(0,10));}
export function overviewStats(data:ClubData,now:number){
 const days=weekDates(now),first=days[0];
 const history=data.events.filter(e=>e.event_kind==='training'&&e.status==='scheduled'&&eventEnd(e)<=now);
 const buckets=Array.from({length:8},(_,i)=>{const start=new Date(Date.parse(first+'T12:00:00Z')-(7-i)*7*86400000).toISOString().slice(0,10),end=new Date(Date.parse(start+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);const ids=new Set(history.filter(e=>{const d=pragueDate(e.starts_at);return d>=start&&d<end}).map(e=>e.id)),rows=data.participation.filter(p=>ids.has(p.event_id)&&p.attended!==null&&!p.attendance_excused);return {start,known:rows.length,yes:rows.filter(p=>p.attended).length,rate:rows.length?Math.round(rows.filter(p=>p.attended).length/rows.length*100):null};});
 const recentStart=buckets[0].start,ids=new Set(history.filter(e=>pragueDate(e.starts_at)>=recentStart).map(e=>e.id)),known=data.participation.filter(p=>ids.has(p.event_id)&&p.attended!==null&&!p.attendance_excused);
 const leaders=data.members.filter(m=>!m.removed_at&&m.kind==='member').map(m=>{const rows=known.filter(p=>p.member_id===m.id),yes=rows.filter(p=>p.attended).length;return {member:m,known:rows.length,yes,rate:rows.length?Math.round(yes/rows.length*100):null};}).filter(m=>m.known>0).sort((a,b)=>(b.rate??0)-(a.rate??0)||b.known-a.known||a.member.name.localeCompare(b.member.name,'cs')).slice(0,5);
 const volume=new Map<string,number>();for(const e of history.filter(e=>e.completed_at&&days.includes(pragueDate(e.starts_at))))volume.set(e.type,(volume.get(e.type)||0)+(e.actual_duration_minutes??e.duration_minutes));
 const attention= data.members.filter(m=>!m.removed_at&&m.kind==='member').flatMap(member=>{const rows=data.participation.filter(p=>p.member_id===member.id&&history.some(e=>e.id===p.event_id));const present=rows.filter(p=>p.attended===true).map(p=>history.find(e=>e.id===p.event_id)!).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));const last=present[0];const missed=rows.filter(p=>p.attended===false&&!p.attendance_excused).map(p=>history.find(e=>e.id===p.event_id)!).filter(e=>Date.parse(e.starts_at)>=now-21*86400000).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));return last&&Date.parse(last.starts_at)<now-21*86400000&&missed.length?[{member,last:last.starts_at,event:missed[0]}]:[];}).slice(0,4);
 const rateOf=(items:typeof buckets)=>{const n=items.reduce((n,b)=>n+b.known,0);return n?items.reduce((n,b)=>n+b.yes,0)/n*100:null},before=rateOf(buckets.slice(0,4)),after=rateOf(buckets.slice(4));const delta=before!==null&&after!==null?Math.round(after-before):null;
 return {days,buckets,leaders,attention,delta,volume:[...volume],known:known.length,rate:known.length?Math.round(known.filter(p=>p.attended).length/known.length*100):null};
}

// One actionable row per event, even when notes, attendance and tasks all need work.
export function coachWorkQueue(data:ClubData,tasks:import('./eventTasks').EventTask[],now:number){
 const rows=new Map<string,{event:import('./clubData').EventRow;labels:string[];tabs:('attendance'|'record'|'tasks')[];priority:number}>();
 function add(event:import('./clubData').EventRow,label:string,tab:'attendance'|'record'|'tasks',priority:number){let row=rows.get(event.id);if(!row){row={event,labels:[],tabs:[],priority};rows.set(event.id,row)}if(!row.labels.includes(label))row.labels.push(label);if(!row.tabs.includes(tab))row.tabs.push(tab);row.priority=Math.min(row.priority,priority);}
 for(const e of data.events.filter(e=>e.status==='scheduled')){
  if(eventEnd(e)<=now&&!e.completed_at){const roster=reviewMembers(data,e),missing=roster.filter(m=>!data.participation.some(p=>p.event_id===e.id&&p.member_id===m.id&&p.attended!=null)).length;if(missing)add(e,`${missing} neověřených účastí`,'attendance',0);add(e,e.event_kind==='race'?'Doplnit výsledky a uzavřít závod':!e.actual_notes.trim()?'Doplnit průběh a uzavřít trénink':'Uzavřít trénink','record',0);}
  if(Date.parse(e.starts_at)>now&&Date.parse(e.starts_at)<=now+7*86400000){const unknown=participationSummary(data,e).unknown;if(unknown)add(e,`${unknown} bez odpovědi`,'attendance',2);}
  const pending=tasks.filter(t=>t.event_id===e.id&&!t.completed_at);if(pending.length)add(e,`${pending.length} organizačních úkolů${pending.some(t=>t.due_at&&Date.parse(t.due_at)<now)?' · po termínu':''}`,'tasks',pending.some(t=>t.due_at&&Date.parse(t.due_at)<now)?0:1);
 }
 for(const a of overviewStats(data,now).attention)add(a.event,`Delší absence: ${a.member.name}`,'attendance',1);
 return [...rows.values()].sort((a,b)=>a.priority-b.priority||a.event.starts_at.localeCompare(b.event.starts_at)||a.event.id.localeCompare(b.event.id));
}
