# Opravný balíček 1 — stabilita po auditu

Navazuje na nálezy A01–A06 v [auditu](PRODUCT_AUDIT_2026-10-18.md).

## Změny

- Dialogy událostí a potvrzení používají společné řízení fokusu: otevření, Tab/Shift+Tab, Escape, návrat na spouštěč. Ukládání respektuje zakázané zavření. U vnořených oken se ovládá vrchní dialog; nativní dialog sdílení si ponechává vlastní správu.
- Rozepsaná nová/upravovaná/kopírovaná událost a poznámky deníku vyžadují potvrzení před zavřením či opuštěním přes navigaci. Platí i pro přepnutí klubu a odhlášení. Obnovení/zavření stránky používá upozornění prohlížeče. Přepínání záložek detailu ponechává deník rozepsaný. Nejde o lokální automatické ukládání; koncept neobnovuje stav po ukončení procesu telefonu.
- Filtry Analýzy na úzkém telefonu přecházejí do jednoho sloupce, vstupy mohou zmenšit svou vnitřní šířku.
- Zápis příspěvku či úhrady čeká na nový ledger. Do té doby se nezobrazují akce nad starým stavem. Při neúspěšném načtení po úspěšném zápisu je dostupné jen opakování čtení, nikoli opětovný zápis platby.
- Chybová obrazovka uvádí verzi a kód incidentu. Produkce odesílá omezené hlášení přes autentizovaný `/api/client-error` do logů Vercelu. Metadata obsahují pouze typ chyby, pevně určenou část aplikace, verzi, rozsah a náhodný identifikátor. Žádné názvy klubů, jména, zprávy, obsah formulářů, adresy stránek ani stack trace. Nejde o úplný monitoring všech síťových operací; chyby před přihlášením mají pouze místní kód.
- Dostupnost nové verze se ověřuje jednou za minutu a při návratu do stránky. Nabízí se ruční načtení s ochranou rozepsaných změn. Aplikace se sama nepřenačítá.
- GitHub Actions spouští jednotkové testy, produkční build, všechny izolované browser scénáře, přihlášení/sdílení a dočasnou PostgreSQL se všemi migracemi a databázovými regresními testy.

## Nasazení a provoz

**Není potřeba nová migrace ani nasazení Supabase funkce.** Vercel nasadí frontend a Node funkci `/api/client-error`. Funkce používá stávající veřejné proměnné `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` k ověření přihlášení; nepotřebuje service-role klíč.

Vercel → projekt → Logs: filtrujte `trenomi.client_error`, případně kód incidentu z chybové obrazovky. Hlášení jsou omezena na kategorii/obrazovku za otevření stránky a nejvýše 10 za minutu na uživatele v jedné instanci funkce. Doba uchování logů závisí na tarifu Vercelu. API nemá být použité k posílání soukromých podrobností.

Verze je Git SHA z prostředí nasazení, jinak lokální Git SHA. Sestavení ze ZIPu bez Gitu dostane identifikátor `local-…`. `/release.json` neobsahuje žádné nastavení nebo klíče.

## Opakovatelné kontroly

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:release-ui
npm run test:database
```

Poslední příkaz potřebuje Docker. Browser runner spouští vlastní Vite a používá výhradně fiktivní backend. Nespouští cloudové skripty měnící živá data ani neposílá e-mail/push. Výstup uvádí adresář s logy. Pro systémové Chromium lze nastavit `CHROMIUM_PATH`; při již běžícím vývojovém serveru také `UI_EXTERNAL_SERVER=1`. Ten musí používat fiktivní veřejnou konfiguraci uvedenou v runneru. Čas testovacích dat i prohlížeče je pevně stanovený na středu 14. 10. 2026.

Nové scénáře `STG_REPAIR_ONLY` a `STG_FEE_SYNC_ONLY` pokrývají ovládání dialogů, zachování/zahození konceptu, chybu a úspěch uložení deníku, šířky 320–1440 px a neúspěšné načtení po platbě bez dvojího zápisu.

Živé doručení e-mailu a push na fyzický telefon zůstává samostatným provozním ověřením; automatické kontroly ho nedokládají. Rovněž nebyla měněna správa oprávnění, databázové identifikátory ani klíče místního úložiště.
