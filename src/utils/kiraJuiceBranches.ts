import type { HeroAnimMode } from './heroAnimator';
import type { ActorJuiceSnapshot } from '../components/combat/SpriteJuiceFeedbackHandler';
import type { SequencerFrameState } from '../components/combat/CombatActionSequencer';
import {
  type KiraJuiceState,
  applyKiraSquash,
  setKiraFrame,
} from './kiraJuiceState';
import { type JuiceMeshDeform, createNeutralMeshDeform } from './proceduralJuiceCore';
import { type SequenceKeyframe, sampleSequence } from './spriteSheetAnim';

export interface KiraBranchFrame {
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
  dropkickIntensity: number;
}

const IDLE_BREATH_FRAMES = [0, 1, 3, 8] as const;

const SHOOT_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 6, until: 0.14, xProgress: 0.02 },
  { frameIndex: 7, until: 0.34, xProgress: 0.04 },
  { frameIndex: 8, until: 0.46, xProgress: 0.01 },
  { frameIndex: 0, until: 0.50, xProgress: 0 },
];

const SURGE_BLAST_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 9, until: 0.14, xProgress: 0.01 },
  { frameIndex: 10, until: 0.30, xProgress: 0.02 },
  { frameIndex: 11, until: 0.56, xProgress: -0.05 },
  { frameIndex: 12, until: 0.68, xProgress: -0.02 },
  { frameIndex: 0, until: 0.72, xProgress: 0 },
];

const OVERDRIVE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 4, until: 0.08, xProgress: 0.22, yHopPx: 0, dashing: true },
  { frameIndex: 5, until: 0.16, xProgress: 0.48, yHopPx: -4, dashing: true },
  { frameIndex: 2, until: 0.24, xProgress: 0.72, yHopPx: -6, dashing: true },
  { frameIndex: 20, until: 0.34, xProgress: 0.82, yHopPx: -10, dashing: true },
  { frameIndex: 21, until: 0.62, xProgress: 0.94, yHopPx: -26, dashing: true },
  { frameIndex: 22, until: 0.76, xProgress: 0.45, yHopPx: 0, dashing: true },
  { frameIndex: 0, until: 0.88, xProgress: 0, yHopPx: 0 },
];

const DODGE_SEQ: readonly SequenceKeyframe[] = [
  { frameIndex: 16, until: 0.22, xProgress: -0.14, yHopPx: -26, dashing: true },
  { frameIndex: 17, until: 0.46, xProgress: -0.26, yHopPx: 0, dashing: true },
  { frameIndex: 18, until: 0.68, xProgress: -0.22, yHopPx: -18, dashing: true },
  { frameIndex: 19, until: 0.86, xProgress: -0.08, yHopPx: 0, dashing: false },
  { frameIndex: 0, until: 0.96, xProgress: 0, yHopPx: 0, dashing: false },
];

export function resolveKiraCutInFrameIndex(
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

export function stepKiraBranch(
  state: KiraJuiceState,
  hoveredColor: string | null,
  totalTime: number,
  deformScale: number,
  reducedMotion: boolean,
): KiraBranchFrame {
  const out: KiraBranchFrame = {
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
    dropkickIntensity: 0,
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
        frameIndex = IDLE_BREATH_FRAMES[Math.floor(totalTime / 0.36) % IDLE_BREATH_FRAMES.length];
      }
    }
    setKiraFrame(state, frameIndex);

    if (!reducedMotion) {
      const breath = Math.sin(totalTime * 2.4);
      const sway = Math.sin(totalTime * 1.6);
      out.deform.pelvis = { dx: 0, dy: breath * 0.5 * deformScale, rotRad: 0, scaleX: 1 - breath * 0.005 };
      out.deform.waist = { dx: sway * 0.8 * deformScale, dy: breath * 0.9 * deformScale, rotRad: sway * 0.012 * deformScale, scaleX: 1 + breath * 0.008 };
      out.deform.head = { dx: sway * 1.1 * deformScale, dy: breath * 1.2 * deformScale, rotRad: sway * 0.016 * deformScale, scaleX: 1 };
    }
    return out;
  }

  const t = Math.min(state.elapsed, state.duration);

  if (state.mode === 'shoot') {
    const s = sampleSequence(SHOOT_SEQ, t);
    setKiraFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    if (s.frameIndex === 7 && state.emittedShots < 1) {
      state.emittedShots = 1;
      out.shouldEmitShot = true;
      applyKiraSquash(state, 1.08, 0.92, -0.5, 0.4);
    }
    if (s.frameIndex === 7) {
      out.deform.waist = { dx: -3.2 * deformScale, dy: 0.6 * deformScale, rotRad: -0.04 * deformScale, scaleX: 1.02 };
      out.deform.head = { dx: -4.4 * deformScale, dy: 0.8 * deformScale, rotRad: -0.05 * deformScale, scaleX: 1 };
    }
  } else if (state.mode === 'dash_kick') {
    const s = sampleSequence(SURGE_BLAST_SEQ, t);
    setKiraFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.isSurgeBlast = true;
    if (s.frameIndex === 9 || s.frameIndex === 10) {
      out.surgeBlastIntensity = 0.45;
      out.deform.waist = { dx: 2.8 * deformScale, dy: 1.2 * deformScale, rotRad: 0.04 * deformScale, scaleX: 1.03 };
      out.deform.head = { dx: 3.6 * deformScale, dy: 1.5 * deformScale, rotRad: 0.05 * deformScale, scaleX: 1 };
      out.tintRgba = [1.14, 0.92, 1.18, 1];
    } else if (s.frameIndex === 11) {
      out.surgeBlastIntensity = 1.0;
      if (!state.surgeBlastFired) {
        state.surgeBlastFired = true;
        state.emittedShots = 1;
        out.shouldEmitShot = true;
        applyKiraSquash(state, 1.22, 0.80, -1.2, 1.1);
      }
      // Dramatic arched-back cannon recoil on FourKnotSpine
      out.deform.pelvis = { dx: -2.4 * deformScale, dy: 1.2 * deformScale, rotRad: -0.04 * deformScale, scaleX: 1.04 };
      out.deform.waist = { dx: -6.8 * deformScale, dy: 1.8 * deformScale, rotRad: -0.10 * deformScale, scaleX: 1.06 };
      out.deform.head = { dx: -9.2 * deformScale, dy: 2.2 * deformScale, rotRad: -0.13 * deformScale, scaleX: 1.02 };
      out.tintRgba = [1.22, 0.96, 1.24, 1];
      if (!reducedMotion) {
        out.uvDistortAmp = [0.004, 0.002];
        out.uvDistortFreq = 22;
      }
    }
  } else if (state.mode === 'overdrive') {
    const s = sampleSequence(OVERDRIVE_SEQ, t);
    setKiraFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.hopYPx = s.yHopPx;
    out.isDashing = s.dashing;
    if (s.frameIndex === 21) {
      out.dropkickIntensity = 1.0;
      if (!state.emittedKickImpact) {
        state.emittedKickImpact = true;
        out.shouldEmitKickImpact = true;
        applyKiraSquash(state, 1.24, 0.78, 1.4, -1.2);
      }
      out.deform.pelvis = { dx: 4.0 * deformScale, dy: -1.4 * deformScale, rotRad: 0.06 * deformScale, scaleX: 1.05 };
      out.deform.waist = { dx: 7.2 * deformScale, dy: -2.2 * deformScale, rotRad: 0.09 * deformScale, scaleX: 1.06 };
      out.deform.head = { dx: 8.6 * deformScale, dy: -2.6 * deformScale, rotRad: 0.10 * deformScale, scaleX: 1.02 };
      out.tintRgba = [0.95, 1.12, 1.24, 1];
    } else if (s.frameIndex === 20 || s.frameIndex === 22) {
      out.dropkickIntensity = 0.55;
    }
  } else if (state.mode === 'dodge') {
    const s = sampleSequence(DODGE_SEQ, t);
    setKiraFrame(state, s.frameIndex);
    out.xProgress = s.xProgress;
    out.hopYPx = s.yHopPx;
    out.isDashing = s.dashing;
    if (s.frameIndex === 17 || s.frameIndex === 19) {
      // Grounded contact/landing frames strictly hopYPx = 0
      out.hopYPx = 0;
    }
  } else if (state.mode === 'idle1') {
    setKiraFrame(state, t < 0.7 ? 23 : 24);
  } else if (state.mode === 'idle2') {
    setKiraFrame(state, t < 0.75 ? 25 : 26);
  } else if (state.mode === 'upgrade') {
    setKiraFrame(state, t < 0.36 ? 27 : 28);
    out.tintRgba = [1.06, 1.12, 1.22, 1];
  } else if (state.mode === 'guard') {
    setKiraFrame(state, 13);
    out.deform.waist = { dx: -1.8 * deformScale, dy: 1.6 * deformScale, rotRad: -0.03 * deformScale, scaleX: 1.04 };
    out.deform.head = { dx: -1.4 * deformScale, dy: 2.0 * deformScale, rotRad: -0.02 * deformScale, scaleX: 1.02 };
  } else if (state.mode === 'hit') {
    setKiraFrame(state, 14);
    const whip = Math.sin((t / Math.max(0.01, state.duration)) * Math.PI);
    out.xProgress = -0.04 * whip;
    out.deform.waist = { dx: -whip * 6.4 * deformScale, dy: whip * 1.4 * deformScale, rotRad: -whip * 0.09 * deformScale, scaleX: 0.96 };
    out.deform.head = { dx: -whip * 9.8 * deformScale, dy: whip * 1.8 * deformScale, rotRad: -whip * 0.14 * deformScale, scaleX: 0.96 };
    out.tintRgba = [1.18, 0.86, 0.92, 1];
  } else if (state.mode === 'defeat') {
    setKiraFrame(state, 15);
  } else if (state.mode === 'victory') {
    const f = t < 0.2 ? 29 : t < 0.55 ? 30 : 31;
    setKiraFrame(state, f);
    if (f === 30) out.hopYPx = -16;
  }

  return out;
}
