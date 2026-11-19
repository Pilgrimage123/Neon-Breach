import { useEffect, useRef, useState } from 'react';
import { getPreloadedNurseFrames, loadNurseFrames } from '../assets/assetPreloader';
import { MAX_OVERCLOCK_STACKS } from '../engine/data';
import type { RunState } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  createNaniteParticlePool,
  emitFloorProjectorSparks,
  emitScanlineMotes,
  emitSyringeBiogel,
  emitTransitionStream,
  renderNaniteParticles,
  updateNaniteParticles,
} from '../utils/bioNaniteParticles';
import {
  NURSE_CANONICAL_HEIGHT,
  sampleNurseAnimation,
  type MedBayOptionId,
} from '../utils/nurseSpriteSheet';

export type MedBayActionType =
  | 'heal'
  | 'calibrate_max_hp'
  | 'salvage_credits'
  | 'tile_overclock'
  | 'hearth_grandparents'
  | 'hearth_spouse'
  | 'hearth_kids';

interface BioMedBayViewProps {
  run: RunState;
  lang: Language;
  isCompactLandscape?: boolean;
  onAction: (action: MedBayActionType) => void;
}

export function BioMedBayView({
  run,
  lang,
  isCompactLandscape = false,
  onAction,
}: BioMedBayViewProps) {
  const t = TRANSLATIONS[lang];
  const charMeta = t.characters[run.heroine.characterId ?? 'kira'];
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFundedClinic = currentNode?.modifier === 'funded_clinic';
  const hpRatio = Math.max(0, Math.min(1, run.heroine.hp / Math.max(1, run.heroine.maxHp)));
  const isHighHp = run.heroine.hp >= Math.round(run.heroine.maxHp * 0.75);
  const isCriticalHp = run.heroine.hp <= Math.round(run.heroine.maxHp * 0.5);
  const healedHp = Math.min(run.heroine.maxHp, run.heroine.hp + 22 + (isFundedClinic ? 12 : 0));
  const calibratedMaxHp = run.heroine.maxHp + 10;
  const nanites = run.heroine.nanites ?? 0;
  const overclockStacks = Math.min(MAX_OVERCLOCK_STACKS, Math.max(0, run.heroine.overclockCount ?? 0));
  const overclockMaxed = overclockStacks >= MAX_OVERCLOCK_STACKS;

  const [focusedOption, setFocusedOption] = useState<MedBayOptionId | null>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLCanvasElement[] | null>(getPreloadedNurseFrames());
  const focusedOptionRef = useRef<MedBayOptionId | null>(null);
  const flashTimerRef = useRef<number>(0);
  const hpRatioRef = useRef<number>(hpRatio);
  const particlePoolRef = useRef(createNaniteParticlePool(120));
  const lastStepIndexRef = useRef<number>(-1);

  useEffect(() => {
    focusedOptionRef.current = focusedOption;
  }, [focusedOption]);

  useEffect(() => {
    hpRatioRef.current = hpRatio;
  }, [hpRatio]);

  useEffect(() => {
    if (pulseCount > 0) {
      flashTimerRef.current = 0.85;
    }
  }, [pulseCount]);

  useEffect(() => {
    let cancelled = false;
    if (!framesRef.current) {
      void loadNurseFrames()
        .then((loaded) => {
          if (!cancelled) {
            framesRef.current = loaded;
          }
        })
        .catch(() => {});
    }

    let rafId = 0;
    let lastTs = performance.now();
    const startTs = lastTs;

    const renderLoop = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const elapsed = (now - startTs) / 1000;

      if (flashTimerRef.current > 0) {
        flashTimerRef.current = Math.max(0, flashTimerRef.current - dt);
      }

      // Advance physics of all active bio-nanite particles
      updateNaniteParticles(particlePoolRef.current, dt);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const activeOpt = focusedOptionRef.current;
          const primaryRgb =
            activeOpt === 'heal'
              ? '16, 245, 160'
              : activeOpt === 'calibrate_max_hp'
                ? '0, 240, 255'
                : activeOpt === 'salvage_credits'
                  ? '255, 199, 0'
                  : activeOpt === 'tile_overclock'
                    ? '217, 70, 239'
                    : hpRatioRef.current <= 0.45
                      ? '255, 46, 126'
                      : '16, 245, 160';

          // High-tech holographic floor emitter pad under her boots
          const centerX = w * 0.5;
          const groundY = h - 22;
          ctx.save();
          // Soft radial floor lighting (elliptical, never rectangular)
          const floorGlow = ctx.createRadialGradient(centerX, groundY, 2, centerX, groundY, w * 0.42);
          floorGlow.addColorStop(0, `rgba(${primaryRgb}, 0.38)`);
          floorGlow.addColorStop(0.65, 'rgba(236, 72, 153, 0.12)');
          floorGlow.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = floorGlow;
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.42, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Base emitter disc
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.36, 11, 0, 0, Math.PI * 2);
          ctx.fill();

          // Concentric glowing projector rings with dynamic pulse
          ctx.strokeStyle = `rgba(${primaryRgb}, ${0.75 + 0.25 * Math.sin(elapsed * 4)})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.36, 11, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(236, 72, 153, ${0.55 + 0.25 * Math.cos(elapsed * 3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.24, 7, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Sub-ring tick marks
          ctx.strokeStyle = `rgba(${primaryRgb}, 0.55)`;
          ctx.lineWidth = 1.2;
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const rx = w * 0.38;
            const ry = 12;
            const x1 = centerX + Math.cos(angle + elapsed * 0.4) * (rx - 6);
            const y1 = groundY + Math.sin(angle + elapsed * 0.4) * (ry - 2);
            const x2 = centerX + Math.cos(angle + elapsed * 0.4) * (rx + 4);
            const y2 = groundY + Math.sin(angle + elapsed * 0.4) * (ry + 2);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.restore();

          // Emit rising holographic sparks from projector pad
          emitFloorProjectorSparks(particlePoolRef.current, centerX, groundY, w * 0.36, primaryRgb, dt);

          const frames = framesRef.current;
          if (frames && frames.length > 0) {
            const sample = sampleNurseAnimation({
              totalTime: elapsed,
              focusedOption: activeOpt,
              actionFlashTimer: flashTimerRef.current,
              hpRatio: hpRatioRef.current,
            });

            const currCanvas = frames[sample.frameIndex] ?? frames[0];
            const prevCanvas = frames[sample.prevFrameIndex] ?? currCanvas;
            const targetHeight = h * 0.93;
            const drawScale = targetHeight / NURSE_CANONICAL_HEIGHT;
            const warp = sample.trajectoryWarp;

            // Trigger nanite motion streamers on frame step transitions
            if (sample.frameIndex !== lastStepIndexRef.current) {
              lastStepIndexRef.current = sample.frameIndex;
              if (sample.prevFrameIndex !== sample.frameIndex && warp.limbTravelDist > 12) {
                const fromX = centerX + (warp.fromLimbX - sample.prevFrame.anchorX) * drawScale;
                const fromY = groundY + (-sample.prevFrame.bottomY + warp.fromLimbY) * drawScale;
                const toX = centerX + (warp.toLimbX - sample.frame.anchorX) * drawScale;
                const toY = groundY + (-sample.frame.bottomY + warp.toLimbY) * drawScale;
                emitTransitionStream(particlePoolRef.current, fromX, fromY, toX, toY, primaryRgb, 14);
              }
            }

            if (currCanvas) {
              // 1. Holographic scan line traveling vertically through her body
              const scanY = groundY - targetHeight * (0.12 + 0.74 * (0.5 + 0.5 * Math.sin(elapsed * 1.5)));
              emitScanlineMotes(particlePoolRef.current, centerX, scanY, w * 0.38, primaryRgb, dt);

              ctx.save();
              const scanGrad = ctx.createLinearGradient(centerX - w * 0.32, scanY, centerX + w * 0.32, scanY);
              scanGrad.addColorStop(0, 'rgba(0,0,0,0)');
              scanGrad.addColorStop(0.2, `rgba(${primaryRgb}, 0.22)`);
              scanGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
              scanGrad.addColorStop(0.8, `rgba(${primaryRgb}, 0.22)`);
              scanGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = scanGrad;
              ctx.fillRect(centerX - w * 0.32, scanY - 1, w * 0.64, 2);
              ctx.restore();

              // 2. Trajectory-Aligned Morphological Sub-pixel In-Betweening:
              // prevFrame glides forward along the motion vector by +t
              if (prevCanvas && sample.prevFrameIndex !== sample.frameIndex && sample.blendAlpha < 0.999) {
                const pf = sample.prevFrame;
                ctx.save();
                ctx.translate(
                  centerX + warp.prevWarpX * drawScale,
                  groundY + sample.yOffsetPx + warp.prevWarpY * drawScale,
                );
                if (Math.abs(sample.tiltRad + warp.prevWarpRot) > 0.0005) {
                  ctx.rotate(sample.tiltRad + warp.prevWarpRot);
                }
                ctx.scale(sample.breathScaleX, sample.breathScaleY);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.globalAlpha = Math.min(1, 2 * (1 - sample.blendAlpha));
                ctx.drawImage(
                  prevCanvas,
                  -pf.anchorX * drawScale,
                  -pf.bottomY * drawScale,
                  pf.w * drawScale,
                  pf.h * drawScale,
                );
                ctx.restore();
              }

              // 3. currFrame glides into place from -(1 - t) along the motion vector
              const cf = sample.frame;
              ctx.save();
              ctx.translate(
                centerX + warp.currWarpX * drawScale,
                groundY + sample.yOffsetPx + warp.currWarpY * drawScale,
              );
              if (Math.abs(sample.tiltRad + warp.currWarpRot) > 0.0005) {
                ctx.rotate(sample.tiltRad + warp.currWarpRot);
              }
              ctx.scale(sample.breathScaleX, sample.breathScaleY);
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.globalAlpha = sample.prevFrameIndex === sample.frameIndex ? 1 : sample.blendAlpha;
              ctx.drawImage(
                currCanvas,
                -cf.anchorX * drawScale,
                -cf.bottomY * drawScale,
                cf.w * drawScale,
                cf.h * drawScale,
              );
              ctx.restore();

              // 4. Action Flash / Chrono-Displacement Afterimage Trail
              if (flashTimerRef.current > 0.08) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = Math.min(0.42, flashTimerRef.current * 0.45);
                ctx.drawImage(
                  currCanvas,
                  centerX + (warp.currWarpX - 4) * drawScale - cf.anchorX * drawScale,
                  groundY + (sample.yOffsetPx - 3) * drawScale - cf.bottomY * drawScale,
                  cf.w * drawScale,
                  cf.h * drawScale,
                );
                ctx.drawImage(
                  currCanvas,
                  centerX + (warp.currWarpX + 4) * drawScale - cf.anchorX * drawScale,
                  groundY + (sample.yOffsetPx + 3) * drawScale - cf.bottomY * drawScale,
                  cf.w * drawScale,
                  cf.h * drawScale,
                );
                ctx.restore();
              }

              // 5. Syringe needle coordinates in canvas space
              const needleCanvasX = centerX + (cf.w - cf.anchorX - 38 + warp.currWarpX) * drawScale;
              const needleCanvasY = groundY + (-cf.bottomY + 115 + warp.currWarpY + sample.yOffsetPx) * drawScale;

              // Biogel glowing tip aura
              ctx.save();
              const sGlow = ctx.createRadialGradient(
                needleCanvasX,
                needleCanvasY,
                1,
                needleCanvasX,
                needleCanvasY,
                26 * sample.syringePulse,
              );
              sGlow.addColorStop(0, `rgba(${primaryRgb}, ${0.58 * sample.syringePulse})`);
              sGlow.addColorStop(0.5, `rgba(255, 46, 166, ${0.28 * sample.syringePulse})`);
              sGlow.addColorStop(1, 'rgba(255, 46, 166, 0)');
              ctx.fillStyle = sGlow;
              ctx.beginPath();
              ctx.arc(needleCanvasX, needleCanvasY, 26 * sample.syringePulse, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              // Emit continuous sparkling biogel particles from needle tip
              emitSyringeBiogel(particlePoolRef.current, needleCanvasX, needleCanvasY, primaryRgb, dt);
            }
          }

          // 6. Render all active bio-nanite particles with glowing additive blending
          renderNaniteParticles(ctx, particlePoolRef.current);
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  const nurseQuote =
    focusedOption === 'heal'
      ? t.medbayNurseHoverHeal
      : focusedOption === 'calibrate_max_hp'
        ? t.medbayNurseHoverCalibrate
        : focusedOption === 'salvage_credits'
          ? t.medbayNurseHoverSalvage
          : focusedOption === 'tile_overclock'
            ? t.medbayNurseHoverOverclock
            : isCriticalHp
              ? t.medbayNurseIdleCritical
              : t.medbayNurseIdleNominal;

  const triggerAction = (action: MedBayActionType) => {
    setPulseCount((c) => c + 1);
    onAction(action);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') {
        e.preventDefault();
        triggerAction('heal');
      } else if (e.key === '2') {
        e.preventDefault();
        triggerAction('calibrate_max_hp');
      } else if (e.key === '3') {
        e.preventDefault();
        triggerAction('salvage_credits');
      } else if (e.key === '4' && !overclockMaxed) {
        e.preventDefault();
        triggerAction('tile_overclock');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <main
      className={`cyber-vista-bg relative flex flex-1 min-h-0 w-full flex-col items-center overflow-y-auto ${
        isCompactLandscape ? 'p-1.5' : 'p-2.5 sm:p-4 lg:p-6'
      }`}
    >
      <div
        className={`relative my-auto flex w-full max-w-7xl items-end justify-center ${
          isCompactLandscape
            ? 'flex-row gap-2'
            : 'flex-col lg:flex-row gap-4 lg:gap-5'
        }`}
      >
        {/* Freestanding Chief Bio-Tech Officer Dr. Amara Vance Stage */}
        <div
          data-testid="medbay-nurse-stage"
          className={`relative z-20 flex shrink-0 flex-col items-center justify-end select-none ${
            isCompactLandscape
              ? 'w-[150px] sm:w-[170px] -mb-1'
              : 'w-full max-w-[340px] lg:w-[320px] xl:w-[360px] lg:-mr-4 xl:-mr-6'
          }`}
        >
          {/* Animated Chief Bio-Tech Nurse Sprite Canvas (Freestanding, 3x Bigger) */}
          <canvas
            ref={canvasRef}
            width={isCompactLandscape ? 260 : 380}
            height={isCompactLandscape ? 340 : 640}
            data-testid="medbay-nurse-canvas"
            className={`pointer-events-none object-contain filter drop-shadow-[0_16px_36px_rgba(0,0,0,0.85)] ${
              isCompactLandscape
                ? 'h-[270px] sm:h-[300px] w-auto'
                : 'h-[360px] sm:h-[460px] md:h-[520px] lg:h-[560px] xl:h-[620px] w-auto'
            }`}
          />

          {/* Interactive Holographic Identity Plaque beneath her boots */}
          <button
            type="button"
            onClick={() => setPulseCount((c) => c + 1)}
            title={t.medbayNurseName}
            className={`group pointer-events-auto relative flex items-center gap-2 rounded-xl border border-pink-400/40 bg-slate-950/85 shadow-[0_4px_20px_rgba(236,72,153,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md transition-all hover:border-pink-300 hover:bg-slate-900/95 cursor-pointer ${
              isCompactLandscape ? '-mt-3 px-2 py-1' : '-mt-4 px-3 py-1.5'
            }`}
          >
            <div className="flex flex-col text-left">
              <span className="font-display text-xs font-bold tracking-wide text-pink-200 group-hover:text-pink-100">
                {t.medbayNurseName}
              </span>
              <span className="font-mono-tabular text-[9px] uppercase tracking-wider text-emerald-300/90">
                {t.medbayNurseRole} · <span className="text-pink-300">BIO-MED AI</span>
              </span>
            </div>
            <span className="font-mono-tabular text-[10px] font-bold text-pink-300/80 group-hover:text-pink-200">
              ⚡
            </span>
          </button>
        </div>

        {/* The Terminal Card Panel */}
        <div
          data-testid="medbay-terminal-panel"
          className={`chrome-glass relative z-10 flex-1 min-w-0 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between ${
            isCompactLandscape
              ? 'p-2.5 gap-2 max-h-[360px]'
              : 'p-3.5 sm:p-5 gap-3'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono-tabular text-xs font-bold uppercase tracking-wider">
                  {t.medbayTitle}
                </span>
                <h1
                  className={`chrome-text-shimmer font-display font-bold ${
                    isCompactLandscape ? 'text-sm sm:text-base' : 'text-base md:text-xl'
                  }`}
                >
                  {t.medbaySubtitle.replace('{name}', charMeta.name)}
                </h1>
                {isFundedClinic && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-lime-500/20 border border-lime-400/60 text-lime-300 font-mono-tabular text-[10px] font-bold uppercase tracking-wider">
                    {t.bountyFundedClinicBadge}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono-tabular font-bold text-slate-200">
                ♥ {run.heroine.hp}/{run.heroine.maxHp} · ◈ {run.heroine.credits} · 💎 {nanites}
              </span>
            </div>

            {/* Unified Nurse Diagnostic & Status Bar (consolidates funded/greedy/risk notices into 1 row) */}
            <div
              data-testid="medbay-nurse-dialogue"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-pink-400/35 bg-gradient-to-r from-pink-950/45 via-slate-900/75 to-emerald-950/35 px-3 py-1.5 text-xs text-pink-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-pink-300">
                  [{t.medbayNurseName}]:
                </span>
                <span className="truncate font-mono-tabular text-[11px] sm:text-xs text-slate-100">
                  “{nurseQuote}”
                </span>
              </div>
              <span className="shrink-0 font-mono-tabular text-[10px] font-bold text-emerald-300">
                {isFundedClinic
                  ? `✦ ${t.fundedClinicAllActionsNote}`
                  : isHighHp
                    ? `⚡ ${t.greedyClinicNotice}`
                    : isCriticalHp
                      ? `⚠ ${t.opportunityCostNotice}`
                      : ''}
              </span>
            </div>
          </div>

          {/* 4 Full-Card Clickable Procedure Cards */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 ${
              isCompactLandscape ? 'gap-2' : 'gap-2.5'
            }`}
          >
            {/* Option 1: Bio-Repair */}
            <div
              onMouseEnter={() => setFocusedOption('heal')}
              onMouseLeave={() => setFocusedOption(null)}
              onClick={() => triggerAction('heal')}
              className={`chrome-pill flex flex-col justify-between rounded-xl border-[#10F5A0]/50 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#10F5A0] ${
                      isCompactLandscape ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {t.medbayHealTitle}
                  </h2>
                  <span className="font-mono-tabular text-[10px] font-bold text-emerald-300/80">[1]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ♥ {run.heroine.hp} → {healedHp} / {run.heroine.maxHp}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-300">
                  {t.medbayHealDesc.replace('{name}', charMeta.name)}
                </p>
              </div>
              <button
                type="button"
                onFocus={() => setFocusedOption('heal')}
                onBlur={() => setFocusedOption(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAction('heal');
                }}
                className={`mt-2 w-full rounded-lg bg-gradient-to-r from-[#10F5A0] to-[#6EE7B7] font-bold text-slate-950 shadow-[0_0_20px_rgba(16,245,160,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all hover:brightness-110 cursor-pointer ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                {t.applyRepair}
              </button>
            </div>

            {/* Option 2: Chassis Reinforcement */}
            <div
              onMouseEnter={() => setFocusedOption('calibrate_max_hp')}
              onMouseLeave={() => setFocusedOption(null)}
              onClick={() => triggerAction('calibrate_max_hp')}
              className={`chrome-pill flex flex-col justify-between rounded-xl border-[#00F0FF]/50 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#00F0FF] ${
                      isCompactLandscape ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {t.medbayCalibrateTitle}
                  </h2>
                  <span className="font-mono-tabular text-[10px] font-bold text-cyan-300/80">[2]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ♥ {run.heroine.maxHp} → {calibratedMaxHp} Max
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[10px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-300">
                  {t.medbayCalibrateDesc}
                </p>
              </div>
              <button
                type="button"
                onFocus={() => setFocusedOption('calibrate_max_hp')}
                onBlur={() => setFocusedOption(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAction('calibrate_max_hp');
                }}
                className={`chrome-btn-primary mt-2 w-full rounded-lg font-bold transition-all cursor-pointer ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                {t.applyCalibrate}
              </button>
            </div>

            {/* Option 3: Resource Salvage */}
            <div
              onMouseEnter={() => setFocusedOption('salvage_credits')}
              onMouseLeave={() => setFocusedOption(null)}
              onClick={() => triggerAction('salvage_credits')}
              className={`chrome-pill flex flex-col justify-between rounded-xl border-[#FFC700]/50 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer ${
                isCompactLandscape ? 'p-2' : 'p-3'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <h2
                    className={`font-display font-bold text-[#FFC700] ${
                      isCompactLandscape ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {t.medbaySalvageTitle}
                  </h2>
                  <span className="font-mono-tabular text-[10px] font-bold text-amber-300/80">[3]</span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-sm font-black text-[#F4F4F6]">
                  ◈ {run.heroine.credits} → {run.heroine.credits + 35} CR
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[10px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-300">
                  {t.medbaySalvageDesc}
                </p>
              </div>
              <button
                type="button"
                onFocus={() => setFocusedOption('salvage_credits')}
                onBlur={() => setFocusedOption(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAction('salvage_credits');
                }}
                className={`mt-2 w-full rounded-lg bg-gradient-to-r from-[#FF9900] via-[#FFC700] to-[#FEF08A] font-bold text-slate-950 shadow-[0_0_20px_rgba(255,199,0,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all hover:brightness-110 cursor-pointer ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                {t.applySalvage}
              </button>
            </div>

            {/* Option 4: Neural Overclock & Tile Tuning */}
            <div
              onMouseEnter={() => setFocusedOption('tile_overclock')}
              onMouseLeave={() => setFocusedOption(null)}
              onClick={() => {
                if (!overclockMaxed) triggerAction('tile_overclock');
              }}
              className={`chrome-pill flex flex-col justify-between rounded-xl border-fuchsia-500/50 bg-fuchsia-950/20 transition-transform duration-150 hover:-translate-y-0.5 ${
                overclockMaxed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              } ${isCompactLandscape ? 'p-2' : 'p-3'}`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <h2
                    className={`font-display font-bold text-fuchsia-300 ${
                      isCompactLandscape ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {t.medbayOverclockTitle}
                  </h2>
                  <span className="font-mono-tabular text-[10px] font-bold text-fuchsia-200 border border-fuchsia-400/40 rounded px-1.5 py-0.5">
                    {overclockStacks}/{MAX_OVERCLOCK_STACKS} · [4]
                  </span>
                </div>
                <div className="mt-1.5 font-mono-tabular text-xs font-black text-[#F4F4F6]">
                  {lang === 'cs' ? '⚔+1 (×2) · ⚡+20% OD · Čištění' : '⚔+1 (×2) · ⚡+20% OD · Cleanse'}
                  {isFundedClinic && (
                    <span className="ml-1 text-lime-300 text-[10px]">({t.fundedBonusHpTag})</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-300">
                  {t.medbayOverclockDesc}
                </p>
              </div>
              <button
                type="button"
                disabled={overclockMaxed}
                onFocus={() => setFocusedOption('tile_overclock')}
                onBlur={() => setFocusedOption(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAction('tile_overclock');
                }}
                className={`mt-2 w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 font-bold text-white shadow-[0_0_20px_rgba(217,70,239,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all hover:brightness-110 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  isCompactLandscape ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                {overclockMaxed ? (lang === 'cs' ? 'Max (2/2)' : 'Maxed (2/2)') : t.applyOverclock}
              </button>
            </div>
          </div>

          {/* Streamlined Single-Row Smart-Hearth Quick Bar */}
          <div
            data-testid="medbay-smart-hearth-panel"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-400/35 bg-slate-950/65 px-2.5 py-2"
          >
            <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300 shrink-0 mr-1">
              🏡 {lang === 'cs' ? 'Rodinný Krb:' : 'Hearth:'}
            </span>
            <button
              type="button"
              data-testid="hearth-grandparents-btn"
              onClick={() => triggerAction('hearth_grandparents')}
              className="chrome-pill flex-1 min-w-[160px] flex items-center justify-between gap-1.5 rounded-lg border border-amber-300/45 bg-amber-950/25 px-2.5 py-1.5 text-left hover:border-amber-300 cursor-pointer"
            >
              <span className="font-display text-[11px] font-bold text-amber-200 whitespace-nowrap">
                👵 {lang === 'cs' ? 'Prarodiče' : 'Grandparents'}
              </span>
              <span className="font-mono-tabular text-[10px] font-bold text-[#F4F4F6] truncate">
                {lang === 'cs' ? 'Vadný→★ · 💚+10 HP' : 'Dud→★ · 💚+10 HP'}
              </span>
            </button>

            <button
              type="button"
              data-testid="hearth-spouse-btn"
              onClick={() => triggerAction('hearth_spouse')}
              className="chrome-pill flex-1 min-w-[160px] flex items-center justify-between gap-1.5 rounded-lg border border-cyan-300/45 bg-cyan-950/25 px-2.5 py-1.5 text-left hover:border-cyan-300 cursor-pointer"
            >
              <span className="font-display text-[11px] font-bold text-cyan-200 whitespace-nowrap">
                💍 {lang === 'cs' ? 'Partner' : 'Spouse'}
              </span>
              <span className="font-mono-tabular text-[10px] font-bold text-[#F4F4F6] truncate">
                {lang === 'cs' ? 'ATK×DEF +3 · 💚+14 HP' : 'ATK×DEF +3 · 💚+14 HP'}
              </span>
            </button>

            <button
              type="button"
              data-testid="hearth-kids-btn"
              onClick={() => triggerAction('hearth_kids')}
              className="chrome-pill flex-1 min-w-[160px] flex items-center justify-between gap-1.5 rounded-lg border border-emerald-300/45 bg-emerald-950/25 px-2.5 py-1.5 text-left hover:border-emerald-300 cursor-pointer"
            >
              <span className="font-display text-[11px] font-bold text-emerald-200 whitespace-nowrap">
                🧒 {lang === 'cs' ? 'Děti' : 'The Kids'}
              </span>
              <span className="font-mono-tabular text-[10px] font-bold text-[#F4F4F6] truncate">
                💚+26 HP · ⚡+30% OD
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
