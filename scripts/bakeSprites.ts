import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { EnemyArchetype } from '../src/engine/types';
import { AURALINE_SHEET_FRAMES } from '../src/utils/auralineSpriteSheet';
import { BRUTE_SHEET_FRAMES, BRUTE_SHEET_OPTIONS } from '../src/utils/bruteSpriteSheet';
import { CRAWLER_FRAMES_BY_VARIANT } from '../src/utils/crawlerSpriteSheet';
import {
  FERAL_NURSE_SHEET_A_FRAMES,
  FERAL_NURSE_SHEET_B_FRAMES,
  FERAL_NURSE_SHEET_OPTIONS,
} from '../src/utils/feralNurseSpriteSheet';
import { KIRA_COMBAT_FRAMES, KIRA_EMOTE_FRAMES } from '../src/utils/kiraSpriteSheet';
import { MUTDOG_SHEET_FRAMES, MUTDOG_SHEET_OPTIONS } from '../src/utils/mutdogSpriteSheet';
import { NURSE_FRAMES, NURSE_SHEET_OPTIONS } from '../src/utils/nurseSpriteSheet';
import { SPITTER_SHEET_FRAMES } from '../src/utils/spitterSpriteSheet';
import {
  cleanDarkBackgroundData,
  cleanWhiteBackgroundData,
  computeSpriteBoundsFromData,
  type SpriteBounds,
  type SpriteCutoutOptions,
  type SpriteRect,
} from '../src/utils/spriteCutoutAlgorithms';
import {
  ZURI_COMBAT_FRAMES,
  ZURI_DRONES_OPTIONS,
  ZURI_DRONE_FRAMES,
  ZURI_EMOTE_FRAMES,
  ZURI_SHEET_OPTIONS,
} from '../src/utils/zuriSpriteSheet';
import {
  bakeTitleKeyframeBuffer,
  DEFAULT_LOCKUP_BOUNDS,
  DEFAULT_SLIME_ERASE_RADIUS_PX,
  DEFAULT_SLIME_TIPS,
  DEFAULT_VISOR_CURVATURE,
  shouldDownscaleToTarget,
  TITLE_EMBLEM_CUTOUT_OPTIONS,
  TITLE_TARGET_HEIGHT,
  TITLE_TARGET_WIDTH,
} from './titleSpriteBakePipeline';

interface KeyframeSpec {
  id: string;
  sourceFile: string;
  outputFile: string;
  alignDy?: number;
  solidWhiteBackground?: boolean;
}

const TITLE_KEYFRAMES: readonly KeyframeSpec[] = [
  { id: 'k0', sourceFile: 'title_logo_0.png', outputFile: 'k0.png' },
  { id: 'k1', sourceFile: 'title_logo_1.png', outputFile: 'k1.png' },
  { id: 'k1_5', sourceFile: 'title_logo_1_5.jpg', outputFile: 'k1_5.png', alignDy: 0, solidWhiteBackground: true },
  { id: 'k2', sourceFile: 'title_logo_2.png', outputFile: 'k2.png' },
  { id: 'k2_3', sourceFile: 'title_logo_2_3.jpg', outputFile: 'k2_3.png', alignDy: 0, solidWhiteBackground: true },
  { id: 'k2_7', sourceFile: 'title_logo_2_7.jpg', outputFile: 'k2_7.png', alignDy: -1, solidWhiteBackground: true },
  { id: 'k3', sourceFile: 'title_logo_3.png', outputFile: 'k3.png' },
  { id: 'k3_5', sourceFile: 'title_logo_3_5.jpg', outputFile: 'k3_5.png', alignDy: -1, solidWhiteBackground: true },
  { id: 'k4', sourceFile: 'title_logo_4.png', outputFile: 'k4.png' },
];

interface MultiFrameBakeSpec {
  id: string;
  sourceRel: string;
  outputFile: string;
  frames: readonly SpriteRect[];
  options: SpriteCutoutOptions;
}

const MULTI_FRAME_SPECS: readonly MultiFrameBakeSpec[] = [
  {
    id: 'auraline',
    sourceRel: 'assets-src/heroes/auraline_spritesheet.png',
    outputFile: 'auraline_spritesheet.png',
    frames: AURALINE_SHEET_FRAMES,
    options: { removeBottomFloorShadow: true, defringeStrength: 0.78 },
  },
  {
    id: 'kiraCombat',
    sourceRel: 'assets-src/heroes/kira_spritesheet.png',
    outputFile: 'kira_spritesheet.png',
    frames: KIRA_COMBAT_FRAMES,
    options: { removeInteriorWhite: true, minPocketArea: 14, defringeStrength: 0.78 },
  },
  {
    id: 'kiraEmote',
    sourceRel: 'assets-src/heroes/kira_emote_sheet.png',
    outputFile: 'kira_emote_sheet.png',
    frames: KIRA_EMOTE_FRAMES,
    options: {
      removeInteriorWhite: true,
      minPocketArea: 14,
      defringeStrength: 0.78,
      unmixLightGlow: true,
    },
  },
  {
    id: 'zuriCombat',
    sourceRel: 'assets-src/heroes/zuri_spritesheet.png',
    outputFile: 'zuri_spritesheet.png',
    frames: ZURI_COMBAT_FRAMES,
    options: ZURI_SHEET_OPTIONS,
  },
  {
    id: 'zuriEmote',
    sourceRel: 'assets-src/heroes/zuri_emote_sheet.png',
    outputFile: 'zuri_emote_sheet.png',
    frames: ZURI_EMOTE_FRAMES,
    options: ZURI_SHEET_OPTIONS,
  },
  {
    id: 'zuriDrones',
    sourceRel: 'assets-src/heroes/zuri_drones_sheet.png',
    outputFile: 'zuri_drones_sheet.png',
    frames: ZURI_DRONE_FRAMES,
    options: ZURI_DRONES_OPTIONS,
  },
  {
    id: 'nurse',
    sourceRel: 'assets-src/clinic/nurse_spritesheet.png',
    outputFile: 'nurse_spritesheet.png',
    frames: NURSE_FRAMES,
    options: NURSE_SHEET_OPTIONS,
  },
  {
    id: 'crawler',
    sourceRel: 'assets-src/mutants/crawler_spritesheet.png',
    outputFile: 'crawler_spritesheet.png',
    frames: [
      ...CRAWLER_FRAMES_BY_VARIANT.larva,
      ...CRAWLER_FRAMES_BY_VARIANT.skitter,
      ...CRAWLER_FRAMES_BY_VARIANT.stinger,
    ],
    options: { removeInteriorWhite: true, minPocketArea: 24, defringeStrength: 0.78 },
  },
  {
    id: 'spitter',
    sourceRel: 'assets-src/mutants/spitter_spritesheet.jpg',
    outputFile: 'spitter_spritesheet.png',
    frames: SPITTER_SHEET_FRAMES,
    options: { removeInteriorWhite: true, minPocketArea: 18, defringeStrength: 0.76 },
  },
  {
    id: 'mutdog',
    sourceRel: 'assets-src/mutants/mutdog_spritesheet.jpg',
    outputFile: 'mutdog_spritesheet.png',
    frames: MUTDOG_SHEET_FRAMES,
    options: MUTDOG_SHEET_OPTIONS,
  },
  {
    id: 'feralNurseA',
    sourceRel: 'assets-src/mutants/feral_nurse_sheet_a.png',
    outputFile: 'feral_nurse_sheet_a.png',
    frames: FERAL_NURSE_SHEET_A_FRAMES,
    options: FERAL_NURSE_SHEET_OPTIONS,
  },
  {
    id: 'feralNurseB',
    sourceRel: 'assets-src/mutants/feral_nurse_sheet_b.png',
    outputFile: 'feral_nurse_sheet_b.png',
    frames: FERAL_NURSE_SHEET_B_FRAMES,
    options: FERAL_NURSE_SHEET_OPTIONS,
  },
  {
    id: 'brute',
    sourceRel: 'assets-src/mutants/brute_spritesheet.jpg',
    outputFile: 'brute_spritesheet.png',
    frames: BRUTE_SHEET_FRAMES,
    options: BRUTE_SHEET_OPTIONS,
  },
];

interface SingleSpriteBakeSpec {
  id: string;
  sourceRel: string;
  outputFile: string;
  options: SpriteCutoutOptions;
}

const SINGLE_SPRITE_SPECS: readonly SingleSpriteBakeSpec[] = [
  {
    id: 'kiraDodge0',
    sourceRel: 'assets-src/heroes/kira_dodge_0_vault.png',
    outputFile: 'kira_dodge_0_vault.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'kiraDodge1',
    sourceRel: 'assets-src/heroes/kira_dodge_1_slide.png',
    outputFile: 'kira_dodge_1_slide.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'kiraDodge2',
    sourceRel: 'assets-src/heroes/kira_dodge_2_spin.png',
    outputFile: 'kira_dodge_2_spin.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'kiraDodge3',
    sourceRel: 'assets-src/heroes/kira_dodge_3_land.png',
    outputFile: 'kira_dodge_3_land.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'stalkerOpen',
    sourceRel: 'assets-src/mutants/stalker_open.png',
    outputFile: 'stalker_open.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'stalkerBlink',
    sourceRel: 'assets-src/mutants/stalker_blink.png',
    outputFile: 'stalker_blink.png',
    options: { preserveExistingAlpha: true },
  },
  {
    id: 'spitterPortrait',
    sourceRel: 'assets-src/portraits/spitter_portrait.jpg',
    outputFile: 'spitter_portrait.png',
    options: {
      removeInteriorWhite: true,
      minPocketArea: 18,
      defringeStrength: 0.76,
      maxDimension: 512,
    },
  },
  {
    id: 'mutdogPortrait',
    sourceRel: 'assets-src/portraits/mutdog_portrait.png',
    outputFile: 'mutdog_portrait.png',
    options: {
      removeInteriorWhite: true,
      minPocketArea: 18,
      defringeStrength: 0.78,
      unmixLightGlow: true,
      maxDimension: 512,
    },
  },
  {
    id: 'feralNursePortrait',
    sourceRel: 'assets-src/portraits/feral_nurse_portrait.png',
    outputFile: 'feral_nurse_portrait.png',
    options: {
      removeBottomFloorShadow: true,
      defringeStrength: 0.78,
      maxDimension: 512,
    },
  },
  {
    id: 'brutePortrait',
    sourceRel: 'assets-src/portraits/brute_portrait.jpg',
    outputFile: 'brute_portrait.png',
    options: { maxDimension: 512 },
  },
  {
    id: 'matriarchIntact',
    sourceRel: 'assets-src/mutants/matriarch_intact.png',
    outputFile: 'matriarch_intact.png',
    options: {
      removeInteriorWhite: true,
      removeBottomFloorShadow: true,
      removeNeutralFloorShadow: true,
      removeSubtleCheckerboard: true,
      minPocketArea: 600,
      defringeStrength: 0.84,
      maxDimension: 640,
    },
  },
  {
    id: 'matriarchExploded',
    sourceRel: 'assets-src/mutants/matriarch_exploded.png',
    outputFile: 'matriarch_exploded.png',
    options: {
      removeInteriorWhite: true,
      removeSubtleCheckerboard: true,
      minPocketArea: 600,
      defringeStrength: 0.84,
      maxDimension: 640,
    },
  },
  {
    id: 'bossPortrait',
    sourceRel: 'assets-src/mutants/matriarch_intact.png',
    outputFile: 'boss_portrait.png',
    options: {
      removeInteriorWhite: true,
      removeBottomFloorShadow: true,
      removeNeutralFloorShadow: true,
      removeSubtleCheckerboard: true,
      minPocketArea: 600,
      defringeStrength: 0.84,
      maxDimension: 512,
    },
  },
];

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function encodeRgbaPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function cropRectRgba(
  sheet: Uint8ClampedArray,
  sheetW: number,
  rect: SpriteRect,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const srcStart = ((rect.y + y) * sheetW + rect.x) * 4;
    const dstStart = y * rect.w * 4;
    out.set(sheet.subarray(srcStart, srcStart + rect.w * 4), dstStart);
  }
  return out;
}

function isPointExcluded(
  lx: number,
  ly: number,
  excludeRects?: readonly { x: number; y: number; w: number; h: number }[],
): boolean {
  if (!excludeRects) return false;
  for (let i = 0; i < excludeRects.length; i++) {
    const er = excludeRects[i];
    if (lx >= er.x && lx < er.x + er.w && ly >= er.y && ly < er.y + er.h) {
      return true;
    }
  }
  return false;
}

function applyCutoutOptions(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  options: SpriteCutoutOptions,
): void {
  if (options.preserveExistingAlpha) return;
  if (options.removeDarkBackground) {
    cleanDarkBackgroundData(rgba, w, h, options);
  } else {
    cleanWhiteBackgroundData(rgba, w, h, options);
  }
}

async function bakeTitleAssets(rootDir: string, outDir: string) {
  const srcDir = path.join(rootDir, 'assets-src', 'title');
  const manifestKeyframes: Array<{
    id: string;
    source: string;
    sourceDimensions: { width: number; height: number };
    downscaled: boolean;
    sourceSha256: string;
    output: string;
    outputSha256: string;
  }> = [];

  let lockupManifest: {
    sourceKeyframe: string;
    output: string;
    outputSha256: string;
  } | null = null;

  for (let i = 0; i < TITLE_KEYFRAMES.length; i++) {
    const spec = TITLE_KEYFRAMES[i];
    const srcPath = path.join(srcDir, spec.sourceFile);
    const srcBytes = fs.readFileSync(srcPath);
    const sourceSha256 = sha256Hex(srcBytes);

    let pipeline = sharp(srcBytes);
    const meta = await pipeline.metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (srcW <= 0 || srcH <= 0) {
      throw new Error(`Invalid dimensions for ${srcPath}: ${srcW}x${srcH}`);
    }

    const downscaled = shouldDownscaleToTarget(srcW, srcH);
    const alignDy = spec.alignDy ?? 0;
    if (downscaled) {
      if (alignDy < 0) {
        const shiftUp = -alignDy;
        const resizedBuf = await pipeline
          .resize(TITLE_TARGET_WIDTH, TITLE_TARGET_HEIGHT + shiftUp, {
            kernel: sharp.kernel.lanczos3,
            fit: 'fill',
          })
          .png()
          .toBuffer();
        pipeline = sharp(resizedBuf).extract({
          left: 0,
          top: shiftUp,
          width: TITLE_TARGET_WIDTH,
          height: TITLE_TARGET_HEIGHT,
        });
      } else {
        pipeline = pipeline.resize(TITLE_TARGET_WIDTH, TITLE_TARGET_HEIGHT, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill',
        });
      }
    }

    const { data, info } = await pipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const { frameRgba, lockupRgba } = bakeTitleKeyframeBuffer(
      rgba,
      info.width,
      info.height,
      i,
      Boolean(spec.solidWhiteBackground),
    );

    const outPng = await encodeRgbaPng(frameRgba, info.width, info.height);
    fs.writeFileSync(path.join(outDir, spec.outputFile), outPng);

    manifestKeyframes.push({
      id: spec.id,
      source: `assets-src/title/${spec.sourceFile}`,
      sourceDimensions: { width: srcW, height: srcH },
      downscaled,
      sourceSha256,
      output: `src/assets/sprites/baked/${spec.outputFile}`,
      outputSha256: sha256Hex(outPng),
    });

    if (lockupRgba) {
      const lockupPng = await encodeRgbaPng(lockupRgba, info.width, info.height);
      fs.writeFileSync(path.join(outDir, 'lockup_plane0.png'), lockupPng);
      lockupManifest = {
        sourceKeyframe: spec.id,
        output: 'src/assets/sprites/baked/lockup_plane0.png',
        outputSha256: sha256Hex(lockupPng),
      };
    }

    console.log(`[bake:sprites] title/${spec.id}: ${info.width}x${info.height} -> ${spec.outputFile} (${outPng.length} B)`);
  }

  if (!lockupManifest) {
    throw new Error('Static Lockup Plane was not generated from K0.');
  }

  return { manifestKeyframes, lockupManifest };
}

async function bakeAllSprites(): Promise<void> {
  const onlyTitle = process.argv.includes('--only=title');
  const rootDir = process.cwd();
  const outDir = path.join(rootDir, 'src', 'assets', 'sprites', 'baked');
  fs.mkdirSync(outDir, { recursive: true });

  const { manifestKeyframes, lockupManifest } = await bakeTitleAssets(rootDir, outDir);

  if (onlyTitle) {
    const manifestPath = path.join(outDir, 'bake-manifest.json');
    const existing = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : { version: 2 };
    const updated = {
      ...existing,
      targetDimensions: { width: TITLE_TARGET_WIDTH, height: TITLE_TARGET_HEIGHT },
      parameters: {
        cutout: TITLE_EMBLEM_CUTOUT_OPTIONS,
        lockupBounds: DEFAULT_LOCKUP_BOUNDS,
        visorCurvature: DEFAULT_VISOR_CURVATURE,
        slimeTips: DEFAULT_SLIME_TIPS,
        slimeEraseRadiusPx: DEFAULT_SLIME_ERASE_RADIUS_PX,
      },
      keyframes: manifestKeyframes,
      lockup: lockupManifest,
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    console.log(`[bake:title] Updated title entries in ${manifestPath}`);
    return;
  }

  const bakedSheets: Array<{
    id: string;
    source: string;
    output: string;
    width: number;
    height: number;
    sourceSha256: string;
    outputSha256: string;
  }> = [];

  const firstFrameBoundsById = new Map<string, SpriteBounds>();

  for (const spec of MULTI_FRAME_SPECS) {
    const srcPath = path.join(rootDir, spec.sourceRel);
    const srcBytes = fs.readFileSync(srcPath);
    const { data, info } = await sharp(srcBytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const srcRgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const outRgba = new Uint8ClampedArray(info.width * info.height * 4);

    for (let fIdx = 0; fIdx < spec.frames.length; fIdx++) {
      const rect = spec.frames[fIdx];
      const cell = cropRectRgba(srcRgba, info.width, rect);
      if (rect.excludeRects) {
        for (const er of rect.excludeRects) {
          for (let y = er.y; y < er.y + er.h; y++) {
            for (let x = er.x; x < er.x + er.w; x++) {
              const p = (y * rect.w + x) * 4;
              cell[p] = 0;
              cell[p + 1] = 0;
              cell[p + 2] = 0;
              cell[p + 3] = 0;
            }
          }
        }
      }
      applyCutoutOptions(cell, rect.w, rect.h, spec.options);

      if (fIdx === 0) {
        firstFrameBoundsById.set(spec.id, computeSpriteBoundsFromData(cell, rect.w, rect.h));
      }
      if (spec.id === 'crawler') {
        if (rect === CRAWLER_FRAMES_BY_VARIANT.larva[0]) {
          firstFrameBoundsById.set('larva', computeSpriteBoundsFromData(cell, rect.w, rect.h));
        } else if (rect === CRAWLER_FRAMES_BY_VARIANT.skitter[0]) {
          firstFrameBoundsById.set('skitter', computeSpriteBoundsFromData(cell, rect.w, rect.h));
        } else if (rect === CRAWLER_FRAMES_BY_VARIANT.stinger[0]) {
          firstFrameBoundsById.set('stinger', computeSpriteBoundsFromData(cell, rect.w, rect.h));
        }
      }

      for (let ly = 0; ly < rect.h; ly++) {
        for (let lx = 0; lx < rect.w; lx++) {
          if (isPointExcluded(lx, ly, rect.excludeRects)) continue;
          const cp = (ly * rect.w + lx) * 4;
          const ca = cell[cp + 3];
          const op = ((rect.y + ly) * info.width + (rect.x + lx)) * 4;
          if (ca > outRgba[op + 3]) {
            outRgba[op] = cell[cp];
            outRgba[op + 1] = cell[cp + 1];
            outRgba[op + 2] = cell[cp + 2];
            outRgba[op + 3] = ca;
          }
        }
      }
    }

    const outPng = await encodeRgbaPng(outRgba, info.width, info.height);
    fs.writeFileSync(path.join(outDir, spec.outputFile), outPng);
    bakedSheets.push({
      id: spec.id,
      source: spec.sourceRel,
      output: `src/assets/sprites/baked/${spec.outputFile}`,
      width: info.width,
      height: info.height,
      sourceSha256: sha256Hex(srcBytes),
      outputSha256: sha256Hex(outPng),
    });
    console.log(`[bake:sprites] sheet/${spec.id}: ${info.width}x${info.height} -> ${spec.outputFile} (${outPng.length} B)`);
  }

  const singleBoundsById = new Map<string, SpriteBounds>();
  const bakedSingles: Array<{
    id: string;
    source: string;
    output: string;
    width: number;
    height: number;
    sourceSha256: string;
    outputSha256: string;
  }> = [];

  for (const spec of SINGLE_SPRITE_SPECS) {
    const srcPath = path.join(rootDir, spec.sourceRel);
    const srcBytes = fs.readFileSync(srcPath);
    let pipeline = sharp(srcBytes);
    const meta = await pipeline.metadata();
    const natW = meta.width ?? 0;
    const natH = meta.height ?? 0;
    const maxDim = spec.options.maxDimension;
    const scale =
      maxDim && maxDim > 0 && Math.max(natW, natH) > maxDim
        ? maxDim / Math.max(natW, natH)
        : 1;
    if (scale < 1) {
      pipeline = pipeline.resize(
        Math.max(1, Math.round(natW * scale)),
        Math.max(1, Math.round(natH * scale)),
        { kernel: sharp.kernel.lanczos3, fit: 'fill' },
      );
    }

    const { data, info } = await pipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const scaledOpts: SpriteCutoutOptions =
      scale < 1 && spec.options.minPocketArea !== undefined
        ? {
            ...spec.options,
            minPocketArea: Math.max(4, Math.round(spec.options.minPocketArea * scale * scale)),
          }
        : spec.options;
    applyCutoutOptions(rgba, info.width, info.height, scaledOpts);
    singleBoundsById.set(spec.id, computeSpriteBoundsFromData(rgba, info.width, info.height));

    const outPng = await encodeRgbaPng(rgba, info.width, info.height);
    fs.writeFileSync(path.join(outDir, spec.outputFile), outPng);
    bakedSingles.push({
      id: spec.id,
      source: spec.sourceRel,
      output: `src/assets/sprites/baked/${spec.outputFile}`,
      width: info.width,
      height: info.height,
      sourceSha256: sha256Hex(srcBytes),
      outputSha256: sha256Hex(outPng),
    });
    console.log(`[bake:sprites] single/${spec.id}: ${info.width}x${info.height} -> ${spec.outputFile} (${outPng.length} B)`);
  }

  const enemyCutoutBounds: Record<EnemyArchetype, SpriteBounds> = {
    larva: firstFrameBoundsById.get('larva')!,
    skitter: firstFrameBoundsById.get('skitter')!,
    stinger: firstFrameBoundsById.get('stinger')!,
    stalker: singleBoundsById.get('stalkerOpen')!,
    spitter: firstFrameBoundsById.get('spitter')!,
    mutdog: firstFrameBoundsById.get('mutdog')!,
    feral_nurse: firstFrameBoundsById.get('feralNurseA')!,
    brute: firstFrameBoundsById.get('brute')!,
    boss: singleBoundsById.get('matriarchIntact')!,
  };

  const enemyPortraitBounds: Record<EnemyArchetype, SpriteBounds> = {
    larva: enemyCutoutBounds.larva,
    skitter: enemyCutoutBounds.skitter,
    stinger: enemyCutoutBounds.stinger,
    stalker: singleBoundsById.get('stalkerOpen')!,
    spitter: singleBoundsById.get('spitterPortrait')!,
    mutdog: singleBoundsById.get('mutdogPortrait')!,
    feral_nurse: singleBoundsById.get('feralNursePortrait')!,
    brute: singleBoundsById.get('brutePortrait')!,
    boss: singleBoundsById.get('bossPortrait')!,
  };

  const boundsTs = `// Auto-generated by scripts/bakeSprites.ts — do not edit manually.
import type { EnemyArchetype } from '../../../engine/types';
import type { SpriteBounds } from '../../../utils/spriteCutoutBounds';

export const BAKED_ENEMY_CUTOUT_BOUNDS: Record<EnemyArchetype, SpriteBounds> = ${JSON.stringify(enemyCutoutBounds, null, 2)};

export const BAKED_ENEMY_PORTRAIT_BOUNDS: Record<EnemyArchetype, SpriteBounds> = ${JSON.stringify(enemyPortraitBounds, null, 2)};
`;
  fs.writeFileSync(path.join(outDir, 'bakedBounds.ts'), boundsTs, 'utf8');

  const manifest = {
    version: 2,
    targetDimensions: { width: TITLE_TARGET_WIDTH, height: TITLE_TARGET_HEIGHT },
    parameters: {
      cutout: TITLE_EMBLEM_CUTOUT_OPTIONS,
      lockupBounds: DEFAULT_LOCKUP_BOUNDS,
      visorCurvature: DEFAULT_VISOR_CURVATURE,
      slimeTips: DEFAULT_SLIME_TIPS,
      slimeEraseRadiusPx: DEFAULT_SLIME_ERASE_RADIUS_PX,
    },
    keyframes: manifestKeyframes,
    lockup: lockupManifest,
    sheets: bakedSheets,
    singles: bakedSingles,
    bounds: {
      enemyCutouts: enemyCutoutBounds,
      enemyPortraits: enemyPortraitBounds,
    },
  };
  const manifestPath = path.join(outDir, 'bake-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[bake:sprites] Wrote manifest: ${manifestPath}`);
}

bakeAllSprites().catch((err) => {
  console.error('[bake:sprites] Failed:', err);
  process.exitCode = 1;
});
