import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CharacterId, CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import type { BruteJuiceConfig } from '../../utils/bruteJuiceController';
import type { DevLabTabId } from '../../utils/devLabMode';
import type { FeralNurseJuiceConfig } from '../../utils/feralNurseJuiceController';
import type { MutdogJuiceConfig } from '../../utils/mutdogJuiceController';
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
  mutdogLabActive: boolean;
  mutdogJuiceConfig: MutdogJuiceConfig;
  feralNurseLabActive: boolean;
  feralNurseJuiceConfig: FeralNurseJuiceConfig;
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
  initialLab?: DevLabTabId | null;
  activeHeroId?: CharacterId;
  onSwitchHero?: (charId: CharacterId) => void;
}
