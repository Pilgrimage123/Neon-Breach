import { MAX_IMPLANTS } from '../../engine/data';
import {
  getNodeEconomyMetrics,
  getReconPreviewForNode,
  type NodeEncounterIntel,
} from '../../engine/mapTacticalIntel';
import type { MapNode, RunState } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { DISTRICT_BADGE_LABELS, getNodeRewardLabel } from './sectorMapTheme';

export interface SectorNodeBriefingBarProps {
  briefingNode: MapNode;
  run: RunState;
  lang: Language;
  isCompactLandscape: boolean;
  isAvailable: boolean;
  hasRecon: boolean;
  intel?: NodeEncounterIntel;
  maxClearedLayer: number;
  meshReroutesRemaining: number;
  onSelectNode: (nodeId: string) => void;
  onRerouteMeshNet?: (targetNodeId: string) => void;
}

export function SectorNodeBriefingBar({
  briefingNode,
  run,
  lang,
  isCompactLandscape,
  isAvailable,
  hasRecon,
  intel,
  maxClearedLayer,
  meshReroutesRemaining,
  onSelectNode,
  onRerouteMeshNet,
}: SectorNodeBriefingBarProps) {
  const t = TRANSLATIONS[lang];
  const difficultyTier = run.difficultyTier ?? 3;
  const briefingEconomy = getNodeEconomyMetrics(
    briefingNode,
    run.hero,
    lang,
    difficultyTier,
  );
  const consecutiveCombat = run.hero.consecutiveCombatWithoutClinic ?? 0;
  const reconPreview = hasRecon ? getReconPreviewForNode(briefingNode, run, lang) : null;
  const reconDetail =
    reconPreview?.kind === 'event'
      ? `${reconPreview.eventTitle}: ${reconPreview.choices.join(' / ')}`
      : reconPreview?.kind === 'clinic'
        ? `${t.implantsTitle} · ${t.implantSlotsLabel}: ${MAX_IMPLANTS - reconPreview.openSockets}/${MAX_IMPLANTS}`
        : reconPreview?.kind === 'chip_dealer'
          ? `${reconPreview.isFlashSale ? t.bountyFlashSaleBadge : t.clinicShopTitle} · ${t.capacityLabel}: ${reconPreview.freeMemory}`
          : reconPreview?.kind === 'medbay'
            ? `+${reconPreview.healTotal} ${t.hpLabel}${reconPreview.isFunded ? ` (${t.bountyFundedClinicBadge})` : ''}`
            : reconPreview?.kind === 'combat'
              ? reconPreview.enemies
                  .map(
                    (e) =>
                      `${t.enemies[e.archetype].name} (${e.hp}HP${e.armor > 0 ? `+${e.armor}A` : ''} · ${e.firstIntent.kind.toUpperCase()} ${e.firstIntent.value})`,
                  )
                  .join(' | ')
              : null;

  const canMeshRerouteToBriefing =
    Boolean(onRerouteMeshNet) &&
    !isAvailable &&
    !briefingNode.cleared &&
    meshReroutesRemaining > 0 &&
    briefingNode.layer === maxClearedLayer + 1;

  const baseCreditsEst = Math.max(10, briefingEconomy.runYieldCredits || 35);
  const streakBonusCredits = Math.min(
    25,
    Math.round(baseCreditsEst * 0.1 * consecutiveCombat),
  );

  return (
    <div
      className={`chrome-panel-bright flex shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-[12px] sm:text-[13px]">
        <span className="font-mono-tabular font-bold text-[#00F0FF]">
          {intel?.sectorCode}
        </span>
        <span aria-hidden="true" className="text-slate-500">
          ·
        </span>
        <span className="font-display text-sm sm:text-base font-bold text-white">
          {t.nodes[briefingNode.type]}
        </span>
        {briefingNode.districtBadge && DISTRICT_BADGE_LABELS[briefingNode.districtBadge] && (
          <span
            className={`rounded border px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold ${DISTRICT_BADGE_LABELS[briefingNode.districtBadge].colorClass}`}
          >
            {lang === 'cs'
              ? DISTRICT_BADGE_LABELS[briefingNode.districtBadge].cs
              : DISTRICT_BADGE_LABELS[briefingNode.districtBadge].en}
          </span>
        )}
        <span className="rounded bg-slate-900/80 border border-white/10 px-1.5 py-0.5 font-mono-tabular text-[12px] font-bold text-[#FFC700]">
          {getNodeRewardLabel(briefingNode.type, t)}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 font-mono-tabular text-[12px] font-bold ${
            briefingEconomy.tensionHpPct > 20
              ? 'border-rose-400/40 bg-rose-950/50 text-rose-300'
              : briefingEconomy.tensionHpPct < 0
                ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-300'
                : 'border-slate-700/60 bg-slate-900/80 text-slate-300'
          }`}
        >
          {briefingEconomy.tensionHpPct > 0
            ? `~-${briefingEconomy.tensionHpEst} HP`
            : briefingEconomy.tensionHpPct < 0
              ? `+${Math.abs(briefingEconomy.tensionHpPct)}% HP`
              : `+${briefingEconomy.runYieldCredits} CR`}
        </span>
        {intel?.threatTraits?.[0] && (
          <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-rose-200">
            {intel.threatTraits[0]}
          </span>
        )}
        {consecutiveCombat >= 2 && (
          <span
            title={
              lang === 'cs'
                ? 'Série bojů bez ošetřovny (+10 % kreditů za boj, max +25 CR)'
                : 'Combat streak bonus (+10% credits per consecutive fight, max +25 CR)'
            }
            className="rounded bg-amber-500/20 border border-amber-400/45 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-amber-200"
          >
            ⚡ +{streakBonusCredits} CR (max +25 CR)
          </span>
        )}
        {hasRecon && reconDetail && (
          <span
            title={reconDetail}
            className="rounded bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-cyan-200 truncate max-w-[300px]"
          >
            ✦ {reconDetail}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canMeshRerouteToBriefing && onRerouteMeshNet && (
          <button
            type="button"
            data-testid="map-mesh-reroute-btn"
            onClick={() => onRerouteMeshNet(briefingNode.id)}
            className="chrome-pill rounded-lg border-cyan-400/60 bg-cyan-500/20 px-3 py-1.5 font-mono-tabular text-xs font-bold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer whitespace-nowrap"
          >
            📡 {lang === 'cs' ? `Mesh-Net přesměrování (${meshReroutesRemaining})` : `Mesh-Net Reroute (${meshReroutesRemaining})`}
          </button>
        )}

        {isAvailable ? (
          <button
            type="button"
            onClick={() => onSelectNode(briefingNode.id)}
            className={`chrome-btn-primary rounded-lg font-display font-bold transition-transform hover:-translate-y-0.5 cursor-pointer shrink-0 whitespace-nowrap ${
              isCompactLandscape
                ? 'w-auto px-3 py-1 text-xs'
                : 'w-full sm:w-auto px-4 py-1.5 text-xs sm:text-sm'
            }`}
          >
            {t.enterNode}: {t.nodes[briefingNode.type]} [Enter]
          </button>
        ) : (
          <span className="font-mono-tabular text-xs text-slate-400 font-bold px-3 py-1 rounded bg-slate-800/60 border border-slate-700/50 shrink-0">
            {t.mapMultiHopLabel}
          </span>
        )}
      </div>
    </div>
  );
}
