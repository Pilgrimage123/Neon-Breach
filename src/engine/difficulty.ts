import type { DifficultyTier, EnemyArchetype, EnemyIntent, MapNodeType } from './types';

export type BoardComplexityMode =
  | 'minimum'
  | 'relaxed'
  | 'standard'
  | 'hard'
  | 'grandmaster';

export interface DifficultyTierProfile {
  tier: DifficultyTier;
  id: 'story' | 'casual' | 'tactical' | 'strategist' | 'grandmaster';
  labelEn: string;
  labelCs: string;
  summaryEn: string;
  summaryCs: string;
  // Lever 1: Undo / Rewind Budget
  maxCommittedUndosPerBattle: number | null;
  allowSwapUndoBeforeCommit: boolean;
  maxBattleResets: number | null;
  maxRunResets: number | null;
  failForwardAllowed: boolean;
  skipEncounterAfterFails: number | null;
  // Lever 2: Information Horizon
  hintsAllowed: boolean;
  revealDropArchetype: boolean;
  revealDropSlot: boolean;
  revealEnemyFutureCycle: boolean;
  dropTelegraphLeadDelta: number;
  // Lever 3: Solution Width & Clocks
  parTurnDelta: number;
  threatRateDelta: number;
  overtimeTurnDelta: number;
  maxReinforcementsDelta: number;
  // Lever 4: Board Spatial Complexity & Full HP / Intent Damage Scaling
  boardComplexity: BoardComplexityMode;
  heroMaxHpDelta: number;
  enemyHpMultiplier: number;
  heavyBossHpMultiplier: number;
  enemyDamageMultiplier: number;
  keepChaffMathSacred: boolean;
  // Lever 5: Strategic Attrition, Economy Tightness & Secondary Objectives
  postCombatHealPct: number;
  creditYieldMultiplier: number;
  secondaryObjectiveCredits: number;
  mandatoryBonusObjective: boolean;
  overtimeEnrageEnabled: boolean;
}

export type DifficultyProfile = DifficultyTierProfile;

export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = 3;

export const DIFFICULTY_TIERS: Record<DifficultyTier, DifficultyTierProfile> = {
  1: {
    tier: 1,
    id: 'story',
    labelEn: '1 · Story',
    labelCs: '1 · Příběh',
    summaryEn: 'Unlimited Undo/Reset · Skip after 2 fails · -35% Enemy HP & DMG · +12 Max HP · Full heal',
    summaryCs: 'Neomezené Zpět a Reset · Přeskok po 2 prohrách · -35 % HP a útoku nepřátel · +12 Max HP · Plné léčení',
    maxCommittedUndosPerBattle: null,
    allowSwapUndoBeforeCommit: true,
    maxBattleResets: null,
    maxRunResets: null,
    failForwardAllowed: true,
    skipEncounterAfterFails: 2,
    hintsAllowed: true,
    revealDropArchetype: true,
    revealDropSlot: true,
    revealEnemyFutureCycle: true,
    dropTelegraphLeadDelta: 0,
    parTurnDelta: 3,
    threatRateDelta: -1,
    overtimeTurnDelta: 4,
    maxReinforcementsDelta: -1,
    boardComplexity: 'minimum',
    heroMaxHpDelta: 12,
    enemyHpMultiplier: 0.65,
    heavyBossHpMultiplier: 0.65,
    enemyDamageMultiplier: 0.65,
    keepChaffMathSacred: false,
    postCombatHealPct: 1.0,
    creditYieldMultiplier: 1.25,
    secondaryObjectiveCredits: 0,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: false,
  },
  2: {
    tier: 2,
    id: 'casual',
    labelEn: '2 · Casual',
    labelCs: '2 · Klidný',
    summaryEn: 'Unlimited Undo/Reset · Full intel + Hints · -15% Enemy HP & DMG · +6 Max HP · +25% heal',
    summaryCs: 'Neomezené Zpět a Reset · Plný průzkum a Tipy · -15 % HP a útoku nepřátel · +6 Max HP · +25 % léčení',
    maxCommittedUndosPerBattle: null,
    allowSwapUndoBeforeCommit: true,
    maxBattleResets: null,
    maxRunResets: null,
    failForwardAllowed: true,
    skipEncounterAfterFails: null,
    hintsAllowed: true,
    revealDropArchetype: true,
    revealDropSlot: true,
    revealEnemyFutureCycle: true,
    dropTelegraphLeadDelta: 0,
    parTurnDelta: 2,
    threatRateDelta: -1,
    overtimeTurnDelta: 2,
    maxReinforcementsDelta: 0,
    boardComplexity: 'relaxed',
    heroMaxHpDelta: 6,
    enemyHpMultiplier: 0.85,
    heavyBossHpMultiplier: 0.85,
    enemyDamageMultiplier: 0.85,
    keepChaffMathSacred: false,
    postCombatHealPct: 0.25,
    creditYieldMultiplier: 1.1,
    secondaryObjectiveCredits: 4,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: false,
  },
  3: {
    tier: 3,
    id: 'tactical',
    labelEn: '3 · Tactical',
    labelCs: '3 · Taktický',
    summaryEn: 'Baseline math (100% HP & DMG) · 1 Undo + 1 Reset/battle · Free Push undo · Concealed drop types',
    summaryCs: 'Výchozí rovnováha (100 % HP a útoku) · 1× Zpět a 1× Reset za boj · Prohoz zpět zdarma · Skrytý typ posil',
    maxCommittedUndosPerBattle: 1,
    allowSwapUndoBeforeCommit: true,
    maxBattleResets: 1,
    maxRunResets: null,
    failForwardAllowed: false,
    skipEncounterAfterFails: null,
    hintsAllowed: true,
    revealDropArchetype: false,
    revealDropSlot: true,
    revealEnemyFutureCycle: true,
    dropTelegraphLeadDelta: 0,
    parTurnDelta: 0,
    threatRateDelta: 0,
    overtimeTurnDelta: 0,
    maxReinforcementsDelta: 0,
    boardComplexity: 'standard',
    heroMaxHpDelta: 0,
    enemyHpMultiplier: 1.0,
    heavyBossHpMultiplier: 1.0,
    enemyDamageMultiplier: 1.0,
    keepChaffMathSacred: false,
    postCombatHealPct: 0,
    creditYieldMultiplier: 1.0,
    secondaryObjectiveCredits: 8,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: true,
  },
  4: {
    tier: 4,
    id: 'strategist',
    labelEn: '4 · Strategist',
    labelCs: '4 · Stratég',
    summaryEn: 'Push undo only · 1 Reset/run · No Hints · +22–28% Enemy HP & +35% DMG · Tight CR, bonus ops +14 CR',
    summaryCs: 'Zpět jen pro Prohoz · 1× Reset za výpravu · Bez nápovědy · +22–28 % HP a +35 % útoku nepřátel · Bonus +14 CR',
    maxCommittedUndosPerBattle: 0,
    allowSwapUndoBeforeCommit: true,
    maxBattleResets: null,
    maxRunResets: 1,
    failForwardAllowed: false,
    skipEncounterAfterFails: null,
    hintsAllowed: false,
    revealDropArchetype: false,
    revealDropSlot: true,
    revealEnemyFutureCycle: true,
    dropTelegraphLeadDelta: -1,
    parTurnDelta: -1,
    threatRateDelta: 1,
    overtimeTurnDelta: -1,
    maxReinforcementsDelta: 0,
    boardComplexity: 'hard',
    heroMaxHpDelta: 0,
    enemyHpMultiplier: 1.22,
    heavyBossHpMultiplier: 1.28,
    enemyDamageMultiplier: 1.35,
    keepChaffMathSacred: false,
    postCombatHealPct: 0,
    creditYieldMultiplier: 0.88,
    secondaryObjectiveCredits: 14,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: true,
  },
  5: {
    tier: 5,
    id: 'grandmaster',
    labelEn: '5 · Grandmaster',
    labelCs: '5 · Velmistr',
    summaryEn: 'Ironman (0 Undo/Reset) · Concealed drops & cycles · +46–54% Enemy HP & +75% DMG · Tactical Mandate',
    summaryCs: 'Ironman (bez Zpět/Resetu) · Skryté posily i cykly · +46–54 % HP a +75 % útoku nepřátel · Taktický mandát',
    maxCommittedUndosPerBattle: 0,
    allowSwapUndoBeforeCommit: false,
    maxBattleResets: 0,
    maxRunResets: 0,
    failForwardAllowed: false,
    skipEncounterAfterFails: null,
    hintsAllowed: false,
    revealDropArchetype: false,
    revealDropSlot: false,
    revealEnemyFutureCycle: false,
    dropTelegraphLeadDelta: -1,
    parTurnDelta: -1,
    threatRateDelta: 1,
    overtimeTurnDelta: -1,
    maxReinforcementsDelta: 1,
    boardComplexity: 'grandmaster',
    heroMaxHpDelta: 0,
    enemyHpMultiplier: 1.46,
    heavyBossHpMultiplier: 1.54,
    enemyDamageMultiplier: 1.75,
    keepChaffMathSacred: false,
    postCombatHealPct: 0,
    creditYieldMultiplier: 0.8,
    secondaryObjectiveCredits: 16,
    mandatoryBonusObjective: true,
    overtimeEnrageEnabled: true,
  },
};

export function getDifficultyProfile(tier: DifficultyTier = DEFAULT_DIFFICULTY_TIER): DifficultyTierProfile {
  return DIFFICULTY_TIERS[tier] ?? DIFFICULTY_TIERS[DEFAULT_DIFFICULTY_TIER];
}

/**
 * Full-roster tier HP scaling across all archetypes (including chaff):
 * - Tier 3 (baseline) is untouched (100% exact template + bonus).
 * - Tiers 1–2 soften all units cleanly; Tiers 4–5 scale all units with slightly higher Heavy/Boss weight.
 */
export function computeSmartScaledEnemyHp(
  archetype: EnemyArchetype,
  baseMaxHp: number,
  hpBonus = 0,
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
): number {
  const raw = Math.max(1, baseMaxHp + hpBonus);
  if (difficultyTier === 3) {
    return raw;
  }
  const diff = getDifficultyProfile(difficultyTier);
  if (archetype === 'larva' && diff.keepChaffMathSacred) {
    return raw;
  }
  const mult =
    archetype === 'boss' || archetype === 'brute'
      ? diff.heavyBossHpMultiplier
      : diff.enemyHpMultiplier;
  return Math.max(4, Math.round(raw * mult));
}

export function isScalableDamageIntentKind(kind: EnemyIntent['kind']): boolean {
  return (
    kind === 'attack' ||
    kind === 'heavy' ||
    kind === 'acid' ||
    kind === 'leech' ||
    kind === 'charge'
  );
}

/**
 * Scales damaging enemy intent values (and charge previews for heavy strikes) uniformly by tier.
 * Non-damaging intents (armor, bolster, pause) remain unscaled so puzzle counters stay crisp.
 */
export function computeSmartScaledEnemyIntentValue(
  intent: Pick<EnemyIntent, 'kind' | 'value'>,
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
): number {
  if (!isScalableDamageIntentKind(intent.kind) || intent.value <= 0) {
    return intent.value;
  }
  if (difficultyTier === 3) {
    return intent.value;
  }
  const diff = getDifficultyProfile(difficultyTier);
  return Math.max(1, Math.round(intent.value * diff.enemyDamageMultiplier));
}

export function scaleEnemyIntentCycleForTier(
  cycle: readonly EnemyIntent[],
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
): EnemyIntent[] {
  return cycle.map((intent) => ({
    ...intent,
    value: computeSmartScaledEnemyIntentValue(intent, difficultyTier),
  }));
}

export function getStageSecondaryTurnTarget(
  nodeType: MapNodeType = 'COMBAT',
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
): number {
  const diff = getDifficultyProfile(difficultyTier);
  const nodeOffset = nodeType === 'BOSS' ? 2 : nodeType === 'ELITE' ? 1 : 0;
  const relaxedOffset = Math.max(0, diff.parTurnDelta);
  return 5 + nodeOffset + relaxedOffset;
}
