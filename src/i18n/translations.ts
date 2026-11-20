import type { CharacterId, EnemyPassiveKind } from '../engine/types';

export type Language = 'en' | 'cs';

export interface TranslationPack {
  startRun: string;
  continueRun: string;
  newRun: string;
  selectOperativeLabel: string;
  controlsHint: string;
  howToPlay: {
    title: string;
    badge: string;
    goal: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    attackLabel: string;
    attackDesc: string;
    defenseLabel: string;
    defenseDesc: string;
    techLabel: string;
    techDesc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
  };
  hpLabel: string;
  shieldLabel: string;
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
  discardPoolLabel: string;
  poolTotalLabel: string;
  nextDrawLabel: string;
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
  landscapeToggle: string;
  portraitToggle: string;
  fullscreenEnter: string;
  fullscreenExit: string;
  tacticalInfoButton: string;
  passiveLabel: string;
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
  heatLowLabel: string;
  heatMediumLabel: string;
  heatOvertimeLabel: string;
  parCachePrefix: string;
  tempoTip: string;
  inboundDropLabel: string;
  dropZeroDmgRule: string;
  dropReasonThreat: string;
  dropReasonReactive: string;
  dropReasonAdaptive: string;
  dropReasonSos: string;
  dropReasonSweeper: string;
  dropRubberBandDelayed: string;
  sosFlareBadgeLabel: string;
  zeroRewardBadgeLabel: string;
  fastClearBonusLabel: string;
  baseLootLabel: string;
  parBonusLabel: string;
  tempoBonusLabel: string;
  sectorMapTitle: string;
  layerLabel: string;
  nodeLocked: string;
  enterNode: string;
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
  upchargeShort: string;
  upchargeLabel: string;
  dudTag: string;
  chipDealerTitle: string;
  chipDealerSubtitle: string;
  skipChipDealer: string;
  clinicPurgeTitle: string;
  clinicPurgeDesc: string;
  purgeTileAction: string;
  purgedDoneLabel: string;
  nodes: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    CHIP_DEALER: string;
    MED_BAY: string;
    EVENT: string;
    BOSS: string;
  };
  nodeDescs: {
    COMBAT: string;
    ELITE: string;
    CYBER_CLINIC: string;
    CHIP_DEALER: string;
    MED_BAY: string;
    EVENT: string;
    BOSS: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationPack> = {
  en: {
    startRun: 'Start Run',
    continueRun: 'Continue Run',
    newRun: 'New Run',
    selectOperativeLabel: 'Select Operative',
    controlsHint: 'F Fullscreen · P Pause · M Mute · L Language',
    howToPlay: {
      title: 'How to Play',
      badge: 'Beginner Guide',
      goal: 'Clear the sector map to the Hive Boss by choosing 1 tile color each turn from your 6-tile tactical rack.',
      step1Title: '1. Pick 1 Color per Turn',
      step1Desc: 'Press [1], [2], [3] or click a color button to activate ALL matching tiles on the board at once. Unplayed tiles stay held for the next turn.',
      step2Title: '2. Three Tile Types',
      attackLabel: '◆ Attack (Red)',
      attackDesc: 'Deals damage to the front enemy (and breaks shields).',
      defenseLabel: '● Defense (Cyan)',
      defenseDesc: 'Builds temporary Shield to absorb incoming attacks, or heals HP.',
      techLabel: '▲ TECH (Gold)',
      techDesc: 'Boosts your next attack, shreds armor, and charges Overdrive fast.',
      step3Title: '3. Stack Surge & Overdrive',
      step3Desc: 'Hold tiles across turns to trigger 4+ Stack Surge (+40% power). When Overdrive hits 100%, press [Space] for a free ultimate action!',
      step4Title: '4. Push & Sector Route',
      step4Desc: 'Use [R] once per turn to swap the front two enemies. Between fights, pick your route across Clinics, Dealers, and Med-Bays on the Sector Map.',
    },
    hpLabel: 'HP',
    shieldLabel: 'Shield',
    creditsLabel: 'CR',
    capacityLabel: 'Memory',
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
    discardPoolLabel: 'Cycle',
    poolTotalLabel: 'Active Pool',
    nextDrawLabel: 'Upcoming Draws',
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
    armorLabel: 'Armor',
    armorShort: 'ARM',
    corrodeLabel: 'Corrode',
    corrodeShort: 'COR',
    lethalLabel: 'LETHAL',
    armorBreakLabel: 'Armor Break',
    implantsTitle: 'Cybernetic Implants',
    noImplants: 'No implants installed',
    implantSlotsLabel: 'Implants',
    inspectPool: 'Chips & Pool',
    poolModalTitle: 'AI Skill Chips & Active Pool',
    poolModalDesc: '{name} combines innate core tiles with equipped AI Skill Chips up to {capacity} Memory.',
    equippedGearTitle: 'Installed AI Chips',
    cargoStashTitle: 'Chip Vault',
    noCargoStash: 'No unequipped AI Skill Chips in vault.',
    noEquippedGear: 'No AI Skill Chips installed (using innate tiles only).',
    equipAction: 'Install',
    unequipAction: 'Uninstall',
    scrapAction: 'Scrap',
    capacityFullWarning: 'Not enough Chip Memory',
    combatSwapLocked: 'AI Skill Chips cannot be swapped during active combat.',
    sizeLabel: 'Mem',
    closeLabel: 'Close',
    synchronizingStage: 'Synchronizing sky-bridge...',
    pause: 'Pause',
    pauseTitle: 'Mission Paused',
    resume: 'Resume',
    restart: 'Restart Run',
    returnTitle: 'Title Screen',
    mute: 'Mute',
    unmute: 'Unmute',
    landscapeToggle: 'Landscape',
    portraitToggle: 'Portrait',
    fullscreenEnter: 'Fullscreen',
    fullscreenExit: 'Exit Fullscreen',
    tacticalInfoButton: 'Info',
    passiveLabel: 'Lock Rule',
    victoryTitle: 'Sector Purged',
    victorySubtitle: 'The Xenomorph Matriarch has fallen and the Neo-Prague sky-bridge is secure.',
    defeatTitle: 'Signal Lost',
    defeatSubtitle: '{name} sustained critical bio-trauma in the conservatory breach.',
    combatVictory: 'Mutants Neutralized',
    combatLootPrompt: 'Claim 1 Salvaged AI Skill Chip (or Scrap for +15 CR):',
    claimEquipment: 'Claim Chip',
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
    heatLowLabel: 'LOW HEAT',
    heatMediumLabel: 'MED HEAT',
    heatOvertimeLabel: 'OVERTIME',
    parCachePrefix: 'T',
    tempoTip: 'Deal damage on consecutive turns for bonus CR (+2 CR/turn, max +8 CR).',
    inboundDropLabel: 'DROP INBOUND',
    dropZeroDmgRule: '0 DMG on arrival turn',
    dropReasonThreat: 'THREAT WAVE',
    dropReasonReactive: 'REACTIVE',
    dropReasonAdaptive: 'ADAPTIVE COUNTER',
    dropReasonSos: 'SOS FLARE',
    dropReasonSweeper: 'OVERTIME SWEEPER',
    dropRubberBandDelayed: 'DELAYED (+1T)',
    sosFlareBadgeLabel: 'SOS',
    zeroRewardBadgeLabel: '0 CR',
    fastClearBonusLabel: 'Fast Clear Bonus',
    baseLootLabel: 'Base',
    parBonusLabel: 'Par Caches',
    tempoBonusLabel: 'Tempo',
    sectorMapTitle: 'Sector Route Map',
    layerLabel: 'Sector',
    nodeLocked: 'Locked',
    enterNode: 'Deploy',
    mapAdviceLowHp: 'Hull integrity below threshold — route toward Bio-Med Bay for +22 HP repair.',
    mapAdviceElite: 'Vitals optimal — engage Elite Abomination for high score, AI Chip loot & Cyber-Clinic.',
    mapAdviceClinic: 'Cyber-Clinic ahead — install a neural implant or purge an innate Dud tile.',
    mapAdviceBoss: 'Outer bridge spans secured — converge on the Hive Matriarch in Sector 5.',
    mapAdviceCombat: 'Clear patrol skirmish to earn Credits, AI Skill Chips, and open central routes.',
    mapRewardImplant: 'Implants & Tile Purge',
    mapRewardElite: 'AI Chip + Cyber-Clinic',
    mapRewardMedbay: '+22 HP / +10 Max / CR',
    mapRewardCombat: '+CR & AI Chip Loot',
    mapRewardBoss: 'Sector Liberation',
    mapLoadoutStatus: 'Chips',
    mapOpensNext: 'Unlocks Next Sector',
    clinicTitle: 'Cyber-Clinic',
    clinicSubtitle: 'Install **1 Implant** or purge 1 tile.',
    clinicSelectPrompt: 'Draft **1 Cyber Implant**',
    clinicReplacePrompt: 'Sockets full. Choose 1 implant to replace:',
    clinicShopTitle: 'AI Skill Chip Requisition',
    clinicShopEmpty: 'All AI Skill Chip stock acquired.',
    restockShop: 'Restock',
    buyEquipment: 'Buy Chip',
    notEnoughCredits: 'Need CR',
    installImplant: 'Install Module',
    replaceSlot: 'Replace Socket',
    skipClinic: 'Leave Clinic',
    rarityCommon: 'Standard',
    rarityRare: 'Prototype',
    medbayTitle: 'Bio-Med Bay',
    medbaySubtitle: '**Repair HP**, boost Max, or salvage.',
    medbayHealTitle: 'Nano-Bio Repair',
    medbayHealDesc: '**Restore +22 HP** immediately.',
    medbayCalibrateTitle: 'Chassis Reinforcement',
    medbayCalibrateDesc: '**+10 Max HP** & restore +10 HP.',
    medbaySalvageTitle: 'Resource Salvage',
    medbaySalvageDesc: '**+35 Credits** from surplus parts.',
    medbayOverclockTitle: 'Neural Overclock',
    medbayOverclockDesc: '**+1 ATK** on 2 tiles · **+20% OD**.',
    medbayExtractTitle: 'Call Tactical Shuttle',
    medbayExtractDesc: '**Bank all Nanites & CR**. Safe extraction.',
    applyRepair: 'Restore +22 HP',
    applyCalibrate: '+10 Max HP',
    applySalvage: 'Collect +35 CR',
    applyOverclock: 'Overclock Tiles',
    applyExtract: 'Call Shuttle',
    medbayNurseName: 'Dr. Amara Vance',
    medbayNurseRole: 'Chief Bio-Tech Officer',
    medbayNurseIdleNominal: 'Vitals stable. Primed for overclocking or tuning.',
    medbayNurseIdleCritical: 'Trauma alert! Nano-gel syringe ready for infusion.',
    medbayNurseHoverHeal: '**Restore +22 HP** cellular regeneration.',
    medbayNurseHoverCalibrate: '**+10 permanent Max HP** capacity.',
    medbayNurseHoverSalvage: '**+35 Credits** ready for requisition.',
    medbayNurseHoverOverclock: '**+1 ATK** on 2 Attack tiles · **+20% OD**.',
    medbayNurseHoverExtract: 'Safe extraction. **Bank 100% Nanites & Credits**.',
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
    mapAnomalyLabel: 'ANOMALY (?)',
    mapMultiHopLabel: 'Multi-Hop Planned Route',
    mapHpRecoveryLabel: 'HP Recovery',
    defibArmedLabel: 'DEFIB: ARMED (+15% HP ≤15%)',
    defibDischargedLabel: 'DEFIB: DISCHARGED',
    fundedClinicAllActionsNote: 'Funded Clinic: **+12 HP bonus** on all choices.',
    fundedBonusHpTag: '+12 HP Funded Bonus',
    reconPreviewPrefix: 'RECON',
    tensionLabel: 'Tension',
    yieldLabel: 'Yield',
    oppCostLabel: 'Opportunity Cost',
    greedyClinicNotice: 'Vitals full: invest in Overclocking or Salvage.',
    opportunityCostNotice: 'Critical trauma: repair required for survival.',
    abstinenceBonusLabel: 'Mercenary Interest (Streak)',
    emergencyDefibTriggered: 'EMERGENCY DEFIBRILLATOR: Vital surge restored +15% HP!',
    reconActiveBadge: 'RECON ACTIVE',
    shopAffordable: 'AFFORDABLE',
    shopLowCredits: 'LOW CREDITS',
    eventViewTitle: 'CYBER-GRID ENCOUNTER',
    eventExecuteChoice: 'Execute Decision',
    eventCriticalHp: 'Critical HP',
    upchargeShort: 'UC',
    upchargeLabel: 'UpCharge',
    dudTag: 'DUD',
    chipDealerTitle: 'Chip Dealer',
    chipDealerSubtitle: 'Acquire **AI Skill Chips** with Credits.',
    skipChipDealer: 'Leave Dealer',
    clinicPurgeTitle: 'Neural Tile Purge (1/visit)',
    clinicPurgeDesc: 'Permanently delete 1 innate or Dud tile.',
    purgeTileAction: 'Purge Tile',
    purgedDoneLabel: 'Tile purged this visit.',
    characters: {
      kira: {
        code: 'KIRA-09',
        name: 'Kira',
        title: 'Plasma Vanguard',
        weapon: '58 HP · 45 CR · 12 MEM · Predictive Aim.AI + Auto-Suture.AI',
        passive: 'Held +1 ATK/DEF · TECH +20% OD',
        overdriveName: 'Plasma Blitz',
        overdriveDesc: '20 Pierce All · +30% DMG · +6 Shield',
        summary: 'Held +1 ATK/DEF · Fast Overdrive chains',
      },
      aurelia: {
        code: 'AURALINE-07',
        name: 'Auraline',
        title: 'Armored Juggernaut',
        weapon: '78 HP · 18 Armor · 35 CR · 14 MEM · Impact Solver.AI + Sovereign Ward.AI',
        passive: 'Start +18 Armor · +1 UpCharge per Dud',
        overdriveName: 'Sovereign Broadside',
        overdriveDesc: '20 Pierce All · +10 Armor · +2 UpCharge',
        summary: 'Starts +18 Armor · Duds grant UpCharge',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Solar Swarm Commander',
        weapon: '62 HP · 50 CR · 13 MEM · Swarm Vector.AI + Sanctuary Mesh.AI',
        passive: 'TECH +25% OD · Shred Armor & Shield',
        overdriveName: 'Solar Swarm Protocol',
        overdriveDesc: '16 Pierce All · -12 Armor All · Shield',
        summary: 'Shreds Armor · TECH +25% OD · Hybrid',
      },
    },
    enemyPassives: {
      volatile_burst: {
        archetype: 'The Chaff · Volatile Fodder',
        name: 'Bio-Rupture',
        rule: 'Death deals **6 Pierce DMG** to all mutants.',
        counter: '**Push** near armored units to chain-burst.',
      },
      anchor_aegis: {
        archetype: 'The Anchor · Positional Support',
        name: 'Aegis Projection',
        rule: '**1 Aegis Pip**. Grants **+4 Armor** all.',
        counter: 'Crack **Pip**, then trigger **Attack Surge**.',
      },
      time_bomb: {
        archetype: 'The Time-Bomb · Countdown Threat',
        name: 'Thermal Detonation',
        rule: 'Charges 2 turns. **16+ Stagger** cancels blast.',
        counter: 'Deal **16+ DMG** or **Push** with [R].',
      },
      spike_retaliate: {
        archetype: 'The Punisher · Rule Modifier',
        name: 'Thorny Carapace',
        rule: '**Retaliates 3 DMG**. +4 DMG at 0 Shield.',
        counter: 'Use **Surge (4+)** and keep **1+ Shield**.',
      },
      acid_jam: {
        archetype: 'The Disrupter · Pustule & Hazard',
        name: 'Pustule Rupture & Caustic Hex',
        rule: 'Non-Surge hit sprays **+2 Corrode**. Jams tile.',
        counter: 'Use **Surge** or **TECH**. Block with **Shield**.',
      },
      threshold_pip: {
        archetype: 'Heavy Anchor · 2-Slot Juggernaut',
        name: 'Mutagen Carapace',
        rule: '**1 Pip**, Mutagen Brace. 16+ Stagger stops Heavy.',
        counter: 'Crack **Pip** first, then burst with **Surge**.',
      },
      phase_gate: {
        archetype: 'Apex Sovereign · Phase Lock',
        name: '50% Phase Carapace & Hex',
        rule: 'Locks at 55 HP. Beat 2 taxes Attack.',
        counter: 'Trigger Gate safely. Cleanse Hex with **Overdrive**.',
      },
    },
    enemies: {
      larva: {
        name: 'Spore Mite',
        classification: 'The Chaff · Volatile Scout',
        bioNote: 'Volatile frontline. Explodes for **6 Pierce DMG** on death.',
      },
      skitter: {
        name: 'Cobalt Skitter',
        classification: 'The Anchor · Aegis Support',
        bioNote: 'Has **1 Aegis Pip**. Shields allies. Enrages alone.',
      },
      stinger: {
        name: 'Pyre Stinger',
        classification: 'The Time-Bomb · Thermal Striker',
        bioNote: 'Charges 2 turns for **16 DMG**. **16+ Staggers** it.',
      },
      stalker: {
        name: 'Chitin Stalker',
        classification: 'The Punisher · Spike Predator',
        bioNote: 'Retaliates for **3 DMG**. +4 DMG at 0 Shield.',
      },
      spitter: {
        name: 'Bile Spitter',
        classification: 'The Disrupter · Pustule Artillery',
        bioNote: 'Pustules spray **+2 Corrode**. Jams tiles with Acid.',
      },
      brute: {
        name: 'Carapace Brute',
        classification: 'Heavy Anchor · 2-Slot Juggernaut',
        bioNote: 'Two slots. **1 Pip**, mutagen heals, **14 DMG** crush.',
      },
      boss: {
        name: 'Xenomorph Matriarch',
        classification: 'Apex Sovereign · Phase Boss',
        bioNote: '**50% Phase Lock**. Taxes Attacks. Casts Hexes.',
      },
    },
    implants: {
      monowire_edge: {
        name: 'Mono-Wire Edge',
        desc: '**Held Attack** gains **+2 DMG**.',
      },
      aegis_capacitor: {
        name: 'Aegis Capacitor',
        desc: '**Retain 50% Shield** next round.',
      },
      synapse_overclock: {
        name: 'Synapse Overclock',
        desc: '**TECH** grants **+3 Shield** per tile.',
      },
      kinetic_reflector: {
        name: 'Kinetic Reflector',
        desc: '**Block** reflects **3 DMG** back.',
      },
      plasma_amp: {
        name: 'Plasma Amplifier',
        desc: 'All **Attack** deals **+2 DMG**.',
      },
      nano_weave: {
        name: 'Nano-Weave Plating',
        desc: 'All **Defense** grants **+2 Shield**.',
      },
      surge_resonator: {
        name: 'Surge Resonator',
        desc: '**Surge** triggers at **3+ tiles**.',
      },
      bio_siphon: {
        name: 'Bio-Siphon Core',
        desc: '**Kill** restores **+4 HP**.',
      },
      flux_injector: {
        name: 'Flux Injector',
        desc: '**TECH** grants **+10% Overdrive**.',
      },
      piercing_katana: {
        name: 'Phase-Blade Emitter',
        desc: '**Attack** has **30% Armor Pierce**.',
      },
    },
    equipment: {
      pistole_aretta: {
        name: 'Predictive Aim.AI',
        desc: '⚔ **+5 ATK ×2** · 🛡 **+7 SHD**.',
      },
      minilekarnicka: {
        name: 'Auto-Suture.AI',
        desc: '⚡ **TECH +3 HP** · Bio-repair routine.',
      },
      dvojita_brokovnice: {
        name: 'Impact Solver.AI',
        desc: '⚔ **+6 ATK ×2** · Heavy strike routine.',
      },
      kralovsky_diadem: {
        name: 'Sovereign Ward.AI',
        desc: '🛡 **+7 SHD** · Core defensive firewall.',
      },
      utocny_dron_sokol: {
        name: 'Swarm Vector.AI',
        desc: '⚔ **+6 ATK** · ⚔ **+5 ATK**.',
      },
      stito_dron_ankh: {
        name: 'Sanctuary Mesh.AI',
        desc: '🛡 **+8 SHD** · ⚡ **TECH +4 HP**.',
      },
      karabin_vx: {
        name: 'Volley Matrix.AI',
        desc: '⚔ **+7 ATK ×2** · ⚔ **+5 ATK**.',
      },
      takticky_stit: {
        name: 'Zero-Trust Wall.AI',
        desc: '🛡 **+9 SHD ×2** · High-block firewall.',
      },
      stim_injektor: {
        name: 'Trauma Patch.AI',
        desc: '⚡ **TECH +5 HP** · 🛡 **+6 SHD**.',
      },
      takticky_zesilovac: {
        name: 'Kill-Chain Amp.AI',
        desc: '⚡ **+42% DMG** · ⚔ **+5 ATK**.',
      },
      tezka_brokovnice: {
        name: 'Apex Overwhelm.AI',
        desc: '⚔ **+9 ATK ×2** · 🛡 **+7 SHD**.',
      },
      nano_ostri: {
        name: 'Surgical Cut.AI',
        desc: '⚔ **+7 ATK** · ⚔ **+6 ATK**.',
      },
      kryo_kondenzator: {
        name: 'System Scrub.AI',
        desc: '⚡ **+15% OD** · **-2 COR** · 🛡 **+6 SHD**.',
      },
      pulzni_kuse: {
        name: 'Armor Crack.AI',
        desc: '⚔ **+8/+6 ATK** · ⚡ **-10 ARM** · **+4 Pierce**.',
      },
      energeticky_konvertor: {
        name: 'Flux Rebalance.AI',
        desc: '⚡ **+5 SHD/+22% DMG** · ⚔ **+5 ATK**.',
      },
      reaktivni_pancir: {
        name: 'Adaptive Guard.AI',
        desc: '🛡 **+10/+8 SHD** · ⚔ **+6 ATK**.',
      },
      upcharge_pulse_chip: {
        name: 'Tempo Feed.AI',
        desc: '⚔ **+5 ATK (⚡1)** · 🛡 **+6 SHD**.',
      },
      tactical_upcharge_chip: {
        name: 'Synapse Loop.AI',
        desc: '⚡ **+3 HP (⚡1)** · ⚔ **+6 ATK**.',
      },
      neural_surge_chip: {
        name: 'Hyper-Thread.AI',
        desc: '⚡ **+10% OD/-1 COR (⚡2)** · 🛡 **+8 (⚡1)**.',
      },
      caustic_blight: {
        name: 'Bio-Hazard',
        desc: '☣ **Slag**: -2 HP round end · Cleanse TECH.',
      },
    },
    nodes: {
      COMBAT: 'Mutant Skirmish',
      ELITE: 'Elite Abomination',
      CYBER_CLINIC: 'Cyber-Clinic',
      CHIP_DEALER: 'Chip Dealer',
      MED_BAY: 'Bio-Med Bay',
      EVENT: 'Mystery Anomaly (?)',
      BOSS: 'Hive Matriarch',
    },
    nodeDescs: {
      COMBAT: 'Mutant patrol. Rewards **Credits** & **AI Chips**.',
      ELITE: 'Armored threat. Rewards **AI Chip** & **Clinic**.',
      CYBER_CLINIC: 'Draft **1 Implant**. Purge 1 tile.',
      CHIP_DEALER: 'Buy **AI Chips**. Manage memory.',
      MED_BAY: 'Repair **HP**. Overclock tiles. Salvage.',
      EVENT: 'Explore cache, rogue AI, or trader.',
      BOSS: 'Sector Hive Queen apex confrontation.',
    },
  },
  cs: {
    startRun: 'Spustit misi',
    continueRun: 'Pokračovat v misi',
    newRun: 'Nová mise',
    selectOperativeLabel: 'Výběr operativky',
    controlsHint: 'F Celá obrazovka · P Pauza · M Zvuk · L Jazyk',
    howToPlay: {
      title: 'Jak hrát',
      badge: 'Základy boje',
      goal: 'Probojuj se sektorem až ke Královně úlu: v každém tahu zvolíš ze 6 dílků na liště 1 barvu a spustíš všechny její dílky najednou.',
      step1Title: '1. Zvol 1 barvu za tah',
      step1Desc: 'Stiskni [1], [2], [3] nebo klikni na barvu a aktivuj VŠECHNY její dílky na desce. Nezvolené dílky zůstávají držené do dalšího tahu.',
      step2Title: '2. Tři typy dílků',
      attackLabel: '◆ Útok (Červená)',
      attackDesc: 'Zasáhne předního nepřítele a proráží štíty.',
      defenseLabel: '● Obrana (Tyrkysová)',
      defenseDesc: 'Vytvoří dočasný štít proti útokům nebo obnoví zdraví.',
      techLabel: '▲ TECH (Zlatá)',
      techDesc: 'Posílí příští útok, drtí brnění a rychle nabíjí Overdrive.',
      step3Title: '3. Přetížení (4+) a Overdrive',
      step3Desc: 'Šetři stejnou barvu přes tahy: 4+ dílky spustí Přetížení (+40 % síly). Při 100 % Overdrive stiskni [Mezerník] pro ultimátní akci zdarma.',
      step4Title: '4. Prohoz [R] a mapa sektoru',
      step4Desc: 'Klávesou [R] můžeš 1× za tah prohodit přední dva nepřátele. Mezi boji plánuj trasu přes kliniky, prodejce čipů a ošetřovny.',
    },
    hpLabel: 'Zdraví',
    shieldLabel: 'Štít',
    creditsLabel: 'CR',
    capacityLabel: 'Paměť',
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
    shredShort: 'DRCENÍ',
    odShort: 'OD',
    aegisShort: 'ŠTÍT+',
    allShort: 'VŠEM',
    allTargetsLabel: 'Všem spojencům',
    pipShort: 'PIP',
    pipLabel: 'Aegis Pip',
    pipCrackLabel: 'PRASKNE PIP',
    phaseGateLabel: '50% FÁZOVÝ ZÁMEK',
    bioBurstLabel: '+6 BIO-EXPLOZE VŠEM',
    retaliateLabel: '3 ODPLATA',
    staggeredTag: '⚡ OMRÁČEN',
    staggerPreviewLabel: '⚡ OMRÁČÍ!',
    enragedAloneTag: 'ZUŘÍ +2',
    hexTag: '⬡ KLETBA',
    blightTag: '☣ STRUSKA',
    purgeLabel: 'SPÁLIT',
    condBonusLabel: 'PODM.',
    innateLabel: 'Vrozené jádro',
    surgeLabel: 'PŘETÍŽENÍ',
    surgeAttackEffect: 'Rozbití brnění + 50% rozmach',
    surgeDefenseEffect: 'Odraz 8 DMG při bloku',
    surgeTechEffect: '+15 % Overdrive a +6 Štít',
    discardPoolLabel: 'Cyklus',
    poolTotalLabel: 'Aktivní pool',
    nextDrawLabel: 'Příští dílky',
    previewNoTiles: 'Na desce není žádný dílek této barvy.',
    previewStayCount: 'zůstane příští tah',
    previewDamage: 'DMG přednímu cíli',
    previewCleave: 'DMG rozmach',
    previewPierce: '30% průraz brněním',
    previewShield: 'Získaný štít',
    previewDamageBoostAdded: 'Posílení útoku (-10 %/kolo)',
    previewHeal: 'Obnovené zdraví',
    previewOverdrive: 'Overdrive',
    previewArmorShred: 'Drcení brnění (všem)',
    previewTechPierce: 'Průrazné DMG vpředu',
    previewCorrodeCleanse: 'Očištěná koroze',
    previewSurgeTriggered: 'Přetížení aktivní',
    armorLabel: 'Brnění',
    armorShort: 'BRN',
    corrodeLabel: 'Koroze',
    corrodeShort: 'KOR',
    lethalLabel: 'ZABITÍ',
    armorBreakLabel: 'Rozbití brnění',
    implantsTitle: 'Kybernetické implantáty',
    noImplants: 'Žádné implantáty',
    implantSlotsLabel: 'Implantáty',
    inspectPool: 'Čipy a Pool',
    poolModalTitle: 'AI dovednosti a aktivní pool',
    poolModalDesc: '{name} kombinuje vrozené dílky s nainstalovanými AI čipy do kapacity {capacity} RAM.',
    equippedGearTitle: 'Nainstalované AI čipy',
    cargoStashTitle: 'Trezor čipů',
    noCargoStash: 'V trezoru zatím nemáš žádné náhradní AI čipy.',
    noEquippedGear: 'Žádné AI čipy nejsou nainstalované (jen vrozené dílky).',
    equipAction: 'Nainstalovat',
    unequipAction: 'Odinstalovat',
    scrapAction: 'Rozebrat',
    capacityFullWarning: 'Nedostatek paměti RAM',
    combatSwapLocked: 'Během boje nelze AI čipy přeinstalovat.',
    sizeLabel: 'RAM',
    closeLabel: 'Zavřít',
    synchronizingStage: 'Synchronizace scény...',
    pause: 'Pauza',
    pauseTitle: 'Mise pozastavena',
    resume: 'Pokračovat',
    restart: 'Restartovat misi',
    returnTitle: 'Hlavní obrazovka',
    mute: 'Ztlumit zvuk',
    unmute: 'Zapnout zvuk',
    landscapeToggle: 'Na šířku',
    portraitToggle: 'Na výšku',
    fullscreenEnter: 'Celá obrazovka',
    fullscreenExit: 'Ukončit režim',
    tacticalInfoButton: 'Info',
    passiveLabel: 'Pravidlo',
    victoryTitle: 'Sektor vyčištěn',
    victorySubtitle: 'Xenomorfní Matriarcha padla a nebeský most Nové Prahy je volný.',
    defeatTitle: 'Signál ztracen',
    defeatSubtitle: '{name} utrpěla kritické poškození při průlomu v konzervatoři.',
    combatVictory: 'Mutanti zneškodněni',
    combatLootPrompt: 'Vyber si 1 získaný AI čip dovednosti (nebo jej rozeber za +15 CR):',
    claimEquipment: 'Vzít čip',
    salvageForCredits: 'Rozebrat (+15 CR)',
    continueToMap: 'Otevřít mapu sektoru',
    playAgain: 'Hrát znovu',
    tryAgain: 'Zkusit znovu',
    scoreLabel: 'Skóre',
    bestScoreLabel: 'Nejlepší skóre',
    sectorsClearedLabel: 'Vyčištěné sektory',
    enemiesDefeatedLabel: 'Zneškodněno mutantů',
    turnsLabel: 'Tahy',
    damageDealtLabel: 'Udělené poškození',
    heatLowLabel: 'KLIDNÉ TEMPO',
    heatMediumLabel: 'POSILY',
    heatOvertimeLabel: 'PŘESČAS',
    parCachePrefix: 'T',
    tempoTip: 'Zraňuj nepřátele každý tah za bonusové kredity (+2 CR/tah, max +8 CR).',
    inboundDropLabel: 'VÝSADEK',
    dropZeroDmgRule: '0 DMG v tahu dopadu',
    dropReasonThreat: 'VLNA HROZBY',
    dropReasonReactive: 'REAKTIVNÍ',
    dropReasonAdaptive: 'ADAPTIVNÍ',
    dropReasonSos: 'SOS SIGNÁL',
    dropReasonSweeper: 'ČISTIČ',
    dropRubberBandDelayed: 'ODLOŽENO (+1T)',
    sosFlareBadgeLabel: 'SOS',
    zeroRewardBadgeLabel: '0 CR',
    fastClearBonusLabel: 'Bonus za rychlé vyčištění',
    baseLootLabel: 'Základ',
    parBonusLabel: 'Par schránky',
    tempoBonusLabel: 'Tempo',
    sectorMapTitle: 'Mapa sektoru',
    layerLabel: 'Úsek',
    nodeLocked: 'Uzamčeno',
    enterNode: 'Vstoupit',
    mapAdviceLowHp: 'Nízké zdraví — zamiř na Bio-ošetřovnu (+22 HP).',
    mapAdviceElite: 'Plná kondice — vyraž na Elitní zrůdu pro AI čip a Kyber-kliniku.',
    mapAdviceClinic: 'Před tebou je Kyber-klinika — nasaď implantát nebo smaž slepý dílek.',
    mapAdviceBoss: 'Vnější mosty jsou volné — čeká tě Královna úlu v 5. úseku.',
    mapAdviceCombat: 'Zlikviduj hlídku mutantů za kredity a nové AI čipy.',
    mapRewardImplant: 'Implantáty a čistka dílků',
    mapRewardElite: 'AI čip + Kyber-klinika',
    mapRewardMedbay: '+22 HP / +10 Max / CR',
    mapRewardCombat: '+CR a AI čip',
    mapRewardBoss: 'Osvobození sektoru',
    mapLoadoutStatus: 'Čipy',
    mapOpensNext: 'Otevírá další úsek',
    clinicTitle: 'Kyber-klinika',
    clinicSubtitle: 'Vyber **1 implantát** nebo smaž 1 dílek.',
    clinicSelectPrompt: 'Vyber si **1 kyber-implantát**',
    clinicReplacePrompt: 'Sloty jsou plné. Zvol implantát k nahrazení:',
    clinicShopTitle: 'Nabídka AI čipů',
    clinicShopEmpty: 'Všechny dostupné AI čipy jsou vykoupené.',
    restockShop: 'Obnovit nabídku',
    buyEquipment: 'Koupit čip',
    notEnoughCredits: 'Málo CR',
    installImplant: 'Nainstalovat modul',
    replaceSlot: 'Nahradit slot',
    skipClinic: 'Opustit kliniku',
    rarityCommon: 'Standardní',
    rarityRare: 'Prototyp',
    medbayTitle: 'Bio-ošetřovna',
    medbaySubtitle: '**Oprav HP**, posil tělo nebo recykluj.',
    medbayHealTitle: 'Nano-bio oprava',
    medbayHealDesc: 'Okamžitě **obnoví +22 HP**.',
    medbayCalibrateTitle: 'Zpevnění schránky',
    medbayCalibrateDesc: '**+10 Max HP** a léčení +10 HP.',
    medbaySalvageTitle: 'Recyklace součástek',
    medbaySalvageDesc: '**+35 Kreditů** z přebytečných dílů.',
    medbayOverclockTitle: 'Neurální přetaktování',
    medbayOverclockDesc: '**+1 ATK** na 2 dílky · **+20% OD**.',
    medbayExtractTitle: 'Přivolat evakuační raketoplán',
    medbayExtractDesc: '**Uloží Nanity i Kredity**. Bezpečný odlet.',
    applyRepair: 'Obnovit +22 HP',
    applyCalibrate: '+10 Max HP',
    applySalvage: 'Získat +35 CR',
    applyOverclock: 'Přetaktovat dílky',
    applyExtract: 'Přivolat raketoplán',
    medbayNurseName: 'Dr. Amara Vance',
    medbayNurseRole: 'Vrchní bio-medička',
    medbayNurseIdleNominal: 'Životní funkce v normě. Připravena k přetaktování.',
    medbayNurseIdleCritical: 'Kritické zranění! Regenerační nano-gel je připraven.',
    medbayNurseHoverHeal: '**Obnoví +22 HP** buněčnou regenerací.',
    medbayNurseHoverCalibrate: 'Trvale **+10 Max HP**.',
    medbayNurseHoverSalvage: '**+35 Kreditů** připraveno k výplatě.',
    medbayNurseHoverOverclock: '**+1 ATK** na 2 útočné dílky · **+20% OD**.',
    medbayNurseHoverExtract: 'Bezpečná evakuace. **Uloží 100% Nanitů a Kreditů**.',
    nanitesLabel: 'Nanity',
    nanitesShort: 'NC',
    bountyGoldenBadge: '★ ODMĚNA +50 % CR',
    bountyDoubleBadge: '2× KREDITY',
    bountyNaniteBadge: '◆ NANITY +2',
    bountyOverchargedBadge: '⚡ PŘETÍŽENO (+1 NC)',
    bountyFlashSaleBadge: '🏷 BLESKOVÁ SLEVA (-35 % CR)',
    bountyFundedClinicBadge: '✦ DOTACE (+12 HP BONUS)',
    laneArchetypeGauntlet: 'CESTA ZKOUŠKY',
    laneArchetypeMercenary: 'ŽOLDNÉŘSKÁ TRASA',
    laneArchetypeGambler: 'LÁVKA HAZARDÉRA',
    laneGauntletDesc: 'Vysoké riziko · Elitní kořist · Záchranná ošetřovna',
    laneMercenaryDesc: 'Stálý boj · Maximum kreditů · Nákup AI čipů',
    laneGamblerDesc: 'Anomálie a obchody · Šetrnější tempo boje',
    laneShortPrefix: 'TRASA',
    mapRiskShort: 'Riziko HP',
    mapAnomalyLabel: 'ANOMÁLIE (?)',
    mapMultiHopLabel: 'Plánovaná trasa',
    mapHpRecoveryLabel: 'Obnova HP',
    defibArmedLabel: 'DEFIB: AKTIVNÍ (+15 % HP ≤15 %)',
    defibDischargedLabel: 'DEFIB: VYBITÝ',
    fundedClinicAllActionsNote: 'Dotovaná ošetřovna: **+12 HP bonus** ke všem volbám.',
    fundedBonusHpTag: '+12 HP dotace',
    reconPreviewPrefix: 'PRŮZKUM',
    tensionLabel: 'Riziko',
    yieldLabel: 'Výnos',
    oppCostLabel: 'Obětovaná šance',
    greedyClinicNotice: 'Plné zdraví: investuj do přetaktování či kreditů.',
    opportunityCostNotice: 'Kritický stav: k přežití potřebuješ opravu.',
    abstinenceBonusLabel: 'Žoldnéřský bonus (série)',
    emergencyDefibTriggered: 'NOUZOVÝ DEFIBRILÁTOR: Výboj okamžitě obnovil +15 % HP!',
    reconActiveBadge: 'PRŮZKUM AKTIVNÍ',
    shopAffordable: 'MÁŠ NA NÁKUP',
    shopLowCredits: 'MÁLO KREDITŮ',
    eventViewTitle: 'UDÁLOST V KYBER-SÍTI',
    eventExecuteChoice: 'Potvrdit volbu',
    eventCriticalHp: 'Kritické HP',
    upchargeShort: 'UC',
    upchargeLabel: 'Nabití',
    dudTag: 'SLEPÝ',
    chipDealerTitle: 'Prodejce čipů',
    chipDealerSubtitle: 'Nakup **AI čipy dovedností** za kredity.',
    skipChipDealer: 'Opustit prodejce',
    clinicPurgeTitle: 'Čistka vrozeného dílku (1× za návštěvu)',
    clinicPurgeDesc: 'Trvale smaž 1 vrozený či Slepý dílek.',
    purgeTileAction: 'Smazat dílek',
    purgedDoneLabel: 'Dílek v této návštěvě smazán.',
    characters: {
      kira: {
        code: 'KIRA-09',
        name: 'Kira',
        title: 'Plazmová útočnice',
        weapon: '58 HP · 45 CR · 12 RAM · Predikce zásahu.AI + Autoregenerace.AI',
        passive: 'Držené +1 ATK/DEF · TECH +20% OD',
        overdriveName: 'Plazmový výpad',
        overdriveDesc: '20 Průraz všem · +30% DMG · +6 Štít',
        summary: 'Držené +1 ATK/DEF · Rychlý Overdrive',
      },
      aurelia: {
        code: 'AURALINE-07',
        name: 'Auraline',
        title: 'Obrněný kolos',
        weapon: '78 HP · 18 Brnění · 35 CR · 14 RAM · Drtivý výpočet.AI + Obranná záštita.AI',
        passive: 'Start +18 Brnění · +1 Nabití za Slepý',
        overdriveName: 'Královská salva',
        overdriveDesc: '20 Průraz všem · +10 Brnění · +2 Nabití',
        summary: 'Start +18 Brnění · Slepé dávají Nabití',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Velitelka solárního roje',
        weapon: '62 HP · 50 CR · 13 RAM · Rojový vektor.AI + Ochranná síť.AI',
        passive: 'TECH +25% OD · Drcení brnění a Štít',
        overdriveName: 'Protokol Solární roj',
        overdriveDesc: '16 Průraz všem · -12 Brnění všem · Štít',
        summary: 'Drtí brnění · TECH +25% OD · Hybrid',
      },
    },
    enemyPassives: {
      volatile_burst: {
        archetype: 'Pěšák · Výbušný roj',
        name: 'Bio-exploze',
        rule: 'Smrt udělí **6 Průraz DMG** všem mutantům.',
        counter: '**Prohoď** k obrněncům pro řetězový výbuch.',
      },
      anchor_aegis: {
        archetype: 'Kotva · Podpora brnění',
        name: 'Aegis projekce',
        rule: '**1 Aegis Pip**. Přidá **+4 Brnění** všem.',
        counter: 'Praskni **Pip**, pak spusť **Přetížení**.',
      },
      time_bomb: {
        archetype: 'Časovaná bomba · Odpočet',
        name: 'Žárová detonace',
        rule: 'Nabíjí 2 tahy. **16+ DMG** přeruší výboj.',
        counter: 'Zasaď **16+ DMG** nebo **Prohoď** [R].',
      },
      spike_retaliate: {
        archetype: 'Trestající · Modifikátor pravidel',
        name: 'Trnitý krunýř',
        rule: '**Odplata 3 DMG**. +4 DMG bez Štítu.',
        counter: 'Spusť **Přetížení (4+)** a drž **Štít**.',
      },
      acid_jam: {
        archetype: 'Sabotér · Pustuly a kyselina',
        name: 'Žíravé pustuly a Kletba',
        rule: 'Běžný zásah přidá **+2 Koroze**. Blokuje dílek.',
        counter: 'Hraj **Přetížení** či **TECH**. Kryj **Štítem**.',
      },
      threshold_pip: {
        archetype: 'Těžká kotva · Dvouslotový kolos',
        name: 'Mutagenní krunýř',
        rule: '**1 Pip**, Mutagen. **16+ DMG** přeruší těžký.',
        counter: 'Praskni **Pip**, pak udeř **Přetížením**.',
      },
      phase_gate: {
        archetype: 'Vrcholná královna · Fázový zámek',
        name: '50% Fázový krunýř a Kletba',
        rule: 'Fázový zámek (55 HP). 2. fáze trestá Útok.',
        counter: 'Zámek spouštěj opatrně. Kletbu ruší **Overdrive**.',
      },
    },
    enemies: {
      larva: {
        name: 'Spórový roztoč',
        classification: 'Pěšák · Výbušný průzkumník',
        bioNote: 'Výbušný předvoj. Po smrti udělí **6 Průraz DMG**.',
      },
      skitter: {
        name: 'Kobaltový běžec',
        classification: 'Kotva · Aegis podpora',
        bioNote: 'Má **1 Aegis Pip**. Posiluje spojence. Osamocený zuří.',
      },
      stinger: {
        name: 'Žárový žahavec',
        classification: 'Časovaná bomba · Žárový útočník',
        bioNote: 'Nabíjí 2 tahy na **16 DMG**. **16+ DMG** omráčí.',
      },
      stalker: {
        name: 'Chitinový slídič',
        classification: 'Trestající · Trnitý predátor',
        bioNote: 'Odplata **3 DMG**. +4 DMG bez Štítu.',
      },
      spitter: {
        name: 'Žlučový plivač',
        classification: 'Sabotér · Kyselinové dělostřelectvo',
        bioNote: 'Pustuly dávají **+2 Koroze**. Kyselina blokuje dílky.',
      },
      brute: {
        name: 'Krunýřový kolos',
        classification: 'Těžká kotva · Dvouslotový kolos',
        bioNote: 'Dva sloty. **1 Pip**, mutagen léčí, **14 DMG** drtí.',
      },
      boss: {
        name: 'Xenomorfní Matriarcha',
        classification: 'Vrcholná královna · Fázový boss',
        bioNote: '**50% Fázový zámek**. Trestá Útok. Sesílá Kletby.',
      },
    },
    implants: {
      monowire_edge: {
        name: 'Monovláknové ostří',
        desc: '**Držený Útok** získá **+2 DMG**.',
      },
      aegis_capacitor: {
        name: 'Kondenzátor Aegis',
        desc: '**Uchová 50% Štítu** do dalšího kola.',
      },
      synapse_overclock: {
        name: 'Synaptické přetaktování',
        desc: '**TECH** přidá **+3 Štít** za dílek.',
      },
      kinetic_reflector: {
        name: 'Kinetický reflektor',
        desc: '**Blok** vrátí **3 DMG** útočníkovi.',
      },
      plasma_amp: {
        name: 'Plazmový zesilovač',
        desc: 'Všechny **Útoky** mají **+2 DMG**.',
      },
      nano_weave: {
        name: 'Nanovláknová zbroj',
        desc: 'Všechny **Obrany** mají **+2 Štít**.',
      },
      surge_resonator: {
        name: 'Rezonátor přetížení',
        desc: '**Přetížení** se spouští od **3+ dílků**.',
      },
      bio_siphon: {
        name: 'Bio-sifonové jádro',
        desc: '**Zabití** obnoví **+4 HP**.',
      },
      flux_injector: {
        name: 'Fluxový injektor',
        desc: '**TECH** přidá **+10% Overdrive**.',
      },
      piercing_katana: {
        name: 'Fázový emitor čepele',
        desc: '**Útok** má **30% Průraz** brněním.',
      },
    },
    equipment: {
      pistole_aretta: {
        name: 'Predikce zásahu.AI',
        desc: '⚔ **+5 Útok ×2** · 🛡 **+7 Štít**.',
      },
      minilekarnicka: {
        name: 'Autoregenerace.AI',
        desc: '⚡ **TECH +3 HP** · Bio-opravná rutina.',
      },
      dvojita_brokovnice: {
        name: 'Drtivý výpočet.AI',
        desc: '⚔ **+6 Útok ×2** · Silná útočná rutina.',
      },
      kralovsky_diadem: {
        name: 'Obranná záštita.AI',
        desc: '🛡 **+7 Štít** · Základní štítový firewall.',
      },
      utocny_dron_sokol: {
        name: 'Rojový vektor.AI',
        desc: '⚔ **+6 Útok** · ⚔ **+5 Útok**.',
      },
      stito_dron_ankh: {
        name: 'Ochranná síť.AI',
        desc: '🛡 **+8 Štít** · ⚡ **TECH +4 HP**.',
      },
      karabin_vx: {
        name: 'Matice salvy.AI',
        desc: '⚔ **+7 Útok ×2** · ⚔ **+5 Útok**.',
      },
      takticky_stit: {
        name: 'Firewall hradba.AI',
        desc: '🛡 **+9 Štít ×2** · Silný obranný blok.',
      },
      stim_injektor: {
        name: 'Krizová záplata.AI',
        desc: '⚡ **TECH +5 HP** · 🛡 **+6 Štít**.',
      },
      takticky_zesilovac: {
        name: 'Násobič síly.AI',
        desc: '⚡ **+42% DMG** · ⚔ **+5 Útok**.',
      },
      tezka_brokovnice: {
        name: 'Totální průlom.AI',
        desc: '⚔ **+9 Útok ×2** · 🛡 **+7 Štít**.',
      },
      nano_ostri: {
        name: 'Přesný řez.AI',
        desc: '⚔ **+7 Útok** · ⚔ **+6 Útok**.',
      },
      kryo_kondenzator: {
        name: 'Systémová očista.AI',
        desc: '⚡ **+15% OD** · **-2 KOR** · 🛡 **+6 Štít**.',
      },
      pulzni_kuse: {
        name: 'Lamač pancíře.AI',
        desc: '⚔ **+8/+6 Útok** · ⚡ **-10 BRN** · **+4 Průraz**.',
      },
      energeticky_konvertor: {
        name: 'Převodník toku.AI',
        desc: '⚡ **+5 Štít/+22% DMG** · ⚔ **+5 Útok**.',
      },
      reaktivni_pancir: {
        name: 'Adaptivní krytí.AI',
        desc: '🛡 **+10/+8 Štít** · ⚔ **+6 Útok**.',
      },
      upcharge_pulse_chip: {
        name: 'Smyčka tempa.AI',
        desc: '⚔ **+5 Útok (⚡1)** · 🛡 **+6 Štít**.',
      },
      tactical_upcharge_chip: {
        name: 'Synaptický impuls.AI',
        desc: '⚡ **+3 HP (⚡1)** · ⚔ **+6 Útok**.',
      },
      neural_surge_chip: {
        name: 'Hyper-vlákno.AI',
        desc: '⚡ **+10% OD/-1 KOR (⚡2)** · 🛡 **+8 (⚡1)**.',
      },
      caustic_blight: {
        name: 'Bio-odpad',
        desc: '☣ **Struska**: -2 HP/kolo · Spálí TECH.',
      },
    },
    nodes: {
      COMBAT: 'Střet s mutanty',
      ELITE: 'Elitní zrůda',
      CYBER_CLINIC: 'Kyber-klinika',
      CHIP_DEALER: 'Prodejce čipů',
      MED_BAY: 'Bio-ošetřovna',
      EVENT: 'Záhadná anomálie (?)',
      BOSS: 'Královna úlu',
    },
    nodeDescs: {
      COMBAT: 'Hlídka mutantů. Odměna **Kredity** a **AI čipy**.',
      ELITE: 'Obrněná hrozba. Odměna **AI čip** a **Klinika**.',
      CYBER_CLINIC: 'Vyber **1 implantát**. Smaž 1 dílek.',
      CHIP_DEALER: 'Kup **AI čipy**. Spravuj paměť.',
      MED_BAY: 'Oprav **HP**. Přetaktuj dílky. Kredity.',
      EVENT: 'Prozkoumej schránku, AI či překupníka.',
      BOSS: 'Finální střet s Královnou úlu.',
    },
  },
};
