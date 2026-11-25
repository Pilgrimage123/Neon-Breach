import type { EnemyArchetype, TileType } from '../../engine/types';
import type { Language } from '../../i18n/translations';
import type { BruteJuiceConfig, BruteJuiceSample } from '../../utils/bruteJuiceController';
import type {
  FeralNurseJuiceConfig,
  FeralNurseJuiceSample,
} from '../../utils/feralNurseJuiceController';
import type { MutdogJuiceConfig, MutdogJuiceSample } from '../../utils/mutdogJuiceController';
import type {
  SpitterJuiceConfig,
  SpitterJuiceSample,
} from '../../utils/spitterJuiceController';
import type { StalkerJuiceSample } from '../../utils/stalkerJuiceController';
import type { SequencerFrameState } from './CombatActionSequencer';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import type { ActorAnim } from './combatStageTypes';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type AnatomicalKnot,
  type CharacterShaderUniforms,
  type ControlPointDeform,
  FLOATS_PER_VERTEX,
  FULL_FRAME_UV,
  type MeshGridTopology,
  type SpriteFrameUV,
  type SpriteRenderCommand,
  type StageTextureSource,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  createMeshGridTopology,
  evaluateAnatomicalSplineRow,
  hexToRgbNorm,
} from './stageMeshMath';

export {
  FLOATS_PER_VERTEX,
  FULL_FRAME_UV,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  createMeshGridTopology,
  evaluateAnatomicalSplineRow,
  hexToRgbNorm,
};
export type {
  AnatomicalKnot,
  CharacterShaderUniforms,
  ControlPointDeform,
  MeshGridTopology,
  SpriteFrameUV,
  SpriteRenderCommand,
  StageTextureSource,
};

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
  mutdogJuiceConfig?: MutdogJuiceConfig;
  mutdogLabActive?: boolean;
  feralNurseJuiceConfig?: FeralNurseJuiceConfig;
  feralNurseLabActive?: boolean;
  presentationConfig?: CombatPresentationConfig;
  sequencerFrame?: SequencerFrameState;
  getActorJuice?: (actorId: string) => ActorJuiceSnapshot;
  reducedMotion?: boolean;
  lang?: Language;
}

/**
 * Handle to a reusable subdivided 2D MeshSprite instance.
 */
export interface IMeshSprite {
  readonly id: string;
  readonly cols: number;
  readonly rows: number;
  setFrame(
    primarySource: StageTextureSource,
    primaryUv?: SpriteFrameUV,
    secondarySource?: StageTextureSource | null,
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
 * Maps Hero animation state, status effects, and hit-flash timers into
 * 4-control-point anatomical spline deformations and GPU shader uniforms.
 */
export function deriveHeroDeformAndUniforms(params: {
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
    tiltRad,
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
    } else if (mode === 'shoot' || mode === 'dash_kick') {
      // Forward kinetic combat lean through waist and head while feet stay planted
      const recoil = Math.sin(elapsed * 18) * 1.8;
      deform.pelvis.dx = 1.5;
      deform.waist.dx = 3.8 - recoil;
      deform.waist.rotRad = 0.035;
      deform.head.dx = 6.2 - recoil * 1.4;
      deform.head.rotRad = 0.05;
    } else if (mode === 'hit') {
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

    if (!isDodging && tiltRad) {
      deform.waist.rotRad += tiltRad * 0.45;
      deform.head.rotRad += tiltRad * 0.65;
    }

    // Dramatic cut-in static pose emphasis layered on hero spine (suppressed during Kira's dodge!)
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
      const flashIntensity = Math.min(0.58, Math.max(0.24, flashTimer * 2.8));
      uniforms.flashRgba = [1.0, 0.55, 0.72, flashIntensity];
    }
  }

  return { deform, uniforms };
}

function copyJuiceDeformToControlPoints(
  deform: ControlPointDeform,
  sourceDeform: ControlPointDeform,
  staggerShearPx: number,
  shearFactors: readonly [number, number, number],
): void {
  // Layer 3: 4-control-point anatomical spline (feet strictly locked at 0,0)
  deform.feet.dx = 0;
  deform.feet.dy = 0;
  deform.feet.rotRad = 0;
  deform.feet.scaleX = 1;

  deform.pelvis.dx = sourceDeform.pelvis.dx - staggerShearPx * shearFactors[0];
  deform.pelvis.dy = sourceDeform.pelvis.dy;
  deform.pelvis.rotRad = sourceDeform.pelvis.rotRad;
  deform.pelvis.scaleX = sourceDeform.pelvis.scaleX;

  deform.waist.dx = sourceDeform.waist.dx - staggerShearPx * shearFactors[1];
  deform.waist.dy = sourceDeform.waist.dy;
  deform.waist.rotRad = sourceDeform.waist.rotRad;
  deform.waist.scaleX = sourceDeform.waist.scaleX;

  deform.head.dx = sourceDeform.head.dx - staggerShearPx * shearFactors[2];
  deform.head.dy = sourceDeform.head.dy;
  deform.head.rotRad = sourceDeform.head.rotRad;
  deform.head.scaleX = sourceDeform.head.scaleX;
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
  mutdogJuice?: MutdogJuiceSample;
  feralNurseJuice?: FeralNurseJuiceSample;
  stalkerJuice?: StalkerJuiceSample;
  cutIn?: ActorJuiceSnapshot;
  /** Sprite facing sign (+1 for native left-facing Crawlers/Stalker/Boss, -1 for mirrored right-facing Spitter/MutDog/FeralNurse/Brute) */
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
    mutdogJuice,
    feralNurseJuice,
    stalkerJuice,
    cutIn,
    facingSign,
  } = params;

  // Local +X maps to world -X (toward hero) when facingSign < 0, and to world +X when facingSign > 0.
  // Multiply all forward-toward-hero local dx & rotRad bends by fwdSign so EVERY archetype leans the right way!
  const effectiveFacing =
    facingSign ??
    (spitterJuice
      ? spitterJuice.facingScale
      : bruteJuice
        ? bruteJuice.facingScale
        : mutdogJuice
          ? mutdogJuice.facingScale
          : feralNurseJuice
            ? feralNurseJuice.facingScale
            : stalkerJuice
              ? stalkerJuice.facingScale
              : archetype === 'spitter' ||
                  archetype === 'mutdog' ||
                  archetype === 'feral_nurse' ||
                  archetype === 'brute'
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

  // If this unit is driven by the 4-Layer Feral Nurse Juice Controller, compose all 4 layers directly
  if (feralNurseJuice) {
    uniforms.squashStretch = [
      breathScaleX * feralNurseJuice.springScaleX * cutInScaleX,
      breathScaleY * feralNurseJuice.springScaleY * cutInScaleY,
    ];
    uniforms.shearPx = [feralNurseJuice.shearXPx + staggerShearPx * 0.42, 0];
    uniforms.swayAmpPx = 0;
    uniforms.swayFreq = 0;
    uniforms.swayPhase = 0;
    uniforms.uvDistortAmp = feralNurseJuice.uvDistortAmp;
    uniforms.uvDistortFreq = feralNurseJuice.uvDistortFreq;
    uniforms.uvDistortPhase = elapsed * 6.5;
    const ct = cutIn ? cutIn.tintRgba : [1, 1, 1, 1];
    uniforms.tintRgba = [
      feralNurseJuice.tintRgba[0] * ct[0],
      feralNurseJuice.tintRgba[1] * ct[1],
      feralNurseJuice.tintRgba[2] * ct[2],
      feralNurseJuice.tintRgba[3] * ct[3],
    ];

    copyJuiceDeformToControlPoints(
      deform,
      {
        feet: feralNurseJuice.deform.feet,
        pelvis: feralNurseJuice.deform.hips,
        waist: feralNurseJuice.deform.chest,
        head: feralNurseJuice.deform.head,
      },
      staggerShearPx,
      [0.2, 0.54, 0.9],
    );

    if (cutIn && cutIn.poseOverride === 'attack_pose') {
      deform.pelvis.dx += 5.0 * fwdSign;
      deform.waist.dx += 11.0 * fwdSign;
      deform.waist.rotRad += 0.065 * fwdSign;
      deform.head.dx += 16.5 * fwdSign;
      deform.head.rotRad += 0.1 * fwdSign;
    } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
      deform.pelvis.dx -= 4.8 * fwdSign;
      deform.waist.dx -= 11.5 * fwdSign;
      deform.waist.dy += 2.5;
      deform.waist.rotRad -= 0.1 * fwdSign;
      deform.head.dx -= 17.0 * fwdSign;
      deform.head.dy += 3.8;
      deform.head.rotRad -= 0.14 * fwdSign;
    }

    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.7, ea.flashTimer * 3.6) : 0;
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (whiteFlash > 0.05) {
      uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
    } else if (feralNurseJuice.flashRgba) {
      uniforms.flashRgba = feralNurseJuice.flashRgba;
    } else if (staggerBioFlashAlpha > 0.03) {
      uniforms.flashRgba = [
        bioEmissiveRgb[0],
        bioEmissiveRgb[1],
        bioEmissiveRgb[2],
        Math.min(0.6, staggerBioFlashAlpha * 1.15),
      ];
    }

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

    copyJuiceDeformToControlPoints(deform, spitterJuice.deform, staggerShearPx, [0.2, 0.55, 0.9]);

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
    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.68, ea.flashTimer * 3.6) : 0;
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
        Math.min(0.6, staggerBioFlashAlpha * 1.15),
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

    copyJuiceDeformToControlPoints(deform, bruteJuice.deform, staggerShearPx, [0.18, 0.5, 0.85]);

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
    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.7, ea.flashTimer * 3.6) : 0;
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
        Math.min(0.6, staggerBioFlashAlpha * 1.15),
      ];
    }

    return { deform, uniforms };
  }

  // If this unit is driven by the 4-Layer Rabid MutDog Juice Controller, compose all 4 layers directly
  if (mutdogJuice) {
    uniforms.squashStretch = [
      breathScaleX * mutdogJuice.springScaleX * cutInScaleX,
      breathScaleY * mutdogJuice.springScaleY * cutInScaleY,
    ];
    uniforms.shearPx = [mutdogJuice.shearXPx + staggerShearPx * 0.42, 0];
    uniforms.swayAmpPx = mutdogJuice.swayAmpPx;
    uniforms.swayFreq = mutdogJuice.swayFreq;
    uniforms.swayPhase = mutdogJuice.swayPhase;
    uniforms.uvDistortAmp = mutdogJuice.uvDistortAmp;
    uniforms.uvDistortFreq = mutdogJuice.uvDistortFreq;
    uniforms.uvDistortPhase = mutdogJuice.uvDistortPhase;
    const ct = cutIn ? cutIn.tintRgba : [1, 1, 1, 1];
    uniforms.tintRgba = [
      mutdogJuice.tintRgba[0] * ct[0],
      mutdogJuice.tintRgba[1] * ct[1],
      mutdogJuice.tintRgba[2] * ct[2],
      mutdogJuice.tintRgba[3] * ct[3],
    ];

    copyJuiceDeformToControlPoints(deform, mutdogJuice.deform, staggerShearPx, [0.22, 0.56, 0.92]);

    if (cutIn && cutIn.poseOverride === 'attack_pose') {
      deform.pelvis.dx += 5.5 * fwdSign;
      deform.waist.dx += 11.5 * fwdSign;
      deform.waist.rotRad += 0.065 * fwdSign;
      deform.head.dx += 17.5 * fwdSign;
      deform.head.rotRad += 0.105 * fwdSign;
    } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
      deform.pelvis.dx -= 5.0 * fwdSign;
      deform.waist.dx -= 12 * fwdSign;
      deform.waist.dy += 2.6;
      deform.waist.rotRad -= 0.1 * fwdSign;
      deform.head.dx -= 17.5 * fwdSign;
      deform.head.dy += 4.0;
      deform.head.rotRad -= 0.15 * fwdSign;
    }

    // Layer 4: Synced hit-flash uniform
    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.7, ea.flashTimer * 3.6) : 0;
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (whiteFlash > 0.05) {
      uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
    } else if (mutdogJuice.flashRgba) {
      uniforms.flashRgba = mutdogJuice.flashRgba;
    } else if (staggerBioFlashAlpha > 0.03) {
      uniforms.flashRgba = [
        bioEmissiveRgb[0],
        bioEmissiveRgb[1],
        bioEmissiveRgb[2],
        Math.min(0.6, staggerBioFlashAlpha * 1.15),
      ];
    }

    return { deform, uniforms };
  }

  // If this unit is driven by the 4-Layer Chitin Stalker Juice Controller, compose all 4 layers directly
  if (stalkerJuice) {
    uniforms.squashStretch = [
      breathScaleX * stalkerJuice.springScaleX * cutInScaleX,
      breathScaleY * stalkerJuice.springScaleY * cutInScaleY,
    ];
    uniforms.shearPx = [stalkerJuice.shearXPx + staggerShearPx * 0.42, 0];
    uniforms.swayAmpPx = stalkerJuice.swayAmpPx;
    uniforms.swayFreq = stalkerJuice.swayFreq;
    uniforms.swayPhase = stalkerJuice.swayPhase;
    uniforms.uvDistortAmp = stalkerJuice.uvDistortAmp;
    uniforms.uvDistortFreq = stalkerJuice.uvDistortFreq;
    uniforms.uvDistortPhase = stalkerJuice.uvDistortPhase;
    const ct = cutIn ? cutIn.tintRgba : [1, 1, 1, 1];
    uniforms.tintRgba = [
      stalkerJuice.tintRgba[0] * ct[0],
      stalkerJuice.tintRgba[1] * ct[1],
      stalkerJuice.tintRgba[2] * ct[2],
      stalkerJuice.tintRgba[3] * ct[3],
    ];

    copyJuiceDeformToControlPoints(deform, stalkerJuice.deform, -staggerShearPx, [0.2, 0.52, 0.88]);

    if (cutIn && cutIn.poseOverride === 'attack_pose') {
      deform.pelvis.dx += 5.5 * fwdSign;
      deform.waist.dx += 11.5 * fwdSign;
      deform.waist.rotRad += 0.065 * fwdSign;
      deform.head.dx += 17.5 * fwdSign;
      deform.head.rotRad += 0.105 * fwdSign;
    } else if (cutIn && cutIn.poseOverride === 'recoil_pose') {
      deform.pelvis.dx -= 5.0 * fwdSign;
      deform.waist.dx -= 12 * fwdSign;
      deform.waist.dy += 2.6;
      deform.waist.rotRad -= 0.1 * fwdSign;
      deform.head.dx -= 17.5 * fwdSign;
      deform.head.dy += 4.0;
      deform.head.rotRad -= 0.15 * fwdSign;
    }

    const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.7, ea.flashTimer * 3.6) : 0;
    if (cutIn?.flashRgba) {
      uniforms.flashRgba = cutIn.flashRgba;
    } else if (whiteFlash > 0.05) {
      uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
    } else if (stalkerJuice.flashRgba) {
      uniforms.flashRgba = stalkerJuice.flashRgba;
    } else if (staggerBioFlashAlpha > 0.03) {
      uniforms.flashRgba = [
        bioEmissiveRgb[0],
        bioEmissiveRgb[1],
        bioEmissiveRgb[2],
        Math.min(0.6, staggerBioFlashAlpha * 1.15),
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
  const whiteFlash = ea && ea.flashTimer > 0 ? Math.min(0.68, ea.flashTimer * 3.6) : 0;
  if (cutIn?.flashRgba) {
    uniforms.flashRgba = cutIn.flashRgba;
  } else if (whiteFlash > staggerBioFlashAlpha) {
    uniforms.flashRgba = [1.0, 1.0, 1.0, whiteFlash];
  } else if (staggerBioFlashAlpha > 0.03) {
    uniforms.flashRgba = [
      bioEmissiveRgb[0],
      bioEmissiveRgb[1],
      bioEmissiveRgb[2],
      Math.min(0.6, staggerBioFlashAlpha * 1.15),
    ];
  }

  return { deform, uniforms };
}
