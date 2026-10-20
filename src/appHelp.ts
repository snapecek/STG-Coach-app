export type HelpRole='member'|'coach';
export type HelpTopic={id:string;title:string;summary:string;items:string[];note?:string};

const account:HelpTopic={id:'account',title:'Účet, kluby a nastavení',summary:'Můj účet otevře nastavení, nápovědu, změnu hesla a odhlášení.',items:[
 'Ikona dresu přepíná mezi vašimi kluby. Před změnou účasti nebo zápisem si zkontrolujte název a logo aktuálního klubu.',
 'V Nastavení zvolíte primární klub, který se otevře při příštím vstupu, a světlý nebo tmavý motiv. Najdete zde i přihlášku do dalšího klubu.',
 'Zapamatovat přihlášení na přihlašovací obrazovce ponechá účet přihlášený i po zavření aplikace. Na sdíleném zařízení tuto volbu nepoužívejte a po práci se odhlaste.',
 'Pro obnovu hesla použijte Zapomenuté heslo a otevřete nejnovější e-mail. Pokud pozvánka hlásí vypršení, požádejte trenéra o nové zaslání.',
]};
const messages:HelpTopic={id:'chat',title:'Chat, zmínky a upozornění',summary:'Hlavní chat odděluje konverzace členů s trenéry, chat události je společný.',items:[
 'Ikona chatu nahoře otevírá konverzace. Číslo zvýrazňuje nepřečtené zprávy; u události sledujte i číslo u záložky Chat.',
 'V hlavním chatu komunikuje člen s trenéry; ostatní členové tuto konverzaci nevidí. Trenér nejprve vybere konkrétního člena. Pro zprávu všem účastníkům akce použijte její záložku Chat.',
 'Pro označení osoby napište @ a vyberte ji z nabídky. Zmínka se objeví v jejích upozorněních pod zvonečkem.',
 'Starší události najdete v archivu konverzací. Číslo u dresu upozorňuje na nepřečtené zprávy nebo změny událostí v dalších klubech.',
],note:'Před odesláním vždy zkontrolujte klub a vybranou konverzaci.'};
const phone:HelpTopic={id:'phone',title:'Mobil, automatické obnovení a potíže',summary:'Trenomi můžete používat z prohlížeče i z ikony na ploše telefonu.',items:[
 'Na mobilu přepínáte hlavní záložky dolním menu. Na PC jsou v horním panelu. Detaily události mají vlastní záložky Informace, Účast a Chat; další závisí na události a vašich právech.',
 'Otevřená aplikace pravidelně kontroluje změny přibližně každých 10 sekund. Po návratu z pozadí chvíli počkejte na načtení; při ztrátě připojení může být přehled starší.',
 'Pokud se uložení nezdaří, přečtěte si chybovou zprávu a změnu zkuste znovu. Neobnovujte stránku, pokud ještě máte neuložený formulář.',
 'Chybu či nápad pošlete přes Můj účet → Nápověda → Podněty k aplikaci. Uveďte, co jste dělali, zařízení a případnou hlášku. Heslo do podnětu nepište.',
]};

export const helpSteps:Record<HelpRole,string[]>={
 member:['Zkontrolujte klub a nejbližší událost v Přehledu.','Otevřete událost a vyplňte, zda přijdete.','Po tréninku najdete zapsaný průběh a fotografie v Deníku.'],
 coach:['Přidejte nebo pozvěte členy v záložce Členové.','Vytvořte událost, doplňte plán a sledujte odpovědi.','Po akci potvrďte skutečnou docházku, vyplňte deník a událost dokončete.'],
};

export const helpTopics:Record<HelpRole,HelpTopic[]>={member:[
 {id:'start',title:'První přihlášení a vstup do klubu',summary:'Pozvánka propojí účet s klubem; přihlášku musí schválit trenér.',items:[
  'Při přijetí osobní e-mailové pozvánky použijte účet se stejným e-mailem, na který přišla, a pozvánku v aplikaci přijměte.',
  'Přes registrační odkaz si vytvořte účet, vyplňte jméno a příjmení a odešlete přihlášku do klubu. Dokud ji trenér neschválí, klubový obsah nemusí být dostupný.',
  'Pokud vás trenér už eviduje jako člena nebo hosta, řekněte mu to, aby vás propojil se správným záznamem a nevznikaly duplicity.',
 ]},
 {id:'events',title:'Přehled, kalendář a účast',summary:'Přehled ukazuje nejbližší akci, kalendář i další termíny.',items:[
  'Otevřete událost. V Informacích najdete čas, místo, plán a případně mapu s tlačítkem pro navigaci.',
  'V Účasti vyberte Přijdu, Možná nebo Nepřijdu. Odpověď lze před začátkem změnit; raději odpovězte včas, i když nepřijdete.',
  'Potvrzené místo a Čekací listina jsou odlišné stavy. Při plné kapacitě vás odpověď Přijdu může zařadit jen mezi čekající; sledujte potvrzení místa.',
  'Účastníci jsou rozděleni podle odpovědi. Bez odpovědi neznamená Nepřijdu. Úkoly určené vám se zobrazí u události a nevyřízené i v Přehledu.',
 ],note:'Odpověď Přijdu není zapsaná docházka. Skutečnou přítomnost po akci potvrzuje trenér.'},
 {id:'races',title:'Závody a doprovod',summary:'U závodů se odpovídá Zúčastním se, Možná, Nezúčastním se nebo Doprovod.',items:[
  'Zkontrolujte organizační pokyny, disciplínu, místo a případný odkaz na pořadatele.',
  'Zúčastním se v Trenomi slouží klubu pro přehled. Nenahrazuje registraci ani zaplacení startovného u pořadatele.',
  'Doprovod vyberte, pokud pojedete s týmem, ale nebudete závodit. Doprovod nepotřebuje závodní výsledek.',
 ]},
 {id:'guests',title:'Vezmu hosta na trénink',summary:'Člověka bez účtu můžete přihlásit přes Vezmu hosta u své odpovědi.',items:[
  'Nejprve potvrďte vlastní účast, potom otevřete Vezmu hosta, vyplňte celé jméno a uložte ho. Pozvat lze nejvýše 5 hostů na jeden trénink. Když host nakonec nepřijde, ve stejném okně jej odstraňte.',
  'U tréninku s omezenou kapacitou zkontrolujte stav hosta i své místo. Přidání hosta samo o sobě nezaručuje volné místo.',
  'Pokud už událost proběhla nebo hosta nejde upravit, požádejte trenéra o doplnění skutečné účasti.',
 ]},
 {id:'journal',title:'Můj deník, fotografie a sdílení',summary:'Deník ukazuje vaši historii a průběh zapsaný trenérem.',items:[
  'Docházku a tréninkové údaje berte jako potvrzené záznamy, nikoli jen vaše předchozí odpovědi. Chybějící či chybnou docházku řešte s trenérem.',
  'U dostupných fotografií otevřete Studio Trenomi tlačítkem Sdílet trénink, zvolte svou fotografii a šablonu. V editoru můžete upravit výřez, grafiku, údaje a samolepky.',
  'Výběr fotografie pro vaše sdílení nemění společnou titulní fotografii v deníku. Tu nastavuje trenér.',
 ],note:'Před zveřejněním zkontrolujte výsledný obrázek i to, zda můžete sdílet zachycené osoby.'},
 {id:'fees',title:'Moje klubové příspěvky',summary:'Ikona příspěvků je viditelná, pokud klub evidenci používá.',items:[
  'Uvidíte vlastní členské příspěvky a platby za jednotlivé tréninky, jejich splatnost a zbývající částku.',
  'Platbu proveďte způsobem domluveným s klubem. Evidence v Trenomi není online platební brána; úhradu zapisuje trenér.',
  'Po splatnosti se může objevit upozornění. Pokud jste již zaplatili, ověřte s trenérem, zda úhradu zaznamenal. Uvnitř příspěvků je i podrobná nápověda.',
 ]},
 messages,
 {id:'notifications',title:'E-mailové připomínky',summary:'Připomínka pomáhá nezapomenout vyplnit účast.',items:[
  'Pokud je odesílání v klubu zprovozněné a nemáte odpověď, může přibližně 24 hodin před akcí přijít e-mail. Jeho odkaz otevře událost; odpověď potvrďte až v aplikaci.',
  'E-mailové připomínky spravujete v Nastavení → Oznámení a e-maily. Zkontrolujte také spam a svůj přihlašovací e-mail.',
 ],note:'Na e-mail nečekejte jako na jediný zdroj informací. Termíny a aktuální účast kontrolujte v aplikaci.'},
 account,phone,
],coach:[
 {id:'overview',title:'Přehled a základní či pokročilé zobrazení',summary:'Přehled shrnuje nejbližší akci, položky k vyřízení a týdenní plán.',items:[
  'Z Přehledu otevřete účast nebo událost, kterou potřebujete vyřídit. Kalendář slouží k plánování, Docházka k hromadné kontrole a Deník k zápisu skutečného průběhu.',
  'V Můj účet → Nastavení přepnete Základní / Pokročilý nad volbou motivu. Pokročilý režim navíc ukáže Analýzu a Šablony.',
  'Přepnutí režimu pouze zjednodušuje nabídku. Již uložené události, šablony ani výsledky nemaže.',
 ]},
 {id:'members',title:'Členové, pozvánky a přihlášky',summary:'Členy můžete zadat sami, pozvat e-mailem nebo sdílet registrační odkaz.',items:[
  'Pokud člena znáte, přidejte jeho záznam a pošlete osobní pozvánku e-mailem. U záznamu sledujte stav a datum odeslání.',
  'Pokud neznáte jméno nebo e-mail, použijte registrační pozvánku či odkaz pro sdílení. Zájemce vyplní údaje sám a vy poté schválíte jeho přihlášku.',
  'Nevyřízenou pozvánku lze zaslat znovu nebo odebrat. Než vytvoříte nový záznam, ověřte, že člověk už není v evidenci jako člen nebo host.',
  'Host bez účtu zůstává v evidenci a lze ho později vybrat znovu. Odebrání z klubu nezaměňujte s odebráním ze soupisky jedné události.',
 ]},
 {id:'events',title:'Vytvoření události, místa a opakování',summary:'Nová událost založí trénink nebo závod; hotovou můžete upravit či zkopírovat.',items:[
  'Doplňte název, datum, čas, typ, délku, místo a plán. U typu lze zvolit společnou klubovou barvu pro orientaci v přehledu a kalendáři.',
  'K místu můžete přidat mapu, označit bod a šipkou ukázat přístup. Uložte často používané místo pro příště; člen pak může otevřít navigaci.',
  'U opakované série vždy zkontrolujte, kterých termínů se změna týká. U skupinového tréninku ověřte správnou skupinu a soupisku.',
  'Závod lze založit i bez účastníků. Členové se přidají odpovědí později; Zúčastním se nenahrazuje registraci u pořadatele. Doprovod evidujte odděleně.',
 ],note:'Zrušit událost ponechá záznam jako zrušený. Smazat událost odstraňuje její záznamy; před potvrzením si přečtěte upozornění.'},
 {id:'attendance',title:'Odpovědi členů a skutečná docházka',summary:'Přihlášení říká, co člen plánuje. Docházka potvrzuje, co se skutečně stalo.',items:[
  'V záložce Účast jsou nejprve potvrzení účastníci, dále ostatní odpovědi a nakonec lidé bez odpovědi. Doprovod a čekací listina mají vlastní skupinu.',
  'Po akci ověřte seznam tlačítky A (ano), O (omluvil se), N (ne). Přijdu se předvyplní jako A, ostatní odpovědi a lidé bez odpovědi jako N. Omluvení vyberte ručně pomocí O.',
  'Opravte jen rozdíly a zvolte Uložit docházku. Pokud seznam souhlasí, použijte Schválit docházku bez úprav: ověří se celý seznam najednou. Samotné přepnutí A/O/N nic neukládá; dříve ověřené záznamy zůstávají zachované.',
  'V hromadné Docházce přepínejte Tréninky / Závody a použijte období, skupinu či hledání. Členové a hosté mají vlastní oddíly; na mobilu se tabulka posouvá vodorovně.',
  'U uplynulého tréninku můžete přidat nového hosta nebo vybrat uloženého. Zkontrolujte jeho docházku a nezakládejte stejného člověka opakovaně.',
 ],note:'Čekací listina není potvrzené místo. Omluvení se do procenta skutečné účasti nepočítají.'},
 {id:'journal',title:'Deník, výsledky a dokončení události',summary:'Po akci doplňte skutečný průběh a poté událost dokončete.',items:[
  'V Deníku otevřete záznam, vyplňte průběh a skutečné údaje, například délku, vzdálenost a zátěž RPE. Před dokončením ověřte docházku všech uvedených lidí.',
  'U závodu doplňte výsledky závodníků, případně týmů. Doprovod výsledek nepotřebuje, ale jeho skutečná účast má být vyplněná.',
  'Minihru lze přidat i dodatečně, pokud původně nebyla v plánu. Vyberte účastníky, jednotlivce či týmy a zapište výsledek.',
  'Dokončit událost je závěrečná kontrola. Pokud tlačítko není dostupné, ověřte skončení události, průběh, docházku a u závodu požadované výsledky. Pozdější změna může událost znovu otevřít ke kontrole.',
 ],note:'Uplynutí času samo nepotvrzuje vyplněný deník. V Analýze kontrolujte období, filtry a to, zda nechybí skutečně zapsané hodnoty.'},
 {id:'photos',title:'Fotografie, hlavní fotka a sdílení',summary:'Hlavní fotografie patří společnému deníku, fotku pro sdílení si každý vybírá sám.',items:[
  'U fotografií v deníku označte hlavní fotku pro společné zobrazení tréninku. Tato volba nemění osobní výběr pro sdílení.',
  'Studio Trenomi (Sdílet trénink) vedle Upravit otevře samostatný editor. Zvolte fotku, formát a očíslovanou šablonu; upravte výřez, otočení, údaje, samolepky a případné logo.',
  'Na mobilu fotografii posouvejte prstem a přibližujte dvěma prsty. Na PC použijte ovládání editoru. Před exportem zkontrolujte čitelnost a to, zda grafika nezakrývá důležité části fotografie.',
 ]},
 {id:'templates',title:'Šablony, pomůcky a Analýza',summary:'Šablony šetří opakované zadávání, Analýza vyhodnocuje zapsané údaje.',items:[
  'V pokročilém režimu najdete Šablony pro tréninky, závody, pomůcky a minihry. U závodu si připravte například OCR Sprint, Super, Beast či Ultra a později změňte místo nebo název.',
  'Šablonu vyberte při vytváření události. Může obsahovat i uloženou mapu; před uložením vždy ověřte datum, místo a další proměnlivé údaje.',
  'Změna šablony nepřepisuje již vytvořené události. Ty upravte samostatně nebo přes správu série.',
  'V Analýze zvolte období, události, typ a člena. Týdenní objem a cíle patří celému klubu a aktuálnímu týdnu; filtry pod nimi ovlivňují následující statistiky.',
 ]},
 {id:'fees',title:'Klubové příspěvky a platby',summary:'Správce zapne evidenci, trenéři zadávají předpisy a potvrzují přijaté úhrady.',items:[
  'Po zapnutí v Nastavení otevřete ikonu příspěvků mezi dresy a chatem. Rozlišujte členské příspěvky a platby za jednotlivé tréninky.',
  'Pro členství založte sazbu a předpisy. U měsíční sazby lze nastavit automatické měsíční vytváření; ověřte zahrnuté členy, začátek a den splatnosti.',
  'Po přijetí peněz zapište úhradu ke správnému předpisu. Člen vidí vlastní dluh a splatnost; aplikace platbu sama neprovede ani automaticky nepozná převod.',
  'Chybné předpisy lze vybrat zaškrtávátky a hromadně smazat. Před potvrzením zkontrolujte vybrané položky; podrobnosti najdete v Nápovědě vedle Sazeb.',
 ]},
 messages,
 {id:'notifications',title:'Upozornění a připomínání účasti',summary:'Zvoneček ukazuje upozornění v aplikaci, mobilní oznámení se povolují zvlášť.',items:[
  'V Nastavení → Mobilní oznámení povolte na daném zařízení upozornění na odpovědi členů. Obsahují jméno, odpověď a počet přihlášených.',
  'Na iPhonu je pro tato oznámení potřeba podporovaný iOS a aplikace přidaná na plochu. Povolte oznámení také v systému; Nerušit či úspora energie mohou doručení ovlivnit.',
  'Je-li odesílání zprovozněné, členům bez odpovědi se přibližně 24 hodin před akcí posílá e-mailová připomínka. Stav odesílání ověřte v Nastavení → Oznámení a e-maily.',
  'Ruční Připomenout e-mailem použijte jen tehdy, pokud je funkce dostupná. Neaktivní tlačítko znamená, že tato možnost zatím není zapnutá.',
 ]},
 {id:'admin',title:'Správa klubu a oprávnění',summary:'Trenér spravuje sportovní provoz, hlavní správce navíc nastavení klubu a trenéry.',items:[
  'Hlavní správce mění název a logo klubu, přidává či odebírá trenérská práva a může založit další klub. Pokud tyto volby nevidíte, obraťte se na hlavního správce.',
  'Před archivací klubu pečlivě ověřte název a nabídku zálohy. Obnova archivovaného klubu je dostupná po dobu 3 měsíců.',
  'Klubovou zálohu uchovávejte bezpečně. Nezaměňujte archivaci celého klubu se zrušením jedné akce nebo odebráním člena.',
 ]},
 account,phone,
]};

export function findHelpTopics(role:HelpRole,query:string){
 const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs');
 const words=normalize(query.trim()).split(/\s+/).filter(Boolean);
 return helpTopics[role].filter(topic=>words.every(word=>normalize([topic.title,topic.summary,...topic.items,topic.note||''].join(' ')).includes(word)));
}
