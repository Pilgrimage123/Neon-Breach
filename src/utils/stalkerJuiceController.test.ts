import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStalkerJuiceState,
  stepStalkerJuice,
} from './stalkerJuiceController';

test('stalkerJuiceController keeps feet strictly pinned while driving organic idle breathing, blinking, and slime drip lifecycle', () => {
  const state = createStalkerJuiceState(42);
  let sawOpen = false;
  let sawBlink = false;
  let sawActiveDrop = false;
  let sawActiveSplash = false;
  let maxHeadDx = -Infinity;
  let minHeadDx = Infinity;

  const dt = 0.025;
  for (let i = 0; i < 200; i++) {
    const sample = stepStalkerJuice(state, dt, i * dt, { instanceIndex: 0 });

    // Feet must NEVER drift off the bridge deck
    assert.equal(sample.deform.feet.dx, 0);
    assert.equal(sample.deform.feet.dy, 0);
    assert.equal(sample.deform.feet.rotRad, 0);
    assert.equal(sample.deform.feet.scaleX, 1);
    assert.equal(sample.facingScale, 1, 'Uploaded Chitin Stalker is native left-facing (+1)');

    if (sample.frameIndex === 0) sawOpen = true;
    if (sample.frameIndex === 1 && sample.isBlinking && sample.blinkClosure > 0.5) sawBlink = true;
    if (sample.drops.some((d) => d.active)) sawActiveDrop = true;
    if (sample.splashes.some((s) => s.active)) sawActiveSplash = true;

    maxHeadDx = Math.max(maxHeadDx, sample.deform.head.dx);
    minHeadDx = Math.min(minHeadDx, sample.deform.head.dx);
  }

  assert.equal(sawOpen, true, 'Idle must show wide open eye frame 0');
  assert.equal(sawBlink, true, 'Idle must execute full blinks with frame 1 + eyelid closure');
  assert.equal(sawActiveDrop, true, 'Slime nozzles must pinch off falling droplets over time');
  assert.equal(sawActiveSplash, true, 'Falling slime droplets must hit the deck and spawn splashes');
  assert.ok(maxHeadDx - minHeadDx > 8, 'Idle prowling sway must visibly animate the head/torso spline');
});

test('stalkerJuiceController drives forward pounce lunge, scythe slash arcs, pain recoil, bristle swell, and death collapse', () => {
  const state = createStalkerJuiceState(99);

  // 1) Attack pounce lunge: travels left (-offsetX), hops upward (-hopYPx), fires claw slash & slime burst
  let minOffsetX = 0;
  let minHopY = 0;
  let maxSlash = 0;
  let triggeredBurst = false;
  for (let i = 0; i < 26; i++) {
    const t = i * 0.02;
    const sample = stepStalkerJuice(state, 0.02, 1.0 + t, {
      attackAnimTimer: Math.max(0.001, 0.52 - t),
      attackAnimDuration: 0.52,
    });
    assert.equal(sample.mode, 'attack');
    assert.equal(sample.frameIndex, 1);
    minOffsetX = Math.min(minOffsetX, sample.offsetX);
    minHopY = Math.min(minHopY, sample.hopYPx);
    maxSlash = Math.max(maxSlash, sample.clawSlashProgress);
    if (sample.slimeBurstTriggered) triggeredBurst = true;
  }
  assert.ok(minOffsetX < -60, `Expected forward left lunge, got minOffsetX=${minOffsetX}`);
  assert.ok(minHopY < -20, `Expected upward pounce arc, got minHopY=${minHopY}`);
  assert.ok(maxSlash > 0.75, `Expected scythe slash progress, got ${maxSlash}`);
  assert.equal(triggeredBurst, true, 'Attack lunge must shake loose a burst of slime droplets');

  // 2) Pain recoil pulls head/torso BACK right (+dx) and narrows eye with wince
  const painSample = stepStalkerJuice(state, 0.02, 2.0, {
    staggerTimer: 0.30,
    staggerDuration: 0.38,
  });
  assert.equal(painSample.mode, 'pain');
  assert.equal(painSample.frameIndex, 1);
  assert.ok(painSample.deform.head.dx > 8, `Expected backward right recoil on left-facing stalker, got ${painSample.deform.head.dx}`);

  // 3) Bristle retaliation expands dorsal waist and maximizes spine glow
  const bristleSample = stepStalkerJuice(state, 0.02, 2.4, {
    bristleTimer: 0.24,
    bristleDuration: 0.52,
    bristleKind: 'retaliate',
  });
  assert.equal(bristleSample.mode, 'bristle');
  assert.equal(bristleSample.spineGlowIntensity, 1.0);
  assert.ok(bristleSample.deform.waist.scaleX > 1.05);

  // 4) Death flattens downward into deck while fading alpha
  const deathSample = stepStalkerJuice(state, 0.02, 3.0, {
    dead: true,
    koProgress: 0.85,
  });
  assert.equal(deathSample.mode, 'death');
  assert.ok(deathSample.deform.head.dy > 40);
  assert.ok(deathSample.alpha > 0 && deathSample.alpha < 1);
});

test('stalkerJuiceController freezes slime physics cleanly when dt is 0 (tactical view)', () => {
  const state = createStalkerJuiceState(7);
  // Advance briefly first
  stepStalkerJuice(state, 0.03, 0.5);
  const beforeTimers = state.nozzles.map((n) => n.timer);
  const beforePosX = state.horiz.posX;

  const frozen = stepStalkerJuice(state, 0, 0.5);
  assert.deepEqual(
    frozen.nozzles.map((n) => n.timer),
    beforeTimers,
  );
  assert.equal(frozen.offsetX, beforePosX);
});
