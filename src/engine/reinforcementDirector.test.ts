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
  previewHeroThreat,
  resolvePlayerColor,
} from './gameEngine';
import { parseAndValidateRun } from './persistence';
import { createSlagTile } from './poolBuilder';
import { createMercyDroneUnit, createPropUnit } from './encounterBuilder';
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

test('computePlayerMetaPower increases with equipped prototype chips and implants', () => {
  const baseRun = createInitialRun(12345, 'kira');
  const basePower = computePlayerMetaPower(baseRun.hero);

  const upgradedHero = {
    ...baseRun.hero,
    implants: ['monowire_edge' as const, 'aegis_capacitor' as const],
    ownedChips: [
      ...baseRun.hero.ownedChips,
      { instanceId: 'test_proto_1', defId: 'kill_chain_amp' },
    ],
    equippedInstanceIds: [...baseRun.hero.equippedInstanceIds, 'test_proto_1'],
  };
  const upgradedPower = computePlayerMetaPower(upgradedHero);

  assert.ok(upgradedPower > basePower);
  assert.ok(upgradedPower >= basePower + 6);
});

test('createCombatDirector tunes par caches, thresholds, and threat rates by node tier', () => {
  const run = createInitialRun(777, 'auraline');
  const layer0Dir = createCombatDirector('COMBAT', 0, run.hero);
  const eliteDir = createCombatDirector('ELITE', 2, run.hero);
  const bossDir = createCombatDirector('BOSS', 4, run.hero);

  assert.equal(layer0Dir.heatStage, 'low');
  assert.equal(layer0Dir.parCaches.length, 3);
  assert.deepEqual(
    layer0Dir.parCaches.map((c) => c.maxTurn),
    [3, 5, 7],
  );
  assert.ok(eliteDir.threatRatePerTurn >= layer0Dir.threatRatePerTurn);
  assert.equal(bossDir.parCaches[0].maxTurn, 6);
  assert.equal(bossDir.maxReinforcementsSpawned, 2);
});

test('telegraphed reinforcements count down, arrive at round end, cap at bridge slots, and never attack on arrival turn', () => {
  const run = createInitialRun(9991, 'kira');
  assert.ok(run.combat);
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.hero),
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
    hero: run.hero,
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 3,
    seed: 9991,
  });

  assert.equal(turn1Res.director.pendingReinforcements.length, 1);
  assert.equal(turn1Res.director.pendingReinforcements[0].turnsUntilDrop, 1);
  assert.equal(turn1Res.enemies.length, run.combat.enemies.length);

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

test('pickReinforcementArchetype enforces Layer-0 whitelist before adaptive counters and checks freeSlotCount', () => {
  const run = createInitialRun(555, 'zuri');
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 2, run.hero),
    compositionCounts: {
      attack: 0,
      defense: 4,
      tech: 0,
      surges: 0,
    },
  };

  let foundAdaptive = false;
  for (let turn = 1; turn <= 25; turn++) {
    const pick = pickReinforcementArchetype(director, 2, 'COMBAT', 100 + turn, turn, 10, 4);
    if (pick.reason === 'adaptive') {
      foundAdaptive = true;
      assert.ok(pick.archetype === 'spitter' || pick.archetype === 'stinger');
      break;
    }
  }
  assert.equal(foundAdaptive, true);

  // Layer-0 whitelist (only larva/skitter allowed) overrides adaptive spitter/stinger/stalker counters
  for (let turn = 1; turn <= 30; turn++) {
    const layer0Pick = pickReinforcementArchetype(director, 0, 'COMBAT', 100 + turn, turn, 20, 4);
    assert.ok(
      layer0Pick.archetype === 'larva' || layer0Pick.archetype === 'skitter',
      `Layer 0 must only pick larva or skitter even on adaptive roll, got ${layer0Pick.archetype}`,
    );
  }

  // With freeSlotCount === 1, 2-slot brute is excluded even with high budget
  for (let turn = 1; turn <= 30; turn++) {
    const narrowPick = pickReinforcementArchetype(director, 3, 'COMBAT', 200 + turn, turn, 20, 1);
    assert.notEqual(narrowPick.archetype, 'brute');
  }
});

test('dropReadyReinforcements maps 2-slot Brute bridge slots accurately without mis-indexing arrays', () => {
  const run = createInitialRun(7711, 'kira');
  assert.ok(run.combat);
  const brute = makeDummyEnemy({ id: 'dead_brute', archetype: 'brute', hp: 0, maxHp: 38 });
  const livingSkitter = makeDummyEnemy({ id: 'live_skitter', archetype: 'skitter', hp: 14 });
  const enemies = [brute, livingSkitter]; // spans slots [0,1] dead, [2] living!
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 2, run.hero),
    pendingReinforcements: [
      {
        id: 'drop_slot_0',
        archetype: 'larva',
        slotIndex: 0,
        turnsUntilDrop: 1,
        reason: 'threat_pool',
      },
    ],
  };

  const res = advanceDirectorAtRoundEnd({
    director,
    enemies,
    board: run.combat.board,
    hero: run.hero,
    nodeType: 'COMBAT',
    layer: 2,
    currentTurn: 2,
    seed: 7711,
  });
  // Living Skitter at array index 1 (slot 2) MUST NOT be clobbered!
  assert.ok(res.enemies.some((e) => e.id === 'live_skitter' && e.hp === 14));
  assert.ok(res.enemies.some((e) => e.isReinforcement));
});

test('rubber-banding delays imminent T-1 non-sweeper drop when hero <= 40% HP or lost >= 8 HP', () => {
  const run = createInitialRun(4242, 'kira');
  assert.ok(run.combat);
  const endangeredHero = {
    ...run.hero,
    hp: Math.floor(run.hero.maxHp * 0.35),
  };
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, endangeredHero),
    heroHpAtTurnStart: endangeredHero.maxHp,
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
    hero: endangeredHero,
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
  let director = createCombatDirector('COMBAT', 1, run.hero);
  const beforeEnemies = [makeDummyEnemy({ id: 'e1', hp: 20 })];
  const afterHitEnemies = [makeDummyEnemy({ id: 'e1', hp: 14 })];

  director = updateDirectorAfterPlayerAction(director, beforeEnemies, afterHitEnemies, 'attack', false).director!;
  assert.equal(director.tempoStreak, 1);
  assert.equal(director.tempoCreditsEarned, 0);
  director = { ...director, damageDealtThisTurn: 0 };

  for (let i = 0; i < 5; i++) {
    director = updateDirectorAfterPlayerAction(director, beforeEnemies, afterHitEnemies, 'attack', false).director!;
    director = { ...director, damageDealtThisTurn: 0 };
  }
  assert.equal(director.tempoStreak, 6);
  assert.equal(director.tempoCreditsEarned, 8);

  const passiveRes = updateDirectorAfterPlayerAction(director, beforeEnemies, beforeEnemies, 'defense', false);
  assert.equal(passiveRes.director!.tempoStreak, 0);
  assert.equal(passiveRes.director!.tempoCreditsEarned, 8);
});

test('par caches crumble past thresholds and Fast Clear Bonus triggers cleanly', () => {
  const run = createInitialRun(2020, 'kira');
  const director: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.hero),
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

  const fastWin = computeVictoryDirectorRewards(35, 3, director);
  assert.equal(fastWin.totalCredits, 35 + 14 + 4 + 9);

  const slowDir = { ...director, pendingReinforcements: [] };
  const slowWin = computeVictoryDirectorRewards(35, 9, slowDir);
  assert.equal(slowWin.totalCredits, 35 + 4);
});

test('overtime heat_jam skips Caustic Slag, Tier 1 suppresses sweepers, and props/mercy units do not trigger SOS flare', () => {
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

  // Overtime (turn 8) with 2 playable tiles + 2 slag tiles -> ONLY unjammed playable tile gets jammed, never slag!
  const overtimeDir: CombatDirectorState = {
    ...createCombatDirector('COMBAT', 1, run.hero),
    heatStage: 'overtime',
    overtimeTurnThreshold: 8,
    damageDealtThisTurn: 0,
    reinforcementsSpawnedCount: 2,
    maxReinforcementsSpawned: 2,
  };
  const boardWithSlag = [
    createSlagTile(1, 1),
    createSlagTile(1, 2),
    { ...run.combat.board[0], id: 'play_1', isJammed: false, isBlight: false },
    { ...run.combat.board[1], id: 'play_2', isJammed: false, isBlight: false },
  ];
  const otRes = advanceDirectorAtRoundEnd({
    director: overtimeDir,
    enemies: [loneEnemy],
    board: boardWithSlag,
    hero: { ...run.hero, hp: run.hero.maxHp },
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 7,
    seed: 3030,
  });
  assert.equal(otRes.director.heatStage, 'overtime');
  assert.equal(otRes.enemies[0].enrageAtkBonus, 1);
  assert.equal(otRes.director.overtimeHazardApplied, true);
  assert.ok(otRes.board.filter((t) => t.isBlight).every((t) => !t.isJammed));
  assert.ok(otRes.board.filter((t) => t.isJammed).length === 1);
  assert.ok(otRes.director.pendingReinforcements.some((d) => d.isZeroReward && d.reason === 'sweeper'));

  // Tier 1 Story suppresses Overtime Sweepers
  const tier1OtRes = advanceDirectorAtRoundEnd({
    director: { ...overtimeDir, damageDealtThisTurn: 10 },
    enemies: [loneEnemy],
    board: run.combat.board,
    hero: { ...run.hero, hp: run.hero.maxHp },
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 15,
    seed: 3030,
    difficultyTier: 1,
  });
  assert.ok(!tier1OtRes.director.pendingReinforcements.some((d) => d.reason === 'sweeper'));

  // Escaped / prop / mercy units do not count toward livingNow SOS / threat spawns
  const propAndMercyOnly = [
    { ...loneEnemy, id: 'escaped_1', escaped: true, hp: 10 },
    createPropUnit('plasma_barrel', 'p1'),
    createMercyDroneUnit('m1'),
  ];
  const noHostilesRes = advanceDirectorAtRoundEnd({
    director: overtimeDir,
    enemies: propAndMercyOnly,
    board: run.combat.board,
    hero: run.hero,
    nodeType: 'COMBAT',
    layer: 1,
    currentTurn: 7,
    seed: 3030,
  });
  assert.equal(noHostilesRes.director.pendingReinforcements.length, 0);

  // Verify Enrage ATK matches across execution, preview, and UI formatter
  const enragedEnemy = otRes.enemies[0];
  assert.equal(getEffectiveEnemyIntentValue(enragedEnemy, enragedEnemy.intentCycle[0]), 8);
  assert.equal(formatEnemyIntentCompact(enragedEnemy.intentCycle[0], 'en', enragedEnemy.enrageAtkBonus), '8');
  assert.equal(formatEnemyIntentSummary(enragedEnemy.intentCycle[0], 'en', enragedEnemy.enrageAtkBonus), '8 DMG');

  const enragedCombatIdle = {
    ...run.combat,
    phase: 'PLAYER_IDLE' as const,
    enemies: [enragedEnemy],
    director: otRes.director,
  };
  assert.equal(previewHeroThreat(enragedCombatIdle, run.hero, null).rawIncomingDamage, 8);
  const afterEnemyHit = executeSingleEnemyAction(
    {
      ...run,
      hero: { ...run.hero, shield: 0 },
      combat: { ...enragedCombatIdle, phase: 'ENEMY_ACTING' as const },
    },
    0,
  );
  assert.equal(afterEnemyHit.hero.hp, run.hero.maxHp - 8);
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
        ...createCombatDirector('COMBAT', 1, run.hero),
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
        i < 3
          ? { ...t, type: 'attack' as const, value: 4, isJammed: false }
          : { ...t, type: 'defense' as const, value: 6, isJammed: false },
      ),
    },
  };

  const afterWin = resolvePlayerColor(winReadyRun, 'attack');
  assert.ok(afterWin.combat);
  assert.equal(afterWin.combat.phase, 'VICTORY');
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
