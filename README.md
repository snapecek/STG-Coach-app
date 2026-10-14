# STG Coach

Mobilní aplikace pro malé sportovní kluby: React, TypeScript, Vite, Tailwind CSS a Supabase. České tmavé rozhraní s oranžovými akcenty. OCR Timer není součástí projektu.

## Spuštění a nasazení

Node.js 22+ (ověřeno na 24), Python 3 pro integrační kontroly.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vývojový server běží na portu 5173. Produkci nasazujte z `dist` na HTTPS. Ve Vercelu: Vite, kořen repozitáře, build `npm run build`, output `dist`, install `npm ci`. Nastavte `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` na veřejný publishable/anon klíč pro příslušné prostředí. Po změně těchto hodnot je nutné nové sestavení (Redeploy). Nikdy nepoužívejte service_role, secret key nebo databázové heslo ve VITE proměnných. Testovací heslo a e-mail nepatří do Vercelu ani do repozitáře.

Založení Supabase, první migrace a přiřazení vlastníka jsou popsané v [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Databáze vyžaduje migrace v pořadí: `202610120001_initial.sql`, `202610130002_club_management.sql`, `202610130003_journal_photos.sql`, `202610130004_race_results.sql`, `202610130005_distinct_races.sql`, `202610130006_member_access.sql`, `202610130007_training_capacity.sql`, `202610130008_freeze_past_reservations.sql`, `202610130009_training_groups.sql`, `202610130010_event_tasks.sql`, `202610130011_training_series.sql`, `202610140012_weekly_goals.sql`. Druhá přidává archivaci, dokončení událostí a retenční úklid; třetí strukturovaný deník a privátní fotografie událostí. Každou migraci aplikujte jen jednou; uživatel potvrdil aplikování všech migrací 001–012; po migraci 012 bylo živě ověřeno načtení trenérem a odmítnutí anonymního přístupu. Již aplikované soubory neopakujte.

## Demo a cloudový klub

Výchozí stránka `/` otevírá přihlášení nebo již přihlášený klub. Původní trenérský prototyp na `/?workspace=demo` byl vyřazen; tato adresa nyní otevře stejnou aktuální aplikaci a odstraní zastaralý parametr z adresy. Dřívější lokální demo data zůstávají v prohlížeči, ale nejsou načítaná ani automaticky importovaná do databáze.

Dřívější adresa `/?workspace=cloud` zůstává podporovaná. Přihlášení e-mailem a heslem používá Supabase Auth. Klub je dostupný pouze po ověření identity a načtení přiřazených rolí. Cloudový režim používá data vybraného klubu, nikdy nesahá po demo datech při chybě. Relace je v sessionStorage; klubová data jsou pouze v paměti stránky. Odhlášení a přepnutí klubu odstraní příslušný klubový prostor. Obnovení tokenu neruší výběr klubu.

### Etapa 1 — dokončené demo

Přehled, registr členů/hostů, hledání, šablony míst a workout plánů, tréninky ze šablon, týdenní opakování, RSVP Jdu/Nejdu/Možná, skutečná docházka, základní souhrn a strukturovaný JSON export, PWA manifest a omezený navigační fallback service workeru.

### Etapa 2 — cloudová evidence

- Správce/trenér přidává členy a hosty bez uživatelského účtu do vybraného klubu.
- Ukládá šablony s místem, délkou a plánem; výběr šablony je součástí formuláře Nová událost → Trénink.
- Vytváří jednorázové nebo 4/8/12 týdenně opakované tréninky jedním atomickým databázovým insertem.
- Čas tréninků používá Europe/Prague, série zachovává místní čas přes změnu letního času. Neexistující jarní čas je odmítnutý; dvojznačný podzimní čas zvolí standardní zimní výskyt.
- Eviduje RSVP a samostatně potvrzuje docházku. Změna jedné hodnoty nepřepisuje druhou. Docházka je rozlišená na neověřeno/přítomen/nepřítomen a ukládá identitu potvrzujícího trenéra.
- Vidí souhrn potvrzené účasti a může exportovat strukturovaný JSON vlastního klubu (`schemaVersion: 4`, UTC časové údaje, časové pásmo, filtry, strukturovaný deník a soukromé reference na fotografie).
- Člen s rolí member vidí jen klubové události a šablony; registr a docházku nečte ani nemění. RSVP v této etapě zapisuje trenér, nejde o samoobslužné přihlašování členů.

Cloudový přehled začíná prázdný. Demo není automaticky importované. Čtení je stránkované, aby větší registr či historie docházky nebyly tiše oříznuté limitem API. Zápisy blokují opakované klepnutí při ukládání; při chybě se nepotvrzuje úspěch. Obnovování dat je ruční. Úpravy a mazání událostí/šablon a archivace členů jsou dostupné. Realtime synchronizace a auditní historie zatím nejsou implementované.

### Etapa 3 — dokončení správy před dalšími moduly

1. Výchozí stránka obnoví přihlášený klub. Odhlášení je pod uživatelským menu; staré demo odkazy vedou do stejné aplikace.
2. Přehled obsahuje nadcházející události a seznam K dokončení; počet aktivních členů byl v další etapě odstraněný. Rychlý start a počty šablon byly odstraněné; Šablony jsou v levé navigaci (na mobilu pod tlačítkem navigace). Hlavní mobilní navigace má Přehled, Kalendář, Členové, Analýza.
3. Měsíční kalendář má pondělí první, přechod mezi měsíci, odlišení tréninků/závodů a zrušených událostí. Klepnutí na datum předvyplní datum nové události. Událost lze vytvořit i bez šablony.
4. Uplynulá událost se zobrazuje K dokončení až po svém konci (čas + délka). Dokončení tréninku vyžaduje uložený skutečný průběh a potvrzenou přítomnost nebo nepřítomnost všech uvedených členů. Závody mají od etapy 6 vlastní pravidla uvedená níže. Kontrolu vynucuje také databázový trigger. Další změna účasti, průběhu, plánu či termínu záznam znovu otevře. Analýza započítává jen dokončené nezrušené události.
5. Odebrání člena vyžaduje potvrzení a přesune jej do archivu. Obnovení zachovává UUID a docházku; archivace účtu s vazbou user_id odebere roli member, obnovení ji vrátí. Staff role se tím nemění. Uchování je nejvýše 3 roky od odebrání; opakované odebrání bez obnovení deadline neprodlužuje. Po limitu jsou osobní údaje a navázaná účast nepřístupné přes RLS a obnova odmítnutá.
6. Denní úklid maže členy a jejich navázanou docházku den před maximálním retenčním limitem. Migrace jej registruje jako pg_cron job `stg-member-retention`. Lokálně byla ověřena funkce, nikoliv běh plánovače Supabase. V SQL Editoru lze zkontrolovat `select jobname, schedule, active from cron.job where jobname = 'stg-member-retention';`. Pokud migrace oznámí nedostupný pg_cron, je před provozem nutné nastavit denní serverové volání `public.purge_expired_members()`; běžný klient jej volat nesmí. Retence zahrnuje data člena a klubovou účast, nikoliv globální účet Auth či již stažené exporty.
7. Trénink/závod lze upravit včetně termínu, zrušit se zachováním historie, obnovit nebo trvale smazat s potvrzením (docházka se smaže kaskádou). Změna/smazání se týká jednoho termínu série. Šablonu lze upravit nebo smazat s potvrzením; existující události mají vlastní snapshot plánu a po smazání šablony zůstanou zachované.

Ověřeno: 39 unit testů, build, živé API kontroly a Chromium workflow na šířce 390px. Prošel návrat do kořenové stránky po přihlášení, archivace/návrat člena, vytvoření a editace šablony, skutečný kalendář, přesun, zrušení/obnovení, dokončení a reload, smazání používané šablony, smazání termínu, závod bez šablony a odhlášení přes menu. Fixtures byly odstraněné. Lokální SQL testy ověřily i expiraci, zákaz návratu po limitu a fyzické odstranění člena/účasti. Živý běh budoucího retenčního jobu zatím nebyl pozorovaný.

### Etapa 4 — deník, fotografie a filtrovaná analýza

- Z přehledu zmizel počet aktivních členů; registr zůstává v záložce Členové.
- Deník v levé navigaci (na mobilu pod nabídkou navigace) zobrazuje probíhající a uplynulé události s vyhledáváním a filtrem dokončení. Otevírá stejný detail jako kalendář, nepoužívá duplicitní záznam.
- Skutečný průběh doplňuje skutečná délka (1–1440 minut), náročnost 1–10 a použité pomůcky. Pomůcky se oddělují čárkami, normalizují a zbavují duplicit (max. 30 × 40 znaků). Délka a náročnost jsou volitelné a nevymýšlejí se z plánu. Jejich uložení znovu otevře dokončený záznam.
- Fotografie jsou v detailu události dostupné jen trenérům/správcům. Podporované jsou JPG, PNG a WebP; vstup max. 16 MB, aplikace překóduje do JPEG, zmenší delší stranu na max. 1920 px a odstraní původní EXIF/GPS i název souboru. Výsledek musí být do 8 MB. Backend vynucuje privátní bucket a limit 20 snímků u události. HEIC/video/SVG nejsou podporované. Fotografie lze otevřít a s potvrzením smazat. Mazání celé události odstraní nejdřív její soubory přes Storage API.
- Analýza filtruje inkluzivní období podle Europe/Prague, druh události, typ tréninku, skutečného účastníka a pomůcku. Zahrnuje jen dokončené nezrušené události. Zaznamenané minuty vycházejí ze skutečné délky; nevyplněná délka se nenahrazuje plánem. Procento účasti má jmenovatel pouze ověřenou docházku. Počty pomůcek se mohou překrývat, protože trénink používá více pomůcek.
- Export zahrnuje aktuálně filtrované události, odpovídající účast/členy, filtry a souhrn, včetně privátních souborových referencí. Neobsahuje samotné fotografie, přístupové tokeny ani veřejné URL. Export má schemaVersion 4; do budoucna tak lze připojit AI analytika bez změny primárních záznamů.

Ověřeno: 54 unit testů a produkční build. Živé API ověřilo strukturovaný deník a opětovné otevření dokončení. Mobilní Chromium test nahrál fiktivní barevný snímek, ověřil autentizované stažení JPEG, zákaz veřejného/anonymního čtení, persistenci po reloadu, 75 skutečných minut, pomůcky/náročnost, filtry a schemaVersion 3 export. Ověřil smazání snímku i celé události a následnou nedostupnost souborů; všechny fixtures byly odstraněné. Lokální PostgreSQL ověřil RLS pro coach/member/anon a dva kluby, neplatné a cizí cesty, zrušenou událost, limit 20 a zákaz mazání události s ponechanou fotografií. Druhý skutečný klubový účet vůči Storage zatím nebyl ověřený. Kontroly odstranění používají čerstvý necachovaný požadavek a ověřují chybu Object not found; starší odpovědi či dříve stažené kopie mohou zůstat v cache prohlížeče/CDN. Aplikace také kontroluje odstranění metadat před potvrzením smazání.

## Oprávnění a bezpečnost

Tabulky clubs, club_roles, members, templates, events a participation mají RLS. Složené cizí klíče zakazují propojit člena či šablonu z jiného klubu. Anonymní role nemá přístup k registru ani dalším klubovým tabulkám. Změny členů/šablon/událostí/účasti povolují pouze owner/coach, role přiděluje owner; zabezpečené obnovení archivovaného člena trenérem může vrátit pouze jeho původní vazbu s rolí member, nikoli zvýšit oprávnění. Klub a první roli vytváří důvěryhodná administrace; veřejné zakládání klubů a registrace jsou vypnuté.

Bucket club-photos je privátní; RLS kontroluje klub, existující událost a roli owner/coach. Člen ani anonym fotografie nečte a nenahrává. Jsou navázané cestou club UUID / event UUID / náhodný UUID.jpg. Aplikace nepublikuje veřejné nebo trvalé podepsané URL, používá autentizované stažení do dočasného blob URL, které při odchodu z galerie ruší. Fyzické mazání probíhá přes Storage API, nikoli SQL. Databáze brání smazat událost, dokud u ní zůstává soubor. Upload zamyká událost a nedovolí připojit snímek k již smazané nebo zrušené události. Změna galerie znovu otevře kontrolu dokončení. Service worker necachuje API data ani tokeny, neposkytuje cloudová data offline. PWA instalace je připravená manifestem, plný offline režim zůstává další etapou.

Do dokončení testů dvou skutečných klubových účtů a Storage používejte výhradně fiktivní údaje. Frontendové filtrování a skrytá tlačítka nejsou náhradou RLS. Export obsahuje údaje členů a patří jen do důvěryhodného úložiště.

## Automatické kontroly

`npm test` — 122 unit testů: opakování, platnost dat, časové pásmo a přechod DST, bezpečná veřejná konfigurace, ověřování identity, filtr club_id a stránkování, omezení rolí, oddělené změny RSVP/docházky, měsíční kalendář, podmínky dokončení, filtrování změn/mazání vybraným klubem, kombinované filtry a výpočty analýzy, bezpečné cesty a typy fotografií. `npm run build` — TypeScript a produkční sestavení.

`npm run test:cloud` — živé API kontroly s fiktivními fixtures: přihlášení, host, šablona, série událostí, RSVP/docházka, reload dat, anonymní přístup a RLS zamítnutí nepřiřazeného klubu, archivace a návrat člena, přesun/zrušení/obnovení a dokončení události, opětovné otevření po změně účasti a smazání používané šablony. Vyžaduje čtyři proměnné VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, STG_TEST_EMAIL, STG_TEST_PASSWORD v prostředí a testovací účet s rolí owner. Hodnoty neukládejte do souborů. Test maže pouze fixtures se svými generovanými UUID a odhlásí testovací relaci. Spouštějte jen proti vývojovému klubu.

`npm run test:ui` — Chromium smoke test na šířce 390px proti spuštěnému Vite na portu 5173. Ověřuje také deník, nahrávání/čtení/mazání soukromých fotografií, analýzu a export; používá výhradně fiktivní obrázky. Vyžaduje stejné testovací proměnné, Python 3 a nainstalované Chromium (`npx playwright install chromium`). V managed prostředí používejte writable cache, např. `PLAYWRIGHT_BROWSERS_PATH=/workspace/stg-validation/browsers`. Testovací relay na 127.0.0.1:8770 používá podporovanou HTTPS proxy a běžné TLS ověřování. Nekonfigurujte vlastní certifikační bypass. Test prochází skutečné UI a Supabase API, kontroluje persistenci po reloadu, mobilní šířku, JS chyby a odhlášení. Vlastní fixtures následně odstraní. Nespouštějte oba zápisové integrační testy zároveň se stejným účtem.

[Databázové testy](supabase/tests/README.md) ověřují izolaci existujících dvou klubů, ochranu vazeb a role member/coach. Lokálně prošly na PostgreSQL 17 s minimální testovací náhradou schémat Auth/Storage. Tento výsledek nenahrazuje živé Supabase testy dvou skutečných účtů ani Storage.

### Výsledek této etapy

Prošly unit testy a produkční build, živé API kontroly a mobilní Chromium workflow: host přetrval po reloadu, šablona vytvořila čtyři termíny, RSVP i skutečná docházka zůstaly samostatně uložené a odhlášení odstranilo klubový prostor. Testovací záznamy byly odstraněné. Databázové RLS kontroly dvou klubů prošly lokálně. Vercel nasazení tohoto nového commitu ověřte až po dokončení jeho deploymentu.

## Další kroky a omezení

Živé ověření izolace dvou účtů/klubů a Storage; pozvánky, reset hesla a MFA; bezpečné samoobslužné RSVP člena; hromadné změny celé série, editace jména člena a auditní historie; strukturální šablony workoutů a více tréninkových skupin; pokročilé grafy a porovnání období; závody, týmy a playlisty; anglické lokalizační slovníky. Český jazyk je výchozí, anglické UI zatím není hotové. Při souběžné změně stejného pole platí poslední úspěšný zápis; optimalistické zamykání není implementované.

### Oprava staré trenérské adresy

`/?workspace=demo` již neotevírá původní rozhraní s Rychlým startem a starými statistikami. Kořenová stránka i tato stará záložka zobrazují stejný klubový dashboard podle skutečné role owner/coach/member. Zpětný odkaz do prototypu byl odstraněný. Přihlášení a RLS zůstávají povinné; stará URL nevytváří trenérská oprávnění. Provozujte pouze fiktivní data až do dokončení zbývajících bezpečnostních kontrol.


## Etapa 5 — výsledky závodů

V detailu závodu trenér nebo správce zapisuje čas HH:MM:SS.mmm, DNF (nedokončil) nebo DNS (nestartoval) a poznámku. Členové i hosté mají jeden výsledek na závod; výsledek lze upravit a po potvrzení odebrat. Klubové pořadí vzniká podle času, shodné časy sdílejí pořadí (1, 1, 3). Oficiální pořadí, kategorie, týmy a minihry budou další etapa. Výsledky nemění skutečnou docházku; po každé změně se událost otevře ke kontrole. Zrušený závod nelze doplňovat. Před změnou závodu na trénink odstraňte výsledky.

Aplikujte jednou migraci `202610130004_race_results.sql`. Výsledky chrání RLS pro staff vlastního klubu, složené vazby odmítají členy z cizího klubu. Výsledky zanikají s událostí nebo při retenčním smazání člena. Export schemaVersion 4 přidává `raceResults` (status, elapsed_ms, notes a identifikátory); týká se jen filtrovaných dokončených událostí. Filtr člena stále vybírá skutečně navštívené události, proto DNS u nepřítomného není v jeho osobním exportu.

Ověření této etapy: 58 unit testů, produkční build a lokální PostgreSQL testy všech čtyř migrací. Testy pokrývají pořadí, čas, shodné výsledky, RLS, meziklubové vazby, nulový čas, DNF/DNS, změnu typu, zrušení a opětovné otevření události. Uživatel potvrdil aplikování čtvrté migrace. Živý mobilní test ověřil zápis času, persistenci po reloadu, změnu na DNF, odebrání výsledku, opětovné otevření dokončeného závodu a export času/poznámky vybraného člena. Anonymní API přístup byl zamítnutý.

Všechny fiktivní testovací členy, události, šablony a fotografie živý test po dokončení uklidil. Vercel nasazení ověřte po dokončení deploymentu posledního commitu.


## Etapa 6 — jednotné UI a samostatná logika závodů

[Srovnání Spond, TeamSnap a Týmuj a produktový směr](docs/PRODUCT_DIRECTION.md) vychází z veřejných popisů funkcí. Převzali jsme vhodné principy: událost se soupiskou, přehled odpovědí a jednoduchý detail. Nejde o testování placených účtů ani kopii jejich grafiky.

- Nová událost začíná volbou **Trénink / Závod**. Trénink používá šablonu, zaměření, plán a týdenní opakování. Závod používá disciplínu (OCR, silniční běh, trail…), délku trasy, registrační HTTPS odkaz, start, časové okno a organizační pokyny. Nemá tréninkovou šablonu, zaměření ani opakování.
- Závod se vytváří s vybranými členy nebo hosty. Jedna transakční RPC uloží závod i soupisku, případná chyba vrátí celý zápis. Závod nemá automaticky docházku celého klubu. V detailu lze dalšího člena přidat nebo po potvrzení odebrat. S uloženým výsledkem jej nelze odebrat ze soupisky, dokud neodeberete výsledek.
- Detail má záložky **Informace / Účast / Deník** pro trénink a **Informace / Účast / Výsledky** pro závod. Formulář i galerie používají stejný systém prvků. Poznámky závodu a fotografie jsou volitelné; délka skutečného tréninku, náročnost a pomůcky se u závodu nezadávají.
- Závod lze dokončit po uplynutí časového okna, když má každý uvedený závodník ověřenou účast a výsledek. Dokončil/DNF vyžaduje přítomnost; DNS nepřítomnost. Nemusí mít tréninkový deník. Pravidla kontroluje také server, změna výsledku nebo soupisky znovu otevírá kontrolu.
- Přehled má grafickou kartu dne, události s datem a souhrnem RSVP a konkrétní úkoly k dokončení. Kalendář filtruje tréninky/závody; výběr dne otevře jeho program a umožní přidat událost na vybrané datum. Formulář při změně šablony nebo druhu zachová název/místo (šablona je může nahradit) a zvolený datum/čas.
- Analýza odděluje závody od zaměření tréninků. Minuty tréninku a pomůcky zahrnují jen tréninky. Starší závodní záznamy zůstávají v datech, ale nepředstírají tréninkové zaměření; nové údaje trasy a registrace exportuje schemaVersion 4.

Migrace `202610130005_distinct_races.sql` musí být aplikovaná po předchozích čtyřech. Uživatel potvrdil její aplikování. Existující závody znovu otevře ke kontrole, odstraní vazbu na tréninkovou šablonu a ze stávajících výsledků doplní chybějící záznamy soupisky. Poznámky, docházku, výsledky a historické strukturované údaje nemaže.

Ověřeno: 67 unit testů, produkční build, lokální PostgreSQL testy pěti migrací a všech pěti SQL sad, živé Supabase API kontroly a mobilní Chromium workflow. Mobilní test ověřil transakční závod s jediným vybraným hostem, absenci tréninkových polí, dokončení bez deníku, reload, export disciplíny/trasy/odkazu a výsledku, DNF/DNS a opětovné otevření. Vlastní fixtures byly odstraněné. Grafika byla samostatně ověřená s čistě fiktivními daty; kalendář nepřetéká při šířkách 360, 390, 768 a 1440 px.

Omezení: RSVP stále zapisuje trenér. Pozvánky/notifikace, skutečné samoobslužné RSVP, podskupiny, oficiální výsledkové kategorie, hromadné změny série a zámek při souběžných změnách nejsou součástí této etapy. Časové okno je 5–480 minut; vícedenní závod zatím potřebuje rozšíření modelu termínů. Následující ucelená etapa je bezpečný členský postup pozvánka → přihlášení → Jdu/Nejdu/Možná.


## Etapa 7 — členský účet, pozvánky a vlastní RSVP

Trenér v registru přes **Pozvat účet** zadá e-mail člena nebo hosta. Pozvánka propojí potvrzený účet se stejným členským ID a historií. Platí 7 dní, je jednorázová a nová pozvánka ruší předchozí. Lze ji odvolat. Účet s jiným e-mailem, neověřený účet, expirovaná/odvolaná pozvánka nebo archivovaný člen se nepřipojí. Další záznam téhož účtu v klubu nelze bez rozhodnutí trenéra sloučit.

Nový Auth účet nastaví heslo; existující účet dostane přihlašovací odkaz. Přijetí klubové pozvánky je samostatný krok po ověření účtu. Auth tokeny a klubový token aplikace odstraní z URL ještě před načítáním klubových dat. Relace i rozpracované přijetí jsou v sessionStorage; nastavení hesla vydrží obnovení stránky. Obsah stránky používá no-referrer. Z uživatelského menu lze změnit heslo; přihlášení obsahuje obnovu hesla s obecnou odpovědí bez potvrzování existence e-mailu.

Účet s rolí **member** má vlastní přehled a kalendář: tréninky klubu a pouze závody, na které jej zařadil trenér. Odpovídá **Jdu / Nejdu / Možná** jedním klepnutím. Po startu nebo zrušení události se odpovědi uzavřou. Databáze při zápisu odvodí jeho member_id z ověřeného Auth účtu; nepřijímá member_id ani attended od klienta. Potvrzenou docházku může člen číst jen vlastní a mění ji dál trenér. Ostatní členové, pozvánky, fotografie, výsledky a celý registr zůstávají staff only. Owner/coach si při přijetí pozvánky zachovají vyšší roli; jejich účet se automaticky nezmění na členský pohled.

**Nasazení:** šestá migrace byla aplikovaná a živé RPC testy prošly. Pro odesílání e-mailů je navíc potřeba Edge Function **invite-member**, Auth redirect URL a SMTP podle [docs/MEMBER_ACCESS_SETUP.md](docs/MEMBER_ACCESS_SETUP.md). Při poslední kontrole endpoint funkce vracel 404; nasazení a skutečné doručení zatím nebylo potvrzené. Příjemce nových Auth pozvánek otestujte vlastním zvoleným e-mailem až po nastavení. Service role klíč patří jen do serverové funkce; veřejné registrace zůstávají vypnuté.

**Ověření:** 81 unit testů a produkční build; Deno 2.5.0 `check` pro nasazovanou funkci; lokální PostgreSQL všech šesti migrací a šesti SQL sad; živý členský RPC test s jedním existujícím ověřeným owner účtem (bez e-mailů a bez změny hesla), který ověřil stabilní identitu, jednorázovost, zachování role a potvrzené docházky, závodní soupisku a uzavření RSVP. Fixtures byly odstraněné. Dosavadní živý mobilní trenérský workflow prošel. Členský mobilní workflow má samostatné testy s fiktivním Auth/API, včetně přijetí pozvánky, hesla, refresh, zamítnutí a odvolání; nejde o potvrzení skutečného e-mailového doručení nebo test dvou reálných účtů.

- `npm run test:member-ui`: vyžaduje běžící Vite a Chromium; používá pouze fiktivní síťové odpovědi, nic neposílá do skutečné databáze nebo e-mailu.
- `npm run test:member-cloud`: opt-in stejné čtyři testovací proměnné jako test:cloud. Neposílá e-maily a nemění Auth heslo; vytváří a uklízí jen vlastní fiktivní DB fixtures. Existující členský záznam testovacího účtu nikdy nepřepíše. Nespouštějte zápisové integrační testy současně se stejným účtem.
- Edge check: `DENO_DIR=/workspace/stg-validation/deno DENO_CERT=/etc/ssl/certs/ca-certificates.crt npm exec --cache /workspace/.npm-cache --yes --package deno@2.5.0 -- deno check supabase/functions/invite-member/index.ts`. Zachovejte běžné ověřování TLS; v prostředí s jinými CA použijte jeho důvěryhodný systémový bundle.

Další ucelená etapa: podskupiny, kapacita a čekací listina; až po ověření poštovního provozu připomínky s přehledem doručení. Skutečné doručení/reset a izolace dvou reálných členských účtů zůstávají provozními kontrolami této etapy.

## Etapa 8 — kapacita tréninků a čekací listina

Trenér při vytvoření nebo úpravě tréninku zadá počet míst (1–500), nebo ponechá kapacitu bez omezení. Opakované termíny mají každý vlastní kapacitu a pořadí. Nad limit „Jdu“ znamená čekací listinu, nikoliv potvrzené místo. Odhlášení, odstranění přihlášení a archivace člena uvolní místo prvnímu čekajícímu; návrat do přihlášení patří na konec pořadí. Opakované Jdu ani změna skutečné docházky pořadí nemění. Přesun ani RSVP nepotvrzují skutečnou přítomnost.

Karty trenéra odlišují počet potvrzených míst a čekajících, detail ukazuje stav u člena. Členské rozhraní zřetelně ukazuje čekací listinu nebo potvrzené místo a obnovuje pouze vlastní přihlášení každých 30 sekund na viditelné stránce; celé události se obnoví tlačítkem Obnovit data. Zvýšení kapacity povýší čekající, snížení pod potvrzená místa databáze odmítne. Po zahájení je kapacita uzavřená. Rezervace proběhlých událostí se nepřepočítávají při retenčním mazání historických členů.

**Databáze:** jednou aplikujte migraci `202610130007_training_capacity.sql` a následně `202610130008_freeze_past_reservations.sql`. Druhá doplňuje ochranu historických rezervací a dokončených deníků při retenčním mazání. Již aplikované migrace neopakujte. [Postup](docs/TRAINING_CAPACITY_SETUP.md). Interní přepočítávací funkce nemají veřejné RPC oprávnění, limity platí také při zápisu trenérem a současných požadavcích. Přístup člena nadále vrací jen jeho vlastní údaje; anon nic nemění.

**Ověření:** 84 unit testů, TypeScript/build, všech osm migrací a sedm SQL sad na PostgreSQL 17; test dvou konkurenčních transakcí na poslední místo. `npm run test:database` vytvoří izolovaný dočasný Docker kontejner a odstraní jej, nepoužívá produkční údaje. `npm run test:capacity-cloud` ověřuje Supabase rezervace na vlastních fiktivních fixtures, dvě souběžná přihlášení, povýšení, změny limitu, archivaci a nezměněnou docházku; vyžaduje stejné testovací proměnné jako ostatní opt-in cloud testy a fixtures odstraní. Živý test vlastní členské RPC navíc potvrdil vrácení čekacího stavu při plné kapacitě a zachování docházky (jeden existující owner účet, bez e-mailů či změny hesla). Mobilní test s fiktivním API kontroluje členský i trenérský stav čekání, formulář kapacity a přetrvání po reloadu. Dosavadní živý trenérský workflow včetně fotografií, deníku, závodů a exportu prošel.

**Omezení a další kroky:** kapacita platí pro tréninky, závod má samostatnou soupisku a registraci u pořadatele. Přesuny neposílají e-mail/push; nastavení e-mailových pozvánek z etapy 7 je stále samostatným krokem. Podskupiny a výběr skupiny pro trénink jsou další vývojová etapa. V této etapě nevzniká skupinová soupiska: trénink má dosavadní klubovou docházku. Export zachovává schemaVersion 4 a doplňuje volitelnou kapacitu/rezervační stav; skutečná docházka zůstává rozhodující pro analýzu.

## Etapa 9 — tréninkové skupiny a uložené soupisky

- **Skupiny** jsou v levé nabídce; na mobilu přes tlačítko menu vedle nadpisu. Hlavní mobilní navigace stále obsahuje pouze Přehled, Kalendář, Členové a Analýza.
- Trenér vytváří a upravuje skupiny s názvem, popisem a výběrem aktivních členů/hostů. Hledání pomáhá v delším registru. Jeden člen může být v několika skupinách. Prázdnou skupinu lze uložit a doplnit později.
- Z karty skupiny lze naplánovat trénink; skupina je předvybraná. Při běžném vytváření lze zvolit Celý klub nebo skupinu, zároveň použít šablonu, kapacitu a týdenní opakování. Server vytvoří všechny termíny a jejich soupisky v jedné transakci. Prázdná nebo archivovaná skupina nemůže vytvořit trénink.
- Každý termín má vlastní soupisku a snímek názvu skupiny. Přejmenování nebo výměna členů skupiny existující termíny nepřepíše. Archivovaní/expirující členové se do nové soupisky nezařadí; jejich dosavadní účast zůstává v historii do retenčního mazání.
- V detailu → Účast trenér jednotlivce výslovně přidá či odebere s potvrzením. Úprava se týká jednoho termínu, nikoliv celé skupiny nebo série. Dokončení vyžaduje průběh a skutečnou docházku jen uvedených účastníků. Tréninky pro celý klub si zachovávají původní pravidla. Skupinový trénink nelze přepnout na závod; závod má samostatný postup.
- Archivace skupiny vyžaduje potvrzení, odstraní ji z nového plánování a zachová existující události. Obnovení vrátí skupinu se zachovaným výběrem členů. Aplikace nenabízí trvalé smazání skupiny.
- RLS omezuje členské čtení skupinových tréninků a závodů na vlastní soupisku. Registr skupin a jiných členů zůstává pouze trenérovi/správci příslušného klubu. Vlastní RSVP odmítne pokus vstoupit do jiné soupisky také přes přímou RPC. Fotografie mají dosavadní soukromá oprávnění.
- Karty/detail zobrazují uložený název skupiny; JSON export obsahuje `source_group_id`, `group_name` a `roster_only` jako doplňující pole schemaVersion 4. Neexportuje se aktuální seznam skupiny jako náhrada historické soupisky.

**Databáze:** `202610130009_training_groups.sql`, aplikovaná uživatelem; neopakovat. [Postup použití](docs/TRAINING_GROUPS_SETUP.md).

**Ověření:** 92 unit testů a produkční build; devět migrací a osm SQL sad včetně konkurenčních rezervací. SQL ověřuje stejné/cizí kluby, členské čtení, přímou RPC, stabilní snímek soupisky, atomické odmítnutí chybné série, prázdnou skupinu, archivaci a vybranou docházku. Mobilní test s fiktivním Auth/API prochází založení, hledání členů, čtyři termíny, výměnu členů, ruční přidání/odebrání účastníka, archivaci/obnovu a reload; rozložení ověřeno na 360/390/1440 px. `npm run test:groups-ui` navíc prošel proti živému Supabase s existujícím owner účtem a výhradně fiktivními fixtures: šablona, série, kapacita a přesun z čekání, samostatná docházka, zachování názvu/soupisky po editaci skupiny, dokončení pouze vybraných účastníků, archivace a obnova. Dosavadní živý mobilní trenérský workflow prošel také pro šablony, kalendář, archivaci členů, soukromé fotografie, deník, výsledky závodů a export. Nejde o test dvou skutečných Auth účtů.

**Úklid integračního testu:** vlastní vygenerované členy, šablony a události smaže; členství skupiny zmizí kaskádou. Prázdná fiktivní metadata skupiny zůstávají v archivu, protože role staff nemá DELETE na training_groups. Test jejich archivaci a prázdné členství výslovně kontroluje. Neodstraňuje žádná cizí data. Zápisové cloud/UI testy spouštějte postupně se stejným účtem, při běžícím Vite na portu 5173 a se stejnými čtyřmi proměnnými prostředí jako ostatní testy; skript neposílá e-maily ani nemění hesla.

**Omezení a další kroky:** přesuny osob a změny skupiny nejsou zpětně aplikované do naplánovaných soupisek. Členské přihlášení se obnovuje po 30 sekundách na viditelné stránce; nové události/nově přiřazenou soupisku načtěte pomocí Obnovit data. Automatická oznámení, audit změn a hromadné změny série zatím nejsou implementované. Další ucelená etapa: organizační úkoly u události a návazná upozornění. E-mailové pozvánky stále vyžadují samostatné provozní nastavení dle MEMBER_ACCESS_SETUP.md.

### Zobrazení hesla

Přihlášení, nové heslo i potvrzení hesla mají vlastní přepínač s ikonou oka. Výchozí stav je skrytý; přepnutí zachovává hodnotu a neodesílá formulář. Ovládání podporuje klávesnici a přístupný název/stav. Ověřeno prohlížečovým testem s fiktivním Auth/API, bez změn skutečných hesel či e-mailů.

## Etapa 10 — organizační úkoly

Detail tréninku i závodu má záložku **Úkoly**. Trenér přidá název, odpovědnou osobu (nebo bez přiřazení) a volitelný termín v Europe/Prague; údaje může upravit, stav označit jako hotový/znovu otevřený a úkol smazat s potvrzením. U vybrané soupisky se nově přiřazuje jen jejím aktivním účastníkům. Host bez účtu může být odpovědnou osobou, jeho stav zaznamená trenér. Limit je 100 úkolů na událost, vynucený pod zámkem události i pro současné zápisy. U zrušené události jsou změny uzavřené; při obnovení se úkoly zpřístupní.

Trenérský přehled má otevřené organizační úkoly nezrušených událostí, řazené podle termínu, nejvýše osm s odkazem do detailu. Z úkolu otevře rovnou záložku Úkoly. Člen má přehled vlastních úkolů a jejich stav v detailu události. Členská RPC vrací jen vlastní názvy/termíny/stavy a odvozuje oprávnění z ověřeného účtu a přístupu k události; nelze změnit přiřazení, text, termín nebo cizí úkol. Registr úkolů přímo zůstává staff-only. Stav dokončení a potvrzující účet stanoví server.

Úkoly neblokují deník, nevstupují do skutečné docházky ani znovu neotevírají dokončený trénink. Úprava údajů zachovává stav úkolu, otevření je výslovná akce. Smazání události smaže úkoly kaskádou. Při retenčním smazání člena se přiřazení odstraní; tento úklid funguje také u zrušených událostí. Export schemaVersion 4 doplňuje `eventTasks` pouze vybraných událostí a při filtru člena jen jeho přiřazené úkoly.

**Databáze:** migrace `202610130010_event_tasks.sql` aplikovaná uživatelem; neopakovat. [Postup](docs/EVENT_TASKS_SETUP.md).

**Ověření:** 98 unit testů a produkční build; všech deset migrací a devět lokálních SQL sad plus konkurenční rezervace. SQL úkolů ověřuje vlastní/cizí/anon oprávnění, znovuotevření, vybranou soupisku, limit, archivovaného člena a retenční odstranění přiřazení u zrušené události. Prohlížečový test s fiktivním Auth/API ověřil vytvoření/přiřazení/dokončení/smazání trenérem a vlastní úkol člena po reloadu; neposílá e-maily nebo hesla do skutečné Auth. Živé opt-in testy `test:ui` a `test:member-cloud` prošly: vlastní fiktivní úkoly, zachování dokončeného deníku, vlastní RPC čtení/dokončení, přetrvání stavu a kaskádový úklid. Jejich události, členové, šablony a fotografie byly odstraněné. Testy zápisu spouštějte postupně. Docker runner čeká na finální TCP server po inicializaci databáze, nikoliv na dočasný bootstrap socket.

**Omezení a další kroky:** synchronizace úkolů mezi zařízeními je ruční přes Obnovit data, automatické e-mail/push notifikace a audit změn nejsou implementované. Člen musí mít propojený ověřený účet; pozvánky nadále vyžadují samostatné nasazení senderu/SMTP. Nejde o potvrzení dvou skutečných Auth identit ani doručování pošty. Další ucelená etapa může navázat upozorněními a přehledem jejich doručení, případně organizací týmů a výsledků.

Přehled organizačních úkolů u každé položky výslovně uvádí událost včetně jejího termínu, odpovědnou osobu a případný termín úkolu. Nepřiřazený úkol je označený Bez přiřazení; archivovaná osoba zůstává rozpoznatelná a chybějící osobu nenahrazujeme jiným členem.


## Etapa 11 — správa opakovaných tréninků

Nové opakované tréninky mají společný identifikátor série, také při vytvoření pro skupinu. Celá série vzniká v jedné transakci. V detailu tréninku → Informace → Spravovat sérii lze posunout datum a čas, zrušit nebo obnovit budoucí termíny. Náhled ukazuje dotčené termíny a původní/nové časy v Praze; uložení vyžaduje potvrzení, které další změna náhledu zruší. Přesun zachová rozestupy jednotlivých termínů i místní čas přes změnu letního času.

Server mění pouze budoucí, nedokončené termíny příslušného stavu a klubu. Proběhlé tréninky, soupisky, RSVP, docházka, deník, fotografie a úkoly zůstávají zachované. Pokud se náhled změnil nebo termín mezitím začal, celá operace se odmítne bez částečného zápisu. Přístup mají pouze trenéři a správci vlastního klubu; závody tuto logiku nepoužívají.

Migraci `202610130011_training_series.sql` uživatel potvrdil jako aplikovanou; neopakovat. [Postup a omezení](docs/TRAINING_SERIES_SETUP.md). Starší termíny se automaticky nepropojují podle názvu a nadále se upravují jednotlivě. Termíny organizačních úkolů se neposouvají a změny neposílají automatická upozornění. Export schemaVersion 4 obsahuje volitelný `series_id`.

Ověření: 103 unit testů, produkční build, jedenáct migrací a deset lokálních SQL sad včetně konkurenčních rezervací. SQL ověřuje ochranu historie, izolaci klubů/rolí, zastaralý náhled a transakční návrat při chybě. Mobilní test s fiktivním API ověřuje skupinovou sérii a zrušení potvrzení po změně náhledu. Živý mobilní test proti Supabase ověřuje přesun, zrušení a obnovení čtyř fiktivních termínů; fixtures byly odstraněné. První běh skončil timeoutem při vytvoření závodu; opakovaný úplný běh prošel včetně závodů, deníku, soukromých fotografií a úklidu. Další etapa může navázat přehledem změn a oznámeními, včetně samostatného ověření doručování.


### Výběr opakování tréninku

Formulář Nová událost → Trénink nabízí Jednorázově, Týdně (volitelný počet 1–12 týdnů od prvního data) a Vybrat termíny v měsíci. Ruční režim zobrazí měsíční kalendář od pondělí; klepnutím vyberte 1–12 libovolných dnů. Změna měsíce vyčistí výběr. Přehled před uložením ukazuje skutečné termíny a čas v Praze; všechny termíny používají stejný čas a údaje tréninku. Ruční výběr funguje pro celý klub i skupinu, ukládá se jednou transakční RPC a více termínů tvoří spravovatelnou sérii. Závody zůstávají samostatné. Nevyžaduje další migraci nad aplikovanou 011.

Ověření: 108 unit testů, produkční build a mobilní prohlížečové kontroly s fiktivním API, včetně přesných nepravidelných dat skupinové série a její následné správy. Regrese pokrývá prázdný výběr, duplicity, jiný měsíc, neexistující datum a převod přes změnu času. V této úpravě nebyly spouštěny další zápisy do živého Supabase ani měněno schéma. Omezení: nejvýše 12 termínů v jedné sérii, společný čas; jednotlivé časy lze následně upravit v detailu termínu. Další možné rozšíření: vlastní čas pro každý ručně vybraný den.


### Kopírování událostí bez šablony

Trenér/správce v detailu → Informace → Zkopírovat otevře nový předvyplněný formulář. Kopie přebírá název, místo, zaměření/disciplinu, plán/pokyny, délku, pražský čas, kapacitu a případné údaje závodu. Datum začíná dnešním dnem a lze je změnit; opakování začíná jednorázově a lze zvolit týdny nebo ruční měsíční termíny. Kopie není závislá na existenci šablony a vzniká standardní transakční RPC s novým ID a případně novou sérií. Originál se nemění. Docházka, RSVP, deník, fotografie, výsledky, úkoly a stav dokončení se nepřenášejí.

U skupinového tréninku je předvolená dosud aktivní zdrojová skupina; účastníci vycházejí z jejího aktuálního seznamu, nikoliv z historických ručních úprav soupisky. Pokud skupina není dostupná, formulář vybírá celý klub a upozorní na kontrolu účastníků. Kopie závodu předvolí původní dosud aktivní účastníky; seznam lze změnit a bez účastníka nelze závod vytvořit. Nevyžaduje novou migraci.

Ověření: 108 unit testů, produkční build a mobilní test s fiktivním API pro předvyplnění, úpravu názvu/data, nové ID, samostatný termín a čistou docházku při zachování originálu. V této úpravě se nezapisovalo do živé databáze.


## Etapa 12 — trenérský přehled podle dodaného návrhu

Nový přehled používá grafitové plochy, jantarové hlavní akce, sjednocené karty a horizontální desktopovou navigaci. Mobilní navigace zůstává Přehled, Kalendář, Členové, Analýza. Původní dekorativní hero a samostatná trojice karet byly nahrazené jedním přehledem; nevzniká druhá evidence docházky ani druhý formulář události. Původní správa sérií, kopírování, šablony, deník a úkoly zůstávají dostupné.

- První nejbližší událost má přímé Otevřít docházku. Druhá ukazuje rozložení odpovědí, čekací listinu a jména bez odpovědi. Zkopírovat připomenutí připraví obecný text události do schránky, neposílá zprávy; při nedostupné schránce zobrazí text k ručnímu kopírování.
- Týdenní plán od pondělí v Europe/Prague ukazuje skutečné tréninky i samostatně rozlišené závody. Každý termín otevře stávající detail, Otevřít kalendář přepne stávající kalendář. Na telefonu je týden vodorovně posuvný.
- Osm týdnů docházky zahrnuje aktuální týden a předchozích sedm; počítá pouze ověřené záznamy proběhlých nezrušených tréninků. RSVP není docházka, neověřená účast není absence. Bez dat je pomlčka. Změna v procentních bodech porovnává poslední čtyři týdny s předchozími čtyřmi a zobrazí se jen při datech v obou obdobích. Pravidelnost aktivních členů ukazuje současně poměr přítomností/ověřených záznamů; hosté v pořadí nejsou.
- Vyžaduje pozornost otevírá účast u událostí příštích sedmi dnů bez odpovědí. Delší absence vyžaduje doloženou přítomnost starší 21 dnů a alespoň jednu ověřenou absenci za posledních 21 dnů. K dokončení zůstává jediným seznamem neuzavřených proběhlých událostí; organizační úkoly zachovávají konkrétní událost, osobu a termín.
- Objem týdne počítá délku dokončených tréninků podle typu; přednost má skutečná délka, jinak plánovaná. Nastavit týdenní cíle uloží společné klubové cíle v hodinách pro nejvýše 12 typů. Úpravy platí pro další zobrazení aktuálního týdne, nejsou historickými verzemi cílů. Závody se do objemu ani pravidelnosti tréninků nemíchají. Bez nastaveného cíle se zobrazí skutečný objem, nikoliv vymyšlený limit.

Týdenní cíle vyžadují jednorázové spuštění [migrace 012](supabase/migrations/202610140012_weekly_goals.sql); starší migrace neopakujte. Bez ní fungují ostatní panely, u cílů je vysvětlení a ukládání je vypnuté. Tabulku a transakční RPC chrání RLS pouze pro trenéra/správce vlastního klubu. Načtení cílů probíhá při otevření přehledu, tedy také po Obnovit data; nejde o realtime synchronizaci. Schéma exportu událostí zůstává verze 4; klubové cíle nejsou součástí osobních exportů.

Ověření: 116 unit testů, TypeScript/produkční build, všech 12 migrací a 11 SQL sad v izolovaném PostgreSQL 17 včetně konkurenčních rezervací. SQL cílů ověřuje vlastní/cizí klub, member/anon, duplicity, neplatnou hodnotu a návrat celé změny při chybě. Fiktivní prohlížečový scénář ověřuje cíle a reload, kopírování bez odesílání, otevření správné záložky docházky a rozložení na 390/1440 px, dále dosavadní RSVP, úkoly, kopie a série. Screenshoty jsou pouze z fiktivních dat. Pro tuto etapu nebyly měněny skutečné členské záznamy ani odeslané zprávy. Další krok: ověřit načtení cílů po potvrzení migrace, následně navázat bezpečné doručování oznámení a evidenci jejich doručení.


## Etapa 13 — plánování, zavírání oken a skutečná e-mailová připomenutí

Kalendář nabízí Měsíc, Týden a Seznam se společnými filtry a stejným detailem události. V týdnu se posouvá o sedm dnů; v měsíci/seznamu o měsíc. Karty ukazují potvrzenou účast a případnou kapacitu; čekací listina není započítaná jako potvrzené místo. Na desktopu od 1150 px se nový/upravovaný/kopírovaný trénink otevře v pravém panelu vedle čitelného kalendáře. Menší obrazovky zachovávají dialog a přizpůsobený týden. Původní tmavé a jantarové barevné schéma zůstává. Opakování i ruční termíny jsou nadále ve stejném formuláři; samostatná logika závodů se nemění.

Po úspěšné změně události, vytvoření/kopii, hromadné změně série, uložení průběhu nebo dokončení události se zavře celé okno a potvrzení zůstane na hlavní stránce. Chyba okno nezavře. Jednotlivé změny RSVP/docházky a práce s fotografiemi či úkoly okno nezavírají, aby bylo možné dokončit více položek. Nabídka Můj účet se zavírá kliknutím mimo ni i klávesou Escape.

Původní Zkopírovat připomenutí bylo nahrazené Připomenout e-mailem: náhled počtu příjemců, potvrzení odeslání a souhrn přijetí/selhání/vynechaných členů bez ověřeného e-mailu. Backend ověřuje přihlášení, roli, klub, budoucí nezrušenou událost, uloženou soupisku a chybějící odpověď; e-maily načítá pouze server z ověřených propojených účtů Auth. Obsah ani adresy nepřebírá z prohlížeče. Opakované pokusy používají klíč idempotence poskytovatele pro člena/událost/den v Praze. Nejde o automatický plánovač. Nová SQL migrace není potřeba.

**E-mailová připomenutí jsou na přání uživatele odložená na další upgrade.** Ve výchozím rozhraní jsou vypnutá, nevolá se odesílací služba. Aktivace později vyžaduje `VITE_EVENT_REMINDERS_ENABLED=true` ve Vercelu a nové nasazení po nastavení služby. **Provozní návod pro pozdější upgrade:** [nasazení remind-event a Resend](docs/EVENT_REMINDERS_SETUP.md). SMTP přihlašovacích e-mailů v Supabase tuto službu nenahrazuje. Při pozdější aktivaci bez nasazení a klíčů rozhraní vysvětlí nedostupnost, nepředstírá odeslání. Přijetí poskytovatelem není potvrzení doručení; aplikace zatím nesleduje webhooky/bounce ani historii odesílání. Host bez propojeného ověřeného e-mailu je přeskočený. Podporováno nejvýše 100 e-mailových příjemců na požadavek, registr do 500 osob; další limity popisuje provozní návod.

Ověření: 122 unit testů, produkční sestavení a fiktivní mobilní workflow pro náhled a výslovné odeslání, zavření nabídky kliknutím mimo, změny a dokončení se zavřením okna, všechny tři kalendáře a desktopový panel. Handler testy ověřují zakázaný původ, roli, chybějící konfiguraci, soukromí adres, výběr soupisky, stálý klíč při opakování a chybu poskytovatele. Syntaxe obou Edge souborů ověřena přes TypeScript transformaci; skutečný běh v Deno a doručení zůstanou k provoznímu ověření po nasazení. Testy neposílají zprávy skutečným členům. SQL schéma se nemění, databázové sady se proto v této etapě neopakovaly. Opt-in živé UI scénáře byly přizpůsobeny zavírání oken; jejich spuštění a úklid se zaznamenají níže. Další krok: dokončit základní funkčnost aplikace. Při pozdějším upgradu nasadit poštovní funkci, nastavit ověřenou doménu a ověřit doručení na výslovně určenou vlastní testovací adresu.

Živý opt-in `test:ui` prošel včetně úpravy a dokončení se zavřením okna, sérií, deníku, soukromých fotografií, závodů, DNF/DNS, exportu a odhlášení; všechny vlastní fiktivní události, členové, šablony, úkoly a fotografie byly odstraněné. První běh skončil timeoutem v závodovém DNF kroku během probíhajících změn Vite; opakovaný běh bez dalších změn aplikace prošel celý. Nikomu nebyl odeslán skutečný e-mail. Rozšířený fiktivní scénář navíc ověřuje, že při výchozím vypnutí připomenutí neproběhne žádné volání poštovní funkce. Nastavování e-mailů se do dokončení základní aplikace nevyžaduje.

### Úprava plánování a umístění skupin

Při vytváření, úpravě a kopírování události v kalendáři je pozadí ostré a průhledné ve všech šířkách, nikoliv pouze od 1150 px. Od 900 px se formulář zobrazí vedle zúženého kalendáře; menší zařízení používají dialog bez rozmazání. Barevné schéma se nemění.

Skupiny jsou v Členové → Skupiny, vedle záložky Členové a hosté. Nemají samostatnou položku v hlavní navigaci. Hlavní akce se mění na Přidat člena / Přidat skupinu podle záložky; archivace, obnova, výběr členů a plánování ze skupiny zůstávají stejné. Jde o změnu umístění, nikoliv dat či oprávnění.

Ověření: 122 unit testů a produkční build; fiktivní prohlížečový scénář kontroluje vnořenou navigaci, celý workflow skupin a ostré pozadí (`backdrop-filter: none`) bez přetečení na 1024/1440 px. Úprava nevyžaduje SQL ani zapnutí e-mailových připomenutí. Živé zápisové scénáře se pro tuto změnu navigace/CSS neopakovaly.
