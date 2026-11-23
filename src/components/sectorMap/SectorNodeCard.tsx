import type { MutableRefObject } from 'react';
import { MAX_IMPLANTS } from '../../engine/data';
import {
  getNodeEconomyMetrics,
  getNodeEncounterIntel,
  getReconPreviewForNode,
  type NodeEncounterIntel,
} from '../../engine/mapTacticalIntel';
import { getEquippedChipMemory } from '../../engine/poolBuilder';
import type { MapNode, MapNodeType, RunState } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import {
  getNodeCornerPip,
  type SemanticZoomLoD,
} from '../../utils/accessibilityAndScale';
import {
  DISTRICT_BADGE_LABELS,
  NODE_STYLE,
  getNodeRewardLabel,
} from './sectorMapTheme';

export function NodeEmblem({ type }: { type: MapNodeType }) {
  if (type === 'COMBAT') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF2E7E" strokeWidth="2.2" aria-hidden="true">
        <path d="M5 19L19 5M14 5H19V10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10V5H10" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      </svg>
    );
  }
  if (type === 'ELITE') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFC700" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 2.5L20.5 12L12 21.5L3.5 12L12 2.5Z" />
        <circle cx="12" cy="12" r="2.8" fill="#FFC700" />
      </svg>
    );
  }
  if (type === 'CYBER_CLINIC') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.2" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8V16M8 12H16" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'CHIP_DEALER') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 2V6M15 2V6M9 18V22M15 18V22M2 9H6M2 15H6M18 9H22M18 15H22" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'MED_BAY') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 4.5C15.2 8.8 18.2 11.4 18.2 14.6A6.2 6.2 0 0 1 5.8 14.6C5.8 11.4 8.8 8.8 12 4.5Z" />
      </svg>
    );
  }
  if (type === 'EVENT') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="17" r="1" fill="#C084FC" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#84CC16" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 2.5L21 8.5L17.2 20H6.8L3 8.5L12 2.5Z" />
      <circle cx="9.5" cy="12" r="1.4" fill="#84CC16" />
      <circle cx="14.5" cy="12" r="1.4" fill="#84CC16" />
    </svg>
  );
}

export interface SectorNodeCardProps {
  node: MapNode;
  run: RunState;
  lang: Language;
  maxLayer: number;
  totalCols: number;
  isAvailable: boolean;
  availIndex: number;
  isCurrent: boolean;
  isKeyboardFocused: boolean;
  isRecommended: boolean;
  isInspected: boolean;
  isMultiHopPath: boolean;
  isDownstreamFromFocus: boolean;
  isUnreachableLocked: boolean;
  hasRecon: boolean;
  intel?: NodeEncounterIntel;
  lod: SemanticZoomLoD;
  hcBorderClass: string;
  isCompactLandscape: boolean;
  twoStepConfirm: boolean;
  selectedIdx: number;
  lastPointerTypeRef: MutableRefObject<string>;
  onHoverOrFocus: (availIndex: number, nodeId: string) => void;
  onSelectAvailable: (nodeId: string) => void;
  onInspectNode: (nodeId: string) => void;
  onFocusAvailableIndex: (availIndex: number) => void;
}

export function SectorNodeCard({
  node,
  run,
  lang,
  maxLayer,
  isAvailable,
  availIndex,
  isCurrent,
  isKeyboardFocused,
  isRecommended,
  isInspected,
  isMultiHopPath,
  isDownstreamFromFocus,
  isUnreachableLocked,
  hasRecon,
  intel: intelProp,
  lod,
  hcBorderClass,
  isCompactLandscape,
  twoStepConfirm,
  selectedIdx,
  lastPointerTypeRef,
  onHoverOrFocus,
  onSelectAvailable,
  onInspectNode,
  onFocusAvailableIndex,
}: SectorNodeCardProps) {
  const t = TRANSLATIONS[lang];
  const difficultyTier = run.difficultyTier ?? 3;
  const style = NODE_STYLE[node.type];
  const intel =
    intelProp ?? getNodeEncounterIntel(node, run.seed, lang, difficultyTier);
  const econ = getNodeEconomyMetrics(node, run.hero, lang, difficultyTier);

  const statusLabel = isCurrent
    ? lang === 'cs'
      ? '● ZDE'
      : '● HERE'
    : node.cleared
      ? '✓'
      : isRecommended
        ? `★ ${availIndex + 1}`
        : isAvailable
          ? `[${availIndex + 1}]`
          : isMultiHopPath
            ? '→'
            : isDownstreamFromFocus
              ? '·'
              : t.nodeLocked;

  const reconPreview = hasRecon ? getReconPreviewForNode(node, run, lang) : null;

  const squadNames =
    intel.enemies.length > 0
      ? intel.enemies.map((e) => t.enemies[e.archetype].name).join(' + ')
      : reconPreview?.kind === 'event'
        ? reconPreview.eventTitle
        : t.nodeDescs[node.type];

  const bottomMetric =
    intel.totalEnemyHp > 0
      ? `${intel.enemies.length}x · ${intel.totalEnemyHp} HP`
      : node.type === 'CYBER_CLINIC'
        ? `${t.implantSlotsLabel} ${run.hero.implants.length}/${MAX_IMPLANTS}`
        : node.type === 'CHIP_DEALER'
          ? `${t.capacityLabel} ${getEquippedChipMemory(run.hero)}/${run.hero.memoryCapacity}`
          : node.type === 'EVENT'
            ? reconPreview?.kind === 'event'
              ? t.reconPreviewPrefix
              : t.mapAnomalyLabel
            : `${t.hpLabel} ${run.hero.hp}/${run.hero.maxHp}`;

  const minShopCredits = node.modifier === 'flash_sale' ? 20 : 30;
  const nodePip = getNodeCornerPip(node.type);

  const highSignalBadges: Array<{ key: string; label: string; className: string }> = [];
  if (node.modifier === 'golden_bounty') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyGoldenBadge,
      className: 'bg-amber-400/25 border-amber-300/60 text-amber-300',
    });
  } else if (node.modifier === 'double_credits') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyDoubleBadge,
      className: 'bg-emerald-400/25 border-emerald-300/60 text-emerald-300',
    });
  } else if (node.modifier === 'nanite_cache') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyNaniteBadge,
      className: 'bg-cyan-400/25 border-cyan-300/60 text-cyan-300',
    });
  } else if (node.modifier === 'overcharged_hazard') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyOverchargedBadge,
      className: 'bg-rose-500/25 border-rose-400/60 text-rose-300',
    });
  } else if (node.modifier === 'flash_sale') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyFlashSaleBadge,
      className: 'bg-amber-400/25 border-amber-300/60 text-amber-300 animate-pulse',
    });
  } else if (node.modifier === 'funded_clinic') {
    highSignalBadges.push({
      key: 'mod',
      label: t.bountyFundedClinicBadge,
      className: 'bg-emerald-400/25 border-emerald-300/60 text-emerald-300',
    });
  }

  if (
    highSignalBadges.length < 2 &&
    node.districtBadge &&
    DISTRICT_BADGE_LABELS[node.districtBadge]
  ) {
    const badgeSpec = DISTRICT_BADGE_LABELS[node.districtBadge];
    highSignalBadges.push({
      key: 'district',
      label: lang === 'cs' ? badgeSpec.cs : badgeSpec.en,
      className: badgeSpec.colorClass,
    });
  }

  if (
    highSignalBadges.length < 2 &&
    (node.type === 'CHIP_DEALER' || node.type === 'CYBER_CLINIC')
  ) {
    highSignalBadges.push({
      key: 'shop',
      label:
        run.hero.credits >= minShopCredits
          ? `${t.shopAffordable} (${minShopCredits}+ CR)`
          : t.shopLowCredits,
      className:
        run.hero.credits >= minShopCredits
          ? 'bg-emerald-400/20 border-emerald-400/50 text-emerald-300'
          : 'bg-amber-400/20 border-amber-400/50 text-amber-300',
    });
  }

  return (
    <button
      type="button"
      disabled={false}
      data-testid={`map-node-${node.id}`}
      data-node-pip={nodePip.symbol}
      onPointerDown={(e) => {
        lastPointerTypeRef.current = e.pointerType || 'mouse';
      }}
      onMouseEnter={() => onHoverOrFocus(availIndex, node.id)}
      onFocus={() => onHoverOrFocus(availIndex, node.id)}
      onClick={() => {
        const isTouch = lastPointerTypeRef.current === 'touch';
        lastPointerTypeRef.current = 'mouse';
        if (isAvailable) {
          if ((isTouch || twoStepConfirm) && availIndex >= 0 && selectedIdx !== availIndex) {
            onFocusAvailableIndex(availIndex);
            return;
          }
          onSelectAvailable(node.id);
        } else {
          onInspectNode(node.id);
        }
      }}
      className={`group relative flex h-full w-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border ${hcBorderClass} ${
        isCompactLandscape ? 'px-2.5 py-1.5' : 'px-3 py-2'
      } text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-all duration-150 ${
        isAvailable
          ? `${style.border} ${style.bg} ${
              isKeyboardFocused
                ? 'ring-2 ring-[#FFC700] shadow-[0_0_26px_rgba(255,199,0,0.42),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5'
                : 'ring-1 ring-[#00F0FF]/85 shadow-[0_0_18px_rgba(0,240,255,0.26)]'
            } hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,240,255,0.42)] cursor-pointer`
          : isCurrent
            ? 'border-[#FFC700] bg-gradient-to-b from-[#2A2610]/95 to-[#171B36]/95 ring-2 ring-[#FFC700]/80 shadow-[0_0_24px_rgba(255,199,0,0.32)]'
            : isInspected
              ? `${style.border} ring-2 ring-purple-400 bg-purple-950/45 shadow-[0_0_22px_rgba(192,132,252,0.38)] cursor-pointer`
              : isMultiHopPath
                ? `${style.border} ring-1 ring-cyan-300 bg-cyan-950/40 shadow-[0_0_18px_rgba(0,240,255,0.25)] cursor-pointer`
                : node.cleared
                  ? 'border-amber-300/40 bg-gradient-to-b from-amber-950/30 to-[#121D3D]/85 shadow-[0_0_10px_rgba(245,158,11,0.12)] opacity-85'
                  : isDownstreamFromFocus
                    ? `${style.border} bg-[#111E40]/90 opacity-95 ring-1 ring-cyan-300/40 cursor-pointer`
                    : isUnreachableLocked
                      ? 'border-white/10 bg-[#080F24]/55 text-slate-500 opacity-35 saturate-50 cursor-pointer'
                      : 'border-white/15 bg-[#0C1530]/75 text-slate-400 opacity-75 cursor-pointer'
      }`}
    >
      {isCompactLandscape || lod.mapNodeCompactMode ? (
        <>
          <div className="flex w-full items-center justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span
                data-testid={`map-node-pip-${node.id}`}
                style={{ backgroundColor: nodePip.accentHex, color: '#020617' }}
                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[11px] font-black leading-none"
              >
                {nodePip.symbol}
              </span>
              <NodeEmblem type={node.type} />
              <span className={`font-display text-[12.5px] sm:text-[13px] font-bold leading-tight truncate ${style.accent}`}>
                {t.nodes[node.type]}
              </span>
            </div>
            <span
              className={`shrink-0 font-mono-tabular text-[10px] font-bold uppercase tracking-wider ${
                isRecommended
                  ? 'text-[#FFC700]'
                  : isAvailable
                    ? 'text-[#00F0FF]'
                    : node.cleared || isCurrent
                      ? 'text-amber-300'
                      : isMultiHopPath
                        ? 'text-cyan-300'
                        : isDownstreamFromFocus
                          ? 'text-cyan-300'
                          : 'text-slate-400'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-1.5 text-[11px] font-mono-tabular min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="truncate font-sans text-slate-200/95">{squadNames}</span>
              {econ.tensionHpPct !== 0 && (
                <span
                  className={`shrink-0 px-1 py-0.2 rounded text-[9.5px] font-bold ${
                    econ.tensionHpPct > 20
                      ? 'bg-rose-500/25 text-rose-300'
                      : econ.tensionHpPct > 0
                        ? 'bg-amber-500/25 text-amber-300'
                        : 'bg-emerald-500/25 text-emerald-300'
                  }`}
                >
                  {econ.tensionHpPct > 0 ? `-${econ.tensionHpPct}%` : `+${Math.abs(econ.tensionHpPct)}%`}
                </span>
              )}
            </div>
            <span className="shrink-0 font-bold text-white">{bottomMetric}</span>
          </div>
        </>
      ) : (
        <>
          {node.layer > 0 && (
            <span
              aria-hidden="true"
              className={`hidden sm:block absolute -left-1.5 top-1/2 h-2 w-2 md:h-2.5 md:w-2.5 -translate-y-1/2 rounded-full border ${
                isAvailable
                  ? 'border-white bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]'
                  : node.cleared || isCurrent
                    ? 'border-white bg-[#FFC700]'
                    : isMultiHopPath
                      ? 'border-white bg-[#00F0FF]'
                      : isDownstreamFromFocus
                        ? 'border-cyan-200 bg-cyan-400'
                        : 'border-slate-500 bg-slate-800'
              }`}
            />
          )}
          {node.layer < maxLayer && (
            <span
              aria-hidden="true"
              className={`hidden sm:block absolute -right-1.5 top-1/2 h-2 w-2 md:h-2.5 md:w-2.5 -translate-y-1/2 rounded-full border ${
                isCurrent
                  ? 'border-white bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]'
                  : node.cleared
                    ? 'border-white bg-[#FFC700]'
                    : isAvailable && isKeyboardFocused
                      ? 'border-white bg-[#00F0FF]'
                      : isMultiHopPath
                        ? 'border-white bg-[#00F0FF]'
                        : 'border-slate-500 bg-slate-800'
              }`}
            />
          )}

          <div className="flex w-full items-start justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                data-testid={`map-node-pip-${node.id}`}
                style={{ backgroundColor: nodePip.accentHex, color: '#020617' }}
                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[11px] font-black leading-none"
              >
                {nodePip.symbol}
              </span>
              <NodeEmblem type={node.type} />
              <span className={`font-display text-[13.5px] sm:text-[14.5px] font-bold leading-tight truncate ${style.accent}`}>
                {t.nodes[node.type]}
              </span>
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-mono-tabular text-[10.5px] font-bold uppercase tracking-wider leading-none ${
                isCurrent
                  ? 'bg-[#FFC700] text-slate-950 shadow-[0_0_10px_rgba(255,199,0,0.65)] animate-pulse'
                  : isRecommended
                    ? 'bg-amber-400/20 text-[#FFC700] border border-amber-300/50'
                    : isAvailable
                      ? 'bg-cyan-400/15 text-[#00F0FF] border border-cyan-300/45'
                      : node.cleared
                        ? 'text-amber-300'
                        : isMultiHopPath || isDownstreamFromFocus
                          ? 'text-cyan-300'
                          : 'text-slate-400'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="my-1 flex flex-col gap-1 min-w-0">
            <p className="line-clamp-2 text-[11.5px] sm:text-[12px] leading-snug text-slate-200/95">
              {squadNames.replace(/\*\*/g, '')}
            </p>
            {highSignalBadges.length > 0 && (
              <div className="flex max-w-full items-center gap-1 min-w-0 flex-wrap overflow-hidden">
                {highSignalBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`max-w-full truncate px-1.5 py-0.5 rounded border text-[9.5px] font-bold font-mono-tabular leading-none ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex w-full items-center justify-between gap-1.5 border-t border-white/15 pt-1 text-[11px] sm:text-[11.5px] font-mono-tabular min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-bold text-white">{bottomMetric}</span>
              {econ.tensionHpPct !== 0 && (
                <span
                  title={econ.opportunityCost}
                  className={`px-1 py-0.2 rounded text-[9.5px] sm:text-[10px] font-bold shrink-0 ${
                    econ.tensionHpPct > 20
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : econ.tensionHpPct > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {econ.tensionHpPct > 0 ? `-${econ.tensionHpPct}%` : `+${Math.abs(econ.tensionHpPct)}%`}
                </span>
              )}
            </div>
            <span className={`min-w-0 truncate text-right font-semibold ${style.accent}`}>
              {getNodeRewardLabel(node.type, t)}
            </span>
          </div>
        </>
      )}
    </button>
  );
}
