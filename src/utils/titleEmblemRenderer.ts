import type {
  ClickShockwave,
  ElectricRimArc,
  EmblemTransformSample,
  FloatingAccentKind,
  FloatingAccentSample,
  LogoSequenceSample,
  PooledParticle,
  RimArcPoint,
  TitleEmblemVfxState,
} from './titleEmblemVfx';

export const LOGO_FRAME_COUNT = 9;
export const CLIMAX_FRAME_INDEX = LOGO_FRAME_COUNT - 1;
export const EMBLEM_ASPECT = 960 / 541;
export const PARTICLE_POOL_SIZE = 128;
export const MAX_RIM_ARCS = 4;
export const MAX_VFX_DT = 0.05;

export const BEAT1_END_SEC = 0.44;
export const HEART_BURST_SEC = 1.24;
export const SHOCK_BURST_SEC = 1.50;
export const SEQUENCE_FORWARD_END_SEC = 1.92;
export const SEQUENCE_HOLD_END_SEC = 2.20;
export const SEQUENCE_REVERSE_HEART_END_SEC = 2.52;
export const SEQUENCE_REVERSE_WINK_START_SEC = 2.86;
export const SEQUENCE_TOTAL_SEC = 3.16;

function easeInOutSine(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
}

export const XENO_PURGE_BOTTOM_RIM_ANCHORS: readonly RimArcPoint[] = [
  { nx: 0.145, ny: 0.855 },
  { nx: 0.215, ny: 0.895 },
  { nx: 0.335, ny: 0.898 },
  { nx: 0.455, ny: 0.935 },
  { nx: 0.575, ny: 0.898 },
  { nx: 0.695, ny: 0.895 },
  { nx: 0.755, ny: 0.848 },
];

export const XENO_PURGE_TOP_RIM_ANCHORS: readonly RimArcPoint[] = [
  { nx: 0.175, ny: 0.788 },
  { nx: 0.295, ny: 0.782 },
  { nx: 0.455, ny: 0.778 },
  { nx: 0.615, ny: 0.782 },
  { nx: 0.725, ny: 0.788 },
];

const CRAWLER_IDLE_FRAMES = [0, 1, 2, 1] as const;

export function quinticEase(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export function computeSolidityAlphas(blendU: number): { alphaA: number; alphaB: number } {
  const u = Math.max(0, Math.min(1, blendU));
  if (u <= 0.0001) {
    return { alphaA: 1, alphaB: 0 };
  }
  if (u >= 0.9999) {
    return { alphaA: 0, alphaB: 1 };
  }
  const alphaA = u < 0.55 ? 1 : Math.max(0, (1 - u) / 0.45);
  return { alphaA, alphaB: u };
}

export function sampleLogoSequence(
  state: TitleEmblemVfxState,
  outSample?: LogoSequenceSample,
): LogoSequenceSample {
  const target: LogoSequenceSample = outSample ?? {
    active: false,
    elapsed: 0,
    frameA: 0,
    frameB: 0,
    blendU: 0,
    alphaA: 1,
    alphaB: 0,
    shakeNormX: 0,
    shakeNormY: 0,
    poseTiltDeg: 0,
  };

  if (!state.sequenceActive) {
    target.active = false;
    target.elapsed = 0;
    target.frameA = 0;
    target.frameB = 0;
    target.blendU = 0;
    target.alphaA = 1;
    target.alphaB = 0;
    target.shakeNormX = 0;
    target.shakeNormY = 0;
    target.poseTiltDeg = 0;
    return target;
  }

  const t = Math.max(0, Math.min(SEQUENCE_TOTAL_SEC, state.sequenceElapsed));
  let frameA = 0;
  let frameB = 0;
  let blendU = 0;

  if (t < SEQUENCE_FORWARD_END_SEC) {
    // Single continuous C-infinity phase curve across all 9 keyframes (zero dead-stop velocity drops)
    const p = t / SEQUENCE_FORWARD_END_SEC;
    const pos = easeInOutSine(p) * CLIMAX_FRAME_INDEX;
    frameA = Math.min(CLIMAX_FRAME_INDEX - 1, Math.floor(pos));
    frameB = frameA + 1;
    blendU = pos - frameA;
  } else if (t <= SEQUENCE_HOLD_END_SEC) {
    // Brief living climax turnaround (mesh breathing, tilt follow-through & shock tremor remain active)
    frameA = CLIMAX_FRAME_INDEX;
    frameB = CLIMAX_FRAME_INDEX;
    blendU = 0;
  } else {
    // Single continuous smooth reverse glide from K4 back to K0
    const revP =
      (t - SEQUENCE_HOLD_END_SEC) /
      Math.max(0.001, SEQUENCE_TOTAL_SEC - SEQUENCE_HOLD_END_SEC);
    const pos = (1 - easeInOutSine(revP)) * CLIMAX_FRAME_INDEX;
    const hi = Math.min(CLIMAX_FRAME_INDEX, Math.ceil(pos));
    const lo = Math.max(0, hi - 1);
    frameA = hi;
    frameB = lo;
    blendU = hi === lo ? 0 : hi - pos;
  }

  const { alphaA, alphaB } =
    frameA === frameB ? { alphaA: 1, alphaB: 0 } : computeSolidityAlphas(blendU);

  let poseTiltDeg = 0;
  let shakeNormX = 0;
  let shakeNormY = 0;

  if (t < SEQUENCE_FORWARD_END_SEC) {
    poseTiltDeg = Math.sin((t / SEQUENCE_FORWARD_END_SEC) * Math.PI * 1.5) * 1.15;
  } else if (t <= SEQUENCE_HOLD_END_SEC) {
    // Continuous elastic follow-through during the brief climax turnaround (never frozen at 0)
    const holdU =
      (t - SEQUENCE_FORWARD_END_SEC) /
      Math.max(0.001, SEQUENCE_HOLD_END_SEC - SEQUENCE_FORWARD_END_SEC);
    poseTiltDeg = -1.15 * Math.cos(holdU * Math.PI * 0.5) - Math.sin(holdU * Math.PI) * 0.45;
  } else {
    const revU = (t - SEQUENCE_HOLD_END_SEC) / (SEQUENCE_TOTAL_SEC - SEQUENCE_HOLD_END_SEC);
    poseTiltDeg = Math.sin(revU * Math.PI) * -0.75;
  }

  const shockDuration = SEQUENCE_HOLD_END_SEC - SHOCK_BURST_SEC + 0.14;
  if (t >= SHOCK_BURST_SEC && t <= SHOCK_BURST_SEC + shockDuration) {
    const shockProgress = (t - SHOCK_BURST_SEC) / shockDuration;
    const envelope = Math.sin(shockProgress * Math.PI) * (1 - shockProgress * 0.35);
    shakeNormX = Math.sin(t * 64) * 0.0046 * envelope;
    shakeNormY = Math.cos(t * 52) * 0.0034 * envelope;
  }

  target.active = true;
  target.elapsed = t;
  target.frameA = frameA;
  target.frameB = frameB;
  target.blendU = blendU;
  target.alphaA = alphaA;
  target.alphaB = alphaB;
  target.shakeNormX = shakeNormX;
  target.shakeNormY = shakeNormY;
  target.poseTiltDeg = poseTiltDeg;
  return target;
}

export function sampleFloatingAccents(
  timeSec: number,
  parallaxX: number,
  parallaxY: number,
  reducedMotion = false,
): FloatingAccentSample[] {
  const t = reducedMotion ? 0 : timeSec;
  const px = reducedMotion ? 0 : parallaxX;
  const py = reducedMotion ? 0 : parallaxY;

  const larvaFrame = CRAWLER_IDLE_FRAMES[Math.floor(t * 4.4) % CRAWLER_IDLE_FRAMES.length];
  const skitterFrame = CRAWLER_IDLE_FRAMES[Math.floor(t * 5.1 + 1.7) % CRAWLER_IDLE_FRAMES.length];

  return [
    {
      kind: 'drone_strike' as FloatingAccentKind,
      nx: 1.07 + Math.sin(t * 1.45) * 0.018 - px * 0.032,
      ny: 0.25 + Math.sin(t * 2.35 + 0.5) * 0.032 - py * 0.025,
      scaleOfEmblemH: 0.21,
      tiltRad: -0.06 + Math.cos(t * 2.1) * 0.055 + px * 0.05,
      opacity: 0.88,
      flipX: true,
      frameIndex: 2,
      glowColor: '#00f0ff',
      wideOnly: false,
    },
    {
      kind: 'drone_med' as FloatingAccentKind,
      nx: 1.19 + Math.cos(t * 1.15 + 1.2) * 0.022 - px * 0.048,
      ny: 0.58 + Math.sin(t * 1.9 + 2.1) * 0.03 - py * 0.032,
      scaleOfEmblemH: 0.16,
      tiltRad: Math.sin(t * 1.8) * 0.065,
      opacity: 0.72,
      flipX: false,
      frameIndex: 1,
      glowColor: '#34d399',
      wideOnly: true,
    },
    {
      kind: 'xeno_larva' as FloatingAccentKind,
      nx: -0.075 + Math.cos(t * 1.35 + 0.8) * 0.018 - px * 0.03,
      ny: 0.56 + Math.sin(t * 2.25 + 1.1) * 0.028 - py * 0.022,
      scaleOfEmblemH: 0.175,
      tiltRad: 0.08 + Math.sin(t * 2.4) * 0.06,
      opacity: 0.82,
      flipX: false,
      frameIndex: larvaFrame,
      glowColor: '#84cc16',
      wideOnly: false,
    },
    {
      kind: 'xeno_skitter' as FloatingAccentKind,
      nx: -0.17 + Math.sin(t * 1.2 + 2.4) * 0.02 - px * 0.045,
      ny: 0.24 + Math.cos(t * 1.85 + 0.4) * 0.03 - py * 0.03,
      scaleOfEmblemH: 0.14,
      tiltRad: -0.12 + Math.cos(t * 2.0) * 0.05,
      opacity: 0.66,
      flipX: false,
      frameIndex: skitterFrame,
      glowColor: '#38bdf8',
      wideOnly: true,
    },
  ];
}

export function traceEmblemHeartPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.32);
  ctx.bezierCurveTo(0, -r * 0.25, -r * 1.05, -r * 0.25, -r * 1.05, r * 0.38);
  ctx.bezierCurveTo(-r * 1.05, r * 0.92, 0, r * 1.25, 0, r * 1.55);
  ctx.bezierCurveTo(0, r * 1.25, r * 1.05, r * 0.92, r * 1.05, r * 0.38);
  ctx.bezierCurveTo(r * 1.05, -r * 0.25, 0, -r * 0.25, 0, r * 0.32);
  ctx.closePath();
}

export function drawEmblemParticle(
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
    ctx.translate(px, py - radius * 0.5);
    const tilt = Math.sin(p.age * 7 + p.phase) * 0.22;
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha * 0.32;
    ctx.fillStyle = p.glowColor;
    traceEmblemHeartPath(ctx, radius * 1.25);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    traceEmblemHeartPath(ctx, radius * 0.85);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    traceEmblemHeartPath(ctx, radius * 0.42);
    ctx.fill();
  } else if (p.shape === 1) {
    const vxPx = p.vx * emblemW;
    const vyPx = p.vy * emblemH;
    const speed = Math.hypot(vxPx, vyPx);
    const tailLen = Math.min(20 * dpr, Math.max(5 * dpr, speed * 0.14));
    const ux = speed > 0.001 ? vxPx / speed : 1;
    const uy = speed > 0.001 ? vyPx / speed : -0.3;

    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = p.glowColor;
    ctx.lineWidth = Math.max(3.2 * dpr, radius * 2.1);
    ctx.beginPath();
    ctx.moveTo(px - ux * tailLen, py - uy * tailLen);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.glowColor;
    ctx.lineWidth = Math.max(1.8 * dpr, radius * 1.15);
    ctx.beginPath();
    ctx.moveTo(px - ux * tailLen, py - uy * tailLen);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.9 * dpr, radius * 0.45);
    ctx.beginPath();
    ctx.moveTo(px - ux * tailLen * 0.55, py - uy * tailLen * 0.55);
    ctx.lineTo(px, py);
    ctx.stroke();
  } else if (p.shape === 2) {
    ctx.translate(px, py);
    ctx.rotate(Math.PI * 0.25 + p.age * 1.8);
    ctx.globalAlpha = alpha * 0.32;
    ctx.fillStyle = p.glowColor;
    const outerHalf = radius * 1.35;
    ctx.fillRect(-outerHalf, -outerHalf, outerHalf * 2, outerHalf * 2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    const half = radius * 0.9;
    ctx.fillRect(-half, -half, half * 2, half * 2);

    ctx.fillStyle = '#ffffff';
    const core = half * 0.45;
    ctx.fillRect(-core, -core, core * 2, core * 2);
  } else {
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

export function drawEmblemRimArc(
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

  ctx.globalAlpha = alpha * 0.3;
  ctx.strokeStyle = arc.color;
  ctx.lineWidth = 7.5 * dpr;
  tracePath();
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = arc.color;
  ctx.lineWidth = 3.2 * dpr;
  tracePath();
  ctx.stroke();

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.25 * dpr;
  tracePath();
  ctx.stroke();

  const first = arc.points[0];
  const last = arc.points[arc.points.length - 1];
  for (const pt of [first, last]) {
    const px = emblemX + pt.nx * emblemW;
    const py = emblemY + pt.ny * emblemH;
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = arc.color;
    ctx.beginPath();
    ctx.arc(px, py, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawEmblemShockwave(
  ctx: CanvasRenderingContext2D,
  shockwave: ClickShockwave,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
  dpr: number,
): void {
  if (!shockwave.active) return;
  const su = shockwave.age / Math.max(0.001, shockwave.maxLife);
  const ease = 1 - Math.pow(1 - su, 3);
  const sx = drawX + shockwave.nx * drawW;
  const sy = drawY + shockwave.ny * drawH;
  const radius = (0.04 + ease * 0.46) * drawH;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const baseAlpha = Math.max(0, (1 - su) * 0.72);
  ctx.strokeStyle = su < 0.45 ? '#00f0ff' : '#ff2e7e';

  ctx.globalAlpha = baseAlpha * 0.35;
  ctx.lineWidth = Math.max(4 * dpr, (1 - su) * 12 * dpr);
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = baseAlpha;
  ctx.lineWidth = Math.max(1.5 * dpr, (1 - su) * 5 * dpr);
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawEmblemAmbientHalo(
  ctx: CanvasRenderingContext2D,
  sample: EmblemTransformSample,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
  _cw: number,
  _ch: number,
  compact: boolean,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const auraAlpha = (0.14 + sample.auraPulse * 0.1) * (compact ? 0.8 : 1);

  const lx = drawX + drawW * 0.24;
  const ly = drawY + drawH * 0.44;
  const lr = drawH * 0.46;
  const leftGlow = ctx.createRadialGradient(lx, ly, drawH * 0.04, lx, ly, lr);
  leftGlow.addColorStop(0, `rgba(132, 204, 22, ${auraAlpha * 0.9})`);
  leftGlow.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = leftGlow;
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fill();

  const cx = drawX + drawW * 0.48;
  const cy = drawY + drawH * 0.56;
  const cr = drawH * 0.54;
  const centerGlow = ctx.createRadialGradient(cx, cy, drawH * 0.05, cx, cy, cr);
  centerGlow.addColorStop(0, `rgba(0, 240, 255, ${auraAlpha})`);
  centerGlow.addColorStop(0.55, `rgba(255, 46, 126, ${auraAlpha * 0.48})`);
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
