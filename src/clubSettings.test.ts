import {describe,it,expect} from 'vitest';
import {validateClubName,validateLogo,settingsRpc} from './clubSettings';
import type {SupabaseClient} from '@supabase/supabase-js';
describe('club settings boundaries',()=>{
 it('requires a bounded club name',()=>{expect(validateClubName(' Klub ')).toBe('Klub');for(const n of ['  ','a'.repeat(101)])expect(()=>validateClubName(n)).toThrow()});
 it('rejects active images, empty files and large uploads',()=>{for(const file of [{type:'image/svg+xml',size:100},{type:'image/png',size:0},{type:'image/jpeg',size:8388609}])expect(()=>validateLogo(file)).toThrow();expect(()=>validateLogo({type:'image/webp',size:100})).not.toThrow()});
 it('explains pending migration and denies unauthorized access without exposing server details',async()=>{for(const [code,message,text] of [['PGRST202','Secret','029'],['42501','Secret','oprávnění'],['P0001','Member account unavailable','účet'],['XX000','Secret','připojení']]){const client={rpc:async()=>({data:null,error:{code,message}})} as unknown as SupabaseClient;await expect(settingsRpc(client,'add_club_coach',{})).rejects.toThrow(text)}});
});
