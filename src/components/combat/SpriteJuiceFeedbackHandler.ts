import { clamp01, easeInOutCubic, easeOutExpo } from './combatPresentationMath';

export type CutInActorRole = 'attacker' | 'target' | 'bystander';
export type CutInPoseOverride = 'none' | 'attack_pose' | 'brace_pose' | 'recoil_pose';

export interface ActorJuiceSnapshot {
  active: boolean;
  isMeleeClash: boolean;
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
  /** Knockback impulse + smooth EaseOutExpo punch-out (zero negative overshoot) */
  knockbackX: number;
  knockbackStartX: number;
  knockbackPeakX: number;
  knockbackAgeSec: number;
  knockbackActive: boolean;
  /** Continuous slow drift apart during Phase C Hold */
  holdDriftTargetX: number;
  holdDriftX: number;
  /** Reset snapshot anchors for EaseInOutCubic Phase D return */
  resetStartSlideX: number;
  resetStartKnockbackX: number;
  resetStartLeanRad: number;
  /** Foot-anchored squash & stretch spring */
  baseScaleTarget: number;
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
  isMeleeClash: false,
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
  /** Legacy symmetric pixel slide fallback for melee clash */
  clashSlideDistPx: number;
  /** Explicit nose-to-nose signed slide delta for the melee attacker */
  attackerSlideOverridePx?: number;
  /** Explicit nose-to-nose signed slide deltas per melee target ID */
  targetSlideOverridesPx?: ReadonlyMap<string, number>;
  /** Subtle foreground scale boost for melee combatants (default 1.07x) */
  meleeForegroundScale?: number;
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
  private activeIsMelee = false;

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
        knockbackStartX: 0,
        knockbackPeakX: 0,
        knockbackAgeSec: 0,
        knockbackActive: false,
        holdDriftTargetX: 0,
        holdDriftX: 0,
        resetStartSlideX: 0,
        resetStartKnockbackX: 0,
        resetStartLeanRad: 0,
        baseScaleTarget: 1,
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
    this.activeIsMelee = false;
  }

  public beginWindup(params: BeginWindupParams): void {
    const {
      attackerId,
      targetIds,
      allActorIds,
      strikeDirX,
      isMelee,
      clashSlideDistPx,
      attackerSlideOverridePx,
      targetSlideOverridesPx,
      meleeForegroundScale = 1.07,
      rangedLungePx,
    } = params;

    this.cutInActive = true;
    this.activeIsMelee = isMelee;
    const targetSet = new Set(targetIds);
    const fgScale = isMelee ? Math.max(1.0, Math.min(1.16, meleeForegroundScale)) : 1.0;

    for (const id of allActorIds) {
      const a = this.ensureActor(id);
      a.clashSlideStartX = a.clashSlideX;
      a.knockbackX = 0;
      a.knockbackStartX = 0;
      a.knockbackPeakX = 0;
      a.knockbackAgeSec = 0;
      a.knockbackActive = false;
      a.holdDriftTargetX = 0;
      a.holdDriftX = 0;
      a.whiteFlashFramesLeft = 0;
      a.crimsonFlashAlpha = 0;
      a.scaleVelX = 0;
      a.scaleVelY = 0;

      if (id === attackerId) {
        a.role = 'attacker';
        a.poseOverride = 'attack_pose';
        a.baseScaleTarget = fgScale;
        if (isMelee) {
          a.clashSlideTargetX =
            attackerSlideOverridePx !== undefined
              ? attackerSlideOverridePx
              : strikeDirX * clashSlideDistPx;
          a.leanTargetRad = strikeDirX * 0.085;
        } else {
          // Ranged: stay in formation slot with only a subtle 5%-10% forward aim/fire lunge
          a.clashSlideTargetX = strikeDirX * rangedLungePx;
          a.leanTargetRad = strikeDirX * 0.04;
        }
        a.scaleX = 0.95 * fgScale;
        a.scaleY = 1.06 * fgScale;
      } else if (targetSet.has(id)) {
        a.role = 'target';
        a.poseOverride = 'brace_pose';
        a.baseScaleTarget = fgScale;
        if (isMelee) {
          a.clashSlideTargetX =
            targetSlideOverridesPx && targetSlideOverridesPx.has(id)
              ? (targetSlideOverridesPx.get(id) ?? -strikeDirX * clashSlideDistPx)
              : -strikeDirX * clashSlideDistPx;
          a.leanTargetRad = -strikeDirX * 0.06;
        } else {
          // Ranged target remains anchored in its formation slot until impact
          a.clashSlideTargetX = 0;
          a.leanTargetRad = 0;
        }
        a.scaleX = 1.04 * fgScale;
        a.scaleY = 0.96 * fgScale;
      } else {
        a.role = 'bystander';
        a.poseOverride = 'none';
        a.baseScaleTarget = 1;
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
    atk.leanTargetRad = strikeDirX * (isCrit ? 0.13 : 0.085);
    const baseS = atk.baseScaleTarget || 1;
    atk.scaleX = attackerScalePunch * baseS;
    atk.scaleY = (1 / Math.max(0.76, Math.sqrt(attackerScalePunch))) * baseS;
    atk.scaleVelX = 0;
    atk.scaleVelY = 0;
    // Slight recoil drift away from the clash point during Phase C Hold (Melee only)
    atk.holdDriftTargetX = isMelee ? -strikeDirX * holdDriftPx * 0.55 : 0;
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
    // Smooth EaseOutExpo knockback punch-out (crisp initial jolt, zero 1-frame teleport, zero bounce-back)
    tgt.knockbackPeakX = strikeDirX * knockbackPx;
    tgt.knockbackStartX = tgt.knockbackX + strikeDirX * knockbackPx * 0.22;
    tgt.knockbackX = tgt.knockbackStartX;
    tgt.knockbackAgeSec = 0;
    tgt.knockbackActive = true;
    tgt.holdDriftTargetX = strikeDirX * holdDriftPx * (isMelee ? 0.9 : 0.7);
    tgt.leanTargetRad = strikeDirX * (isCrit ? 0.17 : 0.12);
    // Crisp horizontal compression / vertical stretch around feet pivot on contact
    const baseS = tgt.baseScaleTarget || 1;
    tgt.scaleX = 0.87 * baseS;
    tgt.scaleY = 1.14 * baseS;
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
      a.baseScaleTarget = 1;
      a.clashSlideTargetX = 0;
      a.holdDriftTargetX = 0;
      a.knockbackPeakX = 0;
      a.knockbackActive = false;
      a.leanTargetRad = 0;
    });
  }

  public finish(): void {
    this.cutInActive = false;
    this.activeIsMelee = false;
    this.actors.forEach((a) => {
      a.role = 'bystander';
      a.poseOverride = 'none';
      a.baseScaleTarget = 1;
      a.clashSlideStartX = 0;
      a.clashSlideTargetX = 0;
      a.clashSlideX = 0;
      a.knockbackX = 0;
      a.knockbackStartX = 0;
      a.knockbackPeakX = 0;
      a.knockbackAgeSec = 0;
      a.knockbackActive = false;
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
    const leanRate = 1 - Math.exp(-22 * dt);
    const k = 260;
    const c = 26;

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
        a.knockbackActive = false;
        a.leanRad = a.resetStartLeanRad * inv;
        if (p >= 0.45) {
          a.poseOverride = 'none';
        }
      } else if (isHitStopped) {
        // Hold crisp frozen pose & impact peak during Hit-Stop freeze while letting lean converge smoothly
        a.clashSlideX += (a.clashSlideTargetX - a.clashSlideX) * Math.min(1, 1 - Math.exp(-16 * dt));
        a.leanRad += (a.leanTargetRad - a.leanRad) * leanRate;
        return;
      } else {
        // Travel / Follow-through Hold
        a.clashSlideX += (a.clashSlideTargetX - a.clashSlideX) * (1 - Math.exp(-18 * dt));
        a.leanRad += (a.leanTargetRad - a.leanRad) * leanRate;

        if (phase === 'followthrough') {
          // Continuously drift actors slightly apart from impact force during Hold
          a.holdDriftX = a.holdDriftTargetX * p;
        }

        // Smooth EaseOutExpo knockback impulse followed by weighty friction settle (zero negative overshoot)
        if (a.knockbackActive) {
          a.knockbackAgeSec += dt;
          const punchDur = 0.095;
          if (a.knockbackAgeSec <= punchDur) {
            const kEase = easeOutExpo(clamp01(a.knockbackAgeSec / punchDur));
            a.knockbackX = a.knockbackStartX + (a.knockbackPeakX - a.knockbackStartX) * kEase;
          } else {
            const settleTarget = a.knockbackPeakX * 0.58;
            const settleRate = 1 - Math.exp(-5.2 * dt);
            a.knockbackX += (settleTarget - a.knockbackX) * settleRate;
          }
        }
      }

      if (!isHitStopped) {
        // Critically-damped spring scaleX & scaleY back to baseScaleTarget (zero bouncy wobble)
        const targetS = phase === 'reset' ? 1 : a.baseScaleTarget;
        const ax = k * (targetS - a.scaleX) - c * a.scaleVelX;
        const ay = k * (targetS - a.scaleY) - c * a.scaleVelY;
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
        isMeleeClash: false,
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
      isMeleeClash: this.cutInActive && this.activeIsMelee && a.role !== 'bystander',
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
