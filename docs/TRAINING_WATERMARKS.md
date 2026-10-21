# Sportovní ikony a vodoznaky

Výběr je v šabloně hned pod názvem: stále viditelný seznam **Ikona tréninku**, náhled a volitelná obrázková mřížka všech 40 ikon. Stejný výběr je také v **Nová událost → Trénink** a **Upravit trénink** hned pod názvem, včetně tréninků bez šablony. Změna u existujícího tréninku se ukládá pouze k této události. Při změně zvolené šablony se načte její ikona; při nové sérii se vybraná ikona předá všem termínům. Automatický výběr při vytváření ze šablony s vlastní ikonou se uloží jako konkrétní ikona odpovídající novému zaměření. Výběr ikony u tréninku využívá již nasazenou migraci 046.

Trenér v **Šablony → Tréninky → Přidat/Upravit šablonu → Ikona tréninku** vybere jednu ze 40 obrysových ikon. Výchozí režim **Automaticky dle zaměření** přiřadí běh, plavání, kolo, sílu, mobilitu a další sporty podle názvu zaměření. Vlastní výběr má přednost; **Bez vodoznaku** dekoraci vypne.

Použit je schválený motiv **velký obrys**, neprůhlednost **15 %**, barva aktuální UI palety. Ikony jsou dekorativní (`aria-hidden`, `pointer-events:none`), nemění rozměry karet ani ovládání. Nová sada je rastrový průhledný atlas PNG, nikoliv SVG. Prohlížeč používá alfa masku, takže ikony lze obarvit bez bílého pozadí; jeden soubor se sdílí napříč kartami a ukládá do běžné HTTP cache. Umístění ikon v atlasu je stabilní, výřezy mají vlastní řádkové souřadnice, aby nebyly vidět sousední piktogramy.

Vodoznaky jsou na šablonách, nejbližším tréninku, týdenním plánu, kartách člena v přehledu a deníku, kalendářových položkách, v záhlaví detailu události a ve vyhodnocení tréninku. Závody mají stejný výběr v editoru pod názvem (**Ikona závodu**), vlastní uloženou ikonu a vodoznak dle disciplíny. Při kopírování závodu se ikona zachová. Fotografie a exportované obrázky ze Studia se touto změnou neupravují.

## Databáze – migrace 046

Jednou spusťte celý obsah `supabase/migrations/202610210046_training_icons.sql` v Supabase SQL Editoru. Starší migrace neopakujte. Migrace přidá volitelné `templates.training_icon`, `events.training_icon`, omezení na schválené identifikátory a kopírování ikony při vytvoření tréninku. Zachovává RLS, role a transakční vytváření sérií i skupinových tréninků. Nevyžaduje Edge Function ani nové klíče.

Nový trénink dostane samostatnou kopii zvolené ikony. Změna či smazání šablony neovlivní jeho ikonu. Zkopírovaný trénink zachovává původní ikonu i bez původní šablony; přepnutí na závod tréninkovou ikonu odstraní. Historické záznamy se hromadně nepřepisují: bez uloženého výběru funguje automatické přiřazení podle zaměření.

Bez migrace zůstávají čtení a automatické ikony funkční, stejně jako ukládání šablon v automatickém režimu. Pokus uložit konkrétní ikonu nebo vypnutí vypíše požadavek na migraci 046. Před vytvářením kopie/série s konkrétní ikonou klient ověří nové pole, aby starší RPC výběr tiše nezahodila.

## Ověření

`npm test`, `npm run build`, `npm run test:database` (jednorázový lokální PostgreSQL), `STG_TRAINING_WATERMARKS_ONLY=1 npm run test:member-ui` proti fiktivnímu Vite backendu; pro WebKit přidat `STG_BROWSER=webkit`.

Kontroly zahrnují automatické přiřazení, vlastní výběr/vypnutí a opětovné načtení šablony, 15% dekoraci, mobil/PC, světlý/tmavý vzhled, trenéra/člena, uchování kopie při změně/smazání šablony, série a zákaz změn členem.

## Závody – migrace 047

Pro ukládání vlastního výběru u závodů spusťte jednou celý soubor `supabase/migrations/202610210047_race_icons.sql` (po již nasazené 046). Starší migrace neopakujte. Migrace upraví původní trigger, který ikony závodů nuloval, a atomické vytváření závodu se soupiskou rozšíří o uložení ikony. Zachována jsou dosavadní oprávnění, validace, mapy i pravidla soupisky. Nové sloupce ani Edge Functions nepřidává.

Před migrací zůstávají závody s automatickou ikonou funkční. Uložení konkrétní ikony nebo volby Bez vodoznaku předem ověří dostupnost 047 přes `race_icons_ready`; při chybějící migraci nevytvoří ani nezmění závod s tiše zahozenou volbou. Síťová chyba má vlastní vysvětlení. Po migraci funguje vytvoření, úprava, kopírování, vypnutí i obnovení automatické ikony. Členové mohou vodoznak zobrazit, výběr mění pouze trenér/správce.
