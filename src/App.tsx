import { useState } from 'react';

type Session = { id: number; title: string; type: string; place: string; day: string; time: string };
const initial: Session[] = [
  { id: 1, title: 'OCR – překážkový trénink', type: 'OCR', place: 'STG Karviná', day: 'Úterý', time: '18:00' },
  { id: 2, title: 'Kondiční příprava', type: 'Kondice', place: 'Dle domluvy', day: 'Čtvrtek', time: '18:00' },
];

export default function App() {
  const [sessions, setSessions] = useState(initial);
  const [draft, setDraft] = useState('');
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setSessions(list => [...list, { id: Date.now(), title, type: 'Nový trénink', place: 'Nezadáno', day: 'Termín neurčen', time: '—' }]);
    setDraft('');
  };
  return <div className="shell">
    <header><div className="brand">STG <span>COACH</span></div><div className="sub">STG Karviná · Tréninkový přehled</div></header>
    <main>
      <section className="intro"><p className="eyebrow">VÝVOJOVÝ PROTOTYP</p><h1>Tréninky přehledně.<br/>Tým pohromadě.</h1><p>První základ aplikace pro plánování událostí a budoucí evidenci docházky a tréninkového deníku.</p></section>
      <section className="panel"><h2>Tréninky <span className="count">{sessions.length}</span></h2><p className="hint">Ukázkové záznamy – nejsou propojené s kalendářem ani databází.</p>
        {sessions.map(s => <article className="session" key={s.id}><div className="dot"/><div><strong>{s.title}</strong><small>{s.type} · {s.place}</small></div><div className="when">{s.day}<small>{s.time}</small></div></article>)}
        <form onSubmit={e => {e.preventDefault();add();}} className="new"><label htmlFor="newTraining">Přidat ukázkový trénink</label><div className="controls"><input id="newTraining" placeholder="Název tréninku" value={draft} onChange={e => setDraft(e.target.value)}/><button type="submit">Přidat</button></div></form>
      </section>
      <footer>STG Coach · MVP základ · Lokální data pouze v paměti stránky</footer>
    </main>
  </div>;
}
