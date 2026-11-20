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
  isDud?: boolean;
  upcharge?: number;
  secondaryType?: TileType;
  secondaryValue?: number;
}

export interface Tile {
  id: string;
  type: TileType;
  sourceId: string;
  value: number;
  techEffect?: TechEffect;
  isDud?: boolean;
  upcharge?: number;
  secondaryType?: TileType;
  secondaryValue?: number;
  isHeldFromPrevTurn: boolean;
  isJammed?: boolean;
  isBlight?: boolean;
  isTopDecked?: boolean;
  hexedByEnemyId?: string;
  isHotPotato?: boolean;
  isContagion?: boolean;
  isTemptation?: boolean;
  pierceBoost?: boolean;
  shieldAuraBonus?: number;
}

export type SkillChipCategory = 'weapon' | 'armor' | 'med' | 'tech';

export interface SkillChipDefinition {
  id: string;
  category: SkillChipCategory;
  memoryCost: number;
  price: number;
  rarity: 'starter' | 'standard' | 'prototype';
  droppable: boolean;
  tiles: TileSpec[];
}

export interface OwnedSkillChip {
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

export type EnemyPropKind = 'plasma_barrel' | 'decoy_totem' | 'bio_husk';

export type BattlefieldRuleKind = 'volatile_atmosphere' | 'magnetic_surge';

export interface EnemyIntent {
  kind: IntentKind;
  value: number;
  secondaryValue?: number;
  condition?: IntentConditionKind;
  conditionBonus?: number;
  topDeckBlight?: boolean;
  corrodeAmount?: number;
  armorOnHit?: number;
  clawRend?: boolean;
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
  weaponBroken?: boolean;
  desperationEnraged?: boolean;
  sleepCounter?: number;
  isLootRunner?: boolean;
  escapeTurnsLeft?: number;
  bountyCredits?: number;
  escaped?: boolean;
  isMercyTarget?: boolean;
  propKind?: EnemyPropKind;
  reviveTimer?: number;
  reviveArchetype?: EnemyArchetype;
  reviveMaxHp?: number;
  huskSpawned?: boolean;
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

export type MapNodeType = 'COMBAT' | 'ELITE' | 'CYBER_CLINIC' | 'CHIP_DEALER' | 'MED_BAY' | 'BOSS' | 'EVENT';

export type NodeModifier =
  | 'golden_bounty'
  | 'double_credits'
  | 'nanite_cache'
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

export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

export type DynastyDistrictBadge =
  | 'stork_nursery'
  | 'pedigree_lab'
  | 'charter_academy'
  | 'open_fablab'
  | 'upcycle_kiosk'
  | 'smart_hearth'
  | 'rooftop_cafe'
  | 'suburban_dome'
  | 'nanny_showroom'
  | 'beta_arcade'
  | 'heirloom_forge'
  | 'matchmakers_gala'
  | 'mutual_aid_coop'
  | 'synth_rave'
  | 'mesh_relay'
  | 'ar_graffiti_wall'
  | 'vanguard_escort'
  | 'data_liberation'
  | 'maglev_hub';

export interface MapNode {
  id: string;
  layer: number;
  lane: number;
  type: MapNodeType;
  nextIds: string[];
  cleared: boolean;
  modifier?: NodeModifier;
  isBreatherNode?: boolean;
  districtBadge?: DynastyDistrictBadge;
}

export type CharacterId = 'kira' | 'auraline' | 'zuri';

export type NannyBotId = 'guardian_nanny' | 'caretaker_nanny' | 'tutor_nanny';

export interface IncubatingPodState {
  tile: Tile;
  nodesRemaining: number;
  inheritedTrait: 'upcharge' | 'pierce_boost' | 'shield_aura';
}

export interface BloodlineCrestState {
  primary: TileType;
  secondary: TileType;
  bonusValue: number;
}

export interface ActiveTempoRuleState {
  id: 'algo_rave_surge' | 'kids_vitality_boost' | 'bandwidth_vow';
  nodesRemaining: number;
}

export interface CradleObjectiveState {
  name: string;
  hp: number;
  maxHp: number;
  turnsSurvived: number;
  targetTurns: number;
  liberated: boolean;
}

export interface HeroState {
  characterId?: CharacterId;
  hp: number;
  maxHp: number;
  armor?: number;
  shield: number;
  overdrive: number;
  corrode: number;
  damageBoostPct: number;
  pendingUpcharge?: number;
  implants: CyberImplantId[];
  memoryCapacity: number;
  ownedChips: OwnedSkillChip[];
  equippedInstanceIds: string[];
  nextChipInstanceSeq?: number;
  purgedInnateIds?: string[];
  credits: number;
  nanites?: number;
  consecutiveCombatWithoutClinic?: number;
  emergencyDefibUsed?: boolean;
  overclockCount?: number;
  incubatingTile?: IncubatingPodState | null;
  maturedNextGenTiles?: Record<
    string,
    { bonusMultiplier: number; inheritedTrait: 'upcharge' | 'pierce_boost' | 'shield_aura' }
  >;
  bloodlineCrest?: BloodlineCrestState | null;
  prodigyTileIds?: string[];
  splicedTilePairs?: Array<{
    targetId: string;
    consumedId: string;
    bonusValue: number;
    bonusUpcharge: number;
    secondaryType?: TileType;
    secondaryValue?: number;
  }>;
  heirloomEngravedId?: string | null;
  heirloomStacks?: number;
  nannyBotInstalled?: NannyBotId | null;
  betaTrialChip?: {
    defId: string;
    instanceId?: string;
    combatsRemaining: number;
    resolvesLogged: number;
    upgraded: boolean;
  } | null;
  activeTempoRule?: ActiveTempoRuleState | null;
  familyEstates?: number[];
  meshReroutesUsed?: number;
  maglevUsed?: boolean;
  scionAlliedHouse?: 'house_solaris' | 'house_valkyr' | null;
  dynastyRelicUnlocked?: boolean;
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
  rewardScionHouse?: 'house_solaris' | 'house_valkyr';
  rewardFreeImplant?: boolean;
  rewardHeirloomStacks?: number;
  applyTempoRule?: 'algo_rave_surge' | 'kids_vitality_boost' | 'bandwidth_vow';
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
    | 'enemy_pustule_rupture'
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
  armorDamage?: number;
  hpDamage?: number;
  reflectedDamage?: number;
  jammed?: boolean;
  clawRend?: boolean;
  heavySmash?: boolean;
  secondaryHeal?: number;
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
  pustuleRuptureCorrode?: number;
  hexedHealBonus?: number;
  hexedArmorBonus?: number;
  blightPurgeCount?: number;
  hotPotatoPassedDamage?: number;
  contagionDiscardedCount?: number;
  temptationCleaveBonus?: number;
  upchargeGained?: number;
  dudCount?: number;
}

export interface HeroThreatPreview {
  rawIncomingDamage: number;
  blockedDamage: number;
  hpDamageTaken: number;
  hpLossOnBar: number;
  healGained: number;
  shieldAfterPlayer: number;
  shieldAfterEnemies: number;
  armorAfterPlayer?: number;
  armorAfterEnemies?: number;
  armorAbsorbed?: number;
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
  hotPotatoSelfDamage?: number;
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
  heroHpAtTurnStart: number;
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
  rewardChipChoices: string[];
  director?: CombatDirectorState;
  rewardBreakdown?: RewardBreakdown;
  lastColorPlayed?: TileType | null;
  startingHeroHp?: number;
  committedUndosUsed?: number;
  battleResetsUsed?: number;
  failedAttempts?: number;
  mandateBreachPenaltyHp?: number;
  mandateBreachLootConfiscated?: boolean;
  battlefieldRule?: BattlefieldRuleKind;
  tugOfWarMeter?: number;
  tugOfWarPurged?: boolean;
  mercyBonusAwarded?: boolean;
  lootBountyAwarded?: number;
  edgeLockActive?: boolean;
  cradleObjective?: CradleObjectiveState;
  bloodlineResonanceActive?: TileType | null;
}

export type ScreenPhase = 'title' | 'map' | 'combat' | 'clinic' | 'chip_dealer' | 'medbay' | 'event' | 'victory' | 'gameover';

export interface RunState {
  runId: string;
  seed: number;
  difficultyTier?: DifficultyTier;
  runResetsUsed?: number;
  screen: ScreenPhase;
  hero: HeroState;
  masterPool: Tile[];
  mapNodes: MapNode[];
  currentNodeId: string | null;
  combat: CombatState | null;
  clinicChoices: CyberImplantId[];
  chipDealerChoices: string[];
  chipDealerHeirloomUsed?: boolean;
  clinicPurgeUsed?: boolean;
  enemiesDefeated: number;
  turnsCompleted: number;
  score: number;
  activeEvent?: CyberEvent | null;
}

export interface BestRunRecord {
  bestScore: number;
  stagesCleared: number;
  totalRuns: number;
  totalNanites?: number;
  inheritedHeirloom?: { defId: string; bonusStacks: number } | null;
}
