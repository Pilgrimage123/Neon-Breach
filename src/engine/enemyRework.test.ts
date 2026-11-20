import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveSlotCount,
  computeEnemyArmorPreview,
  computeEnemyHitBoxes,
  getEnemyReactiveBark,
} from '../components/combat/combatEnemyUi';
import { getEnemyLaneMetrics } from '../components/combat/combatStageTypes';
import { computeOptimalTurnHint } from '../utils/tacticalSandboxAndHints';
import { ENEMY_TEMPLATES } from './data';
import {
  createLootRunnerUnit,
  createMercyDroneUnit,
  createPropUnit,
  createSleepwalkerUnit,
} from './encounterBuilder';
import { createSlagTile } from './poolBuilder';
import {
  advanceRoundAfterEnemies,
  createInitialRun,
  executeEnemyTurn,
  executeOverdrive,
  executeSingleEnemyAction,
  HOT_POTATO_PASS_DAMAGE,
  HOT_POTATO_SELF_DAMAGE,
  PLASMA_BARREL_BURST_DAMAGE,
  previewColorResolution,
  previewHeroThreat,
  PUSTULE_RUPTURE_CORRODE,
  resolvePlayerColor,
  STAGGER_BURST_THRESHOLD,
  TEMPTATION_CLEAVE_BONUS,
  WEAPON_BREAK_THRESHOLD,
} from './gameEngine';
import { parseAndValidateRun } from './persistence';
import {
  createReinforcementUnit,
  findOpenBridgeSlot,
  getEnemySlotSpan,
  getOccupiedBridgeSlotCount,
  MAX_ACTIVE_BRIDGE_ENEMIES,
  pickReinforcementArchetype,
} from './reinforcementDirector';
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

test('conditional intents (if_no_shield & if_play_attack) match identically between previewHeroThreat and executeEnemyTurn', () => {
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
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
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
  const techThreat = previewHeroThreat(techRun.combat, techRun.hero, techPreview);
  assert.equal(techThreat.conditionalBonusDamage, 4);
  assert.equal(techThreat.rawIncomingDamage, 11);
  assert.equal(techThreat.hpDamageTaken, 11);

  const afterTechPlay = executeEnemyTurn(resolvePlayerColor(techRun, 'tech'));
  assert.equal(afterTechPlay.hero.hp, 50 - 11);

  // Case B: Player plays Defense -> shieldAfterPlayer >= 1 -> Stalker deals base 7 DMG (no bonus)
  const defPreview = previewColorResolution(techRun, 'defense');
  const defThreat = previewHeroThreat(techRun.combat, techRun.hero, defPreview);
  assert.equal(defThreat.conditionalBonusDamage, 0);
  assert.equal(defThreat.rawIncomingDamage, 7);
  assert.equal(defThreat.hpDamageTaken, 1);

  const afterDefPlay = executeEnemyTurn(resolvePlayerColor(techRun, 'defense'));
  assert.equal(afterDefPlay.hero.hp, 49);

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
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
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
  const bossAtkThreat = previewHeroThreat(bossRun.combat, bossRun.hero, bossAtkPreview);
  assert.equal(bossAtkThreat.conditionalBonusDamage, 4);
  assert.equal(bossAtkThreat.rawIncomingDamage, 15);

  const afterBossAtk = executeEnemyTurn(resolvePlayerColor(bossRun, 'attack'));
  assert.equal(afterBossAtk.hero.hp, 50 - 15);
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
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
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

  const threat = previewHeroThreat(run.combat, run.hero, atkPreview);
  assert.equal(threat.rawIncomingDamage, 0);

  const afterPlayer = resolvePlayerColor(run, 'attack');
  assert.ok(afterPlayer.combat);
  assert.equal(afterPlayer.combat.enemies[0].staggered, true);
  assert.ok(afterPlayer.combat.lastCues.some((c) => c.kind === 'enemy_stagger'));

  // Enemy turn deals 0 DMG and resets Stinger back to Charge (2T) at index 0
  const afterEnemy = executeEnemyTurn(afterPlayer);
  assert.equal(afterEnemy.hero.hp, 50);
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
    hero: { ...baseRun.hero, hp: 50, shield: 10 },
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
    hero: { ...turn2.hero, overdrive: 100 },
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
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
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
  assert.equal(afterAcid.hero.hp, 44);
  assert.equal(afterAcid.combat.discardPile.filter((t) => t.isBlight).length, 1);

  // Put 2 Caustic Slag tiles on board -> advanceRoundAfterEnemies burns 4 HP total
  const blight1 = createSlagTile(1, 1);
  const blight2 = createSlagTile(1, 2);
  const chipRun = {
    ...run,
    hero: { ...run.hero, hp: 40, shield: 0 },
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
  assert.equal(afterRoundEnd.hero.hp, 36);

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
    hero: { ...baseRun.hero, hp: 14, shield: 0 },
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

test('Up to 6 simultaneous enemies supported on the sky-bridge with non-overlapping lane metrics and hitboxes', () => {
  assert.equal(MAX_ACTIVE_BRIDGE_ENEMIES, 6);
  const sixEnemies = Array.from({ length: 6 }, (_, i) =>
    makeEnemy({
      id: `e_six_${i}`,
      archetype: i % 2 === 0 ? 'larva' : 'stalker',
      passive: i % 2 === 0 ? 'volatile_burst' : 'spike_retaliate',
    }),
  );

  assert.equal(computeEffectiveSlotCount(sixEnemies, []), 6);
  assert.equal(findOpenBridgeSlot(sixEnemies.slice(0, 5), []), 5);
  assert.equal(findOpenBridgeSlot(sixEnemies, []), null);

  const lane = getEnemyLaneMetrics(1440, 6);
  assert.ok(lane.baseX > 0);
  assert.ok(lane.baseX + 5 * lane.stepX < 1440);

  const hitBoxes = computeEnemyHitBoxes(1440, 500, sixEnemies, new Map(), []);
  assert.equal(hitBoxes.length, 6);
  for (let i = 1; i < hitBoxes.length; i++) {
    assert.ok(hitBoxes[i].x > hitBoxes[i - 1].x, '6 enemy hitboxes should progress left-to-right');
  }

  // Turn 1 Grace Period: reinforcements never open on heavy nuke on arrival turn
  const droppedBrute = createReinforcementUnit('brute', 1, 1);
  assert.notEqual(droppedBrute.intentCycle[droppedBrute.currentIntentIndex].kind, 'heavy');
});

test('Pillar 1: Hot Potato passes 8 Pierce DMG when resolved or deals 6 self-DMG if kept; Contagion discards adjacent tiles; Temptation deals +14 cleave and adds 2 Blight; Top-Deck places Blight at drawPile[0]', () => {
  const baseRun = createInitialRun(707);
  assert.ok(baseRun.combat);

  const frontEnemy = makeEnemy({
    id: 'e_front',
    archetype: 'brute',
    passive: 'threshold_pip',
    hp: 40,
    maxHp: 40,
    armor: 10,
  });
  const backEnemy = makeEnemy({
    id: 'e_back',
    archetype: 'stalker',
    passive: 'spike_retaliate',
    hp: 30,
    maxHp: 30,
  });

  // 1. Hot Potato resolved -> passes 8 Pierce DMG directly to front enemy HP (ignoring armor)
  const hotPotatoTile: Tile = { ...makeTile('hp1', 'defense', 5), isHotPotato: true };
  const hpRun = {
    ...baseRun,
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [frontEnemy, backEnemy],
      board: [hotPotatoTile, makeTile('a1', 'attack', 5)],
      drawPile: [makeTile('d1', 'attack', 4), makeTile('d2', 'defense', 4)],
      discardPile: [],
    },
  };

  const defPreview = previewColorResolution(hpRun, 'defense');
  assert.equal(defPreview.hotPotatoPassedDamage, HOT_POTATO_PASS_DAMAGE);
  const afterPass = resolvePlayerColor(hpRun, 'defense');
  assert.ok(afterPass.combat);
  assert.equal(afterPass.combat.enemies[0].hp, 40 - HOT_POTATO_PASS_DAMAGE);
  assert.equal(afterPass.combat.enemies[0].armor, 10);

  // If Hot Potato is left unresolved on the board, previewHeroThreat and advanceRoundAfterEnemies apply 6 self-DMG
  const atkPreview = previewColorResolution(hpRun, 'attack');
  const threatWithUnresolvedBomb = previewHeroThreat(hpRun.combat, hpRun.hero, atkPreview);
  assert.equal(threatWithUnresolvedBomb.hotPotatoSelfDamage, HOT_POTATO_SELF_DAMAGE);

  const afterLeftOnBoard = advanceRoundAfterEnemies({
    ...hpRun,
    combat: { ...hpRun.combat, phase: 'ENEMY_ACTING' as const },
  });
  assert.equal(afterLeftOnBoard.hero.hp, 50 - HOT_POTATO_SELF_DAMAGE);

  // 2. Contagion tile discards adjacent non-matching board tiles when resolved
  const contagionTile: Tile = { ...makeTile('c_mid', 'attack', 6), isContagion: true };
  const contagionRun = {
    ...hpRun,
    combat: {
      ...hpRun.combat,
      board: [
        makeTile('adj_left', 'defense', 5),
        contagionTile,
        makeTile('adj_right', 'tech', 0, { kind: 'heal', amount: 3 }),
        makeTile('far_right', 'defense', 5),
      ],
    },
  };
  const contagionPreview = previewColorResolution(contagionRun, 'attack');
  assert.equal(contagionPreview.contagionDiscardedCount, 2);
  const afterContagion = resolvePlayerColor(contagionRun, 'attack');
  assert.ok(afterContagion.combat);
  // Only far_right remains from the original non-attack tiles before refill
  assert.equal(afterContagion.combat.board.some((t) => t.id === 'adj_left' || t.id === 'adj_right'), false);
  assert.equal(afterContagion.combat.board.some((t) => t.id === 'far_right'), true);

  // 3. Temptation tile deals +14 cleave damage (50% pierce) to all enemies and adds 2 Caustic Slag curses to discard
  const temptationTile: Tile = { ...makeTile('temp1', 'tech', 0, { kind: 'heal', amount: 2 }), isTemptation: true };
  const temptationRun = {
    ...hpRun,
    combat: {
      ...hpRun.combat,
      board: [temptationTile, makeTile('d_stay', 'defense', 4)],
      discardPile: [],
    },
  };
  const tempPreview = previewColorResolution(temptationRun, 'tech');
  assert.equal(tempPreview.temptationCleaveBonus, TEMPTATION_CLEAVE_BONUS);
  const afterTemp = resolvePlayerColor(temptationRun, 'tech');
  assert.ok(afterTemp.combat);
  // Front enemy had 10 armor + 40 HP -> 14 cleave (50% pierce = 7 HP + 7 armor) leaves 33 HP & 3 armor
  assert.equal(afterTemp.combat.enemies[0].hp, 33);
  assert.equal(afterTemp.combat.enemies[0].armor, 3);
  // Back enemy had 0 armor + 30 HP -> takes 14 cleave dmg (16 HP)
  assert.equal(afterTemp.combat.enemies[1].hp, 16);
  assert.equal(afterTemp.combat.discardPile.filter((t) => t.isBlight).length, 2);

  // 4. Top-Deck Blight places Caustic Slag at drawPile[0] with isTopDecked = true
  const topDeckSpitter = makeEnemy({
    id: 'e_top_spitter',
    archetype: 'spitter',
    passive: 'acid_jam',
    intentCycle: [{ kind: 'acid', value: 6, secondaryValue: 1, topDeckBlight: true }],
    currentIntentIndex: 0,
  });
  const topDeckRun = {
    ...hpRun,
    hero: { ...hpRun.hero, hp: 50, shield: 0 },
    combat: {
      ...hpRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [topDeckSpitter],
      drawPile: [makeTile('next_normal', 'attack', 5)],
      discardPile: [],
    },
  };
  const afterTopDeck = executeSingleEnemyAction(topDeckRun, 0);
  assert.ok(afterTopDeck.combat);
  assert.equal(afterTopDeck.combat.drawPile[0].isBlight, true);
  assert.equal(afterTopDeck.combat.drawPile[0].isTopDecked, true);
});

test('Pillar 2: Dynamic Win Conditions (Loot Runner +25 CR vs escape, Mercy Target immediate victory, Tug-of-War 100% Neural Purge, Sleepwalker wake counter)', () => {
  const baseRun = createInitialRun(808);
  assert.ok(baseRun.combat);

  // 1. Loot Runner awards +25 CR bounty when killed before escaping
  const lootRunner = { ...createLootRunnerUnit('lr_1', 25), hp: 6, armor: 0, shieldPips: 0 };
  const hostileGuard = makeEnemy({
    id: 'e_guard',
    archetype: 'stalker',
    passive: 'spike_retaliate',
    hp: 30,
    maxHp: 30,
  });
  const lootKillRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      rewardCredits: 10,
      phase: 'PLAYER_IDLE' as const,
      enemies: [lootRunner, hostileGuard],
      board: [makeTile('a1', 'attack', 8)],
    },
  };
  const afterLootKill = resolvePlayerColor(lootKillRun, 'attack');
  assert.equal(afterLootKill.combat?.lootBountyAwarded, 25);
  assert.equal(afterLootKill.combat?.rewardCredits, 10 + 25);

  // 2. Mercy Target: killing all hostiles while Mercy Drone survives triggers immediate VICTORY (+6 HP, +15 CR)
  const mercyUnit = createMercyDroneUnit('m_1');
  const weakHostile = makeEnemy({
    id: 'e_weak',
    archetype: 'larva',
    passive: 'volatile_burst',
    hp: 5,
    maxHp: 10,
  });
  const mercyRun = {
    ...baseRun,
    hero: { ...baseRun.hero, hp: 30, maxHp: 50, credits: 20 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [weakHostile, mercyUnit],
      board: [makeTile('a1', 'attack', 8)],
    },
  };
  const afterMercyWin = resolvePlayerColor(mercyRun, 'attack');
  assert.equal(afterMercyWin.combat?.phase, 'VICTORY');
  assert.equal(afterMercyWin.combat?.mercyBonusAwarded, true);
  assert.equal(afterMercyWin.hero.hp, 36);
  assert.ok((afterMercyWin.combat?.rewardCredits ?? 0) >= 15);

  // 3. Tug-of-War Neural Meter reaching 100% triggers Neural Purge (staggers all hostiles +25% OD +10 CR)
  const tugEnemy = makeEnemy({
    id: 'e_tug',
    archetype: 'brute',
    passive: 'threshold_pip',
    hp: 40,
    maxHp: 40,
  });
  const tugRun = {
    ...baseRun,
    hero: { ...baseRun.hero, overdrive: 10 },
    combat: {
      ...baseRun.combat,
      rewardCredits: 0,
      phase: 'PLAYER_IDLE' as const,
      tugOfWarMeter: 92,
      enemies: [tugEnemy],
      board: [makeTile('a1', 'attack', 6)],
    },
  };
  const afterTugPurge = resolvePlayerColor(tugRun, 'attack');
  assert.equal(afterTugPurge.combat?.tugOfWarMeter, 100);
  assert.equal(afterTugPurge.combat?.tugOfWarPurged, true);
  assert.equal(afterTugPurge.combat?.enemies[0].staggered, true);
  assert.equal(afterTugPurge.combat?.rewardCredits, 10);

  // 4. Sleepwalker ignores Defense/TECH and decrements sleepCounter on Attack
  const sleeper = createSleepwalkerUnit('sl_1', 0, 2);
  assert.equal(sleeper.sleepCounter, 2);
  const sleepRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [sleeper],
      board: [makeTile('d1', 'defense', 6), makeTile('a1', 'attack', 6)],
    },
  };
  const afterDefOnSleeper = resolvePlayerColor(sleepRun, 'defense');
  assert.equal(afterDefOnSleeper.combat?.enemies[0].sleepCounter, 2);

  const afterAtkOnSleeper = resolvePlayerColor(sleepRun, 'attack');
  assert.equal(afterAtkOnSleeper.combat?.enemies[0].sleepCounter, 1);
});

test('Pillar 3, 4 & 5: Overkill Weapon-Break (22+ DMG), Desperation Telegraph (<=20% HP), Plasma Barrel chain explosion, Bio-Husk revival, and Reactive Hover Barks', () => {
  const baseRun = createInitialRun(909);
  assert.ok(baseRun.combat);

  // 1. Overkill Weapon-Break at >= 22 single-turn burst on charging enemy permanently breaks weapon (-3 DMG)
  const heavyBoss = makeEnemy({
    id: 'e_heavy_boss',
    archetype: 'boss',
    passive: 'phase_gate',
    hp: 90,
    maxHp: 100,
    intentCycle: [{ kind: 'heavy', value: 15 }],
    currentIntentIndex: 0,
  });
  const wbRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [heavyBoss],
      board: [
        makeTile('a1', 'attack', 8),
        makeTile('a2', 'attack', 8),
        makeTile('a3', 'attack', 8),
      ],
    },
  };
  const wbPreview = previewColorResolution(wbRun, 'attack');
  assert.ok(wbPreview.totalDamage >= WEAPON_BREAK_THRESHOLD);
  const wbArmorPreview = computeEnemyArmorPreview(heavyBoss, 0, 0, wbPreview, [heavyBoss]);
  assert.equal(wbArmorPreview.willBreakWeapon, true);

  const bark = getEnemyReactiveBark(heavyBoss, wbPreview, wbArmorPreview, 0, 'en');
  assert.equal(bark, '🔨 WEAPON BREAK!');

  const afterWb = resolvePlayerColor(wbRun, 'attack');
  assert.equal(afterWb.combat?.enemies[0].weaponBroken, true);
  assert.equal(afterWb.combat?.enemies[0].staggered, true);

  // 2. Desperation Telegraph at <= 20% HP switches passive armor/bolster to Attack +3
  const armorBrute = makeEnemy({
    id: 'e_desp_brute',
    archetype: 'brute',
    passive: 'threshold_pip',
    hp: 12,
    maxHp: 40,
    intentCycle: [
      { kind: 'armor', value: 6 },
      { kind: 'attack', value: 9 },
    ],
    currentIntentIndex: 0,
  });
  const despRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [armorBrute],
      board: [makeTile('a1', 'attack', 6)],
    },
  };
  const afterDesp = resolvePlayerColor(despRun, 'attack');
  const enragedBrute = afterDesp.combat!.enemies[0];
  assert.equal(enragedBrute.hp, 6); // 15% of 40 <= 20%
  assert.equal(enragedBrute.desperationEnraged, true);
  assert.equal(enragedBrute.intentCycle[enragedBrute.currentIntentIndex].kind, 'attack');

  // 3. Explosive Plasma Barrel deals 10 Pierce DMG to all living enemies + 20% Overdrive when destroyed
  const barrel = { ...createPropUnit('plasma_barrel', 'pb_1'), hp: 6 };
  const bystander = makeEnemy({
    id: 'e_bystander',
    archetype: 'stalker',
    passive: 'spike_retaliate',
    hp: 25,
    maxHp: 25,
    armor: 8,
  });
  const barrelRun = {
    ...baseRun,
    hero: { ...baseRun.hero, overdrive: 10 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [barrel, bystander],
      board: [makeTile('a1', 'attack', 8)],
    },
  };
  const afterBarrel = resolvePlayerColor(barrelRun, 'attack');
  assert.equal(afterBarrel.combat?.enemies[0].hp, 0);
  // Bystander takes 10 Pierce DMG directly to HP (ignoring 8 armor)
  assert.equal(afterBarrel.combat?.enemies[1].hp, 25 - PLASMA_BARREL_BURST_DAMAGE);
  assert.equal(afterBarrel.combat?.enemies[1].armor, 8);

  // 4. Bio-Husk spawns when a non-prop enemy dies while Boss is alive, and revives after 2 turns
  const fallenStalker = makeEnemy({
    id: 'e_fallen',
    archetype: 'stalker',
    passive: 'spike_retaliate',
    hp: 5,
    maxHp: 24,
  });
  const liveBoss = makeEnemy({
    id: 'e_live_boss',
    archetype: 'boss',
    passive: 'phase_gate',
    hp: 80,
    maxHp: 100,
  });
  const huskSpawnRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [fallenStalker, liveBoss],
      board: [makeTile('a1', 'attack', 8)],
    },
  };
  const afterFallenKill = resolvePlayerColor(huskSpawnRun, 'attack');
  const afterSpawnRound = executeEnemyTurn(afterFallenKill);
  const spawnedHusk = afterSpawnRound.combat?.enemies.find((e) => e.propKind === 'bio_husk');
  assert.ok(spawnedHusk, 'Killing a non-prop enemy while Boss lives should spawn a Bio-Husk at round end');
  assert.equal(spawnedHusk.reviveTimer, 2);

  // Advance 2 enemy turns -> Bio-Husk revives as Stalker at 50% HP (12 HP)
  const afterHuskT1 = executeEnemyTurn({
    ...afterSpawnRound,
    combat: { ...afterSpawnRound.combat!, phase: 'PLAYER_RESOLVED' as const },
  });
  const huskAfterT1 = afterHuskT1.combat?.enemies.find((e) => e.id === spawnedHusk.id);
  assert.equal(huskAfterT1?.reviveTimer, 1);

  const afterHuskT2 = executeEnemyTurn({
    ...afterHuskT1,
    combat: { ...afterHuskT1.combat!, phase: 'PLAYER_RESOLVED' as const },
  });
  const revivedUnit = afterHuskT2.combat?.enemies.find((e) => e.id === spawnedHusk.id);
  assert.equal(revivedUnit?.propKind, undefined);
  assert.equal(revivedUnit?.archetype, 'stalker');
  assert.equal(revivedUnit?.hp, 12);
});

test('Bile Spitter rework: Pustule Rupture (+2 Corrode on surviving non-Surge Attack) & Beat 2 Caustic Claw Rend (7 DMG +2 COR +3 ARM on HP hit)', () => {
  const baseRun = createInitialRun(1010);
  assert.ok(baseRun.combat);

  const spitterTemplate = ENEMY_TEMPLATES.spitter;
  assert.equal(spitterTemplate.intentCycle[1].kind, 'attack');
  assert.equal(spitterTemplate.intentCycle[1].value, 7);
  assert.equal(spitterTemplate.intentCycle[1].corrodeAmount, 2);
  assert.equal(spitterTemplate.intentCycle[1].armorOnHit, 3);
  assert.equal(spitterTemplate.intentCycle[1].clawRend, true);

  const spitterBeat2 = makeEnemy({
    id: 'e_spitter_rw',
    archetype: 'spitter',
    passive: 'acid_jam',
    roleColor: 'lime',
    hp: 30,
    maxHp: 30,
    armor: 0,
    intentCycle: spitterTemplate.intentCycle.map((i) => ({ ...i })),
    currentIntentIndex: 1,
  });

  // 1. Surviving non-Surge Attack triggers Pustule Rupture (+2 Corrode + cue + bark)
  const nonSurgeRun = {
    ...baseRun,
    hero: { ...baseRun.hero, hp: 50, shield: 0, corrode: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [{ ...spitterBeat2 }],
      board: [
        makeTile('a1', 'attack', 5),
        makeTile('a2', 'attack', 5),
        makeTile('d1', 'defense', 7),
      ],
    },
  };

  const atkPreview = previewColorResolution(nonSurgeRun, 'attack');
  assert.equal(atkPreview.surgeTriggered, false);
  assert.equal(atkPreview.pustuleRuptureCorrode, PUSTULE_RUPTURE_CORRODE);

  const armorPrev = computeEnemyArmorPreview(spitterBeat2, 0, 0, atkPreview, [spitterBeat2]);
  assert.equal(armorPrev.willDie, false);
  assert.equal(getEnemyReactiveBark(spitterBeat2, atkPreview, armorPrev, 0, 'en'), '☣ PUSTULE +2 COR!');
  assert.equal(getEnemyReactiveBark(spitterBeat2, atkPreview, armorPrev, 0, 'cs'), '☣ PUSTULY +2 KOR!');

  // Threat preview sums Pustule Rupture (+2) + Beat 2 Caustic Claw Rend (+2) = +4 Corrode
  const atkThreat = previewHeroThreat(nonSurgeRun.combat, nonSurgeRun.hero, atkPreview);
  assert.equal(atkThreat.corrodeGained, 4);

  const afterNonSurgeAtk = resolvePlayerColor(nonSurgeRun, 'attack');
  assert.equal(afterNonSurgeAtk.hero.corrode, PUSTULE_RUPTURE_CORRODE);
  assert.ok(afterNonSurgeAtk.combat?.lastCues.some((c) => c.kind === 'enemy_pustule_rupture'));

  // 2. Beat 2 Caustic Claw Rend unblocked HP hit -> deals 7 DMG, +2 Corrode, Spitter swells +3 Armor
  const afterClawHit = executeSingleEnemyAction(
    {
      ...afterNonSurgeAtk,
      combat: { ...afterNonSurgeAtk.combat!, phase: 'PLAYER_RESOLVED' as const },
    },
    0,
  );
  assert.equal(afterClawHit.hero.hp, 50 - 7);
  assert.equal(afterClawHit.hero.corrode, 4);
  assert.equal(afterClawHit.combat?.enemies[0].armor, 3);

  // 3. Beat 2 Caustic Claw Rend fully blocked by Defense Shield -> 0 HP damage, +2 Corrode, NO +3 Armor swell
  const defThreat = previewHeroThreat(
    nonSurgeRun.combat,
    nonSurgeRun.hero,
    previewColorResolution(nonSurgeRun, 'defense'),
  );
  assert.equal(defThreat.hpDamageTaken, 0);
  assert.equal(defThreat.corrodeGained, 2);

  const afterDefense = resolvePlayerColor(nonSurgeRun, 'defense');
  const afterBlockedClaw = executeSingleEnemyAction(
    {
      ...afterDefense,
      combat: { ...afterDefense.combat!, phase: 'PLAYER_RESOLVED' as const },
    },
    0,
  );
  assert.equal(afterBlockedClaw.hero.hp, 50);
  assert.equal(afterBlockedClaw.hero.corrode, 2);
  assert.equal(afterBlockedClaw.combat?.enemies[0].armor, 0);

  // 4. Attack Surge (4+ tiles) bypasses Pustule Rupture even when Spitter survives
  const surgeRun = {
    ...nonSurgeRun,
    combat: {
      ...nonSurgeRun.combat,
      enemies: [{ ...spitterBeat2, hp: 40, maxHp: 40 }],
      board: [
        makeTile('s1', 'attack', 4),
        makeTile('s2', 'attack', 4),
        makeTile('s3', 'attack', 4),
        makeTile('s4', 'attack', 4),
      ],
    },
  };
  const surgePreview = previewColorResolution(surgeRun, 'attack');
  assert.equal(surgePreview.surgeTriggered, true);
  assert.equal(surgePreview.pustuleRuptureCorrode, 0);
  const afterSurge = resolvePlayerColor(surgeRun, 'attack');
  assert.equal(afterSurge.hero.corrode, 0);
  assert.equal(afterSurge.combat?.lastCues.some((c) => c.kind === 'enemy_pustule_rupture'), false);

  // 5. Lethal 1-hit non-Surge Attack KO bypasses Pustule Rupture
  const lethalRun = {
    ...nonSurgeRun,
    combat: {
      ...nonSurgeRun.combat,
      enemies: [{ ...spitterBeat2, hp: 6, maxHp: 30 }],
    },
  };
  const lethalPreview = previewColorResolution(lethalRun, 'attack');
  assert.equal(lethalPreview.pustuleRuptureCorrode, 0);
  const afterLethal = resolvePlayerColor(lethalRun, 'attack');
  assert.equal(afterLethal.hero.corrode, 0);
  assert.equal(afterLethal.combat?.lastCues.some((c) => c.kind === 'enemy_pustule_rupture'), false);
});

test('Carapace Brute rework: occupies 2 bridge spots, Mutagen Vial Brace (+6 ARM +3 HP), and Seismic Crush (14 DMG Heavy + heavySmash)', () => {
  const baseRun = createInitialRun(1111);
  assert.ok(baseRun.combat);

  // 1. Template intent cycle matches Mutagen Vial Brace -> Seismic Carapace Crush -> Vein-Burst Maw Crunch
  const bruteTpl = ENEMY_TEMPLATES.brute;
  assert.deepEqual(bruteTpl.intentCycle[0], { kind: 'armor', value: 6, secondaryValue: 3 });
  assert.deepEqual(bruteTpl.intentCycle[1], { kind: 'heavy', value: 14 });
  assert.deepEqual(bruteTpl.intentCycle[2], { kind: 'attack', value: 9 });

  // 2. 2-slot occupancy & reinforcement capacity enforcement
  assert.equal(getEnemySlotSpan('brute'), 2);
  assert.equal(getEnemySlotSpan('spitter'), 1);

  const bruteA = makeEnemy({ id: 'b1', archetype: 'brute', passive: 'threshold_pip' });
  const spitterB = makeEnemy({ id: 's1', archetype: 'spitter', passive: 'acid_jam' });
  const threeBrutes = [
    bruteA,
    makeEnemy({ id: 'b2', archetype: 'brute', passive: 'threshold_pip' }),
    makeEnemy({ id: 'b3', archetype: 'brute', passive: 'threshold_pip' }),
  ];
  assert.equal(getOccupiedBridgeSlotCount(threeBrutes, []), 6);
  assert.equal(findOpenBridgeSlot(threeBrutes, []), null);

  // 5 occupied slots leaves 1 free slot: a 1-slot unit fits at slot 5, a 2-slot Brute does NOT
  const fiveSlots = [
    bruteA,
    makeEnemy({ id: 'b2', archetype: 'brute', passive: 'threshold_pip' }),
    spitterB,
  ];
  assert.equal(getOccupiedBridgeSlotCount(fiveSlots, []), 5);
  assert.equal(findOpenBridgeSlot(fiveSlots, [], 1), 5);
  assert.equal(findOpenBridgeSlot(fiveSlots, [], 2), null);

  // pickReinforcementArchetype never picks Brute when freeSlotCount < 2
  const director = baseRun.combat.director!;
  for (let seed = 1; seed <= 40; seed++) {
    const pick = pickReinforcementArchetype(director, 2, 'COMBAT', seed, seed, 20, 1);
    assert.notEqual(pick.archetype, 'brute');
  }

  // 3. Beat 1 Mutagen Vial Brace grants +6 Armor & heals +3 HP (capped at maxHp) with secondaryHeal cue
  const damagedBrute = makeEnemy({
    id: 'b_brace',
    archetype: 'brute',
    passive: 'threshold_pip',
    hp: 38,
    maxHp: 40,
    armor: 2,
    intentCycle: bruteTpl.intentCycle.map((i) => ({ ...i })),
    currentIntentIndex: 0,
  });
  const braceRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [damagedBrute],
    },
  };
  const afterBrace = executeSingleEnemyAction(braceRun, 0);
  const bracedUnit = afterBrace.combat!.enemies[0];
  assert.equal(bracedUnit.armor, 8);
  assert.equal(bracedUnit.hp, 40); // capped at maxHp (38 + 3 -> 40)
  const armorCue = afterBrace.combat!.lastCues.find((c) => c.kind === 'enemy_armor');
  assert.ok(armorCue);
  assert.equal(armorCue.value, 6);
  assert.equal(armorCue.secondaryHeal, 2);

  // 4. Beat 2 Seismic Carapace Crush (14 DMG Heavy) deals 14 DMG, emits heavySmash: true, and staggers at >= 16 burst
  const heavyBrute = makeEnemy({
    id: 'b_heavy',
    archetype: 'brute',
    passive: 'threshold_pip',
    hp: 40,
    maxHp: 40,
    armor: 0,
    intentCycle: bruteTpl.intentCycle.map((i) => ({ ...i })),
    currentIntentIndex: 1,
  });
  const heavyRun = {
    ...baseRun,
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [heavyBrute],
    },
  };
  const afterHeavy = executeSingleEnemyAction(heavyRun, 0);
  assert.equal(afterHeavy.hero.hp, 50 - 14);
  const heavyCue = afterHeavy.combat!.lastCues.find((c) => c.kind === 'enemy_attack');
  assert.ok(heavyCue);
  assert.equal(heavyCue.heavySmash, true);

  const staggerRun = {
    ...baseRun,
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [{ ...heavyBrute }],
      board: [
        makeTile('a1', 'attack', 9),
        makeTile('a2', 'attack', 8),
      ],
    },
  };
  const afterStaggerHit = resolvePlayerColor(staggerRun, 'attack');
  assert.equal(afterStaggerHit.combat?.enemies[0].staggered, true);
  assert.ok(afterStaggerHit.combat?.lastCues.some((c) => c.kind === 'enemy_stagger'));
});



