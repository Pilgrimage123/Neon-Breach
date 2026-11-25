import type { MutdogAnimMode } from './mutdogSpriteSheet';
import {
  applySpringSquashImpulse,
  type HorizontalFlipState,
  type HorizontalVelocityState,
  type JuiceControlPointKnot,
  type JuiceMeshDeform,
  type SpringScaleState,
  startHorizontalFlip,
} from './proceduralJuiceCore';
import type { FrameTransitionResult } from './spriteSheetAnim';

export type MutdogJuiceTrigger =
  | 'idle'
  | 'prowl_stalk'
  | 'pounce_maul'
  | 'frenzy_howl'
  | 'take_hit'
  | 'turn_around';

export interface MutdogJuiceConfig {
  springStiffness: number;
  springDamping: number;
  prowlSpeed: number;
  prowlMaxAngleRad: number;
  prowlHopHeightPx: number;
  velocitySkewFactor: number;
  maxSkewPx: number;
  feralVfxStrength: number;
  uvDistortStrength: number;
  flipDurationSec: number;
  flipHopHeightPx: number;
}

export const DEFAULT_MUTDOG_JUICE_CONFIG: MutdogJuiceConfig = {
  springStiffness: 310,
  springDamping: 18,
  prowlSpeed: 13.5,
  prowlMaxAngleRad: 0.082,
  prowlHopHeightPx: 11,
  velocitySkewFactor: 0.044,
  maxSkewPx: 22,
  feralVfxStrength: 1.0,
  uvDistortStrength: 1.0,
  flipDurationSec: 0.42,
  flipHopHeightPx: 18,
};

export type MutdogControlPointKnot = JuiceControlPointKnot;
export type MutdogMeshDeform = JuiceMeshDeform;

export interface MutdogJuiceState
  extends SpringScaleState,
    HorizontalVelocityState,
    HorizontalFlipState {
  activeTrigger: MutdogJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  snarlTimer: number;
  snarlHoldTimer: number;
  snarlVariant: 2 | 3;
  transition: FrameTransitionResult;
  prowlTime: number;
  wasAirborne: boolean;
  hitFlashTimer: number;
  lastSeenAttackTimer: number;
  lastSeenStaggerTimer: number;
  lastSeenBristleTimer: number;
  pendingDroolBurst: boolean;
}

export interface MutdogJuiceSample {
  mode: MutdogAnimMode;
  activeTrigger: MutdogJuiceTrigger;
  frameIndex: number;
  prevFrameIndex: number;
  frameBlendAlpha: number;
  springScaleX: number;
  springScaleY: number;
  rotationRad: number;
  offsetX: number;
  hopYPx: number;
  shearXPx: number;
  facingScale: number;
  deform: MutdogMeshDeform;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  flashRgba: [number, number, number, number] | null;
  tintRgba: [number, number, number, number];
  lureGlowIntensity: number;
  droolIntensity: number;
  clawSlashProgress: number;
  pounceImpactProgress: number;
  howlPulseProgress: number;
  pounceImpactTriggered: boolean;
  droolBurstTriggered: boolean;
  pawPlantTriggered: boolean;
  alpha: number;
}

export interface MutdogCombatSyncInput {
  dead?: boolean;
  koProgress?: number;
  attackAnimTimer?: number;
  attackAnimDuration?: number;
  mutdogAttackKind?: 'maul' | 'pounce';
  staggerTimer?: number;
  staggerDuration?: number;
  bristleTimer?: number;
  bristleDuration?: number;
  maulPrimed?: boolean;
  pouncePrimed?: boolean;
  pauseRecover?: boolean;
  feralGuard?: boolean;
  guardHover?: boolean;
  staggerHover?: boolean;
  staggeredStatus?: boolean;
  instanceIndex?: number;
}

export interface MutdogEvalCtx {
  mode: MutdogAnimMode;
  frameIndex: number;
  targetPosX: number;
  hopYPx: number;
  rotationRad: number;
  lureGlowIntensity: number;
  droolIntensity: number;
  clawSlashProgress: number;
  pounceImpactProgress: number;
  howlPulseProgress: number;
  pounceImpactTriggered: boolean;
  droolBurstTriggered: boolean;
  pawPlantTriggered: boolean;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  tintRgba: [number, number, number, number];
  deform: MutdogMeshDeform;
}

export function createMutdogJuiceState(): MutdogJuiceState {
  return {
    activeTrigger: 'idle',
    triggerElapsed: 0,
    triggerDuration: 0,
    snarlTimer: 1.75,
    snarlHoldTimer: 0,
    snarlVariant: 2,
    transition: {
      prevFrameIndex: 0,
      lastFrameIndex: 0,
      frameBlendElapsed: 0,
      frameBlendAlpha: 1,
    },
    springScaleX: 1,
    springScaleY: 1,
    springVelX: 0,
    springVelY: 0,
    posX: 0,
    velX: 0,
    prevPosX: 0,
    prowlTime: 0,
    wasAirborne: false,
    baseFacingSign: -1,
    currentFacingScale: -1,
    flipActive: false,
    flipElapsed: 0,
    flipStartSign: -1,
    flipTargetSign: -1,
    flipAutoReturn: false,
    hitFlashTimer: 0,
    lastSeenAttackTimer: 0,
    lastSeenStaggerTimer: 0,
    lastSeenBristleTimer: 0,
    pendingDroolBurst: false,
  };
}

export function applyMutdogSquash(
  state: MutdogJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  applySpringSquashImpulse(state, targetScaleX, targetScaleY, 0.62, 1.50, velImpulseX, velImpulseY);
}

export function triggerMutdogJuiceState(
  state: MutdogJuiceState,
  trigger: MutdogJuiceTrigger,
  config: MutdogJuiceConfig = DEFAULT_MUTDOG_JUICE_CONFIG,
): void {
  state.activeTrigger = trigger;
  state.triggerElapsed = 0;

  switch (trigger) {
    case 'idle': {
      state.triggerDuration = 0;
      applyMutdogSquash(state, 1.05, 0.95);
      break;
    }
    case 'prowl_stalk': {
      state.triggerDuration = 1.24;
      state.prowlTime = 0;
      state.wasAirborne = false;
      applyMutdogSquash(state, 1.11, 0.89);
      break;
    }
    case 'pounce_maul': {
      state.triggerDuration = 0.96;
      applyMutdogSquash(state, 1.20, 0.80, 1.4, -1.6);
      break;
    }
    case 'frenzy_howl': {
      state.triggerDuration = 1.08;
      applyMutdogSquash(state, 0.88, 1.16, -0.9, 1.3);
      break;
    }
    case 'take_hit': {
      state.triggerDuration = 0.66;
      state.hitFlashTimer = 0.24;
      state.pendingDroolBurst = true;
      applyMutdogSquash(state, 0.78, 1.22, -2.2, 2.4);
      state.velX = 205;
      break;
    }
    case 'turn_around': {
      state.triggerDuration = Math.max(0.28, config.flipDurationSec * 2.15);
      startHorizontalFlip(state, true);
      applyMutdogSquash(state, 0.90, 1.12);
      break;
    }
  }
}
