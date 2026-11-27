import type {
  CombatState,
  HeroState,
  TileType,
  TurnPreview,
} from '../../engine/types';
import {
  BRUTE_CANONICAL_HEIGHT,
  BRUTE_SHEET_FRAMES,
  type BruteFrameSample,
} from '../../utils/bruteSpriteSheet';
import {
  type BruteJuiceConfig,
  type BruteJuiceSample,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
} from '../../utils/bruteJuiceController';
import {
  FERAL_NURSE_CANONICAL_HEIGHT,
  FERAL_NURSE_SHEET_FRAMES,
  type FeralNurseAnimSample,
} from '../../utils/feralNurseSpriteSheet';
import {
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseJuiceConfig,
  type FeralNurseJuiceSample,
  createFeralNurseJuiceState,
  stepFeralNurseJuice,
} from '../../utils/feralNurseJuiceController';
import {
  MUTDOG_CANONICAL_HEIGHT,
  MUTDOG_SHEET_FRAMES,
  type MutdogFrameSample,
} from '../../utils/mutdogSpriteSheet';
import {
  DEFAULT_MUTDOG_JUICE_CONFIG,
  type MutdogJuiceConfig,
  type MutdogJuiceSample,
  createMutdogJuiceState,
  stepMutdogJuice,
} from '../../utils/mutdogJuiceController';
import {
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
  type SpitterFrameSample,
} from '../../utils/spitterSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceSample,
  createSpitterJuiceState,
  stepSpitterJuice,
} from '../../utils/spitterJuiceController';
import {
  STALKER_CANONICAL_HEIGHT,
  STALKER_SHEET_FRAMES,
  type StalkerFrameSample,
} from '../../utils/stalkerSpriteSheet';
import {
  type StalkerJuiceSample,
  createStalkerJuiceState,
  stepStalkerJuice,
} from '../../utils/stalkerJuiceController';
import {
  MATRIARCH_CANONICAL_HEIGHT,
  MATRIARCH_SHEET_FRAMES,
  type MatriarchFrameSample,
} from '../../utils/matriarchSpriteSheet';
import {
  type MatriarchJuiceSample,
  createMatriarchJuiceState,
  stepMatriarchJuice,
} from '../../utils/matriarchJuiceController';
import {
  computeBaseEnemySize,
  getMutantArchScale,
} from '../../utils/mutantAnimationRegistry';
import { computeEnemyArmorPreview, computeEnemySlotLayout } from './combatEnemyUi';
import {
  type ActorAnim,
  BLOOD_DROP_POOL_SIZE,
  type CombatStageSim,
  PARTICLE_POOL_SIZE,
  getBridgeGroundY,
  getEnemyLaneMetrics,
} from './combatStageTypes';
import {
  addGroundFissure,
  spawnBruteKineticShards,
  spawnBruteMutagenMist,
  spawnBurst,
  spawnFeralNurseCloakShimmer,
  spawnFeralNurseIchorSpray,
  spawnFeralNurseLeapDust,
  spawnMutdogDroolSplatter,
  spawnMutdogLeapDust,
} from './combatVfx';
import { projectSpriteLandmarkToStage } from './stageMeshMath';
import {
  type ActorJuiceSnapshot,
  NEUTRAL_ACTOR_JUICE_SNAPSHOT,
} from './SpriteJuiceFeedbackHandler';

export interface StaggerKinematics {
  dx: number;
  dy: number;
  rot: number;
  scaleXMul: number;
  scaleYMul: number;
  shearPx: number;
  bioFlashAlpha: number;
}

export function getEnemyStaggerKinematics(ea: ActorAnim | undefined): StaggerKinematics {
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

export interface StepEnemyAnimationOptions {
  combat: CombatState;
  hero: HeroState;
  hoveredColor?: TileType | null;
  activePreview?: TurnPreview | null;
  projectedShield?: number;
  elapsed: number;
  tacticalViewActive?: boolean;
  spitterJuiceConfig?: SpitterJuiceConfig;
  spitterLabActive?: boolean;
  bruteJuiceConfig?: BruteJuiceConfig;
  bruteLabActive?: boolean;
  mutdogJuiceConfig?: MutdogJuiceConfig;
  mutdogLabActive?: boolean;
  feralNurseJuiceConfig?: FeralNurseJuiceConfig;
  feralNurseLabActive?: boolean;
  getActorJuice?: (actorId: string) => ActorJuiceSnapshot;
  emitSideEffects?: boolean;
}

export function stepEnemyAnimationSamples(
  sim: CombatStageSim,
  dtStep: number,
  options: StepEnemyAnimationOptions,
): void {
  const {
    combat,
    hero,
    hoveredColor = null,
    activePreview = null,
    projectedShield = hero.shield,
    elapsed,
    tacticalViewActive = false,
    spitterJuiceConfig = DEFAULT_SPITTER_JUICE_CONFIG,
    spitterLabActive = false,
    bruteJuiceConfig = DEFAULT_BRUTE_JUICE_CONFIG,
    bruteLabActive = false,
    mutdogJuiceConfig = DEFAULT_MUTDOG_JUICE_CONFIG,
    mutdogLabActive = false,
    feralNurseJuiceConfig = DEFAULT_FERAL_NURSE_JUICE_CONFIG,
    feralNurseLabActive = false,
    emitSideEffects = true,
  } = options;
  const enemies = combat.enemies;
  const { w, h } = sim.size;
  const groundY = getBridgeGroundY(h);
  const heroX = w < 460 ? w * 0.19 : w * 0.22;
  const heroTargetHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
  const { slotCenters, effectiveSlotCount } = computeEnemySlotLayout(
    enemies,
    combat.director?.pendingReinforcements,
  );
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, effectiveSlotCount);
  const baseEnemySize = computeBaseEnemySize(w, h, effectiveSlotCount);
  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  const isAttackHoverNonSurge =
    hoveredColor === 'attack' && !(activePreview?.surgeTriggered ?? false);

  const getActorJuice = (actorId: string): ActorJuiceSnapshot => {
    if (tacticalViewActive) return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
    if (options.getActorJuice) return options.getActorJuice(actorId);
    return sim.actionSequencer.getActorJuice(actorId);
  };

  if (!sim.stalkerSamples) sim.stalkerSamples = new Map<string, StalkerFrameSample>();
  if (!sim.stalkerJuiceSamples) sim.stalkerJuiceSamples = new Map<string, StalkerJuiceSample>();
  if (!sim.spitterSamples) sim.spitterSamples = new Map<string, SpitterFrameSample>();
  if (!sim.spitterJuiceSamples) sim.spitterJuiceSamples = new Map<string, SpitterJuiceSample>();
  if (!sim.mutdogSamples) sim.mutdogSamples = new Map<string, MutdogFrameSample>();
  if (!sim.mutdogJuiceSamples) sim.mutdogJuiceSamples = new Map<string, MutdogJuiceSample>();
  if (!sim.feralNurseSamples) sim.feralNurseSamples = new Map<string, FeralNurseAnimSample>();
  if (!sim.feralNurseJuiceSamples) {
    sim.feralNurseJuiceSamples = new Map<string, FeralNurseJuiceSample>();
  }
  if (!sim.bruteSamples) sim.bruteSamples = new Map<string, BruteFrameSample>();
  if (!sim.bruteJuiceSamples) sim.bruteJuiceSamples = new Map<string, BruteJuiceSample>();
  if (!sim.matriarchSamples) sim.matriarchSamples = new Map<string, MatriarchFrameSample>();
  if (!sim.matriarchJuiceSamples) {
    sim.matriarchJuiceSamples = new Map<string, MatriarchJuiceSample>();
  }

  sim.stalkerSamples.clear();
  sim.stalkerJuiceSamples.clear();
  sim.spitterSamples.clear();
  sim.spitterJuiceSamples.clear();
  sim.bruteSamples.clear();
  sim.bruteJuiceSamples.clear();
  sim.mutdogSamples.clear();
  sim.mutdogJuiceSamples.clear();
  sim.feralNurseSamples.clear();
  sim.feralNurseJuiceSamples.clear();
  sim.matriarchSamples.clear();
  sim.matriarchJuiceSamples.clear();

  if (sim.stalkerFrames) {
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
        idx === frontLivingIdx;
      const armoredGuard = !isDead && enemy.armor > 0;
      const stalkerCutIn = getActorJuice(enemy.id);

      let juiceState = sim.stalkerJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createStalkerJuiceState(1337 + idx * 97);
        sim.stalkerJuiceStates.set(enemy.id, juiceState);
      }
      const juiceSample = stepStalkerJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        {
          dead: ea?.dead,
          koProgress: ea?.koProgress,
          attackAnimTimer: ea?.attackAnimTimer,
          attackAnimDuration: ea?.attackAnimDuration,
          staggerTimer: ea?.staggerTimer,
          staggerDuration: ea?.staggerDuration,
          bristleTimer: ea?.bristleTimer,
          bristleDuration: ea?.bristleDuration,
          bristleKind: ea?.bristleKind === 'retaliate' ? 'retaliate' : 'armor',
          ambushPrimed,
          armoredGuard,
          retaliateHover,
          staggeredStatus: Boolean(enemy.staggered),
          instanceIndex: idx,
        },
      );

      if (!ea?.dead && stalkerCutIn.active && stalkerCutIn.poseOverride !== 'none') {
        juiceSample.frameIndex = 1;
        juiceSample.frameBlendAlpha = 1;
        if (stalkerCutIn.poseOverride === 'attack_pose') {
          juiceSample.clawSlashProgress = Math.max(juiceSample.clawSlashProgress, 0.65);
        }
        if (stalkerCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
        }
      }

      const sample: StalkerFrameSample = {
        mode: juiceSample.mode,
        frameIndex: juiceSample.frameIndex,
        frame: STALKER_SHEET_FRAMES[juiceSample.frameIndex] ?? STALKER_SHEET_FRAMES[0],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: STALKER_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? STALKER_SHEET_FRAMES[0],
        frameBlendAlpha: juiceSample.frameBlendAlpha,
        blinkClosure: juiceSample.blinkClosure,
        xOffsetRatio: 0,
        yHopPx: juiceSample.hopYPx,
        breathScaleX: juiceSample.springScaleX,
        breathScaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        spineGlowIntensity: juiceSample.spineGlowIntensity,
        clawSlashProgress: juiceSample.clawSlashProgress,
        alpha: juiceSample.alpha,
      };

      sim.stalkerSamples.set(enemy.id, sample);
      sim.stalkerJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        if (juiceSample.slimeBurstTriggered || juiceSample.slashImpactTriggered) {
          const size = baseEnemySize * getMutantArchScale('stalker');
          const drawScale = size / STALKER_CANONICAL_HEIGHT;
          const stagger = getEnemyStaggerKinematics(ea);
          const cutInShiftX = stalkerCutIn.active ? stalkerCutIn.clashSlideX + stalkerCutIn.knockbackX : 0;
          const suppressStaggerDx =
            stalkerCutIn.isMeleeClash || (stalkerCutIn.active && stalkerCutIn.role === 'target');
          const ex =
            enemyBaseX +
            (slotCenters[idx] ?? idx) * enemyStepX +
            (suppressStaggerDx ? 0 : stagger.dx);
          const spriteX =
            ex +
            cutInShiftX +
            (stalkerCutIn.isMeleeClash ? 0 : juiceSample.offsetX * drawScale);
          const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
          const jawPos = projectSpriteLandmarkToStage(sample.frame.jawOriginRel, {
            frame: sample.frame,
            worldX: spriteX,
            worldY: enemyGroundY + juiceSample.hopYPx * drawScale + stagger.dy * 0.45,
            drawScale,
            facingSign: juiceSample.facingScale,
            nativeFacingSign: 1,
            rotationRad: stagger.rot * 0.28 + juiceSample.rotationRad + stalkerCutIn.leanRad,
            deform: juiceSample.deform,
            squashStretch: [
              stagger.scaleXMul * juiceSample.springScaleX * stalkerCutIn.scaleX,
              stagger.scaleYMul * juiceSample.springScaleY * stalkerCutIn.scaleY,
            ],
            shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0],
            swayAmpPx: juiceSample.swayAmpPx,
            swayPhase: juiceSample.swayPhase,
          });
          spawnBurst(sim, jawPos.x, jawPos.y, 8, '#A3E635', -0.4, 0.9, 95, 0.36, 0.24, 2.2, 2.8);
          if (juiceSample.slashImpactTriggered) {
            sim.trauma = Math.min(1, sim.trauma + 0.22);
          }
        }
      }
    }
  }

  if (sim.spitterFrames) {
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
        activePreview && isAttackHoverNonSurge && idx === frontLivingIdx
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdx, activePreview, enemies).willDie
          : false;
      const pustuleHover =
        !isDead &&
        isAttackHoverNonSurge &&
        !hoverWillKill &&
        enemy.passive === 'acid_jam' &&
        idx === frontLivingIdx;
      const armoredGuard = !isDead && enemy.armor > 0;

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

      const sample: SpitterFrameSample = {
        mode: juiceSample.mode,
        frameIndex: juiceSample.frameIndex,
        frame: SPITTER_SHEET_FRAMES[juiceSample.frameIndex] ?? SPITTER_SHEET_FRAMES[0],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: SPITTER_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? SPITTER_SHEET_FRAMES[0],
        frameBlendAlpha: juiceSample.frameBlendAlpha,
        xOffsetRatio: 0,
        yHopPx: juiceSample.hopYPx,
        breathScaleX: juiceSample.springScaleX,
        breathScaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        pustuleGlowIntensity: juiceSample.pustuleGlowIntensity,
        spitStreamProgress: juiceSample.spitStreamProgress,
        alpha: juiceSample.alpha,
      };

      const spitterCutIn = getActorJuice(enemy.id);
      if (!ea?.dead && !spitterLabActive && spitterCutIn.active) {
        juiceSample.facingScale = -1;
        if (spitterCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
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

      sim.spitterSamples.set(enemy.id, sample);
      sim.spitterJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const streamProg = Math.max(sample.spitStreamProgress, juiceSample.spitStreamProgress);
        if (streamProg > 0.01 && streamProg < 0.9) {
          const size = baseEnemySize * getMutantArchScale('spitter');
          const drawScale = size / SPITTER_CANONICAL_HEIGHT;
          const stagger = getEnemyStaggerKinematics(ea);
          const cutInShiftX = spitterCutIn.active ? spitterCutIn.clashSlideX + spitterCutIn.knockbackX : 0;
          const suppressStaggerDx =
            spitterCutIn.isMeleeClash || (spitterCutIn.active && spitterCutIn.role === 'target');
          const ex =
            enemyBaseX +
            (slotCenters[idx] ?? idx) * enemyStepX +
            (suppressStaggerDx ? 0 : stagger.dx);
          const spitterWorldX =
            ex +
            cutInShiftX +
            (spitterCutIn.isMeleeClash ? 0 : juiceSample.offsetX * drawScale);
          const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
          const hopY = juiceSample.hopYPx * drawScale;
          const sf = sample.frame;
          const mouthPos = projectSpriteLandmarkToStage(sf.mouthOriginRel, {
            frame: sf,
            worldX: spitterWorldX,
            worldY: enemyGroundY + hopY + stagger.dy * 0.45,
            drawScale,
            facingSign: juiceSample.facingScale,
            rotationRad: stagger.rot * 0.32 + juiceSample.rotationRad + spitterCutIn.leanRad,
            deform: juiceSample.deform,
            squashStretch: [
              stagger.scaleXMul * juiceSample.springScaleX * spitterCutIn.scaleX,
              stagger.scaleYMul * juiceSample.springScaleY * spitterCutIn.scaleY,
            ],
            shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0],
            swayAmpPx: juiceSample.swayAmpPx,
            swayPhase: juiceSample.swayPhase,
          });
          const heroCutIn = getActorJuice('hero');
          const heroImpactX = heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0) + 18;
          const heroImpactY = groundY - heroTargetHeight * 0.48;
          emitSpitterStreamParticles(sim, {
            mouthX: mouthPos.x,
            mouthY: mouthPos.y,
            targetX: heroImpactX,
            targetY: heroImpactY,
            groundY,
            streamProgress: streamProg,
            elapsed,
          });
        }
      }
    }

    const hasLivingSpitter = enemies.some((e) => e.archetype === 'spitter' && e.hp > 0);
    if (spitterLabActive && !hasLivingSpitter) {
      let labState = sim.spitterJuiceStates.get('spitter_lab_specimen');
      if (!labState) {
        labState = createSpitterJuiceState();
        sim.spitterJuiceStates.set('spitter_lab_specimen', labState);
      }
      const labJuice = stepSpitterJuice(
        labState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        spitterJuiceConfig,
        { instanceIndex: 0 },
      );
      sim.spitterJuiceSamples.set('spitter_lab_specimen', labJuice);
    }
  }

  if (sim.bruteFrames) {
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'brute') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const isAwakeAndUnstaggered =
        !isDead && !enemy.staggered && !(enemy.sleepCounter && enemy.sleepCounter > 0);
      const armorPrimed = isAwakeAndUnstaggered && activeIntent?.kind === 'armor';
      const heavyPrimed = isAwakeAndUnstaggered && activeIntent?.kind === 'heavy';
      const pauseRecover = isAwakeAndUnstaggered && activeIntent?.kind === 'pause';
      const hoverArmorPrev =
        !isDead &&
        activePreview &&
        activePreview.color === 'attack' &&
        idx === frontLivingIdx
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdx, activePreview, enemies)
          : null;
      const staggerHover = Boolean(hoverArmorPrev?.willStagger);
      const guardHover = Boolean(
        hoverArmorPrev &&
          !hoverArmorPrev.willStagger &&
          !hoverArmorPrev.willDie &&
          (enemy.armor > 0 || enemy.shieldPips > 0),
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
          armorPrimed,
          heavyPrimed,
          pauseRecover,
          guardHover,
          staggerHover,
          staggeredStatus: Boolean(enemy.staggered),
          weaponBroken: Boolean(enemy.weaponBroken),
          instanceIndex: idx,
        },
      );

      const sample: BruteFrameSample = {
        mode: juiceSample.mode,
        frameIndex: juiceSample.frameIndex,
        frame: BRUTE_SHEET_FRAMES[juiceSample.frameIndex] ?? BRUTE_SHEET_FRAMES[1],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: BRUTE_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? BRUTE_SHEET_FRAMES[1],
        frameBlendAlpha: juiceSample.frameBlendAlpha,
        xOffsetRatio: 0,
        yHopPx: juiceSample.hopYPx,
        breathScaleX: juiceSample.springScaleX,
        breathScaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        vialGlowIntensity: juiceSample.vialGlowIntensity,
        shellGlowIntensity: juiceSample.shellGlowIntensity,
        shockwaveIntensity: juiceSample.shockwaveIntensity,
        clawSlashProgress: juiceSample.clawSlashProgress,
        alpha: juiceSample.alpha,
      };

      const bruteCutIn = getActorJuice(enemy.id);
      if (!ea?.dead && !bruteLabActive && bruteCutIn.active) {
        juiceSample.facingScale = -1;
        if (bruteCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
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

      sim.bruteSamples.set(enemy.id, sample);
      sim.bruteJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const size = baseEnemySize * getMutantArchScale('brute');
        const drawScale = size / BRUTE_CANONICAL_HEIGHT;
        const stagger = getEnemyStaggerKinematics(ea);
        const cutInShiftX = bruteCutIn.active ? bruteCutIn.clashSlideX + bruteCutIn.knockbackX : 0;
        const suppressStaggerDx =
          bruteCutIn.isMeleeClash || (bruteCutIn.active && bruteCutIn.role === 'target');
        const ex =
          enemyBaseX +
          (slotCenters[idx] ?? idx) * enemyStepX +
          (suppressStaggerDx ? 0 : stagger.dx);
        const spriteX =
          ex +
          cutInShiftX +
          (bruteCutIn.isMeleeClash ? 0 : juiceSample.offsetX * drawScale);
        const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
        const hopY = juiceSample.hopYPx * drawScale;
        const bf = sample.frame;
        const juiceFacing = juiceSample.facingScale;
        const bruteProj = {
          frame: bf,
          worldX: spriteX,
          worldY: enemyGroundY + hopY + stagger.dy * 0.45,
          drawScale,
          facingSign: juiceFacing,
          rotationRad: stagger.rot * 0.28 + juiceSample.rotationRad + bruteCutIn.leanRad,
          deform: juiceSample.deform,
          squashStretch: [
            stagger.scaleXMul * juiceSample.springScaleX * bruteCutIn.scaleX,
            stagger.scaleYMul * juiceSample.springScaleY * bruteCutIn.scaleY,
          ] as [number, number],
          shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0] as [number, number],
          swayAmpPx: juiceSample.swayAmpPx,
          swayPhase: juiceSample.swayPhase,
        };
        const fistPos = projectSpriteLandmarkToStage(bf.impactOriginRel, bruteProj);
        const chestVialPos = projectSpriteLandmarkToStage(bf.vialOriginRel, bruteProj);
        const fistX = fistPos.x;
        const chestVialX = chestVialPos.x;
        const chestVialY = chestVialPos.y;

        if (juiceSample.seismicImpactTriggered) {
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
        if (juiceSample.vialShatterTriggered) {
          spawnBruteMutagenMist(sim, chestVialX, chestVialY, 14, 1.0);
          spawnBruteKineticShards(sim, chestVialX, chestVialY, enemyGroundY + 2, 8, 'vial', juiceFacing);
        }
        if (juiceSample.chitinShardTriggered) {
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
        if (juiceSample.footPlantTriggered) {
          spawnBurst(sim, spriteX - 14, enemyGroundY - 2, 7, '#94A3B8', 0, 0.55, 22, 0.24, 0.16, 2.0, 2.2);
        }
        if (juiceSample.mutagenMistProgress > 0.12) {
          const emitCount = juiceSample.mutagenMistProgress > 0.45 ? 2 : 1;
          spawnBruteMutagenMist(sim, chestVialX, chestVialY, emitCount, juiceSample.mutagenMistProgress);
        }
      }
    }

    const hasLivingBrute = enemies.some((e) => e.archetype === 'brute' && e.hp > 0);
    if (bruteLabActive && !hasLivingBrute) {
      let labState = sim.bruteJuiceStates.get('brute_lab_specimen');
      if (!labState) {
        labState = createBruteJuiceState();
        sim.bruteJuiceStates.set('brute_lab_specimen', labState);
      }
      const labJuice = stepBruteJuice(
        labState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        bruteJuiceConfig,
        { instanceIndex: 0 },
      );
      sim.bruteJuiceSamples.set('brute_lab_specimen', labJuice);

      if (emitSideEffects && dtStep > 0 && !tacticalViewActive) {
        const bf = BRUTE_SHEET_FRAMES[labJuice.frameIndex] ?? BRUTE_SHEET_FRAMES[1];
        const size = computeBaseEnemySize(w, h, 1) * getMutantArchScale('brute');
        const drawScale = size / BRUTE_CANONICAL_HEIGHT;
        const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.62);
        const labWorldX = labBaseX + labJuice.offsetX * drawScale;
        const labGroundY = groundY - 2;
        const labHopY = labJuice.hopYPx * drawScale;
        const labBruteProj = {
          frame: bf,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          deform: labJuice.deform,
          squashStretch: [labJuice.springScaleX, labJuice.springScaleY] as [number, number],
          shearPx: [labJuice.shearXPx, 0] as [number, number],
          swayAmpPx: labJuice.swayAmpPx,
          swayPhase: labJuice.swayPhase,
        };
        const fistX = projectSpriteLandmarkToStage(bf.impactOriginRel, labBruteProj).x;
        const chestVialPos = projectSpriteLandmarkToStage(bf.vialOriginRel, labBruteProj);
        const chestVialX = chestVialPos.x;
        const chestVialY = chestVialPos.y;

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
    }
  }

  if (sim.mutdogFrames) {
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'mutdog') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const isMaulPrimed =
        !isDead &&
        !enemy.staggered &&
        activeIntent?.kind === 'attack' &&
        Boolean(activeIntent.overwhelmMultiplier && activeIntent.overwhelmMultiplier > 1);
      const isPouncePrimed =
        !isDead &&
        !enemy.staggered &&
        activeIntent?.kind === 'attack' &&
        !isMaulPrimed;
      const isPauseRecover = !isDead && !enemy.staggered && activeIntent?.kind === 'pause';
      const isFeralGuard = !isDead && !enemy.staggered && enemy.armor > 0;
      const hoverArmorPrev =
        !isDead &&
        activePreview &&
        activePreview.color === 'attack' &&
        (idx === frontLivingIdx || activePreview.surgeTriggered)
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdx, activePreview, enemies)
          : null;
      const isGuardHover =
        !isDead &&
        !enemy.staggered &&
        hoveredColor === 'defense' &&
        (activeIntent?.kind === 'attack' || activeIntent?.kind === 'heavy');
      const isStaggerHover = Boolean(hoverArmorPrev?.willStagger);

      let juiceState = sim.mutdogJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createMutdogJuiceState();
        sim.mutdogJuiceStates.set(enemy.id, juiceState);
      }

      const juiceSample = stepMutdogJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        mutdogJuiceConfig,
        {
          dead: isDead || Boolean(ea?.dead),
          koProgress: ea?.koProgress ?? (isDead ? 1 : 0),
          attackAnimTimer: ea?.attackAnimTimer ?? 0,
          attackAnimDuration: ea?.attackAnimDuration ?? 0.62,
          mutdogAttackKind: ea?.mutdogAttackKind ?? 'pounce',
          staggerTimer: ea?.staggerTimer ?? 0,
          staggerDuration: ea?.staggerDuration ?? 0.44,
          bristleTimer: ea?.bristleTimer ?? 0,
          bristleDuration: ea?.bristleDuration ?? 0.74,
          maulPrimed: isMaulPrimed,
          pouncePrimed: isPouncePrimed,
          pauseRecover: isPauseRecover,
          feralGuard: isFeralGuard,
          guardHover: isGuardHover,
          staggerHover: isStaggerHover,
          staggeredStatus: Boolean(enemy.staggered),
          instanceIndex: idx,
        },
      );

      const sample: MutdogFrameSample = {
        mode: juiceSample.mode,
        frameIndex: juiceSample.frameIndex,
        frame: MUTDOG_SHEET_FRAMES[juiceSample.frameIndex] ?? MUTDOG_SHEET_FRAMES[0],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: MUTDOG_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? MUTDOG_SHEET_FRAMES[0],
        frameBlendAlpha: juiceSample.frameBlendAlpha,
        xOffsetRatio: 0,
        yHopPx: juiceSample.hopYPx,
        breathScaleX: juiceSample.springScaleX,
        breathScaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        lureGlowIntensity: juiceSample.lureGlowIntensity,
        droolIntensity: juiceSample.droolIntensity,
        pounceImpactIntensity:
          juiceSample.pounceImpactProgress > 0.01
            ? Math.sin(juiceSample.pounceImpactProgress * Math.PI)
            : 0,
        clawSlashProgress: juiceSample.clawSlashProgress,
        alpha: juiceSample.alpha,
      };

      const mutdogCutIn = getActorJuice(enemy.id);
      if (mutdogCutIn.active && mutdogCutIn.poseOverride && !isDead && !ea?.dead) {
        const overrideIdx =
          mutdogCutIn.poseOverride === 'attack_pose'
            ? ea?.mutdogAttackKind === 'maul'
              ? 10
              : 11
            : mutdogCutIn.poseOverride === 'recoil_pose'
              ? 12
              : mutdogCutIn.poseOverride === 'brace_pose'
                ? 6
                : null;
        if (overrideIdx !== null) {
          sample.frameIndex = overrideIdx;
          sample.frame = MUTDOG_SHEET_FRAMES[overrideIdx] ?? sample.frame;
          sample.frameBlendAlpha = 1;
        }
      }

      sim.mutdogSamples.set(enemy.id, sample);
      sim.mutdogJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const size = baseEnemySize * getMutantArchScale('mutdog');
        const mf = sample.frame;
        const drawScale = (size / MUTDOG_CANONICAL_HEIGHT) * (mf.frameScale ?? 1);
        const stagger = getEnemyStaggerKinematics(ea);
        const cutInShiftX = mutdogCutIn.active ? mutdogCutIn.clashSlideX + mutdogCutIn.knockbackX : 0;
        const suppressStaggerDx =
          mutdogCutIn.isMeleeClash || (mutdogCutIn.active && mutdogCutIn.role === 'target');
        const ex =
          enemyBaseX +
          (slotCenters[idx] ?? idx) * enemyStepX +
          (suppressStaggerDx ? 0 : stagger.dx);
        const spriteX =
          ex +
          cutInShiftX +
          (mutdogCutIn.isMeleeClash ? 0 : juiceSample.offsetX * drawScale);
        const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
        const hopY = juiceSample.hopYPx * drawScale;
        const juiceFacing = juiceSample.facingScale;
        const mutdogProj = {
          frame: mf,
          worldX: spriteX,
          worldY: enemyGroundY + hopY + stagger.dy * 0.45,
          drawScale,
          facingSign: juiceFacing,
          rotationRad: stagger.rot * 0.28 + juiceSample.rotationRad + mutdogCutIn.leanRad,
          deform: juiceSample.deform,
          squashStretch: [
            stagger.scaleXMul * juiceSample.springScaleX * mutdogCutIn.scaleX,
            stagger.scaleYMul * juiceSample.springScaleY * mutdogCutIn.scaleY,
          ] as [number, number],
          shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0] as [number, number],
          swayAmpPx: juiceSample.swayAmpPx,
          swayPhase: juiceSample.swayPhase,
        };
        const clawX = projectSpriteLandmarkToStage(mf.clawOriginRel, mutdogProj).x;
        const mawPos = projectSpriteLandmarkToStage(mf.mawOriginRel, mutdogProj);
        const mawX = mawPos.x;
        const mawY = mawPos.y;

        if (juiceSample.pounceImpactTriggered) {
          sim.trauma = Math.min(1, sim.trauma + 0.30 * mutdogJuiceConfig.feralVfxStrength);
          spawnMutdogLeapDust(sim, clawX, enemyGroundY, 12, mutdogJuiceConfig.feralVfxStrength);
          spawnMutdogDroolSplatter(
            sim,
            mawX,
            mawY,
            enemyGroundY + 2,
            8,
            juiceFacing,
            mutdogJuiceConfig.feralVfxStrength,
          );
        }
        if (juiceSample.droolBurstTriggered) {
          spawnMutdogDroolSplatter(
            sim,
            mawX,
            mawY,
            enemyGroundY + 2,
            10,
            juiceFacing,
            mutdogJuiceConfig.feralVfxStrength,
          );
        }
        if (juiceSample.pawPlantTriggered) {
          spawnMutdogLeapDust(sim, spriteX - 10, enemyGroundY, 6, 0.72);
        }
      }
    }

    const hasLivingMutdog = enemies.some((e) => e.archetype === 'mutdog' && e.hp > 0);
    if (mutdogLabActive && !hasLivingMutdog) {
      let labState = sim.mutdogJuiceStates.get('mutdog_lab_specimen');
      if (!labState) {
        labState = createMutdogJuiceState();
        sim.mutdogJuiceStates.set('mutdog_lab_specimen', labState);
      }
      const labJuice = stepMutdogJuice(
        labState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        mutdogJuiceConfig,
        { instanceIndex: 0 },
      );
      sim.mutdogJuiceSamples.set('mutdog_lab_specimen', labJuice);

      if (emitSideEffects && dtStep > 0 && !tacticalViewActive) {
        const mf = MUTDOG_SHEET_FRAMES[labJuice.frameIndex] ?? MUTDOG_SHEET_FRAMES[0];
        const size = computeBaseEnemySize(w, h, 1) * getMutantArchScale('mutdog');
        const drawScale = (size / MUTDOG_CANONICAL_HEIGHT) * (mf.frameScale ?? 1);
        const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.60);
        const labWorldX = labBaseX + labJuice.offsetX * drawScale;
        const labGroundY = groundY - 2;
        const labHopY = labJuice.hopYPx * drawScale;
        const labMutdogProj = {
          frame: mf,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          deform: labJuice.deform,
          squashStretch: [labJuice.springScaleX, labJuice.springScaleY] as [number, number],
          shearPx: [labJuice.shearXPx, 0] as [number, number],
          swayAmpPx: labJuice.swayAmpPx,
          swayPhase: labJuice.swayPhase,
        };
        const clawX = projectSpriteLandmarkToStage(mf.clawOriginRel, labMutdogProj).x;
        const mawPos = projectSpriteLandmarkToStage(mf.mawOriginRel, labMutdogProj);
        const mawX = mawPos.x;
        const mawY = mawPos.y;

        if (labJuice.pounceImpactTriggered) {
          sim.trauma = Math.min(1, sim.trauma + 0.30 * mutdogJuiceConfig.feralVfxStrength);
          spawnMutdogLeapDust(sim, clawX, labGroundY, 13, mutdogJuiceConfig.feralVfxStrength);
          spawnMutdogDroolSplatter(
            sim,
            mawX,
            mawY,
            labGroundY + 2,
            9,
            labJuice.facingScale,
            mutdogJuiceConfig.feralVfxStrength,
          );
        }
        if (labJuice.droolBurstTriggered) {
          spawnMutdogDroolSplatter(
            sim,
            mawX,
            mawY,
            labGroundY + 2,
            10,
            labJuice.facingScale,
            mutdogJuiceConfig.feralVfxStrength,
          );
        }
        if (labJuice.pawPlantTriggered) {
          spawnMutdogLeapDust(sim, labWorldX - 10, labGroundY, 6, 0.72);
        }
      }
    }
  }

  if (sim.feralNurseFrames) {
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'feral_nurse') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const isAwake = !isDead && !enemy.staggered && !(enemy.sleepCounter && enemy.sleepCounter > 0);
      const isCloaked = !isDead && (enemy.cloakedTurns ?? 0) > 0;
      const isPreparePrimed = isAwake && activeIntent?.kind === 'charge';
      const isPiercePrimed =
        isAwake && (activeIntent?.kind === 'attack' || activeIntent?.kind === 'heavy');
      const isFeralGuard = !isDead && !enemy.staggered && enemy.armor > 0;
      const hoverArmorPrev =
        !isDead &&
        activePreview &&
        activePreview.color === 'attack' &&
        (idx === frontLivingIdx || activePreview.surgeTriggered)
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdx, activePreview, enemies)
          : null;
      const isGuardHover =
        isAwake &&
        hoveredColor === 'defense' &&
        (activeIntent?.kind === 'attack' || activeIntent?.kind === 'heavy');
      const isStaggerHover = Boolean(hoverArmorPrev?.willStagger);

      let juiceState = sim.feralNurseJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createFeralNurseJuiceState();
        sim.feralNurseJuiceStates.set(enemy.id, juiceState);
      }

      const combatSync = {
        dead: isDead || Boolean(ea?.dead),
        koProgress: ea?.koProgress ?? (isDead ? 1 : 0),
        staggerTimer: ea?.staggerTimer ?? 0,
        staggerDuration: ea?.staggerDuration ?? 0.44,
        attackAnimTimer: ea?.attackAnimTimer ?? 0,
        attackAnimDuration: ea?.attackAnimDuration ?? 0.86,
        cloakCastTimer: ea?.cloakCastTimer ?? 0,
        cloakCastDuration: ea?.cloakCastDuration ?? 0.72,
        cloaked: isCloaked,
        preparePrimed: isPreparePrimed,
        piercePrimed: isPiercePrimed,
        feralGuard: isFeralGuard,
        guardHover: isGuardHover,
        staggerHover: isStaggerHover,
        staggered: Boolean(enemy.staggered),
      };

      const juiceSample = stepFeralNurseJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        feralNurseJuiceConfig,
        feralNurseLabActive ? undefined : combatSync,
      );

      const sample: FeralNurseAnimSample = {
        mode: isDead
          ? 'death'
          : isCloaked
            ? 'opticalCloak'
            : (ea?.cloakCastTimer ?? 0) > 0
              ? 'cloakCast'
              : (ea?.attackAnimTimer ?? 0) > 0
                ? 'pierceStrike'
                : (ea?.staggerTimer ?? 0) > 0
                  ? 'pain'
                  : isPreparePrimed
                    ? 'prepareCoil'
                    : isFeralGuard
                      ? 'feralGuard'
                      : 'idle',
        frameIndex: juiceSample.frameIndex,
        frame: FERAL_NURSE_SHEET_FRAMES[juiceSample.frameIndex] ?? FERAL_NURSE_SHEET_FRAMES[1],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: FERAL_NURSE_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? FERAL_NURSE_SHEET_FRAMES[1],
        blendAlpha: juiceSample.blendAlpha,
        xShiftPx: juiceSample.xShiftPx,
        yHopPx: juiceSample.hopYPx,
        scaleX: juiceSample.springScaleX,
        scaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        alpha: juiceSample.alpha,
        headsetGlowIntensity: juiceSample.headsetGlowIntensity,
        cloakIntensity: juiceSample.cloakIntensity,
        clawSlashProgress: juiceSample.clawSlashProgress,
        pierceImpactIntensity: juiceSample.pierceImpactIntensity,
      };

      const feralNurseCutIn = getActorJuice(enemy.id);
      if (feralNurseCutIn.active && !feralNurseLabActive && !isDead && !ea?.dead) {
        juiceSample.facingScale = -1;
        if (feralNurseCutIn.isMeleeClash) {
          juiceSample.xShiftPx = 0;
          sample.xShiftPx = 0;
        }
        if (feralNurseCutIn.poseOverride && feralNurseCutIn.poseOverride !== 'none') {
          const overrideIdx =
            feralNurseCutIn.poseOverride === 'attack_pose'
              ? 23
              : feralNurseCutIn.poseOverride === 'recoil_pose'
                ? 28
                : feralNurseCutIn.poseOverride === 'brace_pose'
                  ? 11
                  : null;
          if (overrideIdx !== null) {
            sample.frameIndex = overrideIdx;
            sample.frame = FERAL_NURSE_SHEET_FRAMES[overrideIdx] ?? sample.frame;
            sample.blendAlpha = 1;
          }
        }
      }

      sim.feralNurseSamples.set(enemy.id, sample);
      sim.feralNurseJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const size = baseEnemySize * getMutantArchScale('feral_nurse');
        const ff = sample.frame;
        const drawScale = (size / FERAL_NURSE_CANONICAL_HEIGHT) * (ff.frameScale ?? 1);
        const stagger = getEnemyStaggerKinematics(ea);
        const cutInShiftX = feralNurseCutIn.active
          ? feralNurseCutIn.clashSlideX + feralNurseCutIn.knockbackX
          : 0;
        const suppressStaggerDx =
          feralNurseCutIn.isMeleeClash ||
          (feralNurseCutIn.active && feralNurseCutIn.role === 'target');
        const ex =
          enemyBaseX +
          (slotCenters[idx] ?? idx) * enemyStepX +
          (suppressStaggerDx ? 0 : stagger.dx);
        const spriteX =
          ex +
          cutInShiftX +
          (feralNurseCutIn.isMeleeClash ? 0 : juiceSample.xShiftPx * drawScale);
        const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
        const hopY = juiceSample.hopYPx * drawScale;
        const juiceFacing = juiceSample.facingScale;
        const clawPos = projectSpriteLandmarkToStage(ff.clawOriginRel, {
          frame: ff,
          worldX: spriteX,
          worldY: enemyGroundY + hopY + stagger.dy * 0.45,
          drawScale,
          facingSign: juiceFacing,
          rotationRad: stagger.rot * 0.28 + juiceSample.rotationRad + feralNurseCutIn.leanRad,
          deform: juiceSample.deform,
          squashStretch: [
            stagger.scaleXMul * juiceSample.springScaleX * feralNurseCutIn.scaleX,
            stagger.scaleYMul * juiceSample.springScaleY * feralNurseCutIn.scaleY,
          ],
          shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0],
          swayAmpPx: juiceSample.swayAmpPx,
          swayPhase: juiceSample.swayPhase,
        });
        const clawX = clawPos.x;
        const clawY = clawPos.y;

        if (juiceSample.cloakTriggered) {
          spawnFeralNurseCloakShimmer(sim, spriteX, enemyGroundY - size * 0.48, 16);
        }
        if (juiceSample.pierceImpactTriggered) {
          sim.trauma = Math.min(1, sim.trauma + 0.24);
          spawnFeralNurseLeapDust(sim, clawX, enemyGroundY, 10, 1.0);
          spawnFeralNurseIchorSpray(sim, clawX, clawY, enemyGroundY + 2, 10, juiceFacing, 1.05);
        }
        if (juiceSample.ichorBurstTriggered) {
          spawnFeralNurseIchorSpray(
            sim,
            spriteX,
            enemyGroundY - size * 0.45,
            enemyGroundY + 2,
            10,
            -juiceFacing,
            1.0,
          );
        }
        if (juiceSample.heelPlantTriggered) {
          spawnFeralNurseLeapDust(sim, spriteX - 8, enemyGroundY, 5, 0.68);
        }
      }
    }

    const hasLivingFeralNurse = enemies.some((e) => e.archetype === 'feral_nurse' && e.hp > 0);
    if (feralNurseLabActive && !hasLivingFeralNurse) {
      let labState = sim.feralNurseJuiceStates.get('feral_nurse_lab_specimen');
      if (!labState) {
        labState = createFeralNurseJuiceState();
        sim.feralNurseJuiceStates.set('feral_nurse_lab_specimen', labState);
      }
      const labJuice = stepFeralNurseJuice(
        labState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        feralNurseJuiceConfig,
      );
      sim.feralNurseJuiceSamples.set('feral_nurse_lab_specimen', labJuice);

      if (emitSideEffects && dtStep > 0 && !tacticalViewActive) {
        const ff = FERAL_NURSE_SHEET_FRAMES[labJuice.frameIndex] ?? FERAL_NURSE_SHEET_FRAMES[0];
        const size = computeBaseEnemySize(w, h, 1) * getMutantArchScale('feral_nurse');
        const drawScale = (size / FERAL_NURSE_CANONICAL_HEIGHT) * (ff.frameScale ?? 1);
        const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.58);
        const labWorldX = labBaseX + labJuice.xShiftPx * drawScale;
        const labGroundY = groundY - 2;
        const labHopY = labJuice.hopYPx * drawScale;
        const clawPos = projectSpriteLandmarkToStage(ff.clawOriginRel, {
          frame: ff,
          worldX: labWorldX,
          worldY: labGroundY + labHopY,
          drawScale,
          facingSign: labJuice.facingScale,
          rotationRad: labJuice.rotationRad,
          deform: labJuice.deform,
          squashStretch: [labJuice.springScaleX, labJuice.springScaleY],
          shearPx: [labJuice.shearXPx, 0],
          swayAmpPx: labJuice.swayAmpPx,
          swayPhase: labJuice.swayPhase,
        });
        const clawX = clawPos.x;
        const clawY = clawPos.y;

        if (labJuice.cloakTriggered) {
          spawnFeralNurseCloakShimmer(sim, labWorldX, labGroundY - size * 0.48, 16);
        }
        if (labJuice.pierceImpactTriggered) {
          sim.trauma = Math.min(1, sim.trauma + 0.24);
          spawnFeralNurseLeapDust(sim, clawX, labGroundY, 11, 1.0);
          spawnFeralNurseIchorSpray(sim, clawX, clawY, labGroundY + 2, 10, labJuice.facingScale, 1.05);
        }
        if (labJuice.ichorBurstTriggered) {
          spawnFeralNurseIchorSpray(
            sim,
            labWorldX,
            labGroundY - size * 0.45,
            labGroundY + 2,
            10,
            -labJuice.facingScale,
            1.0,
          );
        }
        if (labJuice.heelPlantTriggered) {
          spawnFeralNurseLeapDust(sim, labWorldX - 8, labGroundY, 5, 0.68);
        }
      }
    }
  }

  if (sim.matriarchFrames) {
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (enemy.archetype !== 'boss') continue;
      const ea = sim.enemyAnims.get(enemy.id);
      const isDead = enemy.hp <= 0;
      if (isDead && (!ea || !ea.dead || ea.koProgress >= 1)) continue;
      const activeIntent = enemy.intentCycle[enemy.currentIntentIndex];
      const heavyOrAcidPrimed =
        !isDead &&
        !enemy.staggered &&
        !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
        (activeIntent?.kind === 'heavy' ||
          activeIntent?.kind === 'acid' ||
          activeIntent?.kind === 'charge');
      const armoredGuard = !isDead && enemy.armor > 0;
      const matriarchCutIn = getActorJuice(enemy.id);

      let juiceState = sim.matriarchJuiceStates.get(enemy.id);
      if (!juiceState) {
        juiceState = createMatriarchJuiceState(2099 + idx * 131);
        sim.matriarchJuiceStates.set(enemy.id, juiceState);
      }

      const juiceSample = stepMatriarchJuice(
        juiceState,
        tacticalViewActive ? 0 : dtStep,
        tacticalViewActive ? 0 : elapsed,
        {
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          dead: ea?.dead,
          koProgress: ea?.koProgress,
          attackAnimTimer: ea?.attackAnimTimer,
          attackAnimDuration: ea?.attackAnimDuration,
          staggerTimer: ea?.staggerTimer,
          staggerDuration: ea?.staggerDuration,
          bristleTimer: ea?.bristleTimer,
          bristleDuration: ea?.bristleDuration,
          heavyOrAcidPrimed,
          armoredGuard,
          staggeredStatus: Boolean(enemy.staggered),
          instanceIndex: idx,
        },
      );

      if (!ea?.dead && matriarchCutIn.active && matriarchCutIn.poseOverride !== 'none') {
        if (matriarchCutIn.poseOverride === 'attack_pose') {
          juiceSample.clawSlashProgress = Math.max(juiceSample.clawSlashProgress, 0.65);
        }
        if (matriarchCutIn.isMeleeClash) {
          juiceSample.offsetX = 0;
        }
      }

      const sample: MatriarchFrameSample = {
        mode: juiceSample.mode,
        frameIndex: juiceSample.frameIndex,
        frame: MATRIARCH_SHEET_FRAMES[juiceSample.frameIndex] ?? MATRIARCH_SHEET_FRAMES[0],
        prevFrameIndex: juiceSample.prevFrameIndex,
        prevFrame: MATRIARCH_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? MATRIARCH_SHEET_FRAMES[0],
        frameBlendAlpha: juiceSample.frameBlendAlpha,
        isBackExploded: juiceSample.isBackExploded,
        ruptureProgress: juiceSample.ruptureProgress,
        xOffsetRatio: 0,
        yHopPx: juiceSample.hopYPx,
        breathScaleX: juiceSample.springScaleX,
        breathScaleY: juiceSample.springScaleY,
        tiltRad: juiceSample.rotationRad,
        backGlowIntensity: juiceSample.backGlowIntensity,
        eyeGlowIntensity: juiceSample.eyeGlowIntensity,
        clawSlashProgress: juiceSample.clawSlashProgress,
        alpha: juiceSample.alpha,
      };

      sim.matriarchSamples.set(enemy.id, sample);
      sim.matriarchJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        if (
          juiceSample.backExplosionTriggered ||
          juiceSample.slimeBurstTriggered ||
          juiceSample.slashImpactTriggered
        ) {
          const size = baseEnemySize * getMutantArchScale('boss');
          const drawScale = size / MATRIARCH_CANONICAL_HEIGHT;
          const stagger = getEnemyStaggerKinematics(ea);
          const cutInShiftX = matriarchCutIn.active
            ? matriarchCutIn.clashSlideX + matriarchCutIn.knockbackX
            : 0;
          const suppressStaggerDx =
            matriarchCutIn.isMeleeClash ||
            (matriarchCutIn.active && matriarchCutIn.role === 'target');
          const ex =
            enemyBaseX +
            (slotCenters[idx] ?? idx) * enemyStepX +
            (suppressStaggerDx ? 0 : stagger.dx);
          const spriteX =
            ex +
            cutInShiftX +
            (matriarchCutIn.isMeleeClash ? 0 : juiceSample.offsetX * drawScale);
          const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
          const hopY = juiceSample.hopYPx * drawScale;
          const bossProj = {
            frame: sample.frame,
            worldX: spriteX,
            worldY: enemyGroundY + hopY + stagger.dy * 0.45,
            drawScale,
            facingSign: juiceSample.facingScale,
            nativeFacingSign: 1 as const,
            rotationRad: stagger.rot * 0.28 + juiceSample.rotationRad + matriarchCutIn.leanRad,
            deform: juiceSample.deform,
            squashStretch: [
              stagger.scaleXMul * juiceSample.springScaleX * matriarchCutIn.scaleX,
              stagger.scaleYMul * juiceSample.springScaleY * matriarchCutIn.scaleY,
            ] as [number, number],
            shearPx: [juiceSample.shearXPx + stagger.shearPx * 0.45, 0] as [number, number],
            swayAmpPx: juiceSample.swayAmpPx,
            swayPhase: juiceSample.swayPhase,
          };

          if (juiceSample.backExplosionTriggered) {
            const backPos = projectSpriteLandmarkToStage(sample.frame.backOriginRel, bossProj);
            const backX = backPos.x;
            const backY = backPos.y;
            sim.trauma = Math.min(1, sim.trauma + 0.58);
            sim.hitstop = Math.max(sim.hitstop, 0.08);
            spawnBurst(sim, backX, backY, 18, '#BEF264', 0, 1.35, 195, 0.56, 0.34, 3.0, 4.2);
            spawnBurst(sim, backX, backY - 6, 14, '#FB923C', 0, 1.25, 165, 0.48, 0.28, 2.8, 3.8);
            spawnBurst(sim, backX, backY, 10, '#EC4899', 0, 1.15, 145, 0.42, 0.24, 2.4, 3.4);
            spawnBruteKineticShards(sim, backX, backY, enemyGroundY + 2, 18, 'chitin', 1);
          }

          if (juiceSample.slimeBurstTriggered || juiceSample.slashImpactTriggered) {
            const jawPos = projectSpriteLandmarkToStage(sample.frame.jawOriginRel, bossProj);
            const jawX = jawPos.x;
            const jawY = jawPos.y;
            spawnBurst(sim, jawX, jawY, 10, '#A3E635', -0.45, 0.95, 110, 0.38, 0.26, 2.4, 3.0);
            if (juiceSample.slashImpactTriggered) {
              sim.trauma = Math.min(1, sim.trauma + 0.26);
            }
          }
        }
      }
    }
  }
}

export function emitSpitterStreamParticles(
  sim: CombatStageSim,
  params: {
    mouthX: number;
    mouthY: number;
    targetX: number;
    targetY: number;
    groundY: number;
    streamProgress: number;
    elapsed: number;
  },
): void {
  const { mouthX, mouthY, targetX, targetY, groundY, streamProgress, elapsed } = params;
  const p = Math.max(0, Math.min(1, streamProgress));
  if (p <= 0.01 || p >= 0.9) return;
  const headT = Math.min(1, Math.pow(p / 0.30, 0.75));
  const tailT = p <= 0.76 ? 0 : Math.min(0.95, Math.pow((p - 0.76) / 0.24, 1.1));
  const spanT = Math.max(0.02, headT - tailT);
  const spanX = Math.abs(mouthX - targetX);
  const ctrlX = (mouthX + targetX) * 0.5;
  const ctrlY = Math.min(mouthY, targetY) - Math.min(54, spanX * 0.14);

  const evalPt = (t: number) => {
    const inv = 1 - t;
    return {
      x: inv * inv * mouthX + 2 * inv * t * ctrlX + t * t * targetX,
      y: inv * inv * mouthY + 2 * inv * t * ctrlY + t * t * targetY,
    };
  };

  const headPt = evalPt(tailT + spanT);
  const midPt = evalPt(tailT + spanT * (0.25 + (elapsed * 3.7) % 0.65));
  const bileColors = ['#FEF08A', '#FACC15', '#EAB308', '#A3E635'];

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
        pt.shape = 2;
        break;
      }
    }
  }

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
