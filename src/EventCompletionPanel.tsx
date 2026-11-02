import type {ClubData,EventRow} from './clubData';
import type {RaceResult} from './raceResults';
import {eventCompletionIssues,eventEnd} from './management';

export function EventCompletionPanel({data,event,now,results,teamIssues=[],teamsReady=true,busy,onComplete,onSkip}:{data:ClubData;event:EventRow;now:number;results:RaceResult[];teamIssues?:string[];teamsReady?:boolean;busy:boolean;onComplete:()=>void;onSkip:()=>void}){
 const issues=eventCompletionIssues(data,event,now,results);
 const teamProblems=event.event_kind==='race'&&!teamsReady?(teamIssues.length?teamIssues:['Týmové výsledky zatím nejsou ověřené. Otevřete Výsledky → Týmy a zkontrolujte načtení.']):[];
 const eligible=event.status==='scheduled'&&eventEnd(event)<=now;
 return <div className="event-completion-panel">
  {!event.completed_at&&(issues.length>0||teamProblems.length>0)&&<section className="completion-checklist" aria-label="Co chybí k dokončení události"><h3>Co chybí k dokončení události</h3><ul>{issues.map(issue=><li key={issue.kind}>{issue.kind==='cancelled'?'Událost je zrušená. Nejdříve ji obnovte.':issue.kind==='time'?`Událost ještě neskončila. Konec: ${new Date(eventEnd(event)).toLocaleString('cs-CZ',{timeZone:'Europe/Prague'})}.`:issue.kind==='notes'?'Chybí uložený skutečný průběh v deníku.':issue.kind==='empty'?'Soupiska účastníků je prázdná.':<>{issue.kind==='attendance'?'Nepotvrzená docházka (Účast)':issue.kind==='results'?'Chybí výsledek (čas, DNF nebo DNS)':'Docházka neodpovídá výsledku (DNS = nepřítomen, dokončil/DNF = přítomen)'}: {issue.members?.map(m=>m.name).join(', ')}.</>}</li>)}{teamProblems.map(problem=><li key={problem}>{problem}</li>)}</ul></section>}
  {!event.completed_at&&!issues.length&&!teamProblems.length&&<p className="notice" role="status">Vše potřebné je uložené. Událost můžete dokončit.</p>}
  <div className="journal-completion-actions"><button className="primary" disabled={busy||!!event.completed_at||!eligible||issues.length>0||teamProblems.length>0} onClick={onComplete}>{event.completed_at?'Dokončeno':'Dokončit událost'}</button>{!event.completed_at&&<button disabled={busy||!eligible} onClick={onSkip}>Ukončit bez doplnění dat</button>}</div>
  {!event.completed_at&&<p className="muted">Ukončení bez doplnění zachová uložené údaje. Chybějící docházka a výsledky zůstanou nevyplněné. Další změny záznam znovu otevřou ke kontrole.</p>}
 </div>;
}
