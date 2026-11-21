import {
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  type CombatStageSim,
  getBridgeGroundY,
} from './combatStageTypes';
import {
  type BloodOwnerKind,
  type BloodShapeKind,
  getBloodBiologyProfile,
} from './mutantBlood';

export function getBridgeEdgeY(sim: CombatStageSim): number {
  if (sim.deckGradFrontY > 0) return sim.deckGradFrontY;
  return getBridgeGroundY(sim.size.h) + Math.round(sim.size.h * 0.032);
}

export function getBridgeBackY(sim: CombatStageSim): number {
  if (sim.deckGradBackY > 0) return sim.deckGradBackY;
  return getBridgeGroundY(sim.size.h) - Math.round(sim.size.h * 0.055);
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
