import { useMemo } from 'react';
import { SKILL_CHIPS_BY_ID, MAX_IMPLANTS } from '../../engine/data';
import { getEquippedChipMemory } from '../../engine/poolBuilder';
import { canModifyEquipment, sortTilesByGroup } from '../../engine/gameEngine';
import type { CharacterId, OwnedSkillChip, RunState, TileType } from '../../engine/types';
import { CODEX_TRANSLATIONS } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { formatTileDetailText, formatTileShortLabel } from '../../utils/tileDisplay';
import type { CodexTab } from '../CodexModal';
import { FormattedText } from '../FormattedText';
import { ImplantIcon } from '../ImplantIcon';
import { TileGlyph } from '../TileGlyph';

export interface PoolModalProps {
  run: RunState;
  lang: Language;
  onEquip: (instanceId: string) => void;
  onUnequip: (instanceId: string) => void;
  onScrap: (instanceId: string) => void;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId) => void;
  onClose: () => void;
}

export function PoolModal({ run, lang, onEquip, onUnequip, onScrap, onOpenCodex, onClose }: PoolModalProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const charMeta = t.characters[run.hero.characterId ?? 'kira'];
  const canSwap = canModifyEquipment(run);
  const equippedWeight = getEquippedChipMemory(run.hero);
  const capacityPct = Math.min(
    100,
    Math.round((equippedWeight / Math.max(1, run.hero.memoryCapacity)) * 100),
  );

  const equippedSet = useMemo(
    () => new Set(run.hero.equippedInstanceIds),
    [run.hero.equippedInstanceIds],
  );

  const { equippedItems, stashItems } = useMemo(() => {
    const equipped: OwnedSkillChip[] = [];
    const stash: OwnedSkillChip[] = [];
    for (const item of run.hero.ownedChips) {
      if (equippedSet.has(item.instanceId)) {
        equipped.push(item);
      } else {
        stash.push(item);
      }
    }
    return { equippedItems: equipped, stashItems: stash };
  }, [run.hero.ownedChips, equippedSet]);

  const { counts, groupedPool } = useMemo(() => {
    const tileCounts: Record<TileType, number> = { attack: 0, defense: 0, tech: 0 };
    for (const tile of run.masterPool) {
      tileCounts[tile.type] += 1;
    }
    return {
      counts: tileCounts,
      groupedPool: sortTilesByGroup(run.masterPool),
    };
  }, [run.masterPool]);

  const renderEquipmentCard = (item: OwnedSkillChip, isEquipped: boolean) => {
    const def = SKILL_CHIPS_BY_ID[item.defId];
    if (!def) return null;
    const meta = t.equipment[def.id];
    const fits = equippedWeight + def.memoryCost <= run.hero.memoryCapacity;

    return (
      <div
        key={item.instanceId}
        className={`chrome-pill flex flex-col justify-between rounded-xl p-2 sm:p-3 ${
          isEquipped ? 'border-[#00F0FF]/55' : 'border-white/15 opacity-90'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <div className="font-display text-[13px] sm:text-sm font-bold text-white truncate">
                {meta?.name ?? def.id}
              </div>
              <div className="font-mono-tabular text-[12px] sm:text-[13px] text-[#00F0FF] shrink-0">
                {t.sizeLabel}: {def.memoryCost}
              </div>
            </div>
            {isEquipped ? (
              <button
                type="button"
                disabled={!canSwap}
                onClick={() => onUnequip(item.instanceId)}
                className="shrink-0 rounded-md border border-rose-400/55 bg-rose-500/20 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[12px] sm:text-[13px] font-bold text-rose-100 transition-colors hover:bg-rose-500/35 disabled:opacity-40 cursor-pointer"
              >
                {t.unequipAction}
              </button>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={!canSwap || !fits}
                  onClick={() => onEquip(item.instanceId)}
                  className="chrome-btn-primary shrink-0 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[12px] sm:text-[13px] font-bold transition-all disabled:bg-none disabled:bg-slate-800 disabled:text-slate-400 disabled:border-white/10 disabled:shadow-none cursor-pointer"
                >
                  {fits ? t.equipAction : t.capacityFullWarning}
                </button>
                <button
                  type="button"
                  disabled={!canSwap}
                  onClick={() => onScrap(item.instanceId)}
                  title={`${t.scrapAction} (+${Math.floor(def.price * 0.5)} ${t.creditsLabel})`}
                  className="shrink-0 rounded-md border border-amber-300/45 bg-amber-500/15 px-1.5 py-0.5 sm:px-2 sm:py-1 font-mono-tabular text-[12px] sm:text-[13px] font-bold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-40 cursor-pointer"
                >
                  {t.scrapAction} +{Math.floor(def.price * 0.5)} {t.creditsLabel}
                </button>
              </div>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[12px] sm:text-[13px]">
            {def.tiles.map((spec, idx) => (
              <span
                key={`${item.instanceId}_t_${idx}`}
                className={`font-bold ${
                  spec.type === 'attack'
                    ? 'text-rose-200'
                    : spec.type === 'defense'
                      ? 'text-cyan-200'
                      : 'text-amber-200'
                }`}
              >
                {idx > 0 ? '· ' : ''}
                {formatTileShortLabel(spec, lang)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pool-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm"
    >
      <div className="chrome-panel-bright flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2
                id="pool-modal-title"
                className="chrome-text-shimmer font-display text-base sm:text-xl font-bold"
              >
                {t.poolModalTitle} ({run.masterPool.length})
              </h2>
              <span className="text-[12.5px] sm:text-[13px] text-slate-200">
                {t.poolModalDesc
                  .replace('{name}', charMeta.name)
                  .replace('{capacity}', String(run.hero.memoryCapacity))}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] sm:text-[13px] font-medium">
              <span className="text-cyan-300">★ {charMeta.passive}</span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="text-amber-300">
                ⚡ {charMeta.overdriveName}: {charMeta.overdriveDesc}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCodex && (
              <button
                type="button"
                onClick={() => onOpenCodex('heroes', run.hero.characterId ?? 'kira')}
                className="chrome-pill rounded-lg border-cyan-300/50 px-2.5 py-1 text-xs font-bold text-[#00F0FF] hover:border-cyan-200 hover:text-white cursor-pointer whitespace-nowrap"
              >
                {codexT.inspectHeroDossierBtn}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="chrome-pill rounded-lg px-3 py-1 text-xs font-bold text-white hover:border-cyan-300 cursor-pointer whitespace-nowrap"
            >
              {t.closeLabel}
            </button>
          </div>
        </div>

        {/* Slim Capacity Bar & Combat Swap Notice */}
        <div className="chrome-pill mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-[180px] flex-1">
            <span className="font-semibold text-slate-100 whitespace-nowrap">
              {t.capacityLabel}:{' '}
              <span className="font-mono-tabular font-bold text-[#00F0FF]">
                {equippedWeight} / {run.hero.memoryCapacity}
              </span>
            </span>
            <div className="h-2 max-w-[180px] flex-1 overflow-hidden rounded-full bg-slate-950/80 p-[1px] ring-1 ring-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#A5F3FC] transition-all duration-200"
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {!canSwap && (
              <span className="text-[12px] sm:text-[13px] font-medium text-[#FFC700]">
                {t.combatSwapLocked}
              </span>
            )}
            <span className="font-mono-tabular font-bold text-[#FFC700] whitespace-nowrap">
              {run.hero.credits} {t.creditsLabel}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex-1 space-y-2.5 sm:space-y-4 overflow-y-auto pr-1">
          {/* Equipment Loadout Grid: Equipped vs Cargo */}
          <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2 sm:gap-4">
            <div>
              <div className="mb-1 text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-[#00F0FF]">
                {t.equippedGearTitle} ({equippedItems.length})
              </div>
              {equippedItems.length === 0 ? (
                <div className="chrome-pill rounded-xl p-2.5 text-[13px] text-slate-300">
                  {t.noEquippedGear}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {equippedItems.map((item) => renderEquipmentCard(item, true))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-slate-300">
                {t.cargoStashTitle} ({stashItems.length})
              </div>
              {stashItems.length === 0 ? (
                <div className="chrome-pill rounded-xl p-2.5 text-[13px] text-slate-300">
                  {t.noCargoStash}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stashItems.map((item) => renderEquipmentCard(item, false))}
                </div>
              )}
            </div>
          </div>

          {/* Active Master Tile Pool */}
          <div className="border-t border-white/15 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-[13px] font-mono-tabular">
              <span className="font-sans text-[12.5px] font-bold uppercase tracking-wider text-slate-200">
                {t.poolTotalLabel} ({run.masterPool.length})
              </span>
              <span className="font-bold text-rose-200">
                {t.attackName}: {counts.attack}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-bold text-cyan-200">
                {t.defenseName}: {counts.defense}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-bold text-amber-200">
                {t.techName}: {counts.tech}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5 min-[520px]:grid-cols-6 sm:gap-2">
              {groupedPool.map((tile) => {
                const shortLabel = formatTileShortLabel(tile, lang);
                const detail = formatTileDetailText(tile, lang);
                const sourceName =
                  tile.sourceId === 'innate'
                    ? t.innateLabel
                    : t.equipment[tile.sourceId]?.name ?? tile.sourceId;
                return (
                  <div
                    key={tile.id}
                    title={detail}
                    className="chrome-pill flex flex-col items-center justify-between rounded-lg p-2 text-center"
                  >
                    <span className="font-mono-tabular text-[13px] font-bold text-white">
                      {shortLabel}
                    </span>
                    <TileGlyph type={tile.type} size={18} className="my-0.5 sm:my-1" />
                    <span className="w-full truncate text-[12px] text-slate-200">
                      {detail}
                    </span>
                    <span className="w-full truncate text-[11.5px] text-slate-400">
                      {sourceName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cybernetic Implants */}
          <div className="border-t border-white/15 pt-3">
            <div className="text-[12.5px] font-bold uppercase tracking-wider text-slate-200">
              {t.implantsTitle} ({run.hero.implants.length}/{MAX_IMPLANTS})
            </div>
            {run.hero.implants.length === 0 ? (
              <div className="mt-1 text-[13px] text-slate-300">{t.noImplants}</div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 min-[540px]:grid-cols-2">
                {run.hero.implants.map((id) => (
                  <div
                    key={id}
                    className="chrome-pill flex items-start gap-2.5 rounded-lg p-2"
                  >
                    <ImplantIcon id={id} size={22} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#00F0FF]">{t.implants[id].name}</div>
                      <div className="text-[12.5px] leading-snug text-slate-200">
                        <FormattedText text={t.implants[id].desc} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
