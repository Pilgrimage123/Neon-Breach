export type TitleSpriteSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export interface TitleSpriteDecodeAdapter {
  decode(url: string): Promise<TitleSpriteSource>;
  yieldMacrotask?: () => Promise<void>;
}

export interface TitleEmblemPreloader {
  getPreloadedTitleLogo(): TitleSpriteSource | null;
  loadTitleLogo(): Promise<TitleSpriteSource>;
  getPreloadedTitleLockup(): TitleSpriteSource | null;
  loadTitleLockup(): Promise<TitleSpriteSource>;
  getPreloadedTitleLogoFrames(): (TitleSpriteSource | null)[];
  loadTitleLogoFrames(
    onFrameReady?: (index: number, sprite: TitleSpriteSource) => void,
  ): Promise<TitleSpriteSource[]>;
  loadInitialTitleEmblem(): Promise<{
    logo: TitleSpriteSource;
    lockup: TitleSpriteSource;
  }>;
}

function defaultYieldMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 45);
  });
}

function defaultHtmlImageLoader(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to decode image: ${url}`));
    img.src = url;
  });
}

function materializeCpuSpriteCanvas(bitmap: ImageBitmap): TitleSpriteSource {
  if (typeof document === 'undefined') {
    return bitmap;
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return bitmap;
  }
  ctx.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === 'function') {
    bitmap.close();
  }
  return canvas;
}

/**
 * Decodes baked Title Emblem PNGs off the main thread via fetch() + createImageBitmap(),
 * blitting once into a CPU-backed offscreen canvas for fast triangle mesh rasterization,
 * and falling back automatically to HTMLImageElement decoding when unavailable.
 */
export function createBrowserTitleSpriteDecodeAdapter(
  fallbackImageLoader: (url: string) => Promise<HTMLImageElement> = defaultHtmlImageLoader,
): TitleSpriteDecodeAdapter {
  return {
    async decode(url: string): Promise<TitleSpriteSource> {
      if (
        typeof fetch === 'function' &&
        typeof createImageBitmap === 'function'
      ) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching ${url}`);
          }
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          return materializeCpuSpriteCanvas(bitmap);
        } catch {
          return fallbackImageLoader(url);
        }
      }
      return fallbackImageLoader(url);
    },
    yieldMacrotask: defaultYieldMacrotask,
  };
}

/**
 * Creates a Title Emblem preloader backed by an injectable decode adapter.
 * Prioritizes K0 and the Static Lockup Plane for first paint, then streams K1-K4 across macrotasks.
 */
export function createTitleEmblemPreloader(config: {
  frameUrls: readonly string[];
  lockupUrl: string;
  adapter: TitleSpriteDecodeAdapter;
}): TitleEmblemPreloader {
  const { frameUrls, lockupUrl, adapter } = config;
  const yieldTick = adapter.yieldMacrotask ?? defaultYieldMacrotask;
  const cache = new Map<string, TitleSpriteSource>();
  const inFlight = new Map<string, Promise<TitleSpriteSource>>();

  const loadSingle = (url: string): Promise<TitleSpriteSource> => {
    const cached = cache.get(url);
    if (cached) return Promise.resolve(cached);

    const existing = inFlight.get(url);
    if (existing) return existing;

    const promise = adapter
      .decode(url)
      .then((sprite) => {
        cache.set(url, sprite);
        inFlight.delete(url);
        return sprite;
      })
      .catch((err) => {
        inFlight.delete(url);
        throw err;
      });

    inFlight.set(url, promise);
    return promise;
  };

  return {
    getPreloadedTitleLogo(): TitleSpriteSource | null {
      return cache.get(frameUrls[0]) ?? null;
    },

    loadTitleLogo(): Promise<TitleSpriteSource> {
      return loadSingle(frameUrls[0]);
    },

    getPreloadedTitleLockup(): TitleSpriteSource | null {
      return cache.get(lockupUrl) ?? null;
    },

    loadTitleLockup(): Promise<TitleSpriteSource> {
      return loadSingle(lockupUrl);
    },

    getPreloadedTitleLogoFrames(): (TitleSpriteSource | null)[] {
      return frameUrls.map((url) => cache.get(url) ?? null);
    },

    async loadTitleLogoFrames(
      onFrameReady?: (index: number, sprite: TitleSpriteSource) => void,
    ): Promise<TitleSpriteSource[]> {
      const results: TitleSpriteSource[] = new Array(frameUrls.length);
      for (let i = 0; i < frameUrls.length; i++) {
        const url = frameUrls[i];
        const cached = cache.get(url);
        if (cached) {
          results[i] = cached;
          onFrameReady?.(i, cached);
          continue;
        }
        const sprite = await loadSingle(url);
        results[i] = sprite;
        onFrameReady?.(i, sprite);
        if (i + 1 < frameUrls.length) {
          await yieldTick();
        }
      }
      return results;
    },

    async loadInitialTitleEmblem(): Promise<{
      logo: TitleSpriteSource;
      lockup: TitleSpriteSource;
    }> {
      const [logo, lockup] = await Promise.all([
        loadSingle(frameUrls[0]),
        loadSingle(lockupUrl),
      ]);
      return { logo, lockup };
    },
  };
}
