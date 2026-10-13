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

Založení Supabase, první migrace a přiřazení vlastníka jsou popsané v [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Pro tuto etapu není nutná nová databázová migrace, pokud již byla aplikována `202610120001_initial.sql`. Migraci ručně neopakujte.

## Demo a cloudový klub

Výchozí stránka `/` je fiktivní demo. Ukládá stav do localStorage `stg-fictional-demo-v1`, nic neposílá do databáze. Smazáním položky obnovíte demo. Do dema nevkládejte skutečné osobní údaje.

Tlačítko **Přihlásit se** otevře `/?workspace=cloud`. Přihlášení e-mailem a heslem používá Supabase Auth. Klub je dostupný pouze po ověření identity a načtení přiřazených rolí. Cloudový režim používá data vybraného klubu, nikdy nesahá po demo datech při chybě. Relace je v sessionStorage; klubová data jsou pouze v paměti stránky. Odhlášení a přepnutí klubu odstraní příslušný klubový prostor. Obnovení tokenu neruší výběr klubu.

### Etapa 1 — dokončené demo

Přehled, registr členů/hostů, hledání, šablony míst a workout plánů, tréninky ze šablon, týdenní opakování, RSVP Jdu/Nejdu/Možná, skutečná docházka, základní souhrn a strukturovaný JSON export, PWA manifest a omezený navigační fallback service workeru.

### Etapa 2 — cloudová evidence

- Správce/trenér přidává členy a hosty bez uživatelského účtu do vybraného klubu.
- Ukládá šablony s místem, délkou a plánem; rychlý start předvybere šablonu.
- Vytváří jednorázové nebo 4/8/12 týdenně opakované tréninky jedním atomickým databázovým insertem.
- Čas tréninků používá Europe/Prague, série zachovává místní čas přes změnu letního času. Neexistující jarní čas je odmítnutý; dvojznačný podzimní čas zvolí standardní zimní výskyt.
- Eviduje RSVP a samostatně potvrzuje docházku. Změna jedné hodnoty nepřepisuje druhou. Docházka je rozlišená na neověřeno/přítomen/nepřítomen a ukládá identitu potvrzujícího trenéra.
- Vidí souhrn potvrzené účasti a může exportovat strukturovaný JSON vlastního klubu (`schemaVersion: 1`, UTC časové údaje, časové pásmo).
- Člen s rolí member vidí jen klubové události a šablony; registr a docházku nečte ani nemění. RSVP v této etapě zapisuje trenér, nejde o samoobslužné přihlašování členů.

Cloudový přehled začíná prázdný. Demo není automaticky importované. Čtení je stránkované, aby větší registr či historie docházky nebyly tiše oříznuté limitem API. Zápisy blokují opakované klepnutí při ukládání; při chybě se nepotvrzuje úspěch. Obnovování dat je ruční. Úpravy a mazání záznamů, realtime synchronizace a historie změn zatím nejsou v UI.

## Oprávnění a bezpečnost

Tabulky clubs, club_roles, members, templates, events a participation mají RLS. Složené cizí klíče zakazují propojit člena či šablonu z jiného klubu. Anonymní role nemá přístup k registru ani dalším klubovým tabulkám. Změny členů/šablon/událostí/účasti povolují pouze owner/coach, role přiděluje pouze owner. Klub a první roli vytváří důvěryhodná administrace; veřejné zakládání klubů a registrace jsou vypnuté.

Bucket club-photos je privátní; jeho přístup omezuje klubová politika. Fotografie zatím nemají UI ani ověřené kompletní Storage workflow. Service worker necachuje API data ani tokeny, neposkytuje cloudová data offline. PWA instalace je připravená manifestem, plný offline režim zůstává další etapou.

Do dokončení testů dvou skutečných klubových účtů a Storage používejte výhradně fiktivní údaje. Frontendové filtrování a skrytá tlačítka nejsou náhradou RLS. Export obsahuje údaje členů a patří jen do důvěryhodného úložiště.

## Automatické kontroly

`npm test` — 27 unit testů: opakování, platnost dat, časové pásmo a přechod DST, bezpečná veřejná konfigurace, ověřování identity, filtr club_id a stránkování, omezení rolí a oddělené změny RSVP/docházky. `npm run build` — TypeScript a produkční sestavení.

`npm run test:cloud` — živé API kontroly s fiktivními fixtures: přihlášení, host, šablona, série událostí, RSVP/docházka, reload dat, anonymní přístup a RLS zamítnutí nepřiřazeného klubu. Vyžaduje čtyři proměnné VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, STG_TEST_EMAIL, STG_TEST_PASSWORD v prostředí a testovací účet s rolí owner. Hodnoty neukládejte do souborů. Test maže pouze fixtures se svými generovanými UUID a odhlásí testovací relaci. Spouštějte jen proti vývojovému klubu.

`npm run test:ui` — Chromium smoke test na šířce 390px proti spuštěnému Vite na portu 5173. Vyžaduje stejné testovací proměnné, Python 3 a nainstalované Chromium (`npx playwright install chromium`). V managed prostředí používejte writable cache, např. `PLAYWRIGHT_BROWSERS_PATH=/workspace/stg-validation/browsers`. Testovací relay na 127.0.0.1:8770 používá podporovanou HTTPS proxy a běžné TLS ověřování. Nekonfigurujte vlastní certifikační bypass. Test prochází skutečné UI a Supabase API, kontroluje persistenci po reloadu, mobilní šířku, JS chyby a odhlášení. Vlastní fixtures následně odstraní. Nespouštějte oba zápisové integrační testy zároveň se stejným účtem.

[Databázové testy](supabase/tests/README.md) ověřují izolaci existujících dvou klubů, ochranu vazeb a role member/coach. Lokálně prošly na PostgreSQL 17 s minimální testovací náhradou schémat Auth/Storage. Tento výsledek nenahrazuje živé Supabase testy dvou skutečných účtů ani Storage.

### Výsledek této etapy

Prošly unit testy a produkční build, živé API kontroly a mobilní Chromium workflow: host přetrval po reloadu, šablona vytvořila čtyři termíny, RSVP i skutečná docházka zůstaly samostatně uložené a odhlášení odstranilo klubový prostor. Testovací záznamy byly odstraněné. Databázové RLS kontroly dvou klubů prošly lokálně. Vercel nasazení tohoto nového commitu ověřte až po dokončení jeho deploymentu.

## Další kroky a omezení

Živé ověření izolace dvou účtů/klubů a Storage; pozvánky, reset hesla a MFA; bezpečné samoobslužné RSVP člena; editace, rušení a historie změn; deník a soukromé fotografie; statistiky podle období a pomůcek; závody, týmy a playlisty; anglické lokalizační slovníky. Český jazyk je výchozí, anglické UI zatím není hotové. Při souběžné změně stejného pole platí poslední úspěšný zápis; optimalistické zamykání není implementované.
