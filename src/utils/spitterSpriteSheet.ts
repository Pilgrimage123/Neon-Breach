import type { SpriteRect } from './spriteCutout';
import type { FrameTransitionResult } from './spriteSheetAnim';

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
  transitionState?: FrameTransitionResult;
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
