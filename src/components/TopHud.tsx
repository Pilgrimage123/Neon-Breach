import { useState } from 'react';
import { MAX_IMPLANTS, getEquippedEquipmentWeight } from '../engine/data';
import { previewHeroineThreat } from '../engine/gameEngine';
import type { CyberImplantId, RunState, TurnPreview } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { ImplantIcon } from './ImplantIcon';

interface TopHudProps {
  run: RunState;
  lang: Language;
  muted: boolean;
  hudMinimized?: boolean;
  activePreview?: TurnPreview | null;
  onToggleHudMinimized?: () => void;
  onToggleLang: () => void;
  onToggleMute: () => void;
  onOpenPool: () => void;
  onOpenPause: () => void;
}

export function TopHud({
  run,
  lang,
  muted,
  hudMinimized = false,
  activePreview = null,
  onToggleHudMinimized,
  onToggleLang,
  onToggleMute,
  onOpenPool,
  onOpenPause,
}: TopHudProps) {
  const t = TRANSLATIONS[lang];
  const [hoveredImplant, setHoveredImplant] = useState<CyberImplantId | null>(null);
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const hpPct = Math.max(0, Math.min(100, Math.round((run.heroine.hp / run.heroine.maxHp) * 100)));
  const equippedWeight = getEquippedEquipmentWeight(run.heroine);

  const kiraThreat = previewHeroineThreat(
    run.screen === 'combat' ? run.combat : null,
    run.heroine,
    activePreview,
  );
  const projHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.projectedHp / run.heroine.maxHp) * 100)),
  );
  const preEnemyHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.hpBeforeEnemies / run.heroine.maxHp) * 100)),
  );
  const dmgBarPct = Math.max(0, preEnemyHpPct - projHpPct);
  const healBarPct = Math.max(0, projHpPct - hpPct);
  const hasHpPreview =
    kiraThreat.hpDamageTaken > 0 || kiraThreat.projectedHp !== run.heroine.hp;

  return (
    <header className="chrome-glass relative z-30 flex h-10 shrink-0 items-center justify-between gap-2 border-t-0 border-x-0 border-b border-cyan-300/35 px-3 sm:px-4">
      {/* Left: Chrome Wordmark + Unboxed Sector/Turn Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="chrome-text-shimmer font-display text-sm font-bold tracking-wider whitespace-nowrap shrink-0">
          {t.gameTitle}
        </span>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-200/90 truncate">
          <span className="font-mono-tabular font-semibold text-cyan-200">
            {t.layerLabel} {currentNode ? currentNode.layer + 1 : 1}/5
          </span>
          {currentNode && (
            <>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-medium text-white">{t.nodes[currentNode.type]}</span>
            </>
          )}
          {run.screen === 'combat' && run.combat && (
            <>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-mono-tabular text-amber-200">
                {t.turnLabel} {run.combat.turn}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Compact Chrome Vitality Strip */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* HP Inline Gauge with Enemy Damage & Death Preview */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-200">
            {t.hpLabel}
          </span>
          <div
            data-testid="tophud-kira-lifebar"
            data-preview-incoming-dmg={kiraThreat.hpDamageTaken}
            data-preview-lethal={kiraThreat.willDie ? 'true' : 'false'}
            className={`relative h-2 w-16 sm:w-24 overflow-hidden rounded-full bg-slate-950/85 p-[1px] ${
              kiraThreat.willDie
                ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.75)]'
                : kiraThreat.hpDamageTaken > 0
                  ? 'ring-1 ring-[#FFC700]/75'
                  : 'ring-1 ring-white/25'
            }`}
          >
            {/* Remaining HP after enemy attacks */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-[#FF2E7E] via-[#FF5C9E] to-[#FFB3D1] transition-all duration-150"
              style={{ width: `${Math.min(hpPct, projHpPct)}%` }}
            />
            {/* Net heal segment if projectedHp > current hp */}
            {healBarPct > 0 && (
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-[#10B981] to-[#6EE7B7] animate-pulse transition-all duration-150"
                style={{ left: `${hpPct}%`, width: `${healBarPct}%` }}
              />
            )}
            {/* Enemy-inflicted damage chunk on Kira's lifebar */}
            {dmgBarPct > 0 && (
              <div
                data-testid="tophud-kira-lifebar-preview"
                className={`absolute inset-y-0 transition-all duration-150 ${
                  kiraThreat.willDie
                    ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                    : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
                }`}
                style={{ left: `${projHpPct}%`, width: `${dmgBarPct}%` }}
              />
            )}
          </div>
          <span className="flex items-center gap-0.5 font-mono-tabular text-xs font-bold text-white whitespace-nowrap">
            {hasHpPreview ? (
              <>
                <span className="text-rose-200/85">{run.heroine.hp}</span>
                <span className="text-amber-300">→</span>
                <span
                  className={
                    kiraThreat.willDie
                      ? 'text-[#FF2E7E] font-extrabold animate-pulse'
                      : kiraThreat.projectedHp < run.heroine.hp
                        ? 'text-[#FFC700]'
                        : 'text-emerald-300'
                  }
                >
                  {kiraThreat.projectedHp}
                </span>
                <span className="text-slate-400">/{run.heroine.maxHp}</span>
                {kiraThreat.willDie && (
                  <span
                    title={t.lethalLabel}
                    className="ml-0.5 rounded bg-[#FF2E7E] px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-white animate-pulse"
                  >
                    ☠ {t.lethalLabel}
                  </span>
                )}
              </>
            ) : (
              <>
                {run.heroine.hp}/{run.heroine.maxHp}
              </>
            )}
          </span>
        </div>

        {/* Shield Readout */}
        <div className="flex items-baseline gap-1 border-l border-white/15 pl-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">
            {t.shieldLabel}
          </span>
          <span className="font-mono-tabular text-xs font-bold text-[#00F0FF] whitespace-nowrap">
            {kiraThreat.shieldAfterPlayer !== run.heroine.shield
              ? `${run.heroine.shield}→${kiraThreat.shieldAfterPlayer}`
              : run.heroine.shield}
          </span>
        </div>

        {/* Overdrive Inline Gauge */}
        <div className="hidden sm:flex items-center gap-1.5 border-l border-white/15 pl-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
            {t.overdriveLabel}
          </span>
          <div className="h-2 w-14 overflow-hidden rounded-full bg-slate-950/80 p-[1px] ring-1 ring-white/25">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] transition-all duration-200"
              style={{ width: `${Math.min(100, run.heroine.overdrive)}%` }}
            />
          </div>
          <span className="font-mono-tabular text-xs font-bold text-[#FFC700]">
            {run.heroine.overdrive}%
          </span>
        </div>

        {/* Credits Readout */}
        <div className="hidden lg:flex items-baseline gap-1 border-l border-white/15 pl-2.5">
          <span className="font-mono-tabular text-xs font-bold text-[#FFC700]">
            {run.heroine.credits}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-100/80">
            {t.creditsLabel}
          </span>
        </div>

        {/* Cybernetic Implants 4-Socket Micro Strip */}
        <div
          className="relative hidden md:flex items-center gap-1 border-l border-white/15 pl-2.5"
          aria-label={t.implantsTitle}
        >
          {Array.from({ length: MAX_IMPLANTS }).map((_, idx) => {
            const implantId = run.heroine.implants[idx];
            if (!implantId) {
              return (
                <div
                  key={`slot_empty_${idx}`}
                  title={t.noImplants}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/15 bg-slate-950/50 text-[10px] text-slate-400"
                >
                  ·
                </div>
              );
            }
            const meta = t.implants[implantId];
            return (
              <button
                key={implantId}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setHoveredImplant(implantId)}
                onMouseLeave={() => setHoveredImplant(null)}
                onFocus={() => setHoveredImplant(implantId)}
                onBlur={() => setHoveredImplant(null)}
                aria-label={`${meta.name}: ${meta.desc}`}
                className="chrome-pill flex h-6 w-6 items-center justify-center rounded transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <ImplantIcon id={implantId} size={16} />
              </button>
            );
          })}

          {hoveredImplant && (
            <div className="chrome-panel-bright pointer-events-none absolute left-2 top-8 z-50 w-60 rounded-lg p-2.5">
              <div className="text-xs font-bold text-cyan-200">
                {t.implants[hoveredImplant].name}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-slate-100">
                {t.implants[hoveredImplant].desc}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Sleek Chrome Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {run.screen === 'combat' && onToggleHudMinimized && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleHudMinimized();
            }}
            aria-label={hudMinimized ? 'Expand tactical HUD' : 'Minimize tactical HUD'}
            title={hudMinimized ? 'Expand HUD [H]' : 'Compact Vista Mode [H]'}
            className={`chrome-pill flex h-7 items-center gap-1 rounded px-2 text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
              hudMinimized
                ? 'border-cyan-300 text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.35)]'
                : 'text-slate-100 hover:border-cyan-300 hover:text-white'
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
              {hudMinimized ? (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              ) : (
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
              )}
            </svg>
            <span className="hidden xl:inline">{hudMinimized ? 'HUD +' : 'VISTA'}</span>
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenPool();
          }}
          aria-label={`${t.inspectPool} (${equippedWeight}/${run.heroine.carryCapacity}, ${run.masterPool.length})`}
          className="chrome-pill flex h-7 items-center gap-1 rounded px-2 text-[11px] font-semibold text-white transition-all hover:border-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0"
        >
          <span className="hidden sm:inline">{t.inspectPool}</span>
          <span className="sm:hidden">{t.loadoutButton}</span>
          <span className="font-mono-tabular font-bold text-[#00F0FF]">
            {equippedWeight}/{run.heroine.carryCapacity}
          </span>
          <span className="hidden lg:inline font-mono-tabular text-slate-300">
            · {run.masterPool.length}
          </span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? t.unmute : t.mute}
          title={`${muted ? t.unmute : t.mute} [M]`}
          className="chrome-pill flex h-7 w-7 items-center justify-center rounded text-slate-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 shrink-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            {muted ? (
              <path d="M22 9l-6 6M16 9l6 6" stroke="#FF2E7E" />
            ) : (
              <path
                d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                stroke="#00F0FF"
              />
            )}
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleLang();
          }}
          aria-label="Toggle language"
          title="Language [L]"
          className="chrome-pill flex h-7 items-center justify-center rounded px-2 text-[11px] font-bold text-slate-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0"
        >
          {t.languageName}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenPause();
          }}
          aria-label={t.pause}
          title={`${t.pause} [P]`}
          className="chrome-pill flex h-7 w-7 items-center justify-center rounded text-slate-100 transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
