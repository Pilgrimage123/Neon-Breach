import { SKILL_CHIPS_BY_ID } from '../engine/data';
import { getEquippedChipMemory } from '../engine/poolBuilder';
import type { CombatState, HeroState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { EncounterObjectivesSummary } from '../utils/tacticalSandboxAndHints';
import { formatTileShortLabel } from '../utils/tileDisplay';
import { FormattedText } from './FormattedText';

export interface CombatLootOverlayProps {
  combat: CombatState;
  hero: HeroState;
  lang: Language;
  objectivesSummary: EncounterObjectivesSummary | null;
  onOpenPool: () => void;
  onClaimReward: (defId: string | null) => void;
}

export function CombatLootOverlay({
  combat,
  hero,
  lang,
  objectivesSummary,
  onOpenPool,
  onClaimReward,
}: CombatLootOverlayProps) {
  const t = TRANSLATIONS[lang];
  const usedWeight = getEquippedChipMemory(hero);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 p-2.5 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="chrome-panel-bright w-full max-w-2xl max-h-[94%] overflow-y-auto rounded-2xl p-3.5 sm:p-6">
        <div className="text-center">
          <h2 className="chrome-text-shimmer font-display text-lg sm:text-2xl font-bold">
            {t.combatVictory}
          </h2>
          <div className="mt-1 sm:mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono-tabular text-slate-200">
            <span>
              {t.turnsLabel}: {combat.turn}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t.damageDealtLabel}: {combat.totalDamageDealt}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-[#FFC700]">
              +{combat.rewardCredits + (objectivesSummary?.bonusCredits ?? 0)} {t.creditsLabel}
            </span>
          </div>
          {combat.mandateBreachLootConfiscated && (
            <div
              data-testid="mandate-breach-banner"
              className="mt-2 rounded-lg border border-rose-400/70 bg-rose-950/65 px-3 py-1.5 font-mono-tabular text-[11px] font-bold text-rose-100"
            >
              {lang === 'cs'
                ? `⚠ PORUŠENÍ MANDÁTU (Velmistr): -${combat.mandateBreachPenaltyHp ?? 6} HP průlom · -50 % CR`
                : `⚠ GRANDMASTER MANDATE BREACH: -${combat.mandateBreachPenaltyHp ?? 6} HP Hull Breach · -50% CR`}
            </div>
          )}
          {combat.rewardBreakdown && !combat.mandateBreachLootConfiscated && (
            <div
              data-testid="combat-reward-breakdown"
              className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 font-mono-tabular text-[10px] sm:text-[11px]"
            >
              <span className="rounded border border-white/15 bg-slate-900/75 px-2 py-0.5 text-slate-200">
                {t.baseLootLabel}: +{combat.rewardBreakdown.baseCredits}
              </span>
              {combat.rewardBreakdown.parCacheCredits > 0 && (
                <span className="rounded border border-[#FFC700]/45 bg-amber-950/60 px-2 py-0.5 font-bold text-[#FFE066]">
                  {t.parBonusLabel} ({combat.rewardBreakdown.intactParCount}/3): +
                  {combat.rewardBreakdown.parCacheCredits}
                </span>
              )}
              {combat.rewardBreakdown.tempoCredits > 0 && (
                <span className="rounded border border-emerald-300/45 bg-emerald-950/60 px-2 py-0.5 font-bold text-emerald-200">
                  {t.tempoBonusLabel}: +{combat.rewardBreakdown.tempoCredits}
                </span>
              )}
              {combat.rewardBreakdown.fastClearCredits > 0 && (
                <span className="rounded border border-[#00F0FF]/50 bg-cyan-950/65 px-2 py-0.5 font-bold text-cyan-200">
                  {t.fastClearBonusLabel}: +{combat.rewardBreakdown.fastClearCredits}
                </span>
              )}
            </div>
          )}
          {objectivesSummary && (
            <div
              data-testid="victory-tiered-objectives"
              className="mt-2 flex flex-wrap items-center justify-center gap-1.5 font-mono-tabular text-[10px]"
            >
              {objectivesSummary.tiers.map((tier) => (
                <div
                  key={`victory_tier_${tier.tier}`}
                  data-achieved={tier.completed ? 'true' : 'false'}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                    tier.completed
                      ? 'border-emerald-300/60 bg-emerald-950/50 text-emerald-100'
                      : 'border-white/10 bg-slate-900/60 text-slate-400 opacity-75'
                  }`}
                >
                  <span
                    className={`font-bold ${tier.completed ? 'text-[#FFC700]' : 'text-slate-400'}`}
                  >
                    {tier.completed ? '✓' : '—'} {tier.tierLabel}
                  </span>
                  <span className="text-[9px] text-slate-300 truncate max-w-[150px]">
                    {tier.title}
                  </span>
                  <span className="text-[9px] font-bold text-cyan-200">{tier.rewardText}</span>
                </div>
              ))}
            </div>
          )}
          {combat.nodeType === 'ELITE' &&
            !hero.emergencyDefibUsed &&
            hero.hp <= Math.round(hero.maxHp * 0.15) && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/55 bg-emerald-950/60 px-3 py-1 font-mono-tabular text-[11px] font-bold text-emerald-200">
                ⚡ {t.emergencyDefibTriggered}
              </div>
            )}
        </div>

        {combat.rewardChipChoices.length > 0 && (
          <div className="mt-2.5 sm:mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                {t.combatLootPrompt}
              </span>
              <div className="flex items-center gap-2 font-mono-tabular text-[11px]">
                <span
                  className={
                    usedWeight >= hero.memoryCapacity
                      ? 'font-bold text-amber-300'
                      : 'font-semibold text-cyan-200'
                  }
                >
                  {t.capacityLabel}: {usedWeight}/{hero.memoryCapacity}
                </span>
                <button
                  type="button"
                  onClick={onOpenPool}
                  className="chrome-pill rounded-md px-2 py-0.5 text-[10px] font-bold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer"
                >
                  ▣ {t.inspectPool}
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 min-[500px]:grid-cols-2 sm:gap-3">
              {combat.rewardChipChoices.map((defId, idx) => {
                const def = SKILL_CHIPS_BY_ID[defId];
                if (!def) return null;
                const meta = t.equipment[def.id];
                const fitsEquip = usedWeight + def.memoryCost <= hero.memoryCapacity;
                return (
                  <button
                    key={defId}
                    type="button"
                    onClick={() => onClaimReward(defId)}
                    className="chrome-pill flex flex-col justify-between rounded-xl border-cyan-300/45 p-2.5 sm:p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#00F0FF] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="rounded bg-slate-900/90 border border-white/15 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-cyan-200 shrink-0">
                            [{idx + 1}]
                          </span>
                          <span className="font-display text-sm sm:text-base font-bold text-white truncate">
                            {meta?.name ?? def.id}
                          </span>
                        </div>
                        <span
                          className={`font-mono-tabular text-[11px] sm:text-xs font-bold shrink-0 ${
                            fitsEquip ? 'text-[#00F0FF]' : 'text-amber-300'
                          }`}
                        >
                          {t.sizeLabel}:{def.memoryCost}
                        </span>
                      </div>
                      <p className="mt-0.5 sm:mt-1 font-mono-tabular text-[10px] sm:text-xs text-slate-200">
                        <FormattedText text={meta?.desc ?? ''} />
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[10px] sm:text-[11px]">
                        {def.tiles.map((spec, tileIdx) => (
                          <span
                            key={`${defId}_loot_${tileIdx}`}
                            className={`font-bold ${
                              spec.type === 'attack'
                                ? 'text-rose-200'
                                : spec.type === 'defense'
                                  ? 'text-cyan-200'
                                  : 'text-amber-200'
                            }`}
                          >
                            {tileIdx > 0 ? '· ' : ''}
                            {formatTileShortLabel(spec, lang)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[12.5px] sm:text-[13px] font-bold">
                      <span className={fitsEquip ? 'text-[#00F0FF]' : 'text-amber-300'}>
                        {fitsEquip
                          ? `✓ ${lang === 'cs' ? 'Nainstalovat hned' : 'Auto-Install'}`
                          : `⬡ ${lang === 'cs' ? 'Do trezoru (plno)' : 'Send to Vault (Full)'}`}
                      </span>
                      <span className="text-slate-300">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 sm:mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => onClaimReward(null)}
            className="chrome-pill rounded-lg px-4 py-1.5 sm:px-5 sm:py-2.5 text-[13px] sm:text-sm font-bold text-white transition-colors hover:border-[#FFC700] cursor-pointer"
          >
            {combat.rewardChipChoices.length > 0 ? t.salvageForCredits : t.continueToMap}
          </button>
        </div>
      </div>
    </div>
  );
}
