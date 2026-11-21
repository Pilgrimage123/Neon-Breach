import { MAX_HEIRLOOM_STACKS } from './data';
import { getDifficultyProfile, getStageSecondaryTurnTarget } from './difficulty';
import { saveInheritedHeirloom } from './persistence';
import { computeVictoryDirectorRewards } from './reinforcementDirector';
import type {
  CombatState,
  CyberImplantId,
  EnemyUnit,
  HeroState,
  MapNode,
  RunState,
  ScreenPhase,
  Tile,
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
