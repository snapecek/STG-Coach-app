# Pozvánky, datum přidání a odstranění historického tréninku

## Nasazení

1. V Supabase SQL Editoru jednou spusťte [migraci 033](../supabase/migrations/202610170033_member_joined_at.sql). Navazuje na migraci 032. Přidává pouze datum přidání člena; stávající záznamy ani členství nemaže.
2. V Authentication → Email Templates vložte [invite.html](../supabase/templates/invite.html) do šablony **Invite user** a [magic-link.html](../supabase/templates/magic-link.html) do **Magic Link**. Předmět: **Pozvánka do Trenomi – klubová aplikace**. Zachovávají potvrzení odkazu až kliknutím v aplikaci. Podrobnosti jsou v [návodu pro e-mailové odkazy](AUTH_EMAIL_LINKS_SETUP.md).
3. Webové změny se nasazují běžným Vercel deployem. Funkci `invite-member` není kvůli těmto změnám potřeba znovu měnit (stále je nutná její verze pro migraci 032).

## Chování

- **Členové → Nevyřízené registrační pozvánky → Zaslat znovu** odešle pozvánku na již uložený e-mail. Vznikne nový odkaz a předchozí nevyplněná klubová pozvánka se odvolá. Platí stejné serverové limity odesílání jako při novém pozvání.
- Odeslané přihlášky se řeší ve schvalování. Schválené přihlášky a odvolané/spotřebované pozvánky se v pracovním seznamu nezobrazují; podkladová historie zůstává v databázi.
- Novým členům se ukládá datum přidání do evidence. U historických členů migrace převezme nejstarší dohledatelné přijetí klubové pozvánky nebo schválení přihlášky. Pokud datum neznáme, zobrazí se **Datum přidání neevidováno**; datum migrace se za datum příchodu nevydává. Archivace a obnovení datum nemění. Web zůstává funkční i před aplikováním 033.
- **Deník → detail tréninku → Smazat trénink** funguje i pro uplynulý a dokončený trénink. Vyžaduje potvrzení. Smaže událost a její návaznou docházku, průběh, výsledky, minihry, úkoly, chat a fotografie. Ostatní události série i členové zůstávají. Tato akce je trvalá; pro zachování historie použijte dosavadní zrušení události.

Šablony jsou podklady pro Supabase, nikoliv automatická změna již odeslaných e-mailů. Skutečné odeslání testujte jen na vlastní testovací adrese.
