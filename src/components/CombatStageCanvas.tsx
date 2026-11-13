import { useEffect, useRef } from 'react';
import { GAME_ASSETS } from '../assets/gameAssets';
import { previewHeroineThreat } from '../engine/gameEngine';
import type { CombatState, HeroineState, TileType, TurnPreview } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  HEROINE_CANONICAL_HEIGHT,
  HEROINE_COMBAT_FRAMES,
  HEROINE_EMOTE_FRAMES,
  HEROINE_SHEET_FRAMES,
  stepHeroineAnimState,
} from '../utils/heroineSpriteSheet';
import { loadSpriteCutout, loadSpriteSheetFrames, measureSpriteBounds } from '../utils/spriteCutout';
import { renderCombatStage } from './combat/combatRenderer';
import {
  type CombatStageSim,
  createCombatStageSim,
  formatEnemyIntent,
  getStageLayoutMetrics,
  resetCombatStageSim,
} from './combat/combatStageTypes';
import {
  applyCombatCues,
  drainTriggerImpacts,
  spawnBolt,
  spawnBurst,
  stepCombatSimulation,
} from './combat/combatVfx';

interface CombatStageCanvasProps {
  runId: string;
  combat: CombatState;
  heroine: HeroineState;
  lang: Language;
  activePreview: TurnPreview | null;
  paused: boolean;
}

export function CombatStageCanvas({
  runId,
  combat,
  heroine,
  lang,
  activePreview,
  paused,
}: CombatStageCanvasProps) {
  const t = TRANSLATIONS[lang];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Latest props stored in refs so rAF loop never tears down
  const combatRef = useRef(combat);
  const heroineRef = useRef(heroine);
  const pausedRef = useRef(paused);
  const hoveredColorRef = useRef<TileType | null>(activePreview?.color ?? null);
  const activePreviewRef = useRef<TurnPreview | null>(activePreview);
  combatRef.current = combat;
  heroineRef.current = heroine;
  pausedRef.current = paused;
  hoveredColorRef.current = activePreview?.color ?? null;
  activePreviewRef.current = activePreview;

  const simRef = useRef<CombatStageSim | null>(null);
  if (!simRef.current) {
    simRef.current = createCombatStageSim();
  }

  const requestDrawRef = useRef<() => void>(() => {});

  // Reset simulation state when starting a new run or entering a new combat node
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    resetCombatStageSim(sim);
    requestDrawRef.current();
  }, [runId, combat.nodeId]);

  // Trigger procedural cues & heroine sprite animations whenever combat.lastCues changes
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    applyCombatCues(sim, combat, heroineRef.current);
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [combat]);

  // Wake renderer if paused state or preview changes while paused
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.needsRedraw = true;
    requestDrawRef.current();
  }, [paused, activePreview, heroine.hp, heroine.shield]);

  // Mount Canvas & Asset Loading once
  useEffect(() => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!sim || !canvas || !container) return;

    const activeSim: CombatStageSim = sim;
    const activeCanvas: HTMLCanvasElement = canvas;
    const activeContainer: HTMLDivElement = container;

    let unmounted = false;
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    function scheduleFrame() {
      if (unmounted || rafId !== 0) return;
      rafId = requestAnimationFrame(renderFrame);
    }

    function renderFrame(now: number) {
      rafId = 0;
      if (unmounted) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const isPaused = pausedRef.current || document.hidden;

      if (isPaused && !activeSim.needsRedraw) {
        return;
      }

      const ctx = activeCanvas.getContext('2d');
      if (!ctx) {
        if (!isPaused) scheduleFrame();
        return;
      }

      const currentCombat = combatRef.current;
      const currentHeroine = heroineRef.current;

      // Apply any newly arrived combat cues before stepping animations so the final hit always plays in full
      applyCombatCues(activeSim, currentCombat, currentHeroine);

      let simDt = 0;
      if (!isPaused) {
        simDt = stepCombatSimulation(activeSim, dt);
        elapsed += simDt;
      }

      const heroSample = stepHeroineAnimState(activeSim.heroState, simDt, {
        isDead: currentHeroine.hp <= 0 || currentCombat.phase === 'DEFEAT',
        isVictory: currentCombat.phase === 'VICTORY' && activeSim.pendingImpacts.length === 0,
        hoveredColor: hoveredColorRef.current,
        totalTime: elapsed,
      });
      activeSim.heroState = heroSample.state;

      if (activeCanvas.dataset.heroAnim !== heroSample.state.mode) {
        activeCanvas.dataset.heroAnim = heroSample.state.mode;
      }

      const heroFrame = heroSample.frame;
      if (!isPaused && simDt > 0) {
        const { heroX, heroY, heroDrawScale } = getStageLayoutMetrics(
          activeSim.size.w,
          activeSim.size.h,
          currentCombat.enemies.length,
          activeSim.dashTargetX,
          heroSample.xProgress,
          heroSample.yHopPx,
          heroFrame.rowScale,
          HEROINE_CANONICAL_HEIGHT,
        );

        if (heroSample.isDashing) {
          activeSim.ghostSampleTimer += simDt;
          if (activeSim.ghostSampleTimer >= 0.028) {
            activeSim.ghostSampleTimer = 0;
            activeSim.ghosts.push({
              x: heroX,
              y: heroY,
              frameIndex: heroSample.frameIndex,
              drawScale: heroDrawScale,
              alpha: 0.42,
            });
            if (activeSim.ghosts.length > 6) activeSim.ghosts.shift();
          }
        } else {
          activeSim.ghostSampleTimer = 0;
        }

        if (heroSample.shouldEmitShot && heroFrame.muzzleRel) {
          const mx = heroX + heroFrame.muzzleRel.dx * heroDrawScale;
          const my = heroY + heroFrame.muzzleRel.dy * heroDrawScale;
          const boltColor = heroSample.state.mode === 'overdrive' ? '#FFC700' : '#00F0FF';
          const triggerKey = heroSample.state.emittedShots === 1 ? 'shot1' : 'shot2';
          const onImpact = drainTriggerImpacts(activeSim, triggerKey);
          spawnBolt(
            activeSim,
            mx,
            my,
            activeSim.pendingShotTargetX,
            activeSim.pendingShotTargetY,
            boltColor,
            onImpact,
          );
          spawnBurst(activeSim, mx, my, 6, '#FDE047', 0, 0.75, 0, 0.28, 0.28, 2, 3.5);
          spawnBurst(
            activeSim,
            heroX + 26 * heroDrawScale,
            heroY - 145 * heroDrawScale,
            3,
            '#FBBF24',
            1,
            0.45,
            0,
            0.28,
            0.28,
            2,
            3.5,
          );
        }

        if (heroSample.shouldEmitKickImpact && heroFrame.kickTipRel) {
          const kx = heroX + heroFrame.kickTipRel.dx * heroDrawScale;
          const ky = heroY + heroFrame.kickTipRel.dy * heroDrawScale;
          activeSim.kickWaveTimer = 0.28;
          activeSim.kickWaveX = kx;
          activeSim.kickWaveY = ky;
          spawnBurst(activeSim, kx, ky, 18, '#FF2E7E', 1, 1.15, 0, 0.28, 0.28, 2, 3.5);
          const kickCb = drainTriggerImpacts(activeSim, 'kick');
          if (kickCb) kickCb();
        }
      }

      renderCombatStage(
        ctx,
        activeSim,
        currentCombat,
        currentHeroine,
        hoveredColorRef.current,
        heroSample,
        elapsed,
        activePreviewRef.current,
      );
      activeSim.needsRedraw = false;

      if (!isPaused) {
        scheduleFrame();
      }
    }

    requestDrawRef.current = scheduleFrame;

    const bg = new Image();
    bg.crossOrigin = 'anonymous';
    bg.onload = () => {
      activeSim.backdropImg = bg;
      activeSim.needsRedraw = true;
      scheduleFrame();
    };
    bg.src = GAME_ASSETS.arenaBackdrop;

    const ensureHeroFrameSlots = () => {
      if (!activeSim.heroFrames) {
        activeSim.heroFrames = new Array<HTMLCanvasElement>(HEROINE_SHEET_FRAMES.length);
      }
      return activeSim.heroFrames;
    };

    void loadSpriteSheetFrames(GAME_ASSETS.heroine, HEROINE_COMBAT_FRAMES, {
      removeInteriorWhite: true,
      minPocketArea: 14,
      defringeStrength: 0.78,
    }).then((frames) => {
      const slots = ensureHeroFrameSlots();
      for (let i = 0; i < frames.length; i++) {
        slots[i] = frames[i];
      }
      activeSim.needsRedraw = true;
      scheduleFrame();
    });

    void loadSpriteSheetFrames(GAME_ASSETS.heroineEmote, HEROINE_EMOTE_FRAMES, {
      removeInteriorWhite: true,
      minPocketArea: 14,
      defringeStrength: 0.78,
      unmixLightGlow: true,
    }).then((frames) => {
      const slots = ensureHeroFrameSlots();
      const offset = HEROINE_COMBAT_FRAMES.length;
      for (let i = 0; i < frames.length; i++) {
        slots[offset + i] = frames[i];
      }
      activeSim.needsRedraw = true;
      scheduleFrame();
    });

    (['stalker', 'spitter', 'brute', 'boss'] as const).forEach((arch) => {
      void loadSpriteCutout(GAME_ASSETS.enemies[arch], {
        removeInteriorWhite: true,
        minPocketArea: 18,
        defringeStrength: 0.78,
      }).then((cut) => {
        activeSim.enemyCutouts.set(arch, {
          canvas: cut,
          bounds: measureSpriteBounds(cut),
        });
        activeSim.needsRedraw = true;
        scheduleFrame();
      });
    });

    const updateSize = () => {
      const rect = activeContainer.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(220, Math.floor(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      activeCanvas.width = Math.floor(w * dpr);
      activeCanvas.height = Math.floor(h * dpr);
      activeSim.size = { w, h };
      activeSim.dpr = dpr;
      activeSim.needsRedraw = true;
      scheduleFrame();
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(activeContainer);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        lastTime = performance.now();
        activeSim.needsRedraw = true;
        scheduleFrame();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    scheduleFrame();
    return () => {
      unmounted = true;
      requestDrawRef.current = () => {};
      if (rafId !== 0) cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const frontLivingIdx = combat.enemies.findIndex((e) => e.hp > 0);
  const kiraThreat = previewHeroineThreat(combat, heroine, activePreview);
  const kiraHpPct = Math.max(0, Math.min(100, Math.round((heroine.hp / heroine.maxHp) * 100)));
  const kiraProjHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.projectedHp / heroine.maxHp) * 100)),
  );
  const kiraPreEnemyHpPct = Math.max(
    0,
    Math.min(100, Math.round((kiraThreat.hpBeforeEnemies / heroine.maxHp) * 100)),
  );
  const kiraDmgBarPct = Math.max(0, kiraPreEnemyHpPct - kiraProjHpPct);
  const kiraHealBarPct = Math.max(0, kiraProjHpPct - kiraHpPct);
  const kiraHasHpChange =
    kiraThreat.hpDamageTaken > 0 || kiraThreat.projectedHp !== heroine.hp;

  return (
    <div
      ref={containerRef}
      className="relative h-[280px] sm:h-[340px] lg:h-auto lg:flex-1 min-h-[260px] overflow-hidden bg-[#091126]"
    >
      <canvas
        ref={canvasRef}
        data-testid="combat-canvas"
        className="block h-full w-full"
      />

      {/* Ultra-Sleek Chrome-Visor Stage Telemetry Overlays (Maximizing Sky-Bridge Visibility) */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto flex max-w-6xl items-start justify-between gap-2 px-2.5 sm:px-4">
        {/* Left: KIRA-09 Chrome Lifebar Pod with Incoming Enemy Damage & Death Preview */}
        <div
          data-testid="kira-lifebar-pod"
          data-preview-incoming-dmg={kiraThreat.hpDamageTaken}
          data-preview-lethal={kiraThreat.willDie ? 'true' : 'false'}
          className={`w-44 sm:w-56 rounded-lg px-2.5 py-1.5 transition-all duration-200 shrink-0 ${
            kiraThreat.willDie
              ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)] backdrop-blur-md'
              : kiraThreat.hpDamageTaken > 0
                ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)] backdrop-blur-md'
                : 'chrome-pill border-cyan-200/35 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            <span className="chrome-text-shimmer font-display font-bold tracking-wider whitespace-nowrap">
              KIRA-09
            </span>
            <div className="flex items-center gap-1 font-mono-tabular font-bold shrink-0">
              {kiraHasHpChange ? (
                <>
                  <span className="text-rose-200/80">{heroine.hp}</span>
                  <span className="text-amber-300">→</span>
                  <span
                    className={
                      kiraThreat.willDie
                        ? 'text-[#FF2E7E] font-extrabold'
                        : kiraThreat.projectedHp < heroine.hp
                          ? 'text-[#FFC700]'
                          : 'text-emerald-300'
                    }
                  >
                    {kiraThreat.projectedHp}
                  </span>
                  <span className="text-slate-400">/{heroine.maxHp}</span>
                </>
              ) : (
                <span className="text-rose-200">
                  {heroine.hp}/{heroine.maxHp}
                </span>
              )}
            </div>
          </div>

          {/* Segmented Lifebar with Enemy-Inflicted Damage Chunk & Lethal Death Preview */}
          <div
            className={`relative mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
              kiraThreat.willDie
                ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
                : kiraThreat.hpDamageTaken > 0
                  ? 'ring-1 ring-[#FFC700]/60'
                  : ''
            }`}
          >
            {/* Remaining HP after enemy attacks */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
              style={{ width: `${Math.min(kiraHpPct, kiraProjHpPct)}%` }}
            />
            {/* Net heal segment if projectedHp > current hp */}
            {kiraHealBarPct > 0 && (
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-[#10B981] to-[#6EE7B7] animate-pulse transition-all duration-150"
                style={{ left: `${kiraHpPct}%`, width: `${kiraHealBarPct}%` }}
              />
            )}
            {/* Previewed enemy-inflicted HP loss chunk on Kira's lifebar */}
            {kiraDmgBarPct > 0 && (
              <div
                data-testid="kira-lifebar-preview"
                className={`absolute inset-y-0 transition-all duration-150 ${
                  kiraThreat.willDie
                    ? 'bg-gradient-to-r from-[#FFC700] via-[#FF2E7E] to-white animate-pulse'
                    : 'bg-gradient-to-r from-[#FFC700] to-[#FEF08A] animate-pulse'
                }`}
                style={{
                  left: `${kiraProjHpPct}%`,
                  width: `${kiraDmgBarPct}%`,
                }}
              />
            )}
          </div>

          {/* Shield, Boosts & Corrode Status Row */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono-tabular">
            <div className="flex flex-wrap items-center gap-1.5">
              {(heroine.shield > 0 || kiraThreat.shieldAfterPlayer > 0) && (
                <span className="font-bold text-[#00F0FF] whitespace-nowrap">
                  {t.shieldLabel}{' '}
                  {kiraThreat.shieldAfterPlayer !== heroine.shield
                    ? `${heroine.shield}→${kiraThreat.shieldAfterPlayer}`
                    : heroine.shield}
                </span>
              )}
              {(heroine.damageBoostPct > 0 ||
                (activePreview && activePreview.damageBoostAddedPct > 0)) && (
                <span className="font-bold text-[#FFC700] whitespace-nowrap">
                  +{heroine.damageBoostPct + (activePreview?.damageBoostAddedPct ?? 0)}% DMG
                </span>
              )}
              {heroine.corrode > 0 && (
                <span className="font-bold text-lime-300 whitespace-nowrap">
                  {t.corrodeLabel} {heroine.corrode}
                </span>
              )}
              {kiraThreat.healGained > 0 && (
                <span className="font-bold text-emerald-300 whitespace-nowrap">
                  +{kiraThreat.healGained} {t.hpLabel}
                </span>
              )}
            </div>
          </div>

          {/* Incoming Enemy Inflicted Damage & Death Preview Row */}
          {(kiraThreat.hpDamageTaken > 0 || kiraThreat.rawIncomingDamage > 0) && (
            <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[10px] font-bold">
              {kiraThreat.hpDamageTaken > 0 ? (
                <span className={kiraThreat.willDie ? 'text-[#FF2E7E]' : 'text-[#FFC700]'}>
                  -{kiraThreat.hpDamageTaken} {t.hpLabel}
                  {kiraThreat.blockedDamage > 0 ? ` (${kiraThreat.blockedDamage} BLK)` : ''}
                </span>
              ) : (
                <span className="text-cyan-200">
                  0 DMG ({kiraThreat.blockedDamage} BLK)
                </span>
              )}
              <div className="flex items-center gap-1">
                {kiraThreat.willDie && (
                  <span className="rounded bg-[#FF2E7E] px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-white animate-pulse">
                    ☠ {t.lethalLabel}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Low-Profile Chrome Enemy Intent & Lifebar Pods with Damage/Death Preview */}
        <div className="flex flex-wrap justify-end gap-1.5">
          {combat.enemies.map((enemy, idx) => {
            const isDead = enemy.hp <= 0;
            const intent = enemy.intentCycle[enemy.currentIntentIndex];
            const enemyMeta = t.enemies[enemy.archetype];
            const hpPct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
            const isFrontLiving = idx === frontLivingIdx;
            const rawPreviewDmg =
              activePreview && !isDead
                ? isFrontLiving
                  ? activePreview.totalDamage > 0
                    ? activePreview.totalDamage
                    : activePreview.reflectOnBlock
                  : activePreview.cleaveDamage
                : 0;
            const willBreakArmor = Boolean(
              activePreview &&
                activePreview.color === 'attack' &&
                activePreview.surgeTriggered &&
                isFrontLiving &&
                enemy.armor > 0,
            );
            const pierceRatio =
              activePreview && activePreview.color === 'attack' && activePreview.armorPiercing
                ? 0.3
                : 0;
            const effectiveArmor = willBreakArmor ? 0 : enemy.armor;
            const piercingDmg = Math.floor(rawPreviewDmg * pierceRatio);
            const regularDmg = rawPreviewDmg - piercingDmg;
            const armorAbsorbed = Math.min(effectiveArmor, regularDmg);
            const previewHpLoss =
              rawPreviewDmg > 0 ? Math.min(enemy.hp, regularDmg - armorAbsorbed + piercingDmg) : 0;
            const projectedHp = Math.max(0, enemy.hp - previewHpLoss);
            const willDie = !isDead && rawPreviewDmg > 0 && projectedHp <= 0;
            const remainingHpPct = Math.max(0, Math.round((projectedHp / enemy.maxHp) * 100));
            const dmgBarPct = Math.max(0, hpPct - remainingHpPct);

            return (
              <div
                key={enemy.id}
                data-testid={`enemy-pod-${enemy.id}`}
                data-preview-dmg={rawPreviewDmg}
                data-preview-lethal={willDie ? 'true' : 'false'}
                className={`w-40 sm:w-52 rounded-lg px-2.5 py-1.5 transition-all duration-200 ${
                  isDead
                    ? 'border border-white/10 bg-slate-950/40 opacity-35'
                    : willDie
                      ? 'chrome-pill border-[#FF2E7E] ring-1 ring-[#FF2E7E]/80 shadow-[0_0_16px_rgba(255,46,126,0.45)] backdrop-blur-md'
                      : rawPreviewDmg > 0
                        ? 'chrome-pill border-[#FFC700]/75 shadow-[0_0_12px_rgba(255,199,0,0.28)] backdrop-blur-md'
                        : 'chrome-pill border-cyan-200/35 backdrop-blur-md'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                  <span className="font-display font-bold text-white truncate">
                    {enemyMeta.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono-tabular font-bold shrink-0">
                    {rawPreviewDmg > 0 && !isDead ? (
                      <>
                        <span className="text-rose-200/80">{enemy.hp}</span>
                        <span className="text-amber-300">→</span>
                        <span className={willDie ? 'text-[#FF2E7E] font-extrabold' : 'text-[#FFC700]'}>
                          {projectedHp}
                        </span>
                        <span className="text-slate-400">/{enemy.maxHp}</span>
                      </>
                    ) : (
                      <span className="text-rose-200">
                        {enemy.hp}/{enemy.maxHp}
                      </span>
                    )}
                  </div>
                </div>

                {/* Segmented Lifebar with Damage Chunk & Lethal Death Preview */}
                <div
                  className={`relative mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-950/95 ${
                    willDie
                      ? 'ring-1 ring-[#FF2E7E] shadow-[0_0_10px_rgba(255,46,126,0.65)]'
                      : rawPreviewDmg > 0
                        ? 'ring-1 ring-[#FFC700]/60'
                        : ''
                  }`}
                >
                  {/* Remaining HP after previewed hit */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF2E7E] to-[#FF85B3] transition-all duration-150"
                    style={{ width: `${rawPreviewDmg > 0 ? remainingHpPct : hpPct}%` }}
                  />
                  {/* Previewed HP loss chunk on lifebar */}
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
                </div>

                <div className="mt-1 flex items-center justify-between gap-1.5 text-[10px] font-mono-tabular">
                  {!isDead ? (
                    <span className="font-bold text-lime-300 truncate">
                      {formatEnemyIntent(intent, lang)}
                    </span>
                  ) : (
                    <span className="text-slate-400">KO</span>
                  )}
                  {enemy.armor > 0 && !isDead && (
                    <span
                      className={`font-bold shrink-0 ${
                        willBreakArmor
                          ? 'text-[#FF2E7E] line-through'
                          : armorAbsorbed > 0
                            ? 'text-amber-200'
                            : 'text-[#FFC700]'
                      }`}
                    >
                      {t.armorLabel}{' '}
                      {armorAbsorbed > 0 && !willBreakArmor
                        ? `${enemy.armor}→${Math.max(0, enemy.armor - armorAbsorbed)}`
                        : enemy.armor}
                    </span>
                  )}
                </div>

                {rawPreviewDmg > 0 && !isDead && (
                  <div className="mt-0.5 flex items-center justify-between gap-1 font-mono-tabular text-[10px] font-bold">
                    <span className={willDie ? 'text-[#FF2E7E]' : 'text-[#FFC700]'}>
                      -{previewHpLoss} {t.hpLabel}
                      {armorAbsorbed > 0 && !willBreakArmor ? ` (-${armorAbsorbed} ARM)` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      {willBreakArmor && (
                        <span className="text-[#FFC700] uppercase">{t.armorBreakLabel}</span>
                      )}
                      {willDie && (
                        <span className="rounded bg-[#FF2E7E] px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-white animate-pulse">
                          ☠ {t.lethalLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
