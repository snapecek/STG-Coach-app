# Šablony a týmové minihry

## Databáze

Po migraci 019 aplikujte jednou `supabase/migrations/202610140020_preset_library_team_games.sql` v Supabase SQL Editoru. Migrace přidá klubový katalog závodů, pomůcek a miniher a týmové minihry. Zachová původní tréninkové šablony i individuální minihry; existující hry zůstanou v režimu Jednotlivci. Migrace nepřepisuje uložené události, dosavadní pomůcky ani jejich výsledky a neposílá e-maily.

Nový frontend nabízí dosavadní individuální minihry i před migrací. Dokud není 020 aplikovaná, nový katalog vysvětlí chybějící migraci. Týmové minihry vyžadují 020. Migrace přejmenovává původní mutační funkce na soukromé pomocné funkce a zachovává veřejné názvy a argumenty pro jednotlivce; starší klienti nemohou jednotlivými zápisy změnit společný týmový výsledek.

## Použití

V **Šablony** jsou části **Tréninky**, **Závody**, **Pomůcky**, **Minihry**.

- Tréninkové šablony zůstávají stejné. Vlastní závodní šablona ukládá disciplínu, délku trasy, časové okno, výchozí místo a organizační pokyny. Při plánování závodu vyberte šablonu a upravte místo, název a termín. Aplikace neobsahuje přednastavené závodní šablony; klub si vytváří vlastní.
- Pomůcka má jeden název (nejvýše 40 znaků, bez čárky). V zápisu deníku klepněte na uložené pomůcky. Původní ruční zadání a historické pomůcky zůstávají podporované. Výběr i ruční text se ukládají společně, normalizují a zbavují duplicit; platí limit 30 pomůcek.
- Šablona minihry ukládá název, pravidla, hodnocení (čas/opakování/vzdálenost/body) a režim Jednotlivci/Týmy. Účastníky a konkrétní týmové soupisky vyberete pro daný trénink.

V **Deník → otevřít trénink** je přímo **Vyhodnocení miniher**. Lze přidat i hru, která nebyla v plánu. Při týmové hře vytvořte pojmenované týmy a zařaďte účastníky (každý nejvýše do jednoho týmu této hry). Výsledek je společný pro tým. Přítomnost všech členů týmu musí odpovídat výsledku; pro DNS musí být všichni nepřítomní. Čas se řadí od nejnižšího, ostatní hodnoty od nejvyšší; stejné výsledky sdílejí pořadí a skutečná nula je platný výsledek. Neověřený či chybějící výsledek se do pořadí nepočítá.

Změna týmové soupisky zruší výsledek dotčeného týmu. Typ hodnocení a režim již uložené minihry nelze měnit, aby se nepřepsal význam historických výsledků. Přidání či úprava hry/výsledku znovu otevře dokončený trénink ke kontrole. Minihry zůstávají volitelnou součástí dokončení tréninku.

Použití šablony vytváří vlastní kopii údajů. Změna či smazání šablony nikdy zpětně nepřepíše událost, pomůcky v deníku ani uloženou minihru. Správa katalogu a miniher je dostupná pouze správci/trenérovi konkrétního klubu.

## Ověření

`npm test`, `npm run build` a `npm run test:database` ověřují i novou migraci, RLS, týmové výsledky, nulové body, souběžné úpravy a zachování jednotlivců. `STG_PRESET_ONLY=1 npm run test:member-ui` vůči běžícímu Vite a fiktivnímu Supabase testuje celý průchod novými šablonami a deníkem (bez živých zápisů). Běžné `npm run test:member-ui` zachovává dosavadní regresní průchody. Před živým používáním aplikujte 020 a obnovte aplikaci.
