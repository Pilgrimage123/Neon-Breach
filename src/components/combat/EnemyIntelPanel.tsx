import { useEffect, useRef } from 'react';
import {
  ENEMY_CUTOUT_OPTIONS,
  getPreloadedEnemyPortrait,
  loadCrawlerVariantFrames,
  loadEnemyPortrait,
} from '../../assets/assetPreloader';
import { GAME_ASSETS } from '../../assets/gameAssets';
import { PASSIVE_TO_GLOSSARY_TERM } from '../../engine/codexData';
import type { EnemyUnit } from '../../engine/types';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { isCrawlerArchetype } from '../../utils/crawlerSpriteSheet';
import { loadSpriteCutout, measureSpriteBounds } from '../../utils/spriteCutout';
import {
  KEYWORD_NESTED_TOOLTIPS,
  enforceEightWordRule,
  formatEnemyStreamlinedRule,
} from '../../utils/spatialMinimalistUi';
import { ArmorCrestIcon, IntentIcon, ShieldPipIcon } from './CombatIcons';
import {
  type EnemyArmorPreview,
  formatEnemyIntentCompact,
  formatEnemyIntentSummary,
} from './combatEnemyUi';

function renderBoldMarkdownTokens(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={idx}
          className="font-black text-cyan-200 underline decoration-cyan-400/60 underline-offset-2"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

interface EnemyIntelPanelProps {
  enemy: EnemyUnit;
  livingEnemies: readonly EnemyUnit[];
  armorPreview: EnemyArmorPreview;
  conditionActive?: boolean;
  revealEnemyFutureCycle?: boolean;
  lang: Language;
  isCompactLandscape?: boolean;
  onSelectEnemy: (enemyId: string) => void;
  onOpenGlossaryTerm?: (termId: GlossaryTermId) => void;
  onClose: () => void;
}

function EnemyBioScanPortrait({
  archetype,
  compact,
}: {
  archetype: EnemyUnit['archetype'];
  compact: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizePx = compact ? 52 : 84;

  useEffect(() => {
    let cancelled = false;
    const drawCutout = (
      sourceCanvas: HTMLCanvasElement,
      bounds: { centerXRatio: number; bottomRatio: number }
    ) => {
      const target = canvasRef.current;
      if (!target || cancelled) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      target.width = Math.round(sizePx * dpr);
      target.height = Math.round(sizePx * dpr);
      const ctx = target.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, sizePx, sizePx);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
      ctx.lineWidth = 1;
      const step = sizePx / 4;
      for (let g = step; g < sizePx; g += step) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, sizePx);
        ctx.moveTo(0, g);
        ctx.lineTo(sizePx, g);
        ctx.stroke();
      }

      const hasDedicatedPortrait = Boolean(GAME_ASSETS.enemyPortraits[archetype]);
      const pad = hasDedicatedPortrait ? 2 : 6;
      const drawDim = sizePx - pad * 2;
      const cx = sizePx * 0.5;
      const baseBottomY = hasDedicatedPortrait ? sizePx - 2 : sizePx - 6;
      ctx.save();
      ctx.translate(cx, baseBottomY);
      ctx.drawImage(
        sourceCanvas,
        -drawDim * bounds.centerXRatio,
        -drawDim * bounds.bottomRatio,
        drawDim,
        drawDim
      );
      ctx.restore();
      ctx.restore();
    };

    const cached = getPreloadedEnemyPortrait(archetype);
    if (cached) {
      drawCutout(cached.canvas, cached.bounds);
      return;
    }

    if (
      GAME_ASSETS.enemyPortraits[archetype] ||
      archetype === 'stalker' ||
      archetype === 'spitter' ||
      archetype === 'brute'
    ) {
      void loadEnemyPortrait(archetype)
        .then((cut) => {
          if (cancelled || !cut) return;
          drawCutout(cut, measureSpriteBounds(cut));
        })
        .catch(() => {});
    } else if (isCrawlerArchetype(archetype)) {
      void loadCrawlerVariantFrames(archetype)
        .then((frames) => {
          if (cancelled || !frames[0]) return;
          drawCutout(frames[0], measureSpriteBounds(frames[0]));
        })
        .catch(() => {});
    } else {
      void loadSpriteCutout(GAME_ASSETS.enemies[archetype], ENEMY_CUTOUT_OPTIONS)
        .then((cut) => {
          if (cancelled) return;
          drawCutout(cut, measureSpriteBounds(cut));
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [archetype, sizePx]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border bg-[#0E1015] ${
        archetype === 'boss'
          ? 'border-[#84CC16]/65 shadow-[inset_0_0_24px_rgba(132,204,22,0.22)]'
          : archetype === 'brute'
            ? 'border-[#FFC700]/60 shadow-[inset_0_0_24px_rgba(255,199,0,0.18)]'
            : archetype === 'stalker'
              ? 'border-[#FF2E7E]/70 shadow-[inset_0_0_24px_rgba(255,46,126,0.24)]'
              : archetype === 'spitter'
                ? 'border-[#A3E635]/70 shadow-[inset_0_0_24px_rgba(163,230,53,0.22)]'
                : 'border-cyan-300/45 shadow-[inset_0_0_24px_rgba(0,240,255,0.16)]'
      }`}
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M2 12V2H12M52 2H62V12M2 52V62H12M52 62H62V52"
          fill="none"
          stroke="rgba(165,243,252,0.55)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function EnemyIntelPanel({
  enemy,
  livingEnemies,
  armorPreview,
  conditionActive = false,
  revealEnemyFutureCycle = true,
  lang,
  isCompactLandscape = false,
  onSelectEnemy,
  onOpenGlossaryTerm,
  onClose,
}: EnemyIntelPanelProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  const meta = t.enemies[enemy.archetype];
  const passiveInfo = t.enemyPassives[enemy.passive];
  const intent = enemy.intentCycle[enemy.currentIntentIndex];

  const streamlined = formatEnemyStreamlinedRule(enemy, lang);

  const hpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
  const projHpPct = Math.max(
    0,
    Math.min(100, Math.round((armorPreview.projectedHp / enemy.maxHp) * 100))
  );
  const dmgPct = Math.max(0, hpPct - projHpPct);
  const hasArmor = enemy.armor > 0;
  const hasShieldPips = enemy.shieldPips > 0 || enemy.maxShieldPips > 0;
  const armorScaleMax = Math.max(enemy.armor, 12);
  const armorPct = hasArmor ? Math.min(100, Math.round((enemy.armor / armorScaleMax) * 100)) : 0;
  const remainingArmorPct =
    hasArmor && !armorPreview.willBreakArmor
      ? Math.min(100, Math.round((armorPreview.remainingArmor / armorScaleMax) * 100))
      : 0;

  const currentLivingIdx = livingEnemies.findIndex((e) => e.id === enemy.id);
  const hasMultipleTargets = livingEnemies.length > 1 && currentLivingIdx !== -1;

  const handleCycleTarget = (dir: -1 | 1) => {
    if (!hasMultipleTargets) return;
    const nextIdx = (currentLivingIdx + dir + livingEnemies.length) % livingEnemies.length;
    onSelectEnemy(livingEnemies[nextIdx].id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      role="region"
      data-testid="combat-detail-card"
      aria-label={`${meta.name} ${t.tacticalInfoButton}`}
      onClick={(e) => e.stopPropagation()}
      className={`aaa-charcoal-surface pointer-events-auto absolute left-2 right-2 bottom-1.5 sm:bottom-2 z-30 mx-auto max-w-4xl max-h-[calc(100%-10px)] overflow-y-auto rounded-2xl border-2 ${
        hasArmor
          ? 'border-[#FFC700]/75 shadow-[0_14px_40px_rgba(2,6,23,0.95)]'
          : 'border-cyan-300/75 shadow-[0_14px_40px_rgba(2,6,23,0.95)]'
      } bg-[#181A20]/98 text-[#F4F4F6] ${
        isCompactLandscape ? 'px-2.5 py-1.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
      }`}
    >
      <div className={`flex items-start ${isCompactLandscape ? 'gap-2' : 'gap-3 sm:gap-4'}`}>
        {/* Left: Bio-Scan Cutout Portrait + Target Switcher */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <EnemyBioScanPortrait archetype={enemy.archetype} compact={isCompactLandscape} />
          {hasMultipleTargets && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous enemy"
                onClick={() => handleCycleTarget(-1)}
                className="chrome-pill flex h-7 w-7 items-center justify-center rounded text-[13px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                ‹
              </button>
              <span className="font-mono-tabular text-[13px] font-bold text-[#F4F4F6]">
                {currentLivingIdx + 1}/{livingEnemies.length}
              </span>
              <button
                type="button"
                aria-label="Next enemy"
                onClick={() => handleCycleTarget(1)}
                className="chrome-pill flex h-7 w-7 items-center justify-center rounded text-[13px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Center: Unit Title (24-28px), Big Board Numbers (28-36px), and <=8-Word Rules */}
        <div className={`min-w-0 flex-1 ${isCompactLandscape ? 'space-y-1' : 'space-y-2'}`}>
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3
                  className={`font-display font-extrabold tracking-wide text-[#F4F4F6] ${
                    isCompactLandscape ? 'text-lg' : 'text-[24px] sm:text-[26px] leading-tight'
                  }`}
                >
                  {meta.name}
                </h3>
                <span className="text-xs font-bold text-lime-300">· {meta.classification}</span>
                {enemy.archetype === 'brute' && (
                  <span
                    data-testid="enemy-intel-two-slot"
                    className="rounded-md border border-[#FFC700]/65 bg-amber-500/20 px-1.5 py-0.5 font-mono-tabular text-[12.5px] font-black text-[#FFE066]"
                  >
                    {lang === 'cs' ? '2× POZICE' : '2× SLOTS'}
                  </span>
                )}
                {enemy.staggered && (
                  <span className="rounded-md border border-cyan-300 bg-cyan-500/20 px-2 py-0.5 font-mono-tabular text-xs font-black text-cyan-200">
                    {t.staggeredTag} (0 DMG)
                  </span>
                )}
                {armorPreview.willStagger && !enemy.staggered && (
                  <span className="rounded-md border border-cyan-300 bg-cyan-500/25 px-2 py-0.5 font-mono-tabular text-xs font-black text-cyan-100 animate-pulse">
                    {t.staggerPreviewLabel}
                  </span>
                )}
                {enemy.enragedAlone && (
                  <span className="rounded-md border border-rose-400 bg-rose-500/25 px-2 py-0.5 font-mono-tabular text-xs font-black text-rose-200">
                    {t.enragedAloneTag} ATK
                  </span>
                )}
                {armorPreview.willDie && (
                  <span className="rounded-md border border-[#FF2E7E] bg-[#FF2E7E]/25 px-2 py-0.5 font-mono-tabular text-xs font-black text-white">
                    ☠ {t.lethalLabel}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              data-testid="enemy-intel-close-btn"
              onClick={onClose}
              className="chrome-pill shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-[#F4F4F6] hover:border-cyan-300 cursor-pointer"
            >
              {t.closeLabel}
            </button>
          </div>

          {/* Big Board Numbers (HP & Armor in 28-36px bold stroked numerals) */}
          <div
            className={`grid gap-1.5 sm:gap-2 ${
              isCompactLandscape ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {/* HP Box */}
            <div className="rounded-xl border border-white/15 bg-[#0E1015] px-3 py-1.5">
              <div className="flex items-center justify-between font-mono-tabular">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-200">
                  ♥ {t.hpLabel}
                </span>
                <span className="tactical-numeral-stroke text-[24px] sm:text-[28px] font-black text-[#F4F4F6] leading-none">
                  {armorPreview.rawPreviewDmg > 0 ? (
                    <>
                      <span className="text-rose-200">{enemy.hp}</span>
                      <span className="mx-1 text-amber-300">→</span>
                      <span className={armorPreview.willDie ? 'text-[#FF2E7E]' : 'text-[#FFC700]'}>
                        {armorPreview.projectedHp}
                      </span>
                    </>
                  ) : (
                    <>
                      {enemy.hp}/{enemy.maxHp}
                    </>
                  )}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3]"
                  style={{ width: `${armorPreview.rawPreviewDmg > 0 ? projHpPct : hpPct}%` }}
                />
                {dmgPct > 0 && (
                  <div
                    className="absolute inset-y-0 bg-gradient-to-r from-[#FFC700] to-[#FEF08A]"
                    style={{ left: `${projHpPct}%`, width: `${dmgPct}%` }}
                  />
                )}
              </div>
            </div>

            {/* Armor & Shield Pips Box */}
            <div className="rounded-xl border border-[#FFC700]/45 bg-[#0E1015] px-3 py-1.5">
              <div className="flex items-center justify-between font-mono-tabular">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FFE066]">
                  <ArmorCrestIcon size={14} broken={armorPreview.willBreakArmor} />
                  <span>{t.armorLabel}</span>
                  {onOpenGlossaryTerm && (
                    <button
                      type="button"
                      data-testid="enemy-intel-armor-glossary"
                      onClick={() => onOpenGlossaryTerm('armor')}
                      title={codexT.openTermHint}
                      aria-label={`${t.armorLabel}: ${codexT.openTermHint}`}
                      className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-amber-300/60 bg-amber-950/60 text-[12px] font-extrabold text-amber-200 hover:border-amber-200 hover:text-white cursor-pointer"
                    >
                      ?
                    </button>
                  )}
                  {hasShieldPips && (
                    <button
                      type="button"
                      data-testid="enemy-intel-shield-pips"
                      onClick={() => onOpenGlossaryTerm?.('aegis_pip')}
                      title={codexT.openTermHint}
                      className="ml-1 inline-flex items-center gap-0.5 rounded border border-sky-300/55 bg-sky-950/80 px-1.5 py-0.5 text-[12px] font-extrabold text-sky-200 hover:border-sky-200 cursor-pointer"
                    >
                      <ShieldPipIcon size={11} cracked={armorPreview.willCrackShieldPip} />
                      <span>
                        {armorPreview.willCrackShieldPip
                          ? `${enemy.shieldPips}→${armorPreview.remainingShieldPips}`
                          : enemy.shieldPips}{' '}
                        {t.pipShort}
                      </span>
                    </button>
                  )}
                </span>
                <span className="tactical-numeral-stroke text-[24px] sm:text-[28px] font-black text-[#FFC700] leading-none">
                  {hasArmor
                    ? armorPreview.armorAbsorbed > 0
                      ? `${enemy.armor}→${armorPreview.remainingArmor}`
                      : enemy.armor
                    : 0}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
                {hasArmor && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D97706] via-[#FFC700] to-[#FEF08A]"
                      style={{
                        width: `${armorPreview.rawPreviewDmg > 0 ? remainingArmorPct : armorPct}%`,
                      }}
                    />
                    {armorPreview.rawPreviewDmg > 0 && armorPct > remainingArmorPct && (
                      <div
                        className="absolute inset-y-0 bg-white/85"
                        style={{
                          left: `${remainingArmorPct}%`,
                          width: `${armorPct - remainingArmorPct}%`,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Streamlined Passive & Intent Rules (Strictly <= 8 Words, 20-22px body, max 40ch) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {passiveInfo && (
              <div
                data-testid="enemy-intel-lock-rule"
                className="rounded-xl border border-cyan-300/40 bg-[#0E1015] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <span>
                      {t.passiveLabel}: {passiveInfo.name}
                    </span>
                    {onOpenGlossaryTerm && (
                      <button
                        type="button"
                        data-testid="enemy-intel-passive-glossary"
                        onClick={() => onOpenGlossaryTerm(PASSIVE_TO_GLOSSARY_TERM[enemy.passive])}
                        title={codexT.openTermHint}
                        aria-label={`${passiveInfo.name}: ${codexT.openTermHint}`}
                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-950/60 text-[12px] font-extrabold text-cyan-200 hover:border-cyan-200 hover:text-white cursor-pointer"
                      >
                        ?
                      </button>
                    )}
                  </span>
                </div>
                <div className="mt-1 text-[19px] sm:text-[20px] font-semibold leading-[1.3] text-[#F4F4F6] text-left max-w-[40ch]">
                  {renderBoldMarkdownTokens(enforceEightWordRule(streamlined.shortRule))}
                </div>
              </div>
            )}

            {/* Next Action & Action Cycle */}
            <div className="flex flex-col justify-between gap-1.5 rounded-xl border border-lime-300/40 bg-[#0E1015] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900">
                  <IntentIcon kind={intent.kind} size={17} />
                </div>
                <span
                  className={`font-mono-tabular text-sm font-black ${
                    enemy.staggered
                      ? 'text-cyan-300'
                      : conditionActive
                        ? 'text-[#FF2E7E]'
                        : 'text-lime-300'
                  }`}
                >
                  {formatEnemyIntentSummary(intent, lang, enemy.enrageAtkBonus ?? 0, {
                    staggered: enemy.staggered,
                    conditionActive,
                  })}
                </span>
              </div>
              <div className="text-[19px] sm:text-[20px] font-semibold leading-[1.3] text-[#F4F4F6] text-left max-w-[40ch]">
                {renderBoldMarkdownTokens(enforceEightWordRule(streamlined.counterMath))}
              </div>
              {enemy.intentCycle.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {enemy.intentCycle.map((step, stepIdx) => {
                    const isCurrent = stepIdx === enemy.currentIntentIndex;
                    const masked = !revealEnemyFutureCycle && !isCurrent;
                    return (
                      <div
                        key={`${enemy.id}_cycle_${stepIdx}`}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-tabular text-[13px] ${
                          isCurrent
                            ? 'border border-lime-300/80 bg-lime-400/20 font-bold text-white'
                            : 'border border-white/10 bg-slate-900/80 text-slate-300'
                        }`}
                      >
                        {!masked && <IntentIcon kind={step.kind} size={12} />}
                        <span>
                          {masked
                            ? '???'
                            : formatEnemyIntentCompact(
                                step,
                                lang,
                                enemy.enrageAtkBonus ?? 0,
                                isCurrent ? { staggered: enemy.staggered, conditionActive } : undefined,
                              )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Nested Keyword Side-Box for Enemy Mechanics */}
          {streamlined.keywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/45 bg-[#0E1015]/95 px-3 py-1.5">
              {streamlined.keywords.map((kwId) => {
                const kw = KEYWORD_NESTED_TOOLTIPS[kwId];
                if (!kw) return null;
                return (
                  <div key={kwId} className="flex items-center gap-2 text-sm text-[#F4F4F6]">
                    <span className="rounded bg-cyan-500/25 px-1.5 py-0.5 font-display font-black uppercase text-cyan-200">
                      {kw.icon} {lang === 'cs' ? kw.labelCs : kw.labelEn}
                    </span>
                    <span className="text-[17px] leading-[1.3] text-[#F4F4F6]">
                      {enforceEightWordRule(lang === 'cs' ? kw.ruleCs : kw.ruleEn)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
