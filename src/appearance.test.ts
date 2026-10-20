import {describe,it,expect} from 'vitest';
import {uiPalettes,uiPalette,accountUiPalette} from './appearance';
describe('coach UI palettes',()=>{
 it('provides eight distinct palettes and uses the sharp lime design by default',()=>{expect(uiPalettes).toHaveLength(8);expect(new Set(uiPalettes.map(p=>p.color)).size).toBe(8);expect(uiPalette(undefined)).toMatchObject({id:'lime',color:'#C8F031'});});
 it('accepts only known palette IDs from account metadata',()=>{for(const value of [null,{},'#123456','url(https://example.invalid)',false,'unknown'])expect(uiPalette(value).id).toBe('lime');expect(uiPalette('cyan').color).toBe('#49C6E5')});
 it('resets old preview choices once and preserves deliberate choices in the new design',()=>{expect(accountUiPalette({ui_palette:'violet'}).id).toBe('lime');expect(accountUiPalette({ui_palette:'violet',ui_palette_revision:2}).id).toBe('violet');expect(accountUiPalette({ui_palette:'invalid',ui_palette_revision:2}).id).toBe('lime')});
 it('keeps button captions readable on every accent',()=>{
  const luminance=(hex:string)=>{const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};
  for(const p of uiPalettes)expect((luminance(p.color)+.05)/(luminance('#101216')+.05)).toBeGreaterThanOrEqual(4.5);
 });
});
