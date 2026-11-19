import { clamp01, easeInOutCubic, easeOutExpo } from './combatPresentationMath';

export type CutInActorRole = 'attacker' | 'target' | 'bystander';
export type CutInPoseOverride = 'none' | 'attack_pose' | 'brace_pose' | 'recoil_pose';

export interface ActorJuiceSnapshot {
  active: boolean;
  role: CutInActorRole;
  drawPriority: number;
  poseOverride: CutInPoseOverride;
  /** Horizontal surge or center-stage clash slide in world px (+ = right, - = left) */
  clashSlideX: number;
  /** Target hit knockback displacement + Hold drift apart in world px */
  knockbackX: number;
  /** Elastic punch multiplier applied atop idle/animation squash & stretch (foot-anchored) */
  scaleX: number;
  scaleY: number;
  /** Additional body lean in radians around bottom-center foot pivot */
  leanRad: number;
  /** Active flash overlay (pure white for 2-3 rawDt frames, then decaying into crimson #FF2E7E) */
  flashRgba: [number, number, number, number] | null;
  /** Bystander silhouette dim/cool tint multiplier */
  tintRgba: [number, number, number, number];
}

interface InternalActorJuice {
  role: CutInActorRole;
  poseOverride: CutInPoseOverride;
  /** Melee midpoint clash slide or subtle Ranged in-slot nudge */
  clashSlideStartX: number;
  clashSlideTargetX: number;
  clashSlideX: number;
  /** Knockback impulse + spring return */
  knockbackX: number;
  knockbackTargetX: number;
  knockbackVelX: number;
  /** Continuous slow drift apart during Phase C Hold */
  holdDriftTargetX: number;
  holdDriftX: number;
  /** Reset snapshot anchors for EaseInOutCubic Phase D return */
  resetStartSlideX: number;
  resetStartKnockbackX: number;
  resetStartLeanRad: number;
  /** Foot-anchored squash & stretch spring */
  scaleX: number;
  scaleY: number;
  scaleVelX: number;
  scaleVelY: number;
  leanRad: number;
  leanTargetRad: number;
  whiteFlashFramesLeft: number;
  crimsonFlashAlpha: number;
}

const NEUTRAL_TINT: [number, number, number, number] = [1, 1, 1, 1];

export const NEUTRAL_ACTOR_JUICE_SNAPSHOT: ActorJuiceSnapshot = {
  active: false,
  role: 'bystander',
  drawPriority: 2,
  poseOverride: 'none',
  clashSlideX: 0,
  knockbackX: 0,
  scaleX: 1,
  scaleY: 1,
  leanRad: 0,
  flashRgba: null,
  tintRgba: NEUTRAL_TINT,
};

export interface BeginWindupParams {
  attackerId: string;
  targetIds: readonly string[];
  allActorIds: readonly string[];
  strikeDirX: number;
  isMelee: boolean;
  /** Pixel gap between attacker and target midpoint for Melee 25%-40% clash slide */
  clashSlideDistPx: number;
  /** Subtle in-slot forward lunge for Ranged attacks (5%-10% of actor width) */
  rangedLungePx: number;
}

export interface TriggerTargetImpactParams {
  targetId: string;
  strikeDirX: number;
  knockbackPx: number;
  holdDriftPx: number;
  whiteFlashFrames: number;
  isCrit: boolean;
  isMelee: boolean;
}

/**
 * Coordinates Darkest Dungeon-style static pose overrides, Melee center-stage clash slides
 * (25%-40% toward midpoint via EaseOutExpo) vs. Ranged in-slot lunges (5%-10%),
 * elastic 1.25x scale punches, viewport-relative knockback, Hold slow drift apart,
 * per-target AoE cascaded 2-3 raw-frame pure white -> crimson (#FF2E7E) flashes,
 * and bystander dimming tints—strictly anchored to bottom-center (feet) pivots.
 */
export class SpriteJuiceFeedbackHandler {
  private actors = new Map<string, InternalActorJuice>();
  private cutInActive = false;

  private ensureActor(actorId: string): InternalActorJuice {
    let entry = this.actors.get(actorId);
    if (!entry) {
      entry = {
        role: 'bystander',
        poseOverride: 'none',
        clashSlideStartX: 0,
        clashSlideTargetX: 0,
        clashSlideX: 0,
        knockbackX: 0,
        knockbackTargetX: 0,
        knockbackVelX: 0,
        holdDriftTargetX: 0,
        holdDriftX: 0,
        resetStartSlideX: 0,
        resetStartKnockbackX: 0,
        resetStartLeanRad: 0,
        scaleX: 1,
        scaleY: 1,
        scaleVelX: 0,
        scaleVelY: 0,
        leanRad: 0,
        leanTargetRad: 0,
        whiteFlashFramesLeft: 0,
        crimsonFlashAlpha: 0,
      };
      this.actors.set(actorId, entry);
    }
    return entry;
  }

  public reset(): void {
    this.actors.clear();
    this.cutInActive = false;
  }

  public beginWindup(params: BeginWindupParams): void {
    const {
      attackerId,
      targetIds,
      allActorIds,
      strikeDirX,
      isMelee,
      clashSlideDistPx,
      rangedLungePx,
    } = params;

    this.cutInActive = true;
    const targetSet = new Set(targetIds);

    for (const id of allActorIds) {
      const a = this.ensureActor(id);
      a.clashSlideStartX = a.clashSlideX;
      a.knockbackX = 0;
      a.knockbackTargetX = 0;
      a.knockbackVelX = 0;
      a.holdDriftTargetX = 0;
      a.holdDriftX = 0;
      a.whiteFlashFramesLeft = 0;
      a.crimsonFlashAlpha = 0;
      a.scaleVelX = 0;
      a.scaleVelY = 0;

      if (id === attackerId) {
        a.role = 'attacker';
        a.poseOverride = 'attack_pose';
        if (isMelee) {
          // Physically slide attacker 25%-40% closer to the midpoint so melee clashes in the center third
          a.clashSlideTargetX = strikeDirX * clashSlideDistPx;
          a.leanTargetRad = strikeDirX * 0.07;
        } else {
          // Ranged: stay in formation slot with only a subtle 5%-10% forward aim/fire lunge
          a.clashSlideTargetX = strikeDirX * rangedLungePx;
          a.leanTargetRad = strikeDirX * 0.04;
        }
        a.scaleX = 0.95;
        a.scaleY = 1.06;
      } else if (targetSet.has(id)) {
        a.role = 'target';
        a.poseOverride = 'brace_pose';
        if (isMelee) {
          // Slide melee defender symmetrically toward the shared midpoint
          a.clashSlideTargetX = -strikeDirX * clashSlideDistPx;
          a.leanTargetRad = -strikeDirX * 0.05;
        } else {
          // Ranged target remains anchored in its formation slot until impact
          a.clashSlideTargetX = 0;
          a.leanTargetRad = 0;
        }
        a.scaleX = 1.04;
        a.scaleY = 0.96;
      } else {
        a.role = 'bystander';
        a.poseOverride = 'none';
        a.clashSlideTargetX = 0;
        a.leanTargetRad = 0;
        a.scaleX = 1;
        a.scaleY = 1;
      }
    }
  }

  /**
   * Triggers the Attacker's procedural 1.25x scale punch and forward follow-through lean.
   */
  public triggerAttackerPunch(params: {
    attackerId: string;
    strikeDirX: number;
    attackerScalePunch: number;
    holdDriftPx: number;
    isCrit: boolean;
    isMelee: boolean;
  }): void {
    const { attackerId, strikeDirX, attackerScalePunch, holdDriftPx, isCrit, isMelee } = params;
    const atk = this.ensureActor(attackerId);
    atk.role = 'attacker';
    atk.poseOverride = 'attack_pose';
    atk.leanTargetRad = strikeDirX * (isCrit ? 0.14 : 0.09);
    atk.leanRad = atk.leanTargetRad;
    atk.scaleX = attackerScalePunch;
    atk.scaleY = 1 / Math.max(0.72, Math.sqrt(attackerScalePunch));
    atk.scaleVelX = 0;
    atk.scaleVelY = 0;
    // Slight recoil drift away from the clash point during Phase C Hold (Melee only)
    atk.holdDriftTargetX = isMelee ? -strikeDirX * holdDriftPx * 0.65 : 0;
  }

  /**
   * Triggers an individual Target's impact recoil, viewport-relative knockback,
   * and 2-3 raw-frame solid #FFFFFF -> #FF2E7E crimson flash. Called immediately for
   * single targets or on staggered 30ms-50ms delays for AoE volleys.
   */
  public triggerTargetImpact(params: TriggerTargetImpactParams): void {
    const {
      targetId,
      strikeDirX,
      knockbackPx,
      holdDriftPx,
      whiteFlashFrames,
      isCrit,
      isMelee,
    } = params;

    const tgt = this.ensureActor(targetId);
    tgt.role = 'target';
    tgt.poseOverride = 'recoil_pose';
    tgt.knockbackTargetX = strikeDirX * knockbackPx;
    tgt.knockbackX = strikeDirX * knockbackPx * 0.78;
    tgt.knockbackVelX = strikeDirX * knockbackPx * (isCrit ? 3.2 : 2.4);
    tgt.holdDriftTargetX = strikeDirX * holdDriftPx * (isMelee ? 1.0 : 0.75);
    tgt.leanTargetRad = strikeDirX * (isCrit ? 0.19 : 0.13);
    tgt.leanRad = tgt.leanTargetRad;
    // Sharp horizontal compression / vertical stretch around feet pivot on contact
    tgt.scaleX = 0.84;
    tgt.scaleY = 1.18;
    tgt.scaleVelX = 0;
    tgt.scaleVelY = 0;
    tgt.whiteFlashFramesLeft = Math.max(2, Math.round(whiteFlashFrames));
    tgt.crimsonFlashAlpha = isCrit ? 0.88 : 0.74;
  }

  /**
   * Convenience helper firing both Attacker punch and immediate impact on all targets.
   */
  public triggerImpact(params: {
    attackerId: string;
    targetIds: readonly string[];
    strikeDirX: number;
    knockbackPx: number;
    holdDriftPx: number;
    attackerScalePunch: number;
    whiteFlashFrames: number;
    isCrit: boolean;
    isMelee: boolean;
  }): void {
    this.triggerAttackerPunch({
      attackerId: params.attackerId,
      strikeDirX: params.strikeDirX,
      attackerScalePunch: params.attackerScalePunch,
      holdDriftPx: params.holdDriftPx,
      isCrit: params.isCrit,
      isMelee: params.isMelee,
    });

    for (let i = 0; i < params.targetIds.length; i++) {
      this.triggerTargetImpact({
        targetId: params.targetIds[i],
        strikeDirX: params.strikeDirX,
        knockbackPx: params.knockbackPx,
        holdDriftPx: params.holdDriftPx,
        whiteFlashFrames: params.whiteFlashFrames,
        isCrit: params.isCrit,
        isMelee: params.isMelee,
      });
    }
  }

  public beginReset(): void {
    this.actors.forEach((a) => {
      a.resetStartSlideX = a.clashSlideX + a.holdDriftX;
      a.resetStartKnockbackX = a.knockbackX;
      a.resetStartLeanRad = a.leanRad;
      a.clashSlideTargetX = 0;
      a.holdDriftTargetX = 0;
      a.knockbackTargetX = 0;
      a.leanTargetRad = 0;
    });
  }

  public finish(): void {
    this.cutInActive = false;
    this.actors.forEach((a) => {
      a.role = 'bystander';
      a.poseOverride = 'none';
      a.clashSlideStartX = 0;
      a.clashSlideTargetX = 0;
      a.clashSlideX = 0;
      a.knockbackX = 0;
      a.knockbackTargetX = 0;
      a.knockbackVelX = 0;
      a.holdDriftTargetX = 0;
      a.holdDriftX = 0;
      a.scaleX = 1;
      a.scaleY = 1;
      a.scaleVelX = 0;
      a.scaleVelY = 0;
      a.leanRad = 0;
      a.leanTargetRad = 0;
      a.whiteFlashFramesLeft = 0;
      a.crimsonFlashAlpha = 0;
    });
  }

  /**
   * Advances slide easing, Hold drift apart, spring scale punch, and flash state
   * strictly using unscaled wall `rawDt` so the 2-3 frame pure white impact flash
   * counts down and flips to crimson even while simulation time is Hit-Stopped.
   */
  public stepFrame(
    rawDt: number,
    isHitStopped: boolean,
    phase: 'idle' | 'windup' | 'travel' | 'impact_freeze' | 'followthrough' | 'reset' = 'followthrough',
    phaseProgress = 1,
  ): void {
    const dt = Math.max(0, Math.min(0.1, rawDt));
    const leanRate = 1 - Math.exp(-16 * dt);
    const k = 260;
    const c = 18;

    const p = clamp01(phaseProgress);
    const windupEase = easeOutExpo(p);
    const resetEase = easeInOutCubic(p);

    this.actors.forEach((a) => {
      // Strictly decrement white flash frame counter per rendered visual frame (even during Hit-Stop)
      if (a.whiteFlashFramesLeft > 0) {
        a.whiteFlashFramesLeft -= 1;
      } else if (a.crimsonFlashAlpha > 0) {
        a.crimsonFlashAlpha = Math.max(0, a.crimsonFlashAlpha - dt * (isHitStopped ? 0.7 : 4.2));
      }

      if (phase === 'windup') {
        // Sharp EaseOutExpo slide toward midpoint (Melee) or subtle slot lunge (Ranged)
        a.clashSlideX = a.clashSlideStartX + (a.clashSlideTargetX - a.clashSlideStartX) * windupEase;
        a.leanRad += (a.leanTargetRad - a.leanRad) * leanRate;
      } else if (phase === 'reset') {
        // Smooth EaseInOutCubic glide back to formation slots & idle pose
        const inv = 1 - resetEase;
        a.clashSlideX = a.resetStartSlideX * inv;
        a.holdDriftX = 0;
        a.knockbackX = a.resetStartKnockbackX * inv;
        a.knockbackVelX = 0;
        a.leanRad = a.resetStartLeanRad * inv;
        if (p >= 0.45) {
          a.poseOverride = 'none';
        }
      } else if (isHitStopped) {
        // Hold crisp frozen pose & impact peak during Hit-Stop freeze
        a.clashSlideX += (a.clashSlideTargetX - a.clashSlideX) * Math.min(1, 1 - Math.exp(-10 * dt));
        return;
      } else {
        // Travel / Follow-through Hold
        a.clashSlideX += (a.clashSlideTargetX - a.clashSlideX) * (1 - Math.exp(-18 * dt));
        a.leanRad += (a.leanTargetRad - a.leanRad) * leanRate;

        if (phase === 'followthrough') {
          // Continuously drift actors slightly apart from impact force during Hold
          a.holdDriftX = a.holdDriftTargetX * p;
        }

        // Elastic/damped knockback pulse settling smoothly toward target rest offset
        const kbAcc = -180 * a.knockbackX - 18 * a.knockbackVelX;
        a.knockbackVelX += kbAcc * dt;
        a.knockbackX += a.knockbackVelX * dt;
        if (Math.abs(a.knockbackX) < 0.15 && Math.abs(a.knockbackVelX) < 1) {
          a.knockbackX = 0;
          a.knockbackVelX = 0;
        }
      }

      if (!isHitStopped) {
        // Spring scaleX & scaleY back to 1.0 (elastic recovery from 1.25x punch)
        const ax = k * (1 - a.scaleX) - c * a.scaleVelX;
        const ay = k * (1 - a.scaleY) - c * a.scaleVelY;
        a.scaleVelX += ax * dt;
        a.scaleVelY += ay * dt;
        a.scaleX += a.scaleVelX * dt;
        a.scaleY += a.scaleVelY * dt;
      }
    });
  }

  public getSnapshot(actorId: string, dimmerAlpha: number): ActorJuiceSnapshot {
    const a = this.actors.get(actorId);
    const safeDim = Math.max(0, Math.min(0.88, dimmerAlpha));

    if (!a) {
      if (!this.cutInActive || safeDim <= 0.01) {
        return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
      }
      const d = 1 - safeDim * 0.82;
      return {
        ...NEUTRAL_ACTOR_JUICE_SNAPSHOT,
        active: true,
        drawPriority: 1,
        tintRgba: [d * 0.86, d * 0.9, Math.min(1, d * 1.06), 1],
      };
    }

    let flashRgba: [number, number, number, number] | null = null;
    if (a.whiteFlashFramesLeft > 0) {
      flashRgba = [1.0, 1.0, 1.0, 0.96];
    } else if (a.crimsonFlashAlpha > 0.02) {
      flashRgba = [1.0, 0.18, 0.49, Math.min(0.88, a.crimsonFlashAlpha)];
    }

    let tintRgba: [number, number, number, number] = NEUTRAL_TINT;
    if (this.cutInActive && a.role === 'bystander' && safeDim > 0.01) {
      const d = 1 - safeDim * 0.82;
      tintRgba = [d * 0.86, d * 0.9, Math.min(1, d * 1.06), 1];
    }

    const drawPriority =
      a.role === 'attacker' ? 4 : a.role === 'target' ? 3 : this.cutInActive ? 1 : 2;

    return {
      active: this.cutInActive,
      role: a.role,
      drawPriority,
      poseOverride: a.poseOverride,
      clashSlideX: a.clashSlideX + a.holdDriftX,
      knockbackX: a.knockbackX,
      scaleX: a.scaleX,
      scaleY: a.scaleY,
      leanRad: a.leanRad,
      flashRgba,
      tintRgba,
    };
  }
}
