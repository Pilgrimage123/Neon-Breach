import type { SpriteCutoutOptions, SpriteRect } from './spriteCutout';

export type MedBayOptionId =
  | 'heal'
  | 'calibrate_max_hp'
  | 'salvage_credits'
  | 'tile_overclock'
  | 'extract_bank';

export const NURSE_SHEET_WIDTH = 2170;
export const NURSE_SHEET_HEIGHT = 725;
export const NURSE_CANONICAL_HEIGHT = 604;

export const NURSE_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeDarkBackground: true,
  saturationScale: 0.9,
  crimsonDampen: 0.14,
};

export interface NurseFrameDef extends SpriteRect {
  id: string;
  col: number;
  anchorX: number;
  bottomY: number;
  poseTag: 'confident' | 'smile_tilt' | 'serene' | 'warm_laugh' | 'hair_touch' | 'hair_flip' | 'diagnostic' | 'syringe_ready';
}

export const NURSE_FRAMES: readonly NurseFrameDef[] = [
  {
    id: 'nurse_f0',
    col: 0,
    x: 3,
    y: 78,
    w: 273,
    h: 610,
    anchorX: 147,
    bottomY: 604,
    poseTag: 'confident',
  },
  {
    id: 'nurse_f1',
    col: 1,
    x: 279,
    y: 78,
    w: 265,
    h: 610,
    anchorX: 145,
    bottomY: 604,
    poseTag: 'smile_tilt',
  },
  {
    id: 'nurse_f2',
    col: 2,
    x: 554,
    y: 78,
    w: 259,
    h: 610,
    anchorX: 141,
    bottomY: 604,
    poseTag: 'serene',
  },
  {
    id: 'nurse_f3',
    col: 3,
    x: 814,
    y: 78,
    w: 273,
    h: 610,
    anchorX: 149,
    bottomY: 604,
    poseTag: 'warm_laugh',
  },
  {
    id: 'nurse_f4',
    col: 4,
    x: 1088,
    y: 78,
    w: 261,
    h: 610,
    anchorX: 144,
    bottomY: 604,
    poseTag: 'hair_touch',
  },
  {
    id: 'nurse_f5',
    col: 5,
    x: 1350,
    y: 78,
    w: 271,
    h: 610,
    anchorX: 148,
    bottomY: 604,
    poseTag: 'hair_flip',
  },
  {
    id: 'nurse_f6',
    col: 6,
    x: 1622,
    y: 78,
    w: 270,
    h: 610,
    anchorX: 143,
    bottomY: 604,
    poseTag: 'diagnostic',
  },
  {
    id: 'nurse_f7',
    col: 7,
    x: 1893,
    y: 78,
    w: 270,
    h: 610,
    anchorX: 143,
    bottomY: 604,
    poseTag: 'syringe_ready',
  },
];

const NURSE_IDLE_PINGPONG = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1] as const;
const NURSE_CRITICAL_HP_SEQ = [6, 7, 6, 1, 0, 6, 7, 7] as const;

const NURSE_ACTION_SEQUENCES: Record<MedBayOptionId, readonly number[]> = {
  heal: [7, 6, 0, 1, 2, 1, 7],
  calibrate_max_hp: [6, 7, 0, 1, 6],
  salvage_credits: [4, 5, 3, 2, 4],
  tile_overclock: [7, 5, 4, 6, 7],
  extract_bank: [2, 3, 1, 0, 2],
};

export interface NursePoseKinematics {
  headTiltRad: number;
  headYPx: number;
  syringeDxPx: number;
  syringeDyPx: number;
  activeLimbX: number;
  activeLimbY: number;
}

export const NURSE_POSE_KINEMATICS: readonly NursePoseKinematics[] = [
  { headTiltRad: 0.0, headYPx: 0, syringeDxPx: 0, syringeDyPx: 0, activeLimbX: 65, activeLimbY: 340 },
  { headTiltRad: 0.015, headYPx: 1.2, syringeDxPx: 1.5, syringeDyPx: 1.0, activeLimbX: 68, activeLimbY: 342 },
  { headTiltRad: 0.024, headYPx: 2.0, syringeDxPx: -1.0, syringeDyPx: 1.8, activeLimbX: 70, activeLimbY: 345 },
  { headTiltRad: 0.032, headYPx: 2.2, syringeDxPx: 2.0, syringeDyPx: 2.0, activeLimbX: 72, activeLimbY: 348 },
  { headTiltRad: 0.012, headYPx: 1.0, syringeDxPx: 0.5, syringeDyPx: 0.5, activeLimbX: 78, activeLimbY: 180 },
  { headTiltRad: -0.015, headYPx: 0.2, syringeDxPx: -1.2, syringeDyPx: 0.2, activeLimbX: 82, activeLimbY: 175 },
  { headTiltRad: -0.022, headYPx: 1.0, syringeDxPx: 3.0, syringeDyPx: 3.5, activeLimbX: 62, activeLimbY: 350 },
  { headTiltRad: 0.005, headYPx: 0.0, syringeDxPx: 4.0, syringeDyPx: -2.0, activeLimbX: 64, activeLimbY: 340 },
];

export interface NurseTrajectoryWarp {
  prevWarpX: number;
  prevWarpY: number;
  prevWarpRot: number;
  currWarpX: number;
  currWarpY: number;
  currWarpRot: number;
  fromLimbX: number;
  fromLimbY: number;
  toLimbX: number;
  toLimbY: number;
  limbTravelDist: number;
}

export function getNurseTrajectoryWarp(fromIdx: number, toIdx: number, t: number): NurseTrajectoryWarp {
  const from = NURSE_POSE_KINEMATICS[fromIdx] ?? NURSE_POSE_KINEMATICS[0];
  const to = NURSE_POSE_KINEMATICS[toIdx] ?? NURSE_POSE_KINEMATICS[0];

  const deltaX = to.syringeDxPx - from.syringeDxPx;
  const deltaY = to.headYPx - from.headYPx;
  const deltaRot = to.headTiltRad - from.headTiltRad;

  // prevFrame glides forward along motion vector by t
  const prevWarpX = deltaX * t;
  const prevWarpY = deltaY * t;
  const prevWarpRot = deltaRot * t;

  // currFrame glides into place from -(1 - t) along motion vector
  const currWarpX = -deltaX * (1 - t);
  const currWarpY = -deltaY * (1 - t);
  const currWarpRot = -deltaRot * (1 - t);

  const limbTravelDist = Math.hypot(to.activeLimbX - from.activeLimbX, to.activeLimbY - from.activeLimbY);

  return {
    prevWarpX,
    prevWarpY,
    prevWarpRot,
    currWarpX,
    currWarpY,
    currWarpRot,
    fromLimbX: from.activeLimbX,
    fromLimbY: from.activeLimbY,
    toLimbX: to.activeLimbX,
    toLimbY: to.activeLimbY,
    limbTravelDist,
  };
}

export interface NursePoseSample {
  frameIndex: number;
  prevFrameIndex: number;
  blendAlpha: number;
  frame: NurseFrameDef;
  prevFrame: NurseFrameDef;
  breathScaleX: number;
  breathScaleY: number;
  yOffsetPx: number;
  tiltRad: number;
  syringePulse: number;
  trajectoryWarp: NurseTrajectoryWarp;
  isStepChanged: boolean;
}

export function sampleNurseAnimation(params: {
  totalTime: number;
  focusedOption: MedBayOptionId | null;
  actionFlashTimer: number;
  hpRatio: number;
}): NursePoseSample {
  const { totalTime, focusedOption, actionFlashTimer, hpRatio } = params;
  const safeTime = Math.max(0, totalTime);

  let seq: readonly number[] = NURSE_IDLE_PINGPONG;
  let fps = 4.2;

  if (actionFlashTimer > 0) {
    seq = [7, 6, 3, 2, 1, 0];
    fps = 5.6;
  } else if (focusedOption) {
    seq = NURSE_ACTION_SEQUENCES[focusedOption];
    fps = 4.8;
  } else if (hpRatio <= 0.42) {
    seq = NURSE_CRITICAL_HP_SEQ;
    fps = 3.8;
  }

  const rawPos = safeTime * fps;
  const stepIdx = Math.floor(rawPos) % seq.length;
  const prevStepIdx = (stepIdx - 1 + seq.length) % seq.length;
  const frac = rawPos - Math.floor(rawPos);

  const frameIndex = seq[stepIdx];
  const prevFrameIndex = seq[prevStepIdx];

  // Continuous Hermite S-curve cross-blend (zero-jump boundaries)
  const blendAlpha = frameIndex === prevFrameIndex ? 1 : 0.5 - 0.5 * Math.cos(frac * Math.PI);

  const trajectoryWarp = getNurseTrajectoryWarp(prevFrameIndex, frameIndex, blendAlpha);
  const isStepChanged = frac < (1 / 60) * fps; // Triggered on initial transition frame

  const breathPhase = Math.sin(safeTime * 2.2);
  const breathScaleY = 1 + breathPhase * 0.012 + (actionFlashTimer > 0 ? 0.016 : 0);
  const breathScaleX = 1 - breathPhase * 0.006;
  const yOffsetPx = Math.sin(safeTime * 1.8) * 3 - (actionFlashTimer > 0 ? Math.sin(actionFlashTimer * Math.PI) * 7 : 0);
  const tiltRad = Math.sin(safeTime * 1.2) * 0.012;
  const syringePulse =
    0.55 +
    0.45 * Math.sin(safeTime * (focusedOption === 'heal' || focusedOption === 'tile_overclock' ? 8.0 : 4.0));

  return {
    frameIndex,
    prevFrameIndex,
    blendAlpha,
    frame: NURSE_FRAMES[frameIndex],
    prevFrame: NURSE_FRAMES[prevFrameIndex],
    breathScaleX,
    breathScaleY,
    yOffsetPx,
    tiltRad,
    syringePulse,
    trajectoryWarp,
    isStepChanged,
  };
}
