import {
  cleanWhiteBackgroundData,
  type SpriteCutoutOptions,
} from '../src/utils/spriteCutoutAlgorithms';
import { VISOR_KEYFRAME_QUADS } from '../src/utils/titleVisorMatrix';

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

/**
 * Canonical 9-keyframe Visor Matrix quads imported directly from titleVisorMatrix.ts
 * so build-time glass inpainting and runtime LED projection never drift apart.
 */
export const KEYFRAME_VISOR_QUADS: readonly VisorQuadNormalized[] = VISOR_KEYFRAME_QUADS;

export interface SlimeTipAnchor {
  x: number;
  y: number;
}

// Calibrated dual-circle tip masks cleanly removing frozen mid-left teardrop (including k1 ring)
// and bottom-left hanging icicle across all 9 keyframes while preserving rounded tentacle bulbs.
export const DEFAULT_SLIME_TIPS: readonly SlimeTipAnchor[] = [
  { x: 32, y: 196 },
  { x: 32, y: 207 },
  { x: 27, y: 297 },
  { x: 25, y: 309 },
] as const;

export const DEFAULT_SLIME_ERASE_RADIUS_PX = 15;

export interface StaticLockupBounds {
  minNx: number;
  maxNx: number;
  minNy: number;
  maxNy: number;
  featherPx: number;
}

export const DEFAULT_LOCKUP_BOUNDS: StaticLockupBounds = {
  minNx: 0.035,
  maxNx: 0.788,
  minNy: 0.382,
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
 * Removes enclosed pure-white and neutral light-grey background pockets trapped inside
 * Kira's hair curls, the neon ring arch, tentacle crevices, and the right arm-torso gap
 * across both solid-white generated frames and checkerboard PNGs, while strictly protecting
 * faces, eyes, teeth, neon light cores, and NEON BREACH lettering.
 * Applies 2-ring neutral halo defringing around newly cleared borders and prunes stray
 * isolated exterior dust specks.
 */
function stripEnclosedBackgroundWhitePockets(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  solidWhiteBackground: boolean,
): void {
  if (width < 320 || height < 200) return;

  const total = width * height;
  const visited = new Uint8Array(total);
  const cleared = new Uint8Array(total);
  const queue = new Int32Array(total);

  // Neutral bright white / checkerboard light-grey (excludes warm/magenta hair highlights and skin)
  const isNeutralBgWhite = (idx: number): boolean => {
    const p = idx * 4;
    if (rgba[p + 3] < 130) return false;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const sat = maxC - minC;
    if (minC >= 224 && sat <= 22) return true;
    // Also catch trapped light-grey checkerboard squares on original PNGs
    if (!solidWhiteBackground && minC >= 198 && sat <= 12) return true;
    return false;
  };

  const upperCutY = Math.round(height * 0.455); // ~246px — covers entire neon ring arch above NEON
  const armMinX = Math.round(width * 0.75);
  const armMaxY = Math.round(height * 0.72);

  // Protected character face/eye/teeth boxes (normalized to 960x541)
  const kiraFaceMinX = Math.round(width * 0.745);
  const kiraFaceMaxX = Math.round(width * 0.90);
  const kiraFaceMinY = Math.round(height * 0.22);
  const kiraFaceMaxY = Math.round(height * 0.53);

  const xenoFaceMinX = Math.round(width * 0.115);
  const xenoFaceMaxX = Math.round(width * 0.33);
  const xenoFaceMinY = Math.round(height * 0.17);
  const xenoFaceMaxY = Math.round(height * 0.585);

  const inProtectedFace = (cx: number, cy: number): boolean =>
    (cx >= kiraFaceMinX && cx <= kiraFaceMaxX && cy >= kiraFaceMinY && cy <= kiraFaceMaxY) ||
    (cx >= xenoFaceMinX && cx <= xenoFaceMaxX && cy >= xenoFaceMinY && cy <= xenoFaceMaxY);

  for (let y = 0; y < armMaxY; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start] || !isNeutralBgWhite(start)) continue;

      let head = 0;
      let tail = 0;
      visited[start] = 1;
      queue[tail++] = start;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let touchesProtected = false;
      let borderTotal = 0;
      let borderDarkOrHair = 0;
      let borderNeonGlow = 0;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (inProtectedFace(cx, cy)) touchesProtected = true;

        const neighbors = [
          cx + 1 < width ? cur + 1 : -1,
          cx - 1 >= 0 ? cur - 1 : -1,
          cy + 1 < height ? cur + width : -1,
          cy - 1 >= 0 ? cur - width : -1,
        ];
        for (let ni = 0; ni < 4; ni++) {
          const n = neighbors[ni];
          if (n < 0) continue;
          if (!visited[n] && isNeutralBgWhite(n)) {
            visited[n] = 1;
            queue[tail++] = n;
          } else if (!isNeutralBgWhite(n)) {
            const np = n * 4;
            const na = rgba[np + 3];
            if (na >= 100) {
              borderTotal++;
              const nr = rgba[np];
              const ng = rgba[np + 1];
              const nb = rgba[np + 2];
              const nluma = 0.299 * nr + 0.587 * ng + 0.114 * nb;
              const nsat =
                Math.max(nr, ng, nb) - Math.min(nr, ng, nb);
              // Neon light core (heart, neon ring tube, pistol glow): bright + high chroma
              if (nluma >= 155 && nsat >= 75) {
                borderNeonGlow++;
              } else if (nluma < 150) {
                borderDarkOrHair++;
              }
            }
          }
        }
      }

      const darkRatio = borderTotal > 0 ? borderDarkOrHair / borderTotal : 0;
      const neonRatio = borderTotal > 0 ? borderNeonGlow / borderTotal : 0;

      // Large arch / arm-torso pockets always clear (even if their outer edge grazes a face box)
      const isLargeUpperBg = maxY <= upperCutY && tail >= 240 && (!touchesProtected || tail >= 500);
      const isArmGap = !touchesProtected && minX >= armMinX && maxY <= armMaxY && tail >= 120;
      // Hair-curl & tentacle-crevice pockets (area >= 8 px): neutral white surrounded by
      // comic ink / shaded hair rather than a glowing neon tube/heart core
      const isHairOrCrevicePocket =
        !touchesProtected &&
        maxY <= upperCutY &&
        tail >= 8 &&
        darkRatio >= 0.28 &&
        neonRatio < 0.52;

      if (isLargeUpperBg || isArmGap || isHairOrCrevicePocket) {
        for (let k = 0; k < tail; k++) {
          const idx = queue[k];
          cleared[idx] = 1;
          const p = idx * 4;
          rgba[p] = 0;
          rgba[p + 1] = 0;
          rgba[p + 2] = 0;
          rgba[p + 3] = 0;
        }
      }
    }
  }

  // 2-ring soft halo defringing on pixels bordering newly stripped white pockets
  for (let pass = 0; pass < 2; pass++) {
    const newlyCleared: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        if (cleared[idx]) continue;
        const p = idx * 4;
        const a = rgba[p + 3];
        if (a === 0) continue;
        if (
          !cleared[idx - 1] &&
          !cleared[idx + 1] &&
          !cleared[idx - width] &&
          !cleared[idx + width]
        ) {
          continue;
        }
        const r = rgba[p];
        const g = rgba[p + 1];
        const b = rgba[p + 2];
        const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
        const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
        if (minC >= 202 && maxC - minC <= 28) {
          rgba[p] = 0;
          rgba[p + 1] = 0;
          rgba[p + 2] = 0;
          rgba[p + 3] = 0;
          newlyCleared.push(idx);
        } else if (minC >= 160 && maxC - minC <= 45) {
          const factor = pass === 0 ? 0.42 : 0.7;
          rgba[p + 3] = Math.round(a * factor);
        }
      }
    }
    for (let i = 0; i < newlyCleared.length; i++) {
      cleared[newlyCleared[i]] = 1;
    }
  }

  // Prune tiny isolated exterior checkerboard dust specks (<= 10 px) in lower margins
  const speckVisited = new Uint8Array(total);
  const speckMinY = Math.round(height * 0.72);
  for (let y = speckMinY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (speckVisited[start] || rgba[start * 4 + 3] === 0) continue;
      let head = 0;
      let tail = 0;
      speckVisited[start] = 1;
      queue[tail++] = start;
      while (head < tail && tail <= 12) {
        const cur = queue[head++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        const ns = [
          cx + 1 < width ? cur + 1 : -1,
          cx - 1 >= 0 ? cur - 1 : -1,
          cy + 1 < height ? cur + width : -1,
          cy - 1 >= 0 ? cur - width : -1,
        ];
        for (let ni = 0; ni < 4; ni++) {
          const n = ns[ni];
          if (n >= 0 && !speckVisited[n] && rgba[n * 4 + 3] > 0) {
            speckVisited[n] = 1;
            queue[tail++] = n;
          }
        }
      }
      if (tail <= 10) {
        for (let k = 0; k < tail; k++) {
          const p = queue[k] * 4;
          rgba[p] = 0;
          rgba[p + 1] = 0;
          rgba[p + 2] = 0;
          rgba[p + 3] = 0;
        }
      }
    }
  }
}

/**
 * Runs the 4-pass procedural alpha extraction on a Title Emblem RGBA buffer in place,
 * strips enclosed white background pockets trapped inside hair curls and arches,
 * and removes faint low-alpha neutral checkerboard specks along the exterior perimeter.
 */
export function extractTitleEmblemCutout(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  solidWhiteBackground = false,
): void {
  cleanWhiteBackgroundData(rgba, width, height, TITLE_EMBLEM_CUTOUT_OPTIONS);
  stripEnclosedBackgroundWhitePockets(rgba, width, height, solidWhiteBackground);

  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0 || a > 52) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    if (minC >= 198 && maxC - minC <= 12) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
    }
  }
}

function computeLockupTopNy(nx: number, baseMinNy: number): number {
  if (nx < 0.168) return Math.max(baseMinNy, 0.508);
  if (nx < 0.25) {
    const u = (nx - 0.168) / (0.25 - 0.168);
    return 0.508 + (baseMinNy - 0.508) * u;
  }
  return baseMinNy;
}

function computeLockupLeftNx(ny: number, baseMinNx: number): number {
  if (ny < 0.495) return Math.max(baseMinNx, 0.168);
  if (ny < 0.56) {
    const u = (ny - 0.495) / (0.56 - 0.495);
    return 0.168 + (baseMinNx - 0.168) * u;
  }
  return baseMinNx;
}

function computeLockupRightNx(ny: number, baseMaxNx: number): number {
  if (ny < 0.525) return Math.min(baseMaxNx, 0.684);
  if (ny < 0.65) {
    const u = (ny - 0.525) / (0.65 - 0.525);
    return 0.684 + (baseMaxNx - 0.684) * u;
  }
  if (ny < 0.77) {
    const u = (ny - 0.65) / (0.77 - 0.65);
    return baseMaxNx + (0.750 - baseMaxNx) * u;
  }
  if (ny < 0.875) return Math.min(baseMaxNx, 0.752);
  const u = clamp01((ny - 0.875) / (0.98 - 0.875));
  return 0.752 + (0.642 - 0.752) * u;
}

/**
 * Extracts the Static Lockup Plane from an already-cutout K0 RGBA buffer,
 * hugging the NEON BREACH / XENO-PURGE PROTOCOL silhouette with a smooth cosine-feathered seam
 * so Kira's shoulder, belt, and Xeno's lower-left tentacle remain solely on dynamic Plane 1.
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
  const halfFeather = Math.floor(feather * 0.5);
  const bottomEnd = Math.round(height * bounds.maxNy);

  for (let y = 0; y < height; y++) {
    const ny = (y + 0.5) / height;

    let bottomW = 1;
    if (y >= bottomEnd) {
      bottomW = 0;
    } else if (y > bottomEnd - feather) {
      bottomW = cosineRamp((bottomEnd - y) / feather);
    }
    if (bottomW <= 0) continue;

    const leftStart = Math.round(width * computeLockupLeftNx(ny, bounds.minNx));
    const rightEnd = Math.round(width * computeLockupRightNx(ny, bounds.maxNx));
    if (rightEnd <= leftStart) continue;

    const rowOff = y * width;
    for (let x = leftStart; x < rightEnd; x++) {
      const nx = (x + 0.5) / width;
      const topStart = Math.round(height * computeLockupTopNy(nx, bounds.minNy)) - halfFeather;

      let topW = 1;
      if (y < topStart) {
        topW = 0;
      } else if (y < topStart + feather) {
        topW = cosineRamp((y - topStart) / feather);
      }
      if (topW <= 0) continue;

      let leftW = 1;
      if (x < leftStart + feather) {
        leftW = cosineRamp((x - leftStart) / feather);
      }

      let rightW = 1;
      if (x > rightEnd - feather) {
        rightW = cosineRamp((rightEnd - x) / feather);
      }

      const weight = topW * bottomW * leftW * rightW;
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
  bowDirNx: number,
  bowDirNy: number,
  curvature: number,
): { u: number; v: number } | null {
  let u = 0.5;
  let v = 0.5;

  for (let iter = 0; iter < 5; iter++) {
    const omU = 1 - u;
    const omV = 1 - v;
    const bow = curvature * 4 * u * omU;
    const dBowDu = curvature * 4 * (1 - 2 * u);

    const px =
      omU * omV * quad.p00x +
      u * omV * quad.p10x +
      omU * v * quad.p01x +
      u * v * quad.p11x +
      bowDirNx * bow;
    const py =
      omU * omV * quad.p00y +
      u * omV * quad.p10y +
      omU * v * quad.p01y +
      u * v * quad.p11y +
      bowDirNy * bow;

    const rx = nx - px;
    const ry = ny - py;
    if (Math.abs(rx) < 1e-6 && Math.abs(ry) < 1e-6) break;

    const j00 =
      omV * (quad.p10x - quad.p00x) +
      v * (quad.p11x - quad.p01x) +
      bowDirNx * dBowDu;
    const j01 = omU * (quad.p01x - quad.p00x) + u * (quad.p11x - quad.p10x);
    const j10 =
      omV * (quad.p10y - quad.p00y) +
      v * (quad.p11y - quad.p01y) +
      bowDirNy * dBowDu;
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
  const vPxX = (quad.p01x - quad.p00x) * width;
  const vPxY = (quad.p01y - quad.p00y) * height;
  const vPxLen = Math.max(1e-6, Math.hypot(vPxX, vPxY));
  const bowDirNx = ((vPxX / vPxLen) * height) / width;
  const bowDirNy = vPxY / vPxLen;

  const bowSpanX = Math.abs(bowDirNx * curvature);
  const bowSpanY = Math.abs(bowDirNy * curvature);
  const minNx = Math.min(quad.p00x, quad.p10x, quad.p01x, quad.p11x) - bowSpanX;
  const maxNx = Math.max(quad.p00x, quad.p10x, quad.p01x, quad.p11x) + bowSpanX;
  const minNy = Math.min(quad.p00y, quad.p10y, quad.p01y, quad.p11y) - bowSpanY;
  const maxNy = Math.max(quad.p00y, quad.p10y, quad.p01y, quad.p11y) + bowSpanY;

  const minX = Math.max(0, Math.floor(minNx * width) - 4);
  const maxX = Math.min(width - 1, Math.ceil(maxNx * width) + 4);
  const minY = Math.max(0, Math.floor(minNy * height) - 4);
  const maxY = Math.min(height - 1, Math.ceil(maxNy * height) + 4);

  const quadW = Math.max(1, Math.hypot((quad.p10x - quad.p00x) * width, (quad.p10y - quad.p00y) * height));
  const quadH = Math.max(1, vPxLen);

  for (let y = minY; y <= maxY; y++) {
    const ny = (y + 0.5) / height;
    const rowOff = y * width;
    for (let x = minX; x <= maxX; x++) {
      const nx = (x + 0.5) / width;
      const solved = solveCurvedQuadUv(nx, ny, quad, bowDirNx, bowDirNy, curvature);
      if (!solved) continue;

      const { u, v } = solved;
      if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) continue;

      const p = (rowOff + x) * 4;
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      const a = rgba[p + 3];

      // Preserve glowing cyan/blue side bars flanking the visor aperture
      if (
        a > 0 &&
        ((b >= 140 && g >= 55 && b - r >= 45) ||
          ((u < 0.08 || u > 0.92) && b >= 185 && g >= 165 && b > r + 4 && g >= r))
      ) {
        continue;
      }

      const distU = Math.min(u, 1 - u) * quadW;
      const distV = Math.min(v, 1 - v) * quadH;
      const edgeDistPx = Math.min(distU, distV);

      const isWarmLed =
        (u >= 0.05 &&
          u <= 0.95 &&
          v >= 0 &&
          v <= 1 &&
          r >= 210 &&
          g >= 185 &&
          b >= 190 &&
          r >= b - 18) ||
        r > g + 35 ||
        (r > 190 && b > 130 && g < 165);
      const isMetallicBezel =
        !isWarmLed &&
        r >= 85 &&
        r <= 205 &&
        g >= 75 &&
        g <= 190 &&
        b >= 95 &&
        b <= 215 &&
        r - b < 35;

      if (edgeDistPx <= 0 && !isWarmLed) continue;
      if (isMetallicBezel && edgeDistPx < 2.5) continue;

      let edgeWeight = isWarmLed ? 1 : cosineRamp(edgeDistPx / 3.5);
      if (isMetallicBezel && edgeDistPx < 4.5) {
        edgeWeight *= clamp01((edgeDistPx - 2.5) / 2.0) * 0.45;
      }
      if (edgeWeight <= 0) continue;

      const dx = (clamp01(u) - 0.5) / 0.5;
      const dy = (clamp01(v) - 0.45) / 0.55;
      const r2 = Math.min(1, dx * dx + dy * dy);
      const baseR = 20 + (11 - 20) * r2;
      const baseG = 33 + (19 - 33) * r2;
      const baseB = 70 + (43 - 70) * r2;

      const glareDist = Math.abs(clamp01(u) * 0.72 + clamp01(v) * 0.58 - 0.52);
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
  solidWhiteBackground = false,
): { frameRgba: Uint8ClampedArray; lockupRgba: Uint8ClampedArray | null } {
  const frameRgba = new Uint8ClampedArray(rgba);
  extractTitleEmblemCutout(frameRgba, width, height, solidWhiteBackground);

  const lockupRgba =
    keyframeIndex === 0 ? extractStaticLockupPlane(frameRgba, width, height) : null;

  const quad = KEYFRAME_VISOR_QUADS[keyframeIndex] ?? KEYFRAME_VISOR_QUADS[0];
  inpaintVisorGlass(frameRgba, width, height, quad);
  eraseSlimeDropletTips(frameRgba, width, height);

  return { frameRgba, lockupRgba };
}
