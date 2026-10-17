# Pozvání do klubu přes SMS nebo sociální síť

Trenér nemusí znát jméno ani e-mail zájemce. V **Členové → Pozvat nového zájemce → Pozvat přes odkaz** vytvoří odkaz a zkopíruje jej do zprávy nebo použije systémové sdílení telefonu. Sdílený text vysvětluje, že jde o Trenomi pro společné tréninky, závody a týmovou komunikaci.

## Zapnutí

1. Po již nasazených migracích 001–034 spusťte v Supabase SQL Editoru celý soubor **supabase/migrations/202610170035_shareable_club_invitations.sql**.
2. Obnovte aplikaci a v sekci Členové vytvořte odkaz.

**Funkci `invite-member` není potřeba aktualizovat.** Nový způsob používá databázové RPC; dosavadní e-mailové pozvánky, ruční členové a hosté zůstávají zachované. Migrace je aditivní a nerozesílá zprávy ani nezakládá členství.

Příjemce potřebuje vlastní účet s ověřeným e-mailem. Stávající registrace účtů a potvrzovací e-mail ze Supabase Auth se používají i nadále. Při kontrole veřejného Auth nastavení 17. 10. 2026 bylo vytváření účtů povolené (`disable_signup=false`), e-mailové přihlašování zapnuté a potvrzování e-mailu vyžadované (`mailer_autoconfirm=false`). Žádný skutečný registrační e-mail nebyl v rámci ověření odeslaný.

## Použití trenérem

- **Vytvořit odkaz**: platnost 7 dní, odkaz lze během ní poslat více zájemcům. Funguje také u klubu, který není nabízený ve veřejném příjmu přihlášek.
- **Kopírovat odkaz**: vložte do SMS, WhatsAppu, Messengeru nebo jiné zprávy.
- **Sdílet pozvánku**: otevře nabídku sdílení podporovaného zařízení. Při nepodporovaném sdílení zkopíruje odkaz. Aplikace sama neposílá SMS a nesleduje jejich doručení.
- **Platné odkazy**: přehled data vytvoření a platnosti; **Obnovit odkazy** aktualizuje seznam a **Zneplatnit odkaz** po potvrzení zabrání novým přihláškám přes tento odkaz. Dříve podané přihlášky ani členství se nemažou. Zobrazují se nejnovější platné odkazy, nejvýše 200.

Plný odkaz si zkopírujte při vytvoření. Na serveru se ukládá jen hash tokenu, takže po obnovení stránky nelze původní odkaz znovu zobrazit; můžete vytvořit další a starý podle potřeby zneplatnit. Vytvoření nového odkazu starší platné odkazy neruší. Vytváření je omezené na 20 odkazů za hodinu na trenérský účet.

## Postup příjemce

1. Otevře odkaz ze zprávy.
2. Má-li už účet Trenomi, přihlásí se. Jinak vytvoří účet, vyplní jméno, příjmení, vlastní e-mail a heslo a potvrdí e-mail.
3. Pozvaný klub je předvybraný; odešle přihlášku. Kontext pozvánky zůstane zachovaný i při otevření potvrzovacího e-mailu v jiném prohlížeči.
4. Do schválení nevidí členy, kalendář ani chat klubu.
5. Trenér v sekci Členové schválí přihlášku. Může ji propojit s již evidovaným členem či hostem, aby se zachovala docházka a historie, stejně jako u dosavadních přihlášek.

## Technické a provozní chování

- Tabulka `club_join_links` má RLS a pro trenéry jsou čitelné pouze identifikátor klubu/pozvánky a časové údaje, ne hash. Člen ani zájemce nemůže odkazy vystavovat či rušit. Anonymní klient nemůže přes odkaz vyhledat neveřejný klub.
- `issue_join_link` vytváří náhodný 256bitový token; `revoke_join_link` ověřuje roli ve stejném aktivním klubu.
- Existující `joinable_clubs` a `submit_club_application` přijímají kromě e-mailové pozvánky také platný sdílený odkaz. E-mailová pozvánka nadále vyžaduje správnou ověřenou adresu; sdílený odkaz žádá ověřenou adresu příjemce, ale není svázaný s adresou zadanou trenérem.
- Platí původní limit podávání přihlášek, jedinečnost čekající přihlášky a schvalovací proces. Odkaz nikdy nepřidává roli trenéra ani správce.
- Změny respektují zámek archivace klubu. Nová tabulka se automaticky zahrne do stávající zálohy podle `club_id`; archivovaný klub nové přihlášky nepřijímá.
- Používá se existující `join-invite` a klíč rozpracované pozvánky. Token se po otevření odstraní z adresního řádku; registrace jej předá i do existujícího návratu `/?auth=signup`, aby byl dostupný při potvrzení na jiném zařízení. Základní adresa přihlašovacího návratu se nemění.

## Ověření

`npm run build`, `npm test`, `npm run test:database` a simulované UI průchody `STG_SHARE_INVITES_ONLY=1 npm run test:member-ui` a `STG_APPLICATIONS_ONLY=1 npm run test:member-ui`.

Databázové kontroly spouštějí všech 35 migrací v jednorázovém PostgreSQL, včetně RLS, odlišných ověřených e-mailů, opakovaného použití, schválení až po přihlášce, expirace, odvolání, cizího klubu, archivace, záloh a limitu vytváření. UI kontroluje vytvoření bez e-mailu, kopírování a sdílení, registraci a potvrzení v novém prohlížeči, výběr soukromého klubu, čekání/schválení, rušení odkazu a mobilní šířky. Používá smyšlené účty a neposílá skutečné zprávy. Nasazení migrace do hostovaného projektu provádí správce ručně výše uvedeným postupem.
