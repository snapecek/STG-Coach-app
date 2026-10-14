import {it,expect} from 'vitest';
import {validGameScore,rankGame,gameEntryVerified,validateGame,gameScoreLabel,type TrainingGame} from './trainingGames';
import type {ParticipationRow} from './clubData';
const game=(scoring:TrainingGame['scoring']='points'):TrainingGame=>({id:'g',club_id:'c',event_id:'e',name:'Fiktivní výzva',scoring,notes:'',revision:1,entries:[{member_id:'a',status:'scored',score:0},{member_id:'b',status:'scored',score:10},{member_id:'c',status:'scored',score:10},{member_id:'d',status:null,score:null}]});
const attendance:ParticipationRow[]=['a','b','c','d'].map(member_id=>({club_id:'c',event_id:'e',member_id,response:null,attended:true,confirmed_by:null}));
it('body včetně nuly řadí sestupně a shodné výsledky sdílejí pořadí',()=>expect(rankGame(game(),attendance).map(r=>[r.member_id,r.rank])).toEqual([['b',1],['c',1],['a',3],['d',null]]));
it('čas řadí vzestupně a nulový čas odmítá',()=>{const g=game('time');g.entries[0].score=5000;g.entries[1].score=10000;g.entries[2].score=15000;expect(rankGame(g,attendance).map(r=>r.rank)).toEqual([1,2,3,null]);expect(validGameScore('time',0)).toBe(false)});
it('u vzdálenosti a opakování je více lepší, neověřený výsledek do pořadí nepatří',()=>{for(const kind of ['distance','repetitions'] as const){const g=game(kind);const rows=rankGame(g,attendance.map(p=>p.member_id==='b'?{...p,attended:false}:p));expect(rows.find(r=>r.member_id==='b')?.rank).toBeNull();expect(rows.find(r=>r.member_id==='c')?.rank).toBe(1)}});
it('rozlišuje nezapsáno, nulu, DNF a DNS podle skutečné docházky',()=>{const g=game();expect(gameEntryVerified(g,g.entries[0],attendance)).toBe(true);expect(gameEntryVerified(g,g.entries[3],attendance)).toBe(false);expect(gameEntryVerified(g,{member_id:'a',status:'dnf',score:null},attendance)).toBe(true);expect(gameEntryVerified(g,{member_id:'a',status:'dns',score:null},attendance.map(p=>({...p,attended:false,attendance_excused:true})))).toBe(true)});
it('hlídá celočíselné typy, rozsahy, přesnost i záporné body',()=>{expect(validGameScore('points',-5)).toBe(true);expect(validGameScore('repetitions',-1)).toBe(false);expect(validGameScore('repetitions',1.5)).toBe(false);expect(validGameScore('distance',1.001)).toBe(true);expect(validGameScore('distance',1.0001)).toBe(false);expect(validGameScore('time',172800001)).toBe(false);expect(validGameScore('points',Infinity)).toBe(false);expect(validGameScore('points',NaN)).toBe(false)});
it('formátuje jednotky bez ztráty nulové hodnoty',()=>{expect(gameScoreLabel('time',12345)).toBe('00:00:12.345');expect(gameScoreLabel('points',0)).toBe('0 bodů');expect(gameScoreLabel('distance',1.234)).toBe('1,234 m')});
it('vyžaduje název, známý typ a unikátní účastníky do limitu',()=>{validateGame({name:'Fiktivní výzva',scoring:'points',notes:'',member_ids:['a','b']});for(const ids of [[],['a','a'],Array.from({length:101},(_,i)=>String(i))])expect(()=>validateGame({name:'Výzva',scoring:'time',notes:'',member_ids:ids})).toThrow()});

it('team ranking requires every team member and shared zero scores are valid',async()=>{
 const {rankGameTeams}=await import('./trainingGames');const g=game();g.mode='teams';g.entries[0].score=10;
 g.teams=[{id:'one',name:'První',member_ids:['a','b'],status:'scored',score:10},{id:'two',name:'Druhý',member_ids:['c'],status:'scored',score:10}];
 expect(rankGameTeams(g,attendance).map(t=>t.rank)).toEqual([1,1]);
 expect(rankGameTeams(g,attendance.map(p=>p.member_id==='b'?{...p,attended:false}:p)).find(t=>t.id==='one')?.rank).toBeNull();
 g.entries[0].score=0;g.entries[1].score=0;g.teams[0].score=0;
 expect(rankGameTeams(g,attendance).find(t=>t.id==='one')?.rank).toBe(2);
});
it('does not allow a player in two teams',async()=>{const {validateTeamGame}=await import('./trainingGames');expect(()=>validateTeamGame({name:'Štafeta',scoring:'points',notes:'',teams:[{id:'1',name:'A',member_ids:['a'],status:null,score:null},{id:'2',name:'B',member_ids:['a'],status:null,score:null}]})).toThrow();});
