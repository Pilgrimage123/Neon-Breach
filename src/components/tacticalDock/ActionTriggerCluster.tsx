import type { MutableRefObject } from 'react';
import type { TileType } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import {
  getTileCornerPip,
  type SemanticZoomLoD,
} from '../../utils/accessibilityAndScale';
import type { ActionTriggerSummary } from '../../utils/spatialMinimalistUi';
import type { OptimalMoveHint } from '../../utils/tacticalSandboxAndHints';
import { TILE_THEME } from './TacticalIntelStrip';

export interface ActionTriggerClusterProps {
  lang: Language;
  canPlay: boolean;
  isCompactLandscape: boolean;
  lod: SemanticZoomLoD;
  hcBorderClass: string;
  activeColor: TileType | null;
  selectedColor: TileType | null;
  countByColor: Record<TileType, number>;
  triggerSummaries: Record<TileType, ActionTriggerSummary>;
  surgeThreshold: number;
  activeHint: OptimalMoveHint | null;
  overdriveReady: boolean;
  overdriveValue: number;
  charOverdriveName: string;
  charOverdriveDesc: string;
  lastPointerTypeRef: MutableRefObject<string>;
  onHoverColor: (color: TileType | null) => void;
  onInspectTile: (tileId: string | null) => void;
  onActivateGroup: (color: TileType) => void;
  onOverdrive: () => void;
}

export function ActionTriggerCluster({
  lang,
  canPlay,
  isCompactLandscape,
  lod,
  hcBorderClass,
  activeColor,
  selectedColor,
  countByColor,
  triggerSummaries,
  surgeThreshold,
  activeHint,
  overdriveReady,
  overdriveValue,
  charOverdriveName,
  charOverdriveDesc,
  lastPointerTypeRef,
  onHoverColor,
  onInspectTile,
  onActivateGroup,
  onOverdrive,
}: ActionTriggerClusterProps) {
  const t = TRANSLATIONS[lang];

  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid grid-cols-3 gap-1"
        onMouseLeave={() => {
          onHoverColor(null);
          onInspectTile(null);
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
                onInspectTile(null);
                onHoverColor(color);
              }}
              onFocus={() => onHoverColor(color)}
              onBlur={() => onHoverColor(null)}
              onClick={() => onActivateGroup(color)}
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
              <div className="flex max-w-full items-center gap-0.5 pl-4 pr-0.5 font-mono-tabular text-[10.5px] sm:text-[11.5px] leading-none">
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
        title={`${charOverdriveName}: ${charOverdriveDesc}`}
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
            {lang === 'cs' ? '★ TIP' : '★ HINT'}
          </span>
        )}
        {charOverdriveName} ({overdriveValue}/100)
        <span className="hidden sm:inline">{lang === 'cs' ? ' [Mezerník]' : ' [Space]'}</span>
      </button>
    </div>
  );
}
