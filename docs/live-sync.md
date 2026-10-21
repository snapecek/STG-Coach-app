# Živé obnovení klubových dat

Klient otevře jeden Supabase Realtime kanál pro aktivní klub. Publikuje se pouze tabulka `club_live_changes` obsahující identifikátor klubu a čítače změn, nikoliv účastníci, adresy, pozvánky či zprávy. SELECT je omezen RLS na aktivní členství; klient tabulku nesmí měnit. Změny více řádků v jedné transakci zvýší čítač jednou. Klient slučuje signály v intervalu 500 ms a načítá data původními RPC/REST cestami s kontrolou oprávnění.

Pro aktivaci použijte migraci `supabase/migrations/202610210049_club_live_sync.sql` po předchozích migracích. Přidá tabulku do publikace `supabase_realtime`. Aplikace ověřuje dostupnost funkcí sama. Bez migrace nebo bez živého spojení pokračuje kontrolami po 30 sekundách; není nutné nasazení klienta a migrace provést ve stejném okamžiku.

Při připojeném kanálu proběhne pojistné obnovení po 10 minutách. Návrat z pozadí, opětovné připojení a návrat do okna obnoví data ihned. V pozadí a offline se nenačítá. Čekající změna se uplatní po uzavření rozepsaného formuláře; stará odpověď serveru nepřepíše novější lokální zápis. Po chybě čtení se požadavek zopakuje po 30 sekundách. Chat a některá malá upozornění si ponechávají vlastní rychlou kontrolu.

Ověření bez produkčních zápisů: `npm test`, `npm run build`, `python3 scripts/check-database.py` a scénáře `STG_LIVE_SYNC_ONLY`, `STG_AUTO_REFRESH_ONLY`, `STG_CALENDAR_ICONS_ONLY`, `STG_COLORS_ONLY` v `scripts/check-member-ui.cjs`. Test živého kanálu používá náhradu transportu a skutečné načítací cesty s fiktivními daty; SQL test ověřuje skutečné triggery, slučování transakce, publikaci a RLS. Ověření skutečného WebSocket doručení v produkčním Supabase vyžaduje nasazenou migraci a dvě přihlášená zařízení.
