import { useState } from 'react';
import {
  CLINIC_PURGE_COST,
  CYBER_IMPLANTS,
  MAX_IMPLANTS,
  getEquippedEquipmentWeight,
} from '../engine/data';
import type { CyberImplantId, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileShortLabel } from '../utils/tileDisplay';
import { ImplantIcon } from './ImplantIcon';

interface CyberClinicViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  defibTriggeredNotice?: boolean;
  onPurgeInnateTile: (tileId: string) => void;
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
  onInstall,
  onOpenPool,
  onSkip,
}: CyberClinicViewProps) {
  const t = TRANSLATIONS[lang];
  const charCode = t.characters[run.heroine.characterId ?? 'kira'].code;
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const [pendingImplant, setPendingImplant] = useState<CyberImplantId | null>(null);
  const needsReplace = run.heroine.implants.length >= MAX_IMPLANTS;
  const equippedWeight = getEquippedEquipmentWeight(run.heroine);
  const innateTiles = run.masterPool.filter((tile) => tile.sourceId === 'innate');
  const canPurge =
    !run.clinicPurgeUsed &&
    run.heroine.credits >= CLINIC_PURGE_COST &&
    run.masterPool.length > 3 &&
    innateTiles.length > 0;

  const handleChooseModule = (id: CyberImplantId) => {
    if (needsReplace) {
      setPendingImplant(id);
    } else {
      onInstall(id);
    }
  };

  return (
    <main
      className={`cyber-vista-bg flex flex-1 min-h-0 flex-col items-center justify-center overflow-hidden ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3 py-3 sm:px-6 sm:py-4'
      }`}
    >
      <div
        className={`chrome-glass flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl ${
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
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono-tabular text-[10px] sm:text-xs font-bold uppercase tracking-wider animate-pulse shrink-0">
                {t.bountyFlashSaleBadge}
              </span>
            )}
            <p className="text-[11px] sm:text-sm text-slate-200 truncate min-w-0">
              {t.clinicSubtitle.replace('{name}', charCode)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono-tabular text-[11px] sm:text-sm shrink-0">
            <span className="font-bold text-[#FFC700]">
              {run.heroine.credits} {t.creditsLabel}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            {onOpenPool ? (
              <button
                type="button"
                onClick={onOpenPool}
                className="chrome-pill rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#00F0FF] hover:border-cyan-300 hover:text-white cursor-pointer"
                title={t.inspectPool}
              >
                ▣ {t.capacityLabel}: {equippedWeight}/{run.heroine.carryCapacity}
              </button>
            ) : (
              <span className="font-semibold text-[#00F0FF]">
                {t.capacityLabel}: {equippedWeight}/{run.heroine.carryCapacity}
              </span>
            )}
            {pendingImplant && (
              <button
                type="button"
                onClick={() => setPendingImplant(null)}
                className="chrome-pill rounded-lg px-2 py-0.5 font-sans text-[11px] font-semibold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer"
              >
                ← {lang === 'cs' ? 'Zpět' : 'Back'}
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="chrome-pill ml-1 rounded-lg px-2.5 py-0.5 sm:px-3 sm:py-1 font-sans text-[11px] sm:text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:text-white cursor-pointer"
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
              : 'mt-3 space-y-4 border-t border-white/15 pt-3 sm:mt-4 sm:pt-4'
          }`}
        >
          {/* Section 1: Neural Tile Purge (1/visit for 30 CR) */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-300">
                {t.clinicPurgeTitle} · {CLINIC_PURGE_COST} {t.creditsLabel}
              </div>
              {run.clinicPurgeUsed && (
                <span className="font-mono-tabular text-[10px] font-bold text-emerald-300">
                  ✓ {t.purgedDoneLabel}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-xs text-slate-300">{t.clinicPurgeDesc}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {innateTiles.map((tile) => {
                const isDud = Boolean(tile.isDud);
                const colorClass = isDud
                  ? 'border-amber-400/70 bg-amber-950/35 text-amber-200'
                  : tile.type === 'attack'
                    ? 'border-rose-400/50 bg-rose-950/30 text-rose-200'
                    : tile.type === 'defense'
                      ? 'border-cyan-400/50 bg-cyan-950/30 text-cyan-200'
                      : 'border-amber-300/50 bg-amber-950/30 text-amber-200';
                return (
                  <button
                    key={tile.id}
                    type="button"
                    data-testid={`clinic-purge-tile-${tile.id}`}
                    disabled={!canPurge}
                    onClick={() => onPurgeInnateTile(tile.id)}
                    className={`chrome-pill flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono-tabular text-[11px] font-bold transition hover:brightness-125 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${colorClass}`}
                  >
                    <span>
                      {tile.type === 'attack' ? '◆' : tile.type === 'defense' ? '●' : '▲'}
                    </span>
                    <span>{formatTileShortLabel(tile, lang)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-rose-200">
                      ✕ {t.purgeTileAction} ({CLINIC_PURGE_COST} CR)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Cybernetic Implant Draft */}
          <div
            className={`min-w-0 ${
              isCompactLandscape ? 'border-l border-white/15 pl-2.5' : 'border-t border-white/15 pt-3.5'
            }`}
          >
            {!pendingImplant ? (
              <>
                <div className="truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#00F0FF]">
                  {t.clinicSelectPrompt}
                </div>
                <div
                  className={`mt-1 grid ${
                    isCompactLandscape
                      ? 'grid-cols-1 gap-1.5'
                      : 'grid-cols-1 gap-2 min-[560px]:grid-cols-3 sm:gap-3.5 mt-2'
                  }`}
                >
                  {run.clinicChoices.map((id) => {
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
                            : 'flex-col p-3.5 sm:p-4'
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
                            <ImplantIcon id={id} size={isCompactLandscape ? 20 : 26} />
                            {!isCompactLandscape && (
                              <span
                                className={`text-xs font-bold ${
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
                                  isCompactLandscape ? 'mt-0 text-xs' : 'mt-2 text-base'
                                }`}
                              >
                                {meta.name}
                              </h2>
                              {isCompactLandscape && (
                                <span
                                  className={`text-[9px] font-bold shrink-0 ${
                                    isRare ? 'text-[#FFC700]' : 'text-[#00F0FF]'
                                  }`}
                                >
                                  · {isRare ? t.rarityRare : t.rarityCommon}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] sm:text-[11px] leading-tight text-slate-200">
                              {meta.desc}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`text-[10px] sm:text-[11px] font-bold text-[#00F0FF] shrink-0 whitespace-nowrap ${
                            isCompactLandscape ? '' : 'mt-2.5 text-xs'
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
                <div className="text-xs sm:text-sm font-bold text-[#FFC700]">
                  {t.clinicReplacePrompt}
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {run.heroine.implants.map((existingId) => {
                    const meta = t.implants[existingId];
                    if (!meta) return null;
                    return (
                      <button
                        key={existingId}
                        type="button"
                        onClick={() => onInstall(pendingImplant, existingId)}
                        className="chrome-pill flex items-start gap-2 rounded-xl border-rose-400/55 p-2 text-left transition-all hover:border-rose-300 cursor-pointer"
                      >
                        <ImplantIcon id={existingId} size={20} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="font-display text-xs font-bold text-white">
                            {meta.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-200">{meta.desc}</div>
                          <div className="mt-0.5 text-[10px] font-bold text-rose-300">
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
