import { useEffect, useMemo, useRef, useState } from 'react';
import { getPreloadedPortraitFrame, loadPortraitFrame } from '../assets/assetPreloader';
import {
  filterGlossaryTerms,
  getHeroCodexProfile,
  type GlossaryTermMeta,
} from '../engine/codexData';
import type { CharacterId, TileSpec } from '../engine/types';
import {
  CODEX_TRANSLATIONS,
  type GlossaryCategory,
  type GlossaryTermId,
} from '../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { AURELIA_SHEET_FRAMES } from '../utils/aureliaSpriteSheet';
import { HEROINE_COMBAT_FRAMES } from '../utils/heroineSpriteSheet';
import { formatTileDetailText, formatTileShortLabel } from '../utils/tileDisplay';
import { ZURI_SHEET_FRAMES } from '../utils/zuriSpriteSheet';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from './combat/CombatIcons';
import { TileGlyph } from './TileGlyph';

export type CodexTab = 'heroes' | 'glossary';

interface CodexModalProps {
  lang: Language;
  initialTab?: CodexTab;
  initialHero?: CharacterId;
  initialTermId?: GlossaryTermId | null;
  onClose: () => void;
}

const HERO_IDS: readonly CharacterId[] = ['kira', 'aurelia', 'zuri'];
const GLOSSARY_CATEGORIES: readonly GlossaryCategory[] = [
  'all',
  'defense',
  'offense',
  'board',
  'status',
];

function CodexHeroPortrait({
  characterId,
  active,
}: {
  characterId: CharacterId;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState<boolean>(() =>
    Boolean(getPreloadedPortraitFrame(characterId)),
  );

  useEffect(() => {
    let cancelled = false;
    const rect =
      characterId === 'aurelia'
        ? AURELIA_SHEET_FRAMES[0]
        : characterId === 'zuri'
          ? ZURI_SHEET_FRAMES[8]
          : HEROINE_COMBAT_FRAMES[0];

    const paint = (frame: HTMLCanvasElement) => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const pad = 3;
      const scale = Math.min(
        (canvas.width - pad * 2) / rect.w,
        (canvas.height - pad * 2) / rect.h,
      );
      const dw = rect.w * scale;
      const dh = rect.h * scale;
      const dx = (canvas.width - dw) * 0.5;
      const dy = canvas.height - dh - 2;
      ctx.drawImage(frame, dx, dy, dw, dh);
      setReady(true);
    };

    const cached = getPreloadedPortraitFrame(characterId);
    if (cached) {
      paint(cached);
      return;
    }

    void loadPortraitFrame(characterId)
      .then((frame) => paint(frame))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const borderTone =
    characterId === 'aurelia'
      ? active
        ? 'border-[#FFC700]/80 bg-amber-950/40'
        : 'border-white/15 bg-slate-950/60'
      : characterId === 'zuri'
        ? active
          ? 'border-[#10B981]/80 bg-emerald-950/40'
          : 'border-white/15 bg-slate-950/60'
        : active
          ? 'border-[#00F0FF]/80 bg-cyan-950/40'
          : 'border-white/15 bg-slate-950/60';

  return (
    <canvas
      ref={canvasRef}
      width={52}
      height={64}
      aria-hidden="true"
      className={`h-11 w-9 shrink-0 rounded-lg border transition-opacity duration-150 ${borderTone} ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

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

  const termRefs = useRef<Partial<Record<GlossaryTermId, HTMLDivElement | null>>>({});

  // Sync if caller updates initial target props
  useEffect(() => {
    if (initialTermId) {
      setActiveTab('glossary');
      setCategory('all');
      setSearchQuery('');
      setFocusedTermId(initialTermId);
    }
  }, [initialTermId]);

  useEffect(() => {
    if (activeTab === 'glossary' && focusedTermId) {
      const targetEl = termRefs.current[focusedTermId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTab, focusedTermId]);

  const heroProfile = useMemo(() => getHeroCodexProfile(selectedHero), [selectedHero]);
  const heroMeta = t.characters[selectedHero];
  const heroCodex = codexT.heroes[selectedHero];

  const filteredTerms: GlossaryTermMeta[] = useMemo(
    () => filterGlossaryTerms(searchQuery, category, lang),
    [searchQuery, category, lang],
  );

  const heroAccentText =
    selectedHero === 'aurelia'
      ? 'text-[#FFC700]'
      : selectedHero === 'zuri'
        ? 'text-[#34D399]'
        : 'text-[#00F0FF]';

  const heroAccentBorder =
    selectedHero === 'aurelia'
      ? 'border-[#FFC700]/65'
      : selectedHero === 'zuri'
        ? 'border-[#10B981]/65'
        : 'border-[#00F0FF]/65';

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
        {/* Top Header */}
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

        {/* Mode Switcher Tabs */}
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
                  charId === 'aurelia'
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
                    <CodexHeroPortrait characterId={charId} active={isCurrent} />
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

        {/* Scrollable Content */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
          {activeTab === 'heroes' ? (
            <div
              data-testid={`codex-hero-panel-${selectedHero}`}
              className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
            >
              {/* Left Column: Hero Identity, Base Vitals, Passives & Overdrive */}
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

                  {/* Base Chassis Metrics */}
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
                        {heroProfile.startingWeight}/{heroProfile.spec.carryCapacity}
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

                {/* Passive Powers */}
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

                {/* Signature Overdrive */}
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

              {/* Right Column: Innate Core Tiles, Starting Gear, Synergies & Combat Rhythm */}
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
                    {heroProfile.startingEquipment.map((def) => {
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
                              {t.sizeLabel} {def.size}
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
          ) : (
            <div data-testid="codex-glossary-panel" className="space-y-3">
              {/* Search & Category Filter Controls */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="search"
                    data-testid="codex-glossary-search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusedTermId(null);
                    }}
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
                        onClick={() => {
                          setCategory(cat);
                          setFocusedTermId(null);
                        }}
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

              {/* Filtered Glossary Grid */}
              {filteredTerms.length === 0 ? (
                <div className="chrome-pill flex flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
                  <p className="text-sm text-slate-200">{codexT.noSearchResults}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCategory('all');
                      setFocusedTermId(null);
                    }}
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
                                  onClick={() => handleJumpToTerm(relId)}
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
          )}
        </div>
      </div>
    </div>
  );
}
