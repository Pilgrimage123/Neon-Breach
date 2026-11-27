import type { EnemyUnit, TurnPreview } from '../../engine/types';
import { BRUTE_CANONICAL_HEIGHT } from '../../utils/bruteSpriteSheet';
import {
  isCrawlerArchetype,
  sampleCrawlerFrame,
} from '../../utils/crawlerSpriteSheet';
import { getMutantArchScale } from '../../utils/mutantAnimationRegistry';
import { FERAL_NURSE_CANONICAL_HEIGHT } from '../../utils/feralNurseSpriteSheet';
import { MUTDOG_CANONICAL_HEIGHT } from '../../utils/mutdogSpriteSheet';
import { MATRIARCH_CANONICAL_HEIGHT } from '../../utils/matriarchSpriteSheet';
import { SPITTER_CANONICAL_HEIGHT } from '../../utils/spitterSpriteSheet';
import { STALKER_CANONICAL_HEIGHT } from '../../utils/stalkerSpriteSheet';
import { getEnemyStaggerKinematics } from './combatEnemyAnimationSim';
import {
  renderBruteEnemySprite,
  renderSpitterEnemySprite,
} from './combatEnemyBioSpritePass';
import {
  type CoreEnemySpriteContext,
  renderCrawlerEnemySprite,
  renderStaticCutoutEnemySprite,
} from './combatEnemyCoreSpritePass';
import { renderFeralNurseEnemySprite } from './combatFeralNurseSpritePass';
import { renderMatriarchEnemySprite } from './combatMatriarchSpritePass';
import { renderMutdogEnemySprite } from './combatMutdogSpritePass';
import { renderStalkerEnemySprite } from './combatStalkerSpritePass';
import { type CombatStageSim, ENEMY_FOOT_DEFAULTS } from './combatStageTypes';
import { renderEnemySelectionAndUnderfootBar } from './combatTacticalOverlayRenderer';
import {
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
} from './mutantBlood';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type ICharacterStageRenderer,
  hexToRgbNorm,
} from './stageSpriteAdapter';

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
    const isMutdog = arch === 'mutdog';
    const isFeralNurse = arch === 'feral_nurse';
    const isBrute = arch === 'brute';
    const isBoss = arch === 'boss';
    const crawlerSample = isCrawler
      ? sampleCrawlerFrame(arch, ea, elapsed, idx, enemyCutIn.poseOverride)
      : null;
    const stalkerSample = isStalker ? sim.stalkerSamples?.get(enemy.id) : undefined;
    const spitterSample = isSpitter ? sim.spitterSamples?.get(enemy.id) : undefined;
    const mutdogSample = isMutdog ? sim.mutdogSamples?.get(enemy.id) : undefined;
    const feralNurseSample = isFeralNurse ? sim.feralNurseSamples?.get(enemy.id) : undefined;
    const bruteSample = isBrute ? sim.bruteSamples?.get(enemy.id) : undefined;
    const matriarchSample = isBoss ? sim.matriarchSamples?.get(enemy.id) : undefined;
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
    const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale = getMutantArchScale(arch);
    const size = baseEnemySize * archScale;
    const hasSheetSample =
      (isCrawler && Boolean(crawlerSample)) ||
      (isStalker && Boolean(stalkerSample)) ||
      (isSpitter && Boolean(spitterSample)) ||
      (isMutdog && Boolean(mutdogSample)) ||
      (isFeralNurse && Boolean(feralNurseSample)) ||
      (isBrute && Boolean(bruteSample)) ||
      (isBoss && Boolean(matriarchSample));
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash ||
      (enemyCutIn.active && enemyCutIn.role === 'target');
    const lunge =
      ea &&
      !suppressNativeShift &&
      !(isStalker && stalkerSample) &&
      !(isSpitter && spitterSample) &&
      !(isMutdog && mutdogSample) &&
      !(isFeralNurse && feralNurseSample) &&
      !(isBrute && bruteSample) &&
      !(isBoss && matriarchSample)
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
    const stalkerJuiceForPos = isStalker ? sim.stalkerJuiceSamples?.get(enemy.id) : undefined;
    const spitterJuiceForPos = isSpitter ? sim.spitterJuiceSamples?.get(enemy.id) : undefined;
    const mutdogJuiceForPos = isMutdog ? sim.mutdogJuiceSamples?.get(enemy.id) : undefined;
    const feralNurseJuiceForPos = isFeralNurse
      ? sim.feralNurseJuiceSamples?.get(enemy.id)
      : undefined;
    const bruteJuiceForPos = isBrute ? sim.bruteJuiceSamples?.get(enemy.id) : undefined;
    const matriarchJuiceForPos = isBoss ? sim.matriarchJuiceSamples?.get(enemy.id) : undefined;
    const spriteX =
      ex +
      cutInShiftX +
      (suppressNativeShift
        ? 0
        : stalkerJuiceForPos
          ? stalkerJuiceForPos.offsetX * (size / STALKER_CANONICAL_HEIGHT)
          : stalkerSample
            ? stalkerSample.xOffsetRatio * size
            : spitterJuiceForPos
              ? spitterJuiceForPos.offsetX * (size / SPITTER_CANONICAL_HEIGHT)
              : spitterSample
                ? spitterSample.xOffsetRatio * size
                : mutdogJuiceForPos
                  ? mutdogJuiceForPos.offsetX * (size / MUTDOG_CANONICAL_HEIGHT)
                  : mutdogSample
                    ? mutdogSample.xOffsetRatio * size
                    : feralNurseJuiceForPos
                      ? feralNurseJuiceForPos.xShiftPx * (size / FERAL_NURSE_CANONICAL_HEIGHT)
                      : feralNurseSample
                        ? feralNurseSample.xShiftPx * (size / FERAL_NURSE_CANONICAL_HEIGHT)
                        : bruteJuiceForPos
                          ? bruteJuiceForPos.offsetX * (size / BRUTE_CANONICAL_HEIGHT)
                          : bruteSample
                            ? bruteSample.xOffsetRatio * size
                            : matriarchJuiceForPos
                              ? matriarchJuiceForPos.offsetX * (size / MATRIARCH_CANONICAL_HEIGHT)
                              : matriarchSample
                                ? matriarchSample.xOffsetRatio * size
                                : 0);
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      hasSheetSample && ea?.dead
        ? 1
        : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasSheetSample && ea?.dead
        ? 1
        : (1 - breathPhase * 0.009) * stagger.scaleXMul;
    const koOffsetY =
      !hasSheetSample && isDead && ea?.dead ? (1 - koAlpha) * 24 : 0;

    const entry = sim.enemyCutouts.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;
    const centerXRatio = entry ? entry.bounds.centerXRatio : defaults.centerXRatio;
    const farFootOffsetPx = defaults.farFootOffsetRatio * size;

    const feralShadowMul =
      isFeralNurse && !isDead
        ? Math.max(0.28, feralNurseJuiceForPos?.alpha ?? feralNurseSample?.alpha ?? 1)
        : 1;
    baseCtx.save();
    baseCtx.globalAlpha = koAlpha * feralShadowMul;

    const isHeavyBody = isBrute || isBoss;
    const shadowHalfW = isHeavyBody ? size * 0.44 : size * 0.32;
    const ringHalfW = isHeavyBody ? size * 0.46 : size * 0.34;
    const footSpread = isHeavyBody ? 0.18 : 0.13;

    baseCtx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    baseCtx.beginPath();
    baseCtx.ellipse(
      spriteX,
      enemyGroundY - farFootOffsetPx * 0.35,
      shadowHalfW,
      isHeavyBody ? 9.5 : 7.5,
      0,
      0,
      Math.PI * 2,
    );
    baseCtx.fill();

    baseCtx.fillStyle = 'rgba(2, 5, 14, 0.84)';
    baseCtx.beginPath();
    baseCtx.ellipse(
      spriteX - size * footSpread,
      enemyGroundY - farFootOffsetPx,
      size * (isHeavyBody ? 0.16 : 0.13),
      3.8,
      0,
      0,
      Math.PI * 2,
    );
    baseCtx.fill();

    baseCtx.beginPath();
    baseCtx.ellipse(
      spriteX + size * (footSpread + 0.02),
      enemyGroundY - 1,
      size * (isHeavyBody ? 0.17 : 0.14),
      4.2,
      0,
      0,
      Math.PI * 2,
    );
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
      baseCtx.ellipse(
        spriteX,
        enemyGroundY - farFootOffsetPx * 0.3,
        ringHalfW,
        isHeavyBody ? 10.5 : 8.5,
        0,
        0,
        Math.PI * 2,
      );
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
            baseCtx.fillStyle = enemyBio.hasSuspendedVeins
              ? enemyBio.veinPrimary
              : enemyBio.freshEmissive;
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
      baseCtx.ellipse(
        spriteX,
        enemyGroundY - 2,
        size * (0.28 + sosPulse * 0.25),
        9 + sosPulse * 6,
        0,
        0,
        Math.PI * 2,
      );
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

    const spriteCtx: CoreEnemySpriteContext = {
      baseCtx,
      fgCtx,
      webglRenderer,
      sim,
      enemy,
      idx,
      ea,
      isDead,
      koAlpha,
      koOffsetY,
      size,
      ex,
      spriteX,
      cutInShiftX,
      enemyGroundY,
      breathScaleX,
      breathScaleY,
      stagger,
      canvasBystanderMul,
      enemyBio,
      bioEmissiveRgb: hexToRgbNorm(enemyBio.freshEmissive),
      isPrimedOrCharging:
        !isDead &&
        !enemy.staggered &&
        (activeIntent?.kind === 'heavy' ||
          activeIntent?.kind === 'charge' ||
          activeIntent?.kind === 'leech' ||
          Boolean(mutdogSample && mutdogSample.lureGlowIntensity > 0.72) ||
          Boolean(feralNurseSample && feralNurseSample.headsetGlowIntensity > 0.78)),
      isAcidOrPustuleActive:
        !isDead &&
        (activeIntent?.kind === 'acid' ||
          Boolean(spitterSample && spitterSample.pustuleGlowIntensity > 0.45)),
      elapsed,
      tacticalViewActive,
      enemyCutIn,
    };

    if (isCrawlerArchetype(arch) && crawlerSample) {
      renderCrawlerEnemySprite(spriteCtx, arch, crawlerSample);
    } else if (isStalker && stalkerSample && sim.stalkerFrames) {
      renderStalkerEnemySprite(spriteCtx, stalkerSample);
    } else if (isSpitter && spitterSample && sim.spitterFrames) {
      renderSpitterEnemySprite(spriteCtx, spitterSample, {
        groundY,
        heroCutInDrawX,
        heroTargetHeight,
        baseScale,
      });
    } else if (isMutdog && mutdogSample && sim.mutdogFrames) {
      renderMutdogEnemySprite(spriteCtx, mutdogSample);
    } else if (isFeralNurse && feralNurseSample && sim.feralNurseFrames) {
      renderFeralNurseEnemySprite(spriteCtx, feralNurseSample);
    } else if (isBrute && bruteSample && sim.bruteFrames) {
      renderBruteEnemySprite(spriteCtx, bruteSample);
    } else if (isBoss && matriarchSample && sim.matriarchFrames) {
      renderMatriarchEnemySprite(spriteCtx, matriarchSample);
    } else if (entry) {
      renderStaticCutoutEnemySprite(spriteCtx, entry, centerXRatio, bottomRatio);
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
