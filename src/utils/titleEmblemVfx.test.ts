import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGO_FRAME_COUNT,
  MAX_RIM_ARCS,
  PARTICLE_POOL_SIZE,
  SEQUENCE_FORWARD_END_SEC,
  SEQUENCE_HOLD_END_SEC,
  SEQUENCE_TOTAL_SEC,
  computeSolidityAlphas,
  createTitleEmblemVfxState,
  quinticEase,
  sampleFloatingAccents,
  spawnRimArc,
  spawnZoneParticle,
  stepTitleEmblemVfx,
  triggerEmblemClickBurst,
} from './titleEmblemVfx';

test('TitleEmblemVfx maintains fixed-capacity zero-GC particle pool and clamps large dt', () => {
  const state = createTitleEmblemVfxState(42);
  assert.equal(state.particles.length, PARTICLE_POOL_SIZE);
  assert.equal(state.arcs.length, MAX_RIM_ARCS);

  // Huge frame hitch (5 seconds) must be clamped to <= 0.05s and keep all values finite
  const sample = stepTitleEmblemVfx(state, 5.0, {
    targetParallaxX: 0.8,
    targetParallaxY: -0.5,
  });

  assert.equal(state.timeSec, 0.05);
  assert.equal(state.particles.length, PARTICLE_POOL_SIZE);
  assert.ok(Number.isFinite(sample.bobNormY));
  assert.ok(Number.isFinite(sample.breathScale));
  assert.ok(Number.isFinite(sample.rotateXDeg));
  assert.ok(Number.isFinite(sample.rotateYDeg));

  // Step 120 frames and verify pool size never grows
  for (let i = 0; i < 120; i++) {
    stepTitleEmblemVfx(state, 0.016, { targetParallaxX: 0.4, targetParallaxY: 0.2 });
  }
  assert.equal(state.particles.length, PARTICLE_POOL_SIZE);
  const activeCount = state.particles.filter((p) => p.active).length;
  assert.ok(activeCount >= 12, `Expected steady ambient particles, got ${activeCount}`);
});

test('Idle state stays locked on Frame 0 and never plays the 5-pose animation until clicked', () => {
  const state = createTitleEmblemVfxState(101);
  assert.equal(state.sequenceActive, false);

  // Step 5 full seconds of idle time
  for (let i = 0; i < 125; i++) {
    const sample = stepTitleEmblemVfx(state, 0.04);
    assert.equal(sample.sequence.active, false);
    assert.equal(sample.sequence.frameA, 0);
    assert.equal(sample.sequence.frameB, 0);
    assert.equal(sample.sequence.alphaA, 1);
    assert.equal(sample.sequence.alphaB, 0);
  }
});

test('Clicking the logo triggers fluent 0->1->2->3->4->hold->4->3->2->1->0 sequence with synced heart-kiss & shock particles', () => {
  const state = createTitleEmblemVfxState(2026);
  triggerEmblemClickBurst(state, 0.5, 0.5);
  assert.equal(state.sequenceActive, true);

  const visitedFrames = new Set<number>();
  let sawHeartKissParticles = false;
  let sawXenoShockParticles = false;
  let sawClimaxHold = false;
  let sawReversePhase = false;

  // Step through the entire 2.86s click timeline at 20ms intervals
  const steps = Math.ceil((SEQUENCE_TOTAL_SEC + 0.12) / 0.02);
  for (let i = 0; i < steps; i++) {
    const sample = stepTitleEmblemVfx(state, 0.02);
    const seq = sample.sequence;
    visitedFrames.add(seq.frameA);
    visitedFrames.add(seq.frameB);

    // Solidity invariant: alphaA + alphaB must always be >= 1 so the logo interior never dims
    assert.ok(
      seq.alphaA + seq.alphaB >= 0.999,
      `Cross-dissolve opacity dipped below 1.0: alphaA=${seq.alphaA}, alphaB=${seq.alphaB}`,
    );

    if (seq.active && seq.elapsed > SEQUENCE_FORWARD_END_SEC + 0.05 && seq.elapsed < SEQUENCE_HOLD_END_SEC - 0.05) {
      assert.equal(seq.frameA, 4);
      assert.equal(seq.frameB, 4);
      sawClimaxHold = true;
    }

    if (seq.active && seq.elapsed > SEQUENCE_HOLD_END_SEC + 0.1 && seq.elapsed < SEQUENCE_TOTAL_SEC - 0.05) {
      assert.ok(seq.frameA >= seq.frameB, `Expected reverse order (frameA >= frameB), got ${seq.frameA}->${seq.frameB}`);
      sawReversePhase = true;
    }

    if (state.particles.some((p) => p.active && p.zone === 'heart_kiss' && p.shape === 3)) {
      sawHeartKissParticles = true;
    }
    if (state.particles.some((p) => p.active && p.zone === 'xeno_shock')) {
      sawXenoShockParticles = true;
    }
  }

  assert.equal(visitedFrames.size, LOGO_FRAME_COUNT, 'All 5 uploaded logo frames (0..4) must be visited');
  assert.equal(sawClimaxHold, true, 'Must hold Frame 4 climax briefly');
  assert.equal(sawReversePhase, true, 'Must smoothly reverse 4->3->2->1->0 back to Frame 0');
  assert.equal(sawHeartKissParticles, true, 'Must emit synced heart-kiss particles (shape=3) on Frame 3');
  assert.equal(sawXenoShockParticles, true, 'Must emit synced Xeno shock particles on Frame 4');
  assert.equal(state.sequenceActive, false, 'Sequence must return cleanly to idle Frame 0 at completion');
});

test('quinticEase and computeSolidityAlphas provide C2-continuous non-dimming cross-dissolve weights', () => {
  assert.equal(quinticEase(0), 0);
  assert.equal(quinticEase(0.5), 0.5);
  assert.equal(quinticEase(1), 1);

  for (let u = 0; u <= 1; u += 0.05) {
    const { alphaA, alphaB } = computeSolidityAlphas(u);
    assert.ok(alphaA >= 0 && alphaA <= 1);
    assert.ok(alphaB >= 0 && alphaB <= 1);
    assert.ok(alphaA + alphaB >= 0.999, `Expected solid interior at u=${u}, got ${alphaA} + ${alphaB}`);
  }
});

test('Zone-matched emitters spawn particles in calibrated left, center, and right regions', () => {
  const state = createTitleEmblemVfxState(99);

  for (let i = 0; i < 20; i++) {
    const bio = spawnZoneParticle(state, 'bio_left');
    assert.ok(bio.nx >= -0.05 && bio.nx <= 0.36, `Bio spore nx=${bio.nx} should stay left`);
    assert.equal(bio.glowColor, '#84cc16');

    const center = spawnZoneParticle(state, 'ember_center');
    assert.ok(center.nx >= 0.22 && center.nx <= 0.76, `Center ember nx=${center.nx} should stay central`);

    const plasma = spawnZoneParticle(state, 'plasma_right');
    assert.ok(plasma.nx >= 0.65 && plasma.nx <= 1.03, `Plasma spark nx=${plasma.nx} should stay right`);
    assert.equal(plasma.shape, 1);
  }
});

test('Electric rim arcs trace calibrated XENO-PURGE PROTOCOL badge coordinates', () => {
  const state = createTitleEmblemVfxState(77);
  const bottomArc = spawnRimArc(state, 'bottom');
  const topArc = spawnRimArc(state, 'top');

  for (const arc of [bottomArc, topArc]) {
    assert.equal(arc.active, true);
    assert.ok(arc.points.length >= 4, 'Arc should have jagged subdivided waypoints');
    for (const pt of arc.points) {
      assert.ok(pt.nx >= 0.12 && pt.nx <= 0.78, `Rim arc nx=${pt.nx} out of badge bounds`);
      assert.ok(pt.ny >= 0.74 && pt.ny <= 0.96, `Rim arc ny=${pt.ny} out of badge rim band`);
    }
  }
});

test('Click burst injects recoil, shockwave, rim arcs, and multi-zone burst particles', () => {
  const state = createTitleEmblemVfxState(123);
  triggerEmblemClickBurst(state, 0.52, 0.48);

  assert.ok(state.recoil > 0.5, 'Expected positive click recoil impulse');
  assert.equal(state.shockwave.active, true);
  assert.ok(state.arcs.some((a) => a.active), 'Expected rim arc discharge on click');
  const burstParticles = state.particles.filter((p) => p.active && p.zone === 'burst');
  assert.equal(burstParticles.length, 28);

  // Recoil should smoothly damp back near zero over ~1.5s
  for (let i = 0; i < 95; i++) {
    stepTitleEmblemVfx(state, 0.016);
  }
  assert.ok(Math.abs(state.recoil) < 0.05, `Expected recoil to settle, got ${state.recoil}`);
  assert.equal(state.shockwave.active, false);
});

test('Pointer parallax converges smoothly and reducedMotion freezes kinetic motion', () => {
  const state = createTitleEmblemVfxState(314);
  for (let i = 0; i < 60; i++) {
    stepTitleEmblemVfx(state, 0.016, { targetParallaxX: 1, targetParallaxY: -1 });
  }
  assert.ok(state.parallaxX > 0.95, `Expected parallaxX near 1, got ${state.parallaxX}`);
  assert.ok(state.parallaxY < -0.95, `Expected parallaxY near -1, got ${state.parallaxY}`);

  const reduced = stepTitleEmblemVfx(state, 0.016, {
    targetParallaxX: 1,
    targetParallaxY: -1,
    reducedMotion: true,
  });
  assert.equal(reduced.bobNormY, 0);
  assert.equal(reduced.breathScale, 1);
  assert.equal(reduced.rotateXDeg, 0);
  assert.equal(reduced.rotateYDeg, 0);
  assert.equal(reduced.sheenActive, false);
  assert.equal(state.arcs.some((a) => a.active), false);
});

test('sampleFloatingAccents returns legacy orbital poses deterministically', () => {
  const accentsT0 = sampleFloatingAccents(0, 0, 0, false);
  const accentsT1 = sampleFloatingAccents(0.65, 0.5, -0.3, false);

  assert.equal(accentsT0.length, 4);
  const droneRight = accentsT0.find((a) => a.kind === 'drone_strike');
  const larvaLeft = accentsT0.find((a) => a.kind === 'xeno_larva');
  assert.ok(droneRight && droneRight.nx > 1.0);
  assert.ok(larvaLeft && larvaLeft.nx < 0.0);

  const larvaLater = accentsT1.find((a) => a.kind === 'xeno_larva');
  assert.ok(larvaLater && larvaLater.ny !== larvaLeft.ny);
});
