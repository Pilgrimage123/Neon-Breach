import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialRun } from '../engine/gameEngine';
import {
  applyFailForwardBuff,
  canRepositionEnemies,
  computeContextualMicroPrompt,
  computeEncounterObjectives,
  computeOptimalTurnHint,
  formatDiscretePipMath,
  repositionFrontEnemies,
} from './tacticalSandboxAndHints';

test('formatDiscretePipMath converts raw integers into small discrete pips (1 Pip = 5 units)', () => {
  const zero = formatDiscretePipMath(0, 5);
  assert.equal(zero.pips, 0);
  assert.equal(zero.pipString, '○');

  const small = formatDiscretePipMath(3, 5);
  assert.equal(small.pips, 1);
  assert.equal(small.compactLabel, '1P (3)');

  const medium = formatDiscretePipMath(18, 5);
  assert.equal(medium.pips, 4);
  assert.equal(medium.pipString, '▮▮▮▮');
  assert.equal(medium.compactLabel, '4P (18)');
});

test('repositionFrontEnemies swaps first two living enemies purely for 0 AP without free damage', () => {
  const run = createInitialRun(104729, 'kira');
  assert.ok(run.combat);
  assert.equal(canRepositionEnemies(run.combat, false), true);
  assert.equal(canRepositionEnemies(run.combat, true), false);

  const firstBefore = run.combat.enemies[0];
  const secondBefore = run.combat.enemies[1];
  const res = repositionFrontEnemies(run.combat);

  assert.equal(res.swapped, true);
  assert.equal(res.collisionBonusDmg, 0);
  assert.equal(res.enemies[0].id, secondBefore.id);
  assert.equal(res.enemies[1].id, firstBefore.id);
  assert.equal(res.enemies[1].hp, firstBefore.hp);
  assert.equal(res.enemies[0].armor, secondBefore.armor);
});

test('computeOptimalTurnHint recommends Overdrive when at 100% and evaluates best color action otherwise', () => {
  const run = createInitialRun(104729, 'kira');
  const hintNormal = computeOptimalTurnHint(run, 'en');
  assert.ok(hintNormal);
  assert.ok(
    hintNormal.recommendedAction === 'attack' ||
      hintNormal.recommendedAction === 'defense' ||
      hintNormal.recommendedAction === 'tech',
  );
  assert.ok(hintNormal.headline.includes('HINT:'));
  assert.ok(hintNormal.rationale.length > 10);

  const overdriveRun = {
    ...run,
    heroine: { ...run.heroine, overdrive: 100 },
  };
  const hintOd = computeOptimalTurnHint(overdriveRun, 'en');
  assert.ok(hintOd);
  assert.equal(hintOd.recommendedAction, 'overdrive');
});

test('computeEncounterObjectives evaluates Casual 1-Star, Intermediate 2-Star, and Hardcore 3-Star Mastery', () => {
  const run = createInitialRun(104729, 'kira');
  assert.ok(run.combat);

  const clearedCombat = {
    ...run.combat,
    turn: 3,
    phase: 'VICTORY' as const,
    enemies: run.combat.enemies.map((e) => ({ ...e, hp: 0 })),
    director: run.combat.director
      ? {
          ...run.combat.director,
          compositionCounts: { attack: 1, defense: 1, tech: 1, surges: 1 },
        }
      : undefined,
  };

  // 3-Star Mastery: <=4 turns, 1+ surge, 0 undos, 0 hints, no fail-forward (0 CR bonus)
  const threeStar = computeEncounterObjectives({
    combat: clearedCombat,
    heroine: run.heroine,
    startingHp: run.heroine.hp,
    undosUsed: 0,
    hintsUsed: 0,
    failForwardUsed: false,
    lang: 'en',
  });
  assert.equal(threeStar.starsEarned, 3);
  assert.equal(threeStar.bonusCredits, 0);
  assert.equal(threeStar.bonusNanites, 3);
  assert.equal(threeStar.bonusScore, 225);

  // 2-Star Intermediate: used 1 hint (or 1 undo) so Tier 3 is locked, but <=5 turns is met
  const twoStarHint = computeEncounterObjectives({
    combat: clearedCombat,
    heroine: run.heroine,
    startingHp: run.heroine.hp,
    undosUsed: 0,
    hintsUsed: 1,
    lang: 'en',
  });
  assert.equal(twoStarHint.starsEarned, 2);

  // Fail-Forward Retry caps node at 1-Star regardless of turn count
  const failForwardCapped = computeEncounterObjectives({
    combat: clearedCombat,
    heroine: run.heroine,
    startingHp: run.heroine.hp,
    undosUsed: 1,
    failForwardUsed: true,
    lang: 'en',
  });
  assert.equal(failForwardCapped.starsEarned, 1);
  assert.equal(failForwardCapped.bonusCredits, 0);
  assert.equal(failForwardCapped.bonusNanites, 0);

  // 1-Star Casual: took 8 turns and lost HP
  const oneStar = computeEncounterObjectives({
    combat: { ...clearedCombat, turn: 8 },
    heroine: { ...run.heroine, hp: run.heroine.hp - 12 },
    startingHp: run.heroine.hp,
    undosUsed: 2,
    lang: 'en',
  });
  assert.equal(oneStar.starsEarned, 1);
});

test('computeContextualMicroPrompt and applyFailForwardBuff support onboarding and fail-forward retry', () => {
  const run = createInitialRun(104729, 'kira');
  const prompt = computeContextualMicroPrompt({
    run,
    countByColor: { attack: 1, defense: 1, tech: 4 },
    alreadySwappedThisTurn: false,
    lang: 'en',
  });
  assert.ok(prompt && prompt.includes('STACK SURGE'));

  const wounded = {
    ...run,
    screen: 'gameover' as const,
    heroine: { ...run.heroine, hp: 10, shield: 0, overdrive: 10 },
  };
  const buffed = applyFailForwardBuff(wounded);
  assert.equal(buffed.screen, 'combat');
  assert.ok(buffed.heroine.hp > 10);
  assert.equal(buffed.heroine.shield, 10);
  assert.equal(buffed.heroine.overdrive, 50);

  // Respects alreadySwappedThisTurn = true and Aurelia's heldTileBonus = 0
  const hintAfterSwap = computeOptimalTurnHint(run, 'en', true);
  assert.ok(hintAfterSwap && hintAfterSwap.recommendedAction !== 'swap');

  const aureliaRun = createInitialRun(104729, 'aurelia');
  assert.ok(aureliaRun.combat);
  const aureliaTurn2 = {
    ...aureliaRun,
    combat: {
      ...aureliaRun.combat,
      turn: 2,
      board: aureliaRun.combat.board.map((t, i) => ({
        ...t,
        type: i % 2 === 0 ? ('attack' as const) : ('defense' as const),
        isHeldFromPrevTurn: true,
      })),
    },
  };
  const aureliaPrompt = computeContextualMicroPrompt({
    run: aureliaTurn2,
    countByColor: { attack: 3, defense: 3, tech: 0 },
    alreadySwappedThisTurn: false,
    lang: 'en',
  });
  assert.ok(!aureliaPrompt || !aureliaPrompt.includes('HELD tiles gain'));
});
