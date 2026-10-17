import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {addRecordedGuest} from './recordedGuests';
const club={id:'club-a',name:'Fiktivní klub',role:'coach' as const};
function mock(error:unknown=null){const rpc=vi.fn().mockResolvedValue({data:'guest',error});return {rpc,client:{rpc} as unknown as SupabaseClient};}
describe('Zpětný zápis hosta',()=>{
 it('normalizes a new name and delegates atomic attendance to the scoped RPC',async()=>{const m=mock();await addRecordedGuest(m.client,club,'event',null,'  Jana   Hostová ');expect(m.rpc).toHaveBeenCalledWith('add_recorded_training_guest',{target_club:'club-a',target_event:'event',target_member:null,guest_name:'Jana Hostová'})});
 it('reuses the selected guest without renaming or creating another record',async()=>{const m=mock();await addRecordedGuest(m.client,club,'event','existing',null);expect(m.rpc).toHaveBeenCalledWith('add_recorded_training_guest',{target_club:'club-a',target_event:'event',target_member:'existing',guest_name:null})});
 it('blocks members and empty names before making requests',async()=>{const m=mock();await expect(addRecordedGuest(m.client,{...club,role:'member'},'event',null,'Jana')).rejects.toThrow('trenér');await expect(addRecordedGuest(m.client,club,'event',null,'   ')).rejects.toThrow('jméno');expect(m.rpc).not.toHaveBeenCalled()});
 it('explains rollout and name conflicts without claiming success',async()=>{await expect(addRecordedGuest(mock({code:'PGRST202'}).client,club,'event',null,'Jana')).rejects.toThrow('034');await expect(addRecordedGuest(mock({message:'Guest already exists'}).client,club,'event',null,'Jana')).rejects.toThrow('už je v evidenci');await expect(addRecordedGuest(mock({message:'Guest already participating'}).client,club,'event','existing',null)).rejects.toThrow('docházce')});
});
