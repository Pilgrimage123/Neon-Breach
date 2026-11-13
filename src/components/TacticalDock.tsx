import { useMemo, useRef } from 'react';
import { getSurgeThreshold, sortTilesByGroup } from '../engine/gameEngine';
import type { RunState, TileType, TurnPreview } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import { TileGlyph } from './TileGlyph';

const TILE_THEME: Record<
  TileType,
  {
    border: string;
    bg: string;
    activeRing: string;
    text: string;
    accentHex: string;
    shortcut: string;
  }
> = {
  attack: {
    border: 'border-[#FF2E7E]/55',
    bg: 'bg-gradient-to-b from-[#3D1231]/85 to-[#1F0A1D]/90 hover:from-[#521641]/90 hover:to-[#2B0D27]/95',
    activeRing:
      'ring-2 ring-[#FF2E7E] border-white/80 bg-gradient-to-b from-[#691852] to-[#330C2B] shadow-[0_0_22px_rgba(255,46,126,0.45),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-rose-100',
    accentHex: '#FF2E7E',
    shortcut: '1',
  },
  defense: {
    border: 'border-[#00F0FF]/55',
    bg: 'bg-gradient-to-b from-[#0E2E4A]/85 to-[#081A2E]/90 hover:from-[#133E63]/90 hover:to-[#0B233D]/95',
    activeRing:
      'ring-2 ring-[#00F0FF] border-white/80 bg-gradient-to-b from-[#144E7A] to-[#0A2947] shadow-[0_0_22px_rgba(0,240,255,0.42),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-cyan-100',
    accentHex: '#00F0FF',
    shortcut: '2',
  },
  tech: {
    border: 'border-[#FFC700]/55',
    bg: 'bg-gradient-to-b from-[#3B2B0C]/85 to-[#211706]/90 hover:from-[#4F3910]/90 hover:to-[#2E2008]/95',
    activeRing:
      'ring-2 ring-[#FFC700] border-white/80 bg-gradient-to-b from-[#634812] to-[#362608] shadow-[0_0_22px_rgba(255,199,0,0.42),inset_0_1px_0_rgba(255,255,255,0.65)] -translate-y-0.5',
    text: 'text-amber-100',
    accentHex: '#FFC700',
    shortcut: '3',
  },
};

interface TacticalDockProps {
  run: RunState;
  lang: Language;
  canPlay: boolean;
  hudMinimized?: boolean;
  activeColor: TileType | null;
  selectedColor: TileType | null;
  activePreview: TurnPreview | null;
  countByColor: Record<TileType, number>;
  onHoverColor: (color: TileType | null) => void;
  onSelectColor: (color: TileType | null) => void;
  onCommitColor: (color: TileType) => void;
  onOverdrive: () => void;
}

export function TacticalDock({
  run,
  lang,
  canPlay,
  hudMinimized = false,
  activeColor,
  selectedColor,
  activePreview,
  countByColor,
  onHoverColor,
  onSelectColor,
  onCommitColor,
  onOverdrive,
}: TacticalDockProps) {
  const t = TRANSLATIONS[lang];
  const combat = run.combat;
  const surgeThreshold = getSurgeThreshold(run.heroine.implants);
  const board = combat?.board;
  const drawPile = combat?.drawPile;

  const upcomingDraws = useMemo(() => (drawPile ? drawPile.slice(0, 6) : []), [drawPile]);
  const groupedBoard = useMemo(() => (board ? sortTilesByGroup(board) : []), [board]);

  const lastPointerTypeRef = useRef<string>('mouse');

  const handleGroupActivate = (color: TileType) => {
    if (!canPlay || countByColor[color] === 0) return;
    const isTouch = lastPointerTypeRef.current === 'touch';
    lastPointerTypeRef.current = 'mouse';
    if (isTouch && selectedColor !== color) {
      onSelectColor(color);
      return;
    }
    onCommitColor(color);
  };

  const overdriveReady = run.heroine.overdrive >= 100;

  return (
    <section
      aria-label="Tactical Command Dock"
      className="chrome-glass relative z-20 shrink-0 border-x-0 border-b-0 border-t border-cyan-300/40 px-2.5 py-2 sm:px-4 sm:py-2.5"
    >
      {/* Floating Holographic Turn Preview Strip (Zero permanent vertical bloat) */}
      {activePreview && (
        <div className="pointer-events-none absolute inset-x-0 -top-10 z-30 flex justify-center px-3">
          <div className="chrome-panel-bright pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-full px-4 py-1 text-xs shadow-2xl">
            <span className={`font-display font-bold ${TILE_THEME[activePreview.color].text}`}>
              {activePreview.color === 'attack'
                ? t.attackName
                : activePreview.color === 'defense'
                  ? t.defenseName
                  : t.techName}{' '}
              ×{activePreview.tileCount}
            </span>

            {activePreview.tileCount === 0 ? (
              <span className="text-slate-300">{t.previewNoTiles}</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-[11px]">
                {activePreview.totalDamage > 0 && (
                  <span className="font-bold text-rose-200">
                    +{activePreview.totalDamage} {t.previewDamage}
                    {activePreview.damageBoostPct > 0 && (
                      <span className="ml-1 text-amber-200">
                        ({activePreview.baseDamage} +{activePreview.damageBoostPct}%)
                      </span>
                    )}
                  </span>
                )}
                {activePreview.cleaveDamage > 0 && (
                  <span className="font-semibold text-rose-300">
                    +{activePreview.cleaveDamage} {t.previewCleave}
                  </span>
                )}
                {activePreview.color === 'attack' && activePreview.armorPiercing && (
                  <span className="font-semibold text-rose-200">{t.previewPierce}</span>
                )}
                {activePreview.shieldGained > 0 && (
                  <span className="font-bold text-cyan-200">
                    +{activePreview.shieldGained} {t.previewShield}
                  </span>
                )}
                {activePreview.reflectOnBlock > 0 && (
                  <span className="font-semibold text-cyan-100">
                    +{activePreview.reflectOnBlock} DMG ({t.surgeDefenseEffect})
                  </span>
                )}
                {activePreview.damageBoostAddedPct > 0 && (
                  <span className="font-bold text-amber-200">
                    +{activePreview.damageBoostAddedPct}% {t.previewDamageBoostAdded}
                  </span>
                )}
                {activePreview.healAmount > 0 && (
                  <span className="font-bold text-emerald-300">
                    +{activePreview.healAmount} {t.previewHeal}
                  </span>
                )}
                {activePreview.overdriveGained > 0 && (
                  <span className="text-amber-200/90">
                    +{activePreview.overdriveGained}% {t.previewOverdrive}
                  </span>
                )}
                <span className="text-slate-300">
                  · {activePreview.stayCount} {t.previewStayCount}
                </span>
                {activePreview.surgeTriggered && (
                  <span className="font-sans font-bold text-[#FFC700]">
                    · {t.previewSurgeTriggered}
                  </span>
                )}
              </div>
            )}

            {selectedColor === activePreview.color && activePreview.tileCount > 0 && canPlay && (
              <button
                type="button"
                onClick={() => onCommitColor(activePreview.color)}
                className="chrome-btn-primary ml-1 rounded-full px-3 py-0.5 text-[11px] font-bold transition-transform hover:scale-105"
              >
                {t.resolveAction}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={`mx-auto grid items-center gap-2.5 ${
          hudMinimized
            ? 'max-w-4xl grid-cols-1 lg:grid-cols-12'
            : 'max-w-6xl grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* Left: Compact Action Triggers + Overdrive Reactor */}
        <div
          className={`flex flex-col gap-1.5 ${
            hudMinimized ? 'lg:col-span-4' : 'lg:col-span-3'
          }`}
        >
          <div
            className="grid grid-cols-3 gap-1.5"
            onMouseLeave={() => onHoverColor(null)}
          >
            {(['attack', 'defense', 'tech'] as TileType[]).map((color) => {
              const count = countByColor[color];
              const isGroupActive = activeColor === color;
              const isSurgeReady = count >= surgeThreshold;
              const label =
                color === 'attack'
                  ? t.attackName
                  : color === 'defense'
                    ? t.defenseName
                    : t.techName;
              const theme = TILE_THEME[color];
              return (
                <button
                  key={color}
                  type="button"
                  disabled={!canPlay || count === 0}
                  onPointerDown={(e) => {
                    lastPointerTypeRef.current = e.pointerType || 'mouse';
                  }}
                  onMouseEnter={() => onHoverColor(color)}
                  onFocus={() => onHoverColor(color)}
                  onBlur={() => onHoverColor(null)}
                  onClick={() => handleGroupActivate(color)}
                  aria-pressed={selectedColor === color}
                  className={`relative flex flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition-all duration-150 disabled:opacity-35 ${
                    isGroupActive && count > 0 ? theme.activeRing : `${theme.border} ${theme.bg}`
                  } ${theme.text}`}
                >
                  <div className="flex items-center gap-1 font-mono-tabular text-[10px]">
                    <span className="opacity-80">[{theme.shortcut}]</span>
                    <span className="font-bold text-white">×{count}</span>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">
                    {label}
                  </span>
                  {isSurgeReady && (
                    <span className="font-mono-tabular text-[9px] font-bold uppercase tracking-wider text-[#FFC700]">
                      {t.surgeLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canPlay || !overdriveReady}
            onClick={onOverdrive}
            className={`w-full rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all whitespace-nowrap ${
              overdriveReady && canPlay
                ? 'border-white/80 bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.5)] hover:brightness-110'
                : 'border-white/15 bg-slate-950/60 text-slate-400 disabled:opacity-50'
            }`}
          >
            {t.overdriveButton} ({run.heroine.overdrive}/100) [Space]
          </button>
        </div>

        {/* Center: 6-Slot Prismatic Chrome Tile Board */}
        <div
          className={`flex flex-col justify-center ${
            hudMinimized ? 'lg:col-span-8' : 'lg:col-span-6'
          }`}
        >
          <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-slate-200">
            <span className="font-mono-tabular font-semibold text-cyan-200">
              {t.surgeLabel}: {surgeThreshold}+
            </span>
            {run.heroine.damageBoostPct > 0 && (
              <span className="font-mono-tabular font-bold text-[#FFC700]">
                {t.damageBoostLabel}: +{run.heroine.damageBoostPct}%
              </span>
            )}
            <span className="font-mono-tabular text-slate-300">
              {combat?.board.length ?? 0}/6 · {t.poolTotalLabel}: {run.masterPool.length}
            </span>
          </div>

          <div
            className="grid grid-cols-6 gap-1.5 sm:gap-2"
            onMouseLeave={() => onHoverColor(null)}
          >
            {groupedBoard.map((tile) => {
              const isHighlighted = activeColor === tile.type;
              const isDimmed = activeColor !== null && activeColor !== tile.type;
              const theme = TILE_THEME[tile.type];
              const shortValue = formatTileShortLabel(tile, lang);
              const detailText = formatTileDetailText(tile, lang);
              const sourceLabel =
                tile.sourceId === 'innate'
                  ? t.innateLabel
                  : t.equipment[tile.sourceId]?.name ?? tile.sourceId;

              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={!canPlay}
                  title={`${detailText} (${sourceLabel})`}
                  onPointerDown={(e) => {
                    lastPointerTypeRef.current = e.pointerType || 'mouse';
                  }}
                  onMouseEnter={() => onHoverColor(tile.type)}
                  onFocus={() => onHoverColor(tile.type)}
                  onBlur={() => onHoverColor(null)}
                  onClick={() => handleGroupActivate(tile.type)}
                  aria-pressed={selectedColor === tile.type}
                  aria-label={`${detailText} · ${sourceLabel} · ${tile.isHeldFromPrevTurn ? t.heldTag : t.newTag}`}
                  className={`relative flex ${
                    hudMinimized ? 'h-14 sm:h-16' : 'h-16 sm:h-[74px]'
                  } flex-col items-center justify-between rounded-lg border p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-150 ${
                    isHighlighted ? theme.activeRing : `${theme.border} ${theme.bg}`
                  } ${isDimmed ? 'opacity-40' : 'opacity-100'} disabled:cursor-not-allowed`}
                >
                  <span
                    className={`font-mono-tabular text-[8px] font-bold uppercase tracking-wider leading-none ${
                      tile.isHeldFromPrevTurn ? 'text-[#FFC700]' : 'text-slate-300/80'
                    }`}
                  >
                    {tile.isHeldFromPrevTurn ? t.heldTag : t.newTag}
                  </span>

                  <div className="flex flex-col items-center gap-0.5">
                    <TileGlyph type={tile.type} size={hudMinimized ? 18 : 20} />
                    <span className="font-mono-tabular text-[11px] font-bold text-white whitespace-nowrap leading-none">
                      {shortValue}
                    </span>
                  </div>

                  <span
                    className={`w-full truncate text-center text-[9px] font-semibold leading-none ${theme.text}`}
                  >
                    {tile.type === 'tech'
                      ? tile.techEffect?.kind === 'heal'
                        ? t.healShort
                        : 'BOOST'
                      : tile.type === 'attack'
                        ? t.attackName
                        : t.defenseName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Single-Row Deterministic Next-Draw Strip (Hidden in Vista Minimized Mode) */}
        {!hudMinimized && (
          <div className="flex flex-col justify-between rounded-lg border border-white/15 bg-slate-950/45 p-2 lg:col-span-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider text-cyan-200">
                {t.nextDrawLabel}
              </span>
              <span className="font-mono-tabular text-slate-300">
                {t.drawPoolLabel}: {combat?.drawPile.length ?? 0} · {t.discardPoolLabel}:{' '}
                {combat?.discardPile.length ?? 0}
              </span>
            </div>

            <div className="my-1.5 grid grid-cols-6 gap-1">
              {upcomingDraws.map((tile, idx) => (
                <div
                  key={`${tile.id}_${idx}`}
                  title={formatTileDetailText(tile, lang)}
                  className={`flex h-10 flex-col items-center justify-center rounded border ${TILE_THEME[tile.type].border} bg-slate-950/80 px-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]`}
                >
                  <TileGlyph type={tile.type} size={13} />
                  <span className="mt-0.5 whitespace-nowrap text-center text-[9px] font-mono-tabular font-bold text-white leading-none">
                    {formatTileShortLabel(tile, lang)}
                  </span>
                </div>
              ))}
            </div>

            <div className="truncate text-[10px] font-medium text-amber-200/95">
              {activeColor === 'attack'
                ? `${t.surgeLabel}: ${t.surgeAttackEffect}`
                : activeColor === 'defense'
                  ? `${t.surgeLabel}: ${t.surgeDefenseEffect}`
                  : activeColor === 'tech'
                    ? `${t.surgeLabel}: ${t.surgeTechEffect}`
                    : `${t.surgeLabel} (${surgeThreshold}+): ${t.attackName} / ${t.defenseName} / ${t.techName}`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
