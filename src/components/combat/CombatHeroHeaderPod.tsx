import type { Dispatch, SetStateAction } from 'react';
import type {
  CombatDirectorState,
  HeroState,
  HeroThreatPreview,
  TileType,
  TurnPreview,
} from '../../engine/types';
import type { TranslationPack } from '../../i18n/translations';
import type { RendererMode } from './stageSpriteAdapter';

export interface CombatHeroHeaderPodProps {
  hero: HeroState;
  charCode: string;
  turn: number;
  director: CombatDirectorState | undefined;
  activePreview: TurnPreview | null;
  heroThreat: HeroThreatPreview;
  blitzReflexCooldown?: number;
  primedDrone?: TileType | null;
  isCompactLandscape: boolean;
  hasUltraDenseEnemyRow: boolean;
  hcBorderClass: string;
  inspectedTarget: 'hero' | string | null;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  rendererMode: RendererMode;
  setRendererMode: Dispatch<SetStateAction<RendererMode>>;
  debugMeshWireframe: boolean;
  setDebugMeshWireframe: Dispatch<SetStateAction<boolean>>;
  setDevToolbarMountNode?: (el: HTMLElement | null) => void;
  t: TranslationPack;
}

export function CombatHeroHeaderPod({
  hero,
  charCode,
  turn,
  director,
  activePreview,
  heroThreat,
  blitzReflexCooldown = 0,
  primedDrone = null,
  isCompactLandscape,
  hasUltraDenseEnemyRow,
  hcBorderClass,
  inspectedTarget,
  setInspectedTarget,
  rendererMode,
  setRendererMode,
  debugMeshWireframe,
  setDebugMeshWireframe,
  setDevToolbarMountNode,
  t,
}: CombatHeroHeaderPodProps) {
  const safeHeroMaxHp = Math.max(1, hero.maxHp);
  const heroHpPct = Math.max(0, Math.min(100, Math.round((hero.hp / safeHeroMaxHp) * 100)));
  const heroProjHpPct = Math.max(
    0,
    Math.min(100, Math.round((heroThreat.projectedHp / safeHeroMaxHp) * 100)),
  );
  const heroPreEnemyHpPct = Math.max(
    0,
    Math.min(100, Math.round((heroThreat.hpBeforeEnemies / safeHeroMaxHp) * 100)),
  );
  const heroDmgBarPct = Math.max(0, heroPreEnemyHpPct - heroProjHpPct);
  const heroHealBarPct = Math.max(0, heroProjHpPct - heroHpPct);
  const heroHasHpChange =
    heroThreat.hpDamageTaken > 0 || heroThreat.projectedHp !== hero.hp;

  const heatPct = director
    ? Math.max(
        8,
        Math.min(100, Math.round((turn / Math.max(1, director.overtimeTurnThreshold)) * 100)),
      )
    : 0;
  const heatStageLabel = director
    ? director.heatStage === 'overtime'
      ? t.heatOvertimeLabel
      : director.heatStage === 'medium'
        ? t.heatMediumLabel
        : t.heatLowLabel
    : '';

  return (
    <>
      {/* Left: Hero Chrome Lifebar Pod */}
      <button
        type="button"
        data-testid="kira-lifebar-pod"
        data-preview-incoming-dmg={heroThreat.hpDamageTaken}
        data-preview-lethal={heroThreat.willDie ? 'true' : 'false'}
        onClick={() => setInspectedTarget((prev) => (prev === 'hero' ? null : 'hero'))}
        aria-expanded={inspectedTarget === 'hero'}
        aria-label={`${charCode} ${hero.hp}/${hero.maxHp} ${t.hpLabel}`}
        className={`pointer-events-auto text-left rounded-lg transition-all duration-200 shrink-0 cursor-pointer ${hcBorderClass} ${
          isCompactLandscape
            ? 'w-[132px] sm:w-[164px] px-2 py-1'
            : 'w-[138px] sm:w-56 px-2 py-1 sm:px-2.5 sm:py-1.5'
        } ${
          heroThreat.willDie
            ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)]'
            : heroThreat.hpDamageTaken > 0
              ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)]'
              : 'chrome-pill border-cyan-200/35'
        }`}
      >
        <div className="flex items-center justify-between gap-1 text-[11.5px] sm:text-[13px]">
          <span className="flex items-center gap-1 chrome-text-shimmer font-display font-bold tracking-wider whitespace-nowrap">
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#00F0FF] text-[10px] font-black text-slate-950"
            >
              ●
            </span>
            {charCode}
          </span>
          <div className="flex items-center gap-0.5 font-mono-tabular font-bold shrink-0">
            {heroHasHpChange ? (
              <>
                <span className="text-rose-200/80">{hero.hp}</span>
                <span className="text-amber-300">→</span>
                <span
                  className={
                    heroThreat.willDie
                      ? 'text-[#FF2E7E] font-extrabold'
                      : heroThreat.projectedHp < hero.hp
                        ? 'text-[#FFC700]'
                        : 'text-emerald-300'
                  }
                >
                  {heroThreat.projectedHp}
                </span>
                <span className="hidden sm:inline text-slate-400">/{hero.maxHp}</span>
              </>
            ) : (
              <span className="text-rose-200">
                {hero.hp}/{hero.maxHp}
              </span>
            )}
          </div>
        </div>

        <div
          className={`relative mt-0.5 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
            heroThreat.willDie
              ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
              : heroThreat.hpDamageTaken > 0
                ? 'ring-1 ring-[#FFC700]/60'
                : ''
          }`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
            style={{ width: `${Math.min(heroHpPct, heroProjHpPct)}%` }}
          />
          {heroHealBarPct > 0 && (
            <div
              className="absolute inset-y-0 bg-gradient-to-r from-[#10B981] to-[#6EE7B7] animate-pulse transition-all duration-150"
              style={{ left: `${heroHpPct}%`, width: `${heroHealBarPct}%` }}
            />
          )}
          {heroDmgBarPct > 0 && (
            <div
              data-testid="kira-lifebar-preview"
              className={`absolute inset-y-0 transition-all duration-150 ${
                heroThreat.willDie
                  ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                  : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
              }`}
              style={{
                left: `${heroProjHpPct}%`,
                width: `${heroDmgBarPct}%`,
              }}
            />
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[11px] sm:text-[12px] font-mono-tabular">
          <div className="flex flex-wrap items-center gap-1">
            {((hero.armor ?? 0) > 0 ||
              (heroThreat.armorAfterEnemies ?? 0) !== (hero.armor ?? 0)) && (
              <span
                data-testid="hero-armor-badge"
                className="font-bold text-amber-300 whitespace-nowrap"
              >
                🛡 {t.armorShort}{' '}
                {(heroThreat.armorAfterEnemies ?? hero.armor ?? 0) !== (hero.armor ?? 0)
                  ? `${hero.armor ?? 0}→${heroThreat.armorAfterEnemies ?? 0}`
                  : hero.armor ?? 0}
              </span>
            )}
            {(hero.shield > 0 || heroThreat.shieldAfterPlayer > 0) && (
              <span className="font-bold text-[#00F0FF] whitespace-nowrap">
                {t.shieldLabel}{' '}
                {heroThreat.shieldAfterPlayer !== hero.shield
                  ? `${hero.shield}→${heroThreat.shieldAfterPlayer}`
                  : hero.shield}
              </span>
            )}
            {((hero.pendingUpcharge ?? 0) > 0 || (activePreview?.upchargeGained ?? 0) > 0) && (
              <span
                data-testid="hero-upcharge-badge"
                className="font-bold text-emerald-300 whitespace-nowrap"
              >
                ⚡+{(hero.pendingUpcharge ?? 0) + (activePreview?.upchargeGained ?? 0)}{' '}
                {t.upchargeShort}
              </span>
            )}
            {(hero.damageBoostPct > 0 ||
              (activePreview && activePreview.damageBoostAddedPct > 0)) && (
              <span className="font-bold text-[#FFC700] whitespace-nowrap">
                +{hero.damageBoostPct + (activePreview?.damageBoostAddedPct ?? 0)}%
              </span>
            )}
            {(hero.corrode > 0 || (heroThreat.corrodeGained ?? 0) > 0) && (
              <span
                data-testid="hero-corrode-badge"
                className="font-bold text-lime-300 whitespace-nowrap"
              >
                ☣ {t.corrodeLabel}{' '}
                {(heroThreat.corrodeGained ?? 0) > 0
                  ? `${hero.corrode}→${hero.corrode + (heroThreat.corrodeGained ?? 0)}`
                  : hero.corrode}
              </span>
            )}
            {heroThreat.healGained > 0 && (
              <span className="font-bold text-emerald-300 whitespace-nowrap">
                +{heroThreat.healGained} {t.hpLabel}
              </span>
            )}
            {heroThreat.retaliateDamage > 0 && (
              <span className="font-bold text-[#FF2E7E] whitespace-nowrap">
                ⚠ {t.retaliateLabel}
              </span>
            )}
            {(hero.characterId ?? 'kira') === 'kira' && (
              <span
                data-testid="hero-blitz-reflex-badge"
                className={`font-bold whitespace-nowrap ${
                  blitzReflexCooldown === 0 ? 'text-[#00F0FF]' : 'text-slate-400'
                }`}
              >
                {blitzReflexCooldown === 0 ? '⚡ BLITZ READY' : `⚡ BLITZ CD:${blitzReflexCooldown}`}
              </span>
            )}
            {hero.characterId === 'zuri' && primedDrone && (
              <span
                data-testid="hero-primed-drone-badge"
                className="font-bold text-[#FFC700] whitespace-nowrap"
              >
                {primedDrone === 'attack'
                  ? '🛸 HAWK +4⚔'
                  : primedDrone === 'defense'
                    ? '🛸 AEGIS +4🛡'
                    : '🛸 MED +3💚'}
              </span>
            )}
          </div>
          {(heroThreat.hpDamageTaken > 0 || heroThreat.rawIncomingDamage > 0) && (
            <span
              className={`font-bold whitespace-nowrap ${
                heroThreat.willDie
                  ? 'text-[#FF2E7E]'
                  : heroThreat.hpDamageTaken > 0
                    ? 'text-[#FFC700]'
                    : 'text-cyan-200'
              }`}
            >
              {heroThreat.willDie
                ? `☠ -${heroThreat.hpDamageTaken}`
                : heroThreat.hpDamageTaken > 0
                  ? `-${heroThreat.hpDamageTaken} HP`
                  : `0 DMG (${heroThreat.blockedDamage} BLK)`}
            </span>
          )}
        </div>
      </button>

      {/* Center: Sleek Single-Row Heat & Par Cache Strip */}
      {director && (
        <div
          data-testid="combat-heat-telemetry"
          data-heat-stage={director.heatStage}
          className="pointer-events-auto order-3 w-full lg:order-none lg:w-auto lg:min-w-0 lg:shrink flex justify-center"
        >
          <div
            className={`aaa-charcoal-surface flex max-w-full flex-col gap-1 rounded-lg border bg-[#181A20]/90 px-2.5 py-1 text-[12px] font-mono-tabular ${
              director.heatStage === 'overtime'
                ? 'border-[#FF2E7E]/85'
                : director.heatStage === 'medium'
                  ? 'border-[#FFC700]/75'
                  : 'border-white/20'
            }`}
          >
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-2 gap-y-1">
              <span
                className={`font-display font-bold tracking-wider uppercase whitespace-nowrap ${
                  director.heatStage === 'overtime'
                    ? 'text-[#FF2E7E]'
                    : director.heatStage === 'medium'
                      ? 'text-[#FFC700]'
                      : 'text-[#00F0FF]'
                }`}
              >
                {heatStageLabel} · T{turn}
              </span>

              <div
                className={`${hasUltraDenseEnemyRow ? 'hidden xl:flex' : 'flex'} items-center gap-1.5`}
                data-testid="combat-par-caches"
              >
                {director.parCaches.map((cache) => (
                  <span
                    key={`par_${cache.tier}`}
                    data-intact={cache.intact ? 'true' : 'false'}
                    className={`text-[12px] font-bold leading-none whitespace-nowrap ${
                      cache.intact ? 'text-[#FFE066]' : 'text-slate-500 line-through'
                    }`}
                  >
                    {t.parCachePrefix}
                    {cache.maxTurn} +{cache.creditReward}
                  </span>
                ))}
                {director.tempoStreak > 0 && (
                  <span
                    data-testid="combat-tempo-badge"
                    title={t.tempoTip}
                    className="font-extrabold text-emerald-300 whitespace-nowrap"
                  >
                    · ×{director.tempoStreak}
                  </span>
                )}
                {director.rubberBandDelayed && (
                  <span
                    data-testid="combat-rubberband-badge"
                    className="font-bold text-cyan-300 whitespace-nowrap"
                  >
                    · {t.dropRubberBandDelayed}
                  </span>
                )}
              </div>

              {/* Live WebGL2 / Canvas2D Renderer Adapter Switch + DEV Lab Slot */}
              {setDevToolbarMountNode && (
                <div
                  ref={setDevToolbarMountNode}
                  className="flex flex-wrap items-center justify-center gap-1 sm:border-l sm:border-white/15 sm:pl-1.5"
                >
                  <button
                    type="button"
                    data-testid="renderer-mode-toggle"
                    onClick={() =>
                      setRendererMode((prev) => (prev === 'webgl2' ? 'canvas2d' : 'webgl2'))
                    }
                    title={
                      rendererMode === 'webgl2'
                        ? 'Active: Raw WebGL2 Deformable MeshSprite + Unified GLSL 300 es Shader (Click to switch to Canvas2D fallback)'
                        : 'Active: Legacy Canvas2D Flat Quad Renderer (Click to switch to WebGL2 MeshSprite)'
                    }
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      rendererMode === 'webgl2'
                        ? 'bg-[#00F0FF]/20 text-[#00F0FF] ring-1 ring-[#00F0FF]/50 hover:bg-[#00F0FF]/30'
                        : 'bg-slate-800 text-slate-300 ring-1 ring-white/20 hover:bg-slate-700'
                    }`}
                  >
                    {rendererMode === 'webgl2' ? 'GL2 MESH' : '2D QUAD'}
                  </button>
                  {rendererMode === 'webgl2' && (
                    <button
                      type="button"
                      data-testid="mesh-debug-toggle"
                      aria-pressed={debugMeshWireframe}
                      onClick={() => setDebugMeshWireframe((prev) => !prev)}
                      title="Toggle 4×6 subdivided mesh wireframe & 4 anatomical control points (Feet, Pelvis, Waist, Head)"
                      className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        debugMeshWireframe
                          ? 'bg-[#FFC700] text-slate-950 ring-1 ring-[#FFC700]'
                          : 'bg-slate-900/90 text-cyan-200/80 ring-1 ring-cyan-300/30 hover:text-white'
                      }`}
                    >
                      4×6 WIRE
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-950/90">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-200 ${
                  director.heatStage === 'overtime'
                    ? 'bg-gradient-to-r from-[#FFC700] to-[#FF2E7E]'
                    : director.heatStage === 'medium'
                      ? 'bg-gradient-to-r from-[#00F0FF] to-[#FFC700]'
                      : 'bg-gradient-to-r from-cyan-400 to-[#00F0FF]'
                }`}
                style={{ width: `${heatPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
