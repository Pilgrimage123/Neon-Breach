import type {
  SpriteCutoutOptions,
  SpriteRect,
} from './spriteCutoutBounds';

export type { SpriteBounds, SpriteCutoutOptions, SpriteRect } from './spriteCutoutBounds';

type DecodedSheetSource = HTMLImageElement | ImageBitmap;

const decodedImageCache = new Map<string, HTMLImageElement>();
const decodedImagePromiseCache = new Map<string, Promise<HTMLImageElement>>();
const decodedSheetCache = new Map<string, DecodedSheetSource>();
const decodedSheetPromiseCache = new Map<string, Promise<DecodedSheetSource>>();
const cutoutCache = new Map<string, HTMLCanvasElement>();
const cutoutPromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const frameCache = new Map<string, HTMLCanvasElement>();
const framePromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const sheetFramesCache = new Map<string, HTMLCanvasElement[]>();
const sheetPromiseCache = new Map<string, Promise<HTMLCanvasElement[]>>();

function buildFrameCacheKey(src: string, rect: SpriteRect): string {
  const exKey = rect.excludeRects?.map((e) => `${e.x}.${e.y}.${e.w}.${e.h}`).join(',') ?? '';
  return `${src}|rect_${rect.x},${rect.y},${rect.w},${rect.h}_${exKey}`;
}

function buildSheetCacheKey(src: string, rects: readonly SpriteRect[]): string {
  const rectsKey = rects
    .map((r) => {
      const ex = r.excludeRects?.map((e) => `${e.x}.${e.y}.${e.w}.${e.h}`).join(',') ?? '';
      return `${r.x},${r.y},${r.w},${r.h}${ex ? ':' + ex : ''}`;
    })
    .join(';');
  return `${src}|frames_${rects.length}_${rectsKey}`;
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

function loadBakedSheetSource(src: string): Promise<DecodedSheetSource> {
  const existing = decodedSheetCache.get(src);
  if (existing) return Promise.resolve(existing);

  const inFlight = decodedSheetPromiseCache.get(src);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<DecodedSheetSource> => {
    if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          const bitmap = await createImageBitmap(blob);
          decodedSheetCache.set(src, bitmap);
          decodedSheetPromiseCache.delete(src);
          return bitmap;
        }
      } catch {
        // Fall back to HTMLImageElement decode
      }
    }
    const img = await loadDecodedImage(src);
    decodedSheetCache.set(src, img);
    decodedSheetPromiseCache.delete(src);
    return img;
  })().catch((err) => {
    decodedSheetPromiseCache.delete(src);
    throw err;
  });

  decodedSheetPromiseCache.set(src, promise);
  return promise;
}

export function getCachedSpriteCutout(
  src: string,
  _options?: SpriteCutoutOptions,
): HTMLCanvasElement | null {
  return cutoutCache.get(src) ?? null;
}

export function loadSpriteCutout(
  src: string,
  _options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement> {
  const existing = cutoutCache.get(src);
  if (existing) return Promise.resolve(existing);

  const inFlight = cutoutPromiseCache.get(src);
  if (inFlight) return inFlight;

  const promise = loadBakedSheetSource(src)
    .then((source) => {
      const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
      const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext('2d');
      if (ctx && w > 0 && h > 0) {
        ctx.drawImage(source, 0, 0, w, h);
      }
      cutoutCache.set(src, canvas);
      cutoutPromiseCache.delete(src);
      return canvas;
    })
    .catch((err) => {
      cutoutPromiseCache.delete(src);
      throw err;
    });

  cutoutPromiseCache.set(src, promise);
  return promise;
}

function extractFrameCanvas(source: DecodedSheetSource, rect: SpriteRect): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (ctx && rect.w > 0 && rect.h > 0) {
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    if (rect.excludeRects && rect.excludeRects.length > 0) {
      for (let i = 0; i < rect.excludeRects.length; i++) {
        const ex = rect.excludeRects[i];
        ctx.clearRect(ex.x, ex.y, ex.w, ex.h);
      }
    }
  }
  return canvas;
}

export function getCachedSpriteFrame(
  src: string,
  rect: SpriteRect,
  _options?: SpriteCutoutOptions,
): HTMLCanvasElement | null {
  return frameCache.get(buildFrameCacheKey(src, rect)) ?? null;
}

export function loadSpriteFrame(
  src: string,
  rect: SpriteRect,
  _options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement> {
  const key = buildFrameCacheKey(src, rect);
  const existing = frameCache.get(key);
  if (existing) return Promise.resolve(existing);

  const inFlight = framePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = loadBakedSheetSource(src)
    .then((source) => {
      const cachedAfterDecode = frameCache.get(key);
      if (cachedAfterDecode) {
        framePromiseCache.delete(key);
        return cachedAfterDecode;
      }
      const canvas = extractFrameCanvas(source, rect);
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
  _options?: SpriteCutoutOptions,
): HTMLCanvasElement[] | null {
  const cacheKey = buildSheetCacheKey(src, rects);
  const existing = sheetFramesCache.get(cacheKey);
  if (existing) return existing;

  const assembled = new Array<HTMLCanvasElement>(rects.length);
  for (let i = 0; i < rects.length; i++) {
    const f = frameCache.get(buildFrameCacheKey(src, rects[i]));
    if (!f) return null;
    assembled[i] = f;
  }
  sheetFramesCache.set(cacheKey, assembled);
  return assembled;
}

export function loadSpriteSheetFrames(
  src: string,
  rects: readonly SpriteRect[],
  _options?: SpriteCutoutOptions,
): Promise<HTMLCanvasElement[]> {
  const cacheKey = buildSheetCacheKey(src, rects);
  const existing = getCachedSpriteSheetFrames(src, rects);
  if (existing) return Promise.resolve(existing);

  const inFlight = sheetPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = loadBakedSheetSource(src)
    .then(async (source) => {
      const frames = new Array<HTMLCanvasElement>(rects.length);
      let sliceStart = typeof performance !== 'undefined' ? performance.now() : 0;

      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const fKey = buildFrameCacheKey(src, rect);
        const cachedFrame = frameCache.get(fKey);
        if (cachedFrame) {
          frames[i] = cachedFrame;
          continue;
        }

        const canvas = extractFrameCanvas(source, rect);
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
