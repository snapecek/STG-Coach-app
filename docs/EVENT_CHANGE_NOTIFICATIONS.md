# Upozornění na změny událostí

Při úpravě události se po změně data, času, názvu místa nebo mapy zobrazí předem zaškrtnutá volba **Upozornit členy a trenéry**. Stejná volba je při zrušení/obnovení a při hromadné změně série. Odškrtnutí uloží změnu bez upozornění. Samotná změna názvu, plánu nebo docházky oznámení nevytváří.

Zprávu dostanou aktivní členové s propojeným účtem, kterým je událost přístupná, a všichni trenéři a správce klubu. U skupinového tréninku jsou příjemci členové uložené soupisky a trenéři. Odpověď Přijdu/Nejdu není podmínkou. Hosté bez účtu nemají vlastní schránku ani push odběr.

Ve zvonečku přibude sekce **Změny událostí**. Záznam zůstává nepřečtený i po obnovení stránky a bez zapnutého push. Klepnutí označí konkrétní upozornění jako přečtené a otevře aktuální informace o události. Zrušení je viditelné přímo v detailu. Schránka vrací nejvýše 100 nejnovějších nepřečtených záznamů; po jejich přečtení se načtou další. Odebranému členu nebo účtu mimo soupisku se obsah nadále nevrací.

Mobilní oznámení si člen i trenér zapíná v **Můj účet → Nastavení → Mobilní oznámení** zvlášť na každém zařízení. Na iPhonu/iPadu vyžadují iOS 16.4+ a spuštění webové aplikace přidané na plochu. Zamykací obrazovku, náhledy a režim Nerušit řídí systém telefonu. Stávající oznámení trenérům o odpovědích členů fungují dál. Nativní FCM/APNs není součástí této změny.

## Nasazení

1. Po migraci 054 spusťte jednou celý soubor `supabase/migrations/202611120055_event_change_notifications.sql` v Supabase SQL Editoru.
2. Nasaďte web běžným sestavením `npm run build`. Požadavek se zapnutým upozorněním se před migrací odmítne s vysvětlením; klient jej neopakuje jako tiché uložení.
3. Je-li již nastavený Web Push dle [COACH_PUSH.md](COACH_PUSH.md), ponechte stejné VAPID klíče, funkci `push-rsvp` i minutový Cron. Funkce používá stejné RPC `claim_coach_push_jobs` a `finish_coach_push_job`, proto kvůli této změně nepotřebuje nový deploy. Migrace rozšiřuje jejich databázovou část. Stávající trenérské odběry zůstávají platné.
4. Není-li odesílání aktivované, nastavte je dle COACH_PUSH.md. Žádné historické změny se při migraci nerozesílají. Samotné nasazení webu ani migrace nenastavuje VAPID, Edge Function nebo Cron. Zvoneček funguje samostatně.
5. Ověřte dvěma testovacími účty změnu času/místa, zrušení, odškrtnutí volby, skupinovou soupisku a sérii. Na skutečném zamčeném telefonu ověřte doručení a otevření správné události. Automatické testy toto fyzické doručení nedokládají.

## Zápis a doručování

`update_event_with_notice` a `change_training_series_with_notice` používají stávající RLS, validační triggery a kontrolu konfliktů série. Změna události, soukromý záznam `event_change_notices` pro každého příjemce a jeho push fronta vznikají v jedné transakci. Selhání ji celou vrátí. Opakované uložení totožného termínu/místa/stavu novou zprávu nevytvoří. Běžné zápisy a starší klienti zůstávají tiché.

Odběry i fronta zůstávají soukromé. Před vyzvednutím worker znovu ověřuje aktuální členství, soupisku, klub a vlastníka odběru; zprávu o zrušení nevyřadí kvůli zrušenému stavu tréninku. Oznámení má stabilní tag pro opakované doručení. Stávající časové zámky, nejvýše pět pokusů, mazání expirovaných odběrů a sedmidenní úklid push fronty zůstávají zachované. Zpracování fronty není potvrzením doručení na telefon.

## Ověření

- `npm test` a `npm run build`.
- `npm run test:database`: všechny migrace a regresní SQL sady v izolovaném PostgreSQL, včetně `event_change_notifications.sql`. Ověřuje příjemce, izolaci účtů/klubů, soupisky, čtení schránky, tiché zápisy, opakované uložení, návrat transakce, zrušení, zámky fronty a sérii.
- Se spuštěným Vite s fiktivní konfigurací: `STG_EVENT_NOTICES_ONLY=1 npm run test:member-ui` a `STG_COACH_PUSH_ONLY=1 npm run test:member-ui`. API je zachycené a používá fiktivní data; nic se neposílá členům. Zahrnuje šířky 320/390/1440 px, odškrtnutí, sérii, chybu při načtení, reload, členský zvoneček a zapínání/vypínání push oběma rolemi.
- `node scripts/check-push-worker.cjs`: skutečný Chromium service worker a Notifications API po zavření stránky aplikace; ne skutečná síť Apple/Google.

Poslední lokální ověření (12. 11. 2026): 433 unit testů, produkční build, všechny SQL regresní sady a oba výše uvedené UI scénáře prošly. Test `check-push-worker.cjs` v tomto cloudovém Chromium selhává: první dotaz oznámení zachytí, následující `getNotifications()` vrací prázdný seznam. Stejnou chybu reprodukuje i nezměněný test s původním service workerem z výchozího commitu. Test není započítaný mezi úspěšné kontroly; skutečné doručení přes Apple/Google a na zamykací obrazovku je třeba ověřit na telefonu po nasazení.
