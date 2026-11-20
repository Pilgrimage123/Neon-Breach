import { type Dispatch, type SetStateAction } from 'react';
import {
  getEffectiveEnemyIntentValue,
  getEnemySlotSpan,
  isIntentConditionMet,
} from '../../engine/reinforcementDirector';
import type {
  CharacterId,
  CombatState,
  EnemyIntent,
  HeroState,
  HeroThreatPreview,
  PendingReinforcement,
  ReinforcementReason,
  TurnPreview,
} from '../../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language, type TranslationPack } from '../../i18n/translations';
import { getEnemyRolePip } from '../../utils/accessibilityAndScale';
import { enforceEightWordRule } from '../../utils/spatialMinimalistUi';
import { formatDiscretePipMath } from '../../utils/tacticalSandboxAndHints';
import type { CodexTab } from '../CodexModal';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from './CombatIcons';
import {
  computeEnemyArmorPreview,
  type EnemyArmorPreview,
  formatEnemyIntentCompact,
  getEnemyReactiveBark,
} from './combatEnemyUi';
import type { RendererMode } from './stageSpriteAdapter';

const FALLBACK_INTENT: EnemyIntent = { kind: 'attack', value: 0 };

function formatDropReasonLabel(reason: ReinforcementReason, t: TranslationPack): string {
  switch (reason) {
    case 'adaptive':
      return t.dropReasonAdaptive;
    case 'reactive':
      return t.dropReasonReactive;
    case 'sos_flare':
      return t.dropReasonSos;
    case 'sweeper':
      return t.dropReasonSweeper;
    case 'threat_pool':
    default:
      return t.dropReasonThreat;
  }
}

export function computeSequentialEnemyHudState(
  combat: CombatState,
  activePreview: TurnPreview | null,
  heroThreat: HeroThreatPreview,
  frontLivingIdx: number,
): Array<{
  armorPreview: EnemyArmorPreview;
  intent: EnemyIntent;
  conditionActive: boolean;
  shieldBeforeThisEnemy: number;
}> {
  const colorPlayed = activePreview?.tileCount ? activePreview.color : null;
  let runningShield = Math.max(0, heroThreat.shieldAfterPlayer - (heroThreat.retaliateDamage ?? 0));

  return combat.enemies.map((enemy, idx) => {
    const armorPreview = computeEnemyArmorPreview(
      enemy,
      idx,
      frontLivingIdx,
      activePreview,
      combat.enemies,
    );
    const intent =
      enemy.intentCycle[enemy.currentIntentIndex] ??
      enemy.intentCycle[0] ??
      FALLBACK_INTENT;
    const isDeadOrDying = enemy.hp <= 0 || Boolean(enemy.escaped) || armorPreview.willDie;
    const shieldBeforeThisEnemy = runningShield;
    const conditionActive = isIntentConditionMet(intent, {
      shieldAfterPlayer: shieldBeforeThisEnemy,
      colorPlayed,
      battlefieldRule: combat.battlefieldRule,
    });

    if (
      !isDeadOrDying &&
      !enemy.staggered &&
      !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
      (intent.kind === 'attack' ||
        intent.kind === 'heavy' ||
        intent.kind === 'acid' ||
        intent.kind === 'leech')
    ) {
      const incoming = getEffectiveEnemyIntentValue(enemy, intent, {
        shieldAfterPlayer: shieldBeforeThisEnemy,
        colorPlayed,
        battlefieldRule: combat.battlefieldRule,
      });
      if (incoming > 0) {
        runningShield = Math.max(0, runningShield - incoming);
      }
    }

    return {
      armorPreview,
      intent,
      conditionActive,
      shieldBeforeThisEnemy,
    };
  });
}

export interface CombatStageHudOverlayProps {
  combat: CombatState;
  hero: HeroState;
  lang: Language;
  activePreview: TurnPreview | null;
  heroThreat: HeroThreatPreview;
  frontLivingIdx: number;
  isCompactLandscape: boolean;
  tacticalView: boolean;
  highContrastBorders: boolean;
  pipMathMode: boolean;
  revealDropArchetype: boolean;
  rendererMode: RendererMode;
  setRendererMode: Dispatch<SetStateAction<RendererMode>>;
  debugMeshWireframe: boolean;
  setDebugMeshWireframe: Dispatch<SetStateAction<boolean>>;
  inspectedTarget: 'hero' | string | null;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  setHoveredEnemyId: Dispatch<SetStateAction<string | null>>;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
  setDevToolbarMountNode?: (el: HTMLElement | null) => void;
  sequentialHudStates: ReturnType<typeof computeSequentialEnemyHudState>;
}

export function CombatStageHudOverlay({
  combat,
  hero,
  lang,
  activePreview,
  heroThreat,
  isCompactLandscape,
  tacticalView,
  highContrastBorders,
  pipMathMode,
  revealDropArchetype,
  rendererMode,
  setRendererMode,
  debugMeshWireframe,
  setDebugMeshWireframe,
  inspectedTarget,
  setInspectedTarget,
  setHoveredEnemyId,
  onOpenCodex,
  setDevToolbarMountNode,
  sequentialHudStates,
}: CombatStageHudOverlayProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const charId: CharacterId = hero.characterId ?? 'kira';
  const charMeta = t.characters[charId];
  const director = combat.director;
  const pendingDrops = director?.pendingReinforcements ?? [];

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
        Math.min(100, Math.round((combat.turn / Math.max(1, director.overtimeTurnThreshold)) * 100)),
      )
    : 0;
  const heatStageLabel = director
    ? director.heatStage === 'overtime'
      ? t.heatOvertimeLabel
      : director.heatStage === 'medium'
        ? t.heatMediumLabel
        : t.heatLowLabel
    : '';
  const hasDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 3;
  const hasUltraDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 5;
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';

  const inspectedDrop: PendingReinforcement | null =
    inspectedTarget && inspectedTarget.startsWith('drop:')
      ? pendingDrops.find((d) => d.id === inspectedTarget.slice(5)) ?? null
      : null;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-[1680px] flex-wrap md:flex-nowrap items-start justify-between gap-1.5 px-2 sm:px-4 ${
          isCompactLandscape ? 'top-1' : 'top-1.5 sm:top-2'
        }`}
      >
        {/* Left: Operative Chrome Lifebar Pod */}
        <button
          type="button"
          data-testid="kira-lifebar-pod"
          data-preview-incoming-dmg={heroThreat.hpDamageTaken}
          data-preview-lethal={heroThreat.willDie ? 'true' : 'false'}
          onClick={() => setInspectedTarget((prev) => (prev === 'hero' ? null : 'hero'))}
          aria-expanded={inspectedTarget === 'hero'}
          aria-label={`${charMeta.code} ${hero.hp}/${hero.maxHp} ${t.hpLabel}`}
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
              {charMeta.code}
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
                  data-testid="heroine-armor-badge"
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
                  data-testid="heroine-upcharge-badge"
                  className="font-bold text-emerald-300 whitespace-nowrap"
                >
                  ⚡+{(hero.pendingUpcharge ?? 0) + (activePreview?.upchargeGained ?? 0)} {t.upchargeShort}
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
                  data-testid="heroine-corrode-badge"
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
            className="pointer-events-auto order-3 w-full md:order-none md:w-auto flex justify-center"
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
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1">
                <span
                  className={`font-display font-bold tracking-wider uppercase whitespace-nowrap ${
                    director.heatStage === 'overtime'
                      ? 'text-[#FF2E7E]'
                      : director.heatStage === 'medium'
                        ? 'text-[#FFC700]'
                        : 'text-[#00F0FF]'
                  }`}
                >
                  {heatStageLabel} · T{combat.turn}
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
                <div
                  ref={setDevToolbarMountNode}
                  className="hidden sm:flex items-center gap-1 border-l border-white/15 pl-1.5"
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
                    className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase transition-colors cursor-pointer ${
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
                      className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase transition-colors cursor-pointer ${
                        debugMeshWireframe
                          ? 'bg-[#FFC700] text-slate-950 ring-1 ring-[#FFC700]'
                          : 'bg-slate-900/90 text-cyan-200/80 ring-1 ring-cyan-300/30 hover:text-white'
                      }`}
                    >
                      4×6 WIRE
                    </button>
                  )}
                </div>
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

        {/* Right: Single-Row Compact Chrome Enemy Intent, Armor, Lifebar & Drop Pods */}
        <div className="flex flex-wrap sm:flex-nowrap justify-end gap-1 sm:gap-1.5 min-w-0">
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
            } = armorPreview;
            const conditionActive = hudState.conditionActive;
            const intentOptions = {
              staggered: enemy.staggered,
              conditionActive,
              weaponBroken: enemy.weaponBroken,
              desperationEnraged: enemy.desperationEnraged,
              sleepCounter: enemy.sleepCounter,
              isLootRunner: enemy.isLootRunner,
              escapeTurnsLeft: enemy.escapeTurnsLeft,
              propKind: enemy.propKind,
              reviveTimer: enemy.reviveTimer,
            };
            const reactiveBark = getEnemyReactiveBark(
              enemy,
              activePreview,
              armorPreview,
              hudState.shieldBeforeThisEnemy,
              lang,
            );
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
                      ? 'w-[96px] sm:w-[118px] lg:w-[136px] xl:w-[152px] px-1.5 py-1'
                      : hasDenseEnemyRow
                        ? 'w-[112px] sm:w-44 lg:w-52 px-1.5 py-1 sm:px-2 sm:py-1.5'
                        : getEnemySlotSpan(enemy.archetype) > 1
                          ? 'w-[168px] sm:w-52 lg:w-60 px-2 py-1 sm:px-2.5 sm:py-1.5'
                          : 'w-[126px] sm:w-48 lg:w-56 px-2 py-1 sm:px-2.5 sm:py-1.5'
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
                    {pipMathMode && !isDead && (
                      <span
                        data-testid={`enemy-pip-math-${enemy.id}`}
                        className="ml-0.5 rounded bg-slate-950/90 px-1 text-[10px] font-extrabold text-[#FFC700]"
                      >
                        {formatDiscretePipMath(projectedHp).compactLabel}
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
                    <span
                      className={`flex items-center gap-1 font-bold truncate ${
                        enemy.staggered
                          ? 'text-cyan-300'
                          : conditionActive
                            ? 'text-[#FF2E7E]'
                            : 'text-lime-300'
                      }`}
                    >
                      <IntentIcon kind={intent.kind} size={12} />
                      <span className="truncate">
                        {formatEnemyIntentCompact(intent, lang, enrageBonus, intentOptions)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">KO</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isDead && (
                      enemy.staggered ? (
                        <span
                          data-testid={`enemy-staggered-${enemy.id}`}
                          className="rounded bg-cyan-500/25 px-1 text-[10px] font-extrabold text-cyan-200"
                        >
                          {t.staggeredTag}
                        </span>
                      ) : enemy.weaponBroken ? (
                        <span
                          data-testid={`enemy-weapon-broken-${enemy.id}`}
                          className="rounded bg-cyan-500/25 px-1 text-[10px] font-extrabold text-cyan-200"
                        >
                          🔨 -3
                        </span>
                      ) : enemy.desperationEnraged ? (
                        <span
                          data-testid={`enemy-desperation-${enemy.id}`}
                          className="rounded bg-rose-500/35 px-1 text-[10px] font-extrabold text-rose-100"
                        >
                          🔥 +3
                        </span>
                      ) : enemy.isMercyTarget ? (
                        <span
                          data-testid={`enemy-mercy-${enemy.id}`}
                          className="rounded bg-emerald-500/30 px-1 text-[10px] font-extrabold text-emerald-200"
                        >
                          🕊 MERCY
                        </span>
                      ) : enemy.enragedAlone ? (
                        <span
                          data-testid={`enemy-enraged-alone-${enemy.id}`}
                          className="rounded bg-rose-500/35 px-1 text-[10px] font-extrabold text-rose-100"
                        >
                          {t.enragedAloneTag}
                        </span>
                      ) : enemy.sosCharging ? (
                        <span className="rounded bg-amber-400/25 px-1 text-[10px] font-extrabold text-amber-200">
                          {t.sosFlareBadgeLabel}
                        </span>
                      ) : enrageBonus > 0 ? (
                        <span className="rounded bg-rose-500/25 px-1 text-[10px] font-extrabold text-rose-200">
                          +{enrageBonus}
                        </span>
                      ) : enemy.isZeroReward ? (
                        <span className="rounded bg-slate-700/70 px-1 text-[10px] font-bold text-slate-300">
                          {t.zeroRewardBadgeLabel}
                        </span>
                      ) : null
                    )}
                    {hasShieldPips && (
                      <span className="shrink-0 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-sky-300">
                        {willCrackShieldPip ? `${enemy.shieldPips}→${remainingShieldPips}` : enemy.shieldPips}
                      </span>
                    )}
                  </div>
                </div>

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
                      {willCrackShieldPip && previewHpLoss === 0
                        ? t.pipCrackLabel
                        : armorAbsorbed > 0 && previewHpLoss === 0
                          ? `-${armorAbsorbed} ${t.armorShort}`
                          : `-${previewHpLoss} ${t.hpLabel}${
                              armorAbsorbed > 0 && !willBreakArmor
                                ? ` (-${armorAbsorbed} ${t.armorShort})`
                                : ''
                            }`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {willDie ? (
                        <span className="rounded bg-[#FF2E7E] px-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          ☠ {t.lethalLabel}
                        </span>
                      ) : willStagger ? (
                        <span
                          data-testid={`enemy-will-stagger-${enemy.id}`}
                          className="rounded bg-cyan-500/30 px-1 text-[10px] font-extrabold uppercase text-cyan-200 animate-pulse"
                        >
                          {t.staggerPreviewLabel}
                        </span>
                      ) : willTriggerPhaseGate ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold uppercase text-lime-300">
                          {t.phaseGateLabel}
                        </span>
                      ) : willBreakArmor ? (
                        <span className="text-[#FFC700] uppercase">{t.armorBreakLabel}</span>
                      ) : chainedBurstDmg > 0 ? (
                        <span className="rounded bg-lime-400/20 px-1 text-[10px] font-extrabold uppercase text-lime-300">
                          💥-{chainedBurstDmg}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {reactiveBark && !isDead && !willDie && (
                  <div
                    data-testid={`enemy-reactive-bark-${enemy.id}`}
                    className="mt-0.5 truncate rounded bg-amber-500/20 px-1 py-0.5 text-center font-mono-tabular text-[10px] font-extrabold text-[#FFC700]"
                  >
                    {reactiveBark}
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
                    : 'w-[114px] sm:w-44 lg:w-48 px-1.5 py-1 sm:px-2 sm:py-1.5'
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
      </div>

      {/* Tap-to-Inspect Hero Card */}
      {inspectedTarget === 'hero' && (
        <div
          role="region"
          data-testid="combat-detail-card"
          aria-label="Combat unit details"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 right-2 bottom-2 z-30 mx-auto max-w-2xl max-h-[calc(100%-12px)] overflow-y-auto rounded-2xl border-2 border-cyan-300/75 bg-[#181A20]/98 px-4 py-3 text-[#F4F4F6] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-display text-[22px] sm:text-[24px] font-extrabold text-[#F4F4F6] leading-tight">
                  {charMeta.code} · {charMeta.name}
                </h3>
                <span className="text-xs font-bold text-cyan-300">
                  · {codexT.heroes[charId].roleTag}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {codexT.heroes[charId].passivePowers.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-xl border border-white/15 bg-[#0E1015] px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-1.5">
                      <span className="font-bold text-sm text-cyan-200">{p.name}</span>
                      <span className="font-mono-tabular text-xs font-extrabold text-[#FFC700] shrink-0">
                        {p.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[17px] leading-[1.3] text-[#F4F4F6] max-w-[40ch]">
                      {enforceEightWordRule(p.description)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#FFC700]/45 bg-[#0E1015] px-3 py-2 text-[17px] leading-[1.3] text-[#F4F4F6]">
                <span className="font-extrabold text-[#FFC700]">⚡ {charMeta.overdriveName}:</span>{' '}
                {enforceEightWordRule(charMeta.overdriveDesc)}
              </div>

              {hero.corrode > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-lime-300">
                  <span>
                    ☣ {t.corrodeLabel} {hero.corrode}: -{hero.corrode} Shield gained.
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

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setInspectedTarget(null)}
                className="chrome-pill rounded-lg px-2.5 py-1 text-xs font-bold text-[#F4F4F6] cursor-pointer"
              >
                {t.closeLabel}
              </button>
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
            </div>
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
