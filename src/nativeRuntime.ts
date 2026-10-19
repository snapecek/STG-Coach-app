import {Capacitor,SystemBars,SystemBarsStyle} from '@capacitor/core';
import {isNativeApp,publicAppOrigin,setNativeAppActive} from './nativePlatform';
import {nativeLinkTarget,singleUseNativeLink} from './nativeLinks';
import {requestLeave} from './UnsavedChanges';

export async function initializeNativeApp(){
 if(!isNativeApp())return;
 const {App}=await import('@capacitor/app');
 const accept=async(value:string,cold=false)=>{
  const target=nativeLinkTarget(value,publicAppOrigin());if(!target)return;
  // App.getLaunchUrl can keep the original intent across WebView reloads.
  // Store only digests, never raw email tokens, to avoid consuming it twice.
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
  const once=singleUseNativeLink(target);
  let consumed:string[]=[];try{const saved=JSON.parse(localStorage.getItem('trenomi-native-consumed-auth')||'[]');if(Array.isArray(saved))consumed=saved.filter(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))}catch{}
  if(once&&consumed.includes(digest))return;
  try{if(cold&&sessionStorage.getItem('trenomi-native-launch-consumed')===digest)return}catch{}
  const remember=()=>{try{if(once)localStorage.setItem('trenomi-native-consumed-auth',JSON.stringify([...consumed.slice(-127),digest]));if(cold)sessionStorage.setItem('trenomi-native-launch-consumed',digest)}catch{}};
  if(cold){remember();history.replaceState(history.state,'',target)}
  else requestLeave(()=>{remember();void import('@capacitor/browser').then(({Browser})=>Browser.close()).catch(()=>{});location.assign(target)});
 };
 await App.addListener('appUrlOpen',event=>{void accept(event.url).catch(()=>{})});
 const launch=await App.getLaunchUrl();if(launch&&!location.search&&!location.hash)await accept(launch.url,true);
 await App.addListener('appStateChange',({isActive})=>{
  setNativeAppActive(isActive);window.dispatchEvent(new CustomEvent('trenomi-app-state',{detail:{active:isActive}}));
  document.dispatchEvent(new Event('visibilitychange'));
 });
 const syncTheme=()=>{
  const light=document.documentElement.dataset.theme==='light';
  void SystemBars.setStyle({style:light?SystemBarsStyle.Light:SystemBarsStyle.Dark}).catch(()=>{});
  if(Capacitor.getPlatform()==='ios')void import('@capacitor/keyboard').then(({Keyboard,KeyboardStyle})=>Keyboard.setStyle({style:light?KeyboardStyle.Light:KeyboardStyle.Dark})).catch(()=>{});
 };
 syncTheme();window.addEventListener('trenomi-theme-changed',syncTheme);
 document.addEventListener('click',event=>{
  const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
  if(!link||event.defaultPrevented||link.hasAttribute('download'))return;
  const url=new URL(link.href);
  const external=url.protocol==='https:'&&url.origin!==location.origin;
  const guide=url.origin===location.origin&&/^\/navod[^/]*\.html$/.test(url.pathname);
  if(external||guide){event.preventDefault();const target=guide?new URL(url.pathname,publicAppOrigin()).href:url.href;void import('@capacitor/browser').then(({Browser})=>Browser.open({url:target})).catch(()=>{})}
 });
 if(Capacitor.getPlatform()==='android')await App.addListener('backButton',()=>{
  // Native dialogs (Studio/help) use cancel; older React dialogs already handle Escape.
  const dialog=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
  if(dialog){if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();return}
  const modal=document.querySelector('[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]');
  const menu=document.querySelector<HTMLDetailsElement>('.user-menu[open]'),notifications=document.querySelector('.notification-panel');
  const key=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  (document.activeElement||document.body).dispatchEvent(key);
  if(modal||key.defaultPrevented||notifications)return;
  if(menu){menu.open=false;return}
  const overview=document.querySelector<HTMLButtonElement>('.mobile-club-nav button');
  if(overview&&!overview.classList.contains('active')){overview.click();return}
  requestLeave(()=>void App.minimizeApp());
 });
}

export function revealNativeApp(){
 if(isNativeApp())requestAnimationFrame(()=>requestAnimationFrame(()=>{void import('@capacitor/splash-screen').then(({SplashScreen})=>SplashScreen.hide()).catch(()=>{})}));
}
