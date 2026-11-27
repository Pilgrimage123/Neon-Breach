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
  type MutdogCombatSyncInput,
  type MutdogEvalCtx,
  type MutdogJuiceConfig,
  type MutdogJuiceSample,
  type MutdogJuiceState,
  DEFAULT_MUTDOG_JUICE_CONFIG,
  applyMutdogSquash,
} from './mutdogJuiceState';
import {
  applyMutdogAttackBranch,
  applyMutdogHowlBranch,
  syncMutdogCombatCues,
} from './mutdogJuiceBranches';

export function stepMutdogJuice(
  state: MutdogJuiceState,
  dt: number,
  elapsed: number,
  config: MutdogJuiceConfig = DEFAULT_MUTDOG_JUICE_CONFIG,
  combatSync?: MutdogCombatSyncInput,
): MutdogJuiceSample {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const idx = combatSync?.instanceIndex ?? 0;

  const { prevAttackU, prevBristleU, droolBurstTriggered: syncDroolBurst } = syncMutdogCombatCues(
    state,
    combatSync,
  );

  const prevTriggerElapsed = state.triggerElapsed;
  if (state.activeTrigger !== 'idle' && state.triggerDuration > 0) {
    state.triggerElapsed += safeDt;
    if (state.triggerElapsed >= state.triggerDuration) {
      if (state.activeTrigger === 'prowl_stalk' || state.activeTrigger === 'pounce_maul') {
        applyMutdogSquash(state, 1.12, 0.89);
      }
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
      state.triggerDuration = 0;
    }
  }

  stepSymplecticSpringScale(state, safeDt, config.springStiffness, config.springDamping, 0.64, 1.46);
  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - safeDt);
  }

  const flipStep = stepHorizontalFlip(
    state,
    safeDt,
    config.flipDurationSec,
    0.16,
    config.flipHopHeightPx,
    0.15,
  );
  if (flipStep.beganReturnFlip) applyMutdogSquash(state, 1.13, 0.88);
  if (flipStep.completedFlip) applyMutdogSquash(state, 1.15, 0.87);

  const ctx: MutdogEvalCtx = {
    mode: 'idle',
    frameIndex: 0,
    targetPosX: 0,
    hopYPx: flipStep.hopYPx,
    rotationRad: 0,
    lureGlowIntensity: 0.44 + 0.16 * Math.sin(elapsed * 3.4 + idx),
    droolIntensity: 0.36 + 0.14 * Math.sin(elapsed * 2.8 + idx * 0.9),
    clawSlashProgress: 0,
    pounceImpactProgress: 0,
    howlPulseProgress: 0,
    pounceImpactTriggered: false,
    droolBurstTriggered: syncDroolBurst,
    pawPlantTriggered: flipStep.completedFlip,
    swayAmpPx: 0,
    swayFreq: 2.6,
    swayPhase: elapsed * 2.6 + idx * 1.3,
    uvDistortAmp: [0, 0],
    uvDistortFreq: 10.5,
    uvDistortPhase: elapsed * 4.8 + idx,
    tintRgba: [1, 1, 1, 1],
    deform: createNeutralMeshDeform(),
  };

  const isDead = Boolean(combatSync?.dead);
  const hasCombatAttack =
    (combatSync?.attackAnimTimer ?? 0) > 0 && (combatSync?.attackAnimDuration ?? 0) > 0;
  const hasCombatHurt =
    (combatSync?.staggerTimer ?? 0) > 0 && (combatSync?.staggerDuration ?? 0) > 0;
  const hasCombatHowl =
    (combatSync?.bristleTimer ?? 0) > 0 && (combatSync?.bristleDuration ?? 0) > 0;

  let deathAlpha = 1;
  if (isDead) {
    ctx.mode = 'death';
    const death = sampleDeathCollapseFrame(combatSync?.koProgress ?? 0, 12, 4, 0.8);
    ctx.frameIndex = death.frameIndex;
    deathAlpha = death.alpha;
    ctx.lureGlowIntensity = Math.max(0, 0.45 * (1 - death.progress * 1.4));
    ctx.droolIntensity = Math.max(0, 0.35 * (1 - death.progress * 1.3));
  } else if (state.activeTrigger === 'prowl_stalk') {
    ctx.mode = 'idle';
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    ctx.targetPosX = -Math.sin(u * Math.PI) * 84;
    const isAdvancing = u < 0.54;

    state.prowlTime += safeDt * config.prowlSpeed;
    const prowlSin = Math.sin(state.prowlTime);
    const liftAbs = Math.abs(prowlSin);
    const isAirborne = liftAbs > 0.36;
    ctx.frameIndex = isAirborne ? 7 : liftAbs > 0.16 ? 5 : 3;
    if (state.wasAirborne && !isAirborne && safeDt > 0) {
      applyMutdogSquash(state, 1.14, 0.87, 0.9, -1.0);
      ctx.pawPlantTriggered = true;
    }
    state.wasAirborne = isAirborne;
    const airborneLift = isAirborne ? (liftAbs - 0.36) / 0.64 : 0;
    ctx.rotationRad += prowlSin * config.prowlMaxAngleRad * (isAirborne ? 1 : 0.45);
    ctx.hopYPx -= airborneLift * config.prowlHopHeightPx;

    const leanDir = isAdvancing ? 1 : -0.65;
    ctx.deform.pelvis.dx = leanDir * 3.0;
    ctx.deform.waist.dx = leanDir * 6.5;
    ctx.deform.waist.dy = -airborneLift * 2.2;
    ctx.deform.head.dx = leanDir * 10.0;
    ctx.deform.head.rotRad = prowlSin * 0.048;
    ctx.lureGlowIntensity = 0.64 + 0.18 * liftAbs;
    ctx.droolIntensity = 0.66 + 0.16 * liftAbs;
  } else if (state.activeTrigger === 'pounce_maul' || hasCombatAttack) {
    applyMutdogAttackBranch(
      ctx,
      state,
      config,
      hasCombatAttack,
      combatSync,
      prevAttackU,
      prevTriggerElapsed,
    );
  } else if (state.activeTrigger === 'frenzy_howl' || hasCombatHowl) {
    applyMutdogHowlBranch(
      ctx,
      state,
      elapsed,
      idx,
      config,
      hasCombatHowl,
      combatSync,
      prevBristleU,
      prevTriggerElapsed,
    );
  } else if (state.activeTrigger === 'take_hit' || hasCombatHurt) {
    ctx.mode = 'pain';
    const dur = hasCombatHurt
      ? Math.max(0.01, combatSync!.staggerDuration!)
      : Math.max(0.01, state.triggerDuration);
    const u = hasCombatHurt
      ? Math.max(0, Math.min(0.999, 1 - combatSync!.staggerTimer! / dur))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
    ctx.frameIndex = u < 0.46 ? 12 : 13;
    const whip = Math.sin(u * Math.PI) * Math.pow(1 - u, 1.15);
    ctx.targetPosX = whip * 28;
    ctx.deform.pelvis.dx = -whip * 5.0;
    ctx.deform.waist.dx = -whip * 13.5;
    ctx.deform.waist.dy = whip * 3.4;
    ctx.deform.waist.rotRad = -whip * 0.11;
    ctx.deform.waist.scaleX = 1 + whip * 0.07;
    ctx.deform.head.dx = -whip * 21.0;
    ctx.deform.head.dy = whip * 5.8;
    ctx.deform.head.rotRad = -whip * 0.16;
    ctx.rotationRad = whip * 0.068;
    ctx.lureGlowIntensity = 0.46 * (1 - u * 0.45);
    ctx.droolIntensity = 0.88 * (1 - u * 0.3);
  } else if (combatSync?.staggerHover) {
    ctx.mode = 'staggerHover';
    ctx.frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 9.2 + idx);
    ctx.lureGlowIntensity = 0.86 + 0.14 * pulse;
    ctx.droolIntensity = 0.72 + 0.2 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.038;
    ctx.deform.head.dy = -pulse * 2.8;
  } else if (combatSync?.guardHover || combatSync?.feralGuard) {
    ctx.mode = 'feralGuard';
    ctx.frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.6 + idx);
    ctx.lureGlowIntensity = 0.72 + 0.22 * pulse;
    ctx.droolIntensity = 0.58 + 0.18 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.028;
    ctx.deform.waist.dy = -pulse * 1.5;
    ctx.deform.head.dy = -pulse * 2.0;
  } else if (combatSync?.maulPrimed) {
    ctx.mode = 'maulPrimed';
    const maulCycle = [5, 6, 5, 2] as const;
    const slot = Math.floor(Math.max(0, elapsed * 2.8 + idx * 1.1)) % maulCycle.length;
    ctx.frameIndex = maulCycle[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.8 + idx);
    const tremor = Math.sin(elapsed * 18.0 + idx) * 0.55;
    ctx.lureGlowIntensity = 0.82 + 0.18 * pulse;
    ctx.droolIntensity = 0.80 + 0.18 * pulse;
    ctx.deform.pelvis.dx = tremor * 0.6;
    ctx.deform.pelvis.scaleX = 1 + pulse * 0.025;
    ctx.deform.waist.dx = tremor * 1.3;
    ctx.deform.waist.dy = -pulse * 2.6;
    ctx.deform.head.dx = tremor * 2.0;
    ctx.deform.head.dy = -pulse * 3.4;
    ctx.deform.head.rotRad = -0.026 + pulse * 0.028;
    const amp = 0.0018 * config.uvDistortStrength;
    ctx.uvDistortAmp = [amp, amp];
    ctx.uvDistortFreq = 10.5;
    ctx.uvDistortPhase = elapsed * 4.8 + idx;
  } else if (combatSync?.pouncePrimed) {
    ctx.mode = 'pouncePrimed';
    const pounceCycle = [5, 2, 5, 1] as const;
    const slot = Math.floor(Math.max(0, elapsed * 2.25 + idx * 0.95)) % pounceCycle.length;
    ctx.frameIndex = pounceCycle[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2 + idx);
    ctx.lureGlowIntensity = 0.68 + 0.22 * pulse;
    ctx.droolIntensity = 0.62 + 0.16 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.028;
    ctx.deform.waist.dy = 1.6 - pulse * 1.8;
    ctx.deform.head.dx = 2.4 + pulse * 1.6;
    ctx.deform.head.dy = -pulse * 1.8;
  } else if (combatSync?.pauseRecover) {
    ctx.mode = 'pauseRecover';
    const pauseCycle = [0, 1] as const;
    const slot = Math.floor(Math.max(0, elapsed * 1.5 + idx * 0.75)) % pauseCycle.length;
    ctx.frameIndex = pauseCycle[slot];
    const heave = Math.sin(elapsed * 2.7 + idx);
    ctx.deform.pelvis.dx = 1.2 + heave * 0.6;
    ctx.deform.waist.dx = 3.4 + heave * 1.2;
    ctx.deform.waist.dy = 3.0 - heave * 2.4;
    ctx.deform.waist.scaleX = 1 + heave * 0.04;
    ctx.deform.head.dx = 5.6 + heave * 1.8;
    ctx.deform.head.dy = 4.4 - heave * 2.8;
    ctx.deform.head.rotRad = 0.036 - heave * 0.02;
    ctx.lureGlowIntensity = 0.28 + 0.09 * heave;
    ctx.droolIntensity = 0.58 + 0.14 * heave;
  } else {
    ctx.mode = 'idle';
    state.snarlTimer -= safeDt;
    if (state.snarlTimer <= 0) {
      state.snarlHoldTimer = 0.44;
      state.snarlVariant = 2;
      state.snarlTimer = 1.85 + ((idx * 0.73) % 1.05);
    }
    if (state.snarlHoldTimer > 0) {
      state.snarlHoldTimer = Math.max(0, state.snarlHoldTimer - safeDt);
      ctx.frameIndex = 2;
      ctx.lureGlowIntensity = 0.70;
      ctx.droolIntensity = 0.68;
    } else {
      const respSlot = Math.floor(Math.max(0, elapsed * 2.15 + idx * 0.9)) % 2;
      ctx.frameIndex = state.flipActive ? 7 : respSlot;
    }
    const breath = Math.sin(ctx.swayPhase);
    ctx.deform.pelvis.dx = breath * 0.5;
    ctx.deform.waist.dx = breath * 1.2;
    ctx.deform.waist.dy = -breath * 1.5;
    ctx.deform.waist.scaleX = 1 + breath * 0.025;
    ctx.deform.head.dx = breath * 1.8;
    ctx.deform.head.dy = -breath * 2.2;
    ctx.deform.head.rotRad = breath * 0.016;
    ctx.swayAmpPx = 0.52;
  }

  if (combatSync?.staggeredStatus && !isDead) {
    ctx.mode = 'staggered';
    const dizzy = Math.sin(elapsed * 5.2 + idx);
    ctx.frameIndex = 13;
    ctx.deform.waist.dx += dizzy * 3.4;
    ctx.deform.head.dx += dizzy * 6.4;
    ctx.deform.head.rotRad += dizzy * 0.048;
    ctx.lureGlowIntensity = 0.18;
    ctx.droolIntensity = 0.64;
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
    const flashAlpha = Math.min(0.58, state.hitFlashTimer * 2.8);
    const whiteMix = Math.min(1, state.hitFlashTimer * 4.8);
    flashRgba = [
      0.78 + 0.22 * whiteMix,
      0.95 + 0.05 * whiteMix,
      0.24 + 0.76 * whiteMix,
      flashAlpha,
    ];
  }

  return {
    mode: ctx.mode,
    activeTrigger: state.activeTrigger,
    frameIndex: ctx.frameIndex,
    prevFrameIndex: state.transition.prevFrameIndex,
    frameBlendAlpha: isDead ? 1 : state.transition.frameBlendAlpha,
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
    lureGlowIntensity: ctx.lureGlowIntensity,
    droolIntensity: ctx.droolIntensity,
    clawSlashProgress: ctx.clawSlashProgress,
    pounceImpactProgress: ctx.pounceImpactProgress,
    howlPulseProgress: ctx.howlPulseProgress,
    pounceImpactTriggered: ctx.pounceImpactTriggered,
    droolBurstTriggered: ctx.droolBurstTriggered,
    pawPlantTriggered: ctx.pawPlantTriggered,
    alpha: isDead ? deathAlpha : 1,
  };
}
