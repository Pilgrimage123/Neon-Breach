import { ENEMY_TEMPLATES, type EnemyTemplate } from './data';
import type { DifficultyTier, EnemyArchetype, EnemyIntent, MapNodeType } from './types';

export const PLAYER_BASELINE_DPR = 12;
export const MULTI_ENEMY_TAX = 2;

export interface ThreatRatingBreakdown {
  archetype: EnemyArchetype;
  effectiveHp: number;
  expectedTurnsAlive: number;
  effectiveAvgDpr: number;
  windupModifier: number;
  burstModifier: number;
  traitModifier: number;
  rawScore: number;
  total: number;
}

export function getIntentEffectiveDprValue(intent: EnemyIntent): number {
  if (
    intent.kind === 'pause' ||
    intent.kind === 'charge' ||
    intent.kind === 'armor' ||
    intent.kind === 'bolster'
  ) {
    return 0;
  }
  const base = Math.max(0, intent.value);
  if (intent.pierceShield) {
    return base * 1.3;
  }
  if (intent.overwhelmMultiplier && intent.overwhelmMultiplier > 1) {
    return base * (1 + 0.35 * (intent.overwhelmMultiplier - 1));
  }
  return base;
}

function isZeroDamageOpeningIntent(intent: EnemyIntent): boolean {
  return (
    intent.kind === 'pause' ||
    intent.kind === 'charge' ||
    intent.kind === 'armor' ||
    intent.kind === 'bolster'
  );
}

export function computeMutantThreatRating(template: EnemyTemplate): ThreatRatingBreakdown {
  const cycle = template.intentCycle.length > 0 ? template.intentCycle : [{ kind: 'pause' as const, value: 0 }];
  const avgArmorPerTurn =
    cycle.reduce((sum, intent) => {
      if (intent.kind === 'armor' || intent.kind === 'bolster') {
        return sum + Math.max(0, intent.value);
      }
      return sum;
    }, 0) / cycle.length;
  const expectedRecurringArmor = avgArmorPerTurn * 2;
  const effectiveHp =
    template.maxHp +
    template.startingArmor * 0.8 +
    expectedRecurringArmor * 0.8 +
    template.startingShieldPips * 8;
  const expectedTurnsAlive = Math.max(0.75, effectiveHp / PLAYER_BASELINE_DPR);

  const effectiveAvgDpr =
    cycle.reduce((sum, intent) => sum + getIntentEffectiveDprValue(intent), 0) / cycle.length;

  let leadingZeroCount = 0;
  for (const intent of cycle) {
    if (isZeroDamageOpeningIntent(intent)) {
      leadingZeroCount++;
    } else {
      break;
    }
  }
  const windupModifier = leadingZeroCount >= 2 ? -2.0 : leadingZeroCount === 1 ? -1.5 : 0;

  const maxPotentialHit = cycle.reduce((maxHit, intent) => {
    if (isZeroDamageOpeningIntent(intent)) return maxHit;
    const hit = intent.value * (intent.overwhelmMultiplier ?? 1);
    return Math.max(maxHit, hit);
  }, 0);
  const burstModifier = maxPotentialHit >= 14 ? 1.5 : 0;

  let traitModifier = 0;
  if (cycle.some((i) => i.kind === 'acid')) traitModifier += 2.0;
  if (cycle.some((i) => i.kind === 'bolster')) traitModifier += 1.5;
  if (template.passive === 'volatile_burst') traitModifier -= 1.0;

  const rawScore =
    effectiveHp * 0.25 +
    effectiveAvgDpr * expectedTurnsAlive +
    windupModifier +
    burstModifier +
    traitModifier;

  return {
    archetype: template.archetype,
    effectiveHp,
    expectedTurnsAlive,
    effectiveAvgDpr,
    windupModifier,
    burstModifier,
    traitModifier,
    rawScore,
    total: Math.max(1, Math.round(rawScore)),
  };
}

export const ARCHETYPE_THREAT_RATING: Record<EnemyArchetype, number> = {
  larva: computeMutantThreatRating(ENEMY_TEMPLATES.larva).total,
  skitter: computeMutantThreatRating(ENEMY_TEMPLATES.skitter).total,
  stinger: computeMutantThreatRating(ENEMY_TEMPLATES.stinger).total,
  stalker: computeMutantThreatRating(ENEMY_TEMPLATES.stalker).total,
  spitter: computeMutantThreatRating(ENEMY_TEMPLATES.spitter).total,
  brute: computeMutantThreatRating(ENEMY_TEMPLATES.brute).total,
  boss: computeMutantThreatRating(ENEMY_TEMPLATES.boss).total,
};

export function computeEncounterThreatRating(archetypes: readonly EnemyArchetype[]): number {
  if (archetypes.length === 0) return 0;
  let sum = 0;
  for (const a of archetypes) {
    sum += ARCHETYPE_THREAT_RATING[a];
  }
  return sum + MULTI_ENEMY_TAX * Math.max(0, archetypes.length - 1);
}

export interface EncounterBudgetSpec {
  minBudget: number;
  maxBudget: number;
  maxUnits: number;
  maxCopiesPerArchetype: number;
  allowedArchetypes: readonly Exclude<EnemyArchetype, 'boss'>[];
}

export function getEncounterBudgetForNode(
  nodeType: MapNodeType,
  layer: number,
  difficultyTier: DifficultyTier = 3,
  isBreather = false,
): EncounterBudgetSpec {
  if (nodeType === 'ELITE') {
    const tierDelta = difficultyTier === 1 ? -4 : difficultyTier === 2 ? -2 : difficultyTier >= 4 ? 4 : 0;
    const baseMax = layer >= 3 ? 44 : 40;
    const minBudget = Math.max(24, baseMax - 12 + tierDelta);
    const maxBudget = Math.max(minBudget + 4, baseMax + tierDelta);
    return {
      minBudget,
      maxBudget,
      maxUnits: difficultyTier === 1 ? 2 : 3,
      maxCopiesPerArchetype: 1,
      allowedArchetypes: ['brute', 'spitter', 'stinger', 'skitter', 'larva'],
    };
  }

  if (isBreather && layer >= 2) {
    return {
      minBudget: 10,
      maxBudget: 16,
      maxUnits: 2,
      maxCopiesPerArchetype: 1,
      allowedArchetypes: ['larva', 'stinger', 'skitter'],
    };
  }

  if (layer === 0) {
    return {
      minBudget: 14,
      maxBudget: 20,
      maxUnits: 2,
      maxCopiesPerArchetype: 1,
      allowedArchetypes: ['larva', 'stalker'],
    };
  }

  if (layer === 1) {
    const isEasy = difficultyTier <= 2;
    const isHard = difficultyTier >= 4;
    return {
      minBudget: isEasy ? 12 : 18,
      maxBudget: isEasy ? 20 : isHard ? 28 : 25,
      maxUnits: isEasy ? 2 : 3,
      maxCopiesPerArchetype: 1,
      allowedArchetypes: ['larva', 'skitter', 'stinger', 'spitter'],
    };
  }

  const tierBonus = difficultyTier === 1 ? -4 : difficultyTier === 2 ? -2 : difficultyTier === 4 ? 3 : difficultyTier === 5 ? 5 : 0;
  const layerGrowth = Math.min(14, (layer - 1) * 2);
  const maxBudget = Math.max(20, 26 + layerGrowth + tierBonus);
  const minBudget = Math.max(14, maxBudget - 8);
  return {
    minBudget,
    maxBudget,
    maxUnits: difficultyTier === 1 ? 2 : 3,
    maxCopiesPerArchetype: 2,
    allowedArchetypes:
      layer >= 4
        ? ['larva', 'skitter', 'stinger', 'stalker', 'spitter']
        : ['larva', 'skitter', 'stinger', 'stalker', 'spitter'],
  };
}
