import type { CodexTranslationPack } from './types';

export const CS_CODEX_TRANSLATIONS: CodexTranslationPack = {
  codexButtonLabel: 'Kodex',
  codexTitle: 'Taktický kodex a složka hrdinky',
  codexSubtitle:
    'Přehled pasivních schopností hrdinek, Overdrive protokolů, bojových mechanik a pravidel mutantů.',
  tabHeroes: 'Hrdinky a schopnosti',
  tabGlossary: 'Herní slovník',
  heroSelectorAria: 'Vyber složku hrdinky',
  vitalsHeader: 'Profil hrdinky a paměť čipů',
  baseStatsLabels: {
    hp: 'Max zdraví',
    credits: 'Startovní CR',
    capacity: 'Paměť (RAM)',
    startingPool: 'Hlavní zásobník',
  },
  passivePowersHeader: 'Pasivní schopnosti a modifikátory',
  overdriveHeader: 'Speciální Overdrive (100 % OD)',
  freeActionBadge: 'Volná akce · Neukončí tah',
  innateCoreHeader: 'Vrozené jádro (Trvalé dílky)',
  innateCoreDesc: 'Zůstává v hlavním zásobníku dílků bez ohledu na nainstalované AI čipy dovedností.',
  startingGearHeader: 'Startovní AI čipy dovedností',
  synergiesHeader: 'Doporučené kyber-implantáty z Kyber-kliniky',
  tacticalLoopHeader: 'Základní bojový rytmus',
  inspectHeroDossierBtn: 'Schopnosti a Kodex',
  viewGlossaryBtn: 'Slovník',
  openTermHint: 'Zobrazit pojem ve slovníku',
  searchPlaceholder: 'Hledej pojem (např. brnění, koroze, přetížení, pip, overdrive...)',
  noSearchResults: 'Žádný odpovídající pojem nebyl nalezen.',
  clearSearch: 'Zrušit filtr',
  categories: {
    all: 'Všechny pojmy',
    defense: 'Obrana a Brnění',
    offense: 'Útok a Poškození',
    board: 'Deska a Overdrive',
    status: 'Stavy a pravidla mutantů',
  },
  mechanicsLabel: 'Jak to funguje',
  tacticalTipLabel: 'Taktický tip',
  heroes: {
    kira: {
      roleTag: 'TECH-Přetížení · Nárazové kombo',
      playstyleLead:
        'Rychlá kyber-duelistka zaměřená na držení dílků Útoku a Obrany přes tahy, skládání silného TECH posílení útoku a časté spouštění Plazmového výpadu.',
      passivePowers: [
        {
          name: 'Hybnost držených dílků',
          badge: '+1 ATK / DEF Držené',
          description:
            'Každý dílek Útoku či Obrany ponechaný na desce z minulého tahu (označený DRŽENO) získá tento tah +1 k základní hodnotě. Sčítá se s kyber-implantátem Monovláknové ostří (+2).',
        },
        {
          name: 'Synaptický Overdrive motor',
          badge: '+20 % OD za TECH',
          description:
            'Aktivace dílků TECH dobíjí +20 % Overdrive za každý dílek (oproti +4 % za Útok/Obranu), což umožňuje časté řetězení Overdrive.',
        },
        {
          name: 'Ofenzivní zaměření (0 přenos)',
          badge: '0 přenos · 0 protiúder',
          description:
            'Nepřenáší Štít mezi tahy bez Kondenzátoru Aegis — sází na včasnou likvidaci mutantů nebo silné obranné sady.',
        },
      ],
      overdriveRule:
        'Dostupné při 100 % Overdrive [Mezerník]. Plazmový výpad vynuluje Overdrive na 0 %, okamžitě zasáhne VŠECHNY živé mutanty a nechá tě v tahu, takže hned můžeš aktivovat i barvu dílků.',
      overdriveBreakdown: [
        'Udělí 20 průrazného DMG VŠEM živým mutantům (ignoruje Brnění; pohltí jej jen aktivní Aegis Pip).',
        'Okamžitě přidá +30 % posílení útoku (zesílí útočnou sadu zahranou ještě v témže tahu).',
        'Přidá +6 Štítu na vykrytí příchozích úderů.',
      ],
      synergies:
        'Monovláknové ostří (+2 pro držené Útoky), Rezonátor přetížení (Přetížení už od 3 dílků), Fluxový injektor (+10 % OD navíc za TECH) a Fázový emitor čepele (30 % průraz).',
      tacticalLoop:
        '1. tah: Aktivuj TECH (+42 % posílení útoku a +20 % OD/dílek) a podrž dílky Útoku pro bonus +1. 2. tah: Spusť Plazmový výpad (+30 % DMG) a doraž vlnu posíleným Přetížením Útoku.',
    },
    auraline: {
      roleTag: 'Obrněný kolos · Kotva s Nabitím',
      playstyleLead:
        'Těžká frontová hrdinka se 78 Max HP, 18 body stálého Brnění na startu každého boje a 14 RAM pro AI čipy dovedností. Začíná s 1 Slepým dílkem v každé barvě a každý aktivovaný jí dodá +1 Nabití.',
      passivePowers: [
        {
          name: 'Brnění kolosu',
          badge: '+18 Brnění / boj',
          description:
            'Každý boj začíná s 18 body stálého Brnění pod Štítem (DMG → Štít → Brnění → HP), které neubývá na konci tahu a nepodléhá Korozi.',
        },
        {
          name: 'Přetaktování slepých dílků',
          badge: '+1 Nabití za Slepý',
          description:
            'Začíná se 3 Slepými dílky (1 Útok, 1 Obrana, 1 TECH). Každý aktivovaný Slepý dílek dá +1 Nabití (+1 dílek navíc na desce v příštím tahu), takže rychle točí zásobník bez nutnosti čistky.',
        },
        {
          name: 'Vysoká paměť čipů',
          badge: '78 HP · 14 RAM',
          description:
            'Začíná se 78 Max HP a 14 RAM — bez potíží unese i náročné AI čipy dovedností jako Totální průlom.AI (5 RAM) a Adaptivní krytí.AI (4 RAM) současně.',
        },
      ],
      overdriveRule:
        'Dostupné při 100 % Overdrive [Mezerník]. Královská salva je volná akce, která doplní Brnění a nabije +2 Nabití pro další tah.',
      overdriveBreakdown: [
        'Udělí 20 průrazného DMG VŠEM živým mutantům (ignoruje Brnění).',
        'Přidá +10 stálého Brnění pro dlouhou výdrž v přední linii.',
        'Přidá +2 Nabití (+2 dílky na desku v příštím tahu).',
      ],
      synergies:
        'Plazmový zesilovač a Nanovláknová zbroj (promění nulové Slepé dílky v +2 ATK/+2 DEF), Synaptické přetaktování (+3 Štít za TECH Slepý), Rezonátor přetížení a Smyčka tempa.AI.',
      tacticalLoop:
        'Nech 18 Brnění pohltit úvodní údery, toč Slepé dílky do +1 Nabití, skládej s nimi Přetížení a odpaluj Královskou salvu (+10 Brnění, +2 Nabití) před klíčovými tahy.',
    },
    zuri: {
      roleTag: 'Specialistka na drcení brnění · TECH',
      playstyleLead:
        'Létající hrdinka a velitelka solárního roje zaměřená na plošné Drcení brnění, hybridní taktický štít a nejrychlejší nabíjení Overdrive — bez bonusu za držení a bez Přetížení v 1. tahu.',
      passivePowers: [
        {
          name: 'Solární uplink kondenzátoru',
          badge: '+25 % OD za TECH',
          description:
            'Aktivace dílků TECH dodá +25 % Overdrive za každý dílek — nejrychlejší nabíjení Overdrive ze všech hrdinek.',
        },
        {
          name: 'Vrozené jádro drcení brnění',
          badge: '-8 BRN všem · 3 Průraz',
          description:
            'Zuri nese vrozený TECH dílek, který strhne 8 Brnění VŠEM mutantům a přednímu cíli udělí 3 přímého průrazného DMG.',
        },
        {
          name: 'Hybridní taktický štít',
          badge: '+4 Štít · +24 % DMG',
          description:
            'Druhý jádrový TECH dílek přidá +4 Štítu i +24 % posílení útoku najednou, propojuje obranu s přípravou útoku a nabíjí +25 % OD.',
        },
      ],
      overdriveRule:
        'Dostupné při 100 % Overdrive [Mezerník]. Protokol Solární roj se spouští jako volná akce bez ukončení tahu a rozdrtí mutantům Brnění před následným útokem.',
      overdriveBreakdown: [
        'Strhne -12 Brnění a udělí 16 průrazného DMG VŠEM živým mutantům.',
        'Přidá +8 Štítu na vykrytí následného protiútoku.',
        'Očistí -2 Koroze z tvé hrdinky.',
      ],
      synergies:
        'Synaptické přetaktování (+3 Štít za TECH dílek), Rezonátor přetížení (odemkne 3dílná Přetížení na rozložení 3/3/3), Fluxový injektor (+35 % OD za TECH!) a Lamač pancíře.AI.',
      tacticalLoop:
        'Počítej s rozložením 3/3/3 (žádné Přetížení v 1. tahu bez dalších čipů): toč vrozené TECH dílky pro drcení Brnění a +4 Štít/+24 % DMG, nabíjej +25 % OD a spusť Protokol Solární roj (-12 BRN + 16 Průraz) těsně před Útokem.',
    },
  },
  glossary: {
    armor: {
      term: 'Brnění (BRN / ARM)',
      shortTag: 'Trvalá ochrana',
      summary: 'Trvalá ochrana Auraline a obrněných mutantů pod Štítem, která pohlcuje běžné zásahy před ztrátou Zdraví.',
      mechanics:
        'Běžný Útok a protiúder z Přetížení Obrany nejprve ubírají Brnění 1:1, dokud neklesne na 0; teprve zbytek zasáhne Zdraví. Brnění zůstává mezi tahy. Volitelné Kvantizované měřítko zobrazuje Zdraví a Brnění v přehledných krocích po 5 bodech.',
      tacticalTip:
        'Brnění mutantů prolomíš Přetížením Útoku (4+ dílky zničí celé přední Brnění), TECH Drcením (-8 nebo -10 BRN všem), Fázovým emitorem čepele (30 % průraz) nebo Overdrivem (100 % průraz).',
      keywords: ['brnění', 'brn', 'armor', 'aegis', 'kvantizované měřítko'],
    },
    shield: {
      term: 'Štít (SHD / DEF)',
      shortTag: 'Dočasná ochrana',
      summary: 'Dočasná jedno-tahová ochrana z dílků Obrany a TECH efektů, která pohlcuje poškození před Brněním a Zdravím.',
      mechanics:
        'Pohlcuje příchozí poškození 1:1 před Brněním a Zdravím. Plné vykrytí kyselinového zásahu (0 ztráty Zdraví) zabrání zablokování dílku na desce. Na konci tahu zbylý Štít klesne na 0 (s Kondenzátorem Aegis se přenese 50 %).',
      tacticalTip:
        'Proti kyselině drž dostatečný Štít — i 1 bod poškození do Zdraví zablokuje dílek na desce.',
      keywords: ['štít', 'obrana', 'shield', 'def', 'přenos'],
    },
    aegis_pip: {
      term: 'Aegis Pip (◆)',
      shortTag: 'Jednorázový náboj',
      summary: 'Samostatný jednorázový bariérový náboj mutanta (1 zásah = 1 prasknutý Pip), který pohltí celé poškození jednoho úderu.',
      mechanics:
        'Dokud má mutant aktivní Aegis Pip (např. Kobaltový běžec, Krunýřový kolos, Xenomorfní Matriarcha), příští jediný zásah — i silný Overdrive nebo Přetížení — pouze praskne 1 Pip a neubere Zdraví ani Brnění.',
      tacticalTip:
        'Neplýtvej obřím Útokem ani Overdrivem do aktivního Pipu. Nejprve ho praskni lehkým Útokem, protiúderem Obrany nebo průrazným TECH pulzem.',
      keywords: ['pip', 'aegis', 'diamant', 'štít', 'kolos', 'běžec'],
    },
    phase_lock: {
      term: '50% Fázová brána',
      shortTag: 'Práh bosse',
      summary: 'Prahová pasivní schopnost Xenomorfní Matriarchy, která při prvním poklesu na 50 % HP zastaví poškození a přidá +10 Brnění a +1 Aegis Pip.',
      mechanics:
        'Jednou za boj se poškození zastaví přesně na 50 % max. Zdraví (55 HP na výchozí obtížnosti). Matriarcha okamžitě získá +10 Brnění a obnoví si 1 Aegis Pip (◆).',
      tacticalTip:
        'Nepřepal všechna posílení do rány, která spustí 50% Fázovou bránu — nech si nástroj na prasknutí nového Pipu a stržení +10 Brnění.',
      keywords: ['fázový', 'zámek', 'brána', 'boss', 'matriarcha', '50%'],
    },
    dmg_boost: {
      term: 'Posílení útoku (+% DMG)',
      shortTag: 'Násobič útoku',
      summary: 'Procentuální bonus, který zvyšuje celkové poškození aktivovaných dílků Útoku.',
      mechanics:
        'Násobí součet základního poškození Útoku jako floor(základ × (1 + Bonus / 100)). Na konci každého tahu klesne o 10 procentních bodů. Nezvyšuje Overdrive, protiúder Obrany ani průrazný TECH zásah.',
      tacticalTip:
        'Nejprve naber posílení přes TECH dílky, podrž Útoky o tah déle a pak udeř naplno dřív, než bonus opadne.',
      keywords: ['boost', 'posílení', 'dmg', 'poškození', 'násobič', 'pokles'],
    },
    armor_pierce: {
      term: 'Průraz brněním (PIERCE)',
      shortTag: 'Zásah přímo do HP',
      summary: 'Poškození, které obchází Brnění mutantů a míří přímo do Zdraví.',
      mechanics:
        'Overdrive, Bio-exploze i průrazné TECH pulzy obcházejí Brnění ze 100 %. Fázový emitor čepele propustí skrz Brnění 30 % poškození každého Útoku. Aktivní Aegis Pip (◆) však stále pohltí celý zásah.',
      tacticalTip:
        'Skvělé proti Krunýřovým kolosům nebo skupinám posíleným Aegis projekcí (+4 Brnění všem).',
      keywords: ['průraz', 'pierce', 'brnění', 'čepel', 'emitor'],
    },
    armor_shred: {
      term: 'Drcení brnění (SHRED)',
      shortTag: 'Plošné odzbrojení',
      summary: 'Efekt dílků TECH, který strhne Brnění VŠEM žijícím mutantům najednou.',
      mechanics:
        'Spouští jej Zuriin vrozený dílek (-8 BRN všem) nebo AI čip Lamač pancíře.AI (-10 BRN všem). Snižuje Brnění každému mutantovi (min. 0) a zároveň přednímu cíli udělí přímé průrazné DMG.',
      tacticalTip:
        'Ideální v 1. tahu proti Kobaltovému běžci a Krunýřovému kolosovi — odhalíš jejich Zdraví pro celou skupinu.',
      keywords: ['drcení', 'stržení', 'shred', 'emp', 'brnění', 'lamač', 'zuri'],
    },
    cleave: {
      term: 'Rozmach (CLEAVE)',
      shortTag: 'Plošný přesah',
      summary: 'Sekundární poškození zadních mutantů při Přetížení Útoku.',
      mechanics:
        'Aktivace Přetížení Útoku zasáhne všechny zbývající živé mutanty za předním cílem za 50 % celkového poškození. Využívá i 30 % průraz z Fázového emitoru čepele.',
      tacticalTip:
        'Rozmach umí zdarma prasknout Aegis Pipy mutantům stojícím v zadních řadách.',
      keywords: ['rozmach', 'cleave', 'plošné', 'přetížení'],
    },
    riposte: {
      term: 'Obranný protiúder a Odraz',
      shortTag: 'Obranný protiúder',
      summary: 'Poškození vrácené mutantovi při Přetížení Obrany nebo vykrytí útoku Štítem.',
      mechanics:
        'Přetížení Obrany udělí 8 protiúderného DMG přímo přednímu mutantovi. Kyber-implantát Kinetický reflektor navíc vrátí 3 DMG útočníkovi pokaždé, když jeho ránu zachytíš Štítem či Brněním.',
      tacticalTip:
        'Protiúder bezpečně dorazí Chitinového slídiče bez spuštění jeho Trnové odplaty.',
      keywords: ['odveta', 'odraz', 'riposte', 'obrana', 'reflektor'],
    },
    tile_pool: {
      term: 'Hlavní zásobník dílků a Paměť',
      shortTag: 'Zásobník a RAM',
      summary: 'Trvalý zásobník vrozených dílků hrdinky doplněný o dílky z aktivních AI čipů dovedností do limitu Paměti (RAM).',
      mechanics:
        'Každý AI čip dovednosti zabírá určitou Paměť (RAM) a přidává 1–3 dílky do Hlavního zásobníku dílků. Mimo boj můžeš čipy instalovat, ukládat do Trezoru čipů či rozebrat v okně Čipy a Pool. V boji leží na desce 6 dílků (až 9 s Nabitím).',
      tacticalTip:
        'Udržuj zásobník štíhlý — uložením slabších čipů do Trezoru čipů zvýšíš šanci na pravidelná 4dílná Přetížení.',
      keywords: ['pool', 'paměť', 'ram', 'čipy', 'trezor', 'zásobník', 'cyklus', 'dlaždice', 'dílky'],
    },
    held_tiles: {
      term: 'Držený dílek (DRŽENO)',
      shortTag: 'Přenos na desce',
      summary: 'Neaktivovaný dílek zůstávající na desce do příštího tahu (DRŽENO), který umožňuje skládání barev a bonus +1 Kiry.',
      mechanics:
        'Za tah aktivuješ jen 1 barvu dílků; zbylé dílky zůstávají na desce (DRŽENO) a prázdná místa se doberou do 6 (NOVÝ). Kira dává drženým dílkům Útoku a Obrany +1; Monovláknové ostří přidává +2 k drženým Útokům.',
      tacticalTip:
        'Podrž si dílky Útoku o 1 tah, zatímco aktivuješ TECH nebo Obranu, a poskládej si silné Přetížení.',
      keywords: ['držené', 'drženo', 'nový', 'held', 'monovlákno', 'dílky', 'dlaždice'],
    },
    stack_surge: {
      term: 'Přetížení (Stack Surge)',
      shortTag: 'Bonus za 4+ dílky',
      summary: 'Bonusový efekt při aktivaci 4+ nezablokovaných dílků stejné barvy v jednom tahu (3+ s Rezonátorem přetížení).',
      mechanics:
        'Přetížení Útoku: Zničí celé Brnění předního cíle + 50 % rozmach všem ostatním + nespustí Trnovou odplatu ani Prasknutí pustul. Přetížení Obrany: Udělí 8 DMG přednímu mutantovi. Přetížení TECH: Přidá +15 % Overdrive a +6 Štítu.',
      tacticalTip:
        'Sleduj pruh Příští dílky, abys věděla, kdy ti další dobírání doplní 4 dílky stejné barvy.',
      keywords: ['přetížení', 'surge', 'rezonátor', 'rozmach', 'dílky', 'dlaždice'],
    },
    overdrive: {
      term: 'Overdrive (OD)',
      shortTag: '0 AP manévr',
      summary: '100% nabitý speciální manévr hrdinky (0 AP, neukončí tah), který udělí plošné průrazné poškození a unikátní efekt.',
      mechanics:
        'Útok a Obrana dávají +4 % OD za dílek. TECH dává +20 % (Kira), +15 % (Auraline) nebo +25 % (Zuri), plus +10 % s Fluxovým injektorem a +15 % při Přetížení TECH. Spuštění Overdrive vynuluje OD, zasáhne VŠECHNY mutanty průrazně, očistí desku od Bloku/Kletby/Strusky a NEUKONČÍ tah.',
      tacticalTip:
        'Spusť Overdrive Kiry (+30 % DMG) nebo Zuri (-12 BRN všem) PŘED aktivací Útoku ve stejném tahu!',
      keywords: ['overdrive', 'od', 'mezerník', 'výpad', 'salva', 'roj'],
    },
    corrode: {
      term: 'Koroze (KOR)',
      shortTag: 'Oslabený štít',
      summary: 'Stav hrdinky, který přímo odečítá získaný Štít při aktivaci Obrany (-1 Štít za stupeň) až do očištění.',
      mechanics:
        'Každý stupeň Koroze odečte 1 Štít z celkového Štítu získaného při aktivaci sady Obrany (minimálně 0). Uděluje ji Prasknutí pustul Žlučového plivače (+2 KOR při přežití běžného Útoku bez Přetížení) i jeho žíravé drápy (+2 KOR). Na konci tahu klesne o 1 a neovlivňuje Štít z TECH ani Overdrive.',
      tacticalTip:
        'Korozi odstraň AI čipem Systémová očista.AI (-2 KOR) či Overdrivem Zuri (-2 KOR) a proti Žlučovému plivači spouštěj Přetížení Útoku.',
      keywords: ['koroze', 'kor', 'kyselina', 'pustuly', 'štít', 'očista'],
    },
    jammed_tile: {
      term: 'Blokovaný dílek (BLOK)',
      shortTag: 'Uzamčení dílku',
      summary: 'Uzamčený stav jednoho dílku na desce po nekrytém kyselinovém zásahu nebo přehřátí v Přesčase, který brání aktivaci na 1 tah.',
      mechanics:
        'Pokud Žlučový plivač nebo Xenomorfní Matriarcha udělí kyselinovým útokem alespoň 1 poškození do Zdraví, 1 dílek na desce se zablokuje. Nelze jej aktivovat ani započítat do Přetížení; odblokuje se po tvé příští akci (nebo ihned při Overdrive).',
      tacticalTip:
        'Vykryj útok Štítem na 100 % — při 0 ztráty Zdraví se žádný dílek nezablokuje a drápy nepřidají +3 Brnění.',
      keywords: ['blokovaný', 'blok', 'jammed', 'plivač', 'kyselina', 'dlaždice', 'dílek'],
    },
    spike_retaliate: {
      term: 'Trnová odplata',
      shortTag: 'Protiúder mutanta',
      summary: 'Pasivní schopnost Chitinového slídiče trestající přežitý běžný Útok bez Přetížení okamžitou odplatou za 3 DMG.',
      mechanics:
        'Kdykoli zasáhneš předního Chitinového slídiče normálním Útokem (pod hranicí Přetížení) a on přežije, ihned ti udělí 3 DMG do Štítu/Brnění/Zdraví. Nespustí se při zabití, Přetížení Útoku, TECH, Přetížení Obrany ani Overdrive.',
      tacticalTip:
        'Sleduj varování ⚠ ODPLATA v náhledu tahu a doraž Chitinového slídiče jednou ranou nebo Přetížením.',
      keywords: ['odplata', 'trnitý', 'slídič', 'krunýř', '3 dmg'],
    },
    volatile_burst: {
      term: 'Bio-exploze',
      shortTag: 'Řetězový výbuch',
      summary: 'Pasivní schopnost Spórového roztoče při smrti, která udělí 6 průrazného DMG všem ostatním živým mutantům (a praská Aegis Pipy).',
      mechanics:
        'Jakmile Spórový roztoč padne, okamžitě způsobí 6 průrazného poškození všem přeživším mutantům na mostě (praská Aegis Pipy, obchází Brnění a může řetězově odpálit další Spórové roztoče).',
      tacticalTip:
        'Zlikviduj předního Spórového roztoče, když za ním stojí silně obrnění mutanti — explozí jim prorazíš Zdraví zadarmo.',
      keywords: ['exploze', 'roztoč', 'řetěz', 'průraz', 'výbuch'],
    },
    thermal_charge: {
      term: 'Žárové nabíjení',
      shortTag: 'Odpočet 3 tahy',
      summary: 'Žárový žahavec se 2 tahy neškodně nabíjí a ve 3. tahu vypálí Těžký výboj za 16 DMG.',
      mechanics:
        'První 2 tahy cyklu neudělují žádné poškození a odpočítávají čas do výboje (2T → 1T). Ve 3. tahu udeří za 16 DMG. Zásah za 16+ DMG v jednom tahu mu Prolomí postoj (Omráčení) a vrátí odpočet na začátek.',
      tacticalTip:
        'Zasaď Žárovému žahavci 16+ DMG za 1 tah pro Omráčení a reset odpočtu, nebo jej prohoď dopředu klávesou [R].',
      keywords: ['nabíjení', 'žahavec', 'žárové', '16 dmg', 'odpočet', 'omráčení'],
    },
    stagger: {
      term: 'Prolomený postoj (Omráčení)',
      shortTag: 'Přerušení 16+ DMG',
      summary: 'Stav Omráčení vyvolaný zásahem za 16+ DMG v jednom tahu proti mutantovi připravujícímu Nabíjení nebo Těžký úder (sníží akci na 0 DMG).',
      mechanics:
        'Pokud Žárový žahavec (nabíjení), Krunýřový kolos (Těžký úder) nebo Xenomorfní Matriarcha (Těžký úder) utrpí 16+ celkového poškození do HP a Brnění v jednom tahu a přežije, má PROLOMENÝ POSTOJ (OMRÁČEN): jeho příští akce klesne na 0 DMG a nabíjení se vrátí na 2T.',
      tacticalTip:
        'Sleduj štítek ⚡ OMRÁČÍ! na kartě mutanta při najetí na silný Útok nebo Overdrive.',
      keywords: ['omráčení', 'stagger', 'postoj', '16', 'kolos', 'žahavec', 'boss'],
    },
    tile_hex: {
      term: 'Kletba dílku (⬡)',
      shortTag: 'Cílená kletba',
      summary: 'Cílená kletba umístěná na silný dílek Útoku či Obrany Žlučovým plivačem nebo Xenomorfní Matriarchou, která při aktivaci léčí a obrňuje sesilatele.',
      mechanics:
        'Od 2. tahu Žlučový plivač a Xenomorfní Matriarcha označí silný dílek Útoku či Obrany značkou ⬡ KLETBA. Pokud tuto barvu aktivuješ, zatímco sesilatel žije, okamžitě se vyléčí +4 HP a získá +3 Brnění. Zabití sesilatele nebo Overdrive Kletbu zruší.',
      tacticalTip:
        'Aktivuj jinou barvu, zabij sesilatele přes Overdrive/Rozmach/Prohoz, nebo jeho léčení přeraz.',
      keywords: ['kletba', 'hex', 'plivač', 'boss', 'léčení', 'overdrive', 'dlaždice', 'dílek'],
    },
    caustic_slag: {
      term: 'Žíravá struska (☣)',
      shortTag: 'Spalitelný odpad',
      summary: 'Spalitelný nulový škodlivý dílek vstříknutý do odkládacího či dobíracího balíčku po nekrytém zásahu kyselinou; při držení na konci tahu pálí za 2 DMG.',
      mechanics:
        'Až 2 kusy Žíravé strusky (barva TECH, hodnota 0) mohou vstoupit do cyklu po nezablokovaném zásahu kyselinou. Každá Struska držená na desce na konci tahu udělí 2 DMG. Aktivace TECH nebo spuštění Overdrive Strusku trvale spálí.',
      tacticalTip:
        'Vykryj kyselinu Štítem, nebo Žíravou strusku bezpečně spal příští sadou TECH či Overdrive.',
      keywords: ['struska', 'blight', 'kyselina', 'spálit', 'tech', 'overdrive'],
    },
  },
};
