import { CYBER_IMPLANT_IDS, ENEMY_TEMPLATES, EQUIPMENT_BY_ID } from './data';
import type { BestRunRecord, CyberImplantId, RunState } from './types';

const ACTIVE_RUN_KEY = 'neon_breach_active_run_v2';
const ENCOUNTER_SNAPSHOT_KEY = 'neon_breach_encounter_start_v1';
const BEST_RECORD_KEY = 'neon_breach_best_record_v1';
const VALID_IMPLANT_SET = new Set<string>(CYBER_IMPLANT_IDS);

const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // fallback
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
  memoryStore.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
  memoryStore.delete(key);
}

export function saveActiveRun(run: RunState): void {
  setStorageItem(ACTIVE_RUN_KEY, JSON.stringify(run));
}

export function parseAndValidateRun(raw: string | null): RunState | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (
      !parsed ||
      typeof parsed.runId !== 'string' ||
      !parsed.heroine ||
      typeof parsed.heroine.hp !== 'number' ||
      typeof parsed.heroine.maxHp !== 'number' ||
      parsed.heroine.maxHp <= 0 ||
      typeof parsed.heroine.shield !== 'number' ||
      typeof parsed.heroine.overdrive !== 'number' ||
      typeof parsed.heroine.carryCapacity !== 'number' ||
      typeof parsed.heroine.credits !== 'number' ||
      !Array.isArray(parsed.heroine.implants) ||
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
      parsed.heroine.characterId !== undefined &&
      parsed.heroine.characterId !== 'kira' &&
      parsed.heroine.characterId !== 'aurelia' &&
      parsed.heroine.characterId !== 'zuri'
    ) {
      return null;
    }
    if (typeof parsed.heroine.nanites !== 'number') {
      parsed.heroine.nanites = 0;
    }
    if (typeof parsed.heroine.consecutiveCombatWithoutClinic !== 'number') {
      parsed.heroine.consecutiveCombatWithoutClinic = 0;
    }
    if (typeof parsed.heroine.emergencyDefibUsed !== 'boolean') {
      parsed.heroine.emergencyDefibUsed = false;
    }
    if (typeof parsed.heroine.overclockCount !== 'number') {
      parsed.heroine.overclockCount = 0;
    }
    if (parsed.activeEvent === undefined) {
      parsed.activeEvent = null;
    }
    parsed.heroine.implants = parsed.heroine.implants.filter((id): id is CyberImplantId =>
      VALID_IMPLANT_SET.has(id),
    );
    parsed.clinicChoices = parsed.clinicChoices.filter((id): id is CyberImplantId =>
      VALID_IMPLANT_SET.has(id),
    );
    parsed.clinicShopChoices = parsed.clinicShopChoices.filter((id) => Boolean(EQUIPMENT_BY_ID[id]));
    if (parsed.screen === 'combat') {
      const c = parsed.combat;
      if (
        !c ||
        !Array.isArray(c.rewardEquipmentChoices) ||
        !Array.isArray(c.board) ||
        !Array.isArray(c.drawPile) ||
        !Array.isArray(c.discardPile) ||
        !Array.isArray(c.enemies) ||
        c.enemies.length === 0
      ) {
        return null;
      }
      for (const enemy of c.enemies) {
        if (
          !enemy ||
          !ENEMY_TEMPLATES[enemy.archetype] ||
          !Array.isArray(enemy.intentCycle) ||
          enemy.intentCycle.length === 0 ||
          typeof enemy.currentIntentIndex !== 'number' ||
          enemy.currentIntentIndex < 0 ||
          enemy.currentIntentIndex >= enemy.intentCycle.length
        ) {
          return null;
        }
        const tpl = ENEMY_TEMPLATES[enemy.archetype];
        if (typeof enemy.shieldPips !== 'number') enemy.shieldPips = tpl.startingShieldPips;
        if (typeof enemy.maxShieldPips !== 'number') enemy.maxShieldPips = tpl.startingShieldPips;
        if (!enemy.passive) enemy.passive = tpl.passive;
        if (!enemy.roleColor) enemy.roleColor = tpl.roleColor;
        if (enemy.phaseGatePct === undefined) enemy.phaseGatePct = tpl.phaseGatePct;
        if (typeof enemy.staggered !== 'boolean') enemy.staggered = false;
        if (typeof enemy.enragedAlone !== 'boolean') enemy.enragedAlone = false;
        if (typeof enemy.turnDamageTaken !== 'number') enemy.turnDamageTaken = 0;
      }
      if (c.director && !Array.isArray(c.director.pendingReinforcements)) {
        c.director.pendingReinforcements = [];
      }
      if (c.director && !Array.isArray(c.director.parCaches)) {
        delete c.director;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadActiveRun(): RunState | null {
  try {
    return parseAndValidateRun(getStorageItem(ACTIVE_RUN_KEY));
  } catch {
    return null;
  }
}

export function clearActiveRun(): void {
  removeStorageItem(ACTIVE_RUN_KEY);
  removeStorageItem(ENCOUNTER_SNAPSHOT_KEY);
}

export function saveEncounterSnapshot(run: RunState | null): void {
  if (!run) {
    removeStorageItem(ENCOUNTER_SNAPSHOT_KEY);
    return;
  }
  setStorageItem(ENCOUNTER_SNAPSHOT_KEY, JSON.stringify(run));
}

export function loadEncounterSnapshot(): RunState | null {
  try {
    return parseAndValidateRun(getStorageItem(ENCOUNTER_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function loadBestRecord(): BestRunRecord {
  try {
    const raw = getStorageItem(BEST_RECORD_KEY);
    if (!raw) return { bestScore: 0, sectorsCleared: 0, totalRuns: 0, totalNanites: 0 };
    const parsed = JSON.parse(raw) as BestRunRecord;
    return {
      bestScore: parsed.bestScore ?? 0,
      sectorsCleared: parsed.sectorsCleared ?? 0,
      totalRuns: parsed.totalRuns ?? 0,
      totalNanites: parsed.totalNanites ?? 0,
    };
  } catch {
    return { bestScore: 0, sectorsCleared: 0, totalRuns: 0, totalNanites: 0 };
  }
}

export function recordRunCompletion(
  score: number,
  clearedSector: boolean,
  nanitesBanked = 0,
): BestRunRecord {
  const prev = loadBestRecord();
  const next: BestRunRecord = {
    bestScore: Math.max(prev.bestScore, score),
    sectorsCleared: prev.sectorsCleared + (clearedSector ? 1 : 0),
    totalRuns: prev.totalRuns + 1,
    totalNanites: (prev.totalNanites ?? 0) + Math.max(0, nanitesBanked),
  };
  setStorageItem(BEST_RECORD_KEY, JSON.stringify(next));
  return next;
}
