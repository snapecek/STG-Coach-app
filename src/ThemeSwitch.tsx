import {Moon,Sun} from 'lucide-react';
import {useTheme} from './theme';
export function ThemeSwitch(){const {theme,setTheme}=useTheme();return <div className="theme-switch" role="group" aria-label="Barevný režim"><small>Vzhled aplikace</small><div>{([{id:'dark',label:'Tmavý',icon:Moon},{id:'light',label:'Světlý',icon:Sun}] as const).map(option=><button type="button" key={option.id} aria-pressed={theme===option.id} onClick={()=>setTheme(option.id)}><option.icon size={16}/>{option.label}</button>)}</div></div>}
