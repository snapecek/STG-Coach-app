import type {SupabaseClient} from '@supabase/supabase-js';
export type FailureKind='render'|'module'|'slow';
export type Diagnostic={incident:string;release:string;kind:FailureKind;scope:'root'|'section';screen:string};
export const release=import.meta.env.VITE_APP_RELEASE||'development';
let client:SupabaseClient|null=null;
const reported=new Map<string,Diagnostic>();
export function configureDiagnostics(value:SupabaseClient){client=value}
export function failureKind(error:unknown):FailureKind{return error instanceof Error&&/dynamically imported module|loading chunk|module script|importing a module/i.test(error.message)?'module':'render'}
export function reportFailure(kind:FailureKind,root=false):Diagnostic{
 const names:Record<string,string>={'Přehled':'overview','Kalendář':'calendar','Docházka':'attendance','Členové':'members','Analýza':'analysis','Deník':'journal','Šablony':'templates'};
 const selected=document.querySelector('.club-sidebar button.active,.mobile-nav button.active')?.textContent?.trim()||'';
 const screen=names[selected]||(document.querySelector('form input[autocomplete="current-password"]')?'auth':'unknown');
 const key=kind+(root?'root':'section')+screen;
 const existing=reported.get(key);if(existing)return existing;
 const diagnostic:Diagnostic={incident:crypto.randomUUID(),release,kind,scope:root?'root':'section',screen};
 // Never send messages, stacks, URLs, names or form contents. Limit repeat reports
 // to one per category and scope during this page lifetime.
 if(client&&import.meta.env.PROD&&!reported.has(key)){
  reported.set(key,diagnostic);const current=client;
  void current.auth.getSession().then(({data})=>{
   if(!data.session)return;
   return fetch('/api/client-error',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(diagnostic),signal:AbortSignal.timeout(5000)});
  }).catch(()=>{});
 }
 return diagnostic;
}
