import type { LogoSequenceSample } from './titleEmblemVfx';
import {
  SEQUENCE_FORWARD_END_SEC,
  SEQUENCE_HOLD_END_SEC,
  SEQUENCE_TOTAL_SEC,
} from './titleEmblemRenderer';

export const VISOR_COLS = 24;
export const VISOR_ROWS = 9;
export const VISOR_CELL_COUNT = VISOR_COLS * VISOR_ROWS;
export const VISOR_BARREL_CURVATURE = -0.014;

export const VISOR_OFF_COLOR = '#0b132b';
export const VISOR_SCANLINE_DURATION_SEC = 0.18;
export const VISOR_OVERDRIVE_DURATION_SEC = 0.09;
export const VISOR_TRAIL_DURATION_SEC = 0.06;
export const VISOR_RADIAL_SPEED_CELLS_PER_SEC = 45;

export interface VisorQuad {
  p00x: number;
  p00y: number;
  p10x: number;
  p10y: number;
  p01x: number;
  p01y: number;
  p11x: number;
  p11y: number;
  curvature: number;
}

export const VISOR_KEYFRAME_QUADS: readonly VisorQuad[] = [
  // K0: Idle / Base Aim (-1.0° goggle axis)
  {
    p00x: 0.805,
    p00y: 0.098,
    p10x: 0.884,
    p10y: 0.091,
    p01x: 0.807,
    p01y: 0.157,
    p11x: 0.885,
    p11y: 0.146,
    curvature: -0.010,
  },
  // K1: Beat 1 (Wink, -0.8° goggle axis)
  {
    p00x: 0.806,
    p00y: 0.098,
    p10x: 0.884,
    p10y: 0.092,
    p01x: 0.807,
    p01y: 0.164,
    p11x: 0.885,
    p11y: 0.154,
    curvature: -0.011,
  },
  // K2: Beat 2 (Shared Grin, -17.5° up-right head tilt)
  {
    p00x: 0.765,
    p00y: 0.096,
    p10x: 0.829,
    p10y: 0.054,
    p01x: 0.783,
    p01y: 0.159,
    p11x: 0.846,
    p11y: 0.111,
    curvature: -0.014,
  },
  // K3: Beat 3 (Blown Kiss, +14.6° down-right head lean)
  {
    p00x: 0.772,
    p00y: 0.071,
    p10x: 0.838,
    p10y: 0.092,
    p01x: 0.763,
    p01y: 0.123,
    p11x: 0.828,
    p11y: 0.153,
    curvature: -0.015,
  },
  // K4: Beat 4 (Climax !!, +16.6° down-right head lean)
  {
    p00x: 0.761,
    p00y: 0.063,
    p10x: 0.834,
    p10y: 0.095,
    p01x: 0.754,
    p01y: 0.127,
    p11x: 0.823,
    p11y: 0.158,
    curvature: -0.014,
  },
];

function compileBitmap24x9(rows: readonly string[]): Uint8Array {
  const out = new Uint8Array(VISOR_CELL_COUNT);
  for (let r = 0; r < VISOR_ROWS; r++) {
    const line = rows[r] ?? '';
    for (let c = 0; c < VISOR_COLS; c++) {
      const ch = line[c];
      out[r * VISOR_COLS + c] = ch === '2' ? 2 : ch === '1' ? 1 : 0;
    }
  }
  return out;
}

export const ANGRY_CAT_24x9: Uint8Array = compileBitmap24x9([
  '........11....11........',
  '.......1221..1221.......',
  '......121111111121......',
  '.....1.12......21.1.....',
  '.....1...12..21...1.....',
  '.....1.12......21.1.....',
  '......1..11..11..1......',
  '.......1..1111..1.......',
  '........11....11........',
]);

export const HAPPY_CAT_24x9: Uint8Array = compileBitmap24x9([
  '........11....11........',
  '.......1221..1221.......',
  '......121111111121......',
  '.....1..121..121..1.....',
  '.....1.12.1..1.21.1.....',
  '.....1............1.....',
  '......1..1.11.1..1......',
  '.......1..1..1..1.......',
  '........11111111........',
]);

export const HEART_CLIMAX_24x9: Uint8Array = compileBitmap24x9([
  '.........11..11.........',
  '........12211221........',
  '..1..1..12222221..1..1..',
  '.121121.12222221.121121.',
  '.122221..122221..122221.',
  '..1221....1221....1221..',
  '...11......11......11...',
  '........................',
  '........................',
]);

function buildOptimalTransportWalkPairs(
  fromBitmap: Uint8Array,
  toBitmap: Uint8Array,
): { fromIdx: Uint8Array; toIdx: Uint8Array; toVal: Uint8Array } {
  const srcIndices: number[] = [];
  const dstIndices: number[] = [];
  for (let i = 0; i < VISOR_CELL_COUNT; i++) {
    if (fromBitmap[i] > 0) srcIndices.push(i);
    if (toBitmap[i] > 0) dstIndices.push(i);
  }

  const pairCount = Math.max(srcIndices.length, dstIndices.length);
  const fromIdx = new Uint8Array(pairCount);
  const toIdx = new Uint8Array(pairCount);
  const toVal = new Uint8Array(pairCount);

  const usedDst = new Uint8Array(dstIndices.length);
  for (let i = 0; i < pairCount; i++) {
    const s = srcIndices[i % srcIndices.length];
    const sc = s % VISOR_COLS;
    const sr = (s - sc) / VISOR_COLS;

    let bestDIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < dstIndices.length; j++) {
      if (usedDst[j] && i < dstIndices.length) continue;
      const d = dstIndices[j];
      const dc = d % VISOR_COLS;
      const dr = (d - dc) / VISOR_COLS;
      const dist = (dc - sc) * (dc - sc) + (dr - sr) * (dr - sr);
      if (dist < bestDist) {
        bestDist = dist;
        bestDIdx = j;
      }
    }
    usedDst[bestDIdx] = 1;
    const target = dstIndices[bestDIdx];
    fromIdx[i] = s;
    toIdx[i] = target;
    toVal[i] = toBitmap[target];
  }

  return { fromIdx, toIdx, toVal };
}

const BEAT1_TRANSPORT = buildOptimalTransportWalkPairs(
  ANGRY_CAT_24x9,
  HAPPY_CAT_24x9,
);

export type VisorMode =
  | 'angry'
  | 'beat1_forward'
  | 'happy'
  | 'beat4_forward'
  | 'climax_hold'
  | 'beat4_reverse'
  | 'beat1_reverse';

export interface VisorMatrixState {
  activeCells: Uint8Array;
  lastCellState: Uint8Array;
  cellFlashRemaining: Float32Array;
  cellTrailRemaining: Float32Array;
  workingQuad: VisorQuad;
  scanlineRow: number;
  mode: VisorMode;
  climaxThrobScale: number;
  elapsedSec: number;
}

export function createVisorMatrixState(): VisorMatrixState {
  const activeCells = new Uint8Array(ANGRY_CAT_24x9);
  const lastCellState = new Uint8Array(ANGRY_CAT_24x9);
  const q0 = VISOR_KEYFRAME_QUADS[0];
  return {
    activeCells,
    lastCellState,
    cellFlashRemaining: new Float32Array(VISOR_CELL_COUNT),
    cellTrailRemaining: new Float32Array(VISOR_CELL_COUNT),
    workingQuad: {
      p00x: q0.p00x,
      p00y: q0.p00y,
      p10x: q0.p10x,
      p10y: q0.p10y,
      p01x: q0.p01x,
      p01y: q0.p01y,
      p11x: q0.p11x,
      p11y: q0.p11y,
      curvature: q0.curvature,
    },
    scanlineRow: -1,
    mode: 'angry',
    climaxThrobScale: 1,
    elapsedSec: 0,
  };
}

/**
 * Linearly interpolates between two calibrated VisorQuad keyframes into `outQuad` without allocation.
 */
export function interpolateVisorQuad(
  frameA: number,
  frameB: number,
  blendU: number,
  outQuad: VisorQuad,
): VisorQuad {
  const qA = VISOR_KEYFRAME_QUADS[Math.max(0, Math.min(VISOR_KEYFRAME_QUADS.length - 1, frameA))];
  const qB = VISOR_KEYFRAME_QUADS[Math.max(0, Math.min(VISOR_KEYFRAME_QUADS.length - 1, frameB))];
  const u = blendU <= 0 ? 0 : blendU >= 1 ? 1 : blendU;
  const omU = 1 - u;

  outQuad.p00x = qA.p00x * omU + qB.p00x * u;
  outQuad.p00y = qA.p00y * omU + qB.p00y * u;
  outQuad.p10x = qA.p10x * omU + qB.p10x * u;
  outQuad.p10y = qA.p10y * omU + qB.p10y * u;
  outQuad.p01x = qA.p01x * omU + qB.p01x * u;
  outQuad.p01y = qA.p01y * omU + qB.p01y * u;
  outQuad.p11x = qA.p11x * omU + qB.p11x * u;
  outQuad.p11y = qA.p11y * omU + qB.p11y * u;
  outQuad.curvature = qA.curvature * omU + qB.curvature * u;
  return outQuad;
}

/**
 * Projects a (col, row) matrix cell onto target canvas pixel coordinates
 * with bilinear perspective mapping, barrel curvature, and idle breathing offset.
 */
export function projectVisorCell(
  quad: VisorQuad,
  col: number,
  row: number,
  targetW: number,
  targetH: number,
  breathOffsetNormY: number,
  outPt: { x: number; y: number },
): void {
  const uc = (col + 0.5) / VISOR_COLS;
  const vr = (row + 0.5) / VISOR_ROWS;
  const omU = 1 - uc;
  const omV = 1 - vr;

  const bx =
    omU * omV * quad.p00x +
    uc * omV * quad.p10x +
    omU * vr * quad.p01x +
    uc * vr * quad.p11x;
  const by =
    omU * omV * quad.p00y +
    uc * omV * quad.p10y +
    omU * vr * quad.p01y +
    uc * vr * quad.p11y;

  const vPxX = (quad.p01x - quad.p00x) * targetW;
  const vPxY = (quad.p01y - quad.p00y) * targetH;
  const vLen = Math.max(1e-6, Math.hypot(vPxX, vPxY));
  const bowPx = quad.curvature * targetH * 4 * uc * omU;

  outPt.x = bx * targetW + (vPxX / vLen) * bowPx;
  outPt.y = by * targetH + (vPxY / vLen) * bowPx + breathOffsetNormY * targetH;
}

function applyBeat1DiscreteWalk(
  outCells: Uint8Array,
  walkProgress: number,
  scanlineRow: number,
  isReverse: boolean,
): void {
  outCells.fill(0);
  // Base scanline-revealed expression rows
  for (let r = 0; r < VISOR_ROWS; r++) {
    const useHappy = isReverse ? r < scanlineRow : r <= scanlineRow;
    const src = useHappy ? HAPPY_CAT_24x9 : ANGRY_CAT_24x9;
    const rowOff = r * VISOR_COLS;
    for (let c = 0; c < VISOR_COLS; c++) {
      outCells[rowOff + c] = src[rowOff + c];
    }
  }

  // Overlay discrete 1-to-1 optimal-transport cell walk
  const { fromIdx, toIdx, toVal } = BEAT1_TRANSPORT;
  const u = walkProgress <= 0 ? 0 : walkProgress >= 1 ? 1 : walkProgress;
  for (let i = 0; i < fromIdx.length; i++) {
    const s = fromIdx[i];
    const d = toIdx[i];
    const sc = s % VISOR_COLS;
    const sr = (s - sc) / VISOR_COLS;
    const dc = d % VISOR_COLS;
    const dr = (d - dc) / VISOR_COLS;
    const mc = Math.round(sc + (dc - sc) * u);
    const mr = Math.round(sr + (dr - sr) * u);
    if (mc >= 0 && mc < VISOR_COLS && mr >= 0 && mr < VISOR_ROWS) {
      const mIdx = mr * VISOR_COLS + mc;
      const val = toVal[i];
      if (val > outCells[mIdx]) {
        outCells[mIdx] = val;
      }
    }
  }
}

/**
 * Advances the Visor Matrix expression state, scanline sweep, cell-walk trail,
 * phosphor overdrive flashes, and 2 Hz climax heartbeat throb without allocations.
 */
export function stepVisorMatrix(
  state: VisorMatrixState,
  seqSample: LogoSequenceSample,
  rawDt: number,
  reducedMotion = false,
): void {
  const dt = Math.max(0, Math.min(0.05, Number.isFinite(rawDt) ? rawDt : 0));
  state.elapsedSec += dt;

  interpolateVisorQuad(
    seqSample.frameA,
    seqSample.frameB,
    seqSample.blendU,
    state.workingQuad,
  );

  // Decay overdrive and afterglow timers in place
  for (let i = 0; i < VISOR_CELL_COUNT; i++) {
    if (reducedMotion) {
      state.cellFlashRemaining[i] = 0;
      state.cellTrailRemaining[i] = 0;
    } else {
      if (state.cellFlashRemaining[i] > 0) {
        state.cellFlashRemaining[i] = Math.max(0, state.cellFlashRemaining[i] - dt);
      }
      if (state.cellTrailRemaining[i] > 0) {
        state.cellTrailRemaining[i] = Math.max(0, state.cellTrailRemaining[i] - dt);
      }
    }
  }

  state.scanlineRow = -1;
  state.climaxThrobScale = 1;

  if (!seqSample.active) {
    state.mode = 'angry';
    state.activeCells.set(ANGRY_CAT_24x9);
  } else {
    const t = Math.max(0, Math.min(SEQUENCE_TOTAL_SEC, seqSample.elapsed));
    if (t < 0.36) {
      // Beat 1 Forward (K0 -> K1)
      state.mode = 'beat1_forward';
      const scanU = Math.min(1, t / VISOR_SCANLINE_DURATION_SEC);
      const scanRow = Math.floor(scanU * (VISOR_ROWS - 1));
      state.scanlineRow = scanU < 1 ? scanRow : -1;
      applyBeat1DiscreteWalk(state.activeCells, t / 0.36, scanRow, false);
    } else if (t < 1.24) {
      // Continuous HAPPY_CAT_24x9 continuity across K1 -> K2 -> K3
      state.mode = 'happy';
      state.activeCells.set(HAPPY_CAT_24x9);
    } else if (t < SEQUENCE_FORWARD_END_SEC) {
      // Beat 4 Forward (K3 -> K4): Manhattan radial pulse from (12, 4) at 45 cells/sec
      state.mode = 'beat4_forward';
      const radius = (t - 1.24) * VISOR_RADIAL_SPEED_CELLS_PER_SEC;
      for (let r = 0; r < VISOR_ROWS; r++) {
        for (let c = 0; c < VISOR_COLS; c++) {
          const idx = r * VISOR_COLS + c;
          const dist = Math.abs(c - 12) + Math.abs(r - 4);
          state.activeCells[idx] =
            dist <= radius ? HEART_CLIMAX_24x9[idx] : HAPPY_CAT_24x9[idx];
        }
      }
    } else if (t <= SEQUENCE_HOLD_END_SEC) {
      // Climax Hold (1.66 - 2.06 s): HEART_CLIMAX_24x9 + 2 Hz heartbeat throb
      state.mode = 'climax_hold';
      state.activeCells.set(HEART_CLIMAX_24x9);
      if (!reducedMotion) {
        const wave = Math.max(0, Math.sin(2 * Math.PI * 2 * (t - SEQUENCE_FORWARD_END_SEC)));
        state.climaxThrobScale = 1 + 0.16 * wave * wave;
      }
    } else if (t < 2.26) {
      // Reverse K4 -> K3: radial collapse from outer cells back to (12, 4)
      state.mode = 'beat4_reverse';
      const collapseProgress = (t - SEQUENCE_HOLD_END_SEC) / 0.2;
      const maxManhattan = 16;
      const radius = maxManhattan * (1 - collapseProgress);
      for (let r = 0; r < VISOR_ROWS; r++) {
        for (let c = 0; c < VISOR_COLS; c++) {
          const idx = r * VISOR_COLS + c;
          const dist = Math.abs(c - 12) + Math.abs(r - 4);
          state.activeCells[idx] =
            dist <= radius ? HEART_CLIMAX_24x9[idx] : HAPPY_CAT_24x9[idx];
        }
      }
    } else if (t < 2.66) {
      // Reverse K3 -> K2 -> K1: hold HAPPY_CAT_24x9
      state.mode = 'happy';
      state.activeCells.set(HAPPY_CAT_24x9);
    } else {
      // Reverse K1 -> K0: upward cathode scanline wipe (r = 8..0)
      state.mode = 'beat1_reverse';
      const revU = Math.min(1, (t - 2.66) / 0.2);
      const scanRow = Math.max(0, Math.round((1 - revU) * (VISOR_ROWS - 1)));
      state.scanlineRow = revU < 1 ? scanRow : -1;
      applyBeat1DiscreteWalk(state.activeCells, 1 - revU, scanRow, true);
    }
  }

  // Detect cell transitions to trigger 90ms phosphor overdrive & 60ms vacated afterglow trail
  for (let i = 0; i < VISOR_CELL_COUNT; i++) {
    const prev = state.lastCellState[i];
    const next = state.activeCells[i];
    if (prev !== next) {
      if (!reducedMotion) {
        if (next > 0) {
          state.cellFlashRemaining[i] = VISOR_OVERDRIVE_DURATION_SEC;
        } else if (prev > 0) {
          state.cellTrailRemaining[i] = VISOR_TRAIL_DURATION_SEC;
        }
      }
      state.lastCellState[i] = next;
    }
  }
}

const SCRATCH_PT = { x: 0, y: 0 };

function getLedColors(mode: VisorMode, val: number): { fill: string; glow: string } {
  if (mode === 'angry') {
    return val === 2
      ? { fill: '#ffd166', glow: '#ff7b00' }
      : { fill: '#ff2a2a', glow: '#ff4500' };
  }
  if (mode === 'beat4_forward' || mode === 'climax_hold' || mode === 'beat4_reverse') {
    return val === 2
      ? { fill: '#ffffff', glow: '#ff9de2' }
      : { fill: '#ff2e93', glow: '#ff2e93' };
  }
  return val === 2
    ? { fill: '#ff9de2', glow: '#ffffff' }
    : { fill: '#ff2e93', glow: '#ff2e93' };
}

/**
 * Renders the 24x9 perspective-mapped Visor Matrix onto the unified 960x541 offscreen composite.
 */
export function renderVisorMatrix(
  ctx: CanvasRenderingContext2D,
  state: VisorMatrixState,
  targetW: number,
  targetH: number,
  breathOffsetNormY = 0,
  reducedMotion = false,
): void {
  const q = state.workingQuad;
  const dx = (q.p10x - q.p00x) * targetW;
  const dy = (q.p10y - q.p00y) * targetH;
  const quadW = Math.hypot(dx, dy);
  const quadH = Math.hypot((q.p01x - q.p00x) * targetW, (q.p01y - q.p00y) * targetH);
  const tiltRad = Math.atan2(dy, dx);

  const cellW = Math.max(1.2, (quadW / VISOR_COLS) * 0.72);
  const cellH = Math.max(1.2, (quadH / VISOR_ROWS) * 0.72);

  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const unlitW = cellW * 0.84;
  const unlitH = cellH * 0.84;

  ctx.save();
  for (let r = 0; r < VISOR_ROWS; r++) {
    for (let c = 0; c < VISOR_COLS; c++) {
      const idx = r * VISOR_COLS + c;
      const val = state.activeCells[idx];
      const flashRem = reducedMotion ? 0 : state.cellFlashRemaining[idx];
      const trailRem = reducedMotion ? 0 : state.cellTrailRemaining[idx];

      projectVisorCell(q, c, r, targetW, targetH, breathOffsetNormY, SCRATCH_PT);
      const px = SCRATCH_PT.x;
      const py = SCRATCH_PT.y;

      if (val === 0 && trailRem <= 0) {
        ctx.setTransform(cosT, sinT, -sinT, cosT, px, py);
        ctx.fillStyle = 'rgba(22, 36, 71, 0.55)';
        ctx.fillRect(-unlitW * 0.5, -unlitH * 0.5, unlitW, unlitH);
        continue;
      }

      const isOverdrive = flashRem > 0;
      const isTrailOnly = val === 0 && trailRem > 0;
      const scale =
        (isOverdrive ? 1.35 : 1.0) *
        (state.mode === 'climax_hold' ? state.climaxThrobScale : 1.0);

      const w = cellW * scale;
      const h = cellH * scale;
      const colors = getLedColors(state.mode, val || 1);
      const baseAlpha = isTrailOnly
        ? Math.max(0.12, (trailRem / VISOR_TRAIL_DURATION_SEC) * 0.65)
        : 1;

      ctx.setTransform(cosT, sinT, -sinT, cosT, px, py);
      // Fast outer neon halo without per-LED CPU shadowBlur
      ctx.globalAlpha = baseAlpha * (isOverdrive ? 0.42 : 0.28);
      ctx.fillStyle = isOverdrive ? '#ffffff' : colors.glow;
      const haloMult = isOverdrive ? 1.9 : 1.55;
      ctx.fillRect(-w * haloMult * 0.5, -h * haloMult * 0.5, w * haloMult, h * haloMult);

      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = isOverdrive ? '#ffffff' : colors.fill;
      ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  // Cathode scanline sweep bar during Beat 1 forward / reverse
  if (state.scanlineRow >= 0 && state.scanlineRow < VISOR_ROWS && !reducedMotion) {
    const row = state.scanlineRow;
    projectVisorCell(q, 0, row, targetW, targetH, breathOffsetNormY, SCRATCH_PT);
    const sx = SCRATCH_PT.x;
    const sy = SCRATCH_PT.y;
    projectVisorCell(
      q,
      VISOR_COLS - 1,
      row,
      targetW,
      targetH,
      breathOffsetNormY,
      SCRATCH_PT,
    );
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = Math.max(1.2, cellH * 0.7);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(SCRATCH_PT.x, SCRATCH_PT.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
