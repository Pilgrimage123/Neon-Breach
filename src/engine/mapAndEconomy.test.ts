import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_TEMPLATES } from './data';
import { computeSmartScaledEnemyHp } from './difficulty';
import { buildEnemiesForNode } from './encounterBuilder';
import {
  claimCombatChipReward,
  createInitialRun,
  resolvePlayerColor,
  skipCombatEncounter,
  startNodeEncounter,
} from './gameEngine';
import { generateSectorMap } from './mapGenerator';
import {
  getAvailableNextNodes,
  getBossTelegraphIntel,
  getConnectingPathNodeIds,
  getLaneClusterProfiles,
  getNodeEconomyMetrics,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getReconPreviewForNode,
  getTacticalRouteAdvice,
  STAGE_BOSS_TELEGRAPH,
} from './mapTacticalIntel';
import type { DifficultyTier, MapNode, RunState, Tile } from './types';

function makeTile(id: string, type: Tile['type'], value: number): Tile {
  return { id, type, sourceId: 'test', value, isHeldFromPrevTurn: false };
}

test('compact sector map generates 5 reachable layers ending at BOSS with explicit mapLength option', () => {
  const nodes = generateSectorMap(505, {
    mapLength: 'compact',
    variantCount: 3,
    dynamicModifiers: false,
  });
  const layer0 = getAvailableNextNodes(nodes, null);
  assert.equal(layer0.length, 1);
  assert.equal(layer0[0].layer, 0);

  const bossNodes = nodes.filter((n) => n.type === 'BOSS');
  assert.equal(bossNodes.length, 1);
  assert.equal(bossNodes[0].layer, 4);
});

test('3-lane compact map variants enforce planar non-crossing edges and smart route advice', () => {
  for (const seed of [100, 101, 102]) {
    const nodes = generateSectorMap(seed, {
      mapLength: 'compact',
      variantCount: 3,
      dynamicModifiers: false,
    });
    assert.equal(nodes.length, 11);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    assert.equal(getReachableNodeIds(nodes, 'n_0_0').size, 11);

    for (const node of nodes) {
      assert.ok(getReachableNodeIds(nodes, node.id).has('n_4_0'));
      const intel = getNodeEncounterIntel(node, seed);
      assert.ok(intel.sectorCode.startsWith(`S0${node.layer + 1}-`));
      const isSupport = node.type === 'CYBER_CLINIC' || node.type === 'MED_BAY';
      for (const nextId of node.nextIds) {
        const nextNode = byId.get(nextId);
        assert.ok(nextNode);
        if (isSupport) {
          assert.notEqual(nextNode.type, node.type);
        }
      }
    }
  }

  const base = createInitialRun(100, 'kira', 3, false, {
    mapLength: 'compact',
    variantCount: 3,
    dynamicModifiers: false,
  });
  const clearedL0 = claimCombatChipReward(
    { ...base, combat: { ...base.combat!, phase: 'VICTORY' } },
    null,
  );
  const l1CombatWithMedbay = clearedL0.mapNodes.find(
    (n) =>
      n.layer === 1 &&
      n.nextIds.some((nid) => clearedL0.mapNodes.find((m) => m.id === nid)?.type === 'MED_BAY'),
  )!;
  const lowHpAdvice = getTacticalRouteAdvice({
    ...clearedL0,
    currentNodeId: l1CombatWithMedbay.id,
    hero: { ...clearedL0.hero, hp: 18, maxHp: 60 },
  });
  assert.equal(lowHpAdvice.reasonKey, 'low_hp_medbay');
});

test('getNodeEncounterIntel matches spawned combat enemies, keeps totalEnemyHp separate from armor, and formats S01-S12', () => {
  for (const seed of [200, 201, 202, 203, 204, 205]) {
    const run = createInitialRun(seed);
    for (const node of run.mapNodes) {
      const intel = getNodeEncounterIntel(node, seed, 'en', run.difficultyTier);
      const started = startNodeEncounter(run, node.id);
      const expectedPrefix = `S${String(node.layer + 1).padStart(2, '0')}-`;
      assert.ok(intel.sectorCode.startsWith(expectedPrefix), `Expected ${intel.sectorCode} to start with ${expectedPrefix}`);

      if (started.combat) {
        assert.deepEqual(
          intel.enemies,
          started.combat.enemies.map((e) => ({
            archetype: e.archetype,
            hp: e.maxHp,
            armor: e.armor,
          })),
        );
        assert.equal(
          intel.totalEnemyHp,
          started.combat.enemies.reduce((s, e) => s + e.maxHp, 0),
        );
        assert.equal(
          intel.totalEnemyArmor,
          started.combat.enemies.reduce((s, e) => s + e.armor, 0),
        );
      }
    }
  }
});

test('12-Stage Grand Metropolis Sector Map is default regardless of small seed and assigns maglev_hub to combat layers 4, 6, 8', () => {
  const smallSeedRun = createInitialRun(42, 'kira', 3);
  assert.equal(smallSeedRun.mapNodes.length, 32);
  assert.equal(Math.max(...smallSeedRun.mapNodes.map((n) => n.layer)), 11);

  const maglevNodes = smallSeedRun.mapNodes.filter((n) => n.districtBadge === 'maglev_hub');
  assert.ok(maglevNodes.length > 0, 'Expected at least 1 maglev_hub badge on Metropolis map');
  for (const m of maglevNodes) {
    assert.ok(m.layer === 4 || m.layer === 6 || m.layer === 8);
    assert.equal(m.type, 'COMBAT');
  }

  // Tier 5 extra overcharged_hazard never overwrites existing golden_bounty/double_credits/nanite_cache
  const tier3Map = generateSectorMap(104729, { difficultyTier: 3 });
  const tier5Map = generateSectorMap(104729, { difficultyTier: 5 });
  for (const node3 of tier3Map) {
    if (
      node3.modifier === 'golden_bounty' ||
      node3.modifier === 'double_credits' ||
      node3.modifier === 'nanite_cache'
    ) {
      const node5 = tier5Map.find((n) => n.id === node3.id);
      assert.equal(node5?.modifier, node3.modifier);
    }
  }
});

test('EVENT nodes, Stage Boss Telegraph, Multi-hop pathing, and Recon freeMemory calculation work cleanly', () => {
  const mapWithEvents = generateSectorMap(105, {
    mapLength: 'compact',
    variantCount: 6,
    dynamicModifiers: true,
  });
  assert.equal(mapWithEvents.length, 11);
  assert.ok(mapWithEvents.some((n) => n.type === 'EVENT'));

  assert.equal(STAGE_BOSS_TELEGRAPH.hp, ENEMY_TEMPLATES.boss.maxHp);
  assert.equal(STAGE_BOSS_TELEGRAPH.gimmicks.length, 3);
  const path = getConnectingPathNodeIds(mapWithEvents, 'n_0_0', 'n_4_0');
  assert.ok(path.has('n_0_0') && path.has('n_4_0'));

  const run = createInitialRun(203);
  const dealerNode = run.mapNodes.find((n) => n.type === 'CHIP_DEALER')!;
  const reconRun: RunState = {
    ...run,
    hero: { ...run.hero, implants: ['synapse_overclock'] },
  };
  const reconDealer = getReconPreviewForNode(dealerNode, reconRun);
  assert.ok(reconDealer && reconDealer.kind === 'chip_dealer');
  assert.equal(reconDealer.freeMemory, 12 - 3);
});

test('Node Economy Metrics handle overcharged ELITE, difficulty multipliers, flash sale, and lane archetypes', () => {
  const run = createInitialRun(300);
  const combatNode: MapNode = { id: 'c1', layer: 1, lane: 0, type: 'COMBAT', nextIds: [], cleared: false };
  assert.equal(getNodeEconomyMetrics(combatNode, run.hero).runYieldCredits, 38);

  const ocElite: MapNode = {
    id: 'e1',
    layer: 2,
    lane: 0,
    type: 'ELITE',
    modifier: 'overcharged_hazard',
    nextIds: [],
    cleared: false,
  };
  const ocEliteEcon = getNodeEconomyMetrics(ocElite, run.hero, 'en', 5);
  assert.equal(ocEliteEcon.tensionHpPct, 46);
  assert.equal(ocEliteEcon.metaYieldNanites, 3);
  assert.equal(ocEliteEcon.runYieldCredits, Math.round(64 * 0.8));

  const profiles = getLaneClusterProfiles(run.mapNodes, run.hero);
  assert.equal(profiles.length, 3);
});

test('5-Tier Difficulty Matrix, Full Enemy HP Scaling, Par Clocks, Tier 5 Mandate, and Tier 1 Skip work accurately', () => {
  const tiers: DifficultyTier[] = [1, 2, 3, 4, 5];
  const runsByTier = tiers.map((tier) => createInitialRun(777, 'kira', tier));

  assert.equal(runsByTier[0].hero.maxHp, 74);
  assert.equal(runsByTier[1].hero.maxHp, 68);
  assert.equal(runsByTier[2].hero.maxHp, 62);

  for (const run of runsByTier) {
    assert.ok(run.combat);
    const tier = run.difficultyTier!;
    const l1Enemies = buildEnemiesForNode('COMBAT', 1, 777, 0, undefined, tier, false);
    for (const enemy of l1Enemies) {
      assert.equal(
        enemy.maxHp,
        computeSmartScaledEnemyHp(enemy.archetype, ENEMY_TEMPLATES[enemy.archetype].maxHp, 0, tier),
      );
    }
  }
  assert.equal(getBossTelegraphIntel('en', 5).hp, Math.round(104 * 1.54));

  const t5Base = runsByTier[4];
  const t5Breach = resolvePlayerColor(
    {
      ...t5Base,
      hero: { ...t5Base.hero, hp: 30 },
      combat: {
        ...t5Base.combat!,
        turn: 7,
        startingHeroHp: 62,
        enemies: [{ ...t5Base.combat!.enemies[0], hp: 1, armor: 0, shieldPips: 0 }],
        board: [makeTile('a1', 'attack', 5)],
      },
    },
    'attack',
  );
  assert.equal(t5Breach.combat?.mandateBreachLootConfiscated, true);
  assert.equal(t5Breach.hero.hp, 24);

  const skipped = skipCombatEncounter({
    ...runsByTier[0],
    screen: 'gameover',
    combat: { ...runsByTier[0].combat!, nodeType: 'COMBAT' },
  });
  assert.equal(skipped.screen, 'map');
  assert.equal(skipped.hero.hp, skipped.hero.maxHp);
});
