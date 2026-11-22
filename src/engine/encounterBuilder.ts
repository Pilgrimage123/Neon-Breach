import {
  CYBER_IMPLANT_IDS,
  DROPPABLE_SKILL_CHIP_IDS,
  ENEMY_TEMPLATES,
} from './data';
import { computeSmartScaledEnemyHp, getDifficultyProfile } from './difficulty';
import { MAX_ACTIVE_BRIDGE_ENEMIES, getEnemySlotSpan } from './directorBridgeIntents';
import {
  ARCHETYPE_THREAT_RATING,
  MULTI_ENEMY_TAX,
  computeEncounterThreatRating,
  getEncounterBudgetForNode,
} from './threatRating';
import type {
  CyberImplantId,
  DifficultyTier,
  EnemyArchetype,
  EnemyPropKind,
  EnemyUnit,
  MapNodeType,
  NodeModifier,
} from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = items.slice();
  const rng = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function createPropUnit(
  propKind: EnemyPropKind,
  idSuffix: string,
  reviveData?: { archetype: EnemyArchetype; maxHp: number },
): EnemyUnit {
  if (propKind === 'plasma_barrel') {
    return {
      id: `prop_plasma_barrel_${idSuffix}`,
      archetype: 'larva',
      hp: 10,
      maxHp: 10,
      armor: 0,
      shieldPips: 0,
      maxShieldPips: 0,
      passive: 'volatile_burst',
      roleColor: 'orange',
      propKind: 'plasma_barrel',
      intentCycle: [{ kind: 'armor', value: 0 }],
      currentIntentIndex: 0,
      isZeroReward: true,
    };
  }
  if (propKind === 'decoy_totem') {
    return {
      id: `prop_decoy_totem_${idSuffix}`,
      archetype: 'skitter',
      hp: 5,
      maxHp: 5,
      armor: 2,
      shieldPips: 1,
      maxShieldPips: 1,
      passive: 'anchor_aegis',
      roleColor: 'blue',
      propKind: 'decoy_totem',
      intentCycle: [{ kind: 'armor', value: 2 }],
      currentIntentIndex: 0,
      isZeroReward: true,
    };
  }
  const revArch = reviveData?.archetype ?? 'stalker';
  return {
    id: `prop_bio_husk_${idSuffix}`,
    archetype: revArch,
    hp: 8,
    maxHp: 8,
    armor: 0,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'volatile_burst',
    roleColor: 'violet',
    propKind: 'bio_husk',
    reviveTimer: 2,
    reviveArchetype: revArch,
    reviveMaxHp: reviveData?.maxHp ?? ENEMY_TEMPLATES[revArch].maxHp,
    intentCycle: [{ kind: 'armor', value: 0 }],
    currentIntentIndex: 0,
    isZeroReward: true,
  };
}

export function createLootRunnerUnit(idSuffix: string, bountyCredits = 25): EnemyUnit {
  return {
    id: `enemy_loot_runner_${idSuffix}`,
    archetype: 'skitter',
    hp: 18,
    maxHp: 18,
    armor: 4,
    shieldPips: 1,
    maxShieldPips: 1,
    passive: 'anchor_aegis',
    roleColor: 'gold',
    isLootRunner: true,
    escapeTurnsLeft: 3,
    bountyCredits,
    intentCycle: [
      { kind: 'armor', value: 4 },
      { kind: 'armor', value: 5 },
      { kind: 'armor', value: 6 },
    ],
    currentIntentIndex: 0,
  };
}

export function createMercyDroneUnit(idSuffix: string): EnemyUnit {
  return {
    id: `enemy_mercy_drone_${idSuffix}`,
    archetype: 'skitter',
    hp: 16,
    maxHp: 16,
    armor: 2,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'anchor_aegis',
    roleColor: 'lime',
    isMercyTarget: true,
    intentCycle: [{ kind: 'attack', value: 3 }],
    currentIntentIndex: 0,
    isZeroReward: true,
  };
}

export function createSleepwalkerUnit(
  idSuffix: string,
  hpBonus = 0,
  sleepCounter = 2,
): EnemyUnit {
  const unit = createEnemyFromArchetype('brute', idSuffix, hpBonus, 1);
  unit.sleepCounter = sleepCounter;
  return unit;
}

function createEnemyFromArchetype(
  archetype: EnemyArchetype,
  idSuffix: string,
  hpBonus = 0,
  initialIntentIndex = 0,
): EnemyUnit {
  const tpl = ENEMY_TEMPLATES[archetype];
  const cycleLen = Math.max(1, tpl.intentCycle.length);
  return {
    id: `enemy_${archetype}_${idSuffix}`,
    archetype,
    hp: tpl.maxHp + hpBonus,
    maxHp: tpl.maxHp + hpBonus,
    armor: tpl.startingArmor,
    shieldPips: tpl.startingShieldPips,
    maxShieldPips: tpl.startingShieldPips,
    passive: tpl.passive,
    roleColor: tpl.roleColor,
    phaseGatePct: tpl.phaseGatePct,
    phaseGateTriggered: tpl.phaseGatePct ? false : undefined,
    intentCycle: tpl.intentCycle.map((intent) => ({ ...intent })),
    currentIntentIndex: ((initialIntentIndex % cycleLen) + cycleLen) % cycleLen,
  };
}

export interface EncounterUnitSpec {
  archetype: EnemyArchetype;
  idSuffix: string;
  hpBonus: number;
  initialIntentIndex?: number;
}

export function buildEncounterSpec(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
  lane = 0,
  difficultyTier: DifficultyTier = 3,
  isBreather = false,
): EncounterUnitSpec[] {
  const diff = getDifficultyProfile(difficultyTier);
  const mode = diff.boardComplexity;

  if (nodeType === 'BOSS') {
    if (mode === 'grandmaster') {
      return [
        { archetype: 'boss', idSuffix: 'boss_1', hpBonus: 0 },
        { archetype: 'skitter', idSuffix: 'boss_escort_1', hpBonus: 0, initialIntentIndex: 0 },
      ];
    }
    return [{ archetype: 'boss', idSuffix: 'boss_1', hpBonus: 0 }];
  }
  if (
    nodeType === 'CYBER_CLINIC' ||
    nodeType === 'CHIP_DEALER' ||
    nodeType === 'MED_BAY' ||
    nodeType === 'EVENT'
  ) {
    return [];
  }
  // Stage 01 (Layer 0): Turn-1 Breathing Room (3 DMG from front Spore Mite; Stalker opens on Pause)
  if (layer === 0) {
    return [
      { archetype: 'larva', idSuffix: 'l0_1', hpBonus: 0, initialIntentIndex: 0 },
      { archetype: 'stalker', idSuffix: 'l0_2', hpBonus: -4, initialIntentIndex: 0 },
    ];
  }

  const budget = getEncounterBudgetForNode(nodeType, layer, difficultyTier, isBreather);
  const rng = mulberry32(seed + layer * 97 + lane * 31 + difficultyTier * 13);
  const selected: Exclude<EnemyArchetype, 'boss'>[] = [];
  const counts: Partial<Record<Exclude<EnemyArchetype, 'boss'>, number>> = {};
  let usedSlots = 0;

  if (nodeType === 'ELITE' && budget.allowedArchetypes.includes('brute')) {
    selected.push('brute');
    counts.brute = 1;
    usedSlots += getEnemySlotSpan('brute');
  }

  for (let step = 0; step < 12 && selected.length < budget.maxUnits; step++) {
    const currentRating = computeEncounterThreatRating(selected);
    if (selected.length >= 2 && currentRating >= budget.minBudget) {
      break;
    }

    const candidates = budget.allowedArchetypes.filter((arch) => {
      if ((counts[arch] ?? 0) >= budget.maxCopiesPerArchetype) return false;
      const span = getEnemySlotSpan(arch);
      if (usedSlots + span > MAX_ACTIVE_BRIDGE_ENEMIES) return false;
      const nextRating =
        currentRating + ARCHETYPE_THREAT_RATING[arch] + (selected.length > 0 ? MULTI_ENEMY_TAX : 0);
      return nextRating <= budget.maxBudget;
    });

    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    selected.push(pick);
    counts[pick] = (counts[pick] ?? 0) + 1;
    usedSlots += getEnemySlotSpan(pick);
  }

  if (selected.length === 0) {
    selected.push('larva', 'stinger');
  }

  const lateBonus = nodeType === 'ELITE' ? layer * 2 : Math.max(0, (layer - 1) * 2);
  return selected.map((archetype, idx) => ({
    archetype,
    idSuffix: `${nodeType === 'ELITE' ? 'elite' : isBreather ? `l${layer}_${lane}_b` : `l${layer}_${lane}`}_${idx + 1}`,
    hpBonus:
      archetype === 'larva'
        ? nodeType === 'ELITE'
          ? 0
          : Math.min(3, lateBonus)
        : isBreather
          ? 0
          : archetype === 'brute'
            ? lateBonus
            : nodeType === 'ELITE'
              ? layer
              : lateBonus,
    initialIntentIndex: 0,
  }));
}

export function buildEnemiesForNode(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
  lane = 0,
  modifier?: NodeModifier,
  difficultyTier: DifficultyTier = 3,
  isBreather = false,
): EnemyUnit[] {
  return buildEncounterSpec(nodeType, layer, seed, lane, difficultyTier, isBreather).map((spec) => {
    const isOvercharged = modifier === 'overcharged_hazard';
    const tpl = ENEMY_TEMPLATES[spec.archetype];
    const scaledHp = computeSmartScaledEnemyHp(
      spec.archetype,
      tpl.maxHp,
      spec.hpBonus,
      difficultyTier,
    );
    const overchargeBonus = isOvercharged ? Math.max(3, Math.round(tpl.maxHp * 0.25)) : 0;
    const baseUnit = createEnemyFromArchetype(
      spec.archetype,
      spec.idSuffix,
      scaledHp - tpl.maxHp + overchargeBonus,
      spec.initialIntentIndex ?? 0,
    );
    if (isOvercharged) {
      baseUnit.armor += 1;
      baseUnit.intentCycle = baseUnit.intentCycle.map((intent) => ({
        ...intent,
        value:
          intent.kind === 'attack' || intent.kind === 'heavy' || intent.kind === 'acid'
            ? Math.round(intent.value * 1.25)
            : intent.value,
      }));
    }
    return baseUnit;
  });
}

export function pickSkillChipChoices(
  seed: number,
  count = 2,
  ownedDefIds: readonly string[] = [],
  excludeDefIds: readonly string[] = [],
): string[] {
  if (DROPPABLE_SKILL_CHIP_IDS.length === 0) return [];
  const ownedSet = new Set(ownedDefIds);
  const excludeSet = new Set(excludeDefIds);

  const freshUnowned = deterministicShuffle(
    DROPPABLE_SKILL_CHIP_IDS.filter((id) => !ownedSet.has(id) && !excludeSet.has(id)),
    seed,
  );
  const freshOwned = deterministicShuffle(
    DROPPABLE_SKILL_CHIP_IDS.filter((id) => ownedSet.has(id) && !excludeSet.has(id)),
    seed + 31,
  );
  const fallback = deterministicShuffle(
    DROPPABLE_SKILL_CHIP_IDS.filter((id) => excludeSet.has(id)),
    seed + 67,
  );

  return [...freshUnowned, ...freshOwned, ...fallback].slice(0, count);
}

export function pickImplantChoices(owned: readonly CyberImplantId[], seed: number): CyberImplantId[] {
  const available = CYBER_IMPLANT_IDS.filter((id) => !owned.includes(id));
  const pool = available.length >= 3 ? available : CYBER_IMPLANT_IDS;
  return deterministicShuffle(pool, seed).slice(0, 3);
}
