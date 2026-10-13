# Založení Supabase pro STG Coach

Tato etapa ověřuje přihlášení a členství v klubu. Cloudové ukládání členů a tréninků zatím není zapojené. Používejte pouze fiktivní data, dokud neprojdou integrační testy RLS a celého uživatelského workflow.

## 1. Založte projekt

1. Otevřete https://supabase.com/dashboard a přihlaste se.
2. Zvolte **New project**, organizaci a název `STG Coach – development`.
3. Zvolte evropský region blízko uživatelům a silné databázové heslo uložte do správce hesel. Heslo neposílejte do chatu ani do frontendové konfigurace.
4. Počkejte na dokončení vytvoření projektu.

## 2. Připravte databázi

V novém prázdném projektu otevřete **SQL Editor** a spusťte obsah `supabase/migrations/202610120001_initial.sql` jednou. Případně použijte Supabase CLI a `supabase db push` podle README. Nespouštějte migraci opakovaně ručně: vytváří tabulky a politiky, není idempotentní. Pokud migrace selže, neposílejte další dotazy naslepo; sdělte chybu bez tajných hodnot.

Potom můžete ve stejném prázdném vývojovém projektu spustit `supabase/tests/tenant_access.sql`. Test dočasně vytvoří fiktivní uživatele a kluby, ověří role a vše vrátí pomocí ROLLBACK. Výsledek bez chyby znamená průchod uvedených databázových kontrol, nikoliv ověření UI ani fotografií.

## 3. Přidejte testovací účet a klub

V **Authentication → Users** vytvořte vlastní testovací účet s e-mailem a heslem; podle nabídky dashboardu potvrďte e-mail. Pro tuto etapu nastavte v Auth vypnuté veřejné registrace. Aplikace veřejnou registraci neposkytuje. Zkopírujte UUID účtu a v SQL Editoru spusťte následující dotaz po nahrazení `UUID_TESTOVACIHO_UCTU`:

```sql
with new_club as (
  insert into public.clubs(name)
  values ('Fiktivní STG testovací klub') returning id
)
insert into public.club_roles(club_id,user_id,role)
select id,'UUID_TESTOVACIHO_UCTU'::uuid,'owner' from new_club;
```

Dotaz provádí správce přes dashboard, nikdy prohlížeč pomocí service_role. Další uživatel nedostává klub automaticky; bez přiřazené role aplikace ukáže stav „Účet zatím nemá přidělený klub“.

## 4. Připojte aplikaci

V nastavení projektu najděte **Project URL** a veřejný **publishable key** (`sb_publishable_…`), případně starší `anon` klíč. Umístění se může lišit podle verze dashboardu (Connect / Settings / API Keys).

V nastavení cloudového prostředí vyplňte tyto proměnné:

- `VITE_SUPABASE_URL`: projektová HTTPS URL, obvykle `https://<project-ref>.supabase.co`.
- `VITE_SUPABASE_ANON_KEY`: veřejný publishable nebo anon klíč.

Do síťového seznamu povolených domén přidejte přesný hostname svého projektu `<project-ref>.supabase.co`. Ostatní domény ponechte. Vite hodnoty čte při startu/buildování: po změně restartujte server a znovu sestavte produkci. Uložení návrhu konfigurace samo o sobě nerestartuje server.

Veřejný klíč je určený pro frontend a přístup k datům omezuje RLS. Nepoužívejte `service_role`, `sb_secret_…`, databázové heslo ani access token. Tyto tajné hodnoty nevkládejte do VITE proměnných; ve výsledném JavaScriptu by byly veřejné. Bez těchto údajů lze stále používat fiktivní demo.

Lokálně můžete použít `.env.local` podle `.env.example`; tento soubor Git ignoruje. Hodnoty nemají být v README ani commitech.

## 5. Ověřte přihlášení

V aplikaci zvolte **Přihlásit se**. Přihlaste testovací účet. Aplikace ověří identitu přes Auth, načte pouze členství daného účtu a nabídne přiřazené kluby. Vybraný klub zatím obsahuje pouze ověření přístupu, nikoli registr či tréninky.

Ověřte nesprávné heslo, účet bez klubu, účet se dvěma kluby a odhlášení. Po odhlášení nesmí zůstávat seznam klubů. Cloudový prostor při chybě nikdy nepřejde na demo data. Demo se do databáze neimportuje.

## Další etapa

Po ověření konfigurace: zapojení cloudového datového adaptéru, ukládání šablon/událostí/účasti, testy zápisů a oddělení klubů přes skutečné API. Teprve po jejich průchodu lze plánovat použití skutečných členských údajů. Fotografie, reset hesla, pozvánky, MFA a samoobslužné RSVP člena zůstávají dalšími úkoly.
