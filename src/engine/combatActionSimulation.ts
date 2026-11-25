import type {
  AnimationCue,
  CombatState,
  EnemyUnit,
  HeroState,
  TurnPreview,
} from './types';
import {
  MERCY_REWARD_CREDITS,
  MERCY_REWARD_HP,
  PHASE_GATE_ARMOR_BONUS,
  PUSTULE_RUPTURE_CORRODE,
  SPIKE_RETALIATE_DAMAGE,
  TUG_OF_WAR_PURGE_CR_BONUS,
  TUG_OF_WAR_PURGE_OD_BONUS,
  hasHostileLivingEnemies,
} from './combatDefenseAndVictory';
import {
  applyDamageToEnemy,
  evaluateReactiveEnemyShifts,
  triggerVolatileBursts,
} from './combatEnemyDamage';

export interface SimulatedPlayerEnemiesResult {
  enemies: EnemyUnit[];
  defeatedNow: number;
  newlyDefeatedIds: string[];
  damageDealt: number;
  retaliateDamage: number;
  pustuleRuptureCorrode: number;
  barrelPoppedCount: number;
}

export function splitCloakedDamage(rawDamage: number): { taken: number; passed: number } {
  const safeDmg = Math.max(0, Math.floor(rawDamage));
  if (safeDmg <= 0) return { taken: 0, passed: 0 };
  const taken = Math.max(1, Math.floor(safeDmg * 0.1));
  const passed = Math.max(0, safeDmg - taken);
  return { taken, passed };
}

export function findNextLivingEnemyBehind(
  enemies: readonly EnemyUnit[],
  fromIdx: number,
): number {
  for (let i = fromIdx + 1; i < enemies.length; i++) {
    const unit = enemies[i];
    if (unit && unit.hp > 0 && !unit.escaped) {
      return i;
    }
  }
  return -1;
}

export function simulatePlayerActionOnEnemies(
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
    isPassThrough = false,
  ): ReturnType<typeof applyDamageToEnemy> => {
    const targetBefore = nextEnemies[targetIdx];
    const isCloaked = (targetBefore.cloakedTurns ?? 0) > 0 && dmg > 0;
    const { taken: directDmg, passed: passThroughDmg } = isCloaked
      ? splitCloakedDamage(dmg)
      : { taken: dmg, passed: 0 };

    const res = applyDamageToEnemy(targetBefore, directDmg, pierceRatio, breakArmorFirst);
    let updatedTarget = res.enemy;
    if (
      wakeSleepwalker &&
      directDmg > 0 &&
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
      value: directDmg,
      textLabel: res.pipCracked
        ? 'PIP CRACKED'
        : isCloaked
          ? 'CLOAK 10%'
          : isPassThrough
            ? 'PASS-THROUGH'
            : undefined,
      surge: surgeFlag,
      ...(isPassThrough ? { passThrough: true } : {}),
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
    if (isCloaked && passThroughDmg > 0) {
      const behindIdx = findNextLivingEnemyBehind(nextEnemies, targetIdx);
      if (behindIdx !== -1) {
        applyHit(
          behindIdx,
          passThroughDmg,
          pierceRatio,
          breakArmorFirst,
          `${cueId}_pass_${behindIdx}`,
          surgeFlag,
          wakeSleepwalker,
          true,
        );
      }
    }
    return res;
  };

  const frontIdx = nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
  if (preview.color === 'attack' && frontIdx !== -1) {
    const pierce = preview.armorPiercing ? 0.4 : 0;
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
  } else if (preview.color === 'defense' && frontIdx !== -1) {
    if (preview.reflectOnBlock > 0) {
      applyHit(frontIdx, preview.reflectOnBlock, 0, false, `cue_${turn}_def_pulse`, true, false);
    }
    if (preview.techPierceDamage > 0) {
      const targetIdx =
        nextEnemies[frontIdx].hp > 0 && !nextEnemies[frontIdx].escaped
          ? frontIdx
          : nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
      if (targetIdx !== -1) {
        applyHit(
          targetIdx,
          preview.techPierceDamage,
          1.0,
          false,
          `cue_${turn}_def_pierce`,
          preview.surgeTriggered,
          false,
        );
      }
    }
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

export function countRewardedKills(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
): number {
  let count = 0;
  for (let i = 0; i < enemiesAfter.length; i++) {
    const after = enemiesAfter[i];
    const before = enemiesBefore.find((b) => b.id === after.id);
    if (after.hp <= 0 && !after.escaped && before && before.hp > 0 && !after.isZeroReward) {
      count += 1;
    }
  }
  return count;
}

export function collectLootRunnerBounties(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
): number {
  let bounty = 0;
  for (const afterE of enemiesAfter) {
    if (!afterE.isLootRunner || afterE.escaped || afterE.hp > 0) continue;
    const beforeE = enemiesBefore.find((b) => b.id === afterE.id);
    if (beforeE && beforeE.hp > 0) {
      bounty += afterE.bountyCredits ?? 25;
    }
  }
  return bounty;
}

export function applyTugOfWarProgress(params: {
  combat: CombatState;
  hero: HeroState;
  enemies: EnemyUnit[];
  damageDealtDelta: number;
  cues: AnimationCue[];
}): {
  tugOfWarMeter: number | undefined;
  tugOfWarPurged: boolean | undefined;
  crBonus: number;
  enemies: EnemyUnit[];
} {
  let meter = params.combat.tugOfWarMeter;
  let purged = params.combat.tugOfWarPurged;
  let crBonus = 0;
  let nextEnemies = params.enemies;

  if (meter !== undefined && params.damageDealtDelta > 0) {
    meter = Math.min(100, meter + params.damageDealtDelta * 2);
    if (meter >= 100 && !purged) {
      purged = true;
      crBonus = TUG_OF_WAR_PURGE_CR_BONUS;
      params.hero.overdrive = Math.min(100, params.hero.overdrive + TUG_OF_WAR_PURGE_OD_BONUS);
      nextEnemies = nextEnemies.map((e) =>
        e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget
          ? { ...e, staggered: true }
          : e,
      );
      params.cues.push({
        id: `cue_${params.combat.turn}_tug_purge`,
        kind: 'enemy_stagger',
        value: 100,
        textLabel: 'NEURAL PURGE! ALL STAGGERED',
      });
    }
  }

  return { tugOfWarMeter: meter, tugOfWarPurged: purged, crBonus, enemies: nextEnemies };
}

export function applyMercyVictoryBonus(
  combat: CombatState,
  hero: HeroState,
  enemies: readonly EnemyUnit[],
): { mercyCrBonus: number; mercyBonusAwarded: boolean | undefined } {
  const anyHostile = hasHostileLivingEnemies(enemies);
  if (!anyHostile && !combat.mercyBonusAwarded && enemies.some((e) => e.isMercyTarget && e.hp > 0)) {
    hero.hp = Math.min(hero.maxHp, hero.hp + MERCY_REWARD_HP);
    return { mercyCrBonus: MERCY_REWARD_CREDITS, mercyBonusAwarded: true };
  }
  return { mercyCrBonus: 0, mercyBonusAwarded: combat.mercyBonusAwarded };
}
