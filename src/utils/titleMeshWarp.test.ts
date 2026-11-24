import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDilatedTriangle,
  computeVertexIdleBreathNormY,
  createMeshWarpScratch,
  interpolateLattice,
  KEYFRAME_LATTICE_VERTICES,
  MESH_DEFAULT_DILATION_PX,
  MESH_IDLE_BREATH_AMP_PX,
  MESH_REF_HEIGHT,
  MESH_REF_WIDTH,
  MESH_VERTEX_COUNT,
  solveTriangleAffine,
  WARP_TRIANGLES,
} from './titleMeshWarp';

function signedArea2Norm(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

test('WARP_TRIANGLES cleanly partition [0, 1] x [0, 1] with strictly positive signed area across K0-K4, intermediate blends, and idle breathing', () => {
  const scratch = createMeshWarpScratch();

  // Verify exact partition at every keyframe K0..K4
  for (let k = 0; k < KEYFRAME_LATTICE_VERTICES.length; k++) {
    const verts = KEYFRAME_LATTICE_VERTICES[k];
    assert.equal(verts.length, MESH_VERTEX_COUNT);
    let totalArea = 0;
    for (let t = 0; t < WARP_TRIANGLES.length; t++) {
      const [i0, i1, i2] = WARP_TRIANGLES[t];
      const det2 = signedArea2Norm(
        verts[i0].nx,
        verts[i0].ny,
        verts[i1].nx,
        verts[i1].ny,
        verts[i2].nx,
        verts[i2].ny,
      );
      assert.ok(
        det2 > 1e-4,
        `Triangle ${t} (${i0},${i1},${i2}) flipped or degenerate at K${k}: det2=${det2}`,
      );
      totalArea += det2 * 0.5;
    }
    assert.ok(
      Math.abs(totalArea - 1.0) < 1e-6,
      `Expected unit area partition at K${k}, got ${totalArea}`,
    );
  }

  // Verify zero foldovers across intermediate transitions K_A -> K_{A+1}
  for (let a = 0; a < KEYFRAME_LATTICE_VERTICES.length - 1; a++) {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      interpolateLattice(a, a + 1, u, 0, false, scratch.activeVertices);
      for (let t = 0; t < WARP_TRIANGLES.length; t++) {
        const [i0, i1, i2] = WARP_TRIANGLES[t];
        const det2 = signedArea2Norm(
          scratch.activeVertices[i0 * 2],
          scratch.activeVertices[i0 * 2 + 1],
          scratch.activeVertices[i1 * 2],
          scratch.activeVertices[i1 * 2 + 1],
          scratch.activeVertices[i2 * 2],
          scratch.activeVertices[i2 * 2 + 1],
        );
        assert.ok(
          det2 > 1e-4,
          `Triangle ${t} (${i0},${i1},${i2}) flipped during K${a}->K${a + 1} at u=${u}: det2=${det2}`,
        );
      }
    }
  }

  // Verify zero foldovers under full idle breathing cycle on K0
  for (let timeSec = 0; timeSec < 3.2; timeSec += 0.25) {
    interpolateLattice(0, 0, 0, timeSec, true, scratch.activeVertices);
    for (let t = 0; t < WARP_TRIANGLES.length; t++) {
      const [i0, i1, i2] = WARP_TRIANGLES[t];
      const det2 = signedArea2Norm(
        scratch.activeVertices[i0 * 2],
        scratch.activeVertices[i0 * 2 + 1],
        scratch.activeVertices[i1 * 2],
        scratch.activeVertices[i1 * 2 + 1],
        scratch.activeVertices[i2 * 2],
        scratch.activeVertices[i2 * 2 + 1],
      );
      assert.ok(
        det2 > 1e-4,
        `Triangle ${t} flipped under idle breathing at t=${timeSec}: det2=${det2}`,
      );
    }
  }
});

test('solveTriangleAffine computes exact 2D affine mapping and rejects degenerate triangles', () => {
  const m = new Float64Array(6);
  const sx0 = 100;
  const sy0 = 50;
  const sx1 = 240;
  const sy1 = 80;
  const sx2 = 150;
  const sy2 = 210;

  const dx0 = 130;
  const dy0 = 70;
  const dx1 = 290;
  const dy1 = 115;
  const dx2 = 175;
  const dy2 = 250;

  const ok = solveTriangleAffine(
    sx0, sy0, sx1, sy1, sx2, sy2,
    dx0, dy0, dx1, dy1, dx2, dy2,
    m,
  );
  assert.equal(ok, true);

  const pairs: [number, number, number, number][] = [
    [sx0, sy0, dx0, dy0],
    [sx1, sy1, dx1, dy1],
    [sx2, sy2, dx2, dy2],
  ];
  for (const [sx, sy, ex, ey] of pairs) {
    const px = m[0] * sx + m[2] * sy + m[4];
    const py = m[1] * sx + m[3] * sy + m[5];
    assert.ok(Math.abs(px - ex) < 1e-6);
    assert.ok(Math.abs(py - ey) < 1e-6);
  }

  // Collinear degenerate triangle must return false
  const degenerate = solveTriangleAffine(
    10, 10, 20, 20, 30, 30,
    10, 10, 25, 25, 40, 40,
    m,
  );
  assert.equal(degenerate, false);
});

test('computeDilatedTriangle expands every vertex outward from centroid by 0.6px', () => {
  const out = new Float64Array(6);
  const x0 = 100;
  const y0 = 100;
  const x1 = 220;
  const y1 = 100;
  const x2 = 160;
  const y2 = 220;
  const cx = (x0 + x1 + x2) / 3;
  const cy = (y0 + y1 + y2) / 3;

  computeDilatedTriangle(x0, y0, x1, y1, x2, y2, MESH_DEFAULT_DILATION_PX, out);

  const orig = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
  ];
  for (let i = 0; i < 3; i++) {
    const ox = orig[i][0];
    const oy = orig[i][1];
    const nx = out[i * 2];
    const ny = out[i * 2 + 1];
    const dOrig = Math.hypot(ox - cx, oy - cy);
    const dNew = Math.hypot(nx - cx, ny - cy);
    assert.ok(Math.abs(dNew - dOrig - MESH_DEFAULT_DILATION_PX) < 1e-6);
  }
});

test('Idle breathing bounds upper-body landmarks to +-1.5px and keeps waist V14 and pinned anchors V16-V24 strictly invariant', () => {
  const scratch = createMeshWarpScratch();
  const baseVerts = KEYFRAME_LATTICE_VERTICES[0];

  let sawVisorMotion = false;
  for (let t = 0; t <= 4.0; t += 0.1) {
    interpolateLattice(0, 0, 0, t, true, scratch.activeVertices);

    // Waist V14 + Pinned anchors V16-V24 must have exact zero displacement
    for (const pinnedIdx of [14, 16, 17, 18, 19, 20, 21, 22, 23, 24]) {
      assert.equal(scratch.activeVertices[pinnedIdx * 2], Math.fround(baseVerts[pinnedIdx].nx));
      assert.equal(scratch.activeVertices[pinnedIdx * 2 + 1], Math.fround(baseVerts[pinnedIdx].ny));
      assert.equal(computeVertexIdleBreathNormY(pinnedIdx, t), 0);
    }

    // Upper-body landmarks V0..V13, V15 stay within +-1.5px vertical displacement
    for (let i = 0; i < 16; i++) {
      const dxPx = (scratch.activeVertices[i * 2] - baseVerts[i].nx) * MESH_REF_WIDTH;
      const dyPx = (scratch.activeVertices[i * 2 + 1] - baseVerts[i].ny) * MESH_REF_HEIGHT;
      assert.ok(Math.abs(dxPx) < 1e-3, `Expected dxPx ~ 0, got ${dxPx}`);
      assert.ok(
        Math.abs(dyPx) <= MESH_IDLE_BREATH_AMP_PX + 1e-5,
        `Vertex V${i} exceeded +-1.5px breathing bound: dyPx=${dyPx}`,
      );
      if (i === 8 && Math.abs(dyPx) > 0.5) {
        sawVisorMotion = true;
      }
    }
  }
  assert.ok(sawVisorMotion, 'Expected Kira visor V8 to breathe during idle');
});
