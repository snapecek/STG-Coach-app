import {describe,it,expect} from 'vitest';
import {weekDates,overviewStats,coachWorkQueue} from './overview';
import type {ClubData,EventRow} from './clubData';
const now=Date.parse('2026-10-14T14:00:00Z');
const event=(id:string,patch:Partial<EventRow>={}):EventRow=>({id,club_id:'club',template_id:null,name:'Fiktivní trénink',starts_at:'2026-10-13T16:00:00Z',place:'Park',type:'Běh',plan:'',duration_minutes:60,event_kind:'training',status:'scheduled',actual_notes:'',completed_at:null,completed_by:null,actual_duration_minutes:null,perceived_effort:null,equipment:[],...patch});
const data=():ClubData=>({members:[{id:'m',club_id:'club',name:'Fiktivní člen',kind:'member',removed_at:null,purge_after:null}],events:[],templates:[],participation:[]});
describe('Přehled trenéra',()=>{
 it('určí pondělní týden podle Prahy i před půlnocí UTC',()=>expect(weekDates(Date.parse('2026-10-18T23:30:00Z'))).toEqual(['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']));
 it('bez potvrzené docházky neukazuje vymyšlené procento',()=>{const d=data();d.events=[event('e')];d.participation=[{club_id:'club',event_id:'e',member_id:'m',attended:null,response:'yes',confirmed_by:null}];const s=overviewStats(d,now);expect(s.rate).toBeNull();expect(s.known).toBe(0);expect(s.leaders).toEqual([])});
 it('počítá jen skutečně ověřenou účast proběhlých tréninků, bez závodů a zrušených',()=>{const d=data();d.events=[event('a'),event('b'),event('race',{event_kind:'race'}),event('cancel',{status:'cancelled'}),event('future',{starts_at:'2026-10-20T16:00:00Z'})];d.participation=d.events.map(e=>({club_id:'club',event_id:e.id,member_id:'m',response:null,attended:e.id==='a',confirmed_by:null}));const s=overviewStats(d,now);expect(s.known).toBe(2);expect(s.rate).toBe(50);expect(s.buckets[7].rate).toBe(50);expect(s.leaders[0].known).toBe(2)});
 it('objem bere z dokončených tréninků aktuálního týdne a preferuje skutečnou délku',()=>{const d=data();d.events=[event('a',{completed_at:'2026-10-13T19:00:00Z',actual_duration_minutes:45}),event('b'),event('old',{starts_at:'2026-10-05T16:00:00Z',completed_at:'2026-10-05T19:00:00Z'})];expect(overviewStats(d,now).volume).toEqual([['Běh',45]])});
});
it('upozorní na delší absenci pouze s doloženou dřívější účastí a nedávnou absencí',()=>{const d=data();d.events=[event('old',{starts_at:'2026-09-01T16:00:00Z'}),event('recent')];d.participation=[{club_id:'club',event_id:'old',member_id:'m',response:'yes',attended:true,confirmed_by:null},{club_id:'club',event_id:'recent',member_id:'m',response:'no',attended:false,confirmed_by:null}];expect(overviewStats(d,now).attention.map(a=>a.member.id)).toEqual(['m']);d.participation[1].attended=null;expect(overviewStats(d,now).attention).toEqual([])});

it('sloučí nedokončenou událost a úkol do jednoho řádku se zachovanými cíli',()=>{const d=data();d.events=[event('e'),event('cancelled',{status:'cancelled'})];const tasks=[{id:'t',event_id:'e',title:'Pomůcky',assignee_id:null,due_at:null,completed_at:null},{id:'ignored',event_id:'cancelled',title:'Zrušený úkol',assignee_id:null,due_at:null,completed_at:null}];const work=coachWorkQueue(d,tasks,now);expect(work).toHaveLength(1);expect(work[0].event.id).toBe('e');expect(work[0].tabs).toEqual(['attendance','record','tasks']);expect(work[0].labels.some(l=>l.includes('organizačních'))).toBe(true)});
it('otevřený závod bez přihlášených nevytváří povinnost odpovědět všem členům',()=>{const d=data();d.events=[event('race',{event_kind:'race',starts_at:'2026-10-15T16:00:00Z'})];expect(coachWorkQueue(d,[],now)).toEqual([])});

it('pravidelnost obsahuje všechny členy i hosty s ověřenými záznamy, bez limitu pěti',()=>{
 const d=data();d.events=[event('e'),event('cancel',{status:'cancelled'}),event('race',{event_kind:'race'})];
 d.members=Array.from({length:7},(_,i)=>({...d.members[0],id:'m'+i,name:'Člen '+String(7-i)}));
 d.members.push({...d.members[0],id:'guest',name:'Host Adam',kind:'guest',event_guest:true,removed_at:'2026-10-14T10:00:00Z'});
 d.members.push({...d.members[0],id:'unknown',name:'Bez záznamů'}, {...d.members[0],id:'excused',name:'Omluvený'}, {...d.members[0],id:'cancelled',name:'Zrušený'});
 d.participation=d.members.slice(0,8).map(m=>({club_id:'club',event_id:'e',member_id:m.id,response:'yes',attended:true,confirmed_by:'coach'}));
 d.participation.push({club_id:'club',event_id:'e',member_id:'unknown',response:'yes',attended:null,confirmed_by:null},{club_id:'club',event_id:'e',member_id:'excused',response:'no',attended:false,attendance_excused:true,confirmed_by:'coach'},{club_id:'club',event_id:'cancel',member_id:'cancelled',response:'yes',attended:true,confirmed_by:'coach'});
 const s=overviewStats(d,now);expect(s.regularity.map(r=>r.member.id)).toEqual(['m6','m5','m4','m3','m2','m1','m0','guest']);expect(s.regularity.at(-1)).toMatchObject({known:1,yes:1,rate:100});expect(s.rate).toBe(100);expect(s.known).toBe(8);expect(s.leaders).toHaveLength(5);expect(s.leaders.every(r=>r.member.kind==='member')).toBe(true);
});
