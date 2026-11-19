import type { EnemyArchetype, TileType } from '../../engine/types';
import type { BruteJuiceConfig, BruteJuiceSample } from '../../utils/bruteJuiceController';
import type {
  SpitterJuiceConfig,
  SpitterJuiceSample,
} from '../../utils/spitterJuiceController';
import type { SequencerFrameState } from './CombatActionSequencer';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import type { ActorAnim } from './combatStageTypes';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';

export type RendererMode = 'webgl2' | 'canvas2d';

export interface RendererRolloutConfig {
  /** Primary toggle between the new WebGL2 deformable MeshSprite renderer and legacy Canvas2D */
  defaultMode: RendererMode;
  /** Default state for the 4x6 mesh wireframe & 4-control-point anatomical spline overlay */
  defaultDebugWireframe: boolean;
  /** Subdivided mesh grid columns (default: 4) */
  meshCols: number;
  /** Subdivided mesh grid rows from feet (row 0) to head (row N) (default: 6) */
  meshRows: number;
}

export const DEFAULT_RENDERER_CONFIG: RendererRolloutConfig = {
  defaultMode: 'webgl2',
  defaultDebugWireframe: false,
  meshCols: 4,
  meshRows: 6,
};

export interface StageRenderOptions {
  rendererMode?: RendererMode;
  webglRenderer?: ICharacterStageRenderer | null;
  fgCtx?: CanvasRenderingContext2D | null;
  debugMeshWireframe?: boolean;
  spitterJuiceConfig?: SpitterJuiceConfig;
  spitterLabActive?: boolean;
  bruteJuiceConfig?: BruteJuiceConfig;
  bruteLabActive?: boolean;
  presentationConfig?: CombatPresentationConfig;
  sequencerFrame?: SequencerFrameState;
  getActorJuice?: (actorId: string) => ActorJuiceSnapshot;
  reducedMotion?: boolean;
}

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

/**
 * Complete declarative draw command for a single character, drone, afterimage, or reflection.
 */
export interface SpriteRenderCommand {
  /** Unique stable key for pooling the underlying MeshSprite (e.g. 'hero', 'enemy:e1', 'refl:hero') */
  id: string;
  /** Primary raster frame source */
  primarySource: HTMLCanvasElement;
  /** Optional outgoing raster frame source for smoothstep cross-dissolve */
  secondarySource?: HTMLCanvasElement | null;
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
 * Handle to a reusable subdivided 2D MeshSprite instance.
 */
export interface IMeshSprite {
  readonly id: string;
  readonly cols: number;
  readonly rows: number;
  setFrame(
    primarySource: HTMLCanvasElement,
    primaryUv?: SpriteFrameUV,
    secondarySource?: HTMLCanvasElement | null,
    secondaryUv?: SpriteFrameUV,
  ): void;
  setTransform(
    worldX: number,
    worldY: number,
    widthPx: number,
    heightPx: number,
    anchorOffsetXPx: number,
    anchorOffsetYPx: number,
    facingSign: number,
    rotationRad: number,
    verticalScaleSign?: number,
  ): void;
  setDeform(deform: ControlPointDeform): void;
  setShaderUniforms(uniforms: CharacterShaderUniforms): void;
}

/**
 * Clean, minimal Renderer Adapter Interface decoupling CombatStageCanvas / combatRenderer
 * from the underlying GPU API (WebGL2 vs Canvas2D).
 */
export interface ICharacterStageRenderer {
  readonly backend: RendererMode;
  readonly isReady: boolean;
  /** Begins a new frame, syncing viewport size, DPR, and camera transform */
  beginFrame(params: {
    width: number;
    height: number;
    dpr: number;
    cameraZoom: number;
    cameraPanX: number;
    cameraPanY: number;
    cameraRotRad?: number;
    shakeOffsetX: number;
    shakeOffsetY: number;
    deckBackY: number;
    deckFrontY: number;
    viewProjMatrix?: Float32Array;
  }): void;
  /** Retrieves or creates a pooled MeshSprite for the given actor id */
  getOrCreateSprite(id: string): IMeshSprite;
  /** Queues a declarative MeshSprite command for rendering in the current pass */
  drawSprite(cmd: SpriteRenderCommand): void;
  /** Flushes all queued sprites to the GPU (and optional debug wireframe overlay) */
  endFrame(debugWireframeCtx?: CanvasRenderingContext2D | null): void;
  /** Clears the WebGL framebuffer when switching back to Canvas2D mode */
  clearCanvas(): void;
  /** Releases GPU buffers, shaders, and cached textures */
  dispose(): void;
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

export function createMeshGridTopology(
  cols: number = DEFAULT_RENDERER_CONFIG.meshCols,
  rows: number = DEFAULT_RENDERER_CONFIG.meshRows,
): MeshGridTopology {
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

/**
 * Maps Heroine animation state, status effects, and hit-flash timers into
 * 4-control-point anatomical spline deformations and GPU shader uniforms.
 */
export function deriveHeroineDeformAndUniforms(params: {
  mode: string;
  breathScaleX: number;
  breathScaleY: number;
  tiltRad: number;
  frameBlendAlpha: number;
  flashTimer: number;
  corrode: number;
  hoveredColor: TileType | null;
  elapsed: number;
  isProne: boolean;
  cutIn?: ActorJuiceSnapshot;
}): { deform: ControlPointDeform; uniforms: CharacterShaderUniforms } {
  const deform = createIdentityControlPoints();
  const uniforms = createDefaultShaderUniforms();

  const {
    mode,
    breathScaleX,
    breathScaleY,
    frameBlendAlpha,
    flashTimer,
    corrode,
    hoveredColor,
    elapsed,
    isProne,
    cutIn,
  } = params;

  const isDodging = mode === 'dodge';
  const cutInScaleX = cutIn && !isDodging ? cutIn.scaleX : 1;
  const cutInScaleY = cutIn && !isDodging ? cutIn.scaleY : 1;
  uniforms.squashStretch = [breathScaleX * cutInScaleX, breathScaleY * cutInScaleY];
  uniforms.frameBlendAlpha = frameBlendAlpha;
  if (cutIn && !isDodging) {
    uniforms.tintRgba = cutIn.tintRgba;
  }

  if (!isProne) {
    // Subtle organic breathing & combat stance S-curve in the 4 control points
    const breathWave = Math.sin(elapsed * 2.6);
    const secondaryWave = Math.cos(elapsed * 1.3);

    if (mode === 'idle') {
      deform.pelvis.dx = breathWave * 0.6;
      deform.waist.dx = breathWave * 1.4;
      deform.waist.dy = -breathWave * 1.1;
      deform.head.dx = breathWave * 2.1 + secondaryWave * 0.8;
      deform.head.dy = -breathWave * 1.8;
      deform.head.rotRad = breathWave * 0.014;

      uniforms.swayAmpPx = hoveredColor === 'attack' ? 2.2 : 1.4;
      uniforms.swayFreq = 2.6;
      uniforms.swayPhase = elapsed * 2.6;
    } else if (mode === 'dodge') {
      // Sleek aerodynamic dodge posture: low agile shear with subtle cyan speed energy
      deform.pelvis.dx = -1.2;
      deform.waist.dx = -2.4;
      deform.waist.dy = 0.8;
      deform.head.dx = -1.8;
      uniforms.shearPx = [-2.2, 0];
    } else if (mode === 'shoot' || mode === 'kick' || mode === 'slash') {
      // Forward kinetic combat lean through waist and head while feet stay planted
      const recoil = Math.sin(elapsed * 18) * 1.8;
      deform.pelvis.dx = 1.5;
      deform.waist.dx = 3.8 - recoil;
      deform.waist.rotRad = 0.035;
      deform.head.dx = 6.2 - recoil * 1.4;
      deform.head.rotRad = 0.05;
    } else if (mode === 'flinch') {
      // Smooth backward S-bend on damage impact without slicing the sprite
      const shudder = Math.sin(elapsed * 42) * 3.2;
      deform.pelvis.dx = -3.5 + shudder * 0.4;
      deform.waist.dx = -9.5 + shudder;
      deform.waist.dy = 2.0;
      deform.waist.rotRad = -0.08;
      deform.head.dx = -14.0 + shudder * 1.25;
      deform.head.dy = 4.2;
      deform.head.rotRad = -0.14;
      uniforms.shearPx = [-6.5, 0];
    } else if (mode === 'overdrive' || mode === 'upgrade') {
      // Heroic chest expansion + upward energy ripple
      deform.waist.scaleX = 1.04;
      deform.waist.dy = -2.2;
      deform.head.dy = -3.5;
      uniforms.uvDistortAmp = [0.0035, 0.0025];
      uniforms.uvDistortFreq = 16;
      uniforms.uvDistortPhase = elapsed * 8;
    }

    // Dramatic cut-in static pose emphasis layered on heroine spine (suppressed during Kira's dodge!)
    if (!isDodging) {
      if (cutIn && cutIn.poseOverride === 'attack_pose') {
        deform.pelvis.dx += 4.5;
        deform.waist.dx += 9.0;
        deform.waist.rotRad += 0.06;
        deform.head.dx += 13.0;
        deform.head.rotRad += 0.08;
      } else if (cutIn && cutIn.poseOverride === 'brace_pose') {
        deform.pelvis.dy += 4.0;
        deform.waist.dy += 7.0;
        deform.waist.scaleX *= 1.05;
        deform.waist.rotRad -= 0.05;
      } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
        deform.pelvis.dx -= 5.0;
        deform.waist.dx -= 13.0;
        deform.waist.dy += 3.0;
        deform.waist.rotRad -= 0.12;
        deform.head.dx -= 18.0;
        deform.head.dy += 4.5;
        deform.head.rotRad -= 0.16;
      }
    }
  }

  // Corrode acid status adds subtle bio-acid UV wave ripple
  if (corrode > 0 && !isProne) {
    uniforms.uvDistortAmp = [
      Math.max(uniforms.uvDistortAmp[0], 0.003),
      Math.max(uniforms.uvDistortAmp[1], 0.004),
    ];
    uniforms.uvDistortFreq = 14;
    uniforms.uvDistortPhase = elapsed * 6.5;
  }

  // Hit-flash tint: suppressed during clean dodge so Kira never flashes crimson on a MISS
  if (!isDodging) {
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (flashTimer > 0) {
      const flashIntensity = Math.min(0.75, Math.max(0.25, flashTimer * 3.2));
      uniforms.flashRgba = [1.0, 0.55, 0.72, flashIntensity];
    }
  }

  return { deform, uniforms };
}

/**
 * Maps Enemy animation state, stagger kinematics, and archetype-specific priming
 * into 4-control-point anatomical spline deformations and GPU shader uniforms.
 */
export function deriveEnemyDeformAndUniforms(params: {
  archetype: EnemyArchetype;
  idx: number;
  ea: ActorAnim | undefined;
  isDead: boolean;
  staggerShearPx: number;
  staggerBioFlashAlpha: number;
  breathScaleX: number;
  breathScaleY: number;
  frameBlendAlpha: number;
  bioEmissiveRgb: [number, number, number];
  isPrimedOrCharging: boolean;
  isAcidOrPustuleActive: boolean;
  isStaggeredStatus: boolean;
  elapsed: number;
  tacticalViewActive: boolean;
  spitterJuice?: SpitterJuiceSample;
  bruteJuice?: BruteJuiceSample;
  cutIn?: ActorJuiceSnapshot;
  /** Sprite facing sign (+1 for native left-facing Crawlers/Boss, -1 for mirrored right-facing Stalker/Spitter/Brute) */
  facingSign?: number;
}): { deform: ControlPointDeform; uniforms: CharacterShaderUniforms } {
  const deform = createIdentityControlPoints();
  const uniforms = createDefaultShaderUniforms();

  const {
    archetype,
    idx,
    ea,
    isDead,
    staggerShearPx,
    staggerBioFlashAlpha,
    breathScaleX,
    breathScaleY,
    frameBlendAlpha,
    bioEmissiveRgb,
    isPrimedOrCharging,
    isAcidOrPustuleActive,
    isStaggeredStatus,
    elapsed,
    tacticalViewActive,
    spitterJuice,
    bruteJuice,
    cutIn,
    facingSign,
  } = params;

  // Local +X maps to world -X (toward heroine) when facingSign < 0, and to world +X when facingSign > 0.
  // Multiply all forward-toward-heroine local dx & rotRad bends by fwdSign so EVERY archetype leans the right way!
  const effectiveFacing =
    facingSign ??
    (spitterJuice
      ? spitterJuice.facingScale
      : bruteJuice
        ? bruteJuice.facingScale
        : archetype === 'stalker' || archetype === 'spitter' || archetype === 'brute'
          ? -1
          : 1);
  const fwdSign = effectiveFacing < 0 ? 1 : -1;

  const cutInScaleX = cutIn ? cutIn.scaleX : 1;
  const cutInScaleY = cutIn ? cutIn.scaleY : 1;
  uniforms.squashStretch = [breathScaleX * cutInScaleX, breathScaleY * cutInScaleY];
  uniforms.frameBlendAlpha = frameBlendAlpha;
  if (cutIn && !tacticalViewActive) {
    uniforms.tintRgba = cutIn.tintRgba;
  }

  if (tacticalViewActive || isDead) {
    return { deform, uniforms };
  }

  // If this unit is driven by the 4-Layer Bile Spitter Juice Controller, compose all 4 layers directly
  if (spitterJuice) {
    uniforms.squashStretch = [
      breathScaleX * spitterJuice.springScaleX * cutInScaleX,
      breathScaleY * spitterJuice.springScaleY * cutInScaleY,
    ];
    uniforms.shearPx = [spitterJuice.shearXPx + staggerShearPx * 0.45, 0];
    uniforms.swayAmpPx = spitterJuice.swayAmpPx;
    uniforms.swayFreq = spitterJuice.swayFreq;
    uniforms.swayPhase = spitterJuice.swayPhase;
    uniforms.uvDistortAmp = spitterJuice.uvDistortAmp;
    uniforms.uvDistortFreq = spitterJuice.uvDistortFreq;
    uniforms.uvDistortPhase = spitterJuice.uvDistortPhase;
    const ct = cutIn ? cutIn.tintRgba : [1, 1, 1, 1];
    uniforms.tintRgba = [
      spitterJuice.tintRgba[0] * ct[0],
      spitterJuice.tintRgba[1] * ct[1],
      spitterJuice.tintRgba[2] * ct[2],
      spitterJuice.tintRgba[3] * ct[3],
    ];

    // Layer 3: 4-control-point anatomical spline (feet strictly locked at 0,0)
    deform.feet.dx = 0;
    deform.feet.dy = 0;
    deform.feet.rotRad = 0;
    deform.feet.scaleX = 1;

    deform.pelvis.dx = spitterJuice.deform.pelvis.dx - staggerShearPx * 0.2;
    deform.pelvis.dy = spitterJuice.deform.pelvis.dy;
    deform.pelvis.rotRad = spitterJuice.deform.pelvis.rotRad;
    deform.pelvis.scaleX = spitterJuice.deform.pelvis.scaleX;

    deform.waist.dx = spitterJuice.deform.waist.dx - staggerShearPx * 0.55;
    deform.waist.dy = spitterJuice.deform.waist.dy;
    deform.waist.rotRad = spitterJuice.deform.waist.rotRad;
    deform.waist.scaleX = spitterJuice.deform.waist.scaleX;

    deform.head.dx = spitterJuice.deform.head.dx - staggerShearPx * 0.9;
    deform.head.dy = spitterJuice.deform.head.dy;
    deform.head.rotRad = spitterJuice.deform.head.rotRad;
    deform.head.scaleX = spitterJuice.deform.head.scaleX;

    if (cutIn && cutIn.poseOverride === 'attack_pose') {
      deform.pelvis.dx += 4.5 * fwdSign;
      deform.waist.dx += 9.5 * fwdSign;
      deform.waist.rotRad += 0.05 * fwdSign;
      deform.head.dx += 15 * fwdSign;
      deform.head.rotRad += 0.09 * fwdSign;
    } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
      deform.pelvis.dx -= 4.5 * fwdSign;
      deform.waist.dx -= 11 * fwdSign;
      deform.waist.dy += 2.5;
      deform.waist.rotRad -= 0.1 * fwdSign;
      deform.head.dx -= 17 * fwdSign;
      deform.head.dy += 4.0;
      deform.head.rotRad -= 0.14 * fwdSign;
    }

    // Layer 4: Synced hit-flash uniform (cut-in white->crimson takes precedence when flashing)
    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.82, ea.flashTimer * 4.2) : 0;
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (whiteFlash > 0.05) {
      uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
    } else if (spitterJuice.flashRgba) {
      uniforms.flashRgba = spitterJuice.flashRgba;
    } else if (staggerBioFlashAlpha > 0.03) {
      uniforms.flashRgba = [
        bioEmissiveRgb[0],
        bioEmissiveRgb[1],
        bioEmissiveRgb[2],
        Math.min(0.75, staggerBioFlashAlpha * 1.25),
      ];
    }

    return { deform, uniforms };
  }

  // If this unit is driven by the 4-Layer Carapace Brute Juice Controller, compose all 4 layers directly
  if (bruteJuice) {
    uniforms.squashStretch = [
      breathScaleX * bruteJuice.springScaleX * cutInScaleX,
      breathScaleY * bruteJuice.springScaleY * cutInScaleY,
    ];
    uniforms.shearPx = [bruteJuice.shearXPx + staggerShearPx * 0.4, 0];
    uniforms.swayAmpPx = bruteJuice.swayAmpPx;
    uniforms.swayFreq = bruteJuice.swayFreq;
    uniforms.swayPhase = bruteJuice.swayPhase;
    uniforms.uvDistortAmp = bruteJuice.uvDistortAmp;
    uniforms.uvDistortFreq = bruteJuice.uvDistortFreq;
    uniforms.uvDistortPhase = bruteJuice.uvDistortPhase;
    const ct = cutIn ? cutIn.tintRgba : [1, 1, 1, 1];
    uniforms.tintRgba = [
      bruteJuice.tintRgba[0] * ct[0],
      bruteJuice.tintRgba[1] * ct[1],
      bruteJuice.tintRgba[2] * ct[2],
      bruteJuice.tintRgba[3] * ct[3],
    ];

    // Layer 3: 4-control-point anatomical spline (feet strictly locked at 0,0)
    deform.feet.dx = 0;
    deform.feet.dy = 0;
    deform.feet.rotRad = 0;
    deform.feet.scaleX = 1;

    deform.pelvis.dx = bruteJuice.deform.pelvis.dx - staggerShearPx * 0.18;
    deform.pelvis.dy = bruteJuice.deform.pelvis.dy;
    deform.pelvis.rotRad = bruteJuice.deform.pelvis.rotRad;
    deform.pelvis.scaleX = bruteJuice.deform.pelvis.scaleX;

    deform.waist.dx = bruteJuice.deform.waist.dx - staggerShearPx * 0.5;
    deform.waist.dy = bruteJuice.deform.waist.dy;
    deform.waist.rotRad = bruteJuice.deform.waist.rotRad;
    deform.waist.scaleX = bruteJuice.deform.waist.scaleX;

    deform.head.dx = bruteJuice.deform.head.dx - staggerShearPx * 0.85;
    deform.head.dy = bruteJuice.deform.head.dy;
    deform.head.rotRad = bruteJuice.deform.head.rotRad;
    deform.head.scaleX = bruteJuice.deform.head.scaleX;

    if (cutIn && cutIn.poseOverride === 'attack_pose') {
      deform.pelvis.dx += 5.5 * fwdSign;
      deform.waist.dx += 11 * fwdSign;
      deform.waist.rotRad += 0.06 * fwdSign;
      deform.head.dx += 16 * fwdSign;
      deform.head.rotRad += 0.1 * fwdSign;
    } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
      deform.pelvis.dx -= 4.5 * fwdSign;
      deform.waist.dx -= 11 * fwdSign;
      deform.waist.dy += 2.5;
      deform.waist.rotRad -= 0.09 * fwdSign;
      deform.head.dx -= 16 * fwdSign;
      deform.head.dy += 3.5;
      deform.head.rotRad -= 0.13 * fwdSign;
    }

    // Layer 4: Synced hit-flash uniform
    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.84, ea.flashTimer * 4.2) : 0;
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (whiteFlash > 0.05) {
      uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
    } else if (bruteJuice.flashRgba) {
      uniforms.flashRgba = bruteJuice.flashRgba;
    } else if (staggerBioFlashAlpha > 0.03) {
      uniforms.flashRgba = [
        bioEmissiveRgb[0],
        bioEmissiveRgb[1],
        bioEmissiveRgb[2],
        Math.min(0.75, staggerBioFlashAlpha * 1.25),
      ];
    }

    return { deform, uniforms };
  }

  const phase = elapsed * 2.4 + idx * 1.5;
  const breath = Math.sin(phase);

  // 1. Continuous organic ground-anchored sway & anatomical breathing
  deform.pelvis.dx = breath * 0.8;
  deform.waist.dx = breath * 1.8;
  deform.waist.dy = -breath * 1.4;
  deform.waist.scaleX = 1 + breath * 0.016;
  deform.head.dx = breath * 2.8;
  deform.head.dy = -breath * 2.2;
  deform.head.rotRad = breath * 0.018;

  uniforms.swayAmpPx = archetype === 'spitter' ? 2.4 : archetype === 'stalker' ? 2.0 : 1.5;
  uniforms.swayFreq = 2.4;
  uniforms.swayPhase = phase;

  // 1.5 Darkest Dungeon-style static cut-in pose emphasis (direction-aware via fwdSign so Crawlers & Boss bend toward/away cleanly!)
  const bossAmp = archetype === 'boss' ? 1.25 : 1.0;
  if (cutIn && cutIn.poseOverride === 'attack_pose') {
    deform.pelvis.dx += 7 * fwdSign * bossAmp;
    deform.waist.dx += 15 * fwdSign * bossAmp;
    deform.waist.rotRad += 0.08 * fwdSign * bossAmp;
    deform.head.dx += 22 * fwdSign * bossAmp;
    deform.head.rotRad += 0.13 * fwdSign * bossAmp;
  } else if (cutIn && cutIn.poseOverride === 'brace_pose') {
    deform.pelvis.dy += 5;
    deform.waist.dy += 9;
    deform.waist.rotRad -= 0.07 * fwdSign;
    deform.waist.scaleX *= 1.06;
  } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
    deform.pelvis.dx -= 6 * fwdSign;
    deform.waist.dx -= 15 * fwdSign;
    deform.waist.dy += 3.5;
    deform.waist.rotRad -= 0.12 * fwdSign;
    deform.head.dx -= 23 * fwdSign;
    deform.head.dy += 5.0;
    deform.head.rotRad -= 0.18 * fwdSign;
  }

  // 2. Smooth 4-control-point spine bend on kinetic hit-stagger (direction-aware via fwdSign!)
  if (ea && ea.staggerTimer > 0 && ea.staggerDuration > 0) {
    const u = Math.max(0, Math.min(1, 1 - ea.staggerTimer / ea.staggerDuration));
    const whip = Math.sin(u * Math.PI) * Math.pow(1 - u, 1.2) * ea.staggerIntensity;
    deform.pelvis.dx -= (whip * 4.5 + staggerShearPx * 0.25) * fwdSign;
    deform.waist.dx -= (whip * 12.0 + staggerShearPx * 0.75) * fwdSign;
    deform.waist.dy += whip * 3.2;
    deform.waist.rotRad -= whip * 0.11 * fwdSign;
    deform.head.dx -= (whip * 19.5 + staggerShearPx * 1.25) * fwdSign;
    deform.head.dy += whip * 5.8;
    deform.head.rotRad -= whip * 0.18 * fwdSign;

    uniforms.shearPx = [staggerShearPx * 0.65, 0];
  }

  // 3. Broken Stance (staggered status) continuous dizzy upper-torso wobble
  if (isStaggeredStatus) {
    const wobble = Math.sin(elapsed * 5.5 + idx);
    deform.waist.dx += wobble * 4.2;
    deform.head.dx += wobble * 7.8;
    deform.head.rotRad += wobble * 0.055;
  }

  // 4. Primed / Heavy / Acid UV wave distortion
  if (isAcidOrPustuleActive) {
    // Organic peristaltic swelling & UV wave distortion on Spitter pustules
    const swell = 0.5 + 0.5 * Math.sin(elapsed * 6.5 + idx);
    deform.waist.scaleX *= 1 + swell * 0.045;
    uniforms.uvDistortAmp = [0.0045, 0.0055];
    uniforms.uvDistortFreq = 15.0;
    uniforms.uvDistortPhase = elapsed * 7.0 + idx;
  } else if (isPrimedOrCharging) {
    const coil = Math.sin(elapsed * 8.0 + idx);
    deform.waist.dx += 2.5 * fwdSign;
    deform.head.dx += (4.5 + coil * 1.2) * fwdSign;
    uniforms.uvDistortAmp = [0.0028, 0.0022];
    uniforms.uvDistortFreq = 18.0;
    uniforms.uvDistortPhase = elapsed * 9.0;
  }

  // 5. Hit-flash & biological emissive stagger flash
  const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.78, ea.flashTimer * 4.2) : 0;
  if (cutIn?.flashRgba) {
    uniforms.flashRgba = cutIn.flashRgba;
  } else if (whiteFlash > staggerBioFlashAlpha) {
    uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
  } else if (staggerBioFlashAlpha > 0.03) {
    uniforms.flashRgba = [
      bioEmissiveRgb[0],
      bioEmissiveRgb[1],
      bioEmissiveRgb[2],
      Math.min(0.72, staggerBioFlashAlpha * 1.25),
    ];
  }

  return { deform, uniforms };
}
