# Správa opakovaných tréninků

V Supabase → SQL Editor jednou spusťte celý obsah [202610130011_training_series.sql](../supabase/migrations/202610130011_training_series.sql). Migrace 001–010 už neopakujte.

Nové opakované tréninky pro celý klub i skupinu jsou propojené jako série. Jednorázové tréninky a závody sérii nemají. Existující události se nespojují podle názvu ani podobnosti; jejich historii zachováváme.

V detailu termínu → Informace otevřete **Spravovat sérii**. Zvolte přesun/změnu času, zrušení nebo obnovení. Náhled vypíše pouze budoucí plánované termíny (při obnově pouze budoucí zrušené). Nové datum označuje datum prvního dotčeného termínu; ostatní se posunou o stejný počet kalendářních dnů. Čas se nastaví pro všechny dotčené termíny v Europe/Prague. Týdenní rozestupy i individuální výjimky zůstanou relativně zachované.

Zkontrolujte náhled a zaškrtněte jeho potvrzení. Chybný/neexistující čas při přechodu DST je odmítnutý před uložením. Databáze navíc odmítá přesun do minulosti, cizí klub/roli, jinou soupisku série a zastaralý náhled. Celá změna je transakční: při konfliktu se neuloží žádná část; obnovte data a zkontrolujte nový náhled.

Proběhlé, již zahájené a dokončené události se hromadně nemění. Soupisky, RSVP, docházka, poznámky a fotografie zůstávají zachované. Termíny organizačních úkolů se neposouvají automaticky; po přesunu je zkontrolujte. E-mailová/push upozornění se neposílají. Jednotlivý termín lze nadále upravit samostatně.
