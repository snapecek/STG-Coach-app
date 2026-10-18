# E-mailová připomínka nevyplněné účasti

Trenomi připomene členům, kteří ještě nezvolili účast, nadcházející trénink i závod přibližně **24 hodin před začátkem**. Cron kontroluje termíny každou minutu, odesílání tedy není závislé na otevřené aplikaci.

Předmět obsahuje konkrétní název události: **Trenomi · Vyplňte účast: Judo hala**. E-mail má vzhled Trenomi, název klubu a události, datum a čas v ČR, místo, tlačítko **Vyplnit účast v aplikaci** a přehled odpovědí. U závodu nechybí Doprovod. Součástí je i textová verze pro poštovní klienty bez HTML.

Všechny ovládací prvky otevřou stejnou událost na záložce **Účast**. Odpověď se ukládá až po kliknutí v přihlášené aplikaci. E-mailový skener ani přeposlání zprávy nemohou potvrdit účast za původního příjemce. Odkaz neobsahuje přihlašovací token; přístup vždy ověřuje aplikace a databáze. Odkaz přežije přihlášení, přednostně vybere cílový dostupný klub a u nedostupné události zobrazí vysvětlení.

## Aktivace v Supabase

Samotné nasazení frontendu e-maily ještě nezapne. Nejprve dokončete níže uvedené kroky. Předchozí ruční funkce `remind-event`, SMTP pozvánek, mobilní oznámení a jejich Cron zůstávají zachované.

1. V **SQL Editoru** spusťte celý soubor [044 – fronta připomínek](../supabase/migrations/202610180044_member_rsvp_email.sql), po dosavadních migracích včetně 043. Starší migrace neopakujte. Migrace nic neodesílá.
2. V **Edge Functions → Secrets** nastavte:

   | Název | Hodnota |
   | --- | --- |
   | `RESEND_API_KEY` | API klíč služby Resend s oprávněním odesílat z vaší ověřené domény. |
   | `REMINDER_FROM` | Ověřený odesílatel, např. `Trenomi <upozorneni@vase-domena.cz>`. Nahraďte vlastní skutečnou doménou. |
   | `APP_URL` | Stávající produkční `https://project-ym4q2.vercel.app/`. |
   | `PUSH_DISPATCH_SECRET` | Stávající tajný klíč plánovače z `.env.push`, stejný jako pro mobilní oznámení. |

   Existující správné hodnoty ponechte. Klíč z Resend patří pouze do Supabase Secrets, nikoli do Vercelu, zdrojových souborů nebo chatu. Nastavení SMTP v Supabase Auth samo o sobě neposkytuje této funkci odesílání přes Resend. Pokud už používáte ruční `remind-event`, může sdílet existující `RESEND_API_KEY` a `REMINDER_FROM`.

   Pokud mobilní oznámení ještě nejsou nastavená a `.env.push` neexistuje, lze jej místně vytvořit pomocí `node scripts/generate-push-secrets.cjs` podle [návodu k oznámením](COACH_PUSH.md). Stávající `.env.push` negenerujte znovu, žádné klíče neměňte. Automatické e-maily nepotřebují samotné VAPID klíče.
3. Nasaďte novou Edge Function **`remind-rsvp`**. Ve webovém editoru musí mít všechny tři soubory z [adresáře funkce](../supabase/functions/remind-rsvp): `index.ts`, `handler.ts`, `email.ts`. Vypněte pro tuto funkci **Verify JWT**; místo uživatelského JWT ověřuje tajný klíč plánovače. Ověření ostatních funkcí neměňte.

   Ve Windows PowerShellu z kořene aktuálního repozitáře lze místo webového editoru použít:

   ```powershell
   npx.cmd supabase login
   npx.cmd supabase link --project-ref VAS_PROJECT_REF
   npx.cmd supabase functions deploy remind-rsvp --no-verify-jwt
   ```

   Pokud je projekt již připojený, stačí poslední příkaz. `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` poskytuje Supabase funkci automaticky.
4. V **Vaultu** přidejte veřejnou adresu nové funkce pod názvem `trenomi_rsvp_email_url` s hodnotou `https://VAS_PROJECT_REF.supabase.co/functions/v1/remind-rsvp`. Nahraďte skutečným identifikátorem projektu.

   Dále musí existovat `trenomi_push_dispatch_secret` se stejnou hodnotou jako `PUSH_DISPATCH_SECRET` v Edge Secrets. Pokud jste nastavili mobilní oznámení, již existuje: zachovejte ji. Pokud chybí, vložte přímo do Vaultu hodnotu z místního `.env.push`; nikam ji neposílejte.
5. V **SQL Editoru** spusťte [nastavení plánovače](../supabase/setup/member_rsvp_email_cron.sql). Vytvoří/nahradí pouze úlohu `trenomi-member-rsvp-email`, jednou za minutu. Ostatních úloh se nedotýká. Tajný klíč se čte z Vaultu až za běhu, není vložený do SQL textu úlohy.

## Jak se vybírají příjemci

- Aktivní člen klubu s propojeným účtem, platným klubovým přístupem a ověřenou e-mailovou adresou. Hosté ani osoby bez účtu se neoslovují.
- U běžné otevřené události všichni takoví členové bez odpovědi, i když ještě nemají řádek v soupisce. To platí také pro otevřený závod. U skupinového tréninku jen členové jeho vybrané soupisky.
- Každá odpověď (`Přijdu`, `Možná`, `Nepřijdu`, `Doprovod`) stačí k vynechání připomínky. Nepřipomíná se trenérem nevyplněná skutečná docházka po tréninku.
- Zrušené či dokončené události, archivované kluby, odebraní členové a neověřené účty se vynechají. Příjemce a odpověď se znovu ověřují těsně před odesláním. Odpověď přijatá až během samotného předávání e-mailu poskytovateli již nemůže zprávu odvolat; proto obsahuje i poznámku „Pokud už jste mezitím odpověděli…“.

## Časování a spolehlivost

Termín se počítá jako skutečných 24 hodin před časem události, i přes změnu letního času. V e-mailu se čas zobrazuje v Europe/Prague. Kontrola po minutě a případná fronta mohou přidat malé zpoždění.

Po krátkém výpadku se doplní připomínky nanejvýš hodinu po původním termínu (událost musí začínat za více než 23 hodin). Po dlouhém výpadku se staré zprávy hromadně nerozešlou. Stejně tak pozdě vytvořená událost s méně než 23 hodinami do začátku už automatickou připomínku nemá.

Jedna automatická připomínka je evidována pro člena, událost a konkrétní čas začátku. Změna termínu vytvoří novou příležitost k připomenutí 24 hodin před novým začátkem; starý rozpracovaný termín se neodešle. Opakované běhy Cronu nepřidávají duplicity. Ruční připomenutí trenérem zůstává samostatné.

Pracovník používá rezervace úloh, omezené opakování s odstupem a stabilní idempotentní klíč Resend. Pokud poskytovatel zprávu přijal, ale selhalo potvrzení do databáze, opakování používá stejný klíč. Nejvýše pět pokusů proběhne jen uvnitř hodinového okna. Fronta neobsahuje uložené e-mailové adresy a po 30 dnech od události se čistí; skutečná účast se nijak nemění. Frontu ani serverové RPC nemohou číst nebo spouštět běžní uživatelé.

## Ověření provozu a vypnutí

V **Cronu** ověřte běhy `trenomi-member-rsvp-email`, v logu **remind-rsvp** HTTP 200. Odpověď obsahuje jen počty `accepted` (poskytovatel přijal), `skipped` (mezitím odpověděl/nedostupný), `retry` (další pokus). HTTP 503 znamená chybějící konfiguraci, 401 nesoulad tajných klíčů, 502 chybu fronty. Přijetí poskytovatelem není potvrzené doručení do schránky; doručení, odražení zpráv a limity domény ověřte v Resend.

Pro řízený živý test použijte vlastní testovací účet a událost za 24 hodin; produkční členy do testu nezahrnujte. V předaném kódu byly testy provedené s fiktivními údaji a bez odesílání skutečných e-mailů.

Pro vypnutí pozastavte v Supabase Cron pouze úlohu `trenomi-member-rsvp-email`. Účty, události ani jiné notifikace se nemění.

Kontroly projektu: `npm test`, `npm run build`, `npm run test:database`; pro místní Vite s fiktivním Supabase `STG_RSVP_EMAIL_LINK_ONLY=1 npm run test:member-ui`.
