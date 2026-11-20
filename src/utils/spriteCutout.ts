import {
  cleanDarkBackgroundData,
  cleanWhiteBackgroundData,
  computeSpriteBoundsFromData,
  createScratchBuffers,
  DEFAULT_SPRITE_BOUNDS,
  type ScratchBuffers,
  type SpriteBounds,
  type SpriteCutoutOptions,
  type SpriteRect,
} from './spriteCutoutAlgorithms';

export {
  cleanDarkBackgroundData,
  cleanWhiteBackgroundData,
  computeSpriteBoundsFromData,
  type SpriteBounds,
  type SpriteCutoutOptions,
  type SpriteRect,
} from './spriteCutoutAlgorithms';

const decodedImageCache = new Map<string, HTMLImageElement>();
const decodedImagePromiseCache = new Map<string, Promise<HTMLImageElement>>();
const cutoutCache = new Map<string, HTMLCanvasElement>();
const cutoutPromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const frameCache = new Map<string, HTMLCanvasElement>();
const framePromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const sheetFramesCache = new Map<string, HTMLCanvasElement[]>();
const sheetPromiseCache = new Map<string, Promise<HTMLCanvasElement[]>>();
const boundsCache = new WeakMap<HTMLCanvasElement, SpriteBounds>();

export function measureSpriteBounds(canvas: HTMLCanvasElement): SpriteBounds {
  const existing = boundsCache.get(canvas);
  if (existing) return existing;

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w === 0 || h === 0) return DEFAULT_SPRITE_BOUNDS;

  const data = ctx.getImageData(0, 0, w, h).data;
  const computed = computeSpriteBoundsFromData(data, w, h);
  boundsCache.set(canvas, computed);
  return computed;
}

function cleanWhiteBackgroundInCanvas(
  canvas: HTMLCanvasElement,
  options?: SpriteCutoutOptions,
  scratchArg?: ScratchBuffers,
  recordBounds = false,
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w === 0 || h === 0) return canvas;

  const imageData = ctx.getImageData(0, 0, w, h);
  if (options?.removeDarkBackground) {
    cleanDarkBackgroundData(imageData.data, w, h, options, scratchArg);
  } else {
    cleanWhiteBackgroundData(imageData.data, w, h, options, scratchArg);
  }
  ctx.putImageData(imageData, 0, 0);
  if (recordBounds) {
    boundsCache.set(canvas, computeSpriteBoundsFromData(imageData.data, w, h));
  }
  return canvas;
}

export function buildOptionsKey(options?: SpriteCutoutOptions): string {
  const colorKey =
    options?.saturationScale !== undefined || options?.crimsonDampen !== undefined
      ? `|sat_${options?.saturationScale ?? 1}_cd_${options?.crimsonDampen ?? 0}`
      : '';
  return `${options?.removeInteriorWhite ? '1' : '0'}|${options?.removeBottomFloorShadow ? '1' : '0'}|${options?.removeDarkBackground ? '1' : '0'}|${options?.minPocketArea ?? 'auto'}|${options?.defringeStrength ?? 0.55}|${options?.unmixLightGlow ? '1' : '0'}|${options?.unmixDarkHoloGlass ? '1' : '0'}|${options?.preserveExistingAlpha ? '1' : '0'}|${options?.maxDimension ?? 'full'}${colorKey}`;
}

function buildFrameCacheKey(src: string, rect: SpriteRect, optionsKey: string): string {
  const exKey = rect.excludeRects?.map((e) => `${e.x}.${e.y}.${e.w}.${e.h}`).join(',') ?? '';
  return `${src}|rect_${rect.x},${rect.y},${rect.w},${rect.h}_${exKey}|${optionsKey}`;
}

function buildSheetCacheKey(src: string, rects: readonly SpriteRect[], optionsKey: string): string {
  const rectsKey = rects
    .map((r) => {
      const ex = r.excludeRects?.map((e) => `${e.x}.${e.y}.${e.w}.${e.h}`).join(',') ?? '';
      return `${r.x},${r.y},${r.w},${r.h}${ex ? ':' + ex : ''}`;
    })
    .join(';');
  return `${src}|frames_${rects.length}_${rectsKey}|${optionsKey}`;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function getCachedDecodedImage(src: string): HTMLImageElement | null {
  return decodedImageCache.get(src) ?? null;
}

export function loadDecodedImage(src: string): Promise<HTMLImageElement> {
  const existing = decodedImageCache.get(src);
  if (existing) return Promise.resolve(existing);

  const inFlight = decodedImagePromiseCache.get(src);
  if (inFlight) return inFlight;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const finish = () => {
        decodedImageCache.set(src, img);
        decodedImagePromiseCache.delete(src);
        resolve(img);
      };
      if (typeof img.decode === 'function') {
        img.decode().then(finish, finish);
      } else {
        finish();
      }
    };
    img.onerror = (err) => {
      decodedImagePromiseCache.delete(src);
      reject(err);
    };
    img.src = src;
  });

  decodedImagePromiseCache.set(src, promise);
  return promise;
}

export function getCachedSpriteCutout(
  src: string,
  options?: SpriteCutoutOptions,
): HTMLCanvasElement | null {
  const cacheKey = `${src}|${buildOptionsKey(options)}`;
  return cutoutCache.get(cacheKey) ?? null;
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

  const promise = loadDecodedImage(src)
    .then((img) => {
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;
      const maxDim = options?.maxDimension;
      const scale =
        maxDim && maxDim > 0 && Math.max(natW, natH) > maxDim
          ? maxDim / Math.max(natW, natH)
          : 1;
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx && w > 0 && h > 0) {
        if (scale < 1) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }
        ctx.drawImage(img, 0, 0, w, h);
        if (!options?.preserveExistingAlpha) {
          const scaledOpts: SpriteCutoutOptions | undefined =
            scale < 1 && options?.minPocketArea !== undefined
              ? {
                  ...options,
                  minPocketArea: Math.max(4, Math.round(options.minPocketArea * scale * scale)),
                }
              : options;
          cleanWhiteBackgroundInCanvas(canvas, scaledOpts, undefined, true);
        } else {
          const imgData = ctx.getImageData(0, 0, w, h);
          boundsCache.set(canvas, computeSpriteBoundsFromData(imgData.data, w, h));
        }
      }
      cutoutCache.set(cacheKey, canvas);
      cutoutPromiseCache.delete(cacheKey);
      return canvas;
    })
    .catch((err) => {
      cutoutPromiseCache.delete(cacheKey);
      throw err;
    });

  cutoutPromiseCache.set(cacheKey, promise);
  return promise;
}

function extractFrameCanvas(
  img: HTMLImageElement,
  rect: SpriteRect,
  options?: SpriteCutoutOptions,
  scratch?: ScratchBuffers,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx && rect.w > 0 && rect.h > 0) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    if (rect.excludeRects && rect.excludeRects.length > 0) {
      for (const ex of rect.excludeRects) {
        ctx.clearRect(ex.x, ex.y, ex.w, ex.h);
      }
    }
    if (!options?.preserveExistingAlpha) {
      cleanWhiteBackgroundInCanvas(canvas, options, scratch);
    }
  }
  return canvas;
}

export function getCachedSpriteFrame(
  src: string,
  rect: SpriteRect,
  options?: SpriteCutoutOptions,
): HTMLCanvasElement | null {
  const optionsKey = buildOptionsKey(options);
  return frameCache.get(buildFrameCacheKey(src, rect, optionsKey)) ?? null;
}

export function loadSpriteFrame(
  src: string,
  rect: SpriteRect,
  options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement> {
  const optionsKey = buildOptionsKey(options);
  const key = buildFrameCacheKey(src, rect, optionsKey);
  const existing = frameCache.get(key);
  if (existing) return Promise.resolve(existing);

  const inFlight = framePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = loadDecodedImage(src)
    .then((img) => {
      const cachedAfterDecode = frameCache.get(key);
      if (cachedAfterDecode) {
        framePromiseCache.delete(key);
        return cachedAfterDecode;
      }
      const canvas = extractFrameCanvas(img, rect, options);
      frameCache.set(key, canvas);
      framePromiseCache.delete(key);
      return canvas;
    })
    .catch((err) => {
      framePromiseCache.delete(key);
      throw err;
    });

  framePromiseCache.set(key, promise);
  return promise;
}

export function getCachedSpriteSheetFrames(
  src: string,
  rects: readonly SpriteRect[],
  options?: SpriteCutoutOptions,
): HTMLCanvasElement[] | null {
  const optionsKey = buildOptionsKey(options);
  const cacheKey = buildSheetCacheKey(src, rects, optionsKey);
  const existing = sheetFramesCache.get(cacheKey);
  if (existing) return existing;

  const assembled = new Array<HTMLCanvasElement>(rects.length);
  for (let i = 0; i < rects.length; i++) {
    const f = frameCache.get(buildFrameCacheKey(src, rects[i], optionsKey));
    if (!f) return null;
    assembled[i] = f;
  }
  sheetFramesCache.set(cacheKey, assembled);
  return assembled;
}

export function loadSpriteSheetFrames(
  src: string,
  rects: readonly SpriteRect[],
  options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement[]> {
  const optionsKey = buildOptionsKey(options);
  const cacheKey = buildSheetCacheKey(src, rects, optionsKey);
  const existing = getCachedSpriteSheetFrames(src, rects, options);
  if (existing) return Promise.resolve(existing);

  const inFlight = sheetPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = loadDecodedImage(src)
    .then(async (img) => {
      let maxArea = 0;
      for (let i = 0; i < rects.length; i++) {
        const area = Math.max(0, rects[i].w) * Math.max(0, rects[i].h);
        if (area > maxArea) maxArea = area;
      }
      const scratch = createScratchBuffers(maxArea);
      const frames = new Array<HTMLCanvasElement>(rects.length);
      let sliceStart = typeof performance !== 'undefined' ? performance.now() : 0;

      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const fKey = buildFrameCacheKey(src, rect, optionsKey);
        const cachedFrame = frameCache.get(fKey);
        if (cachedFrame) {
          frames[i] = cachedFrame;
          continue;
        }

        const canvas = extractFrameCanvas(img, rect, options, scratch);
        frameCache.set(fKey, canvas);
        frames[i] = canvas;

        if (i + 1 < rects.length && typeof performance !== 'undefined') {
          if (performance.now() - sliceStart >= 7) {
            await yieldToMain();
            sliceStart = performance.now();
          }
        }
      }

      sheetFramesCache.set(cacheKey, frames);
      sheetPromiseCache.delete(cacheKey);
      return frames;
    })
    .catch((err) => {
      sheetPromiseCache.delete(cacheKey);
      throw err;
    });

  sheetPromiseCache.set(cacheKey, promise);
  return promise;
}
