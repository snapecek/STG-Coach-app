import type {ClubData,EventRow,MemberRow} from './clubData';
export const pragueDate=(timestamp:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
export const pragueTime=(timestamp:string)=>new Intl.DateTimeFormat('cs-CZ',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp));
export const eventEnd=(event:EventRow)=>new Date(event.starts_at).getTime()+event.duration_minutes*60000;
export const pendingReviews=(events:EventRow[],now=Date.now())=>events.filter(e=>e.status==='scheduled'&&!e.completed_at&&eventEnd(e)<=now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
export function reviewMembers(data:ClubData,event:EventRow):MemberRow[]{return data.members.filter(m=>!m.removed_at||Date.parse(m.removed_at)>Date.parse(event.starts_at)||data.participation.some(p=>p.member_id===m.id&&p.event_id===event.id));}
export function reviewReady(data:ClubData,event:EventRow,now=Date.now()){const roster=reviewMembers(data,event);return event.status==='scheduled'&&eventEnd(event)<=now&&!!event.actual_notes.trim()&&roster.length>0&&roster.every(m=>data.participation.some(p=>p.member_id===m.id&&p.event_id===event.id&&p.attended!==null));}
export function calendarCells(year:number,month:number){const first=new Date(Date.UTC(year,month,1));const mondayOffset=(first.getUTCDay()+6)%7;return Array.from({length:42},(_,i)=>new Date(Date.UTC(year,month,1-mondayOffset+i)).toISOString().slice(0,10));}
