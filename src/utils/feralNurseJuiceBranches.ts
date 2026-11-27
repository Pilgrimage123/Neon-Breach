import {
  type FeralNurseCombatSyncInput,
  type FeralNurseJuiceConfig,
  type FeralNurseJuiceState,
  type FeralNurseMeshDeform,
  applyFeralNurseSquash,
  clamp01,
  setFeralNurseFrame,
} from './feralNurseJuiceState';
import { sampleFeralNurseFrame } from './feralNurseSpriteSheet';

export interface FeralNurseBranchFrame {
  xShiftPx: number;
  hopYPx: number;
  rotationRad: number;
  alpha: number;
  deform: FeralNurseMeshDeform;
  tintRgba: [number, number, number, number];
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  headsetGlowIntensity: number;
  cloakIntensity: number;
  clawSlashProgress: number;
  pierceImpactIntensity: number;
  heelPlantTriggered: boolean;
  cloakTriggered: boolean;
  pierceImpactTriggered: boolean;
  ichorBurstTriggered: boolean;
  phaseLabel: string;
}

const PROWL_STRIDE_SEQ = [5, 6, 7, 8, 9] as const;

export function stepFeralNurseCombatSyncBranch(
  state: FeralNurseJuiceState,
  combatSync: FeralNurseCombatSyncInput,
  nowSec: number,
  deformScale: number,
  out: FeralNurseBranchFrame,
): void {
  const sample = sampleFeralNurseFrame(combatSync, nowSec, 0);
  const isCloakBlend = sample.mode === 'cloakCast' || sample.mode === 'opticalCloak';
  setFeralNurseFrame(state, sample.frameIndex, isCloakBlend ? 0.04 : 0);
  out.xShiftPx = sample.xShiftPx;
  out.hopYPx = sample.yHopPx;
  out.rotationRad = sample.tiltRad;
  out.alpha = sample.alpha;
  out.headsetGlowIntensity = sample.headsetGlowIntensity;
  out.cloakIntensity = sample.cloakIntensity;
  out.clawSlashProgress = sample.clawSlashProgress;
  out.pierceImpactIntensity = sample.pierceImpactIntensity;
  out.phaseLabel = `Combat · ${sample.mode}`;

  if (sample.mode === 'pierceStrike') {
    const dur = Math.max(0.28, combatSync.attackAnimDuration || 0.84);
    const p = clamp01(1 - combatSync.attackAnimTimer / dur);
    if (p < 0.26) {
      // Windup pull-back: negative local dx bends spine RIGHT (away from Hero) under facingSign = -1
      out.deform.chest = { dx: -5 * deformScale, dy: -2.6 * deformScale, rotRad: -0.075 * deformScale, scaleX: 0.97 };
      out.deform.head = { dx: -7 * deformScale, dy: -3.2 * deformScale, rotRad: -0.09 * deformScale, scaleX: 0.98 };
    } else if (p < 0.80) {
      if (p >= 0.44 && !state.impactFired) {
        state.impactFired = true;
        out.pierceImpactTriggered = true;
        applyFeralNurseSquash(state, 1.28, 0.75, 1.3, -1.4);
      }
      // Forward surgical lunge: positive local dx bends spine LEFT (toward Hero) under facingSign = -1
      out.deform.hips = { dx: 3.8 * deformScale, dy: 1.8 * deformScale, rotRad: 0.045 * deformScale, scaleX: 1.05 };
      out.deform.chest = { dx: 10.0 * deformScale, dy: 2.2 * deformScale, rotRad: 0.105 * deformScale, scaleX: 1.06 };
      out.deform.head = { dx: 12.0 * deformScale, dy: 1.4 * deformScale, rotRad: 0.105 * deformScale, scaleX: 1.03 };
    }
  } else if (sample.mode === 'cloakCast' || sample.mode === 'opticalCloak') {
    const ci = out.cloakIntensity;
    if (sample.mode === 'cloakCast' && !state.cloakPulseFired) {
      state.cloakPulseFired = true;
      out.cloakTriggered = true;
      applyFeralNurseSquash(state, 1.08, 0.92, 0.4, -0.5);
    }
    const wave = Math.sin(nowSec * 7.2);
    out.deform.hips = { dx: wave * 1.4 * deformScale, dy: 1.2 * ci * deformScale, rotRad: 0.02 * ci * deformScale, scaleX: 1.02 };
    out.deform.chest = { dx: (2.4 + wave * 2.2) * deformScale, dy: 1.8 * ci * deformScale, rotRad: (0.04 + wave * 0.025) * deformScale, scaleX: 1.02 };
    out.deform.head = { dx: (3.2 + wave * 2.6) * deformScale, dy: 1.4 * ci * deformScale, rotRad: (0.03 + wave * 0.03) * deformScale, scaleX: 1.01 };
    // Optical-camo cyan-magenta holographic tint & refraction wobble
    out.tintRgba = [0.74, 1.06, 1.24, 1];
    out.uvDistortAmp = [0.0068 * ci, 0.0034 * ci];
    out.uvDistortFreq = 16;
  } else if (sample.mode === 'pain') {
    if (!state.ichorBurstFired) {
      state.ichorBurstFired = true;
      out.ichorBurstTriggered = true;
    }
    const whip = Math.sin(clamp01(1 - combatSync.staggerTimer / Math.max(0.18, combatSync.staggerDuration || 0.44)) * Math.PI);
    // Pain whip recoil: negative local dx whips spine BACKWARD (right) away from Hero
    out.deform.hips = { dx: -whip * 3.5 * deformScale, dy: whip * 1.4 * deformScale, rotRad: -whip * 0.05 * deformScale, scaleX: 0.98 };
    out.deform.chest = { dx: -whip * 8.5 * deformScale, dy: whip * 2.2 * deformScale, rotRad: -whip * 0.11 * deformScale, scaleX: 0.96 };
    out.deform.head = { dx: -whip * 13.5 * deformScale, dy: whip * 1.2 * deformScale, rotRad: -whip * 0.16 * deformScale, scaleX: 0.96 };
    if (combatSync.cloaked) {
      out.tintRgba = [0.82, 1.04, 1.24, 1];
      out.uvDistortAmp = [0.008 * whip + 0.004, 0.004 * whip + 0.002];
      out.uvDistortFreq = 18;
    } else {
      out.tintRgba = [1.14, 0.86, 1.04, 1];
    }
  } else if (sample.mode === 'prepareCoil') {
    const pulse = Math.sin(nowSec * 7.4);
    out.deform.hips = { dx: 2.2 * deformScale, dy: 1.6 * deformScale, rotRad: 0.025 * deformScale, scaleX: 1.03 };
    out.deform.chest = { dx: (4.8 + pulse * 2.2) * deformScale, dy: 2.2 * deformScale, rotRad: (0.06 + pulse * 0.03) * deformScale, scaleX: 1.04 };
    out.deform.head = { dx: (6.2 + pulse * 2.8) * deformScale, dy: 1.6 * deformScale, rotRad: (0.055 + pulse * 0.035) * deformScale, scaleX: 1.02 };
    out.tintRgba = [1.08 + 0.05 * Math.abs(pulse), 0.94, 1.04, 1];
  } else if (sample.mode === 'staggered' || sample.mode === 'staggerHover') {
    const sway = Math.sin(nowSec * 4.6);
    out.deform.chest = { dx: sway * 4.5 * deformScale, dy: 2.2 * deformScale, rotRad: sway * 0.065 * deformScale, scaleX: 0.98 };
    out.deform.head = { dx: sway * 7.0 * deformScale, dy: 3.2 * deformScale, rotRad: sway * 0.095 * deformScale, scaleX: 0.97 };
  } else if (sample.mode === 'feralGuard' || sample.mode === 'guardHover') {
    const brace = Math.sin(nowSec * 4.2);
    out.deform.chest = { dx: 2.2 * deformScale, dy: 1.6 * deformScale, rotRad: 0.03 * deformScale, scaleX: 1.03 + brace * 0.015 };
    out.deform.head = { dx: 1.8 * deformScale, dy: 1.0 * deformScale, rotRad: 0.02 * deformScale, scaleX: 1.01 };
  } else if (!combatSync.dead) {
    const breath = Math.sin(nowSec * 2.6);
    const chestHeave = Math.sin(nowSec * 2.6 - 0.35);
    const headNod = Math.sin(nowSec * 2.6 - 0.68);
    out.deform.hips = { dx: breath * 0.55 * deformScale, dy: -breath * 0.65 * deformScale, rotRad: breath * 0.007 * deformScale, scaleX: 1 + breath * 0.008 };
    out.deform.chest = { dx: chestHeave * 1.45 * deformScale, dy: -chestHeave * 1.75 * deformScale, rotRad: chestHeave * 0.016 * deformScale, scaleX: 1 + chestHeave * 0.018 };
    out.deform.head = { dx: headNod * 1.95 * deformScale, dy: -headNod * 2.05 * deformScale, rotRad: headNod * 0.022 * deformScale, scaleX: 1 };
    state.impactFired = false;
    state.cloakPulseFired = false;
    state.ichorBurstFired = false;
  }
}

export function stepFeralNurseLabTriggerBranch(
  state: FeralNurseJuiceState,
  dt: number,
  config: FeralNurseJuiceConfig,
  deformScale: number,
  out: FeralNurseBranchFrame,
): void {
  const trigger = state.activeTrigger;

  // Key 2: Fluid 5-Frame Upright Feline Prowl Stride (5 Contact -> 6 Drive -> 7 Bound -> 8 Reach -> 9 Cushion Land)
  if (trigger === 'prowl_stalk') {
    const prevHalf = state.lastProwlCycleHalf;
    state.prowlPhase += dt * config.prowlFreqHz * Math.PI * 2;
    const cycleHalf = Math.floor(state.prowlPhase / Math.PI);
    const strideU = ((state.prowlPhase / (Math.PI * 2)) % 1 + 1) % 1;
    // Phase-locked airborne arc: strictly grounded on contact (5) & land (9), peaking smoothly on airborne bound (7)
    const boundArc =
      strideU > 0.22 && strideU < 0.78
        ? Math.sin(((strideU - 0.22) / 0.56) * Math.PI)
        : 0;
    const strideSway = Math.sin(state.prowlPhase);

    if (cycleHalf > prevHalf) {
      state.lastProwlCycleHalf = cycleHalf;
      out.heelPlantTriggered = true;
      const isPrimaryLand = cycleHalf % 2 === 0;
      applyFeralNurseSquash(
        state,
        isPrimaryLand ? 1.07 : 1.04,
        isPrimaryLand ? 0.93 : 0.96,
        isPrimaryLand ? 0.35 : 0.2,
        isPrimaryLand ? -0.35 : -0.2,
      );
    }

    const seqIdx = Math.min(
      PROWL_STRIDE_SEQ.length - 1,
      Math.floor(strideU * PROWL_STRIDE_SEQ.length),
    );
    setFeralNurseFrame(state, PROWL_STRIDE_SEQ[seqIdx], 0);

    // Smooth predatory stalk pacing sweep (4 full strides per gentle advance/recoil cycle)
    out.xShiftPx = -12 + Math.sin(state.prowlPhase * 0.25) * 24;
    out.hopYPx = -boundArc * 11;
    out.rotationRad = -0.022 - boundArc * 0.024 + strideSway * 0.014;
    out.headsetGlowIntensity = 0.72 + boundArc * 0.16;
    out.deform.hips = {
      dx: (1.4 + boundArc * 1.2) * deformScale,
      dy: (0.8 - boundArc * 1.4) * deformScale,
      rotRad: strideSway * 0.014 * deformScale,
      scaleX: 1.01,
    };
    out.deform.chest = {
      dx: (3.2 + boundArc * 2.2 + strideSway * 1.4) * deformScale,
      dy: -boundArc * 1.6 * deformScale,
      rotRad: (0.03 + strideSway * 0.018) * deformScale,
      scaleX: 1.025,
    };
    out.deform.head = {
      dx: (4.2 + boundArc * 2.6 + strideSway * 1.8) * deformScale,
      dy: -boundArc * 1.8 * deformScale,
      rotRad: (0.032 + strideSway * 0.022) * deformScale,
      scaleX: 1.01,
    };
    out.phaseLabel = 'Prowl Stalk · 5-Frame Feline Stride';
    return;
  }

  // Key 3: Move 1 — Optical Cloak (12 Tap -> 13 Vanish -> 14 Shimmer Hover -> 15 Snap Decloak)
  if (trigger === 'optical_cloak') {
    const p = clamp01(state.triggerElapsed / Math.max(0.4, state.triggerDuration));
    if (p < 0.18) {
      const t = p / 0.18;
      setFeralNurseFrame(state, 12, 0.04);
      if (!state.cloakPulseFired && t >= 0.35) {
        state.cloakPulseFired = true;
        out.cloakTriggered = true;
      }
      out.cloakIntensity = t * 0.55;
      out.alpha = 1 - t * 0.38;
      out.headsetGlowIntensity = 0.85 + 0.15 * t;
      out.tintRgba = [1 - t * 0.22, 1 + t * 0.06, 1 + t * 0.22, 1];
      out.uvDistortAmp = [0.005 * t, 0.0025 * t];
      out.uvDistortFreq = 15;
      out.phaseLabel = 'Optical Cloak · Beat 1 Headset Engage';
    } else if (p < 0.34) {
      const t = (p - 0.18) / 0.16;
      setFeralNurseFrame(state, 13, 0.04);
      out.cloakIntensity = 0.55 + t * 0.45;
      out.alpha = 0.62 - t * 0.36;
      out.xShiftPx = -5 * t;
      out.headsetGlowIntensity = 1.0;
      out.tintRgba = [0.74, 1.06, 1.24, 1];
      out.uvDistortAmp = [0.0075, 0.0038];
      out.uvDistortFreq = 17;
      out.phaseLabel = 'Optical Cloak · Beat 2 Phase Vanish';
    } else if (p < 0.82) {
      const t = (p - 0.34) / 0.48;
      const shimmerWave = Math.sin(t * Math.PI * 6);
      setFeralNurseFrame(state, t < 0.55 ? 14 : 13, 0.06);
      out.cloakIntensity = 0.94 + 0.06 * Math.abs(shimmerWave);
      out.alpha = 0.25 + 0.05 * shimmerWave;
      out.xShiftPx = -5 + shimmerWave * 2.2;
      out.headsetGlowIntensity = 0.96 + 0.04 * Math.abs(shimmerWave);
      out.tintRgba = [0.72, 1.08, 1.26, 1];
      out.uvDistortAmp = [0.0072, 0.0036];
      out.uvDistortFreq = 16;
      out.deform.chest = { dx: (2.5 + shimmerWave * 2.0) * deformScale, dy: 1.6 * deformScale, rotRad: 0.04 * deformScale, scaleX: 1.02 };
      out.deform.head = { dx: (3.2 + shimmerWave * 2.5) * deformScale, dy: 1.2 * deformScale, rotRad: 0.03 * deformScale, scaleX: 1.01 };
      out.phaseLabel = 'Optical Cloak · Beat 3 Camo Shimmer (10% DMG)';
    } else {
      const t = (p - 0.82) / 0.18;
      setFeralNurseFrame(state, 15, 0.035);
      out.cloakIntensity = Math.max(0, (1 - t) * 0.9);
      out.alpha = 0.28 + t * 0.72;
      out.xShiftPx = -5 * (1 - t);
      out.hopYPx = -Math.sin(t * Math.PI) * 8;
      out.headsetGlowIntensity = 0.92 - 0.22 * t;
      out.tintRgba = [0.74 + t * 0.26, 1.06 - t * 0.06, 1.24 - t * 0.24, 1];
      out.uvDistortAmp = [0.006 * (1 - t), 0.003 * (1 - t)];
      out.uvDistortFreq = 14;
      out.phaseLabel = 'Optical Cloak · Beat 4 Snap Decloak';
    }
    if (p >= 1) {
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
    }
    return;
  }

  // Key 4: Move 2 + 3 — Prepare Coil (16->17->18->19) -> 7-Pierce Surgical Lunge (20->21->22->23->24->25->26->27)
  if (trigger === 'pierce_strike') {
    const p = clamp01(state.triggerElapsed / Math.max(0.4, state.triggerDuration));
    if (p < 0.28) {
      // Prepare Coil build-up (pull back right: negative local dx under facingSign = -1)
      const t = p / 0.28;
      const coilFrame = t < 0.34 ? 16 : t < 0.68 ? 17 : 18;
      setFeralNurseFrame(state, coilFrame, 0);
      const quiver = Math.sin(t * Math.PI * 8) * 1.8;
      out.xShiftPx = 7 * t + quiver;
      out.rotationRad = 0.06 * t;
      out.headsetGlowIntensity = 0.86 + 0.14 * t;
      out.deform.chest = { dx: -4.5 * t * deformScale, dy: 2.0 * t * deformScale, rotRad: -0.05 * t * deformScale, scaleX: 1.03 };
      out.deform.head = { dx: -6.0 * t * deformScale, dy: 1.4 * t * deformScale, rotRad: -0.06 * t * deformScale, scaleX: 1.02 };
      out.tintRgba = [1.08, 0.94, 1.04, 1];
      out.phaseLabel = 'Prepare → 7 Pierce · Beat 1 Hunter Coil';
    } else if (p < 0.44) {
      const t = (p - 0.28) / 0.16;
      setFeralNurseFrame(state, t < 0.45 ? 19 : 20, 0);
      out.xShiftPx = 7 - 12 * t;
      out.hopYPx = -12 * t;
      out.rotationRad = 0.04 - 0.10 * t;
      out.headsetGlowIntensity = 1.0;
      out.deform.chest = { dx: 3.5 * t * deformScale, dy: -2.4 * deformScale, rotRad: 0.05 * t * deformScale, scaleX: 0.96 };
      out.deform.head = { dx: 5.0 * t * deformScale, dy: -3.0 * deformScale, rotRad: 0.06 * t * deformScale, scaleX: 0.98 };
      out.phaseLabel = 'Prepare → 7 Pierce · Beat 2 High Launch';
    } else if (p < 0.62) {
      const t = (p - 0.44) / 0.18;
      setFeralNurseFrame(state, t < 0.48 ? 21 : 22, 0);
      out.xShiftPx = -5 - 33 * t;
      out.hopYPx = -12 - Math.sin(t * Math.PI) * 24;
      out.rotationRad = -0.105;
      out.headsetGlowIntensity = 1.0;
      out.clawSlashProgress = t * 0.42;
      out.pierceImpactIntensity = t * 0.55;
      out.deform.hips = { dx: 4.8 * deformScale, dy: -1.4 * deformScale, rotRad: 0.05 * deformScale, scaleX: 1.05 };
      out.deform.chest = { dx: 10.5 * deformScale, dy: -2.0 * deformScale, rotRad: 0.11 * deformScale, scaleX: 1.07 };
      out.deform.head = { dx: 12.5 * deformScale, dy: -2.4 * deformScale, rotRad: 0.115 * deformScale, scaleX: 1.03 };
      out.phaseLabel = 'Prepare → 7 Pierce · Beat 3 Torpedo Spear Thrust';
    } else if (p < 0.80) {
      const t = (p - 0.62) / 0.18;
      setFeralNurseFrame(state, t < 0.52 ? 23 : 24, 0);
      if (!state.impactFired) {
        state.impactFired = true;
        out.pierceImpactTriggered = true;
        applyFeralNurseSquash(state, 1.30, 0.74, 1.4, -1.5);
      }
      out.xShiftPx = -38 + 16 * t;
      out.hopYPx = -6 * (1 - t);
      out.rotationRad = -0.075 * (1 - t * 0.5);
      out.headsetGlowIntensity = 1.0;
      out.clawSlashProgress = clamp01(0.42 + t * 0.58);
      out.pierceImpactIntensity = 0.6 + Math.sin(t * Math.PI) * 0.4;
      out.deform.hips = { dx: 3.4 * deformScale, dy: 2.2 * deformScale, rotRad: 0.04 * deformScale, scaleX: 1.05 };
      out.deform.chest = { dx: 9.8 * deformScale, dy: 2.6 * deformScale, rotRad: 0.105 * deformScale, scaleX: 1.06 };
      out.deform.head = { dx: 11.5 * deformScale, dy: 1.6 * deformScale, rotRad: 0.095 * deformScale, scaleX: 1.03 };
      out.phaseLabel = 'Prepare → 7 Pierce · Beat 4 Shield-Piercing X-Slash';
    } else {
      const t = (p - 0.80) / 0.20;
      const recFrame = t < 0.35 ? 25 : t < 0.70 ? 26 : 27;
      setFeralNurseFrame(state, recFrame, 0);
      out.xShiftPx = -22 * (1 - t);
      out.hopYPx = 0;
      out.rotationRad = 0;
      out.headsetGlowIntensity = 0.78 - 0.18 * t;
      out.phaseLabel = 'Prepare → 7 Pierce · Beat 5 Heel Brake & Reset';
    }
    if (p >= 1) {
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
    }
    return;
  }

  // Key 5: Take Hit (28 -> 29)
  if (trigger === 'take_hit') {
    const p = clamp01(state.triggerElapsed / Math.max(0.24, state.triggerDuration));
    if (!state.ichorBurstFired && p >= 0.04) {
      state.ichorBurstFired = true;
      out.ichorBurstTriggered = true;
    }
    setFeralNurseFrame(state, p < 0.56 ? 28 : 29, 0);
    const whip = Math.sin(p * Math.PI);
    out.xShiftPx = whip * 16;
    out.hopYPx = -whip * 6;
    out.rotationRad = whip * 0.12;
    out.headsetGlowIntensity = 0.28 + 0.5 * (1 - p);
    // Negative local dx whips spine BACKWARD (right) away from Hero under facingSign = -1
    out.deform.hips = { dx: -whip * 3.8 * deformScale, dy: whip * 1.5 * deformScale, rotRad: -whip * 0.055 * deformScale, scaleX: 0.98 };
    out.deform.chest = { dx: -whip * 9.0 * deformScale, dy: whip * 2.4 * deformScale, rotRad: -whip * 0.115 * deformScale, scaleX: 0.96 };
    out.deform.head = { dx: -whip * 14.0 * deformScale, dy: whip * 1.5 * deformScale, rotRad: -whip * 0.17 * deformScale, scaleX: 0.95 };
    out.tintRgba = [1.14, 0.86, 1.04, 1];
    out.phaseLabel = p < 0.56 ? 'Take Hit · Whip Recoil' : 'Take Hit · Stagger Recover';
    if (p >= 1) {
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
    }
    return;
  }

  // Key 6: 2.5D Flip
  if (trigger === 'turn_around') {
    const p = clamp01(state.triggerElapsed / Math.max(0.24, state.triggerDuration));
    const midHop = state.flipProgress >= 0 ? Math.sin(state.flipProgress * Math.PI) : 0;
    setFeralNurseFrame(state, midHop > 0.3 ? 7 : 10, 0);
    out.hopYPx = -midHop * 16;
    out.rotationRad = (midHop - 0.5) * 0.06;
    out.headsetGlowIntensity = 0.72;
    out.deform.chest = { dx: midHop * 3.5 * deformScale, dy: -midHop * 2.2 * deformScale, rotRad: midHop * 0.04 * deformScale, scaleX: 1.02 };
    out.deform.head = { dx: midHop * 4.5 * deformScale, dy: -midHop * 2.6 * deformScale, rotRad: midHop * 0.05 * deformScale, scaleX: 1.01 };
    out.phaseLabel = '2.5D Flip · Heel Pivot Turn';
    if (p >= 1 && state.flipProgress < 0) {
      state.activeTrigger = 'idle';
      state.triggerElapsed = 0;
    }
    return;
  }

  // Key 1: Smooth Grounded Breathing + Periodic Predatory Hiss Idle (1 <-> 2, occasional 3 hiss)
  const breathCycle = state.idleTime % 3.0;
  const breath = Math.sin(state.idleTime * 2.6);
  const chestHeave = Math.sin(state.idleTime * 2.6 - 0.35);
  const headNod = Math.sin(state.idleTime * 2.6 - 0.68);
  const isHissWindow = breathCycle >= 2.18 && breathCycle < 2.62;
  const idleFrame = isHissWindow ? 3 : breath >= 0.05 ? 2 : 1;
  setFeralNurseFrame(state, idleFrame, 0);
  const hissBoost = isHissWindow ? Math.sin(((breathCycle - 2.18) / 0.44) * Math.PI) : 0;
  out.xShiftPx = 0;
  out.hopYPx = 0;
  out.rotationRad = breath * 0.009 - hissBoost * 0.018;
  out.headsetGlowIntensity = 0.56 + 0.14 * Math.sin(state.idleTime * 3.4) + hissBoost * 0.26;
  out.deform.hips = {
    dx: breath * 0.55 * deformScale,
    dy: -breath * 0.65 * deformScale,
    rotRad: breath * 0.007 * deformScale,
    scaleX: 1 + breath * 0.008,
  };
  out.deform.chest = {
    dx: (chestHeave * 1.45 + hissBoost * 2.4) * deformScale,
    dy: -chestHeave * 1.75 * deformScale,
    rotRad: (chestHeave * 0.016 + hissBoost * 0.024) * deformScale,
    scaleX: 1 + chestHeave * 0.018 + hissBoost * 0.02,
  };
  out.deform.head = {
    dx: (headNod * 1.95 + hissBoost * 3.2) * deformScale,
    dy: (-headNod * 2.05 - hissBoost * 0.8) * deformScale,
    rotRad: (headNod * 0.022 + hissBoost * 0.03) * deformScale,
    scaleX: 1,
  };
  out.phaseLabel = isHissWindow ? 'Idle · Feral Hiss' : 'Idle · Grounded Breathing';
}
