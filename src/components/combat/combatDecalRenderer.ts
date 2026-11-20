import {
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  FLOOR_FISSURE_POOL_SIZE,
  type CombatStageSim,
  type FloorBloodPuddle,
  type FloorFissure,
} from './combatStageTypes';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  sampleWeatheredBloodColors,
} from './mutantBlood';

export function renderFloorBloodDecal(
  ctx: CanvasRenderingContext2D,
  fp: FloorBloodPuddle,
  index: number,
  elapsed: number,
  tacticalViewActive: boolean,
): void {
  const profile = getBloodBiologyProfile(fp.owner);
  const weathering = computeBloodWeatheringState(fp.visualTurnAge);
  const colors = sampleWeatheredBloodColors(profile, fp.visualTurnAge);
  const pulse = 0.72 + 0.28 * Math.sin(elapsed * 2.5 + fp.seed);
  const creepWave =
    weathering.turnAge < 1.5 ? Math.sin(elapsed * 1.8 + index * 0.9) * 0.45 * (1 - weathering.dryness) : 0;
  const rx = fp.rx + creepWave;
  const ry = fp.ry;

  if (fp.shapeKind === 'scorch_ring') {
    ctx.save();
    ctx.translate(fp.x, fp.y);

    ctx.globalAlpha = 0.78 * fp.alpha;
    ctx.fillStyle = '#070B14';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    const rimAlpha = (0.35 + 0.65 * weathering.emissiveIntensity) * fp.alpha * (0.85 + 0.15 * pulse);
    ctx.globalAlpha = rimAlpha;
    ctx.strokeStyle = fp.plasmaColor;
    ctx.lineWidth = Math.max(1.4, ry * 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.72 * fp.alpha;
    ctx.strokeStyle = colors.body;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.88 * fp.alpha;
    ctx.fillStyle = '#03050A';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    if (weathering.emissiveIntensity > 0.12 && !tacticalViewActive) {
      ctx.globalAlpha = 0.78 * weathering.emissiveIntensity * fp.alpha;
      ctx.fillStyle = fp.plasmaColor;
      for (let b = 0; b < 4; b++) {
        const ang = fp.seed + b * 1.57 + elapsed * 0.4;
        const bx = Math.cos(ang) * rx * 0.84;
        const by = Math.sin(ang) * ry * 0.84;
        const br = 1.1 + 0.7 * Math.sin(elapsed * 6 + b * 2.1 + fp.seed);
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(0.6, br), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (fp.shapeKind === 'melee_arc') {
    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.angle);

    ctx.globalAlpha = 0.46 * fp.alpha;
    ctx.fillStyle = colors.rimShadow;
    ctx.beginPath();
    ctx.ellipse(1.4, 1.3, rx * 1.04, ry * 0.72, 0, -Math.PI * 0.18, Math.PI * 0.82);
    ctx.fill();

    ctx.globalAlpha = 0.88 * fp.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.moveTo(-rx, -ry * 0.15);
    ctx.quadraticCurveTo(0, ry * 1.25, rx, -ry * 0.25);
    ctx.quadraticCurveTo(0, ry * 0.22, -rx, -ry * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(rx * 1.12, -ry * 0.35, Math.max(2.2, rx * 0.14), Math.max(1.2, ry * 0.22), 0.25, 0, Math.PI * 2);
    ctx.ellipse(-rx * 1.06, -ry * 0.22, Math.max(1.8, rx * 0.11), Math.max(1.0, ry * 0.18), -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.72 * fp.alpha;
    ctx.fillStyle = colors.core;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.72, 0);
    ctx.quadraticCurveTo(0, ry * 0.82, rx * 0.75, -ry * 0.08);
    ctx.quadraticCurveTo(0, ry * 0.35, -rx * 0.72, 0);
    ctx.closePath();
    ctx.fill();

    if (weathering.emissiveIntensity > 0.05) {
      ctx.globalAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.55 * fp.alpha * pulse;
      ctx.strokeStyle = profile.hasSuspendedVeins ? colors.veinPrimary : colors.emissive;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.65, ry * 0.08);
      ctx.quadraticCurveTo(0, ry * 0.55, rx * 0.68, -ry * 0.02);
      ctx.stroke();
    }

    if (weathering.glossiness > 0.2) {
      ctx.globalAlpha = weathering.glossiness * 0.58 * fp.alpha;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.52, ry * 0.1);
      ctx.quadraticCurveTo(-rx * 0.1, ry * 0.42, rx * 0.36, ry * 0.18);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(fp.x, fp.y);
  if (fp.shapeKind === 'cone_droplet' && Math.abs(fp.angle) > 0.01) {
    ctx.rotate(fp.angle * 0.35);
  }

  const rimThick = 0.8 + profile.viscosity * 0.8 + weathering.crustAmount * 0.5;
  ctx.globalAlpha = (0.38 + weathering.crustAmount * 0.22) * fp.alpha;
  ctx.fillStyle = colors.rimShadow;
  ctx.beginPath();
  ctx.ellipse(1.1, 1.0, rx + rimThick, ry + rimThick * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = (tacticalViewActive ? 0.92 : 0.86) * fp.alpha;
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (fp.shapeKind !== 'trail_drop') {
    ctx.ellipse(
      fp.lobeOffsetX,
      fp.lobeOffsetY,
      rx * fp.lobeScale,
      ry * fp.lobeScale,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.ellipse(-rx * 0.85, 0, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
  }

  if (fp.tendrilLen1 > 1) {
    const tx1 = fp.tendrilOffsetX1 + fp.flowVx * 0.45;
    const ty1 = ry * 0.45 + fp.tendrilLen1 * 0.42;
    ctx.ellipse(
      (fp.tendrilOffsetX1 + tx1) * 0.5,
      ty1 * 0.5,
      Math.max(2.2, rx * 0.16),
      Math.max(1.6, fp.tendrilLen1 * 0.26),
      0.18,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(tx1, ty1, Math.max(2.6, rx * 0.2), Math.max(1.5, ry * 0.38), 0, 0, Math.PI * 2);
  }
  if (fp.tendrilLen2 > 1) {
    const tx2 = fp.tendrilOffsetX2 + fp.flowVx * 0.3;
    const ty2 = ry * 0.4 + fp.tendrilLen2 * 0.38;
    ctx.ellipse(
      (fp.tendrilOffsetX2 + tx2) * 0.5,
      ty2 * 0.5,
      Math.max(1.8, rx * 0.13),
      Math.max(1.3, fp.tendrilLen2 * 0.22),
      -0.15,
      0,
      Math.PI * 2,
    );
  }
  ctx.fill();

  const iriAlpha = weathering.iridescenceIntensity * profile.iridescence * fp.alpha;
  if (iriAlpha > 0.05) {
    ctx.globalAlpha = 0.62 * iriAlpha;
    ctx.strokeStyle = colors.iridescenceA;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.94, ry * 0.9, 0, Math.PI * 0.85, Math.PI * 1.85);
    ctx.stroke();

    ctx.strokeStyle = colors.iridescenceB;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.92, ry * 0.88, 0, -Math.PI * 0.1, Math.PI * 0.72);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.78 * fp.alpha;
  ctx.fillStyle = colors.core;
  ctx.beginPath();
  ctx.ellipse(0, 0.3, rx * 0.62, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (weathering.emissiveIntensity > 0.04 && profile.emissiveStrength > 0.15) {
    if (profile.hasSuspendedVeins) {
      const veinAlpha = weathering.emissiveIntensity * profile.emissiveStrength * fp.alpha * pulse;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.88, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = colors.veinPrimary;
      ctx.globalAlpha = 0.88 * veinAlpha;
      ctx.lineWidth = Math.max(1.0, Math.min(2.2, ry * 0.28));
      ctx.beginPath();
      ctx.moveTo(-rx * 0.68, -ry * 0.12);
      ctx.quadraticCurveTo(-rx * 0.12, ry * 0.42, rx * 0.65, -ry * 0.08);
      ctx.stroke();

      ctx.strokeStyle = colors.veinSecondary;
      ctx.globalAlpha = 0.76 * veinAlpha;
      ctx.lineWidth = Math.max(0.85, Math.min(1.6, ry * 0.2));
      ctx.beginPath();
      ctx.moveTo(-rx * 0.34, ry * 0.38);
      ctx.quadraticCurveTo(rx * 0.06, -ry * 0.34, rx * 0.52, ry * 0.28);
      ctx.stroke();
      ctx.restore();
    } else {
      const subAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.42 * fp.alpha * pulse;
      ctx.globalAlpha = subAlpha;
      ctx.fillStyle = colors.emissive;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.44, ry * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weathering.glossiness > 0.18) {
    ctx.globalAlpha = weathering.glossiness * 0.62 * fp.alpha;
    ctx.fillStyle = colors.highlight;
    ctx.beginPath();
    ctx.ellipse(
      -rx * 0.24,
      -ry * 0.26,
      Math.max(1.4, rx * 0.28 * weathering.glossiness),
      Math.max(0.7, ry * 0.24 * weathering.glossiness),
      -0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  if (weathering.crustAmount > 0.15) {
    ctx.globalAlpha = weathering.crustAmount * 0.55 * fp.alpha;
    ctx.strokeStyle = colors.crust;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.96, ry * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = colors.highlight;
    ctx.globalAlpha = weathering.crustAmount * 0.42 * fp.alpha;
    for (let c = 0; c < 3; c++) {
      const cx = Math.sin(fp.seed * 3.1 + c * 2.4) * rx * 0.55;
      const cy = Math.cos(fp.seed * 1.7 + c * 1.9) * ry * 0.45;
      ctx.fillRect(cx - 0.8, cy - 0.6, 1.6, 1.2);
    }
  }

  ctx.restore();
}

export function renderBruteGroundFissure(
  ctx: CanvasRenderingContext2D,
  f: FloorFissure,
  index: number,
  elapsed: number,
  tacticalViewActive: boolean,
): void {
  if (f.alpha <= 0.01) return;
  const sc = f.scale;
  const rx = 54 * sc;
  const ry = 13 * sc;
  const coolFactor = Math.max(0, 1 - f.visualTurnAge * 0.45);
  const heatGlow = Math.max(f.heatIntensity, coolFactor * 0.65);
  const pulse = 0.72 + 0.28 * Math.sin(elapsed * 4.2 + f.seed + index);

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.globalAlpha = tacticalViewActive ? f.alpha * 0.38 : f.alpha;

  const craterGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, rx);
  craterGrad.addColorStop(0, `rgba(15, 23, 42, ${0.82 * f.alpha})`);
  craterGrad.addColorStop(0.55, `rgba(30, 41, 59, ${0.46 * f.alpha})`);
  craterGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = craterGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (heatGlow > 0.08 && !tacticalViewActive) {
    const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, rx * 0.85);
    glowGrad.addColorStop(0, `rgba(253, 224, 71, ${0.72 * heatGlow * pulse})`);
    glowGrad.addColorStop(0.35, `rgba(251, 146, 60, ${0.62 * heatGlow * pulse})`);
    glowGrad.addColorStop(0.75, `rgba(239, 68, 68, ${0.34 * heatGlow * pulse})`);
    glowGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.85, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const branchAngles = [-2.72, -2.05, -0.95, -0.28, 0.34, 1.15, 2.25, 2.88];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let b = 0; b < branchAngles.length; b++) {
    const baseAng = branchAngles[b] + Math.sin(f.seed + b * 2.1) * 0.14;
    const len = (28 + ((b * 13 + Math.round(f.seed * 7)) % 26)) * sc;
    const midFrac = 0.48;
    const kink = Math.cos(f.seed * 3.1 + b * 1.7) * 5.5 * sc;
    const mx = Math.cos(baseAng) * len * midFrac + kink * 0.5;
    const my = Math.sin(baseAng) * len * midFrac * 0.28 + kink * 0.12;
    const ex = Math.cos(baseAng) * len;
    const ey = Math.sin(baseAng) * len * 0.28;

    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3.6 * sc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.52)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(mx * 0.4, my * 0.4 - 0.8);
    ctx.lineTo(ex, ey - 0.8);
    ctx.stroke();

    if (heatGlow > 0.12 && !tacticalViewActive) {
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.92 * heatGlow * pulse})`;
      ctx.lineWidth = 2.0 * sc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex * 0.78, ey * 0.78);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 240, 138, ${0.78 * heatGlow * pulse})`;
      ctx.lineWidth = 0.9 * sc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(mx, my);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function renderSpitterGroundPuddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  pustuleGlow: number,
  chargeIntensity: number,
  elapsed: number,
  seed: number,
): void {
  if (alpha <= 0.01) return;
  const breath = Math.sin(elapsed * 2.2 + seed * 1.3);
  const expand = 1 + breath * 0.025 + chargeIntensity * 0.08;
  const rx = size * 0.36 * expand;
  const ry = Math.max(5.5, size * 0.052 * expand);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(26, 46, 5, 0.78)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 2.5, ry + 1.4, 0, 0, Math.PI * 2);
  ctx.ellipse(x - rx * 0.48, y + 1.2, rx * 0.42, ry * 0.68, -0.08, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.46, y + 0.8, rx * 0.38, ry * 0.64, 0.08, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(x, y - 0.5, 2, x, y, rx);
  bodyGrad.addColorStop(0, '#FACC15');
  bodyGrad.addColorStop(0.45, '#A3E635');
  bodyGrad.addColorStop(0.82, '#65A30D');
  bodyGrad.addColorStop(1, '#365314');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(x - rx * 0.46, y + 1.0, rx * 0.39, ry * 0.6, -0.08, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.44, y + 0.6, rx * 0.35, ry * 0.56, 0.08, 0, Math.PI * 2);
  ctx.fill();

  const coreAlpha = Math.min(0.92, 0.48 + pustuleGlow * 0.35 + chargeIntensity * 0.2);
  ctx.globalAlpha = alpha * coreAlpha;
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.06, y - 0.4, rx * 0.52, ry * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let b = 0; b < 4; b++) {
    const bPhase = (elapsed * (0.95 + b * 0.18) + seed * 0.41 + b * 0.27) % 1;
    const bFade = Math.sin(bPhase * Math.PI);
    const bx = x + Math.cos(b * 1.9 + seed) * rx * 0.56;
    const by = y + Math.sin(b * 2.3 + seed) * ry * 0.36 - bPhase * 2.2;
    const br = (1.2 + (b % 2) * 0.9) * (0.5 + 0.6 * bFade);
    ctx.globalAlpha = alpha * bFade * 0.82;
    ctx.fillStyle = b % 2 === 0 ? '#FEF9C3' : '#FACC15';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderDecalPass(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  deckFrontY: number,
  elapsed: number,
  tacticalViewActive: boolean,
): void {
  ctx.save();
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active || fp.alpha <= 0.01) continue;
    renderFloorBloodDecal(ctx, fp, i, elapsed, tacticalViewActive);
  }

  for (let i = 0; i < FLOOR_FISSURE_POOL_SIZE; i++) {
    const ff = sim.floorFissures[i];
    if (!ff.active || ff.alpha <= 0.01) continue;
    renderBruteGroundFissure(ctx, ff, i, elapsed, tacticalViewActive);
  }

  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    const cd = sim.coverBlood[i];
    if (!cd.active || cd.surface !== 'front_curb' || cd.alpha <= 0.01) continue;
    const profile = getBloodBiologyProfile(cd.owner);
    const weathering = computeBloodWeatheringState(cd.visualTurnAge);
    const colors = sampleWeatheredBloodColors(profile, cd.visualTurnAge);
    const cy = deckFrontY + cd.offsetY;
    ctx.save();
    ctx.globalAlpha = 0.84 * cd.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(cd.x, cy, cd.rx * 0.8, Math.max(2, cd.ry * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();
    if (weathering.glossiness > 0.22) {
      ctx.globalAlpha = weathering.glossiness * 0.5 * cd.alpha;
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.ellipse(cd.x - cd.rx * 0.18, cy - 1, Math.max(1, cd.rx * 0.25), 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const drip = sim.edgeDrips[i];
    if (!drip.active || drip.alpha <= 0.01) continue;

    const profile = getBloodBiologyProfile(drip.owner);
    const weathering = computeBloodWeatheringState(drip.visualTurnAge);
    const colors = sampleWeatheredBloodColors(profile, drip.visualTurnAge);

    const edgeY = deckFrontY;
    const sway = Math.sin(drip.bulbPhase * 0.65 + i * 0.7) * 0.55 * (1 - weathering.dryness * 0.8);
    const tipX = drip.x + sway;
    const tipY = edgeY + drip.length;
    const baseW = drip.thickness;
    const stretchRatio = Math.min(1, drip.length / Math.max(10, drip.maxLength));
    const neckW = Math.max(0.9, baseW * (0.48 - stretchRatio * 0.22));
    const bulbPulse = 1 + Math.sin(drip.bulbPhase) * 0.12 + stretchRatio * 0.28;
    const bulbRx = Math.max(1.5, baseW * 0.58 * bulbPulse);
    const bulbRy = Math.max(2.1, baseW * 0.82 * bulbPulse);

    ctx.globalAlpha = 0.88 * drip.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(drip.x, edgeY + 0.4, baseW * 1.35, Math.max(1.5, baseW * 0.42), 0, 0, Math.PI * 2);
    ctx.moveTo(drip.x - baseW * 0.82, edgeY);
    ctx.quadraticCurveTo(
      drip.x - neckW * 0.65,
      edgeY + drip.length * 0.52,
      tipX - bulbRx * 0.78,
      tipY - bulbRy * 0.35,
    );
    ctx.lineTo(tipX + bulbRx * 0.78, tipY - bulbRy * 0.35);
    ctx.quadraticCurveTo(
      drip.x + neckW * 0.65,
      edgeY + drip.length * 0.52,
      drip.x + baseW * 0.82,
      edgeY,
    );
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(tipX, tipY, bulbRx, bulbRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.78 * drip.alpha;
    ctx.fillStyle = colors.core;
    ctx.beginPath();
    ctx.ellipse(drip.x, edgeY + 0.5, baseW * 0.8, Math.max(1, baseW * 0.25), 0, 0, Math.PI * 2);
    ctx.ellipse(
      (drip.x + tipX) * 0.5,
      edgeY + drip.length * 0.46,
      Math.max(0.7, neckW * 0.42),
      Math.max(1.2, drip.length * 0.38),
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(tipX, tipY + 0.3, bulbRx * 0.62, bulbRy * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    if (weathering.emissiveIntensity > 0.08 && profile.emissiveStrength > 0.2) {
      ctx.globalAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.58 * drip.alpha;
      ctx.fillStyle = profile.hasSuspendedVeins ? colors.veinPrimary : colors.emissive;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY, bulbRx * 0.4, bulbRy * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (weathering.glossiness > 0.18) {
      ctx.globalAlpha = weathering.glossiness * 0.68 * drip.alpha;
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.ellipse(
        drip.x - baseW * 0.22,
        edgeY + Math.min(6, drip.length * 0.28),
        Math.max(0.55, neckW * 0.26),
        Math.max(1.1, Math.min(7, drip.length * 0.24)),
        0,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        tipX - bulbRx * 0.26,
        tipY - bulbRy * 0.22,
        Math.max(0.65, bulbRx * 0.3),
        Math.max(0.95, bulbRy * 0.34),
        -0.12,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (drip.detachedActive && drip.detachedAlpha > 0.02) {
      const dr = drip.detachedRadius;
      const stretchY = Math.min(2.3, 1.25 + drip.detachedVy * 0.008);
      ctx.globalAlpha = 0.86 * drip.alpha * drip.detachedAlpha;
      ctx.fillStyle = colors.body;
      ctx.beginPath();
      ctx.ellipse(tipX, drip.detachedY, dr * 0.82, dr * stretchY, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.68 * drip.alpha * drip.detachedAlpha;
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.ellipse(
        tipX - dr * 0.2,
        drip.detachedY - dr * 0.25,
        Math.max(0.5, dr * 0.28),
        Math.max(0.8, dr * stretchY * 0.35),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}
