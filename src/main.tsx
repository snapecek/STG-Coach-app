import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {CloudWorkspace} from './CloudWorkspace';
import './style.css';
const DemoApp=lazy(()=>import('./DemoApp'));
const demo=new URLSearchParams(window.location.search).get('workspace')==='demo';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{demo?<Suspense fallback={<p role="status">Načítám demo…</p>}><DemoApp/></Suspense>:<CloudWorkspace/>}</React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');
