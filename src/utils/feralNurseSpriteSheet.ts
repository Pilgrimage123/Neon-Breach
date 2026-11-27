import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';
import {
  type FrameTransitionInput,
  type FrameTransitionResult,
  sampleDeathCollapseFrame,
} from './spriteSheetAnim';

export const FERAL_NURSE_SHEET_WIDTH = 1024;
export const FERAL_NURSE_SHEET_HEIGHT = 1024;
export const FERAL_NURSE_CANONICAL_HEIGHT = 248;

/**
 * Both Sheet A (`feral_nurse_sheet_a.png`) and Sheet B (`feral_nurse_sheet_b.png`) are pre-baked
 * lossless transparent RGBA PNGs cleanly keyed from flat chroma-green (`#00D856`), so their alpha
 * channel is preserved untouched with zero white-spot artifacts and 100% intact white uniform details.
 */
export const FERAL_NURSE_SHEET_OPTIONS: SpriteCutoutOptions = {
  preserveExistingAlpha: true,
};

export interface FeralNurseSpriteFrame extends SpriteRect {
  id: string;
  sheet: 0 | 1;
  row: number;
  col: number;
  /** Horizontal offset inside frame rect (before facing flip) centered on stance/feet */
  anchorX: number;
  /** Vertical offset inside frame rect where stiletto heels/toes touch the deck */
  bottomY: number;
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px (-dx = left/forward) to glowing headset LED / eyes */
  headsetOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) in post-flip unscaled px (-dx = left/forward) to leading bone-talons */
  clawOriginRel: { dx: number; dy: number };
}

/**
 * Dual 4x4 Sprite Sheets (32 Frames total, each `1024x1024` lossless RGBA PNG) for the Feral Nurse (`feral_nurse`):
 *
 * Sheet A (`0..15`):
 * - Row 0 (`0..3`): Fluid crouched idle, inhale lift, forward sway exhale, bared-fang hiss/snarl
 * - Row 1 (`4..7`): Low ambush prowl, front heel contact, mid-stride passing, agile push-off bound
 * - Row 2 (`8..11`): Opposite-foot prowl reach, cushioned heel land, poised alert, crossed-forearm guard
 * - Row 3 (`12..15`): Optical Cloak sequence — tapping magenta cyber-headset (12), compressing low into vanish crouch (13), ultra-low phantom hover (14), sharp snap-up decloak (15)
 *
 * Sheet B (`16..31`):
 * - Row 0 (`16..19`): Prepare Telegraph Coil — coil start (16), deep hunter coil (17), apex fangs-bared tension (18), explosive launch push-off (19)
 * - Row 1 (`20..23`): 7-Pierce Surgical Lunge — high overhead claw windup (20), airborne horizontal pounce (21), mid-air torpedo spear thrust (22), plunging diagonal energy rend slash (23)
 * - Row 2 (`24..27`): Cross-Slash & Recovery — wide X-slash follow-through (24), low heel-slide brake (25), snarling spring-up recovery (26), agile backstep reset (27)
 * - Row 3 (`28..31`): Hit, Stagger & KO — pain whip recoil (28), heavy stagger hunch (29), knee collapse (30), defeated prone sprawl (31)
 *
 * All 32 source frames face RIGHT and are mirrored (`scale(-1, 1)`) on the combat stage to face the hero on the left.
 */
export const FERAL_NURSE_SHEET_A_FRAMES: readonly FeralNurseSpriteFrame[] = [
  // Row 0 (`0..3`): Fluid Idle & Hiss
  {
    id: 'feral_nurse_idle_crouch_0',
    sheet: 0,
    row: 0,
    col: 0,
    x: 27,
    y: 43,
    w: 201,
    h: 211,
    anchorX: 91,
    bottomY: 209,
    headsetOriginRel: { dx: -56, dy: -173 },
    clawOriginRel: { dx: -108, dy: -102 },
  },
  {
    id: 'feral_nurse_idle_inhale_1',
    sheet: 0,
    row: 0,
    col: 1,
    x: 284,
    y: 18,
    w: 199,
    h: 235,
    anchorX: 95,
    bottomY: 233,
    headsetOriginRel: { dx: -43, dy: -197 },
    clawOriginRel: { dx: -102, dy: -102 },
  },
  {
    id: 'feral_nurse_idle_sway_2',
    sheet: 0,
    row: 0,
    col: 2,
    x: 535,
    y: 17,
    w: 210,
    h: 237,
    anchorX: 97,
    bottomY: 235,
    headsetOriginRel: { dx: -48, dy: -198 },
    clawOriginRel: { dx: -111, dy: -142 },
  },
  {
    id: 'feral_nurse_hiss_3',
    sheet: 0,
    row: 0,
    col: 3,
    x: 780,
    y: 23,
    w: 227,
    h: 231,
    anchorX: 105,
    bottomY: 229,
    headsetOriginRel: { dx: -49, dy: -192 },
    clawOriginRel: { dx: -120, dy: -131 },
  },

  // Row 1 (`4..7`): 6-Frame Fluid Prowl Cycle (Part 1)
  {
    id: 'feral_nurse_prowl_ambush_4',
    sheet: 0,
    row: 1,
    col: 0,
    x: 20,
    y: 307,
    w: 209,
    h: 199,
    anchorX: 104,
    bottomY: 197,
    headsetOriginRel: { dx: -69, dy: -159 },
    clawOriginRel: { dx: -93, dy: -147 },
  },
  {
    id: 'feral_nurse_prowl_contact_5',
    sheet: 0,
    row: 1,
    col: 1,
    x: 287,
    y: 262,
    w: 205,
    h: 248,
    anchorX: 94,
    bottomY: 246,
    headsetOriginRel: { dx: -53, dy: -210 },
    clawOriginRel: { dx: -109, dy: -103 },
  },
  {
    id: 'feral_nurse_prowl_passing_6',
    sheet: 0,
    row: 1,
    col: 2,
    x: 539,
    y: 266,
    w: 203,
    h: 244,
    anchorX: 99,
    bottomY: 242,
    headsetOriginRel: { dx: -62, dy: -205 },
    clawOriginRel: { dx: -102, dy: -133 },
  },
  {
    id: 'feral_nurse_prowl_bound_7',
    sheet: 0,
    row: 1,
    col: 3,
    x: 789,
    y: 267,
    w: 208,
    h: 239,
    anchorX: 108,
    bottomY: 237,
    headsetOriginRel: { dx: -67, dy: -198 },
    clawOriginRel: { dx: -98, dy: -139 },
  },

  // Row 2 (`8..11`): Prowl Cycle (Part 2), Alert & Guard
  {
    id: 'feral_nurse_prowl_reach_8',
    sheet: 0,
    row: 2,
    col: 0,
    x: 22,
    y: 520,
    w: 235,
    h: 246,
    anchorX: 106,
    bottomY: 244,
    headsetOriginRel: { dx: -53, dy: -207 },
    clawOriginRel: { dx: -127, dy: -125 },
  },
  {
    id: 'feral_nurse_prowl_land_9',
    sheet: 0,
    row: 2,
    col: 1,
    x: 290,
    y: 535,
    w: 207,
    h: 231,
    anchorX: 96,
    bottomY: 229,
    headsetOriginRel: { dx: -43, dy: -192 },
    clawOriginRel: { dx: -109, dy: -99 },
  },
  {
    id: 'feral_nurse_poised_alert_10',
    sheet: 0,
    row: 2,
    col: 2,
    x: 562,
    y: 513,
    w: 170,
    h: 254,
    anchorX: 79,
    bottomY: 252,
    headsetOriginRel: { dx: -31, dy: -216 },
    clawOriginRel: { dx: -89, dy: -171 },
  },
  {
    id: 'feral_nurse_guard_11',
    sheet: 0,
    row: 2,
    col: 3,
    x: 813,
    y: 520,
    w: 164,
    h: 247,
    anchorX: 81,
    bottomY: 245,
    headsetOriginRel: { dx: -36, dy: -212 },
    clawOriginRel: { dx: -81, dy: -174 },
  },

  // Row 3 (`12..15`): Optical Cloak Vanish & Decloak
  {
    id: 'feral_nurse_cloak_tap_12',
    sheet: 0,
    row: 3,
    col: 0,
    x: 41,
    y: 784,
    w: 168,
    h: 238,
    anchorX: 84,
    bottomY: 236,
    headsetOriginRel: { dx: -29, dy: -200 },
    clawOriginRel: { dx: -74, dy: -152 },
  },
  {
    id: 'feral_nurse_cloak_vanish_13',
    sheet: 0,
    row: 3,
    col: 1,
    x: 300,
    y: 823,
    w: 170,
    h: 197,
    anchorX: 94,
    bottomY: 195,
    headsetOriginRel: { dx: -57, dy: -156 },
    clawOriginRel: { dx: -73, dy: -155 },
  },
  {
    id: 'feral_nurse_cloak_phantom_14',
    sheet: 0,
    row: 3,
    col: 2,
    x: 583,
    y: 827,
    w: 135,
    h: 180,
    anchorX: 65,
    bottomY: 178,
    headsetOriginRel: { dx: -45, dy: -140 },
    clawOriginRel: { dx: -67, dy: -133 },
  },
  {
    id: 'feral_nurse_cloak_decloak_15',
    sheet: 0,
    row: 3,
    col: 3,
    x: 796,
    y: 772,
    w: 207,
    h: 250,
    anchorX: 96,
    bottomY: 248,
    headsetOriginRel: { dx: -34, dy: -209 },
    clawOriginRel: { dx: -109, dy: -154 },
  },
];

export const FERAL_NURSE_SHEET_B_FRAMES: readonly FeralNurseSpriteFrame[] = [
  // Row 0 (`16..19`): Prepare Telegraph Coil
  {
    id: 'feral_nurse_prepare_start_16',
    sheet: 1,
    row: 0,
    col: 0,
    x: 45,
    y: 10,
    w: 168,
    h: 241,
    anchorX: 77,
    bottomY: 239,
    headsetOriginRel: { dx: -36, dy: -201 },
    clawOriginRel: { dx: -89, dy: -128 },
  },
  {
    id: 'feral_nurse_prepare_deep_17',
    sheet: 1,
    row: 0,
    col: 1,
    x: 282,
    y: 35,
    w: 205,
    h: 218,
    anchorX: 110,
    bottomY: 216,
    headsetOriginRel: { dx: -42, dy: -175 },
    clawOriginRel: { dx: -93, dy: -110 },
  },
  {
    id: 'feral_nurse_prepare_apex_18',
    sheet: 1,
    row: 0,
    col: 2,
    x: 546,
    y: 28,
    w: 184,
    h: 225,
    anchorX: 92,
    bottomY: 223,
    headsetOriginRel: { dx: -44, dy: -180 },
    clawOriginRel: { dx: -90, dy: -111 },
  },
  {
    id: 'feral_nurse_prepare_launch_19',
    sheet: 1,
    row: 0,
    col: 3,
    x: 789,
    y: 27,
    w: 203,
    h: 223,
    anchorX: 114,
    bottomY: 221,
    headsetOriginRel: { dx: -56, dy: -178 },
    clawOriginRel: { dx: -87, dy: -128 },
  },

  // Row 1 (`20..23`): 7-Pierce Surgical Lunge
  {
    id: 'feral_nurse_pierce_windup_20',
    sheet: 1,
    row: 1,
    col: 0,
    x: 40,
    y: 256,
    w: 203,
    h: 253,
    anchorX: 97,
    bottomY: 251,
    headsetOriginRel: { dx: -3, dy: -188 },
    clawOriginRel: { dx: -103, dy: -228 },
  },
  {
    id: 'feral_nurse_pierce_pounce_21',
    sheet: 1,
    row: 1,
    col: 1,
    x: 279,
    y: 272,
    w: 202,
    h: 209,
    anchorX: 110,
    bottomY: 207,
    headsetOriginRel: { dx: -73, dy: -162 },
    clawOriginRel: { dx: -90, dy: -163 },
  },
  {
    id: 'feral_nurse_pierce_torpedo_22',
    sheet: 1,
    row: 1,
    col: 2,
    x: 513,
    y: 284,
    w: 275,
    h: 207,
    anchorX: 104,
    bottomY: 205,
    headsetOriginRel: { dx: -87, dy: -164 },
    clawOriginRel: { dx: -169, dy: -144 },
  },
  {
    id: 'feral_nurse_pierce_rend_23',
    sheet: 1,
    row: 1,
    col: 3,
    x: 796,
    y: 280,
    w: 193,
    h: 229,
    anchorX: 112,
    bottomY: 227,
    headsetOriginRel: { dx: -39, dy: -182 },
    clawOriginRel: { dx: -79, dy: -165 },
  },

  // Row 2 (`24..27`): Cross-Slash & Recovery
  {
    id: 'feral_nurse_pierce_xslash_24',
    sheet: 1,
    row: 2,
    col: 0,
    x: 24,
    y: 523,
    w: 207,
    h: 243,
    anchorX: 127,
    bottomY: 241,
    headsetOriginRel: { dx: -13, dy: -195 },
    clawOriginRel: { dx: -78, dy: -78 },
  },
  {
    id: 'feral_nurse_pierce_brake_25',
    sheet: 1,
    row: 2,
    col: 1,
    x: 266,
    y: 552,
    w: 240,
    h: 212,
    anchorX: 130,
    bottomY: 210,
    headsetOriginRel: { dx: -43, dy: -169 },
    clawOriginRel: { dx: -108, dy: -84 },
  },
  {
    id: 'feral_nurse_recover_spring_26',
    sheet: 1,
    row: 2,
    col: 2,
    x: 558,
    y: 519,
    w: 167,
    h: 247,
    anchorX: 83,
    bottomY: 245,
    headsetOriginRel: { dx: -35, dy: -198 },
    clawOriginRel: { dx: -82, dy: -138 },
  },
  {
    id: 'feral_nurse_recover_backstep_27',
    sheet: 1,
    row: 2,
    col: 3,
    x: 812,
    y: 521,
    w: 169,
    h: 244,
    anchorX: 79,
    bottomY: 242,
    headsetOriginRel: { dx: -42, dy: -202 },
    clawOriginRel: { dx: -88, dy: -137 },
  },

  // Row 3 (`28..31`): Hit, Stagger & KO
  {
    id: 'feral_nurse_pain_28',
    sheet: 1,
    row: 3,
    col: 0,
    x: 22,
    y: 782,
    w: 212,
    h: 239,
    anchorX: 120,
    bottomY: 237,
    headsetOriginRel: { dx: 37, dy: -208 },
    clawOriginRel: { dx: -89, dy: -217 },
  },
  {
    id: 'feral_nurse_stagger_29',
    sheet: 1,
    row: 3,
    col: 1,
    x: 315,
    y: 777,
    w: 144,
    h: 244,
    anchorX: 66,
    bottomY: 242,
    headsetOriginRel: { dx: -64, dy: -190 },
    clawOriginRel: { dx: -76, dy: -188 },
  },
  {
    id: 'feral_nurse_kneel_30',
    sheet: 1,
    row: 3,
    col: 2,
    x: 531,
    y: 836,
    w: 198,
    h: 185,
    anchorX: 99,
    bottomY: 183,
    headsetOriginRel: { dx: -74, dy: -117 },
    clawOriginRel: { dx: -89, dy: -142 },
  },
  {
    id: 'feral_nurse_dead_31',
    sheet: 1,
    row: 3,
    col: 3,
    x: 767,
    y: 924,
    w: 254,
    h: 94,
    anchorX: 139,
    bottomY: 92,
    headsetOriginRel: { dx: -67, dy: -39 },
    clawOriginRel: { dx: -108, dy: -19 },
  },
];

export const FERAL_NURSE_SHEET_FRAMES: readonly FeralNurseSpriteFrame[] = [
  ...FERAL_NURSE_SHEET_A_FRAMES,
  ...FERAL_NURSE_SHEET_B_FRAMES,
];

export type FeralNurseAnimMode =
  | 'idle'
  | 'cloakCast'
  | 'opticalCloak'
  | 'prepareCoil'
  | 'pierceStrike'
  | 'feralGuard'
  | 'pain'
  | 'staggered'
  | 'staggerHover'
  | 'guardHover'
  | 'death';

export interface FeralNurseAnimSample {
  frameIndex: number;
  frame: FeralNurseSpriteFrame;
  prevFrameIndex: number;
  prevFrame: FeralNurseSpriteFrame;
  blendAlpha: number;
  mode: FeralNurseAnimMode;
  xShiftPx: number;
  yHopPx: number;
  scaleX: number;
  scaleY: number;
  tiltRad: number;
  alpha: number;
  /** 0..1 intensity of glowing magenta headset LED & feral eye flare (stays luminous while cloaked!) */
  headsetGlowIntensity: number;
  /** 0..1 optical-camo invisibility shimmer intensity (drives translucent holo-scanline shader & overlay) */
  cloakIntensity: number;
  /** 0..1 progress of triple crimson-magenta bone-talon pierce slash crescents */
  clawSlashProgress: number;
  /** 0..1 intensity of surgical 7-pierce impact shock ring */
  pierceImpactIntensity: number;
}

export type FeralNurseTransitionInput = FrameTransitionInput;
export type FeralNurseTransitionResult = FrameTransitionResult;

interface LoopedFrameKeyframe {
  frame: number;
  duration: number;
}

function sampleLoopedFrames(
  keyframes: readonly LoopedFrameKeyframe[],
  timeSec: number,
  blendDuration = 0,
): { frame: number; prevFrame: number; blendAlpha: number } {
  const total = keyframes.reduce((acc, k) => acc + Math.max(0.01, k.duration), 0);
  if (total <= 0 || keyframes.length === 0) {
    return { frame: 0, prevFrame: 0, blendAlpha: 1 };
  }
  const wrapped = ((timeSec % total) + total) % total;
  let accum = 0;
  for (let i = 0; i < keyframes.length; i++) {
    const dur = Math.max(0.01, keyframes[i].duration);
    if (wrapped < accum + dur || i === keyframes.length - 1) {
      const localElapsed = Math.max(0, wrapped - accum);
      const prevIdx = (i - 1 + keyframes.length) % keyframes.length;
      const frame = keyframes[i].frame;
      const prevFrame = keyframes[prevIdx].frame;
      const rawT =
        blendDuration <= 0
          ? 1
          : Math.min(1, localElapsed / Math.max(0.001, blendDuration));
      const blendAlpha = prevFrame === frame ? 1 : rawT * rawT * (3 - 2 * rawT);
      return { frame, prevFrame, blendAlpha };
    }
    accum += dur;
  }
  const last = keyframes[keyframes.length - 1].frame;
  return { frame: last, prevFrame: last, blendAlpha: 1 };
}

const IDLE_KEYFRAMES: readonly LoopedFrameKeyframe[] = [
  { frame: 1, duration: 0.56 },
  { frame: 2, duration: 0.56 },
  { frame: 1, duration: 0.56 },
  { frame: 2, duration: 0.44 },
  { frame: 3, duration: 0.42 },
  { frame: 2, duration: 0.42 },
];

const CLOAK_IDLE_KEYFRAMES: readonly LoopedFrameKeyframe[] = [
  { frame: 13, duration: 0.22 },
  { frame: 14, duration: 0.28 },
  { frame: 4, duration: 0.20 },
  { frame: 14, duration: 0.26 },
];

const PREPARE_COIL_KEYFRAMES: readonly LoopedFrameKeyframe[] = [
  { frame: 16, duration: 0.15 },
  { frame: 17, duration: 0.17 },
  { frame: 18, duration: 0.18 },
  { frame: 19, duration: 0.15 },
  { frame: 18, duration: 0.16 },
  { frame: 17, duration: 0.15 },
];

const GUARD_KEYFRAMES: readonly LoopedFrameKeyframe[] = [
  { frame: 11, duration: 0.26 },
  { frame: 10, duration: 0.22 },
  { frame: 11, duration: 0.24 },
];

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function sampleFeralNurseFrame(
  state:
    | {
        dead: boolean;
        koProgress: number;
        staggerTimer: number;
        staggerDuration: number;
        attackAnimTimer: number;
        attackAnimDuration: number;
        cloakCastTimer?: number;
        cloakCastDuration?: number;
        cloaked?: boolean;
        preparePrimed?: boolean;
        piercePrimed?: boolean;
        feralGuard?: boolean;
        staggerHover?: boolean;
        guardHover?: boolean;
        staggered?: boolean;
      }
    | undefined,
  nowSec: number,
  phaseOffset: number,
): FeralNurseAnimSample {
  const build = (
    frameIndex: number,
    mode: FeralNurseAnimMode,
    xShiftPx = 0,
    yHopPx = 0,
    scaleX = 1,
    scaleY = 1,
    tiltRad = 0,
    alpha = 1,
    headsetGlowIntensity = 0.56,
    cloakIntensity = 0,
    clawSlashProgress = 0,
    pierceImpactIntensity = 0,
    prevFrameIndex = frameIndex,
    blendAlpha = 1,
  ): FeralNurseAnimSample => ({
    frameIndex,
    frame: FERAL_NURSE_SHEET_FRAMES[frameIndex] ?? FERAL_NURSE_SHEET_FRAMES[0],
    prevFrameIndex,
    prevFrame: FERAL_NURSE_SHEET_FRAMES[prevFrameIndex] ?? FERAL_NURSE_SHEET_FRAMES[0],
    blendAlpha,
    mode,
    xShiftPx,
    yHopPx,
    scaleX,
    scaleY,
    tiltRad,
    alpha,
    headsetGlowIntensity: clamp01(headsetGlowIntensity),
    cloakIntensity: clamp01(cloakIntensity),
    clawSlashProgress: clamp01(clawSlashProgress),
    pierceImpactIntensity: clamp01(pierceImpactIntensity),
  });

  if (state?.dead) {
    const collapse = sampleDeathCollapseFrame(state.koProgress, 28, 4, 0.72);
    return build(
      collapse.frameIndex,
      'death',
      collapse.progress * 14,
      collapse.progress * 3,
      1,
      1,
      0,
      collapse.alpha,
      Math.max(0.06, (1 - state.koProgress) * 0.45),
      0,
    );
  }

  // Active 7-Pierce Surgical Lunge (8-beat sequence: 20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27)
  if (state && state.attackAnimTimer > 0) {
    const dur = Math.max(0.28, state.attackAnimDuration || 0.84);
    const p = clamp01(1 - state.attackAnimTimer / dur);

    if (p < 0.14) {
      const t = p / 0.14;
      return build(
        19,
        'pierceStrike',
        10 * t,
        -2 * t,
        0.95,
        1.06,
        0.08 * t,
        1,
        0.94,
        0,
        0,
        0,
        19,
        1,
      );
    }
    if (p < 0.26) {
      const t = (p - 0.14) / 0.12;
      return build(
        20,
        'pierceStrike',
        10 - 6 * t,
        -8 * t,
        0.93,
        1.08,
        0.05 * (1 - t),
        1,
        0.98,
        0,
        0,
        0,
        20,
        1,
      );
    }
    if (p < 0.40) {
      const t = (p - 0.26) / 0.14;
      return build(
        21,
        'pierceStrike',
        4 - 22 * t,
        -Math.sin(t * Math.PI) * 30 - 6,
        1.09,
        0.92,
        -0.08 * t,
        1,
        1.0,
        0,
        t * 0.18,
        0,
        21,
        1,
      );
    }
    if (p < 0.54) {
      const t = (p - 0.40) / 0.14;
      return build(
        22,
        'pierceStrike',
        -18 - 18 * t,
        -18 * (1 - t * 0.55),
        1.14,
        0.88,
        -0.11,
        1,
        1.0,
        0,
        0.18 + t * 0.34,
        t * 0.65,
        22,
        1,
      );
    }
    if (p < 0.68) {
      const t = (p - 0.54) / 0.14;
      return build(
        23,
        'pierceStrike',
        -36 + 8 * t,
        -6 * (1 - t),
        1.10 - 0.04 * t,
        0.90 + 0.04 * t,
        -0.08 * (1 - t * 0.4),
        1,
        1.0,
        0,
        0.52 + t * 0.36,
        0.65 + Math.sin(t * Math.PI) * 0.35,
        23,
        1,
      );
    }
    if (p < 0.80) {
      const t = (p - 0.68) / 0.12;
      return build(
        24,
        'pierceStrike',
        -28 + 10 * t,
        0,
        1.06 - 0.04 * t,
        0.94 + 0.04 * t,
        -0.04 * (1 - t),
        1,
        0.92,
        0,
        0.88 + t * 0.12,
        0.55 * (1 - t),
        24,
        1,
      );
    }
    if (p < 0.90) {
      const t = (p - 0.80) / 0.10;
      return build(
        25,
        'pierceStrike',
        -18 + 10 * t,
        0,
        1.04 - 0.03 * t,
        0.96 + 0.03 * t,
        -0.02 * (1 - t),
        1,
        0.78,
        0,
        0,
        0,
        25,
        1,
      );
    }
    const t = (p - 0.90) / 0.10;
    const recIdx = t < 0.5 ? 26 : 27;
    return build(
      recIdx,
      'pierceStrike',
      -8 * (1 - t),
      0,
      1,
      1,
      0,
      1,
      0.66,
      0,
      0,
      0,
      recIdx,
      1,
    );
  }

  // Optical Cloak Cast (Move 1: tap headset 12 -> compress vanish 13 -> phantom crouch 14)
  if (state && (state.cloakCastTimer ?? 0) > 0) {
    const dur = Math.max(0.28, state.cloakCastDuration ?? 0.68);
    const p = clamp01(1 - (state.cloakCastTimer ?? 0) / dur);
    const shimmer = clamp01(p * 1.15);
    const alpha = 1 - shimmer * 0.72; // smoothly vanishes to ~0.28 translucent shimmer
    const frame = p < 0.34 ? 12 : p < 0.70 ? 13 : 14;
    const prev = p < 0.34 ? 10 : p < 0.70 ? 12 : 13;
    const localT = p < 0.34 ? p / 0.34 : p < 0.70 ? (p - 0.34) / 0.36 : (p - 0.70) / 0.30;
    return build(
      frame,
      'cloakCast',
      -4 * Math.sin(p * Math.PI),
      0,
      1 + 0.04 * Math.sin(p * Math.PI),
      1 - 0.04 * Math.sin(p * Math.PI),
      -0.03 * p,
      alpha,
      0.92 + 0.08 * Math.sin(p * Math.PI),
      shimmer,
      0,
      0,
      prev,
      clamp01(localT * 2.2),
    );
  }

  // Pain / Hit Recoil (28 -> 29) — stays translucent if currently cloaked!
  if (state && state.staggerTimer > 0) {
    const dur = Math.max(0.18, state.staggerDuration || 0.44);
    const p = clamp01(1 - state.staggerTimer / dur);
    const whip = Math.sin(p * Math.PI);
    const cloakedNow = Boolean(state.cloaked);
    return build(
      p < 0.58 ? 28 : 29,
      'pain',
      whip * (cloakedNow ? 7 : 14),
      -whip * (cloakedNow ? 2.5 : 5),
      1 - whip * 0.06,
      1 + whip * 0.05,
      whip * 0.11,
      cloakedNow ? 0.36 + whip * 0.16 : 1,
      cloakedNow ? 0.96 : 0.35 + 0.45 * (1 - p),
      cloakedNow ? 0.85 : 0,
      0,
      0,
      p < 0.58 ? 0 : 28,
      1,
    );
  }

  if (state?.staggered) {
    const sway = Math.sin(nowSec * 4.4 + phaseOffset);
    return build(
      29,
      'staggered',
      sway * 3.2,
      Math.abs(sway) * 1.5,
      1,
      0.97 + Math.sin(nowSec * 3.0 + phaseOffset) * 0.02,
      sway * 0.045,
      1,
      0.24 + 0.12 * Math.sin(nowSec * 5.0 + phaseOffset),
      0,
    );
  }

  if (state?.staggerHover) {
    const sway = Math.sin(nowSec * 5.6 + phaseOffset);
    return build(
      29,
      'staggerHover',
      sway * 4.2,
      0,
      1,
      0.98,
      sway * 0.05,
      1,
      0.34,
      0,
    );
  }

  // Active 1-Turn Optical Cloak state (translucent ~26% optical-camo shimmer + bright glowing eyes)
  if (state?.cloaked) {
    const seq = sampleLoopedFrames(CLOAK_IDLE_KEYFRAMES, nowSec + phaseOffset * 0.35, 0.06);
    const shimmerWave = Math.sin(nowSec * 6.2 + phaseOffset);
    return build(
      seq.frame,
      'opticalCloak',
      shimmerWave * 1.6,
      0,
      1 + shimmerWave * 0.014,
      1 - shimmerWave * 0.014,
      -0.025 + shimmerWave * 0.012,
      0.26 + 0.05 * Math.sin(nowSec * 8.5 + phaseOffset),
      0.94 + 0.06 * Math.abs(shimmerWave),
      0.92 + 0.08 * Math.abs(shimmerWave),
      0,
      0,
      seq.prevFrame,
      seq.blendAlpha,
    );
  }

  if (state?.guardHover || state?.feralGuard) {
    const mode: FeralNurseAnimMode = state.guardHover ? 'guardHover' : 'feralGuard';
    const seq = sampleLoopedFrames(GUARD_KEYFRAMES, nowSec + phaseOffset * 0.3, 0);
    const breathe = Math.sin(nowSec * 4.2 + phaseOffset);
    return build(
      seq.frame,
      mode,
      0,
      0,
      1 + breathe * 0.015,
      1 - breathe * 0.015,
      -0.02,
      1,
      0.66 + 0.14 * Math.sin(nowSec * 5.2 + phaseOffset),
      0,
      0,
      0,
      seq.frame,
      1,
    );
  }

  // Prepare Coil / 7-Pierce Primed tension loop (frames 16 -> 17 -> 18 -> 19)
  if (state?.preparePrimed || state?.piercePrimed) {
    const seq = sampleLoopedFrames(PREPARE_COIL_KEYFRAMES, nowSec + phaseOffset * 0.35, 0);
    const pulse = Math.sin(nowSec * 7.4 + phaseOffset);
    return build(
      seq.frame,
      'prepareCoil',
      -2.5 + pulse * 2.2,
      0,
      1 + pulse * 0.026,
      1 - pulse * 0.020,
      -0.032 + pulse * 0.02,
      1,
      0.88 + 0.12 * Math.abs(pulse),
      0,
      0,
      0,
      seq.frame,
      1,
    );
  }

  // Default Smooth Grounded Breathing + Periodic Feral Hiss Idle (1 <-> 2, occasional 3 hiss)
  const seq = sampleLoopedFrames(IDLE_KEYFRAMES, nowSec + phaseOffset * 0.45, 0);
  const breathe = Math.sin(nowSec * 2.6 + phaseOffset);
  return build(
    seq.frame,
    'idle',
    0,
    0,
    1 + breathe * 0.012,
    1 - breathe * 0.012,
    breathe * 0.009,
    1,
    (seq.frame === 3 ? 0.82 : 0.56) + 0.12 * Math.sin(nowSec * 3.4 + phaseOffset),
    0,
    0,
    0,
    seq.frame,
    1,
  );
}
