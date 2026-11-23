import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';
import {
  type FrameTransitionInput,
  type FrameTransitionResult,
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleDeathCollapseFrame,
  sampleSequence,
} from './spriteSheetAnim';

export const BRUTE_SHEET_WIDTH = 1024;
export const BRUTE_SHEET_HEIGHT = 1024;
export const BRUTE_CANONICAL_HEIGHT = 234;

export const BRUTE_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.78,
  unmixLightGlow: true,
};

export interface BruteSpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Horizontal offset inside frame rect (before left-facing flip) centered on torso mass */
  anchorX: number;
  /** Vertical offset inside frame rect where clawed feet meet the bridge deck */
  bottomY: number;
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px (-dx = left/forward) */
  vialOriginRel: { dx: number; dy: number };
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px (+dx = rear/dorsal shell) */
  shellOriginRel: { dx: number; dy: number };
  /** Relative offset from (spriteX, enemyGroundY) in post-flip unscaled px for jaw/fist impact */
  impactOriginRel: { dx: number; dy: number };
}

/**
 * 4x4 Sprite Sheet (`1024x1024`) for the Carapace Brute (Ref-conditioned on uploaded PNG):
 * - Row 0 (`0..3`): Breathing idle loop (A -> inhale B -> snarl C -> exhale D)
 * - Row 1 (`4..7`): Mutagen Vial Brace (grab pocket vials -> crush green vials -> fiery orange shell flare -> veined crossed-arm guard)
 * - Row 2 (`8..11`): Seismic Carapace Crush & Claw/Maw Crunch (coiled 2-arm windup -> airborne smash peak -> 2-fist ground smash -> lunging jaw & claw strike)
 * - Row 3 (`12..15`): Hit Pain Recoil, Knee Stagger, Buckling Collapse & Flat Defeated Collapse
 *
 * Source figures face right and are mirrored (`scale(-1, 1)`) on stage to face the hero on the left.
 */
export const BRUTE_SHEET_FRAMES: readonly BruteSpriteFrame[] = [
  // Row 0: Breathing Idle Loop
  {
    id: 'brute_idle_0',
    row: 0,
    col: 0,
    x: 5,
    y: 28,
    w: 253,
    h: 225,
    anchorX: 126,
    bottomY: 224,
    vialOriginRel: { dx: -14, dy: -118 },
    shellOriginRel: { dx: 36, dy: -168 },
    impactOriginRel: { dx: -68, dy: -124 },
  },
  {
    id: 'brute_idle_1',
    row: 0,
    col: 1,
    x: 272,
    y: 21,
    w: 241,
    h: 234,
    anchorX: 113,
    bottomY: 233,
    vialOriginRel: { dx: -16, dy: -124 },
    shellOriginRel: { dx: 34, dy: -174 },
    impactOriginRel: { dx: -66, dy: -128 },
  },
  {
    id: 'brute_idle_2',
    row: 0,
    col: 2,
    x: 523,
    y: 20,
    w: 239,
    h: 235,
    anchorX: 117,
    bottomY: 234,
    vialOriginRel: { dx: -16, dy: -126 },
    shellOriginRel: { dx: 34, dy: -176 },
    impactOriginRel: { dx: -68, dy: -130 },
  },
  {
    id: 'brute_idle_3',
    row: 0,
    col: 3,
    x: 781,
    y: 22,
    w: 236,
    h: 232,
    anchorX: 111,
    bottomY: 231,
    vialOriginRel: { dx: -14, dy: -122 },
    shellOriginRel: { dx: 34, dy: -172 },
    impactOriginRel: { dx: -64, dy: -126 },
  },

  // Row 1: Mutagen Vial Brace & Armored Guard
  {
    id: 'brute_vial_grab_4',
    row: 1,
    col: 0,
    x: 23,
    y: 283,
    w: 204,
    h: 229,
    anchorX: 103,
    bottomY: 227,
    vialOriginRel: { dx: -24, dy: -124 },
    shellOriginRel: { dx: 32, dy: -170 },
    impactOriginRel: { dx: -52, dy: -126 },
  },
  {
    id: 'brute_vial_crush_5',
    row: 1,
    col: 1,
    x: 278,
    y: 283,
    w: 204,
    h: 228,
    anchorX: 103,
    bottomY: 227,
    vialOriginRel: { dx: -26, dy: -124 },
    shellOriginRel: { dx: 32, dy: -170 },
    impactOriginRel: { dx: -54, dy: -126 },
  },
  {
    id: 'brute_shell_flare_6',
    row: 1,
    col: 2,
    x: 522,
    y: 269,
    w: 229,
    h: 243,
    anchorX: 113,
    bottomY: 241,
    vialOriginRel: { dx: -14, dy: -122 },
    shellOriginRel: { dx: 38, dy: -176 },
    impactOriginRel: { dx: -62, dy: -128 },
  },
  {
    id: 'brute_guard_veins_7',
    row: 1,
    col: 3,
    x: 781,
    y: 269,
    w: 220,
    h: 244,
    anchorX: 111,
    bottomY: 243,
    vialOriginRel: { dx: -10, dy: -134 },
    shellOriginRel: { dx: 36, dy: -176 },
    impactOriginRel: { dx: -46, dy: -134 },
  },

  // Row 2: Seismic Carapace Crush & Vein-Burst Maw/Claw Strike
  {
    id: 'brute_smash_coil_8',
    row: 2,
    col: 0,
    x: 35,
    y: 522,
    w: 188,
    h: 247,
    anchorX: 92,
    bottomY: 246,
    vialOriginRel: { dx: -12, dy: -130 },
    shellOriginRel: { dx: 34, dy: -178 },
    impactOriginRel: { dx: -44, dy: -214 },
  },
  {
    id: 'brute_smash_air_9',
    row: 2,
    col: 1,
    x: 298,
    y: 514,
    w: 180,
    h: 253,
    anchorX: 85,
    bottomY: 251,
    vialOriginRel: { dx: -10, dy: -136 },
    shellOriginRel: { dx: 34, dy: -182 },
    impactOriginRel: { dx: -48, dy: -218 },
  },
  {
    id: 'brute_smash_impact_10',
    row: 2,
    col: 2,
    x: 522,
    y: 563,
    w: 234,
    h: 208,
    anchorX: 118,
    bottomY: 201,
    // Strip baked-in side & floor splinter wedges so planted knuckles and feet sit flush on enemyGroundY
    excludeRects: [
      { x: 204, y: 86, w: 30, h: 121 },
      { x: 96, y: 177, w: 38, h: 30 },
      { x: 120, y: 201, w: 86, h: 6 },
    ],
    vialOriginRel: { dx: -18, dy: -102 },
    shellOriginRel: { dx: 28, dy: -148 },
    impactOriginRel: { dx: -56, dy: -10 },
  },
  {
    id: 'brute_maw_claw_11',
    row: 2,
    col: 3,
    x: 771,
    y: 557,
    w: 247,
    h: 209,
    anchorX: 124,
    bottomY: 208,
    vialOriginRel: { dx: -16, dy: -104 },
    shellOriginRel: { dx: 30, dy: -152 },
    impactOriginRel: { dx: -92, dy: -98 },
  },

  // Row 3: Recoil, Knee Stagger & Collapse
  {
    id: 'brute_pain_recoil_12',
    row: 3,
    col: 0,
    x: 23,
    y: 796,
    w: 231,
    h: 226,
    anchorX: 108,
    bottomY: 225,
    vialOriginRel: { dx: -10, dy: -120 },
    shellOriginRel: { dx: 40, dy: -166 },
    impactOriginRel: { dx: -56, dy: -120 },
  },
  {
    id: 'brute_knee_stagger_13',
    row: 3,
    col: 1,
    x: 278,
    y: 811,
    w: 216,
    h: 209,
    anchorX: 111,
    bottomY: 208,
    vialOriginRel: { dx: -16, dy: -98 },
    shellOriginRel: { dx: 24, dy: -148 },
    impactOriginRel: { dx: -58, dy: -74 },
  },
  {
    id: 'brute_collapse_14',
    row: 3,
    col: 2,
    x: 520,
    y: 826,
    w: 240,
    h: 195,
    anchorX: 126,
    bottomY: 194,
    vialOriginRel: { dx: -14, dy: -82 },
    shellOriginRel: { dx: 18, dy: -134 },
    impactOriginRel: { dx: -64, dy: -56 },
  },
  {
    id: 'brute_dead_15',
    row: 3,
    col: 3,
    x: 770,
    y: 857,
    w: 252,
    h: 164,
    anchorX: 131,
    bottomY: 163,
    vialOriginRel: { dx: -10, dy: -58 },
    shellOriginRel: { dx: 14, dy: -104 },
    impactOriginRel: { dx: -72, dy: -36 },
  },
];

export type BruteAnimMode =
  | 'idle'
  | 'armorPrimed'
  | 'heavyPrimed'
  | 'pauseRecover'
  | 'armoredGuard'
  | 'brace'
  | 'heavySmash'
  | 'clawMaw'
  | 'staggerHover'
  | 'staggered'
  | 'pain'
  | 'death';

export interface BruteAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  bruteAttackKind?: 'heavy' | 'attack';
  bristleTimer?: number;
  bristleDuration?: number;
  bristleKind?: 'armor' | 'retaliate' | 'pustule_rupture';
  armorPrimed?: boolean;
  heavyPrimed?: boolean;
  pauseRecover?: boolean;
  armoredGuard?: boolean;
  guardHover?: boolean;
  staggered?: boolean;
  staggerHover?: boolean;
}

export interface BruteFrameSample {
  mode: BruteAnimMode;
  frameIndex: number;
  frame: BruteSpriteFrame;
  prevFrameIndex: number;
  prevFrame: BruteSpriteFrame;
  frameBlendAlpha: number;
  transitionState: FrameTransitionResult;
  /** Additional horizontal dash/lunge ratio relative to size (negative = left toward hero) */
  xOffsetRatio: number;
  /** Additional vertical leap/hop in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Emerald chest-vial & green bio-vein intensity [0..1] */
  vialGlowIntensity: number;
  /** Fiery orange-amber dorsal carapace flare intensity [0..1] */
  shellGlowIntensity: number;
  /** Ground shockwave intensity [0..1] on seismic impact */
  shockwaveIntensity: number;
  /** Normalized progress [0..1] of the Maw/Claw slash arc (0 when inactive) */
  clawSlashProgress: number;
  alpha: number;
}

const BRACE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 4, until: 0.24, xProgress: 0.02, yHopPx: 2 },
  { frameIndex: 5, until: 0.54, xProgress: 0.0, yHopPx: 0 },
  { frameIndex: 6, until: 0.80, xProgress: -0.02, yHopPx: -2 },
  { frameIndex: 7, until: 1.00, xProgress: 0.0, yHopPx: 0 },
];

const HEAVY_SMASH_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.24, xProgress: 0.07, yHopPx: 3 },
  { frameIndex: 9, until: 0.48, xProgress: -0.26, yHopPx: -32, dashing: true },
  { frameIndex: 10, until: 0.80, xProgress: -0.35, yHopPx: 0, dashing: true },
  { frameIndex: 11, until: 1.00, xProgress: -0.10, yHopPx: 0 },
];

const CLAW_MAW_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.26, xProgress: 0.06, yHopPx: -4 },
  { frameIndex: 11, until: 0.74, xProgress: -0.32, yHopPx: -6, dashing: true },
  { frameIndex: 1, until: 1.00, xProgress: -0.04, yHopPx: 0 },
];

const IDLE_RESPIRATORY_CYCLE: readonly number[] = [0, 1, 0, 1, 1, 2, 3, 2];
const ARMOR_PRIMED_CYCLE: readonly number[] = [4, 7, 4, 7];
const HEAVY_PRIMED_CYCLE: readonly number[] = [8, 6, 8, 6];
const PAUSE_RECOVER_CYCLE: readonly number[] = [0, 1];
const GUARD_CYCLE: readonly number[] = [7, 7, 6, 7];

export function sampleBruteFrame(
  anim: BruteAnimInput | undefined,
  elapsed: number,
  instanceIndex = 0,
  prevTransition?: FrameTransitionInput,
  dt = 0.016,
): BruteFrameSample {
  let mode: BruteAnimMode = 'idle';
  let frameIndex = 0;
  let xOffsetRatio = 0;
  let yHopPx = 0;
  let alpha = 1;
  let vialGlowIntensity = 0.24 + 0.1 * Math.sin(elapsed * 2.8 + instanceIndex);
  let shellGlowIntensity = 0.16 + 0.08 * Math.sin(elapsed * 2.2 + instanceIndex * 0.8);
  let shockwaveIntensity = 0;
  let clawSlashProgress = 0;
  let breathScaleX = 1;
  let breathScaleY = 1;
  let tiltRad = 0;

  if (anim?.dead) {
    mode = 'death';
    const death = sampleDeathCollapseFrame(anim.koProgress, 12, 4, 0.8);
    frameIndex = death.frameIndex;
    alpha = death.alpha;
    vialGlowIntensity = Math.max(0, 0.4 * (1 - death.progress * 1.4));
    shellGlowIntensity = Math.max(0, 0.3 * (1 - death.progress * 1.4));
  } else if (anim && (anim.bristleTimer ?? 0) > 0 && (anim.bristleDuration ?? 0) > 0) {
    mode = 'brace';
    const dur = anim.bristleDuration ?? 0.72;
    const u = Math.max(0, Math.min(0.999, 1 - (anim.bristleTimer ?? 0) / dur));
    const seq = sampleSequence(BRACE_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    const swell = Math.sin(u * Math.PI);
    breathScaleX = 1 + swell * 0.045;
    breathScaleY = 1 + swell * 0.038;
    vialGlowIntensity = u >= 0.18 && u <= 0.65 ? 1.0 : 0.82;
    shellGlowIntensity = u >= 0.48 ? 1.0 : 0.44;
    tiltRad = u < 0.24 ? -0.025 : u < 0.54 ? 0.02 : -0.015;
  } else if (anim && anim.staggerTimer > 0 && anim.staggerDuration > 0) {
    mode = 'pain';
    const u = Math.max(0, Math.min(0.999, 1 - anim.staggerTimer / anim.staggerDuration));
    frameIndex = u < 0.48 ? 12 : 13;
    vialGlowIntensity = 0.28;
    shellGlowIntensity = 0.24 * (1 - u);
    tiltRad = 0.055 * Math.sin(u * Math.PI);
  } else if (anim && anim.attackAnimTimer > 0 && anim.attackAnimDuration > 0) {
    const isHeavy = anim.bruteAttackKind !== 'attack';
    mode = isHeavy ? 'heavySmash' : 'clawMaw';
    const u = Math.max(0, Math.min(0.999, 1 - anim.attackAnimTimer / anim.attackAnimDuration));
    const seq = sampleSequence(isHeavy ? HEAVY_SMASH_SEQ : CLAW_MAW_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    if (isHeavy) {
      if (u >= 0.24 && u < 0.48) {
        const s = (u - 0.24) / 0.24;
        const hangArc = 1 - Math.pow(2 * s - 1, 4);
        yHopPx = -34 * hangArc;
      }
      shellGlowIntensity = u < 0.8 ? 0.96 : 0.55;
      vialGlowIntensity = 0.72;
      shockwaveIntensity = u >= 0.48 && u <= 0.86 ? Math.sin(((u - 0.48) / 0.38) * Math.PI) : 0;
      if (u >= 0.48 && u <= 0.74) {
        const slamSquash = Math.sin(((u - 0.48) / 0.26) * Math.PI);
        breathScaleX = 1 + slamSquash * 0.095;
        breathScaleY = 1 - slamSquash * 0.085;
      }
      tiltRad = u < 0.24 ? 0.06 : u < 0.48 ? -0.045 : u < 0.80 ? -0.098 : -0.03;
    } else {
      vialGlowIntensity = 0.66;
      shellGlowIntensity = 0.52;
      if (u >= 0.26 && u < 0.74) {
        clawSlashProgress = Math.max(0.01, Math.min(1, (u - 0.26) / 0.48));
      }
      tiltRad = u < 0.26 ? 0.048 : u < 0.74 ? -0.082 : 0;
    }
  } else if (anim?.staggered) {
    mode = 'staggered';
    frameIndex = 13;
    const wobble = Math.sin(elapsed * 5.2 + instanceIndex);
    tiltRad = wobble * 0.025;
    breathScaleY = 1 + wobble * 0.012;
    vialGlowIntensity = 0.14;
    shellGlowIntensity = 0.08;
  } else if (anim?.staggerHover) {
    mode = 'staggerHover';
    frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 9.0 + instanceIndex);
    shellGlowIntensity = 0.84 + 0.16 * pulse;
    vialGlowIntensity = 0.5 + 0.24 * pulse;
    breathScaleX = 1 + pulse * 0.032;
    breathScaleY = 1 - pulse * 0.016;
  } else if (anim?.guardHover || anim?.armoredGuard) {
    mode = 'armoredGuard';
    const phase = Math.max(0, elapsed * 1.8 + instanceIndex * 0.9);
    const slot = Math.floor(phase) % GUARD_CYCLE.length;
    frameIndex = GUARD_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2 + instanceIndex);
    vialGlowIntensity = 0.64 + 0.26 * pulse;
    shellGlowIntensity = 0.46 + 0.22 * pulse;
    breathScaleX = 1 + pulse * 0.018;
    breathScaleY = 1 + pulse * 0.014;
  } else if (anim?.heavyPrimed) {
    mode = 'heavyPrimed';
    const phase = Math.max(0, elapsed * 2.6 + instanceIndex * 1.1);
    const slot = Math.floor(phase) % HEAVY_PRIMED_CYCLE.length;
    frameIndex = HEAVY_PRIMED_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.4 + instanceIndex);
    shellGlowIntensity = 0.72 + 0.26 * pulse;
    vialGlowIntensity = 0.48 + 0.18 * pulse;
    breathScaleY = 1 + pulse * 0.024;
    breathScaleX = 1 - pulse * 0.012;
    tiltRad = -0.018 + pulse * 0.024;
  } else if (anim?.armorPrimed) {
    mode = 'armorPrimed';
    const phase = Math.max(0, elapsed * 1.85 + instanceIndex * 0.95);
    const slot = Math.floor(phase) % ARMOR_PRIMED_CYCLE.length;
    frameIndex = ARMOR_PRIMED_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.4 + instanceIndex);
    vialGlowIntensity = 0.68 + 0.24 * pulse;
    shellGlowIntensity = 0.34 + 0.16 * pulse;
    breathScaleX = 1 + pulse * 0.022;
    breathScaleY = 1 + pulse * 0.016;
  } else if (anim?.pauseRecover) {
    mode = 'pauseRecover';
    const phase = Math.max(0, elapsed * 1.35 + instanceIndex * 0.75);
    const slot = Math.floor(phase) % PAUSE_RECOVER_CYCLE.length;
    frameIndex = PAUSE_RECOVER_CYCLE[slot];
    const heave = Math.sin(elapsed * 2.1 + instanceIndex);
    breathScaleX = 1 + heave * 0.032;
    breathScaleY = 1 - heave * 0.024;
    tiltRad = -0.024 + heave * 0.016;
    vialGlowIntensity = 0.22 + 0.08 * heave;
    shellGlowIntensity = 0.24 + 0.1 * heave;
  } else {
    mode = 'idle';
    const phase = Math.max(0, elapsed * 2.4 + instanceIndex * 1.25);
    const slot = Math.floor(phase) % IDLE_RESPIRATORY_CYCLE.length;
    frameIndex = IDLE_RESPIRATORY_CYCLE[slot];
    const breath = Math.sin(elapsed * 2.3 + instanceIndex * 1.4);
    breathScaleY = 1 + breath * 0.022;
    breathScaleX = 1 - breath * 0.012;
    tiltRad = Math.sin(elapsed * 1.15 + instanceIndex) * 0.012;
  }

  const blendDur =
    mode === 'heavySmash' || mode === 'clawMaw'
      ? 0.055
      : mode === 'brace' || mode === 'pain'
        ? 0.072
        : 0.095;
  const transitionState = computeFrameTransitionState(
    prevTransition ?? {},
    frameIndex,
    dt,
    blendDur,
  );

  return {
    mode,
    frameIndex,
    frame: BRUTE_SHEET_FRAMES[frameIndex],
    prevFrameIndex: transitionState.prevFrameIndex,
    prevFrame: BRUTE_SHEET_FRAMES[transitionState.prevFrameIndex] ?? BRUTE_SHEET_FRAMES[frameIndex],
    frameBlendAlpha: mode === 'death' ? 1 : transitionState.frameBlendAlpha,
    transitionState,
    xOffsetRatio,
    yHopPx,
    breathScaleX,
    breathScaleY,
    tiltRad,
    vialGlowIntensity,
    shellGlowIntensity,
    shockwaveIntensity,
    clawSlashProgress,
    alpha,
  };
}
