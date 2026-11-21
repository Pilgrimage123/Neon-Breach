import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HEIRLOOM_STACKS } from './data';
import { createInitialRun } from './gameEngine';
import {
  clearActiveRun,
  loadActiveRun,
  loadBestRecord,
  parseAndValidateRun,
  recordRunCompletion,
  saveActiveRun,
  saveInheritedHeirloom,
} from './persistence';

test('parseAndValidateRun validates v3 runs, rejects corrupted saves, and backfills defaults cleanly', () => {
  const validAuraline = createInitialRun(77, 'auraline');
  const parsed = parseAndValidateRun(JSON.stringify(validAuraline));
  assert.ok(parsed);
  assert.equal(parsed.hero.characterId, 'auraline');
  assert.equal(parsed.mapNodes.length, 32);

  assert.equal(parseAndValidateRun(null), null);
  assert.equal(parseAndValidateRun('not json'), null);

  // Rejects invalid characterId
  const badChar = structuredClone(validAuraline);
  (badChar.hero as { characterId: string }).characterId = 'aurelia';
  assert.equal(parseAndValidateRun(JSON.stringify(badChar)), null);

  // Rejects NaN numeric fields
  const nanHp = structuredClone(validAuraline);
  (nanHp.hero as { hp: number | null }).hp = null as unknown as number;
  assert.equal(parseAndValidateRun(JSON.stringify(nanHp)), null);

  // Rejects invalid screen enum
  const badScreen = structuredClone(validAuraline);
  (badScreen as { screen: string }).screen = 'invalid_screen';
  assert.equal(parseAndValidateRun(JSON.stringify(badScreen)), null);

  // Rejects 'event' screen when activeEvent is missing
  const missingEvent = structuredClone(validAuraline);
  missingEvent.screen = 'event';
  missingEvent.combat = null;
  missingEvent.activeEvent = null;
  assert.equal(parseAndValidateRun(JSON.stringify(missingEvent)), null);

  // Rejects dead 17-node map length
  const badMapLen = structuredClone(validAuraline);
  badMapLen.mapNodes = badMapLen.mapNodes.slice(0, 17);
  assert.equal(parseAndValidateRun(JSON.stringify(badMapLen)), null);

  // Rejects unknown Skill Chip defId in ownedChips
  const badChip = structuredClone(validAuraline);
  badChip.hero.ownedChips.push({ instanceId: 'x', defId: 'pistole_aretta' });
  assert.equal(parseAndValidateRun(JSON.stringify(badChip)), null);

  // Rejects empty intentCycle, out-of-bounds intentIndex, float intentIndex, and <=0 maxHp
  const emptyCycle = structuredClone(validAuraline);
  emptyCycle.combat!.enemies[0].intentCycle = [];
  assert.equal(parseAndValidateRun(JSON.stringify(emptyCycle)), null);

  const badIntentIdx = structuredClone(validAuraline);
  badIntentIdx.combat!.enemies[0].currentIntentIndex = 1.5;
  assert.equal(parseAndValidateRun(JSON.stringify(badIntentIdx)), null);

  const zeroMaxHp = structuredClone(validAuraline);
  zeroMaxHp.hero.maxHp = 0;
  assert.equal(parseAndValidateRun(JSON.stringify(zeroMaxHp)), null);
});

test('clearActiveRun removes active save reliably and saveInheritedHeirloom caps at MAX_HEIRLOOM_STACKS (6)', () => {
  const run = createInitialRun(901, 'zuri');
  saveActiveRun(run);
  assert.ok(loadActiveRun());

  clearActiveRun();
  assert.equal(loadActiveRun(), null);

  const rec1 = recordRunCompletion(500, true, 8);
  assert.ok((rec1.totalNanites ?? 0) >= 8);
  const loaded = loadBestRecord();
  assert.equal(loaded.totalNanites, rec1.totalNanites);

  const capped = saveInheritedHeirloom('predictive_aim', 12);
  assert.equal(capped.inheritedHeirloom?.bonusStacks, MAX_HEIRLOOM_STACKS);
});

test('parseAndValidateRun deduplicates/prunes equippedInstanceIds, clamps hero bounds, and rejects malformed tiles or combat invariants', () => {
  const validRun = createInitialRun(314, 'kira');
  assert.ok(validRun.combat);

  // 1. Deduplicates and prunes orphaned equippedInstanceIds & clamps hero hp/overdrive/counters
  const dirtyStats = structuredClone(validRun);
  const realId = dirtyStats.hero.equippedInstanceIds[0];
  dirtyStats.hero.equippedInstanceIds = [realId, realId, 'ghost_instance_999'];
  dirtyStats.hero.hp = 9999;
  dirtyStats.hero.overdrive = 250;
  dirtyStats.hero.shield = -10;
  dirtyStats.hero.credits = -50;
  const sanitized = parseAndValidateRun(JSON.stringify(dirtyStats));
  assert.ok(sanitized);
  assert.deepEqual(sanitized.hero.equippedInstanceIds, [realId]);
  assert.equal(sanitized.hero.hp, sanitized.hero.maxHp);
  assert.equal(sanitized.hero.overdrive, 100);
  assert.equal(sanitized.hero.shield, 0);
  assert.equal(sanitized.hero.credits, 0);

  // 2. Rejects malformed tiles in masterPool and combat board
  const badPool = structuredClone(validRun);
  (badPool.masterPool[0] as { type: string }).type = 'plasma_beam';
  assert.equal(parseAndValidateRun(JSON.stringify(badPool)), null);

  const badBoardTile = structuredClone(validRun);
  (badBoardTile.combat!.board[0] as { id: string }).id = '';
  assert.equal(parseAndValidateRun(JSON.stringify(badBoardTile)), null);

  // 3. Rejects combat.turn < 1 or negative rewardCredits
  const zeroTurn = structuredClone(validRun);
  zeroTurn.combat!.turn = 0;
  assert.equal(parseAndValidateRun(JSON.stringify(zeroTurn)), null);

  const negCredits = structuredClone(validRun);
  negCredits.combat!.rewardCredits = -5;
  assert.equal(parseAndValidateRun(JSON.stringify(negCredits)), null);
});

