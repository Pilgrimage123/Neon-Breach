import { BOARD_CAPACITY, MAX_UPCHARGE_BOARD_CAPACITY } from './data';
import { deterministicShuffle } from './encounterBuilder';
import type { EnemyIntent, EnemyUnit, Tile, TileType } from './types';

export function drawToSix(
  board: Tile[],
  drawPile: Tile[],
  discardPile: Tile[],
  seed: number,
  turn: number,
  targetCapacity = BOARD_CAPACITY,
): { board: Tile[]; drawPile: Tile[]; discardPile: Tile[] } {
  const nextBoard = board.map((tile) => ({ ...tile }));
  let nextDraw = drawPile.map((tile) => ({ ...tile }));
  let nextDiscard = discardPile.map((tile) => ({ ...tile }));

  const clampedTarget = Math.min(
    MAX_UPCHARGE_BOARD_CAPACITY,
    Math.max(BOARD_CAPACITY, targetCapacity),
  );
  const needed = Math.max(0, clampedTarget - nextBoard.length);
  for (let i = 0; i < needed; i++) {
    if (nextDraw.length === 0) {
      if (nextDiscard.length === 0) break;
      const recycled = nextDiscard.map((t) => ({ ...t, isHeldFromPrevTurn: false }));
      nextDraw = deterministicShuffle(recycled, seed + turn * 97 + i);
      nextDiscard = [];
    }
    const drawn = nextDraw.shift();
    if (drawn) {
      nextBoard.push({ ...drawn, isHeldFromPrevTurn: false });
    }
  }

  return {
    board: nextBoard,
    drawPile: nextDraw,
    discardPile: nextDiscard,
  };
}

const TILE_TYPE_ORDER: Record<TileType, number> = {
  attack: 0,
  defense: 1,
  tech: 2,
};

export function sortTilesByGroup(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => {
    const typeDiff = TILE_TYPE_ORDER[a.type] - TILE_TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    if (a.isHeldFromPrevTurn !== b.isHeldFromPrevTurn) {
      return a.isHeldFromPrevTurn ? -1 : 1;
    }
    if (a.value !== b.value) return b.value - a.value;
    return a.id.localeCompare(b.id);
  });
}

export function getSafeEnemyIntent(
  enemy: EnemyUnit,
): { intent: EnemyIntent | null; safeIndex: number } {
  const len = enemy.intentCycle.length;
  if (len === 0) {
    return { intent: null, safeIndex: 0 };
  }
  const rawIdx = Number.isInteger(enemy.currentIntentIndex) ? enemy.currentIntentIndex : 0;
  const safeIndex = ((rawIdx % len) + len) % len;
  return { intent: enemy.intentCycle[safeIndex] ?? null, safeIndex };
}
