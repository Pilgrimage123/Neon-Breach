/**
 * @file feralNurseJuiceController.ts
 * Modular 4-Layer Procedural Animation & "Juice" Physics System for the Feral Nurse (`feral_nurse`).
 */

export {
  type FeralNurseJuiceTrigger,
  type FeralNurseJuiceConfig,
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseControlPointKnot,
  type FeralNurseMeshDeform,
  type FeralNurseJuiceState,
  type FeralNurseJuiceSample,
  type FeralNurseCombatSyncInput,
  createFeralNurseJuiceState,
  applyFeralNurseSquash,
  triggerFeralNurseJuiceState,
} from './feralNurseJuiceState';
export { stepFeralNurseJuice } from './feralNurseJuiceStepper';
