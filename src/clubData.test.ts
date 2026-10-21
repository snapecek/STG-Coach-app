import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {addTemplate,editTemplate,createClubEvents,buildEventRows,pragueTimestamp,loadClubData,addMember,saveParticipation,saveAttendanceBatch,archiveMember,deleteTemplate,deleteEvent,updateEvent,completeEvent,createClubRace,validateRaceDetails,type TemplateRow} from './clubData';
const club={id:'20000000-0000-4000-8000-000000000001',name:'Fiktivní A',role:'coach' as const};
const template:TemplateRow={id:'template-a',club_id:club.id,name:'Fiktivní běh',type:'Běh',place:'Testovací park',minutes:45,plan:'Fiktivní plán'};
function mock(returnData:unknown=[]){const tables:string[]=[];const filters:unknown[][]=[];const writes:unknown[]=[];const q={select:vi.fn(()=>q),eq:vi.fn((...args:unknown[])=>{filters.push(args);return q}),order:vi.fn(()=>q),abortSignal:vi.fn(()=>q),range:vi.fn(()=>q),update:vi.fn((data:unknown)=>{writes.push(data);return q}),delete:vi.fn(()=>q),insert:vi.fn((data:unknown)=>{writes.push(data);return q}),upsert:vi.fn((data:unknown)=>{writes.push(data);return q}),single:vi.fn(async()=>({data:{id:'new'},error:null})),then:(fn:(v:unknown)=>unknown)=>Promise.resolve({data:returnData,error:null}).then(fn)};const client={storage:{from:()=>({list:async()=>({data:[],error:null})})},rpc:vi.fn(async()=>({data:{id:'member'},error:null})),auth:{getUser:vi.fn(async()=>({data:{user:{id:'trainer'}},error:null}))},from:vi.fn((table:string)=>{tables.push(table);return q})};return {client:client as unknown as SupabaseClient,tables,filters,writes,q,auth:client.auth,rpc:client.rpc};}
describe('Čas a opakování',()=>{
 it('převede letní a zimní pražský čas',()=>{expect(pragueTimestamp('2026-07-01','18:00')).toBe('2026-07-01T16:00:00.000Z');expect(pragueTimestamp('2026-12-01','18:00')).toBe('2026-12-01T17:00:00.000Z')});
 it('zachová 18:00 přes změnu času',()=>expect(buildEventRows(club.id,template,'2026-10-21','18:00',2).map(e=>e.starts_at)).toEqual(['2026-10-21T16:00:00.000Z','2026-10-28T17:00:00.000Z']));
 it('odmítá neexistující jarní čas',()=>expect(()=>pragueTimestamp('2026-03-29','02:30')).toThrow());
 it('odmítá cizí šablonu',()=>expect(()=>buildEventRows('club-b',template,'2026-10-13','18:00',1)).toThrow());
});
describe('Cloudový adaptér',()=>{
 it('každé čtení filtruje club_id',async()=>{const m=mock();await loadClubData(m.client,club);expect(m.tables).toEqual(['members','templates','events','participation','event_type_colors']);expect(m.filters).toEqual(Array(5).fill(['club_id',club.id]))});
 it('načte další stránku registru místo tichého oříznutí',async()=>{
  const ranges:unknown[][]=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'trainer'}},error:null})},from:(table:string)=>{
   let offset=0;const q={select:()=>q,eq:()=>q,order:()=>q,range:(start:number,end:number)=>{offset=start;if(table==='members')ranges.push([start,end]);return q},then:(fn:(v:unknown)=>unknown)=>Promise.resolve({data:table==='members'&&offset===0?Array.from({length:500},(_,i)=>({id:String(i),club_id:club.id,name:'Fiktivní člen',kind:'member'})):[],error:null}).then(fn)};return q;
  }} as unknown as SupabaseClient;
  const data=await loadClubData(client,club);expect(data.members).toHaveLength(500);expect(ranges).toEqual([[0,499],[500,999]]);
 });
 it('before migration 033 preserves guest fields and loads members without a join date',async()=>{
  const selections:string[]=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:(table:string)=>{let columns='';const q={select:(value:string)=>{columns=value;if(table==='members')selections.push(value);return q},eq:()=>q,order:()=>q,range:()=>q,then:(fn:(v:unknown)=>unknown)=>Promise.resolve(table==='members'&&columns.includes('joined_at')?{data:null,error:{code:'42703'}}:{data:table==='members'?[{id:'guest',name:'Host',event_guest:true,event_guest_of:'parent'}]:[],error:null}).then(fn)};return q}} as unknown as SupabaseClient;
  const data=await loadClubData(client,club);expect(data.members[0]).toMatchObject({event_guest:true,event_guest_of:'parent'});expect(selections).toHaveLength(2);expect(selections[1]).toContain('event_guest_of');expect(selections[1]).not.toContain('joined_at');
 });
 it('členovi vůbec nenačítá registr ani účast',async()=>{const m=mock();await loadClubData(m.client,{...club,role:'member'});expect(m.tables).toEqual(['templates','events','event_type_colors'])});
 it('člen nesmí zapisovat ani při chybě UI',async()=>{const m=mock();await expect(addMember(m.client,{...club,role:'member'},'Fiktivní člen','member')).rejects.toThrow();expect(m.tables).toEqual([])});
 it('neověřený účet nečte tabulky',async()=>{const m=mock();m.auth.getUser.mockResolvedValue({data:{user:null as never},error:null});await expect(loadClubData(m.client,club)).rejects.toThrow();expect(m.tables).toEqual([])});
 it('nového člena sváže s klubem',async()=>{const m=mock();await addMember(m.client,club,' Fiktivní host ','guest');expect(m.writes[0]).toMatchObject({club_id:club.id,name:'Fiktivní host',kind:'guest'})});
 it('RSVP nepřepisuje docházku',async()=>{const m=mock();await saveParticipation(m.client,club,'event','member',{response:'yes'});expect(m.writes[0]).toEqual({club_id:club.id,event_id:'event',member_id:'member',response:'yes'})});
 it('po uložení načte přidělené místo až po databázových triggerech a filtruje vlastní záznam',async()=>{const m=mock();m.q.single.mockResolvedValueOnce({data:{response:'yes',seat_status:null},error:null} as never).mockResolvedValueOnce({data:{response:'yes',seat_status:'waiting'},error:null} as never);const row=await saveParticipation(m.client,club,'event','member',{response:'yes'});expect(row.seat_status).toBe('waiting');expect(m.filters).toEqual([['club_id',club.id],['event_id','event'],['member_id','member']])});
 it('docházku potvrdí ověřený trenér bez přepsání RSVP',async()=>{const m=mock();await saveParticipation(m.client,club,'event','member',{attended:true});expect(m.writes[0]).toEqual({club_id:club.id,event_id:'event',member_id:'member',attended:true,confirmed_by:'trainer'})});
 it('saves all attendance choices in one statement without RSVP or seat fields',async()=>{const m=mock([{event_id:'event',member_id:'one'},{event_id:'event',member_id:'two'}]);await saveAttendanceBatch(m.client,club,[{eventId:'event',memberId:'one',attended:true,attendance_excused:false},{eventId:'event',memberId:'two',attended:false,attendance_excused:true}]);expect(m.q.upsert).toHaveBeenCalledTimes(1);expect(m.q.select).toHaveBeenCalledWith('event_id,member_id');expect(m.auth.getUser).toHaveBeenCalledTimes(1);expect(m.writes[0]).toEqual([{club_id:club.id,event_id:'event',member_id:'one',attended:true,attendance_excused:false,confirmed_by:'trainer'},{club_id:club.id,event_id:'event',member_id:'two',attended:false,attendance_excused:true,confirmed_by:'trainer'}]);});
 it('requires server acknowledgement of every saved attendance row',async()=>{for(const result of [null,[]]){const m=mock(result);await expect(saveAttendanceBatch(m.client,club,[{eventId:'event',memberId:'one',attended:false,attendance_excused:false}])).rejects.toThrow();}});
 it('rejects unauthorized, duplicate and contradictory batch attendance before writing',async()=>{const m=mock(),item={eventId:'event',memberId:'one',attended:true,attendance_excused:false};await expect(saveAttendanceBatch(m.client,{...club,role:'member'},[item])).rejects.toThrow();await expect(saveAttendanceBatch(m.client,club,[item,item])).rejects.toThrow();await expect(saveAttendanceBatch(m.client,club,[{...item,attendance_excused:true}])).rejects.toThrow();expect(m.writes).toEqual([])});
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
 it('uloží ikonu závodu přes atomickou RPC až po ověření migrace 047',async()=>{const m=mock();m.rpc.mockResolvedValueOnce({data:true,error:null} as never);await createClubRace(m.client,club,{...input,training_icon:'medal'},[]);expect(m.rpc).toHaveBeenNthCalledWith(1,'race_icons_ready');expect(m.rpc).toHaveBeenNthCalledWith(2,'create_club_race',{target_club:club.id,race:{...input,training_icon:'medal'},entrants:[]});});
 it('před migrací 047 nevytvoří závod s tiše ztracenou ikonou',async()=>{const m=mock();m.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202'}} as never);await expect(createClubRace(m.client,club,{...input,training_icon:'medal'},[])).rejects.toThrow('047');expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.tables).toEqual([]);});
 it('před migrací 047 neprovede ani změnu ikony závodu',async()=>{const m=mock();await expect(updateEvent(m.client,club,'event',{event_kind:'race',training_icon:'none'})).rejects.toThrow('047');expect(m.writes).toEqual([]);});
 it('povoluje závod bez účastníků',async()=>{const m=mock();await createClubRace(m.client,club,input,[]);expect(m.rpc).toHaveBeenCalledWith('create_club_race',{target_club:club.id,race:input,entrants:[]})});
 it('odmítá duplicitní soupisku před zápisem',async()=>{const m=mock();await expect(createClubRace(m.client,club,input,['member','member'])).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled()});
 it('odmítá nebezpečné odkazy a neplatné vzdálenosti',()=>{for(const url of ['javascript:alert(1)','http://example.invalid','https://user:password@example.invalid','https://example.invalid/a b'])expect(()=>validateRaceDetails({race_registration_url:url})).toThrow();for(const distance of [0,-1,Infinity,1001])expect(()=>validateRaceDetails({race_distance_km:distance})).toThrow()});
});

it('ruční termíny celého klubu posílá přesně v jedné transakční RPC',async()=>{const m=mock();await createClubEvents(m.client,club,{name:'Fiktivní běh',place:'Park',type:'Běh',plan:'',duration_minutes:60,event_kind:'training',template_id:null,date:'2026-10-01',time:'18:00',count:3,selectedDates:['2026-10-29','2026-10-05','2026-10-16']});expect(m.rpc).toHaveBeenCalledTimes(1);const [method,args]=m.rpc.mock.calls[0] as unknown as [string,{target_club:string;sessions:{starts_at:string}[]}];expect(method).toBe('create_training_series');expect(args.target_club).toBe(club.id);expect(args.sessions.map(e=>e.starts_at)).toEqual(['2026-10-05T16:00:00.000Z','2026-10-16T16:00:00.000Z','2026-10-29T17:00:00.000Z']);expect(m.tables).toEqual([])});
it('odmítá neplatnou vzdálenost před síťovým zápisem',async()=>{const m=mock();for(const actual_distance_km of [-1,10001,NaN,Infinity])await expect(updateEvent(m.client,club,'event',{actual_distance_km})).rejects.toThrow();expect(m.writes).toEqual([])});
it('copies template map snapshots independently into each event in a series',()=>{const location={point:{lat:49.854,lng:18.542},arrows:[{from:{lat:49.853,lng:18.541},to:{lat:49.854,lng:18.542}}],note:'Zadní brankou'};const rows=buildEventRows(club.id,{...template,event_location:location},'2026-10-20','18:00',2);expect(rows[0].event_location).toEqual(location);rows[0].event_location!.point.lat=50;rows[0].event_location!.arrows[0].from.lng=19;expect(rows[1].event_location).toEqual(location);expect(location.point.lat).toBe(49.854)});
it('preserves optional stored event/template maps when loading after a fresh login',async()=>{const location={point:{lat:49,lng:18},arrows:[],note:''};const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:(table:string)=>{let columns='';const row={id:'id',starts_at:'2026-10-20T18:00Z',event_location:location};const q={select:(c:string)=>{columns=c;return q},eq:()=>q,order:()=>q,range:()=>q,then:(fn:(v:unknown)=>unknown)=>Promise.resolve({error:null,data:['events','templates'].includes(table)?[columns==='*'?row:Object.fromEntries(columns.split(',').map(k=>[k,row[k as keyof typeof row]]))]:[]}).then(fn)};return q}} as unknown as SupabaseClient;const result=await loadClubData(client,club);expect(result.events[0].event_location).toEqual(location);expect(result.templates[0].event_location).toEqual(location)});

it('uloží výběr ikony šablony a výslovně obnoví automatický režim',async()=>{
 const m=mock();await addTemplate(m.client,club,{...template,training_icon:'swimming'});expect(m.writes[0]).toMatchObject({training_icon:'swimming',club_id:club.id});
 await editTemplate(m.client,club,template.id,{...template,training_icon:null});expect(m.writes[1]).toMatchObject({training_icon:null});
});
it('neznámou ikonu šablony odmítne bez zápisu',async()=>{
 const m=mock();await expect(addTemplate(m.client,club,{...template,training_icon:'unknown' as never})).rejects.toThrow('ikonu');expect(m.writes).toEqual([]);
});

it('před migrací 048 neuloží novou sportovní ikonu se zavádějící chybou constraintu',async()=>{
 const m=mock();m.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202'}} as never);await expect(addTemplate(m.client,club,{...template,training_icon:'ocr'})).rejects.toThrow('048');expect(m.writes).toEqual([]);
});
it('po migraci 048 uloží do šablony samostatnou trailovou ikonu',async()=>{
 const m=mock();m.rpc.mockResolvedValueOnce({data:true,error:null} as never);await addTemplate(m.client,club,{...template,training_icon:'trail'});expect(m.writes[0]).toMatchObject({training_icon:'trail'});
});
