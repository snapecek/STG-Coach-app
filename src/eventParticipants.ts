import type {ParticipationRow} from './clubData';
import {compareSurnames} from './attendancePeople';

type Response = Pick<ParticipationRow, 'response' | 'seat_status'>;
type Group = 'yes' | 'companion' | 'waiting' | 'maybe' | 'no' | 'unknown';

export function eventParticipantGroups<T extends {name:string;kind?:'member'|'guest'}>(people:T[], response:(person:T)=>Response|undefined, race=false){
 const labels:Record<Group,string>={yes:race?'Zúčastní se':'Přijdou',companion:'Doprovod',waiting:'Čekací listina',maybe:'Možná',no:race?'Nezúčastní se':'Nepřijdou',unknown:'Bez odpovědi'};
 const groups:Record<Group,T[]>={yes:[],companion:[],waiting:[],maybe:[],no:[],unknown:[]};
 for(const person of people){
  const r=response(person);
  const key:Group=r?.response==='yes'&&r.seat_status==='waiting'?'waiting':r?.response||'unknown';
  groups[key].push(person);
 }
 return (Object.keys(groups) as Group[]).filter(key=>groups[key].length>0).map(key=>({key,label:labels[key],people:groups[key].sort((a,b)=>Number(a.kind==='guest')-Number(b.kind==='guest')||compareSurnames(a,b))}));
}
