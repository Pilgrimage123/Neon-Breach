import type { MutableRefObject } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { getEffectiveTileValue } from '../../engine/gameEngine';
import type { CharacterId, RunState, Tile, TileType } from '../../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import {
  getTileCornerPip,
  type SemanticZoomLoD,
} from '../../utils/accessibilityAndScale';
import { formatTileDetailText, formatTileShortLabel } from '../../utils/tileDisplay';
import type { CodexTab } from '../CodexModal';
import { TileGlyph } from '../TileGlyph';
import { TILE_THEME } from './TacticalIntelStrip';

export interface TileBoardGridProps {
  run: RunState;
  lang: Language;
  canPlay: boolean;
  hudMinimized: boolean;
  isCompactLandscape: boolean;
  isNarrowPortrait: boolean;
  lod: SemanticZoomLoD;
  hcBorderClass: string;
  activeColor: TileType | null;
  selectedColor: TileType | null;
  activeSurgeText: string;
  groupedBoard: Tile[];
  lastPointerTypeRef: MutableRefObject<string>;
  onHoverColor: (color: TileType | null) => void;
  onInspectTile: (tileId: string | null) => void;
  onActivateGroup: (color: TileType, tileId?: string) => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
}

export function TileBoardGrid({
  run,
  lang,
  canPlay,
  hudMinimized,
  isCompactLandscape,
  isNarrowPortrait,
  lod,
  hcBorderClass,
  activeColor,
  selectedColor,
  activeSurgeText,
  groupedBoard,
  lastPointerTypeRef,
  onHoverColor,
  onInspectTile,
  onActivateGroup,
  onOpenCodex,
}: TileBoardGridProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const combat = run.combat;

  return (
    <div className="flex flex-col justify-center">
      <div
        className={`mb-1 flex items-center justify-between gap-2 px-0.5 font-mono-tabular ${
          isCompactLandscape ? 'text-[11px]' : 'text-[12px] sm:text-[13px]'
        } text-slate-200`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-cyan-200 truncate">{activeSurgeText}</span>
          {onOpenCodex && (
            <button
              type="button"
              data-testid="dock-surge-glossary-btn"
              onClick={() =>
                onOpenCodex('glossary', run.hero.characterId ?? 'kira', 'stack_surge')
              }
              title={codexT.openTermHint}
              aria-label={`${t.surgeLabel}: ${codexT.openTermHint}`}
              className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-950/60 text-[11px] font-extrabold text-cyan-200 hover:border-cyan-200 hover:text-white cursor-pointer"
            >
              ?
            </button>
          )}
        </div>
        {run.hero.damageBoostPct > 0 && (
          <span className="font-bold text-[#FFC700] whitespace-nowrap px-1">
            +{run.hero.damageBoostPct}% DMG
          </span>
        )}
        {(run.hero.pendingUpcharge ?? 0) > 0 && (
          <span className="font-bold text-emerald-300 whitespace-nowrap px-1">
            ⚡+{run.hero.pendingUpcharge} {t.upchargeShort}
          </span>
        )}
        <span className="text-slate-300 whitespace-nowrap shrink-0">
          {combat?.board.length ?? 0}/{Math.min(9, 6 + (run.hero.pendingUpcharge ?? 0))} · {t.poolTotalLabel}: {run.masterPool.length}
        </span>
      </div>

      <div
        className="grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(6, groupedBoard.length)}, minmax(0, 1fr))` }}
        onMouseLeave={() => {
          onHoverColor(null);
          onInspectTile(null);
        }}
      >
        {groupedBoard.map((tile) => {
          const isJammed = Boolean(tile.isJammed);
          const isBlight = Boolean(tile.isBlight);
          const isDud = Boolean(tile.isDud);
          const isReactorCore = Boolean(tile.isDud || tile.isReactorCore);
          const hasUpcharge = (tile.upcharge ?? 0) > 0;
          const isHexed = Boolean(
            tile.hexedByEnemyId &&
              combat?.enemies.some((e) => e.id === tile.hexedByEnemyId && e.hp > 0),
          );
          const isHighlighted = !isJammed && activeColor === tile.type;
          const isDimmed = isJammed || (activeColor !== null && activeColor !== tile.type);
          const theme = TILE_THEME[tile.type];
          const pip = getTileCornerPip(tile.type);
          const effective = getEffectiveTileValue(
            tile,
            run.hero,
            combat?.bloodlineResonanceActive,
          );
          const shortValue = isBlight
            ? '0'
            : isDud && effective.value === 0
              ? lang === 'cs'
                ? 'SLEPÝ'
                : 'DUD'
              : lod.level === 'overview'
                ? tile.type === 'attack' || tile.type === 'defense'
                  ? `${effective.value}`
                  : formatTileShortLabel(tile, lang)
                : tile.type === 'attack'
                  ? `${t.atkShort} ${effective.value}`
                  : tile.type === 'defense'
                    ? `${t.defShort} ${effective.value}`
                    : formatTileShortLabel(tile, lang);
          const detailText = formatTileDetailText(tile, lang);
          const sourceLabel =
            tile.sourceId === 'innate'
              ? t.innateLabel
              : t.equipment[tile.sourceId]?.name ?? tile.sourceId;
          const techKind = tile.techEffect?.kind;
          const bottomLabel = isJammed
            ? t.jammedTag
            : isBlight
              ? t.purgeLabel
              : tile.type === 'tech'
                ? techKind === 'heal'
                  ? t.healShort
                  : techKind === 'armor_shred'
                    ? t.shredShort
                    : techKind === 'overdrive_surge'
                      ? t.odShort
                      : techKind === 'tactical_shield'
                        ? t.aegisShort
                        : lang === 'cs'
                          ? 'POSÍLENÍ'
                          : 'BOOST'
                : tile.type === 'attack'
                  ? t.attackName
                  : t.defenseName;

          return (
            <button
              key={tile.id}
              type="button"
              aria-disabled={!canPlay || isJammed}
              data-testid={
                isJammed
                  ? `jammed-tile-${tile.id}`
                  : isBlight
                    ? `blight-tile-${tile.id}`
                    : isHexed
                      ? `hexed-tile-${tile.id}`
                      : `board-tile-${tile.id}`
              }
              data-tile-suit-pip={pip.symbol}
              title={`${pip.symbol} ${detailText} (${sourceLabel})${isJammed ? ` · ${t.jammedTag}` : ''}${
                isHexed ? ` · ${t.hexTag}` : ''
              }`}
              onPointerDown={(e) => {
                lastPointerTypeRef.current = e.pointerType || 'mouse';
              }}
              onMouseEnter={() => {
                onInspectTile(tile.id);
                if (!isJammed) onHoverColor(tile.type);
              }}
              onFocus={() => {
                onInspectTile(tile.id);
                if (!isJammed) onHoverColor(tile.type);
              }}
              onBlur={() => {
                onInspectTile(null);
                onHoverColor(null);
              }}
              onClick={() => {
                if (isJammed || !canPlay) {
                  soundEngine.playInvalidBuzz();
                  return;
                }
                onActivateGroup(tile.type, tile.id);
              }}
              aria-pressed={selectedColor === tile.type && !isJammed}
              aria-label={`${pip.symbol} ${detailText} · ${sourceLabel} · ${
                isJammed
                  ? t.jammedTag
                  : isBlight
                    ? t.blightTag
                    : tile.isHeldFromPrevTurn
                      ? t.heldTag
                      : t.newTag
              }${isHexed ? ` · ${t.hexTag}` : ''}`}
              className={`relative flex flex-col items-center justify-between overflow-hidden rounded-lg border p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-150 ${
                !canPlay || isJammed ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${hcBorderClass} ${
                lod.level === 'closeup'
                  ? 'h-[76px] sm:h-[88px]'
                  : isCompactLandscape || isNarrowPortrait
                    ? 'h-[60px] sm:h-[66px]'
                    : hudMinimized
                      ? 'h-[60px] sm:h-[68px]'
                      : 'h-[68px] sm:h-[78px]'
              } ${
                isJammed
                  ? 'border-dashed border-lime-400/75 bg-slate-950/90'
                  : isBlight
                    ? isHighlighted
                      ? 'border-dashed border-lime-300 ring-2 ring-[#84CC16] bg-[#243310] -translate-y-0.5'
                      : 'border-dashed border-[#84CC16]/80 bg-[#1B240E]/90 hover:bg-[#233012]/95'
                    : isHighlighted
                      ? theme.activeRing
                      : `${theme.border} ${theme.bg}`
              } ${isHexed ? 'ring-2 ring-[#C084FC]/90 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : ''} ${
                isDimmed ? 'opacity-45' : 'opacity-100'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-0.5 px-0.5 leading-none">
                <span className="flex min-w-0 flex-1 items-center gap-0.5">
                  <span
                    data-testid={`tile-pip-${tile.type}`}
                    style={{ backgroundColor: isBlight ? '#84CC16' : pip.accentHex, color: '#020617' }}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[10px] font-black leading-none"
                  >
                    {isBlight ? '☣' : pip.symbol}
                  </span>
                  {tile.secondaryType && (tile.secondaryValue ?? 0) > 0 && (
                    <span
                      data-testid={`spliced-badge-${tile.id}`}
                      style={{
                        backgroundColor: getTileCornerPip(tile.secondaryType).accentHex,
                        color: '#020617',
                      }}
                      className="inline-flex h-4 shrink-0 items-center justify-center rounded-sm border border-white/80 px-0.5 font-mono-tabular text-[9px] font-black leading-none"
                      title={
                        lang === 'cs'
                          ? `Sloučený dílek: +${tile.secondaryValue} ${
                              tile.secondaryType === 'attack'
                                ? 'ÚTOK'
                                : tile.secondaryType === 'defense'
                                  ? 'OBRANA'
                                  : 'TECH'
                            }`
                          : `Hybrid Tile: +${tile.secondaryValue} ${tile.secondaryType.toUpperCase()}`
                      }
                    >
                      +{tile.secondaryValue}{getTileCornerPip(tile.secondaryType).symbol}
                    </span>
                  )}
                  {lod.showMicroBadges && (isJammed || isBlight || tile.isHeldFromPrevTurn) && (
                    <span
                      className={`min-w-0 truncate font-mono-tabular text-[9px] min-[460px]:text-[10px] font-bold uppercase tracking-tight sm:tracking-wider leading-none ${
                        isJammed
                          ? 'text-lime-300'
                          : isBlight
                            ? 'text-[#BEF264]'
                            : 'text-[#FFC700]'
                      }`}
                    >
                      {isJammed ? t.jammedTag : isBlight ? t.blightTag : t.heldTag}
                    </span>
                  )}
                </span>
                {isHexed ? (
                  <span className="shrink-0 rounded bg-purple-500/35 px-1 font-mono-tabular text-[10px] font-black text-purple-200 leading-tight">
                    ⬡
                  </span>
                ) : tile.isHotPotato ? (
                  <span
                    data-testid={`hot-potato-badge-${tile.id}`}
                    className="shrink-0 rounded bg-amber-500/35 px-1 font-mono-tabular text-[10px] font-black text-amber-200 leading-tight"
                  >
                    💣8
                  </span>
                ) : tile.isTemptation ? (
                  <span
                    data-testid={`temptation-badge-${tile.id}`}
                    className="shrink-0 rounded bg-fuchsia-500/35 px-1 font-mono-tabular text-[10px] font-black text-fuchsia-200 leading-tight"
                  >
                    ⚡+14
                  </span>
                ) : tile.isContagion ? (
                  <span
                    data-testid={`contagion-badge-${tile.id}`}
                    className="shrink-0 rounded bg-lime-500/35 px-1 font-mono-tabular text-[10px] font-black text-lime-200 leading-tight"
                  >
                    🦠
                  </span>
                ) : effective.flatBonus > 0 && !isJammed && !isBlight ? (
                  <span className="shrink-0 font-mono-tabular text-[10px] sm:text-[11px] font-extrabold text-emerald-300 leading-none">
                    +{effective.flatBonus}
                  </span>
                ) : null}
              </div>

              <div className="flex w-full flex-col items-center gap-1 my-auto">
                <TileGlyph
                  type={tile.type}
                  size={
                    lod.showLargeSilhouettes
                      ? 22
                      : isCompactLandscape || isNarrowPortrait
                        ? 16
                        : hudMinimized
                          ? 18
                          : 21
                  }
                />
                <span
                  className={`max-w-full truncate font-mono-tabular font-extrabold whitespace-nowrap leading-none tactical-numeral-stroke ${
                    lod.level === 'overview' || lod.level === 'closeup'
                      ? 'text-sm sm:text-base'
                      : 'text-[10.5px] min-[460px]:text-xs sm:text-[13.5px]'
                  } ${
                    isJammed
                      ? 'line-through text-slate-400'
                      : isBlight
                        ? 'text-lime-300'
                        : effective.flatBonus > 0
                          ? 'text-amber-100'
                          : 'text-[#F4F4F6]'
                  }`}
                >
                  {shortValue}
                </span>
              </div>

              {isJammed || isBlight ? (
                <span className="w-full truncate text-center text-[10px] sm:text-[11px] font-bold leading-none text-lime-300">
                  {bottomLabel}
                </span>
              ) : isHexed ? (
                <span className="w-full truncate text-center text-[10px] font-extrabold leading-none text-purple-200">
                  {t.hexTag}
                </span>
              ) : isReactorCore || hasUpcharge ? (
                <span className="w-full truncate text-center font-mono-tabular text-[10px] font-extrabold leading-none text-emerald-300">
                  {isReactorCore && run.hero.characterId === 'auraline'
                    ? `+1 ${t.upchargeShort} · +3 ${t.armorShort}`
                    : hasUpcharge
                      ? `⚡+${tile.upcharge} ${t.upchargeShort}`
                      : t.dudTag}
                </span>
              ) : (
                <span className="h-0.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
