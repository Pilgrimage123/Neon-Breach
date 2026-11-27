import type { EnemyUnit } from '../../engine/types';
import { BRUTE_CANONICAL_HEIGHT } from '../../utils/bruteSpriteSheet';
import {
  CRAWLER_CANONICAL_HEIGHT,
  isCrawlerArchetype,
  sampleCrawlerFrame,
} from '../../utils/crawlerSpriteSheet';
import {
  computeBaseEnemySize,
  getMutantArchScale,
} from '../../utils/mutantAnimationRegistry';
import { FERAL_NURSE_CANONICAL_HEIGHT } from '../../utils/feralNurseSpriteSheet';
import { MATRIARCH_CANONICAL_HEIGHT } from '../../utils/matriarchSpriteSheet';
import { MUTDOG_CANONICAL_HEIGHT } from '../../utils/mutdogSpriteSheet';
import { SPITTER_CANONICAL_HEIGHT } from '../../utils/spitterSpriteSheet';
import { STALKER_CANONICAL_HEIGHT } from '../../utils/stalkerSpriteSheet';
import { getEnemyStaggerKinematics } from './combatEnemyAnimationSim';
import type { CombatStageSim } from './combatStageTypes';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type ICharacterStageRenderer,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
} from './stageSpriteAdapter';

export function renderEnemyReflectionsPass(params: {
  ctx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  sim: CombatStageSim;
  enemies: readonly EnemyUnit[];
  slotCenters: readonly number[];
  effectiveSlotCount: number;
  enemyBaseX: number;
  enemyStepX: number;
  groundY: number;
  w: number;
  h: number;
  elapsed: number;
  tacticalViewActive: boolean;
  reflDimmerAlpha: number;
  getActorJuice: (actorId: string) => ActorJuiceSnapshot;
}): void {
  const {
    ctx,
    webglRenderer,
    sim,
    enemies,
    slotCenters,
    effectiveSlotCount,
    enemyBaseX,
    enemyStepX,
    groundY,
    w,
    h,
    elapsed,
    tacticalViewActive,
    reflDimmerAlpha,
    getActorJuice,
  } = params;

  if (tacticalViewActive) return;

  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    const arch = enemy.archetype;
    const ea = sim.enemyAnims.get(enemy.id);
    const enemyCutIn = getActorJuice(enemy.id);
    const isDead = enemy.hp <= 0;
    const crawlerSample = isCrawlerArchetype(arch)
      ? sampleCrawlerFrame(arch, ea, elapsed, idx, enemyCutIn.poseOverride)
      : null;
    const stalkerSample = arch === 'stalker' ? sim.stalkerSamples?.get(enemy.id) : undefined;
    const spitterSample = arch === 'spitter' ? sim.spitterSamples?.get(enemy.id) : undefined;
    const mutdogSample = arch === 'mutdog' ? sim.mutdogSamples?.get(enemy.id) : undefined;
    const feralNurseSample =
      arch === 'feral_nurse' ? sim.feralNurseSamples?.get(enemy.id) : undefined;
    const bruteSample = arch === 'brute' ? sim.bruteSamples?.get(enemy.id) : undefined;
    const matriarchSample = arch === 'boss' ? sim.matriarchSamples?.get(enemy.id) : undefined;
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : stalkerSample
              ? stalkerSample.alpha
              : spitterSample
                ? spitterSample.alpha
                : mutdogSample
                  ? mutdogSample.alpha
                  : feralNurseSample
                    ? feralNurseSample.alpha
                    : bruteSample
                      ? bruteSample.alpha
                      : matriarchSample
                        ? matriarchSample.alpha
                        : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const baseEnemySize = computeBaseEnemySize(w, h, effectiveSlotCount);
    const archScale = getMutantArchScale(arch);
    const size = baseEnemySize * archScale;
    const hasCustomSheetMotion =
      (arch === 'stalker' && Boolean(stalkerSample)) ||
      (arch === 'spitter' && Boolean(spitterSample)) ||
      (arch === 'mutdog' && Boolean(mutdogSample)) ||
      (arch === 'feral_nurse' && Boolean(feralNurseSample)) ||
      (arch === 'brute' && Boolean(bruteSample)) ||
      (arch === 'boss' && Boolean(matriarchSample));
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash ||
      (enemyCutIn.active && enemyCutIn.role === 'target');
    const lunge =
      ea && !hasCustomSheetMotion && !suppressNativeShift
        ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09)
        : 0;
    const cutInShiftX = enemyCutIn.active ? enemyCutIn.clashSlideX + enemyCutIn.knockbackX : 0;
    const reflDimMul =
      enemyCutIn.role === 'bystander' && reflDimmerAlpha > 0.01
        ? Math.max(0.22, 1 - reflDimmerAlpha * 0.88)
        : 1;
    const ex =
      enemyBaseX +
      (slotCenters[idx] ?? idx) * enemyStepX +
      lunge +
      (hasCustomSheetMotion && ea?.dead ? 0 : suppressStaggerDx ? 0 : stagger.dx) +
      cutInShiftX;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      hasCustomSheetMotion && ea?.dead
        ? 1
        : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasCustomSheetMotion && ea?.dead
        ? 1
        : (1 - breathPhase * 0.009) * stagger.scaleXMul;

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (!cCanvas) continue;
      const cf = crawlerSample.frame;
      const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
      const sx = breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: cCanvas,
          worldX: ex,
          worldY: enemyGroundY + 1,
          widthPx: cf.w * drawScale * sx,
          heightPx: cf.h * drawScale,
          anchorOffsetXPx: cf.anchorX * drawScale * sx,
          anchorOffsetYPx: cf.bottomY * drawScale,
          facingSign: 1,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(ex, enemyGroundY + 1);
        ctx.scale(sx, -0.3 * sy);
        ctx.drawImage(
          cCanvas,
          -cf.anchorX * drawScale,
          -cf.bottomY * drawScale,
          cf.w * drawScale,
          cf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'stalker' && stalkerSample && sim.stalkerFrames) {
      const stalkerJuice = sim.stalkerJuiceSamples?.get(enemy.id);
      const sCanvas = sim.stalkerFrames[stalkerSample.frameIndex] ?? sim.stalkerFrames[0];
      if (!sCanvas) continue;
      const sf = stalkerSample.frame;
      const drawScale = size / STALKER_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : stalkerJuice
            ? stalkerJuice.offsetX * drawScale
            : stalkerSample.xOffsetRatio * size);
      const sx =
        (stalkerJuice
          ? stagger.scaleXMul * stalkerJuice.springScaleX
          : breathScaleX * stalkerSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (stalkerJuice
          ? stagger.scaleYMul * stalkerJuice.springScaleY
          : breathScaleY * stalkerSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: sCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: sf.w * drawScale * sx,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale * sx,
          anchorOffsetYPx: sf.bottomY * drawScale,
          facingSign: 1,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(sx, -0.3 * sy);
        ctx.drawImage(
          sCanvas,
          -sf.anchorX * drawScale,
          -sf.bottomY * drawScale,
          sf.w * drawScale,
          sf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'spitter' && spitterSample && sim.spitterFrames) {
      const spitterJuice = sim.spitterJuiceSamples?.get(enemy.id);
      const spCanvas = sim.spitterFrames[spitterSample.frameIndex] ?? sim.spitterFrames[0];
      if (!spCanvas) continue;
      const sf = spitterSample.frame;
      const drawScale = size / SPITTER_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : spitterJuice
            ? spitterJuice.offsetX * drawScale
            : spitterSample.xOffsetRatio * size);
      const facing = spitterJuice ? spitterJuice.facingScale : -1;
      const sx =
        (spitterJuice
          ? stagger.scaleXMul * spitterJuice.springScaleX
          : breathScaleX * spitterSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (spitterJuice
          ? stagger.scaleYMul * spitterJuice.springScaleY
          : breathScaleY * spitterSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: spCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: sf.w * drawScale * sx,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale * sx,
          anchorOffsetYPx: sf.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          spCanvas,
          -sf.anchorX * drawScale,
          -sf.bottomY * drawScale,
          sf.w * drawScale,
          sf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'mutdog' && mutdogSample && sim.mutdogFrames) {
      const mutdogJuice = sim.mutdogJuiceSamples?.get(enemy.id);
      const mCanvas = sim.mutdogFrames[mutdogSample.frameIndex] ?? sim.mutdogFrames[0];
      if (!mCanvas) continue;
      const mf = mutdogSample.frame;
      const drawScale = (size / MUTDOG_CANONICAL_HEIGHT) * (mf.frameScale ?? 1);
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : mutdogJuice
            ? mutdogJuice.offsetX * drawScale
            : mutdogSample.xOffsetRatio * size);
      const facing = mutdogJuice ? mutdogJuice.facingScale : -1;
      const sx =
        (mutdogJuice
          ? stagger.scaleXMul * mutdogJuice.springScaleX
          : breathScaleX * mutdogSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (mutdogJuice
          ? stagger.scaleYMul * mutdogJuice.springScaleY
          : breathScaleY * mutdogSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: mCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: mf.w * drawScale * sx,
          heightPx: mf.h * drawScale,
          anchorOffsetXPx: mf.anchorX * drawScale * sx,
          anchorOffsetYPx: mf.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          mCanvas,
          -mf.anchorX * drawScale,
          -mf.bottomY * drawScale,
          mf.w * drawScale,
          mf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'brute' && bruteSample && sim.bruteFrames) {
      const bruteJuice = sim.bruteJuiceSamples?.get(enemy.id);
      const bCanvas = sim.bruteFrames[bruteSample.frameIndex] ?? sim.bruteFrames[0];
      if (!bCanvas) continue;
      const bf = bruteSample.frame;
      const drawScale = size / BRUTE_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : bruteJuice
            ? bruteJuice.offsetX * drawScale
            : bruteSample.xOffsetRatio * size);
      const facing = bruteJuice ? bruteJuice.facingScale : -1;
      const sx =
        (bruteJuice
          ? stagger.scaleXMul * bruteJuice.springScaleX
          : breathScaleX * bruteSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (bruteJuice
          ? stagger.scaleYMul * bruteJuice.springScaleY
          : breathScaleY * bruteSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: bCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: bf.w * drawScale * sx,
          heightPx: bf.h * drawScale,
          anchorOffsetXPx: bf.anchorX * drawScale * sx,
          anchorOffsetYPx: bf.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          bCanvas,
          -bf.anchorX * drawScale,
          -bf.bottomY * drawScale,
          bf.w * drawScale,
          bf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'feral_nurse' && feralNurseSample && sim.feralNurseFrames) {
      const feralNurseJuice = sim.feralNurseJuiceSamples?.get(enemy.id);
      const fCanvas =
        sim.feralNurseFrames[feralNurseSample.frameIndex] ?? sim.feralNurseFrames[0];
      if (!fCanvas) continue;
      const ff = feralNurseSample.frame;
      const drawScale = (size / FERAL_NURSE_CANONICAL_HEIGHT) * (ff.frameScale ?? 1);
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : feralNurseJuice
            ? feralNurseJuice.xShiftPx * drawScale
            : feralNurseSample.xShiftPx * drawScale);
      const facing = feralNurseJuice ? feralNurseJuice.facingScale : -1;
      const cloakAlpha = isDead
        ? 1
        : feralNurseJuice
          ? feralNurseJuice.alpha
          : feralNurseSample.alpha;
      const sx =
        (feralNurseJuice
          ? stagger.scaleXMul * feralNurseJuice.springScaleX
          : breathScaleX * feralNurseSample.scaleX) * enemyCutIn.scaleX;
      const sy =
        (feralNurseJuice
          ? stagger.scaleYMul * feralNurseJuice.springScaleY
          : breathScaleY * feralNurseSample.scaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: fCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: ff.w * drawScale * sx,
          heightPx: ff.h * drawScale,
          anchorOffsetXPx: ff.anchorX * drawScale * sx,
          anchorOffsetYPx: ff.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * cloakAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * cloakAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          fCanvas,
          -ff.anchorX * drawScale,
          -ff.bottomY * drawScale,
          ff.w * drawScale,
          ff.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'boss' && matriarchSample && sim.matriarchFrames) {
      const matriarchJuice = sim.matriarchJuiceSamples?.get(enemy.id);
      const mCanvas = sim.matriarchFrames[matriarchSample.frameIndex] ?? sim.matriarchFrames[0];
      if (!mCanvas) continue;
      const mf = matriarchSample.frame;
      const drawScale = size / MATRIARCH_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : matriarchJuice
            ? matriarchJuice.offsetX * drawScale
            : matriarchSample.xOffsetRatio * size);
      const sx =
        (matriarchJuice
          ? stagger.scaleXMul * matriarchJuice.springScaleX
          : breathScaleX * matriarchSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (matriarchJuice
          ? stagger.scaleYMul * matriarchJuice.springScaleY
          : breathScaleY * matriarchSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: mCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: mf.w * drawScale * sx,
          heightPx: mf.h * drawScale,
          anchorOffsetXPx: mf.anchorX * drawScale * sx,
          anchorOffsetYPx: mf.bottomY * drawScale,
          facingSign: 1,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(sx, -0.3 * sy);
        ctx.drawImage(
          mCanvas,
          -mf.anchorX * drawScale,
          -mf.bottomY * drawScale,
          mf.w * drawScale,
          mf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    const entry = sim.enemyCutouts.get(enemy.archetype);
    if (!entry) continue;

    if (webglRenderer) {
      const sx = breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * enemyCutIn.scaleY;
      webglRenderer.drawSprite({
        id: `refl:enemy:${enemy.id}`,
        primarySource: entry.canvas,
        worldX: ex,
        worldY: enemyGroundY + 1,
        widthPx: size * sx,
        heightPx: size,
        anchorOffsetXPx: size * entry.bounds.centerXRatio * sx,
        anchorOffsetYPx: size * entry.bounds.bottomRatio,
        facingSign: enemy.archetype === 'brute' ? -1 : 1,
        verticalScaleSign: -0.3 * sy,
        rotationRad: -stagger.rot * 0.45,
        alpha: 0.12 * koAlpha * reflDimMul,
        isReflection: true,
        deform: createIdentityControlPoints(),
        uniforms: createDefaultShaderUniforms(),
      });
    } else {
      ctx.save();
      ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
      ctx.translate(ex, enemyGroundY + 1);
      ctx.rotate(-stagger.rot * 0.45);
      ctx.scale(
        (enemy.archetype === 'brute' ? -breathScaleX : breathScaleX) * enemyCutIn.scaleX,
        -0.3 * breathScaleY * enemyCutIn.scaleY,
      );
      ctx.drawImage(
        entry.canvas,
        -size * entry.bounds.centerXRatio,
        -size * entry.bounds.bottomRatio,
        size,
        size,
      );
      ctx.restore();
    }
  }
}
