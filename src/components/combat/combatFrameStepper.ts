import type { CharacterId, CombatState, HeroState, TileType } from '../../engine/types';
import { AURALINE_CANONICAL_HEIGHT } from '../../utils/auralineSpriteSheet';
import { stepCharacterAnimState } from '../../utils/characterAnimator';
import type { HeroFrameSample } from '../../utils/heroAnimator';
import { KIRA_CANONICAL_HEIGHT } from '../../utils/kiraSpriteSheet';
import { sampleZuriDroneFormation } from '../../utils/zuriDroneFormation';
import { ZURI_CANONICAL_HEIGHT } from '../../utils/zuriSpriteSheet';
import { computeEffectiveSlotCount } from './combatEnemyUi';
import type { ProjectileVisualProfile } from './combatStagingClassifier';
import { type CombatStageSim, getStageLayoutMetrics } from './combatStageTypes';
import {
  addOrGrowFloorBlood,
  drainTriggerImpacts,
  spawnBurst,
  spawnStyledProjectileVolley,
} from './combatVfx';

export function stepAndDispatchHeroFrame(params: {
  sim: CombatStageSim;
  combat: CombatState;
  hero: HeroState;
  hoveredColor: TileType | null;
  simDt: number;
  elapsed: number;
  isPaused: boolean;
  activeCanvas: HTMLCanvasElement;
}): HeroFrameSample {
  const { sim, combat, hero, hoveredColor, simDt, elapsed, isPaused, activeCanvas } = params;
  const activeCharId: CharacterId = hero.characterId ?? 'kira';
  const canonicalHeight =
    activeCharId === 'auraline'
      ? AURALINE_CANONICAL_HEIGHT
      : activeCharId === 'zuri'
        ? ZURI_CANONICAL_HEIGHT
        : KIRA_CANONICAL_HEIGHT;

  const heroSample = stepCharacterAnimState(sim.heroState, simDt, activeCharId, {
    isDead: hero.hp <= 0 || combat.phase === 'DEFEAT',
    isVictory: combat.phase === 'VICTORY' && sim.pendingImpacts.length === 0,
    hoveredColor,
    totalTime: elapsed,
  });
  sim.heroState = heroSample.state;

  if (activeCanvas.dataset.heroAnim !== heroSample.state.mode) {
    activeCanvas.dataset.heroAnim = heroSample.state.mode;
  }

  const heroFrame = heroSample.frame;
  if (!isPaused && simDt > 0) {
    const effectiveSlotCount = computeEffectiveSlotCount(
      combat.enemies,
      combat.director?.pendingReinforcements,
    );
    const heroCutIn = sim.actionSequencer.getActorJuice('hero');
    const isKiraDodging = activeCharId === 'kira' && heroSample.state.mode === 'dodge';
    const effectiveHeroXProgress = isKiraDodging
      ? heroSample.xProgress
      : heroCutIn.isMeleeClash || (heroCutIn.active && heroCutIn.role === 'target')
        ? 0
        : heroCutIn.active && activeCharId === 'auraline'
          ? Math.max(-0.06, Math.min(0.06, heroSample.xProgress))
          : heroSample.xProgress;
    const { groundY, baseScale, heroX, heroY, heroDrawScale } = getStageLayoutMetrics(
      sim.size.w,
      sim.size.h,
      effectiveSlotCount,
      sim.dashTargetX,
      effectiveHeroXProgress,
      heroSample.yHopPx,
      heroFrame.rowScale,
      canonicalHeight,
    );
    const heroLiveX = isKiraDodging
      ? Math.max(sim.size.w * 0.08, heroX + (heroCutIn.active ? heroCutIn.clashSlideX : 0))
      : heroX + (heroCutIn.active ? heroCutIn.clashSlideX + heroCutIn.knockbackX : 0);

    const zuriDrones =
      activeCharId === 'zuri'
        ? sampleZuriDroneFormation({
            animState: heroSample.state,
            heroX: heroLiveX,
            heroDrawBottomY: heroY,
            groundY,
            targetX: sim.pendingShotTargetX,
            targetMidY: sim.pendingShotTargetY,
            scale: baseScale,
            totalTime: elapsed,
            hoveredColor,
          })
        : null;

    if (heroSample.isDashing && (!heroCutIn.isMeleeClash || isKiraDodging)) {
      const needsInitialDodgeGhost = isKiraDodging && !sim.ghosts.some((g) => g.isDodge);
      sim.ghostSampleTimer += simDt;
      const ghostInterval = isKiraDodging ? 0.036 : 0.028;
      if (needsInitialDodgeGhost || sim.ghostSampleTimer >= ghostInterval) {
        sim.ghostSampleTimer = 0;
        sim.ghosts.push({
          x: heroLiveX,
          y: heroY,
          frameIndex: heroSample.frameIndex,
          drawScale: heroDrawScale,
          alpha: isKiraDodging ? 0.78 : 0.42,
          isDodge: isKiraDodging,
        });
        const maxGhosts = isKiraDodging ? 9 : 6;
        if (sim.ghosts.length > maxGhosts) sim.ghosts.shift();
      }
      if (sim.heroTrailCooldown <= 0 && (hero.corrode > 0 || hero.hp <= hero.maxHp * 0.5)) {
        sim.heroTrailCooldown = 0.055;
        addOrGrowFloorBlood(
          sim,
          heroLiveX + (Math.random() - 0.5) * 10,
          groundY + (Math.random() - 0.5) * 6,
          2.2,
          0,
          {
            owner: hero.corrode > 0 ? 'hero_corrode' : 'hero_blood',
            shapeKind: 'trail_drop',
          },
        );
      }
    } else {
      sim.ghostSampleTimer = 0;
    }

    const isLabOwnedCutIn = sim.actionSequencer.isActive() && sim.pendingImpacts.length === 0;

    if (!isLabOwnedCutIn && heroSample.shouldEmitShot && (heroFrame.muzzleRel || zuriDrones)) {
      const mx = zuriDrones
        ? zuriDrones.strike.muzzleX
        : heroLiveX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
      const my = zuriDrones
        ? zuriDrones.strike.muzzleY
        : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
      const isOverdrive = heroSample.state.mode === 'overdrive';
      const triggerKey = heroSample.state.emittedShots === 1 ? 'shot1' : 'shot2';
      const baseImpact = drainTriggerImpacts(sim, triggerKey);
      const onImpact =
        triggerKey === 'shot1'
          ? () => {
              sim.actionSequencer.triggerImpactNow();
              if (baseImpact) baseImpact();
            }
          : baseImpact;
      const profile: ProjectileVisualProfile =
        activeCharId === 'zuri'
          ? 'drone_plasma'
          : activeCharId === 'auraline'
            ? 'scattergun'
            : 'pistol_bolt';
      spawnStyledProjectileVolley(sim, {
        profile,
        sx: mx,
        sy: my,
        tx: sim.pendingShotTargetX,
        ty: sim.pendingShotTargetY,
        isOverdrive,
        onPrimaryImpact: onImpact,
      });
      if (activeCharId === 'zuri' && zuriDrones && isOverdrive) {
        spawnStyledProjectileVolley(sim, {
          profile: 'pistol_bolt',
          sx: zuriDrones.shield.muzzleX,
          sy: zuriDrones.shield.muzzleY,
          tx: sim.pendingShotTargetX,
          ty: sim.pendingShotTargetY,
          isOverdrive: true,
        });
      }
      spawnBurst(
        sim,
        mx,
        my,
        activeCharId === 'zuri' ? 9 : activeCharId === 'auraline' ? 8 : 6,
        activeCharId === 'kira' ? '#FDE047' : '#FFC700',
        0,
        activeCharId === 'kira' ? 0.75 : 0.92,
        0,
        0.28,
        0.28,
        2,
        3.8,
      );
      if (activeCharId !== 'zuri') {
        spawnBurst(
          sim,
          heroLiveX + 26 * heroDrawScale,
          heroY - 145 * heroDrawScale,
          3,
          '#FBBF24',
          1,
          0.45,
          0,
          0.28,
          0.28,
          2,
          3.5,
        );
      }
    }

    if (
      !isLabOwnedCutIn &&
      heroSample.shouldEmitKickImpact &&
      (heroFrame.kickTipRel || zuriDrones)
    ) {
      const kx = zuriDrones
        ? zuriDrones.strike.muzzleX
        : heroLiveX + (heroFrame.kickTipRel?.dx ?? 150) * heroDrawScale;
      const ky = zuriDrones
        ? zuriDrones.strike.muzzleY
        : heroY + (heroFrame.kickTipRel?.dy ?? -120) * heroDrawScale;
      sim.kickWaveTimer = 0.28;
      sim.kickWaveX = kx;
      sim.kickWaveY = ky;
      spawnBurst(sim, kx, ky, 18, '#FF2E7E', 1, 1.15, 0, 0.28, 0.28, 2, 3.5);
      if (activeCharId === 'auraline' || activeCharId === 'zuri') {
        spawnBurst(sim, kx, ky, 14, '#FFC700', 0, 1.25, 0, 0.3, 0.26, 2.4, 4.2);
      }
      sim.actionSequencer.triggerImpactNow();
      const kickCb = drainTriggerImpacts(sim, 'kick');
      if (kickCb) kickCb();
    }
  }

  return heroSample;
}
