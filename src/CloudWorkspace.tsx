import {useEffect,useState} from 'react';
import type {Session,SupabaseClient} from '@supabase/supabase-js';
import {Activity,LogOut,ShieldCheck,ArrowLeft,RefreshCw} from 'lucide-react';
import {configuredClient,loadClubAccess,type ClubAccess} from './supabase';

export function CloudWorkspace(){
 const [setup]=useState(()=>{try{return {client:configuredClient(),error:''}}catch(error){return {client:undefined,error:error instanceof Error?error.message:'Konfigurace není dostupná.'}}});
 return <div className="auth-screen"><div className="auth-card"><a className="brand" href="/"><span className="brand-icon"><Activity/></span>STG<span className="brand-light">Coach</span></a><div className="eyebrow">KLUBOVÝ PROSTOR</div>{setup.client?<AuthWorkspace client={setup.client}/>:<><h1>Připoj svůj klub</h1><p role="status">{setup.error}</p><p>Demo je k dispozici i bez připojení. Skutečné členské údaje zatím nejsou v aplikaci povolené.</p></>}<a className="text-button auth-back" href="/"><ArrowLeft size={16}/> Zpět do fiktivního dema</a></div></div>;
}
function AuthWorkspace({client}:{client:SupabaseClient}){
 const [session,setSession]=useState<Session|null>(null),[initializing,setInitializing]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clubs,setClubs]=useState<ClubAccess[]>([]),[loadingClubs,setLoadingClubs]=useState(false),[retry,setRetry]=useState(0),[activeClub,setActiveClub]=useState('');
 useEffect(()=>{
   let mounted=true,revision=0;
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{revision++;if(mounted){setClubs([]);setActiveClub('');setError('');setSession(next);setInitializing(false);}});
   const snapshot=revision;
   client.auth.getSession().then(({data,error})=>{if(mounted&&revision===snapshot){if(error)setError('Přihlášení nelze obnovit.');setSession(error?null:data.session);setInitializing(false);}}).catch(()=>{if(mounted&&revision===snapshot){setError('Přihlášení nelze obnovit.');setInitializing(false);}});
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[client]);
 useEffect(()=>{
   let alive=true;setClubs([]);setActiveClub('');
   if(!session){setLoadingClubs(false);return;}
   setLoadingClubs(true);setError('');
   loadClubAccess(client).then(result=>{if(alive){setClubs(result);if(result.length===1)setActiveClub(result[0].id);}}).catch(err=>{if(alive)setError(err instanceof Error?err.message:'Klub se nepodařilo načíst.');}).finally(()=>{if(alive)setLoadingClubs(false);});
   return ()=>{alive=false;};
 },[session,client,retry]);
 async function signIn(form:HTMLFormElement){
   const fields=new FormData(form);setBusy(true);setError('');
   try{const {error}=await client.auth.signInWithPassword({email:String(fields.get('email')).trim(),password:String(fields.get('password'))});if(error)setError('Přihlášení se nepodařilo. Zkontrolujte údaje a ověření e-mailu.');else form.reset();}
   catch{setError('Přihlášení se nepodařilo. Zkontrolujte připojení a zkuste to znovu.');}
   finally{setBusy(false);}
 }
 async function signOut(){
   setBusy(true);setError('');
   // Hide tenant information immediately; never fall back to fictional data here.
   setClubs([]);setActiveClub('');
   try{const {error}=await client.auth.signOut({scope:'local'});if(error)setError('Odhlášení se nepodařilo. Zkuste to znovu.');else setSession(null);}
   catch{setError('Odhlášení se nepodařilo. Zkuste to znovu.');}
   finally{setBusy(false);}
 }
 if(initializing)return <p role="status">Ověřuji přihlášení…</p>;
 if(!session)return <><h1>Vítej zpátky<span className="orange">.</span></h1><p>Přihlas se účtem pozvaným do svého klubu.</p>{error&&<p className="auth-error" role="alert">{error}</p>}<form onSubmit={event=>{event.preventDefault();void signIn(event.currentTarget)}}><label>E-mail<input name="email" type="email" autoComplete="username" required disabled={busy}/></label><label>Heslo<input name="password" type="password" autoComplete="current-password" required disabled={busy}/></label><button className="primary" disabled={busy}>{busy?'Přihlašuji…':'Přihlásit se'}</button></form><p className="muted">Účty a členství přiděluje správce. Veřejná registrace zatím není dostupná.</p></>;
 const selected=clubs.find(club=>club.id===activeClub);
 return <><h1>Tvůj klub</h1><p><ShieldCheck size={16}/> Přihlášení proběhlo úspěšně.</p>{error&&<p className="auth-error" role="alert">{error}</p>}{loadingClubs?<p role="status">Ověřuji přístup ke klubům…</p>:error?<button className="text-button" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16}/> Ověřit znovu</button>:clubs.length===0?<div className="plan">Účet zatím nemá přidělený klub. Požádej správce o pozvánku.</div>:<><label>Klub<select value={activeClub} onChange={event=>setActiveClub(event.target.value)}><option value="" disabled>Vyber klub</option>{clubs.map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select></label>{selected&&<div className="plan"><b>{selected.name}</b><p>Role: {selected.role==='owner'?'Správce':selected.role==='coach'?'Trenér':'Člen'}</p><p>Přístup ke klubu byl načten. Cloudová evidence členů a tréninků bude zapojená v další etapě.</p></div>}</>}<button className="text-button" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/>{busy?'Odhlašuji…':'Odhlásit se'}</button></>;
}
