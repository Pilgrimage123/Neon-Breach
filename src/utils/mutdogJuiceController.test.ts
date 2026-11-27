import assert from 'node:assert/strict';
import test from 'node:test';
import { projectMutdogLandmarkToStage } from '../components/combat/combatMutdogSpritePass';
import {
  type SpriteRenderCommand,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  createMeshGridTopology,
} from '../components/combat/stageMeshMath';
import {
  DEFAULT_MUTDOG_JUICE_CONFIG,
  applyMutdogSquash,
  createMutdogJuiceState,
  stepMutdogJuice,
  triggerMutdogJuiceState,
} from './mutdogJuiceController';
import { MUTDOG_SHEET_FRAMES } from './mutdogSpriteSheet';

test('Layer 1: Symplectic damped harmonic spring settles squash-and-stretch impulse back to (1, 1)', () => {
  const state = createMutdogJuiceState();
  applyMutdogSquash(state, 1.30, 0.74);
  assert.ok(state.springScaleX > 1.28);
  assert.ok(state.springScaleY < 0.76);

  let sample = stepMutdogJuice(state, 0.016, 0.016, DEFAULT_MUTDOG_JUICE_CONFIG);
  for (let i = 0; i < 65; i++) {
    sample = stepMutdogJuice(state, 0.016, (i + 2) * 0.016, DEFAULT_MUTDOG_JUICE_CONFIG);
  }
  assert.ok(Math.abs(sample.springScaleX - 1) < 0.015);
  assert.ok(Math.abs(sample.springScaleY - 1) < 0.015);
});

test('Layer 1 & 3: All 6 triggers keep foot knot (h=0) strictly pinned at zero displacement', () => {
  const triggers = [
    'idle',
    'prowl_stalk',
    'pounce_maul',
    'frenzy_howl',
    'take_hit',
    'turn_around',
  ] as const;

  for (const trig of triggers) {
    const state = createMutdogJuiceState();
    triggerMutdogJuiceState(state, trig, DEFAULT_MUTDOG_JUICE_CONFIG);
    for (let step = 0; step < 20; step++) {
      const s = stepMutdogJuice(state, 0.02, step * 0.02, DEFAULT_MUTDOG_JUICE_CONFIG);
      assert.equal(s.deform.feet.dx, 0, `Feet dx must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.dy, 0, `Feet dy must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.rotRad, 0, `Feet rotRad must remain 0 during ${trig}`);
      assert.equal(s.deform.feet.scaleX, 1, `Feet scaleX must remain 1 during ${trig}`);
    }
  }
});

test('Layer 2 (Rule 6): Prowl Stalk phase-locks hopYPx=0 on grounded contact frames (3, 5) and only lifts on airborne bound frame (7)', () => {
  const state = createMutdogJuiceState();
  triggerMutdogJuiceState(state, 'prowl_stalk', DEFAULT_MUTDOG_JUICE_CONFIG);

  let maxAbsShear = 0;
  let minHopY = 0;
  let maxAbsRot = 0;
  let pawPlants = 0;
  for (let i = 0; i < 45; i++) {
    const s = stepMutdogJuice(state, 0.02, i * 0.02, DEFAULT_MUTDOG_JUICE_CONFIG);
    maxAbsShear = Math.max(maxAbsShear, Math.abs(s.shearXPx));
    minHopY = Math.min(minHopY, s.hopYPx);
    maxAbsRot = Math.max(maxAbsRot, Math.abs(s.rotationRad));
    if (s.pawPlantTriggered) pawPlants += 1;
    assert.equal(s.uvDistortAmp[0], 0, 'Prowl stride must not apply UV jelly distortion');
    if (s.frameIndex === 3 || s.frameIndex === 5) {
      assert.equal(s.hopYPx, 0, `Grounded prowl frame ${s.frameIndex} must stay planted at hopYPx=0`);
    }
    if (s.hopYPx < 0) {
      assert.equal(s.frameIndex, 7, 'Airborne hop lift must only occur on leaping frame 7');
    }
  }

  assert.ok(maxAbsShear > 0.5, 'Prowl stride should generate velocity skew/shear');
  assert.ok(minHopY < -3, 'Prowl stride should bound upward (negative Y)');
  assert.ok(maxAbsRot > 0.01, 'Prowl stride should oscillate tilt rotation');
  assert.ok(pawPlants >= 1, 'Prowl stride should emit at least one pawPlantTriggered landing event');
});

test('Layer 2 & VFX: Pounce Maul executes frames 8->9->10->11, leap arc, slam squash, claw slash & pounceImpactTriggered', () => {
  const state = createMutdogJuiceState();
  triggerMutdogJuiceState(state, 'pounce_maul', DEFAULT_MUTDOG_JUICE_CONFIG);

  const seenFrames = new Set<number>();
  let minHopY = 0;
  let maxSlash = 0;
  let impactEdges = 0;
  let slamSquashX = 1;
  let slamSquashY = 1;

  for (let i = 1; i <= 50; i++) {
    const s = stepMutdogJuice(state, 0.02, i * 0.02, DEFAULT_MUTDOG_JUICE_CONFIG);
    seenFrames.add(s.frameIndex);
    minHopY = Math.min(minHopY, s.hopYPx);
    maxSlash = Math.max(maxSlash, s.clawSlashProgress);
    if (s.pounceImpactTriggered) {
      impactEdges += 1;
      slamSquashX = s.springScaleX;
      slamSquashY = s.springScaleY;
    }
    assert.equal(s.uvDistortAmp[0], 0, 'Pounce Maul must never apply jelly UV wobble');
  }

  assert.ok(seenFrames.has(8) && seenFrames.has(9) && seenFrames.has(10) && seenFrames.has(11));
  assert.ok(minHopY < -28, 'Airborne pounce peak should lift MutDog upward');
  assert.equal(impactEdges, 1, 'Pounce impact rising edge must fire exactly once');
  assert.ok(slamSquashX > 1.2 && slamSquashY < 0.8, 'Slam impact should compress spring vertically');
  assert.ok(maxSlash > 0.8, 'Slam & follow-through should drive triple claw rend slash progress');
});

test('Layer 3 & VFX: Frenzy Howl drives frames 5->4->6, droolBurstTriggered, lure flare & controlled howl pulse', () => {
  const state = createMutdogJuiceState();
  triggerMutdogJuiceState(state, 'frenzy_howl', DEFAULT_MUTDOG_JUICE_CONFIG);

  const seenFrames = new Set<number>();
  let droolEdges = 0;
  let maxHowlPulse = 0;
  let maxLureGlow = 0;
  let sawControlledDistort = false;

  for (let i = 1; i <= 56; i++) {
    const s = stepMutdogJuice(state, 0.02, i * 0.02, DEFAULT_MUTDOG_JUICE_CONFIG);
    seenFrames.add(s.frameIndex);
    if (s.droolBurstTriggered) droolEdges += 1;
    maxHowlPulse = Math.max(maxHowlPulse, s.howlPulseProgress);
    maxLureGlow = Math.max(maxLureGlow, s.lureGlowIntensity);
    if (s.uvDistortAmp[0] > 0) {
      sawControlledDistort = true;
      assert.ok(s.uvDistortFreq <= 14, 'Howl shimmer distortion frequency must stay controlled');
    }
  }

  assert.ok(seenFrames.has(5) && seenFrames.has(4) && seenFrames.has(6));
  assert.equal(droolEdges, 1, 'Frenzy Howl drool burst should fire once');
  assert.ok(maxHowlPulse > 0.85, 'Frenzy Howl should emit full acoustic howlPulseProgress');
  assert.ok(maxLureGlow > 0.95, 'Frenzy Howl should flare twin lure bulbs to peak');
  assert.ok(sawControlledDistort, 'Howl apex should drive subtle UV bio-shimmer');
});

test('Layer 3 & 4: Take Hit emits droolBurstTriggered, white-lime hit-flash, and backward whip recoil', () => {
  const state = createMutdogJuiceState();
  triggerMutdogJuiceState(state, 'take_hit', DEFAULT_MUTDOG_JUICE_CONFIG);

  const s = stepMutdogJuice(state, 0.05, 0.05, DEFAULT_MUTDOG_JUICE_CONFIG);
  assert.ok(s.droolBurstTriggered, 'Take Hit should spray rabid drool droplets');
  assert.ok(s.flashRgba !== null && s.flashRgba[3] > 0.3, 'Take Hit should activate hit-flash uniform');
  assert.ok(s.deform.head.dx < -3, 'Take Hit should whip head backward');
  assert.equal(s.frameIndex, 12, 'Take Hit should swap to frame 12 (pain recoil)');
});

test('Layer 2: Turn Around smoothly flips facingScale from -1 through +1 and back without degenerate zero', () => {
  const state = createMutdogJuiceState();
  triggerMutdogJuiceState(state, 'turn_around', DEFAULT_MUTDOG_JUICE_CONFIG);

  let sawPositiveFacing = false;
  let sawMidFlipHop = false;
  for (let i = 0; i < 65; i++) {
    const s = stepMutdogJuice(state, 0.02, i * 0.02, DEFAULT_MUTDOG_JUICE_CONFIG);
    assert.ok(Math.abs(s.facingScale) >= 0.04, 'facingScale must never hit 0 degenerate determinant');
    if (s.facingScale > 0.85) sawPositiveFacing = true;
    if (s.hopYPx < -8) sawMidFlipHop = true;
  }

  assert.ok(sawPositiveFacing, '2.5D flip should reach positive facingScale (+1)');
  assert.ok(sawMidFlipHop, '2.5D flip should include a nimble vertical hop');
  assert.equal(state.baseFacingSign, -1, 'Auto-return flip should restore -1 combat facing');
});

test('projectMutdogLandmarkToStage matches computeDeformedMeshVertices + GPU vertex shader exactly at mesh grid vertices', () => {
  const frame = MUTDOG_SHEET_FRAMES[4]; // Frenzy Howl frame
  const topology = createMeshGridTopology(4, 6);
  const deform = createIdentityControlPoints();
  deform.pelvis.dx = 3.2;
  deform.waist.dx = 9.4;
  deform.waist.dy = -3.8;
  deform.waist.rotRad = 0.06;
  deform.waist.scaleX = 1.05;
  deform.head.dx = 16.5;
  deform.head.dy = -5.2;
  deform.head.rotRad = 0.11;
  deform.head.scaleX = 1.03;

  const uniforms = createDefaultShaderUniforms();
  uniforms.squashStretch = [1.14, 0.88];
  uniforms.shearPx = [-8.5, 0];
  uniforms.swayAmpPx = 1.6;
  uniforms.swayPhase = 1.25;

  const drawScale = 0.92;
  const worldX = 420;
  const worldY = 310;
  const facingSign = -1;
  const rotationRad = -0.075;

  const cmd: SpriteRenderCommand = {
    id: 'test-mutdog',
    primarySource: {} as HTMLCanvasElement,
    worldX,
    worldY,
    widthPx: frame.w * drawScale,
    heightPx: frame.h * drawScale,
    anchorOffsetXPx: frame.anchorX * drawScale,
    anchorOffsetYPx: frame.bottomY * drawScale,
    facingSign,
    rotationRad,
    alpha: 1,
    deform,
    uniforms,
  };

  const verts = new Float32Array(topology.vertexCount * 8);
  computeDeformedMeshVertices(topology, cmd, verts);

  // Pick a top-row vertex (r = 6, h = 1.0, c = 3, u = 0.75) and compare against projectMutdogLandmarkToStage
  const r = 6;
  const c = 3;
  const vIdx = (r * (topology.cols + 1) + c) * 8;
  const meshWorldX = verts[vIdx];
  const meshWorldY = verts[vIdx + 1];
  const h = verts[vIdx + 6];

  // Apply vertex shader math to mesh vertex
  const relX = (meshWorldX - worldX) * uniforms.squashStretch[0];
  const relY = (meshWorldY - worldY) * uniforms.squashStretch[1];
  const weight = h * h * (3 - 2 * h);
  const swayOffset = Math.sin(uniforms.swayPhase + h * 1.35) * uniforms.swayAmpPx * weight;
  const expectedX = worldX + relX + swayOffset + uniforms.shearPx[0] * h;
  const expectedY = worldY + relY + uniforms.shearPx[1] * h;

  // Equivalent relative landmark (rel.dx = anchorX - localX, rel.dy = localY - bottomY)
  const localX = frame.w * (c / topology.cols);
  const localY = frame.h * (1 - r / topology.rows);
  const projected = projectMutdogLandmarkToStage(
    { dx: frame.anchorX - localX, dy: localY - frame.bottomY },
    {
      frame,
      worldX,
      worldY,
      drawScale,
      facingSign,
      rotationRad,
      deform,
      squashStretch: uniforms.squashStretch,
      shearPx: uniforms.shearPx,
      swayAmpPx: uniforms.swayAmpPx,
      swayPhase: uniforms.swayPhase,
    },
  );

  assert.ok(Math.abs(projected.x - expectedX) < 1e-4, `Projected X (${projected.x}) must match shader X (${expectedX})`);
  assert.ok(Math.abs(projected.y - expectedY) < 1e-4, `Projected Y (${projected.y}) must match shader Y (${expectedY})`);
});
