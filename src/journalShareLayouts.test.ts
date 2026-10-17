import {describe,it,expect} from 'vitest';
import {photoShareLayout,usesSharePhoto,isSignatureTemplate,type GraphicBox} from './journalShareLayouts';
import {shareFormats,shareTemplates} from './journalShare';
const overlap=(a:GraphicBox,b:GraphicBox)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
describe('photo-first sharing layouts',()=>{
 for(const template of shareTemplates.filter(t=>usesSharePhoto(t.id)))for(const format of Object.keys(shareFormats) as (keyof typeof shareFormats)[]){
  it(`${template.id} ${format}: photograph remains dominant with valid export areas`,()=>{
   if(!usesSharePhoto(template.id))throw new Error('Expected photographic template');
   const layout=photoShareLayout(template.id,format),size=shareFormats[format];
   const areas=[layout.header,layout.title,layout.metrics,layout.footer];
   for(const box of [layout.photo,...areas]){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(format==='9:16'?150:0);expect(box.width).toBeGreaterThan(0);expect(box.height).toBeGreaterThan(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);expect(box.y+box.height).toBeLessThanOrEqual(size.height-(format==='9:16'?160:0))}
   if(isSignatureTemplate(template.id)){expect(overlap(layout.photo,layout.title)).toBe(true);expect(layout.photo.width).toBeGreaterThanOrEqual(1008)}
   else{for(const box of areas)expect(overlap(layout.photo,box)).toBe(false);for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++)expect(overlap(areas[i],areas[j])).toBe(false)}
   expect(layout.photo.width*layout.photo.height/(size.width*size.height)).toBeGreaterThan(.45);
  });
 }
});
