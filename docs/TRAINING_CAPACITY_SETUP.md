# Kapacita tréninků a čekací listina

V Supabase → SQL Editor spusťte jednou celý obsah [202610130007_training_capacity.sql](../supabase/migrations/202610130007_training_capacity.sql). Předchozí migrace neopakujte. Soubor je SQL; nevkládejte jeho název ani příkazy terminálu.

- Prázdná kapacita znamená bez omezení, jinak 1–500 míst.
- „Jdu“ je zájem o účast. Při plné kapacitě získá člen stav „Čekací listina“.
- Po změně odpovědi na Nejdu/Možná, odstranění přihlášení nebo archivaci člena se první čekající automaticky posune. Opakované Jdu pořadí nemění; odhlášení a opětovné přihlášení zařadí na konec.
- Trenér může kapacitu zvýšit nebo limit odstranit. Snížení pod již potvrzená místa se odmítne. Po zahájení kapacitu nelze měnit.
- Odpověď ani přesun z čekací listiny nepotvrzuje skutečnou docházku. Trenér ji zaznamenává samostatně, včetně případné účasti čekajícího.
- Závody používají soupisku, výsledky a externí registraci; toto není rezervace startovního čísla u pořadatele.
- Přesuny zatím neposílají e-mail/push. Aktuální stav se zobrazí při obnovení dat. Odesílání členských pozvánek vyžaduje samostatné nasazení v MEMBER_ACCESS_SETUP.md.

Po migraci vytvořte fiktivní budoucí trénink s jedním místem. U dvou členů nastavte Jdu; druhý čeká. Prvnímu nastavte Nejdu; druhý dostane místo. Obnovte data nebo otevřete členský prostor a ověřte stav. Nedoplňujte skutečné členské údaje do veřejného dema.
