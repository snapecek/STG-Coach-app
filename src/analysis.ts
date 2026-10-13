import type {ClubData,EventRow} from './clubData';
import {pragueDate} from './management';
export type AnalysisFilters={from:string;to:string;type:string;kind:string;memberId:string;equipment:string};
export const noFilters:AnalysisFilters={from:'',to:'',type:'',kind:'',memberId:'',equipment:''};
export function equipmentTags(input:string){const tags=[...new Set(input.split(/[,\n]/).map(s=>s.trim().toLocaleLowerCase('cs')).filter(Boolean))];if(tags.length>30||tags.some(t=>t.length>40))throw new Error('Zadejte nejvýše 30 pomůcek, každou do 40 znaků.');return tags;}
export function filterAnalysis(data:ClubData,filters:AnalysisFilters):EventRow[]{
 if(filters.from&&filters.to&&filters.from>filters.to)return [];
 return data.events.filter(e=>{if(!e.completed_at||e.status!=='scheduled')return false;const date=pragueDate(e.starts_at);return (!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to)&&(!filters.type||e.type===filters.type)&&(!filters.kind||e.event_kind===filters.kind)&&(!filters.equipment||e.equipment.includes(filters.equipment))&&(!filters.memberId||data.participation.some(p=>p.event_id===e.id&&p.member_id===filters.memberId&&p.attended===true));});
}
export function analysisSummary(data:ClubData,events:EventRow[],memberId=''){
 const ids=new Set(events.map(e=>e.id));const attendance=data.participation.filter(p=>ids.has(p.event_id)&&(!memberId||p.member_id===memberId));
 const confirmed=attendance.filter(p=>p.attended!==null);const present=confirmed.filter(p=>p.attended===true).length;
 const byType=[...new Set(events.map(e=>e.type))].sort().map(type=>({type,count:events.filter(e=>e.type===type).length}));
 const byEquipment=[...new Set(events.flatMap(e=>e.equipment))].sort().map(name=>({name,count:events.filter(e=>e.equipment.includes(name)).length}));
 return {count:events.length,minutes:events.reduce((n,e)=>n+(e.actual_duration_minutes??0),0),recordedDurations:events.filter(e=>e.actual_duration_minutes!==null).length,present,attendancePercent:confirmed.length?Math.round(present/confirmed.length*100):null,byType,byEquipment,members:data.members.filter(m=>!memberId||m.id===memberId).map(m=>({id:m.id,name:m.name,archived:!!m.removed_at,present:attendance.filter(p=>p.member_id===m.id&&p.attended===true).length}))};
}
