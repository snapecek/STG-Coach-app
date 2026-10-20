# Vzhled Trenomi

Technický vizuální systém používá původní tmavý základ a žlutou Trenomi, jemné linky, hranaté panely, výrazné nadpisy a neproporcionální popisky a metriky. Rozhraní podporuje světlý i tmavý režim.

`src/technical-ui.css` sjednocuje vzhled hlavních obrazovek, členského prostoru, dialogů, příspěvků a ovládání Studia. Rozložení plovoucích panelů, bezpečné okraje iPhonu a vlastnictví rolování zůstávají v `style.css`. Skryté přímé potomky `.cloud-card` nesmí vizuální styly znovu zobrazovat: přidaly by další řádek mobilního gridu.

## Barevné motivy

Trenér vybírá v Nastavení → Vzhled aplikace z osmi motivů: Trenomi, Ledová, Máta, Sportovní modrá, Levandule, Korálová, Růžová a Limetka. Výchozí zůstává žlutý Trenomi.

Volba `ui_palette` se ukládá do jeho vlastních Supabase Auth metadat přes existující ověřovaný `useExperience.save`. Není potřeba SQL migrace. Tmavý/světlý režim nadále používá dosavadní nastavení zařízení. Neznámá hodnota motivu se převede na výchozí; metadata nemohou zadat libovolné CSS.

Motiv mění akcent rozhraní, nikoli logo, barvy disciplín, významy docházky ani obsah exportovaných obrázků. Studio nadále používá vlastní volbu barvy grafiky.

## Ověření

- `npm test` a `npm run build`.
- `STG_TECHNICAL_UI_ONLY=1 node scripts/check-member-ui.cjs` s běžícím Vite a fiktivním backendem: hlavní obrazovky, nepřekrývající se panely, osm motivů, zachování po obnovení, světlý/tmavý režim, hledání/filtrování/úprava/mazání šablon bez změny událostí.
- `npm run test:release-ui` zahrnuje tento scénář i pro WebKit a stávající funkční regrese. Testy neposílají skutečné e-maily a nezapisují produkční docházku.
