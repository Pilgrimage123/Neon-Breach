import { localizeCyberEvent } from '../engine/cyberEvents';
import type { CyberEventChoice, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface CyberEventViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  onChoice: (choiceIndex: number) => void;
}

export function CyberEventView({
  run,
  lang,
  isCompactLandscape = false,
  onChoice,
}: CyberEventViewProps) {
  const t = TRANSLATIONS[lang];
  const event = run.activeEvent ? localizeCyberEvent(run.activeEvent, lang) : null;
  if (!event) return null;

  const heroine = run.heroine;

  return (
    <main
      className={`cyber-vista-bg flex flex-1 min-h-0 flex-col items-center overflow-y-auto ${
        isCompactLandscape ? 'px-3 py-2' : 'px-3 py-3 sm:px-6 sm:py-6'
      }`}
    >
      <div
        className={`chrome-glass my-auto w-full max-w-4xl rounded-2xl border border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.2)] ${
          isCompactLandscape ? 'p-3' : 'p-4 sm:p-6 md:p-8'
        }`}
      >
        {/* Header Badge & Title */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-300 font-mono-tabular text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              {t.eventViewTitle}
            </span>
            <span className="text-xs font-mono-tabular text-slate-400">
              {event.subtitle}
            </span>
          </div>

          <h1
            className={`font-display font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200 ${
              isCompactLandscape ? 'text-xl' : 'text-2xl md:text-3xl'
            }`}
          >
            {event.title}
          </h1>

          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-200 bg-slate-900/60 p-3 rounded-xl border border-purple-500/20">
            {event.story}
          </p>
        </div>

        {/* Choices List */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 ${
            isCompactLandscape ? 'mt-3 gap-2.5' : 'mt-5 gap-3.5'
          }`}
        >
          {event.choices.map((choice: CyberEventChoice, idx: number) => {
            const costCr = choice.costCredits ?? 0;
            const hpCost = choice.hpCost ?? 0;
            const canAffordCr = heroine.credits >= costCr;
            const canAffordHp = heroine.hp > hpCost || hpCost === 0;
            const isDisabled = !canAffordCr || !canAffordHp;

            return (
              <div
                key={choice.id}
                className={`chrome-pill flex flex-col justify-between rounded-xl border transition-all ${
                  isDisabled
                    ? 'border-slate-700/50 bg-slate-900/40 opacity-60'
                    : 'border-purple-400/40 bg-purple-950/20 hover:border-purple-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                } ${isCompactLandscape ? 'p-3' : 'p-4 sm:p-5'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      className={`font-display font-bold text-white ${
                        isCompactLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                      }`}
                    >
                      {choice.label}
                    </h2>
                  </div>

                  <p className="mt-1.5 text-[11px] sm:text-xs leading-relaxed text-slate-300">
                    {choice.description}
                  </p>

                  {/* Costs & Rewards Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5 font-mono-tabular text-[11px]">
                    {costCr > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                        -{costCr} {t.creditsLabel}
                      </span>
                    )}
                    {hpCost > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                        -{hpCost} {t.hpLabel}
                      </span>
                    )}
                    {(choice.rewardCredits ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                        +{choice.rewardCredits} {t.creditsLabel}
                      </span>
                    )}
                    {(choice.rewardNanites ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
                        +{choice.rewardNanites} {t.nanitesShort}
                      </span>
                    )}
                    {(choice.rewardHp ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                        +{choice.rewardHp} {t.hpLabel}
                      </span>
                    )}
                    {(choice.rewardOverdrive ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 font-bold">
                        +{choice.rewardOverdrive}% OD
                      </span>
                    )}
                    {(choice.rewardDamageBoostPct ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold">
                        +{choice.rewardDamageBoostPct}% DMG
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onChoice(idx)}
                  className={`mt-4 w-full rounded-lg font-bold transition-all cursor-pointer ${
                    isDisabled
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-110 active:scale-[0.98]'
                  } ${isCompactLandscape ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}`}
                >
                  {isDisabled ? (!canAffordCr ? t.notEnoughCredits : t.eventCriticalHp) : t.eventExecuteChoice}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
