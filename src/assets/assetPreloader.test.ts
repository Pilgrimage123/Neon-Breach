import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackgroundTaskOrder, buildEnemyPreloadOrder } from './preloadPlan';

test('buildEnemyPreloadOrder deduplicates critical encounter enemies and defers remaining archetypes', () => {
  const plan = buildEnemyPreloadOrder(['stalker', 'stalker', 'larva']);
  assert.deepEqual(plan.critical, ['stalker', 'larva']);
  assert.deepEqual(plan.deferred, ['skitter', 'stinger', 'spitter', 'brute', 'boss']);
});

test('buildEnemyPreloadOrder returns all enemies in deferred when encounter list is empty', () => {
  const plan = buildEnemyPreloadOrder([]);
  assert.deepEqual(plan.critical, []);
  assert.deepEqual(plan.deferred, [
    'larva',
    'skitter',
    'stinger',
    'stalker',
    'spitter',
    'brute',
    'boss',
  ]);
});

test('buildBackgroundTaskOrder prioritizes selected character combat assets ahead of alternate operative', () => {
  const kiraOrder = buildBackgroundTaskOrder('kira');
  assert.equal(kiraOrder[0], 'backdrop');
  assert.equal(kiraOrder[1], 'char:kira');
  assert.ok(
    kiraOrder.indexOf('char:kira') < kiraOrder.indexOf('char:aurelia'),
    'Expected Kira combat frames before Aurelia',
  );
  assert.ok(
    kiraOrder.indexOf('enemy:stalker') < kiraOrder.indexOf('char:kira_emote'),
    'Expected enemies before non-critical emote sheet',
  );

  const aureliaOrder = buildBackgroundTaskOrder('aurelia');
  assert.equal(aureliaOrder[0], 'backdrop');
  assert.equal(aureliaOrder[1], 'char:aurelia');
  assert.ok(
    aureliaOrder.indexOf('char:aurelia') < aureliaOrder.indexOf('char:kira'),
    'Expected Aurelia frames before Kira',
  );

  const zuriOrder = buildBackgroundTaskOrder('zuri');
  assert.equal(zuriOrder[0], 'backdrop');
  assert.equal(zuriOrder[1], 'char:zuri');
  assert.equal(zuriOrder[2], 'char:zuri_drones');
  assert.ok(
    zuriOrder.indexOf('char:zuri_drones') < zuriOrder.indexOf('char:kira'),
    'Expected Zuri and drone frames before Kira',
  );
  assert.ok(
    zuriOrder.indexOf('enemy:stalker') < zuriOrder.indexOf('char:zuri_emote'),
    'Expected enemies before Zuri emote sheet',
  );
});
