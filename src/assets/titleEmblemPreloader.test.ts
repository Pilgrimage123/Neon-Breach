import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserTitleSpriteDecodeAdapter,
  createTitleEmblemPreloader,
  type TitleSpriteSource,
} from './titleEmblemPreloader';

const FRAME_URLS = [
  '/assets/aistudio/baked/k0.png',
  '/assets/aistudio/baked/k1.png',
  '/assets/aistudio/baked/k2.png',
  '/assets/aistudio/baked/k3.png',
  '/assets/aistudio/baked/k4.png',
] as const;

const LOCKUP_URL = '/assets/aistudio/baked/lockup_plane0.png';

test('createTitleEmblemPreloader prioritizes K0 and lockup plane and streams K1-K4 across macrotasks', async () => {
  const decodedUrls: string[] = [];
  let yieldCount = 0;

  const preloader = createTitleEmblemPreloader({
    frameUrls: FRAME_URLS,
    lockupUrl: LOCKUP_URL,
    adapter: {
      async decode(url: string): Promise<TitleSpriteSource> {
        decodedUrls.push(url);
        return { width: 960, height: 541 } as unknown as ImageBitmap;
      },
      async yieldMacrotask(): Promise<void> {
        yieldCount += 1;
      },
    },
  });

  const initial = await preloader.loadInitialTitleEmblem();
  assert.equal(initial.logo.width, 960);
  assert.equal(initial.lockup.width, 960);
  assert.deepEqual(decodedUrls, [FRAME_URLS[0], LOCKUP_URL]);
  assert.ok(preloader.getPreloadedTitleLogo());
  assert.ok(preloader.getPreloadedTitleLockup());

  // Repeating K0/lockup returns cached instances without re-decoding
  await preloader.loadTitleLogo();
  await preloader.loadTitleLockup();
  assert.equal(decodedUrls.length, 2);

  // Stream K1-K4 across macrotasks
  const readyIndices: number[] = [];
  const frames = await preloader.loadTitleLogoFrames((idx) => {
    readyIndices.push(idx);
  });

  assert.equal(frames.length, 5);
  assert.deepEqual(readyIndices, [0, 1, 2, 3, 4]);
  assert.deepEqual(decodedUrls, [
    FRAME_URLS[0],
    LOCKUP_URL,
    FRAME_URLS[1],
    FRAME_URLS[2],
    FRAME_URLS[3],
    FRAME_URLS[4],
  ]);
  assert.equal(yieldCount, 3, 'Expected macrotask yields between uncached K1-K4 frames');
  assert.equal(
    preloader.getPreloadedTitleLogoFrames().filter(Boolean).length,
    5,
  );
});

test('createBrowserTitleSpriteDecodeAdapter uses createImageBitmap when available and falls back to HTMLImageElement otherwise', async () => {
  const origFetch = globalThis.fetch;
  const origCreateImageBitmap = globalThis.createImageBitmap;

  try {
    let bitmapCalls = 0;
    let fallbackCalls = 0;

    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        blob: async () => new Blob([]),
      }) as unknown as Response) as typeof fetch;

    globalThis.createImageBitmap = (async () => {
      bitmapCalls += 1;
      return { width: 960, height: 541 } as unknown as ImageBitmap;
    }) as typeof createImageBitmap;

    const adapterWithBitmap = createBrowserTitleSpriteDecodeAdapter(async () => {
      fallbackCalls += 1;
      return { width: 960, height: 541 } as unknown as HTMLImageElement;
    });

    const bitmapSprite = await adapterWithBitmap.decode('/assets/aistudio/baked/k0.png');
    assert.equal(bitmapSprite.width, 960);
    assert.equal(bitmapCalls, 1);
    assert.equal(fallbackCalls, 0);

    // Disable createImageBitmap to verify automatic HTMLImageElement fallback
    (globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap =
      undefined;

    const fallbackSprite = await adapterWithBitmap.decode(
      '/assets/aistudio/baked/lockup_plane0.png',
    );
    assert.equal(fallbackSprite.width, 960);
    assert.equal(fallbackCalls, 1);
  } finally {
    globalThis.fetch = origFetch;
    globalThis.createImageBitmap = origCreateImageBitmap;
  }
});
