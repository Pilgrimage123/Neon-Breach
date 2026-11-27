import { getEffectiveEnemyIntentValue } from '../../engine/reinforcementDirector';
import type { EnemyIntent } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { createInitialHeroAnimState } from '../../utils/heroAnimator';
import {
  DEFAULT_AURALINE_JUICE_CONFIG,
  createAuralineJuiceState,
} from '../../utils/auralineJuiceController';
import {
  DEFAULT_KIRA_JUICE_CONFIG,
  createKiraJuiceState,
} from '../../utils/kiraJuiceController';
import { CombatActionSequencer } from './CombatActionSequencer';
import {
  BLOOD_DROP_POOL_SIZE,
  BOLT_POOL_SIZE,
  COVER_BLOOD_POOL_SIZE,
  EDGE_DRIP_POOL_SIZE,
  FLOOR_BLOOD_POOL_SIZE,
  FLOOR_FISSURE_POOL_SIZE,
  PARTICLE_POOL_SIZE,
  SCREEN_BLOOD_POOL_SIZE,
  TEXT_POOL_SIZE,
  type BloodDroplet,
  type BridgeEdgeDrip,
  type CombatStageSim,
  type CoverBloodDecal,
  type FloorBloodPuddle,
  type FloorFissure,
  type FloatingText,
  type Particle,
  type PlasmaBolt,
  type ScreenBloodDrop,
} from './combatStageTypes';

export function getBridgeGroundY(h: number): number {
  return Math.round(h * 0.785);
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
    heroState: createInitialHeroAnimState(),
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
    kiraJuiceState: createKiraJuiceState(),
    kiraJuiceConfig: { ...DEFAULT_KIRA_JUICE_CONFIG },
    kiraJuiceSample: null,
    kiraSurgeBlastTimer: 0,
    kiraSurgeMuzzleX: 0,
    kiraSurgeMuzzleY: 0,
    kiraDropkickRingTimer: 0,
    kiraDropkickSoleX: 0,
    kiraDropkickSoleY: 0,
    auralineJuiceState: createAuralineJuiceState(),
    auralineJuiceConfig: { ...DEFAULT_AURALINE_JUICE_CONFIG },
    auralineJuiceSample: null,
    auralineSurgeBlastTimer: 0,
    auralineSurgeMuzzleX: 0,
    auralineSurgeMuzzleY: 0,
    auralineScatterConeTimer: 0,
    auralineScatterMuzzleX: 0,
    auralineScatterMuzzleY: 0,
    auralineBroadsideTimer: 0,
    auralineBroadsideMuzzleX: 0,
    auralineBroadsideMuzzleY: 0,
    auralineAegisDomeTimer: 0,
    auralineReactorAuraTimer: 0,
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
    screenBlood,
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
    heroFramesByChar: { kira: null, auraline: null, zuri: null },
    zuriDroneFrames: null,
    enemyCutouts: new Map(),
    crawlerFrames: new Map(),
    stalkerFrames: null,
    stalkerJuiceStates: new Map(),
    stalkerSamples: new Map(),
    stalkerJuiceSamples: new Map(),
    spitterFrames: null,
    spitterJuiceStates: new Map(),
    spitterSamples: new Map(),
    spitterJuiceSamples: new Map(),
    bruteFrames: null,
    bruteJuiceStates: new Map(),
    bruteSamples: new Map(),
    bruteJuiceSamples: new Map(),
    mutdogFrames: null,
    mutdogJuiceStates: new Map(),
    mutdogSamples: new Map(),
    mutdogJuiceSamples: new Map(),
    feralNurseFrames: null,
    feralNurseJuiceStates: new Map(),
    feralNurseSamples: new Map(),
    feralNurseJuiceSamples: new Map(),
    matriarchFrames: null,
    matriarchJuiceStates: new Map(),
    matriarchSamples: new Map(),
    matriarchJuiceSamples: new Map(),
    simElapsed: 0,
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

export const createInitialCombatSim = createCombatStageSim;

export function resetCombatStageSim(sim: CombatStageSim): void {
  sim.trauma = 0;
  sim.hitstop = 0;
  sim.currentTurn = 1;
  sim.cameraZoom = 1;
  sim.cameraPanX = 0,
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
  sim.heroState = createInitialHeroAnimState();
  sim.kiraJuiceState = createKiraJuiceState();
  sim.kiraJuiceSample = null;
  sim.kiraSurgeBlastTimer = 0;
  sim.kiraDropkickRingTimer = 0;
  sim.auralineJuiceState = createAuralineJuiceState();
  sim.auralineJuiceSample = null;
  sim.auralineSurgeBlastTimer = 0;
  sim.auralineScatterConeTimer = 0;
  sim.auralineBroadsideTimer = 0;
  sim.auralineAegisDomeTimer = 0;
  sim.auralineReactorAuraTimer = 0;
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
  sim.stalkerJuiceStates.clear();
  sim.stalkerSamples?.clear();
  sim.stalkerJuiceSamples?.clear();
  sim.spitterJuiceStates.clear();
  sim.spitterSamples?.clear();
  sim.spitterJuiceSamples?.clear();
  sim.bruteJuiceStates.clear();
  sim.bruteSamples?.clear();
  sim.bruteJuiceSamples?.clear();
  sim.mutdogJuiceStates.clear();
  sim.mutdogSamples?.clear();
  sim.mutdogJuiceSamples?.clear();
  sim.feralNurseJuiceStates.clear();
  sim.feralNurseSamples?.clear();
  sim.feralNurseJuiceSamples?.clear();
  sim.matriarchJuiceStates.clear();
  sim.matriarchSamples?.clear();
  sim.matriarchJuiceSamples?.clear();
  sim.simElapsed = 0;
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
      if (intent.pierceShield) extraParts.push('PIERCE');
      if (intent.corrodeAmount) extraParts.push(`+${intent.corrodeAmount} ${t.corrodeShort}`);
      if (intent.armorOnHit) extraParts.push(`+${intent.armorOnHit} ${t.armorShort}`);
      return extraParts.length > 0
        ? `${val}${condTag} DMG · ${extraParts.join(' ')}`
        : `${val}${condTag} DMG`;
    }
    case 'cloak':
      return '◎ 10% DMG (1T)';
    case 'acid':
      return `${val} DMG +${intent.secondaryValue ?? 2} ${t.corrodeShort}`;
    case 'armor':
      return intent.secondaryValue && intent.secondaryValue > 0
        ? `+${val} ${t.armorLabel} · +${intent.secondaryValue} ${t.hpLabel}`
        : `+${val} ${t.armorLabel}`;
    case 'bolster':
      return `+${val} ${t.armorShort} ${t.allShort}`;
    case 'charge':
      return intent.pierceShield
        ? `0 DMG (${intent.secondaryValue ?? 1}T → ${val} PIERCE)`
        : `0 DMG (${intent.secondaryValue ?? 1}T → ${val})`;
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
