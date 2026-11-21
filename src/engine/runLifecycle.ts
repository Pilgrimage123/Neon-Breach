import {
  CYBER_EVENT_TEMPLATES,
  DYNASTY_EVENT_TEMPLATES,
  getCyberEventForNode,
} from './cyberEvents';
import {
  BOARD_CAPACITY,
  CYBER_IMPLANT_IDS,
  MAX_HEIRLOOM_STACKS,
  MAX_IMPLANTS,
  getHeroSpec,
} from './data';
import { getDifficultyProfile } from './difficulty';
import {
  buildEnemiesForNode,
  deterministicShuffle,
  pickImplantChoices,
  pickSkillChipChoices,
} from './encounterBuilder';
import { generateSectorMap, type SectorMapOptions } from './mapGenerator';
import { loadBestRecord, saveInheritedHeirloom } from './persistence';
import {
  acquireSkillChip,
  createStartingSkillChips,
  rebuildMasterPool,
} from './poolBuilder';
import { createCombatDirector } from './reinforcementDirector';
import {
  computeCombatNaniteReward,
  incrementHeirloomOnVictory,
  markNodeCleared,
  tickBetaTrialChipOnCombatExit,
} from './combatRules';
import { drawToSix } from './combatTurnEngine';
import { advanceNodeDynastyProgress } from './dynastyClinicEngine';
import type {
  CharacterId,
  CombatState,
  DifficultyTier,
  HeroState,
  MapNode,
  RunState,
} from './types';

export function startNodeEncounter(run: RunState, nodeId: string): RunState {
  const node: MapNode | undefined = run.mapNodes.find((n) => n.id === nodeId);
  if (!node) return run;

  let workingHero = { ...run.hero };
  if (
    Array.isArray(workingHero.familyEstates) &&
    workingHero.familyEstates.includes(node.layer)
  ) {
    workingHero = {
      ...workingHero,
      credits: workingHero.credits + 12,
      hp: Math.min(workingHero.maxHp, workingHero.hp + 5),
    };
  }

  const ownedDefIds = workingHero.ownedChips.map((eq) => eq.defId);

  if (node.type === 'CYBER_CLINIC') {
    return {
      ...run,
      hero: workingHero,
      currentNodeId: node.id,
      screen: 'clinic',
      clinicChoices: pickImplantChoices(workingHero.implants, run.seed + node.layer * 17),
      chipDealerChoices: [],
      chipDealerHeirloomUsed: false,
      clinicPurgeUsed: false,
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'CHIP_DEALER') {
    return {
      ...run,
      hero: workingHero,
      currentNodeId: node.id,
      screen: 'chip_dealer',
      clinicChoices: [],
      chipDealerChoices: pickSkillChipChoices(run.seed + node.layer * 31 + 5, 3, ownedDefIds),
      chipDealerHeirloomUsed: false,
      clinicPurgeUsed: false,
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'MED_BAY') {
    return {
      ...run,
      hero: workingHero,
      currentNodeId: node.id,
      screen: 'medbay',
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'EVENT') {
    const event = getCyberEventForNode(
      node,
      run.seed + node.layer * 23 + node.lane * 7,
      workingHero,
    );
    return {
      ...run,
      hero: workingHero,
      currentNodeId: node.id,
      screen: 'event',
      activeEvent: event,
      combat: null,
    };
  }

  const initialPile = deterministicShuffle(
    run.masterPool.map((t) => ({ ...t, isHeldFromPrevTurn: false })),
    run.seed + node.layer * 41 + node.lane * 13,
  );
  const turn1ExtraDraw =
    (workingHero.nannyBotInstalled === 'tutor_nanny' ? 1 : 0) +
    (workingHero.activeTempoRule?.id === 'algo_rave_surge' ? 2 : 0);
  const drawn = drawToSix([], initialPile, [], run.seed, 1, BOARD_CAPACITY + turn1ExtraDraw);

  const difficultyTier = run.difficultyTier ?? 3;
  const diff = getDifficultyProfile(difficultyTier);

  let rewardCredits =
    node.type === 'ELITE' ? 60 : node.type === 'BOSS' ? 100 : 35;
  if (node.modifier === 'golden_bounty') {
    rewardCredits = Math.round(rewardCredits * 1.5);
  } else if (node.modifier === 'double_credits') {
    rewardCredits = rewardCredits * 2;
  }
  rewardCredits = Math.max(10, Math.round(rewardCredits * diff.creditYieldMultiplier));

  const rewardChipChoices =
    node.type === 'BOSS'
      ? []
      : pickSkillChipChoices(
          run.seed + node.layer * 53 + node.lane * 19,
          node.type === 'ELITE' ? 3 : 2,
          ownedDefIds,
        );

  const enemies = buildEnemiesForNode(
    node.type,
    node.layer,
    run.seed,
    node.lane,
    node.modifier,
    difficultyTier,
    Boolean(node.isBreatherNode),
  );

  const combat: CombatState = {
    nodeId: node.id,
    nodeType: node.type,
    turn: 1,
    phase: 'PLAYER_IDLE',
    board: drawn.board,
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    enemies,
    lastCues: [],
    totalDamageDealt: 0,
    totalTilesResolved: 0,
    rewardCredits,
    rewardChipChoices,
    director: createCombatDirector(node.type, node.layer, workingHero, difficultyTier),
    startingHeroHp: workingHero.hp,
    committedUndosUsed: 0,
    battleResetsUsed: 0,
    failedAttempts: 0,
    ...(node.type === 'ELITE'
      ? {
          cradleObjective: {
            name: 'Neonatal Bio-Cradle',
            hp: 18,
            maxHp: 18,
            turnsSurvived: 0,
            targetTurns: 4,
            liberated: false,
          },
        }
      : {}),
  };

  const heroSpec = getHeroSpec(workingHero.characterId);
  const startShieldBonus =
    (workingHero.nannyBotInstalled === 'guardian_nanny' ? 5 : 0) +
    (workingHero.activeTempoRule?.id === 'kids_vitality_boost' ? 4 : 0);
  const startOdBonus =
    workingHero.activeTempoRule?.id === 'kids_vitality_boost' ? 25 : 0;

  return {
    ...run,
    currentNodeId: node.id,
    screen: 'combat',
    activeEvent: null,
    clinicPurgeUsed: false,
    chipDealerHeirloomUsed: false,
    hero: {
      ...workingHero,
      armor: heroSpec.startingArmor,
      shield: startShieldBonus,
      overdrive: Math.min(100, workingHero.overdrive + startOdBonus),
      corrode: 0,
      pendingUpcharge: 0,
    },
    combat,
  };
}

export function switchActiveCyberEvent(run: RunState, eventId: string): RunState {
  if (run.screen !== 'event') return run;
  const allTemplates = [...CYBER_EVENT_TEMPLATES, ...DYNASTY_EVENT_TEMPLATES];
  const found = allTemplates.find((tpl) => tpl.id === eventId);
  if (!found) return run;
  return {
    ...run,
    activeEvent: {
      ...found,
      choices: found.choices.map((c) => ({ ...c })),
    },
  };
}

export function resolveCyberEventChoice(run: RunState, choiceIndex: number): RunState {
  if (run.screen !== 'event' || !run.activeEvent) return run;
  const choice = run.activeEvent.choices[choiceIndex];
  if (!choice) return run;

  const costCredits = choice.costCredits ?? 0;
  const hpCost = choice.hpCost ?? 0;
  if (run.hero.credits < costCredits) return run;
  if (run.hero.hp <= hpCost && hpCost > 0) return run;

  let nextImplants = run.hero.implants.slice();
  if (choice.rewardFreeImplant && nextImplants.length < MAX_IMPLANTS) {
    const unowned = CYBER_IMPLANT_IDS.filter((id) => !nextImplants.includes(id));
    if (unowned.length > 0) {
      nextImplants = [...nextImplants, unowned[Math.abs(run.seed + choiceIndex) % unowned.length]];
    }
  }

  let nextHeirloomId = run.hero.heirloomEngravedId ?? null;
  let nextHeirloomStacks = Math.min(MAX_HEIRLOOM_STACKS, Math.max(0, run.hero.heirloomStacks ?? 0));
  if (choice.rewardHeirloomStacks && choice.rewardHeirloomStacks > 0) {
    if (!nextHeirloomId && run.hero.ownedChips.length > 0) {
      nextHeirloomId = run.hero.ownedChips[0].defId;
    }
    nextHeirloomStacks = Math.min(
      MAX_HEIRLOOM_STACKS,
      nextHeirloomStacks + choice.rewardHeirloomStacks,
    );
    if (nextHeirloomId) {
      saveInheritedHeirloom(nextHeirloomId, nextHeirloomStacks);
    }
  }

  let nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - costCredits + (choice.rewardCredits ?? 0),
    hp: Math.min(run.hero.maxHp, Math.max(1, run.hero.hp - hpCost + (choice.rewardHp ?? 0))),
    overdrive: Math.min(100, run.hero.overdrive + (choice.rewardOverdrive ?? 0)),
    damageBoostPct: run.hero.damageBoostPct + (choice.rewardDamageBoostPct ?? 0),
    nanites: (run.hero.nanites ?? 0) + (choice.rewardNanites ?? 0),
    implants: nextImplants,
    heirloomEngravedId: nextHeirloomId,
    heirloomStacks: nextHeirloomStacks,
    ...(choice.rewardScionHouse ? { scionAlliedHouse: choice.rewardScionHouse } : {}),
  };

  nextHero = advanceNodeDynastyProgress(nextHero);
  if (choice.applyTempoRule) {
    nextHero = {
      ...nextHero,
      activeTempoRule: {
        id: choice.applyTempoRule,
        nodesRemaining: choice.applyTempoRule === 'algo_rave_surge' ? 3 : 2,
      },
    };
  }
  const nextMapNodes = markNodeCleared(run.mapNodes, run.currentNodeId);

  return {
    ...run,
    screen: 'map',
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    activeEvent: null,
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 25,
  };
}

export function claimCombatChipReward(run: RunState, chosenDefId: string | null): RunState {
  if (!run.combat || run.combat.phase !== 'VICTORY') return run;
  const combat = run.combat;
  const salvageBonus =
    chosenDefId === null && !combat.mandateBreachLootConfiscated ? 15 : 0;
  const naniteReward = computeCombatNaniteReward(combat, run.mapNodes);
  const diff = getDifficultyProfile(run.difficultyTier ?? 3);

  const streak = (run.hero.consecutiveCombatWithoutClinic ?? 0) + 1;
  const streakBonusCredits = Math.min(25, Math.round(combat.rewardCredits * 0.1 * (streak - 1)));

  const cradleIntact =
    combat.nodeType === 'ELITE' &&
    Boolean(combat.cradleObjective && combat.cradleObjective.hp > 0);
  const cradleBonusCredits = cradleIntact ? 25 : 0;

  let nextHero: HeroState = {
    ...run.hero,
    credits:
      run.hero.credits +
      combat.rewardCredits +
      salvageBonus +
      streakBonusCredits +
      cradleBonusCredits,
    nanites: (run.hero.nanites ?? 0) + naniteReward,
    consecutiveCombatWithoutClinic: streak,
    damageBoostPct: 0,
    ...(cradleIntact ? { dynastyRelicUnlocked: true } : {}),
  };

  nextHero = incrementHeirloomOnVictory(nextHero);

  if (
    combat.nodeType === 'ELITE' &&
    !nextHero.emergencyDefibUsed &&
    nextHero.hp <= Math.round(nextHero.maxHp * 0.15)
  ) {
    const defibHeal = Math.max(6, Math.round(nextHero.maxHp * 0.15));
    nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + defibHeal);
    nextHero.emergencyDefibUsed = true;
  }

  if (diff.postCombatHealPct > 0 && nextHero.hp > 0) {
    const recovery = Math.ceil(nextHero.maxHp * diff.postCombatHealPct);
    nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + recovery);
  }

  nextHero = tickBetaTrialChipOnCombatExit(nextHero);
  nextHero = advanceNodeDynastyProgress(nextHero);

  let nextRun: RunState = {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
  };

  if (chosenDefId && combat.rewardChipChoices.includes(chosenDefId)) {
    nextRun = acquireSkillChip(nextRun, chosenDefId, true).run;
  }

  let nextMapNodes = markNodeCleared(nextRun.mapNodes, combat.nodeId);

  if (cradleIntact) {
    const eliteNode = nextMapNodes.find((n) => n.id === combat.nodeId);
    const liberatedIds = new Set(eliteNode?.nextIds ?? []);
    nextMapNodes = nextMapNodes.map((n) => {
      if (!liberatedIds.has(n.id)) return n;
      if (n.type === 'CYBER_CLINIC' || n.type === 'MED_BAY') {
        return { ...n, modifier: 'funded_clinic' };
      }
      if (n.type === 'CHIP_DEALER') {
        return { ...n, modifier: 'flash_sale' };
      }
      return n;
    });
  }

  if (combat.nodeType === 'ELITE') {
    return {
      ...nextRun,
      screen: 'clinic',
      mapNodes: nextMapNodes,
      clinicChoices: pickImplantChoices(nextRun.hero.implants, nextRun.seed + combat.turn + 13),
      chipDealerChoices: [],
      chipDealerHeirloomUsed: false,
      clinicPurgeUsed: false,
      combat: null,
    };
  }

  return {
    ...nextRun,
    screen: 'map',
    mapNodes: nextMapNodes,
    combat: null,
  };
}

export function skipCombatEncounter(run: RunState): RunState {
  const diff = getDifficultyProfile(run.difficultyTier ?? 3);
  if (diff.skipEncounterAfterFails === null || !run.combat) return run;
  if (run.combat.nodeType === 'BOSS') return run;

  const recovery = Math.ceil(run.hero.maxHp * diff.postCombatHealPct);
  const nextHp =
    diff.postCombatHealPct > 0
      ? Math.min(run.hero.maxHp, Math.max(1, run.hero.hp) + recovery)
      : Math.max(1, run.hero.hp);

  let nextHero: HeroState = {
    ...run.hero,
    hp: nextHp,
    shield: 0,
    corrode: 0,
    damageBoostPct: 0,
    pendingUpcharge: 0,
  };
  nextHero = tickBetaTrialChipOnCombatExit(nextHero);
  nextHero = advanceNodeDynastyProgress(nextHero);

  return {
    ...run,
    screen: 'map',
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    mapNodes: markNodeCleared(run.mapNodes, run.combat.nodeId),
    combat: null,
  };
}

export function createInitialRun(
  seed = 104729,
  characterId: CharacterId = 'kira',
  difficultyTier: DifficultyTier = 3,
  inheritHeirloom = false,
  mapOptions: Omit<SectorMapOptions, 'difficultyTier'> = {},
): RunState {
  const diff = getDifficultyProfile(difficultyTier);
  const mapNodes = generateSectorMap(seed, { ...mapOptions, difficultyTier });
  const startingChips = createStartingSkillChips(characterId);
  const heroSpec = getHeroSpec(characterId);
  const scaledMaxHp = heroSpec.maxHp + diff.heroMaxHpDelta;

  const inherited = inheritHeirloom ? loadBestRecord().inheritedHeirloom : null;
  const starterHeirloomId = inherited
    ? startingChips.ownedChips.find((c) => c.defId === inherited.defId)?.defId ??
      startingChips.ownedChips[0]?.defId ??
      inherited.defId
    : null;
  const starterHeirloomStacks = inherited
    ? Math.min(MAX_HEIRLOOM_STACKS, Math.max(1, inherited.bonusStacks))
    : 0;

  const baseHero: HeroState = {
    characterId,
    hp: scaledMaxHp,
    maxHp: scaledMaxHp,
    armor: heroSpec.startingArmor,
    shield: 0,
    overdrive: 0,
    corrode: 0,
    damageBoostPct: 0,
    pendingUpcharge: 0,
    implants: [],
    memoryCapacity: heroSpec.memoryCapacity,
    ownedChips: startingChips.ownedChips,
    equippedInstanceIds: startingChips.equippedInstanceIds,
    nextChipInstanceSeq: startingChips.ownedChips.length + 1,
    purgedInnateIds: [],
    credits: heroSpec.startingCredits,
    nanites: 0,
    consecutiveCombatWithoutClinic: 0,
    emergencyDefibUsed: false,
    overclockCount: 0,
    incubatingTile: null,
    maturedNextGenTiles: {},
    bloodlineCrest: null,
    prodigyTileIds: [],
    splicedTilePairs: [],
    heirloomEngravedId: starterHeirloomId,
    heirloomStacks: starterHeirloomStacks,
    nannyBotInstalled: null,
    betaTrialChip: null,
    activeTempoRule: null,
    familyEstates: [],
    meshReroutesUsed: 0,
    maglevUsed: false,
    scionAlliedHouse: null,
    dynastyRelicUnlocked: false,
  };

  const baseRun: RunState = {
    runId: `run_${seed}_${Date.now()}`,
    seed,
    difficultyTier,
    runResetsUsed: 0,
    screen: 'combat',
    hero: baseHero,
    masterPool: rebuildMasterPool(baseHero),
    mapNodes,
    currentNodeId: null,
    combat: null,
    clinicChoices: [],
    chipDealerChoices: [],
    chipDealerHeirloomUsed: false,
    clinicPurgeUsed: false,
    activeEvent: null,
    enemiesDefeated: 0,
    turnsCompleted: 0,
    score: 0,
  };

  return startNodeEncounter(baseRun, mapNodes[0].id);
}
