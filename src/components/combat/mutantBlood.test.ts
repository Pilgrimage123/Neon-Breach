import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialRun, startNodeEncounter } from '../../engine/gameEngine';
import type { CombatState, EnemyArchetype } from '../../engine/types';
import {
  COVER_BLOOD_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  createCombatStageSim,
} from './combatStageTypes';
import { applyCombatCues, spawnAlienBloodImpact, stepCombatSimulation } from './combatVfx';
import { addOrGrowFloorBlood } from './combatBloodDecals';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
  resolveWeaponDecalKind,
  sampleWeatheredBloodColors,
} from './mutantBlood';

test('all 7 enemy archetypes map to distinct biologically grounded blood profiles', () => {
  const expected: Record<EnemyArchetype, { id: string; veins: boolean; minIri: number }> = {
    skitter: { id: 'hemocyanin', veins: false, minIri: 0 },
    larva: { id: 'chlorocruorin', veins: false, minIri: 0 },
    stinger: { id: 'sulfur_amber', veins: false, minIri: 0.8 },
    spitter: { id: 'sulfur_violet', veins: false, minIri: 0.9 },
    stalker: { id: 'chitinous_ichor_magenta', veins: true, minIri: 0.2 },
    brute: { id: 'chitinous_ichor_orange', veins: true, minIri: 0.2 },
    boss: { id: 'chitinous_ichor_apex', veins: true, minIri: 0.5 },
  };

  for (const [arch, rule] of Object.entries(expected) as Array<
    [EnemyArchetype, { id: string; veins: boolean; minIri: number }]
  >) {
    const profile = getBloodBiologyProfile(arch);
    assert.equal(profile.id, rule.id);
    assert.equal(profile.hasSuspendedVeins, rule.veins);
    assert.ok(profile.iridescence >= rule.minIri);
    assert.ok(profile.dropletPalette.length >= 4);
    assert.notEqual(profile.freshCore, profile.freshBody, 'Beer-Lambert depth requires darker arterial core');
  }
});

test('multi-turn weathering transitions fresh glossy emissive blood to dried matte crusted decals', () => {
  const skitter = getBloodBiologyProfile('skitter');
  const t0 = computeBloodWeatheringState(0);
  const t1 = computeBloodWeatheringState(1);
  const t3 = computeBloodWeatheringState(3);

  assert.equal(t0.dryness, 0);
  assert.ok(t0.glossiness > 0.9);
  assert.equal(t0.emissiveIntensity, 1);
  assert.equal(t0.crustAmount, 0);

  assert.ok(t1.dryness > 0.3 && t1.dryness < 0.4);
  assert.ok(t1.emissiveIntensity < t0.emissiveIntensity);
  assert.ok(t1.crustAmount > 0);

  assert.equal(t3.dryness, 1);
  assert.ok(t3.glossiness <= 0.11);
  assert.equal(t3.emissiveIntensity, 0);
  assert.equal(t3.crustAmount, 1);

  const freshColors = sampleWeatheredBloodColors(skitter, 0);
  const driedColors = sampleWeatheredBloodColors(skitter, 3);
  assert.equal(freshColors.body, skitter.freshBody);
  assert.equal(driedColors.body, skitter.driedBody); // cobalt blue -> dull grey-violet
});

test('resolveWeaponDecalKind maps kinetic, plasma, and melee attacks cleanly', () => {
  assert.equal(
    resolveWeaponDecalKind({
      attackMode: 'shoot',
      characterId: 'auraline',
      equippedDefIds: ['impact_solver'],
    }),
    'kinetic',
  );
  assert.equal(
    resolveWeaponDecalKind({
      attackMode: 'shoot',
      characterId: 'zuri',
      equippedDefIds: ['swarm_vector'],
    }),
    'plasma',
  );
  assert.equal(
    resolveWeaponDecalKind({
      attackMode: 'dash_kick',
      characterId: 'kira',
      equippedDefIds: ['predictive_aim'],
    }),
    'melee',
  );
  assert.equal(
    resolveWeaponDecalKind({
      attackMode: 'shoot',
      characterId: 'kira',
      equippedDefIds: ['predictive_aim'],
      isSurge: true,
    }),
    'kinetic',
  );
  assert.equal(
    resolveWeaponDecalKind({
      cueKind: 'hero_overdrive',
      characterId: 'kira',
    }),
    'plasma',
  );
  assert.equal(
    resolveWeaponDecalKind({
      cueKind: 'hero_slash',
      cueId: 'cue_1_def_pulse',
      characterId: 'kira',
    }),
    'plasma',
  );
});

test('getEnemyStatusVisualFlags detects bleeding and shredded enemies for trail decals', () => {
  const healthy = getEnemyStatusVisualFlags({
    archetype: 'brute',
    hp: 38,
    maxHp: 38,
    armor: 8,
    shieldPips: 1,
    maxShieldPips: 1,
    staggered: false,
    turnDamageTaken: 0,
  });
  assert.deepEqual(healthy, {
    isBleeding: false,
    isSeverelyBleeding: false,
    isShredded: false,
  });

  const shreddedAndBleeding = getEnemyStatusVisualFlags(
    {
      archetype: 'brute',
      hp: 18,
      maxHp: 38,
      armor: 0,
      shieldPips: 0,
      maxShieldPips: 1,
      staggered: true,
      turnDamageTaken: 12,
    },
    8,
  );
  assert.deepEqual(shreddedAndBleeding, {
    isBleeding: true,
    isSeverelyBleeding: true,
    isShredded: true,
  });
});

test('combat VFX spawns weapon-driven floor & cover decals, persists across turns, and leaves trails on Push swap', () => {
  const run = startNodeEncounter(createInitialRun(101, 'auraline'), 'node_0_0');
  const combat = run.combat as CombatState;
  assert.ok(combat);
  assert.ok(combat.enemies.length >= 1);

  const sim = createCombatStageSim();
  sim.size = { w: 1000, h: 400 };

  const target = combat.enemies[0];
  // 1. Kinetic shotgun shot -> spawns floor cone droplets AND rear_cover splatters
  const kineticCombat: CombatState = {
    ...combat,
    turn: 1,
    lastCues: [
      {
        id: 'cue_1_atk_front',
        kind: 'hero_slash',
        targetId: target.id,
        value: 8,
        surge: false,
      },
    ],
  };
  // Force shoot toggle even so primaryAttackMode = 'shoot' (Auraline scattergun = kinetic)
  sim.attackToggle = 0;
  applyCombatCues(sim, kineticCombat, run.hero);
  for (const pi of sim.pendingImpacts) pi.execute();
  sim.pendingImpacts.length = 0;

  const activeFloorAfterShot = sim.floorBlood.filter((p) => p.active);
  const activeCoverAfterShot = sim.coverBlood.filter((c) => c.active);
  assert.ok(activeFloorAfterShot.length >= 2, 'kinetic shot should spawn floor splatters');
  assert.ok(activeCoverAfterShot.length >= 2, 'kinetic shot should project onto rear cover');
  assert.equal(activeFloorAfterShot[0].owner, target.archetype);

  // 2. Plasma Overdrive -> spawns cauterized scorch_ring decals
  const odCombat: CombatState = {
    ...kineticCombat,
    lastCues: [{ id: 'cue_1_od', kind: 'hero_overdrive', value: 20, surge: true }],
  };
  applyCombatCues(sim, odCombat, run.hero);
  for (const pi of sim.pendingImpacts) pi.execute();
  sim.pendingImpacts.length = 0;
  assert.ok(
    sim.floorBlood.some((p) => p.active && p.shapeKind === 'scorch_ring'),
    'overdrive plasma should leave scorch_ring decals',
  );

  // 3. Multi-turn persistence & weathering: advancing 10s of sim time and advancing to Turn 4 keeps decals alive & ages them
  const nextTurnCombat: CombatState = {
    ...odCombat,
    turn: 4,
  };
  applyCombatCues(sim, nextTurnCombat, run.hero);
  for (let step = 0; step < 60; step++) {
    stepCombatSimulation(sim, 0.25); // 15 seconds total
  }
  const survivingTurn4 = sim.floorBlood.filter((p) => p.active && p.createdTurn === 1);
  assert.ok(survivingTurn4.length >= 4, 'decals must persist across turns instead of evaporating');
  assert.ok(
    survivingTurn4.every((p) => p.visualTurnAge > 2.5),
    'surviving decals should weather smoothly toward turnAge 3+',
  );

  // 4. Bleeding/Shredded unit slot swap (Push [R]) spawns movement trail_drop decals
  if (nextTurnCombat.enemies.length >= 2) {
    const woundedA = { ...nextTurnCombat.enemies[0], hp: Math.max(1, nextTurnCombat.enemies[0].hp - 4) };
    const woundedB = { ...nextTurnCombat.enemies[1], hp: Math.max(1, nextTurnCombat.enemies[1].hp - 4) };
    const preSwapCombat: CombatState = {
      ...nextTurnCombat,
      enemies: [woundedA, woundedB, ...nextTurnCombat.enemies.slice(2)],
    };
    applyCombatCues(sim, preSwapCombat, run.hero);
    const swappedCombat: CombatState = {
      ...preSwapCombat,
      enemies: [woundedB, woundedA, ...preSwapCombat.enemies.slice(2)],
    };
    applyCombatCues(sim, swappedCombat, run.hero);
    assert.ok(
      sim.floorBlood.some((p) => p.active && p.shapeKind === 'trail_drop'),
      'swapping bleeding enemies should spawn trail_drop decals',
    );
  }

  // 5. Turn Undo prunes decals from undone future turns
  const undoCombat: CombatState = {
    ...nextTurnCombat,
    turn: 0,
  };
  applyCombatCues(sim, undoCombat, run.hero);
  let remainingFloor = 0;
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    if (sim.floorBlood[i].active) remainingFloor++;
  }
  let remainingCover = 0;
  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    if (sim.coverBlood[i].active) remainingCover++;
  }
  assert.equal(remainingFloor, 0);
  assert.equal(remainingCover, 0);
});

test('fourth-wall visor blood drops spray reliably on lethal/surge hits, stay perifoveal, slide with streaks, and disappear', () => {
  const sim = createCombatStageSim();
  sim.size = { w: 1200, h: 420 };

  // Lethal melee hit on Chitin Stalker should spray perifoveal visor droplets
  spawnAlienBloodImpact(sim, 760, 240, 330, 'stalker', 'melee', 1.6, true, 1);

  const activeDrops = sim.screenBlood.filter((sb) => sb.active);
  assert.ok(activeDrops.length >= 3 && activeDrops.length <= 5, 'KO should spray 3..5 visor drops');
  for (const sb of activeDrops) {
    assert.equal(sb.owner, 'stalker');
    assert.ok(sb.radius >= 7.5 && sb.radius <= 18.5, `visor drop radius ${sb.radius} should be clearly visible`);
    const inSideMargin = sb.nx <= 0.27 || sb.nx >= 0.73;
    const inLowerBezel = sb.ny >= 0.75;
    const inUpperRim = sb.ny <= 0.25;
    assert.ok(inSideMargin || inLowerBezel || inUpperRim, `drop (${sb.nx}, ${sb.ny}) should stay perifoveal`);
  }

  // Step 4 seconds: drops slide with visible gravity runner streaks
  for (let i = 0; i < 40; i++) stepCombatSimulation(sim, 0.1);
  const midDrops = sim.screenBlood.filter((sb) => sb.active);
  assert.ok(midDrops.length > 0);
  assert.ok(midDrops.every((sb) => sb.slideOffsetPx > 0 && sb.streakLen > 0));

  // Step 8 more seconds: all drops slowly evaporate and clear
  for (let i = 0; i < 80; i++) stepCombatSimulation(sim, 0.1);
  const afterDrops = sim.screenBlood.filter((sb) => sb.active);
  assert.equal(afterDrops.length, 0, 'fourth-wall screen blood drops should slowly disappear');

  // High-intensity plasma/overdrive impact also sprays visor drops when cooldown is clear
  sim.screenBloodCooldown = 0;
  spawnAlienBloodImpact(sim, 760, 240, 330, 'spitter', 'plasma', 1.5, false, 1);
  const plasmaDrops = sim.screenBlood.filter((sb) => sb.active);
  assert.ok(plasmaDrops.length >= 1, 'high-intensity plasma/overdrive should also spray visor drops');
});

test('overlapping floor blood puddles coalesce into a single continuous pool on impact and during spread', () => {
  const sim = createCombatStageSim();
  sim.size = { w: 1000, h: 400 };

  // Two nearby splatters of the same biology coalesce immediately via elliptical overlap
  addOrGrowFloorBlood(sim, 600, 315, 5.5, 4, { owner: 'skitter', shapeKind: 'puddle' });
  const firstPool = sim.floorBlood.find((p) => p.active);
  assert.ok(firstPool);
  const initialRx = firstPool.targetRx;

  addOrGrowFloorBlood(sim, 618, 317, 5.0, 3, { owner: 'skitter', shapeKind: 'puddle' });
  const activeCountAfterOverlap = sim.floorBlood.filter((p) => p.active).length;
  assert.equal(activeCountAfterOverlap, 1, 'nearby overlapping splatters should coalesce into one pool');
  assert.ok(firstPool.targetRx > initialRx, 'coalesced pool should grow in radius');

  // Two separate pools placed outside initial merge threshold coalesce as they spread
  const sepX = Math.round(firstPool.x + firstPool.targetRx + 18);
  addOrGrowFloorBlood(sim, sepX, firstPool.y, 4.5, 2, { owner: 'skitter', shapeKind: 'puddle' });
  const poolsBeforeSpread = sim.floorBlood.filter((p) => p.active);
  assert.equal(poolsBeforeSpread.length, 2, 'distant pool starts separate before spreading');
  for (const p of poolsBeforeSpread) {
    p.flowVx = 0;
    p.flowVy = 0;
    p.spreadRateX = 8;
  }
  for (let i = 0; i < 30; i++) stepCombatSimulation(sim, 0.1);
  assert.equal(
    sim.floorBlood.filter((p) => p.active).length,
    1,
    'neighboring pools should merge seamlessly as they spread into each other',
  );
});
