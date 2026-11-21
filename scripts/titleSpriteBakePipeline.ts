import {
  cleanWhiteBackgroundData,
  type SpriteCutoutOptions,
} from '../src/utils/spriteCutout';

export const TITLE_TARGET_WIDTH = 960;
export const TITLE_TARGET_HEIGHT = 541;

export const TITLE_EMBLEM_CUTOUT_OPTIONS: SpriteCutoutOptions = {
  removeInteriorWhite: true,
  minPocketArea: 32,
  defringeStrength: 0.82,
  unmixLightGlow: true,
};

export interface VisorQuadNormalized {
  p00x: number;
  p00y: number;
  p10x: number;
  p10y: number;
  p01x: number;
  p01y: number;
  p11x: number;
  p11y: number;
  curvature?: number;
}

export const DEFAULT_VISOR_CURVATURE = -0.014;

export const KEYFRAME_VISOR_QUADS: readonly VisorQuadNormalized[] = [
  // K0: Idle / Base Aim
  {
    p00x: 0.802,
    p00y: 0.091,
    p10x: 0.878,
    p10y: 0.088,
    p01x: 0.808,
    p01y: 0.154,
    p11x: 0.885,
    p11y: 0.148,
    curvature: DEFAULT_VISOR_CURVATURE,
  },
  // K1: Beat 1 (Wink)
  {
    p00x: 0.802,
    p00y: 0.091,
    p10x: 0.878,
    p10y: 0.088,
    p01x: 0.808,
    p01y: 0.154,
    p11x: 0.885,
    p11y: 0.148,
    curvature: DEFAULT_VISOR_CURVATURE,
  },
  // K2: Beat 2 (Shared Grin, +6° clockwise head tilt)
  {
    p00x: 0.805,
    p00y: 0.087,
    p10x: 0.881,
    p10y: 0.092,
    p01x: 0.804,
    p01y: 0.150,
    p11x: 0.880,
    p11y: 0.155,
    curvature: DEFAULT_VISOR_CURVATURE,
  },
  // K3: Beat 3 (Blown Kiss)
  {
    p00x: 0.768,
    p00y: 0.086,
    p10x: 0.844,
    p10y: 0.098,
    p01x: 0.772,
    p01y: 0.156,
    p11x: 0.848,
    p11y: 0.168,
    curvature: DEFAULT_VISOR_CURVATURE,
  },
  // K4: Beat 4 (Climax !!)
  {
    p00x: 0.768,
    p00y: 0.086,
    p10x: 0.844,
    p10y: 0.098,
    p01x: 0.772,
    p01y: 0.156,
    p11x: 0.848,
    p11y: 0.168,
    curvature: DEFAULT_VISOR_CURVATURE,
  },
];

export interface SlimeTipAnchor {
  x: number;
  y: number;
}

export const DEFAULT_SLIME_TIPS: readonly SlimeTipAnchor[] = [
  { x: 30, y: 294 },
  { x: 32, y: 192 },
  { x: 28, y: 304 },
] as const;

export const DEFAULT_SLIME_ERASE_RADIUS_PX = 14;

export interface StaticLockupBounds {
  minNx: number;
  maxNx: number;
  minNy: number;
  maxNy: number;
  featherPx: number;
}

export const DEFAULT_LOCKUP_BOUNDS: StaticLockupBounds = {
  minNx: 0.04,
  maxNx: 0.79,
  minNy: 0.38,
  maxNy: 0.98,
  featherPx: 12,
};

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function cosineRamp(t: number): number {
  const c = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
}

/**
 * Returns true only when source dimensions exceed the 960x541 reference resolution.
 */
export function shouldDownscaleToTarget(width: number, height: number): boolean {
  return width > TITLE_TARGET_WIDTH || height > TITLE_TARGET_HEIGHT;
}

/**
 * Runs the 4-pass procedural alpha extraction on a Title Emblem RGBA buffer in place.
 */
export function extractTitleEmblemCutout(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  cleanWhiteBackgroundData(rgba, width, height, TITLE_EMBLEM_CUTOUT_OPTIONS);
}

/**
 * Extracts the Static Lockup Plane from an already-cutout K0 RGBA buffer,
 * applying a smooth cosine-feathered ramp along the top NEON bevel and Kira arm seam.
 */
export function extractStaticLockupPlane(
  sourceRgba: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: StaticLockupBounds = DEFAULT_LOCKUP_BOUNDS,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sourceRgba.length);
  if (width <= 0 || height <= 0) return out;

  const feather = Math.max(1, bounds.featherPx);
  const topStart = Math.round(height * bounds.minNy) - Math.floor(feather * 0.5);
  const bottomEnd = Math.round(height * bounds.maxNy);
  const leftStart = Math.round(width * bounds.minNx);
  const rightEnd = Math.round(width * bounds.maxNx);

  for (let y = 0; y < height; y++) {
    let topW = 1;
    if (y < topStart) {
      topW = 0;
    } else if (y < topStart + feather) {
      topW = cosineRamp((y - topStart) / feather);
    }

    let bottomW = 1;
    if (y >= bottomEnd) {
      bottomW = 0;
    } else if (y > bottomEnd - feather) {
      bottomW = cosineRamp((bottomEnd - y) / feather);
    }

    const rowWeight = topW * bottomW;
    if (rowWeight <= 0) continue;

    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      let leftW = 1;
      if (x < leftStart) {
        leftW = 0;
      } else if (x < leftStart + feather) {
        leftW = cosineRamp((x - leftStart) / feather);
      }

      let rightW = 1;
      if (x >= rightEnd) {
        rightW = 0;
      } else if (x > rightEnd - feather) {
        rightW = cosineRamp((rightEnd - x) / feather);
      }

      const weight = rowWeight * leftW * rightW;
      if (weight <= 0) continue;

      const p = (rowOff + x) * 4;
      const srcAlpha = sourceRgba[p + 3];
      if (srcAlpha === 0) continue;

      const newAlpha = Math.round(srcAlpha * weight);
      if (newAlpha <= 0) continue;

      out[p] = sourceRgba[p];
      out[p + 1] = sourceRgba[p + 1];
      out[p + 2] = sourceRgba[p + 2];
      out[p + 3] = newAlpha;
    }
  }

  return out;
}

function solveCurvedQuadUv(
  nx: number,
  ny: number,
  quad: VisorQuadNormalized,
  curvature: number,
): { u: number; v: number } | null {
  let u = 0.5;
  let v = 0.5;

  for (let iter = 0; iter < 5; iter++) {
    const omU = 1 - u;
    const omV = 1 - v;

    const px =
      omU * omV * quad.p00x +
      u * omV * quad.p10x +
      omU * v * quad.p01x +
      u * v * quad.p11x;
    const py =
      omU * omV * quad.p00y +
      u * omV * quad.p10y +
      omU * v * quad.p01y +
      u * v * quad.p11y +
      curvature * 4 * u * omU;

    const rx = nx - px;
    const ry = ny - py;
    if (Math.abs(rx) < 1e-6 && Math.abs(ry) < 1e-6) break;

    const j00 = omV * (quad.p10x - quad.p00x) + v * (quad.p11x - quad.p01x);
    const j01 = omU * (quad.p01x - quad.p00x) + u * (quad.p11x - quad.p10x);
    const j10 =
      omV * (quad.p10y - quad.p00y) +
      v * (quad.p11y - quad.p01y) +
      curvature * 4 * (1 - 2 * u);
    const j11 = omU * (quad.p01y - quad.p00y) + u * (quad.p11y - quad.p10y);

    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-10) return null;

    u += (j11 * rx - j01 * ry) / det;
    v += (-j10 * rx + j00 * ry) / det;
  }

  return { u, v };
}

/**
 * Inpaints opaque dark curved visor glass (#0b132b radial vignette + subtle diagonal glare)
 * inside Kira's goggle aperture while preserving flanking cyan side bars and metallic bezel.
 */
export function inpaintVisorGlass(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  quad: VisorQuadNormalized,
): void {
  if (width <= 0 || height <= 0) return;

  const curvature = quad.curvature ?? DEFAULT_VISOR_CURVATURE;
  const minNx = Math.min(quad.p00x, quad.p10x, quad.p01x, quad.p11x);
  const maxNx = Math.max(quad.p00x, quad.p10x, quad.p01x, quad.p11x);
  const minNy =
    Math.min(quad.p00y, quad.p10y, quad.p01y, quad.p11y) + Math.min(0, curvature);
  const maxNy =
    Math.max(quad.p00y, quad.p10y, quad.p01y, quad.p11y) + Math.max(0, curvature);

  const minX = Math.max(0, Math.floor(minNx * width) - 2);
  const maxX = Math.min(width - 1, Math.ceil(maxNx * width) + 2);
  const minY = Math.max(0, Math.floor(minNy * height) - 2);
  const maxY = Math.min(height - 1, Math.ceil(maxNy * height) + 2);

  const quadW = Math.max(1, Math.hypot((quad.p10x - quad.p00x) * width, (quad.p10y - quad.p00y) * height));
  const quadH = Math.max(1, Math.hypot((quad.p01x - quad.p00x) * width, (quad.p01y - quad.p00y) * height));

  for (let y = minY; y <= maxY; y++) {
    const ny = (y + 0.5) / height;
    const rowOff = y * width;
    for (let x = minX; x <= maxX; x++) {
      const nx = (x + 0.5) / width;
      const solved = solveCurvedQuadUv(nx, ny, quad, curvature);
      if (!solved) continue;

      const { u, v } = solved;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;

      const p = (rowOff + x) * 4;
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      const a = rgba[p + 3];

      // Preserve glowing cyan side bars flanking the visor aperture
      if (a > 0 && b >= 170 && g >= 165 && r <= 140 && b - r >= 45) {
        continue;
      }

      const distU = Math.min(u, 1 - u) * quadW;
      const distV = Math.min(v, 1 - v) * quadH;
      const edgeDistPx = Math.min(distU, distV);
      if (edgeDistPx <= 0) continue;

      const edgeWeight = clamp01(edgeDistPx / 1.5);

      const dx = (u - 0.5) / 0.5;
      const dy = (v - 0.45) / 0.55;
      const r2 = Math.min(1, dx * dx + dy * dy);
      const baseR = 20 + (11 - 20) * r2;
      const baseG = 33 + (19 - 33) * r2;
      const baseB = 70 + (43 - 70) * r2;

      const glareDist = Math.abs(u * 0.72 + v * 0.58 - 0.52);
      const glare = Math.pow(Math.max(0, 1 - glareDist / 0.14), 2);

      const glassR = Math.min(255, Math.round(baseR + 18 * glare));
      const glassG = Math.min(255, Math.round(baseG + 28 * glare));
      const glassB = Math.min(255, Math.round(baseB + 42 * glare));

      rgba[p] = Math.round(r * (1 - edgeWeight) + glassR * edgeWeight);
      rgba[p + 1] = Math.round(g * (1 - edgeWeight) + glassG * edgeWeight);
      rgba[p + 2] = Math.round(b * (1 - edgeWeight) + glassB * edgeWeight);
      rgba[p + 3] = 255;
    }
  }
}

/**
 * Applies a 14 px radial soft alpha erasure mask over static hanging Xeno Slime droplet tips.
 */
export function eraseSlimeDropletTips(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tips: readonly SlimeTipAnchor[] = DEFAULT_SLIME_TIPS,
  radiusPx: number = DEFAULT_SLIME_ERASE_RADIUS_PX,
): void {
  if (width <= 0 || height <= 0 || radiusPx <= 0) return;

  const rCeil = Math.ceil(radiusPx);
  for (let i = 0; i < tips.length; i++) {
    const cx = tips[i].x;
    const cy = tips[i].y;
    const minX = Math.max(0, Math.floor(cx - rCeil));
    const maxX = Math.min(width - 1, Math.ceil(cx + rCeil));
    const minY = Math.max(0, Math.floor(cy - rCeil));
    const maxY = Math.min(height - 1, Math.ceil(cy + rCeil));

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const rowOff = y * width;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dist = Math.hypot(dx, dy);
        if (dist > radiusPx) continue;

        const t = dist / radiusPx;
        let keepFactor = 0;
        if (t > 0.45) {
          const u = (t - 0.45) / 0.55;
          keepFactor = u * u * (3 - 2 * u);
        }

        const p = (rowOff + x) * 4;
        const newAlpha = Math.round(rgba[p + 3] * keepFactor);
        rgba[p + 3] = newAlpha;
        if (newAlpha === 0) {
          rgba[p] = 0;
          rgba[p + 1] = 0;
          rgba[p + 2] = 0;
        }
      }
    }
  }
}

/**
 * Orchestrates all build-time pixel passes for one Emblem Keyframe:
 * 1. 4-pass cutout extraction
 * 2. Static Lockup Plane extraction (when keyframeIndex === 0)
 * 3. Opaque dark curved visor glass inpainting
 * 4. 14 px radial static Xeno Slime droplet tip erasure
 */
export function bakeTitleKeyframeBuffer(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  keyframeIndex: number,
): { frameRgba: Uint8ClampedArray; lockupRgba: Uint8ClampedArray | null } {
  const frameRgba = new Uint8ClampedArray(rgba);
  extractTitleEmblemCutout(frameRgba, width, height);

  const lockupRgba =
    keyframeIndex === 0 ? extractStaticLockupPlane(frameRgba, width, height) : null;

  const quad = KEYFRAME_VISOR_QUADS[keyframeIndex] ?? KEYFRAME_VISOR_QUADS[0];
  inpaintVisorGlass(frameRgba, width, height, quad);
  eraseSlimeDropletTips(frameRgba, width, height);

  return { frameRgba, lockupRgba };
}
