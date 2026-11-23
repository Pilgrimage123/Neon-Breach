import type { Language } from '../i18n/translations';
import { getCyberEventForNode } from './cyberEvents';
import { ENEMY_TEMPLATES, MAX_IMPLANTS } from './data';
import { computeMedBayHealAmount } from './dynastyClinicEngine';
import { buildEnemiesForNode } from './encounterBuilder';
import type {
  NodeEncounterIntel,
  ReconNodePreview,
  RouteAdviceReason,
  TacticalRouteAdvice,
} from './mapBossAndEconomy';
import { getAvailableNextNodes } from './mapGraphNavigation';
import { getEquippedChipMemory } from './poolBuilder';
import type {
  DifficultyTier,
  EnemyPassiveKind,
  MapNode,
  RunState,
} from './types';

export function getNodeEncounterIntel(
  node: MapNode,
  seed: number,
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): NodeEncounterIntel {
  const isCs = lang === 'cs';
  const laneSuffix =
    node.layer === 0
      ? 'GATE'
      : node.type === 'BOSS'
        ? 'CORE'
        : node.lane === 0
          ? 'N-CANOPY'
          : node.lane === 1
            ? 'C-SPINE'
            : 'S-CATWALK';
  const stageNum = String(node.layer + 1).padStart(2, '0');
  const sectorCode = `S${stageNum}-${laneSuffix}`;

  const threatTraits: string[] = [];

  if (node.modifier === 'golden_bounty') {
    threatTraits.push(
      isCs ? 'Zlatý cíl (+50 % odměna kreditů)' : 'High-Value Target (+50% Bounty Credits)',
    );
  } else if (node.modifier === 'double_credits') {
    threatTraits.push(
      isCs ? 'Korporátní kontrakt (2× bojové kredity)' : 'Corporate Pay-Order (2× Combat Credits)',
    );
  } else if (node.modifier === 'nanite_cache') {
    threatTraits.push(
      isCs ? 'Ukradená skrýš nanitů (+2 Nanity)' : 'Stolen Nanite Cache (+2 Meta Nanites)',
    );
  } else if (node.modifier === 'overcharged_hazard') {
    threatTraits.push(
      isCs
        ? 'Přetížená hrozba (+15 % síla nepřátel, +1 Nanit)'
        : 'Overcharged Hazard (+15% Enemy Stats, Drops +1 Meta Nanite)',
    );
  } else if (node.modifier === 'flash_sale') {
    threatTraits.push(
      isCs ? 'Bleskový výprodej (-35 % ceny AI čipů)' : 'Flash Sale Dealer (-35% AI Chip Prices)',
    );
  } else if (node.modifier === 'funded_clinic') {
    threatTraits.push(
      isCs
        ? 'Dotovaná ošetřovna (+12 HP bonus ke každé volbě)'
        : 'Funded Hearth (+12 HP Bonus Repair on Any Action)',
    );
  }

  if (
    node.type === 'CYBER_CLINIC' ||
    node.type === 'CHIP_DEALER' ||
    node.type === 'MED_BAY' ||
    node.type === 'EVENT'
  ) {
    return {
      sectorCode,
      enemies: [],
      totalEnemyHp: 0,
      totalEnemyArmor: 0,
      enemyPassives: [],
      threatTraits: Array.from(new Set(threatTraits)),
    };
  }

  const spawnedEnemies = buildEnemiesForNode(
    node.type,
    node.layer,
    seed,
    node.lane,
    node.modifier,
    difficultyTier,
    Boolean(node.isBreatherNode),
  );
  const passivesSet = new Set<EnemyPassiveKind>();

  const enemies = spawnedEnemies.map((unit) => {
    const tpl = ENEMY_TEMPLATES[unit.archetype];
    if (tpl.passive) {
      passivesSet.add(tpl.passive);
    }
    if (unit.archetype === 'boss') {
      threatTraits.push(isCs ? '50% Fázová brána' : '50% Phase Gate');
      threatTraits.push(isCs ? 'Posily roje a Bio-schránky' : 'Brood Swarm & Bio-Husks');
    } else if (unit.archetype === 'spitter') {
      threatTraits.push(
        isCs ? 'Žíravá kyselina a Žíravá struska' : 'Corrosive Acid & Caustic Slag',
      );
    } else if (unit.archetype === 'stalker') {
      threatTraits.push(
        isCs ? 'Průrazný úder (ignoruje Štít)' : 'Shield-Piercing Strike',
      );
    } else if (unit.archetype === 'stinger') {
      threatTraits.push(
        isCs ? 'Nabíjený Přetlak (×2) · 16+ Omráčí' : 'Charged Overwhelm (×2) · 16+ Staggers',
      );
    } else if (unit.archetype === 'brute') {
      threatTraits.push(
        isCs ? 'Přetlakový drtivý úder · 6 Brnění a 1 Aegis Pip' : 'Overwhelm Heavy Smash · 6 Armor & 1 Aegis Pip',
      );
    }
    return {
      archetype: unit.archetype,
      hp: unit.maxHp,
      armor: unit.armor,
    };
  });

  if (node.type === 'ELITE') {
    threatTraits.unshift(
      isCs
        ? 'Elitní Mutantka (Kořist +2 Nanity)'
        : 'Elite Mutant (Drops +2 Nanites)',
    );
  }

  const totalEnemyHp = enemies.reduce((acc, e) => acc + e.hp, 0);
  const totalEnemyArmor = enemies.reduce((acc, e) => acc + e.armor, 0);

  return {
    sectorCode,
    enemies,
    totalEnemyHp,
    totalEnemyArmor,
    enemyPassives: Array.from(passivesSet),
    threatTraits: Array.from(new Set(threatTraits)),
  };
}

export function getReconPreviewForNode(
  node: MapNode,
  run: RunState,
  lang: Language = 'en',
): ReconNodePreview | null {
  const hasRecon =
    run.hero.implants.includes('synapse_overclock') ||
    run.hero.implants.includes('surge_resonator');
  if (!hasRecon) return null;

  if (node.type === 'EVENT') {
    const event = getCyberEventForNode(
      node,
      run.seed + node.layer * 23 + node.lane * 7,
      run.hero,
      lang,
    );
    return {
      kind: 'event',
      eventTitle: event.title,
      choices: event.choices.map((c) => c.label),
    };
  }

  if (node.type === 'CYBER_CLINIC') {
    return {
      kind: 'clinic',
      isFlashSale: node.modifier === 'flash_sale',
      openSockets: Math.max(0, MAX_IMPLANTS - run.hero.implants.length),
    };
  }

  if (node.type === 'CHIP_DEALER') {
    const freeMemory = Math.max(0, run.hero.memoryCapacity - getEquippedChipMemory(run.hero));
    return {
      kind: 'chip_dealer',
      isFlashSale: node.modifier === 'flash_sale',
      freeMemory,
    };
  }

  if (node.type === 'MED_BAY') {
    const isFunded = node.modifier === 'funded_clinic';
    return {
      kind: 'medbay',
      healTotal: computeMedBayHealAmount(run.hero.maxHp) + (isFunded ? 12 : 0),
      isFunded,
    };
  }

  const spawned = buildEnemiesForNode(
    node.type,
    node.layer,
    run.seed,
    node.lane,
    node.modifier,
    run.difficultyTier ?? 3,
    Boolean(node.isBreatherNode),
  );
  return {
    kind: 'combat',
    enemies: spawned.map((e) => ({
      archetype: e.archetype,
      hp: e.maxHp,
      armor: e.armor,
      firstIntent: e.intentCycle[e.currentIntentIndex],
    })),
  };
}

export function getTacticalRouteAdvice(run: RunState): TacticalRouteAdvice {
  const available = getAvailableNextNodes(run.mapNodes, run.currentNodeId);
  if (available.length === 0) {
    return {
      recommendedNodeId: null,
      reasonKey: 'combat_momentum',
    };
  }

  const byId = new Map(run.mapNodes.map((n) => [n.id, n]));
  const hpRatio = run.hero.hp / Math.max(1, run.hero.maxHp);
  const openSockets = Math.max(0, MAX_IMPLANTS - run.hero.implants.length);

  if (available.length === 1 && available[0].type === 'BOSS') {
    return {
      recommendedNodeId: available[0].id,
      reasonKey: 'boss_engage',
    };
  }

  let bestNode = available[0];
  let bestScore = -999;
  let bestReason: RouteAdviceReason = 'combat_momentum';

  for (const cand of available) {
    const nextNodes = cand.nextIds
      .map((id) => byId.get(id))
      .filter((n): n is MapNode => Boolean(n));
    const hasDownstreamMedBay = nextNodes.some((n) => n.type === 'MED_BAY');
    const hasDownstreamElite = nextNodes.some((n) => n.type === 'ELITE');
    const hasDownstreamClinic = nextNodes.some((n) => n.type === 'CYBER_CLINIC');

    let score = 0;
    let reason: RouteAdviceReason = 'combat_momentum';

    if (hpRatio <= 0.62) {
      if (cand.type === 'MED_BAY') {
        score += 160 + (cand.modifier === 'funded_clinic' ? 20 : 0);
        reason = 'low_hp_medbay';
      } else if (cand.type === 'CYBER_CLINIC') {
        score += 75 + (hasDownstreamMedBay ? 35 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'clinic_socket';
      } else if (cand.type === 'CHIP_DEALER') {
        score += 65 + (hasDownstreamMedBay ? 30 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'combat_momentum';
      } else if (cand.type === 'EVENT') {
        score += 70 + (hasDownstreamMedBay ? 35 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'combat_momentum';
      } else if (cand.type === 'COMBAT') {
        score += 55 + (hasDownstreamMedBay ? 45 : 0) - (cand.modifier === 'overcharged_hazard' ? 25 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'combat_momentum';
      } else if (cand.type === 'ELITE') {
        score -= 40;
      }
    } else {
      if (cand.type === 'ELITE') {
        score += 110 + (openSockets > 0 ? 25 : 0);
        reason = 'elite_power_spike';
      } else if (cand.type === 'CYBER_CLINIC') {
        score += (openSockets > 0 ? 95 : 50) + (hasDownstreamElite ? 25 : 0);
        reason = openSockets > 0 ? 'clinic_socket' : 'elite_power_spike';
      } else if (cand.type === 'CHIP_DEALER') {
        score +=
          (run.hero.credits >= 30 ? 90 : 45) +
          (hasDownstreamElite ? 20 : 0) +
          (cand.modifier === 'flash_sale' && run.hero.credits >= 20 ? 35 : 0);
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'EVENT') {
        score += 85 + (hasDownstreamElite ? 20 : 0);
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'COMBAT') {
        const streakBonus =
          run.hero.consecutiveCombatWithoutClinic &&
          run.hero.consecutiveCombatWithoutClinic >= 2
            ? 15
            : 0;
        score +=
          75 +
          (hasDownstreamElite ? 30 : 0) +
          (hasDownstreamClinic && openSockets > 0 ? 20 : 0) +
          (cand.modifier === 'overcharged_hazard' ? 30 : 0) +
          streakBonus;
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'MED_BAY') {
        score += 45 + (cand.modifier === 'funded_clinic' ? 20 : 0);
      }

      if (cand.modifier === 'golden_bounty' || cand.modifier === 'double_credits') {
        score += 25;
      } else if (cand.modifier === 'nanite_cache') {
        score += 35;
      }
    }

    if (cand.nextIds.length === 3) {
      score += 8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestNode = cand;
      bestReason = reason;
    }
  }

  return {
    recommendedNodeId: bestNode.id,
    reasonKey: bestReason,
  };
}
