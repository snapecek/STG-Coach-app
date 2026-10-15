# Chat a podněty k aplikaci

## Jednorázové nasazení

V Supabase SQL Editoru spusťte celý obsah [migrace 024](../supabase/migrations/202610150024_chat_feedback.sql). Navazuje na migrace 001–023; ty znovu nespouštějte. Migrace je transakční a nemění existující události, členy, účast ani přihlášení. Vytvoří zprávy, osobní značky přečtení, podněty, chráněné RPC a soukromý bucket `app-feedback` pro obrázky. Není potřeba zapínat Realtime ani zadávat nové klíče do webu.

Pokud migrace ještě není nahraná, chat a podněty zobrazí vysvětlení s číslem 024. Původní části aplikace fungují dál. Poté stačí otevřenou část obnovit tlačítkem „Načíst znovu“.

## Umístění a chování

- **Chat** v navigaci trenéra i člena nabízí společný klubový chat a přepínač konverzací jednotlivých událostí. Na velmi úzkém telefonu lze spodní navigaci posouvat vodorovně, aby tlačítka zůstala dostatečně velká.
- V detailu události má trenér záložku **Chat**, člen rozbalovací tlačítko **Chat události**. Historie je společná s konverzací téže události v hlavním chatu.
- Zprávy jsou prostý text do 2 000 znaků, s autorem a časem. Uživatel může po potvrzení smazat vlastní zprávu. Načítá se posledních 50 zpráv, starší přes tlačítko. Nové zprávy se obnovují po 10 sekundách, počty nepřečtených po 15 sekundách i po lokální akci. Při skryté kartě se periodické dotazy pozastaví; návrat do karty provede obnovu. Nejde o push notifikace do telefonu.
- Přečtení se ukládá na serveru samostatně pro účet, klub a konverzaci, jen po skutečně načtené zprávy při zobrazení konce konverzace. Vlastní zprávy nejsou započtené mezi nepřečtené.
- **Můj účet → Podněty k aplikaci** nabízí kategorii Chyba / Nefunkčnost / Návrh na doplnění, název, popis a volitelný obrázek PNG/JPEG/WebP do 5 MB. Autor vidí své podněty a odpověď trenéra. Trenér/správce vidí podněty svého klubu, mění stav Nové / Řeší se / Hotovo a připojuje odpověď. Seznam ukazuje posledních 100 dostupných podnětů a filtr podle stavu. Obrázek lze později přidat nebo nahradit.
- Podněty se ukládají uvnitř aplikace pro klubové vyřízení; automaticky se neposílají e-mailem ani na GitHub.

## Přístup a ochrana dat

Chat je společný pro trenéry a členy, soukromý členský chat tato verze nezavádí. Člen musí mít aktivní propojený členský záznam; trenér/správce platnou klubovou roli. U otevřených událostí včetně závodů není k domluvě nutná potvrzená účast. Skupinové události s omezenou soupiskou mají chat pouze pro tuto soupisku a trenéry klubu. Oprávnění vynucuje server také při přímém RPC volání, v historii a v počtech nepřečtených.

Tabulky mají RLS a klient nemá přímá práva k tabulkám ani sekvenci. RPC nepřijímají identitu autora od klienta. Obrázky jsou soukromé, číst je může jen autor podnětu a trenér/správce téhož klubu; zapisovat jen autor. Pro zobrazení se vydává dočasný podepsaný odkaz na 10 minut. Bez přístupu ke klubu nelze získat nový odkaz; již vydaný odkaz může platit do expirace. Upload není součástí databázové transakce: při selhání obrázku zůstane text podnětu uložen a aplikace nabídne pozdější přidání.

Server omezuje odesílání na 30 zpráv za minutu a 10 podnětů za hodinu na účet. Smazání události odstraní její konverzaci a značky přečtení přes cizí klíče. Chat ani podnět nemění dokončení události, výsledky či docházku.

## Ověření

- `npm test` – validace textů, obrázků a chybových stavů.
- `npm run build` – TypeScript a produkční sestavení.
- `npm run test:database` – všechny migrace a regrese v izolované databázi; test `communication.sql` ověřuje oddělení klubů, omezené události, aktivní členství, vlastní mazání, osobní přečtení, podněty, stav a obrázková oprávnění.
- `STG_COMMUNICATION_ONLY=1 npm run test:member-ui` – proti testovacímu Vite s fiktivní konfigurací ověřuje chat trenéra/člena, historii, mazání, reload, prostý text, podnět s obrázkem, vyřízení a 320/390/1440px. Zahrnuje chybějící migraci a návrat do původního přehledu.
- `npm run test:member-ui` – původní průchody včetně účasti, docházky a deníku.
