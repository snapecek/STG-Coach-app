import {describe,it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseRaceTime,formatRaceTime,rankResults,saveRaceResult,type RaceResult} from './raceResults';
const row=(member_id:string,elapsed_ms:number|null,status:RaceResult['status']='finished'):RaceResult=>({club_id:'club',event_id:'event',member_id,status,elapsed_ms,notes:''});
describe('Výsledky závodů',()=>{
 it('převádí čas bez ztráty milisekund',()=>{expect(parseRaceTime('01:02:03.5')).toBe(3723500);expect(parseRaceTime('00:00:00,001')).toBe(1);expect(formatRaceTime(3723500)).toBe('01:02:03.500')});
 it('odmítá nulové, chybné a nadlimitní časy',()=>{for(const value of ['00:00:00','1:60:00','abc','49:00:00','00:00:01.1234','-1:00:00'])expect(()=>parseRaceTime(value)).toThrow()});
 it('řadí časy, sdílí pořadí a nehodnotí DNF/DNS',()=>{expect(rankResults([row('d',null,'dns'),row('c',2000),row('b',1000),row('a',1000),row('e',null,'dnf')]).map(r=>[r.member_id,r.rank])).toEqual([['a',1],['b',1],['c',3],['e',null],['d',null]])});
 it('zabrání zápisu členskou rolí před voláním API',async()=>{await expect(saveRaceResult({} as SupabaseClient,{id:'club',name:'Club',role:'member'},row('a',1000))).rejects.toThrow('trenér')});
});
