import type { TileType } from '../engine/types';
import {
  type HeroAnimMode,
  type HeroAnimState,
  type HeroFrameDef,
  type HeroFrameSample,
  createInitialHeroAnimState,
} from './heroAnimator';
import {
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleSequence,
} from './spriteSheetAnim';

export const AURALINE_SHEET_WIDTH = 3545;
export const AURALINE_SHEET_HEIGHT = 1703;
export const AURALINE_CANONICAL_HEIGHT = 214;

export const AURALINE_SHEET_FRAMES: readonly HeroFrameDef[] = [
  // Row 0 (indices 0..8): Idle stance & Royal Curtsy (normalized to 214.0px standing height)
  { id: 'aurelia_r0_f0', row: 0, col: 0, x: 12, y: 12, w: 313, h: 498, anchorX: 149, bottomY: 498, rowScale: 0.4325 },
  { id: 'aurelia_r0_f1', row: 0, col: 1, x: 339, y: 12, w: 310, h: 495, anchorX: 148, bottomY: 495, rowScale: 0.4325 },
  { id: 'aurelia_r0_f2', row: 0, col: 2, x: 663, y: 12, w: 308, h: 494, anchorX: 149, bottomY: 494, rowScale: 0.4325 },
  { id: 'aurelia_r0_f3', row: 0, col: 3, x: 985, y: 12, w: 318, h: 495, anchorX: 156, bottomY: 495, rowScale: 0.4325 },
  { id: 'aurelia_r0_f4', row: 0, col: 4, x: 1317, y: 12, w: 336, h: 498, anchorX: 168, bottomY: 498, rowScale: 0.4325 },
  { id: 'aurelia_r0_f5', row: 0, col: 5, x: 1667, y: 12, w: 332, h: 498, anchorX: 168, bottomY: 498, rowScale: 0.4325 },
  { id: 'aurelia_r0_f6', row: 0, col: 6, x: 2013, y: 12, w: 312, h: 495, anchorX: 170, bottomY: 495, rowScale: 0.4325 },
  { id: 'aurelia_r0_f7', row: 0, col: 7, x: 2339, y: 12, w: 312, h: 497, anchorX: 168, bottomY: 497, rowScale: 0.4325 },
  { id: 'aurelia_r0_f8', row: 0, col: 8, x: 2665, y: 12, w: 312, h: 495, anchorX: 159, bottomY: 495, rowScale: 0.4325 },

  // Row 1 (indices 9..18): Twin-Barrel Plasma Scattergun Aim, Charge, Muzzle Blast & Shell Recoil
  { id: 'aurelia_r1_f0', row: 1, col: 0, x: 12, y: 526, w: 287, h: 397, anchorX: 122, bottomY: 397, rowScale: 0.54788, muzzleRel: { dx: 156, dy: -269.9 } },
  { id: 'aurelia_r1_f1', row: 1, col: 1, x: 313, y: 526, w: 312, h: 395, anchorX: 137, bottomY: 395, rowScale: 0.54788, muzzleRel: { dx: 166, dy: -279.3 } },
  { id: 'aurelia_r1_f2', row: 1, col: 2, x: 639, y: 526, w: 312, h: 395, anchorX: 136, bottomY: 395, rowScale: 0.54788, muzzleRel: { dx: 167, dy: -276.3 } },
  { id: 'aurelia_r1_f3', row: 1, col: 3, x: 965, y: 526, w: 316, h: 389, anchorX: 137, bottomY: 389, rowScale: 0.54788, muzzleRel: { dx: 169, dy: -273.8 } },
  { id: 'aurelia_r1_f4', row: 1, col: 4, x: 1295, y: 526, w: 372, h: 389, anchorX: 133, bottomY: 389, rowScale: 0.54788, muzzleRel: { dx: 191, dy: -254.8 }, kickTipRel: { dx: 229, dy: -254.8 } },
  { id: 'aurelia_r1_f5', row: 1, col: 5, x: 1681, y: 526, w: 380, h: 383, anchorX: 132, bottomY: 383, rowScale: 0.54788, muzzleRel: { dx: 199, dy: -250 }, kickTipRel: { dx: 237, dy: -250 } },
  { id: 'aurelia_r1_f6', row: 1, col: 6, x: 2075, y: 526, w: 410, h: 389, anchorX: 142, bottomY: 389, rowScale: 0.54788, muzzleRel: { dx: 214, dy: -253.6 }, kickTipRel: { dx: 252, dy: -253.6 } },
  { id: 'aurelia_r1_f7', row: 1, col: 7, x: 2499, y: 526, w: 353, h: 391, anchorX: 136, bottomY: 391, rowScale: 0.54788, muzzleRel: { dx: 163, dy: -259.2 } },
  { id: 'aurelia_r1_f8', row: 1, col: 8, x: 2866, y: 526, w: 374, h: 393, anchorX: 138, bottomY: 393, rowScale: 0.54788, muzzleRel: { dx: 181, dy: -264.2 } },
  { id: 'aurelia_r1_f9', row: 1, col: 9, x: 3254, y: 526, w: 279, h: 385, anchorX: 139, bottomY: 385, rowScale: 0.54788, muzzleRel: { dx: 133, dy: -265.1 } },

  // Row 2 (indices 19..28): Brace, Hit Stagger & Recovery
  { id: 'aurelia_r2_f0', row: 2, col: 0, x: 12, y: 939, w: 282, h: 376, anchorX: 150, bottomY: 376, rowScale: 0.57016 },
  { id: 'aurelia_r2_f1', row: 2, col: 1, x: 308, y: 939, w: 319, h: 376, anchorX: 178, bottomY: 376, rowScale: 0.57016 },
  { id: 'aurelia_r2_f2', row: 2, col: 2, x: 641, y: 939, w: 331, h: 376, anchorX: 184, bottomY: 376, rowScale: 0.57016 },
  { id: 'aurelia_r2_f3', row: 2, col: 3, x: 986, y: 939, w: 318, h: 375, anchorX: 172, bottomY: 375, rowScale: 0.57016 },
  { id: 'aurelia_r2_f4', row: 2, col: 4, x: 1318, y: 939, w: 310, h: 367, anchorX: 146, bottomY: 367, rowScale: 0.57016 },
  { id: 'aurelia_r2_f5', row: 2, col: 5, x: 1642, y: 939, w: 278, h: 347, anchorX: 134, bottomY: 347, rowScale: 0.57016 },
  { id: 'aurelia_r2_f6', row: 2, col: 6, x: 1934, y: 939, w: 280, h: 357, anchorX: 134, bottomY: 357, rowScale: 0.57016 },
  { id: 'aurelia_r2_f7', row: 2, col: 7, x: 2228, y: 939, w: 278, h: 359, anchorX: 139, bottomY: 359, rowScale: 0.57016 },
  { id: 'aurelia_r2_f8', row: 2, col: 8, x: 2520, y: 939, w: 285, h: 367, anchorX: 143, bottomY: 367, rowScale: 0.57016 },
  { id: 'aurelia_r2_f9', row: 2, col: 9, x: 2819, y: 939, w: 265, h: 375, anchorX: 141, bottomY: 375, rowScale: 0.57016 },

  // Row 3 (indices 29..38): Collapse to Prone Defeat
  { id: 'aurelia_r3_f0', row: 3, col: 0, x: 12, y: 1331, w: 246, h: 355, anchorX: 134, bottomY: 355, rowScale: 0.60028 },
  { id: 'aurelia_r3_f1', row: 3, col: 1, x: 272, y: 1331, w: 288, h: 360, anchorX: 167, bottomY: 358, rowScale: 0.60028 },
  { id: 'aurelia_r3_f2', row: 3, col: 2, x: 574, y: 1331, w: 326, h: 355, anchorX: 201, bottomY: 355, rowScale: 0.60028 },
  { id: 'aurelia_r3_f3', row: 3, col: 3, x: 914, y: 1331, w: 342, h: 305, anchorX: 203, bottomY: 305, rowScale: 0.60028 },
  { id: 'aurelia_r3_f4', row: 3, col: 4, x: 1270, y: 1331, w: 330, h: 270, anchorX: 191, bottomY: 270, rowScale: 0.60028 },
  { id: 'aurelia_r3_f5', row: 3, col: 5, x: 1614, y: 1331, w: 332, h: 252, anchorX: 192, bottomY: 252, rowScale: 0.60028 },
  { id: 'aurelia_r3_f6', row: 3, col: 6, x: 1960, y: 1331, w: 328, h: 207, anchorX: 170, bottomY: 207, rowScale: 0.60028 },
  { id: 'aurelia_r3_f7', row: 3, col: 7, x: 2302, y: 1331, w: 356, h: 181, anchorX: 187, bottomY: 181, rowScale: 0.60028 },
  { id: 'aurelia_r3_f8', row: 3, col: 8, x: 2672, y: 1331, w: 390, h: 149, anchorX: 194, bottomY: 149, rowScale: 0.60028 },
  { id: 'aurelia_r3_f9', row: 3, col: 9, x: 3076, y: 1331, w: 398, h: 132, anchorX: 201, bottomY: 132, rowScale: 0.60028 },

  // Row 0 Col 9 (index 39): Spliced & upscaled missing curtsy return frame to neutral stance
  { id: 'aurelia_r0_f9', row: 0, col: 9, x: 2991, y: 12, w: 312, h: 495, anchorX: 155, bottomY: 495, rowScale: 0.4325 },
];

const AURALINE_IDLE1_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 0, until: 0.16, xProgress: 0, yHopPx: 0 },
  { frameIndex: 1, until: 0.34, xProgress: 0, yHopPx: 0 },
  { frameIndex: 2, until: 0.52, xProgress: 0, yHopPx: -0.4 },
  { frameIndex: 3, until: 0.72, xProgress: 0, yHopPx: 0 },
  { frameIndex: 4, until: 0.94, xProgress: 0, yHopPx: 0.6 },
  { frameIndex: 5, until: 1.18, xProgress: 0, yHopPx: 0.8 },
  { frameIndex: 6, until: 1.38, xProgress: 0, yHopPx: 0.2 },
  { frameIndex: 7, until: 1.54, xProgress: 0, yHopPx: 0 },
  { frameIndex: 8, until: 1.70, xProgress: 0, yHopPx: 0 },
  { frameIndex: 39, until: 1.88, xProgress: 0, yHopPx: 0 },
];

const AURALINE_IDLE2_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.22, xProgress: 0, yHopPx: 0 },
  { frameIndex: 10, until: 0.48, xProgress: 0, yHopPx: -0.4 },
  { frameIndex: 11, until: 0.80, xProgress: 0, yHopPx: -0.6 },
  { frameIndex: 10, until: 1.08, xProgress: 0, yHopPx: -0.3 },
  { frameIndex: 9, until: 1.34, xProgress: 0, yHopPx: 0 },
];

const AURALINE_SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.06, xProgress: 0.025 },
  { frameIndex: 10, until: 0.11, xProgress: 0.045 },
  { frameIndex: 11, until: 0.16, xProgress: 0.06 },
  { frameIndex: 13, until: 0.24, xProgress: 0.05 },
  { frameIndex: 14, until: 0.33, xProgress: 0.032 },
  { frameIndex: 15, until: 0.40, xProgress: 0.018 },
  { frameIndex: 16, until: 0.46, xProgress: 0.008 },
  { frameIndex: 17, until: 0.51, xProgress: 0.002 },
  { frameIndex: 18, until: 0.54, xProgress: 0 },
  { frameIndex: 0, until: 0.56, xProgress: 0 },
];

const AURALINE_DASH_KICK_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.05, xProgress: 0.16, yHopPx: 0, dashing: true },
  { frameIndex: 10, until: 0.11, xProgress: 0.44, yHopPx: -3.5, dashing: true },
  { frameIndex: 11, until: 0.17, xProgress: 0.72, yHopPx: -5.5, dashing: true },
  { frameIndex: 12, until: 0.23, xProgress: 0.90, yHopPx: -2.0, dashing: true },
  { frameIndex: 13, until: 0.29, xProgress: 0.94, yHopPx: 0 },
  { frameIndex: 14, until: 0.42, xProgress: 0.94, yHopPx: -1.5 },
  { frameIndex: 15, until: 0.50, xProgress: 0.84, yHopPx: -4.0 },
  { frameIndex: 16, until: 0.58, xProgress: 0.58, yHopPx: -6.5, dashing: true },
  { frameIndex: 17, until: 0.67, xProgress: 0.24, yHopPx: -4.5, dashing: true },
  { frameIndex: 18, until: 0.75, xProgress: 0.05, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.80, xProgress: 0, yHopPx: 0 },
];

const AURALINE_OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 10, until: 0.06, xProgress: 0.24, yHopPx: -2.0, dashing: true },
  { frameIndex: 11, until: 0.12, xProgress: 0.56, yHopPx: -5.5, dashing: true },
  { frameIndex: 12, until: 0.18, xProgress: 0.88, yHopPx: -2.5, dashing: true },
  { frameIndex: 14, until: 0.31, xProgress: 0.92, yHopPx: -1.5 },
  { frameIndex: 16, until: 0.40, xProgress: 0.70, yHopPx: -7.0, dashing: true },
  { frameIndex: 17, until: 0.48, xProgress: 0.44, yHopPx: 0, dashing: true },
  { frameIndex: 11, until: 0.53, xProgress: 0.42, yHopPx: 0 },
  { frameIndex: 13, until: 0.62, xProgress: 0.39, yHopPx: 0 },
  { frameIndex: 15, until: 0.72, xProgress: 0.34, yHopPx: 0 },
  { frameIndex: 17, until: 0.81, xProgress: 0.14, yHopPx: -5.0, dashing: true },
  { frameIndex: 18, until: 0.88, xProgress: 0.03, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.94, xProgress: 0, yHopPx: 0 },
];

const AURALINE_GUARD_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 19, until: 0.10, xProgress: -0.01, yHopPx: 0 },
  { frameIndex: 28, until: 0.34, xProgress: -0.02, yHopPx: 1.0 },
  { frameIndex: 19, until: 0.43, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.48, xProgress: 0, yHopPx: 0 },
];

const AURALINE_UPGRADE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 0, until: 0.10, xProgress: 0, yHopPx: 0 },
  { frameIndex: 1, until: 0.20, xProgress: 0, yHopPx: -0.5 },
  { frameIndex: 2, until: 0.30, xProgress: 0, yHopPx: -1.0 },
  { frameIndex: 3, until: 0.41, xProgress: 0, yHopPx: -0.8 },
  { frameIndex: 4, until: 0.52, xProgress: 0, yHopPx: 0 },
  { frameIndex: 5, until: 0.64, xProgress: 0, yHopPx: 0.5 },
  { frameIndex: 6, until: 0.74, xProgress: 0, yHopPx: 0 },
  { frameIndex: 7, until: 0.83, xProgress: 0, yHopPx: 0 },
  { frameIndex: 8, until: 0.90, xProgress: 0, yHopPx: 0 },
  { frameIndex: 39, until: 1.00, xProgress: 0, yHopPx: 0 },
];

const AURALINE_HIT_NORMAL_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 19, until: 0.08, xProgress: -0.03 },
  { frameIndex: 20, until: 0.17, xProgress: -0.065 },
  { frameIndex: 21, until: 0.27, xProgress: -0.075 },
  { frameIndex: 22, until: 0.36, xProgress: -0.05 },
  { frameIndex: 27, until: 0.43, xProgress: -0.015 },
  { frameIndex: 0, until: 0.48, xProgress: 0 },
];

const AURALINE_HIT_LOW_HP_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 19, until: 0.07, xProgress: -0.03 },
  { frameIndex: 20, until: 0.14, xProgress: -0.065 },
  { frameIndex: 21, until: 0.22, xProgress: -0.085 },
  { frameIndex: 22, until: 0.30, xProgress: -0.08 },
  { frameIndex: 23, until: 0.38, xProgress: -0.065 },
  { frameIndex: 24, until: 0.45, xProgress: -0.048 },
  { frameIndex: 26, until: 0.52, xProgress: -0.025 },
  { frameIndex: 28, until: 0.57, xProgress: -0.008 },
  { frameIndex: 0, until: 0.60, xProgress: 0 },
];

const AURALINE_DEFEAT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 29, until: 0.09, xProgress: 0 },
  { frameIndex: 30, until: 0.19, xProgress: -0.028 },
  { frameIndex: 31, until: 0.30, xProgress: -0.055 },
  { frameIndex: 32, until: 0.42, xProgress: -0.072 },
  { frameIndex: 33, until: 0.54, xProgress: -0.065 },
  { frameIndex: 34, until: 0.66, xProgress: -0.055 },
  { frameIndex: 35, until: 0.78, xProgress: -0.044 },
  { frameIndex: 36, until: 0.90, xProgress: -0.034 },
  { frameIndex: 37, until: 1.01, xProgress: -0.025 },
  { frameIndex: 38, until: 1.12, xProgress: -0.02 },
];

const AURALINE_VICTORY_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 0, until: 0.09, xProgress: 0, yHopPx: 0 },
  { frameIndex: 1, until: 0.18, xProgress: 0, yHopPx: -2 },
  { frameIndex: 2, until: 0.28, xProgress: 0, yHopPx: -6 },
  { frameIndex: 3, until: 0.40, xProgress: 0, yHopPx: -2 },
  { frameIndex: 4, until: 0.54, xProgress: 0, yHopPx: 0 },
  { frameIndex: 5, until: 0.96, xProgress: 0, yHopPx: 0 },
];

const AURALINE_MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.88,
  idle2: 1.34,
  shoot: 0.56,
  dash_kick: 0.80,
  overdrive: 0.94,
  guard: 0.48,
  dodge: 0.48,
  upgrade: 1.00,
  hit: 0.48,
  defeat: 1.12,
  victory: 0.96,
};

const FRAME_BLEND_DURATION = 0.052;

function sampleAuralineAmbientIdleFrame(
  totalTime: number,
  hoveredColor: TileType | null,
): { frameIndex: number; yHopPx: number } {
  if (hoveredColor === 'attack') {
    return { frameIndex: 9, yHopPx: 0 };
  }
  if (hoveredColor === 'defense') {
    return { frameIndex: 19, yHopPx: 0 };
  }
  if (hoveredColor === 'tech') {
    return { frameIndex: 6, yHopPx: 0 };
  }

  const cycle = ((totalTime % 12) + 12) % 12;
  if (cycle >= 2.0 && cycle < 3.88) {
    const s = sampleSequence(AURALINE_IDLE1_SEQ, cycle - 2.0);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  if (cycle >= 6.8 && cycle < 8.14) {
    const s = sampleSequence(AURALINE_IDLE2_SEQ, cycle - 6.8);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  return { frameIndex: 0, yHopPx: 0 };
}

export function triggerAuralineAnimation(
  prev: HeroAnimState,
  mode: HeroAnimMode,
  options?: { lowHpHit?: boolean },
): HeroAnimState {
  if (prev.mode === 'defeat' && mode === 'defeat') {
    return prev;
  }
  const lowHpHit = Boolean(options?.lowHpHit);
  const duration = mode === 'hit' && lowHpHit ? 0.60 : AURALINE_MODE_DURATIONS[mode];
  const currentFrame = Math.min(AURALINE_SHEET_FRAMES.length - 1, prev.lastFrameIndex ?? 0);
  return {
    mode,
    elapsed: 0,
    duration,
    lowHpHit,
    emittedShots: 0,
    emittedKickImpact: false,
    lastFrameIndex: currentFrame,
    prevFrameIndex: currentFrame,
    frameBlendElapsed: 0,
  };
}

export function stepAuralineAnimState(
  prev: HeroAnimState,
  dt: number,
  context: {
    isDead: boolean;
    isVictory: boolean;
    hoveredColor: TileType | null;
    totalTime: number;
  },
): HeroFrameSample {
  let state = prev;

  if (context.isDead && state.mode !== 'defeat') {
    state = triggerAuralineAnimation(state, 'defeat');
  } else if (!context.isDead && state.mode === 'defeat') {
    state = createInitialHeroAnimState();
  }

  if (state.mode === 'idle') {
    if (context.isVictory) {
      state = triggerAuralineAnimation(state, 'victory');
    } else {
      const { frameIndex, yHopPx } = sampleAuralineAmbientIdleFrame(
        context.totalTime,
        context.hoveredColor,
      );
      const trans = computeFrameTransitionState(state, frameIndex, dt, FRAME_BLEND_DURATION);
      const nextIdleState: HeroAnimState = {
        ...state,
        lastFrameIndex: trans.lastFrameIndex,
        prevFrameIndex: trans.prevFrameIndex,
        frameBlendElapsed: trans.frameBlendElapsed,
      };
      const breathWave = Math.sin(context.totalTime * 2.4);
      const breathScaleY = 1 + breathWave * 0.011;
      const breathScaleX = 1 - breathWave * 0.0055;
      const idleSwayTilt = Math.sin(context.totalTime * 1.5) * 0.0055;
      const idleBobY = yHopPx + Math.cos(context.totalTime * 2.4) * 0.5;
      return {
        state: nextIdleState,
        frameIndex,
        frame: AURALINE_SHEET_FRAMES[frameIndex],
        prevFrameIndex: trans.prevFrameIndex,
        prevFrame: AURALINE_SHEET_FRAMES[trans.prevFrameIndex],
        frameBlendAlpha: trans.frameBlendAlpha,
        xProgress: 0,
        yHopPx: idleBobY,
        breathScaleY,
        breathScaleX,
        tiltRad: idleSwayTilt,
        shouldEmitShot: false,
        shouldEmitKickImpact: false,
        isDashing: false,
      };
    }
  }

  if ((state.mode === 'idle1' || state.mode === 'idle2') && (context.hoveredColor !== null || context.isVictory)) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: Math.min(AURALINE_SHEET_FRAMES.length - 1, state.lastFrameIndex ?? 0),
      prevFrameIndex: Math.min(AURALINE_SHEET_FRAMES.length - 1, state.prevFrameIndex ?? 0),
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepAuralineAnimState(idleState, dt, context);
  }

  const nextElapsed = state.elapsed + dt;

  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: Math.min(AURALINE_SHEET_FRAMES.length - 1, state.lastFrameIndex ?? 0),
      prevFrameIndex: Math.min(AURALINE_SHEET_FRAMES.length - 1, state.prevFrameIndex ?? 0),
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepAuralineAnimState(idleState, 0, context);
  }

  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let seq: readonly SequenceKeyframe[] = AURALINE_SHOOT_SEQ;
  if (state.mode === 'idle1') seq = AURALINE_IDLE1_SEQ;
  else if (state.mode === 'idle2') seq = AURALINE_IDLE2_SEQ;
  else if (state.mode === 'dash_kick') seq = AURALINE_DASH_KICK_SEQ;
  else if (state.mode === 'overdrive') seq = AURALINE_OVERDRIVE_SEQ;
  else if (state.mode === 'guard' || state.mode === 'dodge') seq = AURALINE_GUARD_SEQ;
  else if (state.mode === 'upgrade') seq = AURALINE_UPGRADE_SEQ;
  else if (state.mode === 'hit') seq = state.lowHpHit ? AURALINE_HIT_LOW_HP_SEQ : AURALINE_HIT_NORMAL_SEQ;
  else if (state.mode === 'defeat') seq = AURALINE_DEFEAT_SEQ;
  else if (state.mode === 'victory') seq = AURALINE_VICTORY_SEQ;

  const sampled = sampleSequence(seq, clampedElapsed);

  let emittedKickImpact = state.emittedKickImpact;
  let shouldEmitKickImpact = false;
  if (
    (state.mode === 'dash_kick' || state.mode === 'overdrive') &&
    sampled.frameIndex === 14 &&
    !emittedKickImpact
  ) {
    emittedKickImpact = true;
    shouldEmitKickImpact = true;
  }

  let emittedShots = state.emittedShots;
  let shouldEmitShot = false;
  if (state.mode === 'shoot') {
    if (sampled.frameIndex === 13 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    } else if (sampled.frameIndex === 14 && emittedShots < 2) {
      emittedShots = 2;
      shouldEmitShot = true;
    }
  } else if (state.mode === 'overdrive' && emittedKickImpact) {
    if (sampled.frameIndex === 13 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    } else if (sampled.frameIndex === 15 && emittedShots < 2) {
      emittedShots = 2;
      shouldEmitShot = true;
    }
  }

  const trans = computeFrameTransitionState(state, sampled.frameIndex, dt, FRAME_BLEND_DURATION);

  const nextState: HeroAnimState = {
    ...state,
    elapsed: clampedElapsed,
    emittedShots,
    emittedKickImpact,
    lastFrameIndex: trans.lastFrameIndex,
    prevFrameIndex: trans.prevFrameIndex,
    frameBlendElapsed: trans.frameBlendElapsed,
  };

  let breathScaleY = 1;
  let breathScaleX = 1;
  let tiltRad = 0;

  if (state.mode === 'victory') {
    if (clampedElapsed >= state.duration) {
      const w = Math.sin(context.totalTime * 2.2);
      breathScaleY = 1 + w * 0.012;
      breathScaleX = 1 - w * 0.006;
    } else if (sampled.frameIndex === 1 || sampled.frameIndex === 2) {
      breathScaleY = 1.018;
      breathScaleX = 0.99;
    } else if (sampled.frameIndex === 5) {
      breathScaleY = 0.985;
      breathScaleX = 1.012;
    }
  } else if (state.mode === 'dash_kick' || state.mode === 'overdrive') {
    tiltRad = Math.max(-0.045, Math.min(0.055, sampled.vx * 0.014));
    if (sampled.frameIndex === 14 || sampled.frameIndex === 15) {
      tiltRad = -0.024;
      breathScaleY = 1.016;
      breathScaleX = 0.992;
    }
  } else if (state.mode === 'shoot') {
    if (sampled.frameIndex === 13 || sampled.frameIndex === 14 || sampled.frameIndex === 15) {
      tiltRad = -0.022;
      breathScaleY = 1.012;
      breathScaleX = 0.994;
    }
  } else if (state.mode === 'hit') {
    tiltRad = Math.max(-0.045, Math.min(0, sampled.vx * 0.03));
  } else if (state.mode === 'upgrade') {
    const u = clampedElapsed / Math.max(0.001, state.duration);
    const pulse = Math.sin(u * Math.PI);
    breathScaleY = 1 + pulse * 0.013;
    breathScaleX = 1 - pulse * 0.0065;
  }

  return {
    state: nextState,
    frameIndex: sampled.frameIndex,
    frame: AURALINE_SHEET_FRAMES[sampled.frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: AURALINE_SHEET_FRAMES[trans.prevFrameIndex],
    frameBlendAlpha: trans.frameBlendAlpha,
    xProgress: sampled.xProgress,
    yHopPx: sampled.yHopPx,
    breathScaleY,
    breathScaleX,
    tiltRad,
    shouldEmitShot,
    shouldEmitKickImpact,
    isDashing: sampled.dashing,
  };
}
