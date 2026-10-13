import {describe,it,expect} from 'vitest';
import {calendarCells,pendingReviews,reviewReady,reviewMembers} from './management';
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
