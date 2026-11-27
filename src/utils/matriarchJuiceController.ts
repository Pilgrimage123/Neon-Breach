/**
 * 4-Layer Procedural "Juice" Physics, Half-HP Back-Explosion & Viscous Slime Drip Controller
 * for the Xenomorph Matriarch (`boss`).
 *
 * Pure TypeScript / zero DOM dependencies so all kinematics, 50% HP dorsal rupture transitions,
 * spring physics, 4-knot anatomical spine deformations, and slime drip physics can be
 * deterministically unit-tested via `node:test`.
 */
import {
  type HorizontalVelocityState,
  type JuiceMeshDeform,
  type SpringScaleState,
  applySpringSquashImpulse,
  createNeutralMeshDeform,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';
import {
  MATRIARCH_EXPLODED_SLIME_NOZZLES,
  MATRIARCH_INTACT_SLIME_NOZZLES,
  type MatriarchAnimMode,
  type MatriarchBoneWeight,
  type MatriarchSlimeNozzleSpec,
  isMatriarchBackExploded,
} from './matriarchSpriteSheet';

export interface MatriarchSlimeNozzleState {
  id: string;
  dx: number;
  dy: number;
  bone: MatriarchBoneWeight;
  baseRadius: number;
  maxStretchPx: number;
  baseIntervalSec: number;
  timer: number;
  stretchPx: number;
  bulbRadius: number;
  swayPx: number;
  recoil: number;
  phase: 'swelling' | 'stretching' | 'recoiling';
}

export interface MatriarchSlimeDrop {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  stretchY: number;
  alpha: number;
  /** 'lime' for normal acid saliva/slime, 'ember' for Phase 2 ruptured back ichor/egg droplets */
  kind: 'lime' | 'ember';
}

export interface MatriarchSlimeSplash {
  active: boolean;
  x: number;
  age: number;
  maxAge: number;
  maxRadius: number;
  seed: number;
  kind: 'lime' | 'ember';
}

export interface MatriarchCombatCueInput {
  hp: number;
  maxHp: number;
  dead?: boolean;
  koProgress?: number;
  attackAnimTimer?: number;
  attackAnimDuration?: number;
  staggerTimer?: number;
  staggerDuration?: number;
  bristleTimer?: number;
  bristleDuration?: number;
  heavyOrAcidPrimed?: boolean;
  armoredGuard?: boolean;
  staggeredStatus?: boolean;
  instanceIndex?: number;
}

export interface MatriarchJuiceState {
  spring: SpringScaleState;
  horiz: HorizontalVelocityState;
  wasBackExploded: boolean;
  ruptureTimer: number;
  ruptureDuration: number;
  prevFrameIndex: 0 | 1;
  prevAttackActive: boolean;
  prevStaggerActive: boolean;
  prevBristleActive: boolean;
  nozzleFrameIndex: 0 | 1;
  nozzles: MatriarchSlimeNozzleState[];
  drops: MatriarchSlimeDrop[];
  dropCursor: number;
  splashes: MatriarchSlimeSplash[];
  splashCursor: number;
  rngState: number;
}

export interface MatriarchJuiceSample {
  mode: MatriarchAnimMode;
  frameIndex: 0 | 1;
  prevFrameIndex: number;
  /** Strictly 1.0 (crisp-cut policy: never ghost-blend intact & exploded frames). */
  frameBlendAlpha: number;
  isBackExploded: boolean;
  /** One-shot event fired on the exact tick HP crosses <= 50% maxHp. */
  backExplosionTriggered: boolean;
  /** Progress [0..1] of the active dorsal carapace rupture animation (0 when idle). */
  ruptureProgress: number;
  /** Native left-facing = +1 */
  facingScale: number;
  /** Horizontal offset in unscaled sprite pixels (negative = left toward hero). */
  offsetX: number;
  /** Vertical leap offset in unscaled sprite pixels (negative = upward). */
  hopYPx: number;
  rotationRad: number;
  springScaleX: number;
  springScaleY: number;
  shearXPx: number;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  tintRgba: [number, number, number, number];
  flashRgba: [number, number, number, number] | null;
  deform: JuiceMeshDeform;
  backGlowIntensity: number;
  eyeGlowIntensity: number;
  clawSlashProgress: number;
  slimeBurstTriggered: boolean;
  slashImpactTriggered: boolean;
  nozzles: readonly MatriarchSlimeNozzleState[];
  drops: readonly MatriarchSlimeDrop[];
  splashes: readonly MatriarchSlimeSplash[];
  alpha: number;
}

const SLIME_DROP_POOL_SIZE = 36;
const SLIME_SPLASH_POOL_SIZE = 22;
const SLIME_GRAVITY_PX_S2 = 640;
export const MATRIARCH_RUPTURE_DURATION_SEC = 0.72;

function nextDeterministicRand(state: MatriarchJuiceState): number {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return (state.rngState & 0x00ffffff) / 0x01000000;
}

function getBoneDisplacement(
  deform: JuiceMeshDeform,
  bone: MatriarchBoneWeight,
): { dx: number; dy: number } {
  if (bone === 'head') return { dx: deform.head.dx, dy: deform.head.dy };
  if (bone === 'waist') return { dx: deform.waist.dx, dy: deform.waist.dy };
  return { dx: deform.pelvis.dx, dy: deform.pelvis.dy };
}

function buildNozzlesFromSpec(
  specs: readonly MatriarchSlimeNozzleSpec[],
): MatriarchSlimeNozzleState[] {
  return specs.map((spec) => ({
    id: spec.id,
    dx: spec.dx,
    dy: spec.dy,
    bone: spec.bone,
    baseRadius: spec.baseRadius,
    maxStretchPx: spec.maxStretchPx,
    baseIntervalSec: spec.baseIntervalSec,
    timer: spec.phaseOffset * spec.baseIntervalSec,
    stretchPx: 3.5 + spec.phaseOffset * spec.maxStretchPx * 0.42,
    bulbRadius: spec.baseRadius * (0.76 + spec.phaseOffset * 0.38),
    swayPx: 0,
    recoil: 0,
    phase: spec.phaseOffset > 0.4 ? 'stretching' : 'swelling',
  }));
}

function spawnDrop(
  state: MatriarchJuiceState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  kind: 'lime' | 'ember',
): void {
  const drop = state.drops[state.dropCursor];
  state.dropCursor = (state.dropCursor + 1) % SLIME_DROP_POOL_SIZE;
  drop.active = true;
  drop.x = x;
  drop.y = y;
  drop.vx = vx;
  drop.vy = vy;
  drop.radius = radius;
  drop.stretchY = 1.18;
  drop.alpha = 1;
  drop.kind = kind;
}

function spawnSplash(
  state: MatriarchJuiceState,
  x: number,
  radius: number,
  kind: 'lime' | 'ember',
): void {
  const splash = state.splashes[state.splashCursor];
  state.splashCursor = (state.splashCursor + 1) % SLIME_SPLASH_POOL_SIZE;
  splash.active = true;
  splash.x = x;
  splash.age = 0;
  splash.maxAge = 0.44 + nextDeterministicRand(state) * 0.22;
  splash.maxRadius = Math.max(10, radius * 2.9);
  splash.seed = nextDeterministicRand(state) * 6.283;
  splash.kind = kind;
}

export function createMatriarchJuiceState(seed = 4219): MatriarchJuiceState {
  const drops: MatriarchSlimeDrop[] = Array.from({ length: SLIME_DROP_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 4.5,
    stretchY: 1,
    alpha: 0,
    kind: 'lime',
  }));

  const splashes: MatriarchSlimeSplash[] = Array.from({ length: SLIME_SPLASH_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    age: 0,
    maxAge: 0.46,
    maxRadius: 15,
    seed: 0,
    kind: 'lime',
  }));

  return {
    spring: {
      springScaleX: 1,
      springScaleY: 1,
      springVelX: 0,
      springVelY: 0,
    },
    horiz: {
      posX: 0,
      velX: 0,
      prevPosX: 0,
    },
    wasBackExploded: false,
    ruptureTimer: 0,
    ruptureDuration: MATRIARCH_RUPTURE_DURATION_SEC,
    prevFrameIndex: 0,
    prevAttackActive: false,
    prevStaggerActive: false,
    prevBristleActive: false,
    nozzleFrameIndex: 0,
    nozzles: buildNozzlesFromSpec(MATRIARCH_INTACT_SLIME_NOZZLES),
    drops,
    dropCursor: 0,
    splashes,
    splashCursor: 0,
    rngState: (seed >>> 0) || 4219,
  };
}

export function stepMatriarchJuice(
  state: MatriarchJuiceState,
  dt: number,
  elapsed: number,
  cue: MatriarchCombatCueInput,
): MatriarchJuiceSample {
  const safeDt = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
  const idx = cue.instanceIndex ?? 0;

  const isDead = Boolean(cue.dead);
  const explodedNow = isMatriarchBackExploded(cue.hp, cue.maxHp);
  let backExplosionTriggered = false;

  if (safeDt > 0) {
    if (explodedNow && !state.wasBackExploded) {
      state.wasBackExploded = true;
      state.ruptureTimer = state.ruptureDuration;
      backExplosionTriggered = true;
      applySpringSquashImpulse(state.spring, 0.80, 1.24, 0.74, 1.30, -2.4, 3.4);
    } else if (!explodedNow && state.wasBackExploded) {
      // Clean reset when Undo/Heal/DevLab restores HP back above 50% maxHp
      state.wasBackExploded = false;
      state.ruptureTimer = 0;
    }

    if (state.ruptureTimer > 0) {
      state.ruptureTimer = Math.max(0, state.ruptureTimer - safeDt);
    }
  }

  const isBackExploded = explodedNow;
  const frameIndex: 0 | 1 = isBackExploded ? 1 : 0;

  // Swap nozzle geometry cleanly whenever phase switches between intact (0) and exploded (1)
  if (safeDt > 0 && state.nozzleFrameIndex !== frameIndex) {
    state.nozzleFrameIndex = frameIndex;
    state.nozzles = buildNozzlesFromSpec(
      frameIndex === 1 ? MATRIARCH_EXPLODED_SLIME_NOZZLES : MATRIARCH_INTACT_SLIME_NOZZLES,
    );
  }

  const ruptureActive = !isDead && state.ruptureTimer > 0;
  const ruptureProgress = ruptureActive
    ? Math.max(0, Math.min(1, 1 - state.ruptureTimer / Math.max(0.05, state.ruptureDuration)))
    : 0;

  const attackActive =
    !isDead && (cue.attackAnimTimer ?? 0) > 0 && (cue.attackAnimDuration ?? 0) > 0;
  const staggerActive =
    !isDead && (cue.staggerTimer ?? 0) > 0 && (cue.staggerDuration ?? 0) > 0;
  const bristleActive =
    !isDead && (cue.bristleTimer ?? 0) > 0 && (cue.bristleDuration ?? 0) > 0;

  let slimeBurstTriggered = backExplosionTriggered;
  let slashImpactTriggered = false;

  if (safeDt > 0) {
    if (staggerActive && !state.prevStaggerActive && !backExplosionTriggered) {
      applySpringSquashImpulse(state.spring, 0.86, 1.15, 0.76, 1.26, -1.7, 2.3);
      slimeBurstTriggered = true;
    } else if (bristleActive && !state.prevBristleActive) {
      applySpringSquashImpulse(state.spring, 1.14, 0.88, 0.76, 1.26, 1.9, -1.6);
      slimeBurstTriggered = true;
    } else if (attackActive && !state.prevAttackActive) {
      applySpringSquashImpulse(state.spring, 1.12, 0.89, 0.76, 1.26, 1.6, -1.5);
      slimeBurstTriggered = true;
    }
    state.prevAttackActive = attackActive;
    state.prevStaggerActive = staggerActive;
    state.prevBristleActive = bristleActive;
  }

  // Enraged Phase 2 breathes faster and pulses brighter than intact Phase 1
  const breathFreq = isBackExploded ? 3.85 : 2.35;
  const breathPhase = elapsed * breathFreq + idx * 1.15;
  const breath = Math.sin(breathPhase);
  const stalkWave = Math.sin(elapsed * (isBackExploded ? 2.25 : 1.25) + idx * 0.8);
  const headSnarl =
    Math.sin(elapsed * 5.8 + idx * 1.7) *
    Math.pow(Math.max(0, Math.sin(elapsed * (isBackExploded ? 1.45 : 0.85) + idx)), 4);

  let mode: MatriarchAnimMode = 'idle';
  let alpha = 1;
  let targetPosX = 0;
  let hopYPx = 0;
  let rotationRad = 0;
  let backGlowIntensity = isBackExploded
    ? 0.76 + 0.24 * (0.5 + 0.5 * Math.sin(elapsed * 5.6 + idx))
    : 0.42 + 0.18 * (0.5 + 0.5 * Math.sin(elapsed * 2.8 + idx));
  let eyeGlowIntensity = isBackExploded
    ? 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(elapsed * 6.4 + idx))
    : 0.52 + 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 2.6 + idx));
  let clawSlashProgress = 0;
  let flashRgba: [number, number, number, number] | null = null;
  let tintRgba: [number, number, number, number] = isBackExploded
    ? [1.05, 0.98, 1.02, 1]
    : [1, 1, 1, 1];
  let uvDistortAmp: [number, number] = [0, 0];
  let uvDistortFreq = 12;
  let uvDistortPhase = elapsed * 3.6 + idx;

  const deform = createNeutralMeshDeform();

  if (isDead) {
    mode = 'death';
    const ko = Math.max(0, Math.min(1, cue.koProgress ?? 0));
    alpha = ko < 0.72 ? 1 : Math.max(0, 1 - (ko - 0.72) / 0.28);
    backGlowIntensity = Math.max(0, 0.55 * (1 - ko * 1.25));
    eyeGlowIntensity = Math.max(0, 0.45 * (1 - ko * 1.4));
    const collapse = Math.min(1, ko * 1.4);
    deform.pelvis.dy = collapse * 26;
    deform.waist.dy = collapse * 56;
    deform.waist.scaleX = 1 + collapse * 0.15;
    deform.head.dy = collapse * 92;
    deform.head.dx = -collapse * 22;
    deform.head.rotRad = -collapse * 0.22;
    uvDistortAmp = [0.0028 * (1 - collapse * 0.45), 0.0032 * (1 - collapse * 0.45)];
  } else if (ruptureActive) {
    // Dramatic half-HP dorsal carapace explosion: violent blast recoil -> roaring rage slam
    mode = 'rupture';
    const blastEnv = Math.pow(1 - ruptureProgress, 0.72);
    const shockWave = Math.sin(ruptureProgress * Math.PI);
    const tremor = Math.sin(ruptureProgress * 64) * blastEnv;

    targetPosX = 36 * shockWave * blastEnv - 14 * Math.max(0, ruptureProgress - 0.55);
    hopYPx = -28 * Math.sin(Math.min(1, ruptureProgress * 1.35) * Math.PI) * blastEnv;
    rotationRad = 0.11 * blastEnv * Math.sin(ruptureProgress * Math.PI * 0.85) + 0.03 * tremor;
    backGlowIntensity = 1.0;
    eyeGlowIntensity = 1.0;

    // Dorsal arch violently blows outward then slams into low enraged lunge
    deform.pelvis.dx = 12 * blastEnv + 4 * tremor;
    deform.pelvis.dy = -6 * shockWave + 10 * ruptureProgress * (1 - ruptureProgress);
    deform.waist.dx = 22 * blastEnv + 8 * tremor;
    deform.waist.dy = -24 * shockWave + 16 * Math.max(0, ruptureProgress - 0.45);
    deform.waist.scaleX = 1 + 0.16 * shockWave;
    deform.waist.rotRad = 0.14 * blastEnv;
    deform.head.dx = 30 * blastEnv + 11 * tremor - 18 * Math.max(0, ruptureProgress - 0.55);
    deform.head.dy = -16 * shockWave + 18 * Math.max(0, ruptureProgress - 0.5);
    deform.head.rotRad = 0.2 * blastEnv - 0.12 * Math.max(0, ruptureProgress - 0.55);

    if (ruptureProgress < 0.34) {
      const f = 1 - ruptureProgress / 0.34;
      flashRgba = [1.0, 0.92, 0.48, f * 0.76];
    } else if (ruptureProgress < 0.68) {
      const f = 1 - (ruptureProgress - 0.34) / 0.34;
      flashRgba = [0.64, 1.0, 0.24, f * 0.42];
    }
    tintRgba = [1 + 0.26 * blastEnv, 1 + 0.12 * blastEnv, 1 - 0.1 * blastEnv, 1];
    uvDistortAmp = [0.0085 * blastEnv, 0.0072 * blastEnv];
    uvDistortFreq = 22;
    uvDistortPhase = elapsed * 18;
  } else if (staggerActive) {
    mode = 'pain';
    const dur = Math.max(0.05, cue.staggerDuration ?? 0.42);
    const p = Math.max(0, Math.min(0.999, 1 - (cue.staggerTimer ?? 0) / dur));
    const whip = Math.sin(p * Math.PI) * Math.pow(1 - p, 0.85);
    const shudder = Math.sin(p * 48) * (1 - p);

    targetPosX = 28 * whip;
    hopYPx = -12 * Math.sin(p * Math.PI) * (1 - p * 0.4);
    rotationRad = 0.095 * whip + 0.025 * shudder;
    backGlowIntensity = Math.min(1, backGlowIntensity + 0.35 * whip);
    // Native left-facing: +dx recoils upper body backward (right)
    deform.pelvis.dx = 10 * whip + 3 * shudder;
    deform.pelvis.dy = 5 * whip;
    deform.waist.dx = 22 * whip + 7 * shudder;
    deform.waist.dy = 10 * whip;
    deform.waist.rotRad = 0.12 * whip;
    deform.head.dx = 34 * whip + 11 * shudder;
    deform.head.dy = 12 * whip;
    deform.head.rotRad = 0.2 * whip;
    if (p < 0.25) {
      flashRgba = [1, 0.92, 0.78, (1 - p / 0.25) * 0.56];
    }
    uvDistortAmp = [0.0042 * whip, 0.0034 * whip];
    uvDistortFreq = 18;
    uvDistortPhase = elapsed * 14;
  } else if (attackActive) {
    mode = 'attack';
    const dur = Math.max(0.08, cue.attackAnimDuration ?? 0.62);
    const p = Math.max(0, Math.min(0.999, 1 - (cue.attackAnimTimer ?? 0) / dur));
    const rageAmp = isBackExploded ? 1.18 : 1.0;
    backGlowIntensity = Math.min(1, 0.84 + 0.16 * Math.sin(p * Math.PI));
    eyeGlowIntensity = 1.0;

    if (p < 0.24) {
      // Coiled apex windup (pull back right, crouch claws, swell dorsal sacs)
      const k = p / 0.24;
      const ease = k * k;
      targetPosX = 36 * ease * rageAmp;
      rotationRad = 0.085 * ease;
      deform.pelvis.dx = 8 * ease;
      deform.pelvis.dy = 12 * ease;
      deform.waist.dx = 16 * ease;
      deform.waist.dy = 22 * ease;
      deform.waist.scaleX = 1 + 0.085 * ease;
      deform.head.dx = 24 * ease;
      deform.head.dy = 26 * ease;
      deform.head.rotRad = 0.1 * ease;
    } else if (p < 0.56) {
      // Explosive forward scythe lunge toward hero (-X = left)
      const k = (p - 0.24) / 0.32;
      const surge = Math.sin(k * Math.PI * 0.5);
      targetPosX = (36 - 196 * surge) * rageAmp;
      hopYPx = -42 * Math.sin(k * Math.PI) * rageAmp;
      rotationRad = 0.085 - 0.2 * surge;
      clawSlashProgress = k * 0.54;
      deform.pelvis.dx = -10 * surge;
      deform.pelvis.dy = -5 * surge;
      deform.waist.dx = -26 * surge;
      deform.waist.dy = -10 * surge;
      deform.waist.scaleX = 1.05 - 0.08 * surge;
      deform.head.dx = -40 * surge;
      deform.head.dy = -8 * surge;
      deform.head.rotRad = -0.15 * surge;
      if (k > 0.72 && k < 0.86) {
        slashImpactTriggered = true;
        slimeBurstTriggered = true;
      }
    } else if (p < 0.8) {
      // Heavy scythe slam & deck squash bounce
      const k = (p - 0.56) / 0.24;
      const land = Math.sin(k * Math.PI);
      targetPosX = (-160 - 16 * (1 - k)) * rageAmp;
      hopYPx = -6 * (1 - k);
      rotationRad = -0.115 * (1 - k * 0.55);
      clawSlashProgress = 0.54 + k * 0.46;
      deform.pelvis.dx = -8 * (1 - k);
      deform.pelvis.dy = 14 * land;
      deform.waist.dx = -22 * (1 - k);
      deform.waist.dy = 22 * land;
      deform.waist.scaleX = 1 + 0.1 * land;
      deform.head.dx = -32 * (1 - k);
      deform.head.dy = 28 * land;
      deform.head.rotRad = -0.13 * (1 - k * 0.5);
      if (safeDt > 0 && k < 0.18) {
        applySpringSquashImpulse(state.spring, 1.15, 0.85, 0.76, 1.26, 0.9, -1.3);
      }
    } else {
      // Snap-back stance recovery
      const k = (p - 0.8) / 0.2;
      const inv = 1 - k * k;
      targetPosX = -160 * rageAmp * inv;
      hopYPx = -12 * Math.sin(k * Math.PI);
      rotationRad = -0.05 * inv;
      deform.waist.dx = -10 * inv;
      deform.head.dx = -16 * inv;
    }
    uvDistortAmp = [0.0028, 0.0024];
    uvDistortFreq = 16;
    uvDistortPhase = elapsed * 10;
  } else if (bristleActive || cue.armoredGuard) {
    mode = 'guard';
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2 + idx);
    backGlowIntensity = Math.min(1, 0.75 + 0.25 * pulse);
    deform.pelvis.dy = 4 + pulse * 4;
    deform.waist.dx = -4 + pulse * 3;
    deform.waist.dy = -6 - pulse * 7;
    deform.waist.scaleX = 1.04 + pulse * 0.04;
    deform.head.dx = -8 - pulse * 4;
    deform.head.dy = -8 - pulse * 8;
    deform.head.rotRad = -0.03;
    uvDistortAmp = [0.0024, 0.0022];
    uvDistortFreq = 15;
    uvDistortPhase = elapsed * 6.5;
  } else if (cue.heavyOrAcidPrimed) {
    mode = 'primed';
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 7.2 + idx);
    const quiver = Math.sin(elapsed * 24 + idx) * (isBackExploded ? 2.4 : 1.6);
    backGlowIntensity = 0.82 + 0.18 * pulse;
    eyeGlowIntensity = 0.9 + 0.1 * pulse;
    rotationRad = -0.04;
    deform.pelvis.dx = -4 - pulse * 3;
    deform.pelvis.dy = 10 + pulse * 5;
    deform.waist.dx = -12 - pulse * 5 + quiver * 0.45;
    deform.waist.dy = 18 + pulse * 7;
    deform.waist.scaleX = 1.05 + pulse * 0.04;
    deform.head.dx = -20 - pulse * 8 + quiver;
    deform.head.dy = 22 + pulse * 8;
    deform.head.rotRad = -0.075 - pulse * 0.03;
    uvDistortAmp = [0.0032, 0.0028];
    uvDistortFreq = 17;
    uvDistortPhase = elapsed * 8.5;
  } else {
    // Organic living apex queen idle:
    // - Strictly [0, 0] uvDistortAmp in idle (per playbook invariant)
    // - Phase 1: regal, heavy towering breath + pulsing egg sacs + predatory head scan
    // - Phase 2: hunched, faster ragged rage breathing + feral twitching
    mode = 'idle';
    const amp = isBackExploded ? 1.28 : 1.0;
    const breathLift = -breath * (isBackExploded ? 9.2 : 7.5);
    const prowlShift = stalkWave * (isBackExploded ? 7.2 : 5.4);

    deform.pelvis.dx = prowlShift * 0.35;
    deform.pelvis.dy = breathLift * 0.28;
    deform.waist.dx = prowlShift * 0.85 - breath * 2.8 * amp;
    deform.waist.dy = breathLift * 0.78;
    deform.waist.rotRad = -stalkWave * 0.024 + breath * 0.018 * amp;
    deform.waist.scaleX = 1 + breath * (isBackExploded ? 0.042 : 0.032);
    deform.head.dx = prowlShift * 1.45 - breath * 4.8 * amp + headSnarl * 6.2;
    deform.head.dy = breathLift * 1.22 + Math.abs(stalkWave) * 2.6;
    deform.head.rotRad = -stalkWave * 0.038 + breath * 0.028 * amp + headSnarl * 0.052;

    if (cue.staggeredStatus) {
      const dizzy = Math.sin(elapsed * 5.8 + idx);
      deform.waist.dx += dizzy * 8.0;
      deform.head.dx += dizzy * 14.5;
      deform.head.rotRad += dizzy * 0.095;
    }
  }

  // Layer 1: Symplectic damped spring squash-and-stretch + velocity-coupled horizontal shear
  stepSymplecticSpringScale(state.spring, safeDt, 185, 13.8, 0.74, 1.3);
  const shearXPx = stepHorizontalVelocityShear(state.horiz, targetPosX, safeDt, 15, 0.032, 20);

  const idleBreathX = mode === 'idle' ? 1 - breath * (isBackExploded ? 0.022 : 0.016) : 1;
  const idleBreathY = mode === 'idle' ? 1 + breath * (isBackExploded ? 0.03 : 0.022) : 1;
  const springScaleX = state.spring.springScaleX * idleBreathX;
  const springScaleY = state.spring.springScaleY * idleBreathY;

  // Layer 4: Multi-nozzle viscous acid-lime slime & ruptured back ember-ichor drips
  if (safeDt > 0) {
    const rateMul =
      mode === 'rupture'
        ? 3.4
        : mode === 'attack'
          ? 2.2
          : mode === 'primed' || mode === 'pain'
            ? 1.65
            : isBackExploded
              ? 1.45
              : mode === 'death'
                ? 0.4
                : 1.0;

    // On the exact rupture explosion tick, fling a dense shower of lime & orange-ember droplets!
    if (backExplosionTriggered) {
      for (let b = 0; b < 14; b++) {
        const ang = -Math.PI * 0.12 - nextDeterministicRand(state) * Math.PI * 0.78;
        const speed = 135 + nextDeterministicRand(state) * 240;
        const kind: 'lime' | 'ember' = b % 2 === 0 ? 'lime' : 'ember';
        spawnDrop(
          state,
          108 + (nextDeterministicRand(state) - 0.5) * 60,
          -253 + (nextDeterministicRand(state) - 0.5) * 44,
          Math.cos(ang) * speed,
          Math.sin(ang) * speed - 65,
          4.4 + nextDeterministicRand(state) * 3.8,
          kind,
        );
      }
    }

    for (let i = 0; i < state.nozzles.length; i++) {
      const n = state.nozzles[i];
      const boneDisp = getBoneDisplacement(deform, n.bone);
      const anchorX = n.dx + boneDisp.dx;
      const anchorY = n.dy + boneDisp.dy + hopYPx;

      const targetSway = Math.max(
        -16,
        Math.min(16, -state.horiz.velX * 0.022 + Math.sin(elapsed * 3.2 + i * 1.15) * 2.4),
      );
      n.swayPx += (targetSway - n.swayPx) * Math.min(1, safeDt * 9);

      if (n.recoil > 0) {
        n.recoil = Math.max(0, n.recoil - safeDt * 3.6);
      }

      n.timer += safeDt * rateMul;
      const u = Math.min(1, n.timer / n.baseIntervalSec);

      if (u < 0.35) {
        n.phase = n.recoil > 0.1 ? 'recoiling' : 'swelling';
        const k = u / 0.35;
        n.stretchPx = 3 + k * (n.maxStretchPx * 0.25);
        n.bulbRadius = n.baseRadius * (0.56 + k * 0.56);
      } else if (u < 1.0) {
        n.phase = 'stretching';
        const k = (u - 0.35) / 0.65;
        const accel = k * k * (3 - 2 * k) * 0.55 + k * k * k * 0.45;
        n.stretchPx = n.maxStretchPx * (0.25 + accel * 0.75);
        n.bulbRadius = n.baseRadius * (1.12 + k * 0.28);
      } else {
        const dropX = anchorX + n.swayPx;
        const dropY = anchorY + n.stretchPx;
        const flingVx =
          state.horiz.velX * 0.22 +
          (nextDeterministicRand(state) - 0.5) * (mode === 'attack' ? 92 : 24);
        const initialVy = 30 + nextDeterministicRand(state) * 28;
        const kind: 'lime' | 'ember' =
          isBackExploded && n.id.includes('back_ooze') && nextDeterministicRand(state) > 0.45
            ? 'ember'
            : 'lime';
        spawnDrop(state, dropX, dropY, flingVx, initialVy, n.bulbRadius * 0.92, kind);

        n.timer = 0;
        n.stretchPx = 2.5;
        n.bulbRadius = n.baseRadius * 0.52;
        n.recoil = 1.0;
        n.phase = 'recoiling';
      }

      if (slimeBurstTriggered && (n.bone === 'head' || n.bone === 'waist') && n.stretchPx > 7) {
        const dropX = anchorX + n.swayPx;
        const dropY = anchorY + n.stretchPx;
        const burstDir = mode === 'pain' || mode === 'rupture' ? 1 : -1;
        const burstVx = burstDir * (48 + nextDeterministicRand(state) * 120);
        const burstVy = -45 - nextDeterministicRand(state) * 78;
        spawnDrop(state, dropX, dropY, burstVx, burstVy, n.baseRadius * 0.88, 'lime');
        n.timer *= 0.25;
        n.stretchPx = 3;
        n.recoil = 0.85;
      }
    }

    for (let i = 0; i < state.drops.length; i++) {
      const d = state.drops[i];
      if (!d.active) continue;
      d.vy += SLIME_GRAVITY_PX_S2 * safeDt;
      d.x += d.vx * safeDt;
      d.y += d.vy * safeDt;
      d.vx *= Math.max(0.86, 1 - safeDt * 1.4);
      d.stretchY = Math.min(2.4, 1.05 + Math.abs(d.vy) / 280);

      if (d.y >= 2) {
        d.active = false;
        spawnSplash(state, d.x, d.radius, d.kind);
      }
    }

    for (let i = 0; i < state.splashes.length; i++) {
      const sp = state.splashes[i];
      if (!sp.active) continue;
      sp.age += safeDt;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
      }
    }
  }

  const prevFrameIndex = state.prevFrameIndex;
  if (safeDt > 0) {
    state.prevFrameIndex = frameIndex;
  }

  return {
    mode,
    frameIndex,
    prevFrameIndex,
    frameBlendAlpha: 1,
    isBackExploded,
    backExplosionTriggered,
    ruptureProgress,
    facingScale: 1,
    offsetX: state.horiz.posX,
    hopYPx,
    rotationRad,
    springScaleX,
    springScaleY,
    shearXPx,
    swayAmpPx: mode === 'idle' ? (isBackExploded ? 2.6 : 1.9) : mode === 'primed' ? 1.6 : 0.8,
    swayFreq: breathFreq,
    swayPhase: breathPhase,
    uvDistortAmp,
    uvDistortFreq,
    uvDistortPhase,
    tintRgba,
    flashRgba,
    deform,
    backGlowIntensity,
    eyeGlowIntensity,
    clawSlashProgress,
    slimeBurstTriggered,
    slashImpactTriggered,
    nozzles: state.nozzles,
    drops: state.drops,
    splashes: state.splashes,
    alpha,
  };
}
