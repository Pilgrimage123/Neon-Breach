import { useEffect, useMemo, useRef, useState } from 'react';
import {
  areCriticalCombatAssetsReady,
  ensureCombatAssetsReady,
  getPreloadedBackdrop,
  getPreloadedCrawlerFrames,
  getPreloadedEnemyCutout,
  getPreloadedHeroFrames,
  getPreloadedZuriDroneFrames,
  subscribePreloadUpdates,
} from '../assets/assetPreloader';
import { getDifficultyProfile } from '../engine/difficulty';
import { previewHeroineThreat } from '../engine/gameEngine';
import { isIntentConditionMet } from '../engine/reinforcementDirector';
import type {
  CharacterId,
  CombatState,
  DifficultyTier,
  EnemyArchetype,
  HeroineState,
  PendingReinforcement,
  ReinforcementReason,
  TileType,
  TurnPreview,
} from '../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language, type TranslationPack } from '../i18n/translations';
import type { CodexTab } from './CodexModal';
import {
  AURELIA_CANONICAL_HEIGHT,
  AURELIA_SHEET_FRAMES,
  stepCharacterAnimState,
} from '../utils/aureliaSpriteSheet';
import {
  HEROINE_CANONICAL_HEIGHT,
  HEROINE_SHEET_FRAMES,
} from '../utils/heroineSpriteSheet';
import {
  ZURI_CANONICAL_HEIGHT,
  ZURI_SHEET_FRAMES,
  sampleZuriDroneFormation,
} from '../utils/zuriSpriteSheet';
import { renderCombatStage } from './combat/combatRenderer';
import {
  type CombatStageSim,
  createCombatStageSim,
  getStageLayoutMetrics,
  resetCombatStageSim,
} from './combat/combatStageTypes';
import {
  computeEffectiveSlotCount,
  computeEnemyArmorPreview,
  computeEnemyHitBoxes,
  formatEnemyIntentCompact,
  hitTestEnemySprite,
} from './combat/combatEnemyUi';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from './combat/CombatIcons';
import { EnemyIntelPanel } from './combat/EnemyIntelPanel';
import {
  applyCombatCues,
  drainTriggerImpacts,
  spawnBolt,
  spawnBurst,
  stepCombatSimulation,
} from './combat/combatVfx';
import { getEnemyRolePip } from '../utils/accessibilityAndScale';
import { enforceEightWordRule } from '../utils/spatialMinimalistUi';
import { formatDiscretePipMath } from '../utils/tacticalSandboxAndHints';

interface CombatStageCanvasProps {
  runId: string;
  combat: CombatState;
  heroine: HeroineState;
  lang: Language;
  activePreview: TurnPreview | null;
  paused: boolean;
  isCompactLandscape?: boolean;
  tacticalView?: boolean;
  autoFocusCamera?: boolean;
  highContrastBorders?: boolean;
  pipMathMode?: boolean;
  hoveringSwap?: boolean;
  difficultyTier?: DifficultyTier;
  onUndoTurn?: () => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
}

function formatDropReasonLabel(reason: ReinforcementReason, t: TranslationPack): string {
  switch (reason) {
    case 'adaptive':
      return t.dropReasonAdaptive;
    case 'reactive':
      return t.dropReasonReactive;
    case 'sos_flare':
      return t.dropReasonSos;
    case 'sweeper':
      return t.dropReasonSweeper;
    case 'threat_pool':
    default:
      return t.dropReasonThreat;
  }
}

export function CombatStageCanvas({
  runId,
  combat,
  heroine,
  lang,
  activePreview,
  paused,
  isCompactLandscape = false,
  tacticalView = false,
  autoFocusCamera = false,
  highContrastBorders = false,
  pipMathMode = false,
  hoveringSwap = false,
  difficultyTier = 3,
  onUndoTurn,
  onOpenCodex,
}: CombatStageCanvasProps) {
  const diff = getDifficultyProfile(difficultyTier);
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inspectedTarget, setInspectedTarget] = useState<'hero' | string | null>(null);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cutoutVersion, setCutoutVersion] = useState(0);

  const charId: CharacterId = heroine.characterId ?? 'kira';
  const activeArchetypeKey = combat.enemies.map((e) => e.archetype).join(',');
  const activeArchetypes = useMemo(
    () =>
      activeArchetypeKey
        ? (activeArchetypeKey.split(',') as EnemyArchetype[])
        : ([] as EnemyArchetype[]),
    [activeArchetypeKey],
  );

  const [stageReady, setStageReady] = useState<boolean>(() =>
    areCriticalCombatAssetsReady(charId, activeArchetypes),
  );
  const stageReadyRef = useRef(stageReady);
  stageReadyRef.current = stageReady;

  // Latest props stored in refs so rAF loop never tears down
  const combatRef = useRef(combat);
  const heroineRef = useRef(heroine);
  const pausedRef = useRef(paused);
  const hoveredColorRef = useRef<TileType | null>(activePreview?.color ?? null);
  const activePreviewRef = useRef<TurnPreview | null>(activePreview);
  const hoveredEnemyIdRef = useRef<string | null>(hoveredEnemyId);
  const inspectedEnemyIdRef = useRef<string | null>(
    inspectedTarget && inspectedTarget !== 'hero' ? inspectedTarget : null,
  );
  const tacticalViewRef = useRef<boolean>(tacticalView);
  const autoFocusCameraRef = useRef<boolean>(autoFocusCamera);
  const hoveringSwapRef = useRef<boolean>(hoveringSwap);
  const dropIntelHorizonRef = useRef({
    revealArchetype: diff.revealDropArchetype,
    revealSlot: diff.revealDropSlot,
  });
  const hitboxLayerRef = useRef<HTMLDivElement | null>(null);
  const kiraThreat = useMemo(
    () => previewHeroineThreat(combat, heroine, activePreview),
    [combat, heroine, activePreview],
  );
  const kiraThreatRef = useRef(kiraThreat);
  combatRef.current = combat;
  heroineRef.current = heroine;
  pausedRef.current = paused;
  hoveredColorRef.current = activePreview?.color ?? null;
  activePreviewRef.current = activePreview;
  hoveredEnemyIdRef.current = hoveredEnemyId;
  inspectedEnemyIdRef.current =
    inspectedTarget && inspectedTarget !== 'hero' ? inspectedTarget : null;
  tacticalViewRef.current = tacticalView;
  autoFocusCameraRef.current = autoFocusCamera;
  hoveringSwapRef.current = hoveringSwap;
  dropIntelHorizonRef.current = {
    revealArchetype: diff.revealDropArchetype,
    revealSlot: diff.revealDropSlot,
  };
  kiraThreatRef.current = kiraThreat;

  const simRef = useRef<CombatStageSim | null>(null);
  if (!simRef.current) {
    simRef.current = createCombatStageSim();
  }

  const requestDrawRef = useRef<() => void>(() => {});
  const syncAndDrawNowRef = useRef<() => void>(() => {});

  // Reset simulation state when starting a new run or entering a new combat node
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    resetCombatStageSim(sim);
    setInspectedTarget(null);
    setHoveredEnemyId(null);
    requestDrawRef.current();
  }, [runId, combat.nodeId]);

  // Clear inspected/hovered target if that enemy dies or pending drop resolves
  useEffect(() => {
    if (inspectedTarget && inspectedTarget.startsWith('drop:')) {
      const dropId = inspectedTarget.slice(5);
      const stillPending = combat.director?.pendingReinforcements.some((d) => d.id === dropId);
      if (!stillPending) {
        setInspectedTarget(null);
      }
    } else if (inspectedTarget && inspectedTarget !== 'hero') {
      const target = combat.enemies.find((e) => e.id === inspectedTarget);
      if (!target || target.hp <= 0) {
        setInspectedTarget(null);
      }
    }
    if (hoveredEnemyId) {
      const hovered = combat.enemies.find((e) => e.id === hoveredEnemyId);
      if (!hovered || hovered.hp <= 0) {
        setHoveredEnemyId(null);
      }
    }
  }, [combat.enemies, combat.director?.pendingReinforcements, inspectedTarget, hoveredEnemyId]);

  // Trigger procedural cues & heroine sprite animations whenever combat.lastCues changes
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    applyCombatCues(sim, combat, heroineRef.current);
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [combat]);

  // Wake renderer if paused state, preview, tactical view, auto-focus camera, swap hover, or target highlight changes
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [
    paused,
    activePreview,
    heroine.hp,
    heroine.shield,
    hoveredEnemyId,
    inspectedTarget,
    tacticalView,
    autoFocusCamera,
    hoveringSwap,
    difficultyTier,
  ]);

  // Mount Canvas & Asset Loading once
  useEffect(() => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!sim || !canvas || !container) return;

    const activeSim: CombatStageSim = sim;
    const activeCanvas: HTMLCanvasElement = canvas;
    const activeContainer: HTMLDivElement = container;

    let unmounted = false;
    let rafId = 0;
    let yieldTimerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    function scheduleFrame() {
      if (unmounted || rafId !== 0 || yieldTimerId !== 0) return;
      rafId = requestAnimationFrame(renderFrame);
    }

    function renderFrame(now: number) {
      const frameStart = performance.now();
      rafId = 0;
      if (unmounted) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const isPaused = pausedRef.current || document.hidden || !stageReadyRef.current;

      if (isPaused && !activeSim.needsRedraw) {
        return;
      }

      const ctx = activeCanvas.getContext('2d');
      if (!ctx) {
        if (!isPaused) scheduleFrame();
        return;
      }

      const currentCombat = combatRef.current;
      const currentHeroine = heroineRef.current;

      // Apply any newly arrived combat cues before stepping animations so the final hit always plays in full
      applyCombatCues(activeSim, currentCombat, currentHeroine);

      let simDt = 0;
      if (!isPaused) {
        simDt = stepCombatSimulation(activeSim, dt);
        elapsed += simDt;
      }

      const charId: CharacterId = currentHeroine.characterId ?? 'kira';
      const canonicalHeight =
        charId === 'aurelia'
          ? AURELIA_CANONICAL_HEIGHT
          : charId === 'zuri'
            ? ZURI_CANONICAL_HEIGHT
            : HEROINE_CANONICAL_HEIGHT;
      const heroSample = stepCharacterAnimState(activeSim.heroState, simDt, charId, {
        isDead: currentHeroine.hp <= 0 || currentCombat.phase === 'DEFEAT',
        isVictory: currentCombat.phase === 'VICTORY' && activeSim.pendingImpacts.length === 0,
        hoveredColor: hoveredColorRef.current,
        totalTime: elapsed,
      });
      activeSim.heroState = heroSample.state;

      if (activeCanvas.dataset.heroAnim !== heroSample.state.mode) {
        activeCanvas.dataset.heroAnim = heroSample.state.mode;
      }

      const heroFrame = heroSample.frame;
      if (!isPaused && simDt > 0) {
        const effectiveSlotCount = computeEffectiveSlotCount(
          currentCombat.enemies,
          currentCombat.director?.pendingReinforcements,
        );
        const { groundY, baseScale, heroX, heroY, heroDrawScale } = getStageLayoutMetrics(
          activeSim.size.w,
          activeSim.size.h,
          effectiveSlotCount,
          activeSim.dashTargetX,
          heroSample.xProgress,
          heroSample.yHopPx,
          heroFrame.rowScale,
          canonicalHeight,
        );

        const zuriDrones =
          charId === 'zuri'
            ? sampleZuriDroneFormation({
                animState: heroSample.state,
                heroineX: heroX,
                heroineDrawBottomY: heroY,
                groundY,
                targetX: activeSim.pendingShotTargetX,
                targetMidY: activeSim.pendingShotTargetY,
                scale: baseScale,
                totalTime: elapsed,
                hoveredColor: hoveredColorRef.current,
              })
            : null;

        if (heroSample.isDashing) {
          activeSim.ghostSampleTimer += simDt;
          if (activeSim.ghostSampleTimer >= 0.028) {
            activeSim.ghostSampleTimer = 0;
            activeSim.ghosts.push({
              x: heroX,
              y: heroY,
              frameIndex: heroSample.frameIndex,
              drawScale: heroDrawScale,
              alpha: 0.42,
            });
            if (activeSim.ghosts.length > 6) activeSim.ghosts.shift();
          }
        } else {
          activeSim.ghostSampleTimer = 0;
        }

        if (heroSample.shouldEmitShot && (heroFrame.muzzleRel || zuriDrones)) {
          const mx = zuriDrones
            ? zuriDrones.strike.muzzleX
            : heroX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
          const my = zuriDrones
            ? zuriDrones.strike.muzzleY
            : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
          const boltColor = heroSample.state.mode === 'overdrive' ? '#FFC700' : '#00F0FF';
          const triggerKey = heroSample.state.emittedShots === 1 ? 'shot1' : 'shot2';
          const onImpact = drainTriggerImpacts(activeSim, triggerKey);
          if (charId === 'zuri' && zuriDrones) {
            // Strike Gunship Drone fires twin rotary gatling plasma streams
            spawnBolt(
              activeSim,
              mx,
              my - 3,
              activeSim.pendingShotTargetX,
              activeSim.pendingShotTargetY - 4,
              '#FF2E7E',
              onImpact,
            );
            spawnBolt(
              activeSim,
              mx - 4,
              my + 4,
              activeSim.pendingShotTargetX,
              activeSim.pendingShotTargetY + 4,
              '#FFC700',
              undefined,
            );
            if (heroSample.state.mode === 'overdrive') {
              // Shield Walker Drone also fires an Aegis pulse beam during Overdrive
              spawnBolt(
                activeSim,
                zuriDrones.shield.muzzleX,
                zuriDrones.shield.muzzleY,
                activeSim.pendingShotTargetX,
                activeSim.pendingShotTargetY,
                '#00F0FF',
                undefined,
              );
            }
            spawnBurst(activeSim, mx, my, 9, '#FFC700', 0, 0.95, 0, 0.28, 0.28, 2, 3.8);
          } else if (charId === 'aurelia') {
            spawnBolt(
              activeSim,
              mx,
              my - 3.5,
              activeSim.pendingShotTargetX,
              activeSim.pendingShotTargetY - 5,
              boltColor,
              onImpact,
            );
            spawnBolt(
              activeSim,
              mx - 3,
              my + 4.5,
              activeSim.pendingShotTargetX,
              activeSim.pendingShotTargetY + 4,
              heroSample.state.mode === 'overdrive' ? '#FFE066' : '#FF2E7E',
              undefined,
            );
            spawnBurst(activeSim, mx, my, 8, '#FFC700', 0, 0.9, 0, 0.28, 0.28, 2, 3.8);
          } else {
            spawnBolt(
              activeSim,
              mx,
              my,
              activeSim.pendingShotTargetX,
              activeSim.pendingShotTargetY,
              boltColor,
              onImpact,
            );
            spawnBurst(activeSim, mx, my, 6, '#FDE047', 0, 0.75, 0, 0.28, 0.28, 2, 3.5);
          }
          if (charId !== 'zuri') {
            spawnBurst(
              activeSim,
              heroX + 26 * heroDrawScale,
              heroY - 145 * heroDrawScale,
              3,
              '#FBBF24',
              1,
              0.45,
              0,
              0.28,
              0.28,
              2,
              3.5,
            );
          }
        }

        if (heroSample.shouldEmitKickImpact && (heroFrame.kickTipRel || zuriDrones)) {
          // When Zuri commands a dive-bomb strike, the impact happens at the Strike Drone's target position
          const kx = zuriDrones
            ? zuriDrones.strike.muzzleX
            : heroX + (heroFrame.kickTipRel?.dx ?? 150) * heroDrawScale;
          const ky = zuriDrones
            ? zuriDrones.strike.muzzleY
            : heroY + (heroFrame.kickTipRel?.dy ?? -120) * heroDrawScale;
          activeSim.kickWaveTimer = 0.28;
          activeSim.kickWaveX = kx;
          activeSim.kickWaveY = ky;
          spawnBurst(activeSim, kx, ky, 18, '#FF2E7E', 1, 1.15, 0, 0.28, 0.28, 2, 3.5);
          if (charId === 'aurelia' || charId === 'zuri') {
            spawnBurst(activeSim, kx, ky, 14, '#FFC700', 0, 1.25, 0, 0.3, 0.26, 2.4, 4.2);
          }
          const kickCb = drainTriggerImpacts(activeSim, 'kick');
          if (kickCb) kickCb();
        }
      }

      renderCombatStage(
        ctx,
        activeSim,
        currentCombat,
        currentHeroine,
        hoveredColorRef.current,
        heroSample,
        elapsed,
        activePreviewRef.current,
        hoveredEnemyIdRef.current,
        inspectedEnemyIdRef.current,
        tacticalViewRef.current,
        autoFocusCameraRef.current,
        hoveringSwapRef.current,
        kiraThreatRef.current,
        dropIntelHorizonRef.current,
      );
      const camZoom = activeSim.cameraZoom || 1;
      const camPanX = activeSim.cameraPanX || 0;
      const camPanY = activeSim.cameraPanY || 0;
      if (hitboxLayerRef.current) {
        const hasCamTransform =
          Math.abs(camZoom - 1) > 0.004 || Math.abs(camPanX) > 0.5 || Math.abs(camPanY) > 0.5;
        hitboxLayerRef.current.style.transform = hasCamTransform
          ? `translate(${camPanX}px, ${camPanY}px) scale(${camZoom})`
          : '';
      }
      const zoomStr = camZoom.toFixed(2);
      if (activeCanvas.dataset.cameraZoom !== zoomStr) {
        activeCanvas.dataset.cameraZoom = zoomStr;
      }
      activeSim.needsRedraw = false;

      if (!isPaused) {
        const frameCostMs = performance.now() - frameStart;
        if (frameCostMs > 24) {
          yieldTimerId = window.setTimeout(() => {
            yieldTimerId = 0;
            scheduleFrame();
          }, 16);
        } else {
          scheduleFrame();
        }
      }
    }

    const ensureHeroFrameSlots = (id: CharacterId) => {
      if (!activeSim.heroFramesByChar[id]) {
        const len =
          id === 'aurelia'
            ? AURELIA_SHEET_FRAMES.length
            : id === 'zuri'
              ? ZURI_SHEET_FRAMES.length
              : HEROINE_SHEET_FRAMES.length;
        activeSim.heroFramesByChar[id] = new Array<HTMLCanvasElement>(len);
      }
      return activeSim.heroFramesByChar[id] as HTMLCanvasElement[];
    };

    const hydrateSimFromPreload = (): boolean => {
      let addedNewCutout = false;
      const cachedBg = getPreloadedBackdrop();
      if (cachedBg && !activeSim.backdropImg) {
        activeSim.backdropImg = cachedBg;
      }
      for (const cid of ['kira', 'aurelia', 'zuri'] as const) {
        const cachedFrames = getPreloadedHeroFrames(cid);
        if (cachedFrames) {
          const slots = ensureHeroFrameSlots(cid);
          for (let i = 0; i < cachedFrames.length; i++) {
            if (cachedFrames[i]) slots[i] = cachedFrames[i];
          }
        }
      }
      const cachedDrones = getPreloadedZuriDroneFrames();
      if (cachedDrones) {
        activeSim.zuriDroneFrames = cachedDrones;
      }
      for (const variant of ['larva', 'skitter', 'stinger'] as const) {
        const cachedCrawler = getPreloadedCrawlerFrames(variant);
        if (cachedCrawler && !activeSim.crawlerFrames.has(variant)) {
          activeSim.crawlerFrames.set(variant, cachedCrawler);
        }
      }
      for (const arch of ['stalker', 'spitter', 'brute', 'boss'] as const) {
        const cachedEnemy = getPreloadedEnemyCutout(arch);
        if (cachedEnemy && !activeSim.enemyCutouts.has(arch)) {
          activeSim.enemyCutouts.set(arch, cachedEnemy);
          addedNewCutout = true;
        }
      }
      return addedNewCutout;
    };

    syncAndDrawNowRef.current = () => {
      if (unmounted) return;
      if (hydrateSimFromPreload()) {
        setCutoutVersion((v) => v + 1);
      }
      activeSim.needsRedraw = true;
      lastTime = performance.now();
      renderFrame(lastTime);
    };

    requestDrawRef.current = scheduleFrame;

    // Hydrate synchronously first so preloaded runs paint with zero flash on frame 0
    hydrateSimFromPreload();

    // Subscribe to sequential background preload completions (e.g. deferred enemies, Kira emotes)
    const unsubscribePreload = subscribePreloadUpdates(() => {
      if (unmounted) return;
      if (hydrateSimFromPreload()) {
        setCutoutVersion((v) => v + 1);
      }
      activeSim.needsRedraw = true;
      if (stageReadyRef.current) {
        scheduleFrame();
      }
    });

    const updateSize = () => {
      const w = Math.max(260, Math.floor(activeContainer.clientWidth));
      const h = Math.max(120, Math.floor(activeContainer.clientHeight));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      activeCanvas.width = Math.floor(w * dpr);
      activeCanvas.height = Math.floor(h * dpr);
      activeSim.size = { w, h };
      activeSim.dpr = dpr;
      activeSim.needsRedraw = true;
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      if (stageReadyRef.current) {
        renderFrame(performance.now());
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(activeContainer);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        lastTime = performance.now();
        activeSim.needsRedraw = true;
        scheduleFrame();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (stageReadyRef.current) {
      scheduleFrame();
    }
    return () => {
      unmounted = true;
      unsubscribePreload();
      requestDrawRef.current = () => {};
      syncAndDrawNowRef.current = () => {};
      if (rafId !== 0) cancelAnimationFrame(rafId);
      if (yieldTimerId !== 0) window.clearTimeout(yieldTimerId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Ensure critical encounter assets are ready cleanly when switching character or node
  useEffect(() => {
    if (areCriticalCombatAssetsReady(charId, activeArchetypes)) {
      stageReadyRef.current = true;
      setStageReady(true);
      syncAndDrawNowRef.current();
      return;
    }

    let cancelled = false;
    stageReadyRef.current = false;
    setStageReady(false);

    void ensureCombatAssetsReady(charId, activeArchetypes).then(() => {
      if (cancelled) return;
      stageReadyRef.current = true;
      syncAndDrawNowRef.current();
      setStageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [charId, activeArchetypes]);

  const frontLivingIdx = combat.enemies.findIndex((e) => e.hp > 0);
  const kiraHpPct = Math.max(0, Math.min(100, Math.round((heroine.hp / heroine.maxHp) * 100)));
  const kiraProjHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.projectedHp / heroine.maxHp) * 100)),
  );
  const kiraPreEnemyHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.hpBeforeEnemies / heroine.maxHp) * 100)),
  );
  const kiraDmgBarPct = Math.max(0, kiraPreEnemyHpPct - kiraProjHpPct);
  const kiraHealBarPct = Math.max(0, kiraProjHpPct - kiraHpPct);
  const kiraHasHpChange =
    kiraThreat.hpDamageTaken > 0 || kiraThreat.projectedHp !== heroine.hp;

  const charMeta = t.characters[charId];
  const livingEnemies = useMemo(
    () => combat.enemies.filter((e) => e.hp > 0),
    [combat.enemies],
  );
  const director = combat.director;
  const pendingDrops = director?.pendingReinforcements ?? [];
  const inspectedDrop: PendingReinforcement | null =
    inspectedTarget && inspectedTarget.startsWith('drop:')
      ? pendingDrops.find((d) => d.id === inspectedTarget.slice(5)) ?? null
      : null;

  const inspectedEnemy =
    inspectedTarget && inspectedTarget !== 'hero' && !inspectedTarget.startsWith('drop:')
      ? combat.enemies.find((e) => e.id === inspectedTarget && e.hp > 0) ?? null
      : null;
  const inspectedEnemyIdx = inspectedEnemy
    ? combat.enemies.findIndex((e) => e.id === inspectedEnemy.id)
    : -1;
  const inspectedEnemyPreview = inspectedEnemy
    ? computeEnemyArmorPreview(
        inspectedEnemy,
        inspectedEnemyIdx,
        frontLivingIdx,
        activePreview,
        combat.enemies,
      )
    : null;
  const inspectedEnemyIntent = inspectedEnemy
    ? inspectedEnemy.intentCycle[inspectedEnemy.currentIntentIndex]
    : null;
  const inspectedConditionActive = inspectedEnemyIntent
    ? isIntentConditionMet(inspectedEnemyIntent, {
        shieldAfterPlayer: kiraThreat.shieldAfterPlayer,
        colorPlayed: activePreview?.tileCount ? activePreview.color : null,
      })
    : false;

  const enemyHitBoxes = useMemo(
    () =>
      computeEnemyHitBoxes(
        stageSize.w,
        stageSize.h,
        combat.enemies,
        simRef.current?.enemyCutouts,
        combat.director?.pendingReinforcements,
      ),
    [
      stageSize.w,
      stageSize.h,
      combat.enemies,
      combat.director?.pendingReinforcements,
      stageReady,
      cutoutVersion,
    ],
  );

  const heatPct = director
    ? Math.max(
        8,
        Math.min(100, Math.round((combat.turn / Math.max(1, director.overtimeTurnThreshold)) * 100)),
      )
    : 0;
  const heatStageLabel = director
    ? director.heatStage === 'overtime'
      ? t.heatOvertimeLabel
      : director.heatStage === 'medium'
        ? t.heatMediumLabel
        : t.heatLowLabel
    : '';
  const hasDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 3;
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-[120px] overflow-hidden bg-[#091126]"
    >
      <canvas
        ref={canvasRef}
        data-testid="combat-canvas"
        data-stage-ready={stageReady ? 'true' : 'false'}
        data-tactical-view={tacticalView ? 'true' : 'false'}
        data-autofocus-camera={autoFocusCamera ? 'true' : 'false'}
        onContextMenu={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sim = simRef.current;
          const zoom = sim?.cameraZoom || 1;
          const panX = sim?.cameraPanX || 0;
          const panY = sim?.cameraPanY || 0;
          const halfW = rect.width * 0.5;
          const halfH = rect.height * 0.5;
          const worldX = (e.clientX - rect.left - halfW - panX) / zoom + halfW;
          const worldY = (e.clientY - rect.top - halfH - panY) / zoom + halfH;
          const hitId = hitTestEnemySprite(worldX, worldY, enemyHitBoxes);
          if (hitId) {
            e.preventDefault();
            setInspectedTarget((prev) => (prev === hitId ? null : hitId));
          } else if (onUndoTurn) {
            e.preventDefault();
            onUndoTurn();
          }
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sim = simRef.current;
          const zoom = sim?.cameraZoom || 1;
          const panX = sim?.cameraPanX || 0;
          const panY = sim?.cameraPanY || 0;
          const halfW = rect.width * 0.5;
          const halfH = rect.height * 0.5;
          const worldX = (e.clientX - rect.left - halfW - panX) / zoom + halfW;
          const worldY = (e.clientY - rect.top - halfH - panY) / zoom + halfH;
          const hitId = hitTestEnemySprite(worldX, worldY, enemyHitBoxes);
          if (hitId) {
            setInspectedTarget((prev) => (prev === hitId ? null : hitId));
          } else if (inspectedTarget) {
            setInspectedTarget(null);
          }
        }}
        className={`block h-full w-full transition-opacity duration-200 ${
          stageReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Accessible Interactive Sprite Hitboxes for Direct Click/Tap/Keyboard/Loupe Inspection */}
      {stageReady && (
        <div
          ref={hitboxLayerRef}
          style={{ transformOrigin: '50% 50%' }}
          className="pointer-events-none absolute inset-0 z-[5]"
        >
          {enemyHitBoxes.map((box) => {
            const enemy = combat.enemies[box.idx];
            if (!enemy || enemy.hp <= 0) return null;
            const enemyMeta = t.enemies[enemy.archetype];
            const isInspected = inspectedTarget === enemy.id;
            return (
              <button
                key={`hitbox-${enemy.id}`}
                type="button"
                data-testid={`enemy-sprite-hitbox-${enemy.id}`}
                aria-label={`${enemyMeta.name} ${enemy.hp}/${enemy.maxHp} ${t.hpLabel}${
                  enemy.armor > 0 ? ` · ${enemy.armor} ${t.armorLabel}` : ''
                }`}
                aria-pressed={isInspected}
                onMouseEnter={() => setHoveredEnemyId(enemy.id)}
                onMouseLeave={() => setHoveredEnemyId((prev) => (prev === enemy.id ? null : prev))}
                onFocus={() => setHoveredEnemyId(enemy.id)}
                onBlur={() => setHoveredEnemyId((prev) => (prev === enemy.id ? null : prev))}
                onClick={() =>
                  setInspectedTarget((prev) => (prev === enemy.id ? null : enemy.id))
                }
                style={{
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                }}
                className="pointer-events-auto absolute cursor-pointer rounded-lg bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
              />
            );
          })}
        </div>
      )}

      {!stageReady && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <div className="chrome-pill flex items-center gap-2.5 rounded-lg px-4 py-2 text-xs font-mono-tabular font-semibold tracking-wider text-cyan-200">
            <span className="h-2 w-2 rounded-full bg-[#00F0FF] animate-ping" />
            <span>{t.synchronizingStage}</span>
          </div>
        </div>
      )}

      {/* Ultra-Sleek Chrome-Visor Stage Telemetry Overlays (no backdrop-blur over Canvas2D) */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-6xl flex-wrap md:flex-nowrap items-start justify-between gap-1.5 px-2 sm:px-4 ${
          isCompactLandscape ? 'top-1' : 'top-1.5 sm:top-2'
        }`}
      >
        {/* Left: Operative Chrome Lifebar Pod (tappable for passive/status details) */}
        <button
          type="button"
          data-testid="kira-lifebar-pod"
          data-preview-incoming-dmg={kiraThreat.hpDamageTaken}
          data-preview-lethal={kiraThreat.willDie ? 'true' : 'false'}
          onClick={() => setInspectedTarget((prev) => (prev === 'hero' ? null : 'hero'))}
          aria-expanded={inspectedTarget === 'hero'}
          aria-label={`${charMeta.code} ${heroine.hp}/${heroine.maxHp} ${t.hpLabel}`}
          className={`pointer-events-auto text-left rounded-lg transition-all duration-200 shrink-0 cursor-pointer ${hcBorderClass} ${
            isCompactLandscape
              ? 'w-[126px] sm:w-[152px] px-2 py-1'
              : 'w-[132px] sm:w-52 px-2 py-1 sm:px-2.5 sm:py-1.5'
          } ${
            kiraThreat.willDie
              ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)]'
              : kiraThreat.hpDamageTaken > 0
                ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)]'
                : 'chrome-pill border-cyan-200/35'
          }`}
        >
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
            <span className="flex items-center gap-1 chrome-text-shimmer font-display font-bold tracking-wider whitespace-nowrap">
              <span
                aria-hidden="true"
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#00F0FF] text-[8px] font-black text-slate-950"
              >
                ●
              </span>
              {charMeta.code}
            </span>
            <div className="flex items-center gap-0.5 font-mono-tabular font-bold shrink-0">
              {kiraHasHpChange ? (
                <>
                  <span className="text-rose-200/80">{heroine.hp}</span>
                  <span className="text-amber-300">→</span>
                  <span
                    className={
                      kiraThreat.willDie
                        ? 'text-[#FF2E7E] font-extrabold'
                        : kiraThreat.projectedHp < heroine.hp
                          ? 'text-[#FFC700]'
                          : 'text-emerald-300'
                    }
                  >
                    {kiraThreat.projectedHp}
                  </span>
                  <span className="hidden sm:inline text-slate-400">/{heroine.maxHp}</span>
                </>
              ) : (
                <span className="text-rose-200">
                  {heroine.hp}/{heroine.maxHp}
                </span>
              )}
            </div>
          </div>

          <div
            className={`relative mt-0.5 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
              kiraThreat.willDie
                ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
                : kiraThreat.hpDamageTaken > 0
                  ? 'ring-1 ring-[#FFC700]/60'
                  : ''
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
              style={{ width: `${Math.min(kiraHpPct, kiraProjHpPct)}%` }}
            />
            {kiraHealBarPct > 0 && (
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-[#10B981] to-[#6EE7B7] animate-pulse transition-all duration-150"
                style={{ left: `${kiraHpPct}%`, width: `${kiraHealBarPct}%` }}
              />
            )}
            {kiraDmgBarPct > 0 && (
              <div
                data-testid="kira-lifebar-preview"
                className={`absolute inset-y-0 transition-all duration-150 ${
                  kiraThreat.willDie
                    ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                    : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
                }`}
                style={{
                  left: `${kiraProjHpPct}%`,
                  width: `${kiraDmgBarPct}%`,
                }}
              />
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono-tabular">
            <div className="flex flex-wrap items-center gap-1">
              {((heroine.armor ?? 0) > 0 ||
                (kiraThreat.armorAfterEnemies ?? 0) !== (heroine.armor ?? 0)) && (
                <span
                  data-testid="heroine-armor-badge"
                  className="font-bold text-amber-300 whitespace-nowrap"
                >
                  🛡 {t.armorShort}{' '}
                  {(kiraThreat.armorAfterEnemies ?? heroine.armor ?? 0) !== (heroine.armor ?? 0)
                    ? `${heroine.armor ?? 0}→${kiraThreat.armorAfterEnemies ?? 0}`
                    : heroine.armor ?? 0}
                </span>
              )}
              {(heroine.shield > 0 || kiraThreat.shieldAfterPlayer > 0) && (
                <span className="font-bold text-[#00F0FF] whitespace-nowrap">
                  {t.shieldLabel}{' '}
                  {kiraThreat.shieldAfterPlayer !== heroine.shield
                    ? `${heroine.shield}→${kiraThreat.shieldAfterPlayer}`
                    : heroine.shield}
                </span>
              )}
              {((heroine.pendingUpcharge ?? 0) > 0 || (activePreview?.upchargeGained ?? 0) > 0) && (
                <span
                  data-testid="heroine-upcharge-badge"
                  className="font-bold text-emerald-300 whitespace-nowrap"
                >
                  ⚡+{(heroine.pendingUpcharge ?? 0) + (activePreview?.upchargeGained ?? 0)} {t.upchargeShort}
                </span>
              )}
              {(heroine.damageBoostPct > 0 ||
                (activePreview && activePreview.damageBoostAddedPct > 0)) && (
                <span className="font-bold text-[#FFC700] whitespace-nowrap">
                  +{heroine.damageBoostPct + (activePreview?.damageBoostAddedPct ?? 0)}%
                </span>
              )}
              {heroine.corrode > 0 && (
                <span className="font-bold text-lime-300 whitespace-nowrap">
                  {t.corrodeLabel} {heroine.corrode}
                </span>
              )}
              {kiraThreat.healGained > 0 && (
                <span className="font-bold text-emerald-300 whitespace-nowrap">
                  +{kiraThreat.healGained} {t.hpLabel}
                </span>
              )}
              {kiraThreat.retaliateDamage > 0 && (
                <span className="font-bold text-[#FF2E7E] whitespace-nowrap">
                  ⚠ {t.retaliateLabel}
                </span>
              )}
            </div>
            {(kiraThreat.hpDamageTaken > 0 || kiraThreat.rawIncomingDamage > 0) && (
              <span
                className={`font-bold whitespace-nowrap ${
                  kiraThreat.willDie
                    ? 'text-[#FF2E7E]'
                    : kiraThreat.hpDamageTaken > 0
                      ? 'text-[#FFC700]'
                      : 'text-cyan-200'
                }`}
              >
                {kiraThreat.willDie
                  ? `☠ -${kiraThreat.hpDamageTaken}`
                  : kiraThreat.hpDamageTaken > 0
                    ? `-${kiraThreat.hpDamageTaken} HP`
                    : `0 DMG (${kiraThreat.blockedDamage} BLK)`}
              </span>
            )}
          </div>
        </button>

        {/* Center: Sleek Single-Row Heat & Par Cache Strip */}
        {director && (
          <div
            data-testid="combat-heat-telemetry"
            data-heat-stage={director.heatStage}
            className="pointer-events-auto order-3 w-full md:order-none md:w-auto flex justify-center"
          >
            <div
              className={`aaa-charcoal-surface flex flex-col gap-1 rounded-lg border bg-[#181A20]/90 px-2.5 py-1 text-[10px] font-mono-tabular ${
                director.heatStage === 'overtime'
                  ? 'border-[#FF2E7E]/85'
                  : director.heatStage === 'medium'
                    ? 'border-[#FFC700]/75'
                    : 'border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <span
                  className={`font-display font-bold tracking-wider uppercase whitespace-nowrap ${
                    director.heatStage === 'overtime'
                      ? 'text-[#FF2E7E]'
                      : director.heatStage === 'medium'
                        ? 'text-[#FFC700]'
                        : 'text-[#00F0FF]'
                  }`}
                >
                  {heatStageLabel} · T{combat.turn}
                </span>

                <div className="flex items-center gap-1.5" data-testid="combat-par-caches">
                  {director.parCaches.map((cache) => (
                    <span
                      key={`par_${cache.tier}`}
                      data-intact={cache.intact ? 'true' : 'false'}
                      className={`text-[10px] font-bold leading-none whitespace-nowrap ${
                        cache.intact ? 'text-[#FFE066]' : 'text-slate-500 line-through'
                      }`}
                    >
                      {t.parCachePrefix}
                      {cache.maxTurn} +{cache.creditReward}
                    </span>
                  ))}
                  {director.tempoStreak > 0 && (
                    <span
                      data-testid="combat-tempo-badge"
                      title={t.tempoTip}
                      className="font-extrabold text-emerald-300 whitespace-nowrap"
                    >
                      · ×{director.tempoStreak}
                    </span>
                  )}
                  {director.rubberBandDelayed && (
                    <span
                      data-testid="combat-rubberband-badge"
                      className="font-bold text-cyan-300 whitespace-nowrap"
                    >
                      · {t.dropRubberBandDelayed}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-950/90">
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-200 ${
                    director.heatStage === 'overtime'
                      ? 'bg-gradient-to-r from-[#FFC700] to-[#FF2E7E]'
                      : director.heatStage === 'medium'
                        ? 'bg-gradient-to-r from-[#00F0FF] to-[#FFC700]'
                        : 'bg-gradient-to-r from-cyan-400 to-[#00F0FF]'
                  }`}
                  style={{ width: `${heatPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Right: Single-Row Compact Chrome Enemy Intent, Armor, Lifebar & Drop Pods */}
        <div className="flex flex-wrap sm:flex-nowrap justify-end gap-1 sm:gap-1.5 min-w-0">
          {combat.enemies.map((enemy, idx) => {
            const isDead = enemy.hp <= 0;
            const intent = enemy.intentCycle[enemy.currentIntentIndex];
            const enemyMeta = t.enemies[enemy.archetype];
            const enrageBonus = enemy.enrageAtkBonus ?? 0;
            const hpPct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
            const armorPreview = computeEnemyArmorPreview(
              enemy,
              idx,
              frontLivingIdx,
              activePreview,
              combat.enemies,
            );
            const {
              rawPreviewDmg,
              willBreakArmor,
              armorAbsorbed,
              remainingArmor,
              previewHpLoss,
              projectedHp,
              willDie,
              willCrackShieldPip,
              remainingShieldPips,
              willTriggerPhaseGate,
              chainedBurstDmg,
              willStagger,
            } = armorPreview;
            const conditionActive = isIntentConditionMet(intent, {
              shieldAfterPlayer: kiraThreat.shieldAfterPlayer,
              colorPlayed: activePreview?.tileCount ? activePreview.color : null,
            });
            const intentOptions = { staggered: enemy.staggered, conditionActive };
            const remainingHpPct = Math.max(0, Math.round((projectedHp / enemy.maxHp) * 100));
            const dmgBarPct = Math.max(0, hpPct - remainingHpPct);
            const hasArmor = !isDead && enemy.armor > 0;
            const hasShieldPips = !isDead && enemy.shieldPips > 0;
            const armorScaleMax = Math.max(enemy.armor, 10);
            const armorBarPct = hasArmor
              ? Math.max(20, Math.min(100, Math.round((enemy.armor / armorScaleMax) * 100)))
              : 0;
            const remainingArmorBarPct =
              hasArmor && !willBreakArmor
                ? Math.round(armorBarPct * (remainingArmor / Math.max(1, enemy.armor)))
                : 0;

            const rolePip = getEnemyRolePip(enemy.archetype);

            return (
              <button
                key={enemy.id}
                type="button"
                data-testid={`enemy-pod-${enemy.id}`}
                data-preview-dmg={rawPreviewDmg}
                data-preview-lethal={willDie ? 'true' : 'false'}
                onMouseEnter={() => !isDead && setHoveredEnemyId(enemy.id)}
                onMouseLeave={() => setHoveredEnemyId((prev) => (prev === enemy.id ? null : prev))}
                onClick={() =>
                  setInspectedTarget((prev) => (prev === enemy.id ? null : enemy.id))
                }
                aria-expanded={inspectedTarget === enemy.id}
                aria-label={`${rolePip.symbol} ${enemyMeta.name} ${enemy.hp}/${enemy.maxHp} ${t.hpLabel}${
                  hasArmor ? ` ${enemy.armor} ${t.armorLabel}` : ''
                } ${formatEnemyIntentCompact(intent, lang, enrageBonus, intentOptions)}`}
                className={`pointer-events-auto text-left rounded-lg transition-all duration-200 cursor-pointer ${!isDead ? hcBorderClass : ''} ${
                  isCompactLandscape
                    ? hasDenseEnemyRow
                      ? 'w-[110px] sm:w-[136px] lg:w-44 px-1.5 py-1'
                      : 'w-[126px] sm:w-[150px] lg:w-48 px-2 py-1'
                    : hasDenseEnemyRow
                      ? 'w-[108px] sm:w-40 lg:w-48 px-1.5 py-1 sm:px-2 sm:py-1.5'
                      : 'w-[120px] sm:w-44 lg:w-52 px-2 py-1 sm:px-2.5 sm:py-1.5'
                } ${
                  isDead
                    ? 'border border-white/10 bg-slate-950/55 opacity-35'
                    : willDie
                      ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)]'
                      : rawPreviewDmg > 0
                        ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)]'
                        : hasArmor
                          ? 'chrome-pill border-[#FFC700]/65 shadow-[0_0_12px_rgba(255,199,0,0.18)]'
                          : 'chrome-pill border-cyan-200/35'
                } ${inspectedTarget === enemy.id && !isDead ? 'ring-1 ring-[#00F0FF]' : ''}`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                  <span className="flex items-center gap-1 font-display font-bold text-white truncate">
                    <span
                      data-testid={`enemy-role-pip-${enemy.id}`}
                      style={{ backgroundColor: rolePip.accentHex, color: '#020617' }}
                      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[8px] font-black leading-none"
                    >
                      {rolePip.symbol}
                    </span>
                    <span className="truncate">{enemyMeta.name}</span>
                  </span>
                  <div className="flex items-center gap-0.5 font-mono-tabular font-bold shrink-0">
                    {hasShieldPips && (
                      <span
                        data-testid={`enemy-pip-badge-${enemy.id}`}
                        className="mr-0.5 inline-flex items-center"
                        title={t.pipLabel}
                      >
                        <ShieldPipIcon size={11} cracked={willCrackShieldPip} />
                      </span>
                    )}
                    {rawPreviewDmg > 0 && !isDead && previewHpLoss > 0 ? (
                      <>
                        <span className="text-rose-200/80">{enemy.hp}</span>
                        <span className="text-amber-300">→</span>
                        <span className={willDie ? 'text-[#FF2E7E] font-extrabold' : 'text-[#FFC700]'}>
                          {projectedHp}
                        </span>
                      </>
                    ) : (
                      <span className="text-rose-200">
                        {enemy.hp}/{enemy.maxHp}
                      </span>
                    )}
                    {pipMathMode && !isDead && (
                      <span
                        data-testid={`enemy-pip-math-${enemy.id}`}
                        className="ml-0.5 rounded bg-slate-950/90 px-1 text-[8px] font-extrabold text-[#FFC700]"
                      >
                        {formatDiscretePipMath(projectedHp).compactLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dedicated Prominent Gold Armor Plate Bar + Crest Badge when armored */}
                {hasArmor && (
                  <div
                    data-testid={`enemy-armor-display-${enemy.id}`}
                    className="mt-1 flex items-center gap-1.5"
                  >
                    <div className="flex items-center gap-0.5 shrink-0 font-mono-tabular text-[10px] font-extrabold leading-none">
                      <ArmorCrestIcon size={12} broken={willBreakArmor} />
                      <span
                        className={
                          willBreakArmor
                            ? 'text-[#FF2E7E] line-through'
                            : armorAbsorbed > 0
                              ? 'text-amber-200'
                              : 'text-[#FFC700]'
                        }
                      >
                        {willBreakArmor
                          ? `${enemy.armor}→0`
                          : armorAbsorbed > 0
                            ? `${enemy.armor}→${remainingArmor}`
                            : enemy.armor}
                      </span>
                    </div>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950/95 ring-1 ring-[#FFC700]/40">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D97706] via-[#FFC700] to-[#FEF08A] transition-all duration-150"
                        style={{
                          width: `${rawPreviewDmg > 0 ? remainingArmorBarPct : armorBarPct}%`,
                        }}
                      />
                      {rawPreviewDmg > 0 && armorBarPct > remainingArmorBarPct && (
                        <div
                          className={`absolute inset-y-0 transition-all duration-150 ${
                            willBreakArmor ? 'bg-[#FF2E7E] animate-pulse' : 'bg-white/85 animate-pulse'
                          }`}
                          style={{
                            left: `${remainingArmorBarPct}%`,
                            width: `${armorBarPct - remainingArmorBarPct}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`relative mt-1 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
                    willDie
                      ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
                      : rawPreviewDmg > 0
                        ? 'ring-1 ring-[#FFC700]/60'
                        : ''
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
                    style={{ width: `${rawPreviewDmg > 0 ? remainingHpPct : hpPct}%` }}
                  />
                  {dmgBarPct > 0 && !isDead && (
                    <div
                      data-testid={`enemy-lifebar-preview-${enemy.id}`}
                      className={`absolute inset-y-0 transition-all duration-150 ${
                        willDie
                          ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                          : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
                      }`}
                      style={{
                        left: `${remainingHpPct}%`,
                        width: `${dmgBarPct}%`,
                      }}
                    />
                  )}
                  {enemy.phaseGatePct && !enemy.phaseGateTriggered && !isDead && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-lime-300 shadow-[0_0_4px_#A3E635]"
                      style={{ left: `${enemy.phaseGatePct}%` }}
                    />
                  )}
                </div>

                {/* Nameless Icon + Numeric Intent Row */}
                <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono-tabular">
                  {!isDead ? (
                    <span
                      className={`flex items-center gap-1 font-bold truncate ${
                        enemy.staggered
                          ? 'text-cyan-300'
                          : conditionActive
                            ? 'text-[#FF2E7E]'
                            : 'text-lime-300'
                      }`}
                    >
                      <IntentIcon kind={intent.kind} size={12} />
                      <span className="truncate">
                        {formatEnemyIntentCompact(intent, lang, enrageBonus, intentOptions)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">KO</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isDead && (
                      enemy.staggered ? (
                        <span
                          data-testid={`enemy-staggered-${enemy.id}`}
                          className="rounded bg-cyan-500/25 px-1 text-[8px] font-extrabold text-cyan-200"
                        >
                          {t.staggeredTag}
                        </span>
                      ) : enemy.enragedAlone ? (
                        <span
                          data-testid={`enemy-enraged-alone-${enemy.id}`}
                          className="rounded bg-rose-500/35 px-1 text-[8px] font-extrabold text-rose-100"
                        >
                          {t.enragedAloneTag}
                        </span>
                      ) : enemy.sosCharging ? (
                        <span className="rounded bg-amber-400/25 px-1 text-[8px] font-extrabold text-amber-200">
                          {t.sosFlareBadgeLabel}
                        </span>
                      ) : enrageBonus > 0 ? (
                        <span className="rounded bg-rose-500/25 px-1 text-[8px] font-extrabold text-rose-200">
                          +{enrageBonus}
                        </span>
                      ) : enemy.isZeroReward ? (
                        <span className="rounded bg-slate-700/70 px-1 text-[8px] font-bold text-slate-300">
                          {t.zeroRewardBadgeLabel}
                        </span>
                      ) : null
                    )}
                    {hasShieldPips && (
                      <span className="shrink-0 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-sky-300">
                        {willCrackShieldPip ? `${enemy.shieldPips}→${remainingShieldPips}` : enemy.shieldPips}
                      </span>
                    )}
                  </div>
                </div>

                {rawPreviewDmg > 0 && !isDead && (
                  <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[9px] sm:text-[10px] font-bold">
                    <span
                      className={
                        willDie
                          ? 'text-[#FF2E7E]'
                          : willCrackShieldPip && previewHpLoss === 0
                            ? 'text-sky-300'
                            : 'text-[#FFC700]'
                      }
                    >
                      {willCrackShieldPip && previewHpLoss === 0
                        ? t.pipCrackLabel
                        : armorAbsorbed > 0 && previewHpLoss === 0
                          ? `-${armorAbsorbed} ${t.armorShort}`
                          : `-${previewHpLoss} ${t.hpLabel}${
                              armorAbsorbed > 0 && !willBreakArmor
                                ? ` (-${armorAbsorbed} ${t.armorShort})`
                                : ''
                            }`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {willDie ? (
                        <span className="rounded bg-[#FF2E7E] px-1 text-[8px] font-extrabold uppercase tracking-wider text-white">
                          ☠ {t.lethalLabel}
                        </span>
                      ) : willStagger ? (
                        <span
                          data-testid={`enemy-will-stagger-${enemy.id}`}
                          className="rounded bg-cyan-500/30 px-1 text-[8px] font-extrabold uppercase text-cyan-200 animate-pulse"
                        >
                          {t.staggerPreviewLabel}
                        </span>
                      ) : willTriggerPhaseGate ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[8px] font-extrabold uppercase text-lime-300">
                          {t.phaseGateLabel}
                        </span>
                      ) : willBreakArmor ? (
                        <span className="text-[#FFC700] uppercase">{t.armorBreakLabel}</span>
                      ) : chainedBurstDmg > 0 ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[8px] font-extrabold uppercase text-lime-300">
                          💥-{chainedBurstDmg}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </button>
            );
          })}

          {/* Telegraphed Inbound Reinforcement Drop-Pod Mini-Pods */}
          {pendingDrops.map((drop) => {
            const dropMeta = t.enemies[drop.archetype];
            const dropName = diff.revealDropArchetype ? dropMeta.name : '???';
            const isUrgent = drop.turnsUntilDrop <= 1;
            const dropInspectKey = `drop:${drop.id}`;
            return (
              <button
                key={drop.id}
                type="button"
                data-testid={`pending-drop-pod-${drop.id}`}
                onClick={() =>
                  setInspectedTarget((prev) => (prev === dropInspectKey ? null : dropInspectKey))
                }
                aria-expanded={inspectedTarget === dropInspectKey}
                aria-label={`${t.inboundDropLabel}: ${dropName} T-${drop.turnsUntilDrop} (${t.dropZeroDmgRule})`}
                className={`pointer-events-auto text-left rounded-lg border border-dashed transition-all duration-200 cursor-pointer bg-[#071127]/90 ${
                  isCompactLandscape
                    ? 'w-[110px] sm:w-[134px] px-1.5 py-1'
                    : 'w-[108px] sm:w-40 lg:w-44 px-1.5 py-1 sm:px-2 sm:py-1.5'
                } ${
                  isUrgent
                    ? 'border-[#FFC700]/85 shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                    : 'border-cyan-300/75 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                } ${inspectedTarget === dropInspectKey ? 'ring-1 ring-[#00F0FF]' : ''}`}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px]">
                  <span className="font-display font-bold text-cyan-100 truncate">
                    {dropName}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 font-mono-tabular text-[9px] font-extrabold ${
                      isUrgent
                        ? 'bg-[#FFC700] text-slate-950'
                        : 'bg-[#00F0FF]/20 text-[#00F0FF]'
                    }`}
                  >
                    T-{drop.turnsUntilDrop}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[8px] sm:text-[9px]">
                  <span className="font-bold uppercase tracking-wider text-amber-200 truncate">
                    {formatDropReasonLabel(drop.reason, t)}
                  </span>
                  {drop.isZeroReward && (
                    <span className="shrink-0 text-slate-400">{t.zeroRewardBadgeLabel}</span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono-tabular text-[8px] text-cyan-200/90">
                  {t.dropZeroDmgRule}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tap-to-Inspect Hero Card or Thematic Enemy Bio-Scanner Dossier (no backdrop-blur over Canvas2D) */}
      {inspectedTarget === 'hero' && (
        <div
          role="region"
          data-testid="combat-detail-card"
          aria-label="Combat unit details"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 right-2 bottom-2 z-30 mx-auto max-w-2xl max-h-[calc(100%-12px)] overflow-y-auto rounded-2xl border-2 border-cyan-300/75 bg-[#181A20]/98 px-4 py-3 text-[#F4F4F6] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-display text-[22px] sm:text-[24px] font-extrabold text-[#F4F4F6] leading-tight">
                  {charMeta.code} · {charMeta.name}
                </h3>
                <span className="text-xs font-bold text-cyan-300">
                  · {codexT.heroes[charId].roleTag}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {codexT.heroes[charId].passivePowers.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-xl border border-white/15 bg-[#0E1015] px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-1.5">
                      <span className="font-bold text-sm text-cyan-200">{p.name}</span>
                      <span className="font-mono-tabular text-xs font-extrabold text-[#FFC700] shrink-0">
                        {p.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[17px] leading-[1.3] text-[#F4F4F6] max-w-[40ch]">
                      {enforceEightWordRule(p.description)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#FFC700]/45 bg-[#0E1015] px-3 py-2 text-[17px] leading-[1.3] text-[#F4F4F6]">
                <span className="font-extrabold text-[#FFC700]">⚡ {charMeta.overdriveName}:</span>{' '}
                {enforceEightWordRule(charMeta.overdriveDesc)}
              </div>

              {heroine.corrode > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-lime-300">
                  <span>
                    ☣ {t.corrodeLabel} {heroine.corrode}: -{heroine.corrode} Shield gained.
                  </span>
                  {onOpenCodex && (
                    <button
                      type="button"
                      onClick={() => onOpenCodex('glossary', charId, 'corrode')}
                      className="font-bold text-[#00F0FF] underline underline-offset-2 hover:text-white cursor-pointer"
                    >
                      {codexT.openTermHint} →
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setInspectedTarget(null)}
                className="chrome-pill rounded-lg px-2.5 py-1 text-xs font-bold text-[#F4F4F6] cursor-pointer"
              >
                {t.closeLabel}
              </button>
              {onOpenCodex && (
                <button
                  type="button"
                  data-testid="hero-inspect-codex-btn"
                  onClick={() => onOpenCodex('heroes', charId, null)}
                  className="chrome-pill rounded-lg border-cyan-300/60 px-2.5 py-1 text-xs font-bold text-[#00F0FF] hover:border-cyan-200 hover:text-white whitespace-nowrap cursor-pointer"
                >
                  {codexT.inspectHeroDossierBtn} →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {inspectedDrop && (
        <div
          role="region"
          data-testid="combat-detail-card"
          aria-label={t.inboundDropLabel}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-2 right-2 bottom-2 z-30 mx-auto max-w-xl rounded-xl border border-dashed border-[#00F0FF]/75 bg-[#070E22]/96 px-3.5 py-2.5 text-xs shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#FFC700] px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-slate-950">
                  T-{inspectedDrop.turnsUntilDrop}
                </span>
                <span className="font-display text-sm font-bold text-white">
                  {diff.revealDropArchetype ? t.enemies[inspectedDrop.archetype].name : '???'}
                </span>
                <span className="font-mono-tabular text-[10px] font-bold uppercase text-cyan-300">
                  {formatDropReasonLabel(inspectedDrop.reason, t)}
                </span>
              </div>
              <p className="text-[11px] text-slate-200">
                {diff.revealDropArchetype
                  ? t.enemies[inspectedDrop.archetype].bioNote
                  : lang === 'cs'
                    ? 'Archetyp výsadku je na této obtížnosti utajen do dopadu.'
                    : 'Drop archetype is encrypted on this difficulty tier until touchdown.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-[10px]">
                <span className="rounded border border-cyan-300/40 bg-cyan-950/60 px-1.5 py-0.5 font-bold text-cyan-200">
                  {t.dropZeroDmgRule}
                </span>
                <span className="rounded border border-amber-300/40 bg-amber-950/60 px-1.5 py-0.5 font-bold text-[#FFE066]">
                  {t.fastClearBonusLabel}
                </span>
                {inspectedDrop.isZeroReward && (
                  <span className="rounded border border-slate-500/50 bg-slate-900 px-1.5 py-0.5 font-bold text-slate-300">
                    {t.zeroRewardBadgeLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInspectedTarget(null)}
              className="chrome-pill shrink-0 rounded px-2.5 py-1 text-[10px] font-bold text-white cursor-pointer"
            >
              {t.closeLabel}
            </button>
          </div>
        </div>
      )}

      {inspectedEnemy && inspectedEnemyPreview && (
        <EnemyIntelPanel
          enemy={inspectedEnemy}
          livingEnemies={livingEnemies}
          armorPreview={inspectedEnemyPreview}
          conditionActive={inspectedConditionActive}
          lang={lang}
          isCompactLandscape={isCompactLandscape}
          revealEnemyFutureCycle={diff.revealEnemyFutureCycle}
          onSelectEnemy={(enemyId) => setInspectedTarget(enemyId)}
          onOpenGlossaryTerm={
            onOpenCodex
              ? (termId) => onOpenCodex('glossary', charId, termId)
              : undefined
          }
          onClose={() => setInspectedTarget(null)}
        />
      )}
    </div>
  );
}
