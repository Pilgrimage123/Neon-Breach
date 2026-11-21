import type { CombatState } from '../../engine/types';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  BLOOD_DROP_POOL_SIZE,
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  type CombatStageSim,
  getBridgeGroundY,
  getEnemyLaneMetrics,
} from './combatStageTypes';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
} from './mutantBlood';
import {
  addCoverBloodDecal,
  addOrFeedEdgeDrip,
  addOrGrowFloorBlood,
  getBridgeBackY,
  getBridgeEdgeY,
  spawnStatusTrail,
} from './combatBloodDecals';

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
