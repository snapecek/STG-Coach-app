import {expect,it} from 'vitest';
import {attendanceSections,sortAttendancePeople} from './attendancePeople';

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
