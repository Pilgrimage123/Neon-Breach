import {
  PLASMA_BARREL_BURST_DAMAGE,
  STAGGER_BURST_THRESHOLD,
  VOLATILE_BURST_DAMAGE,
  WEAPON_BREAK_THRESHOLD,
} from '../../engine/gameEngine';
import {
  getEffectiveEnemyIntentValue,
} from '../../engine/reinforcementDirector';
import type {
  EnemyIntent,
  EnemyPropKind,
  EnemyUnit,
  TurnPreview,
} from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';

export {
  computeEffectiveSlotCount,
  computeEnemyHitBoxes,
  computeEnemySlotLayout,
  hitTestEnemySprite,
  type EnemyHitBox,
  type EnemySlotLayout,
} from './combatEnemyLayout';

export interface EnemyArmorPreview {
  rawPreviewDmg: number;
  willBreakArmor: boolean;
  armorAbsorbed: number;
  remainingArmor: number;
  previewHpLoss: number;
  projectedHp: number;
  willDie: boolean;
  willCrackShieldPip: boolean;
  remainingShieldPips: number;
  willTriggerPhaseGate: boolean;
  chainedBurstDmg: number;
  willStagger?: boolean;
  willBreakWeapon?: boolean;
}

function applyPhaseGateClamp(
  enemy: EnemyUnit,
  projectedHp: number,
  remainingArmor: number,
  remainingShieldPips: number,
): {
  projectedHp: number;
  previewHpLoss: number;
  remainingArmor: number;
  remainingShieldPips: number;
  willTriggerPhaseGate: boolean;
  willDie: boolean;
} {
  if (enemy.phaseGatePct && !enemy.phaseGateTriggered) {
    const thresholdHp = Math.ceil((enemy.maxHp * enemy.phaseGatePct) / 100);
    if (enemy.hp > thresholdHp && projectedHp < thresholdHp) {
      return {
        projectedHp: thresholdHp,
        previewHpLoss: enemy.hp - thresholdHp,
        remainingArmor: remainingArmor + 10,
        remainingShieldPips: Math.max(remainingShieldPips, 1),
        willTriggerPhaseGate: true,
        willDie: false,
      };
    }
  }
  return {
    projectedHp,
    previewHpLoss: enemy.hp - projectedHp,
    remainingArmor,
    remainingShieldPips,
    willTriggerPhaseGate: false,
    willDie: projectedHp <= 0,
  };
}

export function computeEnemyArmorPreview(
  enemy: EnemyUnit,
  idx: number,
  frontLivingIdx: number,
  activePreview: TurnPreview | null,
  allEnemies?: readonly EnemyUnit[],
): EnemyArmorPreview {
  const isDead = enemy.hp <= 0 || Boolean(enemy.escaped);
  const isFrontLiving = idx === frontLivingIdx;

  if (!activePreview || isDead) {
    return {
      rawPreviewDmg: 0,
      willBreakArmor: false,
      armorAbsorbed: 0,
      remainingArmor: enemy.armor,
      previewHpLoss: 0,
      projectedHp: enemy.hp,
      willDie: false,
      willCrackShieldPip: false,
      remainingShieldPips: enemy.shieldPips,
      willTriggerPhaseGate: false,
      chainedBurstDmg: 0,
    };
  }

  // Check if frontline enemy is a Spore Mite ('volatile_burst') or Plasma Barrel that will die from this action
  let frontVolatileBurstDmg = 0;
  if (!isFrontLiving && allEnemies && frontLivingIdx >= 0 && frontLivingIdx < allEnemies.length) {
    const frontUnit = allEnemies[frontLivingIdx];
    if (
      frontUnit &&
      frontUnit.hp > 0 &&
      (frontUnit.passive === 'volatile_burst' || frontUnit.propKind === 'plasma_barrel')
    ) {
      const frontSim = computeEnemyArmorPreview(
        frontUnit,
        frontLivingIdx,
        frontLivingIdx,
        activePreview,
      );
      if (frontSim.willDie) {
        frontVolatileBurstDmg =
          frontUnit.propKind === 'plasma_barrel'
            ? PLASMA_BARREL_BURST_DAMAGE
            : VOLATILE_BURST_DAMAGE;
      }
    }
  }
  const chainedBurstDmg = frontVolatileBurstDmg;
  const hotPotatoBonus = isFrontLiving ? (activePreview.hotPotatoPassedDamage ?? 0) : 0;
  const temptationBonus = activePreview.temptationCleaveBonus ?? 0;

  if (activePreview.color === 'tech') {
    const shredded = Math.min(enemy.armor, activePreview.armorShredAmount);
    let remainingArmor = Math.max(0, enemy.armor - shredded);
    let remainingShieldPips = enemy.shieldPips;
    let willCrackShieldPip = false;
    const frontTechDmg =
      (isFrontLiving ? activePreview.techPierceDamage : 0) + hotPotatoBonus + temptationBonus;

    let directHpLoss = 0;
    if (frontTechDmg > 0) {
      if (remainingShieldPips > 0) {
        remainingShieldPips -= 1;
        willCrackShieldPip = true;
      } else {
        directHpLoss = Math.min(enemy.hp, frontTechDmg);
      }
    }

    let projectedHp = Math.max(0, enemy.hp - directHpLoss);
    let willTriggerPhaseGate = false;
    if (directHpLoss > 0) {
      const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
      projectedHp = gated.projectedHp;
      remainingArmor = gated.remainingArmor;
      remainingShieldPips = gated.remainingShieldPips;
      willTriggerPhaseGate = gated.willTriggerPhaseGate;
    }

    if (chainedBurstDmg > 0 && projectedHp > 0) {
      if (remainingShieldPips > 0) {
        remainingShieldPips -= 1;
        willCrackShieldPip = true;
      } else {
        projectedHp = Math.max(0, projectedHp - chainedBurstDmg);
        const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
        projectedHp = gated.projectedHp;
        remainingArmor = gated.remainingArmor;
        remainingShieldPips = gated.remainingShieldPips;
        willTriggerPhaseGate = willTriggerPhaseGate || gated.willTriggerPhaseGate;
      }
    }

    const previewHpLoss = enemy.hp - projectedHp;
    const willDie = (frontTechDmg > 0 || chainedBurstDmg > 0) && projectedHp <= 0;
    return {
      rawPreviewDmg: frontTechDmg + chainedBurstDmg,
      willBreakArmor: enemy.armor > 0 && shredded >= enemy.armor,
      armorAbsorbed: shredded,
      remainingArmor,
      previewHpLoss,
      projectedHp,
      willDie,
      willCrackShieldPip,
      remainingShieldPips,
      willTriggerPhaseGate,
      chainedBurstDmg,
    };
  }

  const baseActionDmg = isFrontLiving
    ? activePreview.totalDamage > 0
      ? activePreview.totalDamage
      : activePreview.reflectOnBlock
    : activePreview.cleaveDamage;
  const defPierceBonus =
    activePreview.color === 'defense' && isFrontLiving ? activePreview.techPierceDamage : 0;
  const directRawDmg = baseActionDmg + defPierceBonus + hotPotatoBonus + temptationBonus;

  let remainingShieldPips = enemy.shieldPips;
  let willCrackShieldPip = false;
  let remainingArmor = enemy.armor;
  let armorAbsorbed = 0;
  let willBreakArmor = false;
  let projectedHp = enemy.hp;
  let willTriggerPhaseGate = false;

  const baseAndOtherRaw = baseActionDmg + hotPotatoBonus + temptationBonus;
  if (baseAndOtherRaw > 0) {
    if (remainingShieldPips > 0) {
      remainingShieldPips -= 1;
      willCrackShieldPip = true;
    } else {
      willBreakArmor = Boolean(
        activePreview.color === 'attack' &&
          activePreview.surgeTriggered &&
          isFrontLiving &&
          enemy.armor > 0,
      );
      const pierceRatio =
        activePreview.color === 'attack' && activePreview.armorPiercing ? 0.3 : 0;
      const effectiveArmor = willBreakArmor ? 0 : remainingArmor;
      const piercingDmg =
        Math.floor(baseActionDmg * pierceRatio) + hotPotatoBonus + Math.floor(temptationBonus * 0.5);
      const regularDmg = Math.max(0, baseAndOtherRaw - piercingDmg);
      const absorbed = Math.min(effectiveArmor, regularDmg);
      armorAbsorbed += absorbed;
      remainingArmor = Math.max(0, effectiveArmor - absorbed);
      const hpLoss = Math.min(projectedHp, regularDmg - absorbed + piercingDmg);
      projectedHp = Math.max(0, projectedHp - hpLoss);

      const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
      projectedHp = gated.projectedHp;
      remainingArmor = gated.remainingArmor;
      remainingShieldPips = gated.remainingShieldPips;
      willTriggerPhaseGate = gated.willTriggerPhaseGate;
    }
  }

  if (defPierceBonus > 0 && projectedHp > 0) {
    if (remainingShieldPips > 0) {
      remainingShieldPips -= 1;
      willCrackShieldPip = true;
    } else {
      projectedHp = Math.max(0, projectedHp - defPierceBonus);
      const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
      projectedHp = gated.projectedHp;
      remainingArmor = gated.remainingArmor;
      remainingShieldPips = gated.remainingShieldPips;
      willTriggerPhaseGate = willTriggerPhaseGate || gated.willTriggerPhaseGate;
    }
  }

  if (chainedBurstDmg > 0 && projectedHp > 0) {
    if (remainingShieldPips > 0) {
      remainingShieldPips -= 1;
      willCrackShieldPip = true;
    } else {
      projectedHp = Math.max(0, projectedHp - chainedBurstDmg);
      const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
      projectedHp = gated.projectedHp;
      remainingArmor = gated.remainingArmor;
      remainingShieldPips = gated.remainingShieldPips;
      willTriggerPhaseGate = willTriggerPhaseGate || gated.willTriggerPhaseGate;
    }
  }

  const rawPreviewDmg = directRawDmg + chainedBurstDmg;
  const previewHpLoss = enemy.hp - projectedHp;
  const willDie = rawPreviewDmg > 0 && projectedHp <= 0;
  const curIntent = enemy.intentCycle[enemy.currentIntentIndex];
  const totalBurstTurnDmg = (enemy.turnDamageTaken ?? 0) + previewHpLoss + armorAbsorbed;
  const willStagger =
    !willDie &&
    !enemy.staggered &&
    (curIntent?.kind === 'charge' || curIntent?.kind === 'heavy') &&
    totalBurstTurnDmg >= STAGGER_BURST_THRESHOLD;
  const willBreakWeapon =
    !willDie &&
    !enemy.weaponBroken &&
    (curIntent?.kind === 'charge' || curIntent?.kind === 'heavy') &&
    totalBurstTurnDmg >= WEAPON_BREAK_THRESHOLD;

  return {
    rawPreviewDmg,
    willBreakArmor,
    armorAbsorbed,
    remainingArmor,
    previewHpLoss,
    projectedHp,
    willDie,
    willCrackShieldPip,
    remainingShieldPips,
    willTriggerPhaseGate,
    chainedBurstDmg,
    willStagger,
    willBreakWeapon,
  };
}

export interface EnemyIntentFormatOptions {
  staggered?: boolean;
  conditionActive?: boolean;
  weaponBroken?: boolean;
  desperationEnraged?: boolean;
  sleepCounter?: number;
  isLootRunner?: boolean;
  escapeTurnsLeft?: number;
  propKind?: EnemyPropKind;
  reviveTimer?: number;
}

export function formatEnemyIntentCompact(
  intent: EnemyIntent,
  lang: Language,
  enrageAtkBonus = 0,
  options?: EnemyIntentFormatOptions,
): string {
  const t = TRANSLATIONS[lang];
  if (options?.propKind === 'plasma_barrel') {
    return '🛢 10 AOE';
  }
  if (options?.propKind === 'decoy_totem') {
    return '⛩ DECOY';
  }
  if (options?.propKind === 'bio_husk') {
    return `💀 ${options.reviveTimer ?? 2}T REV`;
  }
  if (options?.isLootRunner) {
    return `💰 ${options.escapeTurnsLeft ?? 3}T WARP`;
  }
  if (options?.sleepCounter && options.sleepCounter > 0) {
    return `💤 ${options.sleepCounter} HIT`;
  }
  if (
    options?.staggered &&
    (intent.kind === 'attack' ||
      intent.kind === 'heavy' ||
      intent.kind === 'acid' ||
      intent.kind === 'leech' ||
      intent.kind === 'charge')
  ) {
    return '⚡ 0 DMG';
  }
  const hasMod =
    enrageAtkBonus > 0 || Boolean(options?.weaponBroken) || Boolean(options?.desperationEnraged);
  const val = hasMod
    ? getEffectiveEnemyIntentValue(
        {
          enrageAtkBonus,
          weaponBroken: options?.weaponBroken,
          desperationEnraged: options?.desperationEnraged,
        },
        intent,
      )
    : intent.value;
  const condVal =
    intent.condition && intent.conditionBonus
      ? options?.conditionActive
        ? `${val + intent.conditionBonus} DMG!`
        : `${val}(+${intent.conditionBonus}?) DMG`
      : `${val} DMG`;
  switch (intent.kind) {
    case 'attack':
    case 'heavy': {
      const extraParts: string[] = [];
      if (intent.corrodeAmount) extraParts.push(`+${intent.corrodeAmount} ${t.corrodeShort}`);
      if (intent.armorOnHit) extraParts.push(`+${intent.armorOnHit} ${t.armorShort}`);
      return extraParts.length > 0 ? `${condVal} · ${extraParts.join(' ')}` : condVal;
    }
    case 'acid':
      return `${val} DMG +${intent.secondaryValue ?? 2} ${t.corrodeShort}`;
    case 'armor':
      return intent.secondaryValue && intent.secondaryValue > 0
        ? `+${val} ${t.armorShort} · +${intent.secondaryValue} ${t.hpLabel}`
        : `+${val} ${t.armorShort}`;
    case 'bolster':
      return `+${val} ${t.armorShort} ${t.allShort}`;
    case 'charge':
      return `0 DMG (${intent.secondaryValue ?? 1}T → ${val})`;
    case 'leech':
      return `${val} DMG +${intent.secondaryValue ?? 4} ${t.hpLabel}`;
    default:
      return `${val} DMG`;
  }
}

export function formatEnemyIntentSummary(
  intent: EnemyIntent,
  lang: Language,
  enrageAtkBonus = 0,
  options?: EnemyIntentFormatOptions,
): string {
  const t = TRANSLATIONS[lang];
  if (options?.propKind === 'plasma_barrel') {
    return lang === 'cs' ? '🛢 PLAZMOVÝ SUD · 10 PRŮRAZ AOE' : '🛢 PLASMA BARREL · 10 PIERCE AOE';
  }
  if (options?.propKind === 'decoy_totem') {
    return lang === 'cs' ? '⛩ HOLO-TOTEM · KRYJE ZADNÍ LINII' : '⛩ DECOY TOTEM · INTERCEPTS FRONT';
  }
  if (options?.propKind === 'bio_husk') {
    return lang === 'cs'
      ? `💀 BIO-SCHRÁNKA · OŽIJE ZA ${options.reviveTimer ?? 2}T`
      : `💀 BIO-HUSK · REVIVES IN ${options.reviveTimer ?? 2}T`;
  }
  if (options?.isLootRunner) {
    return lang === 'cs'
      ? `💰 KURÝR · ÚNIK ZA ${options.escapeTurnsLeft ?? 3}T (+25 CR)`
      : `💰 LOOT RUNNER · WARPS IN ${options.escapeTurnsLeft ?? 3}T (+25 CR)`;
  }
  if (options?.sleepCounter && options.sleepCounter > 0) {
    return lang === 'cs'
      ? `💤 SPÍCÍ · 0 DMG (${options.sleepCounter} ÚTOK PROBUDÍ)`
      : `💤 DORMANT · 0 DMG (${options.sleepCounter} ATK TO WAKE)`;
  }
  if (
    options?.staggered &&
    (intent.kind === 'attack' ||
      intent.kind === 'heavy' ||
      intent.kind === 'acid' ||
      intent.kind === 'leech' ||
      intent.kind === 'charge')
  ) {
    return lang === 'cs' ? '⚡ 0 DMG · OMRÁČEN' : '⚡ 0 DMG · STAGGERED';
  }
  const hasMod =
    enrageAtkBonus > 0 || Boolean(options?.weaponBroken) || Boolean(options?.desperationEnraged);
  const val = hasMod
    ? getEffectiveEnemyIntentValue(
        {
          enrageAtkBonus,
          weaponBroken: options?.weaponBroken,
          desperationEnraged: options?.desperationEnraged,
        },
        intent,
      )
    : intent.value;
  const condTag =
    intent.condition === 'if_no_shield'
      ? lang === 'cs'
        ? 'při 0 Štítu'
        : 'if 0 Shield'
      : intent.condition === 'if_play_attack'
        ? lang === 'cs'
          ? 'při Útoku'
          : 'if ATK played'
        : intent.condition === 'if_play_tech'
          ? lang === 'cs'
            ? 'při TECH'
            : 'if TECH played'
          : '';
  switch (intent.kind) {
    case 'attack':
    case 'heavy': {
      if (intent.condition && intent.conditionBonus) {
        return options?.conditionActive
          ? `${val + intent.conditionBonus} DMG (+${intent.conditionBonus} ${condTag}!)`
          : `${val} DMG (+${intent.conditionBonus} ${condTag})`;
      }
      const extraParts: string[] = [];
      if (intent.corrodeAmount) extraParts.push(`+${intent.corrodeAmount} ${t.corrodeLabel}`);
      if (intent.armorOnHit) {
        extraParts.push(`+${intent.armorOnHit} ${t.armorLabel} (${lang === 'cs' ? 'při zásahu HP' : 'on HP hit'})`);
      }
      return extraParts.length > 0 ? `${val} DMG · ${extraParts.join(' · ')}` : `${val} DMG`;
    }
    case 'acid':
      return `${val} DMG · +${intent.secondaryValue ?? 2} ${t.corrodeLabel}`;
    case 'armor':
      return intent.secondaryValue && intent.secondaryValue > 0
        ? `+${val} ${t.armorLabel} · +${intent.secondaryValue} ${t.hpLabel}`
        : `+${val} ${t.armorLabel}`;
    case 'bolster':
      return `+${val} ${t.armorLabel} (${t.allTargetsLabel})`;
    case 'charge':
      return `0 DMG · ${intent.secondaryValue ?? 1}T → ${val} DMG`;
    case 'leech':
      return `${val} DMG · +${intent.secondaryValue ?? 4} ${t.hpLabel}`;
    default:
      return `${val} DMG`;
  }
}

export function getEnemyReactiveBark(
  enemy: EnemyUnit,
  activePreview: TurnPreview | null,
  armorPreview: EnemyArmorPreview,
  shieldAfterPlayer: number,
  lang: Language = 'en',
): string | null {
  if (!activePreview || activePreview.tileCount === 0 || enemy.hp <= 0 || enemy.escaped) {
    return null;
  }
  if (armorPreview.willDie) {
    if (enemy.propKind === 'plasma_barrel') {
      return lang === 'cs' ? '💥 10 AOE VÝBUCH!' : '💥 10 AOE BLAST!';
    }
    if (enemy.isLootRunner) {
      return lang === 'cs' ? '💰 +25 CR KOŘIST!' : '💰 +25 CR BOUNTY!';
    }
    return null;
  }
  if (armorPreview.willBreakWeapon) {
    return lang === 'cs' ? '🔨 ZBRAŇ ZLOMENA!' : '🔨 WEAPON BREAK!';
  }
  if (armorPreview.willStagger) {
    return lang === 'cs' ? '⚡ OMRÁČENÍ!' : '⚡ STAGGERED!';
  }
  if (enemy.sleepCounter && enemy.sleepCounter > 0) {
    if (activePreview.color === 'attack' && armorPreview.rawPreviewDmg > 0) {
      return lang === 'cs' ? '⚠ PROBOUZÍ SE!' : '⚠ WAKING UP!';
    }
    return lang === 'cs' ? '💤 SPÍ DÁL' : '💤 UNDISTURBED';
  }
  const curIntent = enemy.intentCycle[enemy.currentIntentIndex];
  if (
    activePreview.color === 'attack' &&
    !activePreview.surgeTriggered &&
    enemy.passive === 'spike_retaliate' &&
    armorPreview.rawPreviewDmg > 0
  ) {
    return lang === 'cs' ? '🩸 ODPLATA 3 DMG!' : '🩸 STRIKE & BLEED!';
  }
  if (
    activePreview.color === 'attack' &&
    !activePreview.surgeTriggered &&
    enemy.passive === 'acid_jam' &&
    !enemy.propKind &&
    (activePreview.pustuleRuptureCorrode ?? 0) > 0 &&
    armorPreview.rawPreviewDmg > 0
  ) {
    return lang === 'cs' ? '☣ PUSTULY +2 KOR!' : '☣ PUSTULE +2 COR!';
  }
  if (curIntent?.condition === 'if_no_shield' && shieldAfterPlayer === 0) {
    return lang === 'cs' ? '🎯 BEZ ŠTÍTU +4!' : '🎯 UNSHIELDED PREY!';
  }
  if (curIntent?.condition === 'if_play_attack' && activePreview.color === 'attack') {
    return lang === 'cs' ? '🔥 PROTIÚTOK +4!' : '🔥 COUNTER +4!';
  }
  if ((activePreview.hexedHealBonus ?? 0) > 0 && (enemy.passive === 'acid_jam' || enemy.archetype === 'boss')) {
    return lang === 'cs' ? '⬡ KRMÍŠ MOU KLETBU!' : '⬡ FEED MY HEX!';
  }
  return null;
}
