import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';
import {
  type FrameTransitionInput,
  type FrameTransitionResult,
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleDeathCollapseFrame,
  sampleSequence,
} from './spriteSheetAnim';

export const MUTDOG_SHEET_WIDTH = 1024;
export const MUTDOG_SHEET_HEIGHT = 1024;
export const MUTDOG_CANONICAL_HEIGHT = 182;

export const MUTDOG_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.78,
  unmixLightGlow: true,
};

export interface MutdogSpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Horizontal offset inside frame rect (before left-facing flip) centered on ribcage/torso mass */
  anchorX: number;
  /** Vertical offset inside frame rect where clawed paws meet the bridge deck */
  bottomY: number;
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px (-dx = left/forward) for twin glowing lure bulbs */
  lureOriginRel: { dx: number; dy: number };
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px (-dx = left/forward) for foaming jaws */
  mawOriginRel: { dx: number; dy: number };
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px for leading foreclaw rake/impact */
  clawOriginRel: { dx: number; dy: number };
}

/**
 * 4x4 Sprite Sheet (`1024x1024`) for the Rabid MutDog (Ref-conditioned on uploaded PNG):
 * - Row 0 (`0..3`): Panting idle & snarl loop (A -> high inhale B -> bared-fang snarl C -> low stalking crouch D)
 * - Row 1 (`4..7`): Frenzy howl (lures flaring upward), pounce-coil prime, tense arched guard & leaping prowl bound
 * - Row 2 (`8..11`): Reared pounce launch -> airborne lunge -> ground-slam maul impact -> raking foreclaw rend
 * - Row 3 (`12..15`): Hit pain whip recoil, staggered crouch, buckling collapse & flat defeated sprawl
 *
 * Source figures face right and are mirrored (`scale(-1, 1)`) on stage to face the hero on the left.
 */
export const MUTDOG_SHEET_FRAMES: readonly MutdogSpriteFrame[] = [
  // Row 0: Panting Idle & Snarl Loop
  {
    id: 'mutdog_idle_0',
    row: 0,
    col: 0,
    x: 5,
    y: 51,
    w: 250,
    h: 170,
    anchorX: 133,
    bottomY: 167,
    lureOriginRel: { dx: -79, dy: -127 },
    mawOriginRel: { dx: -74, dy: -108 },
    clawOriginRel: { dx: -48, dy: -14 },
  },
  {
    id: 'mutdog_idle_1',
    row: 0,
    col: 1,
    x: 255,
    y: 43,
    w: 257,
    h: 178,
    anchorX: 135,
    bottomY: 175,
    lureOriginRel: { dx: -80, dy: -134 },
    mawOriginRel: { dx: -72, dy: -127 },
    clawOriginRel: { dx: -52, dy: -14 },
  },
  {
    id: 'mutdog_snarl_2',
    row: 0,
    col: 2,
    x: 511,
    y: 39,
    w: 257,
    h: 182,
    anchorX: 135,
    bottomY: 179,
    lureOriginRel: { dx: -77, dy: -139 },
    mawOriginRel: { dx: -74, dy: -120 },
    clawOriginRel: { dx: -52, dy: -14 },
  },
  {
    id: 'mutdog_stalk_3',
    row: 0,
    col: 3,
    x: 767,
    y: 70,
    w: 254,
    h: 150,
    anchorX: 130,
    bottomY: 147,
    lureOriginRel: { dx: -91, dy: -113 },
    mawOriginRel: { dx: -82, dy: -98 },
    clawOriginRel: { dx: -54, dy: -12 },
  },

  // Row 1: Frenzy Howl, Pounce-Coil Prime, Guard & Prowl Bound
  {
    id: 'mutdog_howl_4',
    row: 1,
    col: 0,
    x: 6,
    y: 241,
    w: 249,
    h: 244,
    anchorX: 140,
    bottomY: 241,
    lureOriginRel: { dx: -57, dy: -205 },
    mawOriginRel: { dx: -54, dy: -182 },
    clawOriginRel: { dx: -44, dy: -16 },
  },
  {
    id: 'mutdog_coil_prime_5',
    row: 1,
    col: 1,
    x: 269,
    y: 305,
    w: 243,
    h: 176,
    anchorX: 124,
    bottomY: 173,
    lureOriginRel: { dx: -82, dy: -129 },
    mawOriginRel: { dx: -71, dy: -126 },
    clawOriginRel: { dx: -44, dy: -12 },
  },
  {
    id: 'mutdog_guard_6',
    row: 1,
    col: 2,
    x: 516,
    y: 283,
    w: 252,
    h: 202,
    anchorX: 130,
    bottomY: 199,
    lureOriginRel: { dx: -84, dy: -145 },
    mawOriginRel: { dx: -73, dy: -143 },
    clawOriginRel: { dx: -54, dy: -14 },
  },
  {
    id: 'mutdog_bound_7',
    row: 1,
    col: 3,
    x: 767,
    y: 293,
    w: 254,
    h: 189,
    anchorX: 134,
    bottomY: 186,
    lureOriginRel: { dx: -80, dy: -145 },
    mawOriginRel: { dx: -79, dy: -142 },
    clawOriginRel: { dx: -64, dy: -40 },
  },

  // Row 2: Pounce Launch, Airborne Leap, Maul Slam & Claw Rend
  {
    id: 'mutdog_pounce_coil_8',
    row: 2,
    col: 0,
    x: 19,
    y: 517,
    w: 236,
    h: 245,
    anchorX: 126,
    bottomY: 242,
    lureOriginRel: { dx: -72, dy: -203 },
    mawOriginRel: { dx: -71, dy: -190 },
    clawOriginRel: { dx: -62, dy: -88 },
  },
  {
    id: 'mutdog_pounce_air_9',
    row: 2,
    col: 1,
    x: 255,
    y: 520,
    w: 257,
    h: 209,
    anchorX: 147,
    bottomY: 206,
    lureOriginRel: { dx: -80, dy: -160 },
    mawOriginRel: { dx: -86, dy: -162 },
    clawOriginRel: { dx: -88, dy: -94 },
  },
  {
    id: 'mutdog_maul_slam_10',
    row: 2,
    col: 2,
    x: 511,
    y: 534,
    w: 257,
    h: 228,
    anchorX: 140,
    bottomY: 225,
    excludeRects: [{ x: 224, y: 170, w: 33, h: 56 }],
    lureOriginRel: { dx: -62, dy: -168 },
    mawOriginRel: { dx: -67, dy: -140 },
    clawOriginRel: { dx: -66, dy: -12 },
  },
  {
    id: 'mutdog_claw_rend_11',
    row: 2,
    col: 3,
    x: 774,
    y: 550,
    w: 234,
    h: 204,
    anchorX: 123,
    bottomY: 201,
    lureOriginRel: { dx: -71, dy: -151 },
    mawOriginRel: { dx: -61, dy: -144 },
    clawOriginRel: { dx: -88, dy: -66 },
  },

  // Row 3: Hit Recoil, Stagger, Buckling & Defeat Collapse
  {
    id: 'mutdog_pain_recoil_12',
    row: 3,
    col: 0,
    x: 17,
    y: 769,
    w: 238,
    h: 248,
    anchorX: 123,
    bottomY: 245,
    lureOriginRel: { dx: -52, dy: -212 },
    mawOriginRel: { dx: -48, dy: -210 },
    clawOriginRel: { dx: -74, dy: -116 },
  },
  {
    id: 'mutdog_stagger_13',
    row: 3,
    col: 1,
    x: 259,
    y: 812,
    w: 253,
    h: 201,
    anchorX: 131,
    bottomY: 198,
    lureOriginRel: { dx: -84, dy: -133 },
    mawOriginRel: { dx: -76, dy: -136 },
    clawOriginRel: { dx: -54, dy: -14 },
  },
  {
    id: 'mutdog_collapse_14',
    row: 3,
    col: 2,
    x: 514,
    y: 841,
    w: 254,
    h: 179,
    anchorX: 130,
    bottomY: 176,
    lureOriginRel: { dx: -83, dy: -121 },
    mawOriginRel: { dx: -76, dy: -106 },
    clawOriginRel: { dx: -54, dy: -12 },
  },
  {
    id: 'mutdog_dead_15',
    row: 3,
    col: 3,
    x: 767,
    y: 901,
    w: 252,
    h: 119,
    anchorX: 129,
    bottomY: 116,
    lureOriginRel: { dx: -68, dy: -97 },
    mawOriginRel: { dx: -84, dy: -32 },
    clawOriginRel: { dx: -62, dy: -10 },
  },
];

export type MutdogAnimMode =
  | 'idle'
  | 'maulPrimed'
  | 'pouncePrimed'
  | 'pauseRecover'
  | 'feralGuard'
  | 'howl'
  | 'pounceMaul'
  | 'clawRend'
  | 'staggerHover'
  | 'staggered'
  | 'pain'
  | 'death';

export interface MutdogAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  mutdogAttackKind?: 'maul' | 'pounce';
  bristleTimer?: number;
  bristleDuration?: number;
  maulPrimed?: boolean;
  pouncePrimed?: boolean;
  pauseRecover?: boolean;
  feralGuard?: boolean;
  guardHover?: boolean;
  staggered?: boolean;
  staggerHover?: boolean;
}

export interface MutdogFrameSample {
  mode: MutdogAnimMode;
  frameIndex: number;
  frame: MutdogSpriteFrame;
  prevFrameIndex: number;
  prevFrame: MutdogSpriteFrame;
  frameBlendAlpha: number;
  transitionState: FrameTransitionResult;
  /** Additional horizontal dash/lunge ratio relative to size (negative = left toward hero) */
  xOffsetRatio: number;
  /** Additional vertical leap/hop in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Twin bioluminescent amber-orange lure bulb glow intensity [0..1] */
  lureGlowIntensity: number;
  /** Rabid foaming drool strand & splatter intensity [0..1] */
  droolIntensity: number;
  /** Ground pounce-slam impact ring intensity [0..1] */
  pounceImpactIntensity: number;
  /** Normalized progress [0..1] of the triple feral claw slash arc (0 when inactive) */
  clawSlashProgress: number;
  alpha: number;
}

const HOWL_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 5, until: 0.22, xProgress: 0.04, yHopPx: 2 },
  { frameIndex: 4, until: 0.68, xProgress: -0.02, yHopPx: -4 },
  { frameIndex: 6, until: 1.0, xProgress: 0.0, yHopPx: 0 },
];

const POUNCE_MAUL_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.22, xProgress: 0.08, yHopPx: 4 },
  { frameIndex: 9, until: 0.48, xProgress: -0.34, yHopPx: -36, dashing: true },
  { frameIndex: 10, until: 0.78, xProgress: -0.40, yHopPx: 0, dashing: true },
  { frameIndex: 11, until: 1.0, xProgress: -0.12, yHopPx: 0 },
];

const CLAW_REND_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 3, until: 0.20, xProgress: 0.06, yHopPx: 3 },
  { frameIndex: 9, until: 0.44, xProgress: -0.28, yHopPx: -20, dashing: true },
  { frameIndex: 11, until: 0.78, xProgress: -0.34, yHopPx: -4, dashing: true },
  { frameIndex: 1, until: 1.0, xProgress: -0.04, yHopPx: 0 },
];

const IDLE_PANT_CYCLE: readonly number[] = [0, 1, 0, 1, 2, 1, 0, 3];
const MAUL_PRIMED_CYCLE: readonly number[] = [5, 8, 5, 6];
const POUNCE_PRIMED_CYCLE: readonly number[] = [3, 5, 3, 2];
const PAUSE_RECOVER_CYCLE: readonly number[] = [0, 3];
const GUARD_CYCLE: readonly number[] = [6, 6, 2, 6];

export function sampleMutdogFrame(
  anim: MutdogAnimInput | undefined,
  elapsed: number,
  instanceIndex = 0,
  prevTransition?: FrameTransitionInput,
  dt = 0.016,
): MutdogFrameSample {
  let mode: MutdogAnimMode = 'idle';
  let frameIndex = 0;
  let xOffsetRatio = 0;
  let yHopPx = 0;
  let alpha = 1;
  let lureGlowIntensity = 0.42 + 0.16 * Math.sin(elapsed * 3.4 + instanceIndex);
  let droolIntensity = 0.34 + 0.14 * Math.sin(elapsed * 2.8 + instanceIndex * 0.9);
  let pounceImpactIntensity = 0;
  let clawSlashProgress = 0;
  let breathScaleX = 1;
  let breathScaleY = 1;
  let tiltRad = 0;

  if (anim?.dead) {
    mode = 'death';
    const death = sampleDeathCollapseFrame(anim.koProgress, 12, 4, 0.8);
    frameIndex = death.frameIndex;
    alpha = death.alpha;
    lureGlowIntensity = Math.max(0, 0.5 * (1 - death.progress * 1.45));
    droolIntensity = Math.max(0, 0.35 * (1 - death.progress * 1.3));
  } else if (anim && (anim.bristleTimer ?? 0) > 0 && (anim.bristleDuration ?? 0) > 0) {
    mode = 'howl';
    const dur = anim.bristleDuration ?? 0.74;
    const u = Math.max(0, Math.min(0.999, 1 - (anim.bristleTimer ?? 0) / dur));
    const seq = sampleSequence(HOWL_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    const swell = Math.sin(u * Math.PI);
    breathScaleX = 1 + swell * 0.05;
    breathScaleY = 1 + swell * 0.045;
    lureGlowIntensity = u >= 0.22 && u <= 0.72 ? 1.0 : 0.76;
    droolIntensity = u >= 0.22 ? 0.92 : 0.55;
    tiltRad = u < 0.22 ? 0.04 : u < 0.68 ? -0.055 : -0.015;
  } else if (anim && anim.staggerTimer > 0 && anim.staggerDuration > 0) {
    mode = 'pain';
    const u = Math.max(0, Math.min(0.999, 1 - anim.staggerTimer / anim.staggerDuration));
    frameIndex = u < 0.48 ? 12 : 13;
    lureGlowIntensity = 0.45 * (1 - u * 0.4);
    droolIntensity = 0.84 * (1 - u * 0.3);
    tiltRad = 0.068 * Math.sin(u * Math.PI);
  } else if (anim && anim.attackAnimTimer > 0 && anim.attackAnimDuration > 0) {
    const isMaul = anim.mutdogAttackKind === 'maul';
    mode = isMaul ? 'pounceMaul' : 'clawRend';
    const u = Math.max(0, Math.min(0.999, 1 - anim.attackAnimTimer / anim.attackAnimDuration));
    const seq = sampleSequence(isMaul ? POUNCE_MAUL_SEQ : CLAW_REND_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    if (isMaul) {
      if (u >= 0.22 && u < 0.48) {
        const s = (u - 0.22) / 0.26;
        const hangArc = 1 - Math.pow(2 * s - 1, 4);
        yHopPx = -38 * hangArc;
      }
      lureGlowIntensity = u < 0.8 ? 1.0 : 0.65;
      droolIntensity = 0.96;
      pounceImpactIntensity = u >= 0.48 && u <= 0.86 ? Math.sin(((u - 0.48) / 0.38) * Math.PI) : 0;
      if (u >= 0.48 && u <= 0.88) {
        clawSlashProgress = Math.max(0.01, Math.min(1, (u - 0.48) / 0.4));
      }
      if (u >= 0.48 && u <= 0.72) {
        const slamSquash = Math.sin(((u - 0.48) / 0.24) * Math.PI);
        breathScaleX = 1 + slamSquash * 0.11;
        breathScaleY = 1 - slamSquash * 0.095;
      }
      tiltRad = u < 0.22 ? 0.072 : u < 0.48 ? -0.055 : u < 0.78 ? -0.105 : -0.035;
    } else {
      lureGlowIntensity = 0.86;
      droolIntensity = 0.84;
      if (u >= 0.20 && u < 0.44) {
        const s = (u - 0.20) / 0.24;
        yHopPx = -22 * Math.sin(s * Math.PI);
      }
      if (u >= 0.36 && u < 0.82) {
        clawSlashProgress = Math.max(0.01, Math.min(1, (u - 0.36) / 0.46));
      }
      tiltRad = u < 0.20 ? 0.052 : u < 0.78 ? -0.088 : 0;
    }
  } else if (anim?.staggered) {
    mode = 'staggered';
    frameIndex = 13;
    const wobble = Math.sin(elapsed * 5.6 + instanceIndex);
    tiltRad = wobble * 0.032;
    breathScaleY = 1 + wobble * 0.016;
    lureGlowIntensity = 0.18;
    droolIntensity = 0.62;
  } else if (anim?.staggerHover) {
    mode = 'staggerHover';
    frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 9.5 + instanceIndex);
    lureGlowIntensity = 0.85 + 0.15 * pulse;
    droolIntensity = 0.72 + 0.22 * pulse;
    breathScaleX = 1 + pulse * 0.036;
    breathScaleY = 1 - pulse * 0.018;
  } else if (anim?.guardHover || anim?.feralGuard) {
    mode = 'feralGuard';
    const phase = Math.max(0, elapsed * 2.1 + instanceIndex * 0.9);
    const slot = Math.floor(phase) % GUARD_CYCLE.length;
    frameIndex = GUARD_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.8 + instanceIndex);
    lureGlowIntensity = 0.72 + 0.24 * pulse;
    droolIntensity = 0.58 + 0.18 * pulse;
    breathScaleX = 1 + pulse * 0.022;
    breathScaleY = 1 + pulse * 0.016;
  } else if (anim?.maulPrimed) {
    mode = 'maulPrimed';
    const phase = Math.max(0, elapsed * 2.9 + instanceIndex * 1.1);
    const slot = Math.floor(phase) % MAUL_PRIMED_CYCLE.length;
    frameIndex = MAUL_PRIMED_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 7.2 + instanceIndex);
    lureGlowIntensity = 0.82 + 0.18 * pulse;
    droolIntensity = 0.78 + 0.2 * pulse;
    breathScaleY = 1 + pulse * 0.026;
    breathScaleX = 1 - pulse * 0.015;
    tiltRad = -0.024 + pulse * 0.028;
  } else if (anim?.pouncePrimed) {
    mode = 'pouncePrimed';
    const phase = Math.max(0, elapsed * 2.4 + instanceIndex * 0.95);
    const slot = Math.floor(phase) % POUNCE_PRIMED_CYCLE.length;
    frameIndex = POUNCE_PRIMED_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.6 + instanceIndex);
    lureGlowIntensity = 0.66 + 0.22 * pulse;
    droolIntensity = 0.62 + 0.16 * pulse;
    breathScaleX = 1 + pulse * 0.024;
    breathScaleY = 1 - pulse * 0.014;
  } else if (anim?.pauseRecover) {
    mode = 'pauseRecover';
    const phase = Math.max(0, elapsed * 1.55 + instanceIndex * 0.75);
    const slot = Math.floor(phase) % PAUSE_RECOVER_CYCLE.length;
    frameIndex = PAUSE_RECOVER_CYCLE[slot];
    const heave = Math.sin(elapsed * 2.8 + instanceIndex);
    breathScaleX = 1 + heave * 0.036;
    breathScaleY = 1 - heave * 0.026;
    tiltRad = -0.022 + heave * 0.018;
    lureGlowIntensity = 0.28 + 0.09 * heave;
    droolIntensity = 0.56 + 0.14 * heave;
  } else {
    mode = 'idle';
    const phase = Math.max(0, elapsed * 2.8 + instanceIndex * 1.25);
    const slot = Math.floor(phase) % IDLE_PANT_CYCLE.length;
    frameIndex = IDLE_PANT_CYCLE[slot];
    const breath = Math.sin(elapsed * 2.9 + instanceIndex * 1.4);
    breathScaleY = 1 + breath * 0.024;
    breathScaleX = 1 - breath * 0.014;
    tiltRad = Math.sin(elapsed * 1.45 + instanceIndex) * 0.014;
  }

  const blendDur =
    mode === 'pounceMaul' || mode === 'clawRend'
      ? 0.048
      : mode === 'howl' || mode === 'pain'
        ? 0.068
        : 0.088;
  const transitionState = computeFrameTransitionState(
    prevTransition ?? {},
    frameIndex,
    dt,
    blendDur,
  );

  return {
    mode,
    frameIndex,
    frame: MUTDOG_SHEET_FRAMES[frameIndex],
    prevFrameIndex: transitionState.prevFrameIndex,
    prevFrame: MUTDOG_SHEET_FRAMES[transitionState.prevFrameIndex] ?? MUTDOG_SHEET_FRAMES[frameIndex],
    frameBlendAlpha: mode === 'death' ? 1 : transitionState.frameBlendAlpha,
    transitionState,
    xOffsetRatio,
    yHopPx,
    breathScaleX,
    breathScaleY,
    tiltRad,
    lureGlowIntensity,
    droolIntensity,
    pounceImpactIntensity,
    clawSlashProgress,
    alpha,
  };
}
