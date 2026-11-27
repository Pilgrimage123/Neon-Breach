import {
  getPreloadedBackdrop,
  getPreloadedBruteFrames,
  getPreloadedCrawlerFrames,
  getPreloadedEnemyCutout,
  getPreloadedFeralNurseFrames,
  getPreloadedHeroFrames,
  getPreloadedMatriarchFrames,
  getPreloadedMutdogFrames,
  getPreloadedSpitterFrames,
  getPreloadedStalkerFrames,
  getPreloadedZuriDroneFrames,
} from '../../assets/assetPreloader';
import type { CharacterId } from '../../engine/types';
import { AURALINE_SHEET_FRAMES } from '../../utils/auralineSpriteSheet';
import { KIRA_SHEET_FRAMES } from '../../utils/kiraSpriteSheet';
import { ZURI_SHEET_FRAMES } from '../../utils/zuriSpriteSheet';
import type { CombatStageSim } from './combatStageTypes';

export function ensureHeroFrameSlots(
  sim: CombatStageSim,
  id: CharacterId,
): HTMLCanvasElement[] {
  if (!sim.heroFramesByChar[id]) {
    const len =
      id === 'auraline'
        ? AURALINE_SHEET_FRAMES.length
        : id === 'zuri'
          ? ZURI_SHEET_FRAMES.length
          : KIRA_SHEET_FRAMES.length;
    sim.heroFramesByChar[id] = new Array<HTMLCanvasElement>(len);
  }
  return sim.heroFramesByChar[id] as HTMLCanvasElement[];
}

export function hydrateSimFromPreload(sim: CombatStageSim): boolean {
  let addedNewCutout = false;
  const cachedBg = getPreloadedBackdrop();
  if (cachedBg && !sim.backdropImg) {
    sim.backdropImg = cachedBg;
  }
  for (const cid of ['kira', 'auraline', 'zuri'] as const) {
    const cachedFrames = getPreloadedHeroFrames(cid);
    if (cachedFrames) {
      const slots = ensureHeroFrameSlots(sim, cid);
      for (let i = 0; i < cachedFrames.length; i++) {
        if (cachedFrames[i]) slots[i] = cachedFrames[i];
      }
    }
  }
  const cachedDrones = getPreloadedZuriDroneFrames();
  if (cachedDrones) {
    sim.zuriDroneFrames = cachedDrones;
  }
  for (const variant of ['larva', 'skitter', 'stinger'] as const) {
    const cachedCrawler = getPreloadedCrawlerFrames(variant);
    if (cachedCrawler && !sim.crawlerFrames.has(variant)) {
      sim.crawlerFrames.set(variant, cachedCrawler);
    }
  }
  const cachedStalker = getPreloadedStalkerFrames();
  if (cachedStalker && !sim.stalkerFrames) {
    sim.stalkerFrames = cachedStalker;
    addedNewCutout = true;
  }
  const cachedSpitter = getPreloadedSpitterFrames();
  if (cachedSpitter && !sim.spitterFrames) {
    sim.spitterFrames = cachedSpitter;
    addedNewCutout = true;
  }
  const cachedBrute = getPreloadedBruteFrames();
  if (cachedBrute && !sim.bruteFrames) {
    sim.bruteFrames = cachedBrute;
    addedNewCutout = true;
  }
  const cachedMutdog = getPreloadedMutdogFrames();
  if (cachedMutdog && !sim.mutdogFrames) {
    sim.mutdogFrames = cachedMutdog;
    addedNewCutout = true;
  }
  const cachedFeralNurse = getPreloadedFeralNurseFrames();
  if (cachedFeralNurse && !sim.feralNurseFrames) {
    sim.feralNurseFrames = cachedFeralNurse;
    addedNewCutout = true;
  }
  const cachedMatriarch = getPreloadedMatriarchFrames();
  if (cachedMatriarch && !sim.matriarchFrames) {
    sim.matriarchFrames = cachedMatriarch;
    addedNewCutout = true;
  }
  for (const arch of ['stalker', 'spitter', 'mutdog', 'feral_nurse', 'brute', 'boss'] as const) {
    const cachedEnemy = getPreloadedEnemyCutout(arch);
    if (cachedEnemy && !sim.enemyCutouts.has(arch)) {
      sim.enemyCutouts.set(arch, cachedEnemy);
      addedNewCutout = true;
    }
  }
  return addedNewCutout;
}
