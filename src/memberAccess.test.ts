import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {respondToEvent,acceptInvitation,sendInvitation} from './memberAccess';
function mock(){const rpc=vi.fn(async()=>({data:{response:'yes',attended:true},error:null})),invoke=vi.fn(async()=>({data:{link:'https://example.invalid',id:'invite',delivery:'queued'},error:null}));const user=vi.fn(async()=>({data:{user:{id:'member'}},error:null}));return {rpc,invoke,user,client:{auth:{getUser:user},rpc,functions:{invoke}} as unknown as SupabaseClient};}
describe('Členský adaptér',()=>{
 it('RSVP posílá jen klub, událost a odpověď, nikoliv member_id nebo docházku',async()=>{const m=mock();await respondToEvent(m.client,'club','event','yes');expect(m.rpc).toHaveBeenCalledWith('respond_to_club_event',{target_club:'club',target_event:'event',answer:'yes'})});
 it('neověřený účet nevolá členskou RPC',async()=>{const m=mock();m.user.mockResolvedValue({data:{user:null as never},error:null});await expect(respondToEvent(m.client,'club','event','yes')).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled()});
 it('neplatný token se neposílá na server',async()=>{const m=mock();await expect(acceptInvitation(m.client,'bad')).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled()});
 it('člen nemůže spustit odesílání pozvánek',async()=>{const m=mock();await expect(sendInvitation(m.client,{id:'club',name:'Club',role:'member'},'other','guest@example.invalid')).rejects.toThrow();expect(m.invoke).not.toHaveBeenCalled()});
});
