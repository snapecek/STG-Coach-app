import {ArrowRight,Bell,BookOpen,CalendarDays,Check,CheckCheck,Dumbbell,MapPin,MessageCircle,ShieldCheck,Users} from 'lucide-react';
import './beta-welcome.css';

export function BetaWelcome({onEnter}:{onEnter:()=>void}){
 return <div className="beta-welcome" id="top">
  <header className="beta-header"><a href="#top" aria-label="Trenomi – úvod"><img src="/brand/trenomi-logo-dark.svg" width="183" height="50" alt="Trenomi"/></a><span className="beta-header-note"><span/> Ve vývoji. Společně.</span><button className="beta-login-link" onClick={onEnter}>Přihlášení <ArrowRight size={16}/></button></header>
  <main>
   <section className="beta-hero" aria-labelledby="beta-title">
    <div className="beta-hero-copy"><div className="beta-eyebrow"><span/> PRO KLUBY, KTERÉ SPORTUJÍ SPOLU</div><h1 id="beta-title">Tréninky a klub<br/><em>na jednom místě.</em></h1><p className="beta-lead">Naplánujte trénink, domluvte účast a zaznamenejte, jak se vám dařilo. Trenomi spojuje trenéry a členy klubu od prvního pozvání až po zápis do deníku.</p>
     <div className="beta-status"><span className="beta-pill">BETA</span><div><h2>Právě beta testujeme.</h2><p>Aplikaci ladíme s prvními uživateli. Brzy bude k dispozici veřejně.</p></div></div>
     <button className="beta-primary" onClick={onEnter}>Vstup pro betatestery <ArrowRight size={18}/></button><p className="beta-entry-note"><ShieldCheck size={14}/> Přístup pro pozvané členy a trenéry.</p>
    </div>
    <figure className="beta-product"><div className="beta-product-glow"/>
     <div className="beta-app-window" aria-hidden="true"><div className="beta-window-top"><img src="/brand/trenomi-symbol-dark.svg" width="25" height="25" alt=""/><b>Trenomi</b><span>Tvůj sportovní klub</span><Bell size={16}/></div>
      <div className="beta-app-body"><div className="beta-window-label">VŠECHNO ZAČÍNÁ PLÁNEM</div><div className="beta-app-heading"><strong>Týden v klubu</strong><CalendarDays size={20}/></div>
       <div className="beta-week">{['Po','Út','St','Čt','Pá','So','Ne'].map((day,index)=><div className={index===1?'selected':''} key={day}><span>{day}</span><b>{index+12}</b>{[1,3,5].includes(index)&&<i/>}</div>)}</div>
       <div className="beta-example-event"><div className="beta-example-icon"><Dumbbell size={24}/></div><div><small>ÚTERÝ · 18:00</small><strong>Společný trénink</strong><span><MapPin size={12}/> Park · 60 minut</span></div><ArrowRight size={18}/></div>
       <div className="beta-roster-preview"><div><Users size={16}/><strong>Kdo přijde na trénink?</strong></div><p>Členové vědí, kdy a kde se potkáte.</p><div className="beta-example-rsvp"><span><Check size={13}/> Přijdu</span><span>Možná</span><span>Nepřijdu</span></div></div>
       <div className="beta-journal-preview"><div className="beta-journal-icon"><BookOpen size={20}/></div><div><strong>Každý trénink má svůj příběh.</strong><span>Průběh, docházka a fotografie v deníku.</span></div><CheckCheck size={18}/></div>
      </div>
     </div>
     <div className="beta-notification-preview" aria-hidden="true"><div className="beta-notification-icon"><Bell size={19}/></div><div><small>KLUBOVÉ OZNÁMENÍ</small><strong>Trénink začíná v 18:30.</strong><span>Změna času v klubových oznámeních.</span></div></div>
     <figcaption>Ilustrační ukázka kalendáře, účasti a tréninkového deníku.</figcaption>
    </figure>
   </section>
   <section className="beta-features" aria-labelledby="beta-features-title"><div className="beta-section-intro"><span>OD PLÁNU PO SPOLEČNÝ ZÁŽITEK</span><h2 id="beta-features-title">Klubový život má svoje místo.</h2><p>Praktické nástroje pro tréninky i všechno mezi nimi.</p></div><div className="beta-feature-grid">
    <article><div className="beta-feature-number">01 <CalendarDays size={22}/></div><h3>Kalendář, který zná celý klub.</h3><p>Tréninky, závody, místa a opakované termíny. Přehled pro trenéry i členy.</p><span className="beta-feature-detail">Termíny i místa jsou přehledně uložené.</span></article>
    <article><div className="beta-feature-number">02 <Users size={22}/></div><h3>Víte, s kým můžete počítat.</h3><p>Odpovědi na účast, klubové skupiny i ověřená docházka na jednom místě.</p><span className="beta-feature-detail">Přijdu · Možná · Nepřijdu</span></article>
    <article><div className="beta-feature-number">03 <BookOpen size={22}/></div><h3>Na tréninku to nekončí.</h3><p>Zapište průběh, přidejte fotografie a vraťte se k tomu, co máte za sebou.</p><span className="beta-feature-detail">Váš společný tréninkový deník.</span></article>
    <article><div className="beta-feature-number">04 <MessageCircle size={22}/></div><h3>Změny se dostanou k lidem.</h3><p>Klubový chat, konverzace u událostí a upozornění na nové termíny i změny.</p><span className="beta-feature-detail">Domluva přímo u tréninku.</span></article>
   </div></section>
   <section className="beta-bottom-note"><div className="beta-bottom-symbol" aria-hidden="true"><img src="/brand/trenomi-symbol-dark.svg" width="56" height="56" alt=""/></div><div><span>TEĎ TESTUJEME. BRZY OTEVŘEME.</span><h2>První tréninky už běží.<br/>Veřejné spuštění připravujeme.</h2><p>Do té doby je Trenomi dostupné pozvaným uživatelům v rámci beta testu.</p></div><ShieldCheck size={35} aria-hidden="true"/></section>
  </main>
  <footer className="beta-footer"><span>© {new Date().getFullYear()} Trenomi</span><span>Kalendář, účast a deník pro váš klub.</span><a href="#top">Zpět nahoru ↑</a></footer>
 </div>;
}
