/**
 * @file spitterJuiceBranches.ts
 * Branch frame selection & 4-knot spine pose helpers for the Bile Spitter (`spitter`).
 */

import type { SpitterAnimMode } from './spitterSpriteSheet';
import {
  applySpitterSquash,
  type SpitterCombatSyncInput,
  type SpitterJuiceState,
  type SpitterMeshDeform,
} from './spitterJuiceState';

export interface SpitterEvalCtx {
  mode: SpitterAnimMode;
  frameIndex: number;
  alpha: number;
  targetPosX: number;
  hopYPx: number;
  rotationRad: number;
  pustuleGlowIntensity: number;
  spitWindupProgress: number;
  spitStreamProgress: number;
  swayAmpPx: number;
  swayFreq: number;
  swayPhase: number;
  uvDistortAmp: [number, number];
  uvDistortFreq: number;
  uvDistortPhase: number;
  tintRgba: [number, number, number, number];
  deform: SpitterMeshDeform;
}

export function applySpitterAttackBranch(
  ctx: SpitterEvalCtx,
  state: SpitterJuiceState,
  safeDt: number,
  hasCombatAttack: boolean,
  combatSync: SpitterCombatSyncInput | undefined,
  prevTriggerElapsed: number,
): void {
  const isClaw = hasCombatAttack && combatSync?.spitterAttackKind === 'claw';
  const u = hasCombatAttack
    ? Math.max(0, Math.min(0.999, 1 - combatSync!.attackAnimTimer! / combatSync!.attackAnimDuration!))
    : Math.max(0, Math.min(0.999, state.triggerElapsed / Math.max(0.01, state.triggerDuration)));
  const prevU = hasCombatAttack
    ? u - safeDt / Math.max(0.01, combatSync!.attackAnimDuration!)
    : prevTriggerElapsed / Math.max(0.01, state.triggerDuration);

  if (prevU < 0.22 && u >= 0.22) {
    applySpitterSquash(state, 1.22, 0.82, 1.8, -1.4);
    state.hitFlashTimer = Math.max(state.hitFlashTimer, 0.1);
  }

  if (isClaw) {
    ctx.mode = 'claw';
    if (u < 0.26) {
      const a = Math.sin((u / 0.26) * (Math.PI * 0.5));
      ctx.frameIndex = 8;
      ctx.targetPosX = a * 20;
      ctx.hopYPx -= a * 4;
      ctx.deform.waist.dx = -a * 6.0;
      ctx.deform.head.dx = -a * 10.0;
      ctx.rotationRad = a * 0.05;
      ctx.pustuleGlowIntensity = 0.65 + a * 0.2;
    } else if (u < 0.72) {
      const s = (u - 0.26) / 0.46;
      ctx.frameIndex = 9;
      ctx.targetPosX = -Math.sin(s * (Math.PI * 0.5)) * 74;
      ctx.hopYPx -= Math.sin(s * Math.PI) * 9;
      ctx.deform.pelvis.dx = 4.0;
      ctx.deform.waist.dx = 9.5;
      ctx.deform.head.dx = 15.0;
      ctx.rotationRad = -0.065;
      ctx.pustuleGlowIntensity = 0.88;
    } else {
      const r = (u - 0.72) / 0.28;
      const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
      ctx.frameIndex = 11;
      ctx.targetPosX = -74 * ease;
      ctx.deform.waist.dx = 5.0 * ease;
      ctx.deform.head.dx = 8.0 * ease;
      ctx.pustuleGlowIntensity = 0.52;
    }
    return;
  }

  ctx.mode = 'spit';
  if (u < 0.22) {
    const a = Math.sin((u / 0.22) * (Math.PI * 0.5));
    ctx.frameIndex = 4;
    ctx.targetPosX = a * 20;
    ctx.spitWindupProgress = a;
    ctx.deform.pelvis.dx = -a * 3.0;
    ctx.deform.waist.dx = -a * 7.5;
    ctx.deform.waist.dy = a * 2.2;
    ctx.deform.waist.scaleX = 1 + a * 0.11;
    ctx.deform.head.dx = -a * 12.0;
    ctx.deform.head.dy = -a * 3.0;
    ctx.deform.head.rotRad = -a * 0.09;
    ctx.rotationRad = a * 0.045;
    ctx.pustuleGlowIntensity = 0.58 + a * 0.36;
  } else if (u < 0.52) {
    const s = (u - 0.22) / 0.3;
    const thrust = Math.sin(s * (Math.PI * 0.5));
    ctx.frameIndex = 5;
    ctx.targetPosX = 20 * (1 - thrust) - thrust * 46;
    ctx.hopYPx -= Math.sin(s * Math.PI) * 5;
    ctx.spitStreamProgress = (u - 0.22) / 0.62;
    ctx.deform.pelvis.dx = 3.5 * thrust;
    ctx.deform.waist.dx = 8.5 * thrust;
    ctx.deform.waist.scaleX = 1.07 - 0.06 * s;
    ctx.deform.head.dx = 14.5 * thrust;
    ctx.deform.head.dy = 2.0 * thrust;
    ctx.deform.head.rotRad = 0.08 * thrust;
    ctx.rotationRad = -0.05 * thrust;
    ctx.pustuleGlowIntensity = 0.96;
  } else if (u < 0.84) {
    const f = (u - 0.52) / 0.32;
    ctx.frameIndex = 6;
    ctx.targetPosX = -46 * (1 - f * 0.35);
    ctx.spitStreamProgress = Math.min(1, (u - 0.22) / 0.62);
    ctx.deform.pelvis.dx = 2.8 * (1 - f * 0.3);
    ctx.deform.waist.dx = 7.0 * (1 - f * 0.3);
    ctx.deform.waist.scaleX = 0.95 + 0.05 * f;
    ctx.deform.head.dx = 12.0 * (1 - f * 0.3);
    ctx.deform.head.rotRad = 0.06 * (1 - f * 0.4);
    ctx.rotationRad = -0.035 * (1 - f * 0.5);
    ctx.pustuleGlowIntensity = 0.92 - f * 0.22;
  } else {
    const r = (u - 0.84) / 0.16;
    const ease = 0.5 + 0.5 * Math.cos(r * Math.PI);
    ctx.frameIndex = 7;
    ctx.targetPosX = -30 * ease;
    ctx.deform.waist.dx = 4.5 * ease;
    ctx.deform.head.dx = 7.5 * ease;
    ctx.pustuleGlowIntensity = 0.48;
  }
}
