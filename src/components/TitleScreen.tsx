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
import { TitleEmblemStage } from './TitleEmblemStage';

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
      className={`${compact ? 'h-[48px] w-[38px]' : 'h-[60px] w-[48px] sm:h-[64px] sm:w-[52px]'} shrink-0 rounded-lg border transition-all duration-200 ${
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
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);
  const difficultyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const difficultyMenuRef = useRef<HTMLDivElement | null>(null);
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
    if (!difficultyOpen) return;

    const updatePosition = () => {
      const trigger = difficultyTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom - 44;
      const spaceAbove = rect.top - 44;
      const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(150, Math.min(310, openUpward ? spaceAbove : spaceBelow));
      const desiredWidth = Math.min(vw - 24, Math.max(rect.width, 320));
      const clampedLeft = Math.max(12, Math.min(rect.left, vw - desiredWidth - 12));
      setDropdownRect({
        left: clampedLeft,
        width: desiredWidth,
        top: openUpward ? rect.top - 6 : rect.bottom + 6,
        maxHeight: availableHeight,
        openUpward,
      });
    };

    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !difficultyTriggerRef.current?.contains(target) &&
        !difficultyMenuRef.current?.contains(target)
      ) {
        setDifficultyOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDifficultyOpen(false);
        difficultyTriggerRef.current?.focus();
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [difficultyOpen]);

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
            className={`chrome-pill flex items-center overflow-hidden rounded-xl ${
              compactCards ? 'gap-1.5 p-1.5' : 'gap-2.5 p-2.5 sm:p-3'
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
              <div className="flex flex-wrap items-baseline justify-between gap-x-1.5 gap-y-0.5">
                <span
                  className={`font-display font-extrabold whitespace-nowrap shrink-0 ${
                    compactCards ? 'text-[11.5px] tracking-normal' : 'text-[13px] sm:text-sm tracking-wider'
                  } ${
                    isAurelia
                      ? 'text-[#FFC700]'
                      : isZuri
                        ? 'text-[#34D399]'
                        : 'text-[#00F0FF]'
                  }`}
                >
                  {meta.code}
                </span>
                <span
                  className={`font-mono-tabular font-bold text-amber-200 whitespace-nowrap shrink-0 ${
                    compactCards ? 'text-[10.5px]' : 'text-[12px] sm:text-[12.5px]'
                  }`}
                >
                  {spec.maxHp} HP · {spec.carryCapacity} {lang === 'cs' ? 'RAM' : 'MEM'}
                </span>
              </div>
              <div
                className={`${
                  compactCards ? 'text-[11.5px]' : 'text-[12.5px] sm:text-[13px]'
                } font-bold leading-snug text-[#F4F4F6] truncate`}
              >
                {meta.title}
              </div>
              <div
                className={`${
                  compactCards ? 'text-[11px]' : 'text-[12px] sm:text-[12.5px]'
                } font-semibold leading-snug truncate ${
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

  const getTierAccent = (tier: DifficultyTier) => {
    if (tier === 5) {
      return {
        dot: 'bg-[#FF2E7E] shadow-[0_0_8px_rgba(255,46,126,0.85)]',
        border: 'border-[#FF2E7E]/70 ring-1 ring-[#FF2E7E]/65 bg-rose-950/55',
        badge: 'text-[#FF7EB3]',
      };
    }
    if (tier === 4) {
      return {
        dot: 'bg-[#FFC700] shadow-[0_0_8px_rgba(255,199,0,0.8)]',
        border: 'border-[#FFC700]/70 ring-1 ring-[#FFC700]/65 bg-amber-950/50',
        badge: 'text-[#FFE066]',
      };
    }
    if (tier === 3) {
      return {
        dot: 'bg-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,0.8)]',
        border: 'border-[#00F0FF]/70 ring-1 ring-[#00F0FF]/65 bg-cyan-950/50',
        badge: 'text-[#67E8F9]',
      };
    }
    return {
      dot: 'bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.7)]',
      border: 'border-[#38BDF8]/65 ring-1 ring-[#38BDF8]/55 bg-sky-950/45',
      badge: 'text-sky-300',
    };
  };

  const activeAccent = getTierAccent(selectedDifficultyTier);

  const renderDifficultyDropdown = (compact: boolean) => (
    <div className={compact ? 'mt-2' : 'mt-3.5'}>
      <button
        ref={difficultyTriggerRef}
        type="button"
        data-testid="difficulty-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={difficultyOpen}
        aria-controls="difficulty-dropdown-menu"
        aria-label={`${lang === 'cs' ? 'Obtížnost' : 'Difficulty'}: ${
          lang === 'cs' ? activeDifficulty.labelCs : activeDifficulty.labelEn
        }`}
        onClick={() => setDifficultyOpen((prev) => !prev)}
        className={`chrome-pill group flex w-full items-center justify-between gap-3 rounded-xl ${
          compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5'
        } text-left transition-all duration-150 cursor-pointer ${
          difficultyOpen
            ? activeAccent.border
            : 'border-white/20 hover:border-cyan-300/60 hover:bg-slate-900/75'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] ${activeAccent.dot}`}
          />
          <span className="text-[11.5px] sm:text-[12px] font-bold uppercase tracking-widest text-amber-200/90 whitespace-nowrap shrink-0">
            {lang === 'cs' ? 'Obtížnost' : 'Difficulty'}
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span
            className={`font-mono-tabular text-[12.5px] sm:text-[13px] font-extrabold whitespace-nowrap shrink-0 ${activeAccent.badge}`}
          >
            {lang === 'cs' ? activeDifficulty.labelCs : activeDifficulty.labelEn}
          </span>
          {!compact && (
            <span className="hidden sm:inline truncate text-[12px] text-slate-300/90">
              — {lang === 'cs' ? activeDifficulty.summaryCs : activeDifficulty.summaryEn}
            </span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-cyan-200 transition-transform duration-200 ${
            difficultyOpen ? 'rotate-180 text-white' : 'group-hover:text-white'
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );

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

      {/* Balanced atmospheric vignette scrim that frames the radiant key-art while keeping the logo & dock high-contrast */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, rgba(8,15,36,0.44) 0%, rgba(9,18,44,0.72) 68%, rgba(6,11,28,0.88) 100%)',
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

      {/* Main Title Stage */}
      <section
        className={`relative z-10 my-auto flex w-full flex-col ${
          isCompactLandscape
            ? 'items-center px-3'
            : 'mx-auto max-w-[1040px] items-center px-3 sm:px-6 md:px-10'
        }`}
      >
        {isCompactLandscape ? (
          <div className="chrome-glass grid w-full max-w-[1040px] max-h-[calc(100%-8px)] grid-cols-[minmax(0,0.84fr)_minmax(0,1.56fr)] items-center gap-3 overflow-y-auto rounded-2xl p-3">
            {/* Left Column: Animated Cutout Emblem, Score, CTA + How to Play */}
            <div className="flex flex-col items-center min-w-0">
              <TitleEmblemStage compact className="w-full max-w-[325px] max-h-[205px]" />

              {bestScore > 0 && (
                <div className="mt-1 flex items-center gap-2 text-[12px] font-mono-tabular font-semibold text-[#FFC700]">
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

            {/* Right Column: Horizontal 3-Operative Roster + Difficulty Dropdown */}
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold uppercase tracking-widest text-cyan-200/90">
                  {t.selectOperativeLabel}
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
              {renderOperativeCards(true)}
              {renderDifficultyDropdown(true)}
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-[1060px] flex-col items-center">
            {/* Oversized Animated Floating Key-Art Emblem (Click-Triggered 5-Pose Sequence) */}
            <div className="relative z-20 flex w-full justify-center pointer-events-none">
              <TitleEmblemStage
                className={
                  isNarrowPortrait
                    ? 'w-[104%] max-w-[392px] max-h-[32dvh]'
                    : 'h-[clamp(250px,47dvh,455px)] w-auto max-w-[92vw]'
                }
              />
            </div>

            {/* Grounded Command Console with 2x Deeper Split-Header Cradle */}
            <div
              className={`chrome-glass relative z-10 w-full rounded-2xl ${
                isNarrowPortrait
                  ? '-mt-7 max-h-[calc(100dvh-230px)] overflow-y-auto px-3 pb-3 pt-8'
                  : '-mt-11 sm:-mt-13 md:-mt-14 max-h-[calc(100dvh-310px)] overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5'
              }`}
            >
              {/* Sculpted Center Cradle Glow Highlight Beneath Plunging Emblem Crest */}
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
                {/* Split Header Flanking the Plunging Badge Base */}
                <div>
                  <div
                    className={`relative z-30 flex justify-between gap-2 ${
                      isNarrowPortrait
                        ? 'mb-2 flex-wrap items-center'
                        : 'mb-3 sm:mb-3.5 min-h-[42px] sm:min-h-[48px] items-end'
                    }`}
                  >
                    <span className="pb-0.5 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-widest text-cyan-200/95 whitespace-nowrap">
                      {t.selectOperativeLabel}
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
                  <div className="relative z-20">{renderOperativeCards(false)}</div>
                </div>

                {renderDifficultyDropdown(false)}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {renderPrimaryActions(false)}

                  {bestScore > 0 && (
                    <div className="mt-3.5 sm:mt-4 flex items-center gap-2.5 text-[13px] font-mono-tabular font-semibold text-[#FFC700]">
                      <span>
                        {t.bestScoreLabel}: {bestScore}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.sectorsClearedLabel}: {sectorsCleared}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Stylish Roll-Down Difficulty Menu */}
      {difficultyOpen && dropdownRect && (
        <div
          ref={difficultyMenuRef}
          id="difficulty-dropdown-menu"
          role="listbox"
          aria-label={lang === 'cs' ? 'Obtížnost' : 'Difficulty'}
          data-testid="difficulty-dropdown-menu"
          data-title-overlay-open="true"
          style={{
            position: 'fixed',
            left: `${dropdownRect.left}px`,
            width: `${dropdownRect.width}px`,
            maxHeight: `${dropdownRect.maxHeight}px`,
            ...(dropdownRect.openUpward
              ? { bottom: `${window.innerHeight - dropdownRect.top}px` }
              : { top: `${dropdownRect.top}px` }),
          }}
          className="z-40 overflow-y-auto rounded-xl border border-cyan-300/45 bg-[#09132c]/96 p-1.5 shadow-[0_18px_48px_rgba(2,6,23,0.88),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
        >
          <div className="space-y-1">
            {([1, 2, 3, 4, 5] as const).map((tier) => {
              const prof = DIFFICULTY_TIERS[tier];
              const active = selectedDifficultyTier === tier;
              const accent = getTierAccent(tier);
              return (
                <button
                  key={`diff_tier_${tier}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-testid={`select-difficulty-${tier}`}
                  onClick={() => {
                    onSelectDifficultyTier(tier);
                    setDifficultyOpen(false);
                    difficultyTriggerRef.current?.focus();
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-all cursor-pointer ${
                    active
                      ? accent.border
                      : 'border-transparent hover:border-white/20 hover:bg-slate-900/80'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rotate-45 rounded-[2px] ${accent.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-tabular text-[12.5px] sm:text-[13px] font-extrabold ${
                          active ? accent.badge : 'text-slate-100'
                        }`}
                      >
                        {lang === 'cs' ? prof.labelCs : prof.labelEn}
                      </span>
                      {active && (
                        <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-cyan-200">
                          {lang === 'cs' ? 'Vybráno' : 'Active'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] sm:text-[12px] leading-snug text-slate-300/95">
                      {lang === 'cs' ? prof.summaryCs : prof.summaryEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* How to Play Modal Dialog */}
      {renderHowToPlayModal()}

      {/* Flat, borderless single-line control hint in bottom safe margin */}
      <footer
        className={`relative z-10 ${
          isCompactLandscape ? 'px-4 pb-2' : 'px-4 pb-3 sm:px-6 sm:pb-4 md:px-12'
        }`}
      >
        <p className={`${isCompactLandscape ? 'text-[12px]' : 'text-[12.5px] sm:text-[13px]'} font-medium tracking-wide text-slate-200/90 drop-shadow`}>
          {t.controlsHint}
        </p>
      </footer>
    </main>
  );
}
