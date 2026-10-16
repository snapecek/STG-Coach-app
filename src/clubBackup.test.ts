import {describe,it,expect} from 'vitest';
import {crc32,makeBackupZip,clubBackupFilename} from './clubBackup';
describe('portable club ZIP backups',()=>{
 it('names backups after the club and snapshot creation date in Prague',()=>{
  expect(clubBackupFilename('STG Karviná','2026-10-16T23:30:00Z')).toBe('STG_Karviná_backup_2026_10_17.zip');
  expect(clubBackupFilename('Klub / OCR: tým','2026-10-16T12:00:00Z')).toBe('Klub_OCR_tým_backup_2026_10_16.zip');
  expect(clubBackupFilename('OCR - tým–Karviná','2026-10-16T12:00:00Z')).toBe('OCR_tým_Karviná_backup_2026_10_16.zip');
 });
 it('uses standard CRC32 and preserves UTF-8 names and exact file contents',async()=>{const data=new TextEncoder().encode('123456789');expect(crc32(data)).toBe(0xcbf43926);const zip=new Uint8Array(await makeBackupZip([{name:'data.json',data},{name:'files/žluťoučký.png',data:new Uint8Array([0,255,13,10])}]).arrayBuffer());const view=new DataView(zip.buffer);expect(view.getUint32(0,true)).toBe(0x04034b50);expect(view.getUint32(14,true)).toBe(0xcbf43926);expect(new TextDecoder().decode(zip.slice(30,39))).toBe('data.json');expect([...zip.slice(39,48)]).toEqual([...data]);expect(view.getUint32(zip.length-22,true)).toBe(0x06054b50);expect(view.getUint16(zip.length-12,true)).toBe(2)});
 it('rejects paths which could escape the backup directory on extraction',()=>{for(const name of ['../secret','files/../../secret','/absolute','files\\secret',''])expect(()=>makeBackupZip([{name,data:new Uint8Array()}])).toThrow()});
});
