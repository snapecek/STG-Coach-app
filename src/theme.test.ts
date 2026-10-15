import {expect,it} from 'vitest';
import {readTheme,themeKey} from './theme';
it('restores only a valid light preference and defaults to dark',()=>{expect(readTheme({getItem:key=>key===themeKey?'light':null})).toBe('light');for(const value of [null,'dark','invalid'])expect(readTheme({getItem:()=>value})).toBe('dark')});
it('keeps the page usable when browser storage is blocked',()=>{expect(readTheme({getItem:()=>{throw new Error('Blocked storage')}})).toBe('dark')});
