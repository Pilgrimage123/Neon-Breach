import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import brutePortraitUrl from './images/brute_portrait_1794946123759.jpg';
import bruteSheetUrl from './images/brute_spritesheet_1794946123451.jpg';
import mutantBossUrl from './images/mutant_boss_1794546443418.jpg';
import spitterPortraitUrl from './images/spitter_portrait_base.jpg';
import spitterSheetUrl from './images/spitter_spritesheet_1794935806587.jpg';
import stalkerPortraitUrl from './images/stalker_portrait_1794927638770.jpg';
import stalkerSheetUrl from './images/stalker_spritesheet_1794927639433.jpg';
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
import titleLogo0Url from './sprites/title_logo_0.png';
import titleLogo1Url from './sprites/title_logo_1.png';
import titleLogo2Url from './sprites/title_logo_2.png';
import titleLogo3Url from './sprites/title_logo_3.png';
import titleLogo4Url from './sprites/title_logo_4.png';
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
  stalkerSheet: stalkerSheetUrl,
  spitterSheet: spitterSheetUrl,
  bruteSheet: bruteSheetUrl,
  bossPortrait: mutantBossUrl,
  enemyPortraits: {
    stalker: stalkerPortraitUrl,
    spitter: spitterPortraitUrl,
    brute: brutePortraitUrl,
  } as Partial<Record<EnemyArchetype, string>>,
} as const;
