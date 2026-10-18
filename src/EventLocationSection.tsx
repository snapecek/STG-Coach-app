import {LoadBoundary} from './LoadBoundary';
import {lazy,useState} from 'react';
import {MapPin,ChevronDown} from 'lucide-react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import {SavedLocationPicker} from './SavedLocationPicker';
import type {EventLocation} from './eventLocation';
const LocationMap=lazy(()=>import('./EventLocationMap').then(m=>({default:m.EventLocationMap})));
export function EventLocationSection({value,onChange,place,disabled,inline=false,client,club,onPlaceChange}:{inline?:boolean;client?:SupabaseClient;club?:ClubAccess;onPlaceChange?:(place:string)=>void;value:EventLocation|null|undefined;onChange?:(location:EventLocation|null)=>void;place?:string;disabled?:boolean}){
 const [open,setOpen]=useState(false);if(!value&&!onChange)return null;
 if(inline&&value)return <section className="event-location-section event-location-inline" aria-label="Místo a navigace"><h3><MapPin size={16}/> Místo a navigace</h3><LoadBoundary fallback={<p>Načítám mapu…</p>}><LocationMap value={value} place={place}/></LoadBoundary></section>;
 return <><div className="saved-location-controls">{client&&club&&onChange&&<SavedLocationPicker client={client} club={club} value={value||null} place={place||''} disabled={disabled} onChange={onChange} onPlaceChange={onPlaceChange}/>}</div><details className="event-location-section" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary><MapPin size={16}/>{onChange?'Mapa místa a přístup (volitelné)':'Zobrazit mapu a přístup'}<ChevronDown size={16}/></summary>{open&&<LoadBoundary fallback={<p>Načítám mapu…</p>}><LocationMap value={value||null} onChange={onChange} place={place} disabled={disabled}/></LoadBoundary>}</details></>;
}
