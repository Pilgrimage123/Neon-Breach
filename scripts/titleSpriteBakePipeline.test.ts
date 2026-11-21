import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCKUP_BOUNDS,
  DEFAULT_SLIME_TIPS,
  eraseSlimeDropletTips,
  extractStaticLockupPlane,
  extractTitleEmblemCutout,
  inpaintVisorGlass,
  KEYFRAME_VISOR_QUADS,
  shouldDownscaleToTarget,
} from './titleSpriteBakePipeline';

function createRgbaBuffer(
  w: number,
  h: number,
  r = 0,
  g = 0,
  b = 0,
  a = 255,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = a;
  }
  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const p = (y * w + x) * 4;
  data[p] = r;
  data[p + 1] = g;
  data[p + 2] = b;
  data[p + 3] = a;
}

function fillRect(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      setPixel(data, w, x, y, r, g, b, a);
    }
  }
}

test('shouldDownscaleToTarget only downscales inputs exceeding 960x541', () => {
  assert.equal(shouldDownscaleToTarget(960, 541), false);
  assert.equal(shouldDownscaleToTarget(800, 500), false);
  assert.equal(shouldDownscaleToTarget(1671, 941), true);
  assert.equal(shouldDownscaleToTarget(961, 541), true);
  assert.equal(shouldDownscaleToTarget(960, 542), true);
});

test('extractTitleEmblemCutout clears exterior ringing, strips two-tone interior checkerboard pockets, and preserves white letter cores', () => {
  const w = 64;
  const h = 64;
  // Exterior near-white background
  const data = createRgbaBuffer(w, h, 250, 250, 250, 255);
  // Lanczos ringing gray pixel on exterior boundary (min >= 216, chroma <= 8)
  setPixel(data, w, 2, 2, 220, 220, 220, 255);

  // Outer vibrant neon frame around interior pockets
  fillRect(data, w, 8, 8, 48, 48, 0, 240, 255, 255);

  // Pocket 1: trapped two-tone checkerboard island (>= 12 gray + >= 12 white)
  for (let y = 12; y < 24; y++) {
    for (let x = 12; x < 24; x++) {
      const isGray = ((x + y) & 1) === 0;
      const v = isGray ? 230 : 252;
      setPixel(data, w, x, y, v, v, v, 255);
    }
  }

  // Pocket 2: single-tone pure-white letter core bordered by vibrant neon
  fillRect(data, w, 34, 14, 12, 12, 255, 255, 255, 255);

  // Exterior light-glow fringe pixel adjacent to exterior background
  setPixel(data, w, 7, 20, 190, 245, 255, 255);
  // 1px neutral halo pixel adjacent to exterior background
  setPixel(data, w, 7, 21, 210, 210, 210, 255);

  extractTitleEmblemCutout(data, w, h);

  // Exterior background & Lanczos ringing pixel cleared
  assert.equal(data[(2 * w + 2) * 4 + 3], 0);
  // Trapped two-tone checkerboard island stripped
  assert.equal(data[(16 * w + 16) * 4 + 3], 0);
  // Single-tone white letter core preserved at alpha 255
  assert.equal(data[(18 * w + 38) * 4 + 3], 255);
  // Neutral halo defringed and exterior glow unmixed
  assert.ok(data[(21 * w + 7) * 4 + 3] < 255, 'Expected neutral halo defringed');
  assert.ok(data[(20 * w + 7) * 4 + 3] < 255, 'Expected exterior light glow unmixed');
});

test('extractStaticLockupPlane preserves lockup core, zeroes outside regions, and feathers 12px cosine seam', () => {
  const w = 200;
  const h = 100;
  const src = createRgbaBuffer(w, h, 0, 240, 255, 255);

  const lockup = extractStaticLockupPlane(src, w, h, DEFAULT_LOCKUP_BOUNDS);

  // Core interior (nx=0.40, ny=0.70) remains 100% opaque
  assert.equal(lockup[(70 * w + 80) * 4 + 3], 255);

  // Above top bevel (ny=0.20) and right of Kira arm seam (nx=0.85) are zeroed
  assert.equal(lockup[(20 * w + 80) * 4 + 3], 0);
  assert.equal(lockup[(70 * w + 170) * 4 + 3], 0);

  // Top bevel feather ramp (ny around 0.38 => y in [32..44]) increases monotonically
  let prevTopAlpha = 0;
  for (let y = 32; y <= 44; y++) {
    const a = lockup[(y * w + 80) * 4 + 3];
    assert.ok(a >= prevTopAlpha, `Expected monotonic top ramp at y=${y}: ${a} >= ${prevTopAlpha}`);
    prevTopAlpha = a;
  }
  assert.ok(prevTopAlpha === 255, 'Expected full alpha after top feather ramp');

  // Right arm seam feather ramp (nx around 0.79 => x in [146..158]) decreases monotonically
  let prevRightAlpha = 255;
  for (let x = 146; x <= 158; x++) {
    const a = lockup[(70 * w + x) * 4 + 3];
    assert.ok(a <= prevRightAlpha, `Expected monotonic right ramp at x=${x}: ${a} <= ${prevRightAlpha}`);
    prevRightAlpha = a;
  }
  assert.equal(prevRightAlpha, 0, 'Expected zero alpha at right seam boundary');
});

test('inpaintVisorGlass replaces painted visor LEDs with opaque dark curved glass while preserving cyan side bars and outer bezel', () => {
  const w = 960;
  const h = 541;
  const quad = KEYFRAME_VISOR_QUADS[0];
  const data = createRgbaBuffer(w, h, 80, 90, 105, 255);

  // Paint bright red LED inside visor center
  const cx = Math.round(((quad.p00x + quad.p10x + quad.p01x + quad.p11x) * 0.25) * w);
  const cy = Math.round(((quad.p00y + quad.p10y + quad.p01y + quad.p11y) * 0.25) * h);
  fillRect(data, w, cx - 8, cy - 5, 16, 10, 255, 42, 42, 255);

  // Paint flanking cyan side bar inside left visor edge
  const cyanX = Math.round(quad.p00x * w) + 4;
  const cyanY = Math.round(((quad.p00y + quad.p01y) * 0.5) * h);
  setPixel(data, w, cyanX, cyanY, 20, 235, 250, 255);

  // Paint metallic bezel outside quad
  const bezelX = Math.round(quad.p00x * w) - 5;
  const bezelY = cy;
  setPixel(data, w, bezelX, bezelY, 175, 185, 205, 255);

  inpaintVisorGlass(data, w, h, quad);

  // Center LED replaced by opaque dark glass (never transparent)
  const centerP = (cy * w + cx) * 4;
  assert.equal(data[centerP + 3], 255);
  assert.ok(data[centerP] < 60 && data[centerP + 1] < 80 && data[centerP + 2] < 120);

  // Cyan side bar preserved
  const cyanP = (cyanY * w + cyanX) * 4;
  assert.equal(data[cyanP], 20);
  assert.equal(data[cyanP + 1], 235);
  assert.equal(data[cyanP + 2], 250);

  // Outer metallic bezel preserved
  const bezelP = (bezelY * w + bezelX) * 4;
  assert.equal(data[bezelP], 175);
  assert.equal(data[bezelP + 1], 185);
  assert.equal(data[bezelP + 2], 205);
});

test('eraseSlimeDropletTips applies 14px radial soft alpha erasure over the 3 static droplet tips', () => {
  const w = 120;
  const h = 340;
  const data = createRgbaBuffer(w, h, 140, 230, 60, 255);

  eraseSlimeDropletTips(data, w, h);

  // Exact centers of all 3 tips are fully erased
  for (const tip of DEFAULT_SLIME_TIPS) {
    assert.equal(data[(tip.y * w + tip.x) * 4 + 3], 0, `Expected tip (${tip.x},${tip.y}) erased`);
  }

  // Pixel 10px away from tip (32, 192) is partially feathered
  const featheredAlpha = data[(192 * w + 42) * 4 + 3];
  assert.ok(
    featheredAlpha > 0 && featheredAlpha < 255,
    `Expected feathered alpha at 10px radius, got ${featheredAlpha}`,
  );

  // Pixel > 15px away from all tips remains untouched
  assert.equal(data[(192 * w + 60) * 4 + 3], 255);
});
