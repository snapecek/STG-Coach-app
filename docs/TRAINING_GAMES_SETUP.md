# Minihry a výzvy tréninku

## Nasazení

V Supabase SQL Editoru spusťte celý obsah migrace `supabase/migrations/202610140017_training_games.sql`. Starší migrace neopakujte. Rozhraní bez migrace zobrazí vysvětlení a nenabídne zápis; ostatní části tréninku fungují dál.

## Použití

Kalendář → trénink → Minihry. Stejný panel otevřete z detailu deníku tlačítkem „Otevřít minihry“. Trenér vybere název, pravidla, hodnocení a vlastní soupisku z účastníků tréninku. Na trénink lze přidat nejvýše 20 miniher, každou pro 1–100 osob.

- Čas: nižší vítězí, zápis HH:MM:SS.mmm, nejvýše 48 hodin.
- Opakování: vyšší vítězí, celé nezáporné číslo.
- Vzdálenost: vyšší vítězí, metry s nejvýše třemi desetinnými místy.
- Body: vyšší vítězí, celé číslo včetně záporných hodnot.

Nula je platný výsledek u opakování, vzdálenosti a bodů. Chybějící výsledek není nula. Shodné výsledky sdílejí pořadí (1., 1., 3.). DNF a DNS nemají číselný výsledek ani pořadí.

Výsledky se zapisují až po zahájení tréninku. Hodnota a DNF vyžadují potvrzenou přítomnost, DNS potvrzenou nepřítomnost. Pozdější nesoulad s docházkou vyřadí výsledek z pořadí a zobrazí upozornění. Odpovědi Jdu/Nejdu/Možná se nemění.

Změna soupisky zachová výsledky zbývajících osob, odstraněným osobám jejich výsledek smaže. Typ hodnocení je po vytvoření pevný. Smazání minihry vyžaduje potvrzení a zachová účastníky i docházku tréninku. Souběžný zápis s neaktuální revizí databáze odmítne; obnovte panel před opakováním.

## Oprávnění a export

Minihry čtou a spravují pouze trenéři a správci daného klubu. Přímé zápisy do tabulek jsou zakázané; RPC ověřují roli, klub, termín, soupisku, hodnoty i skutečnou docházku. Retenční smazání člena odstraní jeho osobní výsledky a znovu neotevře historický trénink.

Analytický JSON má `schemaVersion: 7` a kolekci `trainingGames`. Obsahuje pouze filtrované události. Při výběru jednoho člena obsahují `entries` jen jeho výsledek, `roster_size` zachová původní počet účastníků bez jejich identit.

## Omezení a další kroky

Minihry jsou volitelné a mohou být rozepsané; pokrytí výsledků je viditelné. Dokončení hlavního deníku je nevyžaduje. Změna minihry znovu otevře dokončení tréninku ke kontrole. Tato etapa řeší individuální výsledky; týmové minihry, veřejné žebříčky a automatické rozesílání nejsou součástí této verze. Závodní výsledky a měřené intervaly zůstávají samostatnými typy záznamu.

## Ověření

`npm test`, `npm run build`, `npm run test:database` a `npm run test:member-ui`. Databázová sada kontroluje oprávnění, revize, soupisku, nulový výsledek, docházku, opětovné otevření a retenční úklid. Test prohlížeče používá pouze fiktivní data.
