import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { ensureCombatAssetsReady } from '../assets/assetPreloader';
import { soundEngine } from '../audio/soundEngine';
import type { MedBayActionType } from '../components/BioMedBayView';
import { DEFAULT_DIFFICULTY_TIER, getDifficultyProfile } from '../engine/difficulty';
import {
  adoptNannyBot,
  applyMedBayAction,
  buyChipDealerChip,
  charterSuburbanEstate,
  claimCombatChipReward,
  engraveHeirloom,
  enrollCharterProdigyTile,
  equipSkillChipInstance,
  incubateStorkTile,
  installCyberImplant,
  marryBloodlineCrest,
  purgeClinicInnateTile,
  rerouteMeshNetNode,
  resolveCyberEventChoice,
  restockChipDealer,
  rideMagLevExpress,
  scrapSkillChipInstance,
  skipChipDealer,
  skipCyberClinic,
  spliceFabLabTiles,
  startBetaTrialChip,
  startNodeEncounter,
  switchActiveCyberEvent,
  unequipSkillChipInstance,
} from '../engine/gameEngine';
import { getNodeEncounterIntel } from '../engine/mapTacticalIntel';
import { saveEncounterSnapshot } from '../engine/persistence';
import type { CyberImplantId, NannyBotId, RunState, TileType } from '../engine/types';
import type { Language } from '../i18n/translations';
import type { EncounterObjectivesSummary } from '../utils/tacticalSandboxAndHints';

export interface UseNodeNavigationAndVendorsOptions {
  runRef: MutableRefObject<RunState>;
  setRun: Dispatch<SetStateAction<RunState>>;
  langRef: MutableRefObject<Language>;
  objectivesSummary: EncounterObjectivesSummary | null;
  resetCombatSandboxForNewNode: (nextSnapshot: RunState | null) => void;
}

export function useNodeNavigationAndVendors({
  runRef,
  setRun,
  langRef,
  objectivesSummary,
  resetCombatSandboxForNewNode,
}: UseNodeNavigationAndVendorsOptions) {
  const [defibNoticeVisible, setDefibNoticeVisible] = useState<boolean>(false);

  const handleClaimCombatReward = useCallback(
    (defId: string | null) => {
      soundEngine.playClick();
      const prev = runRef.current;
      const next = claimCombatChipReward(prev, defId);
      if (!prev.hero.emergencyDefibUsed && next.hero.emergencyDefibUsed) {
        setDefibNoticeVisible(true);
      }
      const finalized = objectivesSummary
        ? {
            ...next,
            score: next.score + objectivesSummary.bonusScore,
            hero: {
              ...next.hero,
              credits: next.hero.credits + objectivesSummary.bonusCredits,
              nanites: (next.hero.nanites ?? 0) + objectivesSummary.bonusNanites,
            },
          }
        : next;
      resetCombatSandboxForNewNode(null);
      saveEncounterSnapshot(null);
      setRun(finalized);
    },
    [objectivesSummary, resetCombatSandboxForNewNode, runRef, setRun],
  );

  const handleSelectMapNode = useCallback(
    (nodeId: string) => {
      soundEngine.playClick();
      setDefibNoticeVisible(false);
      const current = runRef.current;
      const targetNode = current.mapNodes.find((n) => n.id === nodeId);
      if (
        targetNode &&
        targetNode.type !== 'CYBER_CLINIC' &&
        targetNode.type !== 'CHIP_DEALER' &&
        targetNode.type !== 'MED_BAY' &&
        targetNode.type !== 'EVENT'
      ) {
        const intel = getNodeEncounterIntel(
          targetNode,
          current.seed,
          langRef.current,
          current.difficultyTier ?? 3,
        );
        void ensureCombatAssetsReady(
          current.hero.characterId ?? 'kira',
          intel.enemies.map((e) => e.archetype),
        );
      }
      const nextRun = startNodeEncounter(current, nodeId);
      const isIronmanRun =
        getDifficultyProfile(nextRun.difficultyTier ?? DEFAULT_DIFFICULTY_TIER).maxRunResets === 0;
      const nextSnapshot = !isIronmanRun && nextRun.screen === 'combat' ? nextRun : null;
      resetCombatSandboxForNewNode(nextSnapshot);
      saveEncounterSnapshot(nextSnapshot);
      setRun(nextRun);
    },
    [langRef, resetCombatSandboxForNewNode, runRef, setRun],
  );

  const handleBuyEquipment = useCallback(
    (defId: string) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => buyChipDealerChip(prev, defId));
    },
    [setRun],
  );

  const handleRestockShop = useCallback(() => {
    soundEngine.playClick();
    setRun((prev) => restockChipDealer(prev));
  }, [setRun]);

  const handleInstallImplant = useCallback(
    (implantId: CyberImplantId, replaceId?: CyberImplantId) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => installCyberImplant(prev, implantId, replaceId));
    },
    [setRun],
  );

  const handleSkipClinic = useCallback(() => {
    soundEngine.playClick();
    setRun((prev) => skipCyberClinic(prev));
  }, [setRun]);

  const handleSkipChipDealer = useCallback(() => {
    soundEngine.playClick();
    setRun((prev) => skipChipDealer(prev));
  }, [setRun]);

  const handlePurgeInnateTile = useCallback(
    (tileId: string) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => purgeClinicInnateTile(prev, tileId));
    },
    [setRun],
  );

  const handleIncubateTile = useCallback(
    (tileId: string) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => incubateStorkTile(prev, tileId));
    },
    [setRun],
  );

  const handleMarryBloodline = useCallback(
    (colorA: TileType, colorB: TileType) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => marryBloodlineCrest(prev, colorA, colorB));
    },
    [setRun],
  );

  const handleEnrollProdigy = useCallback(
    (tileId: string) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => enrollCharterProdigyTile(prev, tileId));
    },
    [setRun],
  );

  const handleSpliceTiles = useCallback(
    (primaryTileId: string, donorTileId: string) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => spliceFabLabTiles(prev, primaryTileId, donorTileId));
    },
    [setRun],
  );

  const handleAdoptNannyBot = useCallback(
    (botId: NannyBotId) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => adoptNannyBot(prev, botId));
    },
    [setRun],
  );

  const handleStartBetaTrial = useCallback(
    (defId?: string) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => startBetaTrialChip(prev, defId));
    },
    [setRun],
  );

  const handleEngraveHeirloom = useCallback(
    (instanceId: string) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => engraveHeirloom(prev, instanceId));
    },
    [setRun],
  );

  const handleRerouteMeshNet = useCallback(
    (targetNodeId: string) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => rerouteMeshNetNode(prev, targetNodeId));
    },
    [setRun],
  );

  const handleCharterEstate = useCallback(() => {
    soundEngine.playUpgrade(true);
    setRun((prev) => charterSuburbanEstate(prev));
  }, [setRun]);

  const handleRideMagLev = useCallback(
    (targetNodeId?: string) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => rideMagLevExpress(prev, targetNodeId));
    },
    [setRun],
  );

  const handleSwitchEvent = useCallback(
    (eventId: string) => {
      soundEngine.playClick();
      setRun((prev) => switchActiveCyberEvent(prev, eventId));
    },
    [setRun],
  );

  const handleMedBayAction = useCallback(
    (action: MedBayActionType) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => applyMedBayAction(prev, action));
    },
    [setRun],
  );

  const handleResolveEventChoice = useCallback(
    (choiceIndex: number) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => resolveCyberEventChoice(prev, choiceIndex));
    },
    [setRun],
  );

  const handleEquipInstance = useCallback(
    (instanceId: string) => {
      soundEngine.playClick();
      setRun((prev) => equipSkillChipInstance(prev, instanceId));
    },
    [setRun],
  );

  const handleUnequipInstance = useCallback(
    (instanceId: string) => {
      soundEngine.playClick();
      setRun((prev) => unequipSkillChipInstance(prev, instanceId));
    },
    [setRun],
  );

  const handleScrapInstance = useCallback(
    (instanceId: string) => {
      soundEngine.playUpgrade(false);
      setRun((prev) => scrapSkillChipInstance(prev, instanceId));
    },
    [setRun],
  );

  return {
    defibNoticeVisible,
    setDefibNoticeVisible,
    handleClaimCombatReward,
    handleSelectMapNode,
    handleBuyEquipment,
    handleRestockShop,
    handleInstallImplant,
    handleSkipClinic,
    handleSkipChipDealer,
    handlePurgeInnateTile,
    handleIncubateTile,
    handleMarryBloodline,
    handleEnrollProdigy,
    handleSpliceTiles,
    handleAdoptNannyBot,
    handleStartBetaTrial,
    handleEngraveHeirloom,
    handleRerouteMeshNet,
    handleCharterEstate,
    handleRideMagLev,
    handleSwitchEvent,
    handleMedBayAction,
    handleResolveEventChoice,
    handleEquipInstance,
    handleUnequipInstance,
    handleScrapInstance,
  };
}
