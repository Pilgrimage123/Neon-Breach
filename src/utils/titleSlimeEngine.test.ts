import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMetaballSmoothstepThreshold,
  computeDropletStretch,
  createSlimeEngineState,
  SLIME_DROP_MAX_R,
  SLIME_DROP_MIN_R,
  SLIME_SNAP_PHASE,
  stepSlimeEngine,
  XENO_SLIME_NOZZLES,
} from './titleSlimeEngine';
import { createTitleEmblemVfxState } from './titleEmblemVfx';

test('Xeno Slime engine configures 4 staggered nozzles with periods in [2.1s, 3.4s] and jaw saliva inside bounds', () => {
  assert.equal(XENO_SLIME_NOZZLES.length, 4);
  for (const n of XENO_SLIME_NOZZLES) {
    assert.ok(n.periodSec >= 2.1 && n.periodSec <= 3.4);
  }
  const jaw = XENO_SLIME_NOZZLES[3];
  assert.ok(jaw.nx >= 0.175 && jaw.nx <= 0.245);
  assert.ok(jaw.ny >= 0.285 && jaw.ny <= 0.365);
});

test('Xeno Slime drives 3-phase necking, capillary snap satellites, volume-preserving freefall, 2.2x shock surge, and bio_left splash spores', () => {
  const vfx = createTitleEmblemVfxState();
  // Clear initial ambient particles so we can observe splash spores directly
  for (const p of vfx.particles) p.active = false;

  const slime = createSlimeEngineState();
  const nozzleRef = slime.nozzles;
  const dropletRef = slime.droplets;

  // Phase A check on nozzle 0 (starts at phase 0.12)
  stepSlimeEngine(slime, vfx, 0.05, false, false);
  const n0 = slime.nozzles[0];
  assert.ok(n0.phase < SLIME_SNAP_PHASE);
  assert.ok(n0.bulbR > SLIME_DROP_MIN_R && n0.bulbR < SLIME_DROP_MAX_R);
  assert.ok(n0.neckWaist < n0.bulbR, 'Expected neck thinning during Phase A');

  // Compare 2.2x shock speed multiplier vs normal speed
  const normalSlime = createSlimeEngineState();
  const shockedSlime = createSlimeEngineState();
  stepSlimeEngine(normalSlime, vfx, 0.05, false, false);
  stepSlimeEngine(shockedSlime, vfx, 0.05, true, false);
  const normalDelta = normalSlime.nozzles[0].phase - 0.12;
  const shockedDelta = shockedSlime.nozzles[0].phase - 0.12;
  assert.ok(Math.abs(shockedDelta / normalDelta - 2.2) < 1e-4);

  // Advance until droplets snap and splash into bio_left
  let sawFreefall = false;
  let sawSatellite = false;
  for (let i = 0; i < 120; i++) {
    stepSlimeEngine(slime, vfx, 0.03, true, false);
    for (const d of slime.droplets) {
      if (!d.active) continue;
      if (d.isSatellite) sawSatellite = true;
      else {
        sawFreefall = true;
        // Volume conservation: scaleX^2 * scaleY === 1
        assert.ok(
          Math.abs(d.scaleX * d.scaleX * d.scaleY - 1) < 1e-5,
          `Expected axisymmetric volume conservation, got ${d.scaleX * d.scaleX * d.scaleY}`,
        );
      }
    }
  }
  assert.ok(sawFreefall, 'Expected primary droplet freefall after capillary snap');
  assert.ok(sawSatellite, 'Expected micro-satellite beads after capillary snap');

  const limeSpores = vfx.particles.filter(
    (p) => p.active && p.zone === 'bio_left' && p.color === '#bef264',
  );
  assert.ok(
    limeSpores.length >= 3,
    `Expected >=3 splash bio-spores emitted into bio_left, got ${limeSpores.length}`,
  );
  assert.equal(slime.nozzles, nozzleRef);
  assert.equal(slime.droplets, dropletRef);
});

test('computeDropletStretch preserves axisymmetric volume and caps elongation', () => {
  const s0 = computeDropletStretch(0);
  assert.equal(s0.scaleX, 1);
  assert.equal(s0.scaleY, 1);

  const sFast = computeDropletStretch(400);
  assert.equal(sFast.scaleY, 1.65);
  assert.ok(Math.abs(sFast.scaleX * sFast.scaleX * sFast.scaleY - 1) < 1e-6);
});

test('applyMetaballSmoothstepThreshold deterministically thresholds alpha in [0.42, 0.54] and shades acid palette', () => {
  const buf = new Uint8ClampedArray([
    255, 255, 255, 90,  // below 0.42 * 255 = 107.1 -> 0
    255, 255, 255, 122, // midpoint -> smoothstep ~0.5
    255, 255, 255, 220, // above 0.54 * 255 = 137.7 -> 255
  ]);
  applyMetaballSmoothstepThreshold(buf);

  assert.equal(buf[3], 0);
  assert.ok(buf[7] > 100 && buf[7] < 160);
  assert.equal(buf[11], 255);
  // Acid interior RGB
  assert.ok(buf[9] > buf[8] && buf[9] > buf[10], 'Expected lime-green acid tint');
});

test('stepSlimeEngine freezes completely under prefers-reduced-motion', () => {
  const vfx = createTitleEmblemVfxState();
  const slime = createSlimeEngineState();
  const initPhase = slime.nozzles[0].phase;
  stepSlimeEngine(slime, vfx, 0.05, true, true);
  assert.equal(slime.nozzles[0].phase, initPhase);
});
