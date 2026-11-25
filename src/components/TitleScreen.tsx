import { useEffect, useState } from 'react';
import {
  getPreloadedTitleBg,
  loadTitleBg,
  preloadForTitleScreen,
} from '../assets/assetPreloader';
import { GAME_ASSETS } from '../assets/gameAssets';
import type { CharacterId, DifficultyTier } from '../engine/types';
import { CODEX_TRANSLATIONS } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { CodexTab } from './CodexModal';
import { TitleDifficultySelector } from './title/TitleDifficultySelector';
import { TitleHeroSelector } from './title/TitleHeroSelector';
import { TitleEmblemStage } from './TitleEmblemStage';

interface TitleScreenProps {
  lang: Language;
  onToggleLang: () => void;
  hasSavedRun: boolean;
  bestScore: number;
  stagesCleared: number;
  selectedCharacter: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  selectedDifficultyTier: DifficultyTier;
  onSelectDifficultyTier: (tier: DifficultyTier) => void;
  onStartNewRun: () => void;
  onContinueRun: () => void;
  isCompactLandscape?: boolean;
  isNarrowPortrait?: boolean;
  showLandscapeToggle?: boolean;
  isLandscapeRotated?: boolean;
  onToggleLandscape?: () => void;
  showFullscreenButton?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId) => void;
  onOpenDevLab?: () => void;
}

export function TitleScreen({
  lang,
  onToggleLang,
  hasSavedRun,
  bestScore,
  stagesCleared,
  selectedCharacter,
  onSelectCharacter,
  selectedDifficultyTier,
  onSelectDifficultyTier,
  onStartNewRun,
  onContinueRun,
  isCompactLandscape = false,
  isNarrowPortrait = false,
  showLandscapeToggle = false,
  isLandscapeRotated = false,
  onToggleLandscape,
  showFullscreenButton = false,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenCodex,
  onOpenDevLab,
}: TitleScreenProps) {
  const [bgReady, setBgReady] = useState<boolean>(() => Boolean(getPreloadedTitleBg()));
  const [bgFailed, setBgFailed] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];

  useEffect(() => {
    let cancelled = false;
    if (!getPreloadedTitleBg()) {
      void loadTitleBg()
        .then(() => {
          if (!cancelled) setBgReady(true);
        })
        .catch(() => {
          if (!cancelled) setBgFailed(true);
        });
    }
    preloadForTitleScreen(selectedCharacter);
    return () => {
      cancelled = true;
    };
  }, [selectedCharacter]);

  useEffect(() => {
    if (!howToPlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setHowToPlayOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [howToPlayOpen]);

  const renderHowToPlayModal = () => {
    if (!howToPlayOpen) return null;
    const h = t.howToPlay;
    return (
      <div
        data-title-overlay-open="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 p-3 sm:p-6 backdrop-blur-sm"
        onClick={() => setHowToPlayOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-to-play-dialog-title"
          data-testid="frontpage-how-to-play"
          onClick={(e) => e.stopPropagation()}
          className="chrome-panel-bright relative flex max-h-[min(90dvh,720px)] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl p-4 sm:p-6 text-slate-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="how-to-play-dialog-title"
                className="font-display text-base sm:text-lg font-extrabold uppercase tracking-wider text-[#00F0FF]"
              >
                {h.title}
              </h2>
              <span className="rounded-md border border-amber-300/45 bg-amber-950/50 px-2 py-0.5 font-mono-tabular text-[11.5px] font-bold uppercase tracking-wider text-[#FFE066]">
                {h.badge}
              </span>
            </div>
            <button
              type="button"
              data-testid="close-how-to-play-button"
              onClick={() => setHowToPlayOpen(false)}
              aria-label={t.closeLabel}
              className="chrome-pill flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              <span>{t.closeLabel}</span>
            </button>
          </div>

          <div className="mt-3 overflow-y-auto pr-1">
            <p className="text-[13px] sm:text-sm leading-relaxed text-slate-100/95">
              {h.goal}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-white/12 bg-slate-900/70 p-3">
                <div className="font-display text-[13px] sm:text-sm font-bold text-cyan-200">
                  {h.step1Title}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-200/90">
                  {h.step1Desc}
                </p>
              </div>
              <div className="rounded-xl border border-white/12 bg-slate-900/70 p-3">
                <div className="font-display text-[13px] sm:text-sm font-bold text-cyan-200">
                  {h.step2Title}
                </div>
                <ul className="mt-1 space-y-1 text-[12.5px] leading-snug text-slate-200/95">
                  <li>
                    <span className="font-bold text-[#FF6B9D]">{h.attackLabel}:</span> {h.attackDesc}
                  </li>
                  <li>
                    <span className="font-bold text-[#38BDF8]">{h.defenseLabel}:</span> {h.defenseDesc}
                  </li>
                  <li>
                    <span className="font-bold text-[#FFC700]">{h.techLabel}:</span> {h.techDesc}
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/12 bg-slate-900/70 p-3">
                <div className="font-display text-[13px] sm:text-sm font-bold text-amber-200">
                  {h.step3Title}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-200/90">
                  {h.step3Desc}
                </p>
              </div>
              <div className="rounded-xl border border-white/12 bg-slate-900/70 p-3">
                <div className="font-display text-[13px] sm:text-sm font-bold text-emerald-200">
                  {h.step4Title}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-200/90">
                  {h.step4Desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHowToPlayButton = (compactBtn: boolean) => (
    <button
      type="button"
      data-testid="title-how-to-play-button"
      aria-haspopup="dialog"
      aria-expanded={howToPlayOpen}
      onClick={() => setHowToPlayOpen(true)}
      className={`chrome-pill flex items-center gap-1.5 rounded-lg ${
        compactBtn ? 'px-3.5 py-1.5 text-xs' : 'px-4 py-2 sm:px-5 sm:py-2.5 text-sm'
      } font-semibold text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-[#00F0FF]"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
      <span>{t.howToPlay.title}</span>
    </button>
  );

  const renderPrimaryActions = (compactBtn: boolean) => (
    <div className={`${compactBtn ? 'mt-2.5' : 'mt-3.5 sm:mt-4'} flex flex-wrap items-center gap-2.5`}>
      {hasSavedRun ? (
        <>
          <button
            type="button"
            data-start="true"
            onClick={onContinueRun}
            className={`chrome-btn-strike rounded-lg ${
              compactBtn ? 'px-4 py-1.5 text-xs' : 'px-5 py-2 sm:px-6 sm:py-2.5 text-sm'
            } font-bold tracking-wide transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer`}
          >
            {t.continueRun}
          </button>
          <button
            type="button"
            data-testid="new-run-button"
            onClick={onStartNewRun}
            className={`chrome-pill rounded-lg ${
              compactBtn ? 'px-3.5 py-1.5 text-xs' : 'px-4 py-2 sm:px-5 sm:py-2.5 text-sm'
            } font-semibold text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer`}
          >
            {t.newRun}
          </button>
        </>
      ) : (
        <button
          type="button"
          data-start="true"
          data-testid="new-run-button"
          onClick={onStartNewRun}
          className={`chrome-btn-strike rounded-lg ${
            compactBtn ? 'px-5 py-1.5 text-xs' : 'px-6 py-2 sm:px-7 sm:py-2.5 text-sm'
          } font-bold tracking-wide transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer`}
        >
          {t.startRun}
        </button>
      )}
      {renderHowToPlayButton(compactBtn)}
    </div>
  );

  return (
    <main className="cyber-vista-bg relative flex h-full w-full flex-col justify-between overflow-hidden text-slate-100">
      {!bgFailed && (
        <img
          src={GAME_ASSETS.titleBg}
          alt="Neo-Prague twilight sky-plaza"
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setBgReady(true)}
          onError={() => setBgFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover object-right transition-opacity duration-200 ${
            bgReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, rgba(8,15,36,0.44) 0%, rgba(9,18,44,0.72) 68%, rgba(6,11,28,0.88) 100%)',
        }}
      />

      <div
        className={`relative z-10 flex flex-wrap items-center justify-end gap-2 ${
          isCompactLandscape ? 'px-4 pt-2' : 'px-4 pt-3 sm:px-6 sm:pt-4 md:px-10'
        }`}
      >
        {showFullscreenButton && onToggleFullscreen && (
          <button
            type="button"
            data-testid="title-fullscreen-button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? t.fullscreenExit : t.fullscreenEnter}
            className={`chrome-pill flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              isFullscreen
                ? 'border-[#00F0FF] text-[#00F0FF]'
                : 'text-cyan-100 hover:border-cyan-300 hover:text-white'
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
            <span>{isFullscreen ? t.fullscreenExit : t.fullscreenEnter}</span>
          </button>
        )}
        {showLandscapeToggle && onToggleLandscape && (
          <button
            type="button"
            data-testid="toggle-landscape-button"
            onClick={onToggleLandscape}
            aria-label={isLandscapeRotated ? t.portraitToggle : t.landscapeToggle}
            className="chrome-pill rounded-full border-[#00F0FF]/55 px-3 py-1 text-xs font-bold tracking-wide text-[#00F0FF] transition-all hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ↻ {isLandscapeRotated ? t.portraitToggle : t.landscapeToggle}
          </button>
        )}
        {onOpenDevLab && (
          <button
            type="button"
            data-testid="title-dev-lab-button"
            onClick={onOpenDevLab}
            title={t.devLabHint}
            aria-label={`${t.devLabButton} — ${t.devLabHint}`}
            className="chrome-pill flex items-center gap-1.5 rounded-full border-[#00F0FF]/45 px-3 py-1 text-xs font-bold tracking-wide text-[#00F0FF] transition-all hover:border-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 3h6" />
              <path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
              <path d="M8.5 14h7" />
            </svg>
            <span>{t.devLabButton}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLang}
          aria-label="Toggle language"
          className="chrome-pill rounded-full px-3.5 py-1 text-xs font-bold tracking-wide text-cyan-100 transition-all hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {lang === 'en' ? 'EN · CS' : 'CS · EN'}
        </button>
      </div>

      <section
        className={`relative z-10 my-auto flex w-full flex-col ${
          isCompactLandscape
            ? 'items-center px-3'
            : 'mx-auto max-w-[1040px] items-center px-3 sm:px-6 md:px-10'
        }`}
      >
        {isCompactLandscape ? (
          <div className="chrome-glass grid w-full max-w-[1040px] max-h-[calc(100%-8px)] grid-cols-[minmax(0,0.84fr)_minmax(0,1.56fr)] items-center gap-3 overflow-y-auto rounded-2xl p-3">
            <div className="flex flex-col items-center min-w-0">
              <TitleEmblemStage compact className="w-full max-w-[325px] max-h-[205px]" />

              {bestScore > 0 && (
                <div className="mt-1 flex items-center gap-2 text-[12px] font-mono-tabular font-semibold text-[#FFC700]">
                  <span>
                    {t.bestScoreLabel}: {bestScore}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.sectorsClearedLabel}: {stagesCleared}
                  </span>
                </div>
              )}

              {renderPrimaryActions(true)}
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold uppercase tracking-widest text-cyan-200/90">
                  {t.selectHeroLabel}
                </span>
                {onOpenCodex && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="title-open-hero-dossier"
                      onClick={() => onOpenCodex('heroes', selectedCharacter)}
                      className="chrome-pill rounded-md px-2 py-0.5 text-[12px] font-bold text-[#00F0FF] transition-colors hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.inspectHeroDossierBtn}
                    </button>
                    <button
                      type="button"
                      data-testid="title-open-glossary"
                      onClick={() => onOpenCodex('glossary', selectedCharacter)}
                      className="chrome-pill rounded-md px-2 py-0.5 text-[12px] font-bold text-[#FFC700] transition-colors hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.viewGlossaryBtn}
                    </button>
                  </div>
                )}
              </div>
              <TitleHeroSelector
                lang={lang}
                selectedCharacter={selectedCharacter}
                compactCards={true}
                onSelectCharacter={onSelectCharacter}
              />
              <TitleDifficultySelector
                lang={lang}
                selectedDifficultyTier={selectedDifficultyTier}
                compact={true}
                onSelectDifficultyTier={onSelectDifficultyTier}
              />
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-[1060px] flex-col items-center">
            <div className="relative z-20 flex w-full justify-center pointer-events-none">
              <TitleEmblemStage
                className={
                  isNarrowPortrait
                    ? 'w-[100%] max-w-[360px] max-h-[28dvh]'
                    : 'h-[clamp(210px,38dvh,375px)] w-auto max-w-[92vw]'
                }
              />
            </div>

            <div
              className={`chrome-glass relative z-10 w-full rounded-2xl ${
                isNarrowPortrait
                  ? '-mt-2.5 max-h-[calc(100dvh-210px)] overflow-y-auto px-3 pb-3 pt-4.5'
                  : '-mt-3 sm:-mt-4 max-h-[calc(100dvh-255px)] overflow-y-auto px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6'
              }`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-[2px] w-[40%] -translate-x-1/2 rounded-full opacity-85"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(0,240,255,0) 0%, rgba(0,240,255,0.85) 35%, rgba(255,46,126,0.9) 65%, rgba(255,46,126,0) 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-14 w-[46%] -translate-x-1/2 rounded-b-full"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 0%, rgba(0,240,255,0.16) 0%, rgba(255,46,126,0.08) 48%, rgba(0,0,0,0) 100%)',
                }}
              />

              <div className="relative min-w-0">
                <div>
                  <div
                    className={`relative z-30 flex justify-between gap-2 ${
                      isNarrowPortrait
                        ? 'mb-2 flex-wrap items-center'
                        : 'mb-2.5 sm:mb-3 items-center'
                    }`}
                  >
                    <span className="pb-0.5 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-widest text-cyan-200/95 whitespace-nowrap">
                      {t.selectHeroLabel}
                    </span>
                    {onOpenCodex && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="title-open-hero-dossier"
                          onClick={() => onOpenCodex('heroes', selectedCharacter)}
                          className="chrome-pill rounded-md px-2.5 py-1 text-[12px] sm:text-[12.5px] font-bold text-[#00F0FF] transition-colors hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {codexT.inspectHeroDossierBtn}
                        </button>
                        <button
                          type="button"
                          data-testid="title-open-glossary"
                          onClick={() => onOpenCodex('glossary', selectedCharacter)}
                          className="chrome-pill rounded-md px-2.5 py-1 text-[12px] sm:text-[12.5px] font-bold text-[#FFC700] transition-colors hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {codexT.viewGlossaryBtn}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative z-20">
                    <TitleHeroSelector
                      lang={lang}
                      selectedCharacter={selectedCharacter}
                      compactCards={false}
                      onSelectCharacter={onSelectCharacter}
                    />
                  </div>
                </div>

                <TitleDifficultySelector
                  lang={lang}
                  selectedDifficultyTier={selectedDifficultyTier}
                  compact={false}
                  onSelectDifficultyTier={onSelectDifficultyTier}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {renderPrimaryActions(false)}

                  {bestScore > 0 && (
                    <div className="mt-3.5 sm:mt-4 flex items-center gap-2.5 text-[13px] font-mono-tabular font-semibold text-[#FFC700]">
                      <span>
                        {t.bestScoreLabel}: {bestScore}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.sectorsClearedLabel}: {stagesCleared}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {renderHowToPlayModal()}

      <footer
        className={`relative z-10 ${
          isNarrowPortrait
            ? 'h-2'
            : isCompactLandscape
              ? 'px-4 pb-2'
              : 'px-4 pb-3 sm:px-6 sm:pb-4 md:px-12'
        }`}
      >
        {!isNarrowPortrait && (
          <p className={`${isCompactLandscape ? 'text-[12px]' : 'text-[12.5px] sm:text-[13px]'} font-medium tracking-wide text-slate-200/90 drop-shadow`}>
            {t.controlsHint}
          </p>
        )}
      </footer>
    </main>
  );
}
