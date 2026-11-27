import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import auralineSurgeBlastVfxUrl from './images/auraline_surge_blast_vfx.png';
import titleBgUrl from './images/title_bg_1794552837177.jpg';
import auralineSheetAUrl from './sprites/baked/auraline_sheet_a.png';
import auralineSheetBUrl from './sprites/baked/auraline_sheet_b.png';
import bossPortraitUrl from './sprites/baked/boss_portrait.png';
import brutePortraitUrl from './sprites/baked/brute_portrait.png';
import bruteSheetUrl from './sprites/baked/brute_spritesheet.png';
import crawlerSheetUrl from './sprites/baked/crawler_spritesheet.png';
import feralNursePortraitUrl from './sprites/baked/feral_nurse_portrait.png';
import feralNurseSheetAUrl from './sprites/baked/feral_nurse_sheet_a.png';
import feralNurseSheetBUrl from './sprites/baked/feral_nurse_sheet_b.png';
import kiraSheetAUrl from './sprites/baked/kira_sheet_a.png';
import kiraSheetBUrl from './sprites/baked/kira_sheet_b.png';
import matriarchExplodedUrl from './sprites/baked/matriarch_exploded.png';
import matriarchIntactUrl from './sprites/baked/matriarch_intact.png';
import mutdogPortraitUrl from './sprites/baked/mutdog_portrait.png';
import mutdogSheetUrl from './sprites/baked/mutdog_spritesheet.png';
import nurseSheetUrl from './sprites/baked/nurse_spritesheet.png';
import spitterPortraitUrl from './sprites/baked/spitter_portrait.png';
import spitterSheetUrl from './sprites/baked/spitter_spritesheet.png';
import stalkerBlinkUrl from './sprites/baked/stalker_blink.png';
import stalkerOpenUrl from './sprites/baked/stalker_open.png';
import titleLogo0Url from './sprites/baked/k0.png';
import titleLogo1Url from './sprites/baked/k1.png';
import titleLogo1_5Url from './sprites/baked/k1_5.png';
import titleLogo2Url from './sprites/baked/k2.png';
import titleLogo2_3Url from './sprites/baked/k2_3.png';
import titleLogo2_7Url from './sprites/baked/k2_7.png';
import titleLogo3Url from './sprites/baked/k3.png';
import titleLogo3_5Url from './sprites/baked/k3_5.png';
import titleLogo4Url from './sprites/baked/k4.png';
import titleLockupUrl from './sprites/baked/lockup_plane0.png';
import zuriDronesSheetUrl from './sprites/baked/zuri_drones_sheet.png';
import zuriEmoteSheetUrl from './sprites/baked/zuri_emote_sheet.png';
import zuriSheetUrl from './sprites/baked/zuri_spritesheet.png';
import type { EnemyArchetype } from '../engine/types';

const STALKER_FRAME_URLS = [
  stalkerOpenUrl,
  stalkerBlinkUrl,
] as const;

const MATRIARCH_FRAME_URLS = [
  matriarchIntactUrl,
  matriarchExplodedUrl,
] as const;

const TITLE_LOGO_FRAME_URLS = [
  titleLogo0Url,
  titleLogo1Url,
  titleLogo1_5Url,
  titleLogo2Url,
  titleLogo2_3Url,
  titleLogo2_7Url,
  titleLogo3Url,
  titleLogo3_5Url,
  titleLogo4Url,
] as const;

export const GAME_ASSETS = {
  titleBg: titleBgUrl,
  titleLogo: TITLE_LOGO_FRAME_URLS[0],
  titleLogoFrames: TITLE_LOGO_FRAME_URLS,
  titleLockup: titleLockupUrl,
  arenaBackdrop: arenaBackdropUrl,
  kiraSheetA: kiraSheetAUrl,
  kiraSheetB: kiraSheetBUrl,
  auraline: auralineSheetAUrl,
  auralineSheetA: auralineSheetAUrl,
  auralineSheetB: auralineSheetBUrl,
  auralineSurgeBlastVfx: auralineSurgeBlastVfxUrl,
  zuri: zuriSheetUrl,
  zuriEmote: zuriEmoteSheetUrl,
  zuriDrones: zuriDronesSheetUrl,
  nurse: nurseSheetUrl,
  crawlerSheet: crawlerSheetUrl,
  stalkerFrames: STALKER_FRAME_URLS,
  spitterSheet: spitterSheetUrl,
  mutdogSheet: mutdogSheetUrl,
  feralNurseSheetA: feralNurseSheetAUrl,
  feralNurseSheetB: feralNurseSheetBUrl,
  bruteSheet: bruteSheetUrl,
  matriarchFrames: MATRIARCH_FRAME_URLS,
  bossPortrait: bossPortraitUrl,
  enemyPortraits: {
    stalker: stalkerOpenUrl,
    spitter: spitterPortraitUrl,
    mutdog: mutdogPortraitUrl,
    feral_nurse: feralNursePortraitUrl,
    brute: brutePortraitUrl,
    boss: bossPortraitUrl,
  } as Partial<Record<EnemyArchetype, string>>,
} as const;
