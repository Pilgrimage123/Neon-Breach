import {
  type BruteCombatSyncInput,
  type BruteEvalCtx,
  type BruteJuiceConfig,
  type BruteJuiceState,
  applyBruteSquash,
} from './bruteJuiceState';

export function syncBruteCombatCues(
  state: BruteJuiceState,
  combatSync: BruteCombatSyncInput | undefined,
): { prevAttackU: number; prevBristleU: number; chitinShardTriggered: boolean } {
  let prevAttackU = 0;
  let prevBristleU = 0;
  let chitinShardTriggered = state.pendingChitinBurst;
  state.pendingChitinBurst = false;
  if (!combatSync) return { prevAttackU, prevBristleU, chitinShardTriggered };

  const atkTimer = combatSync.attackAnimTimer ?? 0;
  const atkDur = combatSync.attackAnimDuration ?? 0.74;
  if (atkTimer > state.lastSeenAttackTimer + 0.05) {
    applyBruteSquash(state, 1.16, 0.84, 1.1, -1.3);
  }
  if (atkDur > 0 && state.lastSeenAttackTimer > 0) {
    prevAttackU = Math.max(0, Math.min(1, 1 - state.lastSeenAttackTimer / atkDur));
  }
  state.lastSeenAttackTimer = atkTimer;

  const stagTimer = combatSync.staggerTimer ?? 0;
  if (stagTimer > state.lastSeenStaggerTimer + 0.05) {
    state.hitFlashTimer = 0.22;
    applyBruteSquash(state, 0.80, 1.20, -1.8, 2.0);
    chitinShardTriggered = true;
  }
  state.lastSeenStaggerTimer = stagTimer;

  const brisTimer = combatSync.bristleTimer ?? 0;
  const brisDur = combatSync.bristleDuration ?? 0.72;
  if (brisTimer > state.lastSeenBristleTimer + 0.05) {
    applyBruteSquash(state, 1.14, 0.88, 1.1, -0.9);
  }
  if (brisDur > 0 && state.lastSeenBristleTimer > 0) {
    prevBristleU = Math.max(0, Math.min(1, 1 - state.lastSeenBristleTimer / brisDur));
  }
  state.lastSeenBristleTimer = brisTimer;

  const weaponBroken = Boolean(combatSync.weaponBroken);
  if (weaponBroken && !state.lastSeenWeaponBroken) {
    chitinShardTriggered = true;
    state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.26);
    applyBruteSquash(state, 0.76, 1.24, -2.2, 2.4);
  }
  state.lastSeenWeaponBroken = weaponBroken;

  return { prevAttackU, prevBristleU, chitinShardTriggered };
}

export function applyBruteAttackBranch(
  ctx: BruteEvalCtx,
  state: BruteJuiceState,
  config: BruteJuiceConfig,
  hasCombatAttack: boolean,
  combatSync: BruteCombatSyncInput | undefined,
  prevAttackU: number,
  prevTriggerElapsed: number,
): void {
  const isHeavy =
    state.activeTrigger === 'seismic_smash' || combatSync?.bruteAttackKind !== 'attack';
  const dur = hasCombatAttack
    ? Math.max(0.01, combatSync!.attackAnimDuration!)
    : Math.max(0.01, state.triggerDuration);
  const u = hasCombatAttack
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.attackAnimTimer! / dur))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
  const prevU = hasCombatAttack ? prevAttackU : prevTriggerElapsed / dur;

  if (isHeavy) {
    if (prevU < 0.5 && u >= 0.5) {
      const s = Math.max(0.5, config.seismicImpactStrength);
      applyBruteSquash(state, 1 + 0.26 * s, 1 - 0.24 * s, 2.2 * s, -2.0 * s);
      state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.11);
      ctx.seismicImpactTriggered = true;
    }

    if (u < 0.22) {
      const a = 0.5 - 0.5 * Math.cos((u / 0.22) * Math.PI);
      ctx.frameIndex = 8;
      ctx.targetPosX = a * 18;
      ctx.hopYPx -= a * 4;
      ctx.rotationRad = a * 0.055;
      ctx.deform.pelvis.dx = -a * 3.0;
      ctx.deform.pelvis.scaleX = 1 + a * 0.06;
      ctx.deform.waist.dx = -a * 6.5;
      ctx.deform.waist.dy = a * 3.0;
      ctx.deform.head.dx = -a * 10.5;
      ctx.deform.head.rotRad = -a * 0.07;
      ctx.shellGlowIntensity = 0.58 + a * 0.34;
      ctx.vialGlowIntensity = 0.62;
    } else if (u < 0.5) {
      const s = (u - 0.22) / 0.28;
      const thrust = Math.sin(s * (Math.PI * 0.5));
      ctx.frameIndex = 9;
      ctx.targetPosX = 18 * (1 - thrust) - thrust * 74;
      ctx.hopYPx -= Math.sin(s * Math.PI) * 30;
      ctx.rotationRad = -0.045 * thrust;
      ctx.deform.pelvis.dx = 3.5 * thrust;
      ctx.deform.waist.dx = 7.5 * thrust;
      ctx.deform.waist.dy = -4.5 * Math.sin(s * Math.PI);
      ctx.deform.waist.scaleX = 0.94;
      ctx.deform.head.dx = 12.0 * thrust;
      ctx.deform.head.dy = -9.5 * Math.sin(s * Math.PI);
      ctx.deform.head.rotRad = 0.06 * thrust;
      ctx.shellGlowIntensity = 0.94;
      ctx.vialGlowIntensity = 0.72;
    } else if (u < 0.82) {
      const f = (u - 0.5) / 0.32;
      const crunch = Math.sin((1 - f * 0.45) * (Math.PI * 0.5));
      ctx.frameIndex = 10;
      ctx.targetPosX = -74 * (1 - f * 0.16);
      ctx.rotationRad = -0.08 * crunch;
      ctx.deform.pelvis.dx = 4.5 * crunch;
      ctx.deform.pelvis.dy = 2.0 * crunch;
      ctx.deform.waist.dx = 9.0 * crunch;
      ctx.deform.waist.dy = 5.5 * crunch;
      ctx.deform.waist.scaleX = 1 + 0.11 * crunch;
      ctx.deform.head.dx = 14.0 * crunch;
      ctx.deform.head.dy = 8.0 * crunch;
      ctx.deform.head.rotRad = 0.11 * crunch;
      ctx.shockwaveIntensity = Math.sin(f * Math.PI) * Math.min(1.25, config.seismicImpactStrength);
      ctx.seismicImpactProgress = Math.min(1, f);
      ctx.shellGlowIntensity = 0.96 - f * 0.22;
      ctx.vialGlowIntensity = 0.74;
    } else {
      const r = (u - 0.82) / 0.18;
      const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
      ctx.frameIndex = 11;
      ctx.targetPosX = -62 * ease;
      ctx.rotationRad = -0.03 * ease;
      ctx.deform.waist.dx = 5.0 * ease;
      ctx.deform.head.dx = 8.5 * ease;
      ctx.shellGlowIntensity = 0.52 * ease + 0.18;
      ctx.vialGlowIntensity = 0.5;
    }
    return;
  }

  if (prevU < 0.26 && u >= 0.26) {
    applyBruteSquash(state, 1.18, 0.84, 1.5, -1.2);
  }
  if (u < 0.26) {
    const a = 0.5 - 0.5 * Math.cos((u / 0.26) * Math.PI);
    ctx.frameIndex = 8;
    ctx.targetPosX = a * 16;
    ctx.hopYPx -= a * 5;
    ctx.rotationRad = a * 0.045;
    ctx.deform.waist.dx = -a * 5.5;
    ctx.deform.head.dx = -a * 9.0;
    ctx.vialGlowIntensity = 0.58;
    ctx.shellGlowIntensity = 0.45;
  } else if (u < 0.74) {
    const s = (u - 0.26) / 0.48;
    const thrust = Math.sin(s * (Math.PI * 0.5));
    ctx.frameIndex = 11;
    ctx.targetPosX = 16 * (1 - thrust) - thrust * 68;
    ctx.hopYPx -= Math.sin(s * Math.PI) * 6;
    ctx.rotationRad = -0.075 * thrust;
    ctx.deform.pelvis.dx = 4.0 * thrust;
    ctx.deform.waist.dx = 9.0 * thrust;
    ctx.deform.head.dx = 14.5 * thrust;
    ctx.vialGlowIntensity = 0.66;
    ctx.shellGlowIntensity = 0.52;
  } else {
    const r = (u - 0.74) / 0.26;
    const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 1;
    ctx.targetPosX = -68 * ease;
    ctx.deform.waist.dx = 4.0 * ease;
    ctx.deform.head.dx = 7.0 * ease;
  }
}

export function applyBruteBraceBranch(
  ctx: BruteEvalCtx,
  state: BruteJuiceState,
  elapsed: number,
  idx: number,
  config: BruteJuiceConfig,
  hasCombatBrace: boolean,
  combatSync: BruteCombatSyncInput | undefined,
  prevBristleU: number,
  prevTriggerElapsed: number,
): void {
  const dur = hasCombatBrace
    ? Math.max(0.01, combatSync!.bristleDuration!)
    : Math.max(0.01, state.triggerDuration);
  const u = hasCombatBrace
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.bristleTimer! / dur))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
  const prevU = hasCombatBrace ? prevBristleU : prevTriggerElapsed / dur;

  if (prevU < 0.24 && u >= 0.24) {
    applyBruteSquash(state, 1.18, 0.84, 1.4, -1.2);
    ctx.vialShatterTriggered = true;
  }

  if (u < 0.24) {
    const a = 0.5 - 0.5 * Math.cos((u / 0.24) * Math.PI);
    ctx.frameIndex = 4;
    ctx.rotationRad = -0.025 * a;
    ctx.deform.waist.dx = 2.5 * a;
    ctx.deform.waist.dy = 2.0 * a;
    ctx.deform.head.dx = 4.0 * a;
    ctx.vialGlowIntensity = 0.6 + a * 0.28;
    ctx.shellGlowIntensity = 0.34;
  } else if (u < 0.54) {
    const f = (u - 0.24) / 0.3;
    const swell = Math.sin(f * Math.PI);
    ctx.frameIndex = 5;
    ctx.mutagenMistProgress = Math.min(1, f * 1.15);
    ctx.deform.waist.scaleX = 1 + swell * 0.085;
    ctx.deform.waist.dy = -swell * 3.0;
    ctx.deform.head.dy = -swell * 4.5;
    ctx.vialGlowIntensity = 1.0;
    ctx.shellGlowIntensity = 0.45 + f * 0.35;
    ctx.tintRgba = [0.9, 1.06, 0.9, 1.0];
  } else if (u < 0.8) {
    const f = (u - 0.54) / 0.26;
    const flare = Math.sin(f * Math.PI);
    ctx.frameIndex = 6;
    ctx.mutagenMistProgress = Math.max(0.25, 1 - f * 0.65);
    ctx.deform.pelvis.dy = -1.5;
    ctx.deform.waist.scaleX = 1.06 + flare * 0.04;
    ctx.deform.waist.dy = -4.0 - flare * 2.0;
    ctx.deform.head.dy = -6.0 - flare * 2.5;
    ctx.deform.head.rotRad = -0.04 * flare;
    ctx.vialGlowIntensity = 0.86;
    ctx.shellGlowIntensity = 1.0;
    const amp = 0.0022 * config.uvDistortStrength;
    ctx.uvDistortAmp = [amp, amp * 1.15];
    ctx.uvDistortFreq = 10.0;
    ctx.uvDistortPhase = elapsed * 5.2 + idx;
    ctx.tintRgba = [1.05, 0.98, 0.9, 1.0];
  } else {
    const r = (u - 0.8) / 0.2;
    const settle = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 7;
    ctx.mutagenMistProgress = 0.25 * settle;
    ctx.deform.waist.scaleX = 1.05;
    ctx.deform.waist.dy = -2.2;
    ctx.deform.head.dy = -3.2;
    ctx.vialGlowIntensity = 0.9;
    ctx.shellGlowIntensity = 0.65;
  }
}
