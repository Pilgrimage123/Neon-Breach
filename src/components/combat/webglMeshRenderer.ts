import {
  DEFAULT_RENDERER_CONFIG,
  FLOATS_PER_VERTEX,
  type ICharacterStageRenderer,
  type IMeshSprite,
  type MeshGridTopology,
  type SpriteRenderCommand,
  type StageTextureSource,
  createMeshGridTopology,
} from './stageSpriteAdapter';
import { renderMeshDebugWireframeOverlay } from './webglDebugWireframe';
import { MeshSprite } from './webglMeshSprite';
import {
  UNIFIED_CHARACTER_FRAGMENT_SHADER,
  UNIFIED_CHARACTER_VERTEX_SHADER,
  type UniformLocations,
  createCharacterShaderProgram,
} from './webglShaders';

export {
  MeshSprite,
  UNIFIED_CHARACTER_FRAGMENT_SHADER,
  UNIFIED_CHARACTER_VERTEX_SHADER,
};

export interface WebGL2RendererOptions {
  onContextStatusChange?: (ready: boolean) => void;
  maxCachedTextures?: number;
}

const DEFAULT_MAX_CACHED_TEXTURES = 192;

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Raw WebGL2 Character Stage Renderer implementing `ICharacterStageRenderer`.
 * Manages a shared VAO, streaming VBO, static EBO, unified GLSL 300 es shader program,
 * bounded texture caching, and safe WebGL context loss / restore lifecycle.
 */
export class WebGL2CharacterStageRenderer implements ICharacterStageRenderer {
  public readonly backend = 'webgl2' as const;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private ebo: WebGLBuffer | null = null;
  private uniforms: UniformLocations | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private onContextStatusChange?: (ready: boolean) => void;
  private readonly maxCachedTextures: number;
  private readonly usedIdsThisFrame = new Map<string, number>();

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.releaseGpuResources(true);
    this.onContextStatusChange?.(false);
  };

  private readonly onContextRestored = (): void => {
    if (this.canvas) {
      this.initContext(this.canvas);
    }
    this.onContextStatusChange?.(this.isReady);
  };

  private readonly topology: MeshGridTopology;
  private readonly spritePool = new Map<string, MeshSprite>();
  private readonly queuedSprites: MeshSprite[] = [];
  private readonly textureCache = new Map<StageTextureSource, WebGLTexture>();

  private viewProjMatrix = new Float32Array(9);
  private frameParams: {
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
  } = {
    width: 1200,
    height: 420,
    dpr: 1,
    cameraZoom: 1,
    cameraPanX: 0,
    cameraPanY: 0,
    cameraRotRad: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    deckBackY: 280,
    deckFrontY: 360,
  };

  constructor(
    canvas: HTMLCanvasElement,
    cols: number = DEFAULT_RENDERER_CONFIG.meshCols,
    rows: number = DEFAULT_RENDERER_CONFIG.meshRows,
    options?: WebGL2RendererOptions,
  ) {
    this.topology = createMeshGridTopology(cols, rows);
    this.canvas = canvas;
    this.onContextStatusChange = options?.onContextStatusChange;
    this.maxCachedTextures = Math.max(
      16,
      options?.maxCachedTextures ?? DEFAULT_MAX_CACHED_TEXTURES,
    );
    canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.initContext(canvas);
  }

  public get isReady(): boolean {
    return Boolean(
      this.gl &&
        this.program &&
        this.uniforms &&
        this.vao &&
        this.vbo &&
        this.ebo &&
        !this.gl.isContextLost(),
    );
  }

  public get cachedTextureCount(): number {
    return this.textureCache.size;
  }

  private initContext(canvas: HTMLCanvasElement): void {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl || gl.isContextLost()) {
      this.gl = null;
      return;
    }
    this.gl = gl;

    const compiled = createCharacterShaderProgram(gl);
    if (!compiled) {
      return;
    }

    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ebo = gl.createBuffer();
    if (!vao || !vbo || !ebo) {
      if (vao) gl.deleteVertexArray(vao);
      if (vbo) gl.deleteBuffer(vbo);
      if (ebo) gl.deleteBuffer(ebo);
      gl.deleteProgram(compiled.program);
      return;
    }

    this.program = compiled.program;
    this.uniforms = compiled.uniforms;
    this.vao = vao;
    this.vbo = vbo;
    this.ebo = ebo;

    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.topology.vertexCount * FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      gl.DYNAMIC_DRAW,
    );

    const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 4 * 4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 7 * 4);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.topology.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  private getOrCreateTexture(source: StageTextureSource): WebGLTexture | null {
    const gl = this.gl;
    if (!gl || gl.isContextLost() || !source || source.width === 0 || source.height === 0) {
      return null;
    }

    const cached = this.textureCache.get(source);
    if (cached) {
      // Refresh insertion order for bounded LRU eviction
      this.textureCache.delete(source);
      this.textureCache.set(source, cached);
      return cached;
    }

    if (this.textureCache.size >= this.maxCachedTextures) {
      const oldestEntry = this.textureCache.entries().next();
      if (!oldestEntry.done) {
        const [oldestSource, oldestTex] = oldestEntry.value;
        this.textureCache.delete(oldestSource);
        gl.deleteTexture(oldestTex);
      }
    }

    const tex = gl.createTexture();
    if (!tex) return null;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    this.textureCache.set(source, tex);
    return tex;
  }

  public beginFrame(params: {
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
  }): void {
    const safeWidth = Math.max(1, finiteOr(params.width, 1200));
    const safeHeight = Math.max(1, finiteOr(params.height, 420));
    const safeDpr = Math.min(4, Math.max(1, finiteOr(params.dpr, 1)));
    const safeZoom = Math.max(0.05, finiteOr(params.cameraZoom, 1));
    const safePanX = finiteOr(params.cameraPanX, 0);
    const safePanY = finiteOr(params.cameraPanY, 0);
    const safeRot = finiteOr(params.cameraRotRad, 0);
    const safeShakeX = finiteOr(params.shakeOffsetX, 0);
    const safeShakeY = finiteOr(params.shakeOffsetY, 0);
    const safeDeckBackY = finiteOr(params.deckBackY, safeHeight * 0.66);
    const safeDeckFrontY = finiteOr(params.deckFrontY, safeHeight * 0.86);

    this.frameParams = {
      width: safeWidth,
      height: safeHeight,
      dpr: safeDpr,
      cameraZoom: safeZoom,
      cameraPanX: safePanX,
      cameraPanY: safePanY,
      cameraRotRad: safeRot,
      shakeOffsetX: safeShakeX,
      shakeOffsetY: safeShakeY,
      deckBackY: safeDeckBackY,
      deckFrontY: safeDeckFrontY,
      viewProjMatrix: params.viewProjMatrix,
    };
    this.queuedSprites.length = 0;
    this.usedIdsThisFrame.clear();

    const gl = this.gl;
    if (!gl || !this.isReady) return;

    const pixelW = Math.max(1, Math.floor(safeWidth * safeDpr));
    const pixelH = Math.max(1, Math.floor(safeHeight * safeDpr));
    if (gl.canvas.width !== pixelW || gl.canvas.height !== pixelH) {
      gl.canvas.width = pixelW;
      gl.canvas.height = pixelH;
    }

    gl.viewport(0, 0, pixelW, pixelH);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (params.viewProjMatrix && params.viewProjMatrix.length >= 9) {
      this.viewProjMatrix.set(params.viewProjMatrix.subarray(0, 9));
      return;
    }

    const cx = safeWidth * 0.5;
    const cy = safeHeight * 0.5;
    const cosR = Math.cos(safeRot);
    const sinR = Math.sin(safeRot);
    const a = safeZoom * cosR;
    const b = -safeZoom * sinR;
    const c = safeZoom * sinR;
    const d = safeZoom * cosR;
    const tx = cx + safePanX + safeShakeX - (a * cx + b * cy);
    const ty = cy + safePanY + safeShakeY - (c * cx + d * cy);
    const invW2 = 2 / safeWidth;
    const invH2 = 2 / safeHeight;

    const m = this.viewProjMatrix;
    m[0] = invW2 * a;
    m[1] = -invH2 * c;
    m[2] = 0;
    m[3] = invW2 * b;
    m[4] = -invH2 * d;
    m[5] = 0;
    m[6] = invW2 * tx - 1;
    m[7] = 1 - invH2 * ty;
    m[8] = 1;
  }

  public getOrCreateSprite(id: string): IMeshSprite {
    let sprite = this.spritePool.get(id);
    if (!sprite) {
      sprite = new MeshSprite(id, this.topology);
      this.spritePool.set(id, sprite);
    }
    return sprite;
  }

  public drawSprite(cmd: SpriteRenderCommand): void {
    const seen = this.usedIdsThisFrame.get(cmd.id) ?? 0;
    this.usedIdsThisFrame.set(cmd.id, seen + 1);
    const poolKey = seen === 0 ? cmd.id : `${cmd.id}#${seen}`;
    const sprite = this.getOrCreateSprite(poolKey) as MeshSprite;
    sprite.applyCommand(cmd);
    this.queuedSprites.push(sprite);
  }

  public endFrame(debugWireframeCtx?: CanvasRenderingContext2D | null): void {
    const gl = this.gl;
    const prog = this.program;
    const u = this.uniforms;
    if (!gl || !prog || !u || !this.vao || !this.vbo || gl.isContextLost()) return;

    gl.useProgram(prog);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix3fv(u.u_viewProjMatrix, false, this.viewProjMatrix);
    gl.uniform1i(u.u_tex0, 0);
    gl.uniform1i(u.u_tex1, 1);

    const { width, height, dpr, deckBackY, deckFrontY } = this.frameParams;
    let scissorActive = false;

    this.queuedSprites.sort((a, b) => {
      const pa = a.command.isReflection ? 0 : (a.command.drawPriority ?? 2);
      const pb = b.command.isReflection ? 0 : (b.command.drawPriority ?? 2);
      return pa - pb;
    });

    const m = this.viewProjMatrix;
    const projectScreenY = (wx: number, wy: number): number => {
      const ndcY = m[1] * wx + m[4] * wy + m[7];
      return (1 - ndcY) * 0.5 * height;
    };

    for (let i = 0; i < this.queuedSprites.length; i++) {
      const sprite = this.queuedSprites[i];
      const cmd = sprite.command;
      if (cmd.alpha <= 0.005) continue;

      const tex0 = this.getOrCreateTexture(cmd.primarySource);
      if (!tex0) continue;
      const tex1 =
        cmd.secondarySource && cmd.uniforms.frameBlendAlpha < 0.995
          ? this.getOrCreateTexture(cmd.secondarySource) ?? tex0
          : tex0;

      if (cmd.isReflection) {
        if (!scissorActive) {
          gl.enable(gl.SCISSOR_TEST);
          scissorActive = true;
        }
        const y0 = projectScreenY(0, deckBackY);
        const y1 = projectScreenY(width, deckBackY);
        const y2 = projectScreenY(0, deckFrontY + 4);
        const y3 = projectScreenY(width, deckFrontY + 4);
        const minScreenY = Math.max(0, Math.min(height, y0, y1, y2, y3));
        const maxScreenY = Math.max(0, Math.min(height, Math.max(y0, y1, y2, y3)));
        const scissorY = Math.floor((height - maxScreenY) * dpr);
        if (maxScreenY - minScreenY <= 0) continue;
        const scissorH = Math.max(1, Math.ceil((maxScreenY - minScreenY) * dpr));
        gl.scissor(0, scissorY, Math.floor(width * dpr), scissorH);
      } else if (scissorActive) {
        gl.disable(gl.SCISSOR_TEST);
        scissorActive = false;
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex1);

      const uni = cmd.uniforms;
      gl.uniform2f(u.u_anchorWorld, cmd.worldX, cmd.worldY);
      gl.uniform2f(
        u.u_squashStretch,
        uni.squashStretch[0],
        cmd.isReflection ? 1.0 : uni.squashStretch[1],
      );
      gl.uniform2f(u.u_shear, uni.shearPx[0], uni.shearPx[1]);
      gl.uniform3f(u.u_sway, uni.swayAmpPx, uni.swayFreq, uni.swayPhase);
      gl.uniform1f(u.u_frameBlend, cmd.secondarySource ? uni.frameBlendAlpha : 1.0);
      gl.uniform4f(
        u.u_uvDistort,
        uni.uvDistortAmp[0],
        uni.uvDistortAmp[1],
        uni.uvDistortFreq,
        uni.uvDistortPhase,
      );
      gl.uniform4f(
        u.u_tintColor,
        uni.tintRgba[0],
        uni.tintRgba[1],
        uni.tintRgba[2],
        uni.tintRgba[3],
      );
      gl.uniform4f(
        u.u_flashColor,
        uni.flashRgba[0],
        uni.flashRgba[1],
        uni.flashRgba[2],
        uni.flashRgba[3],
      );

      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprite.vertices);
      gl.drawElements(gl.TRIANGLES, this.topology.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (scissorActive) {
      gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindVertexArray(null);

    if (debugWireframeCtx) {
      renderMeshDebugWireframeOverlay(debugWireframeCtx, this.topology, this.queuedSprites);
    }
  }

  public clearCanvas(): void {
    this.queuedSprites.length = 0;
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private releaseGpuResources(contextLost: boolean): void {
    const gl = this.gl;
    if (gl && !contextLost && !gl.isContextLost()) {
      for (const tex of this.textureCache.values()) {
        gl.deleteTexture(tex);
      }
      if (this.vbo) gl.deleteBuffer(this.vbo);
      if (this.ebo) gl.deleteBuffer(this.ebo);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.textureCache.clear();
    this.queuedSprites.length = 0;
    this.vbo = null;
    this.ebo = null;
    this.vao = null;
    this.program = null;
    this.uniforms = null;
    if (!contextLost) {
      this.gl = null;
    }
  }

  public dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    }
    this.onContextStatusChange = undefined;
    this.releaseGpuResources(false);
    this.spritePool.clear();
    this.usedIdsThisFrame.clear();
    this.canvas = null;
  }
}
