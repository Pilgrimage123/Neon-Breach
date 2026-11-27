import { createInitialHeroAnimState } from './heroAnimator';
import { stepKiraBranch } from './kiraJuiceBranches';
import {
  DEFAULT_KIRA_JUICE_CONFIG,
  type KiraJuiceConfig,
  type KiraJuiceSample,
  type KiraJuiceState,
  type KiraJuiceStepContext,
  triggerKiraJuiceState,
} from './kiraJuiceState';
import {
  stepHorizontalFlip,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';

export function stepKiraJuice(
  state: KiraJuiceState,
  dtRaw: number,
  context: KiraJuiceStepContext,
  config: KiraJuiceConfig = DEFAULT_KIRA_JUICE_CONFIG,
): KiraJuiceSample {
  const reducedMotion = Boolean(context.reducedMotion);
  const dt =
    dtRaw <= 0 ? 0 : Math.min(0.05, Math.max(0.001, dtRaw)) * Math.max(0.1, config.speed);

  if (context.isDead && state.mode !== 'defeat') {
    triggerKiraJuiceState(state, 'defeat');
  } else if (!context.isDead && context.isVictory && state.mode !== 'victory') {
    triggerKiraJuiceState(state, 'victory');
  }

  if (
    (state.mode === 'idle1' || state.mode === 'idle2') &&
    (context.hoveredColor !== null || context.isVictory)
  ) {
    triggerKiraJuiceState(state, 'idle');
  }

  state.idleTime += dt;
  if (state.mode !== 'idle') {
    state.elapsed += dt;
    if (state.mode !== 'defeat' && state.mode !== 'victory' && state.elapsed >= state.duration) {
      triggerKiraJuiceState(state, 'idle');
    }
  }

  // Layer 1: Symplectic 2-sub-step damped harmonic spring
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
      0.58,
      1.52,
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

  // Layer 2: 2.5D Horizontal Flip (for Evasive Dodge)
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
  const branch = stepKiraBranch(
    state,
    context.hoveredColor,
    context.totalTime,
    deformScale,
    reducedMotion,
  );

  // Advance blendTimer AFTER branch frame selection; crisp cut invariant blendDuration = 0
  state.blendTimer =
    state.blendDuration <= 0
      ? 1
      : Math.min(state.blendDuration, state.blendTimer + dt);

  // Enforce Layer 3 invariant: feet knot strictly pinned at (0, 0)
  branch.deform.feet.dx = 0;
  branch.deform.feet.dy = 0;
  branch.deform.feet.rotRad = 0;
  branch.deform.feet.scaleX = 1;

  // Enforce ground contact invariant on grounded frames
  const groundedFrames = new Set([0, 1, 3, 6, 7, 8, 9, 10, 12, 13, 15, 17, 19, 22, 23, 24, 25, 26, 27, 28, 29, 31]);
  const totalHopY = groundedFrames.has(state.currentFrame)
    ? 0
    : branch.hopYPx + flipHopY;

  // Enforce idle/locomotion UV distortion invariant
  if (state.mode === 'idle' || state.mode === 'idle1' || state.mode === 'idle2') {
    branch.uvDistortAmp = [0, 0];
  }

  const shearXPx =
    reducedMotion || dt <= 0
      ? 0
      : stepHorizontalVelocityShear(
          state,
          branch.xProgress * 280,
          dt,
          18,
          0.045,
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
    dropkickIntensity: branch.dropkickIntensity,
  };
}

export { createInitialHeroAnimState };
