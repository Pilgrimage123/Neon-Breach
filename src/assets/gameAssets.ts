import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import brutePortraitUrl from './images/brute_portrait_1794946123759.jpg';
import bruteSheetUrl from './images/brute_spritesheet_1794946123451.jpg';
import mutantBossUrl from './images/mutant_boss_1794546443418.jpg';
import spitterPortraitUrl from './images/spitter_portrait_base.jpg';
import spitterSheetUrl from './images/spitter_spritesheet_1794935806587.jpg';
import stalkerPortraitUrl from './images/stalker_portrait_1794927638770.jpg';
import stalkerSheetUrl from './images/stalker_spritesheet_1794927639433.jpg';
import titleBgUrl from './images/title_bg_1794552837177.jpg';
import type { EnemyArchetype } from '../engine/types';

export const CRAWLER_SPRITE_SHEET_URL =
  '/assets/aistudio/file_00000000555081f4a41ab1db158670ae_c3123f19.png';

export const ZURI_SPRITE_SHEET_URL =
  '/assets/aistudio/file_00000000f04881f49d73836af6b8d92c_241629e2.png';
export const ZURI_EMOTE_SHEET_URL =
  '/assets/aistudio/file_0000000066b481f4872cbfdb772b420c_e72e7df0.png';
export const ZURI_DRONES_SHEET_URL =
  '/assets/aistudio/file_00000000257c82439c937d2ab04e8624_1e67a010.png';
export const NURSE_SPRITE_SHEET_URL =
  '/assets/aistudio/image_d7235730.png';

export const HEROINE_DODGE_URLS = [
  '/assets/aistudio/Kyberpunkov__akrobatka_v_neonov_m_vzletu_536da17e.png',
  '/assets/aistudio/Kyberpunkov__skluzavka_s_n_pisem_MISS_6b70b5b2.png',
  '/assets/aistudio/Kyberpunkov__tane_nice_s_neonov_mi_akcenty_b7bd6a64.png',
  '/assets/aistudio/Neonov__kyberpunkov__p_ist_vac__p_za_9eb78846.png',
] as const;

export const TITLE_LOGO_FRAME_URLS = [
  '/assets/aistudio/Neon_Breach__Z__iv__o_i_mutantky_e73032c9.png',
  '/assets/aistudio/Neonov__ko_i___kyberpunkov__hrdinka_11d2aafc.png',
  '/assets/aistudio/Neonov__kyberpunkov__dvojice_mutantky_c41a2fcd.png',
  '/assets/aistudio/Neon_polibek_proti_xenomutantovi_a842b0d3.png',
  '/assets/aistudio/Neonov__chaos__Xeno-breach_protokol_cac953eb.png',
] as const;

export const GAME_ASSETS = {
  titleBg: titleBgUrl,
  titleLogo: TITLE_LOGO_FRAME_URLS[0],
  titleLogoFrames: TITLE_LOGO_FRAME_URLS,
  arenaBackdrop: arenaBackdropUrl,
  heroine: '/assets/aistudio/image_99454af5.png',
  heroineEmote: '/assets/aistudio/Kyberpunkov__hrdinka__neonov__sprite_animace_4403eebd.png',
  heroineDodge: HEROINE_DODGE_URLS,
  aurelia: '/assets/aistudio/aurelia_sprite_sheet.png',
  zuri: ZURI_SPRITE_SHEET_URL,
  zuriEmote: ZURI_EMOTE_SHEET_URL,
  zuriDrones: ZURI_DRONES_SHEET_URL,
  nurse: NURSE_SPRITE_SHEET_URL,
  crawlerSheet: CRAWLER_SPRITE_SHEET_URL,
  stalkerSheet: stalkerSheetUrl,
  spitterSheet: spitterSheetUrl,
  bruteSheet: bruteSheetUrl,
  enemyPortraits: {
    stalker: stalkerPortraitUrl,
    spitter: spitterPortraitUrl,
    brute: brutePortraitUrl,
  } as Partial<Record<EnemyArchetype, string>>,
  enemies: {
    larva: CRAWLER_SPRITE_SHEET_URL,
    skitter: CRAWLER_SPRITE_SHEET_URL,
    stinger: CRAWLER_SPRITE_SHEET_URL,
    stalker: stalkerPortraitUrl,
    spitter: spitterPortraitUrl,
    brute: brutePortraitUrl,
    boss: mutantBossUrl,
  } as Record<EnemyArchetype, string>,
} as const;
