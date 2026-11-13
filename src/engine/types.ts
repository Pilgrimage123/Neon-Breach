export type TileType = 'attack' | 'defense' | 'tech';

export type TechEffect =
  | { kind: 'damage_boost'; percent: number; decayPerTurn: number }
  | { kind: 'heal'; amount: number };

export interface TileSpec {
  type: TileType;
  value: number;
  techEffect?: TechEffect;
}

export interface Tile {
  id: string;
  type: TileType;
  sourceId: string;
  value: number;
  techEffect?: TechEffect;
  isHeldFromPrevTurn: boolean;
}

export type EquipmentCategory = 'weapon' | 'armor' | 'med' | 'tech';

export interface EquipmentDefinition {
  id: string;
  category: EquipmentCategory;
  size: number;
  price: number;
  rarity: 'starter' | 'common' | 'rare';
  droppable: boolean;
  tiles: TileSpec[];
}

export interface OwnedEquipment {
  instanceId: string;
  defId: string;
}

export type EnemyArchetype = 'stalker' | 'spitter' | 'brute' | 'boss';

export type IntentKind = 'attack' | 'acid' | 'armor' | 'leech' | 'heavy';

export interface EnemyIntent {
  kind: IntentKind;
  value: number;
  secondaryValue?: number;
}

export interface EnemyUnit {
  id: string;
  archetype: EnemyArchetype;
  hp: number;
  maxHp: number;
  armor: number;
  intentCycle: EnemyIntent[];
  currentIntentIndex: number;
}

export type CyberImplantId =
  | 'monowire_edge'
  | 'aegis_capacitor'
  | 'synapse_overclock'
  | 'kinetic_reflector'
  | 'plasma_amp'
  | 'nano_weave'
  | 'surge_resonator'
  | 'bio_siphon'
  | 'flux_injector'
  | 'piercing_katana';

export interface CyberImplant {
  id: CyberImplantId;
  rarity: 'common' | 'rare';
}

export type MapNodeType = 'COMBAT' | 'ELITE' | 'CYBER_CLINIC' | 'MED_BAY' | 'BOSS';

export interface MapNode {
  id: string;
  layer: number;
  lane: number;
  type: MapNodeType;
  nextIds: string[];
  cleared: boolean;
}

export interface HeroineState {
  hp: number;
  maxHp: number;
  shield: number;
  overdrive: number;
  corrode: number;
  damageBoostPct: number;
  implants: CyberImplantId[];
  carryCapacity: number;
  ownedEquipment: OwnedEquipment[];
  equippedInstanceIds: string[];
  credits: number;
}

export interface AnimationCue {
  id: string;
  kind:
    | 'hero_slash'
    | 'hero_shield'
    | 'hero_tech'
    | 'hero_overdrive'
    | 'enemy_attack'
    | 'enemy_acid'
    | 'enemy_armor'
    | 'enemy_ko';
  targetId?: string;
  value?: number;
  textLabel?: string;
  surge?: boolean;
  blocked?: number;
  hpDamage?: number;
  reflectedDamage?: number;
}

export interface TurnPreview {
  color: TileType;
  tileCount: number;
  stayCount: number;
  baseDamage: number;
  damageBoostPct: number;
  totalDamage: number;
  cleaveDamage: number;
  armorPiercing: boolean;
  shieldGained: number;
  damageBoostAddedPct: number;
  healAmount: number;
  overdriveGained: number;
  surgeTriggered: boolean;
  surgeThreshold: number;
  reflectOnBlock: number;
}

export interface HeroineThreatPreview {
  rawIncomingDamage: number;
  blockedDamage: number;
  hpDamageTaken: number;
  hpLossOnBar: number;
  healGained: number;
  shieldAfterPlayer: number;
  shieldAfterEnemies: number;
  hpBeforeEnemies: number;
  projectedHp: number;
  corrodeGained: number;
  attackersCount: number;
  preventedDamageByKills: number;
  willDie: boolean;
}

export type CombatPhase = 'PLAYER_IDLE' | 'PLAYER_RESOLVED' | 'ENEMY_ACTING' | 'VICTORY' | 'DEFEAT';

export interface CombatState {
  nodeId: string;
  nodeType: MapNodeType;
  turn: number;
  phase: CombatPhase;
  board: Tile[];
  drawPile: Tile[];
  discardPile: Tile[];
  enemies: EnemyUnit[];
  lastCues: AnimationCue[];
  totalDamageDealt: number;
  totalTilesResolved: number;
  rewardCredits: number;
  rewardEquipmentChoices: string[];
}

export type ScreenPhase = 'title' | 'map' | 'combat' | 'clinic' | 'medbay' | 'victory' | 'gameover';

export interface RunState {
  runId: string;
  seed: number;
  screen: ScreenPhase;
  heroine: HeroineState;
  masterPool: Tile[];
  mapNodes: MapNode[];
  currentNodeId: string | null;
  combat: CombatState | null;
  clinicChoices: CyberImplantId[];
  clinicShopChoices: string[];
  enemiesDefeated: number;
  turnsCompleted: number;
  score: number;
}

export interface BestRunRecord {
  bestScore: number;
  sectorsCleared: number;
  totalRuns: number;
}
