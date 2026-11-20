import type { AnimationCue, CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { HEROINE_DODGE_DURATION, shouldKiraDodgeAttack } from '../../utils/kiraSpriteSheet';
import type { CameraActorBounds } from './ActionCameraController';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import {
  addOrGrowFloorBlood,
  emitBloodDroplets,
  spawnAlienBloodImpact,
  spawnStatusTrail,
} from './combatBloodSimulation';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import { classifyEnemyAttackStaging } from './combatStagingClassifier';
import type { CombatStageSim } from './combatStageTypes';
import {
  addGroundFissure,
  drainTriggerImpacts,
  ensureEnemyAnim,
  spawnBolt,
  spawnBruteKineticShards,
  spawnBruteMutagenMist,
  spawnBurst,
  spawnFloatingText,
  spawnStyledProjectileVolley,
  triggerEnemyHitStagger,
  triggerKiraDodgeVfx,
} from './combatVfx';
import {
  type WeaponDecalKind,
  getBloodBiologyProfile,
  getEnemyStatusVisualFlags,
} from './mutantBlood';

export interface EnemyCueDispatchContext {
  sim: CombatStageSim;
  combat: CombatState;
  hero: HeroState;
  cues: readonly AnimationCue[];
  batchKey: string;
  w: number;
  h: number;
  groundY: number;
  heroX: number;
  enemyBaseX: number;
  enemyStepX: number;
  dropCenters: readonly number[];
  presCfg: CombatPresentationConfig;
  tacticalViewActive: boolean;
  tempoScale: number;
  koIds: ReadonlySet<string>;
  allActorIds: string[];
  primarySlashCue: AnimationCue | undefined;
  hasOverdrive: boolean;
  getEnemyArch: (targetId?: string) => EnemyArchetype;
  getEnemyPos: (targetId?: string) => { x: number; y: number; groundY: number };
  buildActorBounds: (actorId: string) => CameraActorBounds;
  triggerEnemyKo: (enemyId: string, weaponKind?: WeaponDecalKind, plasmaColor?: string) => void;
}

export function dispatchEnemyCombatCue(
  cue: AnimationCue,
  ctx: EnemyCueDispatchContext,
  state: { cutInStarted: boolean; kiraDodgeScheduled: boolean },
): void {
  const {
    sim,
    combat,
    hero,
    cues,
    batchKey,
    w,
    h,
    groundY,
    heroX,
    enemyBaseX,
    enemyStepX,
    dropCenters,
    presCfg,
    tacticalViewActive,
    tempoScale,
    koIds,
    allActorIds,
    primarySlashCue,
    hasOverdrive,
    getEnemyArch,
    getEnemyPos,
    buildActorBounds,
    triggerEnemyKo,
  } = ctx;
  const charId = hero.characterId ?? 'kira';

  if (cue.kind === 'enemy_attack' || cue.kind === 'enemy_acid') {
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
      cueKind: cue.kind,
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
        const spawnY = isSpitterBile
          ? attackerPos.groundY - 116
          : attackerPos.groundY - 98;
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
            holdDurationOverrideSec: willKiraDodge ? HEROINE_DODGE_DURATION + 0.04 : undefined,
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
            sim.heroState = triggerCharacterAnimation(sim.heroState, 'hit', charId, { lowHpHit: lowHp });
            sim.heroAnim.flashTimer = 0.085;
            sim.trauma = Math.min(1, sim.trauma + (isBruteHeavy ? 0.54 : isStalkerAmbush ? 0.48 : 0.35));
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
              spawnBruteKineticShards(sim, smashX, attackerPos.groundY - 10, attackerPos.groundY + 2, 16, 'seismic', -1);
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
              isStalkerAmbush ? `AMBUSH -${hpDamage}` : isStingerDart ? `STING -${hpDamage}` : `-${hpDamage}`,
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
          spawnBurst(sim, liveHeroX, groundY - 80, 22, isAcid ? '#FACC15' : '#FB7185', isAcid ? 2 : 0, 1.05);
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
  } else if (cue.kind === 'enemy_armor') {
    const pos = getEnemyPos(cue.targetId);
    const arch = getEnemyArch(cue.targetId);
    if (arch === 'stalker' && cue.targetId) {
      const ea = ensureEnemyAnim(sim, cue.targetId);
      ea.bristleKind = 'armor';
      ea.bristleDuration = 0.58;
      ea.bristleTimer = 0.58;
      spawnBurst(sim, pos.x + 6, pos.y - 12, 14, '#FF2E7E', 1, 0.85);
      spawnBurst(sim, pos.x, pos.y - 8, 8, '#FFC700', 1, 0.65);
      if (cue.value) {
        spawnFloatingText(sim, pos.x, pos.y - 40, `+${cue.value} THORN ARM`, '#FF85B3', 0.98);
      }
    } else if (arch === 'brute' && cue.targetId) {
      const ea = ensureEnemyAnim(sim, cue.targetId);
      ea.bristleKind = 'armor';
      ea.bristleDuration = 0.72;
      ea.bristleTimer = 0.72;
      spawnBurst(sim, pos.x - 8, pos.y - 6, 14, '#22C55E', 2, 0.9);
      spawnBurst(sim, pos.x + 18, pos.y - 26, 12, '#FB923C', 1, 0.85);
      spawnBruteMutagenMist(sim, pos.x - 10, pos.y - 16, 12, 1.0);
      spawnBruteKineticShards(sim, pos.x - 10, pos.y - 14, pos.groundY + 2, 7, 'vial', -1);
      const label =
        cue.secondaryHeal && cue.secondaryHeal > 0
          ? `+${cue.value ?? 6} ARM · +${cue.secondaryHeal} HP`
          : `+${cue.value ?? 6} ARM`;
      spawnFloatingText(sim, pos.x, pos.y - 44, label, '#4ADE80', 1.02);
    } else {
      spawnBurst(sim, pos.x, pos.y, 10, '#A3E635', 1, 0.7);
      if (cue.value) {
        spawnFloatingText(sim, pos.x, pos.y - 35, `+${cue.value} ARM`, '#BEF264', 0.95);
      }
    }
  } else if (cue.kind === 'enemy_bolster') {
    const bolsterVal = cue.value ?? 4;
    for (const ally of combat.enemies) {
      if (ally.hp <= 0) continue;
      const pos = getEnemyPos(ally.id);
      spawnBurst(sim, pos.x, pos.y, 12, '#FACC15', 1, 0.85);
      spawnFloatingText(sim, pos.x, pos.y - 38, `+${bolsterVal} ARM`, '#FDE047', 1.0);
    }
  } else if (cue.kind === 'enemy_charge') {
    const pos = getEnemyPos(cue.targetId);
    spawnBurst(sim, pos.x, pos.y, 16, '#FB923C', 1, 0.95);
    spawnFloatingText(sim, pos.x, pos.y - 42, 'CHARGING!', '#FDBA74', 1.05);
  } else if (cue.kind === 'enemy_burst') {
    const burstOrigin = getEnemyPos(cue.targetId);
    const burstDmg = cue.value ?? 6;
    const miteProfile = getBloodBiologyProfile('larva');
    sim.pendingImpacts.push({
      triggerOn: 'delay',
      delayRemaining: 0.14,
      execute: () => {
        sim.trauma = Math.min(1, sim.trauma + 0.42);
        spawnBurst(sim, burstOrigin.x, burstOrigin.y, 26, miteProfile.freshEmissive, 1, 1.35);
        spawnAlienBloodImpact(
          sim,
          burstOrigin.x,
          burstOrigin.y,
          burstOrigin.groundY,
          'larva',
          'kinetic',
          1.4,
          true,
          1,
        );
        spawnFloatingText(
          sim,
          burstOrigin.x,
          burstOrigin.y - 52,
          `💥 BIO-BURST`,
          '#BEF264',
          1.1,
        );
        for (const ally of combat.enemies) {
          if (ally.id === cue.targetId) continue;
          if (ally.hp <= 0 && !koIds.has(ally.id)) continue;
          const allyPos = getEnemyPos(ally.id);
          const dir = allyPos.x >= burstOrigin.x ? 1 : -1;
          triggerEnemyHitStagger(
            sim,
            ally.id,
            allyPos,
            ally.archetype,
            'kinetic',
            1.25,
            koIds.has(ally.id),
            dir,
          );
          spawnBurst(sim, allyPos.x, allyPos.y, 14, getBloodBiologyProfile(ally.archetype).freshBody, 2, 1.0);
          spawnFloatingText(sim, allyPos.x, allyPos.y - 36, `-${burstDmg}`, '#BEF264', 1.05);
          if (koIds.has(ally.id)) triggerEnemyKo(ally.id, 'kinetic');
        }
      },
    });
  } else if (cue.kind === 'enemy_retaliate') {
    const stalkerPos = getEnemyPos(cue.targetId);
    const retHpDmg = cue.hpDamage ?? (cue.value ?? 3);
    const retArmorDmg = cue.armorDamage ?? 0;
    const retBlocked = cue.blocked ?? 0;
    const willKiraDodgeRet = shouldKiraDodgeAttack({
      charId,
      isLethal: hero.hp <= 0,
      hpDamage: retHpDmg,
      armorDamage: retArmorDmg,
    });
    if (willKiraDodgeRet) {
      state.kiraDodgeScheduled = true;
    }
    if (cue.targetId) {
      const ea = ensureEnemyAnim(sim, cue.targetId);
      ea.bristleKind = 'retaliate';
      ea.bristleDuration = 0.48;
      ea.bristleTimer = 0.48;
    }
    const quillSx = stalkerPos.x + 8;
    const quillSy = stalkerPos.y - 24;
    spawnBurst(sim, quillSx, quillSy, 14, '#FF2E7E', 1, 1.05);

    const quillTargets = [
      { delay: 0.09, dy: -102, color: '#FF2E7E', final: false },
      { delay: 0.13, dy: -82, color: '#FF85B3', final: false },
      { delay: 0.17, dy: -90, color: '#FF2E7E', final: true },
    ] as const;

    for (let q = 0; q < quillTargets.length; q++) {
      const qt = quillTargets[q];
      sim.pendingImpacts.push({
        triggerOn: 'delay',
        delayRemaining: qt.delay,
        execute: () => {
          spawnBolt(sim, quillSx, quillSy, heroX + 22, groundY + qt.dy, qt.color, () => {
            if (!qt.final) {
              spawnBurst(
                sim,
                heroX + 18,
                groundY + qt.dy,
                6,
                retHpDmg > 0 ? '#FF2E7E' : '#00E5FF',
                1,
                0.75,
              );
              return;
            }
            if (retHpDmg > 0) {
              sim.trauma = Math.min(1, sim.trauma + 0.28);
              sim.heroAnim.flashTimer = 0.08;
              spawnBurst(sim, heroX, groundY - 85, 14, '#FB7185', 1, 0.95);
              spawnAlienBloodImpact(
                sim,
                heroX,
                groundY - 76,
                groundY,
                'hero_blood',
                'kinetic',
                0.65,
                false,
                -1,
              );
              spawnFloatingText(
                sim,
                heroX,
                groundY - 135,
                `-${retHpDmg} SPIKE`,
                '#FDA4AF',
                1.0,
              );
            } else if (willKiraDodgeRet) {
              triggerKiraDodgeVfx(sim, sim.actionSequencer.getLiveActorX('hero', heroX), groundY);
            } else if (retBlocked > 0) {
              sim.trauma = Math.min(1, sim.trauma + 0.16);
              sim.shieldDomeTimer = 0.32;
              spawnBurst(sim, heroX + 34, groundY - 92, 12, '#00E5FF', 1, 0.85);
              spawnFloatingText(sim, heroX, groundY - 135, 'SPIKE BLOCKED', '#38BDF8', 0.95);
            }
          });
        },
      });
    }
  } else if (cue.kind === 'enemy_pustule_rupture') {
    const spitterPos = getEnemyPos(cue.targetId);
    const corAmt = cue.value ?? 2;
    if (cue.targetId) {
      const ea = ensureEnemyAnim(sim, cue.targetId);
      ea.bristleKind = 'pustule_rupture';
      ea.bristleDuration = 0.52;
      ea.bristleTimer = 0.52;
    }
    const pusSx = spitterPos.x - 10;
    const pusSy = spitterPos.groundY - 104;
    spawnBurst(sim, pusSx, pusSy, 16, '#A3E635', 2, 1.05);
    spawnBurst(sim, pusSx + 4, pusSy - 4, 8, '#C026D3', 1, 0.85);
    sim.pendingImpacts.push({
      triggerOn: 'delay',
      delayRemaining: 0.14,
      execute: () => {
        spawnBolt(sim, pusSx, pusSy, heroX + 16, groundY - 88, '#A3E635', () => {
          sim.trauma = Math.min(1, sim.trauma + 0.18);
          spawnBurst(sim, heroX + 8, groundY - 86, 12, '#A3E635', 2, 0.85);
          addOrGrowFloorBlood(sim, heroX + 14, groundY + 2, 2.8, 0, {
            owner: 'hero_corrode',
            shapeKind: 'scorch_ring',
            plasmaColor: '#A3E635',
          });
          spawnFloatingText(sim, heroX, groundY - 134, `☣ +${corAmt} COR`, '#BEF264', 0.98);
        });
      },
    });
  } else if (cue.kind === 'enemy_phase_gate') {
    const bossPos = getEnemyPos(cue.targetId);
    sim.pendingImpacts.push({
      triggerOn: 'delay',
      delayRemaining: 0.12,
      execute: () => {
        sim.trauma = Math.min(1, sim.trauma + 0.45);
        spawnBurst(sim, bossPos.x, bossPos.y, 24, '#00F0FF', 1, 1.25);
        spawnBurst(sim, bossPos.x, bossPos.y, 16, '#FFC700', 1, 1.0);
        spawnFloatingText(
          sim,
          bossPos.x,
          bossPos.y - 54,
          `PHASE LOCK +${cue.value ?? 10} ARM`,
          '#67E8F9',
          1.1,
        );
      },
    });
  } else if (cue.kind === 'enemy_ko' && cue.targetId && !primarySlashCue && !hasOverdrive) {
    const targetId = cue.targetId;
    if (
      !cues.some((c) => (c.kind === 'enemy_attack' || c.kind === 'enemy_acid') && c.targetId === targetId) &&
      !cues.some((c) => c.kind === 'hero_slash' && c.targetId === targetId)
    ) {
      triggerEnemyKo(targetId, 'kinetic');
    }
  } else if (cue.kind === 'enemy_telegraph') {
    const pending = combat.director?.pendingReinforcements ?? [];
    const dropIdx = Math.max(0, pending.length - 1);
    const drop = pending[dropIdx];
    const dropCenter = drop ? (dropCenters[dropIdx] ?? drop.slotIndex) : 1;
    const dropX = drop ? enemyBaseX + dropCenter * enemyStepX : enemyBaseX + enemyStepX;
    spawnBurst(sim, dropX, groundY - 24, 16, '#FB923C', 1, 0.9);
    spawnFloatingText(
      sim,
      dropX,
      groundY - 70,
      `INBOUND T-${cue.value ?? 1}`,
      '#FDBA74',
      1.0,
    );
  } else if (cue.kind === 'enemy_reinforce') {
    const pos = getEnemyPos(cue.targetId);
    sim.trauma = Math.min(1, sim.trauma + 0.25);
    spawnBurst(sim, pos.x, pos.y + 12, 22, '#00F0FF', 1, 1.1);
    spawnFloatingText(sim, pos.x, pos.y - 46, 'DROP LANDED', '#67E8F9', 1.05);
  } else if (cue.kind === 'enemy_enrage') {
    const pos = getEnemyPos(cue.targetId);
    spawnBurst(sim, pos.x, pos.y, 14, '#FF2E7E', 1, 0.9);
    spawnFloatingText(sim, pos.x, pos.y - 48, cue.textLabel ?? `ENRAGE +${cue.value ?? 1} ATK`, '#FDA4AF', 1.05);
  } else if (cue.kind === 'enemy_stagger' && cue.targetId) {
    const pos = getEnemyPos(cue.targetId);
    const arch = getEnemyArch(cue.targetId);
    const isWeaponBreak = Boolean(cue.textLabel?.includes('WEAPON BROKEN'));
    const isSleep = Boolean(cue.textLabel?.startsWith('SLEEPING'));
    const isRecoverZero = Boolean(cue.textLabel?.includes('0 DMG'));
    if (isSleep) {
      spawnBurst(sim, pos.x, pos.y - 16, 10, '#A5B4FC', 2, 0.55);
      spawnFloatingText(
        sim,
        pos.x,
        pos.y - 48,
        cue.textLabel ?? 'SLEEPING',
        '#C7D2FE',
        1.0,
      );
    } else if (isRecoverZero) {
      triggerEnemyHitStagger(sim, cue.targetId, pos, arch, 'melee', 0.72, false, 1);
      spawnBurst(sim, pos.x, pos.y, 10, '#00F0FF', 1, 0.75);
      spawnFloatingText(
        sim,
        pos.x,
        pos.y - 48,
        cue.textLabel ?? 'STAGGERED · 0 DMG',
        '#67E8F9',
        1.02,
      );
    } else {
      sim.trauma = Math.min(1, sim.trauma + (isWeaponBreak ? 0.52 : 0.34));
      triggerEnemyHitStagger(sim, cue.targetId, pos, arch, 'melee', isWeaponBreak ? 1.55 : 1.3, false, 1);
      spawnBurst(sim, pos.x, pos.y, isWeaponBreak ? 26 : 20, '#00F0FF', 1, 1.1);
      spawnBurst(sim, pos.x, pos.y, isWeaponBreak ? 18 : 12, '#FFC700', 1, 0.95);
      if (arch === 'brute') {
        spawnBruteKineticShards(
          sim,
          pos.x - 6,
          pos.y - 16,
          pos.groundY + 2,
          isWeaponBreak ? 20 : 11,
          'chitin',
          1,
        );
      }
      spawnFloatingText(
        sim,
        pos.x,
        pos.y - 54,
        isWeaponBreak ? '⚔ WEAPON BROKEN!' : '⚡ STAGGERED!',
        isWeaponBreak ? '#FB923C' : '#67E8F9',
        isWeaponBreak ? 1.22 : 1.15,
      );
    }
  } else if (cue.kind === 'tile_hex') {
    const pos = getEnemyPos(cue.targetId);
    spawnBurst(sim, pos.x, pos.y, 16, '#C084FC', 1, 1.0);
    spawnFloatingText(sim, pos.x, pos.y - 44, cue.textLabel ?? '⬡ HEX', '#E9D5FF', 1.05);
  } else if (cue.kind === 'tile_blight') {
    spawnBurst(sim, heroX, groundY - 85, 16, '#84CC16', 1, 0.95);
    addOrGrowFloorBlood(sim, heroX + (Math.random() - 0.5) * 28, groundY + 2, 2.8, 0, {
      owner: 'hero_corrode',
      shapeKind: 'scorch_ring',
      plasmaColor: '#A3E635',
    });
    spawnFloatingText(
      sim,
      heroX,
      groundY - 144,
      cue.textLabel ?? `☣ -${cue.value ?? 2} SLAG`,
      '#BEF264',
      1.0,
    );
  } else if (cue.kind === 'heat_jam') {
    spawnBurst(sim, heroX, groundY - 85, 16, '#F97316', 1, 0.85);
    spawnFloatingText(sim, heroX, groundY - 142, 'OVERHEAT JAM', '#FB923C', 1.0);
  }
}
