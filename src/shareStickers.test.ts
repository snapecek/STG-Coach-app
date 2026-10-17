import {describe,it,expect} from 'vitest';
import {newShareSticker,safeSticker,stickerKinds} from './shareStickers';
describe('share sticker data',()=>{
 const data={title:'Intervaly',metrics:[{label:'vzdálenost',value:'11,2 km'},{label:'zátěž',value:'RPE 8'}],attendance:{present:14,total:20}};
 it('uses actual attendance and recorded metrics',()=>{expect(newShareSticker('attendance',data).value).toBe('70 %');expect(newShareSticker('team',data).value).toBe('14 / 20');expect(newShareSticker('distance',data).value).toBe('11,2 km');expect(newShareSticker('effort',data).value).toBe('RPE 8')});
 it('does not invent streaks, records or missing values',()=>{expect(newShareSticker('record',data).value).toBe('DOPLŇTE');expect(newShareSticker('streak',data).value).toBe('DOPLŇTE');expect(newShareSticker('attendance',{title:'Test',metrics:[]}).value).toBe('—');expect(newShareSticker('distance',{title:'Test',metrics:[]}).value).toBe('—')});
 it('keeps transforms finite and inside the supported editing range',()=>{const s=newShareSticker('tape',data);const v=safeSticker({...s,x:-2,y:20,scale:100,rotation:725,text:'a'.repeat(100),value:'b'.repeat(200)});expect(v.x).toBe(0);expect(v.y).toBe(1);expect(v.scale).toBe(2.4);expect(v.rotation).toBe(5);expect(v.text).toHaveLength(60);expect(v.value).toHaveLength(80)});
 it('provides twelve distinct sticker kinds and unique instances',()=>{expect(new Set(stickerKinds.map(s=>s.id)).size).toBe(12);expect(newShareSticker('tape',data).id).not.toBe(newShareSticker('tape',data).id)});
});
