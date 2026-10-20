import {describe,it,expect} from 'vitest';
import type {ParticipationRow} from './clubData';
import {reviewChoice,reviewUpdates} from './attendanceReview';
const row=(member_id:string,patch:Partial<ParticipationRow>={}):ParticipationRow=>({club_id:'club',event_id:'event',member_id,response:null,attended:null,confirmed_by:null,...patch});
describe('batch attendance verification',()=>{
 it('uses RSVP as a suggestion, with no/maybe/unknown/waitlisted all absent',()=>{
  expect(reviewChoice(row('yes',{response:'yes'}))).toBe('present');
  for(const response of ['no','maybe',null] as const)expect(reviewChoice(row('member',{response}))).toBe('absent');
  expect(reviewChoice(row('waiting',{response:'yes',seat_status:'waiting'}))).toBe('absent');
  expect(reviewChoice(undefined)).toBe('absent');
 });
 it('approves a whole roster, including unanswered members, without changing existing verified decisions',()=>{
  const rows=[row('yes',{response:'yes'}),row('no',{response:'no'}),row('excused',{attended:false,attendance_excused:true,response:'yes'}),row('already',{attended:true,response:'no'}),row('outside',{response:'yes'})];
  const result=reviewUpdates('event',['yes','no','unknown','excused','already'],rows,{});
  expect(result).toEqual([{eventId:'event',memberId:'yes',attended:true,attendance_excused:false},{eventId:'event',memberId:'no',attended:false,attendance_excused:false},{eventId:'event',memberId:'unknown',attended:false,attendance_excused:false}]);
  expect(rows[0].attended).toBeNull();
 });
 it('applies only explicit corrections to verified rows and isolates other events and removed roster entries',()=>{
  const result=reviewUpdates('event',['a','b'],[row('a',{attended:true}),row('b',{event_id:'other',attended:true})],{a:'excused',outside:'present'});
  expect(result).toEqual([{eventId:'event',memberId:'a',attended:false,attendance_excused:true},{eventId:'event',memberId:'b',attended:false,attendance_excused:false}]);
 });
});
