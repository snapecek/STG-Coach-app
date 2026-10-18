# Audit Trenomi: funkčnost, jednoduchost a konkurence

Datum: 18. 10. 2026. Kontrolovaná verze: `5dee7a4` (main, PR #77).

## Závěr pro rozhodnutí

Trenomi má dost funkcí pro pilot menšího sportovního klubu. Nejsilnější je souvislý postup **událost → odpověď člena → skutečná docházka → tréninkový deník/výsledek → fotografie a sdílení**. Pro OCR a smíšené sportovní skupiny je zajímavá kombinace závodů s doprovodem, hostů bez účtu, miniher a klubového deníku.

Pro širší nabídku dalším klubům zatím chybí provozní dotažení: jednotné dialogy, ochrana rozepsaných změn, čitelný mobil, přehled doručování oznámení, automatické kontroly před vydáním a jednodušší zavedení nového klubu. Proti zavedeným službám jsou největší funkční mezery v osobních kalendářích, platbách a rodinných účtech. Pokročilé sportovní platformy jsou dál v plánování a analýze výkonu.

**Doporučení:** nejprve stabilita a jednoduchost, potom kalendáře a úhrady. Další grafické šablony, vlastní sociální síť nebo rozsáhlé integrace sporttesterů nyní nemají nejvyšší prioritu. Návrhy jsou plánem rozvoje, nikoli změnami nasazenými tímto auditem.

## Co bylo skutečně prověřeno

- 301 testů v 45 souborech: prošly.
- Produkční sestavení: prošlo; hlavní produkční JS má 512 197 B, přibližně 149 855 B po zkušebním gzip. Jde o velikost souboru, nikoli změřenou rychlost aplikace na telefonu.
- Všech 44 migrací a regresní SQL testy v dočasném PostgreSQL: prošly. Součástí jsou přístupová práva, izolace klubů, souběžné rezervace, archivace a ochrana před přeplacením.
- 38 samostatných browser scénářů se současnými skripty: **32 prošlo, 6 neprošlo**. Níže je rozlišení skutečných problémů a zastaralých předpokladů testů.
- Samostatný test přihlášení a jeho obnovení po restartu prohlížeče: prošel.
- Samostatné testy editoru sdílení, skutečných dvouprstových gest Chromium a dialogu deníku: všechny tři prošly.
- Doplňkové reprodukce ovládání dialogů klávesnicí, ztráty rozepsaného formuláře, finančního stavu při pomalé odpovědi a šířky Analýzy.
- Živá produkční stránka vrací HTTP 200. Testovací trenér i člen se přihlásili přes skutečné Auth API; mají přístup k událostem a člen má propojený členský profil. Kontroly byly omezené na čtení, bez změn klubových dat a bez rozesílání zpráv.
- Veřejné oficiální stránky konkurentů byly načtené v den auditu. Neproběhlo srovnávací testování jejich placených účtů ani nativních aplikací.

Browser scénáře používají fiktivní backend. Testy na 320/390/1440 px nejsou náhradou za fyzický iPhone se Safari, Android a skutečné doručení push/e-mailu. Neproběhl penetrační audit, zátěžový test produkce ani právní posouzení.

## Přehled funkcí

| Oblast | Zjištění | Co ještě dotáhnout |
|---|---|---|
| Přihlášení a registrace | Kontrola hesla, zapamatování přihlášení, bezpečné zpracování e-mailových odkazů; testy i živé přihlášení prošly. | Přehledný průvodce prvním vstupem, jednoznačné navázání registrace na klub. |
| Pozvánky a schvalování | E-mail, sdílený odkaz, nové odeslání, odvolání a schválení přihlášky jsou pokryté testy. | Sjednotit stavový přehled: pozván, čeká na potvrzení, čeká na schválení, aktivní. |
| Kalendář a události | Tréninky/závody, vlastní typy a barvy, série, kapacita a čekací listina fungují ve scénářích. | Napojení na osobní kalendáře; týdenní přehled s přepínáním týdnů. |
| Odpovědi a skutečná docházka | Oddělené RSVP a skutečná účast, hosté, řazení, závody i doprovod. | Rychlejší hromadné potvrzení s jasným uložením a bez zbytečného otevírání dalších obrazovek. |
| Deník a vyhodnocení | Dokončení, skutečná délka/vzdálenost/RPE, výkony, fotografie, titulní fotografie a nezávislá fotografie pro sdílení prošly kontrolami. | Ochrana rozpracovaného záznamu a jasné vysvětlení, co ještě brání dokončení. |
| Minihry a závody | Šablony, dodatečné přidání hry, jednotlivci/týmy, skóre, výsledky závodu a DNS/DNF. | Sjednotit slovník výsledků; historii osobních výkonů zpracovat jako vývoj v čase. |
| Sdílení | 12 fotografických + 3 základní editorové kompozice, 16 akcentů, samolepky, vrstvy, výřez, rotace a mobilní gesta. | Doporučené šablony a oblíbené; pohodlnější první export místo dalšího množení voleb. |
| Šablony a místa | Tréninkové/závodní šablony, pomůcky, minihry a uložené mapy jsou pokryté scénáři. | Nabídnout jejich vytvoření v okamžiku opakované práce; pokročilé nastavení sbalit. |
| Chat | Soukromý kontakt člena s trenéry, chat události, archiv, počty zpráv a zmínky fungují ve scénářích. | Vyhledávání, připnutá organizační zpráva, případně soubory. Soukromý charakter hlavního chatu zachovat podle zadání. |
| Oznámení | Zvoneček, zmínky, prodlení s příspěvkem; implementovaný coach push a automatický e-mail 24 h před událostí. | Jedno místo pro preference a informaci o odeslání/chybě. Živé doručení v auditu nepotvrzené. |
| Příspěvky | Ruční evidence úhrad, měsíční automatika, částečné platby, storna a hromadné mazání jsou testované. | Opravit mezistav po úhradě; QR platební instrukce, párování plateb a export pro účetní. |
| Klub a role | Logo, ořez, přejmenování, jeden vlastník, další trenéři, primární klub, archiv a obnova. | Převod vlastnictví s ověřením; zavedení prvního klubu pro nového nezávislého správce. |

Upozornění k produkci: `invite-member` a `remind-rsvp` odpovídají na GET očekávaným 405, `push-rsvp` vrací 200. Ruční `remind-event` vrací 404; jeho nasazení je v dosavadní dokumentaci záměrně odložené. Nelze ho prezentovat jako živě dostupné ruční rozesílání. Příspěvky byly ve vybraných testovacích klubech vypnuté; to není chyba a nevypovídá to o všech klubech.

## Konkrétní nálezy

Priority: **P1** před širším provozem, **P2** další produktová etapa, **P3** podle poptávky. Kritická porucha databázových oprávnění nebo ukládání nebyla v provedených kontrolách prokázaná; nejde o záruku absence dalších chyb.

### A01 — Dialog události není plnohodnotně ovladatelný klávesnicí — P1

U trenéra i člena: po otevření zůstává fokus mimo dialog, Escape ho nezavře a Shift+Tab ze zavíracího tlačítka přejde mimo dialog. Ověřeno interaktivně na 1440 px.

Dopad: uživatel klávesnice se dostává za překryv, dialogy se chovají různě. Příspěvky a sdílení již mají lepší práci s fokusem, takže existuje použitelný základ.

Řešení: společná komponenta pro dialogy se vstupním fokusem, jeho zadržením, návratem na spouštěč, Escape a rozlišením ukládání/rozepsaných změn. Zdroj: `src/ClubDashboard.tsx:153`, `src/MemberDashboard.tsx:70`, srovnání `src/ClubFeesDialog.tsx:21`.

### A02 — Kliknutí mimo rozepsaný formulář zahodí změny — P1

Reprodukce: Nová událost → vyplnit název → kliknout mimo okno → otevřít Novou událost. Název je prázdný, bez dotazu na zahození. V průběhu nebyl žádný zápis události na server.

Řešení: příznak změn a volby Pokračovat v úpravě / Zahodit; později lokální koncept. Autosave zavádět odděleně od potvrzeného uložení. Zdroj: `src/ClubDashboard.tsx:109`, `src/EventEditor.tsx`.

### A03 — Analýza přetéká na úzkém mobilu — P1

Při šířce 320 px je po otevření Analýzy šířka dokumentu 367 px. Filtry Do, Typ tréninku a Pomůcka přesahují doprava. Stav přetrvává i po 500 ms; nejde pouze o okamžik přepočtu rozložení.

Řešení: pod vhodnou šířkou jeden sloupec filtrů, omezení vnitřní minimální šířky vstupů a kontrola i s delšími názvy. Neschovávat problém pouhým oříznutím stránky. Zdroj: `.analysis-filters` v `src/style.css`. Důkaz: `/tmp/audit-analysis-overflow.png`.

### A04 — Detail po úhradě krátce nabízí neaktuální akce — P1

Po úspěšném zápisu úhrady se otevře detail se starou kopií dat před dokončením nového načtení. Při řízeném zpoždění ledgeru 700 ms bylo tlačítko Smazat příspěvek nejprve aktivní a po načtení správně zakázané.

**Databázová ochrana funguje:** zaplacený předpis se smazat nesmí a SQL regresní testy to potvrzují. Nález se týká nesouladu rozhraní a důvěryhodnosti zobrazeného stavu.

Řešení: potvrdit přechod až s aktuálním ledgerem, nebo bezpečně zapracovat vrácenou úhradu do lokálních dat. Do načtení zakázat citlivé akce. Zdroj: `src/ClubFeesDialog.tsx:23`, `src/clubFees.ts:34`.

### A05 — Chybí automatická brána kvality před vydáním — P1

V repozitáři není `.github/workflows`. Z 38 samostatných browser scénářů šest neprošlo; není správné tvrdit, že všechny starší kontroly jsou stále zelené.

| Scénář | Výsledek došetření |
|---|---|
| FEE_RECURRING | Odpovídá mezistavu A04. Po novém načtení zákaz smazání funguje. |
| NAVIGATION | Selektor `.header-chat` vybírá zároveň Kluby a Chat. Po jeho dočasném zpřesnění test dále očekává již odstraněný duplicitní nadpis klubu. Zastaralá očekávání testu. |
| THEME_GUESTS | Hledá Vezmu hosta v právě otevřené informační záložce. Tlačítko patří do Účasti; scénář neodpovídá novému rozdělení detailu. |
| OVERVIEW_COLORS | Událost „zítra“ v neděli připadá do příštího týdne. S dočasně normalizovaným termínem v aktuálním týdnu test prošel. |
| COLORS | Po přepnutí na aktuální týden očekává zítřejší pondělní událost. S normalizovaným termínem test prošel. |
| SIMPLIFY | Nejprve stejný problém s termínem mimo aktuální týden; po jeho odstranění odhalil skutečné přetékání Analýzy A03. |

Dočasné úpravy diagnostických skriptů jsou jen v `/tmp`, nikoli změny aplikace. Řešení: deterministický čas i termíny, sémantické selektory, očekávání aktuálního UI, síťové zpoždění v testech a povinné CI před sloučením.

### A06 — Obnova po pádu existuje, ale provozní diagnostika nestačí — P1

LoadBoundary zachytává selhání importu/vykreslení a po 15 s nabízí obnovu. Testy tohoto chování prošly. V projektu však nebyl nalezen centrální sběr těchto chyb ani přehled poruch podle vydání.

Řešení: anonymizované chybové hlášení s verzí, obrazovkou a typem chyby, sledování nedostupných modulů, jasná nabídka nové verze po bezpečném dokončení práce. Samotné tlačítko Obnovit není doklad odstranění všech spouštěčů chyb. Zdroj: `src/LoadBoundary.tsx`.

### A07 — Úplná historie se znovu stahuje každých 10 s — P1 před větším počtem klubů

`loadClubData` stránkuje po 500 řádcích a pro trenéra načítá všechny události, členy a účasti. `useAutoRefresh` ho volá opakovaně. Nejde o chybný limit zkracující historii: všechny stránky se skutečně dočítají.

Riziko je přenos a počet dotazů. Například 15 600 účastí znamená 32 stránek jen pro tuto tabulku v jednom načtení. To je modelový výpočet, nikoli změřená produkční zátěž. Ochrana proti souběžným načtením již existuje.

Řešení: načítání podle období a obrazovky, serverové agregace, změnový kurzor nebo cílený realtime, společná cache a odlišný interval pro zprávy a archiv. Zdroj: `src/clubData.ts:31`, `src/useAutoRefresh.ts`.

### A08 — Světlý režim potřebuje kontrolu kontrastu — P2

Oranžový drobný text `#FFB317` na bílé vychází přibližně 1,79:1, například u nadpisů nápovědy příspěvků. Aktivní tlačítko s tmavým textem na oranžové má jinou situaci a není tímto nálezem označeno za vadné.

Řešení: zachovat značkovou oranžovou, pro drobný text ve světlém režimu použít čitelný tmavý odstín a oranžovou jako akcent. Ověřit automatickým nástrojem i ručně. Zdroj: `.fee-help-grid h4`, `src/light-theme.css`.

### A09 — Oznámení nemají jeden provozní a uživatelský přehled — P2

Implementace má více cest: Auth e-maily, ruční připomenutí, automatické RSVP e-maily, coach push, chat a zvoneček. Uživateli chybí jednotné preference; správci rychlé rozlišení zapnuto / připraveno / chyba / předáno poskytovateli / doručeno.

Řešení: uživatelské preference podle typu oznámení a přehled technického stavu pro správce služby. Resend webhooky a historie doručování až s jasným přístupovým modelem. API klíče, Vault a Cron má spravovat provozovatel Trenomi, nikoli každý trenér jednotlivě.

### A10 — Nový nezávislý správce si sám první klub nezaloží — P2 před veřejným náborem

`create_managed_club` vyžaduje, aby přihlášený uživatel již byl vlastníkem aktivního klubu. To je platné omezení pilotu, nikoli bezpečnostní chyba. Pro veřejnou nabídku novým klubům ale chybí zavedení prvního správce.

Řešení: oddělit „Jsem člen, připojit se“ a „Spravuji klub, založit klub“ s odpovídajícím ověřením. Současné role nepovolovat plošně. Zdroj: migrace 030, `create_managed_club`.

## Srovnání s konkurencí

Zdroje jsou oficiální veřejné popisy funkcí, ověřené 18. 10. 2026. Dostupnost se může lišit podle plánu, země a zařízení. Ceníky ani skutečnou rychlost obsluhy zde nehodnotím.

| Služba a zdroj | Co veřejně dokládá | Závěr pro Trenomi |
|---|---|---|
| [Týmuj](https://www.tymuj.cz/) | Události a jejich opakování, docházka, podskupiny, automatické absence, zprávy, galerie a soubory. | Organizace týmu je základní očekávání. Naší příležitostí je kvalitnější propojení s tréninkovým záznamem, minihrami a sdílením; doplnit oznámení delší absence. |
| [Spond](https://www.spond.com/) | Události, pozvánky a připomínky, zprávy, soubory, platby, rodiče/opatrovníci. | V provozu klubu, rodinném přístupu a vybírání peněz mají širší veřejně doloženou nabídku. Trenomi nabízí specifický OCR/deníkový postup a vizuální výstup. |
| [Heja](https://heja.io/) | Rozvrh, odpovědi a připomínky, komunikace rodičů/hráčů, organizace dopravy a synchronizace osobního kalendáře. | Důležité je rychlé každodenní ovládání. Prioritou je osobní kalendář a jednoduchost; rodinné účty až podle cílových klubů. |
| [TeamSnap](https://www.teamsnap.com/teams) | Rozvrh, RSVP, úkoly, chat, vybírání plateb a hotové tréninkové plány. | Běžné organizační funkce má Trenomi podobného typu, jejich dostupnost a pohodlí však musí doložit provozem. Chybí online výběr plateb a hotový obsah plánů. |
| [Sportlyzer](https://www.sportlyzer.com/en/) | Členové a rodiče, faktury, import bankovních výpisů, RSVP, sezónní plánování, testování, rozvoj hráčů, tréninkový deník. | Neplatí, že samotný deník je unikátní. Zaostáváme v administraci plateb a dlouhodobém plánování; máme konkrétní klubové/OCR detaily a vlastní editor sdílení. |
| [TrainingPeaks](https://www.trainingpeaks.com/become-a-coach/) | Strukturované plánování, výkonnostní přehledy, spolupráce trenéra se sportovcem, zařízení/aplikace a prodej plánů. | Pro individuální výkonnostní coaching je funkčně dál. Trenomi se má odlišit společným klubovým tréninkem, hosty, událostmi a společným deníkem; nyní neslibovat náhradu sportovní analytiky. |

### Kde má Trenomi silné vlastní řešení

- Událost není pouze položka kalendáře: navazuje skutečná účast, průběh, výsledky, hry a sdílení.
- Hosté bez účtu a jejich opětovné použití odpovídají reálnému provozu otevřeného klubu.
- OCR typy a doprovod jsou přímo v produktu, včetně návazností na závodní výsledky.
- Doplnění neplánované minihry a týmových výsledků po tréninku.
- Editor s vlastní fotografií, gesty, kompozicemi a klubovou identitou; rozdíl mezi společnou titulní fotkou a osobní fotkou pro sdílení.
- Soukromá komunikace člena s trenéry vedle společného chatu události.

Toto jsou doložené vlastnosti Trenomi a vhodné odlišení. Nepotvrdil jsem jejich výlučnost na celém trhu ani to, že je uživatelé hodnotí lépe než řešení konkurence. To musí ukázat srovnávací uživatelský test.

### Kde potřebujeme dohnat běžné očekávání

1. **Osobní kalendář:** přidání jednotlivé události přes ICS a následně odběr/synchronizace. Odběrové odkazy musí jít odvolat, hlídat soukromí a změny termínů; export je jiná funkce než obousměrná synchronizace.
2. **Platby:** z evidence udělat jednodušší úhradu. Nejprve platební instrukce/QR a variabilní symbol, potom import výpisu s potvrzením párování. QR není potvrzení přijetí peněz. Platební brána až podle poptávky a nákladů.
3. **Rodiny:** jeden rodič, více dětí, sourozenci ve více klubech, odpovědi a platby za konkrétní dítě. Pro mládežnické kluby zásadní, pro současný dospělý OCR pilot méně naléhavé.
4. **Komunikace:** hledání zprávy, připnuté pokyny, potvrzení seznámení a sdílené dokumenty. Soukromý kontakt s trenérem zachovat, automaticky neotevírat veřejný hlavní chat.
5. **Dlouhodobý rozvoj:** vývoj jednotlivce, osobní rekordy, cíle a sezónní plán. Propojení se Stravou/Garminem později podle ověřené poptávky a podmínek API.
6. **Samostatný vstup klubu:** import členů s kontrolou duplicit, zavedení správce a krátký průvodce prvním tréninkem.

## Co zjednodušit a co zachovat

### Navrhovaná struktura

- Člen: ponechat Přehled, Kalendář, Deník. V přehledu jen nejbližší událost, akce vyžadující odpověď a vlastní nevyřízené úkoly. Nevytvářet znovu samostatnou docházku člena.
- Trenér na mobilu: ověřit variantu pěti položek Přehled / Události / Členové / Deník / Více. Do Více přesunout méně časté Šablony, Analýzu a Nastavení. Docházku zachovat jako dostupný pohled v Událostech a samostatnou hromadnou matici; nejprve otestovat, zda přesun nezpomaluje trenéra.
- Jedna událost jako hlavní pracovní místo: Informace, Účast, Záznam/Výsledky, Chat. Úkoly a Minihry ukazovat podle obsahu. Není účelné sloučit tabulkovou docházku, osobní deník a analýzu do jedné obří obrazovky.
- Příspěvky členovi nejprve ukázat jako „K úhradě / Uhrazeno“; historie a filtry až druhá úroveň. Trenérovi ponechat sazby a dávkové operace.
- Editor sdílení otevřít s dobrou automatickou volbou, čtyřmi doporučenými kompozicemi a rychlým exportem. Ostatní styly, vrstvy a logo pod pokročilými volbami. Stávající šablony nerušit bez výsledků používání.
- V Nastavení oddělit Můj účet, Klub a Správa. Archivaci klubu dát do jasně označené správy; nevystavovat ji mezi běžnými úpravami vzhledu.

### Co nyní nepřidávat

Další sadu podobných šablon, vlastní sociální feed, live tracking, marketplace trenérů a rozsáhlou analytiku sporttesterů. Každá z těchto věcí může mít smysl později, ale nyní by zvyšovala složitost bez vyřešení nejčastější práce v klubu.

## Pořadí realizace a podmínky dokončení

| Etapa | Obsah | Podmínka přijetí |
|---|---|---|
| 1. Kvalita | A01–A06, oprava zastaralých testů a CI; ověřit skutečné doručení e-mailu/push na vybraných vlastních testovacích účtech. | Všechny udržované scénáře projdou, žádný tichý zánik konceptu, žádný přesah na 320 px, konzistentní dialogy a finanční stav. |
| 2. Jednoduchost | Ověřit mobilní navigaci a stručnější formuláře, průvodce prvním použitím, stav oznámení, cílenější načítání A07. | Začínající člen najde odpověď bez vysvětlování, trenér dokončí běžný trénink bez hledání mezi obrazovkami. |
| 3. Konkurenční základ | ICS, platební instrukce/QR, variabilní symbol a import výpisu; import členů a vstup nového klubu. | Praktický průchod s druhým nezávislým klubem, zrušení/změna termínu v kalendáři, platby párované bez falešného potvrzení. |
| 4. Odlišení | Osobní vývoj, OCR a minihry, přehledný klubový výstup ke sdílení. Rodinné účty při vstupu do mládežnických klubů. | Prokazatelné využití oproti obecnému plánování týmu, nikoli jen počet nových funkcí. |

Navržené cíle pro měření (nejsou současnými naměřenými výsledky): člen vyplní odpověď do 10 s od otevření detailu; trenér u běžné události zvládne docházku a stručný záznam do 2 min; nový správce založí první použitelný klub do 15 min. Měřit také dokončené registrace, podíl odpovědí do začátku, neúspěšná uložení, opakované pády a úspěšně doručená oznámení.

Pro veřejný provoz doplnit viditelné informace o zpracování osobních údajů, kontaktu a postupu exportu/ukončení účtu. V prohlédnutém registračním toku nejsou odpovídající odkazy a nebyla nalezena samoobslužná cesta smazání účtu. Logická archivace klubu a ZIP záloha existují; skutečné infrastrukturní zálohování a obnovu je nutné doložit samostatně. Pro rodinné účty posoudit také správu souhlasů a přístupu k fotografiím. Nejde o závěr, že aplikace právní předpisy porušuje.

## Jak poznáme, že jsme lepší

Porovnat stejné úkoly na Trenomi a zvolené konkurenční službě se souhlasem testerů: připojit se do klubu, odpovědět na událost, oznámit hosta, dokončit docházku a deník, najít nedoplatek, vytvořit sdílený výstup. Měřit úspěšnost bez pomoci, čas, chyby a počet opuštěných kroků. První kolo alespoň jeden trenér a čtyři členové, potom dva nezávislé kluby. Bez této zkoušky lze věcně tvrdit, jaké funkce máme, ale ne že je celé ovládání lepší než konkurence.

Nejvhodnější současné zaměření: **menší české sportovní kluby se společným tréninkem, hosty a závody, zvláště OCR a všestranné skupiny**. Pro tento segment lze postavit přesvědčivou službu na jednodušší organizaci a lepším společném tréninkovém záznamu.
