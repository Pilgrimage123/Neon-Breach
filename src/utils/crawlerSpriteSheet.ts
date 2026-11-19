import type { CutInPoseOverride } from '../components/combat/SpriteJuiceFeedbackHandler';
import type { EnemyArchetype } from '../engine/types';
import type { SpriteRect } from './spriteCutout';

export type CrawlerVariant = 'larva' | 'skitter' | 'stinger';

export interface CrawlerSpriteFrame extends SpriteRect {
  col: number;
  anchorX: number;
  bottomY: number;
}

export interface CrawlerAnimInput {
  dead: boolean;
  koProgress: number;
  staggerTimer: number;
  staggerDuration: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
}

export interface CrawlerFrameSample {
  variant: CrawlerVariant;
  frameIndex: number;
  frame: CrawlerSpriteFrame;
  alpha: number;
}

export const CRAWLER_CANONICAL_HEIGHT = 180;

export const CRAWLER_ARCH_SCALE: Record<CrawlerVariant, number> = {
  larva: 0.62,
  skitter: 0.68,
  stinger: 0.74,
};

const COL_X: readonly number[] = [
  4, 153, 296, 432, 569, 696, 828, 955, 1094, 1232, 1365, 1500, 1637, 1776, 1912, 2039,
];

const COL_W: readonly number[] = [
  149, 143, 136, 137, 127, 132, 127, 139, 138, 133, 135, 137, 139, 136, 127, 130,
];

const COL_ANCHOR_X: readonly number[] = [
  84, 80, 77, 75, 72, 72, 71, 74, 80, 73, 74, 74, 72, 72, 65, 64,
];

function buildRowFrames(y: number, h: number, bottomY: number): readonly CrawlerSpriteFrame[] {
  return COL_X.map((x, col) => ({
    col,
    x,
    y,
    w: COL_W[col],
    h,
    anchorX: COL_ANCHOR_X[col],
    bottomY,
  }));
}

/**
 * 3-row x 16-column enemy sprite sheet (`2172 x 724`):
 * - Row 0 (`larva` — Green/Lime Spore Mite): weakest filler mob
 * - Row 1 (`skitter` — Blue/Cobalt Skitter): mid-tier filler mob
 * - Row 2 (`stinger` — Orange/Amber Pyre Stinger): strongest filler mob
 *
 * Columns `0..7` (`ATTACK 1-8`): 8-frame rearing & lunging mandible strike
 * Columns `8..15` (`DEATH - PAIN -> COLLAPSE 9-16`):
 *   - Columns `8..11` (`9-12`): 4-frame pain recoil when hit
 *   - Columns `8..15` (`9-16`): full 8-frame death collapse into a flat puddle
 */
export const CRAWLER_FRAMES_BY_VARIANT: Record<
  CrawlerVariant,
  readonly CrawlerSpriteFrame[]
> = {
  larva: buildRowFrames(66, 181, 176),
  skitter: buildRowFrames(263, 184, 179),
  stinger: buildRowFrames(462, 186, 183),
};

const IDLE_CYCLE: readonly number[] = [0, 1, 2, 1];

export function isCrawlerArchetype(arch: EnemyArchetype): arch is CrawlerVariant {
  return arch === 'larva' || arch === 'skitter' || arch === 'stinger';
}

export function sampleCrawlerFrame(
  variant: CrawlerVariant,
  anim: CrawlerAnimInput | undefined,
  elapsed: number,
  instanceIndex = 0,
  poseOverride: CutInPoseOverride = 'none',
): CrawlerFrameSample {
  const frames = CRAWLER_FRAMES_BY_VARIANT[variant];

  // 1. Death / Collapse sequence across frames 8..15 (Sheet columns 9..16)
  if (anim?.dead) {
    const p = Math.max(0, Math.min(1, anim.koProgress));
    // Progress through frames 8..15 over the first 78% of koProgress, then hold frame 15 (collapsed carcass in puddle) while fading
    const collapseNorm = Math.min(1, p / 0.78);
    const frameIndex = Math.min(15, 8 + Math.floor(collapseNorm * 8));
    const alpha = p <= 0.78 ? 1 : Math.max(0, (1 - p) / 0.22);
    return {
      variant,
      frameIndex,
      frame: frames[frameIndex],
      alpha,
    };
  }

  // 1.5 Darkest Dungeon-style dramatic cut-in static pose override
  if (poseOverride !== 'none') {
    const frameIndex =
      poseOverride === 'attack_pose' ? 4 : poseOverride === 'brace_pose' ? 1 : 9;
    return {
      variant,
      frameIndex,
      frame: frames[frameIndex],
      alpha: 1,
    };
  }

  // 2. Non-lethal Hit / Pain sequence across frames 8..11 (Sheet columns 9..12)
  if (anim && anim.staggerTimer > 0 && anim.staggerDuration > 0) {
    const u = Math.max(0, Math.min(0.999, 1 - anim.staggerTimer / anim.staggerDuration));
    const frameIndex = 8 + Math.min(3, Math.floor(u * 4));
    return {
      variant,
      frameIndex,
      frame: frames[frameIndex],
      alpha: 1,
    };
  }

  // 3. Attack sequence across frames 0..7 (Sheet columns 1..8)
  if (anim && anim.attackAnimTimer > 0 && anim.attackAnimDuration > 0) {
    const u = Math.max(0, Math.min(0.999, 1 - anim.attackAnimTimer / anim.attackAnimDuration));
    const frameIndex = Math.min(7, Math.floor(u * 8));
    return {
      variant,
      frameIndex,
      frame: frames[frameIndex],
      alpha: 1,
    };
  }

  // 4. Organic chittering idle animation across frames 0, 1, 2, 1
  const phase = Math.max(0, elapsed * 5.2 + instanceIndex * 1.35);
  const idleSlot = Math.floor(phase) % IDLE_CYCLE.length;
  const frameIndex = IDLE_CYCLE[idleSlot];
  return {
    variant,
    frameIndex,
    frame: frames[frameIndex],
    alpha: 1,
  };
}
