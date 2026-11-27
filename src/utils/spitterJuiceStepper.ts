/**
 * @file spitterJuiceStepper.ts
 * Main 4-layer procedural physics & frame stepper for the Bile Spitter (`spitter`).
 */

import {
  createNeutralMeshDeform,
  stepHorizontalFlip,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';
import {
  computeFrameTransitionState,
  sampleDeathCollapseFrame,
} from './spriteSheetAnim';
import {
  applySpitterAttackBranch,
  type SpitterEvalCtx,
} from './spitterJuiceBranches';
import {
  applySpitterSquash,
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterCombatSyncInput,
  type SpitterJuiceConfig,
  type SpitterJuiceSample,
  type SpitterJuiceState,
} from './spitterJuiceState';

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
