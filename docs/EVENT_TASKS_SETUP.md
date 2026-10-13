# Organizační úkoly událostí

V Supabase → SQL Editor jednou spusťte celý obsah [202610130010_event_tasks.sql](../supabase/migrations/202610130010_event_tasks.sql). Migrace 001–009 neopakujte.

V detailu tréninku nebo závodu otevřete **Úkoly → Přidat úkol**. Zadejte název, případně odpovědnou osobu a termín. Úkol může zůstat bez přiřazení pro trenéra. Host bez účtu může být uveden jako odpovědná osoba; stav za něj zaznamená trenér. U skupinového tréninku nebo závodu musí být osoba na soupisce.

Člen vidí jen vlastní úkoly u událostí, ke kterým má přístup, a může je dokončit či znovu otevřít. Nemůže měnit název, přiřazení, termín ani úkoly jiných osob. Trenér úkoly upravuje a maže s potvrzením. Limit je 100 úkolů na událost. U zrušené události jsou změny uzavřené; po obnovení se úkoly opět zpřístupní.

Úkoly nepřepisují docházku, neblokují dokončení deníku a jeho dokončení znovu neotevírají. Přehled ukazuje otevřené úkoly nezrušených událostí; úplný seznam je v detailu. Termíny používají Europe/Prague. Export doplňuje organizační úkoly vybraných událostí. Smazání události smaže její úkoly, retenční smazání člena odstraní přiřazení a zachová úkol bez osobních údajů člena.

Oznámení e-mailem a push nejsou zatím implementované. Obnovte data pro změny z jiného zařízení. Odesílání členských pozvánek je samostatně v MEMBER_ACCESS_SETUP.md.
