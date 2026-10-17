# Grafika pro sdílení tréninku

V trenérském Deníku otevřete záznam tréninku a panel **Sdílet trénink**.

- **Fotografický plakát**: fotografie z galerie, výrazný název a skutečné údaje z deníku. Bez fotografie se použije grafické pozadí.
- **Přehled výkonu**: velká dominantní hodnota (skutečná délka, případně vzdálenost nebo účast) a další zaznamenané údaje; fotografie není potřeba.
- Dosavadní **Nejlepší výkony** zůstávají dostupné. Jména se nezahrnují, dokud je trenér výslovně nezapne.

Náhledové kartičky používají aktuální údaje. Grafika zahrnuje název a dostupné logo klubu, datum v časové zóně Europe/Prague, místo a oficiální logo Trenomi. Chybějící délka, vzdálenost či RPE se nevymýšlí. Výstup používá barvy #FFB317 a #101216 nezávisle na režimu aplikace.

## Fotografie a výřez

Fotografii vyberte v galerii tréninku. Ve fotografické šabloně upravte **Přiblížení**, **Vodorovný posun** a **Svislý posun**. Posun pracuje v mezích fotografie, takže nevzniknou prázdné okraje. Při základním přiblížení může být jeden směr bez účinku, pokud fotografie tento rozměr přesně vyplňuje. **Obnovit výřez** vrátí střed a základní přiblížení. Výřez se vztahuje pouze na aktuální grafiku; původní soubor ani data tréninku se neupravují. Výběr jiné fotografie resetuje výřez.

## Výstupy

PNG 1080 × 1080 (1:1), 1080 × 1350 (4:5), 1080 × 1920 (9:16). Story má větší horní a dolní bezpečný okraj. Titulek lze upravit, dlouhý název se zalomí a případně zkrátí výpustkou. Stažený obrázek odpovídá náhledu; export se zpřístupní až po dokončení aktuálního vykreslení. Mobilní systémové sdílení používá Web Share API, ostatní prohlížeče stáhnou soubor. Text příspěvku lze kopírovat zvlášť.

Šablony se vykreslují lokálně přes Canvas, bez AI služby a bez přístupu k účtům sociálních sítí. Nevyžadují SQL migraci ani změnu Supabase funkce.

## Písma a ověření

Písma jsou hostována v `public/fonts`, aby export nezávisel na externím fontovém serveru:

- Barlow Condensed ExtraBold: https://github.com/google/fonts/tree/main/ofl/barlowcondensed
- Manrope: https://github.com/google/fonts/tree/main/ofl/manrope

Obě písma mají přiloženou licenci SIL Open Font License (`*-OFL.txt`). Používají se jen ve sdílené grafice.

Kontroly: `npm run build`, `npm test`, `npm run test:share-ui` (běžící Vite na portu 5173; pro systémový Chromium lze nastavit `CHROMIUM_PATH=/usr/bin/chromium`). Poslední kontrola používá pouze smyšlená data a ověřuje devět PNG výstupů, přesnou shodu náhledu a stažení, posun/přiblížení/reset, chybějící fotku/logo, dlouhé české názvy, soukromí jmen a šířky 320/390/1440 px. Neukládá změny do Supabase.
