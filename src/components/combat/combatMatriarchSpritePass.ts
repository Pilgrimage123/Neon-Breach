import {
  MATRIARCH_CANONICAL_HEIGHT,
  type MatriarchFrameSample,
} from '../../utils/matriarchSpriteSheet';
import type { MatriarchJuiceSample } from '../../utils/matriarchJuiceController';
import type { CoreEnemySpriteContext } from './combatEnemyCoreSpritePass';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import { hexToRgba } from './mutantBlood';
import {
  type SpriteLandmarkProjectionParams,
  createIdentityControlPoints,
  projectSpriteLandmarkToStage,
} from './stageMeshMath';
import { deriveEnemyDeformAndUniforms } from './stageSpriteAdapter';

/**
 * Draws the Xenomorph Matriarch's dorsal egg-sac bioluminescence (Phase 1),
 * the violent one-shot carapace explosion shockwave & flying chitin shards
 * at <= 50% max HP, and the smoldering Phase 2 bio-ichor fumes.
 */
function renderMatriarchBackAura(
  fgCtx: CanvasRenderingContext2D,
  params: {
    backOriginRel: { dx: number; dy: number };
    projParams: SpriteLandmarkProjectionParams;
    size: number;
    drawScale: number;
    isBackExploded: boolean;
    backGlowIntensity: number;
    ruptureProgress: number;
    elapsed: number;
    koAlpha: number;
  },
): void {
  const {
    backOriginRel,
    projParams,
    size,
    drawScale,
    isBackExploded,
    backGlowIntensity,
    ruptureProgress,
    elapsed,
    koAlpha,
  } = params;
  if (koAlpha <= 0.04) return;

  const backPos = projectSpriteLandmarkToStage(backOriginRel, projParams);
  const bx = backPos.x;
  const by = backPos.y;

  fgCtx.save();
  fgCtx.globalCompositeOperation = 'lighter';

  // 1. Continuous egg-sac / ruptured cavity bioluminescent pulse
  if (backGlowIntensity > 0.25) {
    const glowAlpha = Math.min(0.68, (backGlowIntensity - 0.15) * (isBackExploded ? 0.72 : 0.44)) * koAlpha;
    const rad = size * (isBackExploded ? 0.42 : 0.28);
    const grad = fgCtx.createRadialGradient(bx, by, 2, bx, by, rad);
    if (isBackExploded) {
      grad.addColorStop(0, `rgba(190, 242, 100, ${glowAlpha * 0.92})`);
      grad.addColorStop(0.42, `rgba(251, 146, 60, ${glowAlpha * 0.56})`);
      grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
    } else {
      grad.addColorStop(0, `rgba(255, 196, 64, ${glowAlpha * 0.85})`);
      grad.addColorStop(0.5, `rgba(249, 115, 22, ${glowAlpha * 0.42})`);
      grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    }
    fgCtx.fillStyle = grad;
    fgCtx.beginPath();
    fgCtx.arc(bx, by, rad, 0, Math.PI * 2);
    fgCtx.fill();
  }

  // 2. Phase 2 persistent rising bio-ichor steam & glowing micro-spores from the exploded back
  if (isBackExploded && ruptureProgress <= 0.01) {
    const sporeCount = 6;
    for (let i = 0; i < sporeCount; i++) {
      const cycle = (elapsed * (0.75 + (i % 3) * 0.22) + i * 0.37) % 1;
      const rise = cycle * size * 0.36;
      const driftX = Math.sin(elapsed * 2.4 + i * 1.9) * size * 0.08 + (i - 2.5) * size * 0.055;
      const sporeAlpha = Math.sin(cycle * Math.PI) * 0.72 * koAlpha;
      const r = Math.max(1.4, (3.2 - cycle * 1.4) * drawScale * 1.9);
      fgCtx.fillStyle = i % 2 === 0
        ? `rgba(190, 242, 100, ${sporeAlpha})`
        : `rgba(251, 146, 60, ${sporeAlpha * 0.92})`;
      fgCtx.beginPath();
      fgCtx.arc(bx + driftX, by - rise, r, 0, Math.PI * 2);
      fgCtx.fill();
    }
  }

  // 3. One-shot 50% HP dorsal carapace explosion shockwave, plasma rays & flying shards!
  if (ruptureProgress > 0.005 && ruptureProgress < 0.995) {
    const p = ruptureProgress;
    const blastFade = Math.pow(1 - p, 1.25) * koAlpha;

    // Expanding incandescent plasma core flash
    if (p < 0.45) {
      const coreFade = (1 - p / 0.45) * koAlpha;
      const coreRad = size * (0.28 + p * 0.95);
      const coreGrad = fgCtx.createRadialGradient(bx, by, 2, bx, by, coreRad);
      coreGrad.addColorStop(0, `rgba(255, 255, 235, ${coreFade * 0.95})`);
      coreGrad.addColorStop(0.32, `rgba(190, 242, 100, ${coreFade * 0.82})`);
      coreGrad.addColorStop(0.68, `rgba(249, 115, 22, ${coreFade * 0.54})`);
      coreGrad.addColorStop(1, 'rgba(255, 46, 126, 0)');
      fgCtx.fillStyle = coreGrad;
      fgCtx.beginPath();
      fgCtx.arc(bx, by, coreRad, 0, Math.PI * 2);
      fgCtx.fill();
    }

    // Dual expanding shockwave rings (acid-lime outer + molten-orange inner)
    const ringRad = size * (0.12 + p * 0.78);
    fgCtx.strokeStyle = `rgba(190, 242, 100, ${blastFade * 0.92})`;
    fgCtx.lineWidth = Math.max(1.5, 6.5 * (1 - p));
    fgCtx.beginPath();
    fgCtx.arc(bx, by, ringRad, 0, Math.PI * 2);
    fgCtx.stroke();

    fgCtx.strokeStyle = `rgba(251, 146, 60, ${blastFade * 0.78})`;
    fgCtx.lineWidth = Math.max(1.0, 4.0 * (1 - p));
    fgCtx.beginPath();
    fgCtx.arc(bx, by, ringRad * 0.74, 0, Math.PI * 2);
    fgCtx.stroke();

    // Radial plasma jet rays erupting out of the blown-open back
    const rayAngles = [-2.35, -1.95, -1.55, -1.15, -0.78, -0.42, -0.08];
    fgCtx.lineCap = 'round';
    for (let r = 0; r < rayAngles.length; r++) {
      const ang = rayAngles[r];
      const inner = size * (0.06 + p * 0.18);
      const outer = size * (0.24 + p * (0.52 + (r % 3) * 0.14));
      fgCtx.strokeStyle =
        r % 2 === 0
          ? `rgba(190, 242, 100, ${blastFade * 0.88})`
          : `rgba(255, 196, 64, ${blastFade * 0.84})`;
      fgCtx.lineWidth = Math.max(1.2, (4.4 - (r % 2) * 1.1) * (1 - p * 0.65));
      fgCtx.beginPath();
      fgCtx.moveTo(bx + Math.cos(ang) * inner, by + Math.sin(ang) * inner);
      fgCtx.lineTo(bx + Math.cos(ang) * outer, by + Math.sin(ang) * outer);
      fgCtx.stroke();
    }

    // Flying jagged magenta-violet dorsal carapace shards spinning away from the rupture
    fgCtx.globalCompositeOperation = 'source-over';
    const shardAngles = [-2.18, -1.72, -1.32, -0.92, -0.54, -0.18, 0.12];
    for (let s = 0; s < shardAngles.length; s++) {
      const ang = shardAngles[s];
      const dist = size * (0.14 + p * (0.58 + (s % 3) * 0.15));
      const gravY = p * p * size * 0.24;
      const sx = bx + Math.cos(ang) * dist;
      const sy = by + Math.sin(ang) * dist + gravY;
      const shardLen = Math.max(5, (11 + (s % 3) * 4.5) * drawScale * 1.45 * (1 - p * 0.3));
      const shardW = shardLen * 0.48;

      fgCtx.save();
      fgCtx.translate(sx, sy);
      fgCtx.rotate(ang + p * (s % 2 === 0 ? 4.2 : -3.8));
      fgCtx.globalAlpha = Math.min(1, blastFade * 1.25);
      fgCtx.fillStyle = s % 3 === 0 ? '#F97316' : s % 3 === 1 ? '#EC4899' : '#A3E635';
      fgCtx.beginPath();
      fgCtx.moveTo(shardLen, 0);
      fgCtx.lineTo(-shardLen * 0.45, -shardW);
      fgCtx.lineTo(-shardLen * 0.75, shardW * 0.55);
      fgCtx.closePath();
      fgCtx.fill();
      fgCtx.strokeStyle = 'rgba(20, 8, 28, 0.85)';
      fgCtx.lineWidth = 1.1;
      fgCtx.stroke();
      fgCtx.restore();
    }
  }

  fgCtx.restore();
}

/**
 * Subtle magenta ocular glint locked 1:1 to the Matriarch's glowing eye landmark.
 */
function renderMatriarchEyeGlow(
  fgCtx: CanvasRenderingContext2D,
  params: {
    eyeOriginRel: { dx: number; dy: number };
    projParams: SpriteLandmarkProjectionParams;
    drawScale: number;
    eyeGlowIntensity: number;
    isBackExploded: boolean;
    koAlpha: number;
  },
): void {
  const { eyeOriginRel, projParams, drawScale, eyeGlowIntensity, isBackExploded, koAlpha } = params;
  if (eyeGlowIntensity <= 0.3 || koAlpha <= 0.04) return;

  const eyePos = projectSpriteLandmarkToStage(eyeOriginRel, projParams);
  const rad = Math.max(7, (isBackExploded ? 26 : 19) * drawScale);
  const alpha = Math.min(0.75, (eyeGlowIntensity - 0.2) * (isBackExploded ? 0.72 : 0.48)) * koAlpha;

  fgCtx.save();
  fgCtx.globalCompositeOperation = 'lighter';
  const grad = fgCtx.createRadialGradient(eyePos.x, eyePos.y, 1, eyePos.x, eyePos.y, rad);
  grad.addColorStop(0, `rgba(255, 220, 255, ${alpha})`);
  grad.addColorStop(0.4, `rgba(236, 72, 153, ${alpha * 0.65})`);
  grad.addColorStop(1, 'rgba(236, 72, 153, 0)');
  fgCtx.fillStyle = grad;
  fgCtx.beginPath();
  fgCtx.arc(eyePos.x, eyePos.y, rad, 0, Math.PI * 2);
  fgCtx.fill();
  fgCtx.restore();
}

/**
 * Draws hanging acid-lime slime strands, falling lime/ember droplets, and deck splashes
 * anchored 1:1 to the active Matriarch phase's pixel-scanned nozzles.
 */
function renderMatriarchSlimeDrips(
  fgCtx: CanvasRenderingContext2D,
  params: {
    juice: MatriarchJuiceSample;
    projParams: SpriteLandmarkProjectionParams;
    spriteX: number;
    enemyGroundY: number;
    drawScale: number;
    scaleX: number;
    scaleY: number;
    koAlpha: number;
  },
): void {
  const { juice, projParams, spriteX, enemyGroundY, drawScale, scaleX, scaleY, koAlpha } = params;
  if (koAlpha <= 0.04) return;

  fgCtx.save();
  fgCtx.globalAlpha = koAlpha;

  // 1. Deck splash ripples
  for (let i = 0; i < juice.splashes.length; i++) {
    const sp = juice.splashes[i];
    if (!sp.active) continue;
    const p = Math.max(0, Math.min(1, sp.age / sp.maxAge));
    const fade = Math.pow(1 - p, 1.35);
    const sx = spriteX + sp.x * drawScale * scaleX;
    const sy = enemyGroundY - 1;
    const rx = (2.5 + sp.maxRadius * p) * drawScale * 1.15;
    const ry = rx * 0.28;
    const isEmber = sp.kind === 'ember';

    fgCtx.save();
    fgCtx.globalAlpha = koAlpha * fade * 0.85;
    fgCtx.strokeStyle = isEmber ? '#FDBA74' : '#BEF264';
    fgCtx.lineWidth = Math.max(1.1, 2.2 * (1 - p));
    fgCtx.beginPath();
    fgCtx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    fgCtx.stroke();

    fgCtx.fillStyle = isEmber
      ? `rgba(249, 115, 22, ${0.44 * fade})`
      : `rgba(163, 230, 53, ${0.42 * fade})`;
    fgCtx.beginPath();
    fgCtx.ellipse(sx, sy, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    fgCtx.fill();
    fgCtx.restore();
  }

  // 2. Hanging stretching viscous lime strands anchored via projectSpriteLandmarkToStage
  for (let i = 0; i < juice.nozzles.length; i++) {
    const n = juice.nozzles[i];
    if (n.stretchPx < 2.2) continue;

    const rootPos = projectSpriteLandmarkToStage({ dx: n.dx, dy: n.dy }, projParams);
    const rootX = rootPos.x;
    const rootY = rootPos.y;
    const stretchScreen = n.stretchPx * drawScale * scaleY;
    const tipX = rootX + n.swayPx * drawScale;
    const tipY = Math.min(enemyGroundY - 2, rootY + stretchScreen);
    if (tipY <= rootY + 1) continue;

    const rBulb = Math.max(1.7, n.bulbRadius * drawScale * 1.05);
    const rRoot = Math.max(1.2, rBulb * 0.66);
    const neckPinch =
      n.phase === 'stretching'
        ? Math.max(0.22, 0.58 - (n.stretchPx / n.maxStretchPx) * 0.36)
        : 0.62;
    const rNeck = Math.max(0.7, rBulb * neckPinch);
    const midX = (rootX + tipX) * 0.5;
    const midY = rootY + (tipY - rootY) * 0.58;

    const grad = fgCtx.createLinearGradient(rootX, rootY, tipX, tipY + rBulb);
    grad.addColorStop(0, '#65A30D');
    grad.addColorStop(0.55, '#A3E635');
    grad.addColorStop(1, '#D9F99D');

    fgCtx.beginPath();
    fgCtx.moveTo(rootX - rRoot, rootY);
    fgCtx.quadraticCurveTo(midX - rNeck, midY, tipX - rBulb * 0.92, tipY - rBulb * 0.15);
    fgCtx.arc(tipX, tipY, rBulb, Math.PI, 0, true);
    fgCtx.quadraticCurveTo(midX + rNeck, midY, rootX + rRoot, rootY);
    fgCtx.closePath();

    fgCtx.fillStyle = grad;
    fgCtx.fill();
    fgCtx.strokeStyle = 'rgba(54, 83, 20, 0.78)';
    fgCtx.lineWidth = Math.max(0.7, drawScale * 1.35);
    fgCtx.stroke();

    fgCtx.fillStyle = 'rgba(247, 254, 231, 0.92)';
    fgCtx.beginPath();
    fgCtx.ellipse(
      tipX - rBulb * 0.3,
      tipY - rBulb * 0.18,
      Math.max(0.55, rBulb * 0.28),
      Math.max(0.75, rBulb * 0.42),
      -0.25,
      0,
      Math.PI * 2,
    );
    fgCtx.fill();
  }

  // 3. Falling gravity-elongated lime & ember-ichor teardrops
  for (let i = 0; i < juice.drops.length; i++) {
    const d = juice.drops[i];
    if (!d.active) continue;

    const dxScreen = spriteX + d.x * drawScale * scaleX;
    const dyScreen = enemyGroundY + d.y * drawScale;
    if (dyScreen > enemyGroundY + 3) continue;

    const r = Math.max(1.8, d.radius * drawScale * 1.05);
    const tailLen = r * (1.2 + d.stretchY * 0.95);
    const isEmber = d.kind === 'ember';

    fgCtx.save();
    fgCtx.translate(dxScreen, dyScreen);
    const velAngle = Math.atan2(d.vx, Math.max(40, d.vy));
    fgCtx.rotate(-velAngle * 0.45);

    fgCtx.fillStyle = isEmber ? 'rgba(249, 115, 22, 0.28)' : 'rgba(163, 230, 53, 0.25)';
    fgCtx.beginPath();
    fgCtx.ellipse(0, -tailLen * 0.2, r * 1.55, r * 1.9, 0, 0, Math.PI * 2);
    fgCtx.fill();

    fgCtx.beginPath();
    fgCtx.moveTo(0, -tailLen);
    fgCtx.quadraticCurveTo(r * 1.08, -r * 0.2, 0, r);
    fgCtx.quadraticCurveTo(-r * 1.08, -r * 0.2, 0, -tailLen);
    fgCtx.closePath();

    const dropGrad = fgCtx.createLinearGradient(0, -tailLen, 0, r);
    if (isEmber) {
      dropGrad.addColorStop(0, '#EA580C');
      dropGrad.addColorStop(0.6, '#FB923C');
      dropGrad.addColorStop(1, '#FEF08A');
    } else {
      dropGrad.addColorStop(0, '#84CC16');
      dropGrad.addColorStop(0.65, '#BEF264');
      dropGrad.addColorStop(1, '#ECFCCB');
    }
    fgCtx.fillStyle = dropGrad;
    fgCtx.fill();

    fgCtx.strokeStyle = isEmber ? 'rgba(124, 45, 18, 0.75)' : 'rgba(54, 83, 20, 0.72)';
    fgCtx.lineWidth = Math.max(0.7, drawScale * 1.2);
    fgCtx.stroke();

    fgCtx.fillStyle = '#FFFBEB';
    fgCtx.beginPath();
    fgCtx.arc(-r * 0.26, r * 0.08, Math.max(0.55, r * 0.28), 0, Math.PI * 2);
    fgCtx.fill();
    fgCtx.restore();
  }

  fgCtx.restore();
}

/**
 * Draws sweeping neon-magenta, acid-lime, and gold scythe slash arcs during attacks.
 */
function renderMatriarchScytheSlashArcs(
  fgCtx: CanvasRenderingContext2D,
  params: {
    clawOriginRel: { dx: number; dy: number };
    projParams: SpriteLandmarkProjectionParams;
    size: number;
    clawSlashProgress: number;
    isBackExploded: boolean;
    koAlpha: number;
  },
): void {
  const { clawOriginRel, projParams, size, clawSlashProgress, isBackExploded, koAlpha } = params;
  if (clawSlashProgress <= 0.02 || clawSlashProgress >= 0.99) return;

  const arcEnv = Math.sin(clawSlashProgress * Math.PI);
  const clawPos = projectSpriteLandmarkToStage(clawOriginRel, projParams);
  const cx = clawPos.x - size * 0.1;
  const cy = clawPos.y - size * 0.08;

  fgCtx.save();
  fgCtx.globalCompositeOperation = 'lighter';
  fgCtx.globalAlpha = arcEnv * 0.9 * koAlpha;

  const arcs = [
    { offsetY: -size * 0.1, rad: size * 0.48, color: '#FF2E7E', width: 5.2 },
    { offsetY: size * 0.02, rad: size * 0.42, color: '#A3E635', width: 3.8 },
    ...(isBackExploded
      ? [{ offsetY: size * 0.12, rad: size * 0.36, color: '#FB923C', width: 3.2 }]
      : []),
  ];

  for (let i = 0; i < arcs.length; i++) {
    const a = arcs[i];
    const startAng = Math.PI * (0.66 + clawSlashProgress * 0.42);
    const endAng = Math.PI * (1.26 + clawSlashProgress * 0.34);
    fgCtx.strokeStyle = a.color;
    fgCtx.lineWidth = a.width * (0.55 + arcEnv * 0.65);
    fgCtx.lineCap = 'round';
    fgCtx.beginPath();
    fgCtx.arc(cx, cy + a.offsetY, a.rad, startAng, endAng);
    fgCtx.stroke();
  }
  fgCtx.restore();
}

export function renderMatriarchEnemySprite(
  c: CoreEnemySpriteContext,
  matriarchSample: MatriarchFrameSample,
): void {
  const frames = c.sim.matriarchFrames;
  if (!frames) return;
  const matriarchJuice = c.sim.matriarchJuiceSamples?.get(c.enemy.id);
  const frameIdx = matriarchJuice ? matriarchJuice.frameIndex : matriarchSample.frameIndex;
  const mCanvas = frames[frameIdx] ?? frames[0];
  if (!mCanvas) return;

  const mf = matriarchSample.frame;
  const drawScale = c.size / MATRIARCH_CANONICAL_HEIGHT;
  const hopY = c.ea?.dead
    ? 0
    : (matriarchJuice ? matriarchJuice.hopYPx : matriarchSample.yHopPx) * drawScale;
  const backGlow = matriarchJuice
    ? matriarchJuice.backGlowIntensity
    : matriarchSample.backGlowIntensity;
  const eyeGlow = matriarchJuice
    ? matriarchJuice.eyeGlowIntensity
    : matriarchSample.eyeGlowIntensity;
  const ruptureProg = matriarchJuice
    ? matriarchJuice.ruptureProgress
    : matriarchSample.ruptureProgress;
  const isBackExploded = matriarchJuice
    ? matriarchJuice.isBackExploded
    : matriarchSample.isBackExploded;
  const slashProg = matriarchJuice
    ? matriarchJuice.clawSlashProgress
    : matriarchSample.clawSlashProgress;
  const rotRad = !c.ea?.dead
    ? c.stagger.rot * 0.22 +
      (matriarchJuice ? matriarchJuice.rotationRad : matriarchSample.tiltRad) +
      c.enemyCutIn.leanRad
    : 0;
  const staggerDy = c.ea?.dead ? 0 : c.stagger.dy * 0.35;

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: c.enemy.archetype,
    idx: c.idx,
    ea: c.ea,
    isDead: c.isDead,
    staggerShearPx: c.stagger.shearPx,
    staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
    breathScaleX: matriarchJuice
      ? c.stagger.scaleXMul
      : c.breathScaleX * matriarchSample.breathScaleX,
    breathScaleY: matriarchJuice
      ? c.stagger.scaleYMul
      : c.breathScaleY * matriarchSample.breathScaleY,
    frameBlendAlpha: 1,
    bioEmissiveRgb: c.bioEmissiveRgb,
    isPrimedOrCharging: c.isPrimedOrCharging || backGlow > 0.72,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: Boolean(c.enemy.staggered),
    elapsed: c.elapsed,
    tacticalViewActive: c.tacticalViewActive,
    matriarchJuice,
    cutIn: c.enemyCutIn,
    facingSign: 1,
  });

  const effectiveScaleX = uniforms.squashStretch[0];
  const effectiveScaleY = uniforms.squashStretch[1];

  const projParams: SpriteLandmarkProjectionParams = {
    frame: mf,
    worldX: c.spriteX,
    worldY: c.enemyGroundY + hopY + staggerDy,
    drawScale,
    facingSign: 1,
    nativeFacingSign: 1,
    rotationRad: rotRad,
    deform: c.webglRenderer ? deform : createIdentityControlPoints(),
    squashStretch: uniforms.squashStretch,
    shearPx: c.webglRenderer ? uniforms.shearPx : [0, 0],
    swayAmpPx: c.webglRenderer ? uniforms.swayAmpPx : 0,
    swayPhase: c.webglRenderer ? uniforms.swayPhase : 0,
  };

  if (c.webglRenderer) {
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: mCanvas,
      secondarySource: null,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + staggerDy,
      widthPx: mf.w * drawScale,
      heightPx: mf.h * drawScale,
      anchorOffsetXPx: mf.anchorX * drawScale,
      anchorOffsetYPx: mf.bottomY * drawScale,
      facingSign: 1,
      rotationRad: rotRad,
      alpha: c.koAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
  } else {
    const { baseCtx } = c;
    baseCtx.save();
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;
    baseCtx.translate(c.spriteX, c.enemyGroundY + hopY + staggerDy);
    baseCtx.rotate(rotRad);
    baseCtx.scale(effectiveScaleX, effectiveScaleY);

    baseCtx.drawImage(
      mCanvas,
      -mf.anchorX * drawScale,
      -mf.bottomY * drawScale,
      mf.w * drawScale,
      mf.h * drawScale,
    );

    if (
      (c.ea && c.ea.flashTimer > 0) ||
      (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
      (!c.ea?.dead && matriarchJuice?.flashRgba) ||
      c.enemyCutIn.flashRgba
    ) {
      baseCtx.globalCompositeOperation = 'lighter';
      const flash = c.enemyCutIn.flashRgba ?? matriarchJuice?.flashRgba;
      if (flash) {
        drawCanvas2DCutInFlash(baseCtx, flash, c.size * 0.44, -c.size * 0.46);
      } else if (c.ea && c.ea.flashTimer > 0) {
        baseCtx.fillStyle = 'rgba(255, 255, 255, 0.54)';
        baseCtx.beginPath();
        baseCtx.arc(0, -c.size * 0.46, c.size * 0.38, 0, Math.PI * 2);
        baseCtx.fill();
      }
      if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
        baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
        baseCtx.beginPath();
        baseCtx.ellipse(2, -c.size * 0.46, c.size * 0.32, c.size * 0.38, 0.2, 0, Math.PI * 2);
        baseCtx.fill();
      }
    }
    baseCtx.restore();
  }

  // Foreground 1:1 landmark-projected bio-VFX overlays
  if (!c.tacticalViewActive) {
    if (!c.ea?.dead) {
      renderMatriarchBackAura(c.fgCtx, {
        backOriginRel: mf.backOriginRel,
        projParams,
        size: c.size,
        drawScale,
        isBackExploded,
        backGlowIntensity: backGlow,
        ruptureProgress: ruptureProg,
        elapsed: c.elapsed,
        koAlpha: c.koAlpha,
      });

      renderMatriarchEyeGlow(c.fgCtx, {
        eyeOriginRel: mf.eyeOriginRel,
        projParams,
        drawScale,
        eyeGlowIntensity: eyeGlow,
        isBackExploded,
        koAlpha: c.koAlpha,
      });
    }

    if (matriarchJuice) {
      renderMatriarchSlimeDrips(c.fgCtx, {
        juice: matriarchJuice,
        projParams,
        spriteX: c.spriteX,
        enemyGroundY: c.enemyGroundY,
        drawScale,
        scaleX: effectiveScaleX,
        scaleY: effectiveScaleY,
        koAlpha: c.koAlpha,
      });
    }

    if (!c.ea?.dead && slashProg > 0.02) {
      renderMatriarchScytheSlashArcs(c.fgCtx, {
        clawOriginRel: mf.clawOriginRel,
        projParams,
        size: c.size,
        clawSlashProgress: slashProg,
        isBackExploded,
        koAlpha: c.koAlpha,
      });
    }
  }
}
