import type { CharacterId, EnemyArchetype } from '../engine/types';
import {
  AURALINE_SHEET_A_FRAMES,
  AURALINE_SHEET_B_FRAMES,
} from '../utils/auralineSpriteSheet';
import {
  CRAWLER_FRAMES_BY_VARIANT,
  type CrawlerVariant,
  isCrawlerArchetype,
} from '../utils/crawlerSpriteSheet';
import {
  KIRA_SHEET_A_FRAMES,
  KIRA_SHEET_B_FRAMES,
} from '../utils/kiraSpriteSheet';
import { NURSE_FRAMES } from '../utils/nurseSpriteSheet';
import { BRUTE_SHEET_FRAMES } from '../utils/bruteSpriteSheet';
import {
  FERAL_NURSE_SHEET_A_FRAMES,
  FERAL_NURSE_SHEET_B_FRAMES,
} from '../utils/feralNurseSpriteSheet';
import { MUTDOG_SHEET_FRAMES } from '../utils/mutdogSpriteSheet';
import { SPITTER_SHEET_FRAMES } from '../utils/spitterSpriteSheet';
import {
  ZURI_COMBAT_FRAMES,
  ZURI_DRONE_FRAMES,
  ZURI_EMOTE_FRAMES,
  ZURI_SHEET_FRAMES,
} from '../utils/zuriSpriteSheet';
import {
  type SpriteBounds,
  type SpriteRect,
  getCachedDecodedImage,
  getCachedSpriteCutout,
  getCachedSpriteFrame,
  getCachedSpriteSheetFrames,
  loadDecodedImage,
  loadSpriteCutout,
  loadSpriteFrame,
  loadSpriteSheetFrames,
} from '../utils/spriteCutout';
import {
  BAKED_ENEMY_CUTOUT_BOUNDS,
  BAKED_ENEMY_PORTRAIT_BOUNDS,
} from './sprites/baked/bakedBounds';
import {
  buildBackgroundTaskOrder,
  buildEnemyPreloadOrder,
} from './preloadPlan';
import {
  createBrowserTitleSpriteDecodeAdapter,
  createTitleEmblemPreloader,
  type TitleSpriteSource,
} from './titleEmblemPreloader';
import { GAME_ASSETS } from './gameAssets';

export type { TitleSpriteSource };

const titleEmblemPreloader = createTitleEmblemPreloader({
  frameUrls: GAME_ASSETS.titleLogoFrames,
  lockupUrl: GAME_ASSETS.titleLockup,
  adapter: createBrowserTitleSpriteDecodeAdapter(loadDecodedImage),
});

interface PreloadedEnemyCutout {
  canvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

interface SheetSpec<R extends SpriteRect = SpriteRect> {
  url: string;
  frames: readonly R[];
}

const SHEET_SPECS = {
  auralineSheetA: { url: GAME_ASSETS.auralineSheetA, frames: AURALINE_SHEET_A_FRAMES },
  auralineSheetB: { url: GAME_ASSETS.auralineSheetB, frames: AURALINE_SHEET_B_FRAMES },
  kiraSheetA: { url: GAME_ASSETS.kiraSheetA, frames: KIRA_SHEET_A_FRAMES },
  kiraSheetB: { url: GAME_ASSETS.kiraSheetB, frames: KIRA_SHEET_B_FRAMES },
  zuriCombat: { url: GAME_ASSETS.zuri, frames: ZURI_COMBAT_FRAMES },
  zuriEmote: { url: GAME_ASSETS.zuriEmote, frames: ZURI_EMOTE_FRAMES },
  zuriDrones: { url: GAME_ASSETS.zuriDrones, frames: ZURI_DRONE_FRAMES },
  nurse: { url: GAME_ASSETS.nurse, frames: NURSE_FRAMES },
  spitter: { url: GAME_ASSETS.spitterSheet, frames: SPITTER_SHEET_FRAMES },
  mutdog: { url: GAME_ASSETS.mutdogSheet, frames: MUTDOG_SHEET_FRAMES },
  feralNurseA: { url: GAME_ASSETS.feralNurseSheetA, frames: FERAL_NURSE_SHEET_A_FRAMES },
  feralNurseB: { url: GAME_ASSETS.feralNurseSheetB, frames: FERAL_NURSE_SHEET_B_FRAMES },
  brute: { url: GAME_ASSETS.bruteSheet, frames: BRUTE_SHEET_FRAMES },
} as const satisfies Record<string, SheetSpec>;

function getSheet(spec: SheetSpec): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(spec.url, spec.frames);
}

function loadSheet(spec: SheetSpec): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(spec.url, spec.frames);
}

function getCutoutWithBounds(url: string, bounds: SpriteBounds): PreloadedEnemyCutout | null {
  const canvas = getCachedSpriteCutout(url);
  return canvas ? { canvas, bounds } : null;
}

function getFirstFrameCutout(
  frames: HTMLCanvasElement[] | null,
  bounds: SpriteBounds,
): PreloadedEnemyCutout | null {
  if (!frames || !frames[0]) return null;
  return { canvas: frames[0], bounds };
}

export function getPreloadedTitleBg(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.titleBg);
}

export function loadTitleBg(): Promise<HTMLImageElement> {
  return loadDecodedImage(GAME_ASSETS.titleBg);
}

export function getPreloadedTitleLogo(): TitleSpriteSource | null {
  return titleEmblemPreloader.getPreloadedTitleLogo();
}

export function loadTitleLogo(): Promise<TitleSpriteSource> {
  return titleEmblemPreloader.loadTitleLogo();
}

export function getPreloadedTitleLockup(): TitleSpriteSource | null {
  return titleEmblemPreloader.getPreloadedTitleLockup();
}

export function loadTitleLockup(): Promise<TitleSpriteSource> {
  return titleEmblemPreloader.loadTitleLockup();
}

export function getPreloadedTitleLogoFrames(): (TitleSpriteSource | null)[] {
  return titleEmblemPreloader.getPreloadedTitleLogoFrames();
}

export function loadTitleLogoFrames(
  onFrameReady?: (index: number, sprite: TitleSpriteSource) => void,
): Promise<TitleSpriteSource[]> {
  return titleEmblemPreloader.loadTitleLogoFrames(onFrameReady);
}

function getPortraitSpec(charId: CharacterId): { url: string; frame: SpriteRect } {
  if (charId === 'auraline') {
    return { url: GAME_ASSETS.auralineSheetA, frame: AURALINE_SHEET_A_FRAMES[0] };
  }
  if (charId === 'zuri') {
    return { url: GAME_ASSETS.zuri, frame: ZURI_SHEET_FRAMES[8] };
  }
  return { url: GAME_ASSETS.kiraSheetA, frame: KIRA_SHEET_A_FRAMES[0] };
}

export function getPreloadedPortraitFrame(charId: CharacterId): HTMLCanvasElement | null {
  const spec = getPortraitSpec(charId);
  return getCachedSpriteFrame(spec.url, spec.frame);
}

export function loadPortraitFrame(charId: CharacterId): Promise<HTMLCanvasElement> {
  const spec = getPortraitSpec(charId);
  return loadSpriteFrame(spec.url, spec.frame);
}

export function getPreloadedBackdrop(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.arenaBackdrop);
}

export function getPreloadedAuralineSurgeBlastVfx(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.auralineSurgeBlastVfx);
}

export function loadAuralineSurgeBlastVfx(): Promise<HTMLImageElement> {
  return loadDecodedImage(GAME_ASSETS.auralineSurgeBlastVfx);
}

export function getPreloadedCrawlerFrames(variant: CrawlerVariant): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.crawlerSheet,
    CRAWLER_FRAMES_BY_VARIANT[variant],
  );
}

export function loadCrawlerVariantFrames(variant: CrawlerVariant): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.crawlerSheet,
    CRAWLER_FRAMES_BY_VARIANT[variant],
  );
}

export function getPreloadedZuriDroneFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.zuriDrones);
}

export function getPreloadedNurseFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.nurse);
}

export function loadNurseFrames(): Promise<HTMLCanvasElement[]> {
  return loadSheet(SHEET_SPECS.nurse);
}

export function getPreloadedStalkerFrames(): HTMLCanvasElement[] | null {
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < GAME_ASSETS.stalkerFrames.length; i++) {
    const canvas = getCachedSpriteCutout(GAME_ASSETS.stalkerFrames[i]);
    if (!canvas) return null;
    frames.push(canvas);
  }
  return frames;
}

function loadStalkerFrames(): Promise<HTMLCanvasElement[]> {
  return Promise.all(
    GAME_ASSETS.stalkerFrames.map((url) => loadSpriteCutout(url)),
  );
}

export function getPreloadedMatriarchFrames(): HTMLCanvasElement[] | null {
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < GAME_ASSETS.matriarchFrames.length; i++) {
    const canvas = getCachedSpriteCutout(GAME_ASSETS.matriarchFrames[i]);
    if (!canvas) return null;
    frames.push(canvas);
  }
  return frames;
}

function loadMatriarchFrames(): Promise<HTMLCanvasElement[]> {
  return Promise.all(
    GAME_ASSETS.matriarchFrames.map((url) => loadSpriteCutout(url)),
  );
}

export function getPreloadedSpitterFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.spitter);
}

export function getPreloadedMutdogFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.mutdog);
}

export function getPreloadedFeralNurseFrames(): HTMLCanvasElement[] | null {
  const sheetA = getSheet(SHEET_SPECS.feralNurseA);
  const sheetB = getSheet(SHEET_SPECS.feralNurseB);
  if (!sheetA || !sheetB) return null;
  return [...sheetA, ...sheetB];
}

export function getPreloadedBruteFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.brute);
}

export function getPreloadedEnemyPortrait(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (!portraitUrl) return getPreloadedEnemyCutout(arch);
  return getCutoutWithBounds(portraitUrl, BAKED_ENEMY_PORTRAIT_BOUNDS[arch]);
}

export function loadEnemyPortrait(arch: EnemyArchetype): Promise<HTMLCanvasElement> {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (portraitUrl) {
    return loadSpriteCutout(portraitUrl);
  }
  if (isCrawlerArchetype(arch)) {
    return loadCrawlerVariantFrames(arch).then((frames) => frames[0]);
  }
  return loadSpriteCutout(GAME_ASSETS.bossPortrait);
}

export function getPreloadedEnemyCutout(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  const bounds = BAKED_ENEMY_CUTOUT_BOUNDS[arch];
  if (isCrawlerArchetype(arch)) return getFirstFrameCutout(getPreloadedCrawlerFrames(arch), bounds);
  if (arch === 'stalker') return getFirstFrameCutout(getPreloadedStalkerFrames(), bounds);
  if (arch === 'spitter') return getFirstFrameCutout(getPreloadedSpitterFrames(), bounds);
  if (arch === 'mutdog') return getFirstFrameCutout(getPreloadedMutdogFrames(), bounds);
  if (arch === 'feral_nurse') return getFirstFrameCutout(getPreloadedFeralNurseFrames(), bounds);
  if (arch === 'brute') return getFirstFrameCutout(getPreloadedBruteFrames(), bounds);
  if (arch === 'boss') {
    return (
      getFirstFrameCutout(getPreloadedMatriarchFrames(), bounds) ??
      getCutoutWithBounds(GAME_ASSETS.bossPortrait, bounds)
    );
  }
  return getCutoutWithBounds(GAME_ASSETS.bossPortrait, bounds);
}

export function getPreloadedHeroFrames(charId: CharacterId): HTMLCanvasElement[] | null {
  if (charId === 'auraline') {
    const sheetA = getSheet(SHEET_SPECS.auralineSheetA);
    if (!sheetA) return null;
    const sheetB = getSheet(SHEET_SPECS.auralineSheetB);
    return sheetB ? [...sheetA, ...sheetB] : [...sheetA];
  }
  if (charId === 'zuri') {
    const combat = getSheet(SHEET_SPECS.zuriCombat);
    if (!combat) return null;
    const slots = new Array<HTMLCanvasElement>(ZURI_SHEET_FRAMES.length);
    for (let i = 0; i < combat.length; i++) slots[i] = combat[i];
    const emote = getSheet(SHEET_SPECS.zuriEmote);
    if (emote) {
      const offset = ZURI_COMBAT_FRAMES.length;
      for (let i = 0; i < emote.length; i++) slots[offset + i] = emote[i];
    }
    return slots;
  }
  const sheetA = getSheet(SHEET_SPECS.kiraSheetA);
  if (!sheetA) return null;
  const sheetB = getSheet(SHEET_SPECS.kiraSheetB);
  return sheetB ? [...sheetA, ...sheetB] : [...sheetA];
}

export function areCriticalCombatAssetsReady(
  charId: CharacterId,
  enemyArchetypes: readonly EnemyArchetype[],
): boolean {
  if (!getPreloadedBackdrop()) return false;
  if (!getPreloadedHeroFrames(charId)) return false;
  if (charId === 'zuri' && !getPreloadedZuriDroneFrames()) return false;
  for (let i = 0; i < enemyArchetypes.length; i++) {
    const arch = enemyArchetypes[i];
    if (isCrawlerArchetype(arch)) {
      if (!getPreloadedCrawlerFrames(arch)) return false;
    } else if (arch === 'stalker') {
      if (!getPreloadedStalkerFrames()) return false;
    } else if (arch === 'spitter') {
      if (!getPreloadedSpitterFrames()) return false;
    } else if (arch === 'mutdog') {
      if (!getPreloadedMutdogFrames()) return false;
    } else if (arch === 'feral_nurse') {
      if (!getPreloadedFeralNurseFrames()) return false;
    } else if (arch === 'brute') {
      if (!getPreloadedBruteFrames()) return false;
    } else if (arch === 'boss') {
      if (!getPreloadedMatriarchFrames()) return false;
    } else if (!getPreloadedEnemyCutout(arch)) {
      return false;
    }
  }
  return true;
}

let activeBgEpoch = 0;
const preloadListeners = new Set<() => void>();

export function subscribePreloadUpdates(listener: () => void): () => void {
  preloadListeners.add(listener);
  return () => {
    preloadListeners.delete(listener);
  };
}

function notifyPreloadListeners(): void {
  preloadListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

function loadEnemyAssets(arch: EnemyArchetype): Promise<unknown> {
  if (isCrawlerArchetype(arch)) return loadCrawlerVariantFrames(arch);
  if (arch === 'stalker') return loadStalkerFrames();
  if (arch === 'spitter') return Promise.all([loadSheet(SHEET_SPECS.spitter), loadEnemyPortrait('spitter')]);
  if (arch === 'mutdog') return Promise.all([loadSheet(SHEET_SPECS.mutdog), loadEnemyPortrait('mutdog')]);
  if (arch === 'feral_nurse') {
    return Promise.all([
      loadSheet(SHEET_SPECS.feralNurseA),
      loadSheet(SHEET_SPECS.feralNurseB),
      loadEnemyPortrait('feral_nurse'),
    ]);
  }
  if (arch === 'brute') return Promise.all([loadSheet(SHEET_SPECS.brute), loadEnemyPortrait('brute')]);
  if (arch === 'boss') return Promise.all([loadMatriarchFrames(), loadEnemyPortrait('boss')]);
  return loadSpriteCutout(GAME_ASSETS.bossPortrait);
}

async function runBackgroundTask(taskId: string): Promise<void> {
  if (taskId === 'backdrop') {
    await loadDecodedImage(GAME_ASSETS.arenaBackdrop);
  } else if (taskId === 'char:kira') {
    await loadSheet(SHEET_SPECS.kiraSheetA);
  } else if (taskId === 'char:kira_emote') {
    await loadSheet(SHEET_SPECS.kiraSheetB);
  } else if (taskId === 'char:auraline') {
    await Promise.all([
      loadSheet(SHEET_SPECS.auralineSheetA),
      loadSheet(SHEET_SPECS.auralineSheetB),
      loadAuralineSurgeBlastVfx(),
    ]);
  } else if (taskId === 'char:zuri') {
    await loadSheet(SHEET_SPECS.zuriCombat);
  } else if (taskId === 'char:zuri_emote') {
    await loadSheet(SHEET_SPECS.zuriEmote);
  } else if (taskId === 'char:zuri_drones') {
    await loadSheet(SHEET_SPECS.zuriDrones);
  } else if (taskId === 'nurse') {
    await loadSheet(SHEET_SPECS.nurse);
  } else if (taskId.startsWith('enemy:')) {
    await loadEnemyAssets(taskId.slice(6) as EnemyArchetype);
  }
}

function yieldTick(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function runTaskQueue(
  tasks: string[],
  epoch: number,
  interTaskDelayMs = 0,
): Promise<void> {
  for (let i = 0; i < tasks.length; i++) {
    if (epoch !== activeBgEpoch) return;
    try {
      await runBackgroundTask(tasks[i]);
      if (epoch === activeBgEpoch) {
        notifyPreloadListeners();
      }
    } catch {
      // Ignore individual asset preload failures; live screen renders fallback cleanly
    }
    if (epoch !== activeBgEpoch) return;
    await yieldTick(interTaskDelayMs);
  }
}

export function preloadForTitleScreen(selectedChar: CharacterId): void {
  const epoch = ++activeBgEpoch;

  const titleCritical = Promise.allSettled([
    loadTitleBg(),
    loadTitleLogo(),
    loadTitleLockup(),
    loadPortraitFrame('kira'),
    loadPortraitFrame('auraline'),
    loadPortraitFrame('zuri'),
  ]);

  void titleCritical.then(async () => {
    if (epoch !== activeBgEpoch) return;
    try {
      await loadTitleLogoFrames();
    } catch {
      // Secondary logo frames degrade gracefully to frame 0
    }
    if (epoch !== activeBgEpoch) return;
    // Allow initial Title Screen emblem animation frames to settle before decoding heavy combat sheets
    await yieldTick(500);
    if (epoch !== activeBgEpoch) return;
    const tasks = buildBackgroundTaskOrder(selectedChar);
    void runTaskQueue(tasks, epoch, 180);
  });
}

export async function ensureCombatAssetsReady(
  charId: CharacterId,
  enemyArchetypes: readonly EnemyArchetype[],
): Promise<void> {
  const epoch = ++activeBgEpoch;
  const { critical, deferred } = buildEnemyPreloadOrder(enemyArchetypes);

  const criticalPromises: Promise<unknown>[] = [
    loadDecodedImage(GAME_ASSETS.arenaBackdrop),
    charId === 'auraline'
      ? Promise.all([
          loadSheet(SHEET_SPECS.auralineSheetA),
          loadSheet(SHEET_SPECS.auralineSheetB),
          loadAuralineSurgeBlastVfx(),
        ])
      : charId === 'zuri'
        ? Promise.all([loadSheet(SHEET_SPECS.zuriCombat), loadSheet(SHEET_SPECS.zuriDrones)])
        : Promise.all([loadSheet(SHEET_SPECS.kiraSheetA), loadSheet(SHEET_SPECS.kiraSheetB)]),
  ];

  for (let i = 0; i < critical.length; i++) {
    criticalPromises.push(loadEnemyAssets(critical[i]));
  }

  await Promise.allSettled(criticalPromises);
  notifyPreloadListeners();

  if (epoch !== activeBgEpoch) return;

  const bgTasks: string[] = [];
  if (charId === 'kira') bgTasks.push('char:kira_emote');
  if (charId === 'zuri') bgTasks.push('char:zuri_emote');
  for (let i = 0; i < deferred.length; i++) {
    bgTasks.push(`enemy:${deferred[i]}`);
  }
  void runTaskQueue(bgTasks, epoch);
}
