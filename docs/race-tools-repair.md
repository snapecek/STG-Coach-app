# Oprava ikon závodu a hosté — migrace 053

Ověření používaného backendu zjistilo chybějící funkce `race_icons_ready` a `special_sport_icons_ready` (PostgREST PGRST202). Novější kontroly 050–052 byly dostupné. Pozdější rozšíření seznamu ikon samo o sobě neobnoví starší funkci vytváření závodu ani trigger pro zachování jeho ikony.

V Supabase SQL Editoru jednou spusťte celý soubor `supabase/migrations/202611020053_race_tools_repair.sql`, po již použité 052. Starší migrace 047/048 znovu nespouštějte: jejich původní seznam ikon neobsahuje novější volby. Opravný soubor zachová všech 26 ikon, obnoví funkce pro závodní ikony, přidá atomické přidávání hostů a obnoví PostgREST schema cache. Je možné jej bezpečně opakovat. Dřívější řádky, výsledky ani docházku nepřepisuje.

Výběr ikon je nyní schovaný pod tlačítkem Vybrat ikonu u šablon i událostí. Hosty lze vybrat z evidence, vytvořit při zakládání závodu nebo přidat v detailu Účast. Nový host nepotřebuje účet, zůstává v evidenci a je zapsaný pouze do zvoleného závodu. Při přípravě nové události se draft hosta uloží až spolu se závodem. Volby jsou Závodník a Doprovod; skutečná docházka se neověřuje automaticky.

V detailu Účast lze měnit roli i po závodě. Změna zachovává ověřenou docházku a podle stávajících pravidel znovu otevře dokončený závod ke kontrole. Doprovod nemůže mít závodní výsledek ani zařazení do závodního týmu: při přepnutí s existujícím výsledkem/týmem se zobrazí pokyn k jejich odebrání a nic se neodstraní automaticky.

Ověření zahrnuje reprodukci chybějících kontrol před opravou, opakované provedení migrace, skutečné uložení všech ikon, hosty a jejich role, oddělení od docházky, opakovaný požadavek bez duplicit, rollback celé nové události při neplatném hostovi, zákaz zásahů člena a jiného klubu, zrušený závod a zachování závodního výsledku při odmítnuté změně role. Prohlížečové scénáře STG_RACE_FLOW_ONLY=icons, roles a guests doplňují mobil/PC a Chromium/WebKit s fiktivním API.
