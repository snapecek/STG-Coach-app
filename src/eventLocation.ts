import type {SupabaseClient} from '@supabase/supabase-js';
export type MapPoint={lat:number;lng:number};
export type MapArrow={from:MapPoint;to:MapPoint};
export type EventLocation={point:MapPoint;arrows:MapArrow[];note:string};
export function validMapPoint(value:unknown):value is MapPoint{if(!value||typeof value!=='object')return false;const p=value as MapPoint;return typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=85&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180}
export function validateEventLocation(value:unknown):EventLocation|null{
 if(value===null)return null;
 const v=value as EventLocation;if(!v||!validMapPoint(v.point)||!Array.isArray(v.arrows)||v.arrows.length>8||typeof v.note!=='string'||v.note.length>500||v.arrows.some(a=>!a||!validMapPoint(a.from)||!validMapPoint(a.to)||(a.from.lat===a.to.lat&&a.from.lng===a.to.lng)))throw new Error('Zkontrolujte místo na mapě, nejvýše 8 šipek a pokyny do 500 znaků.');
 const point=(p:MapPoint)=>({lat:p.lat,lng:p.lng});return {point:point(v.point),arrows:v.arrows.map(a=>({from:point(a.from),to:point(a.to)})),note:v.note.trim()};
}
export function locationFields(value:EventLocation|null|undefined){return value===undefined?{}:{event_location:validateEventLocation(value)}}
export function parseMapCoordinates(text:string):MapPoint|null{const number='(-?\\d+(?:\\.\\d+)?)',match=text.trim().match(new RegExp('^'+number+'\\s*[,;\\s]\\s*'+number+'$'));if(!match)return null;const p={lat:Number(match[1]),lng:Number(match[2])};return validMapPoint(p)?p:null}
export function eventMapLinks(point:MapPoint){const gps=point.lat+','+point.lng;return {google:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(gps),mapy:`https://mapy.com/zakladni?x=${point.lng}&y=${point.lat}&z=17&source=coor&id=${encodeURIComponent(point.lng+','+point.lat)}`}}

export async function requireLocationMigration(client:SupabaseClient,clubId:string){const {error}=await client.from('events').select('event_location').eq('club_id',clubId).limit(1);if(error){if(['42703','PGRST204'].includes(error.code))throw new Error('Pro uložení mapy nejdříve nahrajte migraci 038 v Supabase.');throw new Error('Mapu nelze ověřit. Zkontrolujte připojení a zkuste uložení znovu.')}}
