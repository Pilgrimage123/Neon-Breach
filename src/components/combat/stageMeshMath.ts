export function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1];
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1];
}

/**
 * Normalized UV rectangle inside a texture or individual frame canvas.
 * For pre-cut per-frame canvases, defaults to the full [0..1, 0..1] quad;
 * for packed sprite-sheet atlases, remaps to the sub-frame UV bounds.
 */
export interface SpriteFrameUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export const FULL_FRAME_UV: SpriteFrameUV = {
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1,
};

/**
 * Single anatomical control knot along the character's vertical axis.
 * - dx, dy: local pixel displacement (prior to camera zoom)
 * - rotRad: local tangent rotation in radians around the knot center
 * - scaleX: local horizontal width multiplier (squash/expansion at that height)
 */
export interface AnatomicalKnot {
  dx: number;
  dy: number;
  rotRad: number;
  scaleX: number;
}

/**
 * 4 virtual anatomical control points exposed on every MeshSprite:
 * - feet (h = 0.00): pinned to the bridge deck baseline by default
 * - pelvis (h = 0.33): lower-body knee/hip flex
 * - waist (h = 0.67): mid-torso spine bend & kinetic hit-shear
 * - head (h = 1.00): upper-body/crown whip & anticipation lean
 */
export interface ControlPointDeform {
  feet: AnatomicalKnot;
  pelvis: AnatomicalKnot;
  waist: AnatomicalKnot;
  head: AnatomicalKnot;
}

export function createIdentityControlPoints(): ControlPointDeform {
  return {
    feet: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    pelvis: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    waist: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
    head: { dx: 0, dy: 0, rotRad: 0, scaleX: 1 },
  };
}

/**
 * Unified GPU shader uniforms attached to each MeshSprite draw call.
 */
export interface CharacterShaderUniforms {
  /** Ground-anchored horizontal harmonic sway in pixels at v=1 (0 at feet v=0) */
  swayAmpPx: number;
  /** Sway harmonic frequency (rad/s) */
  swayFreq: number;
  /** Sway phase offset (radians) */
  swayPhase: number;
  /** Ground-anchored squash-and-stretch multiplier [scaleX, scaleY] */
  squashStretch: [number, number];
  /** Ground-anchored linear skew/shear [shearX, shearY] in pixels at top edge */
  shearPx: [number, number];
  /** Cross-dissolve blend factor in [0..1] (1 = 100% primary frame, <1 blends secondary frame) */
  frameBlendAlpha: number;
  /** Toggleable UV wave distortion amplitude [ampU, ampV] in normalized UV space */
  uvDistortAmp: [number, number];
  /** UV wave spatial frequency */
  uvDistortFreq: number;
  /** UV wave temporal phase */
  uvDistortPhase: number;
  /** Multiplicative RGBA tint [r, g, b, a] in 0..1 */
  tintRgba: [number, number, number, number];
  /** Hit-flash / bio-luminescent flash [r, g, b, intensity] in 0..1 */
  flashRgba: [number, number, number, number];
}

export function createDefaultShaderUniforms(): CharacterShaderUniforms {
  return {
    swayAmpPx: 0,
    swayFreq: 2.4,
    swayPhase: 0,
    squashStretch: [1, 1],
    shearPx: [0, 0],
    frameBlendAlpha: 1,
    uvDistortAmp: [0, 0],
    uvDistortFreq: 12,
    uvDistortPhase: 0,
    tintRgba: [1, 1, 1, 1],
    flashRgba: [1, 1, 1, 0],
  };
}

export type StageTextureSource = HTMLCanvasElement | ImageBitmap;

/**
 * Complete declarative draw command for a single character, drone, afterimage, or reflection.
 */
export interface SpriteRenderCommand {
  /** Unique stable key for pooling the underlying MeshSprite (e.g. 'hero', 'enemy:e1', 'refl:hero') */
  id: string;
  /** Primary raster frame source */
  primarySource: StageTextureSource;
  /** Optional outgoing raster frame source for smoothstep cross-dissolve */
  secondarySource?: StageTextureSource | null;
  /** Primary UV window (defaults to FULL_FRAME_UV) */
  primaryUv?: SpriteFrameUV;
  /** Secondary UV window (defaults to FULL_FRAME_UV) */
  secondaryUv?: SpriteFrameUV;
  /** World-space X coordinate of the character's bottom-center foot anchor */
  worldX: number;
  /** World-space Y coordinate of the character's bottom-center foot anchor */
  worldY: number;
  /** Drawn width in world pixels (frame.w * drawScale) */
  widthPx: number;
  /** Drawn height in world pixels (frame.h * drawScale) */
  heightPx: number;
  /** Horizontal offset from left edge to anchorX in world pixels (frame.anchorX * drawScale) */
  anchorOffsetXPx: number;
  /** Vertical offset from top edge to bottomY in world pixels (frame.bottomY * drawScale) */
  anchorOffsetYPx: number;
  /** Optional secondary frame metrics when cross-blending frames of slightly different bounds */
  secondaryWidthPx?: number;
  secondaryHeightPx?: number;
  secondaryAnchorOffsetXPx?: number;
  secondaryAnchorOffsetYPx?: number;
  /** Horizontal facing sign/scale: +1 (right), -1 (mirrored left), or continuous [-1..+1] for 2.5D flips */
  facingSign: number;
  /** Vertical flip multiplier: +1 (upright) or -0.3..-0.32 (planar bridge reflection) */
  verticalScaleSign?: number;
  /** Base rigid rotation around the foot anchor in radians */
  rotationRad: number;
  /** Overall opacity in [0..1] */
  alpha: number;
  /** Whether this draw call belongs to the planar bridge deck reflection pass */
  isReflection?: boolean;
  /** Optional sort priority for focal cut-in layering (0=reflection, 1=bystander, 2=default, 3=target, 4=attacker) */
  drawPriority?: number;
  /** 4-point anatomical spline deformation */
  deform: ControlPointDeform;
  /** Unified GPU shader uniforms */
  uniforms: CharacterShaderUniforms;
}

/**
 * Precomputed topology for a subdivided (cols x rows) 2D mesh grid.
 * Vertex layout is row-major from bottom (row 0, vBottom = 0) to top (row = rows, vBottom = 1).
 */
export interface MeshGridTopology {
  cols: number;
  rows: number;
  vertexCount: number;
  indexCount: number;
  /** Normalized horizontal grid fractions uGrid[col] in [0..1] */
  uGrid: Float32Array;
  /** Normalized vertical height fractions hGrid[row] in [0..1] (0 = feet, 1 = head) */
  hGrid: Float32Array;
  /** Triangle index buffer (cols * rows * 6 indices) */
  indices: Uint16Array;
}

/** Number of interleaved floats per vertex in the dynamic VBO:
 * [worldX, worldY, u0, v0, u1, v1, heightWeight, alpha]
 */
export const FLOATS_PER_VERTEX = 8;

export function createMeshGridTopology(cols = 4, rows = 6): MeshGridTopology {
  const safeCols = Math.max(1, Math.floor(cols));
  const safeRows = Math.max(1, Math.floor(rows));
  const vertsPerRow = safeCols + 1;
  const vertexCount = (safeRows + 1) * vertsPerRow;
  const indexCount = safeCols * safeRows * 6;

  const uGrid = new Float32Array(safeCols + 1);
  for (let c = 0; c <= safeCols; c++) {
    uGrid[c] = c / safeCols;
  }

  const hGrid = new Float32Array(safeRows + 1);
  for (let r = 0; r <= safeRows; r++) {
    hGrid[r] = r / safeRows;
  }

  const indices = new Uint16Array(indexCount);
  let ptr = 0;
  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      const i00 = r * vertsPerRow + c;
      const i10 = i00 + 1;
      const i01 = (r + 1) * vertsPerRow + c;
      const i11 = i01 + 1;
      // Counter-clockwise triangles
      indices[ptr++] = i00;
      indices[ptr++] = i10;
      indices[ptr++] = i11;

      indices[ptr++] = i00;
      indices[ptr++] = i11;
      indices[ptr++] = i01;
    }
  }

  return {
    cols: safeCols,
    rows: safeRows,
    vertexCount,
    indexCount,
    uGrid,
    hGrid,
    indices,
  };
}

/**
 * Evaluates the 4-control-point anatomical spline at normalized height h in [0..1]
 * using C1 cubic Hermite interpolation across:
 *   C0 (feet, h = 0.0) -> C1 (pelvis, h = 1/3) -> C2 (waist, h = 2/3) -> C3 (head, h = 1.0)
 * Mutates `out` in-place to avoid heap allocations in the 60fps loop.
 */
export function evaluateAnatomicalSplineRow(
  hNorm: number,
  deform: ControlPointDeform,
  out: AnatomicalKnot,
): AnatomicalKnot {
  const h = Math.max(0, Math.min(1, hNorm));
  const c0 = deform.feet;
  const c1 = deform.pelvis;
  const c2 = deform.waist;
  const c3 = deform.head;

  // Map h in [0..1] to segment s in [0..3]
  const scaled = h * 3;
  const seg = Math.min(2, Math.floor(scaled));
  const t = scaled - seg;
  const t2 = t * t;
  const t3 = t2 * t;

  // Smoothstep / Catmull-Rom tangent weights
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const p0 = seg === 0 ? c0 : seg === 1 ? c1 : c2;
  const p1 = seg === 0 ? c1 : seg === 1 ? c2 : c3;
  const pPrev = seg === 0 ? c0 : seg === 1 ? c0 : c1;
  const pNext = seg === 0 ? c2 : seg === 1 ? c3 : c3;

  const m0dx = (p1.dx - pPrev.dx) * 0.5;
  const m1dx = (pNext.dx - p0.dx) * 0.5;
  const m0dy = (p1.dy - pPrev.dy) * 0.5;
  const m1dy = (pNext.dy - p0.dy) * 0.5;
  const m0rot = (p1.rotRad - pPrev.rotRad) * 0.5;
  const m1rot = (pNext.rotRad - p0.rotRad) * 0.5;
  const m0sx = (p1.scaleX - pPrev.scaleX) * 0.5;
  const m1sx = (pNext.scaleX - p0.scaleX) * 0.5;

  out.dx = h00 * p0.dx + h10 * m0dx + h01 * p1.dx + h11 * m1dx;
  out.dy = h00 * p0.dy + h10 * m0dy + h01 * p1.dy + h11 * m1dy;
  out.rotRad = h00 * p0.rotRad + h10 * m0rot + h01 * p1.rotRad + h11 * m1rot;
  out.scaleX = h00 * p0.scaleX + h10 * m0sx + h01 * p1.scaleX + h11 * m1sx;
  return out;
}

const SCRATCH_KNOT: AnatomicalKnot = { dx: 0, dy: 0, rotRad: 0, scaleX: 1 };

/**
 * Populates a pre-allocated Float32Array (size = topology.vertexCount * FLOATS_PER_VERTEX)
 * in-place with the deformed 2D mesh vertices and dual-frame UVs.
 *
 * Coordinate convention:
 * - Local (0, 0) is the character's planted foot anchor `(anchorOffsetXPx, anchorOffsetYPx)`.
 * - Row 0 (h = 0) corresponds to the bottom edge of the frame (`yLocal = heightPx - anchorOffsetYPx`,
 *   where the foot sole sits at `yLocal = 0`).
 * - Row `rows` (h = 1) corresponds to the top edge of the frame (`yLocal = -anchorOffsetYPx`).
 */
export function computeDeformedMeshVertices(
  topology: MeshGridTopology,
  cmd: SpriteRenderCommand,
  outVertices: Float32Array,
): void {
  const { cols, rows, uGrid, hGrid } = topology;
  const uv0 = cmd.primaryUv ?? FULL_FRAME_UV;
  const uv1 = cmd.secondaryUv ?? FULL_FRAME_UV;

  const leftLocalX = -cmd.anchorOffsetXPx;
  const topLocalY = -cmd.anchorOffsetYPx;
  const bottomLocalY = cmd.heightPx - cmd.anchorOffsetYPx;

  const hasCustomSecMetrics =
    cmd.secondaryWidthPx !== undefined &&
    cmd.secondaryHeightPx !== undefined &&
    cmd.secondaryAnchorOffsetXPx !== undefined &&
    cmd.secondaryAnchorOffsetYPx !== undefined &&
    cmd.secondaryWidthPx > 0 &&
    cmd.secondaryHeightPx > 0;

  const facing = cmd.facingSign;
  const vSign = cmd.verticalScaleSign ?? 1;
  const baseCos = Math.cos(cmd.rotationRad);
  const baseSin = Math.sin(cmd.rotationRad);

  let ptr = 0;
  for (let r = 0; r <= rows; r++) {
    const h = hGrid[r]; // 0 at bottom (feet), 1 at top (head)
    const vTex = 1 - h; // Texture V: 1 at bottom, 0 at top
    const v0Coord = uv0.v0 + (uv0.v1 - uv0.v0) * vTex;

    evaluateAnatomicalSplineRow(h, cmd.deform, SCRATCH_KNOT);

    // Base local Y before knot rotation/displacement
    const rawLocalY = bottomLocalY + (topLocalY - bottomLocalY) * h;
    const vSec = hasCustomSecMetrics
      ? (rawLocalY + cmd.secondaryAnchorOffsetYPx!) / cmd.secondaryHeightPx!
      : vTex;
    const v1Coord = uv1.v0 + (uv1.v1 - uv1.v0) * vSec;

    const knotCos = Math.cos(SCRATCH_KNOT.rotRad);
    const knotSin = Math.sin(SCRATCH_KNOT.rotRad);

    for (let c = 0; c <= cols; c++) {
      const u = uGrid[c];
      const unscaledLocalX = leftLocalX + cmd.widthPx * u;
      const u0Coord = uv0.u0 + (uv0.u1 - uv0.u0) * u;
      const uSec = hasCustomSecMetrics
        ? (unscaledLocalX + cmd.secondaryAnchorOffsetXPx!) / cmd.secondaryWidthPx!
        : u;
      const u1Coord = uv1.u0 + (uv1.u1 - uv1.u0) * uSec;

      // Local X relative to the spine centerline (anchorX), scaled by knot scaleX
      const rawLocalX = unscaledLocalX * SCRATCH_KNOT.scaleX;

      // Apply local knot rotation around spine center (0, rawLocalY) + knot displacement
      const spineRotX = rawLocalX * knotCos + SCRATCH_KNOT.dx;
      const spineRotY = rawLocalY + rawLocalX * knotSin + SCRATCH_KNOT.dy;

      // Apply facing flip and vertical reflection scale
      const mirroredX = spineRotX * facing;
      const scaledY = spineRotY * vSign;

      // Apply rigid base rotation around foot anchor (0, 0) and translate to world space
      const worldX = cmd.worldX + mirroredX * baseCos - scaledY * baseSin;
      const worldY = cmd.worldY + mirroredX * baseSin + scaledY * baseCos;

      outVertices[ptr++] = worldX;
      outVertices[ptr++] = worldY;
      outVertices[ptr++] = u0Coord;
      outVertices[ptr++] = v0Coord;
      outVertices[ptr++] = u1Coord;
      outVertices[ptr++] = v1Coord;
      outVertices[ptr++] = h;
      outVertices[ptr++] = cmd.alpha;
    }
  }
}
