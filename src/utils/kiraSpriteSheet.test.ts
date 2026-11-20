import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEROINE_COMBAT_FRAMES,
  HEROINE_DODGE_DURATION,
  HEROINE_DODGE_FRAMES,
  HEROINE_EMOTE_FRAMES,
  HEROINE_EMOTE_SHEET_HEIGHT,
  HEROINE_EMOTE_SHEET_WIDTH,
  HEROINE_SHEET_FRAMES,
  HEROINE_SHEET_HEIGHT,
  HEROINE_SHEET_WIDTH,
  createInitialHeroineAnimState,
  shouldKiraDodgeAttack,
  stepHeroineAnimState,
  triggerHeroineAnimation,
} from './kiraSpriteSheet';

const DODGE_PNG_PATHS = [
  'src/assets/sprites/kira_dodge_0_vault.png',
  'src/assets/sprites/kira_dodge_1_slide.png',
  'src/assets/sprites/kira_dodge_2_spin.png',
  'src/assets/sprites/kira_dodge_3_land.png',
] as const;

function readPngHeader(relPath: string): { width: number; height: number; colorType: number; bytes: number } {
  const buf = fs.readFileSync(path.resolve(process.cwd(), relPath));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
    bytes: buf.byteLength,
  };
}

test('all 76 sprite sheet frames (36 combat + 36 emote + 4 resized RGBA dodge) lie cleanly inside bounds', () => {
  assert.equal(HEROINE_COMBAT_FRAMES.length, 36);
  assert.equal(HEROINE_EMOTE_FRAMES.length, 36);
  assert.equal(HEROINE_DODGE_FRAMES.length, 4);
  assert.equal(HEROINE_SHEET_FRAMES.length, 76);

  const combatDims = readPngHeader('src/assets/sprites/kira_spritesheet.png');
  assert.equal(combatDims.width, HEROINE_SHEET_WIDTH);
  assert.equal(combatDims.height, HEROINE_SHEET_HEIGHT);

  const emoteDims = readPngHeader(
    'src/assets/sprites/kira_emote_sheet.png',
  );
  assert.equal(emoteDims.width, HEROINE_EMOTE_SHEET_WIDTH);
  assert.equal(emoteDims.height, HEROINE_EMOTE_SHEET_HEIGHT);

  // Verify each resized Kira dodge PNG is compact (< 200 KB), RGBA (colorType 6), and matches frame dimensions
  assert.equal(DODGE_PNG_PATHS.length, HEROINE_DODGE_FRAMES.length);
  HEROINE_DODGE_FRAMES.forEach((frame, idx) => {
    const hdr = readPngHeader(DODGE_PNG_PATHS[idx]);
    assert.equal(hdr.width, frame.w, `${frame.id} width mismatch`);
    assert.equal(hdr.height, frame.h, `${frame.id} height mismatch`);
    assert.equal(hdr.colorType, 6, `${frame.id} must be RGBA (colorType 6)`);
    assert.ok(hdr.bytes < 200_000, `${frame.id} should be resized below 200 KB, got ${hdr.bytes}`);
    assert.ok(frame.anchorX > 0 && frame.anchorX < frame.w, `${frame.id} invalid anchorX`);
    assert.ok(frame.bottomY > 0 && frame.bottomY <= frame.h, `${frame.id} invalid bottomY`);
    assert.ok(frame.rowScale >= 0.88 && frame.rowScale <= 1.02, `${frame.id} invalid anatomical dodge rowScale (${frame.rowScale})`);
  });

  for (const frame of [...HEROINE_COMBAT_FRAMES, ...HEROINE_EMOTE_FRAMES]) {
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
  // Upscaled frames (Rows 1, 2, 3, 4, 7, 8) are normalized directly to canonical 214px resolution (rowScale === 1.0)
  for (const frame of [...HEROINE_COMBAT_FRAMES, ...HEROINE_EMOTE_FRAMES]) {
    assert.ok(
      frame.rowScale >= 1.0 && frame.rowScale <= 1.05,
      `${frame.id} rowScale=${frame.rowScale} indicates un-upscaled low-resolution sprite`,
    );
  }

  // Measured standing character heights in the upscaled source PNGs:
  const standingSamples: Array<{ index: number; charH: number }> = [
    { index: 0, charH: 210 },  // r0_f0 Idle (native)
    { index: 1, charH: 207 },  // r0_f1 Ready (native)
    { index: 7, charH: 214 },  // r1_f0 Shoot (upscaled)
    { index: 14, charH: 214 }, // r2_f0 Kick start (upscaled)
    { index: 22, charH: 214 }, // r3_f0 Guard (upscaled)
    { index: 36, charH: 206 }, // r5_f0 IDLE1 (native)
    { index: 45, charH: 208 }, // r6_f0 IDLE2 (native)
    { index: 62, charH: 214 }, // r7_f8 VICTORY stand (upscaled)
    { index: 63, charH: 214 }, // r8_f0 USING TECH (upscaled)
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

test('dodge choreography traverses Vault (72) -> Slide 1 (73) -> Deep Slide 2 (74) -> 3-Point Land (75) -> Idle in 0.96s', () => {
  let state = triggerHeroineAnimation(createInitialHeroineAnimState(), 'dodge');
  assert.equal(state.duration, HEROINE_DODGE_DURATION);
  assert.equal(state.duration, 0.96);

  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };
  const order: number[] = [];
  let minYHop = 0;
  let minXProgress = 0;
  let sawDashDuringSlide = false;
  let sawLandingCushionSquash = false;

  for (let i = 0; i < 65; i++) {
    const sample = stepHeroineAnimState(state, 0.02, ctx);
    state = sample.state;
    if (order[order.length - 1] !== sample.frameIndex) {
      order.push(sample.frameIndex);
    }
    if (sample.yHopPx < minYHop) minYHop = sample.yHopPx;
    if (sample.xProgress < minXProgress) minXProgress = sample.xProgress;
    if ((sample.frameIndex === 72 || sample.frameIndex === 73 || sample.frameIndex === 74) && sample.isDashing) {
      sawDashDuringSlide = true;
    }
    if (sample.frameIndex === 75 && sample.breathScaleY < 0.99 && sample.breathScaleX > 1.01) {
      sawLandingCushionSquash = true;
    }
    if (state.mode === 'idle') break;
  }

  assert.deepEqual(order, [72, 73, 74, 75, 0]);
  assert.ok(minYHop <= -28, `Vault takeoff should reach parabolic apex, got minYHop=${minYHop}`);
  assert.ok(minXProgress <= -0.25, `Power-slide should sweep backward cleanly, got minXProgress=${minXProgress}`);
  assert.equal(sawDashDuringSlide, true);
  assert.equal(sawLandingCushionSquash, true);
  assert.equal(state.mode, 'idle');
});

test('shouldKiraDodgeAttack triggers exclusively for Kira when taking 0 HP damage AND 0 Armor damage', () => {
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: false, hpDamage: 0, armorDamage: 0 }),
    true,
  );
  // Armor took damage (even though HP damage is 0) -> must NOT dodge (plays guard/BLOCKED)
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: false, hpDamage: 0, armorDamage: 3 }),
    false,
  );
  // HP took damage -> must NOT dodge
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: false, hpDamage: 4, armorDamage: 0 }),
    false,
  );
  // Lethal -> must NOT dodge
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: true, hpDamage: 0, armorDamage: 0 }),
    false,
  );
  // Non-Kira heroines never play Kira's dodge
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'auraline', isLethal: false, hpDamage: 0, armorDamage: 0 }),
    false,
  );
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'zuri', isLethal: false, hpDamage: 0, armorDamage: 0 }),
    false,
  );
});

