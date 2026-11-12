# Upozornění na změny událostí

Migrace **056** rozšiřuje stejný mechanismus také na vytvoření nového tréninku nebo závodu, kopie události a série. Ve formuláři je předem zaškrtnutá volba **Upozornit členy a trenéry**; odškrtnutí vytvoří událost bez oznámení. Zpráva „Nový trénink v kalendáři“ nebo „Nový závod v kalendáři“ obsahuje název, termín v pražském čase a místo. Ve zvonečku jsou nové i změněné události ve společné sekci **Nové a změněné události**.

Každý nový termín série má vlastní upozornění a odkaz na konkrétní událost; formulář před uložením uvádí počet odesílaných termínů. Skupinové oznámení vzniká až po vytvoření celé soupisky. Otevřený závod oznámí všem aktivním členům s účtem a trenérům, i když zatím nemá vybrané účastníky. Hosté bez účtu vlastní oznámení nedostávají.

Při úpravě události se po změně data, času, názvu místa nebo mapy zobrazí předem zaškrtnutá volba **Upozornit členy a trenéry**. Stejná volba je při zrušení/obnovení a při hromadné změně série. Odškrtnutí uloží změnu bez upozornění. Samotná změna názvu, plánu nebo docházky oznámení nevytváří.

Zprávu dostanou aktivní členové s propojeným účtem, kterým je událost přístupná, a všichni trenéři a správce klubu. U skupinového tréninku jsou příjemci členové uložené soupisky a trenéři. Odpověď Přijdu/Nejdu není podmínkou. Hosté bez účtu nemají vlastní schránku ani push odběr.

Ve zvonečku je sekce **Nové a změněné události**. Záznam zůstává nepřečtený i po obnovení stránky a bez zapnutého push. Klepnutí označí konkrétní upozornění jako přečtené a otevře aktuální informace o události. Zrušení je viditelné přímo v detailu. Schránka vrací nejvýše 100 nejnovějších nepřečtených záznamů; po jejich přečtení se načtou další. Odebranému členu nebo účtu mimo soupisku se obsah nadále nevrací.

Mobilní oznámení si člen i trenér zapíná v **Můj účet → Nastavení → Mobilní oznámení** zvlášť na každém zařízení. Na iPhonu/iPadu vyžadují iOS 16.4+ a spuštění webové aplikace přidané na plochu. Zamykací obrazovku, náhledy a režim Nerušit řídí systém telefonu. Stávající oznámení trenérům o odpovědích členů fungují dál. Nativní FCM/APNs není součástí této změny.

## Nasazení

**Pokud už máte aplikovanou migraci 055:** spusťte jednou celý soubor [056 – oznámení nových událostí](../supabase/migrations/202611120056_event_creation_notifications.sql) a potom nasaďte nový web. Migraci 055 neopakujte. Stávající Cron, VAPID klíče i funkce `push-rsvp` zůstávají stejné. Migrace nic zpětně nerozesílá a nevyžaduje nová povolení na již přihlášených zařízeních. Před nasazením 056 se zapnutou volbou formulář vysvětlí chybějící migraci a událost nevytvoří; po odškrtnutí funguje dosavadní tiché vytvoření.

1. Po migraci 054 spusťte jednou celý soubor `supabase/migrations/202611120055_event_change_notifications.sql` v Supabase SQL Editoru.
2. Nasaďte web běžným sestavením `npm run build`. Požadavek se zapnutým upozorněním se před migrací odmítne s vysvětlením; klient jej neopakuje jako tiché uložení.
3. Je-li již nastavený Web Push dle [COACH_PUSH.md](COACH_PUSH.md), ponechte stejné VAPID klíče, funkci `push-rsvp` i minutový Cron. Funkce používá stejné RPC `claim_coach_push_jobs` a `finish_coach_push_job`, proto kvůli této změně nepotřebuje nový deploy. Migrace rozšiřuje jejich databázovou část. Stávající trenérské odběry zůstávají platné.
4. Není-li odesílání aktivované, nastavte je dle COACH_PUSH.md. Žádné historické změny se při migraci nerozesílají. Samotné nasazení webu ani migrace nenastavuje VAPID, Edge Function nebo Cron. Zvoneček funguje samostatně.
5. Ověřte dvěma testovacími účty změnu času/místa, zrušení, odškrtnutí volby, skupinovou soupisku a sérii. Na skutečném zamčeném telefonu ověřte doručení a otevření správné události. Automatické testy toto fyzické doručení nedokládají.

## Zápis a doručování

`update_event_with_notice` a `change_training_series_with_notice` používají stávající RLS, validační triggery a kontrolu konfliktů série. Změna události, soukromý záznam `event_change_notices` pro každého příjemce a jeho push fronta vznikají v jedné transakci. Selhání ji celou vrátí. Opakované uložení totožného termínu/místa/stavu novou zprávu nevytvoří. Běžné zápisy a starší klienti zůstávají tiché.

Vytvoření s oznámením používá `create_training_series_with_notice`, `create_group_trainings_with_notice` a `create_club_race_with_notice`. Tyto funkce ověří trenérské oprávnění pro daný klub a zavolají původní validační funkce, potom soukromý helper vytvoří upozornění a push frontu. Soupiska a případní noví hosté závodu jsou v tu chvíli už uložené. Vše probíhá v jedné transakci; chyba v libovolném termínu nebo hostovi vrátí události i oznámení. Opakování stejného UUID události skončí konfliktem původního zápisu, takže nevznikne druhé oznámení stejné události.

Odběry i fronta zůstávají soukromé. Před vyzvednutím worker znovu ověřuje aktuální členství, soupisku, klub a vlastníka odběru; zprávu o zrušení nevyřadí kvůli zrušenému stavu tréninku. Oznámení má stabilní tag pro opakované doručení. Stávající časové zámky, nejvýše pět pokusů, mazání expirovaných odběrů a sedmidenní úklid push fronty zůstávají zachované. Zpracování fronty není potvrzením doručení na telefon.

## Ověření

- `npm test` a `npm run build`.
- `npm run test:database`: všechny migrace a regresní SQL sady v izolovaném PostgreSQL, včetně `event_change_notifications.sql`. Ověřuje příjemce, izolaci účtů/klubů, soupisky, čtení schránky, tiché zápisy, opakované uložení, návrat transakce, zrušení, zámky fronty a sérii.
- Se spuštěným Vite s fiktivní konfigurací: `STG_EVENT_NOTICES_ONLY=1 npm run test:member-ui` a `STG_COACH_PUSH_ONLY=1 npm run test:member-ui`. API je zachycené a používá fiktivní data; nic se neposílá členům. Zahrnuje šířky 320/390/1440 px, odškrtnutí, sérii, chybu při načtení, reload, členský zvoneček a zapínání/vypínání push oběma rolemi.
- `STG_NEW_EVENT_NOTICES_ONLY=1 npm run test:member-ui` ověřuje nový trénink, závod, skupinu, kopii, sérii, tiché vytvoření, chybu chybějící migrace a následný pokus i otevření nového závodu ze zvonečku na 320/390/1440 px. `event_creation_notifications.sql` ověřuje skutečné SQL příjemce, práva, dokončenou soupisku, hosty, obsah zpráv, duplicitu UUID a návrat celé transakce při chybě.
- `node scripts/check-push-worker.cjs`: skutečný Chromium service worker a Notifications API po zavření stránky aplikace; ne skutečná síť Apple/Google.

Lokální ověření etapy 055 (12. 11. 2026): 433 unit testů, produkční build, všechny SQL regresní sady a oba výše uvedené UI scénáře prošly. Test `check-push-worker.cjs` v tomto cloudovém Chromium selhává: první dotaz oznámení zachytí, následující `getNotifications()` vrací prázdný seznam. Stejnou chybu reprodukuje i nezměněný test s původním service workerem z výchozího commitu. Test není započítaný mezi úspěšné kontroly; skutečné doručení přes Apple/Google a na zamykací obrazovku je třeba ověřit na telefonu po nasazení.

Ověření etapy 056: 437 unit testů, produkční build, všechny SQL regresní sady a UI scénáře nových i změněných událostí prošly. UI scénář navíc simuluje úspěšné vytvoření skupiny a následný výpadek načtení: formulář se zavře, zobrazí se samostatné upozornění na nedostupnou soupisku a nevzniká nabídka opakovaného vytvoření.
