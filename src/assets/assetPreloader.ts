import type { CharacterId, EnemyArchetype } from '../engine/types';
import { AURALINE_SHEET_FRAMES } from '../utils/auralineSpriteSheet';
import {
  CRAWLER_FRAMES_BY_VARIANT,
  type CrawlerVariant,
  isCrawlerArchetype,
} from '../utils/crawlerSpriteSheet';
import {
  HEROINE_COMBAT_FRAMES,
  HEROINE_DODGE_FRAMES,
  HEROINE_EMOTE_FRAMES,
  HEROINE_SHEET_FRAMES,
} from '../utils/kiraSpriteSheet';
import {
  NURSE_FRAMES,
  NURSE_SHEET_OPTIONS,
} from '../utils/nurseSpriteSheet';
import { BRUTE_SHEET_FRAMES } from '../utils/bruteSpriteSheet';
import { SPITTER_SHEET_FRAMES } from '../utils/spitterSpriteSheet';
import { STALKER_SHEET_FRAMES } from '../utils/stalkerSpriteSheet';
import {
  ZURI_COMBAT_FRAMES,
  ZURI_DRONES_OPTIONS,
  ZURI_DRONE_FRAMES,
  ZURI_EMOTE_FRAMES,
  ZURI_SHEET_FRAMES,
  ZURI_SHEET_OPTIONS,
} from '../utils/zuriSpriteSheet';
import {
  type SpriteBounds,
  type SpriteCutoutOptions,
  type SpriteRect,
  getCachedDecodedImage,
  getCachedSpriteCutout,
  getCachedSpriteFrame,
  getCachedSpriteSheetFrames,
  loadDecodedImage,
  loadSpriteCutout,
  loadSpriteFrame,
  loadSpriteSheetFrames,
  measureSpriteBounds,
} from '../utils/spriteCutout';
import {
  buildBackgroundTaskOrder,
  buildEnemyPreloadOrder,
} from './preloadPlan';
import { GAME_ASSETS } from './gameAssets';

const KIRA_COMBAT_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 14,
  defringeStrength: 0.78,
};

const KIRA_EMOTE_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 14,
  defringeStrength: 0.78,
  unmixLightGlow: true,
};

const KIRA_DODGE_OPTIONS: SpriteCutoutOptions = {
  preserveExistingAlpha: true,
};

const AURALINE_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeBottomFloorShadow: true,
  defringeStrength: 0.78,
};

const ENEMY_CUTOUT_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.78,
  maxDimension: 512,
};

const CRAWLER_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 24,
  defringeStrength: 0.78,
};

const STALKER_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.76,
};

const STALKER_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.76,
  maxDimension: 512,
};

const SPITTER_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.76,
};

const SPITTER_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.76,
  maxDimension: 512,
};

const BRUTE_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 18,
  defringeStrength: 0.76,
};

const BRUTE_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
  maxDimension: 512,
};

const TITLE_LOGO_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 32,
  defringeStrength: 0.82,
  unmixLightGlow: true,
  maxDimension: 960,
};

interface PreloadedEnemyCutout {
  canvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

interface SheetSpec<R extends SpriteRect = SpriteRect> {
  url: string;
  frames: readonly R[];
  options: SpriteCutoutOptions;
}

const SHEET_SPECS = {
  auraline: { url: GAME_ASSETS.auraline, frames: AURALINE_SHEET_FRAMES, options: AURALINE_SHEET_OPTIONS },
  kiraCombat: { url: GAME_ASSETS.kira, frames: HEROINE_COMBAT_FRAMES, options: KIRA_COMBAT_OPTIONS },
  kiraEmote: { url: GAME_ASSETS.kiraEmote, frames: HEROINE_EMOTE_FRAMES, options: KIRA_EMOTE_OPTIONS },
  zuriCombat: { url: GAME_ASSETS.zuri, frames: ZURI_COMBAT_FRAMES, options: ZURI_SHEET_OPTIONS },
  zuriEmote: { url: GAME_ASSETS.zuriEmote, frames: ZURI_EMOTE_FRAMES, options: ZURI_SHEET_OPTIONS },
  zuriDrones: { url: GAME_ASSETS.zuriDrones, frames: ZURI_DRONE_FRAMES, options: ZURI_DRONES_OPTIONS },
  nurse: { url: GAME_ASSETS.nurse, frames: NURSE_FRAMES, options: NURSE_SHEET_OPTIONS },
  stalker: { url: GAME_ASSETS.stalkerSheet, frames: STALKER_SHEET_FRAMES, options: STALKER_SHEET_OPTIONS },
  spitter: { url: GAME_ASSETS.spitterSheet, frames: SPITTER_SHEET_FRAMES, options: SPITTER_SHEET_OPTIONS },
  brute: { url: GAME_ASSETS.bruteSheet, frames: BRUTE_SHEET_FRAMES, options: BRUTE_SHEET_OPTIONS },
} as const satisfies Record<string, SheetSpec>;

function getSheet(spec: SheetSpec): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(spec.url, spec.frames, spec.options);
}

function loadSheet(spec: SheetSpec): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(spec.url, spec.frames, spec.options);
}

function getCutoutWithBounds(url: string, options: SpriteCutoutOptions): PreloadedEnemyCutout | null {
  const canvas = getCachedSpriteCutout(url, options);
  return canvas ? { canvas, bounds: measureSpriteBounds(canvas) } : null;
}

function getFirstFrameCutout(frames: HTMLCanvasElement[] | null): PreloadedEnemyCutout | null {
  if (!frames || !frames[0]) return null;
  return { canvas: frames[0], bounds: measureSpriteBounds(frames[0]) };
}

function yieldTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function getPreloadedTitleBg(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.titleBg);
}

export function loadTitleBg(): Promise<HTMLImageElement> {
  return loadDecodedImage(GAME_ASSETS.titleBg);
}

export function getPreloadedTitleLogo(): HTMLCanvasElement | null {
  return getCachedSpriteCutout(GAME_ASSETS.titleLogo, TITLE_LOGO_OPTIONS);
}

export function loadTitleLogo(): Promise<HTMLCanvasElement> {
  return loadSpriteCutout(GAME_ASSETS.titleLogo, TITLE_LOGO_OPTIONS);
}

export function getPreloadedTitleLogoFrames(): (HTMLCanvasElement | null)[] {
  return GAME_ASSETS.titleLogoFrames.map((url) =>
    getCachedSpriteCutout(url, TITLE_LOGO_OPTIONS),
  );
}

export async function loadTitleLogoFrames(
  onFrameReady?: (index: number, canvas: HTMLCanvasElement) => void,
): Promise<HTMLCanvasElement[]> {
  const results: HTMLCanvasElement[] = new Array(GAME_ASSETS.titleLogoFrames.length);
  for (let i = 0; i < GAME_ASSETS.titleLogoFrames.length; i++) {
    const url = GAME_ASSETS.titleLogoFrames[i];
    const cached = getCachedSpriteCutout(url, TITLE_LOGO_OPTIONS);
    if (cached) {
      results[i] = cached;
      onFrameReady?.(i, cached);
      continue;
    }
    const cutout = await loadSpriteCutout(url, TITLE_LOGO_OPTIONS);
    results[i] = cutout;
    onFrameReady?.(i, cutout);
    if (i + 1 < GAME_ASSETS.titleLogoFrames.length) {
      await yieldTick();
    }
  }
  return results;
}

function getPortraitSpec(charId: CharacterId): { url: string; frame: SpriteRect; options: SpriteCutoutOptions } {
  if (charId === 'auraline') {
    return { url: GAME_ASSETS.auraline, frame: AURALINE_SHEET_FRAMES[0], options: AURALINE_SHEET_OPTIONS };
  }
  if (charId === 'zuri') {
    return { url: GAME_ASSETS.zuri, frame: ZURI_SHEET_FRAMES[8], options: ZURI_SHEET_OPTIONS };
  }
  return { url: GAME_ASSETS.kira, frame: HEROINE_COMBAT_FRAMES[0], options: KIRA_COMBAT_OPTIONS };
}

export function getPreloadedPortraitFrame(charId: CharacterId): HTMLCanvasElement | null {
  const spec = getPortraitSpec(charId);
  return getCachedSpriteFrame(spec.url, spec.frame, spec.options);
}

export function loadPortraitFrame(charId: CharacterId): Promise<HTMLCanvasElement> {
  const spec = getPortraitSpec(charId);
  return loadSpriteFrame(spec.url, spec.frame, spec.options);
}

export function getPreloadedBackdrop(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.arenaBackdrop);
}

export function getPreloadedCrawlerFrames(variant: CrawlerVariant): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.crawlerSheet,
    CRAWLER_FRAMES_BY_VARIANT[variant],
    CRAWLER_SHEET_OPTIONS,
  );
}

export function loadCrawlerVariantFrames(variant: CrawlerVariant): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.crawlerSheet,
    CRAWLER_FRAMES_BY_VARIANT[variant],
    CRAWLER_SHEET_OPTIONS,
  );
}

export function getPreloadedZuriDroneFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.zuriDrones);
}

function getPreloadedKiraDodgeFrames(): HTMLCanvasElement[] | null {
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < GAME_ASSETS.kiraDodge.length; i++) {
    const canvas = getCachedSpriteCutout(GAME_ASSETS.kiraDodge[i], KIRA_DODGE_OPTIONS);
    if (!canvas) return null;
    frames.push(canvas);
  }
  return frames;
}

function loadKiraDodgeFrames(): Promise<HTMLCanvasElement[]> {
  return Promise.all(
    GAME_ASSETS.kiraDodge.map((url) => loadSpriteCutout(url, KIRA_DODGE_OPTIONS)),
  );
}

export function getPreloadedNurseFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.nurse);
}

export function loadNurseFrames(): Promise<HTMLCanvasElement[]> {
  return loadSheet(SHEET_SPECS.nurse);
}

export function getPreloadedStalkerFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.stalker);
}

export function getPreloadedSpitterFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.spitter);
}

export function getPreloadedBruteFrames(): HTMLCanvasElement[] | null {
  return getSheet(SHEET_SPECS.brute);
}

function getEnemyPortraitOptions(arch: EnemyArchetype): SpriteCutoutOptions {
  if (arch === 'brute') return BRUTE_PORTRAIT_OPTIONS;
  if (arch === 'spitter') return SPITTER_PORTRAIT_OPTIONS;
  return STALKER_PORTRAIT_OPTIONS;
}

export function getPreloadedEnemyPortrait(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (!portraitUrl) return getPreloadedEnemyCutout(arch);
  return getCutoutWithBounds(portraitUrl, getEnemyPortraitOptions(arch));
}

export function loadEnemyPortrait(arch: EnemyArchetype): Promise<HTMLCanvasElement> {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (portraitUrl) {
    return loadSpriteCutout(portraitUrl, getEnemyPortraitOptions(arch));
  }
  if (isCrawlerArchetype(arch)) {
    return loadCrawlerVariantFrames(arch).then((frames) => frames[0]);
  }
  return loadSpriteCutout(GAME_ASSETS.bossPortrait, ENEMY_CUTOUT_OPTIONS);
}

export function getPreloadedEnemyCutout(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  if (isCrawlerArchetype(arch)) return getFirstFrameCutout(getPreloadedCrawlerFrames(arch));
  if (arch === 'stalker') return getFirstFrameCutout(getPreloadedStalkerFrames());
  if (arch === 'spitter') return getFirstFrameCutout(getPreloadedSpitterFrames());
  if (arch === 'brute') return getFirstFrameCutout(getPreloadedBruteFrames());
  return getCutoutWithBounds(GAME_ASSETS.bossPortrait, ENEMY_CUTOUT_OPTIONS);
}

export function getPreloadedHeroFrames(charId: CharacterId): HTMLCanvasElement[] | null {
  if (charId === 'auraline') {
    return getSheet(SHEET_SPECS.auraline);
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
  const combat = getSheet(SHEET_SPECS.kiraCombat);
  if (!combat) return null;
  const slots = new Array<HTMLCanvasElement>(HEROINE_SHEET_FRAMES.length);
  for (let i = 0; i < combat.length; i++) slots[i] = combat[i];
  const emote = getSheet(SHEET_SPECS.kiraEmote);
  if (emote) {
    const offset = HEROINE_COMBAT_FRAMES.length;
    for (let i = 0; i < emote.length; i++) slots[offset + i] = emote[i];
  }
  const dodgeOffset = HEROINE_COMBAT_FRAMES.length + HEROINE_EMOTE_FRAMES.length;
  for (let i = 0; i < HEROINE_DODGE_FRAMES.length; i++) {
    const url = GAME_ASSETS.kiraDodge[i];
    const dodgeCanvas = url ? getCachedSpriteCutout(url, KIRA_DODGE_OPTIONS) : null;
    if (dodgeCanvas) slots[dodgeOffset + i] = dodgeCanvas;
  }
  return slots;
}

export function areCriticalCombatAssetsReady(
  charId: CharacterId,
  enemyArchetypes: readonly EnemyArchetype[],
): boolean {
  if (!getPreloadedBackdrop()) return false;
  if (!getPreloadedHeroFrames(charId)) return false;
  if (charId === 'kira' && !getPreloadedKiraDodgeFrames()) return false;
  if (charId === 'zuri' && !getPreloadedZuriDroneFrames()) return false;
  for (let i = 0; i < enemyArchetypes.length; i++) {
    const arch = enemyArchetypes[i];
    if (isCrawlerArchetype(arch)) {
      if (!getPreloadedCrawlerFrames(arch)) return false;
    } else if (arch === 'stalker') {
      if (!getPreloadedStalkerFrames()) return false;
    } else if (arch === 'spitter') {
      if (!getPreloadedSpitterFrames()) return false;
    } else if (arch === 'brute') {
      if (!getPreloadedBruteFrames()) return false;
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
  if (arch === 'stalker') return Promise.all([loadSheet(SHEET_SPECS.stalker), loadEnemyPortrait('stalker')]);
  if (arch === 'spitter') return Promise.all([loadSheet(SHEET_SPECS.spitter), loadEnemyPortrait('spitter')]);
  if (arch === 'brute') return Promise.all([loadSheet(SHEET_SPECS.brute), loadEnemyPortrait('brute')]);
  return loadSpriteCutout(GAME_ASSETS.bossPortrait, ENEMY_CUTOUT_OPTIONS);
}

async function runBackgroundTask(taskId: string): Promise<void> {
  if (taskId === 'backdrop') {
    await loadDecodedImage(GAME_ASSETS.arenaBackdrop);
  } else if (taskId === 'char:kira') {
    await Promise.all([loadSheet(SHEET_SPECS.kiraCombat), loadKiraDodgeFrames()]);
  } else if (taskId === 'char:kira_emote') {
    await loadSheet(SHEET_SPECS.kiraEmote);
  } else if (taskId === 'char:auraline') {
    await loadSheet(SHEET_SPECS.auraline);
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

async function runTaskQueue(tasks: string[], epoch: number): Promise<void> {
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
    await yieldTick();
  }
}

export function preloadForTitleScreen(selectedChar: CharacterId): void {
  const epoch = ++activeBgEpoch;

  const titleCritical = Promise.allSettled([
    loadTitleBg(),
    loadTitleLogo(),
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
    const tasks = buildBackgroundTaskOrder(selectedChar);
    void runTaskQueue(tasks, epoch);
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
      ? loadSheet(SHEET_SPECS.auraline)
      : charId === 'zuri'
        ? Promise.all([loadSheet(SHEET_SPECS.zuriCombat), loadSheet(SHEET_SPECS.zuriDrones)])
        : Promise.all([loadSheet(SHEET_SPECS.kiraCombat), loadKiraDodgeFrames()]),
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
