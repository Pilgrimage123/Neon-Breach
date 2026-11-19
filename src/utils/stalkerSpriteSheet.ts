import type { CutInPoseOverride } from '../components/combat/SpriteJuiceFeedbackHandler';
import type { SpriteRect } from './spriteCutout';
import {
  type FrameTransitionInput,
  type FrameTransitionResult,
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleSequence,
} from './spriteSheetAnim';

export const STALKER_SHEET_WIDTH = 1024;
export const STALKER_SHEET_HEIGHT = 1024;
export const STALKER_CANONICAL_HEIGHT = 227;

export interface StalkerSpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Horizontal offset inside frame rect (before facing flip) centered on pelvis/stance */
  anchorX: number;
  /** Vertical offset inside frame rect where claws/body touch the bridge deck */
  bottomY: number;
  /** Relative offset from (anchorX, bottomY) in unscaled pixels (after left-flip, +dx is right/back, -dx is left/forward) */
  quillOriginRel: { dx: number; dy: number };
}

/**
 * 4x4 Sprite Sheet (`1024x1024`) for the Chitin Stalker (Obsidian Carapace + Crimson-Magenta Quills):
 * - Row 0 (`0..3`): Idle breathing, stealth stalk & deep coiled Ambush Crouch (`if_no_shield`)
 * - Row 1 (`4..7`): Scythe Pounce Slash (windup -> lunge -> extended slash -> recovery)
 * - Row 2 (`8..11`): Thorny Carapace Harden & Quill Retaliation (hunker -> ignite -> peak spike flare -> bristled guard)
 * - Row 3 (`12..15`): Hit Pain Recoil, Buckling Stagger & Ichor Puddle Collapse
 *
 * Source figures face right and are mirrored (`scale(-1, 1)`) in the combat stage to face the heroine on the left.
 */
export const STALKER_SHEET_FRAMES: readonly StalkerSpriteFrame[] = [
  // Row 0: Idle & Ambush Crouch
  {
    id: 'stalker_idle_0',
    row: 0,
    col: 0,
    x: 9,
    y: 25,
    w: 225,
    h: 227,
    anchorX: 112,
    bottomY: 226,
    quillOriginRel: { dx: -8, dy: -162 },
  },
  {
    id: 'stalker_idle_1',
    row: 0,
    col: 1,
    x: 266,
    y: 27,
    w: 230,
    h: 227,
    anchorX: 112,
    bottomY: 225,
    quillOriginRel: { dx: -8, dy: -164 },
  },
  {
    id: 'stalker_stalk_2',
    row: 0,
    col: 2,
    x: 513,
    y: 35,
    w: 246,
    h: 219,
    anchorX: 112,
    bottomY: 217,
    quillOriginRel: { dx: -12, dy: -152 },
  },
  {
    id: 'stalker_ambush_3',
    row: 0,
    col: 3,
    x: 783,
    y: 66,
    w: 218,
    h: 186,
    anchorX: 110,
    bottomY: 184,
    quillOriginRel: { dx: -10, dy: -128 },
  },

  // Row 1: Scythe Pounce Slash
  {
    id: 'stalker_atk_windup_4',
    row: 1,
    col: 0,
    x: 9,
    y: 252,
    w: 266,
    h: 259,
    anchorX: 102,
    bottomY: 257,
    excludeRects: [{ x: 231, y: 65, w: 35, h: 155 }],
    quillOriginRel: { dx: -4, dy: -175 },
  },
  {
    id: 'stalker_atk_lunge_5',
    row: 1,
    col: 1,
    x: 242,
    y: 284,
    w: 256,
    h: 225,
    anchorX: 106,
    bottomY: 223,
    excludeRects: [{ x: 0, y: 0, w: 34, h: 25 }],
    quillOriginRel: { dx: -12, dy: -154 },
  },
  {
    id: 'stalker_atk_slash_6',
    row: 1,
    col: 2,
    x: 506,
    y: 284,
    w: 289,
    h: 227,
    anchorX: 108,
    bottomY: 225,
    excludeRects: [{ x: 270, y: 112, w: 19, h: 68 }],
    quillOriginRel: { dx: -18, dy: -152 },
  },
  {
    id: 'stalker_atk_recover_7',
    row: 1,
    col: 3,
    x: 776,
    y: 280,
    w: 235,
    h: 231,
    anchorX: 110,
    bottomY: 228,
    excludeRects: [{ x: 0, y: 55, w: 19, h: 58 }],
    quillOriginRel: { dx: -10, dy: -158 },
  },

  // Row 2: Carapace Harden & Quill Retaliation
  {
    id: 'stalker_hunker_8',
    row: 2,
    col: 0,
    x: 15,
    y: 552,
    w: 221,
    h: 215,
    anchorX: 106,
    bottomY: 213,
    quillOriginRel: { dx: -6, dy: -145 },
  },
  {
    id: 'stalker_ignite_9',
    row: 2,
    col: 1,
    x: 260,
    y: 523,
    w: 238,
    h: 244,
    anchorX: 116,
    bottomY: 242,
    quillOriginRel: { dx: -8, dy: -168 },
  },
  {
    id: 'stalker_flare_10',
    row: 2,
    col: 2,
    x: 528,
    y: 512,
    w: 225,
    h: 255,
    anchorX: 106,
    bottomY: 253,
    quillOriginRel: { dx: -12, dy: -182 },
  },
  {
    id: 'stalker_guard_11',
    row: 2,
    col: 3,
    x: 786,
    y: 531,
    w: 225,
    h: 236,
    anchorX: 103,
    bottomY: 234,
    quillOriginRel: { dx: -10, dy: -166 },
  },

  // Row 3: Hit Pain & Death Collapse
  {
    id: 'stalker_pain_12',
    row: 3,
    col: 0,
    x: 8,
    y: 791,
    w: 244,
    h: 232,
    anchorX: 112,
    bottomY: 230,
    quillOriginRel: { dx: 4, dy: -164 },
  },
  {
    id: 'stalker_stagger_13',
    row: 3,
    col: 1,
    x: 267,
    y: 790,
    w: 232,
    h: 233,
    anchorX: 110,
    bottomY: 231,
    // Strip tiny comic knee shake lines floating near knees so stagger reads crisp
    excludeRects: [
      { x: 75, y: 180, w: 19, h: 6 },
      { x: 102, y: 148, w: 21, h: 26 },
      { x: 179, y: 142, w: 14, h: 31 },
    ],
    quillOriginRel: { dx: 2, dy: -158 },
  },
  {
    id: 'stalker_collapse_14',
    row: 3,
    col: 2,
    x: 520,
    y: 821,
    w: 242,
    h: 200,
    anchorX: 108,
    bottomY: 198,
    quillOriginRel: { dx: 0, dy: -124 },
  },
  {
    id: 'stalker_dead_15',
    row: 3,
    col: 3,
    x: 773,
    y: 896,
    w: 248,
    h: 125,
    anchorX: 124,
    bottomY: 123,
    quillOriginRel: { dx: 0, dy: -62 },
  },
];

export type StalkerAnimMode =
  | 'idle'
  | 'ambush'
  | 'guard'
  | 'attack'
  | 'bristle'
  | 'pain'
  | 'death';

export interface StalkerAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  bristleTimer?: number;
  bristleDuration?: number;
  bristleKind?: 'armor' | 'retaliate';
  ambushPrimed?: boolean;
  armoredGuard?: boolean;
  retaliateHover?: boolean;
}

export interface StalkerFrameSample {
  mode: StalkerAnimMode;
  frameIndex: number;
  frame: StalkerSpriteFrame;
  prevFrameIndex: number;
  prevFrame: StalkerSpriteFrame;
  frameBlendAlpha: number;
  transitionState: FrameTransitionResult;
  /** Additional local horizontal dash/lunge ratio relative to size (negative = left toward heroine) */
  xOffsetRatio: number;
  /** Additional vertical leap/hop in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Bioluminescent crimson spine intensity [0..1] */
  spineGlowIntensity: number;
  alpha: number;
}

const ATTACK_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 4, until: 0.24, xProgress: 0.06, yHopPx: 0 },
  { frameIndex: 5, until: 0.50, xProgress: -0.22, yHopPx: -12, dashing: true },
  { frameIndex: 6, until: 0.78, xProgress: -0.34, yHopPx: -4, dashing: true },
  { frameIndex: 7, until: 1.00, xProgress: -0.06, yHopPx: 0 },
];

const BRISTLE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.20, xProgress: 0.02, yHopPx: 0 },
  { frameIndex: 9, until: 0.44, xProgress: 0, yHopPx: -3 },
  { frameIndex: 10, until: 0.74, xProgress: -0.03, yHopPx: -5 },
  { frameIndex: 11, until: 1.00, xProgress: 0, yHopPx: 0 },
];

const IDLE_CYCLE: readonly number[] = [0, 1, 2, 1];
const AMBUSH_CYCLE: readonly number[] = [2, 3, 3, 2];

export function sampleStalkerFrame(
  anim: StalkerAnimInput | undefined,
  elapsed: number,
  instanceIndex = 0,
  prevTransition?: FrameTransitionInput,
  dt = 0.016,
  poseOverride: CutInPoseOverride = 'none',
): StalkerFrameSample {
  let mode: StalkerAnimMode = 'idle';
  let frameIndex = 0;
  let xOffsetRatio = 0;
  let yHopPx = 0;
  let alpha = 1;
  let spineGlowIntensity = 0.22 + 0.1 * Math.sin(elapsed * 3.1 + instanceIndex);
  let breathScaleX = 1;
  let breathScaleY = 1;
  let tiltRad = 0;

  if (anim?.dead) {
    mode = 'death';
    const p = Math.max(0, Math.min(1, anim.koProgress));
    const collapseNorm = Math.min(1, p / 0.8);
    const step = Math.min(3, Math.floor(collapseNorm * 4));
    frameIndex = 12 + step;
    alpha = p <= 0.8 ? 1 : Math.max(0, (1 - p) / 0.2);
    spineGlowIntensity = Math.max(0, 0.55 * (1 - p * 1.15));
  } else if (poseOverride !== 'none') {
    if (poseOverride === 'attack_pose') {
      mode = 'attack';
      frameIndex = 6;
      spineGlowIntensity = 0.92;
      tiltRad = -0.06;
    } else if (poseOverride === 'brace_pose') {
      mode = 'guard';
      frameIndex = 11;
      spineGlowIntensity = 0.72;
    } else {
      mode = 'pain';
      frameIndex = 12;
      spineGlowIntensity = 0.68;
      tiltRad = 0.05;
    }
  } else if (anim && anim.staggerTimer > 0 && anim.staggerDuration > 0) {
    mode = 'pain';
    const u = Math.max(0, Math.min(0.999, 1 - anim.staggerTimer / anim.staggerDuration));
    frameIndex = u < 0.45 ? 12 : 13;
    spineGlowIntensity = 0.65 * (1 - u * 0.4);
    tiltRad = 0.04 * Math.sin(u * Math.PI);
  } else if (anim && (anim.bristleTimer ?? 0) > 0 && (anim.bristleDuration ?? 0) > 0) {
    mode = 'bristle';
    const dur = anim.bristleDuration ?? 0.5;
    const u = Math.max(0, Math.min(0.999, 1 - (anim.bristleTimer ?? 0) / dur));
    const seq = sampleSequence(BRISTLE_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    spineGlowIntensity = anim.bristleKind === 'retaliate' ? 1.0 : 0.88;
    const swell = Math.sin(u * Math.PI);
    breathScaleX = 1 + swell * 0.045;
    breathScaleY = 1 + swell * 0.05;
  } else if (anim && anim.attackAnimTimer > 0 && anim.attackAnimDuration > 0) {
    mode = 'attack';
    const u = Math.max(0, Math.min(0.999, 1 - anim.attackAnimTimer / anim.attackAnimDuration));
    const seq = sampleSequence(ATTACK_SEQ, u, 0);
    frameIndex = seq.frameIndex;
    xOffsetRatio = seq.xProgress;
    yHopPx = seq.yHopPx;
    spineGlowIntensity = u > 0.2 && u < 0.8 ? 0.85 : 0.45;
    tiltRad = u < 0.24 ? 0.045 : u < 0.76 ? -0.07 : 0;
  } else if (anim?.ambushPrimed) {
    mode = 'ambush';
    const phase = Math.max(0, elapsed * 3.4 + instanceIndex * 1.1);
    const slot = Math.floor(phase) % AMBUSH_CYCLE.length;
    frameIndex = AMBUSH_CYCLE[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.5 + instanceIndex);
    spineGlowIntensity = 0.68 + 0.3 * pulse;
    breathScaleX = 1 + pulse * 0.02;
    breathScaleY = 1 - pulse * 0.015;
    tiltRad = -0.028;
  } else if (anim?.retaliateHover) {
    mode = 'guard';
    frameIndex = 10;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 8.5 + instanceIndex);
    spineGlowIntensity = 0.85 + 0.15 * pulse;
    breathScaleX = 1 + pulse * 0.032;
    breathScaleY = 1 + pulse * 0.024;
  } else if (anim?.armoredGuard) {
    mode = 'guard';
    frameIndex = 11;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.8 + instanceIndex);
    spineGlowIntensity = 0.62 + 0.25 * pulse;
    breathScaleX = 1 + pulse * 0.018;
    breathScaleY = 1 + pulse * 0.012;
  } else {
    mode = 'idle';
    const phase = Math.max(0, elapsed * 3.6 + instanceIndex * 1.45);
    const slot = Math.floor(phase) % IDLE_CYCLE.length;
    frameIndex = IDLE_CYCLE[slot];
    const breath = Math.sin(elapsed * 2.6 + instanceIndex * 1.5);
    breathScaleY = 1 + breath * 0.018;
    breathScaleX = 1 - breath * 0.009;
  }

  const blendDur = mode === 'attack' || mode === 'bristle' ? 0.065 : 0.085;
  const transitionState = computeFrameTransitionState(
    prevTransition ?? {},
    frameIndex,
    dt,
    blendDur,
  );

  return {
    mode,
    frameIndex,
    frame: STALKER_SHEET_FRAMES[frameIndex],
    prevFrameIndex: transitionState.prevFrameIndex,
    prevFrame: STALKER_SHEET_FRAMES[transitionState.prevFrameIndex] ?? STALKER_SHEET_FRAMES[frameIndex],
    frameBlendAlpha: mode === 'death' || poseOverride !== 'none' ? 1 : transitionState.frameBlendAlpha,
    transitionState,
    xOffsetRatio,
    yHopPx,
    breathScaleX,
    breathScaleY,
    tiltRad,
    spineGlowIntensity,
    alpha,
  };
}
