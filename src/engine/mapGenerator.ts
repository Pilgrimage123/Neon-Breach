import type { Language } from '../i18n/translations';
import type { DifficultyTier, MapNode, MapNodeType } from './types';

export interface SectorMapOptions {
  difficultyTier?: DifficultyTier;
  mapLength?: 'compact' | 'metropolis';
  variantCount?: 3 | 6;
  dynamicModifiers?: boolean;
}

export interface MetropolisDistrictInfo {
  index: number;
  code: string;
  title: string;
  subtitle: string;
  startLayer: number;
  endLayer: number;
  accentColor: string;
}

export function getMetropolisDistricts(
  totalLayers: number,
  lang: Language = 'en',
): MetropolisDistrictInfo[] {
  const isCs = lang === 'cs';
  if (totalLayers < 12) {
    return [
      {
        index: 0,
        code: 'D-01',
        title: isCs ? 'Sluneční předmostí Úsvitu' : 'New Dawn Sky-Bridge',
        subtitle: isCs ? `Úseky 01–0${Math.max(1, totalLayers)}` : `Stages 01–0${Math.max(1, totalLayers)}`,
        startLayer: 0,
        endLayer: Math.max(0, totalLayers - 1),
        accentColor: '#F59E0B',
      },
    ];
  }
  return [
    {
      index: 0,
      code: 'DIST-I',
      title: isCs ? 'I. Sluneční dílny a trh' : 'I. Sunlit Workshops & Market',
      subtitle: isCs
        ? 'Modulární reaktor · Cechy · Pekárny'
        : 'Modular Nuclear Core · Craft Guilds · Bakeries',
      startLayer: 0,
      endLayer: 2,
      accentColor: '#F59E0B',
    },
    {
      index: 1,
      code: 'DIST-II',
      title: isCs ? 'II. Skleníkové sady a akademie' : 'II. Greenhouse Commons & Academy',
      subtitle: isCs
        ? 'Obnovná klinika · Cechovní učení · Rodový erb'
        : 'Restorative Clinic · Guild Craft · Heraldry',
      startLayer: 3,
      endLayer: 5,
      accentColor: '#34D399',
    },
    {
      index: 2,
      code: 'DIST-III',
      title: isCs ? 'III. Chromové nebeské zahrady' : 'III. Chrome Sky-Gardens & Domes',
      subtitle: isCs
        ? 'Den manželky · Jaderný den · Rodová kovárna'
        : 'Happy Wife Day · Nuclear Day · Heirloom Forge',
      startLayer: 6,
      endLayer: 8,
      accentColor: '#FFC700',
    },
    {
      index: 3,
      code: 'DIST-IV',
      title: isCs ? 'IV. Zarostlá citadela Dr. Lindqvista' : 'IV. Dr. Lindqvist’s Overgrown Citadel',
      subtitle: isCs
        ? 'Rodinný krb · Hraniční stráž · Lindqvistova Matriarcha'
        : 'Family Hearth · Border Watch · Lindqvist’s Matriarch',
      startLayer: 9,
      endLayer: totalLayers - 1,
      accentColor: '#22C55E',
    },
  ];
}

function assignDistrictBadges(nodes: MapNode[], seed: number): void {
  const clinicBadges = [
    'stork_nursery',
    'pedigree_lab',
    'charter_academy',
    'open_fablab',
    'upcycle_kiosk',
  ] as const;
  const dealerBadges = ['nanny_showroom', 'beta_arcade', 'heirloom_forge'] as const;
  const medBadges = ['smart_hearth', 'rooftop_cafe', 'suburban_dome'] as const;
  const eventBadges = [
    'matchmakers_gala',
    'mutual_aid_coop',
    'synth_rave',
    'mesh_relay',
    'ar_graffiti_wall',
  ] as const;
  const eliteBadges = ['vanguard_escort', 'data_liberation'] as const;

  let clinicIdx = Math.abs(seed) % clinicBadges.length;
  let dealerIdx = Math.abs(seed * 3) % dealerBadges.length;
  let medIdx = Math.abs(seed * 5) % medBadges.length;
  let eventIdx = Math.abs(seed * 7) % eventBadges.length;
  let eliteIdx = Math.abs(seed * 11) % eliteBadges.length;

  for (const node of nodes) {
    if (node.type === 'CYBER_CLINIC') {
      node.districtBadge = clinicBadges[clinicIdx % clinicBadges.length];
      clinicIdx++;
    } else if (node.type === 'CHIP_DEALER') {
      node.districtBadge = dealerBadges[dealerIdx % dealerBadges.length];
      dealerIdx++;
    } else if (node.type === 'MED_BAY') {
      node.districtBadge = medBadges[medIdx % medBadges.length];
      medIdx++;
    } else if (node.type === 'EVENT') {
      node.districtBadge = eventBadges[eventIdx % eventBadges.length];
      eventIdx++;
    } else if (node.type === 'ELITE') {
      node.districtBadge = eliteBadges[eliteIdx % eliteBadges.length];
      eliteIdx++;
    } else if (
      node.type === 'COMBAT' &&
      (node.layer === 4 || node.layer === 6 || node.layer === 8)
    ) {
      node.districtBadge = 'maglev_hub';
    }
  }
}

const METROPOLIS_VARIANTS: readonly MapNodeType[][][] = [
  [
    ['COMBAT'],
    ['CYBER_CLINIC', 'COMBAT', 'EVENT'],
    ['ELITE', 'COMBAT', 'MED_BAY'],
    ['CHIP_DEALER', 'EVENT', 'CYBER_CLINIC'],
    ['COMBAT', 'ELITE', 'CHIP_DEALER'],
    ['MED_BAY', 'CYBER_CLINIC', 'EVENT'],
    ['ELITE', 'COMBAT', 'CHIP_DEALER'],
    ['EVENT', 'MED_BAY', 'CYBER_CLINIC'],
    ['CHIP_DEALER', 'ELITE', 'COMBAT'],
    ['CYBER_CLINIC', 'EVENT', 'ELITE'],
    ['MED_BAY', 'CHIP_DEALER', 'CYBER_CLINIC'],
    ['BOSS'],
  ],
  [
    ['COMBAT'],
    ['COMBAT', 'CYBER_CLINIC', 'CHIP_DEALER'],
    ['ELITE', 'COMBAT', 'EVENT'],
    ['MED_BAY', 'CHIP_DEALER', 'CYBER_CLINIC'],
    ['ELITE', 'COMBAT', 'EVENT'],
    ['CYBER_CLINIC', 'MED_BAY', 'CHIP_DEALER'],
    ['COMBAT', 'ELITE', 'EVENT'],
    ['CHIP_DEALER', 'CYBER_CLINIC', 'MED_BAY'],
    ['ELITE', 'COMBAT', 'CYBER_CLINIC'],
    ['EVENT', 'ELITE', 'CHIP_DEALER'],
    ['CYBER_CLINIC', 'MED_BAY', 'ELITE'],
    ['BOSS'],
  ],
  [
    ['COMBAT'],
    ['EVENT', 'COMBAT', 'CYBER_CLINIC'],
    ['MED_BAY', 'COMBAT', 'ELITE'],
    ['CYBER_CLINIC', 'CHIP_DEALER', 'EVENT'],
    ['CHIP_DEALER', 'ELITE', 'COMBAT'],
    ['EVENT', 'CYBER_CLINIC', 'MED_BAY'],
    ['ELITE', 'COMBAT', 'CYBER_CLINIC'],
    ['MED_BAY', 'EVENT', 'CHIP_DEALER'],
    ['COMBAT', 'ELITE', 'CYBER_CLINIC'],
    ['CHIP_DEALER', 'ELITE', 'EVENT'],
    ['ELITE', 'CYBER_CLINIC', 'MED_BAY'],
    ['BOSS'],
  ],
  [
    ['COMBAT'],
    ['COMBAT', 'EVENT', 'CHIP_DEALER'],
    ['ELITE', 'COMBAT', 'CYBER_CLINIC'],
    ['MED_BAY', 'EVENT', 'CHIP_DEALER'],
    ['CYBER_CLINIC', 'ELITE', 'COMBAT'],
    ['CHIP_DEALER', 'MED_BAY', 'EVENT'],
    ['ELITE', 'CYBER_CLINIC', 'COMBAT'],
    ['EVENT', 'CHIP_DEALER', 'MED_BAY'],
    ['CYBER_CLINIC', 'ELITE', 'COMBAT'],
    ['ELITE', 'EVENT', 'CYBER_CLINIC'],
    ['MED_BAY', 'CHIP_DEALER', 'ELITE'],
    ['BOSS'],
  ],
  [
    ['COMBAT'],
    ['EVENT', 'COMBAT', 'CHIP_DEALER'],
    ['COMBAT', 'ELITE', 'CYBER_CLINIC'],
    ['CHIP_DEALER', 'MED_BAY', 'EVENT'],
    ['ELITE', 'CYBER_CLINIC', 'COMBAT'],
    ['MED_BAY', 'EVENT', 'CHIP_DEALER'],
    ['CYBER_CLINIC', 'ELITE', 'COMBAT'],
    ['CHIP_DEALER', 'MED_BAY', 'EVENT'],
    ['ELITE', 'COMBAT', 'CYBER_CLINIC'],
    ['EVENT', 'ELITE', 'CHIP_DEALER'],
    ['CYBER_CLINIC', 'MED_BAY', 'ELITE'],
    ['BOSS'],
  ],
  [
    ['COMBAT'],
    ['CYBER_CLINIC', 'COMBAT', 'EVENT'],
    ['ELITE', 'COMBAT', 'CHIP_DEALER'],
    ['EVENT', 'CYBER_CLINIC', 'MED_BAY'],
    ['COMBAT', 'ELITE', 'CHIP_DEALER'],
    ['MED_BAY', 'EVENT', 'CYBER_CLINIC'],
    ['ELITE', 'CHIP_DEALER', 'COMBAT'],
    ['CYBER_CLINIC', 'MED_BAY', 'EVENT'],
    ['COMBAT', 'ELITE', 'CHIP_DEALER'],
    ['ELITE', 'CYBER_CLINIC', 'EVENT'],
    ['MED_BAY', 'CHIP_DEALER', 'ELITE'],
    ['BOSS'],
  ],
];

const COMPACT_VARIANTS: readonly { layouts: MapNodeType[][]; l1Edges: number[][] }[] = [
  {
    layouts: [
      ['COMBAT'],
      ['CYBER_CLINIC', 'COMBAT', 'COMBAT'],
      ['ELITE', 'COMBAT', 'MED_BAY'],
      ['MED_BAY', 'ELITE', 'CHIP_DEALER'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ],
  },
  {
    layouts: [
      ['COMBAT'],
      ['COMBAT', 'CYBER_CLINIC', 'COMBAT'],
      ['ELITE', 'COMBAT', 'MED_BAY'],
      ['MED_BAY', 'ELITE', 'CHIP_DEALER'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1],
      [1, 2],
    ],
  },
  {
    layouts: [
      ['COMBAT'],
      ['COMBAT', 'COMBAT', 'CYBER_CLINIC'],
      ['MED_BAY', 'COMBAT', 'ELITE'],
      ['CHIP_DEALER', 'ELITE', 'MED_BAY'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ],
  },
  {
    layouts: [
      ['COMBAT'],
      ['COMBAT', 'EVENT', 'CHIP_DEALER'],
      ['ELITE', 'COMBAT', 'COMBAT'],
      ['MED_BAY', 'CYBER_CLINIC', 'ELITE'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ],
  },
  {
    layouts: [
      ['COMBAT'],
      ['EVENT', 'COMBAT', 'CHIP_DEALER'],
      ['COMBAT', 'ELITE', 'COMBAT'],
      ['CYBER_CLINIC', 'MED_BAY', 'ELITE'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ],
  },
  {
    layouts: [
      ['COMBAT'],
      ['CYBER_CLINIC', 'COMBAT', 'EVENT'],
      ['ELITE', 'COMBAT', 'COMBAT'],
      ['MED_BAY', 'CHIP_DEALER', 'ELITE'],
      ['BOSS'],
    ],
    l1Edges: [
      [0, 1],
      [0, 1, 2],
      [1, 2],
    ],
  },
];

export function generateSectorMap(
  seed: number,
  options: SectorMapOptions = {},
): MapNode[] {
  const {
    difficultyTier = 3,
    mapLength = 'metropolis',
    variantCount = 6,
    dynamicModifiers = true,
  } = options;

  const isMetropolis = mapLength === 'metropolis';
  const variant = ((Math.abs(seed) % variantCount) + variantCount) % variantCount;
  const stdEdges: number[][] = [
    [0, 1],
    [0, 1, 2],
    [1, 2],
  ];
  const crossEdges: number[][] = [
    [0, 1],
    [1, 2],
    [1, 2],
  ];

  let laneLayouts: MapNodeType[][];
  let layerEdges: number[][][];

  if (isMetropolis) {
    laneLayouts = METROPOLIS_VARIANTS[variant].map((row) => row.slice());
    layerEdges = [
      stdEdges,
      stdEdges,
      crossEdges,
      stdEdges,
      stdEdges,
      crossEdges,
      stdEdges,
      stdEdges,
      stdEdges,
    ];
  } else {
    const picked = COMPACT_VARIANTS[variant];
    laneLayouts = picked.layouts.map((row) => row.slice());
    layerEdges = [picked.l1Edges, stdEdges];
  }

  const nodes: MapNode[] = [];
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

  assignDistrictBadges(nodes, seed);

  const maxModifierLayer = isMetropolis ? 10 : 2;
  const eligibleBounty = nodes.filter(
    (n) =>
      n.layer >= 1 &&
      n.layer <= maxModifierLayer &&
      (n.type === 'COMBAT' || n.type === 'ELITE'),
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

  if (dynamicModifiers) {
    const eligibleOvercharged = nodes.filter(
      (n) =>
        n.layer >= 1 &&
        n.layer <= maxModifierLayer &&
        n.type === 'COMBAT' &&
        !n.modifier,
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

    const breatherCandidate =
      nodes.find((n) => n.layer === 2 && n.type === 'COMBAT' && !n.modifier) ??
      nodes.find(
        (n) =>
          n.layer === 2 &&
          n.type === 'COMBAT' &&
          n.modifier !== 'overcharged_hazard',
      );
    if (breatherCandidate) {
      breatherCandidate.isBreatherNode = true;
    }

    // Tier 5 Grandmaster: stack an extra simultaneous Overcharged hazard without overwriting bounty/cache modifiers
    if (difficultyTier === 5) {
      const extraHazardPool = nodes.filter(
        (n) =>
          n.layer >= 2 &&
          n.layer <= (isMetropolis ? 10 : 3) &&
          (n.type === 'ELITE' || n.type === 'COMBAT') &&
          !n.isBreatherNode &&
          !n.modifier,
      );
      if (extraHazardPool.length > 0) {
        const extraIdx = Math.abs(seed * 37 + 13) % extraHazardPool.length;
        extraHazardPool[extraIdx].modifier = 'overcharged_hazard';
      }
    }
  }

  const getNode = (layer: number, lane: number) =>
    nodes.find((n) => n.layer === layer && n.lane === lane);
  const bossLayer = laneLayouts.length - 1;

  const l0 = getNode(0, 0);
  if (l0) {
    l0.nextIds = [0, 1, 2]
      .map((lane) => getNode(1, lane)?.id)
      .filter((id): id is string => Boolean(id));
  }

  for (let layer = 1; layer < bossLayer - 1; layer++) {
    const edgesForLayer = layerEdges[layer - 1] ?? stdEdges;
    for (let lane = 0; lane < 3; lane++) {
      const from = getNode(layer, lane);
      if (!from) continue;
      from.nextIds = edgesForLayer[lane]
        .map((targetLane) => getNode(layer + 1, targetLane)?.id)
        .filter((id): id is string => Boolean(id));
    }
  }

  const boss = getNode(bossLayer, 0);
  if (boss) {
    for (let lane = 0; lane < 3; lane++) {
      const from = getNode(bossLayer - 1, lane);
      if (from) {
        from.nextIds = [boss.id];
      }
    }
  }

  return nodes;
}
