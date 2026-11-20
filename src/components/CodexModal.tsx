import { useEffect, useState } from 'react';
import type { CharacterId } from '../engine/types';
import {
  CODEX_TRANSLATIONS,
  type GlossaryCategory,
  type GlossaryTermId,
} from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { CodexGlossaryTab } from './codex/CodexGlossaryTab';
import { CodexHeroTab } from './codex/CodexHeroTab';
import { HeroPortraitCanvas } from './HeroPortraitCanvas';

export type CodexTab = 'heroes' | 'glossary';

interface CodexModalProps {
  lang: Language;
  initialTab?: CodexTab;
  initialHero?: CharacterId;
  initialTermId?: GlossaryTermId | null;
  onClose: () => void;
}

const HERO_IDS: readonly CharacterId[] = ['kira', 'auraline', 'zuri'];

export function CodexModal({
  lang,
  initialTab = 'heroes',
  initialHero = 'kira',
  initialTermId = null,
  onClose,
}: CodexModalProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];

  const [activeTab, setActiveTab] = useState<CodexTab>(
    initialTermId ? 'glossary' : initialTab,
  );
  const [selectedHero, setSelectedHero] = useState<CharacterId>(initialHero);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [category, setCategory] = useState<GlossaryCategory>('all');
  const [focusedTermId, setFocusedTermId] = useState<GlossaryTermId | null>(initialTermId);

  useEffect(() => {
    if (initialTermId) {
      setActiveTab('glossary');
      setCategory('all');
      setSearchQuery('');
      setFocusedTermId(initialTermId);
    }
  }, [initialTermId]);

  const handleJumpToTerm = (termId: GlossaryTermId) => {
    setActiveTab('glossary');
    setCategory('all');
    setSearchQuery('');
    setFocusedTermId(termId);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-modal-title"
      data-testid="codex-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-sm"
    >
      <div className="chrome-panel-bright flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-white/15 pb-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="codex-modal-title"
              className="chrome-text-shimmer font-display text-lg sm:text-2xl font-bold tracking-wide"
            >
              {codexT.codexTitle}
            </h2>
            <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-slate-200 leading-snug">
              {codexT.codexSubtitle}
            </p>
          </div>
          <button
            type="button"
            data-testid="codex-close-button"
            onClick={onClose}
            className="chrome-pill shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors hover:border-cyan-300 cursor-pointer whitespace-nowrap"
          >
            {t.closeLabel}
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div
            role="tablist"
            aria-label={codexT.codexTitle}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/70 p-1"
          >
            <button
              type="button"
              role="tab"
              data-testid="codex-tab-heroes"
              aria-selected={activeTab === 'heroes'}
              onClick={() => setActiveTab('heroes')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'heroes'
                  ? 'bg-[#00F0FF] text-slate-950 shadow-[0_0_16px_rgba(0,240,255,0.35)]'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {codexT.tabHeroes}
            </button>
            <button
              type="button"
              role="tab"
              data-testid="codex-tab-glossary"
              aria-selected={activeTab === 'glossary'}
              onClick={() => setActiveTab('glossary')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'glossary'
                  ? 'bg-[#FFC700] text-slate-950 shadow-[0_0_16px_rgba(255,199,0,0.35)]'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {codexT.tabGlossary} ({Object.keys(codexT.glossary).length})
            </button>
          </div>

          {activeTab === 'heroes' && (
            <div
              role="tablist"
              aria-label={codexT.heroSelectorAria}
              className="flex flex-wrap items-center gap-1.5"
            >
              {HERO_IDS.map((charId) => {
                const isCurrent = selectedHero === charId;
                const charLabel = t.characters[charId];
                const activeTone =
                  charId === 'auraline'
                    ? 'border-[#FFC700] bg-amber-950/45 text-[#FFC700]'
                    : charId === 'zuri'
                      ? 'border-[#10B981] bg-emerald-950/45 text-[#34D399]'
                      : 'border-[#00F0FF] bg-cyan-950/45 text-[#00F0FF]';
                return (
                  <button
                    key={charId}
                    type="button"
                    role="tab"
                    data-testid={`codex-hero-tab-${charId}`}
                    aria-selected={isCurrent}
                    onClick={() => setSelectedHero(charId)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-1 text-left transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? activeTone
                        : 'border-white/15 bg-slate-950/55 text-slate-200 hover:border-white/35 hover:text-white'
                    }`}
                  >
                    <HeroPortraitCanvas
                      characterId={charId}
                      active={isCurrent}
                      variant="codex"
                    />
                    <div>
                      <div className="font-display text-[13px] font-bold leading-tight">
                        {charLabel.code}
                      </div>
                      <div className="text-[12px] text-slate-200 leading-tight">
                        {charLabel.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
          {activeTab === 'heroes' ? (
            <CodexHeroTab selectedHero={selectedHero} lang={lang} />
          ) : (
            <CodexGlossaryTab
              lang={lang}
              searchQuery={searchQuery}
              category={category}
              focusedTermId={focusedTermId}
              onChangeSearch={(q) => {
                setSearchQuery(q);
                setFocusedTermId(null);
              }}
              onChangeCategory={(cat) => {
                setCategory(cat);
                setFocusedTermId(null);
              }}
              onClearSearch={() => {
                setSearchQuery('');
                setCategory('all');
                setFocusedTermId(null);
              }}
              onJumpToTerm={handleJumpToTerm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
