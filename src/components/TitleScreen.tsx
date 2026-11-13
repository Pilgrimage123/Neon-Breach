import { useState } from 'react';
import { GAME_ASSETS } from '../assets/gameAssets';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface TitleScreenProps {
  lang: Language;
  onToggleLang: () => void;
  hasSavedRun: boolean;
  bestScore: number;
  sectorsCleared: number;
  onStartNewRun: () => void;
  onContinueRun: () => void;
}

export function TitleScreen({
  lang,
  onToggleLang,
  hasSavedRun,
  bestScore,
  sectorsCleared,
  onStartNewRun,
  onContinueRun,
}: TitleScreenProps) {
  const [bgFailed, setBgFailed] = useState(false);
  const t = TRANSLATIONS[lang];

  return (
    <main className="cyber-vista-bg relative flex h-screen w-full flex-col justify-between overflow-hidden text-slate-100">
      {/* Illustrated Key-Art Backdrop */}
      {!bgFailed && (
        <img
          src={GAME_ASSETS.titleBg}
          alt="Neo-Prague twilight sky-plaza"
          referrerPolicy="no-referrer"
          onError={() => setBgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-right brightness-105 saturate-115"
        />
      )}

      {/* Measured left-weighted twilight-chrome scrim for crisp WCAG AA contrast while keeping right vista radiant */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,15,36,0.86) 0%, rgba(11,22,50,0.62) 38%, rgba(14,165,233,0.06) 100%)',
        }}
      />

      {/* Top Corner Utility Bar (Language Switch Only) */}
      <div className="relative z-10 flex items-center justify-end px-6 pt-5 md:px-10">
        <button
          type="button"
          onClick={onToggleLang}
          aria-label="Toggle language"
          className="chrome-pill rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide text-cyan-100 transition-all hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0"
        >
          {lang === 'en' ? 'EN · CS' : 'CS · EN'}
        </button>
      </div>

      {/* Left-Third Compact Chrome Emblem & Primary Actions */}
      <section className="relative z-10 my-auto flex max-w-xl flex-col items-start px-6 md:px-12">
        <div className="chrome-glass rounded-2xl p-6 sm:p-7">
          {/* Custom Inline SVG NEON BREACH Liquid-Chrome Title Lockup */}
          <svg
            viewBox="0 0 560 144"
            className="w-full max-w-[460px] select-none"
            role="img"
            aria-label="NEON BREACH"
          >
            <defs>
              <linearGradient id="nbChromeText" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="48%" stopColor="#E0F2FE" />
                <stop offset="52%" stopColor="#7DD3FC" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>
              <linearGradient id="nbBladeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="52%" stopColor="#FF2E7E" />
                <stop offset="100%" stopColor="#FFC700" />
              </linearGradient>
            </defs>
            {/* Geometric chrome emblem chevron + blade slash */}
            <path
              d="M8 22L28 12L44 36L24 58L8 22Z"
              fill="#0B1636"
              stroke="#00F0FF"
              strokeWidth="2.5"
            />
            <path d="M16 42L46 14" stroke="#FF2E7E" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M8 104H468L492 92" stroke="url(#nbBladeGrad)" strokeWidth="2.5" fill="none" />

            {/* Main Liquid-Chrome Display Wordmark */}
            <text
              x="56"
              y="64"
              fill="url(#nbChromeText)"
              fontFamily="'Chakra Petch', system-ui, sans-serif"
              fontWeight="700"
              fontSize="56"
              letterSpacing="3"
            >
              NEON BREACH
            </text>
            <text
              x="58"
              y="93"
              fill="#00F0FF"
              fontFamily="'Chakra Petch', system-ui, sans-serif"
              fontWeight="700"
              fontSize="17"
              letterSpacing="4.5"
            >
              XENO-PURGE PROTOCOL
            </text>
          </svg>

          <p className="mt-2.5 max-w-md text-sm sm:text-base leading-relaxed text-slate-100/95">
            {t.gameSubtitle}
          </p>

          {bestScore > 0 && (
            <div className="mt-3 flex items-center gap-2.5 text-xs font-mono-tabular font-semibold text-[#FFC700]">
              <span>
                {t.bestScoreLabel}: {bestScore}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t.sectorsClearedLabel}: {sectorsCleared}
              </span>
            </div>
          )}

          {/* Primary Action Cluster (<= 2 Actions) */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {hasSavedRun ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={onContinueRun}
                  className="chrome-btn-strike rounded-lg px-6 py-3 text-sm font-bold tracking-wide transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.continueRun}
                </button>
                <button
                  type="button"
                  onClick={onStartNewRun}
                  className="chrome-pill rounded-lg px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.newRun}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onStartNewRun}
                className="chrome-btn-strike rounded-lg px-7 py-3 text-sm font-bold tracking-wide transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.startRun}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Flat, borderless single-line control hint in bottom safe margin */}
      <footer className="relative z-10 px-6 pb-4 md:px-12">
        <p className="text-xs font-medium tracking-wide text-slate-200/90 drop-shadow">
          {t.controlsHint}
        </p>
      </footer>
    </main>
  );
}
