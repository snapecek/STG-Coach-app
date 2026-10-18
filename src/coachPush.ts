import type {SupabaseClient} from '@supabase/supabase-js';
const pushOwnerKey='trenomi-push-owner';
export const pushSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
export function needsHomeScreen(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?!matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone:false}
function keyBytes(key:string){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function registration(){return 'serviceWorker' in navigator?await navigator.serviceWorker.getRegistration():undefined}
export async function pushEnabled(client:SupabaseClient){const sub=await(await registration())?.pushManager.getSubscription();if(!sub)return false;const {data,error}=await client.rpc('coach_push_enabled',{push_endpoint:sub.endpoint});if(error)throw new Error('Stav oznámení nelze načíst. Ověřte migraci 040.');return data===true}
export async function enableCoachPush(client:SupabaseClient){
 if(!pushSupported()||needsHomeScreen())throw new Error('Na iPhonu nejprve přidejte Trenomi na plochu a otevřete ji odtud.');
 // Request directly from the button gesture, never automatically during rendering.
 if(await Notification.requestPermission()!=='granted')throw new Error('Oznámení nejsou povolená. Povolte je v nastavení telefonu nebo prohlížeče.');
 const {data,error}=await client.functions.invoke('push-rsvp',{method:'GET'});if(error||!/^[A-Za-z0-9_-]{87}$/.test(data?.publicKey||''))throw new Error('Server oznámení zatím není připravený. Správce musí nasadit push-rsvp a nastavit odesílání.');
 const user=await client.auth.getUser();if(user.error||!user.data.user)throw new Error('Přihlaste se znovu.');
 await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(data.publicKey)});
 const json=sub.toJSON();const saved=await client.rpc('register_coach_push',{push_endpoint:sub.endpoint,push_p256dh:json.keys?.p256dh,push_auth:json.keys?.auth});
 if(saved.error){await sub.unsubscribe();throw new Error('Zařízení nelze přihlásit k oznámením. Ověřte migraci 040 a trenérská práva.');}
 localStorage.setItem(pushOwnerKey,user.data.user.id);
}
export async function disableCoachPush(client?:SupabaseClient){
 if(!pushSupported())return;
 const reg=await registration(),sub=await reg?.pushManager.getSubscription();let failed=false;
 if(sub){let stopped=false;try{stopped=await sub.unsubscribe()}catch{}if(client){try{const {error}=await client.rpc('unregister_coach_push',{push_endpoint:sub.endpoint});failed=!!error}catch{failed=true}}else failed=true;if(!stopped&&failed)throw new Error('Oznámení nelze vypnout. Zkuste to znovu.');}
 if(reg)for(const n of await reg.getNotifications())n.close();localStorage.removeItem(pushOwnerKey);
}
export async function reconcilePushIdentity(userId:string|null){if(!pushSupported())return;const owner=localStorage.getItem(pushOwnerKey);if(owner&&owner!==userId)await disableCoachPush()}
export type PushTarget={clubId:string;eventId:string};
export function readPushTarget(url:string):PushTarget|null{const u=new URL(url),prefix=u.searchParams.has('rsvp-club')?'rsvp':'push',clubId=u.searchParams.get(prefix+'-club')||'',eventId=u.searchParams.get(prefix+'-event')||'',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;return uuid.test(clubId)&&uuid.test(eventId)?{clubId,eventId}:null}
