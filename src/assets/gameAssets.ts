import arenaBackdropUrl from './images/arena_backdrop_1794552838070.jpg';
import mutantBossUrl from './images/mutant_boss_1794546443418.jpg';
import mutantBruteUrl from './images/mutant_brute_1794554091239.jpg';
import mutantSpitterUrl from './images/mutant_spitter_1794546442524.jpg';
import mutantStalkerUrl from './images/mutant_stalker_1794546443178.jpg';
import titleBgUrl from './images/title_bg_1794552837177.jpg';
import type { EnemyArchetype } from '../engine/types';

export const GAME_ASSETS = {
  titleBg: titleBgUrl,
  arenaBackdrop: arenaBackdropUrl,
  heroine: '/assets/aistudio/image_99454af5.png',
  heroineEmote: '/assets/aistudio/Kyberpunkov__hrdinka__neonov__sprite_animace_4403eebd.png',
  enemies: {
    stalker: mutantStalkerUrl,
    spitter: mutantSpitterUrl,
    brute: mutantBruteUrl,
    boss: mutantBossUrl,
  } as Record<EnemyArchetype, string>,
} as const;
