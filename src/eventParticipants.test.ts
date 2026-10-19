import {expect,it} from 'vitest';
import {eventParticipantGroups} from './eventParticipants';

it('groups answers before unanswered people, with Czech surname order and guests retained',()=>{
 const rows=[
  {name:'Adam Žák',response:'yes' as const,kind:'member' as const},
  {name:'Bez Odpovědi',response:null},
  {name:'Petr Novák',response:'no' as const},
  {name:'Alena Bílá',response:'yes' as const,kind:'guest' as const},
  {name:'Jana Černá',response:'maybe' as const},
  {name:'Zdeněk Černý',response:'yes' as const,kind:'member' as const},
 ].map(r=>({...r,seat_status:null}));
 const before=structuredClone(rows);
 expect(eventParticipantGroups(rows,r=>r).map(g=>[g.label,g.people.map(p=>p.name)])).toEqual([
  ['Přijdou',['Zdeněk Černý','Adam Žák','Alena Bílá']],['Možná',['Jana Černá']],['Nepřijdou',['Petr Novák']],['Bez odpovědi',['Bez Odpovědi']],
 ]);
 expect(rows).toEqual(before);
 expect(eventParticipantGroups([{name:'Zatím bez záznamu'}],()=>undefined)[0].key).toBe('unknown');
 expect(eventParticipantGroups([],()=>undefined)).toEqual([]);
});

it('keeps companions and the waiting list distinct from confirmed attendees and regroups changed answers',()=>{
 const rows=[
  {name:'Čekající',response:'yes' as const,seat_status:'waiting' as const},
  {name:'Závodník',response:'yes' as const,seat_status:'confirmed' as const},
  {name:'Doprovod',response:'companion' as const,seat_status:null},
  {name:'Nejede',response:'no' as const,seat_status:null},
 ];
 expect(eventParticipantGroups(rows,r=>r,true).map(g=>[g.label,g.people.length])).toEqual([
  ['Zúčastní se',1],['Doprovod',1],['Čekací listina',1],['Nezúčastní se',1],
 ]);
 const changed=rows.map(r=>({...r,response:'maybe' as const}));
 expect(eventParticipantGroups(changed,r=>r,true).map(g=>[g.label,g.people.length])).toEqual([['Možná',4]]);
});
