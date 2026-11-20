import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIP_DEALER_RESTOCK_COST,
  CLINIC_PURGE_COST,
  DROPPABLE_SKILL_CHIP_IDS,
  HEIRLOOM_ENGRAVE_COST,
  MAX_HEIRLOOM_STACKS,
  SKILL_CHIPS_BY_ID,
} from './data';
import {
  acquireSkillChip,
  getEquippedChipMemory,
  rebuildMasterPool,
} from './poolBuilder';
import {
  CYBER_EVENT_TEMPLATES,
  DYNASTY_EVENT_TEMPLATES,
  getCyberEventForNode,
  localizeCyberEvent,
} from './cyberEvents';
import {
  adoptNannyBot,
  advanceNodeDynastyProgress,
  applyMedBayAction,
  buyChipDealerChip,
  canModifyEquipment,
  charterSuburbanEstate,
  claimCombatChipReward,
  createInitialRun,
  engraveHeirloom,
  enrollCharterProdigyTile,
  equipSkillChipInstance,
  incubateStorkTile,
  installCyberImplant,
  marryBloodlineCrest,
  previewColorResolution,
  purgeClinicInnateTile,
  rerouteMeshNetNode,
  resolvePlayerColor,
  restockChipDealer,
  rideMagLevExpress,
  scrapSkillChipInstance,
  skipChipDealer,
  skipCombatEncounter,
  startBetaTrialChip,
  startNodeEncounter,
  unequipSkillChipInstance,
} from './gameEngine';
import type { MapNode, RunState } from './types';

test('AI Skill Chip equip/unequip updates masterPool, enforces Memory 12, and scrap + re-buy keeps instanceIds unique', () => {
  const combatRun = createInitialRun(250);
  assert.equal(canModifyEquipment(combatRun), false);
  const attemptedUnequip = unequipSkillChipInstance(combatRun, 'chip_start_predictive_aim');
  assert.equal(attemptedUnequip.masterPool.length, 9);

  const mapRun = claimCombatChipReward(
    { ...combatRun, combat: { ...combatRun.combat!, phase: 'VICTORY' } },
    null,
  );
  assert.equal(mapRun.screen, 'map');
  assert.equal(getEquippedChipMemory(mapRun.hero), 3);

  const afterUnequip = unequipSkillChipInstance(mapRun, 'chip_start_predictive_aim');
  assert.equal(getEquippedChipMemory(afterUnequip.hero), 1);
  assert.equal(afterUnequip.masterPool.length, 6);

  const afterReequip = equipSkillChipInstance(afterUnequip, 'chip_start_predictive_aim');
  assert.equal(getEquippedChipMemory(afterReequip.hero), 3);
  assert.equal(afterReequip.masterPool.length, 9);

  // Memory overflow blocks heavy chip
  let heavyRun: RunState = {
    ...afterReequip,
    hero: {
      ...afterReequip.hero,
      ownedChips: [
        ...afterReequip.hero.ownedChips,
        { instanceId: 'chip_heavy_1', defId: 'apex_overwhelm' }, // 5
        { instanceId: 'chip_heavy_2', defId: 'volley_matrix' }, // 4 -> 3+5+4 = 12
        { instanceId: 'chip_heavy_3', defId: 'zero_trust_wall' }, // 3 -> 15 > 12
      ],
    },
  };
  heavyRun = equipSkillChipInstance(heavyRun, 'chip_heavy_1');
  heavyRun = equipSkillChipInstance(heavyRun, 'chip_heavy_2');
  assert.equal(getEquippedChipMemory(heavyRun.hero), 12);
  const blocked = equipSkillChipInstance(heavyRun, 'chip_heavy_3');
  assert.ok(!blocked.hero.equippedInstanceIds.includes('chip_heavy_3'));

  // Regression: acquire -> unequip -> scrap -> acquire again must never collide instanceIds
  const bought1 = acquireSkillChip(afterUnequip, 'surgical_cut', false);
  assert.ok(bought1.instanceId);
  const scrapped = scrapSkillChipInstance(bought1.run, bought1.instanceId);
  const bought2 = acquireSkillChip(scrapped, 'surgical_cut', false);
  assert.ok(bought2.instanceId);
  assert.notEqual(bought1.instanceId, bought2.instanceId);
});

test('13 droppable AI Skill Chips, Chip Vault scrapping, Chip Dealer restock, Cyber-Clinic, and Med-Bay screen guard', () => {
  assert.equal(DROPPABLE_SKILL_CHIP_IDS.length, 13);
  for (const id of [
    'surgical_cut',
    'system_scrub',
    'armor_crack',
    'flux_rebalance',
    'adaptive_guard',
    'tempo_feed',
    'synapse_loop',
    'hyper_thread',
  ]) {
    assert.ok(SKILL_CHIPS_BY_ID[id], `Expected ${id} in SKILL_CHIPS_BY_ID`);
    assert.equal(SKILL_CHIPS_BY_ID[id].droppable, true);
  }

  let run = createInitialRun(808);
  const offeredLoot = run.combat!.rewardChipChoices[0];
  const afterLoot = claimCombatChipReward(
    { ...run, combat: { ...run.combat!, phase: 'VICTORY' } },
    offeredLoot,
  );
  assert.equal(afterLoot.screen, 'map');
  assert.ok(afterLoot.hero.ownedChips.some((eq) => eq.defId === offeredLoot));

  // Med-Bay action while NOT on 'medbay' screen is a no-op (Regression!)
  const blockedMed = applyMedBayAction(afterLoot, 'heal');
  assert.equal(blockedMed.hero.hp, afterLoot.hero.hp);
  assert.equal(blockedMed.screen, 'map');

  // Chip Dealer buy & restock
  const dealerNode = afterLoot.mapNodes.find((n) => n.type === 'CHIP_DEALER')!;
  let dealerRun = startNodeEncounter(
    { ...afterLoot, hero: { ...afterLoot.hero, credits: 150, hp: 30 } },
    dealerNode.id,
  );
  assert.equal(dealerRun.screen, 'chip_dealer');
  const buyId = dealerRun.chipDealerChoices[0];
  dealerRun = buyChipDealerChip(dealerRun, buyId);
  assert.ok(dealerRun.hero.ownedChips.some((c) => c.defId === buyId));
  const beforeRestock = dealerRun.chipDealerChoices.slice();
  const restocked = restockChipDealer(dealerRun);
  assert.ok(restocked.chipDealerChoices.every((id) => !beforeRestock.includes(id)));
  assert.equal(restocked.hero.credits, dealerRun.hero.credits - CHIP_DEALER_RESTOCK_COST);
  const afterDealer = skipChipDealer(restocked);

  // Cyber-Clinic implant replacement + 30 CR innate purge
  const auraline = createInitialRun(505, 'auraline');
  const clinicNode = auraline.mapNodes.find((n) => n.type === 'CYBER_CLINIC')!;
  const clinicRun = startNodeEncounter(
    {
      ...auraline,
      screen: 'map',
      combat: null,
      hero: {
        ...auraline.hero,
        credits: 70,
        implants: ['monowire_edge', 'plasma_amp', 'nano_weave', 'bio_siphon'],
      },
    },
    clinicNode.id,
  );
  const dudInnate = clinicRun.masterPool.find((t) => t.sourceId === 'innate' && t.isDud)!;
  const afterPurge = purgeClinicInnateTile(clinicRun, dudInnate.id);
  assert.equal(afterPurge.hero.credits, 70 - CLINIC_PURGE_COST);
  assert.equal(afterPurge.clinicPurgeUsed, true);
  assert.equal(
    purgeClinicInnateTile(afterPurge, afterPurge.masterPool[0].id).masterPool.length,
    8,
  );
  const afterClinic = installCyberImplant(afterPurge, 'surge_resonator', 'nano_weave');
  assert.ok(afterClinic.hero.implants.includes('surge_resonator'));

  // Bio-Med Bay heal / calibrate / salvage when screen === 'medbay'
  const medbayNode = afterDealer.mapNodes.find((n) => n.type === 'MED_BAY')!;
  const fundedBonus = medbayNode.modifier === 'funded_clinic' ? 12 : 0;
  const medRun = startNodeEncounter({ ...afterDealer, hero: { ...afterDealer.hero, hp: 20 } }, medbayNode.id);
  assert.equal(medRun.screen, 'medbay');
  const afterHeal = applyMedBayAction(medRun, 'heal');
  assert.equal(afterHeal.hero.hp, Math.min(medRun.hero.maxHp, 20 + 22 + fundedBonus));
  const afterCal = applyMedBayAction({ ...afterHeal, screen: 'medbay', currentNodeId: medbayNode.id }, 'calibrate_max_hp');
  assert.equal(afterCal.hero.maxHp, 68);
});

test('Heirloom Forge enforces 25 CR cost, once-per-visit, ownership check, cap 6, and no combat victory halving', () => {
  const base = createInitialRun(204000, 'kira');
  const mapRun = claimCombatChipReward(
    { ...base, combat: { ...base.combat!, phase: 'VICTORY' } },
    null,
  );
  const dealerNode = mapRun.mapNodes.find((n) => n.type === 'CHIP_DEALER')!;
  const dealerRun = startNodeEncounter(
    { ...mapRun, hero: { ...mapRun.hero, credits: 100 } },
    dealerNode.id,
  );
  const ownedDefId = dealerRun.hero.ownedChips[0].defId;

  // Rejects unowned chip ID
  const unownedAttempt = engraveHeirloom(dealerRun, 'apex_overwhelm');
  assert.equal(unownedAttempt.hero.credits, 100);
  assert.equal(unownedAttempt.hero.heirloomEngravedId, null);

  // Costs 25 CR and locks for this visit
  const engraved = engraveHeirloom(dealerRun, ownedDefId);
  assert.equal(engraved.hero.heirloomEngravedId, ownedDefId);
  assert.equal(engraved.hero.heirloomStacks, 1);
  assert.equal(engraved.hero.credits, 100 - HEIRLOOM_ENGRAVE_COST);
  assert.equal(engraved.chipDealerHeirloomUsed, true);

  // Second engrave in same visit is blocked
  const secondVisitAttempt = engraveHeirloom(engraved, dealerRun.hero.ownedChips[1].defId);
  assert.equal(secondVisitAttempt.hero.credits, 100 - HEIRLOOM_ENGRAVE_COST);

  // Winning combats increments heirloomStacks up to MAX_HEIRLOOM_STACKS (6) without halving persisted stacks
  let winState: RunState = {
    ...engraved,
    hero: { ...engraved.hero, heirloomStacks: 4 },
    combat: { ...base.combat!, phase: 'VICTORY' },
  };
  winState = claimCombatChipReward(winState, null);
  assert.equal(winState.hero.heirloomStacks, 5);

  const descendant = createInitialRun(204001, 'kira', 3, true);
  assert.equal(
    descendant.hero.heirloomStacks,
    5,
    'Persisted heirloom bonus must NOT be halved after victory',
  );

  // Cap at MAX_HEIRLOOM_STACKS (6)
  const capTest = claimCombatChipReward(
    {
      ...winState,
      hero: { ...winState.hero, heirloomStacks: MAX_HEIRLOOM_STACKS },
      combat: { ...base.combat!, phase: 'VICTORY' },
    },
    null,
  );
  assert.equal(capTest.hero.heirloomStacks, MAX_HEIRLOOM_STACKS);
});

test('Stork Nursery genetic traits (upcharge, pierce_boost, shield_aura) and chip TECH scaling work end-to-end', () => {
  const base = createInitialRun(104729, 'kira');
  const clinicRun: RunState = {
    ...base,
    screen: 'clinic',
    hero: { ...base.hero, credits: 200 },
  };

  // Incubate innate attack tile with pierce_boost and shield_aura manually as well as natural roll
  const atkTile = clinicRun.masterPool.find((t) => t.sourceId === 'innate' && t.type === 'attack')!;
  const afterIncubate = incubateStorkTile(clinicRun, atkTile.id);
  assert.equal(afterIncubate.hero.incubatingTile?.nodesRemaining, 3);
  let hero = afterIncubate.hero;
  hero = advanceNodeDynastyProgress(hero);
  hero = advanceNodeDynastyProgress(hero);
  hero = advanceNodeDynastyProgress(hero);
  assert.ok(hero.maturedNextGenTiles?.[atkTile.id]);

  // Verify all 3 inherited traits in rebuildMasterPool + combat preview
  const chipHealTileId = base.masterPool.find((t) => t.sourceId === 'auto_suture')!.id;
  for (const trait of ['upcharge', 'pierce_boost', 'shield_aura'] as const) {
    const heroWithTrait = {
      ...base.hero,
      maturedNextGenTiles: {
        [atkTile.id]: { bonusMultiplier: 2, inheritedTrait: trait },
        [chipHealTileId]: { bonusMultiplier: 2, inheritedTrait: trait },
      },
    };
    const pool = rebuildMasterPool(heroWithTrait);
    const maturedAtk = pool.find((t) => t.id === atkTile.id)!;
    const maturedChipHeal = pool.find((t) => t.id === chipHealTileId)!;
    assert.equal(maturedAtk.value, Math.max(8, atkTile.value * 2));
    assert.equal(maturedChipHeal.techEffect?.kind === 'heal' && maturedChipHeal.techEffect.amount, 6);

    const traitCombat: RunState = {
      ...base,
      hero: { ...heroWithTrait, shield: 0, pendingUpcharge: 0 },
      combat: {
        ...base.combat!,
        board: [{ ...maturedAtk, isHeldFromPrevTurn: false }],
        enemies: [{ ...base.combat!.enemies[0], hp: 30, armor: 10, shieldPips: 0 }],
      },
    };
    const preview = previewColorResolution(traitCombat, 'attack');
    if (trait === 'upcharge') {
      assert.equal(preview.upchargeGained, 2);
    } else if (trait === 'pierce_boost') {
      assert.equal(preview.armorPiercing, true);
      const afterAtk = resolvePlayerColor(traitCombat, 'attack');
      assert.ok(afterAtk.combat!.enemies[0].hp < 30, 'pierce_boost deals 30% HP damage through 10 Armor');
    } else if (trait === 'shield_aura') {
      assert.equal(preview.shieldGained, 3);
      const afterAtk = resolvePlayerColor(traitCombat, 'attack');
      assert.equal(afterAtk.hero.shield, 3);
    }
  }
});

test('bandwidth_vow reduces combat credit rewards by 25%, Dynasty events roll naturally, and Beta Trial expires & revokes un-upgraded chips', () => {
  const base = createInitialRun(104729, 'kira');
  const vowRun: RunState = {
    ...base,
    hero: {
      ...base.hero,
      credits: 0,
      activeTempoRule: { id: 'bandwidth_vow', nodesRemaining: 2 },
    },
    combat: {
      ...base.combat!,
      director: undefined,
      rewardCredits: 40,
      enemies: [{ ...base.combat!.enemies[0], hp: 1, armor: 0, shieldPips: 0 }],
      board: [{ id: 'a1', type: 'attack', sourceId: 'test', value: 5, isHeldFromPrevTurn: false }],
    },
  };
  const afterVowWin = resolvePlayerColor(vowRun, 'attack');
  assert.equal(afterVowWin.combat?.phase, 'VICTORY');
  assert.equal(
    afterVowWin.combat?.rewardCredits,
    30,
    'bandwidth_vow reduces combat credit rewards by 25% (40 -> 30)',
  );

  // Natural getCyberEventForNode includes DYNASTY_EVENT_TEMPLATES
  const dynastyIds = new Set(DYNASTY_EVENT_TEMPLATES.map((e) => e.id));
  let sawDynastyEvent = false;
  const dummyNode: MapNode = { id: 'n_3_1', layer: 3, lane: 1, type: 'EVENT', nextIds: [], cleared: false };
  for (let s = 1; s < 30; s++) {
    const ev = getCyberEventForNode(dummyNode, s, base.hero);
    if (dynastyIds.has(ev.id)) {
      sawDynastyEvent = true;
      break;
    }
  }
  assert.ok(sawDynastyEvent, 'getCyberEventForNode must naturally roll Dynasty events');

  // Beta Trial expiry revokes trial chip after 2 combats when not upgraded
  const dealerRun: RunState = { ...base, screen: 'chip_dealer', combat: null };
  const startedTrial = startBetaTrialChip(dealerRun, 'volley_matrix');
  assert.ok(startedTrial.hero.betaTrialChip?.instanceId);
  const trialInstanceId = startedTrial.hero.betaTrialChip.instanceId!;
  assert.ok(startedTrial.hero.ownedChips.some((c) => c.instanceId === trialInstanceId));

  // Win combat 1 without resolving 5 tiles -> combines down to 1 remaining
  const afterCombat1 = claimCombatChipReward(
    { ...startedTrial, combat: { ...base.combat!, phase: 'VICTORY', rewardChipChoices: [] } },
    null,
  );
  assert.equal(afterCombat1.hero.betaTrialChip?.combatsRemaining, 1);
  assert.ok(afterCombat1.hero.ownedChips.some((c) => c.instanceId === trialInstanceId));

  // Win combat 2 without upgrading -> revokes trial chip and clears betaTrialChip
  const afterCombat2 = claimCombatChipReward(
    { ...afterCombat1, combat: { ...base.combat!, phase: 'VICTORY', rewardChipChoices: [] } },
    null,
  );
  assert.equal(afterCombat2.hero.betaTrialChip, null);
  assert.ok(!afterCombat2.hero.ownedChips.some((c) => c.instanceId === trialInstanceId));

  // Tier 1 skipCombatEncounter also advances Stork Nursery & Beta Trial
  const storyRun = createInitialRun(777, 'kira', 1);
  const storkAndTrialSkip = skipCombatEncounter({
    ...storyRun,
    hero: {
      ...storyRun.hero,
      incubatingTile: {
        tile: storyRun.masterPool[0],
        nodesRemaining: 1,
        inheritedTrait: 'shield_aura',
      },
      betaTrialChip: {
        defId: 'volley_matrix',
        instanceId: 'chip_trial_skip',
        combatsRemaining: 1,
        resolvesLogged: 0,
        upgraded: false,
      },
      ownedChips: [
        ...storyRun.hero.ownedChips,
        { instanceId: 'chip_trial_skip', defId: 'volley_matrix' },
      ],
    },
    combat: { ...storyRun.combat!, nodeType: 'COMBAT' },
  });
  assert.equal(storkAndTrialSkip.hero.incubatingTile, null);
  assert.ok(storkAndTrialSkip.hero.maturedNextGenTiles?.[storyRun.masterPool[0].id]);
  assert.equal(storkAndTrialSkip.hero.betaTrialChip, null);
});

test('Dynasty facilities: Pedigree Crest, Charter Academy, FabLab, Nanny-Bot, Mesh-Net, Suburban Dome, and Mag-Lev Express', () => {
  const extendedRun = createInitialRun(104729, 'kira', 3);
  let mapRun = claimCombatChipReward(
    {
      ...extendedRun,
      hero: { ...extendedRun.hero, credits: 200, hp: 35, maxHp: 60 },
      combat: { ...extendedRun.combat!, phase: 'VICTORY', rewardCredits: 20, rewardChipChoices: [] },
    },
    null,
  );
  mapRun = charterSuburbanEstate(mapRun);
  assert.ok(mapRun.hero.familyEstates?.includes(1));

  const l1CombatNode = mapRun.mapNodes.find((n) => n.layer === 1 && n.type === 'COMBAT')!;
  const afterEstateVisit = startNodeEncounter(mapRun, l1CombatNode.id);
  assert.equal(afterEstateVisit.hero.hp, 45);

  const layer1Cleared = claimCombatChipReward(
    {
      ...afterEstateVisit,
      combat: { ...afterEstateVisit.combat!, phase: 'VICTORY', rewardCredits: 20, rewardChipChoices: [] },
    },
    null,
  );
  const afterMaglev = rideMagLevExpress(layer1Cleared, 'n_3_1');
  assert.equal(afterMaglev.hero.maglevUsed, true);

  const l2Node = layer1Cleared.mapNodes.find(
    (n) =>
      n.layer === 2 &&
      !layer1Cleared.mapNodes.find((c) => c.id === l1CombatNode.id)!.nextIds.includes(n.id),
  );
  if (l2Node) {
    const rerouted = rerouteMeshNetNode(layer1Cleared, l2Node.id);
    assert.equal(rerouted.hero.meshReroutesUsed, 1);
  }

  let pedigreeRun = marryBloodlineCrest(
    { ...afterMaglev, screen: 'clinic' },
    'attack',
    'defense',
  );
  assert.equal(pedigreeRun.hero.bloodlineCrest?.primary, 'attack');
  const innateDef = pedigreeRun.masterPool.find((t) => t.sourceId === 'innate' && t.type === 'defense')!;
  pedigreeRun = enrollCharterProdigyTile(pedigreeRun, innateDef.id);
  assert.ok(pedigreeRun.hero.prodigyTileIds?.includes(innateDef.id));

  const nannyRun = adoptNannyBot({ ...pedigreeRun, screen: 'chip_dealer' }, 'guardian_nanny');
  assert.equal(nannyRun.hero.nannyBotInstalled, 'guardian_nanny');

  const aiEvent = CYBER_EVENT_TEMPLATES.find((ev) => ev.id === 'rogue_ai_cache')!;
  const aiCs = localizeCyberEvent(aiEvent, 'cs').choices.find((c) => c.id === 'ai_siphon')!;
  assert.ok(aiCs.description.includes('+8 HP'));
});
