# E-mailová připomenutí účasti

Připomenutí je běžný organizační e-mail, nikoliv přihlašovací odkaz. Supabase Auth SMTP odesílá pouze zprávy přihlášení/pozvánek a pro tento účel nestačí. Aplikace používá samostatnou Edge Function `remind-event` a službu Resend. Nová SQL migrace není potřeba.

1. V Resend vytvořte účet, ověřte vlastní odesílací doménu pomocí DNS a vytvořte API klíč s oprávněním Sending access pro tuto doménu. Zkušební doména Resend má omezené příjemce a nehodí se pro klubové odesílání.
2. V Supabase → Edge Functions → Secrets nastavte `RESEND_API_KEY` a `REMINDER_FROM` (například `STG Coach <trener@vase-overena-domena.cz>`). Volitelné `APP_URL` je pevná HTTPS adresa aplikace, výchozí `https://project-ym4q2.vercel.app/`. Klíče nezadávejte do Vercelu, prohlížeče ani chatu. Standardní `SUPABASE_URL`, `SUPABASE_ANON_KEY` a `SUPABASE_SERVICE_ROLE_KEY` poskytuje Supabase serverové funkci.
3. V Supabase → Edge Functions vytvořte funkci **remind-event**. Nahraďte hlavní soubor [index.ts](../supabase/functions/remind-event/index.ts), přidejte [handler.ts](../supabase/functions/remind-event/handler.ts) a nasaďte. Vypněte pro tuto funkci **Verify JWT**, protože handler sám ověřuje bearer přes `Auth.getUser()` a roli trenéra/správce vybraného klubu. CLI alternativa: `supabase functions deploy remind-event --no-verify-jwt`.
4. Obnovte aplikaci. U nejbližší další události otevřete **Připomenout e-mailem**. Náhled zobrazí počet vhodných příjemců a počet bez propojeného ověřeného e-mailu. Náhled nic neposílá. Teprve **Odeslat připomenutí** zavolá poskytovatele. Příjemci se znovu ověřují na serveru.

Funkce pracuje pouze s budoucími nezrušenými událostmi daného klubu a členy bez Jdu/Nejdu/Možná. U skupin a závodů vychází z uložené soupisky. Vylučuje archivované/expirované členy. E-mail získá jen server z propojeného ověřeného účtu Auth; samotné jméno hosta ani neověřená pozvánka nestačí. Host bez propojeného účtu e-mail nedostane. Nepřebírá adresy ani text od klienta a nevrací adresy do prohlížeče. Jedno odeslání podporuje nejvýše 100 vhodných příjemců; členský registr nejvýše 500 osob.

Ochranu proti duplicitě zajišťuje Resend `Idempotency-Key` pro událost, člena a kalendářní den v Europe/Prague. Opakování se stejným obsahem tentýž den nezpůsobí druhé odeslání; při změně obsahu během stejného dne může poskytovatel klíč odmítnout, což se vykáže jako neúspěch. Další kalendářní den lze připomenout znovu. Při výpadku či omezení poskytovatele může být část příjemců neúspěšná; počet je v rozhraní a lze požadavek zopakovat. Funkce nepoužívá automatický plánovač.

„Přijato k odeslání“ znamená přijetí službou, nikoliv doručení do schránky. Doručení/bounce lze sledovat v Resend. Aplikace zatím nemá webhooky ani vlastní historii doručení. Bez nasazení/klíčů zobrazí konkrétní nedostupnost a nepředstírá odeslání. SMTP pozvánek `invite-member` zůstává samostatnou konfigurací.

Automatické testy používají fiktivní adresy a falešnou odesílací závislost. Neposílejte skutečným členům testovací zprávy; případný test doručení proveďte až po výslovném výběru vlastního testovacího příjemce.
