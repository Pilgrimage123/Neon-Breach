import {
  BRUTE_CANONICAL_HEIGHT,
  type BruteAnimMode,
  type BruteFrameSample,
  type BruteSpriteFrame,
} from '../../utils/bruteSpriteSheet';
import type { BruteJuiceSample } from '../../utils/bruteJuiceController';
import {
  SPITTER_CANONICAL_HEIGHT,
  type SpitterFrameSample,
} from '../../utils/spitterSpriteSheet';
import { renderSpitterGroundPuddle } from './combatDecalRenderer';
import type { CoreEnemySpriteContext } from './combatEnemyCoreSpritePass';
import { renderSpitterBileTorrent } from './combatForegroundFxRenderer';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import { hexToRgba } from './mutantBlood';
import {
  type ControlPointDeform,
  type SpriteLandmarkProjectionParams,
  createIdentityControlPoints,
  projectSpriteLandmarkToStage,
} from './stageMeshMath';
import { deriveEnemyDeformAndUniforms } from './stageSpriteAdapter';

export interface BioEnemySpriteExtra {
  groundY: number;
  heroCutInDrawX: number;
  heroTargetHeight: number;
  baseScale: number;
}

export function renderSpitterEnemySprite(
  c: CoreEnemySpriteContext,
  spitterSample: SpitterFrameSample,
  extra: BioEnemySpriteExtra,
): void {
  const frames = c.sim.spitterFrames;
  if (!frames) return;
  const spitterJuice = c.sim.spitterJuiceSamples?.get(c.enemy.id);
  const spCanvas = frames[spitterSample.frameIndex] ?? frames[0];
  if (!spCanvas) return;

  const sf = spitterSample.frame;
  const pf = spitterSample.prevFrame;
  const drawScale = c.size / SPITTER_CANONICAL_HEIGHT;
  const juiceHopY = spitterJuice
    ? spitterJuice.hopYPx * drawScale
    : spitterSample.yHopPx * drawScale;
  const juiceRot = spitterJuice ? spitterJuice.rotationRad : spitterSample.tiltRad;
  const juiceFacing = spitterJuice ? spitterJuice.facingScale : -1;
  const spitterWorldX = c.spriteX;
  const hopY = c.ea?.dead ? 0 : juiceHopY;
  const windupProg = spitterJuice?.spitWindupProgress ?? 0;
  const streamProg = Math.max(
    spitterSample.spitStreamProgress,
    spitterJuice?.spitStreamProgress ?? 0,
  );

  const staggerDy = c.ea?.dead ? 0 : c.stagger.dy * 0.45;
  const rotationRad = !c.ea?.dead ? c.stagger.rot * 0.32 + juiceRot + c.enemyCutIn.leanRad : 0;
  const blendA = spitterSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && spitterSample.prevFrameIndex !== spitterSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[spitterSample.prevFrameIndex] : null;

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: c.enemy.archetype,
    idx: c.idx,
    ea: c.ea,
    isDead: c.isDead,
    staggerShearPx: c.stagger.shearPx,
    staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
    breathScaleX: spitterJuice ? c.stagger.scaleXMul : c.breathScaleX * spitterSample.breathScaleX,
    breathScaleY: spitterJuice ? c.stagger.scaleYMul : c.breathScaleY * spitterSample.breathScaleY,
    frameBlendAlpha: canCrossBlend ? blendA : 1,
    bioEmissiveRgb: c.bioEmissiveRgb,
    isPrimedOrCharging: c.isPrimedOrCharging,
    isAcidOrPustuleActive: c.isAcidOrPustuleActive,
    isStaggeredStatus: Boolean(c.enemy.staggered),
    elapsed: c.elapsed,
    tacticalViewActive: c.tacticalViewActive,
    spitterJuice,
    cutIn: c.enemyCutIn,
    facingSign: juiceFacing,
  });

  const spitterProjParams: SpriteLandmarkProjectionParams = {
    frame: sf,
    worldX: spitterWorldX,
    worldY: c.enemyGroundY + hopY + staggerDy,
    drawScale,
    facingSign: juiceFacing,
    rotationRad,
    deform: c.webglRenderer ? deform : createIdentityControlPoints(),
    squashStretch: uniforms.squashStretch,
    shearPx: c.webglRenderer ? uniforms.shearPx : [0, 0],
    swayAmpPx: c.webglRenderer ? uniforms.swayAmpPx : 0,
    swayPhase: c.webglRenderer ? uniforms.swayPhase : 0,
  };

  renderSpitterGroundPuddle(
    c.baseCtx,
    c.ex + (spitterWorldX - c.ex) * 0.28,
    c.enemyGroundY + 1,
    c.size,
    c.koAlpha,
    spitterSample.pustuleGlowIntensity,
    Math.max(windupProg, streamProg),
    c.elapsed,
    c.idx,
  );

  if (spitterSample.pustuleGlowIntensity > 0.45 && !c.ea?.dead && !c.tacticalViewActive) {
    const { fgCtx } = c;
    const glowAlpha = Math.min(0.74, (spitterSample.pustuleGlowIntensity - 0.3) * 0.92);
    const pustulePos = projectSpriteLandmarkToStage(sf.pustuleOriginRel, spitterProjParams);
    const gx = pustulePos.x;
    const gy = pustulePos.y;
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const rad =
      c.size *
      (spitterSample.mode === 'rupture' || spitterSample.frameIndex === 10 ? 0.46 : 0.36);
    const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    grad.addColorStop(0, `rgba(254, 240, 138, ${glowAlpha})`);
    grad.addColorStop(0.45, `rgba(163, 230, 53, ${glowAlpha * 0.52})`);
    grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
    fgCtx.fillStyle = grad;
    fgCtx.beginPath();
    fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    fgCtx.fill();

    if (
      spitterSample.mode === 'rupture' ||
      (spitterSample.mode === 'guard' && spitterSample.frameIndex === 10)
    ) {
      const sprayLen = c.size * (spitterSample.mode === 'rupture' ? 0.36 : 0.28);
      fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.44 + 0.3 * glowAlpha})`;
      fgCtx.lineWidth = 1.8;
      const angles = [-2.55, -2.18, -1.78, -1.38];
      for (let r = 0; r < angles.length; r++) {
        const ang = juiceFacing > 0 ? Math.PI - angles[r] : angles[r];
        fgCtx.beginPath();
        fgCtx.moveTo(gx + Math.cos(ang) * (c.size * 0.06), gy + Math.sin(ang) * (c.size * 0.06));
        fgCtx.lineTo(gx + Math.cos(ang) * sprayLen, gy + Math.sin(ang) * sprayLen);
        fgCtx.stroke();
      }
    }
    fgCtx.restore();
  }

  if (c.webglRenderer) {
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: spCanvas,
      secondarySource: prevCanvas,
      worldX: spitterWorldX,
      worldY: c.enemyGroundY + hopY + staggerDy,
      widthPx: sf.w * drawScale,
      heightPx: sf.h * drawScale,
      anchorOffsetXPx: sf.anchorX * drawScale,
      anchorOffsetYPx: sf.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad,
      alpha: c.koAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
  } else {
    const { baseCtx } = c;
    baseCtx.save();
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;
    baseCtx.translate(spitterWorldX, c.enemyGroundY + hopY + staggerDy);
    if (!c.ea?.dead) {
      baseCtx.rotate(rotationRad);
    }
    const scaleX = uniforms.squashStretch[0];
    const scaleY = uniforms.squashStretch[1];
    baseCtx.scale(juiceFacing * scaleX, scaleY);

    if (prevCanvas) {
      baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, (1 - blendA) * 0.5);
      baseCtx.drawImage(
        prevCanvas,
        -pf.anchorX * drawScale,
        -pf.bottomY * drawScale,
        pf.w * drawScale,
        pf.h * drawScale,
      );
      baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
    }

    baseCtx.drawImage(
      spCanvas,
      -sf.anchorX * drawScale,
      -sf.bottomY * drawScale,
      sf.w * drawScale,
      sf.h * drawScale,
    );
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;

    if (!c.ea?.dead && Math.abs(c.stagger.shearPx) > 0.5) {
      baseCtx.save();
      baseCtx.beginPath();
      baseCtx.rect(
        -sf.w * drawScale * 0.55,
        -sf.bottomY * drawScale,
        sf.w * drawScale * 1.1,
        sf.h * drawScale * 0.48,
      );
      baseCtx.clip();
      baseCtx.translate(-c.stagger.shearPx, -2);
      baseCtx.drawImage(
        spCanvas,
        -sf.anchorX * drawScale,
        -sf.bottomY * drawScale,
        sf.w * drawScale,
        sf.h * drawScale,
      );
      baseCtx.restore();
    }

    if (
      (c.ea && c.ea.flashTimer > 0) ||
      (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
      spitterJuice?.flashRgba ||
      c.enemyCutIn.flashRgba
    ) {
      baseCtx.globalCompositeOperation = 'lighter';
      const flashRgb = c.enemyCutIn.flashRgba ?? spitterJuice?.flashRgba;
      if (flashRgb) {
        drawCanvas2DCutInFlash(baseCtx, flashRgb, c.size * 0.36, -c.size * 0.44);
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

  if (!c.ea?.dead && !c.tacticalViewActive && (windupProg > 0.02 || streamProg > 0.01)) {
    const mouthPos = projectSpriteLandmarkToStage(sf.mouthOriginRel, spitterProjParams);
    renderSpitterBileTorrent(c.fgCtx, c.sim, {
      mouthX: mouthPos.x,
      mouthY: mouthPos.y,
      targetX: extra.heroCutInDrawX + 18 * extra.baseScale,
      targetY: extra.groundY - extra.heroTargetHeight * 0.48,
      groundY: extra.groundY,
      baseScale: extra.baseScale,
      windupProgress: windupProg,
      streamProgress: streamProg,
      elapsed: c.elapsed,
      seed: c.idx,
    });
  }
}

export interface BruteBioVfxParams {
  fgCtx: CanvasRenderingContext2D;
  frame: BruteSpriteFrame;
  frameIndex: number;
  mode: BruteAnimMode;
  spriteX: number;
  enemyGroundY: number;
  hopY: number;
  staggerDy?: number;
  size: number;
  drawScale: number;
  facingSign: number;
  rotationRad?: number;
  deform?: ControlPointDeform;
  squashStretch?: readonly [number, number];
  shearPx?: readonly [number, number];
  swayAmpPx?: number;
  swayPhase?: number;
  vialGlowIntensity: number;
  shellGlowIntensity: number;
  shockwaveIntensity: number;
  clawSlashProgress: number;
  mutagenMistProgress: number;
  seismicImpactProgress: number;
  waistDeformDx?: number;
  waistDeformDy?: number;
  headDeformDx?: number;
  headDeformDy?: number;
  elapsed: number;
  seed: number;
}

export function renderBruteBioVfxOverlay(params: BruteBioVfxParams): void {
  const {
    fgCtx,
    frame: bf,
    frameIndex,
    mode,
    spriteX,
    enemyGroundY,
    hopY,
    staggerDy = 0,
    size,
    drawScale,
    facingSign,
    rotationRad = 0,
    deform,
    squashStretch = [1, 1],
    shearPx = [0, 0],
    swayAmpPx = 0,
    swayPhase = 0,
    vialGlowIntensity,
    shellGlowIntensity,
    shockwaveIntensity,
    clawSlashProgress,
    mutagenMistProgress,
    seismicImpactProgress,
    elapsed,
    seed,
  } = params;

  const facingMirror = -facingSign; // +1 when facing left toward Hero, -1 when flipped right
  const anchorWorldY = enemyGroundY + hopY + staggerDy;
  const projParams: SpriteLandmarkProjectionParams = {
    frame: bf,
    worldX: spriteX,
    worldY: anchorWorldY,
    drawScale,
    facingSign,
    rotationRad,
    deform,
    squashStretch,
    shearPx,
    swayAmpPx,
    swayPhase,
  };
  const isBracing = mode === 'brace';
  const isArmorPrimed = mode === 'armorPrimed';
  const isArmoredGuard = mode === 'armoredGuard';
  const isHeavyPrimed = mode === 'heavyPrimed';
  const isStaggerHover = mode === 'staggerHover';
  const isHeavySmash = mode === 'heavySmash';

  // 1. Mutagen Vial Capsules, Bio-Vein Filaments & Rising Vapor Plumes
  if (vialGlowIntensity > 0.3 || mutagenMistProgress > 0.05) {
    const vialAlpha = Math.min(0.76, Math.max(0.12, (vialGlowIntensity - 0.22) * 0.92));
    const vialPos = projectSpriteLandmarkToStage(bf.vialOriginRel, projParams);
    const gx = vialPos.x;
    const gy = vialPos.y;
    const vRad = size * (isBracing ? 0.36 : isArmorPrimed || isArmoredGuard ? 0.28 : 0.21);

    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';

    // Subsurface emerald chest glow
    const vGrad = fgCtx.createRadialGradient(gx, gy, 1.5, gx, gy, vRad);
    vGrad.addColorStop(0, `rgba(187, 247, 208, ${vialAlpha * 0.92})`);
    vGrad.addColorStop(0.38, `rgba(74, 222, 128, ${vialAlpha * 0.64})`);
    vGrad.addColorStop(0.75, `rgba(22, 163, 74, ${vialAlpha * 0.28})`);
    vGrad.addColorStop(1, 'rgba(22, 163, 74, 0)');
    fgCtx.fillStyle = vGrad;
    fgCtx.beginPath();
    fgCtx.arc(gx, gy, vRad, 0, Math.PI * 2);
    fgCtx.fill();

    // Dual angled glass vial capsules in chest pocket
    const capsuleH = Math.max(5.5, 9.5 * drawScale);
    const capsuleW = Math.max(2.2, 3.6 * drawScale);
    for (let v = -1; v <= 1; v += 2) {
      const vx = gx + v * 3.8 * drawScale;
      const vy = gy + v * 1.1 * drawScale;
      fgCtx.save();
      fgCtx.translate(vx, vy);
      fgCtx.rotate(facingMirror * 0.24 + v * 0.08 + vialPos.knotRotRad);
      fgCtx.fillStyle = `rgba(74, 222, 128, ${Math.min(0.95, vialAlpha * 1.15)})`;
      fgCtx.beginPath();
      fgCtx.ellipse(0, 0, capsuleW, capsuleH * 0.5, 0, 0, Math.PI * 2);
      fgCtx.fill();

      fgCtx.fillStyle = `rgba(240, 253, 244, ${Math.min(0.96, vialAlpha * 1.25)})`;
      fgCtx.beginPath();
      fgCtx.ellipse(-capsuleW * 0.22, -capsuleH * 0.08, capsuleW * 0.38, capsuleH * 0.34, 0, 0, Math.PI * 2);
      fgCtx.fill();
      fgCtx.restore();
    }

    // Branching emerald bio-vein filaments across chest & forearms
    if (isBracing || isArmorPrimed || isArmoredGuard || vialGlowIntensity > 0.58) {
      const veinAlpha = Math.min(0.88, (vialGlowIntensity - 0.35) * 1.15);
      const veinDirs = [
        { ax: -18, ay: -14, bx: -34, by: -6 },
        { ax: 14, ay: -18, bx: 28, by: -30 },
        { ax: -12, ay: 15, bx: -24, by: 28 },
        { ax: 16, ay: 12, bx: 30, by: 22 },
      ] as const;
      fgCtx.lineCap = 'round';
      fgCtx.lineJoin = 'round';
      for (let i = 0; i < veinDirs.length; i++) {
        const vd = veinDirs[i];
        const pulse = 0.65 + 0.35 * Math.sin(elapsed * 7.5 + i * 1.7 + seed);
        const jitter = Math.sin(elapsed * 14 + i * 2.3) * 2.2 * drawScale;
        const p1x = gx + vd.ax * drawScale * facingMirror + jitter;
        const p1y = gy + vd.ay * drawScale - jitter * 0.6;
        const p2x = gx + vd.bx * drawScale * facingMirror;
        const p2y = gy + vd.by * drawScale;

        fgCtx.strokeStyle = `rgba(34, 197, 94, ${veinAlpha * pulse * 0.85})`;
        fgCtx.lineWidth = 2.6 * drawScale;
        fgCtx.beginPath();
        fgCtx.moveTo(gx, gy);
        fgCtx.lineTo(p1x, p1y);
        fgCtx.lineTo(p2x, p2y);
        fgCtx.stroke();

        fgCtx.strokeStyle = `rgba(220, 252, 231, ${veinAlpha * pulse * 0.92})`;
        fgCtx.lineWidth = 1.1 * drawScale;
        fgCtx.beginPath();
        fgCtx.moveTo(gx, gy);
        fgCtx.lineTo(p1x, p1y);
        fgCtx.lineTo(p2x * 0.4 + p1x * 0.6, p2y * 0.4 + p1y * 0.6);
        fgCtx.stroke();
      }
    }

    // Curling mutagen vapor wisps & buoyant micro-bubbles
    if (isBracing || isArmorPrimed || mutagenMistProgress > 0.05 || vialGlowIntensity > 0.52) {
      const wispStrength = Math.max(mutagenMistProgress, (vialGlowIntensity - 0.4) * 1.3);
      for (let w = 0; w < 5; w++) {
        const phase = (elapsed * (1.35 + w * 0.18) + w * 0.21 + seed * 0.17) % 1;
        const env = Math.sin(phase * Math.PI);
        const startX = gx + (w - 2) * 6.5 * drawScale;
        const startY = gy + 4 * drawScale;
        const riseH = (16 + w * 5) * phase * drawScale;
        const curlX = Math.sin(phase * 5.2 + elapsed * 3.6 + w) * 9.5 * drawScale;
        const tipX = startX + curlX - facingMirror * 4 * phase * drawScale;
        const tipY = startY - riseH;

        fgCtx.strokeStyle =
          w % 2 === 0
            ? `rgba(134, 239, 172, ${0.52 * env * wispStrength})`
            : `rgba(74, 222, 128, ${0.44 * env * wispStrength})`;
        fgCtx.lineWidth = (2.8 - phase * 1.4) * drawScale;
        fgCtx.beginPath();
        fgCtx.moveTo(startX, startY);
        fgCtx.quadraticCurveTo(startX - curlX * 0.6, startY - riseH * 0.52, tipX, tipY);
        fgCtx.stroke();

        fgCtx.fillStyle = `rgba(220, 252, 231, ${0.72 * env * wispStrength})`;
        fgCtx.beginPath();
        fgCtx.arc(tipX, tipY, (1.5 + (w % 2) * 0.8) * (1 - phase * 0.35) * drawScale, 0, Math.PI * 2);
        fgCtx.fill();
      }
    }

    fgCtx.restore();
  }

  // 2. Dorsal Carapace Thermal Vents, Curved Flame Plumes & Rising Ember Sparks
  if (shellGlowIntensity > 0.3) {
    const shellAlpha = Math.min(0.8, Math.max(0.12, (shellGlowIntensity - 0.22) * 0.94));
    const shellPos = projectSpriteLandmarkToStage(bf.shellOriginRel, projParams);
    const sx = shellPos.x;
    const sy = shellPos.y;
    const isThermalActive =
      isHeavyPrimed ||
      isStaggerHover ||
      isHeavySmash ||
      (isBracing && frameIndex === 6) ||
      shellGlowIntensity > 0.62;
    const sRad = size * (isHeavySmash || isStaggerHover ? 0.44 : isThermalActive ? 0.38 : 0.3);

    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';

    // Warm dorsal subsurface heat aura
    const sGrad = fgCtx.createRadialGradient(sx, sy, 2, sx, sy, sRad);
    sGrad.addColorStop(0, `rgba(254, 240, 138, ${shellAlpha * 0.88})`);
    sGrad.addColorStop(0.4, `rgba(251, 146, 60, ${shellAlpha * 0.56})`);
    sGrad.addColorStop(0.78, `rgba(234, 88, 12, ${shellAlpha * 0.24})`);
    sGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    fgCtx.fillStyle = sGrad;
    fgCtx.beginPath();
    fgCtx.arc(sx, sy, sRad, 0, Math.PI * 2);
    fgCtx.fill();

    // Contoured dorsal carapace rim arc hugging the arched spine plates
    const rimSpan = size * 0.24;
    fgCtx.lineCap = 'round';
    fgCtx.strokeStyle = `rgba(253, 186, 116, ${shellAlpha * 0.68})`;
    fgCtx.lineWidth = 3.2 * drawScale;
    fgCtx.beginPath();
    fgCtx.moveTo(sx - facingMirror * rimSpan * 0.45, sy - rimSpan * 0.42);
    fgCtx.quadraticCurveTo(
      sx + facingMirror * rimSpan * 0.38,
      sy - rimSpan * 0.46,
      sx + facingMirror * rimSpan * 0.60,
      sy + rimSpan * 0.48,
    );
    fgCtx.stroke();

    // 5 dorsal chitin-seam vents with curved quadratic-Bezier thermal plumes & embers
    const ventOffsets = [
      { dx: -14, dy: -22, ang: -1.35, scale: 0.82 },
      { dx: -2, dy: -18, ang: -1.08, scale: 1.0 },
      { dx: 10, dy: -10, ang: -0.82, scale: 1.08 },
      { dx: 18, dy: 2, ang: -0.52, scale: 0.92 },
      { dx: 22, dy: 16, ang: -0.24, scale: 0.75 },
    ] as const;

    for (let v = 0; v < ventOffsets.length; v++) {
      const vo = ventOffsets[v];
      const vx = sx + vo.dx * drawScale * facingMirror;
      const vy = sy + vo.dy * drawScale;
      const flicker = 0.72 + 0.28 * Math.sin(elapsed * 11.5 + v * 1.9 + seed);

      // Chitin seam incandescent node
      fgCtx.fillStyle = `rgba(254, 249, 195, ${shellAlpha * flicker * 0.86})`;
      fgCtx.beginPath();
      fgCtx.arc(vx, vy, 2.4 * vo.scale * drawScale, 0, Math.PI * 2);
      fgCtx.fill();

      if (isThermalActive) {
        const plumeLen =
          size * (isHeavySmash ? 0.22 : 0.165) * vo.scale * (0.84 + 0.16 * flicker);
        const wave = Math.sin(elapsed * 14 + v * 2.1 + seed) * 7.5 * drawScale;
        const dirX = Math.cos(vo.ang) * facingMirror;
        const dirY = Math.sin(vo.ang);
        const tipX = vx + dirX * plumeLen + wave * 0.45;
        const tipY = vy + dirY * plumeLen - Math.abs(wave) * 0.25;
        const ctrlX = vx + dirX * plumeLen * 0.52 - dirY * wave;
        const ctrlY = vy + dirY * plumeLen * 0.52 + dirX * wave * 0.5;
        const baseHalfW = 4.2 * vo.scale * drawScale;
        const perpX = -dirY * baseHalfW;
        const perpY = dirX * baseHalfW;

        // Outer amber-orange flame tongue
        fgCtx.fillStyle = `rgba(251, 146, 60, ${shellAlpha * flicker * 0.74})`;
        fgCtx.beginPath();
        fgCtx.moveTo(vx + perpX, vy + perpY);
        fgCtx.quadraticCurveTo(ctrlX + perpX * 0.45, ctrlY + perpY * 0.45, tipX, tipY);
        fgCtx.quadraticCurveTo(ctrlX - perpX * 0.45, ctrlY - perpY * 0.45, vx - perpX, vy - perpY);
        fgCtx.closePath();
        fgCtx.fill();

        // Inner incandescent yellow-white thermal core
        fgCtx.strokeStyle = `rgba(254, 240, 138, ${shellAlpha * flicker * 0.92})`;
        fgCtx.lineWidth = 1.9 * vo.scale * drawScale;
        fgCtx.beginPath();
        fgCtx.moveTo(vx, vy);
        fgCtx.quadraticCurveTo(ctrlX, ctrlY, vx + (tipX - vx) * 0.72, vy + (tipY - vy) * 0.72);
        fgCtx.stroke();

        // Rising ember spark from vent
        const sparkP = (elapsed * (2.2 + v * 0.35) + v * 0.23 + seed * 0.19) % 1;
        const sparkEnv = Math.sin(sparkP * Math.PI);
        const ex = vx + dirX * (plumeLen * (0.4 + sparkP * 0.95)) + Math.sin(sparkP * 8 + v) * 4 * drawScale;
        const ey = vy + dirY * (plumeLen * (0.4 + sparkP * 0.95)) - sparkP * 10 * drawScale;
        fgCtx.fillStyle = v % 2 === 0 ? '#FEF08A' : '#FB923C';
        fgCtx.globalAlpha = shellAlpha * sparkEnv * 0.92;
        fgCtx.beginPath();
        fgCtx.arc(ex, ey, (1.2 + (v % 2) * 0.7) * drawScale, 0, Math.PI * 2);
        fgCtx.fill();
        fgCtx.globalAlpha = 1;
      }
    }

    fgCtx.restore();
  }

  // 3A. Seismic Carapace Crush Multi-Ring Ground Shockwave & Kinetic Spall Crown
  if (shockwaveIntensity > 0.06 || seismicImpactProgress > 0.01) {
    const sw = Math.min(1.25, Math.max(shockwaveIntensity, Math.sin(seismicImpactProgress * Math.PI)));
    if (sw > 0.05) {
      const prog =
        seismicImpactProgress > 0.01
          ? Math.max(0, Math.min(1, seismicImpactProgress))
          : Math.max(0, Math.min(1, 1 - sw * 0.55));
      const impactPos = projectSpriteLandmarkToStage(bf.impactOriginRel, projParams);
      const ix = impactPos.x;
      const iy = enemyGroundY + 2;
      const outerRx = size * (0.24 + prog * 0.48);
      const outerRy = (8 + prog * 13) * Math.max(0.75, drawScale);
      const innerRx = outerRx * 0.62;
      const innerRy = outerRy * 0.62;

      fgCtx.save();

      // Dust & spall plumes billowing outward along the deck
      for (let d = 0; d < 6; d++) {
        const side = d < 3 ? -1 : 1;
        const tier = d % 3;
        const dx = ix + side * (outerRx * (0.55 + tier * 0.22));
        const dy = iy - (3 + tier * 4 + prog * 8) * drawScale;
        const dr = (7 + tier * 3.5 + prog * 9) * drawScale;
        fgCtx.fillStyle = `rgba(148, 163, 184, ${0.34 * Math.min(1, sw) * (1 - prog * 0.45)})`;
        fgCtx.beginPath();
        fgCtx.arc(dx, dy, dr, 0, Math.PI * 2);
        fgCtx.fill();
      }

      fgCtx.globalCompositeOperation = 'lighter';

      // Molten-amber knuckle impact flash core
      const coreR = size * (0.22 * (1 - prog * 0.45));
      const coreGrad = fgCtx.createRadialGradient(ix, iy - 2, 1, ix, iy - 2, coreR);
      coreGrad.addColorStop(0, `rgba(254, 249, 195, ${0.92 * Math.min(1, sw)})`);
      coreGrad.addColorStop(0.45, `rgba(251, 146, 60, ${0.68 * Math.min(1, sw)})`);
      coreGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      fgCtx.fillStyle = coreGrad;
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy - 2, coreR, coreR * 0.52, 0, 0, Math.PI * 2);
      fgCtx.fill();

      // Outer heavy amber-orange perspective pressure wave
      fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.84 * Math.min(1, sw)})`;
      fgCtx.lineWidth = Math.max(1.8, (4.2 - prog * 1.8) * drawScale);
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy, outerRx, outerRy, 0, 0, Math.PI * 2);
      fgCtx.stroke();

      // Inner incandescent yellow-white shock ring
      fgCtx.strokeStyle = `rgba(254, 240, 138, ${0.88 * Math.min(1, sw)})`;
      fgCtx.lineWidth = Math.max(1.2, (2.4 - prog * 0.9) * drawScale);
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy, innerRx, innerRy, 0, 0, Math.PI * 2);
      fgCtx.stroke();

      // Upward jagged kinetic shock teeth bursting from crater rim
      const spikeAngles = [-2.55, -2.15, -1.78, -1.57, -1.36, -0.98, -0.58] as const;
      for (let k = 0; k < spikeAngles.length; k++) {
        const ang = spikeAngles[k];
        const baseDistX = Math.cos(ang) * innerRx * 0.85;
        const baseDistY = Math.sin(ang) * innerRy * 0.65;
        const spikeLen = (14 + (k % 2) * 8 + prog * 16) * drawScale * Math.min(1.1, sw);
        const sx0 = ix + baseDistX;
        const sy0 = iy + baseDistY;
        const sx1 = sx0 + Math.cos(ang) * spikeLen;
        const sy1 = sy0 + Math.sin(ang) * spikeLen;

        fgCtx.strokeStyle = k % 2 === 0 ? `rgba(254, 240, 138, ${0.86 * Math.min(1, sw)})` : `rgba(251, 146, 60, ${0.78 * Math.min(1, sw)})`;
        fgCtx.lineWidth = (2.2 - prog * 0.8) * drawScale;
        fgCtx.beginPath();
        fgCtx.moveTo(sx0, sy0);
        fgCtx.lineTo(sx1, sy1);
        fgCtx.stroke();
      }

      fgCtx.restore();
    }
  }

  // 3B. Vein-Burst Maw/Claw Triple Crescent Slash Arc
  if (clawSlashProgress > 0.02) {
    const p = Math.max(0, Math.min(1, clawSlashProgress));
    const slashAlpha = Math.sin(p * Math.PI);
    if (slashAlpha > 0.04) {
      const impactPos = projectSpriteLandmarkToStage(bf.impactOriginRel, projParams);
      const cx = impactPos.x;
      const cy = impactPos.y;
      const arcR = size * (0.21 + p * 0.08);
      const startAng = facingSign < 0 ? Math.PI * 0.68 : -Math.PI * 0.32;
      const endAng = facingSign < 0 ? Math.PI * 1.34 : Math.PI * 0.34;

      fgCtx.save();
      fgCtx.globalCompositeOperation = 'lighter';
      fgCtx.lineCap = 'round';

      for (let c = -1; c <= 1; c++) {
        const ox = cx + c * 5.5 * drawScale * facingMirror;
        const oy = cy + c * 9.5 * drawScale;
        const r = arcR * (1 - Math.abs(c) * 0.1);

        fgCtx.strokeStyle = `rgba(34, 197, 94, ${0.55 * slashAlpha})`;
        fgCtx.lineWidth = 6.2 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.84 * slashAlpha})`;
        fgCtx.lineWidth = 3.2 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        fgCtx.strokeStyle = `rgba(254, 249, 195, ${0.95 * slashAlpha})`;
        fgCtx.lineWidth = 1.4 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng + 0.1, endAng - 0.1);
        fgCtx.stroke();
      }

      fgCtx.restore();
    }
  }
}

export function renderBruteEnemySprite(
  c: CoreEnemySpriteContext,
  bruteSample: BruteFrameSample,
): void {
  const frames = c.sim.bruteFrames;
  if (!frames) return;
  const bruteJuice: BruteJuiceSample | undefined = c.sim.bruteJuiceSamples?.get(c.enemy.id);
  const bCanvas = frames[bruteSample.frameIndex] ?? frames[0];
  if (!bCanvas) return;

  const bf = bruteSample.frame;
  const pf = bruteSample.prevFrame;
  const drawScale = c.size / BRUTE_CANONICAL_HEIGHT;
  const juiceHopY = bruteJuice
    ? bruteJuice.hopYPx * drawScale
    : bruteSample.yHopPx * drawScale;
  const juiceRot = bruteJuice ? bruteJuice.rotationRad : bruteSample.tiltRad;
  const juiceFacing = bruteJuice ? bruteJuice.facingScale : -1;
  const hopY = c.ea?.dead ? 0 : juiceHopY;
  const staggerDy = c.ea?.dead ? 0 : c.stagger.dy * 0.45;
  const rotationRad = !c.ea?.dead ? c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad : 0;

  const blendA = bruteSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && bruteSample.prevFrameIndex !== bruteSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[bruteSample.prevFrameIndex] : null;

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: c.enemy.archetype,
    idx: c.idx,
    ea: c.ea,
    isDead: c.isDead,
    staggerShearPx: c.stagger.shearPx,
    staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
    breathScaleX: bruteJuice ? c.stagger.scaleXMul : c.breathScaleX * bruteSample.breathScaleX,
    breathScaleY: bruteJuice ? c.stagger.scaleYMul : c.breathScaleY * bruteSample.breathScaleY,
    frameBlendAlpha: canCrossBlend ? blendA : 1,
    bioEmissiveRgb: c.bioEmissiveRgb,
    isPrimedOrCharging: c.isPrimedOrCharging || bruteSample.shellGlowIntensity > 0.6,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: Boolean(c.enemy.staggered),
    elapsed: c.elapsed,
    tacticalViewActive: c.tacticalViewActive,
    bruteJuice,
    cutIn: c.enemyCutIn,
    facingSign: juiceFacing,
  });

  if (!c.ea?.dead && !c.tacticalViewActive) {
    renderBruteBioVfxOverlay({
      fgCtx: c.fgCtx,
      frame: bf,
      frameIndex: bruteSample.frameIndex,
      mode: bruteJuice ? bruteJuice.mode : bruteSample.mode,
      spriteX: c.spriteX,
      enemyGroundY: c.enemyGroundY,
      hopY,
      staggerDy,
      size: c.size,
      drawScale,
      facingSign: juiceFacing,
      rotationRad,
      deform: c.webglRenderer ? deform : createIdentityControlPoints(),
      squashStretch: uniforms.squashStretch,
      shearPx: c.webglRenderer ? uniforms.shearPx : [0, 0],
      swayAmpPx: c.webglRenderer ? uniforms.swayAmpPx : 0,
      swayPhase: c.webglRenderer ? uniforms.swayPhase : 0,
      vialGlowIntensity: bruteJuice ? bruteJuice.vialGlowIntensity : bruteSample.vialGlowIntensity,
      shellGlowIntensity: bruteJuice ? bruteJuice.shellGlowIntensity : bruteSample.shellGlowIntensity,
      shockwaveIntensity: bruteJuice ? bruteJuice.shockwaveIntensity : bruteSample.shockwaveIntensity,
      clawSlashProgress: bruteJuice ? bruteJuice.clawSlashProgress : bruteSample.clawSlashProgress,
      mutagenMistProgress: bruteJuice ? bruteJuice.mutagenMistProgress : 0,
      seismicImpactProgress: bruteJuice ? bruteJuice.seismicImpactProgress : 0,
      elapsed: c.elapsed,
      seed: c.idx,
    });
  }

  if (c.webglRenderer) {
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: bCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + staggerDy,
      widthPx: bf.w * drawScale,
      heightPx: bf.h * drawScale,
      anchorOffsetXPx: bf.anchorX * drawScale,
      anchorOffsetYPx: bf.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad,
      alpha: c.koAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
    return;
  }

  const { baseCtx } = c;
  baseCtx.save();
  baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;
  baseCtx.translate(c.spriteX, c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45));
  if (!c.ea?.dead) {
    baseCtx.rotate(c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad);
  }
  const scaleX =
    (bruteJuice
      ? c.stagger.scaleXMul * bruteJuice.springScaleX
      : c.breathScaleX * bruteSample.breathScaleX) * c.enemyCutIn.scaleX;
  const scaleY =
    (bruteJuice
      ? c.stagger.scaleYMul * bruteJuice.springScaleY
      : c.breathScaleY * bruteSample.breathScaleY) * c.enemyCutIn.scaleY;
  baseCtx.scale(juiceFacing * scaleX, scaleY);

  if (prevCanvas) {
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
    baseCtx.drawImage(
      prevCanvas,
      -pf.anchorX * drawScale,
      -pf.bottomY * drawScale,
      pf.w * drawScale,
      pf.h * drawScale,
    );
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, 0.85 + blendA * 0.15);
  }

  baseCtx.drawImage(
    bCanvas,
    -bf.anchorX * drawScale,
    -bf.bottomY * drawScale,
    bf.w * drawScale,
    bf.h * drawScale,
  );
  baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;

  if (!c.ea?.dead && Math.abs(c.stagger.shearPx) > 0.5) {
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.rect(
      -bf.w * drawScale * 0.55,
      -bf.bottomY * drawScale,
      bf.w * drawScale * 1.1,
      bf.h * drawScale * 0.48,
    );
    baseCtx.clip();
    baseCtx.translate(-c.stagger.shearPx, -2);
    baseCtx.drawImage(
      bCanvas,
      -bf.anchorX * drawScale,
      -bf.bottomY * drawScale,
      bf.w * drawScale,
      bf.h * drawScale,
    );
    baseCtx.restore();
  }

  if (
    (c.ea && c.ea.flashTimer > 0) ||
    (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
    bruteJuice?.flashRgba ||
    c.enemyCutIn.flashRgba
  ) {
    baseCtx.globalCompositeOperation = 'lighter';
    const flashRgb = c.enemyCutIn.flashRgba ?? bruteJuice?.flashRgba;
    if (flashRgb) {
      drawCanvas2DCutInFlash(baseCtx, flashRgb, c.size * 0.38, -c.size * 0.44);
    } else if (c.ea && c.ea.flashTimer > 0) {
      baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      baseCtx.beginPath();
      baseCtx.arc(0, -c.size * 0.44, c.size * 0.36, 0, Math.PI * 2);
      baseCtx.fill();
    }
    if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
      baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
      baseCtx.beginPath();
      baseCtx.ellipse(2, -c.size * 0.44, c.size * 0.3, c.size * 0.36, 0.2, 0, Math.PI * 2);
      baseCtx.fill();
    }
  }
  baseCtx.restore();
}
