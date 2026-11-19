import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
  SPITTER_SHEET_HEIGHT,
  SPITTER_SHEET_WIDTH,
  sampleSpitterFrame,
} from './spitterSpriteSheet';

test('SPITTER_SHEET_FRAMES covers all 16 poses within sheet dimensions with valid anchors, excludeRects, and VFX origins', () => {
  assert.equal(SPITTER_SHEET_FRAMES.length, 16);
  for (let i = 0; i < SPITTER_SHEET_FRAMES.length; i++) {
    const f = SPITTER_SHEET_FRAMES[i];
    assert.ok(f.w > 0 && f.h > 0, `Frame ${i} must have positive size`);
    assert.ok(f.x >= 0 && f.y >= 0, `Frame ${i} origin must be non-negative`);
    assert.ok(f.x + f.w <= SPITTER_SHEET_WIDTH, `Frame ${i} exceeds sheet width`);
    assert.ok(f.y + f.h <= SPITTER_SHEET_HEIGHT, `Frame ${i} exceeds sheet height`);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w, `Frame ${i} anchorX must sit inside rect`);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h, `Frame ${i} bottomY must sit inside rect`);
    assert.ok(f.mouthOriginRel.dy < 0, `Frame ${i} mouth origin should sit above ground`);
    assert.ok(f.pustuleOriginRel.dy < 0, `Frame ${i} pustule origin should sit above ground`);
    if (f.excludeRects) {
      for (const er of f.excludeRects) {
        assert.ok(er.x >= 0 && er.y >= 0 && er.w > 0 && er.h > 0);
        assert.ok(er.x + er.w <= f.w && er.y + er.h <= f.h, `Frame ${i} excludeRect exceeds rect`);
      }
    }
  }
  assert.equal(SPITTER_CANONICAL_HEIGHT, 246);
});

test('sampleSpitterFrame drives idle, blightCharge, pustuleHover guard, spit, claw lunge, rupture, pain, and death', () => {
  const idleFrames = new Set<number>();
  for (let t = 0; t < 2.6; t += 0.05) {
    const s = sampleSpitterFrame(undefined, t, 0);
    assert.equal(s.mode, 'idle');
    idleFrames.add(s.frameIndex);
  }
  assert.deepEqual([...idleFrames].sort((a, b) => a - b), [0, 1]);

  const blight = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      blightPrimed: true,
    },
    0.45,
    0,
  );
  assert.equal(blight.mode, 'blightCharge');
  assert.equal(blight.frameIndex, 4);
  assert.ok(blight.pustuleGlowIntensity >= 0.65);

  const hoverGuard = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      pustuleHover: true,
    },
    0.2,
    0,
  );
  assert.equal(hoverGuard.mode, 'guard');
  assert.equal(hoverGuard.frameIndex, 10);
  assert.ok(hoverGuard.pustuleGlowIntensity >= 0.85);

  const rupturePeak = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0.38,
      bristleDuration: 0.52,
      bristleKind: 'pustule_rupture',
    },
    0.6,
    0,
  );
  assert.equal(rupturePeak.mode, 'rupture');
  assert.equal(rupturePeak.frameIndex, 12);
  assert.equal(rupturePeak.pustuleGlowIntensity, 1.0);

  const spitMid = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0.18,
      attackAnimDuration: 0.52,
      spitterAttackKind: 'spit',
    },
    1.0,
    0,
  );
  assert.equal(spitMid.mode, 'spit');
  assert.equal(spitMid.frameIndex, 6);
  assert.ok(spitMid.spitStreamProgress > 0.3 && spitMid.spitStreamProgress <= 1);

  const clawMid = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0.24,
      attackAnimDuration: 0.52,
      spitterAttackKind: 'claw',
    },
    1.0,
    0,
  );
  assert.equal(clawMid.mode, 'claw');
  assert.equal(clawMid.frameIndex, 9);
  assert.ok(clawMid.xOffsetRatio < -0.1, 'Claw Rend lunge must travel left toward heroine');

  const pain = sampleSpitterFrame(
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

  const koEnd = sampleSpitterFrame(
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

test('sampleSpitterFrame cross-dissolves smoothly across pose switches', () => {
  const first = sampleSpitterFrame(undefined, 0.02, 0, undefined, 0.016);
  assert.equal(first.frameIndex, 0);
  assert.equal(first.frameBlendAlpha, 1);

  const switchFrame = sampleSpitterFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.36,
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      pustuleHover: true,
    },
    0.04,
    0,
    first.transitionState,
    0.016,
  );
  assert.equal(switchFrame.frameIndex, 10);
  assert.equal(switchFrame.prevFrameIndex, 0);
  assert.ok(switchFrame.frameBlendAlpha > 0 && switchFrame.frameBlendAlpha < 0.5);
});
