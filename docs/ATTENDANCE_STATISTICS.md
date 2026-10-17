# Statistika účasti

Docházka tréninků i závodů a osobní statistiky v Analýze zobrazují nejprve oddíl **Členové** a poté **Hosté**. Oba oddíly jsou řazené podle příjmení s českou abecedou. Při stejném příjmení rozhoduje celé jméno. Záznam člena obsahuje celé jméno v jednom poli, proto se za příjmení považuje jeho poslední slovo.

Pravidelnost účasti za osm týdnů zahrnuje všechny osoby s ověřeným záznamem, včetně hostů a archivovaných osob s historickou docházkou; neomezuje se na pět členů. Neověřené a omluvené absence se do procent nezapočítávají. Průměrná účast zahrnuje i hosty z tréninků mimo šest posledních termínů tabulky, pokud spadají do osmitýdenního období. Vyhledávání a filtr skupiny platí i pro hosty. Host konkrétní události se v tabulce tréninků zobrazí pouze při vazbě na vybranou událost; nevytváří se mu absence na cizích soupiskách.

Členové a hosté mají každý vlastní stránkování po deseti osobách přímo pod svým oddílem. Hosté jsou proto vidět i při více než deseti členech. Přepnutí stránky jednoho oddílu nemění druhý oddíl ani souhrn Celkem. Změna nevyžaduje migraci a nemění uloženou docházku ani identity osob.

Ověření: `npm test`, `npm run build` a běžící Vite s fiktivní konfigurací pro `STG_ATTENDANCE_GUESTS_ONLY=1 npm run test:member-ui` a `STG_RACE_ATTENDANCE_ONLY=1 npm run test:member-ui`. Browserové testy používají výhradně fiktivní API a údaje.

Regrese stránkování: `STG_ATTENDANCE_PAGES_ONLY=1 npm run test:member-ui` ověřuje 16 členů a 12 hostů, oba oddíly na první stránce, nezávislé přepínání, celkové součty a reset hledáním u tréninků i závodů.
