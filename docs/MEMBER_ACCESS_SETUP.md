# Členské účty a pozvánky

**Pokud už je migrace úspěšně spuštěná, pokračujte rovnou krokem 2.** Chyba `members_club_identity already exists` při opakování není důvod migrovat znovu; dostupnost nových RPC byla po aplikování ověřená.

1. V Supabase SQL Editor jednou spusťte celý obsah `supabase/migrations/202610130006_member_access.sql`. Navazuje na předchozích pět migrací. Pozvánky jsou jednorázové, na 7 dní a vázané na ověřený e-mail a existující členský záznam. Nezapínejte veřejné registrace.
2. V Supabase → Edge Functions vytvořte funkci **invite-member**. V editoru nahraďte celý obsah hlavního souboru [index.ts](https://github.com/snapecek/STG-Coach-app/blob/main/supabase/functions/invite-member/index.ts) a přidejte druhý soubor [handler.ts](https://github.com/snapecek/STG-Coach-app/blob/main/supabase/functions/invite-member/handler.ts) s přesně tímto názvem. Zkopírujte celý obsah obou souborů, potom funkci nasaďte tlačítkem Deploy. Při nasazení vypněte **Verify JWT** pro tuto funkci: handler sám vždy ověřuje bearer přes Auth.getUser a kontroluje trenérskou/správcovskou roli klubu. Bez toho nelze pozvánku vystavit. CLI alternativa: `supabase functions deploy invite-member --no-verify-jwt`.
3. Funkce používá standardní serverové proměnné SUPABASE_URL, SUPABASE_ANON_KEY a SUPABASE_SERVICE_ROLE_KEY, které Supabase Edge Functions poskytuje. Žádný service role klíč nevkládejte do Vercelu, frontendu nebo chatu. Volitelný secret **APP_URL** nastavte na HTTPS adresu aplikace; výchozí je `https://project-ym4q2.vercel.app/`. Redirect nikdy nepřebírá od volajícího.
4. Supabase → Authentication → URL Configuration: Site URL = adresa aplikace a Redirect URLs obsahuje `https://project-ym4q2.vercel.app/**` (vlastní doménu případně přidejte obdobně).
5. Supabase → Authentication → Email / SMTP Settings: nastavte vlastní SMTP pro doručování skutečným členům. Výchozí Supabase poštovní služba má omezení příjemců a nízké limity; přijetí API požadavku není potvrzení doručení do schránky. SMTP údaje zadávejte jen do Supabase nastavení. Neměňte šablony tak, aby obcházely ověření e-mailu.

Trenér v registru zvolí **Pozvat účet**, zadá e-mail člena a odešle pozvánku. Nový účet dostane Auth pozvánku s nastavením hesla; existující účet přihlašovací odkaz. Člen přijme klubovou pozvánku po ověření e-mailu. Propojí se s existujícím ID člena, neimportuje kopii. Záznam propojený s jiným účtem nelze převzít. Odvolání pozvánky zruší klubové přijetí; již odeslaný Auth e-mail nelze stáhnout ze schránky.

Doručování není součást běžných automatických testů: nevytvářejte účty ani neposílejte e-maily skutečným členům jako test. Lokální SQL ověřuje role a svázání s e-mailem; HTTP testy handleru používají falešné závislosti. Pro živé doručení použijte vlastní dobrovolně zvolený testovací e-mail a potvrďte jej ve schránce. Ověření dvou skutečných účtů je samostatná kontrola.

## Přehled pozvánek v registru

U každého člena se zobrazuje stav poslední pozvánky (zatím nepozván, čeká na přijetí, přijata, odvolána, vypršela) nebo propojený účet. Čas u „Pozvánka z“ je uložený čas vytvoření pozvánky, zobrazený v Europe/Prague; nejde o potvrzení doručení e-mailu. Přijetí a odvolání mají vlastní čas, pokud jsou zaznamenané. Stejné datum je dostupné v historii po otevření **Spravovat pozvánku**. Odeslání a odvolání přehled obnoví automaticky; po přijetí členem použijte **Obnovit data**. Pokud historii nelze načíst, aplikace ukáže neznámý stav místo tvrzení, že člen nebyl pozván. Přehled funguje i pro existující pozvánky a nevyžaduje další migraci.

## Závody bez předem vybrané soupisky (migrace 021)

Po migraci `supabase/migrations/202610150021_open_races.sql` lze uložit závod s prázdnou soupiskou. Všichni členové klubu najdou nové i dříve vytvořené závody v kalendáři. Po registraci u pořadatele odpoví „Zúčastním se“; tím vznikne jejich vlastní účast. Registraci u pořadatele aplikace neprovádí. Doprovod a ostatní odpovědi zůstávají dostupné. Odpovědi se uzavírají při začátku závodu a nemění trenérovu docházku. Skupinové tréninky zůstávají přístupné pouze své soupisce.

Nejprve spusťte migraci 021 v Supabase SQL Editoru, potom nasaďte odpovídající frontend. Bez migrace původní databáze prázdnou soupisku stále odmítne.

## Sdílená paleta kalendáře (migrace 022)

Nejprve spusťte `supabase/migrations/202610150022_event_type_colors.sql`, potom nasaďte odpovídající frontend. Trenér nebo správce může ve formuláři nové i upravované události pod zaměřením/disciplínou kliknout na jednu z osmi barev. Barva se ukládá okamžitě a samostatně od události, pro daný typ a druh události v celém klubu. Platí i pro starší události a členský kalendář. Tlačítko „Obnovit výchozí barvu“ vrátí původní barvu. Tréninky a závody mají nezávislé nastavení; změna palety nemění docházku, výsledky ani dokončení událostí.
