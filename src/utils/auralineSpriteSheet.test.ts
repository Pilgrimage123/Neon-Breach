import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  AURALINE_CANONICAL_HEIGHT,
  AURALINE_SHEET_A_FRAMES,
  AURALINE_SHEET_B_FRAMES,
  AURALINE_SHEET_FRAMES,
  AURALINE_SHEET_HEIGHT,
  AURALINE_SHEET_WIDTH,
  shouldAuralineAegisCounter,
  stepAuralineAnimState,
  triggerAuralineAnimation,
} from './auralineSpriteSheet';
import { stepCharacterAnimState, triggerCharacterAnimation } from './characterAnimator';
import { createInitialHeroAnimState } from './heroAnimator';

function readPngDimensions(relPath: string): { width: number; height: number } {
  const buf = fs.readFileSync(path.resolve(process.cwd(), relPath));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

test('all 32 Auraline dual 4x4 sprite sheet frames lie cleanly inside 1024x1024 sheet bounds and normalize to 230.2px height', () => {
  assert.equal(AURALINE_SHEET_A_FRAMES.length, 16);
  assert.equal(AURALINE_SHEET_B_FRAMES.length, 16);
  assert.equal(AURALINE_SHEET_FRAMES.length, 32);

  const dimsA = readPngDimensions('src/assets/sprites/baked/auraline_sheet_a.png');
  const dimsB = readPngDimensions('src/assets/sprites/baked/auraline_sheet_b.png');
  assert.equal(dimsA.width, AURALINE_SHEET_WIDTH);
  assert.equal(dimsA.height, AURALINE_SHEET_HEIGHT);
  assert.equal(dimsB.width, AURALINE_SHEET_WIDTH);
  assert.equal(dimsB.height, AURALINE_SHEET_HEIGHT);
  assert.equal(dimsA.width, 1024);
  assert.equal(dimsA.height, 1024);

  const vfxDims = readPngDimensions('src/assets/images/auraline_surge_blast_vfx.png');
  assert.equal(vfxDims.width, 1086);
  assert.equal(vfxDims.height, 362);

  for (const frame of AURALINE_SHEET_FRAMES) {
    assert.equal(frame.w, 256, `${frame.id} must be 256px wide`);
    assert.equal(frame.h, 256, `${frame.id} must be 256px tall`);
    assert.ok(frame.x >= 0 && frame.y >= 0, `${frame.id} has negative origin`);
    assert.ok(frame.x + frame.w <= AURALINE_SHEET_WIDTH, `${frame.id} overflows sheet width`);
    assert.ok(frame.y + frame.h <= AURALINE_SHEET_HEIGHT, `${frame.id} overflows sheet height`);
    assert.ok(frame.anchorX >= 100 && frame.anchorX <= 150, `${frame.id} invalid anchorX ${frame.anchorX}`);
    assert.equal(frame.bottomY, 249, `${frame.id} must be sole-locked at bottomY = 249`);
    assert.ok(
      Math.abs(238 * frame.rowScale - AURALINE_CANONICAL_HEIGHT) <= 1,
      `${frame.id} effective standing height deviates from ${AURALINE_CANONICAL_HEIGHT}`,
    );
  }

  // F11 (Artillery Surge Blast peak recoil roar pose) carries the muzzle landmark at (83, -163)
  const f11 = AURALINE_SHEET_FRAMES[11];
  assert.equal(f11.id, 'auraline_f11');
  assert.deepEqual(f11.muzzleRel, { dx: 83, dy: -163 });
});

test('Auraline idle state cycles calm/curtsy/gun-inspect windows and snaps to tactical hover poses (attack->6, defense->13, tech->27)', () => {
  const idle = createInitialHeroAnimState();
  const baseCtx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 0.1 };

  const calm = stepAuralineAnimState(idle, 0.016, baseCtx);
  assert.equal(calm.frameIndex, 0);

  const curtsyFrames = new Set<number>();
  for (let t = 2.2; t < 3.6; t += 0.1) {
    const s = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: t });
    curtsyFrames.add(s.frameIndex);
  }
  assert.ok(curtsyFrames.has(23), 'curtsy loop should include frame 23');
  assert.ok(curtsyFrames.has(24), 'curtsy loop should include frame 24');

  const inspectSample = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.3 });
  assert.ok(
    inspectSample.frameIndex === 25 || inspectSample.frameIndex === 26,
    `expected idle2 gun-inspect frame 25..26, got ${inspectSample.frameIndex}`,
  );

  const atkHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.8, hoveredColor: 'attack' });
  assert.equal(atkHover.frameIndex, 6);

  const defHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.4, hoveredColor: 'defense' });
  assert.equal(defHover.frameIndex, 13);

  const techHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.8, hoveredColor: 'tech' });
  assert.equal(techHover.frameIndex, 27);
});

test('Auraline shoot, dash_kick (Artillery Surge Blast), and overdrive (Sovereign Broadside) stay 100% planted (xProgress = 0) and emit muzzle shots', () => {
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };

  let shootState = triggerAuralineAnimation(createInitialHeroAnimState(), 'shoot');
  const shootFrames: number[] = [];
  for (let i = 0; i < 40; i++) {
    const sample = stepAuralineAnimState(shootState, 0.02, ctx);
    shootState = sample.state;
    assert.equal(sample.xProgress, 0, 'shoot must remain planted');
    if (sample.shouldEmitShot) {
      shootFrames.push(sample.frameIndex);
    }
  }
  assert.deepEqual(shootFrames, [7]);
  assert.equal(shootState.mode, 'idle');

  let surgeState = triggerAuralineAnimation(createInitialHeroAnimState(), 'dash_kick');
  const surgeFrames: number[] = [];
  for (let i = 0; i < 45; i++) {
    const sample = stepAuralineAnimState(surgeState, 0.02, ctx);
    surgeState = sample.state;
    assert.equal(sample.xProgress, 0, 'Artillery Surge Blast (dash_kick) must remain 100% planted');
    assert.equal(sample.shouldEmitKickImpact, false, 'Artillery Surge Blast is ranged, never melee kick');
    if (sample.shouldEmitShot) {
      surgeFrames.push(sample.frameIndex);
    }
  }
  assert.deepEqual(surgeFrames, [11]);
  assert.equal(surgeState.mode, 'idle');

  let odState = triggerAuralineAnimation(createInitialHeroAnimState(), 'overdrive');
  const odShotFrames: number[] = [];
  for (let i = 0; i < 55; i++) {
    const sample = stepAuralineAnimState(odState, 0.02, ctx);
    odState = sample.state;
    assert.equal(sample.xProgress, 0, 'Sovereign Broadside overdrive must remain 100% planted');
    if (sample.shouldEmitShot) {
      odShotFrames.push(sample.frameIndex);
    }
  }
  assert.deepEqual(odShotFrames, [21]);
  assert.equal(odState.mode, 'idle');
});

test('Auraline hit, defeat, victory, and shouldAuralineAegisCounter work cleanly', () => {
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 2.0 };

  assert.equal(shouldAuralineAegisCounter({ charId: 'auraline', isLethal: false, hpDamage: 0, armorDamage: 8 }), true);
  assert.equal(shouldAuralineAegisCounter({ charId: 'auraline', isLethal: false, hpDamage: 4, armorDamage: 8 }), false);
  assert.equal(shouldAuralineAegisCounter({ charId: 'kira', isLethal: false, hpDamage: 0, armorDamage: 8 }), false);

  let hitState = triggerCharacterAnimation(createInitialHeroAnimState(), 'hit', 'auraline', {
    lowHpHit: true,
  });
  const hitFrames = new Set<number>();
  for (let i = 0; i < 30; i++) {
    const sample = stepCharacterAnimState(hitState, 0.02, 'auraline', ctx);
    hitState = sample.state;
    hitFrames.add(sample.frameIndex);
  }
  assert.ok(hitFrames.has(14));
  assert.equal(hitState.mode, 'idle');

  let deadState = createInitialHeroAnimState();
  let lastDeadFrame = -1;
  for (let i = 0; i < 60; i++) {
    const sample = stepCharacterAnimState(deadState, 0.02, 'auraline', {
      ...ctx,
      isDead: true,
    });
    deadState = sample.state;
    lastDeadFrame = sample.frameIndex;
  }
  assert.equal(deadState.mode, 'defeat');
  assert.equal(lastDeadFrame, 15);

  let vicState = createInitialHeroAnimState();
  let finalVicFrame = -1;
  for (let i = 0; i < 50; i++) {
    const sample = stepCharacterAnimState(vicState, 0.02, 'auraline', {
      ...ctx,
      isVictory: true,
      totalTime: 2.0 + i * 0.02,
    });
    vicState = sample.state;
    finalVicFrame = sample.frameIndex;
  }
  assert.equal(vicState.mode, 'victory');
  assert.equal(finalVicFrame, 31);
});

test('Auraline frame F11 (Artillery Surge Blast strong-shot pose in auraline_sheet_a.png) has dense watertight opaque pixels and sole-locked boots', () => {
  const f11 = AURALINE_SHEET_FRAMES[11];
  assert.equal(f11.id, 'auraline_f11');

  const buf = fs.readFileSync(path.resolve(process.cwd(), 'src/assets/sprites/baked/auraline_sheet_a.png'));
  let pos = 8, width = 0, height = 0, colorType = 0;
  const idatChunks: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      colorType = buf[pos + 17];
    } else if (type === 'IDAT') idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  let srcPos = 0, prevRow = Buffer.alloc(stride), currRow = Buffer.alloc(stride);
  let opaqueCount = 0;
  let minCharY = 9999, maxCharY = -1;

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcPos++];
    for (let i = 0; i < stride; i++) {
      const raw = decompressed[srcPos++];
      let val = 0;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + (i >= bpp ? currRow[i - bpp] : 0)) & 0xff;
      else if (filter === 2) val = (raw + prevRow[i]) & 0xff;
      else if (filter === 3) val = (raw + Math.floor(((i >= bpp ? currRow[i - bpp] : 0) + prevRow[i]) / 2)) & 0xff;
      else if (filter === 4) {
        const a = i >= bpp ? currRow[i - bpp] : 0, b = prevRow[i], c = i >= bpp ? prevRow[i - bpp] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (raw + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff;
      }
      currRow[i] = val;
    }
    if (y >= f11.y && y < f11.y + f11.h) {
      for (let x = f11.x; x < f11.x + f11.w; x++) {
        const alpha = bpp === 4 ? currRow[x * bpp + 3] : 255;
        if (alpha > 30) {
          opaqueCount++;
          if (y < minCharY) minCharY = y;
          if (y > maxCharY) maxCharY = y;
        }
      }
    }
    const temp = prevRow; prevRow = currRow; currRow = temp;
  }

  assert.ok(opaqueCount > 24000, `Expected >24000 opaque pixels in F11 cell, got ${opaqueCount}`);
  assert.ok(minCharY <= f11.y + 30, `F11 head starts too low: ${minCharY - f11.y}`);
  assert.equal(maxCharY - f11.y, 249, `F11 boot sole must sit at y=249, got ${maxCharY - f11.y}`);
});

test('auraline_surge_blast_vfx.png has feathered zero-alpha right tail and top/bottom edges to prevent box cutoffs', () => {
  const buf = fs.readFileSync(path.resolve(process.cwd(), 'src/assets/images/auraline_surge_blast_vfx.png'));
  let pos = 8, width = 0, height = 0, colorType = 0;
  const idatChunks: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      colorType = buf[pos + 17];
    } else if (type === 'IDAT') idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  assert.equal(colorType, 6, 'surge blast VFX must preserve RGBA alpha channel');
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = width * bpp;
  let srcPos = 0, prevRow = Buffer.alloc(stride), currRow = Buffer.alloc(stride);
  let maxRightEdgeAlpha = 0;
  let maxTopEdgeAlpha = 0;
  let maxBottomEdgeAlpha = 0;
  let maxMuzzleCoreAlpha = 0;

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcPos++];
    for (let i = 0; i < stride; i++) {
      const raw = decompressed[srcPos++];
      let val = 0;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + (i >= bpp ? currRow[i - bpp] : 0)) & 0xff;
      else if (filter === 2) val = (raw + prevRow[i]) & 0xff;
      else if (filter === 3) val = (raw + Math.floor(((i >= bpp ? currRow[i - bpp] : 0) + prevRow[i]) / 2)) & 0xff;
      else if (filter === 4) {
        const a = i >= bpp ? currRow[i - bpp] : 0, b = prevRow[i], c = i >= bpp ? prevRow[i - bpp] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (raw + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff;
      }
      currRow[i] = val;
    }
    if (y === 0) {
      for (let x = 0; x < width; x++) maxTopEdgeAlpha = Math.max(maxTopEdgeAlpha, currRow[x * 4 + 3]);
    }
    if (y === height - 1) {
      for (let x = 0; x < width; x++) maxBottomEdgeAlpha = Math.max(maxBottomEdgeAlpha, currRow[x * 4 + 3]);
    }
    if (y >= 160 && y <= 200) {
      maxMuzzleCoreAlpha = Math.max(maxMuzzleCoreAlpha, currRow[215 * 4 + 3]);
    }
    maxRightEdgeAlpha = Math.max(maxRightEdgeAlpha, currRow[(width - 1) * 4 + 3]);
    const temp = prevRow; prevRow = currRow; currRow = temp;
  }

  assert.equal(maxRightEdgeAlpha, 0, 'rightmost column must dissolve completely to alpha 0');
  assert.equal(maxTopEdgeAlpha, 0, 'topmost row must have alpha 0');
  assert.equal(maxBottomEdgeAlpha, 0, 'bottommost row must have alpha 0');
  assert.equal(maxMuzzleCoreAlpha, 255, 'muzzle focal star core must remain full brightness');
});
