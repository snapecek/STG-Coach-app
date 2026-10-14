# Závodní týmy a týmové výsledky

Migrace `supabase/migrations/202610140016_race_teams.sql` je uživatelem potvrzená jako úspěšně provedená. Pro nové instalace spusťte celý SQL soubor po migracích 001–015. Na stávající databázi předchozí migrace neopakujte.

## Použití

1. V kalendáři otevřete závod → Výsledky → Týmy.
2. Nový tým: název, volitelná kategorie a 1–50 členů z již uložené soupisky tohoto závodu. Nejprve chybějícího závodníka přidejte v záložce Účast.
3. Jeden závodník může v jednom závodě patřit jen do jednoho týmu. Soupisky jiných událostí ani tréninkové skupiny se nemění. Samostatně závodící člen nemusí být přiřazený k týmu.
4. Po startu závodu potvrďte skutečnou přítomnost a ve Výsledek týmu zadejte samostatný týmový čas, DNF nebo DNS a případnou poznámku. Čas je `HH:MM:SS` s volitelnými tisícinami, maximálně 48 hodin. Pro DNF/DNS se čas neukládá.
5. Dokončil/DNF vyžaduje přítomnost všech členů aktuální týmové soupisky; DNS jejich nepřítomnost (i omluvenou). Formulář sám nepřepisuje docházku nebo individuální výsledky.
6. Pořadí je klubové podle ručně zadaného týmového času, zvlášť pro každou přesně pojmenovanou kategorii. Shodné časy sdílejí pořadí (1, 1, 3). DNF, DNS, nevyplněné a s docházkou nesouhlasící výsledky nejsou hodnocené. Nejde o oficiální pořadí pořadatele.
7. Upravit soupisku: skutečná změna členů vymaže týmový stav a čas, poznámku zachová. Pouhé přejmenování či změna kategorie čas zachová, ale závod vrátí ke kontrole. Smazání týmu vyžaduje potvrzení a neodstraní závodníky, jejich docházku ani individuální výsledky.
8. Dokončení závodu dál vyžaduje ověřené individuální výsledky všech závodníků. Pokud jsou založené týmy, musí mít navíc ověřené týmové výsledky. Týmy jsou dodatečná týmová klasifikace tohoto závodu; tato etapa nezavádí režim štafety bez individuálních výsledků.

## Ochrana dat a souběžné úpravy

- RLS dovolí číst týmy i jejich soupisky pouze trenérovi/správci příslušného klubu. Členové, anonymní a cizí klub je nečtou.
- Přímý zápis do tabulek je pro `authenticated` zakázaný. Změny provádějí autorizované RPC `save_race_team`, `set_race_team_result`, `delete_race_team`.
- RPC zamykají událost, kontrolují roli, klub, druh a stav události, příslušnost závodníků k soupisce a revizi týmu. Soupiska se ukládá v jedné transakci. Při souběžné změně se zastaralá revize odmítne; uživatel obnoví přehled a změnu zkontroluje znovu.
- Nejvýše 50 týmů na závod, nejvýše 50 závodníků v týmu; duplicitní jména v jednom závodě se nerozlišují velikostí písmen. Kategorie se při ukládání ořízne, jinak ji trenér pojmenovává samostatně.
- Zrušený závod nelze upravovat. Týmy lze plánovat předem; výsledky vyžadují zahájený závod. Změna výsledku či soupisky znovu otevře dokončení. Závod s týmy nelze přepnout na trénink, dokud se týmy neodeberou.
- Odebrání závodníka ze soupisky odstraní jeho týmové přiřazení a vymaže týmový stav/čas. Stejně jako dosud je před odebráním nutné odstranit jeho individuální výsledek. Retenční smazání člena vymaže osobní vazbu a zachová historický týmový výsledek/dokončení. Prázdný historický tým zůstane čitelný pro trenéra jako metadata; nově jej uzavřít nelze bez platné soupisky.
- Změna skutečné docházky nevymaže ručně zadaný čas. Rozpor se označí ke kontrole a zablokuje nové dokončení; čas se nepoužije v zobrazeném klubovém pořadí.

## Export a omezení

Analýza → Export filtrovaných dat má `schemaVersion: 6` a navíc `raceTeams`. Týmy se filtrují podle zahrnutých událostí. Při filtru konkrétního člena se přidají jen jeho týmy, `member_ids` obsahuje pouze vybraného člena a `roster_size` udává velikost celé soupisky. Filtr událostí zůstává stejný jako dosud: vybraný člen vybírá události, kterých se skutečně zúčastnil; DNS se tímto filtrem nevybírá. Týmový čas není přičítaný k individuálním časům, tréninkovým minutám či vzdálenostem.

Týmy se nekopírují do nové události automaticky, aby kopie nepřenášela výsledky ani starou soupisku. Automatický výpočet podle pravidel pořadatele, náhradníci, štafetové úseky, oficiální pořadí, přenos ze startovní listiny ani veřejné výsledky nejsou součástí této etapy. Minihry zůstanou samostatnou další etapou. E-maily a automatické publikování na sociální sítě se touto změnou neaktivují.

## Ověření

- `npm test`: 149 unit testů včetně kategorií, shodných časů, DNS/DNF, skutečné docházky, prázdné soupisky a validace.
- `npm run build`: TypeScript a produkční build.
- `npm run test:database`: 16 migrací, 15 SQL sad a souběžné rezervace. Nová sada kontroluje RLS, zákaz přímého zápisu, cizí soupisku, duplicitního člena, zastaralou revizi, transakční návrat, neúplný výsledek, změnu soupisky, zachování individuální evidence a retenci.
- `npm run test:member-ui`: fiktivní API; vytvoření dvou týmů, oddělené časy, pořadí, vyloučení členů jiného týmu, zneplatnění při změně soupisky, potvrzení smazání, reload a 320/1440 px.
- `npm run test:ui`: opt-in proti testovacímu účtu a vlastní fiktivní data s úklidem; přidává skutečné týmové RPC, samostatný týmový čas, dokončení, reload, filtrovaný JSON a smazání bez ztráty individuálního výsledku.

Cílené živé ověření: `npm run test:race-teams-ui` prošlo pro dvoučlenný tým v reálné Supabase s vlastními fiktivními daty a jejich následným úklidem. Ověřilo různé týmové/individuální časy, dokončení a reload, export bez osobního přiřazení spoluhráče při filtru člena, zneplatnění po změně soupisky a smazání týmu se zachováním individuálních výsledků. Neodesílá e-mail ani nezveřejňuje výsledky.
