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
