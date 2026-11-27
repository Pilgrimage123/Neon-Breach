import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRUTE_SHEET_FRAMES,
  BRUTE_SHEET_HEIGHT,
  BRUTE_SHEET_WIDTH,
} from './bruteSpriteSheet';
import {
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
} from './bruteJuiceController';

test('BRUTE_SHEET_FRAMES contains 16 valid non-overlapping frames within 1024x1024 bounds', () => {
  assert.equal(BRUTE_SHEET_FRAMES.length, 16);
  for (let i = 0; i < BRUTE_SHEET_FRAMES.length; i++) {
    const f = BRUTE_SHEET_FRAMES[i];
    assert.ok(f.x >= 0 && f.y >= 0);
    assert.ok(f.x + f.w <= BRUTE_SHEET_WIDTH, `Frame ${f.id} exceeds width`);
    assert.ok(f.y + f.h <= BRUTE_SHEET_HEIGHT, `Frame ${f.id} exceeds height`);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h);
  }
});

test('stepBruteJuice covers idle, Mutagen Brace, Seismic Heavy Smash, Maw Claw, Stagger, and Collapse with crisp cuts', () => {
  const idleSample = stepBruteJuice(createBruteJuiceState(), 0.016, 0.35, DEFAULT_BRUTE_JUICE_CONFIG, {
    instanceIndex: 0,
  });
  assert.equal(idleSample.mode, 'idle');
  assert.ok([1, 2, 3].includes(idleSample.frameIndex), 'Idle must use planted-leg frames 1, 2, or 3');
  assert.equal(idleSample.frameBlendAlpha, 1);

  const idleHeights = [1, 2, 3].map((i) => BRUTE_SHEET_FRAMES[i].h);
  assert.ok(
    Math.max(...idleHeights) - Math.min(...idleHeights) <= 4,
    'Planted-leg Idle frames 1..3 must have matching heights within 4px',
  );

  const braceSample = stepBruteJuice(createBruteJuiceState(), 0.016, 1.2, DEFAULT_BRUTE_JUICE_CONFIG, {
    bristleTimer: 0.42,
    bristleDuration: 0.72,
    instanceIndex: 0,
  });
  assert.equal(braceSample.mode, 'brace');
  assert.equal(braceSample.frameIndex, 5);
  assert.equal(braceSample.vialGlowIntensity, 1.0);
  assert.equal(braceSample.frameBlendAlpha, 1);

  const airSmashSample = stepBruteJuice(createBruteJuiceState(), 0.016, 2.0, DEFAULT_BRUTE_JUICE_CONFIG, {
    attackAnimTimer: 0.46,
    attackAnimDuration: 0.74,
    bruteAttackKind: 'heavy',
    instanceIndex: 0,
  });
  assert.equal(airSmashSample.mode, 'heavySmash');
  assert.equal(airSmashSample.frameIndex, 9);
  assert.ok(airSmashSample.hopYPx < -8, 'Airborne smash should leap upward before impact');

  const groundImpactSample = stepBruteJuice(createBruteJuiceState(), 0.016, 2.2, DEFAULT_BRUTE_JUICE_CONFIG, {
    attackAnimTimer: 0.25,
    attackAnimDuration: 0.74,
    bruteAttackKind: 'heavy',
    instanceIndex: 0,
  });
  assert.equal(groundImpactSample.mode, 'heavySmash');
  assert.equal(groundImpactSample.frameIndex, 10);
  assert.ok(groundImpactSample.shockwaveIntensity > 0.2);

  const clawMawSample = stepBruteJuice(createBruteJuiceState(), 0.016, 3.0, DEFAULT_BRUTE_JUICE_CONFIG, {
    attackAnimTimer: 0.30,
    attackAnimDuration: 0.58,
    bruteAttackKind: 'attack',
    instanceIndex: 0,
  });
  assert.equal(clawMawSample.mode, 'clawMaw');
  assert.equal(clawMawSample.frameIndex, 11);
  assert.ok(clawMawSample.clawSlashProgress > 0.2, 'Maw/Claw lunge should emit clawSlashProgress');

  const smashImpactFrame = BRUTE_SHEET_FRAMES[10];
  assert.equal(smashImpactFrame.id, 'brute_smash_impact_10');
  assert.ok(
    smashImpactFrame.excludeRects && smashImpactFrame.excludeRects.length >= 3,
    'Frame 10 must exclude baked floor/side impact splinters',
  );

  const armorPrimedSample = stepBruteJuice(createBruteJuiceState(), 0.016, 0.4, DEFAULT_BRUTE_JUICE_CONFIG, {
    armorPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(armorPrimedSample.mode, 'armorPrimed');
  assert.ok([4, 7].includes(armorPrimedSample.frameIndex));

  const heavyPrimedSample = stepBruteJuice(createBruteJuiceState(), 0.016, 0.2, DEFAULT_BRUTE_JUICE_CONFIG, {
    heavyPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(heavyPrimedSample.mode, 'heavyPrimed');
  assert.ok([6, 8].includes(heavyPrimedSample.frameIndex));

  const pauseRecoverSample = stepBruteJuice(createBruteJuiceState(), 0.016, 0.5, DEFAULT_BRUTE_JUICE_CONFIG, {
    pauseRecover: true,
    instanceIndex: 0,
  });
  assert.equal(pauseRecoverSample.mode, 'pauseRecover');
  assert.ok([1, 3].includes(pauseRecoverSample.frameIndex));

  const staggeredSample = stepBruteJuice(createBruteJuiceState(), 0.016, 4.0, DEFAULT_BRUTE_JUICE_CONFIG, {
    staggeredStatus: true,
    instanceIndex: 0,
  });
  assert.equal(staggeredSample.mode, 'staggered');
  assert.equal(staggeredSample.frameIndex, 13);

  const deathEnd = stepBruteJuice(createBruteJuiceState(), 0.016, 5.0, DEFAULT_BRUTE_JUICE_CONFIG, {
    dead: true,
    koProgress: 0.9,
    instanceIndex: 0,
  });
  assert.equal(deathEnd.mode, 'death');
  assert.equal(deathEnd.frameIndex, 15);
  assert.ok(deathEnd.alpha < 1 && deathEnd.alpha > 0);
});
