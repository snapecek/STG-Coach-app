import {describe,it,expect,vi} from 'vitest';
import {trainingIcons,suggestedTrainingIcon,resolveTrainingIcon,trainingIconFields,validateTrainingIcon,requireTrainingIconMigration,requireSelectedSportIconMigration} from './trainingIcons';
import {buildEventRows} from './clubData';
import type {SupabaseClient} from '@supabase/supabase-js';
describe('Ikony tréninků',()=>{
 it.each([['Běh','running'],['Silniční běh','running'],['Plavání','swimming'],['Kolo','cycling'],['Kondice','dumbbell'],['Síla','dumbbell'],['Mobilita','gymnastics'],['Judo','wrestling'],['OCR','ocr'],['OCR - Beast','ocr'],['Trail','trail'],['Horský běh','trail'],['Překážkový běh','hurdles'],['Stolní tenis','table-tennis'],['Turistika','hiking'],['Jiný závod','podium'],['Regenerace','dumbbell']])('přiřadí %s odpovídající sport', (type,id)=>expect(suggestedTrainingIcon(type)).toBe(id));
 it('upřednostní výběr trenéra, respektuje vypnutí a bezpečně zobrazí stará data',()=>{
  expect(resolveTrainingIcon({type:'Běh',training_icon:'stopwatch'})).toBe('stopwatch');
  expect(resolveTrainingIcon({type:'Běh',training_icon:'none'})).toBeNull();
  expect(resolveTrainingIcon({type:'Běh',training_icon:'unknown'})).toBe('running');
  expect(resolveTrainingIcon({type:'Plavání'})).toBe('swimming');
 });
 it('odmítne neznámou ikonu před zápisem; zachová rozlišení vynechat/resetovat',()=>{
  expect(()=>validateTrainingIcon('<svg>')).toThrow();expect(trainingIconFields(undefined)).toEqual({});expect(trainingIconFields(null)).toEqual({training_icon:null});expect(trainingIcons).toHaveLength(42);expect(new Set(trainingIcons.map(([id])=>id)).size).toBe(42);
 });
 it('událost si zachová kopii ikony po změně šablony',()=>{
  const t={id:'t',club_id:'c',name:'Trénink',type:'Běh',place:'Park',minutes:60,plan:'',training_icon:'stopwatch' as const};
  const rows=buildEventRows('c',t,'2026-10-21','18:00',2);Object.assign(t,{training_icon:'hurdles'});expect(rows.every(e=>e.training_icon==='stopwatch')).toBe(true);
 });
 it('před starou RPC zabrání tichému zahození vybrané ikony',async()=>{
  const eq=vi.fn(()=>({limit:vi.fn(async()=>({error:{code:'42703'}}))}));const client={from:vi.fn(()=>({select:vi.fn(()=>({eq}))}))} as unknown as SupabaseClient;
  await expect(requireTrainingIconMigration(client,'c','swimming')).rejects.toThrow('046');expect(eq).toHaveBeenCalledWith('club_id','c');
 });
});

it('vybrané OCR a trail ikony jsou samostatné volby a vyžadují migraci 048',async()=>{
 expect(trainingIcons.slice(-2).map(([id])=>id)).toEqual(['ocr','trail']);
 expect(validateTrainingIcon('ocr')).toBe('ocr');expect(validateTrainingIcon('trail')).toBe('trail');
 const client={rpc:vi.fn(async()=>({data:null,error:{code:'PGRST202'}}))} as unknown as SupabaseClient;
 await expect(requireSelectedSportIconMigration(client,'ocr')).rejects.toThrow('048');
 await expect(requireSelectedSportIconMigration(client,'trail')).rejects.toThrow('048');
});
