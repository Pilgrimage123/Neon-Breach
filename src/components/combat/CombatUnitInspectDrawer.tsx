import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { CharacterId, HeroState, PendingReinforcement } from '../../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../../i18n/codexTranslations';
import type { Language, TranslationPack } from '../../i18n/translations';
import { enforceEightWordRule } from '../../utils/spatialMinimalistUi';
import type { CodexTab } from '../CodexModal';
import { formatDropReasonLabel } from './combatHudState';

export interface CombatUnitInspectDrawerProps {
  hero: HeroState;
  charId: CharacterId;
  lang: Language;
  t: TranslationPack;
  inspectedTarget: 'hero' | string | null;
  inspectedDrop: PendingReinforcement | null;
  revealDropArchetype: boolean;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
}

export function CombatUnitInspectDrawer({
  hero,
  charId,
  lang,
  t,
  inspectedTarget,
  inspectedDrop,
  revealDropArchetype,
  setInspectedTarget,
  onOpenCodex,
}: CombatUnitInspectDrawerProps) {
  const codexT = CODEX_TRANSLATIONS[lang];
  const charMeta = t.characters[charId];
  const isOpen = inspectedTarget === 'hero' || Boolean(inspectedDrop);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setInspectedTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, setInspectedTarget]);

  return (
    <>
      {inspectedTarget === 'hero' && (
        <div
          role="region"
          data-testid="combat-detail-card"
          aria-label="Combat unit details"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 right-2 bottom-2 z-30 mx-auto max-w-2xl max-h-[calc(100%-12px)] overflow-y-auto rounded-2xl border-2 border-cyan-300/75 bg-[#181A20]/98 px-4 py-3 text-[#F4F4F6] shadow-2xl"
        >
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-display text-[20px] sm:text-[22px] font-extrabold text-[#F4F4F6] leading-tight">
                  {charMeta.code} · {charMeta.name}
                </h3>
                <span className="text-xs font-bold text-cyan-300">
                  · {codexT.heroes[charId].roleTag}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenCodex && (
                  <button
                    type="button"
                    data-testid="hero-inspect-codex-btn"
                    onClick={() => onOpenCodex('heroes', charId, null)}
                    className="chrome-pill rounded-lg border-cyan-300/60 px-2.5 py-1 text-xs font-bold text-[#00F0FF] hover:border-cyan-200 hover:text-white whitespace-nowrap cursor-pointer"
                  >
                    {codexT.inspectHeroDossierBtn} →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedTarget(null)}
                  className="chrome-pill rounded-lg px-2.5 py-1 text-xs font-bold text-[#F4F4F6] cursor-pointer"
                >
                  {t.closeLabel}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {codexT.heroes[charId].passivePowers.map((p, idx, arr) => (
                <div
                  key={p.name}
                  className={`min-w-0 overflow-hidden rounded-xl border border-white/15 bg-[#0E1015] px-3 py-2 ${
                    arr.length % 2 === 1 && idx === arr.length - 1 ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="font-bold text-sm text-cyan-200">{p.name}</span>
                    <span className="font-mono-tabular text-[11px] font-extrabold text-[#FFC700] leading-snug">
                      {p.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-[#D7DBE6]">
                    {enforceEightWordRule(p.description)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#FFC700]/45 bg-[#0E1015] px-3 py-2 text-[14px] leading-snug text-[#F4F4F6]">
              <span className="font-extrabold text-[#FFC700]">⚡ {charMeta.overdriveName}:</span>{' '}
              {enforceEightWordRule(charMeta.overdriveDesc)}
            </div>

            {hero.corrode > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-lime-300">
                <span>
                  ☣ {t.corrodeLabel} {hero.corrode}:{' '}
                  {lang === 'cs'
                    ? `-${hero.corrode} Štítu při zisku.`
                    : `-${hero.corrode} Shield gained.`}
                </span>
                {onOpenCodex && (
                  <button
                    type="button"
                    onClick={() => onOpenCodex('glossary', charId, 'corrode')}
                    className="font-bold text-[#00F0FF] underline underline-offset-2 hover:text-white cursor-pointer"
                  >
                    {codexT.openTermHint} →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {inspectedDrop && (
        <div
          role="region"
          data-testid="combat-detail-card"
          aria-label={t.inboundDropLabel}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-2 right-2 bottom-2 z-30 mx-auto max-w-xl rounded-xl border border-dashed border-[#00F0FF]/75 bg-[#070E22]/96 px-3.5 py-2.5 text-xs shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#FFC700] px-1.5 py-0.5 font-mono-tabular text-[12px] font-extrabold text-slate-950">
                  T-{inspectedDrop.turnsUntilDrop}
                </span>
                <span className="font-display text-sm font-bold text-white">
                  {revealDropArchetype ? t.enemies[inspectedDrop.archetype].name : '???'}
                </span>
                <span className="font-mono-tabular text-[12px] font-bold uppercase text-cyan-300">
                  {formatDropReasonLabel(inspectedDrop.reason, t)}
                </span>
              </div>
              <p className="text-[13px] text-slate-200">
                {revealDropArchetype
                  ? t.enemies[inspectedDrop.archetype].bioNote
                  : lang === 'cs'
                    ? 'Archetyp výsadku je na této obtížnosti utajen do dopadu.'
                    : 'Drop archetype is encrypted on this difficulty tier until touchdown.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-[12px]">
                <span className="rounded border border-cyan-300/40 bg-cyan-950/60 px-1.5 py-0.5 font-bold text-cyan-200">
                  {t.dropZeroDmgRule}
                </span>
                <span className="rounded border border-amber-300/40 bg-amber-950/60 px-1.5 py-0.5 font-bold text-[#FFE066]">
                  {t.fastClearBonusLabel}
                </span>
                {inspectedDrop.isZeroReward && (
                  <span className="rounded border border-slate-500/50 bg-slate-900 px-1.5 py-0.5 font-bold text-slate-300">
                    {t.zeroRewardBadgeLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInspectedTarget(null)}
              className="chrome-pill shrink-0 rounded px-2.5 py-1 text-[12px] font-bold text-white cursor-pointer"
            >
              {t.closeLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
