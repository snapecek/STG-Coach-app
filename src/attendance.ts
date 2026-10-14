import type {ClubData,EventRow,ParticipationRow} from './clubData';
import {pragueDate,reviewMembers} from './management';
export function attendanceEvents(data:ClubData,month:string,now:number){const all=data.events.filter(e=>e.event_kind==='training'&&e.status==='scheduled'&&(!month||pragueDate(e.starts_at).startsWith(month))).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));if(month)return all;return [...all.filter(e=>Date.parse(e.starts_at)<=now).slice(-6),...all.filter(e=>Date.parse(e.starts_at)>now).slice(0,4)];}
export function attendanceState(p:ParticipationRow|undefined,future:boolean){return future?p?.response==='yes'?(p.seat_status==='waiting'?'waiting':'yes'):p?.response||'unknown':p?.attendance_excused?'excused':p?.attended===true?'present':p?.attended===false?'absent':'unverified';}
export function attendanceRate(rows:ParticipationRow[]){const known=rows.filter(p=>p.attended!=null&&!p.attendance_excused);return known.length?Math.round(100*known.filter(p=>p.attended).length/known.length):null;}
export const attendanceRoster=(data:ClubData,event:EventRow)=>new Set(reviewMembers(data,event).map(m=>m.id));
