import type { CombatState } from '../../engine/types';
import {
  BRUTE_CANONICAL_HEIGHT,
  BRUTE_SHEET_FRAMES,
} from '../../utils/bruteSpriteSheet';
import {
  type BruteJuiceConfig,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
} from '../../utils/bruteJuiceController';
import {
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseJuiceConfig,
  createFeralNurseJuiceState,
  stepFeralNurseJuice,
} from '../../utils/feralNurseJuiceController';
import {
  FERAL_NURSE_CANONICAL_HEIGHT,
  FERAL_NURSE_SHEET_FRAMES,
  type FeralNurseAnimMode,
} from '../../utils/feralNurseSpriteSheet';
import {
  DEFAULT_MUTDOG_JUICE_CONFIG,
  type MutdogJuiceConfig,
  createMutdogJuiceState,
  stepMutdogJuice,
} from '../../utils/mutdogJuiceController';
import {
  MUTDOG_CANONICAL_HEIGHT,
  MUTDOG_SHEET_FRAMES,
} from '../../utils/mutdogSpriteSheet';
import {
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
} from '../../utils/spitterSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  createSpitterJuiceState,
  stepSpitterJuice,
} from '../../utils/spitterJuiceController';
import { renderSpitterGroundPuddle } from './combatDecalRenderer';
import { renderBruteBioVfxOverlay } from './combatEnemyBioSpritePass';
import { renderFeralNurseBioVfxOverlay } from './combatFeralNurseSpritePass';
import { renderSpitterBileTorrent } from './combatForegroundFxRenderer';
import { renderMutdogBioVfxOverlay } from './combatMutdogSpritePass';
import type { CombatStageSim } from './combatStageTypes';
import {
  type ICharacterStageRenderer,
  deriveEnemyDeformAndUniforms,
} from './stageSpriteAdapter';

export interface DevLabRenderPassContext {
  baseCtx: CanvasRenderingContext2D;
  fgCtx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  sim: CombatStageSim;
  combat: CombatState;
  w: number;
  h: number;
  heroX: number;
  enemyBaseX: number;
  groundY: number;
  heroTargetHeight: number;
  baseScale: number;
  elapsed: number;
  tacticalViewActive: boolean;
  spitterLabActive: boolean;
  spitterJuiceConfig?: SpitterJuiceConfig;
  bruteLabActive: boolean;
  bruteJuiceConfig?: BruteJuiceConfig;
  mutdogLabActive: boolean;
  mutdogJuiceConfig?: MutdogJuiceConfig;
  feralNurseLabActive: boolean;
  feralNurseJuiceConfig?: FeralNurseJuiceConfig;
}

export function renderDevLabPass(ctx: DevLabRenderPassContext): void {
  const {
    baseCtx,
    fgCtx,
    webglRenderer,
    sim,
    combat,
    w,
    h,
    heroX,
    enemyBaseX,
    groundY,
    heroTargetHeight,
    baseScale,
    elapsed,
    tacticalViewActive,
    spitterLabActive,
    spitterJuiceConfig = DEFAULT_SPITTER_JUICE_CONFIG,
    bruteLabActive,
    bruteJuiceConfig = DEFAULT_BRUTE_JUICE_CONFIG,
    mutdogLabActive,
    mutdogJuiceConfig = DEFAULT_MUTDOG_JUICE_CONFIG,
    feralNurseLabActive,
    feralNurseJuiceConfig = DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  } = ctx;

  const enemies = combat.enemies;

  const hasLivingSpitter = enemies.some((e) => e.archetype === 'spitter' && e.hp > 0);
  if (spitterLabActive && !hasLivingSpitter && sim.spitterFrames) {
    let labJuice = sim.spitterJuiceSamples?.get('spitter_lab_specimen');
    if (!labJuice) {
      let labState = sim.spitterJuiceStates.get('spitter_lab_specimen');
      if (!labState) {
        labState = createSpitterJuiceState();
        sim.spitterJuiceStates.set('spitter_lab_specimen', labState);
      }
      labJuice = stepSpitterJuice(labState, 0, elapsed, spitterJuiceConfig, {
        instanceIndex: 0,
      });
    }
    const spCanvas = sim.spitterFrames[labJuice.frameIndex] ?? sim.spitterFrames[0];
    if (spCanvas) {
      const sf = SPITTER_SHEET_FRAMES[labJuice.frameIndex] ?? SPITTER_SHEET_FRAMES[0];
      const pf = SPITTER_SHEET_FRAMES[labJuice.prevFrameIndex] ?? sf;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 0.98;
      const drawScale = size / SPITTER_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.58);
      const labWorldX = labBaseX + labJuice.offsetX * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      baseCtx.save();
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.68)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 2, size * 0.34, 8, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = 'rgba(163, 230, 53, 0.72)';
      baseCtx.lineWidth = 1.8;
      baseCtx.setLineDash([5, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 2, size * 0.38, 9.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      renderSpitterGroundPuddle(
        baseCtx,
        labBaseX + (labWorldX - labBaseX) * 0.28,
        labGroundY + 1,
        size,
        1,
        labJuice.pustuleGlowIntensity,
        Math.max(labJuice.spitWindupProgress, labJuice.spitStreamProgress),
        elapsed,
        0,
      );

      if (labJuice.pustuleGlowIntensity > 0.35 && !tacticalViewActive) {
        const glowAlpha = Math.min(0.75, (labJuice.pustuleGlowIntensity - 0.25) * 0.9);
        fgCtx.save();
        fgCtx.globalCompositeOperation = 'lighter';
        const gx = labWorldX + sf.pustuleOriginRel.dx * drawScale * (-labJuice.facingScale);
        const gy = labGroundY + labHopY + sf.pustuleOriginRel.dy * drawScale;
        const rad = size * 0.38;
        const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
        grad.addColorStop(0, `rgba(254, 240, 138, ${glowAlpha})`);
        grad.addColorStop(0.45, `rgba(163, 230, 53, ${glowAlpha * 0.52})`);
        grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
        fgCtx.fillStyle = grad;
        fgCtx.beginPath();
        fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
        fgCtx.fill();
        fgCtx.restore();
      }

      const prevCanvas =
        labJuice.frameBlendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.spitterFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'spitter',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.frameBlendAlpha : 1,
          bioEmissiveRgb: [0.64, 0.9, 0.21],
          isPrimedOrCharging: labJuice.activeTrigger === 'cast_charge',
          isAcidOrPustuleActive: labJuice.activeTrigger === 'cast_charge',
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          spitterJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:spitter_lab_specimen',
          primarySource: spCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: sf.w * drawScale,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale,
          anchorOffsetYPx: sf.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: 1,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
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
        !tacticalViewActive &&
        (labJuice.spitWindupProgress > 0.02 || labJuice.spitStreamProgress > 0.01)
      ) {
        const headDeformDx = labJuice.deform.head.dx * drawScale * labJuice.facingScale;
        const headDeformDy = labJuice.deform.head.dy * drawScale;
        const mouthX = labWorldX + sf.mouthOriginRel.dx * drawScale * (-labJuice.facingScale) + headDeformDx;
        const mouthY = labGroundY + labHopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
        const heroImpactX = heroX + 18 * baseScale;
        const heroImpactY = groundY - heroTargetHeight * 0.48;
        renderSpitterBileTorrent(fgCtx, sim, {
          mouthX,
          mouthY,
          targetX: heroImpactX,
          targetY: heroImpactY,
          groundY,
          baseScale,
          windupProgress: labJuice.spitWindupProgress,
          streamProgress: labJuice.spitStreamProgress,
          elapsed,
          seed: 7,
        });
      }
    }
  }

  const hasLivingBrute = enemies.some((e) => e.archetype === 'brute' && e.hp > 0);
  if (bruteLabActive && !hasLivingBrute && sim.bruteFrames) {
    let labJuice = sim.bruteJuiceSamples?.get('brute_lab_specimen');
    if (!labJuice) {
      let labState = sim.bruteJuiceStates.get('brute_lab_specimen');
      if (!labState) {
        labState = createBruteJuiceState();
        sim.bruteJuiceStates.set('brute_lab_specimen', labState);
      }
      labJuice = stepBruteJuice(labState, 0, elapsed, bruteJuiceConfig, {
        instanceIndex: 0,
      });
    }
    const bCanvas = sim.bruteFrames[labJuice.frameIndex] ?? sim.bruteFrames[0];
    if (bCanvas) {
      const bf = BRUTE_SHEET_FRAMES[labJuice.frameIndex] ?? BRUTE_SHEET_FRAMES[1];
      const pf = BRUTE_SHEET_FRAMES[labJuice.prevFrameIndex] ?? bf;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 1.28;
      const drawScale = size / BRUTE_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.62);
      const labWorldX = labBaseX + labJuice.offsetX * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      baseCtx.save();
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.72)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.44, 9.5, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = 'rgba(251, 146, 60, 0.75)';
      baseCtx.lineWidth = 2;
      baseCtx.setLineDash([6, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.46, 10.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      if (!tacticalViewActive) {
        renderBruteBioVfxOverlay({
          fgCtx,
          frame: bf,
          frameIndex: labJuice.frameIndex,
          mode: labJuice.mode,
          spriteX: labWorldX,
          enemyGroundY: labGroundY,
          hopY: labHopY,
          size,
          drawScale,
          facingSign: labJuice.facingScale,
          vialGlowIntensity: labJuice.vialGlowIntensity,
          shellGlowIntensity: labJuice.shellGlowIntensity,
          shockwaveIntensity: labJuice.shockwaveIntensity,
          clawSlashProgress: labJuice.clawSlashProgress,
          mutagenMistProgress: labJuice.mutagenMistProgress,
          seismicImpactProgress: labJuice.seismicImpactProgress,
          waistDeformDx: labJuice.deform.waist.dx * drawScale * labJuice.facingScale,
          waistDeformDy: labJuice.deform.waist.dy * drawScale,
          headDeformDx: labJuice.deform.head.dx * drawScale * labJuice.facingScale,
          headDeformDy: labJuice.deform.head.dy * drawScale,
          elapsed,
          seed: 3,
        });
      }

      const prevCanvas =
        labJuice.frameBlendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.bruteFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'brute',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.frameBlendAlpha : 1,
          bioEmissiveRgb: [0.98, 0.57, 0.24],
          isPrimedOrCharging: labJuice.activeTrigger === 'mutagen_brace' || labJuice.activeTrigger === 'seismic_smash',
          isAcidOrPustuleActive: false,
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          bruteJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:brute_lab_specimen',
          primarySource: bCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: bf.w * drawScale,
          heightPx: bf.h * drawScale,
          anchorOffsetXPx: bf.anchorX * drawScale,
          anchorOffsetYPx: bf.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: 1,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
        baseCtx.drawImage(
          bCanvas,
          -bf.anchorX * drawScale,
          -bf.bottomY * drawScale,
          bf.w * drawScale,
          bf.h * drawScale,
        );
        baseCtx.restore();
      }
    }
  }

  const hasLivingMutdog = enemies.some((e) => e.archetype === 'mutdog' && e.hp > 0);
  if (mutdogLabActive && !hasLivingMutdog && sim.mutdogFrames) {
    let labJuice = sim.mutdogJuiceSamples?.get('mutdog_lab_specimen');
    if (!labJuice) {
      let labState = sim.mutdogJuiceStates.get('mutdog_lab_specimen');
      if (!labState) {
        labState = createMutdogJuiceState();
        sim.mutdogJuiceStates.set('mutdog_lab_specimen', labState);
      }
      labJuice = stepMutdogJuice(labState, 0, elapsed, mutdogJuiceConfig, {
        instanceIndex: 0,
      });
    }
    const mCanvas = sim.mutdogFrames[labJuice.frameIndex] ?? sim.mutdogFrames[0];
    if (mCanvas) {
      const mf = MUTDOG_SHEET_FRAMES[labJuice.frameIndex] ?? MUTDOG_SHEET_FRAMES[0];
      const pf = MUTDOG_SHEET_FRAMES[labJuice.prevFrameIndex] ?? mf;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 0.98;
      const drawScale = size / MUTDOG_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.60);
      const labWorldX = labBaseX + labJuice.offsetX * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      baseCtx.save();
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.70)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.36, 8.2, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = 'rgba(163, 230, 53, 0.78)';
      baseCtx.lineWidth = 1.8;
      baseCtx.setLineDash([5, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.40, 9.4, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      if (!tacticalViewActive) {
        renderMutdogBioVfxOverlay({
          fgCtx,
          frame: mf,
          frameIndex: labJuice.frameIndex,
          mode: labJuice.mode,
          spriteX: labWorldX,
          enemyGroundY: labGroundY,
          hopY: labHopY,
          size,
          drawScale,
          facingSign: labJuice.facingScale,
          lureGlowIntensity: labJuice.lureGlowIntensity,
          droolIntensity: labJuice.droolIntensity,
          pounceImpactIntensity:
            labJuice.pounceImpactProgress > 0.01
              ? Math.sin(labJuice.pounceImpactProgress * Math.PI)
              : 0,
          clawSlashProgress: labJuice.clawSlashProgress,
          pounceImpactProgress: labJuice.pounceImpactProgress,
          howlPulseProgress: labJuice.howlPulseProgress,
          waistDeformDx: labJuice.deform.waist.dx * drawScale * labJuice.facingScale,
          waistDeformDy: labJuice.deform.waist.dy * drawScale,
          headDeformDx: labJuice.deform.head.dx * drawScale * labJuice.facingScale,
          headDeformDy: labJuice.deform.head.dy * drawScale,
          elapsed,
          seed: 5,
        });
      }

      const prevCanvas =
        labJuice.frameBlendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.mutdogFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'mutdog',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.frameBlendAlpha : 1,
          bioEmissiveRgb: [0.64, 0.9, 0.21],
          isPrimedOrCharging:
            labJuice.activeTrigger === 'frenzy_howl' || labJuice.activeTrigger === 'pounce_maul',
          isAcidOrPustuleActive: false,
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          mutdogJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:mutdog_lab_specimen',
          primarySource: mCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: mf.w * drawScale,
          heightPx: mf.h * drawScale,
          anchorOffsetXPx: mf.anchorX * drawScale,
          anchorOffsetYPx: mf.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: 1,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
        baseCtx.drawImage(
          mCanvas,
          -mf.anchorX * drawScale,
          -mf.bottomY * drawScale,
          mf.w * drawScale,
          mf.h * drawScale,
        );
        baseCtx.restore();
      }
    }
  }

  const hasLivingFeralNurse = enemies.some((e) => e.archetype === 'feral_nurse' && e.hp > 0);
  if (feralNurseLabActive && !hasLivingFeralNurse && sim.feralNurseFrames) {
    let labJuice = sim.feralNurseJuiceSamples?.get('feral_nurse_lab_specimen');
    if (!labJuice) {
      let labState = sim.feralNurseJuiceStates.get('feral_nurse_lab_specimen');
      if (!labState) {
        labState = createFeralNurseJuiceState();
        sim.feralNurseJuiceStates.set('feral_nurse_lab_specimen', labState);
      }
      labJuice = stepFeralNurseJuice(labState, 0, elapsed, feralNurseJuiceConfig);
    }
    const fCanvas = sim.feralNurseFrames[labJuice.frameIndex] ?? sim.feralNurseFrames[0];
    if (fCanvas) {
      const ff = FERAL_NURSE_SHEET_FRAMES[labJuice.frameIndex] ?? FERAL_NURSE_SHEET_FRAMES[0];
      const pf = FERAL_NURSE_SHEET_FRAMES[labJuice.prevFrameIndex] ?? ff;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 1.04;
      const drawScale = size / FERAL_NURSE_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.58);
      const labWorldX = labBaseX + labJuice.xShiftPx * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      const labAlpha = labJuice.alpha;

      // Glass walkway planar reflection beneath stiletto heels (fades while optically cloaked)
      baseCtx.save();
      baseCtx.translate(labWorldX, labGroundY + 2 - labHopY * 0.28);
      baseCtx.scale(
        labJuice.facingScale * labJuice.springScaleX,
        -0.34 * labJuice.springScaleY,
      );
      baseCtx.globalAlpha = Math.max(0.03, (0.24 - Math.abs(labHopY) * 0.004) * labAlpha);
      baseCtx.drawImage(
        fCanvas,
        -ff.anchorX * drawScale,
        -ff.bottomY * drawScale,
        ff.w * drawScale,
        ff.h * drawScale,
      );
      baseCtx.restore();

      baseCtx.save();
      baseCtx.globalAlpha = Math.max(0.32, labAlpha);
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.70)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.34, 7.8, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle =
        labJuice.cloakIntensity > 0.25
          ? 'rgba(34, 211, 238, 0.85)'
          : 'rgba(232, 121, 249, 0.80)';
      baseCtx.lineWidth = 1.8;
      baseCtx.setLineDash([5, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.38, 9.0, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      const labMode: FeralNurseAnimMode =
        labJuice.activeTrigger === 'optical_cloak'
          ? 'opticalCloak'
          : labJuice.activeTrigger === 'pierce_strike'
            ? labJuice.frameIndex < 20
              ? 'prepareCoil'
              : 'pierceStrike'
            : labJuice.activeTrigger === 'take_hit'
              ? 'pain'
              : 'idle';

      if (!tacticalViewActive) {
        renderFeralNurseBioVfxOverlay({
          fgCtx,
          frame: ff,
          frameIndex: labJuice.frameIndex,
          mode: labMode,
          spriteX: labWorldX,
          enemyGroundY: labGroundY,
          hopY: labHopY,
          size,
          drawScale,
          facingSign: labJuice.facingScale,
          headsetGlowIntensity: labJuice.headsetGlowIntensity,
          cloakIntensity: labJuice.cloakIntensity,
          clawSlashProgress: labJuice.clawSlashProgress,
          pierceImpactIntensity: labJuice.pierceImpactIntensity,
          chestDeformDx: labJuice.deform.chest.dx * drawScale * labJuice.facingScale,
          chestDeformDy: labJuice.deform.chest.dy * drawScale,
          headDeformDx: labJuice.deform.head.dx * drawScale * labJuice.facingScale,
          headDeformDy: labJuice.deform.head.dy * drawScale,
          elapsed,
          seed: 9,
        });
      }

      const prevCanvas =
        labJuice.blendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.feralNurseFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'feral_nurse',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.blendAlpha : 1,
          bioEmissiveRgb: [0.91, 0.47, 0.98],
          isPrimedOrCharging:
            labJuice.activeTrigger === 'optical_cloak' ||
            labJuice.activeTrigger === 'pierce_strike',
          isAcidOrPustuleActive: false,
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          feralNurseJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:feral_nurse_lab_specimen',
          primarySource: fCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: ff.w * drawScale,
          heightPx: ff.h * drawScale,
          anchorOffsetXPx: ff.anchorX * drawScale,
          anchorOffsetYPx: ff.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: labAlpha,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.globalAlpha = labAlpha;
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
        baseCtx.drawImage(
          fCanvas,
          -ff.anchorX * drawScale,
          -ff.bottomY * drawScale,
          ff.w * drawScale,
          ff.h * drawScale,
        );
        baseCtx.restore();
      }
    }
  }
}
