import type { CombatDirectorState, EnemyUnit } from './types';

export function updateDirectorAfterPlayerAction(
  director: CombatDirectorState | undefined,
  enemiesBefore: EnemyUnit[],
  enemiesAfter: EnemyUnit[],
  colorPlayed: 'attack' | 'defense' | 'tech' | null,
  surgeTriggered: boolean,
): { director: CombatDirectorState | undefined; enemies: EnemyUnit[] } {
  if (!director) {
    return { director, enemies: enemiesAfter };
  }

  let totalHitProgress = 0;
  const damagedEnemyIds = new Set<string>();

  for (let i = 0; i < enemiesAfter.length; i++) {
    const after = enemiesAfter[i];
    const before = enemiesBefore.find((b) => b.id === after.id);
    if (!before) continue;
    const delta =
      Math.max(0, before.hp - after.hp) +
      Math.max(0, before.armor - after.armor) +
      Math.max(0, before.shieldPips - after.shieldPips) * 3;
    if (delta > 0) {
      totalHitProgress += delta;
      damagedEnemyIds.add(after.id);
    }
  }

  const nextComposition = { ...director.compositionCounts };
  if (colorPlayed) {
    nextComposition[colorPlayed] += 1;
    if (surgeTriggered) {
      nextComposition.surges += 1;
    }
  }

  const nextDamageDealtThisTurn = director.damageDealtThisTurn + totalHitProgress;
  let nextTempoStreak = director.tempoStreak;
  let nextMaxTempoStreak = director.maxTempoStreak;
  let nextTempoCreditsEarned = director.tempoCreditsEarned;

  if (colorPlayed !== null) {
    if (nextDamageDealtThisTurn > 0) {
      nextTempoStreak = director.tempoStreak + 1;
      nextMaxTempoStreak = Math.max(nextMaxTempoStreak, nextTempoStreak);
      if (nextTempoStreak >= 2 && nextTempoCreditsEarned < 8) {
        nextTempoCreditsEarned = Math.min(8, nextTempoCreditsEarned + 2);
      }
    } else {
      nextTempoStreak = 0;
    }
  }

  const nextEnemies = enemiesAfter.map((enemy) => {
    if (enemy.hp <= 0) {
      return { ...enemy, sosCharging: false };
    }
    if (damagedEnemyIds.has(enemy.id)) {
      return {
        ...enemy,
        turnsWithoutDamage: 0,
        sosCharging: false,
      };
    }
    if (colorPlayed !== null) {
      const nextIdle = (enemy.turnsWithoutDamage ?? 0) + 1;
      return {
        ...enemy,
        turnsWithoutDamage: nextIdle,
      };
    }
    return enemy;
  });

  return {
    director: {
      ...director,
      compositionCounts: nextComposition,
      damageDealtThisTurn: nextDamageDealtThisTurn,
      tempoStreak: nextTempoStreak,
      maxTempoStreak: nextMaxTempoStreak,
      tempoCreditsEarned: nextTempoCreditsEarned,
    },
    enemies: nextEnemies,
  };
}
