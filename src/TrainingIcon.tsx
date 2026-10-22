import type {CSSProperties} from 'react';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {trainingIcons,atlasTrainingIcons,normalizeTrainingIcon,resolveTrainingIcon,type TrainingIconId,type TrainingIconChoice} from './trainingIcons';

export function TrainingIcon({id,className=''}:{id:TrainingIconId;className?:string}){
 const index=atlasTrainingIcons.findIndex(([key])=>key===id),special=id==='ocr'||id==='trail';
 const standalone=['triathlon','run-workout','hiit','kettlebell'].includes(id);
 const position=standalone?{}:special?{'--sport-x':id==='ocr'?'0%':'100%','--sport-y':'0%'}:{'--sport-x':`${index%8/7*100}%`,'--sport-y':`${[35,220,395,560,720][Math.floor(index/8)]/(901-160)*100}%`};
 return <span aria-hidden="true" className={'sport-outline-icon '+(special?'sport-outline-icon--special ':standalone?'sport-outline-icon--'+id+' ':'')+className} style={position as CSSProperties}/>;
}
export function TrainingWatermark({source}:{source:{type:string;training_icon?:string|null;event_kind?:string}}){
 const id=resolveTrainingIcon(source);
 return !id?null:<span aria-hidden="true" className="training-watermark" data-training-icon={id}><TrainingIcon id={id}/></span>;
}
function TemplateIconDialog({choice,label,onChoose,onClose}:{choice:TrainingIconChoice;label:string;onChoose:(choice:TrainingIconChoice)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;if(!element)return;const trigger=document.activeElement as HTMLElement|null;element.showModal();return()=>{element.close();if(trigger?.isConnected)trigger.focus({preventScroll:true})}},[]);
 return createPortal(<dialog ref={dialog} className="template-icon-dialog" aria-label="Vybrat ikonu šablony" onCancel={e=>{e.preventDefault();onClose()}} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 }}>
  <header><h2>Vybrat ikonu</h2><button type="button" autoFocus aria-label="Zavřít výběr ikon" onClick={onClose}><X size={20}/></button></header>
  <div className="template-icon-dialog-body"><div className="training-icon-modes"><button type="button" aria-pressed={choice===null} onClick={()=>onChoose(null)}>Automaticky dle zaměření</button><button type="button" aria-pressed={choice==='none'} onClick={()=>onChoose('none')}>Bez ikony / vodoznaku</button></div><div className="training-icon-grid" role="group" aria-label={label}>{trainingIcons.map(([id,label])=><button key={id} type="button" data-icon-choice={id} aria-label={'Ikona '+label} aria-pressed={choice===id} onClick={()=>onChoose(id)}><TrainingIcon id={id}/><span>{label}</span></button>)}</div></div>
 </dialog>,document.body);
}
export function TrainingIconPicker({initial,value,onChange,type:initialType,context='template',kind='training'}:{initial?:TrainingIconChoice;value?:TrainingIconChoice;onChange?:(choice:TrainingIconChoice)=>void;type:string;context?:'template'|'event';kind?:'training'|'race'}){
 const [open,setOpen]=useState(false);
 const [localChoice,setLocalChoice]=useState<TrainingIconChoice>(initial||null),[formType,setFormType]=useState(initialType);
 const choice=normalizeTrainingIcon(value===undefined?localChoice:value),type=context==='event'||kind==='race'?initialType:formType;
 function choose(next:TrainingIconChoice){setLocalChoice(next);onChange?.(next)}
 const root=useRef<HTMLFieldSetElement>(null);
 useEffect(()=>{if(context!=='template'||kind==='race')return;const form=root.current?.closest('form');const sync=()=>{const select=form?.querySelector<HTMLSelectElement>('select[name="type"]');if(select)setFormType(select.value)};sync();form?.addEventListener('change',sync);return()=>form?.removeEventListener('change',sync)},[context,kind]);
 const selected=resolveTrainingIcon({type,training_icon:choice}),label=kind==='race'?'Ikona závodu':'Ikona tréninku';
 return <fieldset ref={root} className="training-icon-picker"><legend>{kind==='race'?'Ikona a vodoznak závodu':'Ikona a vodoznak tréninku'}</legend><input type="hidden" name="training_icon" value={choice||''}/>{context==='template'?<button type="button" className="template-icon-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>Vybrat ikonu</button>:<div className="training-icon-grid" role="group" aria-label={label}>{trainingIcons.map(([id,label])=><button key={id} type="button" data-icon-choice={id} aria-label={'Ikona '+label} aria-pressed={choice===id} onClick={()=>choose(id)}><TrainingIcon id={id}/><span>{label}</span></button>)}</div>}<div className="training-icon-preview watermark-surface"><TrainingWatermark source={{type,training_icon:choice}}/><b>Velký obrys</b><span>{choice==='none'?'Bez vodoznaku':trainingIcons.find(([id])=>id===selected)?.[1]}</span></div>{context==='event'&&<div className="training-icon-modes"><button type="button" aria-pressed={choice===null} onClick={()=>choose(null)}>Automaticky dle zaměření</button><button type="button" aria-pressed={choice==='none'} onClick={()=>choose('none')}>Bez vodoznaku</button></div>}<p className="muted">{context==='template'?(kind==='race'?'Ikonu převezmou nové závody z této šablony. Již vytvořené závody se změnou šablony nemění.':'Ikonu převezmou nové tréninky z této šablony. Již vytvořené tréninky se změnou šablony nemění.'):kind==='race'?'Vybraná ikona se uloží přímo k tomuto závodu.':'Vybraná ikona se uloží přímo k této události. Při opakování ji převezmou všechny vytvářené termíny.'}</p>{open&&<TemplateIconDialog choice={choice} label={label} onChoose={value=>{choose(value);setOpen(false)}} onClose={()=>setOpen(false)}/>}</fieldset>;
}
