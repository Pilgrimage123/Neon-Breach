import type { CharacterId, CombatState, HeroState, TileType } from '../../engine/types';
import {
  AURALINE_CANONICAL_HEIGHT,
  AURALINE_SHEET_FRAMES,
} from '../../utils/auralineSpriteSheet';
import {
  stepAuralineJuice,
  toAuralineHeroAnimStateSnapshot,
  triggerAuralineJuiceState,
} from '../../utils/auralineJuiceController';
import { stepCharacterAnimState } from '../../utils/characterAnimator';
import type { HeroFrameSample } from '../../utils/heroAnimator';
import {
  KIRA_CANONICAL_HEIGHT,
  KIRA_SHEET_FRAMES,
} from '../../utils/kiraSpriteSheet';
import {
  stepKiraJuice,
  toHeroAnimStateSnapshot,
  triggerKiraJuiceState,
} from '../../utils/kiraJuiceController';
import { projectSpriteLandmarkToStage } from './stageMeshMath';
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
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let heroSample: HeroFrameSample;
  if (activeCharId === 'kira') {
    sim.auralineJuiceSample = null;
    if (
      sim.heroState.elapsed === 0 &&
      (sim.heroState.mode !== sim.kiraJuiceState.mode ||
        sim.kiraJuiceState.elapsed > 0.005 ||
        sim.heroState.mode !== 'idle')
    ) {
      triggerKiraJuiceState(sim.kiraJuiceState, sim.heroState.mode, {
        lowHpHit: sim.heroState.lowHpHit,
      });
    }
    const kj = stepKiraJuice(
      sim.kiraJuiceState,
      simDt,
      {
        isDead: hero.hp <= 0 || combat.phase === 'DEFEAT',
        isVictory: combat.phase === 'VICTORY' && sim.pendingImpacts.length === 0,
        hoveredColor,
        totalTime: elapsed,
        reducedMotion,
      },
      sim.kiraJuiceConfig,
    );
    sim.kiraJuiceSample = kj;
    sim.heroState = toHeroAnimStateSnapshot(kj.state);
    const frame = KIRA_SHEET_FRAMES[kj.frameIndex] ?? KIRA_SHEET_FRAMES[0];
    const prevFrame = KIRA_SHEET_FRAMES[kj.prevFrameIndex] ?? frame;
    heroSample = {
      state: sim.heroState,
      frameIndex: kj.frameIndex,
      frame,
      prevFrameIndex: kj.prevFrameIndex,
      prevFrame,
      frameBlendAlpha: kj.blendAlpha,
      xProgress: kj.xProgress,
      yHopPx: kj.hopYPx,
      breathScaleY: kj.springScaleY,
      breathScaleX: kj.springScaleX,
      tiltRad: kj.rotationRad,
      shouldEmitShot: kj.shouldEmitShot,
      shouldEmitKickImpact: kj.shouldEmitKickImpact,
      isDashing: kj.isDashing,
    };
  } else if (activeCharId === 'auraline') {
    sim.kiraJuiceSample = null;
    if (
      sim.heroState.elapsed === 0 &&
      (sim.heroState.mode !== sim.auralineJuiceState.mode ||
        sim.auralineJuiceState.elapsed > 0.005 ||
        sim.heroState.mode !== 'idle')
    ) {
      triggerAuralineJuiceState(sim.auralineJuiceState, sim.heroState.mode, {
        lowHpHit: sim.heroState.lowHpHit,
      });
    }
    const aj = stepAuralineJuice(
      sim.auralineJuiceState,
      simDt,
      {
        isDead: hero.hp <= 0 || combat.phase === 'DEFEAT',
        isVictory: combat.phase === 'VICTORY' && sim.pendingImpacts.length === 0,
        hoveredColor,
        totalTime: elapsed,
        reducedMotion,
      },
      sim.auralineJuiceConfig,
    );
    sim.auralineJuiceSample = aj;
    sim.heroState = toAuralineHeroAnimStateSnapshot(aj.state);
    if (aj.aegisCounterIntensity > 0) {
      sim.auralineAegisDomeTimer = Math.max(sim.auralineAegisDomeTimer, 0.34);
    }
    if (aj.reactorCoreIntensity > 0) {
      sim.auralineReactorAuraTimer = Math.max(sim.auralineReactorAuraTimer, 0.38);
    }
    const frame = AURALINE_SHEET_FRAMES[aj.frameIndex] ?? AURALINE_SHEET_FRAMES[0];
    const prevFrame = AURALINE_SHEET_FRAMES[aj.prevFrameIndex] ?? frame;
    heroSample = {
      state: sim.heroState,
      frameIndex: aj.frameIndex,
      frame,
      prevFrameIndex: aj.prevFrameIndex,
      prevFrame,
      frameBlendAlpha: aj.blendAlpha,
      xProgress: aj.xProgress,
      yHopPx: aj.hopYPx,
      breathScaleY: aj.springScaleY,
      breathScaleX: aj.springScaleX,
      tiltRad: aj.rotationRad,
      shouldEmitShot: aj.shouldEmitShot,
      shouldEmitKickImpact: aj.shouldEmitKickImpact,
      isDashing: aj.isDashing,
    };
  } else {
    sim.kiraJuiceSample = null;
    sim.auralineJuiceSample = null;
    heroSample = stepCharacterAnimState(sim.heroState, simDt, activeCharId, {
      isDead: hero.hp <= 0 || combat.phase === 'DEFEAT',
      isVictory: combat.phase === 'VICTORY' && sim.pendingImpacts.length === 0,
      hoveredColor,
      totalTime: elapsed,
    });
    sim.heroState = heroSample.state;
  }

  if (simDt > 0) {
    if (sim.kiraSurgeBlastTimer > 0) {
      sim.kiraSurgeBlastTimer = Math.max(0, sim.kiraSurgeBlastTimer - simDt);
    }
    if (sim.kiraDropkickRingTimer > 0) {
      sim.kiraDropkickRingTimer = Math.max(0, sim.kiraDropkickRingTimer - simDt);
    }
    if (sim.auralineSurgeBlastTimer > 0) {
      sim.auralineSurgeBlastTimer = Math.max(0, sim.auralineSurgeBlastTimer - simDt);
    }
    if (sim.auralineScatterConeTimer > 0) {
      sim.auralineScatterConeTimer = Math.max(0, sim.auralineScatterConeTimer - simDt);
    }
    if (sim.auralineBroadsideTimer > 0) {
      sim.auralineBroadsideTimer = Math.max(0, sim.auralineBroadsideTimer - simDt);
    }
    if (sim.auralineAegisDomeTimer > 0) {
      sim.auralineAegisDomeTimer = Math.max(0, sim.auralineAegisDomeTimer - simDt);
    }
    if (sim.auralineReactorAuraTimer > 0) {
      sim.auralineReactorAuraTimer = Math.max(0, sim.auralineReactorAuraTimer - simDt);
    }
  }

  if (activeCanvas.dataset.heroAnim !== heroSample.state.mode) {
    activeCanvas.dataset.heroAnim = heroSample.state.mode;
  }
  const frameStr = String(heroSample.frameIndex);
  if (activeCanvas.dataset.heroFrame !== frameStr) {
    activeCanvas.dataset.heroFrame = frameStr;
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

    if (activeCharId === 'kira' && sim.kiraJuiceSample && sim.kiraJuiceSample.dropkickIntensity > 0 && heroFrame.kickTipRel) {
      const soleProj = projectSpriteLandmarkToStage(heroFrame.kickTipRel, {
        frame: heroFrame,
        worldX: heroLiveX,
        worldY: heroY,
        drawScale: heroDrawScale,
        facingSign: 1,
        nativeFacingSign: 1,
        rotationRad: sim.kiraJuiceSample.rotationRad,
        deform: sim.kiraJuiceSample.deform,
        squashStretch: [
          sim.kiraJuiceSample.springScaleX * sim.kiraJuiceSample.facingScale,
          sim.kiraJuiceSample.springScaleY,
        ],
        shearPx: [sim.kiraJuiceSample.shearXPx, 0],
      });
      sim.kiraDropkickSoleX = soleProj.x;
      sim.kiraDropkickSoleY = soleProj.y;
      sim.kiraDropkickRingTimer = Math.max(sim.kiraDropkickRingTimer, 0.34);
    }

    if (!isLabOwnedCutIn && heroSample.shouldEmitShot && (heroFrame.muzzleRel || zuriDrones)) {
      const tierAJuice =
        activeCharId === 'kira'
          ? sim.kiraJuiceSample
          : activeCharId === 'auraline'
            ? sim.auralineJuiceSample
            : null;
      const tierAMuzzleProj =
        (activeCharId === 'kira' || activeCharId === 'auraline') && heroFrame.muzzleRel
          ? projectSpriteLandmarkToStage(heroFrame.muzzleRel, {
              frame: heroFrame,
              worldX: heroLiveX,
              worldY: heroY,
              drawScale: heroDrawScale,
              facingSign: 1,
              nativeFacingSign: 1,
              rotationRad: tierAJuice?.rotationRad ?? 0,
              deform: tierAJuice?.deform,
              squashStretch: tierAJuice
                ? [
                    tierAJuice.springScaleX * tierAJuice.facingScale,
                    tierAJuice.springScaleY,
                  ]
                : [1, 1],
              shearPx: [tierAJuice?.shearXPx ?? 0, 0],
            })
          : null;
      const mx = zuriDrones
        ? zuriDrones.strike.muzzleX
        : tierAMuzzleProj
          ? tierAMuzzleProj.x
          : heroLiveX + (heroFrame.muzzleRel?.dx ?? 120) * heroDrawScale;
      const my = zuriDrones
        ? zuriDrones.strike.muzzleY
        : tierAMuzzleProj
          ? tierAMuzzleProj.y
          : heroY + (heroFrame.muzzleRel?.dy ?? -140) * heroDrawScale;
      if (activeCharId === 'kira' && heroSample.state.mode === 'dash_kick') {
        sim.kiraSurgeBlastTimer = 0.42;
        sim.kiraSurgeMuzzleX = mx;
        sim.kiraSurgeMuzzleY = my;
      } else if (activeCharId === 'auraline') {
        if (heroSample.state.mode === 'dash_kick') {
          sim.auralineSurgeBlastTimer = 0.48;
          sim.auralineSurgeMuzzleX = mx;
          sim.auralineSurgeMuzzleY = my;
        } else if (heroSample.state.mode === 'overdrive') {
          sim.auralineBroadsideTimer = 0.64;
          sim.auralineBroadsideMuzzleX = mx;
          sim.auralineBroadsideMuzzleY = my;
        } else {
          sim.auralineScatterConeTimer = 0.28;
          sim.auralineScatterMuzzleX = mx;
          sim.auralineScatterMuzzleY = my;
        }
      }
      const isOverdrive = heroSample.state.mode === 'overdrive';
      const triggerKey = heroSample.state.emittedShots === 1 ? 'shot1' : 'shot2';
      let baseImpact = drainTriggerImpacts(sim, triggerKey);
      if (!baseImpact && triggerKey === 'shot1' && heroSample.state.mode === 'dash_kick') {
        baseImpact = drainTriggerImpacts(sim, 'kick');
      }
      const onImpact =
        triggerKey === 'shot1'
          ? () => {
              sim.actionSequencer.triggerImpactNow();
              if (baseImpact) baseImpact();
            }
          : baseImpact;
      const isAuralineSurgeBlast =
        activeCharId === 'auraline' && heroSample.state.mode === 'dash_kick';
      const isAuralineBroadside =
        activeCharId === 'auraline' && heroSample.state.mode === 'overdrive';
      if (isAuralineSurgeBlast || isAuralineBroadside) {
        if (onImpact) {
          sim.pendingImpacts.push({
            triggerOn: 'delay',
            delayRemaining: isAuralineSurgeBlast ? 0.085 : 0.11,
            execute: onImpact,
          });
        }
        if (isAuralineSurgeBlast) {
          spawnBurst(sim, mx, my, 3, '#00F0FF', 1, 1.05, 0, 0.22, 0.18, 1.8, 2.4);
          spawnBurst(sim, mx, my, 2, '#E879F9', 1, 0.95, 0, 0.20, 0.16, 1.6, 2.2);
        } else {
          spawnBurst(sim, mx, my, 6, '#FFC700', 1, 1.0, 0, 0.24, 0.22, 1.8, 2.8);
        }
      } else {
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
          activeCharId === 'zuri' ? 9 : activeCharId === 'auraline' ? 5 : 6,
          activeCharId === 'kira' ? '#FDE047' : '#FFC700',
          0,
          activeCharId === 'kira' ? 0.75 : 0.92,
          0,
          0.28,
          0.28,
          2,
          3.4,
        );
        if (activeCharId === 'kira') {
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
    }

    if (!isLabOwnedCutIn && heroSample.shouldEmitKickImpact && activeCharId === 'auraline') {
      sim.actionSequencer.triggerImpactNow();
      const kickCb = drainTriggerImpacts(sim, 'kick');
      if (kickCb) kickCb();
    }

    if (
      !isLabOwnedCutIn &&
      heroSample.shouldEmitKickImpact &&
      (heroFrame.kickTipRel || zuriDrones)
    ) {
      const kiraSoleProj =
        activeCharId === 'kira' && heroFrame.kickTipRel
          ? projectSpriteLandmarkToStage(heroFrame.kickTipRel, {
              frame: heroFrame,
              worldX: heroLiveX,
              worldY: heroY,
              drawScale: heroDrawScale,
              facingSign: 1,
              nativeFacingSign: 1,
              rotationRad: sim.kiraJuiceSample?.rotationRad ?? 0,
              deform: sim.kiraJuiceSample?.deform,
              squashStretch: sim.kiraJuiceSample
                ? [
                    sim.kiraJuiceSample.springScaleX * sim.kiraJuiceSample.facingScale,
                    sim.kiraJuiceSample.springScaleY,
                  ]
                : [1, 1],
              shearPx: [sim.kiraJuiceSample?.shearXPx ?? 0, 0],
            })
          : null;
      const kx = zuriDrones
        ? zuriDrones.strike.muzzleX
        : kiraSoleProj
          ? kiraSoleProj.x
          : heroLiveX + (heroFrame.kickTipRel?.dx ?? 150) * heroDrawScale;
      const ky = zuriDrones
        ? zuriDrones.strike.muzzleY
        : kiraSoleProj
          ? kiraSoleProj.y
          : heroY + (heroFrame.kickTipRel?.dy ?? -120) * heroDrawScale;
      if (activeCharId === 'kira') {
        sim.kiraDropkickSoleX = kx;
        sim.kiraDropkickSoleY = ky;
        sim.kiraDropkickRingTimer = 0.56;
      }
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
