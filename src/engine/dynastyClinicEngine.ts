import {
  CHIP_DEALER_RESTOCK_COST,
  CLINIC_PURGE_COST,
  HEIRLOOM_ENGRAVE_COST,
  MAX_HEIRLOOM_STACKS,
  MAX_IMPLANTS,
  MAX_OVERCLOCK_STACKS,
  SKILL_CHIPS_BY_ID,
} from './data';
import { pickSkillChipChoices } from './encounterBuilder';
import { canModifyEquipment, markNodeCleared } from './combatRules';
import {
  acquireSkillChip,
  getEquippedChipMemory,
  isTileEligibleForStork,
  rebuildMasterPool,
} from './poolBuilder';
import { saveInheritedHeirloom } from './persistence';
import type {
  CyberImplantId,
  HeroState,
  NannyBotId,
  RunState,
  ScreenPhase,
  TileType,
} from './types';

export function advanceNodeDynastyProgress(hero: HeroState): HeroState {
  let nextHero = { ...hero };

  if (nextHero.incubatingTile && nextHero.incubatingTile.nodesRemaining > 0) {
    const rem = nextHero.incubatingTile.nodesRemaining - 1;
    if (rem <= 0) {
      const maturedTileId = nextHero.incubatingTile.tile.id;
      const trait = nextHero.incubatingTile.inheritedTrait;
      nextHero = {
        ...nextHero,
        incubatingTile: null,
        maturedNextGenTiles: {
          ...(nextHero.maturedNextGenTiles ?? {}),
          [maturedTileId]: {
            bonusMultiplier: 2,
            inheritedTrait: trait,
          },
        },
      };
    } else {
      nextHero = {
        ...nextHero,
        incubatingTile: {
          ...nextHero.incubatingTile,
          nodesRemaining: rem,
        },
      };
    }
  }

  if (nextHero.activeTempoRule && nextHero.activeTempoRule.nodesRemaining > 0) {
    const rem = nextHero.activeTempoRule.nodesRemaining - 1;
    nextHero = {
      ...nextHero,
      activeTempoRule:
        rem <= 0
          ? null
          : {
              ...nextHero.activeTempoRule,
              nodesRemaining: rem,
            },
    };
  }

  return nextHero;
}

export function equipSkillChipInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (run.hero.equippedInstanceIds.includes(instanceId)) return run;

  const owned = run.hero.ownedChips.find((o) => o.instanceId === instanceId);
  if (!owned) return run;
  const def = SKILL_CHIPS_BY_ID[owned.defId];
  if (!def) return run;

  const currentMemory = getEquippedChipMemory(run.hero);
  if (currentMemory + def.memoryCost > run.hero.memoryCapacity) return run;

  const nextHero: HeroState = {
    ...run.hero,
    equippedInstanceIds: [...run.hero.equippedInstanceIds, instanceId],
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
  };
}

export function unequipSkillChipInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (!run.hero.equippedInstanceIds.includes(instanceId)) return run;

  const nextHero: HeroState = {
    ...run.hero,
    equippedInstanceIds: run.hero.equippedInstanceIds.filter((id) => id !== instanceId),
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
  };
}

export function scrapSkillChipInstance(run: RunState, instanceId: string): RunState {
  if (!canModifyEquipment(run)) return run;
  if (run.hero.equippedInstanceIds.includes(instanceId)) return run;

  const owned = run.hero.ownedChips.find((o) => o.instanceId === instanceId);
  if (!owned) return run;
  const def = SKILL_CHIPS_BY_ID[owned.defId];
  if (!def) return run;

  const refundCredits = Math.floor(def.price * 0.5);
  const nextHero: HeroState = {
    ...run.hero,
    ownedChips: run.hero.ownedChips.filter((o) => o.instanceId !== instanceId),
    credits: run.hero.credits + refundCredits,
  };

  return {
    ...run,
    hero: nextHero,
  };
}

export function buyChipDealerChip(run: RunState, defId: string): RunState {
  if (run.screen !== 'chip_dealer' && run.screen !== 'clinic') return run;
  if (!run.chipDealerChoices.includes(defId)) return run;
  const def = SKILL_CHIPS_BY_ID[defId];
  if (!def) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFlashSale = currentNode?.modifier === 'flash_sale';
  const effectivePrice = isFlashSale ? Math.max(10, Math.round(def.price * 0.65)) : def.price;

  if (run.hero.credits < effectivePrice) return run;

  const afterCredits: RunState = {
    ...run,
    hero: {
      ...run.hero,
      credits: run.hero.credits - effectivePrice,
    },
    chipDealerChoices: run.chipDealerChoices.filter((id) => id !== defId),
  };

  return acquireSkillChip(afterCredits, defId, true).run;
}

export function restockChipDealer(run: RunState): RunState {
  if (run.screen !== 'chip_dealer' && run.screen !== 'clinic') return run;
  if (run.hero.credits < CHIP_DEALER_RESTOCK_COST) return run;

  const ownedDefIds = run.hero.ownedChips.map((eq) => eq.defId);
  const nextChoices = pickSkillChipChoices(
    run.seed + run.hero.credits * 19 + run.score * 7 + run.chipDealerChoices.length * 13,
    3,
    ownedDefIds,
    run.chipDealerChoices,
  );

  return {
    ...run,
    hero: {
      ...run.hero,
      credits: run.hero.credits - CHIP_DEALER_RESTOCK_COST,
    },
    chipDealerChoices: nextChoices,
  };
}

export function skipChipDealer(run: RunState): RunState {
  const nextHero = advanceNodeDynastyProgress(run.hero);
  return {
    ...run,
    screen: 'map',
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
  };
}

export function purgeClinicInnateTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic' || run.clinicPurgeUsed) return run;
  if (run.hero.credits < CLINIC_PURGE_COST) return run;
  if (run.masterPool.length <= 3) return run;

  const targetTile = run.masterPool.find((t) => t.id === tileId && t.sourceId === 'innate');
  if (!targetTile) return run;

  const prevPurged = run.hero.purgedInnateIds ?? [];
  if (prevPurged.includes(tileId)) return run;

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - CLINIC_PURGE_COST,
    purgedInnateIds: [...prevPurged, tileId],
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    clinicPurgeUsed: true,
    score: run.score + 20,
  };
}

export function incubateStorkTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic') return run;
  if (run.hero.incubatingTile) return run;
  if (run.masterPool.length <= 4) return run;

  const targetTile = run.masterPool.find((t) => t.id === tileId);
  if (!targetTile || !isTileEligibleForStork(targetTile, run.hero)) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 15;
  if (run.hero.credits < cost) return run;

  const traits: Array<'upcharge' | 'pierce_boost' | 'shield_aura'> = [
    'upcharge',
    'pierce_boost',
    'shield_aura',
  ];
  const inheritedTrait = traits[Math.abs(run.seed + tileId.length) % traits.length];

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - cost,
    incubatingTile: {
      tile: { ...targetTile },
      nodesRemaining: 3,
      inheritedTrait,
    },
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    score: run.score + 25,
  };
}

export function marryBloodlineCrest(
  run: RunState,
  primary: TileType,
  secondary: TileType,
): RunState {
  if (run.screen !== 'clinic' && run.screen !== 'medbay') return run;
  if (primary === secondary) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 20;
  if (run.hero.credits < cost) return run;

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - cost,
    bloodlineCrest: {
      primary,
      secondary,
      bonusValue: 2,
    },
  };

  return {
    ...run,
    hero: nextHero,
    score: run.score + 30,
  };
}

export function enrollCharterProdigyTile(run: RunState, tileId: string): RunState {
  if (run.screen !== 'clinic') return run;
  const targetTile = run.masterPool.find((t) => t.id === tileId && t.sourceId === 'innate');
  if (!targetTile) return run;

  const prevProdigies = run.hero.prodigyTileIds ?? [];
  if (prevProdigies.includes(tileId)) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'funded_clinic' ? 0 : 15;
  if (run.hero.credits < cost) return run;

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - cost,
    prodigyTileIds: [...prevProdigies, tileId],
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    score: run.score + 25,
  };
}

export function spliceFabLabTiles(
  run: RunState,
  targetTileId: string,
  consumedTileId: string,
): RunState {
  if (run.screen !== 'clinic') return run;
  if (targetTileId === consumedTileId) return run;
  if (run.masterPool.length <= 4) return run;

  const targetTile = run.masterPool.find((t) => t.id === targetTileId);
  const consumedTile = run.masterPool.find((t) => t.id === consumedTileId);
  if (!targetTile || !consumedTile || targetTile.isBlight || consumedTile.isBlight) return run;

  const prevSplices = run.hero.splicedTilePairs ?? [];
  if (
    prevSplices.some(
      (p) =>
        p.targetId === targetTileId ||
        p.consumedId === consumedTileId ||
        p.targetId === consumedTileId,
    )
  ) {
    return run;
  }

  const techDonorValue =
    consumedTile.type === 'tech'
      ? consumedTile.techEffect?.kind === 'damage_boost'
        ? Math.max(12, Math.round(consumedTile.techEffect.percent * 0.4))
        : 12
      : Math.max(3, Math.ceil(consumedTile.value * 0.65));

  const bonusValue =
    targetTile.type === 'tech'
      ? 0
      : Math.max(3, Math.ceil((consumedTile.type === 'tech' ? 4 : consumedTile.value) * 0.75));
  const secondaryValue = techDonorValue;

  const nextHero: HeroState = {
    ...run.hero,
    splicedTilePairs: [
      ...prevSplices,
      {
        targetId: targetTileId,
        consumedId: consumedTileId,
        bonusValue,
        bonusUpcharge: 1,
        secondaryType: consumedTile.type !== targetTile.type ? consumedTile.type : undefined,
        secondaryValue,
      },
    ],
  };

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    score: run.score + 30,
  };
}

export function engraveHeirloom(run: RunState, targetDefId: string): RunState {
  if (run.screen !== 'chip_dealer') return run;
  if (run.chipDealerHeirloomUsed) return run;
  if (run.hero.credits < HEIRLOOM_ENGRAVE_COST) return run;

  const ownedMatch = run.hero.ownedChips.find(
    (eq) => eq.defId === targetDefId || eq.instanceId === targetDefId,
  );
  if (!ownedMatch) return run;
  const resolvedDefId = ownedMatch.defId;

  const currentStacks = Math.min(MAX_HEIRLOOM_STACKS, Math.max(0, run.hero.heirloomStacks ?? 0));
  if (currentStacks >= MAX_HEIRLOOM_STACKS && run.hero.heirloomEngravedId === resolvedDefId) {
    return run;
  }

  const nextStacks = Math.min(MAX_HEIRLOOM_STACKS, Math.max(1, currentStacks + 1));
  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - HEIRLOOM_ENGRAVE_COST,
    heirloomEngravedId: resolvedDefId,
    heirloomStacks: nextStacks,
  };
  saveInheritedHeirloom(resolvedDefId, nextStacks);

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    chipDealerHeirloomUsed: true,
    score: run.score + 20,
  };
}

export function adoptNannyBot(run: RunState, botId: NannyBotId): RunState {
  if (run.screen !== 'chip_dealer') return run;
  if (run.hero.nannyBotInstalled === botId) return run;

  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const cost = currentNode?.modifier === 'flash_sale' ? 16 : 25;
  if (run.hero.credits < cost) return run;

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - cost,
    nannyBotInstalled: botId,
  };

  return {
    ...run,
    hero: nextHero,
    score: run.score + 25,
  };
}

export function startBetaTrialChip(run: RunState, defId?: string): RunState {
  if (run.screen !== 'chip_dealer') return run;
  if (run.hero.betaTrialChip) return run;

  const chosenDefId =
    defId && SKILL_CHIPS_BY_ID[defId]
      ? defId
      : run.chipDealerChoices[0] ?? 'tempo_feed';

  const acquired = acquireSkillChip(run, chosenDefId, true);
  if (!acquired.instanceId) return run;
  const nextHero: HeroState = {
    ...acquired.run.hero,
    betaTrialChip: {
      defId: chosenDefId,
      instanceId: acquired.instanceId,
      combatsRemaining: 2,
      resolvesLogged: 0,
      upgraded: false,
    },
  };

  return {
    ...acquired.run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    score: acquired.run.score + 15,
  };
}

export function rerouteMeshNetNode(run: RunState, targetNodeId: string): RunState {
  const maxReroutes = run.mapNodes.length >= 17 ? 2 : 1;
  if ((run.hero.meshReroutesUsed ?? 0) >= maxReroutes) return run;
  const targetNode = run.mapNodes.find((n) => n.id === targetNodeId);
  if (!targetNode || targetNode.cleared) return run;

  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : -1;
  if (targetNode.layer !== maxClearedLayer + 1) return run;

  const anchorNode =
    run.mapNodes.find((n) => n.id === run.currentNodeId && n.cleared) ??
    clearedNodes.find((n) => n.layer === maxClearedLayer);
  if (!anchorNode) return run;
  if (anchorNode.nextIds.includes(targetNodeId)) return run;

  const nextMapNodes = run.mapNodes.map((n) =>
    n.id === anchorNode.id ? { ...n, nextIds: [...n.nextIds, targetNodeId] } : n,
  );

  return {
    ...run,
    hero: {
      ...run.hero,
      meshReroutesUsed: (run.hero.meshReroutesUsed ?? 0) + 1,
    },
    mapNodes: nextMapNodes,
    score: run.score + 15,
  };
}

export function charterSuburbanEstate(run: RunState, layer?: number): RunState {
  const cost = 20;
  if (run.hero.credits < cost) return run;

  const maxLayer = run.mapNodes.reduce((acc, n) => Math.max(acc, n.layer), 4);
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : 0;
  const targetLayer = layer ?? Math.min(maxLayer, maxClearedLayer + 1);

  const prevEstates = run.hero.familyEstates ?? [];
  if (prevEstates.includes(targetLayer)) return run;

  const nextHero: HeroState = {
    ...run.hero,
    credits: run.hero.credits - cost,
    hp: Math.min(run.hero.maxHp, run.hero.hp + 5),
    familyEstates: [...prevEstates, targetLayer],
  };

  return {
    ...run,
    hero: nextHero,
    score: run.score + 20,
  };
}

export function rideMagLevExpress(run: RunState, targetNodeId?: string): RunState {
  if (run.hero.maglevUsed) return run;

  const maxLayer = run.mapNodes.reduce((acc, n) => Math.max(acc, n.layer), 4);
  const clearedNodes = run.mapNodes.filter((n) => n.cleared);
  const maxClearedLayer =
    clearedNodes.length > 0 ? Math.max(...clearedNodes.map((n) => n.layer)) : -1;
  if (maxClearedLayer < 0) return run;

  const anchorNode =
    run.mapNodes.find((n) => n.id === run.currentNodeId && n.cleared) ??
    clearedNodes.find((n) => n.layer === maxClearedLayer);
  if (!anchorNode) return run;

  const expressLayer = Math.min(maxLayer - 1, anchorNode.layer + 2);
  if (expressLayer <= anchorNode.layer) return run;

  const candidates = run.mapNodes.filter((n) => n.layer === expressLayer && !n.cleared);
  if (candidates.length === 0) return run;

  const targetNode =
    (targetNodeId ? candidates.find((n) => n.id === targetNodeId) : undefined) ??
    candidates.find((n) => n.lane === anchorNode.lane) ??
    candidates[0];

  const nextMapNodes = run.mapNodes.map((n) =>
    n.id === anchorNode.id && !n.nextIds.includes(targetNode.id)
      ? { ...n, nextIds: [...n.nextIds, targetNode.id] }
      : n,
  );

  let nextHero: HeroState = {
    ...run.hero,
    maglevUsed: true,
    credits: run.hero.credits + 25,
    corrode: Math.max(0, run.hero.corrode - 2),
  };
  nextHero = advanceNodeDynastyProgress(nextHero);

  return {
    ...run,
    hero: nextHero,
    masterPool: rebuildMasterPool(nextHero),
    mapNodes: nextMapNodes,
    score: run.score + 30,
  };
}

export function installCyberImplant(
  run: RunState,
  implantId: CyberImplantId,
  replaceImplantId?: CyberImplantId,
): RunState {
  let nextImplants = run.hero.implants.slice();
  if (!nextImplants.includes(implantId)) {
    if (nextImplants.length < MAX_IMPLANTS) {
      nextImplants.push(implantId);
    } else if (replaceImplantId) {
      const idx = nextImplants.indexOf(replaceImplantId);
      if (idx !== -1) {
        nextImplants[idx] = implantId;
      } else {
        nextImplants = [...nextImplants.slice(0, MAX_IMPLANTS - 1), implantId];
      }
    }
  }

  const nextMapNodes = markNodeCleared(run.mapNodes, run.currentNodeId);
  const progressedHero = advanceNodeDynastyProgress({
    ...run.hero,
    implants: nextImplants,
  });

  return {
    ...run,
    screen: 'map',
    hero: progressedHero,
    masterPool: rebuildMasterPool(progressedHero),
    mapNodes: nextMapNodes,
    combat: null,
    score: run.score + 40,
  };
}

export function skipCyberClinic(run: RunState): RunState {
  const progressedHero = advanceNodeDynastyProgress(run.hero);
  return {
    ...run,
    screen: 'map',
    hero: progressedHero,
    masterPool: rebuildMasterPool(progressedHero),
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
  };
}

export type MedBayActionKind =
  | 'heal'
  | 'calibrate_max_hp'
  | 'salvage_credits'
  | 'tile_overclock'
  | 'hearth_grandparents'
  | 'hearth_spouse'
  | 'hearth_kids';

export function applyMedBayAction(
  run: RunState,
  action: MedBayActionKind,
): RunState {
  if (run.screen !== 'medbay') return run;
  if (action === 'tile_overclock' && (run.hero.overclockCount ?? 0) >= MAX_OVERCLOCK_STACKS) {
    return run;
  }
  const currentNode = run.mapNodes.find((n) => n.id === run.currentNodeId);
  const isFundedClinic = currentNode?.modifier === 'funded_clinic';

  let nextHero: HeroState = {
    ...run.hero,
    consecutiveCombatWithoutClinic: 0,
  };
  const nextScreen: ScreenPhase = 'map';
  let scoreBonus = 30;

  if (action === 'heal') {
    nextHero = {
      ...nextHero,
      hp: Math.min(nextHero.maxHp, nextHero.hp + 22),
    };
  } else if (action === 'calibrate_max_hp') {
    const nextMax = nextHero.maxHp + 10;
    nextHero = {
      ...nextHero,
      maxHp: nextMax,
      hp: Math.min(nextMax, nextHero.hp + 10),
    };
  } else if (action === 'salvage_credits') {
    nextHero = {
      ...nextHero,
      credits: nextHero.credits + 35,
    };
  } else if (action === 'tile_overclock') {
    nextHero = {
      ...nextHero,
      overdrive: Math.min(100, nextHero.overdrive + 20),
      corrode: 0,
      overclockCount: Math.min(MAX_OVERCLOCK_STACKS, (nextHero.overclockCount ?? 0) + 1),
    };
    scoreBonus = 35;
  } else if (action === 'hearth_grandparents') {
    const candidateInnate = run.masterPool.find(
      (t) => t.sourceId === 'innate' && !(nextHero.prodigyTileIds ?? []).includes(t.id),
    );
    nextHero = {
      ...nextHero,
      hp: Math.min(nextHero.maxHp, nextHero.hp + 12),
      corrode: 0,
      prodigyTileIds: candidateInnate
        ? [...(nextHero.prodigyTileIds ?? []), candidateInnate.id]
        : nextHero.prodigyTileIds,
      overclockCount: Math.min(MAX_OVERCLOCK_STACKS, (nextHero.overclockCount ?? 0) + 1),
    };
    scoreBonus = 40;
  } else if (action === 'hearth_spouse') {
    nextHero = {
      ...nextHero,
      hp: Math.min(nextHero.maxHp, nextHero.hp + 14),
      bloodlineCrest: nextHero.bloodlineCrest ?? {
        primary: 'attack',
        secondary: 'defense',
        bonusValue: 2,
      },
    };
    scoreBonus = 35;
  } else if (action === 'hearth_kids') {
    nextHero = {
      ...nextHero,
      hp: Math.min(nextHero.maxHp, nextHero.hp + 22),
      overdrive: Math.min(100, nextHero.overdrive + 25),
    };
    scoreBonus = 35;
  }

  if (isFundedClinic) {
    nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + 12);
  }

  nextHero = advanceNodeDynastyProgress(nextHero);
  if (action === 'hearth_kids') {
    nextHero = {
      ...nextHero,
      activeTempoRule: {
        id: 'kids_vitality_boost',
        nodesRemaining: 2,
      },
    };
  }
  const nextMasterPool = rebuildMasterPool(nextHero);

  return {
    ...run,
    screen: nextScreen,
    hero: nextHero,
    masterPool: nextMasterPool,
    mapNodes: markNodeCleared(run.mapNodes, run.currentNodeId),
    combat: null,
    score: run.score + scoreBonus,
  };
}
