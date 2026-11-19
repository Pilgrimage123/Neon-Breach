import { ENEMY_TEMPLATES, EQUIPMENT_BY_ID, getEquippedEquipmentWeight } from './data';
import { computeSmartScaledEnemyHp, getDifficultyProfile } from './difficulty';
import type {
  AnimationCue,
  CombatDirectorState,
  DifficultyTier,
  EnemyArchetype,
  EnemyIntent,
  EnemyUnit,
  HeatStage,
  HeroineState,
  MapNodeType,
  ParCacheState,
  PendingReinforcement,
  ReinforcementReason,
  RewardBreakdown,
  Tile,
} from './types';

export const MAX_ACTIVE_BRIDGE_ENEMIES = 6;

export function getEnemySlotSpan(archetype: EnemyArchetype): number {
  return archetype === 'brute' ? 2 : 1;
}

export function getOccupiedBridgeSlotCount(
  enemies: readonly Pick<EnemyUnit, 'archetype' | 'hp' | 'escaped'>[],
  pending: readonly Pick<PendingReinforcement, 'archetype'>[] = [],
): number {
  let total = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp > 0 && !e.escaped) {
      total += getEnemySlotSpan(e.archetype);
    }
  }
  for (let i = 0; i < pending.length; i++) {
    total += getEnemySlotSpan(pending[i].archetype);
  }
  return total;
}

const ARCHETYPE_THREAT_COST: Record<Exclude<EnemyArchetype, 'boss'>, number> = {
  larva: 4,
  skitter: 6,
  stinger: 7,
  stalker: 8,
  spitter: 8,
  brute: 11,
};

function deterministicHash(seed: number): number {
  let x = (seed >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function computePlayerMetaPower(heroine: HeroineState): number {
  const equipWeight = getEquippedEquipmentWeight(heroine);
  let rarityScore = 0;
  for (const id of heroine.equippedInstanceIds) {
    const owned = heroine.ownedEquipment.find((eq) => eq.instanceId === id);
    if (!owned) continue;
    const def = EQUIPMENT_BY_ID[owned.defId];
    if (!def) continue;
    if (def.rarity === 'common') rarityScore += 1;
    if (def.rarity === 'rare') rarityScore += 2;
  }
  const implantScore = heroine.implants.length * 2;
  const capacityBonus = Math.max(0, Math.floor((equipWeight - 3) / 2));
  return Math.max(1, capacityBonus + rarityScore + implantScore);
}

export interface EnemyIntentContext {
  shieldAfterPlayer?: number;
  colorPlayed?: 'attack' | 'defense' | 'tech' | null;
  battlefieldRule?: 'volatile_atmosphere' | 'magnetic_surge';
}

export function isIntentConditionMet(
  intent: EnemyIntent,
  ctx?: EnemyIntentContext,
): boolean {
  if (!intent.condition || !intent.conditionBonus) return false;
  if (!ctx) return false;
  if (intent.condition === 'if_no_shield') {
    return (ctx.shieldAfterPlayer ?? 0) === 0;
  }
  if (intent.condition === 'if_play_attack') {
    return ctx.colorPlayed === 'attack';
  }
  if (intent.condition === 'if_play_tech') {
    return ctx.colorPlayed === 'tech';
  }
  return false;
}

export function getEffectiveEnemyIntentValue(
  enemy: Pick<
    EnemyUnit,
    | 'staggered'
    | 'enrageAtkBonus'
    | 'weaponBroken'
    | 'desperationEnraged'
    | 'sleepCounter'
    | 'propKind'
    | 'isLootRunner'
    | 'escaped'
  >,
  intent: EnemyIntent,
  ctx?: EnemyIntentContext,
): number {
  if (
    enemy.staggered ||
    (enemy.sleepCounter !== undefined && enemy.sleepCounter > 0) ||
    Boolean(enemy.propKind) ||
    Boolean(enemy.isLootRunner) ||
    Boolean(enemy.escaped)
  ) {
    if (
      intent.kind === 'attack' ||
      intent.kind === 'heavy' ||
      intent.kind === 'acid' ||
      intent.kind === 'leech' ||
      intent.kind === 'charge'
    ) {
      return 0;
    }
  }
  const bonus = Math.max(0, enemy.enrageAtkBonus ?? 0);
  const desperationBonus = enemy.desperationEnraged ? 3 : 0;
  const weaponPenalty = enemy.weaponBroken ? 3 : 0;
  const condBonus = isIntentConditionMet(intent, ctx) ? (intent.conditionBonus ?? 0) : 0;
  if (
    intent.kind === 'attack' ||
    intent.kind === 'heavy' ||
    intent.kind === 'acid' ||
    intent.kind === 'leech' ||
    intent.kind === 'charge'
  ) {
    const raw = Math.max(
      intent.value > 0 ? 1 : 0,
      intent.value - weaponPenalty + bonus + desperationBonus + condBonus,
    );
    if (ctx?.battlefieldRule === 'volatile_atmosphere' && raw > 0) {
      return Math.round(raw * 1.25);
    }
    return raw;
  }
  if (
    (intent.kind === 'armor' || intent.kind === 'bolster') &&
    ctx?.battlefieldRule === 'magnetic_surge' &&
    intent.value > 0
  ) {
    return intent.value + 2;
  }
  return intent.value;
}

export function getHeatStageForTurn(
  turn: number,
  mediumTurnThreshold: number,
  overtimeTurnThreshold: number,
): HeatStage {
  if (turn >= overtimeTurnThreshold) return 'overtime';
  if (turn >= mediumTurnThreshold) return 'medium';
  return 'low';
}

export function createCombatDirector(
  nodeType: MapNodeType,
  layer: number,
  heroine: HeroineState,
  difficultyTier: DifficultyTier = 3,
): CombatDirectorState {
  const diff = getDifficultyProfile(difficultyTier);
  const playerMetaPower = computePlayerMetaPower(heroine);

  let parTurns: [number, number, number] = [4, 6, 8];
  let cacheCredits: [number, number, number] = [8, 6, 4];
  let mediumTurnThreshold = 4;
  let overtimeTurnThreshold = 8;
  let maxReinforcementsSpawned = 2;

  if (nodeType === 'BOSS') {
    parTurns = [6, 9, 12];
    cacheCredits = [15, 10, 8];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 11;
    maxReinforcementsSpawned = 3;
  } else if (nodeType === 'ELITE') {
    parTurns = [5, 7, 9];
    cacheCredits = [12, 8, 6];
    mediumTurnThreshold = 3;
    overtimeTurnThreshold = 9;
    maxReinforcementsSpawned = 3;
  } else if (layer === 0) {
    parTurns = [3, 5, 7];
    cacheCredits = [8, 5, 3];
    mediumTurnThreshold = 4;
    overtimeTurnThreshold = 8;
    maxReinforcementsSpawned = 1;
  } else if (layer >= 2) {
    parTurns = [4, 6, 8];
    cacheCredits = [10, 7, 5];
    mediumTurnThreshold = 3;
    overtimeTurnThreshold = 8;
    maxReinforcementsSpawned = 2 + (playerMetaPower >= 7 ? 1 : 0);
  } else {
    parTurns = [4, 6, 8];
    cacheCredits = [9, 6, 4];
    mediumTurnThreshold = 3;
    overtimeTurnThreshold = 8;
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

  // Threat points grow gently with layer + player's meta-upgrades, capped so waves never overwhelm
  const threatRatePerTurn = Math.max(
    1,
    Math.min(
      7,
      (layer === 0 ? 1 : 2 + Math.floor(layer * 0.7)) +
        Math.floor(playerMetaPower / 4) +
        diff.threatRateDelta,
    ),
  );
  const startingThreat =
    nodeType === 'ELITE' || nodeType === 'BOSS'
      ? Math.min(6, 2 + Math.floor(playerMetaPower / 3))
      : layer === 0
        ? 0
        : Math.min(4, Math.floor(playerMetaPower / 3));

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
    heroineHpAtRoundStart: heroine.hp,
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
  const intentCycle = tpl.intentCycle.map((intent) => ({ ...intent }));
  // Turn-1 Grace Period: never open on a heavy nuke on arrival turn
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

  // Prefer filling empty extension lane slots first, then dead KO slots
  for (let slot = Math.min(cursor, MAX_ACTIVE_BRIDGE_ENEMIES); slot < MAX_ACTIVE_BRIDGE_ENEMIES; slot++) {
    if (isContiguousFree(slot)) return slot;
  }
  for (let slot = 0; slot < MAX_ACTIVE_BRIDGE_ENEMIES; slot++) {
    if (isContiguousFree(slot)) return slot;
  }
  return null;
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
  const roll = deterministicHash(seed + turn * 131 + director.totalSpawnSequence * 37) % 100;
  const { attack, defense, tech, surges } = director.compositionCounts;

  // 25-30% composition-adaptive soft counter
  if (roll < 28) {
    if (defense >= attack + 1 && budget >= ARCHETYPE_THREAT_COST.spitter) {
      return { archetype: 'spitter', reason: 'adaptive' };
    }
    if (defense >= attack + 1 && budget >= ARCHETYPE_THREAT_COST.stinger) {
      return { archetype: 'stinger', reason: 'adaptive' };
    }
    if (attack > defense && surges === 0 && budget >= ARCHETYPE_THREAT_COST.skitter) {
      return { archetype: 'skitter', reason: 'adaptive' };
    }
    if (surges >= 1 && budget >= ARCHETYPE_THREAT_COST.stalker) {
      return { archetype: 'stalker', reason: 'adaptive' };
    }
    if (tech >= 2 && budget >= ARCHETYPE_THREAT_COST.stinger) {
      return { archetype: 'stinger', reason: 'adaptive' };
    }
  }

  // Modular Threat-Pool buy filtered by affordable Threat Points, free slot span, and layer difficulty
  const rawPool: Array<Exclude<EnemyArchetype, 'boss'>> =
    layer === 0
      ? ['larva', 'skitter']
      : nodeType === 'BOSS'
        ? ['larva', 'skitter', 'stinger', 'stalker']
        : layer === 1
          ? ['larva', 'skitter', 'stinger', 'stalker']
          : ['skitter', 'stinger', 'stalker', 'spitter', 'brute'];

  const pool = rawPool.filter((arch) => getEnemySlotSpan(arch) <= freeSlotCount);
  const affordable = pool.filter((arch) => ARCHETYPE_THREAT_COST[arch] <= budget);
  const candidates = affordable.length > 0 ? affordable : (['larva'] as const);
  const pickIdx = deterministicHash(seed + turn * 53 + director.totalSpawnSequence * 19) % candidates.length;
  return {
    archetype: candidates[pickIdx],
    reason: 'threat_pool',
  };
}

export function updateDirectorAfterPlayerAction(
  director: CombatDirectorState | undefined,
  enemiesBefore: EnemyUnit[],
  enemiesAfter: EnemyUnit[],
  colorPlayed: 'attack' | 'defense' | 'tech' | null,
  surgeTriggered: boolean,
): { director: CombatDirectorState | undefined; enemies: EnemyUnit[] } {
  if (!director) {
    return { director, enemies: enemiesAfter };
  }

  let totalHitProgress = 0;
  const damagedEnemyIds = new Set<string>();

  for (let i = 0; i < enemiesAfter.length; i++) {
    const after = enemiesAfter[i];
    const before = enemiesBefore.find((b) => b.id === after.id);
    if (!before) continue;
    const delta =
      Math.max(0, before.hp - after.hp) +
      Math.max(0, before.armor - after.armor) +
      Math.max(0, before.shieldPips - after.shieldPips) * 3;
    if (delta > 0) {
      totalHitProgress += delta;
      damagedEnemyIds.add(after.id);
    }
  }

  const nextComposition = { ...director.compositionCounts };
  if (colorPlayed) {
    nextComposition[colorPlayed] += 1;
    if (surgeTriggered) {
      nextComposition.surges += 1;
    }
  }

  const nextDamageDealtThisTurn = director.damageDealtThisTurn + totalHitProgress;
  let nextTempoStreak = director.tempoStreak;
  let nextMaxTempoStreak = director.maxTempoStreak;
  let nextTempoCreditsEarned = director.tempoCreditsEarned;

  if (colorPlayed !== null) {
    if (nextDamageDealtThisTurn > 0) {
      nextTempoStreak = director.tempoStreak + 1;
      nextMaxTempoStreak = Math.max(nextMaxTempoStreak, nextTempoStreak);
      if (nextTempoStreak >= 2 && nextTempoCreditsEarned < 8) {
        nextTempoCreditsEarned = Math.min(8, nextTempoCreditsEarned + 2);
      }
    } else {
      nextTempoStreak = 0;
    }
  }

  const nextEnemies = enemiesAfter.map((enemy) => {
    if (enemy.hp <= 0) {
      return { ...enemy, sosCharging: false };
    }
    if (damagedEnemyIds.has(enemy.id)) {
      return {
        ...enemy,
        turnsWithoutDamage: 0,
        sosCharging: false,
      };
    }
    if (colorPlayed !== null) {
      const nextIdle = (enemy.turnsWithoutDamage ?? 0) + 1;
      return {
        ...enemy,
        turnsWithoutDamage: nextIdle,
      };
    }
    return enemy;
  });

  return {
    director: {
      ...director,
      compositionCounts: nextComposition,
      damageDealtThisTurn: nextDamageDealtThisTurn,
      tempoStreak: nextTempoStreak,
      maxTempoStreak: nextMaxTempoStreak,
      tempoCreditsEarned: nextTempoCreditsEarned,
    },
    enemies: nextEnemies,
  };
}

export function advanceDirectorAtRoundEnd(params: {
  director: CombatDirectorState;
  enemies: EnemyUnit[];
  board: Tile[];
  heroine: HeroineState;
  nodeType: MapNodeType;
  layer: number;
  currentTurn: number;
  seed: number;
  difficultyTier?: DifficultyTier;
}): {
  director: CombatDirectorState;
  enemies: EnemyUnit[];
  board: Tile[];
  cues: AnimationCue[];
} {
  const { director, heroine, nodeType, layer, currentTurn, seed, difficultyTier = 3 } = params;
  const diff = getDifficultyProfile(difficultyTier);
  const nextTurn = currentTurn + 1;
  let nextEnemies = params.enemies.map((e) => ({ ...e }));
  let nextBoard = params.board.map((t) => ({ ...t }));
  const cues: AnimationCue[] = [];

  const heatStage = getHeatStageForTurn(
    nextTurn,
    director.mediumTurnThreshold,
    director.overtimeTurnThreshold,
  );

  const parCaches = director.parCaches.map((cache) => ({
    ...cache,
    intact: nextTurn <= cache.maxTurn,
  }));

  const roundHpLost = Math.max(0, director.heroineHpAtRoundStart - heroine.hp);
  const heroineHpRatio = heroine.maxHp > 0 ? heroine.hp / heroine.maxHp : 1;
  const shouldRubberBand = heroineHpRatio <= 0.4 || roundHpLost >= 8;
  let rubberBandDelayed = false;

  // 1. Resolve telegraphed pending drops (never attacks on drop turn!)
  const remainingPending: PendingReinforcement[] = [];
  let seq = director.totalSpawnSequence;
  let spawnedCount = director.reinforcementsSpawnedCount;

  const livingBeforeDrops = nextEnemies.filter((e) => e.hp > 0).length;
  if (livingBeforeDrops > 0) {
    for (const drop of director.pendingReinforcements) {
      if (shouldRubberBand && drop.turnsUntilDrop <= 1 && !drop.isZeroReward) {
        // Rubber-banding with a floor: delay high-pressure incoming reinforcement by 1 turn
        rubberBandDelayed = true;
        remainingPending.push({ ...drop, turnsUntilDrop: 1 });
        continue;
      }

      const nextCountdown = drop.turnsUntilDrop - 1;
      if (nextCountdown <= 0) {
        const dropSpan = getEnemySlotSpan(drop.archetype);
        const occupiedBeforeDrop = getOccupiedBridgeSlotCount(nextEnemies);
        const replaceIdx =
          drop.slotIndex < nextEnemies.length && nextEnemies[drop.slotIndex].hp <= 0
            ? drop.slotIndex
            : nextEnemies.findIndex(
                (e) => e.hp <= 0 && getEnemySlotSpan(e.archetype) >= dropSpan,
              );
        if (occupiedBeforeDrop + dropSpan > MAX_ACTIVE_BRIDGE_ENEMIES) {
          // Board lacks slot capacity for this unit's footprint; keep waiting in orbit at T-1
          remainingPending.push({ ...drop, turnsUntilDrop: 1 });
          continue;
        }
        seq += 1;
        const unit = createReinforcementUnit(
          drop.archetype,
          seq,
          drop.hpBonus ?? 0,
          drop.armorBonus ?? 0,
          Boolean(drop.isZeroReward),
          difficultyTier,
        );
        if (
          drop.slotIndex < nextEnemies.length &&
          nextEnemies[drop.slotIndex].hp <= 0 &&
          getEnemySlotSpan(nextEnemies[drop.slotIndex].archetype) >= dropSpan
        ) {
          nextEnemies[drop.slotIndex] = unit;
        } else if (nextEnemies.length < MAX_ACTIVE_BRIDGE_ENEMIES) {
          nextEnemies.push(unit);
        } else if (replaceIdx >= 0) {
          nextEnemies[replaceIdx] = unit;
        } else {
          remainingPending.push({ ...drop, turnsUntilDrop: 1 });
          continue;
        }
        if (!drop.isZeroReward) {
          spawnedCount += 1;
        }
        cues.push({
          id: `cue_reinf_${unit.id}_${nextTurn}`,
          kind: 'enemy_reinforce',
          targetId: unit.id,
          textLabel: unit.archetype,
        });
      } else {
        remainingPending.push({ ...drop, turnsUntilDrop: nextCountdown });
      }
    }
  }

  // 2. Accumulate Threat Pool (disabled in Layer 0 Turn 1-2 to preserve onboarding)
  let nextThreatPool = director.threatPool;
  if (nextTurn >= director.mediumTurnThreshold || layer > 0 || nodeType !== 'COMBAT') {
    nextThreatPool = Math.min(18, nextThreatPool + director.threatRatePerTurn);
  }

  // 3. Overtime Desperation Enrage & Board Friction
  let overtimeHazardApplied = false;
  if (heatStage === 'overtime' && diff.overtimeEnrageEnabled) {
    let appliedEnrage = false;
    nextEnemies = nextEnemies.map((enemy) => {
      if (enemy.hp <= 0) return enemy;
      const currentBonus = enemy.enrageAtkBonus ?? 0;
      if (currentBonus < 6) {
        appliedEnrage = true;
        return {
          ...enemy,
          enrageAtkBonus: currentBonus + 1,
        };
      }
      return enemy;
    });
    if (appliedEnrage) {
      const lead = nextEnemies.find((e) => e.hp > 0);
      if (lead) {
        cues.push({
          id: `cue_enrage_${lead.id}_${nextTurn}`,
          kind: 'enemy_enrage',
          targetId: lead.id,
          value: lead.enrageAtkBonus ?? 1,
        });
      }
    }

    // If player stalled passively in Overtime (0 damage dealt this turn), jam 1 tile cleanly
    if (director.damageDealtThisTurn === 0) {
      const unjammed = nextBoard.filter((t) => !t.isJammed);
      if (unjammed.length >= 2) {
        const jamIdx = deterministicHash(seed + nextTurn * 41) % unjammed.length;
        const jamTargetId = unjammed[jamIdx].id;
        nextBoard = nextBoard.map((t) => (t.id === jamTargetId ? { ...t, isJammed: true } : t));
        overtimeHazardApplied = true;
        cues.push({
          id: `cue_heat_jam_${nextTurn}`,
          kind: 'heat_jam',
          jammed: true,
        });
      }
    }
  }

  // 4. Anti-Stalling SOS Flare (Lone surviving non-boss enemy left undamaged)
  const livingNow = nextEnemies.filter((e) => e.hp > 0);
  if (livingNow.length === 1 && nextTurn >= 3) {
    const lone = livingNow[0];
    const idleTurns = lone.turnsWithoutDamage ?? 0;
    const isStalledLone = idleTurns >= (heatStage === 'low' ? 2 : 1);
    if (isStalledLone) {
      const openSlot = findOpenBridgeSlot(nextEnemies, remainingPending);
      if (
        openSlot !== null &&
        remainingPending.length === 0 &&
        lone.archetype !== 'boss' &&
        (spawnedCount < director.maxReinforcementsSpawned || heatStage === 'overtime')
      ) {
        const isOvertime = heatStage === 'overtime';
        const sosArchetype: EnemyArchetype = isOvertime
          ? 'skitter'
          : idleTurns >= 2 && nextThreatPool >= 6
            ? 'skitter'
            : 'larva';
        const dropId = `drop_sos_${nextTurn}_${seq + 1}`;
        remainingPending.push({
          id: dropId,
          archetype: sosArchetype,
          slotIndex: openSlot,
          turnsUntilDrop: 1,
          reason: isOvertime ? 'sweeper' : 'sos_flare',
          isZeroReward: isOvertime,
        });
        nextEnemies = nextEnemies.map((e) =>
          e.id === lone.id ? { ...e, sosCharging: true } : e,
        );
        cues.push({
          id: `cue_telegraph_${dropId}`,
          kind: 'enemy_telegraph',
          targetId: lone.id,
          value: 1,
          textLabel: sosArchetype,
        });
      } else if (lone.archetype !== 'boss') {
        nextEnemies = nextEnemies.map((e) =>
          e.id === lone.id
            ? {
                ...e,
                sosCharging: true,
                enrageAtkBonus: Math.min(6, (e.enrageAtkBonus ?? 0) + 1),
              }
            : e,
        );
      }
    }
  }

  // 5. Dynamic Threat-Pool / Reactive / Adaptive / Overtime Sweeper Spawn Telegraph
  const openSlot = findOpenBridgeSlot(nextEnemies, remainingPending);
  const canQueueThreatWave =
    openSlot !== null &&
    remainingPending.length === 0 &&
    !shouldRubberBand &&
    livingNow.length > 0 &&
    (heatStage === 'medium' || heatStage === 'overtime');

  if (canQueueThreatWave) {
    if (spawnedCount < director.maxReinforcementsSpawned && nextThreatPool >= 4) {
      const isReactive = livingNow.length === 1 && nextEnemies.length >= 2;
      const freeSlotCount = Math.max(
        0,
        MAX_ACTIVE_BRIDGE_ENEMIES - getOccupiedBridgeSlotCount(nextEnemies, remainingPending),
      );
      const pick = pickReinforcementArchetype(
        { ...director, totalSpawnSequence: seq },
        layer,
        nodeType,
        seed,
        nextTurn,
        nextThreatPool,
        freeSlotCount,
      );
      let chosenArch = pick.archetype;
      let dropSlot = findOpenBridgeSlot(
        nextEnemies,
        remainingPending,
        getEnemySlotSpan(chosenArch),
      );
      if (dropSlot === null) {
        chosenArch = nextThreatPool >= ARCHETYPE_THREAT_COST.skitter ? 'skitter' : 'larva';
        dropSlot = openSlot;
      }
      const cost = ARCHETYPE_THREAT_COST[chosenArch];
      if (nextThreatPool >= cost) {
        nextThreatPool = Math.max(0, nextThreatPool - cost);
        const baseLead = isReactive || nodeType === 'BOSS' ? 1 : 2;
        const turnsUntilDrop = Math.max(1, baseLead + diff.dropTelegraphLeadDelta);
        const reason: ReinforcementReason =
          pick.reason === 'adaptive' ? 'adaptive' : isReactive ? 'reactive' : 'threat_pool';
        const dropId = `drop_wave_${nextTurn}_${seq + 1}`;
        const armorBonus = director.playerMetaPower >= 9 && chosenArch === 'larva' ? 2 : 0;
        remainingPending.push({
          id: dropId,
          archetype: chosenArch,
          slotIndex: dropSlot,
          turnsUntilDrop,
          reason,
          isZeroReward: heatStage === 'overtime',
          armorBonus,
        });
        cues.push({
          id: `cue_telegraph_${dropId}`,
          kind: 'enemy_telegraph',
          value: turnsUntilDrop,
          textLabel: chosenArch,
        });
      }
    } else if (heatStage === 'overtime' && livingNow.length < 2) {
      // Zero-reward Sweeper prevents endless stalling after wave cap is exhausted
      const sweeperArchetype: EnemyArchetype = nextTurn % 2 === 0 ? 'stinger' : 'skitter';
      const dropId = `drop_sweeper_${nextTurn}_${seq + 1}`;
      remainingPending.push({
        id: dropId,
        archetype: sweeperArchetype,
        slotIndex: openSlot,
        turnsUntilDrop: 1,
        reason: 'sweeper',
        isZeroReward: true,
      });
      cues.push({
        id: `cue_telegraph_${dropId}`,
        kind: 'enemy_telegraph',
        value: 1,
        textLabel: sweeperArchetype,
      });
    }
  }

  return {
    director: {
      ...director,
      threatPool: nextThreatPool,
      heatStage,
      parCaches,
      damageDealtThisTurn: 0,
      lastRoundHpLost: roundHpLost,
      heroineHpAtRoundStart: heroine.hp,
      rubberBandDelayed,
      reinforcementsSpawnedCount: spawnedCount,
      pendingReinforcements: remainingPending,
      overtimeHazardApplied,
      totalSpawnSequence: seq,
    },
    enemies: nextEnemies,
    board: nextBoard,
    cues,
  };
}

export function computeVictoryDirectorRewards(
  baseCredits: number,
  turn: number,
  director: CombatDirectorState | undefined,
): {
  totalCredits: number;
  breakdown: RewardBreakdown;
  director: CombatDirectorState | undefined;
} {
  if (!director) {
    return {
      totalCredits: baseCredits,
      breakdown: {
        baseCredits,
        parCacheCredits: 0,
        intactParCount: 0,
        tempoCredits: 0,
        fastClearCredits: 0,
      },
      director,
    };
  }

  const finalCaches = director.parCaches.map((cache) => ({
    ...cache,
    intact: turn <= cache.maxTurn,
  }));
  const intactCaches = finalCaches.filter((c) => c.intact);
  const parCacheCredits = intactCaches.reduce((sum, c) => sum + c.creditReward, 0);
  const tempoCredits = director.tempoCreditsEarned;

  // Fast Clear Bonus: cleared while reinforcements were telegraphed inbound OR cleared within Par Tier 1
  const interceptedDrops = director.pendingReinforcements.length;
  const hitParTier1 = finalCaches[0]?.intact ?? false;
  const fastClearCredits =
    interceptedDrops > 0 || hitParTier1
      ? Math.min(12, 6 + interceptedDrops * 3)
      : 0;

  const totalCredits = baseCredits + parCacheCredits + tempoCredits + fastClearCredits;

  return {
    totalCredits,
    breakdown: {
      baseCredits,
      parCacheCredits,
      intactParCount: intactCaches.length,
      tempoCredits,
      fastClearCredits,
    },
    director: {
      ...director,
      parCaches: finalCaches,
      fastClearBonusCredits: fastClearCredits,
    },
  };
}
