import {
  STALKER_CANONICAL_HEIGHT,
  type StalkerFrameSample,
} from '../../utils/stalkerSpriteSheet';
import type { StalkerJuiceSample } from '../../utils/stalkerJuiceController';
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
 * Draws the viscous acid-lime dripping slime layer anchored to the uploaded
 * Chitin Stalker's actual hanging slime tips, plus gravity-falling teardrops
 * and deck splash ripples on `enemyGroundY`.
 */
function renderStalkerSlimeDrips(
  fgCtx: CanvasRenderingContext2D,
  params: {
    juice: StalkerJuiceSample;
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

  // 1. Ground impact splash rings & micro-beads on the bridge deck
  for (let i = 0; i < juice.splashes.length; i++) {
    const sp = juice.splashes[i];
    if (!sp.active) continue;
    const p = Math.max(0, Math.min(1, sp.age / sp.maxAge));
    const fade = Math.pow(1 - p, 1.35);
    const sx = spriteX + sp.x * drawScale * scaleX;
    const sy = enemyGroundY - 1;
    const rx = (2.5 + sp.maxRadius * p) * drawScale * 1.15;
    const ry = rx * 0.28;

    fgCtx.save();
    fgCtx.globalAlpha = koAlpha * fade * 0.85;
    fgCtx.strokeStyle = '#BEF264';
    fgCtx.lineWidth = Math.max(1.1, 2.2 * (1 - p));
    fgCtx.beginPath();
    fgCtx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    fgCtx.stroke();

    // Inner glowing puddle pulse
    fgCtx.fillStyle = `rgba(163, 230, 53, ${0.42 * fade})`;
    fgCtx.beginPath();
    fgCtx.ellipse(sx, sy, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    fgCtx.fill();

    // Two tiny ballistic splash micro-beads arcing up from impact
    if (p < 0.72) {
      const arcU = p / 0.72;
      const lift = Math.sin(arcU * Math.PI) * 9 * drawScale * 2.2;
      const spread = (3 + arcU * 14) * drawScale * 1.3;
      const beadR = Math.max(1.0, 2.1 * (1 - arcU) * drawScale * 1.8);
      fgCtx.fillStyle = '#D9F99D';
      fgCtx.beginPath();
      fgCtx.arc(sx - spread * Math.cos(sp.seed * 0.3), sy - lift, beadR, 0, Math.PI * 2);
      fgCtx.arc(sx + spread * Math.sin(sp.seed * 0.5 + 0.8), sy - lift * 0.8, beadR * 0.82, 0, Math.PI * 2);
      fgCtx.fill();
    }
    fgCtx.restore();
  }

  // 2. Hanging stretching meniscus strands + swelling glossy lime bulbs on all 7 nozzles
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

    const rBulb = Math.max(1.8, n.bulbRadius * drawScale * 1.08);
    const rRoot = Math.max(1.3, rBulb * 0.68);
    const neckPinch = n.phase === 'stretching' ? Math.max(0.22, 0.58 - (n.stretchPx / n.maxStretchPx) * 0.36) : 0.62;
    const rNeck = Math.max(0.75, rBulb * neckPinch);
    const midX = (rootX + tipX) * 0.5;
    const midY = rootY + (tipY - rootY) * 0.58;

    // Dark organic contour + vibrant acid-lime viscous fill
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
    fgCtx.lineWidth = Math.max(0.75, drawScale * 1.45);
    fgCtx.stroke();

    // Glossy wet specular dot on the hanging bulb
    fgCtx.fillStyle = 'rgba(247, 254, 231, 0.92)';
    fgCtx.beginPath();
    fgCtx.ellipse(
      tipX - rBulb * 0.3,
      tipY - rBulb * 0.18,
      Math.max(0.6, rBulb * 0.3),
      Math.max(0.8, rBulb * 0.44),
      -0.25,
      0,
      Math.PI * 2,
    );
    fgCtx.fill();
  }

  // 3. Detached falling gravity-elongated acid-lime teardrops
  for (let i = 0; i < juice.drops.length; i++) {
    const d = juice.drops[i];
    if (!d.active) continue;

    const dxScreen = spriteX + d.x * drawScale * scaleX;
    const dyScreen = enemyGroundY + d.y * drawScale;
    if (dyScreen > enemyGroundY + 3) continue;

    const r = Math.max(1.8, d.radius * drawScale * 1.05);
    const tailLen = r * (1.2 + d.stretchY * 0.95);

    fgCtx.save();
    fgCtx.translate(dxScreen, dyScreen);
    const velAngle = Math.atan2(d.vx, Math.max(40, d.vy));
    fgCtx.rotate(-velAngle * 0.45);

    // Subtle bioluminescent lime halo around falling droplet
    fgCtx.fillStyle = 'rgba(163, 230, 53, 0.25)';
    fgCtx.beginPath();
    fgCtx.ellipse(0, -tailLen * 0.2, r * 1.55, r * 1.9, 0, 0, Math.PI * 2);
    fgCtx.fill();

    // Teardrop silhouette
    fgCtx.beginPath();
    fgCtx.moveTo(0, -tailLen);
    fgCtx.quadraticCurveTo(r * 1.08, -r * 0.2, 0, r);
    fgCtx.quadraticCurveTo(-r * 1.08, -r * 0.2, 0, -tailLen);
    fgCtx.closePath();

    const dropGrad = fgCtx.createLinearGradient(0, -tailLen, 0, r);
    dropGrad.addColorStop(0, '#84CC16');
    dropGrad.addColorStop(0.65, '#BEF264');
    dropGrad.addColorStop(1, '#ECFCCB');
    fgCtx.fillStyle = dropGrad;
    fgCtx.fill();

    fgCtx.strokeStyle = 'rgba(54, 83, 20, 0.72)';
    fgCtx.lineWidth = Math.max(0.7, drawScale * 1.25);
    fgCtx.stroke();

    // Specular glint
    fgCtx.fillStyle = '#F7FEE7';
    fgCtx.beginPath();
    fgCtx.arc(-r * 0.26, r * 0.08, Math.max(0.6, r * 0.28), 0, Math.PI * 2);
    fgCtx.fill();
    fgCtx.restore();
  }

  fgCtx.restore();
}

/**
 * Draws the brief full-closure magenta chitin eyelid accent right over the narrowed
 * yellow eye during the ~60ms blink apex (or hit wince), tracked directly to the head bone.
 */
function renderStalkerBlinkApexEyelid(
  fgCtx: CanvasRenderingContext2D,
  params: {
    eyeOriginRel: { dx: number; dy: number };
    projParams: SpriteLandmarkProjectionParams;
    blinkClosure: number;
    drawScale: number;
    scaleX: number;
    scaleY: number;
    koAlpha: number;
  },
): void {
  const {
    eyeOriginRel,
    projParams,
    blinkClosure,
    drawScale,
    scaleX,
    scaleY,
    koAlpha,
  } = params;
  if (blinkClosure <= 0.06 || koAlpha <= 0.05) return;

  const eyePos = projectSpriteLandmarkToStage(eyeOriginRel, projParams);

  // Narrowed eye aperture on 512px stalker_blink.png is ~62px wide x 32px tall, angled ~-26deg
  const rx = 31 * drawScale * scaleX;
  const ry = 16.5 * drawScale * scaleY;

  fgCtx.save();
  fgCtx.translate(eyePos.x, eyePos.y + 3 * drawScale * scaleY);
  fgCtx.rotate(eyePos.knotRotRad - 0.38);
  fgCtx.globalAlpha = Math.min(1, blinkClosure * 1.15) * koAlpha;

  // Fleshy magenta-crimson chitin eyelid sliding down over the narrowed yellow slit
  const lidGrad = fgCtx.createLinearGradient(0, -ry, 0, ry);
  lidGrad.addColorStop(0, '#EC4899');
  lidGrad.addColorStop(0.55, '#BE185D');
  lidGrad.addColorStop(1, '#831843');

  fgCtx.fillStyle = lidGrad;
  fgCtx.beginPath();
  fgCtx.ellipse(0, 0, rx, ry * Math.min(1, 0.35 + blinkClosure * 0.68), 0, 0, Math.PI * 2);
  fgCtx.fill();

  // Dark closed eyelid crease
  fgCtx.strokeStyle = 'rgba(48, 8, 28, 0.92)';
  fgCtx.lineWidth = Math.max(1.2, 2.8 * drawScale);
  fgCtx.lineCap = 'round';
  fgCtx.beginPath();
  fgCtx.moveTo(-rx * 0.9, ry * 0.14);
  fgCtx.quadraticCurveTo(0, ry * 0.42 * blinkClosure, rx * 0.9, -ry * 0.08);
  fgCtx.stroke();

  // Glossy upper ridge highlight matching the chitin shading
  fgCtx.strokeStyle = 'rgba(251, 207, 232, 0.52)';
  fgCtx.lineWidth = Math.max(0.8, 1.5 * drawScale);
  fgCtx.beginPath();
  fgCtx.moveTo(-rx * 0.65, -ry * 0.25);
  fgCtx.quadraticCurveTo(0, -ry * 0.48, rx * 0.65, -ry * 0.2);
  fgCtx.stroke();

  fgCtx.restore();
}

/**
 * Draws twin neon-crimson & acid-lime scythe slash arcs during the Stalker's pounce attack.
 */
function renderStalkerScytheSlashArcs(
  fgCtx: CanvasRenderingContext2D,
  params: {
    clawOriginRel: { dx: number; dy: number };
    projParams: SpriteLandmarkProjectionParams;
    size: number;
    clawSlashProgress: number;
    koAlpha: number;
  },
): void {
  const { clawOriginRel, projParams, size, clawSlashProgress, koAlpha } = params;
  if (clawSlashProgress <= 0.02 || clawSlashProgress >= 0.99) return;

  const arcEnv = Math.sin(clawSlashProgress * Math.PI);
  const clawPos = projectSpriteLandmarkToStage(clawOriginRel, projParams);
  const cx = clawPos.x - size * 0.14;
  const cy = clawPos.y;

  fgCtx.save();
  fgCtx.globalCompositeOperation = 'lighter';
  fgCtx.globalAlpha = arcEnv * 0.88 * koAlpha;

  const arcs = [
    { offsetY: -size * 0.08, rad: size * 0.44, color: '#FF2E7E', width: 4.5 },
    { offsetY: size * 0.04, rad: size * 0.38, color: '#A3E635', width: 3.4 },
  ];

  for (let i = 0; i < arcs.length; i++) {
    const a = arcs[i];
    const startAng = Math.PI * (0.68 + clawSlashProgress * 0.42);
    const endAng = Math.PI * (1.24 + clawSlashProgress * 0.34);
    fgCtx.strokeStyle = a.color;
    fgCtx.lineWidth = a.width * (0.55 + arcEnv * 0.6);
    fgCtx.lineCap = 'round';
    fgCtx.beginPath();
    fgCtx.arc(cx, cy + a.offsetY, a.rad, startAng, endAng);
    fgCtx.stroke();
  }
  fgCtx.restore();
}

export function renderStalkerEnemySprite(
  c: CoreEnemySpriteContext,
  stalkerSample: StalkerFrameSample,
): void {
  const frames = c.sim.stalkerFrames;
  if (!frames) return;
  const stalkerJuice = c.sim.stalkerJuiceSamples?.get(c.enemy.id);
  const frameIdx = stalkerJuice ? stalkerJuice.frameIndex : stalkerSample.frameIndex;
  const prevIdx = stalkerJuice ? stalkerJuice.prevFrameIndex : stalkerSample.prevFrameIndex;
  const sCanvas = frames[frameIdx] ?? frames[0];
  if (!sCanvas) return;

  const sf = stalkerSample.frame;
  const drawScale = c.size / STALKER_CANONICAL_HEIGHT;
  const hopY = c.ea?.dead
    ? 0
    : (stalkerJuice ? stalkerJuice.hopYPx : stalkerSample.yHopPx) * drawScale;
  const spineGlow = stalkerJuice ? stalkerJuice.spineGlowIntensity : stalkerSample.spineGlowIntensity;
  const blinkClosure = stalkerJuice ? stalkerJuice.blinkClosure : stalkerSample.blinkClosure;
  const slashProg = stalkerJuice ? stalkerJuice.clawSlashProgress : stalkerSample.clawSlashProgress;
  const rotRad = !c.ea?.dead
    ? c.stagger.rot * 0.24 +
      (stalkerJuice ? stalkerJuice.rotationRad : stalkerSample.tiltRad) +
      c.enemyCutIn.leanRad
    : 0;

  const staggerDy = c.ea?.dead ? 0 : c.stagger.dy * 0.35;
  const blendA = stalkerJuice ? stalkerJuice.frameBlendAlpha : stalkerSample.frameBlendAlpha;
  const canCrossBlend = !c.ea?.dead && blendA < 0.99 && prevIdx !== frameIdx;
  const prevCanvas = canCrossBlend ? frames[prevIdx] : null;

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: c.enemy.archetype,
    idx: c.idx,
    ea: c.ea,
    isDead: c.isDead,
    staggerShearPx: c.stagger.shearPx,
    staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
    breathScaleX: stalkerJuice ? c.stagger.scaleXMul : c.breathScaleX * stalkerSample.breathScaleX,
    breathScaleY: stalkerJuice ? c.stagger.scaleYMul : c.breathScaleY * stalkerSample.breathScaleY,
    frameBlendAlpha: canCrossBlend ? blendA : 1,
    bioEmissiveRgb: c.bioEmissiveRgb,
    isPrimedOrCharging: c.isPrimedOrCharging || spineGlow > 0.65,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: Boolean(c.enemy.staggered),
    elapsed: c.elapsed,
    tacticalViewActive: c.tacticalViewActive,
    stalkerJuice,
    cutIn: c.enemyCutIn,
    facingSign: 1,
  });

  const effectiveScaleX = uniforms.squashStretch[0];
  const effectiveScaleY = uniforms.squashStretch[1];

  const projParams: SpriteLandmarkProjectionParams = {
    frame: sf,
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

  // Crimson bioluminescent dorsal spine glow & bristle flare rays (native left-facing: +dx is right/back)
  if (spineGlow > 0.44 && !c.ea?.dead && !c.tacticalViewActive) {
    const { fgCtx } = c;
    const glowAlpha = Math.min(0.72, (spineGlow - 0.32) * 0.92);
    const spinePos = projectSpriteLandmarkToStage(sf.quillOriginRel, projParams);
    const gx = spinePos.x;
    const gy = spinePos.y;
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const rad = c.size * (stalkerSample.mode === 'bristle' ? 0.56 : 0.42);
    const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    grad.addColorStop(0, `rgba(255, 46, 126, ${glowAlpha})`);
    grad.addColorStop(0.5, `rgba(255, 46, 126, ${glowAlpha * 0.38})`);
    grad.addColorStop(1, 'rgba(255, 46, 126, 0)');
    fgCtx.fillStyle = grad;
    fgCtx.beginPath();
    fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    fgCtx.fill();

    if (stalkerSample.mode === 'bristle' || stalkerSample.mode === 'guard') {
      const rayLen = c.size * (stalkerSample.mode === 'bristle' ? 0.44 : 0.32);
      fgCtx.strokeStyle = `rgba(255, 92, 160, ${0.42 + 0.28 * glowAlpha})`;
      fgCtx.lineWidth = 1.9;
      const angles = [-2.4, -2.02, -1.62, -1.24, -0.86];
      for (let r = 0; r < angles.length; r++) {
        const ang = angles[r];
        fgCtx.beginPath();
        fgCtx.moveTo(gx + Math.cos(ang) * (c.size * 0.08), gy + Math.sin(ang) * (c.size * 0.08));
        fgCtx.lineTo(gx + Math.cos(ang) * rayLen, gy + Math.sin(ang) * rayLen);
        fgCtx.stroke();
      }
    }
    fgCtx.restore();
  }

  if (c.webglRenderer) {
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: sCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + staggerDy,
      widthPx: sf.w * drawScale,
      heightPx: sf.h * drawScale,
      anchorOffsetXPx: sf.anchorX * drawScale,
      anchorOffsetYPx: sf.bottomY * drawScale,
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

    if (prevCanvas) {
      baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
      baseCtx.drawImage(
        prevCanvas,
        -sf.anchorX * drawScale,
        -sf.bottomY * drawScale,
        sf.w * drawScale,
        sf.h * drawScale,
      );
      baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
    }

    baseCtx.drawImage(
      sCanvas,
      -sf.anchorX * drawScale,
      -sf.bottomY * drawScale,
      sf.w * drawScale,
      sf.h * drawScale,
    );
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;

    if (
      (c.ea && c.ea.flashTimer > 0) ||
      (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
      c.enemyCutIn.flashRgba
    ) {
      baseCtx.globalCompositeOperation = 'lighter';
      if (c.enemyCutIn.flashRgba) {
        drawCanvas2DCutInFlash(baseCtx, c.enemyCutIn.flashRgba, c.size * 0.36, -c.size * 0.44);
      } else if (c.ea && c.ea.flashTimer > 0) {
        baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
        baseCtx.beginPath();
        baseCtx.arc(0, -c.size * 0.44, c.size * 0.34, 0, Math.PI * 2);
        baseCtx.fill();
      }
      if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
        baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
        baseCtx.beginPath();
        baseCtx.ellipse(2, -c.size * 0.44, c.size * 0.28, c.size * 0.34, 0.2, 0, Math.PI * 2);
        baseCtx.fill();
      }
    }
    baseCtx.restore();
  }

  // Foreground overlays: eyelid full-blink apex + viscous dripping acid-lime slime + scythe slash arcs
  if (!c.tacticalViewActive) {
    if (!c.ea?.dead && blinkClosure > 0.06) {
      renderStalkerBlinkApexEyelid(c.fgCtx, {
        eyeOriginRel: sf.eyeOriginRel,
        projParams,
        blinkClosure,
        drawScale,
        scaleX: effectiveScaleX,
        scaleY: effectiveScaleY,
        koAlpha: c.koAlpha,
      });
    }

    if (stalkerJuice) {
      renderStalkerSlimeDrips(c.fgCtx, {
        juice: stalkerJuice,
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
      renderStalkerScytheSlashArcs(c.fgCtx, {
        clawOriginRel: sf.clawOriginRel,
        projParams,
        size: c.size,
        clawSlashProgress: slashProg,
        koAlpha: c.koAlpha,
      });
    }
  }
}
