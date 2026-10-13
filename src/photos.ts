import type {SupabaseClient} from '@supabase/supabase-js';
export const photoBucket='club-photos';
export const maxEventPhotos=20;
export type PhotoRef={name:string;path:string;bytes:number|null};
export function photoPrefix(clubId:string,eventId:string){const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;if(!uuid.test(clubId)||!uuid.test(eventId))throw new Error('Neplatná událost pro fotografie.');return `${clubId}/${eventId}`;}
export async function listEventPhotos(client:SupabaseClient,clubId:string,eventId:string):Promise<PhotoRef[]>{
 const prefix=photoPrefix(clubId,eventId),result:PhotoRef[]=[];
 for(let offset=0;;offset+=100){const {data,error}=await client.storage.from(photoBucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error||!data)throw new Error('Fotografie nelze načíst. Zkontrolujte přihlášení a oprávnění.');for(const file of data)if(file.id&&/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/.test(file.name))result.push({name:file.name,path:`${prefix}/${file.name}`,bytes:file.metadata?.size??null});if(data.length<100)return result;}
}
export async function removeAllEventPhotos(client:SupabaseClient,clubId:string,eventId:string){const photos=await listEventPhotos(client,clubId,eventId);if(photos.length){const {error}=await client.storage.from(photoBucket).remove(photos.map(p=>p.path));if(error)throw new Error('Fotografie se nepodařilo odstranit. Událost nebyla smazána.');if((await listEventPhotos(client,clubId,eventId)).length)throw new Error('Ne všechny fotografie byly odstraněné. Událost nebyla smazána.');}}
export async function removeEventPhoto(client:SupabaseClient,clubId:string,eventId:string,path:string){const prefix=photoPrefix(clubId,eventId);if(!path.startsWith(prefix+'/')||path.slice(prefix.length+1).includes('/'))throw new Error('Fotografie nepatří k této události.');const {error}=await client.storage.from(photoBucket).remove([path]);if(error)throw new Error('Fotografii se nepodařilo smazat.');if((await listEventPhotos(client,clubId,eventId)).some(p=>p.path===path))throw new Error('Smazání fotografie nebylo potvrzené. Zkuste obnovit galerii.');}
export async function preparePhoto(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Vyberte JPG, PNG nebo WebP fotografii.');
 if(file.size>16*1024*1024)throw new Error('Vstupní fotografie musí mít nejvýše 16 MB.');
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file)}catch{throw new Error('Soubor není platná fotografie.');}
 try{const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Fotografii nelze připravit.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  // Re-encoding drops original EXIF/GPS and filenames before any upload.
  const output=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Fotografii nelze připravit.')),'image/jpeg',.85));if(output.size>8*1024*1024)throw new Error('Výsledná fotografie je příliš velká.');return output;
 }finally{bitmap.close();}
}
export async function uploadEventPhoto(client:SupabaseClient,clubId:string,eventId:string,file:File){const prefix=photoPrefix(clubId,eventId);const existing=await listEventPhotos(client,clubId,eventId);if(existing.length>=maxEventPhotos)throw new Error('U události může být nejvýše 20 fotografií.');const blob=await preparePhoto(file);const path=`${prefix}/${crypto.randomUUID()}.jpg`;const {error}=await client.storage.from(photoBucket).upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'0'});if(error)throw new Error('Fotografii se nepodařilo nahrát. Zkontrolujte připojení a oprávnění.');return path;}
