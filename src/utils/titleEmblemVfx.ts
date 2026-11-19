export type ParticleZone =
  | 'bio_left'
  | 'ember_center'
  | 'plasma_right'
  | 'burst'
  | 'heart_kiss'
  | 'xeno_shock';

export type FloatingAccentKind =
  | 'drone_strike'
  | 'drone_med'
  | 'xeno_larva'
  | 'xeno_skitter';

export interface PooledParticle {
  active: boolean;
  zone: ParticleZone;
  /** Normalized coordinates relative to the emblem box (0..1 = emblem rect; can bleed slightly outside) */
  nx: number;
  ny: number;
  vx: number;
  vy: number;
  age: number;
  maxLife: number;
  size: number;
  color: string;
  glowColor: string;
  phase: number;
  /** 0 = soft orb/spore, 1 = elongated velocity spark streak, 2 = diamond ember, 3 = neon heart kiss */
  shape: 0 | 1 | 2 | 3;
  /** true = drawn behind emblem, false = drawn in front */
  behind: boolean;
}

export interface RimArcPoint {
  nx: number;
  ny: number;
}

export interface ElectricRimArc {
  active: boolean;
  age: number;
  maxLife: number;
  color: string;
  points: RimArcPoint[];
}

export interface ClickShockwave {
  active: boolean;
  nx: number;
  ny: number;
  age: number;
  maxLife: number;
}

export interface FloatingAccentSample {
  kind: FloatingAccentKind;
  /** Normalized position relative to emblem box (left accents < 0, right accents > 1) */
  nx: number;
  ny: number;
  /** Relative scale factor against emblem height */
  scaleOfEmblemH: number;
  tiltRad: number;
  opacity: number;
  flipX: boolean;
  /** Frame index for animated crawler sheets (0..2) or drone slot (1..2) */
  frameIndex: number;
  glowColor: string;
  /** Only shown when viewport has wide horizontal flanking room */
  wideOnly: boolean;
}

export interface LogoSequenceSample {
  /** True only while a player-triggered click animation is playing */
  active: boolean;
  /** Elapsed seconds inside the click animation timeline (0..SEQUENCE_TOTAL_SEC) */
  elapsed: number;
  /** Primary pose index (0..4) */
  frameA: number;
  /** Secondary pose index (0..4) blended over frameA during transitions */
  frameB: number;
  /** C2-continuous quintic interpolation factor (0..1) between frameA and frameB */
  blendU: number;
  /** Solidity-preserving opacity for frameA so shared opaque interior never dips below 1.0 */
  alphaA: number;
  /** Opacity for frameB layered over frameA */
  alphaB: number;
  /** Subtle horizontal comedic shock micro-shake (normalized emblem width units) */
  shakeNormX: number;
  /** Subtle vertical comedic shock micro-shake (normalized emblem height units) */
  shakeNormY: number;
  /** Narrative pose Z-tilt in degrees */
  poseTiltDeg: number;
}

export interface TitleEmblemVfxState {
  timeSec: number;
  parallaxX: number;
  parallaxY: number;
  targetParallaxX: number;
  targetParallaxY: number;
  recoil: number;
  recoilVel: number;
  /** Click-only 5-frame animation state */
  sequenceActive: boolean;
  sequenceElapsed: number;
  heartBurstEmitted: boolean;
  shockBurstEmitted: boolean;
  /** Normalized sheen sweep position (-0.4..1.4 when active, < -0.4 when cooling down) */
  sheenProgress: number;
  sheenCooldown: number;
  ambientAccumBio: number;
  ambientAccumCenter: number;
  ambientAccumPlasma: number;
  arcCooldown: number;
  nextParticleCursor: number;
  rngState: number;
  particles: PooledParticle[];
  arcs: ElectricRimArc[];
  shockwave: ClickShockwave;
}

export interface EmblemTransformSample {
  /** Subtle vertical levitation in normalized emblem height units */
  bobNormY: number;
  /** Subtle breathing scale around 1.0 */
  breathScale: number;
  /** 3D perspective tilt in degrees */
  rotateXDeg: number;
  rotateYDeg: number;
  /** Ambient aura intensity 0..1 */
  auraPulse: number;
  /** Diagonal holographic sheen progress (-0.4..1.4; active when in [-0.35, 1.35]) */
  sheenProgress: number;
  sheenActive: boolean;
  /** Current 5-frame click-triggered pose blend sample */
  sequence: LogoSequenceSample;
}

export const LOGO_FRAME_COUNT = 5;
export const EMBLEM_ASPECT = 960 / 541;
export const PARTICLE_POOL_SIZE = 128;
export const MAX_RIM_ARCS = 4;
export const MAX_VFX_DT = 0.05;

/**
 * Click-triggered 5-frame story timeline checkpoints (seconds):
 * - 0.00 -> 0.36: Frame 0 -> 1 (Kira Wink & Smiling Cat Visor)
 * - 0.36 -> 0.78: Frame 1 -> 2 (Kira Playful Smile & Xeno Right-Eye Wink)
 * - 0.78 -> 1.24: Frame 2 -> 3 (Kira Blows Neon Heart Kiss + Heart Stream)
 * - 1.24 -> 1.66: Frame 3 -> 4 (Climax: Pixel Heart Visor & Xeno Wide-Eyed !! Shock)
 * - 1.66 -> 2.06: Hold Climax Frame 4
 * - 2.06 -> 2.86: Smooth Reverse 4 -> 3 -> 2 -> 1 -> 0 back to idle Frame 0
 */
export const SEQUENCE_FORWARD_END_SEC = 1.66;
export const SEQUENCE_HOLD_END_SEC = 2.06;
export const SEQUENCE_TOTAL_SEC = 2.86;

const FORWARD_SEGMENTS: readonly { start: number; end: number; from: number; to: number }[] = [
  { start: 0.0, end: 0.36, from: 0, to: 1 },
  { start: 0.36, end: 0.78, from: 1, to: 2 },
  { start: 0.78, end: 1.24, from: 2, to: 3 },
  { start: 1.24, end: 1.66, from: 3, to: 4 },
];

const REVERSE_SEGMENTS: readonly { start: number; end: number; from: number; to: number }[] = [
  { start: 2.06, end: 2.26, from: 4, to: 3 },
  { start: 2.26, end: 2.46, from: 3, to: 2 },
  { start: 2.46, end: 2.66, from: 2, to: 1 },
  { start: 2.66, end: 2.86, from: 1, to: 0 },
];

/**
 * C2-continuous quintic easing (zero 1st and 2nd derivative jumps at segment boundaries)
 */
export function quinticEase(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Solidity-preserving cross-dissolve alpha weights.
 * Keeps frameA at 1.0 until frameB reaches 0.55 opacity so the shared logo silhouette
 * never dips to 75% opacity mid-transition, completely eliminating ghosting/flicker.
 */
export function computeSolidityAlphas(blendU: number): { alphaA: number; alphaB: number } {
  const u = Math.max(0, Math.min(1, blendU));
  if (u <= 0.0001) {
    return { alphaA: 1, alphaB: 0 };
  }
  if (u >= 0.9999) {
    return { alphaA: 0, alphaB: 1 };
  }
  const alphaA = u < 0.55 ? 1 : Math.max(0, (1 - u) / 0.45);
  return { alphaA, alphaB: u };
}

export function sampleLogoSequence(state: TitleEmblemVfxState): LogoSequenceSample {
  if (!state.sequenceActive) {
    return {
      active: false,
      elapsed: 0,
      frameA: 0,
      frameB: 0,
      blendU: 0,
      alphaA: 1,
      alphaB: 0,
      shakeNormX: 0,
      shakeNormY: 0,
      poseTiltDeg: 0,
    };
  }

  const t = Math.max(0, Math.min(SEQUENCE_TOTAL_SEC, state.sequenceElapsed));
  let frameA = 0;
  let frameB = 0;
  let blendU = 0;

  if (t < SEQUENCE_FORWARD_END_SEC) {
    for (let i = 0; i < FORWARD_SEGMENTS.length; i++) {
      const seg = FORWARD_SEGMENTS[i];
      if (t <= seg.end || i === FORWARD_SEGMENTS.length - 1) {
        const raw = (t - seg.start) / Math.max(0.001, seg.end - seg.start);
        frameA = seg.from;
        frameB = seg.to;
        blendU = quinticEase(raw);
        break;
      }
    }
  } else if (t <= SEQUENCE_HOLD_END_SEC) {
    frameA = 4;
    frameB = 4;
    blendU = 0;
  } else {
    for (let i = 0; i < REVERSE_SEGMENTS.length; i++) {
      const seg = REVERSE_SEGMENTS[i];
      if (t <= seg.end || i === REVERSE_SEGMENTS.length - 1) {
        const raw = (t - seg.start) / Math.max(0.001, seg.end - seg.start);
        frameA = seg.from;
        frameB = seg.to;
        blendU = quinticEase(raw);
        break;
      }
    }
  }

  const { alphaA, alphaB } = frameA === frameB ? { alphaA: 1, alphaB: 0 } : computeSolidityAlphas(blendU);

  // Continuous narrative pose micro-motion (smooth spring arc across the 5 beats)
  let poseTiltDeg = 0;
  let shakeNormX = 0;
  let shakeNormY = 0;

  if (t < SEQUENCE_FORWARD_END_SEC) {
    // Gentle playful tilt as Kira winks, smiles, and blows the neon heart kiss
    poseTiltDeg = Math.sin((t / SEQUENCE_FORWARD_END_SEC) * Math.PI * 2) * 1.15;
  } else if (t > SEQUENCE_HOLD_END_SEC) {
    const revU = (t - SEQUENCE_HOLD_END_SEC) / (SEQUENCE_TOTAL_SEC - SEQUENCE_HOLD_END_SEC);
    poseTiltDeg = Math.sin(revU * Math.PI) * -0.75;
  }

  // Comedic micro-shake when Xeno gets hit by the heart kiss in Frame 4 (1.28s .. 1.82s)
  if (t >= 1.28 && t <= 1.82) {
    const shockProgress = (t - 1.28) / 0.54;
    const envelope = Math.sin(shockProgress * Math.PI) * (1 - shockProgress * 0.45);
    shakeNormX = Math.sin(t * 68) * 0.0045 * envelope;
    shakeNormY = Math.cos(t * 54) * 0.0035 * envelope;
  }

  return {
    active: true,
    elapsed: t,
    frameA,
    frameB,
    blendU,
    alphaA,
    alphaB,
    shakeNormX,
    shakeNormY,
    poseTiltDeg,
  };
}

/**
 * Calibrated anchor points along the beveled hexagonal `XENO-PURGE PROTOCOL` plate
 * and lower skull medallion rim of the 960x541 logo frames.
 */
export const XENO_PURGE_BOTTOM_RIM_ANCHORS: readonly RimArcPoint[] = [
  { nx: 0.145, ny: 0.855 },
  { nx: 0.215, ny: 0.895 },
  { nx: 0.335, ny: 0.898 },
  { nx: 0.455, ny: 0.935 },
  { nx: 0.575, ny: 0.898 },
  { nx: 0.695, ny: 0.895 },
  { nx: 0.755, ny: 0.848 },
];

export const XENO_PURGE_TOP_RIM_ANCHORS: readonly RimArcPoint[] = [
  { nx: 0.175, ny: 0.788 },
  { nx: 0.295, ny: 0.782 },
  { nx: 0.455, ny: 0.778 },
  { nx: 0.615, ny: 0.782 },
  { nx: 0.725, ny: 0.788 },
];

const BIO_COLORS = ['#a3e635', '#84cc16', '#bef264', '#4ade80'] as const;
const CENTER_COLORS = ['#00f0ff', '#ff2e7e', '#ffc700', '#f472b6'] as const;
const PLASMA_COLORS = ['#ff2e7e', '#e879f9', '#00f0ff', '#ffffff'] as const;
const HEART_COLORS = ['#ff2e7e', '#ff6ec7', '#f472b6', '#e879f9'] as const;

function nextRand(state: TitleEmblemVfxState): number {
  // Deterministic fast LCG so simulation & tests are reproducible and zero-GC
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 0x100000000;
}

function randRange(state: TitleEmblemVfxState, min: number, max: number): number {
  return min + (max - min) * nextRand(state);
}

function createEmptyParticle(): PooledParticle {
  return {
    active: false,
    zone: 'ember_center',
    nx: 0.5,
    ny: 0.5,
    vx: 0,
    vy: 0,
    age: 0,
    maxLife: 1,
    size: 2,
    color: '#00f0ff',
    glowColor: '#00f0ff',
    phase: 0,
    shape: 0,
    behind: false,
  };
}

function createEmptyArc(): ElectricRimArc {
  return {
    active: false,
    age: 0,
    maxLife: 0.2,
    color: '#00f0ff',
    points: [],
  };
}

export function createTitleEmblemVfxState(seed = 20261119): TitleEmblemVfxState {
  const particles: PooledParticle[] = new Array(PARTICLE_POOL_SIZE);
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    particles[i] = createEmptyParticle();
  }
  const arcs: ElectricRimArc[] = new Array(MAX_RIM_ARCS);
  for (let i = 0; i < MAX_RIM_ARCS; i++) {
    arcs[i] = createEmptyArc();
  }

  const state: TitleEmblemVfxState = {
    timeSec: 0,
    parallaxX: 0,
    parallaxY: 0,
    targetParallaxX: 0,
    targetParallaxY: 0,
    recoil: 0,
    recoilVel: 0,
    sequenceActive: false,
    sequenceElapsed: 0,
    heartBurstEmitted: false,
    shockBurstEmitted: false,
    sheenProgress: -1,
    sheenCooldown: 1.6,
    ambientAccumBio: 0,
    ambientAccumCenter: 0,
    ambientAccumPlasma: 0,
    arcCooldown: 0.75,
    nextParticleCursor: 0,
    rngState: seed >>> 0 || 1,
    particles,
    arcs,
    shockwave: {
      active: false,
      nx: 0.5,
      ny: 0.5,
      age: 0,
      maxLife: 0.55,
    },
  };

  // Pre-seed a balanced ambient field so the very first rendered frame feels alive
  for (let i = 0; i < 16; i++) {
    const p = spawnZoneParticle(state, 'bio_left');
    p.age = randRange(state, 0.1, p.maxLife * 0.78);
  }
  for (let i = 0; i < 18; i++) {
    const p = spawnZoneParticle(state, 'ember_center');
    p.age = randRange(state, 0.1, p.maxLife * 0.78);
  }
  for (let i = 0; i < 16; i++) {
    const p = spawnZoneParticle(state, 'plasma_right');
    p.age = randRange(state, 0.1, p.maxLife * 0.78);
  }
  // Seed one active rim arc so initial frame immediately showcases the electrified badge rim
  spawnRimArc(state, 'bottom');

  return state;
}

function claimParticleSlot(state: TitleEmblemVfxState): PooledParticle {
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const idx = (state.nextParticleCursor + i) % PARTICLE_POOL_SIZE;
    if (!state.particles[idx].active) {
      state.nextParticleCursor = (idx + 1) % PARTICLE_POOL_SIZE;
      return state.particles[idx];
    }
  }
  const slot = state.particles[state.nextParticleCursor];
  state.nextParticleCursor = (state.nextParticleCursor + 1) % PARTICLE_POOL_SIZE;
  return slot;
}

export function spawnZoneParticle(
  state: TitleEmblemVfxState,
  zone: 'bio_left' | 'ember_center' | 'plasma_right',
): PooledParticle {
  const p = claimParticleSlot(state);
  p.active = true;
  p.zone = zone;
  p.age = 0;
  p.phase = randRange(state, 0, Math.PI * 2);

  if (zone === 'bio_left') {
    // Organic toxic spores drifting around the green-slime xeno creature on the left
    p.nx = randRange(state, -0.04, 0.34);
    p.ny = randRange(state, 0.08, 0.66);
    p.vx = randRange(state, -0.055, 0.015);
    p.vy = randRange(state, -0.105, -0.036);
    p.maxLife = randRange(state, 1.5, 2.9);
    p.size = randRange(state, 2.8, 6.2);
    const col = BIO_COLORS[Math.floor(nextRand(state) * BIO_COLORS.length)];
    p.color = col;
    p.glowColor = '#84cc16';
    p.shape = 0;
    p.behind = nextRand(state) < 0.35;
  } else if (zone === 'plasma_right') {
    // Crisp high-velocity plasma sparks streaming from Kira's magenta/cyan pistol & visor
    const fromMuzzle = nextRand(state) < 0.72;
    p.nx = fromMuzzle ? randRange(state, 0.84, 1.01) : randRange(state, 0.68, 0.96);
    p.ny = fromMuzzle ? randRange(state, 0.24, 0.46) : randRange(state, 0.08, 0.68);
    p.vx = fromMuzzle ? randRange(state, 0.06, 0.18) : randRange(state, -0.02, 0.09);
    p.vy = fromMuzzle ? randRange(state, -0.1, 0.045) : randRange(state, -0.13, -0.035);
    p.maxLife = randRange(state, 0.65, 1.45);
    p.size = randRange(state, 2.0, 4.2);
    const col = PLASMA_COLORS[Math.floor(nextRand(state) * PLASMA_COLORS.length)];
    p.color = col;
    p.glowColor = col === '#00f0ff' ? '#00f0ff' : '#ff2e7e';
    p.shape = 1;
    p.behind = nextRand(state) < 0.28;
  } else {
    // Glowing neon embers rising around the central ring and NEON BREACH lockup
    p.nx = randRange(state, 0.24, 0.74);
    p.ny = randRange(state, 0.14, 0.88);
    p.vx = randRange(state, -0.032, 0.032);
    p.vy = randRange(state, -0.125, -0.045);
    p.maxLife = randRange(state, 1.25, 2.4);
    p.size = randRange(state, 2.2, 4.4);
    const col = CENTER_COLORS[Math.floor(nextRand(state) * CENTER_COLORS.length)];
    p.color = col;
    p.glowColor = col;
    p.shape = nextRand(state) < 0.52 ? 2 : 0;
    p.behind = nextRand(state) < 0.45;
  }

  return p;
}

/**
 * Emits a stream of glowing neon heart-kiss particles (shape = 3) traveling
 * from Kira's open palm & lips (nx ~0.65, ny ~0.34) across to the Xeno's face (nx ~0.30, ny ~0.26)
 * when Frame 3 ("Neon polibek proti xenomutantovi") activates.
 */
export function spawnHeartKissStream(state: TitleEmblemVfxState): void {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const p = claimParticleSlot(state);
    p.active = true;
    p.zone = 'heart_kiss';
    p.nx = randRange(state, 0.61, 0.69);
    p.ny = randRange(state, 0.28, 0.37);
    p.vx = randRange(state, -0.36, -0.18);
    p.vy = randRange(state, -0.11, 0.03);
    p.age = 0;
    p.maxLife = randRange(state, 0.65, 1.25);
    p.size = randRange(state, 4.2, 7.8);
    const col = HEART_COLORS[i % HEART_COLORS.length];
    p.color = col;
    p.glowColor = '#ff2e7e';
    p.phase = randRange(state, 0, Math.PI * 2);
    p.shape = 3;
    p.behind = false;
  }
}

/**
 * Emits a high-energy shock burst around the Xeno's wide-eyed `!!` reaction
 * and Kira's pixel-heart visor when Frame 4 ("Neonový chaos: Xeno-breach protokol") hits climax.
 */
export function spawnXenoShockBurst(state: TitleEmblemVfxState): void {
  // 12 gold/lime exclamation & bio-sparks around the Xeno's shocked head & `!!` (nx ~0.27, ny ~0.20)
  for (let i = 0; i < 12; i++) {
    const p = claimParticleSlot(state);
    const angle = (i / 12) * Math.PI * 2 + randRange(state, -0.2, 0.2);
    const speed = randRange(state, 0.14, 0.32);
    p.active = true;
    p.zone = 'xeno_shock';
    p.nx = 0.28 + Math.cos(angle) * 0.04;
    p.ny = 0.22 + Math.sin(angle) * 0.04;
    p.vx = Math.cos(angle) * speed * 0.75;
    p.vy = Math.sin(angle) * speed - 0.04;
    p.age = 0;
    p.maxLife = randRange(state, 0.55, 0.95);
    p.size = randRange(state, 2.8, 5.2);
    p.color = i % 2 === 0 ? '#ffc700' : '#a3e635';
    p.glowColor = i % 2 === 0 ? '#ffc700' : '#84cc16';
    p.phase = randRange(state, 0, Math.PI * 2);
    p.shape = i % 3 === 0 ? 3 : 1;
    p.behind = false;
  }

  // 6 celebratory neon hearts around Kira's pixel-heart visor (nx ~0.78, ny ~0.18)
  for (let i = 0; i < 6; i++) {
    const p = claimParticleSlot(state);
    p.active = true;
    p.zone = 'heart_kiss';
    p.nx = randRange(state, 0.73, 0.85);
    p.ny = randRange(state, 0.14, 0.25);
    p.vx = randRange(state, -0.09, 0.09);
    p.vy = randRange(state, -0.18, -0.06);
    p.age = 0;
    p.maxLife = randRange(state, 0.65, 1.1);
    p.size = randRange(state, 4.0, 6.6);
    p.color = HEART_COLORS[i % HEART_COLORS.length];
    p.glowColor = '#ff2e7e';
    p.phase = randRange(state, 0, Math.PI * 2);
    p.shape = 3;
    p.behind = false;
  }

  spawnRimArc(state, 'bottom');
  spawnRimArc(state, 'top');
}

export function spawnRimArc(state: TitleEmblemVfxState, forcedEdge?: 'bottom' | 'top'): ElectricRimArc {
  let slot = state.arcs[0];
  for (let i = 0; i < MAX_RIM_ARCS; i++) {
    if (!state.arcs[i].active) {
      slot = state.arcs[i];
      break;
    }
    if (state.arcs[i].age > slot.age) {
      slot = state.arcs[i];
    }
  }

  const useBottom = forcedEdge ? forcedEdge === 'bottom' : nextRand(state) < 0.72;
  const anchors = useBottom ? XENO_PURGE_BOTTOM_RIM_ANCHORS : XENO_PURGE_TOP_RIM_ANCHORS;
  const maxSpan = Math.min(3, anchors.length - 1);
  const span = 1 + Math.floor(nextRand(state) * maxSpan);
  const startIdx = Math.floor(nextRand(state) * (anchors.length - span));

  const points: RimArcPoint[] = [];
  for (let i = startIdx; i < startIdx + span; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (i === startIdx) {
      points.push({ nx: a.nx, ny: a.ny });
    }
    const subdivisions = 3;
    for (let s = 1; s < subdivisions; s++) {
      const t = s / subdivisions;
      const jitterX = randRange(state, -0.008, 0.008);
      const jitterY = randRange(state, -0.015, 0.015);
      points.push({
        nx: a.nx + (b.nx - a.nx) * t + jitterX,
        ny: Math.max(0.74, Math.min(0.96, a.ny + (b.ny - a.ny) * t + jitterY)),
      });
    }
    points.push({ nx: b.nx, ny: b.ny });
  }

  slot.active = true;
  slot.age = 0;
  slot.maxLife = randRange(state, 0.24, 0.44);
  slot.color = nextRand(state) < 0.62 ? '#00f0ff' : '#ff2e7e';
  slot.points = points;
  return slot;
}

export function triggerEmblemClickBurst(
  state: TitleEmblemVfxState,
  normX = 0.5,
  normY = 0.5,
): void {
  const cx = Math.max(0.1, Math.min(0.9, normX));
  const cy = Math.max(0.15, Math.min(0.88, normY));

  // Activate or smoothly re-trigger the 5-frame click story sequence
  if (!state.sequenceActive) {
    state.sequenceActive = true;
    state.sequenceElapsed = 0;
    state.heartBurstEmitted = false;
    state.shockBurstEmitted = false;
  } else if (state.sequenceElapsed > SEQUENCE_HOLD_END_SEC) {
    // Clicked while reversing back to 0: smoothly map reverse progress back into forward progress
    const revProgress =
      (state.sequenceElapsed - SEQUENCE_HOLD_END_SEC) /
      (SEQUENCE_TOTAL_SEC - SEQUENCE_HOLD_END_SEC);
    state.sequenceElapsed = Math.max(0, (1 - revProgress) * SEQUENCE_FORWARD_END_SEC);
    state.heartBurstEmitted = state.sequenceElapsed >= 0.78;
    state.shockBurstEmitted = state.sequenceElapsed >= 1.24;
  }

  state.recoil = Math.min(1, state.recoil + 0.85);
  state.recoilVel = 3.2;
  state.sheenProgress = -0.22;
  state.sheenCooldown = 0;

  state.shockwave.active = true;
  state.shockwave.nx = cx;
  state.shockwave.ny = cy;
  state.shockwave.age = 0;
  state.shockwave.maxLife = 0.52;

  // Immediate dual rim arcs along the XENO-PURGE PROTOCOL plate
  spawnRimArc(state, 'bottom');
  spawnRimArc(state, 'top');

  // 28 radial burst particles blending bio-lime, neon-cyan, magenta, and gold
  const burstCount = 28;
  for (let i = 0; i < burstCount; i++) {
    const p = claimParticleSlot(state);
    const angle = (i / burstCount) * Math.PI * 2 + randRange(state, -0.14, 0.14);
    const speed = randRange(state, 0.16, 0.44);
    p.active = true;
    p.zone = 'burst';
    p.nx = cx + Math.cos(angle) * 0.02;
    p.ny = cy + Math.sin(angle) * 0.025;
    p.vx = Math.cos(angle) * speed * 0.72;
    p.vy = Math.sin(angle) * speed - 0.05;
    p.age = 0;
    p.maxLife = randRange(state, 0.55, 1.15);
    p.size = randRange(state, 2.0, 4.6);
    p.phase = randRange(state, 0, Math.PI * 2);
    p.behind = false;

    if (Math.cos(angle) < -0.35) {
      p.color = BIO_COLORS[i % BIO_COLORS.length];
      p.glowColor = '#84cc16';
      p.shape = 0;
    } else if (Math.cos(angle) > 0.35) {
      p.color = PLASMA_COLORS[i % PLASMA_COLORS.length];
      p.glowColor = '#ff2e7e';
      p.shape = 1;
    } else {
      p.color = CENTER_COLORS[i % CENTER_COLORS.length];
      p.glowColor = '#00f0ff';
      p.shape = 2;
    }
  }
}

export function stepTitleEmblemVfx(
  state: TitleEmblemVfxState,
  rawDt: number,
  options?: {
    targetParallaxX?: number;
    targetParallaxY?: number;
    reducedMotion?: boolean;
    compact?: boolean;
  },
): EmblemTransformSample {
  const reducedMotion = Boolean(options?.reducedMotion);
  const compact = Boolean(options?.compact);
  const dt = Math.max(0, Math.min(MAX_VFX_DT, Number.isFinite(rawDt) ? rawDt : 0));

  // Advance click-only 5-frame pose timeline whenever active
  if (state.sequenceActive) {
    state.sequenceElapsed += dt;
    if (!state.heartBurstEmitted && state.sequenceElapsed >= 0.78) {
      state.heartBurstEmitted = true;
      if (!reducedMotion) {
        spawnHeartKissStream(state);
      }
    }
    if (!state.shockBurstEmitted && state.sequenceElapsed >= 1.24) {
      state.shockBurstEmitted = true;
      if (!reducedMotion) {
        spawnXenoShockBurst(state);
      }
    }
    if (state.sequenceElapsed >= SEQUENCE_TOTAL_SEC) {
      state.sequenceActive = false;
      state.sequenceElapsed = 0;
      state.heartBurstEmitted = false;
      state.shockBurstEmitted = false;
    }
  }

  const sequence = sampleLogoSequence(state);

  if (reducedMotion) {
    state.parallaxX = 0;
    state.parallaxY = 0;
    state.recoil = 0;
    state.recoilVel = 0;
    state.sheenProgress = -1;
    state.shockwave.active = false;
    for (let i = 0; i < MAX_RIM_ARCS; i++) {
      state.arcs[i].active = false;
    }
    return {
      bobNormY: 0,
      breathScale: 1,
      rotateXDeg: 0,
      rotateYDeg: 0,
      auraPulse: 0.45,
      sheenProgress: -1,
      sheenActive: false,
      sequence: {
        ...sequence,
        shakeNormX: 0,
        shakeNormY: 0,
        poseTiltDeg: 0,
      },
    };
  }

  state.timeSec += dt;

  if (options?.targetParallaxX !== undefined) {
    state.targetParallaxX = Math.max(-1, Math.min(1, options.targetParallaxX));
  }
  if (options?.targetParallaxY !== undefined) {
    state.targetParallaxY = Math.max(-1, Math.min(1, options.targetParallaxY));
  }

  // Smooth exponential damping for cursor parallax
  const damp = 1 - Math.exp(-7.5 * dt);
  state.parallaxX += (state.targetParallaxX - state.parallaxX) * damp;
  state.parallaxY += (state.targetParallaxY - state.parallaxY) * damp;

  // Damped spring decay for click recoil impulse
  if (state.recoil > 0.0005 || Math.abs(state.recoilVel) > 0.001) {
    const k = 95;
    const c = 14;
    const acc = -k * state.recoil - c * state.recoilVel;
    state.recoilVel += acc * dt;
    state.recoil += state.recoilVel * dt;
    if (Math.abs(state.recoil) < 0.002 && Math.abs(state.recoilVel) < 0.01) {
      state.recoil = 0;
      state.recoilVel = 0;
    }
  }

  // Periodic diagonal holographic light sheen sweep
  if (state.sheenProgress >= -0.35 && state.sheenProgress <= 1.38) {
    state.sheenProgress += dt * 1.15;
    if (state.sheenProgress > 1.38) {
      state.sheenProgress = -1;
      state.sheenCooldown = randRange(state, 3.6, 5.4);
    }
  } else {
    state.sheenCooldown -= dt;
    if (state.sheenCooldown <= 0) {
      state.sheenProgress = -0.35;
    }
  }

  // Ambient zone-matched particle emission
  const densityScale = compact ? 0.65 : 1;
  state.ambientAccumBio += dt * 8.5 * densityScale;
  while (state.ambientAccumBio >= 1) {
    state.ambientAccumBio -= 1;
    spawnZoneParticle(state, 'bio_left');
  }

  state.ambientAccumCenter += dt * 9.5 * densityScale;
  while (state.ambientAccumCenter >= 1) {
    state.ambientAccumCenter -= 1;
    spawnZoneParticle(state, 'ember_center');
  }

  state.ambientAccumPlasma += dt * 12.0 * densityScale;
  while (state.ambientAccumPlasma >= 1) {
    state.ambientAccumPlasma -= 1;
    spawnZoneParticle(state, 'plasma_right');
  }

  // Update active pooled particles in-place
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= p.maxLife) {
      p.active = false;
      continue;
    }
    if (p.zone === 'bio_left') {
      const wobble = Math.sin(state.timeSec * 3.1 + p.phase) * 0.022;
      p.nx += (p.vx + wobble) * dt;
      p.ny += p.vy * dt;
    } else if (p.zone === 'heart_kiss') {
      // Heart-kiss particles arc smoothly toward the Xeno with gentle vertical flutter
      const flutter = Math.sin(p.age * 9.5 + p.phase) * 0.045;
      p.nx += p.vx * dt;
      p.ny += (p.vy + flutter) * dt;
    } else if (p.zone === 'burst' || p.zone === 'xeno_shock') {
      const drag = Math.exp(-2.8 * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + 0.06 * dt;
      p.nx += p.vx * dt;
      p.ny += p.vy * dt;
    } else {
      p.nx += p.vx * dt;
      p.ny += p.vy * dt;
    }
  }

  // Intermittent electric arc discharges along the XENO-PURGE PROTOCOL rim
  state.arcCooldown -= dt;
  if (state.arcCooldown <= 0) {
    spawnRimArc(state);
    if (nextRand(state) < 0.45) {
      spawnRimArc(state);
    }
    state.arcCooldown = randRange(state, 0.48, 1.15);
  }

  for (let i = 0; i < MAX_RIM_ARCS; i++) {
    const arc = state.arcs[i];
    if (!arc.active) continue;
    arc.age += dt;
    if (arc.age >= arc.maxLife) {
      arc.active = false;
    }
  }

  // Click shockwave ring
  if (state.shockwave.active) {
    state.shockwave.age += dt;
    if (state.shockwave.age >= state.shockwave.maxLife) {
      state.shockwave.active = false;
    }
  }

  const bobNormY = Math.sin(state.timeSec * 1.65) * 0.011 + sequence.shakeNormY;
  const breathWave = Math.sin(state.timeSec * 2.15 + 0.4);
  const recoilScale = 1 + state.recoil * 0.045;
  const sequenceLift = sequence.active ? Math.sin((sequence.elapsed / SEQUENCE_TOTAL_SEC) * Math.PI) * 0.014 : 0;
  const breathScale = (1 + breathWave * 0.011 + sequenceLift) * recoilScale;
  const rotateYDeg = state.parallaxX * 6.2;
  const rotateXDeg = -state.parallaxY * 4.6;
  const auraPulse =
    0.55 +
    Math.sin(state.timeSec * 2.15) * 0.25 +
    Math.min(0.2, Math.abs(state.recoil) * 0.35) +
    (sequence.active ? 0.15 : 0);

  return {
    bobNormY,
    breathScale,
    rotateXDeg,
    rotateYDeg,
    auraPulse: Math.max(0.15, Math.min(1, auraPulse)),
    sheenProgress: state.sheenProgress,
    sheenActive: state.sheenProgress >= -0.35 && state.sheenProgress <= 1.38,
    sequence,
  };
}

const CRAWLER_IDLE_FRAMES = [0, 1, 2, 1] as const;

/**
 * Legacy helper retained for unit test compatibility; external floating side drones
 * are no longer rendered around the Title Screen emblem per user preference.
 */
export function sampleFloatingAccents(
  timeSec: number,
  parallaxX: number,
  parallaxY: number,
  reducedMotion = false,
): FloatingAccentSample[] {
  const t = reducedMotion ? 0 : timeSec;
  const px = reducedMotion ? 0 : parallaxX;
  const py = reducedMotion ? 0 : parallaxY;

  const larvaFrame = CRAWLER_IDLE_FRAMES[Math.floor(t * 4.4) % CRAWLER_IDLE_FRAMES.length];
  const skitterFrame = CRAWLER_IDLE_FRAMES[Math.floor(t * 5.1 + 1.7) % CRAWLER_IDLE_FRAMES.length];

  return [
    {
      kind: 'drone_strike',
      nx: 1.07 + Math.sin(t * 1.45) * 0.018 - px * 0.032,
      ny: 0.25 + Math.sin(t * 2.35 + 0.5) * 0.032 - py * 0.025,
      scaleOfEmblemH: 0.21,
      tiltRad: -0.06 + Math.cos(t * 2.1) * 0.055 + px * 0.05,
      opacity: 0.88,
      flipX: true,
      frameIndex: 2,
      glowColor: '#00f0ff',
      wideOnly: false,
    },
    {
      kind: 'drone_med',
      nx: 1.19 + Math.cos(t * 1.15 + 1.2) * 0.022 - px * 0.048,
      ny: 0.58 + Math.sin(t * 1.9 + 2.1) * 0.03 - py * 0.032,
      scaleOfEmblemH: 0.16,
      tiltRad: Math.sin(t * 1.8) * 0.065,
      opacity: 0.72,
      flipX: false,
      frameIndex: 1,
      glowColor: '#34d399',
      wideOnly: true,
    },
    {
      kind: 'xeno_larva',
      nx: -0.075 + Math.cos(t * 1.35 + 0.8) * 0.018 - px * 0.03,
      ny: 0.56 + Math.sin(t * 2.25 + 1.1) * 0.028 - py * 0.022,
      scaleOfEmblemH: 0.175,
      tiltRad: 0.08 + Math.sin(t * 2.4) * 0.06,
      opacity: 0.82,
      flipX: false,
      frameIndex: larvaFrame,
      glowColor: '#84cc16',
      wideOnly: false,
    },
    {
      kind: 'xeno_skitter',
      nx: -0.17 + Math.sin(t * 1.2 + 2.4) * 0.02 - px * 0.045,
      ny: 0.24 + Math.cos(t * 1.85 + 0.4) * 0.03 - py * 0.03,
      scaleOfEmblemH: 0.14,
      tiltRad: -0.12 + Math.cos(t * 2.0) * 0.05,
      opacity: 0.66,
      flipX: false,
      frameIndex: skitterFrame,
      glowColor: '#38bdf8',
      wideOnly: true,
    },
  ];
}
