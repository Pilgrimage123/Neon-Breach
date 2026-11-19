import { getEffectiveEnemyIntentValue } from '../../engine/reinforcementDirector';
import type { CharacterId, EnemyArchetype, EnemyIntent } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import type { CrawlerVariant } from '../../utils/crawlerSpriteSheet';
import { type HeroineAnimState, createInitialHeroineAnimState } from '../../utils/heroineSpriteSheet';
import type { FrameTransitionInput } from '../../utils/spriteSheetAnim';
import type { BruteJuiceState } from '../../utils/bruteJuiceController';
import type { SpitterJuiceState } from '../../utils/spitterJuiceController';
import type { SpriteBounds } from '../../utils/spriteCutout';
import { CombatActionSequencer, type SequencerFrameState } from './CombatActionSequencer';
import type { ProjectileVisualProfile } from './combatStagingClassifier';
import type { BloodOwnerKind, BloodShapeKind } from './mutantBlood';

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
export const BOLT_POOL_SIZE = 32;
export const BLOOD_DROP_POOL_SIZE = 320;
export const FLOOR_BLOOD_POOL_SIZE = 240;
export const COVER_BLOOD_POOL_SIZE = 128;
export const EDGE_DRIP_POOL_SIZE = 96;
export const SCREEN_BLOOD_POOL_SIZE = 28;
export const FLOOR_FISSURE_POOL_SIZE = 12;

export function getBridgeGroundY(h: number): number {
  return Math.round(h * 0.785);
}

export const ENEMY_FOOT_DEFAULTS: Record<
  EnemyArchetype,
  { bottomRatio: number; farFootOffsetRatio: number; centerXRatio: number }
> = {
  larva: { bottomRatio: 0.972, farFootOffsetRatio: 0.032, centerXRatio: 0.56 },
  skitter: { bottomRatio: 0.972, farFootOffsetRatio: 0.034, centerXRatio: 0.56 },
  stinger: { bottomRatio: 0.984, farFootOffsetRatio: 0.036, centerXRatio: 0.56 },
  stalker: { bottomRatio: 0.96, farFootOffsetRatio: 0.042, centerXRatio: 0.51 },
  spitter: { bottomRatio: 0.96, farFootOffsetRatio: 0.036, centerXRatio: 0.5 },
  brute: { bottomRatio: 0.96, farFootOffsetRatio: 0.044, centerXRatio: 0.5 },
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
  shape: number; // 0 = circle spark, 1 = shard diamond, 2 = acid drop, 3 = bouncing chitin/glass shard, 4 = soft mutagen mist cloud
  rot: number;
  vRot: number;
  gravity: number;
  floorY: number;
  bounced: boolean;
}

export interface FloorFissure {
  active: boolean;
  x: number;
  y: number;
  scale: number;
  seed: number;
  createdTurn: number;
  visualTurnAge: number;
  age: number;
  alpha: number;
  heatIntensity: number;
}

export interface BloodDroplet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  highlightColor: string;
  owner: BloodOwnerKind;
  shapeKind: BloodShapeKind;
  createdTurn: number;
  floorY: number;
  life: number;
  maxLife: number;
  splatOnFloor: boolean;
  hitCover: boolean;
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
  owner: BloodOwnerKind;
  shapeKind: BloodShapeKind;
  angle: number;
  createdTurn: number;
  visualTurnAge: number;
  seed: number;
  plasmaColor: string;
  age: number;
  alpha: number;
  dripSpawnCooldown: number;
  lobeOffsetX: number;
  lobeOffsetY: number;
  lobeScale: number;
}

export interface CoverBloodDecal {
  active: boolean;
  surface: 'rear_cover' | 'front_curb';
  x: number;
  offsetY: number;
  rx: number;
  ry: number;
  targetRy: number;
  streakLen: number;
  maxStreakLen: number;
  owner: BloodOwnerKind;
  shapeKind: BloodShapeKind;
  angle: number;
  createdTurn: number;
  visualTurnAge: number;
  seed: number;
  plasmaColor: string;
  age: number;
  alpha: number;
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
  owner: BloodOwnerKind;
  createdTurn: number;
  visualTurnAge: number;
  seed: number;
}

export interface ScreenBloodDrop {
  active: boolean;
  nx: number;
  ny: number;
  radius: number;
  stretchY: number;
  slideOffsetPx: number;
  slideSpeed: number;
  streakLen: number;
  owner: BloodOwnerKind;
  age: number;
  lifespan: number;
  alpha: number;
  seed: number;
  satelliteDx: number;
  satelliteDy: number;
  satelliteR: number;
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
  style: ProjectileVisualProfile;
  onImpact?: () => void;
}

export interface PendingImpact {
  triggerOn: 'shot1' | 'shot2' | 'kick' | 'delay' | 'cutin_impact';
  delayRemaining: number;
  execute: () => void;
}

export interface AfterimageGhost {
  x: number;
  y: number;
  frameIndex: number;
  drawScale: number;
  alpha: number;
  isDodge?: boolean;
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
  attackAnimTimer: number;
  attackAnimDuration: number;
  spitterAttackKind?: 'spit' | 'claw';
  bruteAttackKind?: 'heavy' | 'attack';
  bristleTimer: number;
  bristleDuration: number;
  bristleKind: 'armor' | 'retaliate' | 'pustule_rupture';
}

export interface EnemyCutoutEntry {
  canvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

export interface CombatStageSim {
  trauma: number;
  hitstop: number;
  currentTurn: number;
  slashArcTimer: number;
  slashSurge: boolean;
  kickWaveTimer: number;
  kickWaveX: number;
  kickWaveY: number;
  shieldDomeTimer: number;
  dodgeZoomTimer: number;
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
  heroTrailCooldown: number;
  enemyAnims: Map<string, ActorAnim>;
  enemyWoundOrigins: Map<string, { x: number; y: number; groundY: number; owner: BloodOwnerKind }>;
  prevEnemySlots: Map<string, number>;
  enemyInitialArmor: Map<string, number>;
  particles: Particle[];
  particleCursor: number;
  bloodDrops: BloodDroplet[];
  bloodDropCursor: number;
  floorBlood: FloorBloodPuddle[];
  floorBloodCursor: number;
  coverBlood: CoverBloodDecal[];
  coverBloodCursor: number;
  edgeDrips: BridgeEdgeDrip[];
  edgeDripCursor: number;
  screenBlood: ScreenBloodDrop[];
  screenBloodCursor: number;
  screenBloodCooldown: number;
  floorFissures: FloorFissure[];
  floorFissureCursor: number;
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
  heroFramesByChar: Record<CharacterId, HTMLCanvasElement[] | null>;
  zuriDroneFrames: HTMLCanvasElement[] | null;
  enemyCutouts: Map<EnemyArchetype, EnemyCutoutEntry>;
  crawlerFrames: Map<CrawlerVariant, HTMLCanvasElement[]>;
  stalkerFrames: HTMLCanvasElement[] | null;
  stalkerTransitions: Map<string, FrameTransitionInput>;
  spitterFrames: HTMLCanvasElement[] | null;
  spitterTransitions: Map<string, FrameTransitionInput>;
  spitterJuiceStates: Map<string, SpitterJuiceState>;
  bruteFrames: HTMLCanvasElement[] | null;
  bruteTransitions: Map<string, FrameTransitionInput>;
  bruteJuiceStates: Map<string, BruteJuiceState>;
  lastFrameDt: number;
  size: { w: number; h: number };
  dpr: number;
  cameraZoom: number;
  cameraPanX: number;
  cameraPanY: number;
  cameraRotRad: number;
  actionSequencer: CombatActionSequencer;
  lastSeqFrame: SequencerFrameState | null;
  batchMicroTimerRemaining: number;
  batchActiveKey: string;
  lastCompletedBatchKey: string;
  onBatchComplete?: (batchKey: string) => void;
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
      rot: 0,
      vRot: 0,
      gravity: 280,
      floorY: 9999,
      bounced: false,
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
      highlightColor: '#D9F99D',
      owner: 'larva',
      shapeKind: 'puddle',
      createdTurn: 1,
      floorY: 320,
      life: 0,
      maxLife: 0.9,
      splatOnFloor: true,
      hitCover: false,
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
      owner: 'larva',
      shapeKind: 'puddle',
      angle: 0,
      createdTurn: 1,
      visualTurnAge: 0,
      seed: i * 1.37,
      plasmaColor: '#00F0FF',
      age: 0,
      alpha: 0.88,
      dripSpawnCooldown: 0.5,
      lobeOffsetX: 6,
      lobeOffsetY: 1.5,
      lobeScale: 0.68,
    });
  }

  const coverBlood: CoverBloodDecal[] = [];
  for (let i = 0; i < COVER_BLOOD_POOL_SIZE; i++) {
    coverBlood.push({
      active: false,
      surface: 'rear_cover',
      x: 0,
      offsetY: -12,
      rx: 6,
      ry: 5,
      targetRy: 14,
      streakLen: 0,
      maxStreakLen: 16,
      owner: 'larva',
      shapeKind: 'cone_droplet',
      angle: 0,
      createdTurn: 1,
      visualTurnAge: 0,
      seed: i * 2.13,
      plasmaColor: '#00F0FF',
      age: 0,
      alpha: 0.88,
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
      owner: 'larva',
      createdTurn: 1,
      visualTurnAge: 0,
      seed: i * 1.71,
    });
  }

  const screenBlood: ScreenBloodDrop[] = [];
  for (let i = 0; i < SCREEN_BLOOD_POOL_SIZE; i++) {
    screenBlood.push({
      active: false,
      nx: 0.1,
      ny: 0.85,
      radius: 4.5,
      stretchY: 1.15,
      slideOffsetPx: 0,
      slideSpeed: 2.5,
      streakLen: 0,
      owner: 'larva',
      age: 0,
      lifespan: 6,
      alpha: 0.85,
      seed: i * 2.71,
      satelliteDx: 6,
      satelliteDy: -4,
      satelliteR: 1.6,
    });
  }

  const floorFissures: FloorFissure[] = [];
  for (let i = 0; i < FLOOR_FISSURE_POOL_SIZE; i++) {
    floorFissures.push({
      active: false,
      x: 0,
      y: 0,
      scale: 1,
      seed: i * 1.91,
      createdTurn: 1,
      visualTurnAge: 0,
      age: 0,
      alpha: 0.95,
      heatIntensity: 1,
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
      style: 'pistol_bolt',
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
    currentTurn: 1,
    slashArcTimer: 0,
    slashSurge: false,
    kickWaveTimer: 0,
    kickWaveX: 0,
    kickWaveY: 0,
    shieldDomeTimer: 0,
    dodgeZoomTimer: 0,
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
      attackAnimTimer: 0,
      attackAnimDuration: 0.52,
      bristleTimer: 0,
      bristleDuration: 0.5,
      bristleKind: 'armor',
    },
    ghosts: [],
    ghostSampleTimer: 0,
    heroTrailCooldown: 0,
    enemyAnims: new Map(),
    enemyWoundOrigins: new Map(),
    prevEnemySlots: new Map(),
    enemyInitialArmor: new Map(),
    particles,
    particleCursor: 0,
    bloodDrops,
    bloodDropCursor: 0,
    floorBlood,
    floorBloodCursor: 0,
    coverBlood,
    coverBloodCursor: 0,
    edgeDrips,
    edgeDripCursor: 0,
    screenBlood: screenBlood,
    screenBloodCursor: 0,
    screenBloodCooldown: 0,
    floorFissures,
    floorFissureCursor: 0,
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
    heroFramesByChar: { kira: null, aurelia: null, zuri: null },
    zuriDroneFrames: null,
    enemyCutouts: new Map(),
    crawlerFrames: new Map(),
    stalkerFrames: null,
    stalkerTransitions: new Map(),
    spitterFrames: null,
    spitterTransitions: new Map(),
    spitterJuiceStates: new Map(),
    bruteFrames: null,
    bruteTransitions: new Map(),
    bruteJuiceStates: new Map(),
    lastFrameDt: 0.016,
    size: { w: 1200, h: 420 },
    dpr: 1,
    cameraZoom: 1,
    cameraPanX: 0,
    cameraPanY: 0,
    cameraRotRad: 0,
    actionSequencer: new CombatActionSequencer(),
    lastSeqFrame: null,
    batchMicroTimerRemaining: 0,
    batchActiveKey: '',
    lastCompletedBatchKey: '',
    needsRedraw: true,
  };
}

export function resetCombatStageSim(sim: CombatStageSim): void {
  sim.trauma = 0;
  sim.hitstop = 0;
  sim.currentTurn = 1;
  sim.cameraZoom = 1;
  sim.cameraPanX = 0;
  sim.cameraPanY = 0;
  sim.cameraRotRad = 0;
  sim.actionSequencer.reset();
  sim.lastSeqFrame = null;
  sim.batchMicroTimerRemaining = 0;
  sim.batchActiveKey = '';
  sim.lastCompletedBatchKey = '';
  sim.slashArcTimer = 0;
  sim.kickWaveTimer = 0;
  sim.shieldDomeTimer = 0;
  sim.dodgeZoomTimer = 0;
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
    attackAnimTimer: 0,
    attackAnimDuration: 0.52,
    bristleTimer: 0,
    bristleDuration: 0.5,
    bristleKind: 'armor',
  };
  sim.ghosts = [];
  sim.heroTrailCooldown = 0;
  sim.enemyAnims.clear();
  sim.enemyWoundOrigins.clear();
  sim.prevEnemySlots.clear();
  sim.enemyInitialArmor.clear();
  sim.stalkerTransitions.clear();
  sim.spitterTransitions.clear();
  sim.spitterJuiceStates.clear();
  sim.bruteTransitions.clear();
  sim.bruteJuiceStates.clear();
  sim.lastFrameDt = 0.016;
  for (let i = 0; i < sim.particles.length; i++) sim.particles[i].active = false;
  for (let i = 0; i < sim.bloodDrops.length; i++) sim.bloodDrops[i].active = false;
  for (let i = 0; i < sim.floorBlood.length; i++) sim.floorBlood[i].active = false;
  for (let i = 0; i < sim.coverBlood.length; i++) sim.coverBlood[i].active = false;
  for (let i = 0; i < sim.edgeDrips.length; i++) sim.edgeDrips[i].active = false;
  for (let i = 0; i < sim.screenBlood.length; i++) sim.screenBlood[i].active = false;
  for (let i = 0; i < sim.floorFissures.length; i++) sim.floorFissures[i].active = false;
  sim.screenBloodCooldown = 0;
  for (let i = 0; i < sim.texts.length; i++) sim.texts[i].active = false;
  for (let i = 0; i < sim.bolts.length; i++) {
    sim.bolts[i].active = false;
    sim.bolts[i].onImpact = undefined;
  }
  sim.needsRedraw = true;
}

export function formatEnemyIntent(
  intent: EnemyIntent,
  lang: Language,
  enrageAtkBonus = 0,
  staggered = false,
): string {
  const t = TRANSLATIONS[lang];
  if (
    staggered &&
    (intent.kind === 'attack' ||
      intent.kind === 'heavy' ||
      intent.kind === 'acid' ||
      intent.kind === 'leech' ||
      intent.kind === 'charge')
  ) {
    return '⚡ 0 DMG';
  }
  const val =
    enrageAtkBonus > 0
      ? getEffectiveEnemyIntentValue({ enrageAtkBonus }, intent)
      : intent.value;
  const condTag = intent.conditionBonus ? `(+${intent.conditionBonus}?)` : '';
  switch (intent.kind) {
    case 'attack':
    case 'heavy': {
      const extraParts: string[] = [];
      if (intent.corrodeAmount) extraParts.push(`+${intent.corrodeAmount} ${t.corrodeShort}`);
      if (intent.armorOnHit) extraParts.push(`+${intent.armorOnHit} ${t.armorShort}`);
      return extraParts.length > 0
        ? `${val}${condTag} DMG · ${extraParts.join(' ')}`
        : `${val}${condTag} DMG`;
    }
    case 'acid':
      return `${val} DMG +${intent.secondaryValue ?? 2} ${t.corrodeShort}`;
    case 'armor':
      return intent.secondaryValue && intent.secondaryValue > 0
        ? `+${val} ${t.armorLabel} · +${intent.secondaryValue} ${t.hpLabel}`
        : `+${val} ${t.armorLabel}`;
    case 'bolster':
      return `+${val} ${t.armorShort} ${t.allShort}`;
    case 'charge':
      return `0 DMG (${intent.secondaryValue ?? 1}T → ${val})`;
    case 'leech':
      return `${val} DMG +${intent.secondaryValue ?? 4} ${t.hpLabel}`;
    default:
      return `${val} DMG`;
  }
}

export function getEnemyLaneMetrics(w: number, enemyCount: number): { baseX: number; stepX: number } {
  const safeCount = Math.max(1, Math.min(6, enemyCount));
  if (w < 460) {
    if (safeCount >= 4) {
      const baseX = w * 0.43;
      const stepX = (w * 0.49) / Math.max(1, safeCount - 1);
      return { baseX, stepX };
    }
    const baseX = safeCount === 1 ? w * 0.74 : safeCount === 2 ? w * 0.61 : w * 0.51;
    const stepX = safeCount === 2 ? w * 0.21 : w * 0.165;
    return { baseX, stepX };
  }
  if (safeCount >= 4) {
    const baseX = w * 0.45;
    const stepX = (w * 0.47) / Math.max(1, safeCount - 1);
    return { baseX, stepX };
  }
  const baseX = safeCount === 1 ? w * 0.76 : safeCount === 2 ? w * 0.65 : w * 0.56;
  const stepX = safeCount === 2 ? w * 0.17 : w * 0.145;
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
  const heroBaseX = w < 460 ? w * 0.19 : w * 0.22;
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, enemyCount);
  const heroTargetHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
  const baseScale = heroTargetHeight / canonicalHeight;
  const effectiveDashTargetX = dashTargetX > heroBaseX ? dashTargetX : enemyBaseX;
  const dashDistance = Math.max(70, effectiveDashTargetX - heroBaseX - w * 0.11);
  const heroDrawScale = baseScale * rowScale;
  const rawHeroX = heroBaseX + xProgress * dashDistance;
  const heroX = xProgress < 0 ? Math.max(w * 0.08, rawHeroX) : rawHeroX;
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
