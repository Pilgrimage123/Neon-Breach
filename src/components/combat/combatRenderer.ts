import { previewHeroineThreat } from '../../engine/gameEngine';
import { getEffectiveEnemyIntentValue } from '../../engine/reinforcementDirector';
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
  BRUTE_CANONICAL_HEIGHT,
  BRUTE_SHEET_FRAMES,
  type BruteFrameSample,
  sampleBruteFrame,
} from '../../utils/bruteSpriteSheet';
import {
  type BruteJuiceSample,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
} from '../../utils/bruteJuiceController';
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
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
  type SpitterFrameSample,
  sampleSpitterFrame,
} from '../../utils/spitterSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceSample,
  createSpitterJuiceState,
  stepSpitterJuice,
} from '../../utils/spitterJuiceController';
import {
  STALKER_CANONICAL_HEIGHT,
  type StalkerFrameSample,
  sampleStalkerFrame,
} from '../../utils/stalkerSpriteSheet';
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
  FLOOR_FISSURE_POOL_SIZE,
  type FloorBloodPuddle,
  type FloorFissure,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  TEXT_POOL_SIZE,
  getStageLayoutMetrics,
} from './combatStageTypes';
import {
  addGroundFissure,
  spawnBruteKineticShards,
  spawnBruteMutagenMist,
  spawnBurst,
} from './combatVfx';
import { computeEnemyArmorPreview, computeEnemySlotLayout } from './combatEnemyUi';
import {
  computeBloodWeatheringState,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
  hexToRgba,
  sampleWeatheredBloodColors,
} from './mutantBlood';
import {
  renderCutInForegroundVfx,
  type SequencerFrameState,
} from './CombatActionSequencer';
import {
  type ActorJuiceSnapshot,
  NEUTRAL_ACTOR_JUICE_SNAPSHOT,
} from './SpriteJuiceFeedbackHandler';
import {
  type StageRenderOptions,
  createDefaultShaderUniforms,
  createIdentityControlPoints,
  deriveEnemyDeformAndUniforms,
  deriveHeroineDeformAndUniforms,
  hexToRgbNorm,
} from './stageSpriteAdapter';

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

function drawCanvas2DCutInFlash(
  ctx: CanvasRenderingContext2D,
  flashRgba: readonly [number, number, number, number] | undefined,
  radius: number,
  centerYOffset: number,
): void {
  if (!flashRgba || flashRgba[3] <= 0.02) return;
  const [fr, fg, fb, fa] = flashRgba;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(${Math.round(fr * 255)}, ${Math.round(fg * 255)}, ${Math.round(fb * 255)}, ${Math.min(0.85, fa * 0.72)})`;
  ctx.beginPath();
  ctx.arc(0, centerYOffset, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function computeAutoFocusTarget(params: {
  w: number;
  h: number;
  enemies: CombatState['enemies'];
  pendingDrops: NonNullable<CombatState['director']>['pendingReinforcements'];
  hoveredColor: TileType | null;
  inspectedEnemyId: string | null;
  autoFocusCamera: boolean;
  tacticalViewActive: boolean;
}): { zoom: number; panX: number; panY: number } {
  const {
    w,
    h,
    enemies,
    pendingDrops,
    hoveredColor,
    inspectedEnemyId,
    autoFocusCamera,
    tacticalViewActive,
  } = params;
  if (!autoFocusCamera || tacticalViewActive || w <= 0 || h <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }
  const { slotCenters, effectiveSlotCount } = computeEnemySlotLayout(enemies, pendingDrops);
  const heroBaseX = w < 460 ? w * 0.19 : w * 0.22;
  const { enemyBaseX, enemyStepX } = getStageLayoutMetrics(
    w,
    h,
    effectiveSlotCount,
    0,
    0,
    0,
    1,
    HEROINE_CANONICAL_HEIGHT,
  );
  const groundY = Math.round(h * 0.785);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const focusY = Math.max(h * 0.35, Math.min(h * 0.72, groundY - h * 0.22));

  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  const frontEnemyX =
    frontLivingIdx >= 0
      ? enemyBaseX + (slotCenters[frontLivingIdx] ?? frontLivingIdx) * enemyStepX
      : enemyBaseX;
  const inspectedIdx = inspectedEnemyId
    ? enemies.findIndex((e) => e.id === inspectedEnemyId && e.hp > 0)
    : -1;
  const inspectedEnemyX =
    inspectedIdx >= 0 ? enemyBaseX + (slotCenters[inspectedIdx] ?? inspectedIdx) * enemyStepX : null;

  if (inspectedEnemyX !== null) {
    return {
      zoom: 1.2,
      panX: (cx - inspectedEnemyX) * 0.38,
      panY: (cy - focusY) * 0.32,
    };
  }
  if (hoveredColor === 'attack') {
    const midX = heroBaseX * 0.32 + frontEnemyX * 0.68;
    return {
      zoom: 1.18,
      panX: (cx - midX) * 0.35,
      panY: (cy - focusY) * 0.28,
    };
  }
  if (hoveredColor === 'defense' || hoveredColor === 'tech') {
    return {
      zoom: 1.16,
      panX: (cx - (heroBaseX + 18)) * 0.34,
      panY: (cy - focusY) * 0.26,
    };
  }
  return { zoom: 1, panX: 0, panY: 0 };
}

function resolveHeroCutInFrameIndex(
  charId: CharacterId,
  cutIn: ActorJuiceSnapshot,
  seqPhase: SequencerFrameState['phase'] | undefined,
  fallbackIndex: number,
  heroMode?: string,
): number {
  if (charId === 'kira' && heroMode === 'dodge') return fallbackIndex;
  if (!cutIn.active || cutIn.poseOverride === 'none') return fallbackIndex;
  const isWindup = seqPhase === 'windup' || seqPhase === 'travel';
  if (charId === 'aurelia') {
    if (cutIn.poseOverride === 'attack_pose') return isWindup ? 13 : 14;
    if (cutIn.poseOverride === 'brace_pose') return 28;
    if (cutIn.poseOverride === 'recoil_pose') return 21;
    return fallbackIndex;
  }
  if (charId === 'zuri') {
    if (cutIn.poseOverride === 'attack_pose') return isWindup ? 19 : 20;
    if (cutIn.poseOverride === 'brace_pose') return 46;
    if (cutIn.poseOverride === 'recoil_pose') return 2;
    return fallbackIndex;
  }
  // Kira (hybrid melee dash-kick + ranged cyber-pistol)
  if (cutIn.poseOverride === 'attack_pose') {
    if (cutIn.isMeleeClash) return isWindup ? 16 : 18;
    return isWindup ? 9 : 10;
  }
  if (cutIn.poseOverride === 'brace_pose') return 22;
  if (cutIn.poseOverride === 'recoil_pose') return 24;
  return fallbackIndex;
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
  renderOptions?: StageRenderOptions,
): void {
  const { w, h } = sim.size;
  const dpr = sim.dpr;
  const webglRenderer =
    renderOptions?.rendererMode === 'webgl2' && renderOptions.webglRenderer?.isReady
      ? renderOptions.webglRenderer
      : null;
  const baseCtx = ctx;
  const useWebGL = Boolean(webglRenderer);
  const fgCtx = useWebGL && renderOptions?.fgCtx ? renderOptions.fgCtx : baseCtx;
  const debugMeshWireframe = Boolean(renderOptions?.debugMeshWireframe);
  const spitterJuiceConfig = renderOptions?.spitterJuiceConfig ?? DEFAULT_SPITTER_JUICE_CONFIG;
  const spitterLabActive = Boolean(renderOptions?.spitterLabActive);
  const bruteJuiceConfig = renderOptions?.bruteJuiceConfig ?? DEFAULT_BRUTE_JUICE_CONFIG;
  const bruteLabActive = Boolean(renderOptions?.bruteLabActive);
  const reducedMotion = Boolean(renderOptions?.reducedMotion);
  const seqFrame: SequencerFrameState | null =
    renderOptions?.sequencerFrame ?? sim.lastSeqFrame ?? null;
  const getActorJuice = (actorId: string): ActorJuiceSnapshot => {
    if (tacticalViewActive) return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
    if (renderOptions?.getActorJuice) return renderOptions.getActorJuice(actorId);
    return sim.actionSequencer.getActorJuice(actorId);
  };
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
  const { slotCenters, dropCenters, effectiveSlotCount } = computeEnemySlotLayout(
    enemies,
    pendingDrops,
  );
  const heroCutIn = getActorJuice('hero');
  const isKiraDodging = charId === 'kira' && heroSample.state.mode === 'dodge';
  const resolvedHeroFrameIndex = resolveHeroCutInFrameIndex(
    charId,
    heroCutIn,
    seqFrame?.phase,
    heroSample.frameIndex,
    heroSample.state.mode,
  );
  const resolvedHeroFrame = sheetFrames[resolvedHeroFrameIndex] ?? heroFrame;
  // Single Horizontal Transform Authority: never stack legacy dash xProgress on top of cut-in clashSlideX/knockbackX,
  // keep 100% ranged heroines (Aurelia/Zuri) planted in formation, and let Kira's dodge slide drive her own horizontal arc.
  const effectiveHeroXProgress = isKiraDodging
    ? heroSample.xProgress
    : heroCutIn.isMeleeClash || (heroCutIn.active && heroCutIn.role === 'target')
      ? 0
      : heroCutIn.active && charId === 'aurelia'
        ? Math.max(-0.06, Math.min(0.06, heroSample.xProgress))
        : heroSample.xProgress;

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
    effectiveHeroXProgress,
    heroSample.yHopPx,
    resolvedHeroFrame.rowScale,
    canonicalHeight,
  );
  const heroCutInDrawX = isKiraDodging
    ? heroX
    : heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0);

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!seqFrame) {
    const autoTarget = computeAutoFocusTarget({
      w,
      h,
      enemies,
      pendingDrops,
      hoveredColor,
      inspectedEnemyId,
      autoFocusCamera,
      tacticalViewActive,
    });
    const camLerp = tacticalViewActive ? 1 : 0.22;
    sim.cameraZoom = (sim.cameraZoom || 1) + (autoTarget.zoom - (sim.cameraZoom || 1)) * camLerp;
    sim.cameraPanX = (sim.cameraPanX || 0) + (autoTarget.panX - (sim.cameraPanX || 0)) * camLerp;
    sim.cameraPanY = (sim.cameraPanY || 0) + (autoTarget.panY - (sim.cameraPanY || 0)) * camLerp;
    sim.cameraRotRad = 0;
  }

  const camZoom = tacticalViewActive ? 1 : seqFrame?.cameraZoom ?? sim.cameraZoom ?? 1;
  const camPanX = tacticalViewActive ? 0 : seqFrame?.cameraPanX ?? sim.cameraPanX ?? 0;
  const camPanY = tacticalViewActive ? 0 : seqFrame?.cameraPanY ?? sim.cameraPanY ?? 0;
  const camRotRad =
    tacticalViewActive || reducedMotion
      ? 0
      : (seqFrame?.cameraRotRad ?? sim.cameraRotRad ?? 0) + (seqFrame?.shakeRotRad ?? 0);
  const worldUiAlpha = tacticalViewActive ? 1 : (seqFrame?.worldUiAlpha ?? 1);

  // Combine ActionCameraController Perlin shake with legacy trauma burst shake
  const legacyShakeMag = tacticalViewActive || reducedMotion ? 0 : sim.trauma * sim.trauma * 10;
  const legacyShakeX = legacyShakeMag > 0.1 ? (Math.random() * 2 - 1) * legacyShakeMag : 0;
  const legacyShakeY = legacyShakeMag > 0.1 ? (Math.random() * 2 - 1) * legacyShakeMag : 0;
  const totalShakeX =
    tacticalViewActive || reducedMotion ? 0 : (seqFrame?.shakeOffsetX ?? 0) + legacyShakeX;
  const totalShakeY =
    tacticalViewActive || reducedMotion ? 0 : (seqFrame?.shakeOffsetY ?? 0) + legacyShakeY;

  const hasCamTransform =
    Math.abs(camZoom - 1) > 0.004 ||
    Math.abs(camPanX) > 0.5 ||
    Math.abs(camPanY) > 0.5 ||
    Math.abs(camRotRad) > 0.0004 ||
    Math.abs(totalShakeX) > 0.05 ||
    Math.abs(totalShakeY) > 0.05;
  if (hasCamTransform) {
    ctx.translate(w * 0.5 + camPanX + totalShakeX, h * 0.5 + camPanY + totalShakeY);
    if (Math.abs(camRotRad) > 0.0004) {
      ctx.rotate(camRotRad);
    }
    if (Math.abs(camZoom - 1) > 0.004) {
      ctx.scale(camZoom, camZoom);
    }
    ctx.translate(-w * 0.5, -h * 0.5);
  }

  // If a separate foreground Canvas2D overlay is active (in hybrid WebGL2 mode), clear & sync its camera transform
  if (fgCtx !== ctx) {
    fgCtx.save();
    fgCtx.setTransform(1, 0, 0, 1, 0, 0);
    fgCtx.clearRect(0, 0, Math.ceil(w * dpr) + 2, Math.ceil(h * dpr) + 2);
    fgCtx.scale(dpr, dpr);
    fgCtx.imageSmoothingEnabled = true;
    fgCtx.imageSmoothingQuality = 'high';
    if (hasCamTransform) {
      fgCtx.translate(w * 0.5 + camPanX + totalShakeX, h * 0.5 + camPanY + totalShakeY);
      if (Math.abs(camRotRad) > 0.0004) {
        fgCtx.rotate(camRotRad);
      }
      if (Math.abs(camZoom - 1) > 0.004) {
        fgCtx.scale(camZoom, camZoom);
      }
      fgCtx.translate(-w * 0.5, -h * 0.5);
    }
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
    const parallaxX =
      tacticalViewActive || seqFrame?.active ? 0 : Math.sin(elapsed * 0.35) * 4;
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
  const frontLivingIdForDrones =
    frontLivingIdxForDrones >= 0 ? enemies[frontLivingIdxForDrones].id : null;
  const baseDroneTargetX =
    frontLivingIdxForDrones >= 0
      ? enemyBaseX + (slotCenters[frontLivingIdxForDrones] ?? frontLivingIdxForDrones) * enemyStepX
      : sim.pendingShotTargetX;
  const droneTargetX = frontLivingIdForDrones
    ? sim.actionSequencer.getLiveActorX(frontLivingIdForDrones, baseDroneTargetX)
    : baseDroneTargetX;
  const droneTargetMidY =
    groundY - (frontLivingIdxForDrones >= 0 && frontLivingIdxForDrones % 2 === 1 ? 6 : 0) - 88;
  const zuriDrones =
    charId === 'zuri'
      ? sampleZuriDroneFormation({
          animState: heroSample.state,
          heroineX: heroCutInDrawX,
          heroineDrawBottomY: heroY,
          groundY,
          targetX: droneTargetX,
          targetMidY: droneTargetMidY,
          scale: baseScale,
          totalTime: tacticalViewActive ? 0 : elapsed,
          hoveredColor,
        })
      : null;

  // Initialize WebGL2 frame pass now that deckBackY and deckFrontY are resolved
  if (webglRenderer) {
    const viewProjMatrix =
      seqFrame && legacyShakeMag <= 0.1 && !tacticalViewActive
        ? sim.actionSequencer.camera.buildWebGLViewProjMatrix(w, h)
        : undefined;
    webglRenderer.beginFrame({
      width: w,
      height: h,
      dpr,
      cameraZoom: camZoom,
      cameraPanX: camPanX,
      cameraPanY: camPanY,
      cameraRotRad: camRotRad,
      shakeOffsetX: totalShakeX,
      shakeOffsetY: totalShakeY,
      deckBackY,
      deckFrontY,
      viewProjMatrix,
    });
  }

  // 2. Batched Planar Glass Walkway Reflections (Single clip for Heroine + Enemies)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, deckBackY, w, Math.max(12, deckFrontY - deckBackY + 4));
  ctx.clip();

  const reflDimmerAlpha = tacticalViewActive ? 0 : seqFrame?.dimmerAlpha ?? 0;

  if (activeFrames && !isProne && !tacticalViewActive) {
    const rawCanvas = activeFrames[resolvedHeroFrameIndex];
    const frameCanvas = rawCanvas || activeFrames[charId === 'zuri' ? 8 : 0] || activeFrames[0];
    const refFrame = rawCanvas ? resolvedHeroFrame : defaultRefFrame;
    const refScale = (heroTargetHeight / canonicalHeight) * refFrame.rowScale;
    const heroReflDim =
      heroCutIn.role === 'bystander' && reflDimmerAlpha > 0.01
        ? Math.max(0.25, 1 - reflDimmerAlpha * 0.85)
        : 1;
    if (frameCanvas) {
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: 'refl:hero',
          primarySource: frameCanvas,
          worldX: heroCutInDrawX,
          worldY: groundY + 1,
          widthPx: refFrame.w * refScale * heroCutIn.scaleX,
          heightPx: refFrame.h * refScale,
          anchorOffsetXPx: refFrame.anchorX * refScale * heroCutIn.scaleX,
          anchorOffsetYPx: refFrame.bottomY * refScale,
          facingSign: 1,
          verticalScaleSign: -0.32 * heroSample.breathScaleY * heroCutIn.scaleY,
          rotationRad: 0,
          alpha: 0.13 * heroReflDim,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.13 * heroReflDim;
        ctx.translate(heroCutInDrawX, groundY + 1);
        ctx.scale(heroCutIn.scaleX, -0.32 * heroSample.breathScaleY * heroCutIn.scaleY);
        ctx.drawImage(
          frameCanvas,
          -refFrame.anchorX * refScale,
          -refFrame.bottomY * refScale,
          refFrame.w * refScale,
          refFrame.h * refScale,
        );
        ctx.restore();
      }
    }
  }

  const projectedShield = precomputedThreat?.shieldAfterPlayer ?? heroine.shield;
  const isAttackHoverNonSurge =
    hoveredColor === 'attack' && !(activePreview?.surgeTriggered ?? false);
  const stalkerSamples = new Map<string, StalkerFrameSample>();
  if (sim.stalkerFrames) {
    const dtStep = sim.lastFrameDt > 0 ? sim.lastFrameDt : 0.016;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'stalker') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const ambushPrimed =
        !isDead &&
        !enemy.staggered &&
        !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
        activeIntent?.condition === 'if_no_shield' &&
        projectedShield === 0;
      const retaliateHover =
        !isDead &&
        isAttackHoverNonSurge &&
        enemy.passive === 'spike_retaliate' &&
        idx === frontLivingIdxForDrones;
      const armoredGuard = !isDead && enemy.armor > 0;
      const prevTrans = sim.stalkerTransitions.get(enemy.id);
      const stalkerCutIn = getActorJuice(enemy.id);
      const sample = sampleStalkerFrame(
        ea
          ? {
              dead: ea.dead,
              koProgress: ea.koProgress,
              staggerTimer: ea.staggerTimer,
              staggerDuration: ea.staggerDuration,
              attackAnimTimer: ea.attackAnimTimer,
              attackAnimDuration: ea.attackAnimDuration,
              bristleTimer: ea.bristleTimer,
              bristleDuration: ea.bristleDuration,
              bristleKind: ea.bristleKind === 'retaliate' ? 'retaliate' : 'armor',
              ambushPrimed,
              armoredGuard,
              retaliateHover,
            }
          : undefined,
        tacticalViewActive ? 0 : elapsed,
        idx,
        prevTrans,
        tacticalViewActive ? 0 : dtStep,
        stalkerCutIn.poseOverride,
      );
      sim.stalkerTransitions.set(enemy.id, sample.transitionState);
      stalkerSamples.set(enemy.id, sample);
    }
  }

  const spitterSamples = new Map<string, SpitterFrameSample>();
  const spitterJuiceSamples = new Map<string, SpitterJuiceSample>();
  if (sim.spitterFrames) {
    const dtStep = sim.lastFrameDt > 0 ? sim.lastFrameDt : 0.016;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'spitter') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const blightPrimed =
        !isDead &&
        !enemy.staggered &&
        !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
        activeIntent?.kind === 'acid';
      const hoverWillKill =
        activePreview && isAttackHoverNonSurge && idx === frontLivingIdxForDrones
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdxForDrones, activePreview, enemies)
              .willDie
          : false;
      const pustuleHover =
        !isDead &&
        isAttackHoverNonSurge &&
        !hoverWillKill &&
        enemy.passive === 'acid_jam' &&
        idx === frontLivingIdxForDrones;
      const armoredGuard = !isDead && enemy.armor > 0;
      const prevTrans = sim.spitterTransitions.get(enemy.id);
      const sample = sampleSpitterFrame(
        ea
          ? {
              dead: ea.dead,
              koProgress: ea.koProgress,
              staggerTimer: ea.staggerTimer,
              staggerDuration: ea.staggerDuration,
              attackAnimTimer: ea.attackAnimTimer,
              attackAnimDuration: ea.attackAnimDuration,
              spitterAttackKind: ea.spitterAttackKind,
              bristleTimer: ea.bristleTimer,
              bristleDuration: ea.bristleDuration,
              bristleKind: ea.bristleKind,
              blightPrimed,
              armoredGuard,
              pustuleHover,
            }
          : undefined,
        tacticalViewActive ? 0 : elapsed,
        idx,
        prevTrans,
        tacticalViewActive ? 0 : dtStep,
      );

      // Step 4-Layer Procedural "Juice" & Spring Physics Controller for this Bile Spitter
      let juiceState = sim.spitterJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createSpitterJuiceState();
        sim.spitterJuiceStates.set(enemy.id, juiceState);
      }
      const juiceSample = stepSpitterJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        spitterJuiceConfig,
        {
          dead: ea?.dead,
          koProgress: ea?.koProgress,
          attackAnimTimer: ea?.attackAnimTimer,
          attackAnimDuration: ea?.attackAnimDuration,
          spitterAttackKind: ea?.spitterAttackKind,
          staggerTimer: ea?.staggerTimer,
          staggerDuration: ea?.staggerDuration,
          bristleTimer: ea?.bristleTimer,
          bristleDuration: ea?.bristleDuration,
          blightPrimed,
          armoredGuard,
          pustuleHover,
          staggeredStatus: Boolean(enemy.staggered),
          instanceIndex: idx,
        },
      );
      // Unify frame & glow authority from the 4-Layer Bile Spitter Juice Controller
      sample.frameIndex = juiceSample.frameIndex;
      sample.frame = SPITTER_SHEET_FRAMES[juiceSample.frameIndex] ?? sample.frame;
      sample.prevFrameIndex = juiceSample.prevFrameIndex;
      sample.prevFrame = SPITTER_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? sample.frame;
      sample.frameBlendAlpha = juiceSample.frameBlendAlpha;
      sample.pustuleGlowIntensity = juiceSample.pustuleGlowIntensity;
      sample.spitStreamProgress = Math.max(sample.spitStreamProgress, juiceSample.spitStreamProgress);

      // Cut-In Presentation Pose Override & Facing Lock (outside Spitter Juice Lab)
      const spitterCutIn = getActorJuice(enemy.id);
      if (!ea?.dead && !spitterLabActive && spitterCutIn.active) {
        juiceSample.facingScale = -1;
        if (spitterCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
          sample.xOffsetRatio = 0;
        }
        if (spitterCutIn.poseOverride !== 'none') {
          const overrideIdx =
            spitterCutIn.poseOverride === 'attack_pose'
              ? spitterCutIn.isMeleeClash
                ? 9
                : 6
              : spitterCutIn.poseOverride === 'brace_pose'
                ? 10
                : 12;
          sample.frameIndex = overrideIdx;
          sample.frame = SPITTER_SHEET_FRAMES[overrideIdx] ?? sample.frame;
          sample.frameBlendAlpha = 1;
        }
      }

      sim.spitterTransitions.set(enemy.id, sample.transitionState);
      spitterSamples.set(enemy.id, sample);
      spitterJuiceSamples.set(enemy.id, juiceSample);
    }
  }

  const bruteSamples = new Map<string, BruteFrameSample>();
  const bruteJuiceSamples = new Map<string, BruteJuiceSample>();
  if (sim.bruteFrames) {
    const dtStep = sim.lastFrameDt > 0 ? sim.lastFrameDt : 0.016;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'brute') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const heavyPrimed =
        !isDead &&
        !enemy.staggered &&
        !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
        activeIntent?.kind === 'heavy';
      const hoverArmorPrev =
        !isDead &&
        activePreview &&
        activePreview.color === 'attack' &&
        idx === frontLivingIdxForDrones
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdxForDrones, activePreview, enemies)
          : null;
      const staggerHover = Boolean(hoverArmorPrev?.willStagger);
      const armoredGuard = !isDead && enemy.armor > 0;
      const prevTrans = sim.bruteTransitions.get(enemy.id);
      const sample = sampleBruteFrame(
        ea
          ? {
              dead: ea.dead,
              koProgress: ea.koProgress,
              staggerTimer: ea.staggerTimer,
              staggerDuration: ea.staggerDuration,
              attackAnimTimer: ea.attackAnimTimer,
              attackAnimDuration: ea.attackAnimDuration,
              bruteAttackKind: ea.bruteAttackKind,
              bristleTimer: ea.bristleTimer,
              bristleDuration: ea.bristleDuration,
              bristleKind: ea.bristleKind,
              heavyPrimed,
              armoredGuard,
              staggered: Boolean(enemy.staggered),
              staggerHover,
            }
          : {
              dead: false,
              koProgress: 0,
              staggerTimer: 0,
              staggerDuration: 0.44,
              attackAnimTimer: 0,
              attackAnimDuration: 0.58,
              heavyPrimed,
              armoredGuard,
              staggered: Boolean(enemy.staggered),
              staggerHover,
            },
        tacticalViewActive ? 0 : elapsed,
        idx,
        prevTrans,
        tacticalViewActive ? 0 : dtStep,
      );

      let juiceState = sim.bruteJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createBruteJuiceState();
        sim.bruteJuiceStates.set(enemy.id, juiceState);
      }
      const juiceSample = stepBruteJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        bruteJuiceConfig,
        {
          dead: ea?.dead,
          koProgress: ea?.koProgress,
          attackAnimTimer: ea?.attackAnimTimer,
          attackAnimDuration: ea?.attackAnimDuration,
          bruteAttackKind: ea?.bruteAttackKind,
          staggerTimer: ea?.staggerTimer,
          staggerDuration: ea?.staggerDuration,
          bristleTimer: ea?.bristleTimer,
          bristleDuration: ea?.bristleDuration,
          heavyPrimed,
          armoredGuard,
          staggerHover,
          staggeredStatus: Boolean(enemy.staggered),
          weaponBroken: Boolean(enemy.weaponBroken),
          instanceIndex: idx,
        },
      );
      sample.frameIndex = juiceSample.frameIndex;
      sample.frame = BRUTE_SHEET_FRAMES[juiceSample.frameIndex] ?? sample.frame;
      sample.prevFrameIndex = juiceSample.prevFrameIndex;
      sample.prevFrame = BRUTE_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? sample.frame;
      sample.frameBlendAlpha = juiceSample.frameBlendAlpha;
      sample.vialGlowIntensity = juiceSample.vialGlowIntensity;
      sample.shellGlowIntensity = juiceSample.shellGlowIntensity;
      sample.shockwaveIntensity = Math.max(sample.shockwaveIntensity, juiceSample.shockwaveIntensity);

      // Cut-In Presentation Pose Override & Facing Lock (outside Brute Juice Lab)
      const bruteCutIn = getActorJuice(enemy.id);
      if (!ea?.dead && !bruteLabActive && bruteCutIn.active) {
        juiceSample.facingScale = -1;
        if (bruteCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
          sample.xOffsetRatio = 0;
        }
        if (bruteCutIn.poseOverride !== 'none') {
          const overrideIdx =
            bruteCutIn.poseOverride === 'attack_pose'
              ? ea?.bruteAttackKind === 'heavy' || heavyPrimed
                ? 10
                : 11
              : bruteCutIn.poseOverride === 'brace_pose'
                ? 7
                : 12;
          sample.frameIndex = overrideIdx;
          sample.frame = BRUTE_SHEET_FRAMES[overrideIdx] ?? sample.frame;
          sample.frameBlendAlpha = 1;
        }
      }

      sim.bruteTransitions.set(enemy.id, sample.transitionState);
      bruteSamples.set(enemy.id, sample);
      bruteJuiceSamples.set(enemy.id, juiceSample);
    }
  }

  for (let idx = 0; idx < enemies.length; idx++) {
    if (tacticalViewActive) break;
    const enemy = enemies[idx];
    const arch = enemy.archetype;
    const ea = sim.enemyAnims.get(enemy.id);
    const enemyCutIn = getActorJuice(enemy.id);
    const isDead = enemy.hp <= 0;
    const crawlerSample = isCrawlerArchetype(arch)
      ? sampleCrawlerFrame(arch, ea, elapsed, idx, enemyCutIn.poseOverride)
      : null;
    const stalkerSample = arch === 'stalker' ? stalkerSamples.get(enemy.id) : undefined;
    const spitterSample = arch === 'spitter' ? spitterSamples.get(enemy.id) : undefined;
    const bruteSample = arch === 'brute' ? bruteSamples.get(enemy.id) : undefined;
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : stalkerSample
              ? stalkerSample.alpha
              : spitterSample
                ? spitterSample.alpha
                : bruteSample
                  ? bruteSample.alpha
                  : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : 0.94;
    const size = baseEnemySize * archScale;
    const hasCustomSheetMotion =
      (arch === 'stalker' && Boolean(stalkerSample)) ||
      (arch === 'spitter' && Boolean(spitterSample)) ||
      (arch === 'brute' && Boolean(bruteSample));
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash || (enemyCutIn.active && enemyCutIn.role === 'target');
    const lunge =
      ea && !hasCustomSheetMotion && !suppressNativeShift
        ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09)
        : 0;
    const cutInShiftX = enemyCutIn.active ? enemyCutIn.clashSlideX + enemyCutIn.knockbackX : 0;
    const reflDimMul =
      enemyCutIn.role === 'bystander' && reflDimmerAlpha > 0.01
        ? Math.max(0.22, 1 - reflDimmerAlpha * 0.88)
        : 1;
    const ex =
      enemyBaseX +
      (slotCenters[idx] ?? idx) * enemyStepX +
      lunge +
      (hasCustomSheetMotion && ea?.dead ? 0 : suppressStaggerDx ? 0 : stagger.dx) +
      cutInShiftX;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      hasCustomSheetMotion && ea?.dead ? 1 : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasCustomSheetMotion && ea?.dead ? 1 : (1 - breathPhase * 0.009) * stagger.scaleXMul;

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (!cCanvas) continue;
      const cf = crawlerSample.frame;
      const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
      const sx = breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: cCanvas,
          worldX: ex,
          worldY: enemyGroundY + 1,
          widthPx: cf.w * drawScale * sx,
          heightPx: cf.h * drawScale,
          anchorOffsetXPx: cf.anchorX * drawScale * sx,
          anchorOffsetYPx: cf.bottomY * drawScale,
          facingSign: 1,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(ex, enemyGroundY + 1);
        ctx.scale(sx, -0.3 * sy);
        ctx.drawImage(
          cCanvas,
          -cf.anchorX * drawScale,
          -cf.bottomY * drawScale,
          cf.w * drawScale,
          cf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'stalker' && stalkerSample && sim.stalkerFrames) {
      const sCanvas = sim.stalkerFrames[stalkerSample.frameIndex] ?? sim.stalkerFrames[0];
      if (!sCanvas) continue;
      const sf = stalkerSample.frame;
      const drawScale = size / STALKER_CANONICAL_HEIGHT;
      const rx = ex + (suppressNativeShift ? 0 : stalkerSample.xOffsetRatio * size);
      const sx = breathScaleX * stalkerSample.breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * stalkerSample.breathScaleY * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: sCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: sf.w * drawScale * sx,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale * sx,
          anchorOffsetYPx: sf.bottomY * drawScale,
          facingSign: -1,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(-sx, -0.3 * sy);
        ctx.drawImage(
          sCanvas,
          -sf.anchorX * drawScale,
          -sf.bottomY * drawScale,
          sf.w * drawScale,
          sf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'spitter' && spitterSample && sim.spitterFrames) {
      const spitterJuice = spitterJuiceSamples.get(enemy.id);
      const spCanvas = sim.spitterFrames[spitterSample.frameIndex] ?? sim.spitterFrames[0];
      if (!spCanvas) continue;
      const sf = spitterSample.frame;
      const drawScale = size / SPITTER_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : spitterJuice
            ? spitterJuice.offsetX * drawScale
            : spitterSample.xOffsetRatio * size);
      const facing = spitterJuice ? spitterJuice.facingScale : -1;
      const sx =
        (spitterJuice
          ? stagger.scaleXMul * spitterJuice.springScaleX
          : breathScaleX * spitterSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (spitterJuice
          ? stagger.scaleYMul * spitterJuice.springScaleY
          : breathScaleY * spitterSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: spCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: sf.w * drawScale * sx,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale * sx,
          anchorOffsetYPx: sf.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          spCanvas,
          -sf.anchorX * drawScale,
          -sf.bottomY * drawScale,
          sf.w * drawScale,
          sf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    if (arch === 'brute' && bruteSample && sim.bruteFrames) {
      const bruteJuice = bruteJuiceSamples.get(enemy.id);
      const bCanvas = sim.bruteFrames[bruteSample.frameIndex] ?? sim.bruteFrames[0];
      if (!bCanvas) continue;
      const bf = bruteSample.frame;
      const drawScale = size / BRUTE_CANONICAL_HEIGHT;
      const rx =
        ex +
        (suppressNativeShift
          ? 0
          : bruteJuice
            ? bruteJuice.offsetX * drawScale
            : bruteSample.xOffsetRatio * size);
      const facing = bruteJuice ? bruteJuice.facingScale : -1;
      const sx =
        (bruteJuice
          ? stagger.scaleXMul * bruteJuice.springScaleX
          : breathScaleX * bruteSample.breathScaleX) * enemyCutIn.scaleX;
      const sy =
        (bruteJuice
          ? stagger.scaleYMul * bruteJuice.springScaleY
          : breathScaleY * bruteSample.breathScaleY) * enemyCutIn.scaleY;
      if (webglRenderer) {
        webglRenderer.drawSprite({
          id: `refl:enemy:${enemy.id}`,
          primarySource: bCanvas,
          worldX: rx,
          worldY: enemyGroundY + 1,
          widthPx: bf.w * drawScale * sx,
          heightPx: bf.h * drawScale,
          anchorOffsetXPx: bf.anchorX * drawScale * sx,
          anchorOffsetYPx: bf.bottomY * drawScale,
          facingSign: facing,
          verticalScaleSign: -0.3 * sy,
          rotationRad: 0,
          alpha: 0.12 * koAlpha * reflDimMul,
          isReflection: true,
          deform: createIdentityControlPoints(),
          uniforms: createDefaultShaderUniforms(),
        });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
        ctx.translate(rx, enemyGroundY + 1);
        ctx.scale(facing * sx, -0.3 * sy);
        ctx.drawImage(
          bCanvas,
          -bf.anchorX * drawScale,
          -bf.bottomY * drawScale,
          bf.w * drawScale,
          bf.h * drawScale,
        );
        ctx.restore();
      }
      continue;
    }

    const entry = sim.enemyCutouts.get(enemy.archetype);
    if (!entry) continue;

    if (webglRenderer) {
      const sx = breathScaleX * enemyCutIn.scaleX;
      const sy = breathScaleY * enemyCutIn.scaleY;
      webglRenderer.drawSprite({
        id: `refl:enemy:${enemy.id}`,
        primarySource: entry.canvas,
        worldX: ex,
        worldY: enemyGroundY + 1,
        widthPx: size * sx,
        heightPx: size,
        anchorOffsetXPx: size * entry.bounds.centerXRatio * sx,
        anchorOffsetYPx: size * entry.bounds.bottomRatio,
        facingSign: enemy.archetype === 'brute' ? -1 : 1,
        verticalScaleSign: -0.3 * sy,
        rotationRad: -stagger.rot * 0.45,
        alpha: 0.12 * koAlpha * reflDimMul,
        isReflection: true,
        deform: createIdentityControlPoints(),
        uniforms: createDefaultShaderUniforms(),
      });
    } else {
      ctx.save();
      ctx.globalAlpha = 0.12 * koAlpha * reflDimMul;
      ctx.translate(ex, enemyGroundY + 1);
      ctx.rotate(-stagger.rot * 0.45);
      ctx.scale(
        (enemy.archetype === 'brute' ? -breathScaleX : breathScaleX) * enemyCutIn.scaleX,
        -0.3 * breathScaleY * enemyCutIn.scaleY,
      );
      ctx.drawImage(
        entry.canvas,
        -size * entry.bounds.centerXRatio,
        -size * entry.bounds.bottomRatio,
        size,
        size,
      );
      ctx.restore();
    }
  }
  ctx.restore();

  // 2.5 Persistent Multi-Turn Weathered Floor Blood, Scorch Rings, Melee Arcs & Movement Trails
  ctx.save();
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active || fp.alpha <= 0.01) continue;
    renderFloorBloodDecal(ctx, fp, i, elapsed, tacticalViewActive);
  }

  // 2.52 Persistent Seismic Glass-Bridge Fissures (etched by Brute Seismic Crush, glowing orange/amber and cooling over turns)
  for (let i = 0; i < FLOOR_FISSURE_POOL_SIZE; i++) {
    const ff = sim.floorFissures[i];
    if (!ff.active || ff.alpha <= 0.01) continue;
    renderBruteGroundFissure(ctx, ff, i, elapsed, tacticalViewActive);
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

  // Darkest Dungeon Cut-In Spotlight Stage Dimmer Veil (drawn behind focal WebGL sprites and dimmed bystanders)
  const dimmerAlpha = tacticalViewActive ? 0 : seqFrame?.dimmerAlpha ?? 0;
  if (dimmerAlpha > 0.01) {
    baseCtx.save();
    baseCtx.fillStyle = `rgba(3, 7, 18, ${dimmerAlpha.toFixed(3)})`;
    baseCtx.fillRect(-160, -160, w + 320, h + 320);
    baseCtx.restore();
  }

  // 3. Heroine Contact Shadows, Preview Aura & Sprite (anchored to live heroCutInDrawX)
  const shadowRadiusX = isProne ? heroTargetHeight * 0.54 : heroTargetHeight * 0.32;
  ctx.fillStyle = 'rgba(3, 7, 18, 0.68)';
  ctx.beginPath();
  ctx.ellipse(heroCutInDrawX, groundY - 1, shadowRadiusX, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isProne && charId !== 'zuri' && heroSample.yHopPx >= -2) {
    ctx.fillStyle = 'rgba(2, 5, 14, 0.85)';
    ctx.beginPath();
    ctx.ellipse(
      heroCutInDrawX - 18 * heroDrawScale,
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
      heroCutInDrawX + 17 * heroDrawScale,
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
    ctx.ellipse(heroCutInDrawX, groundY - 1, shadowRadiusX * 0.92, 6.5, 0, 0, Math.PI * 2);
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
      heroCutInDrawX,
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
        const targetX = enemyBaseX + (slotCenters[frontIdx] ?? frontIdx) * enemyStepX;
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

  // Sprint, dodge & back-dash cyan afterimages
  if (activeFrames && sim.ghosts.length > 0) {
    for (let i = 0; i < sim.ghosts.length; i++) {
      const g = sim.ghosts[i];
      const gf = sheetFrames[g.frameIndex] ?? defaultRefFrame;
      const gCanvas = activeFrames[g.frameIndex];
      if (!gCanvas) continue;
      const isDodgeGhost = Boolean(g.isDodge) || isKiraDodging || gf.sheet === 'dodge';
      const ghostAlpha = Math.min(0.85, g.alpha * (isDodgeGhost ? 0.82 : 0.45));
      if (webglRenderer) {
        const ghostUniforms = createDefaultShaderUniforms();
        ghostUniforms.tintRgba = isDodgeGhost ? [0.10, 0.96, 1.0, 1.0] : [0.65, 0.95, 1.0, 1.0];
        if (isDodgeGhost) {
          ghostUniforms.flashRgba = [0.0, 0.96, 1.0, 0.54];
        }
        ghostUniforms.uvDistortAmp = isDodgeGhost ? [0.005, 0.002] : [0.004, 0.002];
        ghostUniforms.uvDistortFreq = 18;
        ghostUniforms.uvDistortPhase = elapsed * 10 + i;
        webglRenderer.drawSprite({
          id: `ghost:${i}`,
          primarySource: gCanvas,
          worldX: g.x,
          worldY: g.y,
          widthPx: gf.w * g.drawScale,
          heightPx: gf.h * g.drawScale,
          anchorOffsetXPx: gf.anchorX * g.drawScale,
          anchorOffsetYPx: gf.bottomY * g.drawScale,
          facingSign: 1,
          rotationRad: 0,
          alpha: ghostAlpha,
          drawPriority: isDodgeGhost ? Math.max(1, heroCutIn.drawPriority) : undefined,
          deform: createIdentityControlPoints(),
          uniforms: ghostUniforms,
        });
      } else {
        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        if (isDodgeGhost) {
          ctx.filter = 'drop-shadow(0 0 8px #00F0FF) brightness(1.3) saturate(1.4)';
        }
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
  }

  // Main Heroine Sprite (with sub-frame pose cross-blending & C1 micro-kinematics + cut-in presentation)
  if (activeFrames) {
    const rawCanvas = activeFrames[resolvedHeroFrameIndex];
    const frameCanvas = rawCanvas || activeFrames[charId === 'zuri' ? 8 : 0] || activeFrames[0];
    const drawFrame = rawCanvas ? resolvedHeroFrame : defaultRefFrame;
    const drawScale = (heroTargetHeight / canonicalHeight) * drawFrame.rowScale;

    if (frameCanvas) {
      const blendA = heroSample.frameBlendAlpha;
      const canCrossBlend =
        (isKiraDodging || heroCutIn.poseOverride === 'none') &&
        !heroSample.isDashing &&
        blendA < 0.99 &&
        heroSample.prevFrameIndex !== resolvedHeroFrameIndex;
      const prevCanvas = canCrossBlend ? activeFrames[heroSample.prevFrameIndex] : null;
      const heroTotalTiltRad = isKiraDodging
        ? heroSample.tiltRad
        : heroSample.tiltRad + heroCutIn.leanRad;

      if (webglRenderer) {
        const { deform, uniforms } = deriveHeroineDeformAndUniforms({
          mode: heroSample.state.mode,
          breathScaleX: heroSample.breathScaleX,
          breathScaleY: heroSample.breathScaleY,
          tiltRad: heroSample.tiltRad,
          frameBlendAlpha: canCrossBlend ? blendA : 1,
          flashTimer: sim.heroAnim.flashTimer,
          corrode: heroine.corrode,
          hoveredColor,
          elapsed: tacticalViewActive ? 0 : elapsed,
          isProne,
          cutIn: heroCutIn,
        });
        webglRenderer.drawSprite({
          id: 'hero',
          primarySource: frameCanvas,
          secondarySource: prevCanvas,
          worldX: heroCutInDrawX,
          worldY: heroY,
          widthPx: drawFrame.w * drawScale,
          heightPx: drawFrame.h * drawScale,
          anchorOffsetXPx: drawFrame.anchorX * drawScale,
          anchorOffsetYPx: drawFrame.bottomY * drawScale,
          facingSign: 1,
          rotationRad: Math.abs(heroTotalTiltRad) > 0.0005 ? heroTotalTiltRad : 0,
          alpha: 1,
          drawPriority: heroCutIn.drawPriority,
          deform,
          uniforms,
        });
      } else {
        ctx.save();
        if (!isKiraDodging && heroCutIn.role === 'bystander' && dimmerAlpha > 0.01) {
          ctx.globalAlpha = Math.max(0.24, 1 - dimmerAlpha * 0.92);
        }
        ctx.translate(heroCutInDrawX, heroY);
        if (Math.abs(heroTotalTiltRad) > 0.0005) {
          ctx.rotate(heroTotalTiltRad);
        }
        const drawScaleX = isKiraDodging
          ? heroSample.breathScaleX
          : heroSample.breathScaleX * heroCutIn.scaleX;
        const drawScaleY = isKiraDodging
          ? heroSample.breathScaleY
          : heroSample.breathScaleY * heroCutIn.scaleY;
        ctx.scale(drawScaleX, drawScaleY);

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

        if (!isKiraDodging) {
          if (heroCutIn.flashRgba) {
            drawCanvas2DCutInFlash(ctx, heroCutIn.flashRgba, heroTargetHeight * 0.36, -heroTargetHeight * 0.48);
          } else if (sim.heroAnim.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255, 160, 190, 0.38)';
            ctx.beginPath();
            ctx.arc(0, -heroTargetHeight * 0.48, heroTargetHeight * 0.34, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  // 3.5 Zuri's Afrofuturist Tri-Drone Formation (Shield Walker, Bio-Med Rotor, Solar Hawk Gunship)
  if (zuriDrones && sim.zuriDroneFrames && heroine.hp > 0) {
    const controllerX = heroCutInDrawX + (resolvedHeroFrame.muzzleRel?.dx ?? 118) * heroDrawScale;
    const controllerY = heroY + (resolvedHeroFrame.muzzleRel?.dy ?? -162) * heroDrawScale;
    const droneOrder = [zuriDrones.med, zuriDrones.shield, zuriDrones.strike] as const;
    const droneCanvasIndices = [1, 0, 2] as const;
    const droneBystanderMul =
      heroCutIn.role === 'bystander' && dimmerAlpha > 0.01
        ? Math.max(0.24, 1 - dimmerAlpha * 0.92)
        : 1;

    for (let dIdx = 0; dIdx < droneOrder.length; dIdx++) {
      const pose = droneOrder[dIdx];
      const dCanvas = sim.zuriDroneFrames[droneCanvasIndices[dIdx]];
      if (!dCanvas) continue;
      const spec = pose.frameDef;
      const dScale = (spec.baseHeightPx / spec.h) * baseScale * pose.scaleMult;

      // Subtle holographic command data-link line when Zuri is actively commanding this drone
      if (pose.activeGlow > 0.5) {
        fgCtx.save();
        fgCtx.strokeStyle =
          pose.id === 'strike'
            ? `rgba(255, 46, 126, ${0.32 * pose.activeGlow})`
            : pose.id === 'shield'
              ? `rgba(0, 240, 255, ${0.32 * pose.activeGlow})`
              : `rgba(16, 185, 129, ${0.35 * pose.activeGlow})`;
        fgCtx.setLineDash([5, 4]);
        fgCtx.lineWidth = 1.4;
        fgCtx.beginPath();
        fgCtx.moveTo(controllerX, controllerY);
        fgCtx.lineTo(pose.x, pose.y);
        fgCtx.stroke();
        fgCtx.restore();
      }

      // Bio-Med Drone green nanite repair cone onto Zuri during TECH / Overdrive
      if (pose.id === 'med' && (heroSample.state.mode === 'upgrade' || heroSample.state.mode === 'overdrive')) {
        fgCtx.save();
        const medBeamGrad = fgCtx.createLinearGradient(pose.x, pose.y, heroCutInDrawX, heroY - heroTargetHeight * 0.45);
        medBeamGrad.addColorStop(0, 'rgba(16, 185, 129, 0.44)');
        medBeamGrad.addColorStop(1, 'rgba(16, 185, 129, 0.03)');
        fgCtx.fillStyle = medBeamGrad;
        fgCtx.beginPath();
        fgCtx.moveTo(pose.x - 10 * baseScale, pose.y + 10 * baseScale);
        fgCtx.lineTo(pose.x + 10 * baseScale, pose.y + 10 * baseScale);
        fgCtx.lineTo(heroCutInDrawX + 26 * baseScale, heroY - heroTargetHeight * 0.25);
        fgCtx.lineTo(heroCutInDrawX - 26 * baseScale, heroY - heroTargetHeight * 0.25);
        fgCtx.closePath();
        fgCtx.fill();
        fgCtx.restore();
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

      if (webglRenderer) {
        const droneUniforms = createDefaultShaderUniforms();
        if (heroCutIn.role === 'bystander' && dimmerAlpha > 0.01) {
          const dm = Math.max(0.28, 1 - dimmerAlpha * 0.85);
          droneUniforms.tintRgba = [dm, dm, dm * 1.05, 1];
        }
        if (pose.activeGlow > 0.65) {
          droneUniforms.flashRgba =
            pose.id === 'strike'
              ? [1.0, 0.35, 0.6, 0.22]
              : pose.id === 'shield'
                ? [0.2, 0.95, 1.0, 0.22]
                : [0.2, 0.95, 0.65, 0.22];
        }
        webglRenderer.drawSprite({
          id: `drone:${pose.id}`,
          primarySource: dCanvas,
          worldX: pose.x,
          worldY: pose.y,
          widthPx: spec.w * dScale,
          heightPx: spec.h * dScale,
          anchorOffsetXPx: spec.anchorX * dScale,
          anchorOffsetYPx: spec.anchorY * dScale,
          facingSign: 1,
          rotationRad: Math.abs(pose.tiltRad) > 0.001 ? pose.tiltRad : 0,
          alpha: 1,
          drawPriority: heroCutIn.drawPriority,
          deform: createIdentityControlPoints(),
          uniforms: droneUniforms,
        });
      } else {
        ctx.save();
        ctx.globalAlpha = droneBystanderMul;
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
  }

  // Active Cyan Hexagonal Shield Dome (suppressed during Kira's evasive dodge so no dome obscures her Vault/Slide/Land)
  if (
    (heroine.shield > 0 || sim.shieldDomeTimer > 0) &&
    heroine.hp > 0 &&
    !isKiraDodging &&
    !(zuriDrones && heroSample.state.mode === 'guard')
  ) {
    const rawPulse = sim.shieldDomeTimer > 0 ? 0.5 + 0.5 * (sim.shieldDomeTimer / 0.48) : 0.22;
    const pulse = zuriDrones ? rawPulse * 0.55 : rawPulse;
    const domeCenterX = zuriDrones ? zuriDrones.shield.x + 16 * baseScale : heroCutInDrawX + 8;
    fgCtx.save();
    fgCtx.translate(domeCenterX, groundY - heroTargetHeight * 0.48);
    fgCtx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
    fgCtx.lineWidth = sim.shieldDomeTimer > 0 ? 2.5 : 1.5;
    fgCtx.beginPath();
    const r = heroTargetHeight * (zuriDrones ? 0.42 : 0.46);
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 3) * k - Math.PI / 6;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) fgCtx.moveTo(px, py);
      else fgCtx.lineTo(px, py);
    }
    fgCtx.closePath();
    fgCtx.fillStyle = `rgba(0, 229, 255, ${pulse * (zuriDrones ? 0.07 : 0.14)})`;
    fgCtx.fill();
    fgCtx.stroke();
    fgCtx.restore();
  }

  // On-stage Kira Lifebar + Enemy-Inflicted Damage & Lethal Death Preview directly under Kira's feet
  ctx = fgCtx;
  if (heroine.hp > 0 && !isProne && !heroSample.isDashing && worldUiAlpha > 0.02) {
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
    ctx.globalAlpha *= worldUiAlpha;
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
      ctx.font = '700 12px "JetBrains Mono", monospace';
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
        ctx.strokeText(label, heroX, barY + barH + 12);
        ctx.fillStyle = labelColor;
        ctx.fillText(label, heroX, barY + barH + 12);
      }
    }
    ctx.restore();
  }
  ctx = baseCtx;

  // 4. Enemy Sprites, Stagger Recoil, Contact Shadows & Tactical Under-Foot Lifebar Preview
  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    const ea = sim.enemyAnims.get(enemy.id);
    const enemyCutIn = getActorJuice(enemy.id);
    const isDead = enemy.hp <= 0;
    const arch = enemy.archetype;
    const isCrawler = isCrawlerArchetype(arch);
    const isStalker = arch === 'stalker';
    const isSpitter = arch === 'spitter';
    const isBrute = arch === 'brute';
    const crawlerSample = isCrawler
      ? sampleCrawlerFrame(arch, ea, elapsed, idx, enemyCutIn.poseOverride)
      : null;
    const stalkerSample = isStalker ? stalkerSamples.get(enemy.id) : undefined;
    const spitterSample = isSpitter ? spitterSamples.get(enemy.id) : undefined;
    const bruteSample = isBrute ? bruteSamples.get(enemy.id) : undefined;
    // Keep enemy visible while attack animation is en route, then dissolve/collapse once impact sets ea.dead = true
    const koAlpha = isDead
      ? ea
        ? ea.dead
          ? crawlerSample
            ? crawlerSample.alpha
            : stalkerSample
              ? stalkerSample.alpha
              : spitterSample
                ? spitterSample.alpha
                : bruteSample
                  ? bruteSample.alpha
                  : Math.max(0, 1 - ea.koProgress)
          : 1
        : 0
      : 1;
    if (koAlpha <= 0.01) continue;

    const stagger = getEnemyStaggerKinematics(ea);
    const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.32
          : 0.94;
    const size = baseEnemySize * archScale;
    const hasSheetSample =
      (isCrawler && Boolean(crawlerSample)) ||
      (isStalker && Boolean(stalkerSample)) ||
      (isSpitter && Boolean(spitterSample)) ||
      (isBrute && Boolean(bruteSample));
    // Single Horizontal Transform Authority: suppress duplicate native lunge/stagger/offsetX during cut-in clashes
    const suppressNativeShift = enemyCutIn.isMeleeClash;
    const suppressStaggerDx =
      enemyCutIn.isMeleeClash || (enemyCutIn.active && enemyCutIn.role === 'target');
    const lunge =
      ea &&
      !suppressNativeShift &&
      !(isStalker && stalkerSample) &&
      !(isSpitter && spitterSample) &&
      !(isBrute && bruteSample)
        ? Math.sin(ea.lunge * Math.PI) * (-w * 0.09)
        : 0;
    const cutInShiftX = enemyCutIn.active ? enemyCutIn.clashSlideX + enemyCutIn.knockbackX : 0;
    const canvasBystanderMul =
      !webglRenderer && enemyCutIn.role === 'bystander' && dimmerAlpha > 0.01
        ? Math.max(0.24, 1 - dimmerAlpha * 0.92)
        : 1;
    const ex =
      enemyBaseX +
      (slotCenters[idx] ?? idx) * enemyStepX +
      lunge +
      (hasSheetSample && ea?.dead ? 0 : suppressStaggerDx ? 0 : stagger.dx);
    const spitterJuiceForPos = isSpitter ? spitterJuiceSamples.get(enemy.id) : undefined;
    const bruteJuiceForPos = isBrute ? bruteJuiceSamples.get(enemy.id) : undefined;
    const spriteX =
      ex +
      cutInShiftX +
      (suppressNativeShift
        ? 0
        : stalkerSample
          ? stalkerSample.xOffsetRatio * size
          : spitterJuiceForPos
            ? spitterJuiceForPos.offsetX * (size / SPITTER_CANONICAL_HEIGHT)
            : spitterSample
              ? spitterSample.xOffsetRatio * size
              : bruteJuiceForPos
                ? bruteJuiceForPos.offsetX * (size / BRUTE_CANONICAL_HEIGHT)
                : bruteSample
                  ? bruteSample.xOffsetRatio * size
                  : 0);
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const breathPhase = Math.sin(elapsed * 2.4 + idx * 1.5);
    const breathScaleY =
      hasSheetSample && ea?.dead ? 1 : (1 + breathPhase * 0.018) * stagger.scaleYMul;
    const breathScaleX =
      hasSheetSample && ea?.dead ? 1 : (1 - breathPhase * 0.009) * stagger.scaleXMul;
    const koOffsetY = !hasSheetSample && isDead && ea?.dead ? (1 - koAlpha) * 24 : 0;

    const entry = sim.enemyCutouts.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;
    const centerXRatio = entry ? entry.bounds.centerXRatio : defaults.centerXRatio;
    const farFootOffsetPx = defaults.farFootOffsetRatio * size;

    ctx.save();
    ctx.globalAlpha = koAlpha;

    const shadowHalfW = isBrute ? size * 0.44 : size * 0.32;
    const ringHalfW = isBrute ? size * 0.46 : size * 0.34;
    const footSpread = isBrute ? 0.18 : 0.13;

    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    ctx.beginPath();
    ctx.ellipse(spriteX, enemyGroundY - farFootOffsetPx * 0.35, shadowHalfW, isBrute ? 9.5 : 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(2, 5, 14, 0.84)';
    ctx.beginPath();
    ctx.ellipse(spriteX - size * footSpread, enemyGroundY - farFootOffsetPx, size * (isBrute ? 0.16 : 0.13), 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(spriteX + size * (footSpread + 0.02), enemyGroundY - 1, size * (isBrute ? 0.17 : 0.14), 4.2, 0, 0, Math.PI * 2);
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
    if (worldUiAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
      ctx.strokeStyle = roleStroke;
      ctx.lineWidth = arch === 'boss' || arch === 'brute' ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.ellipse(spriteX, enemyGroundY - farFootOffsetPx * 0.3, ringHalfW, isBrute ? 10.5 : 8.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

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
    if (!isDead && activeIntent?.kind === 'charge' && worldUiAlpha > 0.02) {
      const chargePulse = 0.55 + 0.45 * Math.sin(elapsed * 8.5);
      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
      ctx.translate(spriteX, enemyGroundY - size * 0.48);
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
    if (!isDead && enemy.sosCharging && worldUiAlpha > 0.02) {
      const sosPulse = (elapsed * 1.4) % 1;
      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.75 * (1 - sosPulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(spriteX, enemyGroundY - 2, size * (0.28 + sosPulse * 0.25), 9 + sosPulse * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Overtime Desperation Enrage Aura (+ATK)
    if (!isDead && (enemy.enrageAtkBonus ?? 0) > 0 && worldUiAlpha > 0.02) {
      const enragePulse = 0.6 + 0.4 * Math.sin(elapsed * 7 + idx);
      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
      ctx.strokeStyle = `rgba(255, 46, 126, ${0.42 + 0.28 * enragePulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(spriteX, enemyGroundY - 2, size * 0.38, 10.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const bioEmissiveRgb = hexToRgbNorm(enemyBio.freshEmissive);
    const isPrimedOrCharging =
      !isDead &&
      !enemy.staggered &&
      (activeIntent?.kind === 'heavy' || activeIntent?.kind === 'charge');
    const isAcidOrPustuleActive =
      !isDead &&
      (activeIntent?.kind === 'acid' ||
        Boolean(spitterSample && spitterSample.pustuleGlowIntensity > 0.45));

    if (isCrawlerArchetype(arch) && crawlerSample) {
      const cFrames = sim.crawlerFrames.get(arch);
      const cCanvas = cFrames?.[crawlerSample.frameIndex] ?? cFrames?.[0];
      if (cCanvas) {
        const cf = crawlerSample.frame;
        const drawScale = size / CRAWLER_CANONICAL_HEIGHT;
        const crawlerX = ex + cutInShiftX;
        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX,
            breathScaleY,
            frameBlendAlpha: 1,
            bioEmissiveRgb,
            isPrimedOrCharging,
            isAcidOrPustuleActive,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            cutIn: enemyCutIn,
            facingSign: 1,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: cCanvas,
            worldX: crawlerX,
            worldY: enemyGroundY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: cf.w * drawScale,
            heightPx: cf.h * drawScale,
            anchorOffsetXPx: cf.anchorX * drawScale,
            anchorOffsetYPx: cf.bottomY * drawScale,
            facingSign: 1,
            rotationRad: !ea?.dead ? stagger.rot * 0.35 + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          ctx.save();
          ctx.globalAlpha = koAlpha * canvasBystanderMul;
          ctx.translate(crawlerX, enemyGroundY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            ctx.rotate(stagger.rot * 0.35 + enemyCutIn.leanRad);
          }
          ctx.scale(breathScaleX * enemyCutIn.scaleX, breathScaleY * enemyCutIn.scaleY);
          ctx.drawImage(
            cCanvas,
            -cf.anchorX * drawScale,
            -cf.bottomY * drawScale,
            cf.w * drawScale,
            cf.h * drawScale,
          );

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || enemyCutIn.flashRgba) {
            ctx.globalCompositeOperation = 'lighter';
            if (enemyCutIn.flashRgba) {
              drawCanvas2DCutInFlash(ctx, enemyCutIn.flashRgba, size * 0.36, -size * 0.42);
            } else if (ea && ea.flashTimer > 0) {
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
      }
    } else if (isStalker && stalkerSample && sim.stalkerFrames) {
      const sCanvas = sim.stalkerFrames[stalkerSample.frameIndex] ?? sim.stalkerFrames[0];
      if (sCanvas) {
        const sf = stalkerSample.frame;
        const drawScale = size / STALKER_CANONICAL_HEIGHT;
        const hopY = ea?.dead ? 0 : stalkerSample.yHopPx * drawScale;

        if (stalkerSample.spineGlowIntensity > 0.45 && !ea?.dead && !tacticalViewActive) {
          const glowAlpha = Math.min(0.75, (stalkerSample.spineGlowIntensity - 0.3) * 0.95);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spriteX - sf.quillOriginRel.dx * drawScale;
          const gy = enemyGroundY + hopY + sf.quillOriginRel.dy * drawScale;
          const rad = size * (stalkerSample.mode === 'bristle' || stalkerSample.frameIndex === 10 ? 0.56 : 0.44);
          const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
          grad.addColorStop(0, `rgba(255, 46, 126, ${glowAlpha})`);
          grad.addColorStop(0.5, `rgba(255, 46, 126, ${glowAlpha * 0.4})`);
          grad.addColorStop(1, 'rgba(255, 46, 126, 0)');
          fgCtx.fillStyle = grad;
          fgCtx.beginPath();
          fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
          fgCtx.fill();

          if (stalkerSample.mode === 'bristle' || (stalkerSample.mode === 'guard' && stalkerSample.frameIndex === 10)) {
            const rayLen = size * (stalkerSample.mode === 'bristle' ? 0.42 : 0.34);
            fgCtx.strokeStyle = `rgba(255, 92, 160, ${0.42 + 0.28 * glowAlpha})`;
            fgCtx.lineWidth = 1.8;
            const angles = [-0.95, -0.58, -0.24, 0.08];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              const rx0 = gx + Math.cos(ang) * (size * 0.08);
              const ry0 = gy + Math.sin(ang) * (size * 0.08);
              const rx1 = gx + Math.cos(ang) * rayLen;
              const ry1 = gy + Math.sin(ang) * rayLen;
              fgCtx.beginPath();
              fgCtx.moveTo(rx0, ry0);
              fgCtx.lineTo(rx1, ry1);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        const blendA = stalkerSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          stalkerSample.prevFrameIndex !== stalkerSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.stalkerFrames[stalkerSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: breathScaleX * stalkerSample.breathScaleX,
            breathScaleY: breathScaleY * stalkerSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging: isPrimedOrCharging || stalkerSample.spineGlowIntensity > 0.65,
            isAcidOrPustuleActive: false,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            cutIn: enemyCutIn,
            facingSign: -1,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: sCanvas,
            secondarySource: prevCanvas,
            worldX: spriteX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: sf.w * drawScale,
            heightPx: sf.h * drawScale,
            anchorOffsetXPx: sf.anchorX * drawScale,
            anchorOffsetYPx: sf.bottomY * drawScale,
            facingSign: -1,
            rotationRad: !ea?.dead ? stagger.rot * 0.32 + stalkerSample.tiltRad + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          ctx.save();
          ctx.globalAlpha = koAlpha * canvasBystanderMul;
          ctx.translate(spriteX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            ctx.rotate(stagger.rot * 0.32 + stalkerSample.tiltRad + enemyCutIn.leanRad);
          }
          ctx.scale(
            -breathScaleX * stalkerSample.breathScaleX * enemyCutIn.scaleX,
            breathScaleY * stalkerSample.breathScaleY * enemyCutIn.scaleY,
          );

          if (prevCanvas) {
            const pf = stalkerSample.prevFrame;
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.5);
            ctx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
          }

          ctx.drawImage(
            sCanvas,
            -sf.anchorX * drawScale,
            -sf.bottomY * drawScale,
            sf.w * drawScale,
            sf.h * drawScale,
          );
          ctx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
              -sf.w * drawScale * 0.55,
              -sf.bottomY * drawScale,
              sf.w * drawScale * 1.1,
              sf.h * drawScale * 0.48,
            );
            ctx.clip();
            ctx.translate(-stagger.shearPx, -2);
            ctx.drawImage(
              sCanvas,
              -sf.anchorX * drawScale,
              -sf.bottomY * drawScale,
              sf.w * drawScale,
              sf.h * drawScale,
            );
            ctx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || enemyCutIn.flashRgba) {
            ctx.globalCompositeOperation = 'lighter';
            if (enemyCutIn.flashRgba) {
              drawCanvas2DCutInFlash(ctx, enemyCutIn.flashRgba, size * 0.36, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              ctx.beginPath();
              ctx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              ctx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              ctx.beginPath();
              ctx.ellipse(2, -size * 0.44, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
    } else if (isSpitter && spitterSample && sim.spitterFrames) {
      const spitterJuice = spitterJuiceSamples.get(enemy.id);
      const spCanvas = sim.spitterFrames[spitterSample.frameIndex] ?? sim.spitterFrames[0];
      if (spCanvas) {
        const sf = spitterSample.frame;
        const pf = spitterSample.prevFrame;
        const drawScale = size / SPITTER_CANONICAL_HEIGHT;
        const juiceHopY = spitterJuice ? spitterJuice.hopYPx * drawScale : spitterSample.yHopPx * drawScale;
        const juiceRot = spitterJuice ? spitterJuice.rotationRad : spitterSample.tiltRad;
        const juiceFacing = spitterJuice ? spitterJuice.facingScale : -1;
        const spitterWorldX = spriteX;
        const hopY = ea?.dead ? 0 : juiceHopY;
        const windupProg = spitterJuice?.spitWindupProgress ?? 0;
        const streamProg = Math.max(
          spitterSample.spitStreamProgress,
          spitterJuice?.spitStreamProgress ?? 0,
        );

        // Persistent, non-flickering yellow-chartreuse slime puddle anchored under the Bile Spitter's feet
        renderSpitterGroundPuddle(
          baseCtx,
          ex + (spitterWorldX - ex) * 0.28,
          enemyGroundY + 1,
          size,
          koAlpha,
          spitterSample.pustuleGlowIntensity,
          Math.max(windupProg, streamProg),
          elapsed,
          idx,
        );

        if (spitterSample.pustuleGlowIntensity > 0.45 && !ea?.dead && !tacticalViewActive) {
          const glowAlpha = Math.min(0.74, (spitterSample.pustuleGlowIntensity - 0.3) * 0.92);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spitterWorldX + sf.pustuleOriginRel.dx * drawScale * (-juiceFacing);
          const gy = enemyGroundY + hopY + sf.pustuleOriginRel.dy * drawScale;
          const rad = size * (spitterSample.mode === 'rupture' || spitterSample.frameIndex === 10 ? 0.46 : 0.36);
          const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
          grad.addColorStop(0, `rgba(254, 240, 138, ${glowAlpha})`);
          grad.addColorStop(0.45, `rgba(163, 230, 53, ${glowAlpha * 0.52})`);
          grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
          fgCtx.fillStyle = grad;
          fgCtx.beginPath();
          fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
          fgCtx.fill();

          if (spitterSample.mode === 'rupture' || (spitterSample.mode === 'guard' && spitterSample.frameIndex === 10)) {
            const sprayLen = size * (spitterSample.mode === 'rupture' ? 0.36 : 0.28);
            fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.44 + 0.3 * glowAlpha})`;
            fgCtx.lineWidth = 1.8;
            const angles = [-2.55, -2.18, -1.78, -1.38];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              const rx0 = gx + Math.cos(ang) * (size * 0.06);
              const ry0 = gy + Math.sin(ang) * (size * 0.06);
              const rx1 = gx + Math.cos(ang) * sprayLen;
              const ry1 = gy + Math.sin(ang) * sprayLen;
              fgCtx.beginPath();
              fgCtx.moveTo(rx0, ry0);
              fgCtx.lineTo(rx1, ry1);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        const blendA = spitterSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          spitterSample.prevFrameIndex !== spitterSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.spitterFrames[spitterSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: spitterJuice ? stagger.scaleXMul : breathScaleX * spitterSample.breathScaleX,
            breathScaleY: spitterJuice ? stagger.scaleYMul : breathScaleY * spitterSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging,
            isAcidOrPustuleActive,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            spitterJuice,
            cutIn: enemyCutIn,
            facingSign: juiceFacing,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: spCanvas,
            secondarySource: prevCanvas,
            worldX: spitterWorldX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: sf.w * drawScale,
            heightPx: sf.h * drawScale,
            anchorOffsetXPx: sf.anchorX * drawScale,
            anchorOffsetYPx: sf.bottomY * drawScale,
            secondaryWidthPx: pf.w * drawScale,
            secondaryHeightPx: pf.h * drawScale,
            secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
            secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
            facingSign: juiceFacing,
            rotationRad: !ea?.dead ? stagger.rot * 0.32 + juiceRot + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          ctx.save();
          ctx.globalAlpha = koAlpha * canvasBystanderMul;
          ctx.translate(spitterWorldX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            ctx.rotate(stagger.rot * 0.32 + juiceRot + enemyCutIn.leanRad);
          }
          const scaleX = (spitterJuice
            ? stagger.scaleXMul * spitterJuice.springScaleX
            : breathScaleX * spitterSample.breathScaleX) * enemyCutIn.scaleX;
          const scaleY = (spitterJuice
            ? stagger.scaleYMul * spitterJuice.springScaleY
            : breathScaleY * spitterSample.breathScaleY) * enemyCutIn.scaleY;
          ctx.scale(juiceFacing * scaleX, scaleY);

          if (prevCanvas) {
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.5);
            ctx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.84 + blendA * 0.16);
          }

          ctx.drawImage(
            spCanvas,
            -sf.anchorX * drawScale,
            -sf.bottomY * drawScale,
            sf.w * drawScale,
            sf.h * drawScale,
          );
          ctx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
              -sf.w * drawScale * 0.55,
              -sf.bottomY * drawScale,
              sf.w * drawScale * 1.1,
              sf.h * drawScale * 0.48,
            );
            ctx.clip();
            ctx.translate(-stagger.shearPx, -2);
            ctx.drawImage(
              spCanvas,
              -sf.anchorX * drawScale,
              -sf.bottomY * drawScale,
              sf.w * drawScale,
              sf.h * drawScale,
            );
            ctx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || spitterJuice?.flashRgba || enemyCutIn.flashRgba) {
            ctx.globalCompositeOperation = 'lighter';
            const flashRgb = enemyCutIn.flashRgba ?? spitterJuice?.flashRgba;
            if (flashRgb) {
              drawCanvas2DCutInFlash(ctx, flashRgb, size * 0.36, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              ctx.beginPath();
              ctx.arc(0, -size * 0.44, size * 0.34, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              ctx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              ctx.beginPath();
              ctx.ellipse(2, -size * 0.44, size * 0.28, size * 0.34, 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }

        // Smooth Pressurized Yellow Bile Spit Stream & Particle Effects from Spitter's mouth all the way to the Heroine
        if (!ea?.dead && !tacticalViewActive && (windupProg > 0.02 || streamProg > 0.01)) {
          const headDeformDx = spitterJuice ? spitterJuice.deform.head.dx * drawScale * juiceFacing : 0;
          const headDeformDy = spitterJuice ? spitterJuice.deform.head.dy * drawScale : 0;
          const mouthX = spitterWorldX + sf.mouthOriginRel.dx * drawScale * (-juiceFacing) + headDeformDx;
          const mouthY = enemyGroundY + hopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
          const heroImpactX = heroCutInDrawX + 18 * baseScale;
          const heroImpactY = groundY - heroTargetHeight * 0.48;
          renderSpitterBileTorrent(fgCtx, sim, {
            mouthX,
            mouthY,
            targetX: heroImpactX,
            targetY: heroImpactY,
            groundY,
            baseScale,
            windupProgress: windupProg,
            streamProgress: streamProg,
            elapsed,
            seed: idx,
          });
        }
      }
    } else if (isBrute && bruteSample && sim.bruteFrames) {
      const bruteJuice = bruteJuiceSamples.get(enemy.id);
      const bCanvas = sim.bruteFrames[bruteSample.frameIndex] ?? sim.bruteFrames[0];
      if (bCanvas) {
        const bf = bruteSample.frame;
        const pf = bruteSample.prevFrame;
        const drawScale = size / BRUTE_CANONICAL_HEIGHT;
        const juiceHopY = bruteJuice ? bruteJuice.hopYPx * drawScale : bruteSample.yHopPx * drawScale;
        const juiceRot = bruteJuice ? bruteJuice.rotationRad : bruteSample.tiltRad;
        const juiceFacing = bruteJuice ? bruteJuice.facingScale : -1;
        const hopY = ea?.dead ? 0 : juiceHopY;

        // Trigger procedural Brute VFX on rising-edge state events (Single Transform Authority)
        if (!ea?.dead && !tacticalViewActive && bruteJuice && sim.lastFrameDt > 0) {
          const fistX = spriteX + bf.impactOriginRel.dx * drawScale * (-juiceFacing);
          const chestVialX = spriteX + bf.vialOriginRel.dx * drawScale * (-juiceFacing);
          const chestVialY = enemyGroundY + hopY + bf.vialOriginRel.dy * drawScale;

          if (bruteJuice.seismicImpactTriggered) {
            sim.trauma = Math.min(1, sim.trauma + 0.44 * bruteJuiceConfig.seismicImpactStrength);
            addGroundFissure(sim, fistX, enemyGroundY + 1, 1.08 * bruteJuiceConfig.seismicImpactStrength, 1.0);
            spawnBruteKineticShards(
              sim,
              fistX,
              enemyGroundY - 10,
              enemyGroundY + 2,
              15,
              'seismic',
              juiceFacing,
            );
          }
          if (bruteJuice.vialShatterTriggered) {
            spawnBruteMutagenMist(sim, chestVialX, chestVialY, 14, 1.0);
            spawnBruteKineticShards(sim, chestVialX, chestVialY, enemyGroundY + 2, 8, 'vial', juiceFacing);
          }
          if (bruteJuice.chitinShardTriggered) {
            spawnBruteKineticShards(
              sim,
              spriteX,
              enemyGroundY - size * 0.46,
              enemyGroundY + 2,
              enemy.weaponBroken ? 18 : 11,
              'chitin',
              -juiceFacing,
            );
          }
          if (bruteJuice.footPlantTriggered) {
            spawnBurst(sim, spriteX - 14, enemyGroundY - 2, 7, '#94A3B8', 0, 0.55, 22, 0.24, 0.16, 2.0, 2.2);
          }
          if (bruteJuice.mutagenMistProgress > 0.12) {
            const emitCount = bruteJuice.mutagenMistProgress > 0.45 ? 2 : 1;
            spawnBruteMutagenMist(sim, chestVialX, chestVialY, emitCount, bruteJuice.mutagenMistProgress);
          }
        }

        // 1. Emerald pocket-vial & mutagen vein bio-glow
        if (bruteSample.vialGlowIntensity > 0.32 && !ea?.dead && !tacticalViewActive) {
          const vialAlpha = Math.min(0.68, (bruteSample.vialGlowIntensity - 0.25) * 0.85);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const gx = spriteX + bf.vialOriginRel.dx * drawScale * (-juiceFacing);
          const gy = enemyGroundY + hopY + bf.vialOriginRel.dy * drawScale;
          const vRad = size * (bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace' ? 0.38 : 0.22);
          const vGrad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, vRad);
          vGrad.addColorStop(0, `rgba(74, 222, 128, ${vialAlpha})`);
          vGrad.addColorStop(0.5, `rgba(34, 197, 94, ${vialAlpha * 0.48})`);
          vGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
          fgCtx.fillStyle = vGrad;
          fgCtx.beginPath();
          fgCtx.arc(gx, gy, vRad, 0, Math.PI * 2);
          fgCtx.fill();

          if (bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace') {
            fgCtx.fillStyle = `rgba(134, 239, 172, ${0.5 + 0.35 * vialAlpha})`;
            for (let d = 0; d < 4; d++) {
              const ang = -Math.PI * 0.8 + d * 0.55 + elapsed * 3.2;
              const dist = size * (0.09 + 0.05 * Math.sin(elapsed * 8 + d));
              fgCtx.beginPath();
              fgCtx.arc(gx + Math.cos(ang) * dist, gy + Math.sin(ang) * dist, 2.6, 0, Math.PI * 2);
              fgCtx.fill();
            }
          }
          fgCtx.restore();
        }

        // 2. Fiery orange-amber dorsal carapace flare (Mutagen Brace flare, Heavy primed, Stagger warning, Heavy smash)
        if (bruteSample.shellGlowIntensity > 0.32 && !ea?.dead && !tacticalViewActive) {
          const shellAlpha = Math.min(0.72, (bruteSample.shellGlowIntensity - 0.25) * 0.88);
          fgCtx.save();
          fgCtx.globalCompositeOperation = 'lighter';
          const sx = spriteX + bf.shellOriginRel.dx * drawScale * (-juiceFacing);
          const sy = enemyGroundY + hopY + bf.shellOriginRel.dy * drawScale;
          const sRad = size * (bruteSample.mode === 'staggerHover' || bruteSample.mode === 'heavySmash' || bruteJuice?.activeTrigger === 'seismic_smash' ? 0.46 : 0.34);
          const sGrad = fgCtx.createRadialGradient(sx, sy, 2, sx, sy, sRad);
          sGrad.addColorStop(0, `rgba(250, 204, 21, ${shellAlpha * 0.9})`);
          sGrad.addColorStop(0.45, `rgba(251, 146, 60, ${shellAlpha * 0.52})`);
          sGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
          fgCtx.fillStyle = sGrad;
          fgCtx.beginPath();
          fgCtx.arc(sx, sy, sRad, 0, Math.PI * 2);
          fgCtx.fill();

          if (
            bruteSample.mode === 'heavyPrimed' ||
            bruteSample.mode === 'staggerHover' ||
            bruteSample.mode === 'heavySmash' ||
            bruteJuice?.activeTrigger === 'seismic_smash' ||
            ((bruteSample.mode === 'brace' || bruteJuice?.activeTrigger === 'mutagen_brace') && bruteSample.frameIndex === 6)
          ) {
            const rayLen = size * (bruteSample.mode === 'heavySmash' || bruteJuice?.activeTrigger === 'seismic_smash' ? 0.38 : 0.28);
            fgCtx.strokeStyle = `rgba(253, 186, 116, ${0.42 + 0.3 * shellAlpha})`;
            fgCtx.lineWidth = 2;
            const angles = [-2.25, -1.8, -1.3, -0.82];
            for (let r = 0; r < angles.length; r++) {
              const ang = angles[r];
              fgCtx.beginPath();
              fgCtx.moveTo(sx + Math.cos(ang) * (size * 0.08), sy + Math.sin(ang) * (size * 0.08));
              fgCtx.lineTo(sx + Math.cos(ang) * rayLen, sy + Math.sin(ang) * rayLen);
              fgCtx.stroke();
            }
          }
          fgCtx.restore();
        }

        // 3. Ground seismic shockwave rings on Heavy Smash impact
        if (bruteSample.shockwaveIntensity > 0.08 && !ea?.dead && !tacticalViewActive) {
          const sw = bruteSample.shockwaveIntensity;
          const ix = spriteX + bf.impactOriginRel.dx * drawScale * (-juiceFacing);
          const iy = enemyGroundY + 2;
          fgCtx.save();
          fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.78 * Math.min(1, sw)})`;
          fgCtx.lineWidth = 3 * Math.min(1.3, sw);
          fgCtx.beginPath();
          fgCtx.ellipse(ix, iy, size * (0.28 + (1 - Math.min(1, sw)) * 0.34), 10 + (1 - Math.min(1, sw)) * 8, 0, 0, Math.PI * 2);
          fgCtx.stroke();

          fgCtx.strokeStyle = `rgba(250, 204, 21, ${0.62 * Math.min(1, sw)})`;
          fgCtx.lineWidth = 1.6;
          fgCtx.beginPath();
          fgCtx.ellipse(ix, iy, size * (0.16 + (1 - Math.min(1, sw)) * 0.22), 6 + (1 - Math.min(1, sw)) * 5, 0, 0, Math.PI * 2);
          fgCtx.stroke();
          fgCtx.restore();
        }

        const blendA = bruteSample.frameBlendAlpha;
        const canCrossBlend =
          !ea?.dead &&
          blendA < 0.99 &&
          bruteSample.prevFrameIndex !== bruteSample.frameIndex;
        const prevCanvas = canCrossBlend ? sim.bruteFrames[bruteSample.prevFrameIndex] : null;

        if (webglRenderer) {
          const { deform, uniforms } = deriveEnemyDeformAndUniforms({
            archetype: arch,
            idx,
            ea,
            isDead,
            staggerShearPx: stagger.shearPx,
            staggerBioFlashAlpha: stagger.bioFlashAlpha,
            breathScaleX: bruteJuice ? stagger.scaleXMul : breathScaleX * bruteSample.breathScaleX,
            breathScaleY: bruteJuice ? stagger.scaleYMul : breathScaleY * bruteSample.breathScaleY,
            frameBlendAlpha: canCrossBlend ? blendA : 1,
            bioEmissiveRgb,
            isPrimedOrCharging: isPrimedOrCharging || bruteSample.shellGlowIntensity > 0.6,
            isAcidOrPustuleActive: false,
            isStaggeredStatus: Boolean(enemy.staggered),
            elapsed,
            tacticalViewActive,
            bruteJuice,
            cutIn: enemyCutIn,
            facingSign: juiceFacing,
          });
          webglRenderer.drawSprite({
            id: `enemy:${enemy.id}`,
            primarySource: bCanvas,
            secondarySource: prevCanvas,
            worldX: spriteX,
            worldY: enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45),
            widthPx: bf.w * drawScale,
            heightPx: bf.h * drawScale,
            anchorOffsetXPx: bf.anchorX * drawScale,
            anchorOffsetYPx: bf.bottomY * drawScale,
            secondaryWidthPx: pf.w * drawScale,
            secondaryHeightPx: pf.h * drawScale,
            secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
            secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
            facingSign: juiceFacing,
            rotationRad: !ea?.dead ? stagger.rot * 0.28 + juiceRot + enemyCutIn.leanRad : 0,
            alpha: koAlpha,
            drawPriority: enemyCutIn.drawPriority,
            deform,
            uniforms,
          });
        } else {
          ctx.save();
          ctx.globalAlpha = koAlpha * canvasBystanderMul;
          ctx.translate(spriteX, enemyGroundY + hopY + (ea?.dead ? 0 : stagger.dy * 0.45));
          if (!ea?.dead) {
            ctx.rotate(stagger.rot * 0.28 + juiceRot + enemyCutIn.leanRad);
          }
          const scaleX = (bruteJuice
            ? stagger.scaleXMul * bruteJuice.springScaleX
            : breathScaleX * bruteSample.breathScaleX) * enemyCutIn.scaleX;
          const scaleY = (bruteJuice
            ? stagger.scaleYMul * bruteJuice.springScaleY
            : breathScaleY * bruteSample.breathScaleY) * enemyCutIn.scaleY;
          ctx.scale(juiceFacing * scaleX, scaleY);

          if (prevCanvas) {
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
            ctx.drawImage(
              prevCanvas,
              -pf.anchorX * drawScale,
              -pf.bottomY * drawScale,
              pf.w * drawScale,
              pf.h * drawScale,
            );
            ctx.globalAlpha = koAlpha * canvasBystanderMul * Math.min(1, 0.85 + blendA * 0.15);
          }

          ctx.drawImage(
            bCanvas,
            -bf.anchorX * drawScale,
            -bf.bottomY * drawScale,
            bf.w * drawScale,
            bf.h * drawScale,
          );
          ctx.globalAlpha = koAlpha * canvasBystanderMul;

          if (!ea?.dead && Math.abs(stagger.shearPx) > 0.5) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
              -bf.w * drawScale * 0.55,
              -bf.bottomY * drawScale,
              bf.w * drawScale * 1.1,
              bf.h * drawScale * 0.48,
            );
            ctx.clip();
            ctx.translate(-stagger.shearPx, -2);
            ctx.drawImage(
              bCanvas,
              -bf.anchorX * drawScale,
              -bf.bottomY * drawScale,
              bf.w * drawScale,
              bf.h * drawScale,
            );
            ctx.restore();
          }

          if ((ea && ea.flashTimer > 0) || (!ea?.dead && stagger.bioFlashAlpha > 0.04) || bruteJuice?.flashRgba || enemyCutIn.flashRgba) {
            ctx.globalCompositeOperation = 'lighter';
            const flashRgb = enemyCutIn.flashRgba ?? bruteJuice?.flashRgba;
            if (flashRgb) {
              drawCanvas2DCutInFlash(ctx, flashRgb, size * 0.38, -size * 0.44);
            } else if (ea && ea.flashTimer > 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
              ctx.beginPath();
              ctx.arc(0, -size * 0.44, size * 0.36, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!ea?.dead && stagger.bioFlashAlpha > 0.04) {
              ctx.fillStyle = hexToRgba(enemyBio.freshEmissive, stagger.bioFlashAlpha);
              ctx.beginPath();
              ctx.ellipse(2, -size * 0.44, size * 0.3, size * 0.36, 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
    } else if (entry) {
      const bossWorldX = ex + cutInShiftX;
      const bossFacingSign = enemy.archetype === 'brute' ? -1 : 1;
      const bossCutInBoost =
        arch === 'boss' && enemyCutIn.poseOverride === 'attack_pose' ? 1.06 : 1;
      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: arch,
          idx,
          ea,
          isDead,
          staggerShearPx: stagger.shearPx,
          staggerBioFlashAlpha: stagger.bioFlashAlpha,
          breathScaleX: breathScaleX * bossCutInBoost,
          breathScaleY: breathScaleY * bossCutInBoost,
          frameBlendAlpha: 1,
          bioEmissiveRgb,
          isPrimedOrCharging,
          isAcidOrPustuleActive,
          isStaggeredStatus: Boolean(enemy.staggered),
          elapsed,
          tacticalViewActive,
          cutIn: enemyCutIn,
          facingSign: bossFacingSign,
        });
        webglRenderer.drawSprite({
          id: `enemy:${enemy.id}`,
          primarySource: entry.canvas,
          worldX: bossWorldX,
          worldY: enemyGroundY + koOffsetY + stagger.dy,
          widthPx: size,
          heightPx: size,
          anchorOffsetXPx: size * centerXRatio,
          anchorOffsetYPx: size * bottomRatio,
          facingSign: bossFacingSign,
          rotationRad: stagger.rot + enemyCutIn.leanRad,
          alpha: koAlpha,
          drawPriority: enemyCutIn.drawPriority,
          deform,
          uniforms,
        });
      } else {
        ctx.save();
        ctx.globalAlpha = koAlpha * canvasBystanderMul;
        ctx.translate(bossWorldX, enemyGroundY + koOffsetY + stagger.dy);
        ctx.rotate(stagger.rot + enemyCutIn.leanRad);
        ctx.scale(
          bossFacingSign * breathScaleX * bossCutInBoost * enemyCutIn.scaleX,
          breathScaleY * bossCutInBoost * enemyCutIn.scaleY,
        );
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

        if ((ea && ea.flashTimer > 0) || stagger.bioFlashAlpha > 0.04 || enemyCutIn.flashRgba) {
          ctx.globalCompositeOperation = 'lighter';
          if (enemyCutIn.flashRgba) {
            drawCanvas2DCutInFlash(ctx, enemyCutIn.flashRgba, size * 0.36, -size * 0.44);
          } else if (ea && ea.flashTimer > 0) {
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
    }

    ctx.restore();
    ctx = fgCtx;
    ctx.save();
    ctx.globalAlpha = koAlpha;

    const isHighlighted = !isDead && (hoveredEnemyId === enemy.id || inspectedEnemyId === enemy.id);
    if (isHighlighted) {
      const isInspected = inspectedEnemyId === enemy.id;
      const bracketW = Math.max(48, size * (isCrawler ? 0.78 : isBrute ? 0.92 : 0.74));
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
      ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.3, isBrute ? size * 0.48 : size * 0.38, isBrute ? 12 : 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // On-stage Enemy Lifebar + Prominent Armor Plate Bar + Damage/Death Preview directly under enemy feet
    if (!isDead && worldUiAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
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
            : enemy.archetype === 'brute'
              ? 64
              : 56
          : h < 220
            ? enemy.archetype === 'boss'
              ? 82
              : enemy.archetype === 'brute'
                ? 78
                : 66
            : enemy.archetype === 'boss'
              ? 96
              : enemy.archetype === 'brute'
                ? 88
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
        const crestX = barX - 10.5;
        const crestY = barY + 0.5;
        const crestR = 9.6;
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

        ctx.font = '700 11.5px "JetBrains Mono", monospace';
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
        ctx.font = '700 12px "JetBrains Mono", monospace';
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
      ctx.restore();
    }

    ctx.restore();
    ctx = baseCtx;
  }

  // 4.05 On-Demand Bile Spitter 4-Layer Juice Lab Specimen (when Spitter Lab is open on a node without a living Spitter)
  const hasLivingSpitter = enemies.some((e) => e.archetype === 'spitter' && e.hp > 0);
  if (spitterLabActive && !hasLivingSpitter && sim.spitterFrames) {
    const dtStep = sim.lastFrameDt > 0 ? sim.lastFrameDt : 0.016;
    let labState = sim.spitterJuiceStates.get('spitter_lab_specimen');
    if (!labState) {
      labState = createSpitterJuiceState();
      sim.spitterJuiceStates.set('spitter_lab_specimen', labState);
    }
    const labJuice = stepSpitterJuice(labState, dtStep, elapsed, spitterJuiceConfig, {
      instanceIndex: 0,
    });
    const spCanvas = sim.spitterFrames[labJuice.frameIndex] ?? sim.spitterFrames[0];
    if (spCanvas) {
      const sf = SPITTER_SHEET_FRAMES[labJuice.frameIndex] ?? SPITTER_SHEET_FRAMES[0];
      const pf = SPITTER_SHEET_FRAMES[labJuice.prevFrameIndex] ?? sf;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 0.98;
      const drawScale = size / SPITTER_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.58);
      const labWorldX = labBaseX + labJuice.offsetX * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      // Ground contact shadow + persistent caustic slime puddle + specimen holo-ring on baseCtx
      baseCtx.save();
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.68)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 2, size * 0.34, 8, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = 'rgba(163, 230, 53, 0.72)';
      baseCtx.lineWidth = 1.8;
      baseCtx.setLineDash([5, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 2, size * 0.38, 9.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      renderSpitterGroundPuddle(
        baseCtx,
        labBaseX + (labWorldX - labBaseX) * 0.28,
        labGroundY + 1,
        size,
        1,
        labJuice.pustuleGlowIntensity,
        Math.max(labJuice.spitWindupProgress, labJuice.spitStreamProgress),
        elapsed,
        0,
      );

      // Pustule glow on fgCtx
      if (labJuice.pustuleGlowIntensity > 0.35 && !tacticalViewActive) {
        const glowAlpha = Math.min(0.75, (labJuice.pustuleGlowIntensity - 0.25) * 0.9);
        fgCtx.save();
        fgCtx.globalCompositeOperation = 'lighter';
        const gx = labWorldX + sf.pustuleOriginRel.dx * drawScale * (-labJuice.facingScale);
        const gy = labGroundY + labHopY + sf.pustuleOriginRel.dy * drawScale;
        const rad = size * 0.38;
        const grad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
        grad.addColorStop(0, `rgba(254, 240, 138, ${glowAlpha})`);
        grad.addColorStop(0.45, `rgba(163, 230, 53, ${glowAlpha * 0.52})`);
        grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
        fgCtx.fillStyle = grad;
        fgCtx.beginPath();
        fgCtx.arc(gx, gy, rad, 0, Math.PI * 2);
        fgCtx.fill();
        fgCtx.restore();
      }

      const prevCanvas =
        labJuice.frameBlendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.spitterFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'spitter',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.frameBlendAlpha : 1,
          bioEmissiveRgb: [0.64, 0.9, 0.21],
          isPrimedOrCharging: labJuice.activeTrigger === 'cast_charge',
          isAcidOrPustuleActive: labJuice.activeTrigger === 'cast_charge',
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          spitterJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:spitter_lab_specimen',
          primarySource: spCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: sf.w * drawScale,
          heightPx: sf.h * drawScale,
          anchorOffsetXPx: sf.anchorX * drawScale,
          anchorOffsetYPx: sf.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: 1,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
        baseCtx.drawImage(
          spCanvas,
          -sf.anchorX * drawScale,
          -sf.bottomY * drawScale,
          sf.w * drawScale,
          sf.h * drawScale,
        );
        baseCtx.restore();
      }

      if (
        !tacticalViewActive &&
        (labJuice.spitWindupProgress > 0.02 || labJuice.spitStreamProgress > 0.01)
      ) {
        const headDeformDx = labJuice.deform.head.dx * drawScale * labJuice.facingScale;
        const headDeformDy = labJuice.deform.head.dy * drawScale;
        const mouthX = labWorldX + sf.mouthOriginRel.dx * drawScale * (-labJuice.facingScale) + headDeformDx;
        const mouthY = labGroundY + labHopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
        const heroImpactX = heroX + 18 * baseScale;
        const heroImpactY = groundY - heroTargetHeight * 0.48;
        renderSpitterBileTorrent(fgCtx, sim, {
          mouthX,
          mouthY,
          targetX: heroImpactX,
          targetY: heroImpactY,
          groundY,
          baseScale,
          windupProgress: labJuice.spitWindupProgress,
          streamProgress: labJuice.spitStreamProgress,
          elapsed,
          seed: 7,
        });
      }
    }
  }

  // 4.06 On-Demand Carapace Brute 4-Layer Juice Lab Specimen (when Brute Lab is active on a node without a living Brute)
  const hasLivingBrute = enemies.some((e) => e.archetype === 'brute' && e.hp > 0);
  if (bruteLabActive && !hasLivingBrute && sim.bruteFrames) {
    const dtStep = sim.lastFrameDt > 0 ? sim.lastFrameDt : 0.016;
    let labState = sim.bruteJuiceStates.get('brute_lab_specimen');
    if (!labState) {
      labState = createBruteJuiceState();
      sim.bruteJuiceStates.set('brute_lab_specimen', labState);
    }
    const labJuice = stepBruteJuice(labState, dtStep, elapsed, bruteJuiceConfig, {
      instanceIndex: 0,
    });
    const bCanvas = sim.bruteFrames[labJuice.frameIndex] ?? sim.bruteFrames[0];
    if (bCanvas) {
      const bf = BRUTE_SHEET_FRAMES[labJuice.frameIndex] ?? BRUTE_SHEET_FRAMES[1];
      const pf = BRUTE_SHEET_FRAMES[labJuice.prevFrameIndex] ?? bf;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const size = baseEnemySize * 1.28;
      const drawScale = size / BRUTE_CANONICAL_HEIGHT;
      const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.62);
      const labWorldX = labBaseX + labJuice.offsetX * drawScale;
      const labGroundY = groundY - 2;
      const labHopY = labJuice.hopYPx * drawScale;

      if (!tacticalViewActive && sim.lastFrameDt > 0) {
        const fistX = labWorldX + bf.impactOriginRel.dx * drawScale * (-labJuice.facingScale);
        const chestVialX = labWorldX + bf.vialOriginRel.dx * drawScale * (-labJuice.facingScale);
        const chestVialY = labGroundY + labHopY + bf.vialOriginRel.dy * drawScale;

        if (labJuice.seismicImpactTriggered) {
          sim.trauma = Math.min(1, sim.trauma + 0.44 * bruteJuiceConfig.seismicImpactStrength);
          addGroundFissure(sim, fistX, labGroundY + 1, 1.12 * bruteJuiceConfig.seismicImpactStrength, 1.0);
          spawnBruteKineticShards(sim, fistX, labGroundY - 10, labGroundY + 2, 16, 'seismic', labJuice.facingScale);
        }
        if (labJuice.vialShatterTriggered) {
          spawnBruteMutagenMist(sim, chestVialX, chestVialY, 14, 1.0);
          spawnBruteKineticShards(sim, chestVialX, chestVialY, labGroundY + 2, 8, 'vial', labJuice.facingScale);
        }
        if (labJuice.chitinShardTriggered) {
          spawnBruteKineticShards(sim, labWorldX, labGroundY - size * 0.46, labGroundY + 2, 14, 'chitin', -labJuice.facingScale);
        }
        if (labJuice.footPlantTriggered) {
          spawnBurst(sim, labWorldX - 12, labGroundY - 2, 7, '#94A3B8', 0, 0.55, 22, 0.24, 0.16, 2.0, 2.2);
        }
        if (labJuice.mutagenMistProgress > 0.12) {
          const emitCount = labJuice.mutagenMistProgress > 0.45 ? 2 : 1;
          spawnBruteMutagenMist(sim, chestVialX, chestVialY, emitCount, labJuice.mutagenMistProgress);
        }
      }

      // Ground contact shadow + specimen amber/crimson tactical holo-ring on baseCtx
      baseCtx.save();
      baseCtx.fillStyle = 'rgba(3, 7, 18, 0.72)';
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.44, 9.5, 0, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = 'rgba(251, 146, 60, 0.75)';
      baseCtx.lineWidth = 2;
      baseCtx.setLineDash([6, 3]);
      baseCtx.beginPath();
      baseCtx.ellipse(labWorldX, labGroundY - 1, size * 0.46, 10.5, 0, 0, Math.PI * 2);
      baseCtx.stroke();
      baseCtx.restore();

      if (labJuice.vialGlowIntensity > 0.34 && !tacticalViewActive) {
        const vialAlpha = Math.min(0.68, (labJuice.vialGlowIntensity - 0.25) * 0.85);
        fgCtx.save();
        fgCtx.globalCompositeOperation = 'lighter';
        const gx = labWorldX + bf.vialOriginRel.dx * drawScale * (-labJuice.facingScale);
        const gy = labGroundY + labHopY + bf.vialOriginRel.dy * drawScale;
        const vRad = size * (labJuice.activeTrigger === 'mutagen_brace' ? 0.38 : 0.24);
        const vGrad = fgCtx.createRadialGradient(gx, gy, 2, gx, gy, vRad);
        vGrad.addColorStop(0, `rgba(74, 222, 128, ${vialAlpha})`);
        vGrad.addColorStop(0.5, `rgba(34, 197, 94, ${vialAlpha * 0.48})`);
        vGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        fgCtx.fillStyle = vGrad;
        fgCtx.beginPath();
        fgCtx.arc(gx, gy, vRad, 0, Math.PI * 2);
        fgCtx.fill();
        fgCtx.restore();
      }

      if (labJuice.shellGlowIntensity > 0.34 && !tacticalViewActive) {
        const shellAlpha = Math.min(0.72, (labJuice.shellGlowIntensity - 0.25) * 0.88);
        fgCtx.save();
        fgCtx.globalCompositeOperation = 'lighter';
        const sx = labWorldX + bf.shellOriginRel.dx * drawScale * (-labJuice.facingScale);
        const sy = labGroundY + labHopY + bf.shellOriginRel.dy * drawScale;
        const sRad = size * (labJuice.activeTrigger === 'seismic_smash' ? 0.46 : 0.34);
        const sGrad = fgCtx.createRadialGradient(sx, sy, 2, sx, sy, sRad);
        sGrad.addColorStop(0, `rgba(250, 204, 21, ${shellAlpha * 0.9})`);
        sGrad.addColorStop(0.45, `rgba(251, 146, 60, ${shellAlpha * 0.52})`);
        sGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
        fgCtx.fillStyle = sGrad;
        fgCtx.beginPath();
        fgCtx.arc(sx, sy, sRad, 0, Math.PI * 2);
        fgCtx.fill();
        fgCtx.restore();
      }

      if (labJuice.shockwaveIntensity > 0.08 && !tacticalViewActive) {
        const sw = Math.min(1.2, labJuice.shockwaveIntensity);
        const ix = labWorldX + bf.impactOriginRel.dx * drawScale * (-labJuice.facingScale);
        const iy = labGroundY + 2;
        fgCtx.save();
        fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.8 * Math.min(1, sw)})`;
        fgCtx.lineWidth = 3 * sw;
        fgCtx.beginPath();
        fgCtx.ellipse(ix, iy, size * (0.28 + (1 - Math.min(1, sw)) * 0.34), 10 + (1 - Math.min(1, sw)) * 8, 0, 0, Math.PI * 2);
        fgCtx.stroke();
        fgCtx.restore();
      }

      const prevCanvas =
        labJuice.frameBlendAlpha < 0.99 && labJuice.prevFrameIndex !== labJuice.frameIndex
          ? sim.bruteFrames[labJuice.prevFrameIndex]
          : null;

      if (webglRenderer) {
        const { deform, uniforms } = deriveEnemyDeformAndUniforms({
          archetype: 'brute',
          idx: 0,
          ea: undefined,
          isDead: false,
          staggerShearPx: 0,
          staggerBioFlashAlpha: 0,
          breathScaleX: 1,
          breathScaleY: 1,
          frameBlendAlpha: prevCanvas ? labJuice.frameBlendAlpha : 1,
          bioEmissiveRgb: [0.98, 0.57, 0.24],
          isPrimedOrCharging: labJuice.activeTrigger === 'mutagen_brace' || labJuice.activeTrigger === 'seismic_smash',
          isAcidOrPustuleActive: false,
          isStaggeredStatus: false,
          elapsed,
          tacticalViewActive,
          bruteJuice: labJuice,
        });
        webglRenderer.drawSprite({
          id: 'enemy:brute_lab_specimen',
          primarySource: bCanvas,
          secondarySource: prevCanvas,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          widthPx: bf.w * drawScale,
          heightPx: bf.h * drawScale,
          anchorOffsetXPx: bf.anchorX * drawScale,
          anchorOffsetYPx: bf.bottomY * drawScale,
          secondaryWidthPx: pf.w * drawScale,
          secondaryHeightPx: pf.h * drawScale,
          secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
          secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          alpha: 1,
          deform,
          uniforms,
        });
      } else {
        baseCtx.save();
        baseCtx.translate(labWorldX, labGroundY + labHopY);
        baseCtx.rotate(labJuice.rotationRad);
        baseCtx.scale(
          labJuice.facingScale * labJuice.springScaleX,
          labJuice.springScaleY,
        );
        baseCtx.drawImage(
          bCanvas,
          -bf.anchorX * drawScale,
          -bf.bottomY * drawScale,
          bf.w * drawScale,
          bf.h * drawScale,
        );
        baseCtx.restore();
      }
    }
  }

  // Route all foreground VFX, trajectory arcs, bolts, particles, tactical plaques, and floating numbers to fgCtx
  ctx = fgCtx;

  // 4.15 Telegraph Enemy Intent Directly on the Board (Glowing red/amber trajectory vectors + big dark-outlined damage numbers)
  if (heroine.hp > 0 && worldUiAlpha > 0.02) {
    const heroTargetX = heroX + 18 * baseScale;
    const heroTargetY = groundY - heroTargetHeight * 0.46;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (
        enemy.hp <= 0 ||
        enemy.escaped ||
        enemy.propKind ||
        enemy.isLootRunner ||
        enemy.staggered ||
        (enemy.sleepCounter !== undefined && enemy.sleepCounter > 0)
      ) {
        continue;
      }
      const intent = enemy.intentCycle[enemy.currentIntentIndex];
      if (!intent) continue;
      const isOffensive =
        intent.kind === 'attack' ||
        intent.kind === 'heavy' ||
        intent.kind === 'acid' ||
        intent.kind === 'leech';
      if (!isOffensive) continue;

      const ex = enemyBaseX + (slotCenters[idx] ?? idx) * enemyStepX;
      const ey = groundY - (idx % 2 === 1 ? 6 : 0) - 68 * baseScale;
      const effectiveVal = getEffectiveEnemyIntentValue(enemy, intent, {
        shieldAfterPlayer: precomputedThreat?.shieldAfterPlayer ?? heroine.shield,
        colorPlayed: activePreview?.tileCount ? activePreview.color : null,
        battlefieldRule: combat.battlefieldRule,
      });
      if (effectiveVal <= 0) continue;
      const isAcid = intent.kind === 'acid';
      const strokeRgb = isAcid ? '132, 204, 22' : '255, 46, 126';
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 4.5 + idx);
      const ctrlX = (ex + heroTargetX) * 0.5;
      const ctrlY = Math.min(ey, heroTargetY) - (26 + idx * 14);

      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
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
      const xA = enemyBaseX + (slotCenters[idxA] ?? idxA) * enemyStepX;
      const xB = enemyBaseX + (slotCenters[idxB] ?? idxB) * enemyStepX;
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
    // Vertical orbital drop beam
    const beamGrad = ctx.createLinearGradient(dx, Math.max(24, dy - 160), dx, dy);
    beamGrad.addColorStop(0, `rgba(${beamColor}, 0)`);
    beamGrad.addColorStop(0.55, `rgba(${beamColor}, ${0.12 + 0.1 * pulse})`);
    beamGrad.addColorStop(1, `rgba(${beamColor}, ${0.28 + 0.14 * pulse})`);
    ctx.fillStyle = beamGrad;
    const beamHalfW = isTwoSlotDrop ? 28 : 18;
    ctx.fillRect(dx - beamHalfW, Math.max(18, dy - 155), beamHalfW * 2, Math.min(155, dy - 18));

    // Ground landing zone ring
    ctx.strokeStyle = `rgba(${beamColor}, ${0.65 + 0.3 * pulse})`;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(dx, dy - 1, (isTwoSlotDrop ? 44 : 28) + pulse * 4, isTwoSlotDrop ? 10 : 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Holographic chevron diamond hovering in landing column
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

  // 5. Styled Ranged Projectiles (Scattergun Pellets, Drone Plasma, Pistol Bolts, Acid Bile Globules, Stinger Darts)
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
        // Spinning angular glass / chitin splinter shard
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
        // Buoyant mutagen bio-nanite aerosol cloud
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

  // 8.5 Tactical View Rule 3: Bold High-Contrast Numbers & Geometric Symbols Directly Over Units
  if (tacticalViewActive) {
    ctx.save();
    // Heroine Overhead Tactical Badge
    if (heroine.hp > 0 && !isProne) {
      const hPlaqueW = 122;
      const hPlaqueH = 30;
      const hpx = Math.max(8, Math.round(heroX - hPlaqueW * 0.5));
      const hpy = Math.max(38, Math.round(groundY - heroTargetHeight - 18));
      ctx.fillStyle = '#020617';
      ctx.fillRect(hpx - 2, hpy - 2, hPlaqueW + 4, hPlaqueH + 4);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(hpx, hpy, hPlaqueW, hPlaqueH);
      ctx.font = '800 13px "JetBrains Mono", monospace';
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
      const ex = enemyBaseX + (slotCenters[idx] ?? idx) * enemyStepX;
      const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
      const ePlaqueW = 136;
      const ePlaqueH = 44;
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

      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      const armTxt = enemy.armor > 0 ? ` ■${enemy.armor}` : '';
      const pipTxt = enemy.shieldPips > 0 ? ` ◆${enemy.shieldPips}` : '';
      ctx.fillText(
        `${pipSymbol} ${enemy.hp}HP${armTxt}${pipTxt}`,
        epx + ePlaqueW * 0.5,
        epy + 13,
      );

      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.fillStyle =
        intent.kind === 'attack' || intent.kind === 'heavy'
          ? '#FDA4AF'
          : intent.kind === 'acid'
            ? '#BEF264'
            : '#FDE047';
      const intentVal = intent.value + (enemy.enrageAtkBonus ?? 0);
      const corTag = intent.corrodeAmount ? ` +${intent.corrodeAmount}C` : '';
      const armTag = intent.armorOnHit ? ` +${intent.armorOnHit}A` : '';
      const intentTxt =
        intent.kind === 'charge'
          ? `★ CHG (${intent.secondaryValue ?? 1}T→${intentVal})`
          : intent.kind === 'armor' || intent.kind === 'bolster'
            ? intent.secondaryValue && intent.secondaryValue > 0
              ? `● +${intent.value}A +${intent.secondaryValue}HP`
              : `● +${intent.value} ARM`
            : `◆ ${intentVal} DMG${corTag}${armTag}`;
      ctx.fillText(intentTxt, epx + ePlaqueW * 0.5, epy + 31);
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

  // Flush WebGL2 MeshSprite queue & optional 4x6 anatomical debug wireframe overlay
  if (webglRenderer) {
    webglRenderer.endFrame(debugMeshWireframe ? fgCtx : null);
  }

  if (fgCtx !== baseCtx) {
    fgCtx.restore();
  }
  baseCtx.restore();

  // 10. Fourth-Wall Cyber-Visor Screen Blood Drops (screen-space outside camera shake/zoom; hidden in Tactical View)
  if (!tacticalViewActive) {
    renderScreenBloodDrops(fgCtx, sim, elapsed);
  }

  // 11. Darkest Dungeon Cut-In Speed-Lines & Crit Invert Impact Flash (screen-space)
  if (seqFrame && !tacticalViewActive && !reducedMotion && (seqFrame.speedLinesAlpha > 0.02 || seqFrame.invertFlashAlpha > 0.01)) {
    fgCtx.save();
    fgCtx.scale(dpr, dpr);
    renderCutInForegroundVfx(fgCtx, seqFrame, w, h, elapsed);
    fgCtx.restore();
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

/**
 * Renders a persistent, non-flickering yellow-chartreuse slime puddle on `baseCtx`
 * directly underneath a Bile Spitter's claws so the floor puddle never pops in/out
 * when frames change.
 */
function renderSpitterGroundPuddle(
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

  // 1. Dark olive-charcoal outer meniscus rim
  ctx.fillStyle = 'rgba(26, 46, 5, 0.78)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 2.5, ry + 1.4, 0, 0, Math.PI * 2);
  ctx.ellipse(x - rx * 0.48, y + 1.2, rx * 0.42, ry * 0.68, -0.08, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.46, y + 0.8, rx * 0.38, ry * 0.64, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // 2. Main viscous chartreuse-green slime body
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

  // 3. Luminous sulfur-yellow bile core pool
  const coreAlpha = Math.min(0.92, 0.48 + pustuleGlow * 0.35 + chargeIntensity * 0.2);
  ctx.globalAlpha = alpha * coreAlpha;
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.06, y - 0.4, rx * 0.52, ry * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Gently simmering yellow-cream caustic bubbles (continuous phase, zero popping)
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

/**
 * Renders the Bile Spitter's pressurized yellow-chartreuse bile torrent from its open jaws
 * all the way to the Heroine, and emits live yellow-bile particles and falling acid droplets
 * into `sim.particles` and `sim.bloodDrops`.
 */
function renderSpitterBileTorrent(
  ctx: CanvasRenderingContext2D,
  sim: CombatStageSim,
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
    groundY,
    baseScale,
    windupProgress,
    streamProgress,
    elapsed,
    seed,
  } = params;

  ctx.save();

  // 1. Throat/Jaw Pressurized Yellow Bile Condensation Orb during Windup & Spit
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

    // Inward-churning yellow bile droplets around the jaws during windup
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

  // 2. Active Pressurized Yellow-Chartreuse Bile Stream Erupting from Jaws to Heroine
  if (streamProgress > 0.01) {
    const p = Math.max(0, Math.min(1, streamProgress));
    // Stream head races from mouth (t=0) to heroine (t=1) in first 30% of spit window
    const headT = Math.min(1, Math.pow(p / 0.30, 0.75));
    // Stream tail stays anchored inside the Spitter's open jaws throughout Frames 5 and 6 (up to p=0.76)
    // so an unbroken pressurized yellow bile jet connects the Spitter's mouth all the way to the heroine
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
      // Organic peristaltic wave that tapers to 0 at mouth (t=0) and heroine (t=1)
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

    // Trailing saliva/bile filament from open jaws to tailT during final detachment (p > 0.76)
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

    // Pass A: Caustic outer yellow-green glow sheath
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

    // Pass B: Segmented viscous chartreuse-to-golden-yellow bile jet with peristaltic bolus bulges
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

    // Pass C: Incandescent pale-yellow sulfur core stream
    ctx.globalAlpha = 0.96 * fadeOut;
    ctx.strokeStyle = '#FEF9C3';
    ctx.lineWidth = 3.6 * baseScale;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Pass D: 14 Traveling Yellow-Bile Globules & Satellite Droplets along the jet
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

    // Pass E: Mouth Ejection Spray Cone while stream is actively firing from jaws
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

    // Pass F: Heroine Impact Splash & Corrosive Yellow Bile Cascade when stream reaches Heroine
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

      // Splashing yellow-bile globules bursting off the heroine's torso/shield
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

    // Pass G: Spawn real physics particles (`sim.particles`) & falling acid droplets (`sim.bloodDrops`)
    if (sim.lastFrameDt > 0 && p < 0.9) {
      const headPt = pts[pts.length - 1];
      const midPt = pts[Math.floor(pts.length * (0.25 + (elapsed * 3.7) % 0.65))];
      const bileColors = ['#FEF08A', '#FACC15', '#EAB308', '#A3E635'];

      // Emit 3 yellow-bile particles per frame across mouth, mid-stream, and heroine impact
      for (let emitIdx = 0; emitIdx < 3; emitIdx++) {
        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
          const pt = sim.particles[i];
          if (!pt.active) {
            const atImpact = headT >= 0.88 && emitIdx === 1;
            const atMid = emitIdx === 2;
            const originX = atImpact ? targetX : atMid ? midPt.x : headPt.x;
            const originY = atImpact ? targetY : atMid ? midPt.y : headPt.y;
            const ang = atImpact
              ? (Math.random() - 0.5) * Math.PI * 1.5
              : Math.PI + (Math.random() - 0.5) * 0.8;
            const spd = atImpact ? 60 + Math.random() * 135 : 75 + Math.random() * 145;
            pt.active = true;
            pt.x = originX + (Math.random() - 0.5) * 10;
            pt.y = originY + (Math.random() - 0.5) * 10;
            pt.vx = Math.cos(ang) * spd;
            pt.vy = Math.sin(ang) * spd - (atImpact ? 50 : 22);
            pt.life = 0;
            pt.maxLife = 0.28 + Math.random() * 0.26;
            pt.size = 2.8 + Math.random() * 3.4;
            pt.color = bileColors[(i + emitIdx) % bileColors.length];
            pt.shape = 2; // Acid droplet shape
            break;
          }
        }
      }

      // Emit physical falling yellow-bile droplets that splash into floor puddles along the bridge and at Heroine's feet
      if (Math.random() < 0.72) {
        for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
          const bd = sim.bloodDrops[i];
          if (!bd.active) {
            const dropAtHero = headT >= 0.88 && Math.random() < 0.65;
            bd.active = true;
            bd.x = (dropAtHero ? targetX : midPt.x) + (Math.random() - 0.5) * 16;
            bd.y = (dropAtHero ? targetY : midPt.y) + (Math.random() - 0.5) * 8;
            bd.vx = dropAtHero ? (Math.random() - 0.35) * 95 : -65 - Math.random() * 95;
            bd.vy = -35 - Math.random() * 65;
            bd.size = 2.5 + Math.random() * 2.3;
            bd.color = '#FACC15';
            bd.highlightColor = '#FEF9C3';
            bd.owner = 'spitter';
            bd.shapeKind = 'cone_droplet';
            bd.createdTurn = sim.currentTurn;
            bd.floorY = groundY + (Math.random() - 0.5) * 10;
            bd.life = 0;
            bd.maxLife = 0.68;
            bd.splatOnFloor = true;
            bd.hitCover = false;
            break;
          }
        }
      }
    }
  }

  ctx.restore();
}

/**
 * Renders persistent branching seismic ground fissures etched into the Neo-Prague
 * glass bridge deck when the Carapace Brute's Seismic Smash impacts the ground.
 * Fresh fissures glow molten amber-red and cool over 1–2 turns into dark deck fractures.
 */
function renderBruteGroundFissure(
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

  // 1. Crater scorch / shattered glass depression disc
  const craterGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, rx);
  craterGrad.addColorStop(0, `rgba(15, 23, 42, ${0.82 * f.alpha})`);
  craterGrad.addColorStop(0.55, `rgba(30, 41, 59, ${0.46 * f.alpha})`);
  craterGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = craterGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Molten underglow inside fresh fissure core
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

  // 3. Branching fractal cracks radiating across the glass bridge deck
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

    // Dark obsidian fracture trench
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3.6 * sc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Tempered glass edge cyan glint
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.52)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(mx * 0.4, my * 0.4 - 0.8);
    ctx.lineTo(ex, ey - 0.8);
    ctx.stroke();

    // Inner molten amber-gold seam while hot
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

