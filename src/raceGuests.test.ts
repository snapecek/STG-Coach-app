import {it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {normalizeRaceGuests,addRaceGuest,type RaceGuestDraft} from './raceGuests';
import {createClubRace} from './clubData';
const club={id:'club-a',name:'Fiktivní klub',role:'coach' as const};
it('normalizes guest names without changing the original draft or roles',()=>{
 const draft:RaceGuestDraft[]=[{name:'  Jana   Hostová ',role:'companion'},{name:'Petr Host',role:'yes'}];
 expect(normalizeRaceGuests(draft)).toEqual([{name:'Jana Hostová',role:'companion'},{name:'Petr Host',role:'yes'}]);expect(draft[0].name).toBe('  Jana   Hostová ');
});
it.each([{name:'',role:'yes'},{name:'Anna\nHost',role:'invalid'},{name:'a'.repeat(81),role:'yes'},{name:'Anna\u0000',role:'yes'}])('rejects invalid name/role before guest persistence: %o',async draft=>{
 const rpc=vi.fn();const client={rpc} as unknown as SupabaseClient;
 await expect(addRaceGuest(client,club,'race',draft as RaceGuestDraft)).rejects.toThrow();expect(rpc).not.toHaveBeenCalled();
});
it('does not let a member create race guests',async()=>{
 const rpc=vi.fn();await expect(addRaceGuest({rpc} as unknown as SupabaseClient,{...club,role:'member'},'race',{name:'Jana Hostová',role:'yes'})).rejects.toThrow('trenér');expect(rpc).not.toHaveBeenCalled();
});
it('does not silently discard race guests when the old create RPC ignores them',async()=>{
 const rpc=vi.fn(async()=>({data:null,error:{code:'PGRST202'}}));const client={rpc,auth:{getUser:async()=>({data:{user:{id:'coach'}},error:null})}} as unknown as SupabaseClient;
 await expect(createClubRace(client,club,{id:'race',name:'Závod',type:'OCR',place:'Park',plan:'',starts_at:'2027-01-01T10:00:00Z',duration_minutes:60,race_distance_km:5,race_registration_url:'',guests:[{name:'Jana Hostová',role:'yes'}]},[])).rejects.toThrow('053');expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('race_tools_ready');
});
