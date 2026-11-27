import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';
import type { FrameTransitionResult } from './spriteSheetAnim';

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
 * - Row 0 (`0..3`): Wide stomp stride (0) + planted breathing/snarl idle trio (1 inhale, 2 roar/snarl, 3 exhale — identical planted leg stance)
 * - Row 1 (`4..7`): Mutagen Vial Brace (grab pocket vials -> crush green vials -> fiery orange shell flare -> veined crossed-arm guard)
 * - Row 2 (`8..11`): Seismic Carapace Crush & Claw/Maw Crunch (coiled 2-arm windup -> airborne smash peak -> 2-fist ground smash -> lunging jaw & claw strike)
 * - Row 3 (`12..15`): Hit Pain Recoil, Knee Stagger, Buckling Collapse & Flat Defeated Collapse
 *
 * Source figures face right and are mirrored (`scale(-1, 1)`) on stage to face the hero on the left.
 */
export const BRUTE_SHEET_FRAMES: readonly BruteSpriteFrame[] = [
  // Row 0: Stomp Stride (F0) & Planted-Leg Breathing/Snarl Idle Loop (F1..F3)
  {
    id: 'brute_idle_0',
    row: 0,
    col: 0,
    x: 5,
    y: 28,
    w: 253,
    h: 225,
    anchorX: 120,
    bottomY: 222,
    vialOriginRel: { dx: -4, dy: -113 },
    shellOriginRel: { dx: 40, dy: -159 },
    impactOriginRel: { dx: -72, dy: -124 },
  },
  {
    id: 'brute_idle_1',
    row: 0,
    col: 1,
    x: 272,
    y: 21,
    w: 241,
    h: 234,
    anchorX: 110,
    bottomY: 232,
    vialOriginRel: { dx: 3, dy: -120 },
    shellOriginRel: { dx: 42, dy: -165 },
    impactOriginRel: { dx: -69, dy: -128 },
  },
  {
    id: 'brute_idle_2',
    row: 0,
    col: 2,
    x: 523,
    y: 20,
    w: 239,
    h: 235,
    anchorX: 115,
    bottomY: 232,
    vialOriginRel: { dx: 7, dy: -122 },
    shellOriginRel: { dx: 43, dy: -167 },
    impactOriginRel: { dx: -70, dy: -130 },
  },
  {
    id: 'brute_idle_3',
    row: 0,
    col: 3,
    x: 781,
    y: 22,
    w: 236,
    h: 232,
    anchorX: 107,
    bottomY: 230,
    vialOriginRel: { dx: 11, dy: -122 },
    shellOriginRel: { dx: 41, dy: -164 },
    impactOriginRel: { dx: -68, dy: -126 },
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
    anchorX: 104,
    bottomY: 226,
    vialOriginRel: { dx: -29, dy: -113 },
    shellOriginRel: { dx: 39, dy: -163 },
    impactOriginRel: { dx: -51, dy: -126 },
  },
  {
    id: 'brute_vial_crush_5',
    row: 1,
    col: 1,
    x: 278,
    y: 283,
    w: 204,
    h: 228,
    anchorX: 104,
    bottomY: 226,
    vialOriginRel: { dx: -29, dy: -98 },
    shellOriginRel: { dx: 37, dy: -165 },
    impactOriginRel: { dx: -53, dy: -126 },
  },
  {
    id: 'brute_shell_flare_6',
    row: 1,
    col: 2,
    x: 522,
    y: 269,
    w: 229,
    h: 243,
    anchorX: 114,
    bottomY: 240,
    vialOriginRel: { dx: -21, dy: -127 },
    shellOriginRel: { dx: 46, dy: -170 },
    impactOriginRel: { dx: -61, dy: -128 },
  },
  {
    id: 'brute_guard_veins_7',
    row: 1,
    col: 3,
    x: 781,
    y: 269,
    w: 220,
    h: 244,
    anchorX: 113,
    bottomY: 242,
    vialOriginRel: { dx: -4, dy: -120 },
    shellOriginRel: { dx: 43, dy: -187 },
    impactOriginRel: { dx: -44, dy: -134 },
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
    anchorX: 89,
    bottomY: 245,
    vialOriginRel: { dx: 13, dy: -103 },
    shellOriginRel: { dx: 31, dy: -182 },
    impactOriginRel: { dx: -47, dy: -214 },
  },
  {
    id: 'brute_smash_air_9',
    row: 2,
    col: 1,
    x: 298,
    y: 514,
    w: 180,
    h: 253,
    anchorX: 82,
    bottomY: 250,
    vialOriginRel: { dx: 12, dy: -110 },
    shellOriginRel: { dx: 31, dy: -186 },
    impactOriginRel: { dx: -51, dy: -218 },
  },
  {
    id: 'brute_smash_impact_10',
    row: 2,
    col: 2,
    x: 522,
    y: 563,
    w: 234,
    h: 208,
    anchorX: 114,
    bottomY: 201,
    // Strip baked-in side & floor splinter wedges so planted knuckles and feet sit flush on enemyGroundY
    excludeRects: [
      { x: 204, y: 86, w: 30, h: 121 },
      { x: 96, y: 177, w: 38, h: 30 },
      { x: 120, y: 201, w: 86, h: 6 },
    ],
    vialOriginRel: { dx: -23, dy: -108 },
    shellOriginRel: { dx: 31, dy: -146 },
    impactOriginRel: { dx: -60, dy: -10 },
  },
  {
    id: 'brute_maw_claw_11',
    row: 2,
    col: 3,
    x: 771,
    y: 557,
    w: 247,
    h: 209,
    anchorX: 123,
    bottomY: 207,
    vialOriginRel: { dx: -34, dy: -106 },
    shellOriginRel: { dx: 34, dy: -148 },
    impactOriginRel: { dx: -93, dy: -98 },
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
    anchorX: 112,
    bottomY: 224,
    vialOriginRel: { dx: -6, dy: -130 },
    shellOriginRel: { dx: 39, dy: -161 },
    impactOriginRel: { dx: -52, dy: -120 },
  },
  {
    id: 'brute_knee_stagger_13',
    row: 3,
    col: 1,
    x: 278,
    y: 811,
    w: 216,
    h: 209,
    anchorX: 113,
    bottomY: 207,
    vialOriginRel: { dx: -1, dy: -130 },
    shellOriginRel: { dx: 32, dy: -152 },
    impactOriginRel: { dx: -56, dy: -74 },
  },
  {
    id: 'brute_collapse_14',
    row: 3,
    col: 2,
    x: 520,
    y: 826,
    w: 240,
    h: 195,
    anchorX: 131,
    bottomY: 193,
    vialOriginRel: { dx: -4, dy: -118 },
    shellOriginRel: { dx: 33, dy: -138 },
    impactOriginRel: { dx: -59, dy: -56 },
  },
  {
    id: 'brute_dead_15',
    row: 3,
    col: 3,
    x: 770,
    y: 857,
    w: 252,
    h: 164,
    anchorX: 136,
    bottomY: 162,
    vialOriginRel: { dx: 1, dy: -86 },
    shellOriginRel: { dx: 30, dy: -114 },
    impactOriginRel: { dx: -67, dy: -36 },
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
  transitionState?: FrameTransitionResult;
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
