import {describe,it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {applicationRpc,joinInvitationUrl} from './clubApplications';
describe('shareable club invitations',()=>{
 it('builds a root registration link without copying auth parameters or fragments',()=>{expect(joinInvitationUrl('a'.repeat(64),'https://app.example.invalid/path?secret=old#access_token=old')).toBe('https://app.example.invalid/?join-invite='+'a'.repeat(64))});
 it('shares invitations on the canonical domain even from an old Vercel installation',()=>{
  for(const origin of ['https://project-ym4q2.vercel.app/path?auth=old#access_token=old','https://trenomi.eu','https://www.trenomi.eu']){
   expect(joinInvitationUrl('a'.repeat(64),origin)).toBe('https://www.trenomi.eu/?join-invite='+'a'.repeat(64));
  }
 });
 it('keeps local and preview invitations isolated from production',()=>{
  for(const origin of ['http://localhost:5173','https://preview.example.invalid','https://project-ym4q2.vercel.app.example.invalid'])expect(joinInvitationUrl('a'.repeat(64),origin)).toBe(origin+'/?join-invite='+'a'.repeat(64));
 });
 it('rejects malformed tokens and non-web origins',()=>{for(const token of ['', 'x'.repeat(64),'a'.repeat(63)])expect(()=>joinInvitationUrl(token,'https://app.example.invalid')).toThrow();expect(()=>joinInvitationUrl('a'.repeat(64),'file:///tmp/app')).toThrow()});
 it('explains the new migration and preserves the old email-invite requirement',async()=>{const client={rpc:async()=>({data:null,error:{code:'PGRST202',message:'hidden'}})} as unknown as SupabaseClient;await expect(applicationRpc(client,'issue_join_link')).rejects.toThrow('035');await expect(applicationRpc(client,'revoke_join_link')).rejects.toThrow('035');await expect(applicationRpc(client,'submit_club_application')).rejects.toThrow('032')});
});
