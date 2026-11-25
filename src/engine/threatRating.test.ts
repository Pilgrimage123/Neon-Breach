import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_TEMPLATES } from './data';
import { computeSmartScaledEnemyHp } from './difficulty';
import { buildEnemiesForNode, buildEncounterSpec } from './encounterBuilder';
import {
  ARCHETYPE_THREAT_RATING,
  MULTI_ENEMY_TAX,
  absorbHeroDamage,
  computeEncounterThreatRating,
  computeMutantThreatRating,
  createInitialRun,
  executeSingleEnemyAction,
  getEncounterBudgetForNode,
  resolvePlayerColor,
} from './gameEngine';
import { MAX_ACTIVE_BRIDGE_ENEMIES, getEnemySlotSpan } from './reinforcementDirector';
import type { DifficultyTier } from './types';

test('Threat Rating formula orders Mutants monotonically and applies Windup, Pierce, Overwhelm, and Multi-Enemy Tax', () => {
  const larva = computeMutantThreatRating(ENEMY_TEMPLATES.larva);
  const stinger = computeMutantThreatRating(ENEMY_TEMPLATES.stinger);
  const skitter = computeMutantThreatRating(ENEMY_TEMPLATES.skitter);
  const spitter = computeMutantThreatRating(ENEMY_TEMPLATES.spitter);
  const stalker = computeMutantThreatRating(ENEMY_TEMPLATES.stalker);
  const brute = computeMutantThreatRating(ENEMY_TEMPLATES.brute);
  const boss = computeMutantThreatRating(ENEMY_TEMPLATES.boss);

  assert.ok(larva.total < stinger.total, `Expected larva (${larva.total}) < stinger (${stinger.total})`);
  assert.ok(stinger.total <= skitter.total, `Expected stinger (${stinger.total}) <= skitter (${skitter.total})`);
  assert.ok(skitter.total < spitter.total, `Expected skitter (${skitter.total}) < spitter (${spitter.total})`);
  assert.ok(spitter.total <= stalker.total, `Expected spitter (${spitter.total}) <= stalker (${stalker.total})`);
  assert.ok(stalker.total < brute.total, `Expected stalker (${stalker.total}) < brute (${brute.total})`);
  assert.ok(brute.total < boss.total, `Expected brute (${brute.total}) < boss (${boss.total})`);

  assert.equal(larva.windupModifier, 0);
  assert.equal(larva.traitModifier, -1.0);
  assert.equal(stinger.windupModifier, -2.0);
  assert.equal(stinger.burstModifier, 1.5);
  assert.equal(stalker.windupModifier, -1.5);

  const duo = computeEncounterThreatRating(['larva', 'larva']);
  assert.equal(duo, ARCHETYPE_THREAT_RATING.larva * 2 + MULTI_ENEMY_TAX);
});

test('Pierce bypasses Shield while respecting Armor, and Overwhelm multiplies unblocked post-Shield damage', () => {
  const pierceNoArmor = absorbHeroDamage(10, 0, 5, { pierceShield: true });
  assert.equal(pierceNoArmor.blockedByShield, 0);
  assert.equal(pierceNoArmor.hpDamage, 5);
  assert.equal(pierceNoArmor.nextShield, 10);

  const pierceWithArmor = absorbHeroDamage(10, 10, 5, { pierceShield: true });
  assert.equal(pierceWithArmor.blockedByShield, 0);
  assert.equal(pierceWithArmor.blockedByArmor, 5);
  assert.equal(pierceWithArmor.hpDamage, 0);

  const overwhelmBlocked = absorbHeroDamage(6, 0, 6, { overwhelmMultiplier: 3 });
  assert.equal(overwhelmBlocked.blockedByShield, 6);
  assert.equal(overwhelmBlocked.hpDamage, 0);

  const overwhelmLeak = absorbHeroDamage(2, 0, 6, { overwhelmMultiplier: 3 });
  assert.equal(overwhelmLeak.blockedByShield, 2);
  assert.equal(overwhelmLeak.hpDamage, 12);
});

test('Pause intent deals 0 DMG and cannot be staggered by 16+ burst', () => {
  const baseRun = createInitialRun(2026);
  assert.ok(baseRun.combat);

  const stalker = {
    ...baseRun.combat.enemies[1],
    hp: 24,
    maxHp: 24,
    currentIntentIndex: 0,
  };
  assert.equal(stalker.intentCycle[0].kind, 'pause');

  const idleRun = {
    ...baseRun,
    hero: { ...baseRun.hero, hp: 50, shield: 0 },
    combat: {
      ...baseRun.combat,
      phase: 'PLAYER_IDLE' as const,
      enemies: [stalker],
      board: [
        { id: 't1', type: 'attack' as const, sourceId: 's', value: 8, isHeldFromPrevTurn: false },
        { id: 't2', type: 'attack' as const, sourceId: 's', value: 9, isHeldFromPrevTurn: false },
      ],
    },
  };

  const afterAtk = resolvePlayerColor(idleRun, 'attack');
  assert.equal(Boolean(afterAtk.combat?.enemies[0].staggered), false);

  const afterPause = executeSingleEnemyAction(
    { ...afterAtk, combat: { ...afterAtk.combat!, phase: 'PLAYER_RESOLVED' as const } },
    0,
  );
  assert.equal(afterPause.hero.hp, 50);
  assert.equal(afterPause.combat?.enemies[0].currentIntentIndex, 1);
});

test('Encounter builder respects Threat Rating budgets, bridge slots, and ADR-0004 sacred Spore Mite HP across Stages and Tiers', () => {
  const tiers: DifficultyTier[] = [1, 2, 3, 4, 5];
  for (const tier of tiers) {
    for (let layer = 0; layer <= 10; layer++) {
      for (const nodeType of ['COMBAT', 'ELITE'] as const) {
        if (layer === 0 && nodeType === 'ELITE') continue;
        const spec = buildEncounterSpec(nodeType, layer, 1337, 0, tier, false);
        const budget = getEncounterBudgetForNode(nodeType, layer, tier, false);
        const totalThreat = computeEncounterThreatRating(spec.map((s) => s.archetype));
        const totalSlots = spec.reduce((sum, s) => sum + getEnemySlotSpan(s.archetype), 0);

        assert.ok(
          totalThreat <= budget.maxBudget,
          `Tier ${tier} Layer ${layer} ${nodeType}: threat ${totalThreat} exceeded maxBudget ${budget.maxBudget}`,
        );
        assert.ok(
          totalSlots <= MAX_ACTIVE_BRIDGE_ENEMIES,
          `Tier ${tier} Layer ${layer} ${nodeType}: slots ${totalSlots} exceeded ${MAX_ACTIVE_BRIDGE_ENEMIES}`,
        );
      }
    }
  }

  // Full-roster tier scaling: Spore Mite scales smoothly across Tiers 2-5
  for (const tier of [2, 3, 4, 5] as const) {
    const units = buildEnemiesForNode('COMBAT', 0, 42, 0, undefined, tier, false);
    const larva = units.find((u) => u.archetype === 'larva');
    assert.equal(larva?.maxHp, computeSmartScaledEnemyHp('larva', 9, 0, tier));
  }
});

test('Feral Nurse has TR === 9, 1-turn Invisibility (10% taken / 90% pass-through behind, solo 10%), Prepare, and 7 Pierce', async () => {
  const { computeEnemyArmorPreview } = await import('../components/combat/combatEnemyUi');
  const threat = computeMutantThreatRating(ENEMY_TEMPLATES.feral_nurse);
  assert.equal(threat.total, 9, `Expected Feral Nurse TR === 9, got ${threat.total} (raw ${threat.rawScore.toFixed(3)})`);
  assert.equal(ARCHETYPE_THREAT_RATING.feral_nurse, 9);
  assert.equal(getEnemySlotSpan('feral_nurse'), 1);

  const tpl = ENEMY_TEMPLATES.feral_nurse;
  assert.equal(tpl.intentCycle.length, 3);
  assert.equal(tpl.intentCycle[0].kind, 'cloak');
  assert.equal(tpl.intentCycle[1].kind, 'charge');
  assert.equal(tpl.intentCycle[1].value, 7);
  assert.equal(tpl.intentCycle[1].pierceShield, true);
  assert.equal(tpl.intentCycle[2].kind, 'attack');
  assert.equal(tpl.intentCycle[2].value, 7);
  assert.equal(tpl.intentCycle[2].pierceShield, true);

  const baseRun = createInitialRun(2026);
  assert.ok(baseRun.combat);

  const makeNurse = (id: string, intentIdx = 0, cloakedTurns = 0) => ({
    id,
    archetype: 'feral_nurse' as const,
    hp: tpl.maxHp,
    maxHp: tpl.maxHp,
    armor: tpl.startingArmor,
    shieldPips: tpl.startingShieldPips,
    maxShieldPips: tpl.startingShieldPips,
    passive: tpl.passive,
    roleColor: tpl.roleColor,
    intentCycle: tpl.intentCycle,
    currentIntentIndex: intentIdx,
    cloakedTurns,
  });

  // 1. Move 1 (Cloak) grants cloakedTurns = 1 and advances to Move 2 (Prepare)
  const nurseStart = makeNurse('nurse_1', 0, 0);
  const stalkerBehind = {
    ...baseRun.combat.enemies[1],
    id: 'stalker_behind',
    hp: 24,
    maxHp: 24,
    armor: 0,
    shieldPips: 0,
  };
  const afterCloakTurn = executeSingleEnemyAction(
    {
      ...baseRun,
      hero: { ...baseRun.hero, hp: 50, shield: 10, armor: 0 },
      combat: {
        ...baseRun.combat,
        phase: 'PLAYER_RESOLVED' as const,
        enemies: [nurseStart, stalkerBehind],
      },
    },
    0,
  );
  assert.equal(afterCloakTurn.combat?.enemies[0].cloakedTurns, 1);
  assert.equal(afterCloakTurn.combat?.enemies[0].currentIntentIndex, 1);
  assert.ok(afterCloakTurn.combat?.lastCues.some((c) => c.kind === 'enemy_cloak'));

  // 2. While cloaked, a 10-DMG attack deals 10% (1 DMG) to Nurse and passes 90% (9 DMG) to Stalker behind her
  const attackRun = {
    ...afterCloakTurn,
    hero: { ...afterCloakTurn.hero, damageBoostPct: 0, implants: [], scionAlliedHouse: null },
    combat: {
      ...afterCloakTurn.combat!,
      phase: 'PLAYER_IDLE' as const,
      battlefieldRule: undefined,
      board: [
        { id: 'atk1', type: 'attack' as const, sourceId: 's', value: 10, isHeldFromPrevTurn: false },
      ],
    },
  };

  // Preview parity check before clicking
  const nursePreview = computeEnemyArmorPreview(
    attackRun.combat.enemies[0],
    0,
    0,
    {
      color: 'attack',
      tileCount: 1,
      stayCount: 0,
      baseDamage: 10,
      damageBoostPct: 0,
      totalDamage: 10,
      cleaveDamage: 0,
      armorPiercing: false,
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: 10,
      surgeTriggered: false,
      surgeThreshold: 4,
      reflectOnBlock: 0,
      armorShredAmount: 0,
      techPierceDamage: 0,
      cleanseCorrodeAmount: 0,
      retaliateDamage: 0,
    },
    attackRun.combat.enemies,
  );
  const behindPreview = computeEnemyArmorPreview(
    attackRun.combat.enemies[1],
    1,
    0,
    {
      color: 'attack',
      tileCount: 1,
      stayCount: 0,
      baseDamage: 10,
      damageBoostPct: 0,
      totalDamage: 10,
      cleaveDamage: 0,
      armorPiercing: false,
      shieldGained: 0,
      damageBoostAddedPct: 0,
      healAmount: 0,
      overdriveGained: 10,
      surgeTriggered: false,
      surgeThreshold: 4,
      reflectOnBlock: 0,
      armorShredAmount: 0,
      techPierceDamage: 0,
      cleanseCorrodeAmount: 0,
      retaliateDamage: 0,
    },
    attackRun.combat.enemies,
  );
  assert.equal(nursePreview.previewHpLoss, 1);
  assert.equal(behindPreview.previewHpLoss, 9);

  const afterPassThroughAtk = resolvePlayerColor(attackRun, 'attack');
  assert.equal(afterPassThroughAtk.combat?.enemies[0].hp, tpl.maxHp - 1);
  assert.equal(afterPassThroughAtk.combat?.enemies[1].hp, 24 - 9);

  // 3. Solo cloaked Feral Nurse STILL takes only 10% (1 DMG on 10 DMG hit), 90% dissipates harmlessly
  const soloRun = {
    ...attackRun,
    combat: {
      ...attackRun.combat,
      enemies: [makeNurse('solo_nurse', 1, 1)],
    },
  };
  const afterSoloAtk = resolvePlayerColor(soloRun, 'attack');
  assert.equal(afterSoloAtk.combat?.enemies[0].hp, tpl.maxHp - 1);

  // 4. Move 2 (Prepare) clears cloakedTurns back to 0 (lasts 1 turn only!) and advances to Move 3 (7 Pierce)
  const afterPrepare = executeSingleEnemyAction(
    {
      ...afterPassThroughAtk,
      combat: { ...afterPassThroughAtk.combat!, phase: 'PLAYER_RESOLVED' as const },
    },
    0,
  );
  assert.equal(afterPrepare.combat?.enemies[0].cloakedTurns, 0);
  assert.equal(afterPrepare.combat?.enemies[0].currentIntentIndex, 2);

  // 5. Move 3 deals 7 Pierce damage bypassing Hero Shield (10 Shield -> still 10 Shield, Hero loses 7 HP)
  const afterPierce = executeSingleEnemyAction(
    {
      ...afterPrepare,
      hero: { ...afterPrepare.hero, hp: 50, shield: 10, armor: 0 },
      combat: { ...afterPrepare.combat!, phase: 'PLAYER_RESOLVED' as const },
    },
    0,
  );
  assert.equal(afterPierce.hero.hp, 43);
  assert.equal(afterPierce.hero.shield, 10);
  assert.equal(afterPierce.combat?.enemies[0].currentIntentIndex, 0);
});


