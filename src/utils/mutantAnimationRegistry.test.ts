import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_TEMPLATES } from '../engine/data';
import type { EnemyArchetype } from '../engine/types';
import { CRAWLER_ARCH_SCALE } from './crawlerSpriteSheet';
import { FERAL_NURSE_SHEET_FRAMES } from './feralNurseSpriteSheet';
import {
  MUTANT_ANIMATION_REGISTRY,
  TIER_A_LAB_ARCHETYPES,
  computeEnemyCrowdScale,
  getMutantArchScale,
} from './mutantAnimationRegistry';
import { MUTDOG_SHEET_FRAMES } from './mutdogSpriteSheet';

test('MUTANT_ANIMATION_REGISTRY covers all 9 EnemyArchetypes with valid Tier A and transitional metadata', () => {
  const allArchetypes = Object.keys(ENEMY_TEMPLATES) as EnemyArchetype[];
  assert.equal(allArchetypes.length, 9);

  for (const arch of allArchetypes) {
    const spec = MUTANT_ANIMATION_REGISTRY[arch];
    assert.ok(spec, `Missing registry entry for ${arch}`);
    assert.equal(spec.archetype, arch);
    assert.equal(getMutantArchScale(arch), spec.archScale);
    assert.ok(spec.archScale > 0.5 && spec.archScale < 2.0);
    if (spec.tier === 'tier_a') {
      assert.ok(spec.canonicalHeight !== null && spec.canonicalHeight > 100);
      assert.ok(spec.devLabTabId !== null, `Tier A Mutant ${arch} must expose a DEV lab tab`);
    }
  }

  assert.equal(getMutantArchScale('larva'), CRAWLER_ARCH_SCALE.larva);
  assert.equal(getMutantArchScale('skitter'), CRAWLER_ARCH_SCALE.skitter);
  assert.equal(getMutantArchScale('stinger'), CRAWLER_ARCH_SCALE.stinger);
  assert.equal(getMutantArchScale('brute'), 1.32);
  assert.equal(getMutantArchScale('feral_nurse'), 1.0);
  assert.equal(getMutantArchScale('boss'), 1.36);
  assert.equal(TIER_A_LAB_ARCHETYPES.length, 4);

  // Visual size ladder invariants
  assert.ok(getMutantArchScale('skitter') < getMutantArchScale('stinger'));
  assert.ok(getMutantArchScale('mutdog') < getMutantArchScale('feral_nurse'));
  assert.ok(getMutantArchScale('brute') < getMutantArchScale('boss'));

  // Crowd scale invariants
  assert.equal(computeEnemyCrowdScale(3), 1);
  assert.equal(computeEnemyCrowdScale(4), 0.92);
  assert.equal(computeEnemyCrowdScale(5), 0.86);

  // Per-frame normalization keeps MutDog idle smooth and howl/pounce clamped
  const mutdogIdleHeights = [0, 1, 2].map(
    (i) => MUTDOG_SHEET_FRAMES[i].h * (MUTDOG_SHEET_FRAMES[i].frameScale ?? 1),
  );
  assert.ok(Math.max(...mutdogIdleHeights) - Math.min(...mutdogIdleHeights) <= 3);
  assert.ok(MUTDOG_SHEET_FRAMES[4].h * (MUTDOG_SHEET_FRAMES[4].frameScale ?? 1) <= 212);

  // Feral Nurse prowl F5..F9 height spread <= 5px after frameScale
  const prowlHeights = [5, 6, 7, 8, 9].map(
    (i) => FERAL_NURSE_SHEET_FRAMES[i].h * (FERAL_NURSE_SHEET_FRAMES[i].frameScale ?? 1),
  );
  assert.ok(Math.max(...prowlHeights) - Math.min(...prowlHeights) <= 5);
});
