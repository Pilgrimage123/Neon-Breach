import {
  type CharacterShaderUniforms,
  type ControlPointDeform,
  DEFAULT_RENDERER_CONFIG,
  FLOATS_PER_VERTEX,
  FULL_FRAME_UV,
  type ICharacterStageRenderer,
  type IMeshSprite,
  type MeshGridTopology,
  type SpriteFrameUV,
  type SpriteRenderCommand,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  createMeshGridTopology,
  evaluateAnatomicalSplineRow,
} from './stageSpriteAdapter';

/**
 * Unified GLSL 300 es Vertex Shader for 2D Deformable MeshSprites.
 *
 * Features:
 * - Ground-anchored squash-and-stretch around `u_anchorWorld` (0 foot drift).
 * - Ground-anchored skew/shear proportional to `a_heightWeight` (0 at bottom UVs, full at top).
 * - Ground-anchored harmonic vertex sway/breathing (`u_sway`).
 * - Orthographic world-to-clip camera projection with zoom, pan, and trauma shake.
 */
export const UNIFIED_CHARACTER_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_uv0;
layout(location = 2) in vec2 a_uv1;
layout(location = 3) in float a_heightWeight;
layout(location = 4) in float a_alpha;

uniform mat3 u_viewProjMatrix;
uniform vec2 u_anchorWorld;
uniform vec2 u_squashStretch;
uniform vec2 u_shear;
uniform vec3 u_sway; // x = ampPx, y = freq, z = phase

out vec2 v_uv0;
out vec2 v_uv1;
out float v_heightWeight;
out float v_alpha;

void main() {
  // 1. Pivot relative to ground-planted character foot anchor
  vec2 rel = a_position - u_anchorWorld;

  // 2. Ground-anchored squash-and-stretch
  rel *= u_squashStretch;

  // 3. Ground-anchored vertex sway / breathing (0 displacement at bottom UVs, full at top)
  float weight = smoothstep(0.0, 1.0, a_heightWeight);
  float swayOffset = sin(u_sway.z + a_heightWeight * 1.35) * u_sway.x * weight;

  // 4. Skew / shear proportional to height above ground
  rel.x += swayOffset + u_shear.x * a_heightWeight;
  rel.y += u_shear.y * a_heightWeight;

  vec2 finalWorld = u_anchorWorld + rel;
  vec3 clip = u_viewProjMatrix * vec3(finalWorld, 1.0);

  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv0 = a_uv0;
  v_uv1 = a_uv1;
  v_heightWeight = a_heightWeight;
  v_alpha = a_alpha;
}
`;

/**
 * Unified GLSL 300 es Fragment Shader for 2D Deformable MeshSprites.
 *
 * Features:
 * - Toggleable UV wave distortion (weighted by `v_heightWeight` so planted feet stay crisp).
 * - Dual-frame smoothstep cross-dissolve (`u_tex0` & `u_tex1` blended by `u_frameBlend`).
 * - Multiplicative tint & opacity (`u_tintColor`).
 * - Hit-flash & biological emissive flash tinting (`u_flashColor`).
 */
export const UNIFIED_CHARACTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv0;
in vec2 v_uv1;
in float v_heightWeight;
in float v_alpha;

uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform float u_frameBlend;
uniform vec4 u_uvDistort; // x = ampU, y = ampV, z = freq, w = phase
uniform vec4 u_tintColor;
uniform vec4 u_flashColor; // rgb = flash color, a = flash intensity [0..1]

out vec4 outColor;

void main() {
  // Ground-anchored UV wave distortion (0 at bottom UVs, full on upper body)
  float distortMask = smoothstep(0.05, 0.85, v_heightWeight);
  vec2 uvWave = vec2(
    sin(v_uv0.y * u_uvDistort.z + u_uvDistort.w) * u_uvDistort.x,
    cos(v_uv0.x * u_uvDistort.z + u_uvDistort.w * 0.85) * u_uvDistort.y
  ) * distortMask;

  vec4 c0 = texture(u_tex0, clamp(v_uv0 + uvWave, 0.0, 1.0));
  vec4 texColor = c0;

  if (u_frameBlend < 0.995) {
    vec2 uv1Sample = v_uv1 + uvWave;
    vec4 c1 = (uv1Sample.x >= 0.0 && uv1Sample.x <= 1.0 && uv1Sample.y >= 0.0 && uv1Sample.y <= 1.0)
      ? texture(u_tex1, uv1Sample)
      : vec4(0.0);
    // Replicate smooth cross-dissolve energy preservation
    float prevWeight = min(1.0, (1.0 - u_frameBlend) * 0.52);
    float currWeight = min(1.0, 0.84 + u_frameBlend * 0.16);
    float combinedAlpha = clamp(c0.a * currWeight + c1.a * prevWeight * (1.0 - c0.a * 0.65), 0.0, 1.0);
    vec3 blendedRgb = c1.a > 0.01 ? mix(c1.rgb, c0.rgb, clamp(u_frameBlend, 0.0, 1.0)) : c0.rgb;
    texColor = vec4(blendedRgb, combinedAlpha);
  }

  if (texColor.a <= 0.004) {
    discard;
  }

  vec3 rgb = texColor.rgb * u_tintColor.rgb;
  float alpha = texColor.a * u_tintColor.a * v_alpha;

  // Hit-flash / biological emissive highlight
  if (u_flashColor.a > 0.005) {
    float flashAmt = clamp(u_flashColor.a, 0.0, 1.0);
    rgb = mix(rgb, u_flashColor.rgb, flashAmt * 0.72) + u_flashColor.rgb * (flashAmt * 0.38);
  }

  // Output premultiplied alpha for clean compositing over transparent canvas
  outColor = vec4(rgb * alpha, alpha);
}
`;

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
    primarySource: HTMLCanvasElement,
    primaryUv: SpriteFrameUV = FULL_FRAME_UV,
    secondarySource: HTMLCanvasElement | null = null,
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

interface UniformLocations {
  u_viewProjMatrix: WebGLUniformLocation | null;
  u_anchorWorld: WebGLUniformLocation | null;
  u_squashStretch: WebGLUniformLocation | null;
  u_shear: WebGLUniformLocation | null;
  u_sway: WebGLUniformLocation | null;
  u_tex0: WebGLUniformLocation | null;
  u_tex1: WebGLUniformLocation | null;
  u_frameBlend: WebGLUniformLocation | null;
  u_uvDistort: WebGLUniformLocation | null;
  u_tintColor: WebGLUniformLocation | null;
  u_flashColor: WebGLUniformLocation | null;
}

/**
 * Raw WebGL2 Character Stage Renderer implementing `ICharacterStageRenderer`.
 * Manages a shared VAO, streaming VBO, static EBO, unified GLSL 300 es shader program,
 * and automatic `WeakMap<HTMLCanvasElement, WebGLTexture>` texture caching.
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
  private readonly usedIdsThisFrame = new Map<string, number>();
  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.releaseGpuResources(true);
  };
  private readonly onContextRestored = (): void => {
    if (this.canvas) this.initContext(this.canvas);
  };

  private readonly topology: MeshGridTopology;
  private readonly spritePool = new Map<string, MeshSprite>();
  private readonly queuedSprites: MeshSprite[] = [];
  private textureCache = new WeakMap<HTMLCanvasElement, WebGLTexture>();
  private readonly allocatedTextures: WebGLTexture[] = [];

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
  ) {
    this.topology = createMeshGridTopology(cols, rows);
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.initContext(canvas);
  }

  public get isReady(): boolean {
    return Boolean(this.gl && this.program && this.vao && !this.gl.isContextLost());
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
    if (!gl) return;
    this.gl = gl;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, UNIFIED_CHARACTER_VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, UNIFIED_CHARACTER_FRAGMENT_SHADER);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return;
    }

    this.program = prog;
    this.uniforms = {
      u_viewProjMatrix: gl.getUniformLocation(prog, 'u_viewProjMatrix'),
      u_anchorWorld: gl.getUniformLocation(prog, 'u_anchorWorld'),
      u_squashStretch: gl.getUniformLocation(prog, 'u_squashStretch'),
      u_shear: gl.getUniformLocation(prog, 'u_shear'),
      u_sway: gl.getUniformLocation(prog, 'u_sway'),
      u_tex0: gl.getUniformLocation(prog, 'u_tex0'),
      u_tex1: gl.getUniformLocation(prog, 'u_tex1'),
      u_frameBlend: gl.getUniformLocation(prog, 'u_frameBlend'),
      u_uvDistort: gl.getUniformLocation(prog, 'u_uvDistort'),
      u_tintColor: gl.getUniformLocation(prog, 'u_tintColor'),
      u_flashColor: gl.getUniformLocation(prog, 'u_flashColor'),
    };

    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ebo = gl.createBuffer();
    if (!vao || !vbo || !ebo) {
      if (vao) gl.deleteVertexArray(vao);
      if (vbo) gl.deleteBuffer(vbo);
      if (ebo) gl.deleteBuffer(ebo);
      gl.deleteProgram(prog);
      this.program = null;
      this.uniforms = null;
      return;
    }

    this.vao = vao;
    this.vbo = vbo;
    this.ebo = ebo;

    gl.bindVertexArray(vao);

    // Pre-allocate dynamic VBO for a single MeshSprite (updated in-place via bufferSubData)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.topology.vertexCount * FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      gl.DYNAMIC_DRAW,
    );

    const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    // location 0: a_position (vec2)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    // location 1: a_uv0 (vec2)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * 4);
    // location 2: a_uv1 (vec2)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 4 * 4);
    // location 3: a_heightWeight (float)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 6 * 4);
    // location 4: a_alpha (float)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 7 * 4);

    // Upload static triangle index buffer once
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.topology.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private getOrCreateTexture(source: HTMLCanvasElement): WebGLTexture | null {
    const gl = this.gl;
    if (!gl || !source || source.width === 0 || source.height === 0) return null;

    const cached = this.textureCache.get(source);
    if (cached) return cached;

    const tex = gl.createTexture();
    if (!tex) return null;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // Match HD hand-drawn cutout style: smooth linear filtering, clamped edges
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    this.textureCache.set(source, tex);
    this.allocatedTextures.push(tex);
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
    this.frameParams = params;
    this.queuedSprites.length = 0;
    this.usedIdsThisFrame.clear();

    const gl = this.gl;
    if (!gl || !this.isReady) return;

    const pixelW = Math.max(1, Math.floor(params.width * params.dpr));
    const pixelH = Math.max(1, Math.floor(params.height * params.dpr));
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

    // Fallback orthographic matrix when no external ActionCameraController matrix is passed
    const w = Math.max(1, params.width);
    const h = Math.max(1, params.height);
    const z = params.cameraZoom || 1;
    const rot = params.cameraRotRad || 0;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const a = z * cosR;
    const b = -z * sinR;
    const c = z * sinR;
    const d = z * cosR;
    const tx = cx + params.cameraPanX + params.shakeOffsetX - (a * cx + b * cy);
    const ty = cy + params.cameraPanY + params.shakeOffsetY - (c * cx + d * cy);
    const invW2 = 2 / w;
    const invH2 = 2 / h;

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

    // Premultiplied alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix3fv(u.u_viewProjMatrix, false, this.viewProjMatrix);
    gl.uniform1i(u.u_tex0, 0);
    gl.uniform1i(u.u_tex1, 1);

    const { width, height, dpr, deckBackY, deckFrontY } = this.frameParams;
    let scissorActive = false;

    // Preserve relative order within same priority while lifting focal cut-in units above dimmed bystanders
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

      // Apply hardware scissor rect covering rotated/zoomed planar walkway band
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

      // Update vertex positions in-place without GPU buffer reallocation
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprite.vertices);
      gl.drawElements(gl.TRIANGLES, this.topology.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (scissorActive) {
      gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindVertexArray(null);

    if (debugWireframeCtx) {
      this.renderDebugWireframeOverlay(debugWireframeCtx);
    }
  }

  /**
   * Draws the live deformed 4x6 triangle mesh wireframe and the 4 virtual anatomical
   * control points (Feet, Pelvis, Waist, Head) onto the overlay Canvas2D context.
   */
  private renderDebugWireframeOverlay(ctx: CanvasRenderingContext2D): void {
    const indices = this.topology.indices;
    const knotScratch = { dx: 0, dy: 0, rotRad: 0, scaleX: 1 };

    ctx.save();
    for (let i = 0; i < this.queuedSprites.length; i++) {
      const sprite = this.queuedSprites[i];
      const cmd = sprite.command;
      if (cmd.isReflection || cmd.alpha < 0.25) continue;

      const verts = sprite.vertices;
      const uni = cmd.uniforms;
      const ax = cmd.worldX;
      const ay = cmd.worldY;

      // Helper to apply vertex-shader squash/stretch, sway, and shear for exact wireframe match
      const projectVertex = (vIdx: number): [number, number] => {
        const base = vIdx * FLOATS_PER_VERTEX;
        const wx = verts[base];
        const wy = verts[base + 1];
        const h = verts[base + 6];
        let rx = (wx - ax) * uni.squashStretch[0];
        let ry = (wy - ay) * uni.squashStretch[1];
        const weight = h * h * (3 - 2 * h);
        const swayOffset = Math.sin(uni.swayPhase + h * 1.35) * uni.swayAmpPx * weight;
        rx += swayOffset + uni.shearPx[0] * h;
        ry += uni.shearPx[1] * h;
        return [ax + rx, ay + ry];
      };

      // 1. Subdivided 4x6 Triangle Mesh Grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let t = 0; t < indices.length; t += 3) {
        const [x0, y0] = projectVertex(indices[t]);
        const [x1, y1] = projectVertex(indices[t + 1]);
        const [x2, y2] = projectVertex(indices[t + 2]);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
      }
      ctx.stroke();

      // 2. 4 Virtual Anatomical Control Points (Feet h=0, Pelvis h=0.33, Waist h=0.67, Head h=1.0)
      const knotHeights = [0, 1 / 3, 2 / 3, 1];
      const knotColors = ['#10B981', '#00F0FF', '#FFC700', '#FF2E7E'];
      const topLocalY = -cmd.anchorOffsetYPx;
      const bottomLocalY = cmd.heightPx - cmd.anchorOffsetYPx;

      ctx.strokeStyle = 'rgba(255, 199, 0, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const knotScreenPts: Array<[number, number]> = [];
      for (let k = 0; k < knotHeights.length; k++) {
        const h = knotHeights[k];
        evaluateAnatomicalSplineRow(h, cmd.deform, knotScratch);
        const rawLocalY = bottomLocalY + (topLocalY - bottomLocalY) * h;
        const mx = knotScratch.dx * cmd.facingSign * uni.squashStretch[0];
        const my = (rawLocalY + knotScratch.dy) * uni.squashStretch[1];
        const weight = h * h * (3 - 2 * h);
        const swayOffset = Math.sin(uni.swayPhase + h * 1.35) * uni.swayAmpPx * weight;
        const kx = ax + mx + swayOffset + uni.shearPx[0] * h;
        const ky = ay + my + uni.shearPx[1] * h;
        knotScreenPts.push([kx, ky]);
        if (k === 0) ctx.moveTo(kx, ky);
        else ctx.lineTo(kx, ky);
      }
      ctx.stroke();

      for (let k = 0; k < knotScreenPts.length; k++) {
        const [kx, ky] = knotScreenPts[k];
        ctx.fillStyle = '#091126';
        ctx.strokeStyle = knotColors[k];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kx, ky, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
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
    if (gl && !contextLost) {
      for (const tex of this.allocatedTextures) gl.deleteTexture(tex);
      if (this.vbo) gl.deleteBuffer(this.vbo);
      if (this.ebo) gl.deleteBuffer(this.ebo);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.allocatedTextures.length = 0;
    this.textureCache = new WeakMap();
    this.vbo = null;
    this.ebo = null;
    this.vao = null;
    this.program = null;
    this.uniforms = null;
    if (!contextLost) this.gl = null;
  }

  public dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    }
    const gl = this.gl;
    this.canvas = null;
    if (!gl) return;
    for (const tex of this.allocatedTextures) {
      gl.deleteTexture(tex);
    }
    this.allocatedTextures.length = 0;
    this.textureCache = new WeakMap();
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.ebo) gl.deleteBuffer(this.ebo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.vbo = null;
    this.ebo = null;
    this.vao = null;
    this.program = null;
    this.gl = null;
  }
}
