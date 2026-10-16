# Přihlášky nových členů bez předem vyplněného jména

## Aktivace

1. V Supabase SQL Editor jednou spusťte celou [migraci 032](https://github.com/snapecek/STG-Coach-app/blob/main/supabase/migrations/202610160032_membership_applications.sql). Navazuje na 001–031. Existující členy, hosty, klubová ID a role nemění. Přidá čekající přihlášky, pozvánky bez členského záznamu a výchozí vypnutý příjem samostatných přihlášek.
2. V existující Edge Function **invite-member** nahraďte oba soubory: [index.ts](https://github.com/snapecek/STG-Coach-app/blob/main/supabase/functions/invite-member/index.ts) a [handler.ts](https://github.com/snapecek/STG-Coach-app/blob/main/supabase/functions/invite-member/handler.ts). Nasaďte tlačítkem Deploy. Zachovejte stejné jméno funkce, standardní serverové proměnné, APP_URL a SMTP. **Verify JWT zůstává vypnuté**, protože handler ověřuje token přes Auth.getUser a kontroluje trenérskou roli. CLI alternativa: `supabase functions deploy invite-member --no-verify-jwt`.
3. Chcete-li umožnit i samostatné vytvoření účtu bez e-mailové pozvánky, v Supabase → Authentication → Sign In / Providers (případně Settings → User Signups podle verze konzole) zapněte **Allow new users to sign up** a povolení Email/Password. **Confirm email ponechte zapnuté.** Toto je nová možnost; starší návod pro původní přímé pozvánky požadoval vypnutou veřejnou registraci. Pro vstup pouze na pozvánku lze samostatné registrace ponechat vypnuté.
4. Existující Site URL a Auth callbacky neměňte. Redirect URLs musí stejně jako dříve povolovat adresu aplikace `https://project-ym4q2.vercel.app/**`. Nový odkaz používá parametr `join-invite`; původní `club-invite` i heslové callbacky jsou zachované. Nevkládejte service role klíč do frontendu ani Vercelu.
5. Jako hlavní správce otevřete **Nastavení → Příjem přihlášek** a zapněte **Nabízet klub novým zájemcům**, pokud má být klub ve výběru samostatně registrovaných zájemců. Veřejně dostupný není seznam členů ani kalendář: přihlášený zájemce uvidí pouze názvy klubů, které tuto volbu zapnuly. Přímá e-mailová pozvánka zpřístupní výběr svého klubu i při vypnuté volbě.
6. V **Členové → Pozvat nového zájemce** zadejte pouze e-mail. Nový účet dostane pozvánku s nastavením hesla; existující účet přihlašovací odkaz. Zájemce sám vyplní jméno, příjmení a klub. Ve stejné sekci se objeví **Přihlášky ke schválení**. Schválení potvrdíte samostatným dialogem. Člen potom ve své přihlášce zvolí **Zkontrolovat stav → Vstoupit do klubu**.

## Co zůstává zachované

- **Přidat člena**, hosté a **Pozvat účet** u existujícího člena fungují jako dříve. Původní přímá pozvánka propojí ověřený účet s jeho existujícím ID; nevyžaduje novou přihlášku.
- Nová registrační pozvánka nevytvoří členský záznam ani roli. Čekající a zamítnutý zájemce nemá přístup ke klubovým datům.
- Schvaluje trenér nebo správce daného klubu. Přidává se pouze role člena; současné trenérské či vlastnické role se nepřepisují.
- V potvrzení schválení lze vybrat existujícího člena/hosta bez jiného propojeného účtu. Jeho docházka zůstane zachovaná. Původní archivovaný záznam stejného účtu se obnoví automaticky, pokud je stále v době obnovy. Záznam po retenční lhůtě nelze tímto postupem oživit; je nutné dokončení běžného úklidu nebo kontrola správcem.
- Hlavní správce může vypnout nové samostatné přihlášky. Již podané přihlášky může trenér stále posoudit. Archivovaný klub se nenabízí a nové zápisy blokuje archivační ochrana.

## Pozvánky a stav

Nové pozvánky jsou vázané na konkrétní ověřený e-mail, platí 7 dní a další pozvánka na stejný e-mail v klubu zneplatní předchozí dosud nepoužitou. Trenér může pozvánku odvolat v historii. Odvolání nesmaže již podanou přihlášku; tu je třeba výslovně zamítnout. Na trenéra platí nejvýše 20 nových registračních pozvánek za hodinu; na zájemce nejvýše 5 nových přihlášek za hodinu. Opakované odeslání téže čekající přihlášky ji nezdvojí.

Čas **Předáno k odeslání** se zapíše až po úspěšném přijetí e-mailu Auth službou. Neznamená potvrzené doručení do schránky. Když odesílání selže, nová pozvánka se odvolá. Zůstává stejné SMTP a stejné limity poskytovatele jako u původních pozvánek.

## Návod a ověření

[Obrázkový návod](https://project-ym4q2.vercel.app/navod-clenove.html), [PDF](https://project-ym4q2.vercel.app/navod-clenove.pdf) a [obrázek PNG](https://project-ym4q2.vercel.app/navod-clenove.png) jsou dostupné také přímo z přihlašování, registrace, přihlášky a trenérské sekce Členové. Používají fiktivní údaje a skutečné snímky rozhraní; neobsahují údaje živých členů.

Automatické ověření: `npm test`, `npm run build`, `npm run test:database`, Deno check Edge Function a `STG_APPLICATIONS_ONLY=1 npm run test:member-ui` proti běžícímu testovacímu Vite. Prohlížečové testy používají fiktivní API a neposílají skutečné e-maily. Snímky návodu vznikají v `/tmp/trenomi-join-guide`; běžný test nepřepisuje publikované obrázky. Publikované podklady, PNG a PDF obnoví `node scripts/render-member-guide.cjs` při spuštěném Vite. Pro systémový Chromium lze přidat `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

Po aktivaci ověřte doručení na vlastním zvoleném testovacím e-mailu, nastavení hesla/ověření e-mailu, čekání bez přístupu, schválení trenérem a vstup do správného klubu. Testy proti živým účtům samy o sobě doručení nepotvrzují.
