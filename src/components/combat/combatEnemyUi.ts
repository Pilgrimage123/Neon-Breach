import { STAGGER_BURST_THRESHOLD } from '../../engine/gameEngine';
import { getEffectiveEnemyIntentValue } from '../../engine/reinforcementDirector';
import type { EnemyIntent, EnemyUnit, PendingReinforcement, TurnPreview } from '../../engine/types';
import { TRANSLATIONS, type Language } from '../../i18n/translations';
import { CRAWLER_ARCH_SCALE, isCrawlerArchetype } from '../../utils/crawlerSpriteSheet';
import {
  ENEMY_FOOT_DEFAULTS,
  type EnemyCutoutEntry,
  getStageLayoutMetrics,
} from './combatStageTypes';

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
}

export interface EnemyHitBox {
  enemyId: string;
  idx: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  groundY: number;
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
  const isDead = enemy.hp <= 0;
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

  // Check if frontline enemy is a Spore Mite ('volatile_burst') that will die from this action
  let frontVolatileWillDie = false;
  if (!isFrontLiving && allEnemies && frontLivingIdx >= 0 && frontLivingIdx < allEnemies.length) {
    const frontUnit = allEnemies[frontLivingIdx];
    if (frontUnit && frontUnit.hp > 0 && frontUnit.passive === 'volatile_burst') {
      const frontSim = computeEnemyArmorPreview(
        frontUnit,
        frontLivingIdx,
        frontLivingIdx,
        activePreview,
      );
      frontVolatileWillDie = frontSim.willDie;
    }
  }
  const chainedBurstDmg = frontVolatileWillDie ? 6 : 0;

  if (activePreview.color === 'tech') {
    const shredded = Math.min(enemy.armor, activePreview.armorShredAmount);
    let remainingArmor = Math.max(0, enemy.armor - shredded);
    let remainingShieldPips = enemy.shieldPips;
    let willCrackShieldPip = false;
    const frontTechDmg = isFrontLiving ? activePreview.techPierceDamage : 0;

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

  const directRawDmg = isFrontLiving
    ? activePreview.totalDamage > 0
      ? activePreview.totalDamage
      : activePreview.reflectOnBlock
    : activePreview.cleaveDamage;

  let remainingShieldPips = enemy.shieldPips;
  let willCrackShieldPip = false;
  let remainingArmor = enemy.armor;
  let armorAbsorbed = 0;
  let willBreakArmor = false;
  let projectedHp = enemy.hp;
  let willTriggerPhaseGate = false;

  if (directRawDmg > 0) {
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
      const effectiveArmor = willBreakArmor ? 0 : enemy.armor;
      const piercingDmg = Math.floor(directRawDmg * pierceRatio);
      const regularDmg = directRawDmg - piercingDmg;
      armorAbsorbed = Math.min(effectiveArmor, regularDmg);
      remainingArmor = Math.max(0, effectiveArmor - armorAbsorbed);
      const hpLoss = Math.min(enemy.hp, regularDmg - armorAbsorbed + piercingDmg);
      projectedHp = Math.max(0, enemy.hp - hpLoss);

      const gated = applyPhaseGateClamp(enemy, projectedHp, remainingArmor, remainingShieldPips);
      projectedHp = gated.projectedHp;
      remainingArmor = gated.remainingArmor;
      remainingShieldPips = gated.remainingShieldPips;
      willTriggerPhaseGate = gated.willTriggerPhaseGate;
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
  const willStagger =
    !willDie &&
    !enemy.staggered &&
    (curIntent?.kind === 'charge' || curIntent?.kind === 'heavy') &&
    (enemy.turnDamageTaken ?? 0) + previewHpLoss + armorAbsorbed >= STAGGER_BURST_THRESHOLD;

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
  };
}

export function formatEnemyIntentCompact(
  intent: EnemyIntent,
  lang: Language,
  enrageAtkBonus = 0,
  options?: { staggered?: boolean; conditionActive?: boolean },
): string {
  const t = TRANSLATIONS[lang];
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
  const val =
    enrageAtkBonus > 0
      ? getEffectiveEnemyIntentValue({ enrageAtkBonus }, intent)
      : intent.value;
  const condVal =
    intent.condition && intent.conditionBonus
      ? options?.conditionActive
        ? `${val + intent.conditionBonus} DMG!`
        : `${val}(+${intent.conditionBonus}?) DMG`
      : `${val} DMG`;
  switch (intent.kind) {
    case 'attack':
    case 'heavy':
      return condVal;
    case 'acid':
      return `${val} DMG +${intent.secondaryValue ?? 2} ${t.corrodeShort}`;
    case 'armor':
      return `+${val} ${t.armorShort}`;
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
  options?: { staggered?: boolean; conditionActive?: boolean },
): string {
  const t = TRANSLATIONS[lang];
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
  const val =
    enrageAtkBonus > 0
      ? getEffectiveEnemyIntentValue({ enrageAtkBonus }, intent)
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
    case 'heavy':
      if (intent.condition && intent.conditionBonus) {
        return options?.conditionActive
          ? `${val + intent.conditionBonus} DMG (+${intent.conditionBonus} ${condTag}!)`
          : `${val} DMG (+${intent.conditionBonus} ${condTag})`;
      }
      return `${val} DMG`;
    case 'acid':
      return `${val} DMG · +${intent.secondaryValue ?? 2} ${t.corrodeLabel}`;
    case 'armor':
      return `+${val} ${t.armorLabel}`;
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

export function computeEffectiveSlotCount(
  enemies: readonly EnemyUnit[],
  pendingReinforcements?: readonly PendingReinforcement[],
): number {
  let maxSlot = Math.max(0, enemies.length - 1);
  if (pendingReinforcements) {
    for (const drop of pendingReinforcements) {
      if (drop.slotIndex > maxSlot) {
        maxSlot = drop.slotIndex;
      }
    }
  }
  return Math.min(3, Math.max(enemies.length, maxSlot + 1));
}

export function computeEnemyHitBoxes(
  w: number,
  h: number,
  enemies: readonly EnemyUnit[],
  cutouts?: ReadonlyMap<string, EnemyCutoutEntry>,
  pendingReinforcements?: readonly PendingReinforcement[],
): EnemyHitBox[] {
  if (w <= 0 || h <= 0 || enemies.length === 0) return [];
  const slotCount = computeEffectiveSlotCount(enemies, pendingReinforcements);
  const { groundY, enemyBaseX, enemyStepX } = getStageLayoutMetrics(
    w,
    h,
    slotCount,
    0,
    0,
    0,
    1,
    400,
  );
  const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
  const minTopY = h < 220 ? 34 : 58;

  const boxes: EnemyHitBox[] = [];
  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    if (enemy.hp <= 0) continue;

    const arch = enemy.archetype;
    const archScale = isCrawlerArchetype(arch)
      ? CRAWLER_ARCH_SCALE[arch]
      : arch === 'boss'
        ? 1.24
        : arch === 'brute'
          ? 1.08
          : 0.94;
    const size = baseEnemySize * archScale;
    const ex = enemyBaseX + idx * enemyStepX;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);

    const entry = cutouts?.get(arch);
    const defaults = ENEMY_FOOT_DEFAULTS[arch];
    const bottomRatio = entry ? entry.bounds.bottomRatio : defaults.bottomRatio;

    const visualWidth = Math.max(48, size * (isCrawlerArchetype(arch) ? 0.78 : 0.74));
    const visualHeight = Math.max(48, size * Math.min(0.95, bottomRatio));

    const rawLeft = ex - visualWidth * 0.5;
    const rawTop = enemyGroundY - visualHeight - 4;
    const rawRight = ex + visualWidth * 0.5;
    const rawBottom = Math.min(h - 4, enemyGroundY + 24);

    const left = Math.max(0, Math.min(w - 24, rawLeft));
    const top = Math.max(minTopY, Math.min(h - 32, rawTop));
    const right = Math.min(w, Math.max(left + 24, rawRight));
    const bottom = Math.min(h, Math.max(top + 28, rawBottom));

    boxes.push({
      enemyId: enemy.id,
      idx,
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(right - left),
      height: Math.round(bottom - top),
      centerX: ex,
      groundY: enemyGroundY,
    });
  }

  return boxes;
}

export function hitTestEnemySprite(
  px: number,
  py: number,
  hitBoxes: readonly EnemyHitBox[],
): string | null {
  let bestId: string | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < hitBoxes.length; i++) {
    const box = hitBoxes[i];
    if (
      px >= box.x &&
      px <= box.x + box.width &&
      py >= box.y &&
      py <= box.y + box.height
    ) {
      const cy = box.y + box.height * 0.5;
      const distSq = (px - box.centerX) * (px - box.centerX) + (py - cy) * (py - cy);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestId = box.enemyId;
      }
    }
  }

  return bestId;
}
