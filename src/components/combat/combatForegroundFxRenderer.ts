import { getPreloadedAuralineSurgeBlastVfx } from '../../assets/assetPreloader';
import { renderCutInForegroundVfx, type SequencerFrameState } from './CombatActionSequencer';
import {
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  TEXT_POOL_SIZE,
  type CombatStageSim,
} from './combatStageTypes';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  hexToRgba,
  sampleWeatheredBloodColors,
} from './mutantBlood';

export function renderSpitterBileTorrent(
  ctx: CanvasRenderingContext2D,
  _sim: CombatStageSim,
  params: {
    mouthX: number;
    mouthY: number;
    targetX: number;
    targetY: number;
    groundY: number;
    baseScale: number;
    windupProgress: number;
    streamProgress: number;
    elapsed: number;
    seed: number;
  },
): void {
  const {
    mouthX,
    mouthY,
    targetX,
    targetY,
    baseScale,
    windupProgress,
    streamProgress,
    elapsed,
    seed,
  } = params;

  ctx.save();

  const jawOrbIntensity =
    streamProgress > 0.01 && streamProgress < 0.72
      ? 1.0
      : windupProgress > 0.02
        ? windupProgress
        : 0;
  if (jawOrbIntensity > 0.02) {
    const orbR = (6 + 9 * jawOrbIntensity + Math.sin(elapsed * 22 + seed) * 1.6) * baseScale;
    const grad = ctx.createRadialGradient(mouthX, mouthY, 1, mouthX, mouthY, orbR * 2.1);
    grad.addColorStop(0, `rgba(254, 249, 195, ${0.95 * jawOrbIntensity})`);
    grad.addColorStop(0.35, `rgba(250, 204, 21, ${0.86 * jawOrbIntensity})`);
    grad.addColorStop(0.7, `rgba(163, 230, 53, ${0.48 * jawOrbIntensity})`);
    grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, orbR * 2.1, 0, Math.PI * 2);
    ctx.fill();

    if (streamProgress <= 0.01) {
      for (let i = 0; i < 6; i++) {
        const p = (elapsed * 2.8 + i / 6) % 1;
        const ang = i * ((Math.PI * 2) / 6) + elapsed * 3.2;
        const dist = (1 - p) * 22 * baseScale;
        const dx = mouthX + Math.cos(ang) * dist;
        const dy = mouthY + Math.sin(ang) * dist * 0.75;
        ctx.globalAlpha = Math.sin(p * Math.PI) * jawOrbIntensity * 0.88;
        ctx.fillStyle = i % 2 === 0 ? '#FEF08A' : '#FACC15';
        ctx.beginPath();
        ctx.arc(dx, dy, (1.6 + (i % 2) * 0.8) * baseScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  if (streamProgress > 0.01) {
    const p = Math.max(0, Math.min(1, streamProgress));
    const headT = Math.min(1, Math.pow(p / 0.30, 0.75));
    const tailT = p <= 0.76 ? 0 : Math.min(0.95, Math.pow((p - 0.76) / 0.24, 1.1));
    const spanT = Math.max(0.02, headT - tailT);
    const fadeOut = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : 1;

    const spanX = Math.abs(mouthX - targetX);
    const ctrlX = (mouthX + targetX) * 0.5;
    const ctrlY = Math.min(mouthY, targetY) - Math.min(54, spanX * 0.14) * baseScale;

    const evalStreamPoint = (t: number): { x: number; y: number } => {
      const inv = 1 - t;
      const bx = inv * inv * mouthX + 2 * inv * t * ctrlX + t * t * targetX;
      const by = inv * inv * mouthY + 2 * inv * t * ctrlY + t * t * targetY;
      const envelope = Math.sin(t * Math.PI);
      const waveY =
        (Math.sin(t * 15 - elapsed * 28 + seed) * 4.5 +
          Math.cos(t * 27 - elapsed * 38) * 2.0) *
        envelope *
        baseScale;
      return { x: bx, y: by + waveY };
    };

    const steps = 26;
    const pts: Array<{ x: number; y: number; t: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = tailT + (i / steps) * spanT;
      const pt = evalStreamPoint(t);
      pts.push({ x: pt.x, y: pt.y, t });
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tailT > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.65 * fadeOut;
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.2 * baseScale * (1 - tailT * 0.6);
      ctx.beginPath();
      ctx.moveTo(mouthX, mouthY);
      const midTrail = evalStreamPoint(tailT * 0.5);
      ctx.quadraticCurveTo(midTrail.x, midTrail.y, pts[0].x, pts[0].y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.44 * fadeOut;
    ctx.strokeStyle = '#A3E635';
    ctx.lineWidth = 19 * baseScale;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const segNorm = i / (pts.length - 1);
      const taper = Math.sin(Math.max(0.12, Math.min(0.95, segNorm)) * Math.PI);
      const bolus = 1 + 0.35 * Math.sin(p0.t * 22 - elapsed * 34 + seed);
      const segW = (5.8 + 6.8 * taper) * bolus * baseScale;

      ctx.globalAlpha = 0.92 * fadeOut;
      ctx.strokeStyle = i % 3 === 0 ? '#A3E635' : '#EAB308';
      ctx.lineWidth = segW * 1.38;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.globalAlpha = 0.98 * fadeOut;
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = segW;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.96 * fadeOut;
    ctx.strokeStyle = '#FEF9C3';
    ctx.lineWidth = 3.6 * baseScale;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    for (let g = 0; g < 14; g++) {
      const gFrac = ((g / 14 + elapsed * 3.4 + seed * 0.13) % 1);
      const gt = tailT + gFrac * spanT;
      const basePt = evalStreamPoint(gt);
      const nextPt = evalStreamPoint(Math.min(1, gt + 0.03));
      const ang = Math.atan2(nextPt.y - basePt.y, nextPt.x - basePt.x);
      const spread = Math.sin(g * 2.7 + elapsed * 14) * (3.8 + (g % 3) * 3.5) * baseScale * Math.sin(gt * Math.PI);
      const gx = basePt.x - Math.sin(ang) * spread;
      const gy = basePt.y + Math.cos(ang) * spread;
      const rx = (3.8 + (g % 3) * 1.9) * baseScale;
      const ry = rx * 0.58;

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.94 * fadeOut;
      ctx.fillStyle = '#65A30D';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 1.1, ry + 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = g % 3 === 0 ? '#A3E635' : '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.22, -ry * 0.24, rx * 0.42, ry * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (tailT < 0.45) {
      const coneAlpha = (1 - tailT / 0.45) * fadeOut;
      for (let s = 0; s < 8; s++) {
        const sProg = ((elapsed * 5.5 + s * 0.15) % 1);
        const sAng = Math.PI + (s - 3.5) * 0.15 + Math.sin(elapsed * 18 + s) * 0.05;
        const dist = (6 + sProg * 32) * baseScale;
        const sx = mouthX + Math.cos(sAng) * dist;
        const sy = mouthY + Math.sin(sAng) * dist;
        ctx.globalAlpha = coneAlpha * (1 - sProg) * 0.92;
        ctx.fillStyle = s % 2 === 0 ? '#FEF08A' : '#FACC15';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3.4 * baseScale, 1.8 * baseScale, sAng, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (headT >= 0.82) {
      const impactAlpha = Math.min(1, (headT - 0.82) / 0.18) * fadeOut;
      const splashR = (19 + Math.sin(elapsed * 28) * 4) * baseScale;
      const splashGrad = ctx.createRadialGradient(
        targetX,
        targetY,
        2,
        targetX,
        targetY,
        splashR * 1.65,
      );
      splashGrad.addColorStop(0, `rgba(254, 249, 195, ${0.96 * impactAlpha})`);
      splashGrad.addColorStop(0.4, `rgba(250, 204, 21, ${0.88 * impactAlpha})`);
      splashGrad.addColorStop(0.75, `rgba(163, 230, 53, ${0.55 * impactAlpha})`);
      splashGrad.addColorStop(1, 'rgba(163, 230, 53, 0)');
      ctx.fillStyle = splashGrad;
      ctx.beginPath();
      ctx.arc(targetX, targetY, splashR * 1.65, 0, Math.PI * 2);
      ctx.fill();

      for (let k = 0; k < 12; k++) {
        const kProg = ((elapsed * 4.2 + k * 0.11) % 1);
        const kAng = -Math.PI * 0.68 + (k / 11) * (Math.PI * 1.36);
        const kDist = (6 + kProg * 36) * baseScale;
        const kx = targetX + Math.cos(kAng) * kDist;
        const ky = targetY + Math.sin(kAng) * kDist + kProg * kProg * 24 * baseScale;
        const kr = (2.3 + (k % 3) * 1.15) * (1 - kProg * 0.45) * baseScale;
        ctx.globalAlpha = impactAlpha * (1 - kProg * 0.7) * 0.94;
        ctx.fillStyle = k % 3 === 0 ? '#FEF08A' : k % 3 === 1 ? '#FACC15' : '#A3E635';
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function traceVisorSplashCrownPath(
  ctx: CanvasRenderingContext2D,
  r: number,
  ry: number,
  seed: number,
): void {
  const nodes = 12;
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < nodes; i++) {
    const ang = (i / nodes) * Math.PI * 2;
    const mod = 1 + 0.16 * Math.sin(ang * 3 + seed) + 0.11 * Math.cos(ang * 5 - seed);
    px.push(Math.cos(ang) * r * mod);
    py.push(Math.sin(ang) * ry * mod);
  }
  ctx.beginPath();
  ctx.moveTo((px[nodes - 1] + px[0]) * 0.5, (py[nodes - 1] + py[0]) * 0.5);
  for (let i = 0; i < nodes; i++) {
    const next = (i + 1) % nodes;
    ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[next]) * 0.5, (py[i] + py[next]) * 0.5);
  }
  ctx.closePath();
}

export function renderScreenBloodDrops(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  elapsed: number,
): void {
  const { w, h } = sim.size;
  const dpr = sim.dpr;
  let anyActive = false;
  for (let i = 0; i < SCREEN_BLOOD_POOL_SIZE; i++) {
    if (sim.screenBlood[i].active && sim.screenBlood[i].alpha > 0.01) {
      anyActive = true;
      break;
    }
  }
  if (!anyActive) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  for (let i = 0; i < SCREEN_BLOOD_POOL_SIZE; i++) {
    const sb = sim.screenBlood[i];
    if (!sb.active || sb.alpha <= 0.01) continue;

    const lifeNorm = Math.min(1, sb.age / Math.max(0.1, sb.lifespan));
    const profile = getBloodBiologyProfile(sb.owner);
    const pseudoTurnAge = lifeNorm * 1.8;
    const weathering = computeBloodWeatheringState(pseudoTurnAge);
    const colors = sampleWeatheredBloodColors(profile, pseudoTurnAge);
    const popScale = sb.age < 0.1 ? 0.55 + (sb.age / 0.1) * 0.45 : 1;
    const r = sb.radius * popScale;
    const ry = r * sb.stretchY;
    const x = sb.nx * w;
    const y = sb.ny * h + sb.slideOffsetPx;

    ctx.save();
    ctx.translate(x, y);

    // 0. Arrival impact flash & expanding wet refractive shock ring
    if (sb.age < 0.28) {
      const impactT = sb.age / 0.28;
      const ringR = r * (1.1 + impactT * 2.3);
      const ringAlpha = (1 - impactT) * 0.65 * sb.alpha;
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = Math.max(1.0, 2.5 * (1 - impactT));
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      const flashGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, ringR * 1.35);
      flashGrad.addColorStop(0, hexToRgba(colors.emissive, ringAlpha * 0.45));
      flashGrad.addColorStop(1, hexToRgba(colors.emissive, 0));
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1. Glistening vertical gravity runner streak + swelling pendant teardrop bulb
    if (sb.streakLen > 1.5) {
      const runGrad = ctx.createLinearGradient(0, -sb.streakLen, 0, 0);
      runGrad.addColorStop(0, hexToRgba(colors.body, 0.08 * sb.alpha));
      runGrad.addColorStop(0.7, hexToRgba(colors.body, 0.45 * sb.alpha));
      runGrad.addColorStop(1, hexToRgba(colors.core, 0.72 * sb.alpha));
      ctx.globalAlpha = 1;
      ctx.fillStyle = runGrad;
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, 0);
      ctx.quadraticCurveTo(-r * 0.1, -sb.streakLen * 0.65, 0, -sb.streakLen);
      ctx.quadraticCurveTo(r * 0.1, -sb.streakLen * 0.65, r * 0.34, 0);
      ctx.closePath();
      ctx.fill();

      // Swelling pendant bulb at bottom tip of sliding drop
      ctx.globalAlpha = 0.75 * sb.alpha;
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.ellipse(0, ry * 0.72, r * 0.46, ry * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Refractive dark meniscus rim on visor glass
    ctx.globalAlpha = 0.42 * sb.alpha;
    ctx.fillStyle = colors.rimShadow;
    traceVisorSplashCrownPath(ctx, r + 1.1, ry + 1.1, sb.seed);
    ctx.fill();

    // 3. Translucent Beer-Lambert glass-lens refraction body + 3 radial satellite micro-droplets
    const lensGrad = ctx.createRadialGradient(-r * 0.14, -ry * 0.14, r * 0.08, 0, 0, Math.max(r, ry) * 1.15);
    lensGrad.addColorStop(0, hexToRgba(colors.emissive, 0.42 * sb.alpha));
    lensGrad.addColorStop(0.55, hexToRgba(colors.body, 0.76 * sb.alpha));
    lensGrad.addColorStop(0.92, hexToRgba(colors.core, 0.9 * sb.alpha));
    lensGrad.addColorStop(1, hexToRgba(colors.rimShadow, 0.85 * sb.alpha));
    ctx.globalAlpha = 1;
    ctx.fillStyle = lensGrad;
    traceVisorSplashCrownPath(ctx, r, ry, sb.seed);
    ctx.fill();

    ctx.globalAlpha = 0.84 * sb.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(sb.satelliteDx, sb.satelliteDy, sb.satelliteR, sb.satelliteR * 1.15, 0, 0, Math.PI * 2);
    for (let m = 0; m < 2; m++) {
      const mAng = sb.seed * 1.3 + m * 2.4 + 0.8;
      const mDist = r + 3.5 + m * 3.2;
      const mr = Math.max(1.2, r * (0.22 - m * 0.05));
      ctx.moveTo(Math.cos(mAng) * mDist + mr, Math.sin(mAng) * mDist);
      ctx.arc(Math.cos(mAng) * mDist, Math.sin(mAng) * mDist, mr, 0, Math.PI * 2);
    }
    ctx.fill();

    // 4. Biology-grounded interior shader detail on the glass
    if (profile.hasSuspendedVeins) {
      const pulse = 0.75 + 0.25 * Math.sin(elapsed * 2.8 + sb.seed);
      ctx.globalAlpha = 0.82 * weathering.emissiveIntensity * sb.alpha * pulse;
      ctx.strokeStyle = colors.veinPrimary;
      ctx.lineWidth = Math.max(0.9, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -ry * 0.18);
      ctx.quadraticCurveTo(0, ry * 0.34, r * 0.44, -ry * 0.12);
      ctx.stroke();
    } else if (profile.emissiveStrength > 0.35 && weathering.emissiveIntensity > 0.08) {
      const pulse = 0.78 + 0.22 * Math.sin(elapsed * 2.6 + sb.seed);
      ctx.globalAlpha = 0.46 * profile.emissiveStrength * weathering.emissiveIntensity * sb.alpha * pulse;
      ctx.fillStyle = colors.emissive;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.46, ry * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fresnel oil-slick rim iridescence for Sulfur/Cobalt & Apex Hive
    if (profile.iridescence > 0.4 && weathering.iridescenceIntensity > 0.1) {
      ctx.globalAlpha = 0.58 * profile.iridescence * weathering.iridescenceIntensity * sb.alpha;
      ctx.strokeStyle = colors.iridescenceA;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.88, ry * 0.88, 0, Math.PI * 0.7, Math.PI * 1.7);
      ctx.stroke();
    }

    // Caustic bottom-right glass refraction rim
    if (weathering.glossiness > 0.2) {
      ctx.globalAlpha = 0.45 * weathering.glossiness * sb.alpha;
      ctx.strokeStyle = colors.highlight;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.9, r * 0.14);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.82, ry * 0.82, 0, Math.PI * 0.1, Math.PI * 0.48);
      ctx.stroke();

      // 5. Crisp curved top-left visor specular catchlight
      ctx.globalAlpha = 0.78 * weathering.glossiness * sb.alpha;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.0, r * 0.18);
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, -ry * 0.1, r * 0.58, ry * 0.54, -0.25, Math.PI * 1.05, Math.PI * 1.55);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

export function renderForegroundWorldFxPass(params: {
  ctx: CanvasRenderingContext2D;
  sim: CombatStageSim;
  w: number;
  h: number;
  heroBaseX: number;
  groundY: number;
  tacticalViewActive: boolean;
  heroTargetHeight?: number;
  enemyLanesX?: readonly number[];
}): void {
  const { ctx, sim, w, h, heroBaseX, groundY, tacticalViewActive, enemyLanesX } = params;
  const heroTargetHeight =
    params.heroTargetHeight ?? Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
  const vfxScale = heroTargetHeight / 214;

  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
    const d = sim.bloodDrops[i];
    if (!d.active) continue;
    const lifeRatio = d.life / d.maxLife;
    const alpha = Math.max(0, 1 - lifeRatio * 0.48);
    const speed = Math.hypot(d.vx, d.vy);
    const angle = Math.atan2(d.vy, d.vx);
    const headR = Math.max(1.05, d.size * 0.78);
    const bodyHalfH = headR * 0.64;
    const tailLen = headR * (1.45 + Math.min(2.6, speed / 160));

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(angle);

    if (speed > 165) {
      ctx.globalAlpha = alpha * 0.24;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = Math.max(0.8, bodyHalfH * 0.72);
      ctx.beginPath();
      ctx.moveTo(-tailLen * 1.35, 0);
      ctx.lineTo(-tailLen * 0.25, 0);
      ctx.stroke();
    }

    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(-tailLen, 0);
    ctx.quadraticCurveTo(-tailLen * 0.18, -bodyHalfH * 1.08, headR * 0.35, -bodyHalfH);
    ctx.arc(headR * 0.35, 0, bodyHalfH, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.quadraticCurveTo(-tailLen * 0.18, bodyHalfH * 1.08, -tailLen, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = d.highlightColor;
    ctx.globalAlpha = alpha * 0.68;
    ctx.beginPath();
    ctx.arc(headR * 0.28, -bodyHalfH * 0.28, Math.max(0.55, headR * 0.32), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < BOLT_POOL_SIZE; i++) {
    const b = sim.bolts[i];
    if (!b.active) continue;
    const p = b.life / b.maxLife;
    const style = b.style ?? 'pistol_bolt';

    if (style === 'acid_bile') {
      const tailP = Math.max(0, p - 0.34);
      const tx = b.startX + (b.targetX - b.startX) * tailP;
      const ty = b.startY + (b.targetY - b.startY) * tailP;
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = '#A3E635';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.globalAlpha = 0.92;
      ctx.fillStyle = b.color || '#BEF264';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 10.5, 6.2, Math.atan2(b.targetY - b.startY, b.targetX - b.startX), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.98;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (style === 'stinger_dart') {
      const tailP = Math.max(0, p - 0.38);
      const tx = b.startX + (b.targetX - b.startX) * tailP;
      const ty = b.startY + (b.targetY - b.startY) * tailP;
      const ang = Math.atan2(b.targetY - b.startY, b.targetX - b.startX);

      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = b.color || '#F59E0B';
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-4, -3.2);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }

    const tailSpan = style === 'scattergun' ? 0.30 : style === 'drone_plasma' ? 0.48 : 0.42;
    const outerWidth = style === 'scattergun' ? 10 : style === 'drone_plasma' ? 11 : 13;
    const midWidth = style === 'scattergun' ? 4.8 : style === 'drone_plasma' ? 5.2 : 6.2;
    const coreWidth = style === 'scattergun' ? 2.0 : 2.4;
    const tailP = Math.max(0, p - tailSpan);
    const tx = b.startX + (b.targetX - b.startX) * tailP;
    const ty = b.startY + (b.targetY - b.startY) * tailP;

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = outerWidth;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 0.92;
    ctx.lineWidth = midWidth;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = coreWidth;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  if (sim.kickWaveTimer > 0) {
    const p = 1 - sim.kickWaveTimer / 0.28;
    const alpha = 1 - p;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 59, 127, ${alpha})`;
    ctx.lineWidth = 8 * (1 - p * 0.6);
    ctx.beginPath();
    ctx.arc(sim.kickWaveX, sim.kickWaveY, 22 + p * 68, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 230, 245, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sim.kickWaveX, sim.kickWaveY, 22 + p * 68, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  if (sim.slashArcTimer > 0 && sim.slashSurge) {
    const p = 1 - sim.slashArcTimer / 0.28;
    const alpha = Math.sin((1 - p) * Math.PI * 0.5);
    const arcX = sim.pendingShotTargetX;
    const arcY = sim.pendingShotTargetY;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 184, 0, ${alpha})`;
    ctx.lineWidth = 7 * (1 - p * 0.5);
    ctx.beginPath();
    ctx.arc(arcX, arcY, 26 + p * 66, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 245, 210, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arcX, arcY, 18 + p * 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (sim.kiraSurgeBlastTimer > 0) {
    const p = 1 - sim.kiraSurgeBlastTimer / 0.42;
    const alpha = Math.max(0, Math.sin((1 - p) * Math.PI * 0.5));
    const mx = sim.kiraSurgeMuzzleX || heroBaseX + 90;
    const my = sim.kiraSurgeMuzzleY || groundY - h * 0.34;
    const tx = sim.pendingShotTargetX || w * 0.65;
    const ty = sim.pendingShotTargetY || my;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Multi-layer plasma cannon beam (outer cyan flare -> neon magenta -> white-hot core)
    const beamLen = Math.max(80, tx - mx + 60);
    const beamGrad = ctx.createLinearGradient(mx, my, mx + beamLen, ty);
    beamGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`);
    beamGrad.addColorStop(0.25, `rgba(255, 46, 178, ${0.88 * alpha})`);
    beamGrad.addColorStop(0.75, `rgba(56, 189, 248, ${0.62 * alpha})`);
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = (28 + Math.sin(p * 24) * 6) * (1 - p * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + beamLen, ty);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 245, 255, ${0.92 * alpha})`;
    ctx.lineWidth = 8 * (1 - p * 0.5);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + beamLen * 0.92, ty);
    ctx.stroke();

    // Expanding elliptical white-hot / neon-magenta shockwave halo ring at barrel
    const ringX = mx + 22 + p * 28;
    ctx.strokeStyle = `rgba(255, 59, 180, ${0.92 * alpha})`;
    ctx.lineWidth = 6 * (1 - p * 0.4);
    ctx.beginPath();
    ctx.ellipse(ringX, my, 12 + p * 18, 36 + p * 54, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(ringX, my, 8 + p * 14, 28 + p * 44, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Crackling cyan & magenta lightning forks along beam
    for (let f = 0; f < 4; f++) {
      ctx.strokeStyle = f % 2 === 0 ? `rgba(0, 229, 255, ${0.82 * alpha})` : `rgba(255, 46, 178, ${0.82 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      for (let s = 1; s <= 4; s++) {
        const u = s / 4;
        const jx = mx + beamLen * u;
        const jy = my + (ty - my) * u + Math.sin(p * 32 + f * 2.1 + s * 3.7) * (18 + u * 22);
        ctx.lineTo(jx, jy);
      }
      ctx.stroke();
    }

    // Dynamic recoil shock-lines radiating around Kira
    for (let r = 0; r < 6; r++) {
      const ang = -Math.PI * 0.7 + (r / 5) * Math.PI * 1.4;
      const r0 = 42 + p * 18;
      const r1 = r0 + 26 + (r % 2) * 14;
      ctx.strokeStyle = `rgba(255, 80, 170, ${0.65 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(heroBaseX + Math.cos(ang) * r0, my + 24 + Math.sin(ang) * r0);
      ctx.lineTo(heroBaseX + Math.cos(ang) * r1, my + 24 + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (sim.kiraDropkickRingTimer > 0) {
    const p = 1 - sim.kiraDropkickRingTimer / 0.56;
    const alpha = Math.max(0, Math.sin((1 - p) * Math.PI * 0.5));
    const sx = sim.kiraDropkickSoleX || heroBaseX + 120;
    const sy = sim.kiraDropkickSoleY || groundY - h * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Twin concentric cyan & magenta holographic boot shockwave rings
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.9 * alpha})`;
    ctx.lineWidth = 5 * (1 - p * 0.35);
    ctx.beginPath();
    ctx.ellipse(sx, sy, 22 + p * 54, 48 + p * 86, -0.18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 46, 178, ${0.88 * alpha})`;
    ctx.lineWidth = 3.5 * (1 - p * 0.4);
    ctx.beginPath();
    ctx.ellipse(sx, sy, 14 + p * 38, 34 + p * 64, -0.18, 0, Math.PI * 2);
    ctx.stroke();

    // Swirling cyan/magenta plasma lightning ribbons trailing behind Kira
    for (let rib = 0; rib < 3; rib++) {
      ctx.strokeStyle = rib === 1 ? `rgba(255, 46, 178, ${0.78 * alpha})` : `rgba(0, 229, 255, ${0.78 * alpha})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let seg = 1; seg <= 5; seg++) {
        const u = seg / 5;
        const rx = sx - u * 180;
        const ry = sy + Math.sin(p * 18 + rib * 2.1 + seg * 1.4) * (16 + u * 24);
        ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }

    // Full-stage concentric energy shockwave detonation
    if (p > 0.25) {
      const detP = (p - 0.25) / 0.75;
      ctx.strokeStyle = `rgba(255, 200, 80, ${0.6 * (1 - detP)})`;
      ctx.lineWidth = 4 * (1 - detP);
      ctx.beginPath();
      ctx.arc(sx, sy, 30 + detP * w * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Auraline Signature Pass 1: Artillery Surge Blast (Attack Stack Surge / dash_kick)
  // Uses the user's standalone cyber-ring plasma beam texture anchored at F11 muzzleRel.
  // Split-drawn at splitX=560 so concentric cyber-rings maintain natural aspect ratio scaled to heroTargetHeight
  // while the feathered beam tail stretches smoothly past the enemy without hard edge cutoffs.
  if (sim.auralineSurgeBlastTimer > 0) {
    const p = Math.max(0, Math.min(1, 1 - sim.auralineSurgeBlastTimer / 0.48));
    const mx = sim.auralineSurgeMuzzleX || heroBaseX + 86 * vfxScale;
    const my = sim.auralineSurgeMuzzleY || groundY - 147 * vfxScale;
    const tx = Math.max(mx + 140 * vfxScale, sim.pendingShotTargetX || w * 0.68);
    const rawTy = sim.pendingShotTargetY || my;
    const dx = tx - mx;
    const rawDy = rawTy - my;
    // Keep the cyber-ring beam aligned with Auraline's horizontal F11 scattergun barrel across the bridge
    const beamAng = Math.max(-0.045, Math.min(0.065, Math.atan2(rawDy, dx)));
    const ty = my + Math.tan(beamAng) * dx;
    const dist = Math.hypot(dx, ty - my);

    let scaleX = 1;
    let scaleY = 1;
    let alpha = 1;
    if (p < 0.22) {
      const u = p / 0.22;
      scaleX = 0.72 + u * 0.34;
      scaleY = 0.80 + u * 0.26;
      alpha = 0.92 + u * 0.08;
    } else if (p < 0.70) {
      const u = (p - 0.22) / 0.48;
      scaleX = 1.06 + Math.sin(u * Math.PI * 3) * 0.04;
      scaleY = 1.06 + Math.sin(u * Math.PI * 5) * 0.05;
      alpha = 1.0;
    } else {
      const u = (p - 0.70) / 0.30;
      scaleX = 1.06 + u * 0.06;
      scaleY = 1.06 * (1 - u * 0.72);
      alpha = Math.max(0, 1 - u);
    }

    const vfxImg = getPreloadedAuralineSurgeBlastVfx();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (vfxImg && vfxImg.width > 0 && vfxImg.height > 0) {
      // Muzzle focal star inside auraline_surge_blast_vfx.png (1086x362) is at x=215 (0.198), y=181 (0.50).
      // Cyber-rings end cleanly at splitX=560; feathered tail runs u=0.70..1.0.
      const imgW = vfxImg.width;
      const imgH = vfxImg.height;
      const splitX = Math.min(imgW - 16, Math.round(imgW * 0.516));
      const overlapPx = 8;
      const rightSx = splitX - overlapPx;
      const rightSw = imgW - rightSx;

      const drawH = heroTargetHeight * 0.94 * scaleY;
      const pxScale = drawH / imgH;
      const anchorY = 0.5 * drawH;
      const anchorPx = 0.198 * imgW * pxScale;
      const leftW = splitX * pxScale;
      const leftEndX = leftW - anchorPx;
      const rightStartX = leftEndX - overlapPx * pxScale;
      const minRightW = 210 * vfxScale;
      const rightW = Math.max(minRightW, (dist - rightStartX) / 0.56) * scaleX;

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(beamAng);
      ctx.globalAlpha = alpha;
      // Piece 1: Backflash + muzzle focal star + cyber-rings at natural 1:1 aspect ratio
      ctx.drawImage(vfxImg, 0, 0, splitX, imgH, -anchorPx, -anchorY, leftW, drawH);
      // Piece 2: Plasma beam + lightning + feathered dissolve tail stretched seamlessly through enemy
      ctx.drawImage(vfxImg, rightSx, 0, rightSw, imgH, rightStartX, -anchorY, rightW, drawH);

      if (p < 0.74) {
        const innerH = drawH * 0.72;
        const innerAnchorY = 0.5 * innerH;
        ctx.globalAlpha = alpha * 0.48;
        ctx.drawImage(vfxImg, 0, 0, splitX, imgH, -anchorPx, -innerAnchorY, leftW, innerH);
        ctx.drawImage(vfxImg, rightSx, 0, rightSw, imgH, rightStartX, -innerAnchorY, rightW, innerH);
      }
      ctx.restore();
    } else {
      // Procedural fallback if image is still decoding
      const beamGrad = ctx.createLinearGradient(mx, my, tx + 60 * vfxScale, ty);
      beamGrad.addColorStop(0, `rgba(255, 255, 255, ${0.96 * alpha})`);
      beamGrad.addColorStop(0.28, `rgba(0, 229, 255, ${0.92 * alpha})`);
      beamGrad.addColorStop(0.65, `rgba(217, 70, 239, ${0.78 * alpha})`);
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 24 * vfxScale * scaleY;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(tx + 60 * vfxScale, ty);
      ctx.stroke();
    }

    // Target impact plasma crown at (tx, ty)
    if (p >= 0.05) {
      const impP = (p - 0.05) / 0.95;
      const impAlpha = alpha * Math.sin((1 - impP * 0.65) * Math.PI * 0.5);
      const impR = (26 + impP * 44) * vfxScale * scaleY;
      const impGrad = ctx.createRadialGradient(tx, ty, 2 * vfxScale, tx, ty, impR);
      impGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * impAlpha})`);
      impGrad.addColorStop(0.35, `rgba(0, 240, 255, ${0.84 * impAlpha})`);
      impGrad.addColorStop(0.7, `rgba(217, 70, 239, ${0.52 * impAlpha})`);
      impGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = impGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, impR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(0, 240, 255, ${0.88 * impAlpha})`;
      ctx.lineWidth = 3.0 * vfxScale * (1 - impP * 0.5);
      ctx.beginPath();
      ctx.ellipse(
        tx,
        ty,
        (14 + impP * 28) * vfxScale,
        (30 + impP * 50) * vfxScale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Auraline Signature Pass 2: Twin-Barrel Scattergun Blast Cone & Recoil Halo (normal shoot)
  if (sim.auralineScatterConeTimer > 0) {
    const p = Math.max(0, Math.min(1, 1 - sim.auralineScatterConeTimer / 0.28));
    const alpha = Math.max(0, 1 - p);
    const mx = sim.auralineScatterMuzzleX || heroBaseX + 122 * vfxScale;
    const my = sim.auralineScatterMuzzleY || groundY - 156 * vfxScale;
    const tx = Math.max(mx + 60 * vfxScale, sim.pendingShotTargetX || w * 0.66);
    const ty = sim.pendingShotTargetY || my;
    const aimAng = Math.max(-0.22, Math.min(0.28, Math.atan2(ty - my, tx - mx)));
    const coneLen = (128 + p * 145) * vfxScale;
    const halfSpread = 0.34;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(mx, my);
    ctx.rotate(aimAng);

    const coneGrad = ctx.createRadialGradient(0, 0, 3 * vfxScale, 0, 0, coneLen);
    coneGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`);
    coneGrad.addColorStop(0.28, `rgba(255, 199, 0, ${0.84 * alpha})`);
    coneGrad.addColorStop(0.68, `rgba(0, 229, 255, ${0.46 * alpha})`);
    coneGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneLen, -halfSpread, halfSpread);
    ctx.closePath();
    ctx.fill();

    // Twin-barrel concentric pressure rings at muzzle
    for (let ring = 0; ring < 2; ring++) {
      const rx = (12 + ring * 14 + p * 24) * vfxScale;
      ctx.strokeStyle =
        ring === 0
          ? `rgba(255, 199, 0, ${0.9 * alpha})`
          : `rgba(0, 240, 255, ${0.82 * alpha})`;
      ctx.lineWidth = (3.8 - ring * 1.1) * vfxScale * (1 - p * 0.45);
      ctx.beginPath();
      ctx.ellipse(
        rx,
        0,
        (8 + p * 12) * vfxScale,
        (22 + ring * 7 + p * 32) * vfxScale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    // 7 golden-cyan buckshot pellet streaks
    for (let s = 0; s < 7; s++) {
      const ang = -halfSpread * 0.85 + (s / 6) * (halfSpread * 1.7);
      const r0 = (10 + p * 34) * vfxScale;
      const r1 = r0 + (48 + (s % 2) * 24) * vfxScale;
      ctx.strokeStyle =
        s % 2 === 0
          ? `rgba(255, 234, 138, ${0.92 * alpha})`
          : `rgba(103, 232, 249, ${0.88 * alpha})`;
      ctx.lineWidth = 2.2 * vfxScale;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Auraline Signature Pass 3: Sovereign Broadside Multi-Target Artillery Barrage (overdrive)
  if (sim.auralineBroadsideTimer > 0) {
    const p = Math.max(0, Math.min(1, 1 - sim.auralineBroadsideTimer / 0.64));
    const alpha = Math.sin((1 - p * 0.75) * Math.PI * 0.5);
    const mx = sim.auralineBroadsideMuzzleX || heroBaseX + 120 * vfxScale;
    const my = sim.auralineBroadsideMuzzleY || groundY - 155 * vfxScale;
    let lanes: number[];
    if (enemyLanesX && enemyLanesX.length >= 2) {
      lanes = enemyLanesX.slice(0, 4);
    } else if (enemyLanesX && enemyLanesX.length === 1) {
      const ex = enemyLanesX[0];
      const spread = Math.max(54 * vfxScale, w * 0.07);
      lanes = [
        Math.max(w * 0.48, ex - spread),
        ex,
        Math.min(w * 0.90, ex + spread),
      ];
    } else {
      lanes = [w * 0.63, w * 0.75, w * 0.86];
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Elevated muzzle sunburst
    const muzzleR = 32 * vfxScale * (1 - p * 0.35);
    const mGrad = ctx.createRadialGradient(mx, my, 2 * vfxScale, mx, my, muzzleR);
    mGrad.addColorStop(0, `rgba(255, 255, 255, ${0.96 * alpha})`);
    mGrad.addColorStop(0.4, `rgba(255, 199, 0, ${0.88 * alpha})`);
    mGrad.addColorStop(1, 'rgba(255, 199, 0, 0)');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(mx, my, muzzleR, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < lanes.length; i++) {
      const lx = lanes[i];
      const ly = groundY - (i % 2) * 6 * vfxScale;
      const laneDelay = i * 0.03;
      const lp = Math.max(0, Math.min(1, (p + 0.12 - laneDelay) / (1 - laneDelay)));
      if (lp <= 0) continue;

      // High-arcing golden artillery trajectory from muzzle to lane
      const ctrlX = (mx + lx) * 0.5;
      const ctrlY = Math.max(24, my - heroTargetHeight * 0.95 - i * 18 * vfxScale);
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(255, 199, 0, ${0.88 * alpha})`
          : `rgba(0, 240, 255, ${0.86 * alpha})`;
      ctx.lineWidth = 4.0 * vfxScale * (1 - lp * 0.3);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(ctrlX, ctrlY, lx, ly - 38 * vfxScale);
      ctx.stroke();

      // Descending sovereign bombardment pillar on enemy lane
      const pilP = Math.min(1, lp);
      const pilAlpha = Math.sin((1 - pilP * 0.75) * Math.PI * 0.5) * alpha;
      const pilW = (24 + (1 - pilP) * 16) * vfxScale;
      const pilGrad = ctx.createLinearGradient(lx, 0, lx, ly);
      pilGrad.addColorStop(0, 'rgba(255, 199, 0, 0)');
      pilGrad.addColorStop(0.35, `rgba(0, 240, 255, ${0.55 * pilAlpha})`);
      pilGrad.addColorStop(0.85, `rgba(255, 199, 0, ${0.92 * pilAlpha})`);
      pilGrad.addColorStop(1, `rgba(255, 255, 255, ${0.98 * pilAlpha})`);
      ctx.fillStyle = pilGrad;
      ctx.fillRect(lx - pilW * 0.5, 0, pilW, ly);

      // Floor hexagonal target reticle
      ctx.strokeStyle = `rgba(255, 199, 0, ${0.92 * pilAlpha})`;
      ctx.lineWidth = 2.2 * vfxScale;
      ctx.beginPath();
      ctx.ellipse(
        lx,
        ly,
        (26 + pilP * 24) * vfxScale,
        (8 + pilP * 7) * vfxScale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Auraline Signature Pass 4: Golden Reactor Core Aura & Defensive Aegis Counter-Matrix
  if (sim.auralineReactorAuraTimer > 0 || sim.auralineAegisDomeTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const centerY = groundY - heroTargetHeight * 0.48;

    if (sim.auralineReactorAuraTimer > 0) {
      const rp = Math.min(1, sim.auralineReactorAuraTimer / 0.42);
      const rRadius = heroTargetHeight * 0.52;
      const rGrad = ctx.createRadialGradient(
        heroBaseX,
        centerY,
        4 * vfxScale,
        heroBaseX,
        centerY,
        rRadius,
      );
      rGrad.addColorStop(0, `rgba(255, 230, 128, ${0.52 * rp})`);
      rGrad.addColorStop(0.55, `rgba(255, 184, 0, ${0.32 * rp})`);
      rGrad.addColorStop(1, 'rgba(255, 184, 0, 0)');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(heroBaseX, centerY, rRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ascending golden reactor chevron rings
      for (let ring = 0; ring < 2; ring++) {
        const ry = groundY - 12 * vfxScale - ((1 - rp + ring * 0.45) % 1) * (heroTargetHeight * 0.92);
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.82 * rp})`;
        ctx.lineWidth = 2.2 * vfxScale;
        ctx.beginPath();
        ctx.ellipse(heroBaseX, ry, (40 - ring * 6) * vfxScale, 9.5 * vfxScale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (sim.auralineAegisDomeTimer > 0) {
      const ap = Math.min(1, sim.auralineAegisDomeTimer / 0.45);
      const domeX = heroBaseX + 12 * vfxScale;
      const domeR = heroTargetHeight * 0.56;
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.9 * ap})`;
      ctx.lineWidth = 2.8 * vfxScale;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k - Math.PI / 6;
        const px = domeX + Math.cos(ang) * domeR;
        const py = centerY + Math.sin(ang) * domeR;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 199, 0, ${0.84 * ap})`;
      ctx.lineWidth = 1.8 * vfxScale;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        const px = domeX + Math.cos(ang) * (domeR * 0.76);
        const py = centerY + Math.sin(ang) * (domeR * 0.76);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (sim.overdriveTimer > 0 && sim.kiraDropkickRingTimer <= 0 && sim.auralineBroadsideTimer <= 0) {
    const a = Math.min(1, sim.overdriveTimer / 0.65);
    const beamGrad = ctx.createLinearGradient(heroBaseX, 0, w, 0);
    beamGrad.addColorStop(0, `rgba(255, 184, 0, ${0.72 * a})`);
    beamGrad.addColorStop(0.5, `rgba(255, 59, 127, ${0.58 * a})`);
    beamGrad.addColorStop(1, `rgba(0, 229, 255, ${0.38 * a})`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(heroBaseX, groundY - h * 0.42, w - heroBaseX, h * 0.3);
  }

  if (!tacticalViewActive || sim.slashArcTimer > 0 || sim.kickWaveTimer > 0 || sim.overdriveTimer > 0) {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const pt = sim.particles[i];
      if (!pt.active) continue;
      const lifeNorm = Math.min(1, pt.life / Math.max(0.01, pt.maxLife));
      const fade = Math.max(0, 1 - lifeNorm);
      ctx.fillStyle = pt.color;
      if (pt.shape === 1) {
        ctx.globalAlpha = fade;
        const half = pt.size * 0.6;
        const ang = pt.life * 8;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const dx1 = (c - s) * half;
        const dy1 = (s + c) * half;
        const dx2 = (-c - s) * half;
        const dy2 = (-s + c) * half;
        ctx.beginPath();
        ctx.moveTo(pt.x + dx1, pt.y + dy1);
        ctx.lineTo(pt.x + dx2, pt.y + dy2);
        ctx.lineTo(pt.x - dx1, pt.y - dy1);
        ctx.lineTo(pt.x - dx2, pt.y - dy2);
        ctx.closePath();
        ctx.fill();
      } else if (pt.shape === 3) {
        ctx.save();
        ctx.globalAlpha = fade * 0.94;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        const sz = pt.size;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.95, -sz * 0.3);
        ctx.lineTo(sz * 0.35, -sz * 0.55);
        ctx.lineTo(sz * 1.05, sz * 0.12);
        ctx.lineTo(-sz * 0.25, sz * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      } else if (pt.shape === 4) {
        ctx.save();
        const mistAlpha = Math.sin(lifeNorm * Math.PI) * 0.66;
        const rad = pt.size * (0.75 + lifeNorm * 0.8);
        const grad = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, rad);
        grad.addColorStop(0, '#DCFCE7');
        grad.addColorStop(0.32, pt.color);
        grad.addColorStop(0.7, 'rgba(34, 197, 94, 0.42)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.globalAlpha = Math.max(0, mistAlpha);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function renderFloatingTextsPass(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  h: number,
): void {
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(9, 14, 28, 0.9)';
  const textScaleBase = h < 220 ? 16 : 22;
  for (let i = 0; i < TEXT_POOL_SIZE; i++) {
    const ft = sim.texts[i];
    if (!ft.active) continue;
    ctx.globalAlpha = Math.max(0, 1 - ft.life / ft.maxLife);
    ctx.font = `700 ${Math.round(textScaleBase * ft.scale)}px "JetBrains Mono", monospace`;
    const clampedY = Math.max(20, ft.y);
    ctx.strokeText(ft.text, ft.x, clampedY);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, clampedY);
  }
  ctx.globalAlpha = 1;
}

export function renderScreenSpaceForegroundPass(params: {
  fgCtx: CanvasRenderingContext2D;
  sim: CombatStageSim;
  seqFrame: SequencerFrameState | null;
  tacticalViewActive: boolean;
  reducedMotion: boolean;
  elapsed: number;
}): void {
  const { fgCtx, sim, seqFrame, tacticalViewActive, reducedMotion, elapsed } = params;
  const { w, h } = sim.size;
  const dpr = sim.dpr;

  if (!tacticalViewActive) {
    renderScreenBloodDrops(fgCtx, sim, elapsed);
  }

  if (
    seqFrame &&
    !tacticalViewActive &&
    !reducedMotion &&
    (seqFrame.speedLinesAlpha > 0.02 || seqFrame.invertFlashAlpha > 0.01)
  ) {
    fgCtx.save();
    fgCtx.scale(dpr, dpr);
    renderCutInForegroundVfx(fgCtx, seqFrame, w, h, elapsed);
    fgCtx.restore();
  }
}
