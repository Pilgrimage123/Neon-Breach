import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  AURALINE_CANONICAL_HEIGHT,
  AURALINE_SHEET_FRAMES,
  AURALINE_SHEET_HEIGHT,
  AURALINE_SHEET_WIDTH,
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

test('all 40 Auraline sprite sheet frames lie cleanly inside sheet bounds without overlap and normalize to 214px height', () => {
  assert.equal(AURALINE_SHEET_FRAMES.length, 40);

  const dims = readPngDimensions('src/assets/sprites/auraline_spritesheet.png');
  assert.equal(dims.width, AURALINE_SHEET_WIDTH);
  assert.equal(dims.height, AURALINE_SHEET_HEIGHT);
  assert.equal(dims.width, 3545);
  assert.equal(dims.height, 1703);

  const f39 = AURALINE_SHEET_FRAMES[39];
  assert.equal(f39.id, 'aurelia_r0_f9');
  assert.equal(f39.row, 0);
  assert.equal(f39.col, 9);
  assert.equal(f39.x, 2991);
  assert.equal(f39.y, 12);

  for (const frame of AURALINE_SHEET_FRAMES) {
    assert.ok(frame.x >= 0 && frame.y >= 0, `${frame.id} has negative origin`);
    assert.ok(frame.w > 100 && frame.h > 100, `${frame.id} dimensions too small`);
    assert.ok(frame.x + frame.w <= AURALINE_SHEET_WIDTH, `${frame.id} overflows sheet width`);
    assert.ok(frame.y + frame.h <= AURALINE_SHEET_HEIGHT, `${frame.id} overflows sheet height`);
    assert.ok(frame.anchorX > 0 && frame.anchorX < frame.w, `${frame.id} invalid anchorX`);
    assert.ok(frame.bottomY > 0 && frame.bottomY <= frame.h, `${frame.id} invalid bottomY`);
    assert.ok(frame.rowScale > 0.35 && frame.rowScale < 0.75, `${frame.id} invalid rowScale`);
  }

  const standingSamples = [
    { index: 0, effectiveH: AURALINE_SHEET_FRAMES[0].h * AURALINE_SHEET_FRAMES[0].rowScale },
    { index: 9, effectiveH: AURALINE_SHEET_FRAMES[9].h * AURALINE_SHEET_FRAMES[9].rowScale },
    { index: 19, effectiveH: AURALINE_SHEET_FRAMES[19].h * AURALINE_SHEET_FRAMES[19].rowScale },
    { index: 39, effectiveH: AURALINE_SHEET_FRAMES[39].h * AURALINE_SHEET_FRAMES[39].rowScale },
  ];
  for (const s of standingSamples) {
    assert.ok(
      Math.abs(s.effectiveH - AURALINE_CANONICAL_HEIGHT) <= 5,
      `Frame ${s.index} effective standing height ${s.effectiveH.toFixed(1)} deviates from ${AURALINE_CANONICAL_HEIGHT}`,
    );
  }

  for (let i = 0; i < AURALINE_SHEET_FRAMES.length; i++) {
    for (let j = i + 1; j < AURALINE_SHEET_FRAMES.length; j++) {
      const a = AURALINE_SHEET_FRAMES[i];
      const b = AURALINE_SHEET_FRAMES[j];
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
      assert.equal(overlapX && overlapY, false, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('Auraline idle state cycles calm/curtsy/aim windows and snaps to tactical hover poses (attack->9, defense->19, tech->6)', () => {
  const idle = createInitialHeroAnimState();
  const baseCtx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };

  const calm = stepAuralineAnimState(idle, 0.016, baseCtx);
  assert.equal(calm.frameIndex, 0);

  const curtsyFrames = new Set<number>();
  for (let t = 2.0; t <= 3.88; t += 0.04) {
    const s = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: t });
    curtsyFrames.add(s.frameIndex);
  }
  assert.ok(curtsyFrames.has(0), 'curtsy loop should include frame 0');
  assert.ok(curtsyFrames.has(8), 'curtsy loop should include frame 8');
  assert.ok(curtsyFrames.has(39), 'curtsy loop should include missing return frame 39');

  const inspectSample = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.4 });
  assert.ok(
    inspectSample.frameIndex >= 9 && inspectSample.frameIndex <= 11,
    `expected idle2 aim frame 9..11, got ${inspectSample.frameIndex}`,
  );

  const atkHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.8, hoveredColor: 'attack' });
  assert.equal(atkHover.frameIndex, 9);

  const defHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 7.4, hoveredColor: 'defense' });
  assert.equal(defHover.frameIndex, 19);

  const techHover = stepAuralineAnimState(idle, 0.016, { ...baseCtx, totalTime: 2.8, hoveredColor: 'tech' });
  assert.equal(techHover.frameIndex, 6);
});

test('Auraline shoot emits 2 muzzle blasts on frames 13 & 14, dash_kick dashes >0.9 and blasts on 14, overdrive chains kick + dual shots', () => {
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 1.0 };

  let shootState = triggerAuralineAnimation(createInitialHeroAnimState(), 'shoot');
  const shootFrames: number[] = [];
  let shotCount = 0;
  for (let i = 0; i < 40; i++) {
    const sample = stepAuralineAnimState(shootState, 0.02, ctx);
    shootState = sample.state;
    if (sample.shouldEmitShot) {
      shotCount++;
      shootFrames.push(sample.frameIndex);
    }
  }
  assert.equal(shotCount, 2);
  assert.deepEqual(shootFrames, [13, 14]);
  assert.equal(shootState.mode, 'idle');

  let kickState = triggerAuralineAnimation(createInitialHeroAnimState(), 'dash_kick');
  let maxProgress = 0;
  let kickImpacts = 0;
  const kickFrames: number[] = [];
  for (let i = 0; i < 60; i++) {
    const sample = stepAuralineAnimState(kickState, 0.02, ctx);
    kickState = sample.state;
    if (sample.xProgress > maxProgress) maxProgress = sample.xProgress;
    if (sample.shouldEmitKickImpact) {
      kickImpacts++;
      kickFrames.push(sample.frameIndex);
    }
  }
  assert.ok(maxProgress > 0.9, `dash_kick should reach near enemy, got ${maxProgress}`);
  assert.equal(kickImpacts, 1);
  assert.deepEqual(kickFrames, [14]);
  assert.equal(kickState.mode, 'idle');

  let odState = triggerAuralineAnimation(createInitialHeroAnimState(), 'overdrive');
  let odKicks = 0;
  let odShots = 0;
  const odShotFrames: number[] = [];
  for (let i = 0; i < 65; i++) {
    const sample = stepAuralineAnimState(odState, 0.02, ctx);
    odState = sample.state;
    if (sample.shouldEmitKickImpact) odKicks++;
    if (sample.shouldEmitShot) {
      odShots++;
      odShotFrames.push(sample.frameIndex);
    }
  }
  assert.equal(odKicks, 1);
  assert.equal(odShots, 2);
  assert.deepEqual(odShotFrames, [13, 15]);
  assert.equal(odState.mode, 'idle');
});

test('Auraline hit, defeat, victory, and unified character dispatcher work cleanly without regressing Kira', () => {
  const ctx = { isDead: false, isVictory: false, hoveredColor: null, totalTime: 2.0 };

  let hitState = triggerCharacterAnimation(createInitialHeroAnimState(), 'hit', 'auraline', {
    lowHpHit: true,
  });
  const hitFrames = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const sample = stepCharacterAnimState(hitState, 0.02, 'auraline', ctx);
    hitState = sample.state;
    hitFrames.add(sample.frameIndex);
  }
  assert.ok(hitFrames.has(20) && hitFrames.has(22));
  assert.equal(hitState.mode, 'idle');

  let deadState = createInitialHeroAnimState();
  let lastDeadFrame = -1;
  for (let i = 0; i < 70; i++) {
    const sample = stepCharacterAnimState(deadState, 0.02, 'auraline', {
      ...ctx,
      isDead: true,
    });
    deadState = sample.state;
    lastDeadFrame = sample.frameIndex;
  }
  assert.equal(deadState.mode, 'defeat');
  assert.equal(lastDeadFrame, 38);

  let vicState = createInitialHeroAnimState();
  let finalVicFrame = -1;
  for (let i = 0; i < 60; i++) {
    const sample = stepCharacterAnimState(vicState, 0.02, 'auraline', {
      ...ctx,
      isVictory: true,
      totalTime: 2.0 + i * 0.02,
    });
    vicState = sample.state;
    finalVicFrame = sample.frameIndex;
  }
  assert.equal(vicState.mode, 'victory');
  assert.equal(finalVicFrame, 5);

  const kiraShoot = triggerCharacterAnimation(createInitialHeroAnimState(), 'shoot', 'kira');
  const kiraSample = stepCharacterAnimState(kiraShoot, 0.02, 'kira', ctx);
  assert.equal(kiraSample.frame.sheet, 'combat');
});

test('Auraline frame 39 (Row 0 Col 9) has dense opaque pixels and clean background without floor shadows', () => {
  const f39 = AURALINE_SHEET_FRAMES[39];
  assert.equal(f39.id, 'aurelia_r0_f9');

  const buf = fs.readFileSync(path.resolve(process.cwd(), 'src/assets/sprites/auraline_spritesheet.png'));
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
    if (y >= f39.y && y < f39.y + f39.h) {
      for (let x = f39.x; x < f39.x + f39.w; x++) {
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

  assert.ok(opaqueCount > 70000, `Expected >70000 opaque pixels in frame 39, got ${opaqueCount}`);
  assert.ok(minCharY <= f39.y + 20, `Character head starts too low: ${minCharY}`);
  assert.ok(maxCharY >= f39.y + f39.h - 15, `Character feet end too high: ${maxCharY}`);
});
