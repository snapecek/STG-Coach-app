import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
beforeEach(()=>{vi.resetModules();vi.stubEnv('PROD',true);vi.stubGlobal('document',{querySelector:()=>({textContent:'Kalendář'})});vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}))});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
it('reports only fixed metadata, groups repeats and retains the same support code',async()=>{
 const {configureDiagnostics,reportFailure,failureKind,release}=await import('./clientDiagnostics');
 configureDiagnostics({auth:{getSession:async()=>({data:{session:{access_token:'fictional-session'}}})}} as unknown as SupabaseClient);
 const kind=failureKind(new Error('Failed to fetch dynamically imported module: https://private.invalid/?token=secret'));
 const first=reportFailure(kind),second=reportFailure(kind);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));expect(second).toEqual(first);
 const request=vi.mocked(fetch).mock.calls[0];expect(request[0]).toBe('/api/client-error');
 const body=JSON.parse(String(request[1]?.body));expect(body).toEqual({incident:first.incident,release,kind:'module',scope:'section',screen:'calendar'});expect(JSON.stringify(body)).not.toContain('secret');expect(JSON.stringify(body)).not.toContain('fictional-session');
});
it('does not send reports before login or from development builds',async()=>{
 const {configureDiagnostics,reportFailure}=await import('./clientDiagnostics');
 const getSession=vi.fn().mockResolvedValue({data:{session:null}});configureDiagnostics({auth:{getSession}} as unknown as SupabaseClient);reportFailure('render');
 await vi.waitFor(()=>expect(getSession).toHaveBeenCalledTimes(1));expect(fetch).not.toHaveBeenCalled();
 vi.stubEnv('PROD',false);reportFailure('module');expect(getSession).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();
});
it('replaces unexpected screen text with a fixed unknown category',async()=>{
 vi.stubGlobal('document',{querySelector:(selector:string)=>selector.startsWith('form')?null:({textContent:'Soukromý název klubu'})});
 const {reportFailure}=await import('./clientDiagnostics');expect(reportFailure('render').screen).toBe('unknown');expect(fetch).not.toHaveBeenCalled();
});
