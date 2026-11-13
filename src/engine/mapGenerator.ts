import { ENEMY_TEMPLATES, MAX_IMPLANTS, buildEncounterSpec } from './data';
import type { EnemyArchetype, MapNode, MapNodeType, RunState } from './types';

export interface NodeEncounterIntel {
  sectorCode: string;
  enemies: Array<{ archetype: EnemyArchetype; hp: number; armor: number }>;
  totalEnemyHp: number;
}

export type RouteAdviceReason =
  | 'low_hp_medbay'
  | 'elite_power_spike'
  | 'clinic_socket'
  | 'boss_engage'
  | 'combat_momentum';

export interface TacticalRouteAdvice {
  recommendedNodeId: string | null;
  reasonKey: RouteAdviceReason;
}

export function generateSectorMap(seed: number): MapNode[] {
  const nodes: MapNode[] = [];
  const variant = ((seed % 3) + 3) % 3;

  let laneLayouts: MapNodeType[][];
  let l1ToL2Edges: number[][];
  let l2ToL3Edges: number[][];

  if (variant === 0) {
    laneLayouts = [
      ['COMBAT'],
      ['CYBER_CLINIC', 'COMBAT', 'COMBAT'],
      ['ELITE', 'COMBAT', 'MED_BAY'],
      ['MED_BAY', 'ELITE', 'CYBER_CLINIC'],
      ['BOSS'],
    ];
    l1ToL2Edges = [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ];
    l2ToL3Edges = [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ];
  } else if (variant === 1) {
    laneLayouts = [
      ['COMBAT'],
      ['COMBAT', 'CYBER_CLINIC', 'COMBAT'],
      ['ELITE', 'COMBAT', 'MED_BAY'],
      ['MED_BAY', 'ELITE', 'CYBER_CLINIC'],
      ['BOSS'],
    ];
    // Central Clinic (L1[1]) routes to Elite (L2[0]) or Combat (L2[1]), never directly to Med-Bay
    l1ToL2Edges = [
      [0, 1],
      [0, 1],
      [1, 2],
    ];
    l2ToL3Edges = [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ];
  } else {
    laneLayouts = [
      ['COMBAT'],
      ['COMBAT', 'COMBAT', 'CYBER_CLINIC'],
      ['MED_BAY', 'COMBAT', 'ELITE'],
      ['CYBER_CLINIC', 'ELITE', 'MED_BAY'],
      ['BOSS'],
    ];
    l1ToL2Edges = [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ];
    l2ToL3Edges = [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ];
  }

  for (let layer = 0; layer < laneLayouts.length; layer++) {
    const types = laneLayouts[layer];
    for (let lane = 0; lane < types.length; lane++) {
      nodes.push({
        id: `n_${layer}_${lane}`,
        layer,
        lane,
        type: types[lane],
        nextIds: [],
        cleared: false,
      });
    }
  }

  // Wire forward edges layer by layer with strict planar non-crossing topology
  const getNode = (layer: number, lane: number) =>
    nodes.find((n) => n.layer === layer && n.lane === lane);

  // Layer 0 -> Layer 1 (all 3 lanes)
  const l0 = getNode(0, 0);
  if (l0) {
    l0.nextIds = [0, 1, 2]
      .map((lane) => getNode(1, lane)?.id)
      .filter((id): id is string => Boolean(id));
  }

  // Layer 1 -> Layer 2
  for (let lane = 0; lane < 3; lane++) {
    const from = getNode(1, lane);
    if (!from) continue;
    from.nextIds = l1ToL2Edges[lane]
      .map((targetLane) => getNode(2, targetLane)?.id)
      .filter((id): id is string => Boolean(id));
  }

  // Layer 2 -> Layer 3
  for (let lane = 0; lane < 3; lane++) {
    const from = getNode(2, lane);
    if (!from) continue;
    from.nextIds = l2ToL3Edges[lane]
      .map((targetLane) => getNode(3, targetLane)?.id)
      .filter((id): id is string => Boolean(id));
  }

  // Layer 3 -> Layer 4 (Boss)
  const boss = getNode(4, 0);
  if (boss) {
    for (let lane = 0; lane < 3; lane++) {
      const from = getNode(3, lane);
      if (from) {
        from.nextIds = [boss.id];
      }
    }
  }

  return nodes;
}

export function getAvailableNextNodes(nodes: MapNode[], currentNodeId: string | null): MapNode[] {
  if (!currentNodeId) {
    return nodes.filter((n) => n.layer === 0);
  }
  const current = nodes.find((n) => n.id === currentNodeId);
  if (!current) return [];
  return nodes.filter((n) => current.nextIds.includes(n.id));
}

export function getReachableNodeIds(nodes: MapNode[], fromNodeId: string | null): Set<string> {
  const reachable = new Set<string>();
  if (!fromNodeId) {
    for (const n of nodes) reachable.add(n.id);
    return reachable;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const queue: string[] = [fromNodeId];
  reachable.add(fromNodeId);

  let head = 0;
  while (head < queue.length) {
    const curId = queue[head++];
    const cur = byId.get(curId);
    if (!cur) continue;
    for (const nextId of cur.nextIds) {
      if (!reachable.has(nextId)) {
        reachable.add(nextId);
        queue.push(nextId);
      }
    }
  }
  return reachable;
}

export function getNodeEncounterIntel(node: MapNode, seed: number): NodeEncounterIntel {
  const laneSuffix =
    node.layer === 0
      ? 'GATE'
      : node.layer === 4
        ? 'CORE'
        : node.lane === 0
          ? 'N-CANOPY'
          : node.lane === 1
            ? 'C-SPINE'
            : 'S-CATWALK';
  const sectorCode = `S0${node.layer + 1}-${laneSuffix}`;

  if (node.type === 'CYBER_CLINIC' || node.type === 'MED_BAY') {
    return {
      sectorCode,
      enemies: [],
      totalEnemyHp: 0,
    };
  }

  const specs = buildEncounterSpec(node.type, node.layer, seed);
  const enemies = specs.map((spec) => {
    const tpl = ENEMY_TEMPLATES[spec.archetype];
    return {
      archetype: spec.archetype,
      hp: tpl.maxHp + spec.hpBonus,
      armor: tpl.startingArmor,
    };
  });
  const totalEnemyHp = enemies.reduce((acc, e) => acc + e.hp + e.armor, 0);

  return {
    sectorCode,
    enemies,
    totalEnemyHp,
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
  const hpRatio = run.heroine.hp / Math.max(1, run.heroine.maxHp);
  const openSockets = Math.max(0, MAX_IMPLANTS - run.heroine.implants.length);

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
      // Prioritize healing or safe path to Bio-Med Bay when wounded
      if (cand.type === 'MED_BAY') {
        score += 120;
        reason = 'low_hp_medbay';
      } else if (cand.type === 'CYBER_CLINIC') {
        score += 75 + (hasDownstreamMedBay ? 35 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'clinic_socket';
      } else if (cand.type === 'COMBAT') {
        score += 55 + (hasDownstreamMedBay ? 45 : 0);
        reason = hasDownstreamMedBay ? 'low_hp_medbay' : 'combat_momentum';
      } else if (cand.type === 'ELITE') {
        score -= 40;
      }
    } else {
      // Healthy HP: prioritize high-value Elite (Combat Score + Clinic Implant Draft) or filling Implant sockets
      if (cand.type === 'ELITE') {
        score += 110 + (openSockets > 0 ? 25 : 0);
        reason = 'elite_power_spike';
      } else if (cand.type === 'CYBER_CLINIC') {
        score += (openSockets > 0 ? 95 : 50) + (hasDownstreamElite ? 25 : 0);
        reason = openSockets > 0 ? 'clinic_socket' : 'elite_power_spike';
      } else if (cand.type === 'COMBAT') {
        score += 75 + (hasDownstreamElite ? 30 : 0) + (hasDownstreamClinic && openSockets > 0 ? 20 : 0);
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'MED_BAY') {
        score += 45;
      }
    }

    // Prefer central spine hub when tied for maximum downstream flexibility
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
