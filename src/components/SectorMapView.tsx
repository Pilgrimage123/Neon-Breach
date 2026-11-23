import { useEffect, useMemo, useRef, useState } from 'react';
import { getMetropolisDistricts } from '../engine/mapGenerator';
import {
  getAvailableNextNodes,
  getBossTelegraphIntel,
  getConnectingPathNodeIds,
  getLaneClusterProfiles,
  getNodeEncounterIntel,
  getReachableNodeIds,
  getTacticalRouteAdvice,
} from '../engine/mapTacticalIntel';
import { getEquippedChipMemory } from '../engine/poolBuilder';
import type { RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  resolveSemanticZoomLoD,
  type SemanticZoomLevel,
} from '../utils/accessibilityAndScale';
import {
  MetropolisDistrictNavigator,
  SectorCommandBar,
  SettlementGrowthStrip,
} from './sectorMap/SectorCommandBar';
import { SectorNodeBriefingBar } from './sectorMap/SectorNodeBriefingBar';
import { SectorNodeCard } from './sectorMap/SectorNodeCard';
import {
  LANE_TRACK_Y,
  ROW_INDICES,
  formatStageCode,
  getPortCoords,
} from './sectorMap/sectorMapTheme';

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
  const difficultyTier = run.difficultyTier ?? 3;
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
    () => getLaneClusterProfiles(run.mapNodes, run.hero, lang, difficultyTier),
    [run.mapNodes, run.hero, lang, difficultyTier],
  );
  const bossTelegraph = useMemo(
    () => getBossTelegraphIntel(lang, difficultyTier),
    [lang, difficultyTier],
  );
  const hasRecon =
    run.hero.implants.includes('synapse_overclock') ||
    run.hero.implants.includes('surge_resonator');

  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    if (!advice.recommendedNodeId) return 0;
    const recIdx = availableNodes.findIndex((n) => n.id === advice.recommendedNodeId);
    return recIdx >= 0 ? recIdx : 0;
  });

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
  const effectiveTargetId = inspectedTargetId ?? focusedNodeId;

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
    () =>
      new Map(
        run.mapNodes.map((n) => [
          n.id,
          getNodeEncounterIntel(n, run.seed, lang, difficultyTier),
        ]),
      ),
    [run.mapNodes, run.seed, lang, difficultyTier],
  );

  const layers = useMemo(
    () =>
      layerIndices.map((layer) =>
        run.mapNodes.filter((n) => n.layer === layer).sort((a, b) => a.lane - b.lane),
      ),
    [layerIndices, run.mapNodes],
  );

  const nodeById = useMemo(() => new Map(run.mapNodes.map((n) => [n.id, n])), [run.mapNodes]);
  const equippedWeight = useMemo(() => getEquippedChipMemory(run.hero), [run.hero]);
  const inspectedNode = inspectedTargetId ? nodeById.get(inspectedTargetId) : null;
  const briefingNode = inspectedNode ?? focusedNode;

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
    totalCols === 12 ? 'grid-cols-12' : totalCols === 7 ? 'grid-cols-7' : 'grid-cols-5';
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : 0;
  const nextCharterLayer = Math.min(maxLayer, maxClearedLayer + 1);
  const estateAlreadyChartered = Boolean(run.hero.familyEstates?.includes(nextCharterLayer));
  const canRideMagLev =
    !run.hero.maglevUsed && clearedNodes.length > 0 && maxClearedLayer + 2 <= maxLayer - 1;
  const maxMeshReroutes = totalCols >= 7 ? 2 : 1;
  const meshReroutesRemaining = Math.max(0, maxMeshReroutes - (run.hero.meshReroutesUsed ?? 0));

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
        <SectorCommandBar
          run={run}
          lang={lang}
          isCompactLandscape={isCompactLandscape}
          totalCols={totalCols}
          currentNodeLayer={nodeById.get(run.currentNodeId ?? '')?.layer ?? 0}
          bossTelegraph={bossTelegraph}
          nextCharterLayer={nextCharterLayer}
          estateAlreadyChartered={estateAlreadyChartered}
          canRideMagLev={canRideMagLev}
          equippedWeight={equippedWeight}
          onOpenLoadout={onOpenLoadout}
          onCharterEstate={onCharterEstate}
          onRideMagLev={onRideMagLev}
        />

        <div
          className={`chrome-glass relative flex flex-1 min-h-0 flex-col rounded-xl ${
            isCompactLandscape ? 'p-1.5' : 'p-2 sm:p-3'
          }`}
        >
          <SettlementGrowthStrip
            lang={lang}
            clearedStages={run.mapNodes.reduce(
              (acc, node) => (node.cleared ? Math.max(acc, node.layer + 1) : acc),
              0,
            )}
            isCompactLandscape={isCompactLandscape}
          />
          <MetropolisDistrictNavigator
            metropolisDistricts={metropolisDistricts}
            currentLayer={currentLayer}
            isCompactLandscape={isCompactLandscape}
            onScrollToDistrict={scrollToDistrict}
          />

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
                    const hasEstate = Boolean(run.hero.familyEstates?.includes(layerIdx));
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
                          {formatStageCode(layerIdx)} · {t.layerLabel} {String(layerIdx + 1).padStart(2, '0')} {hasEstate ? '🏡' : ''}
                        </span>
                        <span className="text-[10.5px] sm:text-[11px] opacity-85 shrink-0">
                          {((layerIdx + 1) * 0.5).toFixed(1)}KM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className={`flex flex-1 min-h-0 w-full ${
                  isCompactLandscape ? 'gap-2' : 'gap-2 sm:gap-2.5'
                }`}
              >
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

                <div className="relative flex-1 min-h-0">
                  <svg
                    viewBox="0 0 1000 432"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
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

                        return (
                          <div key={node.id} className="h-full w-full min-w-0 min-h-0">
                            <SectorNodeCard
                              node={node}
                              run={run}
                              lang={lang}
                              maxLayer={maxLayer}
                              totalCols={totalCols}
                              isAvailable={isAvailable}
                              availIndex={availIndex}
                              isCurrent={isCurrent}
                              isKeyboardFocused={isKeyboardFocused}
                              isRecommended={isRecommended}
                              isInspected={isInspected}
                              isMultiHopPath={isMultiHopPath}
                              isDownstreamFromFocus={isDownstreamFromFocus}
                              isUnreachableLocked={isUnreachableLocked}
                              hasRecon={hasRecon}
                              intel={intelByNodeId.get(node.id)}
                              lod={lod}
                              hcBorderClass={hcBorderClass}
                              isCompactLandscape={isCompactLandscape}
                              twoStepConfirm={twoStepConfirm}
                              selectedIdx={selectedIdx}
                              lastPointerTypeRef={lastPointerTypeRef}
                              onHoverOrFocus={(idx, id) => {
                                if (idx >= 0) {
                                  setSelectedIdx(idx);
                                  setInspectedTargetId(null);
                                } else {
                                  setInspectedTargetId(id);
                                }
                              }}
                              onFocusAvailableIndex={(idx) => {
                                setSelectedIdx(idx);
                                setInspectedTargetId(null);
                              }}
                              onSelectAvailable={onSelectNode}
                              onInspectNode={setInspectedTargetId}
                            />
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

        {briefingNode && (
          <SectorNodeBriefingBar
            briefingNode={briefingNode}
            run={run}
            lang={lang}
            isCompactLandscape={isCompactLandscape}
            isAvailable={availableIds.has(briefingNode.id)}
            hasRecon={hasRecon}
            intel={intelByNodeId.get(briefingNode.id)}
            maxClearedLayer={maxClearedLayer}
            meshReroutesRemaining={meshReroutesRemaining}
            onSelectNode={onSelectNode}
            onRerouteMeshNet={onRerouteMeshNet}
          />
        )}
      </div>
    </main>
  );
}
