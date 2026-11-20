import type { TileType } from '../engine/types';
import {
  type HeroAnimMode,
  type HeroAnimState,
  type HeroFrameDef,
  type HeroFrameSample,
  createInitialHeroAnimState,
} from './heroAnimator';
import type { SpriteCutoutOptions } from './spriteCutout';
import {
  type SequenceKeyframe,
  computeFrameTransitionState,
  sampleSequence as sampleBaseSequence,
} from './spriteSheetAnim';

export {
  ZURI_DRONE_FRAMES,
  sampleZuriDroneFormation,
  type ZuriDroneFrameDef,
  type ZuriDroneId,
  type ZuriDronePose,
} from './zuriDroneFormation';

export const ZURI_SHEET_WIDTH = 2172;
export const ZURI_SHEET_HEIGHT = 724;
export const ZURI_EMOTE_SHEET_WIDTH = 2170;
export const ZURI_EMOTE_SHEET_HEIGHT = 725;
export const ZURI_CANONICAL_HEIGHT = 214;

export const ZURI_DRONES_SHEET_WIDTH = 2172;
export const ZURI_DRONES_SHEET_HEIGHT = 724;

export const ZURI_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeDarkBackground: true,
  saturationScale: 0.8,
  crimsonDampen: 0.25,
  unmixDarkHoloGlass: true,
};

export const ZURI_DRONES_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 28,
  defringeStrength: 0.72,
  saturationScale: 0.85,
  crimsonDampen: 0.16,
};

export const ZURI_COMBAT_FRAMES: readonly HeroFrameDef[] = [
  // Row 0 (indices 0..7): PAIN — Thruster turbulence, electric shock & aerial recovery (torso-centroid locked anchorX)
  { id: 'zuri_r0_f0', row: 0, col: 0, x: 140, y: 2, w: 216, h: 237, anchorX: 95, bottomY: 235, rowScale: 0.903, sheet: 'combat' },
  { id: 'zuri_r0_f1', row: 0, col: 1, x: 375, y: 2, w: 231, h: 237, anchorX: 118, bottomY: 235, rowScale: 0.903, sheet: 'combat' },
  { id: 'zuri_r0_f2', row: 0, col: 2, x: 612, y: 2, w: 244, h: 237, anchorX: 133, bottomY: 235, rowScale: 0.903, sheet: 'combat' },
  { id: 'zuri_r0_f3', row: 0, col: 3, x: 856, y: 2, w: 255, h: 237, anchorX: 140, bottomY: 235, rowScale: 0.903, sheet: 'combat' },
  {
    id: 'zuri_r0_f4',
    row: 0,
    col: 4,
    x: 1095,
    y: 2,
    w: 286,
    h: 237,
    anchorX: 149,
    bottomY: 235,
    rowScale: 0.903,
    sheet: 'combat',
    excludeRects: [{ x: 0, y: 0, w: 12, h: 48 }],
  },
  { id: 'zuri_r0_f5', row: 0, col: 5, x: 1380, y: 5, w: 256, h: 234, anchorX: 115, bottomY: 232, rowScale: 0.903, sheet: 'combat' },
  { id: 'zuri_r0_f6', row: 0, col: 6, x: 1645, y: 2, w: 241, h: 237, anchorX: 107, bottomY: 235, rowScale: 0.903, sheet: 'combat' },
  { id: 'zuri_r0_f7', row: 0, col: 7, x: 1915, y: 2, w: 231, h: 237, anchorX: 110, bottomY: 235, rowScale: 0.903, sheet: 'combat' },

  // Row 1 (indices 8..15): IDLE — Hovering on twin leg thrusters with holographic controller (torso-centroid locked anchorX)
  { id: 'zuri_r1_f0', row: 1, col: 0, x: 140, y: 244, w: 216, h: 237, anchorX: 94, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 108, dy: -162 } },
  { id: 'zuri_r1_f1', row: 1, col: 1, x: 375, y: 244, w: 231, h: 237, anchorX: 114, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 110, dy: -164 } },
  { id: 'zuri_r1_f2', row: 1, col: 2, x: 612, y: 244, w: 244, h: 237, anchorX: 132, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 108, dy: -164 } },
  { id: 'zuri_r1_f3', row: 1, col: 3, x: 856, y: 244, w: 255, h: 237, anchorX: 141, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 108, dy: -164 } },
  {
    id: 'zuri_r1_f4',
    row: 1,
    col: 4,
    x: 1095,
    y: 244,
    w: 286,
    h: 237,
    anchorX: 155,
    bottomY: 235,
    rowScale: 0.903,
    sheet: 'combat',
    excludeRects: [{ x: 0, y: 0, w: 10, h: 42 }],
    muzzleRel: { dx: 118, dy: -158 },
  },
  { id: 'zuri_r1_f5', row: 1, col: 5, x: 1380, y: 244, w: 256, h: 237, anchorX: 127, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 108, dy: -162 } },
  { id: 'zuri_r1_f6', row: 1, col: 6, x: 1645, y: 244, w: 241, h: 237, anchorX: 122, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 108, dy: -164 } },
  { id: 'zuri_r1_f7', row: 1, col: 7, x: 1915, y: 244, w: 231, h: 237, anchorX: 114, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 106, dy: -164 } },

  // Row 2 (indices 16..23): COMMANDING — Holographic tactical gestures & drone swarm dispatch (torso-centroid locked anchorX)
  { id: 'zuri_r2_f0', row: 2, col: 0, x: 140, y: 486, w: 216, h: 237, anchorX: 93, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 114, dy: -162 } },
  { id: 'zuri_r2_f1', row: 2, col: 1, x: 377, y: 486, w: 229, h: 237, anchorX: 107, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 118, dy: -162 } },
  { id: 'zuri_r2_f2', row: 2, col: 2, x: 614, y: 486, w: 224, h: 237, anchorX: 103, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 118, dy: -164 } },
  {
    id: 'zuri_r2_f3',
    row: 2,
    col: 3,
    x: 857,
    y: 486,
    w: 254,
    h: 237,
    anchorX: 103,
    bottomY: 235,
    rowScale: 0.903,
    sheet: 'combat',
    excludeRects: [{ x: 238, y: 36, w: 16, h: 201 }],
    muzzleRel: { dx: 145, dy: -164 },
    kickTipRel: { dx: 155, dy: -164 },
  },
  {
    id: 'zuri_r2_f4',
    row: 2,
    col: 4,
    x: 1095,
    y: 486,
    w: 288,
    h: 237,
    anchorX: 123,
    bottomY: 235,
    rowScale: 0.903,
    sheet: 'combat',
    excludeRects: [
      { x: 0, y: 0, w: 8, h: 38 },
      { x: 274, y: 36, w: 14, h: 201 },
    ],
    muzzleRel: { dx: 162, dy: -168 },
    kickTipRel: { dx: 172, dy: -168 },
  },
  {
    id: 'zuri_r2_f5',
    row: 2,
    col: 5,
    x: 1376,
    y: 486,
    w: 260,
    h: 237,
    anchorX: 110,
    bottomY: 235,
    rowScale: 0.903,
    sheet: 'combat',
    excludeRects: [{ x: 0, y: 0, w: 10, h: 36 }],
    muzzleRel: { dx: 142, dy: -166 },
    kickTipRel: { dx: 152, dy: -166 },
  },
  { id: 'zuri_r2_f6', row: 2, col: 6, x: 1645, y: 486, w: 241, h: 237, anchorX: 105, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 118, dy: -162 } },
  { id: 'zuri_r2_f7', row: 2, col: 7, x: 1915, y: 486, w: 231, h: 237, anchorX: 98, bottomY: 235, rowScale: 0.903, sheet: 'combat', muzzleRel: { dx: 114, dy: -162 } },
];

export const ZURI_EMOTE_FRAMES: readonly HeroFrameDef[] = [
  // Row 3 (Emote Sheet Row 0, indices 24..32): DEATH — Thruster stall, kneel & prone collapse on deck
  {
    id: 'zuri_r3_f0',
    row: 3,
    col: 0,
    x: 138,
    y: 4,
    w: 172,
    h: 225,
    anchorX: 82,
    bottomY: 214,
    rowScale: 0.965,
    sheet: 'emote',
    excludeRects: [{ x: 0, y: 55, w: 3, h: 125 }],
  },
  { id: 'zuri_r3_f1', row: 3, col: 1, x: 327, y: 11, w: 185, h: 220, anchorX: 88, bottomY: 210, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f2', row: 3, col: 2, x: 520, y: 27, w: 190, h: 196, anchorX: 92, bottomY: 190, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f3', row: 3, col: 3, x: 728, y: 38, w: 176, h: 193, anchorX: 92, bottomY: 188, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f4', row: 3, col: 4, x: 913, y: 54, w: 191, h: 177, anchorX: 112, bottomY: 174, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f5', row: 3, col: 5, x: 1113, y: 69, w: 211, h: 162, anchorX: 126, bottomY: 159, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f6', row: 3, col: 6, x: 1329, y: 87, w: 246, h: 144, anchorX: 130, bottomY: 142, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f7', row: 3, col: 7, x: 1579, y: 87, w: 264, h: 144, anchorX: 148, bottomY: 142, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r3_f8', row: 3, col: 8, x: 1843, y: 80, w: 317, h: 151, anchorX: 168, bottomY: 149, rowScale: 0.965, sheet: 'emote' },

  // Row 4 (Emote Sheet Row 1, indices 33..42): VICTORY — Thruster launch, mid-air backflip & superhero landing celebration
  { id: 'zuri_r4_f0', row: 4, col: 0, x: 141, y: 241, w: 153, h: 229, anchorX: 79, bottomY: 218, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f1', row: 4, col: 1, x: 313, y: 286, w: 173, h: 184, anchorX: 90, bottomY: 180, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f2', row: 4, col: 2, x: 496, y: 261, w: 212, h: 209, anchorX: 103, bottomY: 204, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f3', row: 4, col: 3, x: 708, y: 242, w: 205, h: 215, anchorX: 112, bottomY: 210, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f4', row: 4, col: 4, x: 918, y: 241, w: 208, h: 218, anchorX: 103, bottomY: 212, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f5', row: 4, col: 5, x: 1132, y: 241, w: 178, h: 194, anchorX: 93, bottomY: 190, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f6', row: 4, col: 6, x: 1329, y: 256, w: 199, h: 203, anchorX: 109, bottomY: 198, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f7', row: 4, col: 7, x: 1535, y: 255, w: 195, h: 208, anchorX: 100, bottomY: 203, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f8', row: 4, col: 8, x: 1730, y: 251, w: 201, h: 219, anchorX: 108, bottomY: 213, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r4_f9', row: 4, col: 9, x: 1932, y: 248, w: 218, h: 222, anchorX: 115, bottomY: 216, rowScale: 0.965, sheet: 'emote' },

  // Row 5 (Emote Sheet Row 2, indices 43..52): DEFEND — Holographic hex energy barrier deployment & impact brace (torso-centroid locked anchorX & altitude-matched bottomY!)
  { id: 'zuri_r5_f0', row: 5, col: 0, x: 143, y: 489, w: 182, h: 224, anchorX: 78, bottomY: 212, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r5_f1', row: 5, col: 1, x: 345, y: 489, w: 185, h: 224, anchorX: 79, bottomY: 212, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r5_f2', row: 5, col: 2, x: 541, y: 488, w: 193, h: 225, anchorX: 79, bottomY: 213, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r5_f3', row: 5, col: 3, x: 747, y: 485, w: 201, h: 227, anchorX: 78, bottomY: 214, rowScale: 0.965, sheet: 'emote' },
  {
    id: 'zuri_r5_f4',
    row: 5,
    col: 4,
    x: 948,
    y: 480,
    w: 212,
    h: 233,
    anchorX: 80,
    bottomY: 218,
    rowScale: 0.965,
    sheet: 'emote',
    excludeRects: [{ x: 209, y: 205, w: 3, h: 28 }],
  },
  {
    id: 'zuri_r5_f5',
    row: 5,
    col: 5,
    x: 1160,
    y: 480,
    w: 205,
    h: 232,
    anchorX: 77,
    bottomY: 217,
    rowScale: 0.965,
    sheet: 'emote',
    excludeRects: [{ x: 0, y: 95, w: 3, h: 55 }],
  },
  {
    id: 'zuri_r5_f6',
    row: 5,
    col: 6,
    x: 1365,
    y: 480,
    w: 200,
    h: 233,
    anchorX: 77,
    bottomY: 218,
    rowScale: 0.965,
    sheet: 'emote',
    excludeRects: [{ x: 0, y: 0, w: 10, h: 70 }],
  },
  {
    id: 'zuri_r5_f7',
    row: 5,
    col: 7,
    x: 1565,
    y: 484,
    w: 197,
    h: 227,
    anchorX: 74,
    bottomY: 214,
    rowScale: 0.965,
    sheet: 'emote',
    excludeRects: [{ x: 0, y: 0, w: 9, h: 70 }],
  },
  { id: 'zuri_r5_f8', row: 5, col: 8, x: 1766, y: 495, w: 198, h: 218, anchorX: 80, bottomY: 209, rowScale: 0.965, sheet: 'emote' },
  { id: 'zuri_r5_f9', row: 5, col: 9, x: 1979, y: 492, w: 172, h: 221, anchorX: 76, bottomY: 211, rowScale: 0.965, sheet: 'emote' },
];

export const ZURI_SHEET_FRAMES: readonly HeroFrameDef[] = [
  ...ZURI_COMBAT_FRAMES,
  ...ZURI_EMOTE_FRAMES,
];

const ZURI_HOVER_PINGPONG = [8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9] as const;

// Idle 1: Smooth aerial scan sweep across all 8 hover poses
const ZURI_IDLE1_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 8, until: 0.14, xProgress: 0, yHopPx: -26 },
  { frameIndex: 9, until: 0.28, xProgress: 0, yHopPx: -34 },
  { frameIndex: 10, until: 0.42, xProgress: 0, yHopPx: -42 },
  { frameIndex: 11, until: 0.56, xProgress: 0, yHopPx: -44 },
  { frameIndex: 12, until: 0.70, xProgress: 0, yHopPx: -32 },
  { frameIndex: 13, until: 0.84, xProgress: 0, yHopPx: -18 },
  { frameIndex: 14, until: 0.98, xProgress: 0, yHopPx: -16 },
  { frameIndex: 15, until: 1.12, xProgress: 0, yHopPx: -24 },
  { frameIndex: 8, until: 1.24, xProgress: 0, yHopPx: -28 },
];

// Idle 2: Fluid tactical hologram check gesture across full commanding row
const ZURI_IDLE2_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.14, xProgress: 0, yHopPx: -28 },
  { frameIndex: 17, until: 0.28, xProgress: 0.008, yHopPx: -40 },
  { frameIndex: 18, until: 0.44, xProgress: 0.015, yHopPx: -48 },
  { frameIndex: 21, until: 0.62, xProgress: 0.015, yHopPx: -30 },
  { frameIndex: 22, until: 0.78, xProgress: 0.008, yHopPx: -18 },
  { frameIndex: 23, until: 0.92, xProgress: 0, yHopPx: -24 },
  { frameIndex: 8, until: 1.04, xProgress: 0, yHopPx: -28 },
];

// Shoot (Attack): Zuri ascends smoothly on twin thrusters, dispatches Strike Drone at apex, and glides gracefully back
const ZURI_SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.07, xProgress: 0.008, yHopPx: -30 },
  { frameIndex: 17, until: 0.15, xProgress: 0.018, yHopPx: -54 },
  { frameIndex: 18, until: 0.23, xProgress: 0.028, yHopPx: -78 },
  { frameIndex: 19, until: 0.32, xProgress: 0.036, yHopPx: -90 },
  { frameIndex: 20, until: 0.42, xProgress: 0.038, yHopPx: -66 },
  { frameIndex: 21, until: 0.51, xProgress: 0.026, yHopPx: -34 },
  { frameIndex: 22, until: 0.59, xProgress: 0.014, yHopPx: -16 },
  { frameIndex: 23, until: 0.66, xProgress: 0.005, yHopPx: -22 },
  { frameIndex: 8, until: 0.72, xProgress: 0, yHopPx: -28 },
];

// Dash Kick (Heavy Attack): Zuri soars cleanly into high aerial command posture and swoops downward in sync with Strike Jet dive
const ZURI_DASH_KICK_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.07, xProgress: 0.01, yHopPx: -32 },
  { frameIndex: 17, until: 0.15, xProgress: 0.024, yHopPx: -64 },
  { frameIndex: 18, until: 0.24, xProgress: 0.04, yHopPx: -96 },
  { frameIndex: 19, until: 0.34, xProgress: 0.052, yHopPx: -108 },
  { frameIndex: 20, until: 0.46, xProgress: 0.055, yHopPx: -58 },
  { frameIndex: 21, until: 0.57, xProgress: 0.04, yHopPx: -14 },
  { frameIndex: 22, until: 0.68, xProgress: 0.022, yHopPx: -20 },
  { frameIndex: 23, until: 0.78, xProgress: 0.008, yHopPx: -42 },
  { frameIndex: 8, until: 0.86, xProgress: 0, yHopPx: -28 },
];

// Overdrive (Tri-Drone Swarm Command): Double-peak aerial hover wave while all 3 drones blitz the arena
const ZURI_OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.07, xProgress: 0.012, yHopPx: -34 },
  { frameIndex: 17, until: 0.15, xProgress: 0.028, yHopPx: -72 },
  { frameIndex: 18, until: 0.23, xProgress: 0.046, yHopPx: -104 },
  { frameIndex: 19, until: 0.32, xProgress: 0.058, yHopPx: -112 },
  { frameIndex: 20, until: 0.42, xProgress: 0.06, yHopPx: -62 },
  { frameIndex: 21, until: 0.51, xProgress: 0.046, yHopPx: -20 },
  { frameIndex: 18, until: 0.60, xProgress: 0.048, yHopPx: -68 },
  { frameIndex: 19, until: 0.70, xProgress: 0.055, yHopPx: -98 },
  { frameIndex: 20, until: 0.80, xProgress: 0.052, yHopPx: -54 },
  { frameIndex: 21, until: 0.89, xProgress: 0.032, yHopPx: -16 },
  { frameIndex: 22, until: 0.96, xProgress: 0.015, yHopPx: -24 },
  { frameIndex: 23, until: 1.02, xProgress: 0.004, yHopPx: -32 },
  { frameIndex: 8, until: 1.08, xProgress: 0, yHopPx: -28 },
];

// Guard (Defense): Smooth full-sequence hex shield deployment with cohesive thruster boost arc
const ZURI_GUARD_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 43, until: 0.07, xProgress: 0, yHopPx: -24 },
  { frameIndex: 44, until: 0.14, xProgress: 0.008, yHopPx: -48 },
  { frameIndex: 45, until: 0.22, xProgress: 0.016, yHopPx: -76 },
  { frameIndex: 46, until: 0.30, xProgress: 0.02, yHopPx: -82 },
  { frameIndex: 47, until: 0.39, xProgress: 0.018, yHopPx: -56 },
  { frameIndex: 48, until: 0.47, xProgress: 0.012, yHopPx: -24 },
  { frameIndex: 49, until: 0.55, xProgress: 0.008, yHopPx: -16 },
  { frameIndex: 50, until: 0.63, xProgress: 0.004, yHopPx: -22 },
  { frameIndex: 51, until: 0.70, xProgress: 0, yHopPx: -30 },
  { frameIndex: 52, until: 0.77, xProgress: 0, yHopPx: -28 },
];

// Upgrade (TECH): Flowing aerial arc while Bio-Med Quad-Rotor Drone deploys nanite repair beams
const ZURI_UPGRADE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.09, xProgress: 0, yHopPx: -30 },
  { frameIndex: 17, until: 0.19, xProgress: 0.012, yHopPx: -58 },
  { frameIndex: 18, until: 0.30, xProgress: 0.022, yHopPx: -86 },
  { frameIndex: 19, until: 0.42, xProgress: 0.026, yHopPx: -92 },
  { frameIndex: 20, until: 0.53, xProgress: 0.022, yHopPx: -54 },
  { frameIndex: 21, until: 0.64, xProgress: 0.015, yHopPx: -18 },
  { frameIndex: 22, until: 0.74, xProgress: 0.008, yHopPx: -22 },
  { frameIndex: 23, until: 0.83, xProgress: 0, yHopPx: -36 },
  { frameIndex: 8, until: 0.90, xProgress: 0, yHopPx: -28 },
];

// Hit (Normal): Sequential thruster shock turbulence & clean aerial stabilization
const ZURI_HIT_NORMAL_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 0, until: 0.07, xProgress: -0.02, yHopPx: -22 },
  { frameIndex: 1, until: 0.14, xProgress: -0.042, yHopPx: -48 },
  { frameIndex: 2, until: 0.22, xProgress: -0.055, yHopPx: -52 },
  { frameIndex: 3, until: 0.30, xProgress: -0.048, yHopPx: -20 },
  { frameIndex: 5, until: 0.38, xProgress: -0.028, yHopPx: -12 },
  { frameIndex: 6, until: 0.45, xProgress: -0.012, yHopPx: -22 },
  { frameIndex: 7, until: 0.52, xProgress: 0, yHopPx: -28 },
];

// Hit (Low HP): Full 8-frame electric shock recoil & recovery
const ZURI_HIT_LOW_HP_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 0, until: 0.07, xProgress: -0.022, yHopPx: -20 },
  { frameIndex: 1, until: 0.14, xProgress: -0.048, yHopPx: -54 },
  { frameIndex: 2, until: 0.22, xProgress: -0.068, yHopPx: -58 },
  { frameIndex: 3, until: 0.30, xProgress: -0.07, yHopPx: -24 },
  { frameIndex: 4, until: 0.38, xProgress: -0.052, yHopPx: -8 },
  { frameIndex: 5, until: 0.46, xProgress: -0.032, yHopPx: -18 },
  { frameIndex: 6, until: 0.54, xProgress: -0.014, yHopPx: -28 },
  { frameIndex: 7, until: 0.62, xProgress: 0, yHopPx: -28 },
];

// Defeat (DEATH): Smooth thruster sputter -> knee drop -> prone collapse flush on deck
const ZURI_DEFEAT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 24, until: 0.11, xProgress: -0.01, yHopPx: -24 },
  { frameIndex: 25, until: 0.23, xProgress: -0.024, yHopPx: -36 },
  { frameIndex: 26, until: 0.36, xProgress: -0.038, yHopPx: -16 },
  { frameIndex: 27, until: 0.50, xProgress: -0.042, yHopPx: 0 },
  { frameIndex: 28, until: 0.65, xProgress: -0.038, yHopPx: 0 },
  { frameIndex: 29, until: 0.80, xProgress: -0.032, yHopPx: 0 },
  { frameIndex: 30, until: 0.96, xProgress: -0.028, yHopPx: 0 },
  { frameIndex: 31, until: 1.12, xProgress: -0.024, yHopPx: 0 },
  { frameIndex: 32, until: 1.28, xProgress: -0.02, yHopPx: 0 },
];

// Victory (VICTORY): Silky thruster crouch -> launch -> parabolic mid-air backflip -> landing -> celebratory hover
const ZURI_VICTORY_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 33, until: 0.10, xProgress: 0, yHopPx: -24 },
  { frameIndex: 34, until: 0.21, xProgress: 0.006, yHopPx: -4 },
  { frameIndex: 35, until: 0.33, xProgress: 0.015, yHopPx: -58 },
  { frameIndex: 36, until: 0.45, xProgress: 0.024, yHopPx: -98 },
  { frameIndex: 37, until: 0.57, xProgress: 0.03, yHopPx: -118 },
  { frameIndex: 38, until: 0.69, xProgress: 0.03, yHopPx: -122 },
  { frameIndex: 39, until: 0.81, xProgress: 0.024, yHopPx: -74 },
  { frameIndex: 40, until: 0.93, xProgress: 0.018, yHopPx: -34 },
  { frameIndex: 41, until: 1.07, xProgress: 0.015, yHopPx: -2 },
  { frameIndex: 42, until: 1.26, xProgress: 0.015, yHopPx: -28 },
];

const ZURI_MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.24,
  idle2: 1.04,
  shoot: 0.72,
  dash_kick: 0.86,
  overdrive: 1.08,
  guard: 0.77,
  dodge: 0.77,
  upgrade: 0.90,
  hit: 0.52,
  defeat: 1.28,
  victory: 1.26,
};

const ZURI_HOVER_ATTACK_FRAMES = [17, 18, 19, 18] as const;
const ZURI_HOVER_DEFENSE_FRAMES = [45, 46, 47, 46] as const;
const ZURI_HOVER_TECH_FRAMES = [21, 22, 23, 22] as const;

const sampleSequence = (seq: readonly SequenceKeyframe[], elapsed: number) =>
  sampleBaseSequence(seq, elapsed, -28);

function sampleZuriAmbientIdleFrame(
  totalTime: number,
  hoveredColor: TileType | null,
): { frameIndex: number; yHopPx: number } {
  const flightWave = Math.sin(totalTime * 2.15) * 12 + Math.cos(totalTime * 1.15) * 4.5;
  const baseHoverY = -30 + flightWave;
  const hoverStep = Math.floor(totalTime * 3.2) % 4;

  if (hoveredColor === 'attack') {
    return { frameIndex: ZURI_HOVER_ATTACK_FRAMES[hoverStep], yHopPx: baseHoverY };
  }
  if (hoveredColor === 'defense') {
    return { frameIndex: ZURI_HOVER_DEFENSE_FRAMES[hoverStep], yHopPx: baseHoverY };
  }
  if (hoveredColor === 'tech') {
    return { frameIndex: ZURI_HOVER_TECH_FRAMES[hoverStep], yHopPx: baseHoverY };
  }

  const cycle = ((totalTime % 11.2) + 11.2) % 11.2;
  if (cycle >= 2.6 && cycle < 3.84) {
    const s = sampleSequence(ZURI_IDLE1_SEQ, cycle - 2.6);
    return { frameIndex: s.frameIndex, yHopPx: baseHoverY * 0.65 + s.yHopPx * 0.35 };
  }
  if (cycle >= 7.2 && cycle < 8.24) {
    const s = sampleSequence(ZURI_IDLE2_SEQ, cycle - 7.2);
    return { frameIndex: s.frameIndex, yHopPx: baseHoverY * 0.65 + s.yHopPx * 0.35 };
  }
  // Smooth ping-pong across all 8 IDLE hover frames (8..15..8) at ~6.6 fps with zero loop snap
  const pingPongStep = Math.floor(totalTime * 6.6) % ZURI_HOVER_PINGPONG.length;
  return { frameIndex: ZURI_HOVER_PINGPONG[pingPongStep], yHopPx: baseHoverY };
}

export function triggerZuriAnimation(
  prev: HeroAnimState,
  mode: HeroAnimMode,
  options?: { lowHpHit?: boolean },
): HeroAnimState {
  if (prev.mode === 'defeat' && mode === 'defeat') {
    return prev;
  }
  const lowHpHit = Boolean(options?.lowHpHit);
  const duration = mode === 'hit' && lowHpHit ? 0.62 : ZURI_MODE_DURATIONS[mode];
  const currentFrame = Math.min(ZURI_SHEET_FRAMES.length - 1, prev.lastFrameIndex ?? 8);
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

export function stepZuriAnimState(
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
    state = triggerZuriAnimation(state, 'defeat');
  } else if (!context.isDead && state.mode === 'defeat') {
    state = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: 8,
      prevFrameIndex: 8,
    };
  }

  if (state.mode === 'idle') {
    if (context.isVictory) {
      state = triggerZuriAnimation(state, 'victory');
    } else {
      const { frameIndex, yHopPx } = sampleZuriAmbientIdleFrame(
        context.totalTime,
        context.hoveredColor,
      );
      const trans = computeFrameTransitionState(state, frameIndex, dt);
      const nextIdleState: HeroAnimState = {
        ...state,
        lastFrameIndex: trans.lastFrameIndex,
        prevFrameIndex: trans.prevFrameIndex,
        frameBlendElapsed: trans.frameBlendElapsed,
      };
      const breathWave = Math.sin(context.totalTime * 2.4);
      const breathScaleY = 1 + breathWave * 0.011;
      const breathScaleX = 1 - breathWave * 0.005;
      const idleSwayTilt = Math.sin(context.totalTime * 1.9) * 0.016;
      return {
        state: nextIdleState,
        frameIndex,
        frame: ZURI_SHEET_FRAMES[frameIndex],
        prevFrameIndex: trans.prevFrameIndex,
        prevFrame: ZURI_SHEET_FRAMES[trans.prevFrameIndex],
        frameBlendAlpha: trans.frameBlendAlpha,
        xProgress: 0,
        yHopPx,
        breathScaleY,
        breathScaleX,
        tiltRad: idleSwayTilt,
        shouldEmitShot: false,
        shouldEmitKickImpact: false,
        isDashing: false,
      };
    }
  }

  if (
    (state.mode === 'idle1' || state.mode === 'idle2') &&
    (context.hoveredColor !== null || context.isVictory)
  ) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: Math.min(ZURI_SHEET_FRAMES.length - 1, state.lastFrameIndex ?? 8),
      prevFrameIndex: Math.min(ZURI_SHEET_FRAMES.length - 1, state.prevFrameIndex ?? 8),
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepZuriAnimState(idleState, dt, context);
  }

  const nextElapsed = state.elapsed + dt;

  if (state.mode !== 'defeat' && state.mode !== 'victory' && nextElapsed >= state.duration) {
    const idleState: HeroAnimState = {
      ...createInitialHeroAnimState(),
      lastFrameIndex: Math.min(ZURI_SHEET_FRAMES.length - 1, state.lastFrameIndex ?? 8),
      prevFrameIndex: Math.min(ZURI_SHEET_FRAMES.length - 1, state.prevFrameIndex ?? 8),
      frameBlendElapsed: state.frameBlendElapsed ?? 0,
    };
    return stepZuriAnimState(idleState, 0, context);
  }

  const clampedElapsed = Math.min(nextElapsed, state.duration);
  let seq: readonly SequenceKeyframe[] = ZURI_SHOOT_SEQ;
  if (state.mode === 'idle1') seq = ZURI_IDLE1_SEQ;
  else if (state.mode === 'idle2') seq = ZURI_IDLE2_SEQ;
  else if (state.mode === 'dash_kick') seq = ZURI_DASH_KICK_SEQ;
  else if (state.mode === 'overdrive') seq = ZURI_OVERDRIVE_SEQ;
  else if (state.mode === 'guard' || state.mode === 'dodge') seq = ZURI_GUARD_SEQ;
  else if (state.mode === 'upgrade') seq = ZURI_UPGRADE_SEQ;
  else if (state.mode === 'hit') seq = state.lowHpHit ? ZURI_HIT_LOW_HP_SEQ : ZURI_HIT_NORMAL_SEQ;
  else if (state.mode === 'defeat') seq = ZURI_DEFEAT_SEQ;
  else if (state.mode === 'victory') seq = ZURI_VICTORY_SEQ;

  const sampled = sampleSequence(seq, clampedElapsed);

  let emittedKickImpact = state.emittedKickImpact;
  let shouldEmitKickImpact = false;
  if (
    (state.mode === 'dash_kick' || state.mode === 'overdrive') &&
    sampled.frameIndex === 20 &&
    !emittedKickImpact
  ) {
    emittedKickImpact = true;
    shouldEmitKickImpact = true;
  }

  let emittedShots = state.emittedShots;
  let shouldEmitShot = false;
  if (state.mode === 'shoot') {
    if (sampled.frameIndex === 19 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    } else if (sampled.frameIndex === 20 && emittedShots < 2) {
      emittedShots = 2;
      shouldEmitShot = true;
    }
  } else if (state.mode === 'overdrive' && emittedKickImpact) {
    if (sampled.frameIndex === 19 && emittedShots < 1) {
      emittedShots = 1;
      shouldEmitShot = true;
    } else if (sampled.frameIndex === 20 && emittedShots === 1) {
      emittedShots = 2;
      shouldEmitShot = true;
    }
  }

  const trans = computeFrameTransitionState(state, sampled.frameIndex, dt);

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
  // Subtle banking tilt driven smoothly by vertical flight velocity vy
  let tiltRad = Math.max(-0.048, Math.min(0.048, -sampled.vy * 0.00014));

  if (state.mode === 'victory' && clampedElapsed >= state.duration) {
    const w = Math.sin(context.totalTime * 2.5);
    breathScaleY = 1 + w * 0.011;
    breathScaleX = 1 - w * 0.005;
  } else if (sampled.frameIndex === 20) {
    // Full command surge pose
    breathScaleY = 1.016;
    breathScaleX = 0.992;
    tiltRad += 0.02;
  }

  // In victory loop after completion, keep flying up and down smoothly
  const finalYHopPx =
    state.mode === 'victory' && clampedElapsed >= state.duration
      ? -34 + Math.sin(context.totalTime * 2.6) * 14
      : sampled.yHopPx;

  return {
    state: nextState,
    frameIndex: sampled.frameIndex,
    frame: ZURI_SHEET_FRAMES[sampled.frameIndex],
    prevFrameIndex: trans.prevFrameIndex,
    prevFrame: ZURI_SHEET_FRAMES[trans.prevFrameIndex],
    frameBlendAlpha: trans.frameBlendAlpha,
    xProgress: sampled.xProgress,
    yHopPx: finalYHopPx,
    breathScaleY,
    breathScaleX,
    tiltRad,
    shouldEmitShot,
    shouldEmitKickImpact,
    isDashing: false,
  };
}
