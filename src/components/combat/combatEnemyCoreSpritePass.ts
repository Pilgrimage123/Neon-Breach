import type { EnemyUnit } from '../../engine/types';
import {
  CRAWLER_CANONICAL_HEIGHT,
  type CrawlerFrameSample,
  type CrawlerVariant,
} from '../../utils/crawlerSpriteSheet';
import {
  STALKER_CANONICAL_HEIGHT,
  type StalkerFrameSample,
} from '../../utils/stalkerSpriteSheet';
import type { StaggerKinematics } from './combatEnemyAnimationSim';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import type { ActorAnim, CombatStageSim } from './combatStageTypes';
import { type BloodBiologyProfile, hexToRgba } from './mutantBlood';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type ICharacterStageRenderer,
  deriveEnemyDeformAndUniforms,
} from './stageSpriteAdapter';

export interface CoreEnemySpriteContext {
  baseCtx: CanvasRenderingContext2D;
  fgCtx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  sim: CombatStageSim;
  enemy: EnemyUnit;
  idx: number;
  ea: ActorAnim | undefined;
  isDead: boolean;
  koAlpha: number;
  koOffsetY: number;
  size: number;
  ex: number;
  spriteX: number;
  cutInShiftX: number;
  enemyGroundY: number;
  breathScaleX: number;
  breathScaleY: number;
  stagger: StaggerKinematics;
  canvasBystanderMul: number;
  enemyBio: BloodBiologyProfile;
  bioEmissiveRgb: [number, number, number];
  isPrimedOrCharging: boolean;
  isAcidOrPustuleActive: boolean;
  elapsed: number;
  tacticalViewActive: boolean;
  enemyCutIn: ActorJuiceSnapshot;
}

export function renderCrawlerEnemySprite(
  c: CoreEnemySpriteContext,
  arch: CrawlerVariant,
  crawlerSample: CrawlerFrameSample,
): void {
  const cFrames = c.sim.crawlerFrames.get(arch);
  const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
  if (!cCanvas) return;

  const cf = crawlerSample.frame;
  const drawScale = c.size / CRAWLER_CANONICAL_HEIGHT;
  const crawlerX = c.ex + c.cutInShiftX;

  if (c.webglRenderer) {
    const { deform, uniforms } = deriveEnemyDeformAndUniforms({
      archetype: arch,
      idx: c.idx,
      ea: c.ea,
      isDead: c.isDead,
      staggerShearPx: c.stagger.shearPx,
      staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
      breathScaleX: c.breathScaleX,
      breathScaleY: c.breathScaleY,
      frameBlendAlpha: 1,
      bioEmissiveRgb: c.bioEmissiveRgb,
      isPrimedOrCharging: c.isPrimedOrCharging,
      isAcidOrPustuleActive: c.isAcidOrPustuleActive,
      isStaggeredStatus: Boolean(c.enemy.staggered),
      elapsed: c.elapsed,
      tacticalViewActive: c.tacticalViewActive,
      cutIn: c.enemyCutIn,
      facingSign: 1,
    });
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: cCanvas,
      worldX: crawlerX,
      worldY: c.enemyGroundY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45),
      widthPx: cf.w * drawScale,
      heightPx: cf.h * drawScale,
      anchorOffsetXPx: cf.anchorX * drawScale,
      anchorOffsetYPx: cf.bottomY * drawScale,
      facingSign: 1,
      rotationRad: !c.ea?.dead ? c.stagger.rot * 0.35 + c.enemyCutIn.leanRad : 0,
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
  baseCtx.translate(crawlerX, c.enemyGroundY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45));
  if (!c.ea?.dead) {
    baseCtx.rotate(c.stagger.rot * 0.35 + c.enemyCutIn.leanRad);
  }
  baseCtx.scale(c.breathScaleX * c.enemyCutIn.scaleX, c.breathScaleY * c.enemyCutIn.scaleY);
  baseCtx.drawImage(
    cCanvas,
    -cf.anchorX * drawScale,
    -cf.bottomY * drawScale,
    cf.w * drawScale,
    cf.h * drawScale,
  );

  if (
    (c.ea && c.ea.flashTimer > 0) ||
    (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
    c.enemyCutIn.flashRgba
  ) {
    baseCtx.globalCompositeOperation = 'lighter';
    if (c.enemyCutIn.flashRgba) {
      drawCanvas2DCutInFlash(baseCtx, c.enemyCutIn.flashRgba, c.size * 0.36, -c.size * 0.42);
    } else if (c.ea && c.ea.flashTimer > 0) {
      baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      baseCtx.beginPath();
      baseCtx.arc(0, -c.size * 0.42, c.size * 0.34, 0, Math.PI * 2);
      baseCtx.fill();
    }
    if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
      baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
      baseCtx.beginPath();
      baseCtx.ellipse(3, -c.size * 0.42, c.size * 0.28, c.size * 0.34, 0.2, 0, Math.PI * 2);
      baseCtx.fill();
    }
  }
  baseCtx.restore();
}

export function renderStalkerEnemySprite(
  c: CoreEnemySpriteContext,
  stalkerSample: StalkerFrameSample,
): void {
  const frames = c.sim.stalkerFrames;
  if (!frames) return;
  const sCanvas = frames[stalkerSample.frameIndex] ?? frames[0];
  if (!sCanvas) return;

  const sf = stalkerSample.frame;
  const drawScale = c.size / STALKER_CANONICAL_HEIGHT;
  const hopY = c.ea?.dead ? 0 : stalkerSample.yHopPx * drawScale;

  if (stalkerSample.spineGlowIntensity > 0.45 && !c.ea?.dead && !c.tacticalViewActive) {
    const { fgCtx } = c;
    const glowAlpha = Math.min(0.75, (stalkerSample.spineGlowIntensity - 0.3) * 0.95);
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';
    const gx = c.spriteX - sf.quillOriginRel.dx * drawScale;
    const gy = c.enemyGroundY + hopY + sf.quillOriginRel.dy * drawScale;
    const rad =
      c.size * (stalkerSample.mode === 'bristle' || stalkerSample.frameIndex === 10 ? 0.56 : 0.44);
    const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    grad.addColorStop(0, `rgba(255, 46, 126, ${glowAlpha})`);
    grad.addColorStop(0.5, `rgba(255, 46, 126, ${glowAlpha * 0.4})`);
    grad.addColorStop(1, 'rgba(255, 46, 126, 0)');
    fgCtx.fillStyle = grad;
    fgCtx.beginPath();
    fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    fgCtx.fill();

    if (
      stalkerSample.mode === 'bristle' ||
      (stalkerSample.mode === 'guard' && stalkerSample.frameIndex === 10)
    ) {
      const rayLen = c.size * (stalkerSample.mode === 'bristle' ? 0.42 : 0.34);
      fgCtx.strokeStyle = `rgba(255, 92, 160, ${0.42 + 0.28 * glowAlpha})`;
      fgCtx.lineWidth = 1.8;
      const angles = [-0.95, -0.58, -0.24, 0.08];
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

  const blendA = stalkerSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && stalkerSample.prevFrameIndex !== stalkerSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[stalkerSample.prevFrameIndex] : null;

  if (c.webglRenderer) {
    const { deform, uniforms } = deriveEnemyDeformAndUniforms({
      archetype: c.enemy.archetype,
      idx: c.idx,
      ea: c.ea,
      isDead: c.isDead,
      staggerShearPx: c.stagger.shearPx,
      staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
      breathScaleX: c.breathScaleX * stalkerSample.breathScaleX,
      breathScaleY: c.breathScaleY * stalkerSample.breathScaleY,
      frameBlendAlpha: canCrossBlend ? blendA : 1,
      bioEmissiveRgb: c.bioEmissiveRgb,
      isPrimedOrCharging: c.isPrimedOrCharging || stalkerSample.spineGlowIntensity > 0.65,
      isAcidOrPustuleActive: false,
      isStaggeredStatus: Boolean(c.enemy.staggered),
      elapsed: c.elapsed,
      tacticalViewActive: c.tacticalViewActive,
      cutIn: c.enemyCutIn,
      facingSign: -1,
    });
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: sCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45),
      widthPx: sf.w * drawScale,
      heightPx: sf.h * drawScale,
      anchorOffsetXPx: sf.anchorX * drawScale,
      anchorOffsetYPx: sf.bottomY * drawScale,
      facingSign: -1,
      rotationRad: !c.ea?.dead ? c.stagger.rot * 0.32 + stalkerSample.tiltRad + c.enemyCutIn.leanRad : 0,
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
    baseCtx.rotate(c.stagger.rot * 0.32 + stalkerSample.tiltRad + c.enemyCutIn.leanRad);
  }
  baseCtx.scale(
    -c.breathScaleX * stalkerSample.breathScaleX * c.enemyCutIn.scaleX,
    c.breathScaleY * stalkerSample.breathScaleY * c.enemyCutIn.scaleY,
  );

  if (prevCanvas) {
    const pf = stalkerSample.prevFrame;
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
    sCanvas,
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
      sCanvas,
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

export function renderStaticCutoutEnemySprite(
  c: CoreEnemySpriteContext,
  entry: { canvas: HTMLCanvasElement },
  centerXRatio: number,
  bottomRatio: number,
): void {
  const arch = c.enemy.archetype;
  const bossWorldX = c.ex + c.cutInShiftX;
  const bossFacingSign = arch === 'brute' ? -1 : 1;
  const bossCutInBoost = arch === 'boss' && c.enemyCutIn.poseOverride === 'attack_pose' ? 1.06 : 1;

  if (c.webglRenderer) {
    const { deform, uniforms } = deriveEnemyDeformAndUniforms({
      archetype: arch,
      idx: c.idx,
      ea: c.ea,
      isDead: c.isDead,
      staggerShearPx: c.stagger.shearPx,
      staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
      breathScaleX: c.breathScaleX * bossCutInBoost,
      breathScaleY: c.breathScaleY * bossCutInBoost,
      frameBlendAlpha: 1,
      bioEmissiveRgb: c.bioEmissiveRgb,
      isPrimedOrCharging: c.isPrimedOrCharging,
      isAcidOrPustuleActive: c.isAcidOrPustuleActive,
      isStaggeredStatus: Boolean(c.enemy.staggered),
      elapsed: c.elapsed,
      tacticalViewActive: c.tacticalViewActive,
      cutIn: c.enemyCutIn,
      facingSign: bossFacingSign,
    });
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: entry.canvas,
      worldX: bossWorldX,
      worldY: c.enemyGroundY + c.koOffsetY + c.stagger.dy,
      widthPx: c.size,
      heightPx: c.size,
      anchorOffsetXPx: c.size * centerXRatio,
      anchorOffsetYPx: c.size * bottomRatio,
      facingSign: bossFacingSign,
      rotationRad: c.stagger.rot + c.enemyCutIn.leanRad,
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
  baseCtx.translate(bossWorldX, c.enemyGroundY + c.koOffsetY + c.stagger.dy);
  baseCtx.rotate(c.stagger.rot + c.enemyCutIn.leanRad);
  baseCtx.scale(
    bossFacingSign * c.breathScaleX * bossCutInBoost * c.enemyCutIn.scaleX,
    c.breathScaleY * bossCutInBoost * c.enemyCutIn.scaleY,
  );
  baseCtx.drawImage(entry.canvas, -c.size * centerXRatio, -c.size * bottomRatio, c.size, c.size);

  if (Math.abs(c.stagger.shearPx) > 0.5) {
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.rect(-c.size * 0.6, -c.size * 0.95, c.size * 1.2, c.size * 0.48);
    baseCtx.clip();
    baseCtx.translate(c.stagger.shearPx, -2);
    baseCtx.drawImage(entry.canvas, -c.size * centerXRatio, -c.size * bottomRatio, c.size, c.size);
    baseCtx.restore();
  }

  if ((c.ea && c.ea.flashTimer > 0) || c.stagger.bioFlashAlpha > 0.04 || c.enemyCutIn.flashRgba) {
    baseCtx.globalCompositeOperation = 'lighter';
    if (c.enemyCutIn.flashRgba) {
      drawCanvas2DCutInFlash(baseCtx, c.enemyCutIn.flashRgba, c.size * 0.36, -c.size * 0.44);
    } else if (c.ea && c.ea.flashTimer > 0) {
      baseCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      baseCtx.beginPath();
      baseCtx.arc(0, -c.size * 0.44, c.size * 0.34, 0, Math.PI * 2);
      baseCtx.fill();
    }
    if (c.stagger.bioFlashAlpha > 0.04) {
      baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
      baseCtx.beginPath();
      baseCtx.ellipse(4, -c.size * 0.46, c.size * 0.28, c.size * 0.36, 0.2, 0, Math.PI * 2);
      baseCtx.fill();
    }
  }
  baseCtx.restore();
}
