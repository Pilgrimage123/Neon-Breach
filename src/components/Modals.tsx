import { useMemo } from 'react';
import {
  EQUIPMENT_BY_ID,
  MAX_IMPLANTS,
  getEquippedEquipmentWeight,
} from '../engine/data';
import { canModifyEquipment, sortTilesByGroup } from '../engine/gameEngine';
import type { OwnedEquipment, RunState, TileType } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import { ImplantIcon } from './ImplantIcon';
import { TileGlyph } from './TileGlyph';

interface PoolModalProps {
  run: RunState;
  lang: Language;
  onEquip: (instanceId: string) => void;
  onUnequip: (instanceId: string) => void;
  onClose: () => void;
}

export function PoolModal({ run, lang, onEquip, onUnequip, onClose }: PoolModalProps) {
  const t = TRANSLATIONS[lang];
  const canSwap = canModifyEquipment(run);
  const equippedWeight = getEquippedEquipmentWeight(run.heroine);
  const capacityPct = Math.min(
    100,
    Math.round((equippedWeight / Math.max(1, run.heroine.carryCapacity)) * 100),
  );

  const equippedSet = useMemo(
    () => new Set(run.heroine.equippedInstanceIds),
    [run.heroine.equippedInstanceIds],
  );

  const { equippedItems, stashItems } = useMemo(() => {
    const equipped: OwnedEquipment[] = [];
    const stash: OwnedEquipment[] = [];
    for (const item of run.heroine.ownedEquipment) {
      if (equippedSet.has(item.instanceId)) {
        equipped.push(item);
      } else {
        stash.push(item);
      }
    }
    return { equippedItems: equipped, stashItems: stash };
  }, [run.heroine.ownedEquipment, equippedSet]);

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

  const renderEquipmentCard = (item: OwnedEquipment, isEquipped: boolean) => {
    const def = EQUIPMENT_BY_ID[item.defId];
    if (!def) return null;
    const meta = t.equipment[def.id];
    const fits = equippedWeight + def.size <= run.heroine.carryCapacity;

    return (
      <div
        key={item.instanceId}
        className={`chrome-pill flex flex-col justify-between rounded-xl p-3 ${
          isEquipped ? 'border-[#00F0FF]/55' : 'border-white/15 opacity-90'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white truncate">
                {meta?.name ?? def.id}
              </div>
              <div className="mt-0.5 font-mono-tabular text-[11px] text-[#00F0FF]">
                {t.sizeLabel}: {def.size}
              </div>
            </div>
            {isEquipped ? (
              <button
                type="button"
                disabled={!canSwap}
                onClick={() => onUnequip(item.instanceId)}
                className="shrink-0 rounded-md border border-rose-400/55 bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-100 transition-colors hover:bg-rose-500/35 disabled:opacity-40 cursor-pointer"
              >
                {t.unequipAction}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSwap || !fits}
                onClick={() => onEquip(item.instanceId)}
                className="chrome-btn-primary shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all disabled:bg-none disabled:bg-slate-800 disabled:text-slate-400 disabled:border-white/10 disabled:shadow-none cursor-pointer"
              >
                {fits ? t.equipAction : t.capacityFullWarning}
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[11px]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="chrome-panel-bright flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="pool-modal-title"
              className="chrome-text-shimmer font-display text-xl font-bold"
            >
              {t.poolModalTitle} ({run.masterPool.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-200">{t.poolModalDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="chrome-pill rounded-lg px-3 py-1.5 text-xs font-bold text-white hover:border-cyan-300 cursor-pointer"
          >
            {t.closeLabel}
          </button>
        </div>

        {/* Capacity Bar & Combat Swap Notice */}
        <div className="chrome-pill mt-3.5 rounded-xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-100">
              {t.capacityLabel}:{' '}
              <span className="font-mono-tabular font-bold text-[#00F0FF]">
                {equippedWeight} / {run.heroine.carryCapacity}
              </span>
            </span>
            <span className="font-mono-tabular font-bold text-[#FFC700]">
              {run.heroine.credits} {t.creditsLabel}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-950/80 p-[1px] ring-1 ring-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#A5F3FC] transition-all duration-200"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
          {!canSwap && (
            <div className="mt-1.5 text-[11px] font-medium text-[#FFC700]">
              {t.combatSwapLocked}
            </div>
          )}
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Equipment Loadout Grid: Equipped vs Cargo */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#00F0FF]">
                {t.equippedGearTitle} ({equippedItems.length})
              </div>
              {equippedItems.length === 0 ? (
                <div className="chrome-pill rounded-xl p-3 text-xs text-slate-300">
                  {t.noEquippedGear}
                </div>
              ) : (
                <div className="space-y-2">
                  {equippedItems.map((item) => renderEquipmentCard(item, true))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {t.cargoStashTitle} ({stashItems.length})
              </div>
              {stashItems.length === 0 ? (
                <div className="chrome-pill rounded-xl p-3 text-xs text-slate-300">
                  {t.noCargoStash}
                </div>
              ) : (
                <div className="space-y-2">
                  {stashItems.map((item) => renderEquipmentCard(item, false))}
                </div>
              )}
            </div>
          </div>

          {/* Active Master Tile Pool */}
          <div className="border-t border-white/15 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular">
              <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-slate-200">
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

            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                    <span className="font-mono-tabular text-[11px] font-bold text-white">
                      {shortLabel}
                    </span>
                    <TileGlyph type={tile.type} size={20} className="my-1" />
                    <span className="w-full truncate text-[10px] text-slate-300">
                      {sourceName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cybernetic Implants */}
          <div className="border-t border-white/15 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              {t.implantsTitle} ({run.heroine.implants.length}/{MAX_IMPLANTS})
            </div>
            {run.heroine.implants.length === 0 ? (
              <div className="mt-1 text-xs text-slate-300">{t.noImplants}</div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {run.heroine.implants.map((id) => (
                  <div
                    key={id}
                    className="chrome-pill flex items-start gap-2.5 rounded-lg p-2"
                  >
                    <ImplantIcon id={id} size={22} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#00F0FF]">{t.implants[id].name}</div>
                      <div className="text-[11px] leading-snug text-slate-200">
                        {t.implants[id].desc}
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

interface PauseModalProps {
  lang: Language;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export function PauseModal({ lang, onResume, onRestart, onTitle }: PauseModalProps) {
  const t = TRANSLATIONS[lang];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="chrome-panel-bright w-full max-w-sm rounded-2xl p-6 text-center">
        <h2
          id="pause-modal-title"
          className="chrome-text-shimmer font-display text-2xl font-bold"
        >
          {t.pauseTitle}
        </h2>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="chrome-btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all cursor-pointer"
          >
            {t.resume}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="chrome-pill w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-rose-400 cursor-pointer"
          >
            {t.restart}
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="chrome-pill w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:text-white cursor-pointer"
          >
            {t.returnTitle}
          </button>
        </div>
      </div>
    </div>
  );
}

interface EndRunModalProps {
  outcome: 'victory' | 'gameover';
  lang: Language;
  score: number;
  bestScore: number;
  turns: number;
  enemiesDefeated: number;
  onPlayAgain: () => void;
  onTitle: () => void;
}

export function EndRunModal({
  outcome,
  lang,
  score,
  bestScore,
  turns,
  enemiesDefeated,
  onPlayAgain,
  onTitle,
}: EndRunModalProps) {
  const t = TRANSLATIONS[lang];
  const isVictory = outcome === 'victory';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div
        className={`chrome-panel-bright w-full max-w-md rounded-2xl p-6 text-center ${
          isVictory ? 'border-[#FFC700]/65' : 'border-[#FF2E7E]/65'
        }`}
      >
        <h2
          id="end-modal-title"
          className="chrome-text-shimmer font-display text-3xl font-bold"
        >
          {isVictory ? t.victoryTitle : t.defeatTitle}
        </h2>
        <p className="mt-1.5 text-sm text-slate-200">
          {isVictory ? t.victorySubtitle : t.defeatSubtitle}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="chrome-pill rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-300">
              {t.scoreLabel}
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold text-[#FFC700]">
              {score}
            </div>
          </div>
          <div className="chrome-pill rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-300">
              {t.turnsLabel}
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold text-[#00F0FF]">
              {turns}
            </div>
          </div>
          <div className="chrome-pill rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-300">
              {t.enemiesDefeatedLabel}
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold text-rose-300">
              {enemiesDefeated}
            </div>
          </div>
        </div>

        <div className="mt-3 font-mono-tabular text-xs font-semibold text-amber-200">
          {t.bestScoreLabel}: {Math.max(score, bestScore)}
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="chrome-btn-strike flex-1 rounded-lg px-5 py-3 text-sm font-bold transition-all cursor-pointer"
          >
            {isVictory ? t.playAgain : t.tryAgain}
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="chrome-pill flex-1 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-300 cursor-pointer"
          >
            {t.returnTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
