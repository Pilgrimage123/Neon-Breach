import type { CombatState } from '../../engine/types';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  BLOOD_DROP_POOL_SIZE,
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  type CombatStageSim,
  getBridgeGroundY,
  getEnemyLaneMetrics,
} from './combatStageTypes';
import {
  type BloodOwnerKind,
  type BloodShapeKind,
  type WeaponDecalKind,
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
} from './mutantBlood';

export function getBridgeEdgeY(sim: CombatStageSim): number {
  if (sim.deckGradFrontY > 0) return sim.deckGradFrontY;
  return getBridgeGroundY(sim.size.h) + Math.round(sim.size.h * 0.032);
}

export function getBridgeBackY(sim: CombatStageSim): number {
  if (sim.deckGradBackY > 0) return sim.deckGradBackY;
  return getBridgeGroundY(sim.size.h) - Math.round(sim.size.h * 0.055);
}

function emitBloodParticles(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  count: number,
  color: string,
  shape: number,
  speedScale = 1,
  jitter = 20,
  lifeBase = 0.35,
  lifeVar = 0.35,
  sizeBase = 2.5,
  sizeVar = 4,
): void {
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const spd = (80 + Math.random() * 210) * speedScale;
    p.active = true;
    p.x = jitter > 0 ? cx + (Math.random() - 0.5) * jitter : cx;
    p.y = jitter > 0 ? cy + (Math.random() - 0.5) * jitter : cy;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd - 45;
    p.life = 0;
    p.maxLife = lifeBase + Math.random() * lifeVar;
    p.size = sizeBase + Math.random() * sizeVar;
    p.color = color;
    p.shape = shape;
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = shape === 1 ? (Math.random() - 0.5) * 10 : 0;
    p.gravity = 280;
    p.floorY = 9999;
    p.bounced = false;
  }
}

export function addOrFeedEdgeDrip(
  sim: CombatStageSim,
  x: number,
  edgeY: number,
  feedSize: number,
  owner: BloodOwnerKind = 'larva',
): void {
  const { w } = sim.size;
  const clampedX = Math.max(28, Math.min(w - 28, x));
  const profile = getBloodBiologyProfile(owner);

  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const existing = sim.edgeDrips[i];
    if (!existing.active) continue;
    if (Math.abs(existing.x - clampedX) < 13) {
      existing.thickness = Math.min(7.2, existing.thickness + feedSize * 0.25);
      existing.maxLength = Math.min(64, existing.maxLength + feedSize * 2.4);
      existing.bulbPhase = Math.min(1, existing.bulbPhase + 0.36);
      existing.alpha = Math.min(0.95, existing.alpha + 0.38);
      existing.age = Math.max(0, existing.age * 0.55);
      existing.createdTurn = sim.currentTurn;
      existing.visualTurnAge = 0;
      return;
    }
  }

  const drip = sim.edgeDrips[sim.edgeDripCursor];
  sim.edgeDripCursor = (sim.edgeDripCursor + 1) % EDGE_DRIP_POOL_SIZE;

  drip.active = true;
  drip.x = clampedX;
  drip.edgeY = edgeY;
  drip.length = 2.5 + Math.random() * 4.5;
  drip.maxLength = Math.min(62, 20 + feedSize * 3.8 + Math.random() * 24);
  drip.thickness = Math.max(2.6, Math.min(6.4, 2.2 + feedSize * 0.52));
  drip.bulbPhase = 0.18 + Math.random() * 0.32;
  drip.stretchSpeed = (4.2 + Math.random() * 4.8) * (1.15 - profile.viscosity * 0.35);
  drip.detachedActive = false;
  drip.detachedY = edgeY + drip.length;
  drip.detachedVy = 0;
  drip.detachedRadius = 2.8;
  drip.detachedAlpha = 0;
  drip.alpha = 0.88 + Math.random() * 0.08;
  drip.age = 0;
  drip.lifespan = 22 + Math.random() * 14;
  drip.color = profile.freshBody;
  drip.coreColor = profile.freshCore;
  drip.highlightColor = profile.freshHighlight;
  drip.owner = owner;
  drip.createdTurn = sim.currentTurn;
  drip.visualTurnAge = 0;
  drip.seed = Math.random() * 100;
}

export function addCoverBloodDecal(
  sim: CombatStageSim,
  x: number,
  surface: 'rear_cover' | 'front_curb',
  offsetY: number,
  dropSize: number,
  owner: BloodOwnerKind = 'larva',
  shapeKind: BloodShapeKind = 'cone_droplet',
  angle = 0,
  plasmaColor = '#00F0FF',
  createdTurn = sim.currentTurn,
): void {
  const { w } = sim.size;
  const clampedX = Math.max(24, Math.min(w - 24, x));

  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    const existing = sim.coverBlood[i];
    if (!existing.active || existing.surface !== surface) continue;
    if (
      existing.owner === owner &&
      existing.createdTurn === createdTurn &&
      Math.abs(existing.x - clampedX) < 14 &&
      Math.abs(existing.offsetY - offsetY) < 9
    ) {
      existing.rx = Math.min(26, existing.rx + dropSize * 0.55);
      existing.targetRy = Math.min(24, existing.targetRy + dropSize * 0.7);
      existing.maxStreakLen = Math.min(34, existing.maxStreakLen + dropSize * 1.1);
      existing.alpha = Math.min(0.95, existing.alpha + 0.25);
      return;
    }
  }

  const decal = sim.coverBlood[sim.coverBloodCursor];
  sim.coverBloodCursor = (sim.coverBloodCursor + 1) % COVER_BLOOD_POOL_SIZE;
  const clampedOffset =
    surface === 'rear_cover'
      ? Math.max(-34, Math.min(-4, offsetY))
      : Math.max(1, Math.min(9, offsetY));
  const rx = Math.max(3.2, Math.min(22, 3.6 + dropSize * 1.1 + Math.random() * 4));
  const targetRy =
    shapeKind === 'melee_arc'
      ? Math.max(4, rx * 0.52)
      : Math.max(4.5, rx * (0.75 + Math.random() * 0.45));

  decal.active = true;
  decal.surface = surface;
  decal.x = clampedX;
  decal.offsetY = clampedOffset;
  decal.rx = rx;
  decal.ry = Math.max(2, targetRy * 0.45);
  decal.targetRy = targetRy;
  decal.streakLen = 0.5;
  decal.maxStreakLen =
    shapeKind === 'scorch_ring' ? 0 : 7 + dropSize * 1.9 + Math.random() * 12;
  decal.owner = owner;
  decal.shapeKind = shapeKind;
  decal.angle = angle;
  decal.createdTurn = createdTurn;
  decal.visualTurnAge = Math.max(0, sim.currentTurn - createdTurn);
  decal.seed = Math.random() * 100;
  decal.plasmaColor = plasmaColor;
  decal.age = 0;
  decal.alpha = 0.88 + Math.random() * 0.08;
}

export function addOrGrowFloorBlood(
  sim: CombatStageSim,
  x: number,
  y: number,
  dropSize: number,
  initialRxBoost = 0,
  options?: {
    owner?: BloodOwnerKind;
    shapeKind?: BloodShapeKind;
    angle?: number;
    plasmaColor?: string;
    createdTurn?: number;
  },
): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const minDeckY = groundY - Math.round(h * 0.045);
  const maxDeckY = Math.max(edgeY, groundY + Math.round(h * 0.036));
  const clampedX = Math.max(24, Math.min(w - 24, x));
  const clampedY = Math.max(minDeckY, Math.min(maxDeckY, y));
  const owner = options?.owner ?? 'larva';
  const shapeKind = options?.shapeKind ?? 'puddle';
  const angle = options?.angle ?? 0;
  const plasmaColor = options?.plasmaColor ?? '#00F0FF';
  const createdTurn = options?.createdTurn ?? sim.currentTurn;
  const profile = getBloodBiologyProfile(owner);

  if (clampedY >= edgeY - 4.5 && shapeKind !== 'scorch_ring') {
    addOrFeedEdgeDrip(sim, clampedX, edgeY, dropSize * 0.85 + initialRxBoost * 0.25, owner);
    if (dropSize >= 3.2) {
      addCoverBloodDecal(
        sim,
        clampedX,
        'front_curb',
        2 + Math.random() * 4,
        dropSize * 0.75,
        owner,
        shapeKind,
        0,
        plasmaColor,
        createdTurn,
      );
    }
  }

  if (shapeKind === 'puddle' || shapeKind === 'cone_droplet') {
    for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
      const existing = sim.floorBlood[i];
      if (!existing.active) continue;
      if (
        existing.owner === owner &&
        existing.createdTurn === createdTurn &&
        (existing.shapeKind === 'puddle' || existing.shapeKind === 'cone_droplet') &&
        Math.abs(existing.x - clampedX) < 14 &&
        Math.abs(existing.y - clampedY) < 5
      ) {
        existing.targetRx = Math.min(56, existing.targetRx + dropSize * 0.6 + initialRxBoost * 0.35);
        existing.targetRy = Math.min(14.5, existing.targetRy + dropSize * 0.16 + initialRxBoost * 0.1);
        existing.maxTendrilLen = Math.min(32, existing.maxTendrilLen + dropSize * 0.45);
        existing.flowVx += (Math.random() - 0.38) * 1.2;
        existing.flowVy = Math.min(4.0, existing.flowVy + 0.22);
        existing.alpha = Math.min(0.95, existing.alpha + 0.3);
        existing.age = Math.max(0, existing.age * 0.6);
        return;
      }
    }
  }

  const puddle = sim.floorBlood[sim.floorBloodCursor];
  sim.floorBloodCursor = (sim.floorBloodCursor + 1) % FLOOR_BLOOD_POOL_SIZE;

  const isTrail = shapeKind === 'trail_drop';
  const isScorch = shapeKind === 'scorch_ring';
  const isArc = shapeKind === 'melee_arc';
  const baseRx = isTrail
    ? 3.8 + dropSize * 0.9 + Math.random() * 2.5
    : isScorch
      ? 14 + dropSize * 1.9 + initialRxBoost * 0.8 + Math.random() * 5
      : isArc
        ? 18 + dropSize * 2.3 + initialRxBoost * 1.1 + Math.random() * 7
        : 6.5 + dropSize * 1.65 + initialRxBoost + Math.random() * 6;
  const baseRy = isTrail
    ? Math.max(1.5, baseRx * 0.36)
    : isScorch
      ? Math.max(4.5, baseRx * 0.32)
      : isArc
        ? Math.max(4.2, baseRx * 0.28)
        : Math.max(2.4, baseRx * (0.24 + Math.random() * 0.08));

  const viscousSlowdown = 1.2 - profile.viscosity * 0.45;
  puddle.active = true;
  puddle.x = clampedX;
  puddle.y = clampedY;
  puddle.rx = Math.max(2, baseRx * (isScorch ? 0.5 : 0.28));
  puddle.ry = Math.max(1, baseRy * (isScorch ? 0.5 : 0.28));
  puddle.targetRx = Math.min(60, baseRx);
  puddle.targetRy = Math.min(16, baseRy);
  puddle.flowVx = isScorch || isTrail ? 0 : (Math.random() - 0.32) * 5.8 * viscousSlowdown;
  puddle.flowVy = isScorch || isTrail ? 0 : (0.9 + Math.random() * 2.2) * viscousSlowdown;
  puddle.spreadRateX = isScorch || isTrail ? 0.1 : (1.2 + Math.random() * 1.4) * viscousSlowdown;
  puddle.spreadRateY = isScorch || isTrail ? 0.04 : (0.28 + Math.random() * 0.36) * viscousSlowdown;
  puddle.tendrilOffsetX1 = (Math.random() - 0.65) * baseRx * 0.7;
  puddle.tendrilOffsetX2 = (Math.random() - 0.25) * baseRx * 0.75;
  puddle.tendrilLen1 = 0.5;
  puddle.tendrilLen2 = 0.3;
  puddle.maxTendrilLen = isScorch || isTrail ? 0 : 8 + Math.random() * 16;
  puddle.color = profile.freshBody;
  puddle.coreColor = profile.freshCore;
  puddle.highlightColor = profile.freshHighlight;
  puddle.owner = owner;
  puddle.shapeKind = shapeKind;
  puddle.angle = angle;
  puddle.createdTurn = createdTurn;
  puddle.visualTurnAge = Math.max(0, sim.currentTurn - createdTurn);
  puddle.seed = Math.random() * 100;
  puddle.plasmaColor = plasmaColor;
  puddle.age = 0;
  puddle.alpha = isTrail ? 0.82 : 0.88 + Math.random() * 0.08;
  puddle.dripSpawnCooldown = 0.35 + Math.random() * 0.45;
  puddle.lobeOffsetX = (Math.random() > 0.5 ? 1 : -1) * (baseRx * (0.38 + Math.random() * 0.25));
  puddle.lobeOffsetY = (Math.random() - 0.4) * baseRy * 0.55;
  puddle.lobeScale = isTrail || isScorch ? 0.42 : 0.58 + Math.random() * 0.28;
}

export function spawnStatusTrail(
  sim: CombatStageSim,
  owner: BloodOwnerKind,
  fromX: number,
  toX: number,
  groundY: number,
  count = 6,
): void {
  const steps = Math.max(2, count);
  const dir = toX >= fromX ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    const px = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 10;
    const py = groundY + (Math.random() - 0.4) * 12;
    addOrGrowFloorBlood(sim, px, py, 2.4 + Math.random() * 1.4, 0, {
      owner,
      shapeKind: 'trail_drop',
      angle: dir > 0 ? 0.08 : Math.PI - 0.08,
    });
  }
}

export function emitBloodDroplets(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorCenterY: number,
  count: number,
  intensity: number,
  owner: BloodOwnerKind = 'larva',
  weaponKind: WeaponDecalKind = 'kinetic',
  dirX = 1,
): void {
  const { h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const minDeckY = groundY - Math.round(h * 0.042);
  const maxDeckY = Math.max(edgeY, groundY + Math.round(h * 0.035));
  const profile = getBloodBiologyProfile(owner);
  const palette = profile.dropletPalette;
  const forwardBaseAngle = dirX >= 0 ? -0.26 * Math.PI : -0.74 * Math.PI;

  for (let i = 0; i < count; i++) {
    const d = sim.bloodDrops[sim.bloodDropCursor];
    sim.bloodDropCursor = (sim.bloodDropCursor + 1) % BLOOD_DROP_POOL_SIZE;

    let angle: number;
    let speed: number;
    if (weaponKind === 'kinetic') {
      const forwardCone = i % 4 !== 0;
      angle = forwardCone
        ? forwardBaseAngle + (Math.random() - 0.5) * 0.62 * Math.PI
        : (dirX >= 0 ? -0.88 * Math.PI : -0.12 * Math.PI) + (Math.random() - 0.5) * 0.4 * Math.PI;
      speed = (140 + Math.random() * 410) * (0.82 + intensity * 0.34);
    } else if (weaponKind === 'melee') {
      angle = -0.92 * Math.PI + Math.random() * 1.05 * Math.PI;
      speed = (110 + Math.random() * 340) * (0.8 + intensity * 0.3);
    } else {
      angle = -Math.PI + Math.random() * Math.PI;
      speed = (65 + Math.random() * 195) * (0.75 + intensity * 0.25);
    }

    const floorY = Math.max(
      minDeckY,
      Math.min(maxDeckY, floorCenterY + (Math.random() - 0.38) * 32),
    );

    d.active = true;
    d.x = cx + (Math.random() - 0.5) * 24;
    d.y = cy + (Math.random() - 0.5) * 28;
    d.vx = Math.cos(angle) * speed + (weaponKind === 'kinetic' ? dirX * 72 * intensity : 0);
    d.vy = Math.sin(angle) * speed - (55 + Math.random() * 85);
    d.size =
      weaponKind === 'plasma'
        ? 1.6 + Math.random() * 2.2
        : 2.4 + Math.random() * (3.6 + intensity * 1.3);
    d.color = palette[(sim.bloodDropCursor + i) % palette.length];
    d.highlightColor = profile.freshHighlight;
    d.owner = owner;
    d.shapeKind =
      weaponKind === 'kinetic'
        ? 'cone_droplet'
        : weaponKind === 'melee'
          ? 'melee_arc'
          : 'puddle';
    d.createdTurn = sim.currentTurn;
    d.floorY = floorY;
    d.life = 0;
    d.maxLife = 0.62 + Math.random() * 0.52;
    d.splatOnFloor = weaponKind !== 'plasma' && i % 5 !== 0;
    d.hitCover = weaponKind !== 'plasma' && i % 3 === 0;
  }
}

export function spawnScreenBloodSpray(
  sim: CombatStageSim,
  owner: BloodOwnerKind,
  count: number,
  sourceX = sim.size.w * 0.65,
): void {
  const { w } = sim.size;
  const profile = getBloodBiologyProfile(owner);
  const biasRight = sourceX >= w * 0.5;
  const viscousMul = 1.2 - profile.viscosity * 0.45;

  for (let i = 0; i < count; i++) {
    const sb = sim.screenBlood[sim.screenBloodCursor];
    sim.screenBloodCursor = (sim.screenBloodCursor + 1) % SCREEN_BLOOD_POOL_SIZE;

    const zoneRoll = Math.random();
    let nx: number;
    let ny: number;
    if (zoneRoll < 0.44) {
      nx = 0.08 + Math.random() * 0.84;
      ny = 0.83 + Math.random() * 0.13;
    } else if (zoneRoll < 0.8) {
      const onRight = Math.random() < (biasRight ? 0.72 : 0.28);
      nx = onRight ? 0.84 + Math.random() * 0.13 : 0.03 + Math.random() * 0.12;
      ny = 0.24 + Math.random() * 0.68;
    } else {
      const onRight = Math.random() < (biasRight ? 0.7 : 0.3);
      nx = onRight ? 0.89 + Math.random() * 0.09 : 0.02 + Math.random() * 0.08;
      ny = 0.14 + Math.random() * 0.16;
    }

    const r = 2.8 + Math.random() * 4.8;
    sb.active = true;
    sb.nx = nx;
    sb.ny = ny;
    sb.radius = r;
    sb.stretchY = 1.06 + Math.random() * 0.34;
    sb.slideOffsetPx = 0;
    sb.slideSpeed = (1.6 + Math.random() * 2.8) * viscousMul;
    sb.streakLen = 0;
    sb.owner = owner;
    sb.age = 0;
    sb.lifespan = 5.0 + Math.random() * 3.2;
    sb.alpha = 0.82 + Math.random() * 0.12;
    sb.seed = Math.random() * 100;
    const satAng = (Math.random() - 0.5) * Math.PI * 2;
    const satDist = r + 3 + Math.random() * 5;
    sb.satelliteDx = Math.cos(satAng) * satDist;
    sb.satelliteDy = Math.sin(satAng) * satDist;
    sb.satelliteR = Math.max(1.0, r * (0.28 + Math.random() * 0.2));
  }
}

function maybeSprayFourthWallVisor(
  sim: CombatStageSim,
  sourceX: number,
  owner: BloodOwnerKind,
  weaponKind: WeaponDecalKind,
  intensity: number,
  isKo: boolean,
): void {
  if (sim.screenBloodCooldown > 0) return;

  if (weaponKind === 'plasma') {
    if (isKo && Math.random() < 0.35) {
      spawnScreenBloodSpray(sim, owner, 1, sourceX);
      sim.screenBloodCooldown = 1.2;
    }
    return;
  }

  let dropCount = 0;
  if (isKo) {
    dropCount = weaponKind === 'melee' ? 3 + (Math.random() < 0.5 ? 1 : 0) : 2 + (Math.random() < 0.45 ? 1 : 0);
    sim.screenBloodCooldown = 0.45;
  } else if (intensity >= 1.25) {
    dropCount = Math.random() < 0.72 ? (weaponKind === 'melee' ? 2 : 1 + (Math.random() < 0.4 ? 1 : 0)) : 0;
    if (dropCount > 0) sim.screenBloodCooldown = 0.85;
  } else if (Math.random() < 0.24) {
    dropCount = 1 + (Math.random() < 0.35 ? 1 : 0);
    sim.screenBloodCooldown = 1.15;
  }

  if (dropCount > 0) {
    spawnScreenBloodSpray(sim, owner, dropCount, sourceX);
  }
}

export function spawnAlienBloodImpact(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorCenterY: number,
  owner: BloodOwnerKind = 'larva',
  weaponKind: WeaponDecalKind = 'kinetic',
  intensity = 1,
  isKo = false,
  dirX = 1,
  plasmaColor = '#00F0FF',
): void {
  const profile = getBloodBiologyProfile(owner);
  const edgeY = getBridgeEdgeY(sim);

  const dropMultiplier = weaponKind === 'plasma' ? 0.28 : weaponKind === 'melee' ? 0.92 : 1.08;
  const dropCount = Math.min(96, Math.round((isKo ? 60 : 36) * intensity * dropMultiplier));
  emitBloodDroplets(sim, cx, cy, floorCenterY, dropCount, intensity, owner, weaponKind, dirX);

  emitBloodParticles(
    sim,
    cx + dirX * 8,
    cy - 6,
    Math.round((isKo ? 20 : 12) * intensity),
    weaponKind === 'plasma' ? plasmaColor : profile.freshEmissive,
    weaponKind === 'plasma' ? 0 : 2,
    0.95 * intensity,
    24,
    0.26,
    0.26,
    2.8,
    4.2,
  );
  emitBloodParticles(
    sim,
    cx + dirX * 14,
    cy + 4,
    Math.round((isKo ? 14 : 9) * intensity),
    profile.freshBody,
    weaponKind === 'melee' ? 1 : 0,
    0.85 * intensity,
    22,
    0.3,
    0.28,
    3.2,
    4.6,
  );

  maybeSprayFourthWallVisor(sim, cx, owner, weaponKind, intensity, isKo);

  if (weaponKind === 'plasma') {
    addOrGrowFloorBlood(sim, cx, floorCenterY + (Math.random() - 0.5) * 10, 4.5 * intensity, isKo ? 6 : 2, {
      owner,
      shapeKind: 'scorch_ring',
      angle: 0,
      plasmaColor,
    });
    if (isKo || intensity >= 1.25) {
      addOrGrowFloorBlood(
        sim,
        cx + dirX * (16 + Math.random() * 14),
        floorCenterY + (Math.random() - 0.5) * 14,
        3.2 * intensity,
        2,
        {
          owner,
          shapeKind: 'scorch_ring',
          angle: 0,
          plasmaColor,
        },
      );
      addCoverBloodDecal(
        sim,
        cx + dirX * (14 + Math.random() * 24),
        'rear_cover',
        -16 + (Math.random() - 0.5) * 12,
        3.2,
        owner,
        'scorch_ring',
        0,
        plasmaColor,
      );
    }
    return;
  }

  if (weaponKind === 'melee') {
    const arcCount = isKo ? 3 : 2;
    for (let a = 0; a < arcCount; a++) {
      const arcX = cx + (a - 0.5) * 24 * dirX + (Math.random() - 0.5) * 18;
      const arcY = floorCenterY + (Math.random() - 0.35) * 18;
      const arcAngle = dirX >= 0 ? -0.22 + (Math.random() - 0.5) * 0.45 : Math.PI + 0.22 + (Math.random() - 0.5) * 0.45;
      addOrGrowFloorBlood(sim, arcX, arcY, 4.4 + Math.random() * 2.8, isKo ? 6 : 3, {
        owner,
        shapeKind: 'melee_arc',
        angle: arcAngle,
      });
    }
    const sideSplats = Math.round((isKo ? 4 : 2) * Math.max(1, intensity * 0.85));
    for (let k = 0; k < sideSplats; k++) {
      addOrGrowFloorBlood(
        sim,
        cx + (Math.random() - 0.35) * 64 * intensity,
        floorCenterY + (Math.random() - 0.3) * 22,
        3.5 + Math.random() * 2.5,
        isKo ? 4 : 2,
        { owner, shapeKind: 'puddle' },
      );
    }
    const coverCount = isKo ? 3 : 2;
    for (let c = 0; c < coverCount; c++) {
      addCoverBloodDecal(
        sim,
        cx + dirX * (6 + Math.random() * 44),
        'rear_cover',
        -10 - Math.random() * 20,
        3.8 + Math.random() * 2.6,
        owner,
        'melee_arc',
        (Math.random() - 0.5) * 0.5,
      );
    }
    addOrGrowFloorBlood(sim, cx + (Math.random() - 0.4) * 44, edgeY - 1, 3.6 + Math.random() * 2.2, isKo ? 4 : 2, {
      owner,
      shapeKind: 'puddle',
    });
    return;
  }

  const conePools = Math.round((isKo ? 6 : 4) * Math.max(1, intensity * 0.85));
  for (let k = 0; k < conePools; k++) {
    const tCone = (k + 0.3) / conePools;
    const spreadY = (Math.random() - 0.45) * (14 + tCone * 26);
    const px = cx + dirX * (8 + tCone * 62 * intensity);
    const py = floorCenterY + spreadY;
    const coneAngle = Math.atan2(spreadY * 0.4, dirX * (24 + tCone * 40));
    addOrGrowFloorBlood(sim, px, py, 3.8 + Math.random() * 3.2, isKo ? 6 : 3, {
      owner,
      shapeKind: k === 0 ? 'puddle' : 'cone_droplet',
      angle: coneAngle,
    });
  }

  const rearCoverHits = Math.round((isKo ? 4 : 2) * Math.max(1, intensity * 0.9));
  for (let c = 0; c < rearCoverHits; c++) {
    addCoverBloodDecal(
      sim,
      cx + dirX * (12 + Math.random() * 64 * intensity),
      'rear_cover',
      -8 - Math.random() * 22,
      3.5 + Math.random() * 2.8,
      owner,
      'cone_droplet',
      dirX >= 0 ? -0.25 : Math.PI + 0.25,
    );
  }

  const edgeSplats = Math.round((isKo ? 3 : 2) * Math.max(1, intensity * 0.85));
  for (let e = 0; e < edgeSplats; e++) {
    const ex = cx + dirX * (4 + Math.random() * 54 * intensity);
    addOrGrowFloorBlood(sim, ex, edgeY - 1.2 + Math.random() * 1.8, 3.6 + Math.random() * 2.8, isKo ? 5 : 2, {
      owner,
      shapeKind: 'puddle',
    });
  }
}

export function syncCombatBloodState(sim: CombatStageSim, combat: CombatState): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const { slotCenters, effectiveSlotCount: slotCount } = computeEnemySlotLayout(
    combat.enemies,
    combat.director?.pendingReinforcements,
  );
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, slotCount);

  if (combat.turn < sim.currentTurn) {
    for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
      if (sim.floorBlood[i].active && sim.floorBlood[i].createdTurn > combat.turn) {
        sim.floorBlood[i].active = false;
      }
    }
    for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
      if (sim.coverBlood[i].active && sim.coverBlood[i].createdTurn > combat.turn) {
        sim.coverBlood[i].active = false;
      }
    }
    for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
      if (sim.edgeDrips[i].active && sim.edgeDrips[i].createdTurn > combat.turn) {
        sim.edgeDrips[i].active = false;
      }
    }
    sim.needsRedraw = true;
  } else if (combat.turn > sim.currentTurn) {
    sim.needsRedraw = true;
  }
  sim.currentTurn = combat.turn;

  const livingIds = new Set<string>();
  for (let idx = 0; idx < combat.enemies.length; idx++) {
    const enemy = combat.enemies[idx];
    if (enemy.hp <= 0) {
      sim.prevEnemySlots.delete(enemy.id);
      continue;
    }
    livingIds.add(enemy.id);
    const prevMaxArmor = sim.enemyInitialArmor.get(enemy.id) ?? 0;
    if (enemy.armor > prevMaxArmor) {
      sim.enemyInitialArmor.set(enemy.id, enemy.armor);
    } else if (!sim.enemyInitialArmor.has(enemy.id)) {
      sim.enemyInitialArmor.set(enemy.id, enemy.armor);
    }

    const slotCenter = slotCenters[idx] ?? idx;
    const prevSlot = sim.prevEnemySlots.get(enemy.id);
    if (prevSlot !== undefined && Math.abs(prevSlot - slotCenter) > 0.01) {
      const status = getEnemyStatusVisualFlags(enemy, sim.enemyInitialArmor.get(enemy.id));
      if (status.isBleeding || status.isShredded) {
        const oldX = enemyBaseX + prevSlot * enemyStepX;
        const newX = enemyBaseX + slotCenter * enemyStepX;
        const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
        spawnStatusTrail(
          sim,
          enemy.archetype,
          oldX,
          newX,
          enemyGroundY,
          status.isSeverelyBleeding || status.isShredded ? 7 : 5,
        );
        sim.needsRedraw = true;
      }
    }
    sim.prevEnemySlots.set(enemy.id, slotCenter);
  }

  sim.prevEnemySlots.forEach((_, id) => {
    if (!livingIds.has(id)) {
      sim.prevEnemySlots.delete(id);
    }
  });
}

export function stepBloodSimulation(sim: CombatStageSim, simDt: number): void {
  const { w, h } = sim.size;
  const edgeY = getBridgeEdgeY(sim);
  const backY = getBridgeBackY(sim);

  for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
    const d = sim.bloodDrops[i];
    if (!d.active) continue;
    d.life += simDt;
    if (d.life >= d.maxLife) {
      if (d.splatOnFloor) {
        addOrGrowFloorBlood(sim, d.x, d.floorY, d.size * 0.85, 0, {
          owner: d.owner,
          shapeKind: d.shapeKind,
          createdTurn: d.createdTurn,
        });
      }
      d.active = false;
      continue;
    }
    d.x += d.vx * simDt;
    d.y += d.vy * simDt;
    d.vx *= Math.max(0, 1 - 1.15 * simDt);
    d.vy += 640 * simDt;

    if (d.hitCover && d.vy > -40 && d.y >= backY - 34 && d.y <= backY - 4 && d.x > 30 && d.x < w - 30) {
      addCoverBloodDecal(
        sim,
        d.x,
        'rear_cover',
        d.y - backY,
        d.size * 0.9,
        d.owner,
        d.shapeKind,
        Math.atan2(d.vy, d.vx),
        '#00F0FF',
        d.createdTurn,
      );
      d.active = false;
      continue;
    }

    if (d.vy > 0 && d.y >= d.floorY) {
      if (d.splatOnFloor) {
        addOrGrowFloorBlood(sim, d.x, d.floorY, d.size, 0, {
          owner: d.owner,
          shapeKind: d.shapeKind,
          angle: Math.atan2(d.vy * 0.35, d.vx || 1),
          createdTurn: d.createdTurn,
        });
      }
      d.active = false;
    }
  }

  const ageLerp = Math.min(1, simDt * 3.4);
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active) continue;
    fp.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - fp.createdTurn);
    fp.visualTurnAge += (targetTurnAge - fp.visualTurnAge) * ageLerp;

    const weathering = computeBloodWeatheringState(fp.visualTurnAge);
    const expandRate = Math.min(1, simDt * 16);
    fp.rx += (fp.targetRx - fp.rx) * expandRate;
    fp.ry += (fp.targetRy - fp.ry) * expandRate;

    const viscousFlowFactor = (1 / (1 + fp.age * 0.055)) * weathering.viscositySpreadFactor;
    fp.x = Math.max(20, Math.min(w - 20, fp.x + fp.flowVx * viscousFlowFactor * simDt));
    fp.y = Math.min(edgeY, fp.y + fp.flowVy * viscousFlowFactor * simDt);
    fp.targetRx = Math.min(60, fp.targetRx + fp.spreadRateX * viscousFlowFactor * simDt);
    fp.targetRy = Math.min(16, fp.targetRy + fp.spreadRateY * viscousFlowFactor * simDt);
    fp.tendrilLen1 = Math.min(fp.maxTendrilLen, fp.tendrilLen1 + 2.6 * viscousFlowFactor * simDt);
    fp.tendrilLen2 = Math.min(fp.maxTendrilLen * 0.82, fp.tendrilLen2 + 1.9 * viscousFlowFactor * simDt);

    if (fp.shapeKind !== 'scorch_ring' && fp.shapeKind !== 'trail_drop') {
      const frontReachY = fp.y + fp.ry * 0.45 + Math.max(fp.tendrilLen1, fp.tendrilLen2) * 0.42;
      if (frontReachY >= edgeY - 3.5 && weathering.turnAge < 1.8) {
        fp.dripSpawnCooldown -= simDt;
        if (fp.dripSpawnCooldown <= 0 && fp.alpha > 0.35) {
          fp.dripSpawnCooldown = 1.15 + Math.random() * 0.9;
          const offsetX = fp.tendrilLen1 >= fp.tendrilLen2 ? fp.tendrilOffsetX1 : fp.tendrilOffsetX2;
          addOrFeedEdgeDrip(sim, fp.x + offsetX * 0.65, edgeY, Math.max(2.2, fp.ry * 0.48), fp.owner);
        }
      }
    }

    const minPersistentAlpha = fp.shapeKind === 'trail_drop' ? 0.64 : 0.76;
    if (fp.alpha > minPersistentAlpha) {
      fp.alpha = Math.max(minPersistentAlpha, fp.alpha - 0.012 * simDt);
    }
  }

  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    const cd = sim.coverBlood[i];
    if (!cd.active) continue;
    cd.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - cd.createdTurn);
    cd.visualTurnAge += (targetTurnAge - cd.visualTurnAge) * ageLerp;

    const weathering = computeBloodWeatheringState(cd.visualTurnAge);
    cd.ry += (cd.targetRy - cd.ry) * Math.min(1, simDt * 14);
    if (cd.streakLen < cd.maxStreakLen) {
      cd.streakLen = Math.min(cd.maxStreakLen, cd.streakLen + 3.4 * weathering.viscositySpreadFactor * simDt);
    }
    if (cd.alpha > 0.78) {
      cd.alpha = Math.max(0.78, cd.alpha - 0.01 * simDt);
    }
  }

  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const drip = sim.edgeDrips[i];
    if (!drip.active) continue;
    drip.edgeY = edgeY;
    drip.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - drip.createdTurn);
    drip.visualTurnAge += (targetTurnAge - drip.visualTurnAge) * ageLerp;

    const weathering = computeBloodWeatheringState(drip.visualTurnAge);
    const viscosityDrag = 1 / (1 + drip.length * 0.05);
    const fadeSlowdown = Math.max(0.2, drip.alpha) * weathering.viscositySpreadFactor;
    drip.length = Math.min(drip.maxLength, drip.length + drip.stretchSpeed * viscosityDrag * fadeSlowdown * simDt);

    if (drip.alpha > 0.25 && drip.length > 7 && drip.visualTurnAge < 2) {
      drip.bulbPhase += simDt * (0.24 + drip.thickness * 0.036) * fadeSlowdown;
      if (drip.bulbPhase >= 1) {
        drip.bulbPhase = 0;
        if (!drip.detachedActive) {
          drip.detachedActive = true;
          drip.detachedY = drip.edgeY + drip.length + 2;
          drip.detachedVy = 7 + Math.random() * 9;
          drip.detachedRadius = Math.max(2.1, drip.thickness * 0.72);
          drip.detachedAlpha = drip.alpha * 0.94;
          drip.length = Math.max(5.5, drip.length * 0.76);
          drip.thickness = Math.max(1.5, drip.thickness * 0.91);
        }
      }
    }

    if (drip.detachedActive) {
      drip.detachedVy = Math.min(82, drip.detachedVy + 92 * simDt);
      drip.detachedY += drip.detachedVy * simDt;
      drip.detachedAlpha -= simDt * 0.52;
      if (drip.detachedAlpha <= 0.02 || drip.detachedY > h + 18) {
        drip.detachedActive = false;
      }
    }

    if (drip.age > 8 && drip.visualTurnAge >= 2) {
      const fadeRate = 1 / Math.max(14, drip.lifespan);
      drip.alpha -= fadeRate * simDt;
      drip.thickness = Math.max(1.1, drip.thickness - 0.035 * simDt);
    }
    if (drip.alpha <= 0.02 && !drip.detachedActive) {
      drip.active = false;
    }
  }

  for (let i = 0; i < SCREEN_BLOOD_POOL_SIZE; i++) {
    const sb = sim.screenBlood[i];
    if (!sb.active) continue;
    sb.age += simDt;
    if (sb.age >= sb.lifespan) {
      sb.active = false;
      continue;
    }
    const lifeNorm = sb.age / sb.lifespan;
    const profile = getBloodBiologyProfile(sb.owner);
    const slideSlowdown = Math.max(0.05, 1 - lifeNorm * 1.15) * (1.15 - profile.viscosity * 0.4);
    sb.slideOffsetPx += sb.slideSpeed * slideSlowdown * simDt;
    sb.streakLen = Math.min(18, sb.slideOffsetPx * 0.85);
    if (lifeNorm > 0.35) {
      const fadeT = (lifeNorm - 0.35) / 0.65;
      sb.alpha = Math.max(0, 0.88 * (1 - fadeT * fadeT));
    }
  }
}
