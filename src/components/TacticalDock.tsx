import { useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  getEffectiveTileValue,
  getSurgeThreshold,
  previewHeroineThreat,
  sortTilesByGroup,
} from '../engine/gameEngine';
import type { CharacterId, RunState, TileType, TurnPreview } from '../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  getTileCornerPip,
  resolveSemanticZoomLoD,
  type SemanticZoomLevel,
} from '../utils/accessibilityAndScale';
import {
  formatDiscretePipMath,
  type OptimalMoveHint,
} from '../utils/tacticalSandboxAndHints';
import { computeSmartActionTriggerSummaries } from '../utils/spatialMinimalistUi';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import type { CodexTab } from './CodexModal';
import { computeEnemyArmorPreview } from './combat/combatEnemyUi';
import { TileGlyph } from './TileGlyph';

const TILE_THEME: Record<
  TileType,
  {
    border: string;
    bg: string;
    activeRing: string;
    text: string;
    accentHex: string;
    shortcut: string;
  }
> = {
  attack: {
    border: 'border-[#FF2E7E]/55',
    bg: 'bg-gradient-to-b from-[#3D1231]/85 to-[#1F0A1D]/90 hover:from-[#521641]/90 hover:to-[#2B0D27]/95',
    activeRing:
      'ring-2 ring-[#FF2E7E] border-white/80 bg-gradient-to-b from-[#691852] to-[#330C2B] shadow-[0_0_22px_rgba(255,46,126,0.45),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-rose-100',
    accentHex: '#FF2E7E',
    shortcut: '1',
  },
  defense: {
    border: 'border-[#00F0FF]/55',
    bg: 'bg-gradient-to-b from-[#0E2E4A]/85 to-[#081A2E]/90 hover:from-[#133E63]/90 hover:to-[#0B233D]/95',
    activeRing:
      'ring-2 ring-[#00F0FF] border-white/80 bg-gradient-to-b from-[#144E7A] to-[#0A2947] shadow-[0_0_22px_rgba(255,240,255,0.42),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-cyan-100',
    accentHex: '#00F0FF',
    shortcut: '2',
  },
  tech: {
    border: 'border-[#FFC700]/55',
    bg: 'bg-gradient-to-b from-[#3B2B0C]/85 to-[#211706]/90 hover:from-[#4F3910]/90 hover:to-[#2E2008]/95',
    activeRing:
      'ring-2 ring-[#FFC700] border-white/80 bg-gradient-to-b from-[#634812] to-[#362608] shadow-[0_0_22px_rgba(255,199,0,0.42),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-amber-100',
    accentHex: '#FFC700',
    shortcut: '3',
  },
};

interface TacticalDockProps {
  run: RunState;
  lang: Language;
  canPlay: boolean;
  hudMinimized?: boolean;
  tacticalView?: boolean;
  semanticZoom?: SemanticZoomLevel;
  twoStepConfirm?: boolean;
  highContrastBorders?: boolean;
  pipMathMode?: boolean;
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
  pipMathMode = false,
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
  const codexT = CODEX_TRANSLATIONS[lang];
  const combat = run.combat;
  const charMeta = t.characters[run.heroine.characterId ?? 'kira'];
  const surgeThreshold = getSurgeThreshold(run.heroine.implants);
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

  const lockOutcomePreview = useMemo(() => {
    if (!combat || !activePreview || activePreview.tileCount === 0) return null;
    const frontIdx = combat.enemies.findIndex((e) => e.hp > 0);
    const frontEnemy = frontIdx !== -1 ? combat.enemies[frontIdx] : null;
    const frontPreview =
      frontEnemy && frontIdx !== -1
        ? computeEnemyArmorPreview(frontEnemy, frontIdx, frontIdx, activePreview, combat.enemies)
        : null;
    const threat = previewHeroineThreat(combat, run.heroine, activePreview);
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
  }, [activePreview, combat, run.heroine]);

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

  const overdriveReady = run.heroine.overdrive >= 100;
  const showHorizontalDock = !isNarrowPortrait && effectiveWidth >= 560;

  const activeSurgeText =
    activeColor === 'attack'
      ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeAttackEffect}`
      : activeColor === 'defense'
        ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeDefenseEffect}`
        : activeColor === 'tech'
          ? `${t.surgeLabel} (${surgeThreshold}+): ${t.surgeTechEffect}`
          : `${t.surgeLabel} ${surgeThreshold}+`;

  const renderTacticalIntelStrip = () => (
    <div
      data-testid="tactical-intel-strip"
      className={`mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-white/15 bg-slate-950/65 px-2.5 ${
        isCompactLandscape ? 'min-h-[26px] py-0.5 text-[11.5px]' : 'min-h-[30px] py-1 text-[13px]'
      }`}
    >
      {activePreview ? (
        <div className="flex min-w-[210px] flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`font-display font-bold whitespace-nowrap ${TILE_THEME[activePreview.color].text}`}>
            {activePreview.color === 'attack'
              ? t.attackName
              : activePreview.color === 'defense'
                ? t.defenseName
                : t.techName}{' '}
            ×{activePreview.tileCount}
          </span>

          {activePreview.tileCount === 0 ? (
            <span className="text-slate-300">{t.previewNoTiles}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-tabular">
              {activePreview.totalDamage > 0 && (
                <span className="font-bold text-rose-200">
                  +{activePreview.totalDamage} {t.previewDamage}
                  {pipMathMode && (
                    <span className="ml-1 rounded bg-rose-950/80 px-1 text-[#FFC700]">
                      [{formatDiscretePipMath(activePreview.totalDamage).compactLabel}]
                    </span>
                  )}
                  {activePreview.damageBoostPct > 0 && (
                    <span className="ml-1 text-amber-200">
                      ({activePreview.baseDamage}+{activePreview.damageBoostPct}%)
                    </span>
                  )}
                </span>
              )}
              {activePreview.cleaveDamage > 0 && (
                <span className="font-semibold text-rose-300">
                  +{activePreview.cleaveDamage} {t.previewCleave}
                </span>
              )}
              {activePreview.color === 'attack' && activePreview.armorPiercing && (
                <span className="font-semibold text-rose-200">{t.previewPierce}</span>
              )}
              {activePreview.shieldGained > 0 && (
                <span className="font-bold text-cyan-200">
                  +{activePreview.shieldGained} {t.previewShield}
                  {pipMathMode && (
                    <span className="ml-1 rounded bg-cyan-950/80 px-1 text-[#00F0FF]">
                      [{formatDiscretePipMath(activePreview.shieldGained).compactLabel}]
                    </span>
                  )}
                </span>
              )}
              {activePreview.reflectOnBlock > 0 && (
                <span className="font-semibold text-cyan-100">
                  +{activePreview.reflectOnBlock} DMG
                </span>
              )}
              {activePreview.damageBoostAddedPct > 0 && (
                <span className="font-bold text-amber-200">
                  +{activePreview.damageBoostAddedPct}% {t.previewDamageBoostAdded}
                </span>
              )}
              {activePreview.healAmount > 0 && (
                <span className="font-bold text-emerald-300">
                  +{activePreview.healAmount} {t.previewHeal}
                </span>
              )}
              {activePreview.armorShredAmount > 0 && (
                <span className="font-bold text-amber-300">
                  -{activePreview.armorShredAmount} {t.previewArmorShred}
                </span>
              )}
              {activePreview.techPierceDamage > 0 && (
                <span className="font-bold text-rose-200">
                  +{activePreview.techPierceDamage} {t.previewTechPierce}
                </span>
              )}
              {activePreview.cleanseCorrodeAmount > 0 && (
                <span className="font-bold text-lime-300">
                  -{activePreview.cleanseCorrodeAmount} {t.previewCorrodeCleanse}
                </span>
              )}
              {activePreview.overdriveGained > 0 && (
                <span className="text-amber-200/90">
                  +{activePreview.overdriveGained}% {t.previewOverdrive}
                </span>
              )}
              {(activePreview.upchargeGained ?? 0) > 0 && (
                <span className="font-bold text-emerald-300">
                  · ⚡ +{activePreview.upchargeGained} {t.upchargeLabel}
                </span>
              )}
              <span className="text-slate-300">
                · {activePreview.stayCount} {t.previewStayCount}
              </span>
              {activePreview.surgeTriggered && (
                <span className="font-sans font-bold text-[#FFC700]">
                  · {t.previewSurgeTriggered}
                </span>
              )}
              {lockOutcomePreview?.willCrackPip && (
                <span className="font-sans font-bold text-cyan-200">
                  · ◆ {t.pipCrackLabel}
                </span>
              )}
              {lockOutcomePreview?.willTriggerPhaseGate && (
                <span className="font-sans font-bold text-amber-200">
                  · {t.phaseGateLabel}
                </span>
              )}
              {lockOutcomePreview?.triggersBioBurst && (
                <span className="font-sans font-bold text-lime-300">
                  · 💥 {t.bioBurstLabel}
                </span>
              )}
              {(lockOutcomePreview?.retaliateDamage ?? 0) > 0 && (
                <span className="font-sans font-bold text-rose-300">
                  · ⚠ -{lockOutcomePreview?.retaliateDamage} {t.retaliateLabel}
                </span>
              )}
              {(lockOutcomePreview?.pustuleRuptureCorrode ?? 0) > 0 && (
                <span
                  data-testid="dock-pustule-corrode-warning"
                  className="font-sans font-bold text-lime-300"
                >
                  · ☣ +{lockOutcomePreview?.pustuleRuptureCorrode} {t.corrodeLabel}
                </span>
              )}
              {(activePreview.blightPurgeCount ?? 0) > 0 && (
                <span className="font-sans font-bold text-lime-300">
                  · {t.blightTag} {t.purgeLabel} ×{activePreview.blightPurgeCount}
                </span>
              )}
              {(activePreview.hexedHealBonus ?? 0) > 0 && (
                <span className="font-sans font-bold text-purple-300">
                  · {t.hexTag} +{activePreview.hexedHealBonus} {t.hpLabel} / +{activePreview.hexedArmorBonus ?? 0} {t.armorShort}
                </span>
              )}
              {(lockOutcomePreview?.conditionalBonusDamage ?? 0) > 0 && (
                <span className="font-sans font-bold text-rose-300">
                  · ⚠ +{lockOutcomePreview?.conditionalBonusDamage} {t.condBonusLabel}
                </span>
              )}
              {(activePreview.hotPotatoPassedDamage ?? 0) > 0 && (
                <span className="font-sans font-bold text-amber-300">
                  · 💣 +{activePreview.hotPotatoPassedDamage} PIERCE
                </span>
              )}
              {(activePreview.temptationCleaveBonus ?? 0) > 0 && (
                <span className="font-sans font-bold text-fuchsia-300">
                  · ⚡ +{activePreview.temptationCleaveBonus} ALL (+2☣)
                </span>
              )}
              {(activePreview.contagionDiscardedCount ?? 0) > 0 && (
                <span className="font-sans font-bold text-lime-300">
                  · 🦠 -{activePreview.contagionDiscardedCount} ADJ
                </span>
              )}
            </div>
          )}

          {inspectedTile && (
            <span className="font-sans text-slate-200">
              · <strong className="text-white">{t.equipment[inspectedTile.sourceId]?.name ?? t.innateLabel}:</strong>{' '}
              {formatTileDetailText(inspectedTile, lang)}
              {inspectedTile.isJammed ? ` [${t.jammedTag}]` : ''}
              {inspectedTile.isBlight ? ` [${t.blightTag}]` : ''}
              {inspectedTile.hexedByEnemyId ? ` [${t.hexTag}]` : ''}
            </span>
          )}
        </div>
      ) : activeHint ? (
        <div
          data-testid="tactical-hint-banner"
          className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-amber-100"
        >
          <span className="font-mono-tabular font-extrabold text-[#FFC700] whitespace-nowrap">
            ★ {activeHint.headline}
          </span>
          <span className="text-slate-200 truncate">{activeHint.rationale}</span>
        </div>
      ) : onboardingPrompt ? (
        <div
          data-testid="dock-onboarding-prompt"
          className="flex flex-1 items-center gap-1.5 min-w-0 text-cyan-100"
        >
          <span className="truncate font-medium">{onboardingPrompt}</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-slate-200">
          <span className="font-semibold text-cyan-200 truncate">
            ★ {charMeta.passive}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-slate-500">
            ·
          </span>
          <span className="hidden sm:inline text-amber-200 truncate">
            ⚡ {charMeta.overdriveName}: {charMeta.overdriveDesc}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        {activePreview && selectedColor === activePreview.color && activePreview.tileCount > 0 && canPlay && (
          <button
            type="button"
            data-testid="dock-confirm-move-btn"
            onClick={() => {
              setInspectedTileId(null);
              onCommitColor(activePreview.color);
            }}
            className="chrome-btn-primary tactical-hc-border rounded-md px-2 py-0.5 text-[12px] sm:text-[13px] font-bold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap"
          >
            ✓ {t.resolveAction}
          </button>
        )}

        {onSwapEnemies && (
          <button
            type="button"
            data-testid="dock-swap-enemies-btn"
            disabled={!canPlay || !canSwapEnemies}
            onMouseEnter={() => {
              if (canPlay && canSwapEnemies) onHoverSwap?.(true);
            }}
            onMouseLeave={() => onHoverSwap?.(false)}
            onFocus={() => {
              if (canPlay && canSwapEnemies) onHoverSwap?.(true);
            }}
            onBlur={() => onHoverSwap?.(false)}
            onClick={() => {
              onHoverSwap?.(false);
              onSwapEnemies();
            }}
            title={
              lang === 'cs'
                ? 'Prohodí přední 2 nepřátele (0 AP). [R]'
                : 'Swap front 2 enemies (0 AP). [R]'
            }
            className={`chrome-pill rounded px-2 py-0.5 font-mono-tabular text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 ${
              canSwapEnemies && canPlay
                ? 'border-cyan-300/60 text-[#00F0FF] hover:border-white'
                : 'text-slate-400'
            }`}
          >
            ⇄ <span className="hidden sm:inline">{lang === 'cs' ? 'Posun' : 'Push'}</span>
          </button>
        )}

        {onToggleHint && (
          <button
            type="button"
            data-testid="dock-show-hint-btn"
            disabled={!canPlay || !hintsAllowed}
            onClick={onToggleHint}
            aria-pressed={Boolean(activeHint)}
            title={
              !hintsAllowed
                ? lang === 'cs'
                  ? 'Nápověda je na této obtížnosti vypnuta'
                  : 'Hints disabled on this difficulty tier'
                : lang === 'cs'
                  ? 'Zobrazit optimální tah [?]'
                  : 'Show Optimal Turn Hint [?]'
            }
            className={`chrome-pill rounded px-2 py-0.5 font-mono-tabular text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 ${
              activeHint
                ? 'border-[#FFC700] bg-amber-950/80 text-[#FFC700]'
                : 'text-amber-200 hover:border-amber-300'
            }`}
          >
            ? <span className="hidden sm:inline">{lang === 'cs' ? 'Tip' : 'Hint'}</span>
          </button>
        )}

        <button
          type="button"
          data-testid="dock-draw-pile-btn"
          onClick={() => setDrawPopoverOpen((prev) => !prev)}
          aria-expanded={drawPopoverOpen}
          title={`${t.nextDrawLabel} (${combat?.drawPile.length ?? 0})`}
          className={`chrome-pill rounded px-2 py-0.5 font-mono-tabular text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
            drawPopoverOpen
              ? 'border-[#00F0FF] bg-cyan-950/80 text-[#00F0FF]'
              : 'text-cyan-100 hover:border-cyan-300'
          }`}
        >
          ▤ {t.nextDrawLabel} ({combat?.drawPile.length ?? 0})
        </button>
      </div>
    </div>
  );

  const renderActionTriggers = () => (
    <div className="flex flex-col gap-1">
      <div
        className="grid grid-cols-3 gap-1"
        onMouseLeave={() => {
          onHoverColor(null);
          setInspectedTileId(null);
        }}
      >
        {(['attack', 'defense', 'tech'] as TileType[]).map((color) => {
          const count = countByColor[color];
          const summary = triggerSummaries[color];
          const isGroupActive = activeColor === color;
          const isSurgeReady = count >= surgeThreshold;
          const isHintRecommended = activeHint?.recommendedAction === color;
          const pip = getTileCornerPip(color);
          const label =
            color === 'attack'
              ? t.attackName
              : color === 'defense'
                ? t.defenseName
                : t.techName;
          const theme = TILE_THEME[color];
          const outcomeColorClass =
            summary.outcomeTone === 'kill'
              ? 'text-rose-200 bg-rose-500/35 border border-rose-300/60 px-1 rounded'
              : summary.outcomeTone === 'block'
                ? 'text-emerald-200 bg-emerald-500/30 border border-emerald-300/60 px-1 rounded'
                : summary.outcomeTone === 'stagger'
                  ? 'text-cyan-200 bg-cyan-500/30 border border-cyan-300/60 px-1 rounded'
                  : summary.outcomeTone === 'overdrive' || summary.outcomeTone === 'surge' || isSurgeReady
                    ? 'text-[#FFC700]'
                    : 'text-slate-300/80';

          return (
            <button
              key={color}
              type="button"
              aria-disabled={!canPlay || count === 0}
              data-testid={`action-trigger-${color}`}
              title={`${label} (×${count}): ${summary.mathFormula}${summary.outcomeTag ? ` · ${summary.outcomeTag}` : ''}`}
              onPointerDown={(e) => {
                lastPointerTypeRef.current = e.pointerType || 'mouse';
              }}
              onMouseEnter={() => {
                setInspectedTileId(null);
                onHoverColor(color);
              }}
              onFocus={() => onHoverColor(color)}
              onBlur={() => onHoverColor(null)}
              onClick={() => handleGroupActivate(color)}
              aria-pressed={selectedColor === color}
              className={`relative flex flex-col items-center justify-center overflow-hidden rounded-lg border px-1 transition-all duration-150 ${
                !canPlay || count === 0 ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
              } ${hcBorderClass} ${
                isCompactLandscape ? 'py-1 min-h-[44px]' : 'py-1.5 min-h-[54px]'
              } ${
                isGroupActive && count > 0
                  ? theme.activeRing
                  : isHintRecommended
                    ? 'ring-2 ring-[#FFC700] border-[#FFC700] shadow-[0_0_16px_rgba(255,199,0,0.45)] ' + theme.bg
                    : `${theme.border} ${theme.bg}`
              } ${theme.text}`}
            >
              {/* Double-Coding Corner Suit Pip */}
              <span
                aria-hidden="true"
                style={{ backgroundColor: pip.accentHex, color: '#020617' }}
                className="absolute left-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-sm border border-white font-mono-tabular text-[10px] font-black leading-none"
              >
                {pip.symbol}
              </span>
              {isHintRecommended && (
                <span
                  data-testid={`hint-badge-${color}`}
                  className="absolute right-1 top-1 rounded bg-[#FFC700] px-1 font-mono-tabular text-[9.5px] font-black uppercase leading-tight text-slate-950"
                >
                  ★
                </span>
              )}
              <div className="flex max-w-full items-center gap-1 pl-3.5 pr-1 font-mono-tabular text-[10.5px] sm:text-[12px] leading-none">
                <span className="hidden sm:inline opacity-80">[{theme.shortcut}]</span>
                <span className="truncate font-bold text-slate-200">{label}</span>
                <span className="shrink-0 font-bold text-white/90">×{count}</span>
              </div>
              <span
                data-testid={`action-trigger-math-${color}`}
                className="mt-0.5 max-w-full truncate whitespace-nowrap font-mono-tabular text-xs sm:text-sm font-black tracking-tight text-[#F4F4F6] tactical-numeral-stroke leading-tight"
              >
                {summary.mathFormula}
              </span>
              {lod.showMicroBadges && (
                <span
                  data-testid={`action-trigger-tag-${color}`}
                  className={`mt-0.5 font-mono-tabular text-[10px] font-extrabold uppercase tracking-wider leading-tight truncate max-w-full ${outcomeColorClass}`}
                >
                  {summary.outcomeTag
                    ? summary.outcomeTag
                    : isSurgeReady
                      ? t.surgeLabel.split(' ')[0]
                      : `${count}/${surgeThreshold}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canPlay || !overdriveReady}
        title={`${charMeta.overdriveName}: ${charMeta.overdriveDesc}`}
        onClick={onOverdrive}
        className={`relative w-full rounded-lg border px-2 font-bold transition-all whitespace-nowrap truncate cursor-pointer ${
          isCompactLandscape ? 'py-1 text-[12px]' : 'py-1.5 text-[13px]'
        } ${
          overdriveReady && canPlay
            ? 'border-white/80 bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.5)] hover:brightness-110'
            : 'border-white/15 bg-slate-950/60 text-slate-300 disabled:opacity-55'
        }`}
      >
        {activeHint?.recommendedAction === 'overdrive' && (
          <span
            data-testid="hint-badge-overdrive"
            className="mr-1 rounded bg-slate-950 px-1 font-mono-tabular text-[10px] font-black text-[#FFC700]"
          >
            ★ HINT
          </span>
        )}
        {charMeta.overdriveName} ({run.heroine.overdrive}/100)
        <span className="hidden sm:inline"> [Space]</span>
      </button>
    </div>
  );

  const renderTileBoard = () => (
    <div className="flex flex-col justify-center">
      <div
        className={`mb-1 flex items-center justify-between gap-2 px-0.5 font-mono-tabular ${
          isCompactLandscape ? 'text-[11px]' : 'text-[12px] sm:text-[13px]'
        } text-slate-200`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-cyan-200 truncate">{activeSurgeText}</span>
          {onOpenCodex && (
            <button
              type="button"
              data-testid="dock-surge-glossary-btn"
              onClick={() =>
                onOpenCodex('glossary', run.heroine.characterId ?? 'kira', 'stack_surge')
              }
              title={codexT.openTermHint}
              aria-label={`${t.surgeLabel}: ${codexT.openTermHint}`}
              className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-950/60 text-[11px] font-extrabold text-cyan-200 hover:border-cyan-200 hover:text-white cursor-pointer"
            >
              ?
            </button>
          )}
        </div>
        {run.heroine.damageBoostPct > 0 && (
          <span className="font-bold text-[#FFC700] whitespace-nowrap px-1">
            +{run.heroine.damageBoostPct}% DMG
          </span>
        )}
        {(run.heroine.pendingUpcharge ?? 0) > 0 && (
          <span className="font-bold text-emerald-300 whitespace-nowrap px-1">
            ⚡+{run.heroine.pendingUpcharge} {t.upchargeShort}
          </span>
        )}
        <span className="text-slate-300 whitespace-nowrap shrink-0">
          {combat?.board.length ?? 0}/{Math.min(9, 6 + (run.heroine.pendingUpcharge ?? 0))} · {t.poolTotalLabel}: {run.masterPool.length}
        </span>
      </div>

      <div
        className="grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(6, groupedBoard.length)}, minmax(0, 1fr))` }}
        onMouseLeave={() => {
          onHoverColor(null);
          setInspectedTileId(null);
        }}
      >
        {groupedBoard.map((tile) => {
          const isJammed = Boolean(tile.isJammed);
          const isBlight = Boolean(tile.isBlight);
          const isDud = Boolean(tile.isDud);
          const hasUpcharge = (tile.upcharge ?? 0) > 0;
          const isHexed = Boolean(
            tile.hexedByEnemyId &&
              combat?.enemies.some((e) => e.id === tile.hexedByEnemyId && e.hp > 0),
          );
          const isHighlighted = !isJammed && activeColor === tile.type;
          const isDimmed = isJammed || (activeColor !== null && activeColor !== tile.type);
          const theme = TILE_THEME[tile.type];
          const pip = getTileCornerPip(tile.type);
          const effective = getEffectiveTileValue(tile, run.heroine);
          const shortValue = isBlight
            ? '0'
            : isDud && effective.value === 0
              ? 'DUD'
              : lod.level === 'overview'
                ? tile.type === 'attack' || tile.type === 'defense'
                  ? `${effective.value}`
                  : formatTileShortLabel(tile, lang)
                : tile.type === 'attack'
                  ? `${t.atkShort} ${effective.value}`
                  : tile.type === 'defense'
                    ? `${t.defShort} ${effective.value}`
                    : formatTileShortLabel(tile, lang);
          const detailText = formatTileDetailText(tile, lang);
          const sourceLabel =
            tile.sourceId === 'innate'
              ? t.innateLabel
              : t.equipment[tile.sourceId]?.name ?? tile.sourceId;
          const techKind = tile.techEffect?.kind;
          const bottomLabel = isJammed
            ? t.jammedTag
            : isBlight
              ? t.purgeLabel
              : tile.type === 'tech'
                ? techKind === 'heal'
                  ? t.healShort
                  : techKind === 'armor_shred'
                    ? t.shredShort
                    : techKind === 'overdrive_surge'
                      ? t.odShort
                      : techKind === 'tactical_shield'
                        ? t.aegisShort
                        : 'BOOST'
                : tile.type === 'attack'
                  ? t.attackName
                  : t.defenseName;

          return (
            <button
              key={tile.id}
              type="button"
              aria-disabled={!canPlay || isJammed}
              data-testid={
                isJammed
                  ? `jammed-tile-${tile.id}`
                  : isBlight
                    ? `blight-tile-${tile.id}`
                    : isHexed
                      ? `hexed-tile-${tile.id}`
                      : `board-tile-${tile.id}`
              }
              data-tile-suit-pip={pip.symbol}
              title={`${pip.symbol} ${detailText} (${sourceLabel})${isJammed ? ` · ${t.jammedTag}` : ''}${
                isHexed ? ` · ${t.hexTag}` : ''
              }`}
              onPointerDown={(e) => {
                lastPointerTypeRef.current = e.pointerType || 'mouse';
              }}
              onMouseEnter={() => {
                setInspectedTileId(tile.id);
                if (!isJammed) onHoverColor(tile.type);
              }}
              onFocus={() => {
                setInspectedTileId(tile.id);
                if (!isJammed) onHoverColor(tile.type);
              }}
              onBlur={() => {
                setInspectedTileId(null);
                onHoverColor(null);
              }}
              onClick={() => {
                if (isJammed || !canPlay) {
                  soundEngine.playInvalidBuzz();
                  return;
                }
                handleGroupActivate(tile.type, tile.id);
              }}
              aria-pressed={selectedColor === tile.type && !isJammed}
              aria-label={`${pip.symbol} ${detailText} · ${sourceLabel} · ${
                isJammed
                  ? t.jammedTag
                  : isBlight
                    ? t.blightTag
                    : tile.isHeldFromPrevTurn
                      ? t.heldTag
                      : t.newTag
              }${isHexed ? ` · ${t.hexTag}` : ''}`}
              className={`relative flex flex-col items-center justify-between overflow-hidden rounded-lg border p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-150 ${
                !canPlay || isJammed ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${hcBorderClass} ${
                lod.level === 'closeup'
                  ? 'h-[76px] sm:h-[88px]'
                  : isCompactLandscape || isNarrowPortrait
                    ? 'h-[60px] sm:h-[66px]'
                    : hudMinimized
                      ? 'h-[60px] sm:h-[68px]'
                      : 'h-[68px] sm:h-[78px]'
              } ${
                isJammed
                  ? 'border-dashed border-lime-400/75 bg-slate-950/90'
                  : isBlight
                    ? isHighlighted
                      ? 'border-dashed border-lime-300 ring-2 ring-[#84CC16] bg-[#243310] -translate-y-0.5'
                      : 'border-dashed border-[#84CC16]/80 bg-[#1B240E]/90 hover:bg-[#233012]/95'
                    : isHighlighted
                      ? theme.activeRing
                      : `${theme.border} ${theme.bg}`
              } ${isHexed ? 'ring-2 ring-[#C084FC]/90 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : ''} ${
                isDimmed ? 'opacity-45' : 'opacity-100'
              }`}
            >
              {/* Top Row: Double-Coding Corner Suit Pip + Special State Badge (HELD / JAM / SLAG / HEX) */}
              <div className="flex w-full items-center justify-between gap-0.5 px-0.5 leading-none">
                <span className="flex min-w-0 flex-1 items-center gap-0.5">
                  <span
                    data-testid={`tile-pip-${tile.type}`}
                    style={{ backgroundColor: isBlight ? '#84CC16' : pip.accentHex, color: '#020617' }}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[10px] font-black leading-none"
                  >
                    {isBlight ? '☣' : pip.symbol}
                  </span>
                  {tile.secondaryType && (tile.secondaryValue ?? 0) > 0 && (
                    <span
                      data-testid={`spliced-badge-${tile.id}`}
                      style={{
                        backgroundColor: getTileCornerPip(tile.secondaryType).accentHex,
                        color: '#020617',
                      }}
                      className="inline-flex h-4 shrink-0 items-center justify-center rounded-sm border border-white/80 px-0.5 font-mono-tabular text-[9px] font-black leading-none"
                      title={
                        lang === 'cs'
                          ? `Sloučený dílek: +${tile.secondaryValue} ${tile.secondaryType.toUpperCase()}`
                          : `Hybrid Tile: +${tile.secondaryValue} ${tile.secondaryType.toUpperCase()}`
                      }
                    >
                      +{tile.secondaryValue}{getTileCornerPip(tile.secondaryType).symbol}
                    </span>
                  )}
                  {lod.showMicroBadges && (isJammed || isBlight || tile.isHeldFromPrevTurn) && (
                    <span
                      className={`min-w-0 truncate font-mono-tabular text-[9px] min-[460px]:text-[10px] font-bold uppercase tracking-tight sm:tracking-wider leading-none ${
                        isJammed
                          ? 'text-lime-300'
                          : isBlight
                            ? 'text-[#BEF264]'
                            : 'text-[#FFC700]'
                      }`}
                    >
                      {isJammed ? t.jammedTag : isBlight ? t.blightTag : t.heldTag}
                    </span>
                  )}
                </span>
                {isHexed ? (
                  <span className="shrink-0 rounded bg-purple-500/35 px-1 font-mono-tabular text-[10px] font-black text-purple-200 leading-tight">
                    ⬡
                  </span>
                ) : tile.isHotPotato ? (
                  <span
                    data-testid={`hot-potato-badge-${tile.id}`}
                    className="shrink-0 rounded bg-amber-500/35 px-1 font-mono-tabular text-[10px] font-black text-amber-200 leading-tight"
                  >
                    💣8
                  </span>
                ) : tile.isTemptation ? (
                  <span
                    data-testid={`temptation-badge-${tile.id}`}
                    className="shrink-0 rounded bg-fuchsia-500/35 px-1 font-mono-tabular text-[10px] font-black text-fuchsia-200 leading-tight"
                  >
                    ⚡+14
                  </span>
                ) : tile.isContagion ? (
                  <span
                    data-testid={`contagion-badge-${tile.id}`}
                    className="shrink-0 rounded bg-lime-500/35 px-1 font-mono-tabular text-[10px] font-black text-lime-200 leading-tight"
                  >
                    🦠
                  </span>
                ) : effective.flatBonus > 0 && !isJammed && !isBlight ? (
                  <span className="shrink-0 font-mono-tabular text-[10px] sm:text-[11px] font-extrabold text-emerald-300 leading-none">
                    +{effective.flatBonus}
                  </span>
                ) : null}
              </div>

              <div className="flex w-full flex-col items-center gap-1 my-auto">
                <TileGlyph
                  type={tile.type}
                  size={
                    lod.showLargeSilhouettes
                      ? 22
                      : isCompactLandscape || isNarrowPortrait
                        ? 16
                        : hudMinimized
                          ? 18
                          : 21
                  }
                />
                <span
                  className={`max-w-full truncate font-mono-tabular font-extrabold whitespace-nowrap leading-none tactical-numeral-stroke ${
                    lod.level === 'overview' || lod.level === 'closeup'
                      ? 'text-sm sm:text-base'
                      : 'text-[10.5px] min-[460px]:text-xs sm:text-[13.5px]'
                  } ${
                    isJammed
                      ? 'line-through text-slate-400'
                      : isBlight
                        ? 'text-lime-300'
                        : effective.flatBonus > 0
                          ? 'text-amber-100'
                          : 'text-[#F4F4F6]'
                  }`}
                >
                  {shortValue}
                </span>
              </div>

              {isJammed || isBlight ? (
                <span className="w-full truncate text-center text-[10px] sm:text-[11px] font-bold leading-none text-lime-300">
                  {bottomLabel}
                </span>
              ) : isHexed ? (
                <span className="w-full truncate text-center text-[10px] font-extrabold leading-none text-purple-200">
                  {t.hexTag}
                </span>
              ) : isDud || hasUpcharge ? (
                <span className="w-full truncate text-center font-mono-tabular text-[10px] font-extrabold leading-none text-emerald-300">
                  {isDud && run.heroine.characterId === 'aurelia'
                    ? `+1 ${t.upchargeShort}`
                    : hasUpcharge
                      ? `⚡+${tile.upcharge} ${t.upchargeShort}`
                      : t.dudTag}
                </span>
              ) : (
                <span className="h-0.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

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

  return (
    <section
      ref={dockRef}
      aria-label="Tactical Command Dock"
      className={`chrome-glass relative z-20 shrink-0 border-x-0 border-b-0 border-t border-cyan-300/40 ${
        isCompactLandscape ? 'px-2 py-1.5' : 'px-2.5 py-2 sm:px-4 sm:py-2.5'
      }`}
    >
      {/* Floating Upcoming Draws & Operative Reference Popover */}
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
        {renderTacticalIntelStrip()}

        {showHorizontalDock ? (
          <div className="grid grid-cols-12 items-center gap-2 sm:gap-3">
            <div className="col-span-4 lg:col-span-3">{renderActionTriggers()}</div>
            <div className="col-span-8 lg:col-span-9">{renderTileBoard()}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {renderTileBoard()}
            {renderActionTriggers()}
          </div>
        )}
      </div>
    </section>
  );
}
