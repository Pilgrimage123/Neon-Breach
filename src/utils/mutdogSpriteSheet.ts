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
