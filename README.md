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

Založení Supabase, první migrace a přiřazení vlastníka jsou popsané v [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Databáze vyžaduje migrace v pořadí: `202610120001_initial.sql`, `202610130002_club_management.sql`, `202610130003_journal_photos.sql`, `202610130004_race_results.sql`. Druhá přidává archivaci, dokončení událostí a retenční úklid; třetí strukturovaný deník a privátní fotografie událostí. Každou migraci aplikujte jen jednou; uživatel potvrdil aplikování druhé i třetí a živé API kontroly prošly.

## Demo a cloudový klub

Výchozí stránka `/` otevírá přihlášení nebo již přihlášený klub. Původní trenérský prototyp na `/?workspace=demo` byl vyřazen; tato adresa nyní otevře stejnou aktuální aplikaci a odstraní zastaralý parametr z adresy. Dřívější lokální demo data zůstávají v prohlížeči, ale nejsou načítaná ani automaticky importovaná do databáze.

Dřívější adresa `/?workspace=cloud` zůstává podporovaná. Přihlášení e-mailem a heslem používá Supabase Auth. Klub je dostupný pouze po ověření identity a načtení přiřazených rolí. Cloudový režim používá data vybraného klubu, nikdy nesahá po demo datech při chybě. Relace je v sessionStorage; klubová data jsou pouze v paměti stránky. Odhlášení a přepnutí klubu odstraní příslušný klubový prostor. Obnovení tokenu neruší výběr klubu.

### Etapa 1 — dokončené demo

Přehled, registr členů/hostů, hledání, šablony míst a workout plánů, tréninky ze šablon, týdenní opakování, RSVP Jdu/Nejdu/Možná, skutečná docházka, základní souhrn a strukturovaný JSON export, PWA manifest a omezený navigační fallback service workeru.

### Etapa 2 — cloudová evidence

- Správce/trenér přidává členy a hosty bez uživatelského účtu do vybraného klubu.
- Ukládá šablony s místem, délkou a plánem; výběr šablony je součástí jediného formuláře Nový trénink.
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
4. Uplynulá událost se zobrazuje K dokončení až po svém konci (čas + délka). Dokončení vyžaduje uložený skutečný průběh a potvrzenou přítomnost nebo nepřítomnost všech uvedených členů. Kontrolu vynucuje také databázový trigger. Další změna účasti, průběhu, plánu či termínu záznam znovu otevře. Analýza započítává jen dokončené nezrušené události.
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

`npm test` — 58 unit testů: opakování, platnost dat, časové pásmo a přechod DST, bezpečná veřejná konfigurace, ověřování identity, filtr club_id a stránkování, omezení rolí, oddělené změny RSVP/docházky, měsíční kalendář, podmínky dokončení, filtrování změn/mazání vybraným klubem, kombinované filtry a výpočty analýzy, bezpečné cesty a typy fotografií. `npm run build` — TypeScript a produkční sestavení.

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

Ověření této etapy: 58 unit testů, produkční build a lokální PostgreSQL testy všech čtyř migrací. Testy pokrývají pořadí, čas, shodné výsledky, RLS, meziklubové vazby, nulový čas, DNF/DNS, změnu typu, zrušení a opětovné otevření události. Živé ověření nových výsledků je závislé na aplikování čtvrté migrace; lokální test není potvrzením nasazení na Supabase.

Živý mobilní test této etapy prošel dosavadním workflow až po vytvoření závodu. Zápis výsledku zatím nedokončil: hosted Supabase vrátil PGRST205 (tabulka race_results chybí). Testovací členové, události, šablony i fotografie byly uklizené. Po aplikování čtvrté migrace je nutné zopakovat `npm run test:ui`.
