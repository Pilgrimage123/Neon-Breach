import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGRY_CAT_24x9,
  createVisorMatrixState,
  HAPPY_CAT_24x9,
  HEART_CLIMAX_24x9,
  interpolateVisorQuad,
  projectVisorCell,
  stepVisorMatrix,
  VISOR_CELL_COUNT,
  VISOR_KEYFRAME_QUADS,
  VISOR_OVERDRIVE_DURATION_SEC,
  VISOR_TRAIL_DURATION_SEC,
  type VisorQuad,
} from './titleVisorMatrix';
import { createTitleEmblemVfxState, stepTitleEmblemVfx, triggerEmblemClickBurst } from './titleEmblemVfx';

test('Canonical 24x9 Visor Matrix bitmaps have 216 cells with valid 0/1/2 values', () => {
  for (const bmp of [ANGRY_CAT_24x9, HAPPY_CAT_24x9, HEART_CLIMAX_24x9]) {
    assert.equal(bmp.length, VISOR_CELL_COUNT);
    let lit = 0;
    for (let i = 0; i < bmp.length; i++) {
      assert.ok(bmp[i] === 0 || bmp[i] === 1 || bmp[i] === 2);
      if (bmp[i] > 0) lit++;
    }
    assert.ok(lit > 30, `Expected >30 lit LED cells, got ${lit}`);
  }
});

test('interpolateVisorQuad linearly interpolates corners and projectVisorCell applies barrel curvature', () => {
  const out: VisorQuad = {
    p00x: 0,
    p00y: 0,
    p10x: 0,
    p10y: 0,
    p01x: 0,
    p01y: 0,
    p11x: 0,
    p11y: 0,
    curvature: 0,
  };
  interpolateVisorQuad(1, 2, 0.5, out);
  assert.ok(
    Math.abs(out.p00x - (VISOR_KEYFRAME_QUADS[1].p00x + VISOR_KEYFRAME_QUADS[2].p00x) * 0.5) < 1e-6,
  );
  const expectedMidCurvature =
    (VISOR_KEYFRAME_QUADS[1].curvature + VISOR_KEYFRAME_QUADS[2].curvature) * 0.5;
  assert.ok(Math.abs(out.curvature - expectedMidCurvature) < 1e-6);

  const ptEdge = { x: 0, y: 0 };
  const ptMid = { x: 0, y: 0 };
  projectVisorCell(VISOR_KEYFRAME_QUADS[0], 0, 4, 960, 541, 0, ptEdge);
  projectVisorCell(VISOR_KEYFRAME_QUADS[0], 12, 4, 960, 541, 0, ptMid);
  // Center column bows upward due to negative barrel curvature (-0.014)
  const expectedFlatMidY =
    (VISOR_KEYFRAME_QUADS[0].p00y + VISOR_KEYFRAME_QUADS[0].p01y) * 0.5 * 541;
  assert.ok(ptMid.y < expectedFlatMidY - 4, 'Expected upward barrel bow at visor center');
  assert.ok(ptEdge.x < ptMid.x);
});

test('Visor Matrix enforces Beat 1 scanline/cell-walk/overdrive, K1-K3 happy continuity, Beat 4 radial heart, 2 Hz throb, and reverse recovery', () => {
  const vfx = createTitleEmblemVfxState();
  const visor = createVisorMatrixState();

  // Idle -> ANGRY_CAT_24x9
  const idleSample = stepTitleEmblemVfx(vfx, 0.016);
  stepVisorMatrix(visor, idleSample.sequence, 0.016, false);
  assert.equal(visor.mode, 'angry');
  assert.deepEqual(visor.activeCells, ANGRY_CAT_24x9);

  // Trigger click -> Beat 1 (0..0.36 s): cathode scanline active before 180ms + overdrive/trail populated
  triggerEmblemClickBurst(vfx, 0.5, 0.5);
  for (let i = 0; i < 3; i++) {
    const b1Sample = stepTitleEmblemVfx(vfx, 0.04);
    stepVisorMatrix(visor, b1Sample.sequence, 0.04, false);
  }
  assert.equal(visor.mode, 'beat1_forward');
  assert.ok(visor.scanlineRow >= 0 && visor.scanlineRow < 9);

  let flashCount = 0;
  for (let i = 0; i < VISOR_CELL_COUNT; i++) {
    if (visor.cellFlashRemaining[i] > 0 && visor.cellFlashRemaining[i] <= VISOR_OVERDRIVE_DURATION_SEC) {
      flashCount++;
    }
  }
  assert.ok(flashCount > 0, 'Expected phosphor overdrive flash on switching cells');

  // Step through K1 -> K2 -> K3 (0.36..1.24 s): continuous HAPPY_CAT_24x9 continuity
  for (let t = 0.09; t < 0.55; t += 0.05) {
    const s = stepTitleEmblemVfx(vfx, 0.05);
    stepVisorMatrix(visor, s.sequence, 0.05, false);
  }
  assert.equal(visor.mode, 'happy');
  assert.deepEqual(visor.activeCells, HAPPY_CAT_24x9);

  // Advance to K2->K3 (~0.95 s) and verify still HAPPY_CAT_24x9 (never reverts to angry)
  for (let i = 0; i < 8; i++) {
    const s = stepTitleEmblemVfx(vfx, 0.05);
    stepVisorMatrix(visor, s.sequence, 0.05, false);
  }
  assert.equal(visor.mode, 'happy');
  assert.deepEqual(visor.activeCells, HAPPY_CAT_24x9);

  // Advance into Beat 4 (1.24..1.66 s): radial expansion from (12,4)
  for (let i = 0; i < 8; i++) {
    const s = stepTitleEmblemVfx(vfx, 0.05);
    stepVisorMatrix(visor, s.sequence, 0.05, false);
  }
  assert.equal(visor.mode, 'beat4_forward');

  // Advance into Climax Hold (1.66..2.06 s): HEART_CLIMAX_24x9 + 2 Hz throb
  while (vfx.sequenceElapsed < 1.78) {
    const s = stepTitleEmblemVfx(vfx, 0.02);
    stepVisorMatrix(visor, s.sequence, 0.02, false);
  }
  assert.equal(visor.mode, 'climax_hold');
  assert.deepEqual(visor.activeCells, HEART_CLIMAX_24x9);
  assert.ok(visor.climaxThrobScale > 1.0, `Expected >1.0 2 Hz throb scale, got ${visor.climaxThrobScale}`);

  // Advance into reverse (2.06..2.86 s) and verify mid-reverse click recovery
  while (vfx.sequenceElapsed < 2.45) {
    const s = stepTitleEmblemVfx(vfx, 0.05);
    stepVisorMatrix(visor, s.sequence, 0.05, false);
  }
  assert.equal(visor.mode, 'happy');

  triggerEmblemClickBurst(vfx, 0.5, 0.5);
  assert.ok(vfx.sequenceElapsed < 1.66, 'Expected mid-reverse click to map back to forward arc');
});

test('Visor Matrix honors prefers-reduced-motion by freezing overdrive flashes and 2 Hz climax throb while preserving buffer identity', () => {
  const vfx = createTitleEmblemVfxState();
  const visor = createVisorMatrixState();
  const activeRef = visor.activeCells;
  const flashRef = visor.cellFlashRemaining;
  const trailRef = visor.cellTrailRemaining;

  triggerEmblemClickBurst(vfx, 0.5, 0.5);
  while (vfx.sequenceElapsed < 1.78) {
    const s = stepTitleEmblemVfx(vfx, 0.04, { reducedMotion: true });
    stepVisorMatrix(visor, s.sequence, 0.04, true);
  }

  assert.equal(visor.mode, 'climax_hold');
  assert.equal(visor.climaxThrobScale, 1);
  for (let i = 0; i < VISOR_CELL_COUNT; i++) {
    assert.equal(visor.cellFlashRemaining[i], 0);
    assert.ok(visor.cellTrailRemaining[i] <= VISOR_TRAIL_DURATION_SEC);
    assert.equal(visor.cellTrailRemaining[i], 0);
  }
  assert.equal(visor.activeCells, activeRef);
  assert.equal(visor.cellFlashRemaining, flashRef);
  assert.equal(visor.cellTrailRemaining, trailRef);
});
