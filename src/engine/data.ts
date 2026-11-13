import type {
  CyberImplant,
  CyberImplantId,
  EnemyArchetype,
  EnemyIntent,
  EnemyUnit,
  EquipmentDefinition,
  HeroineState,
  MapNodeType,
  OwnedEquipment,
  Tile,
  TileSpec,
} from './types';

export const BOARD_CAPACITY = 6;
export const MAX_IMPLANTS = 4;
export const KIRA_CARRY_CAPACITY = 15;
export const STARTING_CREDITS = 40;

const KIRA_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 2 },
  { type: 'attack', value: 2 },
  { type: 'defense', value: 8 },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 51, decayPerTurn: 10 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 51, decayPerTurn: 10 },
  },
];

const EQUIPMENT_CATALOG: EquipmentDefinition[] = [
  {
    id: 'pistole_aretta',
    category: 'weapon',
    size: 2,
    price: 30,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'attack', value: 5 },
      { type: 'attack', value: 5 },
      { type: 'defense', value: 7 },
    ],
  },
  {
    id: 'minilekarnicka',
    category: 'med',
    size: 1,
    price: 20,
    rarity: 'starter',
    droppable: false,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'heal', amount: 2 },
      },
    ],
  },
  {
    id: 'karabin_vx',
    category: 'weapon',
    size: 4,
    price: 45,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'attack', value: 7 },
      { type: 'attack', value: 7 },
      { type: 'attack', value: 4 },
    ],
  },
  {
    id: 'takticky_stit',
    category: 'armor',
    size: 3,
    price: 35,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'defense', value: 9 },
      { type: 'defense', value: 9 },
    ],
  },
  {
    id: 'stim_injektor',
    category: 'med',
    size: 2,
    price: 30,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'tech', value: 0, techEffect: { kind: 'heal', amount: 5 } },
      { type: 'defense', value: 4 },
    ],
  },
  {
    id: 'takticky_zesilovac',
    category: 'tech',
    size: 2,
    price: 40,
    rarity: 'rare',
    droppable: true,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'damage_boost', percent: 51, decayPerTurn: 10 },
      },
      { type: 'attack', value: 4 },
    ],
  },
  {
    id: 'tezka_brokovnice',
    category: 'weapon',
    size: 5,
    price: 55,
    rarity: 'rare',
    droppable: true,
    tiles: [
      { type: 'attack', value: 9 },
      { type: 'attack', value: 9 },
      { type: 'defense', value: 5 },
    ],
  },
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentDefinition> = Object.fromEntries(
  EQUIPMENT_CATALOG.map((item) => [item.id, item]),
);

export const DROPPABLE_EQUIPMENT_IDS: string[] = EQUIPMENT_CATALOG.filter((e) => e.droppable).map(
  (e) => e.id,
);

export function createStartingEquipment(): {
  ownedEquipment: OwnedEquipment[];
  equippedInstanceIds: string[];
} {
  const ownedEquipment: OwnedEquipment[] = [
    { instanceId: 'eq_start_aretta', defId: 'pistole_aretta' },
    { instanceId: 'eq_start_medkit', defId: 'minilekarnicka' },
  ];
  return {
    ownedEquipment,
    equippedInstanceIds: ownedEquipment.map((e) => e.instanceId),
  };
}

export function getEquippedEquipmentWeight(heroine: Pick<HeroineState, 'ownedEquipment' | 'equippedInstanceIds'>): number {
  const ownedById = new Map(heroine.ownedEquipment.map((item) => [item.instanceId, item]));
  let total = 0;
  for (const instanceId of heroine.equippedInstanceIds) {
    const owned = ownedById.get(instanceId);
    if (!owned) continue;
    const def = EQUIPMENT_BY_ID[owned.defId];
    if (def) total += def.size;
  }
  return total;
}

export function rebuildMasterPool(
  heroine: Pick<HeroineState, 'ownedEquipment' | 'equippedInstanceIds'>,
): Tile[] {
  const pool: Tile[] = KIRA_INNATE_TILES.map((spec, idx) => ({
    id: `tile_innate_${idx + 1}`,
    type: spec.type,
    sourceId: 'innate',
    value: spec.value,
    techEffect: spec.techEffect ? { ...spec.techEffect } : undefined,
    isHeldFromPrevTurn: false,
  }));

  const ownedById = new Map(heroine.ownedEquipment.map((item) => [item.instanceId, item]));
  for (const instanceId of heroine.equippedInstanceIds) {
    const owned = ownedById.get(instanceId);
    if (!owned) continue;
    const def = EQUIPMENT_BY_ID[owned.defId];
    if (!def) continue;
    def.tiles.forEach((spec, idx) => {
      pool.push({
        id: `tile_${instanceId}_${idx + 1}`,
        type: spec.type,
        sourceId: def.id,
        value: spec.value,
        techEffect: spec.techEffect ? { ...spec.techEffect } : undefined,
        isHeldFromPrevTurn: false,
      });
    });
  }

  return pool;
}

export const CYBER_IMPLANTS: CyberImplant[] = [
  { id: 'monowire_edge', rarity: 'common' },
  { id: 'aegis_capacitor', rarity: 'rare' },
  { id: 'synapse_overclock', rarity: 'common' },
  { id: 'kinetic_reflector', rarity: 'common' },
  { id: 'plasma_amp', rarity: 'common' },
  { id: 'nano_weave', rarity: 'common' },
  { id: 'surge_resonator', rarity: 'rare' },
  { id: 'bio_siphon', rarity: 'rare' },
  { id: 'flux_injector', rarity: 'common' },
  { id: 'piercing_katana', rarity: 'rare' },
];

export const CYBER_IMPLANT_IDS: CyberImplantId[] = CYBER_IMPLANTS.map((i) => i.id);

interface EnemyTemplate {
  archetype: EnemyArchetype;
  maxHp: number;
  startingArmor: number;
  intentCycle: EnemyIntent[];
}

export const ENEMY_TEMPLATES: Record<EnemyArchetype, EnemyTemplate> = {
  stalker: {
    archetype: 'stalker',
    maxHp: 28,
    startingArmor: 0,
    intentCycle: [
      { kind: 'attack', value: 7 },
      { kind: 'attack', value: 9 },
      { kind: 'armor', value: 6 },
    ],
  },
  spitter: {
    archetype: 'spitter',
    maxHp: 24,
    startingArmor: 0,
    intentCycle: [
      { kind: 'acid', value: 5, secondaryValue: 2 },
      { kind: 'leech', value: 6, secondaryValue: 4 },
      { kind: 'acid', value: 7, secondaryValue: 2 },
    ],
  },
  brute: {
    archetype: 'brute',
    maxHp: 42,
    startingArmor: 8,
    intentCycle: [
      { kind: 'armor', value: 8 },
      { kind: 'heavy', value: 13 },
      { kind: 'attack', value: 8 },
    ],
  },
  boss: {
    archetype: 'boss',
    maxHp: 88,
    startingArmor: 10,
    intentCycle: [
      { kind: 'attack', value: 11 },
      { kind: 'acid', value: 8, secondaryValue: 3 },
      { kind: 'armor', value: 12 },
      { kind: 'heavy', value: 16 },
    ],
  },
};

function createEnemyFromArchetype(
  archetype: EnemyArchetype,
  idSuffix: string,
  hpBonus = 0,
): EnemyUnit {
  const tpl = ENEMY_TEMPLATES[archetype];
  return {
    id: `enemy_${archetype}_${idSuffix}`,
    archetype,
    hp: tpl.maxHp + hpBonus,
    maxHp: tpl.maxHp + hpBonus,
    armor: tpl.startingArmor,
    intentCycle: tpl.intentCycle.map((intent) => ({ ...intent })),
    currentIntentIndex: 0,
  };
}

interface EncounterUnitSpec {
  archetype: EnemyArchetype;
  idSuffix: string;
  hpBonus: number;
}

export function buildEncounterSpec(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
): EncounterUnitSpec[] {
  if (nodeType === 'BOSS') {
    return [{ archetype: 'boss', idSuffix: 'boss_1', hpBonus: 0 }];
  }
  if (nodeType === 'ELITE') {
    return [
      { archetype: 'brute', idSuffix: 'elite_1', hpBonus: layer * 4 },
      { archetype: 'spitter', idSuffix: 'elite_2', hpBonus: layer * 2 },
    ];
  }
  if (nodeType === 'CYBER_CLINIC' || nodeType === 'MED_BAY') {
    return [];
  }
  if (layer === 0) {
    return [{ archetype: 'stalker', idSuffix: 'l0_1', hpBonus: 0 }];
  }
  if (seed % 2 === 0) {
    return [
      { archetype: 'stalker', idSuffix: `l${layer}_1`, hpBonus: layer * 3 },
      { archetype: 'spitter', idSuffix: `l${layer}_2`, hpBonus: layer * 2 },
    ];
  }
  return [
    { archetype: 'spitter', idSuffix: `l${layer}_1`, hpBonus: layer * 2 },
    { archetype: 'stalker', idSuffix: `l${layer}_2`, hpBonus: layer * 3 },
  ];
}

export function buildEnemiesForNode(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
): EnemyUnit[] {
  return buildEncounterSpec(nodeType, layer, seed).map((spec) =>
    createEnemyFromArchetype(spec.archetype, spec.idSuffix, spec.hpBonus),
  );
}
