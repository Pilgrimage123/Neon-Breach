import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
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
} from './sectorMap/SectorCommandBar';
import { SectorNodeBriefingBar } from './sectorMap/SectorNodeBriefingBar';
import { SectorNodeCard } from './sectorMap/SectorNodeCard';
import {
  computeMapTrackLayout,
  computePixelPortCoords,
  computeStageScrollTarget,
} from './sectorMap/sectorMapLayout';
import { ROW_INDICES, formatStageCode } from './sectorMap/sectorMapTheme';

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

  const layout = useMemo(
    () =>
      computeMapTrackLayout({
        totalCols,
        effectiveWidth,
        isCompactLandscape,
        isNarrowPortrait,
        isOverviewZoom: semanticZoom === 'overview',
      }),
    [totalCols, effectiveWidth, isCompactLandscape, isNarrowPortrait, semanticZoom],
  );

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
    if (modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectedTargetId) {
        e.preventDefault();
        setInspectedTargetId(null);
        return;
      }
      if (availableNodes.length === 0) return;
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
  }, [availableNodes, inspectedTargetId, modalOpen, onSelectNode, selectedIdx]);

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
  const gridCanvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>(() => ({
    width: layout.minGridWidthPx,
    height: isCompactLandscape ? 290 : 420,
  }));
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
  }>({ active: false, startX: 0, startScrollLeft: 0 });
  const didDragRef = useRef(false);

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

  const clearedStages = useMemo(
    () =>
      run.mapNodes.reduce(
        (acc, node) => (node.cleared ? Math.max(acc, node.layer + 1) : acc),
        0,
      ),
    [run.mapNodes],
  );

  const updateScrollAffordances = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    setCanScrollLeft(container.scrollLeft > 8);
    setCanScrollRight(maxScroll - container.scrollLeft > 8);
  }, []);

  useEffect(() => {
    const el = gridCanvasRef.current;
    if (!el) return;
    const syncSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.max(layout.minGridWidthPx, Math.round(rect.width));
      const nextH = Math.max(240, Math.round(rect.height));
      setCanvasSize((prev) =>
        prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH },
      );
      updateScrollAffordances();
    };
    syncSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.minGridWidthPx, updateScrollAffordances]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetLeft = computeStageScrollTarget({
      targetLayer: currentLayer,
      totalCols,
      gridWidthPx: canvasSize.width,
      colGapPx: layout.colGapPx,
      containerClientWidth: container.clientWidth,
      railWidthPx: layout.railWidthPx,
      railGapPx: layout.railGapPx,
      mode: 'focus',
    });
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [
    currentLayer,
    totalCols,
    canvasSize.width,
    layout.colGapPx,
    layout.railWidthPx,
    layout.railGapPx,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    updateScrollAffordances();
    const onScroll = () => updateScrollAffordances();
    const onWheel = (e: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onScroll);
    };
  }, [updateScrollAffordances]);

  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      const container = scrollContainerRef.current;
      if (!drag.active || !container) return;
      const dx = e.clientX - drag.startX;
      if (Math.abs(dx) >= 6) {
        didDragRef.current = true;
        setIsDraggingTrack(true);
      }
      if (didDragRef.current) {
        container.scrollLeft = drag.startScrollLeft - dx;
      }
    };
    const onWindowMouseUp = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      setIsDraggingTrack(false);
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, []);

  const handleTrackMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = scrollContainerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: container.scrollLeft,
    };
    didDragRef.current = false;
  };

  const handleTrackClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  };

  const scrollToDistrict = (startLayer: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetLeft = computeStageScrollTarget({
      targetLayer: startLayer,
      totalCols,
      gridWidthPx: canvasSize.width,
      colGapPx: layout.colGapPx,
      containerClientWidth: container.clientWidth,
      railWidthPx: layout.railWidthPx,
      railGapPx: layout.railGapPx,
      mode: 'districtStart',
    });
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  const panByColumns = (direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const step = (layout.minColWidthPx + layout.colGapPx) * 1.5 * direction;
    container.scrollBy({ left: Math.round(step), behavior: 'smooth' });
  };

  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : 0;
  const nextCharterLayer = Math.min(maxLayer, maxClearedLayer + 1);
  const estateAlreadyChartered = Boolean(run.hero.familyEstates?.includes(nextCharterLayer));
  const canRideMagLev =
    !run.hero.maglevUsed && clearedNodes.length > 0 && maxClearedLayer + 2 <= maxLayer - 1;
  const maxMeshReroutes = totalCols >= 7 ? 2 : 1;
  const meshReroutesRemaining = Math.max(0, maxMeshReroutes - (run.hero.meshReroutesUsed ?? 0));

  const rowHeight = Math.max(40, (canvasSize.height - 2 * layout.rowGapPx) / 3);
  const laneTrackYs = ROW_INDICES.map(
    (rowIdx) => rowIdx * (rowHeight + layout.rowGapPx) + rowHeight / 2,
  );
  const gridStyle = {
    gridTemplateColumns: `repeat(${totalCols}, minmax(${layout.minColWidthPx}px, 1fr))`,
    columnGap: `${layout.colGapPx}px`,
  };

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
          <MetropolisDistrictNavigator
            metropolisDistricts={metropolisDistricts}
            currentLayer={currentLayer}
            clearedStages={clearedStages}
            lang={lang}
            isCompactLandscape={isCompactLandscape}
            onScrollToDistrict={scrollToDistrict}
          />

          <div className="relative flex flex-1 min-h-0 flex-col">
            {canScrollLeft && (
              <>
                <div
                  aria-hidden="true"
                  style={{ left: `${layout.railWidthPx + layout.railGapPx}px` }}
                  className="pointer-events-none absolute top-0 bottom-0 z-20 w-10 bg-gradient-to-r from-[#070E24]/85 to-transparent"
                />
                <button
                  type="button"
                  data-testid="map-pan-left-btn"
                  aria-label={lang === 'cs' ? 'Posunout mapu doleva' : 'Scroll map left'}
                  onClick={() => panByColumns(-1)}
                  style={{ left: `${layout.railWidthPx + layout.railGapPx + 6}px` }}
                  className="absolute top-1/2 z-40 -translate-y-1/2 flex h-9 w-7 items-center justify-center rounded-lg border border-cyan-400/50 bg-[#070E24]/90 text-cyan-200 shadow-[0_0_14px_rgba(0,240,255,0.25)] hover:border-cyan-300 hover:text-white cursor-pointer"
                >
                  ‹
                </button>
              </>
            )}

            {canScrollRight && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-10 bg-gradient-to-l from-[#070E24]/85 to-transparent"
                />
                <button
                  type="button"
                  data-testid="map-pan-right-btn"
                  aria-label={lang === 'cs' ? 'Posunout mapu doprava' : 'Scroll map right'}
                  onClick={() => panByColumns(1)}
                  className="absolute top-1/2 right-1.5 z-40 -translate-y-1/2 flex h-9 w-7 items-center justify-center rounded-lg border border-cyan-400/50 bg-[#070E24]/90 text-cyan-200 shadow-[0_0_14px_rgba(0,240,255,0.25)] hover:border-cyan-300 hover:text-white cursor-pointer"
                >
                  ›
                </button>
              </>
            )}

            <div
              ref={scrollContainerRef}
              onMouseDown={handleTrackMouseDown}
              onClickCapture={handleTrackClickCapture}
              className={`flex flex-1 min-h-0 flex-col overflow-x-auto overflow-y-auto pb-1 select-none ${
                isDraggingTrack ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                style={{ minWidth: `${layout.minTrackWidthPx}px` }}
                className="flex w-full flex-1 min-h-[290px] flex-col"
              >
                <div
                  style={{ columnGap: `${layout.railGapPx}px` }}
                  className={`flex items-stretch shrink-0 ${
                    isCompactLandscape ? 'mb-1' : 'mb-1.5 sm:mb-2'
                  }`}
                >
                  <div
                    style={{ width: `${layout.railWidthPx}px` }}
                    className="sticky left-0 z-30 flex items-center justify-center rounded-md border border-cyan-500/35 bg-[#070E24]/95 backdrop-blur-md px-1.5 py-1 font-mono-tabular text-[10.5px] sm:text-[11px] uppercase tracking-wider text-cyan-300 font-bold shrink-0 shadow-[6px_0_16px_rgba(2,6,23,0.7)]"
                  >
                    {isNarrowPortrait ? t.laneShortPrefix : `${t.laneShortPrefix} · ${t.yieldLabel}`}
                  </div>

                  <div style={gridStyle} className="grid flex-1 min-w-0">
                    {layerIndices.map((layerIdx) => {
                      const isCurrentLayer =
                        nodeById.get(run.currentNodeId ?? '')?.layer === layerIdx;
                      const isNextLayer =
                        (nodeById.get(run.currentNodeId ?? '')?.layer ?? -1) + 1 === layerIdx;
                      const hasEstate = Boolean(run.hero.familyEstates?.includes(layerIdx));
                      const district = metropolisDistricts.find(
                        (d) => layerIdx >= d.startLayer && layerIdx <= d.endLayer,
                      );
                      const isDistrictBoundary =
                        totalCols >= 9 && layerIdx > 0 && layerIdx % 3 === 0;

                      return (
                        <div
                          key={`header_${layerIdx}`}
                          style={{
                            borderTopColor: district?.accentColor ?? undefined,
                            borderTopWidth: district ? '2px' : undefined,
                          }}
                          className={`relative flex items-center justify-between rounded-md border ${
                            isCompactLandscape
                              ? 'px-2 py-0.5 text-[10.5px]'
                              : 'px-2.5 py-1 text-[11.5px] sm:text-[12px]'
                          } font-mono-tabular uppercase tracking-wider ${
                            isNextLayer
                              ? 'border-[#00F0FF]/65 bg-cyan-500/20 text-white font-bold shadow-[0_0_14px_rgba(0,240,255,0.2)]'
                              : isCurrentLayer
                                ? 'border-[#FFC700]/55 bg-amber-500/15 text-amber-200 font-semibold'
                                : hasEstate
                                  ? 'border-emerald-400/55 bg-emerald-950/45 text-emerald-200 font-semibold'
                                  : 'border-white/15 bg-slate-950/60 text-slate-300'
                          }`}
                        >
                          {isDistrictBoundary && (
                            <span
                              aria-hidden="true"
                              style={{ left: `-${Math.round(layout.colGapPx / 2)}px` }}
                              className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-400/35"
                            />
                          )}
                          <span className="truncate">
                            {formatStageCode(layerIdx)} · {t.layerLabel} {String(layerIdx + 1).padStart(2, '0')} {hasEstate ? '🏡' : ''}
                          </span>
                          <span className="text-[10.5px] opacity-85 shrink-0">
                            {((layerIdx + 1) * 0.5).toFixed(1)}KM
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{ columnGap: `${layout.railGapPx}px` }}
                  className="flex flex-1 min-h-0 w-full"
                >
                  <div
                    style={{
                      width: `${layout.railWidthPx}px`,
                      rowGap: `${layout.rowGapPx}px`,
                    }}
                    className="sticky left-0 z-30 grid grid-rows-3 shrink-0 bg-[#070E24]/92 backdrop-blur-md rounded-lg pr-1 shadow-[6px_0_16px_rgba(2,6,23,0.7)]"
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
                          title={`${archLabel}: ${archDesc}`}
                          className={`flex flex-col justify-center rounded-lg border border-cyan-500/25 bg-cyan-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] min-h-0 overflow-hidden ${
                            isNarrowPortrait
                              ? 'items-center px-1 py-0.5 text-center'
                              : isCompactLandscape
                                ? 'px-1.5 py-0.5'
                                : 'px-2 py-1'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`font-mono-tabular text-[11px] font-black shrink-0 ${laneColor}`}>
                              0{profile.lane + 1}
                            </span>
                            {!isNarrowPortrait && (
                              <span className="font-mono-tabular text-[10.5px] font-bold uppercase tracking-wider text-cyan-200 truncate">
                                {archLabel}
                              </span>
                            )}
                          </div>
                          {isNarrowPortrait ? (
                            <div className="mt-0.5 flex flex-col font-mono-tabular text-[9.5px] font-semibold leading-tight">
                              <span className="text-rose-300">-{profile.totalTensionHpEst}</span>
                              <span className="text-amber-300">+{profile.totalRunYieldCredits}</span>
                            </div>
                          ) : (
                            <div className="mt-0.5 flex items-center gap-1 font-mono-tabular text-[10px] sm:text-[10.5px] font-semibold truncate">
                              <span className="text-rose-300">-{profile.totalTensionHpEst} HP</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-amber-300">+{profile.totalRunYieldCredits} CR</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div ref={gridCanvasRef} className="relative flex-1 min-w-0 min-h-0">
                    <svg
                      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {laneTrackYs.map((yPos, idx) => (
                        <g key={`track_${idx}`}>
                          <line
                            x1={16}
                            y1={yPos}
                            x2={Math.max(16, canvasSize.width - 16)}
                            y2={yPos}
                            stroke="rgba(56, 189, 248, 0.14)"
                            strokeWidth={14}
                            strokeLinecap="round"
                          />
                          <line
                            x1={16}
                            y1={yPos}
                            x2={Math.max(16, canvasSize.width - 16)}
                            y2={yPos}
                            stroke="rgba(224, 242, 254, 0.2)"
                            strokeWidth={1}
                            strokeDasharray="8 8"
                          />
                        </g>
                      ))}

                      {run.mapNodes.map((node) => {
                        const p1 = computePixelPortCoords(
                          node,
                          totalCols,
                          canvasSize.width,
                          canvasSize.height,
                          layout.colGapPx,
                          layout.rowGapPx,
                        );
                        return node.nextIds.map((nextId) => {
                          const target = nodeById.get(nextId);
                          if (!target) return null;
                          const p2 = computePixelPortCoords(
                            target,
                            totalCols,
                            canvasSize.width,
                            canvasSize.height,
                            layout.colGapPx,
                            layout.rowGapPx,
                          );

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

                          const dx = Math.max(12, (p2.leftX - p1.rightX) * 0.58);
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
                              ? 3.2
                              : isTraversed || isDownstreamPreview
                                ? 2.4
                                : 1.5;

                          return (
                            <g key={`${node.id}_${target.id}`}>
                              {(isMultiHopEdge || isImmediateAvailable || isDownstreamPreview) && (
                                <path
                                  d={pathD}
                                  fill="none"
                                  stroke={
                                    isMultiHopEdge
                                      ? 'rgba(0,240,255,0.45)'
                                      : isFocusedImmediate
                                        ? 'rgba(255,199,0,0.28)'
                                        : 'rgba(0,240,255,0.25)'
                                  }
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
                      style={{
                        ...gridStyle,
                        rowGap: `${layout.rowGapPx}px`,
                      }}
                      className="relative z-10 grid h-full w-full grid-rows-3"
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
        </div>

        {briefingNode && (
          <SectorNodeBriefingBar
            briefingNode={briefingNode}
            run={run}
            lang={lang}
            isCompactLandscape={isCompactLandscape}
            isAvailable={availableIds.has(briefingNode.id)}
            isPinnedInspection={Boolean(inspectedTargetId)}
            hasRecon={hasRecon}
            intel={intelByNodeId.get(briefingNode.id)}
            maxClearedLayer={maxClearedLayer}
            meshReroutesRemaining={meshReroutesRemaining}
            onSelectNode={onSelectNode}
            onRerouteMeshNet={onRerouteMeshNet}
            onClearInspection={() => setInspectedTargetId(null)}
          />
        )}
      </div>
    </main>
  );
}
