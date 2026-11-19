/**
 * @file bruteJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Carapace Brute (`brute`).
 *
 * Follows ENEMY_ANIMATION_GUIDE.md & ENEMY_DESIGN_PRINCIPLES.md:
 *   Layer 1 — Clean Sprite Frame Selection & Cross-Dissolve (grounded idle 1/2/3, stomp stride 0/1,
 *             Mutagen Vial Brace 4->5->6->7, Seismic Crush 8->9->10->11, Pain/Collapse 12..15).
 *   Layer 2 — Heavyweight Transform Math & 2nd-Order Damped Harmonic Spring Physics:
 *             - Sub-stepped symplectic Euler spring (k=280, c=19) for heavy armored mass
 *             - Heavy stomp stride & parabolic foot-plant compression impulse
 *             - Velocity-driven horizontal shear (maxSkewPx=18)
 *             - Smooth 2.5D Paper-Mario Horizontal Flip (-1 <-> +1) with clamped non-zero determinant
 *   Layer 3 — 4-Control-Point Anatomical Spine Deformation (Feet h=0 strictly pinned at 0,0;
 *             Pelvis h=0.33, Waist h=0.67, Head h=1.00 driving coil, leap stretch, slam crunch, whip recoil).
 *   Layer 4 — GPU Shader Uniforms & VFX Edge Triggers (Anti-Jelly compliant: uvDistortAmp=[0,0] in
 *             idle/walk/smash/hit/turn; low-frequency heat/shell shimmer only on Mutagen Brace flare
 *             and Heavy Primed overheat; synced hit-flash & exact rising-edge triggers for Seismic
 *             Fissures, Mutagen Mist clouds, and Kinetic Glass/Chitin Shards).
 */

import { computeFrameTransitionState, type FrameTransitionResult } from './spriteSheetAnim';

/**
 * The 6 canonical turn-based combat states exposed to the combat engine and keys 1–6 test harness.
 */
export type BruteJuiceTrigger =
  | 'idle'           // Key 1: Heavy chest breathing + periodic jaw-snarl (tight foot frames 1/2/3)
  | 'stomp_walk'     // Key 2: Heavyweight stomp stride (frames 0/1) + foot-plant spring compression
  | 'seismic_smash'  // Key 3: C1 Coil (8) -> Airborne Leap (9) -> Two-Fist Slam (10) + Fissure & Shards -> Follow-through (11)
  | 'mutagen_brace'  // Key 4: Grab Vials (4) -> Crush Vials + Mist (5) -> Dorsal Flare (6) -> Veined Guard (7)
  | 'take_hit'       // Key 5: Pain Recoil (12) -> Knee Stagger (13) + hit-flash + spine whip + chitin shards
  | 'turn_around';   // Key 6: Smooth 2.5D horizontal scale flip (-1 <-> +1) with heavyweight hop

/**
 * Tunable inspector/config parameters with heavyweight armored defaults for the Carapace Brute.
 */
export interface BruteJuiceConfig {
  /** Hooke spring stiffness k (default: 280 — stiffer carapace recovery) */
  springStiffness: number;
  /** Viscous spring damping c (default: 19 — heavy armored settle) */
  springDamping: number;
  /** Heavy stomp angular frequency rad/s (default: 10.5) */
  stompSpeed: number;
  /** Maximum stomp tilt angle in radians (default: 0.068) */
  stompMaxAngleRad: number;
  /** Maximum stomp vertical hop height in unscaled sprite pixels (default: 9) */
  stompHopHeightPx: number;
  /** Horizontal velocity-to-shear conversion factor (default: 0.036) */
  velocitySkewFactor: number;
  /** Maximum horizontal velocity shear in pixels (default: 18) */
  maxSkewPx: number;
  /** Seismic Crush shockwave / tremor / shard intensity multiplier (default: 1.0) */
  seismicImpactStrength: number;
  /** Base UV heat distortion strength during shell flare / heavy primed (default: 1.0) */
  uvDistortStrength: number;
  /** Duration of a 2.5D Paper-Mario horizontal turn flip in seconds (default: 0.48) */
  flipDurationSec: number;
  /** Vertical hop height at the midpoint of a 2.5D turn flip in pixels (default: 16) */
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

export interface BruteControlPointKnot {
  dx: number;
  dy: number;
  rotRad: number;
  scaleX: number;
}

export interface BruteMeshDeform {
  feet: BruteControlPointKnot;
  pelvis: BruteControlPointKnot;
  waist: BruteControlPointKnot;
  head: BruteControlPointKnot;
}

/**
 * Persistent per-Brute runtime physics & state-machine state.
 */
export interface BruteJuiceState {
  // Layer 1: Frame & idle snarl timers
  activeTrigger: BruteJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  snarlTimer: number;
  snarlHoldTimer: number;
  snarlVariant: 2 | 3;
  transition: FrameTransitionResult;

  // Layer 2A: Damped harmonic spring for (scaleX, scaleY) around (1, 1)
  springScaleX: number;
  springScaleY: number;
  springVelX: number;
  springVelY: number;

  // Layer 2B: Horizontal locomotion, velocity skew & heavy stomp cycle
  posX: number;
  velX: number;
  prevPosX: number;
  stompTime: number;
  wasAirborne: boolean;

  // Layer 2C: 2.5D Paper-Mario horizontal flip state
  baseFacingSign: -1 | 1;
  currentFacingScale: number;
  flipActive: boolean;
  flipElapsed: number;
  flipStartSign: -1 | 1;
  flipTargetSign: -1 | 1;
  flipAutoReturn: boolean;

  // Layer 4: Hit-flash & edge detectors for combat synchronization & VFX bursts
  hitFlashTimer: number;
  lastSeenAttackTimer: number;
  lastSeenStaggerTimer: number;
  lastSeenBristleTimer: number;
  lastSeenWeaponBroken: boolean;
  pendingChitinBurst: boolean;
}

/**
 * Combined 4-layer output evaluated each frame for a Carapace Brute instance.
 */
export interface BruteJuiceSample {
  activeTrigger: BruteJuiceTrigger;
  /** Layer 1: Active sprite frame index (0..15) and cross-dissolve state */
  frameIndex: number;
  prevFrameIndex: number;
  frameBlendAlpha: number;
  /** Layer 2: Damped spring squash & stretch around (1, 1) */
  springScaleX: number;
  springScaleY: number;
  /** Layer 2: Heavy stomp + kinetic lean rotation in radians */
  rotationRad: number;
  /** Layer 2: Horizontal offset in unscaled sprite pixels (negative = left toward heroine) */
  offsetX: number;
  /** Layer 2: Vertical hop/leap offset in unscaled sprite pixels (negative = upward) */
  hopYPx: number;
  /** Layer 2: Velocity-driven horizontal shear at the top of the sprite in pixels */
  shearXPx: number;
  /** Layer 2: Smooth 2.5D horizontal facing scale in [-1..+1] (-1 = facing left toward heroine) */
  facingScale: number;
  /** Layer 3: 4-control-point anatomical mesh deformation (Feet strictly pinned at 0,0) */
  deform: BruteMeshDeform;
  /** Layer 4: GPU shader parameters */
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  flashRgba: [number, number, number, number] | null;
  tintRgba: [number, number, number, number];
  /** VFX Intensities & 1-frame Rising-Edge Triggers */
  vialGlowIntensity: number;
  shellGlowIntensity: number;
  shockwaveIntensity: number;
  /** Normalized progress [0..1] of emerald mutagen aerosol mist emission */
  mutagenMistProgress: number;
  /** Normalized progress [0..1] of seismic ground impact sequence */
  seismicImpactProgress: number;
  /** True on the exact frame Seismic Smash strikes the bridge deck (u crosses 0.50) */
  seismicImpactTriggered: boolean;
  /** True on the exact frame pocket vials shatter during Mutagen Brace (u crosses 0.24) */
  vialShatterTriggered: boolean;
  /** True on the exact frame a heavy hit / Weapon-Break / take_hit shatters chitin shards */
  chitinShardTriggered: boolean;
  /** True on the exact frame a heavy stomp foot lands on the bridge deck */
  footPlantTriggered: boolean;
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

/**
 * Injects an immediate squash-and-stretch impulse into the 2nd-order damped harmonic spring.
 * Heavy Brute clamps keep silhouette volume tight without excessive rubber distortion.
 */
export function applyBruteSquash(
  state: BruteJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  state.springScaleX = Math.max(0.62, Math.min(1.48, targetScaleX));
  state.springScaleY = Math.max(0.62, Math.min(1.48, targetScaleY));
  state.springVelX += velImpulseX;
  state.springVelY += velImpulseY;
}

/**
 * Triggers one of the 6 canonical turn-based combat states (keys 1–6 or combat engine cues).
 */
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
      // Heavy windup squat impulse before airborne leap
      applyBruteSquash(state, 1.18, 0.82, 1.2, -1.5);
      break;
    }
    case 'mutagen_brace': {
      state.triggerDuration = 1.18;
      // Chest compression as Brute draws and prepares to crush chest vials
      applyBruteSquash(state, 1.12, 0.88, 0.9, -0.8);
      break;
    }
    case 'take_hit': {
      state.triggerDuration = 0.72;
      state.hitFlashTimer = 0.24;
      state.pendingChitinBurst = true;
      // Heavy recoil vertical stretch + backward velocity kick
      applyBruteSquash(state, 0.80, 1.20, -2.0, 2.2);
      state.velX = 185;
      break;
    }
    case 'turn_around': {
      state.triggerDuration = Math.max(0.30, config.flipDurationSec * 2.15);
      state.flipActive = true;
      state.flipElapsed = 0;
      state.flipStartSign = state.baseFacingSign;
      state.flipTargetSign = (state.baseFacingSign === -1 ? 1 : -1) as -1 | 1;
      state.flipAutoReturn = true;
      applyBruteSquash(state, 0.91, 1.11);
      break;
    }
  }
}

/**
 * Steps the 4-layer procedural animation & spring physics state by `dt` seconds.
 * Pure, deterministic, zero heap allocations on hot path.
 */
export function stepBruteJuice(
  state: BruteJuiceState,
  dt: number,
  elapsed: number,
  config: BruteJuiceConfig = DEFAULT_BRUTE_JUICE_CONFIG,
  combatSync?: {
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
  },
): BruteJuiceSample {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const idx = combatSync?.instanceIndex ?? 0;

  let seismicImpactTriggered = false;
  let vialShatterTriggered = false;
  let chitinShardTriggered = state.pendingChitinBurst;
  state.pendingChitinBurst = false;
  let footPlantTriggered = false;

  // Synchronize automatic combat engine triggers when a real combat cue starts
  let prevCombatAttackU = 0;
  let prevCombatBristleU = 0;
  if (combatSync) {
    const atkTimer = combatSync.attackAnimTimer ?? 0;
    const atkDur = combatSync.attackAnimDuration ?? 0.74;
    if (atkTimer > state.lastSeenAttackTimer + 0.05) {
      applyBruteSquash(state, 1.16, 0.84, 1.1, -1.3);
    }
    if (atkDur > 0 && state.lastSeenAttackTimer > 0) {
      prevCombatAttackU = Math.max(0, Math.min(1, 1 - state.lastSeenAttackTimer / atkDur));
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
      prevCombatBristleU = Math.max(0, Math.min(1, 1 - state.lastSeenBristleTimer / brisDur));
    }
    state.lastSeenBristleTimer = brisTimer;

    const weaponBroken = Boolean(combatSync.weaponBroken);
    if (weaponBroken && !state.lastSeenWeaponBroken) {
      chitinShardTriggered = true;
      state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.26);
      applyBruteSquash(state, 0.76, 1.24, -2.2, 2.4);
    }
    state.lastSeenWeaponBroken = weaponBroken;
  }

  // Advance active showcase trigger timer
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

  // ---------------------------------------------------------------------------
  // LAYER 2A: 2nd-Order Damped Harmonic Spring Squash & Stretch
  //   d²x/dt² = -k * (x - 1) - c * dx/dt (2 symplectic Euler sub-steps)
  // ---------------------------------------------------------------------------
  if (safeDt > 0) {
    const k = config.springStiffness;
    const c = config.springDamping;
    const subDt = safeDt * 0.5;
    for (let step = 0; step < 2; step++) {
      const accX = -k * (state.springScaleX - 1) - c * state.springVelX;
      const accY = -k * (state.springScaleY - 1) - c * state.springVelY;
      state.springVelX += accX * subDt;
      state.springVelY += accY * subDt;
      state.springScaleX += state.springVelX * subDt;
      state.springScaleY += state.springVelY * subDt;
    }
    state.springScaleX = Math.max(0.65, Math.min(1.44, state.springScaleX));
    state.springScaleY = Math.max(0.65, Math.min(1.44, state.springScaleY));
  }

  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - safeDt);
  }

  // ---------------------------------------------------------------------------
  // LAYER 2C: 2.5D Paper-Mario Horizontal Flip (-1 <-> +1 with hop)
  // ---------------------------------------------------------------------------
  let flipHopYPx = 0;
  if (state.flipActive) {
    state.flipElapsed += safeDt;
    const flipDur = Math.max(0.18, config.flipDurationSec);
    const u = Math.max(0, Math.min(1, state.flipElapsed / flipDur));
    const cosInterp = 0.5 - 0.5 * Math.cos(u * Math.PI);
    state.currentFacingScale =
      state.flipStartSign + (state.flipTargetSign - state.flipStartSign) * cosInterp;
    if (Math.abs(state.currentFacingScale) < 0.04) {
      state.currentFacingScale = state.currentFacingScale >= 0 ? 0.04 : -0.04;
    }
    flipHopYPx = -Math.sin(u * Math.PI) * config.flipHopHeightPx;

    if (u >= 1) {
      state.baseFacingSign = state.flipTargetSign;
      state.currentFacingScale = state.flipTargetSign;
      if (state.flipAutoReturn && state.flipTargetSign !== -1) {
        state.flipElapsed = -0.15;
        state.flipStartSign = state.flipTargetSign;
        state.flipTargetSign = -1;
        state.flipAutoReturn = false;
        applyBruteSquash(state, 1.12, 0.89);
      } else {
        state.flipActive = false;
        applyBruteSquash(state, 1.14, 0.88);
        footPlantTriggered = true;
      }
    }
  } else {
    state.currentFacingScale = state.baseFacingSign;
  }

  // ---------------------------------------------------------------------------
  // LAYER 1, 2B, 3 & 4: State-Driven Frame Selection, Stomp, Deform & Uniforms
  // ---------------------------------------------------------------------------
  let frameIndex = 1;
  let targetPosX = 0;
  let hopYPx = flipHopYPx;
  let rotationRad = 0;
  let vialGlowIntensity = 0.24 + 0.1 * Math.sin(elapsed * 2.6 + idx);
  let shellGlowIntensity = 0.16 + 0.08 * Math.sin(elapsed * 2.1 + idx * 0.9);
  let shockwaveIntensity = 0;
  let mutagenMistProgress = 0;
  let seismicImpactProgress = 0;

  const deform: BruteMeshDeform = {
    feet: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    pelvis: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    waist: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    head: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
  };

  let swayAmpPx = 0;
  const swayFreq = 2.1;
  const swayPhase = elapsed * 2.1 + idx * 1.3;
  // Anti-Jelly Principle: uvDistortAmp stays [0,0] by default
  let uvDistortAmp: [number, number] = [0, 0];
  let uvDistortFreq = 10.0;
  let uvDistortPhase = elapsed * 4.5 + idx;
  let tintRgba: [number, number, number, number] = [1, 1, 1, 1];

  const isDead = Boolean(combatSync?.dead);
  const hasCombatAttack =
    (combatSync?.attackAnimTimer ?? 0) > 0 && (combatSync?.attackAnimDuration ?? 0) > 0;
  const hasCombatHurt =
    (combatSync?.staggerTimer ?? 0) > 0 && (combatSync?.staggerDuration ?? 0) > 0;
  const hasCombatBrace =
    (combatSync?.bristleTimer ?? 0) > 0 && (combatSync?.bristleDuration ?? 0) > 0;

  if (isDead) {
    const p = Math.max(0, Math.min(1, combatSync?.koProgress ?? 0));
    const collapseNorm = Math.min(1, p / 0.8);
    const step = Math.min(3, Math.floor(collapseNorm * 4));
    frameIndex = 12 + step;
    vialGlowIntensity = Math.max(0, 0.35 * (1 - p * 1.3));
    shellGlowIntensity = Math.max(0, 0.25 * (1 - p * 1.3));
  } else if (state.activeTrigger === 'stomp_walk') {
    // KEY 2: Heavyweight Stomp Stride (Frames 0 & 1) + Foot-Plant Landing Impulse
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    const strideCurve = Math.sin(u * Math.PI);
    targetPosX = -strideCurve * 72;
    const isAdvancing = u < 0.55;
    frameIndex = isAdvancing ? 0 : 1; // Frame 0 = wide stomp forward stride, Frame 1 = braced stance

    state.stompTime += safeDt * config.stompSpeed;
    const stompSin = Math.sin(state.stompTime);
    const liftAbs = Math.abs(stompSin);
    const isAirborne = liftAbs > 0.25;
    if (state.wasAirborne && !isAirborne && safeDt > 0) {
      // Heavy foot-plant ground compression impulse
      applyBruteSquash(state, 1.13, 0.88, 0.8, -0.9);
      footPlantTriggered = true;
    }
    state.wasAirborne = isAirborne;

    rotationRad += stompSin * config.stompMaxAngleRad;
    hopYPx -= liftAbs * config.stompHopHeightPx;

    const leanDir = isAdvancing ? 1 : -0.6;
    deform.pelvis.dx = leanDir * 2.5;
    deform.waist.dx = leanDir * 5.2;
    deform.waist.dy = -liftAbs * 1.5;
    deform.head.dx = leanDir * 8.0;
    deform.head.rotRad = stompSin * 0.038;
    vialGlowIntensity = 0.44 + 0.14 * liftAbs;
    shellGlowIntensity = 0.36 + 0.12 * liftAbs;
  } else if (state.activeTrigger === 'seismic_smash' || hasCombatAttack) {
    // KEY 3 (and Combat Heavy Smash / Claw Strike)
    const isHeavy =
      state.activeTrigger === 'seismic_smash' || combatSync?.bruteAttackKind !== 'attack';
    const dur = hasCombatAttack
      ? Math.max(0.01, combatSync!.attackAnimDuration!)
      : Math.max(0.01, state.triggerDuration);
    const u = hasCombatAttack
      ? Math.max(0, Math.min(0.999, 1 - combatSync!.attackAnimTimer! / dur))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
    const prevU = hasCombatAttack ? prevCombatAttackU : prevTriggerElapsed / dur;

    if (isHeavy) {
      // Rising-edge Seismic Impact at u = 0.50 (fist slam down onto sky-bridge glass deck)
      if (prevU < 0.5 && u >= 0.5) {
        const s = Math.max(0.5, config.seismicImpactStrength);
        applyBruteSquash(state, 1 + 0.26 * s, 1 - 0.24 * s, 2.2 * s, -2.0 * s);
        state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.11);
        seismicImpactTriggered = true;
      }

      if (u < 0.22) {
        // Phase 1: Coiled 2-Arm Windup (Frame 8) with C1 cosine acceleration
        const a = 0.5 - 0.5 * Math.cos((u / 0.22) * Math.PI);
        frameIndex = 8;
        targetPosX = a * 18;
        hopYPx -= a * 4;
        rotationRad = a * 0.055;
        deform.pelvis.dx = -a * 3.0;
        deform.pelvis.scaleX = 1 + a * 0.06;
        deform.waist.dx = -a * 6.5;
        deform.waist.dy = a * 3.0;
        deform.head.dx = -a * 10.5;
        deform.head.rotRad = -a * 0.07;
        shellGlowIntensity = 0.58 + a * 0.34;
        vialGlowIntensity = 0.62;
      } else if (u < 0.5) {
        // Phase 2: Airborne Smash Peak (Frame 9) — parabolic arc toward Heroine
        const s = (u - 0.22) / 0.28;
        const thrust = Math.sin(s * (Math.PI * 0.5));
        frameIndex = 9;
        targetPosX = 18 * (1 - thrust) - thrust * 74;
        hopYPx -= Math.sin(s * Math.PI) * 30;
        rotationRad = -0.045 * thrust;
        deform.pelvis.dx = 3.5 * thrust;
        deform.waist.dx = 7.5 * thrust;
        deform.waist.dy = -4.5 * Math.sin(s * Math.PI);
        deform.waist.scaleX = 0.94;
        deform.head.dx = 12.0 * thrust;
        deform.head.dy = -9.5 * Math.sin(s * Math.PI);
        deform.head.rotRad = 0.06 * thrust;
        shellGlowIntensity = 0.94;
        vialGlowIntensity = 0.72;
      } else if (u < 0.82) {
        // Phase 3: Devastating Two-Fist Ground Smash (Frame 10)
        const f = (u - 0.5) / 0.32;
        const crunch = Math.sin((1 - f * 0.45) * (Math.PI * 0.5));
        frameIndex = 10;
        targetPosX = -74 * (1 - f * 0.16);
        rotationRad = -0.08 * crunch;
        deform.pelvis.dx = 4.5 * crunch;
        deform.pelvis.dy = 2.0 * crunch;
        deform.waist.dx = 9.0 * crunch;
        deform.waist.dy = 5.5 * crunch;
        deform.waist.scaleX = 1 + 0.11 * crunch;
        deform.head.dx = 14.0 * crunch;
        deform.head.dy = 8.0 * crunch;
        deform.head.rotRad = 0.11 * crunch;
        shockwaveIntensity = Math.sin(f * Math.PI) * Math.min(1.25, config.seismicImpactStrength);
        seismicImpactProgress = Math.min(1, f);
        shellGlowIntensity = 0.96 - f * 0.22;
        vialGlowIntensity = 0.74;
      } else {
        // Phase 4: Claw/Maw Follow-Through & C1 Return (Frame 11)
        const r = (u - 0.82) / 0.18;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        frameIndex = 11;
        targetPosX = -62 * ease;
        rotationRad = -0.03 * ease;
        deform.waist.dx = 5.0 * ease;
        deform.head.dx = 8.5 * ease;
        shellGlowIntensity = 0.52 * ease + 0.18;
        vialGlowIntensity = 0.5;
      }
    } else {
      // Standard Melee Claw & Maw Crunch (Frames 8 -> 11 -> 1)
      if (prevU < 0.26 && u >= 0.26) {
        applyBruteSquash(state, 1.18, 0.84, 1.5, -1.2);
      }
      if (u < 0.26) {
        const a = 0.5 - 0.5 * Math.cos((u / 0.26) * Math.PI);
        frameIndex = 8;
        targetPosX = a * 16;
        hopYPx -= a * 5;
        rotationRad = a * 0.045;
        deform.waist.dx = -a * 5.5;
        deform.head.dx = -a * 9.0;
        vialGlowIntensity = 0.58;
        shellGlowIntensity = 0.45;
      } else if (u < 0.74) {
        const s = (u - 0.26) / 0.48;
        const thrust = Math.sin(s * (Math.PI * 0.5));
        frameIndex = 11;
        targetPosX = 16 * (1 - thrust) - thrust * 68;
        hopYPx -= Math.sin(s * Math.PI) * 6;
        rotationRad = -0.075 * thrust;
        deform.pelvis.dx = 4.0 * thrust;
        deform.waist.dx = 9.0 * thrust;
        deform.head.dx = 14.5 * thrust;
        vialGlowIntensity = 0.66;
        shellGlowIntensity = 0.52;
      } else {
        const r = (u - 0.74) / 0.26;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        frameIndex = 1;
        targetPosX = -68 * ease;
        deform.waist.dx = 4.0 * ease;
        deform.head.dx = 7.0 * ease;
      }
    }
  } else if (state.activeTrigger === 'mutagen_brace' || hasCombatBrace) {
    // KEY 4 (and Combat Mutagen Vial Brace: Frames 4 -> 5 -> 6 -> 7)
    const dur = hasCombatBrace
      ? Math.max(0.01, combatSync!.bristleDuration!)
      : Math.max(0.01, state.triggerDuration);
    const u = hasCombatBrace
      ? Math.max(0, Math.min(0.999, 1 - combatSync!.bristleTimer! / dur))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));
    const prevU = hasCombatBrace ? prevCombatBristleU : prevTriggerElapsed / dur;

    // Rising-edge Vial Shatter at u = 0.24
    if (prevU < 0.24 && u >= 0.24) {
      applyBruteSquash(state, 1.18, 0.84, 1.4, -1.2);
      vialShatterTriggered = true;
    }

    if (u < 0.24) {
      // Phase 1: Grab chest vials (Frame 4)
      const a = 0.5 - 0.5 * Math.cos((u / 0.24) * Math.PI);
      frameIndex = 4;
      rotationRad = -0.025 * a;
      deform.waist.dx = 2.5 * a;
      deform.waist.dy = 2.0 * a;
      deform.head.dx = 4.0 * a;
      vialGlowIntensity = 0.6 + a * 0.28;
      shellGlowIntensity = 0.34;
    } else if (u < 0.54) {
      // Phase 2: Crush emerald mutagen vials against chest (Frame 5)
      const f = (u - 0.24) / 0.3;
      const swell = Math.sin(f * Math.PI);
      frameIndex = 5;
      mutagenMistProgress = Math.min(1, f * 1.15);
      deform.waist.scaleX = 1 + swell * 0.085;
      deform.waist.dy = -swell * 3.0;
      deform.head.dy = -swell * 4.5;
      vialGlowIntensity = 1.0;
      shellGlowIntensity = 0.45 + f * 0.35;
      tintRgba = [0.9, 1.06, 0.9, 1.0];
    } else if (u < 0.80) {
      // Phase 3: Dorsal fiery shell eruption (Frame 6)
      const f = (u - 0.54) / 0.26;
      const flare = Math.sin(f * Math.PI);
      frameIndex = 6;
      mutagenMistProgress = Math.max(0.25, 1 - f * 0.65);
      deform.pelvis.dy = -1.5;
      deform.waist.scaleX = 1.06 + flare * 0.04;
      deform.waist.dy = -4.0 - flare * 2.0;
      deform.head.dy = -6.0 - flare * 2.5;
      deform.head.rotRad = -0.04 * flare;
      vialGlowIntensity = 0.86;
      shellGlowIntensity = 1.0;
      // Low-frequency carapace heat shimmer (freq <= 12 rad/s, small amp)
      const amp = 0.0022 * config.uvDistortStrength;
      uvDistortAmp = [amp, amp * 1.15];
      uvDistortFreq = 10.0;
      uvDistortPhase = elapsed * 5.2 + idx;
      tintRgba = [1.05, 0.98, 0.9, 1.0];
    } else {
      // Phase 4: Veined Crossed-Arm Guard settle (Frame 7)
      const r = (u - 0.8) / 0.2;
      const settle = 0.5 + 0.5 * Math.cos(r * Math.PI);
      frameIndex = 7;
      mutagenMistProgress = 0.25 * settle;
      deform.waist.scaleX = 1.05;
      deform.waist.dy = -2.2;
      deform.head.dy = -3.2;
      vialGlowIntensity = 0.9;
      shellGlowIntensity = 0.65;
    }
  } else if (state.activeTrigger === 'take_hit' || hasCombatHurt) {
    // KEY 5 (and Combat Hit Stagger: Frame 12 pain recoil -> Frame 13 knee stagger)
    const dur = hasCombatHurt
      ? Math.max(0.01, combatSync!.staggerDuration!)
      : Math.max(0.01, state.triggerDuration);
    const u = hasCombatHurt
      ? Math.max(0, Math.min(0.999, 1 - combatSync!.staggerTimer! / dur))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / dur));

    frameIndex = u < 0.46 ? 12 : 13;
    const whip = Math.sin(u * Math.PI) * Math.pow(1 - u, 1.15);
    targetPosX = whip * 24;

    deform.pelvis.dx = -whip * 4.5;
    deform.waist.dx = -whip * 12.0;
    deform.waist.dy = whip * 3.0;
    deform.waist.rotRad = -whip * 0.095;
    deform.waist.scaleX = 1 + whip * 0.06;
    deform.head.dx = -whip * 18.5;
    deform.head.dy = whip * 5.2;
    deform.head.rotRad = -whip * 0.14;
    rotationRad = whip * 0.055;
    vialGlowIntensity = 0.35;
    shellGlowIntensity = 0.3 * (1 - u * 0.5);
  } else if (combatSync?.staggerHover) {
    // Stagger hover preview warning (Frame 6 carapace flare)
    frameIndex = 6;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 8.5 + idx);
    shellGlowIntensity = 0.84 + 0.16 * pulse;
    vialGlowIntensity = 0.52 + 0.22 * pulse;
    deform.waist.scaleX = 1 + pulse * 0.035;
    deform.head.dy = -pulse * 2.5;
  } else if (combatSync?.heavyPrimed) {
    // Telegraphing next-turn Seismic Crush: Frame 8 coiled windup + dorsal heat shimmer
    frameIndex = 8;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.6 + idx);
    shellGlowIntensity = 0.68 + 0.28 * pulse;
    vialGlowIntensity = 0.48 + 0.16 * pulse;
    deform.pelvis.scaleX = 1 + pulse * 0.02;
    deform.waist.dy = -pulse * 2.2;
    deform.head.dy = -pulse * 3.0;
    deform.head.rotRad = -0.02 + pulse * 0.02;
    const amp = 0.0018 * config.uvDistortStrength;
    uvDistortAmp = [amp, amp];
    uvDistortFreq = 9.5;
    uvDistortPhase = elapsed * 4.2 + idx;
  } else if (combatSync?.armoredGuard) {
    // Active Armored Guard status: Frame 7 veined crossed-arm stance
    frameIndex = 7;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.8 + idx);
    vialGlowIntensity = 0.64 + 0.24 * pulse;
    shellGlowIntensity = 0.46 + 0.2 * pulse;
    deform.waist.scaleX = 1 + pulse * 0.025;
    deform.waist.dy = -pulse * 1.4;
    deform.head.dy = -pulse * 1.8;
  } else {
    // KEY 1 (and default Idle): Tight grounded frames 1 -> 2 -> 3 breathing & snarl
    state.snarlTimer -= safeDt;
    if (state.snarlTimer <= 0) {
      state.snarlHoldTimer = 0.24;
      state.snarlVariant = state.snarlVariant === 2 ? 3 : 2;
      state.snarlTimer = 2.1 + ((idx * 0.79) % 1.1);
    }
    if (state.snarlHoldTimer > 0) {
      state.snarlHoldTimer = Math.max(0, state.snarlHoldTimer - safeDt);
      frameIndex = state.snarlVariant;
    } else if (state.flipActive) {
      frameIndex = 0; // Wide stance during 2.5D flip
    } else {
      frameIndex = 1;
    }

    const breath = Math.sin(swayPhase);
    deform.pelvis.dx = breath * 0.4;
    deform.waist.dx = breath * 0.95;
    deform.waist.dy = -breath * 1.25;
    deform.waist.scaleX = 1 + breath * 0.02;
    deform.head.dx = breath * 1.45;
    deform.head.dy = -breath * 1.85;
    deform.head.rotRad = breath * 0.011;
    swayAmpPx = 0.4;
  }

  // Broken Stance (`staggered`) continuous dizzy upper-torso wobble layered cleanly above pinned feet
  if (combatSync?.staggeredStatus && !isDead) {
    const dizzy = Math.sin(elapsed * 4.8 + idx);
    frameIndex = 13;
    deform.waist.dx += dizzy * 3.2;
    deform.head.dx += dizzy * 6.0;
    deform.head.rotRad += dizzy * 0.042;
    vialGlowIntensity = 0.16;
    shellGlowIntensity = 0.1;
  }

  // Smooth horizontal position & compute velocity-driven skew/shear
  if (safeDt > 0) {
    const posLerp = Math.min(1, safeDt * 16);
    state.prevPosX = state.posX;
    state.posX += (targetPosX - state.posX) * posLerp;
    const rawVelX = (state.posX - state.prevPosX) / safeDt;
    state.velX += (rawVelX - state.velX) * Math.min(1, safeDt * 14);
  } else {
    state.posX = targetPosX;
  }

  const shearXPx = Math.max(
    -config.maxSkewPx,
    Math.min(config.maxSkewPx, state.velX * config.velocitySkewFactor),
  );

  // Layer 1: Smooth sub-frame cross-dissolve transition across frame swaps
  const blendDur =
    state.activeTrigger === 'seismic_smash' || hasCombatAttack || state.activeTrigger === 'take_hit'
      ? 0.045
      : state.activeTrigger === 'mutagen_brace' || hasCombatBrace
        ? 0.065
        : 0.085;
  state.transition = computeFrameTransitionState(state.transition, frameIndex, safeDt, blendDur);

  // Layer 4: Synced hit-flash uniform (amber-to-white chitin impact flash preserving ink contours)
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
    frameIndex,
    prevFrameIndex: state.transition.prevFrameIndex,
    frameBlendAlpha: isDead ? 1 : state.transition.frameBlendAlpha,
    springScaleX: state.springScaleX,
    springScaleY: state.springScaleY,
    rotationRad,
    offsetX: state.posX,
    hopYPx,
    shearXPx,
    facingScale: state.currentFacingScale,
    deform,
    swayAmpPx,
    swayFreq,
    swayPhase,
    uvDistortAmp,
    uvDistortFreq,
    uvDistortPhase,
    flashRgba,
    tintRgba,
    vialGlowIntensity,
    shellGlowIntensity,
    shockwaveIntensity,
    mutagenMistProgress,
    seismicImpactProgress,
    seismicImpactTriggered,
    vialShatterTriggered,
    chitinShardTriggered,
    footPlantTriggered,
  };
}
