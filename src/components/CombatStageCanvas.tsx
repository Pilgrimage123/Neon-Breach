import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { getDifficultyProfile } from '../engine/difficulty';
import { previewHeroThreat } from '../engine/gameEngine';
import type {
  CharacterId,
  CombatState,
  DifficultyTier,
  EnemyArchetype,
  HeroState,
  TurnPreview,
} from '../engine/types';
import type { GlossaryTermId } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { DEFAULT_BRUTE_JUICE_CONFIG } from '../utils/bruteJuiceController';
import { DEFAULT_SPITTER_JUICE_CONFIG } from '../utils/spitterJuiceController';
import type { CodexTab } from './CodexModal';
import type { CombatDevLabsRuntimeState } from './combat/CombatDevLabsPanel';
import {
  computeEnemyHitBoxes,
  hitTestEnemySprite,
} from './combat/combatEnemyUi';
import { DEFAULT_COMBAT_PRESENTATION_CONFIG } from './combat/combatPresentationConfig';
import {
  CombatStageHudOverlay,
  computeSequentialEnemyHudState,
} from './combat/CombatStageHudOverlay';
import type { CombatStageSim } from './combat/combatStageTypes';
import { EnemyIntelPanel } from './combat/EnemyIntelPanel';
import {
  DEFAULT_RENDERER_CONFIG,
  type RendererMode,
} from './combat/stageSpriteAdapter';
import { useCombatStageRuntime } from './combat/useCombatStageRuntime';

const LazyCombatDevLabsPanel = import.meta.env.DEV
  ? lazy(() => import('./combat/CombatDevLabsPanel'))
  : null;

interface CombatStageCanvasProps {
  runId: string;
  combat: CombatState;
  hero: HeroState;
  lang: Language;
  activePreview: TurnPreview | null;
  paused: boolean;
  isCompactLandscape?: boolean;
  tacticalView?: boolean;
  autoFocusCamera?: boolean;
  highContrastBorders?: boolean;
  quantizedScaleMode?: boolean;
  hoveringSwap?: boolean;
  difficultyTier?: DifficultyTier;
  onUndoTurn?: () => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
  onCueSequenceComplete?: (batchKey: string) => void;
}

function clientToWorldCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  sim: CombatStageSim | null,
): { worldX: number; worldY: number } {
  const zoom = sim?.cameraZoom || 1;
  const panX = sim?.cameraPanX || 0;
  const panY = sim?.cameraPanY || 0;
  const rot = sim?.cameraRotRad || 0;
  const halfW = rect.width * 0.5;
  const halfH = rect.height * 0.5;
  const dx = clientX - rect.left - halfW - panX;
  const dy = clientY - rect.top - halfH - panY;
  const cosR = Math.cos(-rot);
  const sinR = Math.sin(-rot);
  return {
    worldX: (dx * cosR - dy * sinR) / zoom + halfW,
    worldY: (dx * sinR + dy * cosR) / zoom + halfH,
  };
}

export function CombatStageCanvas({
  runId,
  combat,
  hero,
  lang,
  activePreview,
  paused,
  isCompactLandscape = false,
  tacticalView = false,
  autoFocusCamera = false,
  highContrastBorders = false,
  quantizedScaleMode = false,
  hoveringSwap = false,
  difficultyTier = 3,
  onUndoTurn,
  onOpenCodex,
  onCueSequenceComplete,
}: CombatStageCanvasProps) {
  const diff = getDifficultyProfile(difficultyTier);
  const t = TRANSLATIONS[lang];

  const [rendererMode, setRendererMode] = useState<RendererMode>(
    DEFAULT_RENDERER_CONFIG.defaultMode,
  );
  const [debugMeshWireframe, setDebugMeshWireframe] = useState<boolean>(
    DEFAULT_RENDERER_CONFIG.defaultDebugWireframe,
  );
  const [inspectedTarget, setInspectedTarget] = useState<'hero' | string | null>(null);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [extraLabArchetypes, setExtraLabArchetypes] = useState<EnemyArchetype[]>([]);
  const [devToolbarMountNode, setDevToolbarMountNode] = useState<HTMLElement | null>(null);

  const labRuntimeRef = useRef<CombatDevLabsRuntimeState>({
    spitterLabActive: false,
    spitterJuiceConfig: DEFAULT_SPITTER_JUICE_CONFIG,
    bruteLabActive: false,
    bruteJuiceConfig: DEFAULT_BRUTE_JUICE_CONFIG,
    cameraLabActive: false,
    presentationConfig: DEFAULT_COMBAT_PRESENTATION_CONFIG,
  });

  const charId: CharacterId = hero.characterId ?? 'kira';
  const activeArchetypeKey = combat.enemies.map((e) => e.archetype).join(',');
  const activeArchetypes = useMemo(() => {
    const list = activeArchetypeKey
      ? (activeArchetypeKey.split(',') as EnemyArchetype[])
      : ([] as EnemyArchetype[]);
    for (const extra of extraLabArchetypes) {
      if (!list.includes(extra)) {
        list.push(extra);
      }
    }
    return list;
  }, [activeArchetypeKey, extraLabArchetypes]);

  const heroThreat = useMemo(
    () => previewHeroThreat(combat, hero, activePreview),
    [combat, hero, activePreview],
  );

  const dropIntelHorizon = useMemo(
    () => ({
      revealArchetype: diff.revealDropArchetype,
      revealSlot: diff.revealDropSlot,
    }),
    [diff.revealDropArchetype, diff.revealDropSlot],
  );

  const {
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
  } = useCombatStageRuntime({
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
  });

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

  const frontLivingIdx = combat.enemies.findIndex((e) => e.hp > 0);
  const livingEnemies = useMemo(
    () => combat.enemies.filter((e) => e.hp > 0),
    [combat.enemies],
  );

  const sequentialHudStates = useMemo(
    () => computeSequentialEnemyHudState(combat, activePreview, heroThreat, frontLivingIdx),
    [combat, activePreview, heroThreat, frontLivingIdx],
  );

  const inspectedEnemy =
    inspectedTarget && inspectedTarget !== 'hero' && !inspectedTarget.startsWith('drop:')
      ? combat.enemies.find((e) => e.id === inspectedTarget && e.hp > 0) ?? null
      : null;
  const inspectedEnemyIdx = inspectedEnemy
    ? combat.enemies.findIndex((e) => e.id === inspectedEnemy.id)
    : -1;
  const inspectedHudState =
    inspectedEnemyIdx >= 0 ? sequentialHudStates[inspectedEnemyIdx] : null;

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
      simRef,
    ],
  );

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
        data-spitter-lab="false"
        data-spitter-trigger="idle"
        data-brute-lab="false"
        data-brute-trigger="idle"
        data-camera-lab="false"
        data-camera-trigger="idle"
        onContextMenu={(e) => {
          const targetEl = e.target as HTMLElement | null;
          if (targetEl?.closest('button, a, input, select, textarea, [role="button"]')) {
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          const { worldX, worldY } = clientToWorldCoords(
            e.clientX,
            e.clientY,
            rect,
            simRef.current,
          );
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
          const { worldX, worldY } = clientToWorldCoords(
            e.clientX,
            e.clientY,
            rect,
            simRef.current,
          );
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setInspectedTarget((prev) => (prev === enemy.id ? null : enemy.id));
                }}
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

      <CombatStageHudOverlay
        combat={combat}
        hero={hero}
        lang={lang}
        activePreview={activePreview}
        heroThreat={heroThreat}
        frontLivingIdx={frontLivingIdx}
        isCompactLandscape={isCompactLandscape}
        tacticalView={tacticalView}
        highContrastBorders={highContrastBorders}
        quantizedScaleMode={quantizedScaleMode}
        revealDropArchetype={diff.revealDropArchetype}
        rendererMode={rendererMode}
        setRendererMode={setRendererMode}
        debugMeshWireframe={debugMeshWireframe}
        setDebugMeshWireframe={setDebugMeshWireframe}
        inspectedTarget={inspectedTarget}
        setInspectedTarget={setInspectedTarget}
        setHoveredEnemyId={setHoveredEnemyId}
        onOpenCodex={onOpenCodex}
        setDevToolbarMountNode={import.meta.env.DEV ? setDevToolbarMountNode : undefined}
        sequentialHudStates={sequentialHudStates}
      />

      {import.meta.env.DEV && LazyCombatDevLabsPanel && (
        <Suspense fallback={null}>
          <LazyCombatDevLabsPanel
            simRef={simRef}
            combatRef={combatRef}
            heroRef={heroRef}
            tacticalViewRef={tacticalViewRef}
            labRuntimeRef={labRuntimeRef}
            canvasRef={canvasRef}
            toolbarMountNode={devToolbarMountNode}
            requestDraw={requestDraw}
            onExtraArchetypesChange={setExtraLabArchetypes}
          />
        </Suspense>
      )}

      {inspectedEnemy && inspectedHudState && (
        <EnemyIntelPanel
          enemy={inspectedEnemy}
          livingEnemies={livingEnemies}
          armorPreview={inspectedHudState.armorPreview}
          conditionActive={inspectedHudState.conditionActive}
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
