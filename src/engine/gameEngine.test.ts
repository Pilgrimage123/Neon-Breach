import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AURELIA_CARRY_CAPACITY,
  CLINIC_PURGE_COST,
  CLINIC_RESTOCK_COST,
  DROPPABLE_EQUIPMENT_IDS,
  ENEMY_TEMPLATES,
  EQUIPMENT_BY_ID,
  KIRA_CARRY_CAPACITY,
  MAX_UPCHARGE_BOARD_CAPACITY,
  ZURI_CARRY_CAPACITY,
  buildEnemiesForNode,
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
  getEffectiveTileValue,
  installCyberImplant,
  previewColorResolution,
  previewHeroineThreat,
  purgeClinicInnateTile,
  resolveCyberEventChoice,
  resolvePlayerColor,
  restockClinicShop,
  scrapEquipmentInstance,
  skipChipDealer,
  skipCombatEncounter,
  sortTilesByGroup,
  startNodeEncounter,
  unequipEquipmentInstance,
} from './gameEngine';
import { CYBER_EVENT_TEMPLATES, localizeCyberEvent } from './cyberEvents';
import {
  SECTOR_BOSS_TELEGRAPH,
  generateSectorMap,
  getAvailableNextNodes,
  getConnectingPathNodeIds,
  getLaneClusterProfiles,
  getNodeEconomyMetrics,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getReconPreviewForNode,
  getTacticalRouteAdvice,
} from './mapGenerator';
import { getDifficultyProfile } from './difficulty';
import { parseAndValidateRun, recordRunCompletion, loadBestRecord } from './persistence';
import type { DifficultyTier, MapNode, RunState, Tile } from './types';

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

test('initial run builds Kira 9-tile pool (5 innate + 4 starting gear, 3/12 capacity, 3 ATK · 2 DEF · 4 TECH) and draws 6', () => {
  const run = createInitialRun(42);
  assert.ok(run.combat);
  assert.equal(run.heroine.hp, 58);
  assert.equal(run.heroine.maxHp, 58);
  assert.equal(run.heroine.credits, 45);
  assert.equal(run.heroine.carryCapacity, KIRA_CARRY_CAPACITY);
  assert.equal(getEquippedEquipmentWeight(run.heroine), 3);
  assert.equal(run.masterPool.length, 9);

  // Verify exact innate + Pistole Aretta + Minilékarnička tile composition (3 ATK · 2 DEF · 4 TECH)
  const atk3 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 3);
  const atk5 = run.masterPool.filter((t) => t.type === 'attack' && t.value === 5);
  const def8 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 8);
  const def7 = run.masterPool.filter((t) => t.type === 'defense' && t.value === 7);
  const dmgBoosts = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'damage_boost' && t.techEffect.percent === 42,
  );
  const heal2 = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'heal' && t.techEffect.amount === 2,
  );
  const heal3 = run.masterPool.filter(
    (t) => t.type === 'tech' && t.techEffect?.kind === 'heal' && t.techEffect.amount === 3,
  );

  assert.equal(atk3.length, 1);
  assert.equal(atk5.length, 2);
  assert.equal(def8.length, 1);
  assert.equal(def7.length, 1);
  assert.equal(dmgBoosts.length, 2);
  assert.equal(heal2.length, 1);
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
  assert.equal(techPreview.overdriveGained, 60); // Kira passive: 3 * 20% OD

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

test('equipment equip/unequip updates masterPool and enforces carry capacity 12 and combat lock', () => {
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

  // Re-equip Pistole Aretta -> back to 3/12 and 9 tiles
  const afterReequip = equipEquipmentInstance(afterUnequip, 'eq_start_aretta');
  assert.equal(getEquippedEquipmentWeight(afterReequip.heroine), 3);
  assert.equal(afterReequip.masterPool.length, 9);

  // Capacity overflow (> 12) blocks equipping heavy gear until space is freed
  let heavyRun = afterReequip;
  // Equip 1x tezka_brokovnice (size 5) + 1x karabin_vx (size 4) -> 3 + 5 + 4 = 12/12
  heavyRun = {
    ...heavyRun,
    heroine: {
      ...heavyRun.heroine,
      ownedEquipment: [
        ...heavyRun.heroine.ownedEquipment,
        { instanceId: 'eq_shot1', defId: 'tezka_brokovnice' },
        { instanceId: 'eq_rifle', defId: 'karabin_vx' },
        { instanceId: 'eq_shield', defId: 'takticky_stit' }, // size 3 -> would make 15/12
      ],
    },
  };
  heavyRun = equipEquipmentInstance(heavyRun, 'eq_shot1');
  heavyRun = equipEquipmentInstance(heavyRun, 'eq_rifle');
  assert.equal(getEquippedEquipmentWeight(heavyRun.heroine), 12);

  const blocked = equipEquipmentInstance(heavyRun, 'eq_shield');
  assert.equal(getEquippedEquipmentWeight(blocked.heroine), 12);
  assert.ok(!blocked.heroine.equippedInstanceIds.includes('eq_shield'));

  // Unequip rifle (12 -> 8), now takticky_stit (size 3 -> 11 <= 12) fits
  const freed = unequipEquipmentInstance(blocked, 'eq_rifle');
  const fitted = equipEquipmentInstance(freed, 'eq_shield');
  assert.equal(getEquippedEquipmentWeight(fitted.heroine), 11);
  assert.ok(fitted.heroine.equippedInstanceIds.includes('eq_shield'));
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
  assert.equal(techSurgePrev.overdriveGained, 75); // Kira: 3*20 + 15 surge
  assert.equal(techSurgePrev.shieldGained, 6);
});

test('Kira Overdrive (Plasma Blitz) deals 20 piercing damage, grants +6 shield and +30% DMG boost without consuming tile turn', () => {
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
  assert.equal(afterOd.heroine.shield, 6);
  assert.equal(afterOd.heroine.damageBoostPct, 30);
  assert.equal(afterOd.combat.enemies[0].hp, 10);
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
  // Kira passive (+1 held) + monowire (+2 held) + plasma_amp (+2): (5+1+2+2 held) + (5+2 fresh) = 17
  assert.equal(atkPrev.totalDamage, 17);
  assert.equal(atkPrev.armorPiercing, true);
  const afterAtk = resolvePlayerColor(atkRun, 'attack');
  // 30% of 17 = 5 pierce; 12 regular hits 10 armor -> 2 hp + 5 pierce = 7 hp dmg
  assert.equal(afterAtk.combat?.enemies[0].armor, 0);
  assert.equal(afterAtk.combat?.enemies[0].hp, 33);

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
  assert.equal(techPrev.overdriveGained, 50); // Kira: 2*20 + 10 flux
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

  // Open Chip Dealer node to buy an AI Skill Chip, then Cyber-Clinic to replace an implant
  const dealerNode = afterLoot.mapNodes.find((n) => n.type === 'CHIP_DEALER');
  assert.ok(dealerNode);
  let dealerRun = startNodeEncounter(
    {
      ...afterLoot,
      heroine: {
        ...afterLoot.heroine,
        credits: 120,
        hp: 30,
        implants: ['monowire_edge', 'plasma_amp', 'nano_weave', 'bio_siphon'],
      },
    },
    dealerNode.id,
  );
  assert.equal(dealerRun.screen, 'chip_dealer');
  assert.ok(dealerRun.clinicShopChoices.length > 0);

  const buyDefId = dealerRun.clinicShopChoices[0];
  const ownedBefore = dealerRun.heroine.ownedEquipment.length;
  dealerRun = buyClinicEquipment(dealerRun, buyDefId);
  assert.equal(dealerRun.heroine.ownedEquipment.length, ownedBefore + 1);
  assert.ok(!dealerRun.clinicShopChoices.includes(buyDefId));
  const afterDealer = skipChipDealer(dealerRun);
  assert.equal(afterDealer.screen, 'map');

  const clinicNode = afterDealer.mapNodes.find((n) => n.type === 'CYBER_CLINIC');
  assert.ok(clinicNode);
  const clinicRun = startNodeEncounter(afterDealer, clinicNode.id);
  assert.equal(clinicRun.screen, 'clinic');

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
  assert.equal(afterCalibrate.heroine.maxHp, 68);
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
      enemies: [
        {
          ...bossRun.combat.enemies[0],
          hp: 10,
          armor: 0,
          shieldPips: 0,
          phaseGateTriggered: true,
        },
      ],
    },
  };

  const victoryRun = resolvePlayerColor(almostWonBoss, 'attack');
  assert.equal(victoryRun.screen, 'victory');
  assert.equal(victoryRun.combat?.phase, 'VICTORY');
  assert.ok(
    (victoryRun.heroine.nanites ?? 0) >= 5,
    'Boss victory must automatically grant +5 Boss Nanites',
  );

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
  assert.equal(step1.combat?.enemies[0].armor, 14);
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
      enemies: [{ ...base.combat.enemies[0], hp: 8, armor: 0 }],
    },
  };

  const afterDefKill = resolvePlayerColor(defSurgeRun, 'defense');
  assert.equal(afterDefKill.combat?.phase, 'VICTORY');
  assert.equal(afterDefKill.combat?.totalDamageDealt, 8);
  assert.equal(afterDefKill.turnsCompleted, 1);
  assert.equal(afterDefKill.score, 8 * 2 + 50);

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
      if (
        node.type === 'CYBER_CLINIC' ||
        node.type === 'CHIP_DEALER' ||
        node.type === 'MED_BAY' ||
        node.type === 'EVENT'
      ) {
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

test('createInitialRun defaults to kira and supports Auraline Slow Juggernaut stats, Armor, 3 Duds, UpCharge, and Overdrive', () => {
  const defaultRun = createInitialRun(42);
  assert.equal(defaultRun.heroine.characterId, 'kira');
  assert.equal(defaultRun.heroine.maxHp, 58);
  assert.equal(defaultRun.masterPool.length, 9);

  const auralineRun = createInitialRun(42, 'aurelia');
  assert.ok(auralineRun.combat);
  assert.equal(auralineRun.heroine.characterId, 'aurelia');
  assert.equal(auralineRun.heroine.hp, 78);
  assert.equal(auralineRun.heroine.maxHp, 78);
  assert.equal(auralineRun.heroine.armor, 18);
  assert.equal(auralineRun.heroine.credits, 35);
  assert.equal(getEquippedEquipmentWeight(auralineRun.heroine), 4);
  assert.equal(auralineRun.heroine.carryCapacity, AURELIA_CARRY_CAPACITY);
  assert.equal(auralineRun.masterPool.length, 9);

  // Auraline 9-tile pool: 4 ATK (6,6,5,Dud), 3 DEF (8,7,Dud), 2 TECH (Boost 42%, Dud) — 1 Dud per color
  const duds = auralineRun.masterPool.filter((t) => Boolean(t.isDud));
  assert.equal(duds.length, 3);
  assert.equal(duds.filter((t) => t.type === 'attack').length, 1);
  assert.equal(duds.filter((t) => t.type === 'defense').length, 1);
  assert.equal(duds.filter((t) => t.type === 'tech').length, 1);
  assert.equal(auralineRun.masterPool.filter((t) => t.type === 'attack').length, 4);
  assert.equal(auralineRun.masterPool.filter((t) => t.type === 'defense').length, 3);
  assert.equal(auralineRun.masterPool.filter((t) => t.type === 'tech').length, 2);

  assert.equal(auralineRun.combat.board.length, 6);
  assert.equal(auralineRun.combat.drawPile.length, 3);

  // Test Auraline Juggernaut Armor + Dud UpCharge: Duds give 0 base value, +4% OD, Surge count, +1 UpCharge; Armor persists under Shield
  const auralineDefBoard = {
    ...auralineRun,
    heroine: { ...auralineRun.heroine, armor: 18, overdrive: 0, pendingUpcharge: 0 },
    combat: {
      ...auralineRun.combat,
      board: [
        makeTile('ad1', 'defense', 8),
        { ...makeTile('ad2', 'defense', 0), isDud: true },
        makeTile('aa1', 'attack', 6),
        makeTile('aa2', 'attack', 6),
        makeTile('at1', 'tech', 0, false, { kind: 'damage_boost', percent: 42, decayPerTurn: 10 }),
        { ...makeTile('at2', 'tech', 0), isDud: true },
      ],
      drawPile: [
        makeTile('dp1', 'attack', 5),
        makeTile('dp2', 'defense', 7),
        makeTile('dp3', 'attack', 6),
      ],
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
  const auralineDefPrev = previewColorResolution(auralineDefBoard, 'defense');
  assert.equal(auralineDefPrev.shieldGained, 8); // 8 + 0 Dud
  assert.equal(auralineDefPrev.overdriveGained, 8); // 2 * 4% OD (Dud still grants color OD)
  assert.equal(auralineDefPrev.upchargeGained, 1); // +1 UpCharge from 1 Defense Dud
  assert.equal(auralineDefPrev.reflectOnBlock, 0);

  const afterAuralineDef = resolvePlayerColor(auralineDefBoard, 'defense');
  assert.equal(afterAuralineDef.heroine.pendingUpcharge, 1);
  const afterAuralineRound = executeEnemyTurn(afterAuralineDef);
  // 12 incoming - 8 Shield = 4 absorbed by 18 Armor -> 14 Armor left, 78 HP intact, and UpCharge drew to 7 tiles!
  assert.equal(afterAuralineRound.heroine.shield, 0);
  assert.equal(afterAuralineRound.heroine.armor, 14);
  assert.equal(afterAuralineRound.heroine.hp, 78);
  assert.equal(afterAuralineRound.heroine.pendingUpcharge, 0);
  assert.equal(afterAuralineRound.combat?.board.length, 7);

  // Test Auraline Overdrive: 20 piercing DMG All, +10 persistent Armor, +2 UpCharge
  const auralineOdState = {
    ...auralineRun,
    heroine: { ...auralineRun.heroine, overdrive: 100, armor: 10, pendingUpcharge: 0 },
    combat: {
      ...auralineRun.combat,
      enemies: [
        {
          ...auralineRun.combat.enemies[0],
          hp: 30,
          armor: 10,
          shieldPips: 0,
        },
      ],
    },
  };
  const afterAuralineOd = executeOverdrive(auralineOdState);
  assert.equal(afterAuralineOd.heroine.overdrive, 0);
  assert.equal(afterAuralineOd.heroine.armor, 20); // 10 + 10
  assert.equal(afterAuralineOd.heroine.pendingUpcharge, 2);
  assert.equal(afterAuralineOd.combat?.enemies[0].hp, 10); // 30 - 20

  // Unequip Siege Salvo.AI (3 memory, 2 tiles) on map -> weight 4->1, pool 9->7; re-equip -> 4/14, 9
  const mapRun = completeCombatRewardAndOpenMap({
    ...auralineRun,
    combat: { ...auralineRun.combat, phase: 'VICTORY' },
  });
  const afterUnequip = unequipEquipmentInstance(mapRun, 'eq_start_scattergun');
  assert.equal(getEquippedEquipmentWeight(afterUnequip.heroine), 1);
  assert.equal(afterUnequip.masterPool.length, 7);

  const afterReequip = equipEquipmentInstance(afterUnequip, 'eq_start_scattergun');
  assert.equal(getEquippedEquipmentWeight(afterReequip.heroine), 4);
  assert.equal(afterReequip.masterPool.length, 9);
});

test('parseAndValidateRun accepts valid runs and rejects corrupted characterId, enemy intentCycle, or missing arrays', () => {
  const validAurelia = createInitialRun(77, 'aurelia');
  const parsed = parseAndValidateRun(JSON.stringify(validAurelia));
  assert.ok(parsed);
  assert.equal(parsed.heroine.characterId, 'aurelia');

  assert.equal(parseAndValidateRun(null), null);
  assert.equal(parseAndValidateRun('not json'), null);

  // Invalid characterId
  const badChar = structuredClone(validAurelia);
  (badChar.heroine as { characterId: string }).characterId = 'nova';
  assert.equal(parseAndValidateRun(JSON.stringify(badChar)), null);

  // Empty intentCycle
  const emptyCycle = structuredClone(validAurelia);
  emptyCycle.combat!.enemies[0].intentCycle = [];
  assert.equal(parseAndValidateRun(JSON.stringify(emptyCycle)), null);

  // Out-of-bounds currentIntentIndex
  const badIntentIdx = structuredClone(validAurelia);
  badIntentIdx.combat!.enemies[0].currentIntentIndex = 99;
  assert.equal(parseAndValidateRun(JSON.stringify(badIntentIdx)), null);

  // Invalid maxHp
  const zeroMaxHp = structuredClone(validAurelia);
  zeroMaxHp.heroine.maxHp = 0;
  assert.equal(parseAndValidateRun(JSON.stringify(zeroMaxHp)), null);
});

test('three crawler filler enemies (larva, skitter, stinger) scale progressively in strength and spawn across sector encounters', () => {
  const larva = ENEMY_TEMPLATES.larva;
  const skitter = ENEMY_TEMPLATES.skitter;
  const stinger = ENEMY_TEMPLATES.stinger;
  const stalker = ENEMY_TEMPLATES.stalker;

  // All 4 mobs scale in HP and behavior roles
  assert.ok(larva.maxHp < skitter.maxHp && skitter.maxHp < stinger.maxHp);
  assert.ok(stinger.maxHp < stalker.maxHp);

  // Sector 1 (layer 0) features Larva + Stalker
  const l0Enemies = buildEnemiesForNode('COMBAT', 0, 104729, 0);
  assert.deepEqual(
    l0Enemies.map((e) => e.archetype),
    ['larva', 'stalker'],
  );

  // Sector 2 (layer 1) features Cobalt Skitter (skitter) and Spore Mite (larva)
  const l1Lane0 = buildEnemiesForNode('COMBAT', 1, 100, 0);
  const l1Lane1 = buildEnemiesForNode('COMBAT', 1, 100, 1);
  assert.ok(l1Lane0.some((e) => e.archetype === 'skitter'));
  assert.ok(l1Lane0.some((e) => e.archetype === 'larva'));
  assert.ok(l1Lane1.some((e) => e.archetype === 'skitter'));

  // Sector 3 (layer 2) features Pyre Stinger (stinger) staggered onto its armor intent Turn 1
  const l2Combat = buildEnemiesForNode('COMBAT', 2, 100, 1);
  assert.ok(l2Combat.some((e) => e.archetype === 'stinger'));
  const stingerUnit = l2Combat.find((e) => e.archetype === 'stinger');
  assert.ok(stingerUnit);
  assert.equal(stingerUnit.intentCycle[stingerUnit.currentIntentIndex]?.kind, 'charge');
});

test('new TECH effects (armor_shred, overdrive_surge, tactical_shield) and getEffectiveTileValue work accurately', () => {
  const base = createInitialRun(1111, 'kira');
  assert.ok(base.combat);

  const modifiedRun = {
    ...base,
    heroine: {
      ...base.heroine,
      corrode: 3,
      overdrive: 10,
      implants: ['plasma_amp' as const, 'monowire_edge' as const],
    },
    combat: {
      ...base.combat,
      board: [
        makeTile('a1', 'attack', 5, true),
        makeTile('t1', 'tech', 0, false, { kind: 'armor_shred', shredAmount: 10, pierceDamage: 4 }),
        makeTile('t2', 'tech', 0, false, { kind: 'overdrive_surge', bonusOverdrive: 15, cleanseCorrode: 2 }),
        makeTile('t3', 'tech', 0, false, { kind: 'tactical_shield', shieldAmount: 5, damageBoostPct: 22 }),
      ],
      enemies: [
        { ...base.combat.enemies[0], id: 'e1', hp: 30, armor: 8 },
        { ...base.combat.enemies[0], id: 'e2', hp: 20, armor: 12 },
      ],
    },
  };

  // getEffectiveTileValue: base 5 + Kira held (+1) + plasma_amp (+2) + monowire_edge (+2) = 10
  const eff = getEffectiveTileValue(modifiedRun.combat.board[0], modifiedRun.heroine);
  assert.equal(eff.value, 10);
  assert.equal(eff.flatBonus, 5);

  const techPrev = previewColorResolution(modifiedRun, 'tech');
  assert.equal(techPrev.surgeTriggered, false);
  assert.equal(techPrev.armorShredAmount, 10);
  assert.equal(techPrev.techPierceDamage, 4);
  assert.equal(techPrev.cleanseCorrodeAmount, 2);
  assert.equal(techPrev.shieldGained, 5); // 5 tactical_shield (3 tiles < 4 threshold)
  assert.equal(techPrev.damageBoostAddedPct, 22);
  assert.equal(techPrev.overdriveGained, 75); // 3*20 + 15 overdrive_surge

  const threat = previewHeroineThreat(modifiedRun.combat, modifiedRun.heroine, techPrev);
  assert.equal(threat.shieldAfterPlayer, 5);

  const afterTech = resolvePlayerColor(modifiedRun, 'tech');
  assert.ok(afterTech.combat);
  assert.equal(afterTech.combat.enemies[0].armor, 0);
  assert.equal(afterTech.combat.enemies[0].hp, 26); // 4 pierce hit HP directly
  assert.equal(afterTech.combat.enemies[1].armor, 2); // 12 - 10 shredded
  assert.equal(afterTech.heroine.corrode, 1); // 3 - 2 cleansed
  assert.equal(afterTech.heroine.shield, 5);
  assert.equal(afterTech.heroine.damageBoostPct, 22);
  assert.equal(afterTech.heroine.overdrive, 85);

  // With surge_resonator, 3 TECH tiles trigger Stack Surge (+6 Shield, +15% Overdrive)
  const surgeResRun = {
    ...modifiedRun,
    heroine: { ...modifiedRun.heroine, implants: [...modifiedRun.heroine.implants, 'surge_resonator' as const] },
  };
  const surgeTechPrev = previewColorResolution(surgeResRun, 'tech');
  assert.equal(surgeTechPrev.surgeTriggered, true);
  assert.equal(surgeTechPrev.shieldGained, 11);
  assert.equal(surgeTechPrev.overdriveGained, 90);
});

test('13 droppable AI Skill Chips catalog, Chip Vault scrapping, Chip Dealer restock, and Boss tuning', () => {
  assert.equal(DROPPABLE_EQUIPMENT_IDS.length, 13);
  for (const id of [
    'nano_ostri',
    'kryo_kondenzator',
    'pulzni_kuse',
    'energeticky_konvertor',
    'reaktivni_pancir',
    'upcharge_pulse_chip',
    'tactical_upcharge_chip',
    'neural_surge_chip',
  ]) {
    assert.ok(EQUIPMENT_BY_ID[id], `Expected ${id} in EQUIPMENT_BY_ID`);
    assert.equal(EQUIPMENT_BY_ID[id].droppable, true);
  }

  // Boss stats
  assert.equal(ENEMY_TEMPLATES.boss.maxHp, 110);
  assert.equal(ENEMY_TEMPLATES.boss.startingArmor, 10);

  const base = createInitialRun(1212, 'kira');
  const mapRun = completeCombatRewardAndOpenMap({
    ...base,
    combat: { ...base.combat!, phase: 'VICTORY' },
  });

  // Unequip Aretta Pistol -> cannot scrap while equipped, can scrap from Cargo Stash for +15 CR
  const equippedAttempt = scrapEquipmentInstance(mapRun, 'eq_start_aretta');
  assert.equal(equippedAttempt.heroine.ownedEquipment.length, 2);

  const unequipped = unequipEquipmentInstance(mapRun, 'eq_start_aretta');
  const creditsBeforeScrap = unequipped.heroine.credits;
  const afterScrap = scrapEquipmentInstance(unequipped, 'eq_start_aretta');
  assert.equal(afterScrap.heroine.ownedEquipment.length, 1);
  assert.equal(afterScrap.heroine.credits, creditsBeforeScrap + Math.floor(EQUIPMENT_BY_ID.pistole_aretta.price * 0.5));

  // Cannot scrap during combat
  const combatAgain = startNodeEncounter(afterScrap, afterScrap.mapNodes.find((n) => n.layer === 1 && n.type === 'COMBAT')!.id);
  const blockedCombatScrap = scrapEquipmentInstance(combatAgain, 'eq_start_medkit');
  assert.equal(blockedCombatScrap.heroine.ownedEquipment.length, 1);

  // Chip Dealer shop restock spends CLINIC_RESTOCK_COST and rotates choices
  const dealerNode = mapRun.mapNodes.find((n) => n.type === 'CHIP_DEALER')!;
  const dealerRun = startNodeEncounter(
    { ...mapRun, heroine: { ...mapRun.heroine, credits: 80 } },
    dealerNode.id,
  );
  const initialShop = dealerRun.clinicShopChoices.slice();
  const restocked = restockClinicShop(dealerRun);
  assert.equal(restocked.heroine.credits, 80 - CLINIC_RESTOCK_COST);
  assert.equal(restocked.clinicShopChoices.length, 3);
  assert.ok(
    restocked.clinicShopChoices.every((id) => !initialShop.includes(id)),
    'Restock should rotate to different chip options when 13 items exist',
  );
});

test('Moving Lock enemy rules: Aegis Shield Pips, Boss 50% Phase Gate, Spore Mite Volatile Burst, Stalker Spike Retaliation, Skitter Bolster, Stinger Charge, and Spitter Acid Tile Jamming', () => {
  const base = createInitialRun(1337, 'kira');
  assert.ok(base.combat);

  // 1. Aegis Shield Pip negates 1 damaging instance regardless of damage size
  const pipRun = {
    ...base,
    combat: {
      ...base.combat,
      board: [makeTile('a1', 'attack', 20), makeTile('a2', 'attack', 10)],
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'skitter-1',
          archetype: 'skitter' as const,
          hp: 15,
          maxHp: 15,
          armor: 4,
          shieldPips: 1,
          maxShieldPips: 1,
          passive: 'anchor_aegis' as const,
          roleColor: 'blue' as const,
        },
      ],
    },
  };
  const afterPipCrack = resolvePlayerColor(pipRun, 'attack');
  assert.equal(afterPipCrack.combat?.enemies[0].shieldPips, 0);
  assert.equal(afterPipCrack.combat?.enemies[0].hp, 15, 'Aegis Pip must negate the entire 30 DMG hit');
  assert.equal(afterPipCrack.combat?.enemies[0].armor, 4, 'Armor stays intact when Aegis Pip absorbs the hit');

  // 2. Boss 50% Phase Gate clamps damage at 55 HP, grants +10 Armor, and restores 1 Shield Pip
  const bossNode = base.mapNodes.find((n) => n.type === 'BOSS')!;
  const bossRun = startNodeEncounter(base, bossNode.id);
  const bossGateTest = {
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
  };
  const afterBossGate = resolvePlayerColor(bossGateTest, 'attack');
  const gatedBoss = afterBossGate.combat!.enemies[0];
  assert.equal(gatedBoss.hp, 55, '80 DMG hit on 80 HP Boss must clamp at 50% Phase Gate (55 HP)');
  assert.equal(gatedBoss.phaseGateTriggered, true);
  assert.equal(gatedBoss.armor, 10, 'Phase Gate must grant +10 Phase-2 Carapace Armor');
  assert.equal(gatedBoss.shieldPips, 1, 'Phase Gate must restore 1 Aegis Shield Pip');
  const phaseGateCue = afterBossGate.combat!.lastCues.find((c) => c.kind === 'enemy_phase_gate');
  assert.ok(phaseGateCue);
  assert.equal(phaseGateCue.value, 10, 'Phase Gate cue value must match +10 Armor gained');

  // 3. Spore Mite (larva) Volatile Bio-Rupture deals 6 Pierce DMG to surviving allies on death
  const burstRun = {
    ...base,
    combat: {
      ...base.combat,
      board: [makeTile('a1', 'attack', 10), makeTile('a2', 'attack', 5)],
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'larva-front',
          archetype: 'larva' as const,
          hp: 12,
          maxHp: 12,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'volatile_burst' as const,
          roleColor: 'lime' as const,
        },
        {
          ...base.combat.enemies[1],
          id: 'stalker-back',
          archetype: 'stalker' as const,
          hp: 20,
          maxHp: 22,
          armor: 6,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'spike_retaliate' as const,
          roleColor: 'crimson' as const,
        },
      ],
    },
  };
  const afterBurst = resolvePlayerColor(burstRun, 'attack');
  assert.equal(afterBurst.combat?.enemies[0].hp, 0);
  assert.equal(
    afterBurst.combat?.enemies[1].hp,
    14,
    'Volatile Bio-Rupture must deal 6 Pierce DMG directly to surviving ally HP (bypassing 6 Armor)',
  );
  assert.equal(afterBurst.combat?.enemies[1].armor, 6);
  assert.ok(afterBurst.combat?.lastCues.some((c) => c.kind === 'enemy_burst'));

  // 4. Chitin Stalker Spike Retaliation deals 3 DMG on non-Surge Attack and is bypassed by 4+ Stack Surge
  const stalkerRun = {
    ...base,
    heroine: { ...base.heroine, hp: 40, shield: 1 },
    combat: {
      ...base.combat,
      board: [
        makeTile('a1', 'attack', 5),
        makeTile('a2', 'attack', 5),
        makeTile('d1', 'defense', 6),
      ],
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'stalker-front',
          archetype: 'stalker' as const,
          hp: 22,
          maxHp: 22,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'spike_retaliate' as const,
          roleColor: 'crimson' as const,
        },
      ],
    },
  };
  const nonSurgePrev = previewColorResolution(stalkerRun, 'attack');
  assert.equal(nonSurgePrev.retaliateDamage, 3);
  const afterNonSurge = resolvePlayerColor(stalkerRun, 'attack');
  assert.equal(afterNonSurge.heroine.shield, 0, '1 Shield blocks 1 of the 3 Retaliate DMG');
  assert.equal(afterNonSurge.heroine.hp, 38, 'Remaining 2 Retaliate DMG hits HP');
  assert.ok(afterNonSurge.combat?.lastCues.some((c) => c.kind === 'enemy_retaliate'));

  const surgeStalkerRun = {
    ...stalkerRun,
    combat: {
      ...stalkerRun.combat,
      board: [
        makeTile('a1', 'attack', 3),
        makeTile('a2', 'attack', 3),
        makeTile('a3', 'attack', 3),
        makeTile('a4', 'attack', 3),
      ],
    },
  };
  const surgePrev = previewColorResolution(surgeStalkerRun, 'attack');
  assert.equal(surgePrev.surgeTriggered, true);
  assert.equal(surgePrev.retaliateDamage, 0, 'Stack Surge must bypass Chitin Stalker retaliation');

  // 5. Cobalt Skitter Bolster (+4 Armor to all allies, 0 hero DMG) & Pyre Stinger Charge (0 DMG windup)
  const bolsterAndChargeRun = {
    ...base,
    heroine: { ...base.heroine, hp: 50, shield: 0 },
    combat: {
      ...base.combat,
      phase: 'PLAYER_RESOLVED' as const,
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'skitter-anchor',
          archetype: 'skitter' as const,
          hp: 15,
          maxHp: 15,
          armor: 2,
          shieldPips: 1,
          maxShieldPips: 1,
          passive: 'anchor_aegis' as const,
          roleColor: 'blue' as const,
          intentCycle: [{ kind: 'bolster' as const, value: 4 }],
          currentIntentIndex: 0,
        },
        {
          ...base.combat.enemies[1],
          id: 'stinger-bomb',
          archetype: 'stinger' as const,
          hp: 16,
          maxHp: 16,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'time_bomb' as const,
          roleColor: 'orange' as const,
          intentCycle: [
            { kind: 'charge' as const, value: 16, secondaryValue: 1 },
            { kind: 'heavy' as const, value: 16 },
          ],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const threatDuringWindup = previewHeroineThreat(
    bolsterAndChargeRun.combat,
    bolsterAndChargeRun.heroine,
    null,
  );
  assert.equal(
    threatDuringWindup.rawIncomingDamage,
    0,
    'Bolster and Charge intents must preview 0 incoming hero damage',
  );
  const afterBolster = executeSingleEnemyAction(bolsterAndChargeRun, 0);
  assert.equal(afterBolster.heroine.hp, 50);
  assert.equal(afterBolster.combat?.enemies[0].armor, 6, 'Skitter gains +4 Armor from Bolster');
  assert.equal(afterBolster.combat?.enemies[1].armor, 4, 'Ally Stinger gains +4 Armor from Bolster');
  const afterCharge = executeSingleEnemyAction(afterBolster, 1);
  assert.equal(afterCharge.heroine.hp, 50, 'Charge intent deals 0 damage on windup turn');
  assert.equal(
    afterCharge.combat?.enemies[1].currentIntentIndex,
    1,
    'Stinger advances to 16 DMG Heavy Plasma Lance for next turn',
  );

  // 6. Bile Spitter Acid Tile Jamming jams 1 board tile on unblocked Acid HP damage and clears after 1 turn
  const acidJamRun = {
    ...base,
    heroine: { ...base.heroine, hp: 40, shield: 0 },
    combat: {
      ...base.combat,
      phase: 'PLAYER_RESOLVED' as const,
      board: [
        makeTile('a1', 'attack', 6),
        makeTile('d1', 'defense', 6),
        makeTile('t1', 'tech', 0, false, { kind: 'heal', amount: 4 }),
      ],
      enemies: [
        {
          ...base.combat.enemies[0],
          id: 'spitter-1',
          archetype: 'spitter' as const,
          hp: 20,
          maxHp: 20,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'acid_jam' as const,
          roleColor: 'blue' as const,
          intentCycle: [{ kind: 'acid' as const, value: 5, secondaryValue: 2 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };
  const afterSpit = executeSingleEnemyAction(acidJamRun, 0);
  const nextTurnWithJam = advanceRoundAfterEnemies(afterSpit);
  const jammedTiles = nextTurnWithJam.combat!.board.filter((t) => t.isJammed);
  assert.equal(jammedTiles.length, 1, 'Unblocked Acid Spit from Spitter must jam 1 board tile');

  // Resolving any unjammed color clears the jam on remaining tiles
  const unjammedColor =
    nextTurnWithJam.combat!.board.find((t) => !t.isJammed)?.type ?? 'defense';
  const afterResolveUnjam = resolvePlayerColor(nextTurnWithJam, unjammedColor);
  assert.equal(
    afterResolveUnjam.combat!.board.some((t) => t.isJammed),
    false,
    'Resolving a player turn must clear jammed status on held board tiles',
  );
});

test('createInitialRun supports zuri starter stats, Swarm Uplink passive, Solar Swarm Protocol Overdrive, 9-tile drone loadout, and persistence', () => {
  const zuriRun = createInitialRun(42, 'zuri');
  assert.ok(zuriRun.combat);
  assert.equal(zuriRun.heroine.characterId, 'zuri');
  assert.equal(zuriRun.heroine.hp, 62);
  assert.equal(zuriRun.heroine.maxHp, 62);
  assert.equal(zuriRun.heroine.credits, 50);
  assert.equal(zuriRun.heroine.carryCapacity, ZURI_CARRY_CAPACITY);
  assert.equal(getEquippedEquipmentWeight(zuriRun.heroine), 4);
  assert.equal(zuriRun.masterPool.length, 9);

  // Verify Zuri's 2 exclusive starter drone items + 9-tile pool (3 ATK · 3 DEF · 3 TECH)
  assert.ok(zuriRun.heroine.ownedEquipment.some((eq) => eq.defId === 'utocny_dron_sokol'));
  assert.ok(zuriRun.heroine.ownedEquipment.some((eq) => eq.defId === 'stito_dron_ankh'));
  const atkTiles = zuriRun.masterPool.filter((t) => t.type === 'attack');
  const defTiles = zuriRun.masterPool.filter((t) => t.type === 'defense');
  const techTiles = zuriRun.masterPool.filter((t) => t.type === 'tech');
  assert.equal(atkTiles.length, 3);
  assert.equal(defTiles.length, 3);
  assert.equal(techTiles.length, 3);

  // Test parseAndValidateRun with zuri
  const parsedZuri = parseAndValidateRun(JSON.stringify(zuriRun));
  assert.ok(parsedZuri);
  assert.equal(parsedZuri.heroine.characterId, 'zuri');

  // Test Swarm Uplink passive: 0 held bonus, 0 DEF Riposte, +25% OD per TECH tile, 0 Shield retain cap
  const zuriBoard = {
    ...zuriRun,
    combat: {
      ...zuriRun.combat,
      board: [
        makeTile('za1', 'attack', 6, true),
        makeTile('zd1', 'defense', 7, true),
        makeTile('zd2', 'defense', 7, false),
        makeTile('zt1', 'tech', 0, false, { kind: 'damage_boost', percent: 45, decayPerTurn: 10 }),
        makeTile('zt2', 'tech', 0, false, { kind: 'heal', amount: 3 }),
      ],
      enemies: [
        {
          ...zuriRun.combat.enemies[0],
          hp: 25,
          armor: 0,
          intentCycle: [{ kind: 'attack' as const, value: 6 }],
          currentIntentIndex: 0,
        },
      ],
    },
  };

  const zuriAtkPrev = previewColorResolution(zuriBoard, 'attack');
  assert.equal(zuriAtkPrev.totalDamage, 6); // 0 held bonus

  const zuriTechPrev = previewColorResolution(zuriBoard, 'tech');
  assert.equal(zuriTechPrev.overdriveGained, 50); // 2 * 25% OD per TECH tile

  const zuriDefPrev = previewColorResolution(zuriBoard, 'defense');
  assert.equal(zuriDefPrev.shieldGained, 14); // 7 + 7 = 14 (0 held bonus)
  assert.equal(zuriDefPrev.reflectOnBlock, 0); // 0 Riposte DMG

  const afterZuriDef = resolvePlayerColor(zuriBoard, 'defense');
  assert.equal(afterZuriDef.combat?.enemies[0].hp, 25); // no passive riposte
  const afterZuriRound = executeEnemyTurn(afterZuriDef);
  // 14 shield - 6 incoming = 8 remaining -> resets to 0 shield (0 retain cap)
  assert.equal(afterZuriRound.heroine.shield, 0);

  // Test Zuri Solar Swarm Protocol Overdrive: 16 piercing DMG, -12 Armor All, +8 Shield, 0% DMG Boost, -2 Corrode
  const zuriOdState = {
    ...zuriRun,
    heroine: {
      ...zuriRun.heroine,
      overdrive: 100,
      shield: 2,
      damageBoostPct: 10,
      corrode: 3,
    },
    combat: {
      ...zuriRun.combat,
      enemies: [
        {
          ...zuriRun.combat.enemies[0],
          hp: 30,
          armor: 15,
          shieldPips: 0,
        },
      ],
    },
  };
  const afterZuriOd = executeOverdrive(zuriOdState);
  assert.equal(afterZuriOd.heroine.overdrive, 0);
  assert.equal(afterZuriOd.heroine.shield, 10); // 2 + 8
  assert.equal(afterZuriOd.heroine.damageBoostPct, 10); // +0% boost
  assert.equal(afterZuriOd.heroine.corrode, 1); // 3 - 2
  assert.equal(afterZuriOd.combat?.enemies[0].hp, 14); // 30 - 16 piercing
  assert.equal(afterZuriOd.combat?.enemies[0].armor, 3); // 15 - 12 armor shred
});

test('Slay the Spire / FTL style Encounter Node Map: EVENT nodes, Boss Telegraph, Multi-hop pathing, Bounty modifiers, and Nanite banking', () => {
  // 1. Map generation with EVENT nodes (variants 3, 4, 5) and Hot-Spot modifiers
  const mapWithEvents = generateSectorMap(105);
  assert.equal(mapWithEvents.length, 11);
  const eventNodes = mapWithEvents.filter((n) => n.type === 'EVENT');
  assert.ok(eventNodes.length > 0, 'Seed 105 map should contain at least 1 EVENT node');

  const modifiedNodes = mapWithEvents.filter((n) => Boolean(n.modifier));
  assert.ok(modifiedNodes.length > 0, 'Map should generate hot-spot bounty or nanite modifiers');

  // 2. Boss Telegraph specifications (synced to ENEMY_TEMPLATES.boss)
  assert.equal(SECTOR_BOSS_TELEGRAPH.hp, ENEMY_TEMPLATES.boss.maxHp);
  assert.equal(SECTOR_BOSS_TELEGRAPH.gimmicks.length, 3);
  const gimmickIds = SECTOR_BOSS_TELEGRAPH.gimmicks.map((g) => g.id);
  assert.ok(gimmickIds.includes('phase_lock'));
  assert.ok(gimmickIds.includes('acid_jam'));
  assert.ok(gimmickIds.includes('swarm_call'));

  // 3. Multi-hop path calculation
  const pathFromRootToBoss = getConnectingPathNodeIds(mapWithEvents, 'n_0_0', 'n_4_0');
  assert.ok(pathFromRootToBoss.has('n_0_0'));
  assert.ok(pathFromRootToBoss.has('n_4_0'));
  assert.ok(pathFromRootToBoss.size >= 5, 'Path must span at least 5 layer nodes to boss');

  // 4. Mystery EVENT encounter flow & resolveCyberEventChoice
  const targetEventNode = eventNodes[0];
  const initialRun = createInitialRun(105);
  const eventRun = startNodeEncounter(initialRun, targetEventNode.id);
  assert.equal(eventRun.screen, 'event');
  assert.ok(eventRun.activeEvent);
  assert.ok(eventRun.activeEvent.choices.length >= 2);

  // Test executing choice 0
  const choice0 = eventRun.activeEvent.choices[0];
  const beforeCr = eventRun.heroine.credits;
  const beforeNanites = eventRun.heroine.nanites ?? 0;
  const afterChoice = resolveCyberEventChoice(eventRun, 0);
  assert.equal(afterChoice.screen, 'map');
  assert.equal(afterChoice.activeEvent, null);
  assert.equal(
    afterChoice.heroine.credits,
    beforeCr - (choice0.costCredits ?? 0) + (choice0.rewardCredits ?? 0),
  );
  assert.equal(
    afterChoice.heroine.nanites ?? 0,
    beforeNanites + (choice0.rewardNanites ?? 0),
  );
  const clearedNode = afterChoice.mapNodes.find((n) => n.id === targetEventNode.id);
  assert.equal(clearedNode?.cleared, true);

  // 5. Bounty Multipliers & Nanite Drops
  const bountyRun = createInitialRun(103);
  const eliteNode = bountyRun.mapNodes.find((n) => n.type === 'ELITE');
  assert.ok(eliteNode);
  eliteNode.modifier = 'nanite_cache';

  const startedElite = startNodeEncounter(bountyRun, eliteNode.id);
  assert.equal(startedElite.screen, 'combat');
  // Elite victory loot drops nanites: 2 base + 2 from nanite_cache = +4
  const victoryEliteRun = {
    ...startedElite,
    heroine: { ...startedElite.heroine, nanites: 1 },
    combat: {
      ...startedElite.combat!,
      phase: 'VICTORY' as const,
    },
  };
  const afterEliteLoot = claimCombatEquipmentReward(victoryEliteRun, null);
  assert.equal(afterEliteLoot.heroine.nanites, 5); // 1 + 2 (elite) + 2 (cache)

  // Double credits modifier
  const combatNode = bountyRun.mapNodes.find((n) => n.layer === 1 && n.type === 'COMBAT');
  assert.ok(combatNode);
  combatNode.modifier = 'double_credits';
  const startedDoubleCr = startNodeEncounter(bountyRun, combatNode.id);
  assert.equal(startedDoubleCr.combat?.rewardCredits, 70); // 35 * 2

  // 6. Bio-Med Bay Strategic Opportunities: Capped Neural Overclock
  const medbayNode = bountyRun.mapNodes.find((n) => n.type === 'MED_BAY') ?? {
    id: 'n_3_0',
    layer: 3,
    lane: 0,
    type: 'MED_BAY' as const,
    nextIds: ['n_4_0'],
    cleared: false,
  };
  const medbayRun = startNodeEncounter(bountyRun, medbayNode.id);
  assert.equal(medbayRun.screen, 'medbay');

  // Test Neural Tile Overclock: +1 ATK per stack (max 2) to first 2 attack tiles, cleanses corrode, +20% Overdrive
  const corrodedState = {
    ...medbayRun,
    heroine: { ...medbayRun.heroine, corrode: 4, overdrive: 20 },
  };
  const baseFirstAtk = corrodedState.masterPool.find((t) => t.type === 'attack')!.value;
  const afterOverclock = applyMedBayAction(corrodedState, 'tile_overclock');
  assert.equal(afterOverclock.screen, 'map');
  assert.equal(afterOverclock.heroine.corrode, 0);
  assert.equal(afterOverclock.heroine.overdrive, 40); // 20 + 20
  assert.equal(afterOverclock.heroine.overclockCount, 1);
  const upgradedAttackTile = afterOverclock.masterPool.find((t) => t.type === 'attack');
  assert.equal(upgradedAttackTile?.value, baseFirstAtk + 1);

  // Second stack reaches MAX_OVERCLOCK_STACKS = 2, third attempt is a no-op
  const afterSecondOverclock = applyMedBayAction(
    { ...afterOverclock, currentNodeId: medbayNode.id, screen: 'medbay' },
    'tile_overclock',
  );
  assert.equal(afterSecondOverclock.heroine.overclockCount, 2);
  assert.equal(
    afterSecondOverclock.masterPool.find((t) => t.id === upgradedAttackTile?.id)?.value,
    baseFirstAtk + 2,
  );
  const afterThirdOverclock = applyMedBayAction(
    { ...afterSecondOverclock, currentNodeId: medbayNode.id, screen: 'medbay' },
    'tile_overclock',
  );
  assert.equal(afterThirdOverclock.heroine.overclockCount, 2);
  assert.equal(afterThirdOverclock.screen, 'medbay');

  // Overclock persists across unequip/equip rebuildMasterPool
  const eqId = afterOverclock.heroine.equippedInstanceIds[0];
  const afterUnequipOverclock = unequipEquipmentInstance(afterOverclock, eqId);
  const afterReequipOverclock = equipEquipmentInstance(afterUnequipOverclock, eqId);
  const atkTileAfterReequip = afterReequipOverclock.masterPool.find((t) => t.id === upgradedAttackTile!.id);
  assert.equal(atkTileAfterReequip?.value, upgradedAttackTile!.value);

  // Localized Cyber Event accuracy (ai_siphon matches +8 HP / +10% OD in EN & CS)
  const aiEvent = CYBER_EVENT_TEMPLATES.find((ev) => ev.id === 'rogue_ai_cache');
  assert.ok(aiEvent);
  const aiSiphonEn = localizeCyberEvent(aiEvent, 'en').choices.find((c) => c.id === 'ai_siphon');
  const aiSiphonCs = localizeCyberEvent(aiEvent, 'cs').choices.find((c) => c.id === 'ai_siphon');
  assert.ok(aiSiphonEn && aiSiphonEn.description.includes('+8 HP') && !aiSiphonEn.description.includes('Shield'));
  assert.ok(aiSiphonCs && aiSiphonCs.description.includes('+8 HP'));

  // 7. Nanite Banking Persistence
  const rec1 = recordRunCompletion(500, true, 8);
  assert.ok((rec1.totalNanites ?? 0) >= 8);
  const loaded = loadBestRecord();
  assert.equal(loaded.totalNanites, rec1.totalNanites);
});

test('27. HP as Currency Node Economy, Dynamic Micro-Clusters, Flash Sales, Funded Clinics, Defibrillator, and Mercenary Interest', () => {
  const run = createInitialRun(300);

  // 1. Validate getNodeEconomyMetrics
  const combatNode: MapNode = {
    id: 'c1',
    layer: 1,
    lane: 0,
    type: 'COMBAT',
    nextIds: [],
    cleared: false,
  };
  const standardCombatEcon = getNodeEconomyMetrics(combatNode, run.heroine);
  assert.equal(standardCombatEcon.tensionHpPct, 12);
  assert.equal(standardCombatEcon.runYieldCredits, 35);
  assert.equal(standardCombatEcon.metaYieldNanites, 0);

  const overchargedNode: MapNode = { ...combatNode, modifier: 'overcharged_hazard' };
  const ocEcon = getNodeEconomyMetrics(overchargedNode, run.heroine);
  assert.equal(ocEcon.tensionHpPct, 18);
  assert.equal(ocEcon.runYieldCredits, 35);
  assert.equal(ocEcon.metaYieldNanites, 1);

  const eliteNode: MapNode = {
    id: 'e1',
    layer: 2,
    lane: 0,
    type: 'ELITE',
    nextIds: [],
    cleared: false,
  };
  const eliteEcon = getNodeEconomyMetrics(eliteNode, run.heroine);
  assert.equal(eliteEcon.tensionHpPct, 38);
  assert.equal(eliteEcon.runYieldCredits, 60);
  assert.equal(eliteEcon.metaYieldNanites, 2);

  const medBayNode: MapNode = {
    id: 'm1',
    layer: 3,
    lane: 1,
    type: 'MED_BAY',
    nextIds: [],
    cleared: false,
  };
  const medBayEcon = getNodeEconomyMetrics(medBayNode, run.heroine);
  assert.equal(medBayEcon.tensionHpPct, -35); // negative tension = healing

  const clinicNode: MapNode = {
    id: 's1',
    layer: 2,
    lane: 1,
    type: 'CHIP_DEALER',
    modifier: 'flash_sale',
    nextIds: [],
    cleared: false,
  };
  const clinicEcon = getNodeEconomyMetrics(clinicNode, run.heroine);
  assert.equal(clinicEcon.tensionHpPct, 0);
  assert.equal(clinicEcon.runYieldPowerRating, 'CRITICAL');

  // 2. Validate Lane Cluster Profiles
  const profiles = getLaneClusterProfiles(run.mapNodes, run.heroine);
  assert.equal(profiles.length, 3);
  for (const prof of profiles) {
    assert.ok(prof.totalTensionHpEst >= 0);
    assert.ok(prof.totalRunYieldCredits >= 0);
    assert.ok(['gauntlet', 'mercenary', 'gambler'].includes(prof.archetype));
  }

  // 3. Dynamic Modifiers in Non-Legacy Seed Generation vs Legacy Seeds
  const nonLegacyMap = generateSectorMap(200);
  const hasOvercharged = nonLegacyMap.some((n) => n.modifier === 'overcharged_hazard');
  const hasFlashSale = nonLegacyMap.some((n) => n.modifier === 'flash_sale');
  const hasFundedClinic = nonLegacyMap.some((n) => n.modifier === 'funded_clinic');
  assert.ok(hasOvercharged, 'non-legacy map should spawn overcharged hazard');
  assert.ok(hasFlashSale, 'non-legacy map should spawn flash sale');
  assert.ok(hasFundedClinic, 'non-legacy map should spawn funded clinic');

  const legacyMap = generateSectorMap(100);
  assert.ok(!legacyMap.some((n) => n.modifier === 'overcharged_hazard'));
  assert.ok(!legacyMap.some((n) => n.modifier === 'flash_sale'));
  assert.ok(!legacyMap.some((n) => n.modifier === 'funded_clinic'));

  // 4. Overcharged Hazard Combat Scaling & Reward (+25% stats & +1 Nanite)
  const ocEnemies = buildEnemiesForNode('COMBAT', 1, 200, 0, 'overcharged_hazard');
  const normEnemies = buildEnemiesForNode('COMBAT', 1, 200, 0);
  assert.ok(ocEnemies[0].maxHp > normEnemies[0].maxHp);
  assert.ok(ocEnemies[0].armor > normEnemies[0].armor);

  const ocCombatRun = {
    ...run,
    currentNodeId: 'n_1_0',
    mapNodes: [
      ...run.mapNodes.filter((n) => n.id !== 'n_1_0'),
      { ...run.mapNodes.find((n) => n.id === 'n_1_0')!, modifier: 'overcharged_hazard' as const },
    ],
    combat: {
      ...run.combat!,
      nodeId: 'n_1_0',
      nodeType: 'COMBAT' as const,
      phase: 'VICTORY' as const,
      rewardCredits: 35,
    },
    heroine: {
      ...run.heroine,
      nanites: 0,
      consecutiveCombatWithoutClinic: 0,
    },
  };
  const afterOcVictory = claimCombatEquipmentReward(ocCombatRun, null);
  assert.equal(afterOcVictory.heroine.nanites, 1, 'Overcharged combat victory awards +1 Nanite');
  assert.equal(
    afterOcVictory.heroine.consecutiveCombatWithoutClinic,
    1,
    'increments combat streak without clinic',
  );

  // 5. Flash Sale Shop 35% Discount in buyClinicEquipment
  const shopRun: RunState = {
    ...run,
    screen: 'clinic',
    currentNodeId: 'n_2_1',
    mapNodes: [
      ...run.mapNodes.filter((n) => n.id !== 'n_2_1'),
      {
        id: 'n_2_1',
        layer: 2,
        lane: 1,
        type: 'CYBER_CLINIC',
        modifier: 'flash_sale',
        nextIds: [],
        cleared: false,
      },
    ],
    heroine: {
      ...run.heroine,
      credits: 30, // Normal price of karabin_vx is 45 (unaffordable), discounted is 29 (affordable!)
      ownedEquipment: run.heroine.ownedEquipment.filter((e) => e.defId !== 'karabin_vx'),
    },
    clinicShopChoices: ['karabin_vx'],
  };
  const afterFlashBuy = buyClinicEquipment(shopRun, 'karabin_vx');
  assert.ok(afterFlashBuy.heroine.ownedEquipment.some((e) => e.defId === 'karabin_vx'));
  assert.equal(afterFlashBuy.heroine.credits, 30 - 29); // 30 - 29 = 1

  // 6. Funded Clinic Bonus Repair in applyMedBayAction (+12 HP)
  const fundedRun: RunState = {
    ...run,
    screen: 'medbay',
    currentNodeId: 'n_3_1',
    mapNodes: [
      ...run.mapNodes.filter((n) => n.id !== 'n_3_1'),
      {
        id: 'n_3_1',
        layer: 3,
        lane: 1,
        type: 'MED_BAY',
        modifier: 'funded_clinic',
        nextIds: [],
        cleared: false,
      },
    ],
    heroine: {
      ...run.heroine,
      hp: 10,
      maxHp: 58,
      consecutiveCombatWithoutClinic: 3,
    },
  };
  const afterFundedRepair = applyMedBayAction(fundedRun, 'heal');
  assert.equal(afterFundedRepair.heroine.hp, 10 + 22 + 12); // 44 HP (22 base + 12 funded bonus)
  assert.equal(
    afterFundedRepair.heroine.consecutiveCombatWithoutClinic,
    0,
    'visiting clinic resets consecutive combat streak',
  );

  // 7. Safety Net: Emergency Defibrillator (+15% HP when surviving Elite with <=15% HP)
  const lowHpEliteRun: RunState = {
    ...run,
    currentNodeId: 'n_2_0',
    mapNodes: [
      ...run.mapNodes.filter((n) => n.id !== 'n_2_0'),
      {
        id: 'n_2_0',
        layer: 2,
        lane: 0,
        type: 'ELITE',
        nextIds: [],
        cleared: false,
      },
    ],
    combat: {
      ...run.combat!,
      nodeId: 'n_2_0',
      nodeType: 'ELITE' as const,
      phase: 'VICTORY' as const,
      rewardCredits: 60,
    },
    heroine: {
      ...run.heroine,
      hp: 5, // <= 15% of 58 (8.7)
      maxHp: 58,
      emergencyDefibUsed: false,
      consecutiveCombatWithoutClinic: 1,
    },
  };
  const afterDefibVictory = claimCombatEquipmentReward(lowHpEliteRun, null);
  assert.equal(afterDefibVictory.heroine.emergencyDefibUsed, true);
  assert.equal(afterDefibVictory.heroine.hp, 5 + Math.round(58 * 0.15)); // 5 + 9 = 14

  // 8. Mercenary Interest Streak (+10% credits per battle without clinic)
  const streakRun: RunState = {
    ...run,
    currentNodeId: 'n_1_1',
    combat: {
      ...run.combat!,
      nodeId: 'n_1_1',
      nodeType: 'COMBAT' as const,
      phase: 'VICTORY' as const,
      rewardCredits: 50,
    },
    heroine: {
      ...run.heroine,
      credits: 0,
      consecutiveCombatWithoutClinic: 3, // 30% streak bonus: 50 * 1.30 = 65
    },
  };
  const afterStreakVictory = claimCombatEquipmentReward(streakRun, null);
  assert.equal(afterStreakVictory.heroine.credits, 80); // 50 combat + 15 salvage + 15 streak bonus
  assert.equal(afterStreakVictory.heroine.consecutiveCombatWithoutClinic, 4);
});

test('28. Regression audit fixes: single-use Defibrillator, accurate Overcharged/Support Intel, non-inverted Med-Bay lane risk, distinct lane archetypes, Recon implants, and Funded Clinic calibrate_max_hp', () => {
  // 1. Initial run initializes emergencyDefibUsed to false
  const fresh = createInitialRun(205);
  assert.equal(fresh.heroine.emergencyDefibUsed, false);

  // 2. Single-use Defibrillator does NOT trigger again if emergencyDefibUsed is already true
  const eliteNode = fresh.mapNodes.find((n) => n.type === 'ELITE') ?? {
    id: 'n_2_0',
    layer: 2,
    lane: 0,
    type: 'ELITE' as const,
    nextIds: [],
    cleared: false,
  };
  const alreadyUsedDefibRun: RunState = {
    ...fresh,
    currentNodeId: eliteNode.id,
    combat: {
      ...fresh.combat!,
      nodeId: eliteNode.id,
      nodeType: 'ELITE',
      phase: 'VICTORY',
      rewardCredits: 60,
    },
    heroine: {
      ...fresh.heroine,
      hp: 4,
      maxHp: 58,
      emergencyDefibUsed: true,
    },
  };
  const afterSecondElite = claimCombatEquipmentReward(alreadyUsedDefibRun, null);
  assert.equal(afterSecondElite.heroine.hp, 4, 'Discharged defib must not heal a second time');
  assert.equal(afterSecondElite.heroine.emergencyDefibUsed, true);

  // 3. getNodeEncounterIntel matches startNodeEncounter on overcharged_hazard & populates flash_sale/funded_clinic traits
  for (const seed of [200, 201, 202, 203, 204, 205]) {
    const run = createInitialRun(seed);
    for (const node of run.mapNodes) {
      const intel = getNodeEncounterIntel(node, seed);
      const started = startNodeEncounter(run, node.id);
      if (
        node.type === 'CYBER_CLINIC' ||
        node.type === 'CHIP_DEALER' ||
        node.type === 'MED_BAY' ||
        node.type === 'EVENT'
      ) {
        assert.equal(intel.enemies.length, 0);
        if (node.modifier === 'flash_sale') {
          assert.ok(
            intel.threatTraits?.some((tr) => tr.includes('Flash Sale') && tr.includes('Chip')),
            'Flash sale trait should be populated and accurate',
          );
        }
        if (node.modifier === 'funded_clinic') {
          assert.ok(
            intel.threatTraits?.some((tr) => tr.includes('Funded Clinic')),
            'Funded clinic trait should be populated',
          );
        }
      } else {
        assert.ok(started.combat);
        assert.deepEqual(
          intel.enemies,
          started.combat.enemies.map((e) => ({
            archetype: e.archetype,
            hp: e.maxHp,
            armor: e.armor,
          })),
          `Intel must match spawned combat enemies for seed ${seed} node ${node.id} (${node.modifier ?? 'none'})`,
        );
      }
    }

    // 4. All 6 map variants produce valid graphs (reachable boss, no consecutive same-type support, L1 clinic -> combat/elite)
    //    AND all 3 lane archetypes (gauntlet, mercenary, gambler) appear distinctly
    const rootReachable = getReachableNodeIds(run.mapNodes, 'n_0_0');
    assert.equal(rootReachable.size, 11);
    const byId = new Map(run.mapNodes.map((n) => [n.id, n]));
    for (const node of run.mapNodes) {
      assert.ok(getReachableNodeIds(run.mapNodes, node.id).has('n_4_0'));
      const isSupport =
        node.type === 'CYBER_CLINIC' || node.type === 'CHIP_DEALER' || node.type === 'MED_BAY';
      for (const nextId of node.nextIds) {
        const nextNode = byId.get(nextId)!;
        if (isSupport) {
          assert.notEqual(nextNode.type, node.type);
        }
        if (node.layer === 1 && node.type === 'CYBER_CLINIC') {
          assert.ok(nextNode.type === 'COMBAT' || nextNode.type === 'ELITE');
        }
      }
    }

    const profiles = getLaneClusterProfiles(run.mapNodes, run.heroine);
    const archetypes = new Set(profiles.map((p) => p.archetype));
    assert.equal(
      archetypes.size,
      3,
      `Seed ${seed} must exhibit all 3 distinct lane archetypes`,
    );
  }

  // 5. Med-Bay negative tension does NOT add to lane totalTensionHpEst
  const syntheticMedLane: MapNode[] = [
    { id: 'n_1_0', layer: 1, lane: 0, type: 'COMBAT', nextIds: ['n_2_0'], cleared: false },
    { id: 'n_2_0', layer: 2, lane: 0, type: 'MED_BAY', nextIds: ['n_3_0'], cleared: false },
    { id: 'n_3_0', layer: 3, lane: 0, type: 'MED_BAY', nextIds: [], cleared: false },
  ];
  const syntheticProfiles = getLaneClusterProfiles(syntheticMedLane, fresh.heroine);
  const combatOnlyTension = getNodeEconomyMetrics(syntheticMedLane[0], fresh.heroine).tensionHpEst;
  assert.equal(
    syntheticProfiles[0].totalTensionHpEst,
    combatOnlyTension,
    'Med-Bays must never inflate combat HP risk',
  );

  // 6. Recon implant preview uses heroine.implants (not ownedEquipment) and reveals EVENT details
  const seedWithEvent = createInitialRun(203);
  const eventNode = seedWithEvent.mapNodes.find((n) => n.type === 'EVENT');
  assert.ok(eventNode);
  assert.equal(getReconPreviewForNode(eventNode, seedWithEvent), null);

  const runWithRecon: RunState = {
    ...seedWithEvent,
    heroine: {
      ...seedWithEvent.heroine,
      implants: ['synapse_overclock'],
    },
  };
  const eventRecon = getReconPreviewForNode(eventNode, runWithRecon);
  assert.ok(eventRecon && eventRecon.kind === 'event');
  assert.ok(eventRecon.eventTitle.length > 0);
  assert.ok(eventRecon.choices.length >= 2);

  // 7. Funded Clinic +12 HP bonus on calibrate_max_hp applies against the raised maxHp (58 -> 68)
  const fundedCalibrateRun: RunState = {
    ...fresh,
    screen: 'medbay',
    currentNodeId: 'n_3_0',
    mapNodes: [
      ...fresh.mapNodes.filter((n) => n.id !== 'n_3_0'),
      { id: 'n_3_0', layer: 3, lane: 0, type: 'MED_BAY', modifier: 'funded_clinic', nextIds: [], cleared: false },
    ],
    heroine: {
      ...fresh.heroine,
      hp: 46,
      maxHp: 58,
    },
  };
  const afterFundedCalibrate = applyMedBayAction(fundedCalibrateRun, 'calibrate_max_hp');
  assert.equal(afterFundedCalibrate.heroine.maxHp, 68);
  assert.equal(afterFundedCalibrate.heroine.hp, 68); // 46 + 10 calibrate + 12 funded = 68 (would have been 66 if capped at 58 first)
});

test('29. Duds + Implant salvage, UpCharge Chips capped at 9 board tiles, Hero Armor blocks Acid Jam, and Cyber-Clinic 30 CR Tile Purge', () => {
  const auraline = createInitialRun(505, 'aurelia');
  assert.ok(auraline.combat);

  // 1. Flat Implant (plasma_amp +2 ATK, synapse_overclock +3 SHD) can salvage 0-value Duds
  const dudSalvageRun: RunState = {
    ...auraline,
    heroine: {
      ...auraline.heroine,
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

  // Attack preview: Dud (0 + 2 plasma_amp = 2) + a_uc (5 + 2 = 7) + a_reg (6 + 2 = 8) = 17 DMG; UpCharge = 1 + 2 + 1 (Auraline dud) = 4
  const atkPrev = previewColorResolution(dudSalvageRun, 'attack');
  assert.equal(atkPrev.totalDamage, 17);
  assert.equal(atkPrev.upchargeGained, 4);

  // Tech Dud salvaged by synapse_overclock (+3 SHD), +15% OD, +1 UpCharge
  const techPrev = previewColorResolution(dudSalvageRun, 'tech');
  assert.equal(techPrev.shieldGained, 3);
  assert.equal(techPrev.overdriveGained, 15);
  assert.equal(techPrev.upchargeGained, 1);

  // Resolve Attack (+4 UpCharge -> capped at MAX_UPCHARGE_BOARD_CAPACITY = 9 tiles on next turn)
  // Spitter Acid 8 hits 18 Armor -> 10 Armor left, 0 HP lost -> Acid Jam & Caustic Slag are blocked!
  const afterAtk = resolvePlayerColor(dudSalvageRun, 'attack');
  assert.equal(afterAtk.heroine.pendingUpcharge, 4);
  const afterSpitterTurn = executeEnemyTurn(afterAtk);
  assert.equal(afterSpitterTurn.heroine.armor, 10);
  assert.equal(afterSpitterTurn.heroine.hp, 78);
  assert.equal(afterSpitterTurn.heroine.pendingUpcharge, 0);
  assert.equal(afterSpitterTurn.combat?.board.length, MAX_UPCHARGE_BOARD_CAPACITY);
  assert.ok(!afterSpitterTurn.combat?.board.some((t) => t.isJammed));

  // 2. Cyber-Clinic Paid Innate/Dud Tile Purge (30 CR, max 1 per visit)
  const clinicNode = auraline.mapNodes.find((n) => n.type === 'CYBER_CLINIC');
  assert.ok(clinicNode);
  const clinicRun = startNodeEncounter(
    {
      ...auraline,
      screen: 'map',
      combat: null,
      heroine: { ...auraline.heroine, credits: 70 },
    },
    clinicNode.id,
  );
  assert.equal(clinicRun.screen, 'clinic');
  const dudInnate = clinicRun.masterPool.find((t) => t.sourceId === 'innate' && t.isDud);
  assert.ok(dudInnate);

  const afterPurge = purgeClinicInnateTile(clinicRun, dudInnate.id);
  assert.equal(afterPurge.heroine.credits, 70 - CLINIC_PURGE_COST);
  assert.equal(afterPurge.masterPool.length, 8);
  assert.ok(!afterPurge.masterPool.some((t) => t.id === dudInnate.id));
  assert.equal(afterPurge.clinicPurgeUsed, true);

  // Second purge in the same clinic visit is blocked
  const secondInnate = afterPurge.masterPool.find((t) => t.sourceId === 'innate')!;
  const afterSecondPurge = purgeClinicInnateTile(afterPurge, secondInnate.id);
  assert.equal(afterSecondPurge.masterPool.length, 8);
  assert.equal(afterSecondPurge.heroine.credits, 70 - CLINIC_PURGE_COST);
});

test('30. 5-Tier Difficulty Matrix: sacred enemy HP/DMG math, par clocks, attrition recovery, Tier 1 skip, breather node, and persistence', () => {
  const tiers: DifficultyTier[] = [1, 2, 3, 4, 5];
  const runsByTier = tiers.map((tier) => createInitialRun(777, 'kira', tier));

  // 1. Verify Tier profiles and default run state
  assert.equal(runsByTier[0].difficultyTier, 1);
  assert.equal(runsByTier[2].difficultyTier, 3);
  assert.equal(runsByTier[4].difficultyTier, 5);
  assert.equal(getDifficultyProfile(1).maxCommittedUndosPerBattle, null);
  assert.equal(getDifficultyProfile(3).maxCommittedUndosPerBattle, 1);
  assert.equal(getDifficultyProfile(4).maxRunResets, 1);
  assert.equal(getDifficultyProfile(5).allowSwapUndoBeforeCommit, false);
  assert.equal(getDifficultyProfile(5).revealDropSlot, false);
  assert.equal(getDifficultyProfile(5).revealEnemyFutureCycle, false);

  // 2. Keep Unit Math Sacred: enemy HP & intent DMG per archetype stay identical across all 5 difficulty tiers
  const tier3Layer0 = runsByTier[2].combat!.enemies;
  for (const run of runsByTier) {
    assert.ok(run.combat);
    run.combat.enemies.forEach((enemy, idx) => {
      assert.equal(
        enemy.maxHp,
        tier3Layer0[idx].maxHp,
        `${enemy.archetype} Layer 0 maxHp must match Tier 3 baseline on tier ${run.difficultyTier}`,
      );
      assert.equal(
        enemy.intentCycle[0].value,
        ENEMY_TEMPLATES[enemy.archetype].intentCycle[0].value,
        `${enemy.archetype} intent DMG must stay sacred on tier ${run.difficultyTier}`,
      );
    });
    const l1Enemies = buildEnemiesForNode('COMBAT', 1, 777, 0, undefined, run.difficultyTier, false);
    for (const enemy of l1Enemies) {
      assert.equal(
        enemy.maxHp,
        ENEMY_TEMPLATES[enemy.archetype].maxHp,
        `${enemy.archetype} Layer 1 maxHp must equal ENEMY_TEMPLATES on tier ${run.difficultyTier}`,
      );
      assert.equal(
        enemy.intentCycle[0].value,
        ENEMY_TEMPLATES[enemy.archetype].intentCycle[0].value,
      );
    }
  }

  // 3. Par Turn Clocks & Sawtooth Breather scale spatial count without inflating unit stats
  const enemiesT1 = buildEnemiesForNode('COMBAT', 2, 777, 1, undefined, 1, false);
  const enemiesT3 = buildEnemiesForNode('COMBAT', 2, 777, 1, undefined, 3, false);
  const enemiesT5 = buildEnemiesForNode('COMBAT', 2, 777, 1, undefined, 5, false);
  const breatherT5 = buildEnemiesForNode('COMBAT', 2, 777, 1, undefined, 5, true);
  assert.ok(enemiesT1.length <= 2);
  assert.ok(enemiesT5.length >= enemiesT3.length);
  assert.equal(breatherT5.length, 2);
  const t3Layer2ByArch = new Map(enemiesT3.map((e) => [e.archetype, e.maxHp]));
  for (const e of [...enemiesT1, ...enemiesT3, ...enemiesT5]) {
    if (t3Layer2ByArch.has(e.archetype)) {
      assert.equal(e.maxHp, t3Layer2ByArch.get(e.archetype));
    }
    assert.equal(e.intentCycle[0].value, ENEMY_TEMPLATES[e.archetype].intentCycle[0].value);
  }

  const parT1 = runsByTier[0].combat!.director!.parCaches[0].maxTurn;
  const parT2 = runsByTier[1].combat!.director!.parCaches[0].maxTurn;
  const parT3 = runsByTier[2].combat!.director!.parCaches[0].maxTurn;
  const parT4 = runsByTier[3].combat!.director!.parCaches[0].maxTurn;
  const parT5 = runsByTier[4].combat!.director!.parCaches[0].maxTurn;
  assert.equal(parT1, parT3 + 3);
  assert.equal(parT2, parT3 + 2);
  assert.equal(parT4, Math.max(2, parT3 - 1));
  assert.equal(parT5, Math.max(2, parT3 - 1));

  // 4. Strategic Attrition recovery after combat victory: Tier 1 = 100%, Tier 2 = 25%, Tiers 3-5 = 0%
  const prepVictory = (run: RunState, hpStart: number): RunState => ({
    ...run,
    heroine: { ...run.heroine, hp: hpStart, maxHp: 60 },
    combat: {
      ...run.combat!,
      phase: 'VICTORY',
      rewardEquipmentChoices: [],
      rewardCredits: 20,
    },
  });
  const afterClaimT1 = claimCombatEquipmentReward(prepVictory(runsByTier[0], 20), null);
  const afterClaimT2 = claimCombatEquipmentReward(prepVictory(runsByTier[1], 20), null);
  const afterClaimT3 = claimCombatEquipmentReward(prepVictory(runsByTier[2], 20), null);
  assert.equal(afterClaimT1.heroine.hp, 60);
  assert.equal(afterClaimT2.heroine.hp, 35); // 20 + floor(60 * 0.25)
  assert.equal(afterClaimT3.heroine.hp, 20);

  // 5. Tier 1 Story Skip Encounter works on non-boss combat & refuses boss nodes
  const defeatNonBoss: RunState = {
    ...runsByTier[0],
    screen: 'gameover',
    combat: { ...runsByTier[0].combat!, nodeType: 'COMBAT' },
  };
  const skipped = skipCombatEncounter(defeatNonBoss);
  assert.equal(skipped.screen, 'map');
  assert.equal(skipped.combat, null);
  assert.equal(skipped.heroine.hp, skipped.heroine.maxHp);

  const defeatBoss: RunState = {
    ...runsByTier[0],
    screen: 'gameover',
    combat: { ...runsByTier[0].combat!, nodeType: 'BOSS' },
  };
  assert.equal(skipCombatEncounter(defeatBoss).screen, 'gameover');

  // 6. Sawtooth breather node present on generated Sector Map Layer 2 & persistence roundtrip
  assert.ok(runsByTier[2].mapNodes.some((n) => n.layer === 2 && n.isBreatherNode));
  const withReset: RunState = { ...runsByTier[3], runResetsUsed: 1 };
  const parsed = parseAndValidateRun(JSON.stringify(withReset));
  assert.ok(parsed);
  assert.equal(parsed.difficultyTier, 4);
  assert.equal(parsed.runResetsUsed, 1);
});







