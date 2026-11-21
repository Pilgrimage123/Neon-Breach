import type { AnimationCue, CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import type { CameraActorBounds } from './ActionCameraController';
import { dispatchEnemyAttackCue } from './combatEnemyAttackCues';
import { dispatchEnemyStatusCue } from './combatEnemyStatusCues';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import type { CombatStageSim } from './combatStageTypes';
import type { WeaponDecalKind } from './mutantBlood';

export interface EnemyCueDispatchContext {
  sim: CombatStageSim;
  combat: CombatState;
  hero: HeroState;
  cues: readonly AnimationCue[];
  batchKey: string;
  w: number;
  h: number;
  groundY: number;
  heroX: number;
  enemyBaseX: number;
  enemyStepX: number;
  dropCenters: readonly number[];
  presCfg: CombatPresentationConfig;
  tacticalViewActive: boolean;
  tempoScale: number;
  koIds: ReadonlySet<string>;
  allActorIds: string[];
  primarySlashCue: AnimationCue | undefined;
  hasOverdrive: boolean;
  getEnemyArch: (targetId?: string) => EnemyArchetype;
  getEnemyPos: (targetId?: string) => { x: number; y: number; groundY: number };
  buildActorBounds: (actorId: string) => CameraActorBounds;
  triggerEnemyKo: (enemyId: string, weaponKind?: WeaponDecalKind, plasmaColor?: string) => void;
}

export function dispatchEnemyCombatCue(
  cue: AnimationCue,
  ctx: EnemyCueDispatchContext,
  state: { cutInStarted: boolean; kiraDodgeScheduled: boolean },
): void {
  if (cue.kind === 'enemy_attack' || cue.kind === 'enemy_acid') {
    dispatchEnemyAttackCue(cue, ctx, state);
    return;
  }
  dispatchEnemyStatusCue(cue, ctx, state);
}
