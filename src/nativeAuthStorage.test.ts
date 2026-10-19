import {describe,it,expect,vi} from 'vitest';
import {createNativeAuthStorage} from './nativeAuthStorage';
function store(){const values=new Map<string,string>();return {values,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}}}
function setup(){const preferences=store(),temporary=store(),device=store();const persistent={getItem:vi.fn(async(k:string)=>device.getItem(k)),setItem:vi.fn(async(k:string,v:string)=>device.setItem(k,v)),removeItem:vi.fn(async(k:string)=>device.removeItem(k))};return {preferences,temporary,device,persistent,auth:createNativeAuthStorage(preferences,temporary,persistent)}}
describe('native secure login storage',()=>{
 it('keeps session and PKCE verifier out of plain preferences, restores across new controllers and clears on logout',async()=>{
  const s=setup();await s.auth.storage.setItem('session','saved-session');await s.auth.storage.setItem('verifier','pkce-verifier');
  expect(s.preferences.values.size).toBe(0);expect(s.temporary.values.size).toBe(0);
  const restarted=createNativeAuthStorage(s.preferences,s.temporary,s.persistent);expect(await restarted.storage.getItem('session')).toBe('saved-session');
  await restarted.storage.removeItem('session');expect(await restarted.storage.getItem('session')).toBeNull();expect(s.temporary.getItem('session')).toBeNull();
 });
 it('moves login and verifier together when remember is toggled and respects operation order',async()=>{
  const s=setup();await s.auth.storage.setItem('session','saved');await s.auth.storage.setItem('verifier','proof');
  await s.auth.setRemember(false);expect(s.device.values.size).toBe(0);expect(s.auth.getRemember()).toBe(false);expect(s.temporary.getItem('session')).toBe('saved');
  await Promise.all([s.auth.setRemember(true),s.auth.storage.setItem('session','refreshed')]);
  expect(s.device.getItem('session')).toBe('refreshed');expect(s.device.getItem('verifier')).toBe('proof');expect(s.temporary.values.size).toBe(0);
 });
 it('does not erase the source or claim success when secure storage fails',async()=>{
  const s=setup();await s.auth.setRemember(false);await s.auth.storage.setItem('session','saved');await s.auth.storage.setItem('verifier','proof');
  s.persistent.setItem.mockImplementation(async(k,v)=>{if(k==='verifier')throw new Error('Device locked');s.device.setItem(k,v)});
  await expect(s.auth.setRemember(true)).rejects.toThrow('Device locked');expect(s.auth.getRemember()).toBe(false);expect(s.temporary.getItem('session')).toBe('saved');expect(s.temporary.getItem('verifier')).toBe('proof');
  expect(await s.auth.storage.getItem('session')).toBe('saved');
 });
});
