import { computeEnemyArmorPreview } from '../components/combat/combatEnemyUi';
import { previewColorResolution, previewHeroThreat } from '../engine/gameEngine';
import type { CombatState, EnemyUnit, RunState, TileType, TurnPreview } from '../engine/types';
import type { Language } from '../i18n/translations';
import type { CoreMechanicKeywordId } from './tacticalCopySpecs';

export interface BoardIntentVector {
  enemyId: string;
  enemyIndex: number;
  intentKind: EnemyUnit['intentCycle'][number]['kind'];
  damageValue: number;
  secondaryValue: number;
  targetsHero: boolean;
  badgeText: string;
  accentHex: string;
}

/**
 * Section 3.1: Telegraph Enemy Intent on the Tile / Board.
 * Computes the on-board intent vectors and big icon+number badges for every living enemy.
 */
export function computeBoardIntentVectors(combat: CombatState): BoardIntentVector[] {
  const vectors: BoardIntentVector[] = [];
  for (let idx = 0; idx < combat.enemies.length; idx++) {
    const enemy = combat.enemies[idx];
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!intent) continue;
    if (enemy.staggered) {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: 0,
        targetsHero: false,
        badgeText: '⚡ 0',
        accentHex: '#00F0FF',
      });
      continue;
    }
    const enrage = enemy.enrageAtkBonus ?? 0;
    const val = intent.value + enrage;
    const condSuffix = intent.conditionBonus ? `+${intent.conditionBonus}?` : '';

    if (intent.kind === 'attack' || intent.kind === 'heavy') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: 0,
        targetsHero: true,
        badgeText: `⚔ ${val}${condSuffix}`,
        accentHex: '#FF2E7E',
      });
    } else if (intent.kind === 'acid') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: intent.secondaryValue ?? 1,
        targetsHero: true,
        badgeText: `☣ ${val}`,
        accentHex: '#84CC16',
      });
    } else if (intent.kind === 'leech') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: intent.secondaryValue ?? 3,
        targetsHero: true,
        badgeText: `🩸 ${val}`,
        accentHex: '#C084FC',
      });
    } else if (intent.kind === 'charge') {
      const turnsLeft = intent.secondaryValue ?? 1;
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: turnsLeft,
        targetsHero: false,
        badgeText: `⏳ ${turnsLeft}T→${val}`,
        accentHex: '#FB923C',
      });
    } else {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: intent.value,
        targetsHero: false,
        badgeText: `🛡 +${intent.value}`,
        accentHex: '#00F0FF',
      });
    }
  }
  return vectors;
}

export interface KnockbackSwapPreview {
  active: boolean;
  fromSlotIndex: number;
  toSlotIndex: number;
  collisionDamage: number;
  frontUnitSurvivingHp: number;
  frontUnitSurvivingArmor: number;
  secondUnitSurvivingHp: number;
  secondUnitSurvivingArmor: number;
  bannerText: string;
}

/**
 * Section 3.2: Hover Previews (The "What-If" Spatial Swap State).
 * Computes exact landing slots when hovering Push/Swap (pure 0-AP positioning).
 */
export function computeKnockbackSwapPreview(
  combat: CombatState | null,
  hoveringSwap: boolean,
  lang: Language = 'en',
): KnockbackSwapPreview | null {
  if (!combat || !hoveringSwap || combat.phase !== 'PLAYER_IDLE') return null;
  const livingIndices: number[] = [];
  combat.enemies.forEach((e, idx) => {
    if (e.hp > 0) livingIndices.push(idx);
  });
  if (livingIndices.length < 2) return null;

  const idxA = livingIndices[0];
  const idxB = livingIndices[1];
  const unitA = combat.enemies[idxA];
  const unitB = combat.enemies[idxB];

  return {
    active: true,
    fromSlotIndex: idxA,
    toSlotIndex: idxB,
    collisionDamage: 0,
    frontUnitSurvivingHp: unitA.hp,
    frontUnitSurvivingArmor: unitA.armor,
    secondUnitSurvivingHp: unitB.hp,
    secondUnitSurvivingArmor: unitB.armor,
    bannerText:
      lang === 'cs'
        ? '⇄ PROHODIT POZICE · 0 AP'
        : '⇄ SWAP SLOTS · 0 AP',
  };
}

export function resolveActivePreviewKeywords(
  preview: TurnPreview | null,
  hoveringSwap = false,
): CoreMechanicKeywordId[] {
  if (hoveringSwap) return ['push'];
  if (!preview || preview.tileCount === 0) return [];
  const list: CoreMechanicKeywordId[] = [];
  if (preview.surgeTriggered) list.push('surge');
  if (preview.color === 'attack') {
    list.push('armor');
    if (preview.armorPiercing) list.push('pierce');
  } else if (preview.color === 'defense') {
    list.push('shield');
  } else {
    if (preview.armorShredAmount > 0) list.push('shred');
    if (preview.techPierceDamage > 0) list.push('pierce');
    if (preview.cleanseCorrodeAmount > 0) list.push('corrode');
    if (preview.shieldGained > 0) list.push('shield');
  }
  return list.slice(0, 3);
}

export interface SmartActionTriggerSummary {
  color: TileType;
  tileCount: number;
  mathFormula: string;
  outcomeTag: string | null;
  outcomeTone: 'kill' | 'block' | 'stagger' | 'overdrive' | 'surge' | 'neutral';
  killCount: number;
  blocksAllIncoming: boolean;
  fillsOverdrive: boolean;
}

export type ActionTriggerSummary = SmartActionTriggerSummary;

/**
 * Computes zero-hover instant turn math and tactical outcome badges for all 3 tile colors
 * simultaneously, eliminating the need to hover each group one by one to compare turn options.
 */
export function computeSmartActionTriggerSummaries(
  run: RunState,
  lang: Language = 'en',
): Record<TileType, SmartActionTriggerSummary> {
  const isCs = lang === 'cs';
  const combat = run.combat;
  const baselineThreat = combat ? previewHeroThreat(combat, run.hero, null) : null;
  const frontIdx = combat ? combat.enemies.findIndex((e) => e.hp > 0) : -1;

  const buildForColor = (color: TileType): SmartActionTriggerSummary => {
    const preview = combat ? previewColorResolution(run, color) : null;
    if (!combat || !preview || preview.tileCount === 0) {
      return {
        color,
        tileCount: 0,
        mathFormula: '—',
        outcomeTag: null,
        outcomeTone: 'neutral',
        killCount: 0,
        blocksAllIncoming: false,
        fillsOverdrive: false,
      };
    }

    let mathFormula = '—';
    if (color === 'attack') {
      mathFormula =
        preview.cleaveDamage > 0
          ? `⚔${preview.totalDamage} +${preview.cleaveDamage}`
          : `⚔${preview.totalDamage}`;
    } else if (color === 'defense') {
      mathFormula =
        preview.reflectOnBlock > 0
          ? `🛡+${preview.shieldGained} ↩${preview.reflectOnBlock}`
          : `🛡+${preview.shieldGained}`;
    } else {
      const parts: string[] = [];
      if (preview.damageBoostAddedPct > 0) parts.push(`+${preview.damageBoostAddedPct}%`);
      if (preview.armorShredAmount > 0) parts.push(`-${preview.armorShredAmount}🛡`);
      if (preview.techPierceDamage > 0) parts.push(`⚡${preview.techPierceDamage}`);
      if (preview.healAmount > 0) parts.push(`💚+${preview.healAmount}`);
      if (preview.shieldGained > 0) parts.push(`🛡+${preview.shieldGained}`);
      if (preview.cleanseCorrodeAmount > 0) parts.push(`-${preview.cleanseCorrodeAmount}☣`);
      if (parts.length === 0 && preview.overdriveGained > 0) {
        parts.push(`⚡+${preview.overdriveGained}%`);
      }
      mathFormula = parts.slice(0, 2).join(' · ') || `⚡+${preview.overdriveGained}%`;
    }

    let killCount = 0;
    let willStaggerFront = false;
    if (frontIdx !== -1) {
      for (let i = 0; i < combat.enemies.length; i++) {
        const e = combat.enemies[i];
        if (e.hp <= 0) continue;
        const ep = computeEnemyArmorPreview(e, i, frontIdx, preview, combat.enemies);
        if (ep.willDie) killCount += 1;
        if (i === frontIdx && ep.willStagger) willStaggerFront = true;
      }
    }

    const threatAfter = previewHeroThreat(combat, run.hero, preview);
    const blocksAllIncoming = Boolean(
      baselineThreat &&
        baselineThreat.hpDamageTaken > 0 &&
        threatAfter.hpDamageTaken === 0 &&
        color === 'defense',
    );
    const fillsOverdrive =
      run.hero.overdrive < 100 && run.hero.overdrive + preview.overdriveGained >= 100;

    let outcomeTag: string | null = null;
    let outcomeTone: SmartActionTriggerSummary['outcomeTone'] = 'neutral';

    if (killCount > 0) {
      outcomeTag =
        killCount > 1
          ? `☠ ×${killCount} KO`
          : isCs
            ? '☠ KO'
            : '☠ KILL';
      outcomeTone = 'kill';
    } else if (willStaggerFront) {
      outcomeTag = isCs ? '⚡ OMRÁČENÍ' : '⚡ STAGGER';
      outcomeTone = 'stagger';
    } else if (blocksAllIncoming) {
      outcomeTag = isCs ? '🛡 KRYJE VŠE' : '🛡 FULL BLOCK';
      outcomeTone = 'block';
    } else if (fillsOverdrive) {
      outcomeTag = '⚡ 100% OD';
      outcomeTone = 'overdrive';
    } else if (preview.freeTurnTriggered) {
      outcomeTag = isCs ? '⚡ +TAH ZDARMA' : '⚡ +FREE TURN';
      outcomeTone = 'overdrive';
    } else if (preview.surgeTriggered) {
      outcomeTag = isCs ? '★ PŘETÍŽENÍ' : '★ SURGE';
      outcomeTone = 'surge';
    }

    return {
      color,
      tileCount: preview.tileCount,
      mathFormula,
      outcomeTag,
      outcomeTone,
      killCount,
      blocksAllIncoming,
      fillsOverdrive,
    };
  };

  return {
    attack: buildForColor('attack'),
    defense: buildForColor('defense'),
    tech: buildForColor('tech'),
  };
}
