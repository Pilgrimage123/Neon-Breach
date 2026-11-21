import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AURALINE_MEMORY_CAPACITY,
  KIRA_MEMORY_CAPACITY,
  MAX_UPCHARGE_BOARD_CAPACITY,
  ZURI_MEMORY_CAPACITY,
} from './data';
import { buildEnemiesForNode } from './encounterBuilder';
import { getEquippedChipMemory } from './poolBuilder';
import {
  advanceRoundAfterEnemies,
  claimCombatChipReward,
  createInitialRun,
  drawToSix,
  enrollCharterProdigyTile,
  executeEnemyTurn,
  executeOverdrive,
  executeSingleEnemyAction,
  getEffectiveTileValue,
  previewColorResolution,
  previewHeroThreat,
  resolveCyberEventChoice,
  resolvePlayerColor,
  sortTilesByGroup,
  spliceFabLabTiles,
  startNodeEncounter,
} from './gameEngine';
import { computeEnemyArmorPreview } from '../components/combat/combatEnemyUi';
import type { RunState, Tile } from './types';

function makeTile(
  id: string,
  type: Tile['type'],
  value: number,
  isHeldFromPrevTurn = false,
  techEffect?: Tile['techEffect'],
): Tile {
  return {
    id,
    type,
    sourceId: 'test',
    value,
    techEffect,
    isHeldFromPrevTurn,
  };
}

test('initial run builds Kira 9-tile pool (5 innate + 4 starting chips, 3/12 Memory, 4 ATK · 3 DEF · 2 TECH) and draws 6', () => {
  const run = createInitialRun(42);
  assert.ok(run.combat);
  assert.equal(run.hero.hp, 58);
  assert.equal(run.hero.maxHp, 58);
  assert.equal(run.hero.credits, 45);
  assert.equal(run.hero.memoryCapacity, KIRA_MEMORY_CAPACITY);
  assert.equal(getEquippedChipMemory(run.hero), 3);
  assert.equal(run.masterPool.length, 9);

  const atk4 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 4);
  const atk3 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 3);
  const atk5 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 5);
  const def8 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 8);
  const def6 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 6);
  const def7 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 7);
  const dmgBoosts = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'damage_boost' && t.techEffect.percent === 42,
  );
  const heal3 = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'heal' && t.techEffect.amount === 3,
  );

  assert.equal(atk4.length, 1);
  assert.equal(atk3.length, 1);
  assert.equal(atk5.length, 2);
  assert.equal(def8.length, 1);
  assert.equal(def6.length, 1);
  assert.equal(def7.length, 1);
  assert.equal(dmgBoosts.length, 1);
  assert.equal(heal3.length, 1);

  assert.equal(run.combat.board.length, 6);
  assert.equal(run.combat.drawPile.length, 3);
  assert.equal(run.combat.discardPile.length, 0);
});

test('resolving one color sums explicit tile values, keeps unresolved tiles, and refills to 6', () => {
  const customBoard: Tile[] = [
    makeTile('t1', 'attack', 5),
    makeTile('t2', 'attack', 2),
    makeTile('t3', 'defense', 7),
    makeTile('t4', 'defense', 8),
    makeTile('t5', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('t6', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const base = createInitialRun(101);
  assert.ok(base.combat);
  const seededRun = {
    ...base,
    combat: {
      ...base.combat,
      board: customBoard,
      blitzReflexCooldown: 1,
    },
  };

  const preview = previewColorResolution(seededRun, 'attack');
  assert.equal(preview.tileCount, 2);
  assert.equal(preview.stayCount, 4);
  assert.equal(preview.baseDamage, 7);
  assert.equal(preview.totalDamage, 7);

  const afterAttack = resolvePlayerColor(seededRun, 'attack');
  assert.ok(afterAttack.combat);
  assert.equal(afterAttack.combat.board.length, 4);
  assert.equal(afterAttack.combat.discardPile.length, 2);
  assert.ok(afterAttack.combat.board.every((t) => t.type !== 'attack'));

  const nextRound = executeEnemyTurn(afterAttack);
  assert.ok(nextRound.combat);
  assert.equal(nextRound.combat.turn, 2);
  assert.equal(nextRound.combat.board.length, 6);

  const heldCount = nextRound.combat.board.filter((t) => t.isHeldFromPrevTurn).length;
  const freshCount = nextRound.combat.board.filter((t) => !t.isHeldFromPrevTurn).length;
  assert.equal(heldCount, 4);
  assert.equal(freshCount, 2);
});

test('TECH Damage booster stacks additively, boosts ATK, decays 10%/turn, preserves pre-combat Event boost into combat, and resets on combat exit', () => {
  const customBoard: Tile[] = [
    makeTile('a1', 'attack', 5),
    makeTile('a2', 'attack', 5),
    makeTile('d1', 'defense', 7),
    makeTile('u1', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('u2', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('u3', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const base = createInitialRun(202);
  assert.ok(base.combat);
  const seededRun = {
    ...base,
    hero: { ...base.hero, hp: 50, maxHp: 60 },
    combat: {
      ...base.combat,
      board: customBoard,
      enemies: [{ ...base.combat.enemies[0], hp: 50, armor: 0 }],
    },
  };

  const techPreview = previewColorResolution(seededRun, 'tech');
  assert.equal(techPreview.damageBoostAddedPct, 102);
  assert.equal(techPreview.healAmount, 2);
  assert.equal(techPreview.overdriveGained, 36);

  const afterTech = resolvePlayerColor(seededRun, 'tech');
  assert.equal(afterTech.hero.damageBoostPct, 102);
  assert.equal(afterTech.hero.hp, 52);

  const round2 = executeEnemyTurn(afterTech);
  assert.equal(round2.hero.damageBoostPct, 92);

  const atkRun = {
    ...round2,
    combat: {
      ...round2.combat!,
      board: [makeTile('x1', 'attack', 5), makeTile('x2', 'attack', 5)],
    },
  };
  const atkPrev = previewColorResolution(atkRun, 'attack');
  assert.equal(atkPrev.baseDamage, 10);
  assert.equal(atkPrev.damageBoostPct, 92);
  assert.equal(atkPrev.totalDamage, Math.floor(10 * 1.92));

  const mapReady = claimCombatChipReward(
    {
      ...round2,
      combat: { ...round2.combat!, phase: 'VICTORY' },
    },
    null,
  );
  assert.equal(mapReady.hero.damageBoostPct, 0, 'Combat exit clears leftover damageBoostPct');

  // Event rewardDamageBoostPct carries into the next combat node (Regression check!)
  const eventNode = mapReady.mapNodes.find((n) => n.type === 'EVENT');
  if (eventNode) {
    const preEventBoostRun: RunState = {
      ...mapReady,
      screen: 'event',
      currentNodeId: eventNode.id,
      hero: { ...mapReady.hero, credits: 100 },
      activeEvent: {
        id: 'test_boost',
        title: 'Test Boost',
        subtitle: 'Test',
        story: 'Boost test',
        choices: [
          {
            id: 'boost_20',
            label: 'Boost',
            description: '+20% DMG',
            rewardDamageBoostPct: 20,
          },
        ],
      },
    };
    const afterEvent = resolveCyberEventChoice(preEventBoostRun, 0);
    assert.equal(afterEvent.hero.damageBoostPct, 20);
    const nextCombatNode = afterEvent.mapNodes.find((n) => n.type === 'COMBAT')!;
    const enteredCombat = startNodeEncounter(afterEvent, nextCombatNode.id);
    assert.equal(
      enteredCombat.hero.damageBoostPct,
      20,
      'startNodeEncounter must preserve Event rewardDamageBoostPct',
    );
  }
});

test('drawToSix recycles discardPile deterministically when drawPile is exhausted', () => {
  const board: Tile[] = [makeTile('held1', 'attack', 5, true)];
  const drawPile: Tile[] = [makeTile('draw1', 'defense', 7)];
  const discardPile: Tile[] = [
    makeTile('disc1', 'attack', 2),
    makeTile('disc2', 'tech', 0, false, { kind: 'heal', amount: 2 }),
    makeTile('disc3', 'defense', 8),
    makeTile('disc4', 'attack', 5),
    makeTile('disc5', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
  ];

  const res = drawToSix(board, drawPile, discardPile, 77, 3);
  assert.equal(res.board.length, 6);
  assert.equal(res.board[0].id, 'held1');
  assert.equal(res.board[0].isHeldFromPrevTurn, true);
  assert.equal(res.discardPile.length, 0);
  assert.equal(res.drawPile.length, 1);
});

test('stack surge triggers at 4+ tiles or 3+ with Surge Resonator implant, including TECH surge', () => {
  const board: Tile[] = [
    makeTile('a1', 'attack', 5),
    makeTile('a2', 'attack', 5),
    makeTile('a3', 'attack', 2),
    makeTile('d1', 'defense', 7),
    makeTile('d2', 'defense', 8),
    makeTile('u1', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const base = createInitialRun(303);
  assert.ok(base.combat);
  const runWithoutImplant = {
    ...base,
    combat: { ...base.combat, board },
  };
  assert.equal(previewColorResolution(runWithoutImplant, 'attack').surgeTriggered, false);

  const runWithImplant = {
    ...runWithoutImplant,
    hero: { ...runWithoutImplant.hero, implants: ['surge_resonator' as const] },
  };
  const surgePreview = previewColorResolution(runWithImplant, 'attack');
  assert.equal(surgePreview.surgeTriggered, true);
  assert.equal(surgePreview.totalDamage, 12);
  assert.equal(surgePreview.cleaveDamage, 6);

  const techSurgeBoard: Tile[] = [
    makeTile('t1', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('t2', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('t3', 'tech', 0, false, { kind: 'heal', amount: 2 }),
    makeTile('a1', 'attack', 5),
  ];
  const techSurgePrev = previewColorResolution(
    { ...runWithImplant, combat: { ...runWithImplant.combat, board: techSurgeBoard } },
    'tech',
  );
  assert.equal(techSurgePrev.surgeTriggered, true);
  assert.equal(techSurgePrev.overdriveGained, 51);
  assert.equal(techSurgePrev.shieldGained, 6);
});

test('Kira Overdrive (Energy Dropkick) executes 14 frontline kick + knockback + 10 all-enemy shockwave, grants +8 shield, and syncs zero-reward kill & victory bookkeeping', () => {
  const base = createInitialRun(404);
  assert.ok(base.combat);
  const chargedRun = {
    ...base,
    hero: { ...base.hero, overdrive: 100 },
    combat: {
      ...base.combat,
      enemies: [{ ...base.combat.enemies[0], hp: 30, armor: 10 }],
    },
  };

  const afterOd = executeOverdrive(chargedRun);
  assert.ok(afterOd.combat);
  assert.equal(afterOd.hero.overdrive, 0);
  assert.equal(afterOd.hero.shield, 8);
  assert.equal(afterOd.hero.damageBoostPct, 0);
  assert.equal(afterOd.combat.enemies[0].armor, 0);
  assert.equal(afterOd.combat.enemies[0].hp, 16);
  assert.equal(afterOd.combat.phase, 'PLAYER_IDLE');

  // Regression: Overdrive killing zero-reward sweeper awards 0 kill score and increments turnsCompleted on victory
  const zeroRewardOdRun = {
    ...base,
    hero: { ...base.hero, overdrive: 100 },
    combat: {
      ...base.combat,
      enemies: [{ ...base.combat.enemies[0], hp: 10, armor: 0, isZeroReward: true }],
    },
  };
  const afterZeroOdWin = executeOverdrive(zeroRewardOdRun);
  assert.equal(afterZeroOdWin.combat?.phase, 'VICTORY');
  assert.equal(afterZeroOdWin.score, base.score + 80);
  assert.equal(afterZeroOdWin.turnsCompleted, base.turnsCompleted + 1);
});

test('all 10 cybernetic implants function deterministically in combat preview & resolution, and Bio-Siphon never resurrects a dead hero', () => {
  const base = createInitialRun(606);
  assert.ok(base.combat);

  const board: Tile[] = [
    makeTile('a1', 'attack', 5, true),
    makeTile('a2', 'attack', 5, false),
    makeTile('d1', 'defense', 7, false),
    makeTile('d2', 'defense', 8, false),
    makeTile('u1', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
    makeTile('u2', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const atkRun = {
    ...base,
    hero: {
      ...base.hero,
      implants: ['monowire_edge' as const, 'plasma_amp' as const, 'piercing_katana' as const],
    },
    combat: {
      ...base.combat,
      board,
      enemies: [{ ...base.combat.enemies[0], hp: 40, armor: 10 }],
    },
  };
  const atkPrev = previewColorResolution(atkRun, 'attack');
  assert.equal(atkPrev.totalDamage, 17);
  assert.equal(atkPrev.armorPiercing, true);
  const afterAtk = resolvePlayerColor(atkRun, 'attack');
  assert.equal(afterAtk.combat?.enemies[0].armor, 0);
  assert.equal(afterAtk.combat?.enemies[0].hp, 33);

  const defRun = {
    ...base,
    hero: {
      ...base.hero,
      implants: ['nano_weave' as const, 'aegis_capacitor' as const, 'kinetic_reflector' as const],
    },
    combat: {
      ...base.combat,
      board,
      enemies: [
        {
          ...base.combat.enemies[0],
          hp: 20,
          armor: 0,
          intentCycle: [{ kind: 'attack' as const, value: 6 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const defPrev = previewColorResolution(defRun, 'defense');
  assert.equal(defPrev.shieldGained, 19);
  const afterDef = resolvePlayerColor(defRun, 'defense');
  const afterEnemy = executeEnemyTurn(afterDef);
  assert.equal(afterEnemy.hero.shield, 6);
  assert.equal(afterEnemy.combat?.enemies[0].hp, 17);

  const techRun = {
    ...base,
    hero: {
      ...base.hero,
      implants: ['synapse_overclock' as const, 'flux_injector' as const],
    },
    combat: { ...base.combat, board },
  };
  const techPrev = previewColorResolution(techRun, 'tech');
  assert.equal(techPrev.shieldGained, 6);
  assert.equal(techPrev.overdriveGained, 34);
  assert.equal(techPrev.damageBoostAddedPct, 51);
  assert.equal(techPrev.healAmount, 2);

  const siphonRun = {
    ...base,
    hero: { ...base.hero, hp: 40, maxHp: 60, implants: ['bio_siphon' as const] },
    combat: {
      ...base.combat,
      board,
      enemies: [{ ...base.combat.enemies[0], hp: 5, armor: 0 }],
    },
  };
  const afterKill = resolvePlayerColor(siphonRun, 'attack');
  assert.equal(afterKill.hero.hp, 44);

  // Regression: lethal Spike Retaliation + chain burst kill must NOT resurrect hero at 4 HP via Bio-Siphon
  const lethalRetaliateRun: RunState = {
    ...base,
    hero: { ...base.hero, hp: 3, maxHp: 60, shield: 0, armor: 0, implants: ['bio_siphon'] },
    combat: {
      ...base.combat,
      board: [
        { ...makeTile('a_hp', 'attack', 5), isHotPotato: true },
        makeTile('a_reg', 'attack', 5),
      ],
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'stalker_front',
          archetype: 'stalker',
          passive: 'spike_retaliate',
          hp: 25,
          maxHp: 25,
          armor: 0,
        },
        {
          ...base.combat.enemies[0],
          id: 'larva_back',
          archetype: 'larva',
          passive: 'volatile_burst',
          hp: 9,
          maxHp: 9,
          armor: 0,
        },
      ],
    },
  };
  const potatoKillRun: RunState = {
    ...lethalRetaliateRun,
    combat: {
      ...lethalRetaliateRun.combat!,
      board: [
        makeTile('a1', 'attack', 5),
        { ...makeTile('a2', 'attack', 5), isTemptation: true },
      ],
      enemies: [
        lethalRetaliateRun.combat!.enemies[0],
        { ...lethalRetaliateRun.combat!.enemies[1], hp: 10 },
      ],
    },
  };
  const previewDead = previewHeroThreat(
    potatoKillRun.combat,
    potatoKillRun.hero,
    previewColorResolution(potatoKillRun, 'attack'),
  );
  const resolvedDead = resolvePlayerColor(potatoKillRun, 'attack');
  assert.equal(resolvedDead.hero.hp, 0);
  assert.equal(resolvedDead.screen, 'gameover');
  assert.equal(previewDead.willDie, true);
});

test('multi-enemy cleave and armor break trigger on 4+ attack stack surge', () => {
  const base = createInitialRun(707);
  assert.ok(base.combat);
  const board: Tile[] = [
    makeTile('a1', 'attack', 5),
    makeTile('a2', 'attack', 5),
    makeTile('a3', 'attack', 5),
    makeTile('a4', 'attack', 5),
    makeTile('d1', 'defense', 7),
    makeTile('u1', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const multiRun = {
    ...base,
    combat: {
      ...base.combat,
      board,
      enemies: [
        { ...base.combat.enemies[0], id: 'e1', hp: 30, armor: 15 },
        { ...base.combat.enemies[0], id: 'e2', hp: 25, armor: 0 },
      ],
    },
  };

  const res = resolvePlayerColor(multiRun, 'attack');
  assert.ok(res.combat);
  assert.equal(res.combat.enemies[0].armor, 0);
  assert.equal(res.combat.enemies[0].hp, 10);
  assert.equal(res.combat.enemies[1].hp, 15);
});

test('staggered executeSingleEnemyAction, Kinetic Reflector zero-reward score, and defense stack surge work cleanly', () => {
  const base = createInitialRun(950);
  const eliteNode = base.mapNodes.find((n) => n.type === 'ELITE');
  assert.ok(eliteNode);
  const eliteRun = startNodeEncounter(base, eliteNode.id);
  assert.ok(eliteRun.combat);

  const afterPlayer = {
    ...eliteRun,
    hero: { ...eliteRun.hero, hp: 60, shield: 10 },
    combat: {
      ...eliteRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      board: eliteRun.combat.board.slice(0, 4),
    },
  };

  const step1 = executeSingleEnemyAction(afterPlayer, 0);
  assert.equal(step1.combat?.phase, 'ENEMY_ACTING');
  assert.equal(step1.combat?.enemies[0].armor, 14);
  assert.equal(step1.combat?.turn, 1);

  const step2 = executeSingleEnemyAction(step1, 1);
  assert.equal(step2.hero.shield, 5);
  assert.equal(step2.hero.corrode, 2);
  assert.equal(step2.combat?.phase, 'ENEMY_ACTING');

  const nextRound = advanceRoundAfterEnemies(step2);
  assert.equal(nextRound.combat?.phase, 'PLAYER_IDLE');
  assert.equal(nextRound.combat?.turn, 2);
  assert.equal(nextRound.combat?.board.length, 6);
  assert.equal(nextRound.hero.corrode, 1);

  const defBase = createInitialRun(980);
  assert.ok(defBase.combat);
  const defSurgeRun = {
    ...defBase,
    combat: {
      ...defBase.combat,
      board: [
        makeTile('d1', 'defense', 7),
        makeTile('d2', 'defense', 8),
        makeTile('d3', 'defense', 7),
        makeTile('d4', 'defense', 8),
        makeTile('a1', 'attack', 5),
      ],
      enemies: [{ ...defBase.combat.enemies[0], hp: 8, armor: 0 }],
    },
  };
  const afterDefKill = resolvePlayerColor(defSurgeRun, 'defense');
  assert.equal(afterDefKill.combat?.phase, 'VICTORY');
  assert.equal(afterDefKill.combat?.totalDamageDealt, 8);
  assert.equal(afterDefKill.turnsCompleted, 1);
  assert.equal(afterDefKill.score, 8 * 2 + 50);

  // Kinetic Reflector zero-reward KO grants 0 kill score
  const reflectorZeroRun = {
    ...defBase,
    hero: { ...defBase.hero, shield: 10, implants: ['kinetic_reflector' as const] },
    combat: {
      ...defBase.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [
        {
          ...defBase.combat.enemies[0],
          hp: 3,
          armor: 0,
          isZeroReward: true,
          intentCycle: [{ kind: 'attack' as const, value: 5 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const afterReflectZero = executeSingleEnemyAction(reflectorZeroRun, 0);
  assert.equal(afterReflectZero.combat?.phase, 'VICTORY');
  assert.equal(afterReflectZero.score, 3 * 2);
});

test('sortTilesByGroup clusters tiles by color, held status, and higher explicit value first', () => {
  const mixedBoard: Tile[] = [
    makeTile('u1', 'tech', 0, false, { kind: 'heal', amount: 2 }),
    makeTile('d1', 'defense', 7, false),
    makeTile('a2', 'attack', 2, false),
    makeTile('a1', 'attack', 5, false),
    makeTile('a3', 'attack', 2, true),
  ];

  const sorted = sortTilesByGroup(mixedBoard);
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['a3', 'a1', 'a2', 'd1', 'u1'],
  );
});

test('previewHeroThreat accurately models incoming damage, kills, shields, and heals', () => {
  const base = createInitialRun(101);
  assert.ok(base.combat);

  const testRun = {
    ...base,
    hero: {
      ...base.hero,
      hp: 12,
      maxHp: 60,
      shield: 2,
      implants: ['bio_siphon' as const],
    },
    combat: {
      ...base.combat,
      phase: 'PLAYER_IDLE' as const,
      board: [
        makeTile('a1', 'attack', 9),
        makeTile('a2', 'attack', 9),
        makeTile('d1', 'defense', 7),
        makeTile('d2', 'defense', 7),
        makeTile('t1', 'tech', 0, false, { kind: 'heal', amount: 6 }),
        makeTile('t2', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
      ],
      enemies: [
        {
          id: 'e1',
          archetype: 'stalker' as const,
          hp: 15,
          maxHp: 24,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'spike_retaliate' as const,
          roleColor: 'crimson' as const,
          intentCycle: [{ kind: 'attack' as const, value: 9 }],
          currentIntentIndex: 0,
        },
        {
          id: 'e2',
          archetype: 'spitter' as const,
          hp: 20,
          maxHp: 22,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'acid_jam' as const,
          roleColor: 'blue' as const,
          intentCycle: [{ kind: 'acid' as const, value: 6, secondaryValue: 2 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  const idleThreat = previewHeroThreat(testRun.combat, testRun.hero, null);
  assert.equal(idleThreat.rawIncomingDamage, 15);
  assert.equal(idleThreat.blockedDamage, 2);
  assert.equal(idleThreat.hpDamageTaken, 13);
  assert.equal(idleThreat.projectedHp, 0);
  assert.equal(idleThreat.willDie, true);

  const atkPreview = previewColorResolution(testRun, 'attack');
  const atkThreat = previewHeroThreat(testRun.combat, testRun.hero, atkPreview);
  assert.equal(atkThreat.preventedDamageByKills, 9);
  assert.equal(atkThreat.healGained, 4);
  assert.equal(atkThreat.projectedHp, 12);
  assert.equal(atkThreat.willDie, false);

  const defPreview = previewColorResolution(testRun, 'defense');
  const defThreat = previewHeroThreat(testRun.combat, testRun.hero, defPreview);
  assert.equal(defThreat.shieldAfterPlayer, 16);
  assert.equal(defThreat.hpDamageTaken, 0);

  const techPreview = previewColorResolution(testRun, 'tech');
  const techThreat = previewHeroThreat(testRun.combat, testRun.hero, techPreview);
  assert.equal(techThreat.healGained, 6);
  assert.equal(techThreat.projectedHp, 5);
});

test('Auraline Juggernaut stats, Armor, 3 Duds, UpCharge, and Overdrive work accurately', () => {
  const auralineRun = createInitialRun(42, 'auraline');
  assert.ok(auralineRun.combat);
  assert.equal(auralineRun.hero.characterId, 'auraline');
  assert.equal(auralineRun.hero.hp, 78);
  assert.equal(auralineRun.hero.maxHp, 78);
  assert.equal(auralineRun.hero.armor, 18);
  assert.equal(auralineRun.hero.memoryCapacity, AURALINE_MEMORY_CAPACITY);
  assert.equal(getEquippedChipMemory(auralineRun.hero), 4);
  assert.equal(auralineRun.masterPool.filter((t) => Boolean(t.isDud)).length, 3);

  const auralineDefBoard = {
    ...auralineRun,
    hero: { ...auralineRun.hero, armor: 18, overdrive: 0, pendingUpcharge: 0 },
    combat: {
      ...auralineRun.combat,
      board: [
        makeTile('ad1', 'defense', 8),
        { ...makeTile('ad2', 'defense', 0), isDud: true },
      ],
      drawPile: Array.from({ length: 8 }, (_, idx) => makeTile(`dp${idx}`, 'attack', 6)),
      enemies: [
        {
          ...auralineRun.combat.enemies[0],
          hp: 25,
          armor: 0,
          intentCycle: [{ kind: 'attack' as const, value: 12 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const defPrev = previewColorResolution(auralineDefBoard, 'defense');
  assert.equal(defPrev.shieldGained, 8);
  assert.equal(defPrev.upchargeGained, 1);
  assert.equal(defPrev.armorGained, 3);

  const afterDef = resolvePlayerColor(auralineDefBoard, 'defense');
  const afterRound = executeEnemyTurn(afterDef);
  assert.equal(afterRound.hero.armor, 17);
  assert.equal(afterRound.hero.hp, 78);
  assert.equal(afterRound.combat?.board.length, 7);

  const odRes = executeOverdrive({
    ...auralineRun,
    hero: { ...auralineRun.hero, overdrive: 100, armor: 10, pendingUpcharge: 0 },
    combat: {
      ...auralineRun.combat,
      enemies: [{ ...auralineRun.combat.enemies[0], hp: 30, armor: 10, shieldPips: 0 }],
    },
  });
  assert.equal(odRes.hero.armor, 20);
  assert.equal(odRes.hero.pendingUpcharge, 2);
  assert.equal(odRes.combat?.enemies[0].armor, 0);
  assert.equal(odRes.combat?.enemies[0].hp, 20);
});

test('Zuri starter stats, Swarm Uplink passive, Solar Swarm Protocol Overdrive work accurately', () => {
  const zuriRun = createInitialRun(42, 'zuri');
  assert.ok(zuriRun.combat);
  assert.equal(zuriRun.hero.characterId, 'zuri');
  assert.equal(zuriRun.hero.hp, 62);
  assert.equal(zuriRun.hero.memoryCapacity, ZURI_MEMORY_CAPACITY);
  assert.ok(zuriRun.hero.ownedChips.some((eq) => eq.defId === 'swarm_vector'));
  assert.ok(zuriRun.hero.ownedChips.some((eq) => eq.defId === 'sanctuary_mesh'));

  const odRes = executeOverdrive({
    ...zuriRun,
    hero: { ...zuriRun.hero, overdrive: 100, shield: 2, damageBoostPct: 10, corrode: 3 },
    combat: {
      ...zuriRun.combat,
      enemies: [{ ...zuriRun.combat.enemies[0], hp: 30, armor: 15, shieldPips: 0 }],
    },
  });
  assert.equal(odRes.hero.shield, 10);
  assert.equal(odRes.hero.corrode, 1);
  assert.equal(odRes.combat?.enemies[0].hp, 17);
  assert.equal(odRes.combat?.enemies[0].armor, 0);
});

test('Moving Lock enemy rules, Bio-Husk exclusion from Volatile Burst, and Defense+Attack/Tech spliced hybrid tiles', () => {
  const base = createInitialRun(1337, 'kira');
  assert.ok(base.combat);

  // 1. Aegis Pip & Phase Gate
  const bossNode = base.mapNodes.find((n) => n.type === 'BOSS')!;
  const bossRun = startNodeEncounter(base, bossNode.id);
  const gatedBoss = resolvePlayerColor(
    {
      ...bossRun,
      combat: {
        ...bossRun.combat!,
        board: [makeTile('a1', 'attack', 40), makeTile('a2', 'attack', 40)],
        enemies: [
          {
            ...bossRun.combat!.enemies[0],
            hp: 80,
            maxHp: 110,
            armor: 0,
            shieldPips: 0,
            phaseGatePct: 50,
            phaseGateTriggered: false,
          },
        ],
      },
    },
    'attack',
  ).combat!.enemies[0];
  assert.equal(gatedBoss.hp, 55);
  assert.equal(gatedBoss.armor, 10);
  assert.equal(gatedBoss.shieldPips, 1);

  // 2. Bio-Husk prop must NOT explode like a Spore Mite when destroyed
  const bioHuskKillRun: RunState = {
    ...base,
    combat: {
      ...base.combat,
      board: [makeTile('a1', 'attack', 10)],
      enemies: [
        {
          id: 'prop_bio_husk_1',
          archetype: 'stalker',
          hp: 6,
          maxHp: 8,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'volatile_burst',
          roleColor: 'violet',
          propKind: 'bio_husk',
          reviveTimer: 2,
          intentCycle: [{ kind: 'armor', value: 0 }],
          currentIntentIndex: 0,
          isZeroReward: true,
        },
        {
          id: 'bystander_1',
          archetype: 'stalker',
          hp: 20,
          maxHp: 24,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'spike_retaliate',
          roleColor: 'crimson',
          intentCycle: [{ kind: 'attack', value: 6 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const afterHuskKill = resolvePlayerColor(bioHuskKillRun, 'attack');
  assert.equal(
    afterHuskKill.combat?.enemies[1].hp,
    20,
    'Destroying a bio_husk prop must not deal Bio-Rupture burst damage to allies',
  );

  // 3. Defense+Attack & Tech+Attack spliced hybrid tiles apply in preview & resolution + computeEnemyArmorPreview
  const clinicState: RunState = {
    ...base,
    screen: 'clinic',
  };
  const defTile = clinicState.masterPool.find((t) => t.type === 'defense')!;
  const atkTile = clinicState.masterPool.find((t) => t.type === 'attack')!;
  const afterDefSplice = spliceFabLabTiles(clinicState, defTile.id, atkTile.id);
  const splicedDef = afterDefSplice.masterPool.find((t) => t.id === defTile.id)!;
  assert.equal(splicedDef.secondaryType, 'attack');

  const hybridDefCombat: RunState = {
    ...afterDefSplice,
    screen: 'combat',
    combat: {
      ...base.combat,
      board: [{ ...splicedDef, isHeldFromPrevTurn: false }],
      enemies: [{ ...base.combat.enemies[0], hp: 20, armor: 8, shieldPips: 0 }],
    },
  };
  const hybridDefPreview = previewColorResolution(hybridDefCombat, 'defense');
  assert.ok(hybridDefPreview.techPierceDamage >= 3);
  const armorPreview = computeEnemyArmorPreview(
    hybridDefCombat.combat!.enemies[0],
    0,
    0,
    hybridDefPreview,
    hybridDefCombat.combat!.enemies,
  );
  assert.equal(armorPreview.previewHpLoss, hybridDefPreview.techPierceDamage);
  const afterHybridDef = resolvePlayerColor(hybridDefCombat, 'defense');
  assert.equal(
    afterHybridDef.combat?.enemies[0].hp,
    20 - hybridDefPreview.techPierceDamage,
    'Defense+Attack spliced tile pierces Armor in combat just like preview',
  );

  // Tech+Attack splice
  const techTile = clinicState.masterPool.find((t) => t.type === 'tech')!;
  const afterTechSplice = spliceFabLabTiles(clinicState, techTile.id, atkTile.id);
  const splicedTech = afterTechSplice.masterPool.find((t) => t.id === techTile.id)!;
  const techHybridPreview = previewColorResolution(
    {
      ...afterTechSplice,
      screen: 'combat',
      combat: { ...base.combat, board: [{ ...splicedTech, isHeldFromPrevTurn: false }] },
    },
    'tech',
  );
  assert.ok(techHybridPreview.techPierceDamage >= 3);
});

test('Duds + Implant salvage, UpCharge Chips capped at 9 board tiles, and Armor blocks Acid Jam', () => {
  const auraline = createInitialRun(505, 'auraline');
  assert.ok(auraline.combat);

  const dudSalvageRun: RunState = {
    ...auraline,
    hero: {
      ...auraline.hero,
      implants: ['plasma_amp', 'synapse_overclock'],
      armor: 18,
      pendingUpcharge: 0,
    },
    combat: {
      ...auraline.combat,
      board: [
        { ...makeTile('d_atk', 'attack', 0), isDud: true, upcharge: 1 },
        { ...makeTile('d_tech', 'tech', 0), isDud: true },
        { ...makeTile('a_uc', 'attack', 5), upcharge: 2 },
        makeTile('a_reg', 'attack', 6),
      ],
      drawPile: Array.from({ length: 8 }, (_, idx) => makeTile(`extra_${idx}`, 'defense', 7)),
      enemies: [
        {
          ...auraline.combat.enemies[0],
          archetype: 'spitter',
          passive: 'acid_jam',
          hp: 30,
          maxHp: 30,
          armor: 0,
          intentCycle: [{ kind: 'acid', value: 8, secondaryValue: 2 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  const atkPrev = previewColorResolution(dudSalvageRun, 'attack');
  assert.equal(atkPrev.totalDamage, 17);
  assert.equal(atkPrev.upchargeGained, 4);

  const afterAtk = resolvePlayerColor(dudSalvageRun, 'attack');
  const afterSpitterTurn = executeEnemyTurn(afterAtk);
  assert.equal(afterSpitterTurn.hero.armor, 13);
  assert.equal(afterSpitterTurn.hero.hp, 78);
  assert.equal(afterSpitterTurn.combat?.board.length, MAX_UPCHARGE_BOARD_CAPACITY);
  assert.ok(!afterSpitterTurn.combat?.board.some((t) => t.isJammed));

  const newEn = buildEnemiesForNode('COMBAT', 1, 777, 0);
  assert.ok(newEn.length >= 2);
});

test('full Moving Lock rules, TECH effects, Zuri Swarm Uplink, and armorDamage vs shieldDamage cues', () => {
  const base = createInitialRun(1337, 'kira');
  assert.ok(base.combat);

  // 1. Aegis Pip negates full hit while Armor remains intact
  const pipRes = resolvePlayerColor(
    {
      ...base,
      combat: {
        ...base.combat,
        board: [makeTile('a1', 'attack', 20), makeTile('a2', 'attack', 10)],
        enemies: [
          {
            ...base.combat.enemies[0],
            id: 'skitter-1',
            archetype: 'skitter',
            hp: 15,
            maxHp: 15,
            armor: 4,
            shieldPips: 1,
            maxShieldPips: 1,
            passive: 'anchor_aegis',
            roleColor: 'blue',
          },
        ],
      },
    },
    'attack',
  );
  assert.equal(pipRes.combat?.enemies[0].shieldPips, 0);
  assert.equal(pipRes.combat?.enemies[0].hp, 15);
  assert.equal(pipRes.combat?.enemies[0].armor, 4);

  // 2. Spore Mite Bio-Rupture (6 Pierce) + Chitin Stalker Spike Retaliation & Surge bypass
  const burstRes = resolvePlayerColor(
    {
      ...base,
      combat: {
        ...base.combat,
        board: [makeTile('a1', 'attack', 10)],
        enemies: [
          { ...base.combat.enemies[0], id: 'larva-1', archetype: 'larva', hp: 9, armor: 0, passive: 'volatile_burst' },
          { ...base.combat.enemies[0], id: 'stalker-1', archetype: 'stalker', hp: 20, armor: 6, passive: 'spike_retaliate' },
        ],
      },
    },
    'attack',
  );
  assert.equal(burstRes.combat?.enemies[0].hp, 0);
  assert.equal(burstRes.combat?.enemies[1].hp, 14);
  assert.equal(burstRes.combat?.enemies[1].armor, 6);

  const nonSurgeStalker = resolvePlayerColor(
    {
      ...base,
      hero: { ...base.hero, hp: 40, shield: 1 },
      combat: {
        ...base.combat,
        board: [makeTile('a1', 'attack', 5), makeTile('a2', 'attack', 5)],
        enemies: [{ ...base.combat.enemies[0], archetype: 'stalker', hp: 22, armor: 0, passive: 'spike_retaliate' }],
      },
    },
    'attack',
  );
  assert.equal(nonSurgeStalker.hero.shield, 0);
  assert.equal(nonSurgeStalker.hero.hp, 38);

  const surgeStalkerPrev = previewColorResolution(
    {
      ...base,
      combat: {
        ...base.combat,
        board: [
          makeTile('a1', 'attack', 3),
          makeTile('a2', 'attack', 3),
          makeTile('a3', 'attack', 3),
          makeTile('a4', 'attack', 3),
        ],
        enemies: [{ ...base.combat.enemies[0], archetype: 'stalker', hp: 22, armor: 0, passive: 'spike_retaliate' }],
      },
    },
    'attack',
  );
  assert.equal(surgeStalkerPrev.surgeTriggered, true);
  assert.equal(surgeStalkerPrev.retaliateDamage, 0);

  // 3. Bile Spitter Acid Tile Jamming & next-turn jam clear + new TECH effects + Bloodline getEffectiveTileValue
  const jamRun = executeSingleEnemyAction(
    {
      ...base,
      hero: { ...base.hero, hp: 40, shield: 0 },
      combat: {
        ...base.combat,
        phase: 'PLAYER_RESOLVED',
        board: [makeTile('a1', 'attack', 6), makeTile('d1', 'defense', 6)],
        enemies: [
          {
            ...base.combat.enemies[0],
            archetype: 'spitter',
            passive: 'acid_jam',
            intentCycle: [{ kind: 'acid', value: 5, secondaryValue: 2 }],
            currentIntentIndex: 0,
          },
        ],
      },
    },
    0,
  );
  const nextWithJam = advanceRoundAfterEnemies(jamRun);
  assert.equal(nextWithJam.combat?.board.filter((t) => t.isJammed).length, 1);

  const techRes = resolvePlayerColor(
    {
      ...base,
      hero: { ...base.hero, corrode: 3, overdrive: 10, bloodlineCrest: { primary: 'defense', secondary: 'attack', bonusValue: 2 } },
      combat: {
        ...base.combat,
        bloodlineResonanceActive: 'attack',
        board: [
          makeTile('t1', 'tech', 0, false, { kind: 'armor_shred', shredAmount: 10, pierceDamage: 4 }),
          makeTile('t2', 'tech', 0, false, { kind: 'overdrive_surge', bonusOverdrive: 15, cleanseCorrode: 2 }),
          makeTile('t3', 'tech', 0, false, { kind: 'tactical_shield', shieldAmount: 5, damageBoostPct: 22 }),
        ],
        enemies: [{ ...base.combat.enemies[0], hp: 30, armor: 8, shieldPips: 0 }],
      },
    },
    'tech',
  );
  assert.equal(techRes.combat?.enemies[0].hp, 26);
  assert.equal(techRes.hero.corrode, 1);
  assert.equal(techRes.hero.shield, 5);
  assert.equal(getEffectiveTileValue(makeTile('atk_test', 'attack', 5), techRes.hero, 'attack').flatBonus, 2);

  // 4. executeEnemyTurn emits armorDamage=0 on full Shield block vs armorDamage=6 when Armor absorbs
  const striker = {
    ...base.combat.enemies[0],
    hp: 20,
    maxHp: 20,
    shieldPips: 0,
    armor: 0,
    currentIntentIndex: 0,
    intentCycle: [{ kind: 'attack' as const, value: 6 }],
  };
  const afterShieldBlock = executeEnemyTurn({
    ...base,
    hero: { ...base.hero, hp: 30, maxHp: 30, shield: 10, armor: 5 },
    combat: { ...base.combat, phase: 'PLAYER_RESOLVED', enemies: [striker] },
  });
  const shieldCue = afterShieldBlock.combat?.lastCues.find((c) => c.kind === 'enemy_attack');
  assert.equal(shieldCue?.hpDamage, 0);
  assert.equal(shieldCue?.armorDamage, 0);

  const afterArmorBlock = executeEnemyTurn({
    ...base,
    hero: { ...base.hero, hp: 30, maxHp: 30, shield: 0, armor: 8 },
    combat: { ...base.combat, phase: 'PLAYER_RESOLVED', enemies: [striker] },
  });
  const armorCue = afterArmorBlock.combat?.lastCues.find((c) => c.kind === 'enemy_attack');
  assert.equal(armorCue?.hpDamage, 0);
  assert.equal(armorCue?.armorDamage, 6);
  assert.equal(afterArmorBlock.hero.armor, 2);
});

test('executeOverdrive and executeSingleEnemyAction keep masterPool synced on victory and guard out-of-range enemy intents', () => {
  const base = createInitialRun(2026, 'kira');
  assert.ok(base.combat);

  const bossNode = base.mapNodes.find((n) => n.type === 'BOSS')!;
  const bossRun = startNodeEncounter(base, bossNode.id);
  assert.ok(bossRun.combat);

  const trialInstanceId = 'beta_trial_test_chip';
  const trialTile = { ...makeTile('trial_tile_1', 'attack', 6), sourceId: trialInstanceId };
  const heroWithTrial = {
    ...bossRun.hero,
    overdrive: 100,
    ownedChips: [
      ...bossRun.hero.ownedChips,
      { instanceId: trialInstanceId, defId: 'overclock_surge' },
    ],
    equippedInstanceIds: [...bossRun.hero.equippedInstanceIds, trialInstanceId],
    betaTrialChip: {
      defId: 'overclock_surge',
      instanceId: trialInstanceId,
      combatsRemaining: 1,
      resolvesLogged: 0,
      upgraded: false,
    },
  };

  // 1. Overdrive victory on BOSS expires 1-combat Beta Trial chip AND rebuilds masterPool so no orphan tiles remain
  const odVictoryRun: RunState = {
    ...bossRun,
    hero: heroWithTrial,
    masterPool: [...bossRun.masterPool, trialTile],
    combat: {
      ...bossRun.combat,
      enemies: [
        {
          ...bossRun.combat.enemies[0],
          hp: 10,
          armor: 0,
          shieldPips: 0,
          phaseGatePct: undefined,
        },
      ],
    },
  };
  const afterOdVictory = executeOverdrive(odVictoryRun);
  assert.equal(afterOdVictory.combat?.phase, 'VICTORY');
  assert.equal(
    afterOdVictory.hero.ownedChips.some((c) => c.instanceId === trialInstanceId),
    false,
    'Beta Trial chip with combatsRemaining=1 should expire on BOSS Overdrive victory',
  );
  assert.equal(
    afterOdVictory.masterPool.some((t) => t.sourceId === trialInstanceId),
    false,
    'masterPool must be rebuilt without tiles from expired Beta Trial chip on Overdrive victory',
  );

  // 2. Kinetic Reflector victory on BOSS increments heirloomStacks AND syncs masterPool
  const engravedDefId = bossRun.hero.ownedChips[0].defId;
  const reflectorBossRun: RunState = {
    ...bossRun,
    hero: {
      ...heroWithTrial,
      shield: 15,
      implants: ['kinetic_reflector'],
      heirloomEngravedId: engravedDefId,
      heirloomStacks: 0,
    },
    masterPool: [...bossRun.masterPool, trialTile],
    combat: {
      ...bossRun.combat,
      phase: 'PLAYER_RESOLVED',
      enemies: [
        {
          ...bossRun.combat.enemies[0],
          hp: 2,
          armor: 0,
          shieldPips: 0,
          phaseGatePct: undefined,
          intentCycle: [{ kind: 'attack', value: 8 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const afterReflectorBoss = executeSingleEnemyAction(reflectorBossRun, 0);
  assert.equal(afterReflectorBoss.combat?.phase, 'VICTORY');
  assert.equal(afterReflectorBoss.hero.heirloomStacks, 1);
  assert.equal(
    afterReflectorBoss.masterPool.some((t) => t.sourceId === trialInstanceId),
    false,
    'masterPool must sync on Reflector victory',
  );

  // 3. Out-of-bounds currentIntentIndex and empty intentCycle never throw in executeSingleEnemyAction or previewHeroThreat
  const oobIntentRun: RunState = {
    ...base,
    combat: {
      ...base.combat,
      phase: 'PLAYER_RESOLVED',
      enemies: [
        {
          ...base.combat.enemies[0],
          hp: 20,
          intentCycle: [{ kind: 'attack', value: 5 }],
          currentIntentIndex: 99,
        },
        {
          ...base.combat.enemies[0],
          id: 'empty_cycle_enemy',
          hp: 15,
          intentCycle: [],
          currentIntentIndex: -3,
        },
      ],
    },
  };
  const oobPreview = previewHeroThreat(
    { ...oobIntentRun.combat!, phase: 'PLAYER_IDLE' },
    oobIntentRun.hero,
    null,
  );
  assert.equal(oobPreview.rawIncomingDamage, 5);
  const afterOob0 = executeSingleEnemyAction(oobIntentRun, 0);
  assert.equal(afterOob0.combat?.enemies[0].currentIntentIndex, 0);
  const afterOob1 = executeSingleEnemyAction(afterOob0, 1);
  assert.equal(afterOob1.combat?.enemies[1].hp, 15);
});

test('Revised Hero Engines: Kira Blitz Reflex + Evasive Dodge + Energy Dropkick knockback, Auraline Reactor Core Prodigy retention, Zuri Tri-Drone Sync, and 90% Armor absorption', () => {
  // 1. Kira Blitz Reflex: resolving Attack at 0 CD grants an immediate free bonus turn, refills board, promotes Held (+1), sets CD=2, and Evasive Dodge shaves -1 CD
  const kiraBase = createInitialRun(701, 'kira');
  assert.ok(kiraBase.combat);
  const kiraTurn1: RunState = {
    ...kiraBase,
    hero: { ...kiraBase.hero, shield: 0, overdrive: 0 },
    combat: {
      ...kiraBase.combat,
      board: [
        makeTile('ka1', 'attack', 5),
        makeTile('ka2', 'attack', 5),
        makeTile('kd1', 'defense', 7),
        makeTile('kd2', 'defense', 6),
        makeTile('kt1', 'tech', 0, false, { kind: 'heal', amount: 3 }),
        makeTile('kt2', 'tech', 0, false, { kind: 'damage_boost', percent: 42, decayPerTurn: 10 }),
      ],
      drawPile: [makeTile('kdraw1', 'attack', 4), makeTile('kdraw2', 'defense', 8)],
      discardPile: [],
      enemies: [
        {
          ...kiraBase.combat.enemies[0],
          id: 'front_pip',
          hp: 40,
          maxHp: 40,
          armor: 10,
          shieldPips: 0,
          intentCycle: [{ kind: 'attack', value: 12 }],
          currentIntentIndex: 0,
        },
        {
          ...kiraBase.combat.enemies[0],
          id: 'back_unit',
          hp: 30,
          maxHp: 30,
          armor: 0,
          shieldPips: 0,
          intentCycle: [{ kind: 'armor', value: 4 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  const atkPrev1 = previewColorResolution(kiraTurn1, 'attack');
  assert.equal(atkPrev1.freeTurnTriggered, true);
  assert.equal(atkPrev1.overdriveGained, 20); // +10% per ATK tile

  // Action 1: Resolve Attack -> triggers Blitz Reflex free turn!
  // 10 DMG against 10 Armor (90% Armor absorption: 1 HP bleed + 9 absorbed by Armor -> 39 HP, 1 Armor)
  const afterBlitzAtk = resolvePlayerColor(kiraTurn1, 'attack');
  assert.ok(afterBlitzAtk.combat);
  assert.equal(afterBlitzAtk.combat.phase, 'PLAYER_IDLE');
  assert.equal(afterBlitzAtk.combat.blitzReflexCooldown, 2);
  assert.equal(afterBlitzAtk.combat.board.length, 6);
  assert.equal(afterBlitzAtk.combat.enemies[0].hp, 39);
  assert.equal(afterBlitzAtk.combat.enemies[0].armor, 1);

  // Kept Defense tiles (kd1=7, kd2=6) were promoted to HELD (+1 each -> 8 and 7), plus drawn kdraw2=8 -> total Shield = 8 + 7 + 8 = 23
  const defPrevBonusTurn = previewColorResolution(afterBlitzAtk, 'defense');
  assert.equal(defPrevBonusTurn.shieldGained, 23);
  const afterBonusDef = resolvePlayerColor(afterBlitzAtk, 'defense');
  assert.equal(afterBonusDef.combat?.phase, 'PLAYER_RESOLVED');
  assert.equal(afterBonusDef.hero.shield, 23);

  // Enemy attacks for 12 into 23 Shield -> 0 HP damage (full-Shield Evasive Dodge!) -> shaves -1 off Blitz CD (2 -> 1)
  // Since Blitz was used on Turn 1, round-end does not double-decrement; entering Turn 2 CD is 1 (instead of 2)
  const kiraTurn2 = executeEnemyTurn(afterBonusDef);
  assert.equal(kiraTurn2.combat?.turn, 2);
  assert.equal(kiraTurn2.combat?.blitzReflexCooldown, 1);

  // 2. Kira Energy Dropkick Overdrive: 14 Frontline Kick cracks Aegis Pip & knocks surviving front enemy back 1 slot, then 10 Shockwave hits ALL enemies
  const dropkickRun: RunState = {
    ...kiraTurn2,
    hero: { ...kiraTurn2.hero, overdrive: 100, shield: 0 },
    combat: {
      ...kiraTurn2.combat!,
      enemies: [
        {
          ...kiraTurn2.combat!.enemies[0],
          id: 'pip_front',
          hp: 30,
          armor: 0,
          shieldPips: 1,
        },
        {
          ...kiraTurn2.combat!.enemies[1],
          id: 'back_two',
          hp: 25,
          armor: 0,
          shieldPips: 0,
        },
      ],
    },
  };
  const afterDropkick = executeOverdrive(dropkickRun);
  assert.equal(afterDropkick.hero.shield, 8);
  // Hit 1 (14) cracked pip_front's Aegis Pip and knocked it to slot 1; Hit 2 (10) hit BOTH enemies for 10 DMG!
  assert.equal(afterDropkick.combat?.enemies[0].id, 'back_two');
  assert.equal(afterDropkick.combat?.enemies[0].hp, 15);
  assert.equal(afterDropkick.combat?.enemies[1].id, 'pip_front');
  assert.equal(afterDropkick.combat?.enemies[1].shieldPips, 0);
  assert.equal(afterDropkick.combat?.enemies[1].hp, 20);

  // 3. Auraline Reactor Core Dud retains +1 UpCharge, +3 Armor, and +15% OD even after Charter Academy Prodigy upgrade
  const auralineBase = createInitialRun(702, 'auraline');
  const dudTile = auralineBase.masterPool.find((t) => t.isDud && t.type === 'attack')!;
  assert.equal(dudTile.isReactorCore, true);
  const clinicAuraline: RunState = {
    ...auralineBase,
    screen: 'clinic',
    hero: { ...auralineBase.hero, credits: 100 },
  };
  const prodigyAuraline = enrollCharterProdigyTile(clinicAuraline, dudTile.id);
  const upgradedReactorTile = prodigyAuraline.masterPool.find((t) => t.id === dudTile.id)!;
  assert.equal(upgradedReactorTile.isDud, false);
  assert.equal(upgradedReactorTile.isReactorCore, true);
  assert.equal(upgradedReactorTile.value, 6);

  const auralineReactorCombat: RunState = {
    ...prodigyAuraline,
    screen: 'combat',
    hero: { ...prodigyAuraline.hero, armor: 10, overdrive: 0, pendingUpcharge: 0 },
    combat: {
      ...auralineBase.combat!,
      board: [{ ...upgradedReactorTile, isHeldFromPrevTurn: false }],
    },
  };
  const reactorPrev = previewColorResolution(auralineReactorCombat, 'attack');
  assert.equal(reactorPrev.dudCount, 1);
  assert.equal(reactorPrev.armorGained, 3);
  assert.equal(reactorPrev.upchargeGained, 2); // 1 from Prodigy + 1 from Auraline Reactor Core passive
  assert.equal(reactorPrev.overdriveGained, 15); // +15% OD from Reactor Core
  const afterReactorAtk = resolvePlayerColor(auralineReactorCombat, 'attack');
  assert.equal(afterReactorAtk.hero.armor, 13);

  // 4. Zuri Tri-Drone Sync: alternating colors fires primed drone (+4 Pierce DMG on ATK, +4 Shield on DEF, +3 HP on TECH)
  const zuriBase = createInitialRun(703, 'zuri');
  const zuriCombat: RunState = {
    ...zuriBase,
    hero: { ...zuriBase.hero, hp: 50, maxHp: 62, shield: 0 },
    combat: {
      ...zuriBase.combat!,
      primedDrone: null,
      board: [
        makeTile('za1', 'attack', 4),
        makeTile('zd1', 'defense', 7),
        makeTile('zt1', 'tech', 0, false, { kind: 'damage_boost', percent: 36, decayPerTurn: 10 }),
      ],
      enemies: [{ ...zuriBase.combat!.enemies[0], hp: 30, armor: 10, shieldPips: 0 }],
    },
  };
  // Step A: Resolve Attack -> primes Solar Hawk ('attack')
  const afterZuriAtk = resolvePlayerColor(zuriCombat, 'attack');
  assert.equal(afterZuriAtk.combat?.primedDrone, 'attack');
  // Step B: On next turn, preview/resolve Defense while Solar Hawk ('attack') is primed -> +4 Pierce DMG fires alongside Defense!
  const zuriTurn2: RunState = {
    ...afterZuriAtk,
    combat: {
      ...afterZuriAtk.combat!,
      phase: 'PLAYER_IDLE',
    },
  };
  const zuriDefPrev = previewColorResolution(zuriTurn2, 'defense');
  assert.equal(zuriDefPrev.droneSyncTriggered, 'attack');
  assert.equal(zuriDefPrev.techPierceDamage, 4);
  const afterZuriDef = resolvePlayerColor(zuriTurn2, 'defense');
  assert.equal(afterZuriDef.combat?.primedDrone, 'defense');
  // Step C: Resolve TECH while Aegis ('defense') is primed -> +4 bonus Shield fires alongside TECH!
  const zuriTurn3: RunState = {
    ...afterZuriDef,
    combat: {
      ...afterZuriDef.combat!,
      phase: 'PLAYER_IDLE',
    },
  };
  const zuriTechPrev = previewColorResolution(zuriTurn3, 'tech');
  assert.equal(zuriTechPrev.droneSyncTriggered, 'defense');
  assert.equal(zuriTechPrev.shieldGained, 4);
});

