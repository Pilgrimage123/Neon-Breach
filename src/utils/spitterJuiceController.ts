/**
 * @file spitterJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Bile Spitter (`spitter`).
 */

import {
  applySpringSquashImpulse,
  createNeutralMeshDeform,
  type HorizontalFlipState,
  type HorizontalVelocityState,
  type JuiceControlPointKnot,
  type JuiceMeshDeform,
  type SpringScaleState,
  startHorizontalFlip,
  stepHorizontalFlip,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';
import {
  computeFrameTransitionState,
  type FrameTransitionResult,
  sampleDeathCollapseFrame,
} from './spriteSheetAnim';
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

interface SpitterEvalCtx {
  mode: SpitterAnimMode;
  frameIndex: number;
  alpha: number;
  targetPosX: number;
  hopYPx: number;
  rotationRad: number;
  pustuleGlowIntensity: number;
  spitWindupProgress: number;
  spitStreamProgress: number;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  tintRgba: [number, number, number, number];
  deform: SpitterMeshDeform;
}

function applySpitterAttackBranch(
  ctx: SpitterEvalCtx,
  state: SpitterJuiceState,
  safeDt: number,
  hasCombatAttack: boolean,
  combatSync: SpitterCombatSyncInput | undefined,
  prevTriggerElapsed: number,
): void {
  const isClaw = hasCombatAttack && combatSync?.spitterAttackKind === 'claw';
  const u = hasCombatAttack
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.attackAnimTimer! / combatSync!.attackAnimDuration!))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / Math.max(0.01, state.triggerDuration)));
  const prevU = hasCombatAttack
    ? u - safeDt / Math.max(0.01, combatSync!.attackAnimDuration!)
    : prevTriggerElapsed / Math.max(0.01, state.triggerDuration);

  if (prevU < 0.22 && u >= 0.22) {
    applySpitterSquash(state, 1.22, 0.82, 1.8, -1.4);
    state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.1);
  }

  if (isClaw) {
    ctx.mode = 'claw';
    if (u < 0.26) {
      const a = Math.sin((u / 0.26) * (Math.PI * 0.5));
      ctx.frameIndex = 8;
      ctx.targetPosX = a * 20;
      ctx.hopYPx -= a * 4;
      ctx.deform.waist.dx = -a * 6.0;
      ctx.deform.head.dx = -a * 10.0;
      ctx.rotationRad = a * 0.05;
      ctx.pustuleGlowIntensity = 0.65 + a * 0.2;
    } else if (u < 0.72) {
      const s = (u - 0.26) / 0.46;
      ctx.frameIndex = 9;
      ctx.targetPosX = -Math.sin(s * (Math.PI * 0.5)) * 74;
      ctx.hopYPx -= Math.sin(s * Math.PI) * 9;
      ctx.deform.pelvis.dx = 4.0;
      ctx.deform.waist.dx = 9.5;
      ctx.deform.head.dx = 15.0;
      ctx.rotationRad = -0.065;
      ctx.pustuleGlowIntensity = 0.88;
    } else {
      const r = (u - 0.72) / 0.28;
      const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
      ctx.frameIndex = 11;
      ctx.targetPosX = -74 * ease;
      ctx.deform.waist.dx = 5.0 * ease;
      ctx.deform.head.dx = 8.0 * ease;
      ctx.pustuleGlowIntensity = 0.52;
    }
    return;
  }

  ctx.mode = 'spit';
  if (u < 0.22) {
    const a = Math.sin((u / 0.22) * (Math.PI * 0.5));
    ctx.frameIndex = 4;
    ctx.targetPosX = a * 20;
    ctx.spitWindupProgress = a;
    ctx.deform.pelvis.dx = -a * 3.0;
    ctx.deform.waist.dx = -a * 7.5;
    ctx.deform.waist.dy = a * 2.2;
    ctx.deform.waist.scaleX = 1 + a * 0.11;
    ctx.deform.head.dx = -a * 12.0;
    ctx.deform.head.dy = -a * 3.0;
    ctx.deform.head.rotRad = -a * 0.09;
    ctx.rotationRad = a * 0.045;
    ctx.pustuleGlowIntensity = 0.58 + a * 0.36;
  } else if (u < 0.52) {
    const s = (u - 0.22) / 0.3;
    const thrust = Math.sin(s * (Math.PI * 0.5));
    ctx.frameIndex = 5;
    ctx.targetPosX = 20 * (1 - thrust) - thrust * 46;
    ctx.hopYPx -= Math.sin(s * Math.PI) * 5;
    ctx.spitStreamProgress = (u - 0.22) / 0.62;
    ctx.deform.pelvis.dx = 3.5 * thrust;
    ctx.deform.waist.dx = 8.5 * thrust;
    ctx.deform.waist.scaleX = 1.07 - 0.06 * s;
    ctx.deform.head.dx = 14.5 * thrust;
    ctx.deform.head.dy = 2.0 * thrust;
    ctx.deform.head.rotRad = 0.08 * thrust;
    ctx.rotationRad = -0.05 * thrust;
    ctx.pustuleGlowIntensity = 0.96;
  } else if (u < 0.84) {
    const f = (u - 0.52) / 0.32;
    ctx.frameIndex = 6;
    ctx.targetPosX = -46 * (1 - f * 0.35);
    ctx.spitStreamProgress = Math.min(1, (u - 0.22) / 0.62);
    ctx.deform.pelvis.dx = 2.8 * (1 - f * 0.3);
    ctx.deform.waist.dx = 7.0 * (1 - f * 0.3);
    ctx.deform.waist.scaleX = 0.95 + 0.05 * f;
    ctx.deform.head.dx = 12.0 * (1 - f * 0.3);
    ctx.deform.head.rotRad = 0.06 * (1 - f * 0.4);
    ctx.rotationRad = -0.035 * (1 - f * 0.5);
    ctx.pustuleGlowIntensity = 0.92 - f * 0.22;
  } else {
    const r = (u - 0.84) / 0.16;
    const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 7;
    ctx.targetPosX = -30 * ease;
    ctx.deform.waist.dx = 4.5 * ease;
    ctx.deform.head.dx = 7.5 * ease;
    ctx.pustuleGlowIntensity = 0.48;
  }
}

export function stepSpitterJuice(
  state: SpitterJuiceState,
  dt: number,
  elapsed: number,
  config: SpitterJuiceConfig = DEFAULT_SPITTER_JUICE_CONFIG,
  combatSync?: SpitterCombatSyncInput,
): SpitterJuiceSample {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const idx = combatSync?.instanceIndex ?? 0;

  if (combatSync) {
    const atkTimer = combatSync.attackAnimTimer ?? 0;
    if (atkTimer > state.lastSeenAttackTimer + 0.05) {
      applySpitterSquash(state, 1.15, 0.85, -1.2, 1.1);
    }
    state.lastSeenAttackTimer = atkTimer;

    const stagTimer = combatSync.staggerTimer ?? 0;
    if (stagTimer > state.lastSeenStaggerTimer + 0.05) {
      state.hitFlashTimer = 0.22;
      applySpitterSquash(state, 0.78, 1.24, -2.0, 2.2);
    }
    state.lastSeenStaggerTimer = stagTimer;

    const brisTimer = combatSync.bristleTimer ?? 0;
    if (brisTimer > state.lastSeenBristleTimer + 0.05) {
      applySpitterSquash(state, 1.16, 0.86, 1.4, -1.0);
    }
    state.lastSeenBristleTimer = brisTimer;
  }

  const prevTriggerElapsed = state.triggerElapsed;
  if (state.activeTrigger !== 'idle' && state.triggerDuration > 0) {
    state.triggerElapsed += safeDt;
    if (state.triggerElapsed >= state.triggerDuration) {
      if (state.activeTrigger === 'advance_retreat' || state.activeTrigger === 'attack_lunge') {
        applySpitterSquash(state, 1.08, 0.92);
      }
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
      state.triggerDuration = 0;
    }
  }

  stepSymplecticSpringScale(state, safeDt, config.springStiffness, config.springDamping, 0.6, 1.48);
  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - safeDt);
  }

  const flipStep = stepHorizontalFlip(state, safeDt, config.flipDurationSec, 0.15, config.flipHopHeightPx, 0.14);
  if (flipStep.beganReturnFlip) applySpitterSquash(state, 1.08, 0.93);
  if (flipStep.completedFlip) applySpitterSquash(state, 1.09, 0.92);

  const ctx: SpitterEvalCtx = {
    mode: 'idle',
    frameIndex: 0,
    alpha: 1,
    targetPosX: 0,
    hopYPx: flipStep.hopYPx,
    rotationRad: 0,
    pustuleGlowIntensity: 0.28 + 0.12 * Math.sin(elapsed * 2.6 + idx),
    spitWindupProgress: 0,
    spitStreamProgress: 0,
    swayAmpPx: 0,
    swayFreq: 2.2,
    swayPhase: elapsed * 2.2 + idx * 1.4,
    uvDistortAmp: [0, 0],
    uvDistortFreq: 14.0,
    uvDistortPhase: elapsed * 5.5 + idx,
    tintRgba: [1, 1, 1, 1],
    deform: createNeutralMeshDeform(),
  };

  const isDead = Boolean(combatSync?.dead);
  const hasCombatAttack =
    (combatSync?.attackAnimTimer ?? 0) > 0 && (combatSync?.attackAnimDuration ?? 0) > 0;
  const hasCombatHurt =
    (combatSync?.staggerTimer ?? 0) > 0 && (combatSync?.staggerDuration ?? 0) > 0;
  const hasCombatRupture =
    (combatSync?.bristleTimer ?? 0) > 0 && (combatSync?.bristleDuration ?? 0) > 0;

  if (isDead) {
    const death = sampleDeathCollapseFrame(combatSync?.koProgress ?? 0, 12, 4, 0.8);
    ctx.mode = 'death';
    ctx.frameIndex = death.frameIndex;
    ctx.alpha = death.alpha;
    ctx.pustuleGlowIntensity = Math.max(0, 0.55 * (1 - death.progress * 1.2));
  } else if (state.activeTrigger === 'advance_retreat') {
    ctx.mode = 'idle';
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    ctx.targetPosX = -Math.sin(u * Math.PI) * 84;
    const isAdvancing = u < 0.5;
    state.waddleTime += safeDt * config.waddleSpeed;
    const waddleSin = Math.sin(state.waddleTime);
    const liftAbs = Math.abs(waddleSin);
    const isAirborneStride = liftAbs > 0.34;
    if (state.wasAirborne && !isAirborneStride) {
      applySpitterSquash(state, 1.07, 0.93, 0.25, -0.25);
    }
    state.wasAirborne = isAirborneStride;
    ctx.frameIndex = isAirborneStride ? 2 : 1;
    const strideArc = isAirborneStride ? (liftAbs - 0.34) / 0.66 : 0;
    ctx.rotationRad += waddleSin * config.waddleMaxAngleRad;
    ctx.hopYPx -= strideArc * config.waddleHopHeightPx;
    const leanDir = isAdvancing ? 1 : -0.65;
    ctx.deform.pelvis.dx = leanDir * 2.2;
    ctx.deform.waist.dx = leanDir * 5.0;
    ctx.deform.waist.dy = -strideArc * 1.8;
    ctx.deform.head.dx = leanDir * 8.2;
    ctx.deform.head.rotRad = waddleSin * 0.04;
    ctx.pustuleGlowIntensity = 0.52 + 0.18 * liftAbs;
  } else if (state.activeTrigger === 'attack_lunge' || hasCombatAttack) {
    applySpitterAttackBranch(ctx, state, safeDt, hasCombatAttack, combatSync, prevTriggerElapsed);
  } else if (state.activeTrigger === 'cast_charge' || combatSync?.blightPrimed || hasCombatRupture) {
    ctx.mode = hasCombatRupture ? 'rupture' : 'blightCharge';
    const chargeProgress =
      state.activeTrigger === 'cast_charge'
        ? Math.min(1, state.triggerElapsed / Math.max(0.2, state.triggerDuration * 0.65))
        : hasCombatRupture
          ? 1.0
          : 0.55;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2 + idx);
    const organicTremor = Math.sin(elapsed * 16 + idx) * chargeProgress * 0.45;
    ctx.frameIndex = hasCombatRupture ? 10 : 4;
    ctx.pustuleGlowIntensity = 0.74 + 0.24 * pulse;
    ctx.spitWindupProgress =
      state.activeTrigger === 'cast_charge' ? chargeProgress * 0.85 : pulse * 0.45;
    ctx.deform.pelvis.dx = organicTremor * 0.6;
    ctx.deform.pelvis.dy = -chargeProgress * 1.8;
    ctx.deform.waist.dx = organicTremor * 1.2;
    ctx.deform.waist.dy = -chargeProgress * 5.2 - pulse * 1.6;
    ctx.deform.waist.scaleX = 1 + chargeProgress * 0.11 + pulse * 0.04;
    ctx.deform.head.dx = organicTremor * 1.8;
    ctx.deform.head.dy = -chargeProgress * 8.2 - pulse * 2.2;
    ctx.deform.head.rotRad = organicTremor * 0.015 - chargeProgress * 0.04;
    if (state.activeTrigger === 'cast_charge' || hasCombatRupture) {
      const amp = (0.0035 + 0.0045 * chargeProgress) * config.uvDistortStrength;
      ctx.uvDistortAmp = [amp, amp * 1.1];
      ctx.uvDistortFreq = 14 + chargeProgress * 6;
      ctx.uvDistortPhase = elapsed * 6.5 + idx;
    }
    ctx.tintRgba = [0.95 + 0.05 * pulse, 1.0, 0.86 + 0.14 * pulse, 1.0];
  } else if (state.activeTrigger === 'take_hit' || hasCombatHurt) {
    ctx.mode = 'pain';
    const u = hasCombatHurt
      ? Math.max(0, Math.min(0.999, 1 - combatSync!.staggerTimer! / combatSync!.staggerDuration!))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / Math.max(0.01, state.triggerDuration)));
    ctx.frameIndex = u < 0.48 ? 12 : 13;
    const whip = Math.sin(u * Math.PI) * Math.pow(1 - u, 1.15);
    ctx.targetPosX = whip * 30;
    ctx.deform.pelvis.dx = -whip * 5.0;
    ctx.deform.waist.dx = -whip * 13.0;
    ctx.deform.waist.dy = whip * 3.5;
    ctx.deform.waist.rotRad = -whip * 0.11;
    ctx.deform.waist.scaleX = 1 + whip * 0.07;
    ctx.deform.head.dx = -whip * 20.0;
    ctx.deform.head.dy = whip * 6.0;
    ctx.deform.head.rotRad = -whip * 0.16;
    ctx.rotationRad = whip * 0.065;
    ctx.pustuleGlowIntensity = 0.85 * (1 - u * 0.4);
  } else if (combatSync?.pustuleHover || combatSync?.armoredGuard) {
    ctx.mode = 'guard';
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.0 + idx);
    ctx.frameIndex = combatSync.pustuleHover ? 10 : 11;
    ctx.pustuleGlowIntensity = (combatSync.pustuleHover ? 0.86 : 0.58) + 0.14 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.03;
    ctx.deform.waist.dy = -pulse * 1.4;
    ctx.deform.head.dy = -pulse * 2.0;
  } else {
    state.blinkTimer -= safeDt;
    if (state.blinkTimer <= 0) {
      state.blinkHoldTimer = 0.2;
      state.blinkTimer = 2.4 + ((idx * 0.73) % 1.1);
    }
    if (state.blinkHoldTimer > 0) {
      state.blinkHoldTimer = Math.max(0, state.blinkHoldTimer - safeDt);
      ctx.frameIndex = 1;
    } else {
      ctx.frameIndex = state.flipActive ? 2 : 0;
    }
    const breath = Math.sin(ctx.swayPhase);
    ctx.deform.pelvis.dx = breath * 0.45;
    ctx.deform.waist.dx = breath * 1.05;
    ctx.deform.waist.dy = -breath * 1.15;
    ctx.deform.waist.scaleX = 1 + breath * 0.018;
    ctx.deform.head.dx = breath * 1.65;
    ctx.deform.head.dy = -breath * 1.75;
    ctx.deform.head.rotRad = breath * 0.012;
    ctx.swayAmpPx = 0.45;
  }

  if (combatSync?.staggeredStatus && !isDead) {
    const dizzy = Math.sin(elapsed * 5.2 + idx);
    ctx.deform.waist.dx += dizzy * 3.5;
    ctx.deform.head.dx += dizzy * 6.5;
    ctx.deform.head.rotRad += dizzy * 0.045;
  }

  const shearXPx = stepHorizontalVelocityShear(
    state,
    ctx.targetPosX,
    safeDt,
    18,
    config.velocitySkewFactor,
    config.maxSkewPx,
  );

  const blendDur = 0;
  state.transition = computeFrameTransitionState(state.transition, ctx.frameIndex, safeDt, blendDur);

  let flashRgba: [number, number, number, number] | null = null;
  if (state.hitFlashTimer > 0) {
    const flashAlpha = Math.min(0.85, state.hitFlashTimer * 3.8);
    const whiteMix = Math.min(1, state.hitFlashTimer * 5.0);
    flashRgba = [
      0.75 + 0.25 * whiteMix,
      0.95 + 0.05 * whiteMix,
      0.39 + 0.61 * whiteMix,
      flashAlpha,
    ];
  }

  return {
    mode: ctx.mode,
    activeTrigger: state.activeTrigger,
    frameIndex: ctx.frameIndex,
    prevFrameIndex: state.transition.prevFrameIndex,
    frameBlendAlpha: isDead ? 1 : state.transition.frameBlendAlpha,
    alpha: ctx.alpha,
    springScaleX: state.springScaleX,
    springScaleY: state.springScaleY,
    rotationRad: ctx.rotationRad,
    offsetX: state.posX,
    hopYPx: ctx.hopYPx,
    shearXPx,
    facingScale: state.currentFacingScale,
    deform: ctx.deform,
    swayAmpPx: ctx.swayAmpPx,
    swayFreq: ctx.swayFreq,
    swayPhase: ctx.swayPhase,
    uvDistortAmp: ctx.uvDistortAmp,
    uvDistortFreq: ctx.uvDistortFreq,
    uvDistortPhase: ctx.uvDistortPhase,
    flashRgba,
    tintRgba: ctx.tintRgba,
    pustuleGlowIntensity: ctx.pustuleGlowIntensity,
    spitWindupProgress: ctx.spitWindupProgress,
    spitStreamProgress: ctx.spitStreamProgress,
  };
}
