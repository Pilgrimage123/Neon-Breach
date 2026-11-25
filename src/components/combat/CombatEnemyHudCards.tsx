import type { Dispatch, SetStateAction } from 'react';
import { getEnemySlotSpan } from '../../engine/reinforcementDirector';
import type {
  CombatState,
  PendingReinforcement,
  TurnPreview,
} from '../../engine/types';
import type { Language, TranslationPack } from '../../i18n/translations';
import { getEnemyRolePip } from '../../utils/accessibilityAndScale';
import { formatQuantizedScale } from '../../utils/tacticalSandboxAndHints';
import {
  ArmorCrestIcon,
  IntentIcon,
  OverwhelmBadge,
  PassiveTraitIcon,
  PierceBadgeIcon,
  ShatterIcon,
  ShieldPipIcon,
} from './CombatIcons';
import {
  formatEnemyIntentCompact,
  formatEnemyIntentSummary,
} from './combatEnemyUi';
import {
  FALLBACK_INTENT,
  type SequentialEnemyHudState,
  formatDropReasonLabel,
} from './combatHudState';

export interface CombatEnemyHudCardsProps {
  combat: CombatState;
  pendingDrops: readonly PendingReinforcement[];
  sequentialHudStates: readonly SequentialEnemyHudState[];
  activePreview: TurnPreview | null;
  lang: Language;
  t: TranslationPack;
  isCompactLandscape: boolean;
  hasDenseEnemyRow: boolean;
  hasUltraDenseEnemyRow: boolean;
  hcBorderClass: string;
  quantizedScaleMode: boolean;
  revealDropArchetype: boolean;
  revealEnemyFutureCycle?: boolean;
  inspectedTarget: 'hero' | string | null;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  setHoveredEnemyId: Dispatch<SetStateAction<string | null>>;
}

export function CombatEnemyHudCards({
  combat,
  pendingDrops,
  sequentialHudStates,
  lang,
  t,
  isCompactLandscape,
  hasDenseEnemyRow,
  hasUltraDenseEnemyRow,
  hcBorderClass,
  quantizedScaleMode,
  revealDropArchetype,
  revealEnemyFutureCycle = true,
  inspectedTarget,
  setInspectedTarget,
  setHoveredEnemyId,
}: CombatEnemyHudCardsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-1 sm:gap-1.5 min-w-0">
      {combat.enemies.map((enemy, idx) => {
        const isDead = enemy.hp <= 0;
        const hudState = sequentialHudStates[idx];
        const intent =
          hudState?.intent ??
          enemy.intentCycle[enemy.currentIntentIndex] ??
          enemy.intentCycle[0] ??
          FALLBACK_INTENT;
        const enemyMeta = t.enemies[enemy.archetype];
        const enrageBonus = enemy.enrageAtkBonus ?? 0;
        const safeEnemyMaxHp = Math.max(1, enemy.maxHp);
        const hpPct = Math.max(0, Math.round((enemy.hp / safeEnemyMaxHp) * 100));
        const armorPreview = hudState.armorPreview;
        const {
          rawPreviewDmg,
          willBreakArmor,
          armorAbsorbed,
          remainingArmor,
          previewHpLoss,
          projectedHp,
          willDie,
          willCrackShieldPip,
          remainingShieldPips,
          willTriggerPhaseGate,
          chainedBurstDmg,
          willStagger,
          isStaggerable,
          staggerProgress = 0,
        } = armorPreview;
        const conditionActive = hudState.conditionActive;
        const intentOptions = {
          staggered: enemy.staggered,
          conditionActive,
          sleepCounter: enemy.sleepCounter,
          isLootRunner: enemy.isLootRunner,
          escapeTurnsLeft: enemy.escapeTurnsLeft,
          propKind: enemy.propKind,
          reviveTimer: enemy.reviveTimer,
        };
        const cycleLen = Math.max(1, enemy.intentCycle.length);
        const nextIntent =
          enemy.intentCycle.length > 1
            ? enemy.intentCycle[(enemy.currentIntentIndex + 1) % cycleLen]
            : null;
        const intentTooltip = formatEnemyIntentSummary(intent, lang, enrageBonus, intentOptions);
        const hasVisiblePassive =
          enemy.passive === 'volatile_burst' || enemy.passive === 'phase_gate';
        const passiveTooltip = hasVisiblePassive ? t.enemyPassives[enemy.passive].rule.replace(/\*\*/g, '') : '';
        const chargeTurnsTotal = intent.kind === 'charge' ? 2 : 0;
        const chargeTurnsLeft = intent.kind === 'charge' ? (intent.secondaryValue ?? 1) : 0;
        const remainingHpPct = Math.max(0, Math.round((projectedHp / safeEnemyMaxHp) * 100));
        const dmgBarPct = Math.max(0, hpPct - remainingHpPct);
        const hasArmor = !isDead && enemy.armor > 0;
        const hasShieldPips = !isDead && enemy.shieldPips > 0;
        const armorScaleMax = Math.max(enemy.armor, 10);
        const armorBarPct = hasArmor
          ? Math.max(20, Math.min(100, Math.round((enemy.armor / armorScaleMax) * 100)))
          : 0;
        const remainingArmorBarPct =
          hasArmor && !willBreakArmor
            ? Math.round(armorBarPct * (remainingArmor / Math.max(1, enemy.armor)))
            : 0;

        const rolePip = getEnemyRolePip(enemy.archetype);

        return (
          <button
            key={enemy.id}
            type="button"
            data-testid={`enemy-pod-${enemy.id}`}
            data-preview-dmg={rawPreviewDmg}
            data-preview-lethal={willDie ? 'true' : 'false'}
            onMouseEnter={() => !isDead && setHoveredEnemyId(enemy.id)}
            onMouseLeave={() => setHoveredEnemyId((prev) => (prev === enemy.id ? null : prev))}
            onClick={() =>
              setInspectedTarget((prev) => (prev === enemy.id ? null : enemy.id))
            }
            aria-expanded={inspectedTarget === enemy.id}
            aria-label={`${rolePip.symbol} ${enemyMeta.name} ${enemy.hp}/${enemy.maxHp} ${t.hpLabel}${
              hasArmor ? ` ${enemy.armor} ${t.armorLabel}` : ''
            } ${formatEnemyIntentCompact(intent, lang, enrageBonus, intentOptions)}`}
            className={`relative pointer-events-auto text-left rounded-lg transition-all duration-200 cursor-pointer ${!isDead ? hcBorderClass : ''} ${
              isCompactLandscape
                ? hasUltraDenseEnemyRow
                  ? 'w-[96px] sm:w-[116px] lg:w-[132px] xl:w-[148px] px-1 py-0.5'
                  : hasDenseEnemyRow
                    ? 'w-[114px] sm:w-[144px] lg:w-48 px-1.5 py-1'
                    : 'w-[130px] sm:w-[162px] lg:w-52 px-2 py-1'
                : hasUltraDenseEnemyRow
                  ? 'w-[96px] sm:w-[118px] lg:w-[136px] xl:w-[148px] px-1.5 py-1'
                  : hasDenseEnemyRow
                    ? 'w-[112px] sm:w-40 lg:w-44 xl:w-48 px-1.5 py-1 sm:px-2 sm:py-1.5'
                    : getEnemySlotSpan(enemy.archetype) > 1
                      ? 'w-[168px] sm:w-48 lg:w-56 px-2 py-1 sm:px-2.5 sm:py-1.5'
                      : 'w-[126px] sm:w-44 lg:w-52 px-2 py-1 sm:px-2.5 sm:py-1.5'
            } ${
              isDead
                ? 'border border-white/10 bg-slate-950/55 opacity-35'
                : willDie
                  ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)]'
                  : rawPreviewDmg > 0
                    ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)]'
                    : hasArmor
                      ? 'chrome-pill border-[#FFC700]/65 shadow-[0_0_12px_rgba(255,199,0,0.18)]'
                      : 'chrome-pill border-cyan-200/35'
            } ${inspectedTarget === enemy.id && !isDead ? 'ring-1 ring-[#00F0FF]' : ''}`}
          >
            <div className="flex items-center justify-between gap-1 text-[11.5px] sm:text-[13px]">
              <span className="flex items-center gap-1 font-display font-bold text-white truncate">
                <span
                  data-testid={`enemy-role-pip-${enemy.id}`}
                  style={{ backgroundColor: rolePip.accentHex, color: '#020617' }}
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white font-mono-tabular text-[10px] font-black leading-none"
                >
                  {rolePip.symbol}
                </span>
                <span className="truncate">{enemyMeta.name}</span>
                {getEnemySlotSpan(enemy.archetype) > 1 && (
                  <span
                    data-testid={`enemy-two-slot-${enemy.id}`}
                    className="shrink-0 rounded bg-amber-400/20 px-1 text-[10px] font-mono-tabular font-extrabold text-amber-200 ring-1 ring-amber-400/40"
                  >
                    {getEnemySlotSpan(enemy.archetype)}×
                  </span>
                )}
              </span>
              <div className="flex items-center gap-0.5 font-mono-tabular font-bold shrink-0">
                {hasShieldPips && (
                  <span
                    data-testid={`enemy-pip-badge-${enemy.id}`}
                    className="mr-0.5 inline-flex items-center"
                    title={t.pipLabel}
                  >
                    <ShieldPipIcon size={11} cracked={willCrackShieldPip} />
                  </span>
                )}
                {rawPreviewDmg > 0 && !isDead && previewHpLoss > 0 ? (
                  <>
                    <span className="text-rose-200/80">{enemy.hp}</span>
                    <span className="text-amber-300">→</span>
                    <span className={willDie ? 'text-[#FF2E7E] font-extrabold' : 'text-[#FFC700]'}>
                      {projectedHp}
                    </span>
                  </>
                ) : (
                  <span className="text-rose-200">
                    {enemy.hp}/{enemy.maxHp}
                  </span>
                )}
                {quantizedScaleMode && !isDead && (
                  <span
                    data-testid={`enemy-quantized-scale-${enemy.id}`}
                    className="ml-0.5 rounded bg-slate-950/90 px-1 text-[10px] font-extrabold text-[#FFC700]"
                  >
                    {formatQuantizedScale(projectedHp).compactLabel}
                  </span>
                )}
              </div>
            </div>

            {hasArmor && (
              <div
                data-testid={`enemy-armor-display-${enemy.id}`}
                className="mt-1 flex items-center gap-1.5"
              >
                <div className="flex items-center gap-0.5 shrink-0 font-mono-tabular text-[12px] font-extrabold leading-none">
                  <ArmorCrestIcon size={12} broken={willBreakArmor} />
                  <span
                    className={
                      willBreakArmor
                        ? 'text-[#FF2E7E] line-through'
                        : armorAbsorbed > 0
                          ? 'text-amber-200'
                          : 'text-[#FFC700]'
                    }
                  >
                    {willBreakArmor
                      ? `${enemy.armor}→0`
                      : armorAbsorbed > 0
                        ? `${enemy.armor}→${remainingArmor}`
                        : enemy.armor}
                  </span>
                </div>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950/95 ring-1 ring-[#FFC700]/40">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D97706] via-[#FFC700] to-[#FEF08A] transition-all duration-150"
                    style={{
                      width: `${rawPreviewDmg > 0 ? remainingArmorBarPct : armorBarPct}%`,
                    }}
                  />
                  {rawPreviewDmg > 0 && armorBarPct > remainingArmorBarPct && (
                    <div
                      className={`absolute inset-y-0 transition-all duration-150 ${
                        willBreakArmor ? 'bg-[#FF2E7E] animate-pulse' : 'bg-white/85 animate-pulse'
                      }`}
                      style={{
                        left: `${remainingArmorBarPct}%`,
                        width: `${armorBarPct - remainingArmorBarPct}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <div
              className={`relative mt-1 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
                willDie
                  ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
                  : rawPreviewDmg > 0
                    ? 'ring-1 ring-[#FFC700]/60'
                    : ''
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
                style={{ width: `${rawPreviewDmg > 0 ? remainingHpPct : hpPct}%` }}
              />
              {dmgBarPct > 0 && !isDead && (
                <div
                  data-testid={`enemy-lifebar-preview-${enemy.id}`}
                  className={`absolute inset-y-0 transition-all duration-150 ${
                    willDie
                      ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                      : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
                  }`}
                  style={{
                    left: `${remainingHpPct}%`,
                    width: `${dmgBarPct}%`,
                  }}
                />
              )}
              {enemy.phaseGatePct && !enemy.phaseGateTriggered && !isDead && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-lime-300 shadow-[0_0_4px_#A3E635]"
                  style={{ left: `${enemy.phaseGatePct}%` }}
                />
              )}
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] sm:text-[12px] font-mono-tabular">
              {!isDead ? (
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    title={intentTooltip}
                    className={`flex items-center gap-1 font-bold truncate ${
                      enemy.staggered
                        ? 'text-cyan-300'
                        : intent.kind === 'pause'
                          ? 'text-slate-400'
                          : intent.kind === 'cloak'
                            ? 'text-cyan-200'
                            : intent.pierceShield || intent.overwhelmMultiplier
                              ? 'text-[#FF85B3]'
                              : 'text-lime-300'
                    }`}
                  >
                    <IntentIcon kind={intent.kind} size={13} />
                    <span className="truncate">
                      {formatEnemyIntentCompact(intent, lang, enrageBonus, intentOptions)}
                    </span>
                    {intent.pierceShield && !enemy.staggered && (
                      <PierceBadgeIcon size={11} className="shrink-0" />
                    )}
                    {intent.overwhelmMultiplier && !enemy.staggered && (
                      <OverwhelmBadge multiplier={intent.overwhelmMultiplier} />
                    )}
                  </span>
                  {chargeTurnsTotal > 0 && !enemy.staggered && (
                    <span
                      className="inline-flex items-center gap-0.5 shrink-0"
                      aria-label={`Charge ${chargeTurnsLeft}`}
                    >
                      {Array.from({ length: chargeTurnsTotal }).map((_, pipIdx) => (
                        <span
                          key={pipIdx}
                          className={`h-1.5 w-1.5 rounded-full ${
                            pipIdx < chargeTurnsTotal - chargeTurnsLeft + 1
                              ? 'bg-[#FB923C] shadow-[0_0_4px_#FB923C]'
                              : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </span>
                  )}
                  {nextIntent && (
                    <span
                      className="inline-flex items-center gap-0.5 opacity-55 shrink-0"
                      title={
                        revealEnemyFutureCycle
                          ? formatEnemyIntentSummary(nextIntent, lang, enrageBonus)
                          : '???'
                      }
                    >
                      <span className="text-[10px] text-slate-400">›</span>
                      {revealEnemyFutureCycle ? (
                        <IntentIcon kind={nextIntent.kind} size={10} />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">?</span>
                      )}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">☠</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {!isDead && hasVisiblePassive && (
                  <span
                    data-testid={`enemy-passive-icon-${enemy.id}`}
                    title={passiveTooltip}
                    className="inline-flex items-center"
                  >
                    <PassiveTraitIcon
                      passive={enemy.passive as 'volatile_burst' | 'phase_gate'}
                      size={12}
                    />
                  </span>
                )}
                {!isDead && (enemy.cloakedTurns ?? 0) > 0 && (
                  <span
                    data-testid={`enemy-cloaked-${enemy.id}`}
                    title={
                      lang === 'cs'
                        ? 'Neviditelná: bere jen 10 % DMG, 90 % projde za ni'
                        : 'Cloaked: takes 10% DMG, 90% passes behind'
                    }
                    className="inline-flex items-center gap-0.5 rounded bg-cyan-500/20 px-1 py-0.5 text-[10px] font-extrabold text-cyan-200 ring-1 ring-cyan-300/60"
                  >
                    <IntentIcon kind="cloak" size={10} />
                    <span>10%</span>
                  </span>
                )}
                {!isDead &&
                  (enemy.staggered ? (
                    <span
                      data-testid={`enemy-staggered-${enemy.id}`}
                      title={t.staggeredTag}
                      className="inline-flex items-center rounded bg-cyan-500/25 px-1 py-0.5"
                    >
                      <ShatterIcon size={11} active />
                    </span>
                  ) : enemy.isMercyTarget ? (
                    <span
                      data-testid={`enemy-mercy-${enemy.id}`}
                      className="rounded bg-emerald-500/30 px-1 text-[10px] font-extrabold text-emerald-200"
                    >
                      🕊
                    </span>
                  ) : enemy.sosCharging ? (
                    <span
                      title={t.sosFlareBadgeLabel}
                      className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1 py-0.5"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/40" />
                    </span>
                  ) : enrageBonus > 0 ? (
                    <span className="rounded bg-rose-500/25 px-1 text-[10px] font-extrabold text-rose-200">
                      +{enrageBonus}
                    </span>
                  ) : null)}
                {hasShieldPips && (
                  <span className="shrink-0 text-[10px] sm:text-[11px] font-bold tabular-nums text-sky-300">
                    {willCrackShieldPip ? `${enemy.shieldPips}→${remainingShieldPips}` : enemy.shieldPips}
                  </span>
                )}
              </div>
            </div>

            {isStaggerable && !isDead && rawPreviewDmg > 0 && (
              <div
                data-testid={`enemy-stagger-meter-${enemy.id}`}
                className="mt-0.5 flex items-center gap-1"
                title={t.staggerPreviewLabel}
              >
                <ShatterIcon size={10} active={Boolean(willStagger)} />
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={`h-full transition-all duration-150 ${
                      willStagger ? 'bg-[#00F0FF] animate-pulse' : 'bg-cyan-400/70'
                    }`}
                    style={{ width: `${Math.round(staggerProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {rawPreviewDmg > 0 && !isDead && (
              <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[11px] sm:text-[12px] font-bold">
                <span
                  className={
                    willDie
                      ? 'text-[#FF2E7E]'
                      : willCrackShieldPip && previewHpLoss === 0
                        ? 'text-sky-300'
                        : 'text-[#FFC700]'
                  }
                >
                  {willCrackShieldPip && previewHpLoss === 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <ShieldPipIcon size={11} cracked />
                      <span>-1</span>
                    </span>
                  ) : armorAbsorbed > 0 && previewHpLoss === 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <ArmorCrestIcon size={11} broken={willBreakArmor} />
                      <span>-{armorAbsorbed}</span>
                    </span>
                  ) : (
                    <span>
                      -{previewHpLoss}
                      {armorAbsorbed > 0 && !willBreakArmor ? ` (-${armorAbsorbed})` : ''}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {willDie ? (
                    <span className="rounded bg-[#FF2E7E] px-1 text-[10px] font-extrabold text-white">
                      ☠
                    </span>
                  ) : willStagger ? (
                    <span
                      data-testid={`enemy-will-stagger-${enemy.id}`}
                      className="inline-flex items-center rounded bg-cyan-500/30 px-1 py-0.5 animate-pulse"
                    >
                      <ShatterIcon size={11} active />
                    </span>
                  ) : willTriggerPhaseGate ? (
                    <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold text-lime-300">
                      50%
                    </span>
                  ) : willBreakArmor ? (
                    <ArmorCrestIcon size={12} broken />
                  ) : chainedBurstDmg > 0 ? (
                    <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold text-lime-300">
                      💥-{chainedBurstDmg}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </button>
        );
      })}

      {pendingDrops.map((drop) => {
        const dropMeta = t.enemies[drop.archetype];
        const dropName = revealDropArchetype ? dropMeta.name : '???';
        const isUrgent = drop.turnsUntilDrop <= 1;
        const dropInspectKey = `drop:${drop.id}`;
        return (
          <button
            key={drop.id}
            type="button"
            data-testid={`pending-drop-pod-${drop.id}`}
            onClick={() =>
              setInspectedTarget((prev) => (prev === dropInspectKey ? null : dropInspectKey))
            }
            aria-expanded={inspectedTarget === dropInspectKey}
            aria-label={`${t.inboundDropLabel}: ${dropName} T-${drop.turnsUntilDrop} (${t.dropZeroDmgRule})`}
            className={`pointer-events-auto text-left rounded-lg border border-dashed transition-all duration-200 cursor-pointer bg-[#071127]/90 ${
              isCompactLandscape
                ? 'w-[116px] sm:w-[144px] px-1.5 py-1'
                : hasDenseEnemyRow
                  ? 'w-[112px] sm:w-36 lg:w-40 xl:w-44 px-1.5 py-1 sm:px-2 sm:py-1.5'
                  : 'w-[114px] sm:w-40 lg:w-44 px-1.5 py-1 sm:px-2 sm:py-1.5'
            } ${
              isUrgent
                ? 'border-[#FFC700]/85 shadow-[0_0_12px_rgba(255,199,0,0.3)]'
                : 'border-cyan-300/75 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
            } ${inspectedTarget === dropInspectKey ? 'ring-1 ring-[#00F0FF]' : ''}`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] sm:text-[12px]">
              <span className="font-display font-bold text-cyan-100 truncate">
                {dropName}
              </span>
              <span
                className={`shrink-0 rounded px-1 py-0.5 font-mono-tabular text-[11px] font-extrabold ${
                  isUrgent
                    ? 'bg-[#FFC700] text-slate-950'
                    : 'bg-[#00F0FF]/20 text-[#00F0FF]'
                }`}
              >
                T-{drop.turnsUntilDrop}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[10px] sm:text-[11px]">
              <span className="font-bold uppercase tracking-wider text-amber-200 truncate">
                {formatDropReasonLabel(drop.reason, t)}
              </span>
              {drop.isZeroReward && (
                <span className="shrink-0 text-slate-400">{t.zeroRewardBadgeLabel}</span>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono-tabular text-[10px] text-cyan-200/90">
              {t.dropZeroDmgRule}
            </div>
          </button>
        );
      })}
    </div>
  );
}
