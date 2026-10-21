/** Stable atlas ordering: 8 columns × 5 rows. Never reorder persisted IDs. */
export const trainingIcons=[
 ['running','Běh'],['medal','Medaile'],['fencing','Šerm'],['stopwatch','Stopky'],['swimming','Plavání'],['dumbbell','Činka'],['archery','Lukostřelba'],['wrestling','Zápas'],
 ['nutrition','Sportovní výživa'],['bench-press','Bench press'],['cycling','Cyklistika'],['hurdles','Překážkový běh'],['throwing','Hod'],['tennis','Tenis'],['rowing-pair','Párové veslování'],['football','Fotbal'],
 ['high-jump','Skok do výšky'],['hurdle-jump','Skok přes překážku'],['shot-put','Vrh koulí'],['track','Atletická dráha'],['pool','Bazén'],['stadium','Stadion'],['martial-arts','Bojová umění'],['weightlifting','Vzpírání'],
 ['skipping','Švihadlo'],['road-cycling','Silniční cyklistika'],['diving','Skoky do vody'],['rowing','Veslování'],['gym-bag','Sportovní taška'],['whistle','Píšťalka'],['rugby','Ragby'],['water-polo','Vodní pólo'],
 ['gymnastics','Gymnastika'],['bench','Posilovací lavice'],['golf','Golf'],['table-tennis','Stolní tenis'],['steeplechase','Steeplechase'],['hiking','Turistika'],['podium','Stupně vítězů'],['equestrian','Jezdectví'],
] as const;
export type TrainingIconId=typeof trainingIcons[number][0];
export type TrainingIconChoice=TrainingIconId|'none'|null;
export function isTrainingIcon(value:unknown):value is TrainingIconId{return trainingIcons.some(([id])=>id===value)}
export function validateTrainingIcon(value:unknown):TrainingIconChoice{
 if(value==null||value==='')return null;
 if(value==='none'||isTrainingIcon(value))return value;
 throw new Error('Vyberte platnou sportovní ikonu.');
}
export function suggestedTrainingIcon(type:string):TrainingIconId{
 const t=type.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs');
 if(/stolni tenis|ping.?pong/.test(t))return 'table-tennis';
 if(/vodni polo/.test(t))return 'water-polo';
 if(/skok.*vod|potap/.test(t))return 'diving';
 if(/plav|swim|bazen/.test(t))return 'swimming';
 if(/cykl|kolo|bike|spinning/.test(t))return 'cycling';
 if(/ocr|prekaz|steeple/.test(t))return 'hurdles';
 if(/beh|run|sprint|trail|atlet/.test(t))return 'running';
 if(/mobil|gymnast|joga|yoga|pilates|stretch/.test(t))return 'gymnastics';
 if(/judo|zapas|wrest/.test(t))return 'wrestling';
 if(/karate|kick|box|boj|taekwondo/.test(t))return 'martial-arts';
 if(/veslo|rowing/.test(t))return 'rowing';
 if(/tenis|tennis/.test(t))return 'tennis';
 if(/fotbal|football/.test(t))return 'football';
 if(/ragby|rugby/.test(t))return 'rugby';
 if(/golf/.test(t))return 'golf';
 if(/turist|hiking|chuze/.test(t))return 'hiking';
 if(/jezdec|kone|equestrian/.test(t))return 'equestrian';
 if(/lukostrel|archery/.test(t))return 'archery';
 if(/serm|fenc/.test(t))return 'fencing';
 if(/svihad|skipping/.test(t))return 'skipping';
 if(/vzp|weightlift/.test(t))return 'weightlifting';
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
 const {error}=await client.from('events').select('training_icon').eq('club_id',clubId).limit(1);
 if(error)throw new Error(['42703','PGRST204'].includes(error.code)?'Pro uložení sportovní ikony nejdříve nahrajte migraci 046 v Supabase.':'Sportovní ikonu nelze ověřit. Zkontrolujte připojení.');
}
