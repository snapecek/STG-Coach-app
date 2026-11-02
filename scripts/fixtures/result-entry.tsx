import React from 'react';
import {createRoot} from 'react-dom/client';
import {RaceResultsPanel} from '/src/RaceResultsPanel';
import '/src/style.css';
const noop=()=>{};
createRoot(document.getElementById('root')!).render(<><RaceResultsPanel client={{} as any} club={{id:'club'} as any} event={{id:'event',status:'scheduled'} as any} members={[{id:'a',name:'Hotový'},{id:'b',name:'Nový'}] as any} participation={[]} busy={false} onBusyChange={noop} onChange={noop} onLoaded={noop} onTeamsReady={noop}/></>);
import {AttendanceReview,AttendanceChoices} from '/src/AttendanceReviewPanel';
const event={id:'attendance',status:'scheduled',starts_at:'2020-01-01T10:00:00Z',duration_minutes:60};
createRoot(document.body.appendChild(document.createElement('div'))).render(<AttendanceReview event={event as any} members={[{id:'a',name:'Test'}] as any} rows={[]} now={Date.now()} busy={false} onSave={async updates=>{(window as any).savedAttendance=updates;return true}}>{(choice,setChoice)=><AttendanceChoices value={choice('a')} onChange={v=>setChoice('a',v)} disabled={false} label="Testovací docházka"/>}</AttendanceReview>);
