import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_TEMPLATES } from '../engine/data';
import type { EnemyArchetype } from '../engine/types';
import { CRAWLER_ARCH_SCALE } from './crawlerSpriteSheet';
import {
  MUTANT_ANIMATION_REGISTRY,
  TIER_A_LAB_ARCHETYPES,
  getMutantArchScale,
} from './mutantAnimationRegistry';

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
  assert.equal(getMutantArchScale('feral_nurse'), 1.02);
  assert.equal(TIER_A_LAB_ARCHETYPES.length, 4);
});
