import {
  type ScratchBuffers,
  type SpriteCutoutOptions,
  applyColorGradingData,
  createScratchBuffers,
  floodFillBorderBackground,
  prepareScratchBuffers,
} from './spriteCutoutBounds';

function isNearWhitePixel(data: Uint8ClampedArray, idx: number, maxChroma: number): boolean {
  const p = idx * 4;
  if (data[p + 3] < 20) return true;
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
  return (minC > 224 && maxC - minC < maxChroma) || (minC >= 216 && maxC - minC <= 8);
}

function clearFloorShadowAndPockets(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  minFloorPocketArea: number,
): void {
  const { visited, removed, interiorVisited, queue } = scratch;
  const floorMinY = Math.max(0, Math.min(h - 1, Math.max(h - 56, Math.floor(h * 0.78))));
  const seedStartY = Math.max(floorMinY, h - 16);
  const bottomEdgeY = Math.max(0, h - 6);

  const isFloorShadowPixel = (idx: number, y: number): boolean => {
    const p = idx * 4;
    const a = data[p + 3];
    if (a < 20) return true;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    if (minC > 218 && maxC - minC < 32) return true;
    if (r >= 165 && b >= 175 && g <= Math.min(r, b) - 6) return true;
    if (y >= h - 20 && b >= 125 && b - r >= 36) {
      if (b - g >= 12) return true;
      if (y >= h - 12 && r < 110 && g >= 95 && b >= g - 6) return true;
    }
    if (y >= h - 16 && a < 180 && b >= r + 15) return true;
    return false;
  };

  visited.fill(0, 0, total);
  let fHead = 0;
  let fTail = 0;

  const tryEnqueueFloor = (idx: number, y: number) => {
    if (y < floorMinY || y >= h || visited[idx] || removed[idx]) return;
    if (!isFloorShadowPixel(idx, y)) return;
    visited[idx] = 1;
    queue[fTail++] = idx;
  };

  for (let y = seedStartY; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      if (removed[idx] || visited[idx]) continue;
      const touchesSeedEdge =
        y >= bottomEdgeY ||
        (x > 0 && removed[idx - 1]) ||
        (x < w - 1 && removed[idx + 1]) ||
        (y > 0 && removed[idx - w]) ||
        (y < h - 1 && removed[idx + w]);
      if (touchesSeedEdge && isFloorShadowPixel(idx, y)) {
        visited[idx] = 1;
        queue[fTail++] = idx;
      }
    }
  }

  while (fHead < fTail) {
    const cur = queue[fHead++];
    removed[cur] = 1;
    data[cur * 4 + 3] = 0;
    const x = cur % w;
    const y = (cur - x) / w;
    if (x > 0) tryEnqueueFloor(cur - 1, y);
    if (x < w - 1) tryEnqueueFloor(cur + 1, y);
    if (y > floorMinY) tryEnqueueFloor(cur - w, y - 1);
    if (y < h - 1) tryEnqueueFloor(cur + w, y + 1);
  }

  // Clear trapped near-white pockets strictly inside the bottom floor zone (between boots)
  const floorPocketMinY = Math.max(0, Math.floor(h * 0.84));
  for (let startIdx = floorPocketMinY * w; startIdx < total; startIdx++) {
    if (removed[startIdx] || interiorVisited[startIdx] || !isNearWhitePixel(data, startIdx, 24)) {
      continue;
    }
    let cHead = 0;
    let cTail = 0;
    let touchesAbove = false;
    interiorVisited[startIdx] = 1;
    queue[cTail++] = startIdx;

    while (cHead < cTail) {
      const cur = queue[cHead++];
      const x = cur % w;
      const y = (cur - x) / w;
      if (y < floorPocketMinY) touchesAbove = true;

      const checkNeighbor = (n: number, ny: number) => {
        if (ny < floorPocketMinY) {
          if (!removed[n] && isNearWhitePixel(data, n, 24)) touchesAbove = true;
          return;
        }
        if (!removed[n] && !interiorVisited[n] && isNearWhitePixel(data, n, 24)) {
          interiorVisited[n] = 1;
          queue[cTail++] = n;
        }
      };

      if (x > 0) checkNeighbor(cur - 1, y);
      if (x < w - 1) checkNeighbor(cur + 1, y);
      if (y > 0) checkNeighbor(cur - w, y - 1);
      if (y < h - 1) checkNeighbor(cur + w, y + 1);
    }

    if (!touchesAbove && cTail >= minFloorPocketArea) {
      for (let i = 0; i < cTail; i++) {
        const pIdx = queue[i];
        removed[pIdx] = 1;
        data[pIdx * 4 + 3] = 0;
      }
    }
  }
}

function clearInteriorWhitePockets(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  minPocketArea: number,
): void {
  const { removed, interiorVisited, queue } = scratch;
  for (let startIdx = 0; startIdx < total; startIdx++) {
    if (removed[startIdx] || interiorVisited[startIdx] || !isNearWhitePixel(data, startIdx, 22)) {
      continue;
    }
    let cHead = 0;
    let cTail = 0;
    let borderCount = 0;
    let vibrantGlowBorderCount = 0;
    let checkerGrayCount = 0;
    let checkerWhiteCount = 0;
    interiorVisited[startIdx] = 1;
    queue[cTail++] = startIdx;

    const inspectBoundaryNeighbor = (n: number) => {
      if (removed[n]) return;
      if (!interiorVisited[n] && isNearWhitePixel(data, n, 22)) {
        interiorVisited[n] = 1;
        queue[cTail++] = n;
        return;
      }
      if (!isNearWhitePixel(data, n, 22)) {
        borderCount++;
        const np = n * 4;
        const nr = data[np];
        const ng = data[np + 1];
        const nb = data[np + 2];
        const maxC = nr > ng ? (nr > nb ? nr : nb) : ng > nb ? ng : nb;
        const minC = nr < ng ? (nr < nb ? nr : nb) : ng < nb ? ng : nb;
        if (maxC >= 145 && maxC - minC >= 42) {
          vibrantGlowBorderCount++;
        }
      }
    };

    while (cHead < cTail) {
      const cur = queue[cHead++];
      const cp = cur * 4;
      const cr = data[cp];
      const cg = data[cp + 1];
      const cb = data[cp + 2];
      const cMax = cr > cg ? (cr > cb ? cr : cb) : cg > cb ? cg : cb;
      const cMin = cr < cg ? (cr < cb ? cr : cb) : cg < cb ? cg : cb;
      if (cMax - cMin <= 6) {
        if (cMin >= 216 && cMax <= 243) checkerGrayCount++;
        else if (cMin >= 247) checkerWhiteCount++;
      }
      const x = cur % w;
      const y = (cur - x) / w;
      if (x > 0) inspectBoundaryNeighbor(cur - 1);
      if (x < w - 1) inspectBoundaryNeighbor(cur + 1);
      if (y > 0) inspectBoundaryNeighbor(cur - w);
      if (y < h - 1) inspectBoundaryNeighbor(cur + w);
    }

    const isTwoToneCheckerboard = checkerGrayCount >= 12 && checkerWhiteCount >= 12;
    const isVibrantNeonEmblem =
      !isTwoToneCheckerboard &&
      borderCount > 0 &&
      vibrantGlowBorderCount / borderCount >= 0.35;

    if (cTail >= minPocketArea && !isVibrantNeonEmblem) {
      for (let i = 0; i < cTail; i++) {
        const pIdx = queue[i];
        removed[pIdx] = 1;
        data[pIdx * 4 + 3] = 0;
      }
    }
  }
}

function defringeWhiteEdges(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  removed: Uint8Array,
  defringeStrength: number,
  removeBottomFloorShadow: boolean,
): void {
  const keepAlphaFactor = 1 - defringeStrength;
  const lumMin = removeBottomFloorShadow ? 180 : 188;
  const chromaMax = removeBottomFloorShadow ? 42 : 34;
  for (let y = 1; y < h - 1; y++) {
    const rowOff = y * w;
    const checkLavenderFringe = removeBottomFloorShadow && y >= h - 22;
    for (let x = 1; x < w - 1; x++) {
      const idx = rowOff + x;
      if (removed[idx]) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
      const lum = (r + g + b) / 3;
      const isNeutralHalo = lum > lumMin && maxC - minC < chromaMax;
      const isLavenderFloorFringe =
        checkLavenderFringe && r >= 165 && b >= 175 && g < Math.min(r, b);
      if (isNeutralHalo || isLavenderFloorFringe) {
        if (removed[idx - 1] || removed[idx + 1] || removed[idx - w] || removed[idx + w]) {
          data[p + 3] = Math.round(data[p + 3] * keepAlphaFactor);
        }
      }
    }
  }
}

function unmixExteriorLightGlow(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
): void {
  const { visited, removed, queue } = scratch;
  visited.fill(0, 0, total);
  let gHead = 0;
  let gTail = 0;
  const tryEnqueueGlow = (n: number) => {
    if (visited[n] || removed[n]) return;
    const np = n * 4;
    const nr = data[np];
    const ng = data[np + 1];
    const nb = data[np + 2];
    const nMin = nr < ng ? (nr < nb ? nr : nb) : ng < nb ? ng : nb;
    if (nMin > 138) {
      visited[n] = 1;
      queue[gTail++] = n;
    }
  };

  for (let idx = 0; idx < total; idx++) {
    if (!removed[idx]) continue;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) tryEnqueueGlow(idx - 1);
    if (x < w - 1) tryEnqueueGlow(idx + 1);
    if (y > 0) tryEnqueueGlow(idx - w);
    if (y < h - 1) tryEnqueueGlow(idx + w);
  }

  while (gHead < gTail) {
    const cur = queue[gHead++];
    const p = cur * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    if (minC > 138 && maxC - minC >= 12) {
      const whiteFrac = Math.min(1, Math.max(0, (minC - 138) / 112));
      const alpha = Math.max(0.14, 1 - whiteFrac * 0.86);
      const bgComp = 250 * (1 - alpha);
      data[p] = Math.min(255, Math.max(0, Math.round((r - bgComp) / alpha)));
      data[p + 1] = Math.min(255, Math.max(0, Math.round((g - bgComp) / alpha)));
      data[p + 2] = Math.min(255, Math.max(0, Math.round((b - bgComp) / alpha)));
      data[p + 3] = Math.round(data[p + 3] * alpha);
    } else if (minC > 195 && maxC - minC < 12) {
      const fade = Math.max(0.08, (248 - minC) / 55);
      data[p + 3] = Math.round(data[p + 3] * fade);
    }

    const x = cur % w;
    const y = (cur - x) / w;
    if (x > 0) tryEnqueueGlow(cur - 1);
    if (x < w - 1) tryEnqueueGlow(cur + 1);
    if (y > 0) tryEnqueueGlow(cur - w);
    if (y < h - 1) tryEnqueueGlow(cur + w);
  }
}

export function cleanWhiteBackgroundData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options?: SpriteCutoutOptions,
  scratchArg?: ScratchBuffers,
): void {
  if (w <= 0 || h <= 0) return;

  const removeInteriorWhite = Boolean(options?.removeInteriorWhite);
  const removeBottomFloorShadow = Boolean(options?.removeBottomFloorShadow);
  const defringeStrength = options?.defringeStrength ?? 0.55;

  const total = w * h;
  const scratch = prepareScratchBuffers(scratchArg ?? createScratchBuffers(total), total);
  floodFillBorderBackground(data, w, h, scratch, (idx) => isNearWhitePixel(data, idx, 24));

  if (removeBottomFloorShadow) {
    clearFloorShadowAndPockets(data, w, h, total, scratch, options?.minPocketArea ?? 100);
  }

  if (removeInteriorWhite) {
    if (removeBottomFloorShadow) {
      scratch.interiorVisited.fill(0, 0, total);
    }
    const minPocketArea = options?.minPocketArea ?? Math.max(80, Math.floor(total * 0.00014));
    clearInteriorWhitePockets(data, w, h, total, scratch, minPocketArea);
  }

  if (defringeStrength > 0) {
    defringeWhiteEdges(data, w, h, scratch.removed, defringeStrength, removeBottomFloorShadow);
  }

  if (options?.unmixLightGlow) {
    unmixExteriorLightGlow(data, w, h, total, scratch);
  }

  if (options?.saturationScale !== undefined || options?.crimsonDampen !== undefined) {
    applyColorGradingData(data, w, h, options);
  }
}
