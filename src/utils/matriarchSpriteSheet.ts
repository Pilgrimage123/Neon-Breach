/**
 * Data-driven sprite frame definitions, pixel-scanned VFX landmarks, and
 * hanging acid-lime slime drip nozzles for the Xenomorph Matriarch (`boss`).
 *
 * Frame 0 (`matriarch_intact.png`, 585x640): Phase 1 intact queen (hp > 50% maxHp).
 * Frame 1 (`matriarch_exploded.png`, 640x427): Phase 2 ruptured-back enraged queen (hp <= 50% maxHp).
 *
 * Both sprites are natively LEFT-facing (`facingSign = +1`, `nativeFacingSign = 1`)
 * and share `MATRIARCH_CANONICAL_HEIGHT = 560` so head/eye/claw proportions remain
 * 1:1 anatomically consistent when her back explodes and she drops into her low lunge.
 */
import type { SpriteRect } from './spriteCutout';

export type MatriarchAnimMode =
  | 'idle'
  | 'primed'
  | 'guard'
  | 'attack'
  | 'rupture'
  | 'pain'
  | 'death';

export type MatriarchBoneWeight = 'head' | 'waist' | 'pelvis';

export interface MatriarchSlimeNozzleSpec {
  id: string;
  /** Offset in unscaled sprite pixels relative to (anchorX, bottomY). */
  dx: number;
  dy: number;
  bone: MatriarchBoneWeight;
  baseRadius: number;
  maxStretchPx: number;
  baseIntervalSec: number;
  phaseOffset: number;
}

export interface MatriarchFrameRect extends SpriteRect {
  id: string;
  /** Pelvis-centroid horizontal anchor in sprite pixels (35%-65% height band). */
  anchorX: number;
  /** Ground-contact sole Y coordinate in sprite pixels. */
  bottomY: number;
  /** Glowing magenta eye center relative to (anchorX, bottomY). */
  eyeOriginRel: { dx: number; dy: number };
  /** Fanged jaw / tongue drip center relative to (anchorX, bottomY). */
  jawOriginRel: { dx: number; dy: number };
  /** Leading front scythe claw tip relative to (anchorX, bottomY). */
  clawOriginRel: { dx: number; dy: number };
  /** Dorsal egg sac / exploded back cavity centroid relative to (anchorX, bottomY). */
  backOriginRel: { dx: number; dy: number };
}

/**
 * Shared canonical height in sprite pixels so intact (585x640) and ruptured-back
 * (640x427) preserve identical head, eye, and claw proportions across the 50% HP cut.
 */
export const MATRIARCH_CANONICAL_HEIGHT = 560;

/** Matriarch's dorsal carapace explodes once HP drops to or below half max HP. */
export const MATRIARCH_BACK_EXPLOSION_HP_RATIO = 0.5;

export function isMatriarchBackExploded(hp: number, maxHp: number): boolean {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return false;
  return hp <= maxHp * MATRIARCH_BACK_EXPLOSION_HP_RATIO;
}

export const MATRIARCH_SHEET_FRAMES: readonly [MatriarchFrameRect, MatriarchFrameRect] = [
  {
    id: 'matriarch_intact',
    x: 0,
    y: 0,
    w: 585,
    h: 640,
    anchorX: 300,
    bottomY: 624,
    eyeOriginRel: { dx: -137, dy: -400 },
    jawOriginRel: { dx: -172, dy: -338 },
    clawOriginRel: { dx: -238, dy: -144 },
    backOriginRel: { dx: 151, dy: -291 },
  },
  {
    id: 'matriarch_exploded',
    x: 0,
    y: 0,
    w: 640,
    h: 427,
    anchorX: 322,
    bottomY: 418,
    eyeOriginRel: { dx: -164, dy: -255 },
    jawOriginRel: { dx: -180, dy: -186 },
    clawOriginRel: { dx: -281, dy: -33 },
    backOriginRel: { dx: 108, dy: -253 },
  },
] as const;

/** Pixel-verified hanging acid-lime slime tips on Frame 0 (matriarch_intact.png). */
export const MATRIARCH_INTACT_SLIME_NOZZLES: readonly MatriarchSlimeNozzleSpec[] = [
  {
    id: 'intact_ant_upper',
    dx: -294,
    dy: -469,
    bone: 'head',
    baseRadius: 4.4,
    maxStretchPx: 32,
    baseIntervalSec: 2.35,
    phaseOffset: 0.14,
  },
  {
    id: 'intact_ant_lower',
    dx: -263,
    dy: -440,
    bone: 'head',
    baseRadius: 4.8,
    maxStretchPx: 36,
    baseIntervalSec: 1.95,
    phaseOffset: 0.58,
  },
  {
    id: 'intact_jaw_drip',
    dx: -114,
    dy: -287,
    bone: 'head',
    baseRadius: 5.0,
    maxStretchPx: 34,
    baseIntervalSec: 2.15,
    phaseOffset: 0.36,
  },
  {
    id: 'intact_scythe_outer',
    dx: -276,
    dy: -198,
    bone: 'waist',
    baseRadius: 4.6,
    maxStretchPx: 30,
    baseIntervalSec: 2.5,
    phaseOffset: 0.72,
  },
  {
    id: 'intact_scythe_tip',
    dx: -238,
    dy: -134,
    bone: 'waist',
    baseRadius: 5.2,
    maxStretchPx: 38,
    baseIntervalSec: 1.85,
    phaseOffset: 0.22,
  },
  {
    id: 'intact_belly_drip',
    dx: -44,
    dy: -210,
    bone: 'pelvis',
    baseRadius: 4.5,
    maxStretchPx: 28,
    baseIntervalSec: 2.65,
    phaseOffset: 0.84,
  },
  {
    id: 'intact_sac_rear',
    dx: 237,
    dy: -125,
    bone: 'pelvis',
    baseRadius: 5.1,
    maxStretchPx: 34,
    baseIntervalSec: 2.05,
    phaseOffset: 0.48,
  },
] as const;

/** Pixel-verified hanging acid-lime slime tips on Frame 1 (matriarch_exploded.png). */
export const MATRIARCH_EXPLODED_SLIME_NOZZLES: readonly MatriarchSlimeNozzleSpec[] = [
  {
    id: 'exp_fore_upper',
    dx: -282,
    dy: -139,
    bone: 'head',
    baseRadius: 4.8,
    maxStretchPx: 30,
    baseIntervalSec: 1.7,
    phaseOffset: 0.12,
  },
  {
    id: 'exp_scythe_tip',
    dx: -281,
    dy: -26,
    bone: 'waist',
    baseRadius: 5.2,
    maxStretchPx: 22,
    baseIntervalSec: 1.55,
    phaseOffset: 0.45,
  },
  {
    id: 'exp_scythe_mid',
    dx: -242,
    dy: -54,
    bone: 'waist',
    baseRadius: 4.7,
    maxStretchPx: 26,
    baseIntervalSec: 1.85,
    phaseOffset: 0.76,
  },
  {
    id: 'exp_jaw_drip',
    dx: -172,
    dy: -66,
    bone: 'head',
    baseRadius: 4.9,
    maxStretchPx: 28,
    baseIntervalSec: 1.65,
    phaseOffset: 0.28,
  },
  {
    id: 'exp_belly_drip',
    dx: -74,
    dy: -125,
    bone: 'pelvis',
    baseRadius: 4.6,
    maxStretchPx: 32,
    baseIntervalSec: 1.9,
    phaseOffset: 0.62,
  },
  {
    id: 'exp_back_ooze_rear',
    dx: 209,
    dy: -72,
    bone: 'pelvis',
    baseRadius: 5.4,
    maxStretchPx: 34,
    baseIntervalSec: 1.45,
    phaseOffset: 0.34,
  },
  {
    id: 'exp_back_ooze_crest',
    dx: 246,
    dy: -106,
    bone: 'waist',
    baseRadius: 5.0,
    maxStretchPx: 36,
    baseIntervalSec: 1.6,
    phaseOffset: 0.88,
  },
] as const;

export interface MatriarchFrameSample {
  mode: MatriarchAnimMode;
  frameIndex: 0 | 1;
  frame: MatriarchFrameRect;
  prevFrameIndex: number;
  prevFrame: MatriarchFrameRect;
  /** Always 1 — crisp-cut policy prevents ghosting between intact and exploded silhouettes. */
  frameBlendAlpha: number;
  isBackExploded: boolean;
  /** Progress [0..1] of the one-shot dorsal carapace rupture sequence (0 when inactive). */
  ruptureProgress: number;
  xOffsetRatio: number;
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Bioluminescent egg-sac / exposed back cavity glow intensity [0..1]. */
  backGlowIntensity: number;
  /** Magenta ocular glow intensity [0..1]. */
  eyeGlowIntensity: number;
  /** Twin scythe slash arc progress [0..1]. */
  clawSlashProgress: number;
  alpha: number;
}
