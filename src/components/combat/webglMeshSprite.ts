import {
  type CharacterShaderUniforms,
  type ControlPointDeform,
  FLOATS_PER_VERTEX,
  FULL_FRAME_UV,
  type IMeshSprite,
  type MeshGridTopology,
  type SpriteFrameUV,
  type SpriteRenderCommand,
  type StageTextureSource,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
} from './stageSpriteAdapter';

/**
 * Reusable subdivided 2D MeshSprite that stores its own pre-allocated vertex array
 * and updates vertex positions in-place without per-frame heap allocations.
 */
export class MeshSprite implements IMeshSprite {
  public readonly id: string;
  public readonly topology: MeshGridTopology;
  public readonly vertices: Float32Array;
  public command: SpriteRenderCommand;

  constructor(id: string, topology: MeshGridTopology, placeholderCanvas?: HTMLCanvasElement) {
    this.id = id;
    this.topology = topology;
    this.vertices = new Float32Array(topology.vertexCount * FLOATS_PER_VERTEX);
    const dummySource =
      placeholderCanvas ??
      (typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement));
    this.command = {
      id,
      primarySource: dummySource,
      secondarySource: null,
      primaryUv: FULL_FRAME_UV,
      secondaryUv: FULL_FRAME_UV,
      worldX: 0,
      worldY: 0,
      widthPx: 100,
      heightPx: 100,
      anchorOffsetXPx: 50,
      anchorOffsetYPx: 100,
      facingSign: 1,
      verticalScaleSign: 1,
      rotationRad: 0,
      alpha: 1,
      isReflection: false,
      deform: createIdentityControlPoints(),
      uniforms: createDefaultShaderUniforms(),
    };
  }

  public get cols(): number {
    return this.topology.cols;
  }

  public get rows(): number {
    return this.topology.rows;
  }

  public setFrame(
    primarySource: StageTextureSource,
    primaryUv: SpriteFrameUV = FULL_FRAME_UV,
    secondarySource: StageTextureSource | null = null,
    secondaryUv: SpriteFrameUV = FULL_FRAME_UV,
  ): void {
    this.command.primarySource = primarySource;
    this.command.primaryUv = primaryUv;
    this.command.secondarySource = secondarySource;
    this.command.secondaryUv = secondaryUv;
  }

  public setTransform(
    worldX: number,
    worldY: number,
    widthPx: number,
    heightPx: number,
    anchorOffsetXPx: number,
    anchorOffsetYPx: number,
    facingSign: number,
    rotationRad: number,
    verticalScaleSign = 1,
  ): void {
    this.command.worldX = worldX;
    this.command.worldY = worldY;
    this.command.widthPx = widthPx;
    this.command.heightPx = heightPx;
    this.command.anchorOffsetXPx = anchorOffsetXPx;
    this.command.anchorOffsetYPx = anchorOffsetYPx;
    this.command.facingSign = facingSign;
    this.command.rotationRad = rotationRad;
    this.command.verticalScaleSign = verticalScaleSign;
  }

  public setDeform(deform: ControlPointDeform): void {
    this.command.deform = deform;
  }

  public setShaderUniforms(uniforms: CharacterShaderUniforms): void {
    this.command.uniforms = uniforms;
  }

  public applyCommand(cmd: SpriteRenderCommand): void {
    this.command = cmd;
    computeDeformedMeshVertices(this.topology, cmd, this.vertices);
  }
}
