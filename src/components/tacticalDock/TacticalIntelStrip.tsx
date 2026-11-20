import type { Tile, TileType, TurnPreview } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import {
  formatDiscretePipMath,
  type OptimalMoveHint,
} from '../../utils/tacticalSandboxAndHints';
import { formatTileDetailText } from '../../utils/tileDisplay';

export const TILE_THEME: Record<
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

export interface LockOutcomePreview {
  willCrackPip: boolean;
  willTriggerPhaseGate: boolean;
  triggersBioBurst: boolean;
  retaliateDamage: number;
  pustuleRuptureCorrode: number;
  conditionalBonusDamage: number;
  hexHealTriggered: number;
}

export interface TacticalIntelStripProps {
  lang: Language;
  isCompactLandscape: boolean;
  activePreview: TurnPreview | null;
  selectedColor: TileType | null;
  canPlay: boolean;
  pipMathMode: boolean;
  lockOutcomePreview: LockOutcomePreview | null;
  inspectedTile: Tile | null;
  activeHint: OptimalMoveHint | null;
  hintsAllowed: boolean;
  onboardingPrompt: string | null;
  charPassive: string;
  charOverdriveName: string;
  charOverdriveDesc: string;
  canSwapEnemies: boolean;
  drawPileCount: number;
  drawPopoverOpen: boolean;
  onConfirmMove: (color: TileType) => void;
  onSwapEnemies?: () => void;
  onHoverSwap?: (hovering: boolean) => void;
  onToggleHint?: () => void;
  onToggleDrawPopover: () => void;
}

export function TacticalIntelStrip({
  lang,
  isCompactLandscape,
  activePreview,
  selectedColor,
  canPlay,
  pipMathMode,
  lockOutcomePreview,
  inspectedTile,
  activeHint,
  hintsAllowed,
  onboardingPrompt,
  charPassive,
  charOverdriveName,
  charOverdriveDesc,
  canSwapEnemies,
  drawPileCount,
  drawPopoverOpen,
  onConfirmMove,
  onSwapEnemies,
  onHoverSwap,
  onToggleHint,
  onToggleDrawPopover,
}: TacticalIntelStripProps) {
  const t = TRANSLATIONS[lang];

  return (
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
            ★ {charPassive}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-slate-500">
            ·
          </span>
          <span className="hidden sm:inline text-amber-200 truncate">
            ⚡ {charOverdriveName}: {charOverdriveDesc}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        {activePreview && selectedColor === activePreview.color && activePreview.tileCount > 0 && canPlay && (
          <button
            type="button"
            data-testid="dock-confirm-move-btn"
            onClick={() => onConfirmMove(activePreview.color)}
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
            ⇄ <span className="hidden sm:inline">{lang === 'cs' ? 'Prohoz' : 'Push'}</span>
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
          onClick={onToggleDrawPopover}
          aria-expanded={drawPopoverOpen}
          title={`${t.nextDrawLabel} (${drawPileCount})`}
          className={`chrome-pill rounded px-2 py-0.5 font-mono-tabular text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
            drawPopoverOpen
              ? 'border-[#00F0FF] bg-cyan-950/80 text-[#00F0FF]'
              : 'text-cyan-100 hover:border-cyan-300'
          }`}
        >
          ▤ {t.nextDrawLabel} ({drawPileCount})
        </button>
      </div>
    </div>
  );
}
