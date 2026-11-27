import type { HeroAnimMode } from './heroAnimator';
import type { ActorJuiceSnapshot } from '../components/combat/SpriteJuiceFeedbackHandler';
import type { SequencerFrameState } from '../components/combat/CombatActionSequencer';
import {
  type AuralineJuiceState,
  applyAuralineSquash,
  setAuralineFrame,
} from './auralineJuiceState';
import { type JuiceMeshDeform, createNeutralMeshDeform } from './proceduralJuiceCore';
import { type SequenceKeyframe, sampleSequence } from './spriteSheetAnim';

export interface AuralineBranchFrame {
  xProgress: number;
  hopYPx: number;
  rotationRad: number;
  deform: JuiceMeshDeform;
  tintRgba: [number, number, number, number];
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  shouldEmitShot: boolean;
  shouldEmitKickImpact: boolean;
  isDashing: boolean;
  isSurgeBlast: boolean;
  surgeBlastIntensity: number;
  broadsideIntensity: number;
  aegisCounterIntensity: number;
  reactorCoreIntensity: number;
}

const IDLE_BREATH_FRAMES = [0, 1, 2, 3] as const;

const SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 6, until: 0.14, xProgress: 0 },
  { frameIndex: 7, until: 0.34, xProgress: 0 },
  { frameIndex: 8, until: 0.48, xProgress: 0 },
  { frameIndex: 0, until: 0.52, xProgress: 0 },
];

const ARTILLERY_SURGE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.14, xProgress: 0 },
  { frameIndex: 10, until: 0.28, xProgress: 0 },
  { frameIndex: 11, until: 0.58, xProgress: 0 },
  { frameIndex: 12, until: 0.72, xProgress: 0 },
  { frameIndex: 0, until: 0.76, xProgress: 0 },
];

const SOVEREIGN_BROADSIDE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 20, until: 0.22, xProgress: 0, yHopPx: 0 },
  { frameIndex: 21, until: 0.60, xProgress: 0, yHopPx: 0 },
  { frameIndex: 22, until: 0.80, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.88, xProgress: 0, yHopPx: 0 },
];

const AEGIS_COUNTER_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.20, xProgress: 0, yHopPx: 0 },
  { frameIndex: 17, until: 0.44, xProgress: 0, yHopPx: 0 },
  { frameIndex: 18, until: 0.62, xProgress: 0, yHopPx: 0 },
  { frameIndex: 19, until: 0.74, xProgress: 0, yHopPx: 0 },
  { frameIndex: 0, until: 0.78, xProgress: 0, yHopPx: 0 },
];

export function resolveAuralineCutInFrameIndex(
  cutIn: ActorJuiceSnapshot,
  seqPhase: SequencerFrameState['phase'] | undefined,
  heroMode: HeroAnimMode | string | undefined,
  fallbackIndex: number,
): number {
  if (heroMode === 'dodge') return fallbackIndex;
  if (!cutIn.active || cutIn.poseOverride === 'none') return fallbackIndex;
  const isWindup = seqPhase === 'windup' || seqPhase === 'travel';
  if (cutIn.poseOverride === 'attack_pose') {
    if (heroMode === 'overdrive') return isWindup ? 20 : 21;
    if (heroMode === 'dash_kick') return isWindup ? 10 : 11;
    return isWindup ? 6 : 7;
  }
  if (cutIn.poseOverride === 'brace_pose') return 13;
  if (cutIn.poseOverride === 'recoil_pose') return 14;
  return fallbackIndex;
}

export function stepAuralineBranch(
  state: AuralineJuiceState,
  hoveredColor: string | null,
  totalTime: number,
  deformScale: number,
  reducedMotion: boolean,
): AuralineBranchFrame {
  const out: AuralineBranchFrame = {
    xProgress: 0,
    hopYPx: 0,
    rotationRad: 0,
    deform: createNeutralMeshDeform(),
    tintRgba: [1, 1, 1, 1],
    uvDistortAmp: [0, 0],
    uvDistortFreq: 10,
    shouldEmitShot: false,
    shouldEmitKickImpact: false,
    isDashing: false,
    isSurgeBlast: false,
    surgeBlastIntensity: 0,
    broadsideIntensity: 0,
    aegisCounterIntensity: 0,
    reactorCoreIntensity: 0,
  };

  if (state.mode === 'idle') {
    let frameIndex = 0;
    if (hoveredColor === 'attack') {
      frameIndex = 6;
    } else if (hoveredColor === 'defense') {
      frameIndex = 13;
    } else if (hoveredColor === 'tech') {
      frameIndex = 27;
    } else if (!reducedMotion) {
      const cycle = totalTime % 10;
      if (cycle >= 2.2 && cycle < 3.6) {
        frameIndex = cycle < 2.9 ? 23 : 24;
      } else if (cycle >= 7.0 && cycle < 8.5) {
        frameIndex = cycle < 7.75 ? 25 : 26;
      } else {
        frameIndex =
          IDLE_BREATH_FRAMES[Math.floor(totalTime / 0.36) % IDLE_BREATH_FRAMES.length];
      }
    }
    setAuralineFrame(state, frameIndex);

    if (!reducedMotion) {
      const breath = Math.sin(totalTime * 2.2);
      const sway = Math.sin(totalTime * 1.4);
      out.deform.pelvis = {
        dx: 0,
        dy: breath * 0.4 * deformScale,
        rotRad: 0,
        scaleX: 1 - breath * 0.004,
      };
      out.deform.waist = {
        dx: sway * 0.6 * deformScale,
        dy: breath * 0.8 * deformScale,
        rotRad: sway * 0.009 * deformScale,
        scaleX: 1 + breath * 0.007,
      };
      out.deform.head = {
        dx: sway * 0.8 * deformScale,
        dy: breath * 1.1 * deformScale,
        rotRad: sway * 0.012 * deformScale,
        scaleX: 1,
      };
    }
    return out;
  }

  const t = Math.min(state.elapsed, state.duration);

  if (state.mode === 'shoot') {
    const s = sampleSequence(SHOOT_SEQ, t);
    setAuralineFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    if (s.frameIndex === 7 && state.emittedShots < 1) {
      state.emittedShots = 1;
      out.shouldEmitShot = true;
      applyAuralineSquash(state, 1.12, 0.89, -0.8, 0.7);
    }
    if (s.frameIndex === 6) {
      out.deform.waist = {
        dx: 2.0 * deformScale,
        dy: 0.4 * deformScale,
        rotRad: 0.025 * deformScale,
        scaleX: 1.01,
      };
      out.deform.head = {
        dx: 2.4 * deformScale,
        dy: 0.5 * deformScale,
        rotRad: 0.03 * deformScale,
        scaleX: 1,
      };
    } else if (s.frameIndex === 7) {
      out.deform.pelvis = {
        dx: -1.4 * deformScale,
        dy: 0.6 * deformScale,
        rotRad: -0.02 * deformScale,
        scaleX: 1.02,
      };
      out.deform.waist = {
        dx: -4.2 * deformScale,
        dy: 0.9 * deformScale,
        rotRad: -0.05 * deformScale,
        scaleX: 1.03,
      };
      out.deform.head = {
        dx: -5.4 * deformScale,
        dy: 1.1 * deformScale,
        rotRad: -0.065 * deformScale,
        scaleX: 1,
      };
    }
  } else if (state.mode === 'dash_kick') {
    // 100% Planted Artillery Surge Blast with User's Signature Wide-Legged Recoil Pose (F11) & Cyber-Ring Beam
    const s = sampleSequence(ARTILLERY_SURGE_SEQ, t);
    setAuralineFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.isSurgeBlast = true;
    if (s.frameIndex === 9 || s.frameIndex === 10) {
      out.surgeBlastIntensity = s.frameIndex === 9 ? 0.35 : 0.62;
      out.deform.waist = {
        dx: 2.4 * deformScale,
        dy: 1.0 * deformScale,
        rotRad: 0.035 * deformScale,
        scaleX: 1.03,
      };
      out.deform.head = {
        dx: 3.1 * deformScale,
        dy: 1.2 * deformScale,
        rotRad: 0.045 * deformScale,
        scaleX: 1,
      };
      out.tintRgba = [0.94, 1.12, 1.22, 1];
    } else if (s.frameIndex === 11) {
      out.surgeBlastIntensity = 1.0;
      if (!state.surgeBlastFired) {
        state.surgeBlastFired = true;
        state.emittedShots = 1;
        out.shouldEmitShot = true;
        applyAuralineSquash(state, 1.22, 0.81, -1.4, 1.2);
      }
      // Heavy planted artillery recoil arch on 4-knot spine while boots stay pinned at [0, 0]
      out.deform.pelvis = {
        dx: -2.2 * deformScale,
        dy: 1.1 * deformScale,
        rotRad: -0.035 * deformScale,
        scaleX: 1.04,
      };
      out.deform.waist = {
        dx: -5.8 * deformScale,
        dy: 1.6 * deformScale,
        rotRad: -0.085 * deformScale,
        scaleX: 1.06,
      };
      out.deform.head = {
        dx: -7.8 * deformScale,
        dy: 2.0 * deformScale,
        rotRad: -0.11 * deformScale,
        scaleX: 1.02,
      };
      out.tintRgba = [0.96, 1.18, 1.28, 1];
      if (!reducedMotion) {
        out.uvDistortAmp = [0.004, 0.002];
        out.uvDistortFreq = 20;
      }
    } else if (s.frameIndex === 12) {
      out.surgeBlastIntensity = 0.38;
      out.deform.waist = {
        dx: -2.2 * deformScale,
        dy: 0.6 * deformScale,
        rotRad: -0.03 * deformScale,
        scaleX: 1.02,
      };
      out.deform.head = {
        dx: -2.8 * deformScale,
        dy: 0.8 * deformScale,
        rotRad: -0.04 * deformScale,
        scaleX: 1,
      };
    }
  } else if (state.mode === 'overdrive') {
    // 100% Planted Sovereign Broadside Artillery Salvo (F20..F22)
    const s = sampleSequence(SOVEREIGN_BROADSIDE_SEQ, t);
    setAuralineFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.hopYPx = 0;
    out.isDashing = false;
    if (s.frameIndex === 20) {
      out.broadsideIntensity = 0.6;
      out.reactorCoreIntensity = 0.75;
      out.deform.waist = {
        dx: 1.2 * deformScale,
        dy: -1.6 * deformScale,
        rotRad: 0.02 * deformScale,
        scaleX: 1.04,
      };
      out.deform.head = {
        dx: 1.4 * deformScale,
        dy: -2.2 * deformScale,
        rotRad: 0.025 * deformScale,
        scaleX: 1.01,
      };
      out.tintRgba = [1.22, 1.14, 0.92, 1];
    } else if (s.frameIndex === 21) {
      out.broadsideIntensity = 1.0;
      out.reactorCoreIntensity = 0.9;
      if (state.emittedShots < 1) {
        state.emittedShots = 1;
        state.emittedKickImpact = true;
        out.shouldEmitShot = true;
        out.shouldEmitKickImpact = true;
        applyAuralineSquash(state, 1.24, 0.79, -1.5, 1.3);
      }
      out.deform.pelvis = {
        dx: -2.0 * deformScale,
        dy: 1.0 * deformScale,
        rotRad: -0.03 * deformScale,
        scaleX: 1.05,
      };
      out.deform.waist = {
        dx: -5.4 * deformScale,
        dy: -1.4 * deformScale,
        rotRad: -0.08 * deformScale,
        scaleX: 1.07,
      };
      out.deform.head = {
        dx: -7.0 * deformScale,
        dy: -1.8 * deformScale,
        rotRad: -0.10 * deformScale,
        scaleX: 1.02,
      };
      out.tintRgba = [1.26, 1.18, 0.94, 1];
    } else if (s.frameIndex === 22) {
      out.broadsideIntensity = 0.45;
    }
  } else if (state.mode === 'dodge') {
    // Defensive Aegis Shield-Block Counter-Brace (F16..F19) — strictly grounded hopYPx = 0
    const s = sampleSequence(AEGIS_COUNTER_SEQ, t);
    setAuralineFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.hopYPx = 0;
    out.isDashing = false;
    out.aegisCounterIntensity = s.frameIndex === 16 || s.frameIndex === 17 ? 1.0 : 0.65;
    const braceSign = s.frameIndex === 18 || s.frameIndex === 19 ? 1 : -1;
    out.deform.pelvis = {
      dx: 1.4 * braceSign * deformScale,
      dy: 1.2 * deformScale,
      rotRad: 0.02 * braceSign * deformScale,
      scaleX: 1.03,
    };
    out.deform.waist = {
      dx: 2.6 * braceSign * deformScale,
      dy: 1.6 * deformScale,
      rotRad: 0.04 * braceSign * deformScale,
      scaleX: 1.04,
    };
    out.deform.head = {
      dx: 3.2 * braceSign * deformScale,
      dy: 1.8 * deformScale,
      rotRad: 0.05 * braceSign * deformScale,
      scaleX: 1.01,
    };
    out.tintRgba = [0.94, 1.18, 1.16, 1];
  } else if (state.mode === 'idle1') {
    // Royal Curtsy (F23..F24)
    setAuralineFrame(state, t < 0.7 ? 23 : 24);
    const curtsy = Math.sin((t / Math.max(0.01, state.duration)) * Math.PI);
    out.deform.pelvis = { dx: 0, dy: 1.5 * curtsy * deformScale, rotRad: 0, scaleX: 1.02 };
    out.deform.waist = {
      dx: 1.2 * curtsy * deformScale,
      dy: 2.6 * curtsy * deformScale,
      rotRad: 0.03 * curtsy * deformScale,
      scaleX: 1.02,
    };
    out.deform.head = {
      dx: 1.8 * curtsy * deformScale,
      dy: 3.4 * curtsy * deformScale,
      rotRad: 0.045 * curtsy * deformScale,
      scaleX: 1,
    };
  } else if (state.mode === 'idle2') {
    // Scattergun Chamber Inspection (F25..F26)
    setAuralineFrame(state, t < 0.75 ? 25 : 26);
    const check = Math.sin((t / Math.max(0.01, state.duration)) * Math.PI);
    out.deform.waist = {
      dx: 1.4 * check * deformScale,
      dy: 0.8 * check * deformScale,
      rotRad: 0.02 * check * deformScale,
      scaleX: 1.01,
    };
    out.deform.head = {
      dx: 1.6 * check * deformScale,
      dy: 1.2 * check * deformScale,
      rotRad: 0.03 * check * deformScale,
      scaleX: 1,
    };
  } else if (state.mode === 'upgrade') {
    // Golden Reactor Core Plating & UpCharge Aura (F27..F28)
    setAuralineFrame(state, t < 0.38 ? 27 : 28);
    out.reactorCoreIntensity = 1.0;
    const pulse = Math.sin((t / Math.max(0.01, state.duration)) * Math.PI);
    out.deform.waist = {
      dx: 0,
      dy: -1.8 * pulse * deformScale,
      rotRad: 0,
      scaleX: 1 + 0.045 * pulse,
    };
    out.deform.head = {
      dx: 0,
      dy: -2.4 * pulse * deformScale,
      rotRad: 0,
      scaleX: 1.01,
    };
    out.tintRgba = [1.24, 1.16, 0.92, 1];
  } else if (state.mode === 'guard') {
    setAuralineFrame(state, 13);
    out.aegisCounterIntensity = 0.75;
    out.deform.waist = {
      dx: -1.6 * deformScale,
      dy: 1.4 * deformScale,
      rotRad: -0.025 * deformScale,
      scaleX: 1.04,
    };
    out.deform.head = {
      dx: -1.2 * deformScale,
      dy: 1.8 * deformScale,
      rotRad: -0.02 * deformScale,
      scaleX: 1.02,
    };
  } else if (state.mode === 'hit') {
    setAuralineFrame(state, 14);
    const whip = Math.sin((t / Math.max(0.01, state.duration)) * Math.PI);
    out.xProgress = -0.035 * whip;
    out.deform.waist = {
      dx: -whip * 5.2 * deformScale,
      dy: whip * 1.3 * deformScale,
      rotRad: -whip * 0.075 * deformScale,
      scaleX: 0.97,
    };
    out.deform.head = {
      dx: -whip * 7.6 * deformScale,
      dy: whip * 1.6 * deformScale,
      rotRad: -whip * 0.11 * deformScale,
      scaleX: 0.97,
    };
    out.tintRgba = [1.18, 0.86, 0.92, 1];
  } else if (state.mode === 'defeat') {
    setAuralineFrame(state, 15);
  } else if (state.mode === 'victory') {
    const f = t < 0.25 ? 29 : t < 0.55 ? 30 : 31;
    setAuralineFrame(state, f);
  }

  return out;
}
