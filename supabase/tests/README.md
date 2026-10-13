# Databázové kontroly

`tenant_access.sql` se spouští až po všech třech migracích v prázdném vývojovém Supabase projektu; při chybě proveďte ROLLBACK. Vkládá pouze fiktivní data a na konci je odstraní rollbackem.

Kontroly: trenér vidí jen svůj klub, šablony, události a účast; nelze připojit šablonu nebo člena z jiného klubu; trenér nemůže přidělovat role; člen vidí události, ale ne registr ani účast a nemůže potvrzovat docházku; anonym nemůže číst registr.

`local-bootstrap.sql` je pouze testovací náhrada schémat auth/storage pro samostatný PostgreSQL. **Nikdy jej nespouštějte v Supabase projektu.** Není náhradou Supabase Auth/Storage integračních testů.

Pro opakování lokální kontroly v izolovaném Docker kontejneru (bez publikovaného portu):

```sh
docker run -d --name stg-rls-validation -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
# Počkejte, až pg_isready potvrdí připravenost.
docker exec stg-rls-validation pg_isready -U postgres
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/local-bootstrap.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120001_initial.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610130002_club_management.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610130003_journal_photos.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/tenant_access.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/club_management.sql
docker exec -i stg-rls-validation psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/journal_photos.sql
docker rm -f stg-rls-validation
```

Skutečné API testy: `python3 scripts/check-cloud.py` s konfigurací veřejného klíče a testovacího účtu v proměnných prostředí. Skript zapíše fiktivní fixtures pouze do jednoho vývojového klubu s rolí owner a následně smaže jen záznamy s vlastními generovanými UUID. Nemá oprávnění vytvářet druhý klub; test nepřiřazeného UUID přes API doplňuje lokální test existujících dvou klubů.

`club_management.sql` navíc kontroluje archivaci a obnovení identity/role, zachování plánů při smazání šablony, podmínky dokončení, opětovné otevření po změně účasti, zrušení, RLS skrytí expirovaných osobních údajů, zákaz obnovení po limitu a fyzický úklid. Retenční datum simuluje pouze testovací administrace dočasným vypnutím triggeru v transakci, vše se vrací rollbackem. Běžný uživatel globální purge volat nemůže.

`journal_photos.sql` testuje pouze metadata a RLS objektů v izolovaném DB testu, nikoli fyzické soubory. Ověřuje dva klubové UUID, roli coach, member a anon, path formát, limit 20, zamítnutí uploadu ke zrušené/cizí události a povinný úklid před smazáním události. Pro skutečné soubory slouží `npm run test:ui`; jeho cleanup odstraňuje vlastní fyzické fixtures přes Storage API ještě před smazáním vlastních událostí. Nikdy nemažte storage.objects přímo v produkčním SQL.

Výsledky závodů: po třetí migraci aplikujte `202610130004_race_results.sql` a spusťte `race_results.sql` stejným příkazem psql. Ověřuje staff/member/anon/cizí účet, vazby, platnost času, zrušení, změnu typu a otevření dokončení.
