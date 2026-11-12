import {ArrowRight,Bell,BookOpen,CalendarDays,Check,CheckCheck,Dumbbell,MapPin,MessageCircle,Users} from 'lucide-react';
import './beta-welcome.css';

export function BetaWelcome({onEnter}:{onEnter:()=>void}){
 return <div className="beta-welcome" id="top">
  <header className="beta-header"><a href="#top" aria-label="Trenomi – úvod"><img src="/brand/trenomi-logo-dark.svg" width="183" height="50" alt="Trenomi"/></a><button className="beta-login-link" onClick={onEnter}>Přihlášení <ArrowRight size={16}/></button></header>
  <main>
   <section className="beta-hero" aria-labelledby="beta-title">
    <div className="beta-hero-copy"><h1 id="beta-title">Tréninky a klub<br/><em>na jednom místě.</em></h1><p className="beta-lead">Kalendář tréninků, účast členů, deník a klubová komunikace pro trenéry i sportovce.</p>
     <div className="beta-status"><span className="beta-pill">BETA</span><div><h2>Právě beta testujeme.</h2><p>Nyní pro pozvané uživatele. Brzy veřejně.</p></div></div>
     <button className="beta-primary" onClick={onEnter}>Vstup pro betatestery <ArrowRight size={18}/></button>
    </div>
    <figure className="beta-product"><div className="beta-product-glow"/>
     <div className="beta-app-window" aria-hidden="true"><div className="beta-window-top"><img src="/brand/trenomi-symbol-dark.svg" width="25" height="25" alt=""/><b>Trenomi</b><span>Tvůj sportovní klub</span><Bell size={16}/></div>
      <div className="beta-app-body"><div className="beta-app-heading"><strong>Týden v klubu</strong><CalendarDays size={20}/></div>
       <div className="beta-week">{['Po','Út','St','Čt','Pá','So','Ne'].map((day,index)=><div className={index===1?'selected':''} key={day}><span>{day}</span><b>{index+12}</b>{[1,3,5].includes(index)&&<i/>}</div>)}</div>
       <div className="beta-example-event"><div className="beta-example-icon"><Dumbbell size={24}/></div><div><small>ÚTERÝ · 18:00</small><strong>Společný trénink</strong><span><MapPin size={12}/> Park · 60 minut</span></div><ArrowRight size={18}/></div>
       <div className="beta-roster-preview"><div><Users size={16}/><strong>Kdo přijde na trénink?</strong></div><div className="beta-example-rsvp"><span><Check size={13}/> Přijdu</span><span>Možná</span><span>Nepřijdu</span></div></div>
       <div className="beta-journal-preview"><div className="beta-journal-icon"><BookOpen size={20}/></div><div><strong>Tréninkový deník</strong><span>Průběh, docházka a fotografie.</span></div><CheckCheck size={18}/></div>
      </div>
     </div>
     <div className="beta-notification-preview" aria-hidden="true"><div className="beta-notification-icon"><Bell size={19}/></div><div><small>KLUBOVÉ OZNÁMENÍ</small><strong>Trénink začíná v 18:30.</strong><span>Změna času v klubových oznámeních.</span></div></div>
     <figcaption>Ilustrační ukázka kalendáře, účasti a tréninkového deníku.</figcaption>
    </figure>
   </section>
   <section className="beta-features" aria-label="Co Trenomi umí"><div className="beta-feature-grid">
    <article><CalendarDays size={21}/><div><h2>Kalendář</h2><p>Tréninky a závody.</p></div></article>
    <article><Users size={21}/><div><h2>Účast</h2><p>Přihlášení a docházka.</p></div></article>
    <article><BookOpen size={21}/><div><h2>Deník</h2><p>Průběh a fotky z tréninků.</p></div></article>
    <article><MessageCircle size={21}/><div><h2>Domluva</h2><p>Chat a klubová oznámení.</p></div></article>
   </div></section>
  </main>
  <footer className="beta-footer"><span>© {new Date().getFullYear()} Trenomi</span><a href="#top">Zpět nahoru ↑</a></footer>
 </div>;
}
