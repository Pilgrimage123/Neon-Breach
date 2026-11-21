import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  areCriticalCombatAssetsReady,
  ensureCombatAssetsReady,
  subscribePreloadUpdates,
} from '../../assets/assetPreloader';
import type {
  CharacterId,
  CombatState,
  EnemyArchetype,
  HeroState,
  HeroThreatPreview,
  TileType,
  TurnPreview,
} from '../../engine/types';
import type { CombatDevLabsRuntimeState } from './CombatDevLabsPanel';
import { hydrateSimFromPreload } from './combatAssetHydration';
import { stepAndDispatchHeroFrame } from './combatFrameStepper';
import { computeAutoFocusTarget, renderCombatStage } from './combatRenderer';
import {
  type CombatStageSim,
  createCombatStageSim,
  resetCombatStageSim,
} from './combatStageTypes';
import { applyCombatCues, stepCombatSimulation } from './combatVfx';
import type { RendererMode } from './stageSpriteAdapter';
import { WebGL2CharacterStageRenderer } from './webglMeshRenderer';

export interface UseCombatStageRuntimeParams {
  runId: string;
  combat: CombatState;
  hero: HeroState;
  activePreview: TurnPreview | null;
  paused: boolean;
  tacticalView: boolean;
  autoFocusCamera: boolean;
  hoveringSwap: boolean;
  difficultyTier: number;
  rendererMode: RendererMode;
  debugMeshWireframe: boolean;
  hoveredEnemyId: string | null;
  inspectedTarget: 'hero' | string | null;
  heroThreat: HeroThreatPreview;
  dropIntelHorizon: { revealArchetype: boolean; revealSlot: boolean };
  charId: CharacterId;
  activeArchetypes: EnemyArchetype[];
  labRuntimeRef: MutableRefObject<CombatDevLabsRuntimeState>;
  onCueSequenceComplete?: (batchKey: string) => void;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  setHoveredEnemyId: Dispatch<SetStateAction<string | null>>;
}

export interface UseCombatStageRuntimeResult {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  webglCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  fgCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  hitboxLayerRef: MutableRefObject<HTMLDivElement | null>;
  simRef: MutableRefObject<CombatStageSim | null>;
  combatRef: MutableRefObject<CombatState>;
  heroRef: MutableRefObject<HeroState>;
  tacticalViewRef: MutableRefObject<boolean>;
  stageReady: boolean;
  stageSize: { w: number; h: number };
  cutoutVersion: number;
  requestDraw: () => void;
}

export function useCombatStageRuntime(
  params: UseCombatStageRuntimeParams,
): UseCombatStageRuntimeResult {
  const {
    runId,
    combat,
    hero,
    activePreview,
    paused,
    tacticalView,
    autoFocusCamera,
    hoveringSwap,
    difficultyTier,
    rendererMode,
    debugMeshWireframe,
    hoveredEnemyId,
    inspectedTarget,
    heroThreat,
    dropIntelHorizon,
    charId,
    activeArchetypes,
    labRuntimeRef,
    onCueSequenceComplete,
    setInspectedTarget,
    setHoveredEnemyId,
  } = params;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitboxLayerRef = useRef<HTMLDivElement | null>(null);
  const webglRendererRef = useRef<WebGL2CharacterStageRenderer | null>(null);

  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cutoutVersion, setCutoutVersion] = useState(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      : false,
  );
  const [stageReady, setStageReady] = useState<boolean>(() =>
    areCriticalCombatAssetsReady(charId, activeArchetypes),
  );
  const stageReadyRef = useRef(stageReady);
  stageReadyRef.current = stageReady;

  const combatRef = useRef(combat);
  const heroRef = useRef(hero);
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
  const dropIntelHorizonRef = useRef(dropIntelHorizon);
  const heroThreatRef = useRef(heroThreat);
  const rendererModeRef = useRef<RendererMode>(rendererMode);
  const debugMeshWireframeRef = useRef<boolean>(debugMeshWireframe);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const onCueSequenceCompleteRef = useRef(onCueSequenceComplete);

  combatRef.current = combat;
  heroRef.current = hero;
  pausedRef.current = paused;
  hoveredColorRef.current = activePreview?.color ?? null;
  activePreviewRef.current = activePreview;
  hoveredEnemyIdRef.current = hoveredEnemyId;
  inspectedEnemyIdRef.current =
    inspectedTarget && inspectedTarget !== 'hero' ? inspectedTarget : null;
  tacticalViewRef.current = tacticalView;
  autoFocusCameraRef.current = autoFocusCamera;
  hoveringSwapRef.current = hoveringSwap;
  dropIntelHorizonRef.current = dropIntelHorizon;
  heroThreatRef.current = heroThreat;
  rendererModeRef.current = rendererMode;
  debugMeshWireframeRef.current = debugMeshWireframe;
  reducedMotionRef.current = reducedMotion;
  onCueSequenceCompleteRef.current = onCueSequenceComplete;

  const simRef = useRef<CombatStageSim | null>(null);
  if (!simRef.current) {
    simRef.current = createCombatStageSim();
  }

  const requestDrawRef = useRef<() => void>(() => {});
  const syncAndDrawNowRef = useRef<() => void>(() => {});

  const requestDraw = useCallback(() => {
    requestDrawRef.current();
  }, []);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    resetCombatStageSim(sim);
    setInspectedTarget(null);
    setHoveredEnemyId(null);
    requestDrawRef.current();
  }, [runId, combat.nodeId, setInspectedTarget, setHoveredEnemyId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    applyCombatCues(sim, combat, heroRef.current, {
      presentationConfig: labRuntimeRef.current.presentationConfig,
      tacticalViewActive: tacticalViewRef.current,
      onSequenceComplete: onCueSequenceCompleteRef.current,
    });
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [combat, labRuntimeRef]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [
    paused,
    activePreview,
    hero.hp,
    hero.shield,
    hoveredEnemyId,
    inspectedTarget,
    tacticalView,
    autoFocusCamera,
    hoveringSwap,
    difficultyTier,
    rendererMode,
    debugMeshWireframe,
    reducedMotion,
  ]);

  useEffect(() => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const webglCanvas = webglCanvasRef.current;
    const container = containerRef.current;
    if (!sim || !canvas || !container) return;

    const activeSim: CombatStageSim = sim;
    const activeCanvas: HTMLCanvasElement = canvas;
    const activeContainer: HTMLDivElement = container;

    let unmounted = false;
    let rafId = 0;
    let yieldTimerId = 0;
    let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let elapsed = 0;

    function cancelScheduledFrame() {
      if (rafId !== 0 && typeof window !== 'undefined') {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (yieldTimerId !== 0 && typeof window !== 'undefined') {
        window.clearTimeout(yieldTimerId);
        yieldTimerId = 0;
      }
    }

    function scheduleFrame() {
      if (unmounted || rafId !== 0 || yieldTimerId !== 0 || typeof window === 'undefined') return;
      rafId = requestAnimationFrame(renderFrame);
    }

    if (webglCanvas && !webglRendererRef.current) {
      webglRendererRef.current = new WebGL2CharacterStageRenderer(webglCanvas, undefined, undefined, {
        onContextStatusChange: (ready) => {
          if (unmounted) return;
          if (!ready && fgCanvasRef.current) {
            const fgCtx = fgCanvasRef.current.getContext('2d');
            if (fgCtx) {
              fgCtx.setTransform(1, 0, 0, 1, 0, 0);
              fgCtx.clearRect(0, 0, fgCanvasRef.current.width, fgCanvasRef.current.height);
            }
          }
          activeSim.needsRedraw = true;
          if (stageReadyRef.current) {
            cancelScheduledFrame();
            lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
            renderFrame(lastTime);
          }
        },
      });
    }

    function renderFrame(now: number) {
      const frameStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      rafId = 0;
      if (unmounted) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const docHidden = typeof document !== 'undefined' ? document.hidden : false;
      const isPaused = pausedRef.current || docHidden || !stageReadyRef.current;

      if (isPaused && !activeSim.needsRedraw) {
        return;
      }

      const ctx = activeCanvas.getContext('2d');
      if (!ctx) {
        if (!isPaused) scheduleFrame();
        return;
      }

      const currentCombat = combatRef.current;
      const currentHero = heroRef.current;
      const labRuntime = labRuntimeRef.current;

      applyCombatCues(activeSim, currentCombat, currentHero, {
        presentationConfig: labRuntime.presentationConfig,
        tacticalViewActive: tacticalViewRef.current,
        onSequenceComplete: onCueSequenceCompleteRef.current,
      });

      let simDt = 0;
      if (!isPaused) {
        const autoTarget = computeAutoFocusTarget({
          w: activeSim.size.w,
          h: activeSim.size.h,
          enemies: currentCombat.enemies,
          pendingDrops: currentCombat.director?.pendingReinforcements ?? [],
          hoveredColor: hoveredColorRef.current,
          inspectedEnemyId: inspectedEnemyIdRef.current,
          autoFocusCamera: autoFocusCameraRef.current,
          tacticalViewActive: tacticalViewRef.current,
        });
        simDt = stepCombatSimulation(activeSim, dt, {
          tacticalViewActive: tacticalViewRef.current,
          reducedMotion: reducedMotionRef.current,
          idleZoom: autoTarget.zoom,
          idlePanX: autoTarget.panX,
          idlePanY: autoTarget.panY,
          combat: currentCombat,
          hero: currentHero,
          hoveredColor: hoveredColorRef.current,
          activePreview: activePreviewRef.current,
          projectedShield: heroThreatRef.current?.shieldAfterPlayer ?? currentHero.shield,
          elapsed: elapsed + dt,
          spitterJuiceConfig: labRuntime.spitterJuiceConfig,
          spitterLabActive: labRuntime.spitterLabActive,
          bruteJuiceConfig: labRuntime.bruteJuiceConfig,
          bruteLabActive: labRuntime.bruteLabActive,
        });
        elapsed += simDt;
      }

      const heroSample = stepAndDispatchHeroFrame({
        sim: activeSim,
        combat: currentCombat,
        hero: currentHero,
        hoveredColor: hoveredColorRef.current,
        simDt,
        elapsed,
        isPaused,
        activeCanvas,
      });

      activeSim.lastFrameDt = isPaused ? 0 : simDt;
      const fgCtx = fgCanvasRef.current?.getContext('2d') ?? null;
      const activeMode = rendererModeRef.current;
      const webglReady = Boolean(
        activeMode === 'webgl2' && webglRendererRef.current?.isReady,
      );
      if (!webglReady) {
        webglRendererRef.current?.clearCanvas();
        if (fgCtx && fgCanvasRef.current) {
          fgCtx.setTransform(1, 0, 0, 1, 0, 0);
          fgCtx.clearRect(0, 0, fgCanvasRef.current.width, fgCanvasRef.current.height);
        }
      }
      renderCombatStage(
        ctx,
        activeSim,
        currentCombat,
        currentHero,
        hoveredColorRef.current,
        heroSample,
        elapsed,
        activePreviewRef.current,
        hoveredEnemyIdRef.current,
        inspectedEnemyIdRef.current,
        tacticalViewRef.current,
        autoFocusCameraRef.current,
        hoveringSwapRef.current,
        heroThreatRef.current,
        dropIntelHorizonRef.current,
        {
          rendererMode: activeMode,
          webglRenderer: webglRendererRef.current,
          fgCtx,
          debugMeshWireframe: debugMeshWireframeRef.current,
          spitterJuiceConfig: labRuntime.spitterJuiceConfig,
          spitterLabActive: labRuntime.spitterLabActive,
          bruteJuiceConfig: labRuntime.bruteJuiceConfig,
          bruteLabActive: labRuntime.bruteLabActive,
          presentationConfig: labRuntime.presentationConfig,
          sequencerFrame: activeSim.lastSeqFrame ?? undefined,
          getActorJuice: (id) => activeSim.actionSequencer.getActorJuice(id),
          reducedMotion: reducedMotionRef.current,
          devLabRenderer: labRuntime.devLabRenderer,
        },
      );
      const camZoom = activeSim.cameraZoom || 1;
      const camPanX = activeSim.cameraPanX || 0;
      const camPanY = activeSim.cameraPanY || 0;
      const camRotRad = activeSim.cameraRotRad || 0;
      if (hitboxLayerRef.current) {
        const hasCamTransform =
          Math.abs(camZoom - 1) > 0.004 ||
          Math.abs(camPanX) > 0.5 ||
          Math.abs(camPanY) > 0.5 ||
          Math.abs(camRotRad) > 0.001;
        hitboxLayerRef.current.style.transform = hasCamTransform
          ? `translate(${camPanX}px, ${camPanY}px) rotate(${camRotRad}rad) scale(${camZoom})`
          : '';
      }
      const zoomStr = camZoom.toFixed(2);
      if (activeCanvas.dataset.cameraZoom !== zoomStr) {
        activeCanvas.dataset.cameraZoom = zoomStr;
      }
      activeSim.needsRedraw = false;

      if (!isPaused && typeof window !== 'undefined') {
        const frameEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const frameCostMs = frameEnd - frameStart;
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

    syncAndDrawNowRef.current = () => {
      if (unmounted) return;
      if (hydrateSimFromPreload(activeSim)) {
        setCutoutVersion((v) => v + 1);
      }
      activeSim.needsRedraw = true;
      cancelScheduledFrame();
      lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      renderFrame(lastTime);
    };

    requestDrawRef.current = scheduleFrame;

    hydrateSimFromPreload(activeSim);

    const unsubscribePreload = subscribePreloadUpdates(() => {
      if (unmounted) return;
      if (hydrateSimFromPreload(activeSim)) {
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
      const dpr = Math.min(
        2,
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      );
      const pw = Math.floor(w * dpr);
      const ph = Math.floor(h * dpr);
      activeCanvas.width = pw;
      activeCanvas.height = ph;
      if (webglCanvasRef.current) {
        webglCanvasRef.current.width = pw;
        webglCanvasRef.current.height = ph;
      }
      if (fgCanvasRef.current) {
        fgCanvasRef.current.width = pw;
        fgCanvasRef.current.height = ph;
      }
      activeSim.size = { w, h };
      activeSim.dpr = dpr;
      activeSim.needsRedraw = true;
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      if (stageReadyRef.current) {
        cancelScheduledFrame();
        lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        renderFrame(lastTime);
      }
    };

    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    ro?.observe(activeContainer);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        activeSim.needsRedraw = true;
        scheduleFrame();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    if (stageReadyRef.current) {
      scheduleFrame();
    }
    return () => {
      unmounted = true;
      unsubscribePreload();
      requestDrawRef.current = () => {};
      syncAndDrawNowRef.current = () => {};
      cancelScheduledFrame();
      ro?.disconnect();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (webglRendererRef.current) {
        webglRendererRef.current.dispose();
        webglRendererRef.current = null;
      }
    };
  }, [labRuntimeRef]);

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

  return {
    containerRef,
    canvasRef,
    webglCanvasRef,
    fgCanvasRef,
    hitboxLayerRef,
    simRef,
    combatRef,
    heroRef,
    tacticalViewRef,
    stageReady,
    stageSize,
    cutoutVersion,
    requestDraw,
  };
}
