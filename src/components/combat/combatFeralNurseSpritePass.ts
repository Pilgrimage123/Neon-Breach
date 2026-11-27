import type { FeralNurseJuiceSample } from '../../utils/feralNurseJuiceController';
import {
  FERAL_NURSE_CANONICAL_HEIGHT,
  type FeralNurseAnimMode,
  type FeralNurseAnimSample,
  type FeralNurseSpriteFrame,
} from '../../utils/feralNurseSpriteSheet';
import type { CoreEnemySpriteContext } from './combatEnemyCoreSpritePass';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import { hexToRgba } from './mutantBlood';
import {
  type ControlPointDeform,
  type SpriteLandmarkProjectionParams,
  createIdentityControlPoints,
  projectSpriteLandmarkToStage,
} from './stageMeshMath';
import { deriveEnemyDeformAndUniforms } from './stageSpriteAdapter';

export interface FeralNurseBioVfxParams {
  fgCtx: CanvasRenderingContext2D;
  frame: FeralNurseSpriteFrame;
  frameIndex: number;
  mode: FeralNurseAnimMode;
  spriteX: number;
  enemyGroundY: number;
  hopY: number;
  staggerDy?: number;
  size: number;
  drawScale: number;
  facingSign: number;
  rotationRad?: number;
  headsetGlowIntensity: number;
  cloakIntensity: number;
  clawSlashProgress: number;
  pierceImpactIntensity: number;
  deform?: ControlPointDeform;
  squashStretch?: readonly [number, number];
  shearPx?: readonly [number, number];
  swayAmpPx?: number;
  swayPhase?: number;
  elapsed: number;
  seed: number;
}

/**
 * Renders the Feral Nurse's signature Optical-Camo & 7-Pierce bio-VFX layers tracked to spline deformation:
 * 1. Translucent cyan-magenta optical-camo shimmer veil, drifting holographic scanlines & ground stealth ring
 * 2. Persistent glowing magenta cyber-headset LED beacon + luminous paired feral eye glints (bright even while cloaked!)
 * 3. 7-Pierce surgical lunge ground slam shock-ring & deck dust plumes
 * 4. Triple bone-white & crimson-magenta talon crescent slash arcs with armor-pierce razor streak
 */
export function renderFeralNurseBioVfxOverlay(p: FeralNurseBioVfxParams): void {
  const {
    fgCtx,
    frame,
    mode,
    spriteX,
    enemyGroundY,
    hopY,
    staggerDy = 0,
    size,
    drawScale,
    facingSign,
    rotationRad = 0,
    headsetGlowIntensity,
    cloakIntensity,
    clawSlashProgress,
    pierceImpactIntensity,
    deform,
    squashStretch = [1, 1],
    shearPx = [0, 0],
    swayAmpPx = 0,
    swayPhase = 0,
    elapsed,
    seed,
  } = p;

  const projParams: SpriteLandmarkProjectionParams = {
    frame,
    worldX: spriteX,
    worldY: enemyGroundY + hopY + staggerDy,
    drawScale,
    facingSign,
    rotationRad,
    deform,
    squashStretch,
    shearPx,
    swayAmpPx,
    swayPhase,
  };

  // 1. Optical-Camo Shimmer Veil, Holographic Scanlines & Ground Stealth Ring
  if (cloakIntensity > 0.04) {
    const ci = Math.max(0, Math.min(1, cloakIntensity));
    const shimmerWave = 0.8 + 0.2 * Math.sin(elapsed * 11.5 + seed * 1.9);
    const bodyPos = projectSpriteLandmarkToStage({ dx: 0, dy: -frame.h * 0.46 }, projParams);
    const bodyCx = bodyPos.x;
    const bodyCy = bodyPos.y;
    const capsuleRx = size * 0.28;
    const capsuleRy = size * 0.44;

    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';

    // Subtle ground stealth refraction ripple
    const ringPulse = (elapsed * 1.25 + seed * 0.23) % 1;
    const ringRx = size * (0.24 + ringPulse * 0.14);
    const ringRy = (5.5 + ringPulse * 3.5) * Math.max(0.75, drawScale);
    fgCtx.strokeStyle = `rgba(34, 211, 238, ${0.42 * ci * (1 - ringPulse * 0.55)})`;
    fgCtx.lineWidth = Math.max(1.1, 1.8 * drawScale);
    fgCtx.setLineDash([6 * drawScale, 4 * drawScale]);
    fgCtx.beginPath();
    fgCtx.ellipse(spriteX, enemyGroundY - 1, ringRx, ringRy, 0, 0, Math.PI * 2);
    fgCtx.stroke();
    fgCtx.setLineDash([]);

    // Soft elliptical clip so optical-camo scanlines hug her silhouette cleanly
    fgCtx.save();
    fgCtx.beginPath();
    fgCtx.ellipse(bodyCx, bodyCy, capsuleRx, capsuleRy, 0, 0, Math.PI * 2);
    fgCtx.clip();

    // Subtle holographic distortion wash inside silhouette
    const veilGrad = fgCtx.createLinearGradient(
      bodyCx,
      bodyCy - capsuleRy,
      bodyCx,
      bodyCy + capsuleRy,
    );
    veilGrad.addColorStop(0, `rgba(34, 211, 238, ${0.14 * ci * shimmerWave})`);
    veilGrad.addColorStop(0.5, `rgba(232, 121, 249, ${0.11 * ci * shimmerWave})`);
    veilGrad.addColorStop(1, `rgba(34, 211, 238, ${0.16 * ci * shimmerWave})`);
    fgCtx.fillStyle = veilGrad;
    fgCtx.fillRect(
      bodyCx - capsuleRx,
      bodyCy - capsuleRy,
      capsuleRx * 2,
      capsuleRy * 2,
    );

    // Drifting cyan & magenta holographic scanlines
    const lineStep = Math.max(5, 7.5 * drawScale);
    const scrollOffset = (elapsed * 38 * drawScale) % lineStep;
    const startY = bodyCy - capsuleRy - lineStep + scrollOffset;
    const endY = bodyCy + capsuleRy;
    let rowIdx = 0;
    for (let y = startY; y <= endY; y += lineStep) {
      const jitterX = Math.sin(elapsed * 14 + rowIdx * 1.7 + seed) * 3.5 * drawScale;
      const isCyan = rowIdx % 3 !== 2;
      const lineAlpha = (isCyan ? 0.34 : 0.24) * ci * shimmerWave;
      fgCtx.strokeStyle = isCyan
        ? `rgba(103, 232, 249, ${lineAlpha})`
        : `rgba(244, 114, 182, ${lineAlpha})`;
      fgCtx.lineWidth = Math.max(0.85, 1.2 * drawScale);
      fgCtx.beginPath();
      fgCtx.moveTo(bodyCx - capsuleRx + jitterX, y);
      fgCtx.lineTo(bodyCx + capsuleRx + jitterX, y);
      fgCtx.stroke();
      rowIdx++;
    }

    // Sweeping refractive glint band across optical-camo membrane
    const bandU = (elapsed * 0.95 + seed * 0.41) % 1;
    const bandY = bodyCy - capsuleRy + bandU * capsuleRy * 2;
    const bandGrad = fgCtx.createLinearGradient(0, bandY - 12 * drawScale, 0, bandY + 12 * drawScale);
    bandGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
    bandGrad.addColorStop(0.5, `rgba(165, 243, 252, ${0.38 * ci})`);
    bandGrad.addColorStop(1, 'rgba(232, 121, 249, 0)');
    fgCtx.fillStyle = bandGrad;
    fgCtx.fillRect(bodyCx - capsuleRx, bandY - 12 * drawScale, capsuleRx * 2, 24 * drawScale);
    fgCtx.restore();

    // Crisp shimmering contour rim arcs (optical refraction edge)
    const rimJitter = Math.sin(elapsed * 18 + seed) * 1.6 * drawScale;
    fgCtx.strokeStyle = `rgba(103, 232, 249, ${0.42 * ci * shimmerWave})`;
    fgCtx.lineWidth = Math.max(1.0, 1.5 * drawScale);
    fgCtx.beginPath();
    fgCtx.ellipse(
      bodyCx + rimJitter,
      bodyCy,
      capsuleRx * 0.94,
      capsuleRy * 0.94,
      0,
      -Math.PI * 0.72,
      -Math.PI * 0.16,
    );
    fgCtx.stroke();
    fgCtx.strokeStyle = `rgba(232, 121, 249, ${0.34 * ci * shimmerWave})`;
    fgCtx.beginPath();
    fgCtx.ellipse(
      bodyCx - rimJitter,
      bodyCy,
      capsuleRx * 0.96,
      capsuleRy * 0.95,
      0,
      Math.PI * 0.2,
      Math.PI * 0.75,
    );
    fgCtx.stroke();

    fgCtx.restore();
  }

  // 2. Persistent Glowing Magenta Cyber-Headset LED Beacon + Luminous Feral Eye Glints
  //    Remains crisp & unmistakable at full brightness even when her body is ~25% cloaked!
  const effectiveGlow = Math.max(headsetGlowIntensity, cloakIntensity * 1.15);
  if (effectiveGlow > 0.08) {
    // headsetOriginRel is centered on her face/eyes right beneath the nurse cap cross
    const facePos = projectSpriteLandmarkToStage(frame.headsetOriginRel, projParams);
    const faceX = facePos.x;
    const faceY = facePos.y;
    const faceRot = facePos.knotRotRad;
    const cosF = Math.cos(faceRot);
    const sinF = Math.sin(faceRot);
    // Cyber-headset sits slightly behind the eyes on the ear/temple
    const hsOffX = -facingSign * 8.5 * drawScale;
    const hsOffY = -1.5 * drawScale;
    const headsetX = faceX + hsOffX * cosF - hsOffY * sinF;
    const headsetY = faceY + hsOffX * sinF + hsOffY * cosF;
    const pulse = 0.88 + 0.12 * Math.sin(elapsed * 8.6 + seed * 1.6);
    const flare =
      mode === 'opticalCloak' ||
      mode === 'cloakCast' ||
      mode === 'prepareCoil' ||
      mode === 'pierceStrike'
        ? 1.22
        : 1.0;
    const g = Math.min(1.25, effectiveGlow * pulse * flare);

    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';

    // Tight, crisp magenta cyber-headset LED halo (no muddy overblown blob)
    const haloR = (8.5 + g * 8.0) * drawScale;
    const haloGrad = fgCtx.createRadialGradient(headsetX, headsetY, 1.0, headsetX, headsetY, haloR);
    haloGrad.addColorStop(0, `rgba(253, 242, 248, ${Math.min(0.85, 0.45 * g)})`);
    haloGrad.addColorStop(0.4, `rgba(232, 121, 249, ${Math.min(0.68, 0.36 * g)})`);
    haloGrad.addColorStop(1, 'rgba(225, 29, 72, 0)');
    fgCtx.fillStyle = haloGrad;
    fgCtx.beginPath();
    fgCtx.arc(headsetX, headsetY, haloR, 0, Math.PI * 2);
    fgCtx.fill();

    // Hot fuchsia headset LED bead
    fgCtx.fillStyle = `rgba(255, 228, 242, ${Math.min(0.92, 0.62 * g)})`;
    fgCtx.beginPath();
    fgCtx.ellipse(
      headsetX,
      headsetY,
      (2.2 + g * 1.1) * drawScale,
      (1.5 + g * 0.8) * drawScale,
      faceRot + (facingSign < 0 ? -0.25 : 0.25),
      0,
      Math.PI * 2,
    );
    fgCtx.fill();

    // Paired glowing feral eye glints — razor-clear when cloaked or preparing 7-Pierce
    const eyeBoost = Math.max(
      cloakIntensity * 1.22,
      mode === 'prepareCoil' || mode === 'pierceStrike' ? 0.82 : 0.32,
    );
    if (eyeBoost > 0.2) {
      // facingSign < 0 means facing LEFT, so +facingSign moves forward toward her nose/eyes
      const e1OffX = facingSign * 2.0 * drawScale;
      const e1OffY = 2.0 * drawScale;
      const e2OffX = facingSign * 8.2 * drawScale;
      const e2OffY = 2.6 * drawScale;
      const eye1X = faceX + e1OffX * cosF - e1OffY * sinF;
      const eye1Y = faceY + e1OffX * sinF + e1OffY * cosF;
      const eye2X = faceX + e2OffX * cosF - e2OffY * sinF;
      const eye2Y = faceY + e2OffX * sinF + e2OffY * cosF;

      const drawEyeGlint = (ex: number, ey: number, radiusMul: number) => {
        const er = (3.8 + eyeBoost * 5.0) * drawScale * radiusMul;
        const eg = fgCtx.createRadialGradient(ex, ey, 0.4, ex, ey, er);
        eg.addColorStop(0, `rgba(255, 250, 254, ${Math.min(1, 0.96 * eyeBoost)})`);
        eg.addColorStop(0.38, `rgba(244, 63, 94, ${Math.min(0.94, 0.84 * eyeBoost)})`);
        eg.addColorStop(0.72, `rgba(232, 121, 249, ${Math.min(0.55, 0.42 * eyeBoost)})`);
        eg.addColorStop(1, 'rgba(232, 121, 249, 0)');
        fgCtx.fillStyle = eg;
        fgCtx.beginPath();
        fgCtx.arc(ex, ey, er, 0, Math.PI * 2);
        fgCtx.fill();

        // Crisp luminous feral iris core
        fgCtx.fillStyle = `rgba(255, 252, 255, ${Math.min(1, 0.98 * eyeBoost)})`;
        fgCtx.beginPath();
        fgCtx.ellipse(
          ex,
          ey,
          2.15 * radiusMul * drawScale,
          1.2 * radiusMul * drawScale,
          faceRot + (facingSign < 0 ? -0.16 : 0.16),
          0,
          Math.PI * 2,
        );
        fgCtx.fill();
      };

      drawEyeGlint(eye1X, eye1Y, 1.0);
      drawEyeGlint(eye2X, eye2Y, 0.86);

      // Sleek anamorphic eye flare streak while actively cloaked or coiled for 7-Pierce
      if (cloakIntensity > 0.25 || mode === 'prepareCoil') {
        const streakLen = (15 + eyeBoost * 16) * drawScale;
        const midX = (eye1X + eye2X) * 0.5;
        const midY = (eye1Y + eye2Y) * 0.5;
        const sx0 = midX - streakLen * cosF;
        const sy0 = midY - streakLen * sinF;
        const sx1 = midX + streakLen * cosF;
        const sy1 = midY + streakLen * sinF;
        const streakGrad = fgCtx.createLinearGradient(sx0, sy0, sx1, sy1);
        streakGrad.addColorStop(0, 'rgba(232, 121, 249, 0)');
        streakGrad.addColorStop(0.32, `rgba(244, 63, 94, ${0.46 * eyeBoost})`);
        streakGrad.addColorStop(0.5, `rgba(255, 245, 250, ${0.92 * eyeBoost})`);
        streakGrad.addColorStop(0.68, `rgba(34, 211, 238, ${0.52 * eyeBoost})`);
        streakGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
        fgCtx.strokeStyle = streakGrad;
        fgCtx.lineWidth = Math.max(1.2, 1.85 * drawScale);
        fgCtx.beginPath();
        fgCtx.moveTo(sx0, sy0);
        fgCtx.lineTo(sx1, sy1);
        fgCtx.stroke();
      }
    }

    // Subtle rising optical/bio sparks when cloaked or primed
    if (g > 0.62) {
      for (let s = 0; s < 2; s++) {
        const sp = (elapsed * (1.7 + s * 0.45) + seed * 0.37 + s * 0.51) % 1;
        const env = Math.sin(sp * Math.PI);
        const sx = headsetX + Math.sin(sp * 7.0 + s * 2.1) * 7 * drawScale;
        const sy = headsetY - sp * (18 + g * 10) * drawScale;
        fgCtx.fillStyle =
          cloakIntensity > 0.25
            ? s === 0
              ? '#67E8F9'
              : '#E879F9'
            : s === 0
              ? '#F472B6'
              : '#FB7185';
        fgCtx.globalAlpha = Math.min(0.85, env * g * 0.68);
        fgCtx.beginPath();
        fgCtx.arc(sx, sy, (1.05 + (1 - sp) * 1.05) * drawScale, 0, Math.PI * 2);
        fgCtx.fill();
      }
      fgCtx.globalAlpha = 1;
    }

    fgCtx.restore();
  }

  // 3. 7-Pierce Surgical Lunge Ground Slam Shock-Ring & Deck Dust Plumes
  if (pierceImpactIntensity > 0.06) {
    const sw = Math.min(1.2, pierceImpactIntensity);
    const prog = Math.max(0, Math.min(1, 1 - sw * 0.65));
    const clawPos = projectSpriteLandmarkToStage(frame.clawOriginRel, projParams);
    const ix = spriteX + (clawPos.x - spriteX) * 0.55;
    const iy = enemyGroundY + 2;
    const outerRx = size * (0.20 + prog * 0.36);
    const outerRy = (5.8 + prog * 9.5) * Math.max(0.75, drawScale);
    const innerRx = outerRx * 0.58;
    const innerRy = outerRy * 0.58;

    fgCtx.save();

    for (let d = 0; d < 4; d++) {
      const side = d < 2 ? -1 : 1;
      const tier = d % 2;
      const dx = ix + side * (outerRx * (0.52 + tier * 0.24));
      const dy = iy - (2.2 + tier * 3.0 + prog * 6) * drawScale;
      const dr = (4.8 + tier * 2.4 + prog * 5.8) * drawScale;
      fgCtx.fillStyle = `rgba(148, 163, 184, ${0.28 * Math.min(1, sw) * (1 - prog * 0.5)})`;
      fgCtx.beginPath();
      fgCtx.arc(dx, dy, dr, 0, Math.PI * 2);
      fgCtx.fill();
    }

    fgCtx.globalCompositeOperation = 'lighter';

    const coreR = size * (0.16 * (1 - prog * 0.4));
    const coreGrad = fgCtx.createRadialGradient(ix, iy - 2, 1, ix, iy - 2, coreR);
    coreGrad.addColorStop(0, `rgba(255, 241, 242, ${0.86 * Math.min(1, sw)})`);
    coreGrad.addColorStop(0.45, `rgba(244, 63, 94, ${0.60 * Math.min(1, sw)})`);
    coreGrad.addColorStop(1, 'rgba(192, 38, 211, 0)');
    fgCtx.fillStyle = coreGrad;
    fgCtx.beginPath();
    fgCtx.ellipse(ix, iy - 2, coreR, coreR * 0.45, 0, 0, Math.PI * 2);
    fgCtx.fill();

    fgCtx.strokeStyle = `rgba(244, 63, 94, ${0.8 * Math.min(1, sw)})`;
    fgCtx.lineWidth = Math.max(1.4, (3.0 - prog * 1.2) * drawScale);
    fgCtx.beginPath();
    fgCtx.ellipse(ix, iy, outerRx, outerRy, 0, 0, Math.PI * 2);
    fgCtx.stroke();

    fgCtx.strokeStyle = `rgba(232, 121, 249, ${0.88 * Math.min(1, sw)})`;
    fgCtx.lineWidth = Math.max(1.0, (1.8 - prog * 0.7) * drawScale);
    fgCtx.beginPath();
    fgCtx.ellipse(ix, iy, innerRx, innerRy, 0, 0, Math.PI * 2);
    fgCtx.stroke();

    fgCtx.restore();
  }

  // 4. Triple Bone-Talon Crescent Slash Arcs (7-Pierce Crimson-Magenta & Incandescent Bone-White)
  if (clawSlashProgress > 0.02) {
    const cp = Math.max(0, Math.min(1, clawSlashProgress));
    const slashAlpha = Math.sin(cp * Math.PI);
    if (slashAlpha > 0.04) {
      const clawPos = projectSpriteLandmarkToStage(frame.clawOriginRel, projParams);
      const cx = clawPos.x;
      const cy = Math.min(enemyGroundY + hopY - size * 0.30, clawPos.y);
      const arcR = size * (0.28 + cp * 0.14);
      const sweepSpan = 0.76 + cp * 0.44;
      const startAng = facingSign < 0 ? Math.PI * 0.62 : -Math.PI * 0.38;
      const endAng = startAng + sweepSpan;

      fgCtx.save();
      fgCtx.globalCompositeOperation = 'lighter';
      fgCtx.lineCap = 'round';

      for (let c = -1; c <= 1; c++) {
        const ox = cx + c * 6.5 * drawScale * facingSign;
        const oy = cy + c * 11.5 * drawScale;
        const r = arcR * (1 - Math.abs(c) * 0.08);

        // Outer neon fuchsia-magenta bio aura
        fgCtx.strokeStyle = `rgba(217, 70, 239, ${0.6 * slashAlpha})`;
        fgCtx.lineWidth = 6.4 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        // Mid surgical crimson rend blade
        fgCtx.strokeStyle = `rgba(244, 63, 94, ${0.9 * slashAlpha})`;
        fgCtx.lineWidth = 3.2 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        // Incandescent bone-white razor core (pierce glint on center claw)
        fgCtx.strokeStyle =
          c === 0
            ? `rgba(236, 254, 255, ${0.98 * slashAlpha})`
            : `rgba(255, 245, 248, ${0.96 * slashAlpha})`;
        fgCtx.lineWidth = (c === 0 ? 1.75 : 1.45) * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng + 0.08, endAng - 0.08);
        fgCtx.stroke();
      }

      fgCtx.restore();
    }
  }
}

export function renderFeralNurseEnemySprite(
  c: CoreEnemySpriteContext,
  feralNurseSample: FeralNurseAnimSample,
): void {
  const frames = c.sim.feralNurseFrames;
  if (!frames) return;
  const feralNurseJuice: FeralNurseJuiceSample | undefined =
    c.sim.feralNurseJuiceSamples?.get(c.enemy.id);
  const fCanvas = frames[feralNurseSample.frameIndex] ?? frames[0];
  if (!fCanvas) return;

  const ff = feralNurseSample.frame;
  const pf = feralNurseSample.prevFrame;
  const drawScale = c.size / FERAL_NURSE_CANONICAL_HEIGHT;
  const juiceHopY = feralNurseJuice
    ? feralNurseJuice.hopYPx * drawScale
    : feralNurseSample.yHopPx * drawScale;
  const juiceRot = feralNurseJuice ? feralNurseJuice.rotationRad : feralNurseSample.tiltRad;
  const juiceFacing = feralNurseJuice ? feralNurseJuice.facingScale : -1;
  const hopY = c.ea?.dead ? 0 : juiceHopY;
  const cloakAlpha = c.isDead
    ? 1
    : feralNurseJuice
      ? feralNurseJuice.alpha
      : feralNurseSample.alpha;
  const finalAlpha = c.koAlpha * cloakAlpha;

  const staggerDy = c.ea?.dead ? 0 : c.stagger.dy * 0.45;
  const rotationRad = !c.ea?.dead ? c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad : 0;
  const blendA = feralNurseSample.blendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && feralNurseSample.prevFrameIndex !== feralNurseSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[feralNurseSample.prevFrameIndex] : null;

  const { deform, uniforms } = deriveEnemyDeformAndUniforms({
    archetype: c.enemy.archetype,
    idx: c.idx,
    ea: c.ea,
    isDead: c.isDead,
    staggerShearPx: c.stagger.shearPx,
    staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
    breathScaleX: feralNurseJuice
      ? c.stagger.scaleXMul
      : c.breathScaleX * feralNurseSample.scaleX,
    breathScaleY: feralNurseJuice
      ? c.stagger.scaleYMul
      : c.breathScaleY * feralNurseSample.scaleY,
    frameBlendAlpha: canCrossBlend ? blendA : 1,
    bioEmissiveRgb: c.bioEmissiveRgb,
    isPrimedOrCharging: c.isPrimedOrCharging || feralNurseSample.headsetGlowIntensity > 0.78,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: Boolean(c.enemy.staggered),
    elapsed: c.elapsed,
    tacticalViewActive: c.tacticalViewActive,
    feralNurseJuice,
    cutIn: c.enemyCutIn,
    facingSign: juiceFacing,
  });

  if (!c.ea?.dead && !c.tacticalViewActive) {
    renderFeralNurseBioVfxOverlay({
      fgCtx: c.fgCtx,
      frame: ff,
      frameIndex: feralNurseSample.frameIndex,
      mode: feralNurseSample.mode,
      spriteX: c.spriteX,
      enemyGroundY: c.enemyGroundY,
      hopY,
      staggerDy,
      size: c.size,
      drawScale,
      facingSign: juiceFacing,
      rotationRad,
      headsetGlowIntensity: feralNurseJuice
        ? feralNurseJuice.headsetGlowIntensity
        : feralNurseSample.headsetGlowIntensity,
      cloakIntensity: feralNurseJuice
        ? feralNurseJuice.cloakIntensity
        : feralNurseSample.cloakIntensity,
      clawSlashProgress: feralNurseJuice
        ? feralNurseJuice.clawSlashProgress
        : feralNurseSample.clawSlashProgress,
      pierceImpactIntensity: feralNurseJuice
        ? feralNurseJuice.pierceImpactIntensity
        : feralNurseSample.pierceImpactIntensity,
      deform: c.webglRenderer ? deform : createIdentityControlPoints(),
      squashStretch: uniforms.squashStretch,
      shearPx: c.webglRenderer ? uniforms.shearPx : [0, 0],
      swayAmpPx: c.webglRenderer ? uniforms.swayAmpPx : 0,
      swayPhase: c.webglRenderer ? uniforms.swayPhase : 0,
      elapsed: c.elapsed,
      seed: c.idx,
    });
  }

  if (c.webglRenderer) {
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: fCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + staggerDy,
      widthPx: ff.w * drawScale,
      heightPx: ff.h * drawScale,
      anchorOffsetXPx: ff.anchorX * drawScale,
      anchorOffsetYPx: ff.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad,
      alpha: finalAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
    return;
  }

  const { baseCtx } = c;
  baseCtx.save();
  baseCtx.globalAlpha = finalAlpha * c.canvasBystanderMul;
  baseCtx.translate(c.spriteX, c.enemyGroundY + hopY + staggerDy);
  if (!c.ea?.dead) {
    baseCtx.rotate(rotationRad);
  }
  const scaleX = uniforms.squashStretch[0];
  const scaleY = uniforms.squashStretch[1];
  baseCtx.scale(juiceFacing * scaleX, scaleY);

  if (prevCanvas) {
    baseCtx.globalAlpha = finalAlpha * c.canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
    baseCtx.drawImage(
      prevCanvas,
      -pf.anchorX * drawScale,
      -pf.bottomY * drawScale,
      pf.w * drawScale,
      pf.h * drawScale,
    );
    baseCtx.globalAlpha = finalAlpha * c.canvasBystanderMul * Math.min(1, 0.85 + blendA * 0.15);
  }

  baseCtx.drawImage(
    fCanvas,
    -ff.anchorX * drawScale,
    -ff.bottomY * drawScale,
    ff.w * drawScale,
    ff.h * drawScale,
  );
  baseCtx.globalAlpha = finalAlpha * c.canvasBystanderMul;

  if (!c.ea?.dead && Math.abs(c.stagger.shearPx) > 0.5) {
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.rect(
      -ff.w * drawScale * 0.55,
      -ff.bottomY * drawScale,
      ff.w * drawScale * 1.1,
      ff.h * drawScale * 0.48,
    );
    baseCtx.clip();
    baseCtx.translate(-c.stagger.shearPx, -2);
    baseCtx.drawImage(
      fCanvas,
      -ff.anchorX * drawScale,
      -ff.bottomY * drawScale,
      ff.w * drawScale,
      ff.h * drawScale,
    );
    baseCtx.restore();
  }

  if (
    (c.ea && c.ea.flashTimer > 0) ||
    (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
    feralNurseJuice?.flashRgba ||
    c.enemyCutIn.flashRgba
  ) {
    baseCtx.globalCompositeOperation = 'lighter';
    const flashRgb = c.enemyCutIn.flashRgba ?? feralNurseJuice?.flashRgba;
    if (flashRgb) {
      drawCanvas2DCutInFlash(baseCtx, flashRgb, c.size * 0.36, -c.size * 0.44);
    } else if (c.ea && c.ea.flashTimer > 0) {
      baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      baseCtx.beginPath();
      baseCtx.arc(0, -c.size * 0.44, c.size * 0.34, 0, Math.PI * 2);
      baseCtx.fill();
    }
    if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
      baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
      baseCtx.beginPath();
      baseCtx.ellipse(2, -c.size * 0.44, c.size * 0.28, c.size * 0.34, 0.2, 0, Math.PI * 2);
      baseCtx.fill();
    }
  }
  baseCtx.restore();
}
