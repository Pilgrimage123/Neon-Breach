import type { Language } from '../i18n/translations';
import { getCyberEventForNode } from './cyberEvents';
import { ENEMY_TEMPLATES, MAX_IMPLANTS } from './data';
import { computeSmartScaledEnemyHp, getDifficultyProfile } from './difficulty';
import { buildEnemiesForNode } from './encounterBuilder';
import { getEquippedChipMemory } from './poolBuilder';
import type {
  DifficultyTier,
  EnemyArchetype,
  EnemyIntent,
  EnemyPassiveKind,
  HeroState,
  LaneClusterArchetype,
  LaneClusterProfile,
  MapNode,
  NodeEconomyMetrics,
  RunState,
} from './types';

export interface NodeEncounterIntel {
  sectorCode: string;
  enemies: Array<{ archetype: EnemyArchetype; hp: number; armor: number }>;
  totalEnemyHp: number;
  totalEnemyArmor: number;
  enemyPassives?: EnemyPassiveKind[];
  threatTraits?: string[];
}

export type ReconNodePreview =
  | { kind: 'event'; eventTitle: string; choices: string[] }
  | { kind: 'clinic'; isFlashSale: boolean; openSockets: number }
  | { kind: 'chip_dealer'; isFlashSale: boolean; freeMemory: number }
  | { kind: 'medbay'; healTotal: number; isFunded: boolean }
  | {
      kind: 'combat';
      enemies: Array<{
        archetype: EnemyArchetype;
        hp: number;
        armor: number;
        firstIntent: EnemyIntent;
      }>;
    };

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

export interface BossTelegraphGimmick {
  id: string;
  title: string;
  description: string;
  badge: string;
}

export interface BossTelegraphIntel {
  name: string;
  classification: string;
  hp: number;
  gimmicks: BossTelegraphGimmick[];
  recommendedPrep: string;
}

export const STAGE_BOSS_TELEGRAPH: BossTelegraphIntel = {
  name: 'Xenomorph Matriarch',
  classification: 'Apex Brood Sovereign · Stage 12 Finale',
  hp: ENEMY_TEMPLATES.boss.maxHp,
  gimmicks: [
    {
      id: 'phase_lock',
      title: '50% Phase Gate',
      description: 'Locks HP once at 50% to deploy +10 Armor & +1 Aegis Pip',
      badge: 'PHASE GATE',
    },
    {
      id: 'acid_jam',
      title: 'Corrosive Tile Jam & Slag',
      description: 'Unblocked acid jams a Tile and injects Caustic Slag',
      badge: 'TILE JAM',
    },
    {
      id: 'swarm_call',
      title: 'Bio-Husk Resurrection & Swarm',
      description: 'Reanimates fallen allies as Bio-Husks while summoning waves',
      badge: 'SWARM CALL',
    },
  ],
  recommendedPrep: 'Prep: TECH Pierce, Armor Shred & Aegis Shields',
};

export function getBossTelegraphIntel(
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): BossTelegraphIntel {
  const bossHp = computeSmartScaledEnemyHp(
    'boss',
    ENEMY_TEMPLATES.boss.maxHp,
    0,
    difficultyTier,
  );
  if (lang !== 'cs') {
    if (difficultyTier === 3) return STAGE_BOSS_TELEGRAPH;
    return {
      ...STAGE_BOSS_TELEGRAPH,
      hp: bossHp,
    };
  }
  return {
    name: 'Xenomorfní Matriarcha',
    classification: 'Vrcholná vládkyně roje · Finále úseku 12',
    hp: bossHp,
    gimmicks: [
      {
        id: 'phase_lock',
        title: '50% Fázová brána',
        description: 'Při poklesu pod 50 % uzamkne HP a přidá +10 Brnění a +1 Aegis Pip',
        badge: 'FÁZOVÁ BRÁNA',
      },
      {
        id: 'acid_jam',
        title: 'Korozivní blokace a struska',
        description: 'Kyselina při zásahu do HP zablokuje dílek a přidá Žíravou strusku',
        badge: 'BLOKACE',
      },
      {
        id: 'swarm_call',
        title: 'Bio-schránky a posily roje',
        description: 'Křísí padlé Mutantky z Bio-schránek a přivolává další vlny',
        badge: 'POSILY ROJE',
      },
    ],
    recommendedPrep: 'Příprava: TECH průraz, drcení brnění a silný Štít',
  };
}

export function getNodeEconomyMetrics(
  node: MapNode,
  hero?: HeroState,
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): NodeEconomyMetrics {
  const maxHp = hero?.maxHp ?? 58;
  const diff = getDifficultyProfile(difficultyTier);
  let tensionHpPct = 0;
  let runYieldCredits = 0;
  let runYieldPowerRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  let metaYieldNanites = 0;
  let opportunityCost = '';
  const isCs = lang === 'cs';

  const applyCreditModifiers = (baseCredits: number): number => {
    let val = baseCredits;
    if (node.modifier === 'golden_bounty') val = Math.round(val * 1.5);
    else if (node.modifier === 'double_credits') val *= 2;
    return Math.max(10, Math.round(val * diff.creditYieldMultiplier));
  };

  switch (node.type) {
    case 'COMBAT': {
      const isOvercharged = node.modifier === 'overcharged_hazard';
      tensionHpPct = isOvercharged ? 18 : 12;
      runYieldCredits = applyCreditModifiers(35);
      runYieldPowerRating = isOvercharged ? 'HIGH' : 'MODERATE';
      metaYieldNanites =
        (isOvercharged ? 1 : 0) + (node.modifier === 'nanite_cache' ? 2 : 0);
      opportunityCost = isOvercharged
        ? isCs
          ? 'Mini-elita: 💔 +18 % riziko · 💎 +1 Nanit'
          : 'Mini-Elite: 💔 +18% Tension · 💎 +1 Nanite'
        : isCs
          ? `🪙 +${runYieldCredits} CR · 💔 ~12 % riziko · šetří ošetřovnu`
          : `🪙 +${runYieldCredits} CR · 💔 ~12% Tension · preserves Med-Bay`;
      break;
    }
    case 'ELITE': {
      const isOvercharged = node.modifier === 'overcharged_hazard';
      tensionHpPct = isOvercharged ? 46 : 38;
      runYieldCredits = applyCreditModifiers(60);
      runYieldPowerRating = isOvercharged ? 'CRITICAL' : 'HIGH';
      metaYieldNanites =
        2 + (isOvercharged ? 1 : 0) + (node.modifier === 'nanite_cache' ? 2 : 0);
      opportunityCost = isCs
        ? `👑 Elita: 💎 +${metaYieldNanites} Nanity · 🪙 +${runYieldCredits} CR · AI čip`
        : `👑 Elite: 💎 +${metaYieldNanites} Nanites · 🪙 +${runYieldCredits} CR · AI Chip`;
      break;
    }
    case 'CYBER_CLINIC':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = 'HIGH';
      metaYieldNanites = 0;
      opportunityCost = isCs
        ? '🎛 Výběr implantátu · Čapí jesle · FabLab sloučení'
        : '🎛 Implant Draft · Stork Nursery · FabLab Splice';
      break;
    case 'CHIP_DEALER':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = node.modifier === 'flash_sale' ? 'CRITICAL' : 'HIGH';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'flash_sale'
          ? isCs
            ? '🏷 Výprodej (-35 % cen): AI čipy a Chůva-boti'
            : '🏷 Flash Sale (-35% price): AI Skill Chips & Bots'
          : isCs
            ? '🤖 AI čipy · Chůva-boti · Rodová kovárna'
            : '🤖 AI Skill Chips · Nanny-Bots · Heirloom Forge';
      break;
    case 'MED_BAY':
      tensionHpPct = -35;
      runYieldCredits = 0;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'funded_clinic'
          ? isCs
            ? '💚 Dotovaný krb: +12 HP bonus ke všem volbám'
            : '💚 Funded Hearth: 💚 +12 HP bonus on all'
          : isCs
            ? '💚 Oprava HP · Přetaktování dílků · Rodové bonusy'
            : '💚 Hull Repair · Tile Overclock · Family Buffs';
      break;
    case 'EVENT':
      tensionHpPct = 0;
      runYieldCredits = 20;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 1;
      opportunityCost = isCs
        ? '❓ Aliance rodů · Vzájemná pomoc · Rave tempo'
        : '❓ Gala Alliances · Mutual-Aid Co-op · Rave Tempo';
      break;
    case 'BOSS':
      tensionHpPct = 65;
      runYieldCredits = applyCreditModifiers(100);
      runYieldPowerRating = 'CRITICAL';
      metaYieldNanites = 5;
      opportunityCost = isCs
        ? `☠ Boss úseku: 💎 +5 Nanitů · 🪙 +${runYieldCredits} CR`
        : `☠ Stage Boss: 💎 +5 Nanites · 🪙 +${runYieldCredits} CR`;
      break;
  }

  const tensionHpEst = Math.round((Math.abs(tensionHpPct) / 100) * maxHp);

  return {
    tensionHpPct,
    tensionHpEst,
    runYieldCredits,
    runYieldPowerRating,
    metaYieldNanites,
    opportunityCost,
  };
}

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
        ? 'Přetížená hrozba (+25 % síla nepřátel, +1 Nanit)'
        : 'Overcharged Hazard (+25% Enemy Stats, Drops +1 Meta Nanite)',
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
      threatTraits.push(isCs ? 'Žíravá kyselina a Kletba dílku' : 'Corrosive Acid & Tile Hex');
    } else if (unit.archetype === 'stalker') {
      threatTraits.push(isCs ? 'Trnitá odplata (+4 bez Štítu)' : 'Spike Retaliation (+4 unshielded)');
    } else if (unit.archetype === 'brute') {
      threatTraits.push(
        isCs ? '14 Drtivý úder · 8 Brnění a 1 Aegis Pip' : '14 Heavy Smash · 8 Armor & 1 Aegis Pip',
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
      healTotal: 22 + (isFunded ? 12 : 0),
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
