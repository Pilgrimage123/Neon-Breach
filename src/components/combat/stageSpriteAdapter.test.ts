import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOATS_PER_VERTEX,
  FULL_FRAME_UV,
  computeDeformedMeshVertices,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  createMeshGridTopology,
  deriveEnemyDeformAndUniforms,
  deriveHeroDeformAndUniforms,
  evaluateAnatomicalSplineRow,
} from './stageSpriteAdapter';
import { MeshSprite, WebGL2CharacterStageRenderer } from './webglMeshRenderer';

test('createMeshGridTopology generates a 4x6 subdivided grid with 35 vertices and 48 triangles', () => {
  const topo = createMeshGridTopology(4, 6);
  assert.equal(topo.cols, 4);
  assert.equal(topo.rows, 6);
  assert.equal(topo.vertexCount, 35); // (4 + 1) * (6 + 1)
  assert.equal(topo.indexCount, 144); // 4 * 6 * 6
  assert.equal(topo.uGrid[0], 0);
  assert.equal(topo.uGrid[4], 1);
  assert.equal(topo.hGrid[0], 0); // Feet row
  assert.equal(topo.hGrid[6], 1); // Head row
});

test('evaluateAnatomicalSplineRow interpolates smoothly across 4 virtual control points', () => {
  const deform = createIdentityControlPoints();
  deform.feet.dx = 0;
  deform.pelvis.dx = -4;
  deform.waist.dx = -10;
  deform.head.dx = -18;

  const out = { dx: 0, dy: 0, rotRad: 0, scaleX: 1 };

  evaluateAnatomicalSplineRow(0, deform, out);
  assert.equal(out.dx, 0);

  evaluateAnatomicalSplineRow(1 / 3, deform, out);
  assert.ok(Math.abs(out.dx - -4) < 1e-5);

  evaluateAnatomicalSplineRow(2 / 3, deform, out);
  assert.ok(Math.abs(out.dx - -10) < 1e-5);

  evaluateAnatomicalSplineRow(1, deform, out);
  assert.ok(Math.abs(out.dx - -18) < 1e-5);

  // Midpoint between waist and head should be monotonically between -10 and -18
  evaluateAnatomicalSplineRow(0.85, deform, out);
  assert.ok(out.dx < -10 && out.dx > -18);
});

test('computeDeformedMeshVertices preserves bottom-center foot anchor while bending upper torso', () => {
  const topo = createMeshGridTopology(4, 6);
  const verts = new Float32Array(topo.vertexCount * FLOATS_PER_VERTEX);
  const deform = createIdentityControlPoints();
  deform.waist.dx = 12;
  deform.head.dx = 24;

  const fakeCanvas = { width: 256, height: 256 } as HTMLCanvasElement;
  computeDeformedMeshVertices(
    topo,
    {
      id: 'hero',
      primarySource: fakeCanvas,
      primaryUv: { u0: 0.25, v0: 0.0, u1: 0.5, v1: 0.5 },
      secondaryUv: { u0: 0.0, v0: 0.0, u1: 0.25, v1: 0.5 },
      worldX: 300,
      worldY: 340,
      widthPx: 120,
      heightPx: 200,
      anchorOffsetXPx: 60, // center X
      anchorOffsetYPx: 200, // bottom Y at feet
      facingSign: 1,
      rotationRad: 0,
      alpha: 0.9,
      deform,
      uniforms: createDefaultShaderUniforms(),
    },
    verts,
  );

  // Row 0, Col 2 (center of feet, vertex index 2): should be pinned to (300, 340) with h = 0
  const footCenterBase = 2 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[footCenterBase] - 300) < 1e-5);
  assert.ok(Math.abs(verts[footCenterBase + 1] - 340) < 1e-5);
  assert.equal(verts[footCenterBase + 6], 0); // heightWeight = 0 at feet
  assert.ok(Math.abs(verts[footCenterBase + 7] - 0.9) < 1e-5);

  // Top row (Row 6, Col 2, vertex index 6 * 5 + 2 = 32): displaced by head.dx (+24) and at worldY - 200 = 140
  const headCenterBase = 32 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[headCenterBase] - 324) < 1e-4);
  assert.ok(Math.abs(verts[headCenterBase + 1] - 140) < 1e-4);
  assert.equal(verts[headCenterBase + 6], 1); // heightWeight = 1 at head

  // Verify UV remapping at top-left (Row 6, Col 0 -> index 30) and bottom-right (Row 0, Col 4 -> index 4)
  const topLeftBase = 30 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[topLeftBase + 2] - 0.25) < 1e-5); // u0
  assert.ok(Math.abs(verts[topLeftBase + 3] - 0.0) < 1e-5); // v0
  assert.ok(Math.abs(verts[topLeftBase + 4] - 0.0) < 1e-5); // u1

  const botRightBase = 4 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[botRightBase + 2] - 0.5) < 1e-5); // u0
  assert.ok(Math.abs(verts[botRightBase + 3] - 0.5) < 1e-5); // v0
});

test('MeshSprite updates in-place without reallocating its vertex Float32Array', () => {
  const topo = createMeshGridTopology(4, 6);
  const fakeCanvas = { width: 128, height: 128 } as HTMLCanvasElement;
  const sprite = new MeshSprite('stalker_1', topo, fakeCanvas);
  const initialBufferRef = sprite.vertices;

  sprite.setFrame(fakeCanvas, FULL_FRAME_UV);
  sprite.setTransform(500, 320, 140, 180, 70, 180, -1, 0);
  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: 'stalker',
    idx: 0,
    ea: {
      flashTimer: 0.12,
      lunge: 0,
      lungeDir: -1,
      koProgress: 0,
      dead: false,
      staggerTimer: 0.25,
      staggerDuration: 0.42,
      staggerIntensity: 1,
      bleedSpurtTimer: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0.5,
      bristleTimer: 0,
      bristleDuration: 0.5,
      bristleKind: 'armor',
    },
    isDead: false,
    staggerShearPx: 8.5,
    staggerBioFlashAlpha: 0.35,
    breathScaleX: 0.96,
    breathScaleY: 1.04,
    frameBlendAlpha: 0.75,
    bioEmissiveRgb: [0.5, 0.9, 0.2],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: true,
    isStaggeredStatus: false,
    elapsed: 1.25,
    tacticalViewActive: false,
  });

  sprite.applyCommand({
    ...sprite.command,
    deform,
    uniforms,
  });

  assert.equal(sprite.vertices, initialBufferRef);
  assert.ok(uniforms.flashRgba[3] > 0.3);
  assert.ok(uniforms.uvDistortAmp[0] > 0);
  assert.equal(deform.feet.dx, 0);
  assert.notEqual(deform.head.dx, 0);
});

test('deriveHeroDeformAndUniforms configures corrode UV distortion and hit spine bend', () => {
  const res = deriveHeroDeformAndUniforms({
    mode: 'hit',
    breathScaleX: 1,
    breathScaleY: 1,
    tiltRad: 0,
    frameBlendAlpha: 1,
    flashTimer: 0.15,
    corrode: 2,
    hoveredColor: 'attack',
    elapsed: 2.0,
    isProne: false,
  });

  assert.equal(res.deform.feet.dx, 0);
  assert.ok(res.deform.head.dx < -5);
  assert.ok(res.uniforms.uvDistortAmp[0] > 0);
  assert.ok(res.uniforms.flashRgba[3] > 0.2);
});

test('computeDeformedMeshVertices aligns secondary frame UVs to foot anchor without horizontal stretching', () => {
  const topo = createMeshGridTopology(4, 6);
  const verts = new Float32Array(topo.vertexCount * FLOATS_PER_VERTEX);
  const fakeCanvas = { width: 256, height: 256 } as HTMLCanvasElement;

  computeDeformedMeshVertices(
    topo,
    {
      id: 'enemy:spitter',
      primarySource: fakeCanvas,
      worldX: 500,
      worldY: 320,
      widthPx: 200,
      heightPx: 240,
      anchorOffsetXPx: 80,
      anchorOffsetYPx: 240,
      secondaryWidthPx: 160,
      secondaryHeightPx: 240,
      secondaryAnchorOffsetXPx: 80,
      secondaryAnchorOffsetYPx: 240,
      facingSign: -1,
      rotationRad: 0,
      alpha: 1,
      deform: createIdentityControlPoints(),
      uniforms: createDefaultShaderUniforms(),
    },
    verts,
  );

  // At col 0 (left edge of primary frame, unscaledLocalX = -80):
  // In secondary frame (anchor = 80, width = 160), u1 should be (-80 + 80) / 160 = 0.0
  const botLeftBase = 0 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[botLeftBase + 4] - 0.0) < 1e-5);

  // At col 4 (right edge of primary frame, unscaledLocalX = +120):
  // In secondary frame (anchor = 80, width = 160), u1 should be (120 + 80) / 160 = 1.25 (> 1, clipped cleanly in shader)
  const botRightBase = 4 * FLOATS_PER_VERTEX;
  assert.ok(Math.abs(verts[botRightBase + 4] - 1.25) < 1e-5);
});

import {
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
  triggerBruteJuiceState,
} from '../../utils/bruteJuiceController';

test('deriveEnemyDeformAndUniforms composes Carapace Brute juice spline with pinned feet and Anti-Jelly idle', () => {
  const bruteState = createBruteJuiceState();
  // Idle stays strictly Anti-Jelly (uvDistortAmp === 0)
  const idleSample = stepBruteJuice(bruteState, 0.016, 1.0, DEFAULT_BRUTE_JUICE_CONFIG);
  assert.equal(idleSample.uvDistortAmp[0], 0);
  assert.equal(idleSample.uvDistortAmp[1], 0);

  triggerBruteJuiceState(bruteState, 'mutagen_brace', DEFAULT_BRUTE_JUICE_CONFIG);
  let bruteJuice = idleSample;
  for (let i = 0; i < 16; i++) {
    bruteJuice = stepBruteJuice(bruteState, 0.04, 1.0 + i * 0.04, DEFAULT_BRUTE_JUICE_CONFIG);
  }

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: 'brute',
    idx: 0,
    ea: {
      flashTimer: 0,
      lunge: 0,
      lungeDir: -1,
      koProgress: 0,
      dead: false,
      staggerTimer: 0,
      staggerDuration: 0.42,
      staggerIntensity: 1,
      bleedSpurtTimer: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0.5,
      bristleTimer: 0.4,
      bristleDuration: 0.6,
      bristleKind: 'armor',
    },
    isDead: false,
    staggerShearPx: 0,
    staggerBioFlashAlpha: 0,
    breathScaleX: 1,
    breathScaleY: 1,
    frameBlendAlpha: bruteJuice.frameBlendAlpha,
    bioEmissiveRgb: [0.3, 0.9, 0.4],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: false,
    elapsed: 1.64,
    tacticalViewActive: false,
    bruteJuice,
  });

  // Rule 3: Feet strictly pinned at 0,0
  assert.equal(deform.feet.dx, 0);
  assert.equal(deform.feet.dy, 0);
  assert.equal(deform.feet.rotRad, 0);
  // Mutagen brace Phase 3 erupts torso upward (-Y) & expands chest width + dorsal heat shimmer
  assert.ok(deform.head.dy < -2 && deform.waist.scaleX > 1.04);
  assert.ok(uniforms.uvDistortAmp[0] > 0);
  assert.ok(uniforms.tintRgba[0] > 1.0);
});

test('deriveHeroDeformAndUniforms suppresses enemy cut-in recoil_pose and hit flash during dodge', () => {
  const res = deriveHeroDeformAndUniforms({
    mode: 'dodge',
    breathScaleX: 1,
    breathScaleY: 1,
    tiltRad: -0.06,
    frameBlendAlpha: 1,
    flashTimer: 0.18,
    corrode: 0,
    hoveredColor: null,
    elapsed: 1.5,
    isProne: false,
    cutIn: {
      active: true,
      role: 'target',
      isMeleeClash: true,
      drawPriority: 2,
      clashSlideX: 0,
      scaleX: 0.85,
      scaleY: 1.15,
      knockbackX: -32,
      leanRad: -0.1,
      poseOverride: 'recoil_pose',
      tintRgba: [1, 0.3, 0.3, 1],
      flashRgba: [1, 0.2, 0.2, 0.8],
    },
  });

  // Feet stay pinned; head shear stays agile (<= 6px), not bent violently backward by recoil_pose (-18px)
  assert.equal(res.deform.feet.dx, 0);
  assert.ok(res.deform.head.dx > -8, `Expected agile dodge shear, got head.dx=${res.deform.head.dx}`);
  // Enemy hit flash and red damage tint must be completely suppressed on a clean dodge
  assert.equal(res.uniforms.flashRgba[3], 0);
  assert.equal(res.uniforms.tintRgba[0], 1);
  assert.equal(res.uniforms.tintRgba[1], 1);
  assert.equal(res.uniforms.tintRgba[2], 1);
});

test('MeshSprite.setTransform assigns anchorOffsetYPx independently of anchorOffsetXPx', () => {
  const topo = createMeshGridTopology(4, 6);
  const fakeCanvas = { width: 128, height: 256 } as HTMLCanvasElement;
  const sprite = new MeshSprite('hero_anchor_test', topo, fakeCanvas);

  sprite.setTransform(240, 360, 110, 220, 48, 212, 1, 0);

  assert.equal(sprite.command.anchorOffsetXPx, 48);
  assert.equal(sprite.command.anchorOffsetYPx, 212);
  assert.notEqual(sprite.command.anchorOffsetYPx, sprite.command.anchorOffsetXPx);
});

test('WebGL2CharacterStageRenderer handles context loss/restore, bounded LRU texture eviction, and dispose cleanup', () => {
  let contextLost = false;
  let deletedTextures = 0;
  let deletedPrograms = 0;
  let deletedBuffers = 0;
  let deletedVaos = 0;
  let texSeq = 1;
  const listeners = new Map<string, Set<(e: Event) => void>>();

  const mockCanvas = {
    width: 1200,
    height: 420,
    addEventListener(type: string, fn: (e: Event) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (e: Event) => void) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string) {
      let prevented = false;
      const evt = {
        preventDefault() {
          prevented = true;
        },
      } as unknown as Event;
      for (const fn of listeners.get(type) ?? []) {
        fn(evt);
      }
      return prevented;
    },
    getContext(kind: string) {
      if (kind !== 'webgl2') return null;
      return mockGl;
    },
  };

  const mockGl = {
    canvas: mockCanvas,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    DYNAMIC_DRAW: 0x88e8,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    TEXTURE1: 0x84c1,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    SCISSOR_TEST: 0x0c11,
    COLOR_BUFFER_BIT: 0x4000,
    BLEND: 0x0be2,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    TRIANGLES: 0x0004,
    UNSIGNED_SHORT: 0x1403,
    isContextLost: () => contextLost,
    createShader: () => ({ id: 'shader' }),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({ id: 'program' }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {
      deletedPrograms++;
    },
    getUniformLocation: (_prog: unknown, name: string) => ({ name }),
    createVertexArray: () => ({ id: 'vao' }),
    deleteVertexArray: () => {
      deletedVaos++;
    },
    createBuffer: () => ({ id: 'buf' }),
    deleteBuffer: () => {
      deletedBuffers++;
    },
    bindVertexArray: () => {},
    bindBuffer: () => {},
    bufferData: () => {},
    bufferSubData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    viewport: () => {},
    disable: () => {},
    enable: () => {},
    scissor: () => {},
    clearColor: () => {},
    clear: () => {},
    useProgram: () => {},
    blendFunc: () => {},
    uniformMatrix3fv: () => {},
    uniform1i: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    uniform4f: () => {},
    activeTexture: () => {},
    bindTexture: () => {},
    createTexture: () => ({ id: texSeq++ }),
    deleteTexture: () => {
      deletedTextures++;
    },
    pixelStorei: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    drawElements: () => {},
  };

  const statusEvents: boolean[] = [];
  const renderer = new WebGL2CharacterStageRenderer(
    mockCanvas as unknown as HTMLCanvasElement,
    4,
    6,
    {
      maxCachedTextures: 16,
      onContextStatusChange: (ready) => statusEvents.push(ready),
    },
  );
  assert.equal(renderer.isReady, true);

  // Bounded LRU texture cache evicts oldest textures when > maxCachedTextures (16)
  renderer.beginFrame({
    width: 1200,
    height: 420,
    dpr: 1,
    cameraZoom: Number.NaN, // verifies finite parameter guard
    cameraPanX: 0,
    cameraPanY: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    deckBackY: 280,
    deckFrontY: 360,
  });
  for (let i = 0; i < 20; i++) {
    const src = { width: 64, height: 64, id: i } as unknown as HTMLCanvasElement;
    renderer.drawSprite({
      id: `sprite_${i}`,
      primarySource: src,
      worldX: 100 + i * 20,
      worldY: 320,
      widthPx: 64,
      heightPx: 64,
      anchorOffsetXPx: 32,
      anchorOffsetYPx: 64,
      facingSign: 1,
      rotationRad: 0,
      alpha: 1,
      deform: createIdentityControlPoints(),
      uniforms: createDefaultShaderUniforms(),
    });
  }
  renderer.endFrame();
  assert.equal(renderer.cachedTextureCount, 16);
  assert.equal(deletedTextures, 4);

  // Context loss calls preventDefault, drops ready state, clears texture cache without calling gl.deleteTexture
  contextLost = true;
  const prevented = mockCanvas.dispatch('webglcontextlost');
  assert.equal(prevented, true);
  assert.equal(renderer.isReady, false);
  assert.equal(renderer.cachedTextureCount, 0);
  assert.equal(deletedTextures, 4);
  assert.deepEqual(statusEvents, [false]);

  // Context restore reinitializes WebGL resources and notifies ready=true
  contextLost = false;
  mockCanvas.dispatch('webglcontextrestored');
  assert.equal(renderer.isReady, true);
  assert.deepEqual(statusEvents, [false, true]);

  // Dispose removes event listeners and releases GPU resources
  renderer.dispose();
  assert.equal(renderer.isReady, false);
  assert.equal(listeners.get('webglcontextlost')?.size ?? 0, 0);
  assert.equal(listeners.get('webglcontextrestored')?.size ?? 0, 0);
  assert.equal(deletedPrograms, 1);
  assert.equal(deletedVaos, 1);
  assert.equal(deletedBuffers, 2);
});



