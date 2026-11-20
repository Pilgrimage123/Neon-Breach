import {
  BOARD_CAPACITY,
  ENEMY_TEMPLATES,
  MAX_OVERCLOCK_STACKS,
  MAX_UPCHARGE_BOARD_CAPACITY,
  getHeroSpec,
} from './data';
import { createPropUnit, deterministicShuffle } from './encounterBuilder';
import { createSlagTile, rebuildMasterPool } from './poolBuilder';
import {
  BLIGHT_HOLD_CHIP_DAMAGE,
  HEX_ARMOR_AMOUNT,
  HEX_HEAL_AMOUNT,
  HOT_POTATO_SELF_DAMAGE,
  MAX_ACTIVE_BLIGHT_TILES,
  PHASE_GATE_ARMOR_BONUS,
  absorbHeroDamage,
  applyBioSiphonHeal,
  applyDamageToEnemy,
  applyMercyVictoryBonus,
  applyTugOfWarProgress,
  clearDeadCasterHexes,
  collectLootRunnerBounties,
  countRewardedKills,
  countTotalBlightTiles,
  evaluateReactiveEnemyShifts,
  finalizeCombatVictory,
  hasHostileLivingEnemies,
  hasImplant,
  simulatePlayerActionOnEnemies,
  triggerVolatileBursts,
} from './combatRules';
import { previewColorResolution } from './combatPreview';
import {
  advanceDirectorAtRoundEnd,
  getEffectiveEnemyIntentValue,
  updateDirectorAfterPlayerAction,
} from './reinforcementDirector';
import type {
  AnimationCue,
  CombatState,
  EnemyUnit,
  RunState,
  Tile,
  TileType,
} from './types';

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

export function resolvePlayerColor(run: RunState, color: TileType): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  const preview = previewColorResolution(run, color);
  if (preview.tileCount === 0) return run;

  const combat = run.combat;
  const resolvedTiles = combat.board.filter((t) => t.type === color && !t.isJammed);

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

  const purgedBlightCount = resolvedTiles.filter((t) => t.isBlight).length;
  const cleanResolvedAndDiscarded = [...resolvedTiles, ...contagionDiscardedTiles]
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
    }));
  const nextDiscard = [...combat.discardPile.map((t) => ({ ...t })), ...cleanResolvedAndDiscarded];

  const temptationCount = resolvedTiles.filter((t) => Boolean(t.isTemptation)).length;
  for (let i = 0; i < temptationCount * 2; i++) {
    nextDiscard.push(createSlagTile(combat.turn, combat.totalTilesResolved + 50 + i));
  }

  let nextHero = { ...run.hero };
  if ((preview.upchargeGained ?? 0) > 0) {
    nextHero.pendingUpcharge = (nextHero.pendingUpcharge ?? 0) + (preview.upchargeGained ?? 0);
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
      nextHero.shield += preview.shieldGained;
    }
    if (preview.damageBoostAddedPct > 0) {
      nextHero.damageBoostPct += preview.damageBoostAddedPct;
    }
  } else if (color === 'defense') {
    nextHero.shield += preview.shieldGained;
    if (preview.damageBoostAddedPct > 0) {
      nextHero.damageBoostPct += preview.damageBoostAddedPct;
    }
    cues.push({
      id: `cue_${combat.turn}_def`,
      kind: 'hero_shield',
      value: preview.shieldGained,
      surge: preview.surgeTriggered,
    });
  } else if (color === 'tech') {
    if (preview.damageBoostAddedPct > 0) {
      nextHero.damageBoostPct += preview.damageBoostAddedPct;
    }
    if (preview.healAmount > 0) {
      nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + preview.healAmount);
    }
    if (preview.shieldGained > 0) {
      nextHero.shield += preview.shieldGained;
    }
    if (preview.cleanseCorrodeAmount > 0) {
      nextHero.corrode = Math.max(0, nextHero.corrode - preview.cleanseCorrodeAmount);
    }
  }

  const enemySim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, preview, cues);
  let nextEnemies = enemySim.enemies;
  const defeatedNow = enemySim.defeatedNow;
  const totalDamageDealt = combat.totalDamageDealt + enemySim.damageDealt;

  if (enemySim.retaliateDamage > 0) {
    const frontEnemy = nextEnemies.find((e) => e.hp > 0 && !e.escaped);
    const absRet = absorbHeroDamage(
      nextHero.shield,
      nextHero.armor ?? 0,
      enemySim.retaliateDamage,
    );
    nextHero.shield = absRet.nextShield;
    nextHero.armor = absRet.nextArmor;
    const retBlocked = absRet.blockedByShield + absRet.blockedByArmor;
    const retHpDmg = absRet.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - retHpDmg);
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
    nextHero.corrode += enemySim.pustuleRuptureCorrode;
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
      value:
        preview.damageBoostAddedPct ||
        preview.healAmount ||
        preview.shieldGained ||
        preview.techPierceDamage,
      textLabel: parts.join(' · ') || 'TECH',
      surge: preview.surgeTriggered,
    });
  }

  keptTiles = clearDeadCasterHexes(keptTiles, nextEnemies);

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

  applyBioSiphonHeal(nextHero, defeatedNow);

  const barrelOdBonus = enemySim.barrelPoppedCount * 20;
  nextHero.overdrive = Math.min(
    100,
    nextHero.overdrive + preview.overdriveGained + barrelOdBonus,
  );

  const lootBountyEarnedNow = collectLootRunnerBounties(combat.enemies, nextEnemies);
  const tugRes = applyTugOfWarProgress({
    combat,
    hero: nextHero,
    enemies: nextEnemies,
    damageDealtDelta: enemySim.damageDealt,
    cues,
  });
  nextEnemies = tugRes.enemies;

  const damageAdded = totalDamageDealt - combat.totalDamageDealt;
  const rewardedKills = countRewardedKills(combat.enemies, nextEnemies);

  if (nextHero.hp <= 0) {
    return {
      ...run,
      screen: 'gameover',
      hero: nextHero,
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
        tugOfWarMeter: tugRes.tugOfWarMeter,
        tugOfWarPurged: tugRes.tugOfWarPurged,
      },
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      score: run.score + damageAdded * 2 + rewardedKills * 50,
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
  const mercy = applyMercyVictoryBonus(combat, nextHero, nextEnemies);

  let nextBloodlineResonance: TileType | null = combat.bloodlineResonanceActive ?? null;
  if (nextHero.bloodlineCrest) {
    if (color === nextHero.bloodlineCrest.primary) {
      nextBloodlineResonance = nextHero.bloodlineCrest.secondary;
    } else if (color === nextHero.bloodlineCrest.secondary) {
      nextBloodlineResonance = nextHero.bloodlineCrest.primary;
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

  if (nextHero.betaTrialChip && !nextHero.betaTrialChip.upgraded) {
    const nextLogged = nextHero.betaTrialChip.resolvesLogged + resolvedTiles.length;
    const newlyUpgraded = nextLogged >= 5;
    nextHero = {
      ...nextHero,
      betaTrialChip: {
        ...nextHero.betaTrialChip,
        resolvesLogged: nextLogged,
        upgraded: newlyUpgraded,
      },
      ...(newlyUpgraded
        ? {
            overclockCount: Math.min(
              MAX_OVERCLOCK_STACKS,
              (nextHero.overclockCount ?? 0) + 1,
            ),
          }
        : {}),
    };
  }

  const updatedCombat: CombatState = {
    ...combat,
    phase: anyLivingEnemy ? 'PLAYER_RESOLVED' : 'VICTORY',
    board: keptTiles,
    drawPile: combat.drawPile.map((t) => ({ ...t })),
    discardPile: nextDiscard,
    enemies: nextEnemies,
    lastCues: cues,
    totalDamageDealt,
    totalTilesResolved: combat.totalTilesResolved + resolvedTiles.length,
    rewardCredits: combat.rewardCredits + lootBountyEarnedNow + tugRes.crBonus + mercy.mercyCrBonus,
    director: directorActionUpdate.director,
    lastColorPlayed: color,
    tugOfWarMeter: tugRes.tugOfWarMeter,
    tugOfWarPurged: tugRes.tugOfWarPurged,
    mercyBonusAwarded: mercy.mercyBonusAwarded,
    lootBountyAwarded: (combat.lootBountyAwarded ?? 0) + lootBountyEarnedNow,
    bloodlineResonanceActive: nextBloodlineResonance,
  };

  const transition = !anyLivingEnemy
    ? finalizeCombatVictory(run, updatedCombat, nextHero)
    : { screen: run.screen, mapNodes: run.mapNodes, hero: nextHero, combat: updatedCombat };

  return {
    ...run,
    screen: transition.screen,
    hero: transition.hero,
    masterPool: rebuildMasterPool(transition.hero),
    mapNodes: transition.mapNodes,
    combat: transition.combat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    turnsCompleted: !anyLivingEnemy ? run.turnsCompleted + 1 : run.turnsCompleted,
    score: run.score + damageAdded * 2 + rewardedKills * 50,
  };
}

export function executeOverdrive(run: RunState): RunState {
  if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') return run;
  if (run.hero.overdrive < 100) return run;

  const combat = run.combat;
  const odSpec = getHeroSpec(run.hero.characterId).overdrive;
  const nextHero = {
    ...run.hero,
    overdrive: 0,
    shield: run.hero.shield + odSpec.shield,
    armor: (run.hero.armor ?? 0) + (odSpec.armor ?? 0),
    pendingUpcharge: (run.hero.pendingUpcharge ?? 0) + (odSpec.upcharge ?? 0),
    damageBoostPct: run.hero.damageBoostPct + odSpec.damageBoostPct,
    corrode: Math.max(0, run.hero.corrode - odSpec.cleanseCorrode),
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
      nextHero.overdrive = Math.min(100, nextHero.overdrive + burstRes.barrelPoppedCount * 20);
    }
  }

  nextEnemies = evaluateReactiveEnemyShifts(combat.enemies, nextEnemies, combat.turn, cues);
  applyBioSiphonHeal(nextHero, defeatedNow);

  const damageDelta = totalDamageDealt - combat.totalDamageDealt;
  const lootBountyEarnedNow = collectLootRunnerBounties(combat.enemies, nextEnemies);
  const tugRes = applyTugOfWarProgress({
    combat,
    hero: nextHero,
    enemies: nextEnemies,
    damageDealtDelta: damageDelta,
    cues,
  });
  nextEnemies = tugRes.enemies;

  const directorOdUpdate = updateDirectorAfterPlayerAction(
    combat.director,
    combat.enemies,
    nextEnemies,
    null,
    false,
  );
  nextEnemies = directorOdUpdate.enemies;

  const anyLiving = hasHostileLivingEnemies(nextEnemies);
  const mercy = applyMercyVictoryBonus(combat, nextHero, nextEnemies);
  const rewardedKills = countRewardedKills(combat.enemies, nextEnemies);

  const cleansedBoard = combat.board
    .filter((t) => !t.isBlight)
    .map((t) => ({
      ...t,
      isJammed: false,
      hexedByEnemyId: undefined,
      isHotPotato: undefined,
      isContagion: undefined,
    }));

  const updatedOdCombat: CombatState = {
    ...combat,
    phase: anyLiving ? 'PLAYER_IDLE' : 'VICTORY',
    board: cleansedBoard,
    enemies: nextEnemies,
    lastCues: cues,
    totalDamageDealt,
    rewardCredits: combat.rewardCredits + lootBountyEarnedNow + tugRes.crBonus + mercy.mercyCrBonus,
    director: directorOdUpdate.director,
    tugOfWarMeter: tugRes.tugOfWarMeter,
    tugOfWarPurged: tugRes.tugOfWarPurged,
    mercyBonusAwarded: mercy.mercyBonusAwarded,
    lootBountyAwarded: (combat.lootBountyAwarded ?? 0) + lootBountyEarnedNow,
  };

  const transition = !anyLiving
    ? finalizeCombatVictory(run, updatedOdCombat, nextHero)
    : { screen: run.screen, mapNodes: run.mapNodes, hero: nextHero, combat: updatedOdCombat };

  return {
    ...run,
    screen: transition.screen,
    hero: transition.hero,
    mapNodes: transition.mapNodes,
    combat: transition.combat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    turnsCompleted: !anyLiving ? run.turnsCompleted + 1 : run.turnsCompleted,
    score: run.score + 80 + rewardedKills * 50,
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

  const nextHero = { ...run.hero };
  const implants = nextHero.implants;
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
  const isPassiveProp = enemy.propKind === 'plasma_barrel' || enemy.propKind === 'bio_husk';
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
    // Passive battlefield props do not act
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
      shieldAfterPlayer: nextHero.shield,
      colorPlayed: combat.lastColorPlayed ?? null,
      battlefieldRule: combat.battlefieldRule,
    });
    const abs = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, incoming);
    nextHero.shield = abs.nextShield;
    nextHero.armor = abs.nextArmor;
    const blocked = abs.blockedByShield + abs.blockedByArmor;
    const hpDamage = abs.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpDamage);

    if (hpDamage > 0 && nextTugOfWarMeter !== undefined) {
      nextTugOfWarMeter = Math.max(0, nextTugOfWarMeter - hpDamage * 3);
    }

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
      nextHero.corrode += intent.secondaryValue ?? 2;
      let jammedTile = false;
      if (hpDamage > 0 && (enemy.passive === 'acid_jam' || enemy.archetype === 'boss')) {
        const jamIdx = nextBoard.findIndex((t) => !t.isJammed);
        if (jamIdx !== -1) {
          nextBoard[jamIdx] = { ...nextBoard[jamIdx], isJammed: true };
          jammedTile = true;
        }
        const blightInCombat = countTotalBlightTiles({
          board: nextBoard,
          drawPile: nextDrawPile,
          discardPile: nextDiscardPile,
        });
        if (blightInCombat < MAX_ACTIVE_BLIGHT_TILES) {
          const useTopDeck = Boolean(intent.topDeckBlight) && nextDrawPile.length > 0;
          const blightTile = createSlagTile(
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
        nextHero.corrode += intent.corrodeAmount;
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

  applyBioSiphonHeal(nextHero, defeatedNow);
  const rewardedKills = countRewardedKills(combat.enemies, nextEnemies);

  if (nextHero.hp <= 0) {
    return {
      ...run,
      screen: 'gameover',
      hero: nextHero,
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
      score: run.score + reflectedDamage * 2 + rewardedKills * 50,
    };
  }

  const directorReflectUpdate =
    reflectedDamage > 0 || newlyDefeatedIds.length > 0
      ? updateDirectorAfterPlayerAction(combat.director, combat.enemies, nextEnemies, null, false)
      : { director: combat.director, enemies: nextEnemies };
  nextEnemies = directorReflectUpdate.enemies;

  const anyLiving = hasHostileLivingEnemies(nextEnemies);
  if (!anyLiving) {
    const mercy = applyMercyVictoryBonus(combat, nextHero, nextEnemies);
    const victoryCombat: CombatState = {
      ...combat,
      phase: 'VICTORY',
      board: nextBoard,
      drawPile: nextDrawPile,
      discardPile: nextDiscardPile,
      enemies: nextEnemies,
      lastCues: cues,
      totalDamageDealt,
      rewardCredits: combat.rewardCredits + mercy.mercyCrBonus,
      mercyBonusAwarded: mercy.mercyBonusAwarded,
      director: directorReflectUpdate.director,
      tugOfWarMeter: nextTugOfWarMeter,
      cradleObjective: nextCradleObjective,
    };
    const transition = finalizeCombatVictory(run, victoryCombat, nextHero);
    return {
      ...run,
      screen: transition.screen,
      hero: transition.hero,
      mapNodes: transition.mapNodes,
      combat: transition.combat,
      enemiesDefeated: run.enemiesDefeated + defeatedNow,
      turnsCompleted: run.turnsCompleted + 1,
      score: run.score + reflectedDamage * 2 + rewardedKills * 50,
    };
  }

  return {
    ...run,
    hero: nextHero,
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
    score: run.score + reflectedDamage * 2 + rewardedKills * 50,
  };
}

export function advanceRoundAfterEnemies(run: RunState): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
    return run;
  }

  const nextHero = { ...run.hero };
  const implants = nextHero.implants;
  const roundEndCues: AnimationCue[] = [];

  const lingeringBlightCount = combat.board.filter((t) => t.isBlight).length;
  if (lingeringBlightCount > 0) {
    const blightDmg = lingeringBlightCount * BLIGHT_HOLD_CHIP_DAMAGE;
    const absBlight = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, blightDmg);
    nextHero.shield = absBlight.nextShield;
    nextHero.armor = absBlight.nextArmor;
    const blockedBlight = absBlight.blockedByShield + absBlight.blockedByArmor;
    const hpBlight = absBlight.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpBlight);
    roundEndCues.push({
      id: `cue_${combat.turn}_blight_chip`,
      kind: 'tile_blight',
      value: blightDmg,
      blocked: blockedBlight,
      hpDamage: hpBlight,
      textLabel: `-${blightDmg} SLAG BURN`,
    });
    if (nextHero.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        hero: nextHero,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  const lingeringHotPotatoCount = combat.board.filter((t) => Boolean(t.isHotPotato)).length;
  if (lingeringHotPotatoCount > 0) {
    const potatoDmg = lingeringHotPotatoCount * HOT_POTATO_SELF_DAMAGE;
    const absPotato = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, potatoDmg);
    nextHero.shield = absPotato.nextShield;
    nextHero.armor = absPotato.nextArmor;
    const blockedPotato = absPotato.blockedByShield + absPotato.blockedByArmor;
    const hpPotato = absPotato.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpPotato);
    roundEndCues.push({
      id: `cue_${combat.turn}_hot_potato_boom`,
      kind: 'tile_blight',
      value: potatoDmg,
      blocked: blockedPotato,
      hpDamage: hpPotato,
      textLabel: `-${potatoDmg} TIME-BOMB!`,
    });
    if (nextHero.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        hero: nextHero,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  const aegisRetained = hasImplant(implants, 'aegis_capacitor')
    ? Math.floor(nextHero.shield * 0.5)
    : 0;
  nextHero.shield = Math.min(nextHero.shield, aegisRetained);
  nextHero.corrode = Math.max(0, nextHero.corrode - 1);
  nextHero.damageBoostPct = Math.max(0, nextHero.damageBoostPct - 10);

  if (nextHero.nannyBotInstalled === 'guardian_nanny') {
    nextHero.shield += 4;
  } else if (nextHero.nannyBotInstalled === 'caretaker_nanny') {
    nextHero.corrode = Math.max(0, nextHero.corrode - 1);
    nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + 2);
  }

  const nextCradleObjective = combat.cradleObjective ? { ...combat.cradleObjective } : undefined;
  if (nextCradleObjective && nextCradleObjective.hp > 0) {
    nextCradleObjective.turnsSurvived += 1;
    if (
      !nextCradleObjective.liberated &&
      nextCradleObjective.turnsSurvived >= nextCradleObjective.targetTurns
    ) {
      nextCradleObjective.liberated = true;
      nextHero.overdrive = Math.min(100, nextHero.overdrive + 20);
    }
  }

  const nextTurn = combat.turn + 1;
  const heldBoard = combat.board.map((t) => ({
    ...t,
    isHeldFromPrevTurn: true,
    isHotPotato: undefined,
  }));
  const drawTarget = BOARD_CAPACITY + Math.max(0, nextHero.pendingUpcharge ?? 0);
  const drawn = drawToSix(
    heldBoard,
    combat.drawPile,
    combat.discardPile,
    run.seed,
    nextTurn,
    drawTarget,
  );
  nextHero.pendingUpcharge = 0;

  const currentNode = run.mapNodes.find((n) => n.id === combat.nodeId);
  const layer = currentNode?.layer ?? 0;

  const hasBossAlive = combat.enemies.some(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && e.archetype === 'boss',
  );

  let nextEnemies: EnemyUnit[] = combat.enemies.map((e) => {
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

    if (
      e.hp <= 0 &&
      !e.escaped &&
      !e.propKind &&
      !e.huskSpawned &&
      !e.isLootRunner &&
      !e.isMercyTarget &&
      hasBossAlive
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

  if (!hasHostileLivingEnemies(nextEnemies)) {
    const mercy = applyMercyVictoryBonus(combat, nextHero, nextEnemies);
    const victoryCombat: CombatState = {
      ...combat,
      turn: nextTurn,
      phase: 'VICTORY',
      board: drawn.board,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      enemies: nextEnemies,
      lastCues: roundEndCues,
      lastColorPlayed: null,
      rewardCredits: combat.rewardCredits + mercy.mercyCrBonus,
      mercyBonusAwarded: mercy.mercyBonusAwarded,
      cradleObjective: nextCradleObjective,
    };
    const transition = finalizeCombatVictory(run, victoryCombat, nextHero);
    return {
      ...run,
      screen: transition.screen,
      hero: transition.hero,
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
      hero: nextHero,
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
    hero: nextHero,
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
