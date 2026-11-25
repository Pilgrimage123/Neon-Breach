import type {
  CharacterId,
  CombatState,
  HeroState,
  HeroThreatPreview,
  TileType,
  TurnPreview,
} from '../../engine/types';
import { AURALINE_CANONICAL_HEIGHT, AURALINE_SHEET_FRAMES } from '../../utils/auralineSpriteSheet';
import { DEFAULT_BRUTE_JUICE_CONFIG } from '../../utils/bruteJuiceController';
import { DEFAULT_FERAL_NURSE_JUICE_CONFIG } from '../../utils/feralNurseJuiceController';
import {
  KIRA_CANONICAL_HEIGHT,
  KIRA_SHEET_FRAMES,
  type HeroFrameSample,
} from '../../utils/kiraSpriteSheet';
import { DEFAULT_MUTDOG_JUICE_CONFIG } from '../../utils/mutdogJuiceController';
import { DEFAULT_SPITTER_JUICE_CONFIG } from '../../utils/spitterJuiceController';
import {
  ZURI_CANONICAL_HEIGHT,
  ZURI_SHEET_FRAMES,
  sampleZuriDroneFormation,
} from '../../utils/zuriSpriteSheet';
import type { SequencerFrameState } from './CombatActionSequencer';
import {
  renderBackdropPass,
  renderDropPodSignalsPass,
} from './combatBackdropRenderer';
import { renderDecalPass } from './combatDecalRenderer';
import { stepEnemyAnimationSamples } from './combatEnemyAnimationSim';
import {
  renderEnemyReflectionsPass,
  renderEnemySpritePass,
} from './combatEnemySpritePass';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  renderFloatingTextsPass,
  renderForegroundWorldFxPass,
  renderScreenSpaceForegroundPass,
} from './combatForegroundFxRenderer';
import {
  renderHeroReflection,
  renderHeroSpritePass,
  resolveHeroCutInFrameIndex,
} from './combatHeroSpritePass';
import {
  type CombatStageSim,
  getStageLayoutMetrics,
} from './combatStageTypes';
import {
  renderIntentVectorsAndSwapPass,
  renderTacticalViewPlaquesPass,
} from './combatTacticalOverlayRenderer';
import {
  type ActorJuiceSnapshot,
  NEUTRAL_ACTOR_JUICE_SNAPSHOT,
} from './SpriteJuiceFeedbackHandler';
import type {
  ICharacterStageRenderer,
  StageRenderOptions,
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
  spitterJuiceConfig?: StageRenderOptions['spitterJuiceConfig'];
  bruteLabActive: boolean;
  bruteJuiceConfig?: StageRenderOptions['bruteJuiceConfig'];
  mutdogLabActive: boolean;
  mutdogJuiceConfig?: StageRenderOptions['mutdogJuiceConfig'];
  feralNurseLabActive: boolean;
  feralNurseJuiceConfig?: StageRenderOptions['feralNurseJuiceConfig'];
}

export type CombatStageRenderOptions = StageRenderOptions & {
  devLabRenderer?: (ctx: DevLabRenderPassContext) => void;
};

export function computeAutoFocusTarget(params: {
  w: number;
  h: number;
  enemies: CombatState['enemies'];
  pendingDrops: NonNullable<CombatState['director']>['pendingReinforcements'];
  hoveredColor: TileType | null;
  inspectedEnemyId: string | null;
  autoFocusCamera: boolean;
  tacticalViewActive: boolean;
}): { zoom: number; panX: number; panY: number } {
  const {
    w,
    h,
    enemies,
    pendingDrops,
    hoveredColor,
    inspectedEnemyId,
    autoFocusCamera,
    tacticalViewActive,
  } = params;
  if (!autoFocusCamera || tacticalViewActive || w <= 0 || h <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }
  const { slotCenters, effectiveSlotCount } = computeEnemySlotLayout(enemies, pendingDrops);
  const heroBaseX = w < 460 ? w * 0.19 : w * 0.22;
  const { enemyBaseX, enemyStepX } = getStageLayoutMetrics(
    w,
    h,
    effectiveSlotCount,
    0,
    0,
    0,
    1,
    KIRA_CANONICAL_HEIGHT,
  );
  const groundY = Math.round(h * 0.785);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const focusY = Math.max(h * 0.35, Math.min(h * 0.72, groundY - h * 0.22));

  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  const frontEnemyX =
    frontLivingIdx >= 0
      ? enemyBaseX + (slotCenters[frontLivingIdx] ?? frontLivingIdx) * enemyStepX
      : enemyBaseX;
  const inspectedIdx = inspectedEnemyId
    ? enemies.findIndex((e) => e.id === inspectedEnemyId && e.hp > 0)
    : -1;
  const inspectedEnemyX =
    inspectedIdx >= 0 ? enemyBaseX + (slotCenters[inspectedIdx] ?? inspectedIdx) * enemyStepX : null;

  if (inspectedEnemyX !== null) {
    return {
      zoom: 1.2,
      panX: (cx - inspectedEnemyX) * 0.38,
      panY: (cy - focusY) * 0.32,
    };
  }
  if (hoveredColor === 'attack') {
    const midX = heroBaseX * 0.32 + frontEnemyX * 0.68;
    return {
      zoom: 1.18,
      panX: (cx - midX) * 0.35,
      panY: (cy - focusY) * 0.28,
    };
  }
  if (hoveredColor === 'defense' || hoveredColor === 'tech') {
    return {
      zoom: 1.16,
      panX: (cx - (heroBaseX + 18)) * 0.34,
      panY: (cy - focusY) * 0.26,
    };
  }
  return { zoom: 1, panX: 0, panY: 0 };
}

export function renderCombatStage(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  combat: CombatState,
  hero: HeroState,
  hoveredColor: TileType | null,
  heroSample: HeroFrameSample,
  elapsed: number,
  activePreview: TurnPreview | null = null,
  hoveredEnemyId: string | null = null,
  inspectedEnemyId: string | null = null,
  tacticalViewActive = false,
  autoFocusCamera = false,
  hoveringSwap = false,
  precomputedThreat?: HeroThreatPreview,
  dropIntelHorizon: { revealArchetype: boolean; revealSlot: boolean } = {
    revealArchetype: true,
    revealSlot: true,
  },
  renderOptions?: CombatStageRenderOptions,
): void {
  const { w, h } = sim.size;
  const dpr = sim.dpr;
  const webglRenderer =
    renderOptions?.rendererMode === 'webgl2' && renderOptions.webglRenderer?.isReady
      ? renderOptions.webglRenderer
      : null;
  const baseCtx = ctx;
  const useWebGL = Boolean(webglRenderer);
  const fgCtx = useWebGL && renderOptions?.fgCtx ? renderOptions.fgCtx : baseCtx;
  const debugMeshWireframe = Boolean(renderOptions?.debugMeshWireframe);
  const spitterJuiceConfig = renderOptions?.spitterJuiceConfig ?? DEFAULT_SPITTER_JUICE_CONFIG;
  const spitterLabActive = Boolean(renderOptions?.spitterLabActive);
  const bruteJuiceConfig = renderOptions?.bruteJuiceConfig ?? DEFAULT_BRUTE_JUICE_CONFIG;
  const bruteLabActive = Boolean(renderOptions?.bruteLabActive);
  const mutdogJuiceConfig = renderOptions?.mutdogJuiceConfig ?? DEFAULT_MUTDOG_JUICE_CONFIG;
  const mutdogLabActive = Boolean(renderOptions?.mutdogLabActive);
  const feralNurseJuiceConfig =
    renderOptions?.feralNurseJuiceConfig ?? DEFAULT_FERAL_NURSE_JUICE_CONFIG;
  const feralNurseLabActive = Boolean(renderOptions?.feralNurseLabActive);
  const reducedMotion = Boolean(renderOptions?.reducedMotion);
  const seqFrame: SequencerFrameState | null =
    renderOptions?.sequencerFrame ?? sim.lastSeqFrame ?? null;
  const getActorJuice = (actorId: string): ActorJuiceSnapshot => {
    if (tacticalViewActive) return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
    if (renderOptions?.getActorJuice) return renderOptions.getActorJuice(actorId);
    return sim.actionSequencer.getActorJuice(actorId);
  };
  const enemies = combat.enemies;
  const heroFrame = heroSample.frame;
  const charId: CharacterId = hero.characterId ?? 'kira';
  const activeFrames = sim.heroFramesByChar[charId];
  const sheetFrames =
    charId === 'auraline'
      ? AURALINE_SHEET_FRAMES
      : charId === 'zuri'
        ? ZURI_SHEET_FRAMES
        : KIRA_SHEET_FRAMES;
  const defaultRefFrame = sheetFrames[charId === 'zuri' ? 8 : 0];
  const canonicalHeight =
    charId === 'auraline'
      ? AURALINE_CANONICAL_HEIGHT
      : charId === 'zuri'
        ? ZURI_CANONICAL_HEIGHT
        : KIRA_CANONICAL_HEIGHT;
  const pendingDrops = combat.director?.pendingReinforcements ?? [];
  const { slotCenters, dropCenters, effectiveSlotCount } = computeEnemySlotLayout(
    enemies,
    pendingDrops,
  );
  const heroCutIn = getActorJuice('hero');
  const isKiraDodging = charId === 'kira' && heroSample.state.mode === 'dodge';
  const resolvedHeroFrameIndex = resolveHeroCutInFrameIndex(
    charId,
    heroCutIn,
    seqFrame?.phase,
    heroSample.frameIndex,
    heroSample.state.mode,
  );
  const resolvedHeroFrame = sheetFrames[resolvedHeroFrameIndex] ?? heroFrame;
  const effectiveHeroXProgress = isKiraDodging
    ? heroSample.xProgress
    : heroCutIn.isMeleeClash || (heroCutIn.active && heroCutIn.role === 'target')
      ? 0
      : heroCutIn.active && charId === 'auraline'
        ? Math.max(-0.06, Math.min(0.06, heroSample.xProgress))
        : heroSample.xProgress;

  const {
    groundY,
    heroBaseX,
    enemyBaseX,
    enemyStepX,
    heroTargetHeight,
    baseScale,
    heroDrawScale,
    heroX,
    heroY,
  } = getStageLayoutMetrics(
    w,
    h,
    effectiveSlotCount,
    sim.dashTargetX,
    effectiveHeroXProgress,
    heroSample.yHopPx,
    resolvedHeroFrame.rowScale,
    canonicalHeight,
  );
  const heroCutInDrawX = isKiraDodging
    ? Math.max(w * 0.08, heroX + (heroCutIn.active ? heroCutIn.clashSlideX : 0))
    : heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0);

  // Lazily sample enemy poses with dt=0 on frame 0 or paused redraws without advancing simulation timers
  const projectedShield = precomputedThreat?.shieldAfterPlayer ?? hero.shield;
  const needsLazySample =
    (sim.stalkerFrames &&
      enemies.some((e) => e.archetype === 'stalker' && e.hp > 0 && !sim.stalkerSamples?.has(e.id))) ||
    (sim.spitterFrames &&
      (enemies.some((e) => e.archetype === 'spitter' && e.hp > 0 && !sim.spitterSamples?.has(e.id)) ||
        (spitterLabActive && !sim.spitterJuiceSamples?.has('spitter_lab_specimen')))) ||
    (sim.bruteFrames &&
      (enemies.some((e) => e.archetype === 'brute' && e.hp > 0 && !sim.bruteSamples?.has(e.id)) ||
        (bruteLabActive && !sim.bruteJuiceSamples?.has('brute_lab_specimen')))) ||
    (sim.mutdogFrames &&
      (enemies.some((e) => e.archetype === 'mutdog' && e.hp > 0 && !sim.mutdogSamples?.has(e.id)) ||
        (mutdogLabActive && !sim.mutdogJuiceSamples?.has('mutdog_lab_specimen')))) ||
    (sim.feralNurseFrames &&
      (enemies.some(
        (e) => e.archetype === 'feral_nurse' && e.hp > 0 && !sim.feralNurseSamples?.has(e.id),
      ) ||
        (feralNurseLabActive && !sim.feralNurseJuiceSamples?.has('feral_nurse_lab_specimen')))) ||
    sim.lastFrameDt === 0;
  if (needsLazySample) {
    stepEnemyAnimationSamples(sim, 0, {
      combat,
      hero,
      hoveredColor,
      activePreview,
      projectedShield,
      elapsed,
      tacticalViewActive,
      spitterJuiceConfig,
      spitterLabActive,
      bruteJuiceConfig,
      bruteLabActive,
      mutdogJuiceConfig,
      mutdogLabActive,
      feralNurseJuiceConfig,
      feralNurseLabActive,
      getActorJuice,
      emitSideEffects: false,
    });
  }

  baseCtx.save();
  baseCtx.scale(dpr, dpr);
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = 'high';

  if (!seqFrame) {
    const autoTarget = computeAutoFocusTarget({
      w,
      h,
      enemies,
      pendingDrops,
      hoveredColor,
      inspectedEnemyId,
      autoFocusCamera,
      tacticalViewActive,
    });
    const camLerp = tacticalViewActive ? 1 : 0.22;
    sim.cameraZoom = (sim.cameraZoom || 1) + (autoTarget.zoom - (sim.cameraZoom || 1)) * camLerp;
    sim.cameraPanX = (sim.cameraPanX || 0) + (autoTarget.panX - (sim.cameraPanX || 0)) * camLerp;
    sim.cameraPanY = (sim.cameraPanY || 0) + (autoTarget.panY - (sim.cameraPanY || 0)) * camLerp;
    sim.cameraRotRad = 0;
  }

  const camZoom = tacticalViewActive ? 1 : seqFrame?.cameraZoom ?? sim.cameraZoom ?? 1;
  const camPanX = tacticalViewActive ? 0 : seqFrame?.cameraPanX ?? sim.cameraPanX ?? 0;
  const camPanY = tacticalViewActive ? 0 : seqFrame?.cameraPanY ?? sim.cameraPanY ?? 0;
  const camRotRad =
    tacticalViewActive || reducedMotion
      ? 0
      : (seqFrame?.cameraRotRad ?? sim.cameraRotRad ?? 0) + (seqFrame?.shakeRotRad ?? 0);
  const worldUiAlpha = tacticalViewActive ? 1 : (seqFrame?.worldUiAlpha ?? 1);

  const legacyShakeMag = tacticalViewActive || reducedMotion ? 0 : sim.trauma * sim.trauma * 10;
  const legacyShakeX = legacyShakeMag > 0.1 ? (Math.random() * 2 - 1) * legacyShakeMag : 0;
  const legacyShakeY = legacyShakeMag > 0.1 ? (Math.random() * 2 - 1) * legacyShakeMag : 0;
  const totalShakeX =
    tacticalViewActive || reducedMotion ? 0 : (seqFrame?.shakeOffsetX ?? 0) + legacyShakeX;
  const totalShakeY =
    tacticalViewActive || reducedMotion ? 0 : (seqFrame?.shakeOffsetY ?? 0) + legacyShakeY;

  const hasCamTransform =
    Math.abs(camZoom - 1) > 0.004 ||
    Math.abs(camPanX) > 0.5 ||
    Math.abs(camPanY) > 0.5 ||
    Math.abs(camRotRad) > 0.0004 ||
    Math.abs(totalShakeX) > 0.05 ||
    Math.abs(totalShakeY) > 0.05;
  if (hasCamTransform) {
    baseCtx.translate(w * 0.5 + camPanX + totalShakeX, h * 0.5 + camPanY + totalShakeY);
    if (Math.abs(camRotRad) > 0.0004) {
      baseCtx.rotate(camRotRad);
    }
    if (Math.abs(camZoom - 1) > 0.004) {
      baseCtx.scale(camZoom, camZoom);
    }
    baseCtx.translate(-w * 0.5, -h * 0.5);
  }

  if (fgCtx !== baseCtx) {
    fgCtx.save();
    fgCtx.setTransform(1, 0, 0, 1, 0, 0);
    fgCtx.clearRect(0, 0, Math.ceil(w * dpr) + 2, Math.ceil(h * dpr) + 2);
    fgCtx.scale(dpr, dpr);
    fgCtx.imageSmoothingEnabled = true;
    fgCtx.imageSmoothingQuality = 'high';
    if (hasCamTransform) {
      fgCtx.translate(w * 0.5 + camPanX + totalShakeX, h * 0.5 + camPanY + totalShakeY);
      if (Math.abs(camRotRad) > 0.0004) {
        fgCtx.rotate(camRotRad);
      }
      if (Math.abs(camZoom - 1) > 0.004) {
        fgCtx.scale(camZoom, camZoom);
      }
      fgCtx.translate(-w * 0.5, -h * 0.5);
    }
  }

  // Pass 1: Backdrop, deck gradient cache, cover barriers & ambient motes
  const { deckBackY, deckFrontY } = renderBackdropPass({
    ctx: baseCtx,
    sim,
    combat,
    w,
    h,
    groundY,
    elapsed,
    tacticalViewActive,
    seqFrame,
  });

  const isProne =
    heroSample.state.mode === 'defeat' &&
    (charId === 'auraline'
      ? heroSample.frameIndex >= 35
      : charId === 'zuri'
        ? heroSample.frameIndex >= 29
        : heroSample.frameIndex >= 31);

  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  const frontLivingIdForDrones =
    frontLivingIdx >= 0 ? enemies[frontLivingIdx].id : null;
  const baseDroneTargetX =
    frontLivingIdx >= 0
      ? enemyBaseX + (slotCenters[frontLivingIdx] ?? frontLivingIdx) * enemyStepX
      : sim.pendingShotTargetX;
  const droneTargetX = frontLivingIdForDrones
    ? sim.actionSequencer.getLiveActorX(frontLivingIdForDrones, baseDroneTargetX)
    : baseDroneTargetX;
  const droneTargetMidY =
    groundY - (frontLivingIdx >= 0 && frontLivingIdx % 2 === 1 ? 6 : 0) - 88;
  const zuriDrones =
    charId === 'zuri'
      ? sampleZuriDroneFormation({
          animState: heroSample.state,
          heroX: heroCutInDrawX,
          heroDrawBottomY: heroY,
          groundY,
          targetX: droneTargetX,
          targetMidY: droneTargetMidY,
          scale: baseScale,
          totalTime: tacticalViewActive ? 0 : elapsed,
          hoveredColor,
        })
      : null;

  if (webglRenderer) {
    const viewProjMatrix =
      seqFrame && legacyShakeMag <= 0.1 && !tacticalViewActive
        ? sim.actionSequencer.camera.buildWebGLViewProjMatrix(w, h)
        : undefined;
    webglRenderer.beginFrame({
      width: w,
      height: h,
      dpr,
      cameraZoom: camZoom,
      cameraPanX: camPanX,
      cameraPanY: camPanY,
      cameraRotRad: camRotRad,
      shakeOffsetX: totalShakeX,
      shakeOffsetY: totalShakeY,
      deckBackY,
      deckFrontY,
      viewProjMatrix,
    });
  }

  // Pass 2: Planar Glass Walkway Reflections (Hero + Enemies)
  baseCtx.save();
  baseCtx.beginPath();
  baseCtx.rect(0, deckBackY, w, Math.max(12, deckFrontY - deckBackY + 4));
  baseCtx.clip();

  const reflDimmerAlpha = tacticalViewActive ? 0 : seqFrame?.dimmerAlpha ?? 0;

  renderHeroReflection({
    ctx: baseCtx,
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
  });

  renderEnemyReflectionsPass({
    ctx: baseCtx,
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
  });
  baseCtx.restore();

  // Pass 2.5: Persistent floor blood pools, fissures, front curb splatters & edge drips
  renderDecalPass(baseCtx, sim, deckBackY, deckFrontY, elapsed, tacticalViewActive);

  // Darkest Dungeon Cut-In Spotlight Stage Dimmer Veil
  const dimmerAlpha = tacticalViewActive ? 0 : seqFrame?.dimmerAlpha ?? 0;
  if (dimmerAlpha > 0.01) {
    baseCtx.save();
    baseCtx.fillStyle = `rgba(3, 7, 18, ${dimmerAlpha.toFixed(3)})`;
    baseCtx.fillRect(-160, -160, w + 320, h + 320);
    baseCtx.restore();
  }

  // Pass 3: Hero Sprite, Zuri Drones, Shield Dome & Underfoot Lifebar
  renderHeroSpritePass({
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
    lang: renderOptions?.lang ?? 'cs',
  });

  // Pass 4: Enemy Sprites, Stagger Recoil, Contact Shadows & Tactical Under-Foot Lifebars
  renderEnemySpritePass({
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
  });

  // Pass 4.05: Optional DEV-only Lab Specimens (passed via renderOptions callback for tree-shaking)
  if (
    renderOptions?.devLabRenderer &&
    (spitterLabActive || bruteLabActive || mutdogLabActive || feralNurseLabActive)
  ) {
    renderOptions.devLabRenderer({
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
      spitterJuiceConfig,
      bruteLabActive,
      bruteJuiceConfig,
      mutdogLabActive,
      mutdogJuiceConfig,
      feralNurseLabActive,
      feralNurseJuiceConfig,
    });
  }

  // Pass 4.15 & 4.20: Telegraph Enemy Intent Vectors & Spatial Swap Arrows
  renderIntentVectorsAndSwapPass({
    ctx: fgCtx,
    combat,
    hero,
    enemies,
    slotCenters,
    enemyBaseX,
    enemyStepX,
    heroX,
    heroTargetHeight,
    groundY,
    baseScale,
    worldUiAlpha,
    tacticalViewActive,
    hoveringSwap,
    activePreview,
    precomputedThreat,
    elapsed,
  });

  // Pass 4.25: Telegraphed Orbital Drop-Pod Holograms
  renderDropPodSignalsPass({
    ctx: fgCtx,
    pendingDrops,
    dropCenters,
    enemyBaseX,
    enemyStepX,
    groundY,
    elapsed,
    dropIntelHorizon,
  });

  // Pass 4.5 - 8: Airborne Blood Droplets, Styled Projectiles, Shockwaves, Beams & Particles
  renderForegroundWorldFxPass({
    ctx: fgCtx,
    sim,
    w,
    h,
    heroBaseX,
    groundY,
    tacticalViewActive,
  });

  // Pass 8.5: Tactical View High-Contrast Plaques
  if (tacticalViewActive) {
    renderTacticalViewPlaquesPass({
      ctx: fgCtx,
      hero,
      isProne,
      heroX,
      groundY,
      heroTargetHeight,
      enemies,
      slotCenters,
      enemyBaseX,
      enemyStepX,
      frontLivingIdx,
      w,
      h,
    });
  }

  // Pass 9: Floating Tabular Damage / Shield Numbers
  renderFloatingTextsPass(fgCtx, sim, h);

  // Flush WebGL2 MeshSprite queue & optional 4x6 anatomical debug wireframe overlay
  if (webglRenderer) {
    webglRenderer.endFrame(debugMeshWireframe ? fgCtx : null);
  }

  if (fgCtx !== baseCtx) {
    fgCtx.restore();
  }
  baseCtx.restore();

  // Pass 10 & 11: Screen-space Fourth-Wall Visor Blood Drops & Cut-In Speed-Lines / Invert Flash
  renderScreenSpaceForegroundPass({
    fgCtx,
    sim,
    seqFrame,
    tacticalViewActive,
    reducedMotion,
    elapsed,
  });
}
