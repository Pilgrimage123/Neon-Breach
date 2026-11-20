export type CutInStagingMode = 'melee' | 'ranged_fast' | 'ranged_lobbed' | 'ranged_aoe';

export interface CombatPresentationConfig {
  /** Master enable flag for Darkest Dungeon cut-in presentation */
  enabled: boolean;
  /** Phase A (Melee): zoom + dim + center-stage clash windup duration (seconds) */
  windupSec: number;
  /** Beat 1 (Ranged): tight zoom onto shooter with firing lead-room (seconds, 0.20-0.30s) */
  rangedBeat1Sec: number;
  /** Beat 2 (Fast Ranged / AoE): rapid EaseOutExpo whip-pan duration (seconds, 0.10-0.15s) */
  rangedWhipPanSec: number;
  /** Phase C: follow-through hold for standard hits (seconds, default 0.60s) */
  holdNormalSec: number;
  /** Phase C: follow-through hold for critical / Overdrive hits (seconds, default 1.00s) */
  holdCritSec: number;
  /** Phase D: EaseInOutCubic camera & dimmer reset back to neutral stage (seconds) */
  resetSec: number;
  /** Hit-Stop freeze durations (raw unscaled wall-clock seconds, independent of simDt) */
  hitstopNormalSec: number;
  hitstopAoeSec: number;
  hitstopCritSec: number;
  /** Strictly frame-counted pure white flash duration (2-3 frames on rawDt) */
  whiteFlashFrames: number;
  /** Camera zoom levels (unmistakable zoom-in: 1.35x-1.5x normal, 1.6x-1.85x crit) */
  zoomNormal: number;
  zoomCrit: number;
  /** Ranged Beat 1 shooter close-up zoom (1.35x-1.45x) */
  zoomRangedShooter: number;
  /** Clamped wider zoom range for multi-target AoE centroids (1.20x-1.30x, never < 1.0x) */
  zoomAoeMin: number;
  zoomAoeMax: number;
  /** Extra inward zoom creep during Phase C Hold (0.05-0.10 -> +5% to +10%) */
  holdZoomCreepPct: number;
  /** Directional "lead room" offset during Ranged Beat 1 as a fraction of viewport width */
  rangedLeadRoomVw: number;
  /** Dutch angle Z-axis rotation on impact (1.5-3.5 degrees) */
  dutchDegNormal: number;
  dutchDegCrit: number;
  /** Stage dimmer peak opacity [0..0.85] (default 0.75) */
  dimmerAlpha: number;
  /** Trauma intensity [0..1] and decay rate */
  shakeTraumaNormal: number;
  shakeTraumaCrit: number;
  shakeDecayPerSec: number;
  /** Viewport-relative trauma shake amplitude (fraction of viewport width; 1.5%-2.5% for crits) */
  shakeNormalVw: number;
  shakeCritVw: number;
  /** Melee center-stage slide ratio (legacy fallback; nose-to-nose gap uses meleeClashGapVw) */
  meleeClashSlideRatio: number;
  /** Target nose-to-nose center-to-center melee clash gap as a fraction of viewport width (0.08-0.22) */
  meleeClashGapVw: number;
  /** Subtle dramatic foreground scale boost for melee combatants during clash windup/hold (e.g. 1.07x) */
  meleeForegroundScale: number;
  /** Ranged subtle in-slot forward lunge / recoil ratio relative to actor width (0.05-0.10) */
  rangedSlotLungeRatio: number;
  /** Viewport-relative target knockback (fraction of viewport width; 4%-6%) */
  knockbackNormalVw: number;
  knockbackCritVw: number;
  /** Subtle viewport-relative drift apart during Phase C Hold */
  holdDriftApartVw: number;
  /** Procedural attacker scale punch apex (e.g. 1.28x -> 1.0x) */
  attackerScalePunch: number;
  /** Left-to-right AoE hit ripple stagger per target (milliseconds, 30ms-50ms) */
  aoeCascadeStepMs: number;
  /** Hide floating world-space health bars & threat previews during focal cut-ins */
  hideWorldUiDuringCutIn: boolean;
  /** Critical / Overdrive foreground flair */
  critSpeedLinesEnabled: boolean;
  critInvertFlashEnabled: boolean;
  /** Adaptive pack speedup for multi-enemy rounds */
  adaptivePackSpeedup: boolean;
}

export const DEFAULT_COMBAT_PRESENTATION_CONFIG: CombatPresentationConfig = {
  enabled: true,
  windupSec: 0.15,
  rangedBeat1Sec: 0.24,
  rangedWhipPanSec: 0.13,
  holdNormalSec: 0.60,
  holdCritSec: 1.00,
  resetSec: 0.25,
  hitstopNormalSec: 0.12,
  hitstopAoeSec: 0.16,
  hitstopCritSec: 0.25,
  whiteFlashFrames: 3,
  zoomNormal: 1.52,
  zoomCrit: 1.80,
  zoomRangedShooter: 1.42,
  zoomAoeMin: 1.22,
  zoomAoeMax: 1.30,
  holdZoomCreepPct: 0.08,
  rangedLeadRoomVw: 0.06,
  dutchDegNormal: 2.2,
  dutchDegCrit: 3.5,
  dimmerAlpha: 0.75,
  shakeTraumaNormal: 0.45,
  shakeTraumaCrit: 0.85,
  shakeDecayPerSec: 2.2,
  shakeNormalVw: 0.011,
  shakeCritVw: 0.022,
  meleeClashSlideRatio: 0.34,
  meleeClashGapVw: 0.125,
  meleeForegroundScale: 1.07,
  rangedSlotLungeRatio: 0.08,
  knockbackNormalVw: 0.045,
  knockbackCritVw: 0.060,
  holdDriftApartVw: 0.014,
  attackerScalePunch: 1.28,
  aoeCascadeStepMs: 40,
  hideWorldUiDuringCutIn: true,
  critSpeedLinesEnabled: true,
  critInvertFlashEnabled: true,
  adaptivePackSpeedup: true,
};

/**
 * Computes an adaptive tempo multiplier for multi-enemy rounds so large packs
 * resolve sequentially without sluggish dead air:
 * - 1-2 active enemies: 1.0x (full dramatic weight)
 * - 3-4 active enemies: 0.80x (20% faster beats)
 * - 5+ active enemies:  0.64x (36% faster beats)
 */
export function computePackTempoScale(
  livingEnemyCount: number,
  adaptiveEnabled = true,
): number {
  if (!adaptiveEnabled) return 1.0;
  if (livingEnemyCount <= 2) return 1.0;
  if (livingEnemyCount <= 4) return 0.8;
  return 0.64;
}

/**
 * Duration (ms) for brisk on-stage non-cut-in cues (armor, bolster, charge, stagger, shield, tech).
 */
export function computeNonCutInBeatMs(
  cueKinds: readonly string[],
  livingEnemyCount: number,
  adaptiveEnabled = true,
): number {
  const scale = computePackTempoScale(livingEnemyCount, adaptiveEnabled);
  if (cueKinds.includes('hero_tech')) return Math.round(520 * Math.max(0.82, scale));
  if (cueKinds.includes('hero_shield')) return Math.round(420 * Math.max(0.82, scale));
  if (cueKinds.includes('enemy_bolster') || cueKinds.includes('enemy_armor')) {
    return Math.round(420 * scale);
  }
  if (cueKinds.includes('enemy_charge') || cueKinds.includes('enemy_stagger')) {
    return Math.round(340 * scale);
  }
  return Math.round(300 * scale);
}
