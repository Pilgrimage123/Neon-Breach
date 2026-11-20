import { soundEngine } from '../../audio/soundEngine';
import type { CombatState, HeroState, TileType, TurnPreview } from '../../engine/types';
import type { BruteJuiceConfig } from '../../utils/bruteJuiceController';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { HEROINE_DODGE_DURATION } from '../../utils/kiraSpriteSheet';
import type { SpitterJuiceConfig } from '../../utils/spitterJuiceController';
import {
  addCoverBloodDecal,
  addOrFeedEdgeDrip,
  addOrGrowFloorBlood,
  emitBloodDroplets,
  getBridgeBackY,
  getBridgeEdgeY,
  spawnAlienBloodImpact,
  spawnScreenBloodSpray,
  spawnStatusTrail,
  stepBloodSimulation,
  syncCombatBloodState,
} from './combatBloodSimulation';
import {
  type ApplyCombatCuesOptions,
  applyCombatCues,
} from './combatCueDispatcher';
import {
  emitSpitterStreamParticles,
  getEnemyStaggerKinematics,
  stepEnemyAnimationSamples,
  type StaggerKinematics,
  type StepEnemyAnimationOptions,
} from './combatEnemyAnimationSim';
import type { ProjectileVisualProfile } from './combatStagingClassifier';
import {
  BOLT_POOL_SIZE,
  FLOOR_FISSURE_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  TEXT_POOL_SIZE,
  type ActorAnim,
  type CombatStageSim,
  type PendingImpact,
  getBridgeGroundY,
} from './combatStageTypes';
import type { BloodOwnerKind, WeaponDecalKind } from './mutantBlood';

export {
  addCoverBloodDecal,
  addOrFeedEdgeDrip,
  addOrGrowFloorBlood,
  applyCombatCues,
  emitBloodDroplets,
  emitSpitterStreamParticles,
  getBridgeBackY,
  getBridgeEdgeY,
  getEnemyStaggerKinematics,
  spawnAlienBloodImpact,
  spawnScreenBloodSpray,
  spawnStatusTrail,
  stepBloodSimulation,
  stepEnemyAnimationSamples,
  syncCombatBloodState,
  type ApplyCombatCuesOptions,
  type StaggerKinematics,
  type StepEnemyAnimationOptions,
};

export function triggerKiraDodgeVfx(
  sim: CombatStageSim,
  liveHeroX: number,
  groundY: number,
): void {
  sim.heroState = triggerCharacterAnimation(sim.heroState, 'dodge', 'kira');
  sim.shieldDomeTimer = 0;
  sim.dodgeZoomTimer = HEROINE_DODGE_DURATION;
  sim.trauma = Math.min(1, sim.trauma + 0.05);
  soundEngine.playDodgeWhoosh();

  spawnBurst(sim, liveHeroX + 6, groundY - 26, 14, '#00F0FF', 1, 1.02);
  spawnBurst(sim, liveHeroX - 4, groundY - 46, 8, '#F472B6', 0, 0.85);
  spawnFloatingText(sim, liveHeroX - 6, groundY - 164, 'MISS', '#00F0FF', 1.24);

  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.24,
    execute: () => {
      spawnBurst(sim, liveHeroX - 36, groundY - 6, 12, '#00F0FF', 1, 0.94);
      spawnBurst(sim, liveHeroX - 52, groundY - 3, 7, '#38BDF8', 0, 0.80);
    },
  });

  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.48,
    execute: () => {
      spawnBurst(sim, liveHeroX - 64, groundY - 5, 11, '#00F0FF', 1, 0.88);
      spawnBurst(sim, liveHeroX - 48, groundY - 4, 6, '#F472B6', 0, 0.74);
    },
  });

  sim.pendingImpacts.push({
    triggerOn: 'delay',
    delayRemaining: 0.68,
    execute: () => {
      spawnBurst(sim, liveHeroX - 24, groundY - 3, 13, '#38BDF8', 1, 0.88);
      spawnBurst(sim, liveHeroX - 8, groundY - 2, 7, '#FDE047', 1, 0.68);
    },
  });
}

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
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = shape === 1 ? (Math.random() - 0.5) * 10 : 0;
    p.gravity = 280;
    p.floorY = 9999;
    p.bounced = false;
  }
}

export function addGroundFissure(
  sim: CombatStageSim,
  x: number,
  y: number,
  scale = 1,
  heatIntensity = 1,
): void {
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const edgeY = getBridgeEdgeY(sim);
  const backY = getBridgeBackY(sim);
  const clampedX = Math.max(36, Math.min(w - 36, x));
  const clampedY = Math.max(backY + 4, Math.min(Math.max(groundY + 12, edgeY - 4), y));

  const fissure = sim.floorFissures[sim.floorFissureCursor];
  sim.floorFissureCursor = (sim.floorFissureCursor + 1) % FLOOR_FISSURE_POOL_SIZE;
  fissure.active = true;
  fissure.x = clampedX;
  fissure.y = clampedY;
  fissure.scale = Math.max(0.65, Math.min(1.6, scale));
  fissure.seed = (fissure.seed + 1.37) % 100 || Math.random() * 50;
  fissure.createdTurn = sim.currentTurn;
  fissure.visualTurnAge = 0;
  fissure.age = 0;
  fissure.alpha = 0.96;
  fissure.heatIntensity = Math.max(0.2, Math.min(1.25, heatIntensity));
}

export function spawnBruteKineticShards(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  floorY: number,
  count: number,
  palette: 'seismic' | 'chitin' | 'vial' = 'seismic',
  dir = -1,
): void {
  const colors =
    palette === 'chitin'
      ? ['#FB923C', '#EA580C', '#FDBA74', '#FEF3C7']
      : palette === 'vial'
        ? ['#4ADE80', '#22C55E', '#A7F3D0', '#E0F2FE']
        : ['#67E8F9', '#E0F2FE', '#FB923C', '#FACC15'];
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const spreadAngle =
      palette === 'seismic'
        ? -Math.PI * 0.5 + (Math.random() - 0.5) * 1.95
        : -Math.PI * 0.48 + dir * 0.32 + (Math.random() - 0.5) * 1.5;
    const spd =
      palette === 'seismic'
        ? 110 + Math.random() * 210
        : palette === 'chitin'
          ? 125 + Math.random() * 220
          : 75 + Math.random() * 140;
    p.active = true;
    p.x = cx + (Math.random() - 0.5) * (palette === 'seismic' ? 42 : 24);
    p.y = cy + (Math.random() - 0.5) * 12;
    p.vx = Math.cos(spreadAngle) * spd;
    p.vy = Math.sin(spreadAngle) * spd - (palette === 'seismic' ? 75 : 55);
    p.life = 0;
    p.maxLife = 0.52 + Math.random() * 0.42;
    p.size = palette === 'seismic' ? 3.8 + Math.random() * 4.5 : 3.2 + Math.random() * 4.0;
    p.color = colors[i % colors.length];
    p.shape = 3;
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = (Math.random() - 0.5) * 18;
    p.gravity = 540;
    p.floorY = floorY + (Math.random() - 0.5) * 6;
    p.bounced = false;
  }
}

export function spawnBruteMutagenMist(
  sim: CombatStageSim,
  cx: number,
  cy: number,
  count: number,
  intensity = 1,
): void {
  const mistColors = ['#A3E635', '#4ADE80', '#BEF264', '#22C55E'];
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.1;
    const spd = (28 + Math.random() * 64) * Math.max(0.75, intensity);
    p.active = true;
    p.x = cx + (Math.random() - 0.5) * 26;
    p.y = cy + (Math.random() - 0.5) * 18;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd - 24;
    p.life = 0;
    p.maxLife = 0.72 + Math.random() * 0.58;
    p.size = (12 + Math.random() * 14) * Math.max(0.85, Math.min(1.4, intensity));
    p.color = mistColors[i % mistColors.length];
    p.shape = 4;
    p.rot = Math.random() * Math.PI * 2;
    p.vRot = (Math.random() - 0.5) * 1.4;
    p.gravity = -42;
    p.floorY = 9999;
    p.bounced = false;
  }
}

export function triggerEnemyHitStagger(
  sim: CombatStageSim,
  enemyId: string,
  pos: { x: number; y: number; groundY: number },
  owner: BloodOwnerKind = 'larva',
  weaponKind: WeaponDecalKind = 'kinetic',
  intensity = 1,
  isKo = false,
  dirX = 1,
  plasmaColor = '#00F0FF',
): void {
  const ea = ensureEnemyAnim(sim, enemyId);
  const dur = isKo ? 0.68 : Math.min(0.62, 0.38 + intensity * 0.11);
  ea.flashTimer = Math.max(ea.flashTimer, isKo ? 0.14 : 0.1);
  ea.staggerDuration = dur;
  ea.staggerTimer = dur;
  ea.staggerIntensity = Math.max(0.85, Math.min(2.1, intensity));
  ea.bleedSpurtTimer = 0.04;
  sim.enemyWoundOrigins.set(enemyId, { ...pos, owner });
  spawnAlienBloodImpact(
    sim,
    pos.x,
    pos.y,
    pos.groundY,
    owner,
    weaponKind,
    intensity,
    isKo,
    dirX,
    plasmaColor,
  );
}

export function spawnFloatingText(
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
  style: ProjectileVisualProfile = 'pistol_bolt',
  durationOverrideSec?: number,
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
  b.maxLife =
    durationOverrideSec !== undefined
      ? Math.max(0.06, Math.min(0.45, durationOverrideSec))
      : Math.max(0.08, Math.min(0.14, dist / 4400));
  b.color = color;
  b.style = style;
  b.onImpact = onImpact;
}

export function spawnStyledProjectileVolley(
  sim: CombatStageSim,
  params: {
    profile: ProjectileVisualProfile;
    sx: number;
    sy: number;
    tx: number;
    ty: number;
    isCrit?: boolean;
    isOverdrive?: boolean;
    flightSec?: number;
    onPrimaryImpact?: () => void;
  },
): void {
  const {
    profile,
    sx,
    sy,
    tx,
    ty,
    isCrit = false,
    isOverdrive = false,
    flightSec,
    onPrimaryImpact,
  } = params;

  if (profile === 'scattergun') {
    const pellets = isOverdrive || isCrit ? [-16, -6, 4, 14, 22] : [-13, -4, 5, 14];
    for (let i = 0; i < pellets.length; i++) {
      const spreadY = pellets[i];
      const color = i === 0 ? '#FFE066' : i % 2 === 1 ? '#FFC700' : '#FF6B35';
      spawnBolt(
        sim,
        sx + (i % 2 === 0 ? 0 : -4),
        sy + spreadY * 0.28,
        tx + (i - 1.5) * 4,
        ty + spreadY,
        color,
        i === 0 ? onPrimaryImpact : undefined,
        'scattergun',
        flightSec !== undefined ? flightSec * (0.94 + i * 0.03) : undefined,
      );
    }
    spawnBurst(sim, sx, sy, isCrit ? 16 : 11, '#FFC700', 0, isCrit ? 1.15 : 0.95);
    return;
  }

  if (profile === 'drone_plasma') {
    spawnBolt(sim, sx, sy - 3.5, tx, ty - 4, '#FF2E7E', onPrimaryImpact, 'drone_plasma', flightSec);
    spawnBolt(sim, sx - 5, sy + 4, tx, ty + 4, '#FFC700', undefined, 'drone_plasma', flightSec);
    if (isCrit || isOverdrive) {
      spawnBolt(sim, sx - 2, sy, tx, ty, '#00F0FF', undefined, 'drone_plasma', flightSec);
    }
    spawnBurst(sim, sx, sy, isCrit ? 14 : 9, '#FF2E7E', 1, isCrit ? 1.1 : 0.92);
    return;
  }

  if (profile === 'acid_bile') {
    spawnBolt(sim, sx, sy, tx, ty, '#A3E635', onPrimaryImpact, 'acid_bile', flightSec);
    spawnBolt(
      sim,
      sx + 6,
      sy + 5,
      tx + 4,
      ty + 7,
      '#FACC15',
      undefined,
      'acid_bile',
      flightSec !== undefined ? flightSec * 1.08 : undefined,
    );
    spawnBurst(sim, sx - 6, sy, 12, '#FACC15', 2, 0.95);
    return;
  }

  if (profile === 'stinger_dart') {
    const darts = isCrit ? [-12, 0, 12] : [-8, 8];
    for (let i = 0; i < darts.length; i++) {
      const dy = darts[i];
      const color = i === 1 ? '#FDBA74' : '#FB923C';
      spawnBolt(
        sim,
        sx + i * 5,
        sy + dy * 0.35,
        tx,
        ty + dy,
        color,
        i === 0 ? onPrimaryImpact : undefined,
        'stinger_dart',
        flightSec !== undefined ? flightSec * (0.94 + i * 0.04) : undefined,
      );
    }
    spawnBurst(sim, sx - 4, sy, 14, '#FB923C', 1, 1.05);
    return;
  }

  spawnBolt(
    sim,
    sx,
    sy,
    tx,
    ty,
    isOverdrive || isCrit ? '#FFC700' : '#00F0FF',
    onPrimaryImpact,
    'pistol_bolt',
    flightSec,
  );
  spawnBurst(sim, sx, sy, 8, '#FDE047', 0, 0.85);
}

export function drainTriggerImpacts(
  sim: CombatStageSim,
  trigger: 'shot1' | 'shot2' | 'kick' | 'cutin_impact',
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

export function ensureEnemyAnim(sim: CombatStageSim, id: string): ActorAnim {
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
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0,
      bristleDuration: 0.5,
      bristleKind: 'armor',
    };
    sim.enemyAnims.set(id, ea);
  }
  return ea;
}

export interface StepCombatSimulationOptions {
  tacticalViewActive?: boolean;
  reducedMotion?: boolean;
  idleZoom?: number;
  idlePanX?: number;
  idlePanY?: number;
  combat?: CombatState;
  hero?: HeroState;
  hoveredColor?: TileType | null;
  activePreview?: TurnPreview | null;
  projectedShield?: number;
  elapsed?: number;
  spitterJuiceConfig?: SpitterJuiceConfig;
  spitterLabActive?: boolean;
  bruteJuiceConfig?: BruteJuiceConfig;
  bruteLabActive?: boolean;
}

export function stepCombatSimulation(
  sim: CombatStageSim,
  dt: number,
  options?: StepCombatSimulationOptions,
): number {
  const seqFrame = sim.actionSequencer.step(dt, sim.size.w, sim.size.h, {
    tacticalViewActive: Boolean(options?.tacticalViewActive),
    reducedMotion: Boolean(options?.reducedMotion),
    idleZoom: options?.idleZoom,
    idlePanX: options?.idlePanX,
    idlePanY: options?.idlePanY,
  });
  sim.lastSeqFrame = seqFrame;
  sim.cameraZoom = seqFrame.cameraZoom;
  sim.cameraPanX = seqFrame.cameraPanX;
  sim.cameraPanY = seqFrame.cameraPanY;
  sim.cameraRotRad = seqFrame.cameraRotRad;

  if (sim.dodgeZoomTimer > 0 && !seqFrame.active && !options?.tacticalViewActive && !options?.reducedMotion) {
    const dodgeU = Math.max(0, Math.min(1, 1 - sim.dodgeZoomTimer / HEROINE_DODGE_DURATION));
    const dodgePulse = Math.sin(dodgeU * Math.PI);
    const nextZoom = Math.min(1.32, sim.cameraZoom + 0.08 * dodgePulse);
    const heroFocusPanX = sim.size.w * 0.075 * dodgePulse;
    const heroFocusPanY = -sim.size.h * 0.025 * dodgePulse;
    sim.cameraZoom = nextZoom;
    sim.cameraPanX += heroFocusPanX;
    sim.cameraPanY += heroFocusPanY;
    sim.lastSeqFrame = {
      ...seqFrame,
      cameraZoom: sim.cameraZoom,
      cameraPanX: sim.cameraPanX,
      cameraPanY: sim.cameraPanY,
    };
  }

  if (!seqFrame.active) {
    for (let i = sim.pendingImpacts.length - 1; i >= 0; i--) {
      if (sim.pendingImpacts[i].triggerOn === 'cutin_impact') {
        const pi = sim.pendingImpacts.splice(i, 1)[0];
        pi.execute();
      }
    }
  }

  if (sim.batchMicroTimerRemaining > 0) {
    sim.batchMicroTimerRemaining = Math.max(0, sim.batchMicroTimerRemaining - dt);
    if (
      sim.batchMicroTimerRemaining === 0 &&
      sim.batchActiveKey &&
      sim.lastCompletedBatchKey !== sim.batchActiveKey
    ) {
      sim.lastCompletedBatchKey = sim.batchActiveKey;
      sim.onBatchComplete?.(sim.batchActiveKey);
    }
  }

  sim.trauma = Math.max(0, sim.trauma - dt * 2.4);
  if (sim.heroAnim.flashTimer > 0) sim.heroAnim.flashTimer = Math.max(0, sim.heroAnim.flashTimer - dt);
  sim.enemyAnims.forEach((ea) => {
    if (ea.flashTimer > 0) ea.flashTimer = Math.max(0, ea.flashTimer - dt);
  });

  let simDt = seqFrame.isHitStopped ? 0 : dt;
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - dt);
    if (!seqFrame.isHitStopped) {
      simDt = 0;
    }
  }

  sim.simElapsed = (sim.simElapsed ?? 0) + simDt;
  sim.slashArcTimer = Math.max(0, sim.slashArcTimer - simDt);
  sim.kickWaveTimer = Math.max(0, sim.kickWaveTimer - simDt);
  sim.shieldDomeTimer = Math.max(0, sim.shieldDomeTimer - simDt);
  sim.dodgeZoomTimer = Math.max(0, sim.dodgeZoomTimer - simDt);
  sim.upgradeBeamTimer = Math.max(0, sim.upgradeBeamTimer - simDt);
  sim.overdriveTimer = Math.max(0, sim.overdriveTimer - simDt);
  if (sim.heroTrailCooldown > 0) {
    sim.heroTrailCooldown = Math.max(0, sim.heroTrailCooldown - simDt);
  }
  if (sim.screenBloodCooldown > 0) {
    sim.screenBloodCooldown = Math.max(0, sim.screenBloodCooldown - simDt);
  }

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
    if (ea.attackAnimTimer > 0) {
      ea.attackAnimTimer = Math.max(0, ea.attackAnimTimer - simDt);
    }
    if (ea.bristleTimer > 0) {
      ea.bristleTimer = Math.max(0, ea.bristleTimer - simDt);
    }
    if (ea.staggerTimer > 0) {
      ea.staggerTimer = Math.max(0, ea.staggerTimer - simDt);
    }
    if (ea.dead && ea.koProgress < 1) {
      ea.koProgress = Math.min(1, ea.koProgress + simDt * 1.15);
    }

    if (simDt > 0 && (ea.staggerTimer > 0.08 || (ea.dead && ea.koProgress < 0.78))) {
      ea.bleedSpurtTimer -= simDt;
      if (ea.bleedSpurtTimer <= 0) {
        ea.bleedSpurtTimer = 0.045 + Math.random() * 0.035;
        const origin = sim.enemyWoundOrigins.get(enemyId);
        if (origin) {
          emitBloodDroplets(
            sim,
            origin.x + 10,
            origin.y + (ea.dead ? ea.koProgress * 18 : 0),
            origin.groundY,
            ea.dead ? 7 : 5,
            ea.staggerIntensity * 0.85,
            origin.owner,
            'kinetic',
            1,
          );
        }
      }
    }
  });

  if (options?.combat && options?.hero) {
    stepEnemyAnimationSamples(sim, simDt, {
      combat: options.combat,
      hero: options.hero,
      hoveredColor: options.hoveredColor,
      activePreview: options.activePreview,
      projectedShield: options.projectedShield,
      elapsed: options.elapsed ?? sim.simElapsed ?? 0,
      tacticalViewActive: options.tacticalViewActive,
      spitterJuiceConfig: options.spitterJuiceConfig,
      spitterLabActive: options.spitterLabActive,
      bruteJuiceConfig: options.bruteJuiceConfig,
      bruteLabActive: options.bruteLabActive,
      emitSideEffects: true,
    });
  }

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
    p.vy += p.gravity * simDt;
    p.rot += p.vRot * simDt;
    if (p.shape === 4) {
      p.vx *= Math.max(0, 1 - 1.6 * simDt);
    }
    if (p.shape === 3 && !p.bounced && p.vy > 0 && p.y >= p.floorY) {
      p.y = p.floorY;
      p.vy = -Math.abs(p.vy) * 0.42;
      p.vx *= 0.68;
      p.vRot *= 0.65;
      p.bounced = true;
    }
  }

  const fissureAgeLerp = Math.min(1, simDt * 3.2);
  for (let i = 0; i < FLOOR_FISSURE_POOL_SIZE; i++) {
    const f = sim.floorFissures[i];
    if (!f.active) continue;
    f.age += simDt;
    const targetTurnAge = Math.max(0, sim.currentTurn - f.createdTurn);
    f.visualTurnAge += (targetTurnAge - f.visualTurnAge) * fissureAgeLerp;
    f.heatIntensity = Math.max(0, f.heatIntensity - simDt * 0.085);
    if (f.visualTurnAge >= 2.2 || f.age > 24) {
      f.alpha -= simDt * 0.28;
    }
    if (f.alpha <= 0.02) {
      f.active = false;
    }
  }

  stepBloodSimulation(sim, simDt);

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
    const decayRate = sim.ghosts[i].isDodge ? 1.65 : 4.5;
    sim.ghosts[i].alpha -= simDt * decayRate;
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
