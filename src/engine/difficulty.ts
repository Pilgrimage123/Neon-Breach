import type { DifficultyTier } from './types';

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
  // Lever 4: Board Spatial Complexity (NEVER scales enemy HP or DMG)
  boardComplexity: BoardComplexityMode;
  // Lever 5: Strategic Attrition & Economy Tightness
  postCombatHealPct: number;
  creditYieldMultiplier: number;
  overtimeEnrageEnabled: boolean;
}

export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = 3;

export const DIFFICULTY_TIERS: Record<DifficultyTier, DifficultyTierProfile> = {
  1: {
    tier: 1,
    id: 'story',
    labelEn: '1 · Story',
    labelCs: '1 · Příběh',
    summaryEn: 'Unlimited Undo/Reset · Skip after 2 fails · Full intel + Hints · Full heal after combat',
    summaryCs: 'Neomezené Zpět/Reset · Přeskok po 2 prohrách · Plný průzkum + Tipy · Plné léčení po boji',
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
    postCombatHealPct: 1.0,
    creditYieldMultiplier: 1.2,
    overtimeEnrageEnabled: false,
  },
  2: {
    tier: 2,
    id: 'casual',
    labelEn: '2 · Casual',
    labelCs: '2 · Klidný',
    summaryEn: 'Unlimited Undo/Reset · Full drop intel + Hints · +2 Par turns · +25% post-battle heal',
    summaryCs: 'Neomezené Zpět/Reset · Plné info o posilách + Tipy · +2 tahy Par · +25 % léčení po boji',
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
    postCombatHealPct: 0.25,
    creditYieldMultiplier: 1.1,
    overtimeEnrageEnabled: true,
  },
  3: {
    tier: 3,
    id: 'tactical',
    labelEn: '3 · Tactical',
    labelCs: '3 · Taktický',
    summaryEn: 'Baseline math · 1 Turn Rewind + 1 Reset/battle · Free Swap undo · Concealed drop types',
    summaryCs: 'Výchozí rovnováha · 1 vrácení tahu + 1 Reset/boj · Skrytý typ posil do dopadu',
    maxCommittedUndosPerBattle: 1,
    allowSwapUndoBeforeCommit: true,
    maxBattleResets: 1,
    maxRunResets: null,
    failForwardAllowed: true,
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
    postCombatHealPct: 0,
    creditYieldMultiplier: 1.0,
    overtimeEnrageEnabled: true,
  },
  4: {
    tier: 4,
    id: 'strategist',
    labelEn: '4 · Strategist',
    labelCs: '4 · Stratég',
    summaryEn: 'Swap undo only · 1 Reset per run · No Hints · Tighter Par clocks · Spatial squad variants',
    summaryCs: 'Zpět jen před akcí · 1 Reset za misi · Bez Tipů · Těsný Par · Silnější sestavy (stejné HP)',
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
    postCombatHealPct: 0,
    creditYieldMultiplier: 0.85,
    overtimeEnrageEnabled: true,
  },
  5: {
    tier: 5,
    id: 'grandmaster',
    labelEn: '5 · Grandmaster',
    labelCs: '5 · Velmistr',
    summaryEn: 'Ironman (0 Undos/Resets) · Concealed drops & future cycles · Max board density (math sacred)',
    summaryCs: 'Ironman (0 Zpět/Reset) · Skryté posily i budoucí cykly · Max hustota desky (stejné HP)',
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
    postCombatHealPct: 0,
    creditYieldMultiplier: 0.8,
    overtimeEnrageEnabled: true,
  },
};

export function getDifficultyProfile(tier: DifficultyTier = DEFAULT_DIFFICULTY_TIER): DifficultyTierProfile {
  return DIFFICULTY_TIERS[tier] ?? DIFFICULTY_TIERS[DEFAULT_DIFFICULTY_TIER];
}
