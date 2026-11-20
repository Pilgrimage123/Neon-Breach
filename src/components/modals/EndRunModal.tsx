import type { CharacterId } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';

export interface EndRunModalProps {
  outcome: 'victory' | 'gameover';
  characterId?: CharacterId;
  lang: Language;
  score: number;
  bestScore: number;
  turns: number;
  enemiesDefeated: number;
  canRetryEncounter?: boolean;
  failForwardAllowed?: boolean;
  canSkipEncounter?: boolean;
  onRetryClean?: () => void;
  onFailForwardRetry?: () => void;
  onSkipEncounter?: () => void;
  onPlayAgain: () => void;
  onTitle: () => void;
}

export function EndRunModal({
  outcome,
  characterId = 'kira',
  lang,
  score,
  bestScore,
  turns,
  enemiesDefeated,
  canRetryEncounter = false,
  failForwardAllowed = true,
  canSkipEncounter = false,
  onRetryClean,
  onFailForwardRetry,
  onSkipEncounter,
  onPlayAgain,
  onTitle,
}: EndRunModalProps) {
  const t = TRANSLATIONS[lang];
  const isVictory = outcome === 'victory';
  const charCode = t.characters[characterId].code;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 backdrop-blur-sm"
    >
      <div
        className={`chrome-panel-bright max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4 sm:p-6 text-center ${
          isVictory ? 'border-[#FFC700]/65' : 'border-[#FF2E7E]/65'
        }`}
      >
        <h2
          id="end-modal-title"
          className="chrome-text-shimmer font-display text-2xl sm:text-3xl font-bold"
        >
          {isVictory ? t.victoryTitle : t.defeatTitle}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-200">
          {isVictory ? t.victorySubtitle : t.defeatSubtitle.replace('{name}', charCode)}
        </p>

        <div className="mt-3 sm:mt-5 grid grid-cols-3 gap-2">
          <div className="chrome-pill rounded-xl p-2 sm:p-3">
            <div className="text-[12px] sm:text-[13px] uppercase tracking-wider text-slate-300">
              {t.scoreLabel}
            </div>
            <div className="mt-0.5 font-mono-tabular text-base sm:text-lg font-bold text-[#FFC700]">
              {score}
            </div>
          </div>
          <div className="chrome-pill rounded-xl p-2 sm:p-3">
            <div className="text-[12px] sm:text-[13px] uppercase tracking-wider text-slate-300">
              {t.turnsLabel}
            </div>
            <div className="mt-0.5 font-mono-tabular text-base sm:text-lg font-bold text-[#00F0FF]">
              {turns}
            </div>
          </div>
          <div className="chrome-pill rounded-xl p-2 sm:p-3">
            <div className="text-[12px] sm:text-[13px] uppercase tracking-wider text-slate-300">
              {t.enemiesDefeatedLabel}
            </div>
            <div className="mt-0.5 font-mono-tabular text-base sm:text-lg font-bold text-rose-300">
              {enemiesDefeated}
            </div>
          </div>
        </div>

        <div className="mt-2.5 font-mono-tabular text-[13px] font-semibold text-amber-200">
          {t.bestScoreLabel}: {Math.max(score, bestScore)}
        </div>

        {!isVictory &&
          ((canRetryEncounter && (onFailForwardRetry || onRetryClean)) ||
            (canSkipEncounter && onSkipEncounter)) && (
          <div className="mt-3.5 flex flex-col gap-2 rounded-xl border border-cyan-300/35 bg-slate-900/75 p-2.5 text-left">
            <div className="text-center font-mono-tabular text-[12px] font-bold uppercase tracking-wider text-[#00F0FF]">
              {lang === 'cs'
                ? 'Druhá šance v tomto uzlu'
                : 'Node Recovery Options'}
            </div>
            {failForwardAllowed && canRetryEncounter && onFailForwardRetry && (
              <button
                type="button"
                data-testid="fail-forward-retry-btn"
                onClick={onFailForwardRetry}
                className="chrome-btn-primary w-full rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'cs'
                  ? '⚡ Zkusit znovu s podporou (+15 HP, +10 Štít, +40 % OD)'
                  : '⚡ Fail-Forward Retry (+15 HP, +10 Shield, +40% OD)'}
              </button>
            )}
            {canRetryEncounter && onRetryClean && (
              <button
                type="button"
                data-testid="retry-node-clean-btn"
                onClick={onRetryClean}
                className="chrome-pill w-full rounded-lg border-cyan-300/45 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-200 hover:text-white cursor-pointer text-center"
              >
                {lang === 'cs'
                  ? '⟲ Začít boj znovu od 1. tahu'
                  : '⟲ Retry Encounter Cleanly (Turn 1)'}
              </button>
            )}
            {canSkipEncounter && onSkipEncounter && (
              <button
                type="button"
                data-testid="skip-encounter-btn"
                onClick={onSkipEncounter}
                className="chrome-pill w-full rounded-lg border-emerald-300/50 bg-emerald-950/55 px-3 py-2 text-xs font-bold text-emerald-100 transition-colors hover:border-emerald-200 hover:text-white cursor-pointer text-center"
              >
                {lang === 'cs'
                  ? '⏭ Přeskočit střet (Příběhový režim · zpět na mapu)'
                  : '⏭ Skip Puzzle Encounter (Story Mode · advance map)'}
              </button>
            )}
          </div>
        )}

        <div className="mt-3.5 sm:mt-5 flex flex-row gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="chrome-btn-strike flex-1 rounded-lg px-4 py-2 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            {isVictory ? t.playAgain : t.tryAgain}
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="chrome-pill flex-1 rounded-lg px-4 py-2 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-white transition-colors hover:border-cyan-300 cursor-pointer"
          >
            {t.returnTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
