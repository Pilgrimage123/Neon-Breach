import assert from 'node:assert/strict';
import test from 'node:test';
import type { MapNode } from '../../engine/types';
import {
  computeMapTrackLayout,
  computePixelPortCoords,
  computeStageScrollTarget,
} from './sectorMapLayout';

function makeNode(id: string, layer: number, lane: number): MapNode {
  return {
    id,
    layer,
    lane,
    type: 'COMBAT',
    nextIds: [],
    cleared: false,
  };
}

test('computeMapTrackLayout enforces guaranteed minimum column widths across modes', () => {
  const desktop = computeMapTrackLayout({
    totalCols: 12,
    effectiveWidth: 1440,
    isCompactLandscape: false,
    isNarrowPortrait: false,
    isOverviewZoom: false,
  });
  assert.equal(desktop.minColWidthPx, 236);
  assert.equal(desktop.colGapPx, 28);
  assert.equal(desktop.railWidthPx, 124);
  assert.equal(desktop.minGridWidthPx, 12 * 236 + 11 * 28);
  assert.equal(desktop.minTrackWidthPx, 124 + 12 + desktop.minGridWidthPx);

  const compact = computeMapTrackLayout({
    totalCols: 12,
    effectiveWidth: 920,
    isCompactLandscape: true,
    isNarrowPortrait: false,
    isOverviewZoom: false,
  });
  assert.equal(compact.minColWidthPx, 200);
  assert.equal(compact.colGapPx, 20);
  assert.equal(compact.railWidthPx, 104);

  const portrait = computeMapTrackLayout({
    totalCols: 12,
    effectiveWidth: 390,
    isCompactLandscape: false,
    isNarrowPortrait: true,
    isOverviewZoom: false,
  });
  assert.equal(portrait.minColWidthPx, 190);
  assert.equal(portrait.colGapPx, 16);
  assert.equal(portrait.railWidthPx, 56);

  const overview = computeMapTrackLayout({
    totalCols: 12,
    effectiveWidth: 1440,
    isCompactLandscape: false,
    isNarrowPortrait: false,
    isOverviewZoom: true,
  });
  assert.equal(overview.minColWidthPx, 185);
  assert.equal(overview.colGapPx, 20);
});

test('computePixelPortCoords aligns start, boss, and lane nodes to exact grid pixels', () => {
  const totalCols = 5;
  const colGap = 28;
  const rowGap = 12;
  const gridW = 5 * 240 + 4 * 28; // 1312px -> colWidth = 240
  const gridH = 3 * 120 + 2 * 12; // 384px -> rowHeight = 120

  const start = makeNode('s', 0, 1);
  const startCoords = computePixelPortCoords(start, totalCols, gridW, gridH, colGap, rowGap);
  assert.equal(startCoords.leftX, 0);
  assert.equal(startCoords.rightX, 240);
  assert.equal(startCoords.centerX, 120);
  assert.equal(startCoords.y, 120 + 12 + 60); // row 1 center = 192

  const topLane = makeNode('n1', 2, 0);
  const topCoords = computePixelPortCoords(topLane, totalCols, gridW, gridH, colGap, rowGap);
  assert.equal(topCoords.leftX, 2 * (240 + 28));
  assert.equal(topCoords.rightX, 2 * (240 + 28) + 240);
  assert.equal(topCoords.y, 60); // row 0 center

  const bottomLane = makeNode('n2', 2, 2);
  const bottomCoords = computePixelPortCoords(bottomLane, totalCols, gridW, gridH, colGap, rowGap);
  assert.equal(bottomCoords.y, 2 * (120 + 12) + 60); // row 2 center = 324

  const boss = makeNode('boss', 4, 0);
  const bossCoords = computePixelPortCoords(boss, 12, 12 * 236 + 11 * 28, gridH, colGap, rowGap);
  assert.equal(bossCoords.colWidth, 236);
  const boss12 = makeNode('boss12', 11, 0);
  const boss12Coords = computePixelPortCoords(boss12, 12, 12 * 236 + 11 * 28, gridH, colGap, rowGap);
  assert.equal(boss12Coords.y, 192); // boss forced into row 1 center
  assert.equal(boss12Coords.rightX, 12 * 236 + 11 * 28);
});

test('computeStageScrollTarget frames focus and districtStart within valid scroll bounds', () => {
  const totalCols = 12;
  const colGap = 28;
  const gridW = 12 * 236 + 11 * 28; // 3140
  const railW = 124;
  const railGap = 12;
  const clientW = 1200;
  const maxScroll = railW + railGap + gridW - clientW; // 2076

  assert.equal(
    computeStageScrollTarget({
      targetLayer: 0,
      totalCols,
      gridWidthPx: gridW,
      colGapPx: colGap,
      containerClientWidth: clientW,
      railWidthPx: railW,
      railGapPx: railGap,
      mode: 'focus',
    }),
    0,
  );

  const midFocus = computeStageScrollTarget({
    targetLayer: 3,
    totalCols,
    gridWidthPx: gridW,
    colGapPx: colGap,
    containerClientWidth: clientW,
    railWidthPx: railW,
    railGapPx: railGap,
    mode: 'focus',
  });
  assert.equal(midFocus, 3 * (236 + 28) - 12);

  const districtStart = computeStageScrollTarget({
    targetLayer: 3,
    totalCols,
    gridWidthPx: gridW,
    colGapPx: colGap,
    containerClientWidth: clientW,
    railWidthPx: railW,
    railGapPx: railGap,
    mode: 'districtStart',
  });
  assert.equal(districtStart, 3 * (236 + 28));

  const endClamped = computeStageScrollTarget({
    targetLayer: 11,
    totalCols,
    gridWidthPx: gridW,
    colGapPx: colGap,
    containerClientWidth: clientW,
    railWidthPx: railW,
    railGapPx: railGap,
    mode: 'districtStart',
  });
  assert.equal(endClamped, maxScroll);

  // When everything fits in viewport, scroll target is 0
  assert.equal(
    computeStageScrollTarget({
      targetLayer: 3,
      totalCols: 5,
      gridWidthPx: 1200,
      colGapPx: 28,
      containerClientWidth: 1600,
      railWidthPx: railW,
      railGapPx: railGap,
      mode: 'focus',
    }),
    0,
  );
});
