export {
  MAX_ACTIVE_BRIDGE_ENEMIES,
  computePlayerMetaPower,
  getEffectiveEnemyIntentValue,
  getEnemySlotSpan,
  getHeatStageForTurn,
  getOccupiedBridgeSlotCount,
  isIntentConditionMet,
  type EnemyIntentContext,
} from './directorBridgeIntents';
export {
  createCombatDirector,
  createReinforcementUnit,
  findOpenBridgeSlot,
  pickReinforcementArchetype,
} from './directorSpawner';
export { updateDirectorAfterPlayerAction } from './directorReactivePhase';
export {
  advanceDirectorAtRoundEnd,
  computeVictoryDirectorRewards,
} from './directorRoundProgression';
