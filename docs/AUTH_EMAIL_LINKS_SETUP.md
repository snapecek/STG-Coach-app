# Potvrzení e-mailového odkazu v Trenomi

Pokud odkaz selže hned při prvním otevření, může jej před uživatelem spotřebovat bezpečnostní skener pošty. Obecná chyba Supabase ale sama příčinu neprokazuje. Přesnou příčinu a časy je nutné dohledat v Authentication Logs; bez administrátorského přístupu je aplikace nevidí.

Nový postup otevře nejprve Trenomi. Teprve po klepnutí na **Pokračovat do Trenomi** aplikace zavolá Supabase `verifyOtp`. Samotné načtení stránky odkaz nespotřebuje. Supabase nadále kontroluje platnost a jednorázovost. Staré odkazy zůstávají podporované, již spotřebovaný odkaz nelze oživit.

## Nastavení v Supabase Dashboardu

Nejprve nasaďte frontend podporující `token_hash`. Potom v **Authentication → Email → Templates** (v některých verzích **Authentication → Email Templates**) upravte čtyři šablony níže. Můžete ponechat vlastní vzhled a předmět; nahraďte odkaz používající `{{ .ConfirmationURL }}` příslušným odkazem níže. Každou šablonu uložte. Hesla, SMTP ani dobu platnosti nemusíte kvůli této úpravě měnit.

### Invite user / Pozvat uživatele

```html
<h2>Pozvánka do Trenomi</h2>
<p>Trenér vás zve do aplikace Trenomi. Pokračujte k nastavení hesla a vstupu do klubu.</p>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=invite">Otevřít pozvánku v Trenomi</a></p>
<p>V aplikaci potvrďte tlačítkem Pokračovat do Trenomi.</p>
```

### Magic Link / Přihlašovací odkaz

```html
<h2>Přihlášení do Trenomi</h2>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=magiclink">Přihlásit se do Trenomi</a></p>
<p>V aplikaci potvrďte tlačítkem Pokračovat do Trenomi. Pro běžné návraty můžete používat také svůj e-mail a heslo.</p>
```

### Reset Password / Obnova hesla

```html
<h2>Nastavení hesla pro Trenomi</h2>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery">Nastavit nové heslo</a></p>
<p>V aplikaci nejprve potvrďte tlačítkem Pokračovat do Trenomi.</p>
```

### Confirm signup / Potvrzení registrace

```html
<h2>Potvrďte svůj e-mail pro Trenomi</h2>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=signup">Potvrdit e-mail</a></p>
<p>V aplikaci potvrďte tlačítkem Pokračovat do Trenomi.</p>
```

`{{ .RedirectTo }}` zachová cílovou adresu a klubový token, které aplikace již posílá. `#token_hash=...` je fragment odkazu, neposílá se při načtení stránky webovému serveru a aplikace jej odstraní z adresního řádku. Nezaměňujte `.TokenHash` za `.Token`, nevkládejte přihlašovací údaje ani klíče do šablon. Stávající Site URL a povolené Redirect URLs musí odpovídat vaší aplikaci, dle [nastavení členských účtů](MEMBER_ACCESS_SETUP.md).

## Ověření

Odešlete novou pozvánku na vlastní testovací e-mail. Při prvním otevření se má ukázat **Potvrďte otevření odkazu**. Po stisku **Pokračovat do Trenomi** nový člen nastaví heslo; existující člen pokračuje přihlášený. Ověřte i nový odkaz na obnovu hesla. Používejte nejnovější e-mail a test nedělejte s odkazy skutečných členů bez jejich souhlasu.

Pokud i nová pozvánka selže až po potvrzovacím tlačítku, zkontrolujte Authentication Logs, dobu platnosti a SMTP přepisování/sledování odkazů. Pokud se potvrzovací stránka vůbec neukáže, zkontrolujte uloženou šablonu a zda e-mail vznikl až po její úpravě. Změna šablony neupraví již odeslané zprávy. Není třeba další SQL migrace ani měnit `invite-member` kvůli samotnému potvrzovacímu kroku.
