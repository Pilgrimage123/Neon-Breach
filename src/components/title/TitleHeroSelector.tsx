import { HERO_SPECS } from '../../engine/data';
import type { CharacterId } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { HeroPortraitCanvas } from '../HeroPortraitCanvas';

export interface TitleHeroSelectorProps {
  lang: Language;
  selectedCharacter: CharacterId;
  compactCards: boolean;
  onSelectCharacter: (id: CharacterId) => void;
}

export function TitleHeroSelector({
  lang,
  selectedCharacter,
  compactCards,
  onSelectCharacter,
}: TitleHeroSelectorProps) {
  const t = TRANSLATIONS[lang];

  return (
    <div
      role="radiogroup"
      aria-label={t.selectHeroLabel}
      className={`grid gap-2 ${
        compactCards ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'
      }`}
    >
      {(['kira', 'auraline', 'zuri'] as const).map((charId) => {
        const isSelected = selectedCharacter === charId;
        const meta = t.characters[charId];
        const spec = HERO_SPECS[charId];
        const passiveName = meta.passive.split(':')[0]?.trim() ?? meta.passive;
        const isAuraline = charId === 'auraline';
        const isZuri = charId === 'zuri';
        return (
          <button
            key={charId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={`select-character-${charId}`}
            onClick={() => onSelectCharacter(charId)}
            className={`chrome-pill flex h-full items-center overflow-hidden rounded-xl ${
              compactCards ? 'gap-1.5 p-1.5' : 'gap-2.5 p-2.5 sm:p-3'
            } text-left transition-all cursor-pointer ${
              isSelected
                ? isAuraline
                  ? 'border-[#FFC700] bg-amber-950/40 ring-1 ring-[#FFC700]/75'
                  : isZuri
                    ? 'border-[#10B981] bg-emerald-950/40 ring-1 ring-[#10B981]/75'
                    : 'border-[#00F0FF] bg-cyan-950/40 ring-1 ring-[#00F0FF]/75'
                : 'border-white/15 opacity-85 hover:opacity-100 hover:border-white/35'
            }`}
          >
            <HeroPortraitCanvas
              characterId={charId}
              active={isSelected}
              variant="title"
              compact={compactCards}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1.5 gap-y-0.5">
                <span
                  className={`font-display font-extrabold whitespace-nowrap shrink-0 ${
                    compactCards ? 'text-[11.5px] tracking-normal' : 'text-[13px] sm:text-sm tracking-wider'
                  } ${
                    isAuraline
                      ? 'text-[#FFC700]'
                      : isZuri
                        ? 'text-[#34D399]'
                        : 'text-[#00F0FF]'
                  }`}
                >
                  {meta.code}
                </span>
                <span
                  className={`font-mono-tabular font-bold text-amber-200 whitespace-nowrap shrink-0 ${
                    compactCards ? 'text-[10.5px]' : 'text-[11.5px] sm:text-[12px]'
                  }`}
                >
                  {spec.maxHp} HP · {spec.memoryCapacity} {lang === 'cs' ? 'RAM' : 'MEM'}
                </span>
              </div>
              <div
                className={`${
                  compactCards ? 'text-[11px]' : 'text-[12.5px] sm:text-[13px]'
                } font-bold leading-tight text-[#F4F4F6]`}
              >
                {meta.title}
              </div>
              <div
                className={`flex flex-col gap-0.5 pt-0.5 ${
                  compactCards ? 'text-[10px]' : 'text-[11.5px] sm:text-[12px]'
                } font-semibold leading-tight`}
              >
                <div
                  className={
                    isAuraline
                      ? 'text-amber-300'
                      : isZuri
                        ? 'text-emerald-300'
                        : 'text-cyan-300'
                  }
                >
                  ★ {passiveName}
                </div>
                <div className="text-slate-200/95">
                  <span aria-hidden="true" className="text-[#FFC700]">
                    ⚡{' '}
                  </span>
                  {meta.overdriveName}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
