import { useEffect, useMemo, useRef } from 'react';
import {
  filterGlossaryTerms,
  type GlossaryTermMeta,
} from '../../engine/codexData';
import {
  CODEX_TRANSLATIONS,
  type GlossaryCategory,
  type GlossaryTermId,
} from '../../i18n/codexTranslations';
import type { Language } from '../../i18n/translations';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from '../combat/CombatIcons';
import { TileGlyph } from '../TileGlyph';

const GLOSSARY_CATEGORIES: readonly GlossaryCategory[] = [
  'all',
  'defense',
  'offense',
  'board',
  'status',
];

function GlossaryEntryIcon({ id }: { id: GlossaryTermId }) {
  switch (id) {
    case 'armor':
      return <ArmorCrestIcon size={18} />;
    case 'armor_shred':
      return <ArmorCrestIcon size={18} broken />;
    case 'armor_pierce':
      return <TileGlyph type="attack" size={18} />;
    case 'shield':
      return <TileGlyph type="defense" size={18} />;
    case 'aegis_pip':
      return <ShieldPipIcon size={18} />;
    case 'phase_lock':
      return <ShieldPipIcon size={18} cracked />;
    case 'dmg_boost':
    case 'stack_surge':
    case 'overdrive':
    case 'tile_pool':
    case 'held_tiles':
      return <TileGlyph type="tech" size={18} />;
    case 'cleave':
      return <IntentIcon kind="heavy" size={18} />;
    case 'riposte':
      return <TileGlyph type="defense" size={18} />;
    case 'corrode':
    case 'jammed_tile':
      return <IntentIcon kind="acid" size={18} />;
    case 'spike_retaliate':
      return <IntentIcon kind="attack" size={18} />;
    case 'volatile_burst':
      return <IntentIcon kind="leech" size={18} />;
    case 'thermal_charge':
      return <IntentIcon kind="charge" size={18} />;
    default:
      return <TileGlyph type="tech" size={18} />;
  }
}

export interface CodexGlossaryTabProps {
  lang: Language;
  searchQuery: string;
  category: GlossaryCategory;
  focusedTermId: GlossaryTermId | null;
  onChangeSearch: (query: string) => void;
  onChangeCategory: (cat: GlossaryCategory) => void;
  onClearSearch: () => void;
  onJumpToTerm: (termId: GlossaryTermId) => void;
}

export function CodexGlossaryTab({
  lang,
  searchQuery,
  category,
  focusedTermId,
  onChangeSearch,
  onChangeCategory,
  onClearSearch,
  onJumpToTerm,
}: CodexGlossaryTabProps) {
  const codexT = CODEX_TRANSLATIONS[lang];
  const termRefs = useRef<Partial<Record<GlossaryTermId, HTMLDivElement | null>>>({});

  const filteredTerms: GlossaryTermMeta[] = useMemo(
    () => filterGlossaryTerms(searchQuery, category, lang),
    [searchQuery, category, lang],
  );

  useEffect(() => {
    if (focusedTermId) {
      const targetEl = termRefs.current[focusedTermId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedTermId]);

  return (
    <div data-testid="codex-glossary-panel" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-0">
          <input
            type="search"
            data-testid="codex-glossary-search"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={codexT.searchPlaceholder}
            aria-label={codexT.searchPlaceholder}
            className="w-full rounded-xl border border-white/20 bg-slate-950/75 px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:border-[#00F0FF] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {GLOSSARY_CATEGORIES.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                type="button"
                data-testid={`codex-category-${cat}`}
                onClick={() => onChangeCategory(cat)}
                className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-[#00F0FF] bg-cyan-950/60 text-[#00F0FF]'
                    : 'border-white/15 bg-slate-950/60 text-slate-300 hover:border-white/35 hover:text-white'
                }`}
              >
                {codexT.categories[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {filteredTerms.length === 0 ? (
        <div className="chrome-pill flex flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-200">{codexT.noSearchResults}</p>
          <button
            type="button"
            onClick={onClearSearch}
            className="chrome-pill rounded-lg px-3 py-1.5 text-xs font-bold text-[#00F0FF] hover:border-cyan-300 cursor-pointer"
          >
            {codexT.clearSearch}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredTerms.map((meta) => {
            const entry = codexT.glossary[meta.id];
            const isFocused = focusedTermId === meta.id;
            const accentTitle =
              meta.accent === 'gold'
                ? 'text-[#FFC700]'
                : meta.accent === 'rose'
                  ? 'text-rose-200'
                  : meta.accent === 'lime'
                    ? 'text-lime-300'
                    : 'text-[#00F0FF]';

            return (
              <div
                key={meta.id}
                ref={(el) => {
                  termRefs.current[meta.id] = el;
                }}
                data-testid={`glossary-term-${meta.id}`}
                className={`chrome-pill flex flex-col justify-between rounded-xl p-3.5 transition-all ${
                  isFocused
                    ? 'border-[#FFC700] ring-2 ring-[#FFC700]/75 shadow-[0_0_24px_rgba(255,199,0,0.25)]'
                    : 'border-white/15'
                }`}
              >
                <div>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-950/75">
                      <GlossaryEntryIcon id={meta.id} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className={`font-display text-sm sm:text-base font-bold ${accentTitle}`}>
                          {entry.term}
                        </h3>
                        <span className="text-[12.5px] font-medium text-slate-300">
                          · {entry.shortTag}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] font-medium leading-snug text-white">
                        {entry.summary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2 text-[13px] leading-relaxed">
                    <p className="text-slate-200">
                      <span className="font-bold text-cyan-200">
                        {codexT.mechanicsLabel}:{' '}
                      </span>
                      {entry.mechanics}
                    </p>
                    <p className="text-emerald-200">
                      <span className="font-bold text-emerald-300">
                        {codexT.tacticalTipLabel}:{' '}
                      </span>
                      {entry.tacticalTip}
                    </p>
                  </div>
                </div>

                {meta.relatedTerms.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2 text-[12.5px]">
                    {meta.relatedTerms.map((relId, idx) => {
                      const relEntry = codexT.glossary[relId];
                      if (!relEntry) return null;
                      return (
                        <button
                          key={relId}
                          type="button"
                          onClick={() => onJumpToTerm(relId)}
                          className="font-semibold text-cyan-200 underline decoration-cyan-400/40 underline-offset-2 hover:text-white cursor-pointer"
                        >
                          {idx > 0 ? '· ' : ''}
                          {relEntry.term}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
