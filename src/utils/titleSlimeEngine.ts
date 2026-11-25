import { spawnSlimeSplashSpores, type TitleEmblemVfxState } from './titleEmblemVfx';

export const SLIME_REF_WIDTH = 960;
export const SLIME_REF_HEIGHT = 541;
export const SLIME_STAGE_X = 0;
export const SLIME_STAGE_Y = 54;
export const SLIME_STAGE_W = 264;
export const SLIME_STAGE_H = 420;
export const SLIME_SCRATCH_W = 264;
export const SLIME_SCRATCH_H = 420;
export const SLIME_SPLASH_NY = 0.58;
export const SLIME_GRAVITY_PX_S2 = 420;
export const SLIME_SHOCK_SPEED_MULT = 2.2;
export const SLIME_SNAP_PHASE = 0.62;
export const SLIME_DROP_MIN_R = 2.2;
export const SLIME_DROP_MAX_R = 5.4;
export const SLIME_SATELLITE_R = 1.3;
export const SLIME_SPLATTER_R = 1.9;

export interface SlimeNozzleConfig {
  id: string;
  nx: number;
  ny: number;
  splashNy: number;
  hangPx: number;
  swayAmpPx: number;
  periodSec: number;
  initialPhase: number;
  meshVertexIdx: number;
  foregroundSplash: boolean;
}

export const XENO_SLIME_NOZZLES: readonly SlimeNozzleConfig[] = [
  {
    id: 'lower_left_tentacle',
    nx: 0.029,
    ny: 0.519,
    splashNy: 0.695,
    hangPx: 22,
    swayAmpPx: 1.4,
    periodSec: 2.35,
    initialPhase: 0.12,
    meshVertexIdx: 2,
    foregroundSplash: false,
  },
  {
    id: 'mid_left_tentacle',
    nx: 0.032,
    ny: 0.331,
    splashNy: 0.482,
    hangPx: 20,
    swayAmpPx: 1.2,
    periodSec: 2.85,
    initialPhase: 0.48,
    meshVertexIdx: 1,
    foregroundSplash: false,
  },
  {
    id: 'upper_left_tentacle',
    nx: 0.079,
    ny: 0.131,
    splashNy: 0.246,
    hangPx: 18,
    swayAmpPx: 1.1,
    periodSec: 3.4,
    initialPhase: 0.76,
    meshVertexIdx: 0,
    foregroundSplash: false,
  },
  {
    id: 'lower_jaw_saliva',
    nx: 0.208,
    ny: 0.362,
    splashNy: 0.443,
    hangPx: 20,
    swayAmpPx: 0.9,
    periodSec: 2.1,
    initialPhase: 0.31,
    meshVertexIdx: 6,
    foregroundSplash: true,
  },
] as const;

export interface SlimeNozzleOffset {
  dxNorm: number;
  dyNorm: number;
}

export interface SlimeNozzle {
  nx: number;
  ny: number;
  splashNy: number;
  hangPx: number;
  swayAmpPx: number;
  meshVertexIdx: number;
  foregroundSplash: boolean;
  periodSec: number;
  phase: number;
  snappedThisCycle: boolean;
  anchorX: number;
  anchorY: number;
  bulbX: number;
  bulbY: number;
  bulbR: number;
  neckWaist: number;
  recoilOffset: number;
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
  isSplatter: boolean;
  splashY: number;
  foregroundSplash: boolean;
}

export interface SlimeSplashRing {
  active: boolean;
  x: number;
  y: number;
  age: number;
  maxLife: number;
  maxR: number;
  foreground: boolean;
}

export const SLIME_DROPLET_POOL_SIZE = 32;
export const SLIME_SPLASH_POOL_SIZE = 12;

export interface SlimeEngineState {
  timeSec: number;
  nozzles: SlimeNozzle[];
  droplets: SlimeDroplet[];
  splashes: SlimeSplashRing[];
  nextDropletCursor: number;
  nextSplashCursor: number;
  scratchCanvas: HTMLCanvasElement | null;
  scratchCtx: CanvasRenderingContext2D | null;
  scratchImageData: ImageData | null;
  stampCanvas: HTMLCanvasElement | null;
  auraCanvas: HTMLCanvasElement | null;
}

// Precompute deterministic 256-entry metaball smoothstep + 4-stop bioluminescent LUT
const METABALL_RGBA_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  const low = 0.42 * 255; // 107.1
  const high = 0.54 * 255; // 137.7
  const invSpan = 1 / (high - low);
  const invHighTop = 1 / (255 - high);

  for (let a = 0; a < 256; a++) {
    const o = a * 4;
    if (a <= low) {
      lut[o] = 0;
      lut[o + 1] = 0;
      lut[o + 2] = 0;
      lut[o + 3] = 0;
      continue;
    }

    if (a < high) {
      const t = (a - low) * invSpan;
      const smooth = t * t * (3 - 2 * t);
      lut[o] = Math.round(54 + (77 - 54) * smooth); // #365314 -> #4d7c0f crisp meniscus
      lut[o + 1] = Math.round(83 + (124 - 83) * smooth);
      lut[o + 2] = Math.round(20 + (15 - 20) * smooth);
      lut[o + 3] = Math.round(smooth * 255);
      continue;
    }

    const u = Math.min(1, (a - high) * invHighTop);
    let r: number;
    let g: number;
    let b: number;
    if (u < 0.26) {
      // #4d7c0f -> #84cc16
      const k = u / 0.26;
      r = 77 + (132 - 77) * k;
      g = 124 + (204 - 124) * k;
      b = 15 + (22 - 15) * k;
    } else if (u < 0.72) {
      // #84cc16 -> #bef264
      const k = (u - 0.26) / 0.46;
      r = 132 + (190 - 132) * k;
      g = 204 + (242 - 204) * k;
      b = 22 + (100 - 22) * k;
    } else {
      // #bef264 -> #ecfccb hot luminous acid core
      const k = (u - 0.72) / 0.28;
      r = 190 + (236 - 190) * k;
      g = 242 + (252 - 242) * k;
      b = 100 + (203 - 100) * k;
    }

    lut[o] = Math.round(r);
    lut[o + 1] = Math.round(g);
    lut[o + 2] = Math.round(b);
    lut[o + 3] = 255;
  }

  return lut;
})();

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
    isSplatter: false,
    splashY: SLIME_SPLASH_NY * SLIME_REF_HEIGHT,
    foregroundSplash: false,
  };
}

function createEmptySplash(): SlimeSplashRing {
  return {
    active: false,
    x: 0,
    y: 0,
    age: 0,
    maxLife: 0.3,
    maxR: 12,
    foreground: false,
  };
}

export function createSlimeEngineState(): SlimeEngineState {
  const nozzles: SlimeNozzle[] = XENO_SLIME_NOZZLES.map((cfg) => {
    const x0 = cfg.nx * SLIME_REF_WIDTH;
    const y0 = cfg.ny * SLIME_REF_HEIGHT;
    return {
      nx: cfg.nx,
      ny: cfg.ny,
      splashNy: cfg.splashNy,
      hangPx: cfg.hangPx,
      swayAmpPx: cfg.swayAmpPx,
      meshVertexIdx: cfg.meshVertexIdx,
      foregroundSplash: cfg.foregroundSplash,
      periodSec: cfg.periodSec,
      phase: cfg.initialPhase,
      snappedThisCycle: cfg.initialPhase >= SLIME_SNAP_PHASE,
      anchorX: x0,
      anchorY: y0,
      bulbX: x0,
      bulbY: y0,
      bulbR: SLIME_DROP_MIN_R,
      neckWaist: SLIME_DROP_MIN_R,
      recoilOffset: 0,
    };
  });

  const droplets: SlimeDroplet[] = new Array(SLIME_DROPLET_POOL_SIZE);
  for (let i = 0; i < SLIME_DROPLET_POOL_SIZE; i++) {
    droplets[i] = createEmptyDroplet();
  }

  const splashes: SlimeSplashRing[] = new Array(SLIME_SPLASH_POOL_SIZE);
  for (let i = 0; i < SLIME_SPLASH_POOL_SIZE; i++) {
    splashes[i] = createEmptySplash();
  }

  return {
    timeSec: 0,
    nozzles,
    droplets,
    splashes,
    nextDropletCursor: 0,
    nextSplashCursor: 0,
    scratchCanvas: null,
    scratchCtx: null,
    scratchImageData: null,
    stampCanvas: null,
    auraCanvas: null,
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

function claimSplashSlot(state: SlimeEngineState): SlimeSplashRing {
  for (let i = 0; i < SLIME_SPLASH_POOL_SIZE; i++) {
    const idx = (state.nextSplashCursor + i) % SLIME_SPLASH_POOL_SIZE;
    if (!state.splashes[idx].active) {
      state.nextSplashCursor = (idx + 1) % SLIME_SPLASH_POOL_SIZE;
      return state.splashes[idx];
    }
  }
  const slot = state.splashes[state.nextSplashCursor];
  state.nextSplashCursor = (state.nextSplashCursor + 1) % SLIME_SPLASH_POOL_SIZE;
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
 * Advances all four staggered Xeno Slime nozzles, elastic snap recoil, capillary satellites,
 * gravity teardrop freefall, splash rebound splatters, and bio_left spore emission.
 */
export function stepSlimeEngine(
  state: SlimeEngineState,
  vfxState: TitleEmblemVfxState,
  rawDt: number,
  isXenoShocked: boolean,
  reducedMotion = false,
  nozzleOffsets?: readonly SlimeNozzleOffset[],
): void {
  if (reducedMotion) return;

  const dt = Math.max(0, Math.min(0.05, Number.isFinite(rawDt) ? rawDt : 0));
  if (dt <= 0) return;

  const effDt = dt * (isXenoShocked ? SLIME_SHOCK_SPEED_MULT : 1);
  state.timeSec += effDt;

  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const prevPhase = n.phase;
    n.phase += effDt / n.periodSec;
    if (n.phase >= 1) {
      n.phase -= Math.floor(n.phase);
      n.snappedThisCycle = false;
    }

    const offset = nozzleOffsets?.[i];
    const dxOff = offset ? offset.dxNorm * SLIME_REF_WIDTH : 0;
    const dyOff = offset ? offset.dyNorm * SLIME_REF_HEIGHT : 0;
    const x0 = n.nx * SLIME_REF_WIDTH + dxOff;
    const y0 = n.ny * SLIME_REF_HEIGHT + dyOff;
    n.anchorX = x0;
    n.anchorY = y0;

    const swayX = Math.sin(state.timeSec * 2.4 + i * 1.7) * n.swayAmpPx;
    const targetSplashY =
      (n.splashNy + (offset ? offset.dyNorm * 0.35 : 0)) * SLIME_REF_HEIGHT;

    if (n.phase <= SLIME_SNAP_PHASE) {
      const u = n.phase / SLIME_SNAP_PHASE;
      const dy = n.hangPx * (0.18 * u + 0.82 * Math.pow(u, 2.35));
      const r = SLIME_DROP_MIN_R + (SLIME_DROP_MAX_R - SLIME_DROP_MIN_R) * Math.pow(u, 0.88);
      n.bulbX = x0 + swayX * u;
      n.bulbY = y0 + dy;
      n.bulbR = r;
      n.neckWaist = r * Math.max(0.11, 1 - Math.pow(u, 2.2));
      n.recoilOffset = 0;
    } else {
      if (!n.snappedThisCycle && prevPhase <= SLIME_SNAP_PHASE) {
        n.snappedThisCycle = true;
        // Primary detached teardrop
        const mainDrop = claimDropletSlot(state);
        mainDrop.active = true;
        mainDrop.x = x0 + swayX;
        mainDrop.y = y0 + n.hangPx;
        mainDrop.vx = swayX * 1.4;
        mainDrop.vy = 36;
        mainDrop.radius = SLIME_DROP_MAX_R;
        mainDrop.scaleX = 1;
        mainDrop.scaleY = 1;
        mainDrop.isSatellite = false;
        mainDrop.isSplatter = false;
        mainDrop.splashY = targetSplashY;
        mainDrop.foregroundSplash = n.foregroundSplash;

        // 1-2 micro-satellite beads along the snapped capillary filament
        const satCount = (i & 1) === 0 ? 2 : 1;
        for (let s = 0; s < satCount; s++) {
          const sat = claimDropletSlot(state);
          sat.active = true;
          sat.x = x0 + swayX * 0.55 + (s === 0 ? -1.1 : 1.1);
          sat.y = y0 + n.hangPx * (0.44 + s * 0.18);
          sat.vx = s === 0 ? -5.5 : 5.5;
          sat.vy = 16 + s * 11;
          sat.radius = SLIME_SATELLITE_R;
          sat.scaleX = 1;
          sat.scaleY = 1;
          sat.isSatellite = true;
          sat.isSplatter = false;
          sat.splashY = targetSplashY;
          sat.foregroundSplash = n.foregroundSplash;
        }
      }

      // Elastic meniscus recoil with damped oscillation after snap
      const recU = Math.min(1, (n.phase - SLIME_SNAP_PHASE) / (1 - SLIME_SNAP_PHASE));
      const spring = Math.exp(-5.8 * recU) * Math.cos(recU * Math.PI * 3.4);
      const recoilY = (1 - recU) * 4.2 * spring;
      n.recoilOffset = recoilY;
      n.bulbX = x0 + swayX * (1 - recU) * 0.35;
      n.bulbY = y0 + Math.max(-0.8, recoilY);
      n.bulbR =
        SLIME_DROP_MIN_R * (0.68 + 0.32 * recU + Math.max(0, -spring) * 0.18 * (1 - recU));
      n.neckWaist = n.bulbR * 0.88;
    }
  }

  // Advance freefalling droplets, satellites, and impact splatter beads under gravity
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active) continue;

    d.vy += SLIME_GRAVITY_PX_S2 * effDt;
    d.x += d.vx * effDt;
    d.y += d.vy * effDt;

    const stretch = computeDropletStretch(d.vy);
    d.scaleX = stretch.scaleX;
    d.scaleY = stretch.scaleY;

    if (d.y >= d.splashY) {
      d.active = false;
      if (!d.isSatellite && !d.isSplatter) {
        const hitNormX = d.x / SLIME_REF_WIDTH;
        const hitNormY = Math.min(0.95, d.splashY / SLIME_REF_HEIGHT);
        spawnSlimeSplashSpores(vfxState, hitNormX, hitNormY);

        const splash = claimSplashSlot(state);
        splash.active = true;
        splash.x = d.x;
        splash.y = d.splashY;
        splash.age = 0;
        splash.maxLife = d.foregroundSplash ? 0.38 : 0.3;
        splash.maxR = d.foregroundSplash ? 17 : 13;
        splash.foreground = d.foregroundSplash;

        // Rebound crown micro-splatter droplets arcing sideways & upward
        for (let k = 0; k < 2; k++) {
          const dir = k === 0 ? -1 : 1;
          const splat = claimDropletSlot(state);
          splat.active = true;
          splat.x = d.x + dir * 2.2;
          splat.y = d.splashY - 1.5;
          splat.vx = dir * (32 + (i % 3) * 10);
          splat.vy = -82 - k * 18;
          splat.radius = SLIME_SPLATTER_R;
          splat.scaleX = 1;
          splat.scaleY = 1;
          splat.isSatellite = false;
          splat.isSplatter = true;
          splat.splashY = d.splashY + 3.5;
          splat.foregroundSplash = d.foregroundSplash;
        }
      }
    }
  }

  for (let i = 0; i < state.splashes.length; i++) {
    const sp = state.splashes[i];
    if (!sp.active) continue;
    sp.age += effDt;
    if (sp.age >= sp.maxLife) {
      sp.active = false;
    }
  }
}

/**
 * Deterministic in-place smoothstep alpha thresholding (alpha in [0.42, 0.54])
 * and 4-stop bioluminescent acid shading via a precomputed 256-entry RGBA LUT.
 */
export function applyMetaballSmoothstepThreshold(data: Uint8ClampedArray): void {
  const lut = METABALL_RGBA_LUT;
  for (let i = 0; i < data.length; i += 4) {
    const o = data[i + 3] << 2;
    data[i] = lut[o];
    data[i + 1] = lut[o + 1];
    data[i + 2] = lut[o + 2];
    data[i + 3] = lut[o + 3];
  }
}

function buildDensityStampCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  const d = img.data;
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y++) {
    const ny = (y - half) / half;
    for (let x = 0; x < size; x++) {
      const nx = (x - half) / half;
      const r2 = nx * nx + ny * ny;
      const o = (y * size + x) * 4;
      if (r2 >= 1) {
        d[o] = 0;
        d[o + 1] = 0;
        d[o + 2] = 0;
        d[o + 3] = 0;
      } else {
        // C1-smooth cubic-squared falloff (zero center spike & zero outer ring)
        const f = 1 - r2;
        d[o] = 255;
        d[o + 1] = 255;
        d[o + 2] = 255;
        d[o + 3] = Math.round(f * f * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildAuraStampCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0, 'rgba(190, 242, 100, 0.72)');
  grad.addColorStop(0.42, 'rgba(132, 204, 22, 0.34)');
  grad.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function drawSoftRadialBlob(
  ctx: CanvasRenderingContext2D,
  stamp: HTMLCanvasElement,
  sx: number,
  sy: number,
  srx: number,
  sry: number,
): void {
  const rx = Math.max(0.8, srx);
  const ry = Math.max(0.8, sry);
  ctx.drawImage(stamp, sx - rx, sy - ry, rx * 2, ry * 2);
}

function ensureSlimeScratch(state: SlimeEngineState): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  stamp: HTMLCanvasElement;
  aura: HTMLCanvasElement;
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
  if (!state.stampCanvas) {
    state.stampCanvas = buildDensityStampCanvas();
  }
  if (!state.auraCanvas) {
    state.auraCanvas = buildAuraStampCanvas();
  }
  if (!state.scratchCtx || !state.scratchImageData || !state.stampCanvas || !state.auraCanvas) {
    return null;
  }
  return {
    canvas: state.scratchCanvas,
    ctx: state.scratchCtx,
    imageData: state.scratchImageData,
    stamp: state.stampCanvas,
    aura: state.auraCanvas,
  };
}

/**
 * Renders the crisp 1x metaball Xeno Slime layer onto the 264x420 scratch buffer,
 * runs deterministic LUT smoothstep thresholding + 4-stop bioluminescent shading,
 * adds clipped glossy specular highlights, and composites behind Plane 0.
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

  const { canvas: sc, ctx: sctx, imageData, stamp, aura } = scratch;
  const toScratchX = (refX: number) => ((refX - SLIME_STAGE_X) / SLIME_STAGE_W) * SLIME_SCRATCH_W;
  const toScratchY = (refY: number) => ((refY - SLIME_STAGE_Y) / SLIME_STAGE_H) * SLIME_SCRATCH_H;
  const scaleR = SLIME_SCRATCH_W / SLIME_STAGE_W; // 1.0x
  // With (1 - r^2)^2 stamp, alpha=0.54 contour sits at d=0.515 -> draw radius = visualRadius / 0.54
  const fieldMult = 1.85;

  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);

  // 1. Soft density accumulation pass using pre-baked C1 stamp
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const sx0 = toScratchX(n.anchorX);
    const sy0 = toScratchY(n.anchorY);
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sbr = n.bulbR * scaleR * fieldMult;

    // Wide anchor meniscus hugging tentacle / tooth tip
    drawSoftRadialBlob(sctx, stamp, sx0, sy0, 5.0 * scaleR * fieldMult, 3.5 * scaleR * fieldMult);

    // Smooth catenary tapered filament during Phase A
    if (n.phase <= SLIME_SNAP_PHASE) {
      const steps = 9;
      for (let k = 1; k < steps; k++) {
        const u = k / steps;
        const cx = sx0 + (sbx - sx0) * (u * u);
        const cy = sy0 + (sby - sy0) * u;
        // Concave neck pinching sharpest near u ~ 0.72 just above the heavy bulb
        const pinchEnv = Math.exp(-Math.pow((u - 0.72) / 0.26, 2));
        const rootFlare = (1 - u) * (1 - u) * 1.4;
        const waistPx = Math.max(
          0.9,
          n.neckWaist * (1 - 0.32 * pinchEnv) + (n.bulbR - n.neckWaist) * 0.35 * rootFlare,
        );
        const wsr = waistPx * scaleR * fieldMult;
        drawSoftRadialBlob(sctx, stamp, cx, cy, wsr, wsr * 1.18);
      }
    }

    // Pear-shaped heavy bulb (upper shoulder + lower sag lobe)
    drawSoftRadialBlob(sctx, stamp, sbx, sby - sbr * 0.24, sbr * 0.72, sbr * 0.78);
    drawSoftRadialBlob(sctx, stamp, sbx, sby, sbr, sbr * 1.12);
  }

  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || (d.isSplatter && d.foregroundSplash)) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR * fieldMult;

    if (!d.isSatellite && !d.isSplatter) {
      // Aerodynamic teardrop tail + plump leading drop head merged in metaball field
      const rx = sr * d.scaleX;
      const ry = sr * d.scaleY;
      drawSoftRadialBlob(sctx, stamp, sdx, sdy - ry * 0.48, rx * 0.56, ry * 0.78);
      drawSoftRadialBlob(sctx, stamp, sdx, sdy, rx, ry);
    } else {
      drawSoftRadialBlob(sctx, stamp, sdx, sdy, sr * d.scaleX, sr * d.scaleY);
    }
  }

  // Background impact splatter puddles on tentacle ridges
  for (let i = 0; i < state.splashes.length; i++) {
    const sp = state.splashes[i];
    if (!sp.active || sp.foreground) continue;
    const u = sp.age / Math.max(0.01, sp.maxLife);
    const ease = 1 - Math.pow(1 - u, 2);
    const fade = Math.max(0, 1 - u);
    const sx = toScratchX(sp.x);
    const sy = toScratchY(sp.y);
    drawSoftRadialBlob(
      sctx,
      stamp,
      sx,
      sy,
      Math.max(1.5, sp.maxR * 0.55 * ease * fade * scaleR * fieldMult),
      Math.max(1.2, 2.2 * fade * scaleR * fieldMult),
    );
  }

  // 2. Deterministic smoothstep LUT thresholding & 4-stop bioluminescent acid shading
  const readData = sctx.getImageData(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);
  imageData.data.set(readData.data);
  applyMetaballSmoothstepThreshold(imageData.data);
  sctx.putImageData(imageData, 0, 0);

  // 3. Clipped glossy wet specular highlights inside the metaball silhouette
  sctx.save();
  sctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sr = n.bulbR * scaleR;
    if (sr >= 1.5) {
      sctx.fillStyle = 'rgba(247, 254, 231, 0.92)';
      sctx.beginPath();
      sctx.ellipse(
        sbx - 0.34 * sr,
        sby - 0.32 * sr,
        Math.max(0.7, sr * 0.24),
        Math.max(1.0, sr * 0.42),
        -0.32,
        0,
        Math.PI * 2,
      );
      sctx.fill();

      sctx.fillStyle = 'rgba(217, 249, 157, 0.45)';
      sctx.beginPath();
      sctx.arc(sbx + 0.28 * sr, sby + 0.36 * sr, Math.max(0.5, sr * 0.16), 0, Math.PI * 2);
      sctx.fill();
    }
  }
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || d.isSatellite || (d.isSplatter && d.foregroundSplash)) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR;
    sctx.fillStyle = 'rgba(247, 254, 231, 0.94)';
    sctx.beginPath();
    sctx.ellipse(
      sdx - 0.32 * sr * d.scaleX,
      sdy - 0.34 * sr * d.scaleY,
      Math.max(0.65, sr * 0.22 * d.scaleX),
      Math.max(0.95, sr * 0.44 * d.scaleY),
      -0.2,
      0,
      Math.PI * 2,
    );
    sctx.fill();
  }
  sctx.restore();

  // 4. Composite onto unified offscreen buffer behind Plane 0 with soft additive lime aura
  const scaleX = targetW / SLIME_REF_WIDTH;
  const scaleY = targetH / SLIME_REF_HEIGHT;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.34;
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const r = Math.max(6, n.bulbR * 2.5) * scaleX;
    ctx.drawImage(aura, n.bulbX * scaleX - r, n.bulbY * scaleY - r, r * 2, r * 2);
  }
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || (d.isSplatter && d.foregroundSplash)) continue;
    const r = d.radius * 2.45 * scaleX;
    ctx.drawImage(aura, d.x * scaleX - r, d.y * scaleY - r, r * 2, r * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    sc,
    SLIME_STAGE_X * scaleX,
    SLIME_STAGE_Y * scaleY,
    SLIME_STAGE_W * scaleX,
    SLIME_STAGE_H * scaleY,
  );
  ctx.restore();
}

/**
 * Renders foreground slime impact crowns & rebound splatter beads on top of Plane 0
 * (e.g. Xeno jaw saliva splashing visibly off the top chrome bevel of NEON).
 */
export function renderSlimeForegroundSplashes(
  ctx: CanvasRenderingContext2D,
  state: SlimeEngineState,
  targetW: number,
  targetH: number,
  reducedMotion = false,
): void {
  if (reducedMotion) return;

  const scaleX = targetW / SLIME_REF_WIDTH;
  const scaleY = targetH / SLIME_REF_HEIGHT;
  const aura = state.auraCanvas ?? (state.auraCanvas = buildAuraStampCanvas());

  for (let i = 0; i < state.splashes.length; i++) {
    const sp = state.splashes[i];
    if (!sp.active || !sp.foreground) continue;
    const u = sp.age / Math.max(0.01, sp.maxLife);
    const ease = 1 - Math.pow(1 - u, 2.2);
    const alpha = Math.max(0, 1 - u * u);
    const px = sp.x * scaleX;
    const py = sp.y * scaleY;
    const rx = (2.5 + sp.maxR * ease) * scaleX;
    const ry = Math.max(1.5, rx * 0.34);

    if (aura) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.55;
      const ar = rx * 1.45;
      ctx.drawImage(aura, px - ar, py - ar, ar * 2, ar * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = '#a3e635';
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = Math.max(1, 1.1 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#bef264';
    ctx.lineWidth = Math.max(1, 1.4 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    ctx.fillStyle = '#f7fee7';
    ctx.beginPath();
    ctx.ellipse(px - rx * 0.18, py - ry * 0.15, rx * 0.25, ry * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || !d.isSplatter || !d.foregroundSplash) continue;
    const px = d.x * scaleX;
    const py = d.y * scaleY;
    const rx = d.radius * d.scaleX * scaleX;
    const ry = d.radius * d.scaleY * scaleY;

    if (aura) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.42;
      const ar = Math.max(rx, ry) * 2.4;
      ctx.drawImage(aura, px - ar, py - ar, ar * 2, ar * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#a3e635';
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = Math.max(0.8, 0.9 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f7fee7';
    ctx.beginPath();
    ctx.arc(px - rx * 0.3, py - ry * 0.3, Math.max(0.55, rx * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
