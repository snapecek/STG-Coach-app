import {attendanceSections} from './attendancePeople';
import type {ClubData} from './clubData';
import {overviewStats} from './overview';
export function AttendanceInsights({data,now}:{data:ClubData;now:number}){
 const stats=overviewStats(data,now);
 return <details className="coach-panel attendance-insights"><summary>Vývoj docházky a pravidelnost účasti · 8 týdnů</summary><p className="muted">Pouze ověřená docházka proběhlých tréninků, bez omluvených absencí.</p><div className="attendance-bars" aria-label="Týdenní docházka">{stats.buckets.map(b=><div key={b.start} title={b.start+': '+(b.rate===null?'bez záznamů':b.rate+' %')+' · '+b.known+' ověřeno'}><span style={{height:b.rate===null?'3px':Math.max(b.rate,3)+'%'}}/><small>{b.rate===null?'—':b.rate+' %'}</small></div>)}</div>{attendanceSections(stats.regularity.map(row=>({...row,kind:row.member.kind}))).map(section=><section key={section.kind} aria-label={'Pravidelnost · '+section.label}><h3>{section.label}</h3>{section.people.map(row=><div className="regularity-row" key={row.member.id}><b>{row.member.name}{row.member.removed_at?' · archiv':''}<small>{row.yes} z {row.known} ověřených</small></b><strong>{row.rate} %</strong></div>)}</section>)}{!stats.regularity.length&&<p className="muted">Zatím nejsou ověřené záznamy členů ani hostů.</p>}</details>;
}
