import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatState, EnemyUnit, Tile } from '../engine/types';
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
} from './spatialMinimalistUi';

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
        assert.equal(
          new Set(res.keywords).size,
          res.keywords.length,
          `Enemy passive ${passive} (${lang}) returned duplicate keywords: ${res.keywords.join(', ')}`
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
      rewardChipChoices: [],
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
    assert.equal(swapPreview.collisionDamage, 0);
    assert.equal(swapPreview.frontUnitSurvivingHp, 12);
    assert.equal(swapPreview.secondUnitSurvivingArmor, 3);
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

  it('verifies 100% of equipment descriptions satisfy the 8-word limit in EN and CS', async () => {
    const { TRANSLATIONS } = await import('../i18n/translations');
    for (const lang of ['en', 'cs'] as const) {
      const eqMap = TRANSLATIONS[lang].equipment;
      for (const [id, item] of Object.entries(eqMap)) {
        const words = countUiWords(item.desc);
        assert.ok(
          words <= 8,
          `Equipment ${id} [${lang}] exceeds 8 words (${words}): "${item.desc}"`
        );
      }
    }
  });

  it('verifies 100% of cyber implant descriptions satisfy the 8-word limit in EN and CS', async () => {
    const { TRANSLATIONS } = await import('../i18n/translations');
    for (const lang of ['en', 'cs'] as const) {
      const impMap = TRANSLATIONS[lang].implants;
      for (const [id, item] of Object.entries(impMap)) {
        const words = countUiWords(item.desc);
        assert.ok(
          words <= 8,
          `Implant ${id} [${lang}] exceeds 8 words (${words}): "${item.desc}"`
        );
      }
    }
  });

  it('verifies all character passives and overdrive descriptions satisfy the 8-word limit in EN and CS', async () => {
    const { TRANSLATIONS } = await import('../i18n/translations');
    for (const lang of ['en', 'cs'] as const) {
      const charMap = TRANSLATIONS[lang].characters;
      for (const [id, char] of Object.entries(charMap)) {
        const passWords = countUiWords(char.passive);
        assert.ok(
          passWords <= 8,
          `Hero ${id} [${lang}] passive exceeds 8 words (${passWords}): "${char.passive}"`
        );
        const odWords = countUiWords(char.overdriveDesc);
        assert.ok(
          odWords <= 8,
          `Hero ${id} [${lang}] overdrive exceeds 8 words (${odWords}): "${char.overdriveDesc}"`
        );
        const sumWords = countUiWords(char.summary);
        assert.ok(
          sumWords <= 8,
          `Hero ${id} [${lang}] summary exceeds 8 words (${sumWords}): "${char.summary}"`
        );
      }
    }
  });

  it('verifies map node descriptions satisfy the 8-word limit in EN and CS', async () => {
    const { TRANSLATIONS } = await import('../i18n/translations');
    for (const lang of ['en', 'cs'] as const) {
      const nodeMap = TRANSLATIONS[lang].nodeDescs;
      for (const [type, desc] of Object.entries(nodeMap)) {
        const words = countUiWords(desc);
        assert.ok(
          words <= 8,
          `Node ${type} [${lang}] desc exceeds 8 words (${words}): "${desc}"`
        );
      }
    }
  });

  it('verifies clinic and medbay notices satisfy the 8-word limit in EN and CS', async () => {
    const { TRANSLATIONS } = await import('../i18n/translations');
    for (const lang of ['en', 'cs'] as const) {
      const t = TRANSLATIONS[lang];
      const fields = [
        t.medbayHealDesc,
        t.medbayCalibrateDesc,
        t.medbaySalvageDesc,
        t.medbayOverclockDesc,
        t.fundedClinicAllActionsNote,
        t.greedyClinicNotice,
        t.opportunityCostNotice,
        t.clinicSubtitle,
        t.medbaySubtitle,
        t.chipDealerSubtitle,
      ];
      for (const text of fields) {
        const words = countUiWords(text);
        assert.ok(
          words <= 8,
          `Clinic/Medbay notice [${lang}] exceeds 8 words (${words}): "${text}"`
        );
      }
    }
  });

  it('verifies all cyber and dynasty event choices and stories satisfy the 8-word limit in EN and CS', async () => {
    const {
      CYBER_EVENT_TEMPLATES,
      DYNASTY_EVENT_TEMPLATES,
      localizeCyberEvent,
    } = await import('../engine/cyberEvents');
    const allTemplates = [...CYBER_EVENT_TEMPLATES, ...DYNASTY_EVENT_TEMPLATES];

    for (const lang of ['en', 'cs'] as const) {
      for (const tpl of allTemplates) {
        const localized = localizeCyberEvent(tpl, lang);
        const storyWords = countUiWords(localized.story);
        assert.ok(
          storyWords <= 8,
          `Event ${tpl.id} [${lang}] story exceeds 8 words (${storyWords}): "${localized.story}"`
        );
        for (const choice of localized.choices) {
          const labelWords = countUiWords(choice.label);
          assert.ok(
            labelWords <= 8,
            `Event ${tpl.id} choice ${choice.id} [${lang}] label exceeds 8 words (${labelWords}): "${choice.label}"`
          );
          const descWords = countUiWords(choice.description);
          assert.ok(
            descWords <= 8,
            `Event ${tpl.id} choice ${choice.id} [${lang}] desc exceeds 8 words (${descWords}): "${choice.description}"`
          );
        }
      }
    }
  });

  it('computes zero-hover Smart Action Trigger summaries (live math + KILL / FULL BLOCK / SURGE tags)', async () => {
    const { createInitialRun } = await import('../engine/gameEngine');
    const { computeSmartActionTriggerSummaries } = await import('./spatialMinimalistUi');
    const run = createInitialRun(42, 'kira');
    assert.ok(run.combat, 'Expected active combat on new run');

    // Force front enemy to low HP so attack trigger shows KILL tag, and set a known board
    run.combat.enemies[0].hp = 4;
    run.combat.enemies[0].armor = 0;
    run.combat.enemies[0].shieldPips = 0;
    run.combat.enemies[0].intentCycle = [{ kind: 'attack', value: 4 }];
    run.combat.enemies[0].currentIntentIndex = 0;

    run.combat.board = [
      { id: 'b1', type: 'attack', sourceId: 'innate', value: 6, isHeldFromPrevTurn: false },
      { id: 'b2', type: 'defense', sourceId: 'innate', value: 6, isHeldFromPrevTurn: false },
      {
        id: 'b3',
        type: 'tech',
        sourceId: 'innate',
        value: 0,
        isHeldFromPrevTurn: false,
        techEffect: { kind: 'damage_boost', percent: 35, decayPerTurn: 10 },
      },
    ];

    const summaries = computeSmartActionTriggerSummaries(run, 'en');
    assert.equal(summaries.attack.tileCount, 1);
    assert.ok(summaries.attack.mathFormula.includes('⚔'), `Expected ⚔ in ${summaries.attack.mathFormula}`);
    assert.ok(summaries.attack.killCount >= 1, 'Expected attack trigger to detect lethal KILL');
    assert.equal(summaries.attack.outcomeTag, '☠ KILL');
    assert.equal(summaries.attack.outcomeTone, 'kill');

    assert.equal(summaries.defense.tileCount, 1);
    assert.ok(summaries.defense.mathFormula.includes('🛡+'), `Expected 🛡+ in ${summaries.defense.mathFormula}`);
    assert.equal(summaries.defense.blocksAllIncoming, true);
    assert.equal(summaries.defense.outcomeTag, '🛡 FULL BLOCK');
    assert.equal(summaries.defense.outcomeTone, 'block');

    assert.equal(summaries.tech.tileCount, 1);
    assert.ok(summaries.tech.mathFormula.includes('+35%'), `Expected +35% in ${summaries.tech.mathFormula}`);
  });
});
