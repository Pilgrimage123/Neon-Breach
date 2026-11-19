import type { CharacterId, EnemyArchetype } from '../engine/types';
import { AURELIA_SHEET_FRAMES } from '../utils/aureliaSpriteSheet';
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
} from '../utils/heroineSpriteSheet';
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

export {
  buildBackgroundTaskOrder,
  buildEnemyPreloadOrder,
  NURSE_SHEET_OPTIONS,
  ZURI_DRONES_OPTIONS,
  ZURI_SHEET_OPTIONS,
};

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

const AURELIA_SHEET_OPTIONS: SpriteCutoutOptions = {
  removeBottomFloorShadow: true,
  defringeStrength: 0.78,
};

export const ENEMY_CUTOUT_OPTIONS: SpriteCutoutOptions = {
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

export const STALKER_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
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

export const SPITTER_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
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

export const BRUTE_PORTRAIT_OPTIONS: SpriteCutoutOptions = {
  maxDimension: 512,
};

interface PreloadedEnemyCutout {
  canvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

function yieldTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function getPreloadedTitleBg(): HTMLImageElement | null {
  return getCachedDecodedImage(GAME_ASSETS.titleBg);
}

export const TITLE_LOGO_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 32,
  defringeStrength: 0.82,
  unmixLightGlow: true,
  maxDimension: 960,
};

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

export function getPreloadedPortraitFrame(charId: CharacterId): HTMLCanvasElement | null {
  if (charId === 'aurelia') {
    return getCachedSpriteFrame(
      GAME_ASSETS.aurelia,
      AURELIA_SHEET_FRAMES[0],
      AURELIA_SHEET_OPTIONS,
    );
  }
  if (charId === 'zuri') {
    return getCachedSpriteFrame(
      GAME_ASSETS.zuri,
      ZURI_SHEET_FRAMES[8],
      ZURI_SHEET_OPTIONS,
    );
  }
  return getCachedSpriteFrame(
    GAME_ASSETS.heroine,
    HEROINE_COMBAT_FRAMES[0],
    KIRA_COMBAT_OPTIONS,
  );
}

export function loadPortraitFrame(charId: CharacterId): Promise<HTMLCanvasElement> {
  if (charId === 'aurelia') {
    return loadSpriteFrame(
      GAME_ASSETS.aurelia,
      AURELIA_SHEET_FRAMES[0],
      AURELIA_SHEET_OPTIONS,
    );
  }
  if (charId === 'zuri') {
    return loadSpriteFrame(
      GAME_ASSETS.zuri,
      ZURI_SHEET_FRAMES[8],
      ZURI_SHEET_OPTIONS,
    );
  }
  return loadSpriteFrame(
    GAME_ASSETS.heroine,
    HEROINE_COMBAT_FRAMES[0],
    KIRA_COMBAT_OPTIONS,
  );
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
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.zuriDrones,
    ZURI_DRONE_FRAMES,
    ZURI_DRONES_OPTIONS,
  );
}

export function loadZuriDroneFrames(): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.zuriDrones,
    ZURI_DRONE_FRAMES,
    ZURI_DRONES_OPTIONS,
  );
}

export function getPreloadedKiraDodgeFrames(): HTMLCanvasElement[] | null {
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < GAME_ASSETS.heroineDodge.length; i++) {
    const canvas = getCachedSpriteCutout(GAME_ASSETS.heroineDodge[i], KIRA_DODGE_OPTIONS);
    if (!canvas) return null;
    frames.push(canvas);
  }
  return frames;
}

function loadKiraDodgeFrames(): Promise<HTMLCanvasElement[]> {
  return Promise.all(
    GAME_ASSETS.heroineDodge.map((url) => loadSpriteCutout(url, KIRA_DODGE_OPTIONS)),
  );
}

export function getPreloadedNurseFrames(): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.nurse,
    NURSE_FRAMES,
    NURSE_SHEET_OPTIONS,
  );
}

export function loadNurseFrames(): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.nurse,
    NURSE_FRAMES,
    NURSE_SHEET_OPTIONS,
  );
}

export function getPreloadedStalkerFrames(): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.stalkerSheet,
    STALKER_SHEET_FRAMES,
    STALKER_SHEET_OPTIONS,
  );
}

export function loadStalkerFrames(): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.stalkerSheet,
    STALKER_SHEET_FRAMES,
    STALKER_SHEET_OPTIONS,
  );
}

export function getPreloadedSpitterFrames(): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.spitterSheet,
    SPITTER_SHEET_FRAMES,
    SPITTER_SHEET_OPTIONS,
  );
}

export function loadSpitterFrames(): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.spitterSheet,
    SPITTER_SHEET_FRAMES,
    SPITTER_SHEET_OPTIONS,
  );
}

export function getPreloadedBruteFrames(): HTMLCanvasElement[] | null {
  return getCachedSpriteSheetFrames(
    GAME_ASSETS.bruteSheet,
    BRUTE_SHEET_FRAMES,
    BRUTE_SHEET_OPTIONS,
  );
}

export function loadBruteFrames(): Promise<HTMLCanvasElement[]> {
  return loadSpriteSheetFrames(
    GAME_ASSETS.bruteSheet,
    BRUTE_SHEET_FRAMES,
    BRUTE_SHEET_OPTIONS,
  );
}

export function getPreloadedEnemyPortrait(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (!portraitUrl) return getPreloadedEnemyCutout(arch);
  const opts =
    arch === 'brute'
      ? BRUTE_PORTRAIT_OPTIONS
      : arch === 'spitter'
        ? SPITTER_PORTRAIT_OPTIONS
        : STALKER_PORTRAIT_OPTIONS;
  const canvas = getCachedSpriteCutout(portraitUrl, opts);
  if (!canvas) return null;
  return {
    canvas,
    bounds: measureSpriteBounds(canvas),
  };
}

export function loadEnemyPortrait(arch: EnemyArchetype): Promise<HTMLCanvasElement> {
  const portraitUrl = GAME_ASSETS.enemyPortraits[arch];
  if (portraitUrl) {
    const opts =
      arch === 'brute'
        ? BRUTE_PORTRAIT_OPTIONS
        : arch === 'spitter'
          ? SPITTER_PORTRAIT_OPTIONS
          : STALKER_PORTRAIT_OPTIONS;
    return loadSpriteCutout(portraitUrl, opts);
  }
  if (arch === 'stalker') {
    return loadStalkerFrames().then((frames) => frames[0]);
  }
  if (arch === 'spitter') {
    return loadSpitterFrames().then((frames) => frames[0]);
  }
  if (arch === 'brute') {
    return loadBruteFrames().then((frames) => frames[0]);
  }
  return loadSpriteCutout(GAME_ASSETS.enemies[arch], ENEMY_CUTOUT_OPTIONS);
}

export function getPreloadedEnemyCutout(arch: EnemyArchetype): PreloadedEnemyCutout | null {
  if (isCrawlerArchetype(arch)) {
    const frames = getPreloadedCrawlerFrames(arch);
    if (!frames || !frames[0]) return null;
    return {
      canvas: frames[0],
      bounds: measureSpriteBounds(frames[0]),
    };
  }
  if (arch === 'stalker') {
    const frames = getPreloadedStalkerFrames();
    if (!frames || !frames[0]) return null;
    return {
      canvas: frames[0],
      bounds: measureSpriteBounds(frames[0]),
    };
  }
  if (arch === 'spitter') {
    const frames = getPreloadedSpitterFrames();
    if (!frames || !frames[0]) return null;
    return {
      canvas: frames[0],
      bounds: measureSpriteBounds(frames[0]),
    };
  }
  if (arch === 'brute') {
    const frames = getPreloadedBruteFrames();
    if (!frames || !frames[0]) return null;
    return {
      canvas: frames[0],
      bounds: measureSpriteBounds(frames[0]),
    };
  }
  const canvas = getCachedSpriteCutout(GAME_ASSETS.enemies[arch], ENEMY_CUTOUT_OPTIONS);
  if (!canvas) return null;
  return {
    canvas,
    bounds: measureSpriteBounds(canvas),
  };
}

export function getPreloadedHeroFrames(charId: CharacterId): HTMLCanvasElement[] | null {
  if (charId === 'aurelia') {
    return getCachedSpriteSheetFrames(
      GAME_ASSETS.aurelia,
      AURELIA_SHEET_FRAMES,
      AURELIA_SHEET_OPTIONS,
    );
  }
  if (charId === 'zuri') {
    const combat = getCachedSpriteSheetFrames(
      GAME_ASSETS.zuri,
      ZURI_COMBAT_FRAMES,
      ZURI_SHEET_OPTIONS,
    );
    if (!combat) return null;
    const slots = new Array<HTMLCanvasElement>(ZURI_SHEET_FRAMES.length);
    for (let i = 0; i < combat.length; i++) {
      slots[i] = combat[i];
    }
    const emote = getCachedSpriteSheetFrames(
      GAME_ASSETS.zuriEmote,
      ZURI_EMOTE_FRAMES,
      ZURI_SHEET_OPTIONS,
    );
    if (emote) {
      const offset = ZURI_COMBAT_FRAMES.length;
      for (let i = 0; i < emote.length; i++) {
        slots[offset + i] = emote[i];
      }
    }
    return slots;
  }
  const combat = getCachedSpriteSheetFrames(
    GAME_ASSETS.heroine,
    HEROINE_COMBAT_FRAMES,
    KIRA_COMBAT_OPTIONS,
  );
  if (!combat) return null;
  const slots = new Array<HTMLCanvasElement>(HEROINE_SHEET_FRAMES.length);
  for (let i = 0; i < combat.length; i++) {
    slots[i] = combat[i];
  }
  const emote = getCachedSpriteSheetFrames(
    GAME_ASSETS.heroineEmote,
    HEROINE_EMOTE_FRAMES,
    KIRA_EMOTE_OPTIONS,
  );
  if (emote) {
    const offset = HEROINE_COMBAT_FRAMES.length;
    for (let i = 0; i < emote.length; i++) {
      slots[offset + i] = emote[i];
    }
  }
  const dodgeOffset = HEROINE_COMBAT_FRAMES.length + HEROINE_EMOTE_FRAMES.length;
  for (let i = 0; i < HEROINE_DODGE_FRAMES.length; i++) {
    const url = GAME_ASSETS.heroineDodge[i];
    const dodgeCanvas = url ? getCachedSpriteCutout(url, KIRA_DODGE_OPTIONS) : null;
    if (dodgeCanvas) {
      slots[dodgeOffset + i] = dodgeCanvas;
    }
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

async function runBackgroundTask(taskId: string): Promise<void> {
  if (taskId === 'backdrop') {
    await loadDecodedImage(GAME_ASSETS.arenaBackdrop);
  } else if (taskId === 'char:kira') {
    await Promise.all([
      loadSpriteSheetFrames(
        GAME_ASSETS.heroine,
        HEROINE_COMBAT_FRAMES,
        KIRA_COMBAT_OPTIONS,
      ),
      loadKiraDodgeFrames(),
    ]);
  } else if (taskId === 'char:kira_emote') {
    await loadSpriteSheetFrames(
      GAME_ASSETS.heroineEmote,
      HEROINE_EMOTE_FRAMES,
      KIRA_EMOTE_OPTIONS,
    );
  } else if (taskId === 'char:aurelia') {
    await loadSpriteSheetFrames(
      GAME_ASSETS.aurelia,
      AURELIA_SHEET_FRAMES,
      AURELIA_SHEET_OPTIONS,
    );
  } else if (taskId === 'char:zuri') {
    await loadSpriteSheetFrames(
      GAME_ASSETS.zuri,
      ZURI_COMBAT_FRAMES,
      ZURI_SHEET_OPTIONS,
    );
  } else if (taskId === 'char:zuri_emote') {
    await loadSpriteSheetFrames(
      GAME_ASSETS.zuriEmote,
      ZURI_EMOTE_FRAMES,
      ZURI_SHEET_OPTIONS,
    );
  } else if (taskId === 'char:zuri_drones') {
    await loadZuriDroneFrames();
  } else if (taskId.startsWith('enemy:')) {
    const arch = taskId.slice(6) as EnemyArchetype;
    if (isCrawlerArchetype(arch)) {
      await loadCrawlerVariantFrames(arch);
    } else if (arch === 'stalker') {
      await Promise.all([loadStalkerFrames(), loadEnemyPortrait('stalker')]);
    } else if (arch === 'spitter') {
      await Promise.all([loadSpitterFrames(), loadEnemyPortrait('spitter')]);
    } else if (arch === 'brute') {
      await Promise.all([loadBruteFrames(), loadEnemyPortrait('brute')]);
    } else {
      await loadSpriteCutout(GAME_ASSETS.enemies[arch], ENEMY_CUTOUT_OPTIONS);
    }
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
    loadPortraitFrame('aurelia'),
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
    charId === 'aurelia'
      ? loadSpriteSheetFrames(
          GAME_ASSETS.aurelia,
          AURELIA_SHEET_FRAMES,
          AURELIA_SHEET_OPTIONS,
        )
      : charId === 'zuri'
        ? Promise.all([
            loadSpriteSheetFrames(
              GAME_ASSETS.zuri,
              ZURI_COMBAT_FRAMES,
              ZURI_SHEET_OPTIONS,
            ),
            loadSpriteSheetFrames(
              GAME_ASSETS.zuriEmote,
              ZURI_EMOTE_FRAMES,
              ZURI_SHEET_OPTIONS,
            ),
            loadZuriDroneFrames(),
          ])
        : Promise.all([
            loadSpriteSheetFrames(
              GAME_ASSETS.heroine,
              HEROINE_COMBAT_FRAMES,
              KIRA_COMBAT_OPTIONS,
            ),
            loadKiraDodgeFrames(),
          ]),
  ];

  for (let i = 0; i < critical.length; i++) {
    const arch = critical[i];
    if (isCrawlerArchetype(arch)) {
      criticalPromises.push(loadCrawlerVariantFrames(arch));
    } else if (arch === 'stalker') {
      criticalPromises.push(loadStalkerFrames(), loadEnemyPortrait('stalker'));
    } else if (arch === 'spitter') {
      criticalPromises.push(loadSpitterFrames(), loadEnemyPortrait('spitter'));
    } else if (arch === 'brute') {
      criticalPromises.push(loadBruteFrames(), loadEnemyPortrait('brute'));
    } else {
      criticalPromises.push(loadSpriteCutout(GAME_ASSETS.enemies[arch], ENEMY_CUTOUT_OPTIONS));
    }
  }

  await Promise.allSettled(criticalPromises);
  notifyPreloadListeners();

  if (epoch !== activeBgEpoch) return;

  const bgTasks: string[] = [];
  if (charId === 'kira') {
    bgTasks.push('char:kira_emote');
  }
  for (let i = 0; i < deferred.length; i++) {
    bgTasks.push(`enemy:${deferred[i]}`);
  }
  void runTaskQueue(bgTasks, epoch);
}
