/**
 * @file spitterJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Bile Spitter (`spitter`).
 *
 * Combines:
 *   Layer 1 — Simple Sprite Frame Layer (1–3 frames per state + periodic idle blink/jaw-snap,
 *             preserving procedural transforms & shaders across frame swaps).
 *   Layer 2 — Transform Math & Damped Spring Physics ("Juice" Layer):
 *             - 2nd-order Damped Harmonic Spring Squash & Stretch (`applySpitterSquash`)
 *             - Walk Waddle (`sin(time * speed) * maxAngle` + `abs(sin(time * speed)) * hopHeight`)
 *             - Velocity Skew / Shear (slants top of sprite in direction of velocity/recoil)
 *             - 2.5D Paper-Mario Horizontal Flip (`scaleX` smoothly interpolated between -1 and +1 with hop)
 *   Layer 3 — Lightweight 2D Mesh Deformation Layer (4 virtual anatomical control points:
 *             Feet h=0.0, Pelvis h=0.33, Waist h=0.67, Head h=1.0 on the 4x6 subdivided grid).
 *   Layer 4 — GPU Shader Layer (Ground-anchored vertex sway, toggleable wave/noise UV distortion
 *             for acid/bile charging, and synced hit-flash tint).
 */

import { computeFrameTransitionState, type FrameTransitionResult } from './spriteSheetAnim';

/**
 * The 6 canonical turn-based combat states exposed to the combat engine and keys 1–6 test harness.
 */
export type SpitterJuiceTrigger =
  | 'idle'            // Key 1: Subtle vertex-shader breathing + slow mesh sway + occasional blink frame
  | 'advance_retreat' // Key 2: Walk Waddle + slight forward/backward velocity skew
  | 'attack_lunge'    // Key 3: Backward mesh/skew anticipation -> squash -> forward dash -> impact stretch -> spring settle
  | 'cast_charge'     // Key 4: Vertical stretch + increasing UV distortion wobble + rapid vibration
  | 'take_hit'        // Key 5: Hurt frame + hit-flash + backward skew/mesh bend + squash impulse + spring recovery
  | 'turn_around';    // Key 6: Smooth 2.5D horizontal scale flip (-1 <-> +1) with vertical hop

/**
 * Tunable inspector/config parameters with production defaults for the Bile Spitter.
 */
export interface SpitterJuiceConfig {
  /** Hooke spring stiffness k (default: 260) */
  springStiffness: number;
  /** Viscous spring damping c (default: 17) */
  springDamping: number;
  /** Walk waddle angular frequency rad/s (default: 15) */
  waddleSpeed: number;
  /** Maximum waddle tilt angle in radians (default: 0.085) */
  waddleMaxAngleRad: number;
  /** Maximum waddle vertical hop height in unscaled sprite pixels (default: 11) */
  waddleHopHeightPx: number;
  /** Horizontal velocity-to-shear conversion factor (default: 0.048) */
  velocitySkewFactor: number;
  /** Maximum horizontal velocity shear in pixels (default: 22) */
  maxSkewPx: number;
  /** Base UV wave distortion strength multiplier for acid/cast effects (default: 1.0) */
  uvDistortStrength: number;
  /** Duration of a 2.5D Paper-Mario horizontal turn flip in seconds (default: 0.44) */
  flipDurationSec: number;
  /** Vertical hop height at the midpoint of a 2.5D turn flip in pixels (default: 14) */
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

export interface SpitterControlPointKnot {
  dx: number;
  dy: number;
  rotRad: number;
  scaleX: number;
}

export interface SpitterMeshDeform {
  feet: SpitterControlPointKnot;
  pelvis: SpitterControlPointKnot;
  waist: SpitterControlPointKnot;
  head: SpitterControlPointKnot;
}

/**
 * Persistent per-Spitter runtime physics & state-machine state.
 */
export interface SpitterJuiceState {
  // Layer 1: Frame & blink timers
  activeTrigger: SpitterJuiceTrigger;
  triggerElapsed: number;
  triggerDuration: number;
  blinkTimer: number;
  blinkHoldTimer: number;
  transition: FrameTransitionResult;

  // Layer 2A: Damped harmonic spring for (scaleX, scaleY) around (1, 1)
  springScaleX: number;
  springScaleY: number;
  springVelX: number;
  springVelY: number;

  // Layer 2B: Horizontal locomotion, velocity skew & walk waddle
  posX: number;
  velX: number;
  prevPosX: number;
  waddleTime: number;
  wasAirborne: boolean;

  // Layer 2C: 2.5D Paper-Mario horizontal flip state
  baseFacingSign: -1 | 1;
  currentFacingScale: number;
  flipActive: boolean;
  flipElapsed: number;
  flipStartSign: -1 | 1;
  flipTargetSign: -1 | 1;
  flipAutoReturn: boolean;

  // Layer 4: Hit-flash & cast charge accumulators
  hitFlashTimer: number;
  castChargeLevel: number;

  // Edge detectors for automatic combat cue impulses
  lastSeenAttackTimer: number;
  lastSeenStaggerTimer: number;
  lastSeenBristleTimer: number;
}

/**
 * Combined 4-layer output evaluated each frame for a Bile Spitter instance.
 */
export interface SpitterJuiceSample {
  activeTrigger: SpitterJuiceTrigger;
  /** Layer 1: Active sprite frame index (0..15) and cross-dissolve state */
  frameIndex: number;
  prevFrameIndex: number;
  frameBlendAlpha: number;
  /** Layer 2: Damped spring squash & stretch around (1, 1) */
  springScaleX: number;
  springScaleY: number;
  /** Layer 2: Walk waddle + kinetic tilt rotation in radians */
  rotationRad: number;
  /** Layer 2: Horizontal offset in world pixels (from lunge / advance / retreat / recoil) */
  offsetX: number;
  /** Layer 2: Vertical hop offset in unscaled sprite pixels (negative = upward) */
  hopYPx: number;
  /** Layer 2: Velocity-driven horizontal shear at the top of the sprite in pixels */
  shearXPx: number;
  /** Layer 2: Smooth 2.5D horizontal facing scale in [-1..+1] (-1 = facing left toward heroine) */
  facingScale: number;
  /** Layer 3: 4-control-point anatomical mesh deformation (Feet, Pelvis, Waist, Head) */
  deform: SpitterMeshDeform;
  /** Layer 4: GPU shader parameters */
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  flashRgba: [number, number, number, number] | null;
  tintRgba: [number, number, number, number];
  pustuleGlowIntensity: number;
  /** Normalized progress [0..1] of throat-bile condensation during spit windup */
  spitWindupProgress: number;
  /** Normalized progress [0..1] of the pressurized yellow bile stream flying to the heroine */
  spitStreamProgress: number;
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

/**
 * Injects an immediate squash-and-stretch impulse into the 2nd-order damped harmonic spring.
 * Example:
 *   - Landing / crouch anticipation: `applySpitterSquash(state, 1.22, 0.78)`
 *   - Lunge / acid spit release:     `applySpitterSquash(state, 1.26, 0.80)`
 *   - Taking hit / vertical recoil:  `applySpitterSquash(state, 0.78, 1.24)`
 */
export function applySpitterSquash(
  state: SpitterJuiceState,
  targetScaleX: number,
  targetScaleY: number,
  velImpulseX = 0,
  velImpulseY = 0,
): void {
  state.springScaleX = Math.max(0.55, Math.min(1.55, targetScaleX));
  state.springScaleY = Math.max(0.55, Math.min(1.55, targetScaleY));
  state.springVelX += velImpulseX;
  state.springVelY += velImpulseY;
}

/**
 * Triggers one of the 6 canonical turn-based combat states (keys 1–6 or combat engine cues).
 */
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
      // Anticipation crouch squash impulse
      applySpitterSquash(state, 1.16, 0.84, -1.4, 1.2);
      break;
    }
    case 'cast_charge': {
      state.triggerDuration = 1.25;
      state.castChargeLevel = 1;
      // Vertical stretch impulse as acid sacs pressurize
      applySpitterSquash(state, 0.88, 1.16, -0.6, 1.8);
      break;
    }
    case 'take_hit': {
      state.triggerDuration = 0.68;
      state.hitFlashTimer = 0.24;
      // Violent hit squash impulse + recoil velocity
      applySpitterSquash(state, 0.78, 1.24, -2.2, 2.5);
      state.velX = 200;
      break;
    }
    case 'turn_around': {
      state.triggerDuration = Math.max(0.25, config.flipDurationSec * 2.1);
      state.flipActive = true;
      state.flipElapsed = 0;
      state.flipStartSign = state.baseFacingSign;
      state.flipTargetSign = (state.baseFacingSign === -1 ? 1 : -1) as -1 | 1;
      state.flipAutoReturn = true;
      applySpitterSquash(state, 0.9, 1.12);
      break;
    }
  }
}

/**
 * Steps the 4-layer procedural animation & spring physics state by `dt` seconds.
 * Pure, deterministic, zero heap allocations on hot path.
 */
export function stepSpitterJuice(
  state: SpitterJuiceState,
  dt: number,
  elapsed: number,
  config: SpitterJuiceConfig = DEFAULT_SPITTER_JUICE_CONFIG,
  combatSync?: {
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
  },
): SpitterJuiceSample {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const idx = combatSync?.instanceIndex ?? 0;

  // Synchronize automatic combat engine triggers when a real combat cue starts
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

  // Advance active showcase trigger timer
  const prevTriggerElapsed = state.triggerElapsed;
  if (state.activeTrigger !== 'idle' && state.triggerDuration > 0) {
    state.triggerElapsed += safeDt;
    if (state.triggerElapsed >= state.triggerDuration) {
      // Landing settle squash when finishing an advance/lunge
      if (state.activeTrigger === 'advance_retreat' || state.activeTrigger === 'attack_lunge') {
        applySpitterSquash(state, 1.08, 0.92);
      }
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
      state.triggerDuration = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // LAYER 2A: Damped Harmonic Spring Squash & Stretch
  //   d²x/dt² = -k * (x - 1) - c * dx/dt
  // ---------------------------------------------------------------------------
  if (safeDt > 0) {
    const k = config.springStiffness;
    const c = config.springDamping;
    // Sub-step twice for unconditionally stable symplectic Euler integration at high k
    const subDt = safeDt * 0.5;
    for (let step = 0; step < 2; step++) {
      const accX = -k * (state.springScaleX - 1) - c * state.springVelX;
      const accY = -k * (state.springScaleY - 1) - c * state.springVelY;
      state.springVelX += accX * subDt;
      state.springVelY += accY * subDt;
      state.springScaleX += state.springVelX * subDt;
      state.springScaleY += state.springVelY * subDt;
    }
    state.springScaleX = Math.max(0.6, Math.min(1.48, state.springScaleX));
    state.springScaleY = Math.max(0.6, Math.min(1.48, state.springScaleY));
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
    const flipDur = Math.max(0.15, config.flipDurationSec);
    const u = Math.min(1, state.flipElapsed / flipDur);
    // Cosine interpolation gives smooth 3D card-rotation foreshortening
    const cosInterp = 0.5 - 0.5 * Math.cos(u * Math.PI);
    state.currentFacingScale =
      state.flipStartSign + (state.flipTargetSign - state.flipStartSign) * cosInterp;
    // Prevent exact zero degenerate matrix determinant
    if (Math.abs(state.currentFacingScale) < 0.04) {
      state.currentFacingScale = state.currentFacingScale >= 0 ? 0.04 : -0.04;
    }
    flipHopYPx = -Math.sin(u * Math.PI) * config.flipHopHeightPx;

    if (u >= 1) {
      state.baseFacingSign = state.flipTargetSign;
      state.currentFacingScale = state.flipTargetSign;
      if (state.flipAutoReturn && state.flipTargetSign !== -1) {
        // Brief pause facing away, then flip back to combat stance (-1)
        state.flipElapsed = -0.14;
        state.flipStartSign = state.flipTargetSign;
        state.flipTargetSign = -1;
        state.flipAutoReturn = false;
        applySpitterSquash(state, 1.08, 0.93);
      } else {
        state.flipActive = false;
        applySpitterSquash(state, 1.09, 0.92);
      }
    }
  } else {
    state.currentFacingScale = state.baseFacingSign;
  }

  // ---------------------------------------------------------------------------
  // LAYER 1, 2B, 3 & 4: State-Driven Frame Selection, Waddle, Skew, Mesh & Shaders
  // ---------------------------------------------------------------------------
  let frameIndex = 0;
  let targetPosX = 0;
  let hopYPx = flipHopYPx;
  let rotationRad = 0;
  let pustuleGlowIntensity = 0.28 + 0.12 * Math.sin(elapsed * 2.6 + idx);
  let spitWindupProgress = 0;
  let spitStreamProgress = 0;

  const deform: SpitterMeshDeform = {
    feet: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    pelvis: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    waist: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    head: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
  };

  // Keep vertex shader sway subtle in idle and 0 during active states so it never double-waves with spline deform
  let swayAmpPx = 0;
  const swayFreq = 2.2;
  const swayPhase = elapsed * 2.2 + idx * 1.4;
  let uvDistortAmp: [number, number] = [0, 0];
  let uvDistortFreq = 14.0;
  let uvDistortPhase = elapsed * 5.5 + idx;
  let tintRgba: [number, number, number, number] = [1, 1, 1, 1];

  const isDead = Boolean(combatSync?.dead);
  const hasCombatAttack = (combatSync?.attackAnimTimer ?? 0) > 0 && (combatSync?.attackAnimDuration ?? 0) > 0;
  const hasCombatHurt = (combatSync?.staggerTimer ?? 0) > 0 && (combatSync?.staggerDuration ?? 0) > 0;
  const hasCombatRupture = (combatSync?.bristleTimer ?? 0) > 0 && (combatSync?.bristleDuration ?? 0) > 0;

  if (isDead) {
    const p = Math.max(0, Math.min(1, combatSync?.koProgress ?? 0));
    const collapseNorm = Math.min(1, p / 0.8);
    const step = Math.min(3, Math.floor(collapseNorm * 4));
    frameIndex = 12 + step;
    pustuleGlowIntensity = Math.max(0, 0.55 * (1 - p * 1.2));
  } else if (state.activeTrigger === 'advance_retreat') {
    // KEY 2: Walk Waddle + Forward/Backward Velocity Skew
    const u = state.triggerElapsed / Math.max(0.01, state.triggerDuration);
    const advanceCurve = Math.sin(u * Math.PI);
    targetPosX = -advanceCurve * 84;
    const isAdvancing = u < 0.5;
    frameIndex = isAdvancing ? 2 : 1; // Frame 2 = forward claw stalk, Frame 1 = alert retreat

    state.waddleTime += safeDt * config.waddleSpeed;
    const waddleSin = Math.sin(state.waddleTime);
    rotationRad += waddleSin * config.waddleMaxAngleRad;
    hopYPx -= Math.abs(waddleSin) * config.waddleHopHeightPx;

    const leanDir = isAdvancing ? 1 : -0.65;
    deform.pelvis.dx = leanDir * 2.2;
    deform.waist.dx = leanDir * 5.0;
    deform.waist.dy = -Math.abs(waddleSin) * 1.8;
    deform.head.dx = leanDir * 8.2;
    deform.head.rotRad = waddleSin * 0.04;
    pustuleGlowIntensity = 0.52 + 0.18 * Math.abs(waddleSin);
  } else if (state.activeTrigger === 'attack_lunge' || hasCombatAttack) {
    // KEY 3: Attack Lunge / Pressurized Yellow Bile Spit (or Claw Rend when spitterAttackKind === 'claw')
    const isClaw = hasCombatAttack && combatSync?.spitterAttackKind === 'claw';
    const u = hasCombatAttack
      ? Math.max(0, Math.min(0.999, 1 - (combatSync!.attackAnimTimer! / combatSync!.attackAnimDuration!)))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / Math.max(0.01, state.triggerDuration)));
    const prevU = hasCombatAttack
      ? u - safeDt / Math.max(0.01, combatSync!.attackAnimDuration!)
      : prevTriggerElapsed / Math.max(0.01, state.triggerDuration);

    // Trigger release stretch impulse right as the strike/spit crosses u = 0.22
    if (prevU < 0.22 && u >= 0.22) {
      applySpitterSquash(state, 1.22, 0.82, 1.8, -1.4);
      state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.1);
    }

    if (isClaw) {
      // Caustic Claw Rend (Frames 8 -> 9 -> 11)
      if (u < 0.26) {
        const a = Math.sin((u / 0.26) * (Math.PI * 0.5));
        frameIndex = 8;
        targetPosX = a * 20;
        hopYPx -= a * 4;
        deform.waist.dx = -a * 6.0;
        deform.head.dx = -a * 10.0;
        rotationRad = a * 0.05;
        pustuleGlowIntensity = 0.65 + a * 0.2;
      } else if (u < 0.72) {
        const s = (u - 0.26) / 0.46;
        frameIndex = 9;
        targetPosX = -Math.sin(s * (Math.PI * 0.5)) * 74;
        hopYPx -= Math.sin(s * Math.PI) * 9;
        deform.pelvis.dx = 4.0;
        deform.waist.dx = 9.5;
        deform.head.dx = 15.0;
        rotationRad = -0.065;
        pustuleGlowIntensity = 0.88;
      } else {
        const r = (u - 0.72) / 0.28;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        frameIndex = 11;
        targetPosX = -74 * ease;
        deform.waist.dx = 5.0 * ease;
        deform.head.dx = 8.0 * ease;
        pustuleGlowIntensity = 0.52;
      }
    } else {
      // Pressurized Yellow Bile Torrent (Frames 4 -> 5 -> 6 -> 7)
      if (u < 0.22) {
        // Phase 1: Throat-cyst inhale windup & bile condensation inside jaws
        const a = Math.sin((u / 0.22) * (Math.PI * 0.5));
        frameIndex = 4;
        targetPosX = a * 20;
        spitWindupProgress = a;
        deform.pelvis.dx = -a * 3.0;
        deform.waist.dx = -a * 7.5;
        deform.waist.dy = a * 2.2;
        deform.waist.scaleX = 1 + a * 0.11; // Yellow throat sac inflates
        deform.head.dx = -a * 12.0;
        deform.head.dy = -a * 3.0;
        deform.head.rotRad = -a * 0.09;
        rotationRad = a * 0.045;
        pustuleGlowIntensity = 0.58 + a * 0.36;
      } else if (u < 0.52) {
        // Phase 2: Explosive forward head-snap & initial pressurized bile jet ejection
        const s = (u - 0.22) / 0.30;
        const thrust = Math.sin(s * (Math.PI * 0.5));
        frameIndex = 5;
        targetPosX = 20 * (1 - thrust) - thrust * 46;
        hopYPx -= Math.sin(s * Math.PI) * 5;
        spitStreamProgress = (u - 0.22) / 0.62;
        deform.pelvis.dx = 3.5 * thrust;
        deform.waist.dx = 8.5 * thrust;
        deform.waist.scaleX = 1.07 - 0.06 * s;
        deform.head.dx = 14.5 * thrust;
        deform.head.dy = 2.0 * thrust;
        deform.head.rotRad = 0.08 * thrust;
        rotationRad = -0.05 * thrust;
        pustuleGlowIntensity = 0.96;
      } else if (u < 0.84) {
        // Phase 3: Sustained pressurized bile stream hitting heroine & sac compression
        const f = (u - 0.52) / 0.32;
        frameIndex = 6;
        targetPosX = -46 * (1 - f * 0.35);
        spitStreamProgress = Math.min(1, (u - 0.22) / 0.62);
        deform.pelvis.dx = 2.8 * (1 - f * 0.3);
        deform.waist.dx = 7.0 * (1 - f * 0.3);
        deform.waist.scaleX = 0.95 + 0.05 * f; // Throat sac compresses as bile finishes ejecting
        deform.head.dx = 12.0 * (1 - f * 0.3);
        deform.head.rotRad = 0.06 * (1 - f * 0.4);
        rotationRad = -0.035 * (1 - f * 0.5);
        pustuleGlowIntensity = 0.92 - f * 0.22;
      } else {
        // Phase 4: Smooth recovery & snout wipe
        const r = (u - 0.84) / 0.16;
        const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
        frameIndex = 7;
        targetPosX = -30 * ease;
        deform.waist.dx = 4.5 * ease;
        deform.head.dx = 7.5 * ease;
        pustuleGlowIntensity = 0.48;
      }
    }
  } else if (state.activeTrigger === 'cast_charge' || combatSync?.blightPrimed || hasCombatRupture) {
    // KEY 4: Cast / Charge — Hold Frame 4 (swollen yellow throat cyst, planted feet) so floor puddle never blinks!
    const chargeProgress =
      state.activeTrigger === 'cast_charge'
        ? Math.min(1, state.triggerElapsed / Math.max(0.2, state.triggerDuration * 0.65))
        : hasCombatRupture
          ? 1.0
          : 0.55;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2 + idx);
    const organicTremor = Math.sin(elapsed * 16 + idx) * chargeProgress * 0.45;

    frameIndex = hasCombatRupture ? 10 : 4;
    pustuleGlowIntensity = 0.74 + 0.24 * pulse;
    spitWindupProgress = state.activeTrigger === 'cast_charge' ? chargeProgress * 0.85 : pulse * 0.45;

    // Smooth vertical elongation + peristaltic throat/pustule sac expansion without high-frequency jelly wobble
    deform.pelvis.dx = organicTremor * 0.6;
    deform.pelvis.dy = -chargeProgress * 1.8;
    deform.waist.dx = organicTremor * 1.2;
    deform.waist.dy = -chargeProgress * 5.2 - pulse * 1.6;
    deform.waist.scaleX = 1 + chargeProgress * 0.11 + pulse * 0.04;
    deform.head.dx = organicTremor * 1.8;
    deform.head.dy = -chargeProgress * 8.2 - pulse * 2.2;
    deform.head.rotRad = organicTremor * 0.015 - chargeProgress * 0.04;

    if (state.activeTrigger === 'cast_charge' || hasCombatRupture) {
      const amp = (0.0035 + 0.0045 * chargeProgress) * config.uvDistortStrength;
      uvDistortAmp = [amp, amp * 1.1];
      uvDistortFreq = 14 + chargeProgress * 6;
      uvDistortPhase = elapsed * 6.5 + idx;
    }
    tintRgba = [0.95 + 0.05 * pulse, 1.0, 0.86 + 0.14 * pulse, 1.0];
  } else if (state.activeTrigger === 'take_hit' || hasCombatHurt) {
    // KEY 5: Take Hit / Recoil (Hurt frame + hit-flash + backward skew/mesh bend + squash + spring recovery)
    const u = hasCombatHurt
      ? Math.max(0, Math.min(0.999, 1 - (combatSync!.staggerTimer! / combatSync!.staggerDuration!)))
      : Math.max(0, Math.min(0.999, state.triggerElapsed / Math.max(0.01, state.triggerDuration)));

    frameIndex = u < 0.48 ? 12 : 13; // 12 = bursting pustule impact recoil, 13 = hunched stagger
    const whip = Math.sin(u * Math.PI) * Math.pow(1 - u, 1.15);
    targetPosX = whip * 30; // Knocked backward to the right

    deform.pelvis.dx = -whip * 5.0;
    deform.waist.dx = -whip * 13.0;
    deform.waist.dy = whip * 3.5;
    deform.waist.rotRad = -whip * 0.11;
    deform.waist.scaleX = 1 + whip * 0.07;
    deform.head.dx = -whip * 20.0;
    deform.head.dy = whip * 6.0;
    deform.head.rotRad = -whip * 0.16;
    rotationRad = whip * 0.065;
    pustuleGlowIntensity = 0.85 * (1 - u * 0.4);
  } else if (combatSync?.pustuleHover || combatSync?.armoredGuard) {
    // Defensive pustule flare / chitin guard
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.0 + idx);
    frameIndex = combatSync.pustuleHover ? 10 : 11;
    pustuleGlowIntensity = (combatSync.pustuleHover ? 0.86 : 0.58) + 0.14 * pulse;
    deform.waist.scaleX = 1 + pulse * 0.03;
    deform.waist.dy = -pulse * 1.4;
    deform.head.dy = -pulse * 2.0;
  } else {
    // KEY 1 (and default): Grounded organic breathing + occasional jaw-snap blink (Frame 0 -> Frame 1)
    state.blinkTimer -= safeDt;
    if (state.blinkTimer <= 0) {
      state.blinkHoldTimer = 0.2;
      state.blinkTimer = 2.4 + ((idx * 0.73) % 1.1);
    }
    if (state.blinkHoldTimer > 0) {
      state.blinkHoldTimer = Math.max(0, state.blinkHoldTimer - safeDt);
      frameIndex = 1; // Jaw-snap / blink frame (matches Frame 0 silhouette closely)
    } else if (state.flipActive) {
      frameIndex = 2; // Stalk pose during 2.5D turn-around
    } else {
      frameIndex = 0; // Neutral dripping idle
    }

    const breath = Math.sin(swayPhase);
    deform.pelvis.dx = breath * 0.45;
    deform.waist.dx = breath * 1.05;
    deform.waist.dy = -breath * 1.15;
    deform.waist.scaleX = 1 + breath * 0.018;
    deform.head.dx = breath * 1.65;
    deform.head.dy = -breath * 1.75;
    deform.head.rotRad = breath * 0.012;
    swayAmpPx = 0.45;
  }

  // Broken Stance (`staggered`) continuous dizzy wobble layered cleanly on top
  if (combatSync?.staggeredStatus && !isDead) {
    const dizzy = Math.sin(elapsed * 5.2 + idx);
    deform.waist.dx += dizzy * 3.5;
    deform.head.dx += dizzy * 6.5;
    deform.head.rotRad += dizzy * 0.045;
  }

  // Smooth horizontal position & compute velocity-driven skew/shear
  if (safeDt > 0) {
    const posLerp = Math.min(1, safeDt * 18);
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
    state.activeTrigger === 'attack_lunge' || hasCombatAttack || state.activeTrigger === 'take_hit'
      ? 0.05
      : 0.07;
  state.transition = computeFrameTransitionState(state.transition, frameIndex, safeDt, blendDur);

  // Layer 4: Hit-flash uniform (solid white-to-chartreuse tint synced with impact)
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
    pustuleGlowIntensity,
    spitWindupProgress,
    spitStreamProgress,
  };
}
