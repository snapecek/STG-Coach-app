# Záložky události a automatická obnova

Detail události má oddělený obsah pro trenéra i člena:

- **Informace**: plán/pokyny, parametry a mapa s navigací, u člena i fotografie proběhlého tréninku.
- **Účast**: odpovědi, rezervace/soupiska a skutečná docházka; u člena také vlastní odpověď a přidání hosta. Mapa, chat, plán ani závěrečné vyhodnocení se zde neopakují.
- **Chat**: zprávy a psaní zpráv pouze v této záložce.
- **Úkoly**, **Minihry**, **Deník/Výsledky**: vlastní obsah podle oprávnění. Člen vidí Úkoly, pouze pokud mu u události nějaké patří.

Hlavička se jménem a termínem zůstává společná, aby byl při přepínání zachovaný kontext. Potvrzení dokončení je v Informacích a Deníku/Výsledcích, nikoli pod účastí nebo chatem.

## Načítání změn

Bez nových migrací se každých **10 sekund** načítají hlavní data aktivního klubu (události a jejich vyhodnocení, odpovědi/docházka, členové, tréninkové šablony, skupiny, úkoly a stav členských pozvánek). Členovi se obnovuje jeho profil, účast a soupiska otevřené/nejbližší události. Samostatně se po 10 sekundách obnovují přihlášky, další šablony, dostupné kluby, klubové jméno/logo, chat a počty zpráv, zmínky a aktivita ostatních klubů. Podepsaný odkaz stejného loga se přitom nevytváří při každém dotazu znovu.

Nejde o obnovení stránky ani nové nasazování aplikace: zůstává otevřená aktuální stránka a záložka, výběr i rozepsané texty. V editoru události a během ukládání se obnova hlavních dat pozastaví. Rozepsaný záznam v deníku se rovněž chrání proti nahrazení změnou z jiného zařízení. Probíhající odpověď na účast zneplatní dřívější požadavek, aby starší výsledek nevrátil novou odpověď zpět.

Současně může běžet jen jeden automatický požadavek daného odběru. Ve skryté kartě nebo bez připojení se dotazy pozastaví; po návratu a obnovení připojení se obnoví ihned. Při chybě zůstávají poslední načtená data a další pokus přijde automaticky. Ruční Obnovit data zůstává dostupné. Samostatné editory médií/výsledků nadále zachovávají svou rozpracovanou podobu; automatická obnova hlavních dat neznamená stahování všech fotografií znovu každých deset sekund.

## Ověření

- `npm run build`, `npm test`: časování 10 s, nepřekrývání požadavků, vyřazení odpovědi před místním zápisem, ochrana formuláře, obnova po chybě a po návratu/připojení, odpojení starého klubu.
- `STG_AUTO_REFRESH_ONLY=1 npm run test:member-ui` s fiktivním Vite/Supabase: změna odpovědi z jiného zařízení u trenéra i člena, nová událost, otevřený detail a záložka bez resetu, rozepsaný editor i deník, oddělení obsahu a šířky 320/390/1440.
- `STG_COMPACT_EVENT_ONLY=1 npm run test:member-ui`: jednotlivé záložky člena, čtení/odeslání zprávy, úkoly pouze tam, kde existují, kompaktní účast a světlý/tmavý režim na 320/390/760/1440.
- `STG_EVENT_MAP_ONLY=1 npm run test:member-ui`: mapa a navigace pouze v Informacích, uložená místa, šablony, tvorba a úprava mapy a členské zobrazení.
