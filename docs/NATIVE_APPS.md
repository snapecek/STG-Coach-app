# Trenomi pro Android a iPhone

Projekt používá **Capacitor 8.5.3**. React rozhraní se sestaví do balíčku a běží v nativním WebView. Android a iOS sdílejí současnou logiku a Supabase; nejde o přepis rozhraní do SwiftUI nebo Jetpack Compose. Aplikace nenačítá své rozhraní z Vercelu při každém otevření. Pro klubová data, přihlášení a mapové podklady potřebuje připojení; offline editace a synchronizace fronty nejsou implementované.

## Co je připravené

| Oblast | Stav |
| --- | --- |
| Android projekt | `android/`, aplikace `eu.trenomi.app`, jméno Trenomi; Android 7/API 24+, cílové API 36, Java 21 |
| iOS projekt | `ios/App/App.xcodeproj`, stejné bundle ID; iOS 17.4+, Swift Package Manager |
| Společný kód | Web i nativní balíček používají stejné role, klubová data, deník, Studio a Supabase RLS |
| Přihlášení | Nativně Keychain / Android Keystore + AES-GCM, bez iCloud synchronizace; volba Zapamatovat přihlášení zůstává |
| E-mailové odkazy | Nativní registrace a obnova hesla používají PKCE a `trenomi://auth/`; nutné doplnit Supabase allowlist níže |
| Fotografie | Nativní fotoaparát/galerie v deníku; po výběru se dál použije stávající zmenšení a odstranění metadat |
| Sdílení a export | Systémová nabídka pro PNG, CSV, JSON a ZIP; lze zvolit další aplikaci nebo uložení do souborů |
| Ovládání | Tlačítko Zpět na Androidu zavře dialog/nabídku, vrátí přehled a až poté minimalizuje aplikaci; chrání rozepsané formuláře |
| Panely | Nativní SystemBars a skutečné safe-area okraje; kompenzace Safari PWA se v nativní aplikaci nepoužije |
| Aktualizace | Web dál přes Vercel; nativní rozhraní přes nové sestavení aplikace. Nativně se neregistruje service worker ani webové oznámení o nové verzi |
| Ikony a úvodní obrazovka | Vygenerované z existujícího loga Trenomi; zdroje `assets/icon-only.png` a `assets/logo.svg` |

**Zatím nejde o vydání připravené ke schválení v obchodech.** Chybí konfigurace nativního push, ověřené HTTPS odkazy, podpisy, store informace a testy na skutečných telefonech. Webová oznámení zůstávají funkční ve webu/PWA; nejsou připojená k nativnímu balíčku. Nativní nastavení tuto skutečnost uvádí. Upozornění pod zvonečkem a e-mailové připomínky používají stávající backend.

## 1. Příprava na počítači

Použijte aktuální repozitář. Nevytvářejte znovu platformy příkazem `cap add`: projekty už jsou součástí repozitáře.

1. Nainstalujte Node.js **24 LTS**.
2. Otevřete terminál v kořenové složce projektu, kde je `package.json`.
3. Spusťte `npm ci`.
4. Zkopírujte `.env.native.example` jako `.env.native.local` a vyplňte:

```dotenv
VITE_SUPABASE_URL=https://VAS_PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=VAS_VEREJNY_PUBLISHABLE_NEBO_ANON_KLIC
VITE_PUBLIC_APP_URL=https://project-ym4q2.vercel.app
```

Supabase hodnoty jsou stejné **veřejné** hodnoty jako pro web. Na telefonu se používají při sestavení. Nikdy nevkládejte service_role, soukromý klíč, heslo databáze, APNs klíč ani Firebase service account. `VITE_PUBLIC_APP_URL` musí vést na skutečný web Trenomi; po přesunu webu na vlastní doménu změňte tuto hodnotu a sestavte novou aplikaci. Pozvánky zasílané ostatním lidem budou vždy obsahovat veřejný webový odkaz, nikoli `localhost`.

Ve Windows PowerShellu lze použít `npm.cmd` a `npx.cmd`, pokud systém blokuje soubory `.ps1`. Není potřeba měnit systémovou bezpečnostní politiku.

```sh
npm run native:sync
```

Tento příkaz zkontroluje veřejné nastavení, sestaví `dist-native` a zkopíruje výsledek i moduly do obou projektů. Spusťte ho po každé změně webového kódu nebo konfigurace, kterou chcete testovat v telefonu. Běžný `npm run build` dál vytváří webový `dist`; nativní balíček ho nepřepisuje.

## 2. Android – první test bez účtu Google Play

1. Nainstalujte [Android Studio](https://developer.android.com/studio). V průvodci ponechte instalaci Android SDK a emulátoru.
2. V SDK Manageru doinstalujte **Android SDK Platform 36** a **Build-Tools 36.0.0**. Pro Gradle použijte JDK 21; novější JDK bez ověření nenastavujte.
3. V kořeni projektu spusťte `npm run native:android`. Otevře se složka `android` v Android Studiu.
4. Počkejte na Gradle Sync. Vytvořte emulátor nebo připojte telefon USB kabelem; na telefonu povolte Vývojářské možnosti → Ladění USB a potvrďte přístup počítače.
5. Vyberte zařízení a stiskněte zelené **Run ▶**. Není potřeba Play Console ani produkční podpis.

APK lze sestavit i z terminálu po `native:sync`:

```sh
cd android
./gradlew :app:assembleDebug
```

Ve Windows použijte `.\gradlew.bat :app:assembleDebug`. Výsledek je `android/app/build/outputs/apk/debug/app-debug.apk`. Debug balíček slouží k testování; veřejné vydání používá podepsaný AAB. Pro aktualizaci stejné instalace musí zůstat stejný podpis. Neodinstalovávejte aplikaci jen kvůli aktualizaci, pokud potřebujete uchovat místní nastavení.

## 3. iPhone – první test

Pro sestavení iOS je potřeba **Mac a Xcode 26 nebo novější kompatibilní verze**. Windows ani tento linuxový pracovní prostor nepodepíšou aplikaci pro iPhone. Projekt může bez podpisu ověřit sestavovací služba macOS; to nenahrazuje test na telefonu.

1. Na Macu nainstalujte Xcode a spusťte jej, aby dokončil instalaci komponent. Přidejte svůj Apple účet v Xcode → Settings → Accounts.
2. V kořeni projektu spusťte `npm ci`, nastavte `.env.native.local` a spusťte `npm run native:ios`.
3. Vyberte projekt **App** → target **App** → **Signing & Capabilities**.
4. Zapněte **Automatically manage signing** a vyberte svůj Team. Bundle Identifier zůstává `eu.trenomi.app`; pokud už je obsazený jiným vlastníkem, před prvním veřejným vydáním musíme změnit identifikátor ve všech platformách a souvisejících službách.
5. Vyberte simulátor a spusťte **Run ▶**. Pro vlastní připojený iPhone je potřeba nastavit důvěru a případně Developer Mode. Bez placeného členství lze použít omezený Personal Team pro vlastní testování; TestFlight a App Store vyžadují placený Apple Developer Program.

Minimální iOS je 17.4 kvůli webovým API používaným současnou aplikací. Nativní pluginy samy mohou podporovat starší systém, ale to nezaručuje funkčnost celé aplikace.

## 4. Supabase – registrace a obnova hesla

V Supabase → Authentication → URL Configuration ponechte současný Site URL webu a dosavadní Redirect URLs. Přidejte nový povolený návrat:

```text
trenomi://auth/**
```

Nativní aplikace používá pro vlastní registraci a obnovu hesla tento callback s PKCE. Odkaz při studeném startu i za běhu přejde do stávajícího ověřovacího toku; jednorázový odkaz se po reloadu znovu nespotřebovává. Neupravujte kvůli tomu veřejné e-mailové pozvánky na samotné lokální URI. Dokud nejsou zapojené ověřené HTTPS odkazy, veřejná pozvánka otevře webovou aplikaci.

Ověřte registraci, potvrzení e-mailu i obnovu hesla ve skutečném poštovním klientu na telefonu. Při testu PKCE otevřete odkaz na stejném zařízení, kde jste žádost zahájili.

## 5. Co zbývá před vydáním

### Vývojářské účty

- **Apple:** [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) → založit Apple Account s dvoufaktorovým ověřením → vybrat registraci osoby nebo organizace. Organizace obvykle potřebuje právní subjekt a D‑U‑N‑S. Po schválení založit aplikaci v App Store Connect a zapnout TestFlight. Aktuální cenu a podmínky ověřte při registraci; účet má vlastnit provozovatel Trenomi.
- **Google:** [play.google.com/console/signup](https://play.google.com/console/signup) → vybrat osobní nebo organizační účet → dokončit ověření identity, případně zařízení a organizace. Nové osobní účty mohou vyžadovat uzavřené testování před zpřístupněním produkce; přesné aktuální požadavky zobrazí Play Console.
- Přístup vývojářům přidávejte jako členství do týmu. Hesla, obnovovací kódy a privátní podpisové klíče nepatří do chatu ani GitHubu.

### Oznámení na zamykací obrazovce

Současný `push-rsvp` odesílá Web Push s VAPID. Nativní aplikace potřebuje vlastní registraci zařízení, odhlášení při změně účtu a serverové odesílání přes **FCM pro Android a APNs pro iOS** (případně FCM i pro iOS s APNs propojením). Nestačí pouze přidat plugin nebo znovu použít VAPID klíč. Po založení účtů doplníme konfiguraci Firebase/APNs, chráněné tokeny zařízení, rozšíření odesílací fronty a testy doručení/otevření konkrétní události. Než bude toto dokončené, nezveřejňujte nativní verzi jako plně funkční náhradu PWA oznámení.

### Otevírání veřejných odkazů přímo do aplikace

Custom scheme je připravený, ale **Android App Links / iOS Universal Links nejsou zatím aktivované**. Potřebujeme finální webovou doménu, Apple Team ID a SHA‑256 certifikátu Android App Signing. Vzor souborů je v `native/associations/`; nejsou záměrně publikované s neplatnými identifikátory. Po doplnění bude nutné soubory nasadit na HTTPS doménu bez přesměrování a doplnit doménu do manifestu / Associated Domains v Xcode. Ověřit odkaz z e-mailu, SMS, sociální sítě i za běhu aplikace.

### Povinné produktové a store podklady

- Doplnit **samoobslužné zrušení účtu** v aplikaci a webovou cestu pro žádost o odstranění účtu podle požadavků obchodů. Současná archivace člena trenérem ani odhlášení nejsou zrušením účtu. Před implementací vyřešit předání vlastnictví klubu a zákonné retenční povinnosti.
- Připravit veřejné zásady ochrany osobních údajů, kontaktní/podpůrnou adresu, podmínky a správné formuláře App Privacy / Data Safety. Aplikace pracuje s účtem, členstvím, fotografiemi, tréninkovými daty, zprávami a evidencí příspěvků; tyto údaje se musí posoudit podle skutečného použití. Soubor PrivacyInfo deklaruje důvod přístupu k časům vlastních souborů, nenahrazuje tyto formuláře.
- Doplnit popis, screenshoty pro požadované rozměry, věkové hodnocení a bezpečný testovací účet pro kontrolu obchodem. Připravit režim ukázkového klubu pro review bez osobních dat skutečných členů.
- Nastavit Android upload key + Play App Signing a Apple certifikáty/provisioning. Privátní soubory jsou vyloučené z Gitu; bezpečně je zálohujte.
- Při každém vydání zvýšit Android `versionCode` a iOS `CURRENT_PROJECT_VERSION`; už publikovaný build stejným číslem nenahradíte.

## 6. Kontrolní seznam na skutečných telefonech

- Přihlášení s volbou Zapamatovat i bez ní, úplné ukončení a opětovné spuštění, odhlášení a přihlášení jiného člena. Ověřit, že druhý účet nevidí data prvního.
- Malý iPhone s výřezem, Android s gesty i systémovými tlačítky; světlý/tmavý režim, otočení, horní/spodní panel při dlouhém rolování a klávesnice v chatu/formuláři.
- Člen i trenér: účast, hosté, chat, příspěvky, tvorba/editace události, hlavní fotka a samostatný výběr fotky pro Studio.
- Fotoaparát, omezený výběr fotografií na iOS, odmítnutá oprávnění, zrušení výběru; výběr JPEG/HEIC přes nativní galerii a výsledná fotografie v deníku.
- Studio: pinch/posuv, export PNG a sdílení do více aplikací, zrušení nabídky; CSV/JSON/ZIP uložit do Souborů. Sdílená kopie souboru opustí chráněnou aplikaci podle výběru uživatele.
- Přechod z pozadí, výpadek sítě a opětovné připojení; bez připojení aplikace nesmí tvrdit, že zápis proběhl.
- Tlačítko Zpět: nabídka, dialog, rozepsaný formulář, Studio, návrat na přehled. Mapa a navigace mimo aplikaci, návrat zpět.
- Před distribucí také push na zamčeném telefonu a App/Universal Links po doplnění příslušných služeb.

Exporty se dočasně ukládají do neveřejné cache aplikace, aby je cílová aplikace mohla přečíst. Soubory starší 24 hodin se čistí při dalším exportu; systém může cache odstranit dříve. Nejde o trvalý archiv. Nativní exporty nad 64 MB se odmítnou kvůli paměti; použijte web na počítači.

## Automatické kontroly

`npm test` a `npm run test:release-ui` chrání společný webový kód. `.github/workflows/native.yml` sestavuje debug Android APK + lint a nepodepsané iOS sestavení pro simulátor. CI používá **fiktivní backend** a neposílá žádná klubová data; jeho APK není připojené k produkci. Pro skutečný test sestavte balíček se svými veřejnými hodnotami. Testy simulátoru/sestavení nenahrazují oprávnění, fotoaparát, sdílení ani systémové panely na telefonu.
