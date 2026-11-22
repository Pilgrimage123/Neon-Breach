import type { Dispatch, SetStateAction } from 'react';
import type {
  CharacterId,
  CombatState,
  HeroState,
  HeroThreatPreview,
  PendingReinforcement,
  TurnPreview,
} from '../../engine/types';
import type { GlossaryTermId } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import type { CodexTab } from '../CodexModal';
import { CombatEnemyHudCards } from './CombatEnemyHudCards';
import { CombatHeroHeaderPod } from './CombatHeroHeaderPod';
import { CombatUnitInspectDrawer } from './CombatUnitInspectDrawer';
import { computeSequentialEnemyHudState } from './combatHudState';
import type { RendererMode } from './stageSpriteAdapter';

export { computeSequentialEnemyHudState };

export interface CombatStageHudOverlayProps {
  combat: CombatState;
  hero: HeroState;
  lang: Language;
  activePreview: TurnPreview | null;
  heroThreat: HeroThreatPreview;
  frontLivingIdx: number;
  isCompactLandscape: boolean;
  tacticalView: boolean;
  highContrastBorders: boolean;
  quantizedScaleMode: boolean;
  revealDropArchetype: boolean;
  revealEnemyFutureCycle?: boolean;
  rendererMode: RendererMode;
  setRendererMode: Dispatch<SetStateAction<RendererMode>>;
  debugMeshWireframe: boolean;
  setDebugMeshWireframe: Dispatch<SetStateAction<boolean>>;
  inspectedTarget: 'hero' | string | null;
  setInspectedTarget: Dispatch<SetStateAction<'hero' | string | null>>;
  setHoveredEnemyId: Dispatch<SetStateAction<string | null>>;
  onOpenCodex?: (tab: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
  setDevToolbarMountNode?: (el: HTMLElement | null) => void;
  sequentialHudStates: ReturnType<typeof computeSequentialEnemyHudState>;
}

export function CombatStageHudOverlay({
  combat,
  hero,
  lang,
  activePreview,
  heroThreat,
  isCompactLandscape,
  tacticalView,
  highContrastBorders,
  quantizedScaleMode,
  revealDropArchetype,
  revealEnemyFutureCycle = true,
  rendererMode,
  setRendererMode,
  debugMeshWireframe,
  setDebugMeshWireframe,
  inspectedTarget,
  setInspectedTarget,
  setHoveredEnemyId,
  onOpenCodex,
  setDevToolbarMountNode,
  sequentialHudStates,
}: CombatStageHudOverlayProps) {
  const t = TRANSLATIONS[lang];
  const charId: CharacterId = hero.characterId ?? 'kira';
  const charMeta = t.characters[charId];
  const director = combat.director;
  const pendingDrops = director?.pendingReinforcements ?? [];

  const hasDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 3;
  const hasUltraDenseEnemyRow = combat.enemies.length + pendingDrops.length >= 5;
  const hcBorderClass = highContrastBorders || tacticalView ? 'tactical-hc-border' : '';

  const inspectedDrop: PendingReinforcement | null =
    inspectedTarget && inspectedTarget.startsWith('drop:')
      ? pendingDrops.find((d) => d.id === inspectedTarget.slice(5)) ?? null
      : null;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-[1680px] flex-wrap md:flex-nowrap items-start justify-between gap-1.5 px-2 sm:px-4 ${
          isCompactLandscape ? 'top-1' : 'top-1.5 sm:top-2'
        }`}
      >
        <CombatHeroHeaderPod
          hero={hero}
          charCode={charMeta.code}
          turn={combat.turn}
          director={director}
          activePreview={activePreview}
          heroThreat={heroThreat}
          blitzReflexCooldown={combat.blitzReflexCooldown ?? 0}
          primedDrone={combat.primedDrone ?? null}
          isCompactLandscape={isCompactLandscape}
          hasUltraDenseEnemyRow={hasUltraDenseEnemyRow}
          hcBorderClass={hcBorderClass}
          inspectedTarget={inspectedTarget}
          setInspectedTarget={setInspectedTarget}
          rendererMode={rendererMode}
          setRendererMode={setRendererMode}
          debugMeshWireframe={debugMeshWireframe}
          setDebugMeshWireframe={setDebugMeshWireframe}
          setDevToolbarMountNode={setDevToolbarMountNode}
          t={t}
        />

        <CombatEnemyHudCards
          combat={combat}
          pendingDrops={pendingDrops}
          sequentialHudStates={sequentialHudStates}
          activePreview={activePreview}
          lang={lang}
          t={t}
          isCompactLandscape={isCompactLandscape}
          hasDenseEnemyRow={hasDenseEnemyRow}
          hasUltraDenseEnemyRow={hasUltraDenseEnemyRow}
          hcBorderClass={hcBorderClass}
          quantizedScaleMode={quantizedScaleMode}
          revealDropArchetype={revealDropArchetype}
          revealEnemyFutureCycle={revealEnemyFutureCycle}
          inspectedTarget={inspectedTarget}
          setInspectedTarget={setInspectedTarget}
          setHoveredEnemyId={setHoveredEnemyId}
        />
      </div>

      <CombatUnitInspectDrawer
        hero={hero}
        charId={charId}
        lang={lang}
        t={t}
        inspectedTarget={inspectedTarget}
        inspectedDrop={inspectedDrop}
        revealDropArchetype={revealDropArchetype}
        setInspectedTarget={setInspectedTarget}
        onOpenCodex={onOpenCodex}
      />
    </>
  );
}
