import type { CharacterId } from '../engine/types';
import {
  type HeroAnimMode,
  type HeroAnimState,
  type HeroAnimStepContext,
  type HeroFrameDef,
  type HeroFrameSample,
  createInitialHeroAnimState,
} from './heroAnimator';
import type { SpriteCutoutOptions } from './spriteCutout';
import {
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleSequence,
} from './spriteSheetAnim';

export {
  createInitialHeroAnimState,
  type HeroAnimMode,
  type HeroAnimState,
  type HeroFrameDef,
  type HeroFrameSample,
  type HeroSheetSource,
} from './heroAnimator';

export const KIRA_SHEET_WIDTH = 1024;
export const KIRA_SHEET_HEIGHT = 1024;
export const KIRA_CELL_SIZE = 256;
export const KIRA_CANONICAL_HEIGHT = 214;
export const KIRA_DODGE_DURATION = 0.96;

export const KIRA_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 14,
  defringeStrength: 0.78,
};

function makeCell(
  id: string,
  row: number,
  col: number,
  sheet: 'combat' | 'emote',
  anchorX = 128,
  bottomY = 248,
  rowScale = 1,
  extras?: Partial<Pick<HeroFrameDef, 'muzzleRel' | 'kickTipRel'>>,
): HeroFrameDef {
  return {
    id,
    row,
    col,
    x: col * KIRA_CELL_SIZE,
    y: row * KIRA_CELL_SIZE,
    w: KIRA_CELL_SIZE,
    h: KIRA_CELL_SIZE,
    anchorX,
    bottomY,
    rowScale,
    sheet,
    ...extras,
  };
}

export const KIRA_UNIFORM_ROW_SCALE = 0.8807;

export const KIRA_SHEET_A_FRAMES: readonly HeroFrameDef[] = [
  makeCell('kira_f0', 0, 0, 'combat', 123.19, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f1', 0, 1, 'combat', 121.04, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f2', 0, 2, 'combat', 118.38, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f3', 0, 3, 'combat', 122.11, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f4', 1, 0, 'combat', 120.32, 254, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f5', 1, 1, 'combat', 125.36, 255, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f6', 1, 2, 'combat', 101.41, 256, KIRA_UNIFORM_ROW_SCALE, { muzzleRel: { dx: 114.6, dy: -213 } }),
  makeCell('kira_f7', 1, 3, 'combat', 106.61, 256, KIRA_UNIFORM_ROW_SCALE, { muzzleRel: { dx: 144.4, dy: -179 } }),
  makeCell('kira_f8', 2, 0, 'combat', 124.18, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f9', 2, 1, 'combat', 107.96, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f10', 2, 2, 'combat', 121.57, 256, KIRA_UNIFORM_ROW_SCALE, { muzzleRel: { dx: 103.4, dy: -157 } }),
  makeCell('kira_f11', 2, 3, 'combat', 141.26, 250, KIRA_UNIFORM_ROW_SCALE, { muzzleRel: { dx: 52.7, dy: -157.8 } }),
  makeCell('kira_f12', 3, 0, 'combat', 107.76, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f13', 3, 1, 'combat', 124.53, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f14', 3, 2, 'combat', 116.18, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f15', 3, 3, 'combat', 122.57, 255, KIRA_UNIFORM_ROW_SCALE),
];

export const KIRA_SHEET_B_FRAMES: readonly HeroFrameDef[] = [
  makeCell('kira_f16', 0, 0, 'emote', 123.46, 209, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f17', 0, 1, 'emote', 97.17, 242, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f18', 0, 2, 'emote', 145.33, 237, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f19', 0, 3, 'emote', 129.62, 251, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f20', 1, 0, 'emote', 133.11, 255, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f21', 1, 1, 'emote', 116.68, 192, KIRA_UNIFORM_ROW_SCALE, { kickTipRel: { dx: 138.3, dy: -52 } }),
  makeCell('kira_f22', 1, 2, 'emote', 137.01, 245, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f23', 1, 3, 'emote', 140.32, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f24', 2, 0, 'emote', 133.54, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f25', 2, 1, 'emote', 137.67, 255, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f26', 2, 2, 'emote', 140.3, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f27', 2, 3, 'emote', 135.82, 255, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f28', 3, 0, 'emote', 122.36, 256, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f29', 3, 1, 'emote', 142.01, 245, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f30', 3, 2, 'emote', 135.67, 233, KIRA_UNIFORM_ROW_SCALE),
  makeCell('kira_f31', 3, 3, 'emote', 137.13, 256, KIRA_UNIFORM_ROW_SCALE),
];

export const KIRA_SHEET_FRAMES: readonly HeroFrameDef[] = [
  ...KIRA_SHEET_A_FRAMES,
  ...KIRA_SHEET_B_FRAMES,
];

/** Pure rule determining whether an incoming enemy attack triggers Kira's evasive dodge choreography. */
export function shouldKiraDodgeAttack(params: {
  charId: CharacterId;
  isLethal: boolean;
  hpDamage: number;
  armorDamage: number;
}): boolean {
  return (
    params.charId === 'kira' &&
    !params.isLethal &&
    params.hpDamage === 0 &&
    params.armorDamage === 0
  );
}

const MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.4,
  idle2: 1.5,
  shoot: 0.50,
  dash_kick: 0.72,
  overdrive: 0.88,
  guard: 0.48,
  dodge: KIRA_DODGE_DURATION,
  upgrade: 0.88,
  hit: 0.44,
  defeat: 0.40,
  victory: 0.85,
};

const SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 6, until: 0.14, xProgress: 0.02 },
  { frameIndex: 7, until: 0.34, xProgress: 0.04 },
  { frameIndex: 8, until: 0.46, xProgress: 0.01 },
  { frameIndex: 0, until: 0.50, xProgress: 0 },
];

const SURGE_BLAST_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.14, xProgress: 0.01 },
  { frameIndex: 10, until: 0.30, xProgress: 0.02 },
  { frameIndex: 11, until: 0.56, xProgress: -0.05 },
  { frameIndex: 12, until: 0.68, xProgress: -0.02 },
  { frameIndex: 0, until: 0.72, xProgress: 0 },
];

const OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 4, until: 0.08, xProgress: 0.22, yHopPx: 0, dashing: true },
  { frameIndex: 5, until: 0.16, xProgress: 0.48, yHopPx: -4, dashing: true },
  { frameIndex: 2, until: 0.24, xProgress: 0.72, yHopPx: -6, dashing: true },
  { frameIndex: 20, until: 0.34, xProgress: 0.82, yHopPx: -10, dashing: true },
  { frameIndex: 21, until: 0.62, xProgress: 0.94, yHopPx: -26, dashing: true },
  { frameIndex: 22, until: 0.76, xProgress: 0.45, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.88, xProgress: 0, yHopPx: 0 },
];

const DODGE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.22, xProgress: -0.14, yHopPx: -26, dashing: true },
  { frameIndex: 17, until: 0.46, xProgress: -0.26, yHopPx: 0, dashing: true },
  { frameIndex: 18, until: 0.68, xProgress: -0.22, yHopPx: -18, dashing: true },
  { frameIndex: 19, until: 0.86, xProgress: -0.08, yHopPx: 0, dashing: false },
  { frameIndex: 0, until: 0.96, xProgress: 0, yHopPx: 0, dashing: false },
];

export function triggerKiraAnimation(
  prev: HeroAnimState,
  mode: HeroAnimMode,
  opts?: { lowHpHit?: boolean },
): HeroAnimState {
  if (mode === 'idle') {
    return {
      ...createInitialHeroAnimState(),
      lastFrameIndex: prev.lastFrameIndex ?? 0,
      prevFrameIndex: prev.lastFrameIndex ?? 0,
    };
  }
  return {
    mode,
    elapsed: 0,
    duration: MODE_DURATIONS[mode],
    lowHpHit: Boolean(opts?.lowHpHit),
    emittedShots: 0,
    emittedKickImpact: false,
    lastFrameIndex: prev.lastFrameIndex ?? 0,
    prevFrameIndex: prev.lastFrameIndex ?? 0,
    frameBlendElapsed: 0,
  };
}

export function stepKiraAnimState(
  prev: HeroAnimState,
  dt: number,
  context: HeroAnimStepContext,
): HeroFrameSample {
  let state = prev;
  if (context.isDead && state.mode !== 'defeat') {
    state = triggerKiraAnimation(state, 'defeat');
  } else if (!context.isDead && context.isVictory && state.mode !== 'victory') {
    state = triggerKiraAnimation(state, 'victory');
  }

  if (state.mode === 'idle') {
    let frameIndex = 0;
    if (context.hoveredColor === 'attack') frameIndex = 6;
    else if (context.hoveredColor === 'defense') frameIndex = 13;
    else if (context.hoveredColor === 'tech') frameIndex = 27;
    else {
      const cycle = context.totalTime % 10;
      if (cycle >= 2.2 && cycle < 3.6) frameIndex = cycle < 2.9 ? 23 : 24;
      else if (cycle >= 7.0 && cycle < 8.5) frameIndex = cycle < 7.75 ? 25 : 26;
      else frameIndex = [0, 1, 3, 8][Math.floor(context.totalTime / 0.36) % 4];
    }
    const trans = computeFrameTransitionState(state, frameIndex, dt, 0);
    return {
      state: { ...state, ...trans },
      frameIndex,
      frame: KIRA_SHEET_FRAMES[frameIndex],
      prevFrameIndex: trans.prevFrameIndex,
      prevFrame: KIRA_SHEET_FRAMES[trans.prevFrameIndex],
      frameBlendAlpha: 1,
      xProgress: 0,
      yHopPx: 0,
      breathScaleY: 1 + Math.sin(context.totalTime * 2.4) * 0.012,
      breathScaleX: 1 - Math.sin(context.totalTime * 2.4) * 0.006,
      tiltRad: 0,
      shouldEmitShot: false,
      shouldEmitKickImpact: false,
      isDashing: false,
    };
  }

  const nextElapsed = state.elapsed + dt;
  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    return stepKiraAnimState(
      { ...createInitialHeroAnimState(), lastFrameIndex: state.lastFrameIndex ?? 0 },
      0,
      context,
    );
  }
  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let frameIndex = 0;
  let xProgress = 0;
  let yHopPx = 0;
  let isDashing = false;
  let shouldEmitShot = false;
  let shouldEmitKickImpact = false;
  let emittedShots = state.emittedShots;
  let emittedKickImpact = state.emittedKickImpact;

  if (state.mode === 'shoot') {
    const s = sampleSequence(SHOOT_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    if (frameIndex === 7 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    }
  } else if (state.mode === 'dash_kick') {
    const s = sampleSequence(SURGE_BLAST_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    if (frameIndex === 11 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    }
  } else if (state.mode === 'overdrive') {
    const s = sampleSequence(OVERDRIVE_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    yHopPx = s.yHopPx;
    isDashing = s.dashing;
    if (frameIndex === 21 && !emittedKickImpact) {
      emittedKickImpact = true;
      shouldEmitKickImpact = true;
    }
  } else if (state.mode === 'dodge') {
    const s = sampleSequence(DODGE_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    yHopPx = s.yHopPx;
    isDashing = s.dashing;
  } else if (state.mode === 'idle1') {
    frameIndex = clampedElapsed < 0.7 ? 23 : 24;
  } else if (state.mode === 'idle2') {
    frameIndex = clampedElapsed < 0.75 ? 25 : 26;
  } else if (state.mode === 'upgrade') {
    frameIndex = clampedElapsed < 0.36 ? 27 : 28;
  } else if (state.mode === 'guard') {
    frameIndex = 13;
  } else if (state.mode === 'hit') {
    frameIndex = 14;
    xProgress = -0.04 * Math.sin((clampedElapsed / state.duration) * Math.PI);
  } else if (state.mode === 'defeat') {
    frameIndex = 15;
  } else if (state.mode === 'victory') {
    frameIndex = clampedElapsed < 0.2 ? 29 : clampedElapsed < 0.55 ? 30 : 31;
    if (frameIndex === 30) yHopPx = -16;
  }

  const trans = computeFrameTransitionState(state, frameIndex, dt, 0);
  return {
    state: {
      ...state,
      elapsed: clampedElapsed,
      emittedShots,
      emittedKickImpact,
      ...trans,
    },
    frameIndex,
    frame: KIRA_SHEET_FRAMES[frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: KIRA_SHEET_FRAMES[trans.prevFrameIndex],
    frameBlendAlpha: 1,
    xProgress,
    yHopPx,
    breathScaleY: 1,
    breathScaleX: 1,
    tiltRad: 0,
    shouldEmitShot,
    shouldEmitKickImpact,
    isDashing,
  };
}
