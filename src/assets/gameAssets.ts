import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import titleBgUrl from './images/title_bg_1794552837177.jpg';
import auralineSheetUrl from './sprites/baked/auraline_spritesheet.png';
import bossPortraitUrl from './sprites/baked/boss_portrait.png';
import brutePortraitUrl from './sprites/baked/brute_portrait.png';
import bruteSheetUrl from './sprites/baked/brute_spritesheet.png';
import crawlerSheetUrl from './sprites/baked/crawler_spritesheet.png';
import feralNursePortraitUrl from './sprites/baked/feral_nurse_portrait.png';
import feralNurseSheetAUrl from './sprites/baked/feral_nurse_sheet_a.png';
import feralNurseSheetBUrl from './sprites/baked/feral_nurse_sheet_b.png';
import kiraDodge0Url from './sprites/baked/kira_dodge_0_vault.png';
import kiraDodge1Url from './sprites/baked/kira_dodge_1_slide.png';
import kiraDodge2Url from './sprites/baked/kira_dodge_2_spin.png';
import kiraDodge3Url from './sprites/baked/kira_dodge_3_land.png';
import kiraEmoteSheetUrl from './sprites/baked/kira_emote_sheet.png';
import kiraSheetUrl from './sprites/baked/kira_spritesheet.png';
import mutdogPortraitUrl from './sprites/baked/mutdog_portrait.png';
import mutdogSheetUrl from './sprites/baked/mutdog_spritesheet.png';
import nurseSheetUrl from './sprites/baked/nurse_spritesheet.png';
import spitterPortraitUrl from './sprites/baked/spitter_portrait.png';
import spitterSheetUrl from './sprites/baked/spitter_spritesheet.png';
import stalkerBlinkUrl from './sprites/baked/stalker_blink.png';
import stalkerOpenUrl from './sprites/baked/stalker_open.png';
import titleLogo0Url from './sprites/baked/k0.png';
import titleLogo1Url from './sprites/baked/k1.png';
import titleLogo2Url from './sprites/baked/k2.png';
import titleLogo3Url from './sprites/baked/k3.png';
import titleLogo4Url from './sprites/baked/k4.png';
import titleLockupUrl from './sprites/baked/lockup_plane0.png';
import zuriDronesSheetUrl from './sprites/baked/zuri_drones_sheet.png';
import zuriEmoteSheetUrl from './sprites/baked/zuri_emote_sheet.png';
import zuriSheetUrl from './sprites/baked/zuri_spritesheet.png';
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
  bossPortrait: bossPortraitUrl,
  enemyPortraits: {
    stalker: stalkerOpenUrl,
    spitter: spitterPortraitUrl,
    mutdog: mutdogPortraitUrl,
    feral_nurse: feralNursePortraitUrl,
    brute: brutePortraitUrl,
  } as Partial<Record<EnemyArchetype, string>>,
} as const;
