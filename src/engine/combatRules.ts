import { MAX_HEIRLOOM_STACKS } from './data';
import { getDifficultyProfile, getStageSecondaryTurnTarget } from './difficulty';
import { saveInheritedHeirloom } from './persistence';
import { computeVictoryDirectorRewards } from './reinforcementDirector';
import type {
  AnimationCue,
  CombatState,
  CyberImplantId,
  EnemyUnit,
  HeroState,
  MapNode,
  RunState,
  ScreenPhase,
  Tile,
  TurnPreview,
} from './types';

export const VOLATILE_BURST_DAMAGE = 6;
export const PLASMA_BARREL_BURST_DAMAGE = 10;
export const SPIKE_RETALIATE_DAMAGE = 3;
export const PUSTULE_RUPTURE_CORRODE = 2;
export const STAGGER_BURST_THRESHOLD = 16;
export const WEAPON_BREAK_THRESHOLD = 22;
export const HOT_POTATO_PASS_DAMAGE = 8;
export const HOT_POTATO_SELF_DAMAGE = 6;
export const TEMPTATION_CLEAVE_BONUS = 14;
export const MERCY_REWARD_HP = 6;
export const MERCY_REWARD_CREDITS = 15;
export const TUG_OF_WAR_PURGE_OD_BONUS = 25;
export const TUG_OF_WAR_PURGE_CR_BONUS = 10;
export const BLIGHT_HOLD_CHIP_DAMAGE = 2;
export const HEX_HEAL_AMOUNT = 4;
export const HEX_ARMOR_AMOUNT = 3;
export const MAX_ACTIVE_BLIGHT_TILES = 2;
export const PHASE_GATE_ARMOR_BONUS = 10;

export function hasImplant(implants: readonly CyberImplantId[], id: CyberImplantId): boolean {
  return implants.includes(id);
}

export function getSurgeThreshold(implants: readonly CyberImplantId[]): number {
  return hasImplant(implants, 'surge_resonator') ? 3 : 4;
}

export function canModifyEquipment(run: RunState): boolean {
  return run.screen !== 'combat';
}

export function markNodeCleared(mapNodes: MapNode[], nodeId: string | null): MapNode[] {
  if (!nodeId) return mapNodes;
  return mapNodes.map((n) => (n.id === nodeId ? { ...n, cleared: true } : n));
}

export function hasHostileLivingEnemies(enemies: readonly EnemyUnit[]): boolean {
  return enemies.some((e) => e.hp > 0 && !e.escaped && !e.isMercyTarget && !e.propKind);
}

export function isDamagingIntent(intent: EnemyUnit['intentCycle'][number] | undefined): boolean {
  if (!intent) return false;
  return (
    intent.kind === 'attack' ||
    intent.kind === 'heavy' ||
    intent.kind === 'acid' ||
    intent.kind === 'leech'
  );
}

export function clearDeadCasterHexes(board: Tile[], enemies: readonly EnemyUnit[]): Tile[] {
  const livingIds = new Set(enemies.filter((e) => e.hp > 0 && !e.escaped).map((e) => e.id));
  return board.map((tile) =>
    tile.hexedByEnemyId && !livingIds.has(tile.hexedByEnemyId)
      ? { ...tile, hexedByEnemyId: undefined }
      : tile,
  );
}

export function countTotalBlightTiles(
  combat: Pick<CombatState, 'board' | 'drawPile' | 'discardPile'>,
): number {
  let total = 0;
  for (const t of combat.board) if (t.isBlight) total++;
  for (const t of combat.drawPile) if (t.isBlight) total++;
  for (const t of combat.discardPile) if (t.isBlight) total++;
  return total;
}

export function absorbHeroDamage(
  shield: number,
  armor: number,
  incoming: number,
): {
  nextShield: number;
  nextArmor: number;
  blockedByShield: number;
  blockedByArmor: number;
  hpDamage: number;
} {
  const safeIncoming = Math.max(0, incoming);
  const blockedByShield = Math.min(Math.max(0, shield), safeIncoming);
  const afterShield = safeIncoming - blockedByShield;
  const blockedByArmor = Math.min(Math.max(0, armor), afterShield);
  const hpDamage = afterShield - blockedByArmor;
  return {
    nextShield: Math.max(0, shield - blockedByShield),
    nextArmor: Math.max(0, armor - blockedByArmor),
    blockedByShield,
    blockedByArmor,
    hpDamage,
  };
}

export function applyBioSiphonHeal(hero: HeroState, defeatedNow: number): void {
  if (hero.hp <= 0) return;
  if (defeatedNow > 0 && hasImplant(hero.implants, 'bio_siphon')) {
    hero.hp = Math.min(hero.maxHp, hero.hp + defeatedNow * 4);
  }
}

export function computeCombatNaniteReward(
  combat: Pick<CombatState, 'nodeId' | 'nodeType'>,
  mapNodes: readonly MapNode[],
): number {
  const node = mapNodes.find((n) => n.id === combat.nodeId);
  let naniteReward = 0;
  if (combat.nodeType === 'ELITE') {
    naniteReward += 2;
  } else if (combat.nodeType === 'BOSS') {
    naniteReward += 5;
  }
  if (node?.modifier === 'nanite_cache') {
    naniteReward += 2;
  }
  if (node?.modifier === 'overcharged_hazard') {
    naniteReward += 1;
  }
  return naniteReward;
}

export function tickBetaTrialChipOnCombatExit(hero: HeroState): HeroState {
  if (!hero.betaTrialChip) return hero;
  const remaining = hero.betaTrialChip.combatsRemaining - 1;
  if (remaining > 0) {
    return {
      ...hero,
      betaTrialChip: {
        ...hero.betaTrialChip,
        combatsRemaining: remaining,
      },
    };
  }
  if (hero.betaTrialChip.upgraded) {
    return {
      ...hero,
      betaTrialChip: null,
    };
  }
  const targetInstanceId =
    hero.betaTrialChip.instanceId ??
    hero.ownedChips.find((c) => c.defId === hero.betaTrialChip!.defId)?.instanceId;
  if (!targetInstanceId) {
    return {
      ...hero,
      betaTrialChip: null,
    };
  }
  return {
    ...hero,
    ownedChips: hero.ownedChips.filter((c) => c.instanceId !== targetInstanceId),
    equippedInstanceIds: hero.equippedInstanceIds.filter((id) => id !== targetInstanceId),
    betaTrialChip: null,
  };
}

export function incrementHeirloomOnVictory(hero: HeroState): HeroState {
  if (!hero.heirloomEngravedId) return hero;
  const nextStacks = Math.min(MAX_HEIRLOOM_STACKS, Math.max(1, (hero.heirloomStacks ?? 0) + 1));
  saveInheritedHeirloom(hero.heirloomEngravedId, nextStacks);
  return {
    ...hero,
    heirloomStacks: nextStacks,
  };
}

export function applyBandwidthVowCredits(credits: number, hero: Pick<HeroState, 'activeTempoRule'>): number {
  if (
    hero.activeTempoRule?.id === 'bandwidth_vow' &&
    hero.activeTempoRule.nodesRemaining > 0
  ) {
    return Math.max(0, Math.round(credits * 0.75));
  }
  return credits;
}

export function finalizeCombatVictory(
  run: RunState,
  combat: CombatState,
  hero: HeroState,
): {
  screen: ScreenPhase;
  mapNodes: MapNode[];
  hero: HeroState;
  combat: CombatState;
} {
  const victoryRewards = computeVictoryDirectorRewards(
    combat.rewardCredits,
    combat.turn,
    combat.director,
  );
  const adjustedTotalCredits = applyBandwidthVowCredits(victoryRewards.totalCredits, hero);
  const rewardedCombat: CombatState = {
    ...combat,
    phase: 'VICTORY',
    rewardCredits: adjustedTotalCredits,
    rewardBreakdown: victoryRewards.breakdown,
    director: victoryRewards.director,
  };

  return resolveCombatVictoryTransition(run, rewardedCombat, hero);
}

export function resolveCombatVictoryTransition(
  run: RunState,
  combat: CombatState,
  hero: HeroState,
): {
  screen: ScreenPhase;
  mapNodes: MapNode[];
  hero: HeroState;
  combat: CombatState;
} {
  const tier = run.difficultyTier ?? 3;
  const diff = getDifficultyProfile(tier);
  let nextCombat = combat;
  let nextHero = hero;

  if (diff.mandatoryBonusObjective && !combat.mandateBreachLootConfiscated) {
    const turnTarget = getStageSecondaryTurnTarget(combat.nodeType, tier);
    const startingHp = combat.startingHeroHp ?? hero.hp;
    const hpLost = Math.max(0, startingHp - hero.hp);
    const mandateMet = combat.turn <= turnTarget || hpLost === 0;
    if (!mandateMet) {
      const penaltyHp = 12;
      const breachedHp = Math.max(0, hero.hp - penaltyHp);
      nextCombat = {
        ...combat,
        rewardCredits: 0,
        rewardChipChoices: [],
        mandateBreachPenaltyHp: penaltyHp,
        mandateBreachLootConfiscated: true,
        phase: breachedHp <= 0 ? 'DEFEAT' : combat.phase,
      };
      nextHero = {
        ...hero,
        hp: breachedHp,
      };
      if (breachedHp <= 0) {
        return {
          screen: 'gameover',
          mapNodes: run.mapNodes,
          hero: nextHero,
          combat: nextCombat,
        };
      }
    }
  }

  if (nextCombat.nodeType === 'BOSS') {
    const bossNanites = computeCombatNaniteReward(nextCombat, run.mapNodes);
    let bossHero: HeroState = {
      ...nextHero,
      credits: nextHero.credits + nextCombat.rewardCredits,
      nanites: (nextHero.nanites ?? 0) + bossNanites,
      damageBoostPct: 0,
    };
    bossHero = incrementHeirloomOnVictory(bossHero);
    bossHero = tickBetaTrialChipOnCombatExit(bossHero);
    return {
      screen: 'victory',
      mapNodes: markNodeCleared(run.mapNodes, nextCombat.nodeId),
      hero: bossHero,
      combat: nextCombat,
    };
  }
  return {
    screen: run.screen,
    mapNodes: run.mapNodes,
    hero: nextHero,
    combat: nextCombat,
  };
}

export function applyDamageToEnemy(
  enemy: EnemyUnit,
  damage: number,
  pierceRatio: number,
  breakArmorFirst: boolean,
): {
  enemy: EnemyUnit;
  hpDamageDealt: number;
  effectiveDamageDealt: number;
  defeated: boolean;
  pipCracked: boolean;
  phaseGateHit: boolean;
} {
  if (enemy.hp <= 0 || damage <= 0) {
    return {
      enemy: { ...enemy },
      hpDamageDealt: 0,
      effectiveDamageDealt: 0,
      defeated: false,
      pipCracked: false,
      phaseGateHit: false,
    };
  }

  if (enemy.shieldPips > 0) {
    return {
      enemy: {
        ...enemy,
        shieldPips: enemy.shieldPips - 1,
      },
      hpDamageDealt: 0,
      effectiveDamageDealt: 0,
      defeated: false,
      pipCracked: true,
      phaseGateHit: false,
    };
  }

  const armorBefore = enemy.armor;
  let nextArmor = breakArmorFirst ? 0 : enemy.armor;
  let nextHp = enemy.hp;

  const piercingDmg = Math.floor(damage * pierceRatio);
  const regularDmg = damage - piercingDmg;

  const absorbed = Math.min(nextArmor, regularDmg);
  nextArmor -= absorbed;
  const remainingRegular = regularDmg - absorbed;
  let totalHpLoss = remainingRegular + piercingDmg;
  nextHp = Math.max(0, nextHp - totalHpLoss);

  let phaseGateHit = false;
  let nextShieldPips = enemy.shieldPips;
  let nextPhaseGateTriggered = enemy.phaseGateTriggered;

  if (enemy.phaseGatePct && !enemy.phaseGateTriggered) {
    const thresholdHp = Math.ceil((enemy.maxHp * enemy.phaseGatePct) / 100);
    if (enemy.hp > thresholdHp && nextHp < thresholdHp) {
      totalHpLoss = enemy.hp - thresholdHp;
      nextHp = thresholdHp;
      nextArmor += PHASE_GATE_ARMOR_BONUS;
      nextShieldPips = Math.max(nextShieldPips, 1);
      nextPhaseGateTriggered = true;
      phaseGateHit = true;
    }
  }

  const armorRemoved = breakArmorFirst ? armorBefore : absorbed;
  const effectiveDamageDealt = armorRemoved + totalHpLoss;

  return {
    enemy: {
      ...enemy,
      armor: nextArmor,
      hp: nextHp,
      shieldPips: nextShieldPips,
      phaseGateTriggered: nextPhaseGateTriggered,
    },
    hpDamageDealt: totalHpLoss,
    effectiveDamageDealt,
    defeated: nextHp <= 0,
    pipCracked: false,
    phaseGateHit,
  };
}

export function triggerVolatileBursts(
  enemies: EnemyUnit[],
  newlyDefeatedIds: string[],
  turn: number,
  cues?: AnimationCue[],
): {
  enemies: EnemyUnit[];
  extraDefeated: number;
  extraDamageDealt: number;
  barrelPoppedCount: number;
} {
  const nextEnemies = enemies.map((e) => ({ ...e }));
  const queue = [...newlyDefeatedIds];
  const processed = new Set<string>();
  let extraDefeated = 0;
  let extraDamageDealt = 0;
  let barrelPoppedCount = 0;

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    if (processed.has(sourceId)) continue;
    processed.add(sourceId);

    const sourceEnemy = nextEnemies.find((e) => e.id === sourceId);
    if (!sourceEnemy) continue;
    if (sourceEnemy.propKind === 'bio_husk') continue;
    const isPlasmaBarrel = sourceEnemy.propKind === 'plasma_barrel';
    if (sourceEnemy.passive !== 'volatile_burst' && !isPlasmaBarrel) continue;
    if (isPlasmaBarrel) barrelPoppedCount++;
    const burstDmg = isPlasmaBarrel ? PLASMA_BARREL_BURST_DAMAGE : VOLATILE_BURST_DAMAGE;

    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].id === sourceId || nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
      const burstRes = applyDamageToEnemy(nextEnemies[i], burstDmg, 1.0, false);
      nextEnemies[i] = burstRes.enemy;
      extraDamageDealt += burstRes.effectiveDamageDealt;
      if (cues) {
        cues.push({
          id: `cue_${turn}_burst_${sourceId}_${nextEnemies[i].id}`,
          kind: 'enemy_burst',
          targetId: nextEnemies[i].id,
          value: burstDmg,
          textLabel: isPlasmaBarrel
            ? 'PLASMA BARREL!'
            : burstRes.pipCracked
              ? 'PIP CRACKED'
              : undefined,
        });
        if (burstRes.phaseGateHit) {
          cues.push({
            id: `cue_${turn}_phase_${nextEnemies[i].id}`,
            kind: 'enemy_phase_gate',
            targetId: nextEnemies[i].id,
            value: PHASE_GATE_ARMOR_BONUS,
          });
        }
      }
      if (burstRes.defeated) {
        extraDefeated++;
        if (cues) {
          cues.push({
            id: `cue_${turn}_burst_ko_${nextEnemies[i].id}`,
            kind: 'enemy_ko',
            targetId: nextEnemies[i].id,
          });
        }
        queue.push(nextEnemies[i].id);
      }
    }
  }

  return { enemies: nextEnemies, extraDefeated, extraDamageDealt, barrelPoppedCount };
}

export function evaluateReactiveEnemyShifts(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
  turn: number,
  cues?: AnimationCue[],
): EnemyUnit[] {
  const livingBeforeCount = enemiesBefore.filter(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget,
  ).length;
  const livingAfterCount = enemiesAfter.filter(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget,
  ).length;
  const becameLoneSurvivor = livingBeforeCount >= 2 && livingAfterCount === 1;

  return enemiesAfter.map((after) => {
    if (after.hp <= 0 || after.escaped) {
      return { ...after, staggered: false };
    }
    const before = enemiesBefore.find((b) => b.id === after.id);
    const dmgDelta = before
      ? Math.max(0, before.hp - after.hp) + Math.max(0, before.armor - after.armor)
      : 0;
    const nextTurnDmg = (after.turnDamageTaken ?? 0) + dmgDelta;
    const intent = after.intentCycle[after.currentIntentIndex];

    let nextEnemy: EnemyUnit = {
      ...after,
      turnDamageTaken: nextTurnDmg,
    };

    if (
      intent &&
      (intent.kind === 'charge' || intent.kind === 'heavy') &&
      nextTurnDmg >= STAGGER_BURST_THRESHOLD
    ) {
      const newlyStaggered = !nextEnemy.staggered;
      const newlyBroken = !nextEnemy.weaponBroken && nextTurnDmg >= WEAPON_BREAK_THRESHOLD;
      nextEnemy = {
        ...nextEnemy,
        staggered: true,
        ...(newlyBroken ? { weaponBroken: true } : {}),
      };
      if (newlyStaggered || newlyBroken) {
        cues?.push({
          id: `cue_${turn}_stagger_${nextEnemy.id}`,
          kind: 'enemy_stagger',
          targetId: nextEnemy.id,
          value: nextTurnDmg,
          textLabel: newlyBroken ? 'WEAPON BROKEN (-3 DMG)' : 'STAGGERED',
        });
      }
    }

    if (
      !nextEnemy.desperationEnraged &&
      !nextEnemy.propKind &&
      !nextEnemy.isLootRunner &&
      !nextEnemy.isMercyTarget &&
      (!nextEnemy.sleepCounter || nextEnemy.sleepCounter <= 0) &&
      dmgDelta > 0 &&
      nextEnemy.hp <= Math.ceil(nextEnemy.maxHp * 0.2)
    ) {
      const currentKind = nextEnemy.intentCycle[nextEnemy.currentIntentIndex]?.kind;
      const dmgIdx = nextEnemy.intentCycle.findIndex((i) => isDamagingIntent(i));
      nextEnemy = {
        ...nextEnemy,
        desperationEnraged: true,
        currentIntentIndex:
          (currentKind === 'armor' || currentKind === 'bolster') && dmgIdx !== -1
            ? dmgIdx
            : nextEnemy.currentIntentIndex,
      };
      cues?.push({
        id: `cue_${turn}_desperation_${nextEnemy.id}`,
        kind: 'enemy_enrage',
        targetId: nextEnemy.id,
        value: 3,
        textLabel: 'DESPERATION +3 DMG',
      });
    }

    if (becameLoneSurvivor && nextEnemy.passive === 'anchor_aegis' && !nextEnemy.enragedAlone) {
      const nextBonus = (nextEnemy.enrageAtkBonus ?? 0) + 2;
      const currentKind = nextEnemy.intentCycle[nextEnemy.currentIntentIndex]?.kind;
      const attackIdx = nextEnemy.intentCycle.findIndex((i) => i.kind === 'attack');
      nextEnemy = {
        ...nextEnemy,
        enragedAlone: true,
        enrageAtkBonus: nextBonus,
        currentIntentIndex:
          currentKind === 'bolster' && attackIdx !== -1
            ? attackIdx
            : nextEnemy.currentIntentIndex,
      };
      cues?.push({
        id: `cue_${turn}_enrage_alone_${nextEnemy.id}`,
        kind: 'enemy_enrage',
        targetId: nextEnemy.id,
        value: nextBonus,
        textLabel: 'ALONE +2 ATK',
      });
    }

    return nextEnemy;
  });
}

export interface SimulatedPlayerEnemiesResult {
  enemies: EnemyUnit[];
  defeatedNow: number;
  newlyDefeatedIds: string[];
  damageDealt: number;
  retaliateDamage: number;
  pustuleRuptureCorrode: number;
  barrelPoppedCount: number;
}

export function simulatePlayerActionOnEnemies(
  enemies: readonly EnemyUnit[],
  turn: number,
  preview: TurnPreview,
  cues?: AnimationCue[],
): SimulatedPlayerEnemiesResult {
  let nextEnemies = enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;
  const newlyDefeatedIds: string[] = [];
  let damageDealt = 0;
  let retaliateDamage = 0;
  let pustuleRuptureCorrode = 0;

  const applyHit = (
    targetIdx: number,
    dmg: number,
    pierceRatio: number,
    breakArmorFirst: boolean,
    cueId: string,
    surgeFlag: boolean,
    wakeSleepwalker = false,
  ) => {
    const res = applyDamageToEnemy(nextEnemies[targetIdx], dmg, pierceRatio, breakArmorFirst);
    let updatedTarget = res.enemy;
    if (
      wakeSleepwalker &&
      dmg > 0 &&
      updatedTarget.sleepCounter !== undefined &&
      updatedTarget.sleepCounter > 0
    ) {
      updatedTarget = {
        ...updatedTarget,
        sleepCounter: Math.max(0, updatedTarget.sleepCounter - 1),
      };
    }
    nextEnemies[targetIdx] = updatedTarget;
    damageDealt += res.effectiveDamageDealt;
    cues?.push({
      id: cueId,
      kind: 'hero_slash',
      targetId: updatedTarget.id,
      value: dmg,
      textLabel: res.pipCracked ? 'PIP CRACKED' : undefined,
      surge: surgeFlag,
    });
    if (res.phaseGateHit) {
      cues?.push({
        id: `cue_${turn}_phase_${updatedTarget.id}`,
        kind: 'enemy_phase_gate',
        targetId: updatedTarget.id,
        value: PHASE_GATE_ARMOR_BONUS,
      });
    }
    if (res.defeated) {
      defeatedNow++;
      newlyDefeatedIds.push(updatedTarget.id);
      cues?.push({
        id: `cue_${turn}_ko_${updatedTarget.id}`,
        kind: 'enemy_ko',
        targetId: updatedTarget.id,
      });
    }
    return res;
  };

  const frontIdx = nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
  if (preview.color === 'attack' && frontIdx !== -1) {
    const pierce = preview.armorPiercing ? 0.3 : 0;
    const frontResult = applyHit(
      frontIdx,
      preview.totalDamage,
      pierce,
      preview.surgeTriggered,
      `cue_${turn}_atk_front`,
      preview.surgeTriggered,
      true,
    );
    if (
      !frontResult.defeated &&
      !preview.surgeTriggered &&
      frontResult.enemy.passive === 'spike_retaliate'
    ) {
      retaliateDamage = SPIKE_RETALIATE_DAMAGE;
    }
    if (
      !frontResult.defeated &&
      !preview.surgeTriggered &&
      preview.totalDamage > 0 &&
      !frontResult.enemy.propKind &&
      frontResult.enemy.passive === 'acid_jam'
    ) {
      pustuleRuptureCorrode = PUSTULE_RUPTURE_CORRODE;
    }

    if (preview.cleaveDamage > 0) {
      for (let i = 0; i < nextEnemies.length; i++) {
        if (i === frontIdx || nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
        applyHit(i, preview.cleaveDamage, pierce, false, `cue_${turn}_cleave_${i}`, true, true);
      }
    }
  } else if (preview.color === 'defense' && frontIdx !== -1) {
    if (preview.reflectOnBlock > 0) {
      applyHit(frontIdx, preview.reflectOnBlock, 0, false, `cue_${turn}_def_pulse`, true, false);
    }
    if (preview.techPierceDamage > 0) {
      const targetIdx =
        nextEnemies[frontIdx].hp > 0 && !nextEnemies[frontIdx].escaped
          ? frontIdx
          : nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
      if (targetIdx !== -1) {
        applyHit(
          targetIdx,
          preview.techPierceDamage,
          1.0,
          false,
          `cue_${turn}_def_pierce`,
          preview.surgeTriggered,
          false,
        );
      }
    }
  } else if (preview.color === 'tech') {
    if (preview.armorShredAmount > 0) {
      nextEnemies = nextEnemies.map((enemy) =>
        enemy.hp > 0 && !enemy.escaped
          ? { ...enemy, armor: Math.max(0, enemy.armor - preview.armorShredAmount) }
          : enemy,
      );
    }
    if (preview.techPierceDamage > 0 && frontIdx !== -1) {
      applyHit(
        frontIdx,
        preview.techPierceDamage,
        1.0,
        false,
        `cue_${turn}_tech_pierce`,
        preview.surgeTriggered,
        false,
      );
    }
  }

  if ((preview.hotPotatoPassedDamage ?? 0) > 0) {
    const hpTargetIdx = nextEnemies.findIndex((e) => e.hp > 0 && !e.escaped);
    if (hpTargetIdx !== -1) {
      applyHit(
        hpTargetIdx,
        preview.hotPotatoPassedDamage ?? 0,
        1.0,
        false,
        `cue_${turn}_hot_potato_pass`,
        true,
        preview.color === 'attack',
      );
    }
  }

  if ((preview.temptationCleaveBonus ?? 0) > 0) {
    for (let i = 0; i < nextEnemies.length; i++) {
      if (nextEnemies[i].hp <= 0 || nextEnemies[i].escaped) continue;
      applyHit(
        i,
        preview.temptationCleaveBonus ?? 0,
        0.5,
        false,
        `cue_${turn}_temptation_${i}`,
        true,
        preview.color === 'attack',
      );
    }
  }

  let barrelPoppedCount = 0;
  if (newlyDefeatedIds.length > 0) {
    const burstRes = triggerVolatileBursts(nextEnemies, newlyDefeatedIds, turn, cues);
    nextEnemies = burstRes.enemies;
    defeatedNow += burstRes.extraDefeated;
    damageDealt += burstRes.extraDamageDealt;
    barrelPoppedCount = burstRes.barrelPoppedCount;
  }

  nextEnemies = evaluateReactiveEnemyShifts(enemies, nextEnemies, turn, cues);

  return {
    enemies: nextEnemies,
    defeatedNow,
    newlyDefeatedIds,
    damageDealt,
    retaliateDamage,
    pustuleRuptureCorrode,
    barrelPoppedCount,
  };
}

export function countRewardedKills(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
): number {
  let count = 0;
  for (let i = 0; i < enemiesAfter.length; i++) {
    const after = enemiesAfter[i];
    const before = enemiesBefore.find((b) => b.id === after.id);
    if (after.hp <= 0 && !after.escaped && before && before.hp > 0 && !after.isZeroReward) {
      count += 1;
    }
  }
  return count;
}

export function collectLootRunnerBounties(
  enemiesBefore: readonly EnemyUnit[],
  enemiesAfter: readonly EnemyUnit[],
): number {
  let bounty = 0;
  for (const afterE of enemiesAfter) {
    if (!afterE.isLootRunner || afterE.escaped || afterE.hp > 0) continue;
    const beforeE = enemiesBefore.find((b) => b.id === afterE.id);
    if (beforeE && beforeE.hp > 0) {
      bounty += afterE.bountyCredits ?? 25;
    }
  }
  return bounty;
}

export function applyTugOfWarProgress(params: {
  combat: CombatState;
  hero: HeroState;
  enemies: EnemyUnit[];
  damageDealtDelta: number;
  cues: AnimationCue[];
}): {
  tugOfWarMeter: number | undefined;
  tugOfWarPurged: boolean | undefined;
  crBonus: number;
  enemies: EnemyUnit[];
} {
  let meter = params.combat.tugOfWarMeter;
  let purged = params.combat.tugOfWarPurged;
  let crBonus = 0;
  let nextEnemies = params.enemies;

  if (meter !== undefined && params.damageDealtDelta > 0) {
    meter = Math.min(100, meter + params.damageDealtDelta * 2);
    if (meter >= 100 && !purged) {
      purged = true;
      crBonus = TUG_OF_WAR_PURGE_CR_BONUS;
      params.hero.overdrive = Math.min(100, params.hero.overdrive + TUG_OF_WAR_PURGE_OD_BONUS);
      nextEnemies = nextEnemies.map((e) =>
        e.hp > 0 && !e.escaped && !e.propKind && !e.isMercyTarget
          ? { ...e, staggered: true }
          : e,
      );
      params.cues.push({
        id: `cue_${params.combat.turn}_tug_purge`,
        kind: 'enemy_stagger',
        value: 100,
        textLabel: 'NEURAL PURGE! ALL STAGGERED',
      });
    }
  }

  return { tugOfWarMeter: meter, tugOfWarPurged: purged, crBonus, enemies: nextEnemies };
}

export function applyMercyVictoryBonus(
  combat: CombatState,
  hero: HeroState,
  enemies: readonly EnemyUnit[],
): { mercyCrBonus: number; mercyBonusAwarded: boolean | undefined } {
  const anyHostile = hasHostileLivingEnemies(enemies);
  if (!anyHostile && !combat.mercyBonusAwarded && enemies.some((e) => e.isMercyTarget && e.hp > 0)) {
    hero.hp = Math.min(hero.maxHp, hero.hp + MERCY_REWARD_HP);
    return { mercyCrBonus: MERCY_REWARD_CREDITS, mercyBonusAwarded: true };
  }
  return { mercyCrBonus: 0, mercyBonusAwarded: combat.mercyBonusAwarded };
}
