import type { DifficultyTier, EnemyArchetype, MapNodeType } from './types';

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
  // Lever 4: Board Spatial Complexity & Smart HP Scaling (keeps chaff math & enemy DMG sacred)
  boardComplexity: BoardComplexityMode;
  heroMaxHpDelta: number;
  enemyHpMultiplier: number;
  heavyBossHpMultiplier: number;
  keepChaffMathSacred: boolean;
  // Lever 5: Strategic Attrition, Economy Tightness & Secondary Objectives
  postCombatHealPct: number;
  creditYieldMultiplier: number;
  secondaryObjectiveCredits: number;
  mandatoryBonusObjective: boolean;
  overtimeEnrageEnabled: boolean;
}

export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = 3;

export const DIFFICULTY_TIERS: Record<DifficultyTier, DifficultyTierProfile> = {
  1: {
    tier: 1,
    id: 'story',
    labelEn: '1 · Story',
    labelCs: '1 · Příběh',
    summaryEn: 'Unlimited Undo/Reset · Skip after 2 fails · Full intel + Hints · -15% Enemy HP · +10 Max HP · Full heal',
    summaryCs: 'Neomezené Zpět/Reset · Přeskok po 2 prohrách · Plný průzkum + Tipy · -15 % HP nepřátel · +10 Max HP · Plné léčení',
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
    heroMaxHpDelta: 10,
    enemyHpMultiplier: 0.85,
    heavyBossHpMultiplier: 0.85,
    keepChaffMathSacred: false,
    postCombatHealPct: 1.0,
    creditYieldMultiplier: 1.2,
    secondaryObjectiveCredits: 0,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: false,
  },
  2: {
    tier: 2,
    id: 'casual',
    labelEn: '2 · Casual',
    labelCs: '2 · Klidný',
    summaryEn: 'Unlimited Undo/Reset · Full drop intel + Hints · +2 Par · -8% Non-chaff HP · +5 Max HP · +25% heal',
    summaryCs: 'Neomezené Zpět/Reset · Plné info o posilách + Tipy · +2 Par · -8 % HP silných nepřátel · +5 Max HP · +25 % léčení',
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
    heroMaxHpDelta: 5,
    enemyHpMultiplier: 0.92,
    heavyBossHpMultiplier: 0.92,
    keepChaffMathSacred: true,
    postCombatHealPct: 0.25,
    creditYieldMultiplier: 1.1,
    secondaryObjectiveCredits: 4,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: true,
  },
  3: {
    tier: 3,
    id: 'tactical',
    labelEn: '3 · Tactical',
    labelCs: '3 · Taktický',
    summaryEn: 'Baseline math (100% HP) · 1 Undo + 1 Reset/battle · Free Push undo · Concealed drop types',
    summaryCs: 'Výchozí rovnováha (100 % HP) · 1× Zpět + 1× Reset/boj · Skrytý typ posil do dopadu',
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
    keepChaffMathSacred: true,
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
    summaryEn: 'Push undo only · 1 Reset/run · No Hints · +12–15% Elite/Mid HP (chaff sacred) · Tight CR, bonus ops pay +14 CR',
    summaryCs: 'Zpět jen Posun · 1 Reset/běh · Bez Tipů · +12–15 % HP silných (larvy stejné) · Bonus úkoly +14 CR',
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
    maxReinforcementsDelta: 1,
    boardComplexity: 'hard',
    heroMaxHpDelta: 0,
    enemyHpMultiplier: 1.12,
    heavyBossHpMultiplier: 1.15,
    keepChaffMathSacred: true,
    postCombatHealPct: 0,
    creditYieldMultiplier: 0.85,
    secondaryObjectiveCredits: 14,
    mandatoryBonusObjective: false,
    overtimeEnrageEnabled: true,
  },
  5: {
    tier: 5,
    id: 'grandmaster',
    labelEn: '5 · Grandmaster',
    labelCs: '5 · Velmistr',
    summaryEn: 'Ironman (0 Undo/Reset) · Concealed drops & cycles · +20–25% Elite/Mid HP (chaff sacred) · Mandatory Par/No-Hit',
    summaryCs: 'Ironman (0 Zpět/Reset) · Skryté posily i cykly · +20–25 % HP silných (larvy stejné) · Povinný Par/Bez zásahu',
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
    threatRateDelta: 2,
    overtimeTurnDelta: -2,
    maxReinforcementsDelta: 1,
    boardComplexity: 'grandmaster',
    heroMaxHpDelta: 0,
    enemyHpMultiplier: 1.2,
    heavyBossHpMultiplier: 1.25,
    keepChaffMathSacred: true,
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
 * Smart puzzle-strategy HP scaling:
 * - Tier 3 (baseline) is always untouched (100% exact template + bonus).
 * - Chaff (larva, 9 HP) stays sacred on Tiers 2–5 so 2-tile starter kills & Bio-Rupture chains hold.
 * - Heavy/Boss units & mid-tier units scale smoothly to preserve Stagger & Phase-Gate puzzle depth.
 * - Enemy attack/intent DMG is NEVER scaled so defensive shield breakpoints remain deterministic.
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
  return Math.max(6, Math.round(raw * mult));
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
