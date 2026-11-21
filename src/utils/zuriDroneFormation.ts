import type { TileType } from '../engine/types';
import type { HeroAnimState } from './heroAnimator';
import type { SpriteRect } from './spriteCutout';

export type ZuriDroneId = 'shield' | 'med' | 'strike';

export interface ZuriDroneFrameDef extends SpriteRect {
  id: ZuriDroneId;
  anchorX: number;
  anchorY: number;
  baseHeightPx: number;
  muzzleRel?: { dx: number; dy: number };
}

export const ZURI_DRONE_FRAMES: readonly ZuriDroneFrameDef[] = [
  // 0: Shield / Aegis Quad-Walker Drone (left on drone sheet)
  {
    id: 'shield',
    x: 4,
    y: 12,
    w: 760,
    h: 680,
    anchorX: 330,
    anchorY: 668,
    baseHeightPx: 88,
    excludeRects: [{ x: 726, y: 0, w: 38, h: 175 }],
    muzzleRel: { dx: 360, dy: -290 },
  },
  // 1: Bio-Med / Support Quad-Rotor Drone (center on drone sheet)
  {
    id: 'med',
    x: 736,
    y: 12,
    w: 734,
    h: 630,
    anchorX: 372,
    anchorY: 315,
    baseHeightPx: 80,
    excludeRects: [
      { x: 0, y: 170, w: 36, h: 460 },
      { x: 644, y: 150, w: 90, h: 480 },
    ],
  },
  // 2: Strike / Solar Hawk Gunship Jet Drone (right on drone sheet)
  {
    id: 'strike',
    x: 1378,
    y: 24,
    w: 790,
    h: 596,
    anchorX: 395,
    anchorY: 310,
    baseHeightPx: 78,
    excludeRects: [{ x: 0, y: 0, w: 92, h: 145 }],
    muzzleRel: { dx: 375, dy: 96 },
  },
];

export interface ZuriDronePose {
  id: ZuriDroneId;
  frameDef: ZuriDroneFrameDef;
  /** World X position in canvas coordinates */
  x: number;
  /** World Y position (anchor point) in canvas coordinates */
  y: number;
  /** Rotation in radians */
  tiltRad: number;
  /** Scale multiplier relative to stage hero scale */
  scaleMult: number;
  /** Active glow intensity 0..1 when executing a command */
  activeGlow: number;
  /** Muzzle world position for projectiles/beams */
  muzzleX: number;
  muzzleY: number;
}

/**
 * Computes real-time positions and attack/defense/tech choreography for Zuri's 3 Afrofuturist drones.
 */
export function sampleZuriDroneFormation(params: {
  animState: HeroAnimState;
  heroX: number;
  heroDrawBottomY: number;
  groundY: number;
  targetX: number;
  targetMidY: number;
  scale: number;
  totalTime: number;
  hoveredColor: TileType | null;
}): Record<ZuriDroneId, ZuriDronePose> {
  const {
    animState,
    heroX,
    heroDrawBottomY,
    groundY,
    targetX,
    targetMidY,
    scale,
    totalTime,
    hoveredColor,
  } = params;

  const mode = animState.mode;
  const dur = Math.max(0.001, animState.duration);
  const u = Math.max(0, Math.min(1, animState.elapsed / dur));
  const pulse = Math.sin(u * Math.PI);
  const heroAltitudeDelta = heroDrawBottomY - groundY;

  // 1. SHIELD DRONE (Aegis Quad-Walker — stationed clearly forward on the bridge deck in vanguard position)
  const shieldSpec = ZURI_DRONE_FRAMES[0];
  let shieldX = heroX + 114 * scale + Math.sin(totalTime * 1.9) * 3 * scale;
  let shieldY = groundY + 4 * scale + Math.abs(Math.sin(totalTime * 1.9)) * -2 * scale;
  let shieldTilt = 0;
  let shieldScaleMult = 1;
  let shieldGlow = hoveredColor === 'defense' ? 0.65 : 0.15;

  if (mode === 'guard') {
    shieldX = heroX + (114 + pulse * 48) * scale;
    shieldY = groundY - pulse * 8 * scale;
    shieldScaleMult = 1 + pulse * 0.12;
    shieldGlow = 0.95;
  } else if (mode === 'overdrive') {
    const surge = Math.sin(u * Math.PI);
    shieldX = heroX + (114 + surge * 72) * scale;
    shieldY = groundY - surge * 12 * scale;
    shieldScaleMult = 1 + surge * 0.11;
    shieldGlow = 0.9;
  } else if (mode === 'hit') {
    shieldX = heroX + (114 - pulse * 14) * scale;
  }

  // 2. MED DRONE (Ankh Bio-Med Quad-Rotor — hovering high above-rear of Zuri with clear silhouette)
  const medSpec = ZURI_DRONE_FRAMES[1];
  const medBobY = Math.sin(totalTime * 2.9 + 1.2) * 8 * scale;
  const medBobX = Math.cos(totalTime * 1.9 + 0.6) * 4.5 * scale;
  let medX = heroX - 88 * scale + medBobX;
  let medY = groundY - 178 * scale + heroAltitudeDelta * 0.38 + medBobY;
  let medTilt = Math.sin(totalTime * 2.3) * 0.035;
  let medScaleMult = 1;
  let medGlow = hoveredColor === 'tech' ? 0.7 : 0.2;

  if (mode === 'upgrade') {
    medX = heroX + (-88 + pulse * 88) * scale;
    medY = groundY - (182 + Math.sin(u * Math.PI * 2) * 24) * scale + heroAltitudeDelta * 0.35;
    medTilt = Math.sin(u * Math.PI * 2) * 0.075;
    medScaleMult = 1 + pulse * 0.14;
    medGlow = 1;
  } else if (mode === 'overdrive') {
    medX = heroX + (-88 + pulse * 102) * scale;
    medY = groundY - (184 - pulse * 20) * scale + heroAltitudeDelta * 0.35;
    medScaleMult = 1 + pulse * 0.12;
    medGlow = 0.92;
  }

  // 3. STRIKE DRONE (Solar Hawk Gunship Jet — hovering in upper-front attack lane, surges/dives to attack enemies!)
  const strikeSpec = ZURI_DRONE_FRAMES[2];
  const strikeBobY = Math.sin(totalTime * 3.2 + 2.4) * 7.5 * scale;
  const strikeBobX = Math.sin(totalTime * 2.1) * 5 * scale;
  const strikeBaseX = heroX + 144 * scale;
  const strikeBaseY = groundY - 176 * scale + heroAltitudeDelta * 0.34;
  let strikeX = strikeBaseX + strikeBobX;
  let strikeY = strikeBaseY + strikeBobY;
  let strikeTilt = Math.sin(totalTime * 2.4) * 0.03;
  let strikeScaleMult = 1;
  let strikeGlow = hoveredColor === 'attack' ? 0.75 : 0.25;

  const strikeAttackTargetX = Math.max(strikeBaseX + 90 * scale, targetX - 88 * scale);
  const strikeAttackTargetY = targetMidY - 18 * scale;

  if (mode === 'shoot') {
    const surge = Math.sin(u * Math.PI);
    strikeX = strikeBaseX + (strikeAttackTargetX - strikeBaseX) * (surge * 0.58);
    strikeY = strikeBaseY + (strikeAttackTargetY - strikeBaseY) * (surge * 0.65);
    strikeTilt = surge * 0.09;
    strikeScaleMult = 1 + surge * 0.12;
    strikeGlow = 0.95;
  } else if (mode === 'dash_kick') {
    const diveCurve = Math.sin(u * Math.PI);
    const dashProgress = Math.min(1, diveCurve * 1.12);
    strikeX = strikeBaseX + (strikeAttackTargetX - strikeBaseX) * dashProgress;
    strikeY =
      strikeBaseY +
      (strikeAttackTargetY - strikeBaseY) * dashProgress -
      Math.sin(u * Math.PI * 2) * 24 * scale;
    strikeTilt = u < 0.5 ? 0.14 : -0.08;
    strikeScaleMult = 1 + diveCurve * 0.18;
    strikeGlow = 1;
  } else if (mode === 'overdrive') {
    const wave =
      u < 0.52 ? Math.sin((u / 0.52) * Math.PI) : Math.sin(((u - 0.52) / 0.48) * Math.PI) * 0.65;
    strikeX = strikeBaseX + (strikeAttackTargetX - strikeBaseX) * Math.min(1, wave * 1.08);
    strikeY = strikeBaseY + (strikeAttackTargetY - strikeBaseY) * Math.min(1, wave * 0.92);
    strikeTilt = wave * 0.12;
    strikeScaleMult = 1 + wave * 0.16;
    strikeGlow = 1;
  } else if (mode === 'guard') {
    strikeX = strikeBaseX + pulse * 42 * scale + strikeBobX;
    strikeY = strikeBaseY - pulse * 16 * scale + strikeBobY;
    strikeTilt = -pulse * 0.04;
  } else if (hoveredColor === 'attack') {
    strikeX += 18 * scale;
    strikeY -= 6 * scale;
    strikeTilt = 0.05;
  }

  const strikeDrawScale = (strikeSpec.baseHeightPx / strikeSpec.h) * scale * strikeScaleMult;
  const strikeMuzzleX = strikeX + (strikeSpec.muzzleRel?.dx ?? 340) * strikeDrawScale;
  const strikeMuzzleY = strikeY + (strikeSpec.muzzleRel?.dy ?? 80) * strikeDrawScale;

  const shieldDrawScale = (shieldSpec.baseHeightPx / shieldSpec.h) * scale * shieldScaleMult;
  const shieldMuzzleX = shieldX + (shieldSpec.muzzleRel?.dx ?? 320) * shieldDrawScale;
  const shieldMuzzleY = shieldY + (shieldSpec.muzzleRel?.dy ?? -260) * shieldDrawScale;

  return {
    shield: {
      id: 'shield',
      frameDef: shieldSpec,
      x: shieldX,
      y: shieldY,
      tiltRad: shieldTilt,
      scaleMult: shieldScaleMult,
      activeGlow: shieldGlow,
      muzzleX: shieldMuzzleX,
      muzzleY: shieldMuzzleY,
    },
    med: {
      id: 'med',
      frameDef: medSpec,
      x: medX,
      y: medY,
      tiltRad: medTilt,
      scaleMult: medScaleMult,
      activeGlow: medGlow,
      muzzleX: medX,
      muzzleY: medY + 24 * scale,
    },
    strike: {
      id: 'strike',
      frameDef: strikeSpec,
      x: strikeX,
      y: strikeY,
      tiltRad: strikeTilt,
      scaleMult: strikeScaleMult,
      activeGlow: strikeGlow,
      muzzleX: strikeMuzzleX,
      muzzleY: strikeMuzzleY,
    },
  };
}
