# Pilot: 1 trenér a 4 členové

Cíl: ověřit celý běžný průchod aplikací před úpravami UI. Jeden klub, jeden trenér/správce a čtyři dobrovolně zapojení členové označení A–D. Každý člen použije vlastní účet a svou schránku; trenérský účet nepřepínejte na člena. UI upravíme podle zaznamenaných problémů z pilotu.

Aplikace: https://project-ym4q2.vercel.app/

## Příprava

1. V registru vyberte čtyři skutečné členy. Dříve odebrané členy obnovte z archivu; nezakládejte je znovu. Zkontrolujte, že každá osoba má právě jeden správný členský záznam.
2. U dosud nepropojených členů zvolte **Pozvat účet** a použijte e-mail, který si tester sám vybral. Odesílání provádí trenér v aplikaci; tento návod ani automatická kontrola e-maily neposílají.
3. Každý člen potvrdí doručení ve schránce, otevře odkaz, nastaví heslo a přijme klubovou pozvánku. Po novém přihlášení se musí zobrazit stejný klub a členské prostředí. U již propojeného účtu stačí přihlášení.
4. Jeden dobrovolník zvolí **Zapomenuté heslo**, ověří doručení a skutečně dokončí změnu hesla. Následně ověří přihlášení novým heslem. Pokud má jeho účet uložené testovací přihlášení v cloud prostředí, aktualizujte je bezpečně v nastavení; nepište heslo do hlášení chyb ani do chatu.
5. Pokud e-maily nedorazí nebo odkaz přesměruje jinam, pilot účtů zatím neprošel. Prověřte SMTP, Auth URL a povolené redirecty podle [MEMBER_ACCESS_SETUP.md](MEMBER_ACCESS_SETUP.md). Dostupnost funkce sama nepotvrzuje doručení.

## Průchod

Všechny zkušební události zřetelně označte **Pilot – ...**. Neoznačujte skutečné účastníky jako přítomné automaticky; docházku potvrzuje trenér podle skutečnosti. Pro RSVP test zvolte budoucí čas. Dokončení se zpřístupní až po startu + celé plánované délce, ne samotným dosažením začátku.

| Krok | Kdo | Akce | Očekávaný výsledek |
|---|---|---|---|
| 1 | Trenér | Uloží vlastní tréninkovou a závodní šablonu, jednu pomůcku a šablonu minihry na body. | Šablony přetrvají po obnovení aplikace; žádné přednastavené závody. |
| 2 | Trenér | Vytvoří **Pilot – trénink** ze šablony, pro celý klub, s kapacitou 3. | Správný termín v Praze, místo a plán. Členové událost vidí. |
| 3 | A, B, C, potom D | V tomto pořadí zvolí **Přijdu**. | A–C mají potvrzené místo, D je na čekací listině. RSVP není skutečná docházka. |
| 4 | B, potom D | B zvolí **Nepřijdu**, D obnoví data. | D získá uvolněné místo. Opakované Přijdu u potvrzeného člena nemění pořadí. |
| 5 | Trenér | Po skončení otevře deník bez doplněných údajů. | Dokončení ukazuje konkrétní chybějící průběh a nepotvrzenou docházku. |
| 6 | Trenér | Uloží skutečný průběh a vybere uloženou pomůcku. Potvrdí skutečnou docházku všech evidovaných osob. | Poznámka, pomůcka i docházka přetrvají po reloadu. Nejdu neznamená automaticky potvrzenou nepřítomnost. Omluvení se nepočítá do procenta účasti. |
| 7 | Trenér | V deníku dodatečně přidá neplánovanou minihru ze šablony. Vybere skutečné účastníky; při týmové hře je rozdělí do dvou týmů. | Jeden hráč je nejvýše v jednom týmu. Jména účastníků jsou u týmu vidět. |
| 8 | Trenér | Zapíše společné výsledky na body (ověřte i hodnotu 0) a obnoví stránku. | Výsledky a pořadí zůstanou. Vyšší body vítězí, shodné výsledky sdílí pořadí. Chybějící výsledek není nula. Přítomnost musí odpovídat výsledku všech členů týmu. |
| 9 | Trenér | Zvolí **Dokončit trénink** a otevře Analýzu se správným obdobím. | Trénink je uzavřený a započítaný. Pouhé uplynutí času jej do analýzy nezapočítá. |
| 10 | A–D | Otevřou vlastní deník a obnoví stránku. | Vidí vlastní trenérem potvrzenou účast; nemohou upravovat docházku ostatních ani otevírat staff správu. |
| 11 | Trenér | Vytvoří **Pilot – závod** z vlastní šablony, pozve A–D. | Šablona předvyplní disciplínu/délku; změna místa a názvu je neovlivní. |
| 12 | A–D | Vyzkouší **Zúčastním se**, **Možná**, **Nezúčastním se** a **Doprovod**, potom reload. | Závodní popisky a odpovědi zůstávají i u již vytvořené události. |
| 13 | Trenér | Po závodě ověří přítomnost a výsledky závodníků. U doprovodu jen přítomnost/nepřítomnost. | Doprovod nepotřebuje výsledek a nelze ho přidat do závodního týmu. Událost lze dokončit až po potřebných údajích. |
| 14 | Všichni | Odhlásí se a znovu přihlásí; ověří telefon a počítač. | Správný účet/klub a uložená data. Žádné zobrazení cizího klubu ani kopie člena. |

Při pilotu s více evidovanými členy klubu musí trenér u běžného tréninku ověřit docházku všech evidovaných osob. Chcete-li omezit soupisku pouze na A–D, vytvořte testovací skupinu s těmito čtyřmi a naplánujte skupinový trénink; vynechaní členové pak dokončení neblokují.

## Záznam výsledků

Pro každý krok zapište **Prošlo / Neprošlo / Neověřeno**. Neověřené doručení, pouze přijatý požadavek API a skutečně přijatý e-mail jsou různé výsledky.

U problému stačí:

- číslo kroku, role (trenér/člen A–D), název testovací události a čas v Praze;
- zařízení/prohlížeč a přesný postup;
- očekávaný a skutečný výsledek;
- text chyby, případně snímek bez hesel, tokenů nebo odkazů s pozvánkou.

Před úpravami UI nejprve opravíme případné chyby účtů, ukládání a oprávnění. Návrhy na vzhled zapisujte samostatně, aby neblokovaly funkční ověření.

Pilot je dokončený po skutečném doručení a přijetí pozvánek, obnově hesla, průchodu tréninkem/deníkem/analýzou a závodem. E-mailové připomínky, automatické zprávy a redesign UI zůstávají odložené.

## Automatická kontrola před pilotem

`python3 scripts/check-pilot-readiness.py` ověří Auth nastavení, dostupnost pozvánkové funkce a CORS, potřebné tabulky, dostupný trenérský účet a případně samostatný členský účet. Nevytváří členy, události ani pozvánky, neposílá e-maily a nemění hesla. Neprokazuje SMTP doručení ani připravenost všech čtyř testerů.
