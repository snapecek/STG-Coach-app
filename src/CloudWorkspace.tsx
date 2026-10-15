import {BrandLogo} from './BrandLogo';
import {PasswordInput} from './PasswordInput';
import {useEffect,useRef,useState,lazy,Suspense} from 'react';
import type {Session,SupabaseClient} from '@supabase/supabase-js';
import {LogOut,ShieldCheck,RefreshCw,UserRound,Mail,KeyRound,UserRoundCheck} from 'lucide-react';
import {configuredClient,loadClubAccess,type ClubAccess} from './supabase';
import {acceptInvitation} from './memberAccess';
import {parseAuthLink,cleanAuthUrl,validateNewPassword,type AuthLink} from './authLinks';
const ClubDashboard=lazy(()=>import('./ClubDashboard').then(m=>({default:m.ClubDashboard})));
const MemberDashboard=lazy(()=>import('./MemberDashboard').then(m=>({default:m.MemberDashboard})));
const invitationKey='stg-pending-invitation',passwordSetupKey='stg-password-setup';
let initialLink:AuthLink|undefined,linkPromise:Promise<void>|undefined;
function readInitialLink(){
 if(initialLink)return initialLink;
 initialLink=parseAuthLink(window.location.href);
 if(initialLink.passwordSetup)sessionStorage.setItem(passwordSetupKey,'1');else if(sessionStorage.getItem(passwordSetupKey)==='1')initialLink.passwordSetup=true;
 if(initialLink.invite)sessionStorage.setItem(invitationKey,initialLink.invite);else if(new URL(window.location.href).searchParams.has('club-invite'))sessionStorage.removeItem(invitationKey);
 history.replaceState(history.state,'',cleanAuthUrl(window.location.href));
 return initialLink;
}
function initializeAuthLink(client:SupabaseClient,link:AuthLink){
 if(linkPromise)return linkPromise;
 linkPromise=(async()=>{
  if(link.error)throw new Error('Odkaz je neplatný nebo vypršel. Požádejte o nový.');
  if(link.accessToken||link.refreshToken){
   if(!link.accessToken||!link.refreshToken)throw new Error('Odkaz není úplný. Požádejte o nový.');
   const {error}=await client.auth.setSession({access_token:link.accessToken,refresh_token:link.refreshToken});
   if(error)throw new Error('Odkaz nelze ověřit. Požádejte o nový.');
   const user=await client.auth.getUser();if(user.error||!user.data.user)throw new Error('Přihlášení z odkazu nelze ověřit.');
  }else if(link.code){const {error}=await client.auth.exchangeCodeForSession(link.code);if(error)throw new Error('Odkaz nelze ověřit. Otevřete jej v původním prohlížeči nebo požádejte o nový.');}
 })().finally(()=>{link.accessToken=null;link.refreshToken=null;link.code=null});
 return linkPromise;
}
export function CloudWorkspace(){
 const [setup]=useState(()=>{try{return {client:configuredClient(),error:''}}catch(error){return {client:undefined,error:error instanceof Error?error.message:'Konfigurace není dostupná.'}}});
 return <div className="auth-screen cloud-screen"><div className="auth-card cloud-card"><a className="brand" href="/"><BrandLogo/></a><div className="eyebrow">KLUBOVÝ PROSTOR</div>{setup.client?<AuthWorkspace client={setup.client}/>:<><h1>Připoj svůj klub</h1><p role="status">{setup.error}</p><p>Připojení klubu vyžaduje nastavení Supabase. Členské údaje se bez něj nenačítají.</p></>}</div></div>;
}
function AuthWorkspace({client}:{client:SupabaseClient}){
 const userMenu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(userMenu.current&&!userMenu.current.contains(e.target as Node))userMenu.current.open=false;};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&userMenu.current)userMenu.current.open=false;};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[]);

 const [link]=useState(readInitialLink),[pendingInvite,setPendingInvite]=useState(()=>sessionStorage.getItem(invitationKey)||''),[passwordSetup,setPasswordSetup]=useState(link.passwordSetup),[forgot,setForgot]=useState(false),[notice,setNotice]=useState('');
 const [session,setSession]=useState<Session|null>(null),[initializing,setInitializing]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clubs,setClubs]=useState<ClubAccess[]>([]),[loadingClubs,setLoadingClubs]=useState(false),[retry,setRetry]=useState(0),[activeClub,setActiveClub]=useState('');
 const identityId=useRef<string|undefined>(undefined),preferredClub=useRef('');
 useEffect(()=>{
   let mounted=true,revision=0;
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{revision++;if(mounted){if(identityId.current!==next?.user.id){setClubs([]);setActiveClub('');setError('');}identityId.current=next?.user.id;setSession(next);}});
   const snapshot=revision;
   initializeAuthLink(client,link).then(()=>client.auth.getSession()).then(({data,error})=>{if(mounted&&revision===snapshot){if(error)setError('Přihlášení nelze obnovit.');identityId.current=error?undefined:data.session?.user.id;setSession(error?null:data.session);}}).catch(err=>{if(mounted){setError(err instanceof Error?err.message:'Odkaz nelze ověřit.');sessionStorage.removeItem(passwordSetupKey);setPasswordSetup(false);setSession(null);}}).finally(()=>{if(mounted)setInitializing(false)});
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[client,link]);
 useEffect(()=>{
   let alive=true;setClubs([]);setActiveClub('');
   if(!session||passwordSetup||pendingInvite){setLoadingClubs(false);return;}
   setLoadingClubs(true);setError('');
   loadClubAccess(client).then(result=>{if(alive){setClubs(result);if(preferredClub.current&&result.some(c=>c.id===preferredClub.current)){setActiveClub(preferredClub.current);preferredClub.current=''}else if(result.length===1)setActiveClub(result[0].id);}}).catch(err=>{if(alive)setError(err instanceof Error?err.message:'Klub se nepodařilo načíst.');}).finally(()=>{if(alive)setLoadingClubs(false);});
   return ()=>{alive=false;};
 },[session?.user.id,client,retry,passwordSetup,pendingInvite]);
 async function signIn(form:HTMLFormElement){const fields=new FormData(form);setBusy(true);setError('');try{const {error}=await client.auth.signInWithPassword({email:String(fields.get('email')).trim(),password:String(fields.get('password'))});if(error)setError('Přihlášení se nepodařilo. Zkontrolujte údaje a ověření e-mailu.');else form.reset();}catch{setError('Přihlášení se nepodařilo. Zkontrolujte připojení.');}finally{setBusy(false);}}
 async function signOut(){setBusy(true);setError('');setClubs([]);setActiveClub('');try{const {error}=await client.auth.signOut({scope:'local'});if(error)setError('Odhlášení se nepodařilo.');else {sessionStorage.removeItem(passwordSetupKey);setSession(null);setPasswordSetup(false);}}catch{setError('Odhlášení se nepodařilo.');}finally{setBusy(false);}}
 async function resetPassword(form:HTMLFormElement){setBusy(true);setError('');try{const redirect=new URL('/?auth=recovery',location.origin);if(pendingInvite)redirect.searchParams.set('club-invite',pendingInvite);const {error}=await client.auth.resetPasswordForEmail(String(new FormData(form).get('email')).trim(),{redirectTo:redirect.href});if(error)throw new Error();setNotice('Pokud má tento e-mail účet, přijde odkaz na obnovu hesla. Zkontrolujte i nevyžádanou poštu.');}catch{setError('Požadavek na obnovu hesla nelze odeslat. Zkuste to později.');}finally{setBusy(false);}}
 async function setPassword(form:HTMLFormElement){setBusy(true);setError('');try{const f=new FormData(form),password=String(f.get('password'));validateNewPassword(password,String(f.get('confirm')));const {error}=await client.auth.updateUser({password});if(error)throw new Error('Heslo nelze uložit. Ověřovací odkaz mohl vypršet.');form.reset();sessionStorage.removeItem(passwordSetupKey);setPasswordSetup(false);setNotice('Heslo je uložené.');}catch(e){setError(e instanceof Error?e.message:'Heslo nelze uložit.');}finally{setBusy(false);}}
 async function accept(){setBusy(true);setError('');try{preferredClub.current=await acceptInvitation(client,pendingInvite);sessionStorage.removeItem(invitationKey);setPendingInvite('');setNotice('Pozvánka přijata. Vaše historie zůstává zachovaná.');setRetry(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'Pozvánku nelze přijmout.');}finally{setBusy(false);}}
 function dismissInvite(){sessionStorage.removeItem(invitationKey);setPendingInvite('');setError('');}
 if(initializing)return <p role="status">Ověřuji přihlášení…</p>;
 if(!session)return <><h1>{forgot?'Obnova hesla':'Vítej v Trenomi.'}</h1><p>{pendingInvite?'Přihlaste se e-mailem uvedeným v klubové pozvánce.':'Přihlas se účtem pozvaným do svého klubu.'}</p>{error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}<form onSubmit={event=>{event.preventDefault();void (forgot?resetPassword:signIn)(event.currentTarget)}}><label>E-mail<input aria-label="E-mail" name="email" type="email" autoComplete="username" required disabled={busy}/></label>{!forgot&&<PasswordInput label="Heslo" name="password" autoComplete="current-password" disabled={busy}/>}<button className="primary" disabled={busy}>{busy?'Odesílám…':forgot?'Poslat odkaz na obnovu':'Přihlásit se'}</button></form><button className="text-button" disabled={busy} onClick={()=>{setForgot(!forgot);setError('');setNotice('')}}>{forgot?'Zpět k přihlášení':'Zapomenuté heslo'}</button><p className="muted">Nový účet vytvoří trenér pozvánkou. Veřejná registrace není dostupná.</p>{pendingInvite&&<button className="text-button" onClick={dismissInvite}>Zavřít klubovou pozvánku</button>}</>;
 if(passwordSetup)return <><span className="event-symbol training"><KeyRound/></span><h1>Nastavit heslo</h1><p>Zvolte nové heslo pro svůj ověřený účet. Minimálně 12 znaků.</p>{error&&<p role="alert" className="auth-error">{error}</p>}<form onSubmit={e=>{e.preventDefault();void setPassword(e.currentTarget)}}><PasswordInput label="Nové heslo" name="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={busy}/><PasswordInput label="Potvrdit heslo" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} disabled={busy}/><button className="primary" disabled={busy}>Uložit nové heslo</button></form><button className="text-button" disabled={busy} onClick={()=>void signOut()}>Odhlásit se</button></>;
 const selected=clubs.find(club=>club.id===activeClub);
 return <><details ref={userMenu} className="user-menu"><summary aria-label="Uživatelské menu"><UserRound size={20}/><span>Můj účet</span></summary><div className="user-menu-panel"><b>{session.user.user_metadata?.full_name||session.user.email||'Uživatel'}</b><button className="text-button" disabled={busy} onClick={()=>{sessionStorage.setItem(passwordSetupKey,'1');setPasswordSetup(true);setError('');setNotice('')}}><KeyRound size={16}/> Změnit heslo</button><button className="text-button" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/>{busy?'Odhlašuji…':'Odhlásit se'}</button></div></details>{notice&&<p className="notice" role="status">{notice}</p>}{pendingInvite?<div className="accept-invitation"><span className="event-symbol training"><UserRoundCheck/></span><h1>Pozvánka do klubu</h1><p>Přijměte pozvánku pro účet <b>{session.user.email}</b>. Propojí se se stávajícím členským záznamem.</p>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary" disabled={busy} onClick={()=>void accept()}><Mail size={16}/> Přijmout pozvánku</button><button className="text-button" disabled={busy} onClick={dismissInvite}>Zavřít pozvánku</button><button className="text-button" disabled={busy} onClick={()=>void signOut()}>Přihlásit se jiným účtem</button></div>:<>{!selected&&<><h1>Tvůj klub</h1><p><ShieldCheck size={16}/> Přihlášení proběhlo úspěšně.</p></>}{error&&<p className="auth-error" role="alert">{error}</p>}{loadingClubs?<p role="status">Ověřuji přístup ke klubům…</p>:error?<button className="text-button" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16}/> Ověřit znovu</button>:clubs.length===0?<div className="plan">Účet zatím nemá přidělený klub. Požádej správce o pozvánku.</div>:<><label>Klub<select aria-label="Klub" value={activeClub} onChange={event=>setActiveClub(event.target.value)}><option value="" disabled>Vyber klub</option>{clubs.map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select></label>{selected&&(selected.role==='member'?<Suspense fallback={<p role="status">Načítám členský prostor…</p>}><MemberDashboard key={session.user.id+':'+selected.id} client={client} club={selected}/></Suspense>:<Suspense fallback={<p role="status">Načítám trenérský prostor…</p>}><ClubDashboard key={session.user.id+':'+selected.id+':'+selected.role} client={client} club={selected}/></Suspense>)}</>}</>}</>;
}
