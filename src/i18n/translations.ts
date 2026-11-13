export type Language = 'en' | 'cs';

export interface TranslationPack {
  gameTitle: string;
  gameSubtitle: string;
  startRun: string;
  continueRun: string;
  newRun: string;
  controlsHint: string;
  turnLabel: string;
  hpLabel: string;
  shieldLabel: string;
  overdriveLabel: string;
  overdriveButton: string;
  damageBoostLabel: string;
  creditsLabel: string;
  capacityLabel: string;
  attackName: string;
  defenseName: string;
  techName: string;
  resolveAction: string;
  heldTag: string;
  newTag: string;
  atkShort: string;
  defShort: string;
  healShort: string;
  dmgBoostShort: string;
  innateLabel: string;
  surgeLabel: string;
  surgeAttackEffect: string;
  surgeDefenseEffect: string;
  surgeTechEffect: string;
  drawPoolLabel: string;
  discardPoolLabel: string;
  poolTotalLabel: string;
  nextDrawLabel: string;
  boardHint: string;
  previewTitle: string;
  previewNoTiles: string;
  previewStayCount: string;
  previewDamage: string;
  previewCleave: string;
  previewPierce: string;
  previewShield: string;
  previewDamageBoostAdded: string;
  previewHeal: string;
  previewOverdrive: string;
  previewSurgeTriggered: string;
  enemyIntentAttack: string;
  enemyIntentAcid: string;
  enemyIntentArmor: string;
  enemyIntentLeech: string;
  enemyIntentHeavy: string;
  armorLabel: string;
  corrodeLabel: string;
  lethalLabel: string;
  armorBreakLabel: string;
  implantsTitle: string;
  noImplants: string;
  implantSlotsLabel: string;
  inspectPool: string;
  loadoutButton: string;
  poolModalTitle: string;
  poolModalDesc: string;
  equippedGearTitle: string;
  cargoStashTitle: string;
  noCargoStash: string;
  noEquippedGear: string;
  equipAction: string;
  unequipAction: string;
  capacityFullWarning: string;
  combatSwapLocked: string;
  sizeLabel: string;
  closeLabel: string;
  pause: string;
  pauseTitle: string;
  resume: string;
  restart: string;
  returnTitle: string;
  mute: string;
  unmute: string;
  languageName: string;
  victoryTitle: string;
  victorySubtitle: string;
  defeatTitle: string;
  defeatSubtitle: string;
  combatVictory: string;
  combatLootPrompt: string;
  claimEquipment: string;
  salvageForCredits: string;
  continueToMap: string;
  playAgain: string;
  tryAgain: string;
  scoreLabel: string;
  bestScoreLabel: string;
  sectorsClearedLabel: string;
  enemiesDefeatedLabel: string;
  turnsLabel: string;
  damageDealtLabel: string;
  sectorMapTitle: string;
  sectorMapSubtitle: string;
  layerLabel: string;
  nodeCleared: string;
  nodeAvailable: string;
  nodeLocked: string;
  enterNode: string;
  mapAdvisorTitle: string;
  mapRecommendedBadge: string;
  mapDownstreamBadge: string;
  mapLaneNorth: string;
  mapLaneSouth: string;
  mapAdviceLowHp: string;
  mapAdviceElite: string;
  mapAdviceClinic: string;
  mapAdviceBoss: string;
  mapAdviceCombat: string;
  mapRewardImplant: string;
  mapRewardElite: string;
  mapRewardMedbay: string;
  mapRewardCombat: string;
  mapRewardBoss: string;
  mapLoadoutStatus: string;
  mapOpensNext: string;
  clinicTitle: string;
  clinicSubtitle: string;
  clinicSelectPrompt: string;
  clinicReplacePrompt: string;
  clinicShopTitle: string;
  clinicShopEmpty: string;
  buyEquipment: string;
  notEnoughCredits: string;
  installImplant: string;
  replaceSlot: string;
  skipClinic: string;
  rarityCommon: string;
  rarityRare: string;
  medbayTitle: string;
  medbaySubtitle: string;
  medbayHealTitle: string;
  medbayHealDesc: string;
  medbayCalibrateTitle: string;
  medbayCalibrateDesc: string;
  medbaySalvageTitle: string;
  medbaySalvageDesc: string;
  applyRepair: string;
  applyCalibrate: string;
  applySalvage: string;
  enemies: {
    stalker: { name: string };
    spitter: { name: string };
    brute: { name: string };
    boss: { name: string };
  };
  implants: Record<string, { name: string; desc: string }>;
  equipment: Record<string, { name: string; desc: string }>;
  nodes: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    MED_BAY: string;
    BOSS: string;
  };
  nodeDescs: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    MED_BAY: string;
    BOSS: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationPack> = {
  en: {
    gameTitle: 'NEON BREACH',
    gameSubtitle: 'Resolve 1 tile type per turn · Combine gear & TECH boosts · Purge the sky-bridge',
    startRun: 'Start Run',
    continueRun: 'Continue Run',
    newRun: 'New Run',
    controlsHint: '1/2/3 Select Type · Space Overdrive · P Pause · M Mute · L Language',
    turnLabel: 'Turn',
    hpLabel: 'HP',
    shieldLabel: 'Shield',
    overdriveLabel: 'Overdrive',
    overdriveButton: 'Plasma Overdrive',
    damageBoostLabel: 'DMG Boost',
    creditsLabel: 'CR',
    capacityLabel: 'Load',
    attackName: 'Attack',
    defenseName: 'Defense',
    techName: 'TECH',
    resolveAction: 'Resolve',
    heldTag: 'HELD',
    newTag: 'DRAWN',
    atkShort: 'ATK',
    defShort: 'DEF',
    healShort: 'HEAL',
    dmgBoostShort: 'DMG',
    innateLabel: 'Innate Core',
    surgeLabel: 'STACK SURGE',
    surgeAttackEffect: 'Armor Break + 50% Cleave',
    surgeDefenseEffect: 'Reflect 6 DMG on Block',
    surgeTechEffect: '+15% Overdrive & +6 Shield',
    drawPoolLabel: 'Draw',
    discardPoolLabel: 'Cycle',
    poolTotalLabel: 'Active Pool',
    nextDrawLabel: 'Upcoming Draws',
    boardHint: 'Activate 1 type per turn. Unresolved tiles stay held on board and refill to 6.',
    previewTitle: 'Turn Outcome Preview',
    previewNoTiles: 'No tiles of this type on board.',
    previewStayCount: 'held next turn',
    previewDamage: 'DMG front target',
    previewCleave: 'DMG cleave',
    previewPierce: '30% Armor Pierce',
    previewShield: 'Shield gained',
    previewDamageBoostAdded: 'DMG Boost (-10%/round)',
    previewHeal: 'HP restored',
    previewOverdrive: 'Overdrive',
    previewSurgeTriggered: 'Stack Surge Active',
    enemyIntentAttack: 'Strike',
    enemyIntentAcid: 'Acid Spit',
    enemyIntentArmor: 'Chitin Harden',
    enemyIntentLeech: 'Bio-Leech',
    enemyIntentHeavy: 'Apex Rend',
    armorLabel: 'Armor',
    corrodeLabel: 'Corrode',
    lethalLabel: 'LETHAL',
    armorBreakLabel: 'Armor Break',
    implantsTitle: 'Cybernetic Implants',
    noImplants: 'No implants installed',
    implantSlotsLabel: 'Implants',
    inspectPool: 'Loadout & Pool',
    loadoutButton: 'Gear',
    poolModalTitle: 'Loadout & Active Tile Pool',
    poolModalDesc: 'Kira combines her 5 innate tiles with equipped gear up to 15 capacity.',
    equippedGearTitle: 'Equipped Gear',
    cargoStashTitle: 'Cargo Stash',
    noCargoStash: 'No unequipped gear in cargo.',
    noEquippedGear: 'No gear equipped (using innate tiles only).',
    equipAction: 'Equip',
    unequipAction: 'Unequip',
    capacityFullWarning: 'Not enough carry capacity',
    combatSwapLocked: 'Equipment cannot be swapped during active combat.',
    sizeLabel: 'Size',
    closeLabel: 'Close',
    pause: 'Pause',
    pauseTitle: 'Mission Paused',
    resume: 'Resume',
    restart: 'Restart Run',
    returnTitle: 'Title Screen',
    mute: 'Mute',
    unmute: 'Unmute',
    languageName: 'EN',
    victoryTitle: 'Sector Purged',
    victorySubtitle: 'The Xenomorph Matriarch has fallen and the Neo-Prague sky-bridge is secure.',
    defeatTitle: 'Signal Lost',
    defeatSubtitle: 'KIRA-09 sustained critical bio-trauma in the conservatory breach.',
    combatVictory: 'Mutants Neutralized',
    combatLootPrompt: 'Claim 1 Salvaged Equipment Item (or Scrap for +15 CR):',
    claimEquipment: 'Claim Gear',
    salvageForCredits: 'Scrap for +15 CR',
    continueToMap: 'Open Sector Map',
    playAgain: 'Play Again',
    tryAgain: 'Try Again',
    scoreLabel: 'Score',
    bestScoreLabel: 'Best Score',
    sectorsClearedLabel: 'Sectors Cleared',
    enemiesDefeatedLabel: 'Mutants Purged',
    turnsLabel: 'Turns',
    damageDealtLabel: 'Damage Dealt',
    sectorMapTitle: 'Sector Route Map',
    sectorMapSubtitle: 'Select your next sky-bridge branch or adjust Kira’s gear loadout before deployment.',
    layerLabel: 'Sector',
    nodeCleared: 'Cleared',
    nodeAvailable: 'Available',
    nodeLocked: 'Locked',
    enterNode: 'Deploy',
    mapAdvisorTitle: 'Tactical Route Advisor',
    mapRecommendedBadge: 'OPT-VECTOR',
    mapDownstreamBadge: 'DOWNSTREAM',
    mapLaneNorth: 'North Canopy · High-Tech',
    mapLaneSouth: 'South Catwalk · Sustain',
    mapAdviceLowHp: 'Hull integrity below threshold — route toward Bio-Med Bay for +22 HP repair.',
    mapAdviceElite: 'Vitals optimal — engage Elite Abomination for high score, gear loot & Cyber-Clinic.',
    mapAdviceClinic: 'Cyber-Clinic ahead — install a passive implant and buy new equipment.',
    mapAdviceBoss: 'Outer bridge spans secured — converge on the Hive Matriarch in Sector 5.',
    mapAdviceCombat: 'Clear patrol skirmish to earn Credits, loot gear, and open central routes.',
    mapRewardImplant: 'Implants & Gear Shop',
    mapRewardElite: 'Loot + Cyber-Clinic',
    mapRewardMedbay: '+22 HP / +10 Max / CR',
    mapRewardCombat: '+CR & Gear Loot',
    mapRewardBoss: 'Sector Liberation',
    mapLoadoutStatus: 'Loadout',
    mapOpensNext: 'Unlocks Next Sector',
    clinicTitle: 'Cyber-Clinic',
    clinicSubtitle: 'Purchase combat equipment with Credits and install 1 neural implant into KIRA-09.',
    clinicSelectPrompt: 'Available Cybernetic Implants (Pick 1 to leave Clinic)',
    clinicReplacePrompt: 'All 4 implant sockets are occupied. Choose a socket to replace:',
    clinicShopTitle: 'Equipment Requisition',
    clinicShopEmpty: 'All clinic stock acquired.',
    buyEquipment: 'Buy',
    notEnoughCredits: 'Need CR',
    installImplant: 'Install Module',
    replaceSlot: 'Replace Socket',
    skipClinic: 'Leave Clinic',
    rarityCommon: 'Standard',
    rarityRare: 'Prototype',
    medbayTitle: 'Bio-Med Bay',
    medbaySubtitle: 'Stabilize vitals, reinforce Kira’s chassis, or salvage spare parts.',
    medbayHealTitle: 'Nano-Bio Repair',
    medbayHealDesc: 'Restore +22 HP to KIRA-09 immediately.',
    medbayCalibrateTitle: 'Chassis Reinforcement',
    medbayCalibrateDesc: 'Permanently increase Max HP by +10 and heal +10 HP.',
    medbaySalvageTitle: 'Resource Salvage',
    medbaySalvageDesc: 'Extract +35 Credits for Cyber-Clinic equipment purchases.',
    applyRepair: 'Restore +22 HP',
    applyCalibrate: '+10 Max HP',
    applySalvage: 'Collect +35 CR',
    enemies: {
      stalker: { name: 'Chitin Stalker' },
      spitter: { name: 'Bile Spitter' },
      brute: { name: 'Carapace Brute' },
      boss: { name: 'Xenomorph Matriarch' },
    },
    implants: {
      monowire_edge: {
        name: 'Mono-Wire Edge',
        desc: 'Held Attack tiles gain +2 base DMG for staying from a previous round.',
      },
      aegis_capacitor: {
        name: 'Aegis Capacitor',
        desc: 'Retain 50% of unused Shield at the start of your next turn.',
      },
      synapse_overclock: {
        name: 'Synapse Overclock',
        desc: 'Resolving TECH tiles also grants +3 Shield per tile resolved.',
      },
      kinetic_reflector: {
        name: 'Kinetic Reflector',
        desc: 'Whenever you block an attack, deal 3 DMG back to the attacker.',
      },
      plasma_amp: {
        name: 'Plasma Amplifier',
        desc: 'All Attack tiles deal +2 base DMG.',
      },
      nano_weave: {
        name: 'Nano-Weave Plating',
        desc: 'All Defense tiles grant +2 base Shield.',
      },
      surge_resonator: {
        name: 'Surge Resonator',
        desc: 'Stack Surge activates at 3+ matching tiles instead of 4+.',
      },
      bio_siphon: {
        name: 'Bio-Siphon Core',
        desc: 'Heal 4 HP whenever you defeat a mutant.',
      },
      flux_injector: {
        name: 'Flux Injector',
        desc: 'Gain +10 extra Overdrive whenever you resolve TECH tiles.',
      },
      piercing_katana: {
        name: 'Phase-Blade Emitter',
        desc: '30% of Attack damage pierces directly through enemy Armor.',
      },
    },
    equipment: {
      pistole_aretta: {
        name: 'Aretta Pistol',
        desc: 'Reliable sidearm with two solid strikes and a quick tactical guard.',
      },
      minilekarnicka: {
        name: 'Mini Medkit',
        desc: 'Compact field injector providing steady mid-combat healing.',
      },
      karabin_vx: {
        name: 'VX Assault Carbine',
        desc: 'Sustained-fire kinetic carbine built for aggressive multi-hit turns.',
      },
      takticky_stit: {
        name: 'Ballistic Buckler',
        desc: 'Reinforced composite shield plating for high-mitigation rounds.',
      },
      stim_injektor: {
        name: 'Bio-Stim Injector',
        desc: 'Emergency restorative kit paired with light defensive coverage.',
      },
      takticky_zesilovac: {
        name: 'Overclock Amp',
        desc: 'Adds another +51% Damage Booster TECH module plus a backup strike.',
      },
      tezka_brokovnice: {
        name: 'Breacher Shotgun',
        desc: 'Heavy close-quarters scattergun with high burst damage.',
      },
    },
    nodes: {
      COMBAT: 'Mutant Skirmish',
      ELITE: 'Elite Abomination',
      CYBER_CLINIC: 'Cyber-Clinic',
      MED_BAY: 'Bio-Med Bay',
      BOSS: 'Hive Matriarch',
    },
    nodeDescs: {
      COMBAT: 'Clear bio-mutant patrol · Rewards Credits & Equipment.',
      ELITE: 'High-threat armored encounter · Rewards Gear Loot & Cyber-Clinic.',
      CYBER_CLINIC: 'Buy Equipment with Credits & draft 1 of 3 Implants.',
      MED_BAY: 'Repair HP, boost Max HP, or salvage Credits.',
      BOSS: 'Final confrontation with the Sector Hive Queen.',
    },
  },
  cs: {
    gameTitle: 'NEON BREACH',
    gameSubtitle: 'Aktivuj 1 typ dlaždic za tah · Skládej výbavu a TECH efekty · Očisti nebeský most',
    startRun: 'Spustit misi',
    continueRun: 'Pokračovat v misi',
    newRun: 'Nová mise',
    controlsHint: '1/2/3 Vyber typ · Mezerník Overdrive · P Pauza · M Zvuk · L Jazyk',
    turnLabel: 'Tah',
    hpLabel: 'Zdraví',
    shieldLabel: 'Štít',
    overdriveLabel: 'Overdrive',
    overdriveButton: 'Plazmový Overdrive',
    damageBoostLabel: 'Boost DMG',
    creditsLabel: 'CR',
    capacityLabel: 'Nosnost',
    attackName: 'Útok',
    defenseName: 'Obrana',
    techName: 'TECH',
    resolveAction: 'Aktivovat',
    heldTag: 'DRŽENO',
    newTag: 'NOVÝ',
    atkShort: 'ATK',
    defShort: 'DEF',
    healShort: 'LÉČENÍ',
    dmgBoostShort: 'DMG',
    innateLabel: 'Vrozené jádro',
    surgeLabel: 'PŘETÍŽENÍ',
    surgeAttackEffect: 'Průraz brnění + 50% rozmach',
    surgeDefenseEffect: 'Odraz 6 DMG při bloku',
    surgeTechEffect: '+15 % Overdrive a +6 Štít',
    drawPoolLabel: 'Zásobník',
    discardPoolLabel: 'Cyklus',
    poolTotalLabel: 'Aktivní pool',
    nextDrawLabel: 'Příští dlaždice',
    boardHint: 'Aktivuj 1 typ za tah. Zbylé dlaždice držíš na desce a dobereš do 6.',
    previewTitle: 'Náhled výsledku tahu',
    previewNoTiles: 'Na desce není žádná dlaždice tohoto typu.',
    previewStayCount: 'zůstane příští tah',
    previewDamage: 'DMG přednímu cíli',
    previewCleave: 'DMG rozmach',
    previewPierce: '30% průraz brněním',
    previewShield: 'Získaný štít',
    previewDamageBoostAdded: 'Damage booster (-10 %/kolo)',
    previewHeal: 'Vyléčené zdraví',
    previewOverdrive: 'Overdrive',
    previewSurgeTriggered: 'Bonus přetížení aktivní',
    enemyIntentAttack: 'Seknutí',
    enemyIntentAcid: 'Žíravý plivanec',
    enemyIntentArmor: 'Tvrzení krunýře',
    enemyIntentLeech: 'Bio-vysátí',
    enemyIntentHeavy: 'Smrtící drápy',
    armorLabel: 'Brnění',
    corrodeLabel: 'Koroze',
    lethalLabel: 'SMRT',
    armorBreakLabel: 'Průraz brnění',
    implantsTitle: 'Kybernetické implantáty',
    noImplants: 'Žádné implantáty',
    implantSlotsLabel: 'Implantáty',
    inspectPool: 'Výbava a Pool',
    loadoutButton: 'Výbava',
    poolModalTitle: 'Výbava a aktivní pool dlaždic',
    poolModalDesc: 'Kira kombinuje svých 5 vrozených dlaždic s nasazeným vybavením do nosnosti 15.',
    equippedGearTitle: 'Nasazené vybavení',
    cargoStashTitle: 'Batoh / Zásoba',
    noCargoStash: 'V zásobě není žádné nenasazené vybavení.',
    noEquippedGear: 'Žádné nasazené vybavení (pouze vrozené dlaždice).',
    equipAction: 'Nasadit',
    unequipAction: 'Sundat',
    capacityFullWarning: 'Překročena nosnost',
    combatSwapLocked: 'Během boje nelze vybavení měnit.',
    sizeLabel: 'Velikost',
    closeLabel: 'Zavřít',
    pause: 'Pauza',
    pauseTitle: 'Mise pozastavena',
    resume: 'Pokračovat',
    restart: 'Restartovat misi',
    returnTitle: 'Hlavní obrazovka',
    mute: 'Ztlumit',
    unmute: 'Zapnout zvuk',
    languageName: 'CS',
    victoryTitle: 'Sektor vyčištěn',
    victorySubtitle: 'Xenomorfní Matriarcha padla a nebeský most Nové Prahy je zabezpečen.',
    defeatTitle: 'Signál ztracen',
    defeatSubtitle: 'KIRA-09 utrpěla kritické poškození při průlomu v konzervatoři.',
    combatVictory: 'Mutanti zneškodněni',
    combatLootPrompt: 'Vyber si 1 kus vybavení z kořisti (nebo sešrotuj za +15 CR):',
    claimEquipment: 'Vzít výbavu',
    salvageForCredits: 'Sešrotovat (+15 CR)',
    continueToMap: 'Otevřít mapu sektoru',
    playAgain: 'Hrát znovu',
    tryAgain: 'Zkusit znovu',
    scoreLabel: 'Skóre',
    bestScoreLabel: 'Nejlepší skóre',
    sectorsClearedLabel: 'Vyčištěné sektory',
    enemiesDefeatedLabel: 'Zneškodněno mutantů',
    turnsLabel: 'Tahy',
    damageDealtLabel: 'Udělené poškození',
    sectorMapTitle: 'Mapa trasy sektoru',
    sectorMapSubtitle: 'Vyber další větev mostu nebo si před bojem uprav výbavu.',
    layerLabel: 'Úsek',
    nodeCleared: 'Vyčištěno',
    nodeAvailable: 'Dostupné',
    nodeLocked: 'Uzamčeno',
    enterNode: 'Vstoupit',
    mapAdvisorTitle: 'Taktický poradce trasy',
    mapRecommendedBadge: 'DOPORUČENO',
    mapDownstreamBadge: 'NAVAZUJE',
    mapLaneNorth: 'Severní klenba · Hi-Tech',
    mapLaneSouth: 'Jižní lávka · Podpora',
    mapAdviceLowHp: 'Zdraví pod limitem — zvol trasu k Bio-ošetřovně pro opravu +22 Zdraví.',
    mapAdviceElite: 'Zdraví optimální — zaútoč na Elitní zrůdu pro kořist + Kyber-kliniku.',
    mapAdviceClinic: 'Blízko je Kyber-klinika — kup nové vybavení a nainstaluj implantát.',
    mapAdviceBoss: 'Vnější úseky mostu zajištěny — zaútoč na Královnu úlu v 5. úseku.',
    mapAdviceCombat: 'Vyčisti hlídku mutantů pro zisk kreditů a nového vybavení.',
    mapRewardImplant: 'Implantáty a obchod',
    mapRewardElite: 'Kořist + Kyber-klinika',
    mapRewardMedbay: '+22 HP / +10 Max / CR',
    mapRewardCombat: '+CR a kořist výbavy',
    mapRewardBoss: 'Osvobození sektoru',
    mapLoadoutStatus: 'Výbava',
    mapOpensNext: 'Otevírá v dalším úseku',
    clinicTitle: 'Kyber-klinika',
    clinicSubtitle: 'Nakup vybavení za kredity a vyber 1 z 3 bojových implantátů pro KIRA-09.',
    clinicSelectPrompt: 'Dostupné kybernetické implantáty (výběrem opustíš kliniku)',
    clinicReplacePrompt: 'Všechny 4 sloty jsou plné. Vyber slot k nahrazení:',
    clinicShopTitle: 'Obchod s vybavením',
    clinicShopEmpty: 'Veškeré zboží kliniky vykoupeno.',
    buyEquipment: 'Koupit',
    notEnoughCredits: 'Málo CR',
    installImplant: 'Instalovat modul',
    replaceSlot: 'Nahradit slot',
    skipClinic: 'Opustit kliniku',
    rarityCommon: 'Standardní',
    rarityRare: 'Prototyp',
    medbayTitle: 'Bio-ošetřovna',
    medbaySubtitle: 'Stabilizuj systémy, posil tělo nebo získej kredity na výbavu.',
    medbayHealTitle: 'Nano-bio oprava',
    medbayHealDesc: 'Okamžitě obnov +22 Zdraví pro KIRA-09.',
    medbayCalibrateTitle: 'Zpevnění schránky',
    medbayCalibrateDesc: 'Trvale zvyš max. Zdraví o +10 a vyléčí +10 Zdraví.',
    medbaySalvageTitle: 'Recyklace součástek',
    medbaySalvageDesc: 'Získej +35 Kreditů na nákup výbavy v Kyber-klinice.',
    applyRepair: 'Obnovit +22 Zdraví',
    applyCalibrate: '+10 Max Zdraví',
    applySalvage: 'Získat +35 CR',
    enemies: {
      stalker: { name: 'Chitinový slídič' },
      spitter: { name: 'Žlučový plivač' },
      brute: { name: 'Krunýřový kolos' },
      boss: { name: 'Xenomorfní Matriarcha' },
    },
    implants: {
      monowire_edge: {
        name: 'Monovláknové ostří',
        desc: 'Držené dlaždice Útoku z minulého kola dávají +2 základní DMG.',
      },
      aegis_capacitor: {
        name: 'Kondenzátor Aegis',
        desc: 'Přenese 50 % nespotřebovaného štítu do dalšího tahu.',
      },
      synapse_overclock: {
        name: 'Synaptické přetaktování',
        desc: 'Každá aktivovaná dlaždice TECH přidá také +3 ke štítu.',
      },
      kinetic_reflector: {
        name: 'Kinetický reflektor',
        desc: 'Při zablokování útoku vrátí útočníkovi 3 DMG.',
      },
      plasma_amp: {
        name: 'Plazmový zesilovač',
        desc: 'Všechny dlaždice Útoku udělují +2 základní DMG.',
      },
      nano_weave: {
        name: 'Nanovláknová zbroj',
        desc: 'Všechny dlaždice Obrany přidávají +2 základní štít.',
      },
      surge_resonator: {
        name: 'Rezonátor přetížení',
        desc: 'Bonus přetížení se spustí už při 3+ dlaždicích místo 4+.',
      },
      bio_siphon: {
        name: 'Bio-sifonové jádro',
        desc: 'Vyléčí 4 Zdraví pokaždé, když zabiješ mutanta.',
      },
      flux_injector: {
        name: 'Fluxový injektor',
        desc: 'Přidá +10 Overdrive navíc při aktivaci dlaždic TECH.',
      },
      piercing_katana: {
        name: 'Fázový emitor čepele',
        desc: '30 % poškození Útoku projde přímo skrz brnění nepřítele.',
      },
    },
    equipment: {
      pistole_aretta: {
        name: 'Pistole Aretta',
        desc: 'Spolehlivá příruční zbraň se dvěma silnými výstřely a rychlým krytem.',
      },
      minilekarnicka: {
        name: 'Minilékarnička',
        desc: 'Kompaktní polní lékarnička pro rychlé léčení během boje.',
      },
      karabin_vx: {
        name: 'Karabina VX',
        desc: 'Útočná karabina navržená pro vysoké poškození v jednom tahu.',
      },
      takticky_stit: {
        name: 'Taktický štít',
        desc: 'Zesílené kompozitní pláty pro spolehlivou obranu.',
      },
      stim_injektor: {
        name: 'Bio-stim injektor',
        desc: 'Nouzový regenerační modul kombinovaný s lehkým krytem.',
      },
      takticky_zesilovac: {
        name: 'Taktický zesilovač',
        desc: 'Přidá další TECH modul +51% Damage booster a záložní útok.',
      },
      tezka_brokovnice: {
        name: 'Průlomová brokovnice',
        desc: 'Těžká zbraň na blízkou vzdálenost s vysokým nárazovým poškozením.',
      },
    },
    nodes: {
      COMBAT: 'Střet s mutanty',
      ELITE: 'Elitní zrůda',
      CYBER_CLINIC: 'Kyber-klinika',
      MED_BAY: 'Bio-ošetřovna',
      BOSS: 'Královna úlu',
    },
    nodeDescs: {
      COMBAT: 'Vyčisti hlídku mutantů · Odměna kredity a vybavení.',
      ELITE: 'Nebezpečný obrněný střet · Odměna kořist a Kyber-klinika.',
      CYBER_CLINIC: 'Kup nové vybavení a vyber 1 ze 3 implantátů.',
      MED_BAY: 'Oprav zdraví, posil max. HP nebo získej kredity.',
      BOSS: 'Závěrečný střet s Královnou úlu.',
    },
  },
};
