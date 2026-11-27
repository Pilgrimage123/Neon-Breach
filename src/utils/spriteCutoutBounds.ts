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
  /** Optional removal of neutral gray drop-shadow beneath feet in the bottom floor zone */
  removeNeutralFloorShadow?: boolean;
  /** Optional removal of subtle light-gray/white interior checkerboard pockets (e.g. 246/254) */
  removeSubtleCheckerboard?: boolean;
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

/** Shared outer-edge BFS flood fill clearing connected background pixels in `data`. */
export function floodFillBorderBackground(
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
