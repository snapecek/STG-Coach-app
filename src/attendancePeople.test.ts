import {expect,it} from 'vitest';
import {attendanceSections,sortAttendancePeople,attendancePages} from './attendancePeople';

it('řadí nejprve členy a potom hosty podle příjmení s českou abecedou',()=>{
 const people=[{name:'Adam Žák',kind:'member' as const},{name:'Zdeněk Černý',kind:'member' as const},{name:'Boris Adam',kind:'guest' as const},{name:'Anna Nováková',kind:'member' as const},{name:'Zuzana Bílá',kind:'guest' as const},{name:'Petr Cibulka',kind:'member' as const},{name:'Igor Hrubý',kind:'member' as const},{name:'Jan Chytrý',kind:'member' as const}];
 const sorted=sortAttendancePeople(people);
 expect(sorted.map(p=>p.name)).toEqual(['Petr Cibulka','Zdeněk Černý','Igor Hrubý','Jan Chytrý','Anna Nováková','Adam Žák','Boris Adam','Zuzana Bílá']);
 expect(people[0].name).toBe('Adam Žák');
 expect(attendanceSections(sorted).map(s=>[s.label,s.people.length])).toEqual([['Členové',6],['Hosté',2]]);
});
it('stejná příjmení rozliší jménem a zvládne jedno jméno i nadbytečné mezery',()=>{
 expect(sortAttendancePeople([{name:'  Petr   Novák  ',kind:'member'},{name:'Host',kind:'guest'},{name:'Adam Novák',kind:'member'}]).map(p=>p.name)).toEqual(['Adam Novák','  Petr   Novák  ','Host']);
 expect(attendanceSections([])).toEqual([]);
 expect(attendanceSections([{kind:'guest'}]).map(s=>s.label)).toEqual(['Hosté']);
});

it('hosté zůstanou na první stránce i při více než deseti členech; každý oddíl stránkuje nezávisle',()=>{
 const people=[...Array.from({length:16},(_,i)=>({id:'m'+i,kind:'member' as const})),...Array.from({length:12},(_,i)=>({id:'g'+i,kind:'guest' as const}))];
 const first=attendancePages(people,{member:0,guest:0});expect(first.map(s=>[s.kind,s.people.length,s.total])).toEqual([['member',10,16],['guest',10,12]]);
 const nextMembers=attendancePages(people,{member:1,guest:0});expect(nextMembers[0].people.map(p=>p.id)).toEqual(['m10','m11','m12','m13','m14','m15']);expect(nextMembers[1]).toEqual(first[1]);
 const nextGuests=attendancePages(people,{member:0,guest:1});expect(nextGuests[0]).toEqual(first[0]);expect(nextGuests[1].people.map(p=>p.id)).toEqual(['g10','g11']);
 expect(attendancePages(people.slice(0,2),{member:8,guest:8})[0].page).toBe(0);expect(attendancePages([],{member:0,guest:0})).toEqual([]);
});
