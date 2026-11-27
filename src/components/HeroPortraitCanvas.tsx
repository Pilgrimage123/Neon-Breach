import { useEffect, useRef, useState } from 'react';
import { getPreloadedPortraitFrame, loadPortraitFrame } from '../assets/assetPreloader';
import type { CharacterId } from '../engine/types';
import { AURALINE_SHEET_FRAMES } from '../utils/auralineSpriteSheet';
import { KIRA_SHEET_A_FRAMES } from '../utils/kiraSpriteSheet';
import { ZURI_SHEET_FRAMES } from '../utils/zuriSpriteSheet';

export interface HeroPortraitCanvasProps {
  characterId: CharacterId;
  active: boolean;
  variant?: 'codex' | 'title';
  compact?: boolean;
}

function drawPortraitToCanvas(
  canvas: HTMLCanvasElement,
  frame: HTMLCanvasElement,
  rectW: number,
  rectH: number,
  pad: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(
    (canvas.width - pad * 2) / rectW,
    (canvas.height - pad * 2) / rectH,
  );
  const dw = rectW * scale;
  const dh = rectH * scale;
  const dx = (canvas.width - dw) * 0.5;
  const dy = canvas.height - dh - 2;
  ctx.drawImage(frame, dx, dy, dw, dh);
}

export function HeroPortraitCanvas({
  characterId,
  active,
  variant = 'title',
  compact = false,
}: HeroPortraitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState<boolean>(() =>
    Boolean(getPreloadedPortraitFrame(characterId)),
  );

  useEffect(() => {
    let cancelled = false;
    const rect =
      characterId === 'auraline'
        ? AURALINE_SHEET_FRAMES[0]
        : characterId === 'zuri'
          ? ZURI_SHEET_FRAMES[8]
          : KIRA_SHEET_A_FRAMES[0];
    const pad = variant === 'codex' ? 3 : 4;

    const paint = (frame: HTMLCanvasElement) => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      drawPortraitToCanvas(canvas, frame, rect.w, rect.h, pad);
      setReady(true);
    };

    const cached = getPreloadedPortraitFrame(characterId);
    if (cached) {
      paint(cached);
      return;
    }

    void loadPortraitFrame(characterId)
      .then((frame) => paint(frame))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [characterId, variant]);

  const isAuraline = characterId === 'auraline';
  const isZuri = characterId === 'zuri';

  if (variant === 'codex') {
    const borderTone = isAuraline
      ? active
        ? 'border-[#FFC700]/80 bg-amber-950/40'
        : 'border-white/15 bg-slate-950/60'
      : isZuri
        ? active
          ? 'border-[#10B981]/80 bg-emerald-950/40'
          : 'border-white/15 bg-slate-950/60'
        : active
          ? 'border-[#00F0FF]/80 bg-cyan-950/40'
          : 'border-white/15 bg-slate-950/60';

    return (
      <canvas
        ref={canvasRef}
        width={52}
        height={64}
        aria-hidden="true"
        className={`h-11 w-9 shrink-0 rounded-lg border transition-opacity duration-150 ${borderTone} ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={68}
      height={84}
      className={`${
        compact ? 'h-[48px] w-[38px]' : 'h-[60px] w-[48px] sm:h-[64px] sm:w-[52px]'
      } shrink-0 rounded-lg border transition-all duration-200 ${
        !ready ? 'opacity-0' : active ? 'opacity-100' : 'opacity-80'
      } ${
        active
          ? isAuraline
            ? 'border-[#FFC700]/75 bg-amber-950/35'
            : isZuri
              ? 'border-[#10B981]/80 bg-emerald-950/35'
              : 'border-[#00F0FF]/75 bg-cyan-950/35'
          : 'border-white/15 bg-slate-950/60'
      }`}
    />
  );
}
