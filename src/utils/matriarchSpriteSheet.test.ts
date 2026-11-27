import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MATRIARCH_BACK_EXPLOSION_HP_RATIO,
  MATRIARCH_CANONICAL_HEIGHT,
  MATRIARCH_EXPLODED_SLIME_NOZZLES,
  MATRIARCH_INTACT_SLIME_NOZZLES,
  MATRIARCH_SHEET_FRAMES,
  isMatriarchBackExploded,
} from './matriarchSpriteSheet';

test('Matriarch sprite sheet defines intact (0) and exploded (1) frames with valid anchors and landmarks', () => {
  assert.equal(MATRIARCH_SHEET_FRAMES.length, 2);
  assert.equal(MATRIARCH_CANONICAL_HEIGHT, 560);
  assert.equal(MATRIARCH_BACK_EXPLOSION_HP_RATIO, 0.5);

  const [intact, exploded] = MATRIARCH_SHEET_FRAMES;
  assert.equal(intact.id, 'matriarch_intact');
  assert.equal(exploded.id, 'matriarch_exploded');

  for (const frame of MATRIARCH_SHEET_FRAMES) {
    assert.ok(frame.w > 400 && frame.h > 400);
    assert.ok(frame.anchorX > frame.w * 0.4 && frame.anchorX < frame.w * 0.6);
    assert.ok(frame.bottomY > frame.h * 0.9 && frame.bottomY <= frame.h);
    // Native left-facing: eye, jaw, and leading claw are left (-dx); egg sacs / ruptured back are right (+dx)
    assert.ok(frame.eyeOriginRel.dx < 0 && frame.eyeOriginRel.dy < 0);
    assert.ok(frame.jawOriginRel.dx < 0 && frame.jawOriginRel.dy < 0);
    assert.ok(frame.clawOriginRel.dx < 0 && frame.clawOriginRel.dy < 0);
    assert.ok(frame.backOriginRel.dx > 0 && frame.backOriginRel.dy < 0);
  }
});

test('Matriarch slime nozzles are populated for both intact and exploded phases within frame bounds', () => {
  assert.ok(MATRIARCH_INTACT_SLIME_NOZZLES.length >= 6);
  assert.ok(MATRIARCH_EXPLODED_SLIME_NOZZLES.length >= 6);

  const [intact, exploded] = MATRIARCH_SHEET_FRAMES;
  for (const n of MATRIARCH_INTACT_SLIME_NOZZLES) {
    const px = intact.anchorX + n.dx;
    const py = intact.bottomY + n.dy;
    assert.ok(px >= 0 && px < intact.w, `intact nozzle ${n.id} X=${px} out of bounds`);
    assert.ok(py >= 0 && py < intact.h, `intact nozzle ${n.id} Y=${py} out of bounds`);
  }
  for (const n of MATRIARCH_EXPLODED_SLIME_NOZZLES) {
    const px = exploded.anchorX + n.dx;
    const py = exploded.bottomY + n.dy;
    assert.ok(px >= 0 && px < exploded.w, `exploded nozzle ${n.id} X=${px} out of bounds`);
    assert.ok(py >= 0 && py < exploded.h, `exploded nozzle ${n.id} Y=${py} out of bounds`);
  }
});

test('isMatriarchBackExploded triggers strictly at or below half max HP', () => {
  assert.equal(isMatriarchBackExploded(100, 100), false);
  assert.equal(isMatriarchBackExploded(51, 100), false);
  assert.equal(isMatriarchBackExploded(50.1, 100), false);
  assert.equal(isMatriarchBackExploded(50, 100), true);
  assert.equal(isMatriarchBackExploded(49, 100), true);
  assert.equal(isMatriarchBackExploded(1, 100), true);
  assert.equal(isMatriarchBackExploded(0, 100), true);
  assert.equal(isMatriarchBackExploded(50, 0), false);
});
