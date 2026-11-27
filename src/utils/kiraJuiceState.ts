import type { HeroAnimMode, HeroAnimState, HeroAnimStepContext } from './heroAnimator';
import { KIRA_DODGE_DURATION } from './kiraSpriteSheet';
import {
  type HorizontalFlipState,
  type HorizontalVelocityState,
  type JuiceMeshDeform,
  type SpringScaleState,
  applySpringSquashImpulse,
  createNeutralMeshDeform,
} from './proceduralJuiceCore';

export interface KiraJuiceConfig {
  speed: number;
  springStiffness: number;
  springDamping: number;
  maxVelocityShearPx: number;
  deformIntensity: number;
  flipDurationSec: number;
  flipHopHeightPx: number;
}

export const DEFAULT_KIRA_JUICE_CONFIG: KiraJuiceConfig = {
  speed: 1.0,
  springStiffness: 320,
  springDamping: 19,
  maxVelocityShearPx: 9.0,
  deformIntensity: 1.0,
  flipDurationSec: 0.24,
  flipHopHeightPx: 14,
};

export interface KiraJuiceState extends SpringScaleState, HorizontalVelocityState, HorizontalFlipState {
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

export interface KiraJuiceSample {
  state: KiraJuiceState;
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

  // Layer 4 WebGL2 Shader Uniforms
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
  dropkickIntensity: number;
}

export interface KiraJuiceStepContext extends HeroAnimStepContext {
  reducedMotion?: boolean;
}

export const KIRA_MODE_DURATIONS: Record<HeroAnimMode, number> = {
  idle: 0,
  idle1: 1.4,
  idle2: 1.5,
  shoot: 0.50,
  dash_kick: 0.72,
  overdrive: 0.88,
  guard: 0.48,
  dodge: KIRA_DODGE_DURATION,
  upgrade: 0.88,
  hit: 0.44,
  defeat: 0.40,
  victory: 0.85,
};

export function createKiraJuiceState(): KiraJuiceState {
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

export function applyKiraSquash(
  state: KiraJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  applySpringSquashImpulse(state, targetScaleX, targetScaleY, 0.58, 1.52, velImpulseX, velImpulseY);
}

export function setKiraFrame(state: KiraJuiceState, nextFrame: number): void {
  if (state.currentFrame !== nextFrame) {
    state.prevFrame = state.currentFrame;
    state.currentFrame = nextFrame;
    state.blendDuration = 0;
    state.blendTimer = 1;
  }
}

export function triggerKiraJuiceState(
  state: KiraJuiceState,
  mode: HeroAnimMode,
  opts?: { lowHpHit?: boolean },
): KiraJuiceState {
  state.mode = mode;
  state.elapsed = 0;
  state.duration = KIRA_MODE_DURATIONS[mode];
  state.lowHpHit = Boolean(opts?.lowHpHit);
  state.emittedShots = 0;
  state.emittedKickImpact = false;
  state.surgeBlastFired = false;
  state.flipActive = false;
  state.baseFacingSign = 1;
  state.currentFacingScale = 1;

  if (mode === 'shoot') {
    applyKiraSquash(state, 0.94, 1.06, -0.4, 0.5);
  } else if (mode === 'dash_kick') {
    applyKiraSquash(state, 1.12, 0.88, 0.9, -0.8);
    state.flashTimer = 0.18;
    state.flashDuration = 0.18;
    state.flashColorRgba = [1.0, 0.28, 0.78, 0.42];
  } else if (mode === 'overdrive') {
    applyKiraSquash(state, 1.18, 0.84, 1.2, -1.0);
    state.flashTimer = 0.22;
    state.flashDuration = 0.22;
    state.flashColorRgba = [0.1, 0.92, 1.0, 0.48];
  } else if (mode === 'dodge') {
    applyKiraSquash(state, 0.86, 1.16, -0.8, 1.2);
    state.flipActive = true;
    state.flipElapsed = 0;
    state.flipStartSign = 1;
    state.flipTargetSign = -1;
    state.flipAutoReturn = true;
  } else if (mode === 'guard') {
    applyKiraSquash(state, 1.12, 0.89, 0.5, -0.5);
  } else if (mode === 'hit') {
    applyKiraSquash(state, 0.88, 1.14, -0.9, 0.7);
    state.flashTimer = 0.18;
    state.flashDuration = 0.18;
    state.flashColorRgba = [1.0, 0.22, 0.35, 0.55];
  } else if (mode === 'victory') {
    applyKiraSquash(state, 0.9, 1.12, -0.3, 0.9);
  }
  return state;
}

/** Sync legacy HeroAnimState metadata for external consumers. */
export function toHeroAnimStateSnapshot(state: KiraJuiceState): HeroAnimState {
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
