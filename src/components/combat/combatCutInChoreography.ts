import type { ActionCameraController, CameraActorBounds, CameraFocusFrame } from './ActionCameraController';
import type { CombatPresentationConfig, CutInStagingMode } from './combatPresentationConfig';
import { computeNoseToNoseMeleeSlides } from './combatStagingClassifier';
import type { SpriteJuiceFeedbackHandler } from './SpriteJuiceFeedbackHandler';

export type CutInPhase = 'idle' | 'windup' | 'travel' | 'impact_freeze' | 'followthrough' | 'reset';
export type CutInActionKind = 'normal' | 'crit' | 'aoe' | 'overdrive';

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
  /** Targets that cleanly evade this attack (skip recoil/flash/knockback while keeping dramatic framing) */
  evadedTargetIds?: readonly string[];
  /** Explicit hit-stop override in seconds (e.g. 0.05s tension beat right before dodge takeoff) */
  hitstopOverrideSec?: number;
  /** Explicit follow-through zoomed hold override in seconds (not shrunk by pack tempo) */
  holdDurationOverrideSec?: number;
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
  simDt: number;
  dimmerAlpha: number;
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

export interface PendingCascadeHit {
  targetId: string;
  index: number;
  delayRemainingSec: number;
}

export interface ResolvedCutInStagingPlan {
  stagingMode: CutInStagingMode;
  strikeDirX: number;
  impactOriginX: number;
  impactOriginY: number;
  camGoalFrame: CameraFocusFrame;
  beat2TargetFrame: CameraFocusFrame;
  targetRotRad: number;
  isMelee: boolean;
  meleeSlideEachPx: number;
  rangedLungePx: number;
  attackerSlideOverridePx?: number;
  targetSlideOverridesPx?: Map<string, number>;
}

/**
 * Resolves camera framing, nose-to-nose melee clash slides, ranged Beat 1/Beat 2 frames,
 * and impact origins when starting a CombatActionSequencer cut-in entry.
 */
export function resolveCutInStagingPlan(params: {
  request: CutInRequest;
  config: CombatPresentationConfig;
  camera: ActionCameraController;
  viewportW: number;
  viewportH: number;
}): ResolvedCutInStagingPlan {
  const { request, config, camera, viewportW, viewportH } = params;

  const stagingMode: CutInStagingMode =
    request.stagingMode ??
    (request.actionKind === 'aoe' ||
    request.actionKind === 'overdrive' ||
    request.targetBounds.length > 1
      ? 'ranged_aoe'
      : 'melee');

  // Sort target bounds left-to-right for deterministic AoE centroid & L->R cascade order
  const sortedTargets = [...request.targetBounds].sort((a, b) => a.x - b.x);
  const primaryTarget = sortedTargets[0] ?? request.attackerBounds;
  const strikeDirX = primaryTarget.x >= request.attackerBounds.x ? 1 : -1;

  // Average impact origin across targets (used for Crit radial speed lines)
  let originX = 0;
  let originY = 0;
  for (let i = 0; i < sortedTargets.length; i++) {
    originX += sortedTargets[i].x;
    originY += sortedTargets[i].groundY - sortedTargets[i].heightPx * 0.52;
  }
  let impactOriginX: number;
  let impactOriginY: number;
  if (sortedTargets.length > 0) {
    impactOriginX = originX / sortedTargets.length;
    impactOriginY = originY / sortedTargets.length;
  } else {
    impactOriginX = request.attackerBounds.x;
    impactOriginY = request.attackerBounds.groundY - request.attackerBounds.heightPx * 0.52;
  }

  const evadedSet = new Set(request.evadedTargetIds ?? []);
  const allTargetsEvaded =
    request.targetIds.length > 0 && request.targetIds.every((id) => evadedSet.has(id));
  const isCrit =
    !allTargetsEvaded &&
    (request.actionKind === 'crit' || request.actionKind === 'overdrive');
  const isMelee = stagingMode === 'melee';
  const rawTiltDeg = isCrit ? config.dutchDegCrit : config.dutchDegNormal;
  const tiltDeg = allTargetsEvaded ? Math.min(rawTiltDeg, 2.0) : rawTiltDeg;
  const impactRotRad = ((-strikeDirX * tiltDeg) * Math.PI) / 180;

  const gapPx = Math.abs(primaryTarget.x - request.attackerBounds.x);
  const slideRatio = Math.max(0.25, Math.min(0.4, config.meleeClashSlideRatio));
  const meleeSlideEachPx = isMelee ? gapPx * 0.5 * slideRatio : 0;
  // Ranged: stay in formation slot with only a 5%-10% forward lunge
  const rangedLungePx = Math.max(
    4,
    request.attackerBounds.widthPx * Math.max(0.05, Math.min(0.1, config.rangedSlotLungeRatio)),
  );

  let attackerSlideOverridePx: number | undefined;
  let targetSlideOverridesPx: Map<string, number> | undefined;
  let camGoalFrame: CameraFocusFrame;
  let beat2TargetFrame: CameraFocusFrame;
  let targetRotRad: number;

  if (isMelee) {
    // Pull Attacker & Target(s) into a tight nose-to-nose Darkest Dungeon center-stage clash
    const meleePlan = computeNoseToNoseMeleeSlides({
      attackerBounds: request.attackerBounds,
      targetBounds: sortedTargets,
      viewportW,
      clashGapVw: config.meleeClashGapVw,
      strikeDirX,
    });
    attackerSlideOverridePx = meleePlan.attackerSlideX;
    targetSlideOverridesPx = meleePlan.targetSlidesX;
    impactOriginX = meleePlan.contactMidX;
    impactOriginY = meleePlan.contactMidY;

    const shiftedAttacker: CameraActorBounds = {
      ...request.attackerBounds,
      x: request.attackerBounds.x + meleePlan.attackerSlideX,
    };
    const shiftedTargets: CameraActorBounds[] = sortedTargets.map((t) => ({
      ...t,
      x: t.x + (meleePlan.targetSlidesX.get(t.id) ?? 0),
    }));
    const focusActors: CameraActorBounds[] = [shiftedAttacker, ...shiftedTargets];
    if (allTargetsEvaded) {
      // Reserve modest clearance behind evading target so wide acrobatic slide stays cleanly in frame
      const dodgeBackClearancePx = Math.min(viewportW * 0.08, 72);
      for (const st of shiftedTargets) {
        if (evadedSet.has(st.id)) {
          focusActors.push({
            ...st,
            x: Math.max(viewportW * 0.08, st.x + strikeDirX * dodgeBackClearancePx),
          });
        }
      }
    }
    const desiredZoom = allTargetsEvaded
      ? Math.min(config.zoomNormal, 1.54)
      : isCrit
        ? config.zoomCrit
        : config.zoomNormal;
    const focus = camera.computeFocusFrame(
      focusActors,
      viewportW,
      viewportH,
      desiredZoom,
      Math.min(desiredZoom, allTargetsEvaded ? 1.38 : 1.48),
      allTargetsEvaded ? 1.62 : 1.92,
      impactRotRad,
    );
    camGoalFrame = focus;
    beat2TargetFrame = focus;
    targetRotRad = impactRotRad;
  } else {
    // Ranged / Spit / Cast / AoE Beat 1: Tight lead-room zoom onto Shooter alone
    camGoalFrame = camera.computeShooterLeadFrame(
      request.attackerBounds,
      strikeDirX,
      viewportW,
      viewportH,
      config.zoomRangedShooter,
      config.rangedLeadRoomVw,
      0,
    );

    // Precompute Beat 2 destination frame (Target close-up or AoE Centroid)
    if (stagingMode === 'ranged_aoe' || sortedTargets.length > 1) {
      beat2TargetFrame = camera.computeAoeCentroidFrame(
        sortedTargets,
        viewportW,
        viewportH,
        config.zoomAoeMin,
        config.zoomAoeMax,
        impactRotRad,
      );
    } else {
      const isPrimaryEvaded = evadedSet.has(primaryTarget.id);
      const desiredTargetZoom = isPrimaryEvaded
        ? Math.min(config.zoomNormal, 1.42)
        : isCrit
          ? config.zoomCrit
          : config.zoomNormal;
      const beat2Actors: CameraActorBounds[] = [primaryTarget];
      if (isPrimaryEvaded) {
        const dodgeBackClearancePx = Math.min(viewportW * 0.075, 64);
        beat2Actors.push({
          ...primaryTarget,
          x: Math.max(viewportW * 0.08, primaryTarget.x + strikeDirX * dodgeBackClearancePx),
        });
      }
      beat2TargetFrame = camera.computeFocusFrame(
        beat2Actors,
        viewportW,
        viewportH,
        desiredTargetZoom,
        Math.min(desiredTargetZoom, isPrimaryEvaded ? 1.32 : 1.38),
        isPrimaryEvaded ? 1.52 : 1.9,
        impactRotRad,
      );
    }
    targetRotRad = 0; // Hold level during Beat 1 aim; snap Dutch tilt on Beat 2 impact
  }

  return {
    stagingMode,
    strikeDirX,
    impactOriginX,
    impactOriginY,
    camGoalFrame,
    beat2TargetFrame,
    targetRotRad,
    isMelee,
    meleeSlideEachPx,
    rangedLungePx,
    attackerSlideOverridePx,
    targetSlideOverridesPx,
  };
}

export interface ImpactFreezePlanResult {
  holdZoomStart: number;
  holdZoomEnd: number;
  targetRotRad: number;
  hitstopSec: number;
  invertFlashFrames: number;
  speedLinesAlpha: number;
  pendingCascades: PendingCascadeHit[];
}

/**
 * Triggers camera trauma, attacker scale punch, and immediate/cascaded target impacts
 * when entering Phase B (`impact_freeze`).
 */
export function applyImpactFreezeChoreography(params: {
  request: CutInRequest;
  config: CombatPresentationConfig;
  stagingMode: CutInStagingMode;
  strikeDirX: number;
  tempoScale: number;
  viewportW: number;
  beat2TargetFrame: CameraFocusFrame;
  camera: ActionCameraController;
  juice: SpriteJuiceFeedbackHandler;
  invokeSafely: (fn?: () => void) => void;
}): ImpactFreezePlanResult {
  const {
    request: req,
    config: cfg,
    stagingMode,
    strikeDirX,
    tempoScale,
    viewportW,
    beat2TargetFrame,
    camera,
    juice,
    invokeSafely,
  } = params;

  const evadedSet = new Set(req.evadedTargetIds ?? []);
  const allTargetsEvaded =
    req.targetIds.length > 0 && req.targetIds.every((id) => evadedSet.has(id));
  const isCrit =
    !allTargetsEvaded &&
    (req.actionKind === 'crit' || req.actionKind === 'overdrive');
  const isAoe = stagingMode === 'ranged_aoe' || req.actionKind === 'aoe' || req.targetIds.length > 1;
  const isMelee = stagingMode === 'melee';

  const holdZoomStart = beat2TargetFrame.zoom;
  const creepPct = allTargetsEvaded
    ? Math.min(0.04, Math.max(0, cfg.holdZoomCreepPct * 0.5))
    : Math.max(0, Math.min(0.15, cfg.holdZoomCreepPct));
  const holdZoomCeiling = allTargetsEvaded ? (isMelee ? 1.66 : 1.52) : 2.05;
  const holdZoomEnd = Math.min(holdZoomCeiling, holdZoomStart * (1 + creepPct));

  const rawTiltDeg = isCrit ? cfg.dutchDegCrit : cfg.dutchDegNormal;
  const tiltDeg = allTargetsEvaded ? Math.min(rawTiltDeg, 2.0) : rawTiltDeg;
  const targetRotRad = ((-strikeDirX * tiltDeg) * Math.PI) / 180;

  let hitstopSec: number;
  if (req.hitstopOverrideSec !== undefined) {
    hitstopSec = Math.max(0, req.hitstopOverrideSec);
  } else if (allTargetsEvaded) {
    hitstopSec = 0.05;
  } else {
    const hitstopBase = isCrit
      ? cfg.hitstopCritSec
      : isAoe
        ? cfg.hitstopAoeSec
        : cfg.hitstopNormalSec;
    hitstopSec = hitstopBase * Math.max(0.75, tempoScale);
  }

  const invertFlashFrames = !allTargetsEvaded && isCrit && cfg.critInvertFlashEnabled ? 2 : 0;
  const speedLinesAlpha = !allTargetsEvaded && isCrit && cfg.critSpeedLinesEnabled ? 0.92 : 0;

  const shakeMaxVw = allTargetsEvaded
    ? cfg.shakeNormalVw * 0.35
    : isCrit
      ? cfg.shakeCritVw
      : cfg.shakeNormalVw;
  camera.addTrauma(
    allTargetsEvaded
      ? Math.min(0.12, cfg.shakeTraumaNormal * 0.25)
      : isCrit
        ? cfg.shakeTraumaCrit
        : cfg.shakeTraumaNormal,
    strikeDirX,
    allTargetsEvaded ? -0.05 : isCrit ? -0.35 : -0.15,
    viewportW,
    shakeMaxVw,
  );

  const knockbackPx = viewportW * (isCrit ? cfg.knockbackCritVw : cfg.knockbackNormalVw);
  const holdDriftPx = viewportW * cfg.holdDriftApartVw;

  juice.triggerAttackerPunch({
    attackerId: req.attackerId,
    strikeDirX,
    attackerScalePunch: cfg.attackerScalePunch,
    holdDriftPx,
    isCrit,
    isMelee,
  });

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
      ? Math.max(0.015, Math.min(0.12, cfg.aoeCascadeStepMs / 1000))
      : 0;

  const pendingCascades: PendingCascadeHit[] = [];
  for (let i = 0; i < orderedTargetIds.length; i++) {
    const tid = orderedTargetIds[i];
    if (i === 0 || cascadeStepSec <= 0) {
      if (evadedSet.has(tid)) {
        juice.triggerTargetEvade({ targetId: tid });
      } else {
        juice.triggerTargetImpact({
          targetId: tid,
          strikeDirX,
          knockbackPx,
          holdDriftPx,
          whiteFlashFrames: cfg.whiteFlashFrames,
          isCrit,
          isMelee,
        });
      }
      invokeSafely(() => req.onImpactTarget?.(tid, i));
    } else {
      pendingCascades.push({
        targetId: tid,
        index: i,
        delayRemainingSec: cascadeStepSec * i,
      });
    }
  }

  invokeSafely(req.onImpactFrame);

  return {
    holdZoomStart,
    holdZoomEnd,
    targetRotRad,
    hitstopSec,
    invertFlashFrames,
    speedLinesAlpha,
    pendingCascades,
  };
}

/**
 * Advances queued left-to-right AoE cascade hits and fires per-target juice & callbacks.
 */
export function stepPendingCascadeHits(params: {
  rawDt: number;
  pendingCascades: PendingCascadeHit[];
  request: CutInRequest | null;
  config: CombatPresentationConfig;
  stagingMode: CutInStagingMode;
  strikeDirX: number;
  viewportW: number;
  juice: SpriteJuiceFeedbackHandler;
  invokeSafely: (fn?: () => void) => void;
}): void {
  const {
    rawDt,
    pendingCascades,
    request: req,
    config: cfg,
    stagingMode,
    strikeDirX,
    viewportW,
    juice,
    invokeSafely,
  } = params;
  if (!req || pendingCascades.length === 0) return;

  const evadedSet = new Set(req.evadedTargetIds ?? []);
  const isCrit = req.actionKind === 'crit' || req.actionKind === 'overdrive';
  const isMelee = stagingMode === 'melee';
  const knockbackPx = viewportW * (isCrit ? cfg.knockbackCritVw : cfg.knockbackNormalVw);
  const holdDriftPx = viewportW * cfg.holdDriftApartVw;

  for (let i = pendingCascades.length - 1; i >= 0; i--) {
    const item = pendingCascades[i];
    item.delayRemainingSec -= rawDt;
    if (item.delayRemainingSec <= 0) {
      pendingCascades.splice(i, 1);
      if (evadedSet.has(item.targetId)) {
        juice.triggerTargetEvade({ targetId: item.targetId });
      } else {
        juice.triggerTargetImpact({
          targetId: item.targetId,
          strikeDirX,
          knockbackPx,
          holdDriftPx,
          whiteFlashFrames: cfg.whiteFlashFrames,
          isCrit,
          isMelee,
        });
      }
      invokeSafely(() => req.onImpactTarget?.(item.targetId, item.index));
    }
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
