export type TileType = 'attack' | 'defense' | 'tech';

export type TechEffect =
  | { kind: 'damage_boost'; percent: number; decayPerTurn: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'armor_shred'; shredAmount: number; pierceDamage: number }
  | { kind: 'overdrive_surge'; bonusOverdrive: number; cleanseCorrode: number }
  | { kind: 'tactical_shield'; shieldAmount: number; damageBoostPct: number };

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
  isJammed?: boolean;
  isBlight?: boolean;
  hexedByEnemyId?: string;
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

export type EnemyArchetype =
  | 'larva'
  | 'skitter'
  | 'stinger'
  | 'stalker'
  | 'spitter'
  | 'brute'
  | 'boss';

export type IntentKind = 'attack' | 'acid' | 'armor' | 'bolster' | 'charge' | 'leech' | 'heavy';

export type EnemyPassiveKind =
  | 'volatile_burst'
  | 'anchor_aegis'
  | 'time_bomb'
  | 'spike_retaliate'
  | 'acid_jam'
  | 'threshold_pip'
  | 'phase_gate';

export type EnemyRoleColor = 'lime' | 'blue' | 'orange' | 'crimson' | 'violet' | 'gold' | 'apex';

export type IntentConditionKind = 'if_no_shield' | 'if_play_attack' | 'if_play_tech';

export interface EnemyIntent {
  kind: IntentKind;
  value: number;
  secondaryValue?: number;
  condition?: IntentConditionKind;
  conditionBonus?: number;
}

export interface EnemyUnit {
  id: string;
  archetype: EnemyArchetype;
  hp: number;
  maxHp: number;
  armor: number;
  shieldPips: number;
  maxShieldPips: number;
  passive: EnemyPassiveKind;
  roleColor: EnemyRoleColor;
  phaseGatePct?: number;
  phaseGateTriggered?: boolean;
  intentCycle: EnemyIntent[];
  currentIntentIndex: number;
  enrageAtkBonus?: number;
  enragedAlone?: boolean;
  staggered?: boolean;
  turnDamageTaken?: number;
  turnsWithoutDamage?: number;
  sosCharging?: boolean;
  isReinforcement?: boolean;
  isZeroReward?: boolean;
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

export type MapNodeType = 'COMBAT' | 'ELITE' | 'CYBER_CLINIC' | 'MED_BAY' | 'BOSS' | 'EVENT';

export type NodeModifier =
  | 'golden_bounty'
  | 'double_credits'
  | 'nanite_cache'
  | 'high_threat'
  | 'overcharged_hazard'
  | 'flash_sale'
  | 'funded_clinic';

export interface NodeEconomyMetrics {
  tensionHpPct: number;
  tensionHpEst: number;
  runYieldCredits: number;
  runYieldPowerRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  metaYieldNanites: number;
  opportunityCost: string;
}

export type LaneClusterArchetype = 'gauntlet' | 'mercenary' | 'gambler';

export interface LaneClusterProfile {
  lane: number;
  archetype: LaneClusterArchetype;
  name: string;
  tagline: string;
  tensionRating: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  yieldRating: 'BALANCED' | 'HIGH_WEALTH' | 'HIGH_META' | 'HIGH_VARIANCE';
  totalTensionHpEst: number;
  totalRunYieldCredits: number;
  totalMetaYieldNanites: number;
}

export interface MapNode {
  id: string;
  layer: number;
  lane: number;
  type: MapNodeType;
  nextIds: string[];
  cleared: boolean;
  modifier?: NodeModifier;
}

export type CharacterId = 'kira' | 'aurelia' | 'zuri';

export interface HeroineState {
  characterId?: CharacterId;
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
  nanites?: number;
  consecutiveCombatWithoutClinic?: number;
  emergencyDefibUsed?: boolean;
}

export interface CyberEventChoice {
  id: string;
  label: string;
  description: string;
  costCredits?: number;
  hpCost?: number;
  rewardCredits?: number;
  rewardNanites?: number;
  rewardHp?: number;
  rewardOverdrive?: number;
  rewardDamageBoostPct?: number;
}

export interface CyberEvent {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  choices: CyberEventChoice[];
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
    | 'enemy_bolster'
    | 'enemy_charge'
    | 'enemy_phase_gate'
    | 'enemy_burst'
    | 'enemy_retaliate'
    | 'enemy_ko'
    | 'enemy_telegraph'
    | 'enemy_reinforce'
    | 'enemy_enrage'
    | 'enemy_stagger'
    | 'tile_hex'
    | 'tile_blight'
    | 'heat_jam';
  targetId?: string;
  value?: number;
  textLabel?: string;
  surge?: boolean;
  blocked?: number;
  hpDamage?: number;
  reflectedDamage?: number;
  jammed?: boolean;
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
  armorShredAmount: number;
  techPierceDamage: number;
  cleanseCorrodeAmount: number;
  retaliateDamage: number;
  hexedHealBonus?: number;
  hexedArmorBonus?: number;
  blightPurgeCount?: number;
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
  retaliateDamage: number;
  willJamTile: boolean;
  willDie: boolean;
  conditionalBonusDamage?: number;
  blightChipDamage?: number;
  hexHealTriggered?: number;
}

export type CombatPhase = 'PLAYER_IDLE' | 'PLAYER_RESOLVED' | 'ENEMY_ACTING' | 'VICTORY' | 'DEFEAT';

export type HeatStage = 'low' | 'medium' | 'overtime';

export type ReinforcementReason =
  | 'threat_pool'
  | 'reactive'
  | 'adaptive'
  | 'sos_flare'
  | 'sweeper';

export interface PendingReinforcement {
  id: string;
  archetype: EnemyArchetype;
  slotIndex: number;
  turnsUntilDrop: number;
  reason: ReinforcementReason;
  isZeroReward?: boolean;
  hpBonus?: number;
  armorBonus?: number;
}

export interface ParCacheState {
  tier: 1 | 2 | 3;
  maxTurn: number;
  creditReward: number;
  intact: boolean;
}

export interface CombatDirectorState {
  playerMetaPower: number;
  threatPool: number;
  threatRatePerTurn: number;
  heatStage: HeatStage;
  mediumTurnThreshold: number;
  overtimeTurnThreshold: number;
  parCaches: ParCacheState[];
  tempoStreak: number;
  maxTempoStreak: number;
  tempoCreditsEarned: number;
  fastClearBonusCredits: number;
  compositionCounts: {
    attack: number;
    defense: number;
    tech: number;
    surges: number;
  };
  damageDealtThisTurn: number;
  lastRoundHpLost: number;
  heroineHpAtRoundStart: number;
  rubberBandDelayed: boolean;
  maxReinforcementsSpawned: number;
  reinforcementsSpawnedCount: number;
  pendingReinforcements: PendingReinforcement[];
  overtimeHazardApplied: boolean;
  totalSpawnSequence: number;
}

export interface RewardBreakdown {
  baseCredits: number;
  parCacheCredits: number;
  intactParCount: number;
  tempoCredits: number;
  fastClearCredits: number;
}

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
  director?: CombatDirectorState;
  rewardBreakdown?: RewardBreakdown;
  lastColorPlayed?: TileType | null;
}

export type ScreenPhase = 'title' | 'map' | 'combat' | 'clinic' | 'medbay' | 'event' | 'victory' | 'gameover';

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
  activeEvent?: CyberEvent | null;
}

export interface BestRunRecord {
  bestScore: number;
  sectorsCleared: number;
  totalRuns: number;
  totalNanites?: number;
}
