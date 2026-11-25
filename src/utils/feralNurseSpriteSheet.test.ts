import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FERAL_NURSE_CANONICAL_HEIGHT,
  FERAL_NURSE_SHEET_A_FRAMES,
  FERAL_NURSE_SHEET_B_FRAMES,
  FERAL_NURSE_SHEET_FRAMES,
  FERAL_NURSE_SHEET_HEIGHT,
  FERAL_NURSE_SHEET_OPTIONS,
  FERAL_NURSE_SHEET_WIDTH,
  sampleFeralNurseFrame,
} from './feralNurseSpriteSheet';

test('Feral Nurse dual sprite sheets define 32 valid non-overlapping frames with preserveExistingAlpha', () => {
  assert.equal(FERAL_NURSE_SHEET_A_FRAMES.length, 16);
  assert.equal(FERAL_NURSE_SHEET_B_FRAMES.length, 16);
  assert.equal(FERAL_NURSE_SHEET_FRAMES.length, 32);
  assert.equal(FERAL_NURSE_SHEET_OPTIONS.preserveExistingAlpha, true);

  for (let i = 0; i < FERAL_NURSE_SHEET_FRAMES.length; i++) {
    const f = FERAL_NURSE_SHEET_FRAMES[i];
    assert.equal(f.sheet, i < 16 ? 0 : 1);
    assert.ok(f.x >= 0 && f.y >= 0, `Frame ${i} has negative origin`);
    assert.ok(f.w > 40 && f.h > 40, `Frame ${i} too small`);
    assert.ok(
      f.x + f.w <= FERAL_NURSE_SHEET_WIDTH,
      `Frame ${i} exceeds sheet width (${f.x + f.w} > ${FERAL_NURSE_SHEET_WIDTH})`,
    );
    assert.ok(
      f.y + f.h <= FERAL_NURSE_SHEET_HEIGHT,
      `Frame ${i} exceeds sheet height (${f.y + f.h} > ${FERAL_NURSE_SHEET_HEIGHT})`,
    );
    assert.ok(f.anchorX > 0 && f.anchorX < f.w, `Frame ${i} anchorX out of rect`);
    assert.ok(f.bottomY > f.h * 0.8 && f.bottomY <= f.h, `Frame ${i} bottomY not at ground contact`);
  }
  assert.ok(FERAL_NURSE_CANONICAL_HEIGHT >= 220 && FERAL_NURSE_CANONICAL_HEIGHT <= 270);
});

test('sampleFeralNurseFrame drives Optical Cloak, Prepare Coil, 8-beat 7-Pierce lunge, pain, and KO collapse', () => {
  const idleSample = sampleFeralNurseFrame(undefined, 0.15, 0);
  assert.equal(idleSample.mode, 'idle');
  assert.ok([0, 1, 2, 3, 10].includes(idleSample.frameIndex));
  assert.equal(idleSample.cloakIntensity, 0);
  assert.equal(idleSample.alpha, 1);

  // Move 1: Optical Cloak Cast (frames 12 -> 13 -> 14, translucent shimmer)
  const cloakCastSample = sampleFeralNurseFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.84,
      cloakCastTimer: 0.25,
      cloakCastDuration: 0.68,
    },
    1.0,
    0,
  );
  assert.equal(cloakCastSample.mode, 'cloakCast');
  assert.ok([12, 13, 14].includes(cloakCastSample.frameIndex));
  assert.ok(cloakCastSample.cloakIntensity > 0.5);
  assert.ok(cloakCastSample.alpha < 0.7);
  assert.ok(cloakCastSample.headsetGlowIntensity > 0.85);

  // Active 1-Turn Optical Cloak: ~26% translucency + strong shimmer + bright eyes
  const cloakedSample = sampleFeralNurseFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.84,
      cloaked: true,
    },
    1.5,
    0,
  );
  assert.equal(cloakedSample.mode, 'opticalCloak');
  assert.ok([4, 13, 14].includes(cloakedSample.frameIndex));
  assert.ok(cloakedSample.alpha >= 0.18 && cloakedSample.alpha <= 0.36);
  assert.ok(cloakedSample.cloakIntensity >= 0.85);
  assert.ok(cloakedSample.headsetGlowIntensity >= 0.9);

  // Move 2: Prepare Coil (frames 16..19)
  const prepareSample = sampleFeralNurseFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.84,
      preparePrimed: true,
    },
    2.0,
    0,
  );
  assert.equal(prepareSample.mode, 'prepareCoil');
  assert.ok([16, 17, 18, 19].includes(prepareSample.frameIndex));

  // Move 3: 7-Pierce Surgical Lunge (torpedo & rend slash)
  const pierceAirSample = sampleFeralNurseFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.44,
      attackAnimDuration: 0.84,
    },
    3.0,
    0,
  );
  assert.equal(pierceAirSample.mode, 'pierceStrike');
  assert.equal(pierceAirSample.frameIndex, 22);
  assert.ok(pierceAirSample.yHopPx < -5);

  const pierceImpactSample = sampleFeralNurseFrame(
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0.30,
      attackAnimDuration: 0.84,
    },
    3.1,
    0,
  );
  assert.equal(pierceImpactSample.mode, 'pierceStrike');
  assert.equal(pierceImpactSample.frameIndex, 23);
  assert.ok(pierceImpactSample.clawSlashProgress > 0.5);
  assert.ok(pierceImpactSample.pierceImpactIntensity > 0.5);

  // KO collapse uses frames 28..31
  const koFinal = sampleFeralNurseFrame(
    {
      dead: true,
      koProgress: 0.95,
      staggerTimer: 0,
      staggerDuration: 0.44,
      attackAnimTimer: 0,
      attackAnimDuration: 0.84,
    },
    4.0,
    0,
  );
  assert.equal(koFinal.mode, 'death');
  assert.equal(koFinal.frameIndex, 31);
  assert.ok(koFinal.alpha < 0.35);
});
