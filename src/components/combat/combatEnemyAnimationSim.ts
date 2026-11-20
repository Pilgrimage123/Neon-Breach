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
  sampleBruteFrame,
} from '../../utils/bruteSpriteSheet';
import {
  type BruteJuiceConfig,
  type BruteJuiceSample,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  stepBruteJuice,
} from '../../utils/bruteJuiceController';
import {
  SPITTER_CANONICAL_HEIGHT,
  SPITTER_SHEET_FRAMES,
  type SpitterFrameSample,
  sampleSpitterFrame,
} from '../../utils/spitterSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceSample,
  createSpitterJuiceState,
  stepSpitterJuice,
} from '../../utils/spitterJuiceController';
import {
  type StalkerFrameSample,
  sampleStalkerFrame,
} from '../../utils/stalkerSpriteSheet';
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
} from './combatVfx';
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
  const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
  const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
  const frontLivingIdx = enemies.findIndex((e) => e.hp > 0);
  const isAttackHoverNonSurge =
    hoveredColor === 'attack' && !(activePreview?.surgeTriggered ?? false);

  const getActorJuice = (actorId: string): ActorJuiceSnapshot => {
    if (tacticalViewActive) return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
    if (options.getActorJuice) return options.getActorJuice(actorId);
    return sim.actionSequencer.getActorJuice(actorId);
  };

  if (!sim.stalkerSamples) sim.stalkerSamples = new Map<string, StalkerFrameSample>();
  if (!sim.spitterSamples) sim.spitterSamples = new Map<string, SpitterFrameSample>();
  if (!sim.spitterJuiceSamples) sim.spitterJuiceSamples = new Map<string, SpitterJuiceSample>();
  if (!sim.bruteSamples) sim.bruteSamples = new Map<string, BruteFrameSample>();
  if (!sim.bruteJuiceSamples) sim.bruteJuiceSamples = new Map<string, BruteJuiceSample>();

  sim.stalkerSamples.clear();
  sim.spitterSamples.clear();
  sim.spitterJuiceSamples.clear();
  sim.bruteSamples.clear();
  sim.bruteJuiceSamples.clear();

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
      sim.stalkerSamples.set(enemy.id, sample);
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
      sample.frameIndex = juiceSample.frameIndex;
      sample.frame = SPITTER_SHEET_FRAMES[juiceSample.frameIndex] ?? sample.frame;
      sample.prevFrameIndex = juiceSample.prevFrameIndex;
      sample.prevFrame = SPITTER_SHEET_FRAMES[juiceSample.prevFrameIndex] ?? sample.frame;
      sample.frameBlendAlpha = juiceSample.frameBlendAlpha;
      sample.pustuleGlowIntensity = juiceSample.pustuleGlowIntensity;
      sample.spitStreamProgress = Math.max(sample.spitStreamProgress, juiceSample.spitStreamProgress);

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
      sim.spitterSamples.set(enemy.id, sample);
      sim.spitterJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const streamProg = Math.max(sample.spitStreamProgress, juiceSample.spitStreamProgress);
        if (streamProg > 0.01 && streamProg < 0.9) {
          const size = baseEnemySize * 0.94;
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
          const headDeformDx = juiceSample.deform.head.dx * drawScale * juiceSample.facingScale;
          const headDeformDy = juiceSample.deform.head.dy * drawScale;
          const mouthX = spitterWorldX + sf.mouthOriginRel.dx * drawScale * (-juiceSample.facingScale) + headDeformDx;
          const mouthY = enemyGroundY + hopY + sf.mouthOriginRel.dy * drawScale + headDeformDy;
          const heroCutIn = getActorJuice('hero');
          const heroImpactX = heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0) + 18;
          const heroImpactY = groundY - heroTargetHeight * 0.48;
          emitSpitterStreamParticles(sim, {
            mouthX,
            mouthY,
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
      const heavyPrimed =
        !isDead &&
        !enemy.staggered &&
        !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
        activeIntent?.kind === 'heavy';
      const hoverArmorPrev =
        !isDead &&
        activePreview &&
        activePreview.color === 'attack' &&
        idx === frontLivingIdx
          ? computeEnemyArmorPreview(enemy, idx, frontLivingIdx, activePreview, enemies)
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
      sim.bruteSamples.set(enemy.id, sample);
      sim.bruteJuiceSamples.set(enemy.id, juiceSample);

      if (emitSideEffects && dtStep > 0 && !ea?.dead && !tacticalViewActive) {
        const size = baseEnemySize * 1.32;
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
        const fistX = spriteX + bf.impactOriginRel.dx * drawScale * (-juiceFacing);
        const chestVialX = spriteX + bf.vialOriginRel.dx * drawScale * (-juiceFacing);
        const chestVialY = enemyGroundY + hopY + bf.vialOriginRel.dy * drawScale;

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
        const rawBaseSize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
        const size = rawBaseSize * 1.28;
        const drawScale = size / BRUTE_CANONICAL_HEIGHT;
        const labBaseX = Math.round(heroX + (enemyBaseX - heroX) * 0.62);
        const labWorldX = labBaseX + labJuice.offsetX * drawScale;
        const labGroundY = groundY - 2;
        const labHopY = labJuice.hopYPx * drawScale;
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
