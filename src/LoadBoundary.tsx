import {Component,Suspense,useEffect,useId,useState,type ReactNode} from 'react';
import {AlertTriangle,RefreshCw} from 'lucide-react';

function RecoveryMessage({slow=false,root=false}:{slow?:boolean;root?:boolean}){
 const titleId=useId();
 return <section className="load-recovery" role="alert" aria-labelledby={titleId}>
  <AlertTriangle size={25} aria-hidden="true"/>
  <div><h2 id={titleId}>{slow?'Načítání trvá déle než obvykle':'Tuto část se nepodařilo zobrazit'}</h2>
   <p>{slow?'Zkontrolujte připojení k internetu. Můžete přejít na jinou záložku, počkat, nebo aplikaci obnovit.':root?'Mohlo dojít k přerušení spojení, aktualizaci aplikace nebo chybě zobrazení. Aplikaci můžete znovu načíst tlačítkem níže.':'Mohlo dojít k přerušení spojení, aktualizaci aplikace nebo chybě zobrazení. Zkuste jinou záložku nebo aplikaci obnovte.'}</p>
   <button className="primary" onClick={()=>window.location.reload()}><RefreshCw size={17} aria-hidden="true"/> Obnovit aplikaci</button>
   <small>Uložená data zůstanou zachovaná. Neuložené změny se při obnovení ztratí.</small>
  </div>
 </section>;
}

// Suspense handles pending imports only. Rejected imports and render errors
// need a boundary too; otherwise React removes the entire application root.
export class RenderBoundary extends Component<{children:ReactNode;root?:boolean},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className={this.props.root?'recovery-screen':undefined}><RecoveryMessage root={this.props.root}/></div>:this.props.children}
}
function PendingSection({children}:{children:ReactNode}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setSlow(true),15000);return()=>window.clearTimeout(timer)},[]);
 return slow?<RecoveryMessage slow/>:<>{children}</>;
}
export function LoadBoundary({children,fallback}:{children:ReactNode;fallback:ReactNode}){
 return <RenderBoundary><Suspense fallback={<PendingSection>{fallback}</PendingSection>}>{children}</Suspense></RenderBoundary>;
}
