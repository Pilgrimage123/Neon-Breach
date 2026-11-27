/**
 * @file spitterJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Bile Spitter (`spitter`).
 */

export {
  type SpitterJuiceTrigger,
  type SpitterJuiceConfig,
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterControlPointKnot,
  type SpitterMeshDeform,
  type SpitterJuiceState,
  type SpitterJuiceSample,
  type SpitterCombatSyncInput,
  createSpitterJuiceState,
  applySpitterSquash,
  triggerSpitterJuiceState,
} from './spitterJuiceState';
export { stepSpitterJuice } from './spitterJuiceStepper';
