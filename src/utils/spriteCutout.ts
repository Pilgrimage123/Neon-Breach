const cutoutCache = new Map<string, HTMLCanvasElement>();
const cutoutPromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const sheetFramesCache = new Map<string, HTMLCanvasElement[]>();
const sheetPromiseCache = new Map<string, Promise<HTMLCanvasElement[]>>();

export interface SpriteCutoutOptions {
  removeInteriorWhite?: boolean;
  minPocketArea?: number;
  defringeStrength?: number;
  unmixLightGlow?: boolean;
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteBounds {
  topRatio: number;
  bottomRatio: number;
  leftRatio: number;
  rightRatio: number;
  centerXRatio: number;
}

const boundsCache = new WeakMap<HTMLCanvasElement, SpriteBounds>();

export function measureSpriteBounds(canvas: HTMLCanvasElement): SpriteBounds {
  const existing = boundsCache.get(canvas);
  if (existing) return existing;

  const w = canvas.width;
  const h = canvas.height;
  const fallback: SpriteBounds = {
    topRatio: 0.06,
    bottomRatio: 0.93,
    leftRatio: 0.08,
    rightRatio: 0.92,
    centerXRatio: 0.5,
  };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w === 0 || h === 0) return fallback;

  const data = ctx.getImageData(0, 0, w, h).data;
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

  if (!found) return fallback;
  const computed: SpriteBounds = {
    topRatio: minY / h,
    bottomRatio: Math.min(1, (maxY + 1) / h),
    leftRatio: minX / w,
    rightRatio: Math.min(1, (maxX + 1) / w),
    centerXRatio: ((minX + maxX) * 0.5) / w,
  };
  boundsCache.set(canvas, computed);
  return computed;
}

interface ScratchBuffers {
  capacity: number;
  visited: Uint8Array;
  removed: Uint8Array;
  interiorVisited: Uint8Array;
  queue: Int32Array;
}

function createScratchBuffers(initialCapacity = 0): ScratchBuffers {
  return {
    capacity: initialCapacity,
    visited: new Uint8Array(initialCapacity),
    removed: new Uint8Array(initialCapacity),
    interiorVisited: new Uint8Array(initialCapacity),
    queue: new Int32Array(initialCapacity),
  };
}

function prepareScratchBuffers(scratch: ScratchBuffers, needed: number): ScratchBuffers {
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

function isNearWhitePixel(data: Uint8ClampedArray, idx: number, maxChroma: number): boolean {
  const p = idx * 4;
  if (data[p + 3] < 20) return true;
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
  return minC > 224 && maxC - minC < maxChroma;
}

function cleanWhiteBackgroundInCanvas(
  canvas: HTMLCanvasElement,
  options?: SpriteCutoutOptions,
  scratchArg?: ScratchBuffers,
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w === 0 || h === 0) return canvas;

  const removeInteriorWhite = Boolean(options?.removeInteriorWhite);
  const defringeStrength = options?.defringeStrength ?? 0.55;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const total = w * h;
  const scratch = prepareScratchBuffers(scratchArg ?? createScratchBuffers(total), total);
  const { visited, removed, interiorVisited, queue } = scratch;
  let head = 0;
  let tail = 0;

  const enqueue = (idx: number) => {
    if (visited[idx] || !isNearWhitePixel(data, idx, 24)) return;
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

  if (removeInteriorWhite) {
    const minPocketArea = options?.minPocketArea ?? Math.max(80, Math.floor(total * 0.00014));
    for (let startIdx = 0; startIdx < total; startIdx++) {
      if (removed[startIdx] || interiorVisited[startIdx] || !isNearWhitePixel(data, startIdx, 22)) {
        continue;
      }
      let cHead = 0;
      let cTail = 0;
      interiorVisited[startIdx] = 1;
      queue[cTail++] = startIdx;

      while (cHead < cTail) {
        const cur = queue[cHead++];
        const x = cur % w;
        const y = (cur - x) / w;
        if (x > 0) {
          const n = cur - 1;
          if (!removed[n] && !interiorVisited[n] && isNearWhitePixel(data, n, 22)) {
            interiorVisited[n] = 1;
            queue[cTail++] = n;
          }
        }
        if (x < w - 1) {
          const n = cur + 1;
          if (!removed[n] && !interiorVisited[n] && isNearWhitePixel(data, n, 22)) {
            interiorVisited[n] = 1;
            queue[cTail++] = n;
          }
        }
        if (y > 0) {
          const n = cur - w;
          if (!removed[n] && !interiorVisited[n] && isNearWhitePixel(data, n, 22)) {
            interiorVisited[n] = 1;
            queue[cTail++] = n;
          }
        }
        if (y < h - 1) {
          const n = cur + w;
          if (!removed[n] && !interiorVisited[n] && isNearWhitePixel(data, n, 22)) {
            interiorVisited[n] = 1;
            queue[cTail++] = n;
          }
        }
      }

      if (cTail >= minPocketArea) {
        for (let i = 0; i < cTail; i++) {
          const pIdx = queue[i];
          removed[pIdx] = 1;
          data[pIdx * 4 + 3] = 0;
        }
      }
    }
  }

  // Soften 1px bright neutral fringe adjacent to transparent background so dark arenas have zero white halo
  if (defringeStrength > 0) {
    const keepAlphaFactor = 1 - defringeStrength;
    for (let y = 1; y < h - 1; y++) {
      const rowOff = y * w;
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
        if (lum > 188 && maxC - minC < 34) {
          if (removed[idx - 1] || removed[idx + 1] || removed[idx - w] || removed[idx + w]) {
            data[p + 3] = Math.round(data[p + 3] * keepAlphaFactor);
          }
        }
      }
    }
  }

  // Unmix white background from exterior translucent neon/holographic glow regions without touching dark-outlined character interior
  if (options?.unmixLightGlow) {
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

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function buildOptionsKey(options?: SpriteCutoutOptions): string {
  return `${options?.removeInteriorWhite ? '1' : '0'}|${options?.minPocketArea ?? 'auto'}|${options?.defringeStrength ?? 0.55}|${options?.unmixLightGlow ? '1' : '0'}`;
}

export function loadSpriteCutout(
  src: string,
  options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement> {
  const cacheKey = `${src}|${buildOptionsKey(options)}`;
  const existing = cutoutCache.get(cacheKey);
  if (existing) return Promise.resolve(existing);

  const inFlight = cutoutPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx && w > 0 && h > 0) {
        ctx.drawImage(img, 0, 0, w, h);
        cleanWhiteBackgroundInCanvas(canvas, options);
      }
      cutoutCache.set(cacheKey, canvas);
      cutoutPromiseCache.delete(cacheKey);
      resolve(canvas);
    };
    img.onerror = (err) => {
      cutoutPromiseCache.delete(cacheKey);
      reject(err);
    };
    img.src = src;
  });

  cutoutPromiseCache.set(cacheKey, promise);
  return promise;
}

export function loadSpriteSheetFrames(
  src: string,
  rects: readonly SpriteRect[],
  options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement[]> {
  const cacheKey = `${src}|frames_${rects.length}|${buildOptionsKey(options)}`;
  const existing = sheetFramesCache.get(cacheKey);
  if (existing) return Promise.resolve(existing);

  const inFlight = sheetPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = new Promise<HTMLCanvasElement[]>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let maxArea = 0;
      for (let i = 0; i < rects.length; i++) {
        const area = Math.max(0, rects[i].w) * Math.max(0, rects[i].h);
        if (area > maxArea) maxArea = area;
      }
      const scratch = createScratchBuffers(maxArea);
      const frames = rects.map((rect) => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.w;
        canvas.height = rect.h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx && rect.w > 0 && rect.h > 0) {
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
          cleanWhiteBackgroundInCanvas(canvas, options, scratch);
        }
        return canvas;
      });
      sheetFramesCache.set(cacheKey, frames);
      sheetPromiseCache.delete(cacheKey);
      resolve(frames);
    };
    img.onerror = (err) => {
      sheetPromiseCache.delete(cacheKey);
      reject(err);
    };
    img.src = src;
  });

  sheetPromiseCache.set(cacheKey, promise);
  return promise;
}
