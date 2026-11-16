import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatState, EnemyUnit, Tile } from '../engine/types.ts';
import {
  AAA_TYPOGRAPHY_AND_CONTRAST_SPEC,
  KEYWORD_NESTED_TOOLTIPS,
  MINIMALIST_STRATEGY_PROMPT_CONSTRAINT,
  countUiWords,
  enforceEightWordRule,
  formatTileStreamlinedDescription,
  formatEnemyStreamlinedRule,
  computeBoardIntentVectors,
  computeKnockbackSwapPreview,
  formatStreamlinedOnboardingPrompt,
  resolveActivePreviewKeywords,
} from './spatialMinimalistUi.ts';

describe('spatialMinimalistUi — Anti-Wordiness, AAA Typography & Spatial Board UX', () => {
  it('enforces the 8-Word Rule across all nested keyword definitions in EN and CS', () => {
    for (const [id, kw] of Object.entries(KEYWORD_NESTED_TOOLTIPS)) {
      const enWords = countUiWords(kw.ruleEn);
      const csWords = countUiWords(kw.ruleCs);
      assert.ok(
        enWords <= 8,
        `Keyword ${id} EN rule "${kw.ruleEn}" has ${enWords} words (max 8)`
      );
      assert.ok(
        csWords <= 8,
        `Keyword ${id} CS rule "${kw.ruleCs}" has ${csWords} words (max 8)`
      );
      assert.equal(enforceEightWordRule(kw.ruleEn), kw.ruleEn.trim());
    }
  });

  it('truncates overly wordy descriptions to strictly <= 8 words via enforceEightWordRule', () => {
    const wordy =
      'This unit attacks the enemy directly in front of it, dealing 2 points of physical damage and pushing them back.';
    assert.ok(countUiWords(wordy) > 8);
    const trimmed = enforceEightWordRule(wordy);
    assert.equal(countUiWords(trimmed), 8);
  });

  it('produces streamlined Math-Over-Prose tile descriptions under 8 words with nested keywords', () => {
    const tiles: Tile[] = [
      { id: 't1', type: 'attack', sourceId: 'innate', value: 4, isHeldFromPrevTurn: false },
      { id: 't2', type: 'defense', sourceId: 'innate', value: 7, isHeldFromPrevTurn: true },
      {
        id: 't3',
        type: 'tech',
        sourceId: 'innate',
        value: 0,
        isHeldFromPrevTurn: false,
        techEffect: { kind: 'damage_boost', percent: 42, decayPerTurn: 10 },
      },
      {
        id: 't4',
        type: 'tech',
        sourceId: 'armor_shred',
        value: 0,
        isHeldFromPrevTurn: false,
        techEffect: { kind: 'armor_shred', shredAmount: 4, pierceDamage: 3 },
      },
      {
        id: 't5',
        type: 'tech',
        sourceId: 'overdrive',
        value: 0,
        isHeldFromPrevTurn: false,
        isJammed: true,
        techEffect: { kind: 'overdrive_surge', bonusOverdrive: 30, cleanseCorrode: 2 },
      },
    ];

    for (const tile of tiles) {
      for (const lang of ['en', 'cs'] as const) {
        const res = formatTileStreamlinedDescription(tile, Math.max(4, tile.value), lang);
        const wc = countUiWords(res.shortRule);
        assert.ok(
          wc <= 8,
          `Tile (${tile.id}, ${lang}) rule "${res.shortRule}" has ${wc} words`
        );
        assert.ok(res.keywords.length >= 1, 'Should attach at least 1 nested keyword');
        assert.ok(res.mathFormula.length > 0);
      }
    }
  });

  it('produces streamlined Enemy passive & counter rules under 8 words', () => {
    const passives = [
      'volatile_burst',
      'anchor_aegis',
      'time_bomb',
      'spike_retaliate',
      'acid_jam',
      'threshold_pip',
      'phase_gate',
    ] as const;

    for (const passive of passives) {
      const mockEnemy: EnemyUnit = {
        id: `e_${passive}`,
        archetype: 'stalker',
        hp: 16,
        maxHp: 20,
        armor: 4,
        shieldPips: 1,
        maxShieldPips: 1,
        passive,
        roleColor: 'crimson',
        intentCycle: [{ kind: 'attack', value: 6 }],
        currentIntentIndex: 0,
      };
      for (const lang of ['en', 'cs'] as const) {
        const res = formatEnemyStreamlinedRule(mockEnemy, lang);
        assert.ok(
          countUiWords(res.shortRule) <= 8,
          `Enemy passive ${passive} (${lang}) "${res.shortRule}" exceeds 8 words`
        );
        assert.ok(
          countUiWords(res.counterMath) <= 8,
          `Enemy counter ${passive} (${lang}) "${res.counterMath}" exceeds 8 words`
        );
      }
    }
  });

  it('defines AAA 7:1 Contrast (#F4F4F6 on #181A20) and 1080p minimum typography hierarchy', () => {
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.offWhiteHex, '#F4F4F6');
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.charcoalHex, '#181A20');
    assert.ok(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.contrastRatio >= 7.0);
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.boardNumbersPxRange[0], 28);
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.boardNumbersPxRange[1], 36);
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.unitTitlesPxRange[0], 24);
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.tooltipBodyPxRange[0], 20);
    assert.equal(AAA_TYPOGRAPHY_AND_CONTRAST_SPEC.maxCharsPerLine, 40);
    assert.ok(MINIMALIST_STRATEGY_PROMPT_CONSTRAINT.includes('Maximum 6 words per ability description'));
  });

  it('computes on-board enemy intent vectors and knockback swap preview', () => {
    const combat = {
      nodeId: 'n1',
      nodeType: 'COMBAT',
      turn: 1,
      phase: 'PLAYER_IDLE',
      board: [],
      drawPile: [],
      discardPile: [],
      rewardCredits: 10,
      rewardEquipmentChoices: [],
      totalDamageDealt: 0,
      enemies: [
        {
          id: 'e1',
          archetype: 'stalker',
          hp: 12,
          maxHp: 12,
          armor: 0,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'spike_retaliate',
          roleColor: 'crimson',
          intentCycle: [{ kind: 'attack', value: 5 }],
          currentIntentIndex: 0,
        },
        {
          id: 'e2',
          archetype: 'brute',
          hp: 10,
          maxHp: 14,
          armor: 3,
          shieldPips: 0,
          maxShieldPips: 0,
          passive: 'threshold_pip',
          roleColor: 'gold',
          intentCycle: [{ kind: 'armor', value: 4 }],
          currentIntentIndex: 0,
        },
      ],
    } as unknown as CombatState;

    const vectors = computeBoardIntentVectors(combat);
    assert.equal(vectors.length, 2);
    assert.equal(vectors[0].targetsHero, true);
    assert.equal(vectors[0].badgeText, '⚔ 5');
    assert.equal(vectors[1].targetsHero, false);
    assert.equal(vectors[1].badgeText, '🛡 +4');

    const swapPreview = computeKnockbackSwapPreview(combat, true, 'en');
    assert.ok(swapPreview);
    assert.equal(swapPreview.active, true);
    assert.equal(swapPreview.collisionDamage, 2);
    assert.equal(swapPreview.frontUnitSurvivingHp, 10);
    assert.equal(swapPreview.secondUnitSurvivingArmor, 1);
  });

  it('keeps onboarding micro-prompts <= 8 words and resolves active preview keywords', () => {
    for (const kind of ['surge', 'held', 'swap'] as const) {
      const promptEn = formatStreamlinedOnboardingPrompt(kind, 4, 'en');
      const promptCs = formatStreamlinedOnboardingPrompt(kind, 4, 'cs');
      assert.ok(countUiWords(promptEn) <= 8, `${kind} EN "${promptEn}" > 8 words`);
      assert.ok(countUiWords(promptCs) <= 8, `${kind} CS "${promptCs}" > 8 words`);
    }

    const swapKeywords = resolveActivePreviewKeywords(null, true);
    assert.ok(swapKeywords.includes('push'));
    assert.ok(swapKeywords.includes('armor'));

    const attackKeywords = resolveActivePreviewKeywords(
      {
        color: 'attack',
        tileCount: 4,
        stayCount: 2,
        baseDamage: 12,
        damageBoostPct: 0,
        totalDamage: 12,
        cleaveDamage: 0,
        armorPiercing: true,
        shieldGained: 0,
        reflectOnBlock: 0,
        healAmount: 0,
        damageBoostAddedPct: 0,
        armorShredAmount: 0,
        techPierceDamage: 0,
        cleanseCorrodeAmount: 0,
        overdriveGained: 10,
        surgeTriggered: true,
        surgeThreshold: 4,
        retaliateDamage: 0,
      },
      false
    );
    assert.ok(attackKeywords.includes('surge'));
    assert.ok(attackKeywords.includes('armor'));
    assert.ok(attackKeywords.includes('pierce'));
  });
});
