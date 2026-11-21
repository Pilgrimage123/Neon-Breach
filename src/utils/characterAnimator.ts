import type { CharacterId } from '../engine/types';
import type { HeroAnimMode, HeroAnimState, HeroAnimStepContext, HeroFrameSample } from './heroAnimator';
import { stepAuralineAnimState, triggerAuralineAnimation } from './auralineSpriteSheet';
import { stepKiraAnimState, triggerKiraAnimation } from './kiraSpriteSheet';
import { stepZuriAnimState, triggerZuriAnimation } from './zuriSpriteSheet';

export function triggerCharacterAnimation(
  prev: HeroAnimState,
  mode: HeroAnimMode,
  characterId: CharacterId = 'kira',
  options?: { lowHpHit?: boolean },
): HeroAnimState {
  if (characterId === 'auraline') {
    return triggerAuralineAnimation(prev, mode, options);
  }
  if (characterId === 'zuri') {
    return triggerZuriAnimation(prev, mode, options);
  }
  return triggerKiraAnimation(prev, mode, options);
}

export function stepCharacterAnimState(
  prev: HeroAnimState,
  dt: number,
  characterId: CharacterId = 'kira',
  context: HeroAnimStepContext,
): HeroFrameSample {
  if (characterId === 'auraline') {
    return stepAuralineAnimState(prev, dt, context);
  }
  if (characterId === 'zuri') {
    return stepZuriAnimState(prev, dt, context);
  }
  return stepKiraAnimState(prev, dt, context);
}
