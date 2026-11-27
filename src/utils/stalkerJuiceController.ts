/**
 * 4-Layer Procedural "Juice" Physics, Blinking & Viscous Slime Drip Controller
 * for the Chitin Stalker (Chitinový slídič).
 *
 * Pure TypeScript / zero DOM dependencies so all kinematics, blinking transitions,
 * spring physics, anatomical spline deformation, and slime drip physics can be
 * deterministically unit-tested via `node:test`.
 */
import {
  type JuiceMeshDeform,
  type SpringScaleState,
  type HorizontalVelocityState,
  applySpringSquashImpulse,
  createNeutralMeshDeform,
  stepHorizontalVelocityShear,
  stepSymplecticSpringScale,
} from './proceduralJuiceCore';
import {
  type FrameTransitionInput,
  computeFrameTransitionState,
} from './spriteSheetAnim';
import {
  STALKER_SLIME_NOZZLES,
  type StalkerAnimMode,
  type StalkerBoneWeight,
  computeStalkerBlinkState,
} from './stalkerSpriteSheet';

export interface StalkerSlimeNozzleState {
  id: string;
  dx: number;
  dy: number;
  bone: StalkerBoneWeight;
  baseRadius: number;
  maxStretchPx: number;
  baseIntervalSec: number;
  /** Current normalized drip phase progress [0..1] */
  timer: number;
  /** Current hanging strand extension in unscaled sprite pixels */
  stretchPx: number;
  /** Current swaying bead radius in unscaled sprite pixels */
  bulbRadius: number;
  /** Horizontal pendulum sway of hanging tip in unscaled sprite pixels */
  swayPx: number;
  /** Current recoil contraction after a droplet snaps off [0..1] */
  recoil: number;
  /** Lifecycle phase */
  phase: 'swelling' | 'stretching' | 'recoiling';
}

export interface StalkerSlimeDrop {
  active: boolean;
  /** Local unscaled sprite pixels relative to (anchorX, bottomY), where y=0 is bridge deck */
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  stretchY: number;
  alpha: number;
}

export interface StalkerSlimeSplash {
  active: boolean;
  /** Local unscaled sprite X relative to anchorX */
  x: number;
  /** Normalized progress [0..1] */
  age: number;
  maxAge: number;
  maxRadius: number;
  seed: number;
}

export interface StalkerCombatCueInput {
  dead?: boolean;
  koProgress?: number;
  attackAnimTimer?: number;
  attackAnimDuration?: number;
  staggerTimer?: number;
  staggerDuration?: number;
  bristleTimer?: number;
  bristleDuration?: number;
  bristleKind?: 'armor' | 'retaliate';
  ambushPrimed?: boolean;
  armoredGuard?: boolean;
  retaliateHover?: boolean;
  staggeredStatus?: boolean;
  instanceIndex?: number;
}

export interface StalkerJuiceState {
  spring: SpringScaleState;
  horiz: HorizontalVelocityState;
  transition: FrameTransitionInput;
  prevMode: StalkerAnimMode;
  prevAttackActive: boolean;
  prevStaggerActive: boolean;
  prevBristleActive: boolean;
  nozzles: StalkerSlimeNozzleState[];
  drops: StalkerSlimeDrop[];
  dropCursor: number;
  splashes: StalkerSlimeSplash[];
  splashCursor: number;
  rngState: number;
}

export interface StalkerJuiceSample {
  mode: StalkerAnimMode;
  frameIndex: 0 | 1;
  prevFrameIndex: number;
  frameBlendAlpha: number;
  /** Eyelid shut peak [0..1] over the narrowed eye during blink apex or hit wince */
  blinkClosure: number;
  isBlinking: boolean;
  /** Native left-facing = +1 */
  facingScale: number;
  /** Horizontal trajectory offset in unscaled 512x512 sprite pixels (negative = left toward hero) */
  offsetX: number;
  /** Vertical leap offset in unscaled 512x512 sprite pixels (negative = upward) */
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
  /** 4-control-point anatomical spline deformation (feet strictly locked at 0,0) */
  deform: JuiceMeshDeform;
  /** Crimson dorsal spine glow [0..1] */
  spineGlowIntensity: number;
  /** Twin scythe slash arc progress [0..1] */
  clawSlashProgress: number;
  /** One-shot cue flags for particle/camera side-effects */
  slimeBurstTriggered: boolean;
  slashImpactTriggered: boolean;
  /** Live slime nozzle & falling droplet state references for renderer */
  nozzles: readonly StalkerSlimeNozzleState[];
  drops: readonly StalkerSlimeDrop[];
  splashes: readonly StalkerSlimeSplash[];
  alpha: number;
}

const SLIME_DROP_POOL_SIZE = 28;
const SLIME_SPLASH_POOL_SIZE = 18;
const SLIME_GRAVITY_PX_S2 = 620;

function nextDeterministicRand(state: StalkerJuiceState): number {
  // Fast deterministic LCG in [0, 1)
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return (state.rngState & 0x00ffffff) / 0x01000000;
}

function getBoneDisplacement(deform: JuiceMeshDeform, bone: StalkerBoneWeight): { dx: number; dy: number } {
  if (bone === 'head') return { dx: deform.head.dx, dy: deform.head.dy };
  if (bone === 'waist') return { dx: deform.waist.dx, dy: deform.waist.dy };
  return { dx: deform.pelvis.dx, dy: deform.pelvis.dy };
}

function spawnSlimeDrop(
  state: StalkerJuiceState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
): void {
  const drop = state.drops[state.dropCursor];
  state.dropCursor = (state.dropCursor + 1) % SLIME_DROP_POOL_SIZE;
  drop.active = true;
  drop.x = x;
  drop.y = y;
  drop.vx = vx;
  drop.vy = vy;
  drop.radius = radius;
  drop.stretchY = 1.15;
  drop.alpha = 1;
}

function spawnSlimeSplash(state: StalkerJuiceState, x: number, radius: number): void {
  const splash = state.splashes[state.splashCursor];
  state.splashCursor = (state.splashCursor + 1) % SLIME_SPLASH_POOL_SIZE;
  splash.active = true;
  splash.x = x;
  splash.age = 0;
  splash.maxAge = 0.42 + nextDeterministicRand(state) * 0.22;
  splash.maxRadius = Math.max(9, radius * 2.8);
  splash.seed = nextDeterministicRand(state) * 6.283;
}

export function createStalkerJuiceState(seed = 1337): StalkerJuiceState {
  const nozzles: StalkerSlimeNozzleState[] = STALKER_SLIME_NOZZLES.map((spec) => ({
    id: spec.id,
    dx: spec.dx,
    dy: spec.dy,
    bone: spec.bone,
    baseRadius: spec.baseRadius,
    maxStretchPx: spec.maxStretchPx,
    baseIntervalSec: spec.baseIntervalSec,
    timer: spec.phaseOffset * spec.baseIntervalSec,
    stretchPx: 4 + spec.phaseOffset * spec.maxStretchPx * 0.45,
    bulbRadius: spec.baseRadius * (0.75 + spec.phaseOffset * 0.4),
    swayPx: 0,
    recoil: 0,
    phase: spec.phaseOffset > 0.42 ? 'stretching' : 'swelling',
  }));

  const drops: StalkerSlimeDrop[] = Array.from({ length: SLIME_DROP_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 4.5,
    stretchY: 1,
    alpha: 0,
  }));

  const splashes: StalkerSlimeSplash[] = Array.from({ length: SLIME_SPLASH_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    age: 0,
    maxAge: 0.45,
    maxRadius: 14,
    seed: 0,
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
    transition: {},
    prevMode: 'idle',
    prevAttackActive: false,
    prevStaggerActive: false,
    prevBristleActive: false,
    nozzles,
    drops,
    dropCursor: 0,
    splashes,
    splashCursor: 0,
    rngState: (seed >>> 0) || 1337,
  };
}

export function stepStalkerJuice(
  state: StalkerJuiceState,
  dt: number,
  elapsed: number,
  cue?: StalkerCombatCueInput,
): StalkerJuiceSample {
  const safeDt = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
  const idx = cue?.instanceIndex ?? 0;

  let mode: StalkerAnimMode = 'idle';
  let modeProgress = 0;
  let alpha = 1;
  let targetPosX = 0;
  let hopYPx = 0;
  let rotationRad = 0;
  let spineGlowIntensity = 0.26 + 0.1 * Math.sin(elapsed * 3.1 + idx);
  let clawSlashProgress = 0;
  let slimeBurstTriggered = false;
  let slashImpactTriggered = false;
  let flashRgba: [number, number, number, number] | null = null;
  let tintRgba: [number, number, number, number] = [1, 1, 1, 1];
  let uvDistortAmp: [number, number] = [0, 0];
  let uvDistortFreq = 11;
  let uvDistortPhase = elapsed * 3.4 + idx;

  const isDead = Boolean(cue?.dead);
  const attackActive = !isDead && (cue?.attackAnimTimer ?? 0) > 0 && (cue?.attackAnimDuration ?? 0) > 0;
  const staggerActive = !isDead && (cue?.staggerTimer ?? 0) > 0 && (cue?.staggerDuration ?? 0) > 0;
  const bristleActive = !isDead && (cue?.bristleTimer ?? 0) > 0 && (cue?.bristleDuration ?? 0) > 0;

  // Detect fresh combat state edges for spring squash/stretch impulses & burst slime flinging
  if (safeDt > 0) {
    if (staggerActive && !state.prevStaggerActive) {
      applySpringSquashImpulse(state.spring, 0.86, 1.14, 0.78, 1.24, -1.6, 2.2);
      slimeBurstTriggered = true;
    } else if (bristleActive && !state.prevBristleActive) {
      applySpringSquashImpulse(state.spring, 1.12, 0.88, 0.78, 1.24, 1.8, -1.5);
      slimeBurstTriggered = true;
    } else if (attackActive && !state.prevAttackActive) {
      applySpringSquashImpulse(state.spring, 1.10, 0.90, 0.78, 1.24, 1.4, -1.4);
      slimeBurstTriggered = true;
    }
  }
  state.prevAttackActive = attackActive;
  state.prevStaggerActive = staggerActive;
  state.prevBristleActive = bristleActive;

  const deform = createNeutralMeshDeform();
  const breathPhase = elapsed * 2.85 + idx * 1.45;
  const breath = Math.sin(breathPhase);
  const prowl = Math.sin(elapsed * 1.45 + idx * 0.9);
  const headTwitch = Math.sin(elapsed * 5.2 + idx * 2.1) * Math.pow(Math.max(0, Math.sin(elapsed * 0.95 + idx)), 4);

  if (isDead) {
    mode = 'death';
    modeProgress = Math.max(0, Math.min(1, cue?.koProgress ?? 0));
    alpha = modeProgress < 0.72 ? 1 : Math.max(0, 1 - (modeProgress - 0.72) / 0.28);
    spineGlowIntensity = Math.max(0, 0.45 * (1 - modeProgress * 1.2));
    // Collapse downward into the lime slime puddle while keeping feet anchored
    const collapse = Math.min(1, modeProgress * 1.45);
    deform.pelvis.dy = collapse * 22;
    deform.waist.dy = collapse * 46;
    deform.waist.scaleX = 1 + collapse * 0.14;
    deform.head.dy = collapse * 78;
    deform.head.dx = -collapse * 18;
    deform.head.rotRad = -collapse * 0.18;
    uvDistortAmp = [0.0025 * (1 - collapse * 0.5), 0.003 * (1 - collapse * 0.5)];
  } else if (staggerActive) {
    mode = 'pain';
    const dur = Math.max(0.05, cue?.staggerDuration ?? 0.38);
    modeProgress = Math.max(0, Math.min(0.999, 1 - (cue?.staggerTimer ?? 0) / dur));
    const whip = Math.sin(modeProgress * Math.PI) * Math.pow(1 - modeProgress, 0.85);
    const shudder = Math.sin(modeProgress * 46) * (1 - modeProgress);
    targetPosX = 24 * whip;
    hopYPx = -12 * Math.sin(modeProgress * Math.PI) * (1 - modeProgress * 0.4);
    rotationRad = 0.095 * whip + 0.025 * shudder;
    spineGlowIntensity = 0.72 * (1 - modeProgress * 0.45);
    // Native left-facing: +dx pulls upper torso BACK (right) in pain recoil!
    deform.pelvis.dx = 8 * whip + 3 * shudder;
    deform.pelvis.dy = 4 * whip;
    deform.waist.dx = 18 * whip + 6 * shudder;
    deform.waist.dy = 8 * whip;
    deform.waist.rotRad = 0.12 * whip;
    deform.head.dx = 28 * whip + 9 * shudder;
    deform.head.dy = 10 * whip;
    deform.head.rotRad = 0.19 * whip;
    if (modeProgress < 0.25) {
      flashRgba = [1, 0.94, 0.76, (1 - modeProgress / 0.25) * 0.55];
    }
    uvDistortAmp = [0.004 * whip, 0.003 * whip];
    uvDistortFreq = 18;
    uvDistortPhase = elapsed * 14;
  } else if (bristleActive) {
    mode = 'bristle';
    const dur = Math.max(0.05, cue?.bristleDuration ?? 0.52);
    modeProgress = Math.max(0, Math.min(0.999, 1 - (cue?.bristleTimer ?? 0) / dur));
    const hunker = modeProgress < 0.25 ? modeProgress / 0.25 : 0;
    const erupt = modeProgress >= 0.25 ? Math.sin(((modeProgress - 0.25) / 0.75) * Math.PI) : 0;
    const tremble = Math.sin(modeProgress * 54) * erupt;
    targetPosX = hunker * 8 - erupt * 10;
    hopYPx = -14 * erupt;
    rotationRad = 0.04 * hunker - 0.045 * erupt;
    spineGlowIntensity = cue?.bristleKind === 'retaliate' ? 1.0 : 0.92;
    deform.pelvis.dy = hunker * 10 - erupt * 6;
    deform.waist.dy = hunker * 18 - erupt * 18;
    deform.waist.scaleX = 1 + erupt * 0.11;
    deform.waist.dx = -erupt * 8 + tremble * 4;
    deform.head.dy = hunker * 24 - erupt * 24;
    deform.head.dx = -erupt * 14 + tremble * 5;
    deform.head.rotRad = -erupt * 0.08;
    tintRgba = [1 + erupt * 0.22, 1 - erupt * 0.06, 1 + erupt * 0.14, 1];
    uvDistortAmp = [0.0038 * erupt, 0.0042 * erupt];
    uvDistortFreq = 20;
    uvDistortPhase = elapsed * 12;
  } else if (attackActive) {
    mode = 'attack';
    const dur = Math.max(0.08, cue?.attackAnimDuration ?? 0.54);
    modeProgress = Math.max(0, Math.min(0.999, 1 - (cue?.attackAnimTimer ?? 0) / dur));
    spineGlowIntensity = modeProgress > 0.18 && modeProgress < 0.82 ? 0.92 : 0.48;

    if (modeProgress < 0.24) {
      // Phase 1: Coiled predatory windup (pull right, crouch low, rear head back)
      const k = modeProgress / 0.24;
      const ease = k * k;
      targetPosX = 32 * ease;
      hopYPx = 0;
      rotationRad = 0.08 * ease;
      deform.pelvis.dx = 6 * ease;
      deform.pelvis.dy = 10 * ease;
      deform.waist.dx = 14 * ease;
      deform.waist.dy = 18 * ease;
      deform.waist.scaleX = 1 + 0.07 * ease;
      deform.head.dx = 20 * ease;
      deform.head.dy = 22 * ease;
      deform.head.rotRad = 0.09 * ease;
    } else if (modeProgress < 0.54) {
      // Phase 2: Explosive forward scythe pounce leap toward Kira (negative X = left)
      const k = (modeProgress - 0.24) / 0.30;
      const surge = Math.sin(k * Math.PI * 0.5);
      targetPosX = 32 - 178 * surge;
      hopYPx = -46 * Math.sin(k * Math.PI);
      rotationRad = 0.08 - 0.19 * surge;
      clawSlashProgress = k * 0.52;
      deform.pelvis.dx = -8 * surge;
      deform.pelvis.dy = -4 * surge;
      deform.waist.dx = -22 * surge;
      deform.waist.dy = -8 * surge;
      deform.waist.scaleX = 1.04 - 0.07 * surge;
      deform.head.dx = -34 * surge;
      deform.head.dy = -6 * surge;
      deform.head.rotRad = -0.14 * surge;
      if (k > 0.72 && k < 0.86) {
        slashImpactTriggered = true;
        slimeBurstTriggered = true;
      }
    } else if (modeProgress < 0.78) {
      // Phase 3: Downward scythe rip & landing squash bounce
      const k = (modeProgress - 0.54) / 0.24;
      const land = Math.sin(k * Math.PI);
      targetPosX = -146 - 16 * (1 - k);
      hopYPx = -6 * (1 - k);
      rotationRad = -0.11 * (1 - k * 0.55);
      clawSlashProgress = 0.52 + k * 0.48;
      deform.pelvis.dx = -6 * (1 - k);
      deform.pelvis.dy = 12 * land;
      deform.waist.dx = -18 * (1 - k);
      deform.waist.dy = 18 * land;
      deform.waist.scaleX = 1 + 0.09 * land;
      deform.head.dx = -28 * (1 - k);
      deform.head.dy = 24 * land;
      deform.head.rotRad = -0.12 * (1 - k * 0.5);
      if (safeDt > 0 && k < 0.18) {
        applySpringSquashImpulse(state.spring, 1.14, 0.86, 0.78, 1.24, 0.8, -1.2);
      }
    } else {
      // Phase 4: Agile snap-back recovery
      const k = (modeProgress - 0.78) / 0.22;
      const inv = 1 - k * k;
      targetPosX = -146 * inv;
      hopYPx = -12 * Math.sin(k * Math.PI);
      rotationRad = -0.05 * inv;
      deform.waist.dx = -8 * inv;
      deform.head.dx = -14 * inv;
    }
    uvDistortAmp = [0.0026, 0.0022];
    uvDistortFreq = 16;
    uvDistortPhase = elapsed * 10;
  } else if (cue?.ambushPrimed) {
    mode = 'ambush';
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.8 + idx);
    const quiver = Math.sin(elapsed * 22 + idx) * 1.6;
    spineGlowIntensity = 0.72 + 0.28 * pulse;
    rotationRad = -0.036;
    // Deep coiled predatory crouch, leaning forward (-dx) ready to pounce
    deform.pelvis.dx = -3 - pulse * 2;
    deform.pelvis.dy = 8 + pulse * 4;
    deform.waist.dx = -9 - pulse * 4 + quiver * 0.4;
    deform.waist.dy = 15 + pulse * 6;
    deform.waist.scaleX = 1.04 + pulse * 0.03;
    deform.head.dx = -16 - pulse * 6 + quiver;
    deform.head.dy = 19 + pulse * 7;
    deform.head.rotRad = -0.065 - pulse * 0.025;
    uvDistortAmp = [0.0026, 0.0024];
    uvDistortFreq = 17;
    uvDistortPhase = elapsed * 8.5;
  } else if (cue?.retaliateHover || cue?.armoredGuard) {
    mode = 'guard';
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * (cue?.retaliateHover ? 8.5 : 4.6) + idx);
    spineGlowIntensity = cue?.retaliateHover ? 0.88 + 0.12 * pulse : 0.62 + 0.24 * pulse;
    deform.pelvis.dy = 3 + pulse * 3;
    deform.waist.dx = -3 + pulse * 2;
    deform.waist.dy = -4 - pulse * 5;
    deform.waist.scaleX = 1.03 + pulse * 0.035;
    deform.head.dx = -6 - pulse * 3;
    deform.head.dy = -5 - pulse * 6;
    deform.head.rotRad = -0.025;
    uvDistortAmp = [0.0022, 0.002];
    uvDistortFreq = 15;
    uvDistortPhase = elapsed * 6.5;
  } else {
    // Organic living predator idle: breathing ribcage, stalking prowler sway, subtle head scan & neck bob
    mode = 'idle';
    const breathLift = -breath * 6.5;
    const stalkShift = prowl * 5.5;
    deform.pelvis.dx = stalkShift * 0.35;
    deform.pelvis.dy = breathLift * 0.28;
    deform.waist.dx = stalkShift * 0.85 - breath * 2.4;
    deform.waist.dy = breathLift * 0.78;
    deform.waist.rotRad = -prowl * 0.022 + breath * 0.015;
    deform.waist.scaleX = 1 + breath * 0.028;
    deform.head.dx = stalkShift * 1.45 - breath * 4.2 + headTwitch * 5.0;
    deform.head.dy = breathLift * 1.25 + Math.abs(prowl) * 2.5;
    deform.head.rotRad = -prowl * 0.036 + breath * 0.024 + headTwitch * 0.045;

    if (cue?.staggeredStatus) {
      const dizzy = Math.sin(elapsed * 5.6 + idx);
      deform.waist.dx += dizzy * 6.5;
      deform.head.dx += dizzy * 12.0;
      deform.head.rotRad += dizzy * 0.085;
    }
  }

  // Layer 1: Symplectic damped spring-damper squash & stretch + velocity-coupled horizontal shear
  stepSymplecticSpringScale(state.spring, safeDt, 190, 14.5, 0.78, 1.24);
  const shearXPx = stepHorizontalVelocityShear(state.horiz, targetPosX, safeDt, 16, 0.032, 18);

  // Subtle living breathing scale layered cleanly on top of spring scale
  const idleBreathX = mode === 'idle' ? 1 - breath * 0.016 : 1;
  const idleBreathY = mode === 'idle' ? 1 + breath * 0.024 : 1;
  const springScaleX = state.spring.springScaleX * idleBreathX;
  const springScaleY = state.spring.springScaleY * idleBreathY;

  // Blinking + Eye State
  const blink = computeStalkerBlinkState(elapsed, idx, mode, modeProgress);
  const frameIndex = blink.frameIndex;
  const blendDur = blink.isBlinking ? 0.04 : 0.065;
  const transition = computeFrameTransitionState(state.transition, frameIndex, safeDt, blendDur);
  state.transition = transition;

  // Layer 4: Multi-Nozzle Viscous Acid-Lime Slime Drip Simulation
  if (safeDt > 0) {
    const rateMul =
      mode === 'attack' || mode === 'bristle'
        ? 2.2
        : mode === 'ambush' || mode === 'pain'
          ? 1.55
          : mode === 'death'
            ? 0.45
            : 1.0;

    for (let i = 0; i < state.nozzles.length; i++) {
      const n = state.nozzles[i];
      const boneDisp = getBoneDisplacement(deform, n.bone);
      const anchorX = n.dx + boneDisp.dx;
      const anchorY = n.dy + boneDisp.dy + hopYPx;

      // Pendulum sway of hanging slime strand driven by creature horizontal velocity & breathing
      const targetSway = Math.max(-14, Math.min(14, -state.horiz.velX * 0.022 + Math.sin(elapsed * 3.4 + i * 1.1) * 2.2));
      n.swayPx += (targetSway - n.swayPx) * Math.min(1, safeDt * 9);

      if (n.recoil > 0) {
        n.recoil = Math.max(0, n.recoil - safeDt * 3.6);
      }

      n.timer += safeDt * rateMul;
      const u = Math.min(1, n.timer / n.baseIntervalSec);

      if (u < 0.35) {
        // Phase A: Glossy bulb slowly swells at the hanging tip
        n.phase = n.recoil > 0.1 ? 'recoiling' : 'swelling';
        const k = u / 0.35;
        n.stretchPx = 3 + k * (n.maxStretchPx * 0.25);
        n.bulbRadius = n.baseRadius * (0.55 + k * 0.58);
      } else if (u < 1.0) {
        // Phase B: Gravity stretches a necking viscous strand downward until pinch-off
        n.phase = 'stretching';
        const k = (u - 0.35) / 0.65;
        const accel = k * k * (3 - 2 * k) * 0.55 + k * k * k * 0.45;
        n.stretchPx = n.maxStretchPx * (0.25 + accel * 0.75);
        n.bulbRadius = n.baseRadius * (1.13 + k * 0.28);
      } else {
        // Phase C: Pinch-off snap! Detach falling droplet & recoil strand upward
        const dropX = anchorX + n.swayPx;
        const dropY = anchorY + n.stretchPx;
        const flingVx =
          state.horiz.velX * 0.22 +
          (nextDeterministicRand(state) - 0.5) * (mode === 'attack' ? 85 : 20);
        const initialVy = 28 + nextDeterministicRand(state) * 26;
        spawnSlimeDrop(state, dropX, dropY, flingVx, initialVy, n.bulbRadius * 0.92);

        n.timer = 0;
        n.stretchPx = 2.5;
        n.bulbRadius = n.baseRadius * 0.5;
        n.recoil = 1.0;
        n.phase = 'recoiling';
      }

      // If a violent lunge, bristle, or hit recoil occurs, shake loose extra slime beads from head/claw nozzles!
      if (slimeBurstTriggered && (n.bone === 'head' || n.bone === 'waist') && n.stretchPx > 8) {
        const dropX = anchorX + n.swayPx;
        const dropY = anchorY + n.stretchPx;
        const burstDir = mode === 'pain' ? 1 : -1;
        const burstVx = burstDir * (45 + nextDeterministicRand(state) * 115);
        const burstVy = -40 - nextDeterministicRand(state) * 75;
        spawnSlimeDrop(state, dropX, dropY, burstVx, burstVy, n.baseRadius * 0.85);
        n.timer *= 0.25;
        n.stretchPx = 3;
        n.recoil = 0.85;
      }
    }

    // Integrate falling slime drops under gravity -> splash on deck (y >= 0)
    for (let i = 0; i < state.drops.length; i++) {
      const d = state.drops[i];
      if (!d.active) continue;
      d.vy += SLIME_GRAVITY_PX_S2 * safeDt;
      d.x += d.vx * safeDt;
      d.y += d.vy * safeDt;
      d.vx *= Math.max(0.86, 1 - safeDt * 1.4);
      d.stretchY = Math.min(2.35, 1.05 + Math.abs(d.vy) / 280);

      if (d.y >= 2) {
        d.active = false;
        spawnSlimeSplash(state, d.x, d.radius);
      }
    }

    // Advance ground slime splash ripples
    for (let i = 0; i < state.splashes.length; i++) {
      const sp = state.splashes[i];
      if (!sp.active) continue;
      sp.age += safeDt;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
      }
    }
  }

  return {
    mode,
    frameIndex,
    prevFrameIndex: transition.prevFrameIndex,
    frameBlendAlpha: mode === 'death' ? 1 : transition.frameBlendAlpha,
    blinkClosure: blink.blinkClosure,
    isBlinking: blink.isBlinking,
    facingScale: 1,
    offsetX: state.horiz.posX,
    hopYPx,
    rotationRad,
    springScaleX,
    springScaleY,
    shearXPx,
    swayAmpPx: mode === 'idle' ? 2.4 : mode === 'ambush' ? 1.8 : 1.0,
    swayFreq: 2.85,
    swayPhase: breathPhase,
    uvDistortAmp,
    uvDistortFreq,
    uvDistortPhase,
    tintRgba,
    flashRgba,
    deform,
    spineGlowIntensity,
    clawSlashProgress,
    slimeBurstTriggered,
    slashImpactTriggered,
    nozzles: state.nozzles,
    drops: state.drops,
    splashes: state.splashes,
    alpha,
  };
}
