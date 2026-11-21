import { getDifficultyProfile } from './difficulty';
import {
  ARCHETYPE_THREAT_COST,
  MAX_ACTIVE_BRIDGE_ENEMIES,
  deterministicHash,
  getEnemySlotSpan,
  getHeatStageForTurn,
  getOccupiedBridgeSlotCount,
} from './directorBridgeIntents';
import {
  createReinforcementUnit,
  findDeadEnemyIndexAtBridgeSlot,
  findOpenBridgeSlot,
  pickReinforcementArchetype,
} from './directorSpawner';
import type {
  AnimationCue,
  CombatDirectorState,
  DifficultyTier,
  EnemyArchetype,
  EnemyUnit,
  HeatStage,
  HeroState,
  MapNodeType,
  PendingReinforcement,
  ReinforcementReason,
  RewardBreakdown,
  Tile,
} from './types';

function isCountedHostile(
  e: Pick<EnemyUnit, 'hp' | 'escaped' | 'propKind' | 'isMercyTarget'>,
): boolean {
  return e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget;
}

function resolvePendingDrops(params: {
  pending: readonly PendingReinforcement[];
  enemies: EnemyUnit[];
  shouldRubberBand: boolean;
  initialSeq: number;
  initialSpawnedCount: number;
  nextTurn: number;
  difficultyTier: DifficultyTier;
  cues: AnimationCue[];
}): {
  enemies: EnemyUnit[];
  remainingPending: PendingReinforcement[];
  seq: number;
  spawnedCount: number;
  rubberBandDelayed: boolean;
} {
  const nextEnemies = params.enemies.map((e) => ({ ...e }));
  const remainingPending: PendingReinforcement[] = [];
  let seq = params.initialSeq;
  let spawnedCount = params.initialSpawnedCount;
  let rubberBandDelayed = false;

  const livingBeforeDrops = nextEnemies.filter(isCountedHostile).length;
  if (livingBeforeDrops <= 0) {
    return { enemies: nextEnemies, remainingPending, seq, spawnedCount, rubberBandDelayed };
  }

  for (const drop of params.pending) {
    if (params.shouldRubberBand && drop.turnsUntilDrop <= 1 && !drop.isZeroReward) {
      rubberBandDelayed = true;
      remainingPending.push({ ...drop, turnsUntilDrop: 1 });
      continue;
    }

    const nextCountdown = drop.turnsUntilDrop - 1;
    if (nextCountdown > 0) {
      remainingPending.push({ ...drop, turnsUntilDrop: nextCountdown });
      continue;
    }

    const dropSpan = getEnemySlotSpan(drop.archetype);
    const occupiedBeforeDrop = getOccupiedBridgeSlotCount(nextEnemies);
    if (occupiedBeforeDrop + dropSpan > MAX_ACTIVE_BRIDGE_ENEMIES) {
      remainingPending.push({ ...drop, turnsUntilDrop: 1 });
      continue;
    }

    const replaceIdx = findDeadEnemyIndexAtBridgeSlot(nextEnemies, drop.slotIndex, dropSpan);
    if (nextEnemies.length >= MAX_ACTIVE_BRIDGE_ENEMIES && replaceIdx < 0) {
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
      params.difficultyTier,
    );
    if (replaceIdx >= 0) {
      nextEnemies[replaceIdx] = unit;
    } else {
      nextEnemies.push(unit);
    }

    if (!drop.isZeroReward) {
      spawnedCount += 1;
    }
    params.cues.push({
      id: `cue_reinf_${unit.id}_${params.nextTurn}`,
      kind: 'enemy_reinforce',
      targetId: unit.id,
      textLabel: unit.archetype,
    });
  }

  return { enemies: nextEnemies, remainingPending, seq, spawnedCount, rubberBandDelayed };
}

function applyOvertimeHazards(params: {
  enemies: EnemyUnit[];
  board: Tile[];
  heatStage: HeatStage;
  overtimeEnrageEnabled: boolean;
  damageDealtThisTurn: number;
  nextTurn: number;
  seed: number;
  cues: AnimationCue[];
}): { enemies: EnemyUnit[]; board: Tile[]; overtimeHazardApplied: boolean } {
  let nextEnemies = params.enemies;
  let nextBoard = params.board;
  let overtimeHazardApplied = false;

  if (params.heatStage !== 'overtime' || !params.overtimeEnrageEnabled) {
    return { enemies: nextEnemies, board: nextBoard, overtimeHazardApplied };
  }

  let appliedEnrage = false;
  nextEnemies = nextEnemies.map((enemy) => {
    if (enemy.hp <= 0 || enemy.escaped) return enemy;
    const currentBonus = enemy.enrageAtkBonus ?? 0;
    if (currentBonus < 6) {
      appliedEnrage = true;
      return { ...enemy, enrageAtkBonus: currentBonus + 1 };
    }
    return enemy;
  });

  if (appliedEnrage) {
    const lead = nextEnemies.find((e) => e.hp > 0 && !e.escaped);
    if (lead) {
      params.cues.push({
        id: `cue_enrage_${lead.id}_${params.nextTurn}`,
        kind: 'enemy_enrage',
        targetId: lead.id,
        value: lead.enrageAtkBonus ?? 1,
      });
    }
  }

  if (params.damageDealtThisTurn === 0) {
    const jamCandidates = nextBoard.filter((t) => !t.isJammed && !t.isBlight);
    if (jamCandidates.length >= 2) {
      const jamIdx = deterministicHash(params.seed + params.nextTurn * 41) % jamCandidates.length;
      const jamTargetId = jamCandidates[jamIdx].id;
      nextBoard = nextBoard.map((t) => (t.id === jamTargetId ? { ...t, isJammed: true } : t));
      overtimeHazardApplied = true;
      params.cues.push({
        id: `cue_heat_jam_${params.nextTurn}`,
        kind: 'heat_jam',
        jammed: true,
      });
    }
  }

  return { enemies: nextEnemies, board: nextBoard, overtimeHazardApplied };
}

export function advanceDirectorAtRoundEnd(params: {
  director: CombatDirectorState;
  enemies: EnemyUnit[];
  board: Tile[];
  hero: HeroState;
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
  const { director, hero, nodeType, layer, currentTurn, seed, difficultyTier = 3 } = params;
  const diff = getDifficultyProfile(difficultyTier);
  const nextTurn = currentTurn + 1;
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

  const roundHpLost = Math.max(0, director.heroHpAtTurnStart - hero.hp);
  const heroHpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
  const shouldRubberBand = heroHpRatio <= 0.4 || roundHpLost >= 8;

  const dropRes = resolvePendingDrops({
    pending: director.pendingReinforcements,
    enemies: params.enemies,
    shouldRubberBand,
    initialSeq: director.totalSpawnSequence,
    initialSpawnedCount: director.reinforcementsSpawnedCount,
    nextTurn,
    difficultyTier,
    cues,
  });
  let nextEnemies = dropRes.enemies;
  const remainingPending = dropRes.remainingPending;
  const seq = dropRes.seq;
  const spawnedCount = dropRes.spawnedCount;

  let nextThreatPool = director.threatPool;
  if (nextTurn >= director.mediumTurnThreshold || layer > 0 || nodeType !== 'COMBAT') {
    nextThreatPool = Math.min(18, nextThreatPool + director.threatRatePerTurn);
  }

  const hazardRes = applyOvertimeHazards({
    enemies: nextEnemies,
    board: params.board.map((t) => ({ ...t })),
    heatStage,
    overtimeEnrageEnabled: diff.overtimeEnrageEnabled,
    damageDealtThisTurn: director.damageDealtThisTurn,
    nextTurn,
    seed,
    cues,
  });
  nextEnemies = hazardRes.enemies;
  const nextBoard = hazardRes.board;

  const livingNow = nextEnemies.filter(isCountedHostile);
  if (livingNow.length === 1 && nextTurn >= 3) {
    const lone = livingNow[0];
    const idleTurns = lone.turnsWithoutDamage ?? 0;
    const isStalledLone = idleTurns >= (heatStage === 'low' ? 2 : 1);
    if (isStalledLone) {
      const openSlot = findOpenBridgeSlot(nextEnemies, remainingPending);
      const allowOvertimeSweeper = heatStage === 'overtime' && diff.overtimeEnrageEnabled;
      if (
        openSlot !== null &&
        remainingPending.length === 0 &&
        lone.archetype !== 'boss' &&
        (spawnedCount < director.maxReinforcementsSpawned || allowOvertimeSweeper)
      ) {
        const sosArchetype: EnemyArchetype = allowOvertimeSweeper
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
          reason: allowOvertimeSweeper ? 'sweeper' : 'sos_flare',
          isZeroReward: allowOvertimeSweeper,
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
    } else if (
      heatStage === 'overtime' &&
      diff.overtimeEnrageEnabled &&
      livingNow.length < 2
    ) {
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
      heroHpAtTurnStart: hero.hp,
      rubberBandDelayed: dropRes.rubberBandDelayed,
      reinforcementsSpawnedCount: spawnedCount,
      pendingReinforcements: remainingPending,
      overtimeHazardApplied: hazardRes.overtimeHazardApplied,
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
