import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {photoPrefix,listEventPhotos,removeAllEventPhotos,removeEventPhoto,preparePhoto} from './photos';
const club='20000000-0000-4000-8000-000000000001',event='50000000-0000-4000-8000-000000000001';
const name='60000000-0000-4000-8000-000000000001.jpg';
describe('Soukromé fotografie',()=>{
 it('vynucuje UUID prefix klubu a události',()=>{expect(photoPrefix(club,event)).toBe(club+'/'+event);expect(()=>photoPrefix('../bad',event)).toThrow()});
 it('odmítá smazání cizí fotografie ještě před API',async()=>{await expect(removeEventPhoto({} as SupabaseClient,club,event,'foreign/path.jpg')).rejects.toThrow('nepatří')});
 it('vypisuje pouze skutečné soubory a bezpečné přípony',async()=>{const list=vi.fn(async()=>({data:[{id:'file',name,metadata:{size:100}},{id:null,name:'folder',metadata:null},{id:'unsafe',name:'fake.svg',metadata:{size:1}}],error:null}));const client={storage:{from:()=>({list})}} as unknown as SupabaseClient;expect(await listEventPhotos(client,club,event)).toEqual([{name,path:club+'/'+event+'/'+name,bytes:100}]);expect(list).toHaveBeenCalledWith(club+'/'+event,expect.objectContaining({offset:0,limit:100}))});
 it('nepotvrdí vymazání při chybě úložiště',async()=>{const client={storage:{from:()=>({list:async()=>({data:[{id:'file',name}],error:null}),remove:async()=>({error:new Error('Denied')})})}} as unknown as SupabaseClient;await expect(removeAllEventPhotos(client,club,event)).rejects.toThrow('Událost nebyla smazána')});
 it('SVG a nadlimitní vstup se nikdy neposílají do dekodéru',async()=>{await expect(preparePhoto(new File(['<svg/>'],'test.svg',{type:'image/svg+xml'}))).rejects.toThrow('JPG');await expect(preparePhoto({type:'image/jpeg',size:17*1024*1024} as File)).rejects.toThrow('16 MB')});
 it('neohlásí smazání, když API uspěje bez odstranění souboru',async()=>{const client={storage:{from:()=>({list:async()=>({data:[{id:'file',name}],error:null}),remove:async()=>({data:[],error:null})})}} as unknown as SupabaseClient;await expect(removeEventPhoto(client,club,event,club+'/'+event+'/'+name)).rejects.toThrow('nebylo potvrzené')});

});
