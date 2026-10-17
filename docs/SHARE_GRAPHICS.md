# Grafika pro sdílení tréninku

V trenérském Deníku otevřete záznam tréninku a panel **Sdílet trénink**.

![Skutečné exporty všech 12 kompozic](designs/trenomi-share-12-implemented.png)

Přehled výše vzniká přímo stejným Canvas rendererem jako stažené PNG. Používá ilustrační fotografii z Unsplash (photo-1518611012118-696072aa579a) a smyšlené údaje, nikoli data členů. Fotografie se do aplikace nepřidává; každý klub používá vlastní galerii.

| Šablona | Vlastní vizuální princip |
| --- | --- |
| 01 Fotografický plakát | Celoplošný snímek, diagonální žlutý titulkový pás a kompaktní údaje mimo fotografii. |
| 02 Přehled výkonu | Výrazná hlavní skutečná hodnota, obrysová typografie a žluté datové bloky. Bez fotografie. |
| 03 Klubový deník | Světlá magazínová sazba s výrazným kurzivním serifovým písmem a boční tiráží. |
| 04 Sportovní poster | Žlutá kampaňová grafika, velký název, diagonální fotografický výřez a černé datové štítky. |
| 05 Galerijní rám | Nakloněná papírová karta se stínem, fotografií a serifovým popiskem. |
| 06 Filmový pás | Filmové perforace po stranách, titulková sazba a tmavá kompozice. |
| 07 Boční panel | Portrétní karta s fotografií vpravo, žlutým názvem a datovými štítky vlevo; ve Story rozvržení nad sebou. |
| 08 Černobílý dokument | Velká monochromatická fotografie a drobná čistá sazba. Černobílá úprava platí jen pro export, ne pro originál. |
| 09 Nejlepší výkony | Tři výsledkové karty s velkým pořadím, skutečnými hodnotami a jmény standardně skrytými. Bez fotografie. |
| 10 Noční trénink | Tmavý zelený přechod, jemná bodová síť, obloukový fotografický rám a mátové datové bloky. |
| 11 Atletická dráha | Žluté pozadí a soustředné atletické ovály kolem asymetricky zaoblené fotografie. |
| 12 Klubová vstupenka | Krémová perforovaná vstupenka, fotografie a samostatný žlutý datový útržek. Nejde o vstupní oprávnění ani QR kód. |

Volbu otevřete kliknutím na aktuální šablonu (**Změnit · 12 šablon**). Nabídka obsahuje číslované miniatury a po volbě se zavře. Náhledy nabídky se vykreslují jen při jejím otevření.

U všech deseti fotografických šablon mají klubová hlavička, název, metriky i značka oddělené plochy mimo fotografii. Snímek se nepřekrývá textem. Dlouhé názvy se zalomí, případně zmenší či zkrátí výpustkou. Sportovní, noční a atletický styl mají ve vyplněném režimu vlastní tvar fotografického rámečku; volba Celá fotografie zachová obdélníkový snímek celý.
Náhledové kartičky používají aktuální údaje. Grafika zahrnuje název a dostupné logo klubu, datum v časové zóně Europe/Prague, místo a oficiální logo Trenomi. Chybějící délka, vzdálenost či RPE se nevymýšlí. Výstup používá barvy #FFB317 a #101216 nezávisle na režimu aplikace.

## Fotografie a výřez

Fotografii vyberte v galerii tréninku. Ve všech fotografických šablonách lze volit:

- **Vyplnit rámeček** (výchozí): fotografie zaplní vyhrazenou plochu, přesah se ořízne.
- **Celá fotografie**: při základním přiblížení zůstane vidět celý snímek; rozdíl poměrů stran vyplní neutrální pozadí. Vhodné pro skupiny, kde nechcete nikoho oříznout.

Na notebooku a počítači zůstávají posuvníky **Přiblížení**, **Vodorovný posun** a **Svislý posun**.

Na mobilním zařízení posouvejte fotografii přímo prstem v náhledu; dvěma prsty ji přibližujte/oddalujte v rozsahu 1–3×. Přiblížení drží uchopené místo pod prsty a lze současně posouvat. Dotyková plocha odpovídá fotografii včetně tvarovaných rámečků; rolování stránky funguje mimo snímek. Pro přístupnost zůstávají posuvníky dostupné pod **Přesné nastavení výřezu**. Dotykový režim se určuje podle vstupu zařízení (coarse pointer bez hover), nikoli pouze podle šířky okna. Na notebooku s myší tak zůstane původní ovládání i v úzkém okně.

**Obnovit výřez** vrátí střed a základní přiblížení při zachování způsobu zobrazení. Při vyplnění může být v základním přiblížení jeden posuv bez účinku, pokud fotografie daný rozměr přesně vyplňuje. Výběr jiné fotografie resetuje posun a přiblížení. Výřez i případná monochromatická varianta ovlivňují jen aktuální export, nikoli původní soubor či data tréninku.

## Výstupy

PNG 1080 × 1080 (1:1), 1080 × 1350 (4:5), 1080 × 1920 (9:16). Story má větší horní a dolní bezpečný okraj. Titulek lze upravit, dlouhý název se zalomí a případně zkrátí výpustkou. Stažený obrázek odpovídá náhledu; export se zpřístupní až po dokončení aktuálního vykreslení. Mobilní systémové sdílení používá Web Share API, ostatní prohlížeče stáhnou soubor. Text příspěvku lze kopírovat zvlášť.

Šablony se vykreslují lokálně přes Canvas, bez AI služby a bez přístupu k účtům sociálních sítí. Nevyžadují SQL migraci ani změnu Supabase funkce.

## Písma a ověření

Písma jsou hostována v `public/fonts`, aby export nezávisel na externím fontovém serveru:

- Barlow Condensed ExtraBold: https://github.com/google/fonts/tree/main/ofl/barlowcondensed
- Cormorant Garamond Italic: https://github.com/google/fonts/tree/main/ofl/cormorantgaramond
- Manrope: https://github.com/google/fonts/tree/main/ofl/manrope

Všechna tři písma mají přiloženou licenci SIL Open Font License (`*-OFL.txt`). Používají se jen ve sdílené grafice.

Kontroly: `npm run build`, `npm test`, `npm run test:share-ui`, `npm run test:share-touch-ui` (běžící Vite na portu 5173; pro systémový Chromium nastavte `CHROMIUM_PATH=/usr/bin/chromium`). Kontroly používají jen smyšlená data, nezapisují do Supabase a ověřují:

- 36 PNG kombinací všech 12 šablon a tří formátů, shodu náhledu a stažení, chybějící fotografii/logo/údaje, dlouhé české názvy a šířky 320/390/1440 px.
- U 30 fotografických kombinací pixely uvnitř skutečného fotografického tvaru, aby přes snímek nebyl vykreslen text ani dekorace; výslovně také monochromatický výstup dokumentární varianty.
- Skutečné dvouprsté dotykové události v mobilním Chromiu: zoom, posun, ukotvení, limit přiblížení, zrušení, reset, přesnou shodu staženého PNG, rolování mimo fotografii a neaktivní odříznuté rohy rámečků.

Přehled lze znovu vytvořit: `npm run preview:share-gallery -- /cesta/k/ilustracni-fotografii.jpg /tmp/prehled.png`. Používá přímo produkční renderer; ilustrační fotografii je potřeba dodat lokálně. Licence přehledové fotografie: https://unsplash.com/license; zdroj: https://images.unsplash.com/photo-1518611012118-696072aa579a .

Sdílení se otevírá tlačítkem **Sdílet trénink** vedle **Upravit** v samostatném okně. Zavření tlačítkem či Escape vrátí fokus na původní tlačítko. Galerie pamatuje vybranou fotografii pro každý klub a trénink v rámci otevřené relace prohlížeče (sessionStorage); ukládá cestu, nikoli dočasnou blob URL. Při smazání fotografie použije dostupnou první fotografii.

Regresní ověření okna a výběru: `CHROMIUM_PATH=/usr/bin/chromium npm run test:journal-share-ui`.


### Titulní fotografie tréninku (migrace 036)

V deníku otevřete trénink → **Upravit** → pod galerií zvolte **Zvolit titulní**. Volba se ukládá okamžitě, označí se jako **Titulní fotografie** a při opakovaném otevření má přednost před dřívějším dočasným výběrem. **Zrušit titulní fotografii** vrátí automatický výběr. Při odstranění souboru galerie bezpečně použije dostupnou fotografii.

Nejdříve spusťte `supabase/migrations/202610170036_training_cover_photo.sql` v Supabase SQL Editoru. Přidává pouze volitelný sloupec `events.cover_photo_path` s kontrolou souboru ze stejného klubu a události. Dosavadní fotografie se nepřesouvají a volba titulní fotografie nemění dokončení tréninku. Nastavení chrání stávající oprávnění trenérů a archivace klubu. Edge funkce se nemění.

Na PC je okno sdílení explicitně vystředěné a široké až 960 px. V deníku se hlavní fotografie vykresluje v původním poměru stran bez ořezu a souhrn docházky, délky, vzdálenosti a RPE je napravo. Mobilní rozložení zůstává pod sebou.
