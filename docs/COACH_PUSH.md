# Mobilní oznámení o účasti členů

Trenér nebo hlavní správce si v **Můj účet → Nastavení → Mobilní oznámení** zapne odběr na konkrétním telefonu. Při první odpovědi či změně odpovědi člena u budoucí nezrušené události obdrží např.:

> STG Karviná · Judo hala
>
> Jana Nováková · přijde. Přihlášeno: 5 · 19. 10. 18:00

Čekací listina se uvádí zvlášť (`Přihlášeno: 5 · čeká: 1`); u člena čekajícího na místo se zobrazí „čeká na místo“. Závod rozlišuje i doprovod. Počet je znovu přepočítaný při odesílání. Klepnutí otevře příslušný klub a účast v události; vyžaduje-li aplikace přihlášení, odkaz se zachová do jeho dokončení.

Stejná odpověď uložená opakovaně nezpůsobí další oznámení. Zápis trenéra za jiného člena ani pouhé potvrzení docházky oznámení nevytváří. Každý trenér dostává pouze vlastní kluby a jen na zařízeních, na kterých si odběr zapnul. Odběr na jednom zařízení platí pro všechny jeho trenérské kluby. Vypnutí či odhlášení ruší odběr na tomto zařízení; ostatní zařízení zůstávají přihlášená.

## Jednorázová aktivace serveru

Samotná migrace nestačí. Je potřeba také odesílací Edge Function, trvalé VAPID klíče a automatické spouštění fronty. V tomto repozitáři nejsou žádné soukromé klíče.

1. Po migraci 039 spusťte v Supabase SQL Editoru celý obsah [040 – oznámení účasti](../supabase/migrations/202610170040_coach_rsvp_push.sql). Přidává soukromé odběry zařízení, frontu a trigger změn účasti. Stávající účast a docházka se nemění. Staré odpovědi se zpětně nerozesílají.
2. Ve staženém aktuálním repozitáři spusťte:

   ```sh
   node scripts/generate-push-secrets.cjs
   ```

   Vznikne místní `.env.push` (přístup jen vlastníka souboru), který je vyloučený z Gitu. Obsahuje `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_DISPATCH_SECRET` a stávající produkční `APP_URL`. Hodnoty se nevypisují do terminálu. Existující soubor se nepřepisuje: stejné klíče ponechte při každém dalším nasazení, jinak by bylo nutné obnovit odběry zařízení. Soukromý soubor bezpečně uchovejte, neposílejte jej do chatu ani na GitHub.
3. Přihlaste/připojte Supabase CLI ke správnému projektu, pokud jej ještě nemáte připojený, a nahrajte nastavení i funkci:

   ```sh
   supabase login
   supabase link --project-ref VAS_PROJECT_REF
   supabase secrets set --env-file .env.push
   supabase functions deploy push-rsvp
   ```

   `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` poskytuje běžící Supabase funkci automaticky. Klient ani Vercel žádný soukromý klíč nedostává. `verify_jwt = false` je záměrně v `supabase/config.toml`: POST ověřuje samostatný tajný klíč plánovače, GET zveřejňuje pouze veřejný VAPID klíč. JWT ověření jiných funkcí neměňte.
4. V Supabase **Vault** založte dvě položky:

   | Název | Hodnota |
   | --- | --- |
   | `trenomi_push_url` | `https://VAS_PROJECT_REF.supabase.co/functions/v1/push-rsvp` |
   | `trenomi_push_dispatch_secret` | Přesná hodnota `PUSH_DISPATCH_SECRET` z místního `.env.push` |

   Klíč vkládejte přímo do Vaultu, nikoli do veřejného souboru nebo chatu. Potom spusťte [nastavení Cronu](../supabase/setup/coach_push_cron.sql) v Supabase SQL Editoru. Skript vytvoří/nahradí pouze úlohu `trenomi-coach-rsvp-push`, která jednou za minutu zpracuje frontu; text úlohy čte tajný klíč z Vaultu až za běhu. V Cronu ověřte úspěšné běhy a v logu `push-rsvp` odpovědi HTTP 200.
5. Pro rychlejší odeslání můžete navíc v **Database → Webhooks** vytvořit webhook na tabulku `public.coach_push_jobs`, událost **INSERT**, metodu **POST**, URL ze `trenomi_push_url` a hlavičku `Authorization: Bearer HODNOTA_PUSH_DISPATCH_SECRET`. Cron ponechte jako zálohu pro opakované pokusy. Webhook nesmí směřovat na tabulku účasti ani nesmí vytvářet další zápisy do fronty. Tělo webhooku se při odesílání nepoužívá; příjemce i obsah vybírá pouze serverová fronta.
6. V telefonu otevřete aktuální aplikaci a zapněte oznámení v nastavení trenéra. Poté proveďte jednu novou odpověď testovacím členem. S Cronem očekávejte zpracování přibližně do minuty; přídavný webhook jej spustí bez čekání na další minutu. Ověřte jméno, odpověď, počet, klepnutí na oznámení a zamčený telefon.

Zatímco server není nasazený, aplikace při pokusu o aktivaci zobrazí srozumitelnou chybu a nepředstírá aktivní odběr. Zapnutí na zařízení neodesílá zpětně staré odpovědi.

## Telefon

- **iPhone/iPad:** iOS/iPadOS 16.4 a novější. V Safari použijte **Sdílet → Přidat na plochu**, spusťte Trenomi ikonou z plochy a zapněte oznámení v nastavení aplikace. Pouhé otevření běžné záložky Safari pro Web Push nestačí.
- **Android:** aktuální Chrome nebo Firefox; doporučujeme také přidání Trenomi na plochu. Oznámení povolte po stisku tlačítka v aplikaci.
- V systémovém nastavení oznámení povolte zobrazení na zamykací obrazovce a náhledy. Režim Nerušit/Soustředění, úspora baterie, odebrání oprávnění nebo nedostupná síť mohou doručení zpozdit či skrýt. Aplikace nemůže přepsat systémová nastavení soukromí.
- Oznámení obsahuje jméno člena podle požadavku trenéra; viditelnost náhledu na zamčeném zařízení řídí jeho vlastník.

## Chování serveru a kontrola

Fronta se plní ve stejné transakci jako odpověď, po přepočtu rezervací. Neúspěšná či vrácená odpověď nic neodešle. Klient nevybírá trenéry, počet ani obsah oznámení. Před doručením se znovu ověří aktuální trenérská role, aktivní klub, budoucí událost a vlastník odběru; odebranému trenérovi se čekající oznámení neposílají.

Worker používá časové zámky, nejvýše pět pokusů a odstupňované opakování. Expirované endpointy (HTTP 404/410) odstraňuje; dočasné chyby opakuje. Oznámení mají stabilní tag, takže opakované doručení téhož záznamu nahrazuje předchozí oznámení. Garanci přesně jednoho doručení přes síť Web Push neposkytuje. TTL je nejvýše hodina a končí nejpozději začátkem události; staré fronty se čistí. Odběry nelze číst běžnými účty ani správci klubu, pouze spravovat vlastní zařízení přes RPC. Podporované endpointy jsou omezené na Google FCM, Mozilla a Apple; soukromé adresy a cizí HTTP cíle jsou odmítnuté.

Lokálně ověřené kontroly (bez zpráv na skutečné telefony):

- `npm run build`, `npm test` – aplikace, autorizace workeru, chyby poskytovatele, obsah oznámení a bezpečné odkazy service workeru.
- `npm run test:database` – všech 40 migrací, vlastní/cizí účty, změny odpovědí, čekací listina, aktuální počet při doručení, odvolání trenéra, zámky, opakování a odhlášení zařízení.
- `STG_COACH_PUSH_ONLY=1 npm run test:member-ui` se spuštěným vývojovým serverem a fiktivní konfigurací – uživatelský souhlas až po stisku tlačítka, zapnutí/vypnutí, odmítnutí oprávnění, odhlášení, otevření události i přes nové přihlášení, šířky 320/390/1440.
- `node scripts/check-push-worker.cjs` – skutečný Chromium service worker a Notifications API, místní fiktivní push po zavření stránky aplikace. Nejde o důkaz doručení přes Apple/Google na fyzickém zamčeném telefonu.
- `deno check --no-lock --node-modules-dir=none supabase/functions/push-rsvp/index.ts` a `deno test --no-lock --node-modules-dir=none --allow-env supabase/functions/push-rsvp/crypto_test.ts` – skutečná knihovna Web Push v Deno, šifrování/dešifrování těla a VAPID. V cloudovém prostředí použijte systémovou důvěru CA (`DENO_TLS_CA_STORE=system`), žádné vypínání ověřování TLS.
