import type {ClubData} from './clubData';
import {overviewStats} from './overview';
export function AttendanceInsights({data,now}:{data:ClubData;now:number}){
 const stats=overviewStats(data,now);
 return <details className="coach-panel attendance-insights"><summary>Vývoj docházky a pravidelnost členů · 8 týdnů</summary><p className="muted">Pouze ověřená docházka proběhlých tréninků, bez omluvených absencí.</p><div className="attendance-bars" aria-label="Týdenní docházka">{stats.buckets.map(b=><div key={b.start} title={b.start+': '+(b.rate===null?'bez záznamů':b.rate+' %')+' · '+b.known+' ověřeno'}><span style={{height:b.rate===null?'3px':Math.max(b.rate,3)+'%'}}/><small>{b.rate===null?'—':b.rate+' %'}</small></div>)}</div><h3>Pravidelnost členů</h3>{stats.leaders.map(row=><div className="regularity-row" key={row.member.id}><b>{row.member.name}<small>{row.yes} z {row.known} ověřených</small></b><strong>{row.rate} %</strong></div>)}{!stats.leaders.length&&<p className="muted">Zatím nejsou ověřené záznamy členů.</p>}</details>;
}
