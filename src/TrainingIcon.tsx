import type {CSSProperties} from 'react';
import {useEffect,useRef,useState} from 'react';
import {trainingIcons,resolveTrainingIcon,type TrainingIconId,type TrainingIconChoice} from './trainingIcons';

export function TrainingIcon({id,className=''}:{id:TrainingIconId;className?:string}){
 const index=trainingIcons.findIndex(([key])=>key===id);
 return <span aria-hidden="true" className={'sport-outline-icon '+className} style={{'--sport-x':`${index%8/7*100}%`,'--sport-y':`${[35,220,395,560,720][Math.floor(index/8)]/(901-160)*100}%`} as CSSProperties}/>;
}
export function TrainingWatermark({source}:{source:{type:string;training_icon?:string|null;event_kind?:string}}){
 const id=resolveTrainingIcon(source);
 return source.event_kind==='race'||!id?null:<span aria-hidden="true" className="training-watermark" data-training-icon={id}><TrainingIcon id={id}/></span>;
}
export function TrainingIconPicker({initial,value,onChange,type:initialType,context='template'}:{initial?:TrainingIconChoice;value?:TrainingIconChoice;onChange?:(choice:TrainingIconChoice)=>void;type:string;context?:'template'|'event'}){
 const [localChoice,setLocalChoice]=useState<TrainingIconChoice>(initial||null),[formType,setFormType]=useState(initialType);
 const choice=value===undefined?localChoice:value,type=context==='event'?initialType:formType;
 function choose(next:TrainingIconChoice){setLocalChoice(next);onChange?.(next)}
 const root=useRef<HTMLFieldSetElement>(null);
 useEffect(()=>{if(context!=='template')return;const form=root.current?.closest('form');const sync=()=>{const select=form?.querySelector<HTMLSelectElement>('select[name="type"]');if(select)setFormType(select.value)};sync();form?.addEventListener('change',sync);return()=>form?.removeEventListener('change',sync)},[context]);
 const selected=resolveTrainingIcon({type,training_icon:choice});
 return <fieldset ref={root} className="training-icon-picker"><legend>Ikona a vodoznak tréninku</legend><label>Ikona tréninku<select aria-label="Ikona tréninku" name="training_icon" value={choice||''} onChange={e=>choose(e.target.value?e.target.value as TrainingIconChoice:null)}><option value="">Automaticky dle zaměření</option>{trainingIcons.map(([id,label])=><option key={id} value={id}>{label}</option>)}<option value="none">Bez vodoznaku</option></select></label><div className="training-icon-preview watermark-surface"><TrainingWatermark source={{type,training_icon:choice}}/><b>Velký obrys · 15 %</b><span>{choice==='none'?'Bez vodoznaku':trainingIcons.find(([id])=>id===selected)?.[1]}</span></div><div className="training-icon-modes"><button type="button" aria-pressed={choice===null} onClick={()=>choose(null)}>Automaticky dle zaměření</button><button type="button" aria-pressed={choice==='none'} onClick={()=>choose('none')}>Bez vodoznaku</button></div><details><summary>Zobrazit obrázky všech 40 ikon</summary><div className="training-icon-grid" role="group" aria-label="Sportovní ikony">{trainingIcons.map(([id,label])=><button key={id} type="button" aria-label={'Ikona '+label} aria-pressed={choice===id} onClick={()=>choose(id)}><TrainingIcon id={id}/><span>{label}</span></button>)}</div></details><p className="muted">{context==='template'?'Ikonu převezmou nové tréninky z této šablony. Již vytvořené tréninky se změnou šablony nemění.':'Vybraná ikona se uloží přímo k této události. Při opakování ji převezmou všechny vytvářené termíny.'}</p></fieldset>;
}
