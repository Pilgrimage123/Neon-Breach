import test from 'node:test';
import assert from 'node:assert/strict';
import type { EnemyIntent, EnemyUnit, TurnPreview } from '../../engine/types';
import { formatEnemyIntent } from './combatStageTypes';
import {
  computeEnemyArmorPreview,
  computeEnemyHitBoxes,
  computeEnemySlotLayout,
  formatEnemyIntentCompact,
  formatEnemyIntentSummary,
  hitTestEnemySprite,
} from './combatEnemyUi';

function makeEnemy(overrides: Partial<EnemyUnit> = {}): EnemyUnit {
  return {
    id: 'enemy-1',
    archetype: 'brute',
    hp: 30,
    maxHp: 30,
    armor: 8,
    shieldPips: 0,
    maxShieldPips: 0,
    passive: 'threshold_pip',
    roleColor: 'crimson',
    intentCycle: [
      { kind: 'heavy', value: 13 },
      { kind: 'armor', value: 8 },
    ],
    currentIntentIndex: 0,
    ...overrides,
  };
}

function makePreview(overrides: Partial<TurnPreview> = {}): TurnPreview {
  return {
    color: 'attack',
    tileCount: 2,
    stayCount: 0,
    baseDamage: 12,
    damageBoostPct: 0,
    totalDamage: 12,
    cleaveDamage: 0,
    armorPiercing: false,
    shieldGained: 0,
    damageBoostAddedPct: 0,
    healAmount: 0,
    overdriveGained: 15,
    surgeTriggered: false,
    surgeThreshold: 4,
    reflectOnBlock: 0,
    armorShredAmount: 0,
    techPierceDamage: 0,
    cleanseCorrodeAmount: 0,
    retaliateDamage: 0,
    ...overrides,
  };
}

test('computeEnemyArmorPreview handles partial absorb, full absorb, armor break, pierce, and lethal', () => {
  const brute = makeEnemy({ hp: 30, maxHp: 30, armor: 8 });

  // Partial absorb: 12 raw damage vs 8 armor -> 8 absorbed, 0 remaining armor, 4 HP loss
  const partial = computeEnemyArmorPreview(brute, 0, 0, makePreview({ totalDamage: 12 }));
  assert.equal(partial.rawPreviewDmg, 12);
  assert.equal(partial.willBreakArmor, false);
  assert.equal(partial.armorAbsorbed, 8);
  assert.equal(partial.remainingArmor, 0);
  assert.equal(partial.previewHpLoss, 4);
  assert.equal(partial.projectedHp, 26);
  assert.equal(partial.willDie, false);

  // Full absorb: 5 raw damage vs 8 armor -> 5 absorbed, 3 remaining armor, 0 HP loss
  const fullAbsorb = computeEnemyArmorPreview(brute, 0, 0, makePreview({ totalDamage: 5 }));
  assert.equal(fullAbsorb.armorAbsorbed, 5);
  assert.equal(fullAbsorb.remainingArmor, 3);
  assert.equal(fullAbsorb.previewHpLoss, 0);
  assert.equal(fullAbsorb.projectedHp, 30);
  assert.equal(fullAbsorb.willDie, false);

  // Stack Surge armor break on front enemy -> breaks all armor, deals full HP loss
  const surgeBreak = computeEnemyArmorPreview(
    brute,
    0,
    0,
    makePreview({ totalDamage: 18, surgeTriggered: true }),
  );
  assert.equal(surgeBreak.willBreakArmor, true);
  assert.equal(surgeBreak.armorAbsorbed, 0);
  assert.equal(surgeBreak.remainingArmor, 0);
  assert.equal(surgeBreak.previewHpLoss, 18);
  assert.equal(surgeBreak.projectedHp, 12);

  // Phase-Blade 40% armor pierce: 10 raw damage -> 4 piercing, 6 regular vs 8 armor -> 4 HP loss, 2 armor remaining
  const pierce = computeEnemyArmorPreview(
    brute,
    0,
    0,
    makePreview({ totalDamage: 10, armorPiercing: true }),
  );
  assert.equal(pierce.willBreakArmor, false);
  assert.equal(pierce.armorAbsorbed, 6);
  assert.equal(pierce.remainingArmor, 2);
  assert.equal(pierce.previewHpLoss, 4);
  assert.equal(pierce.projectedHp, 26);

  // Backline enemy gets cleaveDamage instead of totalDamage and is not broken by front surge
  const backline = makeEnemy({ id: 'enemy-2', hp: 10, maxHp: 10, armor: 4 });
  const cleave = computeEnemyArmorPreview(
    backline,
    1,
    0,
    makePreview({ totalDamage: 20, cleaveDamage: 6, surgeTriggered: true }),
  );
  assert.equal(cleave.rawPreviewDmg, 6);
  assert.equal(cleave.willBreakArmor, false);
  assert.equal(cleave.armorAbsorbed, 4);
  assert.equal(cleave.previewHpLoss, 2);
  assert.equal(cleave.projectedHp, 8);

  // Lethal check
  const fragile = makeEnemy({ hp: 10, maxHp: 10, armor: 2 });
  const lethal = computeEnemyArmorPreview(fragile, 0, 0, makePreview({ totalDamage: 15 }));
  assert.equal(lethal.willDie, true);
  assert.equal(lethal.projectedHp, 0);
  assert.equal(lethal.previewHpLoss, 10);

  // TECH armor shred + front pierce damage
  const techShredFront = computeEnemyArmorPreview(
    brute,
    0,
    0,
    makePreview({
      color: 'tech',
      totalDamage: 0,
      armorShredAmount: 10,
      techPierceDamage: 4,
    }),
  );
  assert.equal(techShredFront.willBreakArmor, true);
  assert.equal(techShredFront.remainingArmor, 0);
  assert.equal(techShredFront.previewHpLoss, 4);
  assert.equal(techShredFront.projectedHp, 26);

  // Backline enemy gets armor shred without front pierce damage
  const techShredBack = computeEnemyArmorPreview(
    backline,
    1,
    0,
    makePreview({
      color: 'tech',
      totalDamage: 0,
      armorShredAmount: 10,
      techPierceDamage: 4,
    }),
  );
  assert.equal(techShredBack.willBreakArmor, true);
  assert.equal(techShredBack.remainingArmor, 0);
  assert.equal(techShredBack.previewHpLoss, 0);
  // Aegis Pip absorbs hit completely -> 0 HP loss, willCrackShieldPip = true
  const pipEnemy = makeEnemy({ hp: 20, maxHp: 20, armor: 4, shieldPips: 1, maxShieldPips: 1 });
  const pipPrev = computeEnemyArmorPreview(pipEnemy, 0, 0, makePreview({ totalDamage: 25 }));
  assert.equal(pipPrev.willCrackShieldPip, true);
  assert.equal(pipPrev.remainingShieldPips, 0);
  assert.equal(pipPrev.previewHpLoss, 0);
  assert.equal(pipPrev.projectedHp, 20);
  assert.equal(pipPrev.willDie, false);

  // Boss 50% Phase Gate clamps lethal/heavy hit at 50% HP and sets willTriggerPhaseGate
  const bossEnemy = makeEnemy({
    archetype: 'boss',
    hp: 70,
    maxHp: 110,
    armor: 0,
    shieldPips: 0,
    phaseGatePct: 50,
    phaseGateTriggered: false,
  });
  const gatePrev = computeEnemyArmorPreview(bossEnemy, 0, 0, makePreview({ totalDamage: 40 }));
  assert.equal(gatePrev.willTriggerPhaseGate, true);
  assert.equal(gatePrev.projectedHp, 55);
  assert.equal(gatePrev.previewHpLoss, 15);
  assert.equal(gatePrev.willDie, false);

  // Frontline Spore Mite (volatile_burst) dying chains +6 Pierce Bio-Rupture to backline ally
  const frontLarva = makeEnemy({
    id: 'larva-1',
    archetype: 'larva',
    hp: 10,
    maxHp: 12,
    armor: 0,
    passive: 'volatile_burst',
    roleColor: 'lime',
  });
  const backStalker = makeEnemy({
    id: 'stalker-2',
    archetype: 'stalker',
    hp: 18,
    maxHp: 22,
    armor: 6,
    passive: 'spike_retaliate',
    roleColor: 'crimson',
  });
  const backBurstPrev = computeEnemyArmorPreview(
    backStalker,
    1,
    0,
    makePreview({ totalDamage: 12, cleaveDamage: 0 }),
    [frontLarva, backStalker],
  );
  assert.equal(backBurstPrev.chainedBurstDmg, 6);
  assert.equal(backBurstPrev.previewHpLoss, 6);
  assert.equal(backBurstPrev.projectedHp, 12);
  assert.equal(backBurstPrev.remainingArmor, 6);
});

test('intent formatters never expose enemy attack names in EN or CS', () => {
  const forbiddenAttackNames = [
    'Strike',
    'Acid Spit',
    'Chitin Harden',
    'Bio-Leech',
    'Apex Rend',
    'Aegis Link',
    'Thermal Charge',
    'Seknutí',
    'Žíravý plivanec',
    'Tvrzení krunýře',
    'Bio-vysátí',
    'Smrtící drápy',
  ];

  const intents: EnemyIntent[] = [
    { kind: 'attack', value: 7 },
    { kind: 'attack', value: 7, corrodeAmount: 2, armorOnHit: 3, clawRend: true },
    { kind: 'heavy', value: 13 },
    { kind: 'acid', value: 5, secondaryValue: 2 },
    { kind: 'armor', value: 8 },
    { kind: 'bolster', value: 4 },
    { kind: 'charge', value: 0, secondaryValue: 16 },
    { kind: 'leech', value: 6, secondaryValue: 4 },
  ];

  for (const lang of ['en', 'cs'] as const) {
    for (const intent of intents) {
      const compact = formatEnemyIntentCompact(intent, lang);
      const summary = formatEnemyIntentSummary(intent, lang);
      const legacy = formatEnemyIntent(intent, lang);
      for (const text of [compact, summary, legacy]) {
        assert.ok(text.length > 0);
        for (const forbidden of forbiddenAttackNames) {
          assert.equal(
            text.includes(forbidden),
            false,
            `Unexpected enemy attack name "${forbidden}" found in "${text}" (${lang})`,
          );
        }
      }
    }
  }
  const clawCompactEn = formatEnemyIntentCompact(intents[1], 'en');
  assert.ok(clawCompactEn.includes('+2') && clawCompactEn.includes('+3'));
});

test('computeEnemyHitBoxes and hitTestEnemySprite track living enemies accurately across viewports', () => {
  const enemies: EnemyUnit[] = [
    makeEnemy({ id: 'dead-front', archetype: 'larva', hp: 0, maxHp: 18, armor: 0 }),
    makeEnemy({ id: 'living-mid', archetype: 'skitter', hp: 20, maxHp: 20, armor: 2 }),
    makeEnemy({ id: 'living-back', archetype: 'brute', hp: 30, maxHp: 30, armor: 8 }),
  ];

  for (const [w, h] of [
    [1200, 420],
    [640, 180],
  ] as const) {
    const boxes = computeEnemyHitBoxes(w, h, enemies);
    assert.equal(boxes.length, 2, `Dead enemy should be skipped at ${w}x${h}`);
    assert.equal(boxes[0].enemyId, 'living-mid');
    assert.equal(boxes[1].enemyId, 'living-back');

    for (const box of boxes) {
      assert.ok(box.x >= 0 && box.x + box.width <= w);
      assert.ok(box.y >= 0 && box.y + box.height <= h);
      const cx = box.x + Math.floor(box.width * 0.5);
      const cy = box.y + Math.floor(box.height * 0.5);
      assert.equal(hitTestEnemySprite(cx, cy, boxes), box.enemyId);
    }

    // Empty sky top-left misses all enemy hitboxes
    assert.equal(hitTestEnemySprite(12, 12, boxes), null);
  }
});

test('Carapace Brute occupies 2 bridge spots in computeEnemySlotLayout and formats armor + HP heal intents cleanly', () => {
  const enemies: EnemyUnit[] = [
    makeEnemy({ id: 'skitter-1', archetype: 'skitter', hp: 18, maxHp: 18, armor: 0 }),
    makeEnemy({ id: 'brute-2', archetype: 'brute', hp: 40, maxHp: 40, armor: 6 }),
    makeEnemy({ id: 'spitter-3', archetype: 'spitter', hp: 28, maxHp: 28, armor: 0 }),
  ];

  const layout = computeEnemySlotLayout(enemies, []);
  assert.equal(layout.effectiveSlotCount, 4);
  assert.deepEqual(layout.slotCenters, [0, 1.5, 3]);

  const boxes = computeEnemyHitBoxes(1440, 500, enemies);
  assert.equal(boxes.length, 3);
  assert.ok(boxes[1].width > boxes[0].width, '2-slot Brute hitbox should be wider than 1-slot Skitter');
  assert.ok(boxes[1].centerX > boxes[0].centerX && boxes[2].centerX > boxes[1].centerX);

  const braceIntent: EnemyIntent = { kind: 'armor', value: 6, secondaryValue: 3 };
  assert.equal(formatEnemyIntentCompact(braceIntent, 'en'), '+6 ARM · +3 HP');
  assert.equal(formatEnemyIntentCompact(braceIntent, 'cs'), '+6 BRN · +3 Zdraví');
  assert.equal(formatEnemyIntentSummary(braceIntent, 'en'), '+6 Armor · +3 HP');
  assert.equal(formatEnemyIntentSummary(braceIntent, 'cs'), '+6 Brnění · +3 Zdraví');
});
