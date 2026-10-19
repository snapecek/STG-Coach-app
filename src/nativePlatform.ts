import {Capacitor} from '@capacitor/core';

export const isNativeApp=()=>Capacitor.isNativePlatform();
let active=true;
export const nativeAppActive=()=>active;
export function setNativeAppActive(value:boolean){active=value}

// Links sent to other people must never contain capacitor://localhost or https://localhost.
export function publicAppOrigin(){
 if(!isNativeApp())return location.origin;
 const url=new URL(import.meta.env.VITE_PUBLIC_APP_URL||'https://project-ym4q2.vercel.app');
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Veřejná adresa aplikace musí být kořenová HTTPS adresa.');
 return url.origin;
}
export function authRedirectUrl(type:'signup'|'recovery'){
 const url=new URL(isNativeApp()?'trenomi://auth/':publicAppOrigin()+'/');
 url.searchParams.set('auth',type);return url;
}
