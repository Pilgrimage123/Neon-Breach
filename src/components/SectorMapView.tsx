import { useEffect, useMemo, useState } from 'react';
import { MAX_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import {
  getAvailableNextNodes,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getTacticalRouteAdvice,
} from '../engine/mapGenerator';
import type { MapNode, MapNodeType, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface SectorMapViewProps {
  run: RunState;
  lang: Language;
  modalOpen?: boolean;
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
  MED_BAY: {
    border: 'border-[#10F5A0]/65',
    accent: 'text-emerald-200',
    bg: 'bg-gradient-to-b from-[#0E332C]/90 to-[#081C19]/92',
    hex: '#10F5A0',
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
  if (type === 'MED_BAY') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10F5A0" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 4.5C15.2 8.8 18.2 11.4 18.2 14.6A6.2 6.2 0 0 1 5.8 14.6C5.8 11.4 8.8 8.8 12 4.5Z" />
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
  onSelectNode,
  onOpenLoadout,
}: SectorMapViewProps) {
  const t = TRANSLATIONS[lang];
  const availableNodes = useMemo(
    () => getAvailableNextNodes(run.mapNodes, run.currentNodeId),
    [run.mapNodes, run.currentNodeId],
  );
  const availableIds = useMemo(() => new Set(availableNodes.map((n) => n.id)), [availableNodes]);
  const advice = useMemo(() => getTacticalRouteAdvice(run), [run]);

  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    if (!advice.recommendedNodeId) return 0;
    const recIdx = availableNodes.findIndex((n) => n.id === advice.recommendedNodeId);
    return recIdx >= 0 ? recIdx : 0;
  });

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
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + availableNodes.length) % availableNodes.length);
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
    () => new Map(run.mapNodes.map((n) => [n.id, getNodeEncounterIntel(n, run.seed)])),
    [run.mapNodes, run.seed],
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
      case 'ELITE':
        return t.mapRewardElite;
      case 'MED_BAY':
        return t.mapRewardMedbay;
      case 'BOSS':
        return t.mapRewardBoss;
      default:
        return t.mapRewardCombat;
    }
  };

  const renderNodeCard = (node: MapNode) => {
    const isAvailable = availableIds.has(node.id);
    const availIndex = availableIndexById.get(node.id) ?? -1;
    const isCurrent = run.currentNodeId === node.id;
    const isKeyboardFocused = focusedNodeId === node.id;
    const isRecommended = advice.recommendedNodeId === node.id && isAvailable;
    const isDownstreamFromFocus =
      !isAvailable &&
      !node.cleared &&
      !isCurrent &&
      Boolean(focusedNodeId && previewReachableIds.has(node.id));
    const isUnreachableLocked =
      !node.cleared && !isCurrent && !isAvailable && !currentReachableIds.has(node.id);

    const style = NODE_STYLE[node.type];
    const intel = intelByNodeId.get(node.id)!;

    const statusLabel = node.cleared
      ? t.nodeCleared
      : isRecommended
        ? t.mapRecommendedBadge
        : isAvailable
          ? `${t.nodeAvailable} [${availIndex + 1}]`
          : isDownstreamFromFocus
            ? t.mapDownstreamBadge
            : t.nodeLocked;

    const squadNames =
      intel.enemies.length > 0
        ? intel.enemies.map((e) => t.enemies[e.archetype].name).join(' + ')
        : t.nodeDescs[node.type];

    const bottomMetric =
      intel.totalEnemyHp > 0
        ? `${intel.enemies.length}x · ${intel.totalEnemyHp} HP`
        : node.type === 'CYBER_CLINIC'
          ? `${t.implantSlotsLabel} ${run.heroine.implants.length}/${MAX_IMPLANTS}`
          : `${t.hpLabel} ${run.heroine.hp}/${run.heroine.maxHp}`;

    return (
      <button
        key={node.id}
        type="button"
        disabled={!isAvailable}
        onMouseEnter={() => {
          if (availIndex >= 0) setSelectedIdx(availIndex);
        }}
        onFocus={() => {
          if (availIndex >= 0) setSelectedIdx(availIndex);
        }}
        onClick={() => onSelectNode(node.id)}
        className={`group relative flex h-full w-full flex-col justify-between rounded-xl border p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-all duration-150 ${
          isAvailable
            ? `${style.border} ${style.bg} ${
                isKeyboardFocused
                  ? 'ring-2 ring-[#FFC700] shadow-[0_0_26px_rgba(255,199,0,0.38),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5'
                  : 'ring-1 ring-[#00F0FF]/80 shadow-[0_0_18px_rgba(0,240,255,0.24)]'
              } hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,240,255,0.38)] cursor-pointer`
            : isCurrent
              ? 'border-[#FFC700]/80 bg-[#1B274D]/95 ring-1 ring-[#FFC700]/55 shadow-[0_0_18px_rgba(255,199,0,0.25)]'
              : node.cleared
                ? 'border-amber-300/35 bg-[#121D3D]/80 opacity-85'
                : isDownstreamFromFocus
                  ? `${style.border} bg-[#111E40]/90 opacity-95 ring-1 ring-cyan-300/40`
                  : isUnreachableLocked
                    ? 'border-white/10 bg-[#080F24]/55 text-slate-500 opacity-40 cursor-not-allowed'
                    : 'border-white/15 bg-[#0C1530]/75 text-slate-400 opacity-70 cursor-not-allowed'
        }`}
      >
        {/* Left & Right Chrome Hardware Connector Ports (desktop) */}
        {node.layer > 0 && (
          <span
            aria-hidden="true"
            className={`hidden md:block absolute -left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border ${
              isAvailable
                ? 'border-white bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]'
                : node.cleared || isCurrent
                  ? 'border-white bg-[#FFC700]'
                  : isDownstreamFromFocus
                    ? 'border-cyan-200 bg-cyan-400'
                    : 'border-slate-500 bg-slate-800'
            }`}
          />
        )}
        {node.layer < 4 && (
          <span
            aria-hidden="true"
            className={`hidden md:block absolute -right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border ${
              isCurrent
                ? 'border-white bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]'
                : node.cleared
                  ? 'border-white bg-[#FFC700]'
                  : isAvailable && isKeyboardFocused
                    ? 'border-white bg-[#00F0FF]'
                    : 'border-slate-500 bg-slate-800'
            }`}
          />
        )}

        {/* Top Row: Sector Coordinate + Unboxed Status Text */}
        <div className="flex w-full items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <NodeEmblem type={node.type} />
            <span className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-300 truncate">
              {intel.sectorCode}
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
                    : isDownstreamFromFocus
                      ? 'text-cyan-300'
                      : 'text-slate-400'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Middle Row: Node Title & Squad / Facility Subtitle */}
        <div className="my-0.5">
          <div className={`font-display text-sm font-bold leading-tight ${style.accent}`}>
            {t.nodes[node.type]}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-200/90">
            {squadNames}
          </p>
        </div>

        {/* Bottom Row: Unclipped Threat HP / Status + Unboxed Reward Metadata */}
        <div className="flex w-full items-center justify-between gap-1.5 border-t border-white/15 pt-1 text-[10px] font-mono-tabular">
          <span className="whitespace-nowrap font-bold text-white">{bottomMetric}</span>
          <span className={`truncate font-semibold ${style.accent}`}>
            {getRewardLabel(node.type)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <main className="cyber-vista-bg relative flex flex-1 flex-col justify-between overflow-y-auto px-3 py-3 sm:px-5 sm:py-3.5">
      <div className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col justify-between gap-3">
        {/* Compact Chrome Command Header + Route Advisor */}
        <div className="chrome-glass flex flex-col justify-between gap-2.5 rounded-xl px-4 py-2.5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="chrome-text-shimmer font-display text-lg font-bold tracking-wide sm:text-xl">
              {t.sectorMapTitle}
            </h1>
            <span className="font-mono-tabular text-xs font-bold text-[#00F0FF]">
              {t.layerLabel} {Math.min(5, (nodeById.get(run.currentNodeId ?? '')?.layer ?? 0) + 2)}/5
            </span>
            <span className="hidden xl:inline text-xs text-slate-300">· {t.sectorMapSubtitle}</span>
          </div>

          {/* Smart Route Advisor & Live Loadout Telemetry */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="chrome-pill flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#FFC700]">
                {t.mapAdvisorTitle}
                {advice.recommendedNodeId
                  ? ` → ${t.nodes[nodeById.get(advice.recommendedNodeId)?.type ?? 'COMBAT']}`
                  : ''}
                :
              </span>
              <span className="text-slate-100">{adviceText}</span>
            </div>

            <button
              type="button"
              onClick={onOpenLoadout}
              className="chrome-pill flex items-center gap-2.5 rounded-lg px-3 py-1.5 font-mono-tabular text-xs transition-colors hover:border-cyan-300 cursor-pointer"
            >
              <span>
                <span className="text-slate-300">{t.mapLoadoutStatus}: </span>
                <span className="font-bold text-[#00F0FF]">
                  {equippedWeight}/{run.heroine.carryCapacity}
                </span>
              </span>
              <span className="text-slate-500">·</span>
              <span>
                <span className="text-slate-300">{t.poolTotalLabel}: </span>
                <span className="font-bold text-[#FFC700]">{run.masterPool.length}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Main 5-Sector x 3-Lane Sky-Bridge Tactical Schematic */}
        <div className="chrome-glass relative flex-1 rounded-xl p-3.5 sm:p-4">
          {/* Column Sector Headers (Desktop) */}
          <div className="mb-2.5 hidden md:grid md:grid-cols-5 md:gap-7">
            {LAYER_INDICES.map((layerIdx) => {
              const isCurrentLayer =
                nodeById.get(run.currentNodeId ?? '')?.layer === layerIdx;
              const isNextLayer =
                (nodeById.get(run.currentNodeId ?? '')?.layer ?? -1) + 1 === layerIdx;
              return (
                <div
                  key={`header_${layerIdx}`}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-1 text-[11px] font-mono-tabular uppercase tracking-wider ${
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
                  <span className="text-[10px] opacity-80">{(layerIdx + 1) * 0.5} KM</span>
                </div>
              );
            })}
          </div>

          {/* Desktop 5x3 Matrix + Exact Port-to-Port SVG Spline Overlay */}
          <div className="relative hidden md:block h-[432px] w-full">
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
                  const isDownstreamPreview =
                    Boolean(focusedNodeId) &&
                    previewReachableIds.has(node.id) &&
                    previewReachableIds.has(target.id) &&
                    node.layer >= (focusedNode?.layer ?? 99);

                  const dx = (p2.leftX - p1.rightX) * 0.62;
                  const pathD = `M ${p1.rightX} ${p1.y} C ${p1.rightX + dx} ${p1.y}, ${p2.leftX - dx} ${p2.y}, ${p2.leftX} ${p2.y}`;

                  const strokeColor = isFocusedImmediate
                    ? '#FFC700'
                    : isImmediateAvailable
                      ? '#00F0FF'
                      : isTraversed
                        ? '#FFC700'
                        : isDownstreamPreview
                          ? 'rgba(0, 240, 255, 0.78)'
                          : 'rgba(203, 213, 225, 0.24)';

                  const strokeW =
                    isFocusedImmediate || isImmediateAvailable
                      ? 3.4
                      : isTraversed || isDownstreamPreview
                        ? 2.5
                        : 1.6;

                  return (
                    <g key={`${node.id}_${target.id}`}>
                      {(isImmediateAvailable || isDownstreamPreview) && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isFocusedImmediate ? 'rgba(255,199,0,0.28)' : 'rgba(0,240,255,0.25)'}
                          strokeWidth={strokeW + 5}
                        />
                      )}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        strokeDasharray={
                          isImmediateAvailable
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
            <div className="relative z-10 grid h-full w-full grid-cols-5 grid-rows-3 gap-x-7 gap-y-3.5">
              {ROW_INDICES.map((rowIdx) =>
                LAYER_INDICES.map((colIdx) => {
                  const node =
                    colIdx === 0 || colIdx === 4
                      ? rowIdx === 1
                        ? layers[colIdx][0]
                        : undefined
                      : layers[colIdx].find((n) => n.lane === rowIdx);

                  if (!node) {
                    const laneLabel =
                      colIdx === 0
                        ? rowIdx === 0
                          ? t.mapLaneNorth
                          : rowIdx === 2
                            ? t.mapLaneSouth
                            : ''
                        : '';
                    return (
                      <div
                        key={`empty_${colIdx}_${rowIdx}`}
                        className="flex items-center justify-start px-2 pointer-events-none"
                      >
                        {laneLabel && (
                          <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-slate-300/80">
                            {laneLabel}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={node.id} className="h-full w-full py-0.5">
                      {renderNodeCard(node)}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          {/* Mobile / Tablet Responsive Stacked Sector List */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {layers.map((layerNodes, layerIdx) => (
              <div key={`mob_layer_${layerIdx}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-white/15 pb-1 text-xs font-mono-tabular uppercase tracking-wider text-slate-300">
                  <span>
                    {t.layerLabel} 0{layerIdx + 1}
                  </span>
                  <span>{(layerIdx + 1) * 0.5} KM</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {layerNodes.map((node) => renderNodeCard(node))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Focused Node Tactical Briefing & Direct Deploy Bar */}
        {focusedNode && (
          <div className="chrome-panel-bright flex flex-col items-start justify-between gap-2.5 rounded-xl px-4 py-2.5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-mono-tabular font-bold text-[#00F0FF]">
                {intelByNodeId.get(focusedNode.id)?.sectorCode}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-display text-sm font-bold text-white">
                {t.nodes[focusedNode.type]}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-mono-tabular font-semibold text-[#FFC700]">
                {getRewardLabel(focusedNode.type)}
              </span>
              <span aria-hidden="true" className="hidden md:inline text-slate-400">
                ·
              </span>
              <span className="font-mono-tabular text-slate-200">
                {t.mapOpensNext}:{' '}
                {focusedNode.nextIds
                  .map((id) => nodeById.get(id))
                  .filter((n): n is MapNode => Boolean(n))
                  .map((n) => t.nodes[n.type])
                  .join(' / ') || t.nodes.BOSS}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectNode(focusedNode.id)}
              className="chrome-btn-primary w-full sm:w-auto rounded-lg px-5 py-2 font-display text-sm font-bold transition-transform hover:-translate-y-0.5 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {t.enterNode}: {t.nodes[focusedNode.type]} [Enter]
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
