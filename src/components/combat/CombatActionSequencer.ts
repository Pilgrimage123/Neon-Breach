import {
  ActionCameraController,
  type CameraFocusFrame,
} from './ActionCameraController';
import {
  type CutInActionKind,
  type CutInPhase,
  type CutInRequest,
  type PendingCascadeHit,
  type SequencerFrameState,
  applyImpactFreezeChoreography,
  renderCutInForegroundVfx,
  resolveCutInStagingPlan,
  stepPendingCascadeHits,
} from './combatCutInChoreography';
import {
  type CombatPresentationConfig,
  type CutInStagingMode,
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
} from './combatPresentationConfig';
import {
  clamp01,
  easeInOutCubic,
  easeOutExpo,
  lerp,
} from './combatPresentationMath';
import {
  type ActorJuiceSnapshot,
  NEUTRAL_ACTOR_JUICE_SNAPSHOT,
  SpriteJuiceFeedbackHandler,
} from './SpriteJuiceFeedbackHandler';

export { renderCutInForegroundVfx };
export type {
  CutInActionKind,
  CutInPhase,
  CutInRequest,
  CutInStagingMode,
  SequencerFrameState,
};

interface QueuedCutInEntry {
  request: CutInRequest;
  config: CombatPresentationConfig;
  viewportW: number;
  viewportH: number;
  resolve: () => void;
}

interface PhaseStepCameraGoal {
  desiredZoom: number;
  desiredPanX: number;
  desiredPanY: number;
  desiredRot: number;
  directPose: boolean;
  phaseProgress: number;
  isHitStopped: boolean;
  simDt: number;
}

/**
 * Serialized Darkest Dungeon-style Combat Action Sequencer supporting:
 * - Melee Center-Stage Clashes (25%-40% EaseOutExpo midpoint slide + 1.35x-1.85x zoom)
 * - Two-Beat Ranged/Spit/Cast Cuts (Beat 1 shooter lead-room zoom -> Beat 2 EaseOutExpo whip-pan or projectile tracking)
 * - Ranged AoE Volleys (Beat 1 shooter -> Beat 2 wider 1.2x-1.3x centroid + 30-50ms L->R cascaded hits)
 * - Unscaled-time Hit-Stop, Hold inward zoom creep (+5%-10%), EaseInOutCubic reset,
 *   world-space HUD suppression, and guaranteed cleanup on cancellation or Tactical View.
 */
export class CombatActionSequencer {
  public readonly camera = new ActionCameraController();
  public readonly juice = new SpriteJuiceFeedbackHandler();

  private phase: CutInPhase = 'idle';
  private stagingMode: CutInStagingMode = 'melee';
  private phaseElapsed = 0;
  private hitstopRemaining = 0;
  private invertFlashFramesLeft = 0;
  private speedLinesAlpha = 0;
  private dimmerAlpha = 0;
  private worldUiAlpha = 1;

  private camStartFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private camGoalFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private beat2TargetFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private holdZoomStart = 1;
  private holdZoomEnd = 1;
  private startRotRad = 0;
  private targetRotRad = 0;
  private impactCamStart: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private impactRotStart = 0;
  private impactSnapElapsed = 0;

  private impactOriginX = 0;
  private impactOriginY = 0;
  private strikeDirX = 1;
  private viewportW = 960;
  private viewportH = 380;

  private activeRequest: CutInRequest | null = null;
  private activeTempoScale = 1;
  private activeResolve: (() => void) | null = null;
  private activeConfig: CombatPresentationConfig = DEFAULT_COMBAT_PRESENTATION_CONFIG;
  private impactFiredForRequest = false;
  private projectileSpawnFired = false;
  private pendingCascades: PendingCascadeHit[] = [];

  private readonly queue: QueuedCutInEntry[] = [];

  public getPhase(): CutInPhase {
    return this.phase;
  }

  public getStagingMode(): CutInStagingMode {
    return this.stagingMode;
  }

  public isActive(): boolean {
    return this.phase !== 'idle';
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveRequestId(): string | null {
    return this.activeRequest?.id ?? null;
  }

  public getActorJuice(actorId: string): ActorJuiceSnapshot {
    if (this.phase === 'idle') return NEUTRAL_ACTOR_JUICE_SNAPSHOT;
    return this.juice.getSnapshot(actorId, this.dimmerAlpha);
  }

  public getLiveActorX(actorId: string, baseX: number): number {
    const snap = this.getActorJuice(actorId);
    return snap.active ? baseX + snap.clashSlideX + snap.knockbackX : baseX;
  }

  public reset(): void {
    const activeResolve = this.activeResolve;
    const queuedResolvers = this.queue.splice(0, this.queue.length).map((q) => q.resolve);

    this.cleanupActiveState();
    this.camera.reset();

    if (activeResolve) activeResolve();
    for (let i = 0; i < queuedResolvers.length; i++) {
      queuedResolvers[i]();
    }
  }

  private cleanupActiveState(): void {
    this.activeResolve = null;
    this.activeRequest = null;
    this.phase = 'idle';
    this.phaseElapsed = 0;
    this.hitstopRemaining = 0;
    this.invertFlashFramesLeft = 0;
    this.speedLinesAlpha = 0;
    this.dimmerAlpha = 0;
    this.worldUiAlpha = 1;
    this.camStartFrame = { zoom: 1, panX: 0, panY: 0 };
    this.camGoalFrame = { zoom: 1, panX: 0, panY: 0 };
    this.beat2TargetFrame = { zoom: 1, panX: 0, panY: 0 };
    this.holdZoomStart = 1;
    this.holdZoomEnd = 1;
    this.startRotRad = 0;
    this.targetRotRad = 0;
    this.impactCamStart = { zoom: 1, panX: 0, panY: 0 };
    this.impactRotStart = 0;
    this.impactSnapElapsed = 0;
    this.impactFiredForRequest = false;
    this.projectileSpawnFired = false;
    this.pendingCascades.length = 0;
    this.juice.finish();
  }

  private invokeSafely(fn?: () => void): void {
    if (!fn) return;
    try {
      fn();
    } catch {
      // Isolate caller VFX/audio errors so Phase D cleanup and camera reset always complete.
    }
  }

  public enqueueCutIn(
    request: CutInRequest,
    config: CombatPresentationConfig = DEFAULT_COMBAT_PRESENTATION_CONFIG,
    viewportW = 960,
    viewportH = 380,
  ): Promise<void> {
    if (!config.enabled) {
      this.invokeSafely(request.onWindupStart);
      this.invokeSafely(request.onProjectileSpawn);
      this.invokeSafely(request.onImpactFrame);
      for (let i = 0; i < request.targetIds.length; i++) {
        const tid = request.targetIds[i];
        this.invokeSafely(() => request.onImpactTarget?.(tid, i));
      }
      return Promise.resolve();
    }

    if (request.replaceQueue) {
      this.reset();
    }

    return new Promise<void>((resolve) => {
      const entry: QueuedCutInEntry = { request, config, viewportW, viewportH, resolve };
      if (this.phase === 'idle' && !this.activeRequest) {
        this.startEntry(entry);
      } else {
        this.queue.push(entry);
      }
    });
  }

  public playCutIn(
    request: CutInRequest,
    config: CombatPresentationConfig = DEFAULT_COMBAT_PRESENTATION_CONFIG,
    viewportW = 960,
    viewportH = 380,
  ): Promise<void> {
    return this.enqueueCutIn(request, config, viewportW, viewportH);
  }

  private startEntry(entry: QueuedCutInEntry): void {
    const { request, config, viewportW, viewportH, resolve } = entry;

    this.activeConfig = config;
    this.activeRequest = request;
    this.activeResolve = resolve;
    this.viewportW = Math.max(1, viewportW);
    this.viewportH = Math.max(1, viewportH);
    this.activeTempoScale = Math.max(0.45, Math.min(1.5, request.tempoScale ?? 1.0));

    this.phase = 'windup';
    this.phaseElapsed = 0;
    this.hitstopRemaining = 0;
    this.invertFlashFramesLeft = 0;
    this.speedLinesAlpha = 0;
    this.impactFiredForRequest = false;
    this.projectileSpawnFired = false;
    this.pendingCascades.length = 0;

    this.camStartFrame = { zoom: this.camera.zoom, panX: this.camera.panX, panY: this.camera.panY };
    this.startRotRad = this.camera.rotationRad;

    const plan = resolveCutInStagingPlan({
      request,
      config,
      camera: this.camera,
      viewportW: this.viewportW,
      viewportH: this.viewportH,
    });

    this.stagingMode = plan.stagingMode;
    this.strikeDirX = plan.strikeDirX;
    this.impactOriginX = plan.impactOriginX;
    this.impactOriginY = plan.impactOriginY;
    this.camGoalFrame = plan.camGoalFrame;
    this.beat2TargetFrame = plan.beat2TargetFrame;
    this.targetRotRad = plan.targetRotRad;

    this.juice.beginWindup({
      attackerId: request.attackerId,
      targetIds: request.targetIds,
      allActorIds: request.allActorIds,
      strikeDirX: this.strikeDirX,
      isMelee: plan.isMelee,
      clashSlideDistPx: plan.meleeSlideEachPx,
      attackerSlideOverridePx: plan.attackerSlideOverridePx,
      targetSlideOverridesPx: plan.targetSlideOverridesPx,
      meleeForegroundScale: config.meleeForegroundScale,
      rangedLungePx: plan.rangedLungePx,
    });

    this.invokeSafely(request.onWindupStart);
  }

  public triggerImpactNow(): void {
    if (
      (this.phase !== 'windup' && this.phase !== 'travel') ||
      !this.activeRequest ||
      this.impactFiredForRequest
    ) {
      return;
    }
    this.enterImpactFreeze();
  }

  private beginRangedTravel(): void {
    if (!this.activeRequest || this.phase !== 'windup') return;
    if (!this.projectileSpawnFired) {
      this.projectileSpawnFired = true;
      this.invokeSafely(this.activeRequest.onProjectileSpawn);
    }

    this.phase = 'travel';
    this.phaseElapsed = 0;
    this.camStartFrame = { zoom: this.camera.zoom, panX: this.camera.panX, panY: this.camera.panY };
    this.camGoalFrame = this.beat2TargetFrame;
  }

  private enterImpactFreeze(): void {
    const req = this.activeRequest;
    if (!req || this.impactFiredForRequest) return;
    this.impactFiredForRequest = true;

    this.impactCamStart = { zoom: this.camera.zoom, panX: this.camera.panX, panY: this.camera.panY };
    this.impactRotStart = this.camera.rotationRad;
    this.impactSnapElapsed = 0;
    this.camStartFrame = { ...this.impactCamStart };
    this.camGoalFrame = { ...this.beat2TargetFrame };
    this.phase = 'impact_freeze';
    this.phaseElapsed = 0;

    const result = applyImpactFreezeChoreography({
      request: req,
      config: this.activeConfig,
      stagingMode: this.stagingMode,
      strikeDirX: this.strikeDirX,
      tempoScale: this.activeTempoScale,
      viewportW: this.viewportW,
      beat2TargetFrame: this.beat2TargetFrame,
      camera: this.camera,
      juice: this.juice,
      invokeSafely: (fn) => this.invokeSafely(fn),
    });

    this.holdZoomStart = result.holdZoomStart;
    this.holdZoomEnd = result.holdZoomEnd;
    this.targetRotRad = result.targetRotRad;
    this.hitstopRemaining = result.hitstopSec;
    if (result.invertFlashFrames > 0) this.invertFlashFramesLeft = result.invertFlashFrames;
    if (result.speedLinesAlpha > 0) this.speedLinesAlpha = result.speedLinesAlpha;
    this.pendingCascades = result.pendingCascades;
  }

  private advancePendingCascades(rawDt: number): void {
    stepPendingCascadeHits({
      rawDt,
      pendingCascades: this.pendingCascades,
      request: this.activeRequest,
      config: this.activeConfig,
      stagingMode: this.stagingMode,
      strikeDirX: this.strikeDirX,
      viewportW: this.viewportW,
      juice: this.juice,
      invokeSafely: (fn) => this.invokeSafely(fn),
    });
  }

  private stepWindupPhase(dt: number): PhaseStepCameraGoal {
    const cfg = this.activeConfig;
    const tempo = this.activeTempoScale;
    this.phaseElapsed += dt;
    const isMelee = this.stagingMode === 'melee';
    const beat1Dur = Math.max(0.05, (isMelee ? cfg.windupSec : cfg.rangedBeat1Sec) * tempo);
    const phaseProgress = clamp01(this.phaseElapsed / beat1Dur);
    const snapEase = easeOutExpo(phaseProgress);

    this.dimmerAlpha = cfg.dimmerAlpha * snapEase;
    this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 1 - snapEase : 1;

    const desiredZoom = lerp(this.camStartFrame.zoom, this.camGoalFrame.zoom, snapEase);
    const desiredPanX = lerp(this.camStartFrame.panX, this.camGoalFrame.panX, snapEase);
    const desiredPanY = lerp(this.camStartFrame.panY, this.camGoalFrame.panY, snapEase);
    const desiredRot = lerp(this.startRotRad, this.targetRotRad, snapEase);

    if (isMelee && this.activeRequest) {
      const maxWait = this.activeRequest.waitForExternalImpact
        ? Math.max(beat1Dur + 0.30, 0.45)
        : beat1Dur;
      if (this.phaseElapsed >= maxWait) this.enterImpactFreeze();
    } else if (this.phaseElapsed >= beat1Dur) {
      this.beginRangedTravel();
    }

    return {
      desiredZoom,
      desiredPanX,
      desiredPanY,
      desiredRot,
      directPose: true,
      phaseProgress,
      isHitStopped: false,
      simDt: dt,
    };
  }

  private stepActionPhase(dt: number): PhaseStepCameraGoal {
    const cfg = this.activeConfig;
    const tempo = this.activeTempoScale;

    if (this.phase === 'travel' && this.activeRequest) {
      this.phaseElapsed += dt;
      this.dimmerAlpha = cfg.dimmerAlpha;
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;

      if (this.stagingMode === 'ranged_lobbed' && this.activeRequest.getProjectileX) {
        const projX = this.activeRequest.getProjectileX();
        const trackZoom = lerp(this.camStartFrame.zoom, this.beat2TargetFrame.zoom, 0.5);
        let desiredPanX = this.beat2TargetFrame.panX;
        let desiredPanY = this.beat2TargetFrame.panY;
        if (projX !== null && Number.isFinite(projX)) {
          desiredPanX = (this.viewportW * 0.5 - projX) * trackZoom;
          desiredPanY = lerp(this.camStartFrame.panY, this.beat2TargetFrame.panY, 0.5);
        }

        if (this.phaseElapsed >= Math.max(0.45, cfg.rangedWhipPanSec * 3.5)) {
          this.enterImpactFreeze();
        }
        return {
          desiredZoom: trackZoom,
          desiredPanX,
          desiredPanY,
          desiredRot: 0,
          directPose: false,
          phaseProgress: 0,
          isHitStopped: false,
          simDt: dt,
        };
      }

      const whipDur = Math.max(0.08, cfg.rangedWhipPanSec * tempo);
      const phaseProgress = clamp01(this.phaseElapsed / whipDur);
      const whipEase = easeOutExpo(phaseProgress);

      const desiredZoom = lerp(this.camStartFrame.zoom, this.beat2TargetFrame.zoom, whipEase);
      const desiredPanX = lerp(this.camStartFrame.panX, this.beat2TargetFrame.panX, whipEase);
      const desiredPanY = lerp(this.camStartFrame.panY, this.beat2TargetFrame.panY, whipEase);

      const maxTravelWait = this.activeRequest.waitForExternalImpact
        ? Math.max(whipDur + 0.25, 0.35)
        : whipDur;
      if (this.phaseElapsed >= maxTravelWait) this.enterImpactFreeze();
      return {
        desiredZoom,
        desiredPanX,
        desiredPanY,
        desiredRot: 0,
        directPose: true,
        phaseProgress,
        isHitStopped: false,
        simDt: dt,
      };
    }

    // impact_freeze phase
    this.advancePendingCascades(dt);
    this.impactSnapElapsed += dt;
    this.hitstopRemaining = Math.max(0, this.hitstopRemaining - dt);
    let isHitStopped = false;
    let simDt = dt;
    if (this.hitstopRemaining > 0) {
      isHitStopped = true;
      simDt = 0;
    } else {
      this.phase = 'followthrough';
      this.phaseElapsed = 0;
    }
    const catchUpEase = easeOutExpo(clamp01(this.impactSnapElapsed / 0.065));
    this.dimmerAlpha = cfg.dimmerAlpha;
    this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;
    return {
      desiredZoom: lerp(this.impactCamStart.zoom, this.holdZoomStart, catchUpEase),
      desiredPanX: lerp(this.impactCamStart.panX, this.beat2TargetFrame.panX, catchUpEase),
      desiredPanY: lerp(this.impactCamStart.panY, this.beat2TargetFrame.panY, catchUpEase),
      desiredRot: lerp(this.impactRotStart, this.targetRotRad, catchUpEase),
      directPose: true,
      phaseProgress: 0,
      isHitStopped,
      simDt,
    };
  }

  private stepHoldPhase(
    dt: number,
    options: { idleZoom?: number; idlePanX?: number; idlePanY?: number },
  ): PhaseStepCameraGoal {
    const cfg = this.activeConfig;
    const tempo = this.activeTempoScale;
    const req = this.activeRequest!;
    this.advancePendingCascades(dt);
    this.phaseElapsed += dt;
    const isCrit = req.actionKind === 'crit' || req.actionKind === 'overdrive';
    const holdDur =
      req.holdDurationOverrideSec !== undefined
        ? Math.max(0.18, req.holdDurationOverrideSec)
        : Math.max(0.18, (isCrit ? cfg.holdCritSec : cfg.holdNormalSec) * tempo);
    const phaseProgress = clamp01(this.phaseElapsed / holdDur);

    const desiredZoom = lerp(this.holdZoomStart, this.holdZoomEnd, phaseProgress);
    const zoomRatio = this.holdZoomStart > 0.01 ? desiredZoom / this.holdZoomStart : 1;
    const desiredPanX = this.beat2TargetFrame.panX * zoomRatio;
    const desiredPanY = this.beat2TargetFrame.panY * zoomRatio;
    const desiredRot = this.targetRotRad * (1 - phaseProgress * 0.22);

    this.dimmerAlpha = cfg.dimmerAlpha;
    this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;
    if (this.speedLinesAlpha > 0) {
      this.speedLinesAlpha = Math.max(0, this.speedLinesAlpha - dt * 1.9);
    }

    if (this.phaseElapsed >= holdDur) {
      if (this.pendingCascades.length > 0) this.advancePendingCascades(10);
      this.phase = 'reset';
      this.phaseElapsed = 0;
      this.camStartFrame = { zoom: this.camera.zoom, panX: this.camera.panX, panY: this.camera.panY };
      this.camGoalFrame = {
        zoom: options.idleZoom ?? 1,
        panX: options.idlePanX ?? 0,
        panY: options.idlePanY ?? 0,
      };
      this.startRotRad = this.camera.rotationRad;
      this.targetRotRad = 0;
      this.juice.beginReset();
    }

    return {
      desiredZoom,
      desiredPanX,
      desiredPanY,
      desiredRot,
      directPose: true,
      phaseProgress,
      isHitStopped: false,
      simDt: dt,
    };
  }

  private stepResetPhase(dt: number): PhaseStepCameraGoal {
    const cfg = this.activeConfig;
    const tempo = this.activeTempoScale;
    this.phaseElapsed += dt;
    const resetDur = Math.max(0.08, cfg.resetSec * tempo);
    const phaseProgress = clamp01(this.phaseElapsed / resetDur);
    const resetEase = easeInOutCubic(phaseProgress);

    this.dimmerAlpha = cfg.dimmerAlpha * (1 - resetEase);
    this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? resetEase : 1;
    this.speedLinesAlpha = Math.max(0, this.speedLinesAlpha - dt * 4);

    const desiredZoom = lerp(this.camStartFrame.zoom, this.camGoalFrame.zoom, resetEase);
    const desiredPanX = lerp(this.camStartFrame.panX, this.camGoalFrame.panX, resetEase);
    const desiredPanY = lerp(this.camStartFrame.panY, this.camGoalFrame.panY, resetEase);
    const desiredRot = lerp(this.startRotRad, 0, resetEase);

    if (this.phaseElapsed >= resetDur) {
      const finishedResolve = this.activeResolve;
      this.cleanupActiveState();
      if (finishedResolve) finishedResolve();

      if (this.queue.length > 0) {
        const nextEntry = this.queue.shift();
        if (nextEntry) this.startEntry(nextEntry);
      }
    }

    return {
      desiredZoom,
      desiredPanX,
      desiredPanY,
      desiredRot,
      directPose: true,
      phaseProgress,
      isHitStopped: false,
      simDt: dt,
    };
  }

  public step(
    rawDt: number,
    viewportW: number,
    viewportH: number,
    options: {
      tacticalViewActive: boolean;
      reducedMotion: boolean;
      idleZoom?: number;
      idlePanX?: number;
      idlePanY?: number;
    },
  ): SequencerFrameState {
    const dt = Math.max(0, Math.min(0.1, rawDt));
    this.viewportW = Math.max(1, viewportW);
    this.viewportH = Math.max(1, viewportH);

    if (options.tacticalViewActive) {
      if (this.phase !== 'idle' || this.queue.length > 0) {
        this.reset();
      } else {
        this.camera.step(dt, {
          viewportW: this.viewportW,
          viewportH: this.viewportH,
          targetZoom: 1,
          targetPanX: 0,
          targetPanY: 0,
          targetRotRad: 0,
          lerpRate: 30,
          shakeDecayPerSec: this.activeConfig.shakeDecayPerSec,
          tacticalViewActive: true,
          reducedMotion: options.reducedMotion,
        });
      }
      return {
        active: false,
        phase: 'idle',
        stagingMode: this.stagingMode,
        isHitStopped: false,
        simDt: dt,
        dimmerAlpha: 0,
        worldUiAlpha: 1,
        attackerId: null,
        targetIds: [],
        cameraZoom: 1,
        cameraPanX: 0,
        cameraPanY: 0,
        cameraRotRad: 0,
        shakeOffsetX: 0,
        shakeOffsetY: 0,
        shakeRotRad: 0,
        invertFlashAlpha: 0,
        speedLinesAlpha: 0,
        impactOriginX: this.impactOriginX,
        impactOriginY: this.impactOriginY,
      };
    }

    let goal: PhaseStepCameraGoal = {
      desiredZoom: options.idleZoom ?? 1,
      desiredPanX: options.idlePanX ?? 0,
      desiredPanY: options.idlePanY ?? 0,
      desiredRot: 0,
      directPose: false,
      phaseProgress: 0,
      isHitStopped: false,
      simDt: dt,
    };

    if (this.phase === 'windup' && this.activeRequest) {
      goal = this.stepWindupPhase(dt);
    } else if ((this.phase === 'travel' && this.activeRequest) || this.phase === 'impact_freeze') {
      goal = this.stepActionPhase(dt);
    } else if (this.phase === 'followthrough' && this.activeRequest) {
      goal = this.stepHoldPhase(dt, options);
    } else if (this.phase === 'reset') {
      goal = this.stepResetPhase(dt);
    }

    let invertFlashAlpha = 0;
    if (!options.reducedMotion && this.invertFlashFramesLeft > 0) {
      invertFlashAlpha = 0.74;
      this.invertFlashFramesLeft -= 1;
    }

    if (this.phase !== 'idle') {
      this.juice.stepFrame(dt, goal.isHitStopped, this.phase, goal.phaseProgress);
    }

    const cfg = this.activeConfig;
    const isCritActive =
      this.activeRequest?.actionKind === 'crit' ||
      this.activeRequest?.actionKind === 'overdrive';
    const maxShakePx =
      this.viewportW * (isCritActive ? cfg.shakeCritVw : cfg.shakeNormalVw);

    const camSnap = this.camera.step(dt, {
      viewportW: this.viewportW,
      viewportH: this.viewportH,
      targetZoom: goal.desiredZoom,
      targetPanX: goal.desiredPanX,
      targetPanY: goal.desiredPanY,
      targetRotRad: goal.desiredRot,
      lerpRate: this.phase === 'travel' ? 14 : 10,
      shakeDecayPerSec: cfg.shakeDecayPerSec,
      maxShakePx,
      directPose: goal.directPose,
      tacticalViewActive: false,
      reducedMotion: options.reducedMotion,
    });

    return {
      active: this.phase !== 'idle',
      phase: this.phase,
      stagingMode: this.stagingMode,
      isHitStopped: goal.isHitStopped,
      simDt: goal.simDt,
      dimmerAlpha: this.dimmerAlpha,
      worldUiAlpha: this.worldUiAlpha,
      attackerId: this.activeRequest?.attackerId ?? null,
      targetIds: this.activeRequest?.targetIds ?? [],
      cameraZoom: camSnap.zoom,
      cameraPanX: camSnap.panX,
      cameraPanY: camSnap.panY,
      cameraRotRad: camSnap.rotationRad,
      shakeOffsetX: camSnap.shakeOffsetX,
      shakeOffsetY: camSnap.shakeOffsetY,
      shakeRotRad: camSnap.shakeRotRad,
      invertFlashAlpha,
      speedLinesAlpha: options.reducedMotion ? 0 : this.speedLinesAlpha,
      impactOriginX: this.impactOriginX,
      impactOriginY: this.impactOriginY,
    };
  }
}
