import type { TileType } from '../engine/types';

export type HeroSheetSource = 'combat' | 'emote' | 'dodge';

export interface HeroFrameDef {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal pixel offset inside this frame representing the hero's planted foot / torso pivot */
  anchorX: number;
  /** Vertical pixel offset inside this frame representing ground contact (bottom of soles/knees/body) */
  bottomY: number;
  /** Per-frame scale normalization multiplier so standing character height is strictly 214.0px across all rows */
  rowScale: number;
  /** Which sprite sheet image this frame belongs to */
  sheet?: HeroSheetSource;
  /** Optional muzzle point relative to (anchorX, bottomY) in unscaled sprite pixels */
  muzzleRel?: { dx: number; dy: number };
  /** Optional kick arc tip relative to (anchorX, bottomY) in unscaled sprite pixels */
  kickTipRel?: { dx: number; dy: number };
  /** Optional sub-rectangles (relative to frame top-left) to clear before background removal */
  excludeRects?: readonly { x: number; y: number; w: number; h: number }[];
}

export type HeroAnimMode =
  | 'idle'
  | 'idle1'
  | 'idle2'
  | 'shoot'
  | 'dash_kick'
  | 'overdrive'
  | 'guard'
  | 'dodge'
  | 'upgrade'
  | 'hit'
  | 'defeat'
  | 'victory';

export interface HeroAnimState {
  mode: HeroAnimMode;
  elapsed: number;
  duration: number;
  lowHpHit: boolean;
  /** Tracks which burst events have already fired inside the current clip */
  emittedShots: number;
  emittedKickImpact: boolean;
  /** Tracks previous frame index & cross-dissolve progress so pose switches never pop */
  lastFrameIndex?: number;
  prevFrameIndex?: number;
  frameBlendElapsed?: number;
}

export interface HeroFrameSample {
  state: HeroAnimState;
  frameIndex: number;
  frame: HeroFrameDef;
  /** Outgoing frame index during sub-frame pose cross-dissolve */
  prevFrameIndex: number;
  prevFrame: HeroFrameDef;
  /** Cross-dissolve progress in [0..1] (1 = fully on current frame) */
  frameBlendAlpha: number;
  /** Normalized arena travel from hero base X toward front enemy (0 = base, 1 = melee contact, negative = knockback) */
  xProgress: number;
  /** Vertical hop/breath offset in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  /** Subtle breathing / squash-and-stretch vertical scale */
  breathScaleY: number;
  /** Volume-preserving horizontal squash-and-stretch scale */
  breathScaleX: number;
  /** Subtle procedural body tilt in radians (positive = lean forward, negative = recoil back) */
  tiltRad: number;
  /** True on frames where a fresh pistol bolt should launch */
  shouldEmitShot: boolean;
  /** True on the impact peak frame of the high plasma kick */
  shouldEmitKickImpact: boolean;
  /** True while dashing forward/back so canvas can draw cyan speed afterimages */
  isDashing: boolean;
}

export interface HeroAnimStepContext {
  isDead: boolean;
  isVictory: boolean;
  hoveredColor: TileType | null;
  totalTime: number;
}

export function createInitialHeroAnimState(): HeroAnimState {
  return {
    mode: 'idle',
    elapsed: 0,
    duration: 0,
    lowHpHit: false,
    emittedShots: 0,
    emittedKickImpact: false,
    lastFrameIndex: 0,
    prevFrameIndex: 0,
    frameBlendElapsed: 0.052,
  };
}

/** Temporary Phase 5–6 compatibility aliases until Phase 6–7 callers complete cleanup. */
export type HeroineSheetSource = HeroSheetSource;
export type HeroineFrameDef = HeroFrameDef;
export type HeroineAnimMode = HeroAnimMode;
export type HeroineAnimState = HeroAnimState;
export type HeroineFrameSample = HeroFrameSample;
export const createInitialHeroineAnimState = createInitialHeroAnimState;
