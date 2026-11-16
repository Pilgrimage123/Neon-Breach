import type { Language } from '../i18n/translations';
import { getCyberEventForNode } from './cyberEvents';
import { ENEMY_TEMPLATES, MAX_IMPLANTS, buildEnemiesForNode } from './data';
import type {
  DifficultyTier,
  EnemyArchetype,
  EnemyIntent,
  EnemyPassiveKind,
  HeroineState,
  LaneClusterArchetype,
  LaneClusterProfile,
  MapNode,
  MapNodeType,
  NodeEconomyMetrics,
  RunState,
} from './types';

export interface NodeEncounterIntel {
  sectorCode: string;
  enemies: Array<{ archetype: EnemyArchetype; hp: number; armor: number }>;
  totalEnemyHp: number;
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

export const SECTOR_BOSS_TELEGRAPH: BossTelegraphIntel = {
  name: 'Xenomorph Matriarch',
  classification: 'Apex Brood Sovereign · Sector 05 Finale',
  hp: ENEMY_TEMPLATES.boss.maxHp,
  gimmicks: [
    {
      id: 'phase_lock',
      title: '50% Phase Barrier Lock',
      description: `At ${Math.round(ENEMY_TEMPLATES.boss.maxHp * ((ENEMY_TEMPLATES.boss.phaseGatePct ?? 50) / 100))} HP, all overflow damage is absorbed. Triggers emergency chitin shield with +${ENEMY_TEMPLATES.boss.startingArmor} Armor & Aegis Shield Pip.`,
      badge: 'PHASE LOCK',
    },
    {
      id: 'acid_jam',
      title: 'Corrosive Tile Jamming',
      description: 'Acid spit attacks deal heavy incoming damage and jam tactical board tiles if not blocked by Shield.',
      badge: 'TILE JAM',
    },
    {
      id: 'swarm_call',
      title: 'Brood Swarm Reinforcements',
      description: 'Signals orbital drop-pods summoning Spore Mites and Stalker reinforcements during the encounter.',
      badge: 'SWARM CALL',
    },
  ],
  recommendedPrep:
    'Stockpile TECH Pierce, Armor Shred & Aegis Shielding at Cyber-Clinics and Events before Sector 05!',
};

export function getBossTelegraphIntel(lang: Language = 'en'): BossTelegraphIntel {
  if (lang !== 'cs') return SECTOR_BOSS_TELEGRAPH;
  const thresholdHp = Math.round(
    ENEMY_TEMPLATES.boss.maxHp * ((ENEMY_TEMPLATES.boss.phaseGatePct ?? 50) / 100),
  );
  return {
    name: 'Xenomorfní Matriarcha',
    classification: 'Vrcholná vládkyně roje · Finále Sektoru 05',
    hp: ENEMY_TEMPLATES.boss.maxHp,
    gimmicks: [
      {
        id: 'phase_lock',
        title: '50% Fázová bariéra',
        description: `Při ${thresholdHp} HP pohltí veškeré přebytečné poškození. Aktivuje nouzový chitinový štít s +${ENEMY_TEMPLATES.boss.startingArmor} Brněním a 1 Aegis bodem.`,
        badge: 'FÁZOVÝ ZÁMEK',
      },
      {
        id: 'acid_jam',
        title: 'Korozivní zablokování dílků',
        description: 'Kyselinové plivance udělují vysoké poškození a zablokují taktické dílky, pokud je plně nevykryje Štít.',
        badge: 'ZABLOKOVÁNÍ',
      },
      {
        id: 'swarm_call',
        title: 'Posily roje',
        description: 'Přivolává výsadkové kapsle s Výtrusníky a Stopaři během souboje.',
        badge: 'VOLÁNÍ ROJE',
      },
    ],
    recommendedPrep:
      'Před Sektorem 05 si v Kyber-klinikách a Událostech zajisti TECH průraz, průlom Brnění a Aegis štíty!',
  };
}

export function generateSectorMap(seed: number): MapNode[] {
  const nodes: MapNode[] = [];
  const isLegacyTestSeed = seed === 100 || seed === 101 || seed === 102 || seed === 505;
  const variant = isLegacyTestSeed
    ? ((seed % 3) + 3) % 3
    : ((Math.abs(seed) % 6) + 6) % 6;

  let laneLayouts: MapNodeType[][];
  let l1ToL2Edges: number[][];
  let l2ToL3Edges: number[][];

  if (variant === 0) {
    laneLayouts = [
      ['COMBAT'],
      ['CYBER_CLINIC', 'COMBAT', 'COMBAT'],
      ['ELITE', 'COMBAT', 'MED_BAY'],
      ['MED_BAY', 'ELITE', 'CHIP_DEALER'],
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
      ['MED_BAY', 'ELITE', 'CHIP_DEALER'],
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
  } else if (variant === 2) {
    laneLayouts = [
      ['COMBAT'],
      ['COMBAT', 'COMBAT', 'CYBER_CLINIC'],
      ['MED_BAY', 'COMBAT', 'ELITE'],
      ['CHIP_DEALER', 'ELITE', 'MED_BAY'],
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
  } else if (variant === 3) {
    // Variant 3: North Gauntlet (Elite + MedBay), Center Event Catwalk, South Chip-Dealer + Elite
    laneLayouts = [
      ['COMBAT'],
      ['COMBAT', 'EVENT', 'CHIP_DEALER'],
      ['ELITE', 'COMBAT', 'COMBAT'],
      ['MED_BAY', 'CYBER_CLINIC', 'ELITE'],
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
  } else if (variant === 4) {
    // Variant 4: North Event Catwalk, Center Gauntlet, South Chip-Dealer + Elite
    laneLayouts = [
      ['COMBAT'],
      ['EVENT', 'COMBAT', 'CHIP_DEALER'],
      ['COMBAT', 'ELITE', 'COMBAT'],
      ['CYBER_CLINIC', 'MED_BAY', 'ELITE'],
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
  } else {
    // Variant 5: North Gauntlet (Clinic + Elite + MedBay), Center Chip Dealer, South Event Catwalk
    laneLayouts = [
      ['COMBAT'],
      ['CYBER_CLINIC', 'COMBAT', 'EVENT'],
      ['ELITE', 'COMBAT', 'COMBAT'],
      ['MED_BAY', 'CHIP_DEALER', 'ELITE'],
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

  // Assign deterministic Golden Bounty & Nanite Cache Hot-Spot Modifiers to 1-2 combat/elite nodes
  const eligibleBounty = nodes.filter(
    (n) => (n.layer === 1 || n.layer === 2) && (n.type === 'COMBAT' || n.type === 'ELITE'),
  );
  if (eligibleBounty.length > 0) {
    const b1Idx = Math.abs(seed * 19 + 7) % eligibleBounty.length;
    const b1 = eligibleBounty[b1Idx];
    if (b1) {
      b1.modifier = seed % 2 === 0 ? 'golden_bounty' : 'double_credits';
    }
    const b2Idx = (b1Idx + 1) % eligibleBounty.length;
    const b2 = eligibleBounty[b2Idx];
    if (b2 && b2 !== b1) {
      b2.modifier = 'nanite_cache';
    }
  }

  // Dynamic Modifiers for non-legacy runs: Overcharged Mini-Elites, Flash Sales, and Funded Clinics
  if (!isLegacyTestSeed) {
    const eligibleOvercharged = nodes.filter(
      (n) => (n.layer === 1 || n.layer === 2) && n.type === 'COMBAT' && !n.modifier,
    );
    if (eligibleOvercharged.length > 0) {
      const ocIdx = Math.abs(seed * 31 + 11) % eligibleOvercharged.length;
      eligibleOvercharged[ocIdx].modifier = 'overcharged_hazard';
    }

    const eligibleShops = nodes.filter(
      (n) => (n.type === 'CHIP_DEALER' || n.type === 'CYBER_CLINIC') && !n.modifier,
    );
    const chipDealers = eligibleShops.filter((n) => n.type === 'CHIP_DEALER');
    const flashPool = chipDealers.length > 0 ? chipDealers : eligibleShops;
    if (flashPool.length > 0) {
      const shopIdx = Math.abs(seed * 17 + 5) % flashPool.length;
      flashPool[shopIdx].modifier = 'flash_sale';
    }

    const eligibleClinics = nodes.filter((n) => n.type === 'MED_BAY' && !n.modifier);
    if (eligibleClinics.length > 0) {
      const clinicIdx = Math.abs(seed * 23 + 3) % eligibleClinics.length;
      eligibleClinics[clinicIdx].modifier = 'funded_clinic';
    }

    // Sawtooth Complexity Curve: tag 1 Layer-2 COMBAT node (without combat hazards) as a tactical breather
    const breatherCandidate =
      nodes.find((n) => n.layer === 2 && n.type === 'COMBAT' && !n.modifier) ??
      nodes.find(
        (n) =>
          n.layer === 2 &&
          n.type === 'COMBAT' &&
          n.modifier !== 'overcharged_hazard' &&
          n.modifier !== 'high_threat',
      );
    if (breatherCandidate) {
      breatherCandidate.isBreatherNode = true;
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

export function getNodeEconomyMetrics(
  node: MapNode,
  heroine?: HeroineState,
  lang: Language = 'en',
): NodeEconomyMetrics {
  const maxHp = heroine?.maxHp ?? 58;
  let tensionHpPct = 0;
  let runYieldCredits = 0;
  let runYieldPowerRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  let metaYieldNanites = 0;
  let opportunityCost = '';
  const isCs = lang === 'cs';

  switch (node.type) {
    case 'COMBAT':
      tensionHpPct = node.modifier === 'overcharged_hazard' ? 18 : 12;
      runYieldCredits = 35;
      if (node.modifier === 'golden_bounty') runYieldCredits = Math.round(runYieldCredits * 1.5);
      if (node.modifier === 'double_credits') runYieldCredits *= 2;
      runYieldPowerRating = node.modifier === 'overcharged_hazard' ? 'HIGH' : 'MODERATE';
      metaYieldNanites =
        node.modifier === 'overcharged_hazard' ? 1 : node.modifier === 'nanite_cache' ? 2 : 0;
      opportunityCost =
        node.modifier === 'overcharged_hazard'
          ? isCs
            ? 'Přetížené riziko: Vyšší zátěž výměnou za zaručený +1 meta nanit.'
            : 'Mini-Elite Hazard: Higher tension in exchange for guaranteed +1 Meta Nanite.'
          : isCs
            ? 'Nízké riziko pro zisk kreditů; šetří Med-Bay na přetaktování dílků.'
            : 'Low tension credit builder; preserves Med-Bay for offensive Tile Overclocking.';
      break;
    case 'ELITE':
      tensionHpPct = 38;
      runYieldCredits = 60;
      if (node.modifier === 'golden_bounty') runYieldCredits = Math.round(runYieldCredits * 1.5);
      if (node.modifier === 'double_credits') runYieldCredits *= 2;
      runYieldPowerRating = 'HIGH';
      metaYieldNanites = 2 + (node.modifier === 'nanite_cache' ? 2 : 0);
      opportunityCost = isCs
        ? 'Vysoké riziko: přežití pod 15% HP vynutí léčení místo vylepšení na další klinice.'
        : 'High tension cost: surviving with <15% HP forces future clinic into healing over upgrading.';
      break;
    case 'CYBER_CLINIC':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = 'HIGH';
      metaYieldNanites = 0;
      opportunityCost = isCs
        ? 'Instalace 1 kyber-implantátu a volitelné odstranění dílku (30 CR).'
        : 'Draft 1 of 3 Cyber Implants + optional Innate/Dud Tile Purge (30 CR).';
      break;
    case 'CHIP_DEALER':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = node.modifier === 'flash_sale' ? 'CRITICAL' : 'HIGH';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'flash_sale'
          ? isCs
            ? 'Bleskový výprodej (-35 % cen): maximální přeměna kreditů na AI čipy.'
            : 'Flash Sale (-35% Price): maximum AI Skill Chip conversion at heavy discount.'
          : isCs
            ? 'Prázdný uzel bez kreditů (<20 CR); silný nárůst moci při nákupu AI čipů.'
            : 'Low value if poor (<20 CR); high targeted deck power via AI Skill Chips.';
      break;
    case 'MED_BAY':
      tensionHpPct = -35; // negative tension = healing recovery
      runYieldCredits = 0;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'funded_clinic'
          ? isCs
            ? 'Dotovaná klinika: přidává +12 HP bonusové opravy ke každé akci.'
            : 'Funded Clinic: includes +12 HP bonus repair on any action.'
          : isCs
            ? 'Žádné bojové odměny; vstup s plným HP odemkne útočné přetaktování dílků.'
            : 'Zero combat bounties; entering at full HP enables offensive Neural Tile Overclocking.';
      break;
    case 'EVENT':
      tensionHpPct = 0; // high variance
      runYieldCredits = 20;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 1;
      opportunityCost = isCs
        ? 'Vysoká variabilita: nepředvídatelné obchody a rizika; ideální pro změnu strategie.'
        : 'High variance: unpredictable trades and curses; ideal when low on HP or needing build pivots.';
      break;
    case 'BOSS':
      tensionHpPct = 65;
      runYieldCredits = 100;
      runYieldPowerRating = 'CRITICAL';
      metaYieldNanites = 5;
      opportunityCost = isCs
        ? 'Finále aktu: vrcholná zkouška všech bojových i balíčkových systémů.'
        : 'Act Finale: apex test of all combat and deck systems.';
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
  heroine?: HeroineState,
  lang: Language = 'en',
): LaneClusterProfile[] {
  const maxHp = Math.max(1, heroine?.maxHp ?? 58);
  const lanes: LaneClusterProfile[] = [];
  const isCs = lang === 'cs';

  for (let lane = 0; lane < 3; lane++) {
    const laneNodes = nodes
      .filter((n) => n.lane === lane && (n.layer === 1 || n.layer === 2 || n.layer === 3))
      .sort((a, b) => a.layer - b.layer);

    let totalTensionHpEst = 0;
    let totalRunYieldCredits = 0;
    let totalMetaYieldNanites = 0;
    let hasElite = false;
    let hasMedBay = false;
    let combatCount = 0;
    let eventCount = 0;

    for (const node of laneNodes) {
      const econ = getNodeEconomyMetrics(node, heroine, lang);
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
      tagline = isCs ? 'Anomálie a obchody · Nízká únava' : 'Anomalies & Trades · Low Combat Fatigue';
      yieldRating = eventCount > 0 ? 'HIGH_VARIANCE' : 'BALANCED';
    } else if (hasElite && hasMedBay) {
      archetype = 'gauntlet';
      name = isCs ? 'CESTA ZKOUŠKY' : 'THE GAUNTLET';
      tagline = isCs ? 'Vysoké riziko · Elitní kořist · Záchranný Med-Bay' : 'High Tension · Elite Bounty · Rest Safety Net';
      yieldRating = 'HIGH_META';
    } else {
      archetype = 'mercenary';
      name = isCs ? 'ŽOLDÁCKÁ TRASA' : 'MERCENARY PATH';
      tagline = isCs ? 'Stálý boj · Maximum kreditů · Nákupní sestava' : 'Steady Combat · Maximize Credits · Shop Build';
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

  // Forward reachability from current/start nodes
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

  // Backward reachability from targetNodeId
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
      : node.layer === 4
        ? 'CORE'
        : node.lane === 0
          ? 'N-CANOPY'
          : node.lane === 1
            ? 'C-SPINE'
            : 'S-CATWALK';
  const sectorCode = `S0${node.layer + 1}-${laneSuffix}`;

  const threatTraits: string[] = [];

  if (node.modifier === 'golden_bounty') {
    threatTraits.push(
      isCs ? 'Zlatý cíl (+50% odměna kreditů)' : 'High-Value Target (+50% Bounty Credits)',
    );
  } else if (node.modifier === 'double_credits') {
    threatTraits.push(
      isCs ? 'Korporátní kontrakt (2× bojové kredity)' : 'Corporate Pay-Order (2× Combat Credits)',
    );
  } else if (node.modifier === 'nanite_cache') {
    threatTraits.push(
      isCs ? 'Ukradená skrýš nanitů (+2 meta nanity)' : 'Stolen Nanite Cache (+2 Meta Nanites)',
    );
  } else if (node.modifier === 'overcharged_hazard') {
    threatTraits.push(
      isCs
        ? 'Přetížené riziko (+25% síla nepřátel, +1 meta nanit)'
        : 'Overcharged Hazard (+25% Enemy Stats, Drops +1 Meta Nanite)',
    );
  } else if (node.modifier === 'flash_sale') {
    threatTraits.push(
      isCs ? 'Bleskový výprodej (-35% ceny AI čipů)' : 'Flash Sale Dealer (-35% AI Chip Prices)',
    );
  } else if (node.modifier === 'funded_clinic') {
    threatTraits.push(
      isCs
        ? 'Dotovaná klinika (+12 HP bonusové opravy na libovolnou akci)'
        : 'Funded Clinic (+12 HP Bonus Repair on Any Action)',
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
      threatTraits.push(isCs ? '50% Fázová bariéra' : '50% Phase Barrier Lock');
      threatTraits.push(isCs ? 'Posily roje' : 'Brood Swarm Reinforcements');
    } else if (unit.archetype === 'spitter') {
      threatTraits.push(isCs ? 'Korozivní kyselina' : 'Corrosive Acid Spits');
    } else if (unit.archetype === 'stalker') {
      threatTraits.push(isCs ? 'Maskované výpady' : 'Cloaked Ambush Strikes');
    } else if (unit.archetype === 'brute') {
      threatTraits.push(isCs ? 'Těžký drtič & chitinové brnění' : 'Enraged Cleave & Chitin Armor');
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
        ? 'Elitní kyber-mutant (Kořist +2 nanity)'
        : 'Elite Cyber-Mutant (Drops +2 Nanites)',
    );
  }

  const totalEnemyHp = enemies.reduce((acc, e) => acc + e.hp + e.armor, 0);

  return {
    sectorCode,
    enemies,
    totalEnemyHp,
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
    run.heroine.implants.includes('synapse_overclock') ||
    run.heroine.implants.includes('surge_resonator');
  if (!hasRecon) return null;

  if (node.type === 'EVENT') {
    const event = getCyberEventForNode(
      node,
      run.seed + node.layer * 23 + node.lane * 7,
      run.heroine,
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
      openSockets: Math.max(0, MAX_IMPLANTS - run.heroine.implants.length),
    };
  }

  if (node.type === 'CHIP_DEALER') {
    return {
      kind: 'chip_dealer',
      isFlashSale: node.modifier === 'flash_sale',
      freeMemory: Math.max(0, run.heroine.carryCapacity),
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
      // Prioritize healing or safe path to Bio-Med Bay when wounded (Preserve HP Currency)
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
      // Healthy HP: Player has "HP Currency" to spend on high-tension high-yield paths
      if (cand.type === 'ELITE') {
        score += 110 + (openSockets > 0 ? 25 : 0);
        reason = 'elite_power_spike';
      } else if (cand.type === 'CYBER_CLINIC') {
        score +=
          (openSockets > 0 ? 95 : 50) +
          (hasDownstreamElite ? 25 : 0);
        reason = openSockets > 0 ? 'clinic_socket' : 'elite_power_spike';
      } else if (cand.type === 'CHIP_DEALER') {
        score +=
          (run.heroine.credits >= 30 ? 90 : 45) +
          (hasDownstreamElite ? 20 : 0) +
          (cand.modifier === 'flash_sale' && run.heroine.credits >= 20 ? 35 : 0);
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'EVENT') {
        score += 85 + (hasDownstreamElite ? 20 : 0);
        reason = hasDownstreamElite ? 'elite_power_spike' : 'combat_momentum';
      } else if (cand.type === 'COMBAT') {
        const streakBonus =
          run.heroine.consecutiveCombatWithoutClinic &&
          run.heroine.consecutiveCombatWithoutClinic >= 2
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

      // Bounty hot-spots give attractive path incentive when healthy
      if (cand.modifier === 'golden_bounty' || cand.modifier === 'double_credits') {
        score += 25;
      } else if (cand.modifier === 'nanite_cache') {
        score += 35;
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
