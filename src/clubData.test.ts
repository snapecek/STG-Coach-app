import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {buildEventRows,pragueTimestamp,loadClubData,addMember,saveParticipation,archiveMember,deleteTemplate,deleteEvent,updateEvent,completeEvent,createClubRace,validateRaceDetails,type TemplateRow} from './clubData';
const club={id:'20000000-0000-4000-8000-000000000001',name:'Fiktivní A',role:'coach' as const};
const template:TemplateRow={id:'template-a',club_id:club.id,name:'Fiktivní běh',type:'Běh',place:'Testovací park',minutes:45,plan:'Fiktivní plán'};
function mock(){const tables:string[]=[];const filters:unknown[][]=[];const writes:unknown[]=[];const q={select:vi.fn(()=>q),eq:vi.fn((...args:unknown[])=>{filters.push(args);return q}),order:vi.fn(()=>q),abortSignal:vi.fn(()=>q),range:vi.fn(()=>q),update:vi.fn((data:unknown)=>{writes.push(data);return q}),delete:vi.fn(()=>q),insert:vi.fn((data:unknown)=>{writes.push(data);return q}),upsert:vi.fn((data:unknown)=>{writes.push(data);return q}),single:vi.fn(async()=>({data:{id:'new'},error:null})),then:(fn:(v:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(fn)};const client={storage:{from:()=>({list:async()=>({data:[],error:null})})},rpc:vi.fn(async()=>({data:{id:'member'},error:null})),auth:{getUser:vi.fn(async()=>({data:{user:{id:'trainer'}},error:null}))},from:vi.fn((table:string)=>{tables.push(table);return q})};return {client:client as unknown as SupabaseClient,tables,filters,writes,q,auth:client.auth,rpc:client.rpc};}
describe('Čas a opakování',()=>{
 it('převede letní a zimní pražský čas',()=>{expect(pragueTimestamp('2026-07-01','18:00')).toBe('2026-07-01T16:00:00.000Z');expect(pragueTimestamp('2026-12-01','18:00')).toBe('2026-12-01T17:00:00.000Z')});
 it('zachová 18:00 přes změnu času',()=>expect(buildEventRows(club.id,template,'2026-10-21','18:00',2).map(e=>e.starts_at)).toEqual(['2026-10-21T16:00:00.000Z','2026-10-28T17:00:00.000Z']));
 it('odmítá neexistující jarní čas',()=>expect(()=>pragueTimestamp('2026-03-29','02:30')).toThrow());
 it('odmítá cizí šablonu',()=>expect(()=>buildEventRows('club-b',template,'2026-10-13','18:00',1)).toThrow());
});
describe('Cloudový adaptér',()=>{
 it('každé čtení filtruje club_id',async()=>{const m=mock();await loadClubData(m.client,club);expect(m.tables).toEqual(['members','templates','events','participation']);expect(m.filters).toEqual(Array(4).fill(['club_id',club.id]))});
 it('načte další stránku registru místo tichého oříznutí',async()=>{
  const ranges:unknown[][]=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'trainer'}},error:null})},from:(table:string)=>{
   let offset=0;const q={select:()=>q,eq:()=>q,order:()=>q,range:(start:number,end:number)=>{offset=start;if(table==='members')ranges.push([start,end]);return q},then:(fn:(v:unknown)=>unknown)=>Promise.resolve({data:table==='members'&&offset===0?Array.from({length:500},(_,i)=>({id:String(i),club_id:club.id,name:'Fiktivní člen',kind:'member'})):[],error:null}).then(fn)};return q;
  }} as unknown as SupabaseClient;
  const data=await loadClubData(client,club);expect(data.members).toHaveLength(500);expect(ranges).toEqual([[0,499],[500,999]]);
 });
 it('členovi vůbec nenačítá registr ani účast',async()=>{const m=mock();await loadClubData(m.client,{...club,role:'member'});expect(m.tables).toEqual(['templates','events'])});
 it('člen nesmí zapisovat ani při chybě UI',async()=>{const m=mock();await expect(addMember(m.client,{...club,role:'member'},'Fiktivní člen','member')).rejects.toThrow();expect(m.tables).toEqual([])});
 it('neověřený účet nečte tabulky',async()=>{const m=mock();m.auth.getUser.mockResolvedValue({data:{user:null as never},error:null});await expect(loadClubData(m.client,club)).rejects.toThrow();expect(m.tables).toEqual([])});
 it('nového člena sváže s klubem',async()=>{const m=mock();await addMember(m.client,club,' Fiktivní host ','guest');expect(m.writes[0]).toMatchObject({club_id:club.id,name:'Fiktivní host',kind:'guest'})});
 it('RSVP nepřepisuje docházku',async()=>{const m=mock();await saveParticipation(m.client,club,'event','member',{response:'yes'});expect(m.writes[0]).toEqual({club_id:club.id,event_id:'event',member_id:'member',response:'yes'})});
 it('po uložení načte přidělené místo až po databázových triggerech a filtruje vlastní záznam',async()=>{const m=mock();m.q.single.mockResolvedValueOnce({data:{response:'yes',seat_status:null},error:null} as never).mockResolvedValueOnce({data:{response:'yes',seat_status:'waiting'},error:null} as never);const row=await saveParticipation(m.client,club,'event','member',{response:'yes'});expect(row.seat_status).toBe('waiting');expect(m.filters).toEqual([['club_id',club.id],['event_id','event'],['member_id','member']])});
 it('docházku potvrdí ověřený trenér bez přepsání RSVP',async()=>{const m=mock();await saveParticipation(m.client,club,'event','member',{attended:true});expect(m.writes[0]).toEqual({club_id:club.id,event_id:'event',member_id:'member',attended:true,confirmed_by:'trainer'})});
 it('chyba databáze není nahrazená demo daty',async()=>{const m=mock();m.q.single.mockResolvedValue({data:null as never,error:new Error('Denied') as never});await expect(addMember(m.client,club,'Fiktivní člen','member')).rejects.toThrow('nepodařilo')});
 it('archivace volá pouze RPC s vybraným klubem',async()=>{const m=mock();await archiveMember(m.client,club,'member');expect(m.rpc).toHaveBeenCalledWith('archive_club_member',{target_club:club.id,target_member:'member',restore:false})});
 it('smazání šablony filtruje klub i ID',async()=>{const m=mock();await deleteTemplate(m.client,club,'template');expect(m.filters).toEqual([['club_id',club.id],['id','template']])});
 it('smazání události filtruje klub i ID',async()=>{const m=mock();await deleteEvent(m.client,club,'50000000-0000-4000-8000-000000000001');expect(m.filters).toEqual([['club_id',club.id],['id','50000000-0000-4000-8000-000000000001']])});
 it('změna události filtruje klub i ID',async()=>{const m=mock();await updateEvent(m.client,club,'event',{status:'cancelled'});expect(m.filters).toEqual([['club_id',club.id],['id','event']]);expect(m.writes[0]).toEqual({status:'cancelled'})});
 it('nepotvrdí dokončení, pokud jej server nepřijal',async()=>{const m=mock();await expect(completeEvent(m.client,club,'event')).rejects.toThrow('nebyla dokončena')});

});

describe('Bezpečné vytvoření závodu',()=>{
 const input={id:'race',name:'Závod',place:'Park',type:'OCR',plan:'Pokyny',starts_at:'2026-10-13T08:00:00Z',duration_minutes:180,race_distance_km:8,race_registration_url:'https://example.invalid/race'};
 it('závod a soupisku zapisuje v jedné transakční RPC',async()=>{const m=mock();await createClubRace(m.client,club,input,['member']);expect(m.rpc).toHaveBeenCalledWith('create_club_race',{target_club:club.id,race:input,entrants:['member']});expect(m.tables).toEqual([])});
 it('odmítá prázdnou nebo duplicitní soupisku před zápisem',async()=>{const m=mock();await expect(createClubRace(m.client,club,input,[])).rejects.toThrow();await expect(createClubRace(m.client,club,input,['member','member'])).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled()});
 it('odmítá nebezpečné odkazy a neplatné vzdálenosti',()=>{for(const url of ['javascript:alert(1)','http://example.invalid','https://user:password@example.invalid','https://example.invalid/a b'])expect(()=>validateRaceDetails({race_registration_url:url})).toThrow();for(const distance of [0,-1,Infinity,1001])expect(()=>validateRaceDetails({race_distance_km:distance})).toThrow()});
});
