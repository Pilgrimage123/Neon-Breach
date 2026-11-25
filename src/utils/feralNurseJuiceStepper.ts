import {
  type FeralNurseBranchFrame,
  stepFeralNurseCombatSyncBranch,
  stepFeralNurseLabTriggerBranch,
} from './feralNurseJuiceBranches';
import {
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseCombatSyncInput,
  type FeralNurseJuiceConfig,
  type FeralNurseJuiceSample,
  type FeralNurseJuiceState,
  applyFeralNurseSquash,
  clamp01,
  neutralDeform,
} from './feralNurseJuiceState';

export function stepFeralNurseJuice(
  state: FeralNurseJuiceState,
  dtRaw: number,
  nowSec: number,
  config: FeralNurseJuiceConfig = DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  combatSync?: FeralNurseCombatSyncInput,
): FeralNurseJuiceSample {
  const dt =
    dtRaw <= 0 ? 0 : Math.min(0.05, Math.max(0.001, dtRaw)) * Math.max(0.1, config.speed);
  state.idleTime += dt;
  state.triggerElapsed += dt;

  // Layer 1: Symplectic Euler Damped Harmonic Spring
  const k = config.springStiffness;
  const c = config.springDamping;
  const subSteps = 2;
  const subDt = dt / subSteps;
  for (let s = 0; s < subSteps; s++) {
    const ax = -k * (state.springScaleX - 1) - c * state.springVelX;
    const ay = -k * (state.springScaleY - 1) - c * state.springVelY;
    state.springVelX += ax * subDt;
    state.springVelY += ay * subDt;
    state.springScaleX += state.springVelX * subDt;
    state.springScaleY += state.springVelY * subDt;
  }
  state.springScaleX = Math.max(0.58, Math.min(1.52, state.springScaleX));
  state.springScaleY = Math.max(0.58, Math.min(1.52, state.springScaleY));

  // Layer 4: Hit-Flash / Cloak-Pulse decay
  let flashRgba: [number, number, number, number] | null = null;
  if (state.flashTimer > 0) {
    state.flashTimer = Math.max(0, state.flashTimer - dt);
    const fFrac = clamp01(state.flashTimer / Math.max(0.01, state.flashDuration));
    flashRgba = [
      state.flashColorRgba[0],
      state.flashColorRgba[1],
      state.flashColorRgba[2],
      state.flashColorRgba[3] * fFrac,
    ];
  }

  // Layer 2: 2.5D Facing Flip (cos curve, guarded against degenerate 0 determinant)
  let facingScale: number = state.baseFacingSign;
  if (state.flipProgress >= 0) {
    state.flipProgress += dt / Math.max(0.08, state.flipDuration);
    if (state.flipProgress >= 1) {
      state.baseFacingSign = state.baseFacingSign === -1 ? 1 : -1;
      if (state.flipAutoReturn && state.baseFacingSign === 1) {
        state.flipProgress = 0;
        state.flipAutoReturn = false;
        applyFeralNurseSquash(state, 1.08, 0.92, 0.4, -0.5);
      } else {
        state.flipProgress = -1;
        applyFeralNurseSquash(state, 1.12, 0.89, 0.5, -0.6);
      }
      facingScale = state.baseFacingSign;
    } else {
      const rawCos = Math.cos(state.flipProgress * Math.PI) * state.baseFacingSign;
      facingScale = Math.abs(rawCos) < 0.04 ? (rawCos >= 0 ? 0.04 : -0.04) : rawCos;
    }
  }

  const deformScale = config.deformIntensity;
  const branch: FeralNurseBranchFrame = {
    xShiftPx: 0,
    hopYPx: 0,
    rotationRad: 0,
    alpha: 1,
    deform: neutralDeform(),
    tintRgba: [1, 1, 1, 1],
    uvDistortAmp: [0, 0],
    uvDistortFreq: 10,
    headsetGlowIntensity: 0.58,
    cloakIntensity: 0,
    clawSlashProgress: 0,
    pierceImpactIntensity: 0,
    heelPlantTriggered: false,
    cloakTriggered: false,
    pierceImpactTriggered: false,
    ichorBurstTriggered: false,
    phaseLabel: 'Idle',
  };

  if (combatSync) {
    stepFeralNurseCombatSyncBranch(state, combatSync, nowSec, deformScale, branch);
  } else {
    stepFeralNurseLabTriggerBranch(state, dt, config, deformScale, branch);
  }

  state.blendTimer =
    state.blendDuration <= 0
      ? 1
      : Math.min(state.blendDuration, state.blendTimer + dt);

  // Strictly enforce Layer 3 invariant: feet knot (h=0.0) pinned at zero
  branch.deform.feet.dx = 0;
  branch.deform.feet.dy = 0;
  branch.deform.feet.rotRad = 0;
  branch.deform.feet.scaleX = 1;

  // Layer 2: Velocity-driven shear
  const instVx =
    state.activeTrigger === 'prowl_stalk'
      ? state.prowlTargetVx * (0.72 + 0.28 * Math.cos(state.prowlPhase))
      : (branch.xShiftPx - state.prevXShiftPx) / Math.max(0.008, dt);
  state.velocityXPx += (instVx - state.velocityXPx) * Math.min(1, dt * 12);
  state.prevXShiftPx = branch.xShiftPx;

  const shearXPx = Math.max(
    -config.maxVelocityShearPx,
    Math.min(config.maxVelocityShearPx, state.velocityXPx * 0.058),
  );

  const blendAlpha =
    state.blendDuration <= 0 ? 1 : clamp01(state.blendTimer / state.blendDuration);

  return {
    frameIndex: state.currentFrame,
    prevFrameIndex: state.prevFrame,
    blendAlpha,
    xShiftPx: branch.xShiftPx,
    hopYPx: branch.hopYPx,
    springScaleX: state.springScaleX,
    springScaleY: state.springScaleY,
    facingScale,
    rotationRad: branch.rotationRad,
    shearXPx,
    alpha: branch.alpha,
    deform: branch.deform,
    tintRgba: branch.tintRgba,
    flashRgba,
    uvDistortAmp: branch.uvDistortAmp,
    uvDistortFreq: branch.uvDistortFreq,
    headsetGlowIntensity: clamp01(branch.headsetGlowIntensity),
    cloakIntensity: clamp01(branch.cloakIntensity),
    clawSlashProgress: clamp01(branch.clawSlashProgress),
    pierceImpactIntensity: clamp01(branch.pierceImpactIntensity),
    heelPlantTriggered: branch.heelPlantTriggered,
    cloakTriggered: branch.cloakTriggered,
    pierceImpactTriggered: branch.pierceImpactTriggered,
    ichorBurstTriggered: branch.ichorBurstTriggered,
    activeTrigger: state.activeTrigger,
    phaseLabel: branch.phaseLabel,
  };
}
