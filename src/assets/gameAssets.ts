import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import brutePortraitUrl from './images/brute_portrait_1794946123759.jpg';
import bruteSheetUrl from './images/brute_spritesheet_1794946123451.jpg';
import feralNurseSheetAUrl from './sprites/feral_nurse_sheet_a.png';
import feralNurseSheetBUrl from './sprites/feral_nurse_sheet_b.png';
import mutantBossUrl from './images/mutant_boss_1794546443418.jpg';
import mutdogSheetUrl from './images/mutdog_spritesheet_1795546121620.jpg';
import spitterPortraitUrl from './images/spitter_portrait_base.jpg';
import spitterSheetUrl from './images/spitter_spritesheet_1794935806587.jpg';
import titleBgUrl from './images/title_bg_1794552837177.jpg';
import auralineSheetUrl from './sprites/auraline_spritesheet.png';
import crawlerSheetUrl from './sprites/crawler_spritesheet.png';
import kiraDodge0Url from './sprites/kira_dodge_0_vault.png';
import kiraDodge1Url from './sprites/kira_dodge_1_slide.png';
import kiraDodge2Url from './sprites/kira_dodge_2_spin.png';
import kiraDodge3Url from './sprites/kira_dodge_3_land.png';
import kiraEmoteSheetUrl from './sprites/kira_emote_sheet.png';
import kiraSheetUrl from './sprites/kira_spritesheet.png';
import nurseSheetUrl from './sprites/nurse_spritesheet.png';
import stalkerBlinkUrl from './sprites/stalker_blink.png';
import stalkerOpenUrl from './sprites/stalker_open.png';
import titleLogo0Url from './sprites/baked/k0.png';
import titleLogo1Url from './sprites/baked/k1.png';
import titleLogo2Url from './sprites/baked/k2.png';
import titleLogo3Url from './sprites/baked/k3.png';
import titleLogo4Url from './sprites/baked/k4.png';
import titleLockupUrl from './sprites/baked/lockup_plane0.png';
import zuriDronesSheetUrl from './sprites/zuri_drones_sheet.png';
import zuriEmoteSheetUrl from './sprites/zuri_emote_sheet.png';
import zuriSheetUrl from './sprites/zuri_spritesheet.png';
import type { EnemyArchetype } from '../engine/types';

const KIRA_DODGE_URLS = [
  kiraDodge0Url,
  kiraDodge1Url,
  kiraDodge2Url,
  kiraDodge3Url,
] as const;

const STALKER_FRAME_URLS = [
  stalkerOpenUrl,
  stalkerBlinkUrl,
] as const;

const TITLE_LOGO_FRAME_URLS = [
  titleLogo0Url,
  titleLogo1Url,
  titleLogo2Url,
  titleLogo3Url,
  titleLogo4Url,
] as const;

export const GAME_ASSETS = {
  titleBg: titleBgUrl,
  titleLogo: TITLE_LOGO_FRAME_URLS[0],
  titleLogoFrames: TITLE_LOGO_FRAME_URLS,
  titleLockup: titleLockupUrl,
  arenaBackdrop: arenaBackdropUrl,
  kira: kiraSheetUrl,
  kiraEmote: kiraEmoteSheetUrl,
  kiraDodge: KIRA_DODGE_URLS,
  auraline: auralineSheetUrl,
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
  bossPortrait: mutantBossUrl,
  enemyPortraits: {
    stalker: stalkerOpenUrl,
    spitter: spitterPortraitUrl,
    mutdog: '/assets/aistudio/image_4e556d8e.png',
    feral_nurse: '/assets/aistudio/file_00000000298081f4baebbac6fb197429_7979309f.png',
    brute: brutePortraitUrl,
  } as Partial<Record<EnemyArchetype, string>>,
} as const;
