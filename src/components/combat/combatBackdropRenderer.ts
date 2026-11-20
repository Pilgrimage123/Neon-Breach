import type {
  CombatState,
  PendingReinforcement,
} from '../../engine/types';
import type { SequencerFrameState } from './CombatActionSequencer';
import {
  BRIDGE_DECK_BACK_IMG_Y,
  BRIDGE_DECK_FRONT_IMG_Y,
  BRIDGE_DECK_IMG_Y,
  COVER_BLOOD_POOL_SIZE,
  type CombatStageSim,
  type CoverBloodDecal,
} from './combatStageTypes';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  sampleWeatheredBloodColors,
} from './mutantBlood';

export function renderTacticalCoverBarriersAndDecals(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  deckBackY: number,
  w: number,
  elapsed: number,
  tacticalViewActive: boolean,
): void {
  const railHeight = Math.max(20, Math.min(34, Math.round(sim.size.h * 0.075)));
  const railTopY = deckBackY - railHeight;
  const stanchionStep = Math.max(96, Math.round(w / 8));

  ctx.save();
  ctx.fillStyle = tacticalViewActive ? 'rgba(15, 23, 42, 0.55)' : 'rgba(6, 22, 46, 0.34)';
  ctx.fillRect(0, railTopY, w, railHeight);

  ctx.strokeStyle = tacticalViewActive ? 'rgba(226, 232, 240, 0.65)' : 'rgba(103, 232, 249, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, railTopY);
  ctx.lineTo(w, railTopY);
  ctx.stroke();

  ctx.fillStyle = tacticalViewActive ? 'rgba(51, 65, 85, 0.72)' : 'rgba(15, 32, 58, 0.62)';
  for (let sx = Math.round(stanchionStep * 0.5); sx < w; sx += stanchionStep) {
    ctx.fillRect(sx - 3, railTopY - 2, 6, railHeight + 3);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fillRect(sx - 1, railTopY + 3, 2, railHeight - 7);
    ctx.fillStyle = tacticalViewActive ? 'rgba(51, 65, 85, 0.72)' : 'rgba(15, 32, 58, 0.62)';
  }

  ctx.beginPath();
  ctx.rect(0, railTopY - 4, w, railHeight + 6);
  ctx.clip();

  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    const cd: CoverBloodDecal = sim.coverBlood[i];
    if (!cd.active || cd.surface !== 'rear_cover' || cd.alpha <= 0.01) continue;

    const profile = getBloodBiologyProfile(cd.owner);
    const weathering = computeBloodWeatheringState(cd.visualTurnAge);
    const colors = sampleWeatheredBloodColors(profile, cd.visualTurnAge);
    const cy = Math.max(railTopY + 3, Math.min(deckBackY - 2, deckBackY + cd.offsetY));

    ctx.save();
    ctx.translate(cd.x, cy);

    if (cd.shapeKind === 'scorch_ring') {
      ctx.globalAlpha = 0.75 * cd.alpha;
      ctx.fillStyle = '#03050A';
      ctx.beginPath();
      ctx.ellipse(0, 0, cd.rx * 0.9, cd.ry * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (0.3 + 0.65 * weathering.emissiveIntensity) * cd.alpha;
      ctx.strokeStyle = cd.plasmaColor;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.85 * cd.alpha;
      ctx.fillStyle = colors.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, cd.rx, cd.ry, cd.angle * 0.2, 0, Math.PI * 2);
      if (cd.streakLen > 1) {
        const streakEnd = Math.min(deckBackY - cy, cd.streakLen);
        ctx.moveTo(-cd.rx * 0.36, 0);
        ctx.quadraticCurveTo(-cd.rx * 0.14, streakEnd * 0.6, 0, streakEnd);
        ctx.quadraticCurveTo(cd.rx * 0.14, streakEnd * 0.6, cd.rx * 0.36, 0);
        ctx.closePath();
      }
      ctx.fill();

      ctx.globalAlpha = 0.76 * cd.alpha;
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.ellipse(0, 0.5, cd.rx * 0.55, cd.ry * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      if (weathering.emissiveIntensity > 0.06) {
        const pulse = 0.75 + 0.25 * Math.sin(elapsed * 2.4 + cd.seed);
        ctx.globalAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.72 * cd.alpha * pulse;
        ctx.strokeStyle = profile.hasSuspendedVeins ? colors.veinPrimary : colors.emissive;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-cd.rx * 0.35, -cd.ry * 0.1);
        ctx.quadraticCurveTo(0, cd.ry * 0.3, cd.rx * 0.25, cd.streakLen * 0.45);
        ctx.stroke();
      }

      if (weathering.glossiness > 0.22) {
        ctx.globalAlpha = weathering.glossiness * 0.55 * cd.alpha;
        ctx.fillStyle = colors.highlight;
        ctx.beginPath();
        ctx.ellipse(-cd.rx * 0.26, -cd.ry * 0.24, Math.max(1, cd.rx * 0.26), Math.max(0.8, cd.ry * 0.22), -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
  ctx.restore();
}

export function renderBackdropPass(params: {
  ctx: CanvasRenderingContext2D;
  sim: CombatStageSim;
  combat: CombatState;
  w: number;
  h: number;
  groundY: number;
  elapsed: number;
  tacticalViewActive: boolean;
  seqFrame: SequencerFrameState | null;
}): { deckBackY: number; deckFrontY: number } {
  const { ctx, sim, combat, w, h, groundY, elapsed, tacticalViewActive, seqFrame } = params;

  ctx.fillStyle = tacticalViewActive ? '#030712' : '#091126';
  ctx.fillRect(-32, -32, w + 64, h + 64);

  let deckBackY = groundY - Math.round(h * 0.055);
  let deckFrontY = groundY + Math.round(h * 0.032);

  if (sim.backdropImg) {
    const img = sim.backdropImg;
    const scale = Math.max(
      (w + 32) / img.naturalWidth,
      (groundY + 12) / (BRIDGE_DECK_IMG_Y * img.naturalHeight),
      (h - groundY + 12) / ((1 - BRIDGE_DECK_IMG_Y) * img.naturalHeight),
    );
    const drawH = img.naturalHeight * scale;
    deckBackY = groundY - (BRIDGE_DECK_IMG_Y - BRIDGE_DECK_BACK_IMG_Y) * drawH;
    deckFrontY = groundY + (BRIDGE_DECK_FRONT_IMG_Y - BRIDGE_DECK_IMG_Y) * drawH;

    if (!sim.backdropCache || sim.backdropCacheW !== w || sim.backdropCacheH !== h) {
      const cache = document.createElement('canvas');
      cache.width = w + 32;
      cache.height = h + 16;
      const cctx = cache.getContext('2d');
      if (cctx) {
        const drawW = img.naturalWidth * scale;
        const drawX = (cache.width - drawW) * 0.5;
        const drawY = groundY + 8 - drawH * BRIDGE_DECK_IMG_Y;
        cctx.drawImage(img, drawX, drawY, drawW, drawH);
        const grad = cctx.createLinearGradient(0, 0, 0, cache.height);
        grad.addColorStop(0, 'rgba(8, 18, 44, 0.22)');
        grad.addColorStop(0.45, 'rgba(0, 240, 255, 0.04)');
        grad.addColorStop(0.78, 'rgba(12, 24, 56, 0.08)');
        grad.addColorStop(1, 'rgba(9, 17, 38, 0.42)');
        cctx.fillStyle = grad;
        cctx.fillRect(0, 0, cache.width, cache.height);
      }
      sim.backdropCache = cache;
      sim.backdropCacheW = w;
      sim.backdropCacheH = h;
    }
    const parallaxX =
      tacticalViewActive || seqFrame?.active ? 0 : Math.sin(elapsed * 0.35) * 4;
    ctx.drawImage(sim.backdropCache, -16 + parallaxX, -8);

    if (tacticalViewActive) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.62)';
      ctx.fillRect(-32, -32, w + 64, h + 64);
    }
  }

  if (
    !sim.deckGradCache ||
    sim.deckGradBackY !== deckBackY ||
    sim.deckGradFrontY !== deckFrontY
  ) {
    const deckGrad = ctx.createLinearGradient(0, deckBackY, 0, deckFrontY);
    deckGrad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    deckGrad.addColorStop(0.55, 'rgba(224, 242, 254, 0.12)');
    deckGrad.addColorStop(1, 'rgba(0, 240, 255, 0.22)');
    sim.deckGradCache = deckGrad;
    sim.deckGradBackY = deckBackY;
    sim.deckGradFrontY = deckFrontY;
  }
  ctx.fillStyle = tacticalViewActive ? 'rgba(15, 23, 42, 0.85)' : sim.deckGradCache;
  ctx.fillRect(0, deckBackY, w, Math.max(8, deckFrontY - deckBackY));

  const isOvertimeHeat = combat.director?.heatStage === 'overtime';
  const isMediumHeat = combat.director?.heatStage === 'medium';
  ctx.strokeStyle = tacticalViewActive
    ? '#FFFFFF'
    : isOvertimeHeat
      ? `rgba(255, 46, 126, ${0.42 + 0.25 * Math.sin(elapsed * 5)})`
      : isMediumHeat
        ? 'rgba(251, 146, 60, 0.36)'
        : 'rgba(224, 242, 254, 0.32)';
  ctx.lineWidth = tacticalViewActive ? 2 : isOvertimeHeat ? 1.6 : 1;
  ctx.beginPath();
  ctx.moveTo(0, deckBackY);
  ctx.lineTo(w, deckBackY);
  ctx.moveTo(0, deckFrontY);
  ctx.lineTo(w, deckFrontY);
  ctx.stroke();

  renderTacticalCoverBarriersAndDecals(ctx, sim, deckBackY, w, elapsed, tacticalViewActive);

  if (!tacticalViewActive) {
    for (let i = 0; i < sim.motes.length; i++) {
      const m = sim.motes[i];
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { deckBackY, deckFrontY };
}

export function renderDropPodSignalsPass(params: {
  ctx: CanvasRenderingContext2D;
  pendingDrops: readonly PendingReinforcement[];
  dropCenters: readonly number[];
  enemyBaseX: number;
  enemyStepX: number;
  groundY: number;
  elapsed: number;
  dropIntelHorizon: { revealArchetype: boolean; revealSlot: boolean };
}): void {
  const {
    ctx,
    pendingDrops,
    dropCenters,
    enemyBaseX,
    enemyStepX,
    groundY,
    elapsed,
    dropIntelHorizon,
  } = params;

  for (let dIdx = 0; dIdx < pendingDrops.length; dIdx++) {
    const drop = pendingDrops[dIdx];
    const isUrgent = drop.turnsUntilDrop <= 1;
    const beamColor = drop.isZeroReward
      ? '255, 46, 126'
      : isUrgent
        ? '251, 146, 60'
        : '250, 204, 21';

    if (!dropIntelHorizon.revealSlot) {
      const warnX = enemyBaseX + enemyStepX * 0.5;
      const warnY = 26 + dIdx * 22;
      ctx.save();
      ctx.font = '800 12px "JetBrains Mono", monospace';
      const label = `⚠ ORBITAL DROP · T-${drop.turnsUntilDrop}`;
      const lw = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(7, 14, 34, 0.88)';
      ctx.strokeStyle = `rgba(${beamColor}, 0.9)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(warnX - lw * 0.5, warnY - 10.5, lw, 21, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, warnX, warnY);
      ctx.restore();
      continue;
    }

    const dx = enemyBaseX + (dropCenters[dIdx] ?? drop.slotIndex) * enemyStepX;
    const dy = groundY - (drop.slotIndex % 2 === 1 ? 6 : 0);
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 5.2 + dIdx * 1.4);
    const isTwoSlotDrop = drop.archetype === 'brute';

    ctx.save();
    const beamGrad = ctx.createLinearGradient(dx, Math.max(24, dy - 160), dx, dy);
    beamGrad.addColorStop(0, `rgba(${beamColor}, 0)`);
    beamGrad.addColorStop(0.55, `rgba(${beamColor}, ${0.12 + 0.1 * pulse})`);
    beamGrad.addColorStop(1, `rgba(${beamColor}, ${0.28 + 0.14 * pulse})`);
    ctx.fillStyle = beamGrad;
    const beamHalfW = isTwoSlotDrop ? 28 : 18;
    ctx.fillRect(dx - beamHalfW, Math.max(18, dy - 155), beamHalfW * 2, Math.min(155, dy - 18));

    ctx.strokeStyle = `rgba(${beamColor}, ${0.65 + 0.3 * pulse})`;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(dx, dy - 1, (isTwoSlotDrop ? 44 : 28) + pulse * 4, isTwoSlotDrop ? 10 : 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const bobY = dy - 58 + Math.sin(elapsed * 4 + dIdx) * 4;
    ctx.fillStyle = 'rgba(7, 14, 34, 0.85)';
    ctx.strokeStyle = `rgba(${beamColor}, 0.92)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(dx, bobY - 19);
    ctx.lineTo(dx + 19, bobY);
    ctx.lineTo(dx, bobY + 19);
    ctx.lineTo(dx - 19, bobY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = drop.isZeroReward ? '#FDA4AF' : '#FEF08A';
    ctx.fillText(`T-${drop.turnsUntilDrop}`, dx, bobY + 0.5);

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.lineWidth = 3;
    const archTag = dropIntelHorizon.revealArchetype ? drop.archetype.toUpperCase() : '???';
    ctx.strokeText(archTag, dx, dy + 15);
    ctx.fillStyle = drop.isZeroReward ? '#FDA4AF' : '#FDBA74';
    ctx.fillText(archTag, dx, dy + 15);
    ctx.restore();
  }
}
