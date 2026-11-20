import { useEffect, useRef, useState } from 'react';
import { CYBER_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import { getDifficultyProfile, getStageSecondaryTurnTarget } from '../engine/difficulty';
import type { CyberImplantId, DifficultyTier, RunState } from '../engine/types';
import { CODEX_TRANSLATIONS } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { EncounterObjectivesSummary } from '../utils/tacticalSandboxAndHints';
import { ImplantIcon } from './ImplantIcon';

interface TopHudProps {
  run: RunState;
  lang: Language;
  objectivesSummary?: EncounterObjectivesSummary | null;
  canUndoTurn?: boolean;
  canResetEncounter?: boolean;
  undoResetHint?: string;
  onUndoTurn?: () => void;
  onResetEncounter?: () => void;
  isCompactLandscape?: boolean;
  onOpenPool: () => void;
  onOpenCodex: () => void;
  onOpenPause: () => void;
}

export function TopHud({
  run,
  lang,
  objectivesSummary = null,
  canUndoTurn = false,
  canResetEncounter = false,
  undoResetHint,
  onUndoTurn,
  onResetEncounter,
  isCompactLandscape = false,
  onOpenPool,
  onOpenCodex,
  onOpenPause,
}: TopHudProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const { heroine } = run;
  const usedWeight = getEquippedEquipmentWeight(heroine);
  const [inspectImplantId, setInspectImplantId] = useState<CyberImplantId | null>(null);
  const barRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inspectImplantId) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setInspectImplantId(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [inspectImplantId]);

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
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Zone 1: Brand + Core Metadata (Turn/Map · Stars · HP/Credits · Implants) */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <span
            className={`font-display font-extrabold tracking-wider text-[#F4F4F6] whitespace-nowrap shrink-0 ${
              isCompactLandscape ? 'text-xs' : 'text-[13px] min-[430px]:text-sm sm:text-base'
            }`}
          >
            NEON<span className="hidden min-[430px]:inline text-cyan-300">BREACH</span>
          </span>

          <span aria-hidden="true" className="text-slate-500 shrink-0">
            ·
          </span>

          {isCombat && combat ? (
            <div
              data-testid="tophud-turn-counter"
              className="flex items-baseline gap-1 sm:gap-1.5 font-mono-tabular whitespace-nowrap shrink-0"
            >
              <span className="text-[11.5px] min-[430px]:text-[13px] font-bold uppercase tracking-wider text-cyan-300">
                {lang === 'cs' ? 'Tah' : 'Turn'}
              </span>
              <span className="tactical-numeral-stroke text-base min-[430px]:text-lg sm:text-xl font-black text-[#F4F4F6] leading-none">
                {combat.turn}
              </span>
            </div>
          ) : (
            <span className="font-mono-tabular text-xs sm:text-sm font-bold text-cyan-200 whitespace-nowrap shrink-0">
              {run.mapNodes.filter((n) => n.cleared).length}/{run.mapNodes.length}
            </span>
          )}

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

          {!isCombat && (
            <>
              <span aria-hidden="true" className="text-slate-500 shrink-0">
                ·
              </span>
              <div className="flex items-center gap-1 font-mono-tabular text-xs sm:text-sm font-bold text-[#F4F4F6] whitespace-nowrap shrink-0">
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

          <div className="hidden sm:flex items-center gap-1 font-mono-tabular text-xs sm:text-sm font-bold text-amber-300 whitespace-nowrap shrink-0">
            <span aria-hidden="true">◈</span>
            <span>{heroine.credits}</span>
          </div>

          {heroine.implants.length > 0 && (
            <div className="hidden md:flex items-center gap-1 pl-1 border-l border-white/15 shrink-0">
              {heroine.implants.map((impId) => {
                const def = CYBER_IMPLANTS.find((c) => c.id === impId);
                const copy = t.implants[impId];
                if (!def || !copy) return null;
                const isSelected = inspectImplantId === impId;
                return (
                  <button
                    key={impId}
                    type="button"
                    onClick={() => setInspectImplantId((prev) => (prev === impId ? null : impId))}
                    title={`${copy.name}: ${copy.desc}`}
                    aria-label={copy.name}
                    className={`flex h-6 w-6 items-center justify-center rounded-md border transition cursor-pointer ${
                      isSelected
                        ? 'border-cyan-300 bg-cyan-900/75 text-white'
                        : 'border-white/15 bg-[#0E1015] text-cyan-200 hover:border-cyan-300/60'
                    }`}
                  >
                    <ImplantIcon id={impId} className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zone 2: Core Play Controls (Undo · Reset · Loadout · Codex · Pause/Settings) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCombat && (() => {
            const tier = (run.difficultyTier ?? 3) as DifficultyTier;
            const diff = getDifficultyProfile(tier);
            const combatState = run.combat;
            const turnCap = combatState ? getStageSecondaryTurnTarget(combatState.nodeType, tier) : 5;
            const hpLost = combatState
              ? Math.max(0, (combatState.startingHeroHp ?? run.heroine.hp) - run.heroine.hp)
              : 0;
            const mandateOnTrack =
              combatState ? combatState.turn <= turnCap || hpLost === 0 : true;
            return (
              <>
                <span
                  data-testid="tophud-tier-badge"
                  title={
                    undoResetHint ??
                    (lang === 'cs' ? diff.summaryCs : diff.summaryEn)
                  }
                  className="hidden md:inline-flex items-center rounded-md border border-white/15 bg-slate-900/90 px-2 py-1 font-mono-tabular text-[12px] font-bold text-slate-200 whitespace-nowrap"
                >
                  T{tier}
                  {undoResetHint ? ` · ${undoResetHint}` : ''}
                </span>
                {diff.mandatoryBonusObjective && combatState && (
                  <span
                    data-testid="tophud-mandate-badge"
                    title={
                      lang === 'cs'
                        ? `Povinný mandát Velmistra: vyčisti do T${turnCap} nebo bez ztráty HP (-12 HP průlom & ztráta kořisti při nesplnění)`
                        : `Grandmaster Mandatory Mandate: clear by T${turnCap} or 0 HP lost (-12 HP breach & loot confiscated on fail)`
                    }
                    className={`hidden lg:inline-flex items-center rounded-md border px-2 py-1 font-mono-tabular text-[12px] font-extrabold whitespace-nowrap ${
                      mandateOnTrack
                        ? 'border-emerald-400/50 bg-emerald-950/60 text-emerald-200'
                        : 'border-rose-400/70 bg-rose-950/70 text-rose-200 animate-pulse'
                    }`}
                  >
                    {lang === 'cs'
                      ? `MANDÁT ≤T${turnCap}/0HP`
                      : `MANDATE ≤T${turnCap}/0DMG`}
                  </span>
                )}
              </>
            );
          })()}

          {isCombat && onUndoTurn && (
            <button
              type="button"
              data-testid="tophud-undo-btn"
              onClick={onUndoTurn}
              disabled={!canUndoTurn}
              title={
                undoResetHint
                  ? `${lang === 'cs' ? 'Vrátit tah zpět (U)' : 'Undo turn (U)'} · ${undoResetHint}`
                  : lang === 'cs'
                    ? 'Vrátit tah zpět (U)'
                    : 'Undo turn (U)'
              }
              className="flex items-center gap-1 rounded-lg border border-cyan-300/50 bg-cyan-950/55 px-2 sm:px-2.5 py-1 font-mono-tabular text-xs font-extrabold text-[#F4F4F6] transition hover:border-cyan-200 hover:bg-cyan-900/70 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="text-cyan-300">↶</span>
              <span className="hidden sm:inline">{lang === 'cs' ? 'Zpět' : 'Undo'}</span>
            </button>
          )}

          {isCombat && onResetEncounter && (
            <button
              type="button"
              data-testid="tophud-reset-btn"
              onClick={onResetEncounter}
              disabled={!canResetEncounter}
              title={
                getDifficultyProfile((run.difficultyTier ?? 3) as DifficultyTier).maxRunResets === 0
                  ? lang === 'cs'
                    ? 'Vypnuto na obtížnosti Velmistr (Ironman)'
                    : 'Disabled on Grandmaster (Ironman)'
                  : lang === 'cs'
                    ? 'Restartovat střet od 1. tahu'
                    : 'Reset encounter to Turn 1'
              }
              className="flex items-center gap-1 rounded-lg border border-white/20 bg-[#0E1015] px-2 py-1 font-mono-tabular text-xs font-bold text-[#F4F4F6] transition hover:border-amber-300 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="text-amber-300">⟲</span>
              <span className="hidden sm:inline">{lang === 'cs' ? 'Reset' : 'Reset'}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="tophud-pool-button"
            onClick={onOpenPool}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0E1015] px-2 py-1 font-mono-tabular text-[12px] sm:text-[13px] font-bold text-cyan-200 hover:border-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
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
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0E1015] px-2 py-1 text-[12px] sm:text-[13px] font-bold text-cyan-200 transition hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="font-mono-tabular text-cyan-300">?</span>
            <span className="hidden lg:inline">{codexT.codexButtonLabel}</span>
          </button>

          <button
            type="button"
            data-testid="tophud-pause-button"
            onClick={onOpenPause}
            aria-label={t.pauseTitle}
            title={lang === 'cs' ? 'Pauza a nastavení (Esc)' : 'Pause & Settings (Esc)'}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0E1015] px-2 sm:px-2.5 py-1 font-mono-tabular text-[12px] sm:text-[13px] font-bold text-slate-200 hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>⚙</span>
            <span className="text-slate-400">·</span>
            <span>❚❚</span>
          </button>
        </div>
      </div>

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
            className="chrome-pill shrink-0 rounded-lg px-2 py-0.5 text-[12px] font-bold text-slate-200 hover:border-cyan-300 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
