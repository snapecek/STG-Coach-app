import {useId,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
type Props={label:string;name:string;autoComplete:string;disabled?:boolean;minLength?:number;maxLength?:number};
export function PasswordInput({label,name,autoComplete,disabled,minLength,maxLength}:Props){
 const id=useId(),[visible,setVisible]=useState(false);
 return <label htmlFor={id}>{label}<span className="password-control"><input id={id} aria-label={label} name={name} type={visible?'text':'password'} autoComplete={autoComplete} required disabled={disabled} minLength={minLength} maxLength={maxLength}/><button type="button" className="password-toggle" aria-label={`${visible?'Skrýt':'Zobrazit'} heslo: ${label}`} aria-pressed={visible} disabled={disabled} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>;
}
