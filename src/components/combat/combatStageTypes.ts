import type { CharacterId, EnemyArchetype } from '../../engine/types';
import type { CrawlerVariant } from '../../utils/crawlerSpriteSheet';
import type { HeroAnimState } from '../../utils/heroAnimator';
import type {
  AuralineJuiceConfig,
  AuralineJuiceSample,
  AuralineJuiceState,
} from '../../utils/auralineJuiceController';
import type {
  KiraJuiceConfig,
  KiraJuiceSample,
  KiraJuiceState,
} from '../../utils/kiraJuiceController';
import type { BruteFrameSample } from '../../utils/bruteSpriteSheet';
import type { BruteJuiceSample, BruteJuiceState } from '../../utils/bruteJuiceController';
import type { FeralNurseAnimSample } from '../../utils/feralNurseSpriteSheet';
import type {
  FeralNurseJuiceSample,
  FeralNurseJuiceState,
} from '../../utils/feralNurseJuiceController';
import type { MutdogFrameSample } from '../../utils/mutdogSpriteSheet';
import type { MutdogJuiceSample, MutdogJuiceState } from '../../utils/mutdogJuiceController';
import type { SpitterFrameSample } from '../../utils/spitterSpriteSheet';
import type { SpitterJuiceSample, SpitterJuiceState } from '../../utils/spitterJuiceController';
import type {
  MatriarchJuiceSample,
  MatriarchJuiceState,
} from '../../utils/matriarchJuiceController';
import type { MatriarchFrameSample } from '../../utils/matriarchSpriteSheet';
import type { StalkerFrameSample } from '../../utils/stalkerSpriteSheet';
import type { StalkerJuiceSample, StalkerJuiceState } from '../../utils/stalkerJuiceController';
import type { SpriteBounds } from '../../utils/spriteCutout';
import type { CombatActionSequencer, SequencerFrameState } from './CombatActionSequencer';
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

export const ENEMY_FOOT_DEFAULTS: Record<
  EnemyArchetype,
  { bottomRatio: number; farFootOffsetRatio: number; centerXRatio: number }
> = {
  larva: { bottomRatio: 0.972, farFootOffsetRatio: 0.032, centerXRatio: 0.56 },
  skitter: { bottomRatio: 0.972, farFootOffsetRatio: 0.034, centerXRatio: 0.56 },
  stinger: { bottomRatio: 0.984, farFootOffsetRatio: 0.036, centerXRatio: 0.56 },
  stalker: { bottomRatio: 0.932, farFootOffsetRatio: 0.04, centerXRatio: 0.497 },
  spitter: { bottomRatio: 0.96, farFootOffsetRatio: 0.036, centerXRatio: 0.5 },
  mutdog: { bottomRatio: 0.96, farFootOffsetRatio: 0.036, centerXRatio: 0.5 },
  feral_nurse: { bottomRatio: 0.972, farFootOffsetRatio: 0.036, centerXRatio: 0.5 },
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
  mutdogAttackKind?: 'maul' | 'pounce';
  cloakCastTimer?: number;
  cloakCastDuration?: number;
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
  heroState: HeroAnimState;
  kiraJuiceState: KiraJuiceState;
  kiraJuiceConfig: KiraJuiceConfig;
  kiraJuiceSample: KiraJuiceSample | null;
  kiraSurgeBlastTimer: number;
  kiraSurgeMuzzleX: number;
  kiraSurgeMuzzleY: number;
  kiraDropkickRingTimer: number;
  kiraDropkickSoleX: number;
  kiraDropkickSoleY: number;
  auralineJuiceState: AuralineJuiceState;
  auralineJuiceConfig: AuralineJuiceConfig;
  auralineJuiceSample: AuralineJuiceSample | null;
  auralineSurgeBlastTimer: number;
  auralineSurgeMuzzleX: number;
  auralineSurgeMuzzleY: number;
  auralineScatterConeTimer: number;
  auralineScatterMuzzleX: number;
  auralineScatterMuzzleY: number;
  auralineBroadsideTimer: number;
  auralineBroadsideMuzzleX: number;
  auralineBroadsideMuzzleY: number;
  auralineAegisDomeTimer: number;
  auralineReactorAuraTimer: number;
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
  stalkerJuiceStates: Map<string, StalkerJuiceState>;
  stalkerSamples?: Map<string, StalkerFrameSample>;
  stalkerJuiceSamples?: Map<string, StalkerJuiceSample>;
  spitterFrames: HTMLCanvasElement[] | null;
  spitterJuiceStates: Map<string, SpitterJuiceState>;
  spitterSamples?: Map<string, SpitterFrameSample>;
  spitterJuiceSamples?: Map<string, SpitterJuiceSample>;
  bruteFrames: HTMLCanvasElement[] | null;
  bruteJuiceStates: Map<string, BruteJuiceState>;
  bruteSamples?: Map<string, BruteFrameSample>;
  bruteJuiceSamples?: Map<string, BruteJuiceSample>;
  mutdogFrames: HTMLCanvasElement[] | null;
  mutdogJuiceStates: Map<string, MutdogJuiceState>;
  mutdogSamples?: Map<string, MutdogFrameSample>;
  mutdogJuiceSamples?: Map<string, MutdogJuiceSample>;
  feralNurseFrames: HTMLCanvasElement[] | null;
  feralNurseJuiceStates: Map<string, FeralNurseJuiceState>;
  feralNurseSamples?: Map<string, FeralNurseAnimSample>;
  feralNurseJuiceSamples?: Map<string, FeralNurseJuiceSample>;
  matriarchFrames: HTMLCanvasElement[] | null;
  matriarchJuiceStates: Map<string, MatriarchJuiceState>;
  matriarchSamples?: Map<string, MatriarchFrameSample>;
  matriarchJuiceSamples?: Map<string, MatriarchJuiceSample>;
  simElapsed?: number;
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

export {
  createCombatStageSim,
  createInitialCombatSim,
  formatEnemyIntent,
  getBridgeGroundY,
  getEnemyLaneMetrics,
  getStageLayoutMetrics,
  resetCombatStageSim,
} from './combatStageSim';
