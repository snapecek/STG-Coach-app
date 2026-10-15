import {describe,it,expect} from 'vitest';
import {validateMessage,validateFeedback,validateFeedbackImage,communicationRpc} from './communication';
import type {SupabaseClient} from '@supabase/supabase-js';
describe('communication input boundaries',()=>{
 it('trims messages but retains multiline text and treats markup as text',()=>{expect(validateMessage('  Ahoj\n<script>text</script>  ')).toBe('Ahoj\n<script>text</script>');expect(()=>validateMessage(' \n ')).toThrow();expect(validateMessage('a'.repeat(2000))).toHaveLength(2000);expect(()=>validateMessage('a'.repeat(2001))).toThrow()});
 it('requires a meaningful report with bounded title and body',()=>{expect(validateFeedback(' Název ',' Popis ')).toEqual({title:'Název',body:'Popis'});expect(()=>validateFeedback('', 'popis')).toThrow();expect(()=>validateFeedback('název',' ')).toThrow();expect(()=>validateFeedback('a'.repeat(121),'popis')).toThrow();expect(()=>validateFeedback('název','a'.repeat(5001))).toThrow()});
 it('rejects active images and oversize uploads',()=>{for(const file of [{type:'image/svg+xml',size:100},{type:'image/png',size:5242881},{type:'image/jpeg',size:0}])expect(()=>validateFeedbackImage(file as File)).toThrow();expect(()=>validateFeedbackImage({type:'image/webp',size:5242880} as File)).not.toThrow()});
 it('explains pending migrations and revoked access without exposing server details',async()=>{for(const [code,text] of [['PGRST202','024'],['42501','přístup'],['XX000','připojení']]){const client={rpc:async()=>({data:null,error:{code,message:'private server details'}})} as unknown as SupabaseClient;await expect(communicationRpc(client,'list_chat_messages',{})).rejects.toThrow(text)}});
});
