import { useEffect, useRef } from 'react';
import { getPreloadedNurseFrames, loadNurseFrames } from '../../assets/assetPreloader';
import {
  createNaniteParticlePool,
  emitFloorProjectorSparks,
  emitScanlineMotes,
  emitSyringeBiogel,
  emitTransitionStream,
  renderNaniteParticles,
  updateNaniteParticles,
} from '../../utils/bioNaniteParticles';
import {
  NURSE_CANONICAL_HEIGHT,
  sampleNurseAnimation,
  type MedBayOptionId,
} from '../../utils/nurseSpriteSheet';

export interface NurseStageCanvasProps {
  focusedOption: MedBayOptionId | null;
  hpRatio: number;
  pulseCount: number;
  isCompactLandscape: boolean;
  nurseName: string;
  nurseRole: string;
  onPulseClick: () => void;
}

export function NurseStageCanvas({
  focusedOption,
  hpRatio,
  pulseCount,
  isCompactLandscape,
  nurseName,
  nurseRole,
  onPulseClick,
}: NurseStageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLCanvasElement[] | null>(getPreloadedNurseFrames());
  const focusedOptionRef = useRef<MedBayOptionId | null>(focusedOption);
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

          const centerX = w * 0.5;
          const groundY = h - 22;
          ctx.save();
          const floorGlow = ctx.createRadialGradient(centerX, groundY, 2, centerX, groundY, w * 0.42);
          floorGlow.addColorStop(0, `rgba(${primaryRgb}, 0.38)`);
          floorGlow.addColorStop(0.65, 'rgba(236, 72, 153, 0.12)');
          floorGlow.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = floorGlow;
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.42, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.beginPath();
          ctx.ellipse(centerX, groundY, w * 0.36, 11, 0, 0, Math.PI * 2);
          ctx.fill();

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

              const needleCanvasX = centerX + (cf.w - cf.anchorX - 38 + warp.currWarpX) * drawScale;
              const needleCanvasY = groundY + (-cf.bottomY + 115 + warp.currWarpY + sample.yOffsetPx) * drawScale;

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

              emitSyringeBiogel(particlePoolRef.current, needleCanvasX, needleCanvasY, primaryRgb, dt);
            }
          }

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

  return (
    <div
      data-testid="medbay-nurse-stage"
      className={`relative z-20 flex shrink-0 flex-col items-center justify-end select-none ${
        isCompactLandscape
          ? 'w-[150px] sm:w-[170px] -mb-1'
          : 'w-full max-w-[340px] lg:w-[320px] xl:w-[360px] lg:-mr-4 xl:-mr-6'
      }`}
    >
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

      <button
        type="button"
        onClick={onPulseClick}
        title={nurseName}
        className={`group pointer-events-auto relative flex items-center gap-2 rounded-xl border border-pink-400/40 bg-slate-950/85 shadow-[0_4px_20px_rgba(236,72,153,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md transition-all hover:border-pink-300 hover:bg-slate-900/95 cursor-pointer ${
          isCompactLandscape ? '-mt-3 px-2 py-1' : '-mt-4 px-3 py-1.5'
        }`}
      >
        <div className="flex flex-col text-left">
          <span className="font-display text-[13px] font-bold tracking-wide text-pink-200 group-hover:text-pink-100">
            {nurseName}
          </span>
          <span className="font-mono-tabular text-[11.5px] uppercase tracking-wider text-emerald-300/90">
            {nurseRole} · <span className="text-pink-300">BIO-MED AI</span>
          </span>
        </div>
        <span className="font-mono-tabular text-[12px] font-bold text-pink-300/80 group-hover:text-pink-200">
          ⚡
        </span>
      </button>
    </div>
  );
}
