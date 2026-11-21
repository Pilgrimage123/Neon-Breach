import {
  MAX_OVERCLOCK_STACKS,
  MAX_UPCHARGE_BOARD_CAPACITY,
  getHeroSpec,
} from './data';
import { createSlagTile, rebuildMasterPool } from './poolBuilder';
import {
  HEX_ARMOR_AMOUNT,
  HEX_HEAL_AMOUNT,
  PHASE_GATE_ARMOR_BONUS,
  absorbHeroDamage,
  applyBioSiphonHeal,
  applyDamageToEnemy,
  applyMercyVictoryBonus,
  applyTugOfWarProgress,
  clearDeadCasterHexes,
  collectLootRunnerBounties,
  countRewardedKills,
  evaluateReactiveEnemyShifts,
  finalizeCombatVictory,
  hasHostileLivingEnemies,
  simulatePlayerActionOnEnemies,
  triggerVolatileBursts,
} from './combatRules';
import { previewColorResolution } from './combatPreview';
import { updateDirectorAfterPlayerAction } from './reinforcementDirector';
import type {
  AnimationCue,
  CombatState,
  RunState,
  Tile,
  TileType,
} from './types';

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
    masterPool: !anyLiving ? rebuildMasterPool(transition.hero) : run.masterPool,
    mapNodes: transition.mapNodes,
    combat: transition.combat,
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    turnsCompleted: !anyLiving ? run.turnsCompleted + 1 : run.turnsCompleted,
    score: run.score + 80 + rewardedKills * 50,
  };
}
