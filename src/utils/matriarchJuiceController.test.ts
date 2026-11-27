import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MATRIARCH_RUPTURE_DURATION_SEC,
  createMatriarchJuiceState,
  stepMatriarchJuice,
} from './matriarchJuiceController';

test('Matriarch Phase 1 idle uses Frame 0, locks feet at 0, and keeps idle UV distortion strictly [0, 0]', () => {
  const state = createMatriarchJuiceState(101);
  let t = 0;
  for (let i = 0; i < 60; i++) {
    t += 0.016;
    const sample = stepMatriarchJuice(state, 0.016, t, { hp: 120, maxHp: 120 });
    assert.equal(sample.mode, 'idle');
    assert.equal(sample.frameIndex, 0);
    assert.equal(sample.frameBlendAlpha, 1);
    assert.equal(sample.isBackExploded, false);
    assert.equal(sample.backExplosionTriggered, false);
    assert.deepEqual(sample.uvDistortAmp, [0, 0]);
    assert.equal(sample.deform.feet.dx, 0);
    assert.equal(sample.deform.feet.dy, 0);
    assert.equal(sample.deform.feet.rotRad, 0);
    assert.equal(sample.deform.feet.scaleX, 1);
  }
});

test('Matriarch back explodes once when crossing <= 50% maxHp, enters rupture state, then settles into Frame 1', () => {
  const state = createMatriarchJuiceState(202);

  // Above 50% HP: intact Frame 0
  const sAbove = stepMatriarchJuice(state, 0.016, 0.5, { hp: 61, maxHp: 120 });
  assert.equal(sAbove.frameIndex, 0);
  assert.equal(sAbove.backExplosionTriggered, false);
  assert.equal(sAbove.mode, 'idle');

  // Drop to exactly 50% maxHp (60 / 120): triggers explosion ONCE!
  const sTrigger = stepMatriarchJuice(state, 0.016, 0.516, { hp: 60, maxHp: 120 });
  assert.equal(sTrigger.frameIndex, 1);
  assert.equal(sTrigger.frameBlendAlpha, 1);
  assert.equal(sTrigger.isBackExploded, true);
  assert.equal(sTrigger.backExplosionTriggered, true);
  assert.equal(sTrigger.mode, 'rupture');
  assert.ok(sTrigger.flashRgba !== null);
  assert.ok(sTrigger.uvDistortAmp[0] > 0);
  assert.ok(sTrigger.nozzles[0].id.startsWith('exp_'));

  // Subsequent ticks during rupture do NOT re-fire backExplosionTriggered
  const sMidRupture = stepMatriarchJuice(state, 0.04, 0.556, { hp: 60, maxHp: 120 });
  assert.equal(sMidRupture.backExplosionTriggered, false);
  assert.equal(sMidRupture.mode, 'rupture');
  assert.equal(sMidRupture.frameIndex, 1);
  assert.ok(sMidRupture.ruptureProgress > 0 && sMidRupture.ruptureProgress < 1);

  // Advance past rupture duration -> settles into Phase 2 enraged idle (Frame 1, [0, 0] UV distort)
  let t = 0.556;
  let last = sMidRupture;
  for (let i = 0; i < Math.ceil(MATRIARCH_RUPTURE_DURATION_SEC / 0.04) + 2; i++) {
    t += 0.04;
    last = stepMatriarchJuice(state, 0.04, t, { hp: 55, maxHp: 120 });
  }
  assert.equal(last.mode, 'idle');
  assert.equal(last.frameIndex, 1);
  assert.equal(last.isBackExploded, true);
  assert.equal(last.backExplosionTriggered, false);
  assert.deepEqual(last.uvDistortAmp, [0, 0]);
  assert.equal(last.deform.feet.dx, 0);
  assert.equal(last.deform.feet.dy, 0);
});

test('Matriarch resets cleanly to intact Frame 0 if Undo/Heal restores HP above 50% maxHp', () => {
  const state = createMatriarchJuiceState(303);
  stepMatriarchJuice(state, 0.016, 0.2, { hp: 40, maxHp: 100 });
  assert.equal(state.wasBackExploded, true);

  const restored = stepMatriarchJuice(state, 0.016, 0.216, { hp: 80, maxHp: 100 });
  assert.equal(restored.frameIndex, 0);
  assert.equal(restored.isBackExploded, false);
  assert.equal(restored.mode, 'idle');
  assert.ok(restored.nozzles[0].id.startsWith('intact_'));
});

test('Matriarch attack lunges left (-offsetX), pain recoils right (+head.dx), and dt=0 freezes state', () => {
  const state = createMatriarchJuiceState(404);

  // Mid-lunge attack (p ~ 0.45)
  let lungeSample = stepMatriarchJuice(state, 0.016, 0.1, {
    hp: 100,
    maxHp: 100,
    attackAnimTimer: 0.34,
    attackAnimDuration: 0.62,
  });
  for (let i = 0; i < 6; i++) {
    lungeSample = stepMatriarchJuice(state, 0.016, 0.1 + i * 0.016, {
      hp: 100,
      maxHp: 100,
      attackAnimTimer: 0.32 - i * 0.01,
      attackAnimDuration: 0.62,
    });
  }
  assert.equal(lungeSample.mode, 'attack');
  assert.ok(lungeSample.offsetX < -20, `expected leftward lunge, got offsetX=${lungeSample.offsetX}`);
  assert.ok(lungeSample.clawSlashProgress > 0);

  // Pain recoil (native left-facing: +dx pulls head back right)
  const painSample = stepMatriarchJuice(state, 0.016, 1.0, {
    hp: 80,
    maxHp: 100,
    staggerTimer: 0.25,
    staggerDuration: 0.42,
  });
  assert.equal(painSample.mode, 'pain');
  assert.ok(painSample.deform.head.dx > 5, `expected rightward head recoil, got ${painSample.deform.head.dx}`);

  // dt === 0 freeze does not advance timers or mutate wasBackExploded
  const beforeTimer = state.nozzles[0].timer;
  const frozen = stepMatriarchJuice(state, 0, 1.0, { hp: 30, maxHp: 100 });
  assert.equal(state.nozzles[0].timer, beforeTimer);
  assert.equal(frozen.backExplosionTriggered, false);
});
