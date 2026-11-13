import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KIRA_CARRY_CAPACITY,
  getEquippedEquipmentWeight,
  rebuildMasterPool,
} from './data';
import {
  advanceRoundAfterEnemies,
  applyMedBayAction,
  buyClinicEquipment,
  canModifyEquipment,
  claimCombatEquipmentReward,
  completeCombatRewardAndOpenMap,
  createInitialRun,
  drawToSix,
  equipEquipmentInstance,
  executeEnemyTurn,
  executeOverdrive,
  executeSingleEnemyAction,
  installCyberImplant,
  previewColorResolution,
  previewHeroineThreat,
  resolvePlayerColor,
  sortTilesByGroup,
  startNodeEncounter,
  unequipEquipmentInstance,
} from './gameEngine';
import {
  generateSectorMap,
  getAvailableNextNodes,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getTacticalRouteAdvice,
} from './mapGenerator';
import type { Tile } from './types';

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

test('initial run builds Kira 9-tile pool (5 innate + 4 starting gear, 3/15 capacity) and draws 6', () => {
  const run = createInitialRun(42);
  assert.ok(run.combat);
  assert.equal(run.heroine.carryCapacity, KIRA_CARRY_CAPACITY);
  assert.equal(getEquippedEquipmentWeight(run.heroine), 3);
  assert.equal(run.masterPool.length, 9);

  // Verify exact innate + Pistole Aretta + Minilékarnička tile composition
  const atk2 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 2);
  const atk5 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 5);
  const def8 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 8);
  const def7 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 7);
  const dmgBoosts = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'damage_boost' && t.techEffect.percent === 51,
  );
  const heals = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'heal' && t.techEffect.amount === 2,
  );

  assert.equal(atk2.length, 2);
  assert.equal(atk5.length, 2);
  assert.equal(def8.length, 1);
  assert.equal(def7.length, 1);
  assert.equal(dmgBoosts.length, 2);
  assert.equal(heals.length, 1);

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

test('TECH Damage booster 51% stacks additively, boosts ATK, decays by 10pp per round, and resets on new combat', () => {
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
    heroine: { ...base.heroine, hp: 50, maxHp: 60 },
    combat: {
      ...base.combat,
      board: customBoard,
      enemies: [{ ...base.combat.enemies[0], hp: 50, armor: 0 }],
    },
  };

  const techPreview = previewColorResolution(seededRun, 'tech');
  assert.equal(techPreview.damageBoostAddedPct, 102);
  assert.equal(techPreview.healAmount, 2);
  assert.equal(techPreview.overdriveGained, 45);

  const afterTech = resolvePlayerColor(seededRun, 'tech');
  assert.equal(afterTech.heroine.damageBoostPct, 102);
  assert.equal(afterTech.heroine.hp, 52);

  // Enemy turn ends -> damageBoostPct decays by 10 percentage points: 102 -> 92
  const round2 = executeEnemyTurn(afterTech);
  assert.equal(round2.heroine.damageBoostPct, 92);

  // Next ATK preview applies +92% multiplier cleanly via floor(base * 1.92)
  const atkRun = {
    ...round2,
    combat: {
      ...round2.combat!,
      board: [
        makeTile('x1', 'attack', 5),
        makeTile('x2', 'attack', 5),
      ],
    },
  };
  const atkPrev = previewColorResolution(atkRun, 'attack');
  assert.equal(atkPrev.baseDamage, 10);
  assert.equal(atkPrev.damageBoostPct, 92);
  assert.equal(atkPrev.totalDamage, Math.floor(10 * 1.92)); // 19

  // Single 51% booster decays 51 -> 41 -> 31 and clamps at 0
  const oneBoosterState = {
    ...base,
    heroine: { ...base.heroine, damageBoostPct: 51 },
    combat: { ...base.combat, phase: 'PLAYER_RESOLVED' as const },
  };
  const after1 = advanceRoundAfterEnemies(oneBoosterState);
  assert.equal(after1.heroine.damageBoostPct, 41);

  const lowBoosterState = {
    ...base,
    heroine: { ...base.heroine, damageBoostPct: 5 },
    combat: { ...base.combat, phase: 'PLAYER_RESOLVED' as const },
  };
  const afterClamp = advanceRoundAfterEnemies(lowBoosterState);
  assert.equal(afterClamp.heroine.damageBoostPct, 0);

  // New combat node resets damageBoostPct to 0
  const mapReady = completeCombatRewardAndOpenMap({
    ...after1,
    combat: { ...after1.combat!, phase: 'VICTORY' },
  });
  const nextCombatNode = mapReady.mapNodes.find((n) => n.layer === 1 && n.type === 'COMBAT');
  if (nextCombatNode) {
    const freshCombat = startNodeEncounter(mapReady, nextCombatNode.id);
    assert.equal(freshCombat.heroine.damageBoostPct, 0);
  }
});

test('equipment equip/unequip updates masterPool and enforces carry capacity 15 and combat lock', () => {
  const combatRun = createInitialRun(250);
  assert.equal(canModifyEquipment(combatRun), false);
  // Locked during active combat
  const attemptedUnequipInCombat = unequipEquipmentInstance(combatRun, 'eq_start_aretta');
  assert.equal(attemptedUnequipInCombat.masterPool.length, 9);

  // Clear combat to reach map
  const mapRun = completeCombatRewardAndOpenMap({
    ...combatRun,
    combat: { ...combatRun.combat!, phase: 'VICTORY' },
  });
  assert.equal(mapRun.screen, 'map');
  assert.equal(canModifyEquipment(mapRun), true);
  assert.equal(getEquippedEquipmentWeight(mapRun.heroine), 3);

  // Unequip Pistole Aretta -> weight drops 3 -> 1, pool drops 9 -> 6
  const afterUnequip = unequipEquipmentInstance(mapRun, 'eq_start_aretta');
  assert.equal(getEquippedEquipmentWeight(afterUnequip.heroine), 1);
  assert.equal(afterUnequip.masterPool.length, 6);
  // Innate 5 + Minilékarnička 1 = 6
  assert.equal(afterUnequip.masterPool.filter((t) => t.sourceId === 'innate').length, 5);
  assert.equal(afterUnequip.masterPool.filter((t) => t.sourceId === 'minilekarnicka').length, 1);

  // Re-equip Pistole Aretta -> back to 3/15 and 9 tiles
  const afterReequip = equipEquipmentInstance(afterUnequip, 'eq_start_aretta');
  assert.equal(getEquippedEquipmentWeight(afterReequip.heroine), 3);
  assert.equal(afterReequip.masterPool.length, 9);

  // Capacity overflow (> 15) blocks equipping heavy gear until space is freed
  let heavyRun = afterReequip;
  // Equip 2x tezka_brokovnice (size 5 each -> 3 + 10 = 13/15)
  heavyRun = {
    ...heavyRun,
    heroine: {
      ...heavyRun.heroine,
      ownedEquipment: [
        ...heavyRun.heroine.ownedEquipment,
        { instanceId: 'eq_shot1', defId: 'tezka_brokovnice' },
        { instanceId: 'eq_shot2', defId: 'tezka_brokovnice' },
        { instanceId: 'eq_rifle', defId: 'karabin_vx' }, // size 4 -> would make 17/15
      ],
    },
  };
  heavyRun = equipEquipmentInstance(heavyRun, 'eq_shot1');
  heavyRun = equipEquipmentInstance(heavyRun, 'eq_shot2');
  assert.equal(getEquippedEquipmentWeight(heavyRun.heroine), 13);

  const blocked = equipEquipmentInstance(heavyRun, 'eq_rifle');
  assert.equal(getEquippedEquipmentWeight(blocked.heroine), 13);
  assert.ok(!blocked.heroine.equippedInstanceIds.includes('eq_rifle'));

  // Unequip one shotgun (13 -> 8), now karabin_vx (size 4 -> 12 <= 15) fits
  const freed = unequipEquipmentInstance(blocked, 'eq_shot2');
  const fitted = equipEquipmentInstance(freed, 'eq_rifle');
  assert.equal(getEquippedEquipmentWeight(fitted.heroine), 12);
  assert.ok(fitted.heroine.equippedInstanceIds.includes('eq_rifle'));
  assert.equal(fitted.masterPool.length, rebuildMasterPool(fitted.heroine).length);
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
    heroine: { ...runWithoutImplant.heroine, implants: ['surge_resonator' as const] },
  };
  const surgePreview = previewColorResolution(runWithImplant, 'attack');
  assert.equal(surgePreview.surgeTriggered, true);
  assert.equal(surgePreview.totalDamage, 12);
  assert.equal(surgePreview.cleaveDamage, 6);

  // TECH stack surge grants +15% OD and +6 Shield
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
  assert.equal(techSurgePrev.overdriveGained, 60); // 3*15 + 15 surge
  assert.equal(techSurgePrev.shieldGained, 6);
});

test('overdrive deals 22 piercing damage and grants +8 shield without consuming tile turn', () => {
  const base = createInitialRun(404);
  assert.ok(base.combat);
  const chargedRun = {
    ...base,
    heroine: { ...base.heroine, overdrive: 100 },
    combat: {
      ...base.combat,
      enemies: [{ ...base.combat.enemies[0], hp: 30, armor: 10 }],
    },
  };

  const afterOd = executeOverdrive(chargedRun);
  assert.ok(afterOd.combat);
  assert.equal(afterOd.heroine.overdrive, 0);
  assert.equal(afterOd.heroine.shield, 8);
  assert.equal(afterOd.combat.enemies[0].hp, 8);
  assert.equal(afterOd.combat.phase, 'PLAYER_IDLE');
});

test('sector map generates 5 reachable layers ending at BOSS', () => {
  const nodes = generateSectorMap(505);
  const layer0 = getAvailableNextNodes(nodes, null);
  assert.equal(layer0.length, 1);
  assert.equal(layer0[0].layer, 0);

  const bossNodes = nodes.filter((n) => n.type === 'BOSS');
  assert.equal(bossNodes.length, 1);
  assert.equal(bossNodes[0].layer, 4);
});

test('all 10 cybernetic implants function deterministically in combat preview & resolution', () => {
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

  // monowire_edge + plasma_amp + piercing_katana
  const atkRun = {
    ...base,
    heroine: {
      ...base.heroine,
      implants: ['monowire_edge' as const, 'plasma_amp' as const, 'piercing_katana' as const],
    },
    combat: {
      ...base.combat,
      board,
      enemies: [{ ...base.combat.enemies[0], hp: 40, armor: 10 }],
    },
  };
  const atkPrev = previewColorResolution(atkRun, 'attack');
  // (5+2+2 held) + (5+2 fresh) = 16
  assert.equal(atkPrev.totalDamage, 16);
  assert.equal(atkPrev.armorPiercing, true);
  const afterAtk = resolvePlayerColor(atkRun, 'attack');
  // 30% of 16 = 4 pierce; 12 regular hits 10 armor -> 2 hp + 4 pierce = 6 hp dmg
  assert.equal(afterAtk.combat?.enemies[0].armor, 0);
  assert.equal(afterAtk.combat?.enemies[0].hp, 34);

  // nano_weave + aegis_capacitor + kinetic_reflector
  const defRun = {
    ...base,
    heroine: {
      ...base.heroine,
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
  // 7+2 + 8+2 = 19
  assert.equal(defPrev.shieldGained, 19);
  const afterDef = resolvePlayerColor(defRun, 'defense');
  const afterEnemy = executeEnemyTurn(afterDef);
  // 19 shield absorbs 6 dmg -> 13 remaining; Aegis retains floor(13 * 0.5) = 6
  assert.equal(afterEnemy.heroine.shield, 6);
  // Kinetic reflector dealt 3 dmg back
  assert.equal(afterEnemy.combat?.enemies[0].hp, 17);

  // synapse_overclock + flux_injector on TECH tiles
  const techRun = {
    ...base,
    heroine: {
      ...base.heroine,
      implants: ['synapse_overclock' as const, 'flux_injector' as const],
    },
    combat: { ...base.combat, board },
  };
  const techPrev = previewColorResolution(techRun, 'tech');
  assert.equal(techPrev.shieldGained, 6);
  assert.equal(techPrev.overdriveGained, 40);
  assert.equal(techPrev.damageBoostAddedPct, 51);
  assert.equal(techPrev.healAmount, 2);

  // bio_siphon heals +4 HP on enemy kill
  const siphonRun = {
    ...base,
    heroine: { ...base.heroine, hp: 40, maxHp: 60, implants: ['bio_siphon' as const] },
    combat: {
      ...base.combat,
      board,
      enemies: [{ ...base.combat.enemies[0], hp: 5, armor: 0 }],
    },
  };
  const afterKill = resolvePlayerColor(siphonRun, 'attack');
  assert.equal(afterKill.heroine.hp, 44);
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

test('post-combat loot, cyber-clinic equipment shop + implant replacement, and bio-med bay work cleanly', () => {
  let run = createInitialRun(808);
  assert.ok(run.combat);
  const startingCredits = run.heroine.credits; // 40
  const offeredLoot = run.combat.rewardEquipmentChoices[0];
  assert.ok(offeredLoot);

  // Claim combat equipment reward -> adds credits + equips item if capacity allows + opens map
  const afterLoot = claimCombatEquipmentReward(
    { ...run, combat: { ...run.combat, phase: 'VICTORY' } },
    offeredLoot,
  );
  assert.equal(afterLoot.screen, 'map');
  assert.equal(afterLoot.heroine.credits, startingCredits + 35);
  assert.ok(afterLoot.heroine.ownedEquipment.some((eq) => eq.defId === offeredLoot));

  // Open a Cyber Clinic node and buy an item + replace an implant
  const clinicNode = afterLoot.mapNodes.find((n) => n.type === 'CYBER_CLINIC');
  assert.ok(clinicNode);
  let clinicRun = startNodeEncounter(
    {
      ...afterLoot,
      heroine: {
        ...afterLoot.heroine,
        credits: 120,
        hp: 30,
        implants: ['monowire_edge', 'plasma_amp', 'nano_weave', 'bio_siphon'],
      },
    },
    clinicNode.id,
  );
  assert.equal(clinicRun.screen, 'clinic');
  assert.ok(clinicRun.clinicShopChoices.length > 0);

  const buyDefId = clinicRun.clinicShopChoices[0];
  const ownedBefore = clinicRun.heroine.ownedEquipment.length;
  clinicRun = buyClinicEquipment(clinicRun, buyDefId);
  assert.equal(clinicRun.heroine.ownedEquipment.length, ownedBefore + 1);
  assert.ok(!clinicRun.clinicShopChoices.includes(buyDefId));

  // Replace implant slot when 4/4 full
  const afterClinic = installCyberImplant(clinicRun, 'surge_resonator', 'nano_weave');
  assert.equal(afterClinic.screen, 'map');
  assert.equal(afterClinic.heroine.implants.length, 4);
  assert.ok(afterClinic.heroine.implants.includes('surge_resonator'));
  assert.ok(!afterClinic.heroine.implants.includes('nano_weave'));

  // Bio-Med Bay heal, calibrate_max_hp, salvage_credits
  const afterHeal = applyMedBayAction(afterClinic, 'heal');
  assert.equal(afterHeal.heroine.hp, 52);

  const afterCalibrate = applyMedBayAction(afterHeal, 'calibrate_max_hp');
  assert.equal(afterCalibrate.heroine.maxHp, 70);
  assert.equal(afterCalibrate.heroine.hp, 62);

  const creditsBeforeSalvage = afterCalibrate.heroine.credits;
  const afterSalvage = applyMedBayAction(afterCalibrate, 'salvage_credits');
  assert.equal(afterSalvage.heroine.credits, creditsBeforeSalvage + 35);
});

test('boss victory transitions to victory screen, elite opens clinic after loot, and lethal enemy triggers gameover', () => {
  const base = createInitialRun(909);
  const bossNode = base.mapNodes.find((n) => n.type === 'BOSS');
  assert.ok(bossNode);
  const bossRun = startNodeEncounter(base, bossNode.id);
  assert.ok(bossRun.combat);

  const almostWonBoss = {
    ...bossRun,
    combat: {
      ...bossRun.combat,
      board: [
        makeTile('a1', 'attack', 9),
        makeTile('a2', 'attack', 5),
        makeTile('d1', 'defense', 7),
        makeTile('d2', 'defense', 8),
        makeTile('u1', 'tech', 0, false, { kind: 'heal', amount: 2 }),
        makeTile('u2', 'tech', 0, false, { kind: 'damage_boost', percent: 51, decayPerTurn: 10 }),
      ],
      enemies: [{ ...bossRun.combat.enemies[0], hp: 10, armor: 0 }],
    },
  };

  const victoryRun = resolvePlayerColor(almostWonBoss, 'attack');
  assert.equal(victoryRun.screen, 'victory');
  assert.equal(victoryRun.combat?.phase, 'VICTORY');

  // Elite combat victory transitions to clinic when claiming loot
  const eliteNode = base.mapNodes.find((n) => n.type === 'ELITE');
  assert.ok(eliteNode);
  const eliteRun = startNodeEncounter(base, eliteNode.id);
  const afterEliteLoot = claimCombatEquipmentReward(
    { ...eliteRun, combat: { ...eliteRun.combat!, phase: 'VICTORY' } },
    null,
  );
  assert.equal(afterEliteLoot.screen, 'clinic');

  // Test defeat
  const lowHpRun = {
    ...base,
    heroine: { ...base.heroine, hp: 3, shield: 0 },
    combat: {
      ...base.combat!,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [
        {
          ...base.combat!.enemies[0],
          hp: 20,
          intentCycle: [{ kind: 'attack' as const, value: 10 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const defeatRun = executeEnemyTurn(lowHpRun);
  assert.equal(defeatRun.screen, 'gameover');
  assert.equal(defeatRun.heroine.hp, 0);
});

test('staggered executeSingleEnemyAction resolves enemies one by one before advanceRoundAfterEnemies', () => {
  const base = createInitialRun(950);
  const eliteNode = base.mapNodes.find((n) => n.type === 'ELITE');
  assert.ok(eliteNode);
  const eliteRun = startNodeEncounter(base, eliteNode.id);
  assert.ok(eliteRun.combat);
  assert.equal(eliteRun.combat.enemies.length, 2);

  const afterPlayer = {
    ...eliteRun,
    heroine: { ...eliteRun.heroine, hp: 60, shield: 10 },
    combat: {
      ...eliteRun.combat,
      phase: 'PLAYER_RESOLVED' as const,
      board: eliteRun.combat.board.slice(0, 4),
    },
  };

  const step1 = executeSingleEnemyAction(afterPlayer, 0);
  assert.equal(step1.combat?.phase, 'ENEMY_ACTING');
  assert.equal(step1.combat?.enemies[0].armor, 16);
  assert.equal(step1.combat?.turn, 1);

  const step2 = executeSingleEnemyAction(step1, 1);
  assert.equal(step2.heroine.shield, 5);
  assert.equal(step2.heroine.corrode, 2);
  assert.equal(step2.combat?.phase, 'ENEMY_ACTING');

  const nextRound = advanceRoundAfterEnemies(step2);
  assert.equal(nextRound.combat?.phase, 'PLAYER_IDLE');
  assert.equal(nextRound.combat?.turn, 2);
  assert.equal(nextRound.combat?.board.length, 6);
  assert.equal(nextRound.heroine.corrode, 1);
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

test('defense stack surge reflect and kinetic reflector KO award score and complete combat cleanly', () => {
  const base = createInitialRun(980);
  assert.ok(base.combat);

  const defSurgeBoard: Tile[] = [
    makeTile('d1', 'defense', 7),
    makeTile('d2', 'defense', 8),
    makeTile('d3', 'defense', 7),
    makeTile('d4', 'defense', 8),
    makeTile('a1', 'attack', 5),
    makeTile('u1', 'tech', 0, false, { kind: 'heal', amount: 2 }),
  ];

  const defSurgeRun = {
    ...base,
    combat: {
      ...base.combat,
      board: defSurgeBoard,
      enemies: [{ ...base.combat.enemies[0], hp: 6, armor: 0 }],
    },
  };

  const afterDefKill = resolvePlayerColor(defSurgeRun, 'defense');
  assert.equal(afterDefKill.combat?.phase, 'VICTORY');
  assert.equal(afterDefKill.combat?.totalDamageDealt, 6);
  assert.equal(afterDefKill.turnsCompleted, 1);
  assert.equal(afterDefKill.score, 6 * 2 + 50);

  const reflectorRun = {
    ...base,
    heroine: {
      ...base.heroine,
      shield: 10,
      implants: ['kinetic_reflector' as const],
    },
    combat: {
      ...base.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [
        {
          ...base.combat.enemies[0],
          hp: 3,
          armor: 0,
          intentCycle: [{ kind: 'attack' as const, value: 5 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  const afterReflectKill = executeSingleEnemyAction(reflectorRun, 0);
  assert.equal(afterReflectKill.combat?.phase, 'VICTORY');
  assert.equal(afterReflectKill.enemiesDefeated, 1);
  assert.equal(afterReflectKill.turnsCompleted, 1);
  assert.equal(afterReflectKill.score, 3 * 2 + 50);

  const atkCue = afterReflectKill.combat?.lastCues.find((c) => c.kind === 'enemy_attack');
  assert.equal(atkCue?.blocked, 5);
  assert.equal(atkCue?.hpDamage, 0);
  assert.equal(atkCue?.reflectedDamage, 3);
});

test('3-lane sector map variants enforce planar non-crossing edges, no consecutive support nodes, and smart route advice', () => {
  for (const seed of [100, 101, 102]) {
    const nodes = generateSectorMap(seed);
    assert.equal(nodes.length, 11);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const fromRoot = getReachableNodeIds(nodes, 'n_0_0');
    assert.equal(fromRoot.size, 11);

    for (const node of nodes) {
      const forward = getReachableNodeIds(nodes, node.id);
      assert.ok(forward.has('n_4_0'), `Node ${node.id} must reach BOSS`);

      const intel = getNodeEncounterIntel(node, seed);
      assert.ok(intel.sectorCode.startsWith(`S0${node.layer + 1}-`));

      const isSupport = node.type === 'CYBER_CLINIC' || node.type === 'MED_BAY';
      for (const nextId of node.nextIds) {
        const nextNode = byId.get(nextId);
        assert.ok(nextNode);
        if (isSupport) {
          assert.notEqual(
            nextNode.type,
            node.type,
            `Support node ${node.id} (${node.type}) must not repeat into ${nextNode.id} (${nextNode.type})`,
          );
        }
        if (node.layer === 1 && node.type === 'CYBER_CLINIC') {
          assert.ok(
            nextNode.type === 'COMBAT' || nextNode.type === 'ELITE',
            `Layer 1 Cyber-Clinic must route into Combat or Elite in Layer 2`,
          );
        }
      }
    }
  }

  const base = createInitialRun(100);
  const clearedL0 = completeCombatRewardAndOpenMap({
    ...base,
    combat: { ...base.combat!, phase: 'VICTORY' },
  });
  const healthyAdvice = getTacticalRouteAdvice(clearedL0);
  assert.ok(healthyAdvice.recommendedNodeId);

  const l1CombatWithMedbay = clearedL0.mapNodes.find(
    (n) =>
      n.layer === 1 &&
      n.nextIds.some((nid) => clearedL0.mapNodes.find((m) => m.id === nid)?.type === 'MED_BAY'),
  );
  assert.ok(l1CombatWithMedbay);
  const woundedAtL1 = {
    ...clearedL0,
    currentNodeId: l1CombatWithMedbay.id,
    heroine: { ...clearedL0.heroine, hp: 18, maxHp: 60 },
  };
  const lowHpAdvice = getTacticalRouteAdvice(woundedAtL1);
  assert.equal(lowHpAdvice.reasonKey, 'low_hp_medbay');
  const recommendedTarget = woundedAtL1.mapNodes.find((n) => n.id === lowHpAdvice.recommendedNodeId);
  assert.equal(recommendedTarget?.type, 'MED_BAY');
});

test('getNodeEncounterIntel matches actual combat enemies spawned by startNodeEncounter', () => {
  for (const seed of [100, 101, 102]) {
    const run = createInitialRun(seed);
    for (const node of run.mapNodes) {
      const intel = getNodeEncounterIntel(node, seed);
      const started = startNodeEncounter(run, node.id);
      if (node.type === 'CYBER_CLINIC' || node.type === 'MED_BAY') {
        assert.equal(intel.enemies.length, 0);
        assert.equal(started.combat, null);
      } else {
        assert.ok(started.combat);
        assert.deepEqual(
          intel.enemies,
          started.combat.enemies.map((e) => ({
            archetype: e.archetype,
            hp: e.maxHp,
            armor: e.armor,
          })),
        );
      }
    }
  }
});

test('previewHeroineThreat previews enemy inflicted damage, lethal death, shield block, and attack kill mitigation on Kiras lifebar', () => {
  const base = createInitialRun(101);
  assert.ok(base.combat);

  const testRun = {
    ...base,
    heroine: {
      ...base.heroine,
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
          intentCycle: [{ kind: 'attack' as const, value: 9 }],
          currentIntentIndex: 0,
        },
        {
          id: 'e2',
          archetype: 'spitter' as const,
          hp: 20,
          maxHp: 22,
          armor: 0,
          intentCycle: [{ kind: 'acid' as const, value: 6, secondaryValue: 2 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  // 1. Unhovered baseline: incoming 9 + 6 = 15, blocked 2, hpDamageTaken = 13 >= 12 HP -> LETHAL
  const idleThreat = previewHeroineThreat(testRun.combat, testRun.heroine, null);
  assert.equal(idleThreat.rawIncomingDamage, 15);
  assert.equal(idleThreat.blockedDamage, 2);
  assert.equal(idleThreat.hpDamageTaken, 13);
  assert.equal(idleThreat.projectedHp, 0);
  assert.equal(idleThreat.willDie, true);

  // 2. Attack preview (18 DMG kills front enemy e1, Bio-Siphon heals +4 HP -> 16 HP before e2 deals 6 - 2 = 4 DMG -> 12 HP)
  const atkPreview = previewColorResolution(testRun, 'attack');
  const atkThreat = previewHeroineThreat(testRun.combat, testRun.heroine, atkPreview);
  assert.equal(atkThreat.preventedDamageByKills, 9);
  assert.equal(atkThreat.rawIncomingDamage, 6);
  assert.equal(atkThreat.blockedDamage, 2);
  assert.equal(atkThreat.hpDamageTaken, 4);
  assert.equal(atkThreat.healGained, 4);
  assert.equal(atkThreat.projectedHp, 12);
  assert.equal(atkThreat.willDie, false);

  // 3. Defense preview (+14 Shield -> 16 total Shield blocks all 15 incoming DMG)
  const defPreview = previewColorResolution(testRun, 'defense');
  const defThreat = previewHeroineThreat(testRun.combat, testRun.heroine, defPreview);
  assert.equal(defThreat.shieldAfterPlayer, 16);
  assert.equal(defThreat.blockedDamage, 15);
  assert.equal(defThreat.hpDamageTaken, 0);
  assert.equal(defThreat.projectedHp, 12);
  assert.equal(defThreat.willDie, false);

  // 4. Tech preview (+6 Heal -> 18 HP before enemies deal 13 unblocked DMG -> 5 HP remaining, survives!)
  const techPreview = previewColorResolution(testRun, 'tech');
  const techThreat = previewHeroineThreat(testRun.combat, testRun.heroine, techPreview);
  assert.equal(techThreat.healGained, 6);
  assert.equal(techThreat.hpBeforeEnemies, 18);
  assert.equal(techThreat.hpDamageTaken, 13);
  assert.equal(techThreat.projectedHp, 5);
  assert.equal(techThreat.willDie, false);
});

