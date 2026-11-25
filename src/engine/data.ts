import type {
  CharacterId,
  CyberImplant,
  CyberImplantId,
  EnemyArchetype,
  EnemyIntent,
  EnemyPassiveKind,
  EnemyRoleColor,
  SkillChipDefinition,
  TileSpec,
} from './types';

export const BOARD_CAPACITY = 6;
export const MAX_UPCHARGE_BOARD_CAPACITY = 9;
export const MAX_IMPLANTS = 4;
export const KIRA_MEMORY_CAPACITY = 12;
export const AURALINE_MEMORY_CAPACITY = 14;
export const ZURI_MEMORY_CAPACITY = 13;
export const CHIP_DEALER_RESTOCK_COST = 12;
export const CLINIC_PURGE_COST = 30;
export const HEIRLOOM_ENGRAVE_COST = 25;
export const MAX_HEIRLOOM_STACKS = 6;
export const MAX_OVERCLOCK_STACKS = 2;

export interface HeroOverdriveSpec {
  damage: number;
  frontKickDamage?: number;
  knockbackFront?: boolean;
  armor?: number;
  upcharge?: number;
  armorShred?: number;
  shield: number;
  damageBoostPct: number;
  cleanseCorrode: number;
}

export interface HeroTriDroneSyncSpec {
  attackPierceDamage: number;
  defenseShield: number;
  techHeal: number;
}

export interface HeroSpec {
  id: CharacterId;
  maxHp: number;
  startingArmor: number;
  dudUpchargePerTile: number;
  dudArmorPerTile: number;
  dudOverdrivePerTile: number;
  startingCredits: number;
  memoryCapacity: number;
  heldTileBonus: number;
  attackOverdrivePerTile: number;
  defenseOverdrivePerTile: number;
  techOverdrivePerTile: number;
  blitzReflexCooldownTurns?: number;
  triDroneSync?: HeroTriDroneSyncSpec;
  overdrive: HeroOverdriveSpec;
}

export const HERO_SPECS: Record<CharacterId, HeroSpec> = {
  kira: {
    id: 'kira',
    maxHp: 62,
    startingArmor: 0,
    dudUpchargePerTile: 0,
    dudArmorPerTile: 0,
    dudOverdrivePerTile: 0,
    startingCredits: 45,
    memoryCapacity: KIRA_MEMORY_CAPACITY,
    heldTileBonus: 1,
    attackOverdrivePerTile: 10,
    defenseOverdrivePerTile: 4,
    techOverdrivePerTile: 12,
    blitzReflexCooldownTurns: 3,
    overdrive: {
      damage: 10,
      frontKickDamage: 12,
      knockbackFront: true,
      shield: 8,
      damageBoostPct: 0,
      cleanseCorrode: 0,
    },
  },
  auraline: {
    id: 'auraline',
    maxHp: 68,
    startingArmor: 2,
    dudUpchargePerTile: 1,
    dudArmorPerTile: 1,
    dudOverdrivePerTile: 15,
    startingCredits: 35,
    memoryCapacity: AURALINE_MEMORY_CAPACITY,
    heldTileBonus: 0,
    attackOverdrivePerTile: 5,
    defenseOverdrivePerTile: 5,
    techOverdrivePerTile: 15,
    overdrive: {
      damage: 20,
      armor: 4,
      upcharge: 2,
      shield: 0,
      damageBoostPct: 0,
      cleanseCorrode: 0,
    },
  },
  zuri: {
    id: 'zuri',
    maxHp: 64,
    startingArmor: 0,
    dudUpchargePerTile: 0,
    dudArmorPerTile: 0,
    dudOverdrivePerTile: 0,
    startingCredits: 50,
    memoryCapacity: ZURI_MEMORY_CAPACITY,
    heldTileBonus: 0,
    attackOverdrivePerTile: 4,
    defenseOverdrivePerTile: 4,
    techOverdrivePerTile: 20,
    triDroneSync: {
      attackPierceDamage: 4,
      defenseShield: 7,
      techHeal: 4,
    },
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
  { type: 'attack', value: 4 },
  { type: 'attack', value: 3 },
  { type: 'defense', value: 6 },
  { type: 'defense', value: 5 },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
  },
];

const AURALINE_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 5 },
  { type: 'attack', value: 2, isDud: true, isReactorCore: true },
  { type: 'defense', value: 8 },
  { type: 'defense', value: 3, isDud: true, isReactorCore: true },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 15, decayPerTurn: 10 },
    isDud: true,
    isReactorCore: true,
  },
];

const ZURI_INNATE_TILES: readonly TileSpec[] = [
  { type: 'attack', value: 4 },
  { type: 'defense', value: 8 },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'tactical_shield', shieldAmount: 7, damageBoostPct: 24 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'armor_shred', shredAmount: 8, pierceDamage: 3 },
  },
  {
    type: 'tech',
    value: 0,
    techEffect: { kind: 'damage_boost', percent: 36, decayPerTurn: 10 },
  },
];

export function getInnateTilesForCharacter(characterId: CharacterId = 'kira'): readonly TileSpec[] {
  if (characterId === 'auraline') return AURALINE_INNATE_TILES;
  if (characterId === 'zuri') return ZURI_INNATE_TILES;
  return KIRA_INNATE_TILES;
}

export const SKILL_CHIP_CATALOG: SkillChipDefinition[] = [
  {
    id: 'predictive_aim',
    category: 'weapon',
    memoryCost: 2,
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
    id: 'auto_suture',
    category: 'med',
    memoryCost: 1,
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
    id: 'impact_solver',
    category: 'weapon',
    memoryCost: 3,
    price: 36,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'sovereign_ward',
    category: 'armor',
    memoryCost: 1,
    price: 24,
    rarity: 'starter',
    droppable: false,
    tiles: [{ type: 'defense', value: 7 }],
  },
  {
    id: 'swarm_vector',
    category: 'weapon',
    memoryCost: 2,
    price: 34,
    rarity: 'starter',
    droppable: false,
    tiles: [
      { type: 'attack', value: 6 },
      { type: 'attack', value: 5 },
    ],
  },
  {
    id: 'sanctuary_mesh',
    category: 'tech',
    memoryCost: 2,
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
    id: 'volley_matrix',
    category: 'weapon',
    memoryCost: 4,
    price: 45,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'attack', value: 7 },
      { type: 'attack', value: 7 },
      { type: 'attack', value: 5 },
    ],
  },
  {
    id: 'zero_trust_wall',
    category: 'armor',
    memoryCost: 3,
    price: 35,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'defense', value: 9 },
      { type: 'defense', value: 9 },
    ],
  },
  {
    id: 'trauma_patch',
    category: 'med',
    memoryCost: 2,
    price: 30,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'tech', value: 0, techEffect: { kind: 'heal', amount: 5 } },
      { type: 'defense', value: 6 },
    ],
  },
  {
    id: 'kill_chain_amp',
    category: 'tech',
    memoryCost: 2,
    price: 40,
    rarity: 'prototype',
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
    id: 'apex_overwhelm',
    category: 'weapon',
    memoryCost: 5,
    price: 48,
    rarity: 'prototype',
    droppable: true,
    tiles: [
      { type: 'attack', value: 9 },
      { type: 'attack', value: 9 },
      { type: 'defense', value: 7 },
    ],
  },
  {
    id: 'surgical_cut',
    category: 'weapon',
    memoryCost: 2,
    price: 34,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'attack', value: 7 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'system_scrub',
    category: 'tech',
    memoryCost: 2,
    price: 32,
    rarity: 'standard',
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
    id: 'armor_crack',
    category: 'weapon',
    memoryCost: 3,
    price: 46,
    rarity: 'prototype',
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
    id: 'flux_rebalance',
    category: 'tech',
    memoryCost: 2,
    price: 38,
    rarity: 'prototype',
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
    id: 'adaptive_guard',
    category: 'armor',
    memoryCost: 4,
    price: 48,
    rarity: 'prototype',
    droppable: true,
    tiles: [
      { type: 'defense', value: 10 },
      { type: 'defense', value: 8 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'tempo_feed',
    category: 'tech',
    memoryCost: 2,
    price: 34,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'attack', value: 5, upcharge: 1 },
      { type: 'defense', value: 6 },
    ],
  },
  {
    id: 'synapse_loop',
    category: 'tech',
    memoryCost: 2,
    price: 38,
    rarity: 'standard',
    droppable: true,
    tiles: [
      { type: 'tech', value: 0, techEffect: { kind: 'heal', amount: 3 }, upcharge: 1 },
      { type: 'attack', value: 6 },
    ],
  },
  {
    id: 'hyper_thread',
    category: 'tech',
    memoryCost: 3,
    price: 42,
    rarity: 'prototype',
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

export const SKILL_CHIPS_BY_ID: Record<string, SkillChipDefinition> = Object.fromEntries(
  SKILL_CHIP_CATALOG.map((item) => [item.id, item]),
);

export function getSkillChipDef(defId: string): SkillChipDefinition | undefined {
  return SKILL_CHIPS_BY_ID[defId];
}

export const DROPPABLE_SKILL_CHIP_IDS: string[] = SKILL_CHIP_CATALOG.filter((e) => e.droppable).map(
  (e) => e.id,
);

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

export interface EnemyTemplate {
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
      { kind: 'pause', value: 0 },
      { kind: 'attack', value: 4 },
    ],
  },
  skitter: {
    archetype: 'skitter',
    maxHp: 14,
    startingArmor: 2,
    startingShieldPips: 1,
    passive: 'none',
    roleColor: 'blue',
    intentCycle: [
      { kind: 'bolster', value: 4 },
      { kind: 'attack', value: 5 },
      { kind: 'pause', value: 0 },
    ],
  },
  stinger: {
    archetype: 'stinger',
    maxHp: 16,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'none',
    roleColor: 'orange',
    intentCycle: [
      { kind: 'charge', value: 7, secondaryValue: 2, overwhelmMultiplier: 2 },
      { kind: 'charge', value: 7, secondaryValue: 1, overwhelmMultiplier: 2 },
      { kind: 'heavy', value: 7, overwhelmMultiplier: 2 },
    ],
  },
  stalker: {
    archetype: 'stalker',
    maxHp: 24,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'none',
    roleColor: 'crimson',
    intentCycle: [
      { kind: 'pause', value: 0 },
      { kind: 'attack', value: 5, pierceShield: true },
      { kind: 'attack', value: 7 },
    ],
  },
  spitter: {
    archetype: 'spitter',
    maxHp: 22,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'none',
    roleColor: 'violet',
    intentCycle: [
      { kind: 'pause', value: 0 },
      { kind: 'acid', value: 5, secondaryValue: 2 },
      { kind: 'acid', value: 6, secondaryValue: 2, topDeckBlight: true },
    ],
  },
  mutdog: {
    archetype: 'mutdog',
    maxHp: 20,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'none',
    roleColor: 'lime',
    intentCycle: [
      { kind: 'attack', value: 5, clawRend: true },
      { kind: 'attack', value: 6, overwhelmMultiplier: 2 },
      { kind: 'pause', value: 0 },
    ],
  },
  feral_nurse: {
    archetype: 'feral_nurse',
    maxHp: 17,
    startingArmor: 0,
    startingShieldPips: 0,
    passive: 'none',
    roleColor: 'crimson',
    intentCycle: [
      { kind: 'cloak', value: 0 },
      { kind: 'charge', value: 7, secondaryValue: 1, pierceShield: true },
      { kind: 'attack', value: 7, pierceShield: true, clawRend: true },
    ],
  },
  brute: {
    archetype: 'brute',
    maxHp: 38,
    startingArmor: 6,
    startingShieldPips: 1,
    passive: 'none',
    roleColor: 'gold',
    intentCycle: [
      { kind: 'armor', value: 6 },
      { kind: 'heavy', value: 6, overwhelmMultiplier: 2 },
      { kind: 'pause', value: 0 },
    ],
  },
  boss: {
    archetype: 'boss',
    maxHp: 104,
    startingArmor: 8,
    startingShieldPips: 1,
    passive: 'phase_gate',
    roleColor: 'apex',
    phaseGatePct: 50,
    intentCycle: [
      { kind: 'armor', value: 8 },
      { kind: 'attack', value: 12 },
      { kind: 'acid', value: 8, secondaryValue: 2, topDeckBlight: true },
      { kind: 'heavy', value: 16 },
    ],
  },
};
