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

export type BruteJuiceTrigger =
  | 'idle'
  | 'stomp_walk'
  | 'seismic_smash'
  | 'mutagen_brace'
  | 'take_hit'
  | 'turn_around';

export interface BruteJuiceConfig {
  springStiffness: number;
  springDamping: number;
  stompSpeed: number;
  stompMaxAngleRad: number;
  stompHopHeightPx: number;
  velocitySkewFactor: number;
  maxSkewPx: number;
  seismicImpactStrength: number;
  uvDistortStrength: number;
  flipDurationSec: number;
  flipHopHeightPx: number;
}

export const DEFAULT_BRUTE_JUICE_CONFIG: BruteJuiceConfig = {
  springStiffness: 280,
  springDamping: 19,
  stompSpeed: 10.5,
  stompMaxAngleRad: 0.068,
  stompHopHeightPx: 9,
  velocitySkewFactor: 0.036,
  maxSkewPx: 18,
  seismicImpactStrength: 1.0,
  uvDistortStrength: 1.0,
  flipDurationSec: 0.48,
  flipHopHeightPx: 16,
};

export type BruteControlPointKnot = JuiceControlPointKnot;
export type BruteMeshDeform = JuiceMeshDeform;

export interface BruteJuiceState
  extends SpringScaleState,
    HorizontalVelocityState,
    HorizontalFlipState {
  activeTrigger: BruteJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  snarlTimer: number;
  snarlHoldTimer: number;
  snarlVariant: 2 | 3;
  transition: FrameTransitionResult;
  stompTime: number;
  wasAirborne: boolean;
  hitFlashTimer: number;
  lastSeenAttackTimer: number;
  lastSeenStaggerTimer: number;
  lastSeenBristleTimer: number;
  lastSeenWeaponBroken: boolean;
  pendingChitinBurst: boolean;
}

export interface BruteJuiceSample {
  activeTrigger: BruteJuiceTrigger;
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
  deform: BruteMeshDeform;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  flashRgba: [number, number, number, number] | null;
  tintRgba: [number, number, number, number];
  vialGlowIntensity: number;
  shellGlowIntensity: number;
  shockwaveIntensity: number;
  mutagenMistProgress: number;
  seismicImpactProgress: number;
  seismicImpactTriggered: boolean;
  vialShatterTriggered: boolean;
  chitinShardTriggered: boolean;
  footPlantTriggered: boolean;
}

export interface BruteCombatSyncInput {
  dead?: boolean;
  koProgress?: number;
  attackAnimTimer?: number;
  attackAnimDuration?: number;
  bruteAttackKind?: 'heavy' | 'attack';
  staggerTimer?: number;
  staggerDuration?: number;
  bristleTimer?: number;
  bristleDuration?: number;
  heavyPrimed?: boolean;
  armoredGuard?: boolean;
  staggerHover?: boolean;
  staggeredStatus?: boolean;
  weaponBroken?: boolean;
  instanceIndex?: number;
}

export interface BruteEvalCtx {
  frameIndex: number;
  targetPosX: number;
  hopYPx: number;
  rotationRad: number;
  vialGlowIntensity: number;
  shellGlowIntensity: number;
  shockwaveIntensity: number;
  mutagenMistProgress: number;
  seismicImpactProgress: number;
  seismicImpactTriggered: boolean;
  vialShatterTriggered: boolean;
  footPlantTriggered: boolean;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  tintRgba: [number, number, number, number];
  deform: BruteMeshDeform;
}

export function createBruteJuiceState(): BruteJuiceState {
  return {
    activeTrigger: 'idle',
    triggerElapsed: 0,
    triggerDuration: 0,
    snarlTimer: 2.0,
    snarlHoldTimer: 0,
    snarlVariant: 2,
    transition: {
      prevFrameIndex: 1,
      lastFrameIndex: 1,
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
    stompTime: 0,
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
    lastSeenWeaponBroken: false,
    pendingChitinBurst: false,
  };
}

export function applyBruteSquash(
  state: BruteJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  applySpringSquashImpulse(state, targetScaleX, targetScaleY, 0.62, 1.48, velImpulseX, velImpulseY);
}

export function triggerBruteJuiceState(
  state: BruteJuiceState,
  trigger: BruteJuiceTrigger,
  config: BruteJuiceConfig = DEFAULT_BRUTE_JUICE_CONFIG,
): void {
  state.activeTrigger = trigger;
  state.triggerElapsed = 0;

  switch (trigger) {
    case 'idle': {
      state.triggerDuration = 0;
      applyBruteSquash(state, 1.04, 0.96);
      break;
    }
    case 'stomp_walk': {
      state.triggerDuration = 1.32;
      state.stompTime = 0;
      state.wasAirborne = false;
      applyBruteSquash(state, 1.09, 0.91);
      break;
    }
    case 'seismic_smash': {
      state.triggerDuration = 1.04;
      applyBruteSquash(state, 1.18, 0.82, 1.2, -1.5);
      break;
    }
    case 'mutagen_brace': {
      state.triggerDuration = 1.18;
      applyBruteSquash(state, 1.12, 0.88, 0.9, -0.8);
      break;
    }
    case 'take_hit': {
      state.triggerDuration = 0.72;
      state.hitFlashTimer = 0.24;
      state.pendingChitinBurst = true;
      applyBruteSquash(state, 0.80, 1.20, -2.0, 2.2);
      state.velX = 185;
      break;
    }
    case 'turn_around': {
      state.triggerDuration = Math.max(0.30, config.flipDurationSec * 2.15);
      startHorizontalFlip(state, true);
      applyBruteSquash(state, 0.91, 1.11);
      break;
    }
  }
}
