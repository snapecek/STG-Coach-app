# Opravný balíček 2 — jednodušší běžná práce

## Ovládání

- Trenér má nahoře osobní přepínač **Základní / Pokročilý**. Výchozí je Základní: Přehled, Kalendář, Docházka, Členové a Deník. Pokročilý přidává Analýzu a Šablony. Režim se ukládá k přihlášenému účtu a obnoví se také při přihlášení na jiném zařízení. Nemění oprávnění ani klubová data.
- Souhrn týdenního objemu zůstává na Přehledu v obou režimech. Odkaz do podrobné analýzy je v Pokročilém. Chat, oznámení, příspěvky a Nastavení jsou dostupné stále. Členovi zůstávají jeho tři navigační položky.
- Základní formulář události skrývá nepovinnou paletu barev, kapacitu, opakování, trasu/registraci a předběžnou soupisku pod rozbalovací volby. Šablony lze nadále používat. Existující kapacita a údaje závodu se při úpravě rozbalí automaticky. Sbalení pole jej neodstraní z formuláře ani odesílaných dat.
- Průvodce v Přehledu nabízí skutečné akce podle role. Lze jej dokončit a znovu otevřít přes **Můj účet → Nápověda → Průvodce aplikací**. Nezakládá záznamy automaticky.
- Přepnutí režimu zachovává otevřený formulář události. Při opuštění Analýzy s rozepsanými cíli nebo správy šablon se uplatní ochrana neuložených změn. Chyba uložení preference se zobrazí a neoznámí falešný úspěch.

## Oznámení

V Nastavení je osobní volba e-mailové připomínky nevyplněné účasti, společná pro všechna členství daného účtu. Výchozí stav je zapnuto. Netýká se pozvánek ani obnovy hesla. Databáze kontroluje preferenci při výběru i bezprostředně před odesláním, takže vypnutí zastaví také čekající připomínku. E-mail již předaný poskytovateli nelze odvolat.

Trenér navíc vidí stav plánovačů a počty čekajících, předaných a neúspěšných e-mailů a zpracovaných mobilních oznámení. Přehled nepotvrzuje skutečné doručení ani správnost klíčů odesílací služby. Mobilní oznámení mají samostatně stav aktuálního zařízení, včetně blokování prohlížečem a požadavku instalace na iOS.

Přehled nepředává klientovi e-mailové adresy příjemců, push endpointy, obsah fronty, příkazy Cronu ani tajné klíče. Člen nečte provozní statistiky klubu.

## Nasazení databáze

Po předchozích migracích až do 044 spusťte v Supabase SQL Editoru celý soubor:

[`supabase/migrations/202610180045_workspace_sync_notifications.sql`](../supabase/migrations/202610180045_workspace_sync_notifications.sql)

Potom aplikaci znovu načtěte. Není potřeba nastavovat nové Secrets, upravovat Cron ani znovu nasazovat Edge Functions. Nová preference se využije ve stávající funkci e-mailových připomínek přes změněný databázový výběr příjemců.

Do nahrání 045 funguje nové ovládání a průvodce, trenérská data se obnovují původním způsobem. Osobní vypnutí e-mailů zůstane nedostupné, aby rozhraní neslibovalo něco, co databáze ještě neumí. Provozní statistiky oznámení vyžadují 045 také.

Migrace nepřejmenovává existující tabulky, účty, callbacky ani klíče úložiště, nemaže historii a nezakládá další úlohu Cronu.

## Změnové načítání

Po 045 trenérský prostor po úvodním úplném načtení ověřuje každých 10 sekund změny. Přenáší pouze upravené/vložené záznamy a identifikátory odstraněných záznamů. Skupiny, úkoly a pozvánky znovu čte, jen pokud se změnily. Starší události zůstávají dostupné pro deník, kalendář i analýzu. Místní zápis zneplatní souběžně rozpracovaný refresh a rozepsaný formulář obnovování pozastaví.

Soukromá tabulka uchovává pouze identifikátory změněných entit a transakční kurzor. Kurzor používá inkluzivní dolní hranici PostgreSQL snapshotu, aby neztrácel zápisy transakcí dokončených mimo pořadí. Při více než 500 změněných entitách se provede úplné načtení. Dlouhá otevřená transakce může dočasně způsobovat opakovaný přenos stejných změn; klient je sloučí bez duplicit. Identifikátory odstraněných entit se uchovávají do fyzického odstranění klubu.

Rozsah této optimalizace je trenérský prostor. Úvodní načtení historie, členské obnovování a samostatné chatové načítání nejsou změněny na stránkování podle období. Jejich další optimalizace je vhodná podle naměřené zátěže; tato změna ji nepředstírá.

## Ověření

- Unit testy: sloučení historie, opakovaný delta přenos, vložení/změna/smazání, složená identita účasti, cizí klub, chybné odpovědi a zpětná kompatibilita.
- Prohlížeč: oba režimy, mobil i desktop, návrat k průvodci, přímá cesta člena k odpovědi, zachování rozepsaného formuláře, ochrana týdenních cílů, běžné založení události, osobní e-mailová volba včetně chyby ukládání a starší databáze. Prázdný i změnový refresh nesmějí znovu stahovat historii.
- PostgreSQL: všech 45 migrací a stávající regresní testy, oddělení klubů/rolí, neveřejné fronty, respektování e-mailové preference i po zařazení do fronty, kaskádová smazání, rollback, limit změn a souběžně dokončované transakce.
- Celá stávající prohlížečová sada včetně sdílení, přihlášení a plateb; analýza a nové ovládání také ve WebKitu. Testy používají fiktivní backend a dočasnou databázi, neposílají členům žádné zprávy.
