import type { BestRunRecord, RunState } from './types';

const ACTIVE_RUN_KEY = 'neon_breach_active_run_v2';
const BEST_RECORD_KEY = 'neon_breach_best_record_v1';

export function saveActiveRun(run: RunState): void {
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run));
  } catch {
    // Ignore quota/sandbox storage errors gracefully
  }
}

export function loadActiveRun(): RunState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (
      !parsed ||
      typeof parsed.runId !== 'string' ||
      !parsed.heroine ||
      typeof parsed.heroine.carryCapacity !== 'number' ||
      typeof parsed.heroine.credits !== 'number' ||
      !Array.isArray(parsed.heroine.ownedEquipment) ||
      !Array.isArray(parsed.heroine.equippedInstanceIds) ||
      typeof parsed.heroine.damageBoostPct !== 'number' ||
      !Array.isArray(parsed.mapNodes) ||
      parsed.mapNodes.length !== 11 ||
      !Array.isArray(parsed.masterPool) ||
      !Array.isArray(parsed.clinicChoices) ||
      !Array.isArray(parsed.clinicShopChoices)
    ) {
      return null;
    }
    if (
      parsed.screen === 'combat' &&
      (!parsed.combat || !Array.isArray(parsed.combat.rewardEquipmentChoices))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveRun(): void {
  try {
    localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadBestRecord(): BestRunRecord {
  try {
    const raw = localStorage.getItem(BEST_RECORD_KEY);
    if (!raw) return { bestScore: 0, sectorsCleared: 0, totalRuns: 0 };
    const parsed = JSON.parse(raw) as BestRunRecord;
    return {
      bestScore: parsed.bestScore ?? 0,
      sectorsCleared: parsed.sectorsCleared ?? 0,
      totalRuns: parsed.totalRuns ?? 0,
    };
  } catch {
    return { bestScore: 0, sectorsCleared: 0, totalRuns: 0 };
  }
}

export function recordRunCompletion(score: number, clearedSector: boolean): BestRunRecord {
  const prev = loadBestRecord();
  const next: BestRunRecord = {
    bestScore: Math.max(prev.bestScore, score),
    sectorsCleared: prev.sectorsCleared + (clearedSector ? 1 : 0),
    totalRuns: prev.totalRuns + 1,
  };
  try {
    localStorage.setItem(BEST_RECORD_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}
