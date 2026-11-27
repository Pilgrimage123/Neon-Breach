/**
 * @file spitterJuiceState.ts
 * Types, configuration, state initialization, and trigger helpers for the Bile Spitter (`spitter`).
 */

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
import type { SpitterAnimMode } from './spitterSpriteSheet';

export type SpitterJuiceTrigger =
  | 'idle'
  | 'advance_retreat'
  | 'attack_lunge'
  | 'cast_charge'
  | 'take_hit'
  | 'turn_around';

export interface SpitterJuiceConfig {
  springStiffness: number;
  springDamping: number;
  waddleSpeed: number;
  waddleMaxAngleRad: number;
  waddleHopHeightPx: number;
  velocitySkewFactor: number;
  maxSkewPx: number;
  uvDistortStrength: number;
  flipDurationSec: number;
  flipHopHeightPx: number;
}

export const DEFAULT_SPITTER_JUICE_CONFIG: SpitterJuiceConfig = {
  springStiffness: 260,
  springDamping: 17,
  waddleSpeed: 15,
  waddleMaxAngleRad: 0.085,
  waddleHopHeightPx: 11,
  velocitySkewFactor: 0.048,
  maxSkewPx: 22,
  uvDistortStrength: 1.0,
  flipDurationSec: 0.44,
  flipHopHeightPx: 14,
};

export type SpitterControlPointKnot = JuiceControlPointKnot;
export type SpitterMeshDeform = JuiceMeshDeform;

export interface SpitterJuiceState
  extends SpringScaleState,
    HorizontalVelocityState,
    HorizontalFlipState {
  activeTrigger: SpitterJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  blinkTimer: number;
  blinkHoldTimer: number;
  transition: FrameTransitionResult;
  waddleTime: number;
  wasAirborne: boolean;
  hitFlashTimer: number;
  castChargeLevel: number;
  lastSeenAttackTimer: number;
  lastSeenStaggerTimer: number;
  lastSeenBristleTimer: number;
}

export interface SpitterJuiceSample {
  mode: SpitterAnimMode;
  activeTrigger: SpitterJuiceTrigger;
  frameIndex: number;
  prevFrameIndex: number;
  frameBlendAlpha: number;
  alpha: number;
  springScaleX: number;
  springScaleY: number;
  rotationRad: number;
  offsetX: number;
  hopYPx: number;
  shearXPx: number;
  facingScale: number;
  deform: SpitterMeshDeform;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  flashRgba: [number, number, number, number] | null;
  tintRgba: [number, number, number, number];
  pustuleGlowIntensity: number;
  spitWindupProgress: number;
  spitStreamProgress: number;
}

export interface SpitterCombatSyncInput {
  dead?: boolean;
  koProgress?: number;
  attackAnimTimer?: number;
  attackAnimDuration?: number;
  spitterAttackKind?: 'spit' | 'claw';
  staggerTimer?: number;
  staggerDuration?: number;
  bristleTimer?: number;
  bristleDuration?: number;
  blightPrimed?: boolean;
  armoredGuard?: boolean;
  pustuleHover?: boolean;
  staggeredStatus?: boolean;
  instanceIndex?: number;
}

export function createSpitterJuiceState(): SpitterJuiceState {
  return {
    activeTrigger: 'idle',
    triggerElapsed: 0,
    triggerDuration: 0,
    blinkTimer: 2.2,
    blinkHoldTimer: 0,
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
    waddleTime: 0,
    wasAirborne: false,
    baseFacingSign: -1,
    currentFacingScale: -1,
    flipActive: false,
    flipElapsed: 0,
    flipStartSign: -1,
    flipTargetSign: -1,
    flipAutoReturn: false,
    hitFlashTimer: 0,
    castChargeLevel: 0,
    lastSeenAttackTimer: 0,
    lastSeenStaggerTimer: 0,
    lastSeenBristleTimer: 0,
  };
}

export function applySpitterSquash(
  state: SpitterJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  applySpringSquashImpulse(state, targetScaleX, targetScaleY, 0.55, 1.55, velImpulseX, velImpulseY);
}

export function triggerSpitterJuiceState(
  state: SpitterJuiceState,
  trigger: SpitterJuiceTrigger,
  config: SpitterJuiceConfig = DEFAULT_SPITTER_JUICE_CONFIG,
): void {
  state.activeTrigger = trigger;
  state.triggerElapsed = 0;

  switch (trigger) {
    case 'idle': {
      state.triggerDuration = 0;
      state.castChargeLevel = 0;
      applySpitterSquash(state, 1.04, 0.96);
      break;
    }
    case 'advance_retreat': {
      state.triggerDuration = 1.15;
      state.waddleTime = 0;
      applySpitterSquash(state, 1.1, 0.9);
      break;
    }
    case 'attack_lunge': {
      state.triggerDuration = 0.92;
      applySpitterSquash(state, 1.16, 0.84, -1.4, 1.2);
      break;
    }
    case 'cast_charge': {
      state.triggerDuration = 1.25;
      state.castChargeLevel = 1;
      applySpitterSquash(state, 0.88, 1.16, -0.6, 1.8);
      break;
    }
    case 'take_hit': {
      state.triggerDuration = 0.68;
      state.hitFlashTimer = 0.24;
      applySpitterSquash(state, 0.78, 1.24, -2.2, 2.5);
      state.velX = 200;
      break;
    }
    case 'turn_around': {
      state.triggerDuration = Math.max(0.25, config.flipDurationSec * 2.1);
      startHorizontalFlip(state, true);
      applySpitterSquash(state, 0.9, 1.12);
      break;
    }
  }
}
