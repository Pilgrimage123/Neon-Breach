import type { AnimationCue, EnemyUnit } from './types';
import {
  PHASE_GATE_ARMOR_BONUS,
  PLASMA_BARREL_BURST_DAMAGE,
  STAGGER_BURST_THRESHOLD,
  VOLATILE_BURST_DAMAGE,
} from './combatDefenseAndVictory';

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

  const effectivePierceRatio = breakArmorFirst ? 0 : Math.max(0.1, pierceRatio);
  const piercingDmg = Math.floor(damage * effectivePierceRatio);
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

export function triggerVolatileBursts(
  enemies: EnemyUnit[],
  newlyDefeatedIds: string[],
  turn: number,
  cues?: AnimationCue[],
): {
  enemies: EnemyUnit[];
  extraDefeated: number;
  extraDamageDealt: number;
  barrelPoppedCount: number;
} {
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
    if (sourceEnemy.propKind === 'bio_husk') continue;
    const isPlasmaBarrel = sourceEnemy.propKind === 'plasma_barrel';
    if (sourceEnemy.passive !== 'volatile_burst' && !isPlasmaBarrel) continue;
    if (isPlasmaBarrel) barrelPoppedCount++;
    const burstDmg = isPlasmaBarrel ? PLASMA_BARREL_BURST_DAMAGE : VOLATILE_BURST_DAMAGE;

    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].id === sourceId || nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
      const burstPierce = isPlasmaBarrel ? 0 : 1.0;
      const burstRes = applyDamageToEnemy(nextEnemies[i], burstDmg, burstPierce, false);
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

export function evaluateReactiveEnemyShifts(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
  turn: number,
  cues?: AnimationCue[],
): EnemyUnit[] {
  return enemiesAfter.map((after) => {
    if (after.hp <= 0 || after.escaped) {
      return { ...after, staggered: false };
    }
    const before = enemiesBefore.find((b) => b.id === after.id);
    const dmgDelta = before
      ? Math.max(0, before.hp - after.hp) + Math.max(0, before.armor - after.armor)
      : 0;
    const nextTurnDmg = (after.turnDamageTaken ?? 0) + dmgDelta;
    const safeIntentIdx =
      after.intentCycle.length > 0
        ? ((after.currentIntentIndex % after.intentCycle.length) + after.intentCycle.length) %
          after.intentCycle.length
        : 0;
    const intent = after.intentCycle[safeIntentIdx];

    let nextEnemy: EnemyUnit = {
      ...after,
      turnDamageTaken: nextTurnDmg,
    };

    if (
      intent &&
      (intent.kind === 'charge' || intent.kind === 'heavy') &&
      nextTurnDmg >= STAGGER_BURST_THRESHOLD
    ) {
      const newlyStaggered = !nextEnemy.staggered;
      nextEnemy = {
        ...nextEnemy,
        staggered: true,
      };
      if (newlyStaggered) {
        cues?.push({
          id: `cue_${turn}_stagger_${nextEnemy.id}`,
          kind: 'enemy_stagger',
          targetId: nextEnemy.id,
          value: nextTurnDmg,
          textLabel: 'STAGGERED',
        });
      }
    }

    return nextEnemy;
  });
}
