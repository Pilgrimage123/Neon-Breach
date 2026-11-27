import type { HeroAnimMode, HeroAnimState, HeroAnimStepContext } from './heroAnimator';
import { AURALINE_AEGIS_COUNTER_DURATION } from './auralineSpriteSheet';
import {
  type HorizontalFlipState,
  type HorizontalVelocityState,
  type JuiceMeshDeform,
  type SpringScaleState,
  applySpringSquashImpulse,
  createNeutralMeshDeform,
} from './proceduralJuiceCore';

export interface AuralineJuiceConfig {
  speed: number;
  springStiffness: number;
  springDamping: number;
  maxVelocityShearPx: number;
  deformIntensity: number;
  flipDurationSec: number;
  flipHopHeightPx: number;
}

export const DEFAULT_AURALINE_JUICE_CONFIG: AuralineJuiceConfig = {
  speed: 1.0,
  springStiffness: 290,
  springDamping: 21,
  maxVelocityShearPx: 6.5,
  deformIntensity: 1.0,
  flipDurationSec: 0.22,
  flipHopHeightPx: 0,
};

export interface AuralineJuiceState
  extends SpringScaleState,
    HorizontalVelocityState,
    HorizontalFlipState {
  mode: HeroAnimMode;
  elapsed: number;
  duration: number;
  lowHpHit: boolean;
  idleTime: number;

  // Crisp-cut frame tracking (blendDuration = 0 invariant)
  currentFrame: number;
  prevFrame: number;
  blendTimer: number;
  blendDuration: number;

  // One-shot rising-edge guards
  emittedShots: number;
  emittedKickImpact: boolean;
  surgeBlastFired: boolean;

  // Layer 4 shader flash
  flashTimer: number;
  flashDuration: number;
  flashColorRgba: [number, number, number, number];
}

export interface AuralineJuiceSample {
  state: AuralineJuiceState;
  frameIndex: number;
  prevFrameIndex: number;
  blendAlpha: number;

  // Layer 1 & 2 Macro Transforms
  xProgress: number;
  hopYPx: number;
  springScaleX: number;
  springScaleY: number;
  facingScale: number;
  rotationRad: number;
  shearXPx: number;

  // Layer 3 Mesh Spine Deformation (4-knot, feet pinned at 0)
  deform: JuiceMeshDeform;

  // Layer 4 WebGL2 / Canvas2D Shader Uniforms
  tintRgba: [number, number, number, number];
  flashRgba: [number, number, number, number] | null;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;

  // Combat & VFX Triggers
  shouldEmitShot: boolean;
  shouldEmitKickImpact: boolean;
  isDashing: boolean;
  isSurgeBlast: boolean;
  surgeBlastIntensity: number;
  broadsideIntensity: number;
  aegisCounterIntensity: number;
  reactorCoreIntensity: number;
}

export interface AuralineJuiceStepContext extends HeroAnimStepContext {
  reducedMotion?: boolean;
}

export const AURALINE_MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.4,
  idle2: 1.5,
  shoot: 0.52,
  dash_kick: 0.76,
  overdrive: 0.88,
  guard: 0.48,
  dodge: AURALINE_AEGIS_COUNTER_DURATION,
  upgrade: 0.88,
  hit: 0.44,
  defeat: 0.40,
  victory: 0.85,
};

export function createAuralineJuiceState(): AuralineJuiceState {
  return {
    mode: 'idle',
    elapsed: 0,
    duration: 0,
    lowHpHit: false,
    idleTime: 0,
    springScaleX: 1,
    springScaleY: 1,
    springVelX: 0,
    springVelY: 0,
    posX: 0,
    velX: 0,
    prevPosX: 0,
    baseFacingSign: 1,
    currentFacingScale: 1,
    flipActive: false,
    flipElapsed: 0,
    flipStartSign: 1,
    flipTargetSign: 1,
    flipAutoReturn: false,
    currentFrame: 0,
    prevFrame: 0,
    blendTimer: 1,
    blendDuration: 0,
    emittedShots: 0,
    emittedKickImpact: false,
    surgeBlastFired: false,
    flashTimer: 0,
    flashDuration: 0.16,
    flashColorRgba: [1, 1, 1, 0],
  };
}

export function applyAuralineSquash(
  state: AuralineJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  applySpringSquashImpulse(
    state,
    targetScaleX,
    targetScaleY,
    0.64,
    1.44,
    velImpulseX,
    velImpulseY,
  );
}

export function setAuralineFrame(state: AuralineJuiceState, nextFrame: number): void {
  if (state.currentFrame !== nextFrame) {
    state.prevFrame = state.currentFrame;
    state.currentFrame = nextFrame;
    state.blendDuration = 0;
    state.blendTimer = 1;
  }
}

export function triggerAuralineJuiceState(
  state: AuralineJuiceState,
  mode: HeroAnimMode,
  opts?: { lowHpHit?: boolean },
): AuralineJuiceState {
  state.mode = mode;
  state.elapsed = 0;
  state.duration = AURALINE_MODE_DURATIONS[mode];
  state.lowHpHit = Boolean(opts?.lowHpHit);
  state.emittedShots = 0;
  state.emittedKickImpact = false;
  state.surgeBlastFired = false;
  state.flipActive = false;
  state.baseFacingSign = 1;
  state.currentFacingScale = 1;

  if (mode === 'shoot') {
    applyAuralineSquash(state, 1.07, 0.94, 0.5, -0.4);
  } else if (mode === 'dash_kick') {
    // Artillery Surge Blast: deep armored brace compression + cyan-magenta plasma flash
    applyAuralineSquash(state, 1.14, 0.87, 1.1, -0.9);
    state.flashTimer = 0.20;
    state.flashDuration = 0.20;
    state.flashColorRgba = [0.22, 0.92, 1.0, 0.46];
  } else if (mode === 'overdrive') {
    // Sovereign Broadside: golden reactor flare + heavy artillery lock
    applyAuralineSquash(state, 1.16, 0.86, 1.3, -1.1);
    state.flashTimer = 0.24;
    state.flashDuration = 0.24;
    state.flashColorRgba = [1.0, 0.84, 0.28, 0.50];
  } else if (mode === 'dodge') {
    // Planted Defensive Aegis Shield-Block Counter-Brace (no backflip; grounded shield brace)
    applyAuralineSquash(state, 1.13, 0.89, 0.8, -0.7);
    state.flashTimer = 0.18;
    state.flashDuration = 0.18;
    state.flashColorRgba = [0.35, 1.0, 0.88, 0.44];
  } else if (mode === 'guard') {
    applyAuralineSquash(state, 1.11, 0.90, 0.6, -0.5);
  } else if (mode === 'upgrade') {
    // Golden Reactor Core Plating & UpCharge vertical surge
    applyAuralineSquash(state, 0.91, 1.11, -0.6, 0.9);
    state.flashTimer = 0.20;
    state.flashDuration = 0.20;
    state.flashColorRgba = [1.0, 0.86, 0.32, 0.42];
  } else if (mode === 'hit') {
    applyAuralineSquash(state, 1.12, 0.89, -0.9, 0.7);
    state.flashTimer = 0.18;
    state.flashDuration = 0.18;
    state.flashColorRgba = [1.0, 0.24, 0.36, 0.52];
  } else if (mode === 'victory') {
    applyAuralineSquash(state, 0.92, 1.10, -0.3, 0.8);
  }
  return state;
}

/** Sync HeroAnimState metadata for external consumers. */
export function toAuralineHeroAnimStateSnapshot(state: AuralineJuiceState): HeroAnimState {
  return {
    mode: state.mode,
    elapsed: state.elapsed,
    duration: state.duration,
    lowHpHit: state.lowHpHit,
    emittedShots: state.emittedShots,
    emittedKickImpact: state.emittedKickImpact,
    lastFrameIndex: state.currentFrame,
    prevFrameIndex: state.prevFrame,
    frameBlendElapsed: 0,
  };
}

export { createNeutralMeshDeform };
