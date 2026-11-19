import type { CharacterId, EnemyArchetype } from '../../engine/types';
import type { HeroineAnimMode } from '../../utils/heroineSpriteSheet';
import type { CameraActorBounds } from './ActionCameraController';
import type { CutInStagingMode } from './CombatActionSequencer';

export type ProjectileVisualProfile =
  | 'pistol_bolt'
  | 'scattergun'
  | 'drone_plasma'
  | 'acid_bile'
  | 'stinger_dart';

export interface HeroAttackClassification {
  heroAnimMode: Extract<HeroineAnimMode, 'dash_kick' | 'shoot' | 'overdrive'>;
  stagingMode: CutInStagingMode;
  projectileProfile: ProjectileVisualProfile;
  isMelee: boolean;
}

export interface EnemyAttackClassification {
  stagingMode: CutInStagingMode;
  projectileProfile: ProjectileVisualProfile | null;
  isMelee: boolean;
}

/**
 * Pure archetype-aware classifier for all 3 heroines:
 * - Zuri: 100% ranged aerial drone commander (Strike Drone plasma volleys; never melee clash).
 * - Aurelia: 100% ranged twin-barrel plasma scattergun (spread pellets; never melee clash).
 * - Kira: Hybrid melee/pistol (high-plasma dash-kick melee clashes on Surges/heavy/odd turns;
 *   cyber-pistol ranged cuts on standard/multi-target volleys).
 */
export function classifyHeroAttackStaging(params: {
  charId: CharacterId;
  isSurge?: boolean;
  damageValue?: number;
  targetCount: number;
  attackToggle: number;
  isOverdrive?: boolean;
}): HeroAttackClassification {
  const {
    charId,
    isSurge = false,
    damageValue = 0,
    targetCount,
    attackToggle,
    isOverdrive = false,
  } = params;

  const isMultiTarget = targetCount > 1;

  if (charId === 'zuri') {
    return {
      heroAnimMode: isOverdrive ? 'overdrive' : 'shoot',
      stagingMode: isOverdrive || isMultiTarget ? 'ranged_aoe' : 'ranged_fast',
      projectileProfile: 'drone_plasma',
      isMelee: false,
    };
  }

  if (charId === 'aurelia') {
    return {
      heroAnimMode: isOverdrive ? 'overdrive' : 'shoot',
      stagingMode: isOverdrive || isMultiTarget ? 'ranged_aoe' : 'ranged_fast',
      projectileProfile: 'scattergun',
      isMelee: false,
    };
  }

  // Kira — Hybrid melee dash-kick & ranged cyber-pistol
  if (isOverdrive) {
    return {
      heroAnimMode: 'overdrive',
      stagingMode: isMultiTarget ? 'ranged_aoe' : 'melee',
      projectileProfile: 'pistol_bolt',
      isMelee: !isMultiTarget,
    };
  }

  if (isMultiTarget) {
    return {
      heroAnimMode: 'shoot',
      stagingMode: 'ranged_aoe',
      projectileProfile: 'pistol_bolt',
      isMelee: false,
    };
  }

  const useMeleeKick = isSurge || damageValue >= 12 || attackToggle % 2 === 1;
  if (useMeleeKick) {
    return {
      heroAnimMode: 'dash_kick',
      stagingMode: 'melee',
      projectileProfile: 'pistol_bolt',
      isMelee: true,
    };
  }

  return {
    heroAnimMode: 'shoot',
    stagingMode: 'ranged_fast',
    projectileProfile: 'pistol_bolt',
    isMelee: false,
  };
}

/**
 * Pure archetype-aware classifier for all 7 enemy archetypes:
 * - Bile Spitter (`enemy_acid` without `clawRend`): Two-Beat ranged acid bile cut-in.
 * - Stinger (attack / heavy dart barrage): Two-Beat ranged bio-venom dart cut-in.
 * - Larva, Skitter, Stalker, Brute, Boss, and Spitter `clawRend`: In-your-face melee clash.
 */
export function classifyEnemyAttackStaging(params: {
  archetype: EnemyArchetype;
  cueKind: 'enemy_attack' | 'enemy_acid';
  clawRend?: boolean;
}): EnemyAttackClassification {
  const { archetype, cueKind, clawRend = false } = params;

  if (archetype === 'spitter' && cueKind === 'enemy_acid' && !clawRend) {
    return {
      stagingMode: 'ranged_fast',
      projectileProfile: 'acid_bile',
      isMelee: false,
    };
  }

  if (archetype === 'stinger') {
    return {
      stagingMode: 'ranged_fast',
      projectileProfile: 'stinger_dart',
      isMelee: false,
    };
  }

  return {
    stagingMode: 'melee',
    projectileProfile: null,
    isMelee: true,
  };
}

export interface NoseToNoseMeleePlan {
  /** Signed horizontal world-px delta to apply to the attacker */
  attackerSlideX: number;
  /** Signed horizontal world-px delta per target ID */
  targetSlidesX: Map<string, number>;
  /** Exact world X of the contact midpoint between attacker and primary target */
  contactMidX: number;
  /** Exact world Y of the contact midpoint (torso height) */
  contactMidY: number;
  /** Resulting center-to-center distance between attacker and primary target */
  finalGapPx: number;
}

/**
 * Computes Darkest Dungeon "in-your-face" center-stage melee clash slides so attacker
 * and defender always arrive at a tight nose-to-nose contact gap in the center third
 * of the viewport—whether the enemy started in Slot 1 or Slot 5.
 */
export function computeNoseToNoseMeleeSlides(params: {
  attackerBounds: CameraActorBounds;
  targetBounds: readonly CameraActorBounds[];
  viewportW: number;
  clashGapVw: number;
  strikeDirX: number;
}): NoseToNoseMeleePlan {
  const { attackerBounds, targetBounds, viewportW, clashGapVw, strikeDirX } = params;
  const w = Math.max(240, viewportW);
  const sortedTargets = [...targetBounds].sort((a, b) =>
    strikeDirX >= 0 ? a.x - b.x : b.x - a.x,
  );
  const primaryTarget = sortedTargets[0] ?? attackerBounds;

  // Target center-to-center distance scales with viewport width and sprite widths
  // so fighters clash right in each other's faces without clipping centroids.
  const minSilhouetteGap = (attackerBounds.widthPx + primaryTarget.widthPx) * 0.42;
  const desiredGapPx = w * Math.max(0.08, Math.min(0.24, clashGapVw));
  const rawDist = Math.abs(primaryTarget.x - attackerBounds.x);
  const targetGapPx = Math.min(
    Math.max(rawDist, minSilhouetteGap),
    Math.max(minSilhouetteGap, Math.min(w * 0.22, desiredGapPx)),
  );

  // Pull the clash midpoint strongly toward the stage center third
  const naturalMidX = (attackerBounds.x + primaryTarget.x) * 0.5;
  const stageCenterX = w * 0.5;
  const clashCenterX = Math.max(
    w * 0.24,
    Math.min(w * 0.76, stageCenterX + (naturalMidX - stageCenterX) * 0.3),
  );

  const desiredAttackerX = clashCenterX - strikeDirX * (targetGapPx * 0.5);
  const desiredPrimaryTargetX = clashCenterX + strikeDirX * (targetGapPx * 0.5);

  const attackerSlideX = desiredAttackerX - attackerBounds.x;
  const targetSlidesX = new Map<string, number>();

  for (let i = 0; i < sortedTargets.length; i++) {
    const tgt = sortedTargets[i];
    const desiredTgtX = desiredPrimaryTargetX + strikeDirX * i * Math.max(36, w * 0.045);
    targetSlidesX.set(tgt.id, desiredTgtX - tgt.x);
  }

  const contactMidX = (desiredAttackerX + desiredPrimaryTargetX) * 0.5;
  const contactMidY =
    ((attackerBounds.groundY - attackerBounds.heightPx * 0.52) +
      (primaryTarget.groundY - primaryTarget.heightPx * 0.52)) *
    0.5;

  return {
    attackerSlideX,
    targetSlidesX,
    contactMidX,
    contactMidY,
    finalGapPx: Math.abs(desiredPrimaryTargetX - desiredAttackerX),
  };
}
