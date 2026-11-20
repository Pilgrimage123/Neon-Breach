import {
  getEnemySlotSpan,
  MAX_ACTIVE_BRIDGE_ENEMIES,
} from '../../engine/reinforcementDirector';
import type {
  EnemyUnit,
  PendingReinforcement,
} from '../../engine/types';
import { CRAWLER_ARCH_SCALE, isCrawlerArchetype } from '../../utils/crawlerSpriteSheet';
import {
  ENEMY_FOOT_DEFAULTS,
  type EnemyCutoutEntry,
  getStageLayoutMetrics,
} from './combatStageTypes';

export interface EnemyHitBox {
  enemyId: string;
  idx: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  groundY: number;
}

export interface EnemySlotLayout {
  slotCenters: number[];
  dropCenters: number[];
  effectiveSlotCount: number;
}

export function computeEnemySlotLayout(
  enemies: readonly EnemyUnit[],
  pendingReinforcements?: readonly PendingReinforcement[],
): EnemySlotLayout {
  const slotCenters: number[] = [];
  let cursor = 0;
  for (let i = 0; i < enemies.length; i++) {
    const span = getEnemySlotSpan(enemies[i].archetype);
    slotCenters.push(cursor + (span - 1) * 0.5);
    cursor += span;
  }
  const dropCenters: number[] = [];
  let maxDropEnd = 0;
  if (pendingReinforcements) {
    for (let i = 0; i < pendingReinforcements.length; i++) {
      const drop = pendingReinforcements[i];
      const span = getEnemySlotSpan(drop.archetype);
      dropCenters.push(drop.slotIndex + (span - 1) * 0.5);
      if (drop.slotIndex + span > maxDropEnd) {
        maxDropEnd = drop.slotIndex + span;
      }
    }
  }
  const rawSlots = Math.max(enemies.length > 0 ? 1 : 0, cursor, maxDropEnd);
  return {
    slotCenters,
    dropCenters,
    effectiveSlotCount: Math.min(MAX_ACTIVE_BRIDGE_ENEMIES, rawSlots),
  };
}

export function computeEffectiveSlotCount(
  enemies: readonly EnemyUnit[],
  pendingReinforcements?: readonly PendingReinforcement[],
): number {
  return computeEnemySlotLayout(enemies, pendingReinforcements).effectiveSlotCount;
}

export function computeEnemyHitBoxes(
  w: number,
  h: number,
  enemies: readonly EnemyUnit[],
  cutouts?: ReadonlyMap<string, EnemyCutoutEntry>,
  pendingReinforcements?: readonly PendingReinforcement[],
): EnemyHitBox[] {
  if (w <= 0 || h <= 0 || enemies.length === 0) return [];
  const { slotCenters, effectiveSlotCount: slotCount } = computeEnemySlotLayout(
    enemies,
    pendingReinforcements,
  );
  const { groundY, enemyBaseX, enemyStepX } = getStageLayoutMetrics(
    w,
    h,
    slotCount,
    0,
    0,
    0,
    1,
    400,
  );
  const crowdScale = slotCount >= 5 ? 0.78 : slotCount === 4 ? 0.86 : 1;
  const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
  const minTopY = h < 220 ? 34 : 58;

  const boxes: EnemyHitBox[] = [];
  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    if (enemy.hp <= 0 || enemy.escaped) continue;

    const arch = enemy.archetype;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : 0.94;
    const size = baseEnemySize * archScale;
    const slotCenter = slotCenters[idx] ?? idx;
    const ex = enemyBaseX + slotCenter * enemyStepX;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);

    const entry = cutouts?.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;

    const visualWidth = Math.max(
      40,
      size * (isCrawlerArchetype(arch) ? 0.78 : arch === 'brute' ? 0.94 : arch === 'stalker' ? 0.8 : 0.74),
    );
    const visualHeight = Math.max(44, size * Math.min(0.95, bottomRatio));

    const rawLeft = ex - visualWidth * 0.5;
    const rawTop = enemyGroundY - visualHeight - 4;
    const rawRight = ex + visualWidth * 0.5;
    const rawBottom = Math.min(h - 4, enemyGroundY + 24);

    const left = Math.max(0, Math.min(w - 24, rawLeft));
    const top = Math.max(minTopY, Math.min(h - 32, rawTop));
    const right = Math.min(w, Math.max(left + 24, rawRight));
    const bottom = Math.min(h, Math.max(top + 28, rawBottom));

    boxes.push({
      enemyId: enemy.id,
      idx,
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(right - left),
      height: Math.round(bottom - top),
      centerX: ex,
      groundY: enemyGroundY,
    });
  }

  return boxes;
}

export function hitTestEnemySprite(
  px: number,
  py: number,
  hitBoxes: readonly EnemyHitBox[],
): string | null {
  let bestId: string | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < hitBoxes.length; i++) {
    const box = hitBoxes[i];
    if (
      px >= box.x &&
      px <= box.x + box.width &&
      py >= box.y &&
      py <= box.y + box.height
    ) {
      const cy = box.y + box.height * 0.5;
      const distSq = (px - box.centerX) * (px - box.centerX) + (py - cy) * (py - cy);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestId = box.enemyId;
      }
    }
  }

  return bestId;
}
