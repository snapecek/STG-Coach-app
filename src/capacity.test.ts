import {describe,it,expect} from 'vitest';
import {validateCapacity} from './clubData';
import {participationSummary} from './management';
import type {ClubData,EventRow} from './clubData';
describe('Kapacita a čekací listina',()=>{
 it('přijímá neomezené nebo 1–500 míst',()=>{for(const value of [undefined,null,1,500])expect(()=>validateCapacity(value)).not.toThrow();for(const value of [0,-1,501,1.5,NaN,Infinity])expect(()=>validateCapacity(value)).toThrow()});
 it('čekající nepočítá mezi potvrzená místa a zachová starší neomezené přihlášení',()=>{
 const event={id:'event',event_kind:'training'} as EventRow;
 const data={events:[event],templates:[],members:[1,2,3,4].map(n=>({id:String(n),club_id:'club',name:'Fiktivní '+n,kind:'member',removed_at:null,purge_after:null})),participation:[{club_id:'club',attended:null,confirmed_by:null,event_id:'event',member_id:'1',response:'yes',seat_status:'confirmed'},{club_id:'club',attended:null,confirmed_by:null,event_id:'event',member_id:'2',response:'yes',seat_status:'waiting'},{club_id:'club',attended:null,confirmed_by:null,event_id:'event',member_id:'3',response:'yes'},{club_id:'club',attended:null,confirmed_by:null,event_id:'event',member_id:'4',response:'maybe'}]} as ClubData;
 expect(participationSummary(data,event)).toMatchObject({yes:2,waiting:1,maybe:1,unknown:0});
 });
});
