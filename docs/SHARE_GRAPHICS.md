# Grafika pro sdílení tréninku

V trenérském Deníku otevřete záznam tréninku a panel **Sdílet trénink**.

| Šablona | Kompozice |
| --- | --- |
| Fotografický plakát | Velká fotografie, samostatný spodní název s jemným žlutým akcentem a údaji. |
| Přehled výkonu | Dominantní skutečná hodnota a další údaje, bez fotografie. |
| Klubový deník | Světlá magazínová sazba: název nad fotografií, údaje pod ní. |
| Sportovní poster | Žlutý titulkový pás a boční diagonální akcent, oba mimo fotografii. |
| Galerijní rám | Světlý paspartový rám, fotografie a samostatný popisek. |
| Filmový pás | Tmavá kompozice s jemnými linkami kolem fotografie. |
| Boční panel | Fotografie vpravo a údaje vlevo; ve Story fotografie nahoře a dva sloupce pod ní. |
| Čistá fotografie | Největší prostor pro fotografii a drobnější doprovodný text mimo ni. |
| Nejlepší výkony | Dosavadní přehled měřených výsledků. Jména jsou ve výchozím stavu skrytá. |

Volbu otevřete kliknutím na aktuální šablonu (**Změnit · 9 šablon**). Nabídka obsahuje miniatury a po volbě se zavře, aby panel zůstal krátký. Náhledy nabídky se vykreslují jen při jejím otevření.

U všech sedmi fotografických šablon mají klubová hlavička, název, metriky i značka oddělené plochy mimo fotografii. Fotografie se neztmavuje a nepřekrývá textem. Dlouhé názvy se zalomí a podle dostupného prostoru zmenší či zkrátí výpustkou; každá textová plocha má vlastní ořez.
Náhledové kartičky používají aktuální údaje. Grafika zahrnuje název a dostupné logo klubu, datum v časové zóně Europe/Prague, místo a oficiální logo Trenomi. Chybějící délka, vzdálenost či RPE se nevymýšlí. Výstup používá barvy #FFB317 a #101216 nezávisle na režimu aplikace.

## Fotografie a výřez

Fotografii vyberte v galerii tréninku. Ve všech fotografických šablonách lze volit:

- **Vyplnit rámeček** (výchozí): fotografie zaplní vyhrazenou plochu, přesah se ořízne.
- **Celá fotografie**: při základním přiblížení zůstane vidět celý snímek; rozdíl poměrů stran vyplní neutrální pozadí. Vhodné pro skupiny, kde nechcete nikoho oříznout.

Dále upravte **Přiblížení**, **Vodorovný posun** a **Svislý posun**. **Obnovit výřez** vrátí střed a základní přiblížení při zachování vybraného způsobu zobrazení. Při vyplnění může být v základním přiblížení jeden posuv bez účinku, pokud fotografie daný rozměr přesně vyplňuje. Výřez ovlivňuje jen aktuální grafiku, nikoli původní soubor či data tréninku. Výběr jiné fotografie resetuje posun a přiblížení.

## Výstupy

PNG 1080 × 1080 (1:1), 1080 × 1350 (4:5), 1080 × 1920 (9:16). Story má větší horní a dolní bezpečný okraj. Titulek lze upravit, dlouhý název se zalomí a případně zkrátí výpustkou. Stažený obrázek odpovídá náhledu; export se zpřístupní až po dokončení aktuálního vykreslení. Mobilní systémové sdílení používá Web Share API, ostatní prohlížeče stáhnou soubor. Text příspěvku lze kopírovat zvlášť.

Šablony se vykreslují lokálně přes Canvas, bez AI služby a bez přístupu k účtům sociálních sítí. Nevyžadují SQL migraci ani změnu Supabase funkce.

## Písma a ověření

Písma jsou hostována v `public/fonts`, aby export nezávisel na externím fontovém serveru:

- Barlow Condensed ExtraBold: https://github.com/google/fonts/tree/main/ofl/barlowcondensed
- Manrope: https://github.com/google/fonts/tree/main/ofl/manrope

Obě písma mají přiloženou licenci SIL Open Font License (`*-OFL.txt`). Používají se jen ve sdílené grafice.

Kontroly: `npm run build`, `npm test`, `npm run test:share-ui` (běžící Vite na portu 5173; pro systémový Chromium lze nastavit `CHROMIUM_PATH=/usr/bin/chromium`). Poslední kontrola používá pouze smyšlená data a ověřuje 27 PNG výstupů všech devíti šablon a tří formátů, přesnou shodu náhledu a stažení, posun/přiblížení/reset, chybějící fotku/logo, dlouhé české názvy, soukromí jmen a šířky 320/390/1440 px. Navíc u 21 fotografických kombinací ověřuje každý pixel plochy fotografie, aby přes ni nebyl vykreslen text ani dekorace; jednotkové testy hlídají oddělení ploch a bezpečné okraje Stories. Neukládá změny do Supabase.
