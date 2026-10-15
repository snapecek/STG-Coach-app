# Vzhled, mobilní zobrazení a hosté členů

## Vzhled a mobilní prohlížeč

Můj účet → Vzhled aplikace přepíná tmavý a světlý režim. Výchozí je dosavadní tmavý režim. Volba se ukládá na zařízení do nového klíče `trenomi-theme`; přihlášení a dosavadní úložiště se nemění. Zablokované úložiště přepínání na aktuální stránce neznemožní. Preference se načte před vykreslením stránky, mění odpovídající SVG logo a barvu prostředí prohlížeče. Oranžová #FFB317 zůstává společná, tmavé pozadí #101216 se zachovává.

Viewport používá šířku zařízení, měřítko 1 a `viewport-fit=cover`. Mobilní formulářové prvky mají nejméně 16px písmo, aby iOS při jejich aktivaci nevyvolával automatické přiblížení. Opravené šířky formulářů a dialogů nepřesahují obrazovku. Ruční přiblížení zůstává dostupné; maximum-scale ani zákaz zoomu se nepoužívají. Testy používají mobilní emulaci s dotykem a kontrolují měřítko i při zaměření přihlašovacího pole.

## Host přidaný členem

Po migraci [026](../supabase/migrations/202610150026_member_training_guests.sql) může aktivní propojený člen v detailu budoucího tréninku zadat hosta bez účtu. Nejdřív musí zvolit Přijdu; u omezené skupinové události musí patřit do její soupisky. Po zahájení, dokončení nebo zrušení tréninku nelze hosta přidávat. Závody tuto možnost nemají.

Host má běžný klubový záznam typu host a vlastní účast na vybraném tréninku, se jménem a vazbou na zvoucího člena. Host nezískává účet ani přístup do aplikace. Kapacitu i pořadí čekací listiny řídí původní rezervační mechanismus. Člen může pozvat nejvýše 5 hostů na trénink; trenér dál potvrzuje skutečnou docházku, výsledky a měření.

Opětovné zadání stejného vlastního hosta nevytváří duplicitní členský záznam nebo účast. Archivovaného hosta může obnovit trenér, člen jeho archivaci neobchází novým záznamem. Člen může před začátkem po potvrzení odhlásit svého hosta, pokud trenér již nezapsal jeho docházku. Změnou vlastní odpovědi z Přijdu na jinou odpověď se automaticky odhlásí jeho hosté bez zapsané docházky. Stejně se u budoucích tréninků uvolní jejich rezervace při archivaci zvoucího člena.

Noví hosté se objevují v soupisce jen tam, kde mají účast. Nezapočítávají se automaticky do jiných či historických tréninků a neblokují jejich dokončení. Dosavadní hosté přidaní trenérem se nemění. Přístupy vynucují RPC na serveru, běžný člen nedostává přímé právo vkládat či upravovat klubové členy nebo potvrzovat docházku.

## Kontroly

`member_guests.sql` pokrývá oprávnění, kapacitu, duplicity, archivovaného hosta, odhlašování, skutečnou docházku trenérem a dokončení nesouvisejícího tréninku. `STG_THEME_GUESTS_ONLY=1 npm run test:member-ui` ověřuje oba vzhledy, jejich uchování, loga, mobilní viewport, hlavní obrazovky a přidání/odhlášení hosta s fiktivním API. Používá stejné Vite nastavení jako ostatní UI testy.
