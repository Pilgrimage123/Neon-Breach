import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runBalanceBatch,
  runBalanceMatrix,
} from './balanceSimulation';
import { ENEMY_TEMPLATES } from './data';
import {
  computeSmartScaledEnemyHp,
  computeSmartScaledEnemyIntentValue,
  getDifficultyProfile,
} from './difficulty';
import { buildEnemiesForNode } from './encounterBuilder';
import {
  applyMedBayAction,
  claimCombatChipReward,
  computeMedBayHealAmount,
  createInitialRun,
  executeEnemyTurn,
  FABLAB_SPLICE_COST,
  previewColorResolution,
  previewHeroThreat,
  resolvePlayerColor,
  spliceFabLabTiles,
  startNodeEncounter,
} from './gameEngine';
import type { CharacterId, DifficultyTier } from './types';

test('Difficulty tiers scale ALL enemy HP (including Spore Mite) and damaging intents monotonically', () => {
  const tiers: DifficultyTier[] = [1, 2, 3, 4, 5];

  // Spore Mite (larva) HP scales monotonically T1 -> T5 (not frozen at 9 HP)
  const larvaHps = tiers.map((t) =>
    computeSmartScaledEnemyHp('larva', ENEMY_TEMPLATES.larva.maxHp, 0, t),
  );
  assert.equal(larvaHps[2], 9, 'Tier 3 baseline Spore Mite stays 9 HP');
  assert.ok(larvaHps[0] < larvaHps[2], `Tier 1 larva HP (${larvaHps[0]}) < Tier 3 (${larvaHps[2]})`);
  assert.ok(larvaHps[4] > larvaHps[2], `Tier 5 larva HP (${larvaHps[4]}) > Tier 3 (${larvaHps[2]})`);

  // Damaging intent values scale monotonically T1 -> T5 while non-damaging intents (armor/brace) do not
  const atkValues = tiers.map((t) =>
    computeSmartScaledEnemyIntentValue({ kind: 'attack', value: 6 }, t),
  );
  assert.equal(atkValues[2], 6, 'Tier 3 attack stays 6');
  assert.ok(atkValues[0] < atkValues[2], `Tier 1 attack (${atkValues[0]}) < Tier 3 (${atkValues[2]})`);
  assert.ok(atkValues[4] > atkValues[2], `Tier 5 attack (${atkValues[4]}) > Tier 3 (${atkValues[2]})`);

  const armorValues = tiers.map((t) =>
    computeSmartScaledEnemyIntentValue({ kind: 'armor', value: 4 }, t),
  );
  assert.deepEqual(armorValues, [4, 4, 4, 4, 4], 'Armor bolster intent does not scale with damage multiplier');

  // Preview threat matches actual Tier 5 scaled intent damage on Stage 01
  const t5Run = createInitialRun(1001, 'kira', 5);
  const combatRun = startNodeEncounter(t5Run, t5Run.mapNodes[0].id);
  assert.ok(combatRun.combat);
  const firstEnemy = combatRun.combat.enemies[0];
  const baseLarvaAtk = ENEMY_TEMPLATES.larva.intentCycle[0].value;
  assert.ok(
    firstEnemy.intentCycle[0].value > baseLarvaAtk,
    `Tier 5 larva intent (${firstEnemy.intentCycle[0].value}) should exceed baseline (${baseLarvaAtk})`,
  );
  const threat = previewHeroThreat(combatRun.combat, combatRun.hero, null);
  assert.equal(
    threat.rawIncomingDamage,
    combatRun.combat.enemies.reduce((s, e) => s + e.intentCycle[e.currentIntentIndex].value, 0),
    'Threat preview matches scaled enemy intent values',
  );
});

test('Auraline Reactor Core Duds have active base values and +1 Armor / +1 UC preview-to-execution parity', () => {
  const run = createInitialRun(2025, 'auraline', 3);
  assert.equal(run.hero.maxHp, 68);
  assert.equal(run.hero.armor, 2);

  const combatRun = startNodeEncounter(run, run.mapNodes[0].id);
  assert.ok(combatRun.combat);

  const atkDud = run.masterPool.find((t) => t.isDud && t.type === 'attack')!;
  const defDud = run.masterPool.find((t) => t.isDud && t.type === 'defense')!;
  const techDud = run.masterPool.find((t) => t.isDud && t.type === 'tech')!;
  assert.equal(atkDud.value, 2);
  assert.equal(defDud.value, 3);
  assert.equal(techDud.techEffect?.kind, 'damage_boost');

  const boardWithDuds = {
    ...combatRun,
    combat: {
      ...combatRun.combat,
      board: [
        { ...atkDud, id: 'd_atk_test' },
        { ...defDud, id: 'd_def_test' },
        { ...techDud, id: 'd_tech_test' },
      ],
    },
  };

  const atkPrev = previewColorResolution(boardWithDuds, 'attack');
  assert.equal(atkPrev.totalDamage, 2);
  assert.equal(atkPrev.armorGained, 1);
  assert.equal(atkPrev.upchargeGained, 1);

  const defPrev = previewColorResolution(boardWithDuds, 'defense');
  assert.equal(defPrev.shieldGained, 3);
  assert.equal(defPrev.armorGained, 1);

  const techPrev = previewColorResolution(boardWithDuds, 'tech');
  assert.equal(techPrev.damageBoostAddedPct, 15);
  assert.equal(techPrev.armorGained, 1);

  const afterDef = resolvePlayerColor(boardWithDuds, 'defense');
  assert.equal(afterDef.hero.shield, 3);
  assert.equal(afterDef.hero.armor, 3, '2 starting armor + 1 from Reactor Core Dud');
});

test('Tier 5 Mandate Breach is non-lethal (-6 HP clamped min 1 HP), cuts CR by 50%, and keeps chip loot', () => {
  const run = createInitialRun(3030, 'kira', 5);
  let combatRun = startNodeEncounter(run, run.mapNodes[0].id);
  assert.ok(combatRun.combat);

  // Set hero to 4 HP and fail the Tier 5 objective by taking HP damage + clearing slowly
  combatRun = {
    ...combatRun,
    hero: { ...combatRun.hero, hp: 4, shield: 0, armor: 0 },
    combat: {
      ...combatRun.combat,
      turn: 9,
      startingHeroHp: 62,
      enemies: [
        {
          ...combatRun.combat.enemies[0],
          hp: 1,
          armor: 0,
          shieldPips: 0,
        },
      ],
      board: [
        {
          id: 'kill_tile',
          type: 'attack',
          value: 8,
          sourceId: 'innate',
          isHeldFromPrevTurn: false,
        },
      ],
    },
  };

  const afterWin = resolvePlayerColor(combatRun, 'attack');
  assert.equal(afterWin.combat?.phase, 'VICTORY');
  assert.equal(afterWin.combat?.mandateBreachLootConfiscated, true);
  assert.equal(afterWin.combat?.mandateBreachPenaltyHp, 6);
  assert.equal(afterWin.hero.hp, 1, 'Non-lethal breach clamps HP to 1 instead of killing hero');
  assert.ok(
    (afterWin.combat?.rewardCredits ?? 0) >= 5,
    'Breach cuts credits by 50% instead of zeroing to 0',
  );
  assert.ok(
    (afterWin.combat?.rewardChipChoices.length ?? 0) > 0,
    'Breach preserves AI Skill Chip loot choices',
  );

  // Salvaging offered chip still awards +15 CR
  const creditsBeforeClaim = afterWin.hero.credits;
  const afterClaim = claimCombatChipReward(afterWin, null);
  assert.ok(afterClaim.hero.credits >= creditsBeforeClaim + (afterWin.combat?.rewardCredits ?? 0) + 15);
});

test('Med-Bay Repair scales by 35% Max HP (non-dominated over Kids) and FabLab Splice costs 15 CR once per Clinic', () => {
  assert.equal(computeMedBayHealAmount(62), 22);
  assert.equal(computeMedBayHealAmount(70), 25);
  assert.equal(computeMedBayHealAmount(50), 20, 'Minimum floor of 20 HP');

  const kiraRun = createInitialRun(4040, 'kira', 3);
  const injured = {
    ...kiraRun,
    screen: 'medbay' as const,
    hero: { ...kiraRun.hero, hp: 20 },
  };
  const afterHeal = applyMedBayAction(injured, 'heal');
  const afterKids = applyMedBayAction(injured, 'hearth_kids');
  assert.equal(afterHeal.hero.hp, 42, 'Kira heals +22 HP at Med-Bay');
  assert.equal(afterKids.hero.hp, 32, 'Hearth Kids heals +12 HP');
  assert.ok(afterHeal.hero.hp > afterKids.hero.hp, 'Bio-Repair strictly beats Hearth Kids on raw HP recovery');

  // FabLab Splice costs 15 CR and is capped at 1 per Clinic visit
  const clinicRun = {
    ...kiraRun,
    screen: 'clinic' as const,
    clinicSpliceUsed: false,
    hero: { ...kiraRun.hero, credits: 50 },
  };
  const [t1, t2, t3, t4] = clinicRun.masterPool;
  const afterFirstSplice = spliceFabLabTiles(clinicRun, t1.id, t2.id);
  assert.equal(afterFirstSplice.hero.credits, 50 - FABLAB_SPLICE_COST);
  assert.equal(afterFirstSplice.clinicSpliceUsed, true);

  // Second splice attempt in the same clinic visit is blocked
  const afterSecondSplice = spliceFabLabTiles(afterFirstSplice, t3.id, t4.id);
  assert.equal(afterSecondSplice.hero.credits, afterFirstSplice.hero.credits);
  assert.equal(afterSecondSplice.masterPool.length, afterFirstSplice.masterPool.length);
});

test('Inter-combat Overdrive carryover caps at 50% on combat exit while preserving Med-Bay boosts into next combat, and waves enforce specialist & Elite guards', () => {
  const run = createInitialRun(5050, 'zuri', 3);
  let combatRun = startNodeEncounter(run, run.mapNodes[0].id);
  assert.ok(combatRun.combat);
  combatRun = {
    ...combatRun,
    hero: { ...combatRun.hero, overdrive: 95 },
    combat: {
      ...combatRun.combat,
      enemies: [{ ...combatRun.combat.enemies[0], hp: 1, armor: 0, shieldPips: 0 }],
      board: [{ id: 'finish', type: 'attack', value: 6, sourceId: 'innate', isHeldFromPrevTurn: false }],
    },
  };
  const won = resolvePlayerColor(combatRun, 'attack');
  const afterClaim = claimCombatChipReward(won, null);
  assert.equal(afterClaim.hero.overdrive, 50, 'Inter-combat Overdrive carryover caps at 50% on combat exit');

  // Regression: gaining +20% Overdrive at Med-Bay after combat exit must NOT be wiped back to 50% on next combat entry
  const afterMedBayBoost = applyMedBayAction(
    { ...afterClaim, screen: 'medbay' },
    'tile_overclock',
  );
  assert.equal(afterMedBayBoost.hero.overdrive, 70);
  const nextCombatNode = afterClaim.mapNodes.find(
    (n) => n.layer === 1 && (n.type === 'COMBAT' || n.type === 'ELITE'),
  )!;
  const enteredDirectly = startNodeEncounter(afterClaim, nextCombatNode.id);
  assert.equal(enteredDirectly.hero.overdrive, 50);
  const enteredAfterMedBay = startNodeEncounter(afterMedBayBoost, nextCombatNode.id);
  assert.equal(
    enteredAfterMedBay.hero.overdrive,
    70,
    'Med-Bay Overdrive boost carries intact into the next combat',
  );

  // Duplicate specialist guard before Layer 8 & early Elite 2-unit cap
  for (let seed = 100; seed < 140; seed++) {
    for (const layer of [2, 3, 4, 5, 6]) {
      const combatPack = buildEnemiesForNode('COMBAT', layer, seed, 1, undefined, 3, false);
      const stalkers = combatPack.filter((e) => e.archetype === 'stalker').length;
      const spitters = combatPack.filter((e) => e.archetype === 'spitter').length;
      assert.ok(stalkers <= 1, `Duplicate stalker in layer ${layer} seed ${seed}`);
      assert.ok(spitters <= 1, `Duplicate spitter in layer ${layer} seed ${seed}`);
    }
    for (const layer of [2, 3, 4]) {
      const elitePack = buildEnemiesForNode('ELITE', layer, seed, 0, undefined, 3, false);
      assert.ok(elitePack.length <= 2, `Early Elite layer ${layer} seed ${seed} exceeded 2 units (${elitePack.length})`);
    }
  }
});

test('Balance simulation matrix: tier monotonicity, hero parity, zero lethal breaches, and Boss TTK', () => {
  const seeds = Array.from({ length: 16 }, (_, idx) => 7001 + idx * 97);
  const matrix = runBalanceMatrix(seeds, 'tactical', [1, 2, 3, 4, 5]);
  const byTier = (tier: DifficultyTier) =>
    matrix.filter((s) => s.difficultyTier === tier);

  const avgOf = (list: typeof matrix, pick: (s: (typeof matrix)[number]) => number) =>
    list.reduce((acc, s) => acc + pick(s), 0) / Math.max(1, list.length);

  const tierAvgHp = ([1, 2, 3, 4, 5] as DifficultyTier[]).map((t) =>
    avgOf(byTier(t), (s) => s.avgHpLostPerRun),
  );
  const t1 = byTier(1);
  const t3 = byTier(3);
  const t4 = byTier(4);
  const t5 = byTier(5);

  const t1Wr = avgOf(t1, (s) => s.winRate);
  const t3Wr = avgOf(t3, (s) => s.winRate);
  const t5Wr = avgOf(t5, (s) => s.winRate);
  const t3BossTtk = avgOf(t3, (s) => s.buckets.BOSS.avgTurns);

  // Diagnostic matrix summary for tuning visibility
  console.log('\n[Balance Matrix — 16 seeds × 3 Heroes × Tiers 1–5 (Tactical)]');
  for (const tier of [1, 2, 3, 4, 5] as DifficultyTier[]) {
    const row = byTier(tier)
      .map(
        (s) =>
          `${s.characterId}: WR=${Math.round(s.winRate * 100)}% HP-=${s.avgHpLostPerRun.toFixed(1)} ARM=${s.avgArmorAbsorbedPerRun.toFixed(1)} BossTTK=${s.buckets.BOSS.avgTurns.toFixed(1)} Breach=${s.totalMandateBreaches}(L:${s.lethalMandateBreaches})`,
      )
      .join(' | ');
    console.log(`  T${tier}: ${row}`);
  }

  // 1. Strict 5-step monotonic difficulty scaling T1 < T2 < T3 < T4 < T5 (roster average AND per-hero)
  for (let i = 0; i < 4; i++) {
    assert.ok(
      tierAvgHp[i] < tierAvgHp[i + 1],
      `Expected strict avg HP-loss monotonicity T${i + 1} (${tierAvgHp[i].toFixed(1)}) < T${i + 2} (${tierAvgHp[i + 1].toFixed(1)})`,
    );
  }
  const heroes: CharacterId[] = ['kira', 'auraline', 'zuri'];
  for (const hero of heroes) {
    const heroHpCurve = ([1, 2, 3, 4, 5] as DifficultyTier[]).map(
      (t) => matrix.find((s) => s.difficultyTier === t && s.characterId === hero)!.avgHpLostPerRun,
    );
    for (let i = 0; i < 4; i++) {
      assert.ok(
        heroHpCurve[i] < heroHpCurve[i + 1],
        `Expected per-hero monotonic HP-loss for ${hero}: T${i + 1} (${heroHpCurve[i].toFixed(1)}) < T${i + 2} (${heroHpCurve[i + 1].toFixed(1)})`,
      );
    }
  }
  assert.ok(
    t1Wr >= t5Wr,
    `Expected Tier 1 win rate (${(t1Wr * 100).toFixed(0)}%) >= Tier 5 win rate (${(t5Wr * 100).toFixed(0)}%)`,
  );
  assert.ok(
    t3Wr >= 0.8,
    `Expected Tier 3 Tactical win rate >= 80% (got ${(t3Wr * 100).toFixed(0)}%)`,
  );
  assert.ok(
    t5Wr >= 0.75,
    `Expected Tier 5 Tactical win rate >= 75% (got ${(t5Wr * 100).toFixed(0)}%)`,
  );

  // 2. Hero parity on Tier 3, Tier 4, and Tier 5
  for (const [label, group, maxRatio] of [
    ['Tier 3', t3, 2.2],
    ['Tier 4', t4, 1.75],
    ['Tier 5', t5, 1.75],
  ] as const) {
    const wrs = group.map((s) => s.winRate);
    const wrSpread = Math.max(...wrs) - Math.min(...wrs);
    assert.ok(
      wrSpread <= 0.15,
      `${label} Hero WR spread ${(wrSpread * 100).toFixed(1)}pp exceeded 15pp (${group.map((s) => `${s.characterId}:${Math.round(s.winRate * 100)}%`).join(', ')})`,
    );

    const hpLosses = group.map((s) => Math.max(1, s.avgHpLostPerRun));
    const hpRatio = Math.max(...hpLosses) / Math.min(...hpLosses);
    assert.ok(
      hpRatio <= maxRatio,
      `${label} Hero HP-loss ratio ${hpRatio.toFixed(2)}× exceeded ${maxRatio}× (${group.map((s) => `${s.characterId}:${s.avgHpLostPerRun.toFixed(1)}`).join(', ')})`,
    );
  }

  // 3. Zero lethal Mandate Breaches on Tier 5
  const totalLethalBreaches = t5.reduce((acc, s) => acc + s.lethalMandateBreaches, 0);
  assert.equal(totalLethalBreaches, 0, 'Tier 5 Mandate Breaches must never kill the Hero');

  // 4. Stage 12 Matriarch Boss TTK on Tier 3
  assert.ok(
    t3BossTtk >= 5.5 && t3BossTtk <= 8.5,
    `Tier 3 Matriarch Boss avg TTK (${t3BossTtk.toFixed(2)} turns) outside [5.5, 8.5] band`,
  );

  // 5. Strict skill expression (NO fudge factors): Tactical beats Novice on T3 HP loss and crushes Novice on T5 WR
  const noviceSeeds = seeds.slice(0, 12);
  const noviceKiraT3 = runBalanceBatch('kira', 3, noviceSeeds, 'novice');
  const tacticalKiraT3 = runBalanceBatch('kira', 3, noviceSeeds, 'tactical');
  assert.ok(
    tacticalKiraT3.winRate >= noviceKiraT3.winRate &&
      tacticalKiraT3.avgHpLostPerRun < noviceKiraT3.avgHpLostPerRun,
    `Expected Tactical Kira T3 (WR=${Math.round(tacticalKiraT3.winRate * 100)}%, HP-=${tacticalKiraT3.avgHpLostPerRun.toFixed(1)}) to strictly outperform Novice Kira T3 (WR=${Math.round(noviceKiraT3.winRate * 100)}%, HP-=${noviceKiraT3.avgHpLostPerRun.toFixed(1)})`,
  );

  const noviceKiraT5 = runBalanceBatch('kira', 5, noviceSeeds, 'novice');
  const tacticalKiraT5 = runBalanceBatch('kira', 5, noviceSeeds, 'tactical');
  assert.ok(
    noviceKiraT5.winRate <= 0.6 && tacticalKiraT5.winRate > noviceKiraT5.winRate,
    `Expected Tier 5 Grandmaster to punish Novice Kira (WR=${Math.round(noviceKiraT5.winRate * 100)}%) while rewarding Tactical Kira (WR=${Math.round(tacticalKiraT5.winRate * 100)}%)`,
  );

  assert.equal(heroes.length, 3);
  assert.ok(getDifficultyProfile(5).enemyDamageMultiplier > getDifficultyProfile(1).enemyDamageMultiplier);
  assert.ok(typeof executeEnemyTurn === 'function');
});
