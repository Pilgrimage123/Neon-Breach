import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MUTDOG_SHEET_FRAMES,
  MUTDOG_SHEET_HEIGHT,
  MUTDOG_SHEET_WIDTH,
} from './mutdogSpriteSheet';
import {
  DEFAULT_MUTDOG_JUICE_CONFIG,
  createMutdogJuiceState,
  stepMutdogJuice,
} from './mutdogJuiceController';

test('MUTDOG_SHEET_FRAMES contains 16 valid frames within 1024x1024 bounds with valid anchors and VFX origins', () => {
  assert.equal(MUTDOG_SHEET_FRAMES.length, 16);
  for (let i = 0; i < MUTDOG_SHEET_FRAMES.length; i++) {
    const f = MUTDOG_SHEET_FRAMES[i];
    assert.ok(f.x >= 0 && f.y >= 0);
    assert.ok(f.x + f.w <= MUTDOG_SHEET_WIDTH, `Frame ${f.id} exceeds width`);
    assert.ok(f.y + f.h <= MUTDOG_SHEET_HEIGHT, `Frame ${f.id} exceeds height`);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h);
    assert.ok(f.lureOriginRel.dy < 0, `Frame ${f.id} lureOriginRel should be above ground`);
    assert.ok(f.mawOriginRel.dy < 0, `Frame ${f.id} mawOriginRel should be above ground`);
  }
});

test('stepMutdogJuice covers idle panting, Frenzy Howl, Savage Maul, Feral Pounce, primed postures, stagger, and death collapse with crisp cuts', () => {
  const idleSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 0.35, DEFAULT_MUTDOG_JUICE_CONFIG, {
    instanceIndex: 0,
  });
  assert.equal(idleSample.mode, 'idle');
  assert.ok([0, 1, 2, 3].includes(idleSample.frameIndex));
  assert.equal(idleSample.frameBlendAlpha, 1);

  const howlSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 1.2, DEFAULT_MUTDOG_JUICE_CONFIG, {
    bristleTimer: 0.44,
    bristleDuration: 0.74,
    instanceIndex: 0,
  });
  assert.equal(howlSample.mode, 'howl');
  assert.equal(howlSample.frameIndex, 4);
  assert.equal(howlSample.lureGlowIntensity, 1.0);
  assert.equal(howlSample.frameBlendAlpha, 1);

  const airMaulSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 2.0, DEFAULT_MUTDOG_JUICE_CONFIG, {
    attackAnimTimer: 0.46,
    attackAnimDuration: 0.72,
    mutdogAttackKind: 'maul',
    instanceIndex: 0,
  });
  assert.equal(airMaulSample.mode, 'pounceMaul');
  assert.equal(airMaulSample.frameIndex, 9);
  assert.ok(airMaulSample.hopYPx < -12, 'Airborne Savage Maul should leap upward before slam');

  const slamImpactSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 2.2, DEFAULT_MUTDOG_JUICE_CONFIG, {
    attackAnimTimer: 0.24,
    attackAnimDuration: 0.72,
    mutdogAttackKind: 'maul',
    instanceIndex: 0,
  });
  assert.equal(slamImpactSample.mode, 'pounceMaul');
  assert.equal(slamImpactSample.frameIndex, 10);
  assert.ok(slamImpactSample.pounceImpactProgress > 0.2);
  assert.ok(slamImpactSample.clawSlashProgress > 0.1);

  const clawRendSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 3.0, DEFAULT_MUTDOG_JUICE_CONFIG, {
    attackAnimTimer: 0.24,
    attackAnimDuration: 0.58,
    mutdogAttackKind: 'pounce',
    instanceIndex: 0,
  });
  assert.equal(clawRendSample.mode, 'clawRend');
  assert.equal(clawRendSample.frameIndex, 11);
  assert.ok(clawRendSample.clawSlashProgress > 0.2, 'Feral Pounce should emit clawSlashProgress');

  const maulPrimedSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 0.4, DEFAULT_MUTDOG_JUICE_CONFIG, {
    maulPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(maulPrimedSample.mode, 'maulPrimed');
  assert.ok([5, 6, 8].includes(maulPrimedSample.frameIndex));

  const pouncePrimedSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 0.4, DEFAULT_MUTDOG_JUICE_CONFIG, {
    pouncePrimed: true,
    instanceIndex: 0,
  });
  assert.equal(pouncePrimedSample.mode, 'pouncePrimed');
  assert.ok([2, 3, 5].includes(pouncePrimedSample.frameIndex));

  const pauseRecoverSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 0.5, DEFAULT_MUTDOG_JUICE_CONFIG, {
    pauseRecover: true,
    instanceIndex: 0,
  });
  assert.equal(pauseRecoverSample.mode, 'pauseRecover');
  assert.ok([0, 3].includes(pauseRecoverSample.frameIndex));

  const staggeredSample = stepMutdogJuice(createMutdogJuiceState(), 0.016, 4.0, DEFAULT_MUTDOG_JUICE_CONFIG, {
    staggeredStatus: true,
    instanceIndex: 0,
  });
  assert.equal(staggeredSample.mode, 'staggered');
  assert.equal(staggeredSample.frameIndex, 13);

  const deathEnd = stepMutdogJuice(createMutdogJuiceState(), 0.016, 5.0, DEFAULT_MUTDOG_JUICE_CONFIG, {
    dead: true,
    koProgress: 0.9,
    instanceIndex: 0,
  });
  assert.equal(deathEnd.mode, 'death');
  assert.equal(deathEnd.frameIndex, 15);
  assert.ok(deathEnd.alpha < 1 && deathEnd.alpha > 0);
});
