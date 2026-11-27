import { createInitialHeroAnimState } from './heroAnimator';
import { stepAuralineBranch } from './auralineJuiceBranches';
import {
  type AuralineJuiceConfig,
  type AuralineJuiceSample,
  type AuralineJuiceState,
  type AuralineJuiceStepContext,
  DEFAULT_AURALINE_JUICE_CONFIG,
  triggerAuralineJuiceState,
} from './auralineJuiceState';
import {
  stepHorizontalFlip,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';

export function stepAuralineJuice(
  state: AuralineJuiceState,
  dtRaw: number,
  context: AuralineJuiceStepContext,
  config: AuralineJuiceConfig = DEFAULT_AURALINE_JUICE_CONFIG,
): AuralineJuiceSample {
  const reducedMotion = Boolean(context.reducedMotion);
  const dt =
    dtRaw <= 0 ? 0 : Math.min(0.05, Math.max(0.001, dtRaw)) * Math.max(0.1, config.speed);

  if (context.isDead && state.mode !== 'defeat') {
    triggerAuralineJuiceState(state, 'defeat');
  } else if (!context.isDead && context.isVictory && state.mode !== 'victory') {
    triggerAuralineJuiceState(state, 'victory');
  }

  if (
    (state.mode === 'idle1' || state.mode === 'idle2') &&
    (context.hoveredColor !== null || context.isVictory)
  ) {
    triggerAuralineJuiceState(state, 'idle');
  }

  state.idleTime += dt;
  if (state.mode !== 'idle') {
    state.elapsed += dt;
    if (state.mode !== 'defeat' && state.mode !== 'victory' && state.elapsed >= state.duration) {
      triggerAuralineJuiceState(state, 'idle');
    }
  }

  // Layer 1: Symplectic 2-sub-step damped harmonic spring (heavy armored tuning)
  if (reducedMotion) {
    state.springScaleX = 1;
    state.springScaleY = 1;
    state.springVelX = 0;
    state.springVelY = 0;
  } else {
    stepSymplecticSpringScale(
      state,
      dt,
      config.springStiffness,
      config.springDamping,
      0.64,
      1.44,
    );
  }

  // Layer 4: Shader flash decay
  let flashRgba: [number, number, number, number] | null = null;
  if (state.flashTimer > 0 && !reducedMotion) {
    state.flashTimer = Math.max(0, state.flashTimer - dt);
    const frac = Math.max(0, Math.min(1, state.flashTimer / Math.max(0.01, state.flashDuration)));
    flashRgba = [
      state.flashColorRgba[0],
      state.flashColorRgba[1],
      state.flashColorRgba[2],
      state.flashColorRgba[3] * frac,
    ];
  } else {
    state.flashTimer = 0;
  }

  // Layer 2: Optional 2.5D Horizontal Flip (grounded hopYPx = 0 on all planted frames)
  let flipHopY = 0;
  if (state.flipActive && !reducedMotion) {
    const flipRes = stepHorizontalFlip(
      state,
      dt,
      config.flipDurationSec,
      0.08,
      config.flipHopHeightPx,
      0.16,
    );
    flipHopY = flipRes.hopYPx;
  } else {
    state.currentFacingScale = 1;
  }

  const deformScale = reducedMotion ? 0 : config.deformIntensity;
  const branch = stepAuralineBranch(
    state,
    context.hoveredColor,
    context.totalTime,
    deformScale,
    reducedMotion,
  );

  // Crisp cut invariant: blendDuration = 0 -> blendTimer = 1
  state.blendTimer =
    state.blendDuration <= 0
      ? 1
      : Math.min(state.blendDuration, state.blendTimer + dt);

  // Enforce Layer 3 invariant: feet knot strictly pinned at (0, 0)
  branch.deform.feet.dx = 0;
  branch.deform.feet.dy = 0;
  branch.deform.feet.rotRad = 0;
  branch.deform.feet.scaleX = 1;

  // Enforce ground contact invariant: Auraline is 100% planted on the bridge deck across all 32 frames
  const totalHopY = state.flipActive ? flipHopY : 0;

  // Enforce idle/locomotion UV distortion invariant
  if (state.mode === 'idle' || state.mode === 'idle1' || state.mode === 'idle2') {
    branch.uvDistortAmp = [0, 0];
  }

  const shearXPx =
    reducedMotion || dt <= 0
      ? 0
      : stepHorizontalVelocityShear(
          state,
          branch.xProgress * 260,
          dt,
          18,
          0.042,
          config.maxVelocityShearPx,
        );

  return {
    state,
    frameIndex: state.currentFrame,
    prevFrameIndex: state.prevFrame,
    blendAlpha: 1,
    xProgress: branch.xProgress,
    hopYPx: totalHopY,
    springScaleX: state.springScaleX,
    springScaleY: state.springScaleY,
    facingScale: state.currentFacingScale,
    rotationRad: branch.rotationRad,
    shearXPx,
    deform: branch.deform,
    tintRgba: branch.tintRgba,
    flashRgba,
    uvDistortAmp: branch.uvDistortAmp,
    uvDistortFreq: branch.uvDistortFreq,
    shouldEmitShot: branch.shouldEmitShot,
    shouldEmitKickImpact: branch.shouldEmitKickImpact,
    isDashing: branch.isDashing,
    isSurgeBlast: branch.isSurgeBlast,
    surgeBlastIntensity: branch.surgeBlastIntensity,
    broadsideIntensity: branch.broadsideIntensity,
    aegisCounterIntensity: branch.aegisCounterIntensity,
    reactorCoreIntensity: branch.reactorCoreIntensity,
  };
}

export { createInitialHeroAnimState };
