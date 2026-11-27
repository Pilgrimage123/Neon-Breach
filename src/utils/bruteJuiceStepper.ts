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
  type BruteCombatSyncInput,
  type BruteEvalCtx,
  type BruteJuiceConfig,
  type BruteJuiceSample,
  type BruteJuiceState,
  DEFAULT_BRUTE_JUICE_CONFIG,
  applyBruteSquash,
} from './bruteJuiceState';
import {
  applyBruteAttackBranch,
  applyBruteBraceBranch,
  syncBruteCombatCues,
} from './bruteJuiceBranches';

export function stepBruteJuice(
  state: BruteJuiceState,
  dt: number,
  elapsed: number,
  config: BruteJuiceConfig = DEFAULT_BRUTE_JUICE_CONFIG,
  combatSync?: BruteCombatSyncInput,
): BruteJuiceSample {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const idx = combatSync?.instanceIndex ?? 0;

  const { prevAttackU, prevBristleU, chitinShardTriggered } = syncBruteCombatCues(state, combatSync);

  const prevTriggerElapsed = state.triggerElapsed;
  if (state.activeTrigger !== 'idle' && state.triggerDuration > 0) {
    state.triggerElapsed += safeDt;
    if (state.triggerElapsed >= state.triggerDuration) {
      if (state.activeTrigger === 'stomp_walk' || state.activeTrigger === 'seismic_smash') {
        applyBruteSquash(state, 1.12, 0.89);
      }
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
      state.triggerDuration = 0;
    }
  }

  stepSymplecticSpringScale(state, safeDt, config.springStiffness, config.springDamping, 0.65, 1.44);
  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - safeDt);
  }

  const flipStep = stepHorizontalFlip(state, safeDt, config.flipDurationSec, 0.18, config.flipHopHeightPx, 0.15);
  if (flipStep.beganReturnFlip) applyBruteSquash(state, 1.12, 0.89);
  if (flipStep.completedFlip) applyBruteSquash(state, 1.14, 0.88);

  const ctx: BruteEvalCtx = {
    mode: 'idle',
    frameIndex: 1,
    targetPosX: 0,
    hopYPx: flipStep.hopYPx,
    rotationRad: 0,
    vialGlowIntensity: 0.24 + 0.1 * Math.sin(elapsed * 2.6 + idx),
    shellGlowIntensity: 0.16 + 0.08 * Math.sin(elapsed * 2.1 + idx * 0.9),
    shockwaveIntensity: 0,
    clawSlashProgress: 0,
    mutagenMistProgress: 0,
    seismicImpactProgress: 0,
    seismicImpactTriggered: false,
    vialShatterTriggered: false,
    footPlantTriggered: flipStep.completedFlip,
    swayAmpPx: 0,
    swayFreq: 2.1,
    swayPhase: elapsed * 2.1 + idx * 1.3,
    uvDistortAmp: [0, 0],
    uvDistortFreq: 10.0,
    uvDistortPhase: elapsed * 4.5 + idx,
    tintRgba: [1, 1, 1, 1],
    deform: createNeutralMeshDeform(),
  };

  const isDead = Boolean(combatSync?.dead);
  const hasCombatAttack =
    (combatSync?.attackAnimTimer ?? 0) > 0 && (combatSync?.attackAnimDuration ?? 0) > 0;
  const hasCombatHurt =
    (combatSync?.staggerTimer ?? 0) > 0 && (combatSync?.staggerDuration ?? 0) > 0;
  const hasCombatBrace =
    (combatSync?.bristleTimer ?? 0) > 0 && (combatSync?.bristleDuration ?? 0) > 0;

  let deathAlpha = 1;
  if (isDead) {
    ctx.mode = 'death';
    const death = sampleDeathCollapseFrame(combatSync?.koProgress ?? 0, 12, 4, 0.8);
    ctx.frameIndex = death.frameIndex;
    deathAlpha = death.alpha;
    ctx.vialGlowIntensity = Math.max(0, 0.35 * (1 - death.progress * 1.3));
    ctx.shellGlowIntensity = Math.max(0, 0.25 * (1 - death.progress * 1.3));
  } else if (state.activeTrigger === 'stomp_walk') {
    ctx.mode = 'idle';
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    ctx.targetPosX = -Math.sin(u * Math.PI) * 72;
    const isAdvancing = u < 0.55;

    state.stompTime += safeDt * config.stompSpeed;
    const stompSin = Math.sin(state.stompTime);
    const liftAbs = Math.abs(stompSin);
    const isAirborne = liftAbs > 0.34;
    ctx.frameIndex = isAirborne ? 0 : 1;
    if (state.wasAirborne && !isAirborne && safeDt > 0) {
      applyBruteSquash(state, 1.13, 0.88, 0.8, -0.9);
      ctx.footPlantTriggered = true;
    }
    state.wasAirborne = isAirborne;
    const airborneLift = isAirborne ? (liftAbs - 0.34) / 0.66 : 0;
    ctx.rotationRad += stompSin * config.stompMaxAngleRad * (isAirborne ? 1 : 0.45);
    ctx.hopYPx -= airborneLift * config.stompHopHeightPx;

    const leanDir = isAdvancing ? 1 : -0.6;
    ctx.deform.pelvis.dx = leanDir * 2.5;
    ctx.deform.waist.dx = leanDir * 5.2;
    ctx.deform.waist.dy = -airborneLift * 1.5;
    ctx.deform.head.dx = leanDir * 8.0;
    ctx.deform.head.rotRad = stompSin * 0.038;
    ctx.vialGlowIntensity = 0.44 + 0.14 * liftAbs;
    ctx.shellGlowIntensity = 0.36 + 0.12 * liftAbs;
  } else if (state.activeTrigger === 'seismic_smash' || hasCombatAttack) {
    applyBruteAttackBranch(ctx, state, config, hasCombatAttack, combatSync, prevAttackU, prevTriggerElapsed);
  } else if (state.activeTrigger === 'mutagen_brace' || hasCombatBrace) {
    applyBruteBraceBranch(
      ctx,
      state,
      elapsed,
      idx,
      config,
      hasCombatBrace,
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
    ctx.targetPosX = whip * 24;
    ctx.deform.pelvis.dx = -whip * 4.5;
    ctx.deform.waist.dx = -whip * 12.0;
    ctx.deform.waist.dy = whip * 3.0;
    ctx.deform.waist.rotRad = -whip * 0.095;
    ctx.deform.waist.scaleX = 1 + whip * 0.06;
    ctx.deform.head.dx = -whip * 18.5;
    ctx.deform.head.dy = whip * 5.2;
    ctx.deform.head.rotRad = -whip * 0.14;
    ctx.rotationRad = whip * 0.055;
    ctx.vialGlowIntensity = 0.35;
    ctx.shellGlowIntensity = 0.3 * (1 - u * 0.5);
  } else if (combatSync?.staggerHover) {
    ctx.mode = 'staggerHover';
    ctx.frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 8.5 + idx);
    ctx.shellGlowIntensity = 0.84 + 0.16 * pulse;
    ctx.vialGlowIntensity = 0.52 + 0.22 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.035;
    ctx.deform.head.dy = -pulse * 2.5;
  } else if (combatSync?.guardHover || combatSync?.armoredGuard) {
    ctx.mode = 'armoredGuard';
    ctx.frameIndex = 7;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.0 + idx);
    ctx.vialGlowIntensity = 0.66 + 0.24 * pulse;
    ctx.shellGlowIntensity = 0.48 + 0.2 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.026;
    ctx.deform.waist.dy = -pulse * 1.4;
    ctx.deform.head.dy = -pulse * 1.8;
  } else if (combatSync?.heavyPrimed) {
    ctx.mode = 'heavyPrimed';
    const heavyCycle = [8, 6, 8, 6] as const;
    const slot = Math.floor(Math.max(0, elapsed * 2.4 + idx * 1.1)) % heavyCycle.length;
    ctx.frameIndex = heavyCycle[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.8 + idx);
    const tremor = Math.sin(elapsed * 15.0 + idx) * 0.45;
    ctx.shellGlowIntensity = 0.72 + 0.26 * pulse;
    ctx.vialGlowIntensity = 0.52 + 0.18 * pulse;
    ctx.deform.pelvis.dx = tremor * 0.5;
    ctx.deform.pelvis.scaleX = 1 + pulse * 0.022;
    ctx.deform.waist.dx = tremor * 1.1;
    ctx.deform.waist.dy = -pulse * 2.4;
    ctx.deform.head.dx = tremor * 1.6;
    ctx.deform.head.dy = -pulse * 3.2;
    ctx.deform.head.rotRad = -0.022 + pulse * 0.024;
    const amp = 0.0018 * config.uvDistortStrength;
    ctx.uvDistortAmp = [amp, amp];
    ctx.uvDistortFreq = 9.5;
    ctx.uvDistortPhase = elapsed * 4.2 + idx;
  } else if (combatSync?.armorPrimed) {
    ctx.mode = 'armorPrimed';
    const armorCycle = [4, 7, 4, 7] as const;
    const slot = Math.floor(Math.max(0, elapsed * 1.85 + idx * 0.95)) % armorCycle.length;
    ctx.frameIndex = armorCycle[slot];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.4 + idx);
    ctx.vialGlowIntensity = 0.68 + 0.24 * pulse;
    ctx.shellGlowIntensity = 0.36 + 0.16 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.025;
    ctx.deform.waist.dy = -pulse * 1.5;
    ctx.deform.head.dy = -pulse * 2.0;
  } else if (combatSync?.pauseRecover) {
    ctx.mode = 'pauseRecover';
    const pauseCycle = [1, 3] as const;
    const slot = Math.floor(Math.max(0, elapsed * 1.35 + idx * 0.75)) % pauseCycle.length;
    ctx.frameIndex = pauseCycle[slot];
    const heave = Math.sin(elapsed * 2.1 + idx);
    ctx.deform.pelvis.dx = 1.2 + heave * 0.5;
    ctx.deform.waist.dx = 3.2 + heave * 1.1;
    ctx.deform.waist.dy = 2.8 - heave * 2.2;
    ctx.deform.waist.scaleX = 1 + heave * 0.036;
    ctx.deform.head.dx = 5.4 + heave * 1.6;
    ctx.deform.head.dy = 4.2 - heave * 2.8;
    ctx.deform.head.rotRad = 0.034 - heave * 0.018;
    ctx.vialGlowIntensity = 0.22 + 0.08 * heave;
    ctx.shellGlowIntensity = 0.24 + 0.1 * heave;
  } else {
    ctx.mode = 'idle';
    state.snarlTimer -= safeDt;
    if (state.snarlTimer <= 0) {
      state.snarlHoldTimer = 0.48;
      state.snarlVariant = 2;
      state.snarlTimer = 2.2 + ((idx * 0.79) % 1.1);
    }
    if (state.snarlHoldTimer > 0) {
      state.snarlHoldTimer = Math.max(0, state.snarlHoldTimer - safeDt);
      ctx.frameIndex = 2;
      ctx.vialGlowIntensity = 0.36;
      ctx.shellGlowIntensity = 0.28;
    } else {
      const idleBreathFrames = [1, 3] as const;
      const respSlot = Math.floor(Math.max(0, elapsed * 1.65 + idx * 0.9)) % idleBreathFrames.length;
      ctx.frameIndex = state.flipActive ? 0 : idleBreathFrames[respSlot];
    }
    const breath = Math.sin(ctx.swayPhase);
    ctx.deform.pelvis.dx = breath * 0.35;
    ctx.deform.waist.dx = breath * 1.05;
    ctx.deform.waist.dy = -breath * 1.35;
    ctx.deform.waist.scaleX = 1 + breath * 0.022;
    ctx.deform.head.dx = breath * 1.55;
    ctx.deform.head.dy = -breath * 1.95;
    ctx.deform.head.rotRad = breath * 0.013;
    ctx.swayAmpPx = 0.45;
  }

  if (combatSync?.staggeredStatus && !isDead) {
    ctx.mode = 'staggered';
    const dizzy = Math.sin(elapsed * 4.8 + idx);
    ctx.frameIndex = 13;
    ctx.deform.waist.dx += dizzy * 3.2;
    ctx.deform.head.dx += dizzy * 6.0;
    ctx.deform.head.rotRad += dizzy * 0.042;
    ctx.vialGlowIntensity = 0.16;
    ctx.shellGlowIntensity = 0.1;
  }

  const shearXPx = stepHorizontalVelocityShear(
    state,
    ctx.targetPosX,
    safeDt,
    16,
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
      0.98 + 0.02 * whiteMix,
      0.58 + 0.42 * whiteMix,
      0.18 + 0.82 * whiteMix,
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
    vialGlowIntensity: ctx.vialGlowIntensity,
    shellGlowIntensity: ctx.shellGlowIntensity,
    shockwaveIntensity: ctx.shockwaveIntensity,
    clawSlashProgress: ctx.clawSlashProgress,
    mutagenMistProgress: ctx.mutagenMistProgress,
    seismicImpactProgress: ctx.seismicImpactProgress,
    seismicImpactTriggered: ctx.seismicImpactTriggered,
    vialShatterTriggered: ctx.vialShatterTriggered,
    chitinShardTriggered,
    footPlantTriggered: ctx.footPlantTriggered,
    alpha: isDead ? deathAlpha : 1,
  };
}
