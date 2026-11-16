import { useEffect, useRef, useState } from 'react';
import {
  getPreloadedPortraitFrame,
  getPreloadedTitleBg,
  loadPortraitFrame,
  loadTitleBg,
  preloadForTitleScreen,
} from '../assets/assetPreloader';
import { GAME_ASSETS } from '../assets/gameAssets';
import { HERO_SPECS } from '../engine/data';
import { DIFFICULTY_TIERS } from '../engine/difficulty';
import type { CharacterId, DifficultyTier } from '../engine/types';
import { CODEX_TRANSLATIONS } from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { AURELIA_SHEET_FRAMES } from '../utils/aureliaSpriteSheet';
import { HEROINE_COMBAT_FRAMES } from '../utils/heroineSpriteSheet';
import { ZURI_SHEET_FRAMES } from '../utils/zuriSpriteSheet';
import type { CodexTab } from './CodexModal';

interface TitleScreenProps {
  lang: Language;
  onToggleLang: () => void;
  hasSavedRun: boolean;
  bestScore: number;
  sectorsCleared: number;
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
}

function drawPortraitToCanvas(
  canvas: HTMLCanvasElement,
  frame: HTMLCanvasElement,
  rectW: number,
  rectH: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const pad = 4;
  const scale = Math.min(
    (canvas.width - pad * 2) / rectW,
    (canvas.height - pad * 2) / rectH,
  );
  const dw = rectW * scale;
  const dh = rectH * scale;
  const dx = (canvas.width - dw) * 0.5;
  const dy = canvas.height - dh - 2;
  ctx.drawImage(frame, dx, dy, dw, dh);
}

function OperativePortrait({
  characterId,
  active,
  compact = false,
}: {
  characterId: CharacterId;
  active: boolean;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState<boolean>(() => Boolean(getPreloadedPortraitFrame(characterId)));

  useEffect(() => {
    let cancelled = false;
    const rect =
      characterId === 'aurelia'
        ? AURELIA_SHEET_FRAMES[0]
        : characterId === 'zuri'
          ? ZURI_SHEET_FRAMES[8]
          : HEROINE_COMBAT_FRAMES[0];

    const cached = getPreloadedPortraitFrame(characterId);
    if (cached && canvasRef.current) {
      drawPortraitToCanvas(canvasRef.current, cached, rect.w, rect.h);
      setReady(true);
      return;
    }

    void loadPortraitFrame(characterId)
      .then((frame) => {
        if (cancelled || !canvasRef.current) return;
        drawPortraitToCanvas(canvasRef.current, frame, rect.w, rect.h);
        setReady(true);
      })
      .catch(() => {
        // Keep portrait slot clean if asset fails to load
      });

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  return (
    <canvas
      ref={canvasRef}
      width={68}
      height={84}
      className={`${compact ? 'h-[52px] w-[42px]' : 'h-[60px] w-[48px] sm:h-[64px] sm:w-[52px]'} shrink-0 rounded-lg border transition-all duration-200 ${
        !ready ? 'opacity-0' : active ? 'opacity-100' : 'opacity-80'
      } ${
        active
          ? characterId === 'aurelia'
            ? 'border-[#FFC700]/75 bg-amber-950/35'
            : characterId === 'zuri'
              ? 'border-[#10B981]/80 bg-emerald-950/35'
              : 'border-[#00F0FF]/75 bg-cyan-950/35'
          : 'border-white/15 bg-slate-950/60'
      }`}
    />
  );
}

export function TitleScreen({
  lang,
  onToggleLang,
  hasSavedRun,
  bestScore,
  sectorsCleared,
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
}: TitleScreenProps) {
  const [bgReady, setBgReady] = useState<boolean>(() => Boolean(getPreloadedTitleBg()));
  const [bgFailed, setBgFailed] = useState(false);
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

  const renderOperativeCards = (compactCards: boolean) => (
    <div
      role="radiogroup"
      aria-label={t.selectOperativeLabel}
      className={`grid gap-2 ${
        compactCards ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'
      }`}
    >
      {(['kira', 'aurelia', 'zuri'] as const).map((charId) => {
        const isSelected = selectedCharacter === charId;
        const meta = t.characters[charId];
        const spec = HERO_SPECS[charId];
        const passiveName = meta.passive.split(':')[0]?.trim() ?? meta.passive;
        const isAurelia = charId === 'aurelia';
        const isZuri = charId === 'zuri';
        return (
          <button
            key={charId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={`select-character-${charId}`}
            onClick={() => onSelectCharacter(charId)}
            className={`chrome-pill flex items-center gap-2.5 rounded-xl ${
              compactCards ? 'p-2' : 'p-2.5 sm:p-3'
            } text-left transition-all cursor-pointer ${
              isSelected
                ? isAurelia
                  ? 'border-[#FFC700] bg-amber-950/40 ring-1 ring-[#FFC700]/75'
                  : isZuri
                    ? 'border-[#10B981] bg-emerald-950/40 ring-1 ring-[#10B981]/75'
                    : 'border-[#00F0FF] bg-cyan-950/40 ring-1 ring-[#00F0FF]/75'
                : 'border-white/15 opacity-85 hover:opacity-100 hover:border-white/35'
            }`}
          >
            <OperativePortrait characterId={charId} active={isSelected} compact={compactCards} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-display text-xs sm:text-sm font-extrabold tracking-wider whitespace-nowrap shrink-0 ${
                    isAurelia
                      ? 'text-[#FFC700]'
                      : isZuri
                        ? 'text-[#34D399]'
                        : 'text-[#00F0FF]'
                  }`}
                >
                  {meta.code}
                </span>
                <span className="font-mono-tabular text-[11px] font-bold text-amber-200 whitespace-nowrap shrink-0">
                  {spec.maxHp} HP · {spec.carryCapacity}W
                </span>
              </div>
              <div className="text-[11px] sm:text-xs font-bold leading-snug text-[#F4F4F6] truncate">
                {meta.title}
              </div>
              <div
                className={`text-[10.5px] font-semibold leading-snug truncate ${
                  isAurelia
                    ? 'text-amber-300'
                    : isZuri
                      ? 'text-emerald-300'
                      : 'text-cyan-300'
                }`}
              >
                ★ {passiveName} · ⚡ {meta.overdriveName}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const activeDifficulty = DIFFICULTY_TIERS[selectedDifficultyTier] ?? DIFFICULTY_TIERS[3];

  const renderDifficultySelector = (compact: boolean) => (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/90">
          {lang === 'cs' ? 'Taktická obtížnost (1–5)' : 'Puzzle Difficulty Tier (1–5)'}
        </span>
        <span className="font-mono-tabular text-[10px] font-semibold text-cyan-200 truncate">
          {lang === 'cs' ? activeDifficulty.labelCs : activeDifficulty.labelEn}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={lang === 'cs' ? 'Obtížnost' : 'Puzzle Difficulty Tier'}
        className="grid grid-cols-5 gap-1"
      >
        {([1, 2, 3, 4, 5] as const).map((tier) => {
          const prof = DIFFICULTY_TIERS[tier];
          const active = selectedDifficultyTier === tier;
          return (
            <button
              key={`diff_tier_${tier}`}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`select-difficulty-${tier}`}
              onClick={() => onSelectDifficultyTier(tier)}
              className={`chrome-pill rounded-lg px-1.5 py-1 text-center font-mono-tabular text-[10px] font-bold transition-all cursor-pointer ${
                active
                  ? tier === 5
                    ? 'border-[#FF2E7E] bg-rose-950/60 text-white ring-1 ring-[#FF2E7E]'
                    : tier >= 4
                      ? 'border-[#FFC700] bg-amber-950/50 text-white ring-1 ring-[#FFC700]'
                      : 'border-[#00F0FF] bg-cyan-950/50 text-white ring-1 ring-[#00F0FF]'
                  : 'border-white/15 text-slate-300 opacity-80 hover:opacity-100'
              }`}
            >
              {lang === 'cs' ? prof.labelCs : prof.labelEn}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-200/90">
        {lang === 'cs' ? activeDifficulty.summaryCs : activeDifficulty.summaryEn}
      </p>
    </div>
  );

  const renderPrimaryActions = (compactBtn: boolean) => (
    <div className={`${compactBtn ? 'mt-2.5' : 'mt-3 sm:mt-4'} flex flex-wrap items-center gap-2.5`}>
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
    </div>
  );

  return (
    <main className="cyber-vista-bg relative flex h-full w-full flex-col justify-between overflow-hidden text-slate-100">
      {/* Illustrated Key-Art Backdrop (decoded before reveal to prevent scanline pop-in) */}
      {!bgFailed && (
        <img
          src={GAME_ASSETS.titleBg}
          alt="Neo-Prague twilight sky-plaza"
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setBgReady(true)}
          onError={() => setBgFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover object-right brightness-105 saturate-115 transition-opacity duration-200 ${
            bgReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Measured left-weighted twilight-chrome scrim for crisp WCAG AA contrast while keeping right vista radiant */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,15,36,0.88) 0%, rgba(11,22,50,0.68) 48%, rgba(14,165,233,0.12) 100%)',
        }}
      />

      {/* Top Corner Utility Bar (Landscape Toggle on Mobile Portrait + Language Switch) */}
      <div
        className={`relative z-10 flex items-center justify-end gap-2 ${
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
        <button
          type="button"
          onClick={onToggleLang}
          aria-label="Toggle language"
          className="chrome-pill rounded-full px-3.5 py-1 text-xs font-bold tracking-wide text-cyan-100 transition-all hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {lang === 'en' ? 'EN · CS' : 'CS · EN'}
        </button>
      </div>

      {/* Main Title Card */}
      <section
        className={`relative z-10 my-auto flex w-full flex-col ${
          isCompactLandscape
            ? 'items-center px-3'
            : 'max-w-6xl items-start px-3.5 sm:px-6 md:px-10'
        }`}
      >
        {isCompactLandscape ? (
          <div className="chrome-glass grid w-full max-w-[1040px] max-h-[calc(100%-8px)] grid-cols-[minmax(0,0.68fr)_minmax(0,1.7fr)] items-center gap-3 overflow-y-auto rounded-2xl p-3">
            {/* Left Column: Wordmark, Subtitle, Score, CTA */}
            <div className="flex flex-col items-start min-w-0">
              <svg
                viewBox="0 0 560 132"
                className="w-full max-w-[270px] select-none"
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
                <path
                  d="M8 22L28 12L44 36L24 58L8 22Z"
                  fill="#0B1636"
                  stroke="#00F0FF"
                  strokeWidth="2.5"
                />
                <path d="M16 42L46 14" stroke="#FF2E7E" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M8 104H468L492 92" stroke="url(#nbBladeGrad)" strokeWidth="2.5" fill="none" />
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

              <p className="mt-1 text-[11px] leading-snug text-slate-100/95">
                {t.gameSubtitle}
              </p>

              {bestScore > 0 && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono-tabular font-semibold text-[#FFC700]">
                  <span>
                    {t.bestScoreLabel}: {bestScore}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.sectorsClearedLabel}: {sectorsCleared}
                  </span>
                </div>
              )}

              {renderPrimaryActions(true)}
            </div>

            {/* Right Column: Horizontal 3-Operative Roster */}
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/90">
                  {t.selectOperativeLabel}
                </span>
                {onOpenCodex && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="title-open-hero-dossier"
                      onClick={() => onOpenCodex('heroes', selectedCharacter)}
                      className="chrome-pill rounded-md px-2 py-0.5 text-[10px] font-bold text-[#00F0FF] transition-colors hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.inspectHeroDossierBtn}
                    </button>
                    <button
                      type="button"
                      data-testid="title-open-glossary"
                      onClick={() => onOpenCodex('glossary', selectedCharacter)}
                      className="chrome-pill rounded-md px-2 py-0.5 text-[10px] font-bold text-[#FFC700] transition-colors hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.viewGlossaryBtn}
                    </button>
                  </div>
                )}
              </div>
              {renderOperativeCards(true)}
              {renderDifficultySelector(true)}
            </div>
          </div>
        ) : (
          <div
            className={`chrome-glass w-full max-w-[1060px] rounded-2xl ${
              isNarrowPortrait ? 'max-h-[calc(100dvh-92px)] overflow-y-auto p-3.5' : 'p-5 sm:p-6'
            }`}
          >
            {/* Custom Inline SVG NEON BREACH Liquid-Chrome Title Lockup */}
            <svg
              viewBox="0 0 560 132"
              className={`w-full select-none ${isNarrowPortrait ? 'max-w-[290px]' : 'max-w-[430px]'}`}
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
              <path
                d="M8 22L28 12L44 36L24 58L8 22Z"
                fill="#0B1636"
                stroke="#00F0FF"
                strokeWidth="2.5"
              />
              <path d="M16 42L46 14" stroke="#FF2E7E" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M8 104H468L492 92" stroke="url(#nbBladeGrad)" strokeWidth="2.5" fill="none" />
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

            <p className="mt-1 max-w-md text-xs sm:text-sm leading-relaxed text-slate-100/95">
              {t.gameSubtitle}
            </p>

            {/* Playable Operative Selector (KIRA-09 vs AURELIA-07 vs ZURI-03) */}
            <div className={isNarrowPortrait ? 'mt-2.5' : 'mt-3.5'}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/90">
                  {t.selectOperativeLabel}
                </span>
                {onOpenCodex && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="title-open-hero-dossier"
                      onClick={() => onOpenCodex('heroes', selectedCharacter)}
                      className="chrome-pill rounded-md px-2.5 py-1 text-[11px] font-bold text-[#00F0FF] transition-colors hover:border-cyan-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.inspectHeroDossierBtn}
                    </button>
                    <button
                      type="button"
                      data-testid="title-open-glossary"
                      onClick={() => onOpenCodex('glossary', selectedCharacter)}
                      className="chrome-pill rounded-md px-2.5 py-1 text-[11px] font-bold text-[#FFC700] transition-colors hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {codexT.viewGlossaryBtn}
                    </button>
                  </div>
                )}
              </div>
              {renderOperativeCards(false)}
            </div>

            {renderDifficultySelector(false)}

            {bestScore > 0 && (
              <div className="mt-2.5 flex items-center gap-2.5 text-xs font-mono-tabular font-semibold text-[#FFC700]">
                <span>
                  {t.bestScoreLabel}: {bestScore}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.sectorsClearedLabel}: {sectorsCleared}
                </span>
              </div>
            )}

            {renderPrimaryActions(false)}
          </div>
        )}
      </section>

      {/* Flat, borderless single-line control hint in bottom safe margin */}
      <footer
        className={`relative z-10 ${
          isCompactLandscape ? 'px-4 pb-2' : 'px-4 pb-3 sm:px-6 sm:pb-4 md:px-12'
        }`}
      >
        <p className={`${isCompactLandscape ? 'text-[10px]' : 'text-[11px] sm:text-xs'} font-medium tracking-wide text-slate-200/90 drop-shadow`}>
          {t.controlsHint}
        </p>
      </footer>
    </main>
  );
}
