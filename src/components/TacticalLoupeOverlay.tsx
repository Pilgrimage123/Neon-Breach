import {
  computeLoupeAnchorPosition,
  type CornerPipSpec,
} from '../utils/accessibilityAndScale';
import {
  KEYWORD_NESTED_TOOLTIPS,
  enforceEightWordRule,
  type CoreMechanicKeywordId,
} from '../utils/spatialMinimalistUi';

export interface LoupeInspectPayload {
  id: string;
  pip: CornerPipSpec;
  kicker: string;
  title: string;
  primaryStat: string;
  subtitle: string;
  detailLine: string;
  ruleBadge?: string;
  pointerX: number;
  pointerY: number;
  viewportW: number;
  viewportH: number;
  keywords?: CoreMechanicKeywordId[];
  lang?: 'en' | 'cs';
}

export type TacticalLoupePayload = LoupeInspectPayload;

interface TacticalLoupeOverlayProps {
  payload: LoupeInspectPayload | null;
  onDismiss?: () => void;
  viewportWidth?: number;
  viewportHeight?: number;
}

export function renderBoldMarkdownTokens(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={idx}
          className="font-black text-cyan-200 underline decoration-cyan-400/60 underline-offset-2"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function TacticalLoupeOverlay({
  payload,
  onDismiss,
  viewportWidth,
  viewportHeight,
}: TacticalLoupeOverlayProps) {
  if (!payload) return null;

  const vw = viewportWidth ?? payload.viewportW ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const vh = viewportHeight ?? payload.viewportH ?? (typeof window !== 'undefined' ? window.innerHeight : 720);
  const hasKeywords = Boolean(payload.keywords && payload.keywords.length > 0);
  const loupeWidth = Math.min(hasKeywords ? 540 : 340, Math.max(250, vw - 24));
  const loupeHeight = 148;
  const anchor = computeLoupeAnchorPosition(
    payload.pointerX,
    payload.pointerY,
    vw,
    vh,
    loupeWidth,
    loupeHeight,
  );

  const lang = payload.lang ?? 'cs';
  const streamlinedBody = enforceEightWordRule(payload.detailLine || payload.subtitle);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="tactical-loupe-overlay"
      onClick={onDismiss}
      style={{
        left: `${anchor.leftPx}px`,
        top: `${anchor.topPx}px`,
        maxWidth: `${loupeWidth}px`,
      }}
      className="pointer-events-none fixed z-50 flex flex-col sm:flex-row items-stretch gap-2 transition-transform duration-75"
    >
      {/* Main Unit / Tile Card: AAA #F4F4F6 on #181A20 Charcoal, <= 8 Words, Big Typography */}
      <div
        style={{ borderColor: payload.pip.accentHex }}
        className="aaa-charcoal-surface rounded-2xl border-2 bg-[#181A20]/98 px-4 py-3 text-[#F4F4F6] shadow-[0_14px_38px_rgba(2,6,23,0.95)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{
                borderColor: payload.pip.accentHex,
                color: payload.pip.accentHex,
              }}
              className="shrink-0 rounded-md border bg-[#0E1015] px-2 py-0.5 font-mono-tabular text-xs font-black uppercase tracking-wider"
            >
              {payload.pip.shortCode}
            </span>
            <span
              data-testid="loupe-unit-title"
              className="font-display text-[22px] sm:text-[25px] font-extrabold tracking-wide text-[#F4F4F6] truncate leading-tight"
            >
              {payload.title}
            </span>
          </div>

          {payload.primaryStat && (
            <span
              data-testid="loupe-board-number"
              className="tactical-numeral-stroke shrink-0 rounded-lg border border-white/25 bg-[#0B0D12] px-2.5 py-0.5 font-mono-tabular text-[26px] sm:text-[30px] font-black text-[#F4F4F6] leading-none"
            >
              {payload.primaryStat}
            </span>
          )}
        </div>

        {(payload.ruleBadge || payload.subtitle) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono-tabular text-xs font-bold uppercase tracking-wider text-cyan-300">
            {payload.ruleBadge && (
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-cyan-200">
                {payload.ruleBadge}
              </span>
            )}
            <span>{payload.subtitle}</span>
          </div>
        )}

        <p
          data-testid="loupe-rule-body"
          className="mt-1.5 text-[20px] sm:text-[21px] font-semibold leading-[1.3] text-[#F4F4F6] text-left max-w-[40ch]"
        >
          {renderBoldMarkdownTokens(streamlinedBody)}
        </p>
      </div>

      {/* Section 1: Nested Keyword Side-Box (Explains bold mechanics ONLY on hover/hold, never inside main description) */}
      {hasKeywords && (
        <div
          data-testid="nested-keyword-sidebox"
          className="aaa-charcoal-surface flex flex-col justify-center gap-1.5 rounded-2xl border-2 border-cyan-300/70 bg-[#181A20]/98 px-3.5 py-2.5 shadow-[0_14px_34px_rgba(2,6,23,0.95)] min-w-[200px] max-w-[240px]"
        >
          {payload.keywords!.slice(0, 2).map((kwId) => {
            const kw = KEYWORD_NESTED_TOOLTIPS[kwId];
            if (!kw) return null;
            const label = lang === 'cs' ? kw.labelCs : kw.labelEn;
            const rule = lang === 'cs' ? kw.ruleCs : kw.ruleEn;
            return (
              <div key={kwId} className="border-l-2 border-cyan-400 pl-2.5">
                <div className="flex items-center gap-1.5 font-display text-sm font-black uppercase tracking-wider text-cyan-200">
                  <span>{kw.icon}</span>
                  <span>{label}</span>
                </div>
                <div className="mt-0.5 text-[18px] font-medium leading-[1.3] text-[#F4F4F6] text-left max-w-[40ch]">
                  {enforceEightWordRule(rule)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
