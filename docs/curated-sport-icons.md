# Upravená nabídka sportovních ikon

Triatlon používá schválený otevřený emblém TRI 4 s plavcem z TRI 1. Samostatná průhledná maska je v `public/icons/triathlon-outline.png`, stabilní ID je `triathlon`. Automatické přiřazení rozpoznává Triatlon, Triathlon a Ironman. Ruční výběr je dostupný v šablonách, trénincích a závodech; motiv se přenáší také do kalendáře a detailu. Světlý motiv zachovává šedé ikony a 35% vodoznak, tmavý 15%.

Podle žlutých značek na příloze bylo odebráno 20 voleb: Medaile, Šerm, Lukostřelba, Sportovní výživa, Překážkový běh, Hod, Párové veslování, Skok do výšky, Vrh koulí, Bazén, Stadion, Vzpírání, Skoky do vody, Sportovní taška, Píšťalka, Gymnastika, Posilovací lavice, Golf, Steeplechase a Stupně vítězů. Původní druhá překážková ikona „Skok přes překážku“ zůstává dostupná. Celkem je v nabídce 23 ikon.

Původní obrázkový atlas má neměnné souřadnice. Souřadnice se počítají z původního pořadí, nikoliv z filtrované nabídky, aby se zbývající sporty neposunuly na jiný motiv. Vyřazené buňky atlasu nejsou v nabídce ani se nepoužívají pro automatické přiřazení. Stará explicitní volba se při čtení chová jako automatická a při úpravě se resetuje; neznámé vstupy zůstávají odmítané.

Po předchozích migracích spusťte `supabase/migrations/202610220050_curated_triathlon_icons.sql`. Přidá triatlon do databázového seznamu, vyřazené volby u šablon a událostí nastaví na NULL (automaticky) a poté je odstraní z povolených hodnot. Nemění typy, plány, dokončení ani docházku. Klient do nasazení migrace blokuje zápis nové triatlonové volby s konkrétní informací o migraci 050; ostatní ponechané ikony fungují i před ní.

Ověření: unit testy rozpoznání typů, všech vyřazených ID, stabilních souřadnic a migrační brány; skutečný SQL přechod ze staré nabídky na novou s 20 vyřazenými a 2 zachovanými volbami v dokončených událostech; regrese výběru, dědění, závodů a RLS. Browser scénář `STG_CURATED_ICONS_ONLY` kontroluje i úpravu staré šablony, oba motivy, mobil/PC a zachování všech 23 voleb.
