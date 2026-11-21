import type { CharacterId, TileType } from '../engine/types';
import {
  type HeroAnimMode,
  type HeroAnimState,
  type HeroFrameDef,
  type HeroFrameSample,
  createInitialHeroAnimState,
} from './heroAnimator';
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

export const KIRA_SHEET_WIDTH = 2115;
export const KIRA_SHEET_HEIGHT = 1189;
export const KIRA_EMOTE_SHEET_WIDTH = 2095;
export const KIRA_EMOTE_SHEET_HEIGHT = 1007;
export const KIRA_CANONICAL_HEIGHT = 214;
export const KIRA_DODGE_DURATION = 0.96;

export const KIRA_COMBAT_FRAMES: readonly HeroFrameDef[] = [
  // Row 0: Idle & Sprint Run (7 frames, normalized to exact 214.0px standing height)
  { id: 'r0_f0', row: 0, col: 0, x: 16, y: 16, w: 136, h: 224, anchorX: 79, bottomY: 219, rowScale: 1.019, sheet: 'combat' },
  { id: 'r0_f1', row: 0, col: 1, x: 170, y: 16, w: 140, h: 222, anchorX: 70.5, bottomY: 217, rowScale: 1.034, sheet: 'combat' },
  { id: 'r0_f2', row: 0, col: 2, x: 328, y: 16, w: 176, h: 218, anchorX: 98.5, bottomY: 213, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f3', row: 0, col: 3, x: 522, y: 16, w: 158, h: 215, anchorX: 82.5, bottomY: 210, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f4', row: 0, col: 4, x: 698, y: 16, w: 178, h: 214, anchorX: 84.7, bottomY: 208, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f5', row: 0, col: 5, x: 894, y: 16, w: 161, h: 212, anchorX: 74.4, bottomY: 207, rowScale: 1.035, sheet: 'combat' },
  { id: 'r0_f6', row: 0, col: 6, x: 1073, y: 16, w: 193, h: 212, anchorX: 100.9, bottomY: 207, rowScale: 1.035, sheet: 'combat' },

  // Row 1: Pistol Aim & Muzzle Flash Burst (7 frames, upscaled to canonical 214.0px standing height)
  { id: 'r1_f0', row: 1, col: 0, x: 16, y: 258, w: 186, h: 233, anchorX: 91.94, bottomY: 227.7, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 87, dy: -167 } },
  { id: 'r1_f1', row: 1, col: 1, x: 220, y: 258, w: 194, h: 232, anchorX: 102.8, bottomY: 226.73, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 86, dy: -174 } },
  { id: 'r1_f2', row: 1, col: 2, x: 432, y: 258, w: 204, h: 234, anchorX: 112.63, bottomY: 228.68, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 85, dy: -179 } },
  { id: 'r1_f3', row: 1, col: 3, x: 654, y: 258, w: 241, h: 235, anchorX: 122.11, bottomY: 229.66, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 103, dy: -182 } },
  { id: 'r1_f4', row: 1, col: 4, x: 913, y: 258, w: 239, h: 238, anchorX: 120.04, bottomY: 232.57, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 104, dy: -185 } },
  { id: 'r1_f5', row: 1, col: 5, x: 1170, y: 258, w: 203, h: 235, anchorX: 108.98, bottomY: 229.66, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 90, dy: -175 } },
  { id: 'r1_f6', row: 1, col: 6, x: 1391, y: 258, w: 194, h: 234, anchorX: 100.23, bottomY: 228.63, rowScale: 1, sheet: 'combat', muzzleRel: { dx: 86, dy: -167 } },

  // Row 2: High Plasma Kick Combo (8 frames, upscaled to canonical 214.0px standing height)
  { id: 'r2_f0', row: 2, col: 0, x: 16, y: 514, w: 203, h: 234, anchorX: 109.67, bottomY: 227.2, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f1', row: 2, col: 1, x: 237, y: 514, w: 192, h: 239, anchorX: 107.13, bottomY: 232.05, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f2', row: 2, col: 2, x: 447, y: 514, w: 191, h: 234, anchorX: 102.23, bottomY: 227.28, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f3', row: 2, col: 3, x: 656, y: 514, w: 214, h: 239, anchorX: 121.99, bottomY: 233.54, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f4', row: 2, col: 4, x: 888, y: 514, w: 265, h: 230, anchorX: 110.3, bottomY: 223.27, rowScale: 1, sheet: 'combat', kickTipRel: { dx: 141, dy: -167 } },
  { id: 'r2_f5', row: 2, col: 5, x: 1171, y: 514, w: 167, h: 244, anchorX: 73.59, bottomY: 236.91, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f6', row: 2, col: 6, x: 1356, y: 514, w: 175, h: 243, anchorX: 107.58, bottomY: 235.81, rowScale: 1, sheet: 'combat' },
  { id: 'r2_f7', row: 2, col: 7, x: 1549, y: 514, w: 188, h: 232, anchorX: 101.39, bottomY: 225.26, rowScale: 1, sheet: 'combat' },

  // Row 3: Guard, Hit Spark, Knockback Stagger & Kneel (6 frames, upscaled to canonical 214.0px standing height)
  { id: 'r3_f0', row: 3, col: 0, x: 16, y: 776, w: 205, h: 227, anchorX: 116.84, bottomY: 221.25, rowScale: 1, sheet: 'combat' },
  { id: 'r3_f1', row: 3, col: 1, x: 239, y: 776, w: 226, h: 230, anchorX: 137.21, bottomY: 222.68, rowScale: 1, sheet: 'combat' },
  { id: 'r3_f2', row: 3, col: 2, x: 483, y: 776, w: 216, h: 221, anchorX: 143.27, bottomY: 213.68, rowScale: 1, sheet: 'combat' },
  { id: 'r3_f3', row: 3, col: 3, x: 717, y: 776, w: 258, h: 227, anchorX: 163.45, bottomY: 219.68, rowScale: 1, sheet: 'combat' },
  { id: 'r3_f4', row: 3, col: 4, x: 993, y: 776, w: 218, h: 182, anchorX: 139.84, bottomY: 174.83, rowScale: 1, sheet: 'combat' },
  { id: 'r3_f5', row: 3, col: 5, x: 1229, y: 776, w: 195, h: 168, anchorX: 96.78, bottomY: 160.82, rowScale: 1, sheet: 'combat' },

  // Row 4: Collapse to Prone Defeat (8 frames, upscaled to canonical 214.0px standing scale)
  { id: 'r4_f0', row: 4, col: 0, x: 16, y: 1024, w: 195, h: 149, anchorX: 106.39, bottomY: 141.84, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f1', row: 4, col: 1, x: 229, y: 1024, w: 213, h: 139, anchorX: 118.73, bottomY: 131.84, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f2', row: 4, col: 2, x: 460, y: 1024, w: 195, h: 132, anchorX: 102.09, bottomY: 126.26, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f3', row: 4, col: 3, x: 673, y: 1024, w: 250, h: 122, anchorX: 121.7, bottomY: 116.26, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f4', row: 4, col: 4, x: 941, y: 1024, w: 241, h: 112, anchorX: 116.63, bottomY: 104.82, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f5', row: 4, col: 5, x: 1200, y: 1024, w: 276, h: 105, anchorX: 139.15, bottomY: 97.81, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f6', row: 4, col: 6, x: 1494, y: 1024, w: 274, h: 95, anchorX: 143.31, bottomY: 87.8, rowScale: 1, sheet: 'combat' },
  { id: 'r4_f7', row: 4, col: 7, x: 1786, y: 1024, w: 313, h: 80, anchorX: 154.06, bottomY: 72.86, rowScale: 1, sheet: 'combat' },
];

export const KIRA_EMOTE_FRAMES: readonly HeroFrameDef[] = [
  // Row 5 (Emote Sheet Row 0): IDLE1 — Hair Twirl & Wink (indices 36..44, exact 214.0px standing height)
  { id: 'r5_f0', row: 5, col: 0, x: 16, y: 16, w: 126, h: 213, anchorX: 76.5, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f1', row: 5, col: 1, x: 160, y: 16, w: 124, h: 212, anchorX: 74.5, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f2', row: 5, col: 2, x: 302, y: 16, w: 128, h: 212, anchorX: 75, bottomY: 210, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f3', row: 5, col: 3, x: 448, y: 16, w: 147, h: 212, anchorX: 96, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f4', row: 5, col: 4, x: 613, y: 16, w: 142, h: 213, anchorX: 86.5, bottomY: 211, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f5', row: 5, col: 5, x: 773, y: 16, w: 143, h: 212, anchorX: 89, bottomY: 210, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f6', row: 5, col: 6, x: 934, y: 16, w: 135, h: 215, anchorX: 81, bottomY: 213, rowScale: 1.044, sheet: 'emote' },
  { id: 'r5_f7', row: 5, col: 7, x: 1087, y: 16, w: 147, h: 213, anchorX: 83, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r5_f8', row: 5, col: 8, x: 1252, y: 16, w: 139, h: 213, anchorX: 87, bottomY: 211, rowScale: 1.044, sheet: 'emote' },

  // Row 6 (Emote Sheet Row 1): IDLE2 — Smartphone Selfie & Peace Pose (indices 45..53, exact 214.0px standing height)
  { id: 'r6_f0', row: 6, col: 0, x: 16, y: 249, w: 129, h: 216, anchorX: 82.5, bottomY: 214, rowScale: 1.029, sheet: 'emote' },
  { id: 'r6_f1', row: 6, col: 1, x: 163, y: 249, w: 141, h: 218, anchorX: 93.5, bottomY: 216, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f2', row: 6, col: 2, x: 322, y: 249, w: 148, h: 215, anchorX: 89.5, bottomY: 213, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f3', row: 6, col: 3, x: 488, y: 249, w: 140, h: 214, anchorX: 93, bottomY: 211, rowScale: 1.044, sheet: 'emote' },
  { id: 'r6_f4', row: 6, col: 4, x: 646, y: 249, w: 167, h: 216, anchorX: 101.5, bottomY: 214, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f5', row: 6, col: 5, x: 831, y: 249, w: 175, h: 216, anchorX: 97.5, bottomY: 214, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f6', row: 6, col: 6, x: 1024, y: 249, w: 171, h: 213, anchorX: 101.5, bottomY: 211, rowScale: 1.039, sheet: 'emote' },
  { id: 'r6_f7', row: 6, col: 7, x: 1213, y: 249, w: 150, h: 214, anchorX: 94, bottomY: 212, rowScale: 1.034, sheet: 'emote' },
  { id: 'r6_f8', row: 6, col: 8, x: 1381, y: 249, w: 139, h: 214, anchorX: 90.5, bottomY: 212, rowScale: 1.039, sheet: 'emote' },

  // Row 7 (Emote Sheet Row 2): VICTORY — Crouch, Peace-Sign Jump with Golden Burst, Land & Pose (indices 54..62)
  { id: 'r7_f0', row: 7, col: 0, x: 16, y: 485, w: 159, h: 197, anchorX: 93.82, bottomY: 194.12, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f1', row: 7, col: 1, x: 193, y: 485, w: 184, h: 224, anchorX: 108.39, bottomY: 221.13, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f2', row: 7, col: 2, x: 395, y: 485, w: 207, h: 241, anchorX: 96.31, bottomY: 235.26, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f3', row: 7, col: 3, x: 620, y: 485, w: 215, h: 236, anchorX: 124.41, bottomY: 233.12, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f4', row: 7, col: 4, x: 853, y: 485, w: 211, h: 201, anchorX: 138.23, bottomY: 198.13, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f5', row: 7, col: 5, x: 1082, y: 485, w: 287, h: 221, anchorX: 145.65, bottomY: 218.13, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f6', row: 7, col: 6, x: 1387, y: 485, w: 211, h: 254, anchorX: 127.75, bottomY: 249.69, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f7', row: 7, col: 7, x: 1616, y: 485, w: 198, h: 224, anchorX: 126.98, bottomY: 221.13, rowScale: 1, sheet: 'emote' },
  { id: 'r7_f8', row: 7, col: 8, x: 1832, y: 485, w: 247, h: 258, anchorX: 144.32, bottomY: 255.13, rowScale: 1, sheet: 'emote' },

  // Row 8 (Emote Sheet Row 3): USING TECH — Cyan/Magenta Holographic Rings & AR Screens (indices 63..71)
  { id: 'r8_f0', row: 8, col: 0, x: 16, y: 761, w: 141, h: 224, anchorX: 87.44, bottomY: 221.81, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f1', row: 8, col: 1, x: 175, y: 761, w: 165, h: 224, anchorX: 91.85, bottomY: 221.8, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f2', row: 8, col: 2, x: 358, y: 761, w: 173, h: 223, anchorX: 106.21, bottomY: 220.8, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f3', row: 8, col: 3, x: 549, y: 761, w: 196, h: 224, anchorX: 114.52, bottomY: 221.79, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f4', row: 8, col: 4, x: 763, y: 761, w: 190, h: 226, anchorX: 119.59, bottomY: 223.76, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f5', row: 8, col: 5, x: 971, y: 761, w: 193, h: 226, anchorX: 125.17, bottomY: 223.8, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f6', row: 8, col: 6, x: 1182, y: 761, w: 201, h: 225, anchorX: 124.8, bottomY: 222.79, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f7', row: 8, col: 7, x: 1401, y: 761, w: 213, h: 227, anchorX: 131.33, bottomY: 224.8, rowScale: 1, sheet: 'emote' },
  { id: 'r8_f8', row: 8, col: 8, x: 1632, y: 761, w: 238, h: 230, anchorX: 125.58, bottomY: 226.71, rowScale: 1, sheet: 'emote' },
];

export const KIRA_DODGE_FRAMES: readonly HeroFrameDef[] = [
  // Row 9 (Dedicated resized transparent RGBA dodge poses, indices 72..75)
  { id: 'dodge_vault', row: 9, col: 0, x: 0, y: 0, w: 193, h: 256, anchorX: 102, bottomY: 245, rowScale: 0.96, sheet: 'dodge' },
  { id: 'dodge_slide_1', row: 9, col: 1, x: 0, y: 0, w: 215, h: 264, anchorX: 105, bottomY: 256, rowScale: 0.91, sheet: 'dodge' },
  { id: 'dodge_slide_2', row: 9, col: 2, x: 0, y: 0, w: 210, h: 264, anchorX: 106, bottomY: 256, rowScale: 0.93, sheet: 'dodge' },
  { id: 'dodge_land', row: 9, col: 3, x: 0, y: 0, w: 192, h: 248, anchorX: 96, bottomY: 240, rowScale: 0.92, sheet: 'dodge' },
];

export const KIRA_SHEET_FRAMES: readonly HeroFrameDef[] = [
  ...KIRA_COMBAT_FRAMES,
  ...KIRA_EMOTE_FRAMES,
  ...KIRA_DODGE_FRAMES,
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
  { frameIndex: 2, until: 0.05, xProgress: 0.18, yHopPx: 0, dashing: true },
  { frameIndex: 3, until: 0.10, xProgress: 0.42, yHopPx: -3.5, dashing: true },
  { frameIndex: 4, until: 0.15, xProgress: 0.66, yHopPx: -6.5, dashing: true },
  { frameIndex: 5, until: 0.20, xProgress: 0.83, yHopPx: -2.5, dashing: true },
  { frameIndex: 6, until: 0.25, xProgress: 0.92, yHopPx: 0, dashing: true },
  { frameIndex: 15, until: 0.29, xProgress: 0.94, yHopPx: 0 },
  { frameIndex: 16, until: 0.33, xProgress: 0.95, yHopPx: -2.5 },
  { frameIndex: 17, until: 0.37, xProgress: 0.96, yHopPx: -5.0 },
  { frameIndex: 18, until: 0.49, xProgress: 0.96, yHopPx: -6.0 },
  { frameIndex: 19, until: 0.54, xProgress: 0.86, yHopPx: -9.0 },
  { frameIndex: 20, until: 0.58, xProgress: 0.72, yHopPx: -13.0, dashing: true },
  { frameIndex: 22, until: 0.67, xProgress: 0.24, yHopPx: -10.0, dashing: true },
  { frameIndex: 21, until: 0.73, xProgress: 0.04, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.78, xProgress: 0, yHopPx: 0 },
];

const OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 2, until: 0.05, xProgress: 0.20, yHopPx: 0, dashing: true },
  { frameIndex: 4, until: 0.10, xProgress: 0.48, yHopPx: -6.5, dashing: true },
  { frameIndex: 5, until: 0.15, xProgress: 0.74, yHopPx: -3.5, dashing: true },
  { frameIndex: 6, until: 0.20, xProgress: 0.90, yHopPx: 0, dashing: true },
  { frameIndex: 16, until: 0.24, xProgress: 0.92, yHopPx: -2.5 },
  { frameIndex: 17, until: 0.28, xProgress: 0.94, yHopPx: -5.0 },
  { frameIndex: 18, until: 0.40, xProgress: 0.94, yHopPx: -6.5 },
  { frameIndex: 19, until: 0.45, xProgress: 0.76, yHopPx: -12.0, dashing: true },
  { frameIndex: 21, until: 0.52, xProgress: 0.44, yHopPx: 0, dashing: true },
  { frameIndex: 7, until: 0.56, xProgress: 0.44, yHopPx: 0 },
  { frameIndex: 8, until: 0.60, xProgress: 0.43, yHopPx: 0 },
  { frameIndex: 10, until: 0.67, xProgress: 0.40, yHopPx: 0 },
  { frameIndex: 11, until: 0.74, xProgress: 0.36, yHopPx: 0 },
  { frameIndex: 12, until: 0.78, xProgress: 0.32, yHopPx: 0 },
  { frameIndex: 22, until: 0.84, xProgress: 0.06, yHopPx: -8.5, dashing: true },
  { frameIndex: 1, until: 0.88, xProgress: 0, yHopPx: 0 },
];

const GUARD_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 1, until: 0.06, xProgress: -0.01, yHopPx: 0 },
  { frameIndex: 22, until: 0.36, xProgress: -0.02, yHopPx: 1.5 },
  { frameIndex: 1, until: 0.43, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.48, xProgress: 0, yHopPx: 0 },
];

const DODGE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 72, until: 0.09, xProgress: -0.07, yHopPx: -18, dashing: true },
  { frameIndex: 72, until: 0.17, xProgress: -0.15, yHopPx: -34, dashing: true },
  { frameIndex: 72, until: 0.23, xProgress: -0.20, yHopPx: -14, dashing: true },
  { frameIndex: 73, until: 0.34, xProgress: -0.25, yHopPx: -2, dashing: true },
  { frameIndex: 73, until: 0.46, xProgress: -0.28, yHopPx: 0, dashing: true },
  { frameIndex: 74, until: 0.57, xProgress: -0.30, yHopPx: 0, dashing: true },
  { frameIndex: 74, until: 0.67, xProgress: -0.25, yHopPx: 0, dashing: true },
  { frameIndex: 75, until: 0.76, xProgress: -0.11, yHopPx: 0, dashing: true },
  { frameIndex: 75, until: 0.86, xProgress: -0.05, yHopPx: 0, dashing: false },
  { frameIndex: 0, until: 0.96, xProgress: 0, yHopPx: 0, dashing: false },
];

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

const MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.62,
  idle2: 1.80,
  shoot: 0.52,
  dash_kick: 0.78,
  overdrive: 0.88,
  guard: 0.48,
  dodge: KIRA_DODGE_DURATION,
  upgrade: 0.90,
  hit: 0.46,
  defeat: 1.10,
  victory: 0.96,
};

const FRAME_BLEND_DURATION = 0.052;
const DODGE_FRAME_BLEND_DURATION = 0.072;

export function triggerKiraAnimation(
  prev: HeroAnimState,
  mode: HeroAnimMode,
  options?: { lowHpHit?: boolean },
): HeroAnimState {
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

function sampleAmbientIdleFrame(totalTime: number, hoveredColor: TileType | null): {
  frameIndex: number;
  yHopPx: number;
} {
  if (hoveredColor === 'attack') {
    return { frameIndex: 7, yHopPx: 0 };
  }
  if (hoveredColor === 'defense') {
    return { frameIndex: 22, yHopPx: 0 };
  }
  if (hoveredColor === 'tech') {
    return { frameIndex: 65, yHopPx: -1 };
  }

  const cycle = ((totalTime % 12) + 12) % 12;
  if (cycle >= 2.0 && cycle < 3.62) {
    const s = sampleSequence(IDLE1_SEQ, cycle - 2.0);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  if (cycle >= 6.8 && cycle < 8.6) {
    const s = sampleSequence(IDLE2_SEQ, cycle - 6.8);
    return { frameIndex: s.frameIndex, yHopPx: s.yHopPx };
  }
  return { frameIndex: 0, yHopPx: 0 };
}

export function stepKiraAnimState(
  prev: HeroAnimState,
  dt: number,
  context: {
    isDead: boolean;
    isVictory: boolean;
    hoveredColor: TileType | null;
    totalTime: number;
  },
): HeroFrameSample {
  let state = prev;

  if (context.isDead && state.mode !== 'defeat') {
    state = triggerKiraAnimation(state, 'defeat');
  } else if (!context.isDead && state.mode === 'defeat') {
    state = createInitialHeroAnimState();
  }

  if (state.mode === 'idle') {
    if (context.isVictory) {
      state = triggerKiraAnimation(state, 'victory');
    } else {
      const { frameIndex, yHopPx } = sampleAmbientIdleFrame(
        context.totalTime,
        context.hoveredColor,
      );
      const trans = computeFrameTransitionState(state, frameIndex, dt, FRAME_BLEND_DURATION);
      const nextIdleState: HeroAnimState = {
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
        frame: KIRA_SHEET_FRAMES[frameIndex],
        prevFrameIndex: trans.prevFrameIndex,
        prevFrame: KIRA_SHEET_FRAMES[trans.prevFrameIndex],
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

  if ((state.mode === 'idle1' || state.mode === 'idle2') && (context.hoveredColor !== null || context.isVictory)) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: state.lastFrameIndex ?? 0,
      prevFrameIndex: state.prevFrameIndex ?? 0,
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepKiraAnimState(idleState, dt, context);
  }

  const nextElapsed = state.elapsed + dt;

  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: state.lastFrameIndex ?? 0,
      prevFrameIndex: state.prevFrameIndex ?? 0,
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepKiraAnimState(idleState, 0, context);
  }

  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let seq: readonly SequenceKeyframe[] = SHOOT_SEQ;
  if (state.mode === 'idle1') seq = IDLE1_SEQ;
  else if (state.mode === 'idle2') seq = IDLE2_SEQ;
  else if (state.mode === 'dash_kick') seq = DASH_KICK_SEQ;
  else if (state.mode === 'overdrive') seq = OVERDRIVE_SEQ;
  else if (state.mode === 'guard') seq = GUARD_SEQ;
  else if (state.mode === 'dodge') seq = DODGE_SEQ;
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

  const blendDuration =
    state.mode === 'dodge' ? DODGE_FRAME_BLEND_DURATION : FRAME_BLEND_DURATION;
  const trans = computeFrameTransitionState(state, sampled.frameIndex, dt, blendDuration);

  const nextState: HeroAnimState = {
    ...state,
    elapsed: clampedElapsed,
    emittedShots,
    emittedKickImpact,
    lastFrameIndex: trans.lastFrameIndex,
    prevFrameIndex: trans.prevFrameIndex,
    frameBlendElapsed: trans.frameBlendElapsed,
  };

  let breathScaleY = 1;
  let breathScaleX = 1;
  let tiltRad = 0;

  if (state.mode === 'victory') {
    if (clampedElapsed >= state.duration) {
      const w = Math.sin(context.totalTime * 2.2);
      breathScaleY = 1 + w * 0.013;
      breathScaleX = 1 - w * 0.006;
    } else if (sampled.frameIndex === 54 || sampled.frameIndex === 61) {
      breathScaleY = 0.965;
      breathScaleX = 1.022;
    } else if (sampled.frameIndex >= 57 && sampled.frameIndex <= 59) {
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
  } else if (state.mode === 'dodge') {
    if (sampled.frameIndex === 72) {
      const uVault = Math.max(0, Math.min(1, clampedElapsed / 0.23));
      const launchStretch = Math.sin(uVault * Math.PI);
      breathScaleY = 1 + 0.052 * launchStretch;
      breathScaleX = 1 - 0.036 * launchStretch;
      tiltRad = -0.05 + uVault * 0.03;
    } else if (sampled.frameIndex === 73) {
      const uSlide1 = Math.max(0, Math.min(1, (clampedElapsed - 0.23) / 0.23));
      const glideEase = Math.sin(uSlide1 * Math.PI);
      breathScaleY = 1 - 0.032 * (1 - uSlide1 * 0.45);
      breathScaleX = 1 + 0.038 * (0.55 + 0.45 * glideEase);
      tiltRad = -0.028 * (1 - uSlide1 * 0.65);
    } else if (sampled.frameIndex === 74) {
      const uSlide2 = Math.max(0, Math.min(1, (clampedElapsed - 0.46) / 0.21));
      const brakeWave = Math.sin(uSlide2 * Math.PI);
      breathScaleY = 1 - 0.042 * (0.5 + 0.5 * brakeWave);
      breathScaleX = 1 + 0.042 * (0.5 + 0.5 * brakeWave);
      tiltRad = 0.022 * brakeWave;
    } else if (sampled.frameIndex === 75) {
      const uLand = Math.max(0, Math.min(1, (clampedElapsed - 0.67) / 0.19));
      const cushion = Math.sin(uLand * Math.PI) * (1 - uLand * 0.38);
      breathScaleY = 1 - cushion * 0.078;
      breathScaleX = 1 + cushion * 0.068;
      tiltRad = 0.014 * (1 - uLand);
    } else {
      const uRise = Math.max(0, Math.min(1, (clampedElapsed - 0.86) / 0.10));
      const riseArc = Math.sin(uRise * Math.PI);
      breathScaleY = 1 + 0.024 * riseArc;
      breathScaleX = 1 - 0.014 * riseArc;
      tiltRad = 0;
    }
  } else if (state.mode === 'upgrade') {
    const u = clampedElapsed / Math.max(0.001, state.duration);
    const pulse = Math.sin(u * Math.PI);
    breathScaleY = 1 + pulse * 0.014;
    breathScaleX = 1 - pulse * 0.007;
  }

  return {
    state: nextState,
    frameIndex: sampled.frameIndex,
    frame: KIRA_SHEET_FRAMES[sampled.frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: KIRA_SHEET_FRAMES[trans.prevFrameIndex],
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
