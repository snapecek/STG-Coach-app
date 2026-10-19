import {ReleaseNotice} from './ReleaseNotice';
import {DialogAccessibility} from './DialogAccessibility';
import {UnsavedChangesPrompt} from './UnsavedChanges';
import React from 'react';
import {RenderBoundary} from './LoadBoundary';
import {createRoot} from 'react-dom/client';
import {CloudWorkspace} from './CloudWorkspace';
import {isIosStandalone} from './iosPwa';
import {isNativeApp} from './nativePlatform';
import {initializeNativeApp,revealNativeApp} from './nativeRuntime';
import {Capacitor} from '@capacitor/core';
import './style.css';
import './light-theme.css';
import './native.css';
document.documentElement.classList.toggle('native-app',isNativeApp());
document.documentElement.classList.toggle('native-ios',isNativeApp()&&Capacitor.getPlatform()==='ios');
document.documentElement.classList.toggle('native-android',isNativeApp()&&Capacitor.getPlatform()==='android');
document.documentElement.classList.toggle('ios-standalone',!isNativeApp()&&isIosStandalone({
 userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints,
 standalone:matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true,
}));
// Bookmarks to the original trainer prototype now open the single club app.
// Keep local demo data untouched; never import it into a real club automatically.
const url=new URL(window.location.href);
if(url.searchParams.get('workspace')==='demo'){
 url.searchParams.delete('workspace');
 window.history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function render(){createRoot(document.getElementById('root')!).render(<React.StrictMode><RenderBoundary root><DialogAccessibility/><UnsavedChangesPrompt/><ReleaseNotice/><CloudWorkspace/></RenderBoundary></React.StrictMode>);revealNativeApp()}
if(isNativeApp())void initializeNativeApp().catch(()=>{/* Keep login usable if a device bridge is unavailable. */}).finally(render);else render();
if(import.meta.env.PROD&&!isNativeApp()&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');
