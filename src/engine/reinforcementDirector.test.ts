import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDirectorAtRoundEnd,
  computePlayerMetaPower,
  computeVictoryDirectorRewards,
  createCombatDirector,
  getEffectiveEnemyIntentValue,
  MAX_ACTIVE_BRIDGE_ENEMIES,
  pickReinforcementArchetype,
  updateDirectorAfterPlayerAction,
} from './reinforcementDirector';
import {
  advanceRoundAfterEnemies,
  createInitialRun,
  executeSingleEnemyAction,
  previewHeroineThreat,
  resolvePlayerColor,
} from './gameEngine';
import { parseAndValidateRun } from './persistence';
import { formatEnemyIntentCompact, formatEnemyIntentSummary } from '../components/combat/combatEnemyUi';
import type { CombatDirectorState, EnemyUnit } from './types';

function makeDummyEnemy(overrides: Partial<EnemyUnit> = {}): EnemyUnit {
  return {
    id: 'enemy_dummy_1',
    archetype: 'skitter',
    hp: 20,
    maxHp: 20,
    armor: 0,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'anchor_aegis',
    roleColor: 'blue',
    intentCycle: [{ kind: 'attack', value: 6 }],
    currentIntentIndex: 0,
    ...overrides,
  };
}

test('computePlayerMetaPower increases with equipped rare gear weight and implants', () => {
  const baseRun = createInitialRun(12345, 'kira');
  const basePower = computePlayerMetaPower(baseRun.heroine);

  const upgradedHeroine = {
    ...baseRun.heroine,
    implants: ['monowire_edge' as const, 'aegis_capacitor' as const],
    ownedEquipment: [
      ...baseRun.heroine.ownedEquipment,
      { instanceId: 'test_rare_1', defId: 'takticky_zesilovac' },
    ],
    equippedInstanceIds: [...baseRun.heroine.equippedInstanceIds, 'test_rare_1'],
  };
  const upgradedPower = computePlayerMetaPower(upgradedHeroine);

  assert.ok(upgradedPower > basePower);
  assert.ok(upgradedPower >= basePower + 6);
});

test('createCombatDirector tunes par caches, thresholds, and threat rates by node tier', () => {
  const run = createInitialRun(777, 'aurelia');
  const layer0Dir = createCombatDirector('COMBAT', 0, run.heroine);
  const eliteDir = createCombatDirector('ELITE', 2, run.heroine);
  const bossDir = createCombatDirector('BOSS', 4, run.heroine);

  assert.equal(layer0Dir.heatStage, 'low');
  assert.equal(layer0Dir.parCaches.length, 3);
  assert.deepEqual(
    layer0Dir.parCaches.map((c) => c.maxTurn),
    [3, 5, 7],
  );
  assert.ok(eliteDir.threatRatePerTurn >= layer0Dir.threatRatePerTurn);
  assert.equal(bossDir.parCaches[0].maxTurn, 6);
  assert.equal(bossDir.maxReinforcementsSpawned, 3);
});

test('telegraphed reinforcements count down, arrive at round end, cap at 3 bridge slots, and never attack on arrival turn', () => {
  const run = createInitialRun(9991, 'kira');
  assert.ok(run.combat);
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.heroine),
    heatStage: 'medium',
    threatPool: 8,
    pendingReinforcements: [
      {
        id: 'drop_test_1',
        archetype: 'larva',
        slotIndex: 2,
        turnsUntilDrop: 2,
        reason: 'threat_pool',
      },
    ],
  };

  const turn1Res = advanceDirectorAtRoundEnd({
    director,
    enemies: run.combat.enemies,
    board: run.combat.board,
    heroine: run.heroine,
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 3,
    seed: 9991,
  });

  // First round end drops countdown from 2 -> 1 without spawning yet
  assert.equal(turn1Res.director.pendingReinforcements.length, 1);
  assert.equal(turn1Res.director.pendingReinforcements[0].turnsUntilDrop, 1);
  assert.equal(turn1Res.enemies.length, run.combat.enemies.length);

  // Second round end lands the drop and lets player act immediately (arrival turn = 0 DMG from newcomer)
  const preRoundState = {
    ...run,
    combat: {
      ...run.combat,
      turn: 4,
      phase: 'ENEMY_ACTING' as const,
      director: turn1Res.director,
      enemies: turn1Res.enemies,
    },
  };
  const afterArrival = advanceRoundAfterEnemies(preRoundState);
  assert.ok(afterArrival.combat);
  assert.equal(afterArrival.combat.phase, 'PLAYER_IDLE');
  assert.ok(afterArrival.combat.enemies.length <= MAX_ACTIVE_BRIDGE_ENEMIES);
  const newcomer = afterArrival.combat.enemies.find((e) => e.isReinforcement);
  assert.ok(newcomer);
  assert.equal(newcomer.archetype, 'larva');
  assert.ok(afterArrival.combat.lastCues.some((c) => c.kind === 'enemy_reinforce'));
});

test('pickReinforcementArchetype includes composition-adaptive soft counters when player favors defense or surges', () => {
  const run = createInitialRun(555, 'zuri');
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 2, run.heroine),
    compositionCounts: {
      attack: 0,
      defense: 4,
      tech: 0,
      surges: 0,
    },
  };

  let foundAdaptive = false;
  for (let turn = 1; turn <= 25; turn++) {
    const pick = pickReinforcementArchetype(director, 2, 'COMBAT', 100 + turn, turn, 10);
    if (pick.reason === 'adaptive') {
      foundAdaptive = true;
      assert.ok(pick.archetype === 'spitter' || pick.archetype === 'stinger');
      break;
    }
  }
  assert.equal(foundAdaptive, true);
});

test('rubber-banding delays an imminent T-1 non-sweeper drop when heroine is <= 40% HP or lost >= 8 HP', () => {
  const run = createInitialRun(4242, 'kira');
  assert.ok(run.combat);
  const endangeredHeroine = {
    ...run.heroine,
    hp: Math.floor(run.heroine.maxHp * 0.35),
  };
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, endangeredHeroine),
    heroineHpAtRoundStart: endangeredHeroine.maxHp,
    pendingReinforcements: [
      {
        id: 'drop_rb_1',
        archetype: 'skitter',
        slotIndex: 2,
        turnsUntilDrop: 1,
        reason: 'threat_pool',
        isZeroReward: false,
      },
    ],
  };

  const res = advanceDirectorAtRoundEnd({
    director,
    enemies: run.combat.enemies,
    board: run.combat.board,
    heroine: endangeredHeroine,
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 4,
    seed: 4242,
  });

  assert.equal(res.director.rubberBandDelayed, true);
  assert.equal(res.director.pendingReinforcements.length, 1);
  assert.equal(res.director.pendingReinforcements[0].turnsUntilDrop, 1);
  assert.equal(res.enemies.length, run.combat.enemies.length);
});

test('tempo streak rewards consecutive damaging turns (capped at +8 CR) and resets on passive turns', () => {
  const run = createInitialRun(1010, 'kira');
  let director = createCombatDirector('COMBAT', 1, run.heroine);
  const beforeEnemies = [makeDummyEnemy({ id: 'e1', hp: 20 })];
  const afterHitEnemies = [makeDummyEnemy({ id: 'e1', hp: 14 })];

  // Turn 1: hit (+0 bonus yet, streak 1)
  director = updateDirectorAfterPlayerAction(director, beforeEnemies, afterHitEnemies, 'attack', false).director!;
  assert.equal(director.tempoStreak, 1);
  assert.equal(director.tempoCreditsEarned, 0);
  director = { ...director, damageDealtThisTurn: 0 };

  // Turns 2..6: consecutive hits -> +2 CR each up to +8 CR cap
  for (let i = 0; i < 5; i++) {
    director = updateDirectorAfterPlayerAction(director, beforeEnemies, afterHitEnemies, 'attack', false).director!;
    director = { ...director, damageDealtThisTurn: 0 };
  }
  assert.equal(director.tempoStreak, 6);
  assert.equal(director.tempoCreditsEarned, 8);

  // Passive defense turn with 0 enemy progress resets streak to 0 while keeping earned CR
  const passiveRes = updateDirectorAfterPlayerAction(director, beforeEnemies, beforeEnemies, 'defense', false);
  assert.equal(passiveRes.director!.tempoStreak, 0);
  assert.equal(passiveRes.director!.tempoCreditsEarned, 8);
});

test('par caches crumble past thresholds and Fast Clear Bonus triggers when winning with pending drops or inside Par T1', () => {
  const run = createInitialRun(2020, 'kira');
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.heroine), // Par: [4, 6, 8], rewards: [9, 6, 4]
    tempoCreditsEarned: 4,
    pendingReinforcements: [
      {
        id: 'drop_fast_1',
        archetype: 'skitter',
        slotIndex: 2,
        turnsUntilDrop: 1,
        reason: 'threat_pool',
      },
    ],
  };

  // Win on Turn 3 (inside all 3 Par thresholds + 1 intercepted drop)
  const fastWin = computeVictoryDirectorRewards(35, 3, director);
  assert.equal(fastWin.breakdown.baseCredits, 35);
  assert.equal(fastWin.breakdown.parCacheCredits, 9 + 6 + 4);
  assert.equal(fastWin.breakdown.intactParCount, 3);
  assert.equal(fastWin.breakdown.tempoCredits, 4);
  assert.equal(fastWin.breakdown.fastClearCredits, 9);
  assert.equal(fastWin.totalCredits, 35 + 19 + 4 + 9);

  // Win on Turn 9 (past all 3 Par thresholds and no intercepted drops)
  const slowDir = { ...director, pendingReinforcements: [] };
  const slowWin = computeVictoryDirectorRewards(35, 9, slowDir);
  assert.equal(slowWin.breakdown.parCacheCredits, 0);
  assert.equal(slowWin.breakdown.intactParCount, 0);
  assert.equal(slowWin.breakdown.fastClearCredits, 0);
  assert.equal(slowWin.totalCredits, 35 + 4);
});

test('anti-stalling: lone survivor triggers SOS Flare, and Overtime adds enrage + heat jam + zero-reward sweeper synced with UI & preview', () => {
  const run = createInitialRun(3030, 'kira');
  assert.ok(run.combat);
  const loneEnemy = makeDummyEnemy({
    id: 'lone_1',
    archetype: 'skitter',
    hp: 16,
    maxHp: 20,
    turnsWithoutDamage: 2,
    intentCycle: [{ kind: 'attack', value: 7 }],
  });

  // Low Heat Turn 3 lone idle enemy -> SOS Flare telegraph
  const sosDir: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.heroine),
    heatStage: 'low',
    overtimeTurnThreshold: 8,
  };
  const sosRes = advanceDirectorAtRoundEnd({
    director: sosDir,
    enemies: [loneEnemy],
    board: run.combat.board,
    heroine: run.heroine,
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 2,
    seed: 3030,
  });
  assert.equal(sosRes.enemies[0].sosCharging, true);
  assert.equal(sosRes.director.pendingReinforcements.length, 1);
  assert.equal(sosRes.director.pendingReinforcements[0].reason, 'sos_flare');

  // Overtime (turn 8) + passive stalling (damageDealtThisTurn === 0) -> enrage +1 ATK + 1 jammed tile + sweeper
  const overtimeDir: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.heroine),
    heatStage: 'overtime',
    overtimeTurnThreshold: 8,
    damageDealtThisTurn: 0,
    reinforcementsSpawnedCount: 2,
    maxReinforcementsSpawned: 2,
  };
  const otRes = advanceDirectorAtRoundEnd({
    director: overtimeDir,
    enemies: [loneEnemy],
    board: run.combat.board,
    heroine: { ...run.heroine, hp: run.heroine.maxHp },
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 7, // advances to Turn 8 -> overtime
    seed: 3030,
  });
  assert.equal(otRes.director.heatStage, 'overtime');
  assert.equal(otRes.enemies[0].enrageAtkBonus, 1);
  assert.equal(otRes.director.overtimeHazardApplied, true);
  assert.equal(otRes.board.filter((t) => t.isJammed).length, 1);
  assert.ok(otRes.director.pendingReinforcements.some((d) => d.isZeroReward && d.reason === 'sweeper'));

  // Verify Enrage ATK (+1 -> 8 DMG) matches across engine execution, threat preview, and UI formatter
  const enragedEnemy = otRes.enemies[0];
  assert.equal(getEffectiveEnemyIntentValue(enragedEnemy, enragedEnemy.intentCycle[0]), 8);
  assert.equal(formatEnemyIntentCompact(enragedEnemy.intentCycle[0], 'en', enragedEnemy.enrageAtkBonus), '8 DMG');
  assert.equal(formatEnemyIntentSummary(enragedEnemy.intentCycle[0], 'en', enragedEnemy.enrageAtkBonus), '8 DMG');

  const enragedCombatIdle = {
    ...run.combat,
    phase: 'PLAYER_IDLE' as const,
    enemies: [enragedEnemy],
    director: otRes.director,
  };
  const preview = previewHeroineThreat(enragedCombatIdle, run.heroine, null);
  assert.equal(preview.rawIncomingDamage, 8);

  const afterEnemyHit = executeSingleEnemyAction(
    {
      ...run,
      heroine: { ...run.heroine, shield: 0 },
      combat: { ...enragedCombatIdle, phase: 'ENEMY_ACTING' as const },
    },
    0,
  );
  assert.equal(afterEnemyHit.heroine.hp, run.heroine.maxHp - 8);
});

test('persistence round-trip preserves combat director pending drops, par caches, and zero-reward enemies', () => {
  const run = createInitialRun(8181, 'kira');
  assert.ok(run.combat);
  const enriched = {
    ...run,
    combat: {
      ...run.combat,
      enemies: run.combat.enemies.map((e, idx) =>
        idx === 0 ? { ...e, enrageAtkBonus: 2, sosCharging: true, isZeroReward: true } : e,
      ),
      director: {
        ...createCombatDirector('COMBAT', 1, run.heroine),
        heatStage: 'medium' as const,
        tempoStreak: 3,
        tempoCreditsEarned: 4,
        pendingReinforcements: [
          {
            id: 'drop_persist_1',
            archetype: 'stinger' as const,
            slotIndex: 2,
            turnsUntilDrop: 1,
            reason: 'reactive' as const,
            isZeroReward: false,
          },
        ],
      },
    },
  };

  const hydrated = parseAndValidateRun(JSON.stringify(enriched));
  assert.ok(hydrated && hydrated.combat && hydrated.combat.director);
  assert.equal(hydrated.combat.director.heatStage, 'medium');
  assert.equal(hydrated.combat.director.tempoStreak, 3);
  assert.equal(hydrated.combat.director.pendingReinforcements.length, 1);
  assert.equal(hydrated.combat.director.pendingReinforcements[0].archetype, 'stinger');
  assert.equal(hydrated.combat.enemies[0].enrageAtkBonus, 2);
  assert.equal(hydrated.combat.enemies[0].sosCharging, true);
  assert.equal(hydrated.combat.enemies[0].isZeroReward, true);
});

test('zero-reward sweeper kill awards 0 score while normal resolvePlayerColor win computes rewardBreakdown', () => {
  const run = createInitialRun(4444, 'kira');
  assert.ok(run.combat);
  const weakSweeper = makeDummyEnemy({
    id: 'sweeper_1',
    hp: 3,
    maxHp: 12,
    isReinforcement: true,
    isZeroReward: true,
  });
  const winReadyRun = {
    ...run,
    combat: {
      ...run.combat,
      enemies: [weakSweeper],
      board: run.combat.board.map((t, i) =>
        i < 3 ? { ...t, type: 'attack' as const, value: 4, isJammed: false } : t,
      ),
    },
  };

  const afterWin = resolvePlayerColor(winReadyRun, 'attack');
  assert.ok(afterWin.combat);
  assert.equal(afterWin.combat.phase, 'VICTORY');
  // Zero-reward sweeper kill grants 0 kill bonus (damageAdded * 2 only = 12 * 2 = 24), vs normal kill (+50)
  assert.equal(afterWin.score, run.score + 24);
  assert.ok(afterWin.combat.rewardBreakdown);
  assert.ok(afterWin.combat.rewardCredits >= 35);

  const normalWinRun = {
    ...winReadyRun,
    combat: {
      ...winReadyRun.combat,
      enemies: [{ ...weakSweeper, isZeroReward: false }],
    },
  };
  const afterNormalWin = resolvePlayerColor(normalWinRun, 'attack');
  assert.equal(afterNormalWin.score, run.score + 24 + 50);
});
