import {
  BOARD_CAPACITY,
  CLINIC_PURGE_COST,
  CLINIC_RESTOCK_COST,
  CYBER_IMPLANT_IDS,
  DROPPABLE_EQUIPMENT_IDS,
  ENEMY_TEMPLATES,
  EQUIPMENT_BY_ID,
  MAX_IMPLANTS,
  MAX_OVERCLOCK_STACKS,
  MAX_UPCHARGE_BOARD_CAPACITY,
  buildEnemiesForNode,
  createBlightTile,
  createPropUnit,
  createStartingEquipment,
  getEquippedEquipmentWeight,
  getHeroSpec,
  rebuildMasterPool,
} from './data';
import { getDifficultyProfile, getStageSecondaryTurnTarget } from './difficulty';
import { generateSectorMap } from './mapGenerator';
import { DYNASTY_EVENT_TEMPLATES, CYBER_EVENT_TEMPLATES, getCyberEventForNode } from './cyberEvents';
import { loadBestRecord, saveInheritedHeirloom } from './persistence';
import {
  advanceDirectorAtRoundEnd,
  computeVictoryDirectorRewards,
  createCombatDirector,
  getEffectiveEnemyIntentValue,
  isIntentConditionMet,
  updateDirectorAfterPlayerAction,
} from './reinforcementDirector';
import type {
  AnimationCue,
  CharacterId,
  CombatState,
  CyberImplantId,
  DifficultyTier,
  EnemyUnit,
  HeroineState,
  HeroineThreatPreview,
  MapNode,
  NannyBotId,
  OwnedEquipment,
  RunState,
  ScreenPhase,
  Tile,
  TileType,
  TurnPreview,
} from './types';

function markNodeCleared(mapNodes: MapNode[], nodeId: string | null): MapNode[] {
  if (!nodeId) return mapNodes;
  return mapNodes.map((n) => (n.id === nodeId ? { ...n, cleared: true } : n));
}

export function advanceNodeDynastyProgress(heroine: HeroineState): HeroineState {
  let nextHeroine = { ...heroine };

  // Ectogenesis Stork Nursery: count down 3 nodes and return as Next-Gen with 2x base stats + inherited trait
  if (nextHeroine.incubatingTile && nextHeroine.incubatingTile.nodesRemaining > 0) {
    const rem = nextHeroine.incubatingTile.nodesRemaining - 1;
    if (rem <= 0) {
      const maturedTileId = nextHeroine.incubatingTile.tile.id;
      const trait = nextHeroine.incubatingTile.inheritedTrait;
      nextHeroine = {
        ...nextHeroine,
        incubatingTile: null,
        maturedNextGenTiles: {
          ...(nextHeroine.maturedNextGenTiles ?? {}),
          [maturedTileId]: {
            bonusMultiplier: 2,
            inheritedTrait: trait,
          },
        },
      };
    } else {
      nextHeroine = {
        ...nextHeroine,
        incubatingTile: {
          ...nextHeroine.incubatingTile,
          nodesRemaining: rem,
        },
      };
    }
  }

  // Synth-Rave / Kids Vitality / Mutual Aid Vow countdown
  if (nextHeroine.activeTempoRule && nextHeroine.activeTempoRule.nodesRemaining > 0) {
    const rem = nextHeroine.activeTempoRule.nodesRemaining - 1;
    nextHeroine = {
      ...nextHeroine,
      activeTempoRule:
        rem <= 0
          ? null
          : {
              ...nextHeroine.activeTempoRule,
              nodesRemaining: rem,
            },
    };
  }

  return nextHeroine;
}

function applyBioSiphonHeal(heroine: HeroineState, defeatedNow: number): void {
  if (defeatedNow > 0 && hasImplant(heroine.implants, 'bio_siphon')) {
    heroine.hp = Math.min(heroine.maxHp, heroine.hp + defeatedNow * 4);
  }
}

function computeCombatNaniteReward(
  combat: Pick<CombatState, 'nodeId' | 'nodeType'>,
  mapNodes: readonly MapNode[],
): number {
  const node = mapNodes.find((n) => n.id === combat.nodeId);
  let naniteReward = 0;
  if (combat.nodeType === 'ELITE') {
    naniteReward += 2;
  } else if (combat.nodeType === 'BOSS') {
    naniteReward += 5;
  }
  if (node?.modifier === 'nanite_cache') {
    naniteReward += 2;
  }
  if (node?.modifier === 'overcharged_hazard') {
    naniteReward += 1;
  }
  return naniteReward;
}

function resolveCombatVictoryTransition(
  run: RunState,
  combat: CombatState,
  heroine: HeroineState,
): {
  screen: ScreenPhase;
  mapNodes: MapNode[];
  heroine: HeroineState;
  combat: CombatState;
} {
  const tier = run.difficultyTier ?? 3;
  const diff = getDifficultyProfile(tier);
  let nextCombat = combat;
  let nextHeroine = heroine;

  if (diff.mandatoryBonusObjective && !combat.mandateBreachLootConfiscated) {
    const turnTarget = getStageSecondaryTurnTarget(combat.nodeType, tier);
    const startingHp = combat.startingHeroHp ?? heroine.hp;
    const hpLost = Math.max(0, startingHp - heroine.hp);
    const mandateMet = combat.turn <= turnTarget || hpLost === 0;
    if (!mandateMet) {
      const penaltyHp = 12;
      const breachedHp = Math.max(0, heroine.hp - penaltyHp);
      nextCombat = {
        ...combat,
        rewardCredits: 0,
        rewardEquipmentChoices: [],
        mandateBreachPenaltyHp: penaltyHp,
        mandateBreachLootConfiscated: true,
        phase: breachedHp <= 0 ? 'DEFEAT' : combat.phase,
      };
      nextHeroine = {
        ...heroine,
        hp: breachedHp,
      };
      if (breachedHp <= 0) {
        return {
          screen: 'gameover',
          mapNodes: run.mapNodes,
          heroine: nextHeroine,
          combat: nextCombat,
        };
      }
    }
  }

  if (nextCombat.nodeType === 'BOSS') {
    const bossNanites = computeCombatNaniteReward(nextCombat, run.mapNodes);
    let bossHeroine: HeroineState = {
      ...nextHeroine,
      credits: nextHeroine.credits + nextCombat.rewardCredits,
      nanites: (nextHeroine.nanites ?? 0) + bossNanites,
    };
    if (bossHeroine.heirloomEngravedId) {
      const engravedId = bossHeroine.heirloomEngravedId;
      const nextStacks = (bossHeroine.heirloomStacks ?? 0) + 1;
      bossHeroine = { ...bossHeroine, heirloomStacks: nextStacks };
      saveInheritedHeirloom(engravedId, Math.max(1, Math.ceil(nextStacks / 2)));
    }
    return {
      screen: 'victory',
      mapNodes: markNodeCleared(run.mapNodes, nextCombat.nodeId),
      heroine: bossHeroine,
      combat: nextCombat,
    };
  }
  return {
    screen: run.screen,
    mapNodes: run.mapNodes,
    heroine: nextHeroine,
    combat: nextCombat,
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const copy = items.slice();
  const rng = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function hasImplant(implants: CyberImplantId[], id: CyberImplantId): boolean {
  return implants.includes(id);
}

export function getSurgeThreshold(implants: CyberImplantId[]): number {
  return hasImplant(implants, 'surge_resonator') ? 3 : 4;
}

export function canModifyEquipment(run: RunState): boolean {
  return run.screen !== 'combat';
}

function absorbHeroDamage(
  shield: number,
  armor: number,
  incoming: number,
): {
  nextShield: number;
  nextArmor: number;
  blockedByShield: number;
  blockedByArmor: number;
  hpDamage: number;
} {
  const safeIncoming = Math.max(0, incoming);
  const blockedByShield = Math.min(Math.max(0, shield), safeIncoming);
  const afterShield = safeIncoming - blockedByShield;
  const blockedByArmor = Math.min(Math.max(0, armor), afterShield);
  const hpDamage = afterShield - blockedByArmor;
  return {
    nextShield: Math.max(0, shield - blockedByShield),
    nextArmor: Math.max(0, armor - blockedByArmor),
    blockedByShield,
    blockedByArmor,
    hpDamage,
  };
}

export function drawToSix(
  board: Tile[],
  drawPile: Tile[],
  discardPile: Tile[],
  seed: number,
  turn: number,
  targetCapacity = BOARD_CAPACITY,
): { board: Tile[]; drawPile: Tile[]; discardPile: Tile[] } {
  const nextBoard = board.map((tile) => ({ ...tile }));
  let nextDraw = drawPile.map((tile) => ({ ...tile }));
  let nextDiscard = discardPile.map((tile) => ({ ...tile }));

  const clampedTarget = Math.min(
    MAX_UPCHARGE_BOARD_CAPACITY,
    Math.max(BOARD_CAPACITY, targetCapacity),
  );
  const needed = Math.max(0, clampedTarget - nextBoard.length);
  for (let i = 0; i < needed; i++) {
    if (nextDraw.length === 0) {
      if (nextDiscard.length === 0) break;
      const recycled = nextDiscard.map((t) => ({ ...t, isHeldFromPrevTurn: false }));
      nextDraw = deterministicShuffle(recycled, seed + turn * 97 + i);
      nextDiscard = [];
    }
    const drawn = nextDraw.shift();
    if (drawn) {
      nextBoard.push({ ...drawn, isHeldFromPrevTurn: false });
    }
  }

  return {
    board: nextBoard,
    drawPile: nextDraw,
    discardPile: nextDiscard,
  };
}

const TILE_TYPE_ORDER: Record<TileType, number> = {
  attack: 0,
  defense: 1,
  tech: 2,
};

export function sortTilesByGroup(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => {
    const typeDiff = TILE_TYPE_ORDER[a.type] - TILE_TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    if (a.isHeldFromPrevTurn !== b.isHeldFromPrevTurn) {
      return a.isHeldFromPrevTurn ? -1 : 1;
    }
    if (a.value !== b.value) return b.value - a.value;
    return a.id.localeCompare(b.id);
  });
}

export function getEffectiveTileValue(
  tile: Pick<Tile, 'type' | 'value' | 'isHeldFromPrevTurn' | 'isBlight'>,
  heroine: Pick<HeroineState, 'characterId' | 'implants' | 'bloodlineCrest'>,
  bloodlineResonanceActive?: TileType | null,
): { value: number; flatBonus: number } {
  if (tile.isBlight) {
    return { value: 0, flatBonus: 0 };
  }
  const heroSpec = getHeroSpec(heroine.characterId);
  const implants = heroine.implants;
  let flatBonus = 0;

  if (tile.type === 'attack') {
    if (tile.isHeldFromPrevTurn && heroSpec.heldTileBonus > 0) {
      flatBonus += heroSpec.heldTileBonus;
    }
    if (hasImplant(implants, 'plasma_amp')) flatBonus += 2;
    if (hasImplant(implants, 'monowire_edge') && tile.isHeldFromPrevTurn) flatBonus += 2;
  } else if (tile.type === 'defense') {
    if (tile.isHeldFromPrevTurn && heroSpec.heldTileBonus > 0) {
      flatBonus += heroSpec.heldTileBonus;
    }
    if (hasImplant(implants, 'nano_weave')) flatBonus += 2;
  }

  if (
    heroine.bloodlineCrest &&
    bloodlineResonanceActive &&
    tile.type === bloodlineResonanceActive &&
    (tile.type === 'attack' || tile.type === 'defense')
  ) {
    flatBonus += heroine.bloodlineCrest.bonusValue;
  }

  return {
    value: tile.value + flatBonus,
    flatBonus,
  };
}

export function previewColorResolution(run: RunState, color: TileType): TurnPreview {
  const combat = run.combat;
  const implants = run.heroine.implants;
  const heroSpec = getHeroSpec(run.heroine.characterId);
  const surgeThreshold = getSurgeThreshold(implants);
  const damageBoostPct = run.heroine.damageBoostPct;

  const emptyPreview: TurnPreview = {
    color,
    tileCount: 0,
    stayCount: combat ? combat.board.length : 0,
    baseDamage: 0,
    damageBoostPct,
    totalDamage: 0,
    cleaveDamage: 0,
    armorPiercing: color === 'attack' && hasImplant(implants, 'piercing_katana'),
    shieldGained: 0,
    damageBoostAddedPct: 0,
    healAmount: 0,
    overdriveGained: 0,
    surgeTriggered: false,
    surgeThreshold,
    reflectOnBlock: 0,
    armorShredAmount: 0,
    techPierceDamage: 0,
    cleanseCorrodeAmount: 0,
    retaliateDamage: 0,
    pustuleRuptureCorrode: 0,
    upchargeGained: 0,
    dudCount: 0,
  };

  if (!combat) {
    return emptyPreview;
  }

  const matching = combat.board.filter((t) => t.type === color && !t.isJammed);
  const cleanMatching = matching.filter((t) => !t.isBlight);
  const blightPurgeCount = color === 'tech' ? matching.filter((t) => t.isBlight).length : 0;

  // Positional Contagion: resolving a tile with isContagion also discards adjacent non-matching board slots (idx - 1, idx + 1)
  const contagionDiscardIdxSet = new Set<number>();
  combat.board.forEach((tile, idx) => {
    if (tile.type === color && !tile.isJammed && tile.isContagion) {
      for (const adjIdx of [idx - 1, idx + 1]) {
        const adj = combat.board[adjIdx];
        if (adj && (adj.type !== color || adj.isJammed)) {
          contagionDiscardIdxSet.add(adjIdx);
        }
      }
    }
  });
  const contagionDiscardedCount = contagionDiscardIdxSet.size;
  const hotPotatoPassedDamage =
    matching.filter((t) => Boolean(t.isHotPotato)).length * HOT_POTATO_PASS_DAMAGE;
  const temptationCleaveBonus =
    matching.filter((t) => Boolean(t.isTemptation)).length * TEMPTATION_CLEAVE_BONUS;

  const stayCount = Math.max(0, combat.board.length - matching.length - contagionDiscardedCount);
  const surgeTriggered = cleanMatching.length >= surgeThreshold;
  const dudCount = cleanMatching.filter((t) => Boolean(t.isDud)).length;
  const isBloodlineResonant =
    Boolean(run.heroine.bloodlineCrest) && combat.bloodlineResonanceActive === color;
  const upchargeGained =
    cleanMatching.reduce((sum, t) => sum + (t.upcharge ?? 0), 0) +
    dudCount * heroSpec.dudUpchargePerTile +
    (isBloodlineResonant && cleanMatching.length > 0 ? 1 : 0);

  const activeHexCasterIds = new Set<string>();
  for (const tile of matching) {
    if (!tile.hexedByEnemyId) continue;
    const caster = combat.enemies.find((e) => e.id === tile.hexedByEnemyId && e.hp > 0);
    if (caster) activeHexCasterIds.add(caster.id);
  }

  if (matching.length === 0) {
    return {
      ...emptyPreview,
      stayCount,
    };
  }

  const withSurvivingHexBonuses = (preview: TurnPreview): TurnPreview => {
    const enriched: TurnPreview = {
      ...preview,
      hotPotatoPassedDamage,
      contagionDiscardedCount,
      temptationCleaveBonus,
    };
    if (activeHexCasterIds.size === 0) {
      return { ...enriched, hexedHealBonus: 0, hexedArmorBonus: 0 };
    }
    const sim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, enriched);
    let survivingCasters = 0;
    for (const casterId of activeHexCasterIds) {
      if (sim.enemies.some((e) => e.id === casterId && e.hp > 0)) {
        survivingCasters++;
      }
    }
    return {
      ...enriched,
      hexedHealBonus: survivingCasters * HEX_HEAL_AMOUNT,
      hexedArmorBonus: survivingCasters * HEX_ARMOR_AMOUNT,
    };
  };

  if (color === 'attack') {
    let baseDamage = 0;
    let hybridShieldBonus = 0;
    let hybridBoostPct = 0;
    for (const tile of cleanMatching) {
      baseDamage += getEffectiveTileValue(
        tile,
        run.heroine,
        combat.bloodlineResonanceActive,
      ).value;
      if (tile.secondaryType === 'defense' && (tile.secondaryValue ?? 0) > 0) {
        hybridShieldBonus += tile.secondaryValue ?? 0;
      } else if (tile.secondaryType === 'tech') {
        hybridBoostPct += 10;
      }
    }
    if (run.heroine.scionAlliedHouse === 'house_solaris' && cleanMatching.length > 0) {
      baseDamage += 2;
    }
    const rawTotal = Math.floor(baseDamage * (1 + damageBoostPct / 100));
    const totalDamage =
      combat.battlefieldRule === 'volatile_atmosphere' && rawTotal > 0
        ? Math.round(rawTotal * 1.25)
        : rawTotal;
    const cleaveDamage = surgeTriggered ? Math.floor(totalDamage * 0.5) : 0;
    const armorPiercing = hasImplant(implants, 'piercing_katana');
    const retaliateDamage = (() => {
      if (surgeTriggered) return 0;
      const front = combat.enemies.find((e) => e.hp > 0 && !e.escaped);
      if (!front || front.passive !== 'spike_retaliate') return 0;
      const simHit = applyDamageToEnemy(front, totalDamage, armorPiercing ? 0.3 : 0, false);
      return simHit.defeated ? 0 : 3;
    })();
    const pustuleRuptureCorrode = (() => {
      if (surgeTriggered || totalDamage <= 0) return 0;
      const front = combat.enemies.find((e) => e.hp > 0 && !e.escaped);
      if (!front || front.passive !== 'acid_jam' || front.propKind) return 0;
      const simHit = applyDamageToEnemy(front, totalDamage, armorPiercing ? 0.3 : 0, false);
      return simHit.defeated ? 0 : PUSTULE_RUPTURE_CORRODE;
    })();
    return withSurvivingHexBonuses({
      color,
      tileCount: matching.length,
      stayCount,
      baseDamage,
      damageBoostPct,
      totalDamage,
      cleaveDamage,
      armorPiercing,
      shieldGained: hybridShieldBonus,
      damageBoostAddedPct: hybridBoostPct,
      healAmount: 0,
      overdriveGained: cleanMatching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: 0,
      armorShredAmount: 0,
      techPierceDamage: 0,
      cleanseCorrodeAmount: 0,
      retaliateDamage,
      pustuleRuptureCorrode,
      blightPurgeCount,
      upchargeGained,
      dudCount,
    });
  }

  if (color === 'defense') {
    let rawShield = 0;
    let hybridPierceDamage = 0;
    let hybridBoostPct = 0;
    for (const tile of cleanMatching) {
      rawShield += getEffectiveTileValue(
        tile,
        run.heroine,
        combat.bloodlineResonanceActive,
      ).value;
      if (tile.secondaryType === 'attack' && (tile.secondaryValue ?? 0) > 0) {
        hybridPierceDamage += tile.secondaryValue ?? 0;
      } else if (tile.secondaryType === 'tech') {
        hybridBoostPct += 10;
      }
    }
    if (run.heroine.scionAlliedHouse === 'house_valkyr' && cleanMatching.length > 0) {
      rawShield += 3;
    }
    const magneticBonus =
      combat.battlefieldRule === 'magnetic_surge' && cleanMatching.length > 0 ? 2 : 0;
    const shieldGained = Math.max(0, rawShield - run.heroine.corrode) + magneticBonus;
    const riposteDamage = cleanMatching.length * heroSpec.defenseRipostePerTile;
    const surgeReflect = surgeTriggered ? 8 : 0;
    return withSurvivingHexBonuses({
      color,
      tileCount: matching.length,
      stayCount,
      baseDamage: 0,
      damageBoostPct,
      totalDamage: 0,
      cleaveDamage: 0,
      armorPiercing: false,
      shieldGained,
      damageBoostAddedPct: hybridBoostPct,
      healAmount: 0,
      overdriveGained: cleanMatching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: riposteDamage + surgeReflect,
      armorShredAmount: 0,
      techPierceDamage: hybridPierceDamage,
      cleanseCorrodeAmount: 0,
      retaliateDamage: 0,
      blightPurgeCount,
      upchargeGained,
      dudCount,
    });
  }

  // TECH
  let damageBoostAddedPct = isBloodlineResonant && cleanMatching.length > 0 ? 15 : 0;
  let healAmount = 0;
  let armorShredAmount = 0;
  let techPierceDamage = 0;
  let bonusOverdrive = 0;
  let cleanseCorrodeAmount = 0;
  let techShieldFromTiles = 0;

  for (const tile of cleanMatching) {
    const eff = tile.techEffect;
    if (!eff) continue;
    if (eff.kind === 'damage_boost') {
      damageBoostAddedPct += eff.percent;
    } else if (eff.kind === 'heal') {
      healAmount += eff.amount;
    } else if (eff.kind === 'armor_shred') {
      armorShredAmount += eff.shredAmount;
      techPierceDamage += eff.pierceDamage;
    } else if (eff.kind === 'overdrive_surge') {
      bonusOverdrive += eff.bonusOverdrive;
      cleanseCorrodeAmount += eff.cleanseCorrode;
    } else if (eff.kind === 'tactical_shield') {
      techShieldFromTiles += eff.shieldAmount;
      damageBoostAddedPct += eff.damageBoostPct;
    }
  }

  let overdriveGained = cleanMatching.length * heroSpec.techOverdrivePerTile + bonusOverdrive;
  if (cleanMatching.length > 0 && hasImplant(implants, 'flux_injector')) {
    overdriveGained += 10;
  }
  if (surgeTriggered) {
    overdriveGained += 15;
  }

  const synapseShield = hasImplant(implants, 'synapse_overclock') ? cleanMatching.length * 3 : 0;
  const surgeShield = surgeTriggered ? 6 : 0;

  return withSurvivingHexBonuses({
    color,
    tileCount: matching.length,
    stayCount,
    baseDamage: 0,
    damageBoostPct,
    totalDamage: 0,
    cleaveDamage: 0,
    armorPiercing: false,
    shieldGained: synapseShield + surgeShield + techShieldFromTiles,
    damageBoostAddedPct,
    healAmount,
    overdriveGained,
    surgeTriggered,
    surgeThreshold,
    reflectOnBlock: 0,
    armorShredAmount,
    techPierceDamage,
    cleanseCorrodeAmount,
    retaliateDamage: 0,
    blightPurgeCount,
    upchargeGained,
    dudCount,
  });
}

export const VOLATILE_BURST_DAMAGE = 6;
export const PLASMA_BARREL_BURST_DAMAGE = 10;
export const SPIKE_RETALIATE_DAMAGE = 3;
export const PUSTULE_RUPTURE_CORRODE = 2;
export const STAGGER_BURST_THRESHOLD = 16;
export const WEAPON_BREAK_THRESHOLD = 22;
export const HOT_POTATO_PASS_DAMAGE = 8;
export const HOT_POTATO_SELF_DAMAGE = 6;
export const TEMPTATION_CLEAVE_BONUS = 14;
export const MERCY_REWARD_HP = 6;
export const MERCY_REWARD_CREDITS = 15;
export const TUG_OF_WAR_PURGE_OD_BONUS = 25;
export const TUG_OF_WAR_PURGE_CR_BONUS = 10;
export const BLIGHT_HOLD_CHIP_DAMAGE = 2;
export const HEX_HEAL_AMOUNT = 4;
export const HEX_ARMOR_AMOUNT = 3;
export const MAX_ACTIVE_BLIGHT_TILES = 2;
export const PHASE_GATE_ARMOR_BONUS = 10;

export function hasHostileLivingEnemies(enemies: readonly EnemyUnit[]): boolean {
  return enemies.some(
    (e) => e.hp > 0 && !e.escaped && !e.isMercyTarget && !e.propKind,
  );
}

function isDamagingIntent(intent: EnemyUnit['intentCycle'][number] | undefined): boolean {
  if (!intent) return false;
  return (
    intent.kind === 'attack' ||
    intent.kind === 'heavy' ||
    intent.kind === 'acid' ||
    intent.kind === 'leech'
  );
}

function clearDeadCasterHexes(board: Tile[], enemies: readonly EnemyUnit[]): Tile[] {
  const livingIds = new Set(enemies.filter((e) => e.hp > 0 && !e.escaped).map((e) => e.id));
  return board.map((tile) =>
    tile.hexedByEnemyId && !livingIds.has(tile.hexedByEnemyId)
      ? { ...tile, hexedByEnemyId: undefined }
      : tile,
  );
}

function countTotalBlightTiles(combat: Pick<CombatState, 'board' | 'drawPile' | 'discardPile'>): number {
  let total = 0;
  for (const t of combat.board) if (t.isBlight) total++;
  for (const t of combat.drawPile) if (t.isBlight) total++;
  for (const t of combat.discardPile) if (t.isBlight) total++;
  return total;
}

export function evaluateReactiveEnemyShifts(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
  turn: number,
  cues?: AnimationCue[],
): EnemyUnit[] {
  const livingBeforeCount = enemiesBefore.filter(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget,
  ).length;
  const livingAfterCount = enemiesAfter.filter(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget,
  ).length;
  const becameLoneSurvivor = livingBeforeCount >= 2 && livingAfterCount === 1;

  return enemiesAfter.map((after) => {
    if (after.hp <= 0 || after.escaped) {
      return { ...after, staggered: false };
    }
    const before = enemiesBefore.find((b) => b.id === after.id);
    const dmgDelta = before
      ? Math.max(0, before.hp - after.hp) + Math.max(0, before.armor - after.armor)
      : 0;
    const nextTurnDmg = (after.turnDamageTaken ?? 0) + dmgDelta;
    const intent = after.intentCycle[after.currentIntentIndex];

    let nextEnemy: EnemyUnit = {
      ...after,
      turnDamageTaken: nextTurnDmg,
    };

    // Broken Stance (>=16) & Overkill Weapon-Break (>=22) against Charge or Heavy
    if (
      intent &&
      (intent.kind === 'charge' || intent.kind === 'heavy') &&
      nextTurnDmg >= STAGGER_BURST_THRESHOLD
    ) {
      const newlyStaggered = !nextEnemy.staggered;
      const newlyBroken = !nextEnemy.weaponBroken && nextTurnDmg >= WEAPON_BREAK_THRESHOLD;
      nextEnemy = {
        ...nextEnemy,
        staggered: true,
        ...(newlyBroken ? { weaponBroken: true } : {}),
      };
      if (newlyStaggered || newlyBroken) {
        cues?.push({
          id: `cue_${turn}_stagger_${nextEnemy.id}`,
          kind: 'enemy_stagger',
          targetId: nextEnemy.id,
          value: nextTurnDmg,
          textLabel: newlyBroken ? 'WEAPON BROKEN (-3 DMG)' : 'STAGGERED',
        });
      }
    }

    // Desperation Telegraph (<=20% HP): drops passive Armor/Bolster and telegraphs Desperation Strike (+3 DMG)
    if (
      !nextEnemy.desperationEnraged &&
      !nextEnemy.propKind &&
      !nextEnemy.isLootRunner &&
      !nextEnemy.isMercyTarget &&
      (!nextEnemy.sleepCounter || nextEnemy.sleepCounter <= 0) &&
      dmgDelta > 0 &&
      nextEnemy.hp <= Math.ceil(nextEnemy.maxHp * 0.2)
    ) {
      const currentKind = nextEnemy.intentCycle[nextEnemy.currentIntentIndex]?.kind;
      const dmgIdx = nextEnemy.intentCycle.findIndex((i) => isDamagingIntent(i));
      nextEnemy = {
        ...nextEnemy,
        desperationEnraged: true,
        currentIntentIndex:
          (currentKind === 'armor' || currentKind === 'bolster') && dmgIdx !== -1
            ? dmgIdx
            : nextEnemy.currentIntentIndex,
      };
      cues?.push({
        id: `cue_${turn}_desperation_${nextEnemy.id}`,
        kind: 'enemy_enrage',
        targetId: nextEnemy.id,
        value: 3,
        textLabel: 'DESPERATION +3 DMG',
      });
    }

    // Enrage on Alone: Skitter Anchor drops bolster when all allies die and turns aggressive
    if (becameLoneSurvivor && nextEnemy.passive === 'anchor_aegis' && !nextEnemy.enragedAlone) {
      const nextBonus = (nextEnemy.enrageAtkBonus ?? 0) + 2;
      const currentKind = nextEnemy.intentCycle[nextEnemy.currentIntentIndex]?.kind;
      const attackIdx = nextEnemy.intentCycle.findIndex((i) => i.kind === 'attack');
      nextEnemy = {
        ...nextEnemy,
        enragedAlone: true,
        enrageAtkBonus: nextBonus,
        currentIntentIndex:
          currentKind === 'bolster' && attackIdx !== -1
            ? attackIdx
            : nextEnemy.currentIntentIndex,
      };
      cues?.push({
        id: `cue_${turn}_enrage_alone_${nextEnemy.id}`,
        kind: 'enemy_enrage',
        targetId: nextEnemy.id,
        value: nextBonus,
        textLabel: 'ALONE +2 ATK',
      });
    }

    return nextEnemy;
  });
}

export function applyDamageToEnemy(
  enemy: EnemyUnit,
  damage: number,
  pierceRatio: number,
  breakArmorFirst: boolean,
): {
  enemy: EnemyUnit;
  hpDamageDealt: number;
  effectiveDamageDealt: number;
  defeated: boolean;
  pipCracked: boolean;
  phaseGateHit: boolean;
} {
  if (enemy.hp <= 0 || damage <= 0) {
    return {
      enemy: { ...enemy },
      hpDamageDealt: 0,
      effectiveDamageDealt: 0,
      defeated: false,
      pipCracked: false,
      phaseGateHit: false,
    };
  }

  // Hit-Count Scaling: Aegis Shield Pip negates 1 damaging hit regardless of raw damage
  if (enemy.shieldPips > 0) {
    return {
      enemy: {
        ...enemy,
        shieldPips: enemy.shieldPips - 1,
      },
      hpDamageDealt: 0,
      effectiveDamageDealt: 0,
      defeated: false,
      pipCracked: true,
      phaseGateHit: false,
    };
  }

  const armorBefore = enemy.armor;
  let nextArmor = breakArmorFirst ? 0 : enemy.armor;
  let nextHp = enemy.hp;

  const piercingDmg = Math.floor(damage * pierceRatio);
  const regularDmg = damage - piercingDmg;

  const absorbed = Math.min(nextArmor, regularDmg);
  nextArmor -= absorbed;
  const remainingRegular = regularDmg - absorbed;
  let totalHpLoss = remainingRegular + piercingDmg;
  nextHp = Math.max(0, nextHp - totalHpLoss);

  let phaseGateHit = false;
  let nextShieldPips = enemy.shieldPips;
  let nextPhaseGateTriggered = enemy.phaseGateTriggered;

  if (enemy.phaseGatePct && !enemy.phaseGateTriggered) {
    const thresholdHp = Math.ceil((enemy.maxHp * enemy.phaseGatePct) / 100);
    if (enemy.hp > thresholdHp && nextHp < thresholdHp) {
      totalHpLoss = enemy.hp - thresholdHp;
      nextHp = thresholdHp;
      nextArmor += PHASE_GATE_ARMOR_BONUS;
      nextShieldPips = Math.max(nextShieldPips, 1);
      nextPhaseGateTriggered = true;
      phaseGateHit = true;
    }
  }

  const armorRemoved = breakArmorFirst ? armorBefore : absorbed;
  const effectiveDamageDealt = armorRemoved + totalHpLoss;

  return {
    enemy: {
      ...enemy,
      armor: nextArmor,
      hp: nextHp,
      shieldPips: nextShieldPips,
      phaseGateTriggered: nextPhaseGateTriggered,
    },
    hpDamageDealt: totalHpLoss,
    effectiveDamageDealt,
    defeated: nextHp <= 0,
    pipCracked: false,
    phaseGateHit,
  };
}

function triggerVolatileBursts(
  enemies: EnemyUnit[],
  newlyDefeatedIds: string[],
  turn: number,
  cues?: AnimationCue[],
): { enemies: EnemyUnit[]; extraDefeated: number; extraDamageDealt: number; barrelPoppedCount: number } {
  const nextEnemies = enemies.map((e) => ({ ...e }));
  const queue = [...newlyDefeatedIds];
  const processed = new Set<string>();
  let extraDefeated = 0;
  let extraDamageDealt = 0;
  let barrelPoppedCount = 0;

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    if (processed.has(sourceId)) continue;
    processed.add(sourceId);

    const sourceEnemy = nextEnemies.find((e) => e.id === sourceId);
    if (!sourceEnemy) continue;
    const isPlasmaBarrel = sourceEnemy.propKind === 'plasma_barrel';
    if (sourceEnemy.passive !== 'volatile_burst' && !isPlasmaBarrel) continue;
    if (isPlasmaBarrel) barrelPoppedCount++;
    const burstDmg = isPlasmaBarrel ? PLASMA_BARREL_BURST_DAMAGE : VOLATILE_BURST_DAMAGE;

    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].id === sourceId || nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
      const burstRes = applyDamageToEnemy(nextEnemies[i], burstDmg, 1.0, false);
      nextEnemies[i] = burstRes.enemy;
      extraDamageDealt += burstRes.effectiveDamageDealt;
      if (cues) {
        cues.push({
          id: `cue_${turn}_burst_${sourceId}_${nextEnemies[i].id}`,
          kind: 'enemy_burst',
          targetId: nextEnemies[i].id,
          value: burstDmg,
          textLabel: isPlasmaBarrel
            ? 'PLASMA BARREL!'
            : burstRes.pipCracked
              ? 'PIP CRACKED'
              : undefined,
        });
        if (burstRes.phaseGateHit) {
          cues.push({
            id: `cue_${turn}_phase_${nextEnemies[i].id}`,
            kind: 'enemy_phase_gate',
            targetId: nextEnemies[i].id,
            value: PHASE_GATE_ARMOR_BONUS,
          });
        }
      }
      if (burstRes.defeated) {
        extraDefeated++;
        if (cues) {
          cues.push({
            id: `cue_${turn}_burst_ko_${nextEnemies[i].id}`,
            kind: 'enemy_ko',
            targetId: nextEnemies[i].id,
          });
        }
        queue.push(nextEnemies[i].id);
      }
    }
  }

  return { enemies: nextEnemies, extraDefeated, extraDamageDealt, barrelPoppedCount };
}

interface SimulatedPlayerEnemiesResult {
  enemies: EnemyUnit[];
  defeatedNow: number;
  newlyDefeatedIds: string[];
  damageDealt: number;
  retaliateDamage: number;
  pustuleRuptureCorrode: number;
  barrelPoppedCount: number;
}

function simulatePlayerActionOnEnemies(
  enemies: readonly EnemyUnit[],
  turn: number,
  preview: TurnPreview,
  cues?: AnimationCue[],
): SimulatedPlayerEnemiesResult {
  let nextEnemies = enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;
  const newlyDefeatedIds: string[] = [];
  let damageDealt = 0;
  let retaliateDamage = 0;
  let pustuleRuptureCorrode = 0;

  const applyHit = (
    targetIdx: number,
    dmg: number,
    pierceRatio: number,
    breakArmorFirst: boolean,
    cueId: string,
    surgeFlag: boolean,
    wakeSleepwalker = false,
  ) => {
    const res = applyDamageToEnemy(nextEnemies[targetIdx], dmg, pierceRatio, breakArmorFirst);
    let updatedTarget = res.enemy;
    if (
      wakeSleepwalker &&
      dmg > 0 &&
      updatedTarget.sleepCounter !== undefined &&
      updatedTarget.sleepCounter > 0
    ) {
      updatedTarget = {
        ...updatedTarget,
        sleepCounter: Math.max(0, updatedTarget.sleepCounter - 1),
      };
    }
    nextEnemies[targetIdx] = updatedTarget;
    damageDealt += res.effectiveDamageDealt;
    cues?.push({
      id: cueId,
      kind: 'hero_slash',
      targetId: updatedTarget.id,
      value: dmg,
      textLabel: res.pipCracked ? 'PIP CRACKED' : undefined,
      surge: surgeFlag,
    });
    if (res.phaseGateHit) {
      cues?.push({
        id: `cue_${turn}_phase_${updatedTarget.id}`,
        kind: 'enemy_phase_gate',
        targetId: updatedTarget.id,
        value: PHASE_GATE_ARMOR_BONUS,
      });
    }
    if (res.defeated) {
      defeatedNow++;
      newlyDefeatedIds.push(updatedTarget.id);
      cues?.push({
        id: `cue_${turn}_ko_${updatedTarget.id}`,
        kind: 'enemy_ko',
        targetId: updatedTarget.id,
      });
    }
    return res;
  };

  const frontIdx = nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
  if (preview.color === 'attack' && frontIdx !== -1) {
    const pierce = preview.armorPiercing ? 0.3 : 0;
    const frontResult = applyHit(
      frontIdx,
      preview.totalDamage,
      pierce,
      preview.surgeTriggered,
      `cue_${turn}_atk_front`,
      preview.surgeTriggered,
      true,
    );
    if (
      !frontResult.defeated &&
      !preview.surgeTriggered &&
      frontResult.enemy.passive === 'spike_retaliate'
    ) {
      retaliateDamage = SPIKE_RETALIATE_DAMAGE;
    }
    if (
      !frontResult.defeated &&
      !preview.surgeTriggered &&
      preview.totalDamage > 0 &&
      !frontResult.enemy.propKind &&
      frontResult.enemy.passive === 'acid_jam'
    ) {
      pustuleRuptureCorrode = PUSTULE_RUPTURE_CORRODE;
    }

    if (preview.cleaveDamage > 0) {
      for (let i = 0; i < nextEnemies.length; i++) {
        if (i === frontIdx || nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
        applyHit(i, preview.cleaveDamage, pierce, false, `cue_${turn}_cleave_${i}`, true, true);
      }
    }
  } else if (preview.color === 'defense' && preview.reflectOnBlock > 0 && frontIdx !== -1) {
    applyHit(frontIdx, preview.reflectOnBlock, 0, false, `cue_${turn}_def_pulse`, true, false);
  } else if (preview.color === 'tech') {
    if (preview.armorShredAmount > 0) {
      nextEnemies = nextEnemies.map((enemy) =>
        enemy.hp > 0 && !enemy.escaped
          ? { ...enemy, armor: Math.max(0, enemy.armor - preview.armorShredAmount) }
          : enemy,
      );
    }
    if (preview.techPierceDamage > 0 && frontIdx !== -1) {
      applyHit(
        frontIdx,
        preview.techPierceDamage,
        1.0,
        false,
        `cue_${turn}_tech_pierce`,
        preview.surgeTriggered,
        false,
      );
    }
  }

  // Hot Potato Passed Back: deals 8 Pierce DMG to front living enemy
  if ((preview.hotPotatoPassedDamage ?? 0) > 0) {
    const hpTargetIdx = nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
    if (hpTargetIdx !== -1) {
      applyHit(
        hpTargetIdx,
        preview.hotPotatoPassedDamage ?? 0,
        1.0,
        false,
        `cue_${turn}_hot_potato_pass`,
        true,
        preview.color === 'attack',
      );
    }
  }

  // Temptation / Bargain Cleave Bonus: +14 DMG across all living enemies
  if ((preview.temptationCleaveBonus ?? 0) > 0) {
    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
      applyHit(
        i,
        preview.temptationCleaveBonus ?? 0,
        0.5,
        false,
        `cue_${turn}_temptation_${i}`,
        true,
        preview.color === 'attack',
      );
    }
  }

  let barrelPoppedCount = 0;
  if (newlyDefeatedIds.length > 0) {
    const burstRes = triggerVolatileBursts(nextEnemies, newlyDefeatedIds, turn, cues);
    nextEnemies = burstRes.enemies;
    defeatedNow += burstRes.extraDefeated;
    damageDealt += burstRes.extraDamageDealt;
    barrelPoppedCount = burstRes.barrelPoppedCount;
  }

  nextEnemies = evaluateReactiveEnemyShifts(enemies, nextEnemies, turn, cues);

  return {
    enemies: nextEnemies,
    defeatedNow,
    newlyDefeatedIds,
    damageDealt,
    retaliateDamage,
    pustuleRuptureCorrode,
    barrelPoppedCount,
  };
}

export function previewHeroineThreat(
  combat: CombatState | null,
  heroine: HeroineState,
  activePreview: TurnPreview | null = null,
): HeroineThreatPreview {
  if (!combat || combat.phase !== 'PLAYER_IDLE' || heroine.hp <= 0) {
    return {
      rawIncomingDamage: 0,
      blockedDamage: 0,
      hpDamageTaken: 0,
      hpLossOnBar: 0,
      healGained: 0,
      shieldAfterPlayer: heroine.shield,
      shieldAfterEnemies: heroine.shield,
      armorAfterPlayer: heroine.armor ?? 0,
      armorAfterEnemies: heroine.armor ?? 0,
      armorAbsorbed: 0,
      hpBeforeEnemies: heroine.hp,
      projectedHp: heroine.hp,
      corrodeGained: 0,
      attackersCount: 0,
      preventedDamageByKills: 0,
      willDie: false,
      retaliateDamage: 0,
      willJamTile: false,
    };
  }

  let baselineIncoming = 0;
  for (let i = 0; i < combat.enemies.length; i++) {
    const enemy = combat.enemies[i];
    if (enemy.hp <= 0 || enemy.escaped) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (isDamagingIntent(intent)) {
      baselineIncoming += getEffectiveEnemyIntentValue(enemy, intent, {
        battlefieldRule: combat.battlefieldRule,
      });
    }
  }

  let simEnemies = combat.enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;
  let retaliateDamage = 0;
  let pustuleRuptureCorrode = 0;

  if (activePreview && activePreview.tileCount > 0) {
    const simResult = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, activePreview);
    simEnemies = simResult.enemies;
    defeatedNow = simResult.defeatedNow;
    retaliateDamage = simResult.retaliateDamage;
    pustuleRuptureCorrode = simResult.pustuleRuptureCorrode;
  }

  const bioSiphonHeal =
    defeatedNow > 0 && hasImplant(heroine.implants, 'bio_siphon') ? defeatedNow * 4 : 0;
  const healGained =
    (activePreview && activePreview.tileCount > 0 ? activePreview.healAmount : 0) + bioSiphonHeal;
  const hpBeforeEnemies = Math.min(heroine.maxHp, heroine.hp + healGained);
  const shieldAfterPlayer =
    heroine.shield +
    (activePreview && activePreview.tileCount > 0 ? activePreview.shieldGained : 0);

  // Check if activePreview resolves a hexed tile whose caster survived
  let hexHealTriggered = 0;
  if (activePreview && activePreview.tileCount > 0) {
    const resolvedCasterIds = new Set<string>();
    for (const t of combat.board) {
      if (t.type === activePreview.color && !t.isJammed && t.hexedByEnemyId) {
        resolvedCasterIds.add(t.hexedByEnemyId);
      }
    }
    for (const casterId of resolvedCasterIds) {
      const caster = simEnemies.find((e) => e.id === casterId && e.hp > 0);
      if (caster) {
        hexHealTriggered += Math.min(caster.maxHp - caster.hp, HEX_HEAL_AMOUNT);
      }
    }
  }

  let simShield = shieldAfterPlayer;
  const armorAfterPlayer = heroine.armor ?? 0;
  let simArmor = armorAfterPlayer;
  let rawIncomingDamage = 0;
  let blockedDamage = 0;
  let armorAbsorbed = 0;
  let hpDamageTaken = 0;
  let corrodeGained = pustuleRuptureCorrode;
  let attackersCount = 0;
  let willJamTile = false;
  let conditionalBonusDamage = 0;

  if (retaliateDamage > 0) {
    rawIncomingDamage += retaliateDamage;
    const absRet = absorbHeroDamage(simShield, simArmor, retaliateDamage);
    simShield = absRet.nextShield;
    simArmor = absRet.nextArmor;
    blockedDamage += absRet.blockedByShield + absRet.blockedByArmor;
    armorAbsorbed += absRet.blockedByArmor;
    hpDamageTaken += absRet.hpDamage;
  }

  const colorPlayed = activePreview && activePreview.tileCount > 0 ? activePreview.color : null;
  const hostilesRemain = hasHostileLivingEnemies(simEnemies);

  if (hostilesRemain) {
    for (let i = 0; i < simEnemies.length; i++) {
      const enemy = simEnemies[i];
      if (enemy.hp <= 0 || enemy.escaped) continue;
      const intent = enemy.intentCycle[enemy.currentIntentIndex];
      const intentCtx = {
        shieldAfterPlayer: simShield,
        colorPlayed,
        battlefieldRule: combat.battlefieldRule,
      };
      const incoming = getEffectiveEnemyIntentValue(enemy, intent, intentCtx);
      if (!isDamagingIntent(intent) || enemy.staggered || incoming <= 0) continue;

      attackersCount++;
      if (isIntentConditionMet(intent, intentCtx)) {
        conditionalBonusDamage += intent.conditionBonus ?? 0;
      }
      rawIncomingDamage += incoming;
      const abs = absorbHeroDamage(simShield, simArmor, incoming);
      simShield = abs.nextShield;
      simArmor = abs.nextArmor;
      blockedDamage += abs.blockedByShield + abs.blockedByArmor;
      armorAbsorbed += abs.blockedByArmor;
      const hpDmg = abs.hpDamage;
      hpDamageTaken += hpDmg;
      if (intent.kind === 'acid') {
        corrodeGained += intent.secondaryValue ?? 2;
        if (hpDmg > 0 && (enemy.passive === 'acid_jam' || enemy.archetype === 'boss')) {
          willJamTile = true;
        }
      } else if (intent.corrodeAmount && intent.corrodeAmount > 0) {
        corrodeGained += intent.corrodeAmount;
      }
    }
  }

  // Caustic Slag hold chip damage if not purged via TECH
  const unpurgedBlightCount = hostilesRemain
    ? combat.board.filter((t) => t.isBlight && (colorPlayed !== 'tech' || t.isJammed)).length
    : 0;
  const blightChipDamage = unpurgedBlightCount * BLIGHT_HOLD_CHIP_DAMAGE;
  if (blightChipDamage > 0) {
    rawIncomingDamage += blightChipDamage;
    const absBlight = absorbHeroDamage(simShield, simArmor, blightChipDamage);
    simShield = absBlight.nextShield;
    simArmor = absBlight.nextArmor;
    blockedDamage += absBlight.blockedByShield + absBlight.blockedByArmor;
    armorAbsorbed += absBlight.blockedByArmor;
    hpDamageTaken += absBlight.hpDamage;
  }

  // Hot Potato self-detonation damage if left unresolved on board
  const unresolvedHotPotatoCount = hostilesRemain
    ? combat.board.filter((t) => t.isHotPotato && (t.type !== colorPlayed || t.isJammed)).length
    : 0;
  const hotPotatoSelfDamage = unresolvedHotPotatoCount * HOT_POTATO_SELF_DAMAGE;
  if (hotPotatoSelfDamage > 0) {
    rawIncomingDamage += hotPotatoSelfDamage;
    const absPotato = absorbHeroDamage(simShield, simArmor, hotPotatoSelfDamage);
    simShield = absPotato.nextShield;
    simArmor = absPotato.nextArmor;
    blockedDamage += absPotato.blockedByShield + absPotato.blockedByArmor;
    armorAbsorbed += absPotato.blockedByArmor;
    hpDamageTaken += absPotato.hpDamage;
  }

  const projectedHp = Math.max(0, hpBeforeEnemies - hpDamageTaken);
  const hpLossOnBar = Math.max(0, heroine.hp - projectedHp);
  const preventedDamageByKills = Math.max(
    0,
    baselineIncoming -
      (rawIncomingDamage - retaliateDamage - blightChipDamage - hotPotatoSelfDamage),
  );
  const willDie = heroine.hp > 0 && hpDamageTaken > 0 && projectedHp <= 0;

  return {
    rawIncomingDamage,
    blockedDamage,
    hpDamageTaken,
    hpLossOnBar,
    healGained,
    shieldAfterPlayer,
    shieldAfterEnemies: simShield,
    armorAfterPlayer,
    armorAfterEnemies: simArmor,
    armorAbsorbed,
    hpBeforeEnemies,
    projectedHp,
    corrodeGained,
    attackersCount,
    preventedDamageByKills,
    willDie,
    retaliateDamage,
    willJamTile,
    conditionalBonusDamage,
    blightChipDamage,
    hotPotatoSelfDamage,
    hexHealTriggered,
  };
}

export function resolvePlayerColor(run: RunState, color: TileType): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  const preview = previewColorResolution(run, color);
  if (preview.tileCount === 0) return run;

  const combat = run.combat;
  const resolvedTiles = combat.board.filter((t) => t.type === color && !t.isJammed);

  // Positional Contagion: collect adjacent non-matching board indices discarded by Contagion
  const contagionDiscardIdxSet = new Set<number>();
  combat.board.forEach((tile, idx) => {
    if (tile.type === color && !tile.isJammed && tile.isContagion) {
      for (const adjIdx of [idx - 1, idx + 1]) {
        const adj = combat.board[adjIdx];
        if (adj && (adj.type !== color || adj.isJammed)) {
          contagionDiscardIdxSet.add(adjIdx);
        }
      }
    }
  });
  const contagionDiscardedTiles = combat.board.filter((_, idx) => contagionDiscardIdxSet.has(idx));

  let keptTiles: Tile[] = combat.board
    .filter((t, idx) => (t.type !== color || t.isJammed) && !contagionDiscardIdxSet.has(idx))
    .map((t) => ({ ...t, isJammed: false }));

  // Blight/Slag tiles exhaust permanently when resolved via TECH
  const purgedBlightCount = resolvedTiles.filter((t) => t.isBlight).length;
  const nextDiscard = [
    ...combat.discardPile.map((t) => ({ ...t })),
    ...resolvedTiles
      .filter((t) => !t.isBlight)
      .map((t) => ({
        ...t,
        isHeldFromPrevTurn: false,
        isJammed: false,
        hexedByEnemyId: undefined,
        isHotPotato: undefined,
        isContagion: undefined,
        isTemptation: undefined,
        isTopDecked: undefined,
      })),
    ...contagionDiscardedTiles
      .filter((t) => !t.isBlight)
      .map((t) => ({
        ...t,
        isHeldFromPrevTurn: false,
        isJammed: false,
        hexedByEnemyId: undefined,
        isHotPotato: undefined,
        isContagion: undefined,
        isTemptation: undefined,
        isTopDecked: undefined,
      })),
  ];

  // Temptation / Bargain Pact: each resolved isTemptation tile injects 2 Caustic Slag curses
  const temptationCount = resolvedTiles.filter((t) => Boolean(t.isTemptation)).length;
  for (let i = 0; i < temptationCount * 2; i++) {
    nextDiscard.push(createBlightTile(combat.turn, combat.totalTilesResolved + 50 + i));
  }

  let nextHeroine = { ...run.heroine };
  if ((preview.upchargeGained ?? 0) > 0) {
    nextHeroine.pendingUpcharge = (nextHeroine.pendingUpcharge ?? 0) + (preview.upchargeGained ?? 0);
  }
  const cues: AnimationCue[] = [];

  if (contagionDiscardedTiles.length > 0) {
    cues.push({
      id: `cue_${combat.turn}_contagion_discard`,
      kind: 'tile_hex',
      value: contagionDiscardedTiles.length,
      textLabel: `CONTAGION -${contagionDiscardedTiles.length} TILE`,
    });
  }
  if (temptationCount > 0) {
    cues.push({
      id: `cue_${combat.turn}_temptation_pact`,
      kind: 'tile_blight',
      value: temptationCount * 2,
      textLabel: `PACT: +${temptationCount * 2} SLAG`,
    });
  }

  if (color === 'attack') {
    if (preview.shieldGained > 0) {
      nextHeroine.shield += preview.shieldGained;
    }
    if (preview.damageBoostAddedPct > 0) {
      nextHeroine.damageBoostPct += preview.damageBoostAddedPct;
    }
  } else if (color === 'defense') {
    nextHeroine.shield += preview.shieldGained;
    if (preview.damageBoostAddedPct > 0) {
      nextHeroine.damageBoostPct += preview.damageBoostAddedPct;
    }
    cues.push({
      id: `cue_${combat.turn}_def`,
      kind: 'hero_shield',
      value: preview.shieldGained,
      surge: preview.surgeTriggered,
    });
  } else if (color === 'tech') {
    if (preview.damageBoostAddedPct > 0) {
      nextHeroine.damageBoostPct += preview.damageBoostAddedPct;
    }
    if (preview.healAmount > 0) {
      nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + preview.healAmount);
    }
    if (preview.shieldGained > 0) {
      nextHeroine.shield += preview.shieldGained;
    }
    if (preview.cleanseCorrodeAmount > 0) {
      nextHeroine.corrode = Math.max(0, nextHeroine.corrode - preview.cleanseCorrodeAmount);
    }
  }

  const enemySim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, preview, cues);
  let nextEnemies = enemySim.enemies;
  const defeatedNow = enemySim.defeatedNow;
  const totalDamageDealt = combat.totalDamageDealt + enemySim.damageDealt;

  if (enemySim.retaliateDamage > 0) {
    const frontEnemy = nextEnemies.find((e) => e.hp > 0 && !e.escaped);
    const absRet = absorbHeroDamage(
      nextHeroine.shield,
      nextHeroine.armor ?? 0,
      enemySim.retaliateDamage,
    );
    nextHeroine.shield = absRet.nextShield;
    nextHeroine.armor = absRet.nextArmor;
    const retBlocked = absRet.blockedByShield + absRet.blockedByArmor;
    const retHpDmg = absRet.hpDamage;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - retHpDmg);
    if (frontEnemy) {
      cues.push({
        id: `cue_${combat.turn}_retaliate_${frontEnemy.id}`,
        kind: 'enemy_retaliate',
        targetId: frontEnemy.id,
        value: enemySim.retaliateDamage,
        blocked: retBlocked,
        armorDamage: absRet.blockedByArmor,
        hpDamage: retHpDmg,
      });
    }
  }

  if (enemySim.pustuleRuptureCorrode > 0) {
    const frontEnemy = nextEnemies.find((e) => e.hp > 0 && !e.escaped);
    nextHeroine.corrode += enemySim.pustuleRuptureCorrode;
    if (frontEnemy) {
      cues.push({
        id: `cue_${combat.turn}_pustule_rupture_${frontEnemy.id}`,
        kind: 'enemy_pustule_rupture',
        targetId: frontEnemy.id,
        value: enemySim.pustuleRuptureCorrode,
        textLabel: `+${enemySim.pustuleRuptureCorrode} COR`,
      });
    }
  }

  if (color === 'tech') {
    const parts: string[] = [];
    if (preview.damageBoostAddedPct > 0) parts.push(`+${preview.damageBoostAddedPct}% DMG`);
    if (preview.healAmount > 0) parts.push(`+${preview.healAmount} HP`);
    if (preview.shieldGained > 0) parts.push(`+${preview.shieldGained} SHD`);
    if (preview.cleanseCorrodeAmount > 0) parts.push(`-${preview.cleanseCorrodeAmount} COR`);
    if (preview.armorShredAmount > 0) parts.push(`-${preview.armorShredAmount} ARM`);
    if (preview.techPierceDamage > 0) parts.push(`${preview.techPierceDamage} DMG`);

    cues.push({
      id: `cue_${combat.turn}_tech`,
      kind: 'hero_tech',
      value: preview.damageBoostAddedPct || preview.healAmount || preview.shieldGained || preview.techPierceDamage,
      textLabel: parts.join(' · ') || 'TECH',
      surge: preview.surgeTriggered,
    });
  }

  keptTiles = clearDeadCasterHexes(keptTiles, nextEnemies);

  // Trigger Targeted Tile Hex heal/armor if a resolved tile's caster survived
  const triggeredHexCasterIds = new Set<string>();
  for (const tile of resolvedTiles) {
    if (tile.hexedByEnemyId) {
      triggeredHexCasterIds.add(tile.hexedByEnemyId);
    }
  }
  if (triggeredHexCasterIds.size > 0) {
    nextEnemies = nextEnemies.map((enemy) => {
      if (enemy.hp <= 0 || enemy.escaped || !triggeredHexCasterIds.has(enemy.id)) return enemy;
      cues.push({
        id: `cue_${combat.turn}_hex_heal_${enemy.id}`,
        kind: 'tile_hex',
        targetId: enemy.id,
        value: HEX_HEAL_AMOUNT,
        textLabel: `HEX +${HEX_HEAL_AMOUNT} HP`,
      });
      return {
        ...enemy,
        hp: Math.min(enemy.maxHp, enemy.hp + HEX_HEAL_AMOUNT),
        armor: enemy.armor + HEX_ARMOR_AMOUNT,
      };
    });
  }

  if (purgedBlightCount > 0) {
    cues.push({
      id: `cue_${combat.turn}_blight_purge`,
      kind: 'tile_blight',
      value: purgedBlightCount,
      textLabel: `PURGED ${purgedBlightCount} SLAG`,
    });
  }

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  const barrelOdBonus = enemySim.barrelPoppedCount * 20;
  nextHeroine.overdrive = Math.min(
    100,
    nextHeroine.overdrive + preview.overdriveGained + barrelOdBonus,
  );

  // Loot Runner Bounty: check if any Loot Runner was killed this action
  let lootBountyEarnedNow = 0;
  nextEnemies.forEach((afterE, idx) => {
    const beforeE = combat.enemies[idx];
    if (
      afterE.isLootRunner &&
      !afterE.escaped &&
      afterE.hp <= 0 &&
      beforeE &&
      beforeE.hp > 0
    ) {
      lootBountyEarnedNow += afterE.bountyCredits ?? 25;
    }
  });

  // Tug-of-War Neural Meter update (+2% per player damage dealt)
  let nextTugOfWarMeter = combat.tugOfWarMeter;
  let nextTugOfWarPurged = combat.tugOfWarPurged;
  let tugOfWarCrBonus = 0;
  if (nextTugOfWarMeter !== undefined && enemySim.damageDealt > 0) {
    nextTugOfWarMeter = Math.min(100, nextTugOfWarMeter + enemySim.damageDealt * 2);
    if (nextTugOfWarMeter >= 100 && !nextTugOfWarPurged) {
      nextTugOfWarPurged = true;
      tugOfWarCrBonus = TUG_OF_WAR_PURGE_CR_BONUS;
      nextHeroine.overdrive = Math.min(100, nextHeroine.overdrive + TUG_OF_WAR_PURGE_OD_BONUS);
      nextEnemies = nextEnemies.map((e) =>
        e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget
          ? { ...e, staggered: true }
          : e,
      );
      cues.push({
        id: `cue_${combat.turn}_tug_purge`,
        kind: 'enemy_stagger',
        value: 100,
        textLabel: 'NEURAL PURGE! ALL STAGGERED',
      });
    }
  }

  if (nextHeroine.hp <= 0) {
    return {
      ...run,
      screen: 'gameover',
      heroine: nextHeroine,
      combat: {
        ...combat,
        phase: 'DEFEAT',
        board: keptTiles,
        drawPile: combat.drawPile.map((t) => ({ ...t })),
        discardPile: nextDiscard,
        enemies: nextEnemies,
        lastCues: cues,
        totalDamageDealt,
        totalTilesResolved: combat.totalTilesResolved + resolvedTiles.length,
        lastColorPlayed: color,
        tugOfWarMeter: nextTugOfWarMeter,
        tugOfWarPurged: nextTugOfWarPurged,
      },
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      score: run.score + (totalDamageDealt - combat.totalDamageDealt) * 2 + defeatedNow * 50,
    };
  }

  const directorActionUpdate = updateDirectorAfterPlayerAction(
    combat.director,
    combat.enemies,
    nextEnemies,
    color,
    preview.surgeTriggered,
  );
  nextEnemies = directorActionUpdate.enemies;

  const anyLivingEnemy = hasHostileLivingEnemies(nextEnemies);
  const nextPhase = anyLivingEnemy ? 'PLAYER_RESOLVED' : 'VICTORY';

  // Mercy / Pacifist Victory check: if all hostile enemies are dead and a Mercy target survived
  let mercyCrBonus = 0;
  let nextMercyBonusAwarded = combat.mercyBonusAwarded;
  if (
    !anyLivingEnemy &&
    !nextMercyBonusAwarded &&
    nextEnemies.some((e) => e.isMercyTarget && e.hp > 0)
  ) {
    nextMercyBonusAwarded = true;
    mercyCrBonus = MERCY_REWARD_CREDITS;
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + MERCY_REWARD_HP);
  }

  // Gene-Splice Pedigree Lab: resolving one married Tile color activates Bloodline Resonance for its partner color
  // AND immediately supercharges unconsumed partner-color Tiles sitting on the 6-slot board with +1 UpCharge (⚡)!
  let nextBloodlineResonance: TileType | null = combat.bloodlineResonanceActive ?? null;
  if (nextHeroine.bloodlineCrest) {
    if (color === nextHeroine.bloodlineCrest.primary) {
      nextBloodlineResonance = nextHeroine.bloodlineCrest.secondary;
    } else if (color === nextHeroine.bloodlineCrest.secondary) {
      nextBloodlineResonance = nextHeroine.bloodlineCrest.primary;
    } else if (color === combat.bloodlineResonanceActive) {
      nextBloodlineResonance = null;
    }
    if (nextBloodlineResonance && nextBloodlineResonance !== color) {
      keptTiles = keptTiles.map((t) =>
        t.type === nextBloodlineResonance && !t.isBlight
          ? { ...t, upcharge: Math.min(MAX_UPCHARGE_BOARD_CAPACITY, (t.upcharge ?? 0) + 1) }
          : t,
      );
    }
  }

  // Beta-Test Arcade: log resolved tiles toward the 5-play experimental software trial
  if (nextHeroine.betaTrialChip && !nextHeroine.betaTrialChip.upgraded) {
    const nextLogged = nextHeroine.betaTrialChip.resolvesLogged + resolvedTiles.length;
    const newlyUpgraded = nextLogged >= 5;
    nextHeroine = {
      ...nextHeroine,
      betaTrialChip: {
        ...nextHeroine.betaTrialChip,
        resolvesLogged: nextLogged,
        upgraded: newlyUpgraded,
      },
      ...(newlyUpgraded
        ? {
            overclockCount: Math.min(
              MAX_OVERCLOCK_STACKS,
              (nextHeroine.overclockCount ?? 0) + 1,
            ),
          }
        : {}),
    };
  }

  let updatedCombat: CombatState = {
    ...combat,
    phase: nextPhase,
    board: keptTiles,
    drawPile: combat.drawPile.map((t) => ({ ...t })),
    discardPile: nextDiscard,
    enemies: nextEnemies,
    lastCues: cues,
    totalDamageDealt,
    totalTilesResolved: combat.totalTilesResolved + resolvedTiles.length,
    rewardCredits: combat.rewardCredits + lootBountyEarnedNow + tugOfWarCrBonus + mercyCrBonus,
    director: directorActionUpdate.director,
    lastColorPlayed: color,
    tugOfWarMeter: nextTugOfWarMeter,
    tugOfWarPurged: nextTugOfWarPurged,
    mercyBonusAwarded: nextMercyBonusAwarded,
    lootBountyAwarded: (combat.lootBountyAwarded ?? 0) + lootBountyEarnedNow,
    bloodlineResonanceActive: nextBloodlineResonance,
  };

  if (!anyLivingEnemy) {
    const victoryRewards = computeVictoryDirectorRewards(
      updatedCombat.rewardCredits,
      updatedCombat.turn,
      updatedCombat.director,
    );
    updatedCombat = {
      ...updatedCombat,
      rewardCredits: victoryRewards.totalCredits,
      rewardBreakdown: victoryRewards.breakdown,
      director: victoryRewards.director,
    };
  }

  const transition = !anyLivingEnemy
    ? resolveCombatVictoryTransition(run, updatedCombat, nextHeroine)
    : { screen: run.screen, mapNodes: run.mapNodes, heroine: nextHeroine, combat: updatedCombat };

  const damageAdded = totalDamageDealt - combat.totalDamageDealt;
  const rewardedKills = nextEnemies.filter(
    (e, idx) => e.hp <= 0 && !e.escaped && combat.enemies[idx]?.hp > 0 && !e.isZeroReward,
  ).length;
  const scoreKillCount = defeatedNow > 0 ? Math.min(defeatedNow, Math.max(rewardedKills, 0)) : 0;

  return {
    ...run,
    screen: transition.screen,
    heroine: transition.heroine,
    masterPool: rebuildMasterPool(transition.heroine),
    mapNodes: transition.mapNodes,
    combat: transition.combat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    turnsCompleted: !anyLivingEnemy ? run.turnsCompleted + 1 : run.turnsCompleted,
    score: run.score + damageAdded * 2 + scoreKillCount * 50,
  };
}

export function executeOverdrive(run: RunState): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  if (run.heroine.overdrive < 100) return run;

  const combat = run.combat;
  const odSpec = getHeroSpec(run.heroine.characterId).overdrive;
  const nextHeroine = {
    ...run.heroine,
    overdrive: 0,
    shield: run.heroine.shield + odSpec.shield,
    armor: (run.heroine.armor ?? 0) + (odSpec.armor ?? 0),
    pendingUpcharge: (run.heroine.pendingUpcharge ?? 0) + (odSpec.upcharge ?? 0),
    damageBoostPct: run.heroine.damageBoostPct + odSpec.damageBoostPct,
    corrode: Math.max(0, run.heroine.corrode - odSpec.cleanseCorrode),
  };
  let defeatedNow = 0;
  let totalDamageDealt = combat.totalDamageDealt;
  const newlyDefeatedIds: string[] = [];
  const cues: AnimationCue[] = [
    { id: `cue_${combat.turn}_od`, kind: 'hero_overdrive', value: odSpec.damage, surge: true },
  ];

  const armorShred = odSpec.armorShred ?? 0;
  let nextEnemies = combat.enemies.map((enemy) => {
    if (enemy.hp <= 0 || enemy.escaped || enemy.isMercyTarget) return { ...enemy };
    const preppedEnemy =
      armorShred > 0 ? { ...enemy, armor: Math.max(0, enemy.armor - armorShred) } : enemy;
    const res = applyDamageToEnemy(preppedEnemy, odSpec.damage, 1.0, false);
    totalDamageDealt += res.effectiveDamageDealt;
    if (res.phaseGateHit) {
      cues.push({
        id: `cue_${combat.turn}_od_phase_${enemy.id}`,
        kind: 'enemy_phase_gate',
        targetId: enemy.id,
        value: PHASE_GATE_ARMOR_BONUS,
      });
    }
    if (res.defeated) {
      defeatedNow++;
      newlyDefeatedIds.push(enemy.id);
      cues.push({
        id: `cue_${combat.turn}_od_ko_${enemy.id}`,
        kind: 'enemy_ko',
        targetId: enemy.id,
      });
    }
    return res.enemy;
  });

  if (newlyDefeatedIds.length > 0) {
    const burstRes = triggerVolatileBursts(nextEnemies, newlyDefeatedIds, combat.turn, cues);
    nextEnemies = burstRes.enemies;
    defeatedNow += burstRes.extraDefeated;
    totalDamageDealt += burstRes.extraDamageDealt;
    if (burstRes.barrelPoppedCount > 0) {
      nextHeroine.overdrive = Math.min(100, nextHeroine.overdrive + burstRes.barrelPoppedCount * 20);
    }
  }

  nextEnemies = evaluateReactiveEnemyShifts(combat.enemies, nextEnemies, combat.turn, cues);

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  const directorOdUpdate = updateDirectorAfterPlayerAction(
    combat.director,
    combat.enemies,
    nextEnemies,
    null,
    false,
  );
  nextEnemies = directorOdUpdate.enemies;

  const anyLiving = hasHostileLivingEnemies(nextEnemies);
  const nextPhase = anyLiving ? 'PLAYER_IDLE' : 'VICTORY';

  // Overdrive cleanses Jams, Hexes, Hot Potato, Contagion, AND exhausts board Caustic Slag tiles cleanly
  const cleansedBoard = combat.board
    .filter((t) => !t.isBlight)
    .map((t) => ({
      ...t,
      isJammed: false,
      hexedByEnemyId: undefined,
      isHotPotato: undefined,
      isContagion: undefined,
    }));

  let updatedOdCombat: CombatState = {
    ...combat,
    phase: nextPhase,
    board: cleansedBoard,
    enemies: nextEnemies,
    lastCues: cues,
    totalDamageDealt,
    director: directorOdUpdate.director,
  };

  if (!anyLiving) {
    const victoryRewards = computeVictoryDirectorRewards(
      updatedOdCombat.rewardCredits,
      updatedOdCombat.turn,
      updatedOdCombat.director,
    );
    updatedOdCombat = {
      ...updatedOdCombat,
      rewardCredits: victoryRewards.totalCredits,
      rewardBreakdown: victoryRewards.breakdown,
      director: victoryRewards.director,
    };
  }

  const transition = !anyLiving
    ? resolveCombatVictoryTransition(run, updatedOdCombat, nextHeroine)
    : { screen: run.screen, mapNodes: run.mapNodes, heroine: nextHeroine, combat: updatedOdCombat };

  return {
    ...run,
    screen: transition.screen,
    heroine: transition.heroine,
    mapNodes: transition.mapNodes,
    combat: transition.combat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    score: run.score + 80 + defeatedNow * 50,
  };
}

export function executeSingleEnemyAction(run: RunState, enemyIndex: number): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
    return run;
  }

  const enemy = combat.enemies[enemyIndex];
  if (!enemy || enemy.hp <= 0 || enemy.escaped) return run;

  const nextHeroine = { ...run.heroine };
  const implants = nextHeroine.implants;
  const cues: AnimationCue[] = [];
  let defeatedNow = 0;
  const newlyDefeatedIds: string[] = [];
  let nextBoard = combat.board.map((t) => ({ ...t }));
  const nextDrawPile = combat.drawPile.map((t) => ({ ...t }));
  const nextDiscardPile = combat.discardPile.map((t) => ({ ...t }));
  let nextTugOfWarMeter = combat.tugOfWarMeter;
  let nextCradleObjective = combat.cradleObjective ? { ...combat.cradleObjective } : undefined;

  const intent = enemy.intentCycle[enemy.currentIntentIndex];
  const isSleeping = enemy.sleepCounter !== undefined && enemy.sleepCounter > 0;
  const isPassiveProp =
    enemy.propKind === 'plasma_barrel' || enemy.propKind === 'bio_husk';
  const nextIndexOnStagger =
    intent.kind === 'charge'
      ? 0
      : (enemy.currentIntentIndex + 1) % enemy.intentCycle.length;
  const updatedEnemy: EnemyUnit = {
    ...enemy,
    currentIntentIndex:
      isSleeping || isPassiveProp
        ? enemy.currentIntentIndex
        : enemy.staggered
          ? nextIndexOnStagger
          : (enemy.currentIntentIndex + 1) % enemy.intentCycle.length,
    staggered: false,
    turnDamageTaken: 0,
  };

  let reflectedDamage = 0;
  let bolsterAllAmount = 0;

  if (isSleeping) {
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_sleeping`,
      kind: 'enemy_stagger',
      targetId: enemy.id,
      value: 0,
      textLabel: `SLEEPING (${enemy.sleepCounter})`,
    });
  } else if (isPassiveProp) {
    // Passive battlefield props do not act during enemy turn
  } else if (enemy.staggered) {
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_stagger_recover`,
      kind: 'enemy_stagger',
      targetId: enemy.id,
      value: 0,
      textLabel: 'STAGGERED · 0 DMG',
    });
  } else if (intent.kind === 'armor') {
    const armorGain = getEffectiveEnemyIntentValue(enemy, intent, {
      battlefieldRule: combat.battlefieldRule,
    });
    updatedEnemy.armor += armorGain;
    const secondaryHealRaw = intent.secondaryValue ?? 0;
    const healGain =
      secondaryHealRaw > 0
        ? Math.min(updatedEnemy.maxHp - updatedEnemy.hp, secondaryHealRaw)
        : 0;
    if (healGain > 0) {
      updatedEnemy.hp += healGain;
    }
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_armor`,
      kind: 'enemy_armor',
      targetId: enemy.id,
      value: armorGain,
      ...(healGain > 0 ? { secondaryHeal: healGain } : {}),
    });
  } else if (intent.kind === 'bolster') {
    bolsterAllAmount = getEffectiveEnemyIntentValue(enemy, intent, {
      battlefieldRule: combat.battlefieldRule,
    });
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_bolster`,
      kind: 'enemy_bolster',
      targetId: enemy.id,
      value: bolsterAllAmount,
      textLabel: `+${bolsterAllAmount} ARM ALL`,
    });
  } else if (intent.kind === 'charge') {
    const turnsLeft = intent.secondaryValue ?? 1;
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_charge`,
      kind: 'enemy_charge',
      targetId: enemy.id,
      value: intent.value,
      textLabel: `CHARGING (${turnsLeft}T)`,
    });
  } else {
    const incoming = getEffectiveEnemyIntentValue(enemy, intent, {
      shieldAfterPlayer: nextHeroine.shield,
      colorPlayed: combat.lastColorPlayed ?? null,
      battlefieldRule: combat.battlefieldRule,
    });
    const abs = absorbHeroDamage(nextHeroine.shield, nextHeroine.armor ?? 0, incoming);
    nextHeroine.shield = abs.nextShield;
    nextHeroine.armor = abs.nextArmor;
    const blocked = abs.blockedByShield + abs.blockedByArmor;
    const hpDamage = abs.hpDamage;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - hpDamage);

    if (hpDamage > 0 && nextTugOfWarMeter !== undefined) {
      nextTugOfWarMeter = Math.max(0, nextTugOfWarMeter - hpDamage * 3);
    }

    // Maternal/Paternal Vanguard Escort: unblocked HP damage also chips the Neonatal Bio-Cradle
    if (hpDamage > 0 && nextCradleObjective && nextCradleObjective.hp > 0) {
      const cradleLoss = Math.min(4, Math.ceil(hpDamage * 0.5));
      nextCradleObjective.hp = Math.max(0, nextCradleObjective.hp - cradleLoss);
    }

    if (blocked > 0 && hasImplant(implants, 'kinetic_reflector')) {
      const refRes = applyDamageToEnemy(updatedEnemy, 3, 0, false);
      reflectedDamage = refRes.effectiveDamageDealt;
      updatedEnemy.hp = refRes.enemy.hp;
      updatedEnemy.armor = refRes.enemy.armor;
      updatedEnemy.shieldPips = refRes.enemy.shieldPips;
      updatedEnemy.phaseGateTriggered = refRes.enemy.phaseGateTriggered;
      if (refRes.phaseGateHit) {
        cues.push({
          id: `cue_e_${combat.turn}_${enemy.id}_refphase`,
          kind: 'enemy_phase_gate',
          targetId: enemy.id,
          value: PHASE_GATE_ARMOR_BONUS,
        });
      }
      if (refRes.defeated) {
        defeatedNow++;
        newlyDefeatedIds.push(enemy.id);
        cues.push({
          id: `cue_e_${combat.turn}_${enemy.id}_refko`,
          kind: 'enemy_ko',
          targetId: enemy.id,
        });
      }
    }

    if (intent.kind === 'acid') {
      nextHeroine.corrode += intent.secondaryValue ?? 2;
      let jammedTile = false;
      if (hpDamage > 0 && (enemy.passive === 'acid_jam' || enemy.archetype === 'boss')) {
        const jamIdx = nextBoard.findIndex((t) => !t.isJammed);
        if (jamIdx !== -1) {
          nextBoard[jamIdx] = { ...nextBoard[jamIdx], isJammed: true };
          jammedTile = true;
        }
        // Deck Polluter & Top-Deck Manipulation: inject up to MAX_ACTIVE_BLIGHT_TILES Caustic Slag
        const blightInCombat =
          countTotalBlightTiles({
            board: nextBoard,
            drawPile: nextDrawPile,
            discardPile: nextDiscardPile,
          });
        if (blightInCombat < MAX_ACTIVE_BLIGHT_TILES) {
          const useTopDeck = Boolean(intent.topDeckBlight) && nextDrawPile.length > 0;
          const blightTile = createBlightTile(
            combat.turn,
            combat.totalTilesResolved + enemyIndex + blightInCombat + 1,
            useTopDeck,
          );
          if (useTopDeck) {
            nextDrawPile.unshift(blightTile);
          } else {
            nextDiscardPile.push(blightTile);
          }
          cues.push({
            id: `cue_e_${combat.turn}_${enemy.id}_blight`,
            kind: 'tile_blight',
            targetId: enemy.id,
            textLabel: useTopDeck ? 'TOP-DECK SLAG!' : 'CAUSTIC SLAG',
          });
        }
      }
      cues.push({
        id: `cue_e_${combat.turn}_${enemy.id}_acid`,
        kind: 'enemy_acid',
        targetId: enemy.id,
        value: incoming,
        blocked,
        armorDamage: abs.blockedByArmor,
        hpDamage,
        reflectedDamage,
        textLabel: jammedTile ? 'TILE JAMMED' : undefined,
      });
    } else {
      if (intent.corrodeAmount && intent.corrodeAmount > 0) {
        nextHeroine.corrode += intent.corrodeAmount;
      }
      const gainedArmorOnHit =
        intent.armorOnHit && intent.armorOnHit > 0 && hpDamage > 0 && updatedEnemy.hp > 0
          ? intent.armorOnHit
          : 0;
      if (gainedArmorOnHit > 0) {
        updatedEnemy.armor += gainedArmorOnHit;
      }
      cues.push({
        id: `cue_e_${combat.turn}_${enemy.id}_atk`,
        kind: 'enemy_attack',
        targetId: enemy.id,
        value: incoming,
        blocked,
        armorDamage: abs.blockedByArmor,
        hpDamage,
        reflectedDamage,
        clawRend: intent.clawRend,
        heavySmash: intent.kind === 'heavy',
        textLabel: gainedArmorOnHit > 0 ? `+${gainedArmorOnHit} ARM` : undefined,
      });
    }

    if (intent.kind === 'leech' && hpDamage > 0 && updatedEnemy.hp > 0) {
      const healAmt = intent.secondaryValue ?? 4;
      updatedEnemy.hp = Math.min(updatedEnemy.maxHp, updatedEnemy.hp + healAmt);
    }
  }

  let nextEnemies = combat.enemies.map((e, idx) => {
    const baseUnit = idx === enemyIndex ? updatedEnemy : { ...e };
    if (bolsterAllAmount > 0 && baseUnit.hp > 0 && !baseUnit.escaped) {
      return { ...baseUnit, armor: baseUnit.armor + bolsterAllAmount };
    }
    return baseUnit;
  });

  let totalDamageDealt = combat.totalDamageDealt + reflectedDamage;

  if (newlyDefeatedIds.length > 0) {
    const burstRes = triggerVolatileBursts(nextEnemies, newlyDefeatedIds, combat.turn, cues);
    nextEnemies = burstRes.enemies;
    defeatedNow += burstRes.extraDefeated;
    totalDamageDealt += burstRes.extraDamageDealt;
  }

  if (reflectedDamage > 0 || newlyDefeatedIds.length > 0) {
    nextEnemies = evaluateReactiveEnemyShifts(combat.enemies, nextEnemies, combat.turn, cues);
    nextBoard = clearDeadCasterHexes(nextBoard, nextEnemies);
  }

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  if (nextHeroine.hp <= 0) {
    return {
      ...run,
      screen: 'gameover',
      heroine: nextHeroine,
      combat: {
        ...combat,
        phase: 'DEFEAT',
        board: nextBoard,
        drawPile: nextDrawPile,
        discardPile: nextDiscardPile,
        enemies: nextEnemies,
        lastCues: cues,
        totalDamageDealt,
        tugOfWarMeter: nextTugOfWarMeter,
        cradleObjective: nextCradleObjective,
      },
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      score: run.score + reflectedDamage * 2 + defeatedNow * 50,
    };
  }

  const directorReflectUpdate =
    reflectedDamage > 0 || newlyDefeatedIds.length > 0
      ? updateDirectorAfterPlayerAction(combat.director, combat.enemies, nextEnemies, null, false)
      : { director: combat.director, enemies: nextEnemies };
  nextEnemies = directorReflectUpdate.enemies;

  const anyLiving = hasHostileLivingEnemies(nextEnemies);
  if (!anyLiving) {
    let victoryCombat: CombatState = {
      ...combat,
      phase: 'VICTORY',
      board: nextBoard,
      drawPile: nextDrawPile,
      discardPile: nextDiscardPile,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
      director: directorReflectUpdate.director,
      tugOfWarMeter: nextTugOfWarMeter,
      cradleObjective: nextCradleObjective,
    };
    const victoryRewards = computeVictoryDirectorRewards(
      victoryCombat.rewardCredits,
      victoryCombat.turn,
      victoryCombat.director,
    );
    victoryCombat = {
      ...victoryCombat,
      rewardCredits: victoryRewards.totalCredits,
      rewardBreakdown: victoryRewards.breakdown,
      director: victoryRewards.director,
    };
    const transition = resolveCombatVictoryTransition(run, victoryCombat, nextHeroine);
    return {
      ...run,
      screen: transition.screen,
      heroine: transition.heroine,
      mapNodes: transition.mapNodes,
      combat: transition.combat,
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      turnsCompleted: run.turnsCompleted + 1,
      score: run.score + reflectedDamage * 2 + defeatedNow * 50,
    };
  }

  return {
    ...run,
    heroine: nextHeroine,
    combat: {
      ...combat,
      phase: 'ENEMY_ACTING',
      board: nextBoard,
      drawPile: nextDrawPile,
      discardPile: nextDiscardPile,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
      director: directorReflectUpdate.director,
      tugOfWarMeter: nextTugOfWarMeter,
      cradleObjective: nextCradleObjective,
    },
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    score: run.score + reflectedDamage * 2 + defeatedNow * 50,
  };
}

export function advanceRoundAfterEnemies(run: RunState): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
    return run;
  }

  const nextHeroine = { ...run.heroine };
  const implants = nextHeroine.implants;
  const heroSpec = getHeroSpec(nextHeroine.characterId);
  const roundEndCues: AnimationCue[] = [];

  // Lingering Caustic Slag held on board deals 2 chip DMG before end-of-round Shield decay
  const lingeringBlightCount = combat.board.filter((t) => t.isBlight).length;
  if (lingeringBlightCount > 0) {
    const blightDmg = lingeringBlightCount * BLIGHT_HOLD_CHIP_DAMAGE;
    const absBlight = absorbHeroDamage(nextHeroine.shield, nextHeroine.armor ?? 0, blightDmg);
    nextHeroine.shield = absBlight.nextShield;
    nextHeroine.armor = absBlight.nextArmor;
    const blockedBlight = absBlight.blockedByShield + absBlight.blockedByArmor;
    const hpBlight = absBlight.hpDamage;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - hpBlight);
    roundEndCues.push({
      id: `cue_${combat.turn}_blight_chip`,
      kind: 'tile_blight',
      value: blightDmg,
      blocked: blockedBlight,
      hpDamage: hpBlight,
      textLabel: `-${blightDmg} SLAG BURN`,
    });
    if (nextHeroine.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        heroine: nextHeroine,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  // Lingering Ticking Time-Bomb (Hot Potato) held on board detonates for 6 DMG
  const lingeringHotPotatoCount = combat.board.filter((t) => Boolean(t.isHotPotato)).length;
  if (lingeringHotPotatoCount > 0) {
    const potatoDmg = lingeringHotPotatoCount * HOT_POTATO_SELF_DAMAGE;
    const absPotato = absorbHeroDamage(nextHeroine.shield, nextHeroine.armor ?? 0, potatoDmg);
    nextHeroine.shield = absPotato.nextShield;
    nextHeroine.armor = absPotato.nextArmor;
    const blockedPotato = absPotato.blockedByShield + absPotato.blockedByArmor;
    const hpPotato = absPotato.hpDamage;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - hpPotato);
    roundEndCues.push({
      id: `cue_${combat.turn}_hot_potato_boom`,
      kind: 'tile_blight',
      value: potatoDmg,
      blocked: blockedPotato,
      hpDamage: hpPotato,
      textLabel: `-${potatoDmg} TIME-BOMB!`,
    });
    if (nextHeroine.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        heroine: nextHeroine,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  const aegisRetained = hasImplant(implants, 'aegis_capacitor')
    ? Math.floor(nextHeroine.shield * 0.5)
    : 0;
  nextHeroine.shield = Math.min(
    nextHeroine.shield,
    aegisRetained + heroSpec.shieldRetainCap,
  );
  nextHeroine.corrode = Math.max(0, nextHeroine.corrode - 1);
  // Damage boost decays by 10 percentage points at the end of each round
  nextHeroine.damageBoostPct = Math.max(0, nextHeroine.damageBoostPct - 10);

  // Nanny-Bot Showroom automation: Guardian Nanny grants +4 Shield per round; Caretaker Nanny cleanses -1 Corrode & heals +2 HP
  if (nextHeroine.nannyBotInstalled === 'guardian_nanny') {
    nextHeroine.shield += 4;
  } else if (nextHeroine.nannyBotInstalled === 'caretaker_nanny') {
    nextHeroine.corrode = Math.max(0, nextHeroine.corrode - 1);
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + 2);
  }

  // Maternal/Paternal Vanguard Escort: advance Neonatal Bio-Cradle survival turns
  let nextCradleObjective = combat.cradleObjective ? { ...combat.cradleObjective } : undefined;
  if (nextCradleObjective && nextCradleObjective.hp > 0) {
    nextCradleObjective.turnsSurvived += 1;
    if (
      !nextCradleObjective.liberated &&
      nextCradleObjective.turnsSurvived >= nextCradleObjective.targetTurns
    ) {
      nextCradleObjective.liberated = true;
      nextHeroine.overdrive = Math.min(100, nextHeroine.overdrive + 20);
    }
  }

  const nextTurn = combat.turn + 1;
  const heldBoard = combat.board.map((t) => ({
    ...t,
    isHeldFromPrevTurn: true,
    isHotPotato: undefined,
  }));
  const drawTarget = BOARD_CAPACITY + Math.max(0, nextHeroine.pendingUpcharge ?? 0);
  const drawn = drawToSix(
    heldBoard,
    combat.drawPile,
    combat.discardPile,
    run.seed,
    nextTurn,
    drawTarget,
  );
  nextHeroine.pendingUpcharge = 0;

  const currentNode = run.mapNodes.find((n) => n.id === combat.nodeId);
  const layer = currentNode?.layer ?? 0;

  // Process Loot Runner escape countdown & Bio-Husk corpse persistence / revival
  const hasNecroCatalyst = combat.enemies.some(
    (e) =>
      e.hp > 0 &&
      !e.escaped &&
      !e.propKind &&
      (e.archetype === 'boss' || e.archetype === 'spitter'),
  );

  let nextEnemies: EnemyUnit[] = combat.enemies.map((e) => {
    // 1. Loot Runner countdown
    if (e.hp > 0 && !e.escaped && e.isLootRunner) {
      const nextEscape = (e.escapeTurnsLeft ?? 3) - 1;
      if (nextEscape <= 0) {
        roundEndCues.push({
          id: `cue_${nextTurn}_escaped_${e.id}`,
          kind: 'enemy_telegraph',
          targetId: e.id,
          value: 0,
          textLabel: 'ESCAPED!',
        });
        return {
          ...e,
          hp: 0,
          escapeTurnsLeft: 0,
          escaped: true,
          turnDamageTaken: 0,
        };
      }
      return {
        ...e,
        escapeTurnsLeft: nextEscape,
        turnDamageTaken: 0,
      };
    }

    // 2. Bio-Husk revival countdown
    if (e.hp > 0 && e.propKind === 'bio_husk') {
      const nextRevive = (e.reviveTimer ?? 2) - 1;
      if (nextRevive <= 0) {
        const revArch = e.reviveArchetype ?? e.archetype;
        const tpl = ENEMY_TEMPLATES[revArch];
        const revMaxHp = e.reviveMaxHp ?? tpl.maxHp;
        const revivedHp = Math.max(6, Math.ceil(revMaxHp * 0.5));
        roundEndCues.push({
          id: `cue_${nextTurn}_revived_${e.id}`,
          kind: 'enemy_reinforce',
          targetId: e.id,
          value: revivedHp,
          textLabel: 'HUSK REVIVED!',
        });
        return {
          id: e.id,
          archetype: revArch,
          hp: revivedHp,
          maxHp: revMaxHp,
          armor: tpl.startingArmor,
          shieldPips: 0,
          maxShieldPips: tpl.startingShieldPips,
          passive: tpl.passive,
          roleColor: tpl.roleColor,
          intentCycle: tpl.intentCycle.map((intent) => ({ ...intent })),
          currentIntentIndex: 0,
          huskSpawned: true,
          isZeroReward: true,
          turnDamageTaken: 0,
        };
      }
      return {
        ...e,
        reviveTimer: nextRevive,
        turnDamageTaken: 0,
      };
    }

    // 3. Spawn Bio-Husk on dead non-prop unit when Boss is alive
    if (
      e.hp <= 0 &&
      !e.escaped &&
      !e.propKind &&
      !e.huskSpawned &&
      !e.isLootRunner &&
      !e.isMercyTarget &&
      hasNecroCatalyst &&
      combat.enemies.some((b) => b.hp > 0 && b.archetype === 'boss')
    ) {
      const husk = createPropUnit('bio_husk', e.id, {
        archetype: e.archetype,
        maxHp: e.maxHp,
      });
      return {
        ...husk,
        id: e.id,
        huskSpawned: true,
      };
    }

    return { ...e, turnDamageTaken: 0 };
  });

  // If a lone Loot Runner escaped and no hostile enemies remain, end combat in Victory
  if (!hasHostileLivingEnemies(nextEnemies)) {
    let victoryCombat: CombatState = {
      ...combat,
      turn: nextTurn,
      phase: 'VICTORY',
      board: drawn.board,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      enemies: nextEnemies,
      lastCues: roundEndCues,
      lastColorPlayed: null,
      cradleObjective: nextCradleObjective,
    };
    const victoryRewards = computeVictoryDirectorRewards(
      victoryCombat.rewardCredits,
      victoryCombat.turn,
      victoryCombat.director,
    );
    victoryCombat = {
      ...victoryCombat,
      rewardCredits: victoryRewards.totalCredits,
      rewardBreakdown: victoryRewards.breakdown,
      director: victoryRewards.director,
    };
    const transition = resolveCombatVictoryTransition(run, victoryCombat, nextHeroine);
    return {
      ...run,
      screen: transition.screen,
      heroine: transition.heroine,
      mapNodes: transition.mapNodes,
      combat: transition.combat,
      turnsCompleted: run.turnsCompleted + 1,
    };
  }

  let nextBoard = clearDeadCasterHexes(drawn.board, nextEnemies);
  let nextDirector = combat.director;
  let directorCues: AnimationCue[] = [];

  if (nextDirector) {
    const dirRes = advanceDirectorAtRoundEnd({
      director: nextDirector,
      enemies: nextEnemies,
      board: nextBoard,
      heroine: nextHeroine,
      nodeType: combat.nodeType,
      layer,
      currentTurn: combat.turn,
      seed: run.seed,
      difficultyTier: run.difficultyTier ?? 3,
    });
    nextDirector = dirRes.director;
    nextEnemies = dirRes.enemies;
    nextBoard = dirRes.board;
    directorCues = dirRes.cues;
  }

  // Targeted Tile Hex (Turn 2+): living Spitter / Boss marks 1 high-value Attack/Defense tile
  for (const enemy of nextEnemies) {
    if (enemy.hp <= 0 || enemy.escaped || enemy.propKind) continue;
    if (enemy.passive !== 'acid_jam' && enemy.archetype !== 'boss') continue;
    const alreadyHasHex = nextBoard.some((t) => t.hexedByEnemyId === enemy.id);
    if (alreadyHasHex) continue;

    const candidates = nextBoard
      .map((tile, idx) => ({ tile, idx }))
      .filter(({ tile }) => !tile.hexedByEnemyId && !tile.isJammed && !tile.isBlight);
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const aPref = a.tile.type === 'attack' || a.tile.type === 'defense' ? 1 : 0;
      const bPref = b.tile.type === 'attack' || b.tile.type === 'defense' ? 1 : 0;
      if (aPref !== bPref) return bPref - aPref;
      return b.tile.value - a.tile.value;
    });
    const target = candidates[0];
    nextBoard = nextBoard.map((t, idx) =>
      idx === target.idx ? { ...t, hexedByEnemyId: enemy.id } : t,
    );
    roundEndCues.push({
      id: `cue_${nextTurn}_hex_cast_${enemy.id}`,
      kind: 'tile_hex',
      targetId: enemy.id,
      textLabel: 'TILE HEXED',
    });
  }

  return {
    ...run,
    heroine: nextHeroine,
    combat: {
      ...combat,
      turn: nextTurn,
      phase: 'PLAYER_IDLE',
      board: nextBoard,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      enemies: nextEnemies,
      lastCues: [...roundEndCues, ...directorCues],
      director: nextDirector,
      lastColorPlayed: null,
      cradleObjective: nextCradleObjective,
    },
    turnsCompleted: run.turnsCompleted + 1,
  };
}

export function executeEnemyTurn(run: RunState): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
    return run;
  }

  let current = run;
  const accumulatedCues: AnimationCue[] = [];
  for (let i = 0; i < combat.enemies.length; i++) {
    if (
      !current.combat ||
      (current.combat.phase !== 'PLAYER_RESOLVED' && current.combat.phase !== 'ENEMY_ACTING')
    ) {
      break;
    }
    if (current.combat.enemies[i].hp <= 0) continue;
    current = executeSingleEnemyAction(current, i);
    if (current.combat?.lastCues) {
      accumulatedCues.push(...current.combat.lastCues);
    }
  }

  if (
    !current.combat ||
    (current.combat.phase !== 'PLAYER_RESOLVED' && current.combat.phase !== 'ENEMY_ACTING')
  ) {
    return current;
  }

  const advanced = advanceRoundAfterEnemies(current);
  if (!advanced.combat) return advanced;
  return {
    ...advanced,
    combat: {
      ...advanced.combat,
      lastCues: [...accumulatedCues, ...advanced.combat.lastCues],
    },
  };
}

function pickEquipmentChoices(
  seed: number,
  count = 2,
  ownedDefIds: readonly string[] = [],
  excludeDefIds: readonly string[] = [],
): string[] {
  if (DROPPABLE_EQUIPMENT_IDS.length === 0) return [];
  const ownedSet = new Set(ownedDefIds);
  const excludeSet = new Set(excludeDefIds);

  const freshUnowned = deterministicShuffle(
    DROPPABLE_EQUIPMENT_IDS.filter((id) => !ownedSet.has(id) && !excludeSet.has(id)),
    seed,
  );
  const freshOwned = deterministicShuffle(
    DROPPABLE_EQUIPMENT_IDS.filter((id) => ownedSet.has(id) && !excludeSet.has(id)),
    seed + 31,
  );
  const fallback = deterministicShuffle(
    DROPPABLE_EQUIPMENT_IDS.filter((id) => excludeSet.has(id)),
    seed + 67,
  );

  return [...freshUnowned, ...freshOwned, ...fallback].slice(0, count);
}

function acquireEquipment(
  run: RunState,
  defId: string,
  autoEquip = true,
): RunState {
  const def = EQUIPMENT_BY_ID[defId];
  if (!def) return run;

  const instanceId = `eq_${run.heroine.ownedEquipment.length + 1}_${defId}`;
  const nextOwned: OwnedEquipment[] = [
    ...run.heroine.ownedEquipment,
    { instanceId, defId },
  ];
  const nextEquipped = run.heroine.equippedInstanceIds.slice();
  const currentWeight = getEquippedEquipmentWeight(run.heroine);

  if (autoEquip && currentWeight + def.size <= run.heroine.carryCapacity) {
    nextEquipped.push(instanceId);
  }

  const nextHeroine: HeroineState = {
    ...run.heroine,
    ownedEquipment: nextOwned,
    equippedInstanceIds: nextEquipped,
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
  };
}

export function equipEquipmentInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (run.heroine.equippedInstanceIds.includes(instanceId)) return run;

  const owned = run.heroine.ownedEquipment.find((o) => o.instanceId === instanceId);
  if (!owned) return run;
  const def = EQUIPMENT_BY_ID[owned.defId];
  if (!def) return run;

  const currentWeight = getEquippedEquipmentWeight(run.heroine);
  if (currentWeight + def.size > run.heroine.carryCapacity) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    equippedInstanceIds: [...run.heroine.equippedInstanceIds, instanceId],
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
  };
}

export function unequipEquipmentInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (!run.heroine.equippedInstanceIds.includes(instanceId)) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    equippedInstanceIds: run.heroine.equippedInstanceIds.filter((id) => id !== instanceId),
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
  };
}

export function scrapEquipmentInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (run.heroine.equippedInstanceIds.includes(instanceId)) return run;

  const owned = run.heroine.ownedEquipment.find((o) => o.instanceId === instanceId);
  if (!owned) return run;
  const def = EQUIPMENT_BY_ID[owned.defId];
  if (!def) return run;

  const refundCredits = Math.floor(def.price * 0.5);
  const nextHeroine: HeroineState = {
    ...run.heroine,
    ownedEquipment: run.heroine.ownedEquipment.filter((o) => o.instanceId !== instanceId),
    credits: run.heroine.credits + refundCredits,
  };

  return {
    ...run,
    heroine: nextHeroine,
  };
}

export function startNodeEncounter(run: RunState, nodeId: string): RunState {
  const node: MapNode | undefined = run.mapNodes.find((n) => n.id === nodeId);
  if (!node) return run;

  // Suburban Dome Charter: passing through a layer with a chartered Family Estate grants +12 CR & +5 HP dividend
  let workingHeroine = { ...run.heroine };
  if (
    Array.isArray(workingHeroine.familyEstates) &&
    workingHeroine.familyEstates.includes(node.layer)
  ) {
    workingHeroine = {
      ...workingHeroine,
      credits: workingHeroine.credits + 12,
      hp: Math.min(workingHeroine.maxHp, workingHeroine.hp + 5),
    };
  }

  const ownedDefIds = workingHeroine.ownedEquipment.map((eq) => eq.defId);

  if (node.type === 'CYBER_CLINIC') {
    return {
      ...run,
      heroine: workingHeroine,
      currentNodeId: node.id,
      screen: 'clinic',
      clinicChoices: pickClinicChoices(workingHeroine.implants, run.seed + node.layer * 17),
      clinicShopChoices: [],
      clinicPurgeUsed: false,
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'CHIP_DEALER') {
    return {
      ...run,
      heroine: workingHeroine,
      currentNodeId: node.id,
      screen: 'chip_dealer',
      clinicChoices: [],
      clinicShopChoices: pickEquipmentChoices(run.seed + node.layer * 31 + 5, 3, ownedDefIds),
      clinicPurgeUsed: false,
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'MED_BAY') {
    return {
      ...run,
      heroine: workingHeroine,
      currentNodeId: node.id,
      screen: 'medbay',
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'EVENT') {
    const event = getCyberEventForNode(
      node,
      run.seed + node.layer * 23 + node.lane * 7,
      workingHeroine,
    );
    return {
      ...run,
      heroine: workingHeroine,
      currentNodeId: node.id,
      screen: 'event',
      activeEvent: event,
      combat: null,
    };
  }

  const initialPile = deterministicShuffle(
    run.masterPool.map((t) => ({ ...t, isHeldFromPrevTurn: false })),
    run.seed + node.layer * 41 + node.lane * 13,
  );
  const turn1ExtraDraw =
    (workingHeroine.nannyBotInstalled === 'tutor_nanny' ? 1 : 0) +
    (workingHeroine.activeTempoRule?.id === 'algo_rave_surge' ? 2 : 0);
  const drawn = drawToSix([], initialPile, [], run.seed, 1, BOARD_CAPACITY + turn1ExtraDraw);

  const difficultyTier = run.difficultyTier ?? 3;
  const diff = getDifficultyProfile(difficultyTier);

  let rewardCredits =
    node.type === 'ELITE' ? 60 : node.type === 'BOSS' ? 100 : 35;
  if (node.modifier === 'golden_bounty') {
    rewardCredits = Math.round(rewardCredits * 1.5);
  } else if (node.modifier === 'double_credits') {
    rewardCredits = rewardCredits * 2;
  }
  rewardCredits = Math.max(10, Math.round(rewardCredits * diff.creditYieldMultiplier));

  const rewardEquipmentChoices =
    node.type === 'BOSS'
      ? []
      : pickEquipmentChoices(
          run.seed + node.layer * 53 + node.lane * 19,
          node.type === 'ELITE' ? 3 : 2,
          ownedDefIds,
        );

  const enemies = buildEnemiesForNode(
    node.type,
    node.layer,
    run.seed,
    node.lane,
    node.modifier,
    difficultyTier,
    Boolean(node.isBreatherNode),
  );

  const combat: CombatState = {
    nodeId: node.id,
    nodeType: node.type,
    turn: 1,
    phase: 'PLAYER_IDLE',
    board: drawn.board,
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    enemies,
    lastCues: [],
    totalDamageDealt: 0,
    totalTilesResolved: 0,
    rewardCredits,
    rewardEquipmentChoices,
    director: createCombatDirector(node.type, node.layer, workingHeroine, difficultyTier),
    startingHeroHp: workingHeroine.hp,
    committedUndosUsed: 0,
    battleResetsUsed: 0,
    failedAttempts: 0,
    ...(node.type === 'ELITE'
      ? {
          cradleObjective: {
            name: 'Neonatal Bio-Cradle',
            hp: 18,
            maxHp: 18,
            turnsSurvived: 0,
            targetTurns: 4,
            liberated: false,
          },
        }
      : {}),
  };

  const heroSpec = getHeroSpec(workingHeroine.characterId);
  const startShieldBonus =
    (workingHeroine.nannyBotInstalled === 'guardian_nanny' ? 5 : 0) +
    (workingHeroine.activeTempoRule?.id === 'kids_vitality_boost' ? 4 : 0);
  const startOdBonus =
    workingHeroine.activeTempoRule?.id === 'kids_vitality_boost' ? 25 : 0;

  return {
    ...run,
    currentNodeId: node.id,
    screen: 'combat',
    activeEvent: null,
    clinicPurgeUsed: false,
    heroine: {
      ...workingHeroine,
      armor: heroSpec.startingArmor,
      shield: startShieldBonus,
      overdrive: Math.min(100, workingHeroine.overdrive + startOdBonus),
      corrode: 0,
      damageBoostPct: 0,
      pendingUpcharge: 0,
    },
    combat,
  };
}

function pickClinicChoices(owned: CyberImplantId[], seed: number): CyberImplantId[] {
  const available = CYBER_IMPLANT_IDS.filter((id) => !owned.includes(id));
  const pool = available.length >= 3 ? available : CYBER_IMPLANT_IDS;
  return deterministicShuffle(pool, seed).slice(0, 3);
}

export function buyClinicEquipment(run: RunState, defId: string): RunState {
  if (run.screen !== 'chip_dealer' && run.screen !== 'clinic') return run;
  if (!run.clinicShopChoices.includes(defId)) return run;
  const def = EQUIPMENT_BY_ID[defId];
  if (!def) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const effectivePrice = isFlashSale ? Math.max(10, Math.round(def.price * 0.65)) : def.price;

  if (run.heroine.credits < effectivePrice) return run;

  const afterCredits: RunState = {
    ...run,
    heroine: {
      ...run.heroine,
      credits: run.heroine.credits - effectivePrice,
    },
    clinicShopChoices: run.clinicShopChoices.filter((id) => id !== defId),
  };

  return acquireEquipment(afterCredits, defId, true);
}

export function restockClinicShop(run: RunState): RunState {
  if (run.screen !== 'chip_dealer' && run.screen !== 'clinic') return run;
  if (run.heroine.credits < CLINIC_RESTOCK_COST) return run;

  const ownedDefIds = run.heroine.ownedEquipment.map((eq) => eq.defId);
  const nextChoices = pickEquipmentChoices(
    run.seed + run.heroine.credits * 19 + run.score * 7 + run.clinicShopChoices.length * 13,
    3,
    ownedDefIds,
    run.clinicShopChoices,
  );

  return {
    ...run,
    heroine: {
      ...run.heroine,
      credits: run.heroine.credits - CLINIC_RESTOCK_COST,
    },
    clinicShopChoices: nextChoices,
  };
}

export function skipChipDealer(run: RunState): RunState {
  const nextHeroine = advanceNodeDynastyProgress(run.heroine);
  return {
    ...run,
    screen: 'map',
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
  };
}

export function purgeClinicInnateTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic' || run.clinicPurgeUsed) return run;
  if (run.heroine.credits < CLINIC_PURGE_COST) return run;
  if (run.masterPool.length <= 3) return run;

  const targetTile = run.masterPool.find((t) => t.id === tileId && t.sourceId === 'innate');
  if (!targetTile) return run;

  const prevPurged = run.heroine.purgedInnateIds ?? [];
  if (prevPurged.includes(tileId)) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - CLINIC_PURGE_COST,
    purgedInnateIds: [...prevPurged, tileId],
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    clinicPurgeUsed: true,
    score: run.score + 20,
  };
}

/**
 * Ectogenesis Nursery / Stork Clinic: places a tile into an artificial womb pod for 3 nodes.
 * While incubating, it leaves the active pool; after 3 nodes, it returns as a Next-Gen Prodigy tile
 * with 2x base stats and +1 UpCharge.
 */
export function incubateStorkTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic') return run;
  if (run.heroine.incubatingTile) return run;
  if (run.masterPool.length <= 4) return run;

  const targetTile = run.masterPool.find((t) => t.id === tileId);
  if (!targetTile) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 15;
  if (run.heroine.credits < cost) return run;

  const traits: Array<'upcharge' | 'pierce_boost' | 'shield_aura'> = [
    'upcharge',
    'pierce_boost',
    'shield_aura',
  ];
  const inheritedTrait = traits[Math.abs(run.seed + tileId.length) % traits.length];

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - cost,
    incubatingTile: {
      tile: { ...targetTile },
      nodesRemaining: 3,
      inheritedTrait,
    },
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    score: run.score + 25,
  };
}

/**
 * Gene-Splice Pedigree Lab: marries two distinct tile archetypes into a unified Family Crest.
 * Playing one archetype charges the married archetype (+2 flat value & +1 UpCharge on its next resolution).
 */
export function marryBloodlineCrest(
  run: RunState,
  primary: TileType,
  secondary: TileType,
): RunState {
  if (run.screen !== 'clinic' && run.screen !== 'medbay') return run;
  if (primary === secondary) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 20;
  if (run.heroine.credits < cost) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - cost,
    bloodlineCrest: {
      primary,
      secondary,
      bonusValue: 2,
    },
  };

  return {
    ...run,
    heroine: nextHeroine,
    score: run.score + 30,
  };
}

/**
 * Charter Academy / Upcycle Kiosk: enrolls an innate or Dud tile to educate it into a specialized
 * Prodigy tile (value 6+, +1 UpCharge, Dud removed) and buffs adjacent innate tiles by +1.
 */
export function enrollCharterProdigyTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic') return run;
  const targetTile = run.masterPool.find((t) => t.id === tileId && t.sourceId === 'innate');
  if (!targetTile) return run;

  const prevProdigies = run.heroine.prodigyTileIds ?? [];
  if (prevProdigies.includes(tileId)) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 15;
  if (run.heroine.credits < cost) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - cost,
    prodigyTileIds: [...prevProdigies, tileId],
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    score: run.score + 25,
  };
}

/**
 * Open-Source FabLab (Dual-Channel Tile Splicing): merges two tiles into one custom Dual-Channel Hybrid Tile
 * with combined value, +1 UpCharge, and a secondary channel effect on the 6-slot board.
 */
export function spliceFabLabTiles(
  run: RunState,
  targetTileId: string,
  consumedTileId: string,
): RunState {
  if (run.screen !== 'clinic') return run;
  if (targetTileId === consumedTileId) return run;
  if (run.masterPool.length <= 4) return run;

  const targetTile = run.masterPool.find((t) => t.id === targetTileId);
  const consumedTile = run.masterPool.find((t) => t.id === consumedTileId);
  if (!targetTile || !consumedTile) return run;

  const prevSplices = run.heroine.splicedTilePairs ?? [];
  if (
    prevSplices.some(
      (p) =>
        p.targetId === targetTileId ||
        p.consumedId === consumedTileId ||
        p.targetId === consumedTileId,
    )
  ) {
    return run;
  }

  const bonusValue = Math.max(3, Math.ceil(consumedTile.value * 0.75));
  const secondaryValue = Math.max(3, Math.ceil(consumedTile.value * 0.65));
  const nextHeroine: HeroineState = {
    ...run.heroine,
    splicedTilePairs: [
      ...prevSplices,
      {
        targetId: targetTileId,
        consumedId: consumedTileId,
        bonusValue,
        bonusUpcharge: 1,
        secondaryType: consumedTile.type !== targetTile.type ? consumedTile.type : undefined,
        secondaryValue,
      },
    ],
  };

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    score: run.score + 30,
  };
}

/**
 * Heirloom Forge: engraves an owned AI Skill Chip as a Family Heirloom.
 * Gains +1 stat per combat won this run and is saved to cross-run persistence for future runs.
 */
export function engraveHeirloom(run: RunState, targetDefId: string): RunState {
  const ownsTarget = run.heroine.ownedEquipment.some(
    (eq) => eq.defId === targetDefId || eq.instanceId === targetDefId,
  );
  if (!ownsTarget) return run;

  const resolvedDefId =
    run.heroine.ownedEquipment.find(
      (eq) => eq.defId === targetDefId || eq.instanceId === targetDefId,
    )?.defId ?? targetDefId;

  const nextStacks = Math.max(1, (run.heroine.heirloomStacks ?? 0) + 1);
  const nextHeroine: HeroineState = {
    ...run.heroine,
    heirloomEngravedId: resolvedDefId,
    heirloomStacks: nextStacks,
  };
  saveInheritedHeirloom(resolvedDefId, nextStacks);

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    score: run.score + 20,
  };
}

/**
 * Nanny-Bot Showroom: installs a persistent domestic automation bot in ChipDealerView.
 */
export function adoptNannyBot(run: RunState, botId: NannyBotId): RunState {
  if (run.screen !== 'chip_dealer') return run;
  if (run.heroine.nannyBotInstalled === botId) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'flash_sale' ? 16 : 25;
  if (run.heroine.credits < cost) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - cost,
    nannyBotInstalled: botId,
  };

  return {
    ...run,
    heroine: nextHeroine,
    score: run.score + 25,
  };
}

/**
 * Beta-Test Arcade: claims a free experimental AI Skill Chip for 2 combats.
 * Resolving 5+ tiles in combat logs bug telemetry and permanently upgrades the Master Tile Pool.
 */
export function startBetaTrialChip(run: RunState, defId?: string): RunState {
  if (run.screen !== 'chip_dealer') return run;
  if (run.heroine.betaTrialChip) return run;

  const chosenDefId =
    defId && EQUIPMENT_BY_ID[defId]
      ? defId
      : run.clinicShopChoices[0] ?? 'upcharge_pulse_chip';

  const withEq = acquireEquipment(run, chosenDefId, true);
  const nextHeroine: HeroineState = {
    ...withEq.heroine,
    betaTrialChip: {
      defId: chosenDefId,
      combatsRemaining: 2,
      resolvesLogged: 0,
      upgraded: false,
    },
  };

  return {
    ...withEq,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    score: withEq.score + 15,
  };
}

/**
 * Mesh-Net Relay Tower: active route manipulation on the Sector Map.
 * Connects the current cleared node to any target node in the next layer so the player can jump across branches.
 */
export function rerouteMeshNetNode(run: RunState, targetNodeId: string): RunState {
  const maxReroutes = run.mapNodes.length >= 17 ? 2 : 1;
  if ((run.heroine.meshReroutesUsed ?? 0) >= maxReroutes) return run;
  const targetNode = run.mapNodes.find((n) => n.id === targetNodeId);
  if (!targetNode || targetNode.cleared) return run;

  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : -1;
  if (targetNode.layer !== maxClearedLayer + 1) return run;

  const anchorNode =
    run.mapNodes.find((n) => n.id === run.currentNodeId && n.cleared) ??
    clearedNodes.find((n) => n.layer === maxClearedLayer);
  if (!anchorNode) return run;
  if (anchorNode.nextIds.includes(targetNodeId)) return run;

  const nextMapNodes = run.mapNodes.map((n) =>
    n.id === anchorNode.id ? { ...n, nextIds: [...n.nextIds, targetNodeId] } : n,
  );

  return {
    ...run,
    heroine: {
      ...run.heroine,
      meshReroutesUsed: (run.heroine.meshReroutesUsed ?? 0) + 1,
    },
    mapNodes: nextMapNodes,
    score: run.score + 15,
  };
}

/**
 * Suburban Dome Charter: invests 20 Credits to establish a Family Estate on a map tier,
 * granting +12 CR and +5 HP dividend whenever entering a node on that tier (plus immediate +5 HP).
 */
export function charterSuburbanEstate(run: RunState, layer?: number): RunState {
  const cost = 20;
  if (run.heroine.credits < cost) return run;

  const maxLayer = run.mapNodes.reduce((acc, n) => Math.max(acc, n.layer), 4);
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : 0;
  const targetLayer = layer ?? Math.min(maxLayer, maxClearedLayer + 1);

  const prevEstates = run.heroine.familyEstates ?? [];
  if (prevEstates.includes(targetLayer)) return run;

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - cost,
    hp: Math.min(run.heroine.maxHp, run.heroine.hp + 5),
    familyEstates: [...prevEstates, targetLayer],
  };

  return {
    ...run,
    heroine: nextHeroine,
    score: run.score + 20,
  };
}

/**
 * Mag-Lev Transit Hub (Express Line Skip): connects the current cleared node directly
 * to a node 2 stages ahead (layer + 2, before the Boss), granting +25 CR transit dividend
 * and advancing Stork Tile Incubation by 1 extra stage.
 */
export function rideMagLevExpress(run: RunState, targetNodeId?: string): RunState {
  if (run.heroine.maglevUsed) return run;

  const maxLayer = run.mapNodes.reduce((acc, n) => Math.max(acc, n.layer), 4);
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : -1;
  if (maxClearedLayer < 0) return run;

  const anchorNode =
    run.mapNodes.find((n) => n.id === run.currentNodeId && n.cleared) ??
    clearedNodes.find((n) => n.layer === maxClearedLayer);
  if (!anchorNode) return run;

  const expressLayer = Math.min(maxLayer - 1, anchorNode.layer + 2);
  if (expressLayer <= anchorNode.layer) return run;

  const candidates = run.mapNodes.filter((n) => n.layer === expressLayer && !n.cleared);
  if (candidates.length === 0) return run;

  const targetNode =
    (targetNodeId ? candidates.find((n) => n.id === targetNodeId) : undefined) ??
    candidates.find((n) => n.lane === anchorNode.lane) ??
    candidates[0];

  const nextMapNodes = run.mapNodes.map((n) =>
    n.id === anchorNode.id && !n.nextIds.includes(targetNode.id)
      ? { ...n, nextIds: [...n.nextIds, targetNode.id] }
      : n,
  );

  let nextHeroine: HeroineState = {
    ...run.heroine,
    maglevUsed: true,
    credits: run.heroine.credits + 25,
    corrode: Math.max(0, run.heroine.corrode - 2),
  };
  nextHeroine = advanceNodeDynastyProgress(nextHeroine);

  return {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    mapNodes: nextMapNodes,
    score: run.score + 30,
  };
}

export function switchActiveCyberEvent(run: RunState, eventId: string): RunState {
  if (run.screen !== 'event') return run;
  const allTemplates = [...CYBER_EVENT_TEMPLATES, ...DYNASTY_EVENT_TEMPLATES];
  const found = allTemplates.find((tpl) => tpl.id === eventId);
  if (!found) return run;
  return {
    ...run,
    activeEvent: {
      ...found,
      choices: found.choices.map((c) => ({ ...c })),
    },
  };
}

export function installCyberImplant(
  run: RunState,
  implantId: CyberImplantId,
  replaceImplantId?: CyberImplantId,
): RunState {
  let nextImplants = run.heroine.implants.slice();
  if (!nextImplants.includes(implantId)) {
    if (nextImplants.length < MAX_IMPLANTS) {
      nextImplants.push(implantId);
    } else if (replaceImplantId) {
      const idx = nextImplants.indexOf(replaceImplantId);
      if (idx !== -1) {
        nextImplants[idx] = implantId;
      } else {
        nextImplants = [...nextImplants.slice(0, MAX_IMPLANTS - 1), implantId];
      }
    }
  }

  const nextMapNodes = markNodeCleared(run.mapNodes, run.currentNodeId);
  const progressedHeroine = advanceNodeDynastyProgress({
    ...run.heroine,
    implants: nextImplants,
  });

  return {
    ...run,
    screen: 'map',
    heroine: progressedHeroine,
    masterPool: rebuildMasterPool(progressedHeroine),
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 40,
  };
}

export function skipCyberClinic(run: RunState): RunState {
  const progressedHeroine = advanceNodeDynastyProgress(run.heroine);
  return {
    ...run,
    screen: 'map',
    heroine: progressedHeroine,
    masterPool: rebuildMasterPool(progressedHeroine),
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
  };
}

export type MedBayActionKind =
  | 'heal'
  | 'calibrate_max_hp'
  | 'salvage_credits'
  | 'tile_overclock'
  | 'hearth_grandparents'
  | 'hearth_spouse'
  | 'hearth_kids';

export function applyMedBayAction(
  run: RunState,
  action: MedBayActionKind,
): RunState {
  if (action === 'tile_overclock' && (run.heroine.overclockCount ?? 0) >= MAX_OVERCLOCK_STACKS) {
    return run;
  }
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFundedClinic = currentNode?.modifier === 'funded_clinic';

  let nextHeroine: HeroineState = {
    ...run.heroine,
    consecutiveCombatWithoutClinic: 0, // Reset combat streak at clinic
  };
  const nextScreen: ScreenPhase = 'map';
  let scoreBonus = 30;

  if (action === 'heal') {
    nextHeroine = {
      ...nextHeroine,
      hp: Math.min(nextHeroine.maxHp, nextHeroine.hp + 22),
    };
  } else if (action === 'calibrate_max_hp') {
    const nextMax = nextHeroine.maxHp + 10;
    nextHeroine = {
      ...nextHeroine,
      maxHp: nextMax,
      hp: Math.min(nextMax, nextHeroine.hp + 10),
    };
  } else if (action === 'salvage_credits') {
    nextHeroine = {
      ...nextHeroine,
      credits: nextHeroine.credits + 35,
    };
  } else if (action === 'tile_overclock') {
    nextHeroine = {
      ...nextHeroine,
      overdrive: Math.min(100, nextHeroine.overdrive + 20),
      corrode: 0,
      overclockCount: Math.min(MAX_OVERCLOCK_STACKS, (nextHeroine.overclockCount ?? 0) + 1),
    };
    scoreBonus = 35;
  } else if (action === 'hearth_grandparents') {
    // Smart-Hearth Compound (Grandparents' Wisdom): educate a starter/Dud innate tile into a Prodigy & cleanse Corrode +12 HP
    const candidateInnate = run.masterPool.find(
      (t) =>
        t.sourceId === 'innate' &&
        !(nextHeroine.prodigyTileIds ?? []).includes(t.id),
    );
    nextHeroine = {
      ...nextHeroine,
      hp: Math.min(nextHeroine.maxHp, nextHeroine.hp + 12),
      corrode: 0,
      prodigyTileIds: candidateInnate
        ? [...(nextHeroine.prodigyTileIds ?? []), candidateInnate.id]
        : nextHeroine.prodigyTileIds,
      overclockCount: Math.min(MAX_OVERCLOCK_STACKS, (nextHeroine.overclockCount ?? 0) + 1),
    };
    scoreBonus = 40;
  } else if (action === 'hearth_spouse') {
    // Smart-Hearth Compound (Spouse Synergy): link Attack & Defense into a Bloodline Crest & restore +14 HP
    nextHeroine = {
      ...nextHeroine,
      hp: Math.min(nextHeroine.maxHp, nextHeroine.hp + 14),
      bloodlineCrest: nextHeroine.bloodlineCrest ?? {
        primary: 'attack',
        secondary: 'defense',
        bonusValue: 2,
      },
    };
    scoreBonus = 35;
  } else if (action === 'hearth_kids') {
    // Smart-Hearth Compound (The Kids' Vitality): restore +22 HP & burst energy/Overdrive for next 2 fights
    nextHeroine = {
      ...nextHeroine,
      hp: Math.min(nextHeroine.maxHp, nextHeroine.hp + 22),
      overdrive: Math.min(100, nextHeroine.overdrive + 25),
    };
    scoreBonus = 35;
  }

  if (isFundedClinic) {
    // Funded Clinic sponsorship: automatic +12 bonus repair (applied after calibrate_max_hp so maxHp raise isn't wasted)
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + 12);
  }

  nextHeroine = advanceNodeDynastyProgress(nextHeroine);
  if (action === 'hearth_kids') {
    nextHeroine = {
      ...nextHeroine,
      activeTempoRule: {
        id: 'kids_vitality_boost',
        nodesRemaining: 2,
      },
    };
  }
  const nextMasterPool = rebuildMasterPool(nextHeroine);

  return {
    ...run,
    screen: nextScreen,
    heroine: nextHeroine,
    masterPool: nextMasterPool,
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
    score: run.score + scoreBonus,
  };
}

export function resolveCyberEventChoice(run: RunState, choiceIndex: number): RunState {
  if (run.screen !== 'event' || !run.activeEvent) return run;
  const choice = run.activeEvent.choices[choiceIndex];
  if (!choice) return run;

  const costCredits = choice.costCredits ?? 0;
  const hpCost = choice.hpCost ?? 0;
  if (run.heroine.credits < costCredits) return run;
  if (run.heroine.hp <= hpCost && hpCost > 0) return run;

  let nextImplants = run.heroine.implants.slice();
  if (choice.rewardFreeImplant && nextImplants.length < MAX_IMPLANTS) {
    const unowned = CYBER_IMPLANT_IDS.filter((id) => !nextImplants.includes(id));
    if (unowned.length > 0) {
      nextImplants = [...nextImplants, unowned[Math.abs(run.seed + choiceIndex) % unowned.length]];
    }
  }

  let nextHeirloomId = run.heroine.heirloomEngravedId ?? null;
  let nextHeirloomStacks = run.heroine.heirloomStacks ?? 0;
  if (choice.rewardHeirloomStacks && choice.rewardHeirloomStacks > 0) {
    if (!nextHeirloomId && run.heroine.ownedEquipment.length > 0) {
      nextHeirloomId = run.heroine.ownedEquipment[0].defId;
    }
    nextHeirloomStacks += choice.rewardHeirloomStacks;
    if (nextHeirloomId) {
      saveInheritedHeirloom(nextHeirloomId, nextHeirloomStacks);
    }
  }

  let nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - costCredits + (choice.rewardCredits ?? 0),
    hp: Math.min(
      run.heroine.maxHp,
      Math.max(1, run.heroine.hp - hpCost + (choice.rewardHp ?? 0)),
    ),
    overdrive: Math.min(100, run.heroine.overdrive + (choice.rewardOverdrive ?? 0)),
    damageBoostPct: run.heroine.damageBoostPct + (choice.rewardDamageBoostPct ?? 0),
    nanites: (run.heroine.nanites ?? 0) + (choice.rewardNanites ?? 0),
    implants: nextImplants,
    heirloomEngravedId: nextHeirloomId,
    heirloomStacks: nextHeirloomStacks,
    ...(choice.rewardScionHouse ? { scionAlliedHouse: choice.rewardScionHouse } : {}),
  };

  nextHeroine = advanceNodeDynastyProgress(nextHeroine);
  if (choice.applyTempoRule) {
    nextHeroine = {
      ...nextHeroine,
      activeTempoRule: {
        id: choice.applyTempoRule,
        nodesRemaining: choice.applyTempoRule === 'algo_rave_surge' ? 3 : 2,
      },
    };
  }
  const nextMapNodes = markNodeCleared(run.mapNodes, run.currentNodeId);

  return {
    ...run,
    screen: 'map',
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
    activeEvent: null,
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 25,
  };
}

export function claimCombatEquipmentReward(run: RunState, chosenDefId: string | null): RunState {
  if (!run.combat || run.combat.phase !== 'VICTORY') return run;
  const combat = run.combat;
  const salvageBonus =
    chosenDefId === null && !combat.mandateBreachLootConfiscated ? 15 : 0;
  const naniteReward = computeCombatNaniteReward(combat, run.mapNodes);

  const diff = getDifficultyProfile(run.difficultyTier ?? 3);

  // Investment / Interest: +10% bonus credits per battle without clinic
  const streak = (run.heroine.consecutiveCombatWithoutClinic ?? 0) + 1;
  const streakBonusCredits = Math.min(25, Math.round(combat.rewardCredits * 0.10 * (streak - 1)));

  // Maternal/Paternal Vanguard Escort: keeping the Neonatal Bio-Cradle intact grants +25 CR & unlocks Dynasty Relic
  const cradleIntact =
    combat.nodeType === 'ELITE' &&
    Boolean(combat.cradleObjective && combat.cradleObjective.hp > 0);
  const cradleBonusCredits = cradleIntact ? 25 : 0;

  let nextHeroine: HeroineState = {
    ...run.heroine,
    credits:
      run.heroine.credits +
      combat.rewardCredits +
      salvageBonus +
      streakBonusCredits +
      cradleBonusCredits,
    nanites: (run.heroine.nanites ?? 0) + naniteReward,
    consecutiveCombatWithoutClinic: streak,
    ...(cradleIntact ? { dynastyRelicUnlocked: true } : {}),
  };

  // Heirloom Forge: engraved family heirloom gains +1 scaling power per combat won this run
  if (nextHeroine.heirloomEngravedId) {
    const engravedId = nextHeroine.heirloomEngravedId;
    const nextStacks = (nextHeroine.heirloomStacks ?? 0) + 1;
    nextHeroine = {
      ...nextHeroine,
      heirloomStacks: nextStacks,
    };
    saveInheritedHeirloom(engravedId, Math.max(1, Math.ceil(nextStacks / 2)));
  }

  // Emergency Defibrillator Safety Net: single-use +15% Max HP restoration when surviving an Elite with <= 15% HP
  if (
    combat.nodeType === 'ELITE' &&
    !nextHeroine.emergencyDefibUsed &&
    nextHeroine.hp <= Math.round(nextHeroine.maxHp * 0.15)
  ) {
    const defibHeal = Math.max(6, Math.round(nextHeroine.maxHp * 0.15));
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + defibHeal);
    nextHeroine.emergencyDefibUsed = true;
  }

  // Strategic Attrition Lever: Tier 1 restores full HP, Tier 2 restores +25% Max HP between puzzles
  if (diff.postCombatHealPct > 0 && nextHeroine.hp > 0) {
    const recovery = Math.ceil(nextHeroine.maxHp * diff.postCombatHealPct);
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + recovery);
  }

  nextHeroine = advanceNodeDynastyProgress(nextHeroine);

  let nextRun: RunState = {
    ...run,
    heroine: nextHeroine,
    masterPool: rebuildMasterPool(nextHeroine),
  };

  if (chosenDefId && combat.rewardEquipmentChoices.includes(chosenDefId)) {
    nextRun = acquireEquipment(nextRun, chosenDefId, true);
  }

  let nextMapNodes = markNodeCleared(nextRun.mapNodes, combat.nodeId);

  // Data Liberation / Vanguard Escort reward: liberate connected Clinic / MedBay / Chip Dealer nodes
  if (cradleIntact) {
    const eliteNode = nextMapNodes.find((n) => n.id === combat.nodeId);
    const liberatedIds = new Set(eliteNode?.nextIds ?? []);
    nextMapNodes = nextMapNodes.map((n) => {
      if (!liberatedIds.has(n.id)) return n;
      if (n.type === 'CYBER_CLINIC' || n.type === 'MED_BAY') {
        return { ...n, modifier: 'funded_clinic' };
      }
      if (n.type === 'CHIP_DEALER') {
        return { ...n, modifier: 'flash_sale' };
      }
      return n;
    });
  }

  if (combat.nodeType === 'ELITE') {
    return {
      ...nextRun,
      screen: 'clinic',
      mapNodes: nextMapNodes,
      clinicChoices: pickClinicChoices(
        nextRun.heroine.implants,
        nextRun.seed + combat.turn + 13,
      ),
      clinicShopChoices: [],
      clinicPurgeUsed: false,
      combat: null,
    };
  }

  return {
    ...nextRun,
    screen: 'map',
    mapNodes: nextMapNodes,
    combat: null,
  };
}

export function completeCombatRewardAndOpenMap(run: RunState): RunState {
  return claimCombatEquipmentReward(run, null);
}

/**
 * Tier 1 (Story / Sandbox) fail-safe: allows skipping a combat encounter after failed attempts
 * without advancing a Boss node into an un-cleared victory.
 */
export function skipCombatEncounter(run: RunState): RunState {
  const diff = getDifficultyProfile(run.difficultyTier ?? 3);
  if (diff.skipEncounterAfterFails === null || !run.combat) return run;
  if (run.combat.nodeType === 'BOSS') return run;

  const recovery = Math.ceil(run.heroine.maxHp * diff.postCombatHealPct);
  const nextHp =
    diff.postCombatHealPct > 0
      ? Math.min(run.heroine.maxHp, Math.max(1, run.heroine.hp) + recovery)
      : Math.max(1, run.heroine.hp);

  return {
    ...run,
    screen: 'map',
    heroine: {
      ...run.heroine,
      hp: nextHp,
      shield: 0,
      corrode: 0,
      damageBoostPct: 0,
      pendingUpcharge: 0,
    },
    mapNodes: markNodeCleared(run.mapNodes, run.combat.nodeId),
    combat: null,
  };
}

export function createInitialRun(
  seed = 104729,
  characterId: CharacterId = 'kira',
  difficultyTier: DifficultyTier = 3,
  inheritHeirloom = false,
): RunState {
  const diff = getDifficultyProfile(difficultyTier);
  const mapNodes = generateSectorMap(seed, difficultyTier);
  const startingEq = createStartingEquipment(characterId);
  const heroSpec = getHeroSpec(characterId);
  const scaledMaxHp = heroSpec.maxHp + diff.heroMaxHpDelta;

  const inherited = inheritHeirloom ? loadBestRecord().inheritedHeirloom : null;
  const starterHeirloomId = inherited
    ? startingEq.ownedEquipment[0]?.defId ?? inherited.defId
    : null;
  const starterHeirloomStacks = inherited ? Math.max(1, inherited.bonusStacks) : 0;

  const baseHeroine: HeroineState = {
    characterId,
    hp: scaledMaxHp,
    maxHp: scaledMaxHp,
    armor: heroSpec.startingArmor,
    shield: 0,
    overdrive: 0,
    corrode: 0,
    damageBoostPct: 0,
    pendingUpcharge: 0,
    implants: [],
    carryCapacity: heroSpec.carryCapacity,
    ownedEquipment: startingEq.ownedEquipment,
    equippedInstanceIds: startingEq.equippedInstanceIds,
    purgedInnateIds: [],
    credits: heroSpec.startingCredits,
    nanites: 0,
    consecutiveCombatWithoutClinic: 0,
    emergencyDefibUsed: false,
    overclockCount: 0,
    incubatingTile: null,
    maturedNextGenTiles: {},
    bloodlineCrest: null,
    prodigyTileIds: [],
    splicedTilePairs: [],
    heirloomEngravedId: starterHeirloomId,
    heirloomStacks: starterHeirloomStacks,
    nannyBotInstalled: null,
    betaTrialChip: null,
    activeTempoRule: null,
    familyEstates: [],
    meshReroutesUsed: 0,
    scionAlliedHouse: null,
    dynastyRelicUnlocked: false,
  };

  const baseRun: RunState = {
    runId: `run_${seed}_${Date.now()}`,
    seed,
    difficultyTier,
    runResetsUsed: 0,
    screen: 'combat',
    heroine: baseHeroine,
    masterPool: rebuildMasterPool(baseHeroine),
    mapNodes,
    currentNodeId: null,
    combat: null,
    clinicChoices: [],
    clinicShopChoices: [],
    clinicPurgeUsed: false,
    activeEvent: null,
    enemiesDefeated: 0,
    turnsCompleted: 0,
    score: 0,
  };

  return startNodeEncounter(baseRun, mapNodes[0].id);
}
