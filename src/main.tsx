import {ReleaseNotice} from './ReleaseNotice';
import {DialogAccessibility} from './DialogAccessibility';
import {UnsavedChangesPrompt} from './UnsavedChanges';
import React from 'react';
import {RenderBoundary} from './LoadBoundary';
import {createRoot} from 'react-dom/client';
import {CloudWorkspace} from './CloudWorkspace';
import {needsIosPwaHeaderClearance} from './iosPwa';
import './style.css';
import './light-theme.css';
document.documentElement.classList.toggle('ios-pwa-top-clearance',needsIosPwaHeaderClearance({
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
createRoot(document.getElementById('root')!).render(<React.StrictMode><RenderBoundary root><DialogAccessibility/><UnsavedChangesPrompt/><ReleaseNotice/><CloudWorkspace/></RenderBoundary></React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');
