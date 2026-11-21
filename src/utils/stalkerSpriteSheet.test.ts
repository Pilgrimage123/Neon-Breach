import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STALKER_CANONICAL_HEIGHT,
  STALKER_SHEET_FRAMES,
  STALKER_SHEET_HEIGHT,
  STALKER_SHEET_WIDTH,
  sampleStalkerFrame,
} from './stalkerSpriteSheet';

test('STALKER_SHEET_FRAMES covers all 16 poses within sheet dimensions with valid anchors and excludeRects', () => {
  assert.equal(STALKER_SHEET_FRAMES.length, 16);
  for (let i = 0; i < STALKER_SHEET_FRAMES.length; i++) {
    const f = STALKER_SHEET_FRAMES[i];
    assert.ok(f.w > 0 && f.h > 0, `Frame ${i} must have positive size`);
    assert.ok(f.x >= 0 && f.y >= 0, `Frame ${i} origin must be non-negative`);
    assert.ok(f.x + f.w <= STALKER_SHEET_WIDTH, `Frame ${i} exceeds sheet width`);
    assert.ok(f.y + f.h <= STALKER_SHEET_HEIGHT, `Frame ${i} exceeds sheet height`);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w, `Frame ${i} anchorX must sit inside rect`);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h, `Frame ${i} bottomY must sit inside rect`);
    if (f.excludeRects) {
      for (const er of f.excludeRects) {
        assert.ok(er.x >= 0 && er.y >= 0 && er.w > 0 && er.h > 0);
        assert.ok(er.x + er.w <= f.w && er.y + er.h <= f.h, `Frame ${i} excludeRect exceeds rect`);
      }
    }
  }
  assert.equal(STALKER_CANONICAL_HEIGHT, 227);
});

test('sampleStalkerFrame drives distinct fluent states for idle, ambush crouch, armored guard, bristle flare, attack lunge, pain, and death collapse', () => {
  const idleFrames = new Set<number>();
  for (let t = 0; t < 1.2; t += 0.1) {
    const s = sampleStalkerFrame(undefined, t, 0);
    assert.equal(s.mode, 'idle');
    idleFrames.add(s.frameIndex);
  }
  assert.deepEqual([...idleFrames].sort((a, b) => a - b), [0, 1, 2]);

  const ambush = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      ambushPrimed: true,
    },
    0.35,
    0,
  );
  assert.equal(ambush.mode, 'ambush');
  assert.ok(ambush.frameIndex === 2 || ambush.frameIndex === 3);
  assert.ok(ambush.spineGlowIntensity >= 0.65);

  const guard = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      armoredGuard: true,
    },
    0.2,
    0,
  );
  assert.equal(guard.mode, 'guard');
  assert.equal(guard.frameIndex, 11);

  const bristlePeak = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0.22,
      bristleDuration: 0.48,
      bristleKind: 'retaliate',
    },
    0.5,
    0,
  );
  assert.equal(bristlePeak.mode, 'bristle');
  assert.equal(bristlePeak.frameIndex, 10);
  assert.equal(bristlePeak.spineGlowIntensity, 1.0);

  const atkMid = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0.22,
      attackAnimDuration: 0.52,
    },
    1.0,
    0,
  );
  assert.equal(atkMid.mode, 'attack');
  assert.equal(atkMid.frameIndex, 6);
  assert.ok(atkMid.xOffsetRatio < -0.1, 'Lunge slash must travel left toward hero');

  const pain = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0.28,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
    },
    1.0,
    0,
  );
  assert.equal(pain.mode, 'pain');
  assert.equal(pain.frameIndex, 12);

  const koEnd = sampleStalkerFrame(
    {
      dead: true,
      koProgress: 0.9,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
    },
    1.0,
    0,
  );
  assert.equal(koEnd.mode, 'death');
  assert.equal(koEnd.frameIndex, 15);
  assert.ok(koEnd.alpha > 0 && koEnd.alpha < 1);
});

test('sampleStalkerFrame cross-dissolves smoothly across pose switches', () => {
  const first = sampleStalkerFrame(undefined, 0.02, 0, undefined, 0.016);
  assert.equal(first.frameIndex, 0);
  assert.equal(first.frameBlendAlpha, 1);

  const switchFrame = sampleStalkerFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      armoredGuard: true,
    },
    0.04,
    0,
    first.transitionState,
    0.016,
  );
  assert.equal(switchFrame.frameIndex, 11);
  assert.equal(switchFrame.prevFrameIndex, 0);
  assert.ok(switchFrame.frameBlendAlpha > 0 && switchFrame.frameBlendAlpha < 0.5);
});
