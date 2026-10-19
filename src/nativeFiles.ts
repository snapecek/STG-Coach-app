import {isNativeApp} from './nativePlatform';

export function shareCancelled(error:unknown){return error instanceof DOMException&&error.name==='AbortError'||error instanceof Error&&/^(Share cancel[le]+d|User cancel[le]+d)/i.test(error.message)}
function download(file:File){const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60_000)}
async function base64(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Soubor nelze připravit.'));reader.readAsDataURL(blob)})}

export async function exportFile(file:File,{share=false,title=file.name,text=''}={}):Promise<'shared'|'downloaded'>{
 if(!isNativeApp()){
  if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title,text});return 'shared'}
  download(file);return 'downloaded';
 }
 // Avoid base64 memory pressure for large backups; the protected server archive remains available.
 if(file.size>64*1024*1024)throw new Error('Soubor je pro export z telefonu příliš velký. Pro soubory nad 64 MB použijte webovou aplikaci na počítači.');
 const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
 const directory=Directory.Cache,path='trenomi-exports/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
 // Share targets can read after the share sheet closes. Keep files in the private
 // cache until the next export after 24h, rather than deleting a live attachment.
 try{const old=await Filesystem.readdir({directory,path:'trenomi-exports'});for(const item of old.files)if(item.type==='file'&&item.mtime&&item.mtime<Date.now()-86400000)await Filesystem.deleteFile({directory,path:'trenomi-exports/'+item.name})}catch{/* Cache may not exist yet. */}
 const saved=await Filesystem.writeFile({directory,path,data:await base64(file),recursive:true});
 await Share.share({title,text,files:[saved.uri],dialogTitle:share?'Sdílet z Trenomi':'Uložit nebo sdílet soubor'});
 return 'shared';
}

export async function shareInvitation(options:{title:string;text:string;url:string}){
 if(isNativeApp()){const {Share}=await import('@capacitor/share');await Share.share(options);return true}
 if(!navigator.share)return false;
 await navigator.share(options);return true;
}
