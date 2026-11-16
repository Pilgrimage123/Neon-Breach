import {
  CLINIC_RESTOCK_COST,
  EQUIPMENT_BY_ID,
  getEquippedEquipmentWeight,
} from '../engine/data';
import type { RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileShortLabel } from '../utils/tileDisplay';

interface ChipDealerViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  onBuyChip: (defId: string) => void;
  onRestockShop: () => void;
  onOpenPool?: () => void;
  onLeave: () => void;
}

export function ChipDealerView({
  run,
  lang,
  isCompactLandscape = false,
  onBuyChip,
  onRestockShop,
  onOpenPool,
  onLeave,
}: ChipDealerViewProps) {
  const t = TRANSLATIONS[lang];
  const charCode = t.characters[run.heroine.characterId ?? 'kira'].code;
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const equippedMemory = getEquippedEquipmentWeight(run.heroine);

  return (
    <main
      className={`cyber-vista-bg flex flex-1 min-h-0 flex-col items-center justify-center overflow-hidden ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3 py-3 sm:px-6 sm:py-4'
      }`}
    >
      <div
        data-testid="chip-dealer-panel"
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
              {t.chipDealerTitle}
            </h1>
            {isFlashSale && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono-tabular text-[10px] sm:text-xs font-bold uppercase tracking-wider animate-pulse shrink-0">
                {t.bountyFlashSaleBadge}
              </span>
            )}
            <p className="text-[11px] sm:text-sm text-slate-200 truncate min-w-0">
              {t.chipDealerSubtitle.replace('{name}', charCode)}
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
                ▣ {t.capacityLabel}: {equippedMemory}/{run.heroine.carryCapacity}
              </button>
            ) : (
              <span className="font-semibold text-[#00F0FF]">
                {t.capacityLabel}: {equippedMemory}/{run.heroine.carryCapacity}
              </span>
            )}
            <button
              type="button"
              data-testid="chip-dealer-leave-btn"
              onClick={onLeave}
              className="chrome-pill ml-1 rounded-lg px-2.5 py-0.5 sm:px-3 sm:py-1 font-sans text-[11px] sm:text-xs font-semibold text-slate-100 hover:border-amber-300 hover:text-white cursor-pointer"
            >
              {t.skipChipDealer} →
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto border-t border-white/15 pt-3 sm:mt-4 sm:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#FFC700]">
              {t.clinicShopTitle}
            </div>
            <button
              type="button"
              disabled={run.heroine.credits < CLINIC_RESTOCK_COST}
              onClick={onRestockShop}
              className="chrome-pill shrink-0 rounded-md border-amber-300/45 px-2 py-0.5 font-mono-tabular text-[10px] sm:text-[11px] font-bold text-amber-200 transition-colors hover:border-[#FFC700] hover:text-white disabled:opacity-40 cursor-pointer"
            >
              ↻ {t.restockShop} ({CLINIC_RESTOCK_COST} {t.creditsLabel})
            </button>
          </div>

          {run.clinicShopChoices.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">{t.clinicShopEmpty}</p>
          ) : (
            <div
              className={`mt-2 grid ${
                isCompactLandscape
                  ? 'grid-cols-1 gap-1.5'
                  : 'grid-cols-1 gap-2 min-[560px]:grid-cols-3 sm:gap-3.5'
              }`}
            >
              {run.clinicShopChoices.map((defId) => {
                const def = EQUIPMENT_BY_ID[defId];
                if (!def) return null;
                const meta = t.equipment[def.id];
                const price = isFlashSale ? Math.max(10, Math.round(def.price * 0.65)) : def.price;
                const canAfford = run.heroine.credits >= price;
                const fitsMemory = equippedMemory + def.size <= run.heroine.carryCapacity;

                return (
                  <div
                    key={defId}
                    className={`chrome-pill flex justify-between gap-2 rounded-xl border-amber-300/40 ${
                      isCompactLandscape
                        ? 'flex-row items-center px-2.5 py-1.5'
                        : 'flex-col p-3.5 sm:p-4'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] sm:text-[11px] font-mono-tabular">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <h2 className="font-display text-xs sm:text-sm font-bold text-white truncate">
                            {meta?.name ?? def.id}
                          </h2>
                          <span className={fitsMemory ? 'text-[#00F0FF] shrink-0' : 'text-amber-300 shrink-0'}>
                            {t.sizeLabel}: {def.size} · {fitsMemory ? '✓' : '⬡'}
                          </span>
                        </div>
                        {!isCompactLandscape && (
                          <span className="font-bold text-[#FFC700]">
                            {isFlashSale && (
                              <span className="line-through text-slate-400 mr-1 text-[10px]">
                                {def.price}
                              </span>
                            )}
                            {price} {t.creditsLabel}
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-1 text-[10px] sm:text-xs leading-snug text-slate-200 ${
                          isCompactLandscape ? 'line-clamp-1' : ''
                        }`}
                      >
                        {meta?.desc ?? ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono-tabular text-[10px] sm:text-[11px]">
                        {def.tiles.map((spec, idx) => (
                          <span
                            key={`${defId}_chip_tile_${idx}`}
                            className={`font-bold ${
                              spec.type === 'attack'
                                ? 'text-rose-200'
                                : spec.type === 'defense'
                                  ? 'text-cyan-200'
                                  : 'text-amber-200'
                            }`}
                          >
                            {idx > 0 ? '· ' : ''}
                            {formatTileShortLabel(spec, lang)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyChip(defId)}
                      className={`${
                        isCompactLandscape ? 'shrink-0 px-2.5 py-1 text-[10px]' : 'mt-3 w-full px-3 py-2 text-xs'
                      } rounded-lg bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] font-bold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all hover:brightness-110 disabled:bg-none disabled:bg-slate-800/80 disabled:text-slate-400 disabled:shadow-none cursor-pointer whitespace-nowrap`}
                    >
                      {isCompactLandscape ? (
                        <span>
                          {isFlashSale && (
                            <span className="line-through opacity-60 mr-1">{def.price}</span>
                          )}
                          {`${price} CR`}
                        </span>
                      ) : canAfford ? (
                        `${t.buyEquipment} (${price} CR)`
                      ) : (
                        `${t.notEnoughCredits} (${price} CR)`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
