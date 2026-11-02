import {describe,it,expect} from 'vitest';
import {equipmentTags,filterAnalysis,analysisSummary,analysisAttendance,noFilters} from './analysis';
import type {ClubData,EventRow} from './clubData';
const event:EventRow={id:'done',club_id:'club',template_id:null,name:'Fiktivní běh',starts_at:'2026-10-12T22:30:00Z',place:'Park',type:'Běh',plan:'Plán',duration_minutes:60,event_kind:'training',status:'scheduled',actual_notes:'Průběh',completed_at:'2026-10-13T00:30:00Z',completed_by:'coach',actual_duration_minutes:45,perceived_effort:6,equipment:['gumy','bosu']};
const data:ClubData={members:[{id:'a',club_id:'club',name:'Fiktivní A',kind:'member',removed_at:null,purge_after:null},{id:'b',club_id:'club',name:'Fiktivní B',kind:'guest',removed_at:null,purge_after:null}],templates:[],events:[event,{...event,id:'pending',completed_at:null},{...event,id:'cancelled',status:'cancelled'},{...event,id:'race',event_kind:'race',type:'Kondice',starts_at:'2026-10-14T10:00:00Z',actual_duration_minutes:null,equipment:[]}],participation:[{club_id:'club',event_id:'done',member_id:'a',response:'maybe',attended:true,confirmed_by:'coach'},{club_id:'club',event_id:'done',member_id:'b',response:'yes',attended:false,confirmed_by:'coach'}]};
describe('Analýza',()=>{
 it('započítá pouze dokončené nezrušené události',()=>expect(filterAnalysis(data,noFilters).map(e=>e.id)).toEqual(['done','race']));
 it('filtruje inkluzivně podle pražského data',()=>expect(filterAnalysis(data,{...noFilters,from:'2026-10-13',to:'2026-10-13'}).map(e=>e.id)).toEqual(['done']));
 it('odmítá obrácené období',()=>expect(filterAnalysis(data,{...noFilters,from:'2026-10-14',to:'2026-10-13'})).toEqual([]));
 it('kombinuje člena, druh, typ a pomůcku',()=>expect(filterAnalysis(data,{...noFilters,memberId:'a',kind:'training',type:'Běh',equipment:'gumy'}).map(e=>e.id)).toEqual(['done']));
 it('RSVP není skutečná docházka',()=>expect(filterAnalysis(data,{...noFilters,memberId:'b'})).toEqual([]));
 it('neodhaduje nevyplněné skutečné minuty plánem',()=>{const summary=analysisSummary(data,filterAnalysis(data,noFilters));expect(summary.minutes).toBe(45);expect(summary.recordedDurations).toBe(1);expect(summary.present).toBe(1);expect(summary.attendancePercent).toBe(50)});
 it('statistiky pomůcek nezdvojují jednu událost',()=>expect(analysisSummary(data,[event]).byEquipment).toEqual([{name:'bosu',count:1},{name:'gumy',count:1}]));
 it('normalizuje a odstraní duplicitní pomůcky',()=>expect(equipmentTags(' Gumy, BOSU, gumy\nKettlebell ')).toEqual(['gumy','bosu','kettlebell']));
 it('odmítá nepřiměřený počet pomůcek',()=>expect(()=>equipmentTags(Array.from({length:31},(_,i)=>'tag'+i).join(','))).toThrow());
});

describe('Závody v analýze',()=>{
 it('nepřevádí starší závodní údaje na zaměření a minuty tréninku',()=>{const race={...event,event_kind:'race' as const,type:'Síla',actual_duration_minutes:180};const summary=analysisSummary(data,[race]);expect(summary.minutes).toBe(0);expect(summary.recordedDurations).toBe(0);expect(summary.byType).toEqual([{type:'Závody',count:1}]);expect(summary.byEquipment).toEqual([])});
 it('tréninkové filtry nezahrnou starší závod se stejnými hodnotami',()=>{const race={...event,id:'race',event_kind:'race' as const};const mixed={...data,events:[race]};expect(filterAnalysis(mixed,{...noFilters,type:'Běh'})).toEqual([]);expect(filterAnalysis(mixed,{...noFilters,equipment:'gumy'})).toEqual([])});
});

it('v analýze zachová skutečnou vzdálenost a rozliší zaznamenanou nulu od chybějící hodnoty',()=>{const s=analysisSummary(data,[{...event,actual_distance_km:0},{...event,id:'second',actual_distance_km:11.2},{...event,id:'unknown',actual_distance_km:null},{...event,id:'race-distance',event_kind:'race',actual_distance_km:42}]);expect(s.distance).toBe(11.2);expect(s.recordedDistances).toBe(2)});

it('ve statistice zachová hosty i jejich potvrzenou účast za abecedně seřazenými členy',()=>{
 const members=[{...data.members[0],id:'z',name:'Adam Žák'},{...data.members[1],id:'g',name:'Host Adam',event_guest:true},{...data.members[0],id:'c',name:'Zdeněk Černý'}];
 const participation=members.map(m=>({club_id:'club',event_id:'done',member_id:m.id,response:'yes' as const,attended:true,confirmed_by:'coach'}));
 const s=analysisSummary({...data,members,participation},[event]);expect(s.members.map(m=>[m.name,m.kind,m.present])).toEqual([['Zdeněk Černý','member',1],['Adam Žák','member',1],['Host Adam','guest',1]]);expect(s.present).toBe(3);expect(analysisSummary({...data,members,participation},[event],'g').members.map(m=>m.id)).toEqual(['g']);
});

describe('Kilometry závodů',()=>{
 const race={...event,id:'race-km',event_kind:'race' as const,race_distance_km:21.1,actual_distance_km:null};
 it('započítá délku trasy jednou bez násobení počtem závodníků',()=>{
  const roster={...data,participation:data.members.map(m=>({club_id:'club',event_id:race.id,member_id:m.id,response:'yes' as const,attended:true,confirmed_by:'coach'}))};
  expect(analysisSummary(roster,[race])).toMatchObject({raceDistance:21.1,recordedRaceDistances:1,distance:0,recordedDistances:0});
 });
 it('upřednostní skutečnou vzdálenost a zachová vyplněnou nulu',()=>{
  expect(analysisSummary(data,[{...race,actual_distance_km:18},{...race,id:'zero',actual_distance_km:0},{...race,id:'unknown',race_distance_km:null}])).toMatchObject({raceDistance:18,recordedRaceDistances:2});
 });
 it('respektuje dokončení, zrušení, období a druh události',()=>{
  const mixed={...data,events:[{...event,actual_distance_km:5},race,{...race,id:'pending',completed_at:null},{...race,id:'cancelled',status:'cancelled' as const},{...race,id:'old',starts_at:'2025-01-01T10:00:00Z'}]};
  const selected=filterAnalysis(mixed,{...noFilters,kind:'race',from:'2026-10-13',to:'2026-10-13'});
  expect(analysisSummary(mixed,selected)).toMatchObject({raceDistance:21.1,recordedRaceDistances:1,distance:0});
  expect(analysisSummary(mixed,filterAnalysis(mixed,{...noFilters,kind:'training'}))).toMatchObject({raceDistance:0,recordedRaceDistances:0,distance:5});
 });
 it('při výběru člena počítá účast závodníka a vynechá doprovod i nepřítomnost',()=>{
  const mixed={...data,events:[race,{...race,id:'companion'},{...race,id:'absent'}],participation:[{club_id:'club',event_id:race.id,member_id:'a',response:'yes' as const,attended:true,confirmed_by:'coach'},{club_id:'club',event_id:'companion',member_id:'a',response:'companion' as const,attended:true,confirmed_by:'coach'},{club_id:'club',event_id:'absent',member_id:'a',response:'no' as const,attended:false,confirmed_by:'coach'}]};
  expect(analysisSummary(mixed,filterAnalysis(mixed,{...noFilters,memberId:'a'}),'a')).toMatchObject({raceDistance:21.1,recordedRaceDistances:1});
 });
});

describe('Oddělená tréninková a závodní docházka',()=>{
 const training={...event,id:'training'},race={...event,id:'race',event_kind:'race' as const};
 const row=(event_id:string,member_id:string,attended:boolean|null,response:'yes'|'companion'='yes',attendance_excused=false)=>({club_id:'club',event_id,member_id,attended,response,attendance_excused,confirmed_by:'coach'});
 const roster={...data,events:[training,race],participation:[row('training','a',true),row('training','b',false),row('race','a',true,'companion'),row('race','b',true)]};
 it('nesmíchá součty ani procenta a nezapočítá doprovod do závodění',()=>{
  const activity=analysisAttendance(roster,roster.events);
  expect(activity.training).toMatchObject({present:1,absent:1,verified:2,percent:50});
  expect(activity.races).toMatchObject({present:1,absent:0,verified:1,percent:100});
  expect(activity.members.find(m=>m.id==='a')).toMatchObject({training:{present:1},races:{present:0,verified:0,percent:null}});
 });
 it('filtruje člena a vynechá omluvené a neověřené z procent',()=>{
  const rows=[row('training','a',true),row('training','b',false,'yes',true),row('race','a',null)];
  expect(analysisAttendance({...roster,participation:rows},roster.events,'a')).toMatchObject({training:{present:1,verified:1,percent:100},races:{present:0,unverified:1,percent:null}});
  expect(analysisAttendance({...roster,participation:rows},roster.events).training).toMatchObject({present:1,excused:1,verified:1});
 });
 it('prázdný či vyfiltrovaný druh nemá falešnou nulovou docházku',()=>{
  expect(analysisAttendance(roster,[training]).races).toMatchObject({present:0,verified:0,percent:null});
  expect(analysisAttendance(roster,[]).members).toHaveLength(2);
 });
});

it('u dokončeného tréninku bez záznamu počítá neověřenou docházku oprávněných členů',()=>{
 const selected={...data,participation:[]};
 expect(analysisAttendance(selected,[event]).training).toMatchObject({present:0,verified:0,unverified:2,percent:null});
 expect(analysisAttendance(selected,[event],'a').training.unverified).toBe(1);
 const guest={...data.members[1],event_guest:true};
 expect(analysisAttendance({...selected,members:[guest]},[event]).training.unverified).toBe(0);
});
