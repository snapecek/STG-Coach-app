import {describe,it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {applicationRpc,joinInvitationUrl} from './clubApplications';
describe('shareable club invitations',()=>{
 it('builds a root registration link without copying auth parameters or fragments',()=>{expect(joinInvitationUrl('a'.repeat(64),'https://app.example.invalid/path?secret=old#access_token=old')).toBe('https://app.example.invalid/?join-invite='+'a'.repeat(64))});
 it('rejects malformed tokens and non-web origins',()=>{for(const token of ['', 'x'.repeat(64),'a'.repeat(63)])expect(()=>joinInvitationUrl(token,'https://app.example.invalid')).toThrow();expect(()=>joinInvitationUrl('a'.repeat(64),'file:///tmp/app')).toThrow()});
 it('explains the new migration and preserves the old email-invite requirement',async()=>{const client={rpc:async()=>({data:null,error:{code:'PGRST202',message:'hidden'}})} as unknown as SupabaseClient;await expect(applicationRpc(client,'issue_join_link')).rejects.toThrow('035');await expect(applicationRpc(client,'revoke_join_link')).rejects.toThrow('035');await expect(applicationRpc(client,'submit_club_application')).rejects.toThrow('032')});
});
