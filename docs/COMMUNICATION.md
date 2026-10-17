# Chat a podněty k aplikaci

## Nasazení

Na již nasazené migrace 001–024 navazují jednorázově [025 – soukromý chat s trenéry](../supabase/migrations/202610150025_private_coach_chat.sql) a [026 – hosté přidaní členem](../supabase/migrations/202610150026_member_training_guests.sql). V Supabase SQL Editoru spusťte celý obsah nejprve 025, potom 026. Starší migrace neopakujte. Existující události, odpovědi a docházka se zachovají. Není potřeba zapínat Realtime ani měnit veřejné klíče nebo přihlašování.

Nový web při chybějící migraci nepoužívá původní společný klubový chat jako náhradu: zobrazí vysvětlení s číslem 025. Přidávání hostů obdobně vysvětlí chybějící migraci 026. Načítání klubových dat podporuje i dobu před přidáním nových sloupců.

## Soukromý chat a chat událostí

**Chat** vedle nabídky **Můj účet** obsahuje:

- Pro člena jednu soukromou konverzaci **Trenéři klubu**. Zprávy a odpovědi vidí tento člen a trenéři/správci jeho klubu. Ostatní členové nemají přístup ani přes přímé RPC volání, historii nebo počty nepřečtených.
- Pro trenéra přepínač konverzací jednotlivých členů. Bez výběru kontaktu nelze odeslat soukromou zprávu.
- Společné konverzace konkrétních událostí pro jejich oprávněné účastníky a trenéry. U otevřeného tréninku/závodu není k domluvě nutná registrace; skupinové události se soupiska omezuje i v chatu.
- Pro trenéry archiv dřívějšího společného klubového chatu. Staré zprávy se nemažou ani automaticky nepřevádějí do soukromých konverzací. Členům archiv dostupný není, do archivu nelze přidávat zprávy. Starší klient nemůže po migraci 025 posílat do původního společného kanálu ani získat zprávy jiných členů.

V detailu události má trenér záložku **Chat**, člen tlačítko **Chat události**. Záložky se na mobilu zobrazují ve dvou řádcích. Hlavní mobilní navigace se neposouvá do stran.

Zprávy jsou prostý text do 2 000 znaků, s autorem a časem. Vlastní zprávu lze po potvrzení smazat. Načítá se posledních 50 zpráv a starší přes tlačítko. Obnova zpráv probíhá po 10 sekundách, nepřečtených po 10 sekundách i po lokální akci. Ve skryté kartě se dotazy pozastaví. Přečtení je uložené na serveru pro konkrétní účet a konverzaci; vlastní zprávy nejsou nepřečtené. Nejde o push notifikace do telefonu.

Přístup vynucují serverové funkce a RLS; klient nemá přímá práva k tabulkám zpráv, konverzací a značek přečtení. Člen potřebuje aktivní propojený členský záznam a klubovou roli. Trenér/správce může zachovat přehled dřívější komunikace i bývalých členů. Server omezuje odesílání na 30 zpráv za minutu a 10 podnětů za hodinu na účet.

## Podněty

**Můj účet → Podněty k aplikaci** nabízí Chyba / Nefunkčnost / Návrh na doplnění, název, popis a volitelný obrázek PNG/JPEG/WebP do 5 MB. Autor vidí své podněty a odpověď trenéra. Trenér/správce vidí podněty klubu, mění Nové / Řeší se / Hotovo a připojuje odpověď. Seznam nabízí posledních 100 dostupných podnětů a filtr stavu. Podněty se automaticky neposílají mimo aplikaci.

Obrázky v bucketu `app-feedback` jsou soukromé: autor zapisuje vlastní přílohu, autor a trenéři klubu ji čtou. Odkaz pro zobrazení platí 10 minut; již vydaný odkaz může platit do expirace. Při selhání uploadu zůstane text podnětu uložen a obrázek lze doplnit později. Tato část nadále používá migraci 024.

## Kontroly

`npm test`, `npm run build`, `npm run test:database` a `npm run test:member-ui`. Cílené UI průchody: `STG_COMMUNICATION_ONLY=1`, `STG_THEME_GUESTS_ONLY=1`, `STG_NAVIGATION_ONLY=1` před `npm run test:member-ui` proti Vite s fiktivní Supabase konfigurací. SQL testy `private_chat.sql` ověřují oddělení členů stejného klubu, klubů, archivu a společného chatu událostí.

Chat události je u trenéra i člena pouze v záložce **Chat**. Informace obsahují plán a mapu; Účast obsahuje odpovědi a docházku. Zprávy se mimo Chat neopakují.
