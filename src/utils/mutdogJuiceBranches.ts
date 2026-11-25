import {
  type MutdogCombatSyncInput,
  type MutdogEvalCtx,
  type MutdogJuiceConfig,
  type MutdogJuiceState,
  applyMutdogSquash,
} from './mutdogJuiceState';

export function syncMutdogCombatCues(
  state: MutdogJuiceState,
  combatSync: MutdogCombatSyncInput | undefined,
): { prevAttackU: number; prevBristleU: number; droolBurstTriggered: boolean } {
  let prevAttackU = 0;
  let prevBristleU = 0;
  let droolBurstTriggered = state.pendingDroolBurst;
  state.pendingDroolBurst = false;
  if (!combatSync) return { prevAttackU, prevBristleU, droolBurstTriggered };

  const atkTimer = combatSync.attackAnimTimer ?? 0;
  const atkDur = combatSync.attackAnimDuration ?? 0.68;
  if (atkTimer > state.lastSeenAttackTimer + 0.05) {
    applyMutdogSquash(state, 1.18, 0.82, 1.3, -1.5);
    droolBurstTriggered = true;
  }
  if (atkDur > 0 && state.lastSeenAttackTimer > 0) {
    prevAttackU = Math.max(0, Math.min(1, 1 - state.lastSeenAttackTimer / atkDur));
  }
  state.lastSeenAttackTimer = atkTimer;

  const stagTimer = combatSync.staggerTimer ?? 0;
  if (stagTimer > state.lastSeenStaggerTimer + 0.05) {
    state.hitFlashTimer = 0.22;
    applyMutdogSquash(state, 0.78, 1.22, -2.0, 2.2);
    droolBurstTriggered = true;
  }
  state.lastSeenStaggerTimer = stagTimer;

  const brisTimer = combatSync.bristleTimer ?? 0;
  const brisDur = combatSync.bristleDuration ?? 0.74;
  if (brisTimer > state.lastSeenBristleTimer + 0.05) {
    applyMutdogSquash(state, 0.88, 1.15, -0.9, 1.2);
    droolBurstTriggered = true;
  }
  if (brisDur > 0 && state.lastSeenBristleTimer > 0) {
    prevBristleU = Math.max(0, Math.min(1, 1 - state.lastSeenBristleTimer / brisDur));
  }
  state.lastSeenBristleTimer = brisTimer;

  return { prevAttackU, prevBristleU, droolBurstTriggered };
}

export function applyMutdogAttackBranch(
  ctx: MutdogEvalCtx,
  state: MutdogJuiceState,
  config: MutdogJuiceConfig,
  hasCombatAttack: boolean,
  combatSync: MutdogCombatSyncInput | undefined,
  prevAttackU: number,
  prevTriggerElapsed: number,
): void {
  const isMaul =
    state.activeTrigger === 'pounce_maul' || combatSync?.mutdogAttackKind === 'maul';
  const dur = hasCombatAttack
    ? Math.max(0.01, combatSync!.attackAnimDuration!)
    : Math.max(0.01, state.triggerDuration);
  const u = hasCombatAttack
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.attackAnimTimer! / dur))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
  const prevU = hasCombatAttack ? prevAttackU : prevTriggerElapsed / dur;

  if (isMaul) {
    ctx.mode = 'pounceMaul';
    if (prevU < 0.48 && u >= 0.48) {
      const s = Math.max(0.5, config.feralVfxStrength);
      applyMutdogSquash(state, 1 + 0.28 * s, 1 - 0.26 * s, 2.5 * s, -2.3 * s);
      state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.11);
      ctx.pounceImpactTriggered = true;
      ctx.droolBurstTriggered = true;
    }

    if (u < 0.22) {
      // Beat 1: High-tension coiled haunches & head reared back
      const a = 0.5 - 0.5 * Math.cos((u / 0.22) * Math.PI);
      ctx.frameIndex = 8;
      ctx.targetPosX = a * 22;
      ctx.hopYPx += a * 3;
      ctx.rotationRad = a * 0.072;
      ctx.deform.pelvis.dx = -a * 4.2;
      ctx.deform.pelvis.dy = a * 2.2;
      ctx.deform.pelvis.scaleX = 1 + a * 0.08;
      ctx.deform.waist.dx = -a * 8.4;
      ctx.deform.waist.dy = a * 4.0;
      ctx.deform.waist.scaleX = 1 + a * 0.06;
      ctx.deform.head.dx = -a * 12.5;
      ctx.deform.head.dy = -a * 2.4;
      ctx.deform.head.rotRad = -a * 0.095;
      ctx.lureGlowIntensity = 0.78 + a * 0.22;
      ctx.droolIntensity = 0.82;
    } else if (u < 0.48) {
      // Beat 2: Explosive airborne feral pounce with quartic hang-time arc
      const s = (u - 0.22) / 0.26;
      const thrust = Math.sin(s * (Math.PI * 0.5));
      const hangArc = 1 - Math.pow(2 * s - 1, 4);
      ctx.frameIndex = 9;
      ctx.targetPosX = 22 * (1 - thrust) - thrust * 88;
      ctx.hopYPx -= hangArc * 38;
      ctx.rotationRad = (0.045 * (1 - s) - 0.068 * s) * thrust;
      ctx.deform.pelvis.dx = 4.5 * thrust;
      ctx.deform.waist.dx = 9.5 * thrust;
      ctx.deform.waist.dy = -6.0 * hangArc;
      ctx.deform.waist.scaleX = 0.91;
      ctx.deform.head.dx = 15.5 * thrust;
      ctx.deform.head.dy = -10.5 * hangArc;
      ctx.deform.head.rotRad = 0.088 * thrust;
      ctx.lureGlowIntensity = 1.0;
      ctx.droolIntensity = 1.0;
    } else if (u < 0.78) {
      // Beat 3: Savage Maul slam crunch + raking claw crescent
      const f = (u - 0.48) / 0.30;
      const isCrunchHold = f < 0.36;
      const crunch = isCrunchHold
        ? 1.0
        : Math.sin((1 - ((f - 0.36) / 0.64) * 0.55) * (Math.PI * 0.5));
      ctx.frameIndex = 10;
      ctx.targetPosX = -88 * (1 - Math.max(0, f - 0.28) * 0.20);
      ctx.rotationRad = -0.102 * crunch;
      ctx.deform.pelvis.dx = 5.5 * crunch;
      ctx.deform.pelvis.dy = 2.8 * crunch;
      ctx.deform.waist.dx = 11.2 * crunch;
      ctx.deform.waist.dy = 6.6 * crunch;
      ctx.deform.waist.scaleX = 1 + 0.135 * crunch;
      ctx.deform.head.dx = 17.5 * crunch;
      ctx.deform.head.dy = 9.5 * crunch;
      ctx.deform.head.rotRad = 0.14 * crunch;
      ctx.pounceImpactProgress = Math.min(1, f);
      ctx.clawSlashProgress = Math.max(0.01, Math.min(1, f * 1.15));
      ctx.lureGlowIntensity = 1.0 - f * 0.22;
      ctx.droolIntensity = 0.98;
    } else {
      // Beat 4: Feral claw-rend follow-through & recoil spring-back
      const r = (u - 0.78) / 0.22;
      const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
      ctx.frameIndex = 11;
      ctx.targetPosX = -70 * ease;
      ctx.rotationRad = -0.042 * ease;
      ctx.deform.waist.dx = 6.2 * ease;
      ctx.deform.head.dx = 10.5 * ease;
      ctx.clawSlashProgress = Math.max(0, 1 - r * 1.4);
      ctx.lureGlowIntensity = 0.58 * ease + 0.32;
      ctx.droolIntensity = 0.68;
    }
    return;
  }

  // Fast Feral Pounce + Triple Claw Rend (`pounce`)
  ctx.mode = 'clawRend';
  if (prevU < 0.38 && u >= 0.38) {
    applyMutdogSquash(state, 1.22, 0.82, 1.8, -1.4);
    ctx.droolBurstTriggered = true;
  }
  if (u < 0.20) {
    const a = 0.5 - 0.5 * Math.cos((u / 0.20) * Math.PI);
    ctx.frameIndex = 3;
    ctx.targetPosX = a * 18;
    ctx.hopYPx += a * 3;
    ctx.rotationRad = a * 0.052;
    ctx.deform.waist.dx = -a * 6.5;
    ctx.deform.waist.dy = a * 3.5;
    ctx.deform.head.dx = -a * 11.0;
    ctx.lureGlowIntensity = 0.72;
    ctx.droolIntensity = 0.72;
  } else if (u < 0.44) {
    const s = (u - 0.20) / 0.24;
    const thrust = Math.sin(s * (Math.PI * 0.5));
    ctx.frameIndex = 9;
    ctx.targetPosX = 18 * (1 - thrust) - thrust * 76;
    ctx.hopYPx -= Math.sin(s * Math.PI) * 24;
    ctx.rotationRad = -0.072 * thrust;
    ctx.deform.pelvis.dx = 4.2 * thrust;
    ctx.deform.waist.dx = 9.2 * thrust;
    ctx.deform.head.dx = 15.0 * thrust;
    ctx.deform.head.rotRad = 0.078 * thrust;
    ctx.lureGlowIntensity = 0.94;
    ctx.droolIntensity = 0.92;
  } else if (u < 0.78) {
    const s = (u - 0.44) / 0.34;
    const thrust = Math.sin(s * (Math.PI * 0.5));
    ctx.frameIndex = 11;
    ctx.targetPosX = -76 - thrust * 10;
    ctx.hopYPx -= Math.sin(s * Math.PI) * 7;
    ctx.rotationRad = -0.092 * (1 - s * 0.35);
    ctx.deform.pelvis.dx = 4.8;
    ctx.deform.waist.dx = 10.8;
    ctx.deform.head.dx = 17.5;
    ctx.deform.head.rotRad = 0.092;
    ctx.clawSlashProgress = Math.max(0.01, Math.min(1, s));
    ctx.lureGlowIntensity = 0.88;
    ctx.droolIntensity = 0.86;
  } else {
    const r = (u - 0.78) / 0.22;
    const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 1;
    ctx.targetPosX = -82 * ease;
    ctx.deform.waist.dx = 4.5 * ease;
    ctx.deform.head.dx = 8.0 * ease;
  }
}

export function applyMutdogHowlBranch(
  ctx: MutdogEvalCtx,
  state: MutdogJuiceState,
  elapsed: number,
  idx: number,
  config: MutdogJuiceConfig,
  hasCombatHowl: boolean,
  combatSync: MutdogCombatSyncInput | undefined,
  prevBristleU: number,
  prevTriggerElapsed: number,
): void {
  const dur = hasCombatHowl
    ? Math.max(0.01, combatSync!.bristleDuration!)
    : Math.max(0.01, state.triggerDuration);
  const u = hasCombatHowl
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.bristleTimer! / dur))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
  const prevU = hasCombatHowl ? prevBristleU : prevTriggerElapsed / dur;

  ctx.mode = 'howl';
  if (prevU < 0.22 && u >= 0.22) {
    applyMutdogSquash(state, 0.86, 1.18, -1.2, 1.6);
    ctx.droolBurstTriggered = true;
  }

  if (u < 0.22) {
    const a = 0.5 - 0.5 * Math.cos((u / 0.22) * Math.PI);
    ctx.frameIndex = 5;
    ctx.rotationRad = 0.036 * a;
    ctx.deform.waist.dx = -3.0 * a;
    ctx.deform.waist.dy = 2.8 * a;
    ctx.deform.head.dx = -4.5 * a;
    ctx.lureGlowIntensity = 0.68 + a * 0.28;
    ctx.droolIntensity = 0.65;
  } else if (u < 0.68) {
    const f = (u - 0.22) / 0.46;
    const flare = Math.sin(f * Math.PI);
    const tremor = Math.sin(elapsed * 26.0 + idx) * 1.4;
    ctx.frameIndex = 4;
    ctx.howlPulseProgress = Math.min(1, f * 1.12);
    ctx.deform.pelvis.dy = -1.6 * flare;
    ctx.deform.waist.scaleX = 1.06 + flare * 0.05;
    ctx.deform.waist.dy = -4.2 - flare * 2.6;
    ctx.deform.head.dx = tremor;
    ctx.deform.head.dy = -7.5 - flare * 3.5;
    ctx.deform.head.rotRad = -0.075 * flare;
    ctx.lureGlowIntensity = 1.0;
    ctx.droolIntensity = 1.0;
    const amp = 0.0024 * config.uvDistortStrength;
    ctx.uvDistortAmp = [amp, amp * 1.2];
    ctx.uvDistortFreq = 11.0;
    ctx.uvDistortPhase = elapsed * 6.0 + idx;
    ctx.tintRgba = [1.06, 1.02, 0.88, 1.0];
  } else {
    const r = (u - 0.68) / 0.32;
    const settle = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 6;
    ctx.howlPulseProgress = 0.25 * settle;
    ctx.deform.waist.scaleX = 1.04;
    ctx.deform.waist.dy = -2.0 * settle;
    ctx.deform.head.dy = -3.0 * settle;
    ctx.lureGlowIntensity = 0.78;
    ctx.droolIntensity = 0.72;
  }
}
