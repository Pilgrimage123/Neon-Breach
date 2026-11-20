import test from 'node:test';
import assert from 'node:assert/strict';
import { CODEX_TRANSLATIONS, type GlossaryTermId } from '../i18n/codexTranslations';
import {
  GLOSSARY_TERMS,
  PASSIVE_TO_GLOSSARY_TERM,
  filterGlossaryTerms,
  getGlossaryTermMeta,
  getHeroCodexProfile,
} from './codexData';
import { HERO_SPECS, getInnateTilesForCharacter } from './data';
import { createStartingSkillChips } from './poolBuilder';
import type { CharacterId, EnemyPassiveKind } from './types';

test('getHeroCodexProfile mirrors HERO_SPECS, innate tiles, and starting chips accurately', () => {
  const expected: Record<
    CharacterId,
    { atk: number; def: number; tech: number; memory: number }
  > = {
    kira: { atk: 3, def: 2, tech: 4, memory: 3 },
    auraline: { atk: 4, def: 3, tech: 2, memory: 4 },
    zuri: { atk: 3, def: 3, tech: 3, memory: 4 },
  };

  for (const charId of ['kira', 'auraline', 'zuri'] as const) {
    const profile = getHeroCodexProfile(charId);
    const spec = HERO_SPECS[charId];
    const innate = getInnateTilesForCharacter(charId);
    const startChips = createStartingSkillChips(charId);

    assert.equal(profile.spec.id, charId);
    assert.equal(profile.spec.maxHp, spec.maxHp);
    assert.equal(profile.spec.memoryCapacity, spec.memoryCapacity);
    assert.equal(profile.spec.techOverdrivePerTile, spec.techOverdrivePerTile);
    assert.equal(profile.innateTiles.length, innate.length);
    assert.equal(profile.startingChips.length, startChips.ownedChips.length);
    assert.equal(profile.startingMemory, expected[charId].memory);
    assert.equal(profile.startingPoolCounts.attack, expected[charId].atk);
    assert.equal(profile.startingPoolCounts.defense, expected[charId].def);
    assert.equal(profile.startingPoolCounts.tech, expected[charId].tech);
    assert.equal(profile.totalStartingTiles, 9);
  }
});

test('glossary terms and hero codex translations are complete in both EN and CS', () => {
  const termIds = GLOSSARY_TERMS.map((t) => t.id);
  const uniqueIds = new Set(termIds);
  assert.equal(uniqueIds.size, termIds.length);
  assert.ok(termIds.includes('armor'));
  assert.ok(termIds.includes('shield'));
  assert.ok(termIds.includes('aegis_pip'));
  assert.ok(termIds.includes('corrode'));
  assert.ok(termIds.includes('stack_surge'));
  assert.ok(termIds.includes('overdrive'));

  for (const lang of ['en', 'cs'] as const) {
    const pack = CODEX_TRANSLATIONS[lang];
    for (const id of termIds) {
      const entry = pack.glossary[id];
      assert.ok(entry, `Missing glossary entry ${id} in ${lang}`);
      assert.ok(entry.term.length > 0);
      assert.ok(entry.summary.length > 0);
      assert.ok(entry.mechanics.length > 0);
      assert.ok(entry.tacticalTip.length > 0);
      assert.ok(entry.keywords.length > 0);
    }

    for (const charId of ['kira', 'auraline', 'zuri'] as const) {
      const hero = pack.heroes[charId];
      assert.ok(hero, `Missing hero codex ${charId} in ${lang}`);
      assert.ok(hero.passivePowers.length >= 3);
      assert.ok(hero.overdriveBreakdown.length === 3);
      assert.ok(hero.overdriveRule.length > 0);
      assert.ok(hero.synergies.length > 0);
      assert.ok(hero.tacticalLoop.length > 0);
    }
  }
});

test('filterGlossaryTerms filters by category and bilingual search query', () => {
  const allEn = filterGlossaryTerms('', 'all', 'en');
  assert.equal(allEn.length, GLOSSARY_TERMS.length);

  const armorMatchesEn = filterGlossaryTerms('armor', 'all', 'en');
  assert.ok(armorMatchesEn.some((t) => t.id === 'armor'));
  assert.ok(armorMatchesEn.some((t) => t.id === 'armor_pierce'));
  assert.ok(armorMatchesEn.some((t) => t.id === 'armor_shred'));

  const armorMatchesCs = filterGlossaryTerms('brnění', 'defense', 'cs');
  assert.ok(armorMatchesCs.some((t) => t.id === 'armor'));
  assert.ok(armorMatchesCs.every((t) => t.category === 'defense'));

  const corrodeMatches = filterGlossaryTerms('koroze', 'status', 'cs');
  assert.equal(corrodeMatches.length, 1);
  assert.equal(corrodeMatches[0].id, 'corrode');
});

test('every EnemyPassiveKind maps to a valid GlossaryTermMeta', () => {
  const passives: EnemyPassiveKind[] = [
    'volatile_burst',
    'anchor_aegis',
    'time_bomb',
    'spike_retaliate',
    'acid_jam',
    'threshold_pip',
    'phase_gate',
  ];
  for (const p of passives) {
    const termId: GlossaryTermId = PASSIVE_TO_GLOSSARY_TERM[p];
    const meta = getGlossaryTermMeta(termId);
    assert.ok(meta, `Missing glossary mapping for passive ${p}`);
  }
});
