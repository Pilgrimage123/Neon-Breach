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

export interface UniformLocations {
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

export function compileWebGLShader(
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

export function createCharacterShaderProgram(
  gl: WebGL2RenderingContext,
): { program: WebGLProgram; uniforms: UniformLocations } | null {
  const vs = compileWebGLShader(gl, gl.VERTEX_SHADER, UNIFIED_CHARACTER_VERTEX_SHADER);
  const fs = compileWebGLShader(gl, gl.FRAGMENT_SHADER, UNIFIED_CHARACTER_FRAGMENT_SHADER);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }

  const uniforms: UniformLocations = {
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

  return { program: prog, uniforms };
}
