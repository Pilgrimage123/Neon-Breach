import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DIFFICULTY_TIERS } from '../../engine/difficulty';
import type { DifficultyTier } from '../../engine/types';
import type { Language } from '../../i18n/translations';

export function getTierAccent(tier: DifficultyTier) {
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
}

export interface TitleDifficultySelectorProps {
  lang: Language;
  selectedDifficultyTier: DifficultyTier;
  compact: boolean;
  onSelectDifficultyTier: (tier: DifficultyTier) => void;
}

export function TitleDifficultySelector({
  lang,
  selectedDifficultyTier,
  compact,
  onSelectDifficultyTier,
}: TitleDifficultySelectorProps) {
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);
  const difficultyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const difficultyMenuRef = useRef<HTMLDivElement | null>(null);

  const activeDifficulty = DIFFICULTY_TIERS[selectedDifficultyTier] ?? DIFFICULTY_TIERS[3];
  const activeAccent = getTierAccent(selectedDifficultyTier);

  useEffect(() => {
    if (!difficultyOpen) return;

    const updatePosition = () => {
      const trigger = difficultyTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(
        160,
        Math.min(350, openUpward ? spaceAbove - 6 : spaceBelow - 6),
      );
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

  const menuPortal =
    difficultyOpen && dropdownRect && typeof document !== 'undefined'
      ? createPortal(
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
            className="z-50 overflow-y-auto rounded-xl border border-cyan-300/55 bg-[#071028]/97 p-1.5 shadow-[0_20px_54px_rgba(2,6,23,0.92),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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

      {menuPortal}
    </>
  );
}
