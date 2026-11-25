import type { MutdogJuiceSample } from '../../utils/mutdogJuiceController';
import {
  MUTDOG_CANONICAL_HEIGHT,
  type MutdogAnimMode,
  type MutdogFrameSample,
  type MutdogSpriteFrame,
} from '../../utils/mutdogSpriteSheet';
import type { CoreEnemySpriteContext } from './combatEnemyCoreSpritePass';
import { drawCanvas2DCutInFlash } from './combatHeroSpritePass';
import { hexToRgba } from './mutantBlood';
import { deriveEnemyDeformAndUniforms } from './stageSpriteAdapter';

export interface MutdogBioVfxParams {
  fgCtx: CanvasRenderingContext2D;
  frame: MutdogSpriteFrame;
  frameIndex: number;
  mode: MutdogAnimMode;
  spriteX: number;
  enemyGroundY: number;
  hopY: number;
  size: number;
  drawScale: number;
  facingSign: number;
  lureGlowIntensity: number;
  droolIntensity: number;
  pounceImpactIntensity: number;
  clawSlashProgress: number;
  pounceImpactProgress: number;
  howlPulseProgress: number;
  waistDeformDx: number;
  waistDeformDy: number;
  headDeformDx: number;
  headDeformDy: number;
  elapsed: number;
  seed: number;
}

/**
 * Renders the Rabid MutDog's 3 signature biological VFX layers tracked to spline deformation:
 * 1. Twin glowing bioluminescent amber-orange antenna lure bulbs + rising bio-sparks
 * 2. Rabid foaming jaw mist + swaying viscous chartreuse-ivory drool strands & droplets
 * 3. Feral triple-claw rend arcs + pounce slam shock-dust + frenzy howl acoustic rings
 */
export function renderMutdogBioVfxOverlay(p: MutdogBioVfxParams): void {
  const {
    fgCtx,
    frame,
    mode,
    spriteX,
    enemyGroundY,
    hopY,
    size,
    drawScale,
    facingSign,
    lureGlowIntensity,
    droolIntensity,
    pounceImpactIntensity,
    clawSlashProgress,
    pounceImpactProgress,
    howlPulseProgress,
    headDeformDx,
    headDeformDy,
    elapsed,
    seed,
  } = p;

  const fwdDir = -facingSign;

  // 1. Twin Bioluminescent Amber-Orange Antenna Lure Bulbs + Rising Bio-Sparks
  if (lureGlowIntensity > 0.08) {
    const baseLureX = spriteX + frame.lureOriginRel.dx * drawScale * fwdDir + headDeformDx;
    const baseLureY = enemyGroundY + hopY + frame.lureOriginRel.dy * drawScale + headDeformDy;
    const pulse = 0.88 + 0.12 * Math.sin(elapsed * 8.2 + seed * 1.4);
    const flare =
      mode === 'howl' || mode === 'pounceMaul' || mode === 'maulPrimed' || mode === 'staggerHover'
        ? 1.24
        : 1.0;
    const g = Math.min(1.25, lureGlowIntensity * pulse * flare);

    // Front (lower-forward) & rear (upper-back) twin antenna bulbs matching uploaded art
    const bulbs = [
      {
        dx: -14 * drawScale * fwdDir + Math.sin(elapsed * 5.2 + seed) * 1.6 * drawScale,
        dy: 4 * drawScale + Math.cos(elapsed * 4.7 + seed) * 1.4 * drawScale,
        rMul: 1.0,
      },
      {
        dx: 13 * drawScale * fwdDir + Math.cos(elapsed * 5.6 + seed * 1.3) * 1.5 * drawScale,
        dy: -5 * drawScale + Math.sin(elapsed * 4.4 + seed * 1.3) * 1.4 * drawScale,
        rMul: 0.92,
      },
    ] as const;

    fgCtx.save();
    fgCtx.globalCompositeOperation = 'lighter';

    for (let b = 0; b < bulbs.length; b++) {
      const bx = baseLureX + bulbs[b].dx;
      const by = baseLureY + bulbs[b].dy;
      const haloR = (18 + g * 18) * drawScale * bulbs[b].rMul;
      const haloGrad = fgCtx.createRadialGradient(bx, by, 1.5, bx, by, haloR);
      haloGrad.addColorStop(0, `rgba(254, 240, 138, ${Math.min(0.92, 0.56 * g)})`);
      haloGrad.addColorStop(0.36, `rgba(251, 146, 60, ${Math.min(0.76, 0.44 * g)})`);
      haloGrad.addColorStop(0.72, `rgba(234, 88, 12, ${Math.min(0.38, 0.22 * g)})`);
      haloGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      fgCtx.fillStyle = haloGrad;
      fgCtx.beginPath();
      fgCtx.arc(bx, by, haloR, 0, Math.PI * 2);
      fgCtx.fill();

      // Hot filament core inside each glowing bulb
      fgCtx.fillStyle = `rgba(254, 249, 195, ${Math.min(0.95, 0.65 * g)})`;
      fgCtx.beginPath();
      fgCtx.ellipse(
        bx,
        by,
        (3.4 + g * 2.1) * drawScale * bulbs[b].rMul,
        (2.4 + g * 1.5) * drawScale * bulbs[b].rMul,
        fwdDir < 0 ? -0.35 : 0.35,
        0,
        Math.PI * 2,
      );
      fgCtx.fill();

      // Rising bioluminescent spore sparks when excited/primed
      if (g > 0.52) {
        for (let s = 0; s < 2; s++) {
          const sp = (elapsed * (1.8 + b * 0.4 + s * 0.35) + seed * 0.31 + b * 0.5 + s * 0.43) % 1;
          const env = Math.sin(sp * Math.PI);
          const sx = bx + Math.sin(sp * 7.5 + b * 2 + s) * 7 * drawScale;
          const sy = by - sp * (22 + g * 12) * drawScale;
          fgCtx.fillStyle = s === 0 ? '#FEF08A' : '#FB923C';
          fgCtx.globalAlpha = Math.min(0.9, env * g * 0.78);
          fgCtx.beginPath();
          fgCtx.arc(sx, sy, (1.15 + (1 - sp) * 1.2) * drawScale, 0, Math.PI * 2);
          fgCtx.fill();
        }
        fgCtx.globalAlpha = 1;
      }
    }

    fgCtx.restore();
  }

  // 2. Rabid Foaming Maw Mist & Swaying Viscous Drool Strands
  if (droolIntensity > 0.14) {
    const mawX = spriteX + frame.mawOriginRel.dx * drawScale * fwdDir + headDeformDx;
    const mawY = enemyGroundY + hopY + frame.mawOriginRel.dy * drawScale + headDeformDy;
    const d = Math.min(1.15, droolIntensity);

    fgCtx.save();

    // Foaming rabid breath puffs around fangs when snarling, howling, primed, or panting
    if (d > 0.42) {
      const foamAlpha = Math.min(0.55, (d - 0.35) * 0.62);
      for (let f = 0; f < 3; f++) {
        const fp = (elapsed * (1.55 + f * 0.28) + seed * 0.41 + f * 0.33) % 1;
        const fEnv = Math.sin(fp * Math.PI);
        const fx = mawX + fwdDir * (-4 - fp * 14) * drawScale + Math.sin(fp * 6 + f) * 3 * drawScale;
        const fy = mawY + (3 + f * 3 - fp * 7) * drawScale;
        const fr = (4.2 + fp * 6.5) * drawScale;
        const fGrad = fgCtx.createRadialGradient(fx, fy, 1, fx, fy, fr);
        fGrad.addColorStop(0, `rgba(254, 252, 232, ${foamAlpha * fEnv})`);
        fGrad.addColorStop(0.55, `rgba(190, 242, 100, ${foamAlpha * fEnv * 0.55})`);
        fGrad.addColorStop(1, 'rgba(163, 230, 53, 0)');
        fgCtx.fillStyle = fGrad;
        fgCtx.beginPath();
        fgCtx.arc(fx, fy, fr, 0, Math.PI * 2);
        fgCtx.fill();
      }
    }

    // 3 swaying translucent saliva strands hanging from upper/lower fangs with glistening beads
    fgCtx.lineCap = 'round';
    const strandCount = d > 0.6 ? 3 : 2;
    for (let s = 0; s < strandCount; s++) {
      const anchorDx = (-7 + s * 6.5) * drawScale * fwdDir;
      const anchorDy = (3 + (s % 2) * 3) * drawScale;
      const sx0 = mawX + anchorDx;
      const sy0 = mawY + anchorDy;
      const cycle = (elapsed * (1.2 + s * 0.25) + seed * 0.7 + s * 0.37) % 1;
      const stretch = 0.55 + 0.65 * Math.sin(cycle * Math.PI);
      const len = (11 + s * 4.5 + d * 10) * stretch * drawScale;
      const sway = Math.sin(elapsed * (4.6 + s * 0.9) + seed + s * 1.8) * (3.2 + d * 2.2) * drawScale;
      const sx1 = sx0 + sway;
      const sy1 = sy0 + len;

      // Translucent chartreuse-ivory saliva thread
      fgCtx.strokeStyle = `rgba(217, 249, 157, ${Math.min(0.76, 0.34 + d * 0.42)})`;
      fgCtx.lineWidth = Math.max(1.0, (1.65 - s * 0.2) * drawScale);
      fgCtx.beginPath();
      fgCtx.moveTo(sx0, sy0);
      fgCtx.quadraticCurveTo(sx0 + sway * 0.45, sy0 + len * 0.55, sx1, sy1);
      fgCtx.stroke();

      // Glistening droplet bead at strand tip
      const beadR = (1.75 + d * 0.95) * drawScale;
      fgCtx.fillStyle = `rgba(254, 252, 232, ${Math.min(0.92, 0.48 + d * 0.44)})`;
      fgCtx.beginPath();
      fgCtx.ellipse(sx1, sy1 + beadR * 0.3, beadR * 0.85, beadR * 1.15, 0, 0, Math.PI * 2);
      fgCtx.fill();

      // Falling detached drool bead
      if (cycle > 0.68 && d > 0.45) {
        const dropU = (cycle - 0.68) / 0.32;
        const dropY = sy1 + dropU * dropU * 34 * drawScale;
        if (dropY < enemyGroundY + 2) {
          fgCtx.fillStyle = `rgba(190, 242, 100, ${(1 - dropU * 0.65) * 0.82})`;
          fgCtx.beginPath();
          fgCtx.ellipse(
            sx1 + sway * 0.2,
            dropY,
            1.45 * drawScale,
            2.3 * drawScale,
            0,
            0,
            Math.PI * 2,
          );
          fgCtx.fill();
        }
      }
    }

    fgCtx.restore();
  }

  // 3A. Frenzy Howl Acoustic Shock Rings around Muzzle
  if (howlPulseProgress > 0.02) {
    const hp = Math.max(0, Math.min(1, howlPulseProgress));
    const hAlpha = Math.sin(hp * Math.PI);
    if (hAlpha > 0.04) {
      const mx = spriteX + frame.mawOriginRel.dx * drawScale * fwdDir + headDeformDx;
      const my = enemyGroundY + hopY + frame.mawOriginRel.dy * drawScale + headDeformDy;
      fgCtx.save();
      fgCtx.globalCompositeOperation = 'lighter';
      for (let r = 0; r < 2; r++) {
        const rp = (hp + r * 0.32) % 1;
        const ringAlpha = Math.sin(rp * Math.PI) * hAlpha * (r === 0 ? 0.78 : 0.56);
        const rad = size * (0.14 + rp * 0.34);
        fgCtx.strokeStyle =
          r === 0
            ? `rgba(251, 146, 60, ${ringAlpha})`
            : `rgba(163, 230, 53, ${ringAlpha})`;
        fgCtx.lineWidth = Math.max(1.2, (3.0 - rp * 1.5) * drawScale);
        fgCtx.beginPath();
        fgCtx.arc(mx, my, rad, 0, Math.PI * 2);
        fgCtx.stroke();
      }
      fgCtx.restore();
    }
  }

  // 3B. Pounce-Maul Ground Slam Shock-Ring & Billowing Deck Dust Plumes
  if (pounceImpactIntensity > 0.06 || pounceImpactProgress > 0.01) {
    const sw = Math.min(
      1.25,
      Math.max(pounceImpactIntensity, Math.sin(pounceImpactProgress * Math.PI)),
    );
    if (sw > 0.05) {
      const prog =
        pounceImpactProgress > 0.01
          ? Math.max(0, Math.min(1, pounceImpactProgress))
          : Math.max(0, Math.min(1, 1 - sw * 0.55));
      const ix = spriteX + frame.clawOriginRel.dx * drawScale * fwdDir;
      const iy = enemyGroundY + 2;
      const outerRx = size * (0.22 + prog * 0.42);
      const outerRy = (6.5 + prog * 11) * Math.max(0.75, drawScale);
      const innerRx = outerRx * 0.6;
      const innerRy = outerRy * 0.6;

      fgCtx.save();

      // Deck dust plumes kicked up by slamming paws
      for (let d = 0; d < 6; d++) {
        const side = d < 3 ? -1 : 1;
        const tier = d % 3;
        const dx = ix + side * (outerRx * (0.48 + tier * 0.22));
        const dy = iy - (2.5 + tier * 3.5 + prog * 8) * drawScale;
        const dr = (5.5 + tier * 2.8 + prog * 7.5) * drawScale;
        fgCtx.fillStyle = `rgba(148, 163, 184, ${0.32 * Math.min(1, sw) * (1 - prog * 0.5)})`;
        fgCtx.beginPath();
        fgCtx.arc(dx, dy, dr, 0, Math.PI * 2);
        fgCtx.fill();
      }

      fgCtx.globalCompositeOperation = 'lighter';

      // Bio-lime & amber slam flash core
      const coreR = size * (0.18 * (1 - prog * 0.45));
      const coreGrad = fgCtx.createRadialGradient(ix, iy - 2, 1, ix, iy - 2, coreR);
      coreGrad.addColorStop(0, `rgba(254, 249, 195, ${0.88 * Math.min(1, sw)})`);
      coreGrad.addColorStop(0.45, `rgba(163, 230, 53, ${0.62 * Math.min(1, sw)})`);
      coreGrad.addColorStop(1, 'rgba(132, 204, 22, 0)');
      fgCtx.fillStyle = coreGrad;
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy - 2, coreR, coreR * 0.48, 0, 0, Math.PI * 2);
      fgCtx.fill();

      // Outer amber-lime shock ellipse
      fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.78 * Math.min(1, sw)})`;
      fgCtx.lineWidth = Math.max(1.5, (3.4 - prog * 1.4) * drawScale);
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy, outerRx, outerRy, 0, 0, Math.PI * 2);
      fgCtx.stroke();

      // Inner chartreuse shock ring
      fgCtx.strokeStyle = `rgba(190, 242, 100, ${0.88 * Math.min(1, sw)})`;
      fgCtx.lineWidth = Math.max(1.1, (2.0 - prog * 0.8) * drawScale);
      fgCtx.beginPath();
      fgCtx.ellipse(ix, iy, innerRx, innerRy, 0, 0, Math.PI * 2);
      fgCtx.stroke();

      fgCtx.restore();
    }
  }

  // 3C. Feral Triple-Claw Rend Crescent Slash Arcs
  if (clawSlashProgress > 0.02) {
    const cp = Math.max(0, Math.min(1, clawSlashProgress));
    const slashAlpha = Math.sin(cp * Math.PI);
    if (slashAlpha > 0.04) {
      const cx = spriteX + frame.clawOriginRel.dx * drawScale * fwdDir + headDeformDx * 0.65;
      const cy =
        enemyGroundY +
        hopY +
        Math.min(-size * 0.28, frame.clawOriginRel.dy * drawScale) +
        headDeformDy * 0.55;
      const arcR = size * (0.24 + cp * 0.10);
      const sweepSpan = 0.62 + cp * 0.34;
      const startAng = fwdDir < 0 ? Math.PI * 0.64 : -Math.PI * 0.36;
      const endAng = startAng + sweepSpan;

      fgCtx.save();
      fgCtx.globalCompositeOperation = 'lighter';
      fgCtx.lineCap = 'round';

      for (let c = -1; c <= 1; c++) {
        const ox = cx + c * 6.0 * drawScale * fwdDir;
        const oy = cy + c * 10.5 * drawScale;
        const r = arcR * (1 - Math.abs(c) * 0.09);

        // Outer feral bio-lime aura
        fgCtx.strokeStyle = `rgba(132, 204, 22, ${0.62 * slashAlpha})`;
        fgCtx.lineWidth = 6.4 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        // Mid molten amber-orange rend blade
        fgCtx.strokeStyle = `rgba(251, 146, 60, ${0.86 * slashAlpha})`;
        fgCtx.lineWidth = 3.2 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng, endAng);
        fgCtx.stroke();

        // Incandescent cream-yellow razor core
        fgCtx.strokeStyle = `rgba(254, 249, 195, ${0.96 * slashAlpha})`;
        fgCtx.lineWidth = 1.45 * drawScale;
        fgCtx.beginPath();
        fgCtx.arc(ox, oy, r, startAng + 0.08, endAng - 0.08);
        fgCtx.stroke();
      }

      fgCtx.restore();
    }
  }
}

export function renderMutdogEnemySprite(
  c: CoreEnemySpriteContext,
  mutdogSample: MutdogFrameSample,
): void {
  const frames = c.sim.mutdogFrames;
  if (!frames) return;
  const mutdogJuice: MutdogJuiceSample | undefined = c.sim.mutdogJuiceSamples?.get(c.enemy.id);
  const mCanvas = frames[mutdogSample.frameIndex] ?? frames[0];
  if (!mCanvas) return;

  const mf = mutdogSample.frame;
  const pf = mutdogSample.prevFrame;
  const drawScale = c.size / MUTDOG_CANONICAL_HEIGHT;
  const juiceHopY = mutdogJuice
    ? mutdogJuice.hopYPx * drawScale
    : mutdogSample.yHopPx * drawScale;
  const juiceRot = mutdogJuice ? mutdogJuice.rotationRad : mutdogSample.tiltRad;
  const juiceFacing = mutdogJuice ? mutdogJuice.facingScale : -1;
  const hopY = c.ea?.dead ? 0 : juiceHopY;

  if (!c.ea?.dead && !c.tacticalViewActive) {
    renderMutdogBioVfxOverlay({
      fgCtx: c.fgCtx,
      frame: mf,
      frameIndex: mutdogSample.frameIndex,
      mode: mutdogJuice ? mutdogJuice.mode : mutdogSample.mode,
      spriteX: c.spriteX,
      enemyGroundY: c.enemyGroundY,
      hopY,
      size: c.size,
      drawScale,
      facingSign: juiceFacing,
      lureGlowIntensity: mutdogJuice
        ? mutdogJuice.lureGlowIntensity
        : mutdogSample.lureGlowIntensity,
      droolIntensity: mutdogJuice ? mutdogJuice.droolIntensity : mutdogSample.droolIntensity,
      pounceImpactIntensity: mutdogSample.pounceImpactIntensity,
      clawSlashProgress: mutdogJuice
        ? mutdogJuice.clawSlashProgress
        : mutdogSample.clawSlashProgress,
      pounceImpactProgress: mutdogJuice ? mutdogJuice.pounceImpactProgress : 0,
      howlPulseProgress: mutdogJuice ? mutdogJuice.howlPulseProgress : 0,
      waistDeformDx: mutdogJuice ? mutdogJuice.deform.waist.dx * drawScale * juiceFacing : 0,
      waistDeformDy: mutdogJuice ? mutdogJuice.deform.waist.dy * drawScale : 0,
      headDeformDx: mutdogJuice ? mutdogJuice.deform.head.dx * drawScale * juiceFacing : 0,
      headDeformDy: mutdogJuice ? mutdogJuice.deform.head.dy * drawScale : 0,
      elapsed: c.elapsed,
      seed: c.idx,
    });
  }

  const blendA = mutdogSample.frameBlendAlpha;
  const canCrossBlend =
    !c.ea?.dead && blendA < 0.99 && mutdogSample.prevFrameIndex !== mutdogSample.frameIndex;
  const prevCanvas = canCrossBlend ? frames[mutdogSample.prevFrameIndex] : null;

  if (c.webglRenderer) {
    const { deform, uniforms } = deriveEnemyDeformAndUniforms({
      archetype: c.enemy.archetype,
      idx: c.idx,
      ea: c.ea,
      isDead: c.isDead,
      staggerShearPx: c.stagger.shearPx,
      staggerBioFlashAlpha: c.stagger.bioFlashAlpha,
      breathScaleX: mutdogJuice
        ? c.stagger.scaleXMul
        : c.breathScaleX * mutdogSample.breathScaleX,
      breathScaleY: mutdogJuice
        ? c.stagger.scaleYMul
        : c.breathScaleY * mutdogSample.breathScaleY,
      frameBlendAlpha: canCrossBlend ? blendA : 1,
      bioEmissiveRgb: c.bioEmissiveRgb,
      isPrimedOrCharging: c.isPrimedOrCharging || mutdogSample.lureGlowIntensity > 0.72,
      isAcidOrPustuleActive: false,
      isStaggeredStatus: Boolean(c.enemy.staggered),
      elapsed: c.elapsed,
      tacticalViewActive: c.tacticalViewActive,
      mutdogJuice,
      cutIn: c.enemyCutIn,
      facingSign: juiceFacing,
    });
    c.webglRenderer.drawSprite({
      id: `enemy:${c.enemy.id}`,
      primarySource: mCanvas,
      secondarySource: prevCanvas,
      worldX: c.spriteX,
      worldY: c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45),
      widthPx: mf.w * drawScale,
      heightPx: mf.h * drawScale,
      anchorOffsetXPx: mf.anchorX * drawScale,
      anchorOffsetYPx: mf.bottomY * drawScale,
      secondaryWidthPx: pf.w * drawScale,
      secondaryHeightPx: pf.h * drawScale,
      secondaryAnchorOffsetXPx: pf.anchorX * drawScale,
      secondaryAnchorOffsetYPx: pf.bottomY * drawScale,
      facingSign: juiceFacing,
      rotationRad: !c.ea?.dead ? c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad : 0,
      alpha: c.koAlpha,
      drawPriority: c.enemyCutIn.drawPriority,
      deform,
      uniforms,
    });
    return;
  }

  const { baseCtx } = c;
  baseCtx.save();
  baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;
  baseCtx.translate(c.spriteX, c.enemyGroundY + hopY + (c.ea?.dead ? 0 : c.stagger.dy * 0.45));
  if (!c.ea?.dead) {
    baseCtx.rotate(c.stagger.rot * 0.28 + juiceRot + c.enemyCutIn.leanRad);
  }
  const scaleX =
    (mutdogJuice
      ? c.stagger.scaleXMul * mutdogJuice.springScaleX
      : c.breathScaleX * mutdogSample.breathScaleX) * c.enemyCutIn.scaleX;
  const scaleY =
    (mutdogJuice
      ? c.stagger.scaleYMul * mutdogJuice.springScaleY
      : c.breathScaleY * mutdogSample.breathScaleY) * c.enemyCutIn.scaleY;
  baseCtx.scale(juiceFacing * scaleX, scaleY);

  if (prevCanvas) {
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, (1 - blendA) * 0.55);
    baseCtx.drawImage(
      prevCanvas,
      -pf.anchorX * drawScale,
      -pf.bottomY * drawScale,
      pf.w * drawScale,
      pf.h * drawScale,
    );
    baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul * Math.min(1, 0.85 + blendA * 0.15);
  }

  baseCtx.drawImage(
    mCanvas,
    -mf.anchorX * drawScale,
    -mf.bottomY * drawScale,
    mf.w * drawScale,
    mf.h * drawScale,
  );
  baseCtx.globalAlpha = c.koAlpha * c.canvasBystanderMul;

  if (!c.ea?.dead && Math.abs(c.stagger.shearPx) > 0.5) {
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.rect(
      -mf.w * drawScale * 0.55,
      -mf.bottomY * drawScale,
      mf.w * drawScale * 1.1,
      mf.h * drawScale * 0.48,
    );
    baseCtx.clip();
    baseCtx.translate(-c.stagger.shearPx, -2);
    baseCtx.drawImage(
      mCanvas,
      -mf.anchorX * drawScale,
      -mf.bottomY * drawScale,
      mf.w * drawScale,
      mf.h * drawScale,
    );
    baseCtx.restore();
  }

  if (
    (c.ea && c.ea.flashTimer > 0) ||
    (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) ||
    mutdogJuice?.flashRgba ||
    c.enemyCutIn.flashRgba
  ) {
    baseCtx.globalCompositeOperation = 'lighter';
    const flashRgb = c.enemyCutIn.flashRgba ?? mutdogJuice?.flashRgba;
    if (flashRgb) {
      drawCanvas2DCutInFlash(baseCtx, flashRgb, c.size * 0.36, -c.size * 0.42);
    } else if (c.ea && c.ea.flashTimer > 0) {
      baseCtx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      baseCtx.beginPath();
      baseCtx.arc(0, -c.size * 0.42, c.size * 0.34, 0, Math.PI * 2);
      baseCtx.fill();
    }
    if (!c.ea?.dead && c.stagger.bioFlashAlpha > 0.04) {
      baseCtx.fillStyle = hexToRgba(c.enemyBio.freshEmissive, c.stagger.bioFlashAlpha);
      baseCtx.beginPath();
      baseCtx.ellipse(2, -c.size * 0.42, c.size * 0.28, c.size * 0.34, 0.2, 0, Math.PI * 2);
      baseCtx.fill();
    }
  }
  baseCtx.restore();
}
