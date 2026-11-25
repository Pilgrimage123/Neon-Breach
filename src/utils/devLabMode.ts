import { DEFAULT_DIFFICULTY_TIER } from '../engine/difficulty';
import { createInitialRun } from '../engine/gameEngine';
import type { CharacterId, DifficultyTier, RunState } from '../engine/types';

export type DevLabTabId =
  | 'hero'
  | 'spitter'
  | 'brute'
  | 'mutdog'
  | 'feral_nurse'
  | 'camera';

const VALID_DEV_LAB_TABS = new Set<DevLabTabId>([
  'hero',
  'spitter',
  'brute',
  'mutdog',
  'feral_nurse',
  'camera',
]);

export const DEV_LAB_RUN_PREFIX = 'devlab_';

export function isDevLabsQueryEnabled(search?: string): boolean {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!query) return false;
  return new URLSearchParams(query).get('devLabs') === '1';
}

export function getInitialDevLabTab(search?: string): DevLabTabId | null {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!query) return null;
  const raw = new URLSearchParams(query).get('devLabTab');
  if (raw && VALID_DEV_LAB_TABS.has(raw as DevLabTabId)) {
    return raw as DevLabTabId;
  }
  return null;
}

export function isDevLabRunId(runId?: string | null): boolean {
  return Boolean(runId && runId.startsWith(DEV_LAB_RUN_PREFIX));
}

export function createDevLabSandboxRun(
  characterId: CharacterId = 'kira',
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
  seed = 104729,
): RunState {
  const run = createInitialRun(seed, characterId, difficultyTier, false);
  return {
    ...run,
    runId: `${DEV_LAB_RUN_PREFIX}${seed}_${characterId}_${Date.now()}`,
  };
}
