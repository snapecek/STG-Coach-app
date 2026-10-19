import {StudioTrenomiButton} from './StudioTrenomiButton';
import {useCallback,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ClubAccess} from './supabase';
import type {EventRow} from './clubData';
import {EventPhotos,type Preview} from './EventPhotos';
import {JournalShareDialog} from './JournalShareDialog';
import {JournalSharePanel} from './JournalSharePanel';
import {useClubProfile} from './clubSettings';
export function MemberTrainingPhotos({client,club,event,memberId}:{client:SupabaseClient;club:ClubAccess;event:EventRow;memberId:string}){
 const [photos,setPhotos]=useState<Preview[]>([]),[sharing,setSharing]=useState(false);
 const receivePhotos=useCallback((rows:Preview[])=>setPhotos(rows),[]),branding=useClubProfile(client,club.id,0);
 const photo=photos.find(p=>p.path===event.cover_photo_path)?.url||photos[0]?.url||null;
 const metrics=[...(event.actual_duration_minutes!=null?[{label:'délka',value:event.actual_duration_minutes+' min'}]:[]),...(event.actual_distance_km!=null?[{label:'vzdálenost',value:Number(event.actual_distance_km).toLocaleString('cs-CZ')+' km'}]:[]),...(event.perceived_effort!=null?[{label:'zátěž',value:'RPE '+event.perceived_effort}]:[])];
 return <section className="member-training-photos" aria-label="Fotografie a sdílení tréninku"><StudioTrenomiButton onClick={()=>setSharing(true)}/><EventPhotos key={event.id} client={client} clubId={club.id} eventId={event.id} disabled readOnly variant="journal" coverPhotoPath={event.cover_photo_path} onPhotosLoaded={receivePhotos} onChange={()=>{}} onBusyChange={()=>{}}/><JournalShareDialog open={sharing} onClose={()=>setSharing(false)}><JournalSharePanel team={club.name} clubLogo={branding.logoUrl} eventName={event.name} date={new Date(event.starts_at).toLocaleDateString('cs-CZ',{timeZone:'Europe/Prague'})} place={event.place} photo={photo} photos={photos} photoSelectionKey={`${memberId}:${club.id}:${event.id}`} metrics={metrics} best={[]} defaultCaption={`${event.name}\n${club.name}`}/></JournalShareDialog></section>;
}
