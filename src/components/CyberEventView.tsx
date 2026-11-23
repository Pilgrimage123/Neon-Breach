import { useEffect } from 'react';
import { DYNASTY_EVENT_TEMPLATES, localizeCyberEvent } from '../engine/cyberEvents';
import type { CyberEventChoice, RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface CyberEventViewProps {
  run: RunState;
  lang: Language;
  modalOpen?: boolean;
  isCompactLandscape?: boolean;
  onChoice: (choiceIndex: number) => void;
  onSwitchEvent?: (eventId: string) => void;
}

export function CyberEventView({
  run,
  lang,
  modalOpen = false,
  isCompactLandscape = false,
  onChoice,
  onSwitchEvent,
}: CyberEventViewProps) {
  const t = TRANSLATIONS[lang];
  const isCs = lang === 'cs';
  const event = run.activeEvent ? localizeCyberEvent(run.activeEvent, lang) : null;
  const hero = run.hero;

  useEffect(() => {
    if (!event || modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (idx >= 0 && idx < event.choices.length) {
        const choice = event.choices[idx];
        const costCr = choice.costCredits ?? 0;
        const hpCost = choice.hpCost ?? 0;
        if (hero.credits >= costCr && (hero.hp > hpCost || hpCost === 0)) {
          e.preventDefault();
          onChoice(idx);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event, hero.credits, hero.hp, modalOpen, onChoice]);

  if (!event) return null;

  return (
    <main
      className={`cyber-vista-bg flex flex-1 min-h-0 flex-col items-center overflow-y-auto ${
        isCompactLandscape ? 'px-3 py-2' : 'px-3 py-3 sm:px-6 sm:py-5'
      }`}
    >
      <div
        className={`chrome-glass my-auto w-full max-w-[1560px] rounded-2xl border border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.2)] ${
          isCompactLandscape ? 'p-3' : 'p-4 sm:p-6'
        }`}
      >
        {/* Streamlined Single-Row Header + Dynasty Relay Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2 min-w-0">
            <span className="font-mono-tabular text-[13px] font-bold uppercase tracking-wider text-purple-300">
              ❓ {t.eventViewTitle}
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <h1
              className={`font-display font-black tracking-wide text-white ${
                isCompactLandscape ? 'text-lg' : 'text-xl sm:text-2xl'
              }`}
            >
              {event.title}
            </h1>
            <span className="text-[13px] font-mono-tabular text-slate-300">
              — {event.story}
            </span>
          </div>

          {onSwitchEvent && (
            <div className="flex flex-wrap items-center gap-1">
              {DYNASTY_EVENT_TEMPLATES.map((tpl) => {
                const loc = localizeCyberEvent(tpl, lang);
                const isActive = event.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    data-testid={`event-channel-${tpl.id}`}
                    onClick={() => onSwitchEvent(tpl.id)}
                    className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[12px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-fuchsia-300 bg-fuchsia-500/30 text-white'
                        : 'border-purple-400/35 bg-slate-900/70 text-purple-200 hover:border-purple-300'
                    }`}
                  >
                    ✦ {loc.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Single-Click Direct Action Choice Cards (Zero Redundant Badge Duplication) */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 ${
            isCompactLandscape ? 'mt-2.5 gap-2' : 'mt-4 gap-3'
          }`}
        >
          {event.choices.map((choice: CyberEventChoice, idx: number) => {
            const costCr = choice.costCredits ?? 0;
            const hpCost = choice.hpCost ?? 0;
            const canAffordCr = hero.credits >= costCr;
            const canAffordHp = hero.hp > hpCost || hpCost === 0;
            const isDisabled = !canAffordCr || !canAffordHp;

            return (
              <button
                key={choice.id}
                type="button"
                data-testid={`event-choice-btn-${idx}`}
                disabled={isDisabled}
                onClick={() => onChoice(idx)}
                className={`chrome-pill group flex flex-col justify-between rounded-xl border text-left transition-all ${
                  isDisabled
                    ? 'border-slate-700/50 bg-slate-900/40 opacity-55 cursor-not-allowed'
                    : 'border-purple-400/45 bg-purple-950/25 hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.28)] cursor-pointer'
                } ${isCompactLandscape ? 'p-3' : 'p-4'}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className={`font-display font-bold text-white ${
                        isCompactLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                      }`}
                    >
                      {choice.label}
                    </h2>
                    <span className="shrink-0 rounded border border-purple-300/40 bg-purple-950/60 px-1.5 py-0.5 font-mono-tabular text-[12px] font-bold text-purple-200">
                      [{idx + 1}]
                    </span>
                  </div>

                  {/* Direct Math-Over-Prose Formula */}
                  <div className="mt-2 font-mono-tabular text-[13px] sm:text-sm font-bold text-[#F4F4F6] leading-snug">
                    {choice.description}
                  </div>

                  {/* Special Unlock Tags Only (No Duplicate Numeric Pills) */}
                  {(choice.rewardScionHouse ||
                    choice.rewardFreeImplant ||
                    (choice.rewardHeirloomStacks ?? 0) > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 font-mono-tabular text-[12px]">
                      {choice.rewardScionHouse && (
                        <span className="px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-400/50 text-pink-200 font-bold">
                          ⚜ {choice.rewardScionHouse === 'house_solaris' ? 'SCION SOLARIS' : 'SCION VALKYR'}
                        </span>
                      )}
                      {choice.rewardFreeImplant && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-bold">
                          +1 {isCs ? 'Taktický modul' : 'Tactical Module'}
                        </span>
                      )}
                      {(choice.rewardHeirloomStacks ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold">
                          +{choice.rewardHeirloomStacks} {isCs ? 'Dědictví' : 'Heirloom'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono-tabular text-xs font-bold ${
                    isDisabled ? 'text-rose-300' : 'text-purple-200 group-hover:text-white'
                  }`}
                >
                  <span>
                    {isDisabled
                      ? !canAffordCr
                        ? t.notEnoughCredits
                        : t.eventCriticalHp
                      : t.eventExecuteChoice}
                  </span>
                  {!isDisabled && <span>→</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
