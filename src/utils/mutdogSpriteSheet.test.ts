import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MUTDOG_SHEET_FRAMES,
  MUTDOG_SHEET_HEIGHT,
  MUTDOG_SHEET_WIDTH,
  sampleMutdogFrame,
} from './mutdogSpriteSheet';

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

test('sampleMutdogFrame covers idle panting, Frenzy Howl, Savage Maul, Feral Pounce, primed postures, stagger, and death collapse', () => {
  const idleSample = sampleMutdogFrame(undefined, 0.35, 0);
  assert.equal(idleSample.mode, 'idle');
  assert.ok([0, 1, 2, 3].includes(idleSample.frameIndex));

  const howlSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
      bristleTimer: 0.44,
      bristleDuration: 0.74,
    },
    1.2,
    0,
  );
  assert.equal(howlSample.mode, 'howl');
  assert.equal(howlSample.frameIndex, 4);
  assert.equal(howlSample.lureGlowIntensity, 1.0);

  const airMaulSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.46,
      attackAnimDuration: 0.72,
      mutdogAttackKind: 'maul',
    },
    2.0,
    0,
  );
  assert.equal(airMaulSample.mode, 'pounceMaul');
  assert.equal(airMaulSample.frameIndex, 9);
  assert.ok(airMaulSample.yHopPx < -12, 'Airborne Savage Maul should leap upward before slam');

  const slamImpactSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.24,
      attackAnimDuration: 0.72,
      mutdogAttackKind: 'maul',
    },
    2.2,
    0,
  );
  assert.equal(slamImpactSample.mode, 'pounceMaul');
  assert.equal(slamImpactSample.frameIndex, 10);
  assert.ok(slamImpactSample.pounceImpactIntensity > 0.2);
  assert.ok(slamImpactSample.clawSlashProgress > 0.1);

  const clawRendSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.24,
      attackAnimDuration: 0.58,
      mutdogAttackKind: 'pounce',
    },
    3.0,
    0,
  );
  assert.equal(clawRendSample.mode, 'clawRend');
  assert.equal(clawRendSample.frameIndex, 11);
  assert.ok(clawRendSample.clawSlashProgress > 0.2, 'Feral Pounce should emit clawSlashProgress');

  // Distinct 3-beat intent postures
  const maulPrimedSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
      maulPrimed: true,
    },
    0.4,
    0,
  );
  assert.equal(maulPrimedSample.mode, 'maulPrimed');
  assert.ok([5, 6, 8].includes(maulPrimedSample.frameIndex));

  const pouncePrimedSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
      pouncePrimed: true,
    },
    0.4,
    0,
  );
  assert.equal(pouncePrimedSample.mode, 'pouncePrimed');
  assert.ok([2, 3, 5].includes(pouncePrimedSample.frameIndex));

  const pauseRecoverSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
      pauseRecover: true,
    },
    0.5,
    0,
  );
  assert.equal(pauseRecoverSample.mode, 'pauseRecover');
  assert.ok([0, 3].includes(pauseRecoverSample.frameIndex));

  const staggeredSample = sampleMutdogFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
      staggered: true,
    },
    4.0,
    0,
  );
  assert.equal(staggeredSample.mode, 'staggered');
  assert.equal(staggeredSample.frameIndex, 13);

  const deathEnd = sampleMutdogFrame(
    {
      dead: true,
      koProgress: 0.9,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.58,
    },
    5.0,
    0,
  );
  assert.equal(deathEnd.mode, 'death');
  assert.equal(deathEnd.frameIndex, 15);
  assert.ok(deathEnd.alpha < 1 && deathEnd.alpha > 0);
});
