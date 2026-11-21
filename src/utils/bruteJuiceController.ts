/**
 * @file bruteJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Carapace Brute (`brute`).
 */

export {
  type BruteJuiceTrigger,
  type BruteJuiceConfig,
  DEFAULT_BRUTE_JUICE_CONFIG,
  type BruteControlPointKnot,
  type BruteMeshDeform,
  type BruteJuiceState,
  type BruteJuiceSample,
  type BruteCombatSyncInput,
  createBruteJuiceState,
  applyBruteSquash,
  triggerBruteJuiceState,
} from './bruteJuiceState';
export { stepBruteJuice } from './bruteJuiceStepper';
