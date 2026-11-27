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

export const AURALINE_SHEET_WIDTH = 1024;
export const AURALINE_SHEET_HEIGHT = 1024;
export const AURALINE_CELL_SIZE = 256;
export const AURALINE_CANONICAL_HEIGHT = 214;
export const AURALINE_AEGIS_COUNTER_DURATION = 0.78;

export const AURALINE_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeBottomFloorShadow: true,
  defringeStrength: 0.78,
};

function makeCell(
  id: string,
  row: number,
  col: number,
  sheet: 'combat' | 'emote',
  anchorX = 114,
  bottomY = 249,
  rowScale = 1,
  extras?: Partial<Pick<HeroFrameDef, 'muzzleRel' | 'kickTipRel'>>,
): HeroFrameDef {
  return {
    id,
    row,
    col,
    x: col * AURALINE_CELL_SIZE,
    y: row * AURALINE_CELL_SIZE,
    w: AURALINE_CELL_SIZE,
    h: AURALINE_CELL_SIZE,
    anchorX,
    bottomY,
    rowScale,
    sheet,
    ...extras,
  };
}

/**
 * Uniform scale factor mapping 238px standing character height in 256×256 cells
 * to the 214.0px canonical hero height on the bridge deck (`214 / 238 = 0.8992`).
 */
export const AURALINE_UNIFORM_ROW_SCALE = 0.8992;

/**
 * Auraline Sheet A (`auraline_sheet_a.png` — 1024×1024, 4×4 grid of 256×256 cells, F0..F15):
 * - Row 0 (F0..F3): Armored Idle & Reactor Breathing (4f)
 * - Row 1 (F4..F7): Armored Brace/Step (F4..F5) + Twin-Barrel Scattergun Aim & Fire (F6..F7)
 * - Row 2 (F8..F11): Scattergun Recoil Brace (F8) + Artillery Surge Blast Overcharge, Lock-On & Signature Wide-Legged Recoil Roar (F9..F11)
 * - Row 3 (F12..F15): Artillery Smoking Barrel Cooldown (F12), Aegis Gauntlet Guard (F13), Impact Hit Stagger (F14), One-Knee Overload Defeat (F15)
 */
export const AURALINE_SHEET_A_FRAMES: readonly HeroFrameDef[] = [
  makeCell('auraline_f0', 0, 0, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f1', 0, 1, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f2', 0, 2, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f3', 0, 3, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f4', 1, 0, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f5', 1, 1, 'combat', 115, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f6', 1, 2, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE, {
    muzzleRel: { dx: 118, dy: -173 },
  }),
  makeCell('auraline_f7', 1, 3, 'combat', 113, 249, AURALINE_UNIFORM_ROW_SCALE, {
    muzzleRel: { dx: 136, dy: -174 },
  }),
  makeCell('auraline_f8', 2, 0, 'combat', 116, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f9', 2, 1, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f10', 2, 2, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE, {
    muzzleRel: { dx: 115, dy: -167 },
  }),
  makeCell('auraline_f11', 2, 3, 'combat', 125, 249, AURALINE_UNIFORM_ROW_SCALE, {
    muzzleRel: { dx: 83, dy: -163 },
  }),
  makeCell('auraline_f12', 3, 0, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f13', 3, 1, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f14', 3, 2, 'combat', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f15', 3, 3, 'combat', 120, 249, AURALINE_UNIFORM_ROW_SCALE),
];

/**
 * Auraline Sheet B (`auraline_sheet_b.png` — 1024×1024, 4×4 grid of 256×256 cells, F16..F31):
 * - Row 0 (F16..F19): Defensive Aegis Shield-Block Counter-Brace (4f)
 * - Row 1 (F20..F22): Sovereign Broadside Overdrive (3f: F20 tiara/reactor flare, F21 broadside salvo, F22 smoking vent)
 * - Row 1 Col 3 + Row 2 Col 0 (F23..F24): Emote 1 Royal Curtsy (2f)
 * - Row 2 Cols 1..2 (F25..F26): Emote 2 Scattergun Chamber Inspection (2f)
 * - Row 2 Col 3 + Row 3 Col 0 (F27..F28): Golden Reactor Core Plating & UpCharge Surge (2f)
 * - Row 3 Cols 1..3 (F29..F31): Victory Royal Salute (3f)
 */
export const AURALINE_SHEET_B_FRAMES: readonly HeroFrameDef[] = [
  makeCell('auraline_f16', 0, 0, 'emote', 138, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f17', 0, 1, 'emote', 136, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f18', 0, 2, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f19', 0, 3, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f20', 1, 0, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f21', 1, 1, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE, {
    muzzleRel: { dx: 133, dy: -173 },
  }),
  makeCell('auraline_f22', 1, 2, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f23', 1, 3, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f24', 2, 0, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f25', 2, 1, 'emote', 117, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f26', 2, 2, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f27', 2, 3, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f28', 3, 0, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f29', 3, 1, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f30', 3, 2, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
  makeCell('auraline_f31', 3, 3, 'emote', 114, 249, AURALINE_UNIFORM_ROW_SCALE),
];

export const AURALINE_SHEET_FRAMES: readonly HeroFrameDef[] = [
  ...AURALINE_SHEET_A_FRAMES,
  ...AURALINE_SHEET_B_FRAMES,
];

/**
 * Pure rule determining whether an incoming enemy attack triggers Auraline's
 * Defensive Aegis Shield-Block Counter-Brace reflex (`F16..F19`):
 * fires whenever Auraline absorbs an incoming attack for `0` HP damage!
 */
export function shouldAuralineAegisCounter(params: {
  charId: CharacterId;
  isLethal: boolean;
  hpDamage: number;
  armorDamage?: number;
}): boolean {
  return (
    params.charId === 'auraline' &&
    !params.isLethal &&
    params.hpDamage === 0
  );
}

const MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.4,
  idle2: 1.5,
  shoot: 0.52,
  dash_kick: 0.76,
  overdrive: 0.88,
  guard: 0.48,
  dodge: AURALINE_AEGIS_COUNTER_DURATION,
  upgrade: 0.88,
  hit: 0.44,
  defeat: 0.40,
  victory: 0.85,
};

const SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 6, until: 0.14, xProgress: 0 },
  { frameIndex: 7, until: 0.34, xProgress: 0 },
  { frameIndex: 8, until: 0.48, xProgress: 0 },
  { frameIndex: 0, until: 0.52, xProgress: 0 },
];

// 100% Planted Artillery Surge Blast (F9 reactor charge -> F10 lock-on -> F11 wide-stance recoil roar + cyber-ring beam -> F12 smoking barrel cooldown)
const ARTILLERY_SURGE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.14, xProgress: 0 },
  { frameIndex: 10, until: 0.28, xProgress: 0 },
  { frameIndex: 11, until: 0.58, xProgress: 0 },
  { frameIndex: 12, until: 0.72, xProgress: 0 },
  { frameIndex: 0, until: 0.76, xProgress: 0 },
];

// 100% Planted Sovereign Broadside Overdrive (F20 tiara/reactor flare -> F21 commanding artillery salvo -> F22 smoking heat-sink vent)
const SOVEREIGN_BROADSIDE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 20, until: 0.22, xProgress: 0, yHopPx: 0 },
  { frameIndex: 21, until: 0.60, xProgress: 0, yHopPx: 0 },
  { frameIndex: 22, until: 0.80, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.88, xProgress: 0, yHopPx: 0 },
];

// Planted Defensive Aegis Shield-Block Counter-Brace (F16..F19)
const AEGIS_COUNTER_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.20, xProgress: 0, yHopPx: 0 },
  { frameIndex: 17, until: 0.44, xProgress: 0, yHopPx: 0 },
  { frameIndex: 18, until: 0.62, xProgress: 0, yHopPx: 0 },
  { frameIndex: 19, until: 0.74, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.78, xProgress: 0, yHopPx: 0 },
];

export function triggerAuralineAnimation(
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

export function stepAuralineAnimState(
  prev: HeroAnimState,
  dt: number,
  context: HeroAnimStepContext,
): HeroFrameSample {
  let state = prev;
  if (context.isDead && state.mode !== 'defeat') {
    state = triggerAuralineAnimation(state, 'defeat');
  } else if (!context.isDead && context.isVictory && state.mode !== 'victory') {
    state = triggerAuralineAnimation(state, 'victory');
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
      else frameIndex = [0, 1, 2, 3][Math.floor(context.totalTime / 0.36) % 4];
    }
    const trans = computeFrameTransitionState(state, frameIndex, dt, 0);
    return {
      state: { ...state, ...trans },
      frameIndex,
      frame: AURALINE_SHEET_FRAMES[frameIndex],
      prevFrameIndex: trans.prevFrameIndex,
      prevFrame: AURALINE_SHEET_FRAMES[trans.prevFrameIndex],
      frameBlendAlpha: 1,
      xProgress: 0,
      yHopPx: 0,
      breathScaleY: 1 + Math.sin(context.totalTime * 2.2) * 0.01,
      breathScaleX: 1 - Math.sin(context.totalTime * 2.2) * 0.005,
      tiltRad: 0,
      shouldEmitShot: false,
      shouldEmitKickImpact: false,
      isDashing: false,
    };
  }

  const nextElapsed = state.elapsed + dt;
  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    return stepAuralineAnimState(
      { ...createInitialHeroAnimState(), lastFrameIndex: state.lastFrameIndex ?? 0 },
      0,
      context,
    );
  }
  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let frameIndex = 0;
  let xProgress = 0;
  const yHopPx = 0;
  const isDashing = false;
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
    const s = sampleSequence(ARTILLERY_SURGE_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    if (frameIndex === 11 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    }
  } else if (state.mode === 'overdrive') {
    const s = sampleSequence(SOVEREIGN_BROADSIDE_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
    if (frameIndex === 21 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
      emittedKickImpact = true;
      shouldEmitKickImpact = true;
    }
  } else if (state.mode === 'dodge') {
    const s = sampleSequence(AEGIS_COUNTER_SEQ, clampedElapsed);
    frameIndex = s.frameIndex;
    xProgress = s.xProgress;
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
    xProgress = -0.035 * Math.sin((clampedElapsed / state.duration) * Math.PI);
  } else if (state.mode === 'defeat') {
    frameIndex = 15;
  } else if (state.mode === 'victory') {
    frameIndex = clampedElapsed < 0.25 ? 29 : clampedElapsed < 0.55 ? 30 : 31;
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
    frame: AURALINE_SHEET_FRAMES[frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: AURALINE_SHEET_FRAMES[trans.prevFrameIndex],
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
