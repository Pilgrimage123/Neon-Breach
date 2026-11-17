import { previewHeroineThreat } from '../../engine/gameEngine';
import type {
  CharacterId,
  CombatState,
  HeroineState,
  HeroineThreatPreview,
  TileType,
  TurnPreview,
} from '../../engine/types';
import { AURELIA_CANONICAL_HEIGHT, AURELIA_SHEET_FRAMES } from '../../utils/aureliaSpriteSheet';
import {
  CRAWLER_ARCH_SCALE,
  CRAWLER_CANONICAL_HEIGHT,
  isCrawlerArchetype,
  sampleCrawlerFrame,
} from '../../utils/crawlerSpriteSheet';
import {
  HEROINE_CANONICAL_HEIGHT,
  HEROINE_SHEET_FRAMES,
  type HeroineFrameSample,
} from '../../utils/heroineSpriteSheet';
import {
  ZURI_CANONICAL_HEIGHT,
  ZURI_SHEET_FRAMES,
  sampleZuriDroneFormation,
} from '../../utils/zuriSpriteSheet';
import {
  type ActorAnim,
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  BRIDGE_DECK_BACK_IMG_Y,
  BRIDGE_DECK_FRONT_IMG_Y,
  BRIDGE_DECK_IMG_Y,
  COVER_BLOOD_POOL_SIZE,
  type CombatStageSim,
  type CoverBloodDecal,
  EDGE_DRIP_POOL_SIZE,
  ENEMY_FOOT_DEFAULTS,
  FLOOR_BLOOD_POOL_SIZE,
  type FloorBloodPuddle,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  TEXT_POOL_SIZE,
  getStageLayoutMetrics,
} from './combatStageTypes';
import { computeEffectiveSlotCount, computeEnemyArmorPreview } from './combatEnemyUi';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
  hexToRgba,
  sampleWeatheredBloodColors,
} from './mutantBlood';

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

function renderFloorBloodDecal(
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

  // Plasma / Laser / Acid cauterized black-and-neon scorch ring
  if (fp.shapeKind === 'scorch_ring') {
    ctx.save();
    ctx.translate(fp.x, fp.y);

    // Outer heat-warped carbon halo
    ctx.globalAlpha = 0.78 * fp.alpha;
    ctx.fillStyle = '#070B14';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bubbling neon plasma scorch ring (dims over turns as residual thermal glow cools)
    const rimAlpha = (0.35 + 0.65 * weathering.emissiveIntensity) * fp.alpha * (0.85 + 0.15 * pulse);
    ctx.globalAlpha = rimAlpha;
    ctx.strokeStyle = fp.plasmaColor;
    ctx.lineWidth = Math.max(1.4, ry * 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Biology-tinted charred inner ring
    ctx.globalAlpha = 0.72 * fp.alpha;
    ctx.strokeStyle = colors.body;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Cauterized obsidian core
    ctx.globalAlpha = 0.88 * fp.alpha;
    ctx.fillStyle = '#03050A';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fresh simmering plasma micro-bubbles along the ring edge
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

  // Wide, sweeping melee crescent splatter arc
  if (fp.shapeKind === 'melee_arc') {
    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.angle);

    // Raised meniscus contact shadow
    ctx.globalAlpha = 0.46 * fp.alpha;
    ctx.fillStyle = colors.rimShadow;
    ctx.beginPath();
    ctx.ellipse(1.4, 1.3, rx * 1.04, ry * 0.72, 0, -Math.PI * 0.18, Math.PI * 0.82);
    ctx.fill();

    // Sweeping crescent splatter body
    ctx.globalAlpha = 0.88 * fp.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.moveTo(-rx, -ry * 0.15);
    ctx.quadraticCurveTo(0, ry * 1.25, rx, -ry * 0.25);
    ctx.quadraticCurveTo(0, ry * 0.22, -rx, -ry * 0.15);
    ctx.closePath();
    ctx.fill();

    // Satellite flick droplets along the sweep tangent
    ctx.beginPath();
    ctx.ellipse(rx * 1.12, -ry * 0.35, Math.max(2.2, rx * 0.14), Math.max(1.2, ry * 0.22), 0.25, 0, Math.PI * 2);
    ctx.ellipse(-rx * 1.06, -ry * 0.22, Math.max(1.8, rx * 0.11), Math.max(1.0, ry * 0.18), -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Coagulated dark ridge
    ctx.globalAlpha = 0.72 * fp.alpha;
    ctx.fillStyle = colors.core;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.72, 0);
    ctx.quadraticCurveTo(0, ry * 0.82, rx * 0.75, -ry * 0.08);
    ctx.quadraticCurveTo(0, ry * 0.35, -rx * 0.72, 0);
    ctx.closePath();
    ctx.fill();

    // Subsurface cellular glow or chitinous suspended vein inside sweep arc
    if (weathering.emissiveIntensity > 0.05) {
      ctx.globalAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.55 * fp.alpha * pulse;
      ctx.strokeStyle = profile.hasSuspendedVeins ? colors.veinPrimary : colors.emissive;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.65, ry * 0.08);
      ctx.quadraticCurveTo(0, ry * 0.55, rx * 0.68, -ry * 0.02);
      ctx.stroke();
    }

    // Specular sheen when wet
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

  // Standard viscous puddle, directional cone droplet, or bleeding/shredded trail drop
  ctx.save();
  ctx.translate(fp.x, fp.y);
  if (fp.shapeKind === 'cone_droplet' && Math.abs(fp.angle) > 0.01) {
    ctx.rotate(fp.angle * 0.35);
  }

  // Pass 0: Raised viscous normal-bevel shadow (gives thick gelatinous height above the deck)
  const rimThick = 0.8 + profile.viscosity * 0.8 + weathering.crustAmount * 0.5;
  ctx.globalAlpha = (0.38 + weathering.crustAmount * 0.22) * fp.alpha;
  ctx.fillStyle = colors.rimShadow;
  ctx.beginPath();
  ctx.ellipse(1.1, 1.0, rx + rimThick, ry + rimThick * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pass 1: Outer viscous pool + secondary lobe + creeping tendrils
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
    // Directional tear-drop tail on movement trail decals
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

  // Pass 1.5: Oil-slick Fresnel rim iridescence (Sulfur / Cobalt & Boss Apex)
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

  // Pass 2: Coagulated inner viscous core
  ctx.globalAlpha = 0.78 * fp.alpha;
  ctx.fillStyle = colors.core;
  ctx.beginPath();
  ctx.ellipse(0, 0.3, rx * 0.62, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pass 3: Subsurface Scattering / Cellular Emissive Pulse (fades out over 2-3 turns)
  if (weathering.emissiveIntensity > 0.04 && profile.emissiveStrength > 0.15) {
    if (profile.hasSuspendedVeins) {
      // Chitinous / Ichorous suspended glowing veins inside pitch-black tar
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

  // Pass 4: Specular Glossiness (bright & wet at Turn 0, dulling to matte) + Turn 2+ Crusted/Crystallized Flecks
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
    // Crusted raised coagulated rim & crystallized dry specks
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

function renderTacticalCoverBarriersAndDecals(
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
  // Sleek low-profile sky-bridge half-cover ballistic glass barrier along deckBackY
  ctx.fillStyle = tacticalViewActive ? 'rgba(15, 23, 42, 0.55)' : 'rgba(6, 22, 46, 0.34)';
  ctx.fillRect(0, railTopY, w, railHeight);

  // Top chrome handrail cap
  ctx.strokeStyle = tacticalViewActive ? 'rgba(226, 232, 240, 0.65)' : 'rgba(103, 232, 249, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, railTopY);
  ctx.lineTo(w, railTopY);
  ctx.stroke();

  // Vertical titanium cover stanchions / bollards
  ctx.fillStyle = tacticalViewActive ? 'rgba(51, 65, 85, 0.72)' : 'rgba(15, 32, 58, 0.62)';
  for (let sx = Math.round(stanchionStep * 0.5); sx < w; sx += stanchionStep) {
    ctx.fillRect(sx - 3, railTopY - 2, 6, railHeight + 3);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fillRect(sx - 1, railTopY + 3, 2, railHeight - 7);
    ctx.fillStyle = tacticalViewActive ? 'rgba(51, 65, 85, 0.72)' : 'rgba(15, 32, 58, 0.62)';
  }

  // Project CoverBloodDecals onto the rear cover barrier surface
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
      // Draped vertical splatter + downward viscous gravity streak across cover glass
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

      // Coagulated core
      ctx.globalAlpha = 0.76 * cd.alpha;
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.ellipse(0, 0.5, cd.rx * 0.55, cd.ry * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chitinous glowing vein or subsurface pulse on cover glass
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

      // Fresh specular gloss
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

export function renderCombatStage(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
  combat: CombatState,
  heroine: HeroineState,
  hoveredColor: TileType | null,
  heroSample: HeroineFrameSample,
  elapsed: number,
  activePreview: TurnPreview | null = null,
  hoveredEnemyId: string | null = null,
  inspectedEnemyId: string | null = null,
  tacticalViewActive = false,
  autoFocusCamera = false,
  hoveringSwap = false,
  precomputedThreat?: HeroineThreatPreview,
  dropIntelHorizon: { revealArchetype: boolean; revealSlot: boolean } = {
    revealArchetype: true,
    revealSlot: true,
  },
): void {
  const { w, h } = sim.size;
  const dpr = sim.dpr;
  const enemies = combat.enemies;
  const heroFrame = heroSample.frame;
  const charId: CharacterId = heroine.characterId ?? 'kira';
  const activeFrames = sim.heroFramesByChar[charId];
  const sheetFrames =
    charId === 'aurelia'
      ? AURELIA_SHEET_FRAMES
      : charId === 'zuri'
        ? ZURI_SHEET_FRAMES
        : HEROINE_SHEET_FRAMES;
  const defaultRefFrame = sheetFrames[charId === 'zuri' ? 8 : 0];
  const canonicalHeight =
    charId === 'aurelia'
      ? AURELIA_CANONICAL_HEIGHT
      : charId === 'zuri'
        ? ZURI_CANONICAL_HEIGHT
        : HEROINE_CANONICAL_HEIGHT;
  const pendingDrops = combat.director?.pendingReinforcements ?? [];
  const effectiveSlotCount = computeEffectiveSlotCount(enemies, pendingDrops);
  const {
    groundY,
    heroBaseX,
    enemyBaseX,
    enemyStepX,
    heroTargetHeight,
    baseScale,
    heroDrawScale,
    heroX,
    heroY,
  } = getStageLayoutMetrics(
    w,
    h,
    effectiveSlotCount,
    sim.dashTargetX,
    heroSample.xProgress,
    heroSample.yHopPx,
    heroFrame.rowScale,
    canonicalHeight,
  );

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Auto-Framing Camera ("Auto-Focus Active Area"): smoothly pans & zooms ~18% into active quadrant
  const frontLivingIdxForCam = enemies.findIndex((e) => e.hp > 0);
  const frontEnemyXForCam =
    frontLivingIdxForCam >= 0 ? enemyBaseX + frontLivingIdxForCam * enemyStepX : enemyBaseX;
  const inspectedIdxForCam = inspectedEnemyId
    ? enemies.findIndex((e) => e.id === inspectedEnemyId && e.hp > 0)
    : -1;
  const inspectedEnemyXForCam =
    inspectedIdxForCam >= 0 ? enemyBaseX + inspectedIdxForCam * enemyStepX : null;

  let targetZoom = 1;
  let targetPanX = 0;
  let targetPanY = 0;
  if (autoFocusCamera && w > 0 && h > 0) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const focusY = Math.max(h * 0.35, Math.min(h * 0.72, groundY - h * 0.22));
    if (inspectedEnemyXForCam !== null) {
      targetZoom = 1.2;
      targetPanX = (cx - inspectedEnemyXForCam) * 0.38;
      targetPanY = (cy - focusY) * 0.32;
    } else if (hoveredColor === 'attack') {
      targetZoom = 1.18;
      const midX = heroX * 0.32 + frontEnemyXForCam * 0.68;
      targetPanX = (cx - midX) * 0.35;
      targetPanY = (cy - focusY) * 0.28;
    } else if (hoveredColor === 'defense' || hoveredColor === 'tech') {
      targetZoom = 1.16;
      targetPanX = (cx - (heroX + 18)) * 0.34;
      targetPanY = (cy - focusY) * 0.26;
    }
  }

  const camLerp = tacticalViewActive ? 1 : 0.22;
  sim.cameraZoom = (sim.cameraZoom || 1) + (targetZoom - (sim.cameraZoom || 1)) * camLerp;
  sim.cameraPanX = (sim.cameraPanX || 0) + (targetPanX - (sim.cameraPanX || 0)) * camLerp;
  sim.cameraPanY = (sim.cameraPanY || 0) + (targetPanY - (sim.cameraPanY || 0)) * camLerp;

  if (
    Math.abs(sim.cameraZoom - 1) > 0.004 ||
    Math.abs(sim.cameraPanX) > 0.5 ||
    Math.abs(sim.cameraPanY) > 0.5
  ) {
    ctx.translate(w * 0.5 + sim.cameraPanX, h * 0.5 + sim.cameraPanY);
    ctx.scale(sim.cameraZoom, sim.cameraZoom);
    ctx.translate(-w * 0.5, -h * 0.5);
  }

  // Camera shake offset (trauma * trauma) — suppressed in Tactical View
  const shakeMag = tacticalViewActive ? 0 : sim.trauma * sim.trauma * 11;
  if (shakeMag > 0.1) {
    ctx.translate((Math.random() * 2 - 1) * shakeMag, (Math.random() * 2 - 1) * shakeMag);
  }

  // 1. Backdrop with cached scaled surface & bridge-deck coordinate alignment
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
    const parallaxX = tacticalViewActive ? 0 : Math.sin(elapsed * 0.35) * 4;
    ctx.drawImage(sim.backdropCache, -16 + parallaxX, -8);

    // Tactical View Rule 1: Dim background art and decorative foliage by 60%
    if (tacticalViewActive) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.62)';
      ctx.fillRect(-32, -32, w + 64, h + 64);
    }
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
  ctx.fillStyle = tacticalViewActive ? 'rgba(15, 23, 42, 0.85)' : sim.deckGradCache;
  ctx.fillRect(0, deckBackY, w, Math.max(8, deckFrontY - deckBackY));

  // Chrome walkway specular sill lines (shifts to amber/crimson warning trim in Overtime Heat)
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

  // 1.5 Low-Profile Tactical Cover Glass Barriers + Projected Structural Cover Blood Decals
  renderTacticalCoverBarriersAndDecals(ctx, sim, deckBackY, w, elapsed, tacticalViewActive);

  // Ambient drifting light motes (Tactical View Rule 2: turned off when Tactical View is active)
  if (!tacticalViewActive) {
    for (let i = 0; i < sim.motes.length; i++) {
      const m = sim.motes[i];
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Precompute enemy screen positions once for reflection pass + main draw pass
  const isProne =
    heroSample.state.mode === 'defeat' &&
    (charId === 'aurelia'
      ? heroSample.frameIndex >= 35
      : charId === 'zuri'
        ? heroSample.frameIndex >= 29
        : heroSample.frameIndex >= 31);

  const frontLivingIdxForDrones = enemies.findIndex((e) => e.hp > 0);
  const droneTargetX =
    frontLivingIdxForDrones >= 0
      ? enemyBaseX + frontLivingIdxForDrones * enemyStepX
      : sim.pendingShotTargetX;
  const droneTargetMidY =
    groundY - (frontLivingIdxForDrones >= 0 && frontLivingIdxForDrones % 2 === 1 ? 6 : 0) - 88;
  const zuriDrones =
    charId === 'zuri'
      ? sampleZuriDroneFormation({
          animState: heroSample.state,
          heroineX: heroX,
          heroineDrawBottomY: heroY,
          groundY,
          targetX: droneTargetX,
          targetMidY: droneTargetMidY,
          scale: baseScale,
          totalTime: tacticalViewActive ? 0 : elapsed,
          hoveredColor,
        })
      : null;

  // 2. Batched Planar Glass Walkway Reflections (Single clip for Heroine + Enemies)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, deckBackY, w, Math.max(12, deckFrontY - deckBackY + 4));
  ctx.clip();

  if (activeFrames && !isProne && !tacticalViewActive) {
    const rawCanvas = activeFrames[heroSample.frameIndex];
    const frameCanvas = rawCanvas || activeFrames[0];
    const refFrame = rawCanvas ? heroFrame : defaultRefFrame;
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
    if (tacticalViewActive) break;
    const enemy = enemies[idx];
    const arch = enemy.archetype;
    const ea = sim.enemyAnims.get(enemy.id);
    const isDead = enemy.hp <= 0;
    const crawlerSample = isCrawlerArchetype(arch)
      ? sampleCrawlerFrame(arch, ea, elapsed, idx)
      : null;
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.08
          : 0.94;
    const size = baseEnemySize * archScale;
    const lunge = ea ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09) : 0;
    const ex = enemyBaseX + idx * enemyStepX + lunge + stagger.dx;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY = (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX = (1 - breathPhase * 0.009) * stagger.scaleXMul;

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (!cCanvas) continue;
      const cf = crawlerSample.frame;
      const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
      ctx.save();
      ctx.globalAlpha = 0.12 * koAlpha;
      ctx.translate(ex, enemyGroundY + 1);
      ctx.scale(breathScaleX, -0.3 * breathScaleY);
      ctx.drawImage(
        cCanvas,
        -cf.anchorX * drawScale,
        -cf.bottomY * drawScale,
        cf.w * drawScale,
        cf.h * drawScale,
      );
      ctx.restore();
      continue;
    }

    const entry = sim.enemyCutouts.get(enemy.archetype);
    if (!entry) continue;

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

  // 2.5 Persistent Multi-Turn Weathered Floor Blood, Scorch Rings, Melee Arcs & Movement Trails
  ctx.save();
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active || fp.alpha <= 0.01) continue;
    renderFloorBloodDecal(ctx, fp, i, elapsed, tacticalViewActive);
  }

  // 2.55 Front Curb Wall Splatters
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

  // 2.6 Thick Viscous Alien Blood Sluggishly Dripping Over the Front Bridge Curb (biology & turn weathered)
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

    // Outer biology-colored viscous streamer + curb meniscus + pendant bulb
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

    // Coagulated inner core
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

    // Subsurface / chitinous vein glow inside fresh edge drip
    if (weathering.emissiveIntensity > 0.08 && profile.emissiveStrength > 0.2) {
      ctx.globalAlpha = weathering.emissiveIntensity * profile.emissiveStrength * 0.58 * drip.alpha;
      ctx.fillStyle = profile.hasSuspendedVeins ? colors.veinPrimary : colors.emissive;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY, bulbRx * 0.4, bulbRy * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wet specular glint (dims as drip crusts over turns)
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

    // Detached heavy globule sluggishly falling into the chasm below the bridge
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

  // 3. Heroine Contact Shadows, Preview Aura & Sprite
  const shadowRadiusX = isProne ? heroTargetHeight * 0.54 : heroTargetHeight * 0.32;
  ctx.fillStyle = 'rgba(3, 7, 18, 0.68)';
  ctx.beginPath();
  ctx.ellipse(heroX, groundY - 1, shadowRadiusX, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isProne && charId !== 'zuri' && heroSample.yHopPx >= -2) {
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

  // Thruster Jet Downwash Ring on Sky-Bridge Deck when playing as Zuri (flying up and down)
  if (charId === 'zuri' && heroine.hp > 0) {
    const altitudeFactor = Math.max(0.35, Math.min(1.15, 1 + heroSample.yHopPx / 120));
    const jetPulse = 0.65 + 0.35 * Math.sin(elapsed * 12);
    ctx.save();
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.32 * altitudeFactor * jetPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(
      heroX,
      groundY - 1,
      shadowRadiusX * (0.62 + (1 - altitudeFactor) * 0.4),
      5.5 * altitudeFactor,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
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
      const shieldCenterX = zuriDrones ? zuriDrones.shield.x + 18 * baseScale : heroX + 12;
      ctx.arc(shieldCenterX, groundY - heroTargetHeight * 0.48, heroTargetHeight * 0.46, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();
      ctx.restore();
    } else if (hoveredColor === 'attack' && (heroFrame.muzzleRel || zuriDrones)) {
      const frontIdx = enemies.findIndex((e) => e.hp > 0);
      if (frontIdx !== -1) {
        const targetX = enemyBaseX + frontIdx * enemyStepX;
        const targetY = groundY - (frontIdx % 2 === 1 ? 6 : 0) - 88;
        const mx = zuriDrones
          ? zuriDrones.strike.muzzleX
          : heroX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
        const my = zuriDrones
          ? zuriDrones.strike.muzzleY
          : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 46, 126, ${0.68 * hoverPulse})`;
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2.0;
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
  if (activeFrames && sim.ghosts.length > 0) {
    for (let i = 0; i < sim.ghosts.length; i++) {
      const g = sim.ghosts[i];
      const gf = sheetFrames[g.frameIndex] ?? defaultRefFrame;
      const gCanvas = activeFrames[g.frameIndex];
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
  if (activeFrames) {
    const rawCanvas = activeFrames[heroSample.frameIndex];
    const frameCanvas = rawCanvas || activeFrames[charId === 'zuri' ? 8 : 0] || activeFrames[0];
    const drawFrame = rawCanvas ? heroFrame : defaultRefFrame;
    const drawScale = (heroTargetHeight / canonicalHeight) * drawFrame.rowScale;

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
      const prevCanvas = canCrossBlend ? activeFrames[heroSample.prevFrameIndex] : null;

      if (prevCanvas) {
        const pf = heroSample.prevFrame;
        const prevScale = (heroTargetHeight / canonicalHeight) * pf.rowScale;
        ctx.globalAlpha = Math.min(1, (1 - blendA) * 0.52);
        ctx.drawImage(
          prevCanvas,
          -pf.anchorX * prevScale,
          -pf.bottomY * prevScale,
          pf.w * prevScale,
          pf.h * prevScale,
        );
        ctx.globalAlpha = Math.min(1, 0.84 + blendA * 0.16);
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

  // 3.5 Zuri's Afrofuturist Tri-Drone Formation (Shield Walker, Bio-Med Rotor, Solar Hawk Gunship)
  if (zuriDrones && sim.zuriDroneFrames && heroine.hp > 0) {
    const controllerX = heroX + (heroFrame.muzzleRel?.dx ?? 118) * heroDrawScale;
    const controllerY = heroY + (heroFrame.muzzleRel?.dy ?? -162) * heroDrawScale;
    const droneOrder = [zuriDrones.med, zuriDrones.shield, zuriDrones.strike] as const;
    const droneCanvasIndices = [1, 0, 2] as const;

    for (let dIdx = 0; dIdx < droneOrder.length; dIdx++) {
      const pose = droneOrder[dIdx];
      const dCanvas = sim.zuriDroneFrames[droneCanvasIndices[dIdx]];
      if (!dCanvas) continue;
      const spec = pose.frameDef;
      const dScale = (spec.baseHeightPx / spec.h) * baseScale * pose.scaleMult;

      // Subtle holographic command data-link line when Zuri is actively commanding this drone
      if (pose.activeGlow > 0.5) {
        ctx.save();
        ctx.strokeStyle =
          pose.id === 'strike'
            ? `rgba(255, 46, 126, ${0.32 * pose.activeGlow})`
            : pose.id === 'shield'
              ? `rgba(0, 240, 255, ${0.32 * pose.activeGlow})`
              : `rgba(16, 185, 129, ${0.35 * pose.activeGlow})`;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(controllerX, controllerY);
        ctx.lineTo(pose.x, pose.y);
        ctx.stroke();
        ctx.restore();
      }

      // Bio-Med Drone green nanite repair cone onto Zuri during TECH / Overdrive
      if (pose.id === 'med' && (heroSample.state.mode === 'upgrade' || heroSample.state.mode === 'overdrive')) {
        ctx.save();
        const medBeamGrad = ctx.createLinearGradient(pose.x, pose.y, heroX, heroY - heroTargetHeight * 0.45);
        medBeamGrad.addColorStop(0, 'rgba(16, 185, 129, 0.44)');
        medBeamGrad.addColorStop(1, 'rgba(16, 185, 129, 0.03)');
        ctx.fillStyle = medBeamGrad;
        ctx.beginPath();
        ctx.moveTo(pose.x - 10 * baseScale, pose.y + 10 * baseScale);
        ctx.lineTo(pose.x + 10 * baseScale, pose.y + 10 * baseScale);
        ctx.lineTo(heroX + 26 * baseScale, heroY - heroTargetHeight * 0.25);
        ctx.lineTo(heroX - 26 * baseScale, heroY - heroTargetHeight * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Contact shadow on bridge deck under Shield Quad-Walker Drone
      if (pose.id === 'shield') {
        ctx.save();
        ctx.fillStyle = 'rgba(3, 7, 18, 0.62)';
        ctx.beginPath();
        ctx.ellipse(pose.x, groundY + 2, 32 * baseScale, 5 * baseScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(pose.x, pose.y);
      if (Math.abs(pose.tiltRad) > 0.001) {
        ctx.rotate(pose.tiltRad);
      }
      ctx.drawImage(
        dCanvas,
        -spec.anchorX * dScale,
        -spec.anchorY * dScale,
        spec.w * dScale,
        spec.h * dScale,
      );
      ctx.restore();
    }
  }

  // Active Cyan Hexagonal Shield Dome (for Zuri, her Shield Walker Drone & DEFEND sprite already render native hex barriers, so keep procedural overlay subtle)
  if ((heroine.shield > 0 || sim.shieldDomeTimer > 0) && heroine.hp > 0 && !(zuriDrones && heroSample.state.mode === 'guard')) {
    const rawPulse = sim.shieldDomeTimer > 0 ? 0.5 + 0.5 * (sim.shieldDomeTimer / 0.48) : 0.22;
    const pulse = zuriDrones ? rawPulse * 0.55 : rawPulse;
    const domeCenterX = zuriDrones ? zuriDrones.shield.x + 16 * baseScale : heroX + 8;
    ctx.save();
    ctx.translate(domeCenterX, groundY - heroTargetHeight * 0.48);
    ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
    ctx.lineWidth = sim.shieldDomeTimer > 0 ? 2.5 : 1.5;
    ctx.beginPath();
    const r = heroTargetHeight * (zuriDrones ? 0.42 : 0.46);
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 3) * k - Math.PI / 6;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(0, 229, 255, ${pulse * (zuriDrones ? 0.07 : 0.14)})`;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // On-stage Kira Lifebar + Enemy-Inflicted Damage & Lethal Death Preview directly under Kira's feet
  if (heroine.hp > 0 && !isProne && !heroSample.isDashing) {
    const kiraThreat = precomputedThreat ?? previewHeroineThreat(combat, heroine, activePreview);
    const hasThreatOrHeal =
      kiraThreat.hpDamageTaken > 0 ||
      kiraThreat.rawIncomingDamage > 0 ||
      kiraThreat.projectedHp !== heroine.hp;
    const barW = w < 460 ? 66 : h < 220 ? 72 : 84;
    const barH = kiraThreat.hpDamageTaken > 0 || kiraThreat.healGained > 0 ? 7 : 5;
    const barX = Math.max(4, Math.round(heroX - barW * 0.5));
    const barY = Math.min(h - (hasThreatOrHeal ? 19 : 9), Math.round(groundY + 7));
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
    const arch = enemy.archetype;
    const isCrawler = isCrawlerArchetype(arch);
    const crawlerSample = isCrawlerArchetype(arch)
      ? sampleCrawlerFrame(arch, ea, elapsed, idx)
      : null;
    // Keep enemy visible while attack animation is en route, then dissolve/collapse once impact sets ea.dead = true
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.08
          : 0.94;
    const size = baseEnemySize * archScale;
    const lunge = ea ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09) : 0;
    const ex = enemyBaseX + idx * enemyStepX + lunge + (isCrawler && ea?.dead ? 0 : stagger.dx);
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      isCrawler && ea?.dead ? 1 : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      isCrawler && ea?.dead ? 1 : (1 - breathPhase * 0.009) * stagger.scaleXMul;
    const koOffsetY = !isCrawler && isDead && ea?.dead ? (1 - koAlpha) * 24 : 0;

    const entry = sim.enemyCutouts.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;
    const centerXRatio = entry ? entry.bounds.centerXRatio : defaults.centerXRatio;
    const farFootOffsetPx = defaults.farFootOffsetRatio * size;

    ctx.save();
    ctx.globalAlpha = koAlpha;

    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    ctx.beginPath();
    ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.35, size * 0.32, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(2, 5, 14, 0.84)';
    ctx.beginPath();
    ctx.ellipse(ex - size * 0.12, enemyGroundY - farFootOffsetPx, size * 0.13, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(ex + size * 0.14, enemyGroundY - 1, size * 0.14, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const roleStroke =
      enemy.roleColor === 'crimson' || enemy.roleColor === 'apex'
        ? 'rgba(255, 46, 126, 0.44)'
        : enemy.roleColor === 'blue'
          ? 'rgba(0, 240, 255, 0.44)'
          : enemy.roleColor === 'gold'
            ? 'rgba(255, 199, 0, 0.48)'
            : enemy.roleColor === 'orange'
              ? 'rgba(251, 146, 60, 0.46)'
              : enemy.roleColor === 'violet'
                ? 'rgba(192, 132, 252, 0.46)'
                : 'rgba(163, 230, 53, 0.44)';
    ctx.strokeStyle = roleStroke;
    ctx.lineWidth = arch === 'boss' || arch === 'brute' ? 2.2 : 1.5;
    ctx.beginPath();
    ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.3, size * 0.34, 8.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Status Effect Visual: Bleeding / Shredded ground oozing droplets & micro-splatter tracker
    const enemyBio = getBloodBiologyProfile(arch);
    if (!isDead) {
      const statusFlags = getEnemyStatusVisualFlags(enemy, sim.enemyInitialArmor.get(enemy.id));
      if (statusFlags.isBleeding || statusFlags.isShredded) {
        const bleedPulse = 0.65 + 0.35 * Math.sin(elapsed * 4.5 + idx * 1.7);
        const dropCount = statusFlags.isSeverelyBleeding || statusFlags.isShredded ? 5 : 3;
        ctx.save();
        for (let b = 0; b < dropCount; b++) {
          const ang = idx * 1.1 + b * ((Math.PI * 2) / dropCount) + 0.3;
          const bx = ex + Math.cos(ang) * size * (0.18 + (b % 2) * 0.08);
          const by = enemyGroundY - 1 + Math.sin(ang) * 5.2;
          ctx.globalAlpha = (statusFlags.isSeverelyBleeding ? 0.85 : 0.65) * bleedPulse;
          ctx.fillStyle = enemyBio.freshBody;
          ctx.beginPath();
          ctx.ellipse(bx, by, 3.6 + (b % 2) * 1.4, 1.4 + (b % 2) * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (enemyBio.hasSuspendedVeins || enemyBio.emissiveStrength > 0.6) {
            ctx.globalAlpha = 0.6 * bleedPulse;
            ctx.fillStyle = enemyBio.hasSuspendedVeins ? enemyBio.veinPrimary : enemyBio.freshEmissive;
            ctx.beginPath();
            ctx.arc(bx, by, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Time-Bomb Thermal Charge Windup Reticle (Pyre Stinger)
    const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!isDead && activeIntent?.kind === 'charge') {
      const chargePulse = 0.55 + 0.45 * Math.sin(elapsed * 8.5);
      ctx.save();
      ctx.translate(ex, enemyGroundY - size * 0.48);
      ctx.rotate(elapsed * 1.4);
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.55 + 0.35 * chargePulse})`;
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // SOS Flare Beacon Pulse on stalling lone enemy
    if (!isDead && enemy.sosCharging) {
      const sosPulse = (elapsed * 1.4) % 1;
      ctx.save();
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.75 * (1 - sosPulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, enemyGroundY - 2, size * (0.28 + sosPulse * 0.25), 9 + sosPulse * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Overtime Desperation Enrage Aura (+ATK)
    if (!isDead && (enemy.enrageAtkBonus ?? 0) > 0) {
      const enragePulse = 0.6 + 0.4 * Math.sin(elapsed * 7 + idx);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 46, 126, ${0.42 + 0.28 * enragePulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, enemyGroundY - 2, size * 0.38, 10.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (cCanvas) {
        const cf = crawlerSample.frame;
        const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
        ctx.save();
        ctx.translate(ex, enemyGroundY + (ea?.dead ? 0 : stagger.dy * 0.45));
        if (!ea?.dead) {
          ctx.rotate(stagger.rot * 0.35);
        }
        ctx.scale(breathScaleX, breathScaleY);
        ctx.drawImage(
          cCanvas,
          -cf.anchorX * drawScale,
          -cf.bottomY * drawScale,
          cf.w * drawScale,
          cf.h * drawScale,
        );

        if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04)) {
          ctx.globalCompositeOperation = 'lighter';
          if (ea && ea.flashTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
            ctx.beginPath();
            ctx.arc(0, -size * 0.42, size * 0.34, 0, Math.PI * 2);
            ctx.fill();
          }
          if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
            ctx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
            ctx.beginPath();
            ctx.ellipse(3, -size * 0.42, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    } else if (entry) {
      ctx.save();
      ctx.translate(ex, enemyGroundY + koOffsetY + stagger.dy);
      ctx.rotate(stagger.rot);
      ctx.scale(enemy.archetype === 'brute' ? -breathScaleX : breathScaleX, breathScaleY);
      ctx.drawImage(entry.canvas, -size * centerXRatio, -size * bottomRatio, size, size);

      // Upper-torso stagger slice displacement & biology-matched bio-wound flash on hit
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
          ctx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
          ctx.beginPath();
          ctx.ellipse(4, -size * 0.46, size * 0.28, size * 0.36, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    const isHighlighted = !isDead && (hoveredEnemyId === enemy.id || inspectedEnemyId === enemy.id);
    if (isHighlighted) {
      const isInspected = inspectedEnemyId === enemy.id;
      const bracketW = Math.max(48, size * (isCrawler ? 0.78 : 0.74));
      const bracketH = Math.max(48, size * Math.min(0.95, bottomRatio));
      const bx0 = Math.max(4, ex - bracketW * 0.5);
      const bx1 = Math.min(w - 4, ex + bracketW * 0.5);
      const by0 = Math.max(12, enemyGroundY - bracketH - 2);
      const by1 = Math.min(h - 6, enemyGroundY + 3);
      const arm = Math.min(13, bracketW * 0.22);

      ctx.save();
      ctx.strokeStyle = isInspected
        ? 'rgba(0, 240, 255, 0.92)'
        : 'rgba(165, 243, 252, 0.72)';
      ctx.lineWidth = isInspected ? 2 : 1.5;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(bx0, by0 + arm);
      ctx.lineTo(bx0, by0);
      ctx.lineTo(bx0 + arm, by0);
      // Top-right
      ctx.moveTo(bx1 - arm, by0);
      ctx.lineTo(bx1, by0);
      ctx.lineTo(bx1, by0 + arm);
      // Bottom-left
      ctx.moveTo(bx0, by1 - arm);
      ctx.lineTo(bx0, by1);
      ctx.lineTo(bx0 + arm, by1);
      // Bottom-right
      ctx.moveTo(bx1 - arm, by1);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(bx1, by1 - arm);
      ctx.stroke();

      // Subtle ground selection ellipse
      ctx.strokeStyle = isInspected
        ? 'rgba(0, 240, 255, 0.65)'
        : 'rgba(165, 243, 252, 0.4)';
      ctx.lineWidth = isInspected ? 2 : 1.25;
      ctx.beginPath();
      ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.3, size * 0.38, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // On-stage Enemy Lifebar + Prominent Armor Plate Bar + Damage/Death Preview directly under enemy feet
    if (!isDead) {
      const armorPreview = computeEnemyArmorPreview(
        enemy,
        idx,
        frontLivingIdx,
        activePreview,
        enemies,
      );
      const {
        rawPreviewDmg,
        willCrackShieldPip,
        willBreakArmor,
        armorAbsorbed,
        remainingArmor,
        previewHpLoss,
        projectedHp,
        willTriggerPhaseGate,
        willDie,
        chainedBurstDmg,
      } = armorPreview;
      const hasArmor = enemy.armor > 0;
      const hasPips = (enemy.shieldPips ?? 0) > 0;

      // Volatile Spore Mite Death Rupture Preview Arc to surviving allies
      if (willDie && enemy.passive === 'volatile_burst' && enemies.length > 1) {
        const burstPulse = 0.55 + 0.45 * Math.sin(elapsed * 9);
        ctx.save();
        ctx.strokeStyle = `rgba(163, 230, 53, ${0.55 + 0.35 * burstPulse})`;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ex, enemyGroundY - 2, size * 0.52, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const barW =
        w < 460
          ? enemy.archetype === 'boss'
            ? 70
            : 56
          : h < 220
            ? enemy.archetype === 'boss'
              ? 82
              : 66
            : enemy.archetype === 'boss'
              ? 96
              : 76;
      const barH = rawPreviewDmg > 0 ? 7 : 5;
      const barX = Math.max(hasArmor ? 18 : 4, Math.min(w - barW - 4, Math.round(ex - barW * 0.5)));
      const minTopOffset = hasArmor ? 14 : 6;
      const barY = Math.max(
        minTopOffset,
        Math.min(h - (rawPreviewDmg > 0 ? 19 : 9), Math.round(enemyGroundY + 7)),
      );
      const curRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      const projRatio = Math.max(0, Math.min(1, projectedHp / enemy.maxHp));
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 10);

      // Dedicated Gold Armor Plate Bar flush above HP bar when armored
      if (hasArmor) {
        const armorBarH = 4;
        const armorBarY = barY - armorBarH - 2;
        const armorFullRatio = Math.max(0.22, Math.min(1, enemy.armor / Math.max(enemy.armor, 10)));
        const armorRemRatio = willBreakArmor
          ? 0
          : armorFullRatio * (remainingArmor / Math.max(1, enemy.armor));

        ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
        ctx.fillRect(barX - 1, armorBarY - 1, barW + 2, armorBarH + 2);

        if (armorRemRatio > 0) {
          ctx.fillStyle = '#FFC700';
          ctx.fillRect(barX, armorBarY, barW * armorRemRatio, armorBarH);
        }

        if (rawPreviewDmg > 0 && armorFullRatio > armorRemRatio) {
          ctx.fillStyle = willBreakArmor
            ? `rgba(255, 46, 126, ${0.75 + 0.25 * pulse})`
            : `rgba(254, 240, 138, ${0.72 + 0.28 * pulse})`;
          ctx.fillRect(
            barX + barW * armorRemRatio,
            armorBarY,
            barW * (armorFullRatio - armorRemRatio),
            armorBarH,
          );
        }

        ctx.strokeStyle = willBreakArmor
          ? `rgba(255, 46, 126, ${0.8 + 0.2 * pulse})`
          : 'rgba(255, 199, 0, 0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 0.5, armorBarY - 0.5, barW + 1, armorBarH + 1);

        // Hexagonal/Shield Armor Crest Badge pinned to left of bars
        const crestX = barX - 9;
        const crestY = barY + 0.5;
        const crestR = 8.2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(crestX, crestY - crestR);
        ctx.lineTo(crestX + crestR * 0.88, crestY - crestR * 0.42);
        ctx.lineTo(crestX + crestR * 0.88, crestY + crestR * 0.32);
        ctx.lineTo(crestX, crestY + crestR);
        ctx.lineTo(crestX - crestR * 0.88, crestY + crestR * 0.32);
        ctx.lineTo(crestX - crestR * 0.88, crestY - crestR * 0.42);
        ctx.closePath();
        ctx.fillStyle = willBreakArmor ? '#3B0A22' : '#1B1406';
        ctx.fill();
        ctx.strokeStyle = willBreakArmor ? '#FF2E7E' : '#FFC700';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = willBreakArmor ? '#FF85B3' : armorAbsorbed > 0 ? '#FEF08A' : '#FFC700';
        const crestText = willBreakArmor
          ? '0'
          : String(armorAbsorbed > 0 ? remainingArmor : enemy.armor);
        ctx.fillText(crestText, crestX, crestY + 0.5);
        ctx.restore();
      }

      // Floating Cyan Aegis Shield Pip Diamond pinned to the right of the lifebar
      if (hasPips) {
        const pipX = Math.min(w - 7, barX + barW + 8);
        const pipY = barY + barH * 0.5;
        const pipR = 6.2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pipX, pipY - pipR);
        ctx.lineTo(pipX + pipR, pipY);
        ctx.lineTo(pipX, pipY + pipR);
        ctx.lineTo(pipX - pipR, pipY);
        ctx.closePath();
        ctx.fillStyle = willCrackShieldPip ? '#4C0519' : '#083344';
        ctx.fill();
        ctx.strokeStyle = willCrackShieldPip ? '#FF2E7E' : '#00F0FF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pipX, pipY, 2, 0, Math.PI * 2);
        ctx.fillStyle = willCrackShieldPip ? '#FDA4AF' : '#E0F2FE';
        ctx.fill();
        ctx.restore();
      }

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

      // Boss 50% Phase Gate Tick on on-stage lifebar
      if (enemy.phaseGatePct && !enemy.phaseGateTriggered) {
        const gateX = barX + barW * (enemy.phaseGatePct / 100);
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(gateX - 1, barY - 1, 2, barH + 2);
      }

      ctx.strokeStyle = willDie
        ? `rgba(255, 46, 126, ${0.75 + 0.25 * pulse})`
        : willCrackShieldPip
          ? `rgba(0, 240, 255, ${0.8 + 0.2 * pulse})`
          : rawPreviewDmg > 0
            ? 'rgba(255, 199, 0, 0.85)'
            : 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = willDie || willCrackShieldPip ? 1.5 : 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

      if (rawPreviewDmg > 0) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        let label = `-${previewHpLoss} HP`;
        let labelColor = '#FDA4AF';
        if (willCrackShieldPip) {
          label = 'PIP CRACK (0 HP)';
          labelColor = '#67E8F9';
        } else if (willDie) {
          label =
            enemy.passive === 'volatile_burst' && enemies.length > 1
              ? `KILL · +6 BURST`
              : `KILL (-${previewHpLoss})`;
          labelColor = enemy.passive === 'volatile_burst' ? '#BEF264' : '#FFC700';
        } else if (willTriggerPhaseGate) {
          label = `50% LOCK (-${previewHpLoss})`;
          labelColor = '#FDE047';
        } else if (chainedBurstDmg > 0) {
          label = `-${previewHpLoss} HP (💥BURST)`;
          labelColor = '#BEF264';
        } else if (willBreakArmor) {
          label = `BREAK · -${previewHpLoss}`;
          labelColor = '#FFC700';
        } else if (armorAbsorbed > 0 && previewHpLoss === 0) {
          label = `-${armorAbsorbed} ARM`;
          labelColor = '#FFC700';
        } else if (armorAbsorbed > 0) {
          label = `-${previewHpLoss} HP (-${armorAbsorbed} ARM)`;
          labelColor = '#FDA4AF';
        }
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, ex, barY + barH + 11);
        ctx.fillStyle = labelColor;
        ctx.fillText(label, ex, barY + barH + 11);
      }

      // Section 3: Prominent Skull Icon (☠) over any enemy that will die from the previewed move or knockback swap
      const livingOrderIdx = enemies.slice(0, idx + 1).filter((e) => e.hp > 0).length - 1;
      const swapKillsThisUnit =
        hoveringSwap &&
        (livingOrderIdx === 0 || livingOrderIdx === 1) &&
        enemy.armor + enemy.hp <= 2;

      if (willDie || swapKillsThisUnit) {
        const skullY = Math.max(24, enemyGroundY - size * 0.72 + Math.sin(elapsed * 7) * 3);
        ctx.save();
        ctx.fillStyle = 'rgba(24, 26, 32, 0.94)';
        ctx.strokeStyle = '#FF2E7E';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ex, skullY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '900 18px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#F4F4F6';
        ctx.fillText('☠', ex, skullY + 1);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // 4.15 Telegraph Enemy Intent Directly on the Board (Glowing red/amber trajectory vectors + big dark-outlined damage numbers)
  if (heroine.hp > 0) {
    const heroTargetX = heroX + 18 * baseScale;
    const heroTargetY = groundY - heroTargetHeight * 0.46;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.hp <= 0) continue;
      const intent = enemy.intentCycle[enemy.currentIntentIndex];
      if (!intent) continue;
      const isOffensive =
        intent.kind === 'attack' ||
        intent.kind === 'heavy' ||
        intent.kind === 'acid' ||
        intent.kind === 'charge' ||
        intent.kind === 'leech';
      if (!isOffensive) continue;

      const ex = enemyBaseX + idx * enemyStepX;
      const ey = groundY - (idx % 2 === 1 ? 6 : 0) - 68 * baseScale;
      const effectiveVal = intent.value + (enemy.enrageAtkBonus ?? 0);
      const isAcid = intent.kind === 'acid';
      const strokeRgb = isAcid ? '132, 204, 22' : '255, 46, 126';
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 4.5 + idx);
      const ctrlX = (ex + heroTargetX) * 0.5;
      const ctrlY = Math.min(ey, heroTargetY) - (26 + idx * 14);

      ctx.save();
      ctx.strokeStyle = `rgba(${strokeRgb}, ${tacticalViewActive ? 0.85 : 0.42 + 0.25 * pulse})`;
      ctx.lineWidth = tacticalViewActive ? 2.6 : 2.0;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(ex - 16, ey);
      ctx.quadraticCurveTo(ctrlX, ctrlY, heroTargetX, heroTargetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Directional arrowhead pointing at Heroine
      const angle = Math.atan2(heroTargetY - ctrlY, heroTargetX - ctrlX);
      ctx.fillStyle = isAcid ? '#84CC16' : '#FF2E7E';
      ctx.beginPath();
      ctx.moveTo(heroTargetX, heroTargetY);
      ctx.lineTo(
        heroTargetX - 10 * Math.cos(angle - Math.PI / 6),
        heroTargetY - 10 * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        heroTargetX - 10 * Math.cos(angle + Math.PI / 6),
        heroTargetY - 10 * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();

      // High-contrast dark pill badge at the apex of the intent trajectory vector
      const midX = 0.25 * (ex - 16) + 0.5 * ctrlX + 0.25 * heroTargetX;
      const midY = 0.25 * ey + 0.5 * ctrlY + 0.25 * heroTargetY;
      const badgeLabel = `${isAcid ? '☣' : '⚔'} ${effectiveVal}`;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      const tw = ctx.measureText(badgeLabel).width;
      const pw = tw + 12;
      const ph = 20;
      ctx.fillStyle = '#181A20';
      ctx.strokeStyle = isAcid ? '#84CC16' : '#FF2E7E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(midX - pw * 0.5, midY - ph * 0.5, pw, ph, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F4F4F6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, midX, midY + 0.5);
      ctx.restore();
    }
  }

  // 4.20 Hover Preview for Spatial Swap ("What-If" State: Swap arcs show landing slots)
  if (hoveringSwap) {
    const livingIndices: number[] = [];
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].hp > 0) livingIndices.push(i);
    }
    if (livingIndices.length >= 2) {
      const idxA = livingIndices[0];
      const idxB = livingIndices[1];
      const xA = enemyBaseX + idxA * enemyStepX;
      const xB = enemyBaseX + idxB * enemyStepX;
      const yArc = groundY - 112 * baseScale;
      const midSwapX = (xA + xB) * 0.5;

      ctx.save();
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xA, yArc);
      ctx.quadraticCurveTo(midSwapX, yArc - 34, xB, yArc);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left & Right Knockback Landing Arrowheads
      ctx.fillStyle = '#FFC700';
      ctx.beginPath();
      ctx.moveTo(xB, yArc);
      ctx.lineTo(xB - 10, yArc - 7);
      ctx.lineTo(xB - 4, yArc - 12);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xA, yArc);
      ctx.lineTo(xA + 10, yArc - 7);
      ctx.lineTo(xA + 4, yArc - 12);
      ctx.closePath();
      ctx.fill();

      // Big High-Contrast Swap Pill ("⇄ SWAP · 0 AP")
      const swapTag = '⇄ SWAP · 0 AP';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      const sw = ctx.measureText(swapTag).width + 14;
      const sh = 22;
      ctx.fillStyle = '#181A20';
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(midSwapX - sw * 0.5, yArc - 34 - sh * 0.5, sw, sh, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F4F4F6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(swapTag, midSwapX, yArc - 34 + 0.5);
      ctx.restore();
    }
  }

  // 4.25 Telegraphed Orbital Drop-Pod Holograms (Information Horizon scales by Difficulty Tier)
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
      const warnY = 26 + dIdx * 18;
      ctx.save();
      ctx.font = '800 10px "JetBrains Mono", monospace';
      const label = `⚠ ORBITAL DROP · T-${drop.turnsUntilDrop}`;
      const lw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(7, 14, 34, 0.88)';
      ctx.strokeStyle = `rgba(${beamColor}, 0.9)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(warnX - lw * 0.5, warnY - 9, lw, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, warnX, warnY);
      ctx.restore();
      continue;
    }

    const dx = enemyBaseX + drop.slotIndex * enemyStepX;
    const dy = groundY - (drop.slotIndex % 2 === 1 ? 6 : 0);
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 5.2 + dIdx * 1.4);

    ctx.save();
    // Vertical orbital drop beam
    const beamGrad = ctx.createLinearGradient(dx, Math.max(24, dy - 160), dx, dy);
    beamGrad.addColorStop(0, `rgba(${beamColor}, 0)`);
    beamGrad.addColorStop(0.55, `rgba(${beamColor}, ${0.12 + 0.1 * pulse})`);
    beamGrad.addColorStop(1, `rgba(${beamColor}, ${0.28 + 0.14 * pulse})`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(dx - 18, Math.max(18, dy - 155), 36, Math.min(155, dy - 18));

    // Ground landing zone ring
    ctx.strokeStyle = `rgba(${beamColor}, ${0.65 + 0.3 * pulse})`;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(dx, dy - 1, 28 + pulse * 4, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Holographic chevron diamond hovering in landing column
    const bobY = dy - 56 + Math.sin(elapsed * 4 + dIdx) * 4;
    ctx.fillStyle = 'rgba(7, 14, 34, 0.85)';
    ctx.strokeStyle = `rgba(${beamColor}, 0.92)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(dx, bobY - 16);
    ctx.lineTo(dx + 16, bobY);
    ctx.lineTo(dx, bobY + 16);
    ctx.lineTo(dx - 16, bobY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = drop.isZeroReward ? '#FDA4AF' : '#FEF08A';
    ctx.fillText(`T-${drop.turnsUntilDrop}`, dx, bobY + 0.5);

    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.lineWidth = 3;
    const archTag = dropIntelHorizon.revealArchetype ? drop.archetype.toUpperCase() : '???';
    ctx.strokeText(archTag, dx, dy + 14);
    ctx.fillStyle = drop.isZeroReward ? '#FDA4AF' : '#FDBA74';
    ctx.fillText(archTag, dx, dy + 14);
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

    // Outer biology-matched droplet/jet
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, d.size * stretch, d.size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wet specular core highlight matched to alien biochemistry
    ctx.fillStyle = d.highlightColor;
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

  // 8. Zero-GC Pooled Particles (suppressed in Tactical View when idle)
  if (!tacticalViewActive || sim.slashArcTimer > 0 || sim.kickWaveTimer > 0 || sim.overdriveTimer > 0) {
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
  }

  // 8.5 Tactical View Rule 3: Bold High-Contrast Numbers & Geometric Symbols Directly Over Units
  if (tacticalViewActive) {
    ctx.save();
    // Heroine Overhead Tactical Badge
    if (heroine.hp > 0 && !isProne) {
      const hPlaqueW = 104;
      const hPlaqueH = 26;
      const hpx = Math.max(8, Math.round(heroX - hPlaqueW * 0.5));
      const hpy = Math.max(38, Math.round(groundY - heroTargetHeight - 16));
      ctx.fillStyle = '#020617';
      ctx.fillRect(hpx - 2, hpy - 2, hPlaqueW + 4, hPlaqueH + 4);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(hpx, hpy, hPlaqueW, hPlaqueH);
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      const shText = heroine.shield > 0 ? ` ●${heroine.shield}` : '';
      ctx.fillText(`★ ${heroine.hp}/${heroine.maxHp}${shText}`, hpx + hPlaqueW * 0.5, hpy + hPlaqueH * 0.5);
    }

    // Enemies Overhead Tactical Badges with Double-Coded Geometric Pips & Intent Numbers
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.hp <= 0) continue;
      const ex = enemyBaseX + idx * enemyStepX;
      const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const ePlaqueW = 114;
      const ePlaqueH = 38;
      const epx = Math.max(8, Math.min(w - ePlaqueW - 8, Math.round(ex - ePlaqueW * 0.5)));
      const epy = Math.max(42, Math.round(enemyGroundY - baseEnemySize * 0.94));

      const intent = enemy.intentCycle[enemy.currentIntentIndex];
      const pipSymbol =
        enemy.archetype === 'larva'
          ? '▲'
          : enemy.archetype === 'skitter'
            ? '●'
            : enemy.archetype === 'stinger'
              ? '★'
              : enemy.archetype === 'stalker'
                ? '◆'
                : enemy.archetype === 'spitter'
                  ? '⬡'
                  : enemy.archetype === 'brute'
                    ? '■'
                    : '◉';

      ctx.fillStyle = '#020617';
      ctx.fillRect(epx - 2, epy - 2, ePlaqueW + 4, ePlaqueH + 4);
      ctx.strokeStyle = idx === frontLivingIdx ? '#FFC700' : '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(epx, epy, ePlaqueW, ePlaqueH);

      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      const armTxt = enemy.armor > 0 ? ` ■${enemy.armor}` : '';
      const pipTxt = enemy.shieldPips > 0 ? ` ◆${enemy.shieldPips}` : '';
      ctx.fillText(
        `${pipSymbol} ${enemy.hp}HP${armTxt}${pipTxt}`,
        epx + ePlaqueW * 0.5,
        epy + 11,
      );

      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle =
        intent.kind === 'attack' || intent.kind === 'heavy'
          ? '#FDA4AF'
          : intent.kind === 'acid'
            ? '#BEF264'
            : '#FDE047';
      const intentVal = intent.value + (enemy.enrageAtkBonus ?? 0);
      const intentTxt =
        intent.kind === 'charge'
          ? `★ CHG (${intent.secondaryValue ?? 1}T→${intentVal})`
          : intent.kind === 'armor' || intent.kind === 'bolster'
            ? `● +${intent.value} ARM`
            : `◆ ${intentVal} DMG`;
      ctx.fillText(intentTxt, epx + ePlaqueW * 0.5, epy + 26);
    }
    ctx.restore();
  }

  // 9. Floating Tabular Damage / Shield Numbers
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

  ctx.restore();

  // 10. Fourth-Wall Cyber-Visor Screen Blood Drops (screen-space outside camera shake/zoom; hidden in Tactical View)
  if (!tacticalViewActive) {
    renderScreenBloodDrops(ctx, sim, elapsed);
  }
}

function renderScreenBloodDrops(
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

    // 1. Sluggish glass runnel streak trailing behind the sliding bead
    if (sb.streakLen > 1.2) {
      ctx.globalAlpha = 0.42 * sb.alpha;
      ctx.fillStyle = colors.body;
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, 0);
      ctx.quadraticCurveTo(-r * 0.1, -sb.streakLen * 0.65, 0, -sb.streakLen);
      ctx.quadraticCurveTo(r * 0.1, -sb.streakLen * 0.65, r * 0.34, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Refractive dark meniscus rim on visor glass
    ctx.globalAlpha = 0.48 * sb.alpha;
    ctx.fillStyle = colors.rimShadow;
    ctx.beginPath();
    ctx.ellipse(0.8, 0.9, r + 0.9, ry + 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Main viscous bead + satellite impact droplet
    ctx.globalAlpha = 0.86 * sb.alpha;
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(sb.satelliteDx, sb.satelliteDy, sb.satelliteR, sb.satelliteR * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Biology-grounded interior shader detail on the glass
    if (profile.hasSuspendedVeins) {
      const pulse = 0.75 + 0.25 * Math.sin(elapsed * 2.8 + sb.seed);
      ctx.globalAlpha = 0.8 * weathering.emissiveIntensity * sb.alpha * pulse;
      ctx.strokeStyle = colors.veinPrimary;
      ctx.lineWidth = Math.max(0.8, r * 0.22);
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -ry * 0.2);
      ctx.quadraticCurveTo(0, ry * 0.32, r * 0.42, -ry * 0.15);
      ctx.stroke();
    } else if (profile.emissiveStrength > 0.35 && weathering.emissiveIntensity > 0.08) {
      const pulse = 0.78 + 0.22 * Math.sin(elapsed * 2.6 + sb.seed);
      ctx.globalAlpha = 0.45 * profile.emissiveStrength * weathering.emissiveIntensity * sb.alpha * pulse;
      ctx.fillStyle = colors.emissive;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.48, ry * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fresnel oil-slick rim iridescence for Sulfur/Cobalt & Apex Hive
    if (profile.iridescence > 0.4 && weathering.iridescenceIntensity > 0.1) {
      ctx.globalAlpha = 0.55 * profile.iridescence * weathering.iridescenceIntensity * sb.alpha;
      ctx.strokeStyle = colors.iridescenceA;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.88, ry * 0.88, 0, Math.PI * 0.7, Math.PI * 1.7);
      ctx.stroke();
    }

    // 5. Crisp wet visor specular catchlight
    if (weathering.glossiness > 0.2) {
      ctx.globalAlpha = 0.72 * weathering.glossiness * sb.alpha;
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.ellipse(-r * 0.28, -ry * 0.28, Math.max(0.8, r * 0.28), Math.max(0.6, ry * 0.22), -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}
