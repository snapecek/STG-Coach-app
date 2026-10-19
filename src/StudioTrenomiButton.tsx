import {ArrowUpRight,Sparkles} from 'lucide-react';

export function StudioTrenomiButton({onClick,disabled=false,compact=false}:{onClick:()=>void;disabled?:boolean;compact?:boolean}){
 return <button type="button" className={'studio-entry'+(compact?' compact':'')} aria-label="Sdílet trénink" onClick={onClick} disabled={disabled}><Sparkles size={compact?18:23} aria-hidden="true"/><span><strong>Studio Trenomi</strong><small>{compact?'Sdílet trénink':'Sdílet trénink · vytvořit vlastní grafiku'}</small></span>{!compact&&<ArrowUpRight size={20} aria-hidden="true"/>}</button>;
}
