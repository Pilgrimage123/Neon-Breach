/**
 * @file mutdogJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Rabid MutDog (`mutdog`).
 */

export {
  type MutdogJuiceTrigger,
  type MutdogJuiceConfig,
  DEFAULT_MUTDOG_JUICE_CONFIG,
  type MutdogControlPointKnot,
  type MutdogMeshDeform,
  type MutdogJuiceState,
  type MutdogJuiceSample,
  type MutdogCombatSyncInput,
  createMutdogJuiceState,
  applyMutdogSquash,
  triggerMutdogJuiceState,
} from './mutdogJuiceState';
export { stepMutdogJuice } from './mutdogJuiceStepper';
