import { useEffect, useMemo, useState } from 'react';
import {
  CLINIC_PURGE_COST,
  CYBER_IMPLANTS,
  MAX_IMPLANTS,
} from '../engine/data';
import {
  getEquippedChipMemory,
  isTileEligibleForStork,
} from '../engine/poolBuilder';
import type { CyberImplantId, RunState, TileType } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileShortLabel } from '../utils/tileDisplay';
import { ImplantIcon } from './ImplantIcon';

interface CyberClinicViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  defibTriggeredNotice?: boolean;
  onPurgeInnateTile: (tileId: string) => void;
  onIncubateTile?: (tileId: string) => void;
  onIncubateStork?: (tileId: string) => void;
  onMarryBloodline?: (primary: TileType, secondary: TileType) => void;
  onEnrollProdigyTile?: (tileId: string) => void;
  onSpliceTiles?: (targetTileId: string, consumedTileId: string) => void;
  onSpliceFabLab?: (primaryTileId: string, secondaryTileId: string) => void;
  onInstall: (implantId: CyberImplantId, replaceId?: CyberImplantId) => void;
  onOpenPool?: () => void;
  onSkip: () => void;
}

export function CyberClinicView({
  run,
  lang,
  isCompactLandscape = false,
  defibTriggeredNotice = false,
  onPurgeInnateTile,
  onIncubateTile,
  onIncubateStork,
  onMarryBloodline,
  onEnrollProdigyTile,
  onSpliceTiles,
  onSpliceFabLab,
  onInstall,
  onOpenPool,
  onSkip,
}: CyberClinicViewProps) {
  const t = TRANSLATIONS[lang];
  const isCs = lang === 'cs';
  const charCode = t.characters[run.hero.characterId ?? 'kira'].code;
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const isFundedClinic = currentNode?.modifier === 'funded_clinic';
  const [pendingImplant, setPendingImplant] = useState<CyberImplantId | null>(null);
  const needsReplace = run.hero.implants.length >= MAX_IMPLANTS;
  const equippedWeight = getEquippedChipMemory(run.hero);
  const innateTiles = run.masterPool.filter((tile) => tile.sourceId === 'innate');
  const canPurge =
    !run.clinicPurgeUsed &&
    run.hero.credits >= CLINIC_PURGE_COST &&
    run.masterPool.length > 3 &&
    innateTiles.length > 0;

  const storkHandler = onIncubateStork ?? onIncubateTile;
  const fabLabHandler = onSpliceFabLab ?? onSpliceTiles;

  const eligibleStorkTiles = useMemo(
    () =>
      run.masterPool.filter(
        (tile) => !tile.isDud && isTileEligibleForStork(tile, run.hero),
      ),
    [run.masterPool, run.hero],
  );

  const eligibleFabLabTiles = useMemo(() => {
    const prevSplices = run.hero.splicedTilePairs ?? [];
    const usedIds = new Set<string>();
    for (const pair of prevSplices) {
      usedIds.add(pair.targetId);
      usedIds.add(pair.consumedId);
    }
    return run.masterPool.filter(
      (tile) => !tile.isBlight && !usedIds.has(tile.id),
    );
  }, [run.masterPool, run.hero.splicedTilePairs]);

  const [selectedStorkTileId, setSelectedStorkTileId] = useState<string>(
    () => eligibleStorkTiles[0]?.id ?? '',
  );
  const [primaryTileId, setPrimaryTileId] = useState<string>(
    () => eligibleFabLabTiles[0]?.id ?? '',
  );
  const [secondaryTileId, setSecondaryTileId] = useState<string>(
    () => eligibleFabLabTiles[1]?.id ?? '',
  );

  useEffect(() => {
    if (!eligibleStorkTiles.some((t) => t.id === selectedStorkTileId)) {
      setSelectedStorkTileId(eligibleStorkTiles[0]?.id ?? '');
    }
  }, [eligibleStorkTiles, selectedStorkTileId]);

  useEffect(() => {
    const validPrimary = eligibleFabLabTiles.some((t) => t.id === primaryTileId)
      ? primaryTileId
      : (eligibleFabLabTiles[0]?.id ?? '');
    if (validPrimary !== primaryTileId) {
      setPrimaryTileId(validPrimary);
    }
    const validSecondary =
      eligibleFabLabTiles.some((t) => t.id === secondaryTileId) &&
      secondaryTileId !== validPrimary
        ? secondaryTileId
        : (eligibleFabLabTiles.find((t) => t.id !== validPrimary)?.id ?? '');
    if (validSecondary !== secondaryTileId) {
      setSecondaryTileId(validSecondary);
    }
  }, [eligibleFabLabTiles, primaryTileId, secondaryTileId]);

  const storkCost = isFundedClinic ? 0 : 15;
  const pedigreeCost = isFundedClinic ? 0 : 20;
  const charterCost = isFundedClinic ? 0 : 15;
  const canIncubate =
    !run.hero.incubatingTile &&
    run.hero.credits >= storkCost &&
    run.masterPool.length > 4 &&
    eligibleStorkTiles.length > 0;
  const canMarry = run.hero.credits >= pedigreeCost;
  const prodigySet = new Set(run.hero.prodigyTileIds ?? []);

  const handleChooseModule = (id: CyberImplantId) => {
    if (needsReplace) {
      setPendingImplant(id);
    } else {
      onInstall(id);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (!pendingImplant) {
        if (e.key === '1' && run.clinicChoices[0]) {
          e.preventDefault();
          handleChooseModule(run.clinicChoices[0]);
        } else if (e.key === '2' && run.clinicChoices[1]) {
          e.preventDefault();
          handleChooseModule(run.clinicChoices[1]);
        } else if (e.key === '3' && run.clinicChoices[2]) {
          e.preventDefault();
          handleChooseModule(run.clinicChoices[2]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main
      className={`cyber-vista-bg flex flex-1 min-h-0 flex-col items-center justify-center overflow-hidden ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3 py-3 sm:px-6 sm:py-4'
      }`}
    >
      <div
        className={`chrome-glass flex max-h-full w-full max-w-[1620px] flex-col overflow-hidden rounded-2xl ${
          isCompactLandscape ? 'p-2.5' : 'p-4 sm:p-5 md:p-6'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-2 shrink-0 ${
            isCompactLandscape ? 'flex-nowrap' : 'flex-wrap'
          }`}
        >
          <div className="flex items-baseline gap-x-2 min-w-0 flex-1 overflow-hidden">
            <h1
              className={`chrome-text-shimmer font-display font-bold shrink-0 ${
                isCompactLandscape ? 'text-sm' : 'text-xl sm:text-2xl md:text-3xl'
              }`}
            >
              {t.clinicTitle}
            </h1>
            {isFlashSale && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono-tabular text-[12px] sm:text-xs font-bold uppercase tracking-wider animate-pulse shrink-0">
                {t.bountyFlashSaleBadge}
              </span>
            )}
            <p className="text-[12.5px] sm:text-sm text-slate-200 truncate min-w-0">
              {t.clinicSubtitle.replace('{name}', charCode)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono-tabular text-[12.5px] sm:text-sm shrink-0">
            <span className="font-bold text-[#FFC700]">
              {run.hero.credits} {t.creditsLabel}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            {onOpenPool ? (
              <button
                type="button"
                onClick={onOpenPool}
                className="chrome-pill rounded-lg px-2 py-0.5 text-[12.5px] font-semibold text-[#00F0FF] hover:border-cyan-300 hover:text-white cursor-pointer"
                title={t.inspectPool}
              >
                ▣ {t.capacityLabel}: {equippedWeight}/{run.hero.memoryCapacity}
              </button>
            ) : (
              <span className="font-semibold text-[#00F0FF]">
                {t.capacityLabel}: {equippedWeight}/{run.hero.memoryCapacity}
              </span>
            )}
            {pendingImplant && (
              <button
                type="button"
                onClick={() => setPendingImplant(null)}
                className="chrome-pill rounded-lg px-2 py-0.5 font-sans text-[12.5px] font-semibold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer"
              >
                ← {lang === 'cs' ? 'Zpět' : 'Back'}
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="chrome-pill ml-1 rounded-lg px-2.5 py-0.5 sm:px-3 sm:py-1 font-sans text-[12.5px] sm:text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:text-white cursor-pointer"
            >
              {t.skipClinic} →
            </button>
          </div>
        </div>

        {defibTriggeredNotice && (
          <div className="mt-2 shrink-0 rounded-xl border border-emerald-400/60 bg-emerald-950/55 px-3 py-1.5 text-xs font-mono-tabular font-bold text-emerald-200">
            ⚡ {t.emergencyDefibTriggered}
          </div>
        )}

        <div
          className={`flex-1 min-h-0 overflow-y-auto ${
            isCompactLandscape
              ? 'mt-1.5 grid grid-cols-2 gap-2.5 border-t border-white/15 pt-1.5'
              : 'mt-2.5 space-y-2.5 border-t border-white/15 pt-2.5 sm:mt-3 sm:pt-3'
          }`}
        >
          {/* Section 1: Neural Tile Purge & Charter Academy / FabLab Upcycling */}
          <div className="min-w-0 space-y-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-rose-300">
                    {t.clinicPurgeTitle} · {CLINIC_PURGE_COST} {t.creditsLabel}
                  </span>
                  <span className="hidden sm:inline font-mono-tabular text-[12px] text-slate-300">
                    ({t.clinicPurgeDesc})
                  </span>
                </div>
                {run.clinicPurgeUsed && (
                  <span className="font-mono-tabular text-[12px] font-bold text-emerald-300">
                    ✓ {t.purgedDoneLabel}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {innateTiles.map((tile) => {
                  const isDud = Boolean(tile.isDud);
                  const isProdigy = prodigySet.has(tile.id);
                  const colorClass = isDud
                    ? 'border-amber-400/70 bg-amber-950/35 text-amber-200'
                    : tile.type === 'attack'
                      ? 'border-rose-400/50 bg-rose-950/30 text-rose-200'
                      : tile.type === 'defense'
                        ? 'border-cyan-400/50 bg-cyan-950/30 text-cyan-200'
                        : 'border-amber-300/50 bg-amber-950/30 text-amber-200';
                  return (
                    <div key={tile.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`clinic-purge-tile-${tile.id}`}
                        disabled={!canPurge}
                        onClick={() => onPurgeInnateTile(tile.id)}
                        className={`chrome-pill flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono-tabular text-[12px] sm:text-[13px] font-bold transition hover:brightness-125 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${colorClass}`}
                      >
                        <span>
                          {tile.type === 'attack' ? '◆' : tile.type === 'defense' ? '●' : '▲'}
                        </span>
                        <span>{formatTileShortLabel(tile, lang)}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-rose-200">
                          ✕ {CLINIC_PURGE_COST} CR
                        </span>
                      </button>
                      {onEnrollProdigyTile && !isProdigy && (
                        <button
                          type="button"
                          data-testid={`clinic-prodigy-tile-${tile.id}`}
                          disabled={run.hero.credits < charterCost}
                          onClick={() => onEnrollProdigyTile(tile.id)}
                          title={
                            isCs
                              ? 'Akademie: 6+ síla, +1⚡, +1 sousedním'
                              : 'Prodigy: 6+ stat, +1⚡, +1 adjacent'
                          }
                          className="chrome-pill rounded-lg border border-emerald-400/60 bg-emerald-950/40 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-emerald-200 hover:border-emerald-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          ★ {isCs ? 'Akademie' : 'Prodigy'} ({charterCost} CR)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compact Pro-Family Biotech & FabLab Toolbar */}
            {(storkHandler || onMarryBloodline || fabLabHandler) && (
              <div
                data-testid="clinic-dynasty-biotech-panel"
                className="rounded-xl border border-cyan-400/35 bg-slate-950/55 px-2.5 py-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
              >
                <span className="text-[12px] font-mono-tabular font-bold uppercase tracking-wider text-cyan-300 shrink-0">
                  🧬 {isCs ? 'Biotech:' : 'Biotech:'}
                </span>

                {/* Stork Nursery Incubation Pod */}
                {storkHandler && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-mono-tabular text-[12px] text-slate-300 font-bold">
                      🌱 3n→2× ({storkCost} CR):
                    </span>
                    {run.hero.incubatingTile ? (
                      <span
                        data-testid="incubating-pod-status"
                        className="rounded-md border border-emerald-400/60 bg-emerald-950/45 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-emerald-200"
                      >
                        🌱 {formatTileShortLabel(run.hero.incubatingTile.tile, lang)} ·{' '}
                        {run.hero.incubatingTile.nodesRemaining}n
                      </span>
                    ) : (
                      <>
                        {eligibleStorkTiles.length > 0 && (
                          <select
                            data-testid="clinic-stork-tile-select"
                            aria-label={isCs ? 'Vybrat dílek pro Čapí kapsli' : 'Select tile for Stork Incubation'}
                            value={selectedStorkTileId}
                            onChange={(e) => setSelectedStorkTileId(e.target.value)}
                            className="rounded-lg border border-cyan-400/50 bg-slate-950/90 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-cyan-200 focus:border-cyan-300 focus:outline-none cursor-pointer"
                          >
                            {eligibleStorkTiles.map((tile) => (
                              <option key={`stork_opt_${tile.id}`} value={tile.id} className="bg-slate-950 text-cyan-200">
                                {formatTileShortLabel(tile, lang)} ({tile.sourceId === 'innate' ? t.innateLabel : t.equipment[tile.sourceId]?.name ?? tile.sourceId})
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          data-testid="clinic-stork-incubate-btn"
                          disabled={!canIncubate || !selectedStorkTileId}
                          onClick={() => {
                            if (selectedStorkTileId) storkHandler(selectedStorkTileId);
                          }}
                          className="chrome-pill rounded-lg border border-cyan-400/55 bg-cyan-950/40 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-cyan-200 hover:border-cyan-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          🌱 {isCs ? 'Inkubovat' : 'Incubate'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Gene-Splice Pedigree Marriage */}
                {onMarryBloodline && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-mono-tabular text-[12px] text-slate-300 font-bold">
                      ♥ +2/+1⚡ ({pedigreeCost} CR):
                    </span>
                    {(
                      [
                        ['attack', 'defense', 'ATK♥DEF'],
                        ['attack', 'tech', 'ATK♥TECH'],
                        ['defense', 'tech', 'DEF♥TECH'],
                      ] as const
                    ).map(([p, s, label]) => {
                      const isMarried =
                        run.hero.bloodlineCrest?.primary === p &&
                        run.hero.bloodlineCrest?.secondary === s;
                      return (
                        <button
                          key={`${p}_${s}`}
                          type="button"
                          data-testid={`clinic-marry-${p}-${s}`}
                          disabled={!canMarry || isMarried}
                          onClick={() => onMarryBloodline(p, s)}
                          className={`chrome-pill rounded-lg border px-1.5 py-0.5 font-mono-tabular text-[12px] font-bold transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            isMarried
                              ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                              : 'border-fuchsia-400/55 bg-fuchsia-950/35 text-fuchsia-200 hover:border-fuchsia-300'
                          }`}
                        >
                          {isMarried ? `✓ ${label}` : label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {run.hero.bloodlineCrest && (
                  <span
                    data-testid="active-bloodline-crest-badge"
                    className="rounded-md border border-amber-400/60 bg-amber-950/50 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-amber-200"
                  >
                    ♥ {run.hero.bloodlineCrest.primary.toUpperCase()}⇄
                    {run.hero.bloodlineCrest.secondary.toUpperCase()}
                  </span>
                )}

                {fabLabHandler && eligibleFabLabTiles.length >= 2 && (
                  <div className="ml-auto flex flex-wrap items-center gap-1">
                    <select
                      data-testid="clinic-fablab-primary-select"
                      aria-label={isCs ? 'Primární dílek pro FabLab' : 'Primary tile for FabLab'}
                      value={primaryTileId}
                      onChange={(e) => {
                        const nextPrimary = e.target.value;
                        setPrimaryTileId(nextPrimary);
                        if (nextPrimary === secondaryTileId) {
                          const alt = eligibleFabLabTiles.find((t) => t.id !== nextPrimary);
                          if (alt) setSecondaryTileId(alt.id);
                        }
                      }}
                      className="rounded-lg border border-indigo-400/50 bg-slate-950/90 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-indigo-200 focus:border-indigo-300 focus:outline-none cursor-pointer"
                    >
                      {eligibleFabLabTiles.map((tile) => (
                        <option key={`fab_p_${tile.id}`} value={tile.id} className="bg-slate-950 text-indigo-200">
                          {formatTileShortLabel(tile, lang)}
                        </option>
                      ))}
                    </select>
                    <span className="font-mono-tabular text-[11.5px] text-indigo-300">+</span>
                    <select
                      data-testid="clinic-fablab-secondary-select"
                      aria-label={isCs ? 'Sekundární dílek pro FabLab' : 'Secondary tile for FabLab'}
                      value={secondaryTileId}
                      onChange={(e) => setSecondaryTileId(e.target.value)}
                      className="rounded-lg border border-indigo-400/50 bg-slate-950/90 px-1.5 py-0.5 font-mono-tabular text-[11.5px] font-bold text-indigo-200 focus:border-indigo-300 focus:outline-none cursor-pointer"
                    >
                      {eligibleFabLabTiles
                        .filter((tile) => tile.id !== primaryTileId)
                        .map((tile) => (
                          <option key={`fab_s_${tile.id}`} value={tile.id} className="bg-slate-950 text-indigo-200">
                            {formatTileShortLabel(tile, lang)}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      data-testid="clinic-fablab-splice-btn"
                      disabled={
                        run.masterPool.length <= 4 ||
                        !primaryTileId ||
                        !secondaryTileId ||
                        primaryTileId === secondaryTileId
                      }
                      onClick={() => fabLabHandler(primaryTileId, secondaryTileId)}
                      className="chrome-pill rounded-lg border border-indigo-400/60 bg-indigo-950/45 px-2 py-0.5 font-mono-tabular text-[12px] font-bold text-indigo-200 hover:border-indigo-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      ⚒ {isCs ? 'FabLab 2→1 (0 CR)' : 'FabLab 2→1 (0 CR)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Cybernetic Implant Draft */}
          <div
            className={`min-w-0 ${
              isCompactLandscape ? 'border-l border-white/15 pl-2.5' : 'border-t border-white/15 pt-2.5'
            }`}
          >
            {!pendingImplant ? (
              <>
                <div className="truncate text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-[#00F0FF]">
                  {t.clinicSelectPrompt}
                </div>
                <div
                  className={`mt-1 grid ${
                    isCompactLandscape
                      ? 'grid-cols-1 gap-1.5'
                      : 'grid-cols-1 gap-2 min-[560px]:grid-cols-3 sm:gap-3 mt-1.5'
                  }`}
                >
                  {run.clinicChoices.map((id, idx) => {
                    const meta = t.implants[id];
                    if (!meta) return null;
                    const info = CYBER_IMPLANTS.find((item) => item.id === id);
                    const isRare = info?.rarity === 'rare';
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleChooseModule(id)}
                        className={`chrome-pill flex justify-between rounded-xl text-left transition-all duration-150 hover:-translate-y-0.5 cursor-pointer ${
                          isCompactLandscape
                            ? 'flex-row items-center gap-2 px-2.5 py-1.5'
                            : 'flex-col p-3 sm:p-3.5'
                        } ${
                          isRare
                            ? 'border-[#FFC700]/65 hover:border-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.18)]'
                            : 'border-[#00F0FF]/50 hover:border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                        }`}
                      >
                        <div className={isCompactLandscape ? 'flex items-center gap-2 min-w-0 flex-1' : ''}>
                          <div
                            className={`flex items-center justify-between gap-2 ${
                              isCompactLandscape ? 'shrink-0' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-slate-900/90 border border-white/15 px-1.5 py-0.5 font-mono-tabular text-[12px] font-bold text-cyan-200">
                                [{idx + 1}]
                              </span>
                              <ImplantIcon id={id} size={isCompactLandscape ? 20 : 24} />
                            </div>
                            {!isCompactLandscape && (
                              <span
                                className={`text-[13px] font-bold ${
                                  isRare ? 'text-[#FFC700]' : 'text-[#00F0FF]'
                                }`}
                              >
                                {isRare ? t.rarityRare : t.rarityCommon}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h2
                                className={`font-display font-bold text-white truncate ${
                                  isCompactLandscape ? 'mt-0 text-[13px]' : 'mt-1.5 text-sm sm:text-base'
                                }`}
                              >
                                {meta.name}
                              </h2>
                              {isCompactLandscape && (
                                <span
                                  className={`text-[11.5px] font-bold shrink-0 ${
                                    isRare ? 'text-[#FFC700]' : 'text-[#00F0FF]'
                                  }`}
                                >
                                  · {isRare ? t.rarityRare : t.rarityCommon}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 font-mono-tabular text-[12px] sm:text-[13px] leading-snug text-slate-200">
                              {meta.desc}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`text-[12px] sm:text-[13px] font-bold text-[#00F0FF] shrink-0 whitespace-nowrap ${
                            isCompactLandscape ? '' : 'mt-2'
                          }`}
                        >
                          {t.installImplant} →
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div>
                <div className="text-[13px] sm:text-sm font-bold text-[#FFC700]">
                  {t.clinicReplacePrompt}
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {run.hero.implants.map((existingId) => {
                    const meta = t.implants[existingId];
                    if (!meta) return null;
                    return (
                      <button
                        key={existingId}
                        type="button"
                        onClick={() => onInstall(pendingImplant, existingId)}
                        className="chrome-pill flex items-start gap-2 rounded-xl border-rose-400/55 p-2.5 text-left transition-all hover:border-rose-300 cursor-pointer"
                      >
                        <ImplantIcon id={existingId} size={20} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="font-display text-[13px] font-bold text-white">
                            {meta.name}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-200">{meta.desc}</div>
                          <div className="mt-0.5 text-[12px] font-bold text-rose-300">
                            {t.replaceSlot} →
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
