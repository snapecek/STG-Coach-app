import {lazy,Suspense,useState} from 'react';
import {MapPin,ChevronDown} from 'lucide-react';
import type {EventLocation} from './eventLocation';
const LocationMap=lazy(()=>import('./EventLocationMap').then(m=>({default:m.EventLocationMap})));
export function EventLocationSection({value,onChange,place,disabled}:{value:EventLocation|null|undefined;onChange?:(location:EventLocation|null)=>void;place?:string;disabled?:boolean}){
 const [open,setOpen]=useState(false);if(!value&&!onChange)return null;
 return <details className="event-location-section" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary><MapPin size={16}/>{onChange?'Mapa místa a přístup (volitelné)':'Zobrazit mapu a přístup'}<ChevronDown size={16}/></summary>{open&&<Suspense fallback={<p>Načítám mapu…</p>}><LocationMap value={value||null} onChange={onChange} place={place} disabled={disabled}/></Suspense>}</details>;
}
