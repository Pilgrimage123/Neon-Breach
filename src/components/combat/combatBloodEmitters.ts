import {
  BLOOD_DROP_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  type CombatStageSim,
  getBridgeGroundY,
} from './combatStageTypes';
import {
  type BloodOwnerKind,
  type WeaponDecalKind,
  getBloodBiologyProfile,
} from './mutantBlood';
import {
  addCoverBloodDecal,
  addOrGrowFloorBlood,
  getBridgeEdgeY,
} from './combatBloodDecals';

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
        ? 1.2 + Math.random() * 1.5
        : 1.45 + Math.random() * (2.15 + intensity * 0.85);
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
    if (zoneRoll < 0.45) {
      // Side perifoveal visor margins
      const onRight = Math.random() < (biasRight ? 0.68 : 0.32);
      nx = onRight ? 0.74 + Math.random() * 0.21 : 0.05 + Math.random() * 0.21;
      ny = 0.16 + Math.random() * 0.74;
    } else if (zoneRoll < 0.82) {
      // Lower mid-frame visor rim
      nx = 0.18 + Math.random() * 0.64;
      ny = 0.76 + Math.random() * 0.17;
    } else {
      // Upper mid-frame visor rim
      nx = 0.18 + Math.random() * 0.64;
      ny = 0.12 + Math.random() * 0.12;
    }

    const r = 7.5 + Math.random() * 10.5;
    sb.active = true;
    sb.nx = nx;
    sb.ny = ny;
    sb.radius = r;
    sb.stretchY = 1.08 + Math.random() * 0.34;
    sb.slideOffsetPx = 0;
    sb.slideSpeed = (3.8 + Math.random() * 5.2) * viscousMul;
    sb.streakLen = 0;
    sb.owner = owner;
    sb.age = 0;
    sb.lifespan = 6.2 + Math.random() * 3.4;
    sb.alpha = 0.88 + Math.random() * 0.1;
    sb.seed = Math.random() * 100;
    const satAng = (Math.random() - 0.5) * Math.PI * 2;
    const satDist = r + 4 + Math.random() * 7;
    sb.satelliteDx = Math.cos(satAng) * satDist;
    sb.satelliteDy = Math.sin(satAng) * satDist;
    sb.satelliteR = Math.max(1.8, r * (0.28 + Math.random() * 0.2));
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

  let dropCount = 0;
  if (isKo) {
    dropCount =
      weaponKind === 'plasma'
        ? 2 + (Math.random() < 0.5 ? 1 : 0)
        : 3 + Math.floor(Math.random() * 3);
    sim.screenBloodCooldown = 0.28;
  } else if (intensity >= 1.15) {
    dropCount =
      weaponKind === 'plasma'
        ? 1 + (Math.random() < 0.5 ? 1 : 0)
        : 2 + Math.floor(Math.random() * 3);
    sim.screenBloodCooldown = 0.42;
  } else {
    const chance = weaponKind === 'plasma' ? 0.25 : 0.58;
    if (Math.random() < chance) {
      dropCount = 1 + (Math.random() < 0.45 ? 1 : 0);
      sim.screenBloodCooldown = 0.65;
    }
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
