# Mapa místa a přístupové šipky

U každé události lze nepovinně uložit jeden bod srazu, nejvýše osm směrových šipek a krátké pokyny (500 znaků). Vše je společné pro klub; úpravu provádí trenér nebo správce, člen mapu pouze prohlíží.

## Použití

1. V nové události nebo její úpravě otevřete pod polem Místo **Mapa místa a přístup (volitelné)**.
2. Vyhledejte adresu/název místa nebo vložte GPS ve formátu `49.854, 18.542`. Vyberte nalezené místo. Případně tlačítkem **Označit místo** umístěte bod přímo v mapě.
3. Vyberte **Přidat šipku** a klepněte nejdříve na její začátek, potom na konec. Šipky jsou uložené geograficky, takže zůstávají na stejném místě při posunu i přiblížení mapy. Jednotlivé šipky můžete odebrat.
4. Volitelně doplňte **Jak se dostat na místo** a uložte celou událost. **Odstranit mapu a šipky** odstraní mapu až po uložení formuláře; zrušení úprav původní mapu zachová.
5. Člen i trenér uvidí uloženou mapu v záložce **Informace** v detailu události. Zde najdou i odkazy **Spustit navigaci** (Google Maps) a **Otevřít Mapy.com**. Navigace používá bod srazu; nakreslené šipky a poznámka upřesňují místní přístup.

Mapa je také dostupná v detailu tréninkového deníku. Kopie události a všechny termíny nové série/skupiny převezmou její mapu. Volba jiné tréninkové/závodní šablony převezme její mapu, případně mapu vyčistí, pokud ji šablona neobsahuje. Změna textového názvu místa sama geografický bod neposouvá.

Na mobilu lze mapu posouvat a přibližovat dvěma prsty; k dispozici jsou také tlačítka +/−. Při kreslení se bod/šipka zadává klepnutím. Klávesnicí lze po zaměření mapy posouvat její střed šipkami a Enterem vybrat aktuální střed. Tlačítko **Posouvat mapu** kreslení přeruší. Rozbalení mapy je nepovinné, takže prázdná mapa nezabírá místo v členské události.

## Nasazení

Po migraci 037 spusťte jednou celý obsah [038 – mapa místa](../supabase/migrations/202610170038_event_location_map.sql) v Supabase SQL Editoru. Migrace je transakční: přidá nullable `events.event_location`, validaci souřadnic a šipek a aktualizuje stávající funkce pro tvorbu sérií, skupin a závodů. Identifikátory, starší události, docházka, fotografie a přihlašování zůstávají zachované. Edge funkce se nemění.

Události bez mapy lze nadále vytvářet i před migrací. Při pokusu uložit novou mapu aplikace ověří dostupnost nového sloupce, aby starší RPC nemohla mapu tiše zahodit. Chybějící migrace zobrazí pokyn k nahrání 038. Odstraňování/úprava mapy podléhá dosavadnímu RLS událostí; člen mapu nemůže změnit. Skupinové mapy nejsou dostupné členům mimo soupisek.

## Mapové služby

Používá se Leaflet (lokálně sestavený balíček), podklady OpenStreetMap s viditelnou atribucí a hledání Nominatim. API klíč není potřeba. Mapové podklady se stahují při otevření detailu události s mapou nebo při rozbalení editoru mapy; hledání se spouští výslovným tlačítkem, bez automatického našeptávání. Dotazy jsou omezené na jeden za nejméně 1,1 sekundy a výsledky se opakovaně používají v paměti prohlížeče. Klient neukládá a nestahuje mapové dlaždice pro offline použití; používá běžnou HTTP cache služby.

Podklad i hledání mají výslovně nastavené `referrerPolicy: strict-origin-when-cross-origin`: služba dostane pouze doménu aplikace (HTTP Referer), kterou OSM vyžaduje, bez cesty, parametrů či fragmentu přihlašovacího odkazu. Globální `no-referrer` zůstává zachované pro ostatní požadavky. Jeho zdědění mapovými dlaždicemi dříve způsobovalo blokaci 403 podle [pravidel OSM](https://operations.osmfoundation.org/policies/tiles/).

Pro podklad a hledání je potřeba internet. Výpadek služby nepřepíše uloženou geometrii: GPS a navigační odkazy zůstávají dostupné, bod lze zadat souřadnicemi. Veřejný Nominatim je určen pro střídmé interaktivní použití; při větším provozu lze poskytovatele hledání nahradit bez změny uložených map.

## Ověření

- `npm run build` a `npm test` (validace geometrie, normalizace, GPS a chybějící migrace).
- `npm run test:database`: všech 38 migrací, tvorba/úprava/odebrání mapy v sérii, skupině i závodu, omezení JSON, atomické selhání celé série, zákaz změn členem a izolace klubů.
- `VITE_SUPABASE_URL=https://stg-test.example.invalid NODE_OPTIONS=--require=/workspace/stg-validation/system-chromium.cjs STG_EVENT_MAP_ONLY=1 npm run test:member-ui`: fiktivní API a mapové podklady, skutečné dotyky a pinch v Chromiu, uložení a znovuotevření, úprava a smazání, členská verze bez editace, navigační odkazy a šířky 320/390/1440 px.
- Jednorázové read-only ověření skutečné OSM dlaždice a hledání veřejného města Karviná (obě služby HTTP 200); žádná živá událost nebyla měněna.

## Uložená místa a mapy šablon (039)

Po migraci 038 spusťte [039 – uložená místa](../supabase/migrations/202610170039_saved_event_locations.sql) v Supabase SQL Editoru. Přidává `templates.event_location` a klubovou knihovnu `club_locations`; ověřuje také mapy v nastavení závodních šablon. Změny starší mapy, členy ani přihlášení nepřepisují. Edge funkce se nemění.

- V editoru události nebo tréninkové/závodní šablony označte mapu a použijte **Uložit místo pro příště**. Zadejte vlastní název, např. Judo hala, Workout lodičky, Workout Dubina nebo Workout za bazénem. Žádná fiktivní místa ani souřadnice se automaticky nezakládají.
- **Uložená místa** vyplní název místa i mapu se všemi šipkami a pokyny. Seznam je společný pro trenéry klubu a funguje i při příštím přihlášení nebo na jiném zařízení.
- Uložení do knihovny je samostatná akce. Událost/šablonu následně uložte běžným tlačítkem formuláře.
- Nové události ze šablony přebírají mapu. Jde o samostatné kopie: změna či odebrání knihovního místa ani šablony nepřepíše starší události. Pro odlišnou variantu místa uložte nový název.
- **Odebrat uložené místo** vyžaduje potvrzení; smaže pouze nabídku v knihovně. Aktuální mapa ve formuláři i existující události/šablony zůstávají. **Odstranit mapu a šipky** naopak vymaže pouze mapu upravované události/šablony po uložení formuláře.
- Členové vidí mapu a navigaci v událostech podle dosavadních oprávnění. Knihovnu spravují pouze trenéři a správce; RLS izoluje kluby. Uložená místa jsou zahrnutá v automatické záloze klubu a po archivaci jsou uzamčená.

Ověření 039: SQL regrese validace, rolí, oddělení klubů, samostatných kopií a archivní zálohy; prohlížečový scénář uloží místo, znovu načte aplikaci, použije ho v obou druzích šablon, vytvoří události, prověří členskou mapu v Informacích a odebere místo beze změny kopií. Mock respektuje výběr databázových sloupců, aby odhalil ztrátu mapy při opakovaném načtení.
