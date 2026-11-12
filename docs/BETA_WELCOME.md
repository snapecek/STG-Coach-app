# Veřejný beta úvod a kontrola přístupů

Nepřihlášený návštěvník běžné úvodní adresy uvidí grafické představení Trenomi, informaci o beta testování a připravovaném veřejném spuštění. Ukázka kalendáře, účasti, deníku a oznámení je ilustrační a neobsahuje skutečná klubová data.

**Vstup pro betatestery** otevře dosavadní přihlášení. U již přihlášeného účtu se úvod přeskočí. Po odhlášení se běžný webový návštěvník vrátí na úvod. Nativní aplikace zachovává dosavadní přihlašovací postup.

Veřejné tlačítko registrace není v běžném přihlášení dostupné. Registrace přes klubovou pozvánku zůstává zachovaná, stejně jako odkazy pro potvrzení e-mailu, nastavení či obnovu hesla a otevření události z oznámení. Push požadavek přijímá i samotný úvod a zachová událost do přihlášení.

Jde o změnu veřejného rozhraní, nikoliv o vypnutí registrací v Supabase Auth. Při kontrole byla registrace Auth povolená (`disable_signup=false`). Založení Auth účtu samo nepřiděluje klubovou roli. Původní `create_managed_club` vyžaduje existující vlastnické oprávnění k aktivnímu klubu; frontend tato pravidla nerozšiřuje. Žádný účet, klub ani oprávnění se touto změnou nemaže nebo neupravuje.

## Rozsah kontroly klubů a účtů

Běžný přihlášený účet čte jen kluby a účty, které mu zpřístupňují RLS pravidla. Takový výpis nemůže prokázat, že neexistuje další cizí neveřejný klub nebo samostatná registrace bez členství.

Pro úplnou kontrolu spusťte v **Supabase → SQL Editor** celý soubor [beta_access_audit.sql](../supabase/diagnostics/beta_access_audit.sql) s administrativním databázovým přístupem. Je to pouze čtecí diagnostika, nikoliv migrace. Vrací dva výsledky:

1. Všechny kluby včetně archivovaných, jejich vlastníky a dohledatelné schválení.
2. Auth účty, pro které není doložené schválení vlastníkem STG Karviná ani přijetí jeho členské pozvánky.

Dotaz používá ověřené UUID STG Karviná a odvozuje od něj účty vlastníků. Za doložené schválení považuje schválenou přihlášku nebo přijatou přímou pozvánku vystavenou tímto vlastníkem, jejíž adresa odpovídá aktuálnímu účtu. Chybějící historický doklad znamená **prověřit**, nikoliv automaticky neoprávněný účet. U ručně založených nebo starších účtů či po změně e-mailu může chybět i při legitimním přístupu. Výsledky obsahují osobní údaje a nejsou určené ke zveřejnění v repozitáři.

## Ověření a nasazení

- `npm test` a `npm run build`.
- S fiktivní konfigurací a spuštěným Vite: `STG_BETA_WELCOME_ONLY=1 npm run test:member-ui` pro šířky 320/390/1440 px, přihlášení, zachování relace, odhlášení a registraci přes pozvánku.
- `STG_BETA_PUSH_ENTRY_ONLY=1 npm run test:member-ui`, `STG_BETA_PASSWORD_RETURN_ONLY=1 npm run test:member-ui`, `STG_AUTH_LINKS_ONLY=1 npm run test:member-ui` a `STG_COACH_PUSH_ONLY=1 npm run test:member-ui` pro vstupy z oznámení a ověřovacích odkazů.
- Čtecí audit byl ověřen v odděleném PostgreSQL na fiktivním schváleném vlastníkovi, přijaté pozvánce, schválené přihlášce a neznámém vlastníkovi/účtu.

Pro nasazení úvodní stránky není potřeba databázová migrace ani změna Cronu. Stačí standardní sestavení a nasazení webu.
