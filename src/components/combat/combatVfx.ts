import { soundEngine } from '../../audio/soundEngine';
import type { AnimationCue, CombatState, EnemyArchetype, HeroineState } from '../../engine/types';
import { triggerCharacterAnimation } from '../../utils/aureliaSpriteSheet';
import { shouldKiraDodgeAttack } from '../../utils/heroineSpriteSheet';
import type { CameraActorBounds } from './ActionCameraController';
import {
  type CombatPresentationConfig,
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
  computeNonCutInBeatMs,
  computePackTempoScale,
} from './combatPresentationConfig';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import {
  type ProjectileVisualProfile,
  classifyEnemyAttackStaging,
  classifyHeroAttackStaging,
} from './combatStagingClassifier';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  FLOOR_FISSURE_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  TEXT_POOL_SIZE,
  type ActorAnim,
  type CombatStageSim,
  type PendingImpact,
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
  getEquippedDefIds,
  resolveWeaponDecalKind,
} from './mutantBlood';

export function triggerKiraDodgeVfx(
  sim: CombatStageSim,
  liveHeroX: number,
  groundY: number,
): void {
  sim.heroState = triggerCharacterAnimation(sim.heroState, 'dodge', 'kira');
  sim.shieldDomeTimer = 0;
  sim.dodgeZoomTimer = 0.70;
  sim.trauma = Math.min(1, sim.trauma + 0.05);
  soundEngine.playDodgeWhoosh();

  // Beat 1: Vault launch burst (electric cyan + neon magenta rim sparks)
  spawnBurst(sim, liveHeroX + 6, groundY - 26, 14, '#00F0FF', 1, 1.02);
  spawnBurst(sim, liveHeroX - 4, groundY - 46, 8, '#F472B6', 0, 0.85);
  spawnFloatingText(sim, liveHeroX - 6, groundY - 156, 'MISS', '#00F0FF', 1.24);

  // Beat 2: Wide neon power-slide deck sparks
  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.18,
    execute: () => {
      spawnBurst(sim, liveHeroX - 18, groundY - 6, 12, '#00F0FF', 1, 0.92);
      spawnBurst(sim, liveHeroX - 28, groundY - 3, 7, '#38BDF8', 0, 0.78);
    },
  });

  // Beat 3: Deep slide braking skid sparks
  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.35,
    execute: () => {
      spawnBurst(sim, liveHeroX - 30, groundY - 5, 11, '#00F0FF', 1, 0.88);
      spawnBurst(sim, liveHeroX - 22, groundY - 4, 6, '#F472B6', 0, 0.72);
    },
  });

  // Beat 4: 3-point superhero landing micro-shatter sparks
  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.51,
    execute: () => {
      spawnBurst(sim, liveHeroX - 8, groundY - 3, 12, '#38BDF8', 1, 0.86);
      spawnBurst(sim, liveHeroX + 4, groundY - 2, 6, '#FDE047', 1, 0.65);
    },
  });
}

export function spawnBurst(
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

export function addGroundFissure(
  sim: CombatStageSim,
  x: number,
  y: number,
  scale = 1,
  heatIntensity = 1,
): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const backY = getBridgeBackY(sim);
  const clampedX = Math.max(36, Math.min(w - 36, x));
  const clampedY = Math.max(backY + 4, Math.min(Math.max(groundY + 12, edgeY - 4), y));

  const fissure = sim.floorFissures[sim.floorFissureCursor];
  sim.floorFissureCursor = (sim.floorFissureCursor + 1) % FLOOR_FISSURE_POOL_SIZE;
  fissure.active = true;
  fissure.x = clampedX;
  fissure.y = clampedY;
  fissure.scale = Math.max(0.65, Math.min(1.6, scale));
  fissure.seed = (fissure.seed + 1.37) % 100 || Math.random() * 50;
  fissure.createdTurn = sim.currentTurn;
  fissure.visualTurnAge = 0;
  fissure.age = 0;
  fissure.alpha = 0.96;
  fissure.heatIntensity = Math.max(0.2, Math.min(1.25, heatIntensity));
}

export function spawnBruteKineticShards(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorY: number,
  count: number,
  palette: 'seismic' | 'chitin' | 'vial' = 'seismic',
  dir = -1,
): void {
  const colors =
    palette === 'chitin'
      ? ['#FB923C', '#EA580C', '#FDBA74', '#FEF3C7']
      : palette === 'vial'
        ? ['#4ADE80', '#22C55E', '#A7F3D0', '#E0F2FE']
        : ['#67E8F9', '#E0F2FE', '#FB923C', '#FACC15'];
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const spreadAngle =
      palette === 'seismic'
        ? -Math.PI * 0.5 + (Math.random() - 0.5) * 1.95
        : -Math.PI * 0.48 + dir * 0.32 + (Math.random() - 0.5) * 1.5;
    const spd =
      palette === 'seismic'
        ? 110 + Math.random() * 210
        : palette === 'chitin'
          ? 125 + Math.random() * 220
          : 75 + Math.random() * 140;
    p.active = true;
    p.x = cx + (Math.random() - 0.5) * (palette === 'seismic' ? 42 : 24);
    p.y = cy + (Math.random() - 0.5) * 12;
    p.vx = Math.cos(spreadAngle) * spd;
    p.vy = Math.sin(spreadAngle) * spd - (palette === 'seismic' ? 75 : 55);
    p.life = 0;
    p.maxLife = 0.52 + Math.random() * 0.42;
    p.size = palette === 'seismic' ? 3.8 + Math.random() * 4.5 : 3.2 + Math.random() * 4.0;
    p.color = colors[i % colors.length];
    p.shape = 3;
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = (Math.random() - 0.5) * 18;
    p.gravity = 540;
    p.floorY = floorY + (Math.random() - 0.5) * 6;
    p.bounced = false;
  }
}

export function spawnBruteMutagenMist(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  count: number,
  intensity = 1,
): void {
  const mistColors = ['#A3E635', '#4ADE80', '#BEF264', '#22C55E'];
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.1;
    const spd = (28 + Math.random() * 64) * Math.max(0.75, intensity);
    p.active = true;
    p.x = cx + (Math.random() - 0.5) * 26;
    p.y = cy + (Math.random() - 0.5) * 18;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd - 24;
    p.life = 0;
    p.maxLife = 0.72 + Math.random() * 0.58;
    p.size = (12 + Math.random() * 14) * Math.max(0.85, Math.min(1.4, intensity));
    p.color = mistColors[i % mistColors.length];
    p.shape = 4;
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = (Math.random() - 0.5) * 1.4;
    p.gravity = -42; // Rising buoyant toxic vapor
    p.floorY = 9999;
    p.bounced = false;
  }
}

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

  // Coalesce into an existing nearby edge drip so it swells thicker and pinches off heavy drops
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
  // High-viscosity blood stretches more sluggishly
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

  // Coalesce into nearby fresh cover splatter on the same surface
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

  // If blood lands right at the front lip of the bridge, feed a sluggish edge drip & curb splatter
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

  // Merge into a nearby fresh puddle of the same biology & compatible shape
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

function emitBloodDroplets(
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
      // Directional cone away from firing vector, spraying toward rear cover and downrange floor
      const forwardCone = i % 4 !== 0;
      angle = forwardCone
        ? forwardBaseAngle + (Math.random() - 0.5) * 0.62 * Math.PI
        : (dirX >= 0 ? -0.88 * Math.PI : -0.12 * Math.PI) + (Math.random() - 0.5) * 0.4 * Math.PI;
      speed = (140 + Math.random() * 410) * (0.82 + intensity * 0.34);
    } else if (weaponKind === 'melee') {
      // Wide sweeping crescent spray across both vertical and horizontal axes
      angle = -0.92 * Math.PI + Math.random() * 1.05 * Math.PI;
      speed = (110 + Math.random() * 340) * (0.8 + intensity * 0.3);
    } else {
      // Plasma cauterizes: minimal high-heat radial micro-sparks/vapor droplets
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

    // Place droplets along outer peripheral bezel/corners so center action & top HUD remain 100% unobstructed
    const zoneRoll = Math.random();
    let nx: number;
    let ny: number;
    if (zoneRoll < 0.44) {
      // Lower visor rim
      nx = 0.08 + Math.random() * 0.84;
      ny = 0.83 + Math.random() * 0.13;
    } else if (zoneRoll < 0.8) {
      // Side margins (biased toward impact side, with occasional cross-lens flick)
      const onRight = Math.random() < (biasRight ? 0.72 : 0.28);
      nx = onRight ? 0.84 + Math.random() * 0.13 : 0.03 + Math.random() * 0.12;
      ny = 0.24 + Math.random() * 0.68;
    } else {
      // Outer upper corners (outside central telemetry strip)
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
    // Plasma cauterizes: only very rarely flicks 1 small drop on a lethal KO
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

  // 1. Airborne droplets & mist bursts tailored to weapon damage type
  const dropMultiplier = weaponKind === 'plasma' ? 0.28 : weaponKind === 'melee' ? 0.92 : 1.08;
  const dropCount = Math.min(96, Math.round((isKo ? 60 : 36) * intensity * dropMultiplier));
  emitBloodDroplets(sim, cx, cy, floorCenterY, dropCount, intensity, owner, weaponKind, dirX);

  spawnBurst(
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
  spawnBurst(
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

  // 1.5 Occasional Fourth-Wall Cyber-Visor Screen Droplets (biology & weapon aware)
  maybeSprayFourthWallVisor(sim, cx, owner, weaponKind, intensity, isKo);

  // 2. Weapon-Driven Floor & Cover Decals
  if (weaponKind === 'plasma') {
    // Cauterized, bubbling black-and-neon scorch ring with minimal splatter
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
    // Wide, sweeping crescent arcs across floor + cover
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
    // Flanking arc droplets
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
    // Sweeping melee splatters draped onto rear cover barrier & front curb
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

  // Kinetic: directional cone of droplets sprayed away from firing vector onto floor & cover walls
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

  // Project directional cone splatters onto rear half-cover barrier & front curb behind target
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

export function spawnGreenBloodSpray(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorCenterY: number,
  intensity = 1,
  isKo = false,
): void {
  spawnAlienBloodImpact(sim, cx, cy, floorCenterY, 'larva', 'kinetic', intensity, isKo, 1);
}

function triggerEnemyHitStagger(
  sim: CombatStageSim,
  enemyId: string,
  pos: { x: number; y: number; groundY: number },
  owner: BloodOwnerKind = 'larva',
  weaponKind: WeaponDecalKind = 'kinetic',
  intensity = 1,
  isKo = false,
  dirX = 1,
  plasmaColor = '#00F0FF',
): void {
  const ea = ensureEnemyAnim(sim, enemyId);
  const dur = isKo ? 0.68 : Math.min(0.62, 0.38 + intensity * 0.11);
  ea.flashTimer = Math.max(ea.flashTimer, isKo ? 0.14 : 0.1);
  ea.staggerDuration = dur;
  ea.staggerTimer = dur;
  ea.staggerIntensity = Math.max(0.85, Math.min(2.1, intensity));
  ea.bleedSpurtTimer = 0.04;
  sim.enemyWoundOrigins.set(enemyId, { ...pos, owner });
  spawnAlienBloodImpact(
    sim,
    pos.x,
    pos.y,
    pos.groundY,
    owner,
    weaponKind,
    intensity,
    isKo,
    dirX,
    plasmaColor,
  );
}

export function spawnFloatingText(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  text: string,
  color: string,
  scale = 1,
): void {
  const ft = sim.texts[sim.textCursor];
  sim.textCursor = (sim.textCursor + 1) % TEXT_POOL_SIZE;
  ft.active = true;
  ft.x = cx;
  ft.y = cy;
  ft.vy = -52;
  ft.life = 0;
  ft.maxLife = 0.95;
  ft.text = text;
  ft.color = color;
  ft.scale = scale;
}

export function spawnBolt(
  sim: CombatStageSim,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  color: string,
  onImpact?: () => void,
  style: ProjectileVisualProfile = 'pistol_bolt',
  durationOverrideSec?: number,
): void {
  const b = sim.bolts[sim.boltCursor];
  sim.boltCursor = (sim.boltCursor + 1) % BOLT_POOL_SIZE;
  const dist = Math.hypot(tx - sx, ty - sy);
  b.active = true;
  b.x = sx;
  b.y = sy;
  b.startX = sx;
  b.startY = sy;
  b.targetX = tx;
  b.targetY = ty;
  b.life = 0;
  b.maxLife =
    durationOverrideSec !== undefined
      ? Math.max(0.06, Math.min(0.45, durationOverrideSec))
      : Math.max(0.08, Math.min(0.14, dist / 4400));
  b.color = color;
  b.style = style;
  b.onImpact = onImpact;
}

/**
 * Fires weapon- and archetype-specific foreground projectiles above the stage dimmer
 * so every ranged character and enemy has an unmistakable silhouette in flight.
 */
export function spawnStyledProjectileVolley(
  sim: CombatStageSim,
  params: {
    profile: ProjectileVisualProfile;
    sx: number;
    sy: number;
    tx: number;
    ty: number;
    isCrit?: boolean;
    isOverdrive?: boolean;
    flightSec?: number;
    onPrimaryImpact?: () => void;
  },
): void {
  const {
    profile,
    sx,
    sy,
    tx,
    ty,
    isCrit = false,
    isOverdrive = false,
    flightSec,
    onPrimaryImpact,
  } = params;

  if (profile === 'scattergun') {
    // Aurelia twin-barrel plasma scattergun: wide multi-pellet golden-amber spread
    const pellets = isOverdrive || isCrit ? [-16, -6, 4, 14, 22] : [-13, -4, 5, 14];
    for (let i = 0; i < pellets.length; i++) {
      const spreadY = pellets[i];
      const color = i === 0 ? '#FFE066' : i % 2 === 1 ? '#FFC700' : '#FF6B35';
      spawnBolt(
        sim,
        sx + (i % 2 === 0 ? 0 : -4),
        sy + spreadY * 0.28,
        tx + (i - 1.5) * 4,
        ty + spreadY,
        color,
        i === 0 ? onPrimaryImpact : undefined,
        'scattergun',
        flightSec !== undefined ? flightSec * (0.94 + i * 0.03) : undefined,
      );
    }
    spawnBurst(sim, sx, sy, isCrit ? 16 : 11, '#FFC700', 0, isCrit ? 1.15 : 0.95);
    return;
  }

  if (profile === 'drone_plasma') {
    // Zuri Solar Hawk Strike Drone: twin rotary magenta/gold plasma lances
    spawnBolt(sim, sx, sy - 3.5, tx, ty - 4, '#FF2E7E', onPrimaryImpact, 'drone_plasma', flightSec);
    spawnBolt(sim, sx - 5, sy + 4, tx, ty + 4, '#FFC700', undefined, 'drone_plasma', flightSec);
    if (isCrit || isOverdrive) {
      spawnBolt(sim, sx - 2, sy, tx, ty, '#00F0FF', undefined, 'drone_plasma', flightSec);
    }
    spawnBurst(sim, sx, sy, isCrit ? 14 : 9, '#FF2E7E', 1, isCrit ? 1.1 : 0.92);
    return;
  }

  if (profile === 'acid_bile') {
    // Bile Spitter pressurized neon-yellow/chartreuse bile glob stream
    spawnBolt(sim, sx, sy, tx, ty, '#A3E635', onPrimaryImpact, 'acid_bile', flightSec);
    spawnBolt(
      sim,
      sx + 6,
      sy + 5,
      tx + 4,
      ty + 7,
      '#FACC15',
      undefined,
      'acid_bile',
      flightSec !== undefined ? flightSec * 1.08 : undefined,
    );
    spawnBurst(sim, sx - 6, sy, 12, '#FACC15', 2, 0.95);
    return;
  }

  if (profile === 'stinger_dart') {
    // Stinger charged barbed bio-venom dart volley
    const darts = isCrit ? [-12, 0, 12] : [-8, 8];
    for (let i = 0; i < darts.length; i++) {
      const dy = darts[i];
      const color = i === 1 ? '#FDBA74' : '#FB923C';
      spawnBolt(
        sim,
        sx + i * 5,
        sy + dy * 0.35,
        tx,
        ty + dy,
        color,
        i === 0 ? onPrimaryImpact : undefined,
        'stinger_dart',
        flightSec !== undefined ? flightSec * (0.94 + i * 0.04) : undefined,
      );
    }
    spawnBurst(sim, sx - 4, sy, 14, '#FB923C', 1, 1.05);
    return;
  }

  // Kira cyber-pistol plasma tracer bolt
  spawnBolt(
    sim,
    sx,
    sy,
    tx,
    ty,
    isOverdrive || isCrit ? '#FFC700' : '#00F0FF',
    onPrimaryImpact,
    'pistol_bolt',
    flightSec,
  );
  spawnBurst(sim, sx, sy, 8, '#FDE047', 0, 0.85);
}

export function drainTriggerImpacts(
  sim: CombatStageSim,
  trigger: 'shot1' | 'shot2' | 'kick' | 'cutin_impact',
): (() => void) | undefined {
  const matched: PendingImpact[] = [];
  for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
    if (sim.pendingImpacts[i].triggerOn === trigger) {
      matched.unshift(sim.pendingImpacts[i]);
      sim.pendingImpacts.splice(i, 1);
    }
  }
  if (matched.length === 0) return undefined;
  return () => {
    for (let i = 0; i < matched.length; i++) {
      matched[i].execute();
    }
  };
}

function ensureEnemyAnim(sim: CombatStageSim, id: string): ActorAnim {
  let ea = sim.enemyAnims.get(id);
  if (!ea) {
    ea = {
      flashTimer: 0,
      lunge: 0,
      lungeDir: -1,
      koProgress: 0,
      dead: false,
      staggerTimer: 0,
      staggerDuration: 0.44,
      staggerIntensity: 1,
      bleedSpurtTimer: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0,
      bristleDuration: 0.5,
      bristleKind: 'armor',
    };
    sim.enemyAnims.set(id, ea);
  }
  return ea;
}

function syncCombatBloodState(sim: CombatStageSim, combat: CombatState): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const { slotCenters, effectiveSlotCount: slotCount } = computeEnemySlotLayout(
    combat.enemies,
    combat.director?.pendingReinforcements,
  );
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, slotCount);

  // Track turn progression and prune future decals if the player triggered Turn Undo
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

  // Track enemy slot positions & armor for Bleeding/Shredded movement trail decals (e.g. Push [R] or pack shifts)
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

  // Clean up any departed enemies
  sim.prevEnemySlots.forEach((_, id) => {
    if (!livingIds.has(id)) {
      sim.prevEnemySlots.delete(id);
    }
  });
}

export interface ApplyCombatCuesOptions {
  presentationConfig?: CombatPresentationConfig;
  tacticalViewActive?: boolean;
  onSequenceComplete?: (batchKey: string) => void;
}

export function applyCombatCues(
  sim: CombatStageSim,
  combat: CombatState,
  heroine: HeroineState,
  options?: ApplyCombatCuesOptions,
): void {
  syncCombatBloodState(sim, combat);

  const cues: AnimationCue[] = combat.lastCues;
  if (!cues || cues.length === 0) {
    sim.lastCueBatchKey = '';
    return;
  }

  const batchKey = cues.map((c) => c.id).join('|');
  if (batchKey === sim.lastCueBatchKey) return;
  sim.lastCueBatchKey = batchKey;
  sim.batchActiveKey = batchKey;
  sim.onBatchComplete = options?.onSequenceComplete;
  sim.batchMicroTimerRemaining = 0;
  sim.needsRedraw = true;

  const { w, h } = sim.size;
  const charId = heroine.characterId ?? 'kira';
  const equippedDefIds = getEquippedDefIds(heroine);
  const groundY = getBridgeGroundY(h);
  const heroX = w < 460 ? w * 0.19 : w * 0.22;
  const { slotCenters, dropCenters, effectiveSlotCount: slotCount } = computeEnemySlotLayout(
    combat.enemies,
    combat.director?.pendingReinforcements,
  );
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, slotCount);
  const presCfg = options?.presentationConfig ?? DEFAULT_COMBAT_PRESENTATION_CONFIG;
  const tacticalViewActive = Boolean(options?.tacticalViewActive);
  const livingEnemyCount = Math.max(1, combat.enemies.filter((e) => e.hp > 0).length);
  const tempoScale = computePackTempoScale(livingEnemyCount, presCfg.adaptivePackSpeedup);

  const getEnemyArch = (targetId?: string): EnemyArchetype => {
    const found = combat.enemies.find((e) => e.id === targetId);
    return found?.archetype ?? 'larva';
  };

  const getEnemyPos = (targetId?: string): { x: number; y: number; groundY: number } => {
    const idx = combat.enemies.findIndex((e) => e.id === targetId);
    const safeIdx = idx >= 0 ? idx : 0;
    const staggerY = safeIdx % 2 === 1 ? -6 : 0;
    const enemyGroundY = groundY + staggerY;
    const centerSlot = slotCenters[safeIdx] ?? safeIdx;
    return {
      x: enemyBaseX + centerSlot * enemyStepX,
      y: enemyGroundY - 88,
      groundY: enemyGroundY,
    };
  };

  const buildActorBounds = (actorId: string): CameraActorBounds => {
    if (actorId === 'hero') {
      const heroHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
      return {
        id: 'hero',
        x: heroX,
        groundY,
        widthPx: heroHeight * 0.72,
        heightPx: heroHeight,
      };
    }
    const pos = getEnemyPos(actorId);
    const arch = getEnemyArch(actorId);
    const crowdScale = slotCount >= 5 ? 0.78 : slotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale =
      arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : arch === 'larva'
            ? 0.76
            : arch === 'skitter'
              ? 0.88
              : arch === 'stinger'
                ? 0.96
                : 0.94;
    const heightPx = baseEnemySize * archScale;
    return {
      id: actorId,
      x: pos.x,
      groundY: pos.groundY,
      widthPx: heightPx * 0.82,
      heightPx,
    };
  };

  // Ensure every enemy has an ActorAnim entry up front so dying enemies stay visible until impact
  for (let i = 0; i < combat.enemies.length; i++) {
    ensureEnemyAnim(sim, combat.enemies[i].id);
  }

  // Flush any leftover un-triggered impacts if a new batch interrupts mid-clip
  if (sim.pendingImpacts.length > 0) {
    const toRun = sim.pendingImpacts.splice(0, sim.pendingImpacts.length);
    for (let i = 0; i < toRun.length; i++) toRun[i].execute();
  }

  const koIds = new Set(
    cues.filter((c) => c.kind === 'enemy_ko' && c.targetId).map((c) => c.targetId as string),
  );
  koIds.forEach((id) => {
    const ea = ensureEnemyAnim(sim, id);
    if (!ea.dead) {
      ea.koProgress = 0;
    }
  });

  const allActorIds: string[] = [
    'hero',
    ...combat.enemies.filter((e) => e.hp > 0 || koIds.has(e.id)).map((e) => e.id),
  ];

  const slashCues = cues.filter((c) => c.kind === 'hero_slash');
  const primarySlashCue = slashCues.find((c) => !c.id.endsWith('_def_pulse'));
  const hasOverdrive = cues.some((c) => c.kind === 'hero_overdrive');

  let primaryAttackMode: 'dash_kick' | 'shoot' | null = null;
  let cutInStarted = false;
  let kiraDodgeScheduled = false;
  if (primarySlashCue) {
    const pos = getEnemyPos(primarySlashCue.targetId);
    sim.pendingShotTargetX = pos.x;
    sim.pendingShotTargetY = pos.y;
    sim.dashTargetX = pos.x;

    const targetIds = Array.from(
      new Set(
        slashCues
          .map((c) => c.targetId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const heroClassification = classifyHeroAttackStaging({
      charId,
      isSurge: Boolean(primarySlashCue.surge),
      damageValue: primarySlashCue.value ?? 0,
      targetCount: Math.max(1, targetIds.length),
      attackToggle: sim.attackToggle,
      isOverdrive: false,
    });
    sim.attackToggle += 1;
    primaryAttackMode = heroClassification.heroAnimMode === 'dash_kick' ? 'dash_kick' : 'shoot';
    sim.heroState = triggerCharacterAnimation(sim.heroState, primaryAttackMode, charId);

    if (!tacticalViewActive && presCfg.enabled && !hasOverdrive) {
      if (targetIds.length > 0) {
        cutInStarted = true;
        const isCrit =
          Boolean(primarySlashCue.surge) ||
          (primarySlashCue.targetId ? koIds.has(primarySlashCue.targetId) : false) ||
          (primarySlashCue.value ?? 0) >= 18;
        const actionKind: CutInActionKind = isCrit
          ? 'crit'
          : targetIds.length > 1
            ? 'aoe'
            : 'normal';
        const stagingMode: CutInStagingMode = heroClassification.stagingMode;
        void sim.actionSequencer
          .playCutIn(
            {
              id: batchKey,
              actionKind,
              stagingMode,
              attackerId: 'hero',
              targetIds,
              allActorIds,
              attackerBounds: buildActorBounds('hero'),
              targetBounds: targetIds.map((id) => buildActorBounds(id)),
              tempoScale: 1.0,
              waitForExternalImpact: true,
              replaceQueue: true,
            },
            presCfg,
            w,
            h,
          )
          .then(() => {
            if (sim.batchActiveKey === batchKey) {
              sim.lastCompletedBatchKey = batchKey;
              sim.onBatchComplete?.(batchKey);
            }
          });
      }
    }
  }

  const triggerEnemyKo = (
    enemyId: string,
    weaponKind: WeaponDecalKind = 'kinetic',
    plasmaColor = '#00F0FF',
  ) => {
    const ea = ensureEnemyAnim(sim, enemyId);
    ea.dead = true;
    ea.koProgress = Math.max(0.01, ea.koProgress);
    const basePos = getEnemyPos(enemyId);
    const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemyId, basePos.x) };
    const arch = getEnemyArch(enemyId);
    const profile = getBloodBiologyProfile(arch);
    triggerEnemyHitStagger(sim, enemyId, pos, arch, weaponKind, 1.75, true, 1, plasmaColor);
    spawnBurst(sim, pos.x, pos.y, 28, profile.freshEmissive, 1, 1.25);
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.kind === 'hero_slash') {
      const pos = getEnemyPos(cue.targetId);
      const arch = getEnemyArch(cue.targetId);
      const isDefPulse = cue.id.endsWith('_def_pulse');
      const weaponKind = resolveWeaponDecalKind({
        attackMode: isDefPulse ? null : primaryAttackMode,
        characterId: charId,
        equippedDefIds,
        cueId: cue.id,
        cueKind: cue.kind,
        isSurge: Boolean(cue.surge),
      });
      const plasmaColor =
        charId === 'zuri' ? '#FF2E7E' : charId === 'aurelia' ? '#FFC700' : '#00F0FF';
      if (cue.targetId) ensureEnemyAnim(sim, cue.targetId);

      if (isDefPulse) {
        sim.pendingImpacts.push({
          triggerOn: 'delay',
          delayRemaining: 0.11,
          execute: () => {
            spawnBolt(sim, heroX + 42, groundY - 96, pos.x, pos.y, '#00E5FF', () => {
              sim.pendingShotTargetX = pos.x;
              sim.pendingShotTargetY = pos.y;
              sim.trauma = Math.min(1, sim.trauma + 0.28);
              if (cue.targetId) {
                triggerEnemyHitStagger(
                  sim,
                  cue.targetId,
                  pos,
                  arch,
                  'plasma',
                  1.15,
                  koIds.has(cue.targetId),
                  1,
                  '#00F0FF',
                );
              }
              spawnBurst(sim, pos.x, pos.y, 16, '#00E5FF', 1, 1);
              if (cue.value) spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#38BDF8', 1.05);
              if (cue.targetId && koIds.has(cue.targetId)) {
                triggerEnemyKo(cue.targetId, 'plasma', '#00F0FF');
              }
            });
          },
        });
      } else if (primaryAttackMode === 'dash_kick') {
        sim.pendingImpacts.push({
          triggerOn: 'kick',
          delayRemaining: 0,
          execute: () => {
            const livePos = cue.targetId
              ? { ...pos, x: sim.actionSequencer.getLiveActorX(cue.targetId, pos.x) }
              : pos;
            sim.pendingShotTargetX = livePos.x;
            sim.pendingShotTargetY = livePos.y;
            sim.slashArcTimer = 0.28;
            sim.slashSurge = Boolean(cue.surge);
            if (!sim.actionSequencer.isActive()) {
              sim.hitstop = cue.surge ? 0.06 : 0.04;
            }
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.68 : 0.46));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                livePos,
                arch,
                weaponKind,
                cue.surge ? 1.65 : 1.35,
                koIds.has(cue.targetId),
                1,
                plasmaColor,
              );
            }
            spawnBurst(sim, livePos.x, livePos.y, cue.surge ? 26 : 16, '#FF3B7F', 1, cue.surge ? 1.25 : 1);
            if (cue.value) {
              spawnFloatingText(sim, livePos.x, livePos.y - 40, `-${cue.value}`, '#FF6B9E', cue.surge ? 1.3 : 1.05);
            }
            if (cue.targetId && koIds.has(cue.targetId)) {
              triggerEnemyKo(cue.targetId, weaponKind, plasmaColor);
            }
          },
        });
      } else {
        sim.pendingImpacts.push({
          triggerOn: 'shot1',
          delayRemaining: 0,
          execute: () => {
            sim.slashArcTimer = 0.26;
            sim.slashSurge = Boolean(cue.surge);
            if (!sim.actionSequencer.isActive()) {
              sim.hitstop = cue.surge ? 0.048 : 0.028;
            }
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.56 : 0.36));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                arch,
                weaponKind,
                cue.surge ? 1.35 : 1.08,
                false,
                1,
                plasmaColor,
              );
            }
            spawnBurst(sim, pos.x, pos.y, cue.surge ? 22 : 14, '#FF3B7F', 1, cue.surge ? 1.2 : 1);
            if (cue.value) {
              spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#FF6B9E', cue.surge ? 1.3 : 1.05);
            }
          },
        });
        sim.pendingImpacts.push({
          triggerOn: 'shot2',
          delayRemaining: 0,
          execute: () => {
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                arch,
                weaponKind,
                cue.surge ? 1.45 : 1.18,
                koIds.has(cue.targetId),
                1,
                plasmaColor,
              );
            }
            spawnBurst(sim, pos.x, pos.y, 12, '#00E5FF', 1, 0.95);
            if (cue.targetId && koIds.has(cue.targetId)) {
              triggerEnemyKo(cue.targetId, weaponKind, plasmaColor);
            }
          },
        });
      }
    } else if (cue.kind === 'hero_shield') {
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'guard', charId);
      sim.shieldDomeTimer = 0.48;
      spawnBurst(sim, heroX, groundY - 95, cue.surge ? 20 : 12, '#00E5FF', 1, 0.85);
      if (cue.value) {
        spawnFloatingText(sim, heroX, groundY - 150, `+${cue.value} SHD`, '#38BDF8', 1.05);
      }
    } else if (cue.kind === 'hero_tech') {
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'upgrade', charId);
      sim.upgradeBeamTimer = 0.55;
      spawnBurst(sim, heroX, groundY - 95, cue.surge ? 22 : 14, '#FFB800', 1, 0.9);
      spawnFloatingText(
        sim,
        heroX,
        groundY - 155,
        cue.textLabel || (cue.surge ? 'TECH SURGE' : 'TECH'),
        '#FCD34D',
        1.05,
      );
    } else if (cue.kind === 'hero_overdrive') {
      const livingOrKo = combat.enemies.filter((e) => e.hp > 0 || koIds.has(e.id));
      const frontTarget = livingOrKo[0];
      const frontPos = getEnemyPos(frontTarget?.id);
      sim.pendingShotTargetX = frontPos.x;
      sim.pendingShotTargetY = frontPos.y;
      sim.dashTargetX = frontPos.x;
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'overdrive', charId);

      for (const e of livingOrKo) ensureEnemyAnim(sim, e.id);

      if (!tacticalViewActive && presCfg.enabled && !cutInStarted && livingOrKo.length > 0) {
        cutInStarted = true;
        const targetIds = livingOrKo.map((e) => e.id);
        const odClassification = classifyHeroAttackStaging({
          charId,
          isOverdrive: true,
          targetCount: targetIds.length,
          attackToggle: sim.attackToggle,
        });
        void sim.actionSequencer
          .playCutIn(
            {
              id: batchKey,
              actionKind: 'overdrive',
              stagingMode: odClassification.stagingMode,
              attackerId: 'hero',
              targetIds,
              allActorIds,
              attackerBounds: buildActorBounds('hero'),
              targetBounds: targetIds.map((id) => buildActorBounds(id)),
              tempoScale: 1.0,
              waitForExternalImpact: true,
              replaceQueue: true,
            },
            presCfg,
            w,
            h,
          )
          .then(() => {
            if (sim.batchActiveKey === batchKey) {
              sim.lastCompletedBatchKey = batchKey;
              sim.onBatchComplete?.(batchKey);
            }
          });
      }

      sim.pendingImpacts.push({
        triggerOn: 'kick',
        delayRemaining: 0,
        execute: () => {
          sim.overdriveTimer = 0.68;
          if (!sim.actionSequencer.isActive()) {
            sim.hitstop = 0.055;
          }
          sim.trauma = 0.78;
          for (const enemy of livingOrKo) {
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'melee', 1.5, false, 1, '#FFC700');
            spawnBurst(sim, pos.x, pos.y, 18, '#FF3B7F', 1, 1.2);
          }
        },
      });

      sim.pendingImpacts.push({
        triggerOn: 'shot1',
        delayRemaining: 0,
        execute: () => {
          sim.trauma = Math.min(1, sim.trauma + 0.45);
          for (const enemy of livingOrKo) {
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'plasma', 1.55, false, 1, '#FFC700');
            spawnBurst(sim, pos.x, pos.y, 22, '#FFB800', 1, 1.25);
            spawnFloatingText(sim, pos.x, pos.y - 45, `-${cue.value ?? 22}`, '#FDE047', 1.35);
          }
        },
      });

      sim.pendingImpacts.push({
        triggerOn: 'shot2',
        delayRemaining: 0,
        execute: () => {
          for (const enemy of livingOrKo) {
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            if (koIds.has(enemy.id)) {
              triggerEnemyKo(enemy.id, 'plasma', '#FFC700');
            } else {
              triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'plasma', 1.35, false, 1, '#FFC700');
            }
          }
        },
      });
    } else if (cue.kind === 'enemy_attack' || cue.kind === 'enemy_acid') {
      const attacker = combat.enemies.find((e) => e.id === cue.targetId);
      const attackerArch = attacker?.archetype ?? 'larva';
      const attackerPos = getEnemyPos(cue.targetId);
      const blocked = cue.blocked ?? 0;
      const armorDamage = cue.armorDamage ?? 0;
      const hpDamage = cue.hpDamage ?? (cue.value ?? 0);
      const reflected = cue.reflectedDamage ?? 0;
      const isAcid = cue.kind === 'enemy_acid';
      const isSpitterClawRend = attackerArch === 'spitter' && !isAcid && Boolean(cue.clawRend);
      const isBruteHeavy = attackerArch === 'brute' && !isAcid && Boolean(cue.heavySmash);
      if (cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.lunge = 1;
        ea.lungeDir = -1;
        const animDur =
          attackerArch === 'spitter'
            ? isAcid
              ? 0.78
              : 0.56
            : attackerArch === 'brute'
              ? isBruteHeavy
                ? 0.74
                : 0.58
              : 0.52;
        ea.attackAnimDuration = animDur;
        ea.attackAnimTimer = animDur;
        if (attackerArch === 'spitter') {
          ea.spitterAttackKind = isAcid ? 'spit' : 'claw';
        } else if (attackerArch === 'brute') {
          ea.bruteAttackKind = isBruteHeavy ? 'heavy' : 'attack';
        }
        if (attacker) {
          const status = getEnemyStatusVisualFlags(attacker, sim.enemyInitialArmor.get(attacker.id));
          if (status.isBleeding || status.isShredded) {
            spawnStatusTrail(
              sim,
              attacker.archetype,
              attackerPos.x,
              attackerPos.x - w * 0.08,
              attackerPos.groundY,
              4,
            );
          }
        }
      }
      const isStalkerAmbush = attackerArch === 'stalker' && blocked + hpDamage >= 10;
      const isLethal = heroine.hp <= 0;
      const lowHp = heroine.hp <= heroine.maxHp * 0.35;

      if (isLethal) {
        sim.heroState = triggerCharacterAnimation(sim.heroState, 'defeat', charId);
      }

      if (isAcid && attackerArch === 'spitter') {
        const mouthX = attackerPos.x - 42;
        const mouthY = attackerPos.groundY - 116;
        // Initial throat-sac condensation sparks
        spawnBurst(sim, mouthX, mouthY, 8, '#FEF08A', 2, 0.7);
        // Synchronized jaw-spray eruption at u = 0.22 (0.17s into 0.78s anim)
        sim.pendingImpacts.push({
          triggerOn: 'delay',
          delayRemaining: 0.17,
          execute: () => {
            spawnBurst(sim, mouthX - 8, mouthY, 16, '#FACC15', 2, 1.05);
            spawnBurst(sim, mouthX - 14, mouthY + 2, 12, '#A3E635', 2, 0.95);
            spawnBurst(sim, mouthX - 6, mouthY - 2, 8, '#FEF08A', 0, 0.85);
            emitBloodDroplets(
              sim,
              mouthX - 12,
              mouthY,
              attackerPos.groundY,
              10,
              1.15,
              'spitter',
              'kinetic',
              -1,
            );
          },
        });
      }

      const impactDelay = isAcid && attackerArch === 'spitter' ? 0.28 : 0.085;
      const enemyClassification = classifyEnemyAttackStaging({
        archetype: attackerArch,
        cueKind: cue.kind,
        clawRend: isSpitterClawRend,
      });
      const isStingerDart = enemyClassification.projectileProfile === 'stinger_dart';
      const isSpitterBile = enemyClassification.projectileProfile === 'acid_bile';
      const willKiraDodge = shouldKiraDodgeAttack({
        charId,
        isLethal,
        hpDamage,
        armorDamage,
      });
      if (willKiraDodge) {
        kiraDodgeScheduled = true;
        if (enemyClassification.projectileProfile) {
          const spawnX = isSpitterBile ? attackerPos.x - 42 : attackerPos.x - 36;
          const spawnY = isSpitterBile
            ? attackerPos.groundY - 116
            : attackerPos.groundY - 98;
          spawnStyledProjectileVolley(sim, {
            profile: enemyClassification.projectileProfile,
            sx: spawnX,
            sy: spawnY,
            tx: heroX + 18,
            ty: groundY - 90,
            isCrit: false,
            flightSec: Math.max(0.14, impactDelay),
          });
        }
      }
      const useCutInForEnemy =
        !willKiraDodge && !tacticalViewActive && presCfg.enabled && Boolean(cue.targetId) && !cutInStarted;
      if (useCutInForEnemy && cue.targetId) {
        cutInStarted = true;
        const isCritEnemy =
          Boolean(cue.heavySmash) ||
          attackerArch === 'boss' ||
          isStalkerAmbush ||
          isLethal ||
          hpDamage >= 12;
        const enemyActionKind: CutInActionKind = isCritEnemy ? 'crit' : 'normal';
        const enemyStagingMode: CutInStagingMode = enemyClassification.stagingMode;
        const flightSec = Math.max(0.11, presCfg.rangedWhipPanSec * tempoScale);
        void sim.actionSequencer
          .playCutIn(
            {
              id: batchKey,
              actionKind: enemyActionKind,
              stagingMode: enemyStagingMode,
              attackerId: cue.targetId,
              targetIds: ['hero'],
              allActorIds,
              attackerBounds: buildActorBounds(cue.targetId),
              targetBounds: [buildActorBounds('hero')],
              tempoScale,
              waitForExternalImpact: false,
              replaceQueue: true,
              onProjectileSpawn: enemyClassification.projectileProfile
                ? () => {
                    const projProfile = enemyClassification.projectileProfile!;
                    const spawnX = isSpitterBile ? attackerPos.x - 42 : attackerPos.x - 36;
                    const spawnY = isSpitterBile
                      ? attackerPos.groundY - 116
                      : attackerPos.groundY - 98;
                    spawnStyledProjectileVolley(sim, {
                      profile: projProfile,
                      sx: spawnX,
                      sy: spawnY,
                      tx: heroX + 18,
                      ty: groundY - 90,
                      isCrit: isCritEnemy,
                      flightSec,
                    });
                  }
                : undefined,
              onImpactFrame: () => {
                const runCutIn = drainTriggerImpacts(sim, 'cutin_impact');
                if (runCutIn) runCutIn();
              },
            },
            presCfg,
            w,
            h,
          )
          .then(() => {
            if (sim.batchActiveKey === batchKey) {
              sim.lastCompletedBatchKey = batchKey;
              sim.onBatchComplete?.(batchKey);
            }
          });
      }

      sim.pendingImpacts.push({
        triggerOn: useCutInForEnemy ? 'cutin_impact' : 'delay',
        delayRemaining: useCutInForEnemy ? 0 : impactDelay,
        execute: () => {
          const liveHeroX = sim.actionSequencer.getLiveActorX('hero', heroX);
          const liveAttackerX = cue.targetId
            ? sim.actionSequencer.getLiveActorX(cue.targetId, attackerPos.x)
            : attackerPos.x;
          const liveAttackerPos = { ...attackerPos, x: liveAttackerX };

          if (isStalkerAmbush) {
            spawnBurst(sim, liveHeroX + 20, groundY - 92, 16, '#FF2E7E', 1, 1.25);
          }
          if (isStingerDart) {
            spawnBurst(sim, liveHeroX + 18, groundY - 92, 18, '#FB923C', 1, 1.18);
            spawnBurst(sim, liveHeroX + 14, groundY - 88, 12, '#FDBA74', 0, 0.95);
          }
          if (isSpitterClawRend) {
            spawnBurst(sim, liveHeroX + 18, groundY - 92, 12, '#A3E635', 2, 0.95);
            spawnBurst(sim, liveHeroX + 14, groundY - 88, 10, '#C026D3', 1, 1.0);
            if (hpDamage > 0 && attacker && !koIds.has(attacker.id) && cue.textLabel) {
              spawnBurst(sim, liveAttackerX - 4, attackerPos.groundY - 98, 14, '#A3E635', 1, 0.9);
              spawnBurst(sim, liveAttackerX, attackerPos.groundY - 92, 8, '#FFC700', 1, 0.7);
              spawnFloatingText(sim, liveAttackerX, attackerPos.y - 42, cue.textLabel, '#BEF264', 0.98);
            }
          }
          if (!isLethal) {
            if (willKiraDodge) {
              triggerKiraDodgeVfx(sim, liveHeroX, groundY);
              if (isAcid) {
                spawnBurst(sim, liveHeroX + 42, groundY - 34, 12, '#A3E635', 2, 0.8);
                addOrGrowFloorBlood(sim, liveHeroX + 42, groundY + 2, 3.2, 0, {
                  owner: attackerArch,
                  shapeKind: 'scorch_ring',
                  plasmaColor: '#FACC15',
                });
              }
            } else if (hpDamage === 0) {
              sim.heroState = triggerCharacterAnimation(sim.heroState, 'guard', charId);
              sim.shieldDomeTimer = 0.46;
              sim.trauma = Math.min(1, sim.trauma + 0.14);
              spawnBurst(sim, liveHeroX + 38, groundY - 95, 16, '#00E5FF', 1, 0.9);
              if (isAcid) {
                spawnBurst(sim, liveHeroX + 36, groundY - 84, 16, '#FACC15', 2, 0.95);
                spawnBurst(sim, liveHeroX + 32, groundY - 82, 12, '#A3E635', 2, 0.85);
                addOrGrowFloorBlood(sim, liveHeroX + 28, groundY + 2, 3.6, 0, {
                  owner: attackerArch,
                  shapeKind: 'scorch_ring',
                  plasmaColor: '#FACC15',
                });
              }
              spawnFloatingText(sim, liveHeroX, groundY - 145, 'BLOCKED', '#38BDF8', 0.95);
            } else {
              if (blocked > 0) {
                sim.shieldDomeTimer = 0.25;
                spawnBurst(sim, liveHeroX + 32, groundY - 95, 10, '#00E5FF', 1, 0.85);
              }
              sim.heroState = triggerCharacterAnimation(sim.heroState, 'hit', charId, { lowHpHit: lowHp });
              sim.heroAnim.flashTimer = 0.085;
              sim.trauma = Math.min(1, sim.trauma + (isBruteHeavy ? 0.54 : isStalkerAmbush ? 0.48 : 0.35));
              spawnBurst(
                sim,
                liveHeroX + (isAcid ? 14 : 0),
                groundY - 85,
                isBruteHeavy || isStalkerAmbush || isAcid || isStingerDart ? 22 : 14,
                isAcid
                  ? '#FACC15'
                  : isBruteHeavy || isStingerDart
                    ? '#FB923C'
                    : isStalkerAmbush
                      ? '#FF2E7E'
                      : '#FB7185',
                isAcid ? 2 : 0,
                isBruteHeavy || isAcid || isStingerDart ? 1.08 : 0.9,
              );
              if (isAcid) {
                spawnBurst(sim, liveHeroX + 18, groundY - 88, 16, '#A3E635', 2, 0.98);
                spawnBurst(sim, liveHeroX + 16, groundY - 84, 10, '#FEF08A', 0, 0.88);
              }
              if (isBruteHeavy) {
                spawnBurst(sim, liveHeroX + 24, groundY - 12, 14, '#FACC15', 1, 1.0);
                const smashX = liveAttackerX - 44;
                addGroundFissure(sim, smashX, attackerPos.groundY + 1, 1.1, 1.0);
                spawnBruteKineticShards(sim, smashX, attackerPos.groundY - 10, attackerPos.groundY + 2, 16, 'seismic', -1);
              }
              spawnAlienBloodImpact(
                sim,
                liveHeroX + (isAcid ? 12 : 0),
                groundY - 78,
                groundY,
                isAcid ? 'spitter' : 'hero_blood',
                isAcid || isStingerDart ? 'plasma' : 'melee',
                isBruteHeavy ? 1.05 : isStalkerAmbush || isAcid || isStingerDart ? 0.95 : 0.75,
                false,
                -1,
                isAcid ? '#FACC15' : isStingerDart ? '#FB923C' : '#FB7185',
              );
              spawnFloatingText(
                sim,
                liveHeroX,
                groundY - 140,
                isStalkerAmbush ? `AMBUSH -${hpDamage}` : isStingerDart ? `STING -${hpDamage}` : `-${hpDamage}`,
                isAcid
                  ? '#FACC15'
                  : isBruteHeavy || isStingerDart
                    ? '#FB923C'
                    : isStalkerAmbush
                      ? '#FF2E7E'
                      : '#FDA4AF',
                isBruteHeavy || isStalkerAmbush || isStingerDart ? 1.15 : 1.0,
              );
            }
          } else {
            sim.heroAnim.flashTimer = 0.1;
            sim.trauma = Math.min(1, sim.trauma + 0.55);
            spawnBurst(sim, liveHeroX, groundY - 80, 22, isAcid ? '#FACC15' : '#FB7185', isAcid ? 2 : 0, 1.05);
            spawnAlienBloodImpact(
              sim,
              liveHeroX,
              groundY - 74,
              groundY,
              isAcid ? 'spitter' : 'hero_blood',
              isAcid ? 'plasma' : 'melee',
              1.15,
              true,
              -1,
              isAcid ? '#FACC15' : '#FB7185',
            );
            if (hpDamage > 0) {
              spawnFloatingText(sim, liveHeroX, groundY - 140, `-${hpDamage}`, '#FB7185', 1.15);
            }
          }

          if (reflected > 0 && cue.targetId) {
            const targetId = cue.targetId;
            triggerEnemyHitStagger(
              sim,
              targetId,
              liveAttackerPos,
              attackerArch,
              'plasma',
              1.1,
              koIds.has(targetId),
              1,
              '#00F0FF',
            );
            spawnBurst(sim, liveAttackerX, attackerPos.y, 12, '#00E5FF', 1, 0.9);
            spawnFloatingText(sim, liveAttackerX, attackerPos.y - 40, `-${reflected}`, '#38BDF8', 0.95);
            if (koIds.has(targetId)) triggerEnemyKo(targetId, 'plasma', '#00F0FF');
          }
        },
      });
    } else if (cue.kind === 'enemy_armor') {
      const pos = getEnemyPos(cue.targetId);
      const arch = getEnemyArch(cue.targetId);
      if (arch === 'stalker' && cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.bristleKind = 'armor';
        ea.bristleDuration = 0.58;
        ea.bristleTimer = 0.58;
        spawnBurst(sim, pos.x + 6, pos.y - 12, 14, '#FF2E7E', 1, 0.85);
        spawnBurst(sim, pos.x, pos.y - 8, 8, '#FFC700', 1, 0.65);
        if (cue.value) {
          spawnFloatingText(sim, pos.x, pos.y - 40, `+${cue.value} THORN ARM`, '#FF85B3', 0.98);
        }
      } else if (arch === 'brute' && cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.bristleKind = 'armor';
        ea.bristleDuration = 0.72;
        ea.bristleTimer = 0.72;
        spawnBurst(sim, pos.x - 8, pos.y - 6, 14, '#22C55E', 2, 0.9);
        spawnBurst(sim, pos.x + 18, pos.y - 26, 12, '#FB923C', 1, 0.85);
        spawnBruteMutagenMist(sim, pos.x - 10, pos.y - 16, 12, 1.0);
        spawnBruteKineticShards(sim, pos.x - 10, pos.y - 14, pos.groundY + 2, 7, 'vial', -1);
        const label =
          cue.secondaryHeal && cue.secondaryHeal > 0
            ? `+${cue.value ?? 6} ARM · +${cue.secondaryHeal} HP`
            : `+${cue.value ?? 6} ARM`;
        spawnFloatingText(sim, pos.x, pos.y - 44, label, '#4ADE80', 1.02);
      } else {
        spawnBurst(sim, pos.x, pos.y, 10, '#A3E635', 1, 0.7);
        if (cue.value) {
          spawnFloatingText(sim, pos.x, pos.y - 35, `+${cue.value} ARM`, '#BEF264', 0.95);
        }
      }
    } else if (cue.kind === 'enemy_bolster') {
      const bolsterVal = cue.value ?? 4;
      for (const ally of combat.enemies) {
        if (ally.hp <= 0) continue;
        const pos = getEnemyPos(ally.id);
        spawnBurst(sim, pos.x, pos.y, 12, '#FACC15', 1, 0.85);
        spawnFloatingText(sim, pos.x, pos.y - 38, `+${bolsterVal} ARM`, '#FDE047', 1.0);
      }
    } else if (cue.kind === 'enemy_charge') {
      const pos = getEnemyPos(cue.targetId);
      spawnBurst(sim, pos.x, pos.y, 16, '#FB923C', 1, 0.95);
      spawnFloatingText(sim, pos.x, pos.y - 42, 'CHARGING!', '#FDBA74', 1.05);
    } else if (cue.kind === 'enemy_burst') {
      const burstOrigin = getEnemyPos(cue.targetId);
      const burstDmg = cue.value ?? 6;
      const miteProfile = getBloodBiologyProfile('larva');
      sim.pendingImpacts.push({
        triggerOn: 'delay',
        delayRemaining: 0.14,
        execute: () => {
          sim.trauma = Math.min(1, sim.trauma + 0.42);
          spawnBurst(sim, burstOrigin.x, burstOrigin.y, 26, miteProfile.freshEmissive, 1, 1.35);
          spawnAlienBloodImpact(
            sim,
            burstOrigin.x,
            burstOrigin.y,
            burstOrigin.groundY,
            'larva',
            'kinetic',
            1.4,
            true,
            1,
          );
          spawnFloatingText(
            sim,
            burstOrigin.x,
            burstOrigin.y - 52,
            `💥 BIO-BURST`,
            '#BEF264',
            1.1,
          );
          for (const ally of combat.enemies) {
            if (ally.id === cue.targetId) continue;
            if (ally.hp <= 0 && !koIds.has(ally.id)) continue;
            const allyPos = getEnemyPos(ally.id);
            const dir = allyPos.x >= burstOrigin.x ? 1 : -1;
            triggerEnemyHitStagger(
              sim,
              ally.id,
              allyPos,
              ally.archetype,
              'kinetic',
              1.25,
              koIds.has(ally.id),
              dir,
            );
            spawnBurst(sim, allyPos.x, allyPos.y, 14, getBloodBiologyProfile(ally.archetype).freshBody, 2, 1.0);
            spawnFloatingText(sim, allyPos.x, allyPos.y - 36, `-${burstDmg}`, '#BEF264', 1.05);
            if (koIds.has(ally.id)) triggerEnemyKo(ally.id, 'kinetic');
          }
        },
      });
    } else if (cue.kind === 'enemy_retaliate') {
      const stalkerPos = getEnemyPos(cue.targetId);
      const retHpDmg = cue.hpDamage ?? (cue.value ?? 3);
      const retArmorDmg = cue.armorDamage ?? 0;
      const retBlocked = cue.blocked ?? 0;
      const willKiraDodgeRet = shouldKiraDodgeAttack({
        charId,
        isLethal: heroine.hp <= 0,
        hpDamage: retHpDmg,
        armorDamage: retArmorDmg,
      });
      if (willKiraDodgeRet) {
        kiraDodgeScheduled = true;
      }
      if (cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.bristleKind = 'retaliate';
        ea.bristleDuration = 0.48;
        ea.bristleTimer = 0.48;
      }
      const quillSx = stalkerPos.x + 8;
      const quillSy = stalkerPos.y - 24;
      spawnBurst(sim, quillSx, quillSy, 14, '#FF2E7E', 1, 1.05);

      const quillTargets = [
        { delay: 0.09, dy: -102, color: '#FF2E7E', final: false },
        { delay: 0.13, dy: -82, color: '#FF85B3', final: false },
        { delay: 0.17, dy: -90, color: '#FF2E7E', final: true },
      ] as const;

      for (let q = 0; q < quillTargets.length; q++) {
        const qt = quillTargets[q];
        sim.pendingImpacts.push({
          triggerOn: 'delay',
          delayRemaining: qt.delay,
          execute: () => {
            spawnBolt(sim, quillSx, quillSy, heroX + 22, groundY + qt.dy, qt.color, () => {
              if (!qt.final) {
                spawnBurst(
                  sim,
                  heroX + 18,
                  groundY + qt.dy,
                  6,
                  retHpDmg > 0 ? '#FF2E7E' : '#00E5FF',
                  1,
                  0.75,
                );
                return;
              }
              if (retHpDmg > 0) {
                sim.trauma = Math.min(1, sim.trauma + 0.28);
                sim.heroAnim.flashTimer = 0.08;
                spawnBurst(sim, heroX, groundY - 85, 14, '#FB7185', 1, 0.95);
                spawnAlienBloodImpact(
                  sim,
                  heroX,
                  groundY - 76,
                  groundY,
                  'hero_blood',
                  'kinetic',
                  0.65,
                  false,
                  -1,
                );
                spawnFloatingText(
                  sim,
                  heroX,
                  groundY - 135,
                  `-${retHpDmg} SPIKE`,
                  '#FDA4AF',
                  1.0,
                );
              } else if (willKiraDodgeRet) {
                triggerKiraDodgeVfx(sim, heroX, groundY);
              } else if (retBlocked > 0) {
                sim.trauma = Math.min(1, sim.trauma + 0.16);
                sim.shieldDomeTimer = 0.32;
                spawnBurst(sim, heroX + 34, groundY - 92, 12, '#00E5FF', 1, 0.85);
                spawnFloatingText(sim, heroX, groundY - 135, 'SPIKE BLOCKED', '#38BDF8', 0.95);
              }
            });
          },
        });
      }
    } else if (cue.kind === 'enemy_pustule_rupture') {
      const spitterPos = getEnemyPos(cue.targetId);
      const corAmt = cue.value ?? 2;
      if (cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.bristleKind = 'pustule_rupture';
        ea.bristleDuration = 0.52;
        ea.bristleTimer = 0.52;
      }
      const pusSx = spitterPos.x - 10;
      const pusSy = spitterPos.groundY - 104;
      spawnBurst(sim, pusSx, pusSy, 16, '#A3E635', 2, 1.05);
      spawnBurst(sim, pusSx + 4, pusSy - 4, 8, '#C026D3', 1, 0.85);
      sim.pendingImpacts.push({
        triggerOn: 'delay',
        delayRemaining: 0.14,
        execute: () => {
          spawnBolt(sim, pusSx, pusSy, heroX + 16, groundY - 88, '#A3E635', () => {
            sim.trauma = Math.min(1, sim.trauma + 0.18);
            spawnBurst(sim, heroX + 8, groundY - 86, 12, '#A3E635', 2, 0.85);
            addOrGrowFloorBlood(sim, heroX + 14, groundY + 2, 2.8, 0, {
              owner: 'hero_corrode',
              shapeKind: 'scorch_ring',
              plasmaColor: '#A3E635',
            });
            spawnFloatingText(sim, heroX, groundY - 134, `☣ +${corAmt} COR`, '#BEF264', 0.98);
          });
        },
      });
    } else if (cue.kind === 'enemy_phase_gate') {
      const bossPos = getEnemyPos(cue.targetId);
      sim.pendingImpacts.push({
        triggerOn: 'delay',
        delayRemaining: 0.12,
        execute: () => {
          sim.trauma = Math.min(1, sim.trauma + 0.45);
          spawnBurst(sim, bossPos.x, bossPos.y, 24, '#00F0FF', 1, 1.25);
          spawnBurst(sim, bossPos.x, bossPos.y, 16, '#FFC700', 1, 1.0);
          spawnFloatingText(
            sim,
            bossPos.x,
            bossPos.y - 54,
            `PHASE LOCK +${cue.value ?? 10} ARM`,
            '#67E8F9',
            1.1,
          );
        },
      });
    } else if (cue.kind === 'enemy_ko' && cue.targetId && !primarySlashCue && !hasOverdrive) {
      const targetId = cue.targetId;
      if (
        !cues.some((c) => (c.kind === 'enemy_attack' || c.kind === 'enemy_acid') && c.targetId === targetId) &&
        !cues.some((c) => c.kind === 'hero_slash' && c.targetId === targetId)
      ) {
        triggerEnemyKo(targetId, 'kinetic');
      }
    } else if (cue.kind === 'enemy_telegraph') {
      const pending = combat.director?.pendingReinforcements ?? [];
      const dropIdx = Math.max(0, pending.length - 1);
      const drop = pending[dropIdx];
      const dropCenter = drop ? (dropCenters[dropIdx] ?? drop.slotIndex) : 1;
      const dropX = drop ? enemyBaseX + dropCenter * enemyStepX : enemyBaseX + enemyStepX;
      spawnBurst(sim, dropX, groundY - 24, 16, '#FB923C', 1, 0.9);
      spawnFloatingText(
        sim,
        dropX,
        groundY - 70,
        `INBOUND T-${cue.value ?? 1}`,
        '#FDBA74',
        1.0,
      );
    } else if (cue.kind === 'enemy_reinforce') {
      const pos = getEnemyPos(cue.targetId);
      sim.trauma = Math.min(1, sim.trauma + 0.25);
      spawnBurst(sim, pos.x, pos.y + 12, 22, '#00F0FF', 1, 1.1);
      spawnFloatingText(sim, pos.x, pos.y - 46, 'DROP LANDED', '#67E8F9', 1.05);
    } else if (cue.kind === 'enemy_enrage') {
      const pos = getEnemyPos(cue.targetId);
      spawnBurst(sim, pos.x, pos.y, 14, '#FF2E7E', 1, 0.9);
      spawnFloatingText(sim, pos.x, pos.y - 48, cue.textLabel ?? `ENRAGE +${cue.value ?? 1} ATK`, '#FDA4AF', 1.05);
    } else if (cue.kind === 'enemy_stagger' && cue.targetId) {
      const pos = getEnemyPos(cue.targetId);
      const arch = getEnemyArch(cue.targetId);
      const isWeaponBreak = Boolean(cue.textLabel?.includes('WEAPON BROKEN'));
      const isSleep = Boolean(cue.textLabel?.startsWith('SLEEPING'));
      const isRecoverZero = Boolean(cue.textLabel?.includes('0 DMG'));
      if (isSleep) {
        spawnBurst(sim, pos.x, pos.y - 16, 10, '#A5B4FC', 2, 0.55);
        spawnFloatingText(
          sim,
          pos.x,
          pos.y - 48,
          cue.textLabel ?? 'SLEEPING',
          '#C7D2FE',
          1.0,
        );
      } else if (isRecoverZero) {
        triggerEnemyHitStagger(sim, cue.targetId, pos, arch, 'melee', 0.72, false, 1);
        spawnBurst(sim, pos.x, pos.y, 10, '#00F0FF', 1, 0.75);
        spawnFloatingText(
          sim,
          pos.x,
          pos.y - 48,
          cue.textLabel ?? 'STAGGERED · 0 DMG',
          '#67E8F9',
          1.02,
        );
      } else {
        sim.trauma = Math.min(1, sim.trauma + (isWeaponBreak ? 0.52 : 0.34));
        triggerEnemyHitStagger(sim, cue.targetId, pos, arch, 'melee', isWeaponBreak ? 1.55 : 1.3, false, 1);
        spawnBurst(sim, pos.x, pos.y, isWeaponBreak ? 26 : 20, '#00F0FF', 1, 1.1);
        spawnBurst(sim, pos.x, pos.y, isWeaponBreak ? 18 : 12, '#FFC700', 1, 0.95);
        if (arch === 'brute') {
          spawnBruteKineticShards(
            sim,
            pos.x - 6,
            pos.y - 16,
            pos.groundY + 2,
            isWeaponBreak ? 20 : 11,
            'chitin',
            1,
          );
        }
        spawnFloatingText(
          sim,
          pos.x,
          pos.y - 54,
          isWeaponBreak ? '⚔ WEAPON BROKEN!' : '⚡ STAGGERED!',
          isWeaponBreak ? '#FB923C' : '#67E8F9',
          isWeaponBreak ? 1.22 : 1.15,
        );
      }
    } else if (cue.kind === 'tile_hex') {
      const pos = getEnemyPos(cue.targetId);
      spawnBurst(sim, pos.x, pos.y, 16, '#C084FC', 1, 1.0);
      spawnFloatingText(sim, pos.x, pos.y - 44, cue.textLabel ?? '⬡ HEX', '#E9D5FF', 1.05);
    } else if (cue.kind === 'tile_blight') {
      spawnBurst(sim, heroX, groundY - 85, 16, '#84CC16', 1, 0.95);
      addOrGrowFloorBlood(sim, heroX + (Math.random() - 0.5) * 28, groundY + 2, 2.8, 0, {
        owner: 'hero_corrode',
        shapeKind: 'scorch_ring',
        plasmaColor: '#A3E635',
      });
      spawnFloatingText(
        sim,
        heroX,
        groundY - 144,
        cue.textLabel ?? `☣ -${cue.value ?? 2} SLAG`,
        '#BEF264',
        1.0,
      );
    } else if (cue.kind === 'heat_jam') {
      spawnBurst(sim, heroX, groundY - 85, 16, '#F97316', 1, 0.85);
      spawnFloatingText(sim, heroX, groundY - 142, 'OVERHEAT JAM', '#FB923C', 1.0);
    }
  }

  if (!cutInStarted) {
    const cueKinds = cues.map((c) => c.kind);
    const baseBeatSec =
      computeNonCutInBeatMs(cueKinds, livingEnemyCount, presCfg.adaptivePackSpeedup) / 1000;
    sim.batchMicroTimerRemaining = kiraDodgeScheduled ? Math.max(baseBeatSec, 0.86) : baseBeatSec;
  }
}

export interface StepCombatSimulationOptions {
  tacticalViewActive?: boolean;
  reducedMotion?: boolean;
  idleZoom?: number;
  idlePanX?: number;
  idlePanY?: number;
}

export function stepCombatSimulation(
  sim: CombatStageSim,
  dt: number,
  options?: StepCombatSimulationOptions,
): number {
  const seqFrame = sim.actionSequencer.step(dt, sim.size.w, sim.size.h, {
    tacticalViewActive: Boolean(options?.tacticalViewActive),
    reducedMotion: Boolean(options?.reducedMotion),
    idleZoom: options?.idleZoom,
    idlePanX: options?.idlePanX,
    idlePanY: options?.idlePanY,
  });
  sim.lastSeqFrame = seqFrame;
  sim.cameraZoom = seqFrame.cameraZoom;
  sim.cameraPanX = seqFrame.cameraPanX;
  sim.cameraPanY = seqFrame.cameraPanY;
  sim.cameraRotRad = seqFrame.cameraRotRad;

  if (sim.dodgeZoomTimer > 0 && !options?.tacticalViewActive && !options?.reducedMotion) {
    const dodgeU = Math.max(0, Math.min(1, 1 - sim.dodgeZoomTimer / 0.70));
    const dodgePulse = Math.sin(dodgeU * Math.PI);
    const zoomBoost = seqFrame.active ? 0.045 * dodgePulse : 0.08 * dodgePulse;
    const nextZoom = Math.min(1.32, sim.cameraZoom + zoomBoost);
    const heroFocusPanX = seqFrame.active ? 0 : sim.size.w * 0.075 * dodgePulse;
    const heroFocusPanY = seqFrame.active ? 0 : -sim.size.h * 0.025 * dodgePulse;
    sim.cameraZoom = nextZoom;
    sim.cameraPanX += heroFocusPanX;
    sim.cameraPanY += heroFocusPanY;
    sim.lastSeqFrame = {
      ...seqFrame,
      cameraZoom: sim.cameraZoom,
      cameraPanX: sim.cameraPanX,
      cameraPanY: sim.cameraPanY,
    };
  }

  if (!seqFrame.active) {
    for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
      if (sim.pendingImpacts[i].triggerOn === 'cutin_impact') {
        const pi = sim.pendingImpacts.splice(i, 1)[0];
        pi.execute();
      }
    }
  }

  if (sim.batchMicroTimerRemaining > 0) {
    sim.batchMicroTimerRemaining = Math.max(0, sim.batchMicroTimerRemaining - dt);
    if (
      sim.batchMicroTimerRemaining === 0 &&
      sim.batchActiveKey &&
      sim.lastCompletedBatchKey !== sim.batchActiveKey
    ) {
      sim.lastCompletedBatchKey = sim.batchActiveKey;
      sim.onBatchComplete?.(sim.batchActiveKey);
    }
  }

  sim.trauma = Math.max(0, sim.trauma - dt * 2.4);
  if (sim.heroAnim.flashTimer > 0) sim.heroAnim.flashTimer = Math.max(0, sim.heroAnim.flashTimer - dt);
  sim.enemyAnims.forEach((ea) => {
    if (ea.flashTimer > 0) ea.flashTimer = Math.max(0, ea.flashTimer - dt);
  });

  let simDt = seqFrame.isHitStopped ? 0 : dt;
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - dt);
    if (!seqFrame.isHitStopped) {
      simDt = 0;
    }
  }

  sim.slashArcTimer = Math.max(0, sim.slashArcTimer - simDt);
  sim.kickWaveTimer = Math.max(0, sim.kickWaveTimer - simDt);
  sim.shieldDomeTimer = Math.max(0, sim.shieldDomeTimer - simDt);
  sim.dodgeZoomTimer = Math.max(0, sim.dodgeZoomTimer - simDt);
  sim.upgradeBeamTimer = Math.max(0, sim.upgradeBeamTimer - simDt);
  sim.overdriveTimer = Math.max(0, sim.overdriveTimer - simDt);
  if (sim.heroTrailCooldown > 0) {
    sim.heroTrailCooldown = Math.max(0, sim.heroTrailCooldown - simDt);
  }
  if (sim.screenBloodCooldown > 0) {
    sim.screenBloodCooldown = Math.max(0, sim.screenBloodCooldown - simDt);
  }

  for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
    const pi = sim.pendingImpacts[i];
    if (pi.triggerOn !== 'delay') continue;
    pi.delayRemaining -= simDt;
    if (pi.delayRemaining <= 0) {
      sim.pendingImpacts.splice(i, 1);
      pi.execute();
    }
  }

  sim.enemyAnims.forEach((ea, enemyId) => {
    ea.lunge = Math.max(0, ea.lunge - simDt * 5.2);
    if (ea.attackAnimTimer > 0) {
      ea.attackAnimTimer = Math.max(0, ea.attackAnimTimer - simDt);
    }
    if (ea.bristleTimer > 0) {
      ea.bristleTimer = Math.max(0, ea.bristleTimer - simDt);
    }
    if (ea.staggerTimer > 0) {
      ea.staggerTimer = Math.max(0, ea.staggerTimer - simDt);
    }
    if (ea.dead && ea.koProgress < 1) {
      // Slower, more visceral KO dissolve so full hit, stagger & arterial bleeding are clearly shown
      ea.koProgress = Math.min(1, ea.koProgress + simDt * 1.15);
    }

    // Continuous secondary arterial spurts while staggering or collapsing
    if (simDt > 0 && (ea.staggerTimer > 0.08 || (ea.dead && ea.koProgress < 0.78))) {
      ea.bleedSpurtTimer -= simDt;
      if (ea.bleedSpurtTimer <= 0) {
        ea.bleedSpurtTimer = 0.045 + Math.random() * 0.035;
        const origin = sim.enemyWoundOrigins.get(enemyId);
        if (origin) {
          emitBloodDroplets(
            sim,
            origin.x + 10,
            origin.y + (ea.dead ? ea.koProgress * 18 : 0),
            origin.groundY,
            ea.dead ? 7 : 5,
            ea.staggerIntensity * 0.85,
            origin.owner,
            'kinetic',
            1,
          );
        }
      }
    }
  });

  for (let i = 0; i < sim.motes.length; i++) {
    const m = sim.motes[i];
    m.x = (m.x + m.vx * simDt) % 1;
    m.y += m.vy * simDt;
    if (m.y < 0.05) m.y = 0.85;
  }

  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const p = sim.particles[i];
    if (!p.active) continue;
    p.life += simDt;
    if (p.life >= p.maxLife) {
      p.active = false;
      continue;
    }
    p.x += p.vx * simDt;
    p.y += p.vy * simDt;
    p.vy += p.gravity * simDt;
    p.rot += p.vRot * simDt;
    if (p.shape === 4) {
      p.vx *= Math.max(0, 1 - 1.6 * simDt);
    }
    if (p.shape === 3 && !p.bounced && p.vy > 0 && p.y >= p.floorY) {
      p.y = p.floorY;
      p.vy = -Math.abs(p.vy) * 0.42;
      p.vx *= 0.68;
      p.vRot *= 0.65;
      p.bounced = true;
    }
  }

  // Step persistent ground seismic fissures (molten glow cools over 1-2 turns into dark deck fractures)
  const fissureAgeLerp = Math.min(1, simDt * 3.2);
  for (let i = 0; i < FLOOR_FISSURE_POOL_SIZE; i++) {
    const f = sim.floorFissures[i];
    if (!f.active) continue;
    f.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - f.createdTurn);
    f.visualTurnAge += (targetTurnAge - f.visualTurnAge) * fissureAgeLerp;
    f.heatIntensity = Math.max(0, f.heatIntensity - simDt * 0.085);
    if (f.visualTurnAge >= 2.2 || f.age > 24) {
      f.alpha -= simDt * 0.28;
    }
    if (f.alpha <= 0.02) {
      f.active = false;
    }
  }

  const { w, h } = sim.size;
  const edgeY = getBridgeEdgeY(sim);
  const backY = getBridgeBackY(sim);

  // Step airborne biology-matched blood droplets -> splat onto cover walls or floor puddles
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

    // Project directional airborne droplets onto the rear sky-bridge cover rail when arching across backY
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

  // Step persistent, multi-turn weathered floor blood decals & edge spillover
  const ageLerp = Math.min(1, simDt * 3.4);
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active) continue;
    fp.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - fp.createdTurn);
    fp.visualTurnAge += (targetTurnAge - fp.visualTurnAge) * ageLerp;

    const weathering = computeBloodWeatheringState(fp.visualTurnAge);

    // Rapid initial splat expansion followed by viscous spreading while fresh (freezes as blood crusts)
    const expandRate = Math.min(1, simDt * 16);
    fp.rx += (fp.targetRx - fp.rx) * expandRate;
    fp.ry += (fp.targetRy - fp.ry) * expandRate;

    const viscousFlowFactor = (1 / (1 + fp.age * 0.055)) * weathering.viscositySpreadFactor;
    fp.x = Math.max(20, Math.min(w - 20, fp.x + fp.flowVx * viscousFlowFactor * simDt));
    fp.y = Math.min(edgeY, fp.y + fp.flowVy * viscousFlowFactor * simDt);
    fp.targetRx = Math.min(60, fp.targetRx + fp.spreadRateX * viscousFlowFactor * simDt);
    fp.targetRy = Math.min(16, fp.targetRy + fp.spreadRateY * viscousFlowFactor * simDt);
    fp.tendrilLen1 = Math.min(
      fp.maxTendrilLen,
      fp.tendrilLen1 + 2.6 * viscousFlowFactor * simDt,
    );
    fp.tendrilLen2 = Math.min(
      fp.maxTendrilLen * 0.82,
      fp.tendrilLen2 + 1.9 * viscousFlowFactor * simDt,
    );

    // Fresh pools reaching the front bridge curb feed sluggish edge drips
    if (fp.shapeKind !== 'scorch_ring' && fp.shapeKind !== 'trail_drop') {
      const frontReachY =
        fp.y + fp.ry * 0.45 + Math.max(fp.tendrilLen1, fp.tendrilLen2) * 0.42;
      if (frontReachY >= edgeY - 3.5 && weathering.turnAge < 1.8) {
        fp.dripSpawnCooldown -= simDt;
        if (fp.dripSpawnCooldown <= 0 && fp.alpha > 0.35) {
          fp.dripSpawnCooldown = 1.15 + Math.random() * 0.9;
          const offsetX =
            fp.tendrilLen1 >= fp.tendrilLen2 ? fp.tendrilOffsetX1 : fp.tendrilOffsetX2;
          addOrFeedEdgeDrip(
            sim,
            fp.x + offsetX * 0.65,
            edgeY,
            Math.max(2.2, fp.ry * 0.48),
            fp.owner,
          );
        }
      }
    }

    // Multi-turn persistence: decals settle into a durable ~0.76 alpha crust rather than vanishing mid-combat
    const minPersistentAlpha = fp.shapeKind === 'trail_drop' ? 0.64 : 0.76;
    if (fp.alpha > minPersistentAlpha) {
      fp.alpha = Math.max(minPersistentAlpha, fp.alpha - 0.012 * simDt);
    }
  }

  // Step structural cover decals (rear sky-bridge barriers & front curb face)
  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    const cd = sim.coverBlood[i];
    if (!cd.active) continue;
    cd.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - cd.createdTurn);
    cd.visualTurnAge += (targetTurnAge - cd.visualTurnAge) * ageLerp;

    const weathering = computeBloodWeatheringState(cd.visualTurnAge);
    cd.ry += (cd.targetRy - cd.ry) * Math.min(1, simDt * 14);
    if (cd.streakLen < cd.maxStreakLen) {
      cd.streakLen = Math.min(
        cd.maxStreakLen,
        cd.streakLen + 3.4 * weathering.viscositySpreadFactor * simDt,
      );
    }
    if (cd.alpha > 0.78) {
      cd.alpha = Math.max(0.78, cd.alpha - 0.01 * simDt);
    }
  }

  // Step thick biology-colored blood sluggishly dripping over the front bridge curb
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
    drip.length = Math.min(
      drip.maxLength,
      drip.length + drip.stretchSpeed * viscosityDrag * fadeSlowdown * simDt,
    );

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

    // Coagulated hanging drips dry into crusted icicle-like remnants after 2+ turns, slowly flaking off
    if (drip.age > 8 && drip.visualTurnAge >= 2) {
      const fadeRate = 1 / Math.max(14, drip.lifespan);
      drip.alpha -= fadeRate * simDt;
      drip.thickness = Math.max(1.1, drip.thickness - 0.035 * simDt);
    }
    if (drip.alpha <= 0.02 && !drip.detachedActive) {
      drip.active = false;
    }
  }

  // Step fourth-wall visor screen blood drops: sluggish glass slide -> slow evaporation/disappearance
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

  for (let i = 0; i < BOLT_POOL_SIZE; i++) {
    const b = sim.bolts[i];
    if (!b.active) continue;
    b.life += simDt;
    if (b.life >= b.maxLife) {
      b.active = false;
      if (b.onImpact) {
        const cb = b.onImpact;
        b.onImpact = undefined;
        cb();
      }
      continue;
    }
    const tNorm = Math.min(1, b.life / b.maxLife);
    b.x = b.startX + (b.targetX - b.startX) * tNorm;
    b.y = b.startY + (b.targetY - b.startY) * tNorm;
  }

  for (let i = sim.ghosts.length - 1; i >= 0; i--) {
    const decayRate = sim.ghosts[i].isDodge ? 2.05 : 4.5;
    sim.ghosts[i].alpha -= simDt * decayRate;
    if (sim.ghosts[i].alpha <= 0.02) {
      sim.ghosts.splice(i, 1);
    }
  }

  for (let i = 0; i < TEXT_POOL_SIZE; i++) {
    const ft = sim.texts[i];
    if (!ft.active) continue;
    ft.life += simDt;
    if (ft.life >= ft.maxLife) {
      ft.active = false;
      continue;
    }
    ft.y += ft.vy * simDt;
    ft.vy *= 0.94;
  }

  return simDt;
}
