import type {ParticipationRow} from './clubData';

export type AttendanceChoice='present'|'excused'|'absent';
export type AttendanceUpdate={eventId:string;memberId:string;attended:boolean;attendance_excused:boolean};
export type SaveAttendance=(updates:AttendanceUpdate[])=>Promise<boolean>;

export function reviewChoice(row:ParticipationRow|undefined):AttendanceChoice{
 if(row?.attendance_excused)return 'excused';
 if(row?.attended!=null)return row.attended?'present':'absent';
 if((row?.response==='yes'&&row.seat_status!=='waiting')||row?.response==='companion')return 'present';
 return 'absent';
}
export function attendanceUpdate(eventId:string,memberId:string,choice:AttendanceChoice):AttendanceUpdate{
 return {eventId,memberId,attended:choice==='present',attendance_excused:choice==='excused'};
}
export function reviewUpdates(eventId:string,memberIds:string[],rows:ParticipationRow[],drafts:Record<string,AttendanceChoice>):AttendanceUpdate[]{
 const existing=new Map(rows.filter(p=>p.event_id===eventId).map(p=>[p.member_id,p]));
 return memberIds.flatMap(id=>{
  const row=existing.get(id);
  if(row?.attended!=null&&!drafts[id])return [];
  return [attendanceUpdate(eventId,id,drafts[id]||reviewChoice(row))];
 });
}
