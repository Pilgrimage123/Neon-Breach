export interface SequenceKeyframe {
  frameIndex: number;
  until: number;
  xProgress?: number;
  yHopPx?: number;
  dashing?: boolean;
}

export interface FrameTransitionInput {
  lastFrameIndex?: number;
  prevFrameIndex?: number;
  frameBlendElapsed?: number;
}

export interface FrameTransitionResult {
  lastFrameIndex: number;
  prevFrameIndex: number;
  frameBlendElapsed: number;
  frameBlendAlpha: number;
}

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson) for smooth C1 trajectories
 * across keyframes without velocity kinks or overshoot.
 */
export function interpolateMonotoneHermite(
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  t: number,
): number {
  const h = Math.max(0.0001, t2 - t1);
  const u = Math.max(0, Math.min(1, (t - t1) / h));
  const sec1 = (v2 - v1) / h;

  const h0 = Math.max(0.0001, t1 - t0);
  const sec0 = (v1 - v0) / h0;
  const h2 = Math.max(0.0001, t3 - t2);
  const sec2 = (v3 - v2) / h2;

  let m1 = sec0 * sec1 <= 0 ? 0 : (sec0 + sec1) * 0.5;
  let m2 = sec1 * sec2 <= 0 ? 0 : (sec1 + sec2) * 0.5;

  const maxSlope = 3 * Math.abs(sec1);
  if (Math.abs(m1) > maxSlope) m1 = Math.sign(m1) * maxSlope;
  if (Math.abs(m2) > maxSlope) m2 = Math.sign(m2) * maxSlope;

  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  return h00 * v1 + h10 * h * m1 + h01 * v2 + h11 * h * m2;
}

export function sampleSequence(
  seq: readonly SequenceKeyframe[],
  elapsed: number,
  defaultYHopPx = 0,
): {
  frameIndex: number;
  xProgress: number;
  yHopPx: number;
  dashing: boolean;
  vx: number;
  vy: number;
} {
  let idx = seq.length - 1;
  for (let i = 0; i < seq.length; i++) {
    if (elapsed <= seq[i].until) {
      idx = i;
      break;
    }
  }
  const kf = seq[idx];
  const prevKf = idx > 0 ? seq[idx - 1] : null;
  const prevPrevKf = idx > 1 ? seq[idx - 2] : null;
  const nextKf = idx + 1 < seq.length ? seq[idx + 1] : null;

  const t1 = prevKf ? prevKf.until : 0;
  const t2 = kf.until;
  const t0 = prevPrevKf ? prevPrevKf.until : t1 - (t2 - t1);
  const t3 = nextKf ? nextKf.until : t2 + (t2 - t1);

  const x1 = prevKf?.xProgress ?? 0;
  const x2 = kf.xProgress ?? 0;
  const x0 = prevPrevKf ? (prevPrevKf.xProgress ?? 0) : x1;
  const x3 = nextKf ? (nextKf.xProgress ?? x2) : x2;

  const y1 = prevKf?.yHopPx ?? defaultYHopPx;
  const y2 = kf.yHopPx ?? defaultYHopPx;
  const y0 = prevPrevKf ? (prevPrevKf.yHopPx ?? y1) : y1;
  const y3 = nextKf ? (nextKf.yHopPx ?? y2) : y2;

  const xProgress = interpolateMonotoneHermite(t0, t1, t2, t3, x0, x1, x2, x3, elapsed);
  const yHopPx = interpolateMonotoneHermite(t0, t1, t2, t3, y0, y1, y2, y3, elapsed);

  const span = Math.max(0.0001, t2 - t1);
  const vx = (x2 - x1) / span;
  const vy = (y2 - y1) / span;

  return {
    frameIndex: kf.frameIndex,
    xProgress,
    yHopPx,
    dashing: Boolean(kf.dashing),
    vx,
    vy,
  };
}

export function computeFrameTransitionState(
  prevState: FrameTransitionInput,
  targetFrameIndex: number,
  dt: number,
  blendDuration = 0.082,
): FrameTransitionResult {
  const prevLast = prevState.lastFrameIndex ?? targetFrameIndex;
  let prevIdx = prevState.prevFrameIndex ?? prevLast;
  let blendElapsed = (prevState.frameBlendElapsed ?? blendDuration) + Math.max(0, dt);

  if (targetFrameIndex !== prevLast) {
    prevIdx = prevLast;
    blendElapsed = Math.max(0, dt);
  }

  const rawT = Math.max(0, Math.min(1, blendElapsed / blendDuration));
  const frameBlendAlpha = prevIdx === targetFrameIndex ? 1 : rawT * rawT * (3 - 2 * rawT);

  return {
    lastFrameIndex: targetFrameIndex,
    prevFrameIndex: prevIdx,
    frameBlendElapsed: blendElapsed,
    frameBlendAlpha,
  };
}

export interface DeathCollapseSample {
  progress: number;
  frameIndex: number;
  alpha: number;
}

/** Shared enemy KO collapse & carcass fade sampler across Crawler, Stalker, Spitter, and Brute. */
export function sampleDeathCollapseFrame(
  koProgress: number,
  startFrame: number,
  stepCount: number,
  fadeStart = 0.8,
): DeathCollapseSample {
  const p = Math.max(0, Math.min(1, koProgress));
  const collapseNorm = Math.min(1, p / fadeStart);
  const step = Math.min(stepCount - 1, Math.floor(collapseNorm * stepCount));
  const alpha = p <= fadeStart ? 1 : Math.max(0, (1 - p) / Math.max(0.001, 1 - fadeStart));
  return {
    progress: p,
    frameIndex: startFrame + step,
    alpha,
  };
}
