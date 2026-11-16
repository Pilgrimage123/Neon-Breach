import { useEffect, useRef, useState } from 'react';
import { CYBER_IMPLANTS, MAX_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import type { CyberImplantId, RunState, TurnPreview } from '../engine/types';
import { CODEX_TRANSLATIONS } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  getTileCornerPip,
  type SemanticZoomLevel,
} from '../utils/accessibilityAndScale';
import type { EncounterObjectivesSummary } from '../utils/tacticalSandboxAndHints';
import { ImplantIcon } from './ImplantIcon';
import type { LoupeInspectPayload } from './TacticalLoupeOverlay';

interface TopHudProps {
  run: RunState;
  lang: Language;
  muted: boolean;
  hudMinimized?: boolean;
  activePreview?: TurnPreview | null;
  tacticalView?: boolean;
  semanticZoom?: SemanticZoomLevel;
  autoFocusCamera?: boolean;
  objectivesSummary?: EncounterObjectivesSummary | null;
  canUndoTurn?: boolean;
  canResetEncounter?: boolean;
  onUndoTurn?: () => void;
  onResetEncounter?: () => void;
  isCompactLandscape?: boolean;
  isNarrowPortrait?: boolean;
  showLandscapeToggle?: boolean;
  isLandscapeRotated?: boolean;
  onToggleLandscape?: () => void;
  showFullscreenButton?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleHudMinimized?: () => void;
  onToggleTacticalView?: () => void;
  onCycleSemanticZoom?: () => void;
  onToggleAutoFocusCamera?: () => void;
  onInspectLoupe?: (payload: LoupeInspectPayload | null) => void;
  onToggleLang: () => void;
  onToggleMute: () => void;
  onOpenPool: () => void;
  onOpenCodex: () => void;
  onOpenPause: () => void;
}

export function TopHud({
  run,
  lang,
  muted,
  hudMinimized = false,
  activePreview: _activePreview = null,
  tacticalView = false,
  semanticZoom = 'standard',
  autoFocusCamera = true,
  objectivesSummary = null,
  canUndoTurn = false,
  canResetEncounter = false,
  onUndoTurn,
  onResetEncounter,
  isCompactLandscape = false,
  showLandscapeToggle = false,
  isLandscapeRotated = false,
  onToggleLandscape,
  showFullscreenButton = false,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleHudMinimized,
  onToggleTacticalView,
  onCycleSemanticZoom,
  onToggleAutoFocusCamera,
  onInspectLoupe,
  onToggleLang,
  onToggleMute,
  onOpenPool,
  onOpenCodex,
  onOpenPause,
}: TopHudProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const { heroine } = run;
  const charMeta = t.characters[heroine.characterId ?? 'kira'];
  const usedWeight = getEquippedEquipmentWeight(heroine);
  const [inspectImplantId, setInspectImplantId] = useState<CyberImplantId | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const barRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inspectImplantId && !drawerOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setInspectImplantId(null);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [inspectImplantId, drawerOpen]);

  const combat = run.combat;
  const isCombat = run.screen === 'combat' && Boolean(combat);

  return (
    <header
      ref={barRef}
      data-testid="top-hud-bar"
      className={`aaa-charcoal-surface chrome-glass relative z-30 shrink-0 rounded-xl border border-[#F4F4F6]/25 bg-[#181A20]/96 text-[#F4F4F6] ${
        isCompactLandscape
          ? 'mx-1.5 mt-1 px-2 py-0.5'
          : 'mx-2 mt-1 px-2.5 py-1 sm:mx-3 sm:mt-1.5 sm:px-3.5 sm:py-1.5'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Zone 1: Brand + Clean Unboxed Metadata (Turns · Objectives · Credits) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span
            className={`font-display font-extrabold tracking-wider text-[#F4F4F6] whitespace-nowrap shrink-0 ${
              isCompactLandscape ? 'text-xs' : 'text-sm sm:text-base'
            }`}
          >
            NEON<span className="text-cyan-300">BREACH</span>
          </span>

          <span aria-hidden="true" className="text-slate-500 shrink-0">
            ·
          </span>

          {/* Turn Counter in Combat or Sector Progress on Map */}
          {isCombat && combat ? (
            <div
              data-testid="tophud-turn-counter"
              className="flex items-baseline gap-1.5 font-mono-tabular whitespace-nowrap shrink-0"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                {t.turnsLabel}
              </span>
              <span className="tactical-numeral-stroke text-lg sm:text-xl font-black text-[#F4F4F6] leading-none">
                {combat.turn}
              </span>
            </div>
          ) : (
            <span className="font-mono-tabular text-xs sm:text-sm font-bold text-cyan-200 whitespace-nowrap shrink-0">
              {run.mapNodes.filter((n) => n.cleared).length}/{run.mapNodes.length}
            </span>
          )}

          {/* Compact 1-Line Objective Stars in Top Bar (full criteria on hover) */}
          {isCombat && objectivesSummary && (
            <>
              <span aria-hidden="true" className="hidden md:inline text-slate-500 shrink-0">
                ·
              </span>
              <div
                data-testid="tophud-objective-tracker"
                className="hidden md:flex items-center gap-1.5 font-mono-tabular text-xs whitespace-nowrap shrink-0"
              >
                {objectivesSummary.tiers.map((tier) => (
                  <span
                    key={tier.tier}
                    title={`${tier.tierLabel} — ${tier.title} (${tier.rewardText})`}
                    className={`font-bold tracking-tight transition-colors ${
                      tier.completed ? 'text-[#FFC700]' : 'text-slate-500'
                    }`}
                  >
                    {'★'.repeat(tier.tier)}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Show Hero HP in TopHud only outside combat (combat shows live pod directly on stage) */}
          {!isCombat && (
            <>
              <span aria-hidden="true" className="text-slate-500 shrink-0">
                ·
              </span>
              <div
                className="flex items-center gap-1 font-mono-tabular text-xs sm:text-sm font-bold text-[#F4F4F6] whitespace-nowrap shrink-0"
                onMouseEnter={(e) => {
                  if (!onInspectLoupe) return;
                  onInspectLoupe({
                    id: 'tophud-hero',
                    pip: getTileCornerPip('defense'),
                    kicker: `${charMeta.code} · OPERATIVE`,
                    title: charMeta.name,
                    primaryStat: `${heroine.hp}/${heroine.maxHp} HP`,
                    subtitle: `${t.shieldLabel} ${heroine.shield} · OD ${heroine.overdrive}%`,
                    detailLine: 'Match tiles. Survive incoming strikes.',
                    pointerX: e.clientX,
                    pointerY: e.clientY,
                    viewportW: window.innerWidth,
                    viewportH: window.innerHeight,
                    keywords: ['shield', 'armor'],
                    lang,
                  });
                }}
                onMouseLeave={() => onInspectLoupe?.(null)}
              >
                <span className="text-rose-300">♥</span>
                <span className="tactical-numeral-stroke">
                  {heroine.hp}/{heroine.maxHp}
                </span>
              </div>
            </>
          )}

          <span aria-hidden="true" className="hidden sm:inline text-slate-500 shrink-0">
            ·
          </span>

          {/* Unboxed Credits Counter */}
          <div className="hidden sm:flex items-center gap-1 font-mono-tabular text-xs sm:text-sm font-bold text-amber-300 whitespace-nowrap shrink-0">
            <span aria-hidden="true">◈</span>
            <span>{heroine.credits}</span>
          </div>
        </div>

        {/* Zone 2 & 3: Direct Puzzle Actions (Undo / Reset) + Tactical Utilities */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCombat && onUndoTurn && (
            <button
              type="button"
              data-testid="tophud-undo-btn"
              onClick={onUndoTurn}
              disabled={!canUndoTurn}
              title={
                lang === 'cs'
                  ? 'Vrátit tah zpět (U nebo pravé tlačítko na ploše)'
                  : 'Undo turn (U or right-click board)'
              }
              className="flex items-center gap-1 rounded-lg border border-cyan-300/50 bg-cyan-950/55 px-2.5 py-1 font-mono-tabular text-xs font-extrabold text-[#F4F4F6] transition hover:border-cyan-200 hover:bg-cyan-900/70 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="text-cyan-300">↶</span>
              <span>{lang === 'cs' ? 'Zpět' : 'Undo'}</span>
            </button>
          )}

          {isCombat && onResetEncounter && (
            <button
              type="button"
              data-testid="tophud-reset-btn"
              onClick={onResetEncounter}
              disabled={!canResetEncounter}
              title={lang === 'cs' ? 'Restartovat střet od 1. tahu' : 'Reset puzzle to Turn 1'}
              className="flex items-center gap-1 rounded-lg border border-white/20 bg-[#0E1015] px-2 py-1 font-mono-tabular text-xs font-bold text-[#F4F4F6] transition hover:border-amber-300 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="text-amber-300">⟲</span>
              <span className="hidden sm:inline">{lang === 'cs' ? 'Reset' : 'Reset'}</span>
            </button>
          )}

          {onToggleTacticalView && (
            <button
              type="button"
              data-testid="tactical-view-toggle"
              onClick={onToggleTacticalView}
              aria-pressed={tacticalView}
              title="Tactical View (Alt / Tab)"
              className={`rounded-lg border px-2 py-1 font-mono-tabular text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                tacticalView
                  ? 'border-cyan-300 bg-cyan-500/25 text-white'
                  : 'border-white/15 bg-[#0E1015] text-cyan-200 hover:border-cyan-300'
              }`}
            >
              ⌖ {lang === 'cs' ? 'TAK' : 'TAC'}
            </button>
          )}

          <button
            type="button"
            data-testid="tophud-pool-button"
            onClick={onOpenPool}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0E1015] px-2 py-1 font-mono-tabular text-[11px] font-bold text-cyan-200 hover:border-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>▣</span>
            <span className="hidden lg:inline">{t.inspectPool}</span>
            <span className="text-slate-300">
              {usedWeight}/{heroine.carryCapacity}
            </span>
          </button>

          <button
            type="button"
            data-testid="tophud-codex-button"
            onClick={onOpenCodex}
            aria-label={codexT.codexButtonLabel}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0E1015] px-2 py-1 text-[11px] font-bold text-cyan-200 transition hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="font-mono-tabular text-cyan-300">?</span>
            <span className="hidden lg:inline">{codexT.codexButtonLabel}</span>
          </button>

          <button
            type="button"
            data-testid="tophud-drawer-toggle"
            onClick={() => {
              setDrawerOpen((prev) => !prev);
              setInspectImplantId(null);
            }}
            aria-expanded={drawerOpen}
            aria-label="Settings & Implants"
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen
                ? 'border-cyan-300 bg-cyan-500/25 text-white'
                : 'border-white/15 bg-[#0E1015] text-[#F4F4F6] hover:border-cyan-300'
            }`}
          >
            <span>⚙</span>
            {heroine.implants.length > 0 && (
              <span className="font-mono-tabular text-[10px] text-cyan-300">
                {heroine.implants.length}/{MAX_IMPLANTS}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="tophud-pause-button"
            onClick={onOpenPause}
            aria-label={t.pauseTitle}
            className="rounded-lg border border-white/15 bg-[#0E1015] px-2 py-1 font-mono-tabular text-[11px] font-bold text-slate-200 hover:border-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            ❚❚
          </button>
        </div>
      </div>

      {/* Collapsible Secondary Drawer (Implants, Semantic Zoom, Auto-Focus Camera, Audio, Language, Fullscreen) */}
      {drawerOpen && !hudMinimized && (
        <div
          data-testid="tophud-secondary-drawer"
          className="aaa-charcoal-surface mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.implantSlotsLabel} ({heroine.implants.length}/{MAX_IMPLANTS}):
            </span>
            {heroine.implants.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">{t.noImplants}</span>
            ) : (
              heroine.implants.map((impId) => {
                const def = CYBER_IMPLANTS.find((c) => c.id === impId);
                const copy = t.implants[impId];
                if (!def || !copy) return null;
                const isSelected = inspectImplantId === impId;
                return (
                  <button
                    key={impId}
                    type="button"
                    onClick={() => setInspectImplantId((prev) => (prev === impId ? null : impId))}
                    className={`chrome-pill flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] transition cursor-pointer ${
                      isSelected
                        ? 'border-cyan-300 bg-cyan-950/80 text-white'
                        : 'text-slate-100 hover:border-cyan-400/50'
                    }`}
                  >
                    <ImplantIcon id={impId} className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">{copy.name}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onCycleSemanticZoom && (
              <button
                type="button"
                data-testid="semantic-zoom-toggle"
                onClick={onCycleSemanticZoom}
                className="chrome-pill rounded-lg px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                🔍 {semanticZoom.toUpperCase()}
              </button>
            )}
            {onToggleAutoFocusCamera && (
              <button
                type="button"
                data-testid="autofocus-camera-toggle"
                onClick={onToggleAutoFocusCamera}
                aria-pressed={autoFocusCamera}
                className="chrome-pill rounded-lg px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                🎥 {autoFocusCamera ? 'CAM ON' : 'CAM OFF'}
              </button>
            )}
            {onToggleHudMinimized && (
              <button
                type="button"
                onClick={onToggleHudMinimized}
                className="chrome-pill rounded-lg px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-slate-200 hover:border-cyan-300 cursor-pointer"
              >
                {hudMinimized ? '▼ HUD' : '▲ HUD'}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleLang}
              className="chrome-pill rounded-lg px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
            >
              {lang.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? t.unmute : t.mute}
              className="chrome-pill rounded-lg px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-cyan-300 cursor-pointer"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {showLandscapeToggle && onToggleLandscape && (
              <button
                type="button"
                onClick={onToggleLandscape}
                className="chrome-pill rounded-lg px-2 py-0.5 text-[11px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                {isLandscapeRotated ? '📱' : '🔄'}
              </button>
            )}
            {showFullscreenButton && onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="chrome-pill rounded-lg px-2 py-0.5 text-[11px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                {isFullscreen ? '🗗' : '⛶'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tap-to-inspect implant popover */}
      {inspectImplantId && t.implants[inspectImplantId] && (
        <div
          role="status"
          aria-live="polite"
          className="aaa-charcoal-surface mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-cyan-300/45 bg-[#181A20]/98 px-3 py-2 text-xs shadow-lg"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-950/70">
              <ImplantIcon id={inspectImplantId} className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-cyan-200">
                {t.implants[inspectImplantId].name}
              </div>
              <div className="text-[#F4F4F6] text-[14px] leading-[1.3] max-w-[40ch]">
                {t.implants[inspectImplantId].desc}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInspectImplantId(null)}
            className="chrome-pill shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:border-cyan-300 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
