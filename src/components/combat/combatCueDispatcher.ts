import type { AnimationCue, CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { KIRA_DODGE_DURATION } from '../../utils/kiraSpriteSheet';
import {
  computeBaseEnemySize,
  getMutantArchScale,
} from '../../utils/mutantAnimationRegistry';
import type { CameraActorBounds } from './ActionCameraController';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import { syncCombatBloodState } from './combatBloodSimulation';
import { dispatchEnemyCombatCue } from './combatEnemyCueDispatcher';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  type CombatPresentationConfig,
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
  computeNonCutInBeatMs,
  computePackTempoScale,
} from './combatPresentationConfig';
import { classifyHeroAttackStaging } from './combatStagingClassifier';
import {
  type CombatStageSim,
  getBridgeGroundY,
  getEnemyLaneMetrics,
  getHeroVisualHeightRatio,
} from './combatStageTypes';
import {
  ensureEnemyAnim,
  spawnBolt,
  spawnBurst,
  spawnFloatingText,
  triggerEnemyHitStagger,
} from './combatVfx';
import {
  type WeaponDecalKind,
  getBloodBiologyProfile,
  getEquippedDefIds,
  resolveWeaponDecalKind,
} from './mutantBlood';

export interface ApplyCombatCuesOptions {
  presentationConfig?: CombatPresentationConfig;
  tacticalViewActive?: boolean;
  onSequenceComplete?: (batchKey: string) => void;
}

export function applyCombatCues(
  sim: CombatStageSim,
  combat: CombatState,
  hero: HeroState,
  options?: ApplyCombatCuesOptions,
): void {
  syncCombatBloodState(sim, combat);

  const cues: AnimationCue[] = combat.lastCues;
  if (!cues || cues.length === 0) {
    sim.lastCueBatchKey = '';
    return;
  }

  const batchKey = cues.map((c) => c.id).join('|');
  if (batchKey === sim.lastCueBatchKey) return;
  sim.lastCueBatchKey = batchKey;
  sim.batchActiveKey = batchKey;
  sim.onBatchComplete = options?.onSequenceComplete;
  sim.batchMicroTimerRemaining = 0;
  sim.needsRedraw = true;

  const { w, h } = sim.size;
  const charId = hero.characterId ?? 'kira';
  const equippedDefIds = getEquippedDefIds(hero);
  const groundY = getBridgeGroundY(h);
  const heroX = w < 460 ? w * 0.19 : w * 0.22;
  const { slotCenters, dropCenters, effectiveSlotCount: slotCount } = computeEnemySlotLayout(
    combat.enemies,
    combat.director?.pendingReinforcements,
  );
  const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, slotCount);
  const presCfg = options?.presentationConfig ?? DEFAULT_COMBAT_PRESENTATION_CONFIG;
  const tacticalViewActive = Boolean(options?.tacticalViewActive);
  const livingEnemyCount = Math.max(1, combat.enemies.filter((e) => e.hp > 0).length);
  const tempoScale = computePackTempoScale(livingEnemyCount, presCfg.adaptivePackSpeedup);

  const getEnemyArch = (targetId?: string): EnemyArchetype => {
    const found = combat.enemies.find((e) => e.id === targetId);
    return found?.archetype ?? 'larva';
  };

  const getEnemyPos = (targetId?: string): { x: number; y: number; groundY: number } => {
    const idx = combat.enemies.findIndex((e) => e.id === targetId);
    const safeIdx = idx >= 0 ? idx : 0;
    const staggerY = safeIdx % 2 === 1 ? -6 : 0;
    const enemyGroundY = groundY + staggerY;
    const centerSlot = slotCenters[safeIdx] ?? safeIdx;
    const refHeroHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
    return {
      x: enemyBaseX + centerSlot * enemyStepX,
      y: Math.round(enemyGroundY - refHeroHeight * 0.38),
      groundY: enemyGroundY,
    };
  };

  const buildActorBounds = (actorId: string): CameraActorBounds => {
    if (actorId === 'hero') {
      const heroHeight =
        Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214) *
        getHeroVisualHeightRatio(charId);
      return {
        id: 'hero',
        x: heroX,
        groundY,
        widthPx: heroHeight * 0.72,
        heightPx: heroHeight,
      };
    }
    const pos = getEnemyPos(actorId);
    const arch = getEnemyArch(actorId);
    const baseEnemySize = computeBaseEnemySize(w, h, slotCount);
    const heightPx = baseEnemySize * getMutantArchScale(arch);
    return {
      id: actorId,
      x: pos.x,
      groundY: pos.groundY,
      widthPx: heightPx * 0.82,
      heightPx,
    };
  };

  for (let i = 0; i < combat.enemies.length; i++) {
    ensureEnemyAnim(sim, combat.enemies[i].id);
  }

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

  const allActorIds: string[] = [
    'hero',
    ...combat.enemies.filter((e) => e.hp > 0 || koIds.has(e.id)).map((e) => e.id),
  ];

  const slashCues = cues.filter((c) => c.kind === 'hero_slash');
  const primarySlashCue = slashCues.find((c) => !c.id.endsWith('_def_pulse'));
  const hasOverdrive = cues.some((c) => c.kind === 'hero_overdrive');

  let primaryAttackMode: 'dash_kick' | 'shoot' | null = null;
  const dispatchState = { cutInStarted: false, kiraDodgeScheduled: false };
  if (primarySlashCue) {
    const pos = getEnemyPos(primarySlashCue.targetId);
    sim.pendingShotTargetX = pos.x;
    sim.pendingShotTargetY = pos.y;
    sim.dashTargetX = pos.x;

    const targetIds = Array.from(
      new Set(
        slashCues
          .map((c) => c.targetId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const heroClassification = classifyHeroAttackStaging({
      charId,
      isSurge: Boolean(primarySlashCue.surge),
      damageValue: primarySlashCue.value ?? 0,
      targetCount: Math.max(1, targetIds.length),
      attackToggle: sim.attackToggle,
      isOverdrive: false,
    });
    sim.attackToggle += 1;
    primaryAttackMode = heroClassification.heroAnimMode === 'dash_kick' ? 'dash_kick' : 'shoot';
    sim.heroState = triggerCharacterAnimation(sim.heroState, primaryAttackMode, charId);

    if (!tacticalViewActive && presCfg.enabled && !hasOverdrive) {
      if (targetIds.length > 0) {
        dispatchState.cutInStarted = true;
        const isCrit =
          Boolean(primarySlashCue.surge) ||
          (primarySlashCue.targetId ? koIds.has(primarySlashCue.targetId) : false) ||
          (primarySlashCue.value ?? 0) >= 18;
        const actionKind: CutInActionKind = isCrit
          ? 'crit'
          : targetIds.length > 1
            ? 'aoe'
            : 'normal';
        const stagingMode: CutInStagingMode = heroClassification.stagingMode;
        void sim.actionSequencer
          .playCutIn(
            {
              id: batchKey,
              actionKind,
              stagingMode,
              attackerId: 'hero',
              targetIds,
              allActorIds,
              attackerBounds: buildActorBounds('hero'),
              targetBounds: targetIds.map((id) => buildActorBounds(id)),
              tempoScale: 1.0,
              waitForExternalImpact: true,
              replaceQueue: true,
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
    }
  }

  const triggerEnemyKo = (
    enemyId: string,
    weaponKind: WeaponDecalKind = 'kinetic',
    plasmaColor = '#00F0FF',
  ) => {
    const ea = ensureEnemyAnim(sim, enemyId);
    ea.dead = true;
    ea.koProgress = Math.max(0.01, ea.koProgress);
    const basePos = getEnemyPos(enemyId);
    const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemyId, basePos.x) };
    const arch = getEnemyArch(enemyId);
    const profile = getBloodBiologyProfile(arch);
    triggerEnemyHitStagger(sim, enemyId, pos, arch, weaponKind, 1.75, true, 1, plasmaColor);
    spawnBurst(sim, pos.x, pos.y, 28, profile.freshEmissive, 1, 1.25);
  };

  const enemyCtx = {
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
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.kind === 'hero_slash') {
      const pos = getEnemyPos(cue.targetId);
      const arch = getEnemyArch(cue.targetId);
      const isDefPulse = cue.id.endsWith('_def_pulse');
      const weaponKind = resolveWeaponDecalKind({
        attackMode: isDefPulse ? null : primaryAttackMode,
        characterId: charId,
        equippedDefIds,
        cueId: cue.id,
        cueKind: cue.kind,
        isSurge: Boolean(cue.surge),
      });
      const plasmaColor =
        charId === 'zuri' ? '#FF2E7E' : charId === 'auraline' ? '#FFC700' : '#00F0FF';
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
                  arch,
                  'plasma',
                  1.15,
                  koIds.has(cue.targetId),
                  1,
                  '#00F0FF',
                );
              }
              spawnBurst(sim, pos.x, pos.y, 16, '#00E5FF', 1, 1);
              if (cue.value) spawnFloatingText(sim, pos.x, pos.y - 40, `-${cue.value}`, '#38BDF8', 1.05);
              if (cue.targetId && koIds.has(cue.targetId)) {
                triggerEnemyKo(cue.targetId, 'plasma', '#00F0FF');
              }
            });
          },
        });
      } else if (primaryAttackMode === 'dash_kick') {
        sim.pendingImpacts.push({
          triggerOn: 'kick',
          delayRemaining: 0,
          execute: () => {
            const livePos = cue.targetId
              ? { ...pos, x: sim.actionSequencer.getLiveActorX(cue.targetId, pos.x) }
              : pos;
            sim.pendingShotTargetX = livePos.x;
            sim.pendingShotTargetY = livePos.y;
            sim.slashArcTimer = 0.28;
            sim.slashSurge = Boolean(cue.surge);
            if (!sim.actionSequencer.isActive()) {
              sim.hitstop = cue.surge ? 0.06 : 0.04;
            }
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.68 : 0.46));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                livePos,
                arch,
                weaponKind,
                cue.surge ? 1.65 : 1.35,
                koIds.has(cue.targetId),
                1,
                plasmaColor,
              );
            }
            spawnBurst(sim, livePos.x, livePos.y, cue.surge ? 26 : 16, '#FF3B7F', 1, cue.surge ? 1.25 : 1);
            if (cue.value) {
              spawnFloatingText(sim, livePos.x, livePos.y - 40, `-${cue.value}`, '#FF6B9E', cue.surge ? 1.3 : 1.05);
            }
            if (cue.targetId && koIds.has(cue.targetId)) {
              triggerEnemyKo(cue.targetId, weaponKind, plasmaColor);
            }
          },
        });
      } else {
        sim.pendingImpacts.push({
          triggerOn: 'shot1',
          delayRemaining: 0,
          execute: () => {
            sim.slashArcTimer = 0.26;
            sim.slashSurge = Boolean(cue.surge);
            if (!sim.actionSequencer.isActive()) {
              sim.hitstop = cue.surge ? 0.048 : 0.028;
            }
            sim.trauma = Math.min(1, sim.trauma + (cue.surge ? 0.56 : 0.36));
            if (cue.targetId) {
              triggerEnemyHitStagger(
                sim,
                cue.targetId,
                pos,
                arch,
                weaponKind,
                cue.surge ? 1.35 : 1.08,
                false,
                1,
                plasmaColor,
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
                arch,
                weaponKind,
                cue.surge ? 1.45 : 1.18,
                koIds.has(cue.targetId),
                1,
                plasmaColor,
              );
            }
            spawnBurst(sim, pos.x, pos.y, 12, '#00E5FF', 1, 0.95);
            if (cue.targetId && koIds.has(cue.targetId)) {
              triggerEnemyKo(cue.targetId, weaponKind, plasmaColor);
            }
          },
        });
      }
    } else if (cue.kind === 'hero_shield') {
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'guard', charId);
      sim.shieldDomeTimer = 0.48;
      if (charId === 'auraline') {
        sim.auralineAegisDomeTimer = 0.52;
      }
      spawnBurst(sim, heroX, groundY - 95, cue.surge ? 20 : 12, '#00E5FF', 1, 0.85);
      if (cue.value) {
        spawnFloatingText(sim, heroX, groundY - 150, `+${cue.value} SHD`, '#38BDF8', 1.05);
      }
    } else if (cue.kind === 'hero_tech') {
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'upgrade', charId);
      sim.upgradeBeamTimer = 0.55;
      if (charId === 'auraline') {
        sim.auralineReactorAuraTimer = 0.58;
      }
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
      sim.heroState = triggerCharacterAnimation(sim.heroState, 'overdrive', charId);

      for (const e of livingOrKo) ensureEnemyAnim(sim, e.id);

      if (!tacticalViewActive && presCfg.enabled && !dispatchState.cutInStarted && livingOrKo.length > 0) {
        dispatchState.cutInStarted = true;
        const targetIds = livingOrKo.map((e) => e.id);
        const odClassification = classifyHeroAttackStaging({
          charId,
          isOverdrive: true,
          targetCount: targetIds.length,
          attackToggle: sim.attackToggle,
        });
        void sim.actionSequencer
          .playCutIn(
            {
              id: batchKey,
              actionKind: 'overdrive',
              stagingMode: odClassification.stagingMode,
              attackerId: 'hero',
              targetIds,
              allActorIds,
              attackerBounds: buildActorBounds('hero'),
              targetBounds: targetIds.map((id) => buildActorBounds(id)),
              tempoScale: 1.0,
              waitForExternalImpact: true,
              replaceQueue: true,
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
        triggerOn: 'kick',
        delayRemaining: 0,
        execute: () => {
          sim.overdriveTimer = 0.68;
          if (!sim.actionSequencer.isActive()) {
            sim.hitstop = 0.055;
          }
          sim.trauma = 0.78;
          for (const enemy of livingOrKo) {
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'melee', 1.5, false, 1, '#FFC700');
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
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'plasma', 1.55, false, 1, '#FFC700');
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
            const basePos = getEnemyPos(enemy.id);
            const pos = { ...basePos, x: sim.actionSequencer.getLiveActorX(enemy.id, basePos.x) };
            if (koIds.has(enemy.id)) {
              triggerEnemyKo(enemy.id, 'plasma', '#FFC700');
            } else {
              triggerEnemyHitStagger(sim, enemy.id, pos, enemy.archetype, 'plasma', 1.35, false, 1, '#FFC700');
            }
          }
        },
      });
    } else {
      dispatchEnemyCombatCue(cue, enemyCtx, dispatchState);
    }
  }

  if (!dispatchState.cutInStarted) {
    const cueKinds = cues.map((c) => c.kind);
    const baseBeatSec =
      computeNonCutInBeatMs(cueKinds, livingEnemyCount, presCfg.adaptivePackSpeedup) / 1000;
    sim.batchMicroTimerRemaining = dispatchState.kiraDodgeScheduled
      ? Math.max(baseBeatSec, KIRA_DODGE_DURATION + 0.14)
      : baseBeatSec;
  }
}
