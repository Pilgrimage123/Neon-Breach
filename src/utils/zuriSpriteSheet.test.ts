import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialHeroAnimState } from './heroAnimator';
import {
  ZURI_DRONE_FRAMES,
  sampleZuriDroneFormation,
} from './zuriDroneFormation';
import {
  ZURI_COMBAT_FRAMES,
  ZURI_DRONES_SHEET_HEIGHT,
  ZURI_DRONES_SHEET_WIDTH,
  ZURI_EMOTE_FRAMES,
  ZURI_EMOTE_SHEET_HEIGHT,
  ZURI_EMOTE_SHEET_WIDTH,
  ZURI_SHEET_FRAMES,
  ZURI_SHEET_HEIGHT,
  ZURI_SHEET_WIDTH,
  stepZuriAnimState,
  triggerZuriAnimation,
} from './zuriSpriteSheet';

test('ZURI_SHEET_FRAMES combines 24 combat frames and 29 emote frames within valid sheet bounds', () => {
  assert.equal(ZURI_COMBAT_FRAMES.length, 24);
  assert.equal(ZURI_EMOTE_FRAMES.length, 29);
  assert.equal(ZURI_SHEET_FRAMES.length, 53);

  for (let i = 0; i < ZURI_SHEET_FRAMES.length; i++) {
    const f = ZURI_SHEET_FRAMES[i];
    const isEmote: boolean = i >= ZURI_COMBAT_FRAMES.length;
    const maxW = isEmote ? ZURI_EMOTE_SHEET_WIDTH : ZURI_SHEET_WIDTH;
    const maxH = isEmote ? ZURI_EMOTE_SHEET_HEIGHT : ZURI_SHEET_HEIGHT;
    assert.equal(f.sheet, isEmote ? 'emote' : 'combat');
    assert.ok(f.x >= 0 && f.x + f.w <= maxW, `frame ${i} (${f.id}) x out of bounds (${f.x}+${f.w} > ${maxW})`);
    assert.ok(f.y >= 0 && f.y + f.h <= maxH, `frame ${i} (${f.id}) y out of bounds (${f.y}+${f.h} > ${maxH})`);
    assert.ok(f.anchorX > 0 && f.anchorX < f.w, `frame ${i} (${f.id}) anchorX out of bounds`);
    assert.ok(f.bottomY > 0 && f.bottomY <= f.h, `frame ${i} (${f.id}) bottomY out of bounds`);
  }
});

test('ZURI_DRONE_FRAMES has 3 distinct drone cutouts within 2172x724 bounds', () => {
  assert.equal(ZURI_DRONE_FRAMES.length, 3);
  assert.deepEqual(
    ZURI_DRONE_FRAMES.map((d) => d.id),
    ['shield', 'med', 'strike'],
  );
  for (const d of ZURI_DRONE_FRAMES) {
    assert.ok(d.x >= 0 && d.x + d.w <= ZURI_DRONES_SHEET_WIDTH, `drone ${d.id} x out of bounds`);
    assert.ok(d.y >= 0 && d.y + d.h <= ZURI_DRONES_SHEET_HEIGHT, `drone ${d.id} y out of bounds`);
  }
});

test('Zuri does not dash across the stage during moves, flying up and down and using DEFEND sprites on guard', () => {
  for (const mode of ['shoot', 'dash_kick', 'overdrive', 'guard', 'upgrade'] as const) {
    let state = triggerZuriAnimation(createInitialHeroAnimState(), mode);
    let minYHop = Infinity;
    let maxYHop = -Infinity;
    let maxXProgress = 0;
    let shots = 0;
    let kicks = 0;
    const framesSeen = new Set<number>();

    for (let step = 0; step < 60; step++) {
      const sample = stepZuriAnimState(state, 0.02, {
        isDead: false,
        isVictory: false,
        hoveredColor: null,
        totalTime: step * 0.02,
      });
      state = sample.state;
      if (state.mode === mode) {
        framesSeen.add(sample.frameIndex);
      }
      if (sample.yHopPx < minYHop) minYHop = sample.yHopPx;
      if (sample.yHopPx > maxYHop) maxYHop = sample.yHopPx;
      if (sample.xProgress > maxXProgress) maxXProgress = sample.xProgress;
      assert.equal(sample.isDashing, false, `Zuri should not melee-dash herself during ${mode}`);
      if (sample.shouldEmitShot) shots++;
      if (sample.shouldEmitKickImpact) kicks++;
    }

    assert.ok(
      maxYHop - minYHop >= 42,
      `Expected Zuri to fly up and down >= 42px during ${mode}, got range ${minYHop}..${maxYHop}`,
    );
    assert.ok(
      maxXProgress <= 0.08,
      `Expected Zuri to stay in command station during ${mode}, got xProgress=${maxXProgress}`,
    );

    if (mode === 'shoot') assert.equal(shots, 2);
    if (mode === 'dash_kick') assert.equal(kicks, 1);
    if (mode === 'overdrive') {
      assert.equal(kicks, 1);
      assert.equal(shots, 2);
    }
    if (mode === 'guard') {
      assert.ok(framesSeen.has(43) && framesSeen.has(47) && framesSeen.has(52), 'Expected DEFEND sprite frames 43..52 during guard');
    }
  }
});

test('Zuri defeat uses DEATH frames (24..32) and settles prone on deck', () => {
  let state = createInitialHeroAnimState();
  const seen = new Set<number>();
  let lastSample = stepZuriAnimState(state, 0.02, {
    isDead: true,
    isVictory: false,
    hoveredColor: null,
    totalTime: 0.02,
  });
  seen.add(lastSample.frameIndex);
  state = lastSample.state;

  for (let i = 2; i <= 80; i++) {
    lastSample = stepZuriAnimState(state, 0.02, {
      isDead: true,
      isVictory: false,
      hoveredColor: null,
      totalTime: i * 0.02,
    });
    seen.add(lastSample.frameIndex);
    state = lastSample.state;
  }

  assert.ok(seen.has(24) && seen.has(28) && seen.has(32), 'Expected progression through DEATH frames 24..32');
  assert.equal(lastSample.frameIndex, 32, 'Expected defeat to hold on final flat prone frame 32');
  assert.equal(Math.round(lastSample.yHopPx), 0, 'Expected prone collapse to settle cleanly on deck');
});

test('Zuri victory plays VICTORY somersault frames (33..42) while soaring up and down', () => {
  let state = createInitialHeroAnimState();
  const seen = new Set<number>();
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < 80; i++) {
    const sample = stepZuriAnimState(state, 0.02, {
      isDead: false,
      isVictory: true,
      hoveredColor: null,
      totalTime: i * 0.02,
    });
    state = sample.state;
    seen.add(sample.frameIndex);
    if (sample.yHopPx < minY) minY = sample.yHopPx;
    if (sample.yHopPx > maxY) maxY = sample.yHopPx;
  }

  assert.ok(seen.has(33) && seen.has(37) && seen.has(42), 'Expected progression through VICTORY frames 33..42');
  assert.ok(maxY - minY >= 80, `Expected high aerial jump/backflip travel during VICTORY, got ${minY}..${maxY}`);
});

test('sampleZuriDroneFormation dispatches Strike Drone toward target during attack moves', () => {
  const idleState = createInitialHeroAnimState();
  const idleDrones = sampleZuriDroneFormation({
    animState: idleState,
    heroineX: 200,
    heroineDrawBottomY: 380,
    groundY: 410,
    targetX: 820,
    targetMidY: 320,
    scale: 1,
    totalTime: 1.0,
    hoveredColor: null,
  });

  const dashState = {
    ...triggerZuriAnimation(idleState, 'dash_kick'),
    elapsed: 0.41,
  };
  const attackDrones = sampleZuriDroneFormation({
    animState: dashState,
    heroineX: 200,
    heroineDrawBottomY: 380,
    groundY: 410,
    targetX: 820,
    targetMidY: 320,
    scale: 1,
    totalTime: 1.41,
    hoveredColor: null,
  });

  assert.ok(
    attackDrones.strike.x > idleDrones.strike.x + 350,
    `Expected strike drone to surge toward enemy (${attackDrones.strike.x} vs ${idleDrones.strike.x})`,
  );
  assert.equal(attackDrones.strike.activeGlow, 1);
});

test('Zuri ambient idle smoothly cycles all 8 hover frames (8..15) and active moves maintain continuous flight velocity', () => {
  // Verify ambient hover visits all 8 IDLE frames 8..15 smoothly with no discontinuous jump
  let idleState = createInitialHeroAnimState();
  const hoverFrames = new Set<number>();
  for (let i = 0; i < 110; i++) {
    const s = stepZuriAnimState(idleState, 0.02, {
      isDead: false,
      isVictory: false,
      hoveredColor: null,
      totalTime: i * 0.02,
    });
    idleState = s.state;
    hoverFrames.add(s.frameIndex);
  }
  for (let f = 8; f <= 15; f++) {
    assert.ok(hoverFrames.has(f), `Expected ambient hover to visit frame ${f}`);
  }

  // Verify smooth step-to-step yHopPx velocity across combat moves (no harsh vertical snapping)
  for (const mode of ['shoot', 'dash_kick', 'overdrive', 'guard', 'upgrade', 'victory'] as const) {
    let state = triggerZuriAnimation(createInitialHeroAnimState(), mode);
    let prevY: number | null = null;
    let maxStepDelta = 0;
    for (let i = 0; i < 70; i++) {
      const s = stepZuriAnimState(state, 0.02, {
        isDead: false,
        isVictory: mode === 'victory',
        hoveredColor: null,
        totalTime: i * 0.02,
      });
      state = s.state;
      if (prevY !== null) {
        maxStepDelta = Math.max(maxStepDelta, Math.abs(s.yHopPx - prevY));
      }
      prevY = s.yHopPx;
    }
    assert.ok(
      maxStepDelta <= 18,
      `Expected fluent <=18px vertical step per 20ms during ${mode}, got ${maxStepDelta.toFixed(1)}px`,
    );
  }

  // Verify DEFEND frames 43..52 keep torso anchorX aligned within a tight 8px window
  const defendAnchors = ZURI_EMOTE_FRAMES.slice(19, 29).map((f) => f.anchorX);
  assert.ok(
    Math.max(...defendAnchors) - Math.min(...defendAnchors) <= 8,
    `Expected DEFEND torso anchorX spread <= 8px, got ${defendAnchors.join(',')}`,
  );

  // Verify hovering attack/defense/tech tiles does not cause instant yHopPx teleport
  const baseIdle = stepZuriAnimState(createInitialHeroAnimState(), 0.02, {
    isDead: false,
    isVictory: false,
    hoveredColor: null,
    totalTime: 1.5,
  });
  for (const color of ['attack', 'defense', 'tech'] as const) {
    const hovered = stepZuriAnimState(baseIdle.state, 0.02, {
      isDead: false,
      isVictory: false,
      hoveredColor: color,
      totalTime: 1.52,
    });
    assert.ok(
      Math.abs(hovered.yHopPx - baseIdle.yHopPx) <= 2,
      `Expected continuous yHopPx when hovering ${color}, got ${baseIdle.yHopPx} -> ${hovered.yHopPx}`,
    );
  }
});

test('NURSE_FRAMES and sampleNurseAnimation cover all 8 frames within 2170x725 sheet bounds and react to Med Bay options', async () => {
  const { NURSE_FRAMES, NURSE_SHEET_HEIGHT, NURSE_SHEET_WIDTH, sampleNurseAnimation } = await import(
    './nurseSpriteSheet'
  );
  assert.equal(NURSE_FRAMES.length, 8);
  for (const nf of NURSE_FRAMES) {
    assert.ok(nf.x >= 0 && nf.x + nf.w <= NURSE_SHEET_WIDTH);
    assert.ok(nf.y >= 0 && nf.y + nf.h <= NURSE_SHEET_HEIGHT);
    assert.ok(nf.anchorX > 0 && nf.anchorX < nf.w);
  }

  const idleSeen = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const s = sampleNurseAnimation({
      totalTime: i * 0.1,
      focusedOption: null,
      actionFlashTimer: 0,
      hpRatio: 0.85,
    });
    idleSeen.add(s.frameIndex);
    assert.ok(s.blendAlpha >= 0 && s.blendAlpha <= 1);
  }
  for (let idx = 0; idx < 8; idx++) {
    assert.ok(idleSeen.has(idx), `Expected Nurse idle ping-pong to visit frame ${idx}`);
  }

  const healSample = sampleNurseAnimation({
    totalTime: 0.05,
    focusedOption: 'heal',
    actionFlashTimer: 0,
    hpRatio: 0.5,
  });
  assert.equal(healSample.frameIndex, 7, 'Expected heal hover to start with syringe-ready frame 7');

  // Verify Dr. Amara torso anchorX alignment stays within tight 8px spread across all 8 frames
  const anchors = NURSE_FRAMES.map((f) => f.anchorX);
  const spread = Math.max(...anchors) - Math.min(...anchors);
  assert.ok(
    spread <= 8,
    `Expected Dr. Amara torso anchorX spread <= 8px, got ${spread}px (${anchors.join(',')})`,
  );

  // Verify Hermite blendAlpha continuous smoothly over fine time steps
  let prevAlpha = 0;
  for (let t = 0; t < 2.0; t += 0.01) {
    const s = sampleNurseAnimation({
      totalTime: t,
      focusedOption: null,
      actionFlashTimer: 0,
      hpRatio: 0.85,
    });
    assert.ok(s.blendAlpha >= 0 && s.blendAlpha <= 1);
    assert.ok(s.breathScaleY >= 0.98 && s.breathScaleY <= 1.03);
    prevAlpha = s.blendAlpha;
  }
  assert.ok(prevAlpha >= 0);
});



