import { spawnSlimeSplashSpores, type TitleEmblemVfxState } from './titleEmblemVfx';

export const SLIME_REF_WIDTH = 960;
export const SLIME_REF_HEIGHT = 541;
export const SLIME_SCRATCH_W = 140;
export const SLIME_SCRATCH_H = 220;
export const SLIME_STAGE_X = 0;
export const SLIME_STAGE_Y = 60;
export const SLIME_STAGE_W = 280;
export const SLIME_STAGE_H = 440;
export const SLIME_SPLASH_NY = 0.58;
export const SLIME_GRAVITY_PX_S2 = 420;
export const SLIME_SHOCK_SPEED_MULT = 2.2;
export const SLIME_SNAP_PHASE = 0.62;
export const SLIME_DROP_MIN_R = 2.2;
export const SLIME_DROP_MAX_R = 5.4;
export const SLIME_SATELLITE_R = 1.3;

export interface SlimeNozzleConfig {
  id: string;
  nx: number;
  ny: number;
  periodSec: number;
  initialPhase: number;
}

export const XENO_SLIME_NOZZLES: readonly SlimeNozzleConfig[] = [
  { id: 'lower_left_tentacle', nx: 0.031, ny: 0.515, periodSec: 2.35, initialPhase: 0.12 },
  { id: 'mid_left_tentacle', nx: 0.033, ny: 0.348, periodSec: 2.85, initialPhase: 0.48 },
  { id: 'upper_left_tentacle', nx: 0.075, ny: 0.128, periodSec: 3.4, initialPhase: 0.76 },
  { id: 'lower_jaw_saliva', nx: 0.21, ny: 0.315, periodSec: 2.1, initialPhase: 0.31 },
] as const;

export interface SlimeNozzle {
  nx: number;
  ny: number;
  periodSec: number;
  phase: number;
  snappedThisCycle: boolean;
  bulbX: number;
  bulbY: number;
  bulbR: number;
  neckWaist: number;
}

export interface SlimeDroplet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  isSatellite: boolean;
}

export const SLIME_DROPLET_POOL_SIZE = 24;

export interface SlimeEngineState {
  nozzles: SlimeNozzle[];
  droplets: SlimeDroplet[];
  nextDropletCursor: number;
  scratchCanvas: HTMLCanvasElement | null;
  scratchCtx: CanvasRenderingContext2D | null;
  scratchImageData: ImageData | null;
}

function createEmptyDroplet(): SlimeDroplet {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: SLIME_DROP_MIN_R,
    scaleX: 1,
    scaleY: 1,
    isSatellite: false,
  };
}

export function createSlimeEngineState(): SlimeEngineState {
  const nozzles: SlimeNozzle[] = XENO_SLIME_NOZZLES.map((cfg) => {
    const x0 = cfg.nx * SLIME_REF_WIDTH;
    const y0 = cfg.ny * SLIME_REF_HEIGHT;
    return {
      nx: cfg.nx,
      ny: cfg.ny,
      periodSec: cfg.periodSec,
      phase: cfg.initialPhase,
      snappedThisCycle: cfg.initialPhase >= SLIME_SNAP_PHASE,
      bulbX: x0,
      bulbY: y0,
      bulbR: SLIME_DROP_MIN_R,
      neckWaist: SLIME_DROP_MIN_R,
    };
  });

  const droplets: SlimeDroplet[] = new Array(SLIME_DROPLET_POOL_SIZE);
  for (let i = 0; i < SLIME_DROPLET_POOL_SIZE; i++) {
    droplets[i] = createEmptyDroplet();
  }

  return {
    nozzles,
    droplets,
    nextDropletCursor: 0,
    scratchCanvas: null,
    scratchCtx: null,
    scratchImageData: null,
  };
}

function claimDropletSlot(state: SlimeEngineState): SlimeDroplet {
  for (let i = 0; i < SLIME_DROPLET_POOL_SIZE; i++) {
    const idx = (state.nextDropletCursor + i) % SLIME_DROPLET_POOL_SIZE;
    if (!state.droplets[idx].active) {
      state.nextDropletCursor = (idx + 1) % SLIME_DROPLET_POOL_SIZE;
      return state.droplets[idx];
    }
  }
  const slot = state.droplets[state.nextDropletCursor];
  state.nextDropletCursor = (state.nextDropletCursor + 1) % SLIME_DROPLET_POOL_SIZE;
  return slot;
}

/**
 * Computes axisymmetric volume-preserving stretch factors for a falling droplet.
 * Guarantees scaleX^2 * scaleY === 1.
 */
export function computeDropletStretch(velocityY: number): {
  scaleX: number;
  scaleY: number;
} {
  const vy = Math.max(0, velocityY);
  const scaleY = 1 + Math.min(0.65, vy / 240);
  const scaleX = 1 / Math.sqrt(scaleY);
  return { scaleX, scaleY };
}

/**
 * Advances all four staggered Xeno Slime nozzles, capillary snap satellites,
 * gravity freefall, and splash emission into the bio_left particle pool.
 */
export function stepSlimeEngine(
  state: SlimeEngineState,
  vfxState: TitleEmblemVfxState,
  rawDt: number,
  isXenoShocked: boolean,
  reducedMotion = false,
): void {
  if (reducedMotion) return;

  const dt = Math.max(0, Math.min(0.05, Number.isFinite(rawDt) ? rawDt : 0));
  if (dt <= 0) return;

  const effDt = dt * (isXenoShocked ? SLIME_SHOCK_SPEED_MULT : 1);

  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const prevPhase = n.phase;
    n.phase += effDt / n.periodSec;
    if (n.phase >= 1) {
      n.phase -= Math.floor(n.phase);
      n.snappedThisCycle = false;
    }

    const x0 = n.nx * SLIME_REF_WIDTH;
    const y0 = n.ny * SLIME_REF_HEIGHT;

    if (n.phase <= SLIME_SNAP_PHASE) {
      const u = n.phase / SLIME_SNAP_PHASE;
      const dy = 11 * u * u;
      const r = SLIME_DROP_MIN_R + (SLIME_DROP_MAX_R - SLIME_DROP_MIN_R) * u;
      n.bulbX = x0;
      n.bulbY = y0 + dy;
      n.bulbR = r;
      n.neckWaist = r * Math.max(0.12, 1 - Math.pow(u, 2.4));
    } else {
      if (!n.snappedThisCycle && prevPhase <= SLIME_SNAP_PHASE) {
        n.snappedThisCycle = true;
        // Primary detached droplet
        const mainDrop = claimDropletSlot(state);
        mainDrop.active = true;
        mainDrop.x = x0;
        mainDrop.y = y0 + 11;
        mainDrop.vx = 0;
        mainDrop.vy = 28;
        mainDrop.radius = SLIME_DROP_MAX_R;
        mainDrop.scaleX = 1;
        mainDrop.scaleY = 1;
        mainDrop.isSatellite = false;

        // 1-2 micro-satellite beads at the snapped neck midpoint
        const satCount = (i & 1) === 0 ? 2 : 1;
        for (let s = 0; s < satCount; s++) {
          const sat = claimDropletSlot(state);
          sat.active = true;
          sat.x = x0 + (s === 0 ? -0.9 : 0.9);
          sat.y = y0 + 5.5 + s * 2.2;
          sat.vx = s === 0 ? -4 : 4;
          sat.vy = 14 + s * 10;
          sat.radius = SLIME_SATELLITE_R;
          sat.scaleX = 1;
          sat.scaleY = 1;
          sat.isSatellite = true;
        }
      }

      // Residual retracted nozzle bead
      const recU = Math.min(1, (n.phase - SLIME_SNAP_PHASE) / (1 - SLIME_SNAP_PHASE));
      n.bulbX = x0;
      n.bulbY = y0 + (1 - recU) * 1.5;
      n.bulbR = SLIME_DROP_MIN_R * (0.75 + 0.25 * recU);
      n.neckWaist = n.bulbR * 0.85;
    }
  }

  // Advance freefalling droplets & satellite beads under gravity
  const splashY = SLIME_SPLASH_NY * SLIME_REF_HEIGHT;
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active) continue;

    d.vy += SLIME_GRAVITY_PX_S2 * effDt;
    d.x += d.vx * effDt;
    d.y += d.vy * effDt;

    const stretch = computeDropletStretch(d.vy);
    d.scaleX = stretch.scaleX;
    d.scaleY = stretch.scaleY;

    if (d.y >= splashY) {
      d.active = false;
      if (!d.isSatellite) {
        spawnSlimeSplashSpores(
          vfxState,
          d.x / SLIME_REF_WIDTH,
          Math.min(SLIME_SPLASH_NY, d.y / SLIME_REF_HEIGHT),
        );
      }
    }
  }
}

/**
 * Deterministic in-place smoothstep alpha thresholding (alpha in [0.42, 0.54])
 * and 3-stop acid shading over the 140x220 (0.5x) metaball buffer.
 */
export function applyMetaballSmoothstepThreshold(data: Uint8ClampedArray): void {
  const low = 0.42 * 255; // 107.1
  const high = 0.54 * 255; // 137.7
  const invSpan = 1 / (high - low);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= low) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      continue;
    }

    let t = (a - low) * invSpan;
    if (t >= 1) t = 1;
    const smooth = t * t * (3 - 2 * t);
    const outAlpha = Math.round(smooth * 255);
    data[i + 3] = outAlpha;

    // 3-stop acid shading: #65a30d outer rim -> #a3e635..#4d7c0f interior body
    if (outAlpha < 210) {
      data[i] = 101;
      data[i + 1] = 163;
      data[i + 2] = 13;
    } else {
      const gradU = Math.min(1, (a - high) / (255 - high));
      // Blend #4d7c0f (77,124,15) -> #a3e635 (163,230,53)
      data[i] = Math.round(77 + (163 - 77) * gradU);
      data[i + 1] = Math.round(124 + (230 - 124) * gradU);
      data[i + 2] = Math.round(15 + (53 - 15) * gradU);
    }
  }
}

function drawSoftRadialBlob(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  srx: number,
  sry: number,
): void {
  const maxR = Math.max(1, Math.max(srx, sry));
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(srx / maxR, sry / maxR);
  const grad = ctx.createRadialGradient(0, 0, maxR * 0.12, 0, 0, maxR);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, maxR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ensureSlimeScratch(state: SlimeEngineState): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
} | null {
  if (typeof document === 'undefined') return null;
  if (!state.scratchCanvas) {
    const c = document.createElement('canvas');
    c.width = SLIME_SCRATCH_W;
    c.height = SLIME_SCRATCH_H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    state.scratchCanvas = c;
    state.scratchCtx = ctx;
    state.scratchImageData = ctx.createImageData(SLIME_SCRATCH_W, SLIME_SCRATCH_H);
  }
  if (!state.scratchCtx || !state.scratchImageData) return null;
  return {
    canvas: state.scratchCanvas,
    ctx: state.scratchCtx,
    imageData: state.scratchImageData,
  };
}

/**
 * Renders the metaball Xeno Slime layer onto the 140x220 (0.5x) scratch buffer,
 * runs deterministic smoothstep alpha thresholding + 3-stop acid shading,
 * and composites behind Plane 0 inside the unified offscreen composite buffer.
 */
export function renderSlimeEngine(
  ctx: CanvasRenderingContext2D,
  state: SlimeEngineState,
  targetW: number,
  targetH: number,
  reducedMotion = false,
): void {
  if (reducedMotion) return;

  const scratch = ensureSlimeScratch(state);
  if (!scratch) return;

  const { canvas: sc, ctx: sctx, imageData } = scratch;
  const toScratchX = (refX: number) => ((refX - SLIME_STAGE_X) / SLIME_STAGE_W) * SLIME_SCRATCH_W;
  const toScratchY = (refY: number) => ((refY - SLIME_STAGE_Y) / SLIME_STAGE_H) * SLIME_SCRATCH_H;
  const scaleR = SLIME_SCRATCH_W / SLIME_STAGE_W; // 0.5x

  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);

  // 1. Soft radial density pass for nozzles, tapered bezier necks, bulbs, and falling droplets
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const x0 = n.nx * SLIME_REF_WIDTH;
    const y0 = n.ny * SLIME_REF_HEIGHT;
    const sx0 = toScratchX(x0);
    const sy0 = toScratchY(y0);
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sbr = n.bulbR * scaleR * 1.45;

    // Anchor meniscus at tentacle/jaw tip
    drawSoftRadialBlob(sctx, sx0, sy0, 3.6 * scaleR * 1.35, 3.6 * scaleR * 1.35);

    // Tapered bezier neck samples during Phase A
    if (n.phase <= SLIME_SNAP_PHASE) {
      const steps = 4;
      for (let k = 1; k < steps; k++) {
        const u = k / steps;
        const ny = sy0 + (sby - sy0) * u;
        const waist = (n.neckWaist + (n.bulbR - n.neckWaist) * Math.abs(u - 0.5) * 0.8) * scaleR * 1.35;
        drawSoftRadialBlob(sctx, sx0, ny, Math.max(1.1, waist), Math.max(1.2, waist * 1.15));
      }
    }

    // Swelling bulb
    drawSoftRadialBlob(sctx, sbx, sby, sbr, sbr * 1.1);
  }

  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR * 1.42;
    drawSoftRadialBlob(sctx, sdx, sdy, sr * d.scaleX, sr * d.scaleY);
  }

  // 2. Deterministic smoothstep alpha thresholding & 3-stop acid shading
  const readData = sctx.getImageData(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);
  imageData.data.set(readData.data);
  applyMetaballSmoothstepThreshold(imageData.data);
  sctx.putImageData(imageData, 0, 0);

  // 3. Upper-left #ecfccb specular crescents on swelling bulbs & falling droplets
  sctx.save();
  sctx.fillStyle = 'rgba(236, 252, 203, 0.92)';
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sr = n.bulbR * scaleR;
    if (sr >= 1.1) {
      sctx.beginPath();
      sctx.arc(sbx - 0.35 * sr, sby - 0.35 * sr, Math.max(0.65, sr * 0.32), 0, Math.PI * 2);
      sctx.fill();
    }
  }
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || d.isSatellite) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR;
    sctx.beginPath();
    sctx.arc(
      sdx - 0.35 * sr * d.scaleX,
      sdy - 0.35 * sr * d.scaleY,
      Math.max(0.65, sr * 0.32),
      0,
      Math.PI * 2,
    );
    sctx.fill();
  }
  sctx.restore();

  // 4. Composite onto unified offscreen buffer behind Plane 0
  const scaleX = targetW / SLIME_REF_WIDTH;
  const scaleY = targetH / SLIME_REF_HEIGHT;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    sc,
    SLIME_STAGE_X * scaleX,
    SLIME_STAGE_Y * scaleY,
    SLIME_STAGE_W * scaleX,
    SLIME_STAGE_H * scaleY,
  );
  ctx.restore();
}
