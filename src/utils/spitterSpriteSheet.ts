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
    anchorX: 83,
    bottomY: 245,
    mouthOriginRel: { dx: -61, dy: -176 },
    pustuleOriginRel: { dx: 18, dy: -167 },
  },
  {
    id: 'spitter_idle_1',
    row: 0,
    col: 1,
    x: 286,
    y: 8,
    w: 179,
    h: 246,
    anchorX: 82,
    bottomY: 245,
    mouthOriginRel: { dx: -65, dy: -176 },
    pustuleOriginRel: { dx: 13, dy: -167 },
  },
  {
    id: 'spitter_stalk_2',
    row: 0,
    col: 2,
    x: 522,
    y: 12,
    w: 236,
    h: 238,
    anchorX: 118,
    bottomY: 237,
    mouthOriginRel: { dx: -46, dy: -164 },
    pustuleOriginRel: { dx: 11, dy: -166 },
  },
  {
    id: 'spitter_swell_3',
    row: 0,
    col: 3,
    x: 777,
    y: 10,
    w: 208,
    h: 224,
    anchorX: 108,
    bottomY: 223,
    mouthOriginRel: { dx: -61, dy: -154 },
    pustuleOriginRel: { dx: 10, dy: -150 },
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
    anchorX: 87,
    bottomY: 247,
    mouthOriginRel: { dx: -58, dy: -182 },
    pustuleOriginRel: { dx: 3, dy: -159 },
  },
  {
    id: 'spitter_spit_fire_5',
    row: 1,
    col: 1,
    x: 274,
    y: 262,
    w: 184,
    h: 247,
    anchorX: 95,
    bottomY: 246,
    // Trim ONLY the static bile jet exiting past the lips/teeth (x>=170)
    excludeRects: [{ x: 170, y: 71, w: 14, h: 21 }],
    mouthOriginRel: { dx: -61, dy: -168 },
    pustuleOriginRel: { dx: 23, dy: -170 },
  },
  {
    id: 'spitter_spit_stream_6',
    row: 1,
    col: 2,
    x: 521,
    y: 263,
    w: 226,
    h: 246,
    anchorX: 88,
    bottomY: 245,
    // Keep the full outstretched clawed hand (y>=110) while trimming only the static green bile jet (x>=185, y<=104)
    excludeRects: [
      { x: 185, y: 52, w: 41, h: 52 },
      { x: 218, y: 102, w: 8, h: 10 },
    ],
    mouthOriginRel: { dx: -71, dy: -168 },
    pustuleOriginRel: { dx: 12, dy: -163 },
  },
  {
    id: 'spitter_spit_recover_7',
    row: 1,
    col: 3,
    x: 790,
    y: 263,
    w: 188,
    h: 246,
    anchorX: 91,
    bottomY: 245,
    // Strip overhanging green bile stream tips from frame 6 on upper-left edge
    excludeRects: [{ x: 0, y: 40, w: 30, h: 102 }],
    mouthOriginRel: { dx: -56, dy: -170 },
    pustuleOriginRel: { dx: 12, dy: -169 },
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
    anchorX: 99,
    bottomY: 247,
    mouthOriginRel: { dx: -57, dy: -172 },
    pustuleOriginRel: { dx: 6, dy: -160 },
  },
  {
    id: 'spitter_claw_lunge_9',
    row: 2,
    col: 1,
    x: 265,
    y: 530,
    w: 245,
    h: 233,
    anchorX: 134,
    bottomY: 232,
    mouthOriginRel: { dx: -36, dy: -168 },
    pustuleOriginRel: { dx: 21, dy: -156 },
  },
  {
    id: 'spitter_pustule_flare_10',
    row: 2,
    col: 2,
    x: 533,
    y: 520,
    w: 199,
    h: 246,
    anchorX: 105,
    bottomY: 245,
    mouthOriginRel: { dx: -37, dy: -164 },
    pustuleOriginRel: { dx: 22, dy: -163 },
  },
  {
    id: 'spitter_guard_11',
    row: 2,
    col: 3,
    x: 787,
    y: 533,
    w: 215,
    h: 233,
    anchorX: 111,
    bottomY: 232,
    mouthOriginRel: { dx: -41, dy: -162 },
    pustuleOriginRel: { dx: 10, dy: -164 },
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
    anchorX: 104,
    bottomY: 248,
    mouthOriginRel: { dx: -32, dy: -188 },
    pustuleOriginRel: { dx: 27, dy: -174 },
  },
  {
    id: 'spitter_stagger_13',
    row: 3,
    col: 1,
    x: 290,
    y: 776,
    w: 193,
    h: 245,
    anchorX: 97,
    bottomY: 244,
    mouthOriginRel: { dx: -51, dy: -172 },
    pustuleOriginRel: { dx: 10, dy: -181 },
  },
  {
    id: 'spitter_collapse_14',
    row: 3,
    col: 2,
    x: 516,
    y: 805,
    w: 249,
    h: 214,
    anchorX: 123,
    bottomY: 213,
    mouthOriginRel: { dx: -64, dy: -108 },
    pustuleOriginRel: { dx: 4, dy: -137 },
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
    pustuleOriginRel: { dx: 26, dy: -69 },
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
