import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
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
}

const KEYFRAME_SPECS: readonly KeyframeSpec[] = [
  {
    id: 'k0',
    sourceFile: 'title_logo_0.png',
    outputFile: 'k0.png',
  },
  {
    id: 'k1',
    sourceFile: 'title_logo_1.png',
    outputFile: 'k1.png',
  },
  {
    id: 'k2',
    sourceFile: 'title_logo_2.png',
    outputFile: 'k2.png',
  },
  {
    id: 'k3',
    sourceFile: 'title_logo_3.png',
    outputFile: 'k3.png',
  },
  {
    id: 'k4',
    sourceFile: 'title_logo_4.png',
    outputFile: 'k4.png',
  },
];

const LOCKUP_OUTPUT_FILE = 'lockup_plane0.png';

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

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, 'assets-src', 'title');
  const outDir = path.join(rootDir, 'src', 'assets', 'sprites', 'baked');
  fs.mkdirSync(outDir, { recursive: true });

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

  for (let i = 0; i < KEYFRAME_SPECS.length; i++) {
    const spec = KEYFRAME_SPECS[i];
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
    if (downscaled) {
      pipeline = pipeline.resize(TITLE_TARGET_WIDTH, TITLE_TARGET_HEIGHT, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill',
      });
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
    );

    const outPng = await encodeRgbaPng(frameRgba, info.width, info.height);
    const outPath = path.join(outDir, spec.outputFile);
    fs.writeFileSync(outPath, outPng);
    const outputSha256 = sha256Hex(outPng);

    manifestKeyframes.push({
      id: spec.id,
      source: `assets-src/title/${spec.sourceFile}`,
      sourceDimensions: { width: srcW, height: srcH },
      downscaled,
      sourceSha256,
      output: `src/assets/sprites/baked/${spec.outputFile}`,
      outputSha256,
    });

    if (lockupRgba) {
      const lockupPng = await encodeRgbaPng(lockupRgba, info.width, info.height);
      const lockupPath = path.join(outDir, LOCKUP_OUTPUT_FILE);
      fs.writeFileSync(lockupPath, lockupPng);
      lockupManifest = {
        sourceKeyframe: spec.id,
        output: `src/assets/sprites/baked/${LOCKUP_OUTPUT_FILE}`,
        outputSha256: sha256Hex(lockupPng),
      };
    }

    console.log(
      `[bake:title] ${spec.id}: ${srcW}x${srcH}${downscaled ? ` -> ${info.width}x${info.height} (lanczos3)` : ''} -> ${spec.outputFile} (${outPng.length} B)`,
    );
  }

  if (!lockupManifest) {
    throw new Error('Static Lockup Plane was not generated from K0.');
  }

  const manifest = {
    version: 1,
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

  const manifestPath = path.join(outDir, 'bake-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[bake:title] Wrote manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error('[bake:title] Failed:', err);
  process.exitCode = 1;
});
