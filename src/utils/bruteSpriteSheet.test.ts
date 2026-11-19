import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRUTE_SHEET_FRAMES,
  BRUTE_SHEET_HEIGHT,
  BRUTE_SHEET_WIDTH,
  sampleBruteFrame,
} from './bruteSpriteSheet';

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

test('sampleBruteFrame covers idle ping-pong, Mutagen Brace, Seismic Heavy Smash, Maw Claw, Stagger, and Collapse cleanly', () => {
  const idleSample = sampleBruteFrame(undefined, 0.35, 0);
  assert.equal(idleSample.mode, 'idle');
  assert.ok([0, 1, 2, 3].includes(idleSample.frameIndex));

  const braceSample = sampleBruteFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0.42,
      bristleDuration: 0.72,
      bristleKind: 'armor',
    },
    1.2,
    0,
  );
  assert.equal(braceSample.mode, 'brace');
  assert.equal(braceSample.frameIndex, 5);
  assert.equal(braceSample.vialGlowIntensity, 1.0);

  const airSmashSample = sampleBruteFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.46,
      attackAnimDuration: 0.74,
      bruteAttackKind: 'heavy',
    },
    2.0,
    0,
  );
  assert.equal(airSmashSample.mode, 'heavySmash');
  assert.equal(airSmashSample.frameIndex, 9);
  assert.ok(airSmashSample.yHopPx < -8, 'Airborne smash should leap upward before impact');

  const groundImpactSample = sampleBruteFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.25,
      attackAnimDuration: 0.74,
      bruteAttackKind: 'heavy',
    },
    2.2,
    0,
  );
  assert.equal(groundImpactSample.mode, 'heavySmash');
  assert.equal(groundImpactSample.frameIndex, 10);
  assert.ok(groundImpactSample.shockwaveIntensity > 0.2);

  const clawMawSample = sampleBruteFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.30,
      attackAnimDuration: 0.58,
      bruteAttackKind: 'attack',
    },
    3.0,
    0,
  );
  assert.equal(clawMawSample.mode, 'clawMaw');
  assert.equal(clawMawSample.frameIndex, 11);

  const staggeredSample = sampleBruteFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      staggered: true,
    },
    4.0,
    0,
  );
  assert.equal(staggeredSample.mode, 'staggered');
  assert.equal(staggeredSample.frameIndex, 13);

  const deathEnd = sampleBruteFrame(
    {
      dead: true,
      koProgress: 0.9,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
    },
    5.0,
    0,
  );
  assert.equal(deathEnd.mode, 'death');
  assert.equal(deathEnd.frameIndex, 15);
  assert.ok(deathEnd.alpha < 1 && deathEnd.alpha > 0);
});
