# Statistika účasti

Docházka tréninků i závodů a osobní statistiky v Analýze zobrazují nejprve oddíl **Členové** a poté **Hosté**. Oba oddíly jsou řazené podle příjmení s českou abecedou. Při stejném příjmení rozhoduje celé jméno. Záznam člena obsahuje celé jméno v jednom poli, proto se za příjmení považuje jeho poslední slovo.

Pravidelnost účasti za osm týdnů zahrnuje všechny osoby s ověřeným záznamem, včetně hostů a archivovaných osob s historickou docházkou; neomezuje se na pět členů. Neověřené a omluvené absence se do procent nezapočítávají. Průměrná účast zahrnuje i hosty z tréninků mimo šest posledních termínů tabulky, pokud spadají do osmitýdenního období. Vyhledávání a filtr skupiny platí i pro hosty. Host konkrétní události se v tabulce tréninků zobrazí pouze při vazbě na vybranou událost; nevytváří se mu absence na cizích soupiskách.

Stránkování tabulek zůstává po deseti osobách, oddíl se označí i při pokračování na další stránce. Změna nevyžaduje migraci a nemění uloženou docházku ani identity osob.

Ověření: `npm test`, `npm run build` a běžící Vite s fiktivní konfigurací pro `STG_ATTENDANCE_GUESTS_ONLY=1 npm run test:member-ui` a `STG_RACE_ATTENDANCE_ONLY=1 npm run test:member-ui`. Browserové testy používají výhradně fiktivní API a údaje.
