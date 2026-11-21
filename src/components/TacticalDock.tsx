import { useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  getSurgeThreshold,
  previewHeroThreat,
  sortTilesByGroup,
} from '../engine/gameEngine';
import type { CharacterId, RunState, TileType, TurnPreview } from '../engine/types';
import type { GlossaryTermId } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  getTileCornerPip,
  resolveSemanticZoomLoD,
  type SemanticZoomLevel,
} from '../utils/accessibilityAndScale';
import { computeSmartActionTriggerSummaries } from '../utils/spatialMinimalistUi';
import type { OptimalMoveHint } from '../utils/tacticalSandboxAndHints';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import type { CodexTab } from './CodexModal';
import { computeEnemyArmorPreview } from './combat/combatEnemyUi';
import { ActionTriggerCluster } from './tacticalDock/ActionTriggerCluster';
import {
  TILE_THEME,
  TacticalIntelStrip,
  type LockOutcomePreview,
} from './tacticalDock/TacticalIntelStrip';
import { TileBoardGrid } from './tacticalDock/TileBoardGrid';
import { TileGlyph } from './TileGlyph';

interface TacticalDockProps {
  run: RunState;
  lang: Language;
  canPlay: boolean;
  hudMinimized?: boolean;
  tacticalView?: boolean;
  semanticZoom?: SemanticZoomLevel;
  twoStepConfirm?: boolean;
  highContrastBorders?: boolean;
  quantizedScaleMode?: boolean;
  canSwapEnemies?: boolean;
  activeHint?: OptimalMoveHint | null;
  hintsAllowed?: boolean;
  onboardingPrompt?: string | null;
  isCompactLandscape?: boolean;
  isNarrowPortrait?: boolean;
  effectiveWidth?: number;
  activeColor: TileType | null;
  selectedColor: TileType | null;
  activePreview: TurnPreview | null;
  countByColor: Record<TileType, number>;
  onHoverColor: (color: TileType | null) => void;
  onSelectColor: (color: TileType | null) => void;
  onCommitColor: (color: TileType) => void;
  onOverdrive: () => void;
  onSwapEnemies?: () => void;
  onHoverSwap?: (hovering: boolean) => void;
  onToggleHint?: () => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
}

export function TacticalDock({
  run,
  lang,
  canPlay,
  hudMinimized = false,
  tacticalView = false,
  semanticZoom = 'standard',
  twoStepConfirm = false,
  highContrastBorders = false,
  quantizedScaleMode = false,
  canSwapEnemies = false,
  activeHint = null,
  hintsAllowed = true,
  onboardingPrompt = null,
  isCompactLandscape = false,
  isNarrowPortrait = false,
  effectiveWidth = 1280,
  activeColor,
  selectedColor,
  activePreview,
  countByColor,
  onHoverColor,
  onSelectColor,
  onCommitColor,
  onOverdrive,
  onSwapEnemies,
  onHoverSwap,
  onToggleHint,
  onOpenCodex,
}: TacticalDockProps) {
  const t = TRANSLATIONS[lang];
  const combat = run.combat;
  const charMeta = t.characters[run.hero.characterId ?? 'kira'];
  const surgeThreshold = getSurgeThreshold(run.hero.implants);
  const board = combat?.board;
  const drawPile = combat?.drawPile;
  const lod = useMemo(
    () => resolveSemanticZoomLoD(semanticZoom, tacticalView),
    [semanticZoom, tacticalView],
  );
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';

  const upcomingDraws = useMemo(() => (drawPile ? drawPile.slice(0, 6) : []), [drawPile]);
  const groupedBoard = useMemo(() => (board ? sortTilesByGroup(board) : []), [board]);

  const [inspectedTileId, setInspectedTileId] = useState<string | null>(null);
  const [drawPopoverOpen, setDrawPopoverOpen] = useState(false);

  const lastPointerTypeRef = useRef<string>('mouse');
  const dockRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!drawPopoverOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setDrawPopoverOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [drawPopoverOpen]);

  const inspectedTile = useMemo(
    () => (inspectedTileId && board ? board.find((tile) => tile.id === inspectedTileId) ?? null : null),
    [board, inspectedTileId],
  );

  const lockOutcomePreview: LockOutcomePreview | null = useMemo(() => {
    if (!combat || !activePreview || activePreview.tileCount === 0) return null;
    const frontIdx = combat.enemies.findIndex((e) => e.hp > 0);
    const frontEnemy = frontIdx !== -1 ? combat.enemies[frontIdx] : null;
    const frontPreview =
      frontEnemy && frontIdx !== -1
        ? computeEnemyArmorPreview(frontEnemy, frontIdx, frontIdx, activePreview, combat.enemies)
        : null;
    const threat = previewHeroThreat(combat, run.hero, activePreview);
    const livingAfterCount = combat.enemies.filter((e, idx) => {
      if (e.hp <= 0) return false;
      const p = computeEnemyArmorPreview(e, idx, frontIdx, activePreview, combat.enemies);
      return !p.willDie;
    }).length;
    const triggersBioBurst = combat.enemies.some((e, idx) => {
      if (e.hp <= 0 || e.passive !== 'volatile_burst') return false;
      const p = computeEnemyArmorPreview(e, idx, frontIdx, activePreview, combat.enemies);
      return p.willDie && livingAfterCount > 0;
    });
    return {
      willCrackPip: Boolean(frontPreview?.willCrackShieldPip),
      willTriggerPhaseGate: Boolean(frontPreview?.willTriggerPhaseGate),
      triggersBioBurst,
      retaliateDamage: threat.retaliateDamage,
      pustuleRuptureCorrode: activePreview.pustuleRuptureCorrode ?? 0,
      conditionalBonusDamage: threat.conditionalBonusDamage ?? 0,
      hexHealTriggered: threat.hexHealTriggered ?? 0,
    };
  }, [activePreview, combat, run.hero]);

  const triggerSummaries = useMemo(
    () => computeSmartActionTriggerSummaries(run, lang),
    [run, lang],
  );

  const handleGroupActivate = (color: TileType, tileId?: string) => {
    if (!canPlay || countByColor[color] === 0) {
      soundEngine.playInvalidBuzz();
      return;
    }
    const isTouch = lastPointerTypeRef.current === 'touch';
    lastPointerTypeRef.current = 'mouse';
    if ((isTouch || twoStepConfirm) && selectedColor !== color) {
      if (tileId) setInspectedTileId(tileId);
      onSelectColor(color);
      return;
    }
    setInspectedTileId(null);
    onCommitColor(color);
  };

  const overdriveReady = run.hero.overdrive >= 100;
  const showHorizontalDock = !isNarrowPortrait && effectiveWidth >= 560;

  const activeSurgeText =
    activeColor === 'attack'
      ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeAttackEffect}`
      : activeColor === 'defense'
        ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeDefenseEffect}`
        : activeColor === 'tech'
          ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeTechEffect}`
          : `${t.surgeLabel} ${surgeThreshold}+`;

  const renderNextDrawPanel = () => (
    <div className="flex flex-col justify-between rounded-lg border border-white/15 bg-slate-950/50 p-1.5 sm:p-2">
      <div className="flex items-center justify-between text-[12px] font-mono-tabular">
        <span className="font-bold uppercase tracking-wider text-cyan-200">
          {t.nextDrawLabel}
        </span>
        <span className="text-slate-300">
          {combat?.drawPile.length ?? 0} · {t.discardPoolLabel} {combat?.discardPile.length ?? 0}
        </span>
      </div>

      <div
        className={`mt-1.5 grid gap-1 ${
          upcomingDraws.length <= 3
            ? 'grid-cols-3'
            : upcomingDraws.length === 4
              ? 'grid-cols-4'
              : upcomingDraws.length === 5
                ? 'grid-cols-5'
                : 'grid-cols-6'
        }`}
      >
        {upcomingDraws.map((tile, idx) => {
          const pip = getTileCornerPip(tile.type);
          return (
            <div
              key={`${tile.id}_${idx}`}
              title={`${pip.symbol} ${formatTileDetailText(tile, lang)}`}
              className={`relative flex flex-col items-center justify-center overflow-hidden rounded border ${
                tile.isBlight
                  ? 'border-dashed border-[#84CC16]/80 bg-[#1B240E]/90'
                  : `${TILE_THEME[tile.type].border} bg-slate-950/80`
              } px-0.5 ${hcBorderClass} ${isCompactLandscape ? 'h-11' : 'h-12 sm:h-[54px]'}`}
            >
              <span
                aria-hidden="true"
                style={{ color: tile.isBlight ? '#84CC16' : pip.accentHex }}
                className="absolute left-0.5 top-0.5 font-mono-tabular text-[9.5px] font-black leading-none"
              >
                {tile.isBlight ? '☣' : pip.symbol}
              </span>
              {tile.isTopDecked && (
                <span
                  data-testid={`top-decked-badge-${tile.id}`}
                  className="absolute right-0.5 top-0.5 rounded bg-lime-500/40 px-0.5 font-mono-tabular text-[8.5px] font-black text-lime-200 leading-none"
                >
                  TOP
                </span>
              )}
              <TileGlyph type={tile.type} size={13} />
              <span
                className={`mt-0.5 w-full truncate text-center text-[10px] sm:text-[11px] font-mono-tabular font-bold leading-none ${
                  tile.isBlight ? 'text-lime-300' : 'text-[#F4F4F6]'
                }`}
              >
                {formatTileShortLabel(tile, lang)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const triggerCluster = (
    <ActionTriggerCluster
      lang={lang}
      canPlay={canPlay}
      isCompactLandscape={isCompactLandscape}
      lod={lod}
      hcBorderClass={hcBorderClass}
      activeColor={activeColor}
      selectedColor={selectedColor}
      countByColor={countByColor}
      triggerSummaries={triggerSummaries}
      surgeThreshold={surgeThreshold}
      activeHint={activeHint}
      overdriveReady={overdriveReady}
      overdriveValue={run.hero.overdrive}
      charOverdriveName={charMeta.overdriveName}
      charOverdriveDesc={charMeta.overdriveDesc}
      lastPointerTypeRef={lastPointerTypeRef}
      onHoverColor={onHoverColor}
      onInspectTile={setInspectedTileId}
      onActivateGroup={handleGroupActivate}
      onOverdrive={onOverdrive}
    />
  );

  const boardGrid = (
    <TileBoardGrid
      run={run}
      lang={lang}
      canPlay={canPlay}
      hudMinimized={hudMinimized}
      isCompactLandscape={isCompactLandscape}
      isNarrowPortrait={isNarrowPortrait}
      lod={lod}
      hcBorderClass={hcBorderClass}
      activeColor={activeColor}
      selectedColor={selectedColor}
      activeSurgeText={activeSurgeText}
      groupedBoard={groupedBoard}
      lastPointerTypeRef={lastPointerTypeRef}
      onHoverColor={onHoverColor}
      onInspectTile={setInspectedTileId}
      onActivateGroup={handleGroupActivate}
      onOpenCodex={onOpenCodex}
    />
  );

  return (
    <section
      ref={dockRef}
      aria-label="Tactical Command Dock"
      className={`chrome-glass relative z-20 shrink-0 border-x-0 border-b-0 border-t border-cyan-300/40 ${
        isCompactLandscape ? 'px-2 py-1.5' : 'px-2.5 py-2 sm:px-4 sm:py-2.5'
      }`}
    >
      {drawPopoverOpen && (
        <div
          data-testid="dock-draw-popover"
          className="chrome-panel-bright absolute right-2 sm:right-4 bottom-full mb-1.5 z-40 w-[calc(100vw-1rem)] max-w-md rounded-xl p-2.5 text-xs shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
            <span className="font-display font-bold text-[#00F0FF]">
              {t.nextDrawLabel} · {charMeta.code}
            </span>
            <button
              type="button"
              onClick={() => setDrawPopoverOpen(false)}
              className="chrome-pill rounded px-2 py-0.5 text-[12px] font-bold text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          {renderNextDrawPanel()}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-300">
            <span className="font-bold text-rose-200">
              {t.attackName} ({surgeThreshold}+):
            </span>{' '}
            <span>{t.surgeAttackEffect}</span>
            <span>·</span>
            <span className="font-bold text-cyan-200">{t.defenseName}:</span>{' '}
            <span>{t.surgeDefenseEffect}</span>
            <span>·</span>
            <span className="font-bold text-amber-200">{t.techName}:</span>{' '}
            <span>{t.surgeTechEffect}</span>
          </div>
        </div>
      )}

      <div className={`mx-auto ${hudMinimized ? 'max-w-5xl' : 'max-w-[1680px]'}`}>
        <TacticalIntelStrip
          lang={lang}
          isCompactLandscape={isCompactLandscape}
          activePreview={activePreview}
          selectedColor={selectedColor}
          canPlay={canPlay}
          quantizedScaleMode={quantizedScaleMode}
          lockOutcomePreview={lockOutcomePreview}
          inspectedTile={inspectedTile}
          activeHint={activeHint}
          hintsAllowed={hintsAllowed}
          onboardingPrompt={onboardingPrompt}
          charPassive={charMeta.passive}
          charOverdriveName={charMeta.overdriveName}
          charOverdriveDesc={charMeta.overdriveDesc}
          canSwapEnemies={canSwapEnemies}
          drawPileCount={combat?.drawPile.length ?? 0}
          drawPopoverOpen={drawPopoverOpen}
          onConfirmMove={(color) => {
            setInspectedTileId(null);
            onCommitColor(color);
          }}
          onSwapEnemies={onSwapEnemies}
          onHoverSwap={onHoverSwap}
          onToggleHint={onToggleHint}
          onToggleDrawPopover={() => setDrawPopoverOpen((prev) => !prev)}
        />

        {showHorizontalDock ? (
          <div className="grid grid-cols-12 items-center gap-2 sm:gap-3">
            <div className="col-span-4 lg:col-span-3">{triggerCluster}</div>
            <div className="col-span-8 lg:col-span-9">{boardGrid}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {boardGrid}
            {triggerCluster}
          </div>
        )}
      </div>
    </section>
  );
}
