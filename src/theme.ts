import {useEffect,useState} from 'react';
export type Theme='dark'|'light';
export const themeKey='trenomi-theme';
export function readTheme(storage:Pick<Storage,'getItem'>):Theme{try{return storage.getItem(themeKey)==='light'?'light':'dark'}catch{return 'dark'}}
export function applyTheme(theme:Theme){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4f6f9':'#090C0A');}
export function setTheme(theme:Theme){try{localStorage.setItem(themeKey,theme)}catch{/* The current page still supports theme switching when storage is blocked. */}applyTheme(theme);window.dispatchEvent(new Event('trenomi-theme-changed'));}
export function useTheme(){const [theme,update]=useState<Theme>(()=>document.documentElement.dataset.theme==='light'?'light':'dark');useEffect(()=>{const sync=()=>update(document.documentElement.dataset.theme==='light'?'light':'dark');window.addEventListener('trenomi-theme-changed',sync);const stored=(e:StorageEvent)=>{if(e.key===themeKey){applyTheme(e.newValue==='light'?'light':'dark');sync()}};window.addEventListener('storage',stored);return()=>{window.removeEventListener('trenomi-theme-changed',sync);window.removeEventListener('storage',stored)}},[]);return {theme,setTheme};}
