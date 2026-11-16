import type { CharacterId, EnemyArchetype } from '../engine/types';

export const ALL_ENEMY_ARCHETYPES: readonly EnemyArchetype[] = [
  'larva',
  'skitter',
  'stinger',
  'stalker',
  'spitter',
  'brute',
  'boss',
];

/**
 * Pure helper returning deduplicated enemy archetypes needed first for an encounter,
 * followed by the remaining enemy archetypes for background warmup.
 */
export function buildEnemyPreloadOrder(
  activeArchetypes: readonly EnemyArchetype[],
): { critical: EnemyArchetype[]; deferred: EnemyArchetype[] } {
  const seen = new Set<EnemyArchetype>();
  const critical: EnemyArchetype[] = [];
  for (let i = 0; i < activeArchetypes.length; i++) {
    const arch = activeArchetypes[i];
    if (!seen.has(arch)) {
      seen.add(arch);
      critical.push(arch);
    }
  }
  const deferred: EnemyArchetype[] = [];
  for (let i = 0; i < ALL_ENEMY_ARCHETYPES.length; i++) {
    const arch = ALL_ENEMY_ARCHETYPES[i];
    if (!seen.has(arch)) {
      deferred.push(arch);
    }
  }
  return { critical, deferred };
}

/**
 * Pure helper returning ordered background tasks for a given selected character.
 */
export function buildBackgroundTaskOrder(selectedChar: CharacterId): string[] {
  if (selectedChar === 'zuri') {
    return [
      'backdrop',
      'char:zuri',
      'char:zuri_drones',
      'enemy:stalker',
      'enemy:larva',
      'enemy:skitter',
      'enemy:stinger',
      'enemy:spitter',
      'enemy:brute',
      'enemy:boss',
      'char:zuri_emote',
      'char:kira',
      'char:aurelia',
      'char:kira_emote',
    ];
  }
  if (selectedChar === 'aurelia') {
    return [
      'backdrop',
      'char:aurelia',
      'enemy:stalker',
      'enemy:larva',
      'enemy:skitter',
      'enemy:stinger',
      'enemy:spitter',
      'enemy:brute',
      'enemy:boss',
      'char:zuri',
      'char:zuri_drones',
      'char:zuri_emote',
      'char:kira',
      'char:kira_emote',
    ];
  }
  return [
    'backdrop',
    'char:kira',
    'enemy:stalker',
    'enemy:larva',
    'enemy:skitter',
    'enemy:stinger',
    'enemy:spitter',
    'enemy:brute',
    'enemy:boss',
    'char:kira_emote',
    'char:aurelia',
    'char:zuri',
    'char:zuri_drones',
    'char:zuri_emote',
  ];
}
