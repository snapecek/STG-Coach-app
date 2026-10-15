import {describe,it,expect} from 'vitest';
import {equipmentTags,filterAnalysis,analysisSummary,noFilters} from './analysis';
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
