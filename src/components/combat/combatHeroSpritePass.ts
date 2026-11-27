import { previewHeroThreat } from '../../engine/gameEngine';
import type {
  CharacterId,
  CombatState,
  HeroState,
  HeroThreatPreview,
  TileType,
  TurnPreview,
} from '../../engine/types';
import type { Language } from '../../i18n/translations';
import { AURALINE_SHEET_FRAMES } from '../../utils/auralineSpriteSheet';
import { resolveAuralineCutInFrameIndex } from '../../utils/auralineJuiceController';
import { resolveKiraCutInFrameIndex } from '../../utils/kiraJuiceController';
import {
  KIRA_SHEET_FRAMES,
  type HeroFrameDef as SpriteFrame,
  type HeroFrameSample,
} from '../../utils/kiraSpriteSheet';
import {
  ZURI_SHEET_FRAMES,
  type ZuriDroneId,
  type ZuriDronePose,
} from '../../utils/zuriSpriteSheet';
type ZuriDroneFormationSample = Record<ZuriDroneId, ZuriDronePose>;
import type { SequencerFrameState } from './CombatActionSequencer';
import type { CombatStageSim } from './combatStageTypes';
import type { ActorJuiceSnapshot } from './SpriteJuiceFeedbackHandler';
import {
  type ICharacterStageRenderer,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  deriveHeroDeformAndUniforms,
} from './stageSpriteAdapter';

export function drawCanvas2DCutInFlash(
  ctx: CanvasRenderingContext2D,
  flashRgba: readonly [number, number, number, number] | undefined,
  radius: number,
  centerYOffset: number,
): void {
  if (!flashRgba || flashRgba[3] <= 0.02) return;
  const [fr, fg, fb, fa] = flashRgba;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(${Math.round(fr * 255)}, ${Math.round(fg * 255)}, ${Math.round(fb * 255)}, ${Math.min(0.85, fa * 0.72)})`;
  ctx.beginPath();
  ctx.arc(0, centerYOffset, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function resolveHeroCutInFrameIndex(
  charId: CharacterId,
  cutIn: ActorJuiceSnapshot,
  seqPhase: SequencerFrameState['phase'] | undefined,
  fallbackIndex: number,
  heroMode?: string,
): number {
  if (charId === 'kira') {
    return resolveKiraCutInFrameIndex(cutIn, seqPhase, heroMode, fallbackIndex);
  }
  if (charId === 'auraline') {
    return resolveAuralineCutInFrameIndex(cutIn, seqPhase, heroMode, fallbackIndex);
  }
  if (!cutIn.active || cutIn.poseOverride === 'none') return fallbackIndex;
  const isWindup = seqPhase === 'windup' || seqPhase === 'travel';
  if (charId === 'zuri') {
    if (cutIn.poseOverride === 'attack_pose') return isWindup ? 19 : 20;
    if (cutIn.poseOverride === 'brace_pose') return 46;
    if (cutIn.poseOverride === 'recoil_pose') return 2;
    return fallbackIndex;
  }
  if (cutIn.poseOverride === 'attack_pose') {
    if (cutIn.isMeleeClash) return isWindup ? 16 : 18;
    return isWindup ? 9 : 10;
  }
  if (cutIn.poseOverride === 'brace_pose') return 22;
  if (cutIn.poseOverride === 'recoil_pose') return 24;
  return fallbackIndex;
}

export function renderHeroReflection(params: {
  ctx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  activeFrames: HTMLCanvasElement[] | null;
  charId: CharacterId;
  resolvedHeroFrameIndex: number;
  resolvedHeroFrame: SpriteFrame;
  defaultRefFrame: SpriteFrame;
  heroTargetHeight: number;
  canonicalHeight: number;
  heroCutIn: ActorJuiceSnapshot;
  reflDimmerAlpha: number;
  heroCutInDrawX: number;
  groundY: number;
  heroSample: HeroFrameSample;
  isProne: boolean;
  tacticalViewActive: boolean;
}): void {
  const {
    ctx,
    webglRenderer,
    activeFrames,
    charId,
    resolvedHeroFrameIndex,
    resolvedHeroFrame,
    defaultRefFrame,
    heroTargetHeight,
    canonicalHeight,
    heroCutIn,
    reflDimmerAlpha,
    heroCutInDrawX,
    groundY,
    heroSample,
    isProne,
    tacticalViewActive,
  } = params;

  if (!activeFrames || isProne || tacticalViewActive) return;

  const rawCanvas = activeFrames[resolvedHeroFrameIndex];
  const frameCanvas = rawCanvas || activeFrames[charId === 'zuri' ? 8 : 0] || activeFrames[0];
  const refFrame = rawCanvas ? resolvedHeroFrame : defaultRefFrame;
  const refScale = (heroTargetHeight / canonicalHeight) * refFrame.rowScale;
  const heroReflDim =
    heroCutIn.role === 'bystander' && reflDimmerAlpha > 0.01
      ? Math.max(0.25, 1 - reflDimmerAlpha * 0.85)
      : 1;
  if (!frameCanvas) return;

  if (webglRenderer) {
    webglRenderer.drawSprite({
      id: 'refl:hero',
      primarySource: frameCanvas,
      worldX: heroCutInDrawX,
      worldY: groundY + 1,
      widthPx: refFrame.w * refScale * heroCutIn.scaleX,
      heightPx: refFrame.h * refScale,
      anchorOffsetXPx: refFrame.anchorX * refScale * heroCutIn.scaleX,
      anchorOffsetYPx: refFrame.bottomY * refScale,
      facingSign: 1,
      verticalScaleSign: -0.32 * heroSample.breathScaleY * heroCutIn.scaleY,
      rotationRad: 0,
      alpha: 0.13 * heroReflDim,
      isReflection: true,
      deform: createIdentityControlPoints(),
      uniforms: createDefaultShaderUniforms(),
    });
  } else {
    ctx.save();
    ctx.globalAlpha = 0.13 * heroReflDim;
    ctx.translate(heroCutInDrawX, groundY + 1);
    ctx.scale(heroCutIn.scaleX, -0.32 * heroSample.breathScaleY * heroCutIn.scaleY);
    ctx.drawImage(
      frameCanvas,
      -refFrame.anchorX * refScale,
      -refFrame.bottomY * refScale,
      refFrame.w * refScale,
      refFrame.h * refScale,
    );
    ctx.restore();
  }
}

export function renderHeroSpritePass(params: {
  baseCtx: CanvasRenderingContext2D;
  fgCtx: CanvasRenderingContext2D;
  webglRenderer: ICharacterStageRenderer | null;
  sim: CombatStageSim;
  combat: CombatState;
  hero: HeroState;
  charId: CharacterId;
  hoveredColor: TileType | null;
  heroSample: HeroFrameSample;
  resolvedHeroFrameIndex: number;
  resolvedHeroFrame: SpriteFrame;
  defaultRefFrame: SpriteFrame;
  heroCutIn: ActorJuiceSnapshot;
  isKiraDodging: boolean;
  isProne: boolean;
  heroTargetHeight: number;
  canonicalHeight: number;
  baseScale: number;
  heroDrawScale: number;
  heroX: number;
  heroY: number;
  heroCutInDrawX: number;
  groundY: number;
  enemyBaseX: number;
  enemyStepX: number;
  slotCenters: readonly number[];
  zuriDrones: ZuriDroneFormationSample | null;
  dimmerAlpha: number;
  worldUiAlpha: number;
  elapsed: number;
  tacticalViewActive: boolean;
  activePreview: TurnPreview | null;
  precomputedThreat?: HeroThreatPreview;
  lang?: Language;
}): void {
  const {
    baseCtx,
    fgCtx,
    webglRenderer,
    sim,
    combat,
    hero,
    charId,
    hoveredColor,
    heroSample,
    resolvedHeroFrameIndex,
    resolvedHeroFrame,
    defaultRefFrame,
    heroCutIn,
    isKiraDodging,
    isProne,
    heroTargetHeight,
    canonicalHeight,
    baseScale,
    heroDrawScale,
    heroX,
    heroY,
    heroCutInDrawX,
    groundY,
    enemyBaseX,
    enemyStepX,
    slotCenters,
    zuriDrones,
    dimmerAlpha,
    worldUiAlpha,
    elapsed,
    tacticalViewActive,
    activePreview,
    precomputedThreat,
    lang = 'cs',
  } = params;

  const { w, h } = sim.size;
  const enemies = combat.enemies;
  const heroFrame = heroSample.frame;
  const activeFrames = sim.heroFramesByChar[charId];
  const sheetFrames =
    charId === 'auraline'
      ? AURALINE_SHEET_FRAMES
      : charId === 'zuri'
        ? ZURI_SHEET_FRAMES
        : KIRA_SHEET_FRAMES;

  const shadowRadiusX = isProne ? heroTargetHeight * 0.54 : heroTargetHeight * 0.32;
  baseCtx.fillStyle = 'rgba(3, 7, 18, 0.68)';
  baseCtx.beginPath();
  baseCtx.ellipse(heroCutInDrawX, groundY - 1, shadowRadiusX, 8.5, 0, 0, Math.PI * 2);
  baseCtx.fill();

  if (!isProne && charId !== 'zuri' && heroSample.yHopPx >= -2) {
    baseCtx.fillStyle = 'rgba(2, 5, 14, 0.85)';
    baseCtx.beginPath();
    baseCtx.ellipse(
      heroCutInDrawX - 18 * heroDrawScale,
      groundY - 5 * heroDrawScale,
      14 * heroDrawScale,
      4.2 * heroDrawScale,
      0,
      0,
      Math.PI * 2,
    );
    baseCtx.fill();

    baseCtx.beginPath();
    baseCtx.ellipse(
      heroCutInDrawX + 17 * heroDrawScale,
      groundY + 0.5,
      15 * heroDrawScale,
      4.5 * heroDrawScale,
      0,
      0,
      Math.PI * 2,
    );
    baseCtx.fill();

    baseCtx.strokeStyle = 'rgba(0, 229, 255, 0.26)';
    baseCtx.lineWidth = 1.25;
    baseCtx.beginPath();
    baseCtx.ellipse(heroCutInDrawX, groundY - 1, shadowRadiusX * 0.92, 6.5, 0, 0, Math.PI * 2);
    baseCtx.stroke();
  }

  if (charId === 'zuri' && hero.hp > 0) {
    const altitudeFactor = Math.max(0.35, Math.min(1.15, 1 + heroSample.yHopPx / 120));
    const jetPulse = 0.65 + 0.35 * Math.sin(elapsed * 12);
    baseCtx.save();
    baseCtx.strokeStyle = `rgba(0, 229, 255, ${0.32 * altitudeFactor * jetPulse})`;
    baseCtx.lineWidth = 1.5;
    baseCtx.beginPath();
    baseCtx.ellipse(
      heroCutInDrawX,
      groundY - 1,
      shadowRadiusX * (0.62 + (1 - altitudeFactor) * 0.4),
      5.5 * altitudeFactor,
      0,
      0,
      Math.PI * 2,
    );
    baseCtx.stroke();
    baseCtx.restore();
  }

  if (heroSample.state.mode === 'idle' && hoveredColor) {
    const hoverPulse = 0.55 + 0.3 * Math.sin(elapsed * 5.2);
    if (hoveredColor === 'tech') {
      baseCtx.save();
      baseCtx.strokeStyle = `rgba(255, 184, 0, ${0.55 * hoverPulse})`;
      baseCtx.lineWidth = 2.5;
      baseCtx.beginPath();
      baseCtx.ellipse(heroX, groundY - 1, heroTargetHeight * 0.38, 10, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();
    } else if (hoveredColor === 'defense') {
      baseCtx.save();
      baseCtx.strokeStyle = `rgba(0, 229, 255, ${0.5 * hoverPulse})`;
      baseCtx.setLineDash([6, 5]);
      baseCtx.lineWidth = 2;
      baseCtx.beginPath();
      const shieldCenterX = zuriDrones ? zuriDrones.shield.x + 18 * baseScale : heroX + 12;
      baseCtx.arc(shieldCenterX, groundY - heroTargetHeight * 0.48, heroTargetHeight * 0.46, -Math.PI * 0.38, Math.PI * 0.38);
      baseCtx.stroke();
      baseCtx.restore();
    } else if (hoveredColor === 'attack' && (heroFrame.muzzleRel || zuriDrones)) {
      const frontIdx = enemies.findIndex((e) => e.hp > 0);
      if (frontIdx !== -1) {
        const targetX = enemyBaseX + (slotCenters[frontIdx] ?? frontIdx) * enemyStepX;
        const targetY = groundY - (frontIdx % 2 === 1 ? 6 : 0) - 88;
        const mx = zuriDrones
          ? zuriDrones.strike.muzzleX
          : heroX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
        const my = zuriDrones
          ? zuriDrones.strike.muzzleY
          : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
        baseCtx.save();
        baseCtx.strokeStyle = `rgba(255, 46, 126, ${0.68 * hoverPulse})`;
        baseCtx.setLineDash([8, 6]);
        baseCtx.lineWidth = 2.0;
        baseCtx.beginPath();
        baseCtx.moveTo(mx, my);
        baseCtx.lineTo(targetX, targetY);
        baseCtx.stroke();
        baseCtx.restore();
      }
    }
  }

  if (sim.upgradeBeamTimer > 0) {
    const alpha = sim.upgradeBeamTimer / 0.55;
    const beamGrad = baseCtx.createLinearGradient(heroX, groundY, heroX, groundY - heroTargetHeight * 1.25);
    beamGrad.addColorStop(0, `rgba(255, 184, 0, ${0.55 * alpha})`);
    beamGrad.addColorStop(1, 'rgba(255, 184, 0, 0)');
    baseCtx.fillStyle = beamGrad;
    baseCtx.fillRect(heroX - heroTargetHeight * 0.35, groundY - heroTargetHeight * 1.25, heroTargetHeight * 0.7, heroTargetHeight * 1.25);
  }

  if (activeFrames && sim.ghosts.length > 0) {
    for (let i = 0; i < sim.ghosts.length; i++) {
      const g = sim.ghosts[i];
      const gf = sheetFrames[g.frameIndex] ?? defaultRefFrame;
      const gCanvas = activeFrames[g.frameIndex];
      if (!gCanvas) continue;
      const isDodgeGhost = Boolean(g.isDodge) || isKiraDodging || gf.sheet === 'dodge';
      const ghostAlpha = Math.min(0.85, g.alpha * (isDodgeGhost ? 0.82 : 0.45));
      if (webglRenderer) {
        const ghostUniforms = createDefaultShaderUniforms();
        ghostUniforms.tintRgba = isDodgeGhost ? [0.10, 0.96, 1.0, 1.0] : [0.65, 0.95, 1.0, 1.0];
        if (isDodgeGhost) {
          ghostUniforms.flashRgba = [0.0, 0.96, 1.0, 0.54];
        }
        ghostUniforms.uvDistortAmp = isDodgeGhost ? [0.005, 0.002] : [0.004, 0.002];
        ghostUniforms.uvDistortFreq = 18;
        ghostUniforms.uvDistortPhase = elapsed * 10 + i;
        webglRenderer.drawSprite({
          id: `ghost:${i}`,
          primarySource: gCanvas,
          worldX: g.x,
          worldY: g.y,
          widthPx: gf.w * g.drawScale,
          heightPx: gf.h * g.drawScale,
          anchorOffsetXPx: gf.anchorX * g.drawScale,
          anchorOffsetYPx: gf.bottomY * g.drawScale,
          facingSign: 1,
          rotationRad: 0,
          alpha: ghostAlpha,
          drawPriority: isDodgeGhost ? Math.max(1, heroCutIn.drawPriority) : undefined,
          deform: createIdentityControlPoints(),
          uniforms: ghostUniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.globalAlpha = ghostAlpha;
        if (isDodgeGhost) {
          baseCtx.filter = 'drop-shadow(0 0 8px #00F0FF) brightness(1.3) saturate(1.4)';
        }
        baseCtx.translate(g.x, g.y);
        baseCtx.drawImage(
          gCanvas,
          -gf.anchorX * g.drawScale,
          -gf.bottomY * g.drawScale,
          gf.w * g.drawScale,
          gf.h * g.drawScale,
        );
        baseCtx.restore();
      }
    }
  }

  if (activeFrames) {
    const rawCanvas = activeFrames[resolvedHeroFrameIndex];
    const frameCanvas = rawCanvas || activeFrames[charId === 'zuri' ? 8 : 0] || activeFrames[0];
    const drawFrame = rawCanvas ? resolvedHeroFrame : defaultRefFrame;
    const drawScale = (heroTargetHeight / canonicalHeight) * drawFrame.rowScale;

    if (frameCanvas) {
      const blendA = heroSample.frameBlendAlpha;
      const canCrossBlend =
        (isKiraDodging || heroCutIn.poseOverride === 'none') &&
        !heroSample.isDashing &&
        blendA < 0.99 &&
        heroSample.prevFrameIndex !== resolvedHeroFrameIndex;
      const prevCanvas = canCrossBlend ? activeFrames[heroSample.prevFrameIndex] : null;
      const heroTotalTiltRad = isKiraDodging
        ? heroSample.tiltRad
        : heroSample.tiltRad + heroCutIn.leanRad;

      if (webglRenderer) {
        const tierAJuice =
          charId === 'kira'
            ? sim.kiraJuiceSample
            : charId === 'auraline'
              ? sim.auralineJuiceSample
              : null;
        const { deform, uniforms } = deriveHeroDeformAndUniforms({
          mode: heroSample.state.mode,
          breathScaleX: tierAJuice
            ? tierAJuice.springScaleX * tierAJuice.facingScale
            : heroSample.breathScaleX,
          breathScaleY: tierAJuice ? tierAJuice.springScaleY : heroSample.breathScaleY,
          tiltRad: tierAJuice ? tierAJuice.rotationRad : heroSample.tiltRad,
          frameBlendAlpha: canCrossBlend ? blendA : 1,
          flashTimer: sim.heroAnim.flashTimer,
          corrode: hero.corrode,
          hoveredColor,
          elapsed: tacticalViewActive ? 0 : elapsed,
          isProne,
          cutIn: heroCutIn,
        });
        if (tierAJuice) {
          deform.feet = { ...tierAJuice.deform.feet };
          deform.pelvis = { ...tierAJuice.deform.pelvis };
          deform.waist = { ...tierAJuice.deform.waist };
          deform.head = { ...tierAJuice.deform.head };
          uniforms.shearPx = [tierAJuice.shearXPx, 0];
          uniforms.tintRgba = [
            uniforms.tintRgba[0] * tierAJuice.tintRgba[0],
            uniforms.tintRgba[1] * tierAJuice.tintRgba[1],
            uniforms.tintRgba[2] * tierAJuice.tintRgba[2],
            uniforms.tintRgba[3] * tierAJuice.tintRgba[3],
          ];
          if (tierAJuice.flashRgba && tierAJuice.flashRgba[3] > uniforms.flashRgba[3]) {
            uniforms.flashRgba = [...tierAJuice.flashRgba];
          }
          uniforms.uvDistortAmp = [...tierAJuice.uvDistortAmp];
          uniforms.uvDistortFreq = tierAJuice.uvDistortFreq;
        }
        webglRenderer.drawSprite({
          id: 'hero',
          primarySource: frameCanvas,
          secondarySource: prevCanvas,
          worldX: heroCutInDrawX,
          worldY: heroY,
          widthPx: drawFrame.w * drawScale,
          heightPx: drawFrame.h * drawScale,
          anchorOffsetXPx: drawFrame.anchorX * drawScale,
          anchorOffsetYPx: drawFrame.bottomY * drawScale,
          facingSign: 1,
          rotationRad: Math.abs(heroTotalTiltRad) > 0.0005 ? heroTotalTiltRad : 0,
          alpha: 1,
          drawPriority: heroCutIn.drawPriority,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        if (!isKiraDodging && heroCutIn.role === 'bystander' && dimmerAlpha > 0.01) {
          baseCtx.globalAlpha = Math.max(0.24, 1 - dimmerAlpha * 0.92);
        }
        baseCtx.translate(heroCutInDrawX, heroY);
        if (Math.abs(heroTotalTiltRad) > 0.0005) {
          baseCtx.rotate(heroTotalTiltRad);
        }
        const drawScaleX = isKiraDodging
          ? heroSample.breathScaleX
          : heroSample.breathScaleX * heroCutIn.scaleX;
        const drawScaleY = isKiraDodging
          ? heroSample.breathScaleY
          : heroSample.breathScaleY * heroCutIn.scaleY;
        baseCtx.scale(drawScaleX, drawScaleY);

        if (prevCanvas) {
          const pf = heroSample.prevFrame;
          const prevScale = (heroTargetHeight / canonicalHeight) * pf.rowScale;
          baseCtx.globalAlpha = Math.min(1, (1 - blendA) * 0.52);
          baseCtx.drawImage(
            prevCanvas,
            -pf.anchorX * prevScale,
            -pf.bottomY * prevScale,
            pf.w * prevScale,
            pf.h * prevScale,
          );
          baseCtx.globalAlpha = Math.min(1, 0.84 + blendA * 0.16);
        }

        baseCtx.drawImage(
          frameCanvas,
          -drawFrame.anchorX * drawScale,
          -drawFrame.bottomY * drawScale,
          drawFrame.w * drawScale,
          drawFrame.h * drawScale,
        );
        baseCtx.globalAlpha = 1;

        if (!isKiraDodging) {
          if (heroCutIn.flashRgba) {
            drawCanvas2DCutInFlash(baseCtx, heroCutIn.flashRgba, heroTargetHeight * 0.36, -heroTargetHeight * 0.48);
          } else if (sim.heroAnim.flashTimer > 0) {
            baseCtx.globalCompositeOperation = 'lighter';
            baseCtx.fillStyle = 'rgba(255, 160, 190, 0.38)';
            baseCtx.beginPath();
            baseCtx.arc(0, -heroTargetHeight * 0.48, heroTargetHeight * 0.34, 0, Math.PI * 2);
            baseCtx.fill();
          }
        }
        baseCtx.restore();
      }
    }
  }

  if (zuriDrones && sim.zuriDroneFrames && hero.hp > 0) {
    const controllerX = heroCutInDrawX + (resolvedHeroFrame.muzzleRel?.dx ?? 118) * heroDrawScale;
    const controllerY = heroY + (resolvedHeroFrame.muzzleRel?.dy ?? -162) * heroDrawScale;
    const droneOrder = [zuriDrones.med, zuriDrones.shield, zuriDrones.strike] as const;
    const droneCanvasIndices = [1, 0, 2] as const;
    const droneBystanderMul =
      heroCutIn.role === 'bystander' && dimmerAlpha > 0.01
        ? Math.max(0.24, 1 - dimmerAlpha * 0.92)
        : 1;

    for (let dIdx = 0; dIdx < droneOrder.length; dIdx++) {
      const pose = droneOrder[dIdx];
      const dCanvas = sim.zuriDroneFrames[droneCanvasIndices[dIdx]];
      if (!dCanvas) continue;
      const spec = pose.frameDef;
      const dScale = (spec.baseHeightPx / spec.h) * baseScale * pose.scaleMult;

      if (pose.activeGlow > 0.5) {
        fgCtx.save();
        fgCtx.strokeStyle =
          pose.id === 'strike'
            ? `rgba(255, 46, 126, ${0.32 * pose.activeGlow})`
            : pose.id === 'shield'
              ? `rgba(0, 240, 255, ${0.32 * pose.activeGlow})`
              : `rgba(16, 185, 129, ${0.35 * pose.activeGlow})`;
        fgCtx.setLineDash([5, 4]);
        fgCtx.lineWidth = 1.4;
        fgCtx.beginPath();
        fgCtx.moveTo(controllerX, controllerY);
        fgCtx.lineTo(pose.x, pose.y);
        fgCtx.stroke();
        fgCtx.restore();
      }

      if (pose.id === 'med' && (heroSample.state.mode === 'upgrade' || heroSample.state.mode === 'overdrive')) {
        fgCtx.save();
        const medBeamGrad = fgCtx.createLinearGradient(pose.x, pose.y, heroCutInDrawX, heroY - heroTargetHeight * 0.45);
        medBeamGrad.addColorStop(0, 'rgba(16, 185, 129, 0.44)');
        medBeamGrad.addColorStop(1, 'rgba(16, 185, 129, 0.03)');
        fgCtx.fillStyle = medBeamGrad;
        fgCtx.beginPath();
        fgCtx.moveTo(pose.x - 10 * baseScale, pose.y + 10 * baseScale);
        fgCtx.lineTo(pose.x + 10 * baseScale, pose.y + 10 * baseScale);
        fgCtx.lineTo(heroCutInDrawX + 26 * baseScale, heroY - heroTargetHeight * 0.25);
        fgCtx.lineTo(heroCutInDrawX - 26 * baseScale, heroY - heroTargetHeight * 0.25);
        fgCtx.closePath();
        fgCtx.fill();
        fgCtx.restore();
      }

      if (pose.id === 'shield') {
        baseCtx.save();
        baseCtx.fillStyle = 'rgba(3, 7, 18, 0.62)';
        baseCtx.beginPath();
        baseCtx.ellipse(pose.x, groundY + 2, 32 * baseScale, 5 * baseScale, 0, 0, Math.PI * 2);
        baseCtx.fill();
        baseCtx.restore();
      }

      if (webglRenderer) {
        const droneUniforms = createDefaultShaderUniforms();
        if (heroCutIn.role === 'bystander' && dimmerAlpha > 0.01) {
          const dm = Math.max(0.28, 1 - dimmerAlpha * 0.85);
          droneUniforms.tintRgba = [dm, dm, dm * 1.05, 1];
        }
        if (pose.activeGlow > 0.65) {
          droneUniforms.flashRgba =
            pose.id === 'strike'
              ? [1.0, 0.35, 0.6, 0.22]
              : pose.id === 'shield'
                ? [0.2, 0.95, 1.0, 0.22]
                : [0.2, 0.95, 0.65, 0.22];
        }
        webglRenderer.drawSprite({
          id: `drone:${pose.id}`,
          primarySource: dCanvas,
          worldX: pose.x,
          worldY: pose.y,
          widthPx: spec.w * dScale,
          heightPx: spec.h * dScale,
          anchorOffsetXPx: spec.anchorX * dScale,
          anchorOffsetYPx: spec.anchorY * dScale,
          facingSign: 1,
          rotationRad: Math.abs(pose.tiltRad) > 0.001 ? pose.tiltRad : 0,
          alpha: 1,
          drawPriority: heroCutIn.drawPriority,
          deform: createIdentityControlPoints(),
          uniforms: droneUniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.globalAlpha = droneBystanderMul;
        baseCtx.translate(pose.x, pose.y);
        if (Math.abs(pose.tiltRad) > 0.001) {
          baseCtx.rotate(pose.tiltRad);
        }
        baseCtx.drawImage(
          dCanvas,
          -spec.anchorX * dScale,
          -spec.anchorY * dScale,
          spec.w * dScale,
          spec.h * dScale,
        );
        baseCtx.restore();
      }
    }
  }

  if (
    (hero.shield > 0 || sim.shieldDomeTimer > 0) &&
    hero.hp > 0 &&
    !isKiraDodging &&
    !(zuriDrones && heroSample.state.mode === 'guard')
  ) {
    const rawPulse = sim.shieldDomeTimer > 0 ? 0.5 + 0.5 * (sim.shieldDomeTimer / 0.48) : 0.22;
    const pulse = zuriDrones ? rawPulse * 0.55 : rawPulse;
    const domeCenterX = zuriDrones ? zuriDrones.shield.x + 16 * baseScale : heroCutInDrawX + 8;
    fgCtx.save();
    fgCtx.translate(domeCenterX, groundY - heroTargetHeight * 0.48);
    fgCtx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
    fgCtx.lineWidth = sim.shieldDomeTimer > 0 ? 2.5 : 1.5;
    fgCtx.beginPath();
    const r = heroTargetHeight * (zuriDrones ? 0.42 : 0.46);
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 3) * k - Math.PI / 6;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) fgCtx.moveTo(px, py);
      else fgCtx.lineTo(px, py);
    }
    fgCtx.closePath();
    fgCtx.fillStyle = `rgba(0, 229, 255, ${pulse * (zuriDrones ? 0.07 : 0.14)})`;
    fgCtx.fill();
    fgCtx.stroke();
    fgCtx.restore();
  }

  if (hero.hp > 0 && !isProne && !heroSample.isDashing && worldUiAlpha > 0.02) {
    const kiraThreat = precomputedThreat ?? previewHeroThreat(combat, hero, activePreview);
    const hasThreatOrHeal =
      kiraThreat.hpDamageTaken > 0 ||
      kiraThreat.rawIncomingDamage > 0 ||
      kiraThreat.projectedHp !== hero.hp;
    const barW = w < 460 ? 66 : h < 220 ? 72 : 84;
    const barH = kiraThreat.hpDamageTaken > 0 || kiraThreat.healGained > 0 ? 7 : 5;
    const barX = Math.max(4, Math.round(heroX - barW * 0.5));
    const barY = Math.min(h - (hasThreatOrHeal ? 19 : 9), Math.round(groundY + 7));
    const safeMaxHp = Math.max(1, hero.maxHp);
    const curRatio = Math.max(0, Math.min(1, hero.hp / safeMaxHp));
    const preEnemyRatio = Math.max(0, Math.min(1, kiraThreat.hpBeforeEnemies / safeMaxHp));
    const projRatio = Math.max(0, Math.min(1, kiraThreat.projectedHp / safeMaxHp));
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 10);

    fgCtx.save();
    fgCtx.globalAlpha *= worldUiAlpha;
    fgCtx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    fgCtx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const safeRatio = Math.min(curRatio, projRatio);
    if (safeRatio > 0) {
      fgCtx.fillStyle = '#FF2E7E';
      fgCtx.fillRect(barX, barY, barW * safeRatio, barH);
    }

    if (projRatio > curRatio) {
      fgCtx.fillStyle = `rgba(16, 185, 129, ${0.75 + 0.25 * pulse})`;
      fgCtx.fillRect(barX + barW * curRatio, barY, barW * (projRatio - curRatio), barH);
    }

    if (kiraThreat.hpDamageTaken > 0 && preEnemyRatio > projRatio) {
      fgCtx.fillStyle = kiraThreat.willDie
        ? `rgba(255, 199, 0, ${0.78 + 0.22 * pulse})`
        : `rgba(253, 224, 71, ${0.72 + 0.28 * pulse})`;
      fgCtx.fillRect(
        barX + barW * projRatio,
        barY,
        barW * (preEnemyRatio - projRatio),
        barH,
      );
    }

    fgCtx.strokeStyle = kiraThreat.willDie
      ? `rgba(255, 46, 126, ${0.78 + 0.22 * pulse})`
      : kiraThreat.hpDamageTaken > 0
        ? 'rgba(255, 199, 0, 0.85)'
        : kiraThreat.shieldAfterPlayer > 0
          ? 'rgba(0, 240, 255, 0.7)'
          : 'rgba(226, 232, 240, 0.35)';
    fgCtx.lineWidth = kiraThreat.willDie ? 1.5 : 1;
    fgCtx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    if (hasThreatOrHeal) {
      fgCtx.font = '700 12px "JetBrains Mono", monospace';
      fgCtx.textAlign = 'center';
      let label = '';
      let labelColor = '#FDA4AF';
      if (kiraThreat.willDie) {
        label = `☠ ${lang === 'cs' ? 'ZABITÍ' : 'LETHAL'} (-${kiraThreat.hpDamageTaken})`;
        labelColor = '#FFC700';
      } else if (kiraThreat.hpDamageTaken > 0) {
        label = `-${kiraThreat.hpDamageTaken} HP`;
        labelColor = '#FDA4AF';
      } else if (kiraThreat.rawIncomingDamage > 0 && kiraThreat.blockedDamage > 0) {
        label = `${lang === 'cs' ? 'BLOK' : 'BLOCKED'} (${kiraThreat.blockedDamage})`;
        labelColor = '#67E8F9';
      } else if (kiraThreat.healGained > 0) {
        label = `+${kiraThreat.healGained} HP`;
        labelColor = '#6EE7B7';
      }
      if (label) {
        fgCtx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        fgCtx.lineWidth = 3;
        fgCtx.strokeText(label, heroX, barY + barH + 12);
        fgCtx.fillStyle = labelColor;
        fgCtx.fillText(label, heroX, barY + barH + 12);
      }
    }
    fgCtx.restore();
  }
}
