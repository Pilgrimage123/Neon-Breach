/**
 * @file bruteJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Carapace Brute (`brute`).
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

interface BruteEvalCtx {
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

function syncBruteCombatCues(
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

function applyBruteAttackBranch(
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

function applyBruteBraceBranch(
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
    frameIndex: 1,
    targetPosX: 0,
    hopYPx: flipStep.hopYPx,
    rotationRad: 0,
    vialGlowIntensity: 0.24 + 0.1 * Math.sin(elapsed * 2.6 + idx),
    shellGlowIntensity: 0.16 + 0.08 * Math.sin(elapsed * 2.1 + idx * 0.9),
    shockwaveIntensity: 0,
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

  if (isDead) {
    const death = sampleDeathCollapseFrame(combatSync?.koProgress ?? 0, 12, 4, 0.8);
    ctx.frameIndex = death.frameIndex;
    ctx.vialGlowIntensity = Math.max(0, 0.35 * (1 - death.progress * 1.3));
    ctx.shellGlowIntensity = Math.max(0, 0.25 * (1 - death.progress * 1.3));
  } else if (state.activeTrigger === 'stomp_walk') {
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    ctx.targetPosX = -Math.sin(u * Math.PI) * 72;
    const isAdvancing = u < 0.55;
    ctx.frameIndex = isAdvancing ? 0 : 1;

    state.stompTime += safeDt * config.stompSpeed;
    const stompSin = Math.sin(state.stompTime);
    const liftAbs = Math.abs(stompSin);
    const isAirborne = liftAbs > 0.25;
    if (state.wasAirborne && !isAirborne && safeDt > 0) {
      applyBruteSquash(state, 1.13, 0.88, 0.8, -0.9);
      ctx.footPlantTriggered = true;
    }
    state.wasAirborne = isAirborne;
    ctx.rotationRad += stompSin * config.stompMaxAngleRad;
    ctx.hopYPx -= liftAbs * config.stompHopHeightPx;

    const leanDir = isAdvancing ? 1 : -0.6;
    ctx.deform.pelvis.dx = leanDir * 2.5;
    ctx.deform.waist.dx = leanDir * 5.2;
    ctx.deform.waist.dy = -liftAbs * 1.5;
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
    ctx.frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 8.5 + idx);
    ctx.shellGlowIntensity = 0.84 + 0.16 * pulse;
    ctx.vialGlowIntensity = 0.52 + 0.22 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.035;
    ctx.deform.head.dy = -pulse * 2.5;
  } else if (combatSync?.heavyPrimed) {
    ctx.frameIndex = 8;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.6 + idx);
    ctx.shellGlowIntensity = 0.68 + 0.28 * pulse;
    ctx.vialGlowIntensity = 0.48 + 0.16 * pulse;
    ctx.deform.pelvis.scaleX = 1 + pulse * 0.02;
    ctx.deform.waist.dy = -pulse * 2.2;
    ctx.deform.head.dy = -pulse * 3.0;
    ctx.deform.head.rotRad = -0.02 + pulse * 0.02;
    const amp = 0.0018 * config.uvDistortStrength;
    ctx.uvDistortAmp = [amp, amp];
    ctx.uvDistortFreq = 9.5;
    ctx.uvDistortPhase = elapsed * 4.2 + idx;
  } else if (combatSync?.armoredGuard) {
    ctx.frameIndex = 7;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.8 + idx);
    ctx.vialGlowIntensity = 0.64 + 0.24 * pulse;
    ctx.shellGlowIntensity = 0.46 + 0.2 * pulse;
    ctx.deform.waist.scaleX = 1 + pulse * 0.025;
    ctx.deform.waist.dy = -pulse * 1.4;
    ctx.deform.head.dy = -pulse * 1.8;
  } else {
    state.snarlTimer -= safeDt;
    if (state.snarlTimer <= 0) {
      state.snarlHoldTimer = 0.24;
      state.snarlVariant = state.snarlVariant === 2 ? 3 : 2;
      state.snarlTimer = 2.1 + ((idx * 0.79) % 1.1);
    }
    if (state.snarlHoldTimer > 0) {
      state.snarlHoldTimer = Math.max(0, state.snarlHoldTimer - safeDt);
      ctx.frameIndex = state.snarlVariant;
    } else {
      ctx.frameIndex = state.flipActive ? 0 : 1;
    }
    const breath = Math.sin(ctx.swayPhase);
    ctx.deform.pelvis.dx = breath * 0.4;
    ctx.deform.waist.dx = breath * 0.95;
    ctx.deform.waist.dy = -breath * 1.25;
    ctx.deform.waist.scaleX = 1 + breath * 0.02;
    ctx.deform.head.dx = breath * 1.45;
    ctx.deform.head.dy = -breath * 1.85;
    ctx.deform.head.rotRad = breath * 0.011;
    ctx.swayAmpPx = 0.4;
  }

  if (combatSync?.staggeredStatus && !isDead) {
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

  const blendDur =
    state.activeTrigger === 'seismic_smash' || hasCombatAttack || state.activeTrigger === 'take_hit'
      ? 0.045
      : state.activeTrigger === 'mutagen_brace' || hasCombatBrace
        ? 0.065
        : 0.085;
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
    mutagenMistProgress: ctx.mutagenMistProgress,
    seismicImpactProgress: ctx.seismicImpactProgress,
    seismicImpactTriggered: ctx.seismicImpactTriggered,
    vialShatterTriggered: ctx.vialShatterTriggered,
    chitinShardTriggered,
    footPlantTriggered: ctx.footPlantTriggered,
  };
}
