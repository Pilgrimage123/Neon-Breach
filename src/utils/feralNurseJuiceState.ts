/**
 * @file feralNurseJuiceState.ts
 * Types, default configuration, state initialization, spring impulse helpers, and
 * trigger logic for the Feral Nurse (`feral_nurse`) 4-Layer Procedural Juice System (32 Frames).
 */

export type FeralNurseJuiceTrigger =
  | 'idle'
  | 'prowl_stalk'
  | 'optical_cloak'
  | 'pierce_strike'
  | 'take_hit'
  | 'turn_around';

export interface FeralNurseJuiceConfig {
  /** Global playback speed multiplier (default 1.0) */
  speed: number;
  /** Spring stiffness k for Layer 1 damped harmonic squash-and-stretch (default 295) */
  springStiffness: number;
  /** Spring damping c for Layer 1 harmonic oscillation (default 18) */
  springDamping: number;
  /** Layer 2 prowl stride speed in cycles/sec (default 1.35) */
  prowlFreqHz: number;
  /** Layer 2 maximum velocity skew/shear amplitude in px (default 7.0) */
  maxVelocityShearPx: number;
  /** Layer 3 spine sway multiplier (default 1.0) */
  deformIntensity: number;
}

export const DEFAULT_FERAL_NURSE_JUICE_CONFIG: FeralNurseJuiceConfig = {
  speed: 1.0,
  springStiffness: 295,
  springDamping: 18,
  prowlFreqHz: 1.35,
  maxVelocityShearPx: 7.0,
  deformIntensity: 1.0,
};

export interface FeralNurseControlPointKnot {
  dx: number;
  dy: number;
  rotRad: number;
  scaleX: number;
}

/** Layer 3: 4-Knot Anatomical Spine Mesh Deformation (Feet strictly pinned at 0) */
export interface FeralNurseMeshDeform {
  feet: FeralNurseControlPointKnot;
  hips: FeralNurseControlPointKnot;
  chest: FeralNurseControlPointKnot;
  head: FeralNurseControlPointKnot;
}

export interface FeralNurseJuiceState {
  activeTrigger: FeralNurseJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  prowlPhase: number;
  lastProwlCycleHalf: number;
  idleTime: number;

  // Layer 1: Symplectic Spring Squash & Stretch
  springScaleX: number;
  springScaleY: number;
  springVelX: number;
  springVelY: number;

  // Layer 2: 2.5D Facing Flip & Velocity Tracking
  baseFacingSign: 1 | -1;
  flipProgress: number; // -1 = inactive, 0..1 = active 2.5D flip
  flipDuration: number;
  flipAutoReturn: boolean;
  prevXShiftPx: number;
  velocityXPx: number;
  prowlTargetVx: number;

  // Frame crossfade tracking
  currentFrame: number;
  prevFrame: number;
  blendTimer: number;
  blendDuration: number;

  // One-shot rising-edge guards
  impactFired: boolean;
  cloakPulseFired: boolean;
  ichorBurstFired: boolean;

  // Layer 4: Shader Uniforms
  flashTimer: number;
  flashDuration: number;
  flashColorRgba: [number, number, number, number];
}

export interface FeralNurseJuiceSample {
  frameIndex: number;
  prevFrameIndex: number;
  blendAlpha: number;

  // Layer 1 & 2 Macro Transforms
  xShiftPx: number;
  hopYPx: number;
  springScaleX: number;
  springScaleY: number;
  facingScale: number;
  rotationRad: number;
  shearXPx: number;
  alpha: number;

  // Layer 3 Mesh Spine Deformation
  deform: FeralNurseMeshDeform;

  // Layer 4 WebGL2 Shader Uniforms
  tintRgba: [number, number, number, number];
  flashRgba: [number, number, number, number] | null;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;

  // Feral Nurse Optical-Camo & 7-Pierce VFX Triggers
  headsetGlowIntensity: number;
  cloakIntensity: number;
  clawSlashProgress: number;
  pierceImpactIntensity: number;
  heelPlantTriggered: boolean;
  cloakTriggered: boolean;
  pierceImpactTriggered: boolean;
  ichorBurstTriggered: boolean;

  // Live Lab Telemetry
  activeTrigger: FeralNurseJuiceTrigger;
  phaseLabel: string;
}

export interface FeralNurseCombatSyncInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  cloakCastTimer?: number;
  cloakCastDuration?: number;
  cloaked?: boolean;
  preparePrimed?: boolean;
  piercePrimed?: boolean;
  feralGuard?: boolean;
  guardHover?: boolean;
  staggerHover?: boolean;
  staggered?: boolean;
}

export function createFeralNurseJuiceState(): FeralNurseJuiceState {
  return {
    activeTrigger: 'idle',
    triggerElapsed: 0,
    triggerDuration: 0,
    prowlPhase: 0,
    lastProwlCycleHalf: 0,
    idleTime: 0,
    springScaleX: 1,
    springScaleY: 1,
    springVelX: 0,
    springVelY: 0,
    baseFacingSign: -1, // Source faces right; -1 mirrors left toward hero
    flipProgress: -1,
    flipDuration: 0.34,
    flipAutoReturn: false,
    prevXShiftPx: 0,
    velocityXPx: 0,
    prowlTargetVx: 0,
    currentFrame: 1,
    prevFrame: 1,
    blendTimer: 1,
    blendDuration: 0,
    impactFired: false,
    cloakPulseFired: false,
    ichorBurstFired: false,
    flashTimer: 0,
    flashDuration: 0.16,
    flashColorRgba: [1.0, 0.38, 0.72, 0.84],
  };
}

export function applyFeralNurseSquash(
  state: FeralNurseJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  state.springScaleX = targetScaleX;
  state.springScaleY = targetScaleY;
  state.springVelX += velImpulseX;
  state.springVelY += velImpulseY;
}

export function triggerFeralNurseJuiceState(
  state: FeralNurseJuiceState,
  trigger: FeralNurseJuiceTrigger,
  config: FeralNurseJuiceConfig = DEFAULT_FERAL_NURSE_JUICE_CONFIG,
): void {
  state.activeTrigger = trigger;
  state.triggerElapsed = 0;
  state.impactFired = false;
  state.cloakPulseFired = false;
  state.ichorBurstFired = false;

  if (trigger === 'idle') {
    state.triggerDuration = 0;
    state.prowlTargetVx = 0;
    applyFeralNurseSquash(state, 1.04, 0.96);
  } else if (trigger === 'prowl_stalk') {
    state.triggerDuration = 0;
    state.prowlPhase = 0;
    state.lastProwlCycleHalf = 0;
    state.prowlTargetVx = -92 * config.speed;
    applyFeralNurseSquash(state, 1.05, 0.95);
  } else if (trigger === 'optical_cloak') {
    state.triggerDuration = 2.4;
    state.flashTimer = 0.18;
    state.flashDuration = 0.18;
    state.flashColorRgba = [0.22, 0.94, 1.0, 0.72];
    applyFeralNurseSquash(state, 1.08, 0.92, 0.5, -0.6);
  } else if (trigger === 'pierce_strike') {
    state.triggerDuration = 1.24;
    applyFeralNurseSquash(state, 0.92, 1.09, -0.5, 0.8);
  } else if (trigger === 'take_hit') {
    state.triggerDuration = 0.56;
    state.flashTimer = 0.16;
    state.flashDuration = 0.16;
    state.flashColorRgba = [1.0, 0.55, 0.80, 0.86];
    applyFeralNurseSquash(state, 0.86, 1.15, -1.0, 1.3);
  } else if (trigger === 'turn_around') {
    state.triggerDuration = 0.90;
    state.flipProgress = 0;
    state.flipDuration = 0.34;
    state.flipAutoReturn = true;
    applyFeralNurseSquash(state, 0.90, 1.12, 0, 1.4);
  }
}

export function setFeralNurseFrame(
  state: FeralNurseJuiceState,
  nextFrame: number,
  blendDuration = 0,
): void {
  if (nextFrame === state.currentFrame) return;
  state.prevFrame = state.currentFrame;
  state.currentFrame = nextFrame;
  state.blendTimer = 0;
  state.blendDuration = blendDuration;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function neutralDeform(): FeralNurseMeshDeform {
  return {
    feet: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    hips: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    chest: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    head: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
  };
}
