import type { AnimationCue } from '../../engine/types';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { KIRA_DODGE_DURATION, shouldKiraDodgeAttack } from '../../utils/kiraSpriteSheet';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import {
  addOrGrowFloorBlood,
  emitBloodDroplets,
  spawnAlienBloodImpact,
  spawnStatusTrail,
} from './combatBloodSimulation';
import type { EnemyCueDispatchContext } from './combatEnemyCueDispatcher';
import { classifyEnemyAttackStaging } from './combatStagingClassifier';
import {
  addGroundFissure,
  drainTriggerImpacts,
  ensureEnemyAnim,
  spawnBruteKineticShards,
  spawnBurst,
  spawnFloatingText,
  spawnStyledProjectileVolley,
  triggerEnemyHitStagger,
  triggerKiraDodgeVfx,
} from './combatVfx';
import { getEnemyStatusVisualFlags } from './mutantBlood';

export function dispatchEnemyAttackCue(
  cue: AnimationCue,
  ctx: EnemyCueDispatchContext,
  state: { cutInStarted: boolean; kiraDodgeScheduled: boolean },
): void {
  const {
    sim,
    combat,
    hero,
    batchKey,
    w,
    h,
    groundY,
    heroX,
    presCfg,
    tacticalViewActive,
    tempoScale,
    koIds,
    allActorIds,
    getEnemyPos,
    buildActorBounds,
    triggerEnemyKo,
  } = ctx;
  const charId = hero.characterId ?? 'kira';

  const attacker = combat.enemies.find((e) => e.id === cue.targetId);
  const attackerArch = attacker?.archetype ?? 'larva';
  const attackerPos = getEnemyPos(cue.targetId);
  const blocked = cue.blocked ?? 0;
  const armorDamage = cue.armorDamage ?? 0;
  const hpDamage = cue.hpDamage ?? (cue.value ?? 0);
  const reflected = cue.reflectedDamage ?? 0;
  const isAcid = cue.kind === 'enemy_acid';
  const isSpitterClawRend = attackerArch === 'spitter' && !isAcid && Boolean(cue.clawRend);
  const isBruteHeavy = attackerArch === 'brute' && !isAcid && Boolean(cue.heavySmash);

  if (cue.targetId) {
    const ea = ensureEnemyAnim(sim, cue.targetId);
    ea.lunge = 1;
    ea.lungeDir = -1;
    const animDur =
      attackerArch === 'spitter'
        ? isAcid
          ? 0.78
          : 0.56
        : attackerArch === 'brute'
          ? isBruteHeavy
            ? 0.74
            : 0.58
          : 0.52;
    ea.attackAnimDuration = animDur;
    ea.attackAnimTimer = animDur;
    if (attackerArch === 'spitter') {
      ea.spitterAttackKind = isAcid ? 'spit' : 'claw';
    } else if (attackerArch === 'brute') {
      ea.bruteAttackKind = isBruteHeavy ? 'heavy' : 'attack';
    }
    if (attacker) {
      const status = getEnemyStatusVisualFlags(attacker, sim.enemyInitialArmor.get(attacker.id));
      if (status.isBleeding || status.isShredded) {
        spawnStatusTrail(
          sim,
          attacker.archetype,
          attackerPos.x,
          attackerPos.x - w * 0.08,
          attackerPos.groundY,
          4,
        );
      }
    }
  }

  const isStalkerAmbush = attackerArch === 'stalker' && blocked + hpDamage >= 10;
  const isLethal = hero.hp <= 0;
  const lowHp = hero.hp <= hero.maxHp * 0.35;

  if (isLethal) {
    sim.heroState = triggerCharacterAnimation(sim.heroState, 'defeat', charId);
  }

  if (isAcid && attackerArch === 'spitter') {
    const mouthX = attackerPos.x - 42;
    const mouthY = attackerPos.groundY - 116;
    spawnBurst(sim, mouthX, mouthY, 8, '#FEF08A', 2, 0.7);
    sim.pendingImpacts.push({
      triggerOn: 'delay',
      delayRemaining: 0.17,
      execute: () => {
        spawnBurst(sim, mouthX - 8, mouthY, 16, '#FACC15', 2, 1.05);
        spawnBurst(sim, mouthX - 14, mouthY + 2, 12, '#A3E635', 2, 0.95);
        spawnBurst(sim, mouthX - 6, mouthY - 2, 8, '#FEF08A', 0, 0.85);
        emitBloodDroplets(
          sim,
          mouthX - 12,
          mouthY,
          attackerPos.groundY,
          10,
          1.15,
          'spitter',
          'kinetic',
          -1,
        );
      },
    });
  }

  const impactDelay = isAcid && attackerArch === 'spitter' ? 0.28 : 0.085;
  const enemyClassification = classifyEnemyAttackStaging({
    archetype: attackerArch,
    cueKind: isAcid ? 'enemy_acid' : 'enemy_attack',
    clawRend: isSpitterClawRend,
  });
  const isStingerDart = enemyClassification.projectileProfile === 'stinger_dart';
  const isSpitterBile = enemyClassification.projectileProfile === 'acid_bile';
  const willKiraDodge = shouldKiraDodgeAttack({
    charId,
    isLethal,
    hpDamage,
    armorDamage,
  });
  const useCutInForEnemy =
    !tacticalViewActive && presCfg.enabled && Boolean(cue.targetId) && !state.cutInStarted;

  if (willKiraDodge) {
    state.kiraDodgeScheduled = true;
    if (!useCutInForEnemy && enemyClassification.projectileProfile) {
      const spawnX = isSpitterBile ? attackerPos.x - 42 : attackerPos.x - 36;
      const spawnY = isSpitterBile ? attackerPos.groundY - 116 : attackerPos.groundY - 98;
      spawnStyledProjectileVolley(sim, {
        profile: enemyClassification.projectileProfile,
        sx: spawnX,
        sy: spawnY,
        tx: heroX + 18,
        ty: groundY - 90,
        isCrit: false,
        flightSec: Math.max(0.14, impactDelay),
      });
    }
  }

  if (useCutInForEnemy && cue.targetId) {
    state.cutInStarted = true;
    const isCritEnemy =
      !willKiraDodge &&
      (Boolean(cue.heavySmash) ||
        attackerArch === 'boss' ||
        isStalkerAmbush ||
        isLethal ||
        hpDamage >= 12);
    const enemyActionKind: CutInActionKind = isCritEnemy ? 'crit' : 'normal';
    const enemyStagingMode: CutInStagingMode = enemyClassification.stagingMode;
    const flightSec = Math.max(0.11, presCfg.rangedWhipPanSec * tempoScale);
    void sim.actionSequencer
      .playCutIn(
        {
          id: batchKey,
          actionKind: enemyActionKind,
          stagingMode: enemyStagingMode,
          attackerId: cue.targetId,
          targetIds: ['hero'],
          allActorIds,
          attackerBounds: buildActorBounds(cue.targetId),
          targetBounds: [buildActorBounds('hero')],
          tempoScale,
          waitForExternalImpact: false,
          evadedTargetIds: willKiraDodge ? ['hero'] : undefined,
          hitstopOverrideSec: willKiraDodge ? 0.05 : undefined,
          holdDurationOverrideSec: willKiraDodge ? KIRA_DODGE_DURATION + 0.04 : undefined,
          replaceQueue: true,
          onProjectileSpawn: enemyClassification.projectileProfile
            ? () => {
                const projProfile = enemyClassification.projectileProfile!;
                const spawnX = isSpitterBile ? attackerPos.x - 42 : attackerPos.x - 36;
                const spawnY = isSpitterBile
                  ? attackerPos.groundY - 116
                  : attackerPos.groundY - 98;
                spawnStyledProjectileVolley(sim, {
                  profile: projProfile,
                  sx: spawnX,
                  sy: spawnY,
                  tx: heroX + 18,
                  ty: groundY - 90,
                  isCrit: isCritEnemy,
                  flightSec,
                });
              }
            : undefined,
          onImpactFrame: () => {
            const runCutIn = drainTriggerImpacts(sim, 'cutin_impact');
            if (runCutIn) runCutIn();
          },
        },
        presCfg,
        w,
        h,
      )
      .then(() => {
        if (sim.batchActiveKey === batchKey) {
          sim.lastCompletedBatchKey = batchKey;
          sim.onBatchComplete?.(batchKey);
        }
      });
  }

  sim.pendingImpacts.push({
    triggerOn: useCutInForEnemy ? 'cutin_impact' : 'delay',
    delayRemaining: useCutInForEnemy ? 0 : impactDelay,
    execute: () => {
      const liveHeroX = sim.actionSequencer.getLiveActorX('hero', heroX);
      const liveAttackerX = cue.targetId
        ? sim.actionSequencer.getLiveActorX(cue.targetId, attackerPos.x)
        : attackerPos.x;
      const liveAttackerPos = { ...attackerPos, x: liveAttackerX };

      if (isStalkerAmbush) {
        spawnBurst(sim, liveHeroX + 20, groundY - 92, 16, '#FF2E7E', 1, 1.25);
      }
      if (isStingerDart) {
        spawnBurst(sim, liveHeroX + 18, groundY - 92, 18, '#FB923C', 1, 1.18);
        spawnBurst(sim, liveHeroX + 14, groundY - 88, 12, '#FDBA74', 0, 0.95);
      }
      if (isSpitterClawRend) {
        spawnBurst(sim, liveHeroX + 18, groundY - 92, 12, '#A3E635', 2, 0.95);
        spawnBurst(sim, liveHeroX + 14, groundY - 88, 10, '#C026D3', 1, 1.0);
        if (hpDamage > 0 && attacker && !koIds.has(attacker.id) && cue.textLabel) {
          spawnBurst(sim, liveAttackerX - 4, attackerPos.groundY - 98, 14, '#A3E635', 1, 0.9);
          spawnBurst(sim, liveAttackerX, attackerPos.groundY - 92, 8, '#FFC700', 1, 0.7);
          spawnFloatingText(sim, liveAttackerX, attackerPos.y - 42, cue.textLabel, '#BEF264', 0.98);
        }
      }
      if (!isLethal) {
        if (willKiraDodge) {
          triggerKiraDodgeVfx(sim, liveHeroX, groundY);
          if (isAcid) {
            spawnBurst(sim, liveHeroX + 42, groundY - 34, 12, '#A3E635', 2, 0.8);
            addOrGrowFloorBlood(sim, liveHeroX + 42, groundY + 2, 3.2, 0, {
              owner: attackerArch,
              shapeKind: 'scorch_ring',
              plasmaColor: '#FACC15',
            });
          }
        } else if (hpDamage === 0) {
          sim.heroState = triggerCharacterAnimation(sim.heroState, 'guard', charId);
          sim.shieldDomeTimer = 0.46;
          sim.trauma = Math.min(1, sim.trauma + 0.14);
          spawnBurst(sim, liveHeroX + 38, groundY - 95, 16, '#00E5FF', 1, 0.9);
          if (isAcid) {
            spawnBurst(sim, liveHeroX + 36, groundY - 84, 16, '#FACC15', 2, 0.95);
            spawnBurst(sim, liveHeroX + 32, groundY - 82, 12, '#A3E635', 2, 0.85);
            addOrGrowFloorBlood(sim, liveHeroX + 28, groundY + 2, 3.6, 0, {
              owner: attackerArch,
              shapeKind: 'scorch_ring',
              plasmaColor: '#FACC15',
            });
          }
          spawnFloatingText(sim, liveHeroX, groundY - 145, 'BLOCKED', '#38BDF8', 0.95);
        } else {
          if (blocked > 0) {
            sim.shieldDomeTimer = 0.25;
            spawnBurst(sim, liveHeroX + 32, groundY - 95, 10, '#00E5FF', 1, 0.85);
          }
          sim.heroState = triggerCharacterAnimation(sim.heroState, 'hit', charId, {
            lowHpHit: lowHp,
          });
          sim.heroAnim.flashTimer = 0.085;
          sim.trauma = Math.min(
            1,
            sim.trauma + (isBruteHeavy ? 0.54 : isStalkerAmbush ? 0.48 : 0.35),
          );
          spawnBurst(
            sim,
            liveHeroX + (isAcid ? 14 : 0),
            groundY - 85,
            isBruteHeavy || isStalkerAmbush || isAcid || isStingerDart ? 22 : 14,
            isAcid
              ? '#FACC15'
              : isBruteHeavy || isStingerDart
                ? '#FB923C'
                : isStalkerAmbush
                  ? '#FF2E7E'
                  : '#FB7185',
            isAcid ? 2 : 0,
            isBruteHeavy || isAcid || isStingerDart ? 1.08 : 0.9,
          );
          if (isAcid) {
            spawnBurst(sim, liveHeroX + 18, groundY - 88, 16, '#A3E635', 2, 0.98);
            spawnBurst(sim, liveHeroX + 16, groundY - 84, 10, '#FEF08A', 0, 0.88);
          }
          if (isBruteHeavy) {
            spawnBurst(sim, liveHeroX + 24, groundY - 12, 14, '#FACC15', 1, 1.0);
            const smashX = liveAttackerX - 44;
            addGroundFissure(sim, smashX, attackerPos.groundY + 1, 1.1, 1.0);
            spawnBruteKineticShards(
              sim,
              smashX,
              attackerPos.groundY - 10,
              attackerPos.groundY + 2,
              16,
              'seismic',
              -1,
            );
          }
          spawnAlienBloodImpact(
            sim,
            liveHeroX + (isAcid ? 12 : 0),
            groundY - 78,
            groundY,
            isAcid ? 'spitter' : 'hero_blood',
            isAcid || isStingerDart ? 'plasma' : 'melee',
            isBruteHeavy ? 1.05 : isStalkerAmbush || isAcid || isStingerDart ? 0.95 : 0.75,
            false,
            -1,
            isAcid ? '#FACC15' : isStingerDart ? '#FB923C' : '#FB7185',
          );
          spawnFloatingText(
            sim,
            liveHeroX,
            groundY - 140,
            isStalkerAmbush
              ? `AMBUSH -${hpDamage}`
              : isStingerDart
                ? `STING -${hpDamage}`
                : `-${hpDamage}`,
            isAcid
              ? '#FACC15'
              : isBruteHeavy || isStingerDart
                ? '#FB923C'
                : isStalkerAmbush
                  ? '#FF2E7E'
                  : '#FDA4AF',
            isBruteHeavy || isStalkerAmbush || isStingerDart ? 1.15 : 1.0,
          );
        }
      } else {
        sim.heroAnim.flashTimer = 0.1;
        sim.trauma = Math.min(1, sim.trauma + 0.55);
        spawnBurst(
          sim,
          liveHeroX,
          groundY - 80,
          22,
          isAcid ? '#FACC15' : '#FB7185',
          isAcid ? 2 : 0,
          1.05,
        );
        spawnAlienBloodImpact(
          sim,
          liveHeroX,
          groundY - 74,
          groundY,
          isAcid ? 'spitter' : 'hero_blood',
          isAcid ? 'plasma' : 'melee',
          1.15,
          true,
          -1,
          isAcid ? '#FACC15' : '#FB7185',
        );
        if (hpDamage > 0) {
          spawnFloatingText(sim, liveHeroX, groundY - 140, `-${hpDamage}`, '#FB7185', 1.15);
        }
      }

      if (reflected > 0 && cue.targetId) {
        const targetId = cue.targetId;
        triggerEnemyHitStagger(
          sim,
          targetId,
          liveAttackerPos,
          attackerArch,
          'plasma',
          1.1,
          koIds.has(targetId),
          1,
          '#00F0FF',
        );
        spawnBurst(sim, liveAttackerX, attackerPos.y, 12, '#00E5FF', 1, 0.9);
        spawnFloatingText(sim, liveAttackerX, attackerPos.y - 40, `-${reflected}`, '#38BDF8', 0.95);
        if (koIds.has(targetId)) triggerEnemyKo(targetId, 'plasma', '#00F0FF');
      }
    },
  });
}
