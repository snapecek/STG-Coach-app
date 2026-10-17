# Klubové příspěvky

## Nasazení

Po dosavadních migracích 001–040 spusťte celý soubor [041 – klubové příspěvky](../supabase/migrations/202610170041_club_fees.sql) v Supabase SQL Editoru. Pro smazání a automatické měsíční předpisy pak spusťte [042](../supabase/migrations/202610170042_fee_deletion_recurring.sql). Pokud už 041 máte, spusťte jen 042. Starší migrace neopakujte. Funkce Supabase ani nové tajné klíče nejsou potřeba. Migrace 042 v Supabase automaticky vytvoří jedinou úlohu `trenomi-monthly-club-fees` v Cronu; jiných úloh se nedotýká. Pokud aplikace hlásí neaktivní plánovač, spusťte [nastavení Cronu](../supabase/setup/club_fee_cron.sql). Skript lze opakovat, nahrazuje jen tuto úlohu.

Evidence je ve výchozím stavu vypnutá pro každý klub. Hlavní správce otevře **Můj účet → Nastavení → Klubové příspěvky → Zapnout klubové příspěvky**. V hlavičce se mezi dresy klubů a Chatem objeví ikona peněženky. Stejné umístění platí pro mobil.

Před migrací funguje zbytek aplikace dál, ikona se nezobrazuje a Nastavení vysvětlí, že je potřeba migrace 041. Vypnutí skryje evidenci všem, ale nesmaže předpisy, sazby ani úhrady. Zapnutí i vypnutí může provést pouze vlastník klubu.

## Členské příspěvky

1. V ikoně peněženky otevřete **Sazby → Nová sazba**, zadejte název, měsíční či roční období a částku na osobu v Kč.
2. V záložce **Členské příspěvky → Vytvořit předpisy** zvolte sazbu, měsíc nebo rok, splatnost a aktivní členy. Účet není podmínkou – lze evidovat i členy bez účtu. Hosté nemají členské předpisy.
3. Potvrzením vzniknou samostatné předpisy pro jednotlivé osoby. Stejná sazba za stejné období se při opakovaném vytvoření nezdvojí. Každá sazba může mít vlastní skupinu členů a částku.

Předpisy pro další období lze vytvořit hromadně ručně. Měsíční sazba navíc podporuje níže popsané automatické vytváření předpisů na pozadí. Samotné úhrady stále zapisuje trenér, žádné strhávání ani rozesílání zpráv neprobíhá. Změnu budoucí ceny řeší nová sazba; původní lze archivovat a dřívější předpisy zůstanou stejné. Stornovaný předpis lze vystavit znovu.

## Automatické měsíční příspěvky (042)

V **Sazby → Měsíčně automaticky** zaškrtněte vytváření každý měsíc. Zvolte počáteční měsíc (aktuální nebo budoucí), den splatnosti 1–31 a konkrétní aktivní členy. Uložením pro aktuální měsíc vzniknou první předpisy ihned; pokud už existují pro stejnou sazbu/člena/období, neopakují se. Člen bez účtu je podporovaný; hosté se do členské automatiky nezařazují.

Supabase Cron jednou za hodinu zkontroluje nový měsíc podle **Europe/Prague**. Na začátku měsíce tedy nové předpisy vzniknou i bez otevřené aplikace. Splatnost 31. dne se v dubnu zkrátí na 30. a v únoru na 28./29. Vytváří se celý měsíční předpis, bez poměrného krácení podle dne zapnutí. U sazby je vidět další nezpracovaný měsíc, den splatnosti a počet vybraných členů.

**Upravit automatiku** mění výběr a splatnost pro další nezpracovaný měsíc; již vydané částky se nemění. Nové členy do výběru přidejte ručně, nepřihlásí se automaticky k placení. Zrušením zaškrtnutí se další vystavování zastaví. Při opětovném zapnutí se přeskočí pozastavené měsíce. Odebraní členové, archivované/smazané sazby a archivované kluby se nezpoplatňují. Vypnutí celé evidence a následné zapnutí ani obnova archivovaného klubu nevytváří zpětné dluhy za dobu vypnutí. Pokud pouze vypadne plánovač, po návratu doplní dosud nezpracované měsíce aktivních pravidel.

Automatika nikdy neobnoví smazaný či stornovaný předpis dané sazby, člena a období. Pro vědomé nové vystavení lze použít ruční formulář. Souběžné nebo opakované běhy se synchronizují klubovým zámkem a nemají vytvářet duplicity. Další sazby bez výslovného zapnutí zůstanou ruční, roční sazby zatím zůstávají ruční.

V Supabase **Integrations → Cron** lze ověřit úlohu `trenomi-monthly-club-fees`, hodinový plán `0 * * * *` a úspěšné běhy `select public.run_club_fee_recurring();`. Úloha obsahuje pouze název databázové funkce, žádná hesla ani HTTP klíče. Prohlížeč nemá oprávnění volat globální generátor ani měnit datum jeho běhu. Dočasné lokální PostgreSQL bez rozšíření pg_cron testuje generátor přímo; stav Cronu je v aplikaci oddělený od zapnutého pravidla.

## Smazání sazby a příspěvku (042)

**Smazat** u sazby otevře potvrzení. Po potvrzení sazba zmizí, zastaví se její automatika a zůstanou všechny již vystavené příspěvky a úhrady. Funguje i pro archivovanou sazbu.

**Smazat** u konkrétního předpisu v seznamu nebo detailu také vyžaduje potvrzení. Předpis zmizí z evidence i dluhu; automatika ho pro stejný měsíc znovu nevytvoří. Předpis s platnými úhradami nelze smazat. Chybně zapsanou úhradu je možné nejprve stornovat původním postupem; přijaté peníze se smazáním nevracejí.

Smazání používá skrytý záznam s datem a autorem, nikoli kaskádové odstranění plateb. Auditní data zůstanou v dosavadní klubové záloze a chráněném archivu. Členům smazané předpisy zmizí z přehledu; smazat je smějí jen trenéři a hlavní správce jejich klubu.

## Platby za tréninky

V záložce **Tréninky → Vytvořit předpisy** vyberte trénink, název platby (např. vstup do haly), částku na osobu a splatnost. Vyberte členy i hosty ze soupisky daného tréninku. Předvybraní jsou pouze trenérem potvrzení přítomní. Lze zvolit i jinou osobu ze soupisky, např. když se nájem hradí před termínem.

Pro jednu osobu a jeden trénink vzniká nejvýše jeden aktivní předpis se souhrnnou částkou za trénink. Opakování stejné akce jej nezdvojí. Host konkrétní události nemůže být zpoplatněn na cizí soupisce. Přítomnost, RSVP ani zápis do deníku se vystavením předpisu nemění; zrušené události nelze nově zpoplatnit.

Předpis zachová jméno osoby i název a datum tréninku při pozdějším odebrání osoby nebo události. Historie plateb se tím nesmaže.

## Úhrady a opravy

Trenér nebo správce zvolí **Zapsat úhradu**, vyplní skutečně přijatou částku, datum, hotově/převodem/jinak a volitelnou poznámku. Úhrady jsou ruční evidence, bez platební brány nebo bankovního párování. Částky se ukládají jako celé haléře, podpora do dvou desetinných míst, od 0,01 do 1 000 000 Kč za předpis/úhradu.

Částečné úhrady se sčítají a snižují zbývající dluh. Server nepovolí přeplatek ani zápis úhrady v budoucnosti. Po splatnosti je až den následující po splatnosti podle českého kalendáře. Souhrn zobrazuje předepsáno, uhrazeno, zbývá a po splatnosti pro aktuální záložku a filtry (hledání, měsíc splatnosti, stav).

**Detail** obsahuje historii úhrad. Chybně zapsanou úhradu lze stornovat s povinným důvodem; původní záznam, datum a důvod zůstávají. Toto není vrácení peněz ani záznam refundace. Dluh se znovu otevře. Předpis lze stornovat pouze bez platných úhrad, s povinným důvodem. Předpisy s přijatými platbami se nestornují bez vyřešení jejich úhrad. Platné platby nestornujte jen kvůli změně ceny. Stornované předpisy jsou dostupné ve filtru **Stornováno** a nepočítají se do dluhu.

## Přístup a data

- Hlavní správce zapíná/vypíná funkci pro klub.
- Správce a trenéři spravují sazby, předpisy i úhrady a vidí celý klub.
- Člen vidí pouze své předpisy a jejich úhrady včetně historie. Nemůže potvrdit platbu, změnit částku, vytvářet předpisy nebo číst finance jiných členů. Host bez účtu není do aplikace přihlašován.
- Kontrolu provádějí RPC i RLS. Klient nemá přímé oprávnění k finančním mutacím. Cizí klub ani archivovaný klub nejsou dostupné. Zápisy se synchronizují s archivací i ostatními finančními zápisy společným zámkem klubu; souběžné úhrady se znovu kontrolují proti aktuálnímu zůstatku.
- Úhrada má idempotentní UUID: opakování téhož požadavku po nejisté odpovědi nevytvoří druhou platbu.
- Nové tabulky `club_fee_settings`, `club_fee_plans`, `club_fee_charges`, `club_fee_payments`, `club_fee_plan_members` automaticky zahrnuje dosavadní klubová ZIP záloha i chráněný tříměsíční archiv. Zálohy názvosloví nemění.

Přehled se obnovuje po 10 sekundách a při návratu do viditelné karty. Během rozepsaného formuláře se výměna dat pozastaví. Změny docházky a soupisek pro nový předpis se ověřují také na serveru.

## Ověření

- `npm test` – přesné částky, částečné úhrady, storna, splatnost a souhrny.
- `npm run build`.
- `npm run test:database` – všechny migrace, regresní SQL kontroly a konkurenční zápisy v dočasném PostgreSQL. `club_fees.sql` ověřuje soukromí, role, návaznosti, odmítnutí neplatného hromadného předpisu, duplicity, částečné úhrady, přeplatky, opravy a zálohy. Test souběžných úhrad nepovolí přeplatek.
- Pro běžící Vite s fiktivní Supabase konfigurací: `STG_FEES_ONLY=1 npm run test:member-ui`. Fiktivní API projde zapnutí, měsíční i roční sazbu, předpisy, opakování bez duplicit, dílčí úhradu, odmítnutý přeplatek, trénink/hosta, storna, členský přehled, vypnutí/zapnutí bez ztráty dat, formulář po obnově i 320/390/1440 px ve světlém a tmavém vzhledu. Žádné skutečné platby, e-maily ani klubové údaje se nemění.

Rozšířené ověření: `fee_deletion_recurring.sql` kontroluje měsíční generování, chybějící období, únor/duben, duplicity, role a soukromí, ochranu zaplacených předpisů, audit smazání, pauzu, deaktivaci evidence a archivaci/obnovu. `STG_FEE_RECURRING_ONLY=1 npm run test:member-ui` ověřuje potvrzování smazání, zachování úhrad, nastavení a vypnutí automatiky i mobil/desktop a oba vzhledy.
