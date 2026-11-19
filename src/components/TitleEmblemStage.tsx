import { useEffect, useRef, useState } from 'react';
import {
  getPreloadedTitleLogo,
  getPreloadedTitleLogoFrames,
  loadTitleLogo,
  loadTitleLogoFrames,
} from '../assets/assetPreloader';
import {
  EMBLEM_ASPECT,
  type ElectricRimArc,
  type PooledParticle,
  createTitleEmblemVfxState,
  stepTitleEmblemVfx,
  triggerEmblemClickBurst,
} from '../utils/titleEmblemVfx';

interface TitleEmblemStageProps {
  className?: string;
  compact?: boolean;
}

function traceHeartPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.32);
  ctx.bezierCurveTo(0, -r * 0.25, -r * 1.05, -r * 0.25, -r * 1.05, r * 0.38);
  ctx.bezierCurveTo(-r * 1.05, r * 0.92, 0, r * 1.25, 0, r * 1.55);
  ctx.bezierCurveTo(0, r * 1.25, r * 1.05, r * 0.92, r * 1.05, r * 0.38);
  ctx.bezierCurveTo(r * 1.05, -r * 0.25, 0, -r * 0.25, 0, r * 0.32);
  ctx.closePath();
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: PooledParticle,
  emblemX: number,
  emblemY: number,
  emblemW: number,
  emblemH: number,
  dpr: number,
): void {
  const lifeRatio = p.age / Math.max(0.001, p.maxLife);
  const fadeIn = Math.min(1, lifeRatio / 0.16);
  const fadeOut = Math.max(0, 1 - Math.max(0, (lifeRatio - 0.55) / 0.45));
  const alpha = fadeIn * fadeOut * (p.behind ? 0.68 : 0.96);
  if (alpha <= 0.02) return;

  const px = emblemX + p.nx * emblemW;
  const py = emblemY + p.ny * emblemH;
  const radius = p.size * dpr * (0.75 + (1 - lifeRatio) * 0.45);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';

  if (p.shape === 3) {
    // Glowing neon heart-kiss particle synced to Kira's blown kiss (Frame 3 -> 4)
    ctx.translate(px, py - radius * 0.5);
    const tilt = Math.sin(p.age * 7 + p.phase) * 0.22;
    ctx.rotate(tilt);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.glowColor;
    ctx.shadowBlur = 13 * dpr;
    traceHeartPath(ctx, radius * 0.85);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    traceHeartPath(ctx, radius * 0.42);
    ctx.fill();
  } else if (p.shape === 1) {
    // Elongated plasma spark streak aligned to velocity vector
    const vxPx = p.vx * emblemW;
    const vyPx = p.vy * emblemH;
    const speed = Math.hypot(vxPx, vyPx);
    const tailLen = Math.min(20 * dpr, Math.max(5 * dpr, speed * 0.14));
    const ux = speed > 0.001 ? vxPx / speed : 1;
    const uy = speed > 0.001 ? vyPx / speed : -0.3;

    ctx.lineCap = 'round';
    ctx.strokeStyle = p.glowColor;
    ctx.lineWidth = Math.max(1.8 * dpr, radius * 1.15);
    ctx.shadowColor = p.glowColor;
    ctx.shadowBlur = 9 * dpr;
    ctx.beginPath();
    ctx.moveTo(px - ux * tailLen, py - uy * tailLen);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.9 * dpr, radius * 0.45);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(px - ux * tailLen * 0.55, py - uy * tailLen * 0.55);
    ctx.lineTo(px, py);
    ctx.stroke();
  } else if (p.shape === 2) {
    // Crisp glowing neon diamond ember
    ctx.translate(px, py);
    ctx.rotate(Math.PI * 0.25 + p.age * 1.8);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.glowColor;
    ctx.shadowBlur = 10 * dpr;
    const half = radius * 0.9;
    ctx.fillRect(-half, -half, half * 2, half * 2);

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    const core = half * 0.45;
    ctx.fillRect(-core, -core, core * 2, core * 2);
  } else {
    // Organic glowing bio-spore / soft neon orb with radial gradient halo
    const haloR = radius * 2.4;
    const grad = ctx.createRadialGradient(px, py, radius * 0.15, px, py, haloR);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.32, p.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, haloR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRimArc(
  ctx: CanvasRenderingContext2D,
  arc: ElectricRimArc,
  emblemX: number,
  emblemY: number,
  emblemW: number,
  emblemH: number,
  dpr: number,
): void {
  if (!arc.active || arc.points.length < 2) return;
  const u = arc.age / Math.max(0.001, arc.maxLife);
  const flicker = 0.72 + Math.sin(u * Math.PI * 7) * 0.28;
  const alpha = Math.max(0, (1 - u * u) * flicker);
  if (alpha <= 0.03) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const tracePath = () => {
    ctx.beginPath();
    for (let i = 0; i < arc.points.length; i++) {
      const x = emblemX + arc.points[i].nx * emblemW;
      const y = emblemY + arc.points[i].ny * emblemH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  // Outer electric glow
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = arc.color;
  ctx.lineWidth = 3.4 * dpr;
  ctx.shadowColor = arc.color;
  ctx.shadowBlur = 14 * dpr;
  tracePath();
  ctx.stroke();

  // White-hot plasma filament core
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.25 * dpr;
  ctx.shadowBlur = 4 * dpr;
  tracePath();
  ctx.stroke();

  // Endpoint discharge nodes
  const first = arc.points[0];
  const last = arc.points[arc.points.length - 1];
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = arc.color;
  ctx.shadowBlur = 10 * dpr;
  for (const pt of [first, last]) {
    ctx.beginPath();
    ctx.arc(emblemX + pt.nx * emblemW, emblemY + pt.ny * emblemH, 2.3 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function TitleEmblemStage({
  className = '',
  compact = false,
}: TitleEmblemStageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<(HTMLCanvasElement | null)[]>(
    getPreloadedTitleLogoFrames() ?? [getPreloadedTitleLogo(), null, null, null, null],
  );
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfxRef = useRef(createTitleEmblemVfxState());
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const burstCountRef = useRef(0);

  const [ready, setReady] = useState<boolean>(() => Boolean(getPreloadedTitleLogo()));
  const [failed, setFailed] = useState(false);

  // Load main cutout logo Frame 0 immediately, plus progressively decode Frames 1..4 for the click sequence
  useEffect(() => {
    let cancelled = false;

    const cachedFrames = getPreloadedTitleLogoFrames();
    if (cachedFrames && cachedFrames[0]) {
      framesRef.current = cachedFrames;
      setReady(true);
      return;
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

    void loadTitleLogoFrames((idx, frameCanvas) => {
      if (cancelled) return;
      framesRef.current[idx] = frameCanvas;
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
      // Never intercept clicks on interactive buttons, operative cards, dropdowns, or modals
      const targetEl = event.target instanceof Element ? event.target : null;
      if (targetEl?.closest('button, [role="radio"], [role="option"], [role="dialog"], a, input')) {
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
        el.dataset.seqActive = 'true';
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

    // Bleed margins around the emblem box inside the oversized canvas
    const padX = 0.14;
    const padTop = compact ? 0.12 : 0.16;
    const padBottom = compact ? 0.12 : 0.15;
    const totalWMult = 1 + padX * 2;
    const totalHMult = 1 + padTop + padBottom;

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
      if (wrapperRef.current) {
        const activeStr = seq.active ? 'true' : 'false';
        if (wrapperRef.current.dataset.seqActive !== activeStr) {
          wrapperRef.current.dataset.seqActive = activeStr;
        }
        const frameTag = `${seq.frameA}->${seq.frameB}:${seq.blendU.toFixed(2)}`;
        if (wrapperRef.current.dataset.seqFrame !== frameTag) {
          wrapperRef.current.dataset.seqFrame = frameTag;
        }
      }

      // Compositor-only 3D cursor tilt + narrative pose tilt on the stage wrapper
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

      const frameACanvas = frames[seq.frameA] ?? baseLogo;
      const frameBCanvas = frames[seq.frameB] ?? frameACanvas;

      // Build unified offscreen composite frame during C2 quintic cross-dissolves
      // so the interior stays 100% opaque (zero mid-dissolve transparency dip or double drop-shadow)
      let activeLogoSource: HTMLCanvasElement = frameACanvas;
      if (seq.active && seq.frameA !== seq.frameB && seq.alphaB > 0.001 && frameBCanvas !== frameACanvas) {
        const comp = getCompositeScratch(frameACanvas.width, frameACanvas.height);
        const cctx = comp.getContext('2d');
        if (cctx) {
          cctx.clearRect(0, 0, comp.width, comp.height);
          cctx.globalCompositeOperation = 'source-over';
          cctx.globalAlpha = seq.alphaA;
          cctx.drawImage(frameACanvas, 0, 0, comp.width, comp.height);
          cctx.globalAlpha = seq.alphaB;
          cctx.drawImage(frameBCanvas, 0, 0, comp.width, comp.height);
          cctx.globalAlpha = 1;
          activeLogoSource = comp;
        }
      } else if (seq.active && seq.alphaB >= 0.999) {
        activeLogoSource = frameBCanvas;
      }

      const baseEmblemW = cw / totalWMult;
      const baseEmblemH = ch / totalHMult;
      const baseEmblemX = cw * (padX / totalWMult);
      const baseEmblemY = ch * (padTop / totalHMult);

      // Levitation + subtle breathing scale + comedic shock micro-shake anchored around center
      const drawW = baseEmblemW * sample.breathScale;
      const drawH = baseEmblemH * sample.breathScale;
      const drawX = baseEmblemX + (baseEmblemW - drawW) * 0.5 + baseEmblemW * seq.shakeNormX;
      const drawY = baseEmblemY + (baseEmblemH - drawH) * 0.5 + baseEmblemH * sample.bobNormY;

      // 1. Subtle breathing dual-zone ambient backdrop halo behind emblem (bio-lime left, neon-magenta/cyan right)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const auraAlpha = (0.14 + sample.auraPulse * 0.1) * (compact ? 0.8 : 1);

      const leftGlow = ctx.createRadialGradient(
        drawX + drawW * 0.24,
        drawY + drawH * 0.44,
        drawH * 0.04,
        drawX + drawW * 0.24,
        drawY + drawH * 0.44,
        drawH * 0.46,
      );
      leftGlow.addColorStop(0, `rgba(132, 204, 22, ${auraAlpha * 0.9})`);
      leftGlow.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, cw, ch);

      const centerGlow = ctx.createRadialGradient(
        drawX + drawW * 0.48,
        drawY + drawH * 0.56,
        drawH * 0.05,
        drawX + drawW * 0.48,
        drawY + drawH * 0.56,
        drawH * 0.54,
      );
      centerGlow.addColorStop(0, `rgba(0, 240, 255, ${auraAlpha})`);
      centerGlow.addColorStop(0.55, `rgba(255, 46, 126, ${auraAlpha * 0.48})`);
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();

      // 2. Back-plane ambient particles
      for (let i = 0; i < vfx.particles.length; i++) {
        const p = vfx.particles[i];
        if (p.active && p.behind) {
          drawParticle(ctx, p, drawX, drawY, drawW, drawH, dpr);
        }
      }

      // 3. Main alpha-keyed Neon Breach logo (or solidity-preserved 5-frame cross-dissolve composite)
      ctx.save();
      ctx.shadowColor = 'rgba(2, 6, 23, 0.9)';
      ctx.shadowBlur = 28 * dpr;
      ctx.shadowOffsetY = 12 * dpr;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(activeLogoSource, drawX, drawY, drawW, drawH);
      ctx.restore();

      // 4. Silhouette-masked diagonal neon light sheen sweep (locked strictly to activeLogoSource alpha)
      if (sample.sheenActive && !reducedMotion) {
        const sc = getSheenScratch();
        const sctx = sc.getContext('2d');
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

          // Lock sheen strictly inside the current composite logo's opaque alpha silhouette
          sctx.globalCompositeOperation = 'destination-in';
          sctx.drawImage(activeLogoSource, 0, 0, sw, sh);

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(sc, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      }

      // 5. Click shockwave ring pulse
      if (vfx.shockwave.active && !reducedMotion) {
        const su = vfx.shockwave.age / Math.max(0.001, vfx.shockwave.maxLife);
        const ease = 1 - Math.pow(1 - su, 3);
        const sx = drawX + vfx.shockwave.nx * drawW;
        const sy = drawY + vfx.shockwave.ny * drawH;
        const radius = (0.04 + ease * 0.46) * drawH;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, (1 - su) * 0.72);
        ctx.strokeStyle = su < 0.45 ? '#00f0ff' : '#ff2e7e';
        ctx.lineWidth = Math.max(1.5 * dpr, (1 - su) * 6 * dpr);
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 16 * dpr;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Procedural electric arc discharges along the XENO-PURGE PROTOCOL rim
      if (!reducedMotion) {
        for (let i = 0; i < vfx.arcs.length; i++) {
          if (vfx.arcs[i].active) {
            drawRimArc(ctx, vfx.arcs[i], drawX, drawY, drawW, drawH, dpr);
          }
        }
      }

      // 7. Front-plane zone-matched particles, neon heart-kiss stream, & click burst sparks
      for (let i = 0; i < vfx.particles.length; i++) {
        const p = vfx.particles[i];
        if (p.active && !p.behind) {
          drawParticle(ctx, p, drawX, drawY, drawW, drawH, dpr);
        }
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
