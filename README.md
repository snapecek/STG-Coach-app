# STG Coach

Mobilní první etapa správy sportovního klubu. React, TypeScript, Vite, Tailwind CSS; české tmavé rozhraní. Veškerá předvyplněná data jsou fiktivní.

## Spuštění

Node.js 22+ (ověřeno na 24), `npm ci`, `npm run dev`. `npm test` ověří doménovou logiku a `npm run build` TypeScript i produkční sestavení. Produkci nasaďte z adresáře `dist` na HTTPS statický hosting s fallbackem na index.html. Manifest umožňuje instalaci; service worker poskytuje pouze fallback úvodní stránky, plný offline režim není dokončen.

## Etapa 1 — funkční demo

Přehled klubu, seznam a hledání členů, přidání členů a hostů bez účtu, vytváření šablon míst a plánů, tréninky ze šablon, týdenní opakování (4/8/12), Jdu/Nejdu/Možná, potvrzení skutečné účasti trenérem, souhrn docházky a JSON export se schemaVersion. Stav se ukládá do localStorage `stg-fictional-demo-v1`. Smazáním této položky se obnoví demo. Nevkládejte skutečné osobní údaje. Šablony ani členové zatím nemají editaci a mazání. Rychlý start předvybere zvolenou šablonu.

## Supabase a bezpečné nasazení

Aplikace zatím používá výhradně lokální demo. Oddělený cloudový prostor (`?workspace=cloud`) obsahuje přihlášení e-mailem a heslem, odhlášení a načtení klubů přihlášeného účtu. Evidence členů a tréninků zatím běží pouze v demu; nejde o dokončené produkční workflow. Pro skutečná data nejprve integračně ověřte přihlášení a RLS, dokončete pozvánky, serverové založení klubu a datový adaptér. Klient nikdy nesmí dostat service_role klíč.

1. Založte Supabase projekt. Pomocí Supabase CLI jej propojte (`supabase link --project-ref …`) a aplikujte migraci `supabase db push`.
2. Nastavte Auth redirect URL na vlastní HTTPS doménu, ověřování e-mailu a vhodná pravidla pro registrace.
3. Zkopírujte .env.example do .env.local a vyplňte veřejné projektové hodnoty. Tajné klíče patří jen na server.
4. První klub a roli owner vytvořte důvěryhodnou serverovou administrací; záměrně není dostupná veřejná politika pro založení klubu nebo přidělení vlastní role.
5. Před použitím skutečných dat otestujte dva kluby, anonymního klienta, člena i trenéra. Ověřte, že klub A nečte ani nemění klub B, člen nečte registr, nemění docházku a anonymní klient nečte žádná členská data ani fotografie.

Migrace obsahuje oddělené kluby, role, členy/hosty, šablony, události a účast. Složené cizí klíče brání propojení různých klubů. Všechny tabulky mají RLS. Registr a účast jsou v etapě 1 dostupné pouze trenérům/správcům. Fotografie mají privátní bucket, přístup jen pracovníkům příslušného klubu; UI pro fotografie není implementováno. Samoobslužné RSVP člena vyžaduje další bezpečně oddělenou politiku nebo RPC, aby člen nemohl potvrdit vlastní skutečnou docházku.

## Ověření a další etapy

Automatické testy: týdenní opakování přes konec měsíce, omezení počtu opakování, oddělený stav docházky a host bez účtu. Build kontroluje typy. Databázová migrace dosud nebyla spuštěna proti živému Supabase; RLS integrační testy a testy UI zůstávají další povinnou etapou před produkcí.

Další kroky: bezpečná autentizace a cloudový adaptér, testy tenant izolace, editace a rušení událostí, lokalizační slovníky pro angličtinu, tréninkový deník a soukromé fotografie, statistiky podle období, závody a týmy. OCR Timer není součástí projektu.

### Výsledek ověření této etapy

`npm ci` z lockfilu prošlo; 5 doménových testů a produkční sestavení prošly. Vývojový server odpověděl úspěšně na požadavek stránky i PWA manifestu. Vizuální a interakční test v Chromium nebyl proveden: stažení z cdn.playwright.dev vrátilo 403 Domain forbidden. To není ověření UI. Supabase migrace a Auth dosud nebyly integračně ověřeny.

## Etapa 2a — přihlášení a přístup ke klubu

Postup založení projektu je v [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Cloudový prostor nikdy nepoužívá demo jako fallback a nečte členské údaje ani fotografie. Auth ověřuje identitu přes getUser před načtením klubů; session je uložená v sessionStorage, ne společně s demo daty. Chyby přihlášení nezobrazují podrobnosti o existenci účtu. Konfigurace odmítá tajné serverové klíče a HTTP URL; tajný klíč nikdy nesmí být ani vstupem sestavení Vite.

Ověřeno: 14 automatických testů a produkční build. Nové testy kontrolují odmítnutí nebezpečné konfigurace, čtení až po ověření identity, filtr účtu a odmítnutí fallbacku při chybě databáze. Jsou to unit testy, nikoli důkaz funkční Auth nebo RLS vůči Supabase. `supabase/tests/tenant_access.sql` připravuje integrační kontroly anonymního přístupu, izolace klubů a oprávnění člena/trenéra; zatím nebyl spuštěn, projekt není nakonfigurovaný. Testy pro fotografie a zápisy událostí/docházky ještě zbývají. Živé přihlášení ani vizuální test UI nejsou ověřené.

Další krok: založit vývojový Supabase projekt podle návodu, aplikovat migraci, spustit SQL testy a doplnit veřejnou konfiguraci. Pak zapojit cloudový adaptér a ověřit celé workflow s fiktivními daty.

### Ověření připojení 13. 10. 2026

Projektové proměnné jsou přítomné; HTTPS URL a typ veřejného klíče byly zkontrolované bez výpisu hodnot. Supabase Auth settings odpovědělo HTTP 200 a disable_signup=true. Anonymní GET na clubs a members skončil HTTP 401 / 42501; žádné záznamy nebyly zpřístupněny. To ověřuje zákaz anonymního čtení, nikoliv izolaci přihlášených klubů ani oprávnění fotografií. Přes podporovanou HTTPS proxy připojení funguje; přímý Node fetch v tomto prostředí proxy automaticky nepoužil. 14 unit testů a build prošly, vývojový server byl spuštěn s konfigurací. Přihlášení konkrétního testovacího účtu a jeho klub dosud nebyly ověřeny.
