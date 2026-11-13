import { useState } from 'react';
import {
  CYBER_IMPLANTS,
  EQUIPMENT_BY_ID,
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
  onBuyEquipment: (defId: string) => void;
  onInstall: (implantId: CyberImplantId, replaceId?: CyberImplantId) => void;
  onSkip: () => void;
}

export function CyberClinicView({
  run,
  lang,
  onBuyEquipment,
  onInstall,
  onSkip,
}: CyberClinicViewProps) {
  const t = TRANSLATIONS[lang];
  const [pendingImplant, setPendingImplant] = useState<CyberImplantId | null>(null);
  const needsReplace = run.heroine.implants.length >= MAX_IMPLANTS;
  const equippedWeight = getEquippedEquipmentWeight(run.heroine);

  const handleChooseModule = (id: CyberImplantId) => {
    if (needsReplace) {
      setPendingImplant(id);
    } else {
      onInstall(id);
    }
  };

  return (
    <main className="cyber-vista-bg flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-4 sm:px-6">
      <div className="chrome-glass w-full max-w-5xl rounded-2xl p-5 md:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="chrome-text-shimmer font-display text-2xl font-bold md:text-3xl">
              {t.clinicTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200">{t.clinicSubtitle}</p>
          </div>
          <div className="flex items-center gap-3 font-mono-tabular text-sm">
            <span className="font-bold text-[#FFC700]">
              {run.heroine.credits} {t.creditsLabel}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="font-semibold text-[#00F0FF]">
              {t.capacityLabel}: {equippedWeight}/{run.heroine.carryCapacity}
            </span>
          </div>
        </div>

        {/* Section 1: Equipment Requisition Shop */}
        <div className="mt-4 border-t border-white/15 pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#FFC700]">
            {t.clinicShopTitle}
          </div>
          {run.clinicShopChoices.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">{t.clinicShopEmpty}</p>
          ) : (
            <div className="mt-2.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {run.clinicShopChoices.map((defId) => {
                const def = EQUIPMENT_BY_ID[defId];
                if (!def) return null;
                const meta = t.equipment[def.id];
                const canAfford = run.heroine.credits >= def.price;

                return (
                  <div
                    key={defId}
                    className="chrome-pill flex flex-col justify-between rounded-xl border-amber-300/40 p-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                        <span className="text-[#00F0FF]">
                          {t.sizeLabel}: {def.size}
                        </span>
                        <span className="font-bold text-[#FFC700]">
                          {def.price} {t.creditsLabel}
                        </span>
                      </div>
                      <h2 className="mt-1.5 font-display text-base font-bold text-white">
                        {meta?.name ?? def.id}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-slate-200">
                        {meta?.desc ?? ''}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[11px]">
                        {def.tiles.map((spec, idx) => (
                          <span
                            key={`${defId}_tile_${idx}`}
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
                      onClick={() => onBuyEquipment(defId)}
                      className="mt-3.5 w-full rounded-lg bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] px-3 py-2 text-xs font-bold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all hover:brightness-110 disabled:bg-none disabled:bg-slate-800/80 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
                    >
                      {canAfford
                        ? `${t.buyEquipment} (${def.price} ${t.creditsLabel})`
                        : `${t.notEnoughCredits} (${def.price})`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Cybernetic Implant Draft */}
        <div className="mt-4 border-t border-white/15 pt-4">
          {!pendingImplant ? (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                {t.clinicSelectPrompt}
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
                {run.clinicChoices.map((id) => {
                  const meta = t.implants[id];
                  const info = CYBER_IMPLANTS.find((item) => item.id === id);
                  const isRare = info?.rarity === 'rare';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleChooseModule(id)}
                      className={`chrome-pill flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-150 hover:-translate-y-0.5 cursor-pointer ${
                        isRare
                          ? 'border-[#FFC700]/65 hover:border-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.18)]'
                          : 'border-[#00F0FF]/50 hover:border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <ImplantIcon id={id} size={26} />
                          <span
                            className={`text-xs font-bold ${
                              isRare ? 'text-[#FFC700]' : 'text-[#00F0FF]'
                            }`}
                          >
                            {isRare ? t.rarityRare : t.rarityCommon}
                          </span>
                        </div>
                        <h2 className="mt-2.5 font-display text-base font-bold text-white">
                          {meta.name}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-200">{meta.desc}</p>
                      </div>
                      <div className="mt-3 text-xs font-bold text-[#00F0FF]">
                        {t.installImplant} →
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div>
              <div className="text-sm font-bold text-[#FFC700]">{t.clinicReplacePrompt}</div>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {run.heroine.implants.map((existingId) => {
                  const meta = t.implants[existingId];
                  return (
                    <button
                      key={existingId}
                      type="button"
                      onClick={() => onInstall(pendingImplant, existingId)}
                      className="chrome-pill flex items-start gap-3 rounded-xl border-rose-400/55 p-3.5 text-left transition-all hover:border-rose-300 cursor-pointer"
                    >
                      <ImplantIcon id={existingId} size={24} className="shrink-0" />
                      <div>
                        <div className="font-display text-sm font-bold text-white">
                          {meta.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-200">{meta.desc}</div>
                        <div className="mt-1.5 text-xs font-bold text-rose-300">
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

        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3.5">
          {pendingImplant ? (
            <button
              type="button"
              onClick={() => setPendingImplant(null)}
              className="chrome-pill rounded-lg px-4 py-1.5 text-xs font-semibold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer"
            >
              ← {t.clinicSelectPrompt}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSkip}
            className="chrome-pill rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:text-white cursor-pointer"
          >
            {t.skipClinic}
          </button>
        </div>
      </div>
    </main>
  );
}
