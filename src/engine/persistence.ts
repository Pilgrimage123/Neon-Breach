import {
  CYBER_IMPLANT_IDS,
  ENEMY_TEMPLATES,
  MAX_HEIRLOOM_STACKS,
  SKILL_CHIPS_BY_ID,
} from './data';
import type {
  BestRunRecord,
  CombatPhase,
  CyberImplantId,
  HeroState,
  RunState,
  ScreenPhase,
} from './types';

const ACTIVE_RUN_KEY = 'neon_breach_active_run_v3';
const ENCOUNTER_SNAPSHOT_KEY = 'neon_breach_encounter_start_v2';
const BEST_RECORD_KEY = 'neon_breach_best_record_v2';

const VALID_IMPLANT_SET = new Set<string>(CYBER_IMPLANT_IDS);
const VALID_SCREEN_SET = new Set<ScreenPhase>([
  'title',
  'map',
  'combat',
  'clinic',
  'chip_dealer',
  'medbay',
  'event',
  'victory',
  'gameover',
]);
const VALID_COMBAT_PHASE_SET = new Set<CombatPhase>([
  'PLAYER_IDLE',
  'PLAYER_RESOLVED',
  'ENEMY_ACTING',
  'VICTORY',
  'DEFEAT',
]);

const memoryStore = new Map<string, string>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFiniteNonNegative(value: unknown, fallback = 0): number {
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback to in-memory store only when localStorage is unavailable or throws
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to in-memory store only when localStorage is unavailable or throws
  }
  memoryStore.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // Fallback to in-memory store only when localStorage is unavailable or throws
  }
  memoryStore.delete(key);
}

function defaultBestRecord(): BestRunRecord {
  return {
    bestScore: 0,
    stagesCleared: 0,
    totalRuns: 0,
    totalNanites: 0,
    inheritedHeirloom: null,
  };
}

export function saveActiveRun(run: RunState): void {
  setStorageItem(ACTIVE_RUN_KEY, JSON.stringify(run));
}

const VALID_TILE_TYPE_SET = new Set<string>(['attack', 'defense', 'tech']);

function isValidTileList(tiles: unknown): boolean {
  if (!Array.isArray(tiles)) return false;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i] as { id?: unknown; type?: unknown; value?: unknown } | null | undefined;
    if (
      !t ||
      typeof t.id !== 'string' ||
      t.id.length === 0 ||
      typeof t.type !== 'string' ||
      !VALID_TILE_TYPE_SET.has(t.type) ||
      !isFiniteNumber(t.value)
    ) {
      return false;
    }
  }
  return true;
}

export function parseAndValidateRun(raw: string | null): RunState | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    const hero = parsed?.hero as HeroState | undefined;
    if (
      !parsed ||
      typeof parsed.runId !== 'string' ||
      !isFiniteNumber(parsed.seed) ||
      !VALID_SCREEN_SET.has(parsed.screen) ||
      !isFiniteNumber(parsed.score) ||
      !isFiniteNumber(parsed.turnsCompleted) ||
      !isFiniteNumber(parsed.enemiesDefeated) ||
      !hero ||
      !isFiniteNumber(hero.hp) ||
      !isFiniteNumber(hero.maxHp) ||
      hero.maxHp <= 0 ||
      !isFiniteNumber(hero.shield) ||
      !isFiniteNumber(hero.overdrive) ||
      !isFiniteNumber(hero.corrode) ||
      !isFiniteNumber(hero.memoryCapacity) ||
      hero.memoryCapacity <= 0 ||
      !isFiniteNumber(hero.credits) ||
      !isFiniteNumber(hero.damageBoostPct) ||
      !Array.isArray(hero.implants) ||
      !Array.isArray(hero.ownedChips) ||
      !Array.isArray(hero.equippedInstanceIds) ||
      !Array.isArray(parsed.mapNodes) ||
      (parsed.mapNodes.length !== 11 && parsed.mapNodes.length !== 32) ||
      !isValidTileList(parsed.masterPool) ||
      !Array.isArray(parsed.clinicChoices) ||
      !Array.isArray(parsed.chipDealerChoices)
    ) {
      return null;
    }

    if (
      hero.characterId !== undefined &&
      hero.characterId !== 'kira' &&
      hero.characterId !== 'auraline' &&
      hero.characterId !== 'zuri'
    ) {
      return null;
    }

    const ownedInstanceIds = new Set<string>();
    for (const owned of hero.ownedChips) {
      if (
        !owned ||
        typeof owned.instanceId !== 'string' ||
        owned.instanceId.length === 0 ||
        typeof owned.defId !== 'string' ||
        !SKILL_CHIPS_BY_ID[owned.defId]
      ) {
        return null;
      }
      ownedInstanceIds.add(owned.instanceId);
    }

    // Deduplicate and prune equipped chip IDs that do not correspond to owned chips
    const seenEquipped = new Set<string>();
    hero.equippedInstanceIds = hero.equippedInstanceIds.filter((id): id is string => {
      if (typeof id !== 'string' || !ownedInstanceIds.has(id) || seenEquipped.has(id)) {
        return false;
      }
      seenEquipped.add(id);
      return true;
    });

    // Clamp mutable hero numeric invariants to valid domain bounds
    hero.hp = Math.max(0, Math.min(hero.maxHp, hero.hp));
    hero.overdrive = Math.max(0, Math.min(100, hero.overdrive));
    hero.shield = Math.max(0, hero.shield);
    hero.corrode = Math.max(0, hero.corrode);
    hero.credits = Math.max(0, hero.credits);
    hero.damageBoostPct = Math.max(0, hero.damageBoostPct);

    if (
      parsed.difficultyTier !== undefined &&
      parsed.difficultyTier !== 1 &&
      parsed.difficultyTier !== 2 &&
      parsed.difficultyTier !== 3 &&
      parsed.difficultyTier !== 4 &&
      parsed.difficultyTier !== 5
    ) {
      parsed.difficultyTier = 3;
    }

    if (!isFiniteNumber(parsed.runResetsUsed)) parsed.runResetsUsed = 0;
    if (typeof parsed.chipDealerHeirloomUsed !== 'boolean') parsed.chipDealerHeirloomUsed = false;
    if (typeof parsed.clinicPurgeUsed !== 'boolean') parsed.clinicPurgeUsed = false;
    if (!isFiniteNumber(hero.nanites)) hero.nanites = 0;
    if (!isFiniteNumber(hero.consecutiveCombatWithoutClinic)) {
      hero.consecutiveCombatWithoutClinic = 0;
    }
    if (typeof hero.emergencyDefibUsed !== 'boolean') hero.emergencyDefibUsed = false;
    if (!isFiniteNumber(hero.overclockCount)) hero.overclockCount = 0;
    if (!isFiniteNumber(hero.armor) || hero.armor < 0) hero.armor = 0;
    if (!isFiniteNumber(hero.pendingUpcharge) || hero.pendingUpcharge < 0) hero.pendingUpcharge = 0;
    if (!isFiniteNumber(hero.nextChipInstanceSeq)) {
      hero.nextChipInstanceSeq = hero.ownedChips.length + 1;
    }
    if (!Array.isArray(hero.purgedInnateIds)) hero.purgedInnateIds = [];
    if (!Array.isArray(hero.prodigyTileIds)) hero.prodigyTileIds = [];
    if (!Array.isArray(hero.splicedTilePairs)) hero.splicedTilePairs = [];
    if (!Array.isArray(hero.familyEstates)) hero.familyEstates = [];
    if (!isFiniteNumber(hero.meshReroutesUsed)) hero.meshReroutesUsed = 0;
    if (typeof hero.maglevUsed !== 'boolean') hero.maglevUsed = false;
    if (!isFiniteNumber(hero.heirloomStacks)) {
      hero.heirloomStacks = 0;
    } else {
      hero.heirloomStacks = Math.max(0, Math.min(MAX_HEIRLOOM_STACKS, hero.heirloomStacks));
    }
    if (hero.heirloomEngravedId && !SKILL_CHIPS_BY_ID[hero.heirloomEngravedId]) {
      hero.heirloomEngravedId = null;
      hero.heirloomStacks = 0;
    }
    if (parsed.activeEvent === undefined) {
      parsed.activeEvent = null;
    }

    hero.implants = hero.implants.filter((id): id is CyberImplantId => VALID_IMPLANT_SET.has(id));
    parsed.clinicChoices = parsed.clinicChoices.filter((id): id is CyberImplantId =>
      VALID_IMPLANT_SET.has(id),
    );
    parsed.chipDealerChoices = parsed.chipDealerChoices.filter((id) =>
      Boolean(SKILL_CHIPS_BY_ID[id]),
    );

    if (parsed.screen === 'event') {
      if (
        !parsed.activeEvent ||
        typeof parsed.activeEvent.id !== 'string' ||
        !Array.isArray(parsed.activeEvent.choices) ||
        parsed.activeEvent.choices.length === 0
      ) {
        return null;
      }
    }

    if (parsed.screen === 'combat') {
      const c = parsed.combat;
      if (
        !c ||
        !VALID_COMBAT_PHASE_SET.has(c.phase) ||
        !Number.isInteger(c.turn) ||
        c.turn < 1 ||
        !isFiniteNumber(c.rewardCredits) ||
        c.rewardCredits < 0 ||
        !Array.isArray(c.rewardChipChoices) ||
        !isValidTileList(c.board) ||
        !isValidTileList(c.drawPile) ||
        !isValidTileList(c.discardPile) ||
        !Array.isArray(c.enemies) ||
        c.enemies.length === 0
      ) {
        return null;
      }
      for (const enemy of c.enemies) {
        if (
          !enemy ||
          !ENEMY_TEMPLATES[enemy.archetype] ||
          !isFiniteNumber(enemy.hp) ||
          !isFiniteNumber(enemy.maxHp) ||
          enemy.maxHp <= 0 ||
          !isFiniteNumber(enemy.armor) ||
          !Array.isArray(enemy.intentCycle) ||
          enemy.intentCycle.length === 0 ||
          !Number.isInteger(enemy.currentIntentIndex) ||
          enemy.currentIntentIndex < 0 ||
          enemy.currentIntentIndex >= enemy.intentCycle.length
        ) {
          return null;
        }
        const tpl = ENEMY_TEMPLATES[enemy.archetype];
        if (!isFiniteNumber(enemy.shieldPips)) enemy.shieldPips = tpl.startingShieldPips;
        if (!isFiniteNumber(enemy.maxShieldPips)) enemy.maxShieldPips = tpl.startingShieldPips;
        if (!enemy.passive) enemy.passive = tpl.passive;
        if (!enemy.roleColor) enemy.roleColor = tpl.roleColor;
        if (enemy.phaseGatePct === undefined) enemy.phaseGatePct = tpl.phaseGatePct;
        if (typeof enemy.staggered !== 'boolean') enemy.staggered = false;
        if (typeof enemy.enragedAlone !== 'boolean') enemy.enragedAlone = false;
        if (typeof enemy.weaponBroken !== 'boolean') enemy.weaponBroken = false;
        if (typeof enemy.desperationEnraged !== 'boolean') enemy.desperationEnraged = false;
        if (!isFiniteNumber(enemy.turnDamageTaken)) enemy.turnDamageTaken = 0;
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
    if (!raw) {
      return defaultBestRecord();
    }
    const parsed = JSON.parse(raw) as BestRunRecord;
    if (!parsed || typeof parsed !== 'object') {
      return defaultBestRecord();
    }
    let inheritedHeirloom: BestRunRecord['inheritedHeirloom'] = null;
    if (
      parsed.inheritedHeirloom &&
      typeof parsed.inheritedHeirloom.defId === 'string' &&
      SKILL_CHIPS_BY_ID[parsed.inheritedHeirloom.defId] &&
      isFiniteNumber(parsed.inheritedHeirloom.bonusStacks)
    ) {
      inheritedHeirloom = {
        defId: parsed.inheritedHeirloom.defId,
        bonusStacks: Math.max(
          1,
          Math.min(MAX_HEIRLOOM_STACKS, Math.round(parsed.inheritedHeirloom.bonusStacks)),
        ),
      };
    }
    return {
      bestScore: getFiniteNonNegative(parsed.bestScore, 0),
      stagesCleared: getFiniteNonNegative(parsed.stagesCleared, 0),
      totalRuns: getFiniteNonNegative(parsed.totalRuns, 0),
      totalNanites: getFiniteNonNegative(parsed.totalNanites, 0),
      inheritedHeirloom,
    };
  } catch {
    return defaultBestRecord();
  }
}

export function saveInheritedHeirloom(defId: string, bonusStacks: number): BestRunRecord {
  const prev = loadBestRecord();
  if (!SKILL_CHIPS_BY_ID[defId]) {
    return prev;
  }
  const next: BestRunRecord = {
    ...prev,
    inheritedHeirloom: {
      defId,
      bonusStacks: Math.max(1, Math.min(MAX_HEIRLOOM_STACKS, Math.round(bonusStacks))),
    },
  };
  setStorageItem(BEST_RECORD_KEY, JSON.stringify(next));
  return next;
}

export function recordRunCompletion(
  score: number,
  clearedStage: boolean,
  nanitesBanked = 0,
): BestRunRecord {
  const prev = loadBestRecord();
  const safeScore = getFiniteNonNegative(score, 0);
  const safeNanites = getFiniteNonNegative(nanitesBanked, 0);
  const next: BestRunRecord = {
    bestScore: Math.max(prev.bestScore, safeScore),
    stagesCleared: prev.stagesCleared + (clearedStage ? 1 : 0),
    totalRuns: prev.totalRuns + 1,
    totalNanites: (prev.totalNanites ?? 0) + safeNanites,
    inheritedHeirloom: prev.inheritedHeirloom ?? null,
  };
  setStorageItem(BEST_RECORD_KEY, JSON.stringify(next));
  return next;
}
