import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroAnimMode } from './heroAnimator';
import {
  DEFAULT_AURALINE_JUICE_CONFIG,
  createAuralineJuiceState,
  resolveAuralineCutInFrameIndex,
  stepAuralineJuice,
  triggerAuralineJuiceState,
} from './auralineJuiceController';

const ALL_MODES: readonly HeroAnimMode[] = [
  'idle',
  'idle1',
  'idle2',
  'shoot',
  'dash_kick',
  'overdrive',
  'guard',
  'dodge',
  'upgrade',
  'hit',
  'defeat',
  'victory',
];

test('auralineJuiceController supports all 12 HeroAnimModes with crisp cuts (blendDuration = 0) and planted feet', () => {
  for (const mode of ALL_MODES) {
    const state = createAuralineJuiceState();
    triggerAuralineJuiceState(state, mode);
    const sample = stepAuralineJuice(
      state,
      0.016,
      { isDead: mode === 'defeat', isVictory: mode === 'victory', hoveredColor: null, totalTime: 1.0 },
      DEFAULT_AURALINE_JUICE_CONFIG,
    );
    assert.equal(state.blendDuration, 0, `${mode} must keep blendDuration = 0`);
    assert.equal(sample.blendAlpha, 1, `${mode} must keep blendAlpha = 1`);
    assert.equal(sample.deform.feet.dx, 0);
    assert.equal(sample.deform.feet.dy, 0);
    assert.equal(sample.hopYPx, 0, `${mode} must keep grounded hopYPx = 0`);
  }
});

test('Artillery Surge Blast (dash_kick) transitions F9 -> F10 -> F11 -> F12 while 100% planted and emits shot on F11', () => {
  const state = createAuralineJuiceState();
  triggerAuralineJuiceState(state, 'dash_kick');
  const seenFrames: number[] = [];
  let emittedShotOnF11 = false;

  for (let i = 0; i < 40; i++) {
    const s = stepAuralineJuice(state, 0.02, {
      isDead: false,
      isVictory: false,
      hoveredColor: null,
      totalTime: 1.0 + i * 0.02,
    });
    assert.equal(s.xProgress, 0, 'Artillery Surge Blast must stay planted at xProgress = 0');
    assert.equal(s.hopYPx, 0, 'Artillery Surge Blast must stay grounded at hopYPx = 0');
    if (!seenFrames.includes(s.frameIndex)) {
      seenFrames.push(s.frameIndex);
    }
    if (s.shouldEmitShot) {
      assert.equal(s.frameIndex, 11, 'Artillery Surge Blast shot must emit on F11');
      assert.ok(s.surgeBlastIntensity > 0.9, 'surgeBlastIntensity must peak on F11');
      emittedShotOnF11 = true;
    }
  }
  assert.ok(emittedShotOnF11, 'Expected shot emission on F11');
  assert.deepEqual(seenFrames.slice(0, 4), [9, 10, 11, 12]);
});

test('dt = 0 hitstop tick and prefers-reduced-motion produce finite transforms and freeze procedural motion', () => {
  const state = createAuralineJuiceState();
  triggerAuralineJuiceState(state, 'dash_kick');
  const hitstopSample = stepAuralineJuice(state, 0, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 1.0,
  });
  assert.ok(Number.isFinite(hitstopSample.springScaleX));
  assert.ok(Number.isFinite(hitstopSample.springScaleY));
  assert.ok(Number.isFinite(hitstopSample.shearXPx));
  assert.equal(hitstopSample.blendAlpha, 1);

  const rmSample = stepAuralineJuice(state, 0.016, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 2.5,
    reducedMotion: true,
  });
  assert.equal(rmSample.springScaleX, 1);
  assert.equal(rmSample.springScaleY, 1);
  assert.equal(rmSample.shearXPx, 0);
  assert.equal(rmSample.flashRgba, null);
  assert.deepEqual(rmSample.uvDistortAmp, [0, 0]);
});

test('resolveAuralineCutInFrameIndex maps Artillery Surge Blast, Sovereign Broadside, Aegis brace, and recoil poses', () => {
  const activeCutIn = {
    active: true,
    role: 'attacker' as const,
    poseOverride: 'attack_pose' as const,
    isMeleeClash: false,
    clashSlideX: 0,
    knockbackX: 0,
    scaleX: 1,
    scaleY: 1,
    leanRad: 0,
    drawPriority: 1,
    tintRgba: [1, 1, 1, 1] as [number, number, number, number],
    flashRgba: null,
  };
  assert.equal(resolveAuralineCutInFrameIndex(activeCutIn, 'windup', 'dash_kick', 0), 10);
  assert.equal(resolveAuralineCutInFrameIndex(activeCutIn, 'impact_freeze', 'dash_kick', 0), 11);
  assert.equal(resolveAuralineCutInFrameIndex(activeCutIn, 'windup', 'overdrive', 0), 20);
  assert.equal(resolveAuralineCutInFrameIndex(activeCutIn, 'impact_freeze', 'overdrive', 0), 21);
  assert.equal(resolveAuralineCutInFrameIndex({ ...activeCutIn, poseOverride: 'brace_pose' }, 'impact_freeze', 'idle', 0), 13);
  assert.equal(resolveAuralineCutInFrameIndex({ ...activeCutIn, poseOverride: 'recoil_pose' }, 'impact_freeze', 'idle', 0), 14);
});
