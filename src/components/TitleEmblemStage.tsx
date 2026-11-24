import { useEffect, useRef, useState } from 'react';
import {
  type TitleSpriteSource,
  getPreloadedTitleLockup,
  getPreloadedTitleLogo,
  getPreloadedTitleLogoFrames,
  loadTitleLockup,
  loadTitleLogo,
  loadTitleLogoFrames,
} from '../assets/assetPreloader';
import {
  EMBLEM_ASPECT,
  createTitleEmblemVfxState,
  drawEmblemAmbientHalo,
  drawEmblemParticle,
  drawEmblemRimArc,
  drawEmblemShockwave,
  stepTitleEmblemVfx,
  triggerEmblemClickBurst,
} from '../utils/titleEmblemVfx';
import {
  MESH_VERTEX_COUNT,
  WARP_TRIANGLES,
  computeVertexIdleBreathNormY,
  createMeshWarpScratch,
  renderWarpedFramePair,
} from '../utils/titleMeshWarp';
import {
  XENO_SLIME_NOZZLES,
  createSlimeEngineState,
  renderSlimeEngine,
  stepSlimeEngine,
} from '../utils/titleSlimeEngine';
import {
  createVisorMatrixState,
  renderVisorMatrix,
  stepVisorMatrix,
} from '../utils/titleVisorMatrix';

interface TitleEmblemStageProps {
  className?: string;
  compact?: boolean;
}

export function TitleEmblemStage({
  className = '',
  compact = false,
}: TitleEmblemStageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<(TitleSpriteSource | null)[]>(
    getPreloadedTitleLogoFrames(),
  );
  const lockupRef = useRef<TitleSpriteSource | null>(getPreloadedTitleLockup());
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfxRef = useRef(createTitleEmblemVfxState());
  const visorRef = useRef(createVisorMatrixState());
  const slimeRef = useRef(createSlimeEngineState());
  const meshScratchRef = useRef(createMeshWarpScratch());
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const burstCountRef = useRef(0);
  const lastSeqDatasetRef = useRef({
    active: 'false',
    frameA: 0,
    frameB: 0,
    blendPct: 0,
  });

  const [ready, setReady] = useState<boolean>(() => Boolean(getPreloadedTitleLogo()));
  const [failed, setFailed] = useState(false);

  // Load main cutout logo Frame 0 and Static Lockup Plane immediately, plus progressively decode Frames 1..4
  useEffect(() => {
    let cancelled = false;

    const cachedLockup = getPreloadedTitleLockup();
    if (cachedLockup) {
      lockupRef.current = cachedLockup;
    } else {
      void loadTitleLockup()
        .then((lockup) => {
          if (!cancelled) lockupRef.current = lockup;
        })
        .catch(() => {
          // Degrade gracefully to frame 0 typography if lockup fails to decode
        });
    }

    const cachedFrames = getPreloadedTitleLogoFrames();
    if (cachedFrames.length > 0 && cachedFrames.every(Boolean)) {
      framesRef.current = cachedFrames;
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const cachedLogo = getPreloadedTitleLogo();
    if (cachedLogo) {
      framesRef.current[0] = cachedLogo;
      setReady(true);
    } else {
      void loadTitleLogo()
        .then((cutout) => {
          if (cancelled) return;
          framesRef.current[0] = cutout;
          setReady(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }

    void loadTitleLogoFrames((idx, frameSprite) => {
      if (cancelled) return;
      framesRef.current[idx] = frameSprite;
      if (idx === 0) {
        setReady(true);
      }
    })
      .then((allFrames) => {
        if (!cancelled) {
          framesRef.current = allFrames;
          setReady(true);
        }
      })
      .catch(() => {
        // Keep base logo functional if secondary frames fail
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Non-blocking window pointer listeners for parallax tilt & click-triggered 5-frame pose animation
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const nx = (event.clientX - cx) / Math.max(rect.width * 0.75, 240);
      const ny = (event.clientY - cy) / Math.max(rect.height * 0.85, 200);
      pointerTargetRef.current.x = Math.max(-1, Math.min(1, nx));
      pointerTargetRef.current.y = Math.max(-1, Math.min(1, ny));
    };

    const handlePointerLeave = () => {
      pointerTargetRef.current.x = 0;
      pointerTargetRef.current.y = 0;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      if (
        targetEl?.closest(
          'button, [role="radio"], [role="option"], [role="dialog"], [data-title-overlay-open="true"], a, input',
        )
      ) {
        return;
      }
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        const normX = (event.clientX - rect.left) / Math.max(1, rect.width);
        const normY = (event.clientY - rect.top) / Math.max(1, rect.height);
        triggerEmblemClickBurst(vfxRef.current, normX, normY);
        burstCountRef.current += 1;
        el.dataset.bursts = String(burstCountRef.current);
        if (lastSeqDatasetRef.current.active !== 'true') {
          lastSeqDatasetRef.current.active = 'true';
          el.dataset.seqActive = 'true';
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  // Main 60 FPS animation loop (zero React state mutations per frame)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let reducedMotion = Boolean(motionQuery?.matches);
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery?.addEventListener?.('change', onMotionChange);

    const padX = 0.14;
    const padTop = compact ? 0.12 : 0.16;
    const padBottom = compact ? 0.12 : 0.15;
    const totalWMult = 1 + padX * 2;
    const totalHMult = 1 + padTop + padBottom;

    const debugMesh =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debugTitleMesh') === '1';

    let rafId = 0;
    let lastTs = performance.now();

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(2, Math.round(rect.width * dpr));
      const targetH = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      return dpr;
    };

    const getCompositeScratch = (w: number, h: number): HTMLCanvasElement => {
      if (!compositeCanvasRef.current) {
        compositeCanvasRef.current = document.createElement('canvas');
      }
      const cc = compositeCanvasRef.current;
      if (cc.width !== w || cc.height !== h) {
        cc.width = w;
        cc.height = h;
      }
      return cc;
    };

    const getSheenScratch = (): HTMLCanvasElement => {
      if (!sheenCanvasRef.current) {
        const sc = document.createElement('canvas');
        sc.width = 512;
        sc.height = Math.round(512 / EMBLEM_ASPECT);
        sheenCanvasRef.current = sc;
      }
      return sheenCanvasRef.current;
    };

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      if (document.hidden) {
        lastTs = now;
        return;
      }

      const dt = (now - lastTs) / 1000;
      lastTs = now;

      const vfx = vfxRef.current;
      const sample = stepTitleEmblemVfx(vfx, dt, {
        targetParallaxX: pointerTargetRef.current.x,
        targetParallaxY: pointerTargetRef.current.y,
        reducedMotion,
        compact,
      });

      const seq = sample.sequence;
      const el = wrapperRef.current;
      if (el) {
        const activeStr = seq.active ? 'true' : 'false';
        const lastDs = lastSeqDatasetRef.current;
        if (lastDs.active !== activeStr) {
          lastDs.active = activeStr;
          el.dataset.seqActive = activeStr;
        }
        const blendPct = Math.round(seq.blendU * 100);
        if (
          lastDs.frameA !== seq.frameA ||
          lastDs.frameB !== seq.frameB ||
          lastDs.blendPct !== blendPct
        ) {
          lastDs.frameA = seq.frameA;
          lastDs.frameB = seq.frameB;
          lastDs.blendPct = blendPct;
          el.dataset.seqFrame = `${seq.frameA}->${seq.frameB}:${(blendPct / 100).toFixed(2)}`;
        }
      }

      if (tiltRef.current) {
        if (reducedMotion) {
          tiltRef.current.style.transform = 'none';
        } else {
          tiltRef.current.style.transform = `perspective(960px) rotateX(${sample.rotateXDeg.toFixed(2)}deg) rotateY(${sample.rotateYDeg.toFixed(2)}deg) rotateZ(${seq.poseTiltDeg.toFixed(2)}deg)`;
        }
      }

      const dpr = syncCanvasSize();
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const frames = framesRef.current;
      const baseLogo = frames[0];
      if (!baseLogo) return;

      stepVisorMatrix(visorRef.current, seq, dt, reducedMotion);
      const isXenoShocked = seq.active && (seq.frameA >= 3 || seq.frameB >= 3);
      stepSlimeEngine(slimeRef.current, vfx, dt, isXenoShocked, reducedMotion);

      const frameACanvas = frames[seq.frameA] ?? baseLogo;
      const frameBCanvas = frames[seq.frameB] ?? frameACanvas;
      const lockupSource = lockupRef.current;
      const idleBreathingActive = !seq.active && !reducedMotion;

      // Build unified 960x541 offscreen composite in strict Z-order:
      // Plane 1 (Anatomical Warp Lattice) -> Visor Matrix -> Xeno Slime -> Plane 0 (Static Lockup Plane)
      let activeLogoSource: HTMLCanvasElement | TitleSpriteSource = frameACanvas;
      const isTransitioning =
        seq.active &&
        seq.frameA !== seq.frameB &&
        seq.alphaB > 0.001 &&
        frameBCanvas !== frameACanvas;

      const comp = getCompositeScratch(baseLogo.width, baseLogo.height);
      const cctx = comp.getContext('2d', { willReadFrequently: true });
      if (cctx) {
        cctx.clearRect(0, 0, comp.width, comp.height);
        cctx.globalCompositeOperation = 'source-over';
        if (reducedMotion) {
          if (isTransitioning) {
            cctx.globalAlpha = seq.alphaA;
            cctx.drawImage(frameACanvas, 0, 0, comp.width, comp.height);
            cctx.globalAlpha = seq.alphaB;
            cctx.drawImage(frameBCanvas, 0, 0, comp.width, comp.height);
          } else if (seq.active && seq.alphaB >= 0.999) {
            cctx.globalAlpha = 1;
            cctx.drawImage(frameBCanvas, 0, 0, comp.width, comp.height);
          } else {
            cctx.globalAlpha = 1;
            cctx.drawImage(frameACanvas, 0, 0, comp.width, comp.height);
          }
        } else {
          renderWarpedFramePair(
            cctx,
            frameACanvas,
            frameBCanvas,
            seq.frameA,
            seq.frameB,
            seq.blendU,
            seq.alphaA,
            seq.alphaB,
            meshScratchRef.current,
            comp.width,
            comp.height,
            vfx.timeSec,
            idleBreathingActive,
          );
        }
        cctx.globalAlpha = 1;

        const visorBreathNormY = idleBreathingActive
          ? computeVertexIdleBreathNormY(8, vfx.timeSec)
          : 0;
        renderVisorMatrix(
          cctx,
          visorRef.current,
          comp.width,
          comp.height,
          visorBreathNormY,
          reducedMotion,
        );
        renderSlimeEngine(cctx, slimeRef.current, comp.width, comp.height, reducedMotion);

        if (lockupSource) {
          cctx.globalAlpha = 1;
          cctx.drawImage(lockupSource, 0, 0, comp.width, comp.height);
        }
        cctx.globalAlpha = 1;
        activeLogoSource = comp;
      }

      const baseEmblemW = cw / totalWMult;
      const baseEmblemH = ch / totalHMult;
      const baseEmblemX = cw * (padX / totalWMult);
      const baseEmblemY = ch * (padTop / totalHMult);

      const drawW = baseEmblemW * sample.breathScale;
      const drawH = baseEmblemH * sample.breathScale;
      const drawX = baseEmblemX + (baseEmblemW - drawW) * 0.5 + baseEmblemW * seq.shakeNormX;
      const drawY = baseEmblemY + (baseEmblemH - drawH) * 0.5 + baseEmblemH * sample.bobNormY;

      drawEmblemAmbientHalo(ctx, sample, drawX, drawY, drawW, drawH, cw, ch, compact);

      for (let i = 0; i < vfx.particles.length; i++) {
        const p = vfx.particles[i];
        if (p.active && p.behind) {
          drawEmblemParticle(ctx, p, drawX, drawY, drawW, drawH, dpr);
        }
      }

      // Fast elliptical depth drop-shadow replacing 28px full-canvas shadowBlur
      ctx.save();
      ctx.translate(drawX + drawW * 0.5, drawY + drawH * 0.58 + 10 * dpr);
      ctx.scale(1, 0.56);
      const dropGrad = ctx.createRadialGradient(0, 0, drawW * 0.1, 0, 0, drawW * 0.52);
      dropGrad.addColorStop(0, 'rgba(2, 6, 23, 0.52)');
      dropGrad.addColorStop(0.6, 'rgba(2, 6, 23, 0.22)');
      dropGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = dropGrad;
      ctx.beginPath();
      ctx.arc(0, 0, drawW * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(activeLogoSource, drawX, drawY, drawW, drawH);
      ctx.restore();

      if (sample.sheenActive && !reducedMotion) {
        const sc = getSheenScratch();
        const sctx = sc.getContext('2d', { willReadFrequently: true });
        if (sctx) {
          const sw = sc.width;
          const sh = sc.height;
          sctx.globalCompositeOperation = 'source-over';
          sctx.clearRect(0, 0, sw, sh);

          const cx = sample.sheenProgress * sw;
          const bandW = sw * 0.24;
          const grad = sctx.createLinearGradient(cx - bandW, 0, cx + bandW, sh * 0.45);
          grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
          grad.addColorStop(0.28, 'rgba(0, 240, 255, 0.24)');
          grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.56)');
          grad.addColorStop(0.72, 'rgba(255, 46, 126, 0.24)');
          grad.addColorStop(1, 'rgba(255, 46, 126, 0)');
          sctx.fillStyle = grad;
          sctx.fillRect(0, 0, sw, sh);

          sctx.globalCompositeOperation = 'destination-in';
          sctx.drawImage(activeLogoSource, 0, 0, sw, sh);

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(sc, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      }

      if (vfx.shockwave.active && !reducedMotion) {
        drawEmblemShockwave(ctx, vfx.shockwave, drawX, drawY, drawW, drawH, dpr);
      }

      if (!reducedMotion) {
        for (let i = 0; i < vfx.arcs.length; i++) {
          if (vfx.arcs[i].active) {
            drawEmblemRimArc(ctx, vfx.arcs[i], drawX, drawY, drawW, drawH, dpr);
          }
        }
      }

      for (let i = 0; i < vfx.particles.length; i++) {
        const p = vfx.particles[i];
        if (p.active && !p.behind) {
          drawEmblemParticle(ctx, p, drawX, drawY, drawW, drawH, dpr);
        }
      }

      // Layer 8: Optional dev calibration overlay (?debugTitleMesh=1)
      if (debugMesh) {
        const verts = meshScratchRef.current.activeVertices;
        ctx.save();
        ctx.lineWidth = Math.max(1, dpr);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        for (let t = 0; t < WARP_TRIANGLES.length; t++) {
          const [i0, i1, i2] = WARP_TRIANGLES[t];
          ctx.beginPath();
          ctx.moveTo(drawX + verts[i0 * 2] * drawW, drawY + verts[i0 * 2 + 1] * drawH);
          ctx.lineTo(drawX + verts[i1 * 2] * drawW, drawY + verts[i1 * 2 + 1] * drawH);
          ctx.lineTo(drawX + verts[i2 * 2] * drawW, drawY + verts[i2 * 2 + 1] * drawH);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.font = `${Math.round(9 * dpr)}px monospace`;
        for (let i = 0; i < MESH_VERTEX_COUNT; i++) {
          const vx = drawX + verts[i * 2] * drawW;
          const vy = drawY + verts[i * 2 + 1] * drawH;
          const isPinned = i >= 16;
          ctx.fillStyle = isPinned ? '#fbbf24' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(vx, vy, 3 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`V${i}`, vx + 4 * dpr, vy - 3 * dpr);
        }
        const q = visorRef.current.workingQuad;
        ctx.fillStyle = '#ff2e93';
        for (const [label, qx, qy] of [
          ['P00', q.p00x, q.p00y],
          ['P10', q.p10x, q.p10y],
          ['P01', q.p01x, q.p01y],
          ['P11', q.p11x, q.p11y],
        ] as const) {
          const px = drawX + qx * drawW;
          const py = drawY + qy * drawH;
          ctx.fillRect(px - 2.5 * dpr, py - 2.5 * dpr, 5 * dpr, 5 * dpr);
          ctx.fillText(label, px + 4 * dpr, py + 4 * dpr);
        }
        ctx.fillStyle = '#a3e635';
        for (let i = 0; i < XENO_SLIME_NOZZLES.length; i++) {
          const n = XENO_SLIME_NOZZLES[i];
          const nx = drawX + n.nx * drawW;
          const ny = drawY + n.ny * drawH;
          ctx.beginPath();
          ctx.arc(nx, ny, 3.5 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`N${i + 1}`, nx + 4 * dpr, ny + 4 * dpr);
        }
        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      motionQuery?.removeEventListener?.('change', onMotionChange);
    };
  }, [compact]);

  if (failed) {
    return (
      <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-wider text-white drop-shadow-[0_4px_18px_rgba(0,240,255,0.45)]">
        NEON BREACH
      </h1>
    );
  }

  const padXPct = 14;
  const padTopPct = compact ? 12 : 16;
  const padBottomPct = compact ? 12 : 15;

  return (
    <div
      ref={wrapperRef}
      role="img"
      aria-label="NEON BREACH — Xeno-Purge Protocol"
      data-testid="title-emblem-stage"
      data-bursts="0"
      data-seq-active="false"
      data-seq-frame="0->0:0.00"
      className={`relative select-none cursor-pointer transition-opacity duration-300 ${
        ready ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ aspectRatio: '960 / 541' }}
    >
      <div
        ref={tiltRef}
        className="relative h-full w-full will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: `-${padXPct}%`,
            top: `-${padTopPct}%`,
            width: `${100 + padXPct * 2}%`,
            height: `${100 + padTopPct + padBottomPct}%`,
          }}
        />
      </div>
    </div>
  );
}
