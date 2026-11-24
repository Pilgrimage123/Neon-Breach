export interface NormalizedVertex {
  nx: number;
  ny: number;
}

export type TriangleIndices = readonly [number, number, number];

export const MESH_REF_WIDTH = 960;
export const MESH_REF_HEIGHT = 541;
export const MESH_VERTEX_COUNT = 25;
export const MESH_DEFAULT_DILATION_PX = 0.6;
export const MESH_IDLE_BREATH_AMP_PX = 1.5;
export const MESH_IDLE_BREATH_FREQ_RAD = 2.15;

/**
 * 16 animated anatomical landmarks (V0-V15) + 9 pinned perimeter & lockup-seam anchors (V16-V24):
 *  0: Xeno Upper-Left Tentacle bulb
 *  1: Xeno Mid-Left Tentacle bulb
 *  2: Xeno Lower-Left Tentacle bend
 *  3: Xeno Right Eye
 *  4: Xeno Left Eye
 *  5: Xeno Horn Crown / Brow
 *  6: Xeno Lower Jaw / Tongue center
 *  7: Xeno Outer-Left Cheek / Jaw Corner
 *  8: Kira Visor Center (synced to VISOR_KEYFRAME_QUADS)
 *  9: Kira Hair Crown
 * 10: Kira Hair Tail Tip
 * 11: Kira Chin / Lips
 * 12: Kira Left Shoulder / Raised Kiss-Palm pivot
 * 13: Kira Gun-Hand / Right Forearm
 * 14: Kira Torso / Belt (waist anchor, breath weight 0)
 * 15: Kira Plasma Pistol Muzzle
 * 16..24: Pinned boundary & Static Lockup Plane seam anchors
 */
const PINNED_ANCHORS: readonly NormalizedVertex[] = [
  { nx: 0.0, ny: 0.0 },   // 16: Top-Left corner
  { nx: 0.48, ny: 0.0 },  // 17: Top-Center ring anchor
  { nx: 1.0, ny: 0.0 },   // 18: Top-Right corner
  { nx: 1.0, ny: 1.0 },   // 19: Bottom-Right corner
  { nx: 0.0, ny: 1.0 },   // 20: Bottom-Left corner
  { nx: 0.04, ny: 0.56 }, // 21: Lockup-seam Left
  { nx: 0.42, ny: 0.38 }, // 22: Lockup-seam Mid (above NEON cat-O)
  { nx: 0.69, ny: 0.42 }, // 23: Lockup-seam Right (N corner)
  { nx: 0.76, ny: 1.0 },  // 24: Lockup-seam Bottom-Right
];

function withPinnedAnchors(
  landmarks: readonly NormalizedVertex[],
): readonly NormalizedVertex[] {
  return [...landmarks, ...PINNED_ANCHORS];
}

export const KEYFRAME_LATTICE_VERTICES: readonly (readonly NormalizedVertex[])[] = [
  // K0: Idle / Base Aim
  withPinnedAnchors([
    { nx: 0.08, ny: 0.12 },   // V0
    { nx: 0.05, ny: 0.31 },   // V1
    { nx: 0.06, ny: 0.47 },   // V2
    { nx: 0.22, ny: 0.17 },   // V3
    { nx: 0.31, ny: 0.21 },   // V4
    { nx: 0.26, ny: 0.11 },   // V5
    { nx: 0.25, ny: 0.34 },   // V6
    { nx: 0.15, ny: 0.32 },   // V7
    { nx: 0.845, ny: 0.123 }, // V8
    { nx: 0.73, ny: 0.04 },   // V9
    { nx: 0.52, ny: 0.26 },   // V10
    { nx: 0.85, ny: 0.34 },   // V11
    { nx: 0.73, ny: 0.39 },   // V12
    { nx: 0.88, ny: 0.47 },   // V13
    { nx: 0.84, ny: 0.72 },   // V14
    { nx: 0.95, ny: 0.35 },   // V15
  ]),
  // K1: Beat 1 (Wink)
  withPinnedAnchors([
    { nx: 0.08, ny: 0.12 },
    { nx: 0.05, ny: 0.31 },
    { nx: 0.06, ny: 0.47 },
    { nx: 0.22, ny: 0.17 },
    { nx: 0.31, ny: 0.21 },
    { nx: 0.26, ny: 0.11 },
    { nx: 0.25, ny: 0.34 },
    { nx: 0.15, ny: 0.32 },
    { nx: 0.845, ny: 0.127 },
    { nx: 0.73, ny: 0.04 },
    { nx: 0.52, ny: 0.26 },
    { nx: 0.85, ny: 0.34 },
    { nx: 0.73, ny: 0.39 },
    { nx: 0.88, ny: 0.47 },
    { nx: 0.84, ny: 0.72 },
    { nx: 0.95, ny: 0.35 },
  ]),
  // K2: Beat 2 (Shared Grin)
  withPinnedAnchors([
    { nx: 0.08, ny: 0.12 },
    { nx: 0.05, ny: 0.31 },
    { nx: 0.06, ny: 0.47 },
    { nx: 0.22, ny: 0.16 },
    { nx: 0.31, ny: 0.19 },
    { nx: 0.26, ny: 0.10 },
    { nx: 0.25, ny: 0.34 },
    { nx: 0.15, ny: 0.32 },
    { nx: 0.806, ny: 0.105 },
    { nx: 0.70, ny: 0.04 },
    { nx: 0.48, ny: 0.25 },
    { nx: 0.84, ny: 0.30 },
    { nx: 0.71, ny: 0.37 },
    { nx: 0.88, ny: 0.42 },
    { nx: 0.84, ny: 0.72 },
    { nx: 0.96, ny: 0.25 },
  ]),
  // K3: Beat 3 (Blown Kiss)
  withPinnedAnchors([
    { nx: 0.08, ny: 0.12 },
    { nx: 0.05, ny: 0.31 },
    { nx: 0.06, ny: 0.47 },
    { nx: 0.22, ny: 0.17 },
    { nx: 0.31, ny: 0.20 },
    { nx: 0.26, ny: 0.10 },
    { nx: 0.25, ny: 0.35 },
    { nx: 0.15, ny: 0.32 },
    { nx: 0.80, ny: 0.108 },
    { nx: 0.70, ny: 0.04 },
    { nx: 0.44, ny: 0.25 },
    { nx: 0.75, ny: 0.31 },
    { nx: 0.66, ny: 0.35 },
    { nx: 0.91, ny: 0.46 },
    { nx: 0.84, ny: 0.72 },
    { nx: 0.96, ny: 0.34 },
  ]),
  // K4: Beat 4 (Climax !!)
  withPinnedAnchors([
    { nx: 0.08, ny: 0.11 },
    { nx: 0.05, ny: 0.30 },
    { nx: 0.06, ny: 0.46 },
    { nx: 0.22, ny: 0.17 },
    { nx: 0.29, ny: 0.21 },
    { nx: 0.25, ny: 0.09 },
    { nx: 0.25, ny: 0.36 },
    { nx: 0.15, ny: 0.32 },
    { nx: 0.793, ny: 0.109 },
    { nx: 0.69, ny: 0.04 },
    { nx: 0.43, ny: 0.25 },
    { nx: 0.74, ny: 0.31 },
    { nx: 0.66, ny: 0.35 },
    { nx: 0.91, ny: 0.47 },
    { nx: 0.84, ny: 0.72 },
    { nx: 0.95, ny: 0.31 },
  ]),
];

/**
 * 42 non-overlapping triangles partitioning [0, 1] x [0, 1] with strictly positive
 * clockwise screen-space orientation across all K0-K4 keyframes and blends.
 */
export const WARP_TRIANGLES: readonly TriangleIndices[] = [
  // Left boundary strip
  [16, 0, 1],
  [16, 1, 21],
  [1, 2, 21],
  [16, 21, 20],
  // Top-left & Xeno upper
  [16, 5, 0],
  [16, 17, 5],
  [0, 5, 3],
  [0, 3, 7],
  [0, 7, 1],
  [1, 7, 2],
  // Xeno face & jaw
  [5, 4, 3],
  [3, 4, 6],
  [3, 6, 7],
  [7, 6, 21],
  [7, 21, 2],
  [6, 22, 21],
  [4, 22, 6],
  // Center ring & hair tail
  [17, 10, 5],
  [5, 10, 4],
  [4, 10, 22],
  [17, 9, 10],
  // Kira upper head, visor & shoulder
  [17, 18, 9],
  [9, 18, 8],
  [9, 8, 11],
  [9, 11, 12],
  [9, 12, 10],
  [10, 12, 22],
  [12, 23, 22],
  [12, 11, 23],
  [8, 18, 15],
  [8, 15, 11],
  [11, 15, 13],
  // Kira lower body, gun-hand & right boundary
  [18, 19, 15],
  [15, 19, 13],
  [13, 19, 14],
  [11, 13, 14],
  [11, 14, 23],
  [23, 14, 24],
  [14, 19, 24],
  // Bottom lockup backing
  [20, 21, 22],
  [20, 22, 23],
  [20, 23, 24],
];

// Upper-body breathing weights (1.0 on head/visor/tentacles, tapering to 0.0 on waist V14 & pinned V16-V24)
const IDLE_BREATH_WEIGHTS = new Float32Array([
  0.85, // V0: Xeno upper-left tentacle
  0.70, // V1: Xeno mid-left tentacle
  0.45, // V2: Xeno lower-left tentacle
  1.00, // V3: Xeno right eye
  1.00, // V4: Xeno left eye
  1.00, // V5: Xeno crown
  0.75, // V6: Xeno lower jaw
  0.80, // V7: Xeno cheek
  1.00, // V8: Kira visor center
  1.00, // V9: Kira hair crown
  0.85, // V10: Kira hair tail
  0.95, // V11: Kira chin / lips
  0.55, // V12: Kira left shoulder
  0.75, // V13: Kira gun-hand
  0.00, // V14: Kira torso/belt waist anchor
  0.80, // V15: Kira pistol muzzle
  0, 0, 0, 0, 0, 0, 0, 0, 0, // V16..V24: pinned
]);

// Subtle phase separation between Xeno (0.0 rad) and Kira (0.9 rad)
const IDLE_BREATH_PHASES = new Float32Array([
  0.0, 0.15, 0.25, 0.0, 0.0, 0.0, 0.1, 0.05,
  0.9, 0.9, 1.05, 0.9, 0.95, 1.0, 0.0, 1.05,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

export interface MeshWarpScratch {
  activeVertices: Float32Array;
  srcVerticesA: Float32Array;
  srcVerticesB: Float32Array;
  affineMatrix: Float64Array;
  dilatedTri: Float64Array;
}

export function createMeshWarpScratch(): MeshWarpScratch {
  return {
    activeVertices: new Float32Array(MESH_VERTEX_COUNT * 2),
    srcVerticesA: new Float32Array(MESH_VERTEX_COUNT * 2),
    srcVerticesB: new Float32Array(MESH_VERTEX_COUNT * 2),
    affineMatrix: new Float64Array(6),
    dilatedTri: new Float64Array(6),
  };
}

/**
 * Computes normalized vertical idle breathing displacement for vertex `vertexIdx` at `idleTimeSec`.
 */
export function computeVertexIdleBreathNormY(
  vertexIdx: number,
  idleTimeSec: number,
): number {
  if (vertexIdx < 0 || vertexIdx >= MESH_VERTEX_COUNT) return 0;
  const weight = IDLE_BREATH_WEIGHTS[vertexIdx];
  if (weight === 0) return 0;
  const phase = IDLE_BREATH_PHASES[vertexIdx];
  const pxOffset =
    Math.sin(idleTimeSec * MESH_IDLE_BREATH_FREQ_RAD + phase) *
    MESH_IDLE_BREATH_AMP_PX *
    weight;
  return pxOffset / MESH_REF_HEIGHT;
}

/**
 * Solves exact 2D affine matrix [a, b, c, d, e, f] mapping (sx_i, sy_i) -> (dx_i, dy_i).
 * Returns false if source triangle is degenerate (|det| < 1e-6).
 */
export function solveTriangleAffine(
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number,
  outMatrix: Float64Array | number[],
): boolean {
  const u1 = sx1 - sx0;
  const v1 = sy1 - sy0;
  const u2 = sx2 - sx0;
  const v2 = sy2 - sy0;
  const det = u1 * v2 - u2 * v1;
  if (Math.abs(det) < 1e-6) {
    return false;
  }

  const invDet = 1 / det;
  const dx10 = dx1 - dx0;
  const dx20 = dx2 - dx0;
  const dy10 = dy1 - dy0;
  const dy20 = dy2 - dy0;

  const a = (dx10 * v2 - dx20 * v1) * invDet;
  const c = (u1 * dx20 - u2 * dx10) * invDet;
  const b = (dy10 * v2 - dy20 * v1) * invDet;
  const d = (u1 * dy20 - u2 * dy10) * invDet;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;

  outMatrix[0] = a;
  outMatrix[1] = b;
  outMatrix[2] = c;
  outMatrix[3] = d;
  outMatrix[4] = e;
  outMatrix[5] = f;
  return true;
}

/**
 * Expands each triangle clip vertex outward from the triangle centroid by `dilationPx`
 * to eliminate Canvas2D ~0.5px anti-aliased hairline seams between adjacent triangles.
 */
export function computeDilatedTriangle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dilationPx: number,
  outCoords: Float64Array | number[],
): void {
  const cx = (x0 + x1 + x2) / 3;
  const cy = (y0 + y1 + y2) / 3;

  const vx0 = x0 - cx;
  const vy0 = y0 - cy;
  const len0 = Math.hypot(vx0, vy0);
  const s0 = len0 > 1e-6 ? dilationPx / len0 : 0;

  const vx1 = x1 - cx;
  const vy1 = y1 - cy;
  const len1 = Math.hypot(vx1, vy1);
  const s1 = len1 > 1e-6 ? dilationPx / len1 : 0;

  const vx2 = x2 - cx;
  const vy2 = y2 - cy;
  const len2 = Math.hypot(vx2, vy2);
  const s2 = len2 > 1e-6 ? dilationPx / len2 : 0;

  outCoords[0] = x0 + vx0 * s0;
  outCoords[1] = y0 + vy0 * s0;
  outCoords[2] = x1 + vx1 * s1;
  outCoords[3] = y1 + vy1 * s1;
  outCoords[4] = x2 + vx2 * s2;
  outCoords[5] = y2 + vy2 * s2;
}

function writeKeyframedLattice(frameIdx: number, outVertices: Float32Array): void {
  const idx = Math.max(0, Math.min(KEYFRAME_LATTICE_VERTICES.length - 1, frameIdx));
  const verts = KEYFRAME_LATTICE_VERTICES[idx];
  for (let i = 0; i < MESH_VERTEX_COUNT; i++) {
    outVertices[i * 2] = verts[i].nx;
    outVertices[i * 2 + 1] = verts[i].ny;
  }
}

/**
 * Interpolates vertex positions between `frameA` and `frameB` into `outVertices`
 * and optionally adds +-1.5px sinusoidal idle breathing over upper-body landmarks.
 */
export function interpolateLattice(
  frameA: number,
  frameB: number,
  blendU: number,
  idleTimeSec: number,
  idleBreathingActive: boolean,
  outVertices: Float32Array,
): void {
  const idxA = Math.max(0, Math.min(KEYFRAME_LATTICE_VERTICES.length - 1, frameA));
  const idxB = Math.max(0, Math.min(KEYFRAME_LATTICE_VERTICES.length - 1, frameB));
  const u = blendU <= 0 ? 0 : blendU >= 1 ? 1 : blendU;
  const omU = 1 - u;

  const vertsA = KEYFRAME_LATTICE_VERTICES[idxA];
  const vertsB = KEYFRAME_LATTICE_VERTICES[idxB];

  for (let i = 0; i < MESH_VERTEX_COUNT; i++) {
    const nx = vertsA[i].nx * omU + vertsB[i].nx * u;
    let ny = vertsA[i].ny * omU + vertsB[i].ny * u;
    if (idleBreathingActive) {
      ny += computeVertexIdleBreathNormY(i, idleTimeSec);
    }
    outVertices[i * 2] = nx;
    outVertices[i * 2 + 1] = ny;
  }
}

function drawWarpedSpritePass(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcVertices: Float32Array,
  dstVertices: Float32Array,
  alpha: number,
  w: number,
  h: number,
  affineOut: Float64Array,
  dilatedOut: Float64Array,
): void {
  if (alpha <= 0.001) return;
  const imgW =
    typeof (img as HTMLCanvasElement).width === 'number'
      ? (img as HTMLCanvasElement).width
      : w;
  const imgH =
    typeof (img as HTMLCanvasElement).height === 'number'
      ? (img as HTMLCanvasElement).height
      : h;
  const srcScaleX = imgW / Math.max(1, w);
  const srcScaleY = imgH / Math.max(1, h);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';

  for (let t = 0; t < WARP_TRIANGLES.length; t++) {
    const tri = WARP_TRIANGLES[t];
    const i0 = tri[0] * 2;
    const i1 = tri[1] * 2;
    const i2 = tri[2] * 2;

    const sx0 = srcVertices[i0] * w;
    const sy0 = srcVertices[i0 + 1] * h;
    const sx1 = srcVertices[i1] * w;
    const sy1 = srcVertices[i1 + 1] * h;
    const sx2 = srcVertices[i2] * w;
    const sy2 = srcVertices[i2 + 1] * h;

    const dx0 = dstVertices[i0] * w;
    const dy0 = dstVertices[i0 + 1] * h;
    const dx1 = dstVertices[i1] * w;
    const dy1 = dstVertices[i1 + 1] * h;
    const dx2 = dstVertices[i2] * w;
    const dy2 = dstVertices[i2 + 1] * h;

    const srcDet = (sx1 - sx0) * (sy2 - sy0) - (sy1 - sy0) * (sx2 - sx0);
    const dstDet = (dx1 - dx0) * (dy2 - dy0) - (dy1 - dy0) * (dx2 - dx0);
    if (Math.abs(srcDet) < 1e-6 || Math.abs(dstDet) < 1e-6) continue;

    // Tight source bounding box padded by 2px for bilinear filter margin
    const minSx = Math.max(0, Math.floor(Math.min(sx0, sx1, sx2)) - 2);
    const minSy = Math.max(0, Math.floor(Math.min(sy0, sy1, sy2)) - 2);
    const maxSx = Math.min(w, Math.ceil(Math.max(sx0, sx1, sx2)) + 2);
    const maxSy = Math.min(h, Math.ceil(Math.max(sy0, sy1, sy2)) + 2);
    const bw = maxSx - minSx;
    const bh = maxSy - minSy;
    if (bw <= 0 || bh <= 0) continue;

    const isIdentity =
      Math.abs(dx0 - sx0) < 0.02 &&
      Math.abs(dy0 - sy0) < 0.02 &&
      Math.abs(dx1 - sx1) < 0.02 &&
      Math.abs(dy1 - sy1) < 0.02 &&
      Math.abs(dx2 - sx2) < 0.02 &&
      Math.abs(dy2 - sy2) < 0.02;

    if (!isIdentity) {
      if (
        !solveTriangleAffine(
          sx0,
          sy0,
          sx1,
          sy1,
          sx2,
          sy2,
          dx0,
          dy0,
          dx1,
          dy1,
          dx2,
          dy2,
          affineOut,
        )
      ) {
        continue;
      }
    }

    computeDilatedTriangle(
      dx0,
      dy0,
      dx1,
      dy1,
      dx2,
      dy2,
      MESH_DEFAULT_DILATION_PX,
      dilatedOut,
    );

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dilatedOut[0], dilatedOut[1]);
    ctx.lineTo(dilatedOut[2], dilatedOut[3]);
    ctx.lineTo(dilatedOut[4], dilatedOut[5]);
    ctx.closePath();
    ctx.clip();

    if (!isIdentity) {
      ctx.transform(
        affineOut[0],
        affineOut[1],
        affineOut[2],
        affineOut[3],
        affineOut[4],
        affineOut[5],
      );
    }
    ctx.drawImage(
      img,
      minSx * srcScaleX,
      minSy * srcScaleY,
      bw * srcScaleX,
      bh * srcScaleY,
      minSx,
      minSy,
      bw,
      bh,
    );
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders Plane 1 (K_A and K_B) bidirectionally warped onto interpolated vertices P(u)
 * using zero-GC pre-allocated scratch buffers and solidity-preserving opacities.
 */
export function renderWarpedFramePair(
  ctx: CanvasRenderingContext2D,
  frameAImg: CanvasImageSource,
  frameBImg: CanvasImageSource,
  frameAIdx: number,
  frameBIdx: number,
  blendU: number,
  alphaA: number,
  alphaB: number,
  scratch: MeshWarpScratch,
  w: number,
  h: number,
  idleTimeSec = 0,
  idleBreathingActive = false,
): void {
  interpolateLattice(
    frameAIdx,
    frameBIdx,
    blendU,
    idleTimeSec,
    idleBreathingActive,
    scratch.activeVertices,
  );

  if (frameAIdx === frameBIdx || alphaB <= 0.001) {
    if (!idleBreathingActive) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(frameAImg, 0, 0, w, h);
      ctx.restore();
      return;
    }
    writeKeyframedLattice(frameAIdx, scratch.srcVerticesA);
    drawWarpedSpritePass(
      ctx,
      frameAImg,
      scratch.srcVerticesA,
      scratch.activeVertices,
      1,
      w,
      h,
      scratch.affineMatrix,
      scratch.dilatedTri,
    );
    return;
  }

  if (alphaA > 0.001) {
    writeKeyframedLattice(frameAIdx, scratch.srcVerticesA);
    drawWarpedSpritePass(
      ctx,
      frameAImg,
      scratch.srcVerticesA,
      scratch.activeVertices,
      alphaA,
      w,
      h,
      scratch.affineMatrix,
      scratch.dilatedTri,
    );
  }

  if (alphaB > 0.001) {
    writeKeyframedLattice(frameBIdx, scratch.srcVerticesB);
    drawWarpedSpritePass(
      ctx,
      frameBImg,
      scratch.srcVerticesB,
      scratch.activeVertices,
      alphaB,
      w,
      h,
      scratch.affineMatrix,
      scratch.dilatedTri,
    );
  }
}
