import type { Language } from '../i18n/translations';
import { getNodeEconomyMetrics } from './mapBossAndEconomy';
import type {
  DifficultyTier,
  HeroState,
  LaneClusterArchetype,
  LaneClusterProfile,
  MapNode,
} from './types';

export function getLaneClusterProfiles(
  nodes: MapNode[],
  hero?: HeroState,
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): LaneClusterProfile[] {
  const maxHp = Math.max(1, hero?.maxHp ?? 58);
  const lanes: LaneClusterProfile[] = [];
  const isCs = lang === 'cs';
  const maxLayer = nodes.reduce((acc, n) => Math.max(acc, n.layer), 4);

  for (let lane = 0; lane < 3; lane++) {
    const laneNodes = nodes
      .filter((n) => n.lane === lane && n.layer >= 1 && n.layer < maxLayer)
      .sort((a, b) => a.layer - b.layer);

    let totalTensionHpEst = 0;
    let totalRunYieldCredits = 0;
    let totalMetaYieldNanites = 0;
    let hasElite = false;
    let hasMedBay = false;
    let combatCount = 0;
    let eventCount = 0;

    for (const node of laneNodes) {
      const econ = getNodeEconomyMetrics(node, hero, lang, difficultyTier);
      if (econ.tensionHpPct > 0) {
        totalTensionHpEst += econ.tensionHpEst;
      }
      totalRunYieldCredits += econ.runYieldCredits;
      totalMetaYieldNanites += econ.metaYieldNanites;
      if (node.type === 'ELITE') hasElite = true;
      if (node.type === 'MED_BAY') hasMedBay = true;
      if (node.type === 'COMBAT') combatCount++;
      if (node.type === 'EVENT') eventCount++;
    }

    const tensionRatio = totalTensionHpEst / maxHp;
    const tensionRating: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' =
      tensionRatio >= 0.6
        ? 'EXTREME'
        : tensionRatio >= 0.35
          ? 'HIGH'
          : tensionRatio >= 0.18
            ? 'MODERATE'
            : 'LOW';

    let archetype: LaneClusterArchetype;
    let name: string;
    let tagline: string;
    let yieldRating: 'BALANCED' | 'HIGH_WEALTH' | 'HIGH_META' | 'HIGH_VARIANCE';

    if (eventCount > 0 || (!hasElite && combatCount <= 1 && hasMedBay)) {
      archetype = 'gambler';
      name = isCs ? 'LÁVKA HAZARDÉRA' : "GAMBLER'S CATWALK";
      tagline = isCs ? 'Anomálie a aliance · Šetrnější tempo boje' : 'Anomalies & Alliances · Low Combat Fatigue';
      yieldRating = eventCount > 0 ? 'HIGH_VARIANCE' : 'BALANCED';
    } else if (hasElite && hasMedBay) {
      archetype = 'gauntlet';
      name = isCs ? 'CESTA ZKOUŠKY' : 'THE GAUNTLET';
      tagline = isCs ? 'Vysoké riziko · Elitní kořist · Záchranná ošetřovna' : 'High Tension · Elite Bounty · Rest Safety Net';
      yieldRating = 'HIGH_META';
    } else {
      archetype = 'mercenary';
      name = isCs ? 'ŽOLDNÉŘSKÁ TRASA' : 'MERCENARY PATH';
      tagline = isCs ? 'Stálý boj · Maximum kreditů · Nákup AI čipů' : 'Steady Combat · Maximize Credits · AI Chip Build';
      yieldRating = 'HIGH_WEALTH';
    }

    lanes.push({
      lane,
      archetype,
      name,
      tagline,
      tensionRating,
      yieldRating,
      totalTensionHpEst,
      totalRunYieldCredits,
      totalMetaYieldNanites,
    });
  }

  return lanes;
}

export function getConnectingPathNodeIds(
  nodes: MapNode[],
  fromNodeId: string | null,
  targetNodeId: string,
): Set<string> {
  const result = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const target = byId.get(targetNodeId);
  if (!target) return result;

  const startNodeIds = fromNodeId
    ? [fromNodeId]
    : nodes.filter((n) => n.layer === 0).map((n) => n.id);

  if (startNodeIds.includes(targetNodeId)) {
    result.add(targetNodeId);
    return result;
  }

  const forwardReachable = new Set<string>();
  const fQueue = [...startNodeIds];
  startNodeIds.forEach((id) => forwardReachable.add(id));
  while (fQueue.length > 0) {
    const curId = fQueue.shift();
    if (!curId) continue;
    const cur = byId.get(curId);
    if (!cur) continue;
    for (const nextId of cur.nextIds) {
      if (!forwardReachable.has(nextId)) {
        forwardReachable.add(nextId);
        fQueue.push(nextId);
      }
    }
  }

  if (!forwardReachable.has(targetNodeId)) {
    return result;
  }

  const reverseAdj = new Map<string, string[]>();
  for (const n of nodes) {
    for (const nextId of n.nextIds) {
      const list = reverseAdj.get(nextId) ?? [];
      list.push(n.id);
      reverseAdj.set(nextId, list);
    }
  }

  const backwardReachable = new Set<string>();
  const bQueue = [targetNodeId];
  backwardReachable.add(targetNodeId);
  while (bQueue.length > 0) {
    const curId = bQueue.shift();
    if (!curId) continue;
    const prevList = reverseAdj.get(curId) ?? [];
    for (const prevId of prevList) {
      if (forwardReachable.has(prevId) && !backwardReachable.has(prevId)) {
        backwardReachable.add(prevId);
        bQueue.push(prevId);
      }
    }
  }

  for (const id of forwardReachable) {
    if (backwardReachable.has(id)) {
      result.add(id);
    }
  }

  return result;
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
