import { getSafeEnemyIntent } from './combatBoardOps';
import { getHeroSpec } from './data';
import {
  BLIGHT_HOLD_CHIP_DAMAGE,
  HEX_ARMOR_AMOUNT,
  HEX_HEAL_AMOUNT,
  HOT_POTATO_PASS_DAMAGE,
  HOT_POTATO_SELF_DAMAGE,
  PUSTULE_RUPTURE_CORRODE,
  TEMPTATION_CLEAVE_BONUS,
  absorbHeroDamage,
  applyDamageToEnemy,
  getSurgeThreshold,
  hasHostileLivingEnemies,
  hasImplant,
  isDamagingIntent,
  simulatePlayerActionOnEnemies,
} from './combatRules';
import { getEffectiveEnemyIntentValue, isIntentConditionMet } from './reinforcementDirector';
import type {
  CombatState,
  HeroState,
  HeroThreatPreview,
  RunState,
  Tile,
  TileType,
  TurnPreview,
} from './types';

export function isReactorCoreTile(tile: Pick<Tile, 'isDud' | 'isReactorCore'>): boolean {
  return Boolean(tile.isDud || tile.isReactorCore);
}

export function getEffectiveTileValue(
  tile: Pick<Tile, 'type' | 'value' | 'isHeldFromPrevTurn' | 'isBlight'>,
  hero: Pick<HeroState, 'characterId' | 'implants' | 'bloodlineCrest'>,
  bloodlineResonanceActive?: TileType | null,
): { value: number; flatBonus: number } {
  if (tile.isBlight) {
    return { value: 0, flatBonus: 0 };
  }
  const heroSpec = getHeroSpec(hero.characterId);
  const implants = hero.implants;
  let flatBonus = 0;

  if (tile.type === 'attack') {
    if (tile.isHeldFromPrevTurn && heroSpec.heldTileBonus > 0) {
      flatBonus += heroSpec.heldTileBonus;
    }
    if (hasImplant(implants, 'plasma_amp')) flatBonus += 2;
    if (hasImplant(implants, 'monowire_edge') && tile.isHeldFromPrevTurn) flatBonus += 2;
  } else if (tile.type === 'defense') {
    if (tile.isHeldFromPrevTurn && heroSpec.heldTileBonus > 0) {
      flatBonus += heroSpec.heldTileBonus;
    }
    if (hasImplant(implants, 'nano_weave')) flatBonus += 2;
  }

  if (
    hero.bloodlineCrest &&
    bloodlineResonanceActive &&
    tile.type === bloodlineResonanceActive &&
    (tile.type === 'attack' || tile.type === 'defense')
  ) {
    flatBonus += hero.bloodlineCrest.bonusValue;
  }

  return {
    value: tile.value + flatBonus,
    flatBonus,
  };
}

export function previewColorResolution(run: RunState, color: TileType): TurnPreview {
  const combat = run.combat;
  const implants = run.hero.implants;
  const heroSpec = getHeroSpec(run.hero.characterId);
  const surgeThreshold = getSurgeThreshold(implants);
  const damageBoostPct = run.hero.damageBoostPct;

  const emptyPreview: TurnPreview = {
    color,
    tileCount: 0,
    stayCount: combat ? combat.board.length : 0,
    baseDamage: 0,
    damageBoostPct,
    totalDamage: 0,
    cleaveDamage: 0,
    armorPiercing: color === 'attack' && hasImplant(implants, 'piercing_katana'),
    shieldGained: 0,
    damageBoostAddedPct: 0,
    healAmount: 0,
    overdriveGained: 0,
    surgeTriggered: false,
    surgeThreshold,
    reflectOnBlock: 0,
    armorShredAmount: 0,
    techPierceDamage: 0,
    cleanseCorrodeAmount: 0,
    retaliateDamage: 0,
    pustuleRuptureCorrode: 0,
    upchargeGained: 0,
    dudCount: 0,
    armorGained: 0,
    freeTurnTriggered: false,
    droneSyncTriggered: null,
  };

  if (!combat) {
    return emptyPreview;
  }

  const matching = combat.board.filter((t) => t.type === color && !t.isJammed);
  const cleanMatching = matching.filter((t) => !t.isBlight);
  const blightPurgeCount = color === 'tech' ? matching.filter((t) => t.isBlight).length : 0;

  const contagionDiscardIdxSet = new Set<number>();
  combat.board.forEach((tile, idx) => {
    if (tile.type === color && !tile.isJammed && tile.isContagion) {
      for (const adjIdx of [idx - 1, idx + 1]) {
        const adj = combat.board[adjIdx];
        if (adj && (adj.type !== color || adj.isJammed)) {
          contagionDiscardIdxSet.add(adjIdx);
        }
      }
    }
  });
  const contagionDiscardedCount = contagionDiscardIdxSet.size;
  const hotPotatoPassedDamage =
    matching.filter((t) => Boolean(t.isHotPotato)).length * HOT_POTATO_PASS_DAMAGE;
  const temptationCleaveBonus =
    matching.filter((t) => Boolean(t.isTemptation)).length * TEMPTATION_CLEAVE_BONUS;

  const stayCount = Math.max(0, combat.board.length - matching.length - contagionDiscardedCount);
  const surgeTriggered = cleanMatching.length >= surgeThreshold;
  const dudCount = cleanMatching.filter((t) => isReactorCoreTile(t)).length;
  const armorGained = dudCount * (heroSpec.dudArmorPerTile ?? 0);
  const freeTurnTriggered =
    color === 'attack' &&
    cleanMatching.length > 0 &&
    (heroSpec.blitzReflexCooldownTurns ?? 0) > 0 &&
    (combat.blitzReflexCooldown ?? 0) === 0;
  const droneSyncTriggered: TileType | null =
    heroSpec.triDroneSync &&
    combat.primedDrone &&
    combat.primedDrone !== color &&
    cleanMatching.length > 0
      ? combat.primedDrone
      : null;
  const dronePierceBonus =
    droneSyncTriggered === 'attack' ? (heroSpec.triDroneSync?.attackPierceDamage ?? 0) : 0;
  const droneShieldBonus =
    droneSyncTriggered === 'defense' ? (heroSpec.triDroneSync?.defenseShield ?? 0) : 0;
  const droneHealBonus =
    droneSyncTriggered === 'tech' ? (heroSpec.triDroneSync?.techHeal ?? 0) : 0;

  const computeBaseOverdriveFromTiles = (): number => {
    let sum = 0;
    for (const t of cleanMatching) {
      if (isReactorCoreTile(t) && (heroSpec.dudOverdrivePerTile ?? 0) > 0) {
        sum += heroSpec.dudOverdrivePerTile;
      } else if (color === 'attack') {
        sum += heroSpec.attackOverdrivePerTile;
      } else if (color === 'defense') {
        sum += heroSpec.defenseOverdrivePerTile;
      } else {
        sum += heroSpec.techOverdrivePerTile;
      }
    }
    return sum;
  };
  const isBloodlineResonant =
    Boolean(run.hero.bloodlineCrest) && combat.bloodlineResonanceActive === color;
  const upchargeGained =
    cleanMatching.reduce((sum, t) => sum + (t.upcharge ?? 0), 0) +
    dudCount * heroSpec.dudUpchargePerTile +
    (isBloodlineResonant && cleanMatching.length > 0 ? 1 : 0);
  const storkShieldBonus = cleanMatching.reduce((sum, t) => sum + (t.shieldAuraBonus ?? 0), 0);
  const storkPierceBoost = cleanMatching.some((t) => Boolean(t.pierceBoost));

  const activeHexCasterIds = new Set<string>();
  for (const tile of matching) {
    if (!tile.hexedByEnemyId) continue;
    const caster = combat.enemies.find((e) => e.id === tile.hexedByEnemyId && e.hp > 0);
    if (caster) activeHexCasterIds.add(caster.id);
  }

  if (matching.length === 0) {
    return {
      ...emptyPreview,
      stayCount,
    };
  }

  const withSurvivingHexBonuses = (preview: TurnPreview): TurnPreview => {
    const enriched: TurnPreview = {
      ...preview,
      hotPotatoPassedDamage,
      contagionDiscardedCount,
      temptationCleaveBonus,
    };
    if (activeHexCasterIds.size === 0) {
      return { ...enriched, hexedHealBonus: 0, hexedArmorBonus: 0 };
    }
    const sim = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, enriched);
    let survivingCasters = 0;
    for (const casterId of activeHexCasterIds) {
      if (sim.enemies.some((e) => e.id === casterId && e.hp > 0)) {
        survivingCasters++;
      }
    }
    return {
      ...enriched,
      hexedHealBonus: survivingCasters * HEX_HEAL_AMOUNT,
      hexedArmorBonus: survivingCasters * HEX_ARMOR_AMOUNT,
    };
  };

  if (color === 'attack') {
    let baseDamage = 0;
    let hybridShieldBonus = 0;
    let hybridBoostPct = 0;
    for (const tile of cleanMatching) {
      baseDamage += getEffectiveTileValue(
        tile,
        run.hero,
        combat.bloodlineResonanceActive,
      ).value;
      if (tile.secondaryType === 'defense' && (tile.secondaryValue ?? 0) > 0) {
        hybridShieldBonus += tile.secondaryValue ?? 0;
      } else if (tile.secondaryType === 'tech') {
        hybridBoostPct += tile.secondaryValue ?? 10;
      }
    }
    if (run.hero.scionAlliedHouse === 'house_solaris' && cleanMatching.length > 0) {
      baseDamage += 2;
    }
    const rawTotal = Math.floor(baseDamage * (1 + damageBoostPct / 100));
    const totalDamage =
      combat.battlefieldRule === 'volatile_atmosphere' && rawTotal > 0
        ? Math.round(rawTotal * 1.25)
        : rawTotal;
    const cleaveDamage = surgeTriggered ? Math.floor(totalDamage * 0.5) : 0;
    const armorPiercing = hasImplant(implants, 'piercing_katana') || storkPierceBoost;
    const retaliateDamage = (() => {
      if (surgeTriggered) return 0;
      const front = combat.enemies.find((e) => e.hp > 0 && !e.escaped);
      if (!front || front.passive !== 'spike_retaliate') return 0;
      const simHit = applyDamageToEnemy(front, totalDamage, armorPiercing ? 0.4 : 0, false);
      return simHit.defeated ? 0 : 3;
    })();
    const pustuleRuptureCorrode = (() => {
      if (surgeTriggered || totalDamage <= 0) return 0;
      const front = combat.enemies.find((e) => e.hp > 0 && !e.escaped);
      if (!front || front.passive !== 'acid_jam' || front.propKind) return 0;
      const simHit = applyDamageToEnemy(front, totalDamage, armorPiercing ? 0.4 : 0, false);
      return simHit.defeated ? 0 : PUSTULE_RUPTURE_CORRODE;
    })();
    return withSurvivingHexBonuses({
      color,
      tileCount: matching.length,
      stayCount,
      baseDamage,
      damageBoostPct,
      totalDamage,
      cleaveDamage,
      armorPiercing,
      shieldGained: hybridShieldBonus + storkShieldBonus + droneShieldBonus,
      damageBoostAddedPct: hybridBoostPct,
      healAmount: droneHealBonus,
      overdriveGained: computeBaseOverdriveFromTiles(),
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: 0,
      armorShredAmount: 0,
      techPierceDamage: dronePierceBonus,
      cleanseCorrodeAmount: 0,
      retaliateDamage,
      pustuleRuptureCorrode,
      blightPurgeCount,
      upchargeGained,
      dudCount,
      armorGained,
      freeTurnTriggered,
      droneSyncTriggered,
    });
  }

  if (color === 'defense') {
    let rawShield = 0;
    let hybridPierceDamage = 0;
    let hybridBoostPct = 0;
    for (const tile of cleanMatching) {
      rawShield += getEffectiveTileValue(
        tile,
        run.hero,
        combat.bloodlineResonanceActive,
      ).value;
      if (tile.secondaryType === 'attack' && (tile.secondaryValue ?? 0) > 0) {
        hybridPierceDamage += tile.secondaryValue ?? 0;
      } else if (tile.secondaryType === 'tech') {
        hybridBoostPct += tile.secondaryValue ?? 10;
      }
    }
    if (run.hero.scionAlliedHouse === 'house_valkyr' && cleanMatching.length > 0) {
      rawShield += 3;
    }
    const magneticBonus =
      combat.battlefieldRule === 'magnetic_surge' && cleanMatching.length > 0 ? 2 : 0;
    const shieldGained =
      Math.max(0, rawShield - run.hero.corrode) + magneticBonus + storkShieldBonus + droneShieldBonus;
    const surgeReflect = surgeTriggered ? 8 : 0;
    return withSurvivingHexBonuses({
      color,
      tileCount: matching.length,
      stayCount,
      baseDamage: 0,
      damageBoostPct,
      totalDamage: 0,
      cleaveDamage: 0,
      armorPiercing: storkPierceBoost,
      shieldGained,
      damageBoostAddedPct: hybridBoostPct,
      healAmount: droneHealBonus,
      overdriveGained: computeBaseOverdriveFromTiles(),
      surgeTriggered,
      surgeThreshold,
      reflectOnBlock: surgeReflect,
      armorShredAmount: 0,
      techPierceDamage: hybridPierceDamage + dronePierceBonus,
      cleanseCorrodeAmount: 0,
      retaliateDamage: 0,
      blightPurgeCount,
      upchargeGained,
      dudCount,
      armorGained,
      freeTurnTriggered,
      droneSyncTriggered,
    });
  }

  let damageBoostAddedPct = isBloodlineResonant && cleanMatching.length > 0 ? 15 : 0;
  let healAmount = droneHealBonus;
  let armorShredAmount = 0;
  let techPierceDamage = dronePierceBonus;
  let bonusOverdrive = 0;
  let cleanseCorrodeAmount = 0;
  let techShieldFromTiles = droneShieldBonus;

  for (const tile of cleanMatching) {
    const eff = tile.techEffect;
    if (eff) {
      if (eff.kind === 'damage_boost') {
        damageBoostAddedPct += eff.percent;
      } else if (eff.kind === 'heal') {
        healAmount += eff.amount;
      } else if (eff.kind === 'armor_shred') {
        armorShredAmount += eff.shredAmount;
        techPierceDamage += eff.pierceDamage;
      } else if (eff.kind === 'overdrive_surge') {
        bonusOverdrive += eff.bonusOverdrive;
        cleanseCorrodeAmount += eff.cleanseCorrode;
      } else if (eff.kind === 'tactical_shield') {
        techShieldFromTiles += eff.shieldAmount;
        damageBoostAddedPct += eff.damageBoostPct;
      }
    }
    if (tile.secondaryType === 'attack' && (tile.secondaryValue ?? 0) > 0) {
      techPierceDamage += tile.secondaryValue ?? 0;
    } else if (tile.secondaryType === 'defense' && (tile.secondaryValue ?? 0) > 0) {
      techShieldFromTiles += tile.secondaryValue ?? 0;
    }
  }

  let overdriveGained = computeBaseOverdriveFromTiles() + bonusOverdrive;
  if (cleanMatching.length > 0 && hasImplant(implants, 'flux_injector')) {
    overdriveGained += 10;
  }
  if (surgeTriggered) {
    overdriveGained += 15;
  }

  const synapseShield = hasImplant(implants, 'synapse_overclock') ? cleanMatching.length * 3 : 0;
  const surgeShield = surgeTriggered ? 6 : 0;

  return withSurvivingHexBonuses({
    color,
    tileCount: matching.length,
    stayCount,
    baseDamage: 0,
    damageBoostPct,
    totalDamage: 0,
    cleaveDamage: 0,
    armorPiercing: storkPierceBoost,
    shieldGained: synapseShield + surgeShield + techShieldFromTiles + storkShieldBonus,
    damageBoostAddedPct,
    healAmount,
    overdriveGained,
    surgeTriggered,
    surgeThreshold,
    reflectOnBlock: 0,
    armorShredAmount,
    techPierceDamage,
    cleanseCorrodeAmount,
    retaliateDamage: 0,
    blightPurgeCount,
    upchargeGained,
    dudCount,
    armorGained,
    freeTurnTriggered,
    droneSyncTriggered,
  });
}

export function previewHeroThreat(
  combat: CombatState | null,
  hero: HeroState,
  activePreview: TurnPreview | null = null,
): HeroThreatPreview {
  if (!combat || combat.phase !== 'PLAYER_IDLE' || hero.hp <= 0) {
    return {
      rawIncomingDamage: 0,
      blockedDamage: 0,
      hpDamageTaken: 0,
      hpLossOnBar: 0,
      healGained: 0,
      shieldAfterPlayer: hero.shield,
      shieldAfterEnemies: hero.shield,
      armorAfterPlayer: hero.armor ?? 0,
      armorAfterEnemies: hero.armor ?? 0,
      armorAbsorbed: 0,
      hpBeforeEnemies: hero.hp,
      projectedHp: hero.hp,
      corrodeGained: 0,
      attackersCount: 0,
      preventedDamageByKills: 0,
      willDie: false,
      retaliateDamage: 0,
      willJamTile: false,
    };
  }

  let baselineIncoming = 0;
  for (let i = 0; i < combat.enemies.length; i++) {
    const enemy = combat.enemies[i];
    if (enemy.hp <= 0 || enemy.escaped) continue;
    const { intent } = getSafeEnemyIntent(enemy);
    if (intent && isDamagingIntent(intent)) {
      baselineIncoming += getEffectiveEnemyIntentValue(enemy, intent, {
        battlefieldRule: combat.battlefieldRule,
      });
    }
  }

  let simEnemies = combat.enemies.map((e) => ({ ...e }));
  let defeatedNow = 0;
  let retaliateDamage = 0;
  let pustuleRuptureCorrode = 0;

  if (activePreview && activePreview.tileCount > 0) {
    const simResult = simulatePlayerActionOnEnemies(combat.enemies, combat.turn, activePreview);
    simEnemies = simResult.enemies;
    defeatedNow = simResult.defeatedNow;
    retaliateDamage = simResult.retaliateDamage;
    pustuleRuptureCorrode = simResult.pustuleRuptureCorrode;
  }

  const tileHeal = activePreview && activePreview.tileCount > 0 ? activePreview.healAmount : 0;
  const hpAfterTileHeal = Math.min(hero.maxHp, hero.hp + tileHeal);
  const shieldAfterPlayer =
    hero.shield + (activePreview && activePreview.tileCount > 0 ? activePreview.shieldGained : 0);

  let hexHealTriggered = 0;
  if (activePreview && activePreview.tileCount > 0) {
    const resolvedCasterIds = new Set<string>();
    for (const t of combat.board) {
      if (t.type === activePreview.color && !t.isJammed && t.hexedByEnemyId) {
        resolvedCasterIds.add(t.hexedByEnemyId);
      }
    }
    for (const casterId of resolvedCasterIds) {
      const caster = simEnemies.find((e) => e.id === casterId && e.hp > 0);
      if (caster) {
        hexHealTriggered += Math.min(caster.maxHp - caster.hp, HEX_HEAL_AMOUNT);
      }
    }
  }

  let simShield = shieldAfterPlayer;
  const armorAfterPlayer =
    (hero.armor ?? 0) +
    (activePreview && activePreview.tileCount > 0 ? (activePreview.armorGained ?? 0) : 0);
  let simArmor = armorAfterPlayer;
  let rawIncomingDamage = 0;
  let blockedDamage = 0;
  let armorAbsorbed = 0;
  let hpDamageTaken = 0;
  let corrodeGained = pustuleRuptureCorrode;
  let attackersCount = 0;
  let willJamTile = false;
  let conditionalBonusDamage = 0;

  let retHpDmg = 0;
  if (retaliateDamage > 0) {
    rawIncomingDamage += retaliateDamage;
    const absRet = absorbHeroDamage(simShield, simArmor, retaliateDamage);
    simShield = absRet.nextShield;
    simArmor = absRet.nextArmor;
    blockedDamage += absRet.blockedByShield + absRet.blockedByArmor;
    armorAbsorbed += absRet.blockedByArmor;
    retHpDmg = absRet.hpDamage;
    hpDamageTaken += retHpDmg;
  }

  const hpAfterRetaliate = Math.max(0, hpAfterTileHeal - retHpDmg);
  const rawBioSiphon =
    defeatedNow > 0 && hasImplant(hero.implants, 'bio_siphon') ? defeatedNow * 4 : 0;
  const bioSiphonHeal = hpAfterRetaliate > 0 ? rawBioSiphon : 0;
  const healGained = tileHeal + bioSiphonHeal;
  const hpBeforeEnemies =
    hpAfterRetaliate <= 0 ? 0 : Math.min(hero.maxHp, hpAfterRetaliate + bioSiphonHeal);

  const colorPlayed = activePreview && activePreview.tileCount > 0 ? activePreview.color : null;
  const hostilesRemain = hasHostileLivingEnemies(simEnemies);

  let nonRetHpDamage = 0;
  if (hpBeforeEnemies > 0 && hostilesRemain) {
    for (let i = 0; i < simEnemies.length; i++) {
      const enemy = simEnemies[i];
      if (enemy.hp <= 0 || enemy.escaped) continue;
      const { intent } = getSafeEnemyIntent(enemy);
      if (!intent) continue;
      const intentCtx = {
        shieldAfterPlayer: simShield,
        colorPlayed,
        battlefieldRule: combat.battlefieldRule,
      };
      const incoming = getEffectiveEnemyIntentValue(enemy, intent, intentCtx);
      if (!isDamagingIntent(intent) || enemy.staggered || incoming <= 0) continue;

      attackersCount++;
      if (isIntentConditionMet(intent, intentCtx)) {
        conditionalBonusDamage += intent.conditionBonus ?? 0;
      }
      rawIncomingDamage += incoming;
      const abs = absorbHeroDamage(simShield, simArmor, incoming, {
        pierceShield: intent.pierceShield,
        overwhelmMultiplier: intent.overwhelmMultiplier,
      });
      simShield = abs.nextShield;
      simArmor = abs.nextArmor;
      blockedDamage += abs.blockedByShield + abs.blockedByArmor;
      armorAbsorbed += abs.blockedByArmor;
      const hpDmg = abs.hpDamage;
      hpDamageTaken += hpDmg;
      nonRetHpDamage += hpDmg;
      if (intent.kind === 'acid') {
        corrodeGained += intent.secondaryValue ?? 2;
        const postShieldAcid = Math.max(0, incoming - abs.blockedByShield);
        const unblockedAcidHit = hpDmg > Math.floor(postShieldAcid * 0.1);
        if (unblockedAcidHit && enemy.archetype === 'boss') {
          willJamTile = true;
        }
      } else if (intent.corrodeAmount && intent.corrodeAmount > 0) {
        corrodeGained += intent.corrodeAmount;
      }
    }
  }

  const unpurgedBlightCount =
    hpBeforeEnemies > 0 && hostilesRemain
      ? combat.board.filter((t) => t.isBlight && (colorPlayed !== 'tech' || t.isJammed)).length
      : 0;
  const blightChipDamage = unpurgedBlightCount * BLIGHT_HOLD_CHIP_DAMAGE;
  if (blightChipDamage > 0) {
    rawIncomingDamage += blightChipDamage;
    const absBlight = absorbHeroDamage(simShield, simArmor, blightChipDamage);
    simShield = absBlight.nextShield;
    simArmor = absBlight.nextArmor;
    blockedDamage += absBlight.blockedByShield + absBlight.blockedByArmor;
    armorAbsorbed += absBlight.blockedByArmor;
    hpDamageTaken += absBlight.hpDamage;
    nonRetHpDamage += absBlight.hpDamage;
  }

  const unresolvedHotPotatoCount =
    hpBeforeEnemies > 0 && hostilesRemain
      ? combat.board.filter((t) => t.isHotPotato && (t.type !== colorPlayed || t.isJammed)).length
      : 0;
  const hotPotatoSelfDamage = unresolvedHotPotatoCount * HOT_POTATO_SELF_DAMAGE;
  if (hotPotatoSelfDamage > 0) {
    rawIncomingDamage += hotPotatoSelfDamage;
    const absPotato = absorbHeroDamage(simShield, simArmor, hotPotatoSelfDamage);
    simShield = absPotato.nextShield;
    simArmor = absPotato.nextArmor;
    blockedDamage += absPotato.blockedByShield + absPotato.blockedByArmor;
    armorAbsorbed += absPotato.blockedByArmor;
    hpDamageTaken += absPotato.hpDamage;
    nonRetHpDamage += absPotato.hpDamage;
  }

  const projectedHp =
    hpBeforeEnemies <= 0 ? 0 : Math.max(0, hpBeforeEnemies - nonRetHpDamage);
  const hpLossOnBar = Math.max(0, hero.hp - projectedHp);
  const preventedDamageByKills = Math.max(
    0,
    baselineIncoming -
      (rawIncomingDamage - retaliateDamage - blightChipDamage - hotPotatoSelfDamage),
  );
  const willDie = hero.hp > 0 && hpDamageTaken > 0 && projectedHp <= 0;

  return {
    rawIncomingDamage,
    blockedDamage,
    hpDamageTaken,
    hpLossOnBar,
    healGained,
    shieldAfterPlayer,
    shieldAfterEnemies: simShield,
    armorAfterPlayer,
    armorAfterEnemies: simArmor,
    armorAbsorbed,
    hpBeforeEnemies: Math.min(hero.maxHp, hero.hp + healGained),
    projectedHp,
    corrodeGained,
    attackersCount,
    preventedDamageByKills,
    willDie,
    retaliateDamage,
    willJamTile,
    conditionalBonusDamage,
    blightChipDamage,
    hotPotatoSelfDamage,
    hexHealTriggered,
  };
}
