# Tréninkové skupiny

1. V Supabase → SQL Editor jednou spusťte celý obsah [202610130009_training_groups.sql](../supabase/migrations/202610130009_training_groups.sql). Migrace 001–008 již byly aplikované; neopakujte je. Nevkládejte název souboru ani příkazy terminálu.
2. Po nasazení otevřete nabídku **Skupiny** (na mobilu tlačítko menu vedle nadpisu), zvolte **Přidat skupinu** a vyberte členy i hosty.
3. Při vytváření tréninku zvolte **Účastníci tréninku → název skupiny**. Lze současně vybrat šablonu, kapacitu a opakování. Server vytvoří celou sérii i soupisky v jedné transakci.
4. V detailu → Účast se zobrazí pouze účastníci daného termínu. Trenér zde může jednotlivce výslovně přidat nebo odebrat. Změny členů skupiny naplánované události nepřepíšou.

Název i členové skupiny se uloží jako snímek k události. Přejmenování nebo archivace skupiny zachová naplánované a historické tréninky, jejich docházku, deník a fotografie. Prázdnou skupinu lze uložit, ale nelze pro ni naplánovat trénink. Archivovanou skupinu je nutné nejprve obnovit. Archivovaní/expirující členové se do nových soupisek nezařadí.

Člen čte pouze klubové tréninky a události, na jejichž soupisce je; registr skupin a jiné členy nečte. Nezíská přístup pouhou znalostí UUID jiné skupiny/události. Přístup ke skupinám mají trenér a správce s oprávněním k příslušnému klubu. Dosavadní celoklubové tréninky zachovávají původní docházku. Závody nadále používají vlastní soupisku a výsledky.

Automatické e-mailové/push upozornění na změny skupin není součástí této etapy. Nastavení odesílání členských pozvánek je samostatně v [MEMBER_ACCESS_SETUP.md](MEMBER_ACCESS_SETUP.md). Používejte fiktivní údaje pro ověřování.
