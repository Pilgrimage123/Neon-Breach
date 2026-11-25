import { SKILL_CHIPS_BY_ID } from './data';
import { getEquippedChipMemory } from './poolBuilder';
import { ARCHETYPE_THREAT_RATING } from './threatRating';
import type {
  EnemyArchetype,
  EnemyIntent,
  EnemyUnit,
  HeatStage,
  HeroState,
  PendingReinforcement,
} from './types';

export const MAX_ACTIVE_BRIDGE_ENEMIES = 6;

export const ARCHETYPE_THREAT_COST: Record<Exclude<EnemyArchetype, 'boss'>, number> = {
  larva: ARCHETYPE_THREAT_RATING.larva,
  skitter: ARCHETYPE_THREAT_RATING.skitter,
  stinger: ARCHETYPE_THREAT_RATING.stinger,
  stalker: ARCHETYPE_THREAT_RATING.stalker,
  spitter: ARCHETYPE_THREAT_RATING.spitter,
  mutdog: ARCHETYPE_THREAT_RATING.mutdog,
  feral_nurse: ARCHETYPE_THREAT_RATING.feral_nurse,
  brute: ARCHETYPE_THREAT_RATING.brute,
};

export function deterministicHash(seed: number): number {
  let x = seed >>> 0 || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

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

export function computePlayerMetaPower(hero: HeroState): number {
  const equipMemory = getEquippedChipMemory(hero);
  let rarityScore = 0;
  for (const id of hero.equippedInstanceIds) {
    const owned = hero.ownedChips.find((eq) => eq.instanceId === id);
    if (!owned) continue;
    const def = SKILL_CHIPS_BY_ID[owned.defId];
    if (!def) continue;
    if (def.rarity === 'standard') rarityScore += 1;
    if (def.rarity === 'prototype') rarityScore += 2;
  }
  const implantScore = hero.implants.length * 2;
  const capacityBonus = Math.max(0, Math.floor((equipMemory - 3) / 2));
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
  if (intent.kind === 'pause' || intent.kind === 'cloak') {
    return 0;
  }
  const bonus = Math.max(0, enemy.enrageAtkBonus ?? 0);
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
      intent.value + bonus + condBonus,
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
