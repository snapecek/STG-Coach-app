# Správa a archivace klubu

Migrace 030 ponechává současné role a vlastníka. Jedinečný index dovoluje v klubu nejvýše jednoho vlastníka; nekonzistentní existující vlastnictví se neslučuje automaticky. Vlastníka nelze z aplikace odebrat ani převést na trenéra.

Název, logo, práva trenérů, založení dalšího klubu a archivaci spravuje vlastník. Ostatní trenéři si v Nastavení mění pouze osobní vzhled. Odebrání trenérské role ponechá aktivnímu propojenému členovi členský přístup a historii; jinak odstraní klubový přístup.

Osobní volba primárního klubu v Nastavení se ukládá do metadat přihlášeného účtu (`primary_club_id`). Při vstupu se znovu načte z Auth a použije pouze tehdy, pokud účet má ke klubu stále přístup. Pozvánka má přednost, ostatní kluby zůstávají dostupné přes ikonu dresu vedle chatu a ruční přepnutí nemění primární klub.

## Archivace a záloha

Po potvrzení přesným názvem klubu se volitelně připraví ZIP do zařízení: `data.json` a skutečné soubory z privátních úložišť. ZIP má název `Název_klubu_backup_RRRR_MM_DD.zip`, podle názvu klubu a data vytvoření snímku v časové zóně Europe/Prague. Mezery, pomlčky a znaky nepovolené v názvech souborů se nahradí podtržítkem. Pokud příprava selže, archivace se nevyvolá. Limitem exportu do paměti prohlížeče je 256 MB; stažení ZIP lze vypnout.

Samotná databázová archivace **vždy** atomicky vytvoří chráněný JSON snímek všech klubových tabulek, označení v chatu a seznamu uložených souborů. Pokud kopie selže, transakce klub nearchivuje. Soubory a živá data zůstanou zmrazené. Archivační zámky serializují běžné zápisy a archivaci. Existující denní úklid archivovaných členů zmrazené kluby vynechává.

Archivní kopie nemá pro aplikační účty přímé oprávnění ke čtení, změně ani smazání. Členům a trenérům se klub přestane zobrazovat. Vlastník jej může obnovit přes kartu Archivované kluby, a to do času `expires_at = created_at + interval '3 months'`.

## Konec období obnovy

Po třech kalendářních měsících přestane archiv zobrazovat a obnovovat aplikační API. Migrace úmyslně nepřidává nevratný automatický úklid databázových kopií a souborů: jejich fyzická skartace je oddělená údržba provozovatele, která se provádí mimo aplikační účty. Tím nelze hlavním správcem v aplikaci obejít ochranu archivní zálohy. Není to náhrada nezávislých provozních záloh Supabase.

Archivace a obnova se ověřují pouze na fiktivních datech; produkční kontroly nemají provádět archivaci, obnovu, nahrávání loga nebo změny rolí.

## Aktivita v dalších klubech (031)

Nastavení primárního klubu je dostupné trenérům i členům. Ikona dresu nahrazuje původní výběrové pole; v hlavičce je název a logo právě otevřeného klubu. Seznam klubů zůstává funkční i před nahráním migrace 031, ale počty aktivity vyžadují její RPC.

Číslo u dresu sčítá nepřečtené zprávy a nové či změněné události v ostatních dostupných klubech. Seznam zobrazuje počty po klubech, včetně aktuálního. Jedna událost se počítá jednou bez ohledu na počet úprav. Zprávy používají stávající oprávnění ke konverzacím; skryté skupinové události, cizí soukromé zprávy a archivované kluby se nezapočítají. Počty se obnovují každých 15 sekund, po návratu na stránku a změně chatu.

Otevření klubu potvrdí poslední viditelné změny událostí pomocí serverové časové značky. Nepotvrdí přečtení zpráv: ty zůstávají nepřečtené do otevření konverzace. Migrace zavede výchozí stav pro existující členství, takže staré události nezpůsobí hromadná upozornění. Preference ani značky nepřečtených aktivit neovlivňují klubová oprávnění.
