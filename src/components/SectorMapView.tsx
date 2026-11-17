import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import {
  getAvailableNextNodes,
  getBossTelegraphIntel,
  getConnectingPathNodeIds,
  getLaneClusterProfiles,
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
}

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

const LAYER_INDICES = [0, 1, 2, 3, 4] as const;
const ROW_INDICES = [0, 1, 2] as const;
const LANE_TRACK_Y = [72, 216, 360] as const;

function getVisualRow(node: MapNode): number {
  return node.layer === 0 || node.layer === 4 ? 1 : node.lane;
}

function getPortCoords(node: MapNode) {
  const colSpan = 177.6; // (1000 - 4 * 28) / 5
  const colGap = 28;
  const colLeft = node.layer * (colSpan + colGap);
  const colRight = colLeft + colSpan;
  const rowIndex = getVisualRow(node);
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
}: SectorMapViewProps) {
  const t = TRANSLATIONS[lang];
  const lod = useMemo(
    () => resolveSemanticZoomLoD(semanticZoom, tacticalView),
    [semanticZoom, tacticalView],
  );
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';
  const lastPointerTypeRef = useRef<string>('mouse');
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
      LAYER_INDICES.map((layer) =>
        run.mapNodes.filter((n) => n.layer === layer).sort((a, b) => a.lane - b.lane),
      ),
    [run.mapNodes],
  );

  const nodeById = useMemo(() => new Map(run.mapNodes.map((n) => [n.id, n])), [run.mapNodes]);

  const equippedWeight = useMemo(
    () => getEquippedEquipmentWeight(run.heroine),
    [run.heroine],
  );

  const adviceText =
    advice.reasonKey === 'low_hp_medbay'
      ? t.mapAdviceLowHp
      : advice.reasonKey === 'elite_power_spike'
        ? t.mapAdviceElite
        : advice.reasonKey === 'clinic_socket'
          ? t.mapAdviceClinic
          : advice.reasonKey === 'boss_engage'
            ? t.mapAdviceBoss
            : t.mapAdviceCombat;

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
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[9px] font-black leading-none"
                >
                  {nodePip.symbol}
                </span>
                <NodeEmblem type={node.type} />
                <span className={`font-display text-[11px] sm:text-xs font-bold leading-tight truncate ${style.accent}`}>
                  {t.nodes[node.type]}
                </span>
              </div>
              <span
                className={`shrink-0 font-mono-tabular text-[8px] font-bold uppercase tracking-wider ${
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

            <div className="flex w-full items-center justify-between gap-1.5 text-[9px] font-mono-tabular min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate font-sans text-slate-200/95">{squadNames}</span>
                {econ.tensionHpPct !== 0 && (
                  <span
                    className={`shrink-0 px-1 py-0.2 rounded text-[7.5px] font-bold ${
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
            {node.layer < 4 && (
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
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[9px] font-black leading-none"
                >
                  {nodePip.symbol}
                </span>
                <NodeEmblem type={node.type} />
                <span className="font-mono-tabular text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-300 truncate">
                  {intel.sectorCode}
                </span>
              </div>
              <span
                className={`shrink-0 font-mono-tabular text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
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
              <div className="flex items-center gap-1 min-w-0 flex-wrap sm:flex-wrap">
                <div className={`font-display text-xs sm:text-sm font-bold leading-tight truncate ${style.accent}`}>
                  {t.nodes[node.type]}
                </div>
                <div className="flex items-center gap-1 min-w-0 flex-nowrap sm:flex-wrap overflow-hidden">
                  {/* Hot-Spot Bounty Modifier Badges */}
                  {node.modifier === 'golden_bounty' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-amber-400/25 border border-amber-300/60 text-amber-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight">
                      {t.bountyGoldenBadge}
                    </span>
                  )}
                  {node.modifier === 'double_credits' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-emerald-400/25 border border-emerald-300/60 text-emerald-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight">
                      {t.bountyDoubleBadge}
                    </span>
                  )}
                  {node.modifier === 'nanite_cache' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-cyan-400/25 border border-cyan-300/60 text-cyan-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight">
                      {t.bountyNaniteBadge}
                    </span>
                  )}
                  {/* Dynamic Modifiers */}
                  {node.modifier === 'overcharged_hazard' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-rose-500/25 border border-rose-400/60 text-rose-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight">
                      {t.bountyOverchargedBadge}
                    </span>
                  )}
                  {node.modifier === 'flash_sale' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-amber-400/25 border border-amber-300/60 text-amber-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight animate-pulse">
                      {t.bountyFlashSaleBadge}
                    </span>
                  )}
                  {node.modifier === 'funded_clinic' && (
                    <span className="shrink-0 whitespace-nowrap px-1 py-0.2 rounded bg-emerald-400/25 border border-emerald-300/60 text-emerald-300 text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight">
                      {t.bountyFundedClinicBadge}
                    </span>
                  )}
                  {/* Smart Shop Badges */}
                  {(node.type === 'CHIP_DEALER' || node.type === 'CYBER_CLINIC') && (
                    <span
                      className={`shrink-0 whitespace-nowrap px-1 py-0.2 rounded text-[7px] sm:text-[7.5px] font-bold font-mono-tabular leading-tight border ${
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
              <p className="mt-0.5 line-clamp-1 text-[9px] sm:text-[11px] leading-tight sm:leading-snug text-slate-200/90">
                {squadNames}
              </p>
            </div>

            {/* Bottom Row: Threat HP / Status + Reward Metadata */}
            <div className="flex w-full items-center justify-between gap-2 border-t border-white/15 pt-0.5 sm:pt-1 text-[9px] sm:text-[10px] font-mono-tabular min-w-0">
              <div className="flex items-center gap-1 shrink-0">
                <span className="whitespace-nowrap font-bold text-white">{bottomMetric}</span>
                {econ.tensionHpPct !== 0 && (
                  <span
                    title={econ.opportunityCost}
                    className={`px-1 py-0.2 rounded text-[7.5px] sm:text-[8px] font-bold shrink-0 ${
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
              <span className={`min-w-0 flex-1 truncate text-right font-semibold ${style.accent}`}>
                {getRewardLabel(node.type)}
              </span>
            </div>
          </>
        )}
      </button>
    );
  };

  const needsHorizontalPan = isNarrowPortrait || effectiveWidth < 560;

  return (
    <main
      className={`cyber-vista-bg relative flex flex-1 min-h-0 flex-col justify-between overflow-hidden ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3 py-2 sm:px-5 sm:py-3'
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1380px] flex-1 min-h-0 flex-col justify-between ${
          isCompactLandscape ? 'gap-1' : 'gap-2 sm:gap-2.5'
        }`}
      >
        {/* Unified Single-Row Sector Command Bar: Layer Progress · Boss Intel · Advisor · Loadout */}
        <div
          className={`chrome-glass flex shrink-0 flex-wrap lg:flex-nowrap items-center justify-between gap-2 rounded-xl ${
            isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <h1
              className={`chrome-text-shimmer font-display font-bold tracking-wide whitespace-nowrap ${
                isCompactLandscape ? 'text-sm' : 'text-base sm:text-lg'
              }`}
            >
              {t.sectorMapTitle}
            </h1>
            <span className="font-mono-tabular text-xs font-bold text-[#00F0FF] whitespace-nowrap">
              {Math.min(5, (nodeById.get(run.currentNodeId ?? '')?.layer ?? 0) + 2)}/5
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
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 min-w-0">
            <span className="hidden xl:inline text-xs font-medium text-amber-200/95 truncate max-w-[34ch]">
              ★{' '}
              {advice.recommendedNodeId
                ? `${t.nodes[nodeById.get(advice.recommendedNodeId)?.type ?? 'COMBAT']}: `
                : ''}
              {adviceText}
            </span>

            <button
              type="button"
              onClick={onOpenLoadout}
              className={`chrome-pill flex items-center gap-1.5 rounded-lg font-mono-tabular transition-colors hover:border-cyan-300 cursor-pointer shrink-0 ${
                isCompactLandscape ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
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

        {/* Main 5-Sector x 3-Lane Horizontal Sky-Bridge Tactical Schematic */}
        <div
          className={`chrome-glass relative flex flex-1 min-h-0 flex-col rounded-xl ${
            isCompactLandscape ? 'p-1.5' : 'p-2 sm:p-3'
          }`}
        >
          <div
            className={`flex flex-1 min-h-0 flex-col ${
              needsHorizontalPan ? 'overflow-x-auto overflow-y-auto pb-1' : 'overflow-x-hidden overflow-y-auto'
            }`}
          >
            <div
              className={`flex flex-1 min-h-0 flex-col ${
                needsHorizontalPan ? 'min-w-[880px] min-h-[340px]' : 'w-full min-h-[310px]'
              }`}
            >
              {/* Column Sector Headers (offset matches Left Lane Rail) */}
              <div
                className={`flex items-stretch shrink-0 ${
                  isCompactLandscape ? 'mb-1 gap-2' : 'mb-1.5 gap-2 sm:mb-2 sm:gap-3'
                }`}
              >
                <div
                  className={`flex items-center justify-center rounded-md border border-cyan-500/30 bg-slate-950/60 font-mono-tabular uppercase tracking-wider text-cyan-300 font-bold shrink-0 ${
                    isCompactLandscape
                      ? 'w-28 px-1.5 py-0.5 text-[8px]'
                      : 'w-28 md:w-36 lg:w-44 px-2 py-0.5 text-[9px] sm:text-[10px]'
                  }`}
                >
                  {t.laneShortPrefix} · {t.yieldLabel}
                </div>
                <div
                  className={`grid flex-1 grid-cols-5 ${
                    isCompactLandscape ? 'gap-2' : 'gap-3 sm:gap-7'
                  }`}
                >
                  {LAYER_INDICES.map((layerIdx) => {
                    const isCurrentLayer =
                      nodeById.get(run.currentNodeId ?? '')?.layer === layerIdx;
                    const isNextLayer =
                      (nodeById.get(run.currentNodeId ?? '')?.layer ?? -1) + 1 === layerIdx;
                    return (
                      <div
                        key={`header_${layerIdx}`}
                        className={`flex items-center justify-between rounded-md border ${
                          isCompactLandscape
                            ? 'px-1.5 py-0.5 text-[9px]'
                            : 'px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px]'
                        } font-mono-tabular uppercase tracking-wider ${
                          isNextLayer
                            ? 'border-[#00F0FF]/65 bg-cyan-500/20 text-white font-bold shadow-[0_0_14px_rgba(0,240,255,0.2)]'
                            : isCurrentLayer
                              ? 'border-[#FFC700]/50 bg-amber-500/15 text-amber-200 font-semibold'
                              : 'border-white/15 bg-slate-950/55 text-slate-300'
                        }`}
                      >
                        <span>
                          {t.layerLabel} 0{layerIdx + 1}
                        </span>
                        <span className="text-[8px] sm:text-[10px] opacity-80">
                          {(layerIdx + 1) * 0.5} KM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left 3-Row Lane Archetype Rail + 5x3 Matrix & Aligned SVG Spline Overlay */}
              <div
                className={`flex flex-1 min-h-0 w-full ${
                  isCompactLandscape ? 'gap-2' : 'gap-2 sm:gap-3'
                }`}
              >
                {/* Concise 3-Row Lane Archetype Rail */}
                <div
                  className={`grid grid-rows-3 shrink-0 ${
                    isCompactLandscape
                      ? 'w-24 gap-y-1'
                      : 'w-24 sm:w-32 gap-y-1.5 sm:gap-y-2'
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
                          isCompactLandscape ? 'px-1.5 py-0.5' : 'px-2 py-1'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-mono-tabular text-[8px] sm:text-[9px] font-black shrink-0 ${laneColor}`}>
                            0{profile.lane + 1}
                          </span>
                          <span className="font-mono-tabular text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-cyan-200 truncate">
                            {archLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono-tabular text-[8px] sm:text-[9px] font-semibold truncate">
                          <span className="text-rose-300">-{profile.totalTensionHpEst} HP</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-amber-300">+{profile.totalRunYieldCredits} CR</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 5x3 Matrix + Exact Port-to-Port SVG Spline Overlay */}
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
                          x1="80"
                          y1={yPos}
                          x2="920"
                          y2={yPos}
                          stroke="rgba(56, 189, 248, 0.14)"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        <line
                          x1="80"
                          y1={yPos}
                          x2="920"
                          y2={yPos}
                          stroke="rgba(224, 242, 254, 0.22)"
                          strokeWidth="1"
                          strokeDasharray="8 8"
                        />
                      </g>
                    ))}

                    {/* Node-to-Node Cubic Bezier Conduit Edges */}
                    {run.mapNodes.map((node) => {
                      const p1 = getPortCoords(node);
                      return node.nextIds.map((nextId) => {
                        const target = nodeById.get(nextId);
                        if (!target) return null;
                        const p2 = getPortCoords(target);

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

                  {/* 5 Columns x 3 Rows Deterministic Node Matrix */}
                  <div
                    className={`relative z-10 grid h-full w-full grid-cols-5 grid-rows-3 ${
                      isCompactLandscape
                        ? 'gap-x-2 gap-y-1'
                        : 'gap-x-3 gap-y-1.5 sm:gap-x-7 sm:gap-y-2'
                    }`}
                  >
                    {ROW_INDICES.map((rowIdx) =>
                      LAYER_INDICES.map((colIdx) => {
                        const node =
                          colIdx === 0 || colIdx === 4
                            ? rowIdx === 1
                              ? layers[colIdx][0]
                              : undefined
                            : layers[colIdx].find((n) => n.lane === rowIdx);

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

          return (
            <div
              className={`chrome-panel-bright flex shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl ${
                isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-[10px] sm:text-xs">
                <span className="font-mono-tabular font-bold text-[#00F0FF]">
                  {intelByNodeId.get(briefingNode.id)?.sectorCode}
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="font-display text-xs sm:text-sm font-bold text-white">
                  {t.nodes[briefingNode.type]}
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-slate-500">
                  ·
                </span>
                <span className="hidden sm:inline text-slate-200 truncate max-w-md">
                  {t.nodeDescs[briefingNode.type]}
                </span>
                <span className="rounded bg-slate-900/80 border border-white/10 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#FFC700]">
                  {getRewardLabel(briefingNode.type)}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold ${
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
                  <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 font-mono-tabular text-[9px] font-bold text-rose-200">
                    {intelByNodeId.get(briefingNode.id)?.threatTraits?.[0]}
                  </span>
                )}
                {consecutiveCombat >= 2 && (
                  <span className="rounded bg-amber-500/20 border border-amber-400/45 px-1.5 py-0.5 font-mono-tabular text-[9px] font-bold text-amber-200">
                    ⚡ +{Math.min(50, consecutiveCombat * 10)}% CR
                  </span>
                )}
                {hasRecon && reconDetail && (
                  <span
                    title={reconDetail}
                    className="rounded bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.5 font-mono-tabular text-[9px] font-bold text-cyan-200 truncate max-w-[260px]"
                  >
                    ✦ {reconDetail}
                  </span>
                )}
              </div>

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
          );
        })()}
      </div>
    </main>
  );
}
