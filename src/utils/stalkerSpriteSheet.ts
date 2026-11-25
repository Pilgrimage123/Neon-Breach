import type { SpriteRect } from './spriteCutout';
import type { FrameTransitionResult } from './spriteSheetAnim';

/**
 * Resized 512x512 native left-facing Chitin Stalker frames:
 * - Frame 0 (`stalker_open.png`): Wide bulging bloodshot yellow eye
 * - Frame 1 (`stalker_blink.png`): Narrowed squinting / blinking eye
 */
export const STALKER_SHEET_WIDTH = 512;
export const STALKER_SHEET_HEIGHT = 512;
/** Visible body height calibration so the crouching stalker sits proportionally on the deck */
export const STALKER_CANONICAL_HEIGHT = 460;

export type StalkerBoneWeight = 'head' | 'waist' | 'pelvis';

export interface StalkerSlimeNozzleSpec {
  id: string;
  /** Relative offset from (anchorX, bottomY) in unscaled 512x512 pixels (negative dx = left/forward, negative dy = up) */
  dx: number;
  dy: number;
  /** Spline bone that carries this hanging slime stalactite */
  bone: StalkerBoneWeight;
  /** Base radius of swelling slime bead in unscaled sprite pixels */
  baseRadius: number;
  /** Max hanging strand extension before pinch-off snap in unscaled sprite pixels */
  maxStretchPx: number;
  /** Base drip cycle interval in seconds */
  baseIntervalSec: number;
  /** Initial phase offset [0..1] so nozzles drip asynchronously */
  phaseOffset: number;
}

export interface StalkerSpriteFrame extends SpriteRect {
  id: string;
  row: number;
  col: number;
  /** Horizontal foot-center anchor in unscaled 512x512 sprite pixels (native left-facing) */
  anchorX: number;
  /** Vertical floor-contact baseline in unscaled 512x512 sprite pixels */
  bottomY: number;
  /** Relative offset from (anchorX, bottomY) to crimson dorsal spine crest */
  quillOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) to eye center for eyelid blink accent */
  eyeOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) to dripping jaws/mouth */
  jawOriginRel: { dx: number; dy: number };
  /** Relative offset from (anchorX, bottomY) to front scythe blade arc origin */
  clawOriginRel: { dx: number; dy: number };
}

/**
 * 7 slime drip nozzles measured directly from the hanging lime-green slime stalactites
 * on the uploaded 512x512 Chitin Stalker artwork (anchor = (255, 477), facingSign = +1).
 */
export const STALKER_SLIME_NOZZLES: readonly StalkerSlimeNozzleSpec[] = [
  {
    id: 'front_scythe_tip',
    dx: -179,
    dy: -144,
    bone: 'waist',
    baseRadius: 5.2,
    maxStretchPx: 30,
    baseIntervalSec: 2.35,
    phaseOffset: 0.12,
  },
  {
    id: 'jaw_chin_drip',
    dx: -135,
    dy: -183,
    bone: 'head',
    baseRadius: 5.8,
    maxStretchPx: 38,
    baseIntervalSec: 1.75,
    phaseOffset: 0.45,
  },
  {
    id: 'throat_fang_drip',
    dx: -113,
    dy: -146,
    bone: 'head',
    baseRadius: 4.8,
    maxStretchPx: 34,
    baseIntervalSec: 2.55,
    phaseOffset: 0.78,
  },
  {
    id: 'second_claw_tip',
    dx: -101,
    dy: -42,
    bone: 'pelvis',
    baseRadius: 4.6,
    maxStretchPx: 22,
    baseIntervalSec: 2.85,
    phaseOffset: 0.28,
  },
  {
    id: 'chest_belly_drip',
    dx: -31,
    dy: -227,
    bone: 'waist',
    baseRadius: 5.0,
    maxStretchPx: 36,
    baseIntervalSec: 2.15,
    phaseOffset: 0.62,
  },
  {
    id: 'mid_claw_elbow',
    dx: -29,
    dy: -121,
    bone: 'pelvis',
    baseRadius: 4.5,
    maxStretchPx: 28,
    baseIntervalSec: 3.05,
    phaseOffset: 0.91,
  },
  {
    id: 'hind_knee_drip',
    dx: 139,
    dy: -104,
    bone: 'pelvis',
    baseRadius: 5.4,
    maxStretchPx: 32,
    baseIntervalSec: 2.45,
    phaseOffset: 0.34,
  },
];

const SHARED_LANDMARKS = {
  x: 0,
  y: 0,
  w: STALKER_SHEET_WIDTH,
  h: STALKER_SHEET_HEIGHT,
  anchorX: 255,
  bottomY: 477,
  quillOriginRel: { dx: 15, dy: -372 },
  eyeOriginRel: { dx: -120, dy: -306 },
  jawOriginRel: { dx: -135, dy: -203 },
  clawOriginRel: { dx: -179, dy: -137 },
} as const;

export const STALKER_SHEET_FRAMES: readonly StalkerSpriteFrame[] = [
  {
    id: 'stalker_open_0',
    row: 0,
    col: 0,
    ...SHARED_LANDMARKS,
  },
  {
    id: 'stalker_blink_1',
    row: 0,
    col: 1,
    ...SHARED_LANDMARKS,
  },
];

export type StalkerAnimMode =
  | 'idle'
  | 'ambush'
  | 'guard'
  | 'attack'
  | 'bristle'
  | 'pain'
  | 'death';

export interface StalkerAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  bristleTimer?: number;
  bristleDuration?: number;
  bristleKind?: 'armor' | 'retaliate';
  ambushPrimed?: boolean;
  armoredGuard?: boolean;
  retaliateHover?: boolean;
}

export interface StalkerBlinkState {
  /** 0 = wide open eye (`stalker_open.png`), 1 = narrowed/blinking eye (`stalker_blink.png`) */
  frameIndex: 0 | 1;
  /** Full eyelid shut peak [0..1] drawn over the narrowed eye during the crisp blink apex */
  blinkClosure: number;
  /** Whether the stalker is actively inside a blink pulse */
  isBlinking: boolean;
}

export interface StalkerFrameSample {
  mode: StalkerAnimMode;
  frameIndex: number;
  frame: StalkerSpriteFrame;
  prevFrameIndex: number;
  prevFrame: StalkerSpriteFrame;
  frameBlendAlpha: number;
  transitionState?: FrameTransitionResult;
  /** Full eyelid shut accent [0..1] during blink apex or hit wince */
  blinkClosure: number;
  /** Additional local horizontal dash/lunge ratio relative to size (negative = left toward hero) */
  xOffsetRatio: number;
  /** Additional vertical leap/hop in unscaled sprite pixels (negative = upward) */
  yHopPx: number;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  /** Bioluminescent crimson spine intensity [0..1] */
  spineGlowIntensity: number;
  /** Twin scythe claw slash progress [0..1] during lunge strike */
  clawSlashProgress: number;
  alpha: number;
}

function evaluateSingleBlinkPulse(tInPulse: number): { frameIndex: 0 | 1; blinkClosure: number; active: boolean } {
  // Total blink duration = 0.24s:
  // 0.00..0.055s: open -> narrowed squint (frame 1)
  // 0.055..0.145s: full shut eyelid apex peaking to 1.0 over frame 1
  // 0.145..0.240s: narrowed squint -> reopen to frame 0
  if (tInPulse < 0 || tInPulse >= 0.24) {
    return { frameIndex: 0, blinkClosure: 0, active: false };
  }
  let blinkClosure = 0;
  if (tInPulse >= 0.045 && tInPulse <= 0.165) {
    const u = (tInPulse - 0.045) / 0.12;
    blinkClosure = Math.sin(u * Math.PI);
  }
  return { frameIndex: 1, blinkClosure, active: true };
}

/**
 * Deterministic natural organic blinking + expressive eye state for Chitin Stalker.
 * - Idle / Guard: Wide bulging bloodshot eye (frame 0) punctuated by brisk single blinks
 *   and occasional predatory double-blinks (frame 1 + eyelid apex closure).
 * - Ambush / Attack / Bristle / Pain / Death: Narrowed predatory glare / grimace (frame 1).
 */
export function computeStalkerBlinkState(
  elapsed: number,
  instanceIndex: number,
  mode: StalkerAnimMode,
  modeProgress = 0,
): StalkerBlinkState {
  if (mode === 'death') {
    return { frameIndex: 1, blinkClosure: Math.min(1, 0.35 + modeProgress * 0.85), isBlinking: false };
  }
  if (mode === 'pain') {
    const wince = modeProgress < 0.42 ? Math.sin((modeProgress / 0.42) * Math.PI) * 0.92 : 0;
    return { frameIndex: 1, blinkClosure: wince, isBlinking: wince > 0.1 };
  }
  if (mode === 'attack' || mode === 'ambush' || mode === 'bristle') {
    // Aggressive narrowed squint throughout attack/ambush/bristle, with brief savage micro-blink at windup snap
    const snapWince =
      mode === 'attack' && modeProgress > 0.14 && modeProgress < 0.26
        ? Math.sin(((modeProgress - 0.14) / 0.12) * Math.PI) * 0.65
        : 0;
    return { frameIndex: 1, blinkClosure: snapWince, isBlinking: false };
  }

  // Natural periodic single + double blink cadence in idle and guard modes
  // Cycle period = 2.45s so a blink is always clearly seen within ~1-2 seconds!
  const period = mode === 'guard' ? 2.15 : 2.45;
  const shifted = Math.max(0, elapsed + instanceIndex * 0.83 + 1.55);
  const cycleIndex = Math.floor(shifted / period);
  const tCycle = shifted - cycleIndex * period;

  const firstBlink = evaluateSingleBlinkPulse(tCycle);
  if (firstBlink.active) {
    return {
      frameIndex: firstBlink.frameIndex,
      blinkClosure: firstBlink.blinkClosure,
      isBlinking: true,
    };
  }

  // Every second cycle performs a quick predatory double-blink 0.30s after the first
  if (cycleIndex % 2 === 1) {
    const secondBlink = evaluateSingleBlinkPulse(tCycle - 0.30);
    if (secondBlink.active) {
      return {
        frameIndex: secondBlink.frameIndex,
        blinkClosure: secondBlink.blinkClosure,
        isBlinking: true,
      };
    }
  }

  return { frameIndex: 0, blinkClosure: 0, isBlinking: false };
}
