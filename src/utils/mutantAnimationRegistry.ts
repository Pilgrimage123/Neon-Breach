import type { EnemyArchetype } from '../engine/types';
import { BRUTE_CANONICAL_HEIGHT } from './bruteSpriteSheet';
import { CRAWLER_ARCH_SCALE, CRAWLER_CANONICAL_HEIGHT } from './crawlerSpriteSheet';
import { FERAL_NURSE_CANONICAL_HEIGHT } from './feralNurseSpriteSheet';
import { MUTDOG_CANONICAL_HEIGHT } from './mutdogSpriteSheet';
import { SPITTER_CANONICAL_HEIGHT } from './spitterSpriteSheet';
import { STALKER_CANONICAL_HEIGHT } from './stalkerSpriteSheet';

export type MutantAnimationTier = 'tier_a' | 'legacy_transitional';
export type MutantBlendPolicy = 'crisp_only' | 'spectral_cloak_only' | 'eyelid_blink_only';
export type TierALabTabId = 'spitter' | 'brute' | 'mutdog' | 'feral_nurse';

export interface MutantAnimationSpec {
  archetype: EnemyArchetype;
  tier: MutantAnimationTier;
  archScale: number;
  canonicalHeight: number | null;
  nativeFacingSign: 1 | -1;
  blendPolicy: MutantBlendPolicy;
  devLabTabId: TierALabTabId | null;
}

export const MUTANT_ANIMATION_REGISTRY: Record<EnemyArchetype, MutantAnimationSpec> = {
  larva: {
    archetype: 'larva',
    tier: 'legacy_transitional',
    archScale: CRAWLER_ARCH_SCALE.larva,
    canonicalHeight: CRAWLER_CANONICAL_HEIGHT,
    nativeFacingSign: 1,
    blendPolicy: 'crisp_only',
    devLabTabId: null,
  },
  skitter: {
    archetype: 'skitter',
    tier: 'legacy_transitional',
    archScale: CRAWLER_ARCH_SCALE.skitter,
    canonicalHeight: CRAWLER_CANONICAL_HEIGHT,
    nativeFacingSign: 1,
    blendPolicy: 'crisp_only',
    devLabTabId: null,
  },
  stinger: {
    archetype: 'stinger',
    tier: 'legacy_transitional',
    archScale: CRAWLER_ARCH_SCALE.stinger,
    canonicalHeight: CRAWLER_CANONICAL_HEIGHT,
    nativeFacingSign: 1,
    blendPolicy: 'crisp_only',
    devLabTabId: null,
  },
  stalker: {
    archetype: 'stalker',
    tier: 'legacy_transitional',
    archScale: 0.98,
    canonicalHeight: STALKER_CANONICAL_HEIGHT,
    nativeFacingSign: 1,
    blendPolicy: 'eyelid_blink_only',
    devLabTabId: null,
  },
  spitter: {
    archetype: 'spitter',
    tier: 'tier_a',
    archScale: 0.94,
    canonicalHeight: SPITTER_CANONICAL_HEIGHT,
    nativeFacingSign: -1,
    blendPolicy: 'crisp_only',
    devLabTabId: 'spitter',
  },
  mutdog: {
    archetype: 'mutdog',
    tier: 'tier_a',
    archScale: 0.94,
    canonicalHeight: MUTDOG_CANONICAL_HEIGHT,
    nativeFacingSign: -1,
    blendPolicy: 'crisp_only',
    devLabTabId: 'mutdog',
  },
  feral_nurse: {
    archetype: 'feral_nurse',
    tier: 'tier_a',
    archScale: 1.02,
    canonicalHeight: FERAL_NURSE_CANONICAL_HEIGHT,
    nativeFacingSign: -1,
    blendPolicy: 'spectral_cloak_only',
    devLabTabId: 'feral_nurse',
  },
  brute: {
    archetype: 'brute',
    tier: 'tier_a',
    archScale: 1.32,
    canonicalHeight: BRUTE_CANONICAL_HEIGHT,
    nativeFacingSign: -1,
    blendPolicy: 'crisp_only',
    devLabTabId: 'brute',
  },
  boss: {
    archetype: 'boss',
    tier: 'legacy_transitional',
    archScale: 1.24,
    canonicalHeight: null,
    nativeFacingSign: 1,
    blendPolicy: 'crisp_only',
    devLabTabId: null,
  },
};

export const TIER_A_LAB_ARCHETYPES: readonly {
  archetype: EnemyArchetype;
  tabId: TierALabTabId;
  label: string;
}[] = [
  { archetype: 'spitter', tabId: 'spitter', label: '⬡ SPITTER' },
  { archetype: 'brute', tabId: 'brute', label: '■ BRUTE' },
  { archetype: 'mutdog', tabId: 'mutdog', label: '✦ MUTDOG' },
  { archetype: 'feral_nurse', tabId: 'feral_nurse', label: '✚ FERAL NURSE' },
];

export function getMutantArchScale(archetype: EnemyArchetype): number {
  return MUTANT_ANIMATION_REGISTRY[archetype]?.archScale ?? 0.94;
}
