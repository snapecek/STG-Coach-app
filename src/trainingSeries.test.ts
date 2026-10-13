import {describe,it,expect} from 'vitest';
import type {EventRow} from './clubData';
import {futureSeriesEvents,seriesPreview} from './trainingSeries';
const base={id:'a',series_id:'series',event_kind:'training',starts_at:'2026-10-21T16:00:00Z',status:'scheduled',completed_at:null} as EventRow;
const now=Date.parse('2026-10-13T12:00:00Z');
describe('Náhled série',()=>{
 it('vybere pouze budoucí plánované termíny stejné série',()=>{const rows=[base,{...base,id:'past',starts_at:'2026-10-01T12:00:00Z'},{...base,id:'other',series_id:'other'},{...base,id:'cancel',status:'cancelled' as const},{...base,id:'done',completed_at:'2026-10-13T12:00:00Z'}];expect(futureSeriesEvents(rows,'series','reschedule',now).map(e=>e.id)).toEqual(['a']);expect(futureSeriesEvents(rows,'series','restore',now).map(e=>e.id)).toEqual(['cancel'])});
 it('zachová místní čas a týdenní rozestup přes podzimní DST',()=>{const rows=[base,{...base,id:'b',starts_at:'2026-10-28T17:00:00Z'}];expect(seriesPreview(rows,'reschedule','2026-10-22','19:30',now).map(c=>c.starts_at)).toEqual(['2026-10-22T17:30:00.000Z','2026-10-29T18:30:00.000Z'])});
 it('nevyrobí neexistující jarní čas pro pozdější termín',()=>{const rows=[{...base,starts_at:'2026-03-22T01:00:00Z'},{...base,id:'b',starts_at:'2026-03-29T01:00:00Z'}];expect(()=>seriesPreview(rows,'reschedule','2026-03-22','02:30',Date.parse('2026-03-01'))).toThrow('neexistuje')});
 it('odmítne přesun do minulosti před zápisem',()=>expect(()=>seriesPreview([base],'reschedule','2026-10-01','18:00',now)).toThrow());
 it('zrušení nese původní stav a čas pro kontrolu konfliktu, nepřesouvá datum',()=>expect(seriesPreview([base],'cancel','','',now)).toEqual([{id:'a',expected_starts_at:base.starts_at,expected_status:'scheduled'}]));
});
