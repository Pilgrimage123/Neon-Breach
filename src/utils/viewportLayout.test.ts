import test from 'node:test';
import assert from 'node:assert/strict';
import { computeViewportMetrics } from './viewportLayout';

test('classifies desktop 1440x900 correctly without landscape toggle', () => {
  const m = computeViewportMetrics(1440, 900, false);
  assert.equal(m.isDesktop, true);
  assert.equal(m.isCompactLandscape, false);
  assert.equal(m.isNarrowPortrait, false);
  assert.equal(m.canOfferLandscapeToggle, false);
  assert.equal(m.isLandscapeRotated, false);
  assert.equal(m.effectiveWidth, 1440);
  assert.equal(m.effectiveHeight, 900);
});

test('classifies mobile landscape 667x375 and 844x390 as compact landscape', () => {
  for (const [w, h] of [
    [667, 375],
    [844, 390],
    [740, 360],
  ]) {
    const m = computeViewportMetrics(w, h, false);
    assert.equal(m.isCompactLandscape, true);
    assert.equal(m.isNarrowPortrait, false);
    assert.equal(m.canOfferLandscapeToggle, false);
    assert.equal(m.isLandscapeRotated, false);
    assert.equal(m.effectiveWidth, w);
    assert.equal(m.effectiveHeight, h);
  }
});

test('classifies mobile portrait 390x844 as narrow portrait and swaps dimensions when landscapeLocked is enabled', () => {
  const unrotated = computeViewportMetrics(390, 844, false);
  assert.equal(unrotated.isNarrowPortrait, true);
  assert.equal(unrotated.isCompactLandscape, false);
  assert.equal(unrotated.canOfferLandscapeToggle, true);
  assert.equal(unrotated.isLandscapeRotated, false);

  const rotated = computeViewportMetrics(390, 844, true);
  assert.equal(rotated.isLandscapeRotated, true);
  assert.equal(rotated.isCompactLandscape, true);
  assert.equal(rotated.isNarrowPortrait, false);
  assert.equal(rotated.effectiveWidth, 844);
  assert.equal(rotated.effectiveHeight, 390);
});

test('ignores landscapeLocked when viewport is already wider than tall', () => {
  const m = computeViewportMetrics(844, 390, true);
  assert.equal(m.isLandscapeRotated, false);
  assert.equal(m.effectiveWidth, 844);
  assert.equal(m.effectiveHeight, 390);
});
