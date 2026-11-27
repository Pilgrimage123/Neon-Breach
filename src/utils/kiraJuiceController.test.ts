import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroAnimMode } from './heroAnimator';
import {
  DEFAULT_KIRA_JUICE_CONFIG,
  createKiraJuiceState,
  resolveKiraCutInFrameIndex,
  stepKiraJuice,
  triggerKiraJuiceState,
} from './kiraJuiceController';

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

test('kiraJuiceController supports all 12 HeroAnimModes with crisp cuts (blendDuration = 0)', () => {
  for (const mode of ALL_MODES) {
    const state = createKiraJuiceState();
    triggerKiraJuiceState(state, mode);
    const sample = stepKiraJuice(
      state,
      0.016,
      { isDead: mode === 'defeat', isVictory: mode === 'victory', hoveredColor: null, totalTime: 1.0 },
      DEFAULT_KIRA_JUICE_CONFIG,
    );
    assert.equal(state.blendDuration, 0, `${mode} must keep blendDuration = 0`);
    assert.equal(sample.blendAlpha, 1, `${mode} must keep blendAlpha = 1`);
    assert.equal(sample.deform.feet.dx, 0);
    assert.equal(sample.deform.feet.dy, 0);
  }
});

test('grounded frames enforce hopYPx = 0 and idle/locomotion enforce uvDistortAmp = [0, 0]', () => {
  const state = createKiraJuiceState();
  for (const t of [0.2, 1.0, 2.5, 7.5]) {
    const s = stepKiraJuice(state, 0.016, {
      isDead: false,
      isVictory: false,
      hoveredColor: null,
      totalTime: t,
    });
    assert.equal(s.hopYPx, 0);
    assert.deepEqual(s.uvDistortAmp, [0, 0]);
  }
});

test('dt = 0 hitstop tick produces finite transforms without NaN', () => {
  const state = createKiraJuiceState();
  triggerKiraJuiceState(state, 'dash_kick');
  const s = stepKiraJuice(state, 0, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 1.0,
  });
  assert.ok(Number.isFinite(s.springScaleX));
  assert.ok(Number.isFinite(s.springScaleY));
  assert.ok(Number.isFinite(s.shearXPx));
  assert.equal(s.blendAlpha, 1);
});

test('prefers-reduced-motion freezes spring, sway, shear, and flash', () => {
  const state = createKiraJuiceState();
  triggerKiraJuiceState(state, 'dash_kick');
  const s = stepKiraJuice(state, 0.016, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 2.5,
    reducedMotion: true,
  });
  assert.equal(s.springScaleX, 1);
  assert.equal(s.springScaleY, 1);
  assert.equal(s.shearXPx, 0);
  assert.equal(s.flashRgba, null);
  assert.deepEqual(s.uvDistortAmp, [0, 0]);
});

test('resolveKiraCutInFrameIndex maps Surge Blast, Energy Dropkick, brace, and recoil poses', () => {
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
  assert.equal(resolveKiraCutInFrameIndex(activeCutIn, 'windup', 'dash_kick', 0), 10);
  assert.equal(resolveKiraCutInFrameIndex(activeCutIn, 'impact_freeze', 'dash_kick', 0), 11);
  assert.equal(resolveKiraCutInFrameIndex(activeCutIn, 'windup', 'overdrive', 0), 20);
  assert.equal(resolveKiraCutInFrameIndex(activeCutIn, 'impact_freeze', 'overdrive', 0), 21);
  assert.equal(resolveKiraCutInFrameIndex({ ...activeCutIn, poseOverride: 'brace_pose' }, 'impact_freeze', 'idle', 0), 13);
  assert.equal(resolveKiraCutInFrameIndex({ ...activeCutIn, poseOverride: 'recoil_pose' }, 'impact_freeze', 'idle', 0), 14);
});
