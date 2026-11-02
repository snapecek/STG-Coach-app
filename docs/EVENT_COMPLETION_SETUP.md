# Dokončení událostí a ukončení bez doplnění dat

Nejdříve aplikujte novou migraci `supabase/migrations/202611020054_complete_without_data.sql` v Supabase SQL Editoru. Starší migrace znovu neaplikujte. Pak nasaďte web ze sestavení `npm run build`.

Detail události v Informacích a ve Výsledcích/Deníku vypisuje konkrétní překážky dokončení: konec události, chybějící průběh tréninku, prázdnou soupisku, jména s nepotvrzenou docházkou, chybějící výsledky závodníků, rozpory DNS/přítomnost a problémy týmů. Doprovod vyžaduje docházku, nikoliv závodní výsledek.

Po skončení plánované události může trenér nebo správce použít „Ukončit bez doplnění dat“. Aplikace vyžádá potvrzení a zavolá samostatnou RPC `complete_event_without_data`. RPC ověří roli, aktivní klub, vlastnictví události, její stav a konec. Uloží dokončení a identitu trenéra. Docházku, průběh, jednotlivé ani týmové výsledky nevytváří a nemění. Běžné dokončení dál vyžaduje kompletní údaje. Úpravy záznamu dál ruší dokončení.

Neznámá docházka zůstává neznámá. Ukončení bez dat nepotvrzuje, že se účastníci skutečně zúčastnili. Analýza pracuje s existujícími údaji dokončené události.

Bez migrace 054 aplikace při pokusu o ukončení bez dat zobrazí konkrétní požadavek na migraci a nepotvrdí úspěch.

Ověření: `npm test`, `npm run build`, `npm run test:database`, `STG_EVENT_COMPLETION_ONLY=1 npm run test:member-ui`, `STG_ATTENDANCE_REVIEW_ONLY=1 npm run test:member-ui`, `npm run test:result-entry-ui`. UI kontroly vyžadují běžící Vite se stejnou veřejnou konfigurací jako testovací proces, Playwright prohlížeč a používají fiktivní odpovědi API. Databázové testy běží v jednorázovém lokálním PostgreSQL.
