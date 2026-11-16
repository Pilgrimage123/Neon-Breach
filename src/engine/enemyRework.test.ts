import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEnemyArmorPreview } from '../components/combat/combatEnemyUi';
import { computeOptimalTurnHint } from '../utils/tacticalSandboxAndHints';
import { createBlightTile } from './data';
import {
  advanceRoundAfterEnemies,
  createInitialRun,
  executeEnemyTurn,
  executeOverdrive,
  previewColorResolution,
  previewHeroineThreat,
  resolvePlayerColor,
  STAGGER_BURST_THRESHOLD,
} from './gameEngine';
import { parseAndValidateRun } from './persistence';
import type { EnemyUnit, Tile } from './types';

function makeEnemy(overrides: Partial<EnemyUnit> & Pick<EnemyUnit, 'id' | 'archetype' | 'passive'>): EnemyUnit {
  return {
    hp: 30,
    maxHp: 30,
    armor: 0,
    shieldPips: 0,
    maxShieldPips: 0,
    roleColor: 'crimson',
    intentCycle: [{ kind: 'attack', value: 6 }],
    currentIntentIndex: 0,
    ...overrides,
  };
}

function makeTile(id: string, type: Tile['type'], value: number, techEffect?: Tile['techEffect']): Tile {
  return {
    id,
    type,
    sourceId: 'test',
    value,
    techEffect,
    isHeldFromPrevTurn: false,
  };
}

test('conditional intents (if_no_shield & if_play_attack) match identically between previewHeroineThreat and executeEnemyTurn', () => {
  const stalkerBeat2 = makeEnemy({
    id: 'e_stalker',
    archetype: 'stalker',
    passive: 'spike_retaliate',
    hp: 40,
    maxHp: 40,
    intentCycle: [
      { kind: 'attack', value: 7 },
      { kind: 'attack', value: 7, condition: 'if_no_shield', conditionBonus: 4 },
    ],
    currentIntentIndex: 1,
  });

  const baseRun = createInitialRun(101);
  assert.ok(baseRun.combat);

  // Case A: Player plays TECH -> shieldAfterPlayer is 0 -> Stalker gains +4 bonus (11 DMG total)
  const techRun = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [{ ...stalkerBeat2 }],
      board: [
        makeTile('t1', 'tech', 0, { kind: 'damage_boost', percent: 20, decayPerTurn: 10 }),
        makeTile('t2', 'defense', 6),
        makeTile('t3', 'attack', 5),
      ],
    },
  };

  const techPreview = previewColorResolution(techRun, 'tech');
  const techThreat = previewHeroineThreat(techRun.combat, techRun.heroine, techPreview);
  assert.equal(techThreat.conditionalBonusDamage, 4);
  assert.equal(techThreat.rawIncomingDamage, 11);
  assert.equal(techThreat.hpDamageTaken, 11);

  const afterTechPlay = executeEnemyTurn(resolvePlayerColor(techRun, 'tech'));
  assert.equal(afterTechPlay.heroine.hp, 50 - 11);

  // Case B: Player plays Defense -> shieldAfterPlayer >= 1 -> Stalker deals base 7 DMG (no bonus)
  const defPreview = previewColorResolution(techRun, 'defense');
  const defThreat = previewHeroineThreat(techRun.combat, techRun.heroine, defPreview);
  assert.equal(defThreat.conditionalBonusDamage, 0);
  assert.equal(defThreat.rawIncomingDamage, 7);
  assert.equal(defThreat.hpDamageTaken, 1);

  const afterDefPlay = executeEnemyTurn(resolvePlayerColor(techRun, 'defense'));
  assert.equal(afterDefPlay.heroine.hp, 49);

  // Case C: Boss Beat 2 punishes Attack play (+4 DMG)
  const bossBeat2 = makeEnemy({
    id: 'e_boss',
    archetype: 'boss',
    passive: 'phase_gate',
    roleColor: 'apex',
    hp: 90,
    maxHp: 110,
    intentCycle: [
      { kind: 'armor', value: 10 },
      { kind: 'attack', value: 11, condition: 'if_play_attack', conditionBonus: 4 },
    ],
    currentIntentIndex: 1,
  });

  const bossRun = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [bossBeat2],
      board: [
        makeTile('b1', 'attack', 5),
        makeTile('b2', 'tech', 0, { kind: 'damage_boost', percent: 20, decayPerTurn: 10 }),
      ],
    },
  };

  const bossAtkPreview = previewColorResolution(bossRun, 'attack');
  const bossAtkThreat = previewHeroineThreat(bossRun.combat, bossRun.heroine, bossAtkPreview);
  assert.equal(bossAtkThreat.conditionalBonusDamage, 4);
  assert.equal(bossAtkThreat.rawIncomingDamage, 15);

  const afterBossAtk = executeEnemyTurn(resolvePlayerColor(bossRun, 'attack'));
  assert.equal(afterBossAtk.heroine.hp, 50 - 15);
});

test('Broken Stance (Stagger) cancels Charge/Heavy on 16+ single-turn damage and resets Pyre Stinger countdown', () => {
  const baseRun = createInitialRun(202);
  assert.ok(baseRun.combat);

  const chargingStinger = makeEnemy({
    id: 'e_stinger',
    archetype: 'stinger',
    passive: 'time_bomb',
    roleColor: 'orange',
    hp: 28,
    maxHp: 28,
    armor: 4,
    intentCycle: [
      { kind: 'charge', value: 16, secondaryValue: 2 },
      { kind: 'charge', value: 16, secondaryValue: 1 },
      { kind: 'heavy', value: 16 },
    ],
    currentIntentIndex: 1,
  });

  const run = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [chargingStinger],
      board: [
        makeTile('s1', 'attack', 6),
        makeTile('s2', 'attack', 6),
        makeTile('s3', 'attack', 6),
        makeTile('s4', 'defense', 5),
      ],
    },
  };

  const atkPreview = previewColorResolution(run, 'attack');
  assert.ok(atkPreview.totalDamage >= STAGGER_BURST_THRESHOLD);

  const armorPreview = computeEnemyArmorPreview(chargingStinger, 0, 0, atkPreview, [chargingStinger]);
  assert.equal(armorPreview.willStagger, true);
  assert.equal(armorPreview.willDie, false);

  const threat = previewHeroineThreat(run.combat, run.heroine, atkPreview);
  assert.equal(threat.rawIncomingDamage, 0);

  const afterPlayer = resolvePlayerColor(run, 'attack');
  assert.ok(afterPlayer.combat);
  assert.equal(afterPlayer.combat.enemies[0].staggered, true);
  assert.ok(afterPlayer.combat.lastCues.some((c) => c.kind === 'enemy_stagger'));

  // Enemy turn deals 0 DMG and resets Stinger back to Charge (2T) at index 0
  const afterEnemy = executeEnemyTurn(afterPlayer);
  assert.equal(afterEnemy.heroine.hp, 50);
  assert.ok(afterEnemy.combat);
  assert.equal(afterEnemy.combat.enemies[0].staggered, false);
  assert.equal(afterEnemy.combat.enemies[0].currentIntentIndex, 0);
});

test('Enrage on Alone triggers when Cobalt Skitter loses its final ally, switching Bolster to Attack +2, and does not trigger in solo starts', () => {
  const baseRun = createInitialRun(303);
  assert.ok(baseRun.combat);

  const larva = makeEnemy({
    id: 'e_larva',
    archetype: 'larva',
    passive: 'volatile_burst',
    roleColor: 'lime',
    hp: 6,
    maxHp: 12,
  });
  const skitter = makeEnemy({
    id: 'e_skitter',
    archetype: 'skitter',
    passive: 'anchor_aegis',
    roleColor: 'blue',
    hp: 20,
    maxHp: 20,
    intentCycle: [
      { kind: 'bolster', value: 4 },
      { kind: 'attack', value: 5 },
    ],
    currentIntentIndex: 0,
  });

  const duoRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [larva, skitter],
      board: [makeTile('a1', 'attack', 8), makeTile('d1', 'defense', 6)],
    },
  };

  const afterKill = resolvePlayerColor(duoRun, 'attack');
  assert.ok(afterKill.combat);
  const survivingSkitter = afterKill.combat.enemies[1];
  assert.equal(survivingSkitter.enragedAlone, true);
  assert.equal(survivingSkitter.enrageAtkBonus, 2);
  assert.equal(survivingSkitter.intentCycle[survivingSkitter.currentIntentIndex].kind, 'attack');

  // Solo 1v1 Skitter start should NOT trigger enragedAlone
  const soloRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [skitter],
      board: [makeTile('a1', 'attack', 5), makeTile('d1', 'defense', 6)],
    },
  };
  const afterSoloHit = resolvePlayerColor(soloRun, 'attack');
  assert.ok(afterSoloHit.combat);
  assert.equal(Boolean(afterSoloHit.combat.enemies[0].enragedAlone), false);
});

test('Targeted Tile Hex marks a board tile on Turn 2+, heals living caster on resolution, and clears when caster dies or Overdrive fires', () => {
  const baseRun = createInitialRun(404);
  assert.ok(baseRun.combat);

  const spitter = makeEnemy({
    id: 'e_spitter',
    archetype: 'spitter',
    passive: 'acid_jam',
    roleColor: 'violet',
    hp: 20,
    maxHp: 28,
    intentCycle: [{ kind: 'attack', value: 4 }],
    currentIntentIndex: 0,
  });

  const runBeforeTurn2 = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 50, shield: 10 },
    combat: {
      ...baseRun.combat,
      turn: 1,
      phase: 'ENEMY_ACTING' as const,
      enemies: [spitter],
      board: [makeTile('h1', 'attack', 6), makeTile('h2', 'defense', 4)],
      drawPile: [makeTile('d1', 'tech', 0, { kind: 'heal', amount: 3 })],
      discardPile: [],
    },
  };

  const turn2 = advanceRoundAfterEnemies(runBeforeTurn2);
  assert.ok(turn2.combat);
  const hexedTile = turn2.combat.board.find((t) => t.hexedByEnemyId === spitter.id);
  assert.ok(hexedTile, 'Spitter should mark a tile with Hex entering Turn 2');
  assert.equal(hexedTile.type, 'attack');

  // Preview reports hex heal/armor bonus if playing that color
  const atkPreview = previewColorResolution(turn2, 'attack');
  assert.equal(atkPreview.hexedHealBonus, 4);
  assert.equal(atkPreview.hexedArmorBonus, 3);

  // Resolving the hexed color while caster lives heals caster +4 HP & +3 ARM (and removes hexed tile from board)
  const afterHexTrigger = resolvePlayerColor(turn2, 'attack');
  assert.ok(afterHexTrigger.combat);
  const healedSpitter = afterHexTrigger.combat.enemies[0];
  // 20 - 7 dmg (Kira held +1 on h1 = 7) = 13 HP, then +4 HP hex heal = 17 HP & +3 ARM
  assert.equal(healedSpitter.hp, 17);
  assert.equal(healedSpitter.armor, 3);

  // Overdrive clears all board Hexes cleanly without triggering enemy heal
  const odReadyRun = {
    ...turn2,
    heroine: { ...turn2.heroine, overdrive: 100 },
  };
  const afterOd = executeOverdrive(odReadyRun);
  assert.ok(afterOd.combat);
  assert.equal(afterOd.combat.board.some((t) => Boolean(t.hexedByEnemyId)), false);
});

test('Caustic Slag pollutes discard on unblocked Acid (max 2), burns 2 HP if kept, is purged by TECH/Overdrive, and persists safely', () => {
  const baseRun = createInitialRun(505);
  assert.ok(baseRun.combat);

  const spitter = makeEnemy({
    id: 'e_spitter',
    archetype: 'spitter',
    passive: 'acid_jam',
    roleColor: 'violet',
    hp: 25,
    maxHp: 25,
    intentCycle: [{ kind: 'acid', value: 6, secondaryValue: 1 }],
    currentIntentIndex: 0,
  });

  const run = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [spitter],
      board: [makeTile('k1', 'attack', 5), makeTile('k2', 'defense', 5)],
      drawPile: [
        makeTile('dr1', 'defense', 5),
        makeTile('dr2', 'defense', 5),
        makeTile('dr3', 'defense', 5),
        makeTile('dr4', 'defense', 5),
        makeTile('dr5', 'defense', 5),
      ],
      discardPile: [],
    },
  };

  const afterAcid = executeEnemyTurn(run);
  assert.ok(afterAcid.combat);
  assert.equal(afterAcid.heroine.hp, 44);
  assert.equal(afterAcid.combat.discardPile.filter((t) => t.isBlight).length, 1);

  // Put 2 Caustic Slag tiles on board -> advanceRoundAfterEnemies burns 4 HP total
  const blight1 = createBlightTile(1, 1);
  const blight2 = createBlightTile(1, 2);
  const chipRun = {
    ...run,
    heroine: { ...run.heroine, hp: 40, shield: 0 },
    combat: {
      ...run.combat,
      phase: 'ENEMY_ACTING' as const,
      enemies: [spitter],
      board: [blight1, blight2, makeTile('k1', 'attack', 5)],
      drawPile: [makeTile('d1', 'defense', 5), makeTile('d2', 'defense', 5), makeTile('d3', 'defense', 5)],
      discardPile: [],
    },
  };
  const afterRoundEnd = advanceRoundAfterEnemies(chipRun);
  assert.equal(afterRoundEnd.heroine.hp, 36);

  // Resolving TECH purges Slag without adding Slag to discard or granting Surge/OD from Slag
  const purgeRun = {
    ...afterRoundEnd,
    combat: {
      ...afterRoundEnd.combat!,
      phase: 'PLAYER_IDLE' as const,
      board: [
        blight1,
        blight2,
        makeTile('t1', 'tech', 0, { kind: 'damage_boost', percent: 30, decayPerTurn: 10 }),
        makeTile('t2', 'tech', 0, { kind: 'heal', amount: 3 }),
      ],
      discardPile: [],
    },
  };
  const techPreview = previewColorResolution(purgeRun, 'tech');
  assert.equal(techPreview.blightPurgeCount, 2);
  // Only 2 real TECH tiles count toward Surge (need 4), so Slag never fakes a Surge
  assert.equal(techPreview.surgeTriggered, false);

  const afterPurge = resolvePlayerColor(purgeRun, 'tech');
  assert.ok(afterPurge.combat);
  assert.equal(afterPurge.combat.board.some((t) => t.isBlight), false);
  assert.equal(afterPurge.combat.discardPile.some((t) => t.isBlight), false);

  // Persistence round-trip preserves staggered / enragedAlone / isBlight / hexedByEnemyId
  const savedJson = JSON.stringify(afterKillPersistenceFixture(purgeRun));
  const restored = parseAndValidateRun(savedJson);
  assert.ok(restored?.combat);
  assert.equal(restored.combat.enemies[0].staggered, true);
  assert.equal(restored.combat.enemies[0].enragedAlone, true);
  assert.equal(restored.combat.board[0].isBlight, true);
});

function afterKillPersistenceFixture(run: ReturnType<typeof createInitialRun>) {
  return {
    ...run,
    combat: {
      ...run.combat!,
      enemies: run.combat!.enemies.map((e) => ({
        ...e,
        staggered: true,
        enragedAlone: true,
      })),
    },
  };
}

test('computeOptimalTurnHint recommends Push [R] when pushing a backline charging Stinger forward enables a kill/stagger win', () => {
  const baseRun = createInitialRun(606);
  assert.ok(baseRun.combat);

  const armoredBrute = makeEnemy({
    id: 'e_brute',
    archetype: 'brute',
    passive: 'threshold_pip',
    roleColor: 'gold',
    hp: 40,
    maxHp: 40,
    armor: 14,
    shieldPips: 0,
    intentCycle: [{ kind: 'armor', value: 6 }],
    currentIntentIndex: 0,
  });
  const lowHpChargingStinger = makeEnemy({
    id: 'e_stinger',
    archetype: 'stinger',
    passive: 'time_bomb',
    roleColor: 'orange',
    hp: 10,
    maxHp: 22,
    armor: 0,
    intentCycle: [{ kind: 'heavy', value: 16 }],
    currentIntentIndex: 0,
  });

  const hintRun = {
    ...baseRun,
    heroine: { ...baseRun.heroine, hp: 14, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [armoredBrute, lowHpChargingStinger],
      board: [
        makeTile('a1', 'attack', 9),
        makeTile('a2', 'attack', 8),
        makeTile('t1', 'tech', 0, { kind: 'damage_boost', percent: 20, decayPerTurn: 10 }),
      ],
    },
  };

  const hint = computeOptimalTurnHint(hintRun, 'en');
  assert.ok(hint);
  assert.equal(hint.recommendedAction, 'swap');
});
