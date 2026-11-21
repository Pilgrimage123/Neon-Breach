import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOptionsKey,
  cleanDarkBackgroundData,
  cleanWhiteBackgroundData,
  computeSpriteBoundsFromData,
} from './spriteCutout';
import { AURALINE_SHEET_FRAMES } from './auralineSpriteSheet';
import { NURSE_FRAMES, NURSE_SHEET_OPTIONS } from './nurseSpriteSheet';
import {
  ZURI_DRONES_OPTIONS,
  ZURI_DRONE_FRAMES,
  ZURI_SHEET_FRAMES,
  ZURI_SHEET_OPTIONS,
} from './zuriSpriteSheet';

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgba(relPath: string): { width: number; height: number; data: Uint8ClampedArray } {
  const buf = fs.readFileSync(path.resolve(process.cwd(), relPath));
  let offset = 8; // Skip PNG signature
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4; // Skip CRC
  }

  assert.equal(bitDepth, 8, `Expected 8-bit PNG, got ${bitDepth}`);
  assert.ok(colorType === 2 || colorType === 6, `Expected RGB(2) or RGBA(6), got ${colorType}`);

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const recon = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const rowIn = y * (stride + 1);
    const filter = raw[rowIn];
    const rowOut = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[rowIn + 1 + i];
      const a = i >= bpp ? recon[rowOut + i - bpp] : 0;
      const b = y > 0 ? recon[rowOut - stride + i] : 0;
      const c = y > 0 && i >= bpp ? recon[rowOut - stride + i - bpp] : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (x + paethPredictor(a, b, c)) & 0xff;
      recon[rowOut + i] = val;
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  if (colorType === 6) {
    rgba.set(recon);
  } else {
    for (let i = 0, j = 0; i < recon.length; i += 3, j += 4) {
      rgba[j] = recon[i];
      rgba[j + 1] = recon[i + 1];
      rgba[j + 2] = recon[i + 2];
      rgba[j + 3] = 255;
    }
  }
  return { width, height, data: rgba };
}

function cropRgba(
  sheet: { width: number; height: number; data: Uint8ClampedArray },
  rect: { x: number; y: number; w: number; h: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const srcStart = ((rect.y + y) * sheet.width + rect.x) * 4;
    const dstStart = y * rect.w * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + rect.w * 4), dstStart);
  }
  return out;
}

test('cleanWhiteBackgroundData removes bottom floor shadow & trapped between-boot wedge while preserving upper white highlights', () => {
  const w = 100;
  const h = 100;
  const data = new Uint8ClampedArray(w * h * 4);

  const setPx = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    const p = (y * w + x) * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = a;
  };

  // Fill with bright white background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setPx(x, y, 252, 252, 252, 255);
    }
  }

  // Upper character dark outline & white dress/muzzle highlight (must stay opaque!)
  for (let y = 20; y <= 75; y++) {
    for (let x = 30; x <= 70; x++) {
      const isBorder = y === 20 || y === 75 || x === 30 || x === 70;
      setPx(x, y, isBorder ? 28 : 250, isBorder ? 24 : 250, isBorder ? 36 : 250, 255);
    }
  }

  // Two dark boots descending to y=94, enclosing a white wedge x=42..58, y=85..93
  for (let y = 76; y <= 94; y++) {
    for (let x = 32; x <= 40; x++) setPx(x, y, 25, 22, 32, 255);
    for (let x = 60; x <= 68; x++) setPx(x, y, 25, 22, 32, 255);
  }

  // Painted blue/cyan/lavender floor shadow strip across y=95..98 connecting bottom under boots
  for (let y = 95; y <= 98; y++) {
    for (let x = 26; x <= 74; x++) {
      if (y === 98) setPx(x, y, 32, 180, 192, 255); // cyan reflection
      else if (x % 2 === 0) setPx(x, y, 52, 92, 196, 255); // blue shadow
      else setPx(x, y, 215, 154, 240, 255); // lavender glow
    }
  }

  cleanWhiteBackgroundData(data, w, h, { removeBottomFloorShadow: true, defringeStrength: 0.78 });

  // Exterior corner white cleared
  assert.equal(data[3], 0);
  // Floor shadow strip cleared
  assert.equal(data[(96 * w + 50) * 4 + 3], 0);
  assert.equal(data[(98 * w + 50) * 4 + 3], 0);
  // Trapped white wedge between boots cleared
  assert.equal(data[(89 * w + 50) * 4 + 3], 0);
  // Dark boots preserved
  assert.equal(data[(88 * w + 36) * 4 + 3], 255);
  assert.equal(data[(88 * w + 64) * 4 + 3], 255);
  // Upper white interior dress/muzzle highlight preserved
  assert.equal(data[(45 * w + 50) * 4 + 3], 255);
});

test('Auraline sprite sheet frames clean bottom floor wedges/shadows without punching holes in dress or muzzle flashes', () => {
  const sheet = decodePngRgba('src/assets/sprites/auraline_spritesheet.png');
  const targetIds = ['aurelia_r0_f0', 'aurelia_r0_f4', 'aurelia_r0_f7', 'aurelia_r0_f9', 'aurelia_r1_f4', 'aurelia_r1_f6'];

  for (const id of targetIds) {
    const rect = AURALINE_SHEET_FRAMES.find((f) => f.id === id);
    assert.ok(rect, `Missing frame ${id}`);
    const data = cropRgba(sheet, rect);
    cleanWhiteBackgroundData(data, rect.w, rect.h, {
      removeBottomFloorShadow: true,
      defringeStrength: 0.78,
    });

    // 1. Verify no opaque floor shadow strip lingers along bottom 4 rows
    let bottomOpaqueShadowCount = 0;
    for (let y = rect.h - 4; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        const p = (y * rect.w + x) * 4;
        if (data[p + 3] > 30) {
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          if (b >= 125 && b - r >= 36 && (b - g >= 12 || (r < 110 && g >= 95 && b >= g - 6))) {
            bottomOpaqueShadowCount++;
          }
        }
      }
    }
    assert.equal(bottomOpaqueShadowCount, 0, `${id} still has opaque bottom blue/cyan floor shadow`);

    // 2. Verify no large opaque near-white floor pocket remains in the bottom 15% of the frame
    const minY = Math.floor(rect.h * 0.85);
    const total = rect.w * rect.h;
    const seen = new Uint8Array(total);
    const queue = new Int32Array(total);
    let maxWhitePocket = 0;
    for (let y = minY; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        const start = y * rect.w + x;
        if (seen[start]) continue;
        const sp = start * 4;
        if (data[sp + 3] < 30) continue;
        const sr = data[sp], sg = data[sp + 1], sb = data[sp + 2];
        const sMin = Math.min(sr, sg, sb), sMax = Math.max(sr, sg, sb);
        if (!(sMin > 224 && sMax - sMin < 24)) continue;

        let head = 0, tail = 0;
        seen[start] = 1;
        queue[tail++] = start;
        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % rect.w;
          const cy = (cur - cx) / rect.w;
          const push = (n: number) => {
            if (seen[n]) return;
            const np = n * 4;
            if (data[np + 3] < 30) return;
            const r = data[np], g = data[np + 1], b = data[np + 2];
            if (Math.min(r, g, b) > 224 && Math.max(r, g, b) - Math.min(r, g, b) < 24) {
              seen[n] = 1;
              queue[tail++] = n;
            }
          };
          if (cx > 0) push(cur - 1);
          if (cx < rect.w - 1) push(cur + 1);
          if (cy > minY) push(cur - rect.w);
          if (cy < rect.h - 1) push(cur + rect.w);
        }
        if (tail > maxWhitePocket) maxWhitePocket = tail;
      }
    }
    assert.ok(
      maxWhitePocket < 100,
      `${id} retains large bottom white pocket of ${maxWhitePocket}px`,
    );

    // 3. Verify upper bright highlights (dress/skin/muzzle flashes) remain opaque
    let upperBrightOpaque = 0;
    const upperLimitY = Math.floor(rect.h * 0.65);
    for (let y = 0; y < upperLimitY; y++) {
      for (let x = 0; x < rect.w; x++) {
        const p = (y * rect.w + x) * 4;
        if (data[p + 3] >= 200 && Math.min(data[p], data[p + 1], data[p + 2]) > 225) {
          upperBrightOpaque++;
        }
      }
    }
    assert.ok(
      upperBrightOpaque > 200,
      `${id} lost upper bright white dress/muzzle highlights (only ${upperBrightOpaque}px left)`,
    );
  }
});

test('computeSpriteBoundsFromData computes normalized ratios for opaque pixels', () => {
  const w = 10;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 4; y <= 15; y++) {
    for (let x = 2; x <= 7; x++) {
      const p = (y * w + x) * 4;
      data[p] = 200;
      data[p + 1] = 100;
      data[p + 2] = 50;
      data[p + 3] = 255;
    }
  }
  const bounds = computeSpriteBoundsFromData(data, w, h);
  assert.equal(bounds.topRatio, 4 / 20);
  assert.equal(bounds.bottomRatio, 16 / 20);
  assert.equal(bounds.leftRatio, 2 / 10);
  assert.equal(bounds.rightRatio, 8 / 10);
  assert.equal(bounds.centerXRatio, ((2 + 7) * 0.5) / 10);
});

test('buildOptionsKey differentiates maxDimension, unmixDarkHoloGlass, and default options', () => {
  const fullKey = buildOptionsKey({ removeInteriorWhite: true, minPocketArea: 18 });
  const scaledKey = buildOptionsKey({ removeInteriorWhite: true, minPocketArea: 18, maxDimension: 512 });
  const holoKey = buildOptionsKey({ removeDarkBackground: true, unmixDarkHoloGlass: true });
  const darkKey = buildOptionsKey({ removeDarkBackground: true, unmixDarkHoloGlass: false });
  assert.notEqual(fullKey, scaledKey);
  assert.notEqual(holoKey, darkKey);
  assert.ok(scaledKey.endsWith('|512'));
  assert.ok(fullKey.endsWith('|full'));
});

function applyExcludeRects(
  data: Uint8ClampedArray,
  w: number,
  excludeRects?: readonly { x: number; y: number; w: number; h: number }[],
) {
  if (!excludeRects) return;
  for (const ex of excludeRects) {
    for (let y = ex.y; y < ex.y + ex.h; y++) {
      for (let x = ex.x; x < ex.x + ex.w; x++) {
        const p = (y * w + x) * 4;
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
      }
    }
  }
}

test('cleanDarkBackgroundData clears Zuri black background while preserving opaque black bra, shorts, hair, and thruster glow across combat and emote sheets', () => {
  const combatSheet = decodePngRgba('src/assets/sprites/zuri_spritesheet.png');
  const emoteSheet = decodePngRgba('src/assets/sprites/zuri_emote_sheet.png');
  const targetIds = [
    'zuri_r0_f0',
    'zuri_r1_f0',
    'zuri_r2_f3',
    'zuri_r2_f4',
    'zuri_r3_f0',
    'zuri_r4_f5',
    'zuri_r5_f4',
    'zuri_r5_f6',
  ];

  for (const id of targetIds) {
    const rect = ZURI_SHEET_FRAMES.find((f) => f.id === id);
    assert.ok(rect, `Missing frame ${id}`);
    const sheet = rect.sheet === 'emote' ? emoteSheet : combatSheet;
    const data = cropRgba(sheet, rect);
    applyExcludeRects(data, rect.w, rect.excludeRects);
    cleanDarkBackgroundData(data, rect.w, rect.h, { removeDarkBackground: true });

    // Top-left and top-right background corners must be transparent
    assert.equal(data[3], 0, `${id} top-left corner not cleared`);
    assert.equal(data[(rect.w - 1) * 4 + 3], 0, `${id} top-right corner not cleared`);

    // Center torso pixels must remain solid opaque
    const midY = Math.floor(rect.h * 0.52);
    const midX = rect.anchorX;
    assert.equal(
      data[(midY * rect.w + midX) * 4 + 3],
      255,
      `${id} torso center should remain 100% opaque`,
    );

    // Verify ZERO enclosed transparent holes exist anywhere inside the character silhouette
    const total = rect.w * rect.h;
    const ext = new Uint8Array(total);
    const q = new Int32Array(total);
    let head = 0;
    let tail = 0;
    const pushExt = (idx: number) => {
      if (ext[idx] || data[idx * 4 + 3] >= 128) return;
      ext[idx] = 1;
      q[tail++] = idx;
    };
    for (let x = 0; x < rect.w; x++) {
      pushExt(x);
      pushExt((rect.h - 1) * rect.w + x);
    }
    for (let y = 1; y < rect.h - 1; y++) {
      pushExt(y * rect.w);
      pushExt(y * rect.w + rect.w - 1);
    }
    while (head < tail) {
      const c = q[head++];
      const cx = c % rect.w;
      const cy = (c - cx) / rect.w;
      if (cx > 0) pushExt(c - 1);
      if (cx < rect.w - 1) pushExt(c + 1);
      if (cy > 0) pushExt(c - rect.w);
      if (cy < rect.h - 1) pushExt(c + rect.w);
    }
    let interiorHoles = 0;
    for (let i = 0; i < total; i++) {
      if (!ext[i] && data[i * 4 + 3] < 128) interiorHoles++;
    }
    assert.equal(interiorHoles, 0, `${id} has ${interiorHoles} interior transparent holes`);
  }

  // Specific regression guard on zuri_r5_f4 (DEFEND): black leather bra & shorts around torso anchor must remain 100% opaque
  const r5f4 = ZURI_SHEET_FRAMES.find((f) => f.id === 'zuri_r5_f4')!;
  const r5Data = cropRgba(emoteSheet, r5f4);
  applyExcludeRects(r5Data, r5f4.w, r5f4.excludeRects);
  cleanDarkBackgroundData(r5Data, r5f4.w, r5f4.h, { removeDarkBackground: true });
  let r5TorsoTrans = 0;
  for (let y = 105; y <= 160; y++) {
    for (let x = r5f4.anchorX - 16; x <= r5f4.anchorX + 8; x++) {
      if (r5Data[(y * r5f4.w + x) * 4 + 3] < 255) r5TorsoTrans++;
    }
  }
  assert.equal(r5TorsoTrans, 0, `zuri_r5_f4 lost opacity in bra/torso/shorts (${r5TorsoTrans} non-opaque px)`);
  // Neighbor boot sliver excluded at bottom-right of zuri_r5_f4
  assert.equal(r5Data[(215 * r5f4.w + 210) * 4 + 3], 0, 'zuri_r5_f4 bottom-right neighbor foot sliver should be excluded');

  // Verify exterior dark-crimson halo crust AND face-to-hologram gap around zuri_r1_f0 (IDLE) are cleanly removed
  const r1f0 = ZURI_SHEET_FRAMES.find((f) => f.id === 'zuri_r1_f0')!;
  const r1Raw = cropRgba(combatSheet, r1f0);
  const r1Data = new Uint8ClampedArray(r1Raw);
  cleanDarkBackgroundData(r1Data, r1f0.w, r1f0.h, ZURI_SHEET_OPTIONS);
  assert.equal(r1Data[(80 * r1f0.w + 172) * 4 + 3], 0, 'zuri_r1_f0 right-shoulder dark halo should be peeled');
  assert.equal(r1Data[(110 * r1f0.w + 168) * 4 + 3], 0, 'zuri_r1_f0 right-arm dark halo should be peeled');
  assert.equal(r1Data[(145 * r1f0.w + 174) * 4 + 3], 0, 'zuri_r1_f0 right-hip dark halo should be peeled');
  assert.equal(r1Data[(35 * r1f0.w + 125) * 4 + 3], 0, 'zuri_r1_f0 trapped dark pocket between face and hologram (125,35) should be cleared');
  assert.equal(r1Data[(55 * r1f0.w + 120) * 4 + 3], 0, 'zuri_r1_f0 trapped dark pocket between shoulder and hologram (120,55) should be cleared');

  // Verify ZURI_SHEET_OPTIONS color grading dampens excessive crimson/orange saturation compared to raw
  let rawExcessRed = 0;
  let gradedExcessRed = 0;
  for (let i = 0; i < r1f0.w * r1f0.h; i++) {
    const p = i * 4;
    if (r1Data[p + 3] < 200) continue;
    if (r1Raw[p] > 200 && r1Raw[p] - r1Raw[p + 1] > 95) rawExcessRed++;
    if (r1Data[p] > 200 && r1Data[p] - r1Data[p + 1] > 95) gradedExcessRed++;
  }
  assert.ok(
    gradedExcessRed < rawExcessRed * 0.65,
    `Expected ZURI_SHEET_OPTIONS to reduce oversaturated crimson/orange pixels (${gradedExcessRed} vs ${rawExcessRed})`,
  );
});

test('Zuri Drones cutout preserves Med Drone white medical crosses while clearing Shield Drone between-leg white pocket', () => {
  const droneSheet = decodePngRgba('src/assets/sprites/zuri_drones_sheet.png');

  // Shield Drone (index 0): between-leg white pocket at (330, 580) must be cleared
  const shieldSpec = ZURI_DRONE_FRAMES[0];
  const shieldData = cropRgba(droneSheet, shieldSpec);
  applyExcludeRects(shieldData, shieldSpec.w, shieldSpec.excludeRects);
  cleanWhiteBackgroundData(shieldData, shieldSpec.w, shieldSpec.h, ZURI_DRONES_OPTIONS);
  assert.equal(
    shieldData[(580 * shieldSpec.w + 330) * 4 + 3],
    0,
    'Shield Drone trapped between-leg white pocket at (330,580) must be transparent',
  );

  // Med Drone (index 1): both bright white medical '+' crosses at (450, 260) and (243, 538) must stay opaque (>= 250)
  const medSpec = ZURI_DRONE_FRAMES[1];
  const medData = cropRgba(droneSheet, medSpec);
  applyExcludeRects(medData, medSpec.w, medSpec.excludeRects);
  cleanWhiteBackgroundData(medData, medSpec.w, medSpec.h, ZURI_DRONES_OPTIONS);
  assert.ok(
    medData[(260 * medSpec.w + 450) * 4 + 3] >= 250,
    'Med Drone upper-right white medical cross at (450,260) must remain opaque',
  );
  assert.ok(
    medData[(538 * medSpec.w + 243) * 4 + 3] >= 250,
    'Med Drone lower-left white medical cross at (243,538) must remain opaque',
  );
});

test('Nurse sprite sheet frames clean black background while keeping uniform, medical cross, and syringe opaque', () => {
  const nurseSheet = decodePngRgba('src/assets/sprites/nurse_spritesheet.png');
  assert.equal(nurseSheet.width, 2170);
  assert.equal(nurseSheet.height, 725);

  for (const frame of NURSE_FRAMES) {
    const data = cropRgba(nurseSheet, frame);
    cleanDarkBackgroundData(data, frame.w, frame.h, NURSE_SHEET_OPTIONS);

    // Top-left and top-right corners cleared
    assert.equal(data[3], 0, `${frame.id} top-left corner not cleared`);
    assert.equal(data[(frame.w - 1) * 4 + 3], 0, `${frame.id} top-right corner not cleared`);

    // Torso center (white/pink nurse uniform) remains 100% opaque
    const midY = Math.floor(frame.h * 0.5);
    assert.equal(
      data[(midY * frame.w + frame.anchorX) * 4 + 3],
      255,
      `${frame.id} torso center must remain 100% opaque`,
    );
  }
});

test('All 5 resized 960x541 Title logo frames remove outer and enclosed ring checkerboard while keeping XENO-PURGE PROTOCOL letters opaque', () => {
  const framePaths = [
    'assets-src/title/title_logo_0.png',
    'assets-src/title/title_logo_1.png',
    'assets-src/title/title_logo_2.png',
    'assets-src/title/title_logo_3.png',
    'assets-src/title/title_logo_4.png',
  ];

  for (const relPath of framePaths) {
    const logo = decodePngRgba(relPath);
    assert.equal(logo.width, 960, `${relPath} width must be resized to 960`);
    assert.equal(logo.height, 541, `${relPath} height must be resized to 541`);

    cleanWhiteBackgroundData(logo.data, logo.width, logo.height, {
      removeInteriorWhite: true,
      minPocketArea: 32,
      defringeStrength: 0.82,
      unmixLightGlow: true,
    });

    // Outer corner & enclosed ring gap checkerboard are transparent
    assert.equal(logo.data[(6 * logo.width + 6) * 4 + 3], 0, `${relPath} outer corner must be transparent`);
    assert.equal(logo.data[(175 * logo.width + 445) * 4 + 3], 0, `${relPath} enclosed ring gap must be transparent`);
    assert.equal(logo.data[(165 * logo.width + 410) * 4 + 3], 0, `${relPath} enclosed ring left gap must be transparent`);

    // XENO-PURGE PROTOCOL white lettering remains opaque
    let brightLetterPixels = 0;
    for (let y = 414; y <= 437; y++) {
      for (let x = 258; x <= 660; x++) {
        const p = (y * logo.width + x) * 4;
        if (logo.data[p + 3] > 200 && logo.data[p] > 230 && logo.data[p + 1] > 230 && logo.data[p + 2] > 230) {
          brightLetterPixels++;
        }
      }
    }
    assert.ok(
      brightLetterPixels > 550,
      `${relPath} expected preserved XENO-PURGE lettering, got ${brightLetterPixels}`,
    );
  }
});
