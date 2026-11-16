import type { CharacterId, EnemyPassiveKind } from '../engine/types';

export type Language = 'en' | 'cs';

export interface TranslationPack {
  gameTitle: string;
  gameSubtitle: string;
  startRun: string;
  continueRun: string;
  newRun: string;
  selectOperativeLabel: string;
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
  jammedTag: string;
  atkShort: string;
  defShort: string;
  healShort: string;
  dmgBoostShort: string;
  shredShort: string;
  odShort: string;
  aegisShort: string;
  allShort: string;
  allTargetsLabel: string;
  pipShort: string;
  pipLabel: string;
  pipCrackLabel: string;
  phaseGateLabel: string;
  bioBurstLabel: string;
  retaliateLabel: string;
  tileJamWarnLabel: string;
  staggeredTag: string;
  staggerPreviewLabel: string;
  enragedAloneTag: string;
  hexTag: string;
  blightTag: string;
  purgeLabel: string;
  condBonusLabel: string;
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
  previewArmorShred: string;
  previewTechPierce: string;
  previewCorrodeCleanse: string;
  previewSurgeTriggered: string;
  enemyIntentAttack: string;
  enemyIntentAcid: string;
  enemyIntentArmor: string;
  enemyIntentBolster: string;
  enemyIntentCharge: string;
  enemyIntentLeech: string;
  enemyIntentHeavy: string;
  armorLabel: string;
  armorShort: string;
  corrodeLabel: string;
  corrodeShort: string;
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
  scrapAction: string;
  capacityFullWarning: string;
  combatSwapLocked: string;
  sizeLabel: string;
  closeLabel: string;
  synchronizingStage: string;
  pause: string;
  pauseTitle: string;
  resume: string;
  restart: string;
  returnTitle: string;
  mute: string;
  unmute: string;
  languageName: string;
  landscapeToggle: string;
  portraitToggle: string;
  fullscreenEnter: string;
  fullscreenExit: string;
  tacticalInfoButton: string;
  passiveLabel: string;
  counterPlayLabel: string;
  overdriveTitleLabel: string;
  surgeRuleLabel: string;
  tapInfoHint: string;
  enemyIntentDescAttack: string;
  enemyIntentDescHeavy: string;
  enemyIntentDescAcid: string;
  enemyIntentDescArmor: string;
  enemyIntentDescBolster: string;
  enemyIntentDescCharge: string;
  enemyIntentDescLeech: string;
  corrodeDesc: string;
  armorDesc: string;
  nextActionLabel: string;
  behaviorCycleLabel: string;
  enemyArmorActiveDesc: string;
  enemyArmorNoneDesc: string;
  enemyShieldPipDesc: string;
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
  heatGaugeLabel: string;
  heatLowLabel: string;
  heatMediumLabel: string;
  heatOvertimeLabel: string;
  parCachesLabel: string;
  parCachePrefix: string;
  tempoLabel: string;
  tempoTip: string;
  inboundDropLabel: string;
  dropZeroDmgRule: string;
  dropReasonThreat: string;
  dropReasonReactive: string;
  dropReasonAdaptive: string;
  dropReasonSos: string;
  dropReasonSweeper: string;
  dropRubberBandDelayed: string;
  enrageBadgeLabel: string;
  sosFlareBadgeLabel: string;
  zeroRewardBadgeLabel: string;
  fastClearBonusLabel: string;
  baseLootLabel: string;
  parBonusLabel: string;
  tempoBonusLabel: string;
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
  restockShop: string;
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
  characters: Record<
    CharacterId,
    {
      code: string;
      name: string;
      title: string;
      weapon: string;
      passive: string;
      overdriveName: string;
      overdriveDesc: string;
      summary: string;
    }
  >;
  enemyPassives: Record<
    EnemyPassiveKind,
    {
      archetype: string;
      name: string;
      rule: string;
      counter: string;
    }
  >;
  enemies: {
    larva: { name: string; classification: string; bioNote: string };
    skitter: { name: string; classification: string; bioNote: string };
    stinger: { name: string; classification: string; bioNote: string };
    stalker: { name: string; classification: string; bioNote: string };
    spitter: { name: string; classification: string; bioNote: string };
    brute: { name: string; classification: string; bioNote: string };
    boss: { name: string; classification: string; bioNote: string };
  };
  implants: Record<string, { name: string; desc: string }>;
  equipment: Record<string, { name: string; desc: string }>;
  nanitesLabel: string;
  nanitesShort: string;
  bountyGoldenBadge: string;
  bountyDoubleBadge: string;
  bountyNaniteBadge: string;
  bountyOverchargedBadge: string;
  bountyFlashSaleBadge: string;
  bountyFundedClinicBadge: string;
  laneArchetypeGauntlet: string;
  laneArchetypeMercenary: string;
  laneArchetypeGambler: string;
  laneGauntletDesc: string;
  laneMercenaryDesc: string;
  laneGamblerDesc: string;
  laneShortPrefix: string;
  mapRiskShort: string;
  mapPathTargetBadge: string;
  mapAnomalyLabel: string;
  mapMultiHopLabel: string;
  mapHpRecoveryLabel: string;
  defibArmedLabel: string;
  defibDischargedLabel: string;
  fundedClinicAllActionsNote: string;
  fundedBonusHpTag: string;
  reconPreviewPrefix: string;
  tensionLabel: string;
  yieldLabel: string;
  oppCostLabel: string;
  greedyClinicNotice: string;
  opportunityCostNotice: string;
  abstinenceBonusLabel: string;
  emergencyDefibTriggered: string;
  reconActiveBadge: string;
  bossTelegraphTitle: string;
  bossTelegraphIntel: string;
  shopAffordable: string;
  shopLowCredits: string;
  medbayOverclockTitle: string;
  medbayOverclockDesc: string;
  medbayExtractTitle: string;
  medbayExtractDesc: string;
  applyOverclock: string;
  applyExtract: string;
  medbayNurseName: string;
  medbayNurseRole: string;
  medbayNurseIdleNominal: string;
  medbayNurseIdleCritical: string;
  medbayNurseHoverHeal: string;
  medbayNurseHoverCalibrate: string;
  medbayNurseHoverSalvage: string;
  medbayNurseHoverOverclock: string;
  medbayNurseHoverExtract: string;
  eventViewTitle: string;
  eventExecuteChoice: string;
  eventCriticalHp: string;
  nodes: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    MED_BAY: string;
    EVENT: string;
    BOSS: string;
  };
  nodeDescs: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    MED_BAY: string;
    EVENT: string;
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
    selectOperativeLabel: 'Select Operative',
    controlsHint: '1/2/3 Select Type · Space Overdrive · F Fullscreen · P Pause · M Mute · L Language',
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
    jammedTag: 'JAMMED',
    atkShort: 'ATK',
    defShort: 'DEF',
    healShort: 'HEAL',
    dmgBoostShort: 'DMG',
    shredShort: 'SHRED',
    odShort: 'OD',
    aegisShort: 'AEGIS',
    allShort: 'ALL',
    allTargetsLabel: 'All Allies',
    pipShort: 'PIP',
    pipLabel: 'Aegis Pip',
    pipCrackLabel: 'CRACKS PIP',
    phaseGateLabel: '50% PHASE LOCK',
    bioBurstLabel: '+6 BIO-BURST ALL',
    retaliateLabel: '3 RETALIATE',
    tileJamWarnLabel: 'JAMS 1 TILE ON HIT',
    staggeredTag: '⚡ STAGGERED',
    staggerPreviewLabel: '⚡ STAGGER!',
    enragedAloneTag: 'ALONE +2',
    hexTag: '⬡ HEX',
    blightTag: '☣ SLAG',
    purgeLabel: 'PURGE',
    condBonusLabel: 'COND',
    innateLabel: 'Innate Core',
    surgeLabel: 'STACK SURGE',
    surgeAttackEffect: 'Armor Break + 50% Cleave',
    surgeDefenseEffect: 'Reflect 8 DMG on Block',
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
    previewArmorShred: 'Armor shred (All)',
    previewTechPierce: 'Pierce DMG front',
    previewCorrodeCleanse: 'Corrode cleansed',
    previewSurgeTriggered: 'Stack Surge Active',
    enemyIntentAttack: 'Strike',
    enemyIntentAcid: 'Acid Spit',
    enemyIntentArmor: 'Chitin Harden',
    enemyIntentBolster: 'Aegis Bolster',
    enemyIntentCharge: 'Thermal Charge',
    enemyIntentLeech: 'Bio-Leech',
    enemyIntentHeavy: 'Apex Rend',
    armorLabel: 'Armor',
    armorShort: 'ARM',
    corrodeLabel: 'Corrode',
    corrodeShort: 'COR',
    lethalLabel: 'LETHAL',
    armorBreakLabel: 'Armor Break',
    implantsTitle: 'Cybernetic Implants',
    noImplants: 'No implants installed',
    implantSlotsLabel: 'Implants',
    inspectPool: 'Loadout & Pool',
    loadoutButton: 'Gear',
    poolModalTitle: 'Loadout & Active Tile Pool',
    poolModalDesc: '{name} combines 5 innate tiles with equipped gear up to {capacity} capacity.',
    equippedGearTitle: 'Equipped Gear',
    cargoStashTitle: 'Cargo Stash',
    noCargoStash: 'No unequipped gear in cargo.',
    noEquippedGear: 'No gear equipped (using innate tiles only).',
    equipAction: 'Equip',
    unequipAction: 'Unequip',
    scrapAction: 'Scrap',
    capacityFullWarning: 'Not enough carry capacity',
    combatSwapLocked: 'Equipment cannot be swapped during active combat.',
    sizeLabel: 'Size',
    closeLabel: 'Close',
    synchronizingStage: 'Synchronizing sky-bridge...',
    pause: 'Pause',
    pauseTitle: 'Mission Paused',
    resume: 'Resume',
    restart: 'Restart Run',
    returnTitle: 'Title Screen',
    mute: 'Mute',
    unmute: 'Unmute',
    languageName: 'EN',
    landscapeToggle: 'Landscape',
    portraitToggle: 'Portrait',
    fullscreenEnter: 'Fullscreen',
    fullscreenExit: 'Exit Fullscreen',
    tacticalInfoButton: 'Info',
    passiveLabel: 'Lock Rule',
    counterPlayLabel: 'Counter-Play',
    overdriveTitleLabel: 'Overdrive',
    surgeRuleLabel: 'Surge',
    tapInfoHint: 'Tap to inspect · Tap again to resolve',
    enemyIntentDescAttack: 'Deals {val} incoming DMG to your Shield, then HP.',
    enemyIntentDescHeavy: 'Heavy apex strike dealing {val} incoming DMG.',
    enemyIntentDescAcid: 'Deals {val} DMG and adds +{sec} Corrode (jams 1 board tile if unblocked by Shield).',
    enemyIntentDescArmor: 'Gains +{val} Armor that absorbs incoming Attack DMG.',
    enemyIntentDescBolster: 'Projects +{val} Armor to ALL living mutants on the sky-bridge.',
    enemyIntentDescCharge: 'Charging thermal core ({sec}T left) → unleashes a {val} DMG detonation when ready.',
    enemyIntentDescLeech: 'Deals {val} DMG and heals itself +{sec} HP if any unblocked HP damage lands.',
    corrodeDesc: 'Reduces Shield gained from Defense tiles.',
    armorDesc: 'Absorbs Attack DMG before enemy HP is reduced.',
    nextActionLabel: 'Next Action',
    behaviorCycleLabel: 'Action Cycle',
    enemyArmorActiveDesc:
      'Blocks up to {armor} regular Attack DMG before HP is hit. Stack Surge shatters all Armor; Phase-Blade pierces 30%.',
    enemyArmorNoneDesc: 'Unarmored — incoming Attack DMG hits HP directly.',
    enemyShieldPipDesc: 'Active Aegis Pip (◆): completely negates the next 1 damaging hit regardless of damage amount.',
    victoryTitle: 'Sector Purged',
    victorySubtitle: 'The Xenomorph Matriarch has fallen and the Neo-Prague sky-bridge is secure.',
    defeatTitle: 'Signal Lost',
    defeatSubtitle: '{name} sustained critical bio-trauma in the conservatory breach.',
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
    heatGaugeLabel: 'HEAT',
    heatLowLabel: 'LOW HEAT',
    heatMediumLabel: 'MED HEAT',
    heatOvertimeLabel: 'OVERTIME',
    parCachesLabel: 'Par Caches',
    parCachePrefix: 'T',
    tempoLabel: 'TEMPO',
    tempoTip: 'Deal damage on consecutive turns for bonus CR (+2 CR/turn, max +8 CR).',
    inboundDropLabel: 'DROP INBOUND',
    dropZeroDmgRule: '0 DMG on arrival turn',
    dropReasonThreat: 'THREAT WAVE',
    dropReasonReactive: 'REACTIVE',
    dropReasonAdaptive: 'ADAPTIVE COUNTER',
    dropReasonSos: 'SOS FLARE',
    dropReasonSweeper: 'OVERTIME SWEEPER',
    dropRubberBandDelayed: 'DELAYED (+1T)',
    enrageBadgeLabel: 'ENRAGE',
    sosFlareBadgeLabel: 'SOS',
    zeroRewardBadgeLabel: '0 CR',
    fastClearBonusLabel: 'Fast Clear Bonus',
    baseLootLabel: 'Base',
    parBonusLabel: 'Par Caches',
    tempoBonusLabel: 'Tempo',
    sectorMapTitle: 'Sector Route Map',
    sectorMapSubtitle: "Select your next sky-bridge branch or adjust {name}'s gear loadout before deployment.",
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
    clinicSubtitle: 'Purchase combat equipment with Credits and install 1 neural implant into {name}.',
    clinicSelectPrompt: 'Available Cybernetic Implants (Pick 1 to leave Clinic)',
    clinicReplacePrompt: 'All 4 implant sockets are occupied. Choose a socket to replace:',
    clinicShopTitle: 'Equipment Requisition',
    clinicShopEmpty: 'All clinic stock acquired.',
    restockShop: 'Restock',
    buyEquipment: 'Buy',
    notEnoughCredits: 'Need CR',
    installImplant: 'Install Module',
    replaceSlot: 'Replace Socket',
    skipClinic: 'Leave Clinic',
    rarityCommon: 'Standard',
    rarityRare: 'Prototype',
    medbayTitle: 'Bio-Med Bay',
    medbaySubtitle: "Stabilize vitals, reinforce {name}'s chassis, or salvage spare parts.",
    medbayHealTitle: 'Nano-Bio Repair',
    medbayHealDesc: 'Restore +22 HP to {name} immediately.',
    medbayCalibrateTitle: 'Chassis Reinforcement',
    medbayCalibrateDesc: 'Permanently increase Max HP by +10 and heal +10 HP.',
    medbaySalvageTitle: 'Resource Salvage',
    medbaySalvageDesc: 'Extract +35 Credits for Cyber-Clinic equipment purchases.',
    medbayOverclockTitle: 'Neural Overclock & Tile Tuning',
    medbayOverclockDesc: 'Permanently upgrade starter strike tiles (+2 ATK), cleanse corrode, and gain +35% Overdrive.',
    medbayExtractTitle: 'Call Tactical Extraction Shuttle',
    medbayExtractDesc: 'Bank 100% of collected Nanites and credits now. Conclude the expedition safely without risking defeat.',
    applyRepair: 'Restore +22 HP',
    applyCalibrate: '+10 Max HP',
    applySalvage: 'Collect +35 CR',
    applyOverclock: 'Overclock Tiles',
    applyExtract: 'Call Shuttle',
    medbayNurseName: 'Dr. Amara Vance',
    medbayNurseRole: 'Chief Bio-Tech Officer',
    medbayNurseIdleNominal: 'Vitals stable — magenta nano-serum is primed for neural overclocking or chassis tuning.',
    medbayNurseIdleCritical: 'Trauma alert! Hold still — I have a high-potency nano-gel syringe ready for immediate infusion.',
    medbayNurseHoverHeal: 'Prepping Nano-Bio syringe: instant +22 HP cellular regeneration.',
    medbayNurseHoverCalibrate: 'Reinforcing sub-dermal weave: +10 permanent Max HP capacity.',
    medbayNurseHoverSalvage: 'Sorting surplus bio-capacitors: +35 CR ready for Clinic requisition.',
    medbayNurseHoverOverclock: 'Injecting synaptic catalyst: +2 ATK on starter strikes, corrode purge & +35% Overdrive.',
    medbayNurseHoverExtract: 'Beacon locked: extraction shuttle will bank 100% of your Nanites and Credits safely.',
    nanitesLabel: 'Nanites',
    nanitesShort: 'NC',
    bountyGoldenBadge: '★ BOUNTY +50% CR',
    bountyDoubleBadge: '2× CREDITS',
    bountyNaniteBadge: '◆ NANITES +2',
    bountyOverchargedBadge: '⚡ OVERCHARGED (+1 NC)',
    bountyFlashSaleBadge: '🏷 FLASH SALE (-35% CR)',
    bountyFundedClinicBadge: '✦ FUNDED (+BONUS REPAIR)',
    laneArchetypeGauntlet: 'THE GAUNTLET',
    laneArchetypeMercenary: 'MERCENARY PATH',
    laneArchetypeGambler: "GAMBLER'S CATWALK",
    laneGauntletDesc: 'High Tension · Elite Bounty · Rest Safety Net',
    laneMercenaryDesc: 'Steady Combat · Maximize Credits · Shop Build',
    laneGamblerDesc: 'Anomalies & Trades · Low Combat Fatigue',
    laneShortPrefix: 'LANE',
    mapRiskShort: 'HP Risk',
    mapPathTargetBadge: 'PATH TARGET',
    mapAnomalyLabel: 'ANOMALY (?)',
    mapMultiHopLabel: 'Multi-Hop Planned Route',
    mapHpRecoveryLabel: 'HP Recovery',
    defibArmedLabel: 'DEFIB: ARMED (+15% HP ≤15%)',
    defibDischargedLabel: 'DEFIB: DISCHARGED',
    fundedClinicAllActionsNote: 'Funded Clinic: +12 HP bonus repair applies automatically to ANY choice below.',
    fundedBonusHpTag: '+12 HP Funded Bonus',
    reconPreviewPrefix: 'RECON',
    tensionLabel: 'Tension',
    yieldLabel: 'Yield',
    oppCostLabel: 'Opportunity Cost',
    greedyClinicNotice: 'GREEDY CLINIC: Full vitals detected! Invest in Neural Tile Overclocking or Nanite Salvage rather than basic repair.',
    opportunityCostNotice: 'OPPORTUNITY COST: Critical damage forces Bio-Repair, sacrificing permanent Tile Overclocking for survival!',
    abstinenceBonusLabel: 'Mercenary Interest (Streak)',
    emergencyDefibTriggered: 'EMERGENCY DEFIBRILLATOR: Vital surge restored +15% HP!',
    reconActiveBadge: 'RECON ACTIVE',
    bossTelegraphTitle: 'SECTOR GATEKEEPER TELEGRAPH',
    bossTelegraphIntel: 'Apex Brood Sovereign · Sector 05 Finale',
    shopAffordable: 'AFFORDABLE',
    shopLowCredits: 'LOW CREDITS',
    eventViewTitle: 'CYBER-GRID ENCOUNTER',
    eventExecuteChoice: 'Execute Decision',
    eventCriticalHp: 'Critical HP',
    characters: {
      kira: {
        code: 'KIRA-09',
        name: 'Kira',
        title: 'Plasma Vanguard',
        weapon: '58 HP · 45 CR · 12 Load · Aretta + Medkit',
        passive: 'Cyber-Momentum: Held +1 ATK/DEF · TECH +20% OD',
        overdriveName: 'Plasma Blitz',
        overdriveDesc: '20 Pierce DMG All · +30% DMG Boost · +6 Shield',
        summary: 'Tech-Surge specialist (3 ATK · 2 DEF · 4 TECH): powers up held tiles & chains rapid Overdrives.',
      },
      aurelia: {
        code: 'AURELIA-07',
        name: 'Aurelia',
        title: 'Royal Cyber-Musketeer',
        weapon: '66 HP · 40 CR · 14 Load · Twin-Barrel + Diadem',
        passive: 'Royal Aegis: Keep 5 Shield/turn · DEF +2 Riposte DMG',
        overdriveName: 'Sovereign Broadside',
        overdriveDesc: '24 Pierce DMG All · +12 Shield · -2 Corrode',
        summary: 'Armored vanguard (4 ATK · 3 DEF · 2 TECH): point-blank Attack Surges & counter-striking shields.',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Solar Swarm Commander',
        weapon: '62 HP · 50 CR · 13 Load · Falcon Gunship + Ankh Array',
        passive: 'Swarm Uplink: Held +1 · Keep 3 Shield · TECH +25% OD',
        overdriveName: 'Solar Swarm Protocol',
        overdriveDesc: '22 Pierce DMG All · +9 Shield · +25% DMG · -2 Corrode',
        summary: 'Airborne drone commander (3 ATK · 3 DEF · 3 TECH): hovers on jet-thrusters while directing 3 combat drones.',
      },
    },
    enemyPassives: {
      volatile_burst: {
        archetype: 'The Chaff · Volatile Fodder',
        name: 'Bio-Rupture',
        rule: 'On death, explodes for 6 Pierce DMG to all surviving enemy mutants.',
        counter: 'Eliminate while armoured allies stand behind it to chain-shred their HP.',
      },
      anchor_aegis: {
        archetype: 'The Anchor · Positional Support',
        name: 'Aegis Projection',
        rule: 'Starts with 1 Aegis Pip (◆) and projects +4 Armor to all allies; Enrages Alone (+2 ATK) if squad falls.',
        counter: 'Crack its Pip with a light hit or TECH pulse, or kill allies last if you can handle its +2 ATK shift.',
      },
      time_bomb: {
        archetype: 'The Time-Bomb · Countdown Threat',
        name: 'Thermal Detonation',
        rule: 'Spends 2 turns charging thermal vents before firing 16 DMG; 16+ burst HP/ARM damage in 1 turn Staggers & resets charge.',
        counter: 'Burst for 16+ DMG in 1 turn (or Push with [R]) to Stagger its charge, or raise a Defense Stack.',
      },
      spike_retaliate: {
        archetype: 'The Punisher · Rule Modifier',
        name: 'Thorny Carapace',
        rule: 'Retaliates for 3 DMG on non-Surge Attacks; Beat 2 Hunt deals +4 bonus DMG if you end turn with 0 Shield.',
        counter: 'Trigger Attack Stack Surge (4+ tiles), finish in 1 hit, and keep ≥1 Shield on Beat 2.',
      },
      acid_jam: {
        archetype: 'The Disrupter · Board Hazard',
        name: 'Caustic Web-Jam & Hex',
        rule: 'Unblocked Acid jams 1 tile + injects Caustic Slag (-2 HP/round kept); Turn 2+ marks 1 tile with a healing Hex (+4 HP / +3 ARM).',
        counter: 'Block Acid with Shield, purge Slag with TECH or Overdrive, and avoid playing Hexed colors unless ready.',
      },
      threshold_pip: {
        archetype: 'Heavy Anchor · Threshold Gate',
        name: 'Reinforced Carapace',
        rule: 'Protected by 1 Aegis Pip (◆) & heavy Armor; dealing 16+ damage in 1 turn Staggers its Heavy slam to 0 DMG.',
        counter: 'Strip its Aegis Pip first, then deal 16+ burst with Attack Surge or Overdrive to Stagger.',
      },
      phase_gate: {
        archetype: 'Apex Sovereign · Phase Lock',
        name: '50% Phase Carapace & Hex',
        rule: 'Locks at 55 HP (+10 ARM & +1 Pip) at 50%; Beat 2 punishes Attack spam (+4 DMG) and casts Tile Hexes from Turn 2+.',
        counter: 'Trigger Phase Lock deliberately, watch Beat 2 Attack Tax, and shatter Hexes with Overdrive.',
      },
    },
    enemies: {
      larva: {
        name: 'Spore Mite',
        classification: 'The Chaff · Volatile Scout',
        bioNote: 'Unstable frontline fodder that blocks clean shots—detonates on death for 6 Pierce DMG to its own pack.',
      },
      skitter: {
        name: 'Cobalt Skitter',
        classification: 'The Anchor · Aegis Support',
        bioNote: 'Support swarmer with an Aegis Pip that shields allies; drops Bolster and Enrages (+2 ATK) if left alone.',
      },
      stinger: {
        name: 'Pyre Stinger',
        classification: 'The Time-Bomb · Thermal Striker',
        bioNote: 'Charges its thermal core for 2 turns before firing 16 DMG—16+ single-turn burst Staggers and resets its countdown.',
      },
      stalker: {
        name: 'Chitin Stalker',
        classification: 'The Punisher · Spike Predator',
        bioNote: 'Barbed predator that retaliates for 3 DMG on non-Surge hits and deals +4 opportunistic DMG if Shield is 0.',
      },
      spitter: {
        name: 'Bile Spitter',
        classification: 'The Disrupter · Caustic Artillery',
        bioNote: 'Clogs decks with Caustic Slag on unblocked Acid hits and casts healing Tile Hexes from Turn 2 onward.',
      },
      brute: {
        name: 'Carapace Brute',
        classification: 'Heavy Anchor · Siege Juggernaut',
        bioNote: 'Plated juggernaut with an Aegis Pip and crushing Heavy slams—16+ single-turn burst Staggers its swing to 0 DMG.',
      },
      boss: {
        name: 'Xenomorph Matriarch',
        classification: 'Apex Sovereign · Phase Boss',
        bioNote: 'Hive queen with a 50% Phase Lock, Attack-Tax Beat 2 (+4 DMG), healing Tile Hexes, and Slag-injecting Acid.',
      },
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
      dvojita_brokovnice: {
        name: 'Royal Twin-Barrel',
        desc: 'Gilded plasma double-barrel scattergun delivering dual 6 ATK salvos and a 6 DEF guard.',
      },
      kralovsky_diadem: {
        name: 'Sovereign Diadem',
        desc: 'Holo-crown neural regulator providing concentrated +4 HP royal nano-regeneration.',
      },
      utocny_dron_sokol: {
        name: 'Solar Hawk Gunship Drone',
        desc: 'Autonomous rotary-plasma jet drone delivering dual 5 ATK strafing runs and a 6 DEF wing-screen.',
      },
      stito_dron_ankh: {
        name: 'Ankh Bio-Shield Array',
        desc: 'Twin-rotor Ankh medical & Aegis walker link granting +4 HP bio-repair and a 7 DEF hex-dome.',
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
        desc: 'Emergency restorative kit paired with tactical defensive coverage.',
      },
      takticky_zesilovac: {
        name: 'Overclock Amp',
        desc: 'Adds a +42% Damage Booster TECH module plus a backup 5 ATK strike.',
      },
      tezka_brokovnice: {
        name: 'Breacher Shotgun',
        desc: 'Heavy close-quarters scattergun with high burst damage and reinforced guard.',
      },
      nano_ostri: {
        name: 'Mono-Blade Pair',
        desc: 'Lightweight twin vibro-blades delivering lean dual strikes without bloating load.',
      },
      kryo_kondenzator: {
        name: 'Cryo-Purge Module',
        desc: 'Surges +15% bonus Overdrive and cleanses -2 Corrode alongside a 6 DEF barrier.',
      },
      pulzni_kuse: {
        name: 'ARC Rail-Carbine',
        desc: 'Pairs high-velocity attacks with an EMP TECH pulse that shreds 10 enemy Armor.',
      },
      energeticky_konvertor: {
        name: 'Aegis Converter',
        desc: 'Dual-phase TECH capacitor granting +5 Shield and +22% DMG Boost plus a 5 ATK shot.',
      },
      reaktivni_pancir: {
        name: 'Reactive Exo-Plate',
        desc: 'Heavy composite plating pairing 10 & 8 DEF walls with a 6 ATK counter-strike.',
      },
      caustic_blight: {
        name: 'Bio-Hazard',
        desc: 'Caustic Slag residue. Deals 2 HP damage if kept at round end; purged by TECH or Overdrive.',
      },
    },
    nodes: {
      COMBAT: 'Mutant Skirmish',
      ELITE: 'Elite Abomination',
      CYBER_CLINIC: 'Cyber-Clinic',
      MED_BAY: 'Bio-Med Bay',
      EVENT: 'Mystery Anomaly (?)',
      BOSS: 'Hive Matriarch',
    },
    nodeDescs: {
      COMBAT: 'Clear bio-mutant patrol · Rewards Credits & Equipment.',
      ELITE: 'High-threat armored encounter · Rewards Gear Loot & Cyber-Clinic.',
      CYBER_CLINIC: 'Buy Equipment with Credits & draft 1 of 3 Implants.',
      MED_BAY: 'Repair HP, boost Max HP, or salvage Credits.',
      EVENT: 'Investigate abandoned cache, rogue AI, or black market smuggler.',
      BOSS: 'Final confrontation with the Sector Hive Queen.',
    },
  },
  cs: {
    gameTitle: 'NEON BREACH',
    gameSubtitle: 'Aktivuj 1 typ dlaždic za tah · Skládej výbavu a TECH efekty · Očisti nebeský most',
    startRun: 'Spustit misi',
    continueRun: 'Pokračovat v misi',
    newRun: 'Nová mise',
    selectOperativeLabel: 'Výběr operativky',
    controlsHint: '1/2/3 Vyber typ · Mezerník Overdrive · F Celá obrazovka · P Pauza · M Zvuk · L Jazyk',
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
    jammedTag: 'BLOK',
    atkShort: 'ATK',
    defShort: 'DEF',
    healShort: 'LÉČENÍ',
    dmgBoostShort: 'DMG',
    shredShort: 'PRŮRAZ',
    odShort: 'OD',
    aegisShort: 'ŠTÍT+',
    allShort: 'VŠEM',
    allTargetsLabel: 'Všem spojencům',
    pipShort: 'PIP',
    pipLabel: 'Aegis Pip',
    pipCrackLabel: 'PRORAZÍ PIP',
    phaseGateLabel: '50% FÁZOVÝ ZÁMEK',
    bioBurstLabel: '+6 BIO-EXPLOZE VŠEM',
    retaliateLabel: '3 ODPLATA',
    tileJamWarnLabel: 'ZABLOKUJE 1 DLAŽDICI',
    staggeredTag: '⚡ OMRÁČEN',
    staggerPreviewLabel: '⚡ OMRÁČÍ!',
    enragedAloneTag: 'SÁM +2',
    hexTag: '⬡ KLETBA',
    blightTag: '☣ STRUSKA',
    purgeLabel: 'SPÁLIT',
    condBonusLabel: 'PODM.',
    innateLabel: 'Vrozené jádro',
    surgeLabel: 'PŘETÍŽENÍ',
    surgeAttackEffect: 'Průraz brnění + 50% rozmach',
    surgeDefenseEffect: 'Odraz 8 DMG při bloku',
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
    previewArmorShred: 'Snížení brnění (všichni)',
    previewTechPierce: 'Průrazné DMG vpředu',
    previewCorrodeCleanse: 'Očištěná koroze',
    previewSurgeTriggered: 'Bonus přetížení aktivní',
    enemyIntentAttack: 'Seknutí',
    enemyIntentAcid: 'Žíravý plivanec',
    enemyIntentArmor: 'Tvrzení krunýře',
    enemyIntentBolster: 'Aegis podpora',
    enemyIntentCharge: 'Žárové nabíjení',
    enemyIntentLeech: 'Bio-vysátí',
    enemyIntentHeavy: 'Smrtící drápy',
    armorLabel: 'Brnění',
    armorShort: 'BRN',
    corrodeLabel: 'Koroze',
    corrodeShort: 'KOR',
    lethalLabel: 'SMRT',
    armorBreakLabel: 'Průraz brnění',
    implantsTitle: 'Kybernetické implantáty',
    noImplants: 'Žádné implantáty',
    implantSlotsLabel: 'Implantáty',
    inspectPool: 'Výbava a Pool',
    loadoutButton: 'Výbava',
    poolModalTitle: 'Výbava a aktivní pool dlaždic',
    poolModalDesc: '{name} kombinuje svých 5 vrozených dlaždic s nasazeným vybavením do nosnosti {capacity}.',
    equippedGearTitle: 'Nasazené vybavení',
    cargoStashTitle: 'Batoh / Zásoba',
    noCargoStash: 'V zásobě není žádné nenasazené vybavení.',
    noEquippedGear: 'Žádné nasazené vybavení (pouze vrozené dlaždice).',
    equipAction: 'Nasadit',
    unequipAction: 'Sundat',
    scrapAction: 'Sešrotovat',
    capacityFullWarning: 'Překročena nosnost',
    combatSwapLocked: 'Během boje nelze vybavení měnit.',
    sizeLabel: 'Velikost',
    closeLabel: 'Zavřít',
    synchronizingStage: 'Synchronizace scény...',
    pause: 'Pauza',
    pauseTitle: 'Mise pozastavena',
    resume: 'Pokračovat',
    restart: 'Restartovat misi',
    returnTitle: 'Hlavní obrazovka',
    mute: 'Ztlumit',
    unmute: 'Zapnout zvuk',
    languageName: 'CS',
    landscapeToggle: 'Na šířku',
    portraitToggle: 'Na výšku',
    fullscreenEnter: 'Celá obrazovka',
    fullscreenExit: 'Ukončit režim',
    tacticalInfoButton: 'Info',
    passiveLabel: 'Pravidlo zámku',
    counterPlayLabel: 'Proti-hra',
    overdriveTitleLabel: 'Overdrive',
    surgeRuleLabel: 'Přetížení',
    tapInfoHint: 'Klepni pro náhled · Znovu pro akci',
    enemyIntentDescAttack: 'Udělí {val} poškození nejprve do Štítu, poté do Zdraví.',
    enemyIntentDescHeavy: 'Silný úder za {val} příchozího poškození.',
    enemyIntentDescAcid: 'Udělí {val} poškození, přidá +{sec} Koroze a při zásahu Zdraví zablokuje 1 dlaždici.',
    enemyIntentDescArmor: 'Získá +{val} Brnění, které pohlcuje poškození Útoku.',
    enemyIntentDescBolster: 'Propůjčí +{val} Brnění VŠEM žijícím mutantům na mostě.',
    enemyIntentDescCharge: 'Nabíjí žárové jádro (zbývá {sec}T) → po nabití udeří za {val} DMG.',
    enemyIntentDescLeech: 'Udělí {val} poškození a vyléčí si +{sec} Zdraví, pokud projde poškození do Zdraví.',
    corrodeDesc: 'Snižuje Štít získaný z dlaždic Obrany.',
    armorDesc: 'Pohlcuje poškození Útoku před snížením zdraví nepřítele.',
    nextActionLabel: 'Příští akce',
    behaviorCycleLabel: 'Cyklus akcí',
    enemyArmorActiveDesc:
      'Pohltí až {armor} běžného poškození Útoku před zásahem Zdraví. Přetížení zničí celé brnění; Fázová čepel projde 30 %.',
    enemyArmorNoneDesc: 'Bez brnění — poškození Útoku jde přímo do zdraví.',
    enemyShieldPipDesc: 'Aktivní Aegis Pip (◆): zcela pohltí příští 1 zásah bez ohledu na výši poškození.',
    victoryTitle: 'Sektor vyčištěn',
    victorySubtitle: 'Xenomorfní Matriarcha padla a nebeský most Nové Prahy je zabezpečen.',
    defeatTitle: 'Signál ztracen',
    defeatSubtitle: '{name} utrpěla kritické poškození při průlomu v konzervatoři.',
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
    heatGaugeLabel: 'ŽÁR',
    heatLowLabel: 'NÍZKÝ ŽÁR',
    heatMediumLabel: 'POSILY',
    heatOvertimeLabel: 'PŘESČAS',
    parCachesLabel: 'Bonusové schránky',
    parCachePrefix: 'T',
    tempoLabel: 'TEMPO',
    tempoTip: 'Zraňuj nepřátele v po sobě jdoucích tazích pro bonusové CR (+2 CR/tah, max +8 CR).',
    inboundDropLabel: 'VÝSADEK',
    dropZeroDmgRule: '0 DMG v tahu dopadu',
    dropReasonThreat: 'VLNA HROZBY',
    dropReasonReactive: 'REAKTIVNÍ',
    dropReasonAdaptive: 'ADAPTIVNÍ',
    dropReasonSos: 'SOS SIGNÁL',
    dropReasonSweeper: 'ČISTIČ',
    dropRubberBandDelayed: 'ODLOŽENO (+1T)',
    enrageBadgeLabel: 'ZUŘIVOST',
    sosFlareBadgeLabel: 'SOS',
    zeroRewardBadgeLabel: '0 CR',
    fastClearBonusLabel: 'Bonus za rychlé vyčištění',
    baseLootLabel: 'Základ',
    parBonusLabel: 'Par schránky',
    tempoBonusLabel: 'Tempo',
    sectorMapTitle: 'Mapa trasy sektoru',
    sectorMapSubtitle: 'Vyber další větev mostu nebo před bojem uprav výbavu ({name}).',
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
    clinicSubtitle: 'Nakup vybavení za kredity a vyber 1 z 3 bojových implantátů pro {name}.',
    clinicSelectPrompt: 'Dostupné kybernetické implantáty (výběrem opustíš kliniku)',
    clinicReplacePrompt: 'Všechny 4 sloty jsou plné. Vyber slot k nahrazení:',
    clinicShopTitle: 'Obchod s vybavením',
    clinicShopEmpty: 'Veškeré zboží kliniky vykoupeno.',
    restockShop: 'Obnovit zboží',
    buyEquipment: 'Koupit',
    notEnoughCredits: 'Málo CR',
    installImplant: 'Instalovat modul',
    replaceSlot: 'Nahradit slot',
    skipClinic: 'Opustit kliniku',
    rarityCommon: 'Standardní',
    rarityRare: 'Prototyp',
    medbayTitle: 'Bio-ošetřovna',
    medbaySubtitle: 'Stabilizuj systémy, posil tělo ({name}) nebo získej kredity na výbavu.',
    medbayHealTitle: 'Nano-bio oprava',
    medbayHealDesc: 'Okamžitě obnov +22 Zdraví pro {name}.',
    medbayCalibrateTitle: 'Zpevnění schránky',
    medbayCalibrateDesc: 'Trvale zvyš max. Zdraví o +10 a vyléčí +10 Zdraví.',
    medbaySalvageTitle: 'Recyklace součástek',
    medbaySalvageDesc: 'Získej +35 Kreditů na nákup výbavy v Kyber-klinice.',
    medbayOverclockTitle: 'Neurální přetaktování a ladění dílků',
    medbayOverclockDesc: 'Trvale vylepši základní útočné dílky (+2 ATK), vyčisti poleptání a získej +35% Overdrive.',
    medbayExtractTitle: 'Zavolat taktický evakuační raketoplán',
    medbayExtractDesc: 'Ulož 100 % nasbíraných Nanitů a kreditů hned teď. Ukonči misi bezpečně bez rizika porážky.',
    applyRepair: 'Obnovit +22 Zdraví',
    applyCalibrate: '+10 Max Zdraví',
    applySalvage: 'Získat +35 CR',
    applyOverclock: 'Přetaktovat dílky',
    applyExtract: 'Zavolat raketoplán',
    medbayNurseName: 'Dr. Amara Vance',
    medbayNurseRole: 'Vrchní bio-medička',
    medbayNurseIdleNominal: 'funkce stabilní — purpurové nano-sérum je připraveno k přetaktování či zpevnění schránky.',
    medbayNurseIdleCritical: 'Varování traumatu! Nehýbej se — mám připravenou dávku regeneračního nano-gelu k okamžité aplikaci.',
    medbayNurseHoverHeal: 'Připravuji nano-injektor: okamžitá buněčná obnova +22 Zdraví.',
    medbayNurseHoverCalibrate: 'Zesiluji podkožní pletivo: trvalé navýšení kapacity o +10 Max Zdraví.',
    medbayNurseHoverSalvage: 'Třídím přebytečné bio-články: +35 CR připraveno na nákup výbavy.',
    medbayNurseHoverOverclock: 'Aplikuji synaptický katalyzátor: +2 ATK základním útokům, očista koroze a +35% Overdrive.',
    medbayNurseHoverExtract: 'Maják zaměřen: evakuační raketoplán bezpečně uloží 100 % tvých Nanitů a kreditů.',
    nanitesLabel: 'Nanity',
    nanitesShort: 'NC',
    bountyGoldenBadge: '★ ODMĚNA +50% CR',
    bountyDoubleBadge: '2× KREDITY',
    bountyNaniteBadge: '◆ NANITY +2',
    bountyOverchargedBadge: '⚡ PŘETÍŽENO (+1 NC)',
    bountyFlashSaleBadge: '🏷 BLESKOVÁ SLEVA (-35% CR)',
    bountyFundedClinicBadge: '✦ DOTACE (+BONUS OPRAVA)',
    laneArchetypeGauntlet: 'VÝZVA (GAUNTLET)',
    laneArchetypeMercenary: 'ŽOLDNÉŘSKÁ CESTA',
    laneArchetypeGambler: 'HAZARDNÍ LÁVKA',
    laneGauntletDesc: 'Vysoké napětí · Elitní kořist · Záchranná síť',
    laneMercenaryDesc: 'Pravidelný boj · Maximum kreditů · Nákup výbavy',
    laneGamblerDesc: 'Anomálie a obchody · Nízká bojová únava',
    laneShortPrefix: 'TRASA',
    mapRiskShort: 'HP riziko',
    mapPathTargetBadge: 'CÍL TRASY',
    mapAnomalyLabel: 'ANOMÁLIE (?)',
    mapMultiHopLabel: 'Plánovaná trasa',
    mapHpRecoveryLabel: 'Obnova HP',
    defibArmedLabel: 'DEFIB: NABITÝ (+15% HP ≤15%)',
    defibDischargedLabel: 'DEFIB: VYBITÝ',
    fundedClinicAllActionsNote: 'Dotovaná klinika: bonus +12 HP opravy platí automaticky pro JAKOUKOLI volbu níže.',
    fundedBonusHpTag: '+12 HP dotace',
    reconPreviewPrefix: 'PRŮZKUM',
    tensionLabel: 'Tenze',
    yieldLabel: 'Výnos',
    oppCostLabel: 'Cena příležitosti',
    greedyClinicNotice: 'VOLBA KLINIKY: Plné zdraví! Investujte do přetaktování dlaždic nebo nanitů namísto běžné opravy.',
    opportunityCostNotice: 'CENA PŘÍLEŽITOSTI: Kritické poškození nutí k opravě, což obětuje trvalé přetaktování dlaždic!',
    abstinenceBonusLabel: 'Žoldnéřský úrok (série)',
    emergencyDefibTriggered: 'NOUZOVÝ DEFIBRILÁTOR: Životní injekce obnovila +15% HP!',
    reconActiveBadge: 'PRŮZKUM AKTIVNÍ',
    bossTelegraphTitle: 'TELEGRAF STRÁŽCE SEKTORU',
    bossTelegraphIntel: 'Vládce líhně · Finále Sektor 05',
    shopAffordable: 'DOSTUPNÉ',
    shopLowCredits: 'MÁLO KREDITŮ',
    eventViewTitle: 'UDÁLOST V KYBER-SÍTI',
    eventExecuteChoice: 'Potvrdit volbu',
    eventCriticalHp: 'Kritické HP',
    characters: {
      kira: {
        code: 'KIRA-09',
        name: 'Kira',
        title: 'Plazmová předvoj',
        weapon: '58 HP · 45 CR · Nosnost 12 · Aretta + Lékarnička',
        passive: 'Kyber-hybnost: Držené +1 ATK/DEF · TECH +20 % OD',
        overdriveName: 'Plazmový Blitz',
        overdriveDesc: '20 průraz DMG všem · +30 % DMG Boost · +6 Štít',
        summary: 'Expertka na TECH přetížení (3 ATK · 2 DEF · 4 TECH): nabíjí držené dlaždice a řetězí Overdrive.',
      },
      aurelia: {
        code: 'AURELIA-07',
        name: 'Aurelia',
        title: 'Královská kyber-mušketýrka',
        weapon: '66 HP · 40 CR · Nosnost 14 · Dvouhlavňovka + Diadém',
        passive: 'Královská záštita: Drží 5 Štítu/tah · DEF vrací 2 DMG',
        overdriveName: 'Královská salva',
        overdriveDesc: '24 průraz DMG všem · +12 Štít · -2 Koroze',
        summary: 'Obrněná střelkyně (4 ATK · 3 DEF · 2 TECH): drtivé útočné salvy a protiútoky ze štítu.',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Velitelka solárního roje',
        weapon: '62 HP · 50 CR · Nosnost 13 · Dron Sokol + Ankh Modul',
        passive: 'Rojový uplink: Držené +1 · 3 Štít/tah · TECH +25 % OD',
        overdriveName: 'Protokol Solární roj',
        overdriveDesc: '22 průraz DMG všem · +9 Štít · +25 % DMG · -2 Koroze',
        summary: 'Létající velitelka dronů (3 ATK · 3 DEF · 3 TECH): vznáší se na tryskách a řídí 3 bojové drony.',
      },
    },
    enemyPassives: {
      volatile_burst: {
        archetype: 'Pěšák · Výbušný roj',
        name: 'Bio-exploze',
        rule: 'Při smrti vybuchne a udělí 6 průrazného DMG všem ostatním mutantům.',
        counter: 'Zneškodni ho, když za ním stojí obrnění nepřátelé, a řetězově jim proraz zdraví.',
      },
      anchor_aegis: {
        archetype: 'Kotva · Podpora brnění',
        name: 'Aegis projekce',
        rule: 'Začíná s 1 Aegis Pipem (◆) a dává +4 Brnění všem; pokud zůstane sám, zuří (+2 ATK) a přepne do útoku.',
        counter: 'Proraz jeho Pip lehkým útokem či TECH pulzem, nebo zvaž pořadí zabití spojenců.',
      },
      time_bomb: {
        archetype: 'Časovaná bomba · Odpočet',
        name: 'Žárová detonace',
        rule: '2 tahy nabíjí jádro před výbojem za 16 DMG; 16+ DMG v 1 tahu nepřítele Omráčí a vynuluje odpočet.',
        counter: 'Uděl 16+ DMG v 1 tahu (nebo Odstrč přes [R]) k Omráčení nabíjení, či postav velký Štít.',
      },
      spike_retaliate: {
        archetype: 'Trestající · Modifikátor pravidel',
        name: 'Trnitý krunýř',
        rule: 'Vrací 3 DMG při běžném Útoku; ve 2. fázi udělí +4 DMG navíc, pokud skončíš tah s 0 Štítem.',
        counter: 'Spusť Přetížení Útoku (4+ dlaždice), doraz ho 1 ranou a v 2. fázi si drž aspoň 1 Štít.',
      },
      acid_jam: {
        archetype: 'Disruptor · Sabotáž desky',
        name: 'Žíravá blokace a Kletba',
        rule: 'Nezablokovaná kyselina zablokuje dlaždici + přidá Žíravou strusku (-2 HP/kolo); od 2. tahu proklíná dlaždici (+4 HP / +3 BRN).',
        counter: 'Vykryj kyselinu Štítem, spal Strusku přes TECH či Overdrive a neaktivuj prokleté barvy bez přípravy.',
      },
      threshold_pip: {
        archetype: 'Těžká kotva · Prahový štít',
        name: 'Zesílený krunýř',
        rule: 'Chráněn 1 Aegis Pipem (◆) a pancířem; 16+ poškození v 1 tahu Omráčí jeho Těžký úder na 0 DMG.',
        counter: 'Nejprve strhni Pip a pak Přetížením Útoku nebo Overdrive uděl 16+ DMG pro Omráčení.',
      },
      phase_gate: {
        archetype: 'Vrcholná královna · Fázový zámek',
        name: '50% Fázový krunýř a Kletba',
        rule: 'Zastaví se na 55 HP (+10 BRN & Pip) v 50 %; ve 2. fázi trestá hraní Útoku (+4 DMG) a od 2. tahu sesílá Kletby.',
        counter: 'Naplánuj fázový zámek, sleduj daň za Útok ve 2. fázi a rozbij Kletby přes Overdrive.',
      },
    },
    enemies: {
      larva: {
        name: 'Spórový roztoč',
        classification: 'Pěšák · Výbušný průzkumník',
        bioNote: 'Nestabilní pěšák blokující přední linii — při smrti vybuchne za 6 průrazného DMG do vlastních řad.',
      },
      skitter: {
        name: 'Kobaltový běžec',
        classification: 'Kotva · Aegis podpora',
        bioNote: 'Podpůrný mutant s Aegis Pipem, který posiluje spojence; pokud zůstane sám, zuří (+2 ATK) a útočí.',
      },
      stinger: {
        name: 'Žárový žahavec',
        classification: 'Časovaná bomba · Žárový útočník',
        bioNote: '2 tahy nabíjí žárové jádro před detonací za 16 DMG — 16+ DMG v 1 tahu ho Omráčí a vrátí odpočet.',
      },
      stalker: {
        name: 'Chitinový slídič',
        classification: 'Trestající · Trnitý predátor',
        bioNote: 'Predátor s trnitým krunýřem (3 DMG odplata), který při 0 Štítu ve 2. fázi udeří za +4 DMG navíc.',
      },
      spitter: {
        name: 'Žlučový plivač',
        classification: 'Disruptor · Žíravé bio-dělo',
        bioNote: 'Zahlcuje balíček Žíravou struskou při nezablokovaném zásahu a od 2. tahu proklíná dlaždice léčivou Kletbou.',
      },
      brute: {
        name: 'Krunýřový kolos',
        classification: 'Těžká kotva · Obléhací kolos',
        bioNote: 'Mohutná bestie s Aegis Pipem a drtivým úderem — 16+ DMG v 1 tahu Omráčí jeho Těžký úder na 0 DMG.',
      },
      boss: {
        name: 'Xenomorfní Matriarcha',
        classification: 'Vrcholná královna · Fázový boss',
        bioNote: 'Královna úlu s 50% Fázovým zámkem, daní za Útok (+4 DMG), léčivou Kletbou na desce a Žíravou struskou.',
      },
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
      dvojita_brokovnice: {
        name: 'Královská dvouhlavňovka',
        desc: 'Zlacená plazmová dvouhlavňová brokovnice se dvěma zásahy po 6 ATK a 6 DEF krytem.',
      },
      kralovsky_diadem: {
        name: 'Královský diadém',
        desc: 'Holografická koruna poskytující koncentrovanou královskou nano-regeneraci +4 HP.',
      },
      utocny_dron_sokol: {
        name: 'Útočný dron Sokol',
        desc: 'Autonomní tryskový dron s rotačním plazmovým dělem (2× 5 ATK nálet a 6 DEF kryt).',
      },
      stito_dron_ankh: {
        name: 'Štíto-dron Ankh',
        desc: 'Propojení bio-medického dronu Ankh a kráčejícího štítu (+4 HP oprava a 7 DEF kupole).',
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
        desc: 'Nouzový regenerační modul kombinovaný s taktickým krytem.',
      },
      takticky_zesilovac: {
        name: 'Taktický zesilovač',
        desc: 'Přidá TECH modul +42% Damage booster a záložní útok 5 ATK.',
      },
      tezka_brokovnice: {
        name: 'Průlomová brokovnice',
        desc: 'Těžká zbraň na blízkou vzdálenost s vysokým nárazovým poškozením a zesíleným krytem.',
      },
      nano_ostri: {
        name: 'Pár mono-čepelí',
        desc: 'Lehké vibro-čepele poskytující dva čisté zásahy bez zbytečné zátěže.',
      },
      kryo_kondenzator: {
        name: 'Kryo-čisticí modul',
        desc: 'Dodá +15 % Overdrive navíc a odstraní 2 Koroze spolu s obranou 6 DEF.',
      },
      pulzni_kuse: {
        name: 'Oblouková karabina',
        desc: 'Kombinuje útoky s EMP TECH pulzem, který všem nepřátelům strhne 10 Brnění.',
      },
      energeticky_konvertor: {
        name: 'Konvertor Aegis',
        desc: 'Dvoufázový TECH modul přidávající +5 Štítu, +22 % Boost DMG a útok 5 ATK.',
      },
      reaktivni_pancir: {
        name: 'Reaktivní exo-plát',
        desc: 'Těžký kompozitní plát spojující silnou obranu 10 a 8 DEF s protiúderem 6 ATK.',
      },
      caustic_blight: {
        name: 'Bio-odpad',
        desc: 'Žíravá struska. Na konci kola udělí 2 DMG při ponechání na desce; spálí se přes TECH nebo Overdrive.',
      },
    },
    nodes: {
      COMBAT: 'Střet s mutanty',
      ELITE: 'Elitní zrůda',
      CYBER_CLINIC: 'Kyber-klinika',
      MED_BAY: 'Bio-ošetřovna',
      EVENT: 'Záhadná anomálie (?)',
      BOSS: 'Královna úlu',
    },
    nodeDescs: {
      COMBAT: 'Vyčisti hlídku mutantů · Odměna kredity a vybavení.',
      ELITE: 'Nebezpečný obrněný střet · Odměna kořist a Kyber-klinika.',
      CYBER_CLINIC: 'Kup nové vybavení a vyber 1 ze 3 implantátů.',
      MED_BAY: 'Oprav zdraví, posil max. HP nebo získej kredity.',
      EVENT: 'Prozkoumej opuštěnou schránku, rogue AI nebo překupníka.',
      BOSS: 'Závěrečný střet s Královnou úlu.',
    },
  },
};
