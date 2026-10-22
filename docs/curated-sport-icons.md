# Upravená nabídka sportovních ikon

Triatlon používá schválený otevřený emblém TRI 4 s plavcem z TRI 1. Samostatná průhledná maska je v `public/icons/triathlon-outline.png`, stabilní ID je `triathlon`. Automatické přiřazení rozpoznává Triatlon, Triathlon a Ironman. Ruční výběr je dostupný v šablonách, trénincích a závodech; motiv se přenáší také do kalendáře a detailu. Světlý motiv zachovává šedé ikony a 35% vodoznak, tmavý 15%.

Podle žlutých značek na příloze bylo odebráno 20 voleb: Medaile, Šerm, Lukostřelba, Sportovní výživa, Překážkový běh, Hod, Párové veslování, Skok do výšky, Vrh koulí, Bazén, Stadion, Vzpírání, Skoky do vody, Sportovní taška, Píšťalka, Gymnastika, Posilovací lavice, Golf, Steeplechase a Stupně vítězů. Původní druhá překážková ikona „Skok přes překážku“ zůstává dostupná. Celkem je v nabídce 26 ikon včetně BC4, H3 a H1.

Původní obrázkový atlas má neměnné souřadnice. Souřadnice se počítají z původního pořadí, nikoliv z filtrované nabídky, aby se zbývající sporty neposunuly na jiný motiv. Vyřazené buňky atlasu nejsou v nabídce ani se nepoužívají pro automatické přiřazení. Stará explicitní volba se při čtení chová jako automatická a při úpravě se resetuje; neznámé vstupy zůstávají odmítané.

Po předchozích migracích spusťte `supabase/migrations/202610220050_curated_triathlon_icons.sql`. Přidá triatlon do databázového seznamu, vyřazené volby u šablon a událostí nastaví na NULL (automaticky) a poté je odstraní z povolených hodnot. Nemění typy, plány, dokončení ani docházku. Klient do nasazení migrace blokuje zápis nové triatlonové volby s konkrétní informací o migraci 050; ostatní ponechané ikony fungují i před ní.

Ověření: unit testy rozpoznání typů, všech vyřazených ID, stabilních souřadnic a migrační brány; skutečný SQL přechod ze staré nabídky na novou s 20 vyřazenými a 2 zachovanými volbami v dokončených událostech; regrese výběru, dědění, závodů a RLS. Browser scénář `STG_CURATED_ICONS_ONLY` kontroluje i úpravu staré šablony, oba motivy, mobil/PC a zachování všech 26 voleb.

## Běh a cvičení — BC4

Schválená BC4 spojuje běžce a shyby na hrazdě. Používá samostatnou průhlednou masku `public/icons/run-workout-outline.png`, ID `run-workout` a popisek „Běh a cvičení“. Je dostupná ve výběru šablon i událostí a používá společné barvy, velikosti a intenzitu vodoznaků. Automatické přiřazení rozpoznává typy „Běh a cvičení“, „Run & Workout“ a „Cvičení a běh“; běžné OCR závody si zachovávají motiv ručkování. Samotný název šablony automatické přiřazení nemění.

Po dříve nasazené 050 spusťte celý soubor `supabase/migrations/202610220051_run_workout_icon.sql` v Supabase SQL Editoru. Rozšíří povolené hodnoty ikon v šablonách a událostech a přidá kontrolu dostupnosti; existující řádky, docházku ani dokončení neupravuje. Starší migrace neopakujte. Do spuštění 051 aplikace explicitní uložení BC4 bezpečně zastaví a zobrazí číslo potřebné migrace. Automatické zobrazení podle typu zápis nové hodnoty nevyžaduje.

Kontrola `STG_RUN_WORKOUT_ICONS_ONLY=1` ověřuje průhlednou masku, obě témata a mobil/PC, ruční výběr a uložení, obnovu, chybějící migraci, převzetí ze šablony, kalendář, detail a členský přehled. SQL test `run_workout_icons.sql` kontroluje skutečné ukládání do šablon, sérií a závodů a zachování oprávnění.

## HIIT v gymu / hale a Kettlebell — H3 a H1

Schválená H3 s lany a stopkami je v katalogu „HIIT v gymu / hale“ (`hiit`). H1 s kettlebellem a stopkami je samostatná volba „Kettlebell“ (`kettlebell`). Každá má vlastní průhlednou masku ve složce `public/icons`. Stejně jako BC4 jsou dostupné v šablonách a událostech, kalendáři i přehledu. Typy s HIIT / Tabata automaticky používají H3, Kettlebell (i překlep Kettlbell) H1. Výslovně uložené jiné volby se nemění.

Po nasazené 051 spusťte celý soubor `supabase/migrations/202610220052_hiit_kettlebell_icons.sql` v Supabase SQL Editoru. Přidá pouze dvě povolené hodnoty a kontrolu dostupnosti, existující řádky neupravuje. Do spuštění 052 aplikace explicitní uložení těchto ikon zastaví s konkrétní instrukcí; automatické zobrazení podle typu funguje i bez zápisu. Prohlížečová kontrola `STG_SELECTED_HIIT_ONLY=hiit` nebo `kettlebell` testuje oba motivy, mobil/PC, průhlednost, ukládání, chybějící migraci i přenos a zobrazení ve vytvořené události.
