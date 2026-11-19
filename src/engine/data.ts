import { computeSmartScaledEnemyHp, getDifficultyProfile } from './difficulty';
import type {
  CharacterId,
  CyberImplant,
  CyberImplantId,
  DifficultyTier,
  EnemyArchetype,
  EnemyIntent,
  EnemyPassiveKind,
  EnemyPropKind,
  EnemyRoleColor,
  EnemyUnit,
  EquipmentDefinition,
  HeroineState,
  MapNodeType,
  NodeModifier,
  OwnedEquipment,
  Tile,
  TileSpec,
} from './types';

export const BOARD_CAPACITY = 6;
export const MAX_UPCHARGE_BOARD_CAPACITY = 9;
export const MAX_IMPLANTS = 4;
export const KIRA_CARRY_CAPACITY = 12;
export const AURELIA_CARRY_CAPACITY = 14;
export const ZURI_CARRY_CAPACITY = 13;
export const CLINIC_RESTOCK_COST = 12;
export const CLINIC_PURGE_COST = 30;
export const MAX_OVERCLOCK_STACKS = 2;

export interface HeroOverdriveSpec {
  damage: number;
  armor?: number;
  upcharge?: number;
  armorShred?: number;
  shield: number;
  damageBoostPct: number;
  cleanseCorrode: number;
}

export interface HeroSpec {
  id: CharacterId;
  maxHp: number;
  startingArmor: number;
  dudUpchargePerTile: number;
  startingCredits: number;
  carryCapacity: number;
  heldTileBonus: number;
  techOverdrivePerTile: number;
  shieldRetainCap: number;
  defenseRipostePerTile: number;
  overdrive: HeroOverdriveSpec;
}

export const HERO_SPECS: Record<CharacterId, HeroSpec> = {
  kira: {
    id: 'kira',
    maxHp: 58,
    startingArmor: 0,
    dudUpchargePerTile: 0,
    startingCredits: 45,
    carryCapacity: KIRA_CARRY_CAPACITY,
    heldTileBonus: 1,
    techOverdrivePerTile: 20,
    shieldRetainCap: 0,
    defenseRipostePerTile: 0,
    overdrive: {
      damage: 20,
      shield: 6,
      damageBoostPct: 30,
      cleanseCorrode: 0,
    },
  },
  aurelia: {
    id: 'aurelia',
    maxHp: 78,
    startingArmor: 18,
    dudUpchargePerTile: 1,
    startingCredits: 35,
    carryCapacity: AURELIA_CARRY_CAPACITY,
    heldTileBonus: 0,
    techOverdrivePerTile: 15,
    shieldRetainCap: 0,
    defenseRipostePerTile: 0,
    overdrive: {
      damage: 20,
      armor: 10,
      upcharge: 2,
      shield: 0,
      damageBoostPct: 0,
      cleanseCorrode: 0,
    },
  },
  zuri: {
    id: 'zuri',
    maxHp: 62,
    startingArmor: 0,
    dudUpchargePerTile: 0,
    startingCredits: 50,
    carryCapacity: ZURI_CARRY_CAPACITY,
    heldTileBonus: 0,
    techOverdrivePerTile: 25,
    shieldRetainCap: 0,
    defenseRipostePerTile: 0,
    overdrive: {
      damage: 16,
      armorShred: 12,
      shield: 8,
      damageBoostPct: 0,
      cleanseCorrode: 2,
    },
  },
};

export function getHeroSpec(characterId: CharacterId = 'kira'): HeroSpec {
  return HERO_SPECS[characterId] ?? HERO_SPECS.kira;
}

const KIRA_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 3 },
  { type: 'defense', value: 8 },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'heal', amount: 2 },
  },
];

const AURELIA_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 5 },
  { type: 'attack', value: 0, isDud: true },
  { type: 'defense', value: 8 },
  { type: 'defense', value: 0, isDud: true },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
  },
  { type: 'tech', value: 0, isDud: true },
];

const ZURI_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 4 },
  { type: 'defense', value: 7 },
  { type: 'defense', value: 6 },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'tactical_shield', shieldAmount: 4, damageBoostPct: 24 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'armor_shred', shredAmount: 8, pierceDamage: 3 },
  },
];

export function getInnateTilesForCharacter(characterId: CharacterId = 'kira'): readonly TileSpec[] {
  if (characterId === 'aurelia') return AURELIA_INNATE_TILES;
  if (characterId === 'zuri') return ZURI_INNATE_TILES;
  return KIRA_INNATE_TILES;
}

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
    price: 22,
    rarity: 'starter',
    droppable: false,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'heal', amount: 3 },
      },
    ],
  },
  {
    id: 'dvojita_brokovnice',
    category: 'weapon',
    size: 3,
    price: 36,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'kralovsky_diadem',
    category: 'armor',
    size: 1,
    price: 24,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'defense', value: 7 },
    ],
  },
  {
    id: 'utocny_dron_sokol',
    category: 'weapon',
    size: 2,
    price: 34,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 5 },
    ],
  },
  {
    id: 'stito_dron_ankh',
    category: 'tech',
    size: 2,
    price: 28,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'defense', value: 8 },
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'heal', amount: 4 },
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
      { type: 'attack', value: 5 },
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
      { type: 'defense', value: 6 },
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
        techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
      },
      { type: 'attack', value: 5 },
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
      { type: 'defense', value: 7 },
    ],
  },
  {
    id: 'nano_ostri',
    category: 'weapon',
    size: 2,
    price: 34,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'attack', value: 7 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'kryo_kondenzator',
    category: 'tech',
    size: 2,
    price: 32,
    rarity: 'common',
    droppable: true,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'overdrive_surge', bonusOverdrive: 15, cleanseCorrode: 2 },
      },
      { type: 'defense', value: 6 },
    ],
  },
  {
    id: 'pulzni_kuse',
    category: 'weapon',
    size: 3,
    price: 46,
    rarity: 'rare',
    droppable: true,
    tiles: [
      { type: 'attack', value: 8 },
      { type: 'attack', value: 6 },
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'armor_shred', shredAmount: 10, pierceDamage: 4 },
      },
    ],
  },
  {
    id: 'energeticky_konvertor',
    category: 'tech',
    size: 2,
    price: 38,
    rarity: 'rare',
    droppable: true,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'tactical_shield', shieldAmount: 5, damageBoostPct: 22 },
      },
      { type: 'attack', value: 5 },
    ],
  },
  {
    id: 'reaktivni_pancir',
    category: 'armor',
    size: 4,
    price: 48,
    rarity: 'rare',
    droppable: true,
    tiles: [
      { type: 'defense', value: 10 },
      { type: 'defense', value: 8 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'upcharge_pulse_chip',
    category: 'tech',
    size: 2,
    price: 34,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'attack', value: 5, upcharge: 1 },
      { type: 'defense', value: 6 },
    ],
  },
  {
    id: 'tactical_upcharge_chip',
    category: 'tech',
    size: 2,
    price: 38,
    rarity: 'common',
    droppable: true,
    tiles: [
      { type: 'tech', value: 0, techEffect: { kind: 'heal', amount: 3 }, upcharge: 1 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'neural_surge_chip',
    category: 'tech',
    size: 3,
    price: 48,
    rarity: 'rare',
    droppable: true,
    tiles: [
      {
        type: 'tech',
        value: 0,
        techEffect: { kind: 'overdrive_surge', bonusOverdrive: 10, cleanseCorrode: 1 },
        upcharge: 2,
      },
      { type: 'defense', value: 8, upcharge: 1 },
    ],
  },
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentDefinition> = Object.fromEntries(
  EQUIPMENT_CATALOG.map((item) => [item.id, item]),
);

export const DROPPABLE_EQUIPMENT_IDS: string[] = EQUIPMENT_CATALOG.filter((e) => e.droppable).map(
  (e) => e.id,
);

export function createStartingEquipment(characterId: CharacterId = 'kira'): {
  ownedEquipment: OwnedEquipment[];
  equippedInstanceIds: string[];
} {
  const ownedEquipment: OwnedEquipment[] =
    characterId === 'aurelia'
      ? [
          { instanceId: 'eq_start_scattergun', defId: 'dvojita_brokovnice' },
          { instanceId: 'eq_start_diadem', defId: 'kralovsky_diadem' },
        ]
      : characterId === 'zuri'
        ? [
            { instanceId: 'eq_start_hawk_drone', defId: 'utocny_dron_sokol' },
            { instanceId: 'eq_start_ankh_drone', defId: 'stito_dron_ankh' },
          ]
        : [
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
  heroine: Pick<
    HeroineState,
    | 'characterId'
    | 'ownedEquipment'
    | 'equippedInstanceIds'
    | 'overclockCount'
    | 'purgedInnateIds'
    | 'incubatingTile'
    | 'maturedNextGenTiles'
    | 'prodigyTileIds'
    | 'splicedTilePairs'
    | 'heirloomEngravedId'
    | 'heirloomStacks'
    | 'dynastyRelicUnlocked'
  >,
): Tile[] {
  const purgedSet = new Set(heroine.purgedInnateIds ?? []);
  const prodigySet = new Set(heroine.prodigyTileIds ?? []);
  const splicedPairs = heroine.splicedTilePairs ?? [];
  const consumedBySplice = new Set(splicedPairs.map((p) => p.consumedId));
  const incubatingId =
    heroine.incubatingTile && heroine.incubatingTile.nodesRemaining > 0
      ? heroine.incubatingTile.tile.id
      : null;
  const maturedMap = heroine.maturedNextGenTiles ?? {};

  const innateSpecs = getInnateTilesForCharacter(heroine.characterId ?? 'kira');
  const pool: Tile[] = [];
  innateSpecs.forEach((spec, idx) => {
    const id = `tile_innate_${idx + 1}`;
    if (purgedSet.has(id) || consumedBySplice.has(id) || id === incubatingId) return;

    let value = spec.value;
    let isDud = spec.isDud;
    let upcharge = spec.upcharge;
    let techEffect = spec.techEffect ? { ...spec.techEffect } : undefined;

    if (prodigySet.has(id)) {
      isDud = false;
      value = spec.type === 'tech' ? 0 : Math.max(6, spec.value + 3);
      upcharge = (upcharge ?? 0) + 1;
      if (spec.type === 'tech' && !techEffect) {
        techEffect = { kind: 'tactical_shield', shieldAmount: 5, damageBoostPct: 20 };
      }
    }

    const splice = splicedPairs.find((p) => p.targetId === id);
    let secondaryType = spec.secondaryType;
    let secondaryValue = spec.secondaryValue;
    if (splice) {
      isDud = false;
      value += splice.bonusValue;
      upcharge = (upcharge ?? 0) + splice.bonusUpcharge;
      if (splice.secondaryType) {
        secondaryType = splice.secondaryType;
        secondaryValue = splice.secondaryValue ?? splice.bonusValue;
      }
    }

    const matured = maturedMap[id];
    if (matured) {
      isDud = false;
      value = spec.type === 'tech' ? 0 : Math.max(8, value * matured.bonusMultiplier);
      upcharge = (upcharge ?? 0) + 1;
      if (techEffect) {
        if (techEffect.kind === 'heal') {
          techEffect = { ...techEffect, amount: techEffect.amount * 2 };
        } else if (techEffect.kind === 'damage_boost') {
          techEffect = { ...techEffect, percent: Math.min(80, techEffect.percent + 25) };
        }
      }
    }

    pool.push({
      id,
      type: spec.type,
      sourceId: 'innate',
      value,
      techEffect,
      isDud,
      upcharge,
      ...(secondaryType ? { secondaryType, secondaryValue } : {}),
      isHeldFromPrevTurn: false,
    });
  });

  // Upcycle / Charter Academy adjacency buff: each enrolled Prodigy tile grants +1 base value to adjacent innate Attack/Defense tiles
  if (prodigySet.size > 0) {
    for (let i = 0; i < pool.length; i++) {
      if (
        pool[i].sourceId === 'innate' &&
        !prodigySet.has(pool[i].id) &&
        !pool[i].isDud &&
        (pool[i].type === 'attack' || pool[i].type === 'defense')
      ) {
        pool[i] = { ...pool[i], value: pool[i].value + 1 };
      }
    }
  }

  const heirloomBonus = Math.min(6, Math.max(0, heroine.heirloomStacks ?? 0));
  const ownedById = new Map(heroine.ownedEquipment.map((item) => [item.instanceId, item]));
  for (const instanceId of heroine.equippedInstanceIds) {
    const owned = ownedById.get(instanceId);
    if (!owned) continue;
    const def = EQUIPMENT_BY_ID[owned.defId];
    if (!def) continue;
    const isHeirloomChip =
      heirloomBonus > 0 &&
      (heroine.heirloomEngravedId === def.id || heroine.heirloomEngravedId === instanceId);
    def.tiles.forEach((spec, idx) => {
      const id = `tile_${instanceId}_${idx + 1}`;
      if (id === incubatingId || consumedBySplice.has(id)) return;
      let value = spec.value + (isHeirloomChip && spec.type !== 'tech' ? heirloomBonus : 0);
      let upcharge = spec.upcharge;
      let techEffect = spec.techEffect ? { ...spec.techEffect } : undefined;
      let secondaryType = spec.secondaryType;
      let secondaryValue = spec.secondaryValue;

      const splice = splicedPairs.find((p) => p.targetId === id);
      if (splice) {
        value += splice.bonusValue;
        upcharge = (upcharge ?? 0) + splice.bonusUpcharge;
        if (splice.secondaryType) {
          secondaryType = splice.secondaryType;
          secondaryValue = splice.secondaryValue ?? splice.bonusValue;
        }
      }

      const matured = maturedMap[id];
      if (matured) {
        value = spec.type === 'tech' ? 0 : Math.max(10, value * matured.bonusMultiplier);
        upcharge = (upcharge ?? 0) + 1;
        if (techEffect && techEffect.kind === 'heal') {
          techEffect = { ...techEffect, amount: techEffect.amount * 2 };
        }
      }

      pool.push({
        id,
        type: spec.type,
        sourceId: def.id,
        value,
        techEffect,
        isDud: spec.isDud,
        upcharge,
        ...(secondaryType ? { secondaryType, secondaryValue } : {}),
        isHeldFromPrevTurn: false,
      });
    });
  }

  const overclockCount = Math.min(MAX_OVERCLOCK_STACKS, Math.max(0, heroine.overclockCount ?? 0));
  if (overclockCount > 0) {
    const atkBonus = overclockCount;
    let upgraded = 0;
    for (let i = 0; i < pool.length && upgraded < 2; i++) {
      if (pool[i].type === 'attack' && !pool[i].isDud) {
        pool[i] = { ...pool[i], value: pool[i].value + atkBonus };
        upgraded++;
      }
    }
  }

  // Dynasty Relic (Maternal/Paternal Vanguard Escort reward): scales tile power with total Master Tile Pool size
  if (heroine.dynastyRelicUnlocked) {
    const dynastyBonus = Math.max(1, Math.floor(pool.length / 6));
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].isDud && (pool[i].type === 'attack' || pool[i].type === 'defense')) {
        pool[i] = { ...pool[i], value: pool[i].value + dynastyBonus };
      }
    }
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
  startingShieldPips: number;
  passive: EnemyPassiveKind;
  roleColor: EnemyRoleColor;
  phaseGatePct?: number;
  intentCycle: EnemyIntent[];
}

export const ENEMY_TEMPLATES: Record<EnemyArchetype, EnemyTemplate> = {
  larva: {
    archetype: 'larva',
    maxHp: 9,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'volatile_burst',
    roleColor: 'lime',
    intentCycle: [
      { kind: 'attack', value: 3 },
      { kind: 'acid', value: 3, secondaryValue: 1 },
      { kind: 'attack', value: 4 },
    ],
  },
  skitter: {
    archetype: 'skitter',
    maxHp: 14,
    startingArmor: 2,
    startingShieldPips: 1,
    passive: 'anchor_aegis',
    roleColor: 'blue',
    intentCycle: [
      { kind: 'bolster', value: 4 },
      { kind: 'attack', value: 5 },
      { kind: 'leech', value: 5, secondaryValue: 3 },
    ],
  },
  stinger: {
    archetype: 'stinger',
    maxHp: 16,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'time_bomb',
    roleColor: 'orange',
    intentCycle: [
      { kind: 'charge', value: 16, secondaryValue: 2 },
      { kind: 'charge', value: 16, secondaryValue: 1 },
      { kind: 'heavy', value: 16 },
    ],
  },
  stalker: {
    archetype: 'stalker',
    maxHp: 24,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'spike_retaliate',
    roleColor: 'crimson',
    intentCycle: [
      { kind: 'attack', value: 6 },
      { kind: 'attack', value: 7, condition: 'if_no_shield', conditionBonus: 4 },
      { kind: 'armor', value: 4 },
    ],
  },
  spitter: {
    archetype: 'spitter',
    maxHp: 22,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'acid_jam',
    roleColor: 'violet',
    intentCycle: [
      { kind: 'acid', value: 5, secondaryValue: 2 },
      { kind: 'attack', value: 7, corrodeAmount: 2, armorOnHit: 3, clawRend: true },
      { kind: 'acid', value: 6, secondaryValue: 2, topDeckBlight: true },
    ],
  },
  brute: {
    archetype: 'brute',
    maxHp: 38,
    startingArmor: 8,
    startingShieldPips: 1,
    passive: 'threshold_pip',
    roleColor: 'gold',
    intentCycle: [
      { kind: 'armor', value: 6, secondaryValue: 3 },
      { kind: 'heavy', value: 14 },
      { kind: 'attack', value: 9 },
    ],
  },
  boss: {
    archetype: 'boss',
    maxHp: 110,
    startingArmor: 10,
    startingShieldPips: 1,
    passive: 'phase_gate',
    roleColor: 'apex',
    phaseGatePct: 50,
    intentCycle: [
      { kind: 'armor', value: 10 },
      { kind: 'attack', value: 11, condition: 'if_play_attack', conditionBonus: 4 },
      { kind: 'acid', value: 8, secondaryValue: 2, topDeckBlight: true },
      { kind: 'heavy', value: 18 },
    ],
  },
};

export function createBlightTile(turn: number, seq: number, isTopDecked = false): Tile {
  return {
    id: `tile_blight_${turn}_${seq}`,
    type: 'tech',
    sourceId: 'caustic_blight',
    value: 0,
    isHeldFromPrevTurn: false,
    isBlight: true,
    ...(isTopDecked ? { isTopDecked: true } : {}),
  };
}

export function createPropUnit(
  propKind: EnemyPropKind,
  idSuffix: string,
  reviveData?: { archetype: EnemyArchetype; maxHp: number },
): EnemyUnit {
  if (propKind === 'plasma_barrel') {
    return {
      id: `prop_plasma_barrel_${idSuffix}`,
      archetype: 'larva',
      hp: 10,
      maxHp: 10,
      armor: 0,
      shieldPips: 0,
      maxShieldPips: 0,
      passive: 'volatile_burst',
      roleColor: 'orange',
      propKind: 'plasma_barrel',
      intentCycle: [{ kind: 'armor', value: 0 }],
      currentIntentIndex: 0,
      isZeroReward: true,
    };
  }
  if (propKind === 'decoy_totem') {
    return {
      id: `prop_decoy_totem_${idSuffix}`,
      archetype: 'skitter',
      hp: 5,
      maxHp: 5,
      armor: 2,
      shieldPips: 1,
      maxShieldPips: 1,
      passive: 'anchor_aegis',
      roleColor: 'blue',
      propKind: 'decoy_totem',
      intentCycle: [{ kind: 'armor', value: 2 }],
      currentIntentIndex: 0,
      isZeroReward: true,
    };
  }
  const revArch = reviveData?.archetype ?? 'stalker';
  return {
    id: `prop_bio_husk_${idSuffix}`,
    archetype: revArch,
    hp: 8,
    maxHp: 8,
    armor: 0,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'volatile_burst',
    roleColor: 'violet',
    propKind: 'bio_husk',
    reviveTimer: 2,
    reviveArchetype: revArch,
    reviveMaxHp: reviveData?.maxHp ?? ENEMY_TEMPLATES[revArch].maxHp,
    intentCycle: [{ kind: 'armor', value: 0 }],
    currentIntentIndex: 0,
    isZeroReward: true,
  };
}

export function createLootRunnerUnit(idSuffix: string, bountyCredits = 25): EnemyUnit {
  return {
    id: `enemy_loot_runner_${idSuffix}`,
    archetype: 'skitter',
    hp: 18,
    maxHp: 18,
    armor: 4,
    shieldPips: 1,
    maxShieldPips: 1,
    passive: 'anchor_aegis',
    roleColor: 'gold',
    isLootRunner: true,
    escapeTurnsLeft: 3,
    bountyCredits,
    intentCycle: [
      { kind: 'armor', value: 4 },
      { kind: 'armor', value: 5 },
      { kind: 'armor', value: 6 },
    ],
    currentIntentIndex: 0,
  };
}

export function createMercyDroneUnit(idSuffix: string): EnemyUnit {
  return {
    id: `enemy_mercy_drone_${idSuffix}`,
    archetype: 'skitter',
    hp: 16,
    maxHp: 16,
    armor: 2,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'anchor_aegis',
    roleColor: 'lime',
    isMercyTarget: true,
    intentCycle: [{ kind: 'attack', value: 3 }],
    currentIntentIndex: 0,
    isZeroReward: true,
  };
}

export function createSleepwalkerUnit(idSuffix: string, hpBonus = 0, sleepCounter = 2): EnemyUnit {
  const unit = createEnemyFromArchetype('brute', idSuffix, hpBonus, 1);
  unit.sleepCounter = sleepCounter;
  return unit;
}

function createEnemyFromArchetype(
  archetype: EnemyArchetype,
  idSuffix: string,
  hpBonus = 0,
  initialIntentIndex = 0,
): EnemyUnit {
  const tpl = ENEMY_TEMPLATES[archetype];
  const cycleLen = Math.max(1, tpl.intentCycle.length);
  return {
    id: `enemy_${archetype}_${idSuffix}`,
    archetype,
    hp: tpl.maxHp + hpBonus,
    maxHp: tpl.maxHp + hpBonus,
    armor: tpl.startingArmor,
    shieldPips: tpl.startingShieldPips,
    maxShieldPips: tpl.startingShieldPips,
    passive: tpl.passive,
    roleColor: tpl.roleColor,
    phaseGatePct: tpl.phaseGatePct,
    phaseGateTriggered: tpl.phaseGatePct ? false : undefined,
    intentCycle: tpl.intentCycle.map((intent) => ({ ...intent })),
    currentIntentIndex: ((initialIntentIndex % cycleLen) + cycleLen) % cycleLen,
  };
}

interface EncounterUnitSpec {
  archetype: EnemyArchetype;
  idSuffix: string;
  hpBonus: number;
  initialIntentIndex?: number;
}

export function buildEncounterSpec(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
  lane = 0,
  difficultyTier: DifficultyTier = 3,
  isBreather = false,
): EncounterUnitSpec[] {
  const diff = getDifficultyProfile(difficultyTier);
  const mode = diff.boardComplexity;

  if (nodeType === 'BOSS') {
    if (mode === 'grandmaster') {
      return [
        { archetype: 'boss', idSuffix: 'boss_1', hpBonus: 0 },
        { archetype: 'skitter', idSuffix: 'boss_escort_1', hpBonus: 0, initialIntentIndex: 0 },
      ];
    }
    return [{ archetype: 'boss', idSuffix: 'boss_1', hpBonus: 0 }];
  }
  if (nodeType === 'ELITE') {
    if (layer >= 3) {
      if (mode === 'minimum') {
        return [
          { archetype: 'brute', idSuffix: 'elite_2', hpBonus: layer * 2, initialIntentIndex: 0 },
          { archetype: 'stinger', idSuffix: 'elite_3', hpBonus: layer, initialIntentIndex: 0 },
        ];
      }
      return [
        {
          archetype: mode === 'grandmaster' ? 'skitter' : 'larva',
          idSuffix: 'elite_1',
          hpBonus: 0,
          initialIntentIndex: 0,
        },
        { archetype: 'brute', idSuffix: 'elite_2', hpBonus: layer * 2, initialIntentIndex: 0 },
        { archetype: 'stinger', idSuffix: 'elite_3', hpBonus: layer, initialIntentIndex: 0 },
      ];
    }
    if (mode === 'hard' || mode === 'grandmaster') {
      return [
        { archetype: 'brute', idSuffix: 'elite_1', hpBonus: layer * 2, initialIntentIndex: 0 },
        { archetype: 'spitter', idSuffix: 'elite_2', hpBonus: layer, initialIntentIndex: 0 },
        {
          archetype: mode === 'grandmaster' ? 'skitter' : 'larva',
          idSuffix: 'elite_3',
          hpBonus: 0,
          initialIntentIndex: 0,
        },
      ];
    }
    return [
      { archetype: 'brute', idSuffix: 'elite_1', hpBonus: layer * 2, initialIntentIndex: 0 },
      { archetype: 'spitter', idSuffix: 'elite_2', hpBonus: layer, initialIntentIndex: 0 },
    ];
  }
  if (
    nodeType === 'CYBER_CLINIC' ||
    nodeType === 'CHIP_DEALER' ||
    nodeType === 'MED_BAY' ||
    nodeType === 'EVENT'
  ) {
    return [];
  }
  // Layer 0: Turn-1 Breathing Room (3 DMG from front Spore Mite; Stalker opens on Armor +4)
  if (layer === 0) {
    return [
      { archetype: 'larva', idSuffix: 'l0_1', hpBonus: 0, initialIntentIndex: 0 },
      { archetype: 'stalker', idSuffix: 'l0_2', hpBonus: -4, initialIntentIndex: 2 },
    ];
  }
  const roll = Math.abs(seed + lane) % 2;

  // Sawtooth Complexity Curve: pre-boss breather skirmish lets players test new Chips cleanly
  if (isBreather && layer >= 2) {
    return [
      { archetype: 'larva', idSuffix: `l${layer}_${lane}_b1`, hpBonus: 0, initialIntentIndex: 0 },
      {
        archetype: roll === 0 ? 'stinger' : 'skitter',
        idSuffix: `l${layer}_${lane}_b2`,
        hpBonus: 0,
        initialIntentIndex: 0,
      },
    ];
  }

  // Layer 1: Rule of Three + Threat Cap (max 1 active attacker on Turn 1; 3-5 DMG incoming)
  if (layer === 1) {
    if (roll === 0) {
      if (mode === 'minimum' || mode === 'relaxed') {
        return [
          { archetype: 'larva', idSuffix: `l1_${lane}_1`, hpBonus: 0, initialIntentIndex: 0 },
          { archetype: 'stinger', idSuffix: `l1_${lane}_3`, hpBonus: 0, initialIntentIndex: 0 },
        ];
      }
      return [
        {
          archetype: mode === 'grandmaster' ? 'skitter' : 'larva',
          idSuffix: `l1_${lane}_1`,
          hpBonus: 0,
          initialIntentIndex: 0,
        },
        { archetype: 'skitter', idSuffix: `l1_${lane}_2`, hpBonus: 0, initialIntentIndex: 0 },
        { archetype: 'stinger', idSuffix: `l1_${lane}_3`, hpBonus: 0, initialIntentIndex: 0 },
      ];
    }
    if (mode === 'hard' || mode === 'grandmaster') {
      return [
        { archetype: 'skitter', idSuffix: `l1_${lane}_1`, hpBonus: 0, initialIntentIndex: 0 },
        { archetype: 'spitter', idSuffix: `l1_${lane}_2`, hpBonus: 0, initialIntentIndex: 0 },
        { archetype: 'stinger', idSuffix: `l1_${lane}_3`, hpBonus: 0, initialIntentIndex: 0 },
      ];
    }
    return [
      { archetype: 'skitter', idSuffix: `l1_${lane}_1`, hpBonus: 0, initialIntentIndex: 0 },
      { archetype: 'spitter', idSuffix: `l1_${lane}_2`, hpBonus: 0, initialIntentIndex: 0 },
    ];
  }
  const lateBonus = Math.max(0, (layer - 1) * 2);
  // Layer 2+: Max 3 archetypes, capped Turn-1 threat while Time-Bomb / Anchor / Punisher prime
  if (roll === 0) {
    if (mode === 'minimum') {
      return [
        { archetype: 'larva', idSuffix: `l${layer}_${lane}_1`, hpBonus: Math.min(3, lateBonus), initialIntentIndex: 0 },
        { archetype: 'stinger', idSuffix: `l${layer}_${lane}_3`, hpBonus: lateBonus, initialIntentIndex: 0 },
      ];
    }
    return [
      {
        archetype: mode === 'grandmaster' ? 'skitter' : 'larva',
        idSuffix: `l${layer}_${lane}_1`,
        hpBonus: Math.min(3, lateBonus),
        initialIntentIndex: 0,
      },
      { archetype: 'stalker', idSuffix: `l${layer}_${lane}_2`, hpBonus: lateBonus, initialIntentIndex: 2 },
      { archetype: 'stinger', idSuffix: `l${layer}_${lane}_3`, hpBonus: lateBonus, initialIntentIndex: 0 },
    ];
  }
  if (mode === 'minimum') {
    return [
      { archetype: 'skitter', idSuffix: `l${layer}_${lane}_1`, hpBonus: lateBonus, initialIntentIndex: 0 },
      { archetype: 'spitter', idSuffix: `l${layer}_${lane}_2`, hpBonus: lateBonus, initialIntentIndex: 0 },
    ];
  }
  return [
    { archetype: 'skitter', idSuffix: `l${layer}_${lane}_1`, hpBonus: lateBonus, initialIntentIndex: 0 },
    { archetype: 'spitter', idSuffix: `l${layer}_${lane}_2`, hpBonus: lateBonus, initialIntentIndex: 0 },
    { archetype: 'stinger', idSuffix: `l${layer}_${lane}_3`, hpBonus: lateBonus, initialIntentIndex: 0 },
  ];
}

export function buildEnemiesForNode(
  nodeType: MapNodeType,
  layer: number,
  seed: number,
  lane = 0,
  modifier?: NodeModifier,
  difficultyTier: DifficultyTier = 3,
  isBreather = false,
): EnemyUnit[] {
  return buildEncounterSpec(nodeType, layer, seed, lane, difficultyTier, isBreather).map((spec) => {
    const isOvercharged = modifier === 'overcharged_hazard';
    const tpl = ENEMY_TEMPLATES[spec.archetype];
    const scaledHp = computeSmartScaledEnemyHp(
      spec.archetype,
      tpl.maxHp,
      spec.hpBonus,
      difficultyTier,
    );
    const overchargeBonus = isOvercharged ? Math.max(3, Math.round(tpl.maxHp * 0.25)) : 0;
    const baseUnit = createEnemyFromArchetype(
      spec.archetype,
      spec.idSuffix,
      scaledHp - tpl.maxHp + overchargeBonus,
      spec.initialIntentIndex ?? 0,
    );
    if (isOvercharged) {
      baseUnit.armor += 1;
      baseUnit.intentCycle = baseUnit.intentCycle.map((intent) => ({
        ...intent,
        value:
          intent.kind === 'attack' || intent.kind === 'heavy' || intent.kind === 'acid'
            ? Math.round(intent.value * 1.25)
            : intent.value,
      }));
    }
    return baseUnit;
  });
}
