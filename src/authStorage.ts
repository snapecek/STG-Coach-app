// Keep Supabase's existing storage keys. Only the chosen storage location changes.
export const rememberLoginKey='trenomi-remember-login';
type AuthStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function rememberLoginPreference(storage:Pick<Storage,'getItem'>){try{return storage.getItem(rememberLoginKey)!=='0'}catch{return false}}
export function createAuthStorage(persistent:AuthStorage,temporary:AuthStorage){
 let remember=rememberLoginPreference(persistent);
 const keys=new Set<string>();
 const storage={
  getItem(key:string){
   keys.add(key);
   if(!remember)return temporary.getItem(key);
   const saved=persistent.getItem(key);if(saved!==null)return saved;
   // Carry over a valid session from older releases without forcing a new login.
   const legacy=temporary.getItem(key);if(legacy!==null){persistent.setItem(key,legacy);temporary.removeItem(key)}return legacy;
  },
  setItem(key:string,value:string){keys.add(key);(remember?persistent:temporary).setItem(key,value);(remember?temporary:persistent).removeItem(key)},
  removeItem(key:string){keys.add(key);persistent.removeItem(key);temporary.removeItem(key)}
 };
 return {storage,getRemember:()=>remember,setRemember(value:boolean){
  if(value!==remember){const source=remember?persistent:temporary,destination=value?persistent:temporary;for(const key of keys){const session=source.getItem(key);if(session===null)destination.removeItem(key);else destination.setItem(key,session);source.removeItem(key)}}
  persistent.setItem(rememberLoginKey,value?'1':'0');remember=value;
 }};
}
