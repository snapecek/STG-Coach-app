import {describe,it,expect,vi} from 'vitest';
import {invitationHandler} from '../supabase/functions/invite-member/handler';
const clubId='20000000-0000-4000-8000-000000000001',memberId='30000000-0000-4000-8000-000000000001';
function setup(){const deps={authorize:vi.fn(async()=>true),issue:vi.fn(async()=>({id:'invite',token:'a'.repeat(64)})),send:vi.fn(async()=>{}),revoke:vi.fn(async()=>{})};const handler=invitationHandler('https://example.invalid/',deps);return {deps,handler};}
const request=(body:object,origin='https://example.invalid')=>new Request('https://edge.example.invalid',{method:'POST',headers:{Authorization:'Bearer '+ 'fictional'.repeat(8),Origin:origin},body:JSON.stringify(body)});
describe('Serverové pozvánky',()=>{
 it('odmítá cizí origin před Auth a zápisem',async()=>{const {handler,deps}=setup();expect((await handler(request({clubId,memberId,email:'guest@example.invalid'},'https://evil.invalid'))).status).toBe(403);expect(deps.authorize).not.toHaveBeenCalled()});
 it('bez staff role nevolá zápis ani e-mail',async()=>{const {handler,deps}=setup();deps.authorize.mockResolvedValue(false);expect((await handler(request({clubId,memberId,email:'guest@example.invalid'}))).status).toBe(403);expect(deps.issue).not.toHaveBeenCalled();expect(deps.send).not.toHaveBeenCalled()});
 it('ignoruje podvržený redirect a doručuje pouze na pevnou doménu',async()=>{const {handler,deps}=setup();const result=await handler(request({clubId,memberId,email:' GUEST@example.invalid ',redirectTo:'https://evil.invalid'}));expect(result.status).toBe(200);expect(deps.send).toHaveBeenCalledWith('guest@example.invalid','https://example.invalid/?club-invite='+ 'a'.repeat(64));expect((await result.json()).delivery).toBe('queued')});
 it('při chybě doručení odvolá právě vytvořenou pozvánku',async()=>{const {handler,deps}=setup();deps.send.mockRejectedValue(new Error('secret-provider-error'));const response=await handler(request({clubId,memberId,email:'guest@example.invalid'}));expect(response.status).toBe(502);expect(deps.revoke).toHaveBeenCalledWith(expect.any(String),'invite');expect(await response.text()).not.toContain('secret-provider-error')});
 it('odmítne neplatné ID nebo e-mail před zápisem',async()=>{const {handler,deps}=setup();expect((await handler(request({clubId:'foreign',memberId,email:'bad'}))).status).toBe(400);expect(deps.issue).not.toHaveBeenCalled()});
});
