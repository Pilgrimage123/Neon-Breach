import {
  FLOATS_PER_VERTEX,
  type MeshGridTopology,
  evaluateAnatomicalSplineRow,
} from './stageSpriteAdapter';
import type { MeshSprite } from './webglMeshSprite';

/**
 * Draws the live deformed 4x6 triangle mesh wireframe and the 4 virtual anatomical
 * control points (Feet, Pelvis, Waist, Head) onto the overlay Canvas2D context.
 */
export function renderMeshDebugWireframeOverlay(
  ctx: CanvasRenderingContext2D,
  topology: MeshGridTopology,
  queuedSprites: readonly MeshSprite[],
): void {
  const indices = topology.indices;
  const knotScratch = { dx: 0, dy: 0, rotRad: 0, scaleX: 1 };

  ctx.save();
  for (let i = 0; i < queuedSprites.length; i++) {
    const sprite = queuedSprites[i];
    const cmd = sprite.command;
    if (cmd.isReflection || cmd.alpha < 0.25) continue;

    const verts = sprite.vertices;
    const uni = cmd.uniforms;
    const ax = cmd.worldX;
    const ay = cmd.worldY;

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
