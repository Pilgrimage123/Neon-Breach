import { useCallback, useEffect, useState } from 'react';
import { MAX_OVERCLOCK_STACKS } from '../engine/data';
import { computeMedBayHealAmount } from '../engine/dynastyClinicEngine';
import type { RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { MedBayOptionId } from '../utils/nurseSpriteSheet';
import { HeroPortraitCanvas } from './HeroPortraitCanvas';

export type MedBayActionType =
  | 'heal'
  | 'calibrate_max_hp'
  | 'salvage_credits'
  | 'tile_overclock'
  | 'hearth_grandparents'
  | 'hearth_spouse'
  | 'hearth_kids';

interface BioMedBayViewProps {
  run: RunState;
  lang: Language;
  modalOpen?: boolean;
  isCompactLandscape?: boolean;
  onAction: (action: MedBayActionType) => void;
}

export function BioMedBayView({
  run,
  lang,
  modalOpen = false,
  isCompactLandscape = false,
  onAction,
}: BioMedBayViewProps) {
  const t = TRANSLATIONS[lang];
  const charMeta = t.characters[run.hero.characterId ?? 'kira'];
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFundedClinic = currentNode?.modifier === 'funded_clinic';
  const hpRatio = Math.max(0, Math.min(1, run.hero.hp / Math.max(1, run.hero.maxHp)));
  const isHighHp = run.hero.hp >= Math.round(run.hero.maxHp * 0.75);
  const isCriticalHp = run.hero.hp <= Math.round(run.hero.maxHp * 0.5);
  const baseHealAmount = computeMedBayHealAmount(run.hero.maxHp);
  const totalHealAmount = baseHealAmount + (isFundedClinic ? 12 : 0);
  const healedHp = Math.min(run.hero.maxHp, run.hero.hp + totalHealAmount);
  const calibratedMaxHp = run.hero.maxHp + 10;
  const nanites = run.hero.nanites ?? 0;
  const overclockStacks = Math.min(MAX_OVERCLOCK_STACKS, Math.max(0, run.hero.overclockCount ?? 0));
  const overclockMaxed = overclockStacks >= MAX_OVERCLOCK_STACKS;

  const [focusedOption, setFocusedOption] = useState<MedBayOptionId | null>(null);

  const hearthQuote =
    focusedOption === 'heal'
      ? t.medbayNurseHoverHeal
      : focusedOption === 'calibrate_max_hp'
        ? t.medbayNurseHoverCalibrate
        : focusedOption === 'salvage_credits'
          ? t.medbayNurseHoverSalvage
          : focusedOption === 'tile_overclock'
            ? t.medbayNurseHoverOverclock
            : isCriticalHp
              ? t.medbayNurseIdleCritical
              : t.medbayNurseIdleNominal;

  const triggerAction = useCallback(
    (action: MedBayActionType) => {
      onAction(action);
    },
    [onAction],
  );

  useEffect(() => {
    if (modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') {
        e.preventDefault();
        triggerAction('heal');
      } else if (e.key === '2') {
        e.preventDefault();
        triggerAction('calibrate_max_hp');
      } else if (e.key === '3') {
        e.preventDefault();
        triggerAction('salvage_credits');
      } else if (e.key === '4' && !overclockMaxed) {
        e.preventDefault();
        triggerAction('tile_overclock');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, overclockMaxed, triggerAction]);

  return (
    <main
      className={`cyber-vista-bg relative flex flex-1 min-h-0 w-full flex-col items-center overflow-y-auto ${
        isCompactLandscape ? 'p-1.5' : 'p-2.5 sm:p-4 lg:p-6'
      }`}
    >
      <div
        className={`relative my-auto flex w-full max-w-[1620px] items-end justify-center ${
          isCompactLandscape
            ? 'flex-row gap-2'
            : 'flex-col lg:flex-row gap-4 lg:gap-5'
        }`}
      >
        {/* Warm Dawn-Gold Solar Hearth Showcase */}
        <div
          data-testid="family-hearth-showcase"
          className={`chrome-glass relative z-10 flex shrink-0 flex-col items-center justify-between rounded-2xl border border-amber-400/45 bg-gradient-to-b from-amber-950/45 via-slate-950/85 to-orange-950/40 shadow-[0_8px_32px_rgba(245,158,11,0.22)] ${
            isCompactLandscape
              ? 'w-44 p-2 gap-1.5'
              : 'w-full lg:w-64 p-3.5 sm:p-4 gap-2.5'
          }`}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2.2" aria-hidden="true">
                <path d="M12 3.5C15.5 8 18.5 11 18.5 14.5A6.5 6.5 0 0 1 5.5 14.5C5.5 11 8.5 8 12 3.5Z" />
              </svg>
              {lang === 'cs' ? 'Nový úsvit' : 'New Dawn'}
            </span>
            <span className="font-mono-tabular text-[11px] font-bold text-emerald-300">
              {Math.round(hpRatio * 100)}% HP
            </span>
          </div>

          <div
            className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-amber-300/35 bg-gradient-to-b from-amber-500/15 via-orange-950/35 to-slate-950/80 shadow-[inset_0_0_24px_rgba(251,191,36,0.18)] ${
              isCompactLandscape ? 'h-28 w-full' : 'h-40 sm:h-48 w-full'
            }`}
          >
            <HeroPortraitCanvas
              characterId={run.hero.characterId ?? 'kira'}
              active={true}
              variant="title"
              compact={isCompactLandscape}
            />
          </div>

          <div className="w-full text-center">
            <div className="font-display text-sm font-bold text-amber-200">
              {charMeta.name}
            </div>
            <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-orange-200/85">
              {t.medbayTitle}
            </div>
          </div>
        </div>

        {/* The Terminal Card Panel */}
        <div
          data-testid="medbay-terminal-panel"
          className={`chrome-glass relative z-10 flex-1 min-w-0 rounded-2xl border border-amber-400/35 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between ${
            isCompactLandscape
              ? 'p-2.5 gap-2 max-h-[360px]'
              : 'p-3.5 sm:p-5 gap-3'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/55 text-amber-200 font-mono-tabular text-xs font-bold uppercase tracking-wider">
                  {t.medbayTitle}
                </span>
                <h1
                  className={`chrome-text-shimmer font-display font-bold ${
                    isCompactLandscape ? 'text-sm sm:text-base' : 'text-base md:text-xl'
                  }`}
                >
                  {t.medbaySubtitle.replace('{name}', charMeta.name)}
                </h1>
                {isFundedClinic && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-lime-500/20 border border-lime-400/60 text-lime-300 font-mono-tabular text-[12px] font-bold uppercase tracking-wider">
                    {t.bountyFundedClinicBadge}
                  </span>
                )}
              </div>
              <span className="text-[13px] font-mono-tabular font-bold text-slate-200">
                ♥ {run.hero.hp}/{run.hero.maxHp} · ◈ {run.hero.credits} · 💎 {nanites}
              </span>
            </div>

            <div
              data-testid="family-hearth-dialogue"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-950/50 via-slate-900/80 to-orange-950/35 px-3 py-1.5 text-xs text-amber-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 font-mono-tabular text-[12px] font-bold uppercase tracking-wider text-amber-300">
                  [{lang === 'cs' ? 'Rodinný krb' : 'Family Hearth'}]:
                </span>
                <span className="truncate font-mono-tabular text-[12.5px] sm:text-[13px] text-slate-100">
                  “{hearthQuote}”
                </span>
              </div>
              <span className="shrink-0 font-mono-tabular text-[12px] font-bold text-emerald-300">
                {isFundedClinic
                  ? `✦ ${t.fundedClinicAllActionsNote}`
                  : isHighHp
                    ? `⚡ ${t.greedyClinicNotice}`
                    : isCriticalHp
                      ? `⚠ ${t.opportunityCostNotice}`
                      : ''}
              </span>
            </div>
          </div>

          {/* 4 Full-Card Clickable Procedure Cards */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 ${
              isCompactLandscape ? 'gap-2' : 'gap-2.5'
            }`}
          >
            {/* Option 1: Bio-Repair */}
            <button
              type="button"
              onMouseEnter={() => setFocusedOption('heal')}
              onMouseLeave={() => setFocusedOption(null)}
              onFocus={() => setFocusedOption('heal')}
              onBlur={() => setFocusedOption(null)}
              onClick={() => triggerAction('heal')}
              className={`chrome-pill group flex flex-col justify-between rounded-xl border-[#10F5A0]/50 text-left transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#10F5A0] ${
                      isCompactLandscape ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {t.medbayHealTitle}
                  </h2>
                  <span className="font-mono-tabular text-[12px] font-bold text-emerald-300/85">[1]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ♥ {run.hero.hp} → {healedHp} / {run.hero.maxHp}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-200">
                  {lang === 'cs'
                    ? `Okamžitě obnoví +${totalHealAmount} HP (35 % Max HP).`
                    : `Restore +${totalHealAmount} HP (35% Max HP) immediately.`}
                </p>
              </div>
              <span
                className={`mt-2 block w-full rounded-lg bg-gradient-to-r from-[#10F5A0] to-[#6EE7B7] text-center font-bold text-slate-950 shadow-[0_0_20px_rgba(16,245,160,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all group-hover:brightness-110 ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'
                }`}
              >
                {lang === 'cs' ? `Obnovit +${totalHealAmount} HP` : `Restore +${totalHealAmount} HP`}
              </span>
            </button>

            {/* Option 2: Chassis Reinforcement */}
            <button
              type="button"
              onMouseEnter={() => setFocusedOption('calibrate_max_hp')}
              onMouseLeave={() => setFocusedOption(null)}
              onFocus={() => setFocusedOption('calibrate_max_hp')}
              onBlur={() => setFocusedOption(null)}
              onClick={() => triggerAction('calibrate_max_hp')}
              className={`chrome-pill group flex flex-col justify-between rounded-xl border-[#00F0FF]/50 text-left transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#00F0FF] ${
                      isCompactLandscape ? 'text-xs' : 'text-[13px] sm:text-sm'
                    }`}
                  >
                    {t.medbayCalibrateTitle}
                  </h2>
                  <span className="font-mono-tabular text-[12px] font-bold text-cyan-300/85">[2]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ♥ {run.hero.maxHp} → {calibratedMaxHp} Max
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[12px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-200">
                  {t.medbayCalibrateDesc}
                </p>
              </div>
              <span
                className={`chrome-btn-primary mt-2 block w-full rounded-lg text-center font-bold transition-all ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'
                }`}
              >
                {t.applyCalibrate}
              </span>
            </button>

            {/* Option 3: Resource Salvage */}
            <button
              type="button"
              onMouseEnter={() => setFocusedOption('salvage_credits')}
              onMouseLeave={() => setFocusedOption(null)}
              onFocus={() => setFocusedOption('salvage_credits')}
              onBlur={() => setFocusedOption(null)}
              onClick={() => triggerAction('salvage_credits')}
              className={`chrome-pill group flex flex-col justify-between rounded-xl border-[#FFC700]/50 text-left transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#FFC700] ${
                      isCompactLandscape ? 'text-xs' : 'text-[13px] sm:text-sm'
                    }`}
                  >
                    {t.medbaySalvageTitle}
                  </h2>
                  <span className="font-mono-tabular text-[12px] font-bold text-amber-300/85">[3]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ◈ {run.hero.credits} → {run.hero.credits + 35} CR
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[12px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-200">
                  {t.medbaySalvageDesc}
                </p>
              </div>
              <span
                className={`mt-2 block w-full rounded-lg bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] text-center font-bold text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all group-hover:brightness-110 ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'
                }`}
              >
                {t.applySalvage}
              </span>
            </button>

            {/* Option 4: Neural Overclock & Tile Tuning */}
            <button
              type="button"
              disabled={overclockMaxed}
              onMouseEnter={() => setFocusedOption('tile_overclock')}
              onMouseLeave={() => setFocusedOption(null)}
              onFocus={() => setFocusedOption('tile_overclock')}
              onBlur={() => setFocusedOption(null)}
              onClick={() => triggerAction('tile_overclock')}
              className={`chrome-pill group flex flex-col justify-between rounded-xl border-fuchsia-500/50 bg-fuchsia-950/20 text-left transition-transform duration-150 hover:-translate-y-0.5 disabled:hover:translate-y-0 ${
                overclockMaxed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              } ${isCompactLandscape ? 'p-2' : 'p-3'}`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between gap-1.5">
                  <h2
                    className={`font-display font-bold text-fuchsia-300 ${
                      isCompactLandscape ? 'text-xs' : 'text-[13px] sm:text-sm'
                    }`}
                  >
                    {t.medbayOverclockTitle}
                  </h2>
                  <span className="font-mono-tabular text-[12px] font-bold text-fuchsia-200 border border-fuchsia-400/40 rounded px-1.5 py-0.5">
                    {overclockStacks}/{MAX_OVERCLOCK_STACKS} · [4]
                  </span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-[13px] font-black text-[#F4F4F6]">
                  {lang === 'cs' ? '⚔+1 (×2) · ⚡+20% OD · Čištění' : '⚔+1 (×2) · ⚡+20% OD · Cleanse'}
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[12px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-200">
                  {t.medbayOverclockDesc}
                </p>
              </div>
              <span
                className={`mt-2 block w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 text-center font-bold text-white shadow-[0_0_20px_rgba(217,70,239,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all group-hover:brightness-110 ${
                  overclockMaxed ? 'opacity-45' : ''
                } ${isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'}`}
              >
                {overclockMaxed ? (lang === 'cs' ? 'Max (2/2)' : 'Maxed (2/2)') : t.applyOverclock}
              </span>
            </button>
          </div>

          {/* Streamlined Single-Row Smart-Hearth Quick Bar */}
          <div
            data-testid="medbay-smart-hearth-panel"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-400/35 bg-slate-950/65 px-2.5 py-2"
          >
            <span className="font-mono-tabular text-[12px] font-bold uppercase tracking-wider text-amber-300 shrink-0 mr-1">
              🏡 {lang === 'cs' ? 'Rodinný krb:' : 'Hearth:'}
            </span>
            <button
              type="button"
              data-testid="hearth-grandparents-btn"
              onClick={() => triggerAction('hearth_grandparents')}
              className="chrome-pill flex-1 min-w-[175px] flex items-center justify-between gap-1.5 rounded-lg border border-amber-300/45 bg-amber-950/25 px-2.5 py-1.5 text-left hover:border-amber-300 cursor-pointer"
            >
              <span className="font-display text-[13px] font-bold text-amber-200 whitespace-nowrap">
                👵 {lang === 'cs' ? 'Prarodiče' : 'Grandparents'}
              </span>
              <span className="font-mono-tabular text-[12px] font-bold text-[#F4F4F6] truncate">
                {lang === 'cs' ? 'Slepý→★ · 💚+10 HP' : 'Dud→★ · 💚+10 HP'}
              </span>
            </button>

            <button
              type="button"
              data-testid="hearth-spouse-btn"
              onClick={() => triggerAction('hearth_spouse')}
              className="chrome-pill flex-1 min-w-[175px] flex items-center justify-between gap-1.5 rounded-lg border border-cyan-300/45 bg-cyan-950/25 px-2.5 py-1.5 text-left hover:border-cyan-300 cursor-pointer"
            >
              <span className="font-display text-[13px] font-bold text-cyan-200 whitespace-nowrap">
                💍 {lang === 'cs' ? 'Partner' : 'Spouse'}
              </span>
              <span className="font-mono-tabular text-[12px] font-bold text-[#F4F4F6] truncate">
                {lang === 'cs' ? 'ATK×DEF +2 · 💚+14 HP' : 'ATK×DEF +2 · 💚+14 HP'}
              </span>
            </button>

            <button
              type="button"
              data-testid="hearth-kids-btn"
              onClick={() => triggerAction('hearth_kids')}
              className="chrome-pill flex-1 min-w-[175px] flex items-center justify-between gap-1.5 rounded-lg border border-emerald-300/45 bg-emerald-950/25 px-2.5 py-1.5 text-left hover:border-emerald-300 cursor-pointer"
            >
              <span className="font-display text-[13px] font-bold text-emerald-200 whitespace-nowrap">
                🧒 {lang === 'cs' ? 'Děti' : 'The Kids'}
              </span>
              <span className="font-mono-tabular text-[12px] font-bold text-[#F4F4F6] truncate">
                💚+12 HP · ⚡+15% OD
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
