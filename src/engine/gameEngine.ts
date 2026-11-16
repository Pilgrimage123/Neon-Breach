import {
  BOARD_CAPACITY,
  CLINIC_PURGE_COST,
  CLINIC_RESTOCK_COST,
  CYBER_IMPLANT_IDS,
  DROPPABLE_EQUIPMENT_IDS,
  EQUIPMENT_BY_ID,
  MAX_IMPLANTS,
  MAX_OVERCLOCK_STACKS,
  MAX_UPCHARGE_BOARD_CAPACITY,
  buildEnemiesForNode,
  createBlightTile,
  createStartingEquipment,
  getEquippedEquipmentWeight,
  getHeroSpec,
  rebuildMasterPool,
} from './data';
import { getDifficultyProfile } from './difficulty';
import { generateSectorMap } from './mapGenerator';
import { getCyberEventForNode } from './cyberEvents';
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
} {
  if (combat.nodeType === 'BOSS') {
    const bossNanites = computeCombatNaniteReward(combat, run.mapNodes);
    return {
      screen: 'victory',
      mapNodes: markNodeCleared(run.mapNodes, combat.nodeId),
      heroine: {
        ...heroine,
        credits: heroine.credits + combat.rewardCredits,
        nanites: (heroine.nanites ?? 0) + bossNanites,
      },
    };
  }
  return {
    screen: run.screen,
    mapNodes: run.mapNodes,
    heroine,
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
  heroine: Pick<HeroineState, 'characterId' | 'implants'>,
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
    upchargeGained: 0,
    dudCount: 0,
  };

  if (!combat) {
    return emptyPreview;
  }

  const matching = combat.board.filter((t) => t.type === color && !t.isJammed);
  const cleanMatching = matching.filter((t) => !t.isBlight);
  const blightPurgeCount = color === 'tech' ? matching.filter((t) => t.isBlight).length : 0;
  const stayCount = combat.board.length - matching.length;
  const surgeTriggered = cleanMatching.length >= surgeThreshold;
  const dudCount = cleanMatching.filter((t) => Boolean(t.isDud)).length;
  const upchargeGained =
    cleanMatching.reduce((sum, t) => sum + (t.upcharge ?? 0), 0) +
    dudCount * heroSpec.dudUpchargePerTile;

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
    if (activeHexCasterIds.size === 0) {
      return { ...preview, hexedHealBonus: 0, hexedArmorBonus: 0 };
    }
    const sim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, preview);
    let survivingCasters = 0;
    for (const casterId of activeHexCasterIds) {
      if (sim.enemies.some((e) => e.id === casterId && e.hp > 0)) {
        survivingCasters++;
      }
    }
    return {
      ...preview,
      hexedHealBonus: survivingCasters * HEX_HEAL_AMOUNT,
      hexedArmorBonus: survivingCasters * HEX_ARMOR_AMOUNT,
    };
  };

  if (color === 'attack') {
    let baseDamage = 0;
    for (const tile of cleanMatching) {
      baseDamage += getEffectiveTileValue(tile, run.heroine).value;
    }
    const totalDamage = Math.floor(baseDamage * (1 + damageBoostPct / 100));
    const cleaveDamage = surgeTriggered ? Math.floor(totalDamage * 0.5) : 0;
    const armorPiercing = hasImplant(implants, 'piercing_katana');
    const retaliateDamage = (() => {
      if (surgeTriggered) return 0;
      const front = combat.enemies.find((e) => e.hp > 0);
      if (!front || front.passive !== 'spike_retaliate') return 0;
      const simHit = applyDamageToEnemy(front, totalDamage, armorPiercing ? 0.3 : 0, false);
      return simHit.defeated ? 0 : 3;
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
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: cleanMatching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: 0,
      armorShredAmount: 0,
      techPierceDamage: 0,
      cleanseCorrodeAmount: 0,
      retaliateDamage,
      blightPurgeCount,
      upchargeGained,
      dudCount,
    });
  }

  if (color === 'defense') {
    let rawShield = 0;
    for (const tile of cleanMatching) {
      rawShield += getEffectiveTileValue(tile, run.heroine).value;
    }
    const shieldGained = Math.max(0, rawShield - run.heroine.corrode);
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
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: cleanMatching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: riposteDamage + surgeReflect,
      armorShredAmount: 0,
      techPierceDamage: 0,
      cleanseCorrodeAmount: 0,
      retaliateDamage: 0,
      blightPurgeCount,
      upchargeGained,
      dudCount,
    });
  }

  // TECH
  let damageBoostAddedPct = 0;
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
export const SPIKE_RETALIATE_DAMAGE = 3;
export const STAGGER_BURST_THRESHOLD = 16;
export const BLIGHT_HOLD_CHIP_DAMAGE = 2;
export const HEX_HEAL_AMOUNT = 4;
export const HEX_ARMOR_AMOUNT = 3;
export const MAX_ACTIVE_BLIGHT_TILES = 2;
export const PHASE_GATE_ARMOR_BONUS = 10;

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
  const livingIds = new Set(enemies.filter((e) => e.hp > 0).map((e) => e.id));
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
  const livingBeforeCount = enemiesBefore.filter((e) => e.hp > 0).length;
  const livingAfterCount = enemiesAfter.filter((e) => e.hp > 0).length;
  const becameLoneSurvivor = livingBeforeCount >= 2 && livingAfterCount === 1;

  return enemiesAfter.map((after) => {
    if (after.hp <= 0) {
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

    // Broken Stance: single-turn burst >= 16 staggers Charge or Heavy attacks to 0 DMG recovery
    if (
      !nextEnemy.staggered &&
      nextTurnDmg >= STAGGER_BURST_THRESHOLD &&
      intent &&
      (intent.kind === 'charge' || intent.kind === 'heavy')
    ) {
      nextEnemy = {
        ...nextEnemy,
        staggered: true,
      };
      cues?.push({
        id: `cue_${turn}_stagger_${nextEnemy.id}`,
        kind: 'enemy_stagger',
        targetId: nextEnemy.id,
        value: nextTurnDmg,
        textLabel: 'STAGGERED',
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
): { enemies: EnemyUnit[]; extraDefeated: number; extraDamageDealt: number } {
  const nextEnemies = enemies.map((e) => ({ ...e }));
  const queue = [...newlyDefeatedIds];
  const processed = new Set<string>();
  let extraDefeated = 0;
  let extraDamageDealt = 0;

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    if (processed.has(sourceId)) continue;
    processed.add(sourceId);

    const sourceEnemy = nextEnemies.find((e) => e.id === sourceId);
    if (!sourceEnemy || sourceEnemy.passive !== 'volatile_burst') continue;

    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].id === sourceId || nextEnemies[i].hp <= 0) continue;
      const burstRes = applyDamageToEnemy(nextEnemies[i], VOLATILE_BURST_DAMAGE, 1.0, false);
      nextEnemies[i] = burstRes.enemy;
      extraDamageDealt += burstRes.effectiveDamageDealt;
      if (cues) {
        cues.push({
          id: `cue_${turn}_burst_${sourceId}_${nextEnemies[i].id}`,
          kind: 'enemy_burst',
          targetId: nextEnemies[i].id,
          value: VOLATILE_BURST_DAMAGE,
          textLabel: burstRes.pipCracked ? 'PIP CRACKED' : undefined,
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

  return { enemies: nextEnemies, extraDefeated, extraDamageDealt };
}

interface SimulatedPlayerEnemiesResult {
  enemies: EnemyUnit[];
  defeatedNow: number;
  newlyDefeatedIds: string[];
  damageDealt: number;
  retaliateDamage: number;
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

  const applyHit = (
    targetIdx: number,
    dmg: number,
    pierceRatio: number,
    breakArmorFirst: boolean,
    cueId: string,
    surgeFlag: boolean,
  ) => {
    const res = applyDamageToEnemy(nextEnemies[targetIdx], dmg, pierceRatio, breakArmorFirst);
    nextEnemies[targetIdx] = res.enemy;
    damageDealt += res.effectiveDamageDealt;
    cues?.push({
      id: cueId,
      kind: 'hero_slash',
      targetId: res.enemy.id,
      value: dmg,
      textLabel: res.pipCracked ? 'PIP CRACKED' : undefined,
      surge: surgeFlag,
    });
    if (res.phaseGateHit) {
      cues?.push({
        id: `cue_${turn}_phase_${res.enemy.id}`,
        kind: 'enemy_phase_gate',
        targetId: res.enemy.id,
        value: PHASE_GATE_ARMOR_BONUS,
      });
    }
    if (res.defeated) {
      defeatedNow++;
      newlyDefeatedIds.push(res.enemy.id);
      cues?.push({
        id: `cue_${turn}_ko_${res.enemy.id}`,
        kind: 'enemy_ko',
        targetId: res.enemy.id,
      });
    }
    return res;
  };

  const frontIdx = nextEnemies.findIndex((e) => e.hp > 0);
  if (preview.color === 'attack' && frontIdx !== -1) {
    const pierce = preview.armorPiercing ? 0.3 : 0;
    const frontResult = applyHit(
      frontIdx,
      preview.totalDamage,
      pierce,
      preview.surgeTriggered,
      `cue_${turn}_atk_front`,
      preview.surgeTriggered,
    );
    if (
      !frontResult.defeated &&
      !preview.surgeTriggered &&
      frontResult.enemy.passive === 'spike_retaliate'
    ) {
      retaliateDamage = SPIKE_RETALIATE_DAMAGE;
    }

    if (preview.cleaveDamage > 0) {
      for (let i = 0; i < nextEnemies.length; i++) {
        if (i === frontIdx || nextEnemies[i].hp <= 0) continue;
        applyHit(i, preview.cleaveDamage, pierce, false, `cue_${turn}_cleave_${i}`, true);
      }
    }
  } else if (preview.color === 'defense' && preview.reflectOnBlock > 0 && frontIdx !== -1) {
    applyHit(frontIdx, preview.reflectOnBlock, 0, false, `cue_${turn}_def_pulse`, true);
  } else if (preview.color === 'tech') {
    if (preview.armorShredAmount > 0) {
      nextEnemies = nextEnemies.map((enemy) =>
        enemy.hp > 0
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
      );
    }
  }

  if (newlyDefeatedIds.length > 0) {
    const burstRes = triggerVolatileBursts(nextEnemies, newlyDefeatedIds, turn, cues);
    nextEnemies = burstRes.enemies;
    defeatedNow += burstRes.extraDefeated;
    damageDealt += burstRes.extraDamageDealt;
  }

  nextEnemies = evaluateReactiveEnemyShifts(enemies, nextEnemies, turn, cues);

  return {
    enemies: nextEnemies,
    defeatedNow,
    newlyDefeatedIds,
    damageDealt,
    retaliateDamage,
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
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (isDamagingIntent(intent)) {
      baselineIncoming += getEffectiveEnemyIntentValue(enemy, intent);
    }
  }

  let simEnemies = combat.enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;
  let retaliateDamage = 0;

  if (activePreview && activePreview.tileCount > 0) {
    const simResult = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, activePreview);
    simEnemies = simResult.enemies;
    defeatedNow = simResult.defeatedNow;
    retaliateDamage = simResult.retaliateDamage;
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
  let corrodeGained = 0;
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

  for (let i = 0; i < simEnemies.length; i++) {
    const enemy = simEnemies[i];
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!isDamagingIntent(intent) || enemy.staggered) continue;

    attackersCount++;
    const intentCtx = { shieldAfterPlayer: simShield, colorPlayed };
    const incoming = getEffectiveEnemyIntentValue(enemy, intent, intentCtx);
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
    }
  }

  // Caustic Slag hold chip damage if not purged via TECH
  const unpurgedBlightCount = combat.board.filter(
    (t) => t.isBlight && (colorPlayed !== 'tech' || t.isJammed),
  ).length;
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

  const projectedHp = Math.max(0, hpBeforeEnemies - hpDamageTaken);
  const hpLossOnBar = Math.max(0, heroine.hp - projectedHp);
  const preventedDamageByKills = Math.max(
    0,
    baselineIncoming - (rawIncomingDamage - retaliateDamage - blightChipDamage),
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
    hexHealTriggered,
  };
}

export function resolvePlayerColor(run: RunState, color: TileType): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  const preview = previewColorResolution(run, color);
  if (preview.tileCount === 0) return run;

  const combat = run.combat;
  const resolvedTiles = combat.board.filter((t) => t.type === color && !t.isJammed);
  let keptTiles: Tile[] = combat.board
    .filter((t) => t.type !== color || t.isJammed)
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
      })),
  ];

  let nextHeroine = { ...run.heroine };
  if ((preview.upchargeGained ?? 0) > 0) {
    nextHeroine.pendingUpcharge = (nextHeroine.pendingUpcharge ?? 0) + (preview.upchargeGained ?? 0);
  }
  const cues: AnimationCue[] = [];

  if (color === 'defense') {
    nextHeroine.shield += preview.shieldGained;
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
    const frontEnemy = nextEnemies.find((e) => e.hp > 0);
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
        hpDamage: retHpDmg,
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
      if (enemy.hp <= 0 || !triggeredHexCasterIds.has(enemy.id)) return enemy;
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

  nextHeroine.overdrive = Math.min(100, nextHeroine.overdrive + preview.overdriveGained);

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

  const anyLivingEnemy = nextEnemies.some((e) => e.hp > 0);
  const nextPhase = anyLivingEnemy ? 'PLAYER_RESOLVED' : 'VICTORY';

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
    director: directorActionUpdate.director,
    lastColorPlayed: color,
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
    : { screen: run.screen, mapNodes: run.mapNodes, heroine: nextHeroine };

  const damageAdded = totalDamageDealt - combat.totalDamageDealt;
  const rewardedKills = nextEnemies.filter(
    (e, idx) => e.hp <= 0 && combat.enemies[idx]?.hp > 0 && !e.isZeroReward,
  ).length;
  const scoreKillCount = defeatedNow > 0 ? Math.min(defeatedNow, Math.max(rewardedKills, 0)) : 0;

  return {
    ...run,
    screen: transition.screen,
    heroine: transition.heroine,
    mapNodes: transition.mapNodes,
    combat: updatedCombat,
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
    if (enemy.hp <= 0) return { ...enemy };
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

  const anyLiving = nextEnemies.some((e) => e.hp > 0);
  const nextPhase = anyLiving ? 'PLAYER_IDLE' : 'VICTORY';

  // Overdrive cleanses Jams, Hexes, AND exhausts board Caustic Slag tiles cleanly
  const cleansedBoard = combat.board
    .filter((t) => !t.isBlight)
    .map((t) => ({ ...t, isJammed: false, hexedByEnemyId: undefined }));

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
    : { screen: run.screen, mapNodes: run.mapNodes, heroine: nextHeroine };

  return {
    ...run,
    screen: transition.screen,
    heroine: transition.heroine,
    mapNodes: transition.mapNodes,
    combat: updatedOdCombat,
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
  if (!enemy || enemy.hp <= 0) return run;

  const nextHeroine = { ...run.heroine };
  const implants = nextHeroine.implants;
  const cues: AnimationCue[] = [];
  let defeatedNow = 0;
  const newlyDefeatedIds: string[] = [];
  let nextBoard = combat.board.map((t) => ({ ...t }));
  let nextDiscardPile = combat.discardPile.map((t) => ({ ...t }));

  const intent = enemy.intentCycle[enemy.currentIntentIndex];
  const nextIndexOnStagger =
    intent.kind === 'charge'
      ? 0
      : (enemy.currentIntentIndex + 1) % enemy.intentCycle.length;
  const updatedEnemy: EnemyUnit = {
    ...enemy,
    currentIntentIndex: enemy.staggered
      ? nextIndexOnStagger
      : (enemy.currentIntentIndex + 1) % enemy.intentCycle.length,
    staggered: false,
    turnDamageTaken: 0,
  };

  let reflectedDamage = 0;
  let bolsterAllAmount = 0;

  if (enemy.staggered) {
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_stagger_recover`,
      kind: 'enemy_stagger',
      targetId: enemy.id,
      value: 0,
      textLabel: 'STAGGERED · 0 DMG',
    });
  } else if (intent.kind === 'armor') {
    updatedEnemy.armor += intent.value;
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_armor`,
      kind: 'enemy_armor',
      targetId: enemy.id,
      value: intent.value,
    });
  } else if (intent.kind === 'bolster') {
    bolsterAllAmount = intent.value;
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_bolster`,
      kind: 'enemy_bolster',
      targetId: enemy.id,
      value: intent.value,
      textLabel: `+${intent.value} ARM ALL`,
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
    });
    const abs = absorbHeroDamage(nextHeroine.shield, nextHeroine.armor ?? 0, incoming);
    nextHeroine.shield = abs.nextShield;
    nextHeroine.armor = abs.nextArmor;
    const blocked = abs.blockedByShield + abs.blockedByArmor;
    const hpDamage = abs.hpDamage;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - hpDamage);

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
        // Deck Polluter: inject up to MAX_ACTIVE_BLIGHT_TILES Caustic Slag into discardPile
        const blightInCombat =
          countTotalBlightTiles({
            board: nextBoard,
            drawPile: combat.drawPile,
            discardPile: nextDiscardPile,
          });
        if (blightInCombat < MAX_ACTIVE_BLIGHT_TILES) {
          nextDiscardPile.push(
            createBlightTile(combat.turn, combat.totalTilesResolved + enemyIndex + blightInCombat + 1),
          );
          cues.push({
            id: `cue_e_${combat.turn}_${enemy.id}_blight`,
            kind: 'tile_blight',
            targetId: enemy.id,
            textLabel: 'CAUSTIC SLAG',
          });
        }
      }
      cues.push({
        id: `cue_e_${combat.turn}_${enemy.id}_acid`,
        kind: 'enemy_acid',
        targetId: enemy.id,
        value: incoming,
        blocked,
        hpDamage,
        reflectedDamage,
        textLabel: jammedTile ? 'TILE JAMMED' : undefined,
      });
    } else {
      cues.push({
        id: `cue_e_${combat.turn}_${enemy.id}_atk`,
        kind: 'enemy_attack',
        targetId: enemy.id,
        value: incoming,
        blocked,
        hpDamage,
        reflectedDamage,
      });
    }

    if (intent.kind === 'leech' && hpDamage > 0 && updatedEnemy.hp > 0) {
      const healAmt = intent.secondaryValue ?? 4;
      updatedEnemy.hp = Math.min(updatedEnemy.maxHp, updatedEnemy.hp + healAmt);
    }
  }

  let nextEnemies = combat.enemies.map((e, idx) => {
    const baseUnit = idx === enemyIndex ? updatedEnemy : { ...e };
    if (bolsterAllAmount > 0 && baseUnit.hp > 0) {
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
        discardPile: nextDiscardPile,
        enemies: nextEnemies,
        lastCues: cues,
        totalDamageDealt,
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

  const anyLiving = nextEnemies.some((e) => e.hp > 0);
  if (!anyLiving) {
    let victoryCombat: CombatState = {
      ...combat,
      phase: 'VICTORY',
      board: nextBoard,
      discardPile: nextDiscardPile,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
      director: directorReflectUpdate.director,
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
      combat: victoryCombat,
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
      discardPile: nextDiscardPile,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
      director: directorReflectUpdate.director,
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

  const nextTurn = combat.turn + 1;
  const heldBoard = combat.board.map((t) => ({ ...t, isHeldFromPrevTurn: true }));
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

  let nextEnemies: EnemyUnit[] = combat.enemies.map((e) => ({ ...e, turnDamageTaken: 0 }));
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
    if (enemy.hp <= 0) continue;
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

  const ownedDefIds = run.heroine.ownedEquipment.map((eq) => eq.defId);

  if (node.type === 'CYBER_CLINIC') {
    return {
      ...run,
      currentNodeId: node.id,
      screen: 'clinic',
      clinicChoices: pickClinicChoices(run.heroine.implants, run.seed + node.layer * 17),
      clinicShopChoices: [],
      clinicPurgeUsed: false,
      combat: null,
      activeEvent: null,
    };
  }

  if (node.type === 'CHIP_DEALER') {
    return {
      ...run,
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
      run.heroine,
    );
    return {
      ...run,
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
  const drawn = drawToSix([], initialPile, [], run.seed, 1);

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
    director: createCombatDirector(node.type, node.layer, run.heroine, difficultyTier),
  };

  const heroSpec = getHeroSpec(run.heroine.characterId);
  return {
    ...run,
    currentNodeId: node.id,
    screen: 'combat',
    activeEvent: null,
    clinicPurgeUsed: false,
    heroine: {
      ...run.heroine,
      armor: heroSpec.startingArmor,
      shield: 0,
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
  return {
    ...run,
    screen: 'map',
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

  return {
    ...run,
    screen: 'map',
    heroine: {
      ...run.heroine,
      implants: nextImplants,
    },
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 40,
  };
}

export function skipCyberClinic(run: RunState): RunState {
  return {
    ...run,
    screen: 'map',
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
  };
}

export function applyMedBayAction(
  run: RunState,
  action: 'heal' | 'calibrate_max_hp' | 'salvage_credits' | 'tile_overclock',
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
  let nextMasterPool = run.masterPool;
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
    nextMasterPool = rebuildMasterPool(nextHeroine);
    scoreBonus = 35;
  }

  if (isFundedClinic) {
    // Funded Clinic sponsorship: automatic +12 bonus repair (applied after calibrate_max_hp so maxHp raise isn't wasted)
    nextHeroine.hp = Math.min(nextHeroine.maxHp, nextHeroine.hp + 12);
  }

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

  const nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits - costCredits + (choice.rewardCredits ?? 0),
    hp: Math.min(
      run.heroine.maxHp,
      Math.max(1, run.heroine.hp - hpCost + (choice.rewardHp ?? 0)),
    ),
    overdrive: Math.min(100, run.heroine.overdrive + (choice.rewardOverdrive ?? 0)),
    damageBoostPct: run.heroine.damageBoostPct + (choice.rewardDamageBoostPct ?? 0),
    nanites: (run.heroine.nanites ?? 0) + (choice.rewardNanites ?? 0),
  };

  const nextMapNodes = markNodeCleared(run.mapNodes, run.currentNodeId);

  return {
    ...run,
    screen: 'map',
    heroine: nextHeroine,
    activeEvent: null,
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 25,
  };
}

export function claimCombatEquipmentReward(run: RunState, chosenDefId: string | null): RunState {
  if (!run.combat || run.combat.phase !== 'VICTORY') return run;
  const combat = run.combat;
  const salvageBonus = chosenDefId === null ? 15 : 0;
  const naniteReward = computeCombatNaniteReward(combat, run.mapNodes);

  const diff = getDifficultyProfile(run.difficultyTier ?? 3);

  // Investment / Interest: +10% bonus credits per battle without clinic
  const streak = (run.heroine.consecutiveCombatWithoutClinic ?? 0) + 1;
  const streakBonusCredits = Math.min(25, Math.round(combat.rewardCredits * 0.10 * (streak - 1)));

  let nextHeroine: HeroineState = {
    ...run.heroine,
    credits: run.heroine.credits + combat.rewardCredits + salvageBonus + streakBonusCredits,
    nanites: (run.heroine.nanites ?? 0) + naniteReward,
    consecutiveCombatWithoutClinic: streak,
  };

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

  let nextRun: RunState = {
    ...run,
    heroine: nextHeroine,
  };

  if (chosenDefId && combat.rewardEquipmentChoices.includes(chosenDefId)) {
    nextRun = acquireEquipment(nextRun, chosenDefId, true);
  }

  const nextMapNodes = markNodeCleared(nextRun.mapNodes, combat.nodeId);

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
): RunState {
  const mapNodes = generateSectorMap(seed);
  const startingEq = createStartingEquipment(characterId);
  const heroSpec = getHeroSpec(characterId);
  const baseHeroine: HeroineState = {
    characterId,
    hp: heroSpec.maxHp,
    maxHp: heroSpec.maxHp,
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
