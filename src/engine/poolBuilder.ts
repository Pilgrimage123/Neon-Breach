import {
  MAX_HEIRLOOM_STACKS,
  MAX_OVERCLOCK_STACKS,
  SKILL_CHIPS_BY_ID,
  getInnateTilesForCharacter,
} from './data';
import type {
  CharacterId,
  HeroState,
  OwnedSkillChip,
  RunState,
  TechEffect,
  Tile,
  TileType,
} from './types';

export function createStartingSkillChips(characterId: CharacterId = 'kira'): {
  ownedChips: OwnedSkillChip[];
  equippedInstanceIds: string[];
} {
  const ownedChips: OwnedSkillChip[] =
    characterId === 'auraline'
      ? [
          { instanceId: 'chip_start_impact_solver', defId: 'impact_solver' },
          { instanceId: 'chip_start_sovereign_ward', defId: 'sovereign_ward' },
        ]
      : characterId === 'zuri'
        ? [
            { instanceId: 'chip_start_swarm_vector', defId: 'swarm_vector' },
            { instanceId: 'chip_start_sanctuary_mesh', defId: 'sanctuary_mesh' },
          ]
        : [
            { instanceId: 'chip_start_predictive_aim', defId: 'predictive_aim' },
            { instanceId: 'chip_start_auto_suture', defId: 'auto_suture' },
          ];
  return {
    ownedChips,
    equippedInstanceIds: ownedChips.map((e) => e.instanceId),
  };
}

export function getEquippedChipMemory(
  hero: Pick<HeroState, 'ownedChips' | 'equippedInstanceIds'>,
): number {
  const ownedById = new Map(hero.ownedChips.map((item) => [item.instanceId, item]));
  let total = 0;
  for (const instanceId of hero.equippedInstanceIds) {
    const owned = ownedById.get(instanceId);
    if (!owned) continue;
    const def = SKILL_CHIPS_BY_ID[owned.defId];
    if (def) total += def.memoryCost;
  }
  return total;
}

export function isSkillChipEquipped(
  hero: Pick<HeroState, 'equippedInstanceIds'>,
  instanceId: string,
): boolean {
  return hero.equippedInstanceIds.includes(instanceId);
}

export function isTileEligibleForStork(
  tile: Pick<Tile, 'id' | 'isBlight'>,
  hero?: Pick<HeroState, 'maturedNextGenTiles'>,
): boolean {
  if (tile.isBlight) return false;
  if (hero?.maturedNextGenTiles && hero.maturedNextGenTiles[tile.id]) return false;
  return true;
}

function scaleMaturedTechEffect(eff: TechEffect): TechEffect {
  switch (eff.kind) {
    case 'heal':
      return { ...eff, amount: eff.amount * 2 };
    case 'damage_boost':
      return { ...eff, percent: Math.min(80, eff.percent + 25) };
    case 'armor_shred':
      return {
        ...eff,
        shredAmount: eff.shredAmount * 2,
        pierceDamage: eff.pierceDamage * 2,
      };
    case 'overdrive_surge':
      return {
        ...eff,
        bonusOverdrive: Math.min(50, eff.bonusOverdrive * 2),
        cleanseCorrode: eff.cleanseCorrode + 1,
      };
    case 'tactical_shield':
      return {
        ...eff,
        shieldAmount: eff.shieldAmount * 2,
        damageBoostPct: Math.min(60, eff.damageBoostPct + 15),
      };
  }
}

interface MaturedStorkTrait {
  bonusMultiplier: number;
  inheritedTrait: 'upcharge' | 'pierce_boost' | 'shield_aura';
}

function applyMaturedStorkBonus(
  type: TileType,
  value: number,
  upcharge: number | undefined,
  techEffect: TechEffect | undefined,
  matured: MaturedStorkTrait,
): {
  value: number;
  isDud: boolean;
  upcharge: number;
  techEffect: TechEffect | undefined;
  pierceBoost?: boolean;
  shieldAuraBonus?: number;
} {
  const nextValue = type === 'tech' ? 0 : Math.max(8, value * matured.bonusMultiplier);
  const extraUpcharge = matured.inheritedTrait === 'upcharge' ? 1 : 0;
  return {
    value: nextValue,
    isDud: false,
    upcharge: (upcharge ?? 0) + 1 + extraUpcharge,
    techEffect: techEffect ? scaleMaturedTechEffect(techEffect) : undefined,
    ...(matured.inheritedTrait === 'pierce_boost' ? { pierceBoost: true } : {}),
    ...(matured.inheritedTrait === 'shield_aura' ? { shieldAuraBonus: 3 } : {}),
  };
}

export function rebuildMasterPool(
  hero: Pick<
    HeroState,
    | 'characterId'
    | 'ownedChips'
    | 'equippedInstanceIds'
    | 'overclockCount'
    | 'purgedInnateIds'
    | 'incubatingTile'
    | 'maturedNextGenTiles'
    | 'prodigyTileIds'
    | 'splicedTilePairs'
    | 'heirloomEngravedId'
    | 'heirloomStacks'
    | 'dynastyRelicUnlocked'
  >,
): Tile[] {
  const purgedSet = new Set(hero.purgedInnateIds ?? []);
  const prodigySet = new Set(hero.prodigyTileIds ?? []);
  const splicedPairs = hero.splicedTilePairs ?? [];
  const consumedBySplice = new Set(splicedPairs.map((p) => p.consumedId));
  const incubatingId =
    hero.incubatingTile && hero.incubatingTile.nodesRemaining > 0
      ? hero.incubatingTile.tile.id
      : null;
  const maturedMap = hero.maturedNextGenTiles ?? {};

  const innateSpecs = getInnateTilesForCharacter(hero.characterId ?? 'kira');
  const pool: Tile[] = [];
  innateSpecs.forEach((spec, idx) => {
    const id = `tile_innate_${idx + 1}`;
    if (purgedSet.has(id) || consumedBySplice.has(id) || id === incubatingId) return;

    let value = spec.value;
    let isDud = spec.isDud;
    const isReactorCore = Boolean(spec.isReactorCore || spec.isDud);
    let upcharge = spec.upcharge;
    let techEffect = spec.techEffect ? { ...spec.techEffect } : undefined;
    let pierceBoost: boolean | undefined;
    let shieldAuraBonus: number | undefined;

    if (prodigySet.has(id)) {
      isDud = false;
      value = spec.type === 'tech' ? 0 : Math.max(6, spec.value + 3);
      upcharge = (upcharge ?? 0) + 1;
      if (spec.type === 'tech' && !techEffect) {
        techEffect = { kind: 'tactical_shield', shieldAmount: 5, damageBoostPct: 20 };
      }
    }

    const splice = splicedPairs.find((p) => p.targetId === id);
    let secondaryType = spec.secondaryType;
    let secondaryValue = spec.secondaryValue;
    if (splice) {
      isDud = false;
      value += splice.bonusValue;
      upcharge = (upcharge ?? 0) + splice.bonusUpcharge;
      if (splice.secondaryType) {
        secondaryType = splice.secondaryType;
        secondaryValue = splice.secondaryValue ?? splice.bonusValue;
      }
    }

    const matured = maturedMap[id];
    if (matured) {
      const m = applyMaturedStorkBonus(spec.type, value, upcharge, techEffect, matured);
      value = m.value;
      isDud = m.isDud;
      upcharge = m.upcharge;
      techEffect = m.techEffect;
      pierceBoost = m.pierceBoost;
      shieldAuraBonus = m.shieldAuraBonus;
    }

    pool.push({
      id,
      type: spec.type,
      sourceId: 'innate',
      value,
      techEffect,
      isDud,
      ...(isReactorCore ? { isReactorCore: true } : {}),
      upcharge,
      ...(pierceBoost ? { pierceBoost } : {}),
      ...(shieldAuraBonus ? { shieldAuraBonus } : {}),
      ...(secondaryType ? { secondaryType, secondaryValue } : {}),
      isHeldFromPrevTurn: false,
    });
  });

  // Charter Academy / Upcycle adjacency buff: enrolled Prodigy grants +1 to adjacent innate Attack/Defense tiles
  if (prodigySet.size > 0) {
    for (let i = 0; i < pool.length; i++) {
      if (
        pool[i].sourceId === 'innate' &&
        !prodigySet.has(pool[i].id) &&
        !pool[i].isDud &&
        (pool[i].type === 'attack' || pool[i].type === 'defense')
      ) {
        pool[i] = { ...pool[i], value: pool[i].value + 1 };
      }
    }
  }

  const heirloomBonus = Math.min(MAX_HEIRLOOM_STACKS, Math.max(0, hero.heirloomStacks ?? 0));
  const ownedById = new Map(hero.ownedChips.map((item) => [item.instanceId, item]));
  for (const instanceId of hero.equippedInstanceIds) {
    const owned = ownedById.get(instanceId);
    if (!owned) continue;
    const def = SKILL_CHIPS_BY_ID[owned.defId];
    if (!def) continue;
    const isHeirloomChip =
      heirloomBonus > 0 &&
      (hero.heirloomEngravedId === def.id || hero.heirloomEngravedId === instanceId);
    def.tiles.forEach((spec, idx) => {
      const id = `tile_${instanceId}_${idx + 1}`;
      if (id === incubatingId || consumedBySplice.has(id)) return;
      let value = spec.value + (isHeirloomChip && spec.type !== 'tech' ? heirloomBonus : 0);
      let isDud = spec.isDud;
      let upcharge = spec.upcharge;
      let techEffect = spec.techEffect ? { ...spec.techEffect } : undefined;
      let secondaryType = spec.secondaryType;
      let secondaryValue = spec.secondaryValue;
      let pierceBoost: boolean | undefined;
      let shieldAuraBonus: number | undefined;

      const splice = splicedPairs.find((p) => p.targetId === id);
      if (splice) {
        isDud = false;
        value += splice.bonusValue;
        upcharge = (upcharge ?? 0) + splice.bonusUpcharge;
        if (splice.secondaryType) {
          secondaryType = splice.secondaryType;
          secondaryValue = splice.secondaryValue ?? splice.bonusValue;
        }
      }

      const matured = maturedMap[id];
      if (matured) {
        const m = applyMaturedStorkBonus(spec.type, value, upcharge, techEffect, matured);
        value = m.value;
        isDud = m.isDud;
        upcharge = m.upcharge;
        techEffect = m.techEffect;
        pierceBoost = m.pierceBoost;
        shieldAuraBonus = m.shieldAuraBonus;
      }

      pool.push({
        id,
        type: spec.type,
        sourceId: def.id,
        value,
        techEffect,
        isDud,
        upcharge,
        ...(pierceBoost ? { pierceBoost } : {}),
        ...(shieldAuraBonus ? { shieldAuraBonus } : {}),
        ...(secondaryType ? { secondaryType, secondaryValue } : {}),
        isHeldFromPrevTurn: false,
      });
    });
  }

  const overclockCount = Math.min(MAX_OVERCLOCK_STACKS, Math.max(0, hero.overclockCount ?? 0));
  if (overclockCount > 0) {
    let upgraded = 0;
    for (let i = 0; i < pool.length && upgraded < 2; i++) {
      if (pool[i].type === 'attack' && !pool[i].isDud) {
        pool[i] = { ...pool[i], value: pool[i].value + overclockCount };
        upgraded++;
      }
    }
  }

  // Dynasty Relic: scales tile power with total Master Tile Pool size
  if (hero.dynastyRelicUnlocked) {
    const dynastyBonus = Math.max(1, Math.floor(pool.length / 6));
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].isDud && (pool[i].type === 'attack' || pool[i].type === 'defense')) {
        pool[i] = { ...pool[i], value: pool[i].value + dynastyBonus };
      }
    }
  }

  return pool;
}

export function acquireSkillChip(
  run: RunState,
  defId: string,
  autoEquip = true,
): { run: RunState; instanceId: string | null } {
  const def = SKILL_CHIPS_BY_ID[defId];
  if (!def) return { run, instanceId: null };

  const seq = Math.max(run.hero.nextChipInstanceSeq ?? 1, run.hero.ownedChips.length + 1);
  const instanceId = `chip_${seq}_${defId}`;
  const nextOwned: OwnedSkillChip[] = [...run.hero.ownedChips, { instanceId, defId }];
  const nextEquipped = run.hero.equippedInstanceIds.slice();
  const currentMemory = getEquippedChipMemory(run.hero);

  if (autoEquip && currentMemory + def.memoryCost <= run.hero.memoryCapacity) {
    nextEquipped.push(instanceId);
  }

  const nextHero: HeroState = {
    ...run.hero,
    ownedChips: nextOwned,
    equippedInstanceIds: nextEquipped,
    nextChipInstanceSeq: seq + 1,
  };

  return {
    run: {
      ...run,
      hero: nextHero,
      masterPool: rebuildMasterPool(nextHero),
    },
    instanceId,
  };
}

export function createSlagTile(turn: number, seq: number, isTopDecked = false): Tile {
  return {
    id: `tile_blight_${turn}_${seq}`,
    type: 'tech',
    sourceId: 'caustic_slag',
    value: 0,
    isHeldFromPrevTurn: false,
    isBlight: true,
    ...(isTopDecked ? { isTopDecked: true } : {}),
  };
}
