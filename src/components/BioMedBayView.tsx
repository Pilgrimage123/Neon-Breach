import type { RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface BioMedBayViewProps {
  run: RunState;
  lang: Language;
  onAction: (action: 'heal' | 'calibrate_max_hp' | 'salvage_credits') => void;
}

export function BioMedBayView({ run, lang, onAction }: BioMedBayViewProps) {
  const t = TRANSLATIONS[lang];
  const healedHp = Math.min(run.heroine.maxHp, run.heroine.hp + 22);
  const calibratedMaxHp = run.heroine.maxHp + 10;

  return (
    <main className="cyber-vista-bg flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
      <div className="chrome-glass w-full max-w-5xl rounded-2xl p-5 md:p-7">
        <div className="flex flex-col gap-1">
          <h1 className="chrome-text-shimmer font-display text-2xl font-bold md:text-3xl">
            {t.medbayTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-200">{t.medbaySubtitle}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Option 1: Bio-Repair */}
          <div className="chrome-pill flex flex-col justify-between rounded-xl border-[#10F5A0]/50 p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[#10F5A0]">
                {t.medbayHealTitle}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-200">{t.medbayHealDesc}</p>
              <div className="mt-3.5 font-mono-tabular text-sm font-bold text-white">
                {run.heroine.hp} → {healedHp} / {run.heroine.maxHp} {t.hpLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAction('heal')}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#10F5A0] to-[#6EE7B7] px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(16,245,160,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all hover:brightness-110 cursor-pointer"
            >
              {t.applyRepair}
            </button>
          </div>

          {/* Option 2: Chassis Reinforcement */}
          <div className="chrome-pill flex flex-col justify-between rounded-xl border-[#00F0FF]/50 p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[#00F0FF]">
                {t.medbayCalibrateTitle}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-200">{t.medbayCalibrateDesc}</p>
              <div className="mt-3.5 font-mono-tabular text-sm font-bold text-white">
                {run.heroine.maxHp} → {calibratedMaxHp} Max {t.hpLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAction('calibrate_max_hp')}
              className="chrome-btn-primary mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all cursor-pointer"
            >
              {t.applyCalibrate}
            </button>
          </div>

          {/* Option 3: Resource Salvage */}
          <div className="chrome-pill flex flex-col justify-between rounded-xl border-[#FFC700]/50 p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[#FFC700]">
                {t.medbaySalvageTitle}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-200">{t.medbaySalvageDesc}</p>
              <div className="mt-3.5 font-mono-tabular text-sm font-bold text-white">
                {run.heroine.credits} → {run.heroine.credits + 35} {t.creditsLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAction('salvage_credits')}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all hover:brightness-110 cursor-pointer"
            >
              {t.applySalvage}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
