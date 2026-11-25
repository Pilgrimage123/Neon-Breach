import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
  SPITTER_SHEET_HEIGHT,
  SPITTER_SHEET_WIDTH,
} from './spitterSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  createSpitterJuiceState,
  stepSpitterJuice,
} from './spitterJuiceController';

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

test('stepSpitterJuice drives idle, blightCharge, pustuleHover guard, spit, claw lunge, rupture, pain, and death with crisp cuts', () => {
  const idleState = createSpitterJuiceState();
  const idleFrames = new Set<number>();
  for (let t = 0; t < 3.0; t += 0.05) {
    const s = stepSpitterJuice(idleState, 0.05, t, DEFAULT_SPITTER_JUICE_CONFIG, { instanceIndex: 0 });
    assert.equal(s.mode, 'idle');
    assert.equal(s.frameBlendAlpha, 1);
    idleFrames.add(s.frameIndex);
  }
  assert.deepEqual([...idleFrames].sort((a, b) => a - b), [0, 1]);

  const blight = stepSpitterJuice(createSpitterJuiceState(), 0.016, 0.45, DEFAULT_SPITTER_JUICE_CONFIG, {
    blightPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(blight.mode, 'blightCharge');
  assert.equal(blight.frameIndex, 4);
  assert.ok(blight.pustuleGlowIntensity >= 0.65);

  const hoverState = createSpitterJuiceState();
  const first = stepSpitterJuice(hoverState, 0.016, 0.02, DEFAULT_SPITTER_JUICE_CONFIG, { instanceIndex: 0 });
  assert.equal(first.frameIndex, 0);
  const hoverGuard = stepSpitterJuice(hoverState, 0.016, 0.04, DEFAULT_SPITTER_JUICE_CONFIG, {
    pustuleHover: true,
    instanceIndex: 0,
  });
  assert.equal(hoverGuard.mode, 'guard');
  assert.equal(hoverGuard.frameIndex, 10);
  assert.equal(hoverGuard.prevFrameIndex, 0);
  assert.equal(hoverGuard.frameBlendAlpha, 1, 'Spitter pose switches must be crisp with zero ghosting');

  const spitMid = stepSpitterJuice(createSpitterJuiceState(), 0.016, 1.0, DEFAULT_SPITTER_JUICE_CONFIG, {
    attackAnimTimer: 0.18,
    attackAnimDuration: 0.52,
    spitterAttackKind: 'spit',
    instanceIndex: 0,
  });
  assert.equal(spitMid.mode, 'spit');
  assert.equal(spitMid.frameIndex, 6);
  assert.ok(spitMid.spitStreamProgress > 0.3 && spitMid.spitStreamProgress <= 1);

  const clawMid = stepSpitterJuice(createSpitterJuiceState(), 0.05, 1.0, DEFAULT_SPITTER_JUICE_CONFIG, {
    attackAnimTimer: 0.24,
    attackAnimDuration: 0.52,
    spitterAttackKind: 'claw',
    instanceIndex: 0,
  });
  assert.equal(clawMid.mode, 'claw');
  assert.equal(clawMid.frameIndex, 9);
  assert.ok(clawMid.offsetX < -20, 'Claw Rend lunge must travel left toward hero');

  const pain = stepSpitterJuice(createSpitterJuiceState(), 0.016, 1.0, DEFAULT_SPITTER_JUICE_CONFIG, {
    staggerTimer: 0.28,
    staggerDuration: 0.36,
    instanceIndex: 0,
  });
  assert.equal(pain.mode, 'pain');
  assert.equal(pain.frameIndex, 12);

  const koEnd = stepSpitterJuice(createSpitterJuiceState(), 0.016, 1.0, DEFAULT_SPITTER_JUICE_CONFIG, {
    dead: true,
    koProgress: 0.9,
    instanceIndex: 0,
  });
  assert.equal(koEnd.mode, 'death');
  assert.equal(koEnd.frameIndex, 15);
  assert.ok(koEnd.alpha > 0 && koEnd.alpha < 1);
});
