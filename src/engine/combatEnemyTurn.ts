import { getHeroSpec } from './data';
import { createSlagTile, rebuildMasterPool } from './poolBuilder';
import {
  MAX_ACTIVE_BLIGHT_TILES,
  PHASE_GATE_ARMOR_BONUS,
  absorbHeroDamage,
  applyBioSiphonHeal,
  applyDamageToEnemy,
  applyMercyVictoryBonus,
  clearDeadCasterHexes,
  countRewardedKills,
  countTotalBlightTiles,
  evaluateReactiveEnemyShifts,
  finalizeCombatVictory,
  hasHostileLivingEnemies,
  hasImplant,
  triggerVolatileBursts,
} from './combatRules';
import { getSafeEnemyIntent } from './combatBoardOps';
import { advanceRoundAfterEnemies } from './combatRoundLifecycle';
import {
  getEffectiveEnemyIntentValue,
  updateDirectorAfterPlayerAction,
} from './reinforcementDirector';
import type { AnimationCue, CombatState, EnemyUnit, RunState } from './types';

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
  let nextBlitzCooldown = combat.blitzReflexCooldown ?? 0;
  let nextEvasiveDodgeTriggered = combat.evasiveDodgeTriggeredThisRound ?? false;
  const heroSpec = getHeroSpec(nextHero.characterId);

  const { intent, safeIndex } = getSafeEnemyIntent(enemy);
  const cycleLen = Math.max(1, enemy.intentCycle.length);
  const isSleeping = enemy.sleepCounter !== undefined && enemy.sleepCounter > 0;
  const isPassiveProp = enemy.propKind === 'plasma_barrel' || enemy.propKind === 'bio_husk';
  const nextIndexOnStagger =
    intent?.kind === 'charge' ? 0 : (safeIndex + 1) % cycleLen;
  const updatedEnemy: EnemyUnit = {
    ...enemy,
    currentIntentIndex:
      isSleeping || isPassiveProp || !intent
        ? safeIndex
        : enemy.staggered
          ? nextIndexOnStagger
          : (safeIndex + 1) % cycleLen,
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
  } else if (isPassiveProp || !intent) {
    // Passive battlefield props or empty-intent units do not act
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
  } else if (intent.kind === 'pause') {
    // Breather / windup turn: 0 DMG, advances intent cycle cleanly
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
    const abs = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, incoming, {
      pierceShield: intent.pierceShield,
      overwhelmMultiplier: intent.overwhelmMultiplier,
    });
    nextHero.shield = abs.nextShield;
    nextHero.armor = abs.nextArmor;
    const blocked = abs.blockedByShield + abs.blockedByArmor;
    const hpDamage = abs.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpDamage);

    if (
      (heroSpec.blitzReflexCooldownTurns ?? 0) > 0 &&
      incoming > 0 &&
      hpDamage === 0 &&
      abs.blockedByArmor === 0 &&
      abs.blockedByShield > 0 &&
      !nextEvasiveDodgeTriggered
    ) {
      nextEvasiveDodgeTriggered = true;
      nextBlitzCooldown = Math.max(0, nextBlitzCooldown - 1);
    }

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
      const postShieldAcid = Math.max(0, incoming - abs.blockedByShield);
      const unblockedAcidHit = hpDamage > Math.floor(postShieldAcid * 0.1);
      if (unblockedAcidHit && (enemy.archetype === 'spitter' || enemy.archetype === 'boss')) {
        if (enemy.archetype === 'boss') {
          const jamIdx = nextBoard.findIndex((t) => !t.isJammed);
          if (jamIdx !== -1) {
            nextBoard[jamIdx] = { ...nextBoard[jamIdx], isJammed: true };
            jammedTile = true;
          }
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
      masterPool: rebuildMasterPool(transition.hero),
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
      blitzReflexCooldown: nextBlitzCooldown,
      evasiveDodgeTriggeredThisRound: nextEvasiveDodgeTriggered,
    },
    enemiesDefeated: run.enemiesDefeated + defeatedNow,
    score: run.score + reflectedDamage * 2 + rewardedKills * 50,
  };
}

export function executeEnemyTurn(run: RunState): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  const canStepFromBlitzIdle =
    combat.phase === 'PLAYER_IDLE' && Boolean(combat.blitzUsedThisRound);
  if (
    combat.phase !== 'PLAYER_RESOLVED' &&
    combat.phase !== 'ENEMY_ACTING' &&
    !canStepFromBlitzIdle
  ) {
    return run;
  }

  let current: RunState = canStepFromBlitzIdle
    ? { ...run, combat: { ...combat, phase: 'PLAYER_RESOLVED' } }
    : run;
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
