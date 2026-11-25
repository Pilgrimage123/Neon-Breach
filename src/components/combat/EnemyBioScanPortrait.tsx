import { useEffect, useRef } from 'react';
import {
  getPreloadedEnemyPortrait,
  loadEnemyPortrait,
} from '../../assets/assetPreloader';
import { GAME_ASSETS } from '../../assets/gameAssets';
import { BAKED_ENEMY_PORTRAIT_BOUNDS } from '../../assets/sprites/baked/bakedBounds';
import type { EnemyUnit } from '../../engine/types';

export interface EnemyBioScanPortraitProps {
  archetype: EnemyUnit['archetype'];
  compact: boolean;
}

export function EnemyBioScanPortrait({
  archetype,
  compact,
}: EnemyBioScanPortraitProps) {
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
      const dpr = Math.min(
        2,
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      );
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

    void loadEnemyPortrait(archetype)
      .then((cut) => {
        if (cancelled || !cut) return;
        drawCutout(cut, BAKED_ENEMY_PORTRAIT_BOUNDS[archetype]);
      })
      .catch(() => {});

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
                : archetype === 'mutdog'
                  ? 'border-[#F59E0B]/75 shadow-[inset_0_0_24px_rgba(163,230,53,0.28)]'
                  : archetype === 'feral_nurse'
                    ? 'border-[#FF2E7E]/75 shadow-[inset_0_0_24px_rgba(255,46,126,0.26)]'
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
