import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
  computeNonCutInBeatMs,
  computePackTempoScale,
} from './combatPresentationConfig';
import {
  ActionCameraController,
  BACKDROP_BLEED_X,
  BACKDROP_BLEED_Y,
  computeMinZoomForRotation,
} from './ActionCameraController';
import { SpriteJuiceFeedbackHandler } from './SpriteJuiceFeedbackHandler';
import { CombatActionSequencer } from './CombatActionSequencer';
import { sampleCrawlerFrame } from '../../utils/crawlerSpriteSheet';
import { createStalkerJuiceState, stepStalkerJuice } from '../../utils/stalkerJuiceController';
import {
  classifyEnemyAttackStaging,
  classifyHeroAttackStaging,
  computeNoseToNoseMeleeSlides,
} from './combatStagingClassifier';
import { deriveEnemyDeformAndUniforms } from './stageSpriteAdapter';

function screenToWorldCorner(
  sx: number,
  sy: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  rotRad: number,
): { wx: number; wy: number } {
  // Inverse of: translate(w/2 + panX, h/2 + panY) -> rotate(rot) -> scale(zoom) -> translate(-w/2, -h/2)
  const dx = sx - (w * 0.5 + panX);
  const dy = sy - (h * 0.5 + panY);
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const rx = (dx * cos + dy * sin) / zoom;
  const ry = (-dx * sin + dy * cos) / zoom;
  return { wx: rx + w * 0.5, wy: ry + h * 0.5 };
}

test('adaptive pack tempo scales cleanly with living enemy count', () => {
  assert.equal(computePackTempoScale(1, true), 1.0);
  assert.equal(computePackTempoScale(2, true), 1.0);
  assert.equal(computePackTempoScale(3, true), 0.8);
  assert.equal(computePackTempoScale(4, true), 0.8);
  assert.equal(computePackTempoScale(5, true), 0.64);
  assert.equal(computePackTempoScale(6, true), 0.64);
  assert.equal(computePackTempoScale(6, false), 1.0);

  const singleArmorMs = computeNonCutInBeatMs(['enemy_armor'], 1, true);
  const packArmorMs = computeNonCutInBeatMs(['enemy_armor'], 5, true);
  assert.ok(packArmorMs < singleArmorMs);
  assert.equal(singleArmorMs, 420);
  assert.equal(packArmorMs, Math.round(420 * 0.64));
});

test('ActionCameraController computes Melee, Ranged Shooter Lead, and AoE Centroid frames', () => {
  const cam = new ActionCameraController();
  const hero = { id: 'hero', x: 210, groundY: 300, widthPx: 110, heightPx: 180 };
  const e1 = { id: 'e1', x: 580, groundY: 300, widthPx: 100, heightPx: 160 };
  const e2 = { id: 'e2', x: 700, groundY: 294, widthPx: 100, heightPx: 160 };
  const e3 = { id: 'e3', x: 820, groundY: 300, widthPx: 100, heightPx: 160 };

  const meleeFocus = cam.computeFocusFrame([hero, e1], 960, 380, 1.4, 1.04);
  assert.ok(meleeFocus.zoom >= 1.04 && meleeFocus.zoom <= 1.4);
  assert.ok(Number.isFinite(meleeFocus.panX) && Number.isFinite(meleeFocus.panY));

  // Shooter lead room: mid-stage shooter firing right (+1) shifts camera toward firing direction
  const midShooter = { id: 'mid', x: 380, groundY: 300, widthPx: 110, heightPx: 180 };
  const shooterNoLead = cam.computeShooterLeadFrame(midShooter, +1, 960, 380, 1.4, 0);
  const shooterWithLead = cam.computeShooterLeadFrame(midShooter, +1, 960, 380, 1.4, 0.06);
  assert.equal(shooterWithLead.zoom, 1.4);
  assert.ok(shooterWithLead.panX < shooterNoLead.panX, 'lead room shifts camera toward firing direction');

  // AoE centroid clamps to wider [1.22, 1.30] range and never below 1.0
  const aoeFrame = cam.computeAoeCentroidFrame([e1, e2, e3], 960, 380, 1.22, 1.3);
  assert.ok(aoeFrame.zoom >= 1.22 && aoeFrame.zoom <= 1.3);
  assert.ok(aoeFrame.zoom >= 1.0);
});

test('ActionCameraController rotation-aware overscan bounds keep all 4 corners inside backdrop bleed', () => {
  const cam = new ActionCameraController();
  const w = 960;
  const h = 380;
  const tiltRad = (3.4 * Math.PI) / 180;

  const minZ = computeMinZoomForRotation(w, h, tiltRad, BACKDROP_BLEED_X, BACKDROP_BLEED_Y);
  assert.ok(minZ > 1.0, 'rotated viewport requires overscan zoom > 1.0');

  // Extreme pan + Dutch tilt + directional trauma shake must still keep all 4 corners inside bleed rect
  cam.addTrauma(0.95, 1, -0.35, w, 0.022);
  const snap = cam.step(0.016, {
    viewportW: w,
    viewportH: h,
    targetZoom: 1.08,
    targetPanX: 480,
    targetPanY: -220,
    targetRotRad: tiltRad,
    lerpRate: 30,
    shakeDecayPerSec: 2.2,
    maxShakePx: w * 0.022,
    tacticalViewActive: false,
    reducedMotion: false,
    directPose: true,
  });

  const totalRot = snap.rotationRad + snap.shakeRotRad;
  const totalPanX = snap.panX + snap.shakeOffsetX;
  const totalPanY = snap.panY + snap.shakeOffsetY;
  const corners = [
    screenToWorldCorner(0, 0, w, h, snap.zoom, totalPanX, totalPanY, totalRot),
    screenToWorldCorner(w, 0, w, h, snap.zoom, totalPanX, totalPanY, totalRot),
    screenToWorldCorner(0, h, w, h, snap.zoom, totalPanX, totalPanY, totalRot),
    screenToWorldCorner(w, h, w, h, snap.zoom, totalPanX, totalPanY, totalRot),
  ];

  const eps = 1.5;
  for (const c of corners) {
    assert.ok(
      c.wx >= -BACKDROP_BLEED_X * 0.5 - eps && c.wx <= w + BACKDROP_BLEED_X * 0.5 + eps,
      `corner wx=${c.wx.toFixed(2)} out of horizontal bleed bounds`,
    );
    assert.ok(
      c.wy >= -BACKDROP_BLEED_Y * 0.5 - eps && c.wy <= h + BACKDROP_BLEED_Y * 0.5 + eps,
      `corner wy=${c.wy.toFixed(2)} out of vertical bleed bounds`,
    );
  }
});

test('ActionCameraController viewport-relative shake scales with width and respects reducedMotion & tacticalView', () => {
  const camSmall = new ActionCameraController();
  const camWide = new ActionCameraController();

  camSmall.addTrauma(0.85, 1, 0, 640, 0.022);
  camWide.addTrauma(0.85, 1, 0, 1920, 0.022);

  const sSmall = camSmall.step(0.016, {
    viewportW: 640,
    viewportH: 360,
    targetZoom: 1.45,
    targetPanX: 0,
    targetPanY: 0,
    targetRotRad: 0.04,
    lerpRate: 20,
    shakeDecayPerSec: 2.2,
    maxShakePx: 640 * 0.022,
    tacticalViewActive: false,
    reducedMotion: false,
    directPose: true,
  });
  const sWide = camWide.step(0.016, {
    viewportW: 1920,
    viewportH: 1080,
    targetZoom: 1.45,
    targetPanX: 0,
    targetPanY: 0,
    targetRotRad: 0.04,
    lerpRate: 20,
    shakeDecayPerSec: 2.2,
    maxShakePx: 1920 * 0.022,
    tacticalViewActive: false,
    reducedMotion: false,
    directPose: true,
  });

  const magSmall = Math.hypot(sSmall.shakeOffsetX, sSmall.shakeOffsetY);
  const magWide = Math.hypot(sWide.shakeOffsetX, sWide.shakeOffsetY);
  assert.ok(magWide > magSmall * 2.1, `wide viewport shake (${magWide}) should scale proportionally vs small (${magSmall})`);

  // Reduced motion suppresses tilt & trauma shake
  camWide.addTrauma(0.9, 1, 0, 1920, 0.022);
  const rmSnap = camWide.step(0.016, {
    viewportW: 1920,
    viewportH: 1080,
    targetZoom: 1.35,
    targetPanX: 24,
    targetPanY: 0,
    targetRotRad: 0.06,
    lerpRate: 24,
    shakeDecayPerSec: 2.2,
    tacticalViewActive: false,
    reducedMotion: true,
  });
  assert.equal(rmSnap.shakeOffsetX, 0);
  assert.equal(rmSnap.shakeOffsetY, 0);
  assert.equal(rmSnap.trauma, 0);

  // Tactical view hard-resets framing
  const tacSnap = camWide.step(0.016, {
    viewportW: 1920,
    viewportH: 1080,
    targetZoom: 1.4,
    targetPanX: 40,
    targetPanY: -10,
    targetRotRad: 0.06,
    lerpRate: 24,
    shakeDecayPerSec: 2.2,
    tacticalViewActive: true,
    reducedMotion: false,
  });
  assert.equal(tacSnap.zoom, 1);
  assert.equal(tacSnap.panX, 0);
  assert.equal(tacSnap.panY, 0);
  assert.equal(tacSnap.rotationRad, 0);
  assert.equal(tacSnap.trauma, 0);
});

test('SpriteJuiceFeedbackHandler distinguishes Melee clash slides vs Ranged in-slot lunges, 3-frame white->crimson flash, and clean reset', () => {
  const juice = new SpriteJuiceFeedbackHandler();

  // Melee staging slides attacker & target toward midpoint (~34% of half-gap = ~75px)
  juice.beginWindup({
    attackerId: 'hero',
    targetIds: ['e1'],
    allActorIds: ['hero', 'e1', 'e2'],
    strikeDirX: +1,
    isMelee: true,
    clashSlideDistPx: 75,
    rangedLungePx: 18,
  });
  juice.stepFrame(0.016, false, 'windup', 1.0);
  const meleeAtk = juice.getSnapshot('hero', 0.75);
  const meleeTgt = juice.getSnapshot('e1', 0.75);
  const meleeBys = juice.getSnapshot('e2', 0.75);
  assert.equal(meleeAtk.poseOverride, 'attack_pose');
  assert.equal(meleeTgt.poseOverride, 'brace_pose');
  assert.equal(meleeBys.poseOverride, 'none');
  assert.ok(meleeAtk.clashSlideX > 50, 'melee attacker slides noticeably toward center stage');
  assert.ok(meleeTgt.clashSlideX < -50, 'melee target slides noticeably toward center stage');
  assert.ok(meleeBys.tintRgba[0] < 0.65);

  // Ranged staging keeps actors in formation slots (small 5%-10% forward lunge only)
  juice.beginWindup({
    attackerId: 'hero',
    targetIds: ['e1'],
    allActorIds: ['hero', 'e1'],
    strikeDirX: +1,
    isMelee: false,
    clashSlideDistPx: 0,
    rangedLungePx: 18,
  });
  juice.stepFrame(0.016, false, 'windup', 1.0);
  const rangedAtk = juice.getSnapshot('hero', 0.75);
  const rangedTgt = juice.getSnapshot('e1', 0.75);
  assert.ok(
    rangedAtk.clashSlideX > 0 && rangedAtk.clashSlideX < 35,
    'ranged attacker only lunges slightly in slot',
  );
  assert.equal(rangedTgt.clashSlideX, 0, 'ranged target stays in formation slot during windup');

  // Impact triggers 3-frame white flash (ticks even during Hit-Stop), then crimson, plus Hold drift apart
  juice.triggerImpact({
    attackerId: 'hero',
    targetIds: ['e1'],
    strikeDirX: +1,
    knockbackPx: 48,
    holdDriftPx: 14,
    attackerScalePunch: 1.25,
    whiteFlashFrames: 3,
    isCrit: false,
    isMelee: true,
  });

  for (let frame = 0; frame < 3; frame++) {
    const snap = juice.getSnapshot('e1', 0.75);
    assert.equal(snap.poseOverride, 'recoil_pose');
    assert.ok(snap.flashRgba);
    assert.deepEqual(snap.flashRgba.slice(0, 3), [1, 1, 1]);
    juice.stepFrame(0.016, true, 'impact_freeze', frame / 3);
  }
  const crimsonSnap = juice.getSnapshot('e1', 0.75);
  assert.ok(crimsonSnap.flashRgba);
  assert.ok(crimsonSnap.flashRgba[0] > 0.9 && crimsonSnap.flashRgba[1] < 0.25);

  // Hold phase drifts actors subtly apart; Reset EaseInOutCubic + finish() zeroes everything cleanly
  juice.stepFrame(0.05, false, 'followthrough', 0.2);
  const earlyHoldX = juice.getSnapshot('e1', 0.75).clashSlideX;
  juice.stepFrame(0.05, false, 'followthrough', 0.95);
  const lateHoldX = juice.getSnapshot('e1', 0.75).clashSlideX;
  assert.ok(lateHoldX > earlyHoldX, 'hold phase subtly drifts target away from impact');

  juice.finish();
  const cleanAtk = juice.getSnapshot('hero', 0);
  const cleanTgt = juice.getSnapshot('e1', 0);
  assert.equal(cleanAtk.poseOverride, 'none');
  assert.equal(cleanAtk.clashSlideX, 0);
  assert.equal(cleanTgt.poseOverride, 'none');
  assert.equal(cleanTgt.clashSlideX, 0);
  assert.equal(cleanTgt.knockbackX, 0);
  assert.equal(cleanTgt.flashRgba, null);
});

test('CombatActionSequencer executes Melee Crit with Hit-Stop, worldUiAlpha suppression, Hold zoom creep, and EaseInOutCubic reset', async () => {
  const seq = new CombatActionSequencer();
  let windups = 0;
  let impacts = 0;
  let resolved = false;

  const done = seq
    .playCutIn(
      {
        id: 'seq_melee_crit',
        actionKind: 'crit',
        stagingMode: 'melee',
        attackerId: 'hero',
        targetIds: ['e1'],
        allActorIds: ['hero', 'e1', 'e2'],
        attackerBounds: { id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 },
        targetBounds: [{ id: 'e1', x: 640, groundY: 300, widthPx: 100, heightPx: 160 }],
        tempoScale: 1.0,
        waitForExternalImpact: true,
        onWindupStart: () => {
          windups++;
        },
        onImpactFrame: () => {
          impacts++;
        },
      },
      DEFAULT_COMBAT_PRESENTATION_CONFIG,
      960,
      380,
    )
    .then(() => {
      resolved = true;
    });

  assert.equal(windups, 1);
  assert.equal(impacts, 0);
  assert.equal(seq.getPhase(), 'windup');

  const windupFrame = seq.step(0.08, 960, 380, {
    tacticalViewActive: false,
    reducedMotion: false,
  });
  assert.equal(windupFrame.phase, 'windup');
  assert.equal(windupFrame.stagingMode, 'melee');
  assert.equal(windupFrame.isHitStopped, false);
  assert.ok(windupFrame.dimmerAlpha > 0);
  assert.ok(windupFrame.worldUiAlpha < 1, 'world-space UI fades out during windup');
  assert.ok(windupFrame.cameraZoom > 1);

  seq.triggerImpactNow();
  assert.equal(impacts, 1);
  assert.equal(seq.getPhase(), 'impact_freeze');

  const freezeFrame = seq.step(0.05, 960, 380, {
    tacticalViewActive: false,
    reducedMotion: false,
  });
  assert.equal(freezeFrame.isHitStopped, true);
  assert.equal(freezeFrame.simDt, 0);
  assert.equal(freezeFrame.worldUiAlpha, 0, 'world-space UI is fully hidden on impact');
  assert.ok(freezeFrame.invertFlashAlpha > 0);
  assert.ok(freezeFrame.speedLinesAlpha > 0);

  // Step through freeze into Hold and verify continuous inward zoom creep (+5%..+10%)
  let firstHoldZoom: number | null = null;
  let lastHoldZoom: number | null = null;
  for (let i = 0; i < 120 && seq.isActive(); i++) {
    const f = seq.step(0.025, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    if (f.phase === 'followthrough') {
      if (firstHoldZoom === null) firstHoldZoom = f.cameraZoom;
      lastHoldZoom = f.cameraZoom;
    }
  }
  await done;
  assert.ok(firstHoldZoom !== null && lastHoldZoom !== null);
  assert.ok(
    lastHoldZoom > firstHoldZoom + 0.03,
    `Hold phase must creep zoom inward (${firstHoldZoom.toFixed(3)} -> ${lastHoldZoom.toFixed(3)})`,
  );
  assert.equal(resolved, true);
  assert.equal(seq.getPhase(), 'idle');
  const idleFrame = seq.step(0.016, 960, 380, {
    tacticalViewActive: false,
    reducedMotion: false,
  });
  assert.equal(idleFrame.worldUiAlpha, 1, 'world-space UI restores to 1 on completion');
});

test('CombatActionSequencer runs Two-Beat Ranged Fast whip-pan and Ranged Lobbed live X-tracking', async () => {
  // 1. Ranged Fast: Beat 1 shooter lead -> onProjectileSpawn -> Beat 2 travel whip-pan -> impact
  const seqFast = new CombatActionSequencer();
  let spawned = 0;
  let impacted = 0;
  const phasesSeen = new Set<string>();

  const doneFast = seqFast.playCutIn(
    {
      id: 'seq_ranged_fast',
      actionKind: 'normal',
      stagingMode: 'ranged_fast',
      attackerId: 'hero',
      targetIds: ['e1'],
      allActorIds: ['hero', 'e1'],
      attackerBounds: { id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 },
      targetBounds: [{ id: 'e1', x: 740, groundY: 300, widthPx: 100, heightPx: 160 }],
      onProjectileSpawn: () => {
        spawned++;
      },
      onImpactFrame: () => {
        impacted++;
      },
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );

  let windupPanX = 0;
  let impactPanX = 0;
  for (let i = 0; i < 120 && seqFast.isActive(); i++) {
    const f = seqFast.step(0.02, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    phasesSeen.add(f.phase);
    if (f.phase === 'windup') windupPanX = f.cameraPanX;
    if (f.phase === 'impact_freeze') impactPanX = f.cameraPanX;
  }
  await doneFast;
  assert.equal(spawned, 1, 'onProjectileSpawn fires once on Beat 1 -> Beat 2 transition');
  assert.equal(impacted, 1);
  assert.ok(phasesSeen.has('windup') && phasesSeen.has('travel') && phasesSeen.has('impact_freeze'));
  assert.ok(
    windupPanX > impactPanX + 40,
    `camera whip-pans from left shooter (panX=${windupPanX.toFixed(1)}) to right target (panX=${impactPanX.toFixed(1)})`,
  );

  // 2. Ranged Lobbed: tracks live projectile X-coordinate during travel phase
  const seqLob = new CombatActionSequencer();
  let projX = 240;
  const doneLob = seqLob.playCutIn(
    {
      id: 'seq_ranged_lobbed',
      actionKind: 'normal',
      stagingMode: 'ranged_lobbed',
      attackerId: 'hero',
      targetIds: ['e1'],
      allActorIds: ['hero', 'e1'],
      attackerBounds: { id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 },
      targetBounds: [{ id: 'e1', x: 760, groundY: 300, widthPx: 100, heightPx: 160 }],
      getProjectileX: () => projX,
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );

  const travelPans: number[] = [];
  for (let i = 0; i < 120 && seqLob.isActive(); i++) {
    if (seqLob.getPhase() === 'travel') {
      projX = Math.min(760, projX + 48);
    }
    const f = seqLob.step(0.02, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    if (f.phase === 'travel') {
      travelPans.push(f.cameraPanX);
    }
  }
  await doneLob;
  assert.ok(travelPans.length >= 3, 'lobbed travel spans multiple tracking ticks');
  assert.ok(
    travelPans[travelPans.length - 1] < travelPans[0],
    'lobbed camera tracks projectile X smoothly rightward',
  );
});

test('CombatActionSequencer cascades Ranged AoE hits left-to-right by 30ms-50ms and clamps zoom', async () => {
  const seq = new CombatActionSequencer();
  const hitOrder: Array<{ id: string; idx: number; timeMs: number }> = [];
  let elapsedMs = 0;

  // Deliberately supply targets out of X-order to verify strict left-to-right sorting
  const done = seq.playCutIn(
    {
      id: 'seq_aoe_cascade',
      actionKind: 'aoe',
      stagingMode: 'ranged_aoe',
      attackerId: 'hero',
      targetIds: ['e3', 'e1', 'e2'],
      allActorIds: ['hero', 'e1', 'e2', 'e3'],
      attackerBounds: { id: 'hero', x: 180, groundY: 300, widthPx: 110, heightPx: 180 },
      targetBounds: [
        { id: 'e3', x: 820, groundY: 300, widthPx: 96, heightPx: 150 },
        { id: 'e1', x: 540, groundY: 300, widthPx: 96, heightPx: 150 },
        { id: 'e2', x: 680, groundY: 294, widthPx: 96, heightPx: 150 },
      ],
      onImpactTarget: (id, idx) => {
        hitOrder.push({ id, idx, timeMs: elapsedMs });
      },
    },
    { ...DEFAULT_COMBAT_PRESENTATION_CONFIG, aoeCascadeStepMs: 40 },
    960,
    380,
  );

  let impactZoom = 0;
  for (let i = 0; i < 160 && seq.isActive(); i++) {
    const dt = 0.01;
    elapsedMs += dt * 1000;
    const f = seq.step(dt, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    if (f.phase === 'impact_freeze' && impactZoom === 0) {
      impactZoom = f.cameraZoom;
    }
  }
  await done;

  assert.deepEqual(
    hitOrder.map((h) => h.id),
    ['e1', 'e2', 'e3'],
    'AoE impacts must ripple strictly left-to-right',
  );
  const gap1 = hitOrder[1].timeMs - hitOrder[0].timeMs;
  const gap2 = hitOrder[2].timeMs - hitOrder[1].timeMs;
  assert.ok(gap1 >= 30 && gap1 <= 55, `first cascade stagger (${gap1}ms) should be ~40ms`);
  assert.ok(gap2 >= 30 && gap2 <= 55, `second cascade stagger (${gap2}ms) should be ~40ms`);
  assert.ok(impactZoom >= 1.0 && impactZoom <= 1.35, `AoE impact zoom (${impactZoom.toFixed(2)}) stays wider and >= 1.0`);
});

test('CombatActionSequencer serializes FIFO queued actions and guarantees cleanup on cancel/tacticalView', async () => {
  const seq = new CombatActionSequencer();
  const starts: string[] = [];

  const p1 = seq.enqueueCutIn(
    {
      id: 'q1',
      actionKind: 'normal',
      stagingMode: 'melee',
      attackerId: 'hero',
      targetIds: ['e1'],
      allActorIds: ['hero', 'e1'],
      attackerBounds: { id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 },
      targetBounds: [{ id: 'e1', x: 640, groundY: 300, widthPx: 100, heightPx: 160 }],
      onWindupStart: () => starts.push('q1'),
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );
  const p2 = seq.enqueueCutIn(
    {
      id: 'q2',
      actionKind: 'normal',
      stagingMode: 'ranged_fast',
      attackerId: 'e1',
      targetIds: ['hero'],
      allActorIds: ['hero', 'e1'],
      attackerBounds: { id: 'e1', x: 640, groundY: 300, widthPx: 100, heightPx: 160 },
      targetBounds: [{ id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 }],
      onWindupStart: () => starts.push('q2'),
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );

  assert.deepEqual(starts, ['q1'], 'second action waits in FIFO queue instead of stomping first');
  assert.equal(seq.getQueueLength(), 1);

  for (let i = 0; i < 200 && (seq.isActive() || seq.getQueueLength() > 0); i++) {
    seq.step(0.025, 960, 380, { tacticalViewActive: false, reducedMotion: false });
  }
  await Promise.all([p1, p2]);
  assert.deepEqual(starts, ['q1', 'q2'], 'queued second action runs cleanly after first completes');

  // Tactical View immediately cancels active + queued and restores neutral camera/UI
  let tacResolved = false;
  const pTac = seq
    .playCutIn(
      {
        id: 'seq_test_tac',
        actionKind: 'normal',
        stagingMode: 'melee',
        attackerId: 'e1',
        targetIds: ['hero'],
        allActorIds: ['hero', 'e1'],
        attackerBounds: { id: 'e1', x: 640, groundY: 300, widthPx: 100, heightPx: 160 },
        targetBounds: [{ id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 }],
      },
      DEFAULT_COMBAT_PRESENTATION_CONFIG,
      960,
      380,
    )
    .then(() => {
      tacResolved = true;
    });

  const frame = seq.step(0.016, 960, 380, {
    tacticalViewActive: true,
    reducedMotion: false,
  });
  await pTac;
  assert.equal(tacResolved, true);
  assert.equal(frame.active, false);
  assert.equal(frame.dimmerAlpha, 0);
  assert.equal(frame.worldUiAlpha, 1);
  assert.equal(frame.cameraZoom, 1);
  assert.equal(frame.cameraRotRad, 0);
});

test('Crawler and Stalker sheets expose crisp static cut-in pose overrides', () => {
  for (const variant of ['larva', 'skitter', 'stinger'] as const) {
    assert.equal(sampleCrawlerFrame(variant, undefined, 0.5, 0, 'attack_pose').frameIndex, 4);
    assert.equal(sampleCrawlerFrame(variant, undefined, 0.5, 0, 'brace_pose').frameIndex, 1);
    assert.equal(sampleCrawlerFrame(variant, undefined, 0.5, 0, 'recoil_pose').frameIndex, 9);
  }

  const stalkerAtk = stepStalkerJuice(createStalkerJuiceState(1), 0.016, 0.5, {
    attackAnimTimer: 0.2,
    attackAnimDuration: 0.5,
  });
  const stalkerBrace = stepStalkerJuice(createStalkerJuiceState(1), 0.016, 0.5, {
    armoredGuard: true,
  });
  const stalkerRecoil = stepStalkerJuice(createStalkerJuiceState(1), 0.016, 0.5, {
    staggerTimer: 0.2,
    staggerDuration: 0.4,
  });
  assert.equal(stalkerAtk.mode, 'attack');
  assert.equal(stalkerAtk.frameIndex, 1);
  assert.equal(stalkerAtk.frameBlendAlpha, 1);
  assert.equal(stalkerBrace.mode, 'guard');
  assert.equal(stalkerBrace.frameBlendAlpha, 1);
  assert.equal(stalkerRecoil.mode, 'pain');
  assert.equal(stalkerRecoil.frameIndex, 1);
  assert.equal(stalkerRecoil.frameBlendAlpha, 1);
});

test('CombatActionSequencer isolates throwing callbacks and still completes Phase D cleanup', async () => {
  const seq = new CombatActionSequencer();
  let resolved = false;
  const done = seq
    .enqueueCutIn(
      {
        id: 'fault-tolerant-aoe',
        actionKind: 'aoe',
        stagingMode: 'ranged_aoe',
        attackerId: 'hero',
        targetIds: ['e1', 'e2'],
        allActorIds: ['hero', 'e1', 'e2'],
        attackerBounds: { id: 'hero', x: 200, groundY: 300, widthPx: 110, heightPx: 180 },
        targetBounds: [
          { id: 'e1', x: 560, groundY: 300, widthPx: 96, heightPx: 150 },
          { id: 'e2', x: 720, groundY: 300, widthPx: 96, heightPx: 150 },
        ],
        onWindupStart: () => {
          throw new Error('simulated windup VFX failure');
        },
        onProjectileSpawn: () => {
          throw new Error('simulated projectile spawn failure');
        },
        onImpactFrame: () => {
          throw new Error('simulated impact audio failure');
        },
        onImpactTarget: () => {
          throw new Error('simulated target popup failure');
        },
      },
      DEFAULT_COMBAT_PRESENTATION_CONFIG,
      960,
      380,
    )
    .then(() => {
      resolved = true;
    });

  let lastFrame = seq.step(0.016, 960, 380, {
    tacticalViewActive: false,
    reducedMotion: false,
  });
  for (let i = 0; i < 160; i++) {
    lastFrame = seq.step(0.02, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    if (!lastFrame.active) break;
  }

  await done;
  assert.equal(resolved, true);
  assert.equal(lastFrame.active, false);
  assert.equal(lastFrame.dimmerAlpha, 0);
  assert.equal(lastFrame.worldUiAlpha, 1);
  assert.ok(Math.abs(lastFrame.cameraZoom - 1) < 0.02);
  assert.equal(seq.getActorJuice('hero').poseOverride, 'none');
  assert.equal(seq.getActorJuice('e1').poseOverride, 'none');
  assert.equal(seq.getActorJuice('e2').poseOverride, 'none');
});

test('classifyHeroAttackStaging keeps Auraline and Zuri 100% ranged and Kira hybrid melee/pistol', () => {
  // Auraline is strictly ranged (scattergun) even on Surge or Overdrive
  const aureliaSingle = classifyHeroAttackStaging({
    charId: 'auraline',
    isSurge: true,
    damageValue: 22,
    targetCount: 1,
    attackToggle: 0,
    isOverdrive: false,
  });
  assert.equal(aureliaSingle.stagingMode, 'ranged_fast');
  assert.equal(aureliaSingle.heroAnimMode, 'shoot');
  assert.equal(aureliaSingle.projectileProfile, 'scattergun');

  const aureliaOd = classifyHeroAttackStaging({
    charId: 'auraline',
    isSurge: false,
    damageValue: 20,
    targetCount: 3,
    attackToggle: 0,
    isOverdrive: true,
  });
  assert.equal(aureliaOd.stagingMode, 'ranged_aoe');
  assert.equal(aureliaOd.heroAnimMode, 'overdrive');
  assert.equal(aureliaOd.projectileProfile, 'scattergun');

  // Zuri is strictly ranged (drone_plasma)
  const zuriSingle = classifyHeroAttackStaging({
    charId: 'zuri',
    isSurge: true,
    damageValue: 18,
    targetCount: 1,
    attackToggle: 0,
    isOverdrive: false,
  });
  assert.equal(zuriSingle.stagingMode, 'ranged_fast');
  assert.equal(zuriSingle.heroAnimMode, 'shoot');
  assert.equal(zuriSingle.projectileProfile, 'drone_plasma');

  // Kira alternates melee dash-kick and ranged cyber-pistol, with Surge forcing melee clash
  const kiraMelee = classifyHeroAttackStaging({
    charId: 'kira',
    isSurge: true,
    damageValue: 16,
    targetCount: 1,
    attackToggle: 1,
    isOverdrive: false,
  });
  assert.equal(kiraMelee.stagingMode, 'melee');
  assert.equal(kiraMelee.heroAnimMode, 'dash_kick');

  const kiraPistol = classifyHeroAttackStaging({
    charId: 'kira',
    isSurge: false,
    damageValue: 10,
    targetCount: 1,
    attackToggle: 0,
    isOverdrive: false,
  });
  assert.equal(kiraPistol.stagingMode, 'ranged_fast');
  assert.equal(kiraPistol.heroAnimMode, 'shoot');
  assert.equal(kiraPistol.projectileProfile, 'pistol_bolt');
});

test('classifyEnemyAttackStaging routes Spitter acid and Stinger darts to ranged, all others to melee', () => {
  const spitterAcid = classifyEnemyAttackStaging({ archetype: 'spitter', cueKind: 'enemy_acid' });
  assert.equal(spitterAcid.stagingMode, 'ranged_fast');
  assert.equal(spitterAcid.projectileProfile, 'acid_bile');

  const spitterClaw = classifyEnemyAttackStaging({
    archetype: 'spitter',
    cueKind: 'enemy_attack',
    clawRend: true,
  });
  assert.equal(spitterClaw.stagingMode, 'melee');

  const stingerDart = classifyEnemyAttackStaging({ archetype: 'stinger', cueKind: 'enemy_attack' });
  assert.equal(stingerDart.stagingMode, 'ranged_fast');
  assert.equal(stingerDart.projectileProfile, 'stinger_dart');

  for (const arch of ['larva', 'skitter', 'stalker', 'brute', 'boss'] as const) {
    const res = classifyEnemyAttackStaging({ archetype: arch, cueKind: 'enemy_attack' });
    assert.equal(res.stagingMode, 'melee', `${arch} must use nose-to-nose melee clash`);
  }
});

test('computeNoseToNoseMeleeSlides guarantees tight contact gap across Slots 1-5 without crossing', () => {
  const viewportW = 1000;
  const heroBounds = { id: 'hero', x: 210, groundY: 300, widthPx: 110, heightPx: 180 };
  const gapVw = 0.125; // 125px nose-to-nose contact gap
  const enemySlotsX = [460, 560, 660, 760, 860];

  for (const enemyX of enemySlotsX) {
    const enemyBounds = { id: 'e1', x: enemyX, groundY: 300, widthPx: 100, heightPx: 160 };

    // Hero attacking enemy
    const heroAtk = computeNoseToNoseMeleeSlides({
      attackerBounds: heroBounds,
      targetBounds: [enemyBounds],
      viewportW,
      clashGapVw: gapVw,
      strikeDirX: +1,
    });
    const finalHeroX = heroBounds.x + heroAtk.attackerSlideX;
    const finalEnemyX = enemyBounds.x + (heroAtk.targetSlidesX.get('e1') ?? 0);
    assert.ok(finalHeroX < finalEnemyX, 'hero stays strictly left of enemy during melee clash');
    assert.ok(
      Math.abs((finalEnemyX - finalHeroX) - viewportW * gapVw) < 1.0,
      `contact gap (${(finalEnemyX - finalHeroX).toFixed(1)}px) matches ${(viewportW * gapVw).toFixed(1)}px`,
    );

    // Enemy attacking hero
    const enemyAtk = computeNoseToNoseMeleeSlides({
      attackerBounds: enemyBounds,
      targetBounds: [heroBounds],
      viewportW,
      clashGapVw: gapVw,
      strikeDirX: -1,
    });
    const finalEnemyAtkX = enemyBounds.x + enemyAtk.attackerSlideX;
    const finalHeroDefX = heroBounds.x + (enemyAtk.targetSlidesX.get('hero') ?? 0);
    assert.ok(finalHeroDefX < finalEnemyAtkX, 'attacking enemy stays strictly right of hero');
    assert.ok(
      Math.abs((finalEnemyAtkX - finalHeroDefX) - viewportW * gapVw) < 1.0,
      `enemy clash gap (${(finalEnemyAtkX - finalHeroDefX).toFixed(1)}px) matches target`,
    );
  }
});

test('SpriteJuiceFeedbackHandler knockback eases out smoothly with zero rubber-band reversal', () => {
  const juice = new SpriteJuiceFeedbackHandler();
  juice.beginWindup({
    attackerId: 'hero',
    targetIds: ['e1'],
    allActorIds: ['hero', 'e1'],
    strikeDirX: +1,
    isMelee: true,
    clashSlideDistPx: 120,
    rangedLungePx: 18,
    attackerSlideOverridePx: 120,
    targetSlideOverridesPx: new Map([['e1', -120]]),
  });
  juice.triggerImpact({
    attackerId: 'hero',
    targetIds: ['e1'],
    strikeDirX: +1,
    knockbackPx: 60,
    holdDriftPx: 14,
    attackerScalePunch: 1.28,
    whiteFlashFrames: 3,
    isCrit: false,
    isMelee: true,
  });

  // Knockback starts with a crisp 22% initial impulse (not a 78% teleport) and eases smoothly to peak with zero negative overshoot
  const t0 = juice.getSnapshot('e1', 0.75).knockbackX;
  assert.ok(t0 > 0 && t0 <= 20, `initial knockback impulse (${t0.toFixed(1)}px) avoids abrupt teleport`);

  let peakKb = t0;
  for (let i = 0; i < 45; i++) {
    juice.stepFrame(0.016, false, 'followthrough', i / 45);
    const kb = juice.getSnapshot('e1', 0.75).knockbackX;
    assert.ok(kb >= 0, `knockbackX (${kb.toFixed(2)}) must never overshoot opposite direction`);
    if (kb > peakKb) peakKb = kb;
  }
  assert.ok(peakKb > 54, `knockback reaches near peak (${peakKb.toFixed(1)}px)`);
});

test('deriveEnemyDeformAndUniforms bends both native-left and mirrored-right enemies toward hero on attack and away on recoil', () => {
  const makeCutIn = (poseOverride: 'attack_pose' | 'recoil_pose') => ({
    active: true,
    role: poseOverride === 'attack_pose' ? ('attacker' as const) : ('target' as const),
    isMeleeClash: true,
    poseOverride,
    drawPriority: 10,
    clashSlideX: 0,
    knockbackX: 0,
    scaleX: 1,
    scaleY: 1,
    leanRad: 0,
    flashRgba: null,
    tintRgba: [1, 1, 1, 1] as [number, number, number, number],
  });

  // 1. Native left-facing enemy (Crawler / Boss, facingSign = +1):
  // Local +X = screen RIGHT, Local -X = screen LEFT (toward hero).
  const larvaAtk = deriveEnemyDeformAndUniforms({
    archetype: 'larva',
    idx: 0,
    ea: undefined,
    isDead: false,
    staggerShearPx: 0,
    staggerBioFlashAlpha: 0,
    breathScaleX: 1,
    breathScaleY: 1,
    frameBlendAlpha: 1,
    bioEmissiveRgb: [0.5, 1, 0.2],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: false,
    elapsed: 0,
    tacticalViewActive: false,
    cutIn: makeCutIn('attack_pose'),
    facingSign: 1,
  });
  const larvaRecoil = deriveEnemyDeformAndUniforms({
    archetype: 'larva',
    idx: 0,
    ea: undefined,
    isDead: false,
    staggerShearPx: 0,
    staggerBioFlashAlpha: 0,
    breathScaleX: 1,
    breathScaleY: 1,
    frameBlendAlpha: 1,
    bioEmissiveRgb: [0.5, 1, 0.2],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: false,
    elapsed: 0,
    tacticalViewActive: false,
    cutIn: makeCutIn('recoil_pose'),
    facingSign: 1,
  });
  // Screen dx = local dx * facingSign (+1): attack bends LEFT (< 0), recoil bends RIGHT (> 0)
  assert.ok(larvaAtk.deform.head.dx * 1 < 0, 'native-left larva attack bends toward hero (left)');
  assert.ok(larvaRecoil.deform.head.dx * 1 > 0, 'native-left larva recoil bends away from hero (right)');

  // 2. Mirrored right-facing enemy (Stalker, facingSign = -1):
  // Screen dx = local dx * facingSign (-1): so local dx > 0 bends LEFT on screen!
  const stalkerAtk = deriveEnemyDeformAndUniforms({
    archetype: 'stalker',
    idx: 0,
    ea: undefined,
    isDead: false,
    staggerShearPx: 0,
    staggerBioFlashAlpha: 0,
    breathScaleX: 1,
    breathScaleY: 1,
    frameBlendAlpha: 1,
    bioEmissiveRgb: [1, 0.2, 0.5],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: false,
    elapsed: 0,
    tacticalViewActive: false,
    cutIn: makeCutIn('attack_pose'),
    facingSign: -1,
  });
  const stalkerRecoil = deriveEnemyDeformAndUniforms({
    archetype: 'stalker',
    idx: 0,
    ea: undefined,
    isDead: false,
    staggerShearPx: 0,
    staggerBioFlashAlpha: 0,
    breathScaleX: 1,
    breathScaleY: 1,
    frameBlendAlpha: 1,
    bioEmissiveRgb: [1, 0.2, 0.5],
    isPrimedOrCharging: false,
    isAcidOrPustuleActive: false,
    isStaggeredStatus: false,
    elapsed: 0,
    tacticalViewActive: false,
    cutIn: makeCutIn('recoil_pose'),
    facingSign: -1,
  });
  assert.ok(stalkerAtk.deform.head.dx * -1 < 0, 'mirrored stalker attack bends toward hero (left on screen)');
  assert.ok(stalkerRecoil.deform.head.dx * -1 > 0, 'mirrored stalker recoil bends away from hero (right on screen)');
});

test('SpriteJuiceFeedbackHandler.triggerTargetEvade clears recoil/flash/knockback while preserving melee clash slide', () => {
  const juice = new SpriteJuiceFeedbackHandler();
  juice.beginWindup({
    attackerId: 'e1',
    targetIds: ['hero'],
    allActorIds: ['hero', 'e1'],
    strikeDirX: -1,
    isMelee: true,
    clashSlideDistPx: 140,
    attackerSlideOverridePx: -150,
    targetSlideOverridesPx: new Map([['hero', 150]]),
    rangedLungePx: 14,
  });
  juice.stepFrame(0.016, false, 'windup', 1.0);
  const preEvade = juice.getSnapshot('hero', 0.75);
  assert.equal(preEvade.poseOverride, 'brace_pose');
  assert.ok(preEvade.clashSlideX > 120, 'hero slides into center-stage melee clash');

  juice.triggerTargetEvade({ targetId: 'hero' });
  const evaded = juice.getSnapshot('hero', 0.75);
  assert.equal(evaded.poseOverride, 'none', 'evade releases brace_pose immediately');
  assert.equal(evaded.knockbackX, 0, 'evade applies zero knockback');
  assert.equal(evaded.flashRgba, null, 'evade applies zero hit flash');
  assert.ok(evaded.clashSlideX > 120, 'evade preserves center-stage clash anchor without snapping backward');
  assert.equal(evaded.drawPriority, 3, 'evading target stays in foreground draw layer');
});

test('CombatActionSequencer runs melee Darkest Dungeon clash with 50ms tension pause and full-dodge zoomed hold on evade', async () => {
  const seq = new CombatActionSequencer();
  let impacts = 0;

  const done = seq.playCutIn(
    {
      id: 'seq_melee_evade',
      actionKind: 'crit',
      stagingMode: 'melee',
      attackerId: 'e1',
      targetIds: ['hero'],
      allActorIds: ['hero', 'e1', 'e2'],
      attackerBounds: { id: 'e1', x: 660, groundY: 300, widthPx: 100, heightPx: 160 },
      targetBounds: [{ id: 'hero', x: 210, groundY: 300, widthPx: 110, heightPx: 180 }],
      tempoScale: 0.64,
      evadedTargetIds: ['hero'],
      hitstopOverrideSec: 0.05,
      holdDurationOverrideSec: 1.0,
      onImpactFrame: () => {
        impacts++;
      },
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );

  let hitStopElapsedSec = 0;
  let followthroughElapsedSec = 0;
  let maxEnemyApproachPx = 0;
  let maxHeroApproachPx = 0;
  let peakHoldZoom = 1;
  let sawInvertOrSpeedLines = false;
  let sawHeroFlashOrKnockback = false;
  let sawHeroRecoil = false;

  const dt = 0.01;
  for (let i = 0; i < 300 && seq.isActive(); i++) {
    const f = seq.step(dt, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    const enemySnap = seq.getActorJuice('e1');
    const heroSnap = seq.getActorJuice('hero');

    if (enemySnap.clashSlideX < 0) {
      maxEnemyApproachPx = Math.max(maxEnemyApproachPx, -enemySnap.clashSlideX);
    }
    if (heroSnap.clashSlideX > 0) {
      maxHeroApproachPx = Math.max(maxHeroApproachPx, heroSnap.clashSlideX);
    }
    if (f.invertFlashAlpha > 0 || f.speedLinesAlpha > 0) {
      sawInvertOrSpeedLines = true;
    }
    if (f.phase === 'impact_freeze' || f.phase === 'followthrough') {
      if (heroSnap.flashRgba !== null || Math.abs(heroSnap.knockbackX) > 0.01) {
        sawHeroFlashOrKnockback = true;
      }
      if (heroSnap.poseOverride === 'recoil_pose') {
        sawHeroRecoil = true;
      }
    }
    if (f.isHitStopped) {
      hitStopElapsedSec += dt;
    }
    if (f.phase === 'followthrough') {
      followthroughElapsedSec += dt;
      peakHoldZoom = Math.max(peakHoldZoom, f.cameraZoom);
      assert.equal(f.worldUiAlpha, 0, 'world HUD stays hidden while zoomed in on dodge');
    }
  }

  await done;
  assert.equal(impacts, 1);
  assert.ok(maxEnemyApproachPx > 100, `melee attacker must advance nose-to-nose (moved ${maxEnemyApproachPx.toFixed(1)}px)`);
  assert.ok(maxHeroApproachPx > 100, `hero must meet enemy in center-stage clash (moved ${maxHeroApproachPx.toFixed(1)}px)`);
  assert.ok(
    hitStopElapsedSec >= 0.04 && hitStopElapsedSec <= 0.06,
    `evade micro tension pause should be ~50ms (got ${(hitStopElapsedSec * 1000).toFixed(0)}ms)`,
  );
  assert.ok(
    followthroughElapsedSec >= 0.96,
    `zoomed Darkest Dungeon hold must span full dodge duration even under pack speedup (got ${followthroughElapsedSec.toFixed(2)}s)`,
  );
  assert.ok(peakHoldZoom >= 1.32, `Darkest Dungeon melee zoom must stay active (${peakHoldZoom.toFixed(2)}x)`);
  assert.equal(sawInvertOrSpeedLines, false, 'evaded attack suppresses crit invert flash & speed lines');
  assert.equal(sawHeroFlashOrKnockback, false, 'evading Kira never receives hit flash or knockback');
  assert.equal(sawHeroRecoil, false, 'evading Kira never enters recoil_pose');
  assert.equal(seq.getPhase(), 'idle');
});

test('CombatActionSequencer runs Two-Beat ranged shooter zoom -> whip-pan to Kira evade with full hold', async () => {
  const seq = new CombatActionSequencer();
  let spawned = 0;
  let impacted = 0;

  const done = seq.playCutIn(
    {
      id: 'seq_ranged_evade',
      actionKind: 'normal',
      stagingMode: 'ranged_fast',
      attackerId: 'spitter_1',
      targetIds: ['hero'],
      allActorIds: ['hero', 'spitter_1'],
      attackerBounds: { id: 'spitter_1', x: 740, groundY: 300, widthPx: 100, heightPx: 160 },
      targetBounds: [{ id: 'hero', x: 210, groundY: 300, widthPx: 110, heightPx: 180 }],
      evadedTargetIds: ['hero'],
      hitstopOverrideSec: 0.05,
      holdDurationOverrideSec: 1.0,
      onProjectileSpawn: () => {
        spawned++;
      },
      onImpactFrame: () => {
        impacted++;
      },
    },
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
    960,
    380,
  );

  let windupPanX = 0;
  let holdPanX = 0;
  let holdSec = 0;
  const phases = new Set<string>();
  const dt = 0.02;

  for (let i = 0; i < 200 && seq.isActive(); i++) {
    const f = seq.step(dt, 960, 380, {
      tacticalViewActive: false,
      reducedMotion: false,
    });
    phases.add(f.phase);
    if (f.phase === 'windup') windupPanX = f.cameraPanX;
    if (f.phase === 'followthrough') {
      holdPanX = f.cameraPanX;
      holdSec += dt;
      assert.equal(seq.getActorJuice('hero').poseOverride, 'none');
      assert.equal(seq.getActorJuice('hero').flashRgba, null);
    }
  }

  await done;
  assert.equal(spawned, 1, 'ranged evade spawns projectile cleanly on Beat 1 -> Beat 2 transition');
  assert.equal(impacted, 1);
  assert.ok(phases.has('windup') && phases.has('travel') && phases.has('impact_freeze') && phases.has('followthrough'));
  assert.ok(
    holdPanX > windupPanX + 40,
    `camera whip-pans from right ranged enemy (panX=${windupPanX.toFixed(1)}) to left dodging Kira (panX=${holdPanX.toFixed(1)})`,
  );
  assert.ok(holdSec >= 0.96, `ranged evade holds zoom across full dodge (${holdSec.toFixed(2)}s)`);
});



