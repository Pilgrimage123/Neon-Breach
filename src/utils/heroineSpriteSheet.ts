import type { TileType } from '../engine/types';

export const HEROINE_SHEET_WIDTH = 1774;
export const HEROINE_SHEET_HEIGHT = 887;
export const HEROINE_EMOTE_SHEET_WIDTH = 1774;
export const HEROINE_EMOTE_SHEET_HEIGHT = 887;
export const HEROINE_CANONICAL_HEIGHT = 214;

export type HeroineSheetSource = 'combat' | 'emote';

export interface HeroineFrameDef {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal pixel offset inside this frame representing the heroine's planted foot / torso pivot */
  anchorX: number;
  /** Vertical pixel offset inside this frame representing ground contact (bottom of soles/knees/body) */
  bottomY: number;
  /** Per-frame scale normalization multiplier so standing character height is strictly 214.0px across all rows */
  rowScale: number;
  /** Which sprite sheet image this frame belongs to */
  sheet?: HeroineSheetSource;
  /** Optional muzzle point relative to (anchorX, bottomY) in unscaled sprite pixels */
  muzzleRel?: { dx: number; dy: number };
  /** Optional kick arc tip relative to (anchorX, bottomY) in unscaled sprite pixels */
  kickTipRel?: { dx: number; dy: number };
}

export const HEROINE_COMBAT_FRAMES: readonly HeroineFrameDef[] = [
  // Row 0: Idle & Sprint Run (7 frames, normalized to exact 214.0px standing height)
  { id: 'r0_f0', row: 0, col: 0, x: 66, y: 0, w: 136, h: 224, anchorX: 79.0, bottomY: 219, rowScale: 1.019, sheet: 'combat' },
  { id: 'r0_f1', row: 0, col: 1, x: 309, y: 0, w: 140, h: 222, anchorX: 70.5, bottomY: 217, rowScale: 1.034, sheet: 'combat' },
  { id: 'r0_f2', row: 0, col: 2, x: 506, y: 0, w: 176, h: 218, anchorX: 98.5, bottomY: 213, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f3', row: 0, col: 3, x: 751, y: 0, w: 158, h: 215, anchorX: 82.5, bottomY: 210, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f4', row: 0, col: 4, x: 958, y: 5, w: 178, h: 214, anchorX: 84.7, bottomY: 208, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f5', row: 0, col: 5, x: 1207, y: 5, w: 161, h: 212, anchorX: 74.4, bottomY: 207, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f6', row: 0, col: 6, x: 1403, y: 5, w: 193, h: 212, anchorX: 100.9, bottomY: 207, rowScale: 1.035, sheet: 'combat' },

  // Row 1: Pistol Aim & Muzzle Flash Burst (7 frames, normalized to exact 214.0px standing height)
  { id: 'r1_f0', row: 1, col: 0, x: 34, y: 226, w: 176, h: 220, anchorX: 87.0, bottomY: 215, rowScale: 1.059, sheet: 'combat', muzzleRel: { dx: 82, dy: -158 } },
  { id: 'r1_f1', row: 1, col: 1, x: 253, y: 226, w: 184, h: 220, anchorX: 97.5, bottomY: 215, rowScale: 1.054, sheet: 'combat', muzzleRel: { dx: 82, dy: -165 } },
  { id: 'r1_f2', row: 1, col: 2, x: 470, y: 226, w: 192, h: 220, anchorX: 106.0, bottomY: 215, rowScale: 1.065, sheet: 'combat', muzzleRel: { dx: 80, dy: -168 } },
  { id: 'r1_f3', row: 1, col: 3, x: 686, y: 226, w: 225, h: 220, anchorX: 114.0, bottomY: 215, rowScale: 1.070, sheet: 'combat', muzzleRel: { dx: 96, dy: -170 } },
  { id: 'r1_f4', row: 1, col: 4, x: 915, y: 227, w: 220, h: 219, anchorX: 110.5, bottomY: 214, rowScale: 1.086, sheet: 'combat', muzzleRel: { dx: 96, dy: -170 } },
  { id: 'r1_f5', row: 1, col: 5, x: 1152, y: 226, w: 190, h: 220, anchorX: 102.0, bottomY: 215, rowScale: 1.070, sheet: 'combat', muzzleRel: { dx: 84, dy: -164 } },
  { id: 'r1_f6', row: 1, col: 6, x: 1393, y: 228, w: 180, h: 218, anchorX: 93.0, bottomY: 213, rowScale: 1.075, sheet: 'combat', muzzleRel: { dx: 80, dy: -156 } },

  // Row 2: High Plasma Kick Combo (8 frames, normalized to exact 214.0px standing height)
  { id: 'r2_f0', row: 2, col: 0, x: 46, y: 449, w: 149, h: 172, anchorX: 80.5, bottomY: 167, rowScale: 1.363, sheet: 'combat' },
  { id: 'r2_f1', row: 2, col: 1, x: 246, y: 449, w: 138, h: 172, anchorX: 77.0, bottomY: 167, rowScale: 1.390, sheet: 'combat' },
  { id: 'r2_f2', row: 2, col: 2, x: 437, y: 448, w: 142, h: 174, anchorX: 76.0, bottomY: 169, rowScale: 1.346, sheet: 'combat' },
  { id: 'r2_f3', row: 2, col: 3, x: 628, y: 448, w: 157, h: 175, anchorX: 89.5, bottomY: 171, rowScale: 1.363, sheet: 'combat' },
  { id: 'r2_f4', row: 2, col: 4, x: 817, y: 452, w: 197, h: 171, anchorX: 82.0, bottomY: 166, rowScale: 1.346, sheet: 'combat', kickTipRel: { dx: 105, dy: -124 } },
  { id: 'r2_f5', row: 2, col: 5, x: 1042, y: 450, w: 118, h: 172, anchorX: 52.0, bottomY: 167, rowScale: 1.417, sheet: 'combat' },
  { id: 'r2_f6', row: 2, col: 6, x: 1214, y: 453, w: 122, h: 169, anchorX: 75.0, bottomY: 164, rowScale: 1.436, sheet: 'combat' },
  { id: 'r2_f7', row: 2, col: 7, x: 1394, y: 450, w: 140, h: 172, anchorX: 75.5, bottomY: 167, rowScale: 1.346, sheet: 'combat' },

  // Row 3: Guard, Hit Spark, Knockback Stagger & Kneel (6 frames, normalized to exact 214.0px standing height)
  { id: 'r3_f0', row: 3, col: 0, x: 35, y: 623, w: 143, h: 158, anchorX: 81.5, bottomY: 154, rowScale: 1.436, sheet: 'combat' },
  { id: 'r3_f1', row: 3, col: 1, x: 216, y: 624, w: 154, h: 157, anchorX: 93.5, bottomY: 152, rowScale: 1.466, sheet: 'combat' },
  { id: 'r3_f2', row: 3, col: 2, x: 395, y: 630, w: 147, h: 151, anchorX: 97.5, bottomY: 146, rowScale: 1.466, sheet: 'combat' },
  { id: 'r3_f3', row: 3, col: 3, x: 568, y: 626, w: 176, h: 155, anchorX: 111.5, bottomY: 150, rowScale: 1.466, sheet: 'combat' },
  { id: 'r3_f4', row: 3, col: 4, x: 769, y: 649, w: 152, h: 127, anchorX: 97.5, bottomY: 122, rowScale: 1.436, sheet: 'combat' },
  { id: 'r3_f5', row: 3, col: 5, x: 963, y: 660, w: 136, h: 117, anchorX: 67.5, bottomY: 112, rowScale: 1.436, sheet: 'combat' },

  // Row 4: Collapse to Prone Defeat (8 frames, normalized scale 1.436)
  { id: 'r4_f0', row: 4, col: 0, x: 40, y: 782, w: 136, h: 104, anchorX: 74.2, bottomY: 99, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f1', row: 4, col: 1, x: 212, y: 788, w: 148, h: 97, anchorX: 82.5, bottomY: 92, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f2', row: 4, col: 2, x: 391, y: 790, w: 136, h: 92, anchorX: 71.2, bottomY: 88, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f3', row: 4, col: 3, x: 556, y: 794, w: 174, h: 85, anchorX: 84.7, bottomY: 81, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f4', row: 4, col: 4, x: 757, y: 801, w: 168, h: 78, anchorX: 81.3, bottomY: 73, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f5', row: 4, col: 5, x: 944, y: 806, w: 192, h: 73, anchorX: 96.8, bottomY: 68, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f6', row: 4, col: 6, x: 1161, y: 810, w: 191, h: 66, anchorX: 99.9, bottomY: 61, rowScale: 1.436, sheet: 'combat' },
  { id: 'r4_f7', row: 4, col: 7, x: 1372, y: 819, w: 218, h: 56, anchorX: 107.3, bottomY: 51, rowScale: 1.436, sheet: 'combat' },
];

export const HEROINE_EMOTE_FRAMES: readonly HeroineFrameDef[] = [
  // Row 5 (Emote Sheet Row 0): IDLE1 — Hair Twirl & Wink (indices 36..44, exact 214.0px standing height)
  { id: 'r5_f0', row: 5, col: 0, x: 66, y: 6, w: 126, h: 213, anchorX: 76.5, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f1', row: 5, col: 1, x: 262, y: 7, w: 124, h: 212, anchorX: 74.5, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f2', row: 5, col: 2, x: 446, y: 7, w: 128, h: 212, anchorX: 75.0, bottomY: 210, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f3', row: 5, col: 3, x: 612, y: 7, w: 147, h: 212, anchorX: 96.0, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f4', row: 5, col: 4, x: 803, y: 6, w: 142, h: 213, anchorX: 86.5, bottomY: 211, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f5', row: 5, col: 5, x: 986, y: 7, w: 143, h: 212, anchorX: 89.0, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f6', row: 5, col: 6, x: 1179, y: 4, w: 135, h: 215, anchorX: 81.0, bottomY: 213, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f7', row: 5, col: 7, x: 1371, y: 6, w: 147, h: 213, anchorX: 83.0, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f8', row: 5, col: 8, x: 1570, y: 6, w: 139, h: 213, anchorX: 87.0, bottomY: 211, rowScale: 1.044, sheet: 'emote' },

  // Row 6 (Emote Sheet Row 1): IDLE2 — Smartphone Selfie & Peace Pose (indices 45..53, exact 214.0px standing height)
  { id: 'r6_f0', row: 6, col: 0, x: 61, y: 240, w: 129, h: 216, anchorX: 82.5, bottomY: 214, rowScale: 1.029, sheet: 'emote' },
  { id: 'r6_f1', row: 6, col: 1, x: 240, y: 238, w: 141, h: 218, anchorX: 93.5, bottomY: 216, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f2', row: 6, col: 2, x: 420, y: 241, w: 148, h: 215, anchorX: 89.5, bottomY: 213, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f3', row: 6, col: 3, x: 595, y: 242, w: 140, h: 214, anchorX: 93.0, bottomY: 211, rowScale: 1.044, sheet: 'emote' },
  { id: 'r6_f4', row: 6, col: 4, x: 774, y: 240, w: 167, h: 216, anchorX: 101.5, bottomY: 214, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f5', row: 6, col: 5, x: 960, y: 240, w: 175, h: 216, anchorX: 97.5, bottomY: 214, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f6', row: 6, col: 6, x: 1152, y: 243, w: 171, h: 213, anchorX: 101.5, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f7', row: 6, col: 7, x: 1354, y: 242, w: 150, h: 214, anchorX: 94.0, bottomY: 212, rowScale: 1.034, sheet: 'emote' },
  { id: 'r6_f8', row: 6, col: 8, x: 1540, y: 242, w: 139, h: 214, anchorX: 90.5, bottomY: 212, rowScale: 1.039, sheet: 'emote' },

  // Row 7 (Emote Sheet Row 2): VICTORY — Crouch, Peace-Sign Jump with Golden Burst, Land & Pose (indices 54..62, exact 214.0px standing scale)
  { id: 'r7_f0', row: 7, col: 0, x: 58, y: 515, w: 111, h: 137, anchorX: 65.5, bottomY: 135, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f1', row: 7, col: 1, x: 242, y: 495, w: 128, h: 156, anchorX: 75.4, bottomY: 154, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f2', row: 7, col: 2, x: 414, y: 483, w: 144, h: 168, anchorX: 67.0, bottomY: 164, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f3', row: 7, col: 3, x: 581, y: 475, w: 150, h: 164, anchorX: 86.8, bottomY: 162, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f4', row: 7, col: 4, x: 754, y: 463, w: 147, h: 140, anchorX: 96.3, bottomY: 138, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f5', row: 7, col: 5, x: 914, y: 461, w: 200, h: 154, anchorX: 101.5, bottomY: 152, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f6', row: 7, col: 6, x: 1133, y: 475, w: 147, h: 177, anchorX: 89.0, bottomY: 174, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f7', row: 7, col: 7, x: 1335, y: 496, w: 138, h: 156, anchorX: 88.5, bottomY: 154, rowScale: 1.436, sheet: 'emote' },
  { id: 'r7_f8', row: 7, col: 8, x: 1536, y: 472, w: 172, h: 180, anchorX: 100.5, bottomY: 178, rowScale: 1.436, sheet: 'emote' },

  // Row 8 (Emote Sheet Row 3): USING TECH — Cyan/Magenta Holographic Rings & AR Screens (indices 63..71, exact 214.0px standing height)
  { id: 'r8_f0', row: 8, col: 0, x: 61, y: 669, w: 129, h: 205, anchorX: 80.0, bottomY: 203, rowScale: 1.092, sheet: 'emote' },
  { id: 'r8_f1', row: 8, col: 1, x: 244, y: 670, w: 150, h: 204, anchorX: 83.5, bottomY: 202, rowScale: 1.097, sheet: 'emote' },
  { id: 'r8_f2', row: 8, col: 2, x: 409, y: 671, w: 158, h: 203, anchorX: 97.0, bottomY: 201, rowScale: 1.097, sheet: 'emote' },
  { id: 'r8_f3', row: 8, col: 3, x: 580, y: 671, w: 178, h: 203, anchorX: 104.0, bottomY: 201, rowScale: 1.103, sheet: 'emote' },
  { id: 'r8_f4', row: 8, col: 4, x: 762, y: 672, w: 170, h: 202, anchorX: 107.0, bottomY: 200, rowScale: 1.120, sheet: 'emote' },
  { id: 'r8_f5', row: 8, col: 5, x: 942, y: 669, w: 175, h: 205, anchorX: 113.5, bottomY: 203, rowScale: 1.103, sheet: 'emote' },
  { id: 'r8_f6', row: 8, col: 6, x: 1133, y: 670, w: 182, h: 204, anchorX: 113.0, bottomY: 202, rowScale: 1.103, sheet: 'emote' },
  { id: 'r8_f7', row: 8, col: 7, x: 1321, y: 668, w: 193, h: 206, anchorX: 119.0, bottomY: 204, rowScale: 1.103, sheet: 'emote' },
  { id: 'r8_f8', row: 8, col: 8, x: 1521, y: 664, w: 217, h: 210, anchorX: 114.5, bottomY: 207, rowScale: 1.097, sheet: 'emote' },
];

export const HEROINE_SHEET_FRAMES: readonly HeroineFrameDef[] = [
  ...HEROINE_COMBAT_FRAMES,
  ...HEROINE_EMOTE_FRAMES,
];

export type HeroineAnimMode =
  | 'idle'
  | 'idle1'
  | 'idle2'
  | 'shoot'
  | 'dash_kick'
  | 'overdrive'
  | 'guard'
  | 'upgrade'
  | 'hit'
  | 'defeat'
  | 'victory';

export interface HeroineAnimState {
  mode: HeroineAnimMode;
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

export interface HeroineFrameSample {
  state: HeroineAnimState;
  frameIndex: number;
  frame: HeroineFrameDef;
  /** Outgoing frame index during sub-frame pose cross-dissolve */
  prevFrameIndex: number;
  prevFrame: HeroineFrameDef;
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

interface SequenceKeyframe {
  frameIndex: number;
  until: number;
  xProgress?: number;
  yHopPx?: number;
  dashing?: boolean;
}

const IDLE1_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 36, until: 0.16, xProgress: 0, yHopPx: 0 },
  { frameIndex: 37, until: 0.34, xProgress: 0, yHopPx: 0 },
  { frameIndex: 38, until: 0.52, xProgress: 0, yHopPx: -0.6 },
  { frameIndex: 39, until: 0.72, xProgress: 0, yHopPx: -1.2 },
  { frameIndex: 40, until: 0.92, xProgress: 0, yHopPx: -1.2 },
  { frameIndex: 41, until: 1.12, xProgress: 0, yHopPx: -0.8 },
  { frameIndex: 42, until: 1.32, xProgress: 0, yHopPx: -0.5 },
  { frameIndex: 43, until: 1.48, xProgress: 0, yHopPx: -0.2 },
  { frameIndex: 44, until: 1.62, xProgress: 0, yHopPx: 0 },
];

const IDLE2_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 45, until: 0.18, xProgress: 0, yHopPx: 0 },
  { frameIndex: 46, until: 0.36, xProgress: 0, yHopPx: -0.3 },
  { frameIndex: 47, until: 0.56, xProgress: 0, yHopPx: -0.6 },
  { frameIndex: 48, until: 0.76, xProgress: 0, yHopPx: -0.9 },
  { frameIndex: 49, until: 0.98, xProgress: 0, yHopPx: -1.2 },
  { frameIndex: 50, until: 1.22, xProgress: 0, yHopPx: -1.2 },
  { frameIndex: 51, until: 1.44, xProgress: 0, yHopPx: -0.7 },
  { frameIndex: 52, until: 1.62, xProgress: 0, yHopPx: -0.3 },
  { frameIndex: 53, until: 1.80, xProgress: 0, yHopPx: 0 },
];

const SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 7, until: 0.06, xProgress: 0.025 },
  { frameIndex: 8, until: 0.11, xProgress: 0.055 },
  { frameIndex: 9, until: 0.16, xProgress: 0.075 },
  { frameIndex: 10, until: 0.25, xProgress: 0.065 },
  { frameIndex: 11, until: 0.34, xProgress: 0.045 },
  { frameIndex: 12, until: 0.42, xProgress: 0.025 },
  { frameIndex: 13, until: 0.48, xProgress: 0.008 },
  { frameIndex: 0, until: 0.52, xProgress: 0 },
];

const DASH_KICK_SEQ: readonly SequenceKeyframe[] = [
  // Sprint forward toward front enemy
  { frameIndex: 2, until: 0.05, xProgress: 0.18, yHopPx: 0, dashing: true },
  { frameIndex: 3, until: 0.10, xProgress: 0.42, yHopPx: -3.5, dashing: true },
  { frameIndex: 4, until: 0.15, xProgress: 0.66, yHopPx: -6.5, dashing: true },
  { frameIndex: 5, until: 0.20, xProgress: 0.83, yHopPx: -2.5, dashing: true },
  { frameIndex: 6, until: 0.25, xProgress: 0.92, yHopPx: 0, dashing: true },
  // Plant, chamber & execute High Plasma Kick
  { frameIndex: 15, until: 0.29, xProgress: 0.94, yHopPx: 0 },
  { frameIndex: 16, until: 0.33, xProgress: 0.95, yHopPx: -2.5 },
  { frameIndex: 17, until: 0.37, xProgress: 0.96, yHopPx: -5.0 },
  { frameIndex: 18, until: 0.49, xProgress: 0.96, yHopPx: -6.0 },
  // Retract & tactical back-dash leap (facing enemy in guard/CQC stance — no moonwalk)
  { frameIndex: 19, until: 0.54, xProgress: 0.86, yHopPx: -9.0 },
  { frameIndex: 20, until: 0.58, xProgress: 0.72, yHopPx: -13.0, dashing: true },
  { frameIndex: 22, until: 0.67, xProgress: 0.24, yHopPx: -10.0, dashing: true },
  { frameIndex: 21, until: 0.73, xProgress: 0.04, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.78, xProgress: 0, yHopPx: 0 },
];

const OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  // Sprint in
  { frameIndex: 2, until: 0.05, xProgress: 0.20, yHopPx: 0, dashing: true },
  { frameIndex: 4, until: 0.10, xProgress: 0.48, yHopPx: -6.5, dashing: true },
  { frameIndex: 5, until: 0.15, xProgress: 0.74, yHopPx: -3.5, dashing: true },
  { frameIndex: 6, until: 0.20, xProgress: 0.90, yHopPx: 0, dashing: true },
  // High Plasma Kick impact
  { frameIndex: 16, until: 0.24, xProgress: 0.92, yHopPx: -2.5 },
  { frameIndex: 17, until: 0.28, xProgress: 0.94, yHopPx: -5.0 },
  { frameIndex: 18, until: 0.40, xProgress: 0.94, yHopPx: -6.5 },
  // Acrobatic back-leap smoothly into mid-range firing stance
  { frameIndex: 19, until: 0.45, xProgress: 0.76, yHopPx: -12.0, dashing: true },
  { frameIndex: 21, until: 0.52, xProgress: 0.44, yHopPx: 0, dashing: true },
  // Rapid twin plasma pistol finisher
  { frameIndex: 7, until: 0.56, xProgress: 0.44, yHopPx: 0 },
  { frameIndex: 8, until: 0.60, xProgress: 0.43, yHopPx: 0 },
  { frameIndex: 10, until: 0.67, xProgress: 0.40, yHopPx: 0 },
  { frameIndex: 11, until: 0.74, xProgress: 0.36, yHopPx: 0 },
  { frameIndex: 12, until: 0.78, xProgress: 0.32, yHopPx: 0 },
  // Clean back-dash recovery to base
  { frameIndex: 22, until: 0.84, xProgress: 0.06, yHopPx: -8.5, dashing: true },
  { frameIndex: 1, until: 0.88, xProgress: 0, yHopPx: 0 },
];

const GUARD_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 1, until: 0.06, xProgress: -0.01, yHopPx: 0 },
  { frameIndex: 22, until: 0.36, xProgress: -0.02, yHopPx: 1.5 },
  { frameIndex: 1, until: 0.43, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.48, xProgress: 0, yHopPx: 0 },
];

// USING TECH (Row 8, frames 63..71): Cyan/magenta holographic rings & floating AR screens
const UPGRADE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 63, until: 0.09, xProgress: 0, yHopPx: 0 },
  { frameIndex: 64, until: 0.18, xProgress: 0, yHopPx: -0.6 },
  { frameIndex: 65, until: 0.28, xProgress: 0, yHopPx: -1.4 },
  { frameIndex: 66, until: 0.38, xProgress: 0, yHopPx: -2.2 },
  { frameIndex: 67, until: 0.49, xProgress: 0, yHopPx: -3.0 },
  { frameIndex: 68, until: 0.60, xProgress: 0, yHopPx: -3.5 },
  { frameIndex: 69, until: 0.71, xProgress: 0, yHopPx: -3.0 },
  { frameIndex: 70, until: 0.81, xProgress: 0, yHopPx: -1.6 },
  { frameIndex: 71, until: 0.90, xProgress: 0, yHopPx: 0 },
];

const HIT_NORMAL_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 23, until: 0.10, xProgress: -0.04 },
  { frameIndex: 24, until: 0.21, xProgress: -0.075 },
  { frameIndex: 25, until: 0.32, xProgress: -0.065 },
  { frameIndex: 22, until: 0.41, xProgress: -0.02 },
  { frameIndex: 0, until: 0.46, xProgress: 0 },
];

const HIT_LOW_HP_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 23, until: 0.08, xProgress: -0.04 },
  { frameIndex: 24, until: 0.16, xProgress: -0.075 },
  { frameIndex: 25, until: 0.25, xProgress: -0.085 },
  { frameIndex: 26, until: 0.34, xProgress: -0.068 },
  { frameIndex: 27, until: 0.43, xProgress: -0.055 },
  { frameIndex: 26, until: 0.50, xProgress: -0.035 },
  { frameIndex: 22, until: 0.55, xProgress: -0.01 },
  { frameIndex: 0, until: 0.58, xProgress: 0 },
];

const DEFEAT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 22, until: 0.07, xProgress: 0 },
  { frameIndex: 23, until: 0.15, xProgress: -0.035 },
  { frameIndex: 24, until: 0.23, xProgress: -0.07 },
  { frameIndex: 25, until: 0.31, xProgress: -0.09 },
  { frameIndex: 26, until: 0.40, xProgress: -0.082 },
  { frameIndex: 27, until: 0.49, xProgress: -0.072 },
  { frameIndex: 28, until: 0.57, xProgress: -0.062 },
  { frameIndex: 29, until: 0.65, xProgress: -0.052 },
  { frameIndex: 30, until: 0.73, xProgress: -0.044 },
  { frameIndex: 31, until: 0.81, xProgress: -0.036 },
  { frameIndex: 32, until: 0.89, xProgress: -0.028 },
  { frameIndex: 33, until: 0.96, xProgress: -0.022 },
  { frameIndex: 34, until: 1.03, xProgress: -0.02 },
  { frameIndex: 35, until: 1.10, xProgress: -0.02 },
];

// VICTORY (Row 7, frames 54..62): Crouch -> Peace-Sign Jump with Golden Rays -> Land -> Victory Pose
const VICTORY_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 54, until: 0.09, xProgress: 0, yHopPx: 0 },
  { frameIndex: 55, until: 0.18, xProgress: 0, yHopPx: -2 },
  { frameIndex: 56, until: 0.27, xProgress: 0, yHopPx: -8 },
  { frameIndex: 57, until: 0.38, xProgress: 0, yHopPx: -24 },
  { frameIndex: 58, until: 0.50, xProgress: 0, yHopPx: -46 },
  { frameIndex: 59, until: 0.63, xProgress: 0, yHopPx: -34 },
  { frameIndex: 60, until: 0.74, xProgress: 0, yHopPx: -8 },
  { frameIndex: 61, until: 0.84, xProgress: 0, yHopPx: 0 },
  { frameIndex: 62, until: 0.96, xProgress: 0, yHopPx: 0 },
];

const MODE_DURATIONS: Record<HeroineAnimMode, number> = {
  idle: 0,
  idle1: 1.62,
  idle2: 1.80,
  shoot: 0.52,
  dash_kick: 0.78,
  overdrive: 0.88,
  guard: 0.48,
  upgrade: 0.90,
  hit: 0.46,
  defeat: 1.10,
  victory: 0.96,
};

const FRAME_BLEND_DURATION = 0.052; // 52ms sub-frame pose cross-dissolve

export function createInitialHeroineAnimState(): HeroineAnimState {
  return {
    mode: 'idle',
    elapsed: 0,
    duration: 0,
    lowHpHit: false,
    emittedShots: 0,
    emittedKickImpact: false,
    lastFrameIndex: 0,
    prevFrameIndex: 0,
    frameBlendElapsed: FRAME_BLEND_DURATION,
  };
}

export function triggerHeroineAnimation(
  prev: HeroineAnimState,
  mode: HeroineAnimMode,
  options?: { lowHpHit?: boolean },
): HeroineAnimState {
  if (prev.mode === 'defeat' && mode === 'defeat') {
    return prev;
  }
  const lowHpHit = Boolean(options?.lowHpHit);
  const duration = mode === 'hit' && lowHpHit ? 0.58 : MODE_DURATIONS[mode];
  const currentFrame = prev.lastFrameIndex ?? 0;
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

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson) for smooth C1 trajectories
 * across keyframes without velocity kinks or overshoot.
 */
function interpolateMonotoneHermite(
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  t: number,
): number {
  const h = Math.max(0.0001, t2 - t1);
  const u = Math.max(0, Math.min(1, (t - t1) / h));
  const sec1 = (v2 - v1) / h;

  const h0 = Math.max(0.0001, t1 - t0);
  const sec0 = (v1 - v0) / h0;
  const h2 = Math.max(0.0001, t3 - t2);
  const sec2 = (v3 - v2) / h2;

  let m1 = sec0 * sec1 <= 0 ? 0 : (sec0 + sec1) * 0.5;
  let m2 = sec1 * sec2 <= 0 ? 0 : (sec1 + sec2) * 0.5;

  const maxSlope = 3 * Math.abs(sec1);
  if (Math.abs(m1) > maxSlope) m1 = Math.sign(m1) * maxSlope;
  if (Math.abs(m2) > maxSlope) m2 = Math.sign(m2) * maxSlope;

  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  return h00 * v1 + h10 * h * m1 + h01 * v2 + h11 * h * m2;
}

function sampleSequence(
  seq: readonly SequenceKeyframe[],
  elapsed: number,
): {
  frameIndex: number;
  xProgress: number;
  yHopPx: number;
  dashing: boolean;
  vx: number;
  vy: number;
} {
  let idx = seq.length - 1;
  for (let i = 0; i < seq.length; i++) {
    if (elapsed <= seq[i].until) {
      idx = i;
      break;
    }
  }
  const kf = seq[idx];
  const prevKf = idx > 0 ? seq[idx - 1] : null;
  const prevPrevKf = idx > 1 ? seq[idx - 2] : null;
  const nextKf = idx + 1 < seq.length ? seq[idx + 1] : null;

  const t1 = prevKf ? prevKf.until : 0;
  const t2 = kf.until;
  const t0 = prevPrevKf ? prevPrevKf.until : t1 - (t2 - t1);
  const t3 = nextKf ? nextKf.until : t2 + (t2 - t1);

  const x1 = prevKf?.xProgress ?? 0;
  const x2 = kf.xProgress ?? 0;
  const x0 = prevPrevKf ? (prevPrevKf.xProgress ?? 0) : x1;
  const x3 = nextKf ? (nextKf.xProgress ?? x2) : x2;

  const y1 = prevKf?.yHopPx ?? 0;
  const y2 = kf.yHopPx ?? 0;
  const y0 = prevPrevKf ? (prevPrevKf.yHopPx ?? 0) : y1;
  const y3 = nextKf ? (nextKf.yHopPx ?? y2) : y2;

  const xProgress = interpolateMonotoneHermite(t0, t1, t2, t3, x0, x1, x2, x3, elapsed);
  const yHopPx = interpolateMonotoneHermite(t0, t1, t2, t3, y0, y1, y2, y3, elapsed);

  const span = Math.max(0.0001, t2 - t1);
  const vx = (x2 - x1) / span;
  const vy = (y2 - y1) / span;

  return {
    frameIndex: kf.frameIndex,
    xProgress,
    yHopPx,
    dashing: Boolean(kf.dashing),
    vx,
    vy,
  };
}

/**
 * Computes the current idle frame index when Kira is in `idle` mode.
 * - When a tactical tile color is hovered/previewed, snaps immediately to the matching tactical ready pose.
 * - When unhovered, alternates calmly between her combat-ready stand (`0`), `IDLE1` hair-twirl (`36..44`),
 *   and `IDLE2` smartphone selfie (`45..53`) across a 12-second ambient cycle.
 */
function sampleAmbientIdleFrame(totalTime: number, hoveredColor: TileType | null): {
  frameIndex: number;
  yHopPx: number;
} {
  if (hoveredColor === 'attack') {
    return { frameIndex: 7, yHopPx: 0 }; // Pistol aim ready (Row 1 F0)
  }
  if (hoveredColor === 'defense') {
    return { frameIndex: 22, yHopPx: 0 }; // Guard brace stance (Row 3 F0)
  }
  if (hoveredColor === 'tech') {
    return { frameIndex: 65, yHopPx: -1 }; // Holographic tech rings ready (Row 8 F2)
  }

  const cycle = ((totalTime % 12) + 12) % 12;
  // Window 1 (2.00s .. 3.62s): IDLE1 (Hair twirl & wink, frames 36..44)
  if (cycle >= 2.0 && cycle < 3.62) {
    const s = sampleSequence(IDLE1_SEQ, cycle - 2.0);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  // Window 2 (6.80s .. 8.60s): IDLE2 (Smartphone selfie, frames 45..53)
  if (cycle >= 6.8 && cycle < 8.6) {
    const s = sampleSequence(IDLE2_SEQ, cycle - 6.8);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  return { frameIndex: 0, yHopPx: 0 };
}

function computeFrameTransitionState(
  prevState: HeroineAnimState,
  targetFrameIndex: number,
  dt: number,
): {
  lastFrameIndex: number;
  prevFrameIndex: number;
  frameBlendElapsed: number;
  frameBlendAlpha: number;
} {
  const prevLast = prevState.lastFrameIndex ?? targetFrameIndex;
  let prevIdx = prevState.prevFrameIndex ?? prevLast;
  let blendElapsed = (prevState.frameBlendElapsed ?? FRAME_BLEND_DURATION) + Math.max(0, dt);

  if (targetFrameIndex !== prevLast) {
    prevIdx = prevLast;
    blendElapsed = Math.max(0, dt);
  }

  const rawT = Math.max(0, Math.min(1, blendElapsed / FRAME_BLEND_DURATION));
  // Smoothstep easing for sub-frame cross-dissolve
  const frameBlendAlpha = prevIdx === targetFrameIndex ? 1 : rawT * rawT * (3 - 2 * rawT);

  return {
    lastFrameIndex: targetFrameIndex,
    prevFrameIndex: prevIdx,
    frameBlendElapsed: blendElapsed,
    frameBlendAlpha,
  };
}

export function stepHeroineAnimState(
  prev: HeroineAnimState,
  dt: number,
  context: {
    isDead: boolean;
    isVictory: boolean;
    hoveredColor: TileType | null;
    totalTime: number;
  },
): HeroineFrameSample {
  let state = prev;

  if (context.isDead && state.mode !== 'defeat') {
    state = triggerHeroineAnimation(state, 'defeat');
  } else if (!context.isDead && state.mode === 'defeat') {
    state = createInitialHeroineAnimState();
  }

  if (state.mode === 'idle') {
    if (context.isVictory) {
      state = triggerHeroineAnimation(state, 'victory');
    } else {
      const { frameIndex, yHopPx } = sampleAmbientIdleFrame(
        context.totalTime,
        context.hoveredColor,
      );
      const trans = computeFrameTransitionState(state, frameIndex, dt);
      const nextIdleState: HeroineAnimState = {
        ...state,
        lastFrameIndex: trans.lastFrameIndex,
        prevFrameIndex: trans.prevFrameIndex,
        frameBlendElapsed: trans.frameBlendElapsed,
      };
      const breathWave = Math.sin(context.totalTime * 2.4);
      const breathScaleY = 1 + breathWave * 0.012;
      const breathScaleX = 1 - breathWave * 0.006;
      const idleSwayTilt = Math.sin(context.totalTime * 1.6) * 0.006;
      const idleBobY = yHopPx + Math.cos(context.totalTime * 2.4) * 0.6;
      return {
        state: nextIdleState,
        frameIndex,
        frame: HEROINE_SHEET_FRAMES[frameIndex],
        prevFrameIndex: trans.prevFrameIndex,
        prevFrame: HEROINE_SHEET_FRAMES[trans.prevFrameIndex],
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

  // If explicitly playing idle1/idle2 and player hovers a tactical tile or wins, interrupt immediately
  if ((state.mode === 'idle1' || state.mode === 'idle2') && (context.hoveredColor !== null || context.isVictory)) {
    const idleState: HeroineAnimState = {
      ...createInitialHeroineAnimState(),
      lastFrameIndex: state.lastFrameIndex ?? 0,
      prevFrameIndex: state.prevFrameIndex ?? 0,
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepHeroineAnimState(idleState, dt, context);
  }

  const nextElapsed = state.elapsed + dt;

  // Non-clamping sequences return to idle when finished, preserving lastFrameIndex for smooth blend back
  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    const idleState: HeroineAnimState = {
      ...createInitialHeroineAnimState(),
      lastFrameIndex: state.lastFrameIndex ?? 0,
      prevFrameIndex: state.prevFrameIndex ?? 0,
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepHeroineAnimState(idleState, 0, context);
  }

  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let seq: readonly SequenceKeyframe[] = SHOOT_SEQ;
  if (state.mode === 'idle1') seq = IDLE1_SEQ;
  else if (state.mode === 'idle2') seq = IDLE2_SEQ;
  else if (state.mode === 'dash_kick') seq = DASH_KICK_SEQ;
  else if (state.mode === 'overdrive') seq = OVERDRIVE_SEQ;
  else if (state.mode === 'guard') seq = GUARD_SEQ;
  else if (state.mode === 'upgrade') seq = UPGRADE_SEQ;
  else if (state.mode === 'hit') seq = state.lowHpHit ? HIT_LOW_HP_SEQ : HIT_NORMAL_SEQ;
  else if (state.mode === 'defeat') seq = DEFEAT_SEQ;
  else if (state.mode === 'victory') seq = VICTORY_SEQ;

  const sampled = sampleSequence(seq, clampedElapsed);
  let emittedShots = state.emittedShots;
  let shouldEmitShot = false;
  if ((sampled.frameIndex === 10 || sampled.frameIndex === 11) && emittedShots < (sampled.frameIndex === 10 ? 1 : 2)) {
    emittedShots = sampled.frameIndex === 10 ? 1 : 2;
    shouldEmitShot = true;
  }

  let emittedKickImpact = state.emittedKickImpact;
  let shouldEmitKickImpact = false;
  if (sampled.frameIndex === 18 && !emittedKickImpact) {
    emittedKickImpact = true;
    shouldEmitKickImpact = true;
  }

  const trans = computeFrameTransitionState(state, sampled.frameIndex, dt);

  const nextState: HeroineAnimState = {
    ...state,
    elapsed: clampedElapsed,
    emittedShots,
    emittedKickImpact,
    lastFrameIndex: trans.lastFrameIndex,
    prevFrameIndex: trans.prevFrameIndex,
    frameBlendElapsed: trans.frameBlendElapsed,
  };

  // Continuous secondary squash-and-stretch & aerodynamic tilt
  let breathScaleY = 1;
  let breathScaleX = 1;
  let tiltRad = 0;

  if (state.mode === 'victory') {
    if (clampedElapsed >= state.duration) {
      const w = Math.sin(context.totalTime * 2.2);
      breathScaleY = 1 + w * 0.013;
      breathScaleX = 1 - w * 0.006;
    } else if (sampled.frameIndex === 54 || sampled.frameIndex === 61) {
      // Crouch squash on launch & landing cushion
      breathScaleY = 0.965;
      breathScaleX = 1.022;
    } else if (sampled.frameIndex >= 57 && sampled.frameIndex <= 59) {
      // Airborne celebratory stretch
      breathScaleY = 1.022;
      breathScaleX = 0.988;
    }
  } else if (state.mode === 'dash_kick' || state.mode === 'overdrive') {
    tiltRad = Math.max(-0.045, Math.min(0.055, sampled.vx * 0.014));
    if (sampled.frameIndex === 18) {
      breathScaleY = 1.018;
      breathScaleX = 0.99;
    }
  } else if (state.mode === 'shoot') {
    if (sampled.frameIndex === 10 || sampled.frameIndex === 11) {
      tiltRad = -0.018;
      breathScaleY = 1.01;
      breathScaleX = 0.995;
    }
  } else if (state.mode === 'hit') {
    tiltRad = Math.max(-0.04, Math.min(0, sampled.vx * 0.03));
  } else if (state.mode === 'upgrade') {
    const u = clampedElapsed / Math.max(0.001, state.duration);
    const pulse = Math.sin(u * Math.PI);
    breathScaleY = 1 + pulse * 0.014;
    breathScaleX = 1 - pulse * 0.007;
  }

  return {
    state: nextState,
    frameIndex: sampled.frameIndex,
    frame: HEROINE_SHEET_FRAMES[sampled.frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: HEROINE_SHEET_FRAMES[trans.prevFrameIndex],
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
