# Vzhled, mobilní zobrazení a hosté členů

## Vzhled a mobilní prohlížeč

Můj účet → Vzhled aplikace přepíná tmavý a světlý režim. Výchozí je dosavadní tmavý režim. Volba se ukládá na zařízení do nového klíče `trenomi-theme`; přihlášení a dosavadní úložiště se nemění. Zablokované úložiště přepínání na aktuální stránce neznemožní. Preference se načte před vykreslením stránky, mění odpovídající SVG logo a barvu prostředí prohlížeče. Oranžová #FFB317 zůstává společná, tmavé pozadí #101216 se zachovává.

Viewport používá šířku zařízení, měřítko 1 a `viewport-fit=cover`. Mobilní formulářové prvky mají nejméně 16px písmo, aby iOS při jejich aktivaci nevyvolával automatické přiblížení. Opravené šířky formulářů a dialogů nepřesahují obrazovku. Ruční přiblížení zůstává dostupné; maximum-scale ani zákaz zoomu se nepoužívají. Testy používají mobilní emulaci s dotykem a kontrolují měřítko i při zaměření přihlašovacího pole.

## Stavový řádek nainstalované iOS aplikace

HTML výslovně uvádí `apple-mobile-web-app-capable=yes`, standardní `mobile-web-app-capable=yes` a `apple-mobile-web-app-status-bar-style=default`. Podle [dokumentace Applu](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html) tento styl umísťuje obsah pod běžný stavový řádek; `black-translucent` umožňuje překrytí. Dříve Apple metadata nebyla uvedena. Protože dokumentace už jako výchozí hodnotu uvádí `default`, samotné doplnění není důkazem příčiny ani potvrzenou opravou iOS 27.0.1. Jde o explicitní nastavení ověřované na zařízení.

Metadata nemění manifest, identitu aplikace, přihlášení ani uložená data. V iOS může být vzhled systémového panelu uložený v instalaci z plochy; obyčejné načtení nové verze pak nemusí staré nastavení změnit.

Uživatel následně potvrdil, že ani nové přidání na plochu rozmazání neodstranilo. Diagnostika verze `b3e5f62` na iPhonu uvádí viewport 390×797, horní bezpečný okraj 0px, hlavičku vysokou 88px a logo na y=0; předci nemají filtr, backdrop filtr, transformaci ani sníženou neprůhlednost. Samotný nulový safe-area inset není důkaz chyby, protože systém může stavový řádek vyhradit mimo webový viewport.

Historie před ukotvením (`db8fea4`) měla na mobilní kartě `padding-top:21px`; ukotvení (`2453d8a`) jej nahradilo 10px v hlavičce a pozdější `847ba01` odstranil horní okraj v instalované iOS aplikaci úplně. Nyní se pouze pro instalované iOS vrací původní 21px okraj přímo do hlavičky. Rozestup řádků zůstává 2px a spodní odsazení 0px: celá hlavička je 109px, tedy o 5px menší než běžná mobilní hlavička 114px. Nejde o další přičtenou 16px/26px kompenzaci. Oba panely zůstávají v řádcích gridu a roluje pouze obsah; horní přechod je nadále oříznutý pod hlavičkou. Návrat původní geometrie musí potvrdit iPhone, sám o sobě nedokazuje odstranění nativního efektu.

Ověření na iPhonu: nejprve uložit rozpracované formuláře, načíst novou verzi a aplikaci úplně zavřít a otevřít. Zkontrolovat světlý/tmavý motiv před rolováním, po rolování a po otočení. Pokud stará instalace zůstává rozmazaná, porovnat nově přidanou ikonu ze Safari. Odstranění původní webové aplikace může zrušit místní přihlášení a odběr oznámení; serverová klubová data zůstávají v Supabase. Po nové instalaci se případně přihlásit a znovu povolit mobilní oznámení v nastavení.

V Můj účet → Nápověda → Návod k používání je dole tlačítko **Zobrazit údaje o zobrazení**. Vytvoří pouze místní snímek verze, user agentu, metadat, viewportu, skutečných okrajů a filtrů předků hlavičky. Nečte úložiště, URL, názvy klubu, zprávy ani formuláře; nic samo neposílá. Uživatel může snímek pro podporu zkopírovat.

Automatické kontroly ověřují dodaná metadata, rozložení a aktualizaci aplikace. Linux WebKit nereprodukuje systémový efekt iOS, proto výsledek musí potvrdit iPhone 27.0.1; nesmí se prohlásit za potvrzený pouze na základě emulace nebo jiného projektu.

## Host přidaný členem

Po migraci [026](../supabase/migrations/202610150026_member_training_guests.sql) může aktivní propojený člen v detailu budoucího tréninku zadat hosta bez účtu. Nejdřív musí zvolit Přijdu; u omezené skupinové události musí patřit do její soupisky. Po zahájení, dokončení nebo zrušení tréninku nelze hosta přidávat. Závody tuto možnost nemají.

Host má běžný klubový záznam typu host a vlastní účast na vybraném tréninku, se jménem a vazbou na zvoucího člena. Host nezískává účet ani přístup do aplikace. Kapacitu i pořadí čekací listiny řídí původní rezervační mechanismus. Člen může pozvat nejvýše 5 hostů na trénink; trenér dál potvrzuje skutečnou docházku, výsledky a měření.

Opětovné zadání stejného vlastního hosta nevytváří duplicitní členský záznam nebo účast. Archivovaného hosta může obnovit trenér, člen jeho archivaci neobchází novým záznamem. Člen může před začátkem po potvrzení odhlásit svého hosta, pokud trenér již nezapsal jeho docházku. Změnou vlastní odpovědi z Přijdu na jinou odpověď se automaticky odhlásí jeho hosté bez zapsané docházky. Stejně se u budoucích tréninků uvolní jejich rezervace při archivaci zvoucího člena.

Noví hosté se objevují v soupisce jen tam, kde mají účast. Nezapočítávají se automaticky do jiných či historických tréninků a neblokují jejich dokončení. Dosavadní hosté přidaní trenérem se nemění. Přístupy vynucují RPC na serveru, běžný člen nedostává přímé právo vkládat či upravovat klubové členy nebo potvrzovat docházku.

## Kontroly

`member_guests.sql` pokrývá oprávnění, kapacitu, duplicity, archivovaného hosta, odhlašování, skutečnou docházku trenérem a dokončení nesouvisejícího tréninku. `STG_THEME_GUESTS_ONLY=1 npm run test:member-ui` ověřuje oba vzhledy, jejich uchování, loga, mobilní viewport, hlavní obrazovky a přidání/odhlášení hosta s fiktivním API. Používá stejné Vite nastavení jako ostatní UI testy.
