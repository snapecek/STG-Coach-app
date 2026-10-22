import {describe,it,expect,vi} from 'vitest';
import {trainingIcons,suggestedTrainingIcon,resolveTrainingIcon,trainingIconFields,validateTrainingIcon,requireTrainingIconMigration,requireSelectedSportIconMigration,atlasTrainingIcons,retiredTrainingIcons} from './trainingIcons';
import {buildEventRows} from './clubData';
import type {SupabaseClient} from '@supabase/supabase-js';
describe('Ikony tréninků',()=>{
 it.each([['Běh','running'],['Silniční běh','running'],['Plavání','swimming'],['Kolo','cycling'],['Kondice','dumbbell'],['Síla','dumbbell'],['Mobilita','dumbbell'],['Judo','wrestling'],['OCR','ocr'],['OCR - Beast','ocr'],['Trail','trail'],['Horský běh','trail'],['Překážkový běh','hurdle-jump'],['Stolní tenis','table-tennis'],['Turistika','hiking'],['Jiný závod','stopwatch'],['Regenerace','dumbbell']])('přiřadí %s odpovídající sport', (type,id)=>expect(suggestedTrainingIcon(type)).toBe(id));
 it('upřednostní výběr trenéra, respektuje vypnutí a bezpečně zobrazí stará data',()=>{
  expect(resolveTrainingIcon({type:'Běh',training_icon:'stopwatch'})).toBe('stopwatch');
  expect(resolveTrainingIcon({type:'Běh',training_icon:'none'})).toBeNull();
  expect(resolveTrainingIcon({type:'Běh',training_icon:'unknown'})).toBe('running');
  expect(resolveTrainingIcon({type:'Plavání'})).toBe('swimming');
 });
 it('odmítne neznámou ikonu před zápisem; zachová rozlišení vynechat/resetovat',()=>{
  expect(()=>validateTrainingIcon('<svg>')).toThrow();expect(trainingIconFields(undefined)).toEqual({});expect(trainingIconFields(null)).toEqual({training_icon:null});expect(trainingIcons).toHaveLength(26);expect(new Set(trainingIcons.map(([id])=>id)).size).toBe(26);
 });
 it('událost si zachová kopii ikony po změně šablony',()=>{
  const t={id:'t',club_id:'c',name:'Trénink',type:'Běh',place:'Park',minutes:60,plan:'',training_icon:'stopwatch' as const};
  const rows=buildEventRows('c',t,'2026-10-21','18:00',2);Object.assign(t,{training_icon:'hurdle-jump'});expect(rows.every(e=>e.training_icon==='stopwatch')).toBe(true);
 });
 it('před starou RPC zabrání tichému zahození vybrané ikony',async()=>{
  const eq=vi.fn(()=>({limit:vi.fn(async()=>({error:{code:'42703'}}))}));const client={from:vi.fn(()=>({select:vi.fn(()=>({eq}))}))} as unknown as SupabaseClient;
  await expect(requireTrainingIconMigration(client,'c','swimming')).rejects.toThrow('046');expect(eq).toHaveBeenCalledWith('club_id','c');
 });
});

it('vybrané OCR a trail ikony jsou samostatné volby a vyžadují migraci 048',async()=>{
 expect(trainingIcons.filter(([id])=>id==='ocr'||id==='trail').map(([id])=>id)).toEqual(['ocr','trail']);
 expect(validateTrainingIcon('ocr')).toBe('ocr');expect(validateTrainingIcon('trail')).toBe('trail');
 const client={rpc:vi.fn(async()=>({data:null,error:{code:'PGRST202'}}))} as unknown as SupabaseClient;
 await expect(requireSelectedSportIconMigration(client,'ocr')).rejects.toThrow('048');
 await expect(requireSelectedSportIconMigration(client,'trail')).rejects.toThrow('048');
});

it('keeps original atlas coordinates while removing exactly the 20 highlighted choices',()=>{
 expect(retiredTrainingIcons).toHaveLength(20);expect(atlasTrainingIcons).toHaveLength(40);
 expect(atlasTrainingIcons.findIndex(([id])=>id==='swimming')).toBe(4);
 expect(atlasTrainingIcons.findIndex(([id])=>id==='equestrian')).toBe(39);
 for(const id of retiredTrainingIcons){expect(trainingIcons.some(([active])=>String(active)===id)).toBe(false);expect(validateTrainingIcon(id)).toBeNull();expect(resolveTrainingIcon({type:'Běh',training_icon:id})).toBe('running');}
 expect(suggestedTrainingIcon('Překážkový běh')).toBe('hurdle-jump');
 for(const [id] of trainingIcons)expect(resolveTrainingIcon({type:'Jiné',training_icon:id})).toBe(id);
});
it.each(['Triatlon','Triathlon 70.3','IRONMAN','Iron Man','Triatlonový závod'])('recognizes %s and checks migration 050 before persisting the new icon',async type=>{
 expect(suggestedTrainingIcon(type)).toBe('triathlon');expect(validateTrainingIcon('triathlon')).toBe('triathlon');
 const rpc=vi.fn().mockResolvedValueOnce({data:null,error:{code:'PGRST202'}}).mockResolvedValueOnce({data:true,error:null});const client={rpc} as unknown as SupabaseClient;
 await expect(requireSelectedSportIconMigration(client,'triathlon')).rejects.toThrow('050');await expect(requireSelectedSportIconMigration(client,'triathlon')).resolves.toBeUndefined();expect(rpc).toHaveBeenCalledWith('triathlon_icons_ready');
});

it.each(['Běh a cvičení','STG Run & Workout','Cvičení a běh'])('recognizes combined running/workout %s and gates its persistence on migration 051',async type=>{
 expect(suggestedTrainingIcon(type)).toBe('run-workout');expect(validateTrainingIcon('run-workout')).toBe('run-workout');
 const rpc=vi.fn().mockResolvedValueOnce({data:null,error:{code:'PGRST202'}}).mockResolvedValueOnce({data:true,error:null});const client={rpc} as unknown as SupabaseClient;
 await expect(requireSelectedSportIconMigration(client,'run-workout')).rejects.toThrow('051');await expect(requireSelectedSportIconMigration(client,'run-workout')).resolves.toBeUndefined();expect(rpc).toHaveBeenCalledWith('run_workout_icons_ready');
});

it.each([['HIIT v gymu','hiit'],['STG HIIT v hale','hiit'],['Tabata','hiit'],['Kettlebell','kettlebell'],['Kettlbell','kettlebell']])('recognizes %s and gates HIIT/kettlebell persistence on migration 052',async(type,id)=>{
 expect(suggestedTrainingIcon(type)).toBe(id);expect(validateTrainingIcon(id)).toBe(id);
 const rpc=vi.fn().mockResolvedValueOnce({data:null,error:{code:'PGRST202'}}).mockResolvedValueOnce({data:true,error:null});const client={rpc} as unknown as SupabaseClient;
 await expect(requireSelectedSportIconMigration(client,id as 'hiit'|'kettlebell')).rejects.toThrow('052');await expect(requireSelectedSportIconMigration(client,id as 'hiit'|'kettlebell')).resolves.toBeUndefined();expect(rpc).toHaveBeenCalledWith('hiit_kettlebell_icons_ready');
});
