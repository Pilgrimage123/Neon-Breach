import type { EnemyArchetype, EnemyIntent } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { type HeroineAnimState, createInitialHeroineAnimState } from '../../utils/heroineSpriteSheet';
import type { SpriteBounds } from '../../utils/spriteCutout';

/**
 * Normalized Y coordinate in arena_backdrop_1794552838070.jpg where the cyan
 * glass sky-bridge walkway floor plane sits (between 0.748 rear railing sill
 * and 0.842 front silver curb).
 */
export const BRIDGE_DECK_IMG_Y = 0.812;
export const BRIDGE_DECK_BACK_IMG_Y = 0.752;
export const BRIDGE_DECK_FRONT_IMG_Y = 0.840;

export const PARTICLE_POOL_SIZE = 256;
export const TEXT_POOL_SIZE = 24;
export const BOLT_POOL_SIZE = 16;
export const BLOOD_DROP_POOL_SIZE = 320;
export const FLOOR_BLOOD_POOL_SIZE = 220;
export const EDGE_DRIP_POOL_SIZE = 96;

export function getBridgeGroundY(h: number): number {
  return Math.round(h * 0.785);
}

export const ENEMY_FOOT_DEFAULTS: Record<
  EnemyArchetype,
  { bottomRatio: number; farFootOffsetRatio: number; centerXRatio: number }
> = {
  stalker: { bottomRatio: 0.908, farFootOffsetRatio: 0.052, centerXRatio: 0.5 },
  spitter: { bottomRatio: 0.918, farFootOffsetRatio: 0.036, centerXRatio: 0.49 },
  brute: { bottomRatio: 0.938, farFootOffsetRatio: 0.044, centerXRatio: 0.51 },
  boss: { bottomRatio: 0.976, farFootOffsetRatio: 0.036, centerXRatio: 0.5 },
};

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: number; // 0 = circle spark, 1 = shard diamond, 2 = acid drop
}

export interface BloodDroplet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  floorY: number;
  life: number;
  maxLife: number;
  splatOnFloor: boolean;
}

export interface FloorBloodPuddle {
  active: boolean;
  x: number;
  y: number;
  rx: number;
  ry: number;
  targetRx: number;
  targetRy: number;
  flowVx: number;
  flowVy: number;
  spreadRateX: number;
  spreadRateY: number;
  tendrilOffsetX1: number;
  tendrilOffsetX2: number;
  tendrilLen1: number;
  tendrilLen2: number;
  maxTendrilLen: number;
  color: string;
  coreColor: string;
  highlightColor: string;
  age: number;
  alpha: number;
  dripSpawnCooldown: number;
  lobeOffsetX: number;
  lobeOffsetY: number;
  lobeScale: number;
}

export interface BridgeEdgeDrip {
  active: boolean;
  x: number;
  edgeY: number;
  length: number;
  maxLength: number;
  thickness: number;
  bulbPhase: number;
  stretchSpeed: number;
  detachedActive: boolean;
  detachedY: number;
  detachedVy: number;
  detachedRadius: number;
  detachedAlpha: number;
  alpha: number;
  age: number;
  lifespan: number;
  color: string;
  coreColor: string;
  highlightColor: string;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  scale: number;
}

export interface PlasmaBolt {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  life: number;
  maxLife: number;
  color: string;
  onImpact?: () => void;
}

export interface PendingImpact {
  triggerOn: 'shot1' | 'shot2' | 'kick' | 'delay';
  delayRemaining: number;
  execute: () => void;
}

export interface AfterimageGhost {
  x: number;
  y: number;
  frameIndex: number;
  drawScale: number;
  alpha: number;
}

export interface ActorAnim {
  flashTimer: number;
  lunge: number; // 0..1
  lungeDir: number;
  koProgress: number; // 0 = alive, 0..1 = dissolving
  dead: boolean;
  staggerTimer: number;
  staggerDuration: number;
  staggerIntensity: number;
  bleedSpurtTimer: number;
}

export interface EnemyCutoutEntry {
  canvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

export interface CombatStageSim {
  trauma: number;
  hitstop: number;
  slashArcTimer: number;
  slashSurge: boolean;
  kickWaveTimer: number;
  kickWaveX: number;
  kickWaveY: number;
  shieldDomeTimer: number;
  upgradeBeamTimer: number;
  overdriveTimer: number;
  lastCueBatchKey: string;
  attackToggle: number;
  pendingShotTargetX: number;
  pendingShotTargetY: number;
  dashTargetX: number;
  pendingImpacts: PendingImpact[];
  heroState: HeroineAnimState;
  heroAnim: ActorAnim;
  ghosts: AfterimageGhost[];
  ghostSampleTimer: number;
  enemyAnims: Map<string, ActorAnim>;
  particles: Particle[];
  particleCursor: number;
  bloodDrops: BloodDroplet[];
  bloodDropCursor: number;
  floorBlood: FloorBloodPuddle[];
  floorBloodCursor: number;
  edgeDrips: BridgeEdgeDrip[];
  edgeDripCursor: number;
  texts: FloatingText[];
  textCursor: number;
  bolts: PlasmaBolt[];
  boltCursor: number;
  motes: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string }>;
  backdropImg: HTMLImageElement | null;
  backdropCache: HTMLCanvasElement | null;
  backdropCacheW: number;
  backdropCacheH: number;
  deckGradCache: CanvasGradient | null;
  deckGradBackY: number;
  deckGradFrontY: number;
  heroFrames: HTMLCanvasElement[] | null;
  enemyCutouts: Map<EnemyArchetype, EnemyCutoutEntry>;
  size: { w: number; h: number };
  dpr: number;
  needsRedraw: boolean;
}

export function createCombatStageSim(): CombatStageSim {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      color: '#00E5FF',
      shape: 0,
    });
  }

  const bloodDrops: BloodDroplet[] = [];
  for (let i = 0; i < BLOOD_DROP_POOL_SIZE; i++) {
    bloodDrops.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#84CC16',
      floorY: 320,
      life: 0,
      maxLife: 0.9,
      splatOnFloor: true,
    });
  }

  const floorBlood: FloorBloodPuddle[] = [];
  for (let i = 0; i < FLOOR_BLOOD_POOL_SIZE; i++) {
    floorBlood.push({
      active: false,
      x: 0,
      y: 0,
      rx: 1,
      ry: 0.5,
      targetRx: 14,
      targetRy: 4,
      flowVx: 0,
      flowVy: 0,
      spreadRateX: 1,
      spreadRateY: 0.3,
      tendrilOffsetX1: -4,
      tendrilOffsetX2: 5,
      tendrilLen1: 0,
      tendrilLen2: 0,
      maxTendrilLen: 14,
      color: '#65A30D',
      coreColor: '#365314',
      highlightColor: '#BEF264',
      age: 0,
      alpha: 0.88,
      dripSpawnCooldown: 0.5,
      lobeOffsetX: 6,
      lobeOffsetY: 1.5,
      lobeScale: 0.68,
    });
  }

  const edgeDrips: BridgeEdgeDrip[] = [];
  for (let i = 0; i < EDGE_DRIP_POOL_SIZE; i++) {
    edgeDrips.push({
      active: false,
      x: 0,
      edgeY: 340,
      length: 2,
      maxLength: 36,
      thickness: 3.5,
      bulbPhase: 0,
      stretchSpeed: 6,
      detachedActive: false,
      detachedY: 0,
      detachedVy: 0,
      detachedRadius: 3,
      detachedAlpha: 0,
      alpha: 0.9,
      age: 0,
      lifespan: 22,
      color: '#65A30D',
      coreColor: '#365314',
      highlightColor: '#BEF264',
    });
  }

  const texts: FloatingText[] = [];
  for (let i = 0; i < TEXT_POOL_SIZE; i++) {
    texts.push({
      active: false,
      x: 0,
      y: 0,
      vy: -40,
      life: 0,
      maxLife: 0.9,
      text: '',
      color: '#FFFFFF',
      scale: 1,
    });
  }

  const bolts: PlasmaBolt[] = [];
  for (let i = 0; i < BOLT_POOL_SIZE; i++) {
    bolts.push({
      active: false,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      life: 0,
      maxLife: 0.14,
      color: '#00E5FF',
    });
  }

  const motes = Array.from({ length: 22 }, (_, idx) => ({
    x: (idx * 0.047 + 0.03) % 1,
    y: (idx * 0.13 + 0.08) % 0.85,
    vx: 0.008 + (idx % 4) * 0.004,
    vy: -0.005 - (idx % 3) * 0.003,
    r: 1.5 + (idx % 3) * 1.2,
    color: idx % 3 === 0 ? 'rgba(255,184,0,0.45)' : 'rgba(0,229,255,0.45)',
  }));

  return {
    trauma: 0,
    hitstop: 0,
    slashArcTimer: 0,
    slashSurge: false,
    kickWaveTimer: 0,
    kickWaveX: 0,
    kickWaveY: 0,
    shieldDomeTimer: 0,
    upgradeBeamTimer: 0,
    overdriveTimer: 0,
    lastCueBatchKey: '',
    attackToggle: 0,
    pendingShotTargetX: 800,
    pendingShotTargetY: 240,
    dashTargetX: 800,
    pendingImpacts: [],
    heroState: createInitialHeroineAnimState(),
    heroAnim: {
      flashTimer: 0,
      lunge: 0,
      lungeDir: 1,
      koProgress: 0,
      dead: false,
      staggerTimer: 0,
      staggerDuration: 0.42,
      staggerIntensity: 1,
      bleedSpurtTimer: 0,
    },
    ghosts: [],
    ghostSampleTimer: 0,
    enemyAnims: new Map(),
    particles,
    particleCursor: 0,
    bloodDrops,
    bloodDropCursor: 0,
    floorBlood,
    floorBloodCursor: 0,
    edgeDrips,
    edgeDripCursor: 0,
    texts,
    textCursor: 0,
    bolts,
    boltCursor: 0,
    motes,
    backdropImg: null,
    backdropCache: null,
    backdropCacheW: 0,
    backdropCacheH: 0,
    deckGradCache: null,
    deckGradBackY: 0,
    deckGradFrontY: 0,
    heroFrames: null,
    enemyCutouts: new Map(),
    size: { w: 1200, h: 420 },
    dpr: 1,
    needsRedraw: true,
  };
}

export function resetCombatStageSim(sim: CombatStageSim): void {
  sim.trauma = 0;
  sim.hitstop = 0;
  sim.slashArcTimer = 0;
  sim.kickWaveTimer = 0;
  sim.shieldDomeTimer = 0;
  sim.upgradeBeamTimer = 0;
  sim.overdriveTimer = 0;
  sim.lastCueBatchKey = '';
  sim.attackToggle = 0;
  sim.pendingImpacts = [];
  sim.heroState = createInitialHeroineAnimState();
  sim.heroAnim = {
    flashTimer: 0,
    lunge: 0,
    lungeDir: 1,
    koProgress: 0,
    dead: false,
    staggerTimer: 0,
    staggerDuration: 0.42,
    staggerIntensity: 1,
    bleedSpurtTimer: 0,
  };
  sim.ghosts = [];
  sim.enemyAnims.clear();
  for (let i = 0; i < sim.particles.length; i++) sim.particles[i].active = false;
  for (let i = 0; i < sim.bloodDrops.length; i++) sim.bloodDrops[i].active = false;
  for (let i = 0; i < sim.floorBlood.length; i++) sim.floorBlood[i].active = false;
  for (let i = 0; i < sim.edgeDrips.length; i++) sim.edgeDrips[i].active = false;
  for (let i = 0; i < sim.texts.length; i++) sim.texts[i].active = false;
  for (let i = 0; i < sim.bolts.length; i++) {
    sim.bolts[i].active = false;
    sim.bolts[i].onImpact = undefined;
  }
  sim.needsRedraw = true;
}

export function formatEnemyIntent(intent: EnemyIntent, lang: Language): string {
  const t = TRANSLATIONS[lang];
  switch (intent.kind) {
    case 'attack':
      return `${t.enemyIntentAttack} · ${intent.value} DMG`;
    case 'heavy':
      return `${t.enemyIntentHeavy} · ${intent.value} DMG`;
    case 'acid':
      return `${t.enemyIntentAcid} · ${intent.value} DMG +${intent.secondaryValue ?? 2}`;
    case 'armor':
      return `${t.enemyIntentArmor} · +${intent.value} ${t.armorLabel}`;
    case 'leech':
      return `${t.enemyIntentLeech} · ${intent.value} DMG`;
  }
}

export function getEnemyLaneMetrics(w: number, enemyCount: number): { baseX: number; stepX: number } {
  const baseX = enemyCount === 1 ? w * 0.76 : enemyCount === 2 ? w * 0.65 : w * 0.56;
  const stepX = enemyCount === 2 ? w * 0.17 : w * 0.145;
  return { baseX, stepX };
}

export function getStageLayoutMetrics(
  w: number,
  h: number,
  enemyCount: number,
  dashTargetX: number,
  xProgress: number,
  yHopPx: number,
  rowScale: number,
  canonicalHeight: number,
) {
  const groundY = getBridgeGroundY(h);
  const heroBaseX = w * 0.22;
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, enemyCount);
  const heroTargetHeight = Math.min(h * 0.57, w * 0.31, 214);
  const baseScale = heroTargetHeight / canonicalHeight;
  const effectiveDashTargetX = dashTargetX > heroBaseX ? dashTargetX : enemyBaseX;
  const dashDistance = Math.max(80, effectiveDashTargetX - heroBaseX - w * 0.11);
  const heroDrawScale = baseScale * rowScale;
  const heroX = heroBaseX + xProgress * dashDistance;
  const heroY = groundY + yHopPx * baseScale;
  return {
    groundY,
    heroBaseX,
    enemyBaseX,
    enemyStepX,
    heroTargetHeight,
    baseScale,
    heroDrawScale,
    heroX,
    heroY,
  };
}
