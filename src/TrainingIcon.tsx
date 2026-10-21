import type {CSSProperties} from 'react';
import {useEffect,useRef,useState} from 'react';
import {trainingIcons,resolveTrainingIcon,isTrainingIcon,type TrainingIconId,type TrainingIconChoice} from './trainingIcons';

export function TrainingIcon({id,className=''}:{id:TrainingIconId;className?:string}){
 const index=trainingIcons.findIndex(([key])=>key===id);
 return <span aria-hidden="true" className={'sport-outline-icon '+className} style={{'--sport-x':`${index%8/7*100}%`,'--sport-y':`${[35,220,395,560,720][Math.floor(index/8)]/(901-160)*100}%`} as CSSProperties}/>;
}
export function TrainingWatermark({source}:{source:{type:string;training_icon?:string|null;event_kind?:string}}){
 const id=resolveTrainingIcon(source);
 return source.event_kind==='race'||!id?null:<span aria-hidden="true" className="training-watermark" data-training-icon={id}><TrainingIcon id={id}/></span>;
}
export function TrainingIconPicker({initial,type:initialType}:{initial?:TrainingIconChoice;type:string}){
 const [choice,setChoice]=useState<TrainingIconChoice>(initial||null),[type,setType]=useState(initialType);
 const root=useRef<HTMLFieldSetElement>(null);
 useEffect(()=>{const form=root.current?.closest('form');const sync=()=>{const select=form?.querySelector<HTMLSelectElement>('select[name="type"]');if(select)setType(select.value)};sync();form?.addEventListener('change',sync);return()=>form?.removeEventListener('change',sync)},[]);
 const selected=resolveTrainingIcon({type,training_icon:choice});
 return <fieldset ref={root} className="training-icon-picker"><legend>Ikona tréninku</legend><input type="hidden" name="training_icon" value={choice||''}/><div className="training-icon-preview watermark-surface"><TrainingWatermark source={{type,training_icon:choice}}/><b>Velký obrys · 15 %</b><span>{choice==='none'?'Bez vodoznaku':trainingIcons.find(([id])=>id===selected)?.[1]}</span></div><div className="training-icon-modes"><button type="button" aria-pressed={choice===null} onClick={()=>setChoice(null)}>Automaticky dle zaměření</button><button type="button" aria-pressed={choice==='none'} onClick={()=>setChoice('none')}>Bez vodoznaku</button></div><details open={isTrainingIcon(choice)||undefined}><summary>Vybrat sportovní ikonu · 40 možností</summary><div className="training-icon-grid" role="group" aria-label="Sportovní ikony">{trainingIcons.map(([id,label])=><button key={id} type="button" aria-label={'Ikona '+label} aria-pressed={choice===id} onClick={()=>setChoice(id)}><TrainingIcon id={id}/><span>{label}</span></button>)}</div></details><p className="muted">Ikonu převezmou nové tréninky z této šablony. Již vytvořené tréninky se změnou šablony nemění.</p></fieldset>;
}
