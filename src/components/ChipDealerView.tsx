import { useEffect } from 'react';
import {
  CLINIC_RESTOCK_COST,
  EQUIPMENT_BY_ID,
  getEquippedEquipmentWeight,
} from '../engine/data';
import type { NannyBotId, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileShortLabel } from '../utils/tileDisplay';

interface ChipDealerViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  onBuyChip: (defId: string) => void;
  onRestockShop: () => void;
  onAdoptNannyBot?: (botId: NannyBotId) => void;
  onStartBetaTrial?: (defId?: string) => void;
  onEngraveHeirloom?: (defId: string) => void;
  onOpenPool?: () => void;
  onLeave: () => void;
}

const NANNY_BOT_SPECS: Array<{
  id: NannyBotId;
  titleEn: string;
  titleCs: string;
  badge: string;
}> = [
  {
    id: 'guardian_nanny',
    titleEn: 'Guardian Bot',
    titleCs: 'Strážný Bot',
    badge: '🛡 +4 / TURN',
  },
  {
    id: 'caretaker_nanny',
    titleEn: 'Caretaker Bot',
    titleCs: 'Pečovatel Bot',
    badge: '💚 +2 · -1 CORR',
  },
  {
    id: 'tutor_nanny',
    titleEn: 'Tutor Bot',
    titleCs: 'Mentor Bot',
    badge: '⚡ +1 · +10% OD',
  },
];

export function ChipDealerView({
  run,
  lang,
  isCompactLandscape = false,
  onBuyChip,
  onRestockShop,
  onAdoptNannyBot,
  onStartBetaTrial,
  onEngraveHeirloom,
  onOpenPool,
  onLeave,
}: ChipDealerViewProps) {
  const t = TRANSLATIONS[lang];
  const isCs = lang === 'cs';
  const charCode = t.characters[run.heroine.characterId ?? 'kira'].code;
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const equippedMemory = getEquippedEquipmentWeight(run.heroine);
  const nannyCost = isFlashSale ? 16 : 25;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (idx >= 0 && run.clinicShopChoices[idx]) {
        const defId = run.clinicShopChoices[idx];
        const def = EQUIPMENT_BY_ID[defId];
        if (!def) return;
        const price = isFlashSale ? Math.max(10, Math.round(def.price * 0.65)) : def.price;
        if (run.heroine.credits >= price) {
          e.preventDefault();
          onBuyChip(defId);
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

        <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto border-t border-white/15 pt-2.5 sm:mt-3 sm:pt-3">
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
                  : 'grid-cols-1 gap-2 min-[560px]:grid-cols-3 sm:gap-3'
              }`}
            >
              {run.clinicShopChoices.map((defId, idx) => {
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
                        : 'flex-col p-3 sm:p-3.5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] sm:text-[11px] font-mono-tabular">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="rounded bg-slate-900/90 border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 shrink-0">
                            [{idx + 1}]
                          </span>
                          <h2 className="font-display text-xs sm:text-sm font-bold text-white truncate">
                            {meta?.name ?? def.id}
                          </h2>
                          <span className={fitsMemory ? 'text-[#00F0FF] shrink-0' : 'text-amber-300 shrink-0'}>
                            {t.sizeLabel}:{def.size} {fitsMemory ? '✓' : '⬡'}
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
                        className={`mt-1 font-mono-tabular text-[10px] sm:text-[11px] leading-snug text-slate-200 ${
                          isCompactLandscape ? 'line-clamp-1' : ''
                        }`}
                      >
                        {meta?.desc ?? ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono-tabular text-[10px] sm:text-[11px]">
                        {def.tiles.map((spec, tileIdx) => (
                          <span
                            key={`${defId}_chip_tile_${tileIdx}`}
                            className={`font-bold ${
                              spec.type === 'attack'
                                ? 'text-rose-200'
                                : spec.type === 'defense'
                                  ? 'text-cyan-200'
                                  : 'text-amber-200'
                            }`}
                          >
                            {tileIdx > 0 ? '· ' : ''}
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
                        isCompactLandscape ? 'shrink-0 px-2.5 py-1 text-[10px]' : 'mt-2.5 w-full px-3 py-1.5 text-xs'
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

          {/* Streamlined Nanny-Bot Showroom, Beta-Test Arcade & Heirloom Forge */}
          {(onAdoptNannyBot || onStartBetaTrial || onEngraveHeirloom) && (
            <div className="mt-3 border-t border-white/15 pt-2.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* 1. Nanny-Bot Showroom */}
                {onAdoptNannyBot && (
                  <div
                    data-testid="dealer-nanny-showroom"
                    className="chrome-pill rounded-xl border border-emerald-400/40 bg-emerald-950/20 p-2.5 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-xs font-bold text-emerald-200">
                        🤖 {isCs ? 'Chůva-Boti' : 'Nanny-Bots'}
                      </span>
                      <span className="font-mono-tabular text-[10px] font-bold text-emerald-300">
                        {nannyCost} CR
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {NANNY_BOT_SPECS.map((bot) => {
                        const isInstalled = run.heroine.nannyBotInstalled === bot.id;
                        return (
                          <button
                            key={bot.id}
                            type="button"
                            data-testid={`nanny-bot-btn-${bot.id}`}
                            disabled={isInstalled || run.heroine.credits < nannyCost}
                            onClick={() => onAdoptNannyBot(bot.id)}
                            className={`flex items-center justify-between rounded-lg border px-2 py-1 font-mono-tabular text-[10px] font-bold transition-all cursor-pointer ${
                              isInstalled
                                ? 'border-emerald-300 bg-emerald-500/30 text-white'
                                : 'border-emerald-400/40 bg-slate-900/75 text-emerald-200 hover:border-emerald-300 disabled:opacity-45'
                            }`}
                          >
                            <span className="truncate">{isCs ? bot.titleCs : bot.titleEn}</span>
                            <span className="shrink-0 ml-1 text-[9px] text-amber-300">
                              {isInstalled ? '✓ ACTIVE' : bot.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Beta-Test Arcade */}
                {onStartBetaTrial && (
                  <div
                    data-testid="dealer-beta-arcade"
                    className="chrome-pill rounded-xl border border-violet-400/40 bg-violet-950/20 p-2.5 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-xs font-bold text-violet-200">
                        🕹 {isCs ? 'Beta Herna' : 'Beta Arcade'}
                      </span>
                      <span className="font-mono-tabular text-[9px] font-bold text-violet-300">
                        5× TILE → +2 STAT
                      </span>
                    </div>
                    {run.heroine.betaTrialChip ? (
                      <div className="rounded-lg border border-violet-400/50 bg-violet-900/30 px-2.5 py-1.5 font-mono-tabular text-[10px] text-violet-200 font-bold">
                        {run.heroine.betaTrialChip.upgraded
                          ? isCs
                            ? '✓ Trvale vylepšeno (+2)'
                            : '✓ Permanently Upgraded (+2)'
                          : `${run.heroine.betaTrialChip.resolvesLogged}/5 · ${run.heroine.betaTrialChip.combatsRemaining}f`}
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="beta-arcade-claim-btn"
                        onClick={() => onStartBetaTrial(run.clinicShopChoices[0])}
                        className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 font-mono-tabular text-[10px] font-bold text-white hover:brightness-110 cursor-pointer"
                      >
                        {isCs ? 'Zkušební AI Čip (0 CR)' : 'Trial AI Chip (0 CR)'}
                      </button>
                    )}
                  </div>
                )}

                {/* 3. Heirloom Forge */}
                {onEngraveHeirloom && (
                  <div
                    data-testid="dealer-heirloom-forge"
                    className="chrome-pill rounded-xl border border-amber-400/40 bg-amber-950/20 p-2.5 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-xs font-bold text-amber-200">
                        🗡 {isCs ? 'Rodová Kovárna' : 'Heirloom Forge'}
                      </span>
                      <span className="font-mono-tabular text-[9px] font-bold text-amber-300">
                        +{run.heroine.heirloomStacks ?? 0} (+1/WIN)
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="heirloom-forge-engrave-btn"
                      disabled={run.heroine.ownedEquipment.length === 0}
                      onClick={() => {
                        const target =
                          run.heroine.ownedEquipment[0]?.defId ?? 'starter_katana_chip';
                        onEngraveHeirloom(target);
                      }}
                      className="w-full rounded-lg border border-amber-300/60 bg-amber-500/25 px-3 py-1.5 font-mono-tabular text-[10px] font-bold text-amber-100 hover:bg-amber-500/35 disabled:opacity-45 cursor-pointer"
                    >
                      {run.heroine.heirloomEngravedId
                        ? isCs
                          ? `Posílit (+1 → +${(run.heroine.heirloomStacks ?? 0) + 1})`
                          : `Empower (+1 → +${(run.heroine.heirloomStacks ?? 0) + 1})`
                        : isCs
                          ? 'Vyrýt Dědictví (+1 k dílkům)'
                          : 'Engrave Heirloom (+1 Tiles)'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
