import type { AnimationCue } from '../../engine/types';
import { shouldKiraDodgeAttack } from '../../utils/kiraSpriteSheet';
import { addOrGrowFloorBlood, spawnAlienBloodImpact } from './combatBloodSimulation';
import type { EnemyCueDispatchContext } from './combatEnemyCueDispatcher';
import {
  ensureEnemyAnim,
  spawnBolt,
  spawnBruteKineticShards,
  spawnBruteMutagenMist,
  spawnBurst,
  spawnFeralNurseCloakShimmer,
  spawnFeralNurseIchorSpray,
  spawnFloatingText,
  spawnMutdogDroolSplatter,
  triggerEnemyHitStagger,
  triggerKiraDodgeVfx,
} from './combatVfx';
import { getBloodBiologyProfile } from './mutantBlood';

export function dispatchEnemyStatusCue(
  cue: AnimationCue,
  ctx: EnemyCueDispatchContext,
  state: { cutInStarted: boolean; kiraDodgeScheduled: boolean },
): void {
  const {
    sim,
    combat,
    hero,
    cues,
    groundY,
    heroX,
    enemyBaseX,
    enemyStepX,
    dropCenters,
    koIds,
    primarySlashCue,
    hasOverdrive,
    getEnemyArch,
    getEnemyPos,
    triggerEnemyKo,
  } = ctx;
  const charId = hero.characterId ?? 'kira';

  if (cue.kind === 'enemy_armor') {
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
  } else if (cue.kind === 'enemy_cloak') {
    const pos = getEnemyPos(cue.targetId);
    if (cue.targetId) {
      const ea = ensureEnemyAnim(sim, cue.targetId);
      ea.cloakCastDuration = 0.72;
      ea.cloakCastTimer = 0.72;
    }
    spawnFeralNurseCloakShimmer(sim, pos.x, pos.y - 12, 18);
    spawnFloatingText(sim, pos.x, pos.y - 46, '◎ CLOAKED (10%)', '#67E8F9', 1.06);
  } else if (cue.kind === 'enemy_charge') {
    const pos = getEnemyPos(cue.targetId);
    const arch = getEnemyArch(cue.targetId);
    if (arch === 'feral_nurse') {
      spawnBurst(sim, pos.x, pos.y, 14, '#E879F9', 1, 0.92);
      spawnBurst(sim, pos.x, pos.y - 6, 8, '#FB7185', 1, 0.85);
      spawnFloatingText(sim, pos.x, pos.y - 44, 'PREPARE → 7 PIERCE', '#F472B6', 1.06);
    } else {
      spawnBurst(sim, pos.x, pos.y, 16, '#FB923C', 1, 0.95);
      spawnFloatingText(sim, pos.x, pos.y - 42, 'CHARGING!', '#FDBA74', 1.05);
    }
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
          '💥 BIO-RUPTURE',
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
          spawnBurst(
            sim,
            allyPos.x,
            allyPos.y,
            14,
            getBloodBiologyProfile(ally.archetype).freshBody,
            2,
            1.0,
          );
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
          `PHASE GATE +${cue.value ?? 10} ARM`,
          '#67E8F9',
          1.1,
        );
      },
    });
  } else if (cue.kind === 'enemy_ko' && cue.targetId && !primarySlashCue && !hasOverdrive) {
    const targetId = cue.targetId;
    if (
      !cues.some(
        (c) => (c.kind === 'enemy_attack' || c.kind === 'enemy_acid') && c.targetId === targetId,
      ) &&
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
    spawnFloatingText(
      sim,
      pos.x,
      pos.y - 48,
      cue.textLabel ?? `ENRAGE +${cue.value ?? 1} ATK`,
      '#FDA4AF',
      1.05,
    );
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
      triggerEnemyHitStagger(
        sim,
        cue.targetId,
        pos,
        arch,
        'melee',
        isWeaponBreak ? 1.55 : 1.3,
        false,
        1,
      );
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
      } else if (arch === 'mutdog') {
        spawnMutdogDroolSplatter(sim, pos.x - 8, pos.y - 14, pos.groundY + 2, 10, 1, 1.05);
      } else if (arch === 'feral_nurse') {
        spawnFeralNurseIchorSpray(sim, pos.x - 6, pos.y - 18, pos.groundY + 2, 10, 1, 1.05);
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
