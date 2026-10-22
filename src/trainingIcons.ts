/** First 40 IDs keep the original atlas order; additional icons have separate masks. */
export const atlasTrainingIcons=[
 ['running','Běh'],['medal','Medaile'],['fencing','Šerm'],['stopwatch','Stopky'],['swimming','Plavání'],['dumbbell','Činka'],['archery','Lukostřelba'],['wrestling','Zápas'],
 ['nutrition','Sportovní výživa'],['bench-press','Bench press'],['cycling','Cyklistika'],['hurdles','Překážkový běh'],['throwing','Hod'],['tennis','Tenis'],['rowing-pair','Párové veslování'],['football','Fotbal'],
 ['high-jump','Skok do výšky'],['hurdle-jump','Skok přes překážku'],['shot-put','Vrh koulí'],['track','Atletická dráha'],['pool','Bazén'],['stadium','Stadion'],['martial-arts','Bojová umění'],['weightlifting','Vzpírání'],
 ['skipping','Švihadlo'],['road-cycling','Silniční cyklistika'],['diving','Skoky do vody'],['rowing','Veslování'],['gym-bag','Sportovní taška'],['whistle','Píšťalka'],['rugby','Ragby'],['water-polo','Vodní pólo'],
 ['gymnastics','Gymnastika'],['bench','Posilovací lavice'],['golf','Golf'],['table-tennis','Stolní tenis'],['steeplechase','Steeplechase'],['hiking','Turistika'],['podium','Stupně vítězů'],['equestrian','Jezdectví'],
] as const;
/** Retired choices remain only as atlas coordinates, never selectable/rendered. */
export const retiredTrainingIcons=['medal','fencing','archery','nutrition','hurdles','throwing','rowing-pair','high-jump','shot-put','pool','stadium','weightlifting','diving','gym-bag','whistle','gymnastics','bench','golf','steeplechase','podium'] as const;
const retired=new Set<string>(retiredTrainingIcons);
const activeAtlasIcons=atlasTrainingIcons.filter((icon):icon is Exclude<typeof atlasTrainingIcons[number],readonly [typeof retiredTrainingIcons[number],string]>=>!retired.has(icon[0]));
export const trainingIcons=[...activeAtlasIcons,['ocr','OCR – ručkování'],['trail','Trail – běh do kopce'],['triathlon','Triatlon']] as const;
export const normalizeTrainingIcon=(value:unknown)=>value==='none'||isTrainingIcon(value)?value:null;
export type TrainingIconId=typeof trainingIcons[number][0];
export type TrainingIconChoice=TrainingIconId|'none'|null;
export function isTrainingIcon(value:unknown):value is TrainingIconId{return trainingIcons.some(([id])=>id===value)}
export function validateTrainingIcon(value:unknown):TrainingIconChoice{
 if(value==null||value===''||typeof value==='string'&&retired.has(value))return null;
 if(value==='none'||isTrainingIcon(value))return value;
 throw new Error('Vyberte platnou sportovní ikonu.');
}
export function suggestedTrainingIcon(type:string):TrainingIconId{
 const t=type.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs');
 if(/triatlon|triathlon|iron[ -]?man/.test(t))return 'triathlon';
 if(/stolni tenis|ping.?pong/.test(t))return 'table-tennis';
 if(/vodni polo/.test(t))return 'water-polo';
 if(/skok.*vod|potap/.test(t))return 'swimming';
 if(/plav|swim|bazen/.test(t))return 'swimming';
 if(/cykl|kolo|bike|spinning/.test(t))return 'cycling';
 if(/\bocr\b|obstacle/.test(t))return 'ocr';
 if(/trail|terenni beh|horsky beh/.test(t))return 'trail';
 if(/prekaz|steeple/.test(t))return 'hurdle-jump';
 if(/beh|run|sprint|trail|atlet/.test(t))return 'running';
 if(/mobil|gymnast|joga|yoga|pilates|stretch/.test(t))return 'dumbbell';
 if(/judo|zapas|wrest/.test(t))return 'wrestling';
 if(/karate|kick|box|boj|taekwondo/.test(t))return 'martial-arts';
 if(/veslo|rowing/.test(t))return 'rowing';
 if(/tenis|tennis/.test(t))return 'tennis';
 if(/fotbal|football/.test(t))return 'football';
 if(/ragby|rugby/.test(t))return 'rugby';
 if(/golf/.test(t))return 'dumbbell';
 if(/turist|hiking|chuze/.test(t))return 'hiking';
 if(/jezdec|kone|equestrian/.test(t))return 'equestrian';
 if(/lukostrel|archery/.test(t))return 'dumbbell';
 if(/serm|fenc/.test(t))return 'dumbbell';
 if(/svihad|skipping/.test(t))return 'skipping';
 if(/vzp|weightlift/.test(t))return 'dumbbell';
 if(/zavod|\brace\b/.test(t))return 'stopwatch';
 return 'dumbbell';
}
export function resolveTrainingIcon(source:{type:string;training_icon?:string|null}):TrainingIconId|null{
 if(source.training_icon==='none')return null;
 return isTrainingIcon(source.training_icon)?source.training_icon:suggestedTrainingIcon(source.type);
}
/** Omit the new field for older callers; an explicit null resets to automatic. */
export function trainingIconFields(value:unknown){return value===undefined?{}:{training_icon:validateTrainingIcon(value)}}

export async function requireTrainingIconMigration(client:import('@supabase/supabase-js').SupabaseClient,clubId:string,icon:TrainingIconChoice|undefined){
 if(icon==null)return;
 await requireSelectedSportIconMigration(client,icon);
 const {error}=await client.from('events').select('training_icon').eq('club_id',clubId).limit(1);
 if(error)throw new Error(['42703','PGRST204'].includes(error.code)?'Pro uložení sportovní ikony nejdříve nahrajte migraci 046 v Supabase.':'Sportovní ikonu nelze ověřit. Zkontrolujte připojení.');
}

/** Migration 046 deliberately clears race icons. Check 047 before any custom
 * race choice so an older database cannot report success while losing it. */
export async function requireRaceIconMigration(client:import('@supabase/supabase-js').SupabaseClient,icon:TrainingIconChoice|undefined){
 if(icon==null)return;
 await requireSelectedSportIconMigration(client,icon);
 const {data,error}=await client.rpc('race_icons_ready');
 if(error&&!['PGRST202','42883'].includes(error.code))throw new Error('Ikonu závodu nelze ověřit. Zkontrolujte připojení a zkuste to znovu.');
 if(error||data!==true)throw new Error('Pro uložení ikony závodu nejdříve nahrajte migraci 047 v Supabase.');
}

/** New choices need the extended whitelist; automatic rendering needs no write. */
export async function requireSelectedSportIconMigration(client:import('@supabase/supabase-js').SupabaseClient,icon:TrainingIconChoice|undefined){
 if(icon==='triathlon'){
  const {data,error}=await client.rpc('triathlon_icons_ready');
  if(error&&!['PGRST202','42883'].includes(error.code))throw new Error('Ikonu nelze ověřit. Zkontrolujte připojení a zkuste to znovu.');
  if(error||data!==true)throw new Error('Pro uložení ikony triatlonu nejdříve nahrajte migraci 050 v Supabase.');
  return;
 }
 if(icon!=='ocr'&&icon!=='trail')return;
 const {data,error}=await client.rpc('special_sport_icons_ready');
 if(error&&!['PGRST202','42883'].includes(error.code))throw new Error('Ikonu nelze ověřit. Zkontrolujte připojení a zkuste to znovu.');
 if(error||data!==true)throw new Error('Pro uložení ikony OCR nebo trailu nejdříve nahrajte migraci 048 v Supabase.');
}
