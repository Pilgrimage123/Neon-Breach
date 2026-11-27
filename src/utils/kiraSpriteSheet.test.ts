import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KIRA_CANONICAL_HEIGHT,
  KIRA_DODGE_DURATION,
  KIRA_SHEET_A_FRAMES,
  KIRA_SHEET_B_FRAMES,
  KIRA_SHEET_FRAMES,
  KIRA_SHEET_HEIGHT,
  KIRA_SHEET_WIDTH,
  KIRA_UNIFORM_ROW_SCALE,
  createInitialHeroAnimState,
  shouldKiraDodgeAttack,
  stepKiraAnimState,
  triggerKiraAnimation,
} from './kiraSpriteSheet';

function readPngHeader(relPath: string): { width: number; height: number; colorType: number; bytes: number } {
  const buf = fs.readFileSync(path.resolve(process.cwd(), relPath));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
    bytes: buf.byteLength,
  };
}

test('dual 4x4 Kira sheets (32 frames) lie cleanly inside 1024x1024 baked RGBA PNGs', () => {
  assert.equal(KIRA_SHEET_A_FRAMES.length, 16);
  assert.equal(KIRA_SHEET_B_FRAMES.length, 16);
  assert.equal(KIRA_SHEET_FRAMES.length, 32);
  assert.equal(KIRA_CANONICAL_HEIGHT, 214);
  assert.ok(KIRA_UNIFORM_ROW_SCALE > 0.6 && KIRA_UNIFORM_ROW_SCALE < 0.8);

  for (const relPath of [
    'src/assets/sprites/baked/kira_sheet_a.png',
    'src/assets/sprites/baked/kira_sheet_b.png',
  ]) {
    const hdr = readPngHeader(relPath);
    assert.equal(hdr.width, KIRA_SHEET_WIDTH);
    assert.equal(hdr.height, KIRA_SHEET_HEIGHT);
    assert.equal(hdr.colorType, 6, `${relPath} must be RGBA`);
  }

  for (const frame of KIRA_SHEET_FRAMES) {
    assert.ok(frame.x >= 0 && frame.y >= 0);
    assert.equal(frame.w, 256);
    assert.equal(frame.h, 256);
    assert.ok(frame.x + frame.w <= KIRA_SHEET_WIDTH);
    assert.ok(frame.y + frame.h <= KIRA_SHEET_HEIGHT);
    assert.ok(frame.anchorX > 60 && frame.anchorX < 196, `${frame.id} pelvis anchorX out of range`);
    assert.ok(frame.bottomY > 150 && frame.bottomY <= 256, `${frame.id} bottomY out of range`);
  }

  for (const idx of [6, 7, 10, 11]) {
    assert.ok(KIRA_SHEET_FRAMES[idx].muzzleRel, `frame ${idx} must have muzzleRel`);
  }
  assert.ok(KIRA_SHEET_FRAMES[21].kickTipRel, 'F21 Energy Dropkick must have kickTipRel');
});

test('idle state cycles planted breathing frames, emotes, and snaps to tactical hover poses', () => {
  const idle = createInitialHeroAnimState();
  const baseCtx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };

  const calm = stepKiraAnimState(idle, 0.016, baseCtx);
  assert.ok([0, 1, 3, 8].includes(calm.frameIndex));

  const idle1Sample = stepKiraAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.75 });
  assert.ok(idle1Sample.frameIndex === 23 || idle1Sample.frameIndex === 24);

  const idle2Sample = stepKiraAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.5 });
  assert.ok(idle2Sample.frameIndex === 25 || idle2Sample.frameIndex === 26);

  assert.equal(stepKiraAnimState(idle, 0.016, { ...baseCtx, hoveredColor: 'attack' }).frameIndex, 6);
  assert.equal(stepKiraAnimState(idle, 0.016, { ...baseCtx, hoveredColor: 'defense' }).frameIndex, 13);
  assert.equal(stepKiraAnimState(idle, 0.016, { ...baseCtx, hoveredColor: 'tech' }).frameIndex, 27);
});

test('shoot and dash_kick (Surge Blast) emit shot events and return to idle with crisp cuts', () => {
  for (const mode of ['shoot', 'dash_kick'] as const) {
    let state = triggerKiraAnimation(createInitialHeroAnimState(), mode);
    let shots = 0;
    for (let i = 0; i < 45; i++) {
      const s = stepKiraAnimState(state, 0.02, {
        isDead: false,
        isVictory: false,
        hoveredColor: null,
        totalTime: 1.0,
      });
      assert.equal(s.frameBlendAlpha, 1);
      state = s.state;
      if (s.shouldEmitShot) shots++;
    }
    assert.equal(shots, 1, `${mode} should emit 1 shot event`);
    assert.equal(state.mode, 'idle');
  }
});

test('overdrive (Energy Dropkick) sprints, emits F21 kick impact, and returns to idle', () => {
  let state = triggerKiraAnimation(createInitialHeroAnimState(), 'overdrive');
  let impacts = 0;
  const seen = new Set<number>();
  for (let i = 0; i < 50; i++) {
    const s = stepKiraAnimState(state, 0.02, {
      isDead: false,
      isVictory: false,
      hoveredColor: null,
      totalTime: 2.0,
    });
    state = s.state;
    seen.add(s.frameIndex);
    if (s.shouldEmitKickImpact) impacts++;
  }
  assert.equal(impacts, 1);
  assert.ok(seen.has(21), 'should visit F21 double-footed Energy Dropkick');
  assert.equal(state.mode, 'idle');
});

test('shouldKiraDodgeAttack triggers only for Kira on non-lethal 0 HP + 0 Armor damage', () => {
  assert.equal(KIRA_DODGE_DURATION, 0.96);
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: false, hpDamage: 0, armorDamage: 0 }),
    true,
  );
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'kira', isLethal: false, hpDamage: 2, armorDamage: 0 }),
    false,
  );
  assert.equal(
    shouldKiraDodgeAttack({ charId: 'auraline', isLethal: false, hpDamage: 0, armorDamage: 0 }),
    false,
  );
});
