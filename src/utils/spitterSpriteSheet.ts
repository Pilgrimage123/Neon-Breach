import type { SpriteRect } from './spriteCutout';
import {
  type FrameTransitionInput,
  type FrameTransitionResult,
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleDeathCollapseFrame,
  sampleSequence,
} from './spriteSheetAnim';

export const SPITTER_SHEET_WIDTH = 1024;
export const SPITTER_SHEET_HEIGHT = 1024;
export const SPITTER_CANONICAL_HEIGHT = 246;

export interface SpitterSpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Horizontal offset inside frame rect (before facing flip) centered on stance/feet */
  anchorX: number;
  /** Vertical offset inside frame rect where claws/feet touch the bridge deck */
  bottomY: number;
  /** Relative offset from (anchorX, bottomY) in unscaled pixels (after left-flip, -dx is left/forward toward hero) */
  mouthOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) in unscaled pixels centered on bulging shoulder pustules */
  pustuleOriginRel: { dx: number; dy: number };
}

/**
 * 4x4 Sprite Sheet (`1024x1024`) for the Bile Spitter (Ref-conditioned on uploaded PNG):
 * - Row 0 (`0..3`): Dripping idle, jaw snap, forward claw stalk, swollen-cyst crouch over acid puddle
 * - Row 1 (`4..7`): Acid Bile Torrent (throat-cyst inhale -> jaw spray -> pressurized stream -> snout wipe)
 * - Row 2 (`8..11`): Caustic Claw Rend & Pustule Guard (overhead double-claw windup -> forward rake -> glowing pustule guard -> guard stance)
 * - Row 3 (`12..15`): Bursting Pustule Recoil, Stagger, Collapse & Liquefying Acid Carcass
 *
 * Source figures face right and are mirrored (`scale(-1, 1)`) in the combat stage to face the hero on the left.
 */
export const SPITTER_SHEET_FRAMES: readonly SpitterSpriteFrame[] = [
  // Row 0: Idle & Swollen Blight Crouch
  {
    id: 'spitter_idle_0',
    row: 0,
    col: 0,
    x: 34,
    y: 8,
    w: 175,
    h: 246,
    anchorX: 68,
    bottomY: 245,
    mouthOriginRel: { dx: -76, dy: -176 },
    pustuleOriginRel: { dx: -24, dy: -168 },
  },
  {
    id: 'spitter_idle_1',
    row: 0,
    col: 1,
    x: 286,
    y: 8,
    w: 179,
    h: 246,
    anchorX: 69,
    bottomY: 245,
    mouthOriginRel: { dx: -78, dy: -176 },
    pustuleOriginRel: { dx: -22, dy: -168 },
  },
  {
    id: 'spitter_stalk_2',
    row: 0,
    col: 2,
    x: 522,
    y: 12,
    w: 236,
    h: 238,
    anchorX: 80,
    bottomY: 237,
    mouthOriginRel: { dx: -84, dy: -164 },
    pustuleOriginRel: { dx: -26, dy: -158 },
  },
  {
    id: 'spitter_swell_3',
    row: 0,
    col: 3,
    x: 777,
    y: 10,
    w: 208,
    h: 224,
    anchorX: 101,
    bottomY: 223,
    // Strip outer baked-in floor puddle wings below the planted claws so puddle never pops on/off
    excludeRects: [
      { x: 0, y: 196, w: 48, h: 28 },
      { x: 154, y: 194, w: 54, h: 30 },
    ],
    mouthOriginRel: { dx: -68, dy: -154 },
    pustuleOriginRel: { dx: -16, dy: -166 },
  },

  // Row 1: Acid Bile Torrent
  {
    id: 'spitter_spit_windup_4',
    row: 1,
    col: 0,
    x: 28,
    y: 261,
    w: 174,
    h: 248,
    anchorX: 73,
    bottomY: 247,
    mouthOriginRel: { dx: -72, dy: -182 },
    pustuleOriginRel: { dx: -16, dy: -168 },
  },
  {
    id: 'spitter_spit_fire_5',
    row: 1,
    col: 1,
    x: 274,
    y: 262,
    w: 184,
    h: 247,
    anchorX: 74,
    bottomY: 246,
    // Trim floating mid-air spray wedge above the lower claw so the procedural bile jet connects seamlessly at the jaws
    excludeRects: [{ x: 158, y: 36, w: 26, h: 86 }],
    mouthOriginRel: { dx: -80, dy: -174 },
    pustuleOriginRel: { dx: -18, dy: -166 },
  },
  {
    id: 'spitter_spit_stream_6',
    row: 1,
    col: 2,
    x: 521,
    y: 263,
    w: 186,
    h: 246,
    anchorX: 77,
    bottomY: 245,
    // Trim truncated horizontal bile bar past the open jaws so the procedural bile stream flows continuously to the hero
    excludeRects: [{ x: 160, y: 34, w: 26, h: 90 }],
    mouthOriginRel: { dx: -82, dy: -175 },
    pustuleOriginRel: { dx: -20, dy: -166 },
  },
  {
    id: 'spitter_spit_recover_7',
    row: 1,
    col: 3,
    x: 790,
    y: 263,
    w: 188,
    h: 246,
    anchorX: 77,
    bottomY: 245,
    // Strip overhanging green bile stream tips from frame 6 on upper-left edge
    excludeRects: [{ x: 0, y: 40, w: 32, h: 105 }],
    mouthOriginRel: { dx: -70, dy: -170 },
    pustuleOriginRel: { dx: -22, dy: -164 },
  },

  // Row 2: Caustic Claw Rend & Pustule Guard
  {
    id: 'spitter_claw_windup_8',
    row: 2,
    col: 0,
    x: 18,
    y: 517,
    w: 229,
    h: 248,
    anchorX: 90,
    bottomY: 247,
    mouthOriginRel: { dx: -66, dy: -172 },
    pustuleOriginRel: { dx: -12, dy: -166 },
  },
  {
    id: 'spitter_claw_lunge_9',
    row: 2,
    col: 1,
    x: 265,
    y: 530,
    w: 245,
    h: 233,
    anchorX: 88,
    bottomY: 232,
    mouthOriginRel: { dx: -82, dy: -168 },
    pustuleOriginRel: { dx: -14, dy: -158 },
  },
  {
    id: 'spitter_pustule_flare_10',
    row: 2,
    col: 2,
    x: 533,
    y: 520,
    w: 199,
    h: 246,
    anchorX: 84,
    bottomY: 245,
    mouthOriginRel: { dx: -58, dy: -164 },
    pustuleOriginRel: { dx: 12, dy: -172 },
  },
  {
    id: 'spitter_guard_11',
    row: 2,
    col: 3,
    x: 787,
    y: 533,
    w: 215,
    h: 233,
    anchorX: 84,
    bottomY: 232,
    mouthOriginRel: { dx: -68, dy: -162 },
    pustuleOriginRel: { dx: -10, dy: -160 },
  },

  // Row 3: Pustule Burst Pain & Melting Acid Death
  {
    id: 'spitter_pain_burst_12',
    row: 3,
    col: 0,
    x: 26,
    y: 773,
    w: 201,
    h: 249,
    anchorX: 92,
    bottomY: 248,
    mouthOriginRel: { dx: -44, dy: -188 },
    pustuleOriginRel: { dx: 24, dy: -174 },
  },
  {
    id: 'spitter_stagger_13',
    row: 3,
    col: 1,
    x: 290,
    y: 776,
    w: 193,
    h: 245,
    anchorX: 88,
    bottomY: 244,
    mouthOriginRel: { dx: -60, dy: -172 },
    pustuleOriginRel: { dx: -8, dy: -166 },
  },
  {
    id: 'spitter_collapse_14',
    row: 3,
    col: 2,
    x: 516,
    y: 805,
    w: 249,
    h: 214,
    anchorX: 129,
    bottomY: 213,
    mouthOriginRel: { dx: -58, dy: -108 },
    pustuleOriginRel: { dx: 8, dy: -136 },
  },
  {
    id: 'spitter_dead_15',
    row: 3,
    col: 3,
    x: 772,
    y: 876,
    w: 248,
    h: 141,
    anchorX: 125,
    bottomY: 140,
    mouthOriginRel: { dx: -36, dy: -46 },
    pustuleOriginRel: { dx: 8, dy: -74 },
  },
];

export type SpitterAnimMode =
  | 'idle'
  | 'blightCharge'
  | 'guard'
  | 'spit'
  | 'claw'
  | 'rupture'
  | 'pain'
  | 'death';

export interface SpitterAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  spitterAttackKind?: 'spit' | 'claw';
  bristleTimer?: number;
  bristleDuration?: number;
  bristleKind?: 'armor' | 'retaliate' | 'pustule_rupture';
  blightPrimed?: boolean;
  armoredGuard?: boolean;
  pustuleHover?: boolean;
}

export interface SpitterFrameSample {
  mode: SpitterAnimMode;
  frameIndex: number;
  frame: SpitterSpriteFrame;
  prevFrameIndex: number;
  prevFrame: SpitterSpriteFrame;
  frameBlendAlpha: number;
  transitionState: FrameTransitionResult;
  /** Additional horizontal dash/lunge ratio relative to size (negative = left toward hero) */
  xOffsetRatio: number;
  /** Additional vertical leap/hop in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Luminous chartreuse-amber spore cyst intensity [0..1] */
  pustuleGlowIntensity: number;
  /** Normalized progress [0..1] of the pressurized yellow bile spit stream (0 when inactive) */
  spitStreamProgress: number;
  alpha: number;
}

const SPIT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 4, until: 0.22, xProgress: 0.05, yHopPx: 0 },
  { frameIndex: 5, until: 0.52, xProgress: -0.05, yHopPx: -2 },
  { frameIndex: 6, until: 0.82, xProgress: -0.08, yHopPx: 0 },
  { frameIndex: 7, until: 1.00, xProgress: -0.02, yHopPx: 0 },
];

const CLAW_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.26, xProgress: 0.06, yHopPx: -4 },
  { frameIndex: 9, until: 0.72, xProgress: -0.32, yHopPx: -8, dashing: true },
  { frameIndex: 11, until: 1.00, xProgress: -0.08, yHopPx: 0 },
];

const RUPTURE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 12, until: 0.48, xProgress: 0.05, yHopPx: -3 },
  { frameIndex: 10, until: 0.82, xProgress: 0.01, yHopPx: -2 },
  { frameIndex: 11, until: 1.00, xProgress: 0, yHopPx: 0 },
];

export function sampleSpitterFrame(
  anim: SpitterAnimInput | undefined,
  elapsed: number,
  instanceIndex = 0,
  prevTransition?: FrameTransitionInput,
  dt = 0.016,
): SpitterFrameSample {
  let mode: SpitterAnimMode = 'idle';
  let frameIndex = 0;
  let xOffsetRatio = 0;
  let yHopPx = 0;
  let alpha = 1;
  let pustuleGlowIntensity = 0.26 + 0.12 * Math.sin(elapsed * 2.6 + instanceIndex);
  let breathScaleX = 1;
  let breathScaleY = 1;
  let tiltRad = 0;
  let spitStreamProgress = 0;

  if (anim?.dead) {
    mode = 'death';
    const death = sampleDeathCollapseFrame(anim.koProgress, 12, 4, 0.8);
    frameIndex = death.frameIndex;
    alpha = death.alpha;
    pustuleGlowIntensity = Math.max(0, 0.55 * (1 - death.progress * 1.2));
  } else if (anim && (anim.bristleTimer ?? 0) > 0 && (anim.bristleDuration ?? 0) > 0) {
    mode = 'rupture';
    const dur = anim.bristleDuration ?? 0.52;
    const u = Math.max(0, Math.min(0.999, 1 - (anim.bristleTimer ?? 0) / dur));
    const seq = sampleSequence(RUPTURE_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    const swell = Math.sin(u * Math.PI);
    xOffsetRatio = swell * 0.045;
    yHopPx = -swell * 3.0;
    pustuleGlowIntensity = anim.bristleKind === 'pustule_rupture' ? 1.0 : 0.88;
    breathScaleX = 1 + swell * 0.045;
    breathScaleY = 1 + swell * 0.04;
  } else if (anim && anim.staggerTimer > 0 && anim.staggerDuration > 0) {
    mode = 'pain';
    const u = Math.max(0, Math.min(0.999, 1 - anim.staggerTimer / anim.staggerDuration));
    frameIndex = u < 0.45 ? 12 : 13;
    pustuleGlowIntensity = 0.72 * (1 - u * 0.35);
    tiltRad = 0.04 * Math.sin(u * Math.PI);
  } else if (anim && anim.attackAnimTimer > 0 && anim.attackAnimDuration > 0) {
    const isClaw = anim.spitterAttackKind === 'claw';
    mode = isClaw ? 'claw' : 'spit';
    const u = Math.max(0, Math.min(0.999, 1 - anim.attackAnimTimer / anim.attackAnimDuration));
    const seq = sampleSequence(isClaw ? CLAW_SEQ : SPIT_SEQ, u, 0);
    frameIndex = seq.frameIndex;

    if (isClaw) {
      if (u < 0.26) {
        const a = Math.sin((u / 0.26) * (Math.PI * 0.5));
        xOffsetRatio = a * 0.06;
        yHopPx = -a * 4;
        tiltRad = a * 0.05;
      } else if (u < 0.72) {
        const s = (u - 0.26) / 0.46;
        const arc = Math.sin(s * Math.PI);
        xOffsetRatio = 0.06 * (1 - s) - Math.sin(s * (Math.PI * 0.5)) * 0.32;
        yHopPx = -4 * (1 - s) - arc * 8;
        tiltRad = -Math.sin(s * Math.PI) * 0.075;
      } else {
        const r = (u - 0.72) / 0.28;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        xOffsetRatio = -0.32 * ease;
        yHopPx = 0;
        tiltRad = -0.025 * ease;
      }
      pustuleGlowIntensity = u < 0.72 ? 0.84 : 0.55;
    } else {
      // C1-continuous Acid Bile Spit kinematics + synchronized yellow bile stream progress
      if (u < 0.22) {
        const a = Math.sin((u / 0.22) * (Math.PI * 0.5));
        xOffsetRatio = a * 0.055;
        yHopPx = 0;
        tiltRad = a * 0.045;
      } else if (u < 0.82) {
        const s = (u - 0.22) / 0.60;
        const thrust = Math.sin(Math.min(1, s / 0.45) * (Math.PI * 0.5));
        const settle = s > 0.65 ? (s - 0.65) / 0.35 : 0;
        xOffsetRatio = (0.055 * (1 - thrust) - 0.085 * thrust) * (1 - settle * 0.55);
        yHopPx = -Math.sin(s * Math.PI) * 3.5;
        tiltRad = -0.045 * Math.sin(s * Math.PI);
        spitStreamProgress = Math.max(0.01, Math.min(1, (u - 0.20) / 0.64));
      } else {
        const r = (u - 0.82) / 0.18;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        xOffsetRatio = -0.038 * ease;
        yHopPx = 0;
        tiltRad = 0;
      }
      pustuleGlowIntensity = u > 0.18 && u < 0.84 ? 0.94 : 0.48;
    }
  } else if (anim?.pustuleHover) {
    mode = 'guard';
    frameIndex = 10;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.5 + instanceIndex);
    pustuleGlowIntensity = 0.86 + 0.14 * pulse;
    breathScaleX = 1 + pulse * 0.024;
    breathScaleY = 1 + pulse * 0.018;
  } else if (anim?.blightPrimed) {
    // Hold Frame 4 (swollen yellow throat cyst, planted feet, no floor-puddle flicker)
    mode = 'blightCharge';
    frameIndex = 4;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.8 + instanceIndex);
    pustuleGlowIntensity = 0.72 + 0.24 * pulse;
    breathScaleX = 1 + pulse * 0.022;
    breathScaleY = 1 + pulse * 0.018;
  } else if (anim?.armoredGuard) {
    mode = 'guard';
    frameIndex = 11;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.0 + instanceIndex);
    pustuleGlowIntensity = 0.58 + 0.22 * pulse;
    breathScaleX = 1 + pulse * 0.015;
    breathScaleY = 1 + pulse * 0.012;
  } else {
    // Per ENEMY_ANIMATION_GUIDE.md Section 1.1 & 9.1:
    // Hold neutral Frame 0 and briefly snap/blink to Frame 1 (identical stance silhouette) once per cycle.
    // Never rapidly cycle wide locomotion Frame 2 in stationary idle!
    mode = 'idle';
    const blinkCycle = (elapsed + instanceIndex * 0.85) % 2.6;
    frameIndex = blinkCycle >= 2.38 ? 1 : 0;
    const breath = Math.sin(elapsed * 2.2 + instanceIndex * 1.4);
    breathScaleY = 1 + breath * 0.014;
    breathScaleX = 1 - breath * 0.007;
  }

  const blendDur = mode === 'spit' || mode === 'claw' || mode === 'rupture' ? 0.055 : 0.075;
  const transitionState = computeFrameTransitionState(
    prevTransition ?? {},
    frameIndex,
    dt,
    blendDur,
  );

  return {
    mode,
    frameIndex,
    frame: SPITTER_SHEET_FRAMES[frameIndex],
    prevFrameIndex: transitionState.prevFrameIndex,
    prevFrame: SPITTER_SHEET_FRAMES[transitionState.prevFrameIndex] ?? SPITTER_SHEET_FRAMES[frameIndex],
    frameBlendAlpha: mode === 'death' ? 1 : transitionState.frameBlendAlpha,
    transitionState,
    xOffsetRatio,
    yHopPx,
    breathScaleX,
    breathScaleY,
    tiltRad,
    pustuleGlowIntensity,
    spitStreamProgress,
    alpha,
  };
}
