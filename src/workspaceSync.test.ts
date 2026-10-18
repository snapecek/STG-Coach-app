import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {emptyClubData,type EventRow} from './clubData';
import {applyWorkspaceChanges,readWorkspaceChanges,type WorkspaceDelta} from './workspaceSync';
const club='club-a';
const event=(id:string,date:string)=>({id,club_id:club,name:id,starts_at:date}) as EventRow;
describe('incremental workspace synchronization',()=>{
 it('merges updates, inserts and deletes without dropping untouched history or duplicating a replay',()=>{
  const previous={...emptyClubData(),events:[event('old','2020-01-01'),event('remove','2021-01-01'),event('update','2022-01-01')]};
  const delta:WorkspaceDelta={cursor:'123456789012345678',reset:false,changes:[{kind:'events',key:'remove',row:null},{kind:'events',key:'update',row:{...event('update','2024-01-01'),name:'Changed'}},{kind:'events',key:'new',row:event('new','2023-01-01')}]};
  const next=applyWorkspaceChanges(previous,delta,club);
  expect(next.events.map(e=>e.id)).toEqual(['old','new','update']);expect(next.events[2].name).toBe('Changed');
  expect(applyWorkspaceChanges(next,delta,club)).toEqual(next);expect(previous.events.map(e=>e.id)).toEqual(['old','remove','update']);
  expect(next.workspaceCursor).toBe(delta.cursor); // cursor is text, never a lossy JS number
 });
 it('handles composite RSVP identities and color deletion',()=>{
  const data={...emptyClubData(),participation:[{club_id:club,event_id:'e',member_id:'m',response:null,attended:null,confirmed_by:null}],eventTypeColors:[{id:'color',club_id:club,event_kind:'training' as const,type_key:'běh',color:'#FFB317'}]};
  const next=applyWorkspaceChanges(data,{cursor:'2',reset:false,changes:[{kind:'participation',key:'e:m',row:{...data.participation[0],response:'yes'}},{kind:'event_type_colors',key:'color',row:null}]},club);
  expect(next.participation).toHaveLength(1);expect(next.participation[0].response).toBe('yes');expect(next.eventTypeColors).toEqual([]);
 });
 it('rejects foreign-club and mismatched identities rather than merging them',()=>{
  for(const row of [{...event('e','2024'),club_id:'other'},event('other-id','2024')])expect(()=>applyWorkspaceChanges(emptyClubData(),{cursor:'2',reset:false,changes:[{kind:'events',key:'e',row}]},club)).toThrow('Neplatný záznam');
  expect(()=>applyWorkspaceChanges(emptyClubData(),{cursor:'2',reset:true,changes:[]},club)).toThrow('úplné');
 });
 it('falls back only for a missing migration; access and connectivity errors remain failures',async()=>{
  const rpc=vi.fn();const client={rpc} as unknown as SupabaseClient;
  for(const code of ['PGRST202','42883']){rpc.mockResolvedValue({data:null,error:{code}});expect(await readWorkspaceChanges(client,club,null)).toBeNull()}
  rpc.mockResolvedValue({data:null,error:{code:'42501'}});await expect(readWorkspaceChanges(client,club,'1')).rejects.toThrow('oprávnění');
  rpc.mockResolvedValue({data:{cursor:2,changes:[]},error:null});await expect(readWorkspaceChanges(client,club,'1')).rejects.toThrow('Neplatná');
 });
});
