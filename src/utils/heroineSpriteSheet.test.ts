import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEROINE_COMBAT_FRAMES,
  HEROINE_EMOTE_FRAMES,
  HEROINE_EMOTE_SHEET_HEIGHT,
  HEROINE_EMOTE_SHEET_WIDTH,
  HEROINE_SHEET_FRAMES,
  HEROINE_SHEET_HEIGHT,
  HEROINE_SHEET_WIDTH,
  createInitialHeroineAnimState,
  stepHeroineAnimState,
  triggerHeroineAnimation,
} from './heroineSpriteSheet';

test('all 72 sprite sheet frames (36 combat + 36 emote) lie cleanly inside sheet bounds without intra-sheet overlap', () => {
  assert.equal(HEROINE_COMBAT_FRAMES.length, 36);
  assert.equal(HEROINE_EMOTE_FRAMES.length, 36);
  assert.equal(HEROINE_SHEET_FRAMES.length, 72);

  for (const frame of HEROINE_SHEET_FRAMES) {
    const maxW = frame.sheet === 'emote' ? HEROINE_EMOTE_SHEET_WIDTH : HEROINE_SHEET_WIDTH;
    const maxH = frame.sheet === 'emote' ? HEROINE_EMOTE_SHEET_HEIGHT : HEROINE_SHEET_HEIGHT;
    assert.ok(frame.x >= 0 && frame.y >= 0, `${frame.id} has negative origin`);
    assert.ok(frame.w > 20 && frame.h > 20, `${frame.id} dimensions too small`);
    assert.ok(frame.x + frame.w <= maxW, `${frame.id} overflows sheet width`);
    assert.ok(frame.y + frame.h <= maxH, `${frame.id} overflows sheet height`);
    assert.ok(frame.anchorX > 0 && frame.anchorX < frame.w, `${frame.id} invalid anchorX`);
    assert.ok(frame.bottomY > 0 && frame.bottomY <= frame.h, `${frame.id} invalid bottomY`);
    assert.ok(frame.rowScale >= 1.0 && frame.rowScale <= 1.5, `${frame.id} invalid rowScale`);
  }

  for (const group of [HEROINE_COMBAT_FRAMES, HEROINE_EMOTE_FRAMES]) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
        assert.equal(overlapX && overlapY, false, `${a.id} overlaps ${b.id}`);
      }
    }
  }
});

test('idle state cycles through calm stand, IDLE1 (hair twirl), and IDLE2 (smartphone selfie), and snaps to tactical hover poses', () => {
  const idle = createInitialHeroineAnimState();
  const baseCtx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };

  const calm = stepHeroineAnimState(idle, 0.016, baseCtx);
  assert.equal(calm.frameIndex, 0);

  // Ambient IDLE1 window (2.2s .. 3.55s -> frames 36..44)
  const idle1Sample = stepHeroineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.75 });
  assert.ok(
    idle1Sample.frameIndex >= 36 && idle1Sample.frameIndex <= 44,
    `expected IDLE1 frame (36..44) at t=2.75, got ${idle1Sample.frameIndex}`,
  );

  // Ambient IDLE2 window (7.2s .. 8.7s -> frames 45..53)
  const idle2Sample = stepHeroineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.95 });
  assert.ok(
    idle2Sample.frameIndex >= 45 && idle2Sample.frameIndex <= 53,
    `expected IDLE2 frame (45..53) at t=7.95, got ${idle2Sample.frameIndex}`,
  );

  // Hovering a tactical tile immediately snaps out of ambient emote into tactical preview pose
  const atkHover = stepHeroineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.75, hoveredColor: 'attack' });
  assert.equal(atkHover.frameIndex, 7);

  const defHover = stepHeroineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.95, hoveredColor: 'defense' });
  assert.equal(defHover.frameIndex, 22);

  const techHover = stepHeroineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.75, hoveredColor: 'tech' });
  assert.equal(techHover.frameIndex, 65);
});

test('shoot sequence fires muzzle flash shot events and returns to idle', () => {
  let state = triggerHeroineAnimation(createInitialHeroineAnimState(), 'shoot');
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };
  let shotEvents = 0;
  const seenFrames = new Set<number>();

  for (let i = 0; i < 40; i++) {
    const sample = stepHeroineAnimState(state, 0.02, ctx);
    state = sample.state;
    seenFrames.add(sample.frameIndex);
    if (sample.shouldEmitShot) shotEvents++;
  }

  assert.equal(shotEvents, 2);
  assert.ok(seenFrames.has(10) && seenFrames.has(11));
  assert.equal(state.mode, 'idle');
});

test('dash_kick sprints forward using Row 0 run frames, lands Row 2 kick impact, and returns', () => {
  let state = triggerHeroineAnimation(createInitialHeroineAnimState(), 'dash_kick');
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };
  let maxProgress = 0;
  let kickImpacts = 0;
  const rowsVisited = new Set<number>();

  for (let i = 0; i < 55; i++) {
    const sample = stepHeroineAnimState(state, 0.02, ctx);
    state = sample.state;
    rowsVisited.add(sample.frame.row);
    if (sample.xProgress > maxProgress) maxProgress = sample.xProgress;
    if (sample.shouldEmitKickImpact) kickImpacts++;
  }

  assert.ok(maxProgress > 0.9, 'dash_kick should sprint forward near enemy');
  assert.equal(kickImpacts, 1);
  assert.ok(rowsVisited.has(0) && rowsVisited.has(2));
  assert.equal(state.mode, 'idle');
});

test('overdrive chains sprint, high plasma kick, and rapid pistol shots', () => {
  let state = triggerHeroineAnimation(createInitialHeroineAnimState(), 'overdrive');
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 4.0 };
  let kickImpacts = 0;
  let shots = 0;
  const rowsVisited = new Set<number>();

  for (let i = 0; i < 60; i++) {
    const sample = stepHeroineAnimState(state, 0.02, ctx);
    state = sample.state;
    rowsVisited.add(sample.frame.row);
    if (sample.shouldEmitKickImpact) kickImpacts++;
    if (sample.shouldEmitShot) shots++;
  }

  assert.equal(kickImpacts, 1);
  assert.equal(shots, 2);
  assert.ok(rowsVisited.has(0) && rowsVisited.has(1) && rowsVisited.has(2));
  assert.equal(state.mode, 'idle');
});

test('hit stagger plays Row 3 frames and defeat locks onto prone Row 4 final frame', () => {
  let hitState = triggerHeroineAnimation(createInitialHeroineAnimState(), 'hit', { lowHpHit: true });
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 5.0 };
  const hitFrames = new Set<number>();

  for (let i = 0; i < 40; i++) {
    const sample = stepHeroineAnimState(hitState, 0.02, ctx);
    hitState = sample.state;
    hitFrames.add(sample.frameIndex);
  }
  assert.ok(hitFrames.has(23) && hitFrames.has(26) && hitFrames.has(27));
  assert.equal(hitState.mode, 'idle');

  let deadState = createInitialHeroineAnimState();
  const deadCtx = { isDead: true, isVictory: false, hoveredColor: null, totalTime: 6.0 };
  let lastFrame = -1;
  for (let i = 0; i < 70; i++) {
    const sample = stepHeroineAnimState(deadState, 0.02, deadCtx);
    deadState = sample.state;
    lastFrame = sample.frameIndex;
  }
  assert.equal(deadState.mode, 'defeat');
  assert.equal(lastFrame, 35);
});

test('dash_kick and overdrive interpolate xProgress smoothly without moonwalking or teleports', () => {
  for (const mode of ['dash_kick', 'overdrive'] as const) {
    let state = triggerHeroineAnimation(createInitialHeroineAnimState(), mode);
    const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };
    let prevX = 0;
    let peakReached = false;

    for (let i = 0; i < 100; i++) {
      const sample = stepHeroineAnimState(state, 0.01, ctx);
      state = sample.state;
      assert.ok(
        Math.abs(sample.xProgress - prevX) < 0.12,
        `${mode} jumped abruptly from ${prevX} to ${sample.xProgress} on step ${i}`,
      );
      if (sample.xProgress >= 0.9) peakReached = true;
      if (peakReached && sample.xProgress < prevX - 0.005) {
        assert.ok(
          sample.frameIndex < 2 || sample.frameIndex > 6,
          `${mode} used forward sprint frame ${sample.frameIndex} while moving backward`,
        );
      }
      prevX = sample.xProgress;
      if (state.mode === 'idle') break;
    }
    assert.equal(state.mode, 'idle');
  }
});

test('USING TECH (upgrade) plays all 9 holographic tech frames (63..71) and VICTORY plays all 9 celebratory jump frames (54..62)', () => {
  const forbiddenCombatAttackFrames = new Set([7, 8, 9, 10, 11, 18]);

  // Verify USING TECH (upgrade) traverses Row 8 (63..71)
  let techState = triggerHeroineAnimation(createInitialHeroineAnimState(), 'upgrade');
  const techVisited = new Set<number>();
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };
  for (let i = 0; i < 55; i++) {
    const sample = stepHeroineAnimState(techState, 0.02, ctx);
    techState = sample.state;
    techVisited.add(sample.frameIndex);
    assert.equal(forbiddenCombatAttackFrames.has(sample.frameIndex), false);
  }
  for (let f = 63; f <= 71; f++) {
    assert.ok(techVisited.has(f), `upgrade (USING TECH) should visit frame ${f}`);
  }
  assert.equal(techState.mode, 'idle');

  // Verify Idle at totalTime=4.6 is in calm stance (frame 0)
  const idle = createInitialHeroineAnimState();
  const sampleAt46 = stepHeroineAnimState(idle, 0.016, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 4.6,
  });
  assert.equal(sampleAt46.frameIndex, 0);

  // Verify VICTORY traverses Row 7 (54..62) with jump apex and settles on victory pose (62)
  let vicState = createInitialHeroineAnimState();
  const vicVisited = new Set<number>();
  let minHopY = 0;
  let finalSample = stepHeroineAnimState(vicState, 0.02, {
    isDead: false,
    isVictory: true,
    hoveredColor: null,
    totalTime: 0.3,
  });
  vicState = finalSample.state;
  vicVisited.add(finalSample.frameIndex);

  for (let i = 0; i < 60; i++) {
    finalSample = stepHeroineAnimState(vicState, 0.02, {
      isDead: false,
      isVictory: true,
      hoveredColor: null,
      totalTime: 0.3 + i * 0.02,
    });
    vicState = finalSample.state;
    vicVisited.add(finalSample.frameIndex);
    if (finalSample.yHopPx < minHopY) minHopY = finalSample.yHopPx;
  }
  for (let f = 54; f <= 62; f++) {
    assert.ok(vicVisited.has(f), `victory should visit frame ${f}`);
  }
  assert.ok(minHopY <= -40, `victory jump should lift Kira upward, got minHopY=${minHopY}`);
  assert.equal(vicState.mode, 'victory');
  assert.equal(finalSample.frameIndex, 62);
  assert.notEqual(finalSample.breathScaleY, 1);
});

test('all standing poses across combat and emote sheets normalize to uniform 214px height and cross-blend smoothly', () => {
  // Measured dark-outline standing character heights in source PNGs:
  const standingSamples: Array<{ index: number; charH: number }> = [
    { index: 0, charH: 210 },  // r0_f0 Idle
    { index: 1, charH: 207 },  // r0_f1 Ready
    { index: 7, charH: 202 },  // r1_f0 Shoot
    { index: 14, charH: 157 }, // r2_f0 Kick start
    { index: 22, charH: 149 }, // r3_f0 Guard
    { index: 36, charH: 206 }, // r5_f0 IDLE1
    { index: 45, charH: 208 }, // r6_f0 IDLE2
    { index: 62, charH: 149 }, // r7_f8 VICTORY stand
    { index: 63, charH: 196 }, // r8_f0 USING TECH
  ];

  for (const s of standingSamples) {
    const f = HEROINE_SHEET_FRAMES[s.index];
    const effectiveStandingHeight = s.charH * f.rowScale;
    assert.ok(
      Math.abs(effectiveStandingHeight - 214) < 0.5,
      `${f.id} effective standing height ${effectiveStandingHeight.toFixed(2)} deviates from 214px`,
    );
  }

  // Verify sub-frame cross-blending triggers smoothly on pose transition and settles to 1
  const s0 = createInitialHeroineAnimState();
  const hoverStep1 = stepHeroineAnimState(s0, 0.016, {
    isDead: false,
    isVictory: false,
    hoveredColor: 'attack',
    totalTime: 1.0,
  });
  assert.equal(hoverStep1.prevFrameIndex, 0);
  assert.equal(hoverStep1.frameIndex, 7);
  assert.ok(hoverStep1.frameBlendAlpha > 0 && hoverStep1.frameBlendAlpha < 1);

  const hoverStep2 = stepHeroineAnimState(hoverStep1.state, 0.06, {
    isDead: false,
    isVictory: false,
    hoveredColor: 'attack',
    totalTime: 1.06,
  });
  assert.equal(hoverStep2.frameBlendAlpha, 1);
});

