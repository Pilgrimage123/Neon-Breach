import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BRUTE_JUICE_CONFIG,
  applyBruteSquash,
  createBruteJuiceState,
  stepBruteJuice,
  triggerBruteJuiceState,
} from './bruteJuiceController';

test('Layer 2: Heavy damped harmonic spring settles squash-and-stretch impulse back to (1, 1)', () => {
  const state = createBruteJuiceState();
  applyBruteSquash(state, 1.32, 0.72);
  assert.ok(state.springScaleX > 1.3);
  assert.ok(state.springScaleY < 0.75);

  let sample = stepBruteJuice(state, 0.016, 0.016, DEFAULT_BRUTE_JUICE_CONFIG);
  for (let i = 0; i < 65; i++) {
    sample = stepBruteJuice(state, 0.016, (i + 2) * 0.016, DEFAULT_BRUTE_JUICE_CONFIG);
  }
  assert.ok(Math.abs(sample.springScaleX - 1) < 0.015);
  assert.ok(Math.abs(sample.springScaleY - 1) < 0.015);
});

test('Layer 1 & 3: All 6 combat triggers keep foot knot (h=0) strictly pinned at zero displacement', () => {
  const triggers = [
    'idle',
    'stomp_walk',
    'seismic_smash',
    'mutagen_brace',
    'take_hit',
    'turn_around',
  ] as const;

  for (const trig of triggers) {
    const state = createBruteJuiceState();
    triggerBruteJuiceState(state, trig, DEFAULT_BRUTE_JUICE_CONFIG);
    for (let step = 0; step < 20; step++) {
      const s = stepBruteJuice(state, 0.02, step * 0.02, DEFAULT_BRUTE_JUICE_CONFIG);
      assert.equal(s.deform.feet.dx, 0, `Feet dx must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.dy, 0, `Feet dy must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.rotRad, 0, `Feet rotRad must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.scaleX, 1, `Feet scaleX must remain 1 during ${trig}`);
    }
  }
});

test('Layer 2: Stomp Walk drives hop, tilt, velocity shear, and footPlantTriggered edges', () => {
  const state = createBruteJuiceState();
  triggerBruteJuiceState(state, 'stomp_walk', DEFAULT_BRUTE_JUICE_CONFIG);

  let maxAbsShear = 0;
  let minHopY = 0;
  let maxAbsRot = 0;
  let footPlants = 0;
  for (let i = 0; i < 40; i++) {
    const s = stepBruteJuice(state, 0.02, i * 0.02, DEFAULT_BRUTE_JUICE_CONFIG);
    maxAbsShear = Math.max(maxAbsShear, Math.abs(s.shearXPx));
    minHopY = Math.min(minHopY, s.hopYPx);
    maxAbsRot = Math.max(maxAbsRot, Math.abs(s.rotationRad));
    if (s.footPlantTriggered) footPlants += 1;
    assert.equal(s.uvDistortAmp[0], 0, 'Walk must not apply UV jelly distortion');
  }

  assert.ok(maxAbsShear > 0.5, 'Stomp stride should generate velocity skew/shear');
  assert.ok(minHopY < -2, 'Stomp stride should hop upward (negative Y)');
  assert.ok(maxAbsRot > 0.01, 'Stomp stride should oscillate tilt rotation');
  assert.ok(footPlants >= 1, 'Stomp stride should emit at least one footPlantTriggered landing event');
});

test('Layer 2 & VFX: Seismic Smash executes frames 8->9->10->11, leap arc, slam squash, shockwave & seismicImpactTriggered without UV jelly', () => {
  const state = createBruteJuiceState();
  triggerBruteJuiceState(state, 'seismic_smash', DEFAULT_BRUTE_JUICE_CONFIG);

  const seenFrames = new Set<number>();
  let minHopY = 0;
  let maxShockwave = 0;
  let impactEdges = 0;
  let slamSquashX = 1;
  let slamSquashY = 1;

  for (let i = 1; i <= 54; i++) {
    const s = stepBruteJuice(state, 0.02, i * 0.02, DEFAULT_BRUTE_JUICE_CONFIG);
    seenFrames.add(s.frameIndex);
    minHopY = Math.min(minHopY, s.hopYPx);
    maxShockwave = Math.max(maxShockwave, s.shockwaveIntensity);
    if (s.seismicImpactTriggered) {
      impactEdges += 1;
      slamSquashX = s.springScaleX;
      slamSquashY = s.springScaleY;
    }
    assert.equal(s.uvDistortAmp[0], 0, 'Seismic Smash must never apply jelly UV wobble');
  }

  assert.ok(seenFrames.has(8) && seenFrames.has(9) && seenFrames.has(10) && seenFrames.has(11));
  assert.ok(minHopY < -20, 'Airborne peak should lift Brute upward');
  assert.equal(impactEdges, 1, 'Seismic impact rising edge must fire exactly once');
  assert.ok(slamSquashX > 1.2 && slamSquashY < 0.8, 'Slam impact should compress spring vertically');
  assert.ok(maxShockwave > 0.85, 'Slam phase should drive strong shockwave intensity');
});

test('Layer 3 & VFX: Mutagen Brace drives frames 4->5->6->7, vialShatterTriggered edge, mist progress & controlled dorsal flare', () => {
  const state = createBruteJuiceState();
  triggerBruteJuiceState(state, 'mutagen_brace', DEFAULT_BRUTE_JUICE_CONFIG);

  const seenFrames = new Set<number>();
  let shatterEdges = 0;
  let maxMist = 0;
  let maxShellGlow = 0;
  let maxVialGlow = 0;
  let sawControlledDistort = false;

  for (let i = 1; i <= 60; i++) {
    const s = stepBruteJuice(state, 0.02, i * 0.02, DEFAULT_BRUTE_JUICE_CONFIG);
    seenFrames.add(s.frameIndex);
    if (s.vialShatterTriggered) shatterEdges += 1;
    maxMist = Math.max(maxMist, s.mutagenMistProgress);
    maxShellGlow = Math.max(maxShellGlow, s.shellGlowIntensity);
    maxVialGlow = Math.max(maxVialGlow, s.vialGlowIntensity);
    if (s.uvDistortAmp[0] > 0) {
      sawControlledDistort = true;
      assert.ok(s.uvDistortFreq <= 12, 'Flare distortion frequency must stay gentle (<= 12 rad/s)');
    }
  }

  assert.ok(seenFrames.has(4) && seenFrames.has(5) && seenFrames.has(6) && seenFrames.has(7));
  assert.equal(shatterEdges, 1, 'Vial shatter edge should fire once when Brute crushes vials');
  assert.ok(maxMist > 0.85, 'Mutagen brace should emit full mutagen mist progress');
  assert.ok(maxVialGlow > 0.95 && maxShellGlow > 0.95);
  assert.ok(sawControlledDistort, 'Dorsal flare phase should drive gentle UV heat shimmer');
});

test('Layer 3 & 4: Take Hit & Weapon-Break emit chitinShardTriggered, hit-flash, and backward S-curve recoil', () => {
  const state = createBruteJuiceState();
  triggerBruteJuiceState(state, 'take_hit', DEFAULT_BRUTE_JUICE_CONFIG);

  const s = stepBruteJuice(state, 0.05, 0.05, DEFAULT_BRUTE_JUICE_CONFIG);
  assert.ok(s.chitinShardTriggered, 'Take Hit should emit chitinShardTriggered');
  assert.ok(s.flashRgba !== null && s.flashRgba[3] > 0.3, 'Take Hit should activate hit-flash uniform');
  assert.ok(s.deform.head.dx < -3, 'Take Hit should whip head backward');
  assert.equal(s.frameIndex, 12, 'Take Hit should swap to frame 12 (pain recoil)');

  // Weapon-Break edge detection during combatSync
  const combatState = createBruteJuiceState();
  const beforeBreak = stepBruteJuice(combatState, 0.02, 0.02, DEFAULT_BRUTE_JUICE_CONFIG, {
    weaponBroken: false,
  });
  assert.equal(beforeBreak.chitinShardTriggered, false);
  const onBreak = stepBruteJuice(combatState, 0.02, 0.04, DEFAULT_BRUTE_JUICE_CONFIG, {
    weaponBroken: true,
  });
  assert.equal(onBreak.chitinShardTriggered, true, 'Weapon-Break transition should fire chitin shard burst');
});

test('Layer 2: Turn Around smoothly flips facingScale from -1 through +1 and back without degenerate zero', () => {
  const state = createBruteJuiceState();
  triggerBruteJuiceState(state, 'turn_around', DEFAULT_BRUTE_JUICE_CONFIG);

  let sawPositiveFacing = false;
  let sawMidFlipHop = false;
  for (let i = 0; i < 65; i++) {
    const s = stepBruteJuice(state, 0.02, i * 0.02, DEFAULT_BRUTE_JUICE_CONFIG);
    assert.ok(Math.abs(s.facingScale) >= 0.04, 'facingScale must never hit 0 degenerate determinant');
    if (s.facingScale > 0.85) sawPositiveFacing = true;
    if (s.hopYPx < -8) sawMidFlipHop = true;
  }

  assert.ok(sawPositiveFacing, '2.5D flip should reach positive facingScale (+1)');
  assert.ok(sawMidFlipHop, '2.5D flip should include a heavyweight vertical hop');
  assert.equal(state.baseFacingSign, -1, 'Auto-return flip should restore -1 combat facing');
});
