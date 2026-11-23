import type { MapNode } from '../../engine/types';
import { getVisualRow } from './sectorMapTheme';

export interface MapTrackLayoutParams {
  totalCols: number;
  effectiveWidth: number;
  isCompactLandscape: boolean;
  isNarrowPortrait: boolean;
  isOverviewZoom: boolean;
}

export interface MapTrackLayout {
  minColWidthPx: number;
  colGapPx: number;
  rowGapPx: number;
  railWidthPx: number;
  railGapPx: number;
  minGridWidthPx: number;
  minTrackWidthPx: number;
}

export interface PixelPortCoords {
  leftX: number;
  rightX: number;
  centerX: number;
  y: number;
  colWidth: number;
  rowHeight: number;
}

export interface StageScrollTargetParams {
  targetLayer: number;
  totalCols: number;
  gridWidthPx: number;
  colGapPx: number;
  containerClientWidth: number;
  railWidthPx: number;
  railGapPx: number;
  mode: 'focus' | 'districtStart';
}

export function computeMapTrackLayout({
  totalCols,
  effectiveWidth,
  isCompactLandscape,
  isNarrowPortrait,
  isOverviewZoom,
}: MapTrackLayoutParams): MapTrackLayout {
  const safeCols = Math.max(1, totalCols);
  const minColWidthPx = isOverviewZoom
    ? 185
    : isNarrowPortrait
      ? 190
      : isCompactLandscape || effectiveWidth < 1024
        ? 200
        : 236;

  const colGapPx = isNarrowPortrait
    ? 16
    : isCompactLandscape || isOverviewZoom || effectiveWidth < 1024
      ? 20
      : 28;

  const rowGapPx = isCompactLandscape ? 8 : 12;
  const railWidthPx = isNarrowPortrait ? 56 : isCompactLandscape ? 104 : 124;
  const railGapPx = isNarrowPortrait ? 8 : 12;

  const minGridWidthPx =
    safeCols * minColWidthPx + Math.max(0, safeCols - 1) * colGapPx;
  const minTrackWidthPx = railWidthPx + railGapPx + minGridWidthPx;

  return {
    minColWidthPx,
    colGapPx,
    rowGapPx,
    railWidthPx,
    railGapPx,
    minGridWidthPx,
    minTrackWidthPx,
  };
}

export function computePixelPortCoords(
  node: MapNode,
  totalCols: number,
  gridWidthPx: number,
  gridHeightPx: number,
  colGapPx: number,
  rowGapPx: number,
): PixelPortCoords {
  const safeCols = Math.max(1, totalCols);
  const maxLayer = safeCols - 1;
  const colWidth =
    (gridWidthPx - Math.max(0, safeCols - 1) * colGapPx) / safeCols;
  const colLeft = node.layer * (colWidth + colGapPx);
  const colRight = colLeft + colWidth;
  const rowHeight = (gridHeightPx - 2 * rowGapPx) / 3;
  const rowIndex = getVisualRow(node, maxLayer);
  const y = rowIndex * (rowHeight + rowGapPx) + rowHeight / 2;

  return {
    leftX: colLeft,
    rightX: colRight,
    centerX: (colLeft + colRight) / 2,
    y,
    colWidth,
    rowHeight,
  };
}

export function computeStageScrollTarget({
  targetLayer,
  totalCols,
  gridWidthPx,
  colGapPx,
  containerClientWidth,
  railWidthPx,
  railGapPx,
  mode,
}: StageScrollTargetParams): number {
  const safeCols = Math.max(1, totalCols);
  const colWidth =
    (gridWidthPx - Math.max(0, safeCols - 1) * colGapPx) / safeCols;
  const colStep = colWidth + colGapPx;
  const maxScroll = Math.max(
    0,
    railWidthPx + railGapPx + gridWidthPx - containerClientWidth,
  );

  if (maxScroll <= 0) return 0;

  const clampedLayer = Math.max(0, Math.min(safeCols - 1, targetLayer));
  const rawTarget =
    mode === 'focus'
      ? clampedLayer <= 0
        ? 0
        : Math.max(0, clampedLayer * colStep - 12)
      : clampedLayer * colStep;

  return Math.round(Math.max(0, Math.min(maxScroll, rawTarget)));
}
