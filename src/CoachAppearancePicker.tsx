import {useState,type CSSProperties} from 'react';
import {Check} from 'lucide-react';
import type {Experience} from './Experience';
import {uiPalettes,accountUiPalette} from './appearance';

export function CoachAppearancePicker({experience}:{experience:Experience}){
 const current=accountUiPalette(experience.metadata),[notice,setNotice]=useState('');
 return <section className="coach-appearance" aria-label="Barevné motivy trenéra"><div className="panel-title"><div><small className="eyebrow">OSOBNÍ NASTAVENÍ</small><h3>Barevný motiv</h3></div><span className="appearance-count">08 motivů</span></div><p className="muted">Vyberte akcent rozhraní. Výchozí je limetkový technický motiv. Volba se uloží k vašemu účtu; logo a barvy disciplín zůstávají stejné.</p><div className="appearance-grid" role="group" aria-label="Barevný motiv trenéra">{uiPalettes.map(p=><button type="button" key={p.id} style={{'--palette-preview':p.color} as CSSProperties} aria-label={p.name} aria-pressed={current.id===p.id} disabled={experience.busy} onClick={()=>{setNotice('');void experience.save({ui_palette:p.id,ui_palette_revision:2}).then(ok=>{if(ok)setNotice('Barevný motiv byl uložen.')})}}><span className="appearance-preview" aria-hidden="true"><i/><span><b/><b/><b/></span><em/></span><span className="appearance-name"><i/>{p.name}{current.id===p.id&&<Check size={14} aria-hidden="true"/>}</span><small>{p.description}</small></button>)}</div>{notice&&<p className="notice" role="status">{notice}</p>}</section>;
}
