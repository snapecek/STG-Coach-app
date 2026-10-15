import {it,expect} from 'vitest';
import {attendanceEvents,attendanceRate,attendanceState,attendanceRoster} from './attendance';
import type {ParticipationRow,ClubData,EventRow} from './clubData';
const p=(patch:Partial<ParticipationRow>={}):ParticipationRow=>({club_id:'c',event_id:'e',member_id:'m',response:null,attended:null,confirmed_by:null,...patch});
it('rozlišuje omluvení, neověřenou docházku a skutečnou absenci',()=>{expect(attendanceState(p({response:'no'}),false)).toBe('unverified');expect(attendanceState(p({attendance_excused:true,attended:false}),false)).toBe('excused');expect(attendanceState(p({attended:false}),false)).toBe('absent')});
it('pro budoucnost používá odpověď a rozlišuje čekací listinu',()=>{expect(attendanceState(p({response:'yes',seat_status:'waiting',attended:true}),true)).toBe('waiting');expect(attendanceState(undefined,true)).toBe('unknown');expect(attendanceState(p({response:'maybe'}),true)).toBe('maybe')});
it('do procenta nepočítá omluvené ani neověřené a chybějící není nula',()=>{expect(attendanceRate([p({attended:true}),p({attended:false}),p({attended:false,attendance_excused:true}),p()])).toBe(50);expect(attendanceRate([p(),p({attended:false,attendance_excused:true})])).toBeNull()});
it('výchozí okno ukáže šest minulých a čtyři budoucí a vyřadí závody i zrušené',()=>{const now=Date.parse('2026-10-14T12:00:00Z');const d={members:[],templates:[],participation:[],events:Array.from({length:25},(_,i)=>({id:String(i),starts_at:new Date(now+(i-12)*86400000).toISOString(),event_kind:'training',status:'scheduled'} as EventRow))} as ClubData;d.events.push({...d.events[0],id:'race',event_kind:'race'},{...d.events[0],id:'cancel',status:'cancelled'});expect(attendanceEvents(d,'',now).map(e=>e.id)).toEqual(['7','8','9','10','11','12','13','14','15','16']);expect(attendanceEvents(d,'2026-11',now)).toHaveLength(0)});
it('skupinový trénink neotevře docházku lidem mimo uloženou soupisku',()=>{const d={members:[{id:'m',removed_at:null},{id:'other',removed_at:null}],participation:[p()],events:[],templates:[]} as unknown as ClubData;expect([...attendanceRoster(d,{id:'e',roster_only:true,event_kind:'training'} as EventRow)]).toEqual(['m'])});

it('závodní přehled vybírá jen závody a zahrne historii i budoucí termíny',()=>{
 const now=Date.parse('2026-10-14T12:00:00Z');
 const race:EventRow={id:'past',club_id:'c',template_id:null,name:'Závod',place:'Park',type:'OCR',plan:'',starts_at:'2026-10-10T10:00:00Z',duration_minutes:60,event_kind:'race',status:'scheduled',actual_notes:'',completed_at:null,completed_by:null,actual_duration_minutes:null,perceived_effort:null,equipment:[]};
 const d:ClubData={members:[],templates:[],participation:[],events:[race,{...race,id:'future',starts_at:'2026-11-10T10:00:00Z'},{...race,id:'cancelled',status:'cancelled'},{...race,id:'training',event_kind:'training'}]};
 expect(attendanceEvents(d,'',now,'race').map(e=>e.id)).toEqual(['past','future']);expect(attendanceEvents(d,'2026-11',now,'race').map(e=>e.id)).toEqual(['future']);expect(attendanceState(p({response:'companion'}),true)).toBe('companion');expect(attendanceState(p({response:'yes'}),false)).toBe('unverified');
});
