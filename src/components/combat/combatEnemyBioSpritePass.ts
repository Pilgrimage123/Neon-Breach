import {
  BRUTE_CANONICAL_HEIGHT,
  type BruteFrameSample,
} from '../../utils/bruteSpriteSheet';
import {
  SPITTER_CANONICAL_HEIGHT,
  type SpitterFrameSample,
} from '../../utils/spitterSpriteSheet';
import { renderSpitterGroundPuddle } from './combatDecalRenderer';
import type { CoreEnemySpriteContext } from './combatEnemyCoreSpritePass';
import { renderSpitterBileTorrent } from './combatForegroundFxRenderer';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import { hexToRgba } from './mutantBlood';
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
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const gx = spitterWorldX + sf.pustuleOriginRel.dx * drawScale * -juiceFacing;
    const gy = c.enemyGroundY + hopY + sf.pustuleOriginRel.dy * drawScale;
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
        const ang = angles[r];
        fgCtx.beginPath();
        fgCtx.moveTo(gx + Math.cos(ang) * (c.size * 0.06), gy + Math.sin(ang) * (c.size * 0.06));
        fgCtx.lineTo(gx + Math.cos(ang) * sprayLen, gy + Math.sin(ang) * sprayLen);
        fgCtx.stroke();
      }
    }
    fgCtx.restore();
  }

  const blendA = spitterSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && spitterSample.prevFrameIndex !== spitterSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[spitterSample.prevFrameIndex] : null;

  if (c.webglRenderer) {
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
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: spCanvas,
      secondarySource: prevCanvas,
      worldX: spitterWorldX,
      worldY: c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45),
      widthPx: sf.w * drawScale,
      heightPx: sf.h * drawScale,
      anchorOffsetXPx: sf.anchorX * drawScale,
      anchorOffsetYPx: sf.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad: !c.ea?.dead ? c.stagger.rot * 0.32 + juiceRot + c.enemyCutIn.leanRad : 0,
      alpha: c.koAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
  } else {
    const { baseCtx } = c;
    baseCtx.save();
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;
    baseCtx.translate(spitterWorldX, c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45));
    if (!c.ea?.dead) {
      baseCtx.rotate(c.stagger.rot * 0.32 + juiceRot + c.enemyCutIn.leanRad);
    }
    const scaleX =
      (spitterJuice
        ? c.stagger.scaleXMul * spitterJuice.springScaleX
        : c.breathScaleX * spitterSample.breathScaleX) * c.enemyCutIn.scaleX;
    const scaleY =
      (spitterJuice
        ? c.stagger.scaleYMul * spitterJuice.springScaleY
        : c.breathScaleY * spitterSample.breathScaleY) * c.enemyCutIn.scaleY;
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
    const headDeformDx = spitterJuice ? spitterJuice.deform.head.dx * drawScale * juiceFacing : 0;
    const headDeformDy = spitterJuice ? spitterJuice.deform.head.dy * drawScale : 0;
    const mouthX = spitterWorldX + sf.mouthOriginRel.dx * drawScale * -juiceFacing + headDeformDx;
    const mouthY = c.enemyGroundY + hopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
    renderSpitterBileTorrent(c.fgCtx, c.sim, {
      mouthX,
      mouthY,
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

export function renderBruteEnemySprite(
  c: CoreEnemySpriteContext,
  bruteSample: BruteFrameSample,
): void {
  const frames = c.sim.bruteFrames;
  if (!frames) return;
  const bruteJuice = c.sim.bruteJuiceSamples?.get(c.enemy.id);
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
  const { fgCtx } = c;

  if (bruteSample.vialGlowIntensity > 0.32 && !c.ea?.dead && !c.tacticalViewActive) {
    const vialAlpha = Math.min(0.68, (bruteSample.vialGlowIntensity - 0.25) * 0.85);
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const gx = c.spriteX + bf.vialOriginRel.dx * drawScale * -juiceFacing;
    const gy = c.enemyGroundY + hopY + bf.vialOriginRel.dy * drawScale;
    const vRad =
      c.size * (bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace' ? 0.38 : 0.22);
    const vGrad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, vRad);
    vGrad.addColorStop(0, `rgba(74, 222, 128, ${vialAlpha})`);
    vGrad.addColorStop(0.5, `rgba(34, 197, 94, ${vialAlpha * 0.48})`);
    vGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    fgCtx.fillStyle = vGrad;
    fgCtx.beginPath();
    fgCtx.arc(gx, gy, vRad, 0, Math.PI * 2);
    fgCtx.fill();

    if (bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace') {
      fgCtx.fillStyle = `rgba(134, 239, 172, ${0.5 + 0.35 * vialAlpha})`;
      for (let d = 0; d < 4; d++) {
        const ang = -Math.PI * 0.8 + d * 0.55 + c.elapsed * 3.2;
        const dist = c.size * (0.09 + 0.05 * Math.sin(c.elapsed * 8 + d));
        fgCtx.beginPath();
        fgCtx.arc(gx + Math.cos(ang) * dist, gy + Math.sin(ang) * dist, 2.6, 0, Math.PI * 2);
        fgCtx.fill();
      }
    }
    fgCtx.restore();
  }

  if (bruteSample.shellGlowIntensity > 0.32 && !c.ea?.dead && !c.tacticalViewActive) {
    const shellAlpha = Math.min(0.72, (bruteSample.shellGlowIntensity - 0.25) * 0.88);
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const sx = c.spriteX + bf.shellOriginRel.dx * drawScale * -juiceFacing;
    const sy = c.enemyGroundY + hopY + bf.shellOriginRel.dy * drawScale;
    const sRad =
      c.size *
      (bruteSample.mode === 'staggerHover' ||
      bruteSample.mode === 'heavySmash' ||
      bruteJuice?.activeTrigger === 'seismic_smash'
        ? 0.46
        : 0.34);
    const sGrad = fgCtx.createRadialGradient(sx, sy, 2, sx, sy, sRad);
    sGrad.addColorStop(0, `rgba(250, 204, 21, ${shellAlpha * 0.9})`);
    sGrad.addColorStop(0.45, `rgba(251, 146, 60, ${shellAlpha * 0.52})`);
    sGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    fgCtx.fillStyle = sGrad;
    fgCtx.beginPath();
    fgCtx.arc(sx, sy, sRad, 0, Math.PI * 2);
    fgCtx.fill();

    if (
      bruteSample.mode === 'heavyPrimed' ||
      bruteSample.mode === 'staggerHover' ||
      bruteSample.mode === 'heavySmash' ||
      bruteJuice?.activeTrigger === 'seismic_smash' ||
      ((bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace') &&
        bruteSample.frameIndex === 6)
    ) {
      const rayLen =
        c.size *
        (bruteSample.mode === 'heavySmash' || bruteJuice?.activeTrigger === 'seismic_smash'
          ? 0.38
          : 0.28);
      fgCtx.strokeStyle = `rgba(253, 186, 116, ${0.42 + 0.3 * shellAlpha})`;
      fgCtx.lineWidth = 2;
      const angles = [-2.25, -1.8, -1.3, -0.82];
      for (let r = 0; r < angles.length; r++) {
        const ang = angles[r];
        fgCtx.beginPath();
        fgCtx.moveTo(sx + Math.cos(ang) * (c.size * 0.08), sy + Math.sin(ang) * (c.size * 0.08));
        fgCtx.lineTo(sx + Math.cos(ang) * rayLen, sy + Math.sin(ang) * rayLen);
        fgCtx.stroke();
      }
    }
    fgCtx.restore();
  }

  if (bruteSample.shockwaveIntensity > 0.08 && !c.ea?.dead && !c.tacticalViewActive) {
    const sw = bruteSample.shockwaveIntensity;
    const ix = c.spriteX + bf.impactOriginRel.dx * drawScale * -juiceFacing;
    const iy = c.enemyGroundY + 2;
    fgCtx.save();
    fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.78 * Math.min(1, sw)})`;
    fgCtx.lineWidth = 3 * Math.min(1.3, sw);
    fgCtx.beginPath();
    fgCtx.ellipse(
      ix,
      iy,
      c.size * (0.28 + (1 - Math.min(1, sw)) * 0.34),
      10 + (1 - Math.min(1, sw)) * 8,
      0,
      0,
      Math.PI * 2,
    );
    fgCtx.stroke();

    fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.62 * Math.min(1, sw)})`;
    fgCtx.lineWidth = 1.6;
    fgCtx.beginPath();
    fgCtx.ellipse(
      ix,
      iy,
      c.size * (0.16 + (1 - Math.min(1, sw)) * 0.22),
      6 + (1 - Math.min(1, sw)) * 5,
      0,
      0,
      Math.PI * 2,
    );
    fgCtx.stroke();
    fgCtx.restore();
  }

  const blendA = bruteSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && bruteSample.prevFrameIndex !== bruteSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[bruteSample.prevFrameIndex] : null;

  if (c.webglRenderer) {
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
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: bCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45),
      widthPx: bf.w * drawScale,
      heightPx: bf.h * drawScale,
      anchorOffsetXPx: bf.anchorX * drawScale,
      anchorOffsetYPx: bf.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad: !c.ea?.dead ? c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad : 0,
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
