import type { EnemyUnit, TurnPreview } from '../../engine/types';
import {
  BRUTE_CANONICAL_HEIGHT,
} from '../../utils/bruteSpriteSheet';
import {
  CRAWLER_ARCH_SCALE,
  CRAWLER_CANONICAL_HEIGHT,
  isCrawlerArchetype,
  sampleCrawlerFrame,
} from '../../utils/crawlerSpriteSheet';
import {
  SPITTER_CANONICAL_HEIGHT,
} from '../../utils/spitterSpriteSheet';
import {
  STALKER_CANONICAL_HEIGHT,
} from '../../utils/stalkerSpriteSheet';
import { renderSpitterGroundPuddle } from './combatDecalRenderer';
import { getEnemyStaggerKinematics } from './combatEnemyAnimationSim';
import { renderSpitterBileTorrent } from './combatForegroundFxRenderer';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import {
  type CombatStageSim,
  ENEMY_FOOT_DEFAULTS,
} from './combatStageTypes';
import { renderEnemySelectionAndUnderfootBar } from './combatTacticalOverlayRenderer';
import {
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
  hexToRgba,
} from './mutantBlood';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type ICharacterStageRenderer,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  deriveEnemyDeformAndUniforms,
  hexToRgbNorm,
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
    const bruteSample = arch === 'brute' ? sim.bruteSamples?.get(enemy.id) : undefined;
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : stalkerSample
              ? stalkerSample.alpha
              : spitterSample
                ? spitterSample.alpha
                : bruteSample
                  ? bruteSample.alpha
                  : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : 0.94;
    const size = baseEnemySize * archScale;
    const hasCustomSheetMotion =
      (arch === 'stalker' && Boolean(stalkerSample)) ||
      (arch === 'spitter' && Boolean(spitterSample)) ||
      (arch === 'brute' && Boolean(bruteSample));
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash || (enemyCutIn.active && enemyCutIn.role === 'target');
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
      hasCustomSheetMotion && ea?.dead ? 1 : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasCustomSheetMotion && ea?.dead ? 1 : (1 - breathPhase * 0.009) * stagger.scaleXMul;

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
      const sCanvas = sim.stalkerFrames[stalkerSample.frameIndex] ?? sim.stalkerFrames[0];
      if (!sCanvas) continue;
      const sf = stalkerSample.frame;
      const drawScale = size / STALKER_CANONICAL_HEIGHT;
      const rx = ex + (suppressNativeShift ? 0 : stalkerSample.xOffsetRatio * size);
      const sx = breathScaleX * stalkerSample.breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * stalkerSample.breathScaleY * enemyCutIn.scaleY;
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
          facingSign: -1,
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
        ctx.scale(-sx, -0.3 * sy);
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

export function renderEnemySpritePass(params: {
  baseCtx: CanvasRenderingContext2D;
  fgCtx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  sim: CombatStageSim;
  enemies: readonly EnemyUnit[];
  slotCenters: readonly number[];
  effectiveSlotCount: number;
  enemyBaseX: number;
  enemyStepX: number;
  groundY: number;
  heroCutInDrawX: number;
  heroTargetHeight: number;
  baseScale: number;
  w: number;
  h: number;
  elapsed: number;
  tacticalViewActive: boolean;
  dimmerAlpha: number;
  worldUiAlpha: number;
  activePreview: TurnPreview | null;
  hoveredEnemyId: string | null;
  inspectedEnemyId: string | null;
  hoveringSwap: boolean;
  getActorJuice: (actorId: string) => ActorJuiceSnapshot;
}): void {
  const {
    baseCtx,
    fgCtx,
    webglRenderer,
    sim,
    enemies,
    slotCenters,
    effectiveSlotCount,
    enemyBaseX,
    enemyStepX,
    groundY,
    heroCutInDrawX,
    heroTargetHeight,
    baseScale,
    w,
    h,
    elapsed,
    tacticalViewActive,
    dimmerAlpha,
    worldUiAlpha,
    activePreview,
    hoveredEnemyId,
    inspectedEnemyId,
    hoveringSwap,
    getActorJuice,
  } = params;

  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    const ea = sim.enemyAnims.get(enemy.id);
    const enemyCutIn = getActorJuice(enemy.id);
    const isDead = enemy.hp <= 0;
    const arch = enemy.archetype;
    const isCrawler = isCrawlerArchetype(arch);
    const isStalker = arch === 'stalker';
    const isSpitter = arch === 'spitter';
    const isBrute = arch === 'brute';
    const crawlerSample = isCrawler
      ? sampleCrawlerFrame(arch, ea, elapsed, idx, enemyCutIn.poseOverride)
      : null;
    const stalkerSample = isStalker ? sim.stalkerSamples?.get(enemy.id) : undefined;
    const spitterSample = isSpitter ? sim.spitterSamples?.get(enemy.id) : undefined;
    const bruteSample = isBrute ? sim.bruteSamples?.get(enemy.id) : undefined;
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : stalkerSample
              ? stalkerSample.alpha
              : spitterSample
                ? spitterSample.alpha
                : bruteSample
                  ? bruteSample.alpha
                  : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : 0.94;
    const size = baseEnemySize * archScale;
    const hasSheetSample =
      (isCrawler && Boolean(crawlerSample)) ||
      (isStalker && Boolean(stalkerSample)) ||
      (isSpitter && Boolean(spitterSample)) ||
      (isBrute && Boolean(bruteSample));
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash || (enemyCutIn.active && enemyCutIn.role === 'target');
    const lunge =
      ea &&
      !suppressNativeShift &&
      !(isStalker && stalkerSample) &&
      !(isSpitter && spitterSample) &&
      !(isBrute && bruteSample)
        ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09)
        : 0;
    const cutInShiftX = enemyCutIn.active ? enemyCutIn.clashSlideX + enemyCutIn.knockbackX : 0;
    const canvasBystanderMul =
      !webglRenderer && enemyCutIn.role === 'bystander' && dimmerAlpha > 0.01
        ? Math.max(0.24, 1 - dimmerAlpha * 0.92)
        : 1;
    const ex =
      enemyBaseX +
      (slotCenters[idx] ?? idx) * enemyStepX +
      lunge +
      (hasSheetSample && ea?.dead ? 0 : suppressStaggerDx ? 0 : stagger.dx);
    const spitterJuiceForPos = isSpitter ? sim.spitterJuiceSamples?.get(enemy.id) : undefined;
    const bruteJuiceForPos = isBrute ? sim.bruteJuiceSamples?.get(enemy.id) : undefined;
    const spriteX =
      ex +
      cutInShiftX +
      (suppressNativeShift
        ? 0
        : stalkerSample
          ? stalkerSample.xOffsetRatio * size
          : spitterJuiceForPos
            ? spitterJuiceForPos.offsetX * (size / SPITTER_CANONICAL_HEIGHT)
            : spitterSample
              ? spitterSample.xOffsetRatio * size
              : bruteJuiceForPos
                ? bruteJuiceForPos.offsetX * (size / BRUTE_CANONICAL_HEIGHT)
                : bruteSample
                  ? bruteSample.xOffsetRatio * size
                  : 0);
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      hasSheetSample && ea?.dead ? 1 : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasSheetSample && ea?.dead ? 1 : (1 - breathPhase * 0.009) * stagger.scaleXMul;
    const koOffsetY = !hasSheetSample && isDead && ea?.dead ? (1 - koAlpha) * 24 : 0;

    const entry = sim.enemyCutouts.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;
    const centerXRatio = entry ? entry.bounds.centerXRatio : defaults.centerXRatio;
    const farFootOffsetPx = defaults.farFootOffsetRatio * size;

    baseCtx.save();
    baseCtx.globalAlpha = koAlpha;

    const shadowHalfW = isBrute ? size * 0.44 : size * 0.32;
    const ringHalfW = isBrute ? size * 0.46 : size * 0.34;
    const footSpread = isBrute ? 0.18 : 0.13;

    baseCtx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    baseCtx.beginPath();
    baseCtx.ellipse(spriteX, enemyGroundY - farFootOffsetPx * 0.35, shadowHalfW, isBrute ? 9.5 : 7.5, 0, 0, Math.PI * 2);
    baseCtx.fill();

    baseCtx.fillStyle = 'rgba(2, 5, 14, 0.84)';
    baseCtx.beginPath();
    baseCtx.ellipse(spriteX - size * footSpread, enemyGroundY - farFootOffsetPx, size * (isBrute ? 0.16 : 0.13), 3.8, 0, 0, Math.PI * 2);
    baseCtx.fill();

    baseCtx.beginPath();
    baseCtx.ellipse(spriteX + size * (footSpread + 0.02), enemyGroundY - 1, size * (isBrute ? 0.17 : 0.14), 4.2, 0, 0, Math.PI * 2);
    baseCtx.fill();

    const roleStroke =
      enemy.roleColor === 'crimson' || enemy.roleColor === 'apex'
        ? 'rgba(255, 46, 126, 0.44)'
        : enemy.roleColor === 'blue'
          ? 'rgba(0, 240, 255, 0.44)'
          : enemy.roleColor === 'gold'
            ? 'rgba(255, 199, 0, 0.48)'
            : enemy.roleColor === 'orange'
              ? 'rgba(251, 146, 60, 0.46)'
              : enemy.roleColor === 'violet'
                ? 'rgba(192, 132, 252, 0.46)'
                : 'rgba(163, 230, 53, 0.44)';
    if (worldUiAlpha > 0.02) {
      baseCtx.save();
      baseCtx.globalAlpha *= worldUiAlpha;
      baseCtx.strokeStyle = roleStroke;
      baseCtx.lineWidth = arch === 'boss' || arch === 'brute' ? 2.2 : 1.5;
      baseCtx.beginPath();
      baseCtx.ellipse(spriteX, enemyGroundY - farFootOffsetPx * 0.3, ringHalfW, isBrute ? 10.5 : 8.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();
    }

    const enemyBio = getBloodBiologyProfile(arch);
    if (!isDead) {
      const statusFlags = getEnemyStatusVisualFlags(enemy, sim.enemyInitialArmor.get(enemy.id));
      if (statusFlags.isBleeding || statusFlags.isShredded) {
        const bleedPulse = 0.65 + 0.35 * Math.sin(elapsed * 4.5 + idx * 1.7);
        const dropCount = statusFlags.isSeverelyBleeding || statusFlags.isShredded ? 5 : 3;
        baseCtx.save();
        for (let b = 0; b < dropCount; b++) {
          const ang = idx * 1.1 + b * ((Math.PI * 2) / dropCount) + 0.3;
          const bx = ex + Math.cos(ang) * size * (0.18 + (b % 2) * 0.08);
          const by = enemyGroundY - 1 + Math.sin(ang) * 5.2;
          baseCtx.globalAlpha = (statusFlags.isSeverelyBleeding ? 0.85 : 0.65) * bleedPulse;
          baseCtx.fillStyle = enemyBio.freshBody;
          baseCtx.beginPath();
          baseCtx.ellipse(bx, by, 3.6 + (b % 2) * 1.4, 1.4 + (b % 2) * 0.5, 0, 0, Math.PI * 2);
          baseCtx.fill();
          if (enemyBio.hasSuspendedVeins || enemyBio.emissiveStrength > 0.6) {
            baseCtx.globalAlpha = 0.6 * bleedPulse;
            baseCtx.fillStyle = enemyBio.hasSuspendedVeins ? enemyBio.veinPrimary : enemyBio.freshEmissive;
            baseCtx.beginPath();
            baseCtx.arc(bx, by, 1.1, 0, Math.PI * 2);
            baseCtx.fill();
          }
        }
        baseCtx.restore();
      }
    }

    const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!isDead && activeIntent?.kind === 'charge' && worldUiAlpha > 0.02) {
      const chargePulse = 0.55 + 0.45 * Math.sin(elapsed * 8.5);
      baseCtx.save();
      baseCtx.globalAlpha *= worldUiAlpha;
      baseCtx.translate(spriteX, enemyGroundY - size * 0.48);
      baseCtx.rotate(elapsed * 1.4);
      baseCtx.strokeStyle = `rgba(251, 146, 60, ${0.55 + 0.35 * chargePulse})`;
      baseCtx.setLineDash([7, 5]);
      baseCtx.lineWidth = 2;
      baseCtx.beginPath();
      baseCtx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();
    }

    if (!isDead && enemy.sosCharging && worldUiAlpha > 0.02) {
      const sosPulse = (elapsed * 1.4) % 1;
      baseCtx.save();
      baseCtx.globalAlpha *= worldUiAlpha;
      baseCtx.strokeStyle = `rgba(251, 146, 60, ${0.75 * (1 - sosPulse)})`;
      baseCtx.lineWidth = 2;
      baseCtx.beginPath();
      baseCtx.ellipse(spriteX, enemyGroundY - 2, size * (0.28 + sosPulse * 0.25), 9 + sosPulse * 6, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();
    }

    if (!isDead && (enemy.enrageAtkBonus ?? 0) > 0 && worldUiAlpha > 0.02) {
      const enragePulse = 0.6 + 0.4 * Math.sin(elapsed * 7 + idx);
      baseCtx.save();
      baseCtx.globalAlpha *= worldUiAlpha;
      baseCtx.strokeStyle = `rgba(255, 46, 126, ${0.42 + 0.28 * enragePulse})`;
      baseCtx.lineWidth = 2;
      baseCtx.beginPath();
      baseCtx.ellipse(spriteX, enemyGroundY - 2, size * 0.38, 10.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();
    }

    const bioEmissiveRgb = hexToRgbNorm(enemyBio.freshEmissive);
    const isPrimedOrCharging =
      !isDead &&
      !enemy.staggered &&
      (activeIntent?.kind === 'heavy' || activeIntent?.kind === 'charge');
    const isAcidOrPustuleActive =
      !isDead &&
      (activeIntent?.kind === 'acid' ||
        Boolean(spitterSample && spitterSample.pustuleGlowIntensity > 0.45));

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (cCanvas) {
        const cf = crawlerSample.frame;
        const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
        const crawlerX = ex + cutInShiftX;
        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX,
            breathScaleY,
            frameBlendAlpha: 1,
            bioEmissiveRgb,
            isPrimedOrCharging,
            isAcidOrPustuleActive,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            cutIn: enemyCutIn,
            facingSign: 1,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: cCanvas,
            worldX: crawlerX,
            worldY: enemyGroundY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: cf.w * drawScale,
            heightPx: cf.h * drawScale,
            anchorOffsetXPx: cf.anchorX * drawScale,
            anchorOffsetYPx: cf.bottomY * drawScale,
            facingSign: 1,
            rotationRad: !ea?.dead ? stagger.rot * 0.35 + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          baseCtx.save();
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;
          baseCtx.translate(crawlerX, enemyGroundY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            baseCtx.rotate(stagger.rot * 0.35 + enemyCutIn.leanRad);
          }
          baseCtx.scale(breathScaleX * enemyCutIn.scaleX, breathScaleY * enemyCutIn.scaleY);
          baseCtx.drawImage(
            cCanvas,
            -cf.anchorX * drawScale,
            -cf.bottomY * drawScale,
            cf.w * drawScale,
            cf.h * drawScale,
          );

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || enemyCutIn.flashRgba) {
            baseCtx.globalCompositeOperation = 'lighter';
            if (enemyCutIn.flashRgba) {
              drawCanvas2DCutInFlash(baseCtx, enemyCutIn.flashRgba, size * 0.36, -size * 0.42);
            } else if (ea && ea.flashTimer > 0) {
              baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              baseCtx.beginPath();
              baseCtx.arc(0, -size * 0.42, size * 0.34, 0, Math.PI * 2);
              baseCtx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              baseCtx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              baseCtx.beginPath();
              baseCtx.ellipse(3, -size * 0.42, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
              baseCtx.fill();
            }
          }
          baseCtx.restore();
        }
      }
    } else if (isStalker && stalkerSample && sim.stalkerFrames) {
      const sCanvas = sim.stalkerFrames[stalkerSample.frameIndex] ?? sim.stalkerFrames[0];
      if (sCanvas) {
        const sf = stalkerSample.frame;
        const drawScale = size / STALKER_CANONICAL_HEIGHT;
        const hopY = ea?.dead ? 0 : stalkerSample.yHopPx * drawScale;

        if (stalkerSample.spineGlowIntensity > 0.45 && !ea?.dead && !tacticalViewActive) {
          const glowAlpha = Math.min(0.75, (stalkerSample.spineGlowIntensity - 0.3) * 0.95);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spriteX - sf.quillOriginRel.dx * drawScale;
          const gy = enemyGroundY + hopY + sf.quillOriginRel.dy * drawScale;
          const rad = size * (stalkerSample.mode === 'bristle' || stalkerSample.frameIndex === 10 ? 0.56 : 0.44);
          const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
          grad.addColorStop(0, `rgba(255, 46, 126, ${glowAlpha})`);
          grad.addColorStop(0.5, `rgba(255, 46, 126, ${glowAlpha * 0.4})`);
          grad.addColorStop(1, 'rgba(255, 46, 126, 0)');
          fgCtx.fillStyle = grad;
          fgCtx.beginPath();
          fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
          fgCtx.fill();

          if (stalkerSample.mode === 'bristle' || (stalkerSample.mode === 'guard' && stalkerSample.frameIndex === 10)) {
            const rayLen = size * (stalkerSample.mode === 'bristle' ? 0.42 : 0.34);
            fgCtx.strokeStyle = `rgba(255, 92, 160, ${0.42 + 0.28 * glowAlpha})`;
            fgCtx.lineWidth = 1.8;
            const angles = [-0.95, -0.58, -0.24, 0.08];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              const rx0 = gx + Math.cos(ang) * (size * 0.08);
              const ry0 = gy + Math.sin(ang) * (size * 0.08);
              const rx1 = gx + Math.cos(ang) * rayLen;
              const ry1 = gy + Math.sin(ang) * rayLen;
              fgCtx.beginPath();
              fgCtx.moveTo(rx0, ry0);
              fgCtx.lineTo(rx1, ry1);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        const blendA = stalkerSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          stalkerSample.prevFrameIndex !== stalkerSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.stalkerFrames[stalkerSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: breathScaleX * stalkerSample.breathScaleX,
            breathScaleY: breathScaleY * stalkerSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging: isPrimedOrCharging || stalkerSample.spineGlowIntensity > 0.65,
            isAcidOrPustuleActive: false,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            cutIn: enemyCutIn,
            facingSign: -1,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: sCanvas,
            secondarySource: prevCanvas,
            worldX: spriteX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: sf.w * drawScale,
            heightPx: sf.h * drawScale,
            anchorOffsetXPx: sf.anchorX * drawScale,
            anchorOffsetYPx: sf.bottomY * drawScale,
            facingSign: -1,
            rotationRad: !ea?.dead ? stagger.rot * 0.32 + stalkerSample.tiltRad + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          baseCtx.save();
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;
          baseCtx.translate(spriteX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            baseCtx.rotate(stagger.rot * 0.32 + stalkerSample.tiltRad + enemyCutIn.leanRad);
          }
          baseCtx.scale(
            -breathScaleX * stalkerSample.breathScaleX * enemyCutIn.scaleX,
            breathScaleY * stalkerSample.breathScaleY * enemyCutIn.scaleY,
          );

          if (prevCanvas) {
            const pf = stalkerSample.prevFrame;
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.5);
            baseCtx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
          }

          baseCtx.drawImage(
            sCanvas,
            -sf.anchorX * drawScale,
            -sf.bottomY * drawScale,
            sf.w * drawScale,
            sf.h * drawScale,
          );
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            baseCtx.save();
            baseCtx.beginPath();
            baseCtx.rect(
              -sf.w * drawScale * 0.55,
              -sf.bottomY * drawScale,
              sf.w * drawScale * 1.1,
              sf.h * drawScale * 0.48,
            );
            baseCtx.clip();
            baseCtx.translate(-stagger.shearPx, -2);
            baseCtx.drawImage(
              sCanvas,
              -sf.anchorX * drawScale,
              -sf.bottomY * drawScale,
              sf.w * drawScale,
              sf.h * drawScale,
            );
            baseCtx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || enemyCutIn.flashRgba) {
            baseCtx.globalCompositeOperation = 'lighter';
            if (enemyCutIn.flashRgba) {
              drawCanvas2DCutInFlash(baseCtx, enemyCutIn.flashRgba, size * 0.36, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              baseCtx.beginPath();
              baseCtx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
              baseCtx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              baseCtx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              baseCtx.beginPath();
              baseCtx.ellipse(2, -size * 0.44, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
              baseCtx.fill();
            }
          }
          baseCtx.restore();
        }
      }
    } else if (isSpitter && spitterSample && sim.spitterFrames) {
      const spitterJuice = sim.spitterJuiceSamples?.get(enemy.id);
      const spCanvas = sim.spitterFrames[spitterSample.frameIndex] ?? sim.spitterFrames[0];
      if (spCanvas) {
        const sf = spitterSample.frame;
        const pf = spitterSample.prevFrame;
        const drawScale = size / SPITTER_CANONICAL_HEIGHT;
        const juiceHopY = spitterJuice ? spitterJuice.hopYPx * drawScale : spitterSample.yHopPx * drawScale;
        const juiceRot = spitterJuice ? spitterJuice.rotationRad : spitterSample.tiltRad;
        const juiceFacing = spitterJuice ? spitterJuice.facingScale : -1;
        const spitterWorldX = spriteX;
        const hopY = ea?.dead ? 0 : juiceHopY;
        const windupProg = spitterJuice?.spitWindupProgress ?? 0;
        const streamProg = Math.max(
          spitterSample.spitStreamProgress,
          spitterJuice?.spitStreamProgress ?? 0,
        );

        renderSpitterGroundPuddle(
          baseCtx,
          ex + (spitterWorldX - ex) * 0.28,
          enemyGroundY + 1,
          size,
          koAlpha,
          spitterSample.pustuleGlowIntensity,
          Math.max(windupProg, streamProg),
          elapsed,
          idx,
        );

        if (spitterSample.pustuleGlowIntensity > 0.45 && !ea?.dead && !tacticalViewActive) {
          const glowAlpha = Math.min(0.74, (spitterSample.pustuleGlowIntensity - 0.3) * 0.92);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spitterWorldX + sf.pustuleOriginRel.dx * drawScale * (-juiceFacing);
          const gy = enemyGroundY + hopY + sf.pustuleOriginRel.dy * drawScale;
          const rad = size * (spitterSample.mode === 'rupture' || spitterSample.frameIndex === 10 ? 0.46 : 0.36);
          const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
          grad.addColorStop(0, `rgba(254, 240, 138, ${glowAlpha})`);
          grad.addColorStop(0.45, `rgba(163, 230, 53, ${glowAlpha * 0.52})`);
          grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
          fgCtx.fillStyle = grad;
          fgCtx.beginPath();
          fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
          fgCtx.fill();

          if (spitterSample.mode === 'rupture' || (spitterSample.mode === 'guard' && spitterSample.frameIndex === 10)) {
            const sprayLen = size * (spitterSample.mode === 'rupture' ? 0.36 : 0.28);
            fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.44 + 0.3 * glowAlpha})`;
            fgCtx.lineWidth = 1.8;
            const angles = [-2.55, -2.18, -1.78, -1.38];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              const rx0 = gx + Math.cos(ang) * (size * 0.06);
              const ry0 = gy + Math.sin(ang) * (size * 0.06);
              const rx1 = gx + Math.cos(ang) * sprayLen;
              const ry1 = gy + Math.sin(ang) * sprayLen;
              fgCtx.beginPath();
              fgCtx.moveTo(rx0, ry0);
              fgCtx.lineTo(rx1, ry1);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        const blendA = spitterSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          spitterSample.prevFrameIndex !== spitterSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.spitterFrames[spitterSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: spitterJuice ? stagger.scaleXMul : breathScaleX * spitterSample.breathScaleX,
            breathScaleY: spitterJuice ? stagger.scaleYMul : breathScaleY * spitterSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging,
            isAcidOrPustuleActive,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            spitterJuice,
            cutIn: enemyCutIn,
            facingSign: juiceFacing,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: spCanvas,
            secondarySource: prevCanvas,
            worldX: spitterWorldX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: sf.w * drawScale,
            heightPx: sf.h * drawScale,
            anchorOffsetXPx: sf.anchorX * drawScale,
            anchorOffsetYPx: sf.bottomY * drawScale,
            secondaryWidthPx: pf.w * drawScale,
            secondaryHeightPx: pf.h * drawScale,
            secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
            secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
            facingSign: juiceFacing,
            rotationRad: !ea?.dead ? stagger.rot * 0.32 + juiceRot + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          baseCtx.save();
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;
          baseCtx.translate(spitterWorldX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            baseCtx.rotate(stagger.rot * 0.32 + juiceRot + enemyCutIn.leanRad);
          }
          const scaleX = (spitterJuice
            ? stagger.scaleXMul * spitterJuice.springScaleX
            : breathScaleX * spitterSample.breathScaleX) * enemyCutIn.scaleX;
          const scaleY = (spitterJuice
            ? stagger.scaleYMul * spitterJuice.springScaleY
            : breathScaleY * spitterSample.breathScaleY) * enemyCutIn.scaleY;
          baseCtx.scale(juiceFacing * scaleX, scaleY);

          if (prevCanvas) {
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.5);
            baseCtx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
          }

          baseCtx.drawImage(
            spCanvas,
            -sf.anchorX * drawScale,
            -sf.bottomY * drawScale,
            sf.w * drawScale,
            sf.h * drawScale,
          );
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            baseCtx.save();
            baseCtx.beginPath();
            baseCtx.rect(
              -sf.w * drawScale * 0.55,
              -sf.bottomY * drawScale,
              sf.w * drawScale * 1.1,
              sf.h * drawScale * 0.48,
            );
            baseCtx.clip();
            baseCtx.translate(-stagger.shearPx, -2);
            baseCtx.drawImage(
              spCanvas,
              -sf.anchorX * drawScale,
              -sf.bottomY * drawScale,
              sf.w * drawScale,
              sf.h * drawScale,
            );
            baseCtx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || spitterJuice?.flashRgba || enemyCutIn.flashRgba) {
            baseCtx.globalCompositeOperation = 'lighter';
            const flashRgb = enemyCutIn.flashRgba ?? spitterJuice?.flashRgba;
            if (flashRgb) {
              drawCanvas2DCutInFlash(baseCtx, flashRgb, size * 0.36, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              baseCtx.beginPath();
              baseCtx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
              baseCtx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              baseCtx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              baseCtx.beginPath();
              baseCtx.ellipse(2, -size * 0.44, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
              baseCtx.fill();
            }
          }
          baseCtx.restore();
        }

        if (!ea?.dead && !tacticalViewActive && (windupProg > 0.02 || streamProg > 0.01)) {
          const headDeformDx = spitterJuice ? spitterJuice.deform.head.dx * drawScale * juiceFacing : 0;
          const headDeformDy = spitterJuice ? spitterJuice.deform.head.dy * drawScale : 0;
          const mouthX = spitterWorldX + sf.mouthOriginRel.dx * drawScale * (-juiceFacing) + headDeformDx;
          const mouthY = enemyGroundY + hopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
          const heroImpactX = heroCutInDrawX + 18 * baseScale;
          const heroImpactY = groundY - heroTargetHeight * 0.48;
          renderSpitterBileTorrent(fgCtx, sim, {
            mouthX,
            mouthY,
            targetX: heroImpactX,
            targetY: heroImpactY,
            groundY,
            baseScale,
            windupProgress: windupProg,
            streamProgress: streamProg,
            elapsed,
            seed: idx,
          });
        }
      }
    } else if (isBrute && bruteSample && sim.bruteFrames) {
      const bruteJuice = sim.bruteJuiceSamples?.get(enemy.id);
      const bCanvas = sim.bruteFrames[bruteSample.frameIndex] ?? sim.bruteFrames[0];
      if (bCanvas) {
        const bf = bruteSample.frame;
        const pf = bruteSample.prevFrame;
        const drawScale = size / BRUTE_CANONICAL_HEIGHT;
        const juiceHopY = bruteJuice ? bruteJuice.hopYPx * drawScale : bruteSample.yHopPx * drawScale;
        const juiceRot = bruteJuice ? bruteJuice.rotationRad : bruteSample.tiltRad;
        const juiceFacing = bruteJuice ? bruteJuice.facingScale : -1;
        const hopY = ea?.dead ? 0 : juiceHopY;

        if (bruteSample.vialGlowIntensity > 0.32 && !ea?.dead && !tacticalViewActive) {
          const vialAlpha = Math.min(0.68, (bruteSample.vialGlowIntensity - 0.25) * 0.85);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spriteX + bf.vialOriginRel.dx * drawScale * (-juiceFacing);
          const gy = enemyGroundY + hopY + bf.vialOriginRel.dy * drawScale;
          const vRad = size * (bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace' ? 0.38 : 0.22);
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
              const ang = -Math.PI * 0.8 + d * 0.55 + elapsed * 3.2;
              const dist = size * (0.09 + 0.05 * Math.sin(elapsed * 8 + d));
              fgCtx.beginPath();
              fgCtx.arc(gx + Math.cos(ang) * dist, gy + Math.sin(ang) * dist, 2.6, 0, Math.PI * 2);
              fgCtx.fill();
            }
          }
          fgCtx.restore();
        }

        if (bruteSample.shellGlowIntensity > 0.32 && !ea?.dead && !tacticalViewActive) {
          const shellAlpha = Math.min(0.72, (bruteSample.shellGlowIntensity - 0.25) * 0.88);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const sx = spriteX + bf.shellOriginRel.dx * drawScale * (-juiceFacing);
          const sy = enemyGroundY + hopY + bf.shellOriginRel.dy * drawScale;
          const sRad = size * (bruteSample.mode === 'staggerHover' || bruteSample.mode === 'heavySmash' || bruteJuice?.activeTrigger === 'seismic_smash' ? 0.46 : 0.34);
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
            ((bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace') && bruteSample.frameIndex === 6)
          ) {
            const rayLen = size * (bruteSample.mode === 'heavySmash' || bruteJuice?.activeTrigger === 'seismic_smash' ? 0.38 : 0.28);
            fgCtx.strokeStyle = `rgba(253, 186, 116, ${0.42 + 0.3 * shellAlpha})`;
            fgCtx.lineWidth = 2;
            const angles = [-2.25, -1.8, -1.3, -0.82];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              fgCtx.beginPath();
              fgCtx.moveTo(sx + Math.cos(ang) * (size * 0.08), sy + Math.sin(ang) * (size * 0.08));
              fgCtx.lineTo(sx + Math.cos(ang) * rayLen, sy + Math.sin(ang) * rayLen);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        if (bruteSample.shockwaveIntensity > 0.08 && !ea?.dead && !tacticalViewActive) {
          const sw = bruteSample.shockwaveIntensity;
          const ix = spriteX + bf.impactOriginRel.dx * drawScale * (-juiceFacing);
          const iy = enemyGroundY + 2;
          fgCtx.save();
          fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.78 * Math.min(1, sw)})`;
          fgCtx.lineWidth = 3 * Math.min(1.3, sw);
          fgCtx.beginPath();
          fgCtx.ellipse(ix, iy, size * (0.28 + (1 - Math.min(1, sw)) * 0.34), 10 + (1 - Math.min(1, sw)) * 8, 0, 0, Math.PI * 2);
          fgCtx.stroke();

          fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.62 * Math.min(1, sw)})`;
          fgCtx.lineWidth = 1.6;
          fgCtx.beginPath();
          fgCtx.ellipse(ix, iy, size * (0.16 + (1 - Math.min(1, sw)) * 0.22), 6 + (1 - Math.min(1, sw)) * 5, 0, 0, Math.PI * 2);
          fgCtx.stroke();
          fgCtx.restore();
        }

        const blendA = bruteSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          bruteSample.prevFrameIndex !== bruteSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.bruteFrames[bruteSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: bruteJuice ? stagger.scaleXMul : breathScaleX * bruteSample.breathScaleX,
            breathScaleY: bruteJuice ? stagger.scaleYMul : breathScaleY * bruteSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging: isPrimedOrCharging || bruteSample.shellGlowIntensity > 0.6,
            isAcidOrPustuleActive: false,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            bruteJuice,
            cutIn: enemyCutIn,
            facingSign: juiceFacing,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: bCanvas,
            secondarySource: prevCanvas,
            worldX: spriteX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: bf.w * drawScale,
            heightPx: bf.h * drawScale,
            anchorOffsetXPx: bf.anchorX * drawScale,
            anchorOffsetYPx: bf.bottomY * drawScale,
            secondaryWidthPx: pf.w * drawScale,
            secondaryHeightPx: pf.h * drawScale,
            secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
            secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
            facingSign: juiceFacing,
            rotationRad: !ea?.dead ? stagger.rot * 0.28 + juiceRot + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          baseCtx.save();
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;
          baseCtx.translate(spriteX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            baseCtx.rotate(stagger.rot * 0.28 + juiceRot + enemyCutIn.leanRad);
          }
          const scaleX = (bruteJuice
            ? stagger.scaleXMul * bruteJuice.springScaleX
            : breathScaleX * bruteSample.breathScaleX) * enemyCutIn.scaleX;
          const scaleY = (bruteJuice
            ? stagger.scaleYMul * bruteJuice.springScaleY
            : breathScaleY * bruteSample.breathScaleY) * enemyCutIn.scaleY;
          baseCtx.scale(juiceFacing * scaleX, scaleY);

          if (prevCanvas) {
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
            baseCtx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            baseCtx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.85 + blendA * 0.15);
          }

          baseCtx.drawImage(
            bCanvas,
            -bf.anchorX * drawScale,
            -bf.bottomY * drawScale,
            bf.w * drawScale,
            bf.h * drawScale,
          );
          baseCtx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            baseCtx.save();
            baseCtx.beginPath();
            baseCtx.rect(
              -bf.w * drawScale * 0.55,
              -bf.bottomY * drawScale,
              bf.w * drawScale * 1.1,
              bf.h * drawScale * 0.48,
            );
            baseCtx.clip();
            baseCtx.translate(-stagger.shearPx, -2);
            baseCtx.drawImage(
              bCanvas,
              -bf.anchorX * drawScale,
              -bf.bottomY * drawScale,
              bf.w * drawScale,
              bf.h * drawScale,
            );
            baseCtx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || bruteJuice?.flashRgba || enemyCutIn.flashRgba) {
            baseCtx.globalCompositeOperation = 'lighter';
            const flashRgb = enemyCutIn.flashRgba ?? bruteJuice?.flashRgba;
            if (flashRgb) {
              drawCanvas2DCutInFlash(baseCtx, flashRgb, size * 0.38, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              baseCtx.beginPath();
              baseCtx.arc(0, -size * 0.44, size * 0.36, 0, Math.PI * 2);
              baseCtx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              baseCtx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              baseCtx.beginPath();
              baseCtx.ellipse(2, -size * 0.44, size * 0.3, size * 0.36, 0.2, 0, Math.PI * 2);
              baseCtx.fill();
            }
          }
          baseCtx.restore();
        }
      }
    } else if (entry) {
      const bossWorldX = ex + cutInShiftX;
      const bossFacingSign = enemy.archetype === 'brute' ? -1 : 1;
      const bossCutInBoost =
        arch === 'boss' && enemyCutIn.poseOverride === 'attack_pose' ? 1.06 : 1;
      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: arch,
          idx,
          ea,
          isDead,
          staggerShearPx: stagger.shearPx,
          staggerBioFlashAlpha: stagger.bioFlashAlpha,
          breathScaleX: breathScaleX * bossCutInBoost,
          breathScaleY: breathScaleY * bossCutInBoost,
          frameBlendAlpha: 1,
          bioEmissiveRgb,
          isPrimedOrCharging,
          isAcidOrPustuleActive,
          isStaggeredStatus: Boolean(enemy.staggered),
          elapsed,
          tacticalViewActive,
          cutIn: enemyCutIn,
          facingSign: bossFacingSign,
        });
        webglRenderer.drawSprite({
          id: `enemy:${enemy.id}`,
          primarySource: entry.canvas,
          worldX: bossWorldX,
          worldY: enemyGroundY + koOffsetY + stagger.dy,
          widthPx: size,
          heightPx: size,
          anchorOffsetXPx: size * centerXRatio,
          anchorOffsetYPx: size * bottomRatio,
          facingSign: bossFacingSign,
          rotationRad: stagger.rot + enemyCutIn.leanRad,
          alpha: koAlpha,
          drawPriority: enemyCutIn.drawPriority,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.globalAlpha = koAlpha * canvasBystanderMul;
        baseCtx.translate(bossWorldX, enemyGroundY + koOffsetY + stagger.dy);
        baseCtx.rotate(stagger.rot + enemyCutIn.leanRad);
        baseCtx.scale(
          bossFacingSign * breathScaleX * bossCutInBoost * enemyCutIn.scaleX,
          breathScaleY * bossCutInBoost * enemyCutIn.scaleY,
        );
        baseCtx.drawImage(entry.canvas, -size * centerXRatio, -size * bottomRatio, size, size);

        if (Math.abs(stagger.shearPx) > 0.5) {
          baseCtx.save();
          baseCtx.beginPath();
          baseCtx.rect(-size * 0.6, -size * 0.95, size * 1.2, size * 0.48);
          baseCtx.clip();
          baseCtx.translate(stagger.shearPx, -2);
          baseCtx.drawImage(entry.canvas, -size * centerXRatio, -size * bottomRatio, size, size);
          baseCtx.restore();
        }

        if ((ea && ea.flashTimer > 0) || stagger.bioFlashAlpha > 0.04 || enemyCutIn.flashRgba) {
          baseCtx.globalCompositeOperation = 'lighter';
          if (enemyCutIn.flashRgba) {
            drawCanvas2DCutInFlash(baseCtx, enemyCutIn.flashRgba, size * 0.36, -size * 0.44);
          } else if (ea && ea.flashTimer > 0) {
            baseCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            baseCtx.beginPath();
            baseCtx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
            baseCtx.fill();
          }
          if (stagger.bioFlashAlpha > 0.04) {
            baseCtx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
            baseCtx.beginPath();
            baseCtx.ellipse(4, -size * 0.46, size * 0.28, size * 0.36, 0.2, 0, Math.PI * 2);
            baseCtx.fill();
          }
        }
        baseCtx.restore();
      }
    }

    baseCtx.restore();
    fgCtx.save();
    fgCtx.globalAlpha = koAlpha;

    renderEnemySelectionAndUnderfootBar({
      ctx: fgCtx,
      enemy,
      idx,
      enemies,
      frontLivingIdx,
      ex,
      enemyGroundY,
      size,
      bottomRatio,
      farFootOffsetPx,
      isCrawler,
      isBrute,
      isDead,
      hoveredEnemyId,
      inspectedEnemyId,
      worldUiAlpha,
      activePreview,
      hoveringSwap,
      w,
      h,
      elapsed,
    });

    fgCtx.restore();
  }
}
