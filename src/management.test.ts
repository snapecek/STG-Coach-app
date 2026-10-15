import {describe,it,expect} from 'vitest';
import {calendarCells,pendingReviews,reviewReady,reviewMembers,trainingCompletionIssues} from './management';
import type {EventRow,ClubData,MemberRow} from './clubData';
const event:EventRow={id:'event',club_id:'club',template_id:null,name:'Fiktivní trénink',starts_at:'2026-10-12T16:00:00Z',place:'Park',type:'Běh',plan:'Plán',duration_minutes:60,event_kind:'training',status:'scheduled',actual_notes:'',completed_at:null,completed_by:null,actual_duration_minutes:null,perceived_effort:null,equipment:[]};
const member:MemberRow={id:'member',club_id:'club',name:'Fiktivní člen',kind:'member',removed_at:null,purge_after:null};
const data:ClubData={members:[member],events:[event],templates:[],participation:[]};
const now=Date.parse('2026-10-13T12:00:00Z');
describe('Kalendář',()=>{
 it('má pondělí první a šest týdnů',()=>{const cells=calendarCells(2026,9);expect(cells).toHaveLength(42);expect(cells[0]).toBe('2026-09-28');expect(cells[41]).toBe('2026-11-08')});
 it('obsahuje přestupný únor',()=>expect(calendarCells(2028,1)).toContain('2028-02-29'));
});
describe('Kontrola po tréninku',()=>{
 it('čeká na konec, ne pouze začátek',()=>expect(pendingReviews([event],Date.parse('2026-10-12T16:30:00Z'))).toEqual([]));
 it('zrušené a dokončené události nejsou úkoly',()=>expect(pendingReviews([event,{...event,id:'cancel',status:'cancelled'},{...event,id:'done',completed_at:'2026-10-12T18:00:00Z'}],now).map(e=>e.id)).toEqual(['event']));
 it('potřebuje skutečný průběh a docházku',()=>{expect(reviewReady(data,event,now)).toBe(false);const written={...event,actual_notes:'Fiktivní skutečný průběh'};expect(reviewReady(data,written,now)).toBe(false);expect(reviewReady({...data,participation:[{club_id:'club',event_id:'event',member_id:'member',response:'no',attended:false,confirmed_by:'trainer'}]},written,now)).toBe(true)});
 it('člena odebraného před událostí bez historie nevyžaduje',()=>{const archived={...member,removed_at:'2026-10-10T12:00:00Z'};expect(reviewMembers({...data,members:[archived]},event)).toEqual([])});
 it('archivovaného účastníka s docházkou zachová',()=>{const archived={...member,removed_at:'2026-10-10T12:00:00Z'};expect(reviewMembers({...data,members:[archived],participation:[{club_id:'club',event_id:'event',member_id:'member',response:'yes',attended:true,confirmed_by:'trainer'}]},event)).toEqual([archived])});
});

describe('Samostatný postup závodu',()=>{
 const race={...event,event_kind:'race' as const,actual_notes:''};
 const p={club_id:'club',event_id:'event',member_id:'member',response:null,attended:true,confirmed_by:'coach'};
 const result={club_id:'club',event_id:'event',member_id:'member',status:'finished' as const,elapsed_ms:300000,notes:''};
 it('nezahrne automaticky celý klub do soupisky',()=>{expect(reviewMembers(data,race)).toEqual([]);expect(reviewMembers({...data,participation:[p]},race)).toEqual([member])});
 it('vyžaduje výsledek, nikoliv tréninkový deník',()=>{const roster={...data,participation:[p]};expect(reviewReady(roster,race,now)).toBe(false);expect(reviewReady(roster,race,now,[result])).toBe(true)});
 it('DNS musí mít nepřítomnost, ostatní výsledky přítomnost',()=>{const dns={...result,status:'dns' as const,elapsed_ms:null};expect(reviewReady({...data,participation:[p]},race,now,[dns])).toBe(false);expect(reviewReady({...data,participation:[{...p,attended:false}]},race,now,[dns])).toBe(true);expect(reviewReady({...data,participation:[{...p,attended:false}]},race,now,[result])).toBe(false)});
 it('neuzavře závod před koncem nebo s neověřeným závodníkem',()=>{expect(reviewReady({...data,participation:[p]},race,Date.parse(event.starts_at),[result])).toBe(false);expect(reviewReady({...data,participation:[{...p,attended:null}]},race,now,[result])).toBe(false)});
});

describe('Soupiska skupinového tréninku',()=>{
 const grouped={...event,roster_only:true,group_name:'Fiktivní skupina',actual_notes:'Skutečný průběh'};
 const other={...member,id:'other',name:'Fiktivní člen mimo skupinu'};
 const p={club_id:'club',event_id:'event',member_id:'member',response:null,attended:false,confirmed_by:'coach'};
 it('vyžaduje docházku jen uložené soupisky, nikoliv ostatních členů klubu',()=>{const selected={...data,members:[member,other],participation:[p]};expect(reviewMembers(selected,grouped)).toEqual([member]);expect(reviewReady(selected,grouped,now)).toBe(true);expect(reviewReady({...selected,participation:[p,{...p,member_id:'other',attended:null}]},grouped,now)).toBe(false)});
 it('prázdnou soupisku nelze dokončit a archivovaného účastníka s historií zachová',()=>{expect(reviewReady(data,grouped,now)).toBe(false);expect(reviewMembers({...data,members:[{...member,removed_at:'2026-10-01'}],participation:[p]},grouped)).toHaveLength(1)});
});

it('excludes archived members with only old RSVP after removal, keeps confirmed history',()=>{
 const archived={id:'old',name:'Stejné jméno',removed_at:'2026-10-12T12:00:00Z'};
 const active={id:'new',name:'Stejné jméno',removed_at:null};
 const event={id:'future',starts_at:'2026-10-14T12:00:00Z',event_kind:'training'} as EventRow;
 const data={members:[archived,active],participation:[{event_id:'future',member_id:'old',response:'no',attended:null}]} as unknown as ClubData;
 expect(reviewMembers(data,event).map(m=>m.id)).toEqual(['new']);
 data.participation[0].attended=true;
 expect(reviewMembers(data,event).map(m=>m.id)).toEqual(['old','new']);
});

it('requires actual attendance but no racing result for a companion',()=>{
 const race={...event,event_kind:'race' as const};
 const participation=[{event_id:event.id,member_id:member.id,response:'companion' as const,attended:true}];
 const roster={...data,participation} as ClubData;
 expect(reviewReady(roster,race,now,[])).toBe(true);
 expect(reviewReady({...roster,participation:[{...roster.participation[0],attended:null}]},race,now,[])).toBe(false);
});

it('explains missing journal notes and only actually unverified attendance',()=>{
 const rows=[{event_id:event.id,member_id:member.id,response:'yes',attended:null}];
 expect(trainingCompletionIssues({...data,participation:rows} as ClubData,event,now).map(i=>i.kind)).toEqual(['notes','attendance']);
 const ready={...event,actual_notes:'Skutečný průběh'};
 expect(trainingCompletionIssues({...data,participation:[{...rows[0],attended:false}]} as ClubData,ready,now)).toEqual([]);
 expect(trainingCompletionIssues(data,ready,Date.parse(event.starts_at)).map(i=>i.kind)).toContain('time');
 expect(trainingCompletionIssues(data,{...ready,status:'cancelled'},now)).toEqual([{kind:'cancelled'}]);
});

it('includes a member-invited guest only in the booked event roster',()=>{const event={id:'event',event_kind:'training',starts_at:'2026-10-15T10:00:00Z'} as import('./clubData').EventRow;const guest={id:'guest',name:'Guest',kind:'guest',event_guest:true,removed_at:null} as import('./clubData').MemberRow;const data={members:[guest],participation:[]} as unknown as import('./clubData').ClubData;expect(reviewMembers(data,event)).toEqual([]);data.participation=[{member_id:'guest',event_id:'event'} as import('./clubData').ParticipationRow];expect(reviewMembers(data,event)).toEqual([guest]);expect(reviewMembers(data,{...event,id:'other'})).toEqual([])});
