import { clamp01, perlinNoise1D } from './combatPresentationMath';

export interface CameraActorBounds {
  id: string;
  x: number;
  groundY: number;
  widthPx: number;
  heightPx: number;
}

export interface CameraFocusFrame {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ActionCameraStepInput {
  viewportW: number;
  viewportH: number;
  targetZoom: number;
  targetPanX: number;
  targetPanY: number;
  targetRotRad: number;
  lerpRate: number;
  shakeDecayPerSec: number;
  /** Maximum trauma shake offset in pixels (viewport-relative, e.g. viewportW * 0.022) */
  maxShakePx?: number;
  /** When true, snaps directly to the sequencer's eased curve targets (EaseOutExpo / EaseInOutCubic) */
  directPose?: boolean;
  tacticalViewActive: boolean;
  reducedMotion: boolean;
}

export interface ActionCameraStateSnapshot {
  zoom: number;
  panX: number;
  panY: number;
  rotationRad: number;
  trauma: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  shakeRotRad: number;
}

// Backdrop overscan margin rendered beyond [0..W, 0..H] in combatRenderer.ts
export const BACKDROP_BLEED_X = 32;
export const BACKDROP_BLEED_Y = 16;

/**
 * Computes the minimum zoom multiplier required so a rotated viewport of size
 * `(viewportW, viewportH)` tilted by `rotationRad` never exposes unrendered corners
 * outside the overscanned backdrop bounds.
 */
export function computeMinZoomForRotation(
  viewportW: number,
  viewportH: number,
  rotationRad: number,
  bleedX = BACKDROP_BLEED_X,
  bleedY = BACKDROP_BLEED_Y,
): number {
  const w = Math.max(1, viewportW);
  const h = Math.max(1, viewportH);
  const absRot = Math.abs(rotationRad);
  if (absRot < 1e-5) return 1.0;
  const cosR = Math.cos(absRot);
  const sinR = Math.sin(absRot);
  const rotW = w * cosR + h * sinR;
  const rotH = w * sinR + h * cosR;
  return Math.max(1.0, rotW / (w + bleedX), rotH / (h + bleedY));
}

/**
 * Dynamically clamps `(panX, panY)` against background boundaries accounting for
 * both current `zoom` AND rotated viewport bounding extents (`rotationRad`) so
 * Dutch angle tilting (1.5deg-3.5deg) never reveals empty screen corners.
 */
export function clampPanForRotationBounds(
  panX: number,
  panY: number,
  zoom: number,
  rotationRad: number,
  viewportW: number,
  viewportH: number,
  bleedX = BACKDROP_BLEED_X,
  bleedY = BACKDROP_BLEED_Y,
): { panX: number; panY: number; minZoom: number } {
  const w = Math.max(1, viewportW);
  const h = Math.max(1, viewportH);
  const absRot = Math.abs(rotationRad);
  const cosR = Math.cos(absRot);
  const sinR = Math.sin(absRot);

  const minZoom = computeMinZoomForRotation(w, h, absRot, bleedX, bleedY);
  const safeZoom = Math.max(minZoom, zoom);

  // Available world half-extents of the overscanned backdrop
  const availHalfW = w * 0.5 + bleedX * 0.5;
  const availHalfH = h * 0.5 + bleedY * 0.5;

  // Half-extents of the rotated screen rectangle projected back into world space
  const visHalfW = (w * cosR + h * sinR) / (2 * safeZoom);
  const visHalfH = (w * sinR + h * cosR) / (2 * safeZoom);

  // Allowed world-space shift of the viewport center before any corner leaves backdrop bounds
  const maxWorldShiftX = Math.max(0, availHalfW - visHalfW);
  const maxWorldShiftY = Math.max(0, availHalfH - visHalfH);

  // World shift from screen pan (panX, panY) under inverse rotation satisfies:
  //   |shiftX| <= (|panX|*cosR + |panY|*sinR) / z
  //   |shiftY| <= (|panX|*sinR + |panY|*cosR) / z
  // Clamp screen pan cleanly and scale down proportionally if coupled rotation cross-term exceeds budget.
  let clampedX = Math.max(-maxWorldShiftX * safeZoom, Math.min(maxWorldShiftX * safeZoom, panX));
  let clampedY = Math.max(-maxWorldShiftY * safeZoom, Math.min(maxWorldShiftY * safeZoom, panY));

  const worstShiftX = (Math.abs(clampedX) * cosR + Math.abs(clampedY) * sinR) / safeZoom;
  const worstShiftY = (Math.abs(clampedX) * sinR + Math.abs(clampedY) * cosR) / safeZoom;
  let scale = 1.0;
  if (worstShiftX > maxWorldShiftX && worstShiftX > 1e-5) {
    scale = Math.min(scale, maxWorldShiftX / worstShiftX);
  }
  if (worstShiftY > maxWorldShiftY && worstShiftY > 1e-5) {
    scale = Math.min(scale, maxWorldShiftY / worstShiftY);
  }
  if (scale < 1.0) {
    clampedX *= scale;
    clampedY *= scale;
  }

  return { panX: clampedX, panY: clampedY, minZoom };
}

/**
 * Framing, Dutch-angle, rotation-aware overscan, and viewport-relative Perlin shake controller.
 * Always steps using unscaled wall `rawDt` so trauma shake and flash feedback stay violently
 * alive DURING Hit-Stop simulation freezes.
 */
export class ActionCameraController {
  public zoom = 1;
  public panX = 0;
  public panY = 0;
  public rotationRad = 0;

  public trauma = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;
  public shakeRotRad = 0;

  private directionalKickX = 0;
  private directionalKickY = 0;
  private noiseClock = 0;
  private activeMaxShakePx = 18;

  public reset(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.rotationRad = 0;
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotRad = 0;
    this.directionalKickX = 0;
    this.directionalKickY = 0;
    this.noiseClock = 0;
  }

  public addTrauma(
    amount: number,
    kickDirX = 0,
    kickDirY = 0,
    viewportW = 960,
    shakeMaxVw = 0.018,
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.trauma = clamp01(this.trauma + amount);
    const vpShakePx = Math.max(8, viewportW * Math.max(0.006, shakeMaxVw));
    this.activeMaxShakePx = Math.max(this.activeMaxShakePx * 0.65, vpShakePx);

    if (Number.isFinite(kickDirX)) {
      this.directionalKickX += kickDirX * Math.min(vpShakePx * 1.1, amount * vpShakePx * 1.35);
    }
    if (Number.isFinite(kickDirY)) {
      this.directionalKickY += kickDirY * Math.min(vpShakePx * 0.65, amount * vpShakePx * 0.8);
    }
  }

  /**
   * Computes pan/zoom to frame Melee clash participants (or a single target) cleanly inside
   * safe viewport margins with rotation-aware overscan clamping.
   */
  public computeFocusFrame(
    actors: readonly CameraActorBounds[],
    viewportW: number,
    viewportH: number,
    desiredZoom: number,
    minZoom = 1.05,
    maxZoom = 1.95,
    expectedTiltRad = 0,
  ): CameraFocusFrame {
    if (actors.length === 0 || viewportW <= 0 || viewportH <= 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const halfW = Math.max(24, a.widthPx * 0.5);
      const height = Math.max(48, a.heightPx);
      minX = Math.min(minX, a.x - halfW);
      maxX = Math.max(maxX, a.x + halfW);
      minY = Math.min(minY, a.groundY - height);
      maxY = Math.max(maxY, a.groundY + 14);
    }

    const boxW = Math.max(76, maxX - minX);
    const boxH = Math.max(86, maxY - minY);
    const safeW = viewportW * 0.82;
    const safeH = viewportH * 0.78;
    const fitZoom = Math.min(safeW / boxW, safeH / boxH);
    const tiltFloor = computeMinZoomForRotation(viewportW, viewportH, expectedTiltRad);
    const zoom = Math.max(
      Math.max(1.0, minZoom, tiltFloor),
      Math.min(desiredZoom, Math.max(minZoom, fitZoom), maxZoom),
    );

    const focusCenterX = (minX + maxX) * 0.5;
    const focusCenterY = (minY + maxY) * 0.5;
    const rawPanX = (viewportW * 0.5 - focusCenterX) * zoom;
    const rawPanY = (viewportH * 0.5 - focusCenterY) * zoom;

    const clamped = clampPanForRotationBounds(
      rawPanX,
      rawPanY,
      zoom,
      expectedTiltRad,
      viewportW,
      viewportH,
    );

    return { zoom: Math.max(zoom, clamped.minZoom), panX: clamped.panX, panY: clamped.panY };
  }

  /**
   * Beat 1 (Ranged / Spit / Cast): Zoom tightly onto the Attacker alone (1.35x-1.45x),
   * offset slightly in the firing direction (`strikeDirX`) to leave compositional "lead room."
   */
  public computeShooterLeadFrame(
    shooter: CameraActorBounds,
    strikeDirX: number,
    viewportW: number,
    viewportH: number,
    desiredZoom: number,
    leadRoomVw = 0.06,
    expectedTiltRad = 0,
  ): CameraFocusFrame {
    if (viewportW <= 0 || viewportH <= 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }
    const tiltFloor = computeMinZoomForRotation(viewportW, viewportH, expectedTiltRad);
    const zoom = Math.max(1.2, tiltFloor, Math.min(1.65, desiredZoom));

    // Shift focal point slightly ahead of the shooter along the firing direction so the
    // shooter sits in the rear third with open lead room ahead of their weapon/jaw.
    const leadOffsetX = (strikeDirX >= 0 ? 1 : -1) * viewportW * leadRoomVw;
    const focusX = shooter.x + leadOffsetX;
    const focusY = shooter.groundY - shooter.heightPx * 0.52;

    const rawPanX = (viewportW * 0.5 - focusX) * zoom;
    const rawPanY = (viewportH * 0.5 - focusY) * zoom;
    const clamped = clampPanForRotationBounds(
      rawPanX,
      rawPanY,
      zoom,
      expectedTiltRad,
      viewportW,
      viewportH,
    );

    return { zoom: Math.max(zoom, clamped.minZoom), panX: clamped.panX, panY: clamped.panY };
  }

  /**
   * Beat 2 (Ranged AoE): Frame the centroid of all hit targets at a clamped wider zoom
   * (1.20x-1.30x, never zooming out past 1.0x).
   */
  public computeAoeCentroidFrame(
    targets: readonly CameraActorBounds[],
    viewportW: number,
    viewportH: number,
    minZoom = 1.22,
    maxZoom = 1.30,
    expectedTiltRad = 0,
  ): CameraFocusFrame {
    if (targets.length === 0 || viewportW <= 0 || viewportH <= 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const halfW = Math.max(24, t.widthPx * 0.5);
      const height = Math.max(48, t.heightPx);
      sumX += t.x;
      sumY += t.groundY - height * 0.5;
      minX = Math.min(minX, t.x - halfW);
      maxX = Math.max(maxX, t.x + halfW);
      minY = Math.min(minY, t.groundY - height);
      maxY = Math.max(maxY, t.groundY + 14);
    }

    const boxW = Math.max(80, maxX - minX);
    const boxH = Math.max(90, maxY - minY);
    const fitZoom = Math.min((viewportW * 0.84) / boxW, (viewportH * 0.78) / boxH);
    const tiltFloor = computeMinZoomForRotation(viewportW, viewportH, expectedTiltRad);
    const clampedMin = Math.max(1.0, tiltFloor, Math.min(minZoom, maxZoom));
    const zoom = Math.max(clampedMin, Math.min(maxZoom, Math.max(clampedMin, fitZoom)));

    const centroidX = sumX / targets.length;
    const centroidY = sumY / targets.length;
    const rawPanX = (viewportW * 0.5 - centroidX) * zoom;
    const rawPanY = (viewportH * 0.5 - centroidY) * zoom;

    const clamped = clampPanForRotationBounds(
      rawPanX,
      rawPanY,
      zoom,
      expectedTiltRad,
      viewportW,
      viewportH,
    );

    return { zoom: Math.max(zoom, clamped.minZoom), panX: clamped.panX, panY: clamped.panY };
  }

  public step(rawDt: number, input: ActionCameraStepInput): ActionCameraStateSnapshot {
    const dt = Math.max(0, Math.min(0.1, rawDt));

    if (input.tacticalViewActive) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.rotationRad = 0;
      this.trauma = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotRad = 0;
      this.directionalKickX = 0;
      this.directionalKickY = 0;
      return this.getSnapshot();
    }

    const targetRot = input.reducedMotion ? 0 : input.targetRotRad;

    if (input.directPose) {
      this.zoom = input.targetZoom;
      this.panX = input.targetPanX;
      this.panY = input.targetPanY;
      this.rotationRad = targetRot;
    } else {
      const alpha = 1 - Math.exp(-Math.max(1, input.lerpRate) * dt);
      this.zoom += (input.targetZoom - this.zoom) * alpha;
      this.panX += (input.targetPanX - this.panX) * alpha;
      this.panY += (input.targetPanY - this.panY) * alpha;
      this.rotationRad += (targetRot - this.rotationRad) * alpha;
    }

    if (input.reducedMotion) {
      this.trauma = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotRad = 0;
      this.directionalKickX = 0;
      this.directionalKickY = 0;
    } else {
      this.noiseClock += dt * 36;
      this.trauma = Math.max(0, this.trauma - Math.max(0.5, input.shakeDecayPerSec) * dt);
      const kickDecay = Math.exp(-16 * dt);
      this.directionalKickX *= kickDecay;
      this.directionalKickY *= kickDecay;

      const sq = this.trauma * this.trauma;
      if (
        sq > 0.001 ||
        Math.abs(this.directionalKickX) > 0.1 ||
        Math.abs(this.directionalKickY) > 0.1
      ) {
        const maxShakePx = Math.max(
          8,
          input.maxShakePx ?? this.activeMaxShakePx ?? input.viewportW * 0.016,
        );
        const maxShakeRotRad = (2.2 * Math.PI) / 180;
        this.shakeOffsetX =
          perlinNoise1D(this.noiseClock + 11.3) * maxShakePx * sq + this.directionalKickX;
        this.shakeOffsetY =
          perlinNoise1D(this.noiseClock + 47.9) * maxShakePx * 0.72 * sq + this.directionalKickY;
        this.shakeRotRad = perlinNoise1D(this.noiseClock + 91.7) * maxShakeRotRad * sq;
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeRotRad = 0;
      }
    }

    // Rotation-aware overscan clamp on both base camera pose AND combined (pan + shake)
    // so tilted corners and directional trauma kicks never expose unrendered void.
    const totalRot = this.rotationRad + this.shakeRotRad;
    if (
      Math.abs(totalRot) > 1e-4 ||
      this.zoom > 1.001 ||
      Math.abs(this.panX + this.shakeOffsetX) > 0.25 ||
      Math.abs(this.panY + this.shakeOffsetY) > 0.25
    ) {
      const clampedBase = clampPanForRotationBounds(
        this.panX,
        this.panY,
        this.zoom,
        totalRot,
        input.viewportW,
        input.viewportH,
      );
      this.zoom = Math.max(this.zoom, clampedBase.minZoom);
      this.panX = clampedBase.panX;
      this.panY = clampedBase.panY;

      const clampedTotal = clampPanForRotationBounds(
        this.panX + this.shakeOffsetX,
        this.panY + this.shakeOffsetY,
        this.zoom,
        totalRot,
        input.viewportW,
        input.viewportH,
      );
      this.shakeOffsetX = clampedTotal.panX - this.panX;
      this.shakeOffsetY = clampedTotal.panY - this.panY;
    }

    return this.getSnapshot();
  }

  public getSnapshot(): ActionCameraStateSnapshot {
    return {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      rotationRad: this.rotationRad,
      trauma: this.trauma,
      shakeOffsetX: this.shakeOffsetX,
      shakeOffsetY: this.shakeOffsetY,
      shakeRotRad: this.shakeRotRad,
    };
  }

  /**
   * Applies the camera transform to a Canvas2D context assuming DPR scaling is already active.
   * Convention: zoom > 1 magnifies the world around the viewport center `(W/2, H/2)`.
   */
  public applyToCanvas2D(ctx: CanvasRenderingContext2D, viewportW: number, viewportH: number): void {
    const totalRot = this.rotationRad + this.shakeRotRad;
    const hasTransform =
      Math.abs(this.zoom - 1) > 0.0015 ||
      Math.abs(this.panX) > 0.25 ||
      Math.abs(this.panY) > 0.25 ||
      Math.abs(totalRot) > 0.0005 ||
      Math.abs(this.shakeOffsetX) > 0.1 ||
      Math.abs(this.shakeOffsetY) > 0.1;

    if (!hasTransform) return;

    const cx = viewportW * 0.5;
    const cy = viewportH * 0.5;
    ctx.translate(cx + this.panX + this.shakeOffsetX, cy + this.panY + this.shakeOffsetY);
    if (Math.abs(totalRot) > 0.0005) {
      ctx.rotate(totalRot);
    }
    if (Math.abs(this.zoom - 1) > 0.0015) {
      ctx.scale(this.zoom, this.zoom);
    }
    ctx.translate(-cx, -cy);
  }

  /**
   * Builds a column-major 3x3 WebGL2 projection+view matrix transforming world pixels
   * `(0..W, 0..H)` into WebGL NDC `[-1..1]` with identical pivot/rotation/zoom/pan/shake
   * to `applyToCanvas2D`.
   */
  public buildWebGLViewProjMatrix(
    viewportW: number,
    viewportH: number,
    outMatrix: Float32Array = new Float32Array(9),
  ): Float32Array {
    const w = Math.max(1, viewportW);
    const h = Math.max(1, viewportH);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const z = this.zoom || 1;
    const rot = this.rotationRad + this.shakeRotRad;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    // Forward linear 2D map from world (x, y) -> screen (sx, sy):
    //   dx = x - cx; dy = y - cy
    //   sx = cx + panX + shakeX + z * (dx * cosR - dy * sinR)
    //   sy = cy + panY + shakeY + z * (dx * sinR + dy * cosR)
    // Then NDC:
    //   ndcX = (2 / w) * sx - 1
    //   ndcY = 1 - (2 / h) * sy
    const a = z * cosR;
    const b = -z * sinR;
    const c = z * sinR;
    const d = z * cosR;

    const tx = cx + this.panX + this.shakeOffsetX - (a * cx + b * cy);
    const ty = cy + this.panY + this.shakeOffsetY - (c * cx + d * cy);

    const invW2 = 2 / w;
    const invH2 = 2 / h;

    // Column 0 (x coefficients for ndcX, ndcY, w)
    outMatrix[0] = invW2 * a;
    outMatrix[1] = -invH2 * c;
    outMatrix[2] = 0;

    // Column 1 (y coefficients for ndcX, ndcY, w)
    outMatrix[3] = invW2 * b;
    outMatrix[4] = -invH2 * d;
    outMatrix[5] = 0;

    // Column 2 (translation)
    outMatrix[6] = invW2 * tx - 1;
    outMatrix[7] = 1 - invH2 * ty;
    outMatrix[8] = 1;

    return outMatrix;
  }
}
