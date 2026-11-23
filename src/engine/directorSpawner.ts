import { ENEMY_TEMPLATES } from './data';
import {
  computeSmartScaledEnemyHp,
  getDifficultyProfile,
  scaleEnemyIntentCycleForTier,
} from './difficulty';
import {
  ARCHETYPE_THREAT_COST,
  MAX_ACTIVE_BRIDGE_ENEMIES,
  computePlayerMetaPower,
  deterministicHash,
  getEnemySlotSpan,
  getOccupiedBridgeSlotCount,
} from './directorBridgeIntents';
import type {
  CombatDirectorState,
  DifficultyTier,
  EnemyArchetype,
  EnemyUnit,
  HeroState,
  MapNodeType,
  ParCacheState,
  PendingReinforcement,
  ReinforcementReason,
} from './types';

export function createCombatDirector(
  nodeType: MapNodeType,
  layer: number,
  hero: HeroState,
  difficultyTier: DifficultyTier = 3,
): CombatDirectorState {
  const diff = getDifficultyProfile(difficultyTier);
  const playerMetaPower = computePlayerMetaPower(hero);

  let parTurns: [number, number, number] = [4, 6, 8];
  let cacheCredits: [number, number, number] = [6, 5, 3];
  let mediumTurnThreshold = 4;
  let overtimeTurnThreshold = 9;
  let maxReinforcementsSpawned = 2;

  if (nodeType === 'BOSS') {
    parTurns = [6, 9, 12];
    cacheCredits = [12, 8, 5];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 12;
    maxReinforcementsSpawned = 2;
  } else if (nodeType === 'ELITE') {
    parTurns = [5, 7, 9];
    cacheCredits = [9, 6, 4];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 10;
    maxReinforcementsSpawned = 2;
  } else if (layer === 0) {
    parTurns = [3, 5, 7];
    cacheCredits = [6, 4, 3];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 9;
    maxReinforcementsSpawned = 1;
  } else if (layer >= 2) {
    parTurns = [4, 6, 8];
    cacheCredits = [7, 5, 3];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 9;
    maxReinforcementsSpawned = 2;
  } else {
    parTurns = [4, 6, 8];
    cacheCredits = [6, 5, 3];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 9;
    maxReinforcementsSpawned = 2;
  }

  const adjustedParTurns: [number, number, number] = [
    Math.max(2, parTurns[0] + diff.parTurnDelta),
    Math.max(4, parTurns[1] + diff.parTurnDelta),
    Math.max(6, parTurns[2] + diff.parTurnDelta),
  ];
  overtimeTurnThreshold = Math.max(
    mediumTurnThreshold + 2,
    overtimeTurnThreshold + diff.overtimeTurnDelta,
  );
  maxReinforcementsSpawned = Math.max(
    layer === 0 && diff.tier === 1 ? 0 : 1,
    maxReinforcementsSpawned + diff.maxReinforcementsDelta,
  );

  const parCaches: ParCacheState[] = [
    { tier: 1, maxTurn: adjustedParTurns[0], creditReward: cacheCredits[0], intact: true },
    { tier: 2, maxTurn: adjustedParTurns[1], creditReward: cacheCredits[1], intact: true },
    { tier: 3, maxTurn: adjustedParTurns[2], creditReward: cacheCredits[2], intact: true },
  ];

  const metaThreatBonus = Math.min(1, Math.floor(playerMetaPower / 5));
  const threatRatePerTurn = Math.max(
    1,
    Math.min(
      6,
      (layer === 0 ? 1 : 2 + Math.floor(layer * 0.5)) +
        metaThreatBonus +
        diff.threatRateDelta,
    ),
  );
  const startingThreat =
    nodeType === 'ELITE' || nodeType === 'BOSS'
      ? Math.min(4, 2 + metaThreatBonus)
      : layer === 0
        ? 0
        : Math.min(2, metaThreatBonus);

  return {
    playerMetaPower,
    threatPool: startingThreat,
    threatRatePerTurn,
    heatStage: 'low',
    mediumTurnThreshold,
    overtimeTurnThreshold,
    parCaches,
    tempoStreak: 0,
    maxTempoStreak: 0,
    tempoCreditsEarned: 0,
    fastClearBonusCredits: 0,
    compositionCounts: {
      attack: 0,
      defense: 0,
      tech: 0,
      surges: 0,
    },
    damageDealtThisTurn: 0,
    lastRoundHpLost: 0,
    heroHpAtTurnStart: hero.hp,
    rubberBandDelayed: false,
    maxReinforcementsSpawned,
    reinforcementsSpawnedCount: 0,
    pendingReinforcements: [],
    overtimeHazardApplied: false,
    totalSpawnSequence: 0,
  };
}

export function createReinforcementUnit(
  archetype: EnemyArchetype,
  sequenceId: number,
  hpBonus = 0,
  armorBonus = 0,
  isZeroReward = false,
  difficultyTier: DifficultyTier = 3,
): EnemyUnit {
  const safeArchetype: Exclude<EnemyArchetype, 'boss'> =
    archetype === 'boss' ? 'skitter' : archetype;
  const tpl = ENEMY_TEMPLATES[safeArchetype];
  const scaledHp = computeSmartScaledEnemyHp(safeArchetype, tpl.maxHp, hpBonus, difficultyTier);
  const intentCycle = scaleEnemyIntentCycleForTier(tpl.intentCycle, difficultyTier);
  const graceStartIdx =
    intentCycle[0]?.kind === 'heavy'
      ? Math.max(0, intentCycle.findIndex((i) => i.kind !== 'heavy'))
      : 0;
  return {
    id: `enemy_reinf_${safeArchetype}_${sequenceId}`,
    archetype: safeArchetype,
    hp: scaledHp,
    maxHp: scaledHp,
    armor: tpl.startingArmor + armorBonus,
    shieldPips: tpl.startingShieldPips,
    maxShieldPips: tpl.startingShieldPips,
    passive: tpl.passive,
    roleColor: tpl.roleColor,
    intentCycle,
    currentIntentIndex: graceStartIdx,
    enrageAtkBonus: 0,
    turnsWithoutDamage: 0,
    sosCharging: false,
    isReinforcement: true,
    isZeroReward,
  };
}

export function findOpenBridgeSlot(
  enemies: EnemyUnit[],
  pending: PendingReinforcement[],
  neededSpan = 1,
): number | null {
  const usedCapacity = getOccupiedBridgeSlotCount(enemies, pending);
  if (usedCapacity + neededSpan > MAX_ACTIVE_BRIDGE_ENEMIES) {
    return null;
  }

  const occupiedSlots = new Set<number>();
  let cursor = 0;
  for (let i = 0; i < enemies.length; i++) {
    const span = getEnemySlotSpan(enemies[i].archetype);
    if (enemies[i].hp > 0 && !enemies[i].escaped) {
      for (let s = 0; s < span; s++) {
        occupiedSlots.add(cursor + s);
      }
    }
    cursor += span;
  }
  for (const drop of pending) {
    const dropSpan = getEnemySlotSpan(drop.archetype);
    for (let s = 0; s < dropSpan; s++) {
      occupiedSlots.add(drop.slotIndex + s);
    }
  }

  const isContiguousFree = (startSlot: number): boolean => {
    if (startSlot < 0 || startSlot + neededSpan > MAX_ACTIVE_BRIDGE_ENEMIES) return false;
    for (let s = 0; s < neededSpan; s++) {
      if (occupiedSlots.has(startSlot + s)) return false;
    }
    return true;
  };

  for (let slot = Math.min(cursor, MAX_ACTIVE_BRIDGE_ENEMIES); slot < MAX_ACTIVE_BRIDGE_ENEMIES; slot++) {
    if (isContiguousFree(slot)) return slot;
  }
  for (let slot = 0; slot < MAX_ACTIVE_BRIDGE_ENEMIES; slot++) {
    if (isContiguousFree(slot)) return slot;
  }
  return null;
}

export function findDeadEnemyIndexAtBridgeSlot(
  enemies: readonly EnemyUnit[],
  targetSlot: number,
  neededSpan: number,
): number {
  let cursor = 0;
  for (let i = 0; i < enemies.length; i++) {
    const span = getEnemySlotSpan(enemies[i].archetype);
    const matchesSlot = targetSlot >= cursor && targetSlot < cursor + span;
    if (matchesSlot && (enemies[i].hp <= 0 || enemies[i].escaped) && span >= neededSpan) {
      return i;
    }
    cursor += span;
  }
  if (targetSlot >= cursor && enemies.length < MAX_ACTIVE_BRIDGE_ENEMIES) {
    return -1;
  }
  return enemies.findIndex(
    (e) => (e.hp <= 0 || e.escaped) && getEnemySlotSpan(e.archetype) >= neededSpan,
  );
}

export function pickReinforcementArchetype(
  director: CombatDirectorState,
  layer: number,
  nodeType: MapNodeType,
  seed: number,
  turn: number,
  budget: number,
  freeSlotCount = MAX_ACTIVE_BRIDGE_ENEMIES,
): { archetype: Exclude<EnemyArchetype, 'boss'>; reason: ReinforcementReason } {
  const rawPool: Array<Exclude<EnemyArchetype, 'boss'>> =
    layer === 0
      ? ['larva', 'skitter']
      : nodeType === 'BOSS' || layer === 1
        ? ['larva', 'skitter', 'stinger', 'stalker']
        : ['skitter', 'stinger', 'stalker', 'spitter', 'brute'];

  const allowedPool = rawPool.filter((arch) => getEnemySlotSpan(arch) <= freeSlotCount);
  const allowedSet = new Set(allowedPool);

  const roll = deterministicHash(seed + turn * 131 + director.totalSpawnSequence * 37) % 100;
  const { attack, defense, tech, surges } = director.compositionCounts;
  const canAdaptive = (arch: Exclude<EnemyArchetype, 'boss'>) =>
    allowedSet.has(arch) && budget >= ARCHETYPE_THREAT_COST[arch];

  if (roll < 28) {
    if (defense >= attack + 1 && canAdaptive('spitter')) {
      return { archetype: 'spitter', reason: 'adaptive' };
    }
    if (defense >= attack + 1 && canAdaptive('stinger')) {
      return { archetype: 'stinger', reason: 'adaptive' };
    }
    if (attack > defense && surges === 0 && canAdaptive('skitter')) {
      return { archetype: 'skitter', reason: 'adaptive' };
    }
    if (surges >= 1 && canAdaptive('stalker')) {
      return { archetype: 'stalker', reason: 'adaptive' };
    }
    if (tech >= 2 && canAdaptive('stinger')) {
      return { archetype: 'stinger', reason: 'adaptive' };
    }
  }

  const affordable = allowedPool.filter((arch) => ARCHETYPE_THREAT_COST[arch] <= budget);
  const candidates =
    affordable.length > 0
      ? affordable
      : allowedPool.length > 0
        ? [allowedPool[0]]
        : (['larva'] as const);
  const pickIdx =
    deterministicHash(seed + turn * 53 + director.totalSpawnSequence * 19) % candidates.length;
  return {
    archetype: candidates[pickIdx],
    reason: 'threat_pool',
  };
}
