import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseJuiceTrigger,
  applyFeralNurseSquash,
  createFeralNurseJuiceState,
  stepFeralNurseJuice,
  triggerFeralNurseJuiceState,
} from './feralNurseJuiceController';

test('Layer 1: Feral Nurse spring squash-and-stretch oscillates smoothly and settles back to (1,1)', () => {
  const state = createFeralNurseJuiceState();
  applyFeralNurseSquash(state, 1.28, 0.75, 1.0, -1.2);
  assert.equal(state.springScaleX, 1.28);

  let maxScaleX = 0;
  let minScaleY = 2;
  for (let i = 0; i < 90; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    maxScaleX = Math.max(maxScaleX, s.springScaleX);
    minScaleY = Math.min(minScaleY, s.springScaleY);
  }
  assert.ok(maxScaleX > 1.15);
  assert.ok(minScaleY < 0.85);
  assert.ok(Math.abs(state.springScaleX - 1) < 0.03);
  assert.ok(Math.abs(state.springScaleY - 1) < 0.03);
});

test('Layer 3: Feet knot (h=0.0) stays strictly pinned at (0,0) across all 6 Feral Nurse triggers', () => {
  const triggers: FeralNurseJuiceTrigger[] = [
    'idle',
    'prowl_stalk',
    'optical_cloak',
    'pierce_strike',
    'take_hit',
    'turn_around',
  ];
  for (const trig of triggers) {
    const state = createFeralNurseJuiceState();
    triggerFeralNurseJuiceState(state, trig, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    for (let i = 0; i < 65; i++) {
      const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
      assert.equal(s.deform.feet.dx, 0, `${trig}: feet.dx must remain 0`);
      assert.equal(s.deform.feet.dy, 0, `${trig}: feet.dy must remain 0`);
      assert.equal(s.deform.feet.rotRad, 0, `${trig}: feet.rotRad must remain 0`);
      assert.equal(s.deform.feet.scaleX, 1, `${trig}: feet.scaleX must remain 1`);
    }
  }
});

test('Layer 2: Prowl Stalk cycles smoothly through upright stride frames (5..9) with crisp non-ghosted swaps, heel plants, and velocity shear', () => {
  const state = createFeralNurseJuiceState();
  // Verify Idle never jumps to deep-crouch 0 or standup 10 and never double-exposes
  const idleFrames = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    idleFrames.add(s.frameIndex);
    assert.equal(s.blendAlpha, 1, 'Idle frame swaps must be crisp with zero double-exposure');
  }
  assert.ok(idleFrames.has(1) && idleFrames.has(2) && idleFrames.has(3), 'Idle should breathe across 1, 2, and periodic hiss 3');
  assert.ok(!idleFrames.has(0) && !idleFrames.has(10), 'Idle must not snap to jarring crouch 0 or standup 10');

  triggerFeralNurseJuiceState(state, 'prowl_stalk', DEFAULT_FERAL_NURSE_JUICE_CONFIG);
  const visitedFrames = new Set<number>();
  let heelPlants = 0;
  let maxAbsShear = 0;
  let minBoundHop = 0;
  for (let i = 0; i < 100; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    visitedFrames.add(s.frameIndex);
    assert.equal(s.blendAlpha, 1, 'Prowl frame swaps must be crisp with zero double-exposure');
    if (s.heelPlantTriggered) heelPlants++;
    maxAbsShear = Math.max(maxAbsShear, Math.abs(s.shearXPx));
    if (s.frameIndex === 7) minBoundHop = Math.min(minBoundHop, s.hopYPx);
  }
  for (const frame of [5, 6, 7, 8, 9]) {
    assert.ok(visitedFrames.has(frame), `Expected 5-frame upright prowl to visit frame ${frame}`);
  }
  assert.ok(!visitedFrames.has(4), 'Upright prowl must not slam down to hand-on-floor crouch frame 4');
  assert.ok(heelPlants >= 4, `Expected >=4 heel plants, got ${heelPlants}`);
  assert.ok(maxAbsShear > 2.0, `Expected non-trivial velocity shear, got ${maxAbsShear}`);
  assert.ok(minBoundHop < -8, `Expected airborne lift on push-off frame 7, got ${minBoundHop}`);
});

test('Layer 2 & VFX: Optical Cloak executes frames 12->13->14->15 with ~25% translucency, shimmer distortion, glowing eyes, and cloakTriggered', () => {
  const state = createFeralNurseJuiceState();
  triggerFeralNurseJuiceState(state, 'optical_cloak', DEFAULT_FERAL_NURSE_JUICE_CONFIG);

  const visitedFrames = new Set<number>();
  let minAlpha = 1;
  let maxCloakIntensity = 0;
  let maxUvDistort = 0;
  let cloakTriggeredCount = 0;
  let minGlowWhileCloaked = 1;

  for (let i = 0; i < 160; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    visitedFrames.add(s.frameIndex);
    minAlpha = Math.min(minAlpha, s.alpha);
    maxCloakIntensity = Math.max(maxCloakIntensity, s.cloakIntensity);
    maxUvDistort = Math.max(maxUvDistort, s.uvDistortAmp[0]);
    if (s.cloakTriggered) cloakTriggeredCount++;
    if (s.cloakIntensity > 0.8) {
      minGlowWhileCloaked = Math.min(minGlowWhileCloaked, s.headsetGlowIntensity);
    }
  }

  for (const frame of [12, 13, 14, 15]) {
    assert.ok(visitedFrames.has(frame), `Expected Optical Cloak to visit frame ${frame}`);
  }
  assert.equal(cloakTriggeredCount, 1);
  assert.ok(minAlpha <= 0.30, `Expected translucent optical-camo alpha <= 0.30, got ${minAlpha}`);
  assert.ok(maxCloakIntensity > 0.9);
  assert.ok(maxUvDistort > 0.005);
  assert.ok(minGlowWhileCloaked >= 0.9, 'Glowing magenta headset & eyes must stay bright while cloaked');
});

test('Layer 2 & VFX: Prepare + 7-Pierce Strike executes coiled frames 16..27, torpedo leap, slash progress, and pierceImpactTriggered', () => {
  const state = createFeralNurseJuiceState();
  triggerFeralNurseJuiceState(state, 'pierce_strike', DEFAULT_FERAL_NURSE_JUICE_CONFIG);

  const visitedFrames = new Set<number>();
  let minHop = 0;
  let maxSlash = 0;
  let impactTriggered = 0;

  for (let i = 0; i < 90; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    visitedFrames.add(s.frameIndex);
    minHop = Math.min(minHop, s.hopYPx);
    maxSlash = Math.max(maxSlash, s.clawSlashProgress);
    if (s.pierceImpactTriggered) impactTriggered++;
  }

  for (const frame of [16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27]) {
    assert.ok(visitedFrames.has(frame), `Expected 7-Pierce Strike to visit frame ${frame}`);
  }
  assert.equal(impactTriggered, 1);
  assert.ok(minHop < -20, `Expected airborne lunge arc, got ${minHop}`);
  assert.ok(maxSlash > 0.85, `Expected full triple-talon slash arc, got ${maxSlash}`);
});

test('Layer 2 & 4: Take Hit triggers flashRgba + ichorBurst, and Turn Around executes non-degenerate 2.5D flip', () => {
  const state = createFeralNurseJuiceState();
  triggerFeralNurseJuiceState(state, 'take_hit', DEFAULT_FERAL_NURSE_JUICE_CONFIG);
  let sawFlash = false;
  let ichorCount = 0;
  for (let i = 0; i < 40; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    if (s.flashRgba && s.flashRgba[3] > 0.1) sawFlash = true;
    if (s.ichorBurstTriggered) ichorCount++;
  }
  assert.ok(sawFlash);
  assert.equal(ichorCount, 1);

  triggerFeralNurseJuiceState(state, 'turn_around', DEFAULT_FERAL_NURSE_JUICE_CONFIG);
  let sawPositiveFacing = false;
  let sawNegativeFacing = false;
  for (let i = 0; i < 65; i++) {
    const s = stepFeralNurseJuice(state, 1 / 60, i / 60, DEFAULT_FERAL_NURSE_JUICE_CONFIG);
    assert.ok(Math.abs(s.facingScale) >= 0.04, '2.5D flip must never collapse to 0 determinant');
    if (s.facingScale > 0.5) sawPositiveFacing = true;
    if (s.facingScale < -0.5) sawNegativeFacing = true;
  }
  assert.ok(sawPositiveFacing && sawNegativeFacing);
});
