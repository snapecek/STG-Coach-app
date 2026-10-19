import {createAuthStorage} from './authStorage';
import {createNativeAuthStorage} from './nativeAuthStorage';
import {isNativeApp} from './nativePlatform';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';

export function validatePublicConfig(url:string|undefined,key:string|undefined){
  if(!url||!key)throw new Error('Doplňte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY v nastavení prostředí.');
  let parsed:URL;try{parsed=new URL(url)}catch{throw new Error('URL Supabase není platná.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('Supabase musí používat HTTPS URL bez přihlašovacích údajů.');
  if(key.startsWith('sb_secret_'))throw new Error('Do prohlížeče patří pouze veřejný publishable nebo anon klíč.');
  if(!key.startsWith('sb_publishable_')){
    try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw new Error();}
    catch{throw new Error('Do prohlížeče patří pouze veřejný publishable nebo anon klíč.');}
  }
  return {url:parsed.origin,key};
}
let client:SupabaseClient|undefined;
let loginStorage:ReturnType<typeof createAuthStorage>|ReturnType<typeof createNativeAuthStorage>|undefined;
export const rememberLoginEnabled=()=>loginStorage?.getRemember()??true;
export async function setRememberLogin(value:boolean){if(!loginStorage)throw new Error('Přihlašování není připravené. Obnovte stránku.');try{await loginStorage.setRemember(value)}catch{throw new Error('Zařízení nepovoluje uložit volbu přihlášení. Zkontrolujte úložiště a zkuste to znovu.')}}
export function configuredClient(){
  if(client)return client;
  const config=validatePublicConfig(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
  loginStorage=isNativeApp()?createNativeAuthStorage(window.localStorage,window.sessionStorage):createAuthStorage(window.localStorage,window.sessionStorage);
  client=createClient(config.url,config.key,{auth:{storage:loginStorage.storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:isNativeApp()?'pkce':'implicit'}});
  if(isNativeApp())window.addEventListener('trenomi-app-state',event=>{if((event as CustomEvent<{active:boolean}>).detail.active)client?.auth.startAutoRefresh();else client?.auth.stopAutoRefresh()});
  return client;
}
export type ClubAccess={id:string;name:string;role:'owner'|'coach'|'member'};
export async function loadClubAccess(client:SupabaseClient):Promise<ClubAccess[]>{
  // Verify identity against Auth before querying any club data. RLS remains authoritative.
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError||!identity.user)throw new Error('Přihlášení vypršelo. Přihlaste se znovu.');
  const {data,error}=await client.from('club_roles').select('club_id,role,clubs(id,name)').eq('user_id',identity.user.id);
  if(error)throw new Error('Přístup ke klubu se nepodařilo ověřit. Zkontrolujte migrace a oprávnění.');
  return (data||[]).flatMap(row=>{
    const club=Array.isArray(row.clubs)?row.clubs[0]:row.clubs;
    return club&&['owner','coach','member'].includes(row.role)?[{id:club.id,name:club.name,role:row.role as ClubAccess['role']}]:[];
  });
}
