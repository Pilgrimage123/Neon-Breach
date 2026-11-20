import { useEffect, useMemo, useRef, useState } from 'react';
import {
  areCriticalCombatAssetsReady,
  ensureCombatAssetsReady,
  getPreloadedBackdrop,
  getPreloadedBruteFrames,
  getPreloadedCrawlerFrames,
  getPreloadedEnemyCutout,
  getPreloadedHeroFrames,
  getPreloadedSpitterFrames,
  getPreloadedStalkerFrames,
  getPreloadedZuriDroneFrames,
  subscribePreloadUpdates,
} from '../assets/assetPreloader';
import { getDifficultyProfile } from '../engine/difficulty';
import { previewHeroineThreat } from '../engine/gameEngine';
import { getEnemySlotSpan, isIntentConditionMet } from '../engine/reinforcementDirector';
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
  triggerCharacterAnimation,
} from '../utils/aureliaSpriteSheet';
import {
  HEROINE_CANONICAL_HEIGHT,
  HEROINE_DODGE_DURATION,
  HEROINE_SHEET_FRAMES,
} from '../utils/heroineSpriteSheet';
import {
  ZURI_CANONICAL_HEIGHT,
  ZURI_SHEET_FRAMES,
  sampleZuriDroneFormation,
} from '../utils/zuriSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceTrigger,
  createSpitterJuiceState,
  triggerSpitterJuiceState,
} from '../utils/spitterJuiceController';
import {
  type BruteJuiceConfig,
  type BruteJuiceTrigger,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  triggerBruteJuiceState,
} from '../utils/bruteJuiceController';
import { computeAutoFocusTarget, renderCombatStage } from './combat/combatRenderer';
import {
  type CombatPresentationConfig,
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
} from './combat/combatPresentationConfig';
import type { CameraActorBounds } from './combat/ActionCameraController';
import type { CutInActionKind, CutInStagingMode } from './combat/CombatActionSequencer';
import {
  DEFAULT_RENDERER_CONFIG,
  type RendererMode,
} from './combat/stageSpriteAdapter';
import { WebGL2CharacterStageRenderer } from './combat/webglMeshRenderer';
import {
  type CombatStageSim,
  createCombatStageSim,
  getBridgeGroundY,
  getEnemyLaneMetrics,
  getStageLayoutMetrics,
  resetCombatStageSim,
} from './combat/combatStageTypes';
import {
  computeEffectiveSlotCount,
  computeEnemyArmorPreview,
  computeEnemyHitBoxes,
  computeEnemySlotLayout,
  formatEnemyIntentCompact,
  getEnemyReactiveBark,
  hitTestEnemySprite,
} from './combat/combatEnemyUi';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from './combat/CombatIcons';
import { EnemyIntelPanel } from './combat/EnemyIntelPanel';
import {
  addOrGrowFloorBlood,
  applyCombatCues,
  drainTriggerImpacts,
  ensureEnemyAnim,
  spawnBurst,
  spawnFloatingText,
  spawnStyledProjectileVolley,
  stepCombatSimulation,
  triggerKiraDodgeVfx,
} from './combat/combatVfx';
import type { ProjectileVisualProfile } from './combat/combatStagingClassifier';
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
  onCueSequenceComplete?: (batchKey: string) => void;
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
  onCueSequenceComplete,
}: CombatStageCanvasProps) {
  const diff = getDifficultyProfile(difficultyTier);
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<WebGL2CharacterStageRenderer | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>(
    DEFAULT_RENDERER_CONFIG.defaultMode,
  );
  const [debugMeshWireframe, setDebugMeshWireframe] = useState<boolean>(
    DEFAULT_RENDERER_CONFIG.defaultDebugWireframe,
  );
  const [spitterLabOpen, setSpitterLabOpen] = useState<boolean>(false);
  const [spitterJuiceConfig, setSpitterJuiceConfig] = useState<SpitterJuiceConfig>(
    DEFAULT_SPITTER_JUICE_CONFIG,
  );
  const [lastSpitterTrigger, setLastSpitterTrigger] = useState<SpitterJuiceTrigger>('idle');
  const [bruteLabOpen, setBruteLabOpen] = useState<boolean>(false);
  const [bruteJuiceConfig, setBruteJuiceConfig] = useState<BruteJuiceConfig>(
    DEFAULT_BRUTE_JUICE_CONFIG,
  );
  const [lastBruteTrigger, setLastBruteTrigger] = useState<BruteJuiceTrigger>('idle');
  const [cameraLabOpen, setCameraLabOpen] = useState<boolean>(false);
  const [presentationConfig, setPresentationConfig] = useState<CombatPresentationConfig>(
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
  );
  const [lastCameraTrigger, setLastCameraTrigger] = useState<
    'idle' | 'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge'
  >('idle');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      : false,
  );
  const rendererModeRef = useRef<RendererMode>(rendererMode);
  const debugMeshWireframeRef = useRef<boolean>(debugMeshWireframe);
  const spitterLabOpenRef = useRef<boolean>(spitterLabOpen);
  const spitterJuiceConfigRef = useRef<SpitterJuiceConfig>(spitterJuiceConfig);
  const bruteLabOpenRef = useRef<boolean>(bruteLabOpen);
  const bruteJuiceConfigRef = useRef<BruteJuiceConfig>(bruteJuiceConfig);
  const cameraLabOpenRef = useRef<boolean>(cameraLabOpen);
  const presentationConfigRef = useRef<CombatPresentationConfig>(presentationConfig);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const onCueSequenceCompleteRef = useRef(onCueSequenceComplete);
  rendererModeRef.current = rendererMode;
  debugMeshWireframeRef.current = debugMeshWireframe;
  spitterLabOpenRef.current = spitterLabOpen;
  spitterJuiceConfigRef.current = spitterJuiceConfig;
  bruteLabOpenRef.current = bruteLabOpen;
  bruteJuiceConfigRef.current = bruteJuiceConfig;
  cameraLabOpenRef.current = cameraLabOpen;
  presentationConfigRef.current = presentationConfig;
  reducedMotionRef.current = reducedMotion;
  onCueSequenceCompleteRef.current = onCueSequenceComplete;
  const [inspectedTarget, setInspectedTarget] = useState<'hero' | string | null>(null);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cutoutVersion, setCutoutVersion] = useState(0);

  const charId: CharacterId = heroine.characterId ?? 'kira';
  const activeArchetypeKey = combat.enemies.map((e) => e.archetype).join(',');
  const activeArchetypes = useMemo(() => {
    const list = activeArchetypeKey
      ? (activeArchetypeKey.split(',') as EnemyArchetype[])
      : ([] as EnemyArchetype[]);
    if (spitterLabOpen && !list.includes('spitter')) {
      list.push('spitter');
    }
    if (bruteLabOpen && !list.includes('brute')) {
      list.push('brute');
    }
    return list;
  }, [activeArchetypeKey, spitterLabOpen, bruteLabOpen]);

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

  // Track OS prefers-reduced-motion changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  // Trigger procedural cues & heroine sprite animations whenever combat.lastCues changes
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    applyCombatCues(sim, combat, heroineRef.current, {
      presentationConfig: presentationConfigRef.current,
      tacticalViewActive: tacticalViewRef.current,
      onSequenceComplete: onCueSequenceCompleteRef.current,
    });
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
    rendererMode,
    debugMeshWireframe,
    spitterLabOpen,
    spitterJuiceConfig,
    bruteLabOpen,
    bruteJuiceConfig,
    cameraLabOpen,
    presentationConfig,
    reducedMotion,
  ]);

  const fireSpitterTrigger = (trig: SpitterJuiceTrigger) => {
    const sim = simRef.current;
    if (!sim) return;
    const cfg = spitterJuiceConfigRef.current;
    // Apply to lab specimen
    let specState = sim.spitterJuiceStates.get('spitter_lab_specimen');
    if (!specState) {
      specState = createSpitterJuiceState();
      sim.spitterJuiceStates.set('spitter_lab_specimen', specState);
    }
    triggerSpitterJuiceState(specState, trig, cfg);

    // Apply to all living Bile Spitters in the active combat encounter
    for (const enemy of combatRef.current.enemies) {
      if (enemy.archetype === 'spitter' && enemy.hp > 0) {
        let es = sim.spitterJuiceStates.get(enemy.id);
        if (!es) {
          es = createSpitterJuiceState();
          sim.spitterJuiceStates.set(enemy.id, es);
        }
        triggerSpitterJuiceState(es, trig, cfg);
      }
    }
    setLastSpitterTrigger(trig);
    sim.needsRedraw = true;
    requestDrawRef.current();
  };

  const fireBruteTrigger = (trig: BruteJuiceTrigger) => {
    const sim = simRef.current;
    if (!sim) return;
    const cfg = bruteJuiceConfigRef.current;
    // Apply to lab specimen
    let specState = sim.bruteJuiceStates.get('brute_lab_specimen');
    if (!specState) {
      specState = createBruteJuiceState();
      sim.bruteJuiceStates.set('brute_lab_specimen', specState);
    }
    triggerBruteJuiceState(specState, trig, cfg);

    // Apply to all living Carapace Brutes in the active combat encounter
    for (const enemy of combatRef.current.enemies) {
      if (enemy.archetype === 'brute' && enemy.hp > 0) {
        let es = sim.bruteJuiceStates.get(enemy.id);
        if (!es) {
          es = createBruteJuiceState();
          sim.bruteJuiceStates.set(enemy.id, es);
        }
        triggerBruteJuiceState(es, trig, cfg);
      }
    }
    setLastBruteTrigger(trig);
    sim.needsRedraw = true;
    requestDrawRef.current();
  };

  const fireCameraTrigger = (
    kind: 'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge',
  ) => {
    const sim = simRef.current;
    if (!sim) return;
    const combatCur = combatRef.current;
    const heroCur = heroineRef.current;
    const { w, h } = sim.size;
    const groundY = getBridgeGroundY(h);
    const living = combatCur.enemies.filter((e) => e.hp > 0);
    const { slotCenters, effectiveSlotCount } = computeEnemySlotLayout(
      combatCur.enemies,
      combatCur.director?.pendingReinforcements,
    );
    const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, effectiveSlotCount);
    const heroX = w < 460 ? w * 0.19 : w * 0.22;

    const buildBounds = (actorId: string): CameraActorBounds => {
      if (actorId === 'hero') {
        const heroHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
        return {
          id: 'hero',
          x: heroX,
          groundY,
          widthPx: heroHeight * 0.72,
          heightPx: heroHeight,
        };
      }
      const idx = combatCur.enemies.findIndex((e) => e.id === actorId);
      const safeIdx = idx >= 0 ? idx : 0;
      const arch = combatCur.enemies[safeIdx]?.archetype ?? 'larva';
      const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
      const archScale =
        arch === 'boss'
          ? 1.24
          : arch === 'brute'
            ? 1.32
            : arch === 'larva'
              ? 0.76
              : arch === 'skitter'
                ? 0.88
                : arch === 'stinger'
                  ? 0.96
                  : 0.94;
      const heightPx = baseEnemySize * archScale;
      const enemyGroundY = groundY + (safeIdx % 2 === 1 ? -6 : 0);
      const centerSlot = slotCenters[safeIdx] ?? safeIdx;
      return {
        id: actorId,
        x: enemyBaseX + centerSlot * enemyStepX,
        groundY: enemyGroundY,
        widthPx: heightPx * 0.82,
        heightPx,
      };
    };

    if (kind === 'kira_dodge') {
      const attackerEnemy = living[0];
      if (!attackerEnemy || tacticalViewRef.current || !presentationConfigRef.current.enabled) {
        sim.actionSequencer.reset();
        triggerKiraDodgeVfx(sim, heroX, groundY);
        setLastCameraTrigger('kira_dodge');
        sim.needsRedraw = true;
        requestDrawRef.current();
        return;
      }
      const dodgeActorIds = Array.from(new Set(['hero', ...living.map((e) => e.id)]));
      void sim.actionSequencer.playCutIn(
        {
          id: `cam_lab_kira_dodge_${Date.now()}`,
          actionKind: 'normal',
          stagingMode: 'melee',
          attackerId: attackerEnemy.id,
          targetIds: ['hero'],
          allActorIds: dodgeActorIds,
          attackerBounds: buildBounds(attackerEnemy.id),
          targetBounds: [buildBounds('hero')],
          tempoScale: 1.0,
          waitForExternalImpact: false,
          evadedTargetIds: ['hero'],
          hitstopOverrideSec: 0.05,
          holdDurationOverrideSec: HEROINE_DODGE_DURATION + 0.04,
          replaceQueue: true,
          onWindupStart: () => {
            const ea = ensureEnemyAnim(sim, attackerEnemy.id);
            ea.lunge = 1;
            ea.lungeDir = -1;
            ea.attackAnimDuration = 0.58;
            ea.attackAnimTimer = 0.58;
            if (attackerEnemy.archetype === 'spitter') ea.spitterAttackKind = 'claw';
            else if (attackerEnemy.archetype === 'brute') ea.bruteAttackKind = 'attack';
          },
          onImpactFrame: () => {
            const liveHeroX = sim.actionSequencer.getLiveActorX('hero', heroX);
            triggerKiraDodgeVfx(sim, liveHeroX, groundY);
          },
        },
        presentationConfigRef.current,
        w,
        h,
      );
      setLastCameraTrigger('kira_dodge');
      sim.needsRedraw = true;
      requestDrawRef.current();
      return;
    }

    const isAoe = kind === 'ranged_aoe';
    const isRanged = kind === 'ranged_single' || isAoe;
    const isCrit = kind === 'melee_crit';

    let targets: string[];
    let targetBounds: CameraActorBounds[];
    if (isAoe) {
      if (living.length >= 2) {
        targets = living.slice(0, 4).map((e) => e.id);
        targetBounds = targets.map((tid) => buildBounds(tid));
      } else {
        // Ensure AoE cascade is always visibly testable even with 0-1 living enemies
        const baseTargets = living.map((e) => buildBounds(e.id));
        const syntheticCount = Math.max(0, 3 - baseTargets.length);
        const combined = [...baseTargets];
        for (let i = 0; i < syntheticCount; i++) {
          const id = `cam_lab_aoe_${i + 1}`;
          combined.push({
            id,
            x: w * (0.58 + i * 0.12),
            groundY: groundY + (i % 2 === 1 ? -6 : 0),
            widthPx: 92,
            heightPx: 146,
          });
        }
        targetBounds = combined;
        targets = combined.map((b) => b.id);
      }
    } else {
      const primaryId = living[0]?.id ?? 'cam_lab_dummy';
      targets = [primaryId];
      targetBounds = [
        primaryId === 'cam_lab_dummy'
          ? { id: 'cam_lab_dummy', x: w * 0.68, groundY, widthPx: 96, heightPx: 148 }
          : buildBounds(primaryId),
      ];
    }

    const actionKind: CutInActionKind = isCrit ? 'crit' : isAoe ? 'aoe' : 'normal';
    const stagingMode: CutInStagingMode = isAoe
      ? 'ranged_aoe'
      : isRanged
        ? 'ranged_fast'
        : 'melee';
    const allActorIds = Array.from(new Set(['hero', ...living.map((e) => e.id), ...targets]));
    const heroBounds = buildBounds('hero');
    const boundsById = new Map(targetBounds.map((tb) => [tb.id, tb] as const));

    void sim.actionSequencer.playCutIn(
      {
        id: `cam_lab_${kind}_${Date.now()}`,
        actionKind,
        stagingMode,
        attackerId: 'hero',
        targetIds: targets,
        allActorIds,
        attackerBounds: heroBounds,
        targetBounds,
        tempoScale: 1.0,
        waitForExternalImpact: false,
        replaceQueue: true,
        onWindupStart: () => {
          const activeChar = heroCur.characterId ?? 'kira';
          // Aurelia and Zuri are 100% ranged; Kira uses melee dash_kick for melee triggers and pistol shoot for ranged
          const animMode = isRanged || activeChar !== 'kira' ? 'shoot' : 'dash_kick';
          sim.heroState = triggerCharacterAnimation(sim.heroState, animMode, activeChar);
        },
        onProjectileSpawn: isRanged
          ? () => {
              const activeChar = heroCur.characterId ?? 'kira';
              const profile: ProjectileVisualProfile =
                activeChar === 'aurelia'
                  ? 'scattergun'
                  : activeChar === 'zuri'
                    ? 'drone_plasma'
                    : 'pistol_bolt';
              const muzzleX =
                heroBounds.x +
                heroBounds.widthPx *
                  (activeChar === 'zuri' ? 0.85 : activeChar === 'aurelia' ? 0.68 : 0.62);
              const muzzleY =
                heroBounds.groundY -
                heroBounds.heightPx *
                  (activeChar === 'zuri' ? 0.78 : activeChar === 'aurelia' ? 0.66 : 0.72);
              for (let i = 0; i < targetBounds.length; i++) {
                const tb = targetBounds[i];
                spawnStyledProjectileVolley(sim, {
                  profile,
                  sx: muzzleX,
                  sy: muzzleY,
                  tx: tb.x,
                  ty: tb.groundY - tb.heightPx * 0.46,
                  isCrit,
                  isOverdrive: isAoe,
                });
              }
              spawnBurst(
                sim,
                muzzleX,
                muzzleY,
                isAoe ? 14 : 10,
                activeChar === 'aurelia' ? '#FFC700' : activeChar === 'zuri' ? '#FF2E7E' : '#00F0FF',
                1,
                0.9,
              );
            }
          : undefined,
        onImpactTarget: (targetId, idx) => {
          const tb = boundsById.get(targetId);
          if (!tb) return;
          const liveX = sim.actionSequencer.getLiveActorX(targetId, tb.x);
          const hitY = tb.groundY - tb.heightPx * 0.45;
          spawnBurst(
            sim,
            liveX,
            hitY,
            isCrit ? 26 : isAoe ? 18 : 14,
            isCrit ? '#FFE066' : isAoe ? '#FF2E7E' : '#00F0FF',
            1,
            isCrit ? 1.35 : 1.15,
          );
          spawnFloatingText(
            sim,
            liveX,
            hitY - 34,
            isCrit ? 'CRIT -28!' : isAoe ? `-${16 + idx * 2}` : isRanged ? '-16' : '-14',
            isCrit ? '#FFE066' : isAoe ? '#FF6B9E' : '#38BDF8',
            isCrit ? 1.38 : 1.1,
          );
        },
      },
      presentationConfigRef.current,
      w,
      h,
    );
    setLastCameraTrigger(kind);
    sim.needsRedraw = true;
    requestDrawRef.current();
  };

  // Keys 1–6 Test Harness when Spitter, Brute, or Camera Lab is open
  useEffect(() => {
    if (!spitterLabOpen && !bruteLabOpen && !cameraLabOpen) return;
    const spitterKeyMap: Record<string, SpitterJuiceTrigger> = {
      '1': 'idle',
      '2': 'advance_retreat',
      '3': 'attack_lunge',
      '4': 'cast_charge',
      '5': 'take_hit',
      '6': 'turn_around',
    };
    const bruteKeyMap: Record<string, BruteJuiceTrigger> = {
      '1': 'idle',
      '2': 'stomp_walk',
      '3': 'seismic_smash',
      '4': 'mutagen_brace',
      '5': 'take_hit',
      '6': 'turn_around',
    };
    const cameraKeyMap: Record<
      string,
      'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge'
    > = {
      '1': 'melee_normal',
      '2': 'melee_crit',
      '3': 'ranged_single',
      '4': 'ranged_aoe',
      '5': 'kira_dodge',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (cameraLabOpen) {
        const trig = cameraKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireCameraTrigger(trig);
        }
        return;
      }
      if (bruteLabOpen) {
        const trig = bruteKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireBruteTrigger(trig);
        }
        return;
      }
      if (spitterLabOpen) {
        const trig = spitterKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireSpitterTrigger(trig);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [spitterLabOpen, bruteLabOpen, cameraLabOpen]);

  // Mount Canvas & Asset Loading once
  useEffect(() => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const webglCanvas = webglCanvasRef.current;
    const container = containerRef.current;
    if (!sim || !canvas || !container) return;

    if (webglCanvas && !webglRendererRef.current) {
      webglRendererRef.current = new WebGL2CharacterStageRenderer(webglCanvas);
    }

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
      applyCombatCues(activeSim, currentCombat, currentHeroine, {
        presentationConfig: presentationConfigRef.current,
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
        });
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
        const heroCutIn = activeSim.actionSequencer.getActorJuice('hero');
        const isKiraDodging = charId === 'kira' && heroSample.state.mode === 'dodge';
        const effectiveHeroXProgress = isKiraDodging
          ? heroSample.xProgress
          : heroCutIn.isMeleeClash || (heroCutIn.active && heroCutIn.role === 'target')
            ? 0
            : heroCutIn.active && charId === 'aurelia'
              ? Math.max(-0.06, Math.min(0.06, heroSample.xProgress))
              : heroSample.xProgress;
        const { groundY, baseScale, heroX, heroY, heroDrawScale } = getStageLayoutMetrics(
          activeSim.size.w,
          activeSim.size.h,
          effectiveSlotCount,
          activeSim.dashTargetX,
          effectiveHeroXProgress,
          heroSample.yHopPx,
          heroFrame.rowScale,
          canonicalHeight,
        );
        const heroLiveX = isKiraDodging
          ? Math.max(activeSim.size.w * 0.08, heroX + (heroCutIn.active ? heroCutIn.clashSlideX : 0))
          : heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0);

        const zuriDrones =
          charId === 'zuri'
            ? sampleZuriDroneFormation({
                animState: heroSample.state,
                heroineX: heroLiveX,
                heroineDrawBottomY: heroY,
                groundY,
                targetX: activeSim.pendingShotTargetX,
                targetMidY: activeSim.pendingShotTargetY,
                scale: baseScale,
                totalTime: elapsed,
                hoveredColor: hoveredColorRef.current,
              })
            : null;

        if (heroSample.isDashing && (!heroCutIn.isMeleeClash || isKiraDodging)) {
          const needsInitialDodgeGhost =
            isKiraDodging && !activeSim.ghosts.some((g) => g.isDodge);
          activeSim.ghostSampleTimer += simDt;
          const ghostInterval = isKiraDodging ? 0.036 : 0.028;
          if (needsInitialDodgeGhost || activeSim.ghostSampleTimer >= ghostInterval) {
            activeSim.ghostSampleTimer = 0;
            activeSim.ghosts.push({
              x: heroLiveX,
              y: heroY,
              frameIndex: heroSample.frameIndex,
              drawScale: heroDrawScale,
              alpha: isKiraDodging ? 0.78 : 0.42,
              isDodge: isKiraDodging,
            });
            const maxGhosts = isKiraDodging ? 9 : 6;
            if (activeSim.ghosts.length > maxGhosts) activeSim.ghosts.shift();
          }
          if (
            activeSim.heroTrailCooldown <= 0 &&
            (currentHeroine.corrode > 0 || currentHeroine.hp <= currentHeroine.maxHp * 0.5)
          ) {
            activeSim.heroTrailCooldown = 0.055;
            addOrGrowFloorBlood(
              activeSim,
              heroLiveX + (Math.random() - 0.5) * 10,
              groundY + (Math.random() - 0.5) * 6,
              2.2,
              0,
              {
                owner: currentHeroine.corrode > 0 ? 'hero_corrode' : 'hero_blood',
                shapeKind: 'trail_drop',
              },
            );
          }
        } else {
          activeSim.ghostSampleTimer = 0;
        }

        // Avoid double-emitting projectiles/kick bursts when Action Camera Lab owns spawning (pendingImpacts empty)
        const isLabOwnedCutIn =
          activeSim.actionSequencer.isActive() && activeSim.pendingImpacts.length === 0;

        if (!isLabOwnedCutIn && heroSample.shouldEmitShot && (heroFrame.muzzleRel || zuriDrones)) {
          const mx = zuriDrones
            ? zuriDrones.strike.muzzleX
            : heroLiveX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
          const my = zuriDrones
            ? zuriDrones.strike.muzzleY
            : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
          const isOverdrive = heroSample.state.mode === 'overdrive';
          const triggerKey = heroSample.state.emittedShots === 1 ? 'shot1' : 'shot2';
          const baseImpact = drainTriggerImpacts(activeSim, triggerKey);
          const onImpact =
            triggerKey === 'shot1'
              ? () => {
                  activeSim.actionSequencer.triggerImpactNow();
                  if (baseImpact) baseImpact();
                }
              : baseImpact;
          const profile: ProjectileVisualProfile =
            charId === 'zuri'
              ? 'drone_plasma'
              : charId === 'aurelia'
                ? 'scattergun'
                : 'pistol_bolt';
          spawnStyledProjectileVolley(activeSim, {
            profile,
            sx: mx,
            sy: my,
            tx: activeSim.pendingShotTargetX,
            ty: activeSim.pendingShotTargetY,
            isOverdrive,
            onPrimaryImpact: onImpact,
          });
          if (charId === 'zuri' && zuriDrones && isOverdrive) {
            // Shield Walker Drone also fires an Aegis pulse stream during Overdrive
            spawnStyledProjectileVolley(activeSim, {
              profile: 'pistol_bolt',
              sx: zuriDrones.shield.muzzleX,
              sy: zuriDrones.shield.muzzleY,
              tx: activeSim.pendingShotTargetX,
              ty: activeSim.pendingShotTargetY,
              isOverdrive: true,
            });
          }
          spawnBurst(
            activeSim,
            mx,
            my,
            charId === 'zuri' ? 9 : charId === 'aurelia' ? 8 : 6,
            charId === 'kira' ? '#FDE047' : '#FFC700',
            0,
            charId === 'kira' ? 0.75 : 0.92,
            0,
            0.28,
            0.28,
            2,
            3.8,
          );
          if (charId !== 'zuri') {
            spawnBurst(
              activeSim,
              heroLiveX + 26 * heroDrawScale,
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

        if (!isLabOwnedCutIn && heroSample.shouldEmitKickImpact && (heroFrame.kickTipRel || zuriDrones)) {
          // When Zuri commands a dive-bomb strike, the impact happens at the Strike Drone's target position
          const kx = zuriDrones
            ? zuriDrones.strike.muzzleX
            : heroLiveX + (heroFrame.kickTipRel?.dx ?? 150) * heroDrawScale;
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
          activeSim.actionSequencer.triggerImpactNow();
          const kickCb = drainTriggerImpacts(activeSim, 'kick');
          if (kickCb) kickCb();
        }
      }

      activeSim.lastFrameDt = isPaused ? 0 : simDt;
      const fgCtx = fgCanvasRef.current?.getContext('2d') ?? null;
      const activeMode = rendererModeRef.current;
      if (activeMode === 'canvas2d') {
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
        {
          rendererMode: activeMode,
          webglRenderer: webglRendererRef.current,
          fgCtx,
          debugMeshWireframe: debugMeshWireframeRef.current,
          spitterJuiceConfig: spitterJuiceConfigRef.current,
          spitterLabActive: spitterLabOpenRef.current,
          bruteJuiceConfig: bruteJuiceConfigRef.current,
          bruteLabActive: bruteLabOpenRef.current,
          presentationConfig: presentationConfigRef.current,
          sequencerFrame: activeSim.lastSeqFrame ?? undefined,
          getActorJuice: (id) => activeSim.actionSequencer.getActorJuice(id),
          reducedMotion: reducedMotionRef.current,
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
      const cachedStalker = getPreloadedStalkerFrames();
      if (cachedStalker && !activeSim.stalkerFrames) {
        activeSim.stalkerFrames = cachedStalker;
        addedNewCutout = true;
      }
      const cachedSpitter = getPreloadedSpitterFrames();
      if (cachedSpitter && !activeSim.spitterFrames) {
        activeSim.spitterFrames = cachedSpitter;
        addedNewCutout = true;
      }
      const cachedBrute = getPreloadedBruteFrames();
      if (cachedBrute && !activeSim.bruteFrames) {
        activeSim.bruteFrames = cachedBrute;
        addedNewCutout = true;
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
      if (webglRendererRef.current) {
        webglRendererRef.current.dispose();
        webglRendererRef.current = null;
      }
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
  const hasUltraDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 5;
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
        data-renderer-mode={rendererMode}
        data-mesh-debug={debugMeshWireframe ? 'true' : 'false'}
        data-spitter-lab={spitterLabOpen ? 'true' : 'false'}
        data-spitter-trigger={lastSpitterTrigger}
        data-brute-lab={bruteLabOpen ? 'true' : 'false'}
        data-brute-trigger={lastBruteTrigger}
        data-camera-lab={cameraLabOpen ? 'true' : 'false'}
        data-camera-trigger={lastCameraTrigger}
        onContextMenu={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sim = simRef.current;
          const zoom = sim?.cameraZoom || 1;
          const panX = sim?.cameraPanX || 0;
          const panY = sim?.cameraPanY || 0;
          const rot = sim?.cameraRotRad || 0;
          const halfW = rect.width * 0.5;
          const halfH = rect.height * 0.5;
          const dx = e.clientX - rect.left - halfW - panX;
          const dy = e.clientY - rect.top - halfH - panY;
          const cosR = Math.cos(-rot);
          const sinR = Math.sin(-rot);
          const worldX = (dx * cosR - dy * sinR) / zoom + halfW;
          const worldY = (dx * sinR + dy * cosR) / zoom + halfH;
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
          const rot = sim?.cameraRotRad || 0;
          const halfW = rect.width * 0.5;
          const halfH = rect.height * 0.5;
          const dx = e.clientX - rect.left - halfW - panX;
          const dy = e.clientY - rect.top - halfH - panY;
          const cosR = Math.cos(-rot);
          const sinR = Math.sin(-rot);
          const worldX = (dx * cosR - dy * sinR) / zoom + halfW;
          const worldY = (dx * sinR + dy * cosR) / zoom + halfH;
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
      <canvas
        ref={webglCanvasRef}
        data-testid="combat-webgl-canvas"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[1] h-full w-full transition-opacity duration-200 ${
          stageReady && rendererMode === 'webgl2' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <canvas
        ref={fgCanvasRef}
        data-testid="combat-fg-canvas"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[2] h-full w-full transition-opacity duration-200 ${
          stageReady && rendererMode === 'webgl2' ? 'opacity-100' : 'opacity-0'
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
        className={`pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-[1680px] flex-wrap md:flex-nowrap items-start justify-between gap-1.5 px-2 sm:px-4 ${
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
              ? 'w-[132px] sm:w-[164px] px-2 py-1'
              : 'w-[138px] sm:w-56 px-2 py-1 sm:px-2.5 sm:py-1.5'
          } ${
            kiraThreat.willDie
              ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)]'
              : kiraThreat.hpDamageTaken > 0
                ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)]'
                : 'chrome-pill border-cyan-200/35'
          }`}
        >
          <div className="flex items-center justify-between gap-1 text-[11.5px] sm:text-[13px]">
            <span className="flex items-center gap-1 chrome-text-shimmer font-display font-bold tracking-wider whitespace-nowrap">
              <span
                aria-hidden="true"
                className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#00F0FF] text-[10px] font-black text-slate-950"
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

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[11px] sm:text-[12px] font-mono-tabular">
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
              {(heroine.corrode > 0 || (kiraThreat.corrodeGained ?? 0) > 0) && (
                <span
                  data-testid="heroine-corrode-badge"
                  className="font-bold text-lime-300 whitespace-nowrap"
                >
                  ☣ {t.corrodeLabel}{' '}
                  {(kiraThreat.corrodeGained ?? 0) > 0
                    ? `${heroine.corrode}→${heroine.corrode + (kiraThreat.corrodeGained ?? 0)}`
                    : heroine.corrode}
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
              className={`aaa-charcoal-surface flex max-w-full flex-col gap-1 rounded-lg border bg-[#181A20]/90 px-2.5 py-1 text-[12px] font-mono-tabular ${
                director.heatStage === 'overtime'
                  ? 'border-[#FF2E7E]/85'
                  : director.heatStage === 'medium'
                    ? 'border-[#FFC700]/75'
                    : 'border-white/20'
              }`}
            >
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1">
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

                <div
                  className={`${hasUltraDenseEnemyRow ? 'hidden xl:flex' : 'flex'} items-center gap-1.5`}
                  data-testid="combat-par-caches"
                >
                  {director.parCaches.map((cache) => (
                    <span
                      key={`par_${cache.tier}`}
                      data-intact={cache.intact ? 'true' : 'false'}
                      className={`text-[12px] font-bold leading-none whitespace-nowrap ${
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

                {/* Live WebGL2 / Canvas2D Renderer Adapter Switch + 4x6 Mesh Debug Wireframe Toggle */}
                <div className="hidden sm:flex items-center gap-1 border-l border-white/15 pl-1.5">
                  <button
                    type="button"
                    data-testid="renderer-mode-toggle"
                    onClick={() =>
                      setRendererMode((prev) => (prev === 'webgl2' ? 'canvas2d' : 'webgl2'))
                    }
                    title={
                      rendererMode === 'webgl2'
                        ? 'Active: Raw WebGL2 Deformable MeshSprite + Unified GLSL 300 es Shader (Click to switch to Canvas2D fallback)'
                        : 'Active: Legacy Canvas2D Flat Quad Renderer (Click to switch to WebGL2 MeshSprite)'
                    }
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase transition-colors cursor-pointer ${
                      rendererMode === 'webgl2'
                        ? 'bg-[#00F0FF]/20 text-[#00F0FF] ring-1 ring-[#00F0FF]/50 hover:bg-[#00F0FF]/30'
                        : 'bg-slate-800 text-slate-300 ring-1 ring-white/20 hover:bg-slate-700'
                    }`}
                  >
                    {rendererMode === 'webgl2' ? 'GL2 MESH' : '2D QUAD'}
                  </button>
                  {rendererMode === 'webgl2' && (
                    <button
                      type="button"
                      data-testid="mesh-debug-toggle"
                      aria-pressed={debugMeshWireframe}
                      onClick={() => setDebugMeshWireframe((prev) => !prev)}
                      title="Toggle 4×6 subdivided mesh wireframe & 4 anatomical control points (Feet, Pelvis, Waist, Head)"
                      className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase transition-colors cursor-pointer ${
                        debugMeshWireframe
                          ? 'bg-[#FFC700] text-slate-950 ring-1 ring-[#FFC700]'
                          : 'bg-slate-900/90 text-cyan-200/80 ring-1 ring-cyan-300/30 hover:text-white'
                      }`}
                    >
                      4×6 WIRE
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="spitter-lab-toggle"
                    aria-pressed={spitterLabOpen}
                    onClick={() => {
                      setSpitterLabOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setBruteLabOpen(false);
                          setCameraLabOpen(false);
                        }
                        return next;
                      });
                    }}
                    title="Open Bile Spitter 4-Layer Procedural Juice Lab & Keys 1–6 Test Harness"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
                      spitterLabOpen
                        ? 'bg-lime-400 text-slate-950 ring-1 ring-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.5)]'
                        : 'bg-slate-900/90 text-lime-300/90 ring-1 ring-lime-400/35 hover:text-white'
                    }`}
                  >
                    ⬡ SPITTER
                  </button>
                  <button
                    type="button"
                    data-testid="brute-lab-toggle"
                    aria-pressed={bruteLabOpen}
                    onClick={() => {
                      setBruteLabOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setSpitterLabOpen(false);
                          setCameraLabOpen(false);
                        }
                        return next;
                      });
                    }}
                    title="Open Carapace Brute 4-Layer Procedural Juice Lab & Keys 1–6 Test Harness"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
                      bruteLabOpen
                        ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                        : 'bg-slate-900/90 text-amber-300/90 ring-1 ring-amber-400/35 hover:text-white'
                    }`}
                  >
                    ■ BRUTE
                  </button>
                  <button
                    type="button"
                    data-testid="camera-lab-toggle"
                    aria-pressed={cameraLabOpen}
                    onClick={() => {
                      setCameraLabOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setSpitterLabOpen(false);
                          setBruteLabOpen(false);
                        }
                        return next;
                      });
                    }}
                    title="Open Action Camera & Cut-In Lab (Keys 1–3 Test Triggers)"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
                      cameraLabOpen
                        ? 'bg-cyan-300 text-slate-950 ring-1 ring-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                        : 'bg-slate-900/90 text-cyan-200/90 ring-1 ring-cyan-400/35 hover:text-white'
                    }`}
                  >
                    ◎ CAMERA
                  </button>
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
            const intentOptions = {
              staggered: enemy.staggered,
              conditionActive,
              weaponBroken: enemy.weaponBroken,
              desperationEnraged: enemy.desperationEnraged,
              sleepCounter: enemy.sleepCounter,
              isLootRunner: enemy.isLootRunner,
              escapeTurnsLeft: enemy.escapeTurnsLeft,
              propKind: enemy.propKind,
              reviveTimer: enemy.reviveTimer,
            };
            const reactiveBark = getEnemyReactiveBark(
              enemy,
              activePreview,
              armorPreview,
              kiraThreat.shieldAfterPlayer,
              lang,
            );
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
                className={`relative pointer-events-auto text-left rounded-lg transition-all duration-200 cursor-pointer ${!isDead ? hcBorderClass : ''} ${
                  isCompactLandscape
                    ? hasUltraDenseEnemyRow
                      ? 'w-[96px] sm:w-[116px] lg:w-[132px] xl:w-[148px] px-1 py-0.5'
                      : hasDenseEnemyRow
                        ? 'w-[114px] sm:w-[144px] lg:w-48 px-1.5 py-1'
                        : 'w-[130px] sm:w-[162px] lg:w-52 px-2 py-1'
                    : hasUltraDenseEnemyRow
                      ? 'w-[96px] sm:w-[118px] lg:w-[136px] xl:w-[152px] px-1.5 py-1'
                      : hasDenseEnemyRow
                        ? 'w-[112px] sm:w-44 lg:w-52 px-1.5 py-1 sm:px-2 sm:py-1.5'
                        : getEnemySlotSpan(enemy.archetype) > 1
                          ? 'w-[168px] sm:w-52 lg:w-60 px-2 py-1 sm:px-2.5 sm:py-1.5'
                          : 'w-[126px] sm:w-48 lg:w-56 px-2 py-1 sm:px-2.5 sm:py-1.5'
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
                <div className="flex items-center justify-between gap-1 text-[11.5px] sm:text-[13px]">
                  <span className="flex items-center gap-1 font-display font-bold text-white truncate">
                    <span
                      data-testid={`enemy-role-pip-${enemy.id}`}
                      style={{ backgroundColor: rolePip.accentHex, color: '#020617' }}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[10px] font-black leading-none"
                    >
                      {rolePip.symbol}
                    </span>
                    <span className="truncate">{enemyMeta.name}</span>
                    {getEnemySlotSpan(enemy.archetype) > 1 && (
                      <span
                        data-testid={`enemy-two-slot-${enemy.id}`}
                        className="shrink-0 rounded bg-amber-400/20 px-1 text-[10px] font-mono-tabular font-extrabold text-amber-200 ring-1 ring-amber-400/40"
                      >
                        {getEnemySlotSpan(enemy.archetype)}×
                      </span>
                    )}
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
                        className="ml-0.5 rounded bg-slate-950/90 px-1 text-[10px] font-extrabold text-[#FFC700]"
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
                    <div className="flex items-center gap-0.5 shrink-0 font-mono-tabular text-[12px] font-extrabold leading-none">
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
                <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] sm:text-[12px] font-mono-tabular">
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
                          className="rounded bg-cyan-500/25 px-1 text-[10px] font-extrabold text-cyan-200"
                        >
                          {t.staggeredTag}
                        </span>
                      ) : enemy.weaponBroken ? (
                        <span
                          data-testid={`enemy-weapon-broken-${enemy.id}`}
                          className="rounded bg-cyan-500/25 px-1 text-[10px] font-extrabold text-cyan-200"
                        >
                          🔨 -3
                        </span>
                      ) : enemy.desperationEnraged ? (
                        <span
                          data-testid={`enemy-desperation-${enemy.id}`}
                          className="rounded bg-rose-500/35 px-1 text-[10px] font-extrabold text-rose-100"
                        >
                          🔥 +3
                        </span>
                      ) : enemy.isMercyTarget ? (
                        <span
                          data-testid={`enemy-mercy-${enemy.id}`}
                          className="rounded bg-emerald-500/30 px-1 text-[10px] font-extrabold text-emerald-200"
                        >
                          🕊 MERCY
                        </span>
                      ) : enemy.enragedAlone ? (
                        <span
                          data-testid={`enemy-enraged-alone-${enemy.id}`}
                          className="rounded bg-rose-500/35 px-1 text-[10px] font-extrabold text-rose-100"
                        >
                          {t.enragedAloneTag}
                        </span>
                      ) : enemy.sosCharging ? (
                        <span className="rounded bg-amber-400/25 px-1 text-[10px] font-extrabold text-amber-200">
                          {t.sosFlareBadgeLabel}
                        </span>
                      ) : enrageBonus > 0 ? (
                        <span className="rounded bg-rose-500/25 px-1 text-[10px] font-extrabold text-rose-200">
                          +{enrageBonus}
                        </span>
                      ) : enemy.isZeroReward ? (
                        <span className="rounded bg-slate-700/70 px-1 text-[10px] font-bold text-slate-300">
                          {t.zeroRewardBadgeLabel}
                        </span>
                      ) : null
                    )}
                    {hasShieldPips && (
                      <span className="shrink-0 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-sky-300">
                        {willCrackShieldPip ? `${enemy.shieldPips}→${remainingShieldPips}` : enemy.shieldPips}
                      </span>
                    )}
                  </div>
                </div>

                {rawPreviewDmg > 0 && !isDead && (
                  <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[11px] sm:text-[12px] font-bold">
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
                        <span className="rounded bg-[#FF2E7E] px-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          ☠ {t.lethalLabel}
                        </span>
                      ) : willStagger ? (
                        <span
                          data-testid={`enemy-will-stagger-${enemy.id}`}
                          className="rounded bg-cyan-500/30 px-1 text-[10px] font-extrabold uppercase text-cyan-200 animate-pulse"
                        >
                          {t.staggerPreviewLabel}
                        </span>
                      ) : willTriggerPhaseGate ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold uppercase text-lime-300">
                          {t.phaseGateLabel}
                        </span>
                      ) : willBreakArmor ? (
                        <span className="text-[#FFC700] uppercase">{t.armorBreakLabel}</span>
                      ) : chainedBurstDmg > 0 ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold uppercase text-lime-300">
                          💥-{chainedBurstDmg}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {reactiveBark && !isDead && !willDie && (
                  <div
                    data-testid={`enemy-reactive-bark-${enemy.id}`}
                    className="mt-0.5 truncate rounded bg-amber-500/20 px-1 py-0.5 text-center font-mono-tabular text-[10px] font-extrabold text-[#FFC700]"
                  >
                    {reactiveBark}
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
                    ? 'w-[116px] sm:w-[144px] px-1.5 py-1'
                    : 'w-[114px] sm:w-44 lg:w-48 px-1.5 py-1 sm:px-2 sm:py-1.5'
                } ${
                  isUrgent
                    ? 'border-[#FFC700]/85 shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                    : 'border-cyan-300/75 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                } ${inspectedTarget === dropInspectKey ? 'ring-1 ring-[#00F0FF]' : ''}`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] sm:text-[12px]">
                  <span className="font-display font-bold text-cyan-100 truncate">
                    {dropName}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 font-mono-tabular text-[11px] font-extrabold ${
                      isUrgent
                        ? 'bg-[#FFC700] text-slate-950'
                        : 'bg-[#00F0FF]/20 text-[#00F0FF]'
                    }`}
                  >
                    T-{drop.turnsUntilDrop}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[10px] sm:text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-amber-200 truncate">
                    {formatDropReasonLabel(drop.reason, t)}
                  </span>
                  {drop.isZeroReward && (
                    <span className="shrink-0 text-slate-400">{t.zeroRewardBadgeLabel}</span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono-tabular text-[10px] text-cyan-200/90">
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
                <span className="rounded bg-[#FFC700] px-1.5 py-0.5 font-mono-tabular text-[12px] font-extrabold text-slate-950">
                  T-{inspectedDrop.turnsUntilDrop}
                </span>
                <span className="font-display text-sm font-bold text-white">
                  {diff.revealDropArchetype ? t.enemies[inspectedDrop.archetype].name : '???'}
                </span>
                <span className="font-mono-tabular text-[12px] font-bold uppercase text-cyan-300">
                  {formatDropReasonLabel(inspectedDrop.reason, t)}
                </span>
              </div>
              <p className="text-[13px] text-slate-200">
                {diff.revealDropArchetype
                  ? t.enemies[inspectedDrop.archetype].bioNote
                  : lang === 'cs'
                    ? 'Archetyp výsadku je na této obtížnosti utajen do dopadu.'
                    : 'Drop archetype is encrypted on this difficulty tier until touchdown.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-[12px]">
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
              className="chrome-pill shrink-0 rounded px-2.5 py-1 text-[12px] font-bold text-white cursor-pointer"
            >
              {t.closeLabel}
            </button>
          </div>
        </div>
      )}

      {spitterLabOpen && (
        <div
          role="region"
          data-testid="spitter-juice-lab-panel"
          aria-label="Bile Spitter 4-Layer Procedural Juice Lab"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-lime-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-lime-400 text-[9px] font-black text-slate-950">
                ⬡
              </span>
              <span className="font-display text-[11px] font-extrabold tracking-wider text-lime-300 uppercase">
                Bile Spitter Juice Lab
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="brute-lab-tab"
                onClick={() => {
                  setSpitterLabOpen(false);
                  setCameraLabOpen(false);
                  setBruteLabOpen(true);
                }}
                className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white cursor-pointer"
              >
                ■ Brute
              </button>
              <button
                type="button"
                data-testid="camera-lab-tab"
                onClick={() => {
                  setSpitterLabOpen(false);
                  setBruteLabOpen(false);
                  setCameraLabOpen(true);
                }}
                className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white cursor-pointer"
              >
                ◎ Cam
              </button>
              <button
                type="button"
                data-testid="spitter-lab-reset-btn"
                onClick={() => setSpitterJuiceConfig(DEFAULT_SPITTER_JUICE_CONFIG)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                data-testid="spitter-lab-close-btn"
                onClick={() => setSpitterLabOpen(false)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Keys 1–6 Turn-Based Combat State Triggers */}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(
              [
                { key: '1', id: 'idle', label: '1 · Idle + Blink' },
                { key: '2', id: 'advance_retreat', label: '2 · Walk Waddle' },
                { key: '3', id: 'attack_lunge', label: '3 · Attack Lunge' },
                { key: '4', id: 'cast_charge', label: '4 · Cast / UV Boil' },
                { key: '5', id: 'take_hit', label: '5 · Take Hit' },
                { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
              ] as const
            ).map((btn) => {
              const active = lastSpitterTrigger === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`spitter-trigger-${btn.key}`}
                  onClick={() => fireSpitterTrigger(btn.id)}
                  className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold transition-colors cursor-pointer ${
                    active
                      ? 'bg-lime-400 text-slate-950 ring-1 ring-lime-200'
                      : 'bg-slate-900/90 text-lime-200 ring-1 ring-white/15 hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Tunable Spring & Shader Inspector Sliders */}
          <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Spring Stiffness (k)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={80}
                  max={480}
                  step={10}
                  value={spitterJuiceConfig.springStiffness}
                  onChange={(e) =>
                    setSpitterJuiceConfig((c) => ({
                      ...c,
                      springStiffness: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-lime-400"
                />
                <span className="w-8 text-right font-bold text-lime-300">
                  {spitterJuiceConfig.springStiffness}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Spring Damping (c)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={6}
                  max={36}
                  step={1}
                  value={spitterJuiceConfig.springDamping}
                  onChange={(e) =>
                    setSpitterJuiceConfig((c) => ({
                      ...c,
                      springDamping: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-lime-400"
                />
                <span className="w-8 text-right font-bold text-lime-300">
                  {spitterJuiceConfig.springDamping}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Waddle Speed (rad/s)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={6}
                  max={28}
                  step={1}
                  value={spitterJuiceConfig.waddleSpeed}
                  onChange={(e) =>
                    setSpitterJuiceConfig((c) => ({
                      ...c,
                      waddleSpeed: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-lime-400"
                />
                <span className="w-8 text-right font-bold text-lime-300">
                  {spitterJuiceConfig.waddleSpeed}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Velocity Skew Factor</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={0.12}
                  step={0.004}
                  value={spitterJuiceConfig.velocitySkewFactor}
                  onChange={(e) =>
                    setSpitterJuiceConfig((c) => ({
                      ...c,
                      velocitySkewFactor: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-lime-400"
                />
                <span className="w-8 text-right font-bold text-lime-300">
                  {spitterJuiceConfig.velocitySkewFactor.toFixed(3)}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">UV Acid Distortion</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.1}
                  value={spitterJuiceConfig.uvDistortStrength}
                  onChange={(e) =>
                    setSpitterJuiceConfig((c) => ({
                      ...c,
                      uvDistortStrength: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-lime-400"
                />
                <span className="w-8 text-right font-bold text-lime-300">
                  {spitterJuiceConfig.uvDistortStrength.toFixed(1)}×
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {bruteLabOpen && (
        <div
          role="region"
          data-testid="brute-juice-lab-panel"
          aria-label="Carapace Brute 4-Layer Procedural Juice Lab"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-amber-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-400 text-[9px] font-black text-slate-950">
                ■
              </span>
              <span className="font-display text-[11px] font-extrabold tracking-wider text-amber-300 uppercase">
                Carapace Brute Juice Lab
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="spitter-lab-tab"
                onClick={() => {
                  setBruteLabOpen(false);
                  setCameraLabOpen(false);
                  setSpitterLabOpen(true);
                }}
                className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white cursor-pointer"
              >
                ⬡ Spitter
              </button>
              <button
                type="button"
                data-testid="camera-lab-tab-from-brute"
                onClick={() => {
                  setBruteLabOpen(false);
                  setSpitterLabOpen(false);
                  setCameraLabOpen(true);
                }}
                className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white cursor-pointer"
              >
                ◎ Cam
              </button>
              <button
                type="button"
                data-testid="brute-lab-reset-btn"
                onClick={() => setBruteJuiceConfig(DEFAULT_BRUTE_JUICE_CONFIG)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                data-testid="brute-lab-close-btn"
                onClick={() => setBruteLabOpen(false)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Keys 1–6 Turn-Based Combat State Triggers */}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(
              [
                { key: '1', id: 'idle', label: '1 · Idle + Snarl' },
                { key: '2', id: 'stomp_walk', label: '2 · Stomp Walk' },
                { key: '3', id: 'seismic_smash', label: '3 · Seismic Smash' },
                { key: '4', id: 'mutagen_brace', label: '4 · Mutagen Brace' },
                { key: '5', id: 'take_hit', label: '5 · Take Hit' },
                { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
              ] as const
            ).map((btn) => {
              const active = lastBruteTrigger === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`brute-trigger-${btn.key}`}
                  onClick={() => fireBruteTrigger(btn.id)}
                  className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-200'
                      : 'bg-slate-900/90 text-amber-200 ring-1 ring-white/15 hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Tunable Heavyweight Spring & Seismic VFX Sliders */}
          <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Spring Stiffness (k)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={100}
                  max={480}
                  step={10}
                  value={bruteJuiceConfig.springStiffness}
                  onChange={(e) =>
                    setBruteJuiceConfig((c) => ({
                      ...c,
                      springStiffness: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-amber-400"
                />
                <span className="w-8 text-right font-bold text-amber-300">
                  {bruteJuiceConfig.springStiffness}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Spring Damping (c)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={8}
                  max={36}
                  step={1}
                  value={bruteJuiceConfig.springDamping}
                  onChange={(e) =>
                    setBruteJuiceConfig((c) => ({
                      ...c,
                      springDamping: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-amber-400"
                />
                <span className="w-8 text-right font-bold text-amber-300">
                  {bruteJuiceConfig.springDamping}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Stomp Cadence (rad/s)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={5}
                  max={22}
                  step={0.5}
                  value={bruteJuiceConfig.stompSpeed}
                  onChange={(e) =>
                    setBruteJuiceConfig((c) => ({
                      ...c,
                      stompSpeed: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-amber-400"
                />
                <span className="w-8 text-right font-bold text-amber-300">
                  {bruteJuiceConfig.stompSpeed.toFixed(1)}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Velocity Skew Factor</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={0.1}
                  step={0.004}
                  value={bruteJuiceConfig.velocitySkewFactor}
                  onChange={(e) =>
                    setBruteJuiceConfig((c) => ({
                      ...c,
                      velocitySkewFactor: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-amber-400"
                />
                <span className="w-8 text-right font-bold text-amber-300">
                  {bruteJuiceConfig.velocitySkewFactor.toFixed(3)}
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Seismic VFX Impact</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.1}
                  value={bruteJuiceConfig.seismicImpactStrength}
                  onChange={(e) =>
                    setBruteJuiceConfig((c) => ({
                      ...c,
                      seismicImpactStrength: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-amber-400"
                />
                <span className="w-8 text-right font-bold text-amber-300">
                  {bruteJuiceConfig.seismicImpactStrength.toFixed(1)}×
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {cameraLabOpen && (
        <div
          role="region"
          data-testid="camera-lab-panel"
          aria-label="Combat Action Camera & Cut-In Lab"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-cyan-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-cyan-300 text-[9px] font-black text-slate-950">
                ◎
              </span>
              <span className="font-display text-[11px] font-extrabold tracking-wider text-cyan-200 uppercase">
                Action Camera Lab
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="spitter-lab-tab-from-cam"
                onClick={() => {
                  setCameraLabOpen(false);
                  setBruteLabOpen(false);
                  setSpitterLabOpen(true);
                }}
                className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white cursor-pointer"
              >
                ⬡ Spitter
              </button>
              <button
                type="button"
                data-testid="brute-lab-tab-from-cam"
                onClick={() => {
                  setCameraLabOpen(false);
                  setSpitterLabOpen(false);
                  setBruteLabOpen(true);
                }}
                className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white cursor-pointer"
              >
                ■ Brute
              </button>
              <button
                type="button"
                data-testid="camera-lab-reset-btn"
                onClick={() => {
                  setPresentationConfig(DEFAULT_COMBAT_PRESENTATION_CONFIG);
                  simRef.current?.actionSequencer.reset();
                  setLastCameraTrigger('idle');
                }}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                data-testid="camera-lab-close-btn"
                onClick={() => setCameraLabOpen(false)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Keys 1–4 Melee / Ranged / AoE Cut-In Test Triggers */}
          <div className="mt-2 grid grid-cols-2 gap-1">
            {(
              [
                { key: '1', id: 'melee_normal', label: '1 · Melee Hit' },
                { key: '2', id: 'melee_crit', label: '2 · Melee Crit' },
                { key: '3', id: 'ranged_single', label: '3 · Ranged Shot' },
                { key: '4', id: 'ranged_aoe', label: '4 · Ranged AoE' },
                { key: '5', id: 'kira_dodge', label: '5 · Kira Dodge' },
              ] as const
            ).map((btn) => {
              const active = lastCameraTrigger === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`camera-trigger-${btn.key}`}
                  onClick={() => fireCameraTrigger(btn.id)}
                  className={`rounded px-2 py-1 text-left text-[9px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-300 text-slate-950 ring-1 ring-cyan-100'
                      : 'bg-slate-900/90 text-cyan-200 ring-1 ring-white/15 hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Timing, Framing, Shake, Knockback & Dimmer Sliders */}
          <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Wind-up (s)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0.08}
                  max={0.35}
                  step={0.01}
                  value={presentationConfig.windupSec}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, windupSec: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.windupSec.toFixed(2)}s
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hit-Stop Norm (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={40}
                  max={280}
                  step={10}
                  value={Math.round(presentationConfig.hitstopNormalSec * 1000)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hitstopNormalSec: Number(e.target.value) / 1000,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.hitstopNormalSec * 1000)}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hit-Stop Crit (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={100}
                  max={420}
                  step={10}
                  value={Math.round(presentationConfig.hitstopCritSec * 1000)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hitstopCritSec: Number(e.target.value) / 1000,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.hitstopCritSec * 1000)}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Zoom Norm / Crit</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={1.15}
                  max={1.85}
                  step={0.02}
                  value={presentationConfig.zoomCrit}
                  onChange={(e) => {
                    const crit = Number(e.target.value);
                    setPresentationConfig((c) => ({
                      ...c,
                      zoomCrit: crit,
                      zoomNormal: Math.max(1.1, Math.min(crit - 0.12, c.zoomNormal)),
                    }));
                  }}
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.zoomCrit.toFixed(2)}×
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hold Creep (%)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={Math.round(presentationConfig.holdZoomCreepPct * 100)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      holdZoomCreepPct: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  +{Math.round(presentationConfig.holdZoomCreepPct * 100)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Clash Gap (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={8}
                  max={22}
                  step={0.5}
                  value={Number((presentationConfig.meleeClashGapVw * 100).toFixed(1))}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      meleeClashGapVw: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.meleeClashGapVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Dutch Tilt Crit (°)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={presentationConfig.dutchDegCrit}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, dutchDegCrit: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.dutchDegCrit.toFixed(1)}°
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Shake Crit (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0.4}
                  max={3.5}
                  step={0.1}
                  value={Number((presentationConfig.shakeCritVw * 100).toFixed(1))}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      shakeCritVw: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.shakeCritVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Knockback (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={2}
                  max={9}
                  step={0.5}
                  value={Number((presentationConfig.knockbackNormalVw * 100).toFixed(1))}
                  onChange={(e) => {
                    const norm = Number(e.target.value) / 100;
                    setPresentationConfig((c) => ({
                      ...c,
                      knockbackNormalVw: norm,
                      knockbackCritVw: Math.min(0.11, norm * 1.35),
                    }));
                  }}
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.knockbackNormalVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">AoE Cascade (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={presentationConfig.aoeCascadeStepMs}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      aoeCascadeStepMs: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.aoeCascadeStepMs}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Stage Dimmer</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={presentationConfig.dimmerAlpha}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, dimmerAlpha: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.dimmerAlpha * 100)}%
                </span>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.adaptivePackSpeedup}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      adaptivePackSpeedup: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Adaptive Pack</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.critInvertFlashEnabled}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      critInvertFlashEnabled: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Crit Flash</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.hideWorldUiDuringCutIn}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hideWorldUiDuringCutIn: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Hide HUD</span>
              </label>
            </div>
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
