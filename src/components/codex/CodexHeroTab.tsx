import { useMemo } from 'react';
import { getHeroCodexProfile } from '../../engine/codexData';
import type { CharacterId, TileSpec } from '../../engine/types';
import { CODEX_TRANSLATIONS } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { formatTileDetailText, formatTileShortLabel } from '../../utils/tileDisplay';
import { TileGlyph } from '../TileGlyph';

function TileSpecRow({
  spec,
  lang,
}: {
  spec: TileSpec;
  lang: Language;
}) {
  const shortLabel = formatTileShortLabel(spec, lang);
  const detailText = formatTileDetailText(spec, lang);
  const typeTone =
    spec.type === 'attack'
      ? 'border-[#FF2E7E]/45 bg-[#2A0E24]/80 text-rose-100'
      : spec.type === 'defense'
        ? 'border-[#00F0FF]/45 bg-[#0A223B]/80 text-cyan-100'
        : 'border-[#FFC700]/45 bg-[#291E08]/80 text-amber-100';

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${typeTone}`}
    >
      <TileGlyph type={spec.type} size={16} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-mono-tabular text-[13px] font-bold text-white leading-tight">
          {shortLabel}
        </div>
        <div className="text-[12px] leading-snug text-slate-200 truncate" title={detailText}>
          {detailText}
        </div>
      </div>
    </div>
  );
}

export interface CodexHeroTabProps {
  selectedHero: CharacterId;
  lang: Language;
}

export function CodexHeroTab({ selectedHero, lang }: CodexHeroTabProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const heroProfile = useMemo(() => getHeroCodexProfile(selectedHero), [selectedHero]);
  const heroMeta = t.characters[selectedHero];
  const heroCodex = codexT.heroes[selectedHero];

  const heroAccentText =
    selectedHero === 'auraline'
      ? 'text-[#FFC700]'
      : selectedHero === 'zuri'
        ? 'text-[#34D399]'
        : 'text-[#00F0FF]';

  const heroAccentBorder =
    selectedHero === 'auraline'
      ? 'border-[#FFC700]/65'
      : selectedHero === 'zuri'
        ? 'border-[#10B981]/65'
        : 'border-[#00F0FF]/65';

  return (
    <div
      data-testid={`codex-hero-panel-${selectedHero}`}
      className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
    >
      <div className="space-y-3">
        <section className={`chrome-pill rounded-xl p-3.5 ${heroAccentBorder}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={`font-display text-base sm:text-lg font-bold ${heroAccentText}`}>
              {heroMeta.code} · {heroMeta.name}
            </h3>
            <span className="text-[13px] font-semibold text-slate-200">
              {heroMeta.title} · {heroCodex.roleTag}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-100">
            {heroCodex.playstyleLead}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/12 bg-slate-950/65 px-2.5 py-1.5">
              <div className="text-[12px] font-semibold text-slate-300">
                {codexT.baseStatsLabels.hp}
              </div>
              <div className="font-mono-tabular text-sm font-bold text-rose-200">
                {heroProfile.spec.maxHp}
              </div>
            </div>
            <div className="rounded-lg border border-white/12 bg-slate-950/65 px-2.5 py-1.5">
              <div className="text-[12px] font-semibold text-slate-300">
                {codexT.baseStatsLabels.credits}
              </div>
              <div className="font-mono-tabular text-sm font-bold text-[#FFC700]">
                {heroProfile.spec.startingCredits} {t.creditsLabel}
              </div>
            </div>
            <div className="rounded-lg border border-white/12 bg-slate-950/65 px-2.5 py-1.5">
              <div className="text-[12px] font-semibold text-slate-300">
                {codexT.baseStatsLabels.capacity}
              </div>
              <div className="font-mono-tabular text-sm font-bold text-[#00F0FF]">
                {heroProfile.startingMemory}/{heroProfile.spec.memoryCapacity}
              </div>
            </div>
            <div className="rounded-lg border border-white/12 bg-slate-950/65 px-2.5 py-1.5">
              <div className="text-[12px] font-semibold text-slate-300">
                {codexT.baseStatsLabels.startingPool}
              </div>
              <div className="font-mono-tabular text-[13px] font-bold text-white leading-5">
                {heroProfile.startingPoolCounts.attack}A · {heroProfile.startingPoolCounts.defense}D · {heroProfile.startingPoolCounts.tech}T
              </div>
            </div>
          </div>
        </section>

        <section className="chrome-pill rounded-xl p-3.5">
          <h4 className="font-display text-[13px] sm:text-sm font-bold uppercase tracking-wider text-cyan-200">
            {codexT.passivePowersHeader}
          </h4>
          <div className="mt-2.5 space-y-2.5">
            {heroCodex.passivePowers.map((power) => (
              <div
                key={power.name}
                className="rounded-lg border border-white/12 bg-slate-950/65 p-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-[13px] sm:text-sm font-bold text-white">
                    {power.name}
                  </span>
                  <span className={`font-mono-tabular text-[12.5px] font-bold ${heroAccentText}`}>
                    {power.badge}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-200">
                  {power.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="chrome-pill rounded-xl border-[#FFC700]/45 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-[13px] sm:text-sm font-bold uppercase tracking-wider text-[#FFC700]">
              {codexT.overdriveHeader} · {heroMeta.overdriveName}
            </h4>
            <span className="font-mono-tabular text-[12.5px] font-bold text-emerald-300">
              {codexT.freeActionBadge}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-100">
            {heroCodex.overdriveRule}
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-amber-100">
            {heroCodex.overdriveBreakdown.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden="true" className="font-mono-tabular font-bold text-[#FFC700]">
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-3">
        <section className="chrome-pill rounded-xl p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-display text-[13px] sm:text-sm font-bold uppercase tracking-wider text-white">
              {codexT.innateCoreHeader}
            </h4>
            <span className="font-mono-tabular text-[12.5px] text-slate-300">
              {heroProfile.innateTiles.length} {t.poolTotalLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate-300">{codexT.innateCoreDesc}</p>
          <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {heroProfile.innateTiles.map((spec, idx) => (
              <TileSpecRow key={`innate_${idx}`} spec={spec} lang={lang} />
            ))}
          </div>
        </section>

        <section className="chrome-pill rounded-xl p-3.5">
          <h4 className="font-display text-[13px] sm:text-sm font-bold uppercase tracking-wider text-white">
            {codexT.startingGearHeader}
          </h4>
          <div className="mt-2 space-y-2">
            {heroProfile.startingChips.map((def) => {
              const eqMeta = t.equipment[def.id];
              return (
                <div
                  key={def.id}
                  className="rounded-lg border border-white/12 bg-slate-950/65 p-2.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-[13px] sm:text-sm font-bold text-cyan-200">
                      {eqMeta?.name ?? def.id}
                    </span>
                    <span className="font-mono-tabular text-[12.5px] font-semibold text-slate-300">
                      {t.sizeLabel} {def.memoryCost}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-slate-200">
                    {eqMeta?.desc ?? ''}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {def.tiles.map((spec, idx) => (
                      <TileSpecRow key={`${def.id}_${idx}`} spec={spec} lang={lang} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="chrome-pill rounded-xl p-3.5 space-y-2.5">
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-emerald-300">
              {codexT.synergiesHeader}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">
              {heroCodex.synergies}
            </p>
          </div>
          <div className="border-t border-white/10 pt-2.5">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-cyan-200">
              {codexT.tacticalLoopHeader}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">
              {heroCodex.tacticalLoop}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
