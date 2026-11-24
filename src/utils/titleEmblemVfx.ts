import {
  MAX_RIM_ARCS,
  MAX_VFX_DT,
  PARTICLE_POOL_SIZE,
  SEQUENCE_FORWARD_END_SEC,
  SEQUENCE_HOLD_END_SEC,
  SEQUENCE_TOTAL_SEC,
  XENO_PURGE_BOTTOM_RIM_ANCHORS,
  XENO_PURGE_TOP_RIM_ANCHORS,
  sampleLogoSequence,
} from './titleEmblemRenderer';

export * from './titleEmblemRenderer';

export type ParticleZone = 'bio_left' | 'ember_center' | 'plasma_right' | 'burst' | 'heart_kiss' | 'xeno_shock';
export type FloatingAccentKind = 'drone_strike' | 'drone_med' | 'xeno_larva' | 'xeno_skitter';

export interface PooledParticle {
  active: boolean;
  zone: ParticleZone;
  nx: number; ny: number; vx: number; vy: number;
  age: number; maxLife: number; size: number;
  color: string; glowColor: string; phase: number;
  shape: 0 | 1 | 2 | 3;
  behind: boolean;
}

export interface RimArcPoint { nx: number; ny: number; }
export interface ElectricRimArc {
  active: boolean;
  age: number;
  maxLife: number;
  color: string;
  points: RimArcPoint[];
  pointPool: RimArcPoint[];
}
export interface ClickShockwave { active: boolean; nx: number; ny: number; age: number; maxLife: number; }

export interface FloatingAccentSample {
  kind: FloatingAccentKind;
  nx: number; ny: number;
  scaleOfEmblemH: number; tiltRad: number; opacity: number;
  flipX: boolean; frameIndex: number; glowColor: string; wideOnly: boolean;
}

export interface LogoSequenceSample {
  active: boolean; elapsed: number;
  frameA: number; frameB: number; blendU: number;
  alphaA: number; alphaB: number;
  shakeNormX: number; shakeNormY: number; poseTiltDeg: number;
}

export interface TitleEmblemVfxState {
  timeSec: number;
  parallaxX: number; parallaxY: number;
  targetParallaxX: number; targetParallaxY: number;
  recoil: number; recoilVel: number;
  sequenceActive: boolean; sequenceElapsed: number;
  heartBurstEmitted: boolean; shockBurstEmitted: boolean;
  sheenProgress: number; sheenCooldown: number;
  ambientAccumBio: number; ambientAccumCenter: number; ambientAccumPlasma: number;
  arcCooldown: number; nextParticleCursor: number; rngState: number;
  particles: PooledParticle[];
  arcs: ElectricRimArc[];
  shockwave: ClickShockwave;
  scratchSequence: LogoSequenceSample;
  scratchTransform: EmblemTransformSample;
}

export interface EmblemTransformSample {
  bobNormY: number; breathScale: number;
  rotateXDeg: number; rotateYDeg: number;
  auraPulse: number; sheenProgress: number; sheenActive: boolean;
  sequence: LogoSequenceSample;
}

const BIO_COLORS = ['#a3e635', '#84cc16', '#bef264', '#4ade80'] as const;
const CENTER_COLORS = ['#00f0ff', '#ff2e7e', '#ffc700', '#f472b6'] as const;
const PLASMA_COLORS = ['#ff2e7e', '#e879f9', '#00f0ff', '#ffffff'] as const;
const HEART_COLORS = ['#ff2e7e', '#ff6ec7', '#f472b6', '#e879f9'] as const;

function nextRand(state: TitleEmblemVfxState): number {
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

const MAX_ARC_POINTS = 16;

function createEmptyArc(): ElectricRimArc {
  const pointPool: RimArcPoint[] = new Array(MAX_ARC_POINTS);
  for (let i = 0; i < MAX_ARC_POINTS; i++) {
    pointPool[i] = { nx: 0, ny: 0 };
  }
  return {
    active: false,
    age: 0,
    maxLife: 0.2,
    color: '#00f0ff',
    points: [],
    pointPool,
  };
}

function createEmptySequenceSample(): LogoSequenceSample {
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

export function createTitleEmblemVfxState(seed = 20261119): TitleEmblemVfxState {
  const particles: PooledParticle[] = new Array(PARTICLE_POOL_SIZE);
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    particles[i] = createEmptyParticle();
  }
  const arcs: ElectricRimArc[] = new Array(MAX_RIM_ARCS);
  for (let i = 0; i < MAX_RIM_ARCS; i++) {
    arcs[i] = createEmptyArc();
  }
  const scratchSequence = createEmptySequenceSample();

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
    scratchSequence,
    scratchTransform: {
      bobNormY: 0,
      breathScale: 1,
      rotateXDeg: 0,
      rotateYDeg: 0,
      auraPulse: 0.45,
      sheenProgress: -1,
      sheenActive: false,
      sequence: scratchSequence,
    },
  };

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
 * Emits 3 lime bio-spores into the existing left bio_left particle pool when a Xeno Slime drop splashes.
 */
export function spawnSlimeSplashSpores(
  state: TitleEmblemVfxState,
  nx: number,
  ny: number,
): void {
  for (let i = 0; i < 3; i++) {
    const p = claimParticleSlot(state);
    p.active = true;
    p.zone = 'bio_left';
    p.nx = nx + randRange(state, -0.008, 0.008);
    p.ny = ny;
    p.vx = randRange(state, -0.08, 0.08);
    p.vy = randRange(state, -0.14, -0.05);
    p.age = 0;
    p.maxLife = randRange(state, 0.65, 1.15);
    p.size = randRange(state, 2.6, 4.8);
    p.color = '#bef264';
    p.glowColor = '#84cc16';
    p.phase = randRange(state, 0, Math.PI * 2);
    p.shape = 0;
    p.behind = false;
  }
}

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

export function spawnXenoShockBurst(state: TitleEmblemVfxState): void {
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

  const points = slot.points;
  const pool = slot.pointPool;
  points.length = 0;
  let ptCursor = 0;
  const pushPoint = (nx: number, ny: number) => {
    if (ptCursor >= pool.length) return;
    const pt = pool[ptCursor++];
    pt.nx = nx;
    pt.ny = ny;
    points.push(pt);
  };

  for (let i = startIdx; i < startIdx + span; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (i === startIdx) {
      pushPoint(a.nx, a.ny);
    }
    const subdivisions = 3;
    for (let s = 1; s < subdivisions; s++) {
      const t = s / subdivisions;
      const jitterX = randRange(state, -0.008, 0.008);
      const jitterY = randRange(state, -0.015, 0.015);
      pushPoint(
        a.nx + (b.nx - a.nx) * t + jitterX,
        Math.max(0.74, Math.min(0.96, a.ny + (b.ny - a.ny) * t + jitterY)),
      );
    }
    pushPoint(b.nx, b.ny);
  }

  slot.active = true;
  slot.age = 0;
  slot.maxLife = randRange(state, 0.24, 0.44);
  slot.color = nextRand(state) < 0.62 ? '#00f0ff' : '#ff2e7e';
  return slot;
}

export function triggerEmblemClickBurst(
  state: TitleEmblemVfxState,
  normX = 0.5,
  normY = 0.5,
): void {
  const cx = Math.max(0.1, Math.min(0.9, normX));
  const cy = Math.max(0.15, Math.min(0.88, normY));

  if (!state.sequenceActive) {
    state.sequenceActive = true;
    state.sequenceElapsed = 0;
    state.heartBurstEmitted = false;
    state.shockBurstEmitted = false;
  } else if (state.sequenceElapsed > SEQUENCE_HOLD_END_SEC) {
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

  spawnRimArc(state, 'bottom');
  spawnRimArc(state, 'top');

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

  const sequence = sampleLogoSequence(state, state.scratchSequence);

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
    sequence.shakeNormX = 0;
    sequence.shakeNormY = 0;
    sequence.poseTiltDeg = 0;

    const out = state.scratchTransform;
    out.bobNormY = 0;
    out.breathScale = 1;
    out.rotateXDeg = 0;
    out.rotateYDeg = 0;
    out.auraPulse = 0.45;
    out.sheenProgress = -1;
    out.sheenActive = false;
    out.sequence = sequence;
    return out;
  }

  state.timeSec += dt;

  if (options?.targetParallaxX !== undefined) {
    state.targetParallaxX = Math.max(-1, Math.min(1, options.targetParallaxX));
  }
  if (options?.targetParallaxY !== undefined) {
    state.targetParallaxY = Math.max(-1, Math.min(1, options.targetParallaxY));
  }

  const damp = 1 - Math.exp(-7.5 * dt);
  state.parallaxX += (state.targetParallaxX - state.parallaxX) * damp;
  state.parallaxY += (state.targetParallaxY - state.parallaxY) * damp;

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

  if (state.shockwave.active) {
    state.shockwave.age += dt;
    if (state.shockwave.age >= state.shockwave.maxLife) {
      state.shockwave.active = false;
    }
  }

  const bobNormY = Math.sin(state.timeSec * 1.65) * 0.011 + sequence.shakeNormY;
  const recoilScale = 1 + state.recoil * 0.045;
  const sequenceLift = sequence.active
    ? Math.sin((sequence.elapsed / SEQUENCE_TOTAL_SEC) * Math.PI) * 0.014
    : 0;
  // Idle breathing is driven by Stage 4 vertex displacement so Static Lockup Plane stays rock-solid
  const breathScale = (1 + sequenceLift) * recoilScale;
  const rotateYDeg = state.parallaxX * 6.2;
  const rotateXDeg = -state.parallaxY * 4.6;
  const auraPulse =
    0.55 +
    Math.sin(state.timeSec * 2.15) * 0.25 +
    Math.min(0.2, Math.abs(state.recoil) * 0.35) +
    (sequence.active ? 0.15 : 0);

  const out = state.scratchTransform;
  out.bobNormY = bobNormY;
  out.breathScale = breathScale;
  out.rotateXDeg = rotateXDeg;
  out.rotateYDeg = rotateYDeg;
  out.auraPulse = Math.max(0.15, Math.min(1, auraPulse));
  out.sheenProgress = state.sheenProgress;
  out.sheenActive = state.sheenProgress >= -0.35 && state.sheenProgress <= 1.38;
  out.sequence = sequence;
  return out;
}
