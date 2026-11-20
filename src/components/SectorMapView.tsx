import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import {
  getAvailableNextNodes,
  getBossTelegraphIntel,
  getConnectingPathNodeIds,
  getLaneClusterProfiles,
  getMetropolisDistricts,
  getNodeEconomyMetrics,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getReconPreviewForNode,
  getTacticalRouteAdvice,
} from '../engine/mapGenerator';
import type { MapNode, MapNodeType, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  getNodeCornerPip,
  resolveSemanticZoomLoD,
  type SemanticZoomLevel,
} from '../utils/accessibilityAndScale';

interface SectorMapViewProps {
  run: RunState;
  lang: Language;
  modalOpen?: boolean;
  tacticalView?: boolean;
  semanticZoom?: SemanticZoomLevel;
  twoStepConfirm?: boolean;
  highContrastBorders?: boolean;
  isCompactLandscape?: boolean;
  isNarrowPortrait?: boolean;
  effectiveWidth?: number;
  onSelectNode: (nodeId: string) => void;
  onOpenLoadout: () => void;
  onRerouteMeshNet?: (targetNodeId: string) => void;
  onCharterEstate?: (layer?: number) => void;
  onRideMagLev?: (targetNodeId?: string) => void;
}

const DISTRICT_BADGE_LABELS: Record<
  NonNullable<MapNode['districtBadge']>,
  { en: string; cs: string; colorClass: string }
> = {
  stork_nursery: {
    en: 'STORK NURSERY',
    cs: 'ČAPÍ JESLE',
    colorClass: 'bg-pink-500/25 border-pink-300/60 text-pink-200',
  },
  pedigree_lab: {
    en: 'PEDIGREE LAB',
    cs: 'RODOKMEN LAB',
    colorClass: 'bg-cyan-500/25 border-cyan-300/60 text-cyan-200',
  },
  charter_academy: {
    en: 'CHARTER ACADEMY',
    cs: 'AKADEMIE DÍLKŮ',
    colorClass: 'bg-indigo-500/25 border-indigo-300/60 text-indigo-200',
  },
  open_fablab: {
    en: 'OPEN FABLAB',
    cs: 'OPEN FABLAB',
    colorClass: 'bg-teal-500/25 border-teal-300/60 text-teal-200',
  },
  upcycle_kiosk: {
    en: 'UPCYCLE KIOSK',
    cs: 'UPCYCLE KIOSEK',
    colorClass: 'bg-lime-500/25 border-lime-300/60 text-lime-200',
  },
  smart_hearth: {
    en: 'SMART-HEARTH',
    cs: 'CHYTRÝ KRB',
    colorClass: 'bg-emerald-500/25 border-emerald-300/60 text-emerald-200',
  },
  rooftop_cafe: {
    en: 'HYDRO-CAFE',
    cs: 'HYDRO-KAVÁRNA',
    colorClass: 'bg-teal-500/25 border-teal-300/60 text-teal-100',
  },
  suburban_dome: {
    en: 'SUBURBAN DOME',
    cs: 'RODINNÝ DÓM',
    colorClass: 'bg-emerald-500/30 border-emerald-300/65 text-emerald-100',
  },
  nanny_showroom: {
    en: 'NANNY-BOT SHOP',
    cs: 'CHŮVA-BOTI',
    colorClass: 'bg-amber-500/25 border-amber-300/60 text-amber-200',
  },
  beta_arcade: {
    en: 'BETA ARCADE',
    cs: 'BETA HERNA',
    colorClass: 'bg-violet-500/25 border-violet-300/60 text-violet-200',
  },
  heirloom_forge: {
    en: 'HEIRLOOM FORGE',
    cs: 'RODOVÁ KOVÁRNA',
    colorClass: 'bg-yellow-500/25 border-yellow-300/60 text-yellow-200',
  },
  matchmakers_gala: {
    en: 'MATCHMAKER GALA',
    cs: 'GALA ALIANCÍ',
    colorClass: 'bg-fuchsia-500/25 border-fuchsia-300/60 text-fuchsia-200',
  },
  mutual_aid_coop: {
    en: 'MUTUAL-AID CO-OP',
    cs: 'SOUSEDSKÝ CO-OP',
    colorClass: 'bg-purple-500/25 border-purple-300/60 text-purple-200',
  },
  synth_rave: {
    en: 'SYNTH-RAVE',
    cs: 'ALGO-RAVE',
    colorClass: 'bg-fuchsia-500/30 border-fuchsia-300/65 text-fuchsia-100',
  },
  mesh_relay: {
    en: 'MESH-NET RELAY',
    cs: 'MESH-NET VĚŽ',
    colorClass: 'bg-sky-500/25 border-sky-300/60 text-sky-200',
  },
  ar_graffiti_wall: {
    en: 'AR GRAFFITI WALL',
    cs: 'AR HOLO-ZEĎ',
    colorClass: 'bg-pink-500/30 border-pink-300/65 text-pink-100',
  },
  vanguard_escort: {
    en: 'CRADLE ESCORT',
    cs: 'ESKORTA KOLÉBKY',
    colorClass: 'bg-amber-500/30 border-amber-300/70 text-amber-100',
  },
  data_liberation: {
    en: 'DATA LIBERATION',
    cs: 'OSVOBOZENÍ DAT',
    colorClass: 'bg-cyan-500/30 border-cyan-300/70 text-cyan-100',
  },
  maglev_hub: {
    en: 'MAG-LEV HUB',
    cs: 'MAG-LEV UZEL',
    colorClass: 'bg-sky-500/25 border-sky-300/60 text-sky-200',
  },
};

const NODE_STYLE: Record<
  MapNodeType,
  { border: string; accent: string; bg: string; hex: string }
> = {
  COMBAT: {
    border: 'border-[#FF2E7E]/60',
    accent: 'text-rose-200',
    bg: 'bg-gradient-to-b from-[#33122C]/90 to-[#1B0A1A]/92',
    hex: '#FF2E7E',
  },
  ELITE: {
    border: 'border-[#FFC700]/75',
    accent: 'text-amber-200',
    bg: 'bg-gradient-to-b from-[#3A280E]/92 to-[#1F1507]/94',
    hex: '#FFC700',
  },
  CYBER_CLINIC: {
    border: 'border-[#00F0FF]/65',
    accent: 'text-cyan-200',
    bg: 'bg-gradient-to-b from-[#0E2D4C]/90 to-[#081A2E]/92',
    hex: '#00F0FF',
  },
  CHIP_DEALER: {
    border: 'border-amber-400/70',
    accent: 'text-amber-200',
    bg: 'bg-gradient-to-b from-[#3A220B]/90 to-[#1F1105]/92',
    hex: '#F59E0B',
  },
  MED_BAY: {
    border: 'border-[#10F5A0]/65',
    accent: 'text-emerald-200',
    bg: 'bg-gradient-to-b from-[#0E332C]/90 to-[#081C19]/92',
    hex: '#10F5A0',
  },
  EVENT: {
    border: 'border-purple-400/70',
    accent: 'text-purple-200',
    bg: 'bg-gradient-to-b from-[#2B123D]/90 to-[#170921]/92',
    hex: '#C084FC',
  },
  BOSS: {
    border: 'border-lime-400/80',
    accent: 'text-lime-200',
    bg: 'bg-gradient-to-b from-[#1E3318]/94 to-[#101C0D]/96',
    hex: '#84CC16',
  },
};

function NodeEmblem({ type }: { type: MapNodeType }) {
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10F5A0" strokeWidth="2.2" aria-hidden="true">
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

const ROW_INDICES = [0, 1, 2] as const;
const LANE_TRACK_Y = [72, 216, 360] as const;

function getVisualRow(node: MapNode, maxLayer: number): number {
  return node.layer === 0 || node.layer === maxLayer ? 1 : node.lane;
}

function getPortCoords(node: MapNode, totalCols: number) {
  const maxLayer = totalCols - 1;
  const colGap = totalCols > 5 ? 16 : 28;
  const colSpan = (1000 - (totalCols - 1) * colGap) / totalCols;
  const colLeft = node.layer * (colSpan + colGap);
  const colRight = colLeft + colSpan;
  const rowIndex = getVisualRow(node, maxLayer);
  const rowY = rowIndex === 0 ? 72 : rowIndex === 1 ? 216 : 360;
  return {
    leftX: colLeft + 2,
    rightX: colRight - 2,
    centerX: (colLeft + colRight) * 0.5,
    y: rowY,
  };
}

export function SectorMapView({
  run,
  lang,
  modalOpen = false,
  tacticalView = false,
  semanticZoom = 'standard',
  twoStepConfirm = false,
  highContrastBorders = false,
  isCompactLandscape = false,
  isNarrowPortrait = false,
  effectiveWidth = 1280,
  onSelectNode,
  onOpenLoadout,
  onRerouteMeshNet,
  onCharterEstate,
  onRideMagLev,
}: SectorMapViewProps) {
  const t = TRANSLATIONS[lang];
  const lod = useMemo(
    () => resolveSemanticZoomLoD(semanticZoom, tacticalView),
    [semanticZoom, tacticalView],
  );
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';
  const lastPointerTypeRef = useRef<string>('mouse');
  const maxLayer = useMemo(
    () => run.mapNodes.reduce((acc, n) => Math.max(acc, n.layer), 4),
    [run.mapNodes],
  );
  const layerIndices = useMemo(
    () => Array.from({ length: maxLayer + 1 }, (_, idx) => idx),
    [maxLayer],
  );
  const totalCols = layerIndices.length;

  const availableNodes = useMemo(
    () => getAvailableNextNodes(run.mapNodes, run.currentNodeId),
    [run.mapNodes, run.currentNodeId],
  );
  const availableIds = useMemo(() => new Set(availableNodes.map((n) => n.id)), [availableNodes]);
  const advice = useMemo(() => getTacticalRouteAdvice(run), [run]);

  const laneProfiles = useMemo(
    () => getLaneClusterProfiles(run.mapNodes, run.heroine, lang),
    [run.mapNodes, run.heroine, lang],
  );
  const bossTelegraph = useMemo(
    () => getBossTelegraphIntel(lang, run.difficultyTier ?? 3),
    [lang, run.difficultyTier],
  );
  const hasRecon =
    run.heroine.implants.includes('synapse_overclock') ||
    run.heroine.implants.includes('surge_resonator');

  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    if (!advice.recommendedNodeId) return 0;
    const recIdx = availableNodes.findIndex((n) => n.id === advice.recommendedNodeId);
    return recIdx >= 0 ? recIdx : 0;
  });

  // Target node for multi-hop path inspection (defaults to focused immediate node)
  const [inspectedTargetId, setInspectedTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!advice.recommendedNodeId) {
      setSelectedIdx(0);
      return;
    }
    const recIdx = availableNodes.findIndex((n) => n.id === advice.recommendedNodeId);
    setSelectedIdx(recIdx >= 0 ? recIdx : 0);
  }, [run.currentNodeId, advice.recommendedNodeId, availableNodes]);

  useEffect(() => {
    if (modalOpen || availableNodes.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % availableNodes.length);
        setInspectedTargetId(null);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + availableNodes.length) % availableNodes.length);
        setInspectedTargetId(null);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === 'BUTTON') return;
        e.preventDefault();
        const target = availableNodes[selectedIdx] ?? availableNodes[0];
        if (target) onSelectNode(target.id);
      } else if (e.key >= '1' && e.key <= '3') {
        const idx = Number(e.key) - 1;
        if (availableNodes[idx]) {
          onSelectNode(availableNodes[idx].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [availableNodes, modalOpen, onSelectNode, selectedIdx]);

  const focusedNode = availableNodes[selectedIdx] ?? availableNodes[0] ?? null;
  const focusedNodeId = focusedNode?.id ?? null;

  // Active target for path inspection: inspectedTargetId if set, otherwise focusedNodeId
  const effectiveTargetId = inspectedTargetId ?? focusedNodeId;

  // Multi-hop path highlighting from current position to effective target
  const multiHopPathIds = useMemo(() => {
    if (!effectiveTargetId) return new Set<string>();
    return getConnectingPathNodeIds(run.mapNodes, run.currentNodeId, effectiveTargetId);
  }, [run.mapNodes, run.currentNodeId, effectiveTargetId]);

  const previewReachableIds = useMemo(
    () => getReachableNodeIds(run.mapNodes, focusedNodeId),
    [run.mapNodes, focusedNodeId],
  );

  const currentReachableIds = useMemo(
    () => getReachableNodeIds(run.mapNodes, run.currentNodeId),
    [run.mapNodes, run.currentNodeId],
  );

  const availableIndexById = useMemo(
    () => new Map(availableNodes.map((n, idx) => [n.id, idx])),
    [availableNodes],
  );

  const intelByNodeId = useMemo(
    () => new Map(run.mapNodes.map((n) => [n.id, getNodeEncounterIntel(n, run.seed, lang)])),
    [run.mapNodes, run.seed, lang],
  );

  const layers = useMemo(
    () =>
      layerIndices.map((layer) =>
        run.mapNodes.filter((n) => n.layer === layer).sort((a, b) => a.lane - b.lane),
      ),
    [layerIndices, run.mapNodes],
  );

  const nodeById = useMemo(() => new Map(run.mapNodes.map((n) => [n.id, n])), [run.mapNodes]);

  const equippedWeight = useMemo(
    () => getEquippedEquipmentWeight(run.heroine),
    [run.heroine],
  );

  const getRewardLabel = (type: MapNodeType): string => {
    switch (type) {
      case 'CYBER_CLINIC':
        return t.mapRewardImplant;
      case 'CHIP_DEALER':
        return t.clinicShopTitle;
      case 'ELITE':
        return t.mapRewardElite;
      case 'MED_BAY':
        return t.mapRewardMedbay;
      case 'EVENT':
        return t.nodes.EVENT;
      case 'BOSS':
        return t.mapRewardBoss;
      default:
        return t.mapRewardCombat;
    }
  };

  const inspectedNode = inspectedTargetId ? nodeById.get(inspectedTargetId) : null;
  const briefingNode = inspectedNode ?? focusedNode;

  const renderNodeCard = (node: MapNode) => {
    const isAvailable = availableIds.has(node.id);
    const availIndex = availableIndexById.get(node.id) ?? -1;
    const isCurrent = run.currentNodeId === node.id;
    const isKeyboardFocused = focusedNodeId === node.id;
    const isRecommended = advice.recommendedNodeId === node.id && isAvailable;
    const isInspected = inspectedTargetId === node.id;
    const isMultiHopPath = multiHopPathIds.has(node.id);

    const isDownstreamFromFocus =
      !isAvailable &&
      !node.cleared &&
      !isCurrent &&
      Boolean(focusedNodeId && previewReachableIds.has(node.id));
    const isUnreachableLocked =
      !node.cleared && !isCurrent && !isAvailable && !currentReachableIds.has(node.id);

    const style = NODE_STYLE[node.type];
    const intel = intelByNodeId.get(node.id) ?? getNodeEncounterIntel(node, run.seed, lang);
    const econ = getNodeEconomyMetrics(node, run.heroine, lang);

    const statusLabel = node.cleared
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
          ? `${t.implantSlotsLabel} ${run.heroine.implants.length}/${MAX_IMPLANTS}`
          : node.type === 'CHIP_DEALER'
            ? `${t.capacityLabel} ${getEquippedEquipmentWeight(run.heroine)}/${run.heroine.carryCapacity}`
            : node.type === 'EVENT'
            ? reconPreview?.kind === 'event'
              ? t.reconPreviewPrefix
              : t.mapAnomalyLabel
            : `${t.hpLabel} ${run.heroine.hp}/${run.heroine.maxHp}`;

    const minShopCredits = node.modifier === 'flash_sale' ? 20 : 30;
    const nodePip = getNodeCornerPip(node.type);

    return (
      <button
        key={node.id}
        type="button"
        disabled={false}
        data-testid={`map-node-${node.id}`}
        data-node-pip={nodePip.symbol}
        onPointerDown={(e) => {
          lastPointerTypeRef.current = e.pointerType || 'mouse';
        }}
        onMouseEnter={() => {
          if (availIndex >= 0) {
            setSelectedIdx(availIndex);
            setInspectedTargetId(null);
          } else {
            setInspectedTargetId(node.id);
          }
        }}
        onFocus={() => {
          if (availIndex >= 0) {
            setSelectedIdx(availIndex);
            setInspectedTargetId(null);
          } else {
            setInspectedTargetId(node.id);
          }
        }}
        onClick={() => {
          const isTouch = lastPointerTypeRef.current === 'touch';
          lastPointerTypeRef.current = 'mouse';
          if (isAvailable) {
            if ((isTouch || twoStepConfirm) && availIndex >= 0 && selectedIdx !== availIndex) {
              setSelectedIdx(availIndex);
              setInspectedTargetId(null);
              return;
            }
            onSelectNode(node.id);
          } else {
            setInspectedTargetId(node.id);
          }
        }}
        className={`group relative flex h-full w-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border ${hcBorderClass} ${
          isCompactLandscape ? 'px-2 py-1' : 'p-1.5 sm:p-2'
        } text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-all duration-150 ${
          isAvailable
            ? `${style.border} ${style.bg} ${
                isKeyboardFocused
                  ? 'ring-2 ring-[#FFC700] shadow-[0_0_26px_rgba(255,199,0,0.38),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5'
                  : 'ring-1 ring-[#00F0FF]/80 shadow-[0_0_18px_rgba(0,240,255,0.24)]'
              } hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,240,255,0.38)] cursor-pointer`
            : isCurrent
              ? 'border-[#FFC700]/80 bg-[#1B274D]/95 ring-1 ring-[#FFC700]/55 shadow-[0_0_18px_rgba(255,199,0,0.25)]'
              : isInspected
                ? `${style.border} ring-2 ring-purple-400 bg-purple-950/40 shadow-[0_0_22px_rgba(192,132,252,0.35)] cursor-pointer`
                : isMultiHopPath
                  ? `${style.border} ring-1 ring-cyan-300 bg-cyan-950/40 shadow-[0_0_18px_rgba(0,240,255,0.25)] cursor-pointer`
                  : node.cleared
                    ? 'border-amber-300/35 bg-[#121D3D]/80 opacity-85'
                    : isDownstreamFromFocus
                      ? `${style.border} bg-[#111E40]/90 opacity-95 ring-1 ring-cyan-300/40 cursor-pointer`
                      : isUnreachableLocked
                        ? 'border-white/10 bg-[#080F24]/55 text-slate-500 opacity-40 cursor-pointer'
                        : 'border-white/15 bg-[#0C1530]/75 text-slate-400 opacity-70 cursor-pointer'
        }`}
      >
        {isCompactLandscape || lod.mapNodeCompactMode ? (
          <>
            {/* Compact Landscape / Semantic Overview 2-Row Card */}
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
            {/* Left & Right Chrome Hardware Connector Ports */}
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

            {/* Top Row: Double-Coding Corner Pip + Sector Coordinate + Status Text */}
            <div className="flex w-full items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  data-testid={`map-node-pip-${node.id}`}
                  style={{ backgroundColor: nodePip.accentHex, color: '#020617' }}
                  className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[11px] font-black leading-none"
                >
                  {nodePip.symbol}
                </span>
                <NodeEmblem type={node.type} />
                <span className="font-mono-tabular text-[11px] sm:text-[12px] font-semibold tracking-wider text-slate-300 truncate">
                  {intel.sectorCode}
                </span>
              </div>
              <span
                className={`shrink-0 font-mono-tabular text-[11px] sm:text-[12px] font-bold uppercase tracking-wider ${
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

            {/* Middle Row: Node Title & Squad / Facility Subtitle */}
            <div className="my-0.5 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className={`font-display text-[13px] sm:text-[13.5px] font-bold leading-tight line-clamp-2 ${style.accent}`}>
                  {t.nodes[node.type]}
                </div>
                <div className="flex max-w-full items-center gap-1 min-w-0 flex-wrap overflow-hidden">
                  {/* Dynasty & Civic-Tech District Badge */}
                  {node.districtBadge && DISTRICT_BADGE_LABELS[node.districtBadge] && (
                    <span
                      className={`max-w-full truncate px-1 py-0.2 rounded border text-[9px] sm:text-[9.5px] font-bold font-mono-tabular leading-tight ${DISTRICT_BADGE_LABELS[node.districtBadge].colorClass}`}
                    >
                      {lang === 'cs'
                        ? DISTRICT_BADGE_LABELS[node.districtBadge].cs
                        : DISTRICT_BADGE_LABELS[node.districtBadge].en}
                    </span>
                  )}
                  {/* Hot-Spot Bounty Modifier Badges */}
                  {node.modifier === 'golden_bounty' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-amber-400/25 border border-amber-300/60 text-amber-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight">
                      {t.bountyGoldenBadge}
                    </span>
                  )}
                  {node.modifier === 'double_credits' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-emerald-400/25 border border-emerald-300/60 text-emerald-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight">
                      {t.bountyDoubleBadge}
                    </span>
                  )}
                  {node.modifier === 'nanite_cache' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-cyan-400/25 border border-cyan-300/60 text-cyan-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight">
                      {t.bountyNaniteBadge}
                    </span>
                  )}
                  {/* Dynamic Modifiers */}
                  {node.modifier === 'overcharged_hazard' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-rose-500/25 border border-rose-400/60 text-rose-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight">
                      {t.bountyOverchargedBadge}
                    </span>
                  )}
                  {node.modifier === 'flash_sale' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-amber-400/25 border border-amber-300/60 text-amber-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight animate-pulse">
                      {t.bountyFlashSaleBadge}
                    </span>
                  )}
                  {node.modifier === 'funded_clinic' && (
                    <span className="max-w-full truncate px-1 py-0.2 rounded bg-emerald-400/25 border border-emerald-300/60 text-emerald-300 text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight">
                      {t.bountyFundedClinicBadge}
                    </span>
                  )}
                  {/* Smart Shop Badges */}
                  {(node.type === 'CHIP_DEALER' || node.type === 'CYBER_CLINIC') && (
                    <span
                      className={`max-w-full truncate px-1 py-0.2 rounded text-[9.5px] sm:text-[10px] font-bold font-mono-tabular leading-tight border ${
                        run.heroine.credits >= minShopCredits
                          ? 'bg-emerald-400/20 border-emerald-400/50 text-emerald-300'
                          : 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                      }`}
                    >
                      {run.heroine.credits >= minShopCredits
                        ? `${t.shopAffordable} (${minShopCredits}+ CR)`
                        : t.shopLowCredits}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] sm:text-[12px] leading-tight sm:leading-snug text-slate-200/95">
                {squadNames.replace(/\*\*/g, '')}
              </p>
            </div>

            {/* Bottom Row: Threat HP / Status + Reward Metadata */}
            <div className="flex w-full items-center justify-between gap-1 border-t border-white/15 pt-0.5 sm:pt-1 text-[10.5px] sm:text-[11.5px] font-mono-tabular min-w-0">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
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
              {totalCols <= 8 && (
                <span className={`min-w-0 truncate text-right font-semibold ${style.accent}`}>
                  {getRewardLabel(node.type)}
                </span>
              )}
            </div>
          </>
        )}
      </button>
    );
  };

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const metropolisDistricts = useMemo(
    () => getMetropolisDistricts(totalCols, lang),
    [totalCols, lang],
  );
  const currentLayer = useMemo(() => {
    const cur = run.mapNodes.find((n) => n.id === run.currentNodeId);
    if (cur) return cur.layer;
    const cleared = run.mapNodes.filter((n) => n.cleared);
    return cleared.length > 0 ? Math.max(...cleared.map((n) => n.layer)) : 0;
  }, [run.mapNodes, run.currentNodeId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || totalCols <= 5) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 0) return;
    const targetRatio = Math.max(0, Math.min(1, currentLayer / Math.max(1, totalCols - 1)));
    container.scrollTo({
      left: Math.round(maxScroll * targetRatio * 0.85),
      behavior: 'smooth',
    });
  }, [currentLayer, totalCols]);

  const scrollToDistrict = (startLayer: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 0) return;
    const ratio = Math.max(0, Math.min(1, startLayer / Math.max(1, totalCols - 2)));
    container.scrollTo({
      left: Math.round(maxScroll * ratio),
      behavior: 'smooth',
    });
  };

  const needsHorizontalPan =
    totalCols > 7
      ? effectiveWidth < 1640
      : isNarrowPortrait || effectiveWidth < (totalCols > 5 ? 920 : 560);
  const gridColsClass =
    totalCols === 12
      ? 'grid-cols-12'
      : totalCols === 7
        ? 'grid-cols-7'
        : 'grid-cols-5';
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : 0;
  const nextCharterLayer = Math.min(maxLayer, maxClearedLayer + 1);
  const estateAlreadyChartered = Boolean(
    run.heroine.familyEstates?.includes(nextCharterLayer),
  );
  const canRideMagLev =
    !run.heroine.maglevUsed &&
    clearedNodes.length > 0 &&
    maxClearedLayer + 2 <= maxLayer - 1;
  const maxMeshReroutes = totalCols >= 7 ? 2 : 1;
  const meshReroutesRemaining = Math.max(0, maxMeshReroutes - (run.heroine.meshReroutesUsed ?? 0));

  return (
    <main
      className={`cyber-vista-bg relative flex flex-1 min-h-0 flex-col justify-between overflow-hidden ${
        isCompactLandscape ? 'px-2 py-1' : 'px-2 py-2 sm:px-4 sm:py-2.5 lg:px-5'
      }`}
    >
      <div
        className={`flex w-full flex-1 min-h-0 flex-col justify-between ${
          isCompactLandscape ? 'gap-1' : 'gap-2 sm:gap-2.5'
        }`}
      >
        {/* Unified Single-Row Sector Command Bar: Layer Progress · Dynasty Status · Active Route Tools · Loadout */}
        <div
          className={`chrome-glass flex shrink-0 flex-wrap lg:flex-nowrap items-center justify-between gap-2 rounded-xl ${
            isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1
              className={`chrome-text-shimmer font-display font-bold tracking-wide whitespace-nowrap ${
                isCompactLandscape ? 'text-sm' : 'text-base sm:text-lg'
              }`}
            >
              {t.sectorMapTitle}
            </h1>
            <span
              data-testid="map-stage-counter"
              className="font-mono-tabular text-xs font-bold text-[#00F0FF] whitespace-nowrap"
            >
              {Math.min(totalCols, (nodeById.get(run.currentNodeId ?? '')?.layer ?? 0) + 2)}/{totalCols}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-500">
              ·
            </span>
            <span
              title={`${bossTelegraph.name} — ${bossTelegraph.recommendedPrep}`}
              className="hidden sm:inline font-mono-tabular text-xs font-bold text-lime-300 truncate"
            >
              ☠ {bossTelegraph.name} ({bossTelegraph.hp} HP)
            </span>

            {/* Active Dynasty & Civic-Tech Status Badges */}
            {run.heroine.incubatingTile && (
              <span
                data-testid="map-stork-pod-badge"
                className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/50 font-mono-tabular text-[12px] font-bold text-pink-200 whitespace-nowrap"
              >
                🍼 {lang === 'cs' ? 'Čapí kapsle' : 'Stork Pod'}: {run.heroine.incubatingTile.nodesRemaining}n
              </span>
            )}
            {run.heroine.bloodlineCrest && (
              <span
                data-testid="map-bloodline-badge"
                className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 font-mono-tabular text-[12px] font-bold text-cyan-200 whitespace-nowrap uppercase"
              >
                ⚜ {run.heroine.bloodlineCrest.primary.slice(0, 3)}×{run.heroine.bloodlineCrest.secondary.slice(0, 3)} +{run.heroine.bloodlineCrest.bonusValue}
              </span>
            )}
            {run.heroine.nannyBotInstalled && (
              <span
                data-testid="map-nannybot-badge"
                className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 font-mono-tabular text-[12px] font-bold text-emerald-200 whitespace-nowrap"
              >
                🤖 {run.heroine.nannyBotInstalled.replace('_nanny', '').toUpperCase()}
              </span>
            )}
            {(run.heroine.heirloomStacks ?? 0) > 0 && (
              <span
                data-testid="map-heirloom-badge"
                className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 font-mono-tabular text-[12px] font-bold text-amber-200 whitespace-nowrap"
              >
                🗡 {lang === 'cs' ? 'Dědictví' : 'Heirloom'} +{run.heroine.heirloomStacks}
              </span>
            )}
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-1.5 min-w-0">
            {/* Suburban Dome Estate Charter Button */}
            {onCharterEstate && (
              <button
                type="button"
                data-testid="map-charter-estate-btn"
                disabled={estateAlreadyChartered || run.heroine.credits < 20}
                onClick={() => onCharterEstate(nextCharterLayer)}
                title={
                  lang === 'cs'
                    ? 'Založit rodinnou usedlost v dalším úseku (+5 HP ihned, +12 CR a +5 HP při vstupu)'
                    : 'Charter a Family Estate on the next stage (+5 HP now, +12 CR & +5 HP on entry)'
                }
                className="chrome-pill rounded-lg border-emerald-400/50 px-2.5 py-1 font-mono-tabular text-[12px] font-bold text-emerald-200 hover:border-emerald-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                🏡 {estateAlreadyChartered
                  ? lang === 'cs'
                    ? `Usedlost S0${nextCharterLayer + 1} ✓`
                    : `Estate S0${nextCharterLayer + 1} ✓`
                  : lang === 'cs'
                    ? `Usedlost S0${nextCharterLayer + 1} (20 CR)`
                    : `Charter Estate S0${nextCharterLayer + 1} (20 CR)`}
              </button>
            )}

            {/* Mag-Lev Express Line Skip Button */}
            {onRideMagLev && (
              <button
                type="button"
                data-testid="map-maglev-express-btn"
                disabled={!canRideMagLev}
                onClick={() => onRideMagLev()}
                title={
                  lang === 'cs'
                    ? 'Expresní Mag-Lev: přeskočí 2 úseky vpřed (+25 CR, -2 Koroze, +1 krok Čapí kapsle)'
                    : 'Mag-Lev Express Line: bridge 2 stages ahead (+25 CR, -2 Corrode, +1 Stork Pod step)'
                }
                className="chrome-pill rounded-lg border-sky-400/55 px-2.5 py-1 font-mono-tabular text-[12px] font-bold text-sky-200 hover:border-sky-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                🚄 {run.heroine.maglevUsed
                  ? lang === 'cs'
                    ? 'Mag-Lev využit ✓'
                    : 'Mag-Lev Used ✓'
                  : lang === 'cs'
                    ? 'Mag-Lev expres (+25 CR)'
                    : 'Mag-Lev Express (+25 CR)'}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLoadout}
              className={`chrome-pill flex items-center gap-1.5 rounded-lg font-mono-tabular transition-colors hover:border-cyan-300 cursor-pointer shrink-0 ${
                isCompactLandscape ? 'px-2 py-0.5 text-[12px]' : 'px-3 py-1 text-[13px]'
              }`}
            >
              <span>
                <span className="text-slate-300">{t.mapLoadoutStatus}: </span>
                <span className="font-bold text-[#00F0FF]">
                  {equippedWeight}/{run.heroine.carryCapacity}
                </span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-bold text-[#FFC700]">{run.masterPool.length}</span>
              <span className="text-slate-500">·</span>
              <span className="font-bold text-cyan-300">
                {run.heroine.nanites ?? 0} {t.nanitesShort}
              </span>
            </button>
          </div>
        </div>

        {/* Main 12-Stage (or 7/5-Stage) x 3-Lane Horizontal Sky-Bridge Tactical Schematic */}
        <div
          className={`chrome-glass relative flex flex-1 min-h-0 flex-col rounded-xl ${
            isCompactLandscape ? 'p-1.5' : 'p-2 sm:p-3'
          }`}
        >
          {/* 4-District Metropolis Navigator Bar (shown on Extended 12-Stage / 7-Stage Maps) */}
          {metropolisDistricts.length > 1 && (
            <div
              data-testid="metropolis-district-navigator"
              className="mb-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0"
            >
              {metropolisDistricts.map((dist) => {
                const isActiveDistrict =
                  currentLayer + 1 >= dist.startLayer && currentLayer <= dist.endLayer;
                return (
                  <button
                    key={dist.code}
                    type="button"
                    data-testid={`district-nav-${dist.code}`}
                    onClick={() => scrollToDistrict(dist.startLayer)}
                    className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1 text-left transition-all cursor-pointer ${
                      isActiveDistrict
                        ? 'border-cyan-300/75 bg-cyan-950/60 text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'border-white/15 bg-slate-950/55 text-slate-300 hover:border-cyan-400/50 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{ color: dist.accentColor }}
                          className="font-mono-tabular text-[11px] font-black uppercase tracking-wider shrink-0"
                        >
                          {dist.code}
                        </span>
                        <span className="font-display text-[12.5px] sm:text-[13.5px] font-bold truncate">
                          {dist.title}
                        </span>
                      </div>
                      {!isCompactLandscape && (
                        <div className="font-mono-tabular text-[11px] text-slate-300 truncate">
                          {dist.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="font-mono-tabular text-[11px] font-bold text-cyan-300 shrink-0">
                      S{String(dist.startLayer + 1).padStart(2, '0')}–S{String(dist.endLayer + 1).padStart(2, '0')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className={`flex flex-1 min-h-0 flex-col ${
              needsHorizontalPan ? 'overflow-x-auto overflow-y-auto pb-1' : 'overflow-x-hidden overflow-y-auto'
            }`}
          >
            <div
              className={`flex flex-1 min-h-0 flex-col ${
                needsHorizontalPan
                  ? totalCols >= 12
                    ? 'min-w-[1860px] min-h-[340px]'
                    : totalCols > 5
                      ? 'min-w-[1060px] min-h-[340px]'
                      : 'min-w-[880px] min-h-[340px]'
                  : 'w-full min-h-[310px]'
              }`}
            >
              {/* Column Sector Headers (offset matches Left Lane Rail) */}
              <div
                className={`flex items-stretch shrink-0 ${
                  isCompactLandscape ? 'mb-1 gap-2' : 'mb-1.5 gap-2 sm:mb-2 sm:gap-2.5'
                }`}
              >
                <div
                  className={`flex items-center justify-center rounded-md border border-cyan-500/30 bg-slate-950/60 font-mono-tabular uppercase tracking-wider text-cyan-300 font-bold shrink-0 ${
                    isCompactLandscape
                      ? 'w-28 px-1.5 py-0.5 text-[10px]'
                      : 'w-28 sm:w-36 lg:w-44 px-2 py-0.5 text-[11px] sm:text-[12px]'
                  }`}
                >
                  {t.laneShortPrefix} · {t.yieldLabel}
                </div>
                <div
                  className={`grid flex-1 ${gridColsClass} ${
                    isCompactLandscape ? 'gap-1.5' : totalCols > 5 ? 'gap-2 sm:gap-2.5' : 'gap-3 sm:gap-5 lg:gap-7'
                  }`}
                >
                  {layerIndices.map((layerIdx) => {
                    const isCurrentLayer =
                      nodeById.get(run.currentNodeId ?? '')?.layer === layerIdx;
                    const isNextLayer =
                      (nodeById.get(run.currentNodeId ?? '')?.layer ?? -1) + 1 === layerIdx;
                    const hasEstate = Boolean(run.heroine.familyEstates?.includes(layerIdx));
                    return (
                      <div
                        key={`header_${layerIdx}`}
                        className={`flex items-center justify-between rounded-md border ${
                          isCompactLandscape
                            ? 'px-1.5 py-0.5 text-[10.5px]'
                            : 'px-2 py-1 text-[11.5px] sm:text-[12.5px]'
                        } font-mono-tabular uppercase tracking-wider ${
                          isNextLayer
                            ? 'border-[#00F0FF]/65 bg-cyan-500/20 text-white font-bold shadow-[0_0_14px_rgba(0,240,255,0.2)]'
                            : isCurrentLayer
                              ? 'border-[#FFC700]/50 bg-amber-500/15 text-amber-200 font-semibold'
                              : hasEstate
                                ? 'border-emerald-400/55 bg-emerald-950/45 text-emerald-200 font-semibold'
                                : 'border-white/15 bg-slate-950/55 text-slate-300'
                        }`}
                      >
                        <span className="truncate">
                          {t.layerLabel} {String(layerIdx + 1).padStart(2, '0')} {hasEstate ? '🏡' : ''}
                        </span>
                        <span className="text-[10.5px] sm:text-[11px] opacity-85 shrink-0">
                          {((layerIdx + 1) * 0.5).toFixed(1)}KM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left 3-Row Lane Archetype Rail + Dynamic Matrix & Aligned SVG Spline Overlay */}
              <div
                className={`flex flex-1 min-h-0 w-full ${
                  isCompactLandscape ? 'gap-2' : 'gap-2 sm:gap-2.5'
                }`}
              >
                {/* Concise 3-Row Lane Archetype Rail */}
                <div
                  className={`grid grid-rows-3 shrink-0 ${
                    isCompactLandscape
                      ? 'w-28 gap-y-1'
                      : 'w-28 sm:w-36 lg:w-44 gap-y-1.5 sm:gap-y-2'
                  }`}
                >
                  {laneProfiles.map((profile) => {
                    const archLabel =
                      profile.archetype === 'gauntlet'
                        ? t.laneArchetypeGauntlet
                        : profile.archetype === 'gambler'
                          ? t.laneArchetypeGambler
                          : t.laneArchetypeMercenary;
                    const archDesc =
                      profile.archetype === 'gauntlet'
                        ? t.laneGauntletDesc
                        : profile.archetype === 'gambler'
                          ? t.laneGamblerDesc
                          : t.laneMercenaryDesc;
                    const laneColor =
                      profile.archetype === 'gauntlet'
                        ? 'text-rose-300'
                        : profile.archetype === 'gambler'
                          ? 'text-purple-300'
                          : 'text-amber-300';

                    return (
                      <div
                        key={`lane_rail_${profile.lane}`}
                        title={archDesc}
                        className={`flex flex-col justify-center rounded-lg border border-cyan-500/25 bg-cyan-950/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] min-h-0 overflow-hidden ${
                          isCompactLandscape ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-mono-tabular text-[10.5px] sm:text-[11.5px] font-black shrink-0 ${laneColor}`}>
                            0{profile.lane + 1}
                          </span>
                          <span className="font-mono-tabular text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-wider text-cyan-200 truncate">
                            {archLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono-tabular text-[10.5px] sm:text-[11.5px] font-semibold truncate">
                          <span className="text-rose-300">-{profile.totalTensionHpEst} HP</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-amber-300">+{profile.totalRunYieldCredits} CR</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Columns x 3 Rows Matrix + Exact Port-to-Port SVG Spline Overlay */}
                <div className="relative flex-1 min-h-0">
                  <svg
                    viewBox="0 0 1000 432"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    {/* 3 Horizontal Sky-Bridge Lane Guide Tracks */}
                    {LANE_TRACK_Y.map((yPos, idx) => (
                      <g key={`track_${idx}`}>
                        <line
                          x1="60"
                          y1={yPos}
                          x2="940"
                          y2={yPos}
                          stroke="rgba(56, 189, 248, 0.14)"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        <line
                          x1="60"
                          y1={yPos}
                          x2="940"
                          y2={yPos}
                          stroke="rgba(224, 242, 254, 0.22)"
                          strokeWidth="1"
                          strokeDasharray="8 8"
                        />
                      </g>
                    ))}

                    {/* Node-to-Node Cubic Bezier Conduit Edges */}
                    {run.mapNodes.map((node) => {
                      const p1 = getPortCoords(node, totalCols);
                      return node.nextIds.map((nextId) => {
                        const target = nodeById.get(nextId);
                        if (!target) return null;
                        const p2 = getPortCoords(target, totalCols);

                        const isImmediateAvailable =
                          node.id === run.currentNodeId && availableIds.has(target.id);
                        const isFocusedImmediate =
                          isImmediateAvailable && target.id === focusedNodeId;
                        const isTraversed =
                          node.cleared && (target.cleared || target.id === run.currentNodeId);
                        const isMultiHopEdge =
                          multiHopPathIds.has(node.id) && multiHopPathIds.has(target.id);
                        const isDownstreamPreview =
                          Boolean(focusedNodeId) &&
                          previewReachableIds.has(node.id) &&
                          previewReachableIds.has(target.id) &&
                          node.layer >= (focusedNode?.layer ?? 99);

                        const dx = (p2.leftX - p1.rightX) * 0.62;
                        const pathD = `M ${p1.rightX} ${p1.y} C ${p1.rightX + dx} ${p1.y}, ${p2.leftX - dx} ${p2.y}, ${p2.leftX} ${p2.y}`;

                        const strokeColor = isMultiHopEdge
                          ? '#00F0FF'
                          : isFocusedImmediate
                            ? '#FFC700'
                            : isImmediateAvailable
                              ? '#00F0FF'
                              : isTraversed
                                ? '#FFC700'
                                : isDownstreamPreview
                                  ? 'rgba(0, 240, 255, 0.78)'
                                  : 'rgba(203, 213, 225, 0.24)';

                        const strokeW =
                          isMultiHopEdge || isFocusedImmediate || isImmediateAvailable
                            ? 3.4
                            : isTraversed || isDownstreamPreview
                              ? 2.5
                              : 1.6;

                        return (
                          <g key={`${node.id}_${target.id}`}>
                            {(isMultiHopEdge || isImmediateAvailable || isDownstreamPreview) && (
                              <path
                                d={pathD}
                                fill="none"
                                stroke={isMultiHopEdge ? 'rgba(0,240,255,0.45)' : isFocusedImmediate ? 'rgba(255,199,0,0.28)' : 'rgba(0,240,255,0.25)'}
                                strokeWidth={strokeW + 5}
                              />
                            )}
                            <path
                              d={pathD}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={strokeW}
                              strokeDasharray={
                                isMultiHopEdge || isImmediateAvailable
                                  ? '8 5'
                                  : isDownstreamPreview
                                    ? '5 4'
                                    : undefined
                              }
                            />
                          </g>
                        );
                      });
                    })}
                  </svg>

                  {/* Dynamic Columns x 3 Rows Deterministic Node Matrix */}
                  <div
                    className={`relative z-10 grid h-full w-full ${gridColsClass} grid-rows-3 ${
                      isCompactLandscape
                        ? 'gap-x-1.5 gap-y-1'
                        : totalCols > 5
                          ? 'gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2'
                          : 'gap-x-3 gap-y-1.5 sm:gap-x-7 sm:gap-y-2'
                    }`}
                  >
                    {ROW_INDICES.map((rowIdx) =>
                      layerIndices.map((colIdx) => {
                        const node =
                          colIdx === 0 || colIdx === maxLayer
                            ? rowIdx === 1
                              ? layers[colIdx]?.[0]
                              : undefined
                            : layers[colIdx]?.find((n) => n.lane === rowIdx);

                        if (!node) {
                          return (
                            <div
                              key={`empty_${colIdx}_${rowIdx}`}
                              className="pointer-events-none min-h-0"
                            />
                          );
                        }

                        return (
                          <div key={node.id} className="h-full w-full min-w-0 min-h-0">
                            {renderNodeCard(node)}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Focused Node Tactical Briefing & Direct Deploy Bar */}
        {briefingNode && (() => {
          const briefingEconomy = getNodeEconomyMetrics(briefingNode, run.heroine, lang);
          const consecutiveCombat = run.heroine.consecutiveCombatWithoutClinic ?? 0;
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
            !availableIds.has(briefingNode.id) &&
            !briefingNode.cleared &&
            meshReroutesRemaining > 0 &&
            briefingNode.layer === maxClearedLayer + 1;

          return (
            <div
              className={`chrome-panel-bright flex shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl ${
                isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-[12px] sm:text-[13px]">
                <span className="font-mono-tabular font-bold text-[#00F0FF]">
                  {intelByNodeId.get(briefingNode.id)?.sectorCode}
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
                  {getRewardLabel(briefingNode.type)}
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
                {intelByNodeId.get(briefingNode.id)?.threatTraits?.[0] && (
                  <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-rose-200">
                    {intelByNodeId.get(briefingNode.id)?.threatTraits?.[0]}
                  </span>
                )}
                {consecutiveCombat >= 2 && (
                  <span className="rounded bg-amber-500/20 border border-amber-400/45 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-amber-200">
                    ⚡ +{Math.min(50, consecutiveCombat * 10)}% CR
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

                {availableIds.has(briefingNode.id) ? (
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
        })()}
      </div>
    </main>
  );
}
