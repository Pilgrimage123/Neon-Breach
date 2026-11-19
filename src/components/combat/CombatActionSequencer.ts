import {
  ActionCameraController,
  type CameraActorBounds,
  type CameraFocusFrame,
} from './ActionCameraController';
import {
  type CombatPresentationConfig,
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

export type CutInPhase =
  | 'idle'
  | 'windup'
  | 'travel'
  | 'impact_freeze'
  | 'followthrough'
  | 'reset';

export type CutInActionKind = 'normal' | 'crit' | 'aoe' | 'overdrive';

export type CutInStagingMode = 'melee' | 'ranged_fast' | 'ranged_lobbed' | 'ranged_aoe';

export interface CutInRequest {
  id: string;
  actionKind: CutInActionKind;
  /** Staging & framing contract: Melee center-stage clash vs. Two-Beat Ranged/AoE */
  stagingMode?: CutInStagingMode;
  attackerId: string;
  targetIds: readonly string[];
  allActorIds: readonly string[];
  attackerBounds: CameraActorBounds;
  targetBounds: readonly CameraActorBounds[];
  /** Adaptive pack speedup multiplier (1.0 normal, ~0.80 / 0.64 for packs) */
  tempoScale?: number;
  /** When true, waits for triggerImpactNow() (with a safety cap) before entering impact_freeze */
  waitForExternalImpact?: boolean;
  /** Optional live projectile world X-coordinate getter for slow/lobbed projectile tracking */
  getProjectileX?: () => number | null;
  /** When true, cancels any active/queued cut-ins immediately (ideal for debug hotkeys 1-4) */
  replaceQueue?: boolean;
  onWindupStart?: () => void;
  /** Fires at the Beat 1 -> Beat 2 transition when a ranged projectile spawns */
  onProjectileSpawn?: () => void;
  /** Fires on the primary impact frame */
  onImpactFrame?: () => void;
  /** Fires per target (cascaded 30ms-50ms left-to-right on AoE volleys) */
  onImpactTarget?: (targetId: string, index: number) => void;
}

export interface SequencerFrameState {
  active: boolean;
  phase: CutInPhase;
  stagingMode: CutInStagingMode;
  isHitStopped: boolean;
  /** Unpaused wall delta when running, 0 during Hit-Stop freeze */
  simDt: number;
  /** Stage dimmer alpha in [0.0, 0.75] */
  dimmerAlpha: number;
  /** World-space health bar & floating HUD visibility [0..1] (0 during focal clash, 1 when idle) */
  worldUiAlpha: number;
  attackerId: string | null;
  targetIds: readonly string[];
  cameraZoom: number;
  cameraPanX: number;
  cameraPanY: number;
  cameraRotRad: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  shakeRotRad: number;
  invertFlashAlpha: number;
  speedLinesAlpha: number;
  impactOriginX: number;
  impactOriginY: number;
}

interface QueuedCutInEntry {
  request: CutInRequest;
  config: CombatPresentationConfig;
  viewportW: number;
  viewportH: number;
  resolve: () => void;
}

interface PendingCascadeHit {
  targetId: string;
  index: number;
  delayRemainingSec: number;
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

  // Interpolated camera endpoints for sharp easing contrasts (EaseOutExpo / linear creep / EaseInOutCubic)
  private camStartFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private camGoalFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private beat2TargetFrame: CameraFocusFrame = { zoom: 1, panX: 0, panY: 0 };
  private holdZoomStart = 1;
  private holdZoomEnd = 1;
  private startRotRad = 0;
  private targetRotRad = 0;

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

  /**
   * Guaranteed cleanup teardown: restores idle poses, sorting priority, dimmer alpha,
   * world-space HUD visibility, neutral camera transform, and resolves pending promises.
   */
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
    this.impactFiredForRequest = false;
    this.projectileSpawnFired = false;
    this.pendingCascades.length = 0;
    this.juice.finish();
  }

  /**
   * Enqueues a combat presentation cut-in onto the serialized queue.
   * When `request.replaceQueue` is true, cancels the active cut-in and clears queued entries first.
   */
  public enqueueCutIn(
    request: CutInRequest,
    config: CombatPresentationConfig = DEFAULT_COMBAT_PRESENTATION_CONFIG,
    viewportW = 960,
    viewportH = 380,
  ): Promise<void> {
    if (!config.enabled) {
      request.onWindupStart?.();
      request.onProjectileSpawn?.();
      request.onImpactFrame?.();
      for (let i = 0; i < request.targetIds.length; i++) {
        request.onImpactTarget?.(request.targetIds[i], i);
      }
      return Promise.resolve();
    }

    if (request.replaceQueue) {
      this.reset();
    }

    return new Promise<void>((resolve) => {
      const entry: QueuedCutInEntry = {
        request,
        config,
        viewportW,
        viewportH,
        resolve,
      };
      if (this.phase === 'idle' && !this.activeRequest) {
        this.startEntry(entry);
      } else {
        this.queue.push(entry);
      }
    });
  }

  /**
   * Plays a cut-in immediately (defaulting to serialized queue unless `replaceQueue: true` is set,
   * or replacing an active cut-in cleanly if called directly in single-shot mode).
   */
  public playCutIn(
    request: CutInRequest,
    config: CombatPresentationConfig = DEFAULT_COMBAT_PRESENTATION_CONFIG,
    viewportW = 960,
    viewportH = 380,
  ): Promise<void> {
    return this.enqueueCutIn(request, config, viewportW, viewportH);
  }

  private resolveStagingMode(request: CutInRequest): CutInStagingMode {
    if (request.stagingMode) return request.stagingMode;
    if (request.actionKind === 'aoe' || request.actionKind === 'overdrive' || request.targetBounds.length > 1) {
      return 'ranged_aoe';
    }
    return 'melee';
  }

  private startEntry(entry: QueuedCutInEntry): void {
    const { request, config, viewportW, viewportH, resolve } = entry;

    this.activeConfig = config;
    this.activeRequest = request;
    this.activeResolve = resolve;
    this.viewportW = Math.max(1, viewportW);
    this.viewportH = Math.max(1, viewportH);
    this.activeTempoScale = Math.max(0.45, Math.min(1.5, request.tempoScale ?? 1.0));
    this.stagingMode = this.resolveStagingMode(request);

    this.phase = 'windup';
    this.phaseElapsed = 0;
    this.hitstopRemaining = 0;
    this.invertFlashFramesLeft = 0;
    this.speedLinesAlpha = 0;
    this.impactFiredForRequest = false;
    this.projectileSpawnFired = false;
    this.pendingCascades.length = 0;

    // Sort target bounds left-to-right for deterministic AoE centroid & L->R cascade order
    const sortedTargets = [...request.targetBounds].sort((a, b) => a.x - b.x);
    const primaryTarget = sortedTargets[0] ?? request.attackerBounds;
    this.strikeDirX = primaryTarget.x >= request.attackerBounds.x ? 1 : -1;

    // Average impact origin across targets (used for Crit radial speed lines)
    let originX = 0;
    let originY = 0;
    for (let i = 0; i < sortedTargets.length; i++) {
      originX += sortedTargets[i].x;
      originY += sortedTargets[i].groundY - sortedTargets[i].heightPx * 0.52;
    }
    if (sortedTargets.length > 0) {
      this.impactOriginX = originX / sortedTargets.length;
      this.impactOriginY = originY / sortedTargets.length;
    } else {
      this.impactOriginX = request.attackerBounds.x;
      this.impactOriginY = request.attackerBounds.groundY - request.attackerBounds.heightPx * 0.52;
    }

    const isCrit = request.actionKind === 'crit' || request.actionKind === 'overdrive';
    const isMelee = this.stagingMode === 'melee';
    const tiltDeg = isCrit ? config.dutchDegCrit : config.dutchDegNormal;
    const impactRotRad = ((-this.strikeDirX * tiltDeg) * Math.PI) / 180;

    this.camStartFrame = {
      zoom: this.camera.zoom,
      panX: this.camera.panX,
      panY: this.camera.panY,
    };
    this.startRotRad = this.camera.rotationRad;

    const gapPx = Math.abs(primaryTarget.x - request.attackerBounds.x);
    // Melee: physically slide both Attacker & Target 25%-40% closer to midpoint
    const slideRatio = Math.max(0.25, Math.min(0.4, config.meleeClashSlideRatio));
    const meleeSlideEachPx = isMelee ? gapPx * 0.5 * slideRatio : 0;
    // Ranged: stay in formation slot with only a 5%-10% forward lunge
    const rangedLungePx = Math.max(
      4,
      request.attackerBounds.widthPx * Math.max(0.05, Math.min(0.1, config.rangedSlotLungeRatio)),
    );

    if (isMelee) {
      // Frame the shifted clash midpoint so Attacker & Target fill the center third tightly
      const shiftedAttacker: CameraActorBounds = {
        ...request.attackerBounds,
        x: request.attackerBounds.x + this.strikeDirX * meleeSlideEachPx,
      };
      const shiftedTargets: CameraActorBounds[] = sortedTargets.map((t) => ({
        ...t,
        x: t.x - this.strikeDirX * meleeSlideEachPx,
      }));
      const desiredZoom = isCrit ? config.zoomCrit : config.zoomNormal;
      const focus = this.camera.computeFocusFrame(
        [shiftedAttacker, ...shiftedTargets],
        this.viewportW,
        this.viewportH,
        desiredZoom,
        Math.min(desiredZoom, 1.35),
        1.9,
        impactRotRad,
      );
      this.camGoalFrame = focus;
      this.beat2TargetFrame = focus;
      this.targetRotRad = impactRotRad;
    } else {
      // Ranged / Spit / Cast / AoE Beat 1: Tight lead-room zoom onto Shooter alone
      this.camGoalFrame = this.camera.computeShooterLeadFrame(
        request.attackerBounds,
        this.strikeDirX,
        this.viewportW,
        this.viewportH,
        config.zoomRangedShooter,
        config.rangedLeadRoomVw,
        0,
      );

      // Precompute Beat 2 destination frame (Target close-up or AoE Centroid)
      if (this.stagingMode === 'ranged_aoe' || sortedTargets.length > 1) {
        this.beat2TargetFrame = this.camera.computeAoeCentroidFrame(
          sortedTargets,
          this.viewportW,
          this.viewportH,
          config.zoomAoeMin,
          config.zoomAoeMax,
          impactRotRad,
        );
      } else {
        const desiredTargetZoom = isCrit ? config.zoomCrit : config.zoomNormal;
        this.beat2TargetFrame = this.camera.computeFocusFrame(
          [primaryTarget],
          this.viewportW,
          this.viewportH,
          desiredTargetZoom,
          Math.min(desiredTargetZoom, 1.35),
          1.9,
          impactRotRad,
        );
      }
      this.targetRotRad = 0; // Hold level during Beat 1 aim; snap Dutch tilt on Beat 2 impact
    }

    this.juice.beginWindup({
      attackerId: request.attackerId,
      targetIds: request.targetIds,
      allActorIds: request.allActorIds,
      strikeDirX: this.strikeDirX,
      isMelee,
      clashSlideDistPx: meleeSlideEachPx,
      rangedLungePx,
    });

    request.onWindupStart?.();
  }

  /**
   * Forces transition into Phase B (`impact_freeze`) when an external projectile collision
   * or dash-kick contact occurs on screen.
   */
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
      this.activeRequest.onProjectileSpawn?.();
    }

    this.phase = 'travel';
    this.phaseElapsed = 0;
    this.camStartFrame = {
      zoom: this.camera.zoom,
      panX: this.camera.panX,
      panY: this.camera.panY,
    };
    this.camGoalFrame = this.beat2TargetFrame;
  }

  private enterImpactFreeze(): void {
    const req = this.activeRequest;
    if (!req || this.impactFiredForRequest) return;
    this.impactFiredForRequest = true;

    const cfg = this.activeConfig;
    const isCrit = req.actionKind === 'crit' || req.actionKind === 'overdrive';
    const isAoe = this.stagingMode === 'ranged_aoe' || req.actionKind === 'aoe' || req.targetIds.length > 1;
    const isMelee = this.stagingMode === 'melee';

    // Snap camera onto Beat 2 target/centroid frame if we arrived early from an external projectile collision
    this.camStartFrame = { ...this.beat2TargetFrame };
    this.camGoalFrame = { ...this.beat2TargetFrame };
    this.holdZoomStart = this.beat2TargetFrame.zoom;
    this.holdZoomEnd = Math.min(
      2.05,
      this.holdZoomStart * (1 + Math.max(0.05, Math.min(0.12, cfg.holdZoomCreepPct))),
    );

    const tiltDeg = isCrit ? cfg.dutchDegCrit : cfg.dutchDegNormal;
    this.targetRotRad = ((-this.strikeDirX * tiltDeg) * Math.PI) / 180;

    const hitstopBase = isCrit
      ? cfg.hitstopCritSec
      : isAoe
        ? cfg.hitstopAoeSec
        : cfg.hitstopNormalSec;
    this.hitstopRemaining = hitstopBase * Math.max(0.75, this.activeTempoScale);

    this.phase = 'impact_freeze';
    this.phaseElapsed = 0;

    if (isCrit && cfg.critInvertFlashEnabled) {
      this.invertFlashFramesLeft = 2;
    }
    if (isCrit && cfg.critSpeedLinesEnabled) {
      this.speedLinesAlpha = 0.92;
    }

    const shakeMaxVw = isCrit ? cfg.shakeCritVw : cfg.shakeNormalVw;
    this.camera.addTrauma(
      isCrit ? cfg.shakeTraumaCrit : cfg.shakeTraumaNormal,
      this.strikeDirX,
      isCrit ? -0.35 : -0.15,
      this.viewportW,
      shakeMaxVw,
    );

    const knockbackPx = this.viewportW * (isCrit ? cfg.knockbackCritVw : cfg.knockbackNormalVw);
    const holdDriftPx = this.viewportW * cfg.holdDriftApartVw;

    // Trigger attacker procedural scale punch (1.25x -> 1.0x)
    this.juice.triggerAttackerPunch({
      attackerId: req.attackerId,
      strikeDirX: this.strikeDirX,
      attackerScalePunch: cfg.attackerScalePunch,
      holdDriftPx,
      isCrit,
      isMelee,
    });

    // Sort targets left-to-right for AoE cascaded ripple (30ms-50ms per target)
    const boundsById = new Map<string, CameraActorBounds>();
    for (let i = 0; i < req.targetBounds.length; i++) {
      boundsById.set(req.targetBounds[i].id, req.targetBounds[i]);
    }
    const orderedTargetIds = [...req.targetIds].sort((a, b) => {
      const xa = boundsById.get(a)?.x ?? 0;
      const xb = boundsById.get(b)?.x ?? 0;
      return xa - xb;
    });

    const cascadeStepSec =
      orderedTargetIds.length > 1 && isAoe
        ? Math.max(0.03, Math.min(0.05, cfg.aoeCascadeStepMs / 1000))
        : 0;

    this.pendingCascades.length = 0;
    for (let i = 0; i < orderedTargetIds.length; i++) {
      const tid = orderedTargetIds[i];
      if (i === 0 || cascadeStepSec <= 0) {
        this.juice.triggerTargetImpact({
          targetId: tid,
          strikeDirX: this.strikeDirX,
          knockbackPx,
          holdDriftPx,
          whiteFlashFrames: cfg.whiteFlashFrames,
          isCrit,
          isMelee,
        });
        req.onImpactTarget?.(tid, i);
      } else {
        this.pendingCascades.push({
          targetId: tid,
          index: i,
          delayRemainingSec: cascadeStepSec * i,
        });
      }
    }

    req.onImpactFrame?.();
  }

  private advancePendingCascades(rawDt: number): void {
    const req = this.activeRequest;
    if (!req || this.pendingCascades.length === 0) return;

    const cfg = this.activeConfig;
    const isCrit = req.actionKind === 'crit' || req.actionKind === 'overdrive';
    const isMelee = this.stagingMode === 'melee';
    const knockbackPx = this.viewportW * (isCrit ? cfg.knockbackCritVw : cfg.knockbackNormalVw);
    const holdDriftPx = this.viewportW * cfg.holdDriftApartVw;

    for (let i = this.pendingCascades.length - 1; i >= 0; i--) {
      const item = this.pendingCascades[i];
      item.delayRemainingSec -= rawDt;
      if (item.delayRemainingSec <= 0) {
        this.pendingCascades.splice(i, 1);
        this.juice.triggerTargetImpact({
          targetId: item.targetId,
          strikeDirX: this.strikeDirX,
          knockbackPx,
          holdDriftPx,
          whiteFlashFrames: cfg.whiteFlashFrames,
          isCrit,
          isMelee,
        });
        req.onImpactTarget?.(item.targetId, item.index);
      }
    }
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

    const cfg = this.activeConfig;
    const tempo = this.activeTempoScale;
    let simDt = dt;
    let isHitStopped = false;
    let phaseProgress = 0;

    let desiredZoom = options.idleZoom ?? 1;
    let desiredPanX = options.idlePanX ?? 0;
    let desiredPanY = options.idlePanY ?? 0;
    let desiredRot = 0;
    let directPose = false;

    if (this.phase === 'windup' && this.activeRequest) {
      this.phaseElapsed += dt;
      const isMelee = this.stagingMode === 'melee';
      const beat1Dur = Math.max(
        0.05,
        (isMelee ? cfg.windupSec : cfg.rangedBeat1Sec) * tempo,
      );
      phaseProgress = clamp01(this.phaseElapsed / beat1Dur);
      const snapEase = easeOutExpo(phaseProgress);

      this.dimmerAlpha = cfg.dimmerAlpha * snapEase;
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 1 - snapEase : 1;

      desiredZoom = lerp(this.camStartFrame.zoom, this.camGoalFrame.zoom, snapEase);
      desiredPanX = lerp(this.camStartFrame.panX, this.camGoalFrame.panX, snapEase);
      desiredPanY = lerp(this.camStartFrame.panY, this.camGoalFrame.panY, snapEase);
      desiredRot = lerp(this.startRotRad, this.targetRotRad, snapEase);
      directPose = true;

      if (isMelee) {
        const maxWait = this.activeRequest.waitForExternalImpact
          ? Math.max(beat1Dur + 0.30, 0.45)
          : beat1Dur;
        if (this.phaseElapsed >= maxWait) {
          this.enterImpactFreeze();
        }
      } else if (this.phaseElapsed >= beat1Dur) {
        this.beginRangedTravel();
      }
    } else if (this.phase === 'travel' && this.activeRequest) {
      this.phaseElapsed += dt;
      this.dimmerAlpha = cfg.dimmerAlpha;
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;

      if (this.stagingMode === 'ranged_lobbed' && this.activeRequest.getProjectileX) {
        // Slow/lobbed projectile: smoothly track projectile's live X-position with slight lag
        const projX = this.activeRequest.getProjectileX();
        const trackZoom = lerp(this.camStartFrame.zoom, this.beat2TargetFrame.zoom, 0.5);
        desiredZoom = trackZoom;
        if (projX !== null && Number.isFinite(projX)) {
          desiredPanX = (this.viewportW * 0.5 - projX) * trackZoom;
          desiredPanY = lerp(this.camStartFrame.panY, this.beat2TargetFrame.panY, 0.5);
        } else {
          desiredPanX = this.beat2TargetFrame.panX;
          desiredPanY = this.beat2TargetFrame.panY;
        }
        desiredRot = 0;
        directPose = false;

        const maxLobWait = Math.max(0.45, cfg.rangedWhipPanSec * 3.5);
        if (this.phaseElapsed >= maxLobWait) {
          this.enterImpactFreeze();
        }
      } else {
        // Fast projectile / AoE volley: rapid EaseOutExpo whip-pan straight to Target / Centroid
        const whipDur = Math.max(0.08, cfg.rangedWhipPanSec * tempo);
        phaseProgress = clamp01(this.phaseElapsed / whipDur);
        const whipEase = easeOutExpo(phaseProgress);

        desiredZoom = lerp(this.camStartFrame.zoom, this.beat2TargetFrame.zoom, whipEase);
        desiredPanX = lerp(this.camStartFrame.panX, this.beat2TargetFrame.panX, whipEase);
        desiredPanY = lerp(this.camStartFrame.panY, this.beat2TargetFrame.panY, whipEase);
        desiredRot = 0;
        directPose = true;

        const maxTravelWait = this.activeRequest.waitForExternalImpact
          ? Math.max(whipDur + 0.25, 0.35)
          : whipDur;
        if (this.phaseElapsed >= maxTravelWait) {
          this.enterImpactFreeze();
        }
      }
    } else if (this.phase === 'impact_freeze') {
      this.advancePendingCascades(dt);
      this.hitstopRemaining = Math.max(0, this.hitstopRemaining - dt);
      if (this.hitstopRemaining > 0) {
        isHitStopped = true;
        simDt = 0;
      } else {
        this.phase = 'followthrough';
        this.phaseElapsed = 0;
      }
      this.dimmerAlpha = cfg.dimmerAlpha;
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;
      desiredZoom = this.holdZoomStart;
      desiredPanX = this.beat2TargetFrame.panX;
      desiredPanY = this.beat2TargetFrame.panY;
      desiredRot = this.targetRotRad;
      directPose = true;
    } else if (this.phase === 'followthrough' && this.activeRequest) {
      this.advancePendingCascades(dt);
      this.phaseElapsed += dt;
      const isCrit =
        this.activeRequest.actionKind === 'crit' ||
        this.activeRequest.actionKind === 'overdrive';
      const holdDur = Math.max(
        0.18,
        (isCrit ? cfg.holdCritSec : cfg.holdNormalSec) * tempo,
      );
      phaseProgress = clamp01(this.phaseElapsed / holdDur);

      // Hold Phase Camera Creep: continuously creep zoom inward +5%-10% (e.g. 1.4x -> 1.51x)
      desiredZoom = lerp(this.holdZoomStart, this.holdZoomEnd, phaseProgress);
      const zoomRatio = this.holdZoomStart > 0.01 ? desiredZoom / this.holdZoomStart : 1;
      desiredPanX = this.beat2TargetFrame.panX * zoomRatio;
      desiredPanY = this.beat2TargetFrame.panY * zoomRatio;
      desiredRot = this.targetRotRad * (1 - phaseProgress * 0.22);
      directPose = true;

      this.dimmerAlpha = cfg.dimmerAlpha;
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? 0 : 1;
      if (this.speedLinesAlpha > 0) {
        this.speedLinesAlpha = Math.max(0, this.speedLinesAlpha - dt * 1.9);
      }

      if (this.phaseElapsed >= holdDur) {
        // Flush any remaining cascade hits before reset
        if (this.pendingCascades.length > 0) {
          this.advancePendingCascades(10);
        }
        this.phase = 'reset';
        this.phaseElapsed = 0;
        this.camStartFrame = {
          zoom: this.camera.zoom,
          panX: this.camera.panX,
          panY: this.camera.panY,
        };
        this.camGoalFrame = {
          zoom: options.idleZoom ?? 1,
          panX: options.idlePanX ?? 0,
          panY: options.idlePanY ?? 0,
        };
        this.startRotRad = this.camera.rotationRad;
        this.targetRotRad = 0;
        this.juice.beginReset();
      }
    } else if (this.phase === 'reset') {
      this.phaseElapsed += dt;
      const resetDur = Math.max(0.08, cfg.resetSec * tempo);
      phaseProgress = clamp01(this.phaseElapsed / resetDur);
      const resetEase = easeInOutCubic(phaseProgress);

      this.dimmerAlpha = cfg.dimmerAlpha * (1 - resetEase);
      this.worldUiAlpha = cfg.hideWorldUiDuringCutIn ? resetEase : 1;
      this.speedLinesAlpha = Math.max(0, this.speedLinesAlpha - dt * 4);

      desiredZoom = lerp(this.camStartFrame.zoom, this.camGoalFrame.zoom, resetEase);
      desiredPanX = lerp(this.camStartFrame.panX, this.camGoalFrame.panX, resetEase);
      desiredPanY = lerp(this.camStartFrame.panY, this.camGoalFrame.panY, resetEase);
      desiredRot = lerp(this.startRotRad, 0, resetEase);
      directPose = true;

      if (this.phaseElapsed >= resetDur) {
        const finishedResolve = this.activeResolve;
        this.cleanupActiveState();
        if (finishedResolve) finishedResolve();

        // Pull the next serialized cut-in from the queue if present
        if (this.queue.length > 0) {
          const nextEntry = this.queue.shift();
          if (nextEntry) {
            this.startEntry(nextEntry);
          }
        }
      }
    }

    let invertFlashAlpha = 0;
    if (!options.reducedMotion && this.invertFlashFramesLeft > 0) {
      invertFlashAlpha = 0.74;
      this.invertFlashFramesLeft -= 1;
    }

    if (this.phase !== 'idle') {
      this.juice.stepFrame(dt, isHitStopped, this.phase, phaseProgress);
    }

    const isCritActive =
      this.activeRequest?.actionKind === 'crit' ||
      this.activeRequest?.actionKind === 'overdrive';
    const maxShakePx =
      this.viewportW * (isCritActive ? cfg.shakeCritVw : cfg.shakeNormalVw);

    const camSnap = this.camera.step(dt, {
      viewportW: this.viewportW,
      viewportH: this.viewportH,
      targetZoom: desiredZoom,
      targetPanX: desiredPanX,
      targetPanY: desiredPanY,
      targetRotRad: desiredRot,
      lerpRate: this.phase === 'travel' ? 14 : 10,
      shakeDecayPerSec: cfg.shakeDecayPerSec,
      maxShakePx,
      directPose,
      tacticalViewActive: false,
      reducedMotion: options.reducedMotion,
    });

    return {
      active: this.phase !== 'idle',
      phase: this.phase,
      stagingMode: this.stagingMode,
      isHitStopped,
      simDt,
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

/**
 * Renders Darkest Dungeon comic speed lines, radial crit vignette pulse,
 * and 2-frame invert impact flash in screen space on the foreground canvas layer.
 */
export function renderCutInForegroundVfx(
  ctx: CanvasRenderingContext2D,
  frame: SequencerFrameState,
  viewportW: number,
  viewportH: number,
  elapsed: number,
): void {
  if (frame.speedLinesAlpha > 0.02) {
    ctx.save();
    const ox = frame.impactOriginX || viewportW * 0.5;
    const oy = frame.impactOriginY || viewportH * 0.55;
    const maxR = Math.hypot(viewportW, viewportH) * 0.95;

    // Subtle dark edge vignette pulse framing the crit focal zone
    const vig = ctx.createRadialGradient(ox, oy, maxR * 0.18, ox, oy, maxR * 0.82);
    vig.addColorStop(0, 'rgba(3, 7, 18, 0)');
    vig.addColorStop(1, `rgba(3, 7, 18, ${(frame.speedLinesAlpha * 0.45).toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(-32, -32, viewportW + 64, viewportH + 64);

    ctx.globalCompositeOperation = 'lighter';
    const rayCount = 28;
    for (let i = 0; i < rayCount; i++) {
      const baseAng = (i / rayCount) * Math.PI * 2 + Math.sin(elapsed * 22 + i) * 0.04;
      const innerR = 72 + ((i * 29) % 58);
      const x0 = ox + Math.cos(baseAng) * innerR;
      const y0 = oy + Math.sin(baseAng) * innerR;
      const x1 = ox + Math.cos(baseAng) * maxR;
      const y1 = oy + Math.sin(baseAng) * maxR;
      ctx.strokeStyle =
        i % 3 === 0
          ? `rgba(255, 199, 0, ${frame.speedLinesAlpha * 0.42})`
          : i % 2 === 0
            ? `rgba(0, 240, 255, ${frame.speedLinesAlpha * 0.36})`
            : `rgba(255, 255, 255, ${frame.speedLinesAlpha * 0.48})`;
      ctx.lineWidth = i % 4 === 0 ? 2.8 : 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (frame.invertFlashAlpha > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = `rgba(255, 255, 255, ${frame.invertFlashAlpha})`;
    ctx.fillRect(-32, -32, viewportW + 64, viewportH + 64);
    ctx.restore();
  }
}
