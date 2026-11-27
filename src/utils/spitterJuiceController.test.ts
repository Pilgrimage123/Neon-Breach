import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  applySpitterSquash,
  createSpitterJuiceState,
  stepSpitterJuice,
  triggerSpitterJuiceState,
} from './spitterJuiceController';

test('Layer 2: Damped harmonic spring pulls squash-and-stretch impulse back to (1, 1)', () => {
  const state = createSpitterJuiceState();
  applySpitterSquash(state, 1.32, 0.72);
  assert.ok(state.springScaleX > 1.3);
  assert.ok(state.springScaleY < 0.75);

  let sample = stepSpitterJuice(state, 0.016, 0.016, DEFAULT_SPITTER_JUICE_CONFIG);
  // After 1 second of 60fps stepping, damped harmonic spring must settle smoothly back to (1, 1)
  for (let i = 0; i < 60; i++) {
    sample = stepSpitterJuice(state, 0.016, (i + 2) * 0.016, DEFAULT_SPITTER_JUICE_CONFIG);
  }
  assert.ok(Math.abs(sample.springScaleX - 1) < 0.015);
  assert.ok(Math.abs(sample.springScaleY - 1) < 0.015);
});

test('Layer 1 & 3: All 6 combat triggers keep foot knot (h=0) pinned at zero displacement', () => {
  const triggers = [
    'idle',
    'advance_retreat',
    'attack_lunge',
    'cast_charge',
    'take_hit',
    'turn_around',
  ] as const;

  for (const trig of triggers) {
    const state = createSpitterJuiceState();
    triggerSpitterJuiceState(state, trig, DEFAULT_SPITTER_JUICE_CONFIG);
    for (let step = 0; step < 15; step++) {
      const s = stepSpitterJuice(state, 0.02, step * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
      assert.equal(s.deform.feet.dx, 0, `Feet dx must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.dy, 0, `Feet dy must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.rotRad, 0, `Feet rotRad must remain 0 during ${trig}`);
    }
  }
});

test('Layer 2: Advance/Retreat drives Walk Waddle hop, tilt, and velocity shear', () => {
  const state = createSpitterJuiceState();
  triggerSpitterJuiceState(state, 'advance_retreat', DEFAULT_SPITTER_JUICE_CONFIG);

  let maxAbsShear = 0;
  let minHopY = 0;
  let maxAbsRot = 0;
  for (let i = 0; i < 25; i++) {
    const s = stepSpitterJuice(state, 0.02, i * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
    maxAbsShear = Math.max(maxAbsShear, Math.abs(s.shearXPx));
    minHopY = Math.min(minHopY, s.hopYPx);
    maxAbsRot = Math.max(maxAbsRot, Math.abs(s.rotationRad));
    if (s.frameIndex === 1) {
      assert.equal(s.hopYPx, 0, 'Grounded contact frame F1 must remain at hopYPx === 0');
    }
  }

  assert.ok(maxAbsShear > 0.5, 'Walk advance should generate velocity skew/shear');
  assert.ok(minHopY < -2, 'Walk waddle should hop upward (negative Y)');
  assert.ok(maxAbsRot > 0.01, 'Walk waddle should oscillate tilt rotation');
});

test('Layer 2: Turn Around smoothly flips facingScale from -1 through +1 and back', () => {
  const state = createSpitterJuiceState();
  triggerSpitterJuiceState(state, 'turn_around', DEFAULT_SPITTER_JUICE_CONFIG);

  let sawPositiveFacing = false;
  let sawMidFlipHop = false;
  for (let i = 0; i < 60; i++) {
    const s = stepSpitterJuice(state, 0.02, i * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
    assert.ok(s.hopYPx <= 0, `2.5D flip must never sink below floor, got hopYPx=${s.hopYPx}`);
    if (s.facingScale > 0.85) sawPositiveFacing = true;
    if (s.hopYPx < -6) sawMidFlipHop = true;
  }

  assert.ok(sawPositiveFacing, '2.5D flip should reach positive facingScale (+1)');
  assert.ok(sawMidFlipHop, '2.5D flip should include a vertical hop');
  assert.equal(state.baseFacingSign, -1, 'Auto-return flip should restore -1 combat facing');
});

test('Layer 3 & 4: Cast/Charge stretches spine upward and ramps UV distortion', () => {
  const state = createSpitterJuiceState();
  triggerSpitterJuiceState(state, 'cast_charge', DEFAULT_SPITTER_JUICE_CONFIG);

  let s = stepSpitterJuice(state, 0.02, 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
  for (let i = 1; i <= 25; i++) {
    s = stepSpitterJuice(state, 0.02, i * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
  }

  assert.ok(s.deform.head.dy < -6, 'Cast/Charge should elongate head upward');
  assert.ok(s.deform.waist.scaleX > 1.08, 'Cast/Charge should swell waist/pustule sac');
  assert.ok(s.uvDistortAmp[0] > 0.006, 'Cast/Charge should ramp up UV wave distortion');
});

test('Layer 3 & 4: Take Hit triggers hit-flash, backward spine bend, and recoil squash', () => {
  const state = createSpitterJuiceState();
  triggerSpitterJuiceState(state, 'take_hit', DEFAULT_SPITTER_JUICE_CONFIG);

  const s = stepSpitterJuice(state, 0.05, 0.05, DEFAULT_SPITTER_JUICE_CONFIG);
  assert.ok(s.flashRgba !== null && s.flashRgba[3] > 0.3, 'Take Hit should activate hit-flash uniform');
  assert.ok(s.deform.head.dx < -3, 'Take Hit should whip head backward');
  assert.equal(s.frameIndex, 12, 'Take Hit should swap to frame 12 (pain burst)');
});

test('Attack Lunge / Spit drives smooth spitWindupProgress then spitStreamProgress without jelly UV wobble or puddle frame flicker', () => {
  const state = createSpitterJuiceState();
  triggerSpitterJuiceState(state, 'attack_lunge', DEFAULT_SPITTER_JUICE_CONFIG);

  let maxWindup = 0;
  let maxStream = 0;
  const seenFrames = new Set<number>();
  for (let i = 1; i <= 45; i++) {
    const s = stepSpitterJuice(state, 0.02, i * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
    maxWindup = Math.max(maxWindup, s.spitWindupProgress);
    maxStream = Math.max(maxStream, s.spitStreamProgress);
    seenFrames.add(s.frameIndex);
    assert.equal(s.uvDistortAmp[0], 0, 'Attack lunge should not apply jelly UV distortion to body');
  }

  assert.ok(maxWindup > 0.7, 'Windup phase should build throat bile condensation');
  assert.ok(maxStream > 0.9, 'Spit phase should drive full bile stream progress to hero');
  assert.ok(seenFrames.has(4) && seenFrames.has(5) && seenFrames.has(6), 'Spit sequence should progress through frames 4, 5, 6');

  // Verify cast_charge holds Frame 4 without toggling to Frame 3
  const chargeState = createSpitterJuiceState();
  triggerSpitterJuiceState(chargeState, 'cast_charge', DEFAULT_SPITTER_JUICE_CONFIG);
  for (let i = 1; i <= 30; i++) {
    const cs = stepSpitterJuice(chargeState, 0.02, i * 0.02, DEFAULT_SPITTER_JUICE_CONFIG);
    assert.equal(cs.frameIndex, 4, 'Cast charge must hold Frame 4 so floor puddle never blinks');
  }
});
