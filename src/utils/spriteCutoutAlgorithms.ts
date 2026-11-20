export interface SpriteCutoutOptions {
  removeInteriorWhite?: boolean;
  removeBottomFloorShadow?: boolean;
  removeDarkBackground?: boolean;
  minPocketArea?: number;
  defringeStrength?: number;
  unmixLightGlow?: boolean;
  preserveExistingAlpha?: boolean;
  maxDimension?: number;
  /** Optional saturation multiplier (e.g., 0.82 to tame oversaturated neon sprites) */
  saturationScale?: number;
  /** Optional dampening factor (0..1) for excessive crimson/red-orange color cast */
  crimsonDampen?: number;
  /** Optional unmixing of dark glass inside forward holographic screens */
  unmixDarkHoloGlass?: boolean;
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  excludeRects?: readonly { x: number; y: number; w: number; h: number }[];
}

export interface SpriteBounds {
  topRatio: number;
  bottomRatio: number;
  leftRatio: number;
  rightRatio: number;
  centerXRatio: number;
}

export const DEFAULT_SPRITE_BOUNDS: SpriteBounds = {
  topRatio: 0.06,
  bottomRatio: 0.93,
  leftRatio: 0.08,
  rightRatio: 0.92,
  centerXRatio: 0.5,
};

export interface ScratchBuffers {
  capacity: number;
  visited: Uint8Array;
  removed: Uint8Array;
  interiorVisited: Uint8Array;
  queue: Int32Array;
}

export function createScratchBuffers(initialCapacity = 0): ScratchBuffers {
  return {
    capacity: initialCapacity,
    visited: new Uint8Array(initialCapacity),
    removed: new Uint8Array(initialCapacity),
    interiorVisited: new Uint8Array(initialCapacity),
    queue: new Int32Array(initialCapacity),
  };
}

export function prepareScratchBuffers(scratch: ScratchBuffers, needed: number): ScratchBuffers {
  if (scratch.capacity < needed) {
    scratch.capacity = needed;
    scratch.visited = new Uint8Array(needed);
    scratch.removed = new Uint8Array(needed);
    scratch.interiorVisited = new Uint8Array(needed);
    scratch.queue = new Int32Array(needed);
  } else {
    scratch.visited.fill(0, 0, needed);
    scratch.removed.fill(0, 0, needed);
    scratch.interiorVisited.fill(0, 0, needed);
  }
  return scratch;
}

export function computeSpriteBoundsFromData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): SpriteBounds {
  if (w <= 0 || h <= 0) return DEFAULT_SPRITE_BOUNDS;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const alpha = data[(rowOff + x) * 4 + 3];
      if (alpha > 36) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return DEFAULT_SPRITE_BOUNDS;
  return {
    topRatio: minY / h,
    bottomRatio: Math.min(1, (maxY + 1) / h),
    leftRatio: minX / w,
    rightRatio: Math.min(1, (maxX + 1) / w),
    centerXRatio: ((minX + maxX) * 0.5) / w,
  };
}

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

function isNearDarkPixel(data: Uint8ClampedArray, idx: number, w: number, h: number): boolean {
  const p = idx * 4;
  if (data[p + 3] < 20) return true;
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  // Pure / near-pure sheet gutter black (<= 8) stops cleanly at Zuri's >= 10 dark ink outlines
  if (maxC <= 8) return true;
  const x = idx % w;
  const y = (idx - x) / w;
  // Near top/bottom crop edges, clear faint dark-red glow from horizontal sheet divider lines
  if ((y <= 7 || y >= h - 11) && r <= 88 && g <= 16 && b <= 20 && r >= g + 6) {
    return true;
  }
  // Near left/right crop edges, clear faint red halo from adjacent label boxes
  if ((x <= 5 || x >= w - 6) && r <= 42 && g <= 10 && b <= 14) {
    return true;
  }
  return false;
}

/** Shared outer-edge BFS flood fill clearing connected background pixels in `data`. */
function floodFillBorderBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  scratch: ScratchBuffers,
  shouldRemove: (idx: number) => boolean,
): void {
  const { visited, removed, queue } = scratch;
  let head = 0;
  let tail = 0;

  const enqueue = (idx: number) => {
    if (visited[idx] || !shouldRemove(idx)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x);
    enqueue((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueue(y * w);
    enqueue(y * w + (w - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    removed[idx] = 1;
    data[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) enqueue(idx - 1);
    if (x < w - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - w);
    if (y < h - 1) enqueue(idx + w);
  }
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

export function applyColorGradingData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options?: Pick<SpriteCutoutOptions, 'saturationScale' | 'crimsonDampen'>,
): void {
  const satScale = options?.saturationScale ?? 1;
  const crimsonDampen = options?.crimsonDampen ?? 0;
  if (satScale === 1 && crimsonDampen <= 0) return;

  const total = w * h;
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) continue;
    let r = data[p];
    let g = data[p + 1];
    let b = data[p + 2];

    if (crimsonDampen > 0 && r > g && r > b) {
      const warmCeiling = Math.max(g * 1.32 + 16, b * 1.22 + 16);
      if (r > warmCeiling) {
        const excess = r - warmCeiling;
        r = Math.max(0, Math.round(r - excess * crimsonDampen));
        g = Math.min(255, Math.round(g + excess * crimsonDampen * 0.18));
      }
    }

    if (satScale !== 1) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, Math.max(0, Math.round(lum + (r - lum) * satScale)));
      g = Math.min(255, Math.max(0, Math.round(lum + (g - lum) * satScale)));
      b = Math.min(255, Math.max(0, Math.round(lum + (b - lum) * satScale)));
    }

    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
  }
}

function buildInteriorDarkGuard(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  comp: Int32Array,
): Uint8Array {
  const { visited, removed, queue } = scratch;
  visited.fill(0, 0, total);
  const prot = new Uint8Array(total);
  let pTail = 0;

  for (let i = 0; i < total; i++) {
    if (removed[i] || visited[i]) continue;
    const p = i * 4;
    if (Math.max(data[p], data[p + 1], data[p + 2]) > 7) continue;
    let cHead = 0;
    let cTail = 0;
    visited[i] = 1;
    comp[cTail++] = i;
    while (cHead < cTail) {
      const u = comp[cHead++];
      const ux = u % w;
      const uy = (u - ux) / w;
      const tryN = (n: number) => {
        if (!removed[n] && !visited[n]) {
          const np = n * 4;
          if (Math.max(data[np], data[np + 1], data[np + 2]) <= 7) {
            visited[n] = 1;
            comp[cTail++] = n;
          }
        }
      };
      if (ux > 0) tryN(u - 1);
      if (ux < w - 1) tryN(u + 1);
      if (uy > 0) tryN(u - w);
      if (uy < h - 1) tryN(u + w);
    }
    if (cTail >= 8) {
      for (let k = 0; k < cTail; k++) {
        const u = comp[k];
        prot[u] = 1;
        queue[pTail++] = u;
      }
    }
  }

  let pHead = 0;
  while (pHead < pTail) {
    const i = queue[pHead++];
    const d = prot[i];
    if (d >= 4) continue;
    const x = i % w;
    const y = (i - x) / w;
    const push = (n: number) => {
      if (!removed[n] && !prot[n]) {
        prot[n] = d + 1;
        queue[pTail++] = n;
      }
    };
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  return prot;
}

function peelDarkHaloAndEdge(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  prot: Uint8Array,
): void {
  const { visited, removed, queue } = scratch;
  visited.fill(0, 0, total);
  const dist = new Uint8Array(total);
  let h2 = 0;
  let t2 = 0;
  const tryEnqueueHalo = (n: number, d: number) => {
    if (visited[n] || removed[n] || prot[n] || d > 56) return;
    const p = n * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (maxC <= 14 || (maxC <= 28 && g <= 5 && b <= 12) || (r <= 66 && g <= 4 && b <= 13)) {
      visited[n] = 1;
      dist[n] = d;
      queue[t2++] = n;
    }
  };
  for (let i = 0; i < total; i++) {
    if (!removed[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueHalo(i - 1, 1);
    if (x < w - 1) tryEnqueueHalo(i + 1, 1);
    if (y > 0) tryEnqueueHalo(i - w, 1);
    if (y < h - 1) tryEnqueueHalo(i + w, 1);
  }
  while (h2 < t2) {
    const i = queue[h2++];
    const d = dist[i];
    const x = i % w;
    const y = (i - x) / w;
    removed[i] = 1;
    data[i * 4 + 3] = 0;
    if (x > 0) tryEnqueueHalo(i - 1, d + 1);
    if (x < w - 1) tryEnqueueHalo(i + 1, d + 1);
    if (y > 0) tryEnqueueHalo(i - w, d + 1);
    if (y < h - 1) tryEnqueueHalo(i + w, d + 1);
  }

  visited.fill(0, 0, total);
  let h3 = 0;
  let t3 = 0;
  const tryEnqueueDarkEdge = (n: number, d: number) => {
    if (visited[n] || removed[n] || prot[n] || d > 3) return;
    const p = n * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (maxC <= 56 && g <= 16 && b <= 22) {
      visited[n] = 1;
      dist[n] = d;
      queue[t3++] = n;
    }
  };
  for (let i = 0; i < total; i++) {
    if (!removed[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueDarkEdge(i - 1, 1);
    if (x < w - 1) tryEnqueueDarkEdge(i + 1, 1);
    if (y > 0) tryEnqueueDarkEdge(i - w, 1);
    if (y < h - 1) tryEnqueueDarkEdge(i + w, 1);
  }
  while (h3 < t3) {
    const i = queue[h3++];
    const d = dist[i];
    const p = i * 4;
    const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
    const minFade = d === 1 ? 0.18 : 0.52;
    const fade = Math.max(minFade, Math.min(1, (maxC - 16) / 36));
    data[p + 3] = Math.round(data[p + 3] * fade);
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueDarkEdge(i - 1, d + 1);
    if (x < w - 1) tryEnqueueDarkEdge(i + 1, d + 1);
    if (y > 0) tryEnqueueDarkEdge(i - w, d + 1);
    if (y < h - 1) tryEnqueueDarkEdge(i + w, d + 1);
  }
}

function unmixForwardHoloGlass(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  removed: Uint8Array,
  prot: Uint8Array,
): void {
  const holoMinX = Math.floor(w * 0.48);
  const holoMaxY = Math.floor(h * 0.94);
  for (let y = 0; y < holoMaxY; y++) {
    const rowOff = y * w;
    for (let x = holoMinX; x < w; x++) {
      const i = rowOff + x;
      if (removed[i] || prot[i]) continue;
      const p = i * 4;
      if (data[p + 3] < 140) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const isDarkHoloGlass =
        y < h * 0.48 && r >= 18 && r <= 140 && g <= 14 && b <= 28 && r > g * 2.8;
      const isDarkShieldCell =
        b >= 16 && b <= 148 && r <= 96 && g <= 44 && b > g * 1.5 && b >= r;
      if (isDarkHoloGlass || isDarkShieldCell) {
        const peak = Math.max(r, b);
        data[p + 3] = Math.max(134, Math.min(data[p + 3], Math.round(134 + (peak / 148) * 76)));
      }
    }
  }
}

function removeIsolatedDarkSpecks(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  comp: Int32Array,
): void {
  const { visited, removed } = scratch;
  visited.fill(0, 0, total);
  for (let i = 0; i < total; i++) {
    if (removed[i] || visited[i] || data[i * 4 + 3] === 0) continue;
    let cHead = 0;
    let cTail = 0;
    visited[i] = 1;
    comp[cTail++] = i;
    while (cHead < cTail) {
      const u = comp[cHead++];
      const ux = u % w;
      const uy = (u - ux) / w;
      const push = (n: number) => {
        if (!removed[n] && !visited[n] && data[n * 4 + 3] > 0) {
          visited[n] = 1;
          comp[cTail++] = n;
        }
      };
      if (ux > 0) push(u - 1);
      if (ux < w - 1) push(u + 1);
      if (uy > 0) push(u - w);
      if (uy < h - 1) push(u + w);
    }
    if (cTail <= 28) {
      let maxVal = 0;
      for (let k = 0; k < cTail; k++) {
        const p = comp[k] * 4;
        maxVal = Math.max(maxVal, data[p], data[p + 1], data[p + 2]);
      }
      if (maxVal <= 50) {
        for (let k = 0; k < cTail; k++) {
          removed[comp[k]] = 1;
          data[comp[k] * 4 + 3] = 0;
        }
      }
    }
  }
}

export function cleanDarkBackgroundData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options?: SpriteCutoutOptions,
  scratchArg?: ScratchBuffers,
): void {
  if (w <= 0 || h <= 0) return;

  const total = w * h;
  const scratch = prepareScratchBuffers(scratchArg ?? createScratchBuffers(total), total);
  floodFillBorderBackground(data, w, h, scratch, (idx) => isNearDarkPixel(data, idx, w, h));

  const comp = new Int32Array(total);
  const prot = buildInteriorDarkGuard(data, w, h, total, scratch, comp);
  peelDarkHaloAndEdge(data, w, h, total, scratch, prot);

  if (options?.unmixDarkHoloGlass) {
    unmixForwardHoloGlass(data, w, h, scratch.removed, prot);
  }

  removeIsolatedDarkSpecks(data, w, h, total, scratch, comp);

  if (options?.saturationScale !== undefined || options?.crimsonDampen !== undefined) {
    applyColorGradingData(data, w, h, options);
  }
}
