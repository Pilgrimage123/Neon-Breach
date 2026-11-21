import {
  getEffectiveEnemyIntentValue,
  isIntentConditionMet,
} from '../../engine/reinforcementDirector';
import type {
  CombatState,
  EnemyIntent,
  HeroThreatPreview,
  ReinforcementReason,
  TurnPreview,
} from '../../engine/types';
import type { TranslationPack } from '../../i18n/translations';
import {
  computeEnemyArmorPreview,
  type EnemyArmorPreview,
} from './combatEnemyUi';

export const FALLBACK_INTENT: EnemyIntent = { kind: 'attack', value: 0 };

export function formatDropReasonLabel(reason: ReinforcementReason, t: TranslationPack): string {
  switch (reason) {
    case 'adaptive':
      return t.dropReasonAdaptive;
    case 'reactive':
      return t.dropReasonReactive;
    case 'sos_flare':
      return t.dropReasonSos;
    case 'sweeper':
      return t.dropReasonSweeper;
    case 'threat_pool':
    default:
      return t.dropReasonThreat;
  }
}

export interface SequentialEnemyHudState {
  armorPreview: EnemyArmorPreview;
  intent: EnemyIntent;
  conditionActive: boolean;
  shieldBeforeThisEnemy: number;
}

export function computeSequentialEnemyHudState(
  combat: CombatState,
  activePreview: TurnPreview | null,
  heroThreat: HeroThreatPreview,
  frontLivingIdx: number,
): SequentialEnemyHudState[] {
  const colorPlayed = activePreview?.tileCount ? activePreview.color : null;
  let runningShield = Math.max(0, heroThreat.shieldAfterPlayer - (heroThreat.retaliateDamage ?? 0));

  return combat.enemies.map((enemy, idx) => {
    const armorPreview = computeEnemyArmorPreview(
      enemy,
      idx,
      frontLivingIdx,
      activePreview,
      combat.enemies,
    );
    const intent =
      enemy.intentCycle[enemy.currentIntentIndex] ??
      enemy.intentCycle[0] ??
      FALLBACK_INTENT;
    const isDeadOrDying = enemy.hp <= 0 || Boolean(enemy.escaped) || armorPreview.willDie;
    const shieldBeforeThisEnemy = runningShield;
    const conditionActive = isIntentConditionMet(intent, {
      shieldAfterPlayer: shieldBeforeThisEnemy,
      colorPlayed,
      battlefieldRule: combat.battlefieldRule,
    });

    if (
      !isDeadOrDying &&
      !enemy.staggered &&
      !(enemy.sleepCounter && enemy.sleepCounter > 0) &&
      (intent.kind === 'attack' ||
        intent.kind === 'heavy' ||
        intent.kind === 'acid' ||
        intent.kind === 'leech')
    ) {
      const incoming = getEffectiveEnemyIntentValue(enemy, intent, {
        shieldAfterPlayer: shieldBeforeThisEnemy,
        colorPlayed,
        battlefieldRule: combat.battlefieldRule,
      });
      if (incoming > 0) {
        runningShield = Math.max(0, runningShield - incoming);
      }
    }

    return {
      armorPreview,
      intent,
      conditionActive,
      shieldBeforeThisEnemy,
    };
  });
}
