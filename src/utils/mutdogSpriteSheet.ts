import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';
import type { FrameTransitionResult } from './spriteSheetAnim';

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
  /** Horizontal offset inside frame rect (before left-facing flip) centered on pelvis/torso mass (35%..65% height) */
  anchorX: number;
  /** Vertical offset inside frame rect where clawed paws meet the bridge deck */
  bottomY: number;
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px (-dx = left/forward) for twin lure midpoint */
  lureOriginRel: { dx: number; dy: number };
  /** Exact relative offsets from (anchorX, bottomY) in post-flip unscaled px for [frontBulb, rearBulb] antenna tips */
  lureBulbsRel: readonly [{ dx: number; dy: number }, { dx: number; dy: number }];
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px for feral glowing eye */
  eyeOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px (-dx = left/forward) for foaming jaws */
  mawOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px for leading foreclaw rake/impact */
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
    anchorX: 130,
    bottomY: 167,
    lureOriginRel: { dx: -90, dy: -138 },
    lureBulbsRel: [
      { dx: -112, dy: -137 },
      { dx: -68, dy: -140 },
    ],
    eyeOriginRel: { dx: -73, dy: -107 },
    mawOriginRel: { dx: -90, dy: -74 },
    clawOriginRel: { dx: -51, dy: -14 },
  },
  {
    id: 'mutdog_idle_1',
    row: 0,
    col: 1,
    x: 255,
    y: 43,
    w: 257,
    h: 178,
    anchorX: 130,
    bottomY: 175,
    excludeRects: [{ x: 0, y: 28, w: 6, h: 18 }],
    lureOriginRel: { dx: -93, dy: -148 },
    lureBulbsRel: [
      { dx: -115, dy: -148 },
      { dx: -72, dy: -149 },
    ],
    eyeOriginRel: { dx: -76, dy: -115 },
    mawOriginRel: { dx: -95, dy: -87 },
    clawOriginRel: { dx: -57, dy: -14 },
  },
  {
    id: 'mutdog_snarl_2',
    row: 0,
    col: 2,
    x: 511,
    y: 39,
    w: 257,
    h: 182,
    anchorX: 131,
    bottomY: 179,
    lureOriginRel: { dx: -89, dy: -152 },
    lureBulbsRel: [
      { dx: -111, dy: -152 },
      { dx: -68, dy: -153 },
    ],
    eyeOriginRel: { dx: -74, dy: -120 },
    mawOriginRel: { dx: -90, dy: -84 },
    clawOriginRel: { dx: -56, dy: -14 },
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
    lureOriginRel: { dx: -93, dy: -114 },
    lureBulbsRel: [
      { dx: -112, dy: -110 },
      { dx: -74, dy: -118 },
    ],
    eyeOriginRel: { dx: -73, dy: -85 },
    mawOriginRel: { dx: -90, dy: -51 },
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
    anchorX: 133,
    bottomY: 241,
    lureOriginRel: { dx: -68, dy: -215 },
    lureBulbsRel: [
      { dx: -93, dy: -217 },
      { dx: -44, dy: -214 },
    ],
    eyeOriginRel: { dx: -61, dy: -175 },
    mawOriginRel: { dx: -80, dy: -141 },
    clawOriginRel: { dx: -51, dy: -16 },
  },
  {
    id: 'mutdog_coil_prime_5',
    row: 1,
    col: 1,
    x: 269,
    y: 305,
    w: 243,
    h: 176,
    anchorX: 123,
    bottomY: 173,
    lureOriginRel: { dx: -91, dy: -140 },
    lureBulbsRel: [
      { dx: -109, dy: -136 },
      { dx: -73, dy: -144 },
    ],
    eyeOriginRel: { dx: -71, dy: -112 },
    mawOriginRel: { dx: -89, dy: -83 },
    clawOriginRel: { dx: -45, dy: -12 },
  },
  {
    id: 'mutdog_guard_6',
    row: 1,
    col: 2,
    x: 516,
    y: 283,
    w: 252,
    h: 202,
    anchorX: 129,
    bottomY: 199,
    lureOriginRel: { dx: -93, dy: -156 },
    lureBulbsRel: [
      { dx: -111, dy: -152 },
      { dx: -75, dy: -160 },
    ],
    eyeOriginRel: { dx: -72, dy: -128 },
    mawOriginRel: { dx: -91, dy: -99 },
    clawOriginRel: { dx: -55, dy: -14 },
  },
  {
    id: 'mutdog_bound_7',
    row: 1,
    col: 3,
    x: 767,
    y: 293,
    w: 254,
    h: 189,
    anchorX: 127,
    bottomY: 186,
    lureOriginRel: { dx: -96, dy: -157 },
    lureBulbsRel: [
      { dx: -116, dy: -155 },
      { dx: -76, dy: -160 },
    ],
    eyeOriginRel: { dx: -76, dy: -126 },
    mawOriginRel: { dx: -95, dy: -98 },
    clawOriginRel: { dx: -71, dy: -40 },
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
    anchorX: 117,
    bottomY: 242,
    excludeRects: [{ x: 215, y: 165, w: 21, h: 62 }],
    lureOriginRel: { dx: -87, dy: -214 },
    lureBulbsRel: [
      { dx: -105, dy: -213 },
      { dx: -70, dy: -216 },
    ],
    eyeOriginRel: { dx: -72, dy: -184 },
    mawOriginRel: { dx: -89, dy: -151 },
    clawOriginRel: { dx: -71, dy: -88 },
  },
  {
    id: 'mutdog_pounce_air_9',
    row: 2,
    col: 1,
    x: 255,
    y: 520,
    w: 257,
    h: 209,
    anchorX: 148,
    bottomY: 206,
    excludeRects: [{ x: 0, y: 115, w: 9, h: 28 }],
    lureOriginRel: { dx: -97, dy: -175 },
    lureBulbsRel: [
      { dx: -115, dy: -172 },
      { dx: -80, dy: -178 },
    ],
    eyeOriginRel: { dx: -79, dy: -146 },
    mawOriginRel: { dx: -94, dy: -108 },
    clawOriginRel: { dx: -87, dy: -94 },
  },
  {
    id: 'mutdog_maul_slam_10',
    row: 2,
    col: 2,
    x: 511,
    y: 534,
    w: 257,
    h: 228,
    anchorX: 137,
    bottomY: 225,
    excludeRects: [
      { x: 0, y: 10, w: 15, h: 105 },
      { x: 224, y: 170, w: 33, h: 56 },
    ],
    lureOriginRel: { dx: -92, dy: -163 },
    lureBulbsRel: [
      { dx: -109, dy: -156 },
      { dx: -75, dy: -171 },
    ],
    eyeOriginRel: { dx: -66, dy: -139 },
    mawOriginRel: { dx: -81, dy: -104 },
    clawOriginRel: { dx: -69, dy: -12 },
  },
  {
    id: 'mutdog_claw_rend_11',
    row: 2,
    col: 3,
    x: 774,
    y: 550,
    w: 234,
    h: 204,
    anchorX: 114,
    bottomY: 201,
    lureOriginRel: { dx: -90, dy: -158 },
    lureBulbsRel: [
      { dx: -107, dy: -149 },
      { dx: -73, dy: -168 },
    ],
    eyeOriginRel: { dx: -64, dy: -136 },
    mawOriginRel: { dx: -79, dy: -103 },
    clawOriginRel: { dx: -97, dy: -66 },
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
    anchorX: 124,
    bottomY: 245,
    lureOriginRel: { dx: -53, dy: -224 },
    lureBulbsRel: [
      { dx: -69, dy: -227 },
      { dx: -37, dy: -222 },
    ],
    eyeOriginRel: { dx: -48, dy: -192 },
    mawOriginRel: { dx: -68, dy: -154 },
    clawOriginRel: { dx: -73, dy: -116 },
  },
  {
    id: 'mutdog_stagger_13',
    row: 3,
    col: 1,
    x: 259,
    y: 812,
    w: 253,
    h: 201,
    anchorX: 126,
    bottomY: 198,
    lureOriginRel: { dx: -101, dy: -136 },
    lureBulbsRel: [
      { dx: -117, dy: -120 },
      { dx: -85, dy: -152 },
    ],
    eyeOriginRel: { dx: -66, dy: -126 },
    mawOriginRel: { dx: -80, dy: -95 },
    clawOriginRel: { dx: -59, dy: -14 },
  },
  {
    id: 'mutdog_collapse_14',
    row: 3,
    col: 2,
    x: 514,
    y: 841,
    w: 254,
    h: 179,
    anchorX: 128,
    bottomY: 176,
    lureOriginRel: { dx: -99, dy: -111 },
    lureBulbsRel: [
      { dx: -114, dy: -101 },
      { dx: -85, dy: -121 },
    ],
    eyeOriginRel: { dx: -65, dy: -95 },
    mawOriginRel: { dx: -78, dy: -64 },
    clawOriginRel: { dx: -56, dy: -12 },
  },
  {
    id: 'mutdog_dead_15',
    row: 3,
    col: 3,
    x: 767,
    y: 901,
    w: 252,
    h: 119,
    anchorX: 124,
    bottomY: 116,
    lureOriginRel: { dx: -88, dy: -71 },
    lureBulbsRel: [
      { dx: -109, dy: -76 },
      { dx: -67, dy: -67 },
    ],
    eyeOriginRel: { dx: -74, dy: -44 },
    mawOriginRel: { dx: -92, dy: -22 },
    clawOriginRel: { dx: -67, dy: -10 },
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
  transitionState?: FrameTransitionResult;
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
