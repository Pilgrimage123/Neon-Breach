import { spawnSlimeSplashSpores, type TitleEmblemVfxState } from './titleEmblemVfx';

export const SLIME_REF_WIDTH = 960;
export const SLIME_REF_HEIGHT = 541;
export const SLIME_STAGE_X = 0;
export const SLIME_STAGE_Y = 48;
export const SLIME_STAGE_W = 312;
export const SLIME_STAGE_H = 440;
export const SLIME_SCRATCH_W = 312;
export const SLIME_SCRATCH_H = 440;
export const SLIME_SPLASH_NY = 0.58;
export const SLIME_GRAVITY_PX_S2 = 430;
export const SLIME_SHOCK_SPEED_MULT = 2.2;
export const SLIME_SNAP_PHASE = 0.64;
export const SLIME_DROP_MIN_R = 2.8;
export const SLIME_DROP_MAX_R = 6.8;
export const SLIME_SATELLITE_R = 1.8;
export const SLIME_SPLATTER_R = 2.4;

export interface SlimeNozzleConfig {
  id: string;
  nx: number;
  ny: number;
  splashNy: number;
  hangPx: number;
  swayAmpPx: number;
  radiusScale: number;
  periodSec: number;
  initialPhase: number;
  meshVertexIdx: number;
  foregroundSplash: boolean;
}

/**
 * 6 anatomically calibrated Xeno Slime drip nozzles:
 * 3 left tentacle bulbs + 3 jaw/fang emitters (spawning foreground splashes & chrome oozing trickles).
 */
export const XENO_SLIME_NOZZLES: readonly SlimeNozzleConfig[] = [
  {
    id: 'lower_left_tentacle',
    nx: 0.029,
    ny: 0.514,
    splashNy: 0.78,
    hangPx: 42,
    swayAmpPx: 2.2,
    radiusScale: 1.12,
    periodSec: 2.35,
    initialPhase: 0.12,
    meshVertexIdx: 2,
    foregroundSplash: false,
  },
  {
    id: 'mid_left_tentacle',
    nx: 0.033,
    ny: 0.326,
    splashNy: 0.54,
    hangPx: 38,
    swayAmpPx: 2.0,
    radiusScale: 1.04,
    periodSec: 2.85,
    initialPhase: 0.48,
    meshVertexIdx: 1,
    foregroundSplash: false,
  },
  {
    id: 'upper_left_tentacle',
    nx: 0.080,
    ny: 0.136,
    splashNy: 0.285,
    hangPx: 30,
    swayAmpPx: 1.7,
    radiusScale: 0.94,
    periodSec: 3.35,
    initialPhase: 0.76,
    meshVertexIdx: 0,
    foregroundSplash: false,
  },
  {
    id: 'lower_jaw_saliva',
    nx: 0.208,
    ny: 0.360,
    splashNy: 0.448,
    hangPx: 31,
    swayAmpPx: 1.4,
    radiusScale: 1.04,
    periodSec: 2.15,
    initialPhase: 0.31,
    meshVertexIdx: 6,
    foregroundSplash: true,
  },
  {
    id: 'left_fang_drool',
    nx: 0.146,
    ny: 0.342,
    splashNy: 0.512,
    hangPx: 33,
    swayAmpPx: 1.5,
    radiusScale: 0.94,
    periodSec: 2.65,
    initialPhase: 0.62,
    meshVertexIdx: 7,
    foregroundSplash: true,
  },
  {
    id: 'right_fang_drool',
    nx: 0.264,
    ny: 0.336,
    splashNy: 0.452,
    hangPx: 29,
    swayAmpPx: 1.3,
    radiusScale: 0.92,
    periodSec: 3.1,
    initialPhase: 0.88,
    meshVertexIdx: 6,
    foregroundSplash: true,
  },
] as const;

export interface SlimeJawStrandConfig {
  id: string;
  topNx: number;
  topNy: number;
  botNx: number;
  botNy: number;
  baseThicknessPx: number;
  phaseOffset: number;
}

/**
 * Elastic intra-mouth drool filaments bridging Xeno's upper & lower fangs.
 */
export const XENO_JAW_STRANDS: readonly SlimeJawStrandConfig[] = [
  {
    id: 'jaw_strand_left',
    topNx: 0.175,
    topNy: 0.284,
    botNx: 0.183,
    botNy: 0.356,
    baseThicknessPx: 2.1,
    phaseOffset: 0.4,
  },
  {
    id: 'jaw_strand_right',
    topNx: 0.242,
    topNy: 0.278,
    botNx: 0.248,
    botNy: 0.354,
    baseThicknessPx: 1.85,
    phaseOffset: 2.1,
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
  radiusScale: number;
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
  whipLagX: number;
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

export interface SlimeTrickle {
  active: boolean;
  x: number;
  startY: number;
  lengthPx: number;
  maxLengthPx: number;
  widthPx: number;
  age: number;
  maxLife: number;
  driftX: number;
}

export const SLIME_DROPLET_POOL_SIZE = 48;
export const SLIME_SPLASH_POOL_SIZE = 16;
export const SLIME_TRICKLE_POOL_SIZE = 10;

export interface SlimeEngineState {
  timeSec: number;
  shockIntensity: number;
  jawOffsetDxPx: number;
  jawOffsetDyPx: number;
  nozzles: SlimeNozzle[];
  droplets: SlimeDroplet[];
  splashes: SlimeSplashRing[];
  trickles: SlimeTrickle[];
  nextDropletCursor: number;
  nextSplashCursor: number;
  nextTrickleCursor: number;
  scratchCanvas: HTMLCanvasElement | null;
  scratchCtx: CanvasRenderingContext2D | null;
  scratchImageData: ImageData | null;
  stampCanvas: HTMLCanvasElement | null;
  auraCanvas: HTMLCanvasElement | null;
}

// Precomputed 256-entry 5-stop comic-neon bio-acid LUT:
// Crisp dark emerald ink outline (#14532d -> #225418) -> saturated lime (#65a30d -> #a3e635) -> hot chartreuse core (#f7fee7)
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
      // Dark emerald cartoon-ink meniscus for crisp contrast on dark & neon backdrops
      lut[o] = Math.round(20 + (34 - 20) * smooth); // #14532d -> #225418
      lut[o + 1] = Math.round(83 + (108 - 83) * smooth);
      lut[o + 2] = Math.round(45 + (20 - 45) * smooth);
      lut[o + 3] = Math.round(smooth * 255);
      continue;
    }

    const u = Math.min(1, (a - high) * invHighTop);
    let r: number;
    let g: number;
    let b: number;
    if (u < 0.16) {
      // Crisp dark emerald rim -> rich toxic green (#226c14 -> #65a30d)
      const k = u / 0.16;
      r = 34 + (101 - 34) * k;
      g = 108 + (163 - 108) * k;
      b = 20 + (13 - 20) * k;
    } else if (u < 0.48) {
      // #65a30d -> #a3e635 vibrant neon lime
      const k = (u - 0.16) / 0.32;
      r = 101 + (163 - 101) * k;
      g = 163 + (230 - 163) * k;
      b = 13 + (53 - 13) * k;
    } else if (u < 0.80) {
      // #a3e635 -> #d9f99d luminous acid glow
      const k = (u - 0.48) / 0.32;
      r = 163 + (217 - 163) * k;
      g = 230 + (249 - 230) * k;
      b = 53 + (157 - 53) * k;
    } else {
      // #d9f99d -> #f7fee7 hot radioactive chartreuse core
      const k = (u - 0.80) / 0.20;
      r = 217 + (247 - 217) * k;
      g = 249 + (254 - 249) * k;
      b = 157 + (231 - 157) * k;
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
    maxLife: 0.35,
    maxR: 16,
    foreground: false,
  };
}

function createEmptyTrickle(): SlimeTrickle {
  return {
    active: false,
    x: 0,
    startY: 0,
    lengthPx: 0,
    maxLengthPx: 20,
    widthPx: 3.4,
    age: 0,
    maxLife: 1.7,
    driftX: 0,
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
      radiusScale: cfg.radiusScale,
      meshVertexIdx: cfg.meshVertexIdx,
      foregroundSplash: cfg.foregroundSplash,
      periodSec: cfg.periodSec,
      phase: cfg.initialPhase,
      snappedThisCycle: cfg.initialPhase >= SLIME_SNAP_PHASE,
      anchorX: x0,
      anchorY: y0,
      bulbX: x0,
      bulbY: y0,
      bulbR: SLIME_DROP_MIN_R * cfg.radiusScale,
      neckWaist: SLIME_DROP_MIN_R * cfg.radiusScale,
      recoilOffset: 0,
      whipLagX: 0,
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

  const trickles: SlimeTrickle[] = new Array(SLIME_TRICKLE_POOL_SIZE);
  for (let i = 0; i < SLIME_TRICKLE_POOL_SIZE; i++) {
    trickles[i] = createEmptyTrickle();
  }
  // Seed one active slow ooze trickle on the upper chrome bevel of NEON so foreground slime reads immediately
  trickles[0].active = true;
  trickles[0].x = 202;
  trickles[0].startY = 242;
  trickles[0].lengthPx = 15;
  trickles[0].maxLengthPx = 28;
  trickles[0].widthPx = 4.1;
  trickles[0].age = 0.55;
  trickles[0].maxLife = 2.6;
  trickles[0].driftX = -0.9;

  return {
    timeSec: 0,
    shockIntensity: 0,
    jawOffsetDxPx: 0,
    jawOffsetDyPx: 0,
    nozzles,
    droplets,
    splashes,
    trickles,
    nextDropletCursor: 0,
    nextSplashCursor: 0,
    nextTrickleCursor: 0,
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

function claimTrickleSlot(state: SlimeEngineState): SlimeTrickle {
  for (let i = 0; i < SLIME_TRICKLE_POOL_SIZE; i++) {
    const idx = (state.nextTrickleCursor + i) % SLIME_TRICKLE_POOL_SIZE;
    if (!state.trickles[idx].active) {
      state.nextTrickleCursor = (idx + 1) % SLIME_TRICKLE_POOL_SIZE;
      return state.trickles[idx];
    }
  }
  const slot = state.trickles[state.nextTrickleCursor];
  state.nextTrickleCursor = (state.nextTrickleCursor + 1) % SLIME_TRICKLE_POOL_SIZE;
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
 * Advances all 6 staggered Xeno Slime nozzles, elastic snap recoil, Plateau-Rayleigh
 * capillary satellites, gravity teardrop freefall, lateral whip inertia, foreground
 * splash crowns + chrome-bevel oozing trickles, and bio_left spore emission.
 */
export function stepSlimeEngine(
  state: SlimeEngineState,
  vfxState: TitleEmblemVfxState,
  rawDt: number,
  isXenoShocked: boolean,
  reducedMotion = false,
  nozzleOffsets?: readonly SlimeNozzleOffset[],
  lateralWhipPx = 0,
): void {
  if (reducedMotion) return;

  const dt = Math.max(0, Math.min(0.05, Number.isFinite(rawDt) ? rawDt : 0));
  if (dt <= 0) return;

  const effDt = dt * (isXenoShocked ? SLIME_SHOCK_SPEED_MULT : 1);
  state.timeSec += effDt;

  const targetShock = isXenoShocked ? 1 : 0;
  state.shockIntensity += (targetShock - state.shockIntensity) * Math.min(1, dt * 8);

  // Track jaw offset (nozzle index 3 = lower_jaw_saliva) for elastic intra-mouth strands
  const jawOff = nozzleOffsets?.[3];
  state.jawOffsetDxPx = jawOff ? jawOff.dxNorm * SLIME_REF_WIDTH : 0;
  state.jawOffsetDyPx = jawOff ? jawOff.dyNorm * SLIME_REF_HEIGHT : 0;

  const clampedWhip = Math.max(-14, Math.min(14, Number.isFinite(lateralWhipPx) ? lateralWhipPx : 0));
  const whipDamp = Math.exp(-6.5 * dt);

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

    // Smooth inertial whip lag on hanging strands when user clicks or Xeno shakes
    n.whipLagX = n.whipLagX * whipDamp + clampedWhip * (1 - whipDamp) * (0.75 + (i % 3) * 0.18);

    const swayX =
      Math.sin(state.timeSec * 2.35 + i * 1.65) * n.swayAmpPx +
      n.whipLagX;
    const targetSplashY =
      (n.splashNy + (offset ? offset.dyNorm * 0.35 : 0)) * SLIME_REF_HEIGHT;
    const minR = SLIME_DROP_MIN_R * n.radiusScale;
    const maxR = SLIME_DROP_MAX_R * n.radiusScale;

    if (n.phase <= SLIME_SNAP_PHASE) {
      const u = n.phase / SLIME_SNAP_PHASE;
      // Realistic viscous gravity creep accelerating sharply into pinch-off
      const dy = n.hangPx * (0.16 * u + 0.84 * Math.pow(u, 2.25));
      const r = minR + (maxR - minR) * Math.pow(u, 0.82);
      n.bulbX = x0 + swayX * u;
      n.bulbY = y0 + dy;
      n.bulbR = r;
      n.neckWaist = r * Math.max(0.10, 1 - Math.pow(u, 2.05));
      n.recoilOffset = 0;
    } else {
      if (!n.snappedThisCycle && prevPhase <= SLIME_SNAP_PHASE) {
        n.snappedThisCycle = true;
        // Primary detached teardrop
        const mainDrop = claimDropletSlot(state);
        mainDrop.active = true;
        mainDrop.x = x0 + swayX;
        mainDrop.y = y0 + n.hangPx;
        mainDrop.vx = swayX * 1.65 + n.whipLagX * 4.5;
        mainDrop.vy = 42;
        mainDrop.radius = maxR;
        mainDrop.scaleX = 1;
        mainDrop.scaleY = 1;
        mainDrop.isSatellite = false;
        mainDrop.isSplatter = false;
        mainDrop.splashY = targetSplashY;
        mainDrop.foregroundSplash = n.foregroundSplash;

        // 2 micro-satellite beads along the snapped Plateau-Rayleigh filament
        const satCount = 2;
        for (let s = 0; s < satCount; s++) {
          const sat = claimDropletSlot(state);
          sat.active = true;
          sat.x = x0 + swayX * (0.45 + s * 0.25) + (s === 0 ? -1.4 : 1.4);
          sat.y = y0 + n.hangPx * (0.38 + s * 0.24);
          sat.vx = (s === 0 ? -7.5 : 7.5) + n.whipLagX * 2.8;
          sat.vy = 18 + s * 14;
          sat.radius = SLIME_SATELLITE_R * (s === 0 ? 1.0 : 0.82);
          sat.scaleX = 1;
          sat.scaleY = 1;
          sat.isSatellite = true;
          sat.isSplatter = false;
          sat.splashY = targetSplashY;
          sat.foregroundSplash = n.foregroundSplash;
        }
      }

      // Elastic meniscus recoil with juicy damped oscillation after snap
      const recU = Math.min(1, (n.phase - SLIME_SNAP_PHASE) / (1 - SLIME_SNAP_PHASE));
      const spring = Math.exp(-5.4 * recU) * Math.cos(recU * Math.PI * 3.6);
      const recoilY = (1 - recU) * 6.2 * spring;
      n.recoilOffset = recoilY;
      n.bulbX = x0 + swayX * (1 - recU) * 0.4;
      n.bulbY = y0 + Math.max(-1.2, recoilY);
      n.bulbR =
        minR * (0.72 + 0.28 * recU + Math.max(0, -spring) * 0.22 * (1 - recU));
      n.neckWaist = n.bulbR * 0.86;
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
        splash.maxLife = d.foregroundSplash ? 0.46 : 0.36;
        splash.maxR = d.foregroundSplash ? 22 : 16;
        splash.foreground = d.foregroundSplash;

        // Spawn a slow glossy ooze trickle crawling down the top chrome bevel of NEON
        if (d.foregroundSplash) {
          const trickle = claimTrickleSlot(state);
          trickle.active = true;
          trickle.x = d.x;
          trickle.startY = d.splashY;
          trickle.lengthPx = 3.2;
          trickle.maxLengthPx = 22 + (i % 4) * 4.0;
          trickle.widthPx = 3.6 + (i % 2) * 1.0;
          trickle.age = 0;
          trickle.maxLife = 2.25 + (i % 3) * 0.3;
          trickle.driftX = ((i % 3) - 1) * 1.5;
        }

        // 3 rebound crown micro-splatter droplets arcing sideways & upward
        const splatCount = d.foregroundSplash ? 3 : 2;
        for (let k = 0; k < splatCount; k++) {
          const dir = k === 0 ? -1 : k === 1 ? 1 : (i & 1) === 0 ? -0.45 : 0.45;
          const splat = claimDropletSlot(state);
          splat.active = true;
          splat.x = d.x + dir * 2.8;
          splat.y = d.splashY - 2.0;
          splat.vx = dir * (38 + (i % 3) * 12);
          splat.vy = -96 - k * 20;
          splat.radius = SLIME_SPLATTER_R * (k === 2 ? 0.78 : 1.0);
          splat.scaleX = 1;
          splat.scaleY = 1;
          splat.isSatellite = false;
          splat.isSplatter = true;
          splat.splashY = d.splashY + 4.5;
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

  for (let i = 0; i < state.trickles.length; i++) {
    const tr = state.trickles[i];
    if (!tr.active) continue;
    tr.age += dt;
    if (tr.age >= tr.maxLife) {
      tr.active = false;
      continue;
    }
    const u = tr.age / tr.maxLife;
    // Fast initial ooze creep that slows as surface tension wins
    const creep = 1 - Math.pow(1 - Math.min(1, u * 1.25), 2.4);
    tr.lengthPx = 2.5 + (tr.maxLengthPx - 2.5) * creep;
  }
}

/**
 * Deterministic in-place smoothstep alpha thresholding (alpha in [0.42, 0.54])
 * and 5-stop comic-neon bio-acid shading via a precomputed 256-entry RGBA LUT.
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
  grad.addColorStop(0, 'rgba(217, 249, 157, 0.82)');
  grad.addColorStop(0.38, 'rgba(132, 204, 22, 0.42)');
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
 * Renders the crisp 1x metaball Xeno Slime layer onto the 312x440 scratch buffer,
 * including 6 nozzles, 2 elastic intra-mouth drool filaments, Plateau-Rayleigh necks,
 * 5-stop comic-neon LUT shading, glossy wet specular crescents + internal micro-bubbles,
 * and composites onto the unified offscreen logo buffer behind Plane 0.
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
  const fieldMult = 1.85;

  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);

  // 1a. Elastic intra-mouth drool strands stretched between Xeno's upper & lower fangs
  for (let i = 0; i < XENO_JAW_STRANDS.length; i++) {
    const st = XENO_JAW_STRANDS[i];
    const tx = toScratchX(st.topNx * SLIME_REF_WIDTH + state.jawOffsetDxPx * 0.45);
    const ty = toScratchY(st.topNy * SLIME_REF_HEIGHT + state.jawOffsetDyPx * 0.45);
    const bx = toScratchX(st.botNx * SLIME_REF_WIDTH + state.jawOffsetDxPx);
    const by = toScratchY(st.botNy * SLIME_REF_HEIGHT + state.jawOffsetDyPx);
    const sway =
      Math.sin(state.timeSec * 3.1 + st.phaseOffset) *
      (1.6 + state.shockIntensity * 1.4);
    const steps = 10;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const arch = 4 * u * (1 - u);
      const sx = tx + (bx - tx) * u + sway * arch;
      const sy = ty + (by - ty) * u;
      // Thick at tooth anchors, taut narrow hourglass waist in middle
      const waist = 1 - 0.56 * arch;
      const r =
        st.baseThicknessPx *
        (0.92 + 0.14 * Math.sin(state.timeSec * 2.2 + st.phaseOffset)) *
        waist *
        scaleR *
        fieldMult;
      drawSoftRadialBlob(sctx, stamp, sx, sy, r, r * 1.15);
    }
  }

  // 1b. Six nozzle menisci, Plateau-Rayleigh catenary necks, and swollen heavy bulbs
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const sx0 = toScratchX(n.anchorX);
    const sy0 = toScratchY(n.anchorY);
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sbr = n.bulbR * scaleR * fieldMult;

    // Wide sticky anchor meniscus hugging tentacle bulb / fang tip
    const rootR = 5.6 * n.radiusScale * scaleR * fieldMult;
    drawSoftRadialBlob(sctx, stamp, sx0, sy0, rootR, rootR * 0.72);

    // Smooth catenary tapered filament + Plateau-Rayleigh mid-strand bead bulge during Phase A
    if (n.phase <= SLIME_SNAP_PHASE) {
      const phaseU = n.phase / SLIME_SNAP_PHASE;
      const steps = 12;
      for (let k = 1; k < steps; k++) {
        const u = k / steps;
        const cx = sx0 + (sbx - sx0) * (u * u);
        const cy = sy0 + (sby - sy0) * u;
        const pinchEnv = Math.exp(-Math.pow((u - 0.74) / 0.22, 2));
        const rootFlare = (1 - u) * (1 - u) * 1.55;
        // Subtle Plateau-Rayleigh satellite bead forming mid-strand just before snap
        const satBulge =
          phaseU > 0.58
            ? Math.exp(-Math.pow((u - 0.44) / 0.11, 2)) * ((phaseU - 0.58) / 0.42) * 1.45
            : 0;
        const waistPx = Math.max(
          1.05,
          n.neckWaist * (1 - 0.36 * pinchEnv) +
            (n.bulbR - n.neckWaist) * 0.36 * rootFlare +
            satBulge,
        );
        const wsr = waistPx * scaleR * fieldMult;
        drawSoftRadialBlob(sctx, stamp, cx, cy, wsr, wsr * 1.2);
      }
    }

    // Plump pear-shaped hanging bulb (upper tapered shoulder + heavy gravity-sagged lobe)
    drawSoftRadialBlob(sctx, stamp, sbx, sby - sbr * 0.26, sbr * 0.74, sbr * 0.82);
    drawSoftRadialBlob(sctx, stamp, sbx, sby, sbr, sbr * 1.16);
  }

  // 1c. Freefalling aerodynamic teardrops & capillary satellites
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || (d.isSplatter && d.foregroundSplash)) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR * fieldMult;

    if (!d.isSatellite && !d.isSplatter) {
      const rx = sr * d.scaleX;
      const ry = sr * d.scaleY;
      // Tapered upper teardrop wake + bulbous lower drop head
      drawSoftRadialBlob(sctx, stamp, sdx, sdy - ry * 0.56, rx * 0.48, ry * 0.82);
      drawSoftRadialBlob(sctx, stamp, sdx, sdy, rx, ry * 1.05);
    } else {
      drawSoftRadialBlob(sctx, stamp, sdx, sdy, sr * d.scaleX, sr * d.scaleY);
    }
  }

  // 1d. Background impact splatter puddles on tentacle ridges
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
      Math.max(1.8, sp.maxR * 0.62 * ease * fade * scaleR * fieldMult),
      Math.max(1.4, 2.8 * fade * scaleR * fieldMult),
    );
  }

  // 2. Deterministic smoothstep LUT thresholding & 5-stop comic-neon acid shading
  const readData = sctx.getImageData(0, 0, SLIME_SCRATCH_W, SLIME_SCRATCH_H);
  imageData.data.set(readData.data);
  applyMetaballSmoothstepThreshold(imageData.data);
  sctx.putImageData(imageData, 0, 0);

  // 3. Clipped glossy wet specular crescents, filament glints & rising internal micro-bubbles
  sctx.save();
  sctx.globalCompositeOperation = 'source-atop';

  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const sx0 = toScratchX(n.anchorX);
    const sy0 = toScratchY(n.anchorY);
    const sbx = toScratchX(n.bulbX);
    const sby = toScratchY(n.bulbY);
    const sr = n.bulbR * scaleR;

    // Wet sheen line tracing down the left sunlit side of stretching catenary neck
    if (n.phase <= SLIME_SNAP_PHASE && sby - sy0 > 6) {
      sctx.strokeStyle = 'rgba(247, 254, 231, 0.72)';
      sctx.lineWidth = Math.max(0.9, n.neckWaist * 0.28);
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(sx0 - 1.1, sy0 + 3);
      sctx.quadraticCurveTo(
        (sx0 + sbx) * 0.5 - 1.2,
        (sy0 + sby) * 0.5,
        sbx - sr * 0.36,
        sby - sr * 0.48,
      );
      sctx.stroke();
    }

    if (sr >= 1.8) {
      // Primary crisp white-lime wet specular highlight on upper-left shoulder
      sctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      sctx.beginPath();
      sctx.ellipse(
        sbx - 0.34 * sr,
        sby - 0.30 * sr,
        Math.max(0.85, sr * 0.25),
        Math.max(1.2, sr * 0.46),
        -0.3,
        0,
        Math.PI * 2,
      );
      sctx.fill();

      // Secondary lower-right rim bounce reflection
      sctx.fillStyle = 'rgba(217, 249, 157, 0.55)';
      sctx.beginPath();
      sctx.arc(sbx + 0.3 * sr, sby + 0.38 * sr, Math.max(0.65, sr * 0.18), 0, Math.PI * 2);
      sctx.fill();

      // Tiny translucent micro-bubble slowly rising inside swollen drop
      if (n.phase <= SLIME_SNAP_PHASE && sr > 4.2) {
        const bubU = (state.timeSec * 0.85 + i * 0.37) % 1;
        const bx = sbx + Math.sin(state.timeSec * 4 + i) * sr * 0.18;
        const by = sby + (0.35 - bubU * 0.72) * sr;
        sctx.strokeStyle = 'rgba(247, 254, 231, 0.65)';
        sctx.lineWidth = 0.75;
        sctx.beginPath();
        sctx.arc(bx, by, Math.max(0.7, sr * 0.15), 0, Math.PI * 2);
        sctx.stroke();
      }
    }
  }

  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || d.isSatellite || (d.isSplatter && d.foregroundSplash)) continue;
    const sdx = toScratchX(d.x);
    const sdy = toScratchY(d.y);
    const sr = d.radius * scaleR;
    sctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    sctx.beginPath();
    sctx.ellipse(
      sdx - 0.32 * sr * d.scaleX,
      sdy - 0.32 * sr * d.scaleY,
      Math.max(0.8, sr * 0.24 * d.scaleX),
      Math.max(1.15, sr * 0.46 * d.scaleY),
      -0.2,
      0,
      Math.PI * 2,
    );
    sctx.fill();
  }
  sctx.restore();

  // 4. Composite soft bioluminescent lime aura + crisp metaball slime silhouette behind Plane 0
  const scaleX = targetW / SLIME_REF_WIDTH;
  const scaleY = targetH / SLIME_REF_HEIGHT;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.42 + state.shockIntensity * 0.16;
  for (let i = 0; i < state.nozzles.length; i++) {
    const n = state.nozzles[i];
    const r = Math.max(8, n.bulbR * 2.75) * scaleX;
    ctx.drawImage(aura, n.bulbX * scaleX - r, n.bulbY * scaleY - r, r * 2, r * 2);
  }
  for (let i = 0; i < state.droplets.length; i++) {
    const d = state.droplets[i];
    if (!d.active || (d.isSplatter && d.foregroundSplash)) continue;
    const r = d.radius * 2.65 * scaleX;
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
 * Renders foreground slime impact crowns, rebound splatter beads, and brief glossy oozing
 * trickles sliding down the top chrome bevel of NEON on top of Plane 0.
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

  // 1. Oozing chrome-bevel trickles sliding down the top metallic edge of NEON
  for (let i = 0; i < state.trickles.length; i++) {
    const tr = state.trickles[i];
    if (!tr.active) continue;
    const u = tr.age / Math.max(0.01, tr.maxLife);
    const fadeOut = u < 0.65 ? 1 : Math.max(0, 1 - (u - 0.65) / 0.35);
    if (fadeOut <= 0.02) continue;

    const x0 = tr.x * scaleX;
    const y0 = tr.startY * scaleY;
    const x1 = (tr.x + tr.driftX * u) * scaleX;
    const y1 = (tr.startY + tr.lengthPx) * scaleY;
    const wPx = tr.widthPx * scaleX * (0.75 + 0.25 * fadeOut);
    const tipR = wPx * 0.72;

    if (aura) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fadeOut * 0.36;
      const ar = tipR * 3.0;
      ctx.drawImage(aura, x1 - ar, y1 - ar, ar * 2, ar * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = fadeOut * 0.94;
    ctx.lineCap = 'round';
    // Dark emerald cartoon outline
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = wPx + 1.8 * scaleX;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, (y0 + y1) * 0.55, x1, y1);
    ctx.stroke();

    // Vibrant lime body
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = wPx;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, (y0 + y1) * 0.55, x1, y1);
    ctx.stroke();

    // Wet chartreuse specular ridge down the trickle spine
    ctx.strokeStyle = 'rgba(236, 252, 203, 0.82)';
    ctx.lineWidth = Math.max(0.8, wPx * 0.34);
    ctx.beginPath();
    ctx.moveTo(x0 - wPx * 0.16, y0 + 0.8 * scaleY);
    ctx.quadraticCurveTo(
      (x0 + x1) * 0.5 - wPx * 0.16,
      (y0 + y1) * 0.55,
      x1 - wPx * 0.16,
      y1,
    );
    ctx.stroke();

    // Bulbous leading bead at trickle tip
    ctx.fillStyle = '#bef264';
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = Math.max(0.95, 1.15 * scaleX);
    ctx.beginPath();
    ctx.ellipse(x1, y1 + tipR * 0.22, tipR * 1.08, tipR * 1.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glossy specular dot on trickle tip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x1 - tipR * 0.3, y1 - tipR * 0.15, Math.max(0.7, tipR * 0.36), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Impact splash crowns
  for (let i = 0; i < state.splashes.length; i++) {
    const sp = state.splashes[i];
    if (!sp.active || !sp.foreground) continue;
    const u = sp.age / Math.max(0.01, sp.maxLife);
    const ease = 1 - Math.pow(1 - u, 2.2);
    const alpha = Math.max(0, 1 - u * u);
    const px = sp.x * scaleX;
    const py = sp.y * scaleY;
    const rx = (3.2 + sp.maxR * ease) * scaleX;
    const ry = Math.max(2.0, rx * 0.36);

    if (aura) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.62;
      const ar = rx * 1.55;
      ctx.drawImage(aura, px - ar, py - ar, ar * 2, ar * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha * 0.94;
    ctx.fillStyle = '#a3e635';
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = Math.max(1.1, 1.3 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#d9f99d';
    ctx.lineWidth = Math.max(1.2, 1.65 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(px - rx * 0.2, py - ry * 0.16, rx * 0.26, ry * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Rebound splatter beads arcing off NEON chrome bevel
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
      ctx.globalAlpha = 0.48;
      const ar = Math.max(rx, ry) * 2.5;
      ctx.drawImage(aura, px - ar, py - ar, ar * 2, ar * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#a3e635';
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = Math.max(0.9, 1.05 * scaleX);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - rx * 0.3, py - ry * 0.3, Math.max(0.65, rx * 0.36), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
