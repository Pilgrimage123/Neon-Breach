import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STALKER_CANONICAL_HEIGHT,
  STALKER_SHEET_FRAMES,
  STALKER_SHEET_HEIGHT,
  STALKER_SHEET_WIDTH,
  STALKER_SLIME_NOZZLES,
  computeStalkerBlinkState,
} from './stalkerSpriteSheet';
import {
  createStalkerJuiceState,
  stepStalkerJuice,
} from './stalkerJuiceController';

test('STALKER_SHEET_FRAMES defines both 512x512 native-left frames with valid landmarks and slime nozzles', () => {
  assert.equal(STALKER_SHEET_FRAMES.length, 2);
  assert.equal(STALKER_SHEET_WIDTH, 512);
  assert.equal(STALKER_SHEET_HEIGHT, 512);
  assert.equal(STALKER_CANONICAL_HEIGHT, 460);

  for (let i = 0; i < STALKER_SHEET_FRAMES.length; i++) {
    const f = STALKER_SHEET_FRAMES[i];
    assert.equal(f.x, 0);
    assert.equal(f.y, 0);
    assert.equal(f.w, STALKER_SHEET_WIDTH);
    assert.equal(f.h, STALKER_SHEET_HEIGHT);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w, `Frame ${i} anchorX must sit inside rect`);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h, `Frame ${i} bottomY must sit inside rect`);
    assert.ok(f.eyeOriginRel.dx < 0 && f.eyeOriginRel.dy < 0, 'Native left-facing eye must be up-left of foot anchor');
    assert.ok(f.jawOriginRel.dx < 0 && f.jawOriginRel.dy < 0);
    assert.ok(f.clawOriginRel.dx < 0 && f.clawOriginRel.dy < 0);
  }

  assert.ok(STALKER_SLIME_NOZZLES.length >= 6, 'Stalker must expose multiple calibrated slime drip nozzles');
  for (const n of STALKER_SLIME_NOZZLES) {
    assert.ok(n.baseRadius > 0 && n.maxStretchPx > 10 && n.baseIntervalSec > 0.5);
    assert.ok(n.dy < 0, `Nozzle ${n.id} must sit above the bridge deck`);
  }
});

test('computeStalkerBlinkState performs natural periodic single & double blinks in idle and narrows eye in combat poses', () => {
  let sawOpen = false;
  let sawBlinkingFrame = false;
  let maxBlinkClosure = 0;
  let blinkEpisodes = 0;
  let prevBlinking = false;

  for (let t = 0; t < 6.5; t += 0.02) {
    const b = computeStalkerBlinkState(t, 0, 'idle');
    if (b.frameIndex === 0 && !b.isBlinking) sawOpen = true;
    if (b.frameIndex === 1 && b.isBlinking) sawBlinkingFrame = true;
    if (b.blinkClosure > maxBlinkClosure) maxBlinkClosure = b.blinkClosure;
    if (b.isBlinking && !prevBlinking) blinkEpisodes++;
    prevBlinking = b.isBlinking;
  }

  assert.equal(sawOpen, true, 'Idle must display open-eye frame 0 between blinks');
  assert.equal(sawBlinkingFrame, true, 'Idle must switch to narrowed-eye frame 1 during blinks');
  assert.ok(maxBlinkClosure > 0.85, `Blink apex closure must peak cleanly, got ${maxBlinkClosure}`);
  assert.ok(blinkEpisodes >= 3, `Expected multiple blink pulses (including double-blink), got ${blinkEpisodes}`);

  assert.equal(computeStalkerBlinkState(0.5, 0, 'ambush').frameIndex, 1);
  assert.equal(computeStalkerBlinkState(0.5, 0, 'attack', 0.5).frameIndex, 1);
  assert.equal(computeStalkerBlinkState(0.5, 0, 'bristle', 0.5).frameIndex, 1);
  assert.equal(computeStalkerBlinkState(0.5, 0, 'pain', 0.2).frameIndex, 1);
  assert.ok(computeStalkerBlinkState(0.5, 0, 'pain', 0.2).blinkClosure > 0.5);
});

test('stepStalkerJuice drives distinct states and smooth eyelid blink cross-dissolve', () => {
  const ambush = stepStalkerJuice(createStalkerJuiceState(), 0.016, 0.35, {
    ambushPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(ambush.mode, 'ambush');
  assert.equal(ambush.frameIndex, 1);
  assert.ok(ambush.spineGlowIntensity >= 0.65);

  const guard = stepStalkerJuice(createStalkerJuiceState(), 0.016, 0.2, {
    armoredGuard: true,
    instanceIndex: 0,
  });
  assert.equal(guard.mode, 'guard');

  const bristlePeak = stepStalkerJuice(createStalkerJuiceState(), 0.016, 0.5, {
    bristleTimer: 0.24,
    bristleDuration: 0.48,
    bristleKind: 'retaliate',
    instanceIndex: 0,
  });
  assert.equal(bristlePeak.mode, 'bristle');
  assert.equal(bristlePeak.frameIndex, 1);
  assert.equal(bristlePeak.spineGlowIntensity, 1.0);

  const atkMid = stepStalkerJuice(createStalkerJuiceState(), 0.016, 1.0, {
    attackAnimTimer: 0.22,
    attackAnimDuration: 0.52,
    instanceIndex: 0,
  });
  assert.equal(atkMid.mode, 'attack');
  assert.equal(atkMid.frameIndex, 1);
  assert.ok(atkMid.offsetX < -30, 'Lunge slash must travel left toward hero');
  assert.ok(atkMid.clawSlashProgress > 0.3);

  const pain = stepStalkerJuice(createStalkerJuiceState(), 0.016, 1.0, {
    staggerTimer: 0.28,
    staggerDuration: 0.36,
    instanceIndex: 0,
  });
  assert.equal(pain.mode, 'pain');
  assert.equal(pain.frameIndex, 1);

  const koEnd = stepStalkerJuice(createStalkerJuiceState(), 0.016, 1.0, {
    dead: true,
    koProgress: 0.9,
    instanceIndex: 0,
  });
  assert.equal(koEnd.mode, 'death');
  assert.equal(koEnd.frameIndex, 1);
  assert.ok(koEnd.alpha > 0 && koEnd.alpha < 1);

  // Allowlist #2: identical-silhouette open -> narrowed eye transition cross-dissolves smoothly
  const blinkState = createStalkerJuiceState();
  const openSample = stepStalkerJuice(blinkState, 0.016, 0.05, { instanceIndex: 0 });
  assert.equal(openSample.frameIndex, 0);
  assert.equal(openSample.frameBlendAlpha, 1);

  const switchSample = stepStalkerJuice(blinkState, 0.016, 0.07, {
    ambushPrimed: true,
    instanceIndex: 0,
  });
  assert.equal(switchSample.frameIndex, 1);
  assert.equal(switchSample.prevFrameIndex, 0);
  assert.ok(switchSample.frameBlendAlpha > 0 && switchSample.frameBlendAlpha < 0.5);
});
