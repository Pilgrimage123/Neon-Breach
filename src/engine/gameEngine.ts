import {
  BOARD_CAPACITY,
  CYBER_IMPLANT_IDS,
  DROPPABLE_EQUIPMENT_IDS,
  EQUIPMENT_BY_ID,
  KIRA_CARRY_CAPACITY,
  MAX_IMPLANTS,
  STARTING_CREDITS,
  buildEnemiesForNode,
  createStartingEquipment,
  getEquippedEquipmentWeight,
  rebuildMasterPool,
} from './data';
import { generateSectorMap } from './mapGenerator';
import type {
  AnimationCue,
  CombatState,
  CyberImplantId,
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

function resolveCombatVictoryTransition(
  run: RunState,
  combat: CombatState,
): {
  screen: ScreenPhase;
  mapNodes: MapNode[];
} {
  if (combat.nodeType === 'BOSS') {
    return {
      screen: 'victory',
      mapNodes: markNodeCleared(run.mapNodes, combat.nodeId),
    };
  }
  return {
    screen: run.screen,
    mapNodes: run.mapNodes,
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

export function drawToSix(
  board: Tile[],
  drawPile: Tile[],
  discardPile: Tile[],
  seed: number,
  turn: number,
): { board: Tile[]; drawPile: Tile[]; discardPile: Tile[] } {
  const nextBoard = board.map((tile) => ({ ...tile }));
  let nextDraw = drawPile.map((tile) => ({ ...tile }));
  let nextDiscard = discardPile.map((tile) => ({ ...tile }));

  const needed = Math.max(0, BOARD_CAPACITY - nextBoard.length);
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

export function previewColorResolution(run: RunState, color: TileType): TurnPreview {
  const combat = run.combat;
  const implants = run.heroine.implants;
  const surgeThreshold = getSurgeThreshold(implants);
  const damageBoostPct = run.heroine.damageBoostPct;

  if (!combat) {
    return {
      color,
      tileCount: 0,
      stayCount: 0,
      baseDamage: 0,
      damageBoostPct,
      totalDamage: 0,
      cleaveDamage: 0,
      armorPiercing: hasImplant(implants, 'piercing_katana'),
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: 0,
      surgeTriggered: false,
      surgeThreshold,
      reflectOnBlock: 0,
    };
  }

  const matching = combat.board.filter((t) => t.type === color);
  const stayCount = combat.board.length - matching.length;
  const surgeTriggered = matching.length >= surgeThreshold;

  if (matching.length === 0) {
    return {
      color,
      tileCount: 0,
      stayCount,
      baseDamage: 0,
      damageBoostPct,
      totalDamage: 0,
      cleaveDamage: 0,
      armorPiercing: hasImplant(implants, 'piercing_katana'),
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: 0,
      surgeTriggered: false,
      surgeThreshold,
      reflectOnBlock: 0,
    };
  }

  if (color === 'attack') {
    let baseDamage = 0;
    for (const tile of matching) {
      let dmg = tile.value;
      if (hasImplant(implants, 'plasma_amp')) dmg += 2;
      if (hasImplant(implants, 'monowire_edge') && tile.isHeldFromPrevTurn) dmg += 2;
      baseDamage += dmg;
    }
    const totalDamage = Math.floor(baseDamage * (1 + damageBoostPct / 100));
    const cleaveDamage = surgeTriggered ? Math.floor(totalDamage * 0.5) : 0;
    return {
      color,
      tileCount: matching.length,
      stayCount,
      baseDamage,
      damageBoostPct,
      totalDamage,
      cleaveDamage,
      armorPiercing: hasImplant(implants, 'piercing_katana'),
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: matching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: 0,
    };
  }

  if (color === 'defense') {
    let rawShield = 0;
    for (const tile of matching) {
      let sh = tile.value;
      if (hasImplant(implants, 'nano_weave')) sh += 2;
      rawShield += sh;
    }
    const shieldGained = Math.max(0, rawShield - run.heroine.corrode);
    return {
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
      overdriveGained: matching.length * 4,
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: surgeTriggered ? 6 : 0,
    };
  }

  // TECH
  let damageBoostAddedPct = 0;
  let healAmount = 0;
  for (const tile of matching) {
    if (tile.techEffect?.kind === 'damage_boost') {
      damageBoostAddedPct += tile.techEffect.percent;
    } else if (tile.techEffect?.kind === 'heal') {
      healAmount += tile.techEffect.amount;
    }
  }

  let overdriveGained = matching.length * 15;
  if (hasImplant(implants, 'flux_injector')) {
    overdriveGained += 10;
  }
  if (surgeTriggered) {
    overdriveGained += 15;
  }

  const synapseShield = hasImplant(implants, 'synapse_overclock') ? matching.length * 3 : 0;
  const surgeShield = surgeTriggered ? 6 : 0;

  return {
    color,
    tileCount: matching.length,
    stayCount,
    baseDamage: 0,
    damageBoostPct,
    totalDamage: 0,
    cleaveDamage: 0,
    armorPiercing: false,
    shieldGained: synapseShield + surgeShield,
    damageBoostAddedPct,
    healAmount,
    overdriveGained,
    surgeTriggered,
    surgeThreshold,
    reflectOnBlock: 0,
  };
}

function applyDamageToEnemy(
  enemy: EnemyUnit,
  damage: number,
  pierceRatio: number,
  breakArmorFirst: boolean,
): { enemy: EnemyUnit; hpDamageDealt: number; defeated: boolean } {
  if (enemy.hp <= 0 || damage <= 0) {
    return { enemy: { ...enemy }, hpDamageDealt: 0, defeated: false };
  }

  let nextArmor = breakArmorFirst ? 0 : enemy.armor;
  let nextHp = enemy.hp;

  const piercingDmg = Math.floor(damage * pierceRatio);
  const regularDmg = damage - piercingDmg;

  const absorbed = Math.min(nextArmor, regularDmg);
  nextArmor -= absorbed;
  const remainingRegular = regularDmg - absorbed;
  const totalHpLoss = remainingRegular + piercingDmg;
  nextHp = Math.max(0, nextHp - totalHpLoss);

  return {
    enemy: {
      ...enemy,
      armor: nextArmor,
      hp: nextHp,
    },
    hpDamageDealt: totalHpLoss,
    defeated: nextHp <= 0,
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
      hpBeforeEnemies: heroine.hp,
      projectedHp: heroine.hp,
      corrodeGained: 0,
      attackersCount: 0,
      preventedDamageByKills: 0,
      willDie: false,
    };
  }

  let baselineIncoming = 0;
  for (let i = 0; i < combat.enemies.length; i++) {
    const enemy = combat.enemies[i];
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (intent && intent.kind !== 'armor') {
      baselineIncoming += intent.value;
    }
  }

  const simEnemies = combat.enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;

  if (activePreview && activePreview.tileCount > 0) {
    const frontIdx = simEnemies.findIndex((e) => e.hp > 0);
    if (activePreview.color === 'attack' && frontIdx !== -1) {
      const pierce = activePreview.armorPiercing ? 0.3 : 0;
      const frontRes = applyDamageToEnemy(
        simEnemies[frontIdx],
        activePreview.totalDamage,
        pierce,
        activePreview.surgeTriggered,
      );
      simEnemies[frontIdx] = frontRes.enemy;
      if (frontRes.defeated) defeatedNow++;

      if (activePreview.cleaveDamage > 0) {
        for (let i = 0; i < simEnemies.length; i++) {
          if (i === frontIdx || simEnemies[i].hp <= 0) continue;
          const cleaveRes = applyDamageToEnemy(
            simEnemies[i],
            activePreview.cleaveDamage,
            pierce,
            false,
          );
          simEnemies[i] = cleaveRes.enemy;
          if (cleaveRes.defeated) defeatedNow++;
        }
      }
    } else if (
      activePreview.color === 'defense' &&
      activePreview.reflectOnBlock > 0 &&
      frontIdx !== -1
    ) {
      const res = applyDamageToEnemy(
        simEnemies[frontIdx],
        activePreview.reflectOnBlock,
        0,
        false,
      );
      simEnemies[frontIdx] = res.enemy;
      if (res.defeated) defeatedNow++;
    }
  }

  const bioSiphonHeal =
    defeatedNow > 0 && hasImplant(heroine.implants, 'bio_siphon') ? defeatedNow * 4 : 0;
  const healGained =
    (activePreview && activePreview.tileCount > 0 ? activePreview.healAmount : 0) + bioSiphonHeal;
  const hpBeforeEnemies = Math.min(heroine.maxHp, heroine.hp + healGained);
  const shieldAfterPlayer =
    heroine.shield +
    (activePreview && activePreview.tileCount > 0 ? activePreview.shieldGained : 0);

  let simShield = shieldAfterPlayer;
  let rawIncomingDamage = 0;
  let blockedDamage = 0;
  let hpDamageTaken = 0;
  let corrodeGained = 0;
  let attackersCount = 0;

  for (let i = 0; i < simEnemies.length; i++) {
    const enemy = simEnemies[i];
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!intent || intent.kind === 'armor') continue;

    attackersCount++;
    const incoming = intent.value;
    rawIncomingDamage += incoming;
    const blocked = Math.min(simShield, incoming);
    simShield -= blocked;
    blockedDamage += blocked;
    const hpDmg = incoming - blocked;
    hpDamageTaken += hpDmg;
    if (intent.kind === 'acid') {
      corrodeGained += intent.secondaryValue ?? 2;
    }
  }

  const projectedHp = Math.max(0, hpBeforeEnemies - hpDamageTaken);
  const hpLossOnBar = Math.max(0, heroine.hp - projectedHp);
  const preventedDamageByKills = Math.max(0, baselineIncoming - rawIncomingDamage);
  const willDie = heroine.hp > 0 && hpDamageTaken > 0 && projectedHp <= 0;

  return {
    rawIncomingDamage,
    blockedDamage,
    hpDamageTaken,
    hpLossOnBar,
    healGained,
    shieldAfterPlayer,
    shieldAfterEnemies: simShield,
    hpBeforeEnemies,
    projectedHp,
    corrodeGained,
    attackersCount,
    preventedDamageByKills,
    willDie,
  };
}

export function resolvePlayerColor(run: RunState, color: TileType): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  const preview = previewColorResolution(run, color);
  if (preview.tileCount === 0) return run;

  const combat = run.combat;
  const resolvedTiles = combat.board.filter((t) => t.type === color);
  const keptTiles = combat.board
    .filter((t) => t.type !== color)
    .map((t) => ({ ...t }));

  const nextDiscard = [
    ...combat.discardPile.map((t) => ({ ...t })),
    ...resolvedTiles.map((t) => ({ ...t, isHeldFromPrevTurn: false })),
  ];

  let nextEnemies = combat.enemies.map((e) => ({ ...e }));
  const nextHeroine = { ...run.heroine };
  const cues: AnimationCue[] = [];
  let totalDamageDealt = combat.totalDamageDealt;
  let defeatedNow = 0;

  if (color === 'attack') {
    const frontIdx = nextEnemies.findIndex((e) => e.hp > 0);
    if (frontIdx !== -1) {
      const pierce = preview.armorPiercing ? 0.3 : 0;
      const frontResult = applyDamageToEnemy(
        nextEnemies[frontIdx],
        preview.totalDamage,
        pierce,
        preview.surgeTriggered,
      );
      nextEnemies[frontIdx] = frontResult.enemy;
      totalDamageDealt += preview.totalDamage;
      cues.push({
        id: `cue_${combat.turn}_atk_front`,
        kind: 'hero_slash',
        targetId: frontResult.enemy.id,
        value: preview.totalDamage,
        surge: preview.surgeTriggered,
      });
      if (frontResult.defeated) {
        defeatedNow++;
        cues.push({
          id: `cue_${combat.turn}_ko_${frontResult.enemy.id}`,
          kind: 'enemy_ko',
          targetId: frontResult.enemy.id,
        });
      }

      if (preview.cleaveDamage > 0) {
        for (let i = 0; i < nextEnemies.length; i++) {
          if (i === frontIdx || nextEnemies[i].hp <= 0) continue;
          const cleaveRes = applyDamageToEnemy(nextEnemies[i], preview.cleaveDamage, pierce, false);
          nextEnemies[i] = cleaveRes.enemy;
          totalDamageDealt += preview.cleaveDamage;
          cues.push({
            id: `cue_${combat.turn}_cleave_${i}`,
            kind: 'hero_slash',
            targetId: cleaveRes.enemy.id,
            value: preview.cleaveDamage,
            surge: true,
          });
          if (cleaveRes.defeated) {
            defeatedNow++;
            cues.push({
              id: `cue_${combat.turn}_ko_${cleaveRes.enemy.id}`,
              kind: 'enemy_ko',
              targetId: cleaveRes.enemy.id,
            });
          }
        }
      }
    }
  } else if (color === 'defense') {
    nextHeroine.shield += preview.shieldGained;
    cues.push({
      id: `cue_${combat.turn}_def`,
      kind: 'hero_shield',
      value: preview.shieldGained,
      surge: preview.surgeTriggered,
    });
    if (preview.reflectOnBlock > 0) {
      const frontIdx = nextEnemies.findIndex((e) => e.hp > 0);
      if (frontIdx !== -1) {
        const res = applyDamageToEnemy(nextEnemies[frontIdx], preview.reflectOnBlock, 0, false);
        nextEnemies[frontIdx] = res.enemy;
        totalDamageDealt += preview.reflectOnBlock;
        cues.push({
          id: `cue_${combat.turn}_def_pulse`,
          kind: 'hero_slash',
          targetId: res.enemy.id,
          value: preview.reflectOnBlock,
          surge: true,
        });
        if (res.defeated) {
          defeatedNow++;
          cues.push({
            id: `cue_${combat.turn}_ko_${res.enemy.id}`,
            kind: 'enemy_ko',
            targetId: res.enemy.id,
          });
        }
      }
    }
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

    const parts: string[] = [];
    if (preview.damageBoostAddedPct > 0) parts.push(`+${preview.damageBoostAddedPct}% DMG`);
    if (preview.healAmount > 0) parts.push(`+${preview.healAmount} HP`);
    if (preview.shieldGained > 0) parts.push(`+${preview.shieldGained} SHD`);

    cues.push({
      id: `cue_${combat.turn}_tech`,
      kind: 'hero_tech',
      value: preview.damageBoostAddedPct || preview.healAmount,
      textLabel: parts.join(' · ') || 'TECH',
      surge: preview.surgeTriggered,
    });
  }

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  nextHeroine.overdrive = Math.min(100, nextHeroine.overdrive + preview.overdriveGained);

  const anyLivingEnemy = nextEnemies.some((e) => e.hp > 0);
  const nextPhase = anyLivingEnemy ? 'PLAYER_RESOLVED' : 'VICTORY';

  const updatedCombat: CombatState = {
    ...combat,
    phase: nextPhase,
    board: keptTiles,
    drawPile: combat.drawPile.map((t) => ({ ...t })),
    discardPile: nextDiscard,
    enemies: nextEnemies,
    lastCues: cues,
    totalDamageDealt,
    totalTilesResolved: combat.totalTilesResolved + resolvedTiles.length,
  };

  const transition = !anyLivingEnemy
    ? resolveCombatVictoryTransition(run, combat)
    : { screen: run.screen, mapNodes: run.mapNodes };

  const damageAdded = totalDamageDealt - combat.totalDamageDealt;

  return {
    ...run,
    screen: transition.screen,
    heroine: nextHeroine,
    mapNodes: transition.mapNodes,
    combat: updatedCombat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    turnsCompleted: !anyLivingEnemy ? run.turnsCompleted + 1 : run.turnsCompleted,
    score: run.score + damageAdded * 2 + defeatedNow * 50,
  };
}

export function executeOverdrive(run: RunState): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  if (run.heroine.overdrive < 100) return run;

  const combat = run.combat;
  const nextHeroine = {
    ...run.heroine,
    overdrive: 0,
    shield: run.heroine.shield + 8,
  };
  let defeatedNow = 0;
  let totalDamageDealt = combat.totalDamageDealt;
  const cues: AnimationCue[] = [
    { id: `cue_${combat.turn}_od`, kind: 'hero_overdrive', value: 22, surge: true },
  ];

  const nextEnemies = combat.enemies.map((enemy) => {
    if (enemy.hp <= 0) return { ...enemy };
    const res = applyDamageToEnemy(enemy, 22, 1.0, false);
    totalDamageDealt += 22;
    if (res.defeated) {
      defeatedNow++;
      cues.push({
        id: `cue_${combat.turn}_od_ko_${enemy.id}`,
        kind: 'enemy_ko',
        targetId: enemy.id,
      });
    }
    return res.enemy;
  });

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  const anyLiving = nextEnemies.some((e) => e.hp > 0);
  const nextPhase = anyLiving ? 'PLAYER_IDLE' : 'VICTORY';

  const transition = !anyLiving
    ? resolveCombatVictoryTransition(run, combat)
    : { screen: run.screen, mapNodes: run.mapNodes };

  return {
    ...run,
    screen: transition.screen,
    heroine: nextHeroine,
    mapNodes: transition.mapNodes,
    combat: {
      ...combat,
      phase: nextPhase,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
    },
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

  const intent = enemy.intentCycle[enemy.currentIntentIndex];
  const updatedEnemy: EnemyUnit = {
    ...enemy,
    currentIntentIndex: (enemy.currentIntentIndex + 1) % enemy.intentCycle.length,
  };

  let reflectedDamage = 0;
  if (intent.kind === 'armor') {
    updatedEnemy.armor += intent.value;
    cues.push({
      id: `cue_e_${combat.turn}_${enemy.id}_armor`,
      kind: 'enemy_armor',
      targetId: enemy.id,
      value: intent.value,
    });
  } else {
    const incoming = intent.value;
    const blocked = Math.min(nextHeroine.shield, incoming);
    nextHeroine.shield -= blocked;
    const hpDamage = incoming - blocked;
    nextHeroine.hp = Math.max(0, nextHeroine.hp - hpDamage);

    if (blocked > 0 && hasImplant(implants, 'kinetic_reflector')) {
      const refRes = applyDamageToEnemy(updatedEnemy, 3, 0, false);
      reflectedDamage = 3;
      updatedEnemy.hp = refRes.enemy.hp;
      updatedEnemy.armor = refRes.enemy.armor;
      if (refRes.defeated) {
        defeatedNow++;
        cues.push({
          id: `cue_e_${combat.turn}_${enemy.id}_refko`,
          kind: 'enemy_ko',
          targetId: enemy.id,
        });
      }
    }

    if (intent.kind === 'acid') {
      nextHeroine.corrode += intent.secondaryValue ?? 2;
      cues.push({
        id: `cue_e_${combat.turn}_${enemy.id}_acid`,
        kind: 'enemy_acid',
        targetId: enemy.id,
        value: incoming,
        blocked,
        hpDamage,
        reflectedDamage,
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

    if (intent.kind === 'leech' && hpDamage > 0) {
      const healAmt = intent.secondaryValue ?? 4;
      updatedEnemy.hp = Math.min(updatedEnemy.maxHp, updatedEnemy.hp + healAmt);
    }
  }

  const nextEnemies = combat.enemies.map((e, idx) => (idx === enemyIndex ? updatedEnemy : { ...e }));
  const totalDamageDealt = combat.totalDamageDealt + reflectedDamage;

  applyBioSiphonHeal(nextHeroine, defeatedNow);

  if (nextHeroine.hp <= 0) {
    return {
      ...run,
      screen: 'gameover',
      heroine: nextHeroine,
      combat: {
        ...combat,
        phase: 'DEFEAT',
        enemies: nextEnemies,
        lastCues: cues,
        totalDamageDealt,
      },
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      score: run.score + reflectedDamage * 2 + defeatedNow * 50,
    };
  }

  const anyLiving = nextEnemies.some((e) => e.hp > 0);
  if (!anyLiving) {
    const transition = resolveCombatVictoryTransition(run, combat);
    return {
      ...run,
      screen: transition.screen,
      heroine: nextHeroine,
      mapNodes: transition.mapNodes,
      combat: {
        ...combat,
        phase: 'VICTORY',
        enemies: nextEnemies,
        lastCues: cues,
        totalDamageDealt,
      },
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
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
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

  nextHeroine.shield = hasImplant(implants, 'aegis_capacitor')
    ? Math.floor(nextHeroine.shield * 0.5)
    : 0;
  nextHeroine.corrode = Math.max(0, nextHeroine.corrode - 1);
  // Damage boost decays by 10 percentage points at the end of each round
  nextHeroine.damageBoostPct = Math.max(0, nextHeroine.damageBoostPct - 10);

  const nextTurn = combat.turn + 1;
  const heldBoard = combat.board.map((t) => ({ ...t, isHeldFromPrevTurn: true }));
  const drawn = drawToSix(heldBoard, combat.drawPile, combat.discardPile, run.seed, nextTurn);

  return {
    ...run,
    heroine: nextHeroine,
    combat: {
      ...combat,
      turn: nextTurn,
      phase: 'PLAYER_IDLE',
      board: drawn.board,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      lastCues: [],
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
      lastCues: accumulatedCues,
    },
  };
}

function pickEquipmentChoices(seed: number, count = 2): string[] {
  if (DROPPABLE_EQUIPMENT_IDS.length === 0) return [];
  return deterministicShuffle(DROPPABLE_EQUIPMENT_IDS, seed).slice(0, count);
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

export function startNodeEncounter(run: RunState, nodeId: string): RunState {
  const node: MapNode | undefined = run.mapNodes.find((n) => n.id === nodeId);
  if (!node) return run;

  if (node.type === 'CYBER_CLINIC') {
    return {
      ...run,
      currentNodeId: node.id,
      screen: 'clinic',
      clinicChoices: pickClinicChoices(run.heroine.implants, run.seed + node.layer * 17),
      clinicShopChoices: pickEquipmentChoices(run.seed + node.layer * 31 + 5, 3),
      combat: null,
    };
  }

  if (node.type === 'MED_BAY') {
    return {
      ...run,
      currentNodeId: node.id,
      screen: 'medbay',
      combat: null,
    };
  }

  const initialPile = deterministicShuffle(
    run.masterPool.map((t) => ({ ...t, isHeldFromPrevTurn: false })),
    run.seed + node.layer * 41 + node.lane * 13,
  );
  const drawn = drawToSix([], initialPile, [], run.seed, 1);

  const rewardCredits =
    node.type === 'ELITE' ? 60 : node.type === 'BOSS' ? 100 : 35;
  const rewardEquipmentChoices =
    node.type === 'BOSS'
      ? []
      : pickEquipmentChoices(
          run.seed + node.layer * 53 + node.lane * 19,
          node.type === 'ELITE' ? 3 : 2,
        );

  const combat: CombatState = {
    nodeId: node.id,
    nodeType: node.type,
    turn: 1,
    phase: 'PLAYER_IDLE',
    board: drawn.board,
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    enemies: buildEnemiesForNode(node.type, node.layer, run.seed),
    lastCues: [],
    totalDamageDealt: 0,
    totalTilesResolved: 0,
    rewardCredits,
    rewardEquipmentChoices,
  };

  return {
    ...run,
    currentNodeId: node.id,
    screen: 'combat',
    heroine: {
      ...run.heroine,
      shield: 0,
      corrode: 0,
      damageBoostPct: 0,
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
  if (run.screen !== 'clinic') return run;
  if (!run.clinicShopChoices.includes(defId)) return run;
  const def = EQUIPMENT_BY_ID[defId];
  if (!def || run.heroine.credits < def.price) return run;

  const afterCredits: RunState = {
    ...run,
    heroine: {
      ...run.heroine,
      credits: run.heroine.credits - def.price,
    },
    clinicShopChoices: run.clinicShopChoices.filter((id) => id !== defId),
  };

  return acquireEquipment(afterCredits, defId, true);
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
  action: 'heal' | 'calibrate_max_hp' | 'salvage_credits',
): RunState {
  let nextHeroine = { ...run.heroine };

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
  }

  return {
    ...run,
    screen: 'map',
    heroine: nextHeroine,
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
    score: run.score + 30,
  };
}

export function claimCombatEquipmentReward(run: RunState, chosenDefId: string | null): RunState {
  if (!run.combat || run.combat.phase !== 'VICTORY') return run;
  const combat = run.combat;
  const salvageBonus = chosenDefId === null ? 15 : 0;

  let nextRun: RunState = {
    ...run,
    heroine: {
      ...run.heroine,
      credits: run.heroine.credits + combat.rewardCredits + salvageBonus,
    },
  };

  if (chosenDefId && combat.rewardEquipmentChoices.includes(chosenDefId)) {
    nextRun = acquireEquipment(nextRun, chosenDefId, true);
  }

  const nextMapNodes = markNodeCleared(nextRun.mapNodes, combat.nodeId);

  if (combat.nodeType === 'ELITE') {
    const currentLayer =
      nextRun.mapNodes.find((n) => n.id === combat.nodeId)?.layer ?? 2;
    return {
      ...nextRun,
      screen: 'clinic',
      mapNodes: nextMapNodes,
      clinicChoices: pickClinicChoices(
        nextRun.heroine.implants,
        nextRun.seed + combat.turn + 13,
      ),
      clinicShopChoices: pickEquipmentChoices(
        nextRun.seed + currentLayer * 37 + combat.turn,
        3,
      ),
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

export function createInitialRun(seed = 104729): RunState {
  const mapNodes = generateSectorMap(seed);
  const startingEq = createStartingEquipment();
  const baseHeroine: HeroineState = {
    hp: 60,
    maxHp: 60,
    shield: 0,
    overdrive: 0,
    corrode: 0,
    damageBoostPct: 0,
    implants: [],
    carryCapacity: KIRA_CARRY_CAPACITY,
    ownedEquipment: startingEq.ownedEquipment,
    equippedInstanceIds: startingEq.equippedInstanceIds,
    credits: STARTING_CREDITS,
  };

  const baseRun: RunState = {
    runId: `run_${seed}_${Date.now()}`,
    seed,
    screen: 'combat',
    heroine: baseHeroine,
    masterPool: rebuildMasterPool(baseHeroine),
    mapNodes,
    currentNodeId: null,
    combat: null,
    clinicChoices: [],
    clinicShopChoices: [],
    enemiesDefeated: 0,
    turnsCompleted: 0,
    score: 0,
  };

  return startNodeEncounter(baseRun, mapNodes[0].id);
}
