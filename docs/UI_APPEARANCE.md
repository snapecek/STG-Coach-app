# Vzhled Trenomi

Technický vizuální systém používá téměř černý základ (#090C0A) a ostrou limetkovou (#C8F031), jemné linky, hranaté panely, výrazné nadpisy a neproporcionální popisky a metriky. Rozhraní podporuje světlý i tmavý režim.

`src/technical-ui.css` a `src/precision-ui.css` sjednocují vzhled hlavních obrazovek, členského prostoru, dialogů, příspěvků a ovládání Studia. Rozložení plovoucích panelů, bezpečné okraje iPhonu a vlastnictví rolování zůstávají v `style.css`. Skryté přímé potomky `.cloud-card` nesmí vizuální styly znovu zobrazovat: přidaly by další řádek mobilního gridu.

## Barevné motivy

Trenér vybírá v Nastavení → Vzhled aplikace z osmi motivů: Trenomi, Ledová, Máta, Sportovní modrá, Levandule, Korálová, Růžová a Limetka. Výchozí je Limetka. Značková oranžová je volitelný motiv Trenomi.

Volba `ui_palette` s revizí `ui_palette_revision: 2` se ukládá do jeho vlastních Supabase Auth metadat přes existující ověřovaný `useExperience.save`. Není potřeba SQL migrace. Tmavý/světlý režim nadále používá dosavadní nastavení zařízení. Neznámá hodnota motivu se převede na výchozí; metadata nemohou zadat libovolné CSS.

Motiv mění akcent rozhraní, nikoli logo, barvy disciplín, významy docházky ani obsah exportovaných obrázků. Studio nadále používá vlastní volbu barvy grafiky.

## Ověření

- `npm test` a `npm run build`.
- `STG_TECHNICAL_UI_ONLY=1 node scripts/check-member-ui.cjs` s běžícím Vite a fiktivním backendem: hlavní obrazovky, nepřekrývající se panely, osm motivů, zachování po obnovení, světlý/tmavý režim, hledání/filtrování/úprava/mazání šablon bez změny událostí.
- `npm run test:release-ui` zahrnuje tento scénář i pro WebKit a stávající funkční regrese. Testy neposílají skutečné e-maily a nezapisují produkční docházku.

Písma Chakra Petch (400/500/600/700) a JetBrains Mono (variabilní) se načítají z místních WOFF souborů s licencemi OFL v public/fonts. Starší zkušební volby bez revize 2 přejdou jednou na nový limetkový základ; další vědomý výběr motivu se již zachová.

Vyplněné akcentové záložky a hlavní tlačítka používají tmavý text `--on-accent`; akcentový text patří na obrysové nebo jemně tónované ovládání. Neaktivní hlavní akce mají neutrální povrch bez snížení opacity popisku. Scénář `STG_BUTTON_CONTRAST_ONLY=1` měří vykreslený kontrast alespoň 4,5 : 1 napříč osmi motivy, oběma režimy a hlavními obrazovkami, detailními záložkami tréninků/závodů i členskými odpověďmi; ověřuje také nepřítomnost ruční e-mailové připomínky.

`unified-ui.css` určuje společnou typografickou škálu: Chakra Petch pro ovládání a text, JetBrains Mono pro technické popisky a data. Nadpisy a ovládání jsou v kapitálkách pomocí CSS; uložený text, jména a zprávy se nepřepisují. Hlavní nadpis má 32/26 px, nadpis sekce 24/20 px a podnadpis 18/16 px (PC/mobil). Malé navigační popisky mají samostatnou kompaktní škálu. Hranaté rámečky jsou společné pravidlo včetně dialogů; SVG sportovní symboly a exportované canvas obrázky se tím nemění.

`WorkspaceHeader` zarovnává tři nabídky k jejich skutečnému tlačítku: levá část displeje od levého okraje doprava, pravá od pravého doleva. Výsledek se omezí na vizuální viewport a prostor nad mobilní navigací. Přepočet běží po otevření, změně obsahu, rozměrů a načtení fontu. Vodoznaky nejsou součástí nasazeného vzhledu, dokud uživatel nevybere návrh.
