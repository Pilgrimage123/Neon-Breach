import {
  CYBER_IMPLANTS,
  MAX_IMPLANTS,
  SKILL_CHIPS_BY_ID,
} from './data';
import {
  applyMedBayAction,
  buyChipDealerChip,
  claimCombatChipReward,
  createInitialRun,
  enrollCharterProdigyTile,
  executeEnemyTurn,
  executeOverdrive,
  hasHostileLivingEnemies,
  installCyberImplant,
  previewColorResolution,
  previewHeroThreat,
  purgeClinicInnateTile,
  resolveCyberEventChoice,
  resolvePlayerColor,
  simulatePlayerActionOnEnemies,
  skipChipDealer,
  skipCyberClinic,
  startNodeEncounter,
} from './gameEngine';
import { getAvailableNextNodes } from './mapGraphNavigation';
import { getTacticalRouteAdvice } from './mapReconAndAdvice';
import { getEquippedChipMemory } from './poolBuilder';
import { repositionFrontEnemies } from '../utils/tacticalSandboxAndHints';
import type {
  CharacterId,
  CyberImplantId,
  DifficultyTier,
  MapNode,
  RunState,
  TileType,
} from './types';

export type SimPolicy = 'novice' | 'tactical';

export type EncounterBucket =
  | 'L0'
  | 'L1_3'
  | 'L4_7'
  | 'L8_10'
  | 'OVERCHARGED'
  | 'ELITE'
  | 'BOSS';

export interface EncounterSimRecord {
  nodeId: string;
  layer: number;
  bucket: EncounterBucket;
  turns: number;
  hpLost: number;
  armorAbsorbed: number;
  won: boolean;
  mandateBreach: boolean;
  lethalMandateBreach: boolean;
  overdriveCasts: number;
}

export interface SingleRunSimResult {
  seed: number;
  characterId: CharacterId;
  difficultyTier: DifficultyTier;
  policy: SimPolicy;
  won: boolean;
  endingLayer: number;
  endingHp: number;
  endingMaxHp: number;
  totalHpLost: number;
  totalArmorAbsorbed: number;
  totalTurns: number;
  totalOverdriveCasts: number;
  totalMandateBreaches: number;
  lethalMandateBreaches: number;
  encounters: EncounterSimRecord[];
}

export interface BucketAggregateStats {
  count: number;
  wins: number;
  winRate: number;
  avgTurns: number;
  avgHpLost: number;
  maxHpLost: number;
}

export interface HeroTierSimSummary {
  characterId: CharacterId;
  difficultyTier: DifficultyTier;
  policy: SimPolicy;
  runs: number;
  wins: number;
  winRate: number;
  avgHpLostPerRun: number;
  avgArmorAbsorbedPerRun: number;
  avgEndingHp: number;
  avgTurnsPerRun: number;
  avgOverdriveCastsPerRun: number;
  totalMandateBreaches: number;
  lethalMandateBreaches: number;
  buckets: Record<EncounterBucket, BucketAggregateStats>;
}

const IMPLANT_PRIORITY: readonly CyberImplantId[] = [
  'surge_resonator',
  'bio_siphon',
  'aegis_capacitor',
  'plasma_amp',
  'nano_weave',
  'piercing_katana',
  'synapse_overclock',
  'flux_injector',
  'monowire_edge',
  'kinetic_reflector',
];

function classifyEncounterBucket(node: MapNode): EncounterBucket {
  if (node.type === 'BOSS') return 'BOSS';
  if (node.type === 'ELITE') return 'ELITE';
  if (node.modifier === 'overcharged_hazard') return 'OVERCHARGED';
  if (node.layer === 0) return 'L0';
  if (node.layer <= 3) return 'L1_3';
  if (node.layer <= 7) return 'L4_7';
  return 'L8_10';
}

function chooseNextMapNode(run: RunState, policy: SimPolicy): MapNode | null {
  const available = getAvailableNextNodes(run.mapNodes, run.currentNodeId);
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  if (policy === 'tactical') {
    const advice = getTacticalRouteAdvice(run);
    const advised = available.find((n) => n.id === advice.recommendedNodeId);
    if (advised) return advised;
    return available[0];
  }

  // Novice policy: heal only when below 42% HP, otherwise prefers Combat / Clinic / Dealer
  const hpRatio = run.hero.hp / Math.max(1, run.hero.maxHp);
  if (hpRatio < 0.42) {
    const medbay = available.find((n) => n.type === 'MED_BAY');
    if (medbay) return medbay;
  }
  const simplePriority: Record<MapNode['type'], number> = {
    COMBAT: 4,
    CHIP_DEALER: 3,
    CYBER_CLINIC: 3,
    EVENT: 2,
    ELITE: 2,
    MED_BAY: 1,
    BOSS: 5,
  };
  return [...available].sort(
    (a, b) => simplePriority[b.type] - simplePriority[a.type],
  )[0];
}

function scoreTacticalColor(
  run: RunState,
  color: TileType,
  baseThreat: ReturnType<typeof previewHeroThreat>,
): number {
  const combat = run.combat;
  if (!combat) return -Infinity;
  const preview = previewColorResolution(run, color);
  if (preview.tileCount === 0) return -Infinity;

  const hpRatio = run.hero.hp / Math.max(1, run.hero.maxHp);
  const livingEnemies = combat.enemies.filter((e) => e.hp > 0 && !e.escaped);
  const hasBlight = combat.board.some((t) => Boolean(t.isBlight));
  const sim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, preview);
  const outcome = previewHeroThreat(combat, run.hero, preview);

  let score = 0;

  // Absolute survival priority
  if (outcome.willDie) {
    score -= 420;
  }

  // Exact encounter clear & multi-kill detection (including cleave, pierce, and volatile burst chains)
  const clearsEncounter = !hasHostileLivingEnemies(sim.enemies);
  if (clearsEncounter) {
    score += 320;
  }
  if (sim.defeatedNow > 0) {
    score += sim.defeatedNow * 58;
  }
  if (outcome.preventedDamageByKills > 0) {
    score += outcome.preventedDamageByKills * 4.2 + 24;
  }

  // Exact enemy effective HP / armor / shield-pip damage dealt across all enemies
  const preEhp = livingEnemies.reduce((s, e) => s + e.hp + e.armor + e.shieldPips * 7, 0);
  const postEhp = sim.enemies
    .filter((e) => e.hp > 0 && !e.escaped)
    .reduce((s, e) => s + e.hp + e.armor + e.shieldPips * 7, 0);
  const ehpRemoved = Math.max(0, preEhp - postEhp);
  score += ehpRemoved * 2.2 + preview.armorShredAmount * 0.8;

  // Exact incoming damage mitigation & HP preservation
  const hpSaved = Math.max(0, baseThreat.hpDamageTaken - outcome.hpDamageTaken);
  const hpWeight = hpRatio < 0.45 ? 5.2 : hpRatio < 0.78 ? 3.5 : 2.6;
  score += hpSaved * hpWeight;
  score -= outcome.hpDamageTaken * (hpRatio < 0.45 ? 3.6 : 2.0);
  if (outcome.willJamTile) score -= 20;
  if (outcome.corrodeGained > 0) score -= outcome.corrodeGained * 5;

  if (baseThreat.rawIncomingDamage === 0 && color === 'defense') {
    score -= 10;
  }

  // Persistent armor & healing value
  score += (preview.armorGained ?? 0) * 2.8;
  const effectiveHeal = Math.min(run.hero.maxHp - run.hero.hp, preview.healAmount);
  score += effectiveHeal * (hpRatio < 0.65 ? 3.8 : 2.2);

  // Stack Surge, Overdrive, UpCharge, DMG Boost
  if (preview.surgeTriggered) score += 24;
  score += preview.overdriveGained * 0.45;
  score += (preview.upchargeGained ?? 0) * 7;
  score += preview.damageBoostAddedPct * 0.35;

  // Cleanse Corrode & Blight
  if (hasBlight && color === 'tech') score += 18;
  if (run.hero.corrode > 0 && preview.cleanseCorrodeAmount > 0) {
    score += preview.cleanseCorrodeAmount * 8;
  }

  // Hero-specific rhythm bonuses
  if (preview.freeTurnTriggered) {
    score += 36;
  }
  if (preview.droneSyncTriggered) {
    score += 16;
  }

  // Avoid triggering active Tile Hex unless clearing or killing caster
  const hasSurvivingHex = (preview.hexedHealBonus ?? 0) > 0;
  if (hasSurvivingHex && !clearsEncounter) {
    score -= 14;
  }

  return score;
}

function chooseCombatAction(
  run: RunState,
  policy: SimPolicy,
  allowPush: boolean,
): { color: TileType; usePush: boolean } | null {
  const combat = run.combat;
  if (!combat) return null;
  const colors: TileType[] = ['attack', 'defense', 'tech'];
  const previews = colors
    .map((color) => ({ color, preview: previewColorResolution(run, color) }))
    .filter((entry) => entry.preview.tileCount > 0);

  if (previews.length === 0) return null;

  const baseThreat = previewHeroThreat(combat, run.hero, null);

  if (policy === 'novice') {
    if (previews.length === 1) return { color: previews[0].color, usePush: false };
    const hpRatio = run.hero.hp / Math.max(1, run.hero.maxHp);
    if (hpRatio < 0.45 && baseThreat.rawIncomingDamage >= 10) {
      const def = previews.find((p) => p.color === 'defense');
      if (def && def.preview.shieldGained >= 6) return { color: 'defense', usePush: false };
    }
    const tieOrder: Record<TileType, number> = { attack: 3, defense: 2, tech: 1 };
    const picked = [...previews].sort((a, b) => {
      if (b.preview.tileCount !== a.preview.tileCount) {
        return b.preview.tileCount - a.preview.tileCount;
      }
      return tieOrder[b.color] - tieOrder[a.color];
    })[0].color;
    return { color: picked, usePush: false };
  }

  // Tactical policy evaluates all colors with and without 0-AP front-line Push [R]
  let best: { color: TileType; usePush: boolean; score: number } = {
    color: previews[0].color,
    usePush: false,
    score: -Infinity,
  };

  for (const { color } of previews) {
    const score = scoreTacticalColor(run, color, baseThreat);
    if (score > best.score) {
      best = { color, usePush: false, score };
    }
  }

  const livingCount = combat.enemies.filter((e) => e.hp > 0 && !e.escaped).length;
  if (allowPush && livingCount >= 2) {
    const swapped = repositionFrontEnemies(combat);
    if (swapped.swapped) {
      const pushedRun: RunState = {
        ...run,
        combat: { ...combat, enemies: swapped.enemies },
      };
      const pushedBaseThreat = previewHeroThreat(pushedRun.combat, pushedRun.hero, null);
      for (const { color } of previews) {
        const score = scoreTacticalColor(pushedRun, color, pushedBaseThreat) - 2;
        if (score > best.score) {
          best = { color, usePush: true, score };
        }
      }
    }
  }

  return { color: best.color, usePush: best.usePush };
}

function shouldFireOverdrive(run: RunState, policy: SimPolicy): boolean {
  if (!run.combat || run.hero.overdrive < 100) return false;
  if (policy === 'novice') return true;

  const living = run.combat.enemies.filter((e) => e.hp > 0);
  if (living.length === 0) return false;
  const totalEnemyEhp = living.reduce((acc, e) => acc + e.hp + e.armor, 0);
  const hasBoardHazard = run.combat.board.some(
    (t) => Boolean(t.isJammed) || Boolean(t.isBlight) || Boolean(t.hexedByEnemyId),
  );
  if (hasBoardHazard) return true;
  if (living.length >= 2) return true;
  if (totalEnemyEhp >= 16) return true;
  if (run.hero.hp <= run.hero.maxHp * 0.55) return true;
  return false;
}

function handleClinicScreen(run: RunState, policy: SimPolicy): RunState {
  let next = run;
  if (policy === 'tactical') {
    // Auraline upgrades Reactor Core Dud via Charter Academy if affordable
    if (next.hero.characterId === 'auraline' && next.hero.credits >= 20) {
      const dud = next.masterPool.find(
        (t) =>
          t.sourceId === 'innate' &&
          t.isDud &&
          !(next.hero.prodigyTileIds ?? []).includes(t.id),
      );
      if (dud) {
        next = enrollCharterProdigyTile(next, dud.id);
      }
    } else if (!next.clinicPurgeUsed && next.hero.credits >= 30 && next.masterPool.length > 7) {
      // Purge lowest-value innate tile if pool is bloated
      const weakInnate = next.masterPool
        .filter((t) => t.sourceId === 'innate' && t.type === 'attack' && t.value <= 4)
        .sort((a, b) => a.value - b.value)[0];
      if (weakInnate) {
        next = purgeClinicInnateTile(next, weakInnate.id);
      }
    }
  }

  const choices = next.clinicChoices;
  if (choices.length === 0) return skipCyberClinic(next);

  const chosen =
    policy === 'tactical'
      ? [...choices].sort(
          (a, b) => IMPLANT_PRIORITY.indexOf(a) - IMPLANT_PRIORITY.indexOf(b),
        )[0]
      : choices[0];

  if (next.hero.implants.length < MAX_IMPLANTS) {
    return installCyberImplant(next, chosen);
  }
  if (policy === 'tactical') {
    const worstInstalled = [...next.hero.implants].sort(
      (a, b) => IMPLANT_PRIORITY.indexOf(b) - IMPLANT_PRIORITY.indexOf(a),
    )[0];
    if (
      IMPLANT_PRIORITY.indexOf(chosen) < IMPLANT_PRIORITY.indexOf(worstInstalled)
    ) {
      return installCyberImplant(next, chosen, worstInstalled);
    }
  }
  return skipCyberClinic(next);
}

function handleChipDealerScreen(run: RunState, policy: SimPolicy): RunState {
  let next = run;
  const currentNode = next.mapNodes.find((n) => n.id === next.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const freeMem = next.hero.memoryCapacity - getEquippedChipMemory(next.hero);
  const affordable: Array<{
    defId: string;
    def: NonNullable<(typeof SKILL_CHIPS_BY_ID)[string]>;
    cost: number;
  }> = [];
  for (const defId of next.chipDealerChoices ?? []) {
    const def = SKILL_CHIPS_BY_ID[defId];
    if (!def) continue;
    const cost = isFlashSale ? Math.max(5, Math.round(def.price * 0.65)) : def.price;
    if (cost <= next.hero.credits && def.memoryCost <= freeMem) {
      affordable.push({ defId, def, cost });
    }
  }

  if (affordable.length > 0) {
    const picked =
      policy === 'tactical'
        ? [...affordable].sort((a, b) => b.cost - a.cost)[0]
        : affordable[0];
    next = buyChipDealerChip(next, picked.defId);
  }

  return skipChipDealer(next);
}

function handleMedBayScreen(run: RunState, policy: SimPolicy): RunState {
  const hpRatio = run.hero.hp / Math.max(1, run.hero.maxHp);
  if (policy === 'novice') {
    return applyMedBayAction(run, hpRatio < 0.75 ? 'heal' : 'salvage_credits');
  }
  if (hpRatio <= 0.68) {
    return applyMedBayAction(run, 'heal');
  }
  if ((run.hero.overclockCount ?? 0) < 2) {
    return applyMedBayAction(run, 'tile_overclock');
  }
  if (hpRatio < 0.88) {
    return applyMedBayAction(run, 'calibrate_max_hp');
  }
  return applyMedBayAction(run, 'salvage_credits');
}

function handleEventScreen(run: RunState, policy: SimPolicy): RunState {
  const event = run.activeEvent;
  if (!event || event.choices.length === 0) {
    return { ...run, screen: 'map', activeEvent: null };
  }
  // Pick a safe choice that does not kill the hero
  if (policy === 'tactical') {
    for (let i = 0; i < event.choices.length; i++) {
      const candidate = resolveCyberEventChoice(run, i);
      if (candidate.screen !== 'gameover' && candidate.hero.hp >= Math.min(run.hero.hp, 15)) {
        return candidate;
      }
    }
  }
  return resolveCyberEventChoice(run, 0);
}

function chooseCombatChipLoot(run: RunState, policy: SimPolicy): string | null {
  const combat = run.combat;
  if (!combat || combat.rewardChipChoices.length === 0) return null;
  const freeMem = run.hero.memoryCapacity - getEquippedChipMemory(run.hero);
  const fitting = combat.rewardChipChoices
    .map((id) => SKILL_CHIPS_BY_ID[id])
    .filter((def): def is NonNullable<typeof def> => Boolean(def) && def.memoryCost <= freeMem);

  if (fitting.length === 0) return null;
  if (policy === 'novice') return fitting[0].id;
  // Prefer higher-tier / higher-price chips that fit memory
  return [...fitting].sort((a, b) => b.price - a.price)[0].id;
}

export function simulateFullRun(
  seed: number,
  characterId: CharacterId,
  difficultyTier: DifficultyTier,
  policy: SimPolicy = 'tactical',
): SingleRunSimResult {
  let run = createInitialRun(seed, characterId, difficultyTier);
  const encounters: EncounterSimRecord[] = [];
  let totalHpLost = 0;
  let totalArmorAbsorbed = 0;
  let totalTurns = 0;
  let totalOverdriveCasts = 0;
  let totalMandateBreaches = 0;
  let lethalMandateBreaches = 0;

  let safetySteps = 0;
  while (run.screen !== 'victory' && run.screen !== 'gameover' && safetySteps < 60) {
    safetySteps += 1;

    if (run.screen === 'map') {
      const nextNode = chooseNextMapNode(run, policy);
      if (!nextNode) break;
      run = startNodeEncounter(run, nextNode.id);
      continue;
    }

    if (run.screen === 'combat' && run.combat) {
      const activeNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
      const bucket: EncounterBucket = activeNode
        ? classifyEncounterBucket(activeNode)
        : 'L0';
      const layer = activeNode?.layer ?? (encounters[encounters.length - 1]?.layer ?? 0);
      let combatHpLost = 0;
      let combatArmorAbsorbed = 0;
      let combatOverdriveCasts = 0;

      let pushedThisTurn = false;
      let lastTurnNumber = run.combat.turn;
      let guard = 0;
      while (
        run.screen === 'combat' &&
        run.combat &&
        run.combat.phase !== 'VICTORY' &&
        run.combat.phase !== 'DEFEAT' &&
        guard < 60
      ) {
        guard += 1;
        if (run.combat.turn !== lastTurnNumber) {
          lastTurnNumber = run.combat.turn;
          pushedThisTurn = false;
        }
        if (run.combat.phase === 'PLAYER_IDLE') {
          if (shouldFireOverdrive(run, policy)) {
            const preOdBreach = Boolean(run.combat.mandateBreachLootConfiscated);
            const preOdHp = run.hero.hp;
            run = executeOverdrive(run);
            combatOverdriveCasts += 1;
            if (!preOdBreach && run.combat?.mandateBreachLootConfiscated) {
              combatHpLost += Math.min(Math.max(0, preOdHp - 1), run.combat.mandateBreachPenaltyHp ?? 0);
            } else if (run.hero.hp < preOdHp) {
              combatHpLost += preOdHp - run.hero.hp;
            }
            if (!run.combat || run.combat.phase !== 'PLAYER_IDLE') continue;
          }
          const action = chooseCombatAction(run, policy, !pushedThisTurn);
          if (!action) break;
          if (action.usePush && run.combat) {
            const swapped = repositionFrontEnemies(run.combat);
            if (swapped.swapped) {
              run = { ...run, combat: { ...run.combat, enemies: swapped.enemies } };
              pushedThisTurn = true;
            }
          }
          const preview = previewColorResolution(run, action.color);
          const preBreach = Boolean(run.combat?.mandateBreachLootConfiscated);
          const preHp = run.hero.hp;
          const preArmor = run.hero.armor ?? 0;
          const expectedHeal = Math.min(run.hero.maxHp - preHp, preview.healAmount);
          run = resolvePlayerColor(run, action.color);
          const postHp = run.hero.hp;
          const breachJustTriggered = !preBreach && Boolean(run.combat?.mandateBreachLootConfiscated);
          if (breachJustTriggered) {
            combatHpLost += Math.min(
              Math.max(0, preHp + expectedHeal - 1),
              run.combat?.mandateBreachPenaltyHp ?? 0,
            );
          } else if (postHp < preHp + expectedHeal) {
            combatHpLost += Math.max(0, preHp + expectedHeal - postHp);
          }
          if ((run.hero.armor ?? 0) < preArmor) {
            combatArmorAbsorbed += preArmor - (run.hero.armor ?? 0);
          }
        } else if (
          run.combat.phase === 'PLAYER_RESOLVED' ||
          run.combat.phase === 'ENEMY_ACTING'
        ) {
          const preHp = run.hero.hp;
          const preArmor = run.hero.armor ?? 0;
          const preLiving = run.combat.enemies.filter((e) => e.hp > 0 && !e.escaped).length;
          run = executeEnemyTurn(run);
          const postLiving = run.combat
            ? run.combat.enemies.filter((e) => e.hp > 0 && !e.escaped).length
            : 0;
          const bioSiphonHeal =
            run.hero.hp > 0 && run.hero.implants.includes('bio_siphon')
              ? Math.max(0, preLiving - postLiving) * 4
              : 0;
          const hpDelta = preHp - run.hero.hp + bioSiphonHeal;
          if (hpDelta > 0) combatHpLost += hpDelta;
          if ((run.hero.armor ?? 0) < preArmor) {
            combatArmorAbsorbed += preArmor - (run.hero.armor ?? 0);
          }
        } else {
          break;
        }
      }

      const wonEncounter =
        run.screen === 'victory' || run.combat?.phase === 'VICTORY';
      const turns = run.combat?.turn ?? 1;
      const mandateBreach = Boolean(run.combat?.mandateBreachLootConfiscated);
      const lethalBreach = mandateBreach && run.hero.hp <= 0;

      totalHpLost += combatHpLost;
      totalArmorAbsorbed += combatArmorAbsorbed;
      totalTurns += turns;
      totalOverdriveCasts += combatOverdriveCasts;
      if (mandateBreach) totalMandateBreaches += 1;
      if (lethalBreach) lethalMandateBreaches += 1;

      encounters.push({
        nodeId: activeNode?.id ?? `layer_${layer}`,
        layer,
        bucket,
        turns,
        hpLost: combatHpLost,
        armorAbsorbed: combatArmorAbsorbed,
        won: wonEncounter,
        mandateBreach,
        lethalMandateBreach: lethalBreach,
        overdriveCasts: combatOverdriveCasts,
      });

      if (run.screen === 'combat' && run.combat?.phase === 'VICTORY') {
        const chosenChip = chooseCombatChipLoot(run, policy);
        run = claimCombatChipReward(run, chosenChip);
      } else if (run.combat?.phase === 'DEFEAT') {
        break;
      }
      continue;
    }

    if (run.screen === 'clinic') {
      run = handleClinicScreen(run, policy);
      continue;
    }

    if (run.screen === 'chip_dealer') {
      run = handleChipDealerScreen(run, policy);
      continue;
    }

    if (run.screen === 'medbay') {
      run = handleMedBayScreen(run, policy);
      continue;
    }

    if (run.screen === 'event') {
      run = handleEventScreen(run, policy);
      continue;
    }

    break;
  }

  const finalNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  return {
    seed,
    characterId,
    difficultyTier,
    policy,
    won: run.screen === 'victory',
    endingLayer: finalNode?.layer ?? (encounters[encounters.length - 1]?.layer ?? 0),
    endingHp: run.hero.hp,
    endingMaxHp: run.hero.maxHp,
    totalHpLost,
    totalArmorAbsorbed,
    totalTurns,
    totalOverdriveCasts,
    totalMandateBreaches,
    lethalMandateBreaches,
    encounters,
  };
}

const ALL_BUCKETS: readonly EncounterBucket[] = [
  'L0',
  'L1_3',
  'L4_7',
  'L8_10',
  'OVERCHARGED',
  'ELITE',
  'BOSS',
];

export function runBalanceBatch(
  characterId: CharacterId,
  difficultyTier: DifficultyTier,
  seeds: readonly number[],
  policy: SimPolicy = 'tactical',
): HeroTierSimSummary {
  const results = seeds.map((seed) =>
    simulateFullRun(seed, characterId, difficultyTier, policy),
  );
  const runs = Math.max(1, results.length);
  const wins = results.filter((r) => r.won).length;

  const bucketAccum = Object.fromEntries(
    ALL_BUCKETS.map((b) => [b, [] as EncounterSimRecord[]]),
  ) as Record<EncounterBucket, EncounterSimRecord[]>;

  for (const res of results) {
    for (const enc of res.encounters) {
      bucketAccum[enc.bucket].push(enc);
    }
  }

  const buckets = Object.fromEntries(
    ALL_BUCKETS.map((b) => {
      const list = bucketAccum[b];
      const count = list.length;
      const bWins = list.filter((e) => e.won).length;
      const stats: BucketAggregateStats = {
        count,
        wins: bWins,
        winRate: count > 0 ? bWins / count : 0,
        avgTurns:
          count > 0 ? list.reduce((s, e) => s + e.turns, 0) / count : 0,
        avgHpLost:
          count > 0 ? list.reduce((s, e) => s + e.hpLost, 0) / count : 0,
        maxHpLost: count > 0 ? Math.max(...list.map((e) => e.hpLost)) : 0,
      };
      return [b, stats];
    }),
  ) as Record<EncounterBucket, BucketAggregateStats>;

  return {
    characterId,
    difficultyTier,
    policy,
    runs: results.length,
    wins,
    winRate: wins / runs,
    avgHpLostPerRun: results.reduce((s, r) => s + r.totalHpLost, 0) / runs,
    avgArmorAbsorbedPerRun:
      results.reduce((s, r) => s + r.totalArmorAbsorbed, 0) / runs,
    avgEndingHp: results.reduce((s, r) => s + r.endingHp, 0) / runs,
    avgTurnsPerRun: results.reduce((s, r) => s + r.totalTurns, 0) / runs,
    avgOverdriveCastsPerRun:
      results.reduce((s, r) => s + r.totalOverdriveCasts, 0) / runs,
    totalMandateBreaches: results.reduce(
      (s, r) => s + r.totalMandateBreaches,
      0,
    ),
    lethalMandateBreaches: results.reduce(
      (s, r) => s + r.lethalMandateBreaches,
      0,
    ),
    buckets,
  };
}

export function runBalanceMatrix(
  seeds: readonly number[],
  policy: SimPolicy = 'tactical',
  tiers: readonly DifficultyTier[] = [1, 2, 3, 4, 5],
): HeroTierSimSummary[] {
  const heroes: readonly CharacterId[] = ['kira', 'auraline', 'zuri'];
  const summaries: HeroTierSimSummary[] = [];
  for (const tier of tiers) {
    for (const hero of heroes) {
      summaries.push(runBalanceBatch(hero, tier, seeds, policy));
    }
  }
  return summaries;
}

export function getSimImplantPoolCount(): number {
  return CYBER_IMPLANTS.length;
}
