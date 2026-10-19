import {rememberLoginKey,rememberLoginPreference} from './authStorage';
type Store={getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>;removeItem:(key:string)=>Promise<void>};
type WebStore=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

function deviceStore(preferences:WebStore):Store{
 let ready:Promise<Store>|undefined;
 const load=()=>ready??=(async()=>{
  const {SecureStorage,KeychainAccess}=await import('@aparajita/capacitor-secure-storage');
  await SecureStorage.setKeyPrefix('trenomi-auth:');
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  // iOS keychain can survive uninstall. A fresh WebView must not silently
  // revive a previous installation's login.
  if(!preferences.getItem('trenomi-native-install')){await SecureStorage.clear(false);preferences.setItem('trenomi-native-install','1')}
  return SecureStorage;
 })();
 return {getItem:async key=>(await load()).getItem(key),setItem:async(key,value)=>(await load()).setItem(key,value),removeItem:async key=>(await load()).removeItem(key)};
}

export function createNativeAuthStorage(preferences:WebStore,temporary:WebStore,persistent:Store=deviceStore(preferences)){
 let remember=rememberLoginPreference(preferences),pending=Promise.resolve();
 const keys=new Set<string>();
 function run<T>(action:()=>Promise<T>){const result=pending.then(action);pending=result.then(()=>{},()=>{});return result}
 const storage={
  getItem(key:string){keys.add(key);return run(async()=>remember?persistent.getItem(key):temporary.getItem(key))},
  setItem(key:string,value:string){keys.add(key);return run(async()=>{if(remember){await persistent.setItem(key,value);temporary.removeItem(key)}else{temporary.setItem(key,value);await persistent.removeItem(key)}})},
  removeItem(key:string){keys.add(key);return run(async()=>{temporary.removeItem(key);await persistent.removeItem(key)})},
 };
 return {storage,getRemember:()=>remember,setRemember(value:boolean){return run(async()=>{
  if(value===remember)return;
  for(const key of keys){
   const saved=remember?await persistent.getItem(key):temporary.getItem(key);
   if(value){if(saved===null)await persistent.removeItem(key);else await persistent.setItem(key,saved)}
   else{if(saved===null)temporary.removeItem(key);else temporary.setItem(key,saved)}
  }
  // Do not delete any source item until every destination write succeeded.
  for(const key of keys)if(value)temporary.removeItem(key);else await persistent.removeItem(key);
  preferences.setItem(rememberLoginKey,value?'1':'0');remember=value;
 })}};
}
