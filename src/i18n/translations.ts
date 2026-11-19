import type { CharacterId, EnemyPassiveKind } from '../engine/types';

export type Language = 'en' | 'cs';

export interface TranslationPack {
  gameSubtitle: string;
  startRun: string;
  continueRun: string;
  newRun: string;
  selectOperativeLabel: string;
  controlsHint: string;
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
    gameSubtitle: 'Resolve 1 tile type per turn · Combine AI Skill Chips & TECH boosts · Purge the sky-bridge',
    startRun: 'Start Run',
    continueRun: 'Continue Run',
    newRun: 'New Run',
    selectOperativeLabel: 'Select Operative',
    controlsHint: '1/2/3 Select Type · Space Overdrive · F Fullscreen · P Pause · M Mute · L Language',
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
        weapon: '58 HP · 45 CR · 12 Mem · Aretta.AI + Triage.AI',
        passive: 'Held +1 ATK/DEF · TECH +20% OD',
        overdriveName: 'Plasma Blitz',
        overdriveDesc: '20 Pierce All · +30% DMG · +6 Shield',
        summary: 'Held +1 ATK/DEF · Fast Overdrive chains',
      },
      aurelia: {
        code: 'AURALINE-07',
        name: 'Auraline',
        title: 'Slow Juggernaut',
        weapon: '78 HP · 18 Armor · 35 CR · 14 Mem · 3 Duds (1/color)',
        passive: 'Start +18 Armor · +1 UpCharge per Dud',
        overdriveName: 'Sovereign Broadside',
        overdriveDesc: '20 Pierce All · +10 Armor · +2 UpCharge',
        summary: 'Starts +18 Armor · Duds grant UpCharge',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Solar Swarm Commander',
        weapon: '62 HP · 50 CR · 13 Mem · Falcon.AI + Ankh.AI',
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
        name: 'Aretta Targeting.AI',
        desc: '⚔ **+5 ATK ×2** · 🛡 **+7 SHD**.',
      },
      minilekarnicka: {
        name: 'Nano-Triage.AI',
        desc: '✚ **+3 HP** · ⚡ **+15% OD**.',
      },
      dvojita_brokovnice: {
        name: 'Siege Salvo.AI',
        desc: '⚔ **+6 ATK ×2** · 🛡 **+6 SHD**.',
      },
      kralovsky_diadem: {
        name: 'Bastion Core.AI',
        desc: '✚ **+4 HP** · 🛡 **+7 SHD**.',
      },
      utocny_dron_sokol: {
        name: 'Falcon Strike.AI',
        desc: '⚔ **+6 ATK** · ⚔ **+5 ATK**.',
      },
      stito_dron_ankh: {
        name: 'Ankh Barrier.AI',
        desc: '✚ **+4 HP** · 🛡 **+8 SHD**.',
      },
      karabin_vx: {
        name: 'VX Barrage.AI',
        desc: '⚔ **+7 ATK ×2** · ⚔ **+5 ATK**.',
      },
      takticky_stit: {
        name: 'Aegis Bulwark.AI',
        desc: '🛡 **+9 SHD ×2** Fortress.',
      },
      stim_injektor: {
        name: 'Bio-Stim.AI',
        desc: '✚ **+5 HP** · 🛡 **+6 SHD**.',
      },
      takticky_zesilovac: {
        name: 'Overclock Amp.AI',
        desc: '⚡ **+42% ATK** · ⚔ **+5 ATK**.',
      },
      tezka_brokovnice: {
        name: 'Breacher Heavy.AI',
        desc: '⚔ **+9 ATK ×2** · 🛡 **+7 SHD**.',
      },
      nano_ostri: {
        name: 'Twin-Blade.AI',
        desc: '⚔ **+7 ATK** · ⚔ **+6 ATK**.',
      },
      kryo_kondenzator: {
        name: 'Cryo-Purge.AI',
        desc: '⚡ **+15% OD** · **-2 COR** · 🛡 **+6 SHD**.',
      },
      pulzni_kuse: {
        name: 'ARC Rail.AI',
        desc: '⚡ **-10 ARM ALL** · ⚔ **+8 ATK**.',
      },
      energeticky_konvertor: {
        name: 'Aegis Converter.AI',
        desc: '🛡 **+5 SHD** · ⚡ **+22% ATK** · ⚔ **+5 ATK**.',
      },
      reaktivni_pancir: {
        name: 'Reactive Exo.AI',
        desc: '🛡 **+10 SHD** · 🛡 **+8 SHD** · ⚔ **+6 ATK**.',
      },
      upcharge_pulse_chip: {
        name: 'Pulse Capacitor.AI',
        desc: '⚔ **+5 ATK (⚡1)** · 🛡 **+6 SHD**.',
      },
      tactical_upcharge_chip: {
        name: 'Synapse Feed.AI',
        desc: '✚ **+3 HP (⚡1)** · ⚔ **+6 ATK**.',
      },
      neural_surge_chip: {
        name: 'Hyper-Cache.AI',
        desc: '⚡ **TECH (⚡2)** · 🛡 **+8 SHD (⚡1)**.',
      },
      caustic_blight: {
        name: 'Bio-Hazard',
        desc: '☣ **Slag**: -2 HP round end · Cleanse TECH',
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
    gameSubtitle: 'Aktivuj 1 typ dlaždic za tah · Skládej AI čipy dovedností a TECH efekty · Očisti nebeský most',
    startRun: 'Spustit misi',
    continueRun: 'Pokračovat v misi',
    newRun: 'Nová mise',
    selectOperativeLabel: 'Výběr operativky',
    controlsHint: '1/2/3 Vyber typ · Mezerník Overdrive · F Celá obrazovka · P Pauza · M Zvuk · L Jazyk',
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
    discardPoolLabel: 'Cyklus',
    poolTotalLabel: 'Aktivní pool',
    nextDrawLabel: 'Příští dlaždice',
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
    armorLabel: 'Brnění',
    armorShort: 'BRN',
    corrodeLabel: 'Koroze',
    corrodeShort: 'KOR',
    lethalLabel: 'SMRT',
    armorBreakLabel: 'Průraz brnění',
    implantsTitle: 'Kybernetické implantáty',
    noImplants: 'Žádné implantáty',
    implantSlotsLabel: 'Implantáty',
    inspectPool: 'Čipy a Pool',
    poolModalTitle: 'AI čipy dovedností a aktivní pool',
    poolModalDesc: '{name} kombinuje vrozené dlaždice s AI čipy dovedností do paměti {capacity}.',
    equippedGearTitle: 'Nainstalované AI čipy',
    cargoStashTitle: 'Trezor čipů',
    noCargoStash: 'V trezoru nejsou žádné nenainstalované AI čipy.',
    noEquippedGear: 'Žádné AI čipy (pouze vrozené dlaždice).',
    equipAction: 'Nasadit',
    unequipAction: 'Odebrat',
    scrapAction: 'Sešrotovat',
    capacityFullWarning: 'Nedostatek paměti',
    combatSwapLocked: 'Během boje nelze AI čipy měnit.',
    sizeLabel: 'Paměť',
    closeLabel: 'Zavřít',
    synchronizingStage: 'Synchronizace scény...',
    pause: 'Pauza',
    pauseTitle: 'Mise pozastavena',
    resume: 'Pokračovat',
    restart: 'Restartovat misi',
    returnTitle: 'Hlavní obrazovka',
    mute: 'Ztlumit',
    unmute: 'Zapnout zvuk',
    landscapeToggle: 'Na šířku',
    portraitToggle: 'Na výšku',
    fullscreenEnter: 'Celá obrazovka',
    fullscreenExit: 'Ukončit režim',
    tacticalInfoButton: 'Info',
    passiveLabel: 'Pravidlo zámku',
    victoryTitle: 'Sektor vyčištěn',
    victorySubtitle: 'Xenomorfní Matriarcha padla a nebeský most Nové Prahy je zabezpečen.',
    defeatTitle: 'Signál ztracen',
    defeatSubtitle: '{name} utrpěla kritické poškození při průlomu v konzervatoři.',
    combatVictory: 'Mutanti zneškodněni',
    combatLootPrompt: 'Vyber si 1 získaný AI čip dovedností (nebo sešrotuj za +15 CR):',
    claimEquipment: 'Vzít čip',
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
    heatLowLabel: 'NÍZKÝ ŽÁR',
    heatMediumLabel: 'POSILY',
    heatOvertimeLabel: 'PŘESČAS',
    parCachePrefix: 'T',
    tempoTip: 'Zraňuj nepřátele v po sobě jdoucích tazích pro bonusové CR (+2 CR/tah, max +8 CR).',
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
    sectorMapTitle: 'Mapa trasy sektoru',
    layerLabel: 'Úsek',
    nodeLocked: 'Uzamčeno',
    enterNode: 'Vstoupit',
    mapAdviceLowHp: 'Zdraví pod limitem — zvol trasu k Bio-ošetřovně pro opravu +22 Zdraví.',
    mapAdviceElite: 'Zdraví optimální — zaútoč na Elitní zrůdu pro AI čip + Kyber-kliniku.',
    mapAdviceClinic: 'Blízko je Kyber-klinika — nainstaluj implantát nebo odstraň prázdný dílek.',
    mapAdviceBoss: 'Vnější úseky mostu zajištěny — zaútoč na Královnu úlu v 5. úseku.',
    mapAdviceCombat: 'Vyčisti hlídku mutantů pro zisk kreditů a AI čipů dovedností.',
    mapRewardImplant: 'Implantáty a čistka dílků',
    mapRewardElite: 'AI čip + Kyber-klinika',
    mapRewardMedbay: '+22 HP / +10 Max / CR',
    mapRewardCombat: '+CR a AI čip',
    mapRewardBoss: 'Osvobození sektoru',
    mapLoadoutStatus: 'Čipy',
    mapOpensNext: 'Otevírá v dalším úseku',
    clinicTitle: 'Kyber-klinika',
    clinicSubtitle: 'Instaluj **1 Implantát** nebo smaž 1 dílek.',
    clinicSelectPrompt: 'Dostupné implantáty (vyber 1 pro odchod)',
    clinicReplacePrompt: 'Sloty plné. Vyber 1 k nahrazení:',
    clinicShopTitle: 'Obchod s AI čipy',
    clinicShopEmpty: 'Veškerá nabídka AI čipů vykoupena.',
    restockShop: 'Obnovit čipy',
    buyEquipment: 'Koupit čip',
    notEnoughCredits: 'Málo CR',
    installImplant: 'Instalovat modul',
    replaceSlot: 'Nahradit slot',
    skipClinic: 'Opustit kliniku',
    rarityCommon: 'Standardní',
    rarityRare: 'Prototyp',
    medbayTitle: 'Bio-ošetřovna',
    medbaySubtitle: '**Oprav HP**, zpevni schránku nebo získej kredity.',
    medbayHealTitle: 'Nano-bio oprava',
    medbayHealDesc: 'Okamžitě **obnov +22 Zdraví**.',
    medbayCalibrateTitle: 'Zpevnění schránky',
    medbayCalibrateDesc: '**+10 Max Zdraví** & vyléčí +10 HP.',
    medbaySalvageTitle: 'Recyklace součástek',
    medbaySalvageDesc: '**+35 Kreditů** z přebytečných součástek.',
    medbayOverclockTitle: 'Neurální přetaktování',
    medbayOverclockDesc: '**+1 ATK** na 2 dílky · **+20% OD**.',
    medbayExtractTitle: 'Zavolat evakuační raketoplán',
    medbayExtractDesc: '**Ulož Nanity a Kredity**. Bezpečná evakuace.',
    applyRepair: 'Obnovit +22 Zdraví',
    applyCalibrate: '+10 Max Zdraví',
    applySalvage: 'Získat +35 CR',
    applyOverclock: 'Přetaktovat dílky',
    applyExtract: 'Zavolat raketoplán',
    medbayNurseName: 'Dr. Amara Vance',
    medbayNurseRole: 'Vrchní bio-medička',
    medbayNurseIdleNominal: 'Funkce stabilní. Připraveno k přetaktování schránky.',
    medbayNurseIdleCritical: 'Trauma alert! Regenerační nano-gel připraven k aplikaci.',
    medbayNurseHoverHeal: '**Obnov +22 Zdraví** buněčnou regenerací.',
    medbayNurseHoverCalibrate: '**+10 trvalé Max Zdraví** kapacity.',
    medbayNurseHoverSalvage: '**+35 Kreditů** připraveno na nákup.',
    medbayNurseHoverOverclock: '**+1 ATK** pro 2 útočné dílky · **+20% OD**.',
    medbayNurseHoverExtract: 'Bezpečná evakuace. **Ulož 100% Nanitů a Kreditů**.',
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
    mapAnomalyLabel: 'ANOMÁLIE (?)',
    mapMultiHopLabel: 'Plánovaná trasa',
    mapHpRecoveryLabel: 'Obnova HP',
    defibArmedLabel: 'DEFIB: NABITÝ (+15% HP ≤15%)',
    defibDischargedLabel: 'DEFIB: VYBITÝ',
    fundedClinicAllActionsNote: 'Dotovaná klinika: **+12 HP bonus** pro všechny volby.',
    fundedBonusHpTag: '+12 HP dotace',
    reconPreviewPrefix: 'PRŮZKUM',
    tensionLabel: 'Tenze',
    yieldLabel: 'Výnos',
    oppCostLabel: 'Cena příležitosti',
    greedyClinicNotice: 'Plné zdraví: investuj do Přetaktování či Nanitů.',
    opportunityCostNotice: 'Kritické trauma: nutná oprava pro přežití.',
    abstinenceBonusLabel: 'Žoldnéřský úrok (série)',
    emergencyDefibTriggered: 'NOUZOVÝ DEFIBRILÁTOR: Životní injekce obnovila +15% HP!',
    reconActiveBadge: 'PRŮZKUM AKTIVNÍ',
    shopAffordable: 'DOSTUPNÉ',
    shopLowCredits: 'MÁLO KREDITŮ',
    eventViewTitle: 'UDÁLOST V KYBER-SÍTI',
    eventExecuteChoice: 'Potvrdit volbu',
    eventCriticalHp: 'Kritické HP',
    upchargeShort: 'UC',
    upchargeLabel: 'UpCharge',
    dudTag: 'DUD',
    chipDealerTitle: 'Prodejce čipů',
    chipDealerSubtitle: 'Nakup **AI Čipy** za kredity.',
    skipChipDealer: 'Opustit prodejce',
    clinicPurgeTitle: 'Smazání vrozeného dílku (1× za návštěvu)',
    clinicPurgeDesc: 'Trvale smaž 1 vrozený či Slepý dílek.',
    purgeTileAction: 'Smazat dílek',
    purgedDoneLabel: 'Dílek v této návštěvě odstraněn.',
    characters: {
      kira: {
        code: 'KIRA-09',
        name: 'Kira',
        title: 'Plazmová předvoj',
        weapon: '58 HP · 45 CR · Paměť 12 · Aretta.AI + Triage.AI',
        passive: 'Držené +1 ATK/DEF · TECH +20% OD',
        overdriveName: 'Plazmový Blitz',
        overdriveDesc: '20 Průraz Všem · +30% DMG · +6 Štít',
        summary: 'Držené +1 ATK/DEF · Rychlý Overdrive',
      },
      aurelia: {
        code: 'AURALINE-07',
        name: 'Auraline',
        title: 'Pomalý kolos',
        weapon: '78 HP · 18 Brnění · 35 CR · Paměť 14 · 3 Dudy (1/barva)',
        passive: 'Start +18 Brnění · +1 UpCharge za Dud',
        overdriveName: 'Královská salva',
        overdriveDesc: '20 Průraz Všem · +10 Brnění · +2 UpCharge',
        summary: 'Startuje +18 Brněním · Slepé dávají Nabití',
      },
      zuri: {
        code: 'ZURI-03',
        name: 'Zuri',
        title: 'Velitelka solárního roje',
        weapon: '62 HP · 50 CR · Paměť 13 · Falcon.AI + Ankh.AI',
        passive: 'TECH +25% OD · Drcení brnění & Štít',
        overdriveName: 'Protokol Solární roj',
        overdriveDesc: '16 Průraz Všem · -12 Brnění Všem · Štít',
        summary: 'Drtí Brnění · TECH +25% OD · Hybrid',
      },
    },
    enemyPassives: {
      volatile_burst: {
        archetype: 'Pěšák · Výbušný roj',
        name: 'Bio-exploze',
        rule: 'Smrt udělí **6 Průraz DMG** všem mutantům.',
        counter: '**Odstrč** k obrněncům pro řetězový výbuch.',
      },
      anchor_aegis: {
        archetype: 'Kotva · Podpora brnění',
        name: 'Aegis projekce',
        rule: '**1 Aegis Pip**. Dává **+4 Brnění** všem.',
        counter: 'Proraz **Pip**, pak spusť **Přetížení**.',
      },
      time_bomb: {
        archetype: 'Časovaná bomba · Odpočet',
        name: 'Žárová detonace',
        rule: 'Nabíjí 2 tahy. **16+ Omráčení** zruší výboj.',
        counter: 'Uděl **16+ DMG** nebo **Odstrč** [R].',
      },
      spike_retaliate: {
        archetype: 'Trestající · Modifikátor pravidel',
        name: 'Trnitý krunýř',
        rule: '**Vrátí 3 DMG**. +4 DMG bez Štítu.',
        counter: 'Použij **Přetížení (4+)** a drž **Štít**.',
      },
      acid_jam: {
        archetype: 'Disruptor · Pustuly a sabotáž',
        name: 'Prasklé pustuly a Kletba',
        rule: 'Běžný zásah stříkne **+2 Korozi**. Blokuje dílek.',
        counter: 'Použij **Přetížení** či **TECH**. Kryj **Štítem**.',
      },
      threshold_pip: {
        archetype: 'Těžká kotva · 2-místný kolos',
        name: 'Mutagenní krunýř',
        rule: '**1 Pip**, Mutagen. 16+ Omráčení ruší Těžký.',
        counter: 'Znič **Pip**, pak uděl **Přetížení**.',
      },
      phase_gate: {
        archetype: 'Vrcholná královna · Fázový zámek',
        name: '50% Fázový krunýř a Kletba',
        rule: 'Zámek na 55 HP. Beat 2 trestá Útok.',
        counter: 'Spusť Zámek opatrně. Znič Kletbu **Overdrivem**.',
      },
    },
    enemies: {
      larva: {
        name: 'Spórový roztoč',
        classification: 'Pěšák · Výbušný průzkumník',
        bioNote: 'Výbušný předvoj. Při smrti udělí **6 Průraz DMG**.',
      },
      skitter: {
        name: 'Kobaltový běžec',
        classification: 'Kotva · Aegis podpora',
        bioNote: 'Má **1 Aegis Pip**. Štítí spojence. Sám zuří.',
      },
      stinger: {
        name: 'Žárový žahavec',
        classification: 'Časovaná bomba · Žárový útočník',
        bioNote: 'Nabíjí 2 tahy za **16 DMG**. **16+ Omráčí**.',
      },
      stalker: {
        name: 'Chitinový slídič',
        classification: 'Trestající · Trnitý predátor',
        bioNote: 'Vrátí **3 DMG**. +4 DMG při 0 Štítu.',
      },
      spitter: {
        name: 'Žlučový plivač',
        classification: 'Disruptor · Pustulový dělostřelec',
        bioNote: 'Pustuly stříkají **+2 Korozi**. Kyselina blokuje dílky.',
      },
      brute: {
        name: 'Krunýřový kolos',
        classification: 'Těžká kotva · 2-místný kolos',
        bioNote: 'Dva sloty. **1 Pip**, mutagen léčí, **14 DMG** úder.',
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
        desc: '**Uchovej 50% Štítu** do dalšího kola.',
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
        desc: '**Přetížení** se aktivuje od **3+ dílků**.',
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
        name: 'Aretta Targeting.AI',
        desc: '⚔ **+5 Útok ×2** · 🛡 **+7 Štít**.',
      },
      minilekarnicka: {
        name: 'Nano-Triage.AI',
        desc: '✚ **+3 HP** · ⚡ **+15% OD**.',
      },
      dvojita_brokovnice: {
        name: 'Siege Salvo.AI',
        desc: '⚔ **+6 Útok ×2** · 🛡 **+6 Štít**.',
      },
      kralovsky_diadem: {
        name: 'Bastion Core.AI',
        desc: '✚ **+4 HP** · 🛡 **+7 Štít**.',
      },
      utocny_dron_sokol: {
        name: 'Falcon Strike.AI',
        desc: '⚔ **+6 Útok** · ⚔ **+5 Útok**.',
      },
      stito_dron_ankh: {
        name: 'Ankh Barrier.AI',
        desc: '✚ **+4 HP** · 🛡 **+8 Štít**.',
      },
      karabin_vx: {
        name: 'VX Barrage.AI',
        desc: '⚔ **+7 Útok ×2** · ⚔ **+5 Útok**.',
      },
      takticky_stit: {
        name: 'Aegis Bulwark.AI',
        desc: '🛡 **+9 Štít ×2** Pevnost.',
      },
      stim_injektor: {
        name: 'Bio-Stim.AI',
        desc: '✚ **+5 HP** · 🛡 **+6 Štít**.',
      },
      takticky_zesilovac: {
        name: 'Overclock Amp.AI',
        desc: '⚡ **+42% Útok** · ⚔ **+5 Útok**.',
      },
      tezka_brokovnice: {
        name: 'Breacher Heavy.AI',
        desc: '⚔ **+9 Útok ×2** · 🛡 **+7 Štít**.',
      },
      nano_ostri: {
        name: 'Twin-Blade.AI',
        desc: '⚔ **+7 Útok** · ⚔ **+6 Útok**.',
      },
      kryo_kondenzator: {
        name: 'Cryo-Purge.AI',
        desc: '⚡ **+15% OD** · **-2 Koroze** · 🛡 **+6 Štít**.',
      },
      pulzni_kuse: {
        name: 'ARC Rail.AI',
        desc: '⚡ **-10 Brnění všem** · ⚔ **+8 Útok**.',
      },
      energeticky_konvertor: {
        name: 'Aegis Converter.AI',
        desc: '🛡 **+5 Štít** · ⚡ **+22% Útok** · ⚔ **+5 Útok**.',
      },
      reaktivni_pancir: {
        name: 'Reactive Exo.AI',
        desc: '🛡 **+10 Štít** · 🛡 **+8 Štít** · ⚔ **+6 Útok**.',
      },
      upcharge_pulse_chip: {
        name: 'Pulse Capacitor.AI',
        desc: '⚔ **+5 Útok (⚡1)** · 🛡 **+6 Štít**.',
      },
      tactical_upcharge_chip: {
        name: 'Synapse Feed.AI',
        desc: '✚ **+3 HP (⚡1)** · ⚔ **+6 Útok**.',
      },
      neural_surge_chip: {
        name: 'Hyper-Cache.AI',
        desc: '⚡ **TECH (⚡2)** · 🛡 **+8 Štít (⚡1)**.',
      },
      caustic_blight: {
        name: 'Bio-odpad',
        desc: '☣ **Struska**: -2 HP za kolo · Čištění TECH',
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
      COMBAT: 'Hlídka mutantů. Odměna **Kredity** a **Čipy**.',
      ELITE: 'Obrněný nepřítel. Odměna **Čip** a **Klinika**.',
      CYBER_CLINIC: 'Vyber **1 Implantát**. Smaž 1 dílek.',
      CHIP_DEALER: 'Kup **AI Čipy**. Spravuj paměť.',
      MED_BAY: 'Oprav **HP**. Přetaktuj dílky. Šrot.',
      EVENT: 'Prozkoumej schránku, AI nebo překupníka.',
      BOSS: 'Finální střet s Královnou úlu.',
    },
  },
};
