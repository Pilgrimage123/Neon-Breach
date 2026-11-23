import type { BossTelegraphIntel } from '../../engine/mapTacticalIntel';
import type { MetropolisDistrictInfo } from '../../engine/mapGenerator';
import type { RunState } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { formatStageCode } from './sectorMapTheme';

export interface SectorCommandBarProps {
  run: RunState;
  lang: Language;
  isCompactLandscape: boolean;
  totalCols: number;
  currentNodeLayer: number;
  bossTelegraph: BossTelegraphIntel;
  nextCharterLayer: number;
  estateAlreadyChartered: boolean;
  canRideMagLev: boolean;
  equippedWeight: number;
  onOpenLoadout: () => void;
  onCharterEstate?: (layer?: number) => void;
  onRideMagLev?: (targetNodeId?: string) => void;
}

export function SectorCommandBar({
  run,
  lang,
  isCompactLandscape,
  totalCols,
  currentNodeLayer,
  bossTelegraph,
  nextCharterLayer,
  estateAlreadyChartered,
  canRideMagLev,
  equippedWeight,
  onOpenLoadout,
  onCharterEstate,
  onRideMagLev,
}: SectorCommandBarProps) {
  const t = TRANSLATIONS[lang];
  const charterStageCode = formatStageCode(nextCharterLayer);

  return (
    <div
      className={`chrome-glass flex shrink-0 flex-wrap lg:flex-nowrap items-center justify-between gap-2 rounded-xl ${
        isCompactLandscape ? 'px-2.5 py-1' : 'px-3.5 py-2 sm:px-4'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <h1
          className={`chrome-text-shimmer font-display font-bold tracking-wide whitespace-nowrap ${
            isCompactLandscape ? 'text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {t.sectorMapTitle}
        </h1>
        <span
          data-testid="map-stage-counter"
          className="font-mono-tabular text-xs font-bold text-[#00F0FF] whitespace-nowrap"
        >
          {Math.min(totalCols, currentNodeLayer + 2)}/{totalCols}
        </span>
        <span aria-hidden="true" className="hidden sm:inline text-slate-500">
          ·
        </span>
        <span
          title={`${bossTelegraph.name} — ${bossTelegraph.recommendedPrep}`}
          className="hidden sm:inline font-mono-tabular text-xs font-bold text-lime-300 truncate"
        >
          ☠ {bossTelegraph.name} ({bossTelegraph.hp} HP)
        </span>

        {run.hero.incubatingTile && (
          <span
            data-testid="map-stork-pod-badge"
            className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/50 font-mono-tabular text-[12px] font-bold text-pink-200 whitespace-nowrap"
          >
            ⚒ {lang === 'cs' ? 'Cech' : 'Guild Craft'}: {run.hero.incubatingTile.nodesRemaining}n
          </span>
        )}
        {run.hero.bloodlineCrest && (
          <span
            data-testid="map-bloodline-badge"
            className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 font-mono-tabular text-[12px] font-bold text-cyan-200 whitespace-nowrap uppercase"
          >
            ⚜ {run.hero.bloodlineCrest.primary.slice(0, 3)}×{run.hero.bloodlineCrest.secondary.slice(0, 3)} +{run.hero.bloodlineCrest.bonusValue}
          </span>
        )}
        {run.hero.nannyBotInstalled && (
          <span
            data-testid="map-nannybot-badge"
            className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 font-mono-tabular text-[12px] font-bold text-emerald-200 whitespace-nowrap"
          >
            🤖 {run.hero.nannyBotInstalled.replace('_nanny', '').toUpperCase()}
          </span>
        )}
        {(run.hero.heirloomStacks ?? 0) > 0 && (
          <span
            data-testid="map-heirloom-badge"
            className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 font-mono-tabular text-[12px] font-bold text-amber-200 whitespace-nowrap"
          >
            🗡 {lang === 'cs' ? 'Dědictví' : 'Heirloom'} +{run.hero.heirloomStacks}
          </span>
        )}
      </div>

      <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-1.5 min-w-0">
        {onCharterEstate && (
          <button
            type="button"
            data-testid="map-charter-estate-btn"
            disabled={estateAlreadyChartered || run.hero.credits < 20}
            onClick={() => onCharterEstate(nextCharterLayer)}
            title={
              lang === 'cs'
                ? 'Založit rodinnou usedlost v dalším úseku (+5 HP ihned, +12 CR a +5 HP při vstupu)'
                : 'Charter a Family Estate on the next stage (+5 HP now, +12 CR & +5 HP on entry)'
            }
            className="chrome-pill rounded-lg border-emerald-400/50 px-2.5 py-1 font-mono-tabular text-[12px] font-bold text-emerald-200 hover:border-emerald-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
          >
            🏡 {estateAlreadyChartered
              ? lang === 'cs'
                ? `Usedlost ${charterStageCode} ✓`
                : `Estate ${charterStageCode} ✓`
              : lang === 'cs'
                ? `Usedlost ${charterStageCode} (20 CR)`
                : `Charter Estate ${charterStageCode} (20 CR)`}
          </button>
        )}

        {onRideMagLev && (
          <button
            type="button"
            data-testid="map-maglev-express-btn"
            disabled={!canRideMagLev}
            onClick={() => onRideMagLev()}
            title={
              lang === 'cs'
                ? 'Expresní Mag-Lev: přeskočí 2 úseky vpřed (+25 CR, -2 Koroze, +1 krok Cechovního učení)'
                : 'Mag-Lev Express Line: bridge 2 stages ahead (+25 CR, -2 Corrode, +1 Guild Craft step)'
            }
            className="chrome-pill rounded-lg border-sky-400/55 px-2.5 py-1 font-mono-tabular text-[12px] font-bold text-sky-200 hover:border-sky-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
          >
            🚄 {run.hero.maglevUsed
              ? lang === 'cs'
                ? 'Mag-Lev využit ✓'
                : 'Mag-Lev Used ✓'
              : lang === 'cs'
                ? 'Mag-Lev expres (+25 CR)'
                : 'Mag-Lev Express (+25 CR)'}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLoadout}
          className={`chrome-pill flex items-center gap-1.5 rounded-lg font-mono-tabular transition-colors hover:border-cyan-300 cursor-pointer shrink-0 ${
            isCompactLandscape ? 'px-2 py-0.5 text-[12px]' : 'px-3 py-1 text-[13px]'
          }`}
        >
          <span>
            <span className="text-slate-300">{t.mapLoadoutStatus}: </span>
            <span className="font-bold text-[#00F0FF]">
              {equippedWeight}/{run.hero.memoryCapacity}
            </span>
          </span>
          <span className="text-slate-500">·</span>
          <span className="font-bold text-[#FFC700]">{run.masterPool.length}</span>
          <span className="text-slate-500">·</span>
          <span className="font-bold text-cyan-300">
            {run.hero.nanites ?? 0} {t.nanitesShort}
          </span>
        </button>
      </div>
    </div>
  );
}

export interface MetropolisDistrictNavigatorProps {
  metropolisDistricts: MetropolisDistrictInfo[];
  currentLayer: number;
  isCompactLandscape: boolean;
  onScrollToDistrict: (startLayer: number) => void;
}

export function MetropolisDistrictNavigator({
  metropolisDistricts,
  currentLayer,
  isCompactLandscape,
  onScrollToDistrict,
}: MetropolisDistrictNavigatorProps) {
  if (metropolisDistricts.length <= 1) return null;
  return (
    <div
      data-testid="metropolis-district-navigator"
      className="mb-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0"
    >
      {metropolisDistricts.map((dist) => {
        const isActiveDistrict =
          currentLayer + 1 >= dist.startLayer && currentLayer <= dist.endLayer;
        return (
          <button
            key={dist.code}
            type="button"
            data-testid={`district-nav-${dist.code}`}
            onClick={() => onScrollToDistrict(dist.startLayer)}
            className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1 text-left transition-all cursor-pointer ${
              isActiveDistrict
                ? 'border-cyan-300/75 bg-cyan-950/60 text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'border-white/15 bg-slate-950/55 text-slate-300 hover:border-cyan-400/50 hover:text-white'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  style={{ color: dist.accentColor }}
                  className="font-mono-tabular text-[11px] font-black uppercase tracking-wider shrink-0"
                >
                  {dist.code}
                </span>
                <span className="font-display text-[12.5px] sm:text-[13.5px] font-bold truncate">
                  {dist.title}
                </span>
              </div>
              {!isCompactLandscape && (
                <div className="font-mono-tabular text-[11px] text-slate-300 truncate">
                  {dist.subtitle}
                </div>
              )}
            </div>
            <span className="font-mono-tabular text-[11px] font-bold text-cyan-300 shrink-0">
              {formatStageCode(dist.startLayer)}–{formatStageCode(dist.endLayer)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface SettlementGrowthStripProps {
  lang: Language;
  clearedStages: number;
  isCompactLandscape: boolean;
}

export function SettlementGrowthStrip({
  lang,
  clearedStages,
  isCompactLandscape,
}: SettlementGrowthStripProps) {
  const isCs = lang === 'cs';
  const milestones = [
    {
      threshold: 1,
      icon: '⚛️',
      label: isCs ? 'Modulární reaktor' : 'Modular Nuclear Core',
    },
    {
      threshold: 4,
      icon: '🥖',
      label: isCs ? 'Cechy a pekárny' : 'Guilds & Bakeries',
    },
    {
      threshold: 7,
      icon: '⛪',
      label: isCs ? 'Farní náměstí' : 'Parish Square',
    },
    {
      threshold: 10,
      icon: '🛡️',
      label: isCs ? 'Hraniční kaple' : 'Border Chapels',
    },
  ];

  return (
    <div
      data-testid="settlement-growth-strip"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/25 bg-gradient-to-r from-amber-950/30 via-slate-950/55 to-emerald-950/25 ${
        isCompactLandscape ? 'mb-1 px-2 py-0.5 text-[10.5px]' : 'mb-1.5 px-2.5 py-1 text-[11.5px]'
      }`}
    >
      <span className="font-mono-tabular font-bold uppercase tracking-wider text-amber-300 shrink-0">
        🌅 {isCs ? 'Rozvoj osady:' : 'Colony Dawn:'}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {milestones.map((m) => {
          const active = clearedStages >= m.threshold;
          return (
            <span
              key={m.threshold}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-tabular font-semibold transition-colors ${
                active
                  ? 'border border-amber-300/55 bg-amber-500/20 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.18)]'
                  : 'border border-white/10 bg-slate-900/50 text-slate-400'
              }`}
            >
              <span aria-hidden="true">{m.icon}</span>
              <span>{m.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
