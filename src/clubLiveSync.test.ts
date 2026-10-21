import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {startAutoRefresh} from './useAutoRefresh';
import {CLUB_DATA_CHANGED,FALLBACK_REFRESH_MS,LIVE_BACKUP_MS,dataRefreshInterval,startClubLiveSync} from './clubLiveSync';
let stop:(()=>void)|undefined;
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}))});
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();vi.unstubAllGlobals()});
function fixture(ready=true){let change=()=>{},status=(_s:string)=>{};const channel={on:vi.fn((_kind,_filter,fn)=>{change=fn;return channel}),subscribe:vi.fn(fn=>{status=fn;return channel})};const client={rpc:vi.fn(async()=>({data:ready,error:null})),channel:vi.fn(()=>channel),removeChannel:vi.fn(async()=>{})};return {client:client as unknown as SupabaseClient,raw:client,channel,change:()=>change(),status:(s:string)=>status(s)}}
it('uses one club-filtered channel, 10-minute backup, debounced batches and 30s fallback on disconnect',async()=>{
 const f=fixture(),notify=vi.fn();window.addEventListener(CLUB_DATA_CHANGED,notify);stop=startClubLiveSync(f.client,'club-a');await vi.advanceTimersByTimeAsync(0);
 expect(f.channel.on).toHaveBeenCalledWith('postgres_changes',expect.objectContaining({filter:'club_id=eq.club-a',table:'club_live_changes'}),expect.any(Function));
 f.status('SUBSCRIBED');expect(dataRefreshInterval()).toBe(LIVE_BACKUP_MS);await vi.advanceTimersByTimeAsync(500);notify.mockClear();
 for(let n=0;n<30;n++)f.change();await vi.advanceTimersByTimeAsync(500);expect(notify).toHaveBeenCalledOnce();
 f.status('CHANNEL_ERROR');expect(dataRefreshInterval()).toBe(FALLBACK_REFRESH_MS);stop();stop=undefined;expect(f.raw.removeChannel).toHaveBeenCalledOnce();
});
it('falls back safely before migration and ignores late readiness after switching club',async()=>{
 const f=fixture(false);stop=startClubLiveSync(f.client,'club-a');await vi.advanceTimersByTimeAsync(0);expect(f.raw.channel).not.toHaveBeenCalled();expect(dataRefreshInterval()).toBe(30_000);stop();
 const pending=fixture();stop=startClubLiveSync(pending.client,'club-a');stop();await vi.advanceTimersByTimeAsync(0);expect(pending.raw.channel).not.toHaveBeenCalled();
});

it('uses no repeated full polling while subscribed, reads at ten minutes and falls back at 30 seconds',async()=>{
 vi.stubGlobal('navigator',{onLine:true});const f=fixture();stop=startClubLiveSync(f.client,'club-a');await vi.advanceTimersByTimeAsync(0);f.status('SUBSCRIBED');
 const load=vi.fn(async()=>1),apply=vi.fn(),end=startAutoRefresh(()=>({load,apply}));
 await vi.advanceTimersByTimeAsync(2000);expect(load).toHaveBeenCalledOnce();const baseline=load.mock.calls.length;
 await vi.advanceTimersByTimeAsync(598000);expect(load).toHaveBeenCalledTimes(baseline);
 await vi.advanceTimersByTimeAsync(1000);expect(load).toHaveBeenCalledTimes(baseline+1);
 f.status('CHANNEL_ERROR');await vi.advanceTimersByTimeAsync(2000);const fallback=load.mock.calls.length;
 await vi.advanceTimersByTimeAsync(30000);expect(load).toHaveBeenCalledTimes(fallback+1);end();
});
