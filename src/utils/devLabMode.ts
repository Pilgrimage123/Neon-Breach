import { DEFAULT_DIFFICULTY_TIER } from '../engine/difficulty';
import { createInitialRun, startNodeEncounter } from '../engine/gameEngine';
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

export function isDevBossEncounterRequested(search?: string): boolean {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!query) return false;
  return new URLSearchParams(query).get('devEncounter') === 'boss';
}

export function getDevBossInitialHpRatio(search?: string): number | null {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!query) return null;
  const raw = new URLSearchParams(query).get('devBossHpRatio');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return null;
  return parsed;
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

export function createDevBossSandboxRun(
  characterId: CharacterId = 'kira',
  difficultyTier: DifficultyTier = DEFAULT_DIFFICULTY_TIER,
  seed = 104729,
  initialBossHpRatio: number | null = null,
): RunState {
  const baseRun = createInitialRun(seed, characterId, difficultyTier, false);
  const bossNode = baseRun.mapNodes.find((n) => n.type === 'BOSS');
  const bossRun = bossNode ? startNodeEncounter(baseRun, bossNode.id) : baseRun;
  if (
    bossRun.combat &&
    initialBossHpRatio !== null &&
    Number.isFinite(initialBossHpRatio) &&
    initialBossHpRatio > 0 &&
    initialBossHpRatio <= 1
  ) {
    bossRun.combat = {
      ...bossRun.combat,
      enemies: bossRun.combat.enemies.map((e) =>
        e.archetype === 'boss'
          ? {
              ...e,
              hp: Math.max(1, Math.round(e.maxHp * initialBossHpRatio)),
              armor: 0,
              shieldPips: 0,
            }
          : e,
      ),
    };
  }
  return {
    ...bossRun,
    runId: `${DEV_LAB_RUN_PREFIX}boss_${seed}_${characterId}_${Date.now()}`,
  };
}
