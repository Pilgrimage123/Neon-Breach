export interface JuiceControlPointKnot {
  dx: number;
  dy: number;
  rotRad: number;
  scaleX: number;
}

export interface JuiceMeshDeform {
  feet: JuiceControlPointKnot;
  pelvis: JuiceControlPointKnot;
  waist: JuiceControlPointKnot;
  head: JuiceControlPointKnot;
}

export interface SpringScaleState {
  springScaleX: number;
  springScaleY: number;
  springVelX: number;
  springVelY: number;
}

export interface HorizontalVelocityState {
  posX: number;
  velX: number;
  prevPosX: number;
}

export interface HorizontalFlipState {
  baseFacingSign: -1 | 1;
  currentFacingScale: number;
  flipActive: boolean;
  flipElapsed: number;
  flipStartSign: -1 | 1;
  flipTargetSign: -1 | 1;
  flipAutoReturn: boolean;
}

export function createNeutralMeshDeform(): JuiceMeshDeform {
  return {
    feet: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    pelvis: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    waist: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    head: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
  };
}

export function applySpringSquashImpulse(
  state: SpringScaleState,
  targetScaleX: number,
  targetScaleY: number,
  minScale: number,
  maxScale: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  state.springScaleX = Math.max(minScale, Math.min(maxScale, targetScaleX));
  state.springScaleY = Math.max(minScale, Math.min(maxScale, targetScaleY));
  state.springVelX += velImpulseX;
  state.springVelY += velImpulseY;
}

/** 2-sub-step symplectic Euler damped harmonic spring around (1, 1). */
export function stepSymplecticSpringScale(
  state: SpringScaleState,
  safeDt: number,
  stiffness: number,
  damping: number,
  minClamp: number,
  maxClamp: number,
): void {
  if (safeDt <= 0) return;
  const subDt = safeDt * 0.5;
  for (let step = 0; step < 2; step++) {
    const accX = -stiffness * (state.springScaleX - 1) - damping * state.springVelX;
    const accY = -stiffness * (state.springScaleY - 1) - damping * state.springVelY;
    state.springVelX += accX * subDt;
    state.springVelY += accY * subDt;
    state.springScaleX += state.springVelX * subDt;
    state.springScaleY += state.springVelY * subDt;
  }
  state.springScaleX = Math.max(minClamp, Math.min(maxClamp, state.springScaleX));
  state.springScaleY = Math.max(minClamp, Math.min(maxClamp, state.springScaleY));
}

export function startHorizontalFlip(state: HorizontalFlipState, autoReturn = true): void {
  state.flipActive = true;
  state.flipElapsed = 0;
  state.flipStartSign = state.baseFacingSign;
  state.flipTargetSign = (state.baseFacingSign === -1 ? 1 : -1) as -1 | 1;
  state.flipAutoReturn = autoReturn;
}

export interface HorizontalFlipStepResult {
  hopYPx: number;
  beganReturnFlip: boolean;
  completedFlip: boolean;
}

/** Smooth 2.5D Paper-Mario horizontal flip with clamped non-negative floor lift (never sinks below deck). */
export function stepHorizontalFlip(
  state: HorizontalFlipState,
  safeDt: number,
  flipDurationSec: number,
  minFlipDurationSec: number,
  flipHopHeightPx: number,
  returnPauseSec: number,
): HorizontalFlipStepResult {
  if (!state.flipActive) {
    state.currentFacingScale = state.baseFacingSign;
    return { hopYPx: 0, beganReturnFlip: false, completedFlip: false };
  }

  state.flipElapsed += safeDt;
  const flipDur = Math.max(minFlipDurationSec, flipDurationSec);
  const u = Math.max(0, Math.min(1, state.flipElapsed / flipDur));
  const cosInterp = 0.5 - 0.5 * Math.cos(u * Math.PI);
  state.currentFacingScale =
    state.flipStartSign + (state.flipTargetSign - state.flipStartSign) * cosInterp;
  if (Math.abs(state.currentFacingScale) < 0.04) {
    state.currentFacingScale = state.currentFacingScale >= 0 ? 0.04 : -0.04;
  }
  const hopLift = Math.max(0, Math.sin(u * Math.PI) * flipHopHeightPx);

  let beganReturnFlip = false;
  let completedFlip = false;
  if (u >= 1) {
    state.baseFacingSign = state.flipTargetSign;
    state.currentFacingScale = state.flipTargetSign;
    if (state.flipAutoReturn && state.flipTargetSign !== -1) {
      state.flipElapsed = -Math.abs(returnPauseSec);
      state.flipStartSign = state.flipTargetSign;
      state.flipTargetSign = -1;
      state.flipAutoReturn = false;
      beganReturnFlip = true;
    } else {
      state.flipActive = false;
      completedFlip = true;
    }
  }

  return {
    hopYPx: -hopLift,
    beganReturnFlip,
    completedFlip,
  };
}

export function stepHorizontalVelocityShear(
  state: HorizontalVelocityState,
  targetPosX: number,
  safeDt: number,
  posLerpRate: number,
  velocitySkewFactor: number,
  maxSkewPx: number,
): number {
  if (safeDt > 0) {
    const posLerp = Math.min(1, safeDt * posLerpRate);
    state.prevPosX = state.posX;
    state.posX += (targetPosX - state.posX) * posLerp;
    const rawVelX = (state.posX - state.prevPosX) / safeDt;
    state.velX += (rawVelX - state.velX) * Math.min(1, safeDt * 14);
  } else {
    state.posX = targetPosX;
  }
  return Math.max(-maxSkewPx, Math.min(maxSkewPx, state.velX * velocitySkewFactor));
}
