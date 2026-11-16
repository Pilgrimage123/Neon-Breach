import { useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  getEffectiveTileValue,
  getSurgeThreshold,
  previewHeroineThreat,
  sortTilesByGroup,
} from '../engine/gameEngine';
import type { CharacterId, RunState, Tile, TileType, TurnPreview } from '../engine/types';
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
import { formatTileStreamlinedDescription } from '../utils/spatialMinimalistUi';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import type { CodexTab } from './CodexModal';
import { computeEnemyArmorPreview } from './combat/combatEnemyUi';
import type { LoupeInspectPayload } from './TacticalLoupeOverlay';
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
  canUndoTurn?: boolean;
  canResetEncounter?: boolean;
  canSwapEnemies?: boolean;
  activeHint?: OptimalMoveHint | null;
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
  onTogglePipMath?: () => void;
  onUndoTurn?: () => void;
  onResetEncounter?: () => void;
  onSwapEnemies?: () => void;
  onHoverSwap?: (hovering: boolean) => void;
  onToggleHint?: () => void;
  onInspectLoupe?: (payload: LoupeInspectPayload | null) => void;
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
  onTogglePipMath,
  onSwapEnemies,
  onHoverSwap,
  onToggleHint,
  onInspectLoupe,
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
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);

  const lastPointerTypeRef = useRef<string>('mouse');
  const holdTimerRef = useRef<number | null>(null);
  const isLoupeDraggingRef = useRef<boolean>(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const emitTileLoupe = (tile: Tile, clientX: number, clientY: number) => {
    if (!onInspectLoupe) return;
    const pip = getTileCornerPip(tile.type);
    const effective = getEffectiveTileValue(tile, run.heroine);
    const detailText = formatTileDetailText(tile, lang);
    const sourceLabel =
      tile.sourceId === 'innate'
        ? t.innateLabel
        : t.equipment[tile.sourceId]?.name ?? tile.sourceId;
    const groupCount = countByColor[tile.type];
    const streamlined = formatTileStreamlinedDescription(tile, effective.value, lang);

    onInspectLoupe({
      id: tile.id,
      pip,
      kicker: `${pip.shortCode} · ${sourceLabel}`,
      title: detailText,
      primaryStat: streamlined.mathFormula,
      subtitle: `${groupCount}/${surgeThreshold} ${t.surgeLabel}`,
      detailLine: streamlined.shortRule,
      ruleBadge: tile.isJammed
        ? t.jammedTag
        : tile.isBlight
          ? t.blightTag
          : tile.hexedByEnemyId
            ? t.hexTag
            : groupCount >= surgeThreshold
              ? `⚡ ${t.previewSurgeTriggered}`
              : `${groupCount}/${surgeThreshold} SURGE`,
      pointerX: clientX,
      pointerY: clientY,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      keywords: streamlined.keywords,
      lang,
    });
  };

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
    const triggersBioBurst = Boolean(
      frontEnemy &&
        frontPreview &&
        frontPreview.willDie &&
        frontEnemy.passive === 'volatile_burst' &&
        combat.enemies.some((e, idx) => idx !== frontIdx && e.hp > 0),
    );
    return {
      willCrackPip: Boolean(frontPreview?.willCrackShieldPip),
      willTriggerPhaseGate: Boolean(frontPreview?.willTriggerPhaseGate),
      triggersBioBurst,
      retaliateDamage: threat.retaliateDamage,
      conditionalBonusDamage: threat.conditionalBonusDamage ?? 0,
      hexHealTriggered: threat.hexHealTriggered ?? 0,
    };
  }, [activePreview, combat, run.heroine]);

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
  const showSideNextDraw = effectiveWidth >= 960 && !hudMinimized && !isNarrowPortrait;
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
      className={`mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-slate-950/65 px-2.5 ${
        isCompactLandscape ? 'min-h-[24px] py-0.5 text-[10px]' : 'min-h-[28px] py-1 text-[11px]'
      }`}
    >
      {activePreview ? (
        <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
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

      <div className="flex items-center gap-1 shrink-0">
        {activePreview && selectedColor === activePreview.color && activePreview.tileCount > 0 && canPlay && (
          <button
            type="button"
            data-testid="dock-confirm-move-btn"
            onClick={() => {
              setInspectedTileId(null);
              onCommitColor(activePreview.color);
            }}
            className="chrome-btn-primary tactical-hc-border rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap"
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
                ? 'Posun 1 pole. Uděl 2 poškození. [R]'
                : 'Push 1 tile. Deal 2 damage. [R]'
            }
            className={`chrome-pill rounded px-1.5 py-0.5 font-mono-tabular text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 ${
              canSwapEnemies && canPlay
                ? 'border-cyan-300/60 text-[#00F0FF] hover:border-white'
                : 'text-slate-400'
            }`}
          >
            ⇄ {lang === 'cs' ? 'Posun' : 'Push'}
          </button>
        )}

        {onToggleHint && (
          <button
            type="button"
            data-testid="dock-show-hint-btn"
            disabled={!canPlay}
            onClick={onToggleHint}
            aria-pressed={Boolean(activeHint)}
            title={
              lang === 'cs'
                ? 'Zobrazit optimální tah a taktické zdůvodnění [?]'
                : 'Show Optimal Turn Hint & Rationale [?]'
            }
            className={`chrome-pill rounded px-1.5 py-0.5 font-mono-tabular text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 ${
              activeHint
                ? 'border-[#FFC700] bg-amber-950/80 text-[#FFC700]'
                : 'text-amber-200 hover:border-amber-300'
            }`}
          >
            ? {lang === 'cs' ? 'Tip' : 'Hint'}
          </button>
        )}

        {onTogglePipMath && (
          <button
            type="button"
            data-testid="dock-pip-math-toggle"
            onClick={onTogglePipMath}
            aria-pressed={pipMathMode}
            title={
              lang === 'cs'
                ? 'Přepnout malé diskrétní počty (1 Pip = 5 HP/DMG)'
                : 'Toggle Small-Number Discrete Pip Math (1 Pip = 5 HP/DMG)'
            }
            className={`chrome-pill rounded px-1.5 py-0.5 font-mono-tabular text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              pipMathMode
                ? 'border-emerald-300 bg-emerald-950/80 text-emerald-200'
                : 'text-slate-300 hover:border-emerald-300/60'
            }`}
          >
            1P=5
          </button>
        )}

        {!showSideNextDraw && (
          <button
            type="button"
            onClick={() => setInfoDrawerOpen((prev) => !prev)}
            aria-expanded={infoDrawerOpen}
            className={`chrome-pill rounded px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              infoDrawerOpen ? 'border-[#00F0FF] text-[#00F0FF]' : 'text-cyan-100 hover:border-cyan-300'
            }`}
          >
            {t.tacticalInfoButton} · {combat?.drawPile.length ?? 0}
          </button>
        )}
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
          return (
            <button
              key={color}
              type="button"
              disabled={!canPlay || count === 0}
              data-testid={`action-trigger-${color}`}
              onPointerDown={(e) => {
                lastPointerTypeRef.current = e.pointerType || 'mouse';
                if (count === 0) {
                  soundEngine.playInvalidBuzz();
                }
              }}
              onMouseEnter={() => {
                setInspectedTileId(null);
                onHoverColor(color);
              }}
              onFocus={() => onHoverColor(color)}
              onBlur={() => onHoverColor(null)}
              onClick={() => handleGroupActivate(color)}
              aria-pressed={selectedColor === color}
              className={`relative flex flex-col items-center justify-center rounded-lg border px-1 transition-all duration-150 disabled:opacity-35 cursor-pointer ${hcBorderClass} ${
                isCompactLandscape ? 'py-1 min-h-[38px]' : 'py-1.5 min-h-[44px]'
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
                className="absolute left-1 top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-white font-mono-tabular text-[8px] font-black leading-none"
              >
                {pip.symbol}
              </span>
              {isHintRecommended && (
                <span
                  data-testid={`hint-badge-${color}`}
                  className="absolute right-1 top-1 rounded bg-[#FFC700] px-1 font-mono-tabular text-[7px] font-black uppercase leading-tight text-slate-950"
                >
                  ★
                </span>
              )}
              <div className="flex items-center gap-0.5 font-mono-tabular text-[9px] sm:text-[10px] leading-none">
                <span className="hidden sm:inline opacity-80">[{theme.shortcut}]</span>
                <span className="font-bold text-white tactical-numeral-stroke">×{count}</span>
              </div>
              <span className="mt-0.5 whitespace-nowrap text-[10px] sm:text-[11px] font-bold tracking-wide leading-tight">
                {label}
              </span>
              {lod.showMicroBadges && (
                <span
                  className={`font-mono-tabular text-[8px] font-bold uppercase tracking-wider leading-none ${
                    isSurgeReady ? 'text-[#FFC700]' : 'text-slate-300/75'
                  }`}
                >
                  {isSurgeReady
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
          isCompactLandscape ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'
        } ${
          overdriveReady && canPlay
            ? 'border-white/80 bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.5)] hover:brightness-110'
            : 'border-white/15 bg-slate-950/60 text-slate-300 disabled:opacity-55'
        }`}
      >
        {activeHint?.recommendedAction === 'overdrive' && (
          <span
            data-testid="hint-badge-overdrive"
            className="mr-1 rounded bg-slate-950 px-1 font-mono-tabular text-[8px] font-black text-[#FFC700]"
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
          isCompactLandscape ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'
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
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-950/60 text-[9px] font-extrabold text-cyan-200 hover:border-cyan-200 hover:text-white cursor-pointer"
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
        <span className="text-slate-300 whitespace-nowrap shrink-0">
          {combat?.board.length ?? 0}/6 · {t.poolTotalLabel}: {run.masterPool.length}
        </span>
      </div>

      <div
        className="grid grid-cols-6 gap-1 sm:gap-1.5"
        onMouseLeave={() => {
          onHoverColor(null);
          setInspectedTileId(null);
        }}
        onPointerMove={(e) => {
          if (!isLoupeDraggingRef.current || !board) return;
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const tileBtn = el?.closest('[data-loupe-tile-id]') as HTMLElement | null;
          const tid = tileBtn?.dataset.loupeTileId;
          if (tid) {
            const found = board.find((b) => b.id === tid);
            if (found) {
              emitTileLoupe(found, e.clientX, e.clientY);
            }
          }
        }}
        onPointerUp={() => {
          clearHoldTimer();
          isLoupeDraggingRef.current = false;
        }}
        onPointerCancel={() => {
          clearHoldTimer();
          isLoupeDraggingRef.current = false;
        }}
      >
        {groupedBoard.map((tile) => {
          const isJammed = Boolean(tile.isJammed);
          const isBlight = Boolean(tile.isBlight);
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
              disabled={!canPlay || isJammed}
              data-testid={
                isJammed
                  ? `jammed-tile-${tile.id}`
                  : isBlight
                    ? `blight-tile-${tile.id}`
                    : isHexed
                      ? `hexed-tile-${tile.id}`
                      : `board-tile-${tile.id}`
              }
              data-loupe-tile-id={tile.id}
              data-tile-suit-pip={pip.symbol}
              title={`${pip.symbol} ${detailText} (${sourceLabel})${isJammed ? ` · ${t.jammedTag}` : ''}${
                isHexed ? ` · ${t.hexTag}` : ''
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                emitTileLoupe(tile, e.clientX, e.clientY);
              }}
              onPointerDown={(e) => {
                lastPointerTypeRef.current = e.pointerType || 'mouse';
                if (isJammed) {
                  soundEngine.playInvalidBuzz();
                }
                clearHoldTimer();
                const cx = e.clientX;
                const cy = e.clientY;
                holdTimerRef.current = window.setTimeout(() => {
                  isLoupeDraggingRef.current = true;
                  emitTileLoupe(tile, cx, cy);
                }, 300);
              }}
              onPointerUp={clearHoldTimer}
              onPointerCancel={clearHoldTimer}
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
                if (isLoupeDraggingRef.current) {
                  isLoupeDraggingRef.current = false;
                  return;
                }
                if (!isJammed) handleGroupActivate(tile.type, tile.id);
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
              className={`relative flex flex-col items-center justify-between rounded-lg border p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-150 cursor-pointer ${hcBorderClass} ${
                lod.level === 'closeup'
                  ? 'h-[72px] sm:h-[84px]'
                  : isCompactLandscape || isNarrowPortrait
                    ? 'h-[56px] sm:h-[62px]'
                    : hudMinimized
                      ? 'h-14 sm:h-16'
                      : 'h-16 sm:h-[74px]'
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
              } disabled:cursor-not-allowed`}
            >
              {/* Top Row: Double-Coding Corner Suit Pip + Special State Badge (HELD / JAM / SLAG / HEX) */}
              <div className="flex w-full items-center justify-between px-0.5 leading-none">
                <span className="flex items-center gap-0.5">
                  <span
                    data-testid={`tile-pip-${tile.type}`}
                    style={{ backgroundColor: isBlight ? '#84CC16' : pip.accentHex, color: '#020617' }}
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[8px] font-black leading-none"
                  >
                    {isBlight ? '☣' : pip.symbol}
                  </span>
                  {lod.showMicroBadges && (isJammed || isBlight || tile.isHeldFromPrevTurn) && (
                    <span
                      className={`font-mono-tabular text-[8px] font-bold uppercase tracking-wider leading-none ${
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
                  <span className="rounded bg-purple-500/35 px-1 font-mono-tabular text-[8px] font-black text-purple-200 leading-tight">
                    ⬡
                  </span>
                ) : effective.flatBonus > 0 && !isJammed && !isBlight ? (
                  <span className="font-mono-tabular text-[8px] sm:text-[9px] font-extrabold text-emerald-300 leading-none">
                    +{effective.flatBonus}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-1 my-auto">
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
                  className={`font-mono-tabular font-extrabold whitespace-nowrap leading-none tactical-numeral-stroke ${
                    lod.level === 'overview' || lod.level === 'closeup'
                      ? 'text-sm sm:text-base'
                      : 'text-xs sm:text-[13px]'
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
                <span className="w-full truncate text-center text-[8px] sm:text-[9px] font-bold leading-none text-lime-300">
                  {bottomLabel}
                </span>
              ) : isHexed ? (
                <span className="w-full truncate text-center text-[8px] font-extrabold leading-none text-purple-200">
                  {t.hexTag}
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
      <div className="flex items-center justify-between text-[10px] font-mono-tabular">
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
              onContextMenu={(e) => {
                e.preventDefault();
                emitTileLoupe(tile, e.clientX, e.clientY);
              }}
              className={`relative flex flex-col items-center justify-center overflow-hidden rounded border ${
                tile.isBlight
                  ? 'border-dashed border-[#84CC16]/80 bg-[#1B240E]/90'
                  : `${TILE_THEME[tile.type].border} bg-slate-950/80`
              } px-0.5 ${hcBorderClass} ${isCompactLandscape ? 'h-9' : 'h-10 sm:h-11'}`}
            >
              <span
                aria-hidden="true"
                style={{ color: tile.isBlight ? '#84CC16' : pip.accentHex }}
                className="absolute left-0.5 top-0.5 font-mono-tabular text-[7px] font-black leading-none"
              >
                {tile.isBlight ? '☣' : pip.symbol}
              </span>
              <TileGlyph type={tile.type} size={13} />
              <span
                className={`mt-0.5 w-full truncate text-center text-[8px] sm:text-[9px] font-mono-tabular font-bold leading-none ${
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
      aria-label="Tactical Command Dock"
      className={`chrome-glass relative z-20 shrink-0 border-x-0 border-b-0 border-t border-cyan-300/40 ${
        isCompactLandscape ? 'px-2 py-1.5' : 'px-2.5 py-2 sm:px-4 sm:py-2.5'
      }`}
    >
      {/* Expandable Tactical Info & Upcoming Draws Panel on Compact Screens */}
      {!showSideNextDraw && infoDrawerOpen && (
        <div className="chrome-panel-bright absolute inset-x-2 bottom-full mb-1.5 z-40 mx-auto max-w-2xl rounded-xl p-2.5 text-xs shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
            <span className="font-display font-bold text-[#00F0FF]">
              {charMeta.code} · {t.tacticalInfoButton}
            </span>
            <div className="flex items-center gap-1.5">
              {onOpenCodex && (
                <button
                  type="button"
                  onClick={() => {
                    setInfoDrawerOpen(false);
                    onOpenCodex('heroes', run.heroine.characterId ?? 'kira', null);
                  }}
                  className="chrome-pill rounded border-cyan-300/50 px-2 py-0.5 text-[10px] font-bold text-[#00F0FF] cursor-pointer"
                >
                  {codexT.inspectHeroDossierBtn}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInfoDrawerOpen(false)}
                className="chrome-pill rounded px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
              >
                {t.closeLabel}
              </button>
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1 text-[11px]">
              <div>
                <span className="font-bold text-cyan-200">{t.passiveLabel}:</span> {charMeta.passive}
              </div>
              <div>
                <span className="font-bold text-amber-200">{charMeta.overdriveName}:</span>{' '}
                {charMeta.overdriveDesc}
              </div>
              <div className="text-[10px] text-slate-200">
                <span className="font-bold text-rose-200">{t.attackName} ({surgeThreshold}+):</span>{' '}
                {t.surgeAttackEffect} ·{' '}
                <span className="font-bold text-cyan-200">{t.defenseName}:</span>{' '}
                {t.surgeDefenseEffect} ·{' '}
                <span className="font-bold text-amber-200">{t.techName}:</span>{' '}
                {t.surgeTechEffect}
              </div>
            </div>
            <div>{renderNextDrawPanel()}</div>
          </div>
        </div>
      )}

      <div className={`mx-auto ${hudMinimized ? 'max-w-4xl' : 'max-w-6xl'}`}>
        {renderTacticalIntelStrip()}

        {showHorizontalDock ? (
          <div className="grid grid-cols-12 items-center gap-2">
            <div
              className={
                showSideNextDraw
                  ? 'col-span-3'
                  : hudMinimized
                    ? 'col-span-4'
                    : 'col-span-4'
              }
            >
              {renderActionTriggers()}
            </div>

            <div
              className={
                showSideNextDraw
                  ? 'col-span-6'
                  : hudMinimized
                    ? 'col-span-8'
                    : 'col-span-8'
              }
            >
              {renderTileBoard()}
            </div>

            {showSideNextDraw && <div className="col-span-3">{renderNextDrawPanel()}</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {renderTileBoard()}
            {renderActionTriggers()}
            {!hudMinimized && renderNextDrawPanel()}
          </div>
        )}
      </div>
    </section>
  );
}
