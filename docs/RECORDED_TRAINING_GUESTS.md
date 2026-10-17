# Hosté zapsaní trenérem po tréninku

## Aktivace

Po předchozích migracích včetně 033 spusťte v Supabase SQL Editoru celý soubor [202610170034_recorded_training_guests.sql](../supabase/migrations/202610170034_recorded_training_guests.sql). Web používá novou funkci `add_recorded_training_guest`; bez migrace zobrazí při pokusu o zápis konkrétní zprávu. Edge Functions ani e-mailové šablony se kvůli této změně neupravují.

## Použití

V **Deníku → detailu uplynulého tréninku → Přidat hosta na trénink**, případně v **detailu události → Účast**, zvolte **Nový host** nebo **Vybrat z evidence** a potvrďte **Zapsat přítomného hosta**.

- Nový host se uloží do Členové jako **Host bez účtu**, zároveň se zaznamená jeho přítomnost. Účet ani e-mailová pozvánka se nevytváří.
- Příště lze vybrat stejný aktivní záznam bez účtu. Hosté již uvedení v soupisce daného tréninku se znovu nenabízejí; jejich docházku upravte v seznamu účastníků.
- U nového hosta se kontroluje shoda jména s uloženými hosty bez účtu. Místo další kopie vyberte existující záznam; archivovaného hosta nejprve obnovte. Pro jinou osobu se stejným jménem použijte rozlišující jméno.
- Host nově zapsaný tímto postupem zůstává v registru, ale nenabízí se automaticky v docházce nesouvisejících tréninků. Účast se přidává výslovně. Existující ručně evidovaní hosté ani jejich historie se nepřepisují.
- Doplnění do dokončeného tréninku jej otevře ke kontrole. Po ověření znovu použijte Dokončit trénink. Ostatní události zůstávají beze změny.
- Postup je určen trenérovi a správci, pouze pro skončené nezrušené tréninky, včetně skupinových. Nemění přihlašování členů před událostí ani jejich možnost pozvat vlastní hosty.

Pokud později hostovi výslovně pozvete účet nebo schválíte přihlášku propojenou s jeho záznamem, migrace umožňuje přiřadit účet ke stejnému záznamu a zachovat jeho docházku.
