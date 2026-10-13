import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validatePublicConfig,loadClubAccess} from './supabase';
const anon='header.'+btoa(JSON.stringify({role:'anon'}))+'.signature';
describe('Veřejná konfigurace',()=>{
 it('vyžaduje oba parametry',()=>expect(()=>validatePublicConfig(undefined,undefined)).toThrow());
 it('odmítá serverový secret klíč',()=>expect(()=>validatePublicConfig('https://example.supabase.co','sb_secret_test')).toThrow());
 it('odmítá service_role JWT',()=>expect(()=>validatePublicConfig('https://example.supabase.co','h.'+btoa(JSON.stringify({role:'service_role'}))+'.s')).toThrow());
 it('odmítá nešifrované URL',()=>expect(()=>validatePublicConfig('http://example.supabase.co',anon)).toThrow());
 it('odmítá URL s heslem',()=>expect(()=>validatePublicConfig('https://user:password@example.supabase.co',anon)).toThrow());
 it('přijme anon a publishable klíče',()=>{expect(validatePublicConfig('https://example.supabase.co',anon).url).toBe('https://example.supabase.co');expect(validatePublicConfig('https://example.supabase.co','sb_publishable_test').key).toBe('sb_publishable_test')});
});
describe('Načtení přístupu ke klubu',()=>{
 it('bez ověřené identity vůbec nečte tabulky',async()=>{const from=vi.fn();const client={auth:{getUser:async()=>({data:{user:null},error:new Error('Expired')})},from} as unknown as SupabaseClient;await expect(loadClubAccess(client)).rejects.toThrow('Přihlášení');expect(from).not.toHaveBeenCalled()});
 it('filtruje role podle přihlášeného účtu',async()=>{const eq=vi.fn().mockResolvedValue({data:[{role:'coach',clubs:{id:'club-a',name:'Fiktivní klub A'}},{role:'invalid',clubs:{id:'club-b',name:'Fiktivní klub B'}}],error:null});const select=vi.fn(()=>({eq}));const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from:vi.fn(()=>({select}))} as unknown as SupabaseClient;expect(await loadClubAccess(client)).toEqual([{id:'club-a',name:'Fiktivní klub A',role:'coach'}]);expect(eq).toHaveBeenCalledWith('user_id','user-a')});
 it('při chybě databáze nepoužije demo data',async()=>{const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from:()=>({select:()=>({eq:async()=>({data:null,error:new Error('Denied')})})})} as unknown as SupabaseClient;await expect(loadClubAccess(client)).rejects.toThrow('Přístup ke klubu')});
});
