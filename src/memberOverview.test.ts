import {describe,it,expect} from 'vitest';
import {rosterCounts,memberResponse,ownAttendance} from './memberOverview';
import type {MemberRosterRow} from './memberOverview';
import type {EventRow,ParticipationRow} from './clubData';
describe('member overview',()=>{
 it('distinguishes waiting from confirmed attendance',()=>{expect(memberResponse({response:'yes',seat_status:'waiting'})).toBe('Čekací listina');expect(memberResponse({response:'yes',seat_status:'confirmed'})).toBe('Přijdu');expect(memberResponse()).toBe('Bez odpovědi')});
 it('never counts a waiting member as a confirmed attendee',()=>{const rows=['confirmed','waiting',null].map((seat_status,i)=>({member_id:String(i),name:'Fiktivní',response:'yes',seat_status,is_self:false})) as MemberRosterRow[];expect(rosterCounts(rows)).toEqual({companion:0,yes:2,waiting:1,maybe:0,no:0,unknown:0,total:3})});
 it('keeps unanswered and no distinct',()=>{const rows=[null,'no','maybe'].map(response=>({response})) as MemberRosterRow[];expect(rosterCounts(rows)).toMatchObject({unknown:1,no:1,maybe:1,yes:0})});
 it('shows no percentage without verified records',()=>{expect(ownAttendance([],[],Date.now()).rate).toBeNull();expect(ownAttendance([],[],Date.now()).weeks).toHaveLength(8)});
 it('excludes races, cancelled, excused, future and unverified training from rate',()=>{const now=Date.parse('2026-10-14T12:00:00Z');const events=['present','absent','excused','unknown','race','cancelled','future'].map(id=>({id,event_kind:id==='race'?'race':'training',status:id==='cancelled'?'cancelled':'scheduled',starts_at:id==='future'?'2026-10-15T09:00:00Z':'2026-10-12T09:00:00Z',duration_minutes:60})) as EventRow[];const p=events.map(e=>({event_id:e.id,member_id:'own',attended:e.id==='unknown'?null:e.id!=='absent',attendance_excused:e.id==='excused'})) as ParticipationRow[];const result=ownAttendance(events,p,now);expect(result.rate).toBe(50);expect(result.known).toBe(2);expect(result.weeks.reduce((sum,w)=>sum+w.present,0)).toBe(1)});
});

it('uses race labels and counts companions separately from racers',()=>{
 expect(memberResponse({response:'yes'},true)).toBe('Zúčastním se');
 expect(memberResponse({response:'no'},true)).toBe('Nezúčastním se');
 expect(memberResponse({response:'companion'},true)).toBe('Doprovod');
 const counts=rosterCounts([{member_id:'c',name:'Doprovod',response:'companion',seat_status:null,is_self:true}]);
 expect(counts.companion).toBe(1);expect(counts.yes).toBe(0);expect(counts.unknown).toBe(0);
});
