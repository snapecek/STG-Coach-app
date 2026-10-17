// Member records store the full display name; the final word is used as surname.
const names=new Intl.Collator('cs',{sensitivity:'base',numeric:true});
export function compareSurnames(a:{name:string},b:{name:string}){
 const surname=(name:string)=>name.trim().split(/\s+/).at(-1)||'';
 return names.compare(surname(a.name),surname(b.name))||names.compare(a.name.trim(),b.name.trim());
}
export function sortAttendancePeople<T extends {name:string;kind:'member'|'guest'}>(people:T[]):T[]{
 return [...people].sort((a,b)=>Number(a.kind==='guest')-Number(b.kind==='guest')||compareSurnames(a,b));
}
export function attendanceSections<T extends {kind:'member'|'guest'}>(people:T[]){
 return (['member','guest'] as const).map(kind=>({kind,label:kind==='member'?'Členové':'Hosté',people:people.filter(p=>p.kind===kind)})).filter(section=>section.people.length>0);
}
export function attendancePages<T extends {kind:'member'|'guest'}>(people:T[],pages:Record<'member'|'guest',number>){
 return attendanceSections(people).map(section=>{
  const total=section.people.length,page=Math.max(0,Math.min(pages[section.kind],Math.ceil(total/10)-1));
  return {...section,page,total,people:section.people.slice(page*10,page*10+10)};
 });
}
