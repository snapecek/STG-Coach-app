# Vyhodnocení tréninku a grafika ke sdílení

## Databáze

V Supabase → SQL Editor spusťte jednou celý obsah `supabase/migrations/202610140015_training_performances.sql`. Starší migrace neopakujte. Název souboru ani příkaz terminálu nejsou SQL. Migrace musí navazovat na 001–014.

Tabulka `training_performances` ukládá nejvýše jedno měření člena na trénink: délku úseku v metrech, plán 1–100 opakování, pole skutečných časů v milisekundách a poznámku. V rámci jednoho tréninku lze měřit různé délky u různých členů. Více různých sad jednoho člena v jednom tréninku zatím podporováno není.

Číst a měnit mohou jen trenér/správce odpovídajícího klubu. Členský účet k tabulce nemá přístup. Zápis vyžaduje zahájený plánovaný trénink a člena s potvrzenou skutečnou přítomností. Odpověď Jdu přítomnost nenahrazuje. Závody používají samostatné výsledky. Změny měření znovu otevřou dokončení události. Změna na závod je blokovaná, dokud mají tréninky měření. Smazání události, člena nebo soupisky odstraní příslušná měření; retenční úklid člena znovu neotevře historicky dokončený trénink.

## Použití

1. V Deníku otevřete zapsaný trénink. Objeví se samostatný detail; seznam a jeho filtry zůstávají zachované pro návrat.
2. Tlačítko Upravit otevře stávající zápis. Uložení formulář zavře. Docházku upravíte stejnými záznamy jako v záložce Docházka.
3. V Měřených úsecích vyberte potvrzeného přítomného člena, délku a plán, např. 800 m × 6. Časy zadejte např. `3:12; 3:15.5; 3:18` nebo každý na nový řádek. Prázdné časy znamenají nula dokončených úseků; nezadané měření neznamená nulu.
4. Splnění plánu počítá součet zadaných časů / plánovaný počet u měřených přítomných členů. Výslovně ukazuje pokrytí měření (`1 z 14 přítomných měřeno`), není to automatické vyhodnocení textového plánu všech členů.
5. Nejrychlejší úsek je nejkratší jednotlivý zaznamenaný čas vybrané délky; žebříček ukazuje průměr časů člena pro stejnou délku. Různé délky se nesrovnávají.
6. Zlepšení porovnává průměr se stejnou disciplínou, délkou úseku, plánovaným i skutečně změřeným počtem úseků posledního předchozího dokončeného tréninku daného člena. Bez srovnatelného měření se neodhaduje; zhoršení není označované jako zlepšení. Pokud se skutečná přítomnost později změní, uložené časy zůstanou viditelné s upozorněním, ale v souhrnu a grafice nejsou započítané.
7. Po ověření skutečného průběhu a docházky dokončete trénink. Měřené úseky jsou volitelné.

## Fotografie a sdílení

Galerie používá stejné soukromé úložiště a sanitizaci fotografií jako dosud. Nahrání automaticky vybere novou fotografii; jinou vyberete náhledem. Změna výběru nic nemaže. Výběr úvodní fotografie a rozepsaný příspěvek jsou pracovní stav otevřené obrazovky, ne sdílené nastavení klubu.

Editor vpravo nabízí 1080 × 1080, 1080 × 1350 a 1080 × 1920 px, šablony Statistiky / Fotka a titulek / Nejlepší výkony, vlastní titulek a text do 2 200 znaků. Export je PNG vytvořený přímo v prohlížeči z vybrané soukromé fotografie. Nevytváří veřejnou URL ani neodesílá soubor externímu poskytovateli. Jména členů jsou v grafice nejlepších výkonů výchozím stavem skrytá; trenér je může výslovně zahrnout. Nejlepší výkony používají délku úseku zvolenou ve vyhodnocení.

Stáhnout grafiku stáhne PNG. Sdílet otevře systémovou nabídku telefonu, pokud podporuje sdílení souboru; jinak stáhne PNG a nabídne samostatné kopírování textu. Potvrzení předání systémové nabídce není potvrzení zveřejnění ani doručení. Kopírování textu výslovně znamená schránku zařízení. Volba 9:16 vytváří statický obrázek pro Stories, nikoliv video Reel.

**Automatické publikování a plánování na Instagram/Facebook není v této etapě aktivní.** Účty nejsou označené jako propojené. Pro další etapu je potřeba Meta aplikace, autorizace příslušných účtů a stránek, potřebná oprávnění a serverové ukládání/obnova tokenů; tajné tokeny nepatří do Vercel `VITE_*`. Teprve poté lze zavést stav publikace, plánovací frontu a opakování chyb. Ruční publikování stažené grafiky funguje bez tohoto propojení.

Strukturovaný export Analýza má `schemaVersion: 5` a navíc `trainingPerformances`, filtrované stejnými událostmi a členem jako zbytek exportu. Soukromé fotografie dál obsahují jen reference, nikoliv veřejné odkazy nebo binární obsah. Rozepsaný text příspěvku do analytického exportu nepatří.

## Kontroly

- `npm test`: parsování/formát časů, limity, nulové vs. chybějící výsledky, podmínky porovnání a rozměry grafiky.
- `npm run test:database`: všech 15 migrací, RLS včetně členského zákazu, validace, opětovné otevření, oddělení závodů a kaskády.
- `npm run test:member-ui`: fiktivní API; celý klubový workflow a nový detail, měření, tři skutečně stažené PNG, výchozí skrytí jmen, mobilní/desktop rozložení a návrat do deníku. Nic nepublikuje ani neposílá e-mailem.
- `npm run test:ui`: opt-in proti nakonfigurovanému testovacímu Supabase účtu, vlastní fiktivní data s úklidem. Vyžaduje aplikovanou migraci 015. Ověřuje skutečné ukládání měření po reloadu, soukromou fotografii v grafice a JSON export. Žádné publikování na sítě.
