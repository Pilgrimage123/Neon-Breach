import type { AnimationCue, CombatState, HeroineState } from '../../engine/types';
import { triggerHeroineAnimation } from '../../utils/heroineSpriteSheet';
import {
  type ActorAnim,
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  type CombatStageSim,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  type PendingImpact,
  TEXT_POOL_SIZE,
  getBridgeGroundY,
  getEnemyLaneMetrics,
} from './combatStageTypes';

const GREEN_BLOOD_PALETTE = [
  '#84CC16',
  '#65A30D',
  '#A3E635',
  '#4D7C0F',
  '#3F6212',
  '#BEF264',
] as const;

const FLOOR_PUDDLE_PALETTE = [
  { color: '#65A30D', core: '#365314', highlight: '#BEF264' },
  { color: '#4D7C0F', core: '#1A2E05', highlight: '#A3E635' },
  { color: '#84CC16', core: '#3F6212', highlight: '#D9F99D' },
] as const;

const enemyWoundOrigins = new Map<string, { x: number; y: number; groundY: number }>();

export function spawnBurst(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  count: number,
  color: string,
  shape: number,
  speedScale = 1,
  jitter = 20,
  lifeBase = 0.35,
  lifeVar = 0.35,
  sizeBase = 2.5,
  sizeVar = 4,
): void {
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const spd = (80 + Math.random() * 210) * speedScale;
    p.active = true;
    p.x = jitter > 0 ? cx + (Math.random() - 0.5) * jitter : cx;
    p.y = jitter > 0 ? cy + (Math.random() - 0.5) * jitter : cy;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd - 45;
    p.life = 0;
    p.maxLife = lifeBase + Math.random() * lifeVar;
    p.size = sizeBase + Math.random() * sizeVar;
    p.color = color;
    p.shape = shape;
  }
}

export function getBridgeEdgeY(sim: CombatStageSim): number {
  if (sim.deckGradFrontY > 0) return sim.deckGradFrontY;
  return getBridgeGroundY(sim.size.h) + Math.round(sim.size.h * 0.032);
}

export function addOrFeedEdgeDrip(
  sim: CombatStageSim,
  x: number,
  edgeY: number,
  feedSize: number,
): void {
  const { w } = sim.size;
  const clampedX = Math.max(28, Math.min(w - 28, x));

  // Coalesce into an existing nearby edge drip so it swells thicker and pinches off heavy drops
  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const existing = sim.edgeDrips[i];
    if (!existing.active) continue;
    if (Math.abs(existing.x - clampedX) < 13) {
      existing.thickness = Math.min(7.2, existing.thickness + feedSize * 0.25);
      existing.maxLength = Math.min(64, existing.maxLength + feedSize * 2.4);
      existing.bulbPhase = Math.min(1, existing.bulbPhase + 0.36);
      existing.alpha = Math.min(0.95, existing.alpha + 0.38);
      existing.age = Math.max(0, existing.age * 0.55);
      return;
    }
  }

  const drip = sim.edgeDrips[sim.edgeDripCursor];
  sim.edgeDripCursor = (sim.edgeDripCursor + 1) % EDGE_DRIP_POOL_SIZE;
  const swatch = FLOOR_PUDDLE_PALETTE[sim.edgeDripCursor % FLOOR_PUDDLE_PALETTE.length];

  drip.active = true;
  drip.x = clampedX;
  drip.edgeY = edgeY;
  drip.length = 2.5 + Math.random() * 4.5;
  drip.maxLength = Math.min(62, 20 + feedSize * 3.8 + Math.random() * 24);
  drip.thickness = Math.max(2.6, Math.min(6.4, 2.2 + feedSize * 0.52));
  drip.bulbPhase = 0.18 + Math.random() * 0.32;
  // Sluggish viscous elongation speed (px/s)
  drip.stretchSpeed = 4.2 + Math.random() * 5.2;
  drip.detachedActive = false;
  drip.detachedY = edgeY + drip.length;
  drip.detachedVy = 0;
  drip.detachedRadius = 2.8;
  drip.detachedAlpha = 0;
  drip.alpha = 0.88 + Math.random() * 0.08;
  drip.age = 0;
  drip.lifespan = 18 + Math.random() * 14;
  drip.color = swatch.color;
  drip.coreColor = swatch.core;
  drip.highlightColor = swatch.highlight;
}

export function addOrGrowFloorBlood(
  sim: CombatStageSim,
  x: number,
  y: number,
  dropSize: number,
  initialRxBoost = 0,
): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const minDeckY = groundY - Math.round(h * 0.045);
  const maxDeckY = Math.max(edgeY, groundY + Math.round(h * 0.036));
  const clampedX = Math.max(24, Math.min(w - 24, x));
  const clampedY = Math.max(minDeckY, Math.min(maxDeckY, y));

  // If blood lands right at the front lip of the bridge, immediately feed a sluggish edge drip
  if (clampedY >= edgeY - 4.5) {
    addOrFeedEdgeDrip(sim, clampedX, edgeY, dropSize * 0.85 + initialRxBoost * 0.25);
  }

  // Merge into a nearby puddle if one is very close so pools swell and coalesce naturally
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const existing = sim.floorBlood[i];
    if (!existing.active) continue;
    if (Math.abs(existing.x - clampedX) < 15 && Math.abs(existing.y - clampedY) < 5.5) {
      existing.targetRx = Math.min(56, existing.targetRx + dropSize * 0.65 + initialRxBoost * 0.35);
      existing.targetRy = Math.min(14.5, existing.targetRy + dropSize * 0.18 + initialRxBoost * 0.1);
      existing.maxTendrilLen = Math.min(32, existing.maxTendrilLen + dropSize * 0.45);
      existing.flowVx += (Math.random() - 0.38) * 1.4;
      existing.flowVy = Math.min(4.2, existing.flowVy + 0.25);
      existing.alpha = Math.min(0.95, existing.alpha + 0.35);
      existing.age = Math.max(0, existing.age * 0.6);
      return;
    }
  }

  const puddle = sim.floorBlood[sim.floorBloodCursor];
  sim.floorBloodCursor = (sim.floorBloodCursor + 1) % FLOOR_BLOOD_POOL_SIZE;
  const swatch = FLOOR_PUDDLE_PALETTE[sim.floorBloodCursor % FLOOR_PUDDLE_PALETTE.length];
  const baseRx = 6.5 + dropSize * 1.65 + initialRxBoost + Math.random() * 6;
  const baseRy = Math.max(2.4, baseRx * (0.24 + Math.random() * 0.08));

  puddle.active = true;
  puddle.x = clampedX;
  puddle.y = clampedY;
  puddle.rx = Math.max(2, baseRx * 0.28);
  puddle.ry = Math.max(1, baseRy * 0.28);
  puddle.targetRx = Math.min(50, baseRx);
  puddle.targetRy = Math.min(13.5, baseRy);
  // Viscous creep along the floor deck (biased slightly outward/rightward and down the deck camber)
  puddle.flowVx = (Math.random() - 0.32) * 6.5;
  puddle.flowVy = 1.1 + Math.random() * 2.6;
  puddle.spreadRateX = 1.35 + Math.random() * 1.6;
  puddle.spreadRateY = 0.32 + Math.random() * 0.42;
  puddle.tendrilOffsetX1 = (Math.random() - 0.65) * baseRx * 0.7;
  puddle.tendrilOffsetX2 = (Math.random() - 0.25) * baseRx * 0.75;
  puddle.tendrilLen1 = 0.5;
  puddle.tendrilLen2 = 0.3;
  puddle.maxTendrilLen = 9 + Math.random() * 18;
  puddle.color = swatch.color;
  puddle.coreColor = swatch.core;
  puddle.highlightColor = swatch.highlight;
  puddle.age = 0;
  puddle.alpha = 0.86 + Math.random() * 0.08;
  puddle.dripSpawnCooldown = 0.35 + Math.random() * 0.45;
  puddle.lobeOffsetX = (Math.random() > 0.5 ? 1 : -1) * (baseRx * (0.38 + Math.random() * 0.25));
  puddle.lobeOffsetY = (Math.random() - 0.4) * baseRy * 0.55;
  puddle.lobeScale = 0.58 + Math.random() * 0.28;
}

function emitBloodDroplets(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorCenterY: number,
  count: number,
  intensity: number,
): void {
  const { h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const minDeckY = groundY - Math.round(h * 0.042);
  const maxDeckY = Math.max(edgeY, groundY + Math.round(h * 0.035));

  for (let i = 0; i < count; i++) {
    const d = sim.bloodDrops[sim.bloodDropCursor];
    sim.bloodDropCursor = (sim.bloodDropCursor + 1) % BLOOD_DROP_POOL_SIZE;

    // 68% spray in a pressurized arterial jet away from Kira (up-right / right), 32% back-splatter
    const forwardJet = i % 3 !== 0;
    const angle = forwardJet
      ? -0.78 * Math.PI + Math.random() * (0.92 * Math.PI) // upward & rightward arterial fan
      : -0.95 * Math.PI + (Math.random() - 0.5) * 0.75 * Math.PI; // back-splatter toward center

    const speed = (95 + Math.random() * 390) * (0.78 + intensity * 0.32);
    const floorY = Math.max(
      minDeckY,
      Math.min(maxDeckY, floorCenterY + (Math.random() - 0.38) * 32),
    );

    d.active = true;
    d.x = cx + (Math.random() - 0.5) * 26;
    d.y = cy + (Math.random() - 0.5) * 32;
    d.vx = Math.cos(angle) * speed + (forwardJet ? 55 * intensity : -25);
    d.vy = Math.sin(angle) * speed - (65 + Math.random() * 95);
    d.size = 2.4 + Math.random() * (3.8 + intensity * 1.4);
    d.color = GREEN_BLOOD_PALETTE[(sim.bloodDropCursor + i) % GREEN_BLOOD_PALETTE.length];
    d.floorY = floorY;
    d.life = 0;
    d.maxLife = 0.65 + Math.random() * 0.55;
    d.splatOnFloor = i % 5 !== 0;
  }
}

export function spawnGreenBloodSpray(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorCenterY: number,
  intensity = 1,
  isKo = false,
): void {
  const dropCount = Math.min(96, Math.round((isKo ? 64 : 38) * intensity));
  emitBloodDroplets(sim, cx, cy, floorCenterY, dropCount, intensity);

  // Also spawn immediate visceral mist & gory green chunks around the wound
  spawnBurst(
    sim,
    cx + 8,
    cy - 6,
    Math.round((isKo ? 22 : 14) * intensity),
    '#84CC16',
    2,
    0.95 * intensity,
    24,
    0.28,
    0.28,
    3,
    4.5,
  );
  spawnBurst(
    sim,
    cx + 14,
    cy + 4,
    Math.round((isKo ? 16 : 10) * intensity),
    '#4D7C0F',
    0,
    0.85 * intensity,
    22,
    0.32,
    0.3,
    3.5,
    5,
  );

  // Seed immediate floor splatter pools directly under/behind the wounded mutant
  const edgeY = getBridgeEdgeY(sim);
  const immediatePools = Math.round((isKo ? 6 : 3) * Math.max(1, intensity * 0.85));
  for (let k = 0; k < immediatePools; k++) {
    const px = cx + (Math.random() - 0.3) * (68 * intensity);
    const py = floorCenterY + (Math.random() - 0.35) * 24;
    addOrGrowFloorBlood(sim, px, py, 4.2 + Math.random() * 3.5, isKo ? 7 : 3.5);
  }

  // Seed 2-4 thick splatters right onto the front bridge curb so blood immediately beads & sluggishly drips over the edge
  const edgeSplats = Math.round((isKo ? 4 : 2) * Math.max(1, intensity * 0.85));
  for (let e = 0; e < edgeSplats; e++) {
    const ex = cx + (Math.random() - 0.38) * (76 * intensity);
    addOrGrowFloorBlood(sim, ex, edgeY - 1.5 + Math.random() * 2, 3.8 + Math.random() * 3.2, isKo ? 5 : 2.5);
  }
}

function triggerEnemyHitStagger(
  sim: CombatStageSim,
  enemyId: string,
  pos: { x: number; y: number; groundY: number },
  intensity = 1,
  isKo = false,
): void {
  const ea = ensureEnemyAnim(sim, enemyId);
  const dur = isKo ? 0.68 : Math.min(0.62, 0.38 + intensity * 0.11);
  ea.flashTimer = Math.max(ea.flashTimer, isKo ? 0.14 : 0.1);
  ea.staggerDuration = dur;
  ea.staggerTimer = dur;
  ea.staggerIntensity = Math.max(0.85, Math.min(2.1, intensity));
  ea.bleedSpurtTimer = 0.04;
  enemyWoundOrigins.set(enemyId, pos);
  spawnGreenBloodSpray(sim, pos.x, pos.y, pos.groundY, intensity, isKo);
}

function spawnFloatingText(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  text: string,
  color: string,
  scale = 1,
): void {
  const ft = sim.texts[sim.textCursor];
  sim.textCursor = (sim.textCursor + 1) % TEXT_POOL_SIZE;
  ft.active = true;
  ft.x = cx;
  ft.y = cy;
  ft.vy = -52;
  ft.life = 0;
  ft.maxLife = 0.95;
  ft.text = text;
  ft.color = color;
  ft.scale = scale;
}

export function spawnBolt(
  sim: CombatStageSim,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  color: string,
  onImpact?: () => void,
): void {
  const b = sim.bolts[sim.boltCursor];
  sim.boltCursor = (sim.boltCursor + 1) % BOLT_POOL_SIZE;
  const dist = Math.hypot(tx - sx, ty - sy);
  b.active = true;
  b.x = sx;
  b.y = sy;
  b.startX = sx;
  b.startY = sy;
  b.targetX = tx;
  b.targetY = ty;
  b.life = 0;
  b.maxLife = Math.max(0.08, Math.min(0.13, dist / 4600));
  b.color = color;
  b.onImpact = onImpact;
}

export function drainTriggerImpacts(
  sim: CombatStageSim,
  trigger: 'shot1' | 'shot2' | 'kick',
): (() => void) | undefined {
  const matched: PendingImpact[] = [];
  for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
    if (sim.pendingImpacts[i].triggerOn === trigger) {
      matched.unshift(sim.pendingImpacts[i]);
      sim.pendingImpacts.splice(i, 1);
    }
  }
  if (matched.length === 0) return undefined;
  return () => {
    for (let i = 0; i < matched.length; i++) {
      matched[i].execute();
    }
  };
}

function ensureEnemyAnim(sim: CombatStageSim, id: string): ActorAnim {
  let ea = sim.enemyAnims.get(id);
  if (!ea) {
    ea = {
      flashTimer: 0,
      lunge: 0,
      lungeDir: -1,
      koProgress: 0,
      dead: false,
      staggerTimer: 0,
      staggerDuration: 0.44,
      staggerIntensity: 1,
      bleedSpurtTimer: 0,
    };
    sim.enemyAnims.set(id, ea);
  }
  return ea;
}

export function applyCombatCues(
  sim: CombatStageSim,
  combat: CombatState,
  heroine: HeroineState,
): void {
  const cues: AnimationCue[] = combat.lastCues;
  if (!cues || cues.length === 0) {
    sim.lastCueBatchKey = '';
    return;
  }

  const batchKey = cues.map((c) => c.id).join('|');
  if (batchKey === sim.lastCueBatchKey) return;
  sim.lastCueBatchKey = batchKey;
  sim.needsRedraw = true;

  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const heroX = w * 0.22;
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, combat.enemies.length);

  const getEnemyPos = (targetId?: string): { x: number; y: number; groundY: number } => {
    const idx = combat.enemies.findIndex((e) => e.id === targetId);
    const safeIdx = idx >= 0 ? idx : 0;
    const staggerY = safeIdx % 2 === 1 ? -6 : 0;
    const enemyGroundY = groundY + staggerY;
    return {
      x: enemyBaseX + safeIdx * enemyStepX,
      y: enemyGroundY - 88,
      groundY: enemyGroundY,
    };
  };

  // Ensure every enemy has an ActorAnim entry up front so dying enemies stay visible until impact
  for (let i = 0; i < combat.enemies.length; i++) {
    ensureEnemyAnim(sim, combat.enemies[i].id);
  }

  // Flush any leftover un-triggered impacts if a new batch interrupts mid-clip
  if (sim.pendingImpacts.length > 0) {
    const toRun = sim.pendingImpacts.splice(0, sim.pendingImpacts.length);
    for (let i = 0; i < toRun.length; i++) toRun[i].execute();
  }

  const koIds = new Set(
    cues.filter((c) => c.kind === 'enemy_ko' && c.targetId).map((c) => c.targetId as string),
  );
  koIds.forEach((id) => {
    const ea = ensureEnemyAnim(sim, id);
    if (!ea.dead) {
      ea.koProgress = 0;
    }
  });

  const slashCues = cues.filter((c) => c.kind === 'hero_slash');
  const primarySlashCue = slashCues.find((c) => !c.id.endsWith('_def_pulse'));
  const hasOverdrive = cues.some((c) => c.kind === 'hero_overdrive');

  let primaryAttackMode: 'dash_kick' | 'shoot' | null = null;
  if (primarySlashCue) {
    const pos = getEnemyPos(primarySlashCue.targetId);
    sim.pendingShotTargetX = pos.x;
    sim.pendingShotTargetY = pos.y;
    sim.dashTargetX = pos.x;
    const useKick =
      Boolean(primarySlashCue.surge) ||
      (primarySlashCue.value ?? 0) >= 12 ||
      sim.attackToggle % 2 === 1;
    sim.attackToggle += 1;
    primaryAttackMode = useKick ? 'dash_kick' : 'shoot';
    sim.heroState = triggerHeroineAnimation(sim.heroState, primaryAttackMode);
  }

  const triggerEnemyKo = (enemyId: string) => {
    const ea = ensureEnemyAnim(sim, enemyId);
    ea.dead = true;
    ea.koProgress = Math.max(0.01, ea.koProgress);
    const pos = getEnemyPos(enemyId);
    triggerEnemyHitStagger(sim, enemyId, pos, 1.75, true);
    spawnBurst(sim, pos.x, pos.y, 28, '#84CC16', 1, 1.25);
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.kind === 'hero_slash') {
      const pos = getEnemyPos(cue.targetId);
      const isDefPulse = cue.id.endsWith('_def_pulse');
      if (cue.targetId) ensureEnemyAnim(sim, cue.targetId);

      if (isDefPulse) {
        sim.pendingImpacts.push({
          triggerOn: 'delay',
          delayRemaining: 0.11,
          execute: () => {
            spawnBolt(sim, heroX + 42, groundY - 96, pos.x, pos.y, '#00E5FF', () => {
              sim.pendingShotTargetX = pos.x;
              sim.pendingShotTargetY = pos.y;
              sim.trauma = Math.min(1, sim.trauma + 0.28);
              if (cue.targetId) {
                triggerEnemyHitStagger(
                  sim,
                  cue.targetId,
                  pos,
                  1.15,
                  koIds.has(cue.targetId),
                );
              }
              spawnBurst(sim, pos.x, pos.y, 16, '#00E5FF', 1, 1);
              if (cue.value) spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#38BDF8', 1.05);
              if (cue.targetId && koIds.has(cue.targetId)) triggerEnemyKo(cue.targetId);
            });
          },
        });
      } else if (primaryAttackMode === 'dash_kick') {
        sim.pendingImpacts.push({
          triggerOn: 'kick',
          delayRemaining: 0,
          execute: () => {
            sim.slashArcTimer = 0.28;
            sim.slashSurge = Boolean(cue.surge);
            sim.hitstop = cue.surge ? 0.06 : 0.04;
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.68 : 0.46));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                cue.surge ? 1.65 : 1.35,
                koIds.has(cue.targetId),
              );
            }
            spawnBurst(sim, pos.x, pos.y, cue.surge ? 26 : 16, '#FF3B7F', 1, cue.surge ? 1.25 : 1);
            if (cue.value) {
              spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#FF6B9E', cue.surge ? 1.3 : 1.05);
            }
            if (cue.targetId && koIds.has(cue.targetId)) triggerEnemyKo(cue.targetId);
          },
        });
      } else {
        sim.pendingImpacts.push({
          triggerOn: 'shot1',
          delayRemaining: 0,
          execute: () => {
            sim.slashArcTimer = 0.26;
            sim.slashSurge = Boolean(cue.surge);
            sim.hitstop = cue.surge ? 0.048 : 0.028;
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.56 : 0.36));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                cue.surge ? 1.35 : 1.08,
                false,
              );
            }
            spawnBurst(sim, pos.x, pos.y, cue.surge ? 22 : 14, '#FF3B7F', 1, cue.surge ? 1.2 : 1);
            if (cue.value) {
              spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#FF6B9E', cue.surge ? 1.3 : 1.05);
            }
          },
        });
        sim.pendingImpacts.push({
          triggerOn: 'shot2',
          delayRemaining: 0,
          execute: () => {
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                cue.surge ? 1.45 : 1.18,
                koIds.has(cue.targetId),
              );
            }
            spawnBurst(sim, pos.x, pos.y, 12, '#00E5FF', 1, 0.95);
            if (cue.targetId && koIds.has(cue.targetId)) triggerEnemyKo(cue.targetId);
          },
        });
      }
    } else if (cue.kind === 'hero_shield') {
      sim.heroState = triggerHeroineAnimation(sim.heroState, 'guard');
      sim.shieldDomeTimer = 0.48;
      spawnBurst(sim, heroX, groundY - 95, cue.surge ? 20 : 12, '#00E5FF', 1, 0.85);
      if (cue.value) {
        spawnFloatingText(sim, heroX, groundY - 150, `+${cue.value} SHD`, '#38BDF8', 1.05);
      }
    } else if (cue.kind === 'hero_tech') {
      sim.heroState = triggerHeroineAnimation(sim.heroState, 'upgrade');
      sim.upgradeBeamTimer = 0.55;
      spawnBurst(sim, heroX, groundY - 95, cue.surge ? 22 : 14, '#FFB800', 1, 0.9);
      spawnFloatingText(
        sim,
        heroX,
        groundY - 155,
        cue.textLabel || (cue.surge ? 'TECH SURGE' : 'TECH'),
        '#FCD34D',
        1.05,
      );
    } else if (cue.kind === 'hero_overdrive') {
      const livingOrKo = combat.enemies.filter((e) => e.hp > 0 || koIds.has(e.id));
      const frontTarget = livingOrKo[0];
      const frontPos = getEnemyPos(frontTarget?.id);
      sim.pendingShotTargetX = frontPos.x;
      sim.pendingShotTargetY = frontPos.y;
      sim.dashTargetX = frontPos.x;
      sim.heroState = triggerHeroineAnimation(sim.heroState, 'overdrive');

      for (const e of livingOrKo) ensureEnemyAnim(sim, e.id);

      sim.pendingImpacts.push({
        triggerOn: 'kick',
        delayRemaining: 0,
        execute: () => {
          sim.overdriveTimer = 0.68;
          sim.hitstop = 0.055;
          sim.trauma = 0.78;
          for (const enemy of livingOrKo) {
            const pos = getEnemyPos(enemy.id);
            triggerEnemyHitStagger(sim, enemy.id, pos, 1.5, false);
            spawnBurst(sim, pos.x, pos.y, 18, '#FF3B7F', 1, 1.2);
          }
        },
      });

      sim.pendingImpacts.push({
        triggerOn: 'shot1',
        delayRemaining: 0,
        execute: () => {
          sim.trauma = Math.min(1, sim.trauma + 0.45);
          for (const enemy of livingOrKo) {
            const pos = getEnemyPos(enemy.id);
            triggerEnemyHitStagger(sim, enemy.id, pos, 1.55, false);
            spawnBurst(sim, pos.x, pos.y, 22, '#FFB800', 1, 1.25);
            spawnFloatingText(sim, pos.x, pos.y - 45, `-${cue.value ?? 22}`, '#FDE047', 1.35);
          }
        },
      });

      sim.pendingImpacts.push({
        triggerOn: 'shot2',
        delayRemaining: 0,
        execute: () => {
          for (const enemy of livingOrKo) {
            const pos = getEnemyPos(enemy.id);
            if (koIds.has(enemy.id)) {
              triggerEnemyKo(enemy.id);
            } else {
              triggerEnemyHitStagger(sim, enemy.id, pos, 1.35, false);
            }
          }
        },
      });
    } else if (cue.kind === 'enemy_attack' || cue.kind === 'enemy_acid') {
      if (cue.targetId) {
        const ea = ensureEnemyAnim(sim, cue.targetId);
        ea.lunge = 1;
        ea.lungeDir = -1;
      }
      const blocked = cue.blocked ?? 0;
      const hpDamage = cue.hpDamage ?? (cue.value ?? 0);
      const reflected = cue.reflectedDamage ?? 0;
      const isAcid = cue.kind === 'enemy_acid';
      const isLethal = heroine.hp <= 0;
      const lowHp = heroine.hp <= heroine.maxHp * 0.35;

      if (isLethal) {
        sim.heroState = triggerHeroineAnimation(sim.heroState, 'defeat');
      }

      sim.pendingImpacts.push({
        triggerOn: 'delay',
        delayRemaining: 0.085,
        execute: () => {
          if (!isLethal) {
            if (hpDamage === 0) {
              sim.heroState = triggerHeroineAnimation(sim.heroState, 'guard');
              sim.shieldDomeTimer = 0.46;
              sim.trauma = Math.min(1, sim.trauma + 0.14);
              spawnBurst(sim, heroX + 38, groundY - 95, 16, '#00E5FF', 1, 0.9);
              if (isAcid) {
                spawnBurst(sim, heroX + 44, groundY - 82, 8, '#84CC16', 2, 0.65);
              }
              spawnFloatingText(sim, heroX, groundY - 145, 'BLOCKED', '#38BDF8', 0.95);
            } else {
              if (blocked > 0) {
                sim.shieldDomeTimer = 0.25;
                spawnBurst(sim, heroX + 32, groundY - 95, 10, '#00E5FF', 1, 0.85);
              }
              sim.heroState = triggerHeroineAnimation(sim.heroState, 'hit', { lowHpHit: lowHp });
              sim.heroAnim.flashTimer = 0.085;
              sim.trauma = Math.min(1, sim.trauma + 0.35);
              spawnBurst(sim, heroX, groundY - 85, 14, isAcid ? '#84CC16' : '#FB7185', isAcid ? 2 : 0, 0.9);
              spawnFloatingText(sim, heroX, groundY - 140, `-${hpDamage}`, isAcid ? '#A3E635' : '#FDA4AF', 1.0);
            }
          } else {
            sim.heroAnim.flashTimer = 0.1;
            sim.trauma = Math.min(1, sim.trauma + 0.55);
            spawnBurst(sim, heroX, groundY - 80, 20, isAcid ? '#84CC16' : '#FB7185', isAcid ? 2 : 0, 1.0);
            if (hpDamage > 0) {
              spawnFloatingText(sim, heroX, groundY - 140, `-${hpDamage}`, '#FB7185', 1.15);
            }
          }

          if (reflected > 0 && cue.targetId) {
            const targetId = cue.targetId;
            const attackerPos = getEnemyPos(targetId);
            triggerEnemyHitStagger(sim, targetId, attackerPos, 1.1, koIds.has(targetId));
            spawnBurst(sim, attackerPos.x, attackerPos.y, 12, '#00E5FF', 1, 0.9);
            spawnFloatingText(sim, attackerPos.x, attackerPos.y - 40, `-${reflected}`, '#38BDF8', 0.95);
            if (koIds.has(targetId)) triggerEnemyKo(targetId);
          }
        },
      });
    } else if (cue.kind === 'enemy_armor') {
      const pos = getEnemyPos(cue.targetId);
      spawnBurst(sim, pos.x, pos.y, 10, '#A3E635', 1, 0.7);
      if (cue.value) {
        spawnFloatingText(sim, pos.x, pos.y - 35, `+${cue.value} ARM`, '#BEF264', 0.95);
      }
    } else if (cue.kind === 'enemy_ko' && cue.targetId && !primarySlashCue && !hasOverdrive) {
      const targetId = cue.targetId;
      if (
        !cues.some((c) => (c.kind === 'enemy_attack' || c.kind === 'enemy_acid') && c.targetId === targetId) &&
        !cues.some((c) => c.kind === 'hero_slash' && c.targetId === targetId)
      ) {
        triggerEnemyKo(targetId);
      }
    }
  }
}

export function stepCombatSimulation(sim: CombatStageSim, dt: number): number {
  sim.trauma = Math.max(0, sim.trauma - dt * 2.4);
  if (sim.heroAnim.flashTimer > 0) sim.heroAnim.flashTimer = Math.max(0, sim.heroAnim.flashTimer - dt);
  sim.enemyAnims.forEach((ea) => {
    if (ea.flashTimer > 0) ea.flashTimer = Math.max(0, ea.flashTimer - dt);
  });

  let simDt = dt;
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - dt);
    simDt = 0;
  }

  sim.slashArcTimer = Math.max(0, sim.slashArcTimer - simDt);
  sim.kickWaveTimer = Math.max(0, sim.kickWaveTimer - simDt);
  sim.shieldDomeTimer = Math.max(0, sim.shieldDomeTimer - simDt);
  sim.upgradeBeamTimer = Math.max(0, sim.upgradeBeamTimer - simDt);
  sim.overdriveTimer = Math.max(0, sim.overdriveTimer - simDt);

  for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
    const pi = sim.pendingImpacts[i];
    if (pi.triggerOn !== 'delay') continue;
    pi.delayRemaining -= simDt;
    if (pi.delayRemaining <= 0) {
      sim.pendingImpacts.splice(i, 1);
      pi.execute();
    }
  }

  sim.enemyAnims.forEach((ea, enemyId) => {
    ea.lunge = Math.max(0, ea.lunge - simDt * 5.2);
    if (ea.staggerTimer > 0) {
      ea.staggerTimer = Math.max(0, ea.staggerTimer - simDt);
    }
    if (ea.dead && ea.koProgress < 1) {
      // Slower, more visceral KO dissolve so full hit, stagger & arterial bleeding are clearly shown
      ea.koProgress = Math.min(1, ea.koProgress + simDt * 1.45);
    }

    // Continuous secondary arterial spurts while staggering or collapsing
    if (simDt > 0 && (ea.staggerTimer > 0.08 || (ea.dead && ea.koProgress < 0.78))) {
      ea.bleedSpurtTimer -= simDt;
      if (ea.bleedSpurtTimer <= 0) {
        ea.bleedSpurtTimer = 0.045 + Math.random() * 0.035;
        const origin = enemyWoundOrigins.get(enemyId);
        if (origin) {
          emitBloodDroplets(
            sim,
            origin.x + 10,
            origin.y + (ea.dead ? ea.koProgress * 18 : 0),
            origin.groundY,
            ea.dead ? 7 : 5,
            ea.staggerIntensity * 0.85,
          );
        }
      }
    }
  });

  for (let i = 0; i < sim.motes.length; i++) {
    const m = sim.motes[i];
    m.x = (m.x + m.vx * simDt) % 1;
    m.y += m.vy * simDt;
    if (m.y < 0.05) m.y = 0.85;
  }

  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const p = sim.particles[i];
    if (!p.active) continue;
    p.life += simDt;
    if (p.life >= p.maxLife) {
      p.active = false;
      continue;
    }
    p.x += p.vx * simDt;
    p.y += p.vy * simDt;
    p.vy += 280 * simDt;
  }

  // Step airborne greenish blood droplets -> splat into floor puddles on impact
  for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
    const d = sim.bloodDrops[i];
    if (!d.active) continue;
    d.life += simDt;
    if (d.life >= d.maxLife) {
      if (d.splatOnFloor) {
        addOrGrowFloorBlood(sim, d.x, d.floorY, d.size * 0.85);
      }
      d.active = false;
      continue;
    }
    d.x += d.vx * simDt;
    d.y += d.vy * simDt;
    d.vx *= Math.max(0, 1 - 1.15 * simDt);
    d.vy += 640 * simDt;

    if (d.vy > 0 && d.y >= d.floorY) {
      if (d.splatOnFloor) {
        addOrGrowFloorBlood(sim, d.x, d.floorY, d.size);
      }
      d.active = false;
    }
  }

  // Step persistent, slowly flowing floor blood puddles & edge spillover
  const { w, h } = sim.size;
  const edgeY = getBridgeEdgeY(sim);
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    const fp = sim.floorBlood[i];
    if (!fp.active) continue;
    fp.age += simDt;

    // Rapid initial splat expansion followed by continuous slow viscous spreading & flowing
    const expandRate = Math.min(1, simDt * 16);
    fp.rx += (fp.targetRx - fp.rx) * expandRate;
    fp.ry += (fp.targetRy - fp.ry) * expandRate;

    const viscousFlowFactor = 1 / (1 + fp.age * 0.045);
    fp.x = Math.max(20, Math.min(w - 20, fp.x + fp.flowVx * viscousFlowFactor * simDt));
    fp.y = Math.min(edgeY, fp.y + fp.flowVy * viscousFlowFactor * simDt);
    fp.targetRx = Math.min(58, fp.targetRx + fp.spreadRateX * viscousFlowFactor * simDt);
    fp.targetRy = Math.min(15, fp.targetRy + fp.spreadRateY * viscousFlowFactor * simDt);
    fp.tendrilLen1 = Math.min(
      fp.maxTendrilLen,
      fp.tendrilLen1 + 2.8 * viscousFlowFactor * simDt,
    );
    fp.tendrilLen2 = Math.min(
      fp.maxTendrilLen * 0.82,
      fp.tendrilLen2 + 2.1 * viscousFlowFactor * simDt,
    );

    // When a floor puddle or its creeping tendrils reach the front bridge edge, it feeds sluggish edge drips
    const frontReachY =
      fp.y + fp.ry * 0.45 + Math.max(fp.tendrilLen1, fp.tendrilLen2) * 0.42;
    if (frontReachY >= edgeY - 3.5) {
      fp.dripSpawnCooldown -= simDt;
      if (fp.dripSpawnCooldown <= 0 && fp.alpha > 0.16) {
        fp.dripSpawnCooldown = 1.05 + Math.random() * 0.85;
        const offsetX =
          fp.tendrilLen1 >= fp.tendrilLen2 ? fp.tendrilOffsetX1 : fp.tendrilOffsetX2;
        addOrFeedEdgeDrip(
          sim,
          fp.x + offsetX * 0.65,
          edgeY,
          Math.max(2.4, fp.ry * 0.5),
        );
      }
      // Puddle slowly loses volume as it drains over the bridge edge
      fp.alpha -= 0.024 * simDt;
    }

    // Very slow disappearance (bio-dissolution / evaporation) over time
    if (fp.age > 7) {
      fp.alpha -= 0.018 * simDt;
    }
    if (fp.alpha <= 0.015) {
      fp.active = false;
    }
  }

  // Step thick greenish blood sluggishly dripping from the bridge edge & very slowly disappearing
  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    const drip = sim.edgeDrips[i];
    if (!drip.active) continue;
    drip.edgeY = edgeY;
    drip.age += simDt;

    // Non-linear viscous elongation (slows down as the heavy slimy column stretches longer)
    const viscosityDrag = 1 / (1 + drip.length * 0.05);
    const fadeSlowdown = Math.max(0.22, drip.alpha);
    drip.length = Math.min(
      drip.maxLength,
      drip.length + drip.stretchSpeed * viscosityDrag * fadeSlowdown * simDt,
    );

    // Swelling pendant bulb at the tip that sluggishly pinches off a falling globule
    if (drip.alpha > 0.22 && drip.length > 7) {
      drip.bulbPhase += simDt * (0.24 + drip.thickness * 0.036) * fadeSlowdown;
      if (drip.bulbPhase >= 1) {
        drip.bulbPhase = 0;
        if (!drip.detachedActive) {
          drip.detachedActive = true;
          drip.detachedY = drip.edgeY + drip.length + 2;
          // Starts very sluggishly as it pulls free from the thick viscous thread
          drip.detachedVy = 7 + Math.random() * 9;
          drip.detachedRadius = Math.max(2.1, drip.thickness * 0.72);
          drip.detachedAlpha = drip.alpha * 0.94;
          // Viscous thread recoils slightly and thins after pinch-off
          drip.length = Math.max(5.5, drip.length * 0.76);
          drip.thickness = Math.max(1.5, drip.thickness * 0.91);
        }
      }
    }

    // Step detached globule falling sluggishly into the abyss below the bridge
    if (drip.detachedActive) {
      drip.detachedVy = Math.min(82, drip.detachedVy + 92 * simDt);
      drip.detachedY += drip.detachedVy * simDt;
      drip.detachedAlpha -= simDt * 0.52;
      if (drip.detachedAlpha <= 0.02 || drip.detachedY > h + 18) {
        drip.detachedActive = false;
      }
    }

    // Very slow disappearance of the hanging edge streamer
    if (drip.age > 5.5) {
      const fadeRate = 1 / Math.max(10, drip.lifespan);
      drip.alpha -= fadeRate * simDt;
      drip.thickness = Math.max(1.1, drip.thickness - 0.042 * simDt);
    }
    if (drip.alpha <= 0.015 && !drip.detachedActive) {
      drip.active = false;
    }
  }

  for (let i = 0; i < BOLT_POOL_SIZE; i++) {
    const b = sim.bolts[i];
    if (!b.active) continue;
    b.life += simDt;
    if (b.life >= b.maxLife) {
      b.active = false;
      if (b.onImpact) {
        const cb = b.onImpact;
        b.onImpact = undefined;
        cb();
      }
      continue;
    }
    const tNorm = Math.min(1, b.life / b.maxLife);
    b.x = b.startX + (b.targetX - b.startX) * tNorm;
    b.y = b.startY + (b.targetY - b.startY) * tNorm;
  }

  for (let i = sim.ghosts.length - 1; i >= 0; i--) {
    sim.ghosts[i].alpha -= simDt * 4.5;
    if (sim.ghosts[i].alpha <= 0.02) {
      sim.ghosts.splice(i, 1);
    }
  }

  for (let i = 0; i < TEXT_POOL_SIZE; i++) {
    const ft = sim.texts[i];
    if (!ft.active) continue;
    ft.life += simDt;
    if (ft.life >= ft.maxLife) {
      ft.active = false;
      continue;
    }
    ft.y += ft.vy * simDt;
    ft.vy *= 0.94;
  }

  return simDt;
}
