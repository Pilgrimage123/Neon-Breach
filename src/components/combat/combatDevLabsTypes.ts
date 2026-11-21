import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import type { BruteJuiceConfig } from '../../utils/bruteJuiceController';
import type { SpitterJuiceConfig } from '../../utils/spitterJuiceController';
import type { DevLabRenderPassContext } from './combatDevLabRenderer';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import type { CombatStageSim } from './combatStageTypes';

export type CameraLabTriggerKind =
  | 'idle'
  | 'melee_normal'
  | 'melee_crit'
  | 'ranged_single'
  | 'ranged_aoe'
  | 'kira_dodge';

export interface CombatDevLabsRuntimeState {
  spitterLabActive: boolean;
  spitterJuiceConfig: SpitterJuiceConfig;
  bruteLabActive: boolean;
  bruteJuiceConfig: BruteJuiceConfig;
  cameraLabActive: boolean;
  presentationConfig: CombatPresentationConfig;
  devLabRenderer?: (ctx: DevLabRenderPassContext) => void;
}

export interface CombatDevLabsPanelProps {
  simRef: MutableRefObject<CombatStageSim | null>;
  combatRef: MutableRefObject<CombatState>;
  heroRef: MutableRefObject<HeroState>;
  tacticalViewRef: MutableRefObject<boolean>;
  labRuntimeRef: MutableRefObject<CombatDevLabsRuntimeState>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  toolbarMountNode: HTMLElement | null;
  requestDraw: () => void;
  onExtraArchetypesChange: Dispatch<SetStateAction<EnemyArchetype[]>>;
}
