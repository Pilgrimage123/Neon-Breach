import { previewHeroineThreat } from '../../engine/gameEngine';
import type { CombatState, HeroineState, TileType, TurnPreview } from '../../engine/types';
import {
  HEROINE_CANONICAL_HEIGHT,
  HEROINE_SHEET_FRAMES,
  type HeroineFrameSample,
} from '../../utils/heroineSpriteSheet';
import {
  type ActorAnim,
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  BRIDGE_DECK_BACK_IMG_Y,
  BRIDGE_DECK_FRONT_IMG_Y,
  BRIDGE_DECK_IMG_Y,
  type CombatStageSim,
  EDGE_DRIP_POOL_SIZE,
  ENEMY_FOOT_DEFAULTS,
  FLOOR_BLOOD_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  TEXT_POOL_SIZE,
  getStageLayoutMetrics,
} from './combatStageTypes';

interface StaggerKinematics {
  dx: number;
  dy: number;
  rot: number;
  scaleXMul: number;
  scaleYMul: number;
  shearPx: number;
  bioFlashAlpha: number;
}

function getEnemyStaggerKinematics(ea: ActorAnim | undefined): StaggerKinematics {
  if (!ea || ea.staggerTimer <= 0 || ea.staggerDuration <= 0) {
    return {
      dx: 0,
      dy: 0,
      rot: 0,
      scaleXMul: 1,
      scaleYMul: 1,
      shearPx: 0,
      bioFlashAlpha: 0,
    };
  }
  const u = Math.max(0, Math.min(1, 1 - ea.staggerTimer / ea.staggerDuration));
  const decay = Math.pow(1 - u, 1.5);
  const recoil = Math.sin(Math.min(1, u * 3.4) * Math.PI * 0.5) * decay;
  const shudder = Math.sin(u * 54) * Math.pow(1 - u, 2.1);
  const intensity = ea.staggerIntensity;

  const dx = (recoil * 36 + shudder * 11.5) * intensity;
  const dy = -Math.sin(u * Math.PI) * 11 * Math.pow(1 - u, 1.35) * intensity;
  const rot = (recoil * 0.26 + shudder * 0.068) * intensity;
  const crunch = Math.sin(u * Math.PI * 3.2) * Math.pow(1 - u, 1.75) * 0.14 * intensity;

  return {
    dx,
    dy,
    rot,
    scaleXMul: 1 - crunch,
    scaleYMul: 1 + crunch * 0.78,
    shearPx: u < 0.36 ? shudder * 10 * intensity : 0,
    bioFlashAlpha: Math.pow(1 - u, 1.7) * 0.52,
  };
}

export function renderCombatStage(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  combat: CombatState,
  heroine: HeroineState,
  hoveredColor: TileType | null,
  heroSample: HeroineFrameSample,
  elapsed: number,
  activePreview: TurnPreview | null = null,
): void {
  const { w, h } = sim.size;
  const dpr = sim.dpr;
  const enemies = combat.enemies;
  const heroFrame = heroSample.frame;
  const {
    groundY,
    heroBaseX,
    enemyBaseX,
    enemyStepX,
    heroTargetHeight,
    heroDrawScale,
    heroX,
    heroY,
  } = getStageLayoutMetrics(
    w,
    h,
    enemies.length,
    sim.dashTargetX,
    heroSample.xProgress,
    heroSample.yHopPx,
    heroFrame.rowScale,
    HEROINE_CANONICAL_HEIGHT,
  );

  ctx.save();
  ctx.scale(dpr, dpr);

  // Camera shake offset (trauma * trauma)
  const shakeMag = sim.trauma * sim.trauma * 11;
  if (shakeMag > 0.1) {
    ctx.translate((Math.random() * 2 - 1) * shakeMag, (Math.random() * 2 - 1) * shakeMag);
  }

  // 1. Backdrop with cached scaled surface & bridge-deck coordinate alignment
  ctx.fillStyle = '#091126';
  ctx.fillRect(-16, -16, w + 32, h + 32);

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
    const parallaxX = Math.sin(elapsed * 0.35) * 4;
    ctx.drawImage(sim.backdropCache, -16 + parallaxX, -8);
  }

  // Prismatic chrome-glass walkway perspective lane highlight (resize-cached gradient)
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
  ctx.fillStyle = sim.deckGradCache;
  ctx.fillRect(0, deckBackY, w, Math.max(8, deckFrontY - deckBackY));

  // Chrome walkway specular sill lines
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.32)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, deckBackY);
  ctx.lineTo(w, deckBackY);
  ctx.moveTo(0, deckFrontY);
  ctx.lineTo(w, deckFrontY);
  ctx.stroke();

  // Ambient drifting light motes
  for (let i = 0; i < sim.motes.length; i++) {
    const m = sim.motes[i];
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Precompute enemy screen positions once for reflection pass + main draw pass
  const isProne = heroSample.state.mode === 'defeat' && heroSample.frameIndex >= 31;

  // 2. Batched Planar Glass Walkway Reflections (Single clip for Heroine + Enemies)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, deckBackY, w, Math.max(12, deckFrontY - deckBackY + 4));
  ctx.clip();

  if (sim.heroFrames && !isProne) {
    const rawCanvas = sim.heroFrames[heroSample.frameIndex];
    const frameCanvas = rawCanvas || sim.heroFrames[0];
    const refFrame = rawCanvas ? heroFrame : HEROINE_SHEET_FRAMES[0];
    if (frameCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.translate(heroX, groundY + 1);
      ctx.scale(1, -0.32 * heroSample.breathScaleY);
      ctx.drawImage(
        frameCanvas,
        -refFrame.anchorX * heroDrawScale,
        -refFrame.bottomY * heroDrawScale,
        refFrame.w * heroDrawScale,
        refFrame.h * heroDrawScale,
      );
      ctx.restore();
    }
  }

  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    const ea = sim.enemyAnims.get(enemy.id);
    const isDead = enemy.hp <= 0;
    const koAlpha = isDead ? (ea ? (ea.dead ? Math.max(0, 1 - ea.koProgress) : 1) : 0) : 1;
    if (koAlpha <= 0.01) continue;
    const entry = sim.enemyCutouts.get(enemy.archetype);
    if (!entry) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const archScale = enemy.archetype === 'boss' ? 1.24 : enemy.archetype === 'brute' ? 1.08 : 0.94;
    const size = Math.min(h * 0.53, w * 0.28, 206) * archScale;
    const lunge = ea ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09) : 0;
    const ex = enemyBaseX + idx * enemyStepX + lunge + stagger.dx;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY = (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX = (1 - breathPhase * 0.009) * stagger.scaleXMul;

    ctx.save();
    ctx.globalAlpha = 0.12 * koAlpha;
    ctx.translate(ex, enemyGroundY + 1);
    ctx.rotate(-stagger.rot * 0.45);
    ctx.scale(enemy.archetype === 'brute' ? -breathScaleX : breathScaleX, -0.3 * breathScaleY);
    ctx.drawImage(
      entry.canvas,
      -size * entry.bounds.centerXRatio,
      -size * entry.bounds.bottomRatio,
      size,
      size,
    );
    ctx.restore();
  }
  ctx.restore();

  // 2.5 Persistent & Slowly Flowing Greenish Floor Blood Puddles on the Sky-Bridge Deck
  ctx.save();
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active || fp.alpha <= 0.01) continue;

    // Subtle slow undulating pulse as the viscous bio-blood creeps along the floor
    const creepWave = Math.sin(elapsed * 1.8 + i * 0.9) * 0.6;
    const rx = fp.rx + creepWave * 0.35;
    const ry = fp.ry;

    // Pass 1: Outer toxic green pool + secondary organic lobe + creeping tendrils
    ctx.globalAlpha = 0.82 * fp.alpha;
    ctx.fillStyle = fp.color;
    ctx.beginPath();
    ctx.ellipse(fp.x, fp.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(
      fp.x + fp.lobeOffsetX,
      fp.y + fp.lobeOffsetY,
      rx * fp.lobeScale,
      ry * fp.lobeScale,
      0,
      0,
      Math.PI * 2,
    );
    // Creeping viscous rivulet 1 (flowing toward front curb / side)
    if (fp.tendrilLen1 > 1) {
      const tx1 = fp.x + fp.tendrilOffsetX1 + fp.flowVx * 0.45;
      const ty1 = fp.y + ry * 0.45 + fp.tendrilLen1 * 0.42;
      ctx.ellipse(
        (fp.x + fp.tendrilOffsetX1 + tx1) * 0.5,
        (fp.y + ty1) * 0.5,
        Math.max(2.2, rx * 0.16),
        Math.max(1.6, fp.tendrilLen1 * 0.26),
        0.18,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(tx1, ty1, Math.max(2.6, rx * 0.2), Math.max(1.5, ry * 0.38), 0, 0, Math.PI * 2);
    }
    // Creeping viscous rivulet 2
    if (fp.tendrilLen2 > 1) {
      const tx2 = fp.x + fp.tendrilOffsetX2 + fp.flowVx * 0.3;
      const ty2 = fp.y + ry * 0.4 + fp.tendrilLen2 * 0.38;
      ctx.ellipse(
        (fp.x + fp.tendrilOffsetX2 + tx2) * 0.5,
        (fp.y + ty2) * 0.5,
        Math.max(1.8, rx * 0.13),
        Math.max(1.3, fp.tendrilLen2 * 0.22),
        -0.15,
        0,
        Math.PI * 2,
      );
    }
    ctx.fill();

    // Pass 2: Coagulated dark-green viscous core
    ctx.globalAlpha = 0.76 * fp.alpha;
    ctx.fillStyle = fp.coreColor;
    ctx.beginPath();
    ctx.ellipse(fp.x, fp.y + 0.3, rx * 0.62, ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pass 3: Glossy wet toxic-lime specular sheen
    ctx.globalAlpha = 0.52 * fp.alpha;
    ctx.fillStyle = fp.highlightColor;
    ctx.beginPath();
    ctx.ellipse(
      fp.x - rx * 0.24,
      fp.y - ry * 0.26,
      Math.max(1.6, rx * 0.28),
      Math.max(0.8, ry * 0.24),
      -0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // 2.6 Thick Greenish Blood Sluggishly Dripping Over the Front Bridge Curb
  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const drip = sim.edgeDrips[i];
    if (!drip.active || drip.alpha <= 0.01) continue;

    const edgeY = deckFrontY;
    const sway = Math.sin(drip.bulbPhase * 0.65 + i * 0.7) * 0.55;
    const tipX = drip.x + sway;
    const tipY = edgeY + drip.length;
    const baseW = drip.thickness;
    // Surface-tension necking: narrows in the middle as the drip stretches close to maxLength
    const stretchRatio = Math.min(1, drip.length / Math.max(10, drip.maxLength));
    const neckW = Math.max(0.9, baseW * (0.48 - stretchRatio * 0.22));
    const bulbPulse = 1 + Math.sin(drip.bulbPhase) * 0.12 + stretchRatio * 0.28;
    const bulbRx = Math.max(1.5, baseW * 0.58 * bulbPulse);
    const bulbRy = Math.max(2.1, baseW * 0.82 * bulbPulse);

    // Outer toxic green viscous streamer + curb meniscus + pendant bulb
    ctx.globalAlpha = 0.88 * drip.alpha;
    ctx.fillStyle = drip.color;
    ctx.beginPath();
    // Thick meniscus lip clinging along the bridge curb
    ctx.ellipse(drip.x, edgeY + 0.4, baseW * 1.35, Math.max(1.5, baseW * 0.42), 0, 0, Math.PI * 2);
    // Tapered viscous column with Bezier surface-tension waist
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

    // Swelling pendant drop at the bottom tip
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, bulbRx, bulbRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark coagulated inner core inside the hanging streamer & bulb
    ctx.globalAlpha = 0.78 * drip.alpha;
    ctx.fillStyle = drip.coreColor;
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

    // Glossy toxic-lime wet specular glint on the hanging column and pendant drop
    ctx.globalAlpha = 0.64 * drip.alpha;
    ctx.fillStyle = drip.highlightColor;
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

    // Detached heavy globule sluggishly falling into the chasm below the bridge
    if (drip.detachedActive && drip.detachedAlpha > 0.02) {
      const dr = drip.detachedRadius;
      const stretchY = Math.min(2.3, 1.25 + drip.detachedVy * 0.008);
      ctx.globalAlpha = 0.86 * drip.alpha * drip.detachedAlpha;
      ctx.fillStyle = drip.color;
      ctx.beginPath();
      ctx.ellipse(tipX, drip.detachedY, dr * 0.82, dr * stretchY, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.68 * drip.alpha * drip.detachedAlpha;
      ctx.fillStyle = drip.highlightColor;
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

  // 3. Heroine Contact Shadows, Preview Aura & Sprite
  const shadowRadiusX = isProne ? heroTargetHeight * 0.54 : heroTargetHeight * 0.32;
  ctx.fillStyle = 'rgba(3, 7, 18, 0.68)';
  ctx.beginPath();
  ctx.ellipse(heroX, groundY - 1, shadowRadiusX, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isProne && heroSample.yHopPx >= -2) {
    ctx.fillStyle = 'rgba(2, 5, 14, 0.85)';
    ctx.beginPath();
    ctx.ellipse(
      heroX - 18 * heroDrawScale,
      groundY - 5 * heroDrawScale,
      14 * heroDrawScale,
      4.2 * heroDrawScale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      heroX + 17 * heroDrawScale,
      groundY + 0.5,
      15 * heroDrawScale,
      4.5 * heroDrawScale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.26)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(heroX, groundY - 1, shadowRadiusX * 0.92, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Tactical preview aura on hover/selection
  if (heroSample.state.mode === 'idle' && hoveredColor) {
    const hoverPulse = 0.55 + 0.3 * Math.sin(elapsed * 5.2);
    if (hoveredColor === 'tech') {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 184, 0, ${0.55 * hoverPulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(heroX, groundY - 1, heroTargetHeight * 0.38, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (hoveredColor === 'defense') {
      ctx.save();
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.5 * hoverPulse})`;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(heroX + 12, groundY - heroTargetHeight * 0.48, heroTargetHeight * 0.46, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();
      ctx.restore();
    } else if (hoveredColor === 'attack' && heroFrame.muzzleRel) {
      const frontIdx = enemies.findIndex((e) => e.hp > 0);
      if (frontIdx !== -1) {
        const targetX = enemyBaseX + frontIdx * enemyStepX;
        const targetY = groundY - (frontIdx % 2 === 1 ? 6 : 0) - 88;
        const mx = heroX + heroFrame.muzzleRel.dx * heroDrawScale;
        const my = heroY + heroFrame.muzzleRel.dy * heroDrawScale;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 59, 127, ${0.38 * hoverPulse})`;
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (sim.upgradeBeamTimer > 0) {
    const alpha = sim.upgradeBeamTimer / 0.55;
    const beamGrad = ctx.createLinearGradient(heroX, groundY, heroX, groundY - heroTargetHeight * 1.25);
    beamGrad.addColorStop(0, `rgba(255, 184, 0, ${0.55 * alpha})`);
    beamGrad.addColorStop(1, 'rgba(255, 184, 0, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(heroX - heroTargetHeight * 0.35, groundY - heroTargetHeight * 1.25, heroTargetHeight * 0.7, heroTargetHeight * 1.25);
  }

  // Sprint & back-dash afterimages
  if (sim.heroFrames && sim.ghosts.length > 0) {
    for (let i = 0; i < sim.ghosts.length; i++) {
      const g = sim.ghosts[i];
      const gf = HEROINE_SHEET_FRAMES[g.frameIndex];
      const gCanvas = sim.heroFrames[g.frameIndex];
      if (!gCanvas) continue;
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.45;
      ctx.translate(g.x, g.y);
      ctx.drawImage(
        gCanvas,
        -gf.anchorX * g.drawScale,
        -gf.bottomY * g.drawScale,
        gf.w * g.drawScale,
        gf.h * g.drawScale,
      );
      ctx.restore();
    }
  }

  // Main Heroine Sprite (with sub-frame pose cross-blending & C1 micro-kinematics)
  if (sim.heroFrames) {
    const rawCanvas = sim.heroFrames[heroSample.frameIndex];
    const frameCanvas = rawCanvas || sim.heroFrames[0];
    const drawFrame = rawCanvas ? heroFrame : HEROINE_SHEET_FRAMES[0];
    const drawScale = (heroTargetHeight / HEROINE_CANONICAL_HEIGHT) * drawFrame.rowScale;

    if (frameCanvas) {
      ctx.save();
      ctx.translate(heroX, heroY);
      if (Math.abs(heroSample.tiltRad) > 0.0005) {
        ctx.rotate(heroSample.tiltRad);
      }
      ctx.scale(heroSample.breathScaleX, heroSample.breathScaleY);

      const blendA = heroSample.frameBlendAlpha;
      const canCrossBlend =
        !heroSample.isDashing &&
        blendA < 0.99 &&
        heroSample.prevFrameIndex !== heroSample.frameIndex;
      const prevCanvas = canCrossBlend ? sim.heroFrames[heroSample.prevFrameIndex] : null;

      if (prevCanvas) {
        const pf = heroSample.prevFrame;
        const prevScale = (heroTargetHeight / HEROINE_CANONICAL_HEIGHT) * pf.rowScale;
        ctx.globalAlpha = Math.min(1, (1 - blendA) * 1.45);
        ctx.drawImage(
          prevCanvas,
          -pf.anchorX * prevScale,
          -pf.bottomY * prevScale,
          pf.w * prevScale,
          pf.h * prevScale,
        );
        ctx.globalAlpha = Math.min(1, 0.35 + blendA * 0.65);
      }

      ctx.drawImage(
        frameCanvas,
        -drawFrame.anchorX * drawScale,
        -drawFrame.bottomY * drawScale,
        drawFrame.w * drawScale,
        drawFrame.h * drawScale,
      );
      ctx.globalAlpha = 1;

      if (sim.heroAnim.flashTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 160, 190, 0.38)';
        ctx.beginPath();
        ctx.arc(0, -heroTargetHeight * 0.48, heroTargetHeight * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Active Cyan Hexagonal Shield Dome
  if ((heroine.shield > 0 || sim.shieldDomeTimer > 0) && heroine.hp > 0) {
    const pulse = sim.shieldDomeTimer > 0 ? 0.5 + 0.5 * (sim.shieldDomeTimer / 0.48) : 0.22;
    ctx.save();
    ctx.translate(heroX + 8, groundY - heroTargetHeight * 0.48);
    ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
    ctx.lineWidth = sim.shieldDomeTimer > 0 ? 3 : 1.75;
    ctx.beginPath();
    const r = heroTargetHeight * 0.46;
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 3) * k - Math.PI / 6;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(0, 229, 255, ${pulse * 0.14})`;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // On-stage Kira Lifebar + Enemy-Inflicted Damage & Lethal Death Preview directly under Kira's feet
  if (heroine.hp > 0 && !isProne && !heroSample.isDashing) {
    const kiraThreat = previewHeroineThreat(combat, heroine, activePreview);
    const hasThreatOrHeal =
      kiraThreat.hpDamageTaken > 0 ||
      kiraThreat.rawIncomingDamage > 0 ||
      kiraThreat.projectedHp !== heroine.hp;
    const barW = 84;
    const barH = kiraThreat.hpDamageTaken > 0 || kiraThreat.healGained > 0 ? 7 : 5;
    const barX = Math.round(heroX - barW * 0.5);
    const barY = Math.round(groundY + 9);
    const curRatio = Math.max(0, Math.min(1, heroine.hp / heroine.maxHp));
    const preEnemyRatio = Math.max(0, Math.min(1, kiraThreat.hpBeforeEnemies / heroine.maxHp));
    const projRatio = Math.max(0, Math.min(1, kiraThreat.projectedHp / heroine.maxHp));
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 10);

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Remaining HP portion after enemy attacks
    const safeRatio = Math.min(curRatio, projRatio);
    if (safeRatio > 0) {
      ctx.fillStyle = '#FF2E7E';
      ctx.fillRect(barX, barY, barW * safeRatio, barH);
    }

    // Net heal portion if projectedHp > current hp
    if (projRatio > curRatio) {
      ctx.fillStyle = `rgba(16, 185, 129, ${0.75 + 0.25 * pulse})`;
      ctx.fillRect(barX + barW * curRatio, barY, barW * (projRatio - curRatio), barH);
    }

    // Previewed enemy-inflicted HP loss portion on Kira's lifebar
    if (kiraThreat.hpDamageTaken > 0 && preEnemyRatio > projRatio) {
      ctx.fillStyle = kiraThreat.willDie
        ? `rgba(255, 199, 0, ${0.78 + 0.22 * pulse})`
        : `rgba(253, 224, 71, ${0.72 + 0.28 * pulse})`;
      ctx.fillRect(
        barX + barW * projRatio,
        barY,
        barW * (preEnemyRatio - projRatio),
        barH,
      );
    }

    ctx.strokeStyle = kiraThreat.willDie
      ? `rgba(255, 46, 126, ${0.78 + 0.22 * pulse})`
      : kiraThreat.hpDamageTaken > 0
        ? 'rgba(255, 199, 0, 0.85)'
        : kiraThreat.shieldAfterPlayer > 0
          ? 'rgba(0, 240, 255, 0.7)'
          : 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = kiraThreat.willDie ? 1.5 : 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    if (hasThreatOrHeal) {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      let label = '';
      let labelColor = '#FDA4AF';
      if (kiraThreat.willDie) {
        label = `☠ LETHAL (-${kiraThreat.hpDamageTaken})`;
        labelColor = '#FFC700';
      } else if (kiraThreat.hpDamageTaken > 0) {
        label = `-${kiraThreat.hpDamageTaken} HP`;
        labelColor = '#FDA4AF';
      } else if (kiraThreat.rawIncomingDamage > 0 && kiraThreat.blockedDamage > 0) {
        label = `BLOCKED (${kiraThreat.blockedDamage})`;
        labelColor = '#67E8F9';
      } else if (kiraThreat.healGained > 0) {
        label = `+${kiraThreat.healGained} HP`;
        labelColor = '#6EE7B7';
      }
      if (label) {
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, heroX, barY + barH + 11);
        ctx.fillStyle = labelColor;
        ctx.fillText(label, heroX, barY + barH + 11);
      }
    }
    ctx.restore();
  }

  // 4. Enemy Sprites, Stagger Recoil, Contact Shadows & Tactical Under-Foot Lifebar Preview
  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    const ea = sim.enemyAnims.get(enemy.id);
    const isDead = enemy.hp <= 0;
    // Keep enemy visible while attack animation is en route, then dissolve once impact sets ea.dead = true
    const koAlpha = isDead ? (ea ? (ea.dead ? Math.max(0, 1 - ea.koProgress) : 1) : 0) : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const archScale = enemy.archetype === 'boss' ? 1.24 : enemy.archetype === 'brute' ? 1.08 : 0.94;
    const size = Math.min(h * 0.53, w * 0.28, 206) * archScale;
    const lunge = ea ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09) : 0;
    const ex = enemyBaseX + idx * enemyStepX + lunge + stagger.dx;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY = (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX = (1 - breathPhase * 0.009) * stagger.scaleXMul;
    const koOffsetY = isDead && ea?.dead ? (1 - koAlpha) * 24 : 0;

    const entry = sim.enemyCutouts.get(enemy.archetype);
    const defaults = ENEMY_FOOT_DEFAULTS[enemy.archetype];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;
    const centerXRatio = entry ? entry.bounds.centerXRatio : defaults.centerXRatio;
    const farFootOffsetPx = defaults.farFootOffsetRatio * size;

    ctx.save();
    ctx.globalAlpha = koAlpha;

    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    ctx.beginPath();
    ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.35, size * 0.32, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(2, 5, 14, 0.84)';
    ctx.beginPath();
    ctx.ellipse(ex - size * 0.12, enemyGroundY - farFootOffsetPx, size * 0.13, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(ex + size * 0.14, enemyGroundY - 1, size * 0.14, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle =
      enemy.archetype === 'boss' || enemy.archetype === 'brute'
        ? 'rgba(132, 204, 22, 0.36)'
        : 'rgba(132, 204, 22, 0.22)';
    ctx.lineWidth = enemy.archetype === 'boss' || enemy.archetype === 'brute' ? 2 : 1.25;
    ctx.beginPath();
    ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.3, size * 0.34, 9.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (entry) {
      ctx.save();
      ctx.translate(ex, enemyGroundY + koOffsetY + stagger.dy);
      ctx.rotate(stagger.rot);
      ctx.scale(enemy.archetype === 'brute' ? -breathScaleX : breathScaleX, breathScaleY);
      ctx.drawImage(entry.canvas, -size * centerXRatio, -size * bottomRatio, size, size);

      // Upper-torso stagger slice displacement & toxic green bio-wound flash on hit
      if (Math.abs(stagger.shearPx) > 0.5) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-size * 0.6, -size * 0.95, size * 1.2, size * 0.48);
        ctx.clip();
        ctx.translate(stagger.shearPx, -2);
        ctx.drawImage(entry.canvas, -size * centerXRatio, -size * bottomRatio, size, size);
        ctx.restore();
      }

      if ((ea && ea.flashTimer > 0) || stagger.bioFlashAlpha > 0.04) {
        ctx.globalCompositeOperation = 'lighter';
        if (ea && ea.flashTimer > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.beginPath();
          ctx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
          ctx.fill();
        }
        if (stagger.bioFlashAlpha > 0.04) {
          ctx.fillStyle = `rgba(132, 204, 22, ${stagger.bioFlashAlpha})`;
          ctx.beginPath();
          ctx.ellipse(4, -size * 0.46, size * 0.28, size * 0.36, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // On-stage Enemy Lifebar + Damage/Death Preview directly under enemy feet
    if (!isDead) {
      const isFrontLiving = idx === frontLivingIdx;
      const rawPreviewDmg = activePreview
        ? isFrontLiving
          ? activePreview.totalDamage > 0
            ? activePreview.totalDamage
            : activePreview.reflectOnBlock
          : activePreview.cleaveDamage
        : 0;
      const willBreakArmor = Boolean(
        activePreview &&
          activePreview.color === 'attack' &&
          activePreview.surgeTriggered &&
          isFrontLiving &&
          enemy.armor > 0,
      );
      const pierceRatio =
        activePreview && activePreview.color === 'attack' && activePreview.armorPiercing ? 0.3 : 0;
      const effectiveArmor = willBreakArmor ? 0 : enemy.armor;
      const piercingDmg = Math.floor(rawPreviewDmg * pierceRatio);
      const regularDmg = rawPreviewDmg - piercingDmg;
      const armorAbsorbed = Math.min(effectiveArmor, regularDmg);
      const previewHpLoss =
        rawPreviewDmg > 0 ? Math.min(enemy.hp, regularDmg - armorAbsorbed + piercingDmg) : 0;
      const projectedHp = Math.max(0, enemy.hp - previewHpLoss);
      const willDie = rawPreviewDmg > 0 && projectedHp <= 0;

      const barW = enemy.archetype === 'boss' ? 96 : 76;
      const barH = rawPreviewDmg > 0 ? 7 : 5;
      const barX = Math.round(ex - barW * 0.5);
      const barY = Math.round(enemyGroundY + 9);
      const curRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      const projRatio = Math.max(0, Math.min(1, projectedHp / enemy.maxHp));
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 10);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // Remaining HP portion
      if (projRatio > 0) {
        ctx.fillStyle = '#FF2E7E';
        ctx.fillRect(barX, barY, barW * projRatio, barH);
      }

      // Previewed damage loss portion on lifebar
      if (previewHpLoss > 0 && curRatio > projRatio) {
        ctx.fillStyle = willDie
          ? `rgba(255, 199, 0, ${0.75 + 0.25 * pulse})`
          : `rgba(253, 224, 71, ${0.7 + 0.3 * pulse})`;
        ctx.fillRect(
          barX + barW * projRatio,
          barY,
          barW * (curRatio - projRatio),
          barH,
        );
      }

      ctx.strokeStyle = willDie
        ? `rgba(255, 46, 126, ${0.75 + 0.25 * pulse})`
        : rawPreviewDmg > 0
          ? 'rgba(255, 199, 0, 0.85)'
          : 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = willDie ? 1.5 : 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

      if (rawPreviewDmg > 0) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const label = willDie ? `☠ KILL (-${previewHpLoss})` : `-${previewHpLoss} HP`;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, ex, barY + barH + 11);
        ctx.fillStyle = willDie ? '#FFC700' : '#FDA4AF';
        ctx.fillText(label, ex, barY + barH + 11);
      }
    }

    ctx.restore();
  }

  // 4.5 Airborne Spraying Greenish Mutant Blood Droplets & Arterial Streaks
  ctx.save();
  for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
    const d = sim.bloodDrops[i];
    if (!d.active) continue;
    const lifeRatio = d.life / d.maxLife;
    const alpha = Math.max(0, 1 - lifeRatio * 0.45);
    const speed = Math.hypot(d.vx, d.vy);
    const angle = Math.atan2(d.vy, d.vx);
    const stretch = 1 + Math.min(2.8, speed / 165);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(d.x, d.y);
    ctx.rotate(angle);

    // Outer arterial green droplet/jet
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, d.size * stretch, d.size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wet toxic lime core highlight
    ctx.fillStyle = '#D9F99D';
    ctx.globalAlpha = alpha * 0.65;
    ctx.beginPath();
    ctx.ellipse(d.size * 0.2, -d.size * 0.12, d.size * stretch * 0.42, d.size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 5. Plasma Pistol Tracer Bolts (3-pass layered glow, zero CPU shadowBlur)
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < BOLT_POOL_SIZE; i++) {
    const b = sim.bolts[i];
    if (!b.active) continue;
    const p = b.life / b.maxLife;
    const tailP = Math.max(0, p - 0.42);
    const tx = b.startX + (b.targetX - b.startX) * tailP;
    const ty = b.startY + (b.targetY - b.startY) * tailP;

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 6.2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  // 6. High Plasma Kick Shockwave Ring & Surge Slash Arc
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

  // 7. Overdrive Prismatic Beam Sweep
  if (sim.overdriveTimer > 0) {
    const a = Math.min(1, sim.overdriveTimer / 0.65);
    const beamGrad = ctx.createLinearGradient(heroBaseX, 0, w, 0);
    beamGrad.addColorStop(0, `rgba(255, 184, 0, ${0.72 * a})`);
    beamGrad.addColorStop(0.5, `rgba(255, 59, 127, ${0.58 * a})`);
    beamGrad.addColorStop(1, `rgba(0, 229, 255, ${0.38 * a})`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(heroBaseX, groundY - h * 0.42, w - heroBaseX, h * 0.3);
  }

  // 8. Zero-GC Pooled Particles (no save/restore churn for circles; trig quad for shards)
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const pt = sim.particles[i];
    if (!pt.active) continue;
    ctx.globalAlpha = Math.max(0, 1 - pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    if (pt.shape === 1) {
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
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // 9. Floating Tabular Damage / Shield Numbers
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(9, 14, 28, 0.9)';
  for (let i = 0; i < TEXT_POOL_SIZE; i++) {
    const ft = sim.texts[i];
    if (!ft.active) continue;
    ctx.globalAlpha = Math.max(0, 1 - ft.life / ft.maxLife);
    ctx.font = `700 ${Math.round(22 * ft.scale)}px "JetBrains Mono", monospace`;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
