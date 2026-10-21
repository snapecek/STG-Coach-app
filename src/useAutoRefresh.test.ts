import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {startAutoRefresh} from './useAutoRefresh';
import {CLUB_DATA_CHANGED,FALLBACK_REFRESH_MS as AUTO_REFRESH_MS} from './clubLiveSync';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
let doc:EventTarget&{visibilityState:string},win:EventTarget;
beforeEach(()=>{vi.useFakeTimers();doc=Object.assign(new EventTarget(),{visibilityState:'visible'});win=new EventTarget();vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('navigator',{onLine:true})});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
describe('automatic data refresh',()=>{
 it('refreshes each 30 seconds without live service, without resetting the initial view',async()=>{const load=vi.fn(async()=>['new']),apply=vi.fn(),stop=startAutoRefresh(()=>({load,apply}));expect(load).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(AUTO_REFRESH_MS-1);expect(load).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(apply).toHaveBeenCalledWith(['new']);await vi.advanceTimersByTimeAsync(AUTO_REFRESH_MS);expect(load).toHaveBeenCalledTimes(2);stop()});
 it('never overlaps requests and ignores responses after a local write',async()=>{const pending=deferred<string>(),load=vi.fn(()=>pending.promise),apply=vi.fn();let revision=0;const stop=startAutoRefresh(()=>({load,apply,revision:()=>revision}));await vi.advanceTimersByTimeAsync(90000);expect(load).toHaveBeenCalledTimes(1);revision++;pending.resolve('old');await vi.advanceTimersByTimeAsync(0);expect(apply).not.toHaveBeenCalled();stop()});
 it('pauses while editing or saving and resumes without overwriting the draft',async()=>{let editing=true;const load=vi.fn(async()=>1),apply=vi.fn(),stop=startAutoRefresh(()=>({load,apply,canRefresh:()=>!editing}));await vi.advanceTimersByTimeAsync(60000);expect(load).not.toHaveBeenCalled();editing=false;await vi.advanceTimersByTimeAsync(30000);expect(apply).toHaveBeenCalledWith(1);stop()});
 it('retains the last snapshot after a failed request and retries automatically',async()=>{const load=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('fresh'),apply=vi.fn(),onError=vi.fn(),stop=startAutoRefresh(()=>({load,apply,onError}));await vi.advanceTimersByTimeAsync(30000);expect(apply).not.toHaveBeenCalled();expect(onError).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(30000);expect(apply).toHaveBeenCalledWith('fresh');stop()});
 it('pauses in the background and refreshes immediately when returning or reconnecting',async()=>{const load=vi.fn(async()=>1),apply=vi.fn(),stop=startAutoRefresh(()=>({load,apply}));doc.visibilityState='hidden';await vi.advanceTimersByTimeAsync(30000);expect(load).not.toHaveBeenCalled();doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(0);expect(load).toHaveBeenCalledOnce();(navigator as {onLine:boolean}).onLine=false;await vi.advanceTimersByTimeAsync(30000);expect(load).toHaveBeenCalledOnce();(navigator as {onLine:boolean}).onLine=true;win.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);expect(load).toHaveBeenCalledTimes(2);stop()});
 it('aborts outstanding reads and ignores late results when changing club or unmounting',async()=>{const pending=deferred<string>(),apply=vi.fn();let signal:AbortSignal|undefined;const stop=startAutoRefresh(()=>({load:(s:AbortSignal)=>{signal=s;return pending.promise},apply}));await vi.advanceTimersByTimeAsync(30000);stop();expect(signal?.aborted).toBe(true);pending.resolve('old club');await vi.advanceTimersByTimeAsync(30000);expect(apply).not.toHaveBeenCalled()});
 it('coalesces live changes, keeps a change arriving during a read, and resumes after editing',async()=>{
  let editing=true;const first=deferred<string>(),load=vi.fn().mockImplementationOnce(()=>first.promise).mockResolvedValue('latest'),apply=vi.fn();
  const stop=startAutoRefresh(()=>({load,apply,canRefresh:()=>!editing}));
  for(let n=0;n<30;n++)win.dispatchEvent(new Event(CLUB_DATA_CHANGED));
  await vi.advanceTimersByTimeAsync(2000);expect(load).not.toHaveBeenCalled();editing=false;
  await vi.advanceTimersByTimeAsync(1000);expect(load).toHaveBeenCalledOnce();
  win.dispatchEvent(new Event(CLUB_DATA_CHANGED));first.resolve('first');await vi.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledTimes(2);expect(apply).toHaveBeenLastCalledWith('latest');stop();
 });

});
